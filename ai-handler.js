const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, Monster, Entity, Club, Pact } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');
const questUtils = require('./quest-utils');
const { checkLevelUp } = require('./level-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const senderJid = message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;

  const playerState = `Nom:${player.name}${player.isGod?'(GOD)':''} | Métier:${player.occupation} | Org:${player.organization} | Inf:${player.influence} | Bio:${player.characterDescription} | Fam:${player.family} | Classe:${player.class}(${player.derivative}) | SP:${player.skillPoints} | Rang:${player.rank} | Niv:${player.level} | XP:${player.xp}/${player.level*100} | PV:${player.health}/${player.maxHealth} | PM:${player.mana}/${player.maxMana} | Col:${player.col} | Lieu:${player.location} | STATS: FOR:${player.strength} AGI:${player.agility} INT:${player.intelligence} DEF:${player.defense} LUK:${player.luck}`;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0 ? "Inv: " + inventory.map(i => `${i.name}x${i.quantity}`).join(', ') : "Inv: vide";

  const playerQuests = await player.getQuests();
  const activeQuests = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress');
  const questState = activeQuests.length > 0 ? "Quêtes: " + activeQuests.map(q => `${q.title}(${q.PlayerQuest.progress}%)`).join(', ') : "Pas de quête";

  const availableQuests = await Quest.findAll({ where: { rank_required: player.rank }, limit: 3 });
  const availableQuestState = "Quêtes dispo: " + availableQuests.map(q => q.title).join(', ');

  const dungeons = await Dungeon.findAll({ limit: 3 });
  const dungeonState = "Donjons: " + dungeons.map(d => `${d.name}(${d.rank})`).join(', ');

  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        whatsappId: { [Op.ne]: player.whatsappId }
    }
  });
  const socialState = nearbyPlayers.length > 0 ? "Proches: " + nearbyPlayers.map(p => `${p.name}(Niv ${p.level})`).join(', ') : "Seul";
  const items = await Item.findAll({ limit: 3 });
  const shopState = "Shop: " + items.map(i => `${i.name}(${i.price})`).join(', ');

  // Save current player message to memory
  await RPMessage.create({
      senderJid: player.whatsappId,
      senderName: player.name,
      content: actionText,
      location: player.location
  });

  // Fetch small history for context
  const history = await RPMessage.findAll({
      where: { location: player.location },
      order: [['id', 'DESC']],
      limit: 5
  });
  const historyState = history.length > 0
    ? "HISTORIQUE:\n" + history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')
    : "";

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0 ? "Skills: " + playerSkills.map(s => s.name).join(', ') : "Aucun skill";
  const npcs = await NPC.findAll({ where: { location: { [Op.like]: `%${player.location}%` } }, limit: 2 });
  const npcState = "PNJ: " + npcs.map(n => `${n.name}(${n.role})`).join(', ');
  const playerPacts = await player.getEntities();
  const pactState = playerPacts.length > 0 ? "Pactes: " + playerPacts.map(e => e.name).join(', ') : "Pas de pacte";
  const playerClubs = await player.getClubs();
  const clubState = playerClubs?.length > 0 ? "Clubs: " + playerClubs.map(c => c.name).join(', ') : "Pas de club";
  const monsters = await Monster.findAll({ where: { rank: player.rank }, limit: 2 });
  const monsterState = "Monstres: " + monsters.map(m => m.name).join(', ');

  // Time Logic: 1 month real = 1 year RP
  // Reference date: Jan 1st 2024
  const startDate = new Date('2024-01-01').getTime();
  const now = Date.now();
  const elapsedMs = now - startDate;
  const elapsedMonths = elapsedMs / (1000 * 60 * 60 * 24 * 30);
  const rpYears = Math.floor(elapsedMonths);
  const rpMonth = Math.floor((elapsedMonths % 1) * 12) + 1;
  const rpYearString = `An ${rpYears + 1}, Mois ${rpMonth}`;

    // Mini-Event Trigger (20% chance)
    const triggerMiniEvent = Math.random() < 0.20;
    const miniEventContext = triggerMiniEvent
        ? "\n⚠️ **ÉVÉNEMENT IMPRÉVU**: Un événement aléatoire doit se produire maintenant ! (Ex: Un PNJ t'interpelle, un monstre surgit, une annonce impériale, un objet mystérieux trouvé, etc.)"
        : "";

  const systemPrompt = `MJ "Arise/Aetherys". Style Manhwa.
LORE: Convergence (le mana a fusionné les mondes). Éveil (humains avec stats). Conflit Elion vs Vharos. Les Entités (Ignis, Umbra...) cherchent des hôtes.
RÈGLES:
1. RÉACTIVITÉ: Commence par les conséquences. Ne décris JAMAIS les actions/pensées du joueur.
2. RÉALISME: Joueur = citoyen ordinaire. Pas de héros prophétisé. Conséquences brutales.
3. PNJ: Vif, complexe, émotionnel (tics de langage, motivations).
4. COMBAT(1/3): Si défense vague -> 33% touche direct (-15/-30 PV), 66% laisse 1 tour pour réagir.
5. MOUVEMENT: Précise distance (m) et point visé.
6. FORMAT: JSON STRICT {"narrative":"...","actions":[],"imagePrompt":"..."}
ACTIONS: update_player, add_item, notify_player, broadcast, start_quest, advance_quest, complete_quest, forge_pact, join_club.
NARRATION: 4 paragraphes detailés, français uniquement. Pas de parenthèses.`;

    const fullPrompt = `CONTEXTE: ${playerState} | ${inventoryState} | ${skillState} | ${pactState} | ${clubState} | ${questState} | ${availableQuestState} | ${dungeonState} | ${npcState} | ${monsterState} | ${socialState} | ${historyState}\nACTION: ${actionText}`;

  try {
    let content = await callAI(systemPrompt, fullPrompt);
    if (!content) {
        content = JSON.stringify({ narrative: "🌀 *Le flux magique est instable.* L'Ether ne répond pas à tes appels...", actions: [] });
    }
    console.log(`[AI RAW] Contenu reçu: ${typeof content === 'string' ? content.substring(0, 500) : '[Object]'}`);

    // Enhanced JSON & Narrative extraction
    let aiResponse = { narrative: "", actions: [], notifications: [], broadcastMessage: null };

    const cleanupNarrative = (t) => {
        if (!t) return "";
        return t.replace(/```json/gi, '')
                .replace(/```/g, '')
                .replace(/^(json|JSON)/g, '')
                .replace(/\{[\s\S]*\}/g, '') // Remove any internal JSON strings
                .replace(/^(Narrative|Narrateur|MJ|Systeme|Arise|json|JSON)\s*:\s*/i, '')
                .replace(/(\n|^)[a-z_]+_change:.*(\n|$)/gi, '')
                .trim();
    };

    if (typeof content === 'object') {
        aiResponse = { ...aiResponse, ...content };
    } else {
        // Robust JSON extraction: Find the largest JSON block possible
        let start = content.indexOf('{');
        let end = content.lastIndexOf('}');

        if (start !== -1 && end !== -1 && end > start) {
            const potentialJson = content.substring(start, end + 1);
            try {
                const parsed = JSON.parse(potentialJson);
                aiResponse = { ...aiResponse, ...parsed };
            } catch (e) {
                // If the big block failed, try finding individual smaller blocks (fallback for mixed content)
                const matches = [...content.matchAll(/\{[\s\S]*?\}/g)];
                for (const match of matches) {
                    try {
                        const potential = JSON.parse(match[0]);
                        if (potential.actions) aiResponse.actions = [...(aiResponse.actions || []), ...potential.actions];
                        if (potential.narrative && (!aiResponse.narrative || potential.narrative.length > aiResponse.narrative.length)) {
                            aiResponse.narrative = potential.narrative;
                        }
                        if (potential.imagePrompt) aiResponse.imagePrompt = potential.imagePrompt;
                    } catch (innerE) {}
                }
            }
        }

        // If no narrative found in JSON, or parse failed, use the whole text excluding all JSON-like blocks
        if (!aiResponse.narrative || aiResponse.narrative.length < 10) {
            let plainText = content.replace(/\{[\s\S]*?\}/g, '').trim();
            aiResponse.narrative = cleanupNarrative(plainText);
        }

        // Final fallback: if still empty, use content but clean it hard
        if (!aiResponse.narrative || aiResponse.narrative.length < 10) {
            aiResponse.narrative = cleanupNarrative(content);
        }
    }

    // Ensure narrative is clean
    aiResponse.narrative = cleanupNarrative(aiResponse.narrative);

    if (!aiResponse.narrative || aiResponse.narrative.length < 3) {
        aiResponse.narrative = "Le flux magique est instable. L'action est en suspens...";
    }

    console.log("[AI PARSED] Actions détectées:", aiResponse.actions?.length || 0);
    const actions = aiResponse.actions || [];

    if (!aiResponse.narrative) {
        aiResponse.narrative = "Il ne se passe rien de spécial.";
    }

    // Save bot response to memory
    await RPMessage.create({
        senderJid: 'bot',
        senderName: 'Arise MJ',
        content: aiResponse.narrative,
        location: player.location
    });

    // Collected quest feedback lines appended to the narrative after the loop.
    const questFeedback = [];

    // Process AI actions
    for (const actionObj of actions) {
      try {
      const { type, parameters } = actionObj;
      if (!parameters) continue;

      let target = player;
      if (parameters.target_name) {
          const foundTarget = await Player.findOne({
              where: {
                  name: parameters.target_name,
                  location: player.location
              }
          });
          if (foundTarget) {
              target = foundTarget;
          }
      }

      // Track if target needs a final reload/save
      let targetModified = false;

      switch (type) {
        case 'update_player':
          if (parameters.col_change) {
              await target.increment('col', { by: parameters.col_change });
              targetModified = true;
          }
          if (parameters.xp_gain) {
              await target.increment('xp', { by: parameters.xp_gain });
              await checkLevelUp(target, sock);
              targetModified = true;
          }
          if (parameters.health_change) {
              await target.increment('health', { by: parameters.health_change });
              await target.reload();
              if (target.health > target.maxHealth) await target.update({ health: target.maxHealth });
              if (target.health < 0) await target.update({ health: 0 });
              targetModified = true;
          }
          if (parameters.max_health_change) {
              await target.increment('maxHealth', { by: parameters.max_health_change });
              targetModified = true;
          }
          if (parameters.mana_change) {
              await target.increment('mana', { by: parameters.mana_change });
              await target.reload();
              if (target.mana > target.maxMana) await target.update({ mana: target.maxMana });
              if (target.mana < 0) await target.update({ mana: 0 });
              targetModified = true;
          }
          if (parameters.max_mana_change) {
              await target.increment('maxMana', { by: parameters.max_mana_change });
              targetModified = true;
          }
          if (parameters.strength_change) {
              await target.increment('strength', { by: parameters.strength_change });
              targetModified = true;
          }
          if (parameters.agility_change) {
              await target.increment('agility', { by: parameters.agility_change });
              targetModified = true;
          }
          if (parameters.intelligence_change) {
              await target.increment('intelligence', { by: parameters.intelligence_change });
              targetModified = true;
          }
          if (parameters.defense_change) {
              await target.increment('defense', { by: parameters.defense_change });
              targetModified = true;
          }
          if (parameters.luck_change) {
              await target.increment('luck', { by: parameters.luck_change });
              targetModified = true;
          }

          if (parameters.new_location) {
              await target.update({ location: parameters.new_location });
              // Check if there is a local image for this location
              const locationImages = {
                  'Académie Impériale': 'assets/locations/academy.jpg',
                  'Eldoria': 'assets/locations/eldoria.jpg', // if it exists
              };
              if (locationImages[parameters.new_location] && !aiResponse.imagePrompt) {
                  aiResponse.imagePrompt = locationImages[parameters.new_location];
              }
          }
          if (parameters.new_rank) await target.update({ rank: parameters.new_rank });
          if (parameters.new_class) await target.update({ class: parameters.new_class });
          if (parameters.schoolName) await target.update({ schoolName: parameters.schoolName });
          if (parameters.academicGrade_change) {
              await target.increment('academicGrade', { by: parameters.academicGrade_change });
              targetModified = true;
          }
          if (parameters.sp_gain) {
              await target.increment('skillPoints', { by: parameters.sp_gain });
              targetModified = true;
          }

          if (targetModified) {
              await target.save();
              await target.reload();
          }
          break;

        case 'add_skill':
          if (parameters.skillName) {
            const skill = await Skill.findOne({
                where: {
                    [Op.or]: [
                        { name: { [Op.like]: `%${parameters.skillName}%` } },
                        { name: parameters.skillName }
                    ]
                }
            });
            if (skill) {
              const hasSkill = await target.hasSkill(skill);
              if (!hasSkill) {
                await target.addSkill(skill);
                console.log(`[AI] Skill added to ${target.name}: ${skill.name}`);
                const bonuses = skill.statBonuses;
                for (const [stat, value] of Object.entries(bonuses)) {
                  if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                    await target.increment(stat, { by: value });
                  }
                }
                await target.save();
                await target.reload();
              }
            }
          }
          break;

        case 'add_item':
          if (parameters.itemName && parameters.quantity) {
            const inventory = [...target.inventory];
            const existingItem = inventory.find(i => i.name.toLowerCase() === parameters.itemName.toLowerCase());

            if (existingItem) {
                existingItem.quantity += parameters.quantity;
            } else {
                inventory.push({ name: parameters.itemName, quantity: parameters.quantity });
            }

            target.inventory = inventory;
            await target.save();

            const itemData = await Item.findOne({ where: { name: { [Op.like]: `%${parameters.itemName}%` } } });
            if (itemData) {
                const bonuses = itemData.statBonuses;
                let itemModified = false;
                for (const [stat, value] of Object.entries(bonuses)) {
                    if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                        await target.increment(stat, { by: value * parameters.quantity });
                        itemModified = true;
                    }
                }
                if (itemModified) {
                    await target.save();
                    await target.reload();
                }
                if (itemData.imageUrl && !aiResponse.imagePrompt && target.whatsappId === player.whatsappId) {
                    aiResponse.imagePrompt = itemData.imageUrl;
                }
            }
          }
          break;

        case 'remove_item':
            if (parameters.itemName && parameters.quantity) {
                let inventory = [...target.inventory];
                const itemIndex = inventory.findIndex(i => i.name.toLowerCase() === parameters.itemName.toLowerCase());
                if (itemIndex !== -1) {
                    const actualQuantityToRemove = Math.min(parameters.quantity, inventory[itemIndex].quantity);
                    inventory[itemIndex].quantity -= actualQuantityToRemove;

                    if (inventory[itemIndex].quantity <= 0) {
                        inventory.splice(itemIndex, 1);
                    }

                    target.inventory = inventory;
                    await target.save();

                    const itemData = await Item.findOne({ where: { name: { [Op.like]: `%${parameters.itemName}%` } } });
                    if (itemData) {
                        const bonuses = itemData.statBonuses;
                        for (const [stat, value] of Object.entries(bonuses)) {
                            if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                                await target.decrement(stat, { by: value * actualQuantityToRemove });
                            }
                        }
                        await target.save();
                        await target.reload();
                    }
                }
            }
            break;

        case 'interact_npc':
            if (parameters.npcName) {
                const npc = await NPC.findOne({ where: { name: { [Op.like]: `%${parameters.npcName}%` } } });
                if (npc) {
                    console.log(`[AI] Interaction avec PNJ: ${npc.name}`);
                    // Trigger specific effects based on NPC and parameters if needed
                    // For now, it's mostly narrative, but we could add logic here
                }
            }
            break;

        case 'notify_player':
            if (parameters.target_name && parameters.message) {
                const notifyTarget = await Player.findOne({ where: { name: { [Op.like]: `%${parameters.target_name}%` }, location: player.location } });
                if (notifyTarget) {
                    await sock.sendMessage(notifyTarget.whatsappId, {
                        text: `🔔 *Message de RP*\n\n${parameters.message}`
                    });
                }
            }
            break;

        case 'broadcast':
            if (parameters.message) {
                for (const other of nearbyPlayers) {
                    await sock.sendMessage(other.whatsappId, {
                        text: `📣 *Annonce RP*\n\n${parameters.message}`
                    });
                }
            }
            break;

        case 'start_quest':
            if (parameters.questTitle) {
                const line = await questUtils.startQuest(target, parameters.questTitle);
                if (line) questFeedback.push(line);
            }
            break;

        case 'advance_quest':
            if (parameters.questTitle) {
                const line = await questUtils.advanceQuest(target, parameters.questTitle, parameters.progress, parameters.note);
                if (line) questFeedback.push(line);
            }
            break;

        case 'complete_quest':
            if (parameters.questTitle) {
                const line = await questUtils.completeQuest(target, parameters.questTitle, sock);
                if (line) questFeedback.push(line);
            }
            break;

        case 'update_quest': // AI modifies the course of a quest
            if (parameters.questTitle) {
                const line = await questUtils.modifyQuest(target, parameters.questTitle, parameters.branch, parameters.notes);
                if (line) questFeedback.push(line);
            }
            break;

        case 'start_multiplayer_quest':
            if (parameters.questTitle) {
                const res = await questUtils.startMultiplayerQuest(player, parameters.questTitle);
                if (res) {
                    questFeedback.push(`🤝 *Quête coopérative lancée* : ${res.quest.title}`);
                    for (const n of res.notified) {
                        await sock.sendMessage(n.player.whatsappId, {
                            text: `🤝 *Quête coopérative !*\n${player.name} t'embarque dans une quête.\n\n${n.line}`
                        });
                    }
                }
            }
            break;

        case 'forge_pact':
            if (parameters.entityName) {
                const entity = await Entity.findOne({ where: { name: { [Op.like]: `%${parameters.entityName}%` } } });
                if (entity) {
                    const hasPact = await target.hasEntity(entity);
                    if (!hasPact) {
                        await target.addEntity(entity);
                        const bonuses = entity.pactBonus || {};
                        for (const [stat, value] of Object.entries(bonuses)) {
                            if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                                await target.increment(stat, { by: value });
                            }
                        }
                        await target.save();
                        await target.reload();
                        questFeedback.push(`🔥 *PACT FORGÉ* : Tu es désormais lié à ${entity.name}.`);
                    }
                }
            }
            break;

        case 'join_club':
            if (parameters.clubName) {
                const club = await Club.findOne({ where: { name: { [Op.like]: `%${parameters.clubName}%` } } });
                if (club) {
                    const hasClub = await target.hasClub(club);
                    if (!hasClub) {
                        await target.addClub(club);
                        questFeedback.push(`🏫 *CLUB REJOINT* : Tu es désormais membre du ${club.name}.`);
                    }
                }
            }
            break;
      }

      // Notify target if it's not the current player
      if (target.whatsappId !== player.whatsappId) {
          await sock.sendMessage(target.whatsappId, {
              text: `🔔 *NOTIFICATION RP*\n\n${player.name} a interagi avec toi !\n\n${aiResponse.narrative}`
          });
      }
      } catch (actionError) {
          console.error(`[AI] Erreur lors du traitement d'une action (${actionObj.type}):`, actionError);
      }
    }

    // Additional player notifications
    if (Array.isArray(aiResponse.notifications)) {
      for (const notice of aiResponse.notifications) {
        if (!notice || !notice.target_name || !notice.message) continue;
        const targetPlayer = await Player.findOne({ where: { name: { [Op.like]: `%${notice.target_name}%` }, location: player.location } });
        if (targetPlayer) {
          await sock.sendMessage(targetPlayer.whatsappId, {
            text: `🔔 *Message de RP*\n\n${notice.message}`
          });
        }
      }
    }

    if (aiResponse.broadcastMessage) {
      for (const other of nearbyPlayers) {
        await sock.sendMessage(other.whatsappId, {
          text: `📣 *Annonce RP*\n\n${aiResponse.broadcastMessage}`
        });
      }
    }

    // Append quest progression feedback to the narrative.
    if (questFeedback.length > 0) {
      aiResponse.narrative = `${aiResponse.narrative}\n\n${questFeedback.join('\n\n')}`;
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
