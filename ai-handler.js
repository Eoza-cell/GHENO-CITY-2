const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, Monster } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI, cleanAIResponse, extractNarrative } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const senderJid = message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;

  const playerState = `
    - Nom: ${player.name} ${player.isGod ? '(DIEU SUPRÊME)' : ''}
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

  const systemPrompt = `
    Tu es le MJ de "Arise / Aetherys". RPG de type Manhwa/Anime (style Solo Leveling, SAO, Overlord).

    STYLE NARRATIF:
    - Épique, dynamique et visuel. Mélange d'HUMOUR ANIME (exagérations, gags visuels, chutes ridicules) et de MOMENTS SÉRIEUX (tension dramatique, enjeux de vie ou de mort).
    - Ajoute du "FAN SERVICE" (descriptions esthétiques, charisme frappant des PNJs, gros plans dramatiques sur les visages ou les poses).
    - Pas de texte en anglais. PAS de parenthèses pour les sons (ex: PAS de "(Clang!)").
    - LONGUEUR: Minimum 3-4 paragraphes riches en détails et émotions.

    RÈGLES MJ:
    1. RÔLE DU JOUEUR: Le joueur est le PROTAGONISTE. Il n'est pas forcément un héros. Libre de ses choix, lié seulement à sa famille et ses capacités.
    2. LIBERTÉ TOTALE: Tu ne contrôles PAS les actions du joueur. Tu es le monde qui réagit.
    3. RECONNAISSANCE: Commence TOUJOURS par valider l'action du joueur avant d'enchaîner sur la narration.
    4. NPCs ARCHÉTYPES: Utilise des archétypes anime marqués :
       - Tsundere (froide puis douce), Kuudere (sans émotion), Dandere (timide), Ojou-sama (arrogante/noble).
       - Rival arrogant qui finit par respecter le joueur, Maître pervers/excentrique, etc.
    5. LÉTALITÉ & CONSÉQUENCES: Un échec peut être drôle (humiliation) ou tragique (blessure grave), mais ne doit jamais être ignoré.

    ÉCHELLE DE PUISSANCE ET IMPACT DES STATS:
    - FORCE (FOR): ≥10 (Humain simple), ≥50 (Détruit des murs, fissure le sol), ≥150 (Pulvérise des bâtiments, ondes de choc).
    - VITESSE (AGI): Rang E (2m/s), Rang D (10m/s - Record humain), Rang C (30m/s - Image rémanente), Rang B+ (Vitesse supersonique, invisible).
    - INTELLIGENCE (INT): ≥10 (Petits sorts, lumière), ≥50 (Explosions de zone, manipulation élémentaire majeure), ≥150 (Sorts cataclysmiques, altération de la réalité).
    - DÉFENSE (DEF): ≥10 (Résistance humaine), ≥50 (Peau d'acier, ignore les lames communes), ≥150 (Invulnérabilité physique quasi-totale).
    - CHANCE (LUCK): Influence les coïncidences heureuses et les loots rares.

    SOCIAL:
    - Tu gères des interactions entre joueurs dans la même zone.
    - Si l'action du joueur implique un autre joueur, tu peux créer une notification directe à ce joueur via une action notify_player.
    - Si l'événement concerne tous les joueurs du lieu, utilise une action broadcast.
    - Ne nomme jamais la JID ou d'autres données techniques, seulement les noms de personnages.

    FORMAT DE RÉPONSE (JSON STRICT):
    {
      "narrative": "Ton récit en français...",
      "actions": [
        {"type": "update_player", "parameters": {"col_change": 10, "xp_gain": 20, "new_class": "Optionnel"}},
        {"type": "add_item", "parameters": {"itemName": "Objet", "quantity": 1}},
        {"type": "notify_player", "parameters": {"target_name": "Nom du joueur", "message": "Texte de notification RP"}},
        {"type": "broadcast", "parameters": {"message": "Annonce RP pour tous les joueurs présents"}}
      ],
      "imagePrompt": "Description visuelle pour l'IA d'image"
    }
  `;

    const fullPrompt = `${playerState}\n${inventoryState}\n${skillState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${npcState}\n${monsterState}\n${socialState}\nJoueurs proches:\n${nearbyPlayersDetails}\n${historyState}\n\nACTION: ${actionText}`;

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
