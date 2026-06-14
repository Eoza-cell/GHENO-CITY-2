const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, Monster } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI, cleanAIResponse, extractNarrative } = require('./ai-utils');
const { getCurrentRPTime } = require('./world-clock');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const senderJid = message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;

  const playerState = `
    - Nom: ${player.name} ${player.isGod ? '(DIEU SUPRÊME)' : ''}
    - JID: ${player.whatsappId}
    - Description: ${player.characterDescription}
    - Famille: ${player.family}
    - Classe: ${player.class} (${player.derivative})
    - Points de Compétence (SP): ${player.skillPoints}
    - Rang: ${player.rank}
    - Niveau: ${player.level}
    - XP: ${player.xp}/${player.level * 100}
    - Vie: ${player.health}/${player.maxHealth}
    - Mana: ${player.mana}/${player.maxMana}
    - Col: ${player.col}
    - Emplacement: ${player.location}
    - STATS: Force:${player.strength} Agilité:${player.agility} Intelligence:${player.intelligence} Défense:${player.defense} Chance:${player.luck}
  `;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0
    ? "Inventaire:\n" + inventory.map(i => `- ${i.name} (x${i.quantity})`).join('\n')
    : "Ton inventaire est vide.";

  const playerQuests = await player.getQuests();
  const activeQuests = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress');

  const questState = activeQuests.length > 0
    ? "Quêtes Actives:\n" + activeQuests.map(q => `- ${q.title}: ${q.description}`).join('\n')
    : "Aucune quête active.";

  const availableQuests = await Quest.findAll({
      where: { rank_required: player.rank },
      limit: 3
  });
  const availableQuestState = "Quêtes dispo (Rang " + player.rank + "):\n" + availableQuests.map(q => `- ${q.title}`).join('\n');

  const dungeons = await Dungeon.findAll({ limit: 5 });
  const dungeonState = "Donjons:\n" + dungeons.map(d => `- ${d.name} (${d.rank})`).join('\n');

  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        whatsappId: { [Op.ne]: player.whatsappId }
    }
  });
  const socialState = nearbyPlayers.length > 0
    ? "Joueurs à proximité:\n" + nearbyPlayers.map(p => `- Nom: ${p.name}, Niveau: ${p.level}, Classe: ${p.class}, Vie: ${p.health}/${p.maxHealth}, Rang: ${p.rank}`).join('\n')
    : "Tu es seul ici.";

  const nearbyPlayersDetails = nearbyPlayers.length > 0
    ? nearbyPlayers.map(p => `- ${p.name} (${p.class}, niveau ${p.level})`).join('\n')
    : "Aucun autre joueur dans ta zone.";

  // Limit shop items to a few featured ones to save tokens
  const items = await Item.findAll({
      where: {
          [Op.or]: [
              { price: { [Op.lte]: player.col + 300 } }, // Items the player can almost afford
              { name: ['Elucidator', 'Lambent Light'] } // Only 2 featured items
          ]
      },
      limit: 5
  });
  const shopState = "Boutique (Aperçu):\n" + items.map(i => `- ${i.name} (${i.price} Col): ${i.description.substring(0, 50)}...`).join('\n');

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
      limit: 3
  });
  const historyState = history.length > 0
    ? "HISTORIQUE:\n" + history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')
    : "";

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0
    ? "Compétences:\n" + playerSkills.map(s => `- ${s.name}: ${s.description.substring(0, 40)}...`).join('\n')
    : "Aucune compétence.";

  const kingdomState = "Monde: Empire d'Elion (Paix), Valkyrr (Trêve), Dominion Noir (Guerre).";
  const rpTime = getCurrentRPTime();

  // Context-aware NPCs
  const npcs = await NPC.findAll({
      where: { location: { [Op.like]: `%${player.location}%` } },
      limit: 3
  });
  const npcState = "PNJ ici:\n" + npcs.map(n => `- ${n.name} (${n.role})`).join('\n');

  const monsters = await Monster.findAll({
      where: { rank: player.rank },
      limit: 3
  });
  const monsterState = "Monstres:\n" + monsters.map(m => `- ${m.name} (PV:${m.health} ATK:${m.strength} DEF:${m.defense})`).join('\n');

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

  const systemPrompt = `Tu es le MJ d'Arise/Aetherys. Style Anime/Solo Leveling.
Réponds uniquement en JSON en FRANÇAIS.

RÈGLES DE COMBAT & RP:
- Narration épique (2-3 paragraphes).
- PRÉCISION: Inclus impérativement les distances (en mètres), les techniques utilisées, les parties du corps visées/utilisées, et les tentatives d'esquives.
- IMPACT: Décris l'impact réel sur l'environnement et l'adversaire.
- RÉALISME: Respecte les stats du joueur.
- Pas de parenthèses pour les sons ou onomatopées.

FORMAT JSON:
{
  "narrative": "Ton récit...",
  "actions": [
    {"type": "update_player", "parameters": {"xp_gain": 10, "col_change": 5, "health_change": -5}},
    {"type": "add_item", "parameters": {"itemName": "Potion", "quantity": 1}}
  ]
}`;

    const fullPrompt = `DATE RP: ${rpTime.full}\n${playerState}\n${inventoryState}\n${skillState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${npcState}\n${monsterState}\n${socialState}\nJoueurs proches:\n${nearbyPlayersDetails}\n${historyState}\n\nACTION DU JOUEUR: ${actionText}`;

  try {
    let content = await callAI(systemPrompt, fullPrompt);
    if (!content) {
        throw new Error("L'IA a retourné une réponse vide.");
    }
    console.log(`[AI RAW] Contenu reçu: ${typeof content === 'string' ? content.substring(0, 500) : 'Object'}...`);

    // Enhanced JSON & Narrative extraction using centralized logic
    const aiResponse = extractNarrative(content);

    if (!aiResponse.narrative || aiResponse.narrative.length < 3) {
        aiResponse.narrative = "🌀 *Le flux magique est instable.* La matrice de Skype semble s'obscurcir un instant. L'action est en suspens, réessaie dans quelques instants...";
    } else {
        // Prepend World Clock to narrative
        aiResponse.narrative = `${rpTime.full}\n\n${aiResponse.narrative}`;
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

    // Process AI actions
    for (const actionObj of actions) {
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
              await target.reload();
              const xpNeeded = target.level * 100;
              if (target.xp >= xpNeeded) {
                  const levelsGained = Math.floor(target.xp / xpNeeded);
                  await target.increment('level', { by: levelsGained });
                  await target.update({
                      xp: target.xp % xpNeeded,
                      maxHealth: target.maxHealth + (levelsGained * 15),
                      maxMana: target.maxMana + (levelsGained * 8),
                      health: target.maxHealth + (levelsGained * 15),
                      mana: target.maxMana + (levelsGained * 8),
                      strength: target.strength + (levelsGained * 1),
                      agility: target.agility + (levelsGained * 1),
                      intelligence: target.intelligence + (levelsGained * 1)
                  });
                  await sock.sendMessage(target.whatsappId, {
                      text: `✨ *LEVEL UP !* ✨\nTu es maintenant niveau ${target.level} !\nTes stats ont augmenté.`
                  });
              }
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
      }

      // Notify target if it's not the current player
      if (target.whatsappId !== player.whatsappId) {
          await sock.sendMessage(target.whatsappId, {
              text: `🔔 *NOTIFICATION RP*\n\n${player.name} a interagi avec toi !\n\n${aiResponse.narrative}`
          });
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

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error('Erreur MJ Arise:', error);
    const fallbackMsg = "⚠️ *ERREUR MATRICE* ⚠️\n\nLe MJ n'a pas pu traiter cette action car la connexion avec l'IA a échoué ou est saturée. Veuillez réessayer dans quelques secondes. Tape /checkai pour diagnostiquer le flux.";
    await sock.sendMessage(jid, { text: fallbackMsg });
  }
}

module.exports = { handleFreeAction };
