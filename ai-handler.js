const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, Monster } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const senderJid = message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;

  const playerState = `
    - Nom: ${player.name} ${player.isGod ? '(DIEU SUPRÊME)' : ''}
    - Description: ${player.characterDescription}
    - Famille: ${player.family}
    - Classe: ${player.class}
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

    FORMAT DE RÉPONSE (JSON STRICT):
    {
      "narrative": "Ton récit en français...",
      "actions": [
        {"type": "update_player", "parameters": {"col_change": 10, "xp_gain": 20, "new_class": "Optionnel"}},
        {"type": "add_item", "parameters": {"itemName": "Objet", "quantity": 1}}
      ],
      "imagePrompt": "Description visuelle pour l'IA d'image"
    }
  `;

    const fullPrompt = `${playerState}\n${inventoryState}\n${skillState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${npcState}\n${monsterState}\n\n${historyState}\n\nACTION: ${actionText}`;

  try {
    let content = await callAI(systemPrompt, fullPrompt);
    if (!content) {
        throw new Error("L'IA a retourné une réponse vide.");
    }
    console.log(`[AI RAW] Contenu reçu: ${content.substring(0, 500)}...`);

    // Enhanced JSON & Narrative extraction
    let aiResponse = { narrative: "", actions: [] };

    if (typeof content === 'object') {
        aiResponse = content;
    } else {
        // Find the JSON block boundaries
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            const potentialJson = content.substring(firstBrace, lastBrace + 1);
            try {
                aiResponse = JSON.parse(potentialJson);
            } catch (e) {
                console.error("[MJ] Erreur parse JSON, tentative récupération narrative...");
            }
        }

        // If narrative is missing or empty inside JSON, extract from surrounding text
        if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
            let textBefore = firstBrace !== -1 ? content.substring(0, firstBrace).trim() : "";
            let textAfter = lastBrace !== -1 ? content.substring(lastBrace + 1).trim() : "";

            // Cleanup markers
            const cleanup = (t) => t.replace(/```json/gi, '').replace(/```/g, '').replace(/^(json|JSON)/g, '').trim();
            textBefore = cleanup(textBefore);
            textAfter = cleanup(textAfter);

            if (textBefore.length > 5) aiResponse.narrative = textBefore;
            else if (textAfter.length > 5) aiResponse.narrative = textAfter;
            else if (firstBrace === -1) aiResponse.narrative = cleanup(content);
        }
    }

    // Final scrub of ALL AI/JSON artifacts from narrative
    if (aiResponse.narrative) {
        aiResponse.narrative = aiResponse.narrative
            .replace(/\{[\s\S]*\}/g, '') // Remove any internal JSON strings
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/^(Narrative|Narrateur|MJ|Systeme|Arise|json|JSON)\s*:\s*/i, '')
            .replace(/(\n|^)[a-z_]+_change:.*(\n|$)/gi, '') // Remove accidental action-like lines
            .trim();
    }

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

    // Process AI actions
    for (const actionObj of actions) {
      const { type, parameters } = actionObj;
      if (!parameters) continue;

      let target = player;
      if (parameters.target_name) {
          const foundTarget = await Player.findOne({
              where: {
                  name: parameters.target_name,
                  location: player.location // Only target players at same location
              }
          });
          if (foundTarget) {
              target = foundTarget;
          } else {
              console.log(`[AI] Target not found or not at location: ${parameters.target_name}`);
          }
      }

      switch (type) {
        case 'update_player':
          if (parameters.monster_name && parameters.monster_damage) {
              const monster = await Monster.findOne({ where: { name: parameters.monster_name } });
              if (monster) {
                  console.log(`[COMBAT] ${monster.name} subit ${parameters.monster_damage} dégâts.`);
                  // Here we could track monster HP in a session or temp table if needed,
                  // but for now we follow the AI's narrative verdict.
                  if (parameters.monster_damage >= monster.health) {
                      console.log(`[COMBAT] ${monster.name} est vaincu !`);
                  }
              }
          }
          if (parameters.col_change) await target.increment('col', { by: parameters.col_change });
          if (parameters.xp_gain) {
              await target.increment('xp', { by: parameters.xp_gain });
              // Reload target to check XP
              await target.reload();
              const xpNeeded = target.level * 100;
              if (target.xp >= xpNeeded) {
                  const levelsGained = Math.floor(target.xp / xpNeeded);
                  await target.increment('level', { by: levelsGained });
                  await target.update({
                      xp: target.xp % xpNeeded,
                      maxHealth: target.maxHealth + (levelsGained * 15), // Reduced from 20 for balance
                      maxMana: target.maxMana + (levelsGained * 8), // Reduced from 10
                      health: target.maxHealth + (levelsGained * 15),
                      mana: target.maxMana + (levelsGained * 8),
                      // Automatic small stat increase on level up
                      strength: target.strength + (levelsGained * 1),
                      agility: target.agility + (levelsGained * 1),
                      intelligence: target.intelligence + (levelsGained * 1)
                  });
                  await sock.sendMessage(target.whatsappId, {
                      text: `✨ *LEVEL UP !* ✨\nTu es maintenant niveau ${target.level} !\nTes points de vie et de mana ont augmenté.`
                  });
              }
          }
          if (parameters.health_change) {
              await target.increment('health', { by: parameters.health_change });
              await target.reload();
              if (target.health > target.maxHealth) await target.update({ health: target.maxHealth });
              if (target.health < 0) await target.update({ health: 0 });
          }
          if (parameters.max_health_change) await target.increment('maxHealth', { by: parameters.max_health_change });
          if (parameters.mana_change) {
              await target.increment('mana', { by: parameters.mana_change });
              await target.reload();
              if (target.mana > target.maxMana) await target.update({ mana: target.maxMana });
              if (target.mana < 0) await target.update({ mana: 0 });
          }
          if (parameters.max_mana_change) await target.increment('maxMana', { by: parameters.max_mana_change });
          if (parameters.strength_change) await target.increment('strength', { by: parameters.strength_change });
          if (parameters.agility_change) await target.increment('agility', { by: parameters.agility_change });
          if (parameters.intelligence_change) await target.increment('intelligence', { by: parameters.intelligence_change });
          if (parameters.defense_change) await target.increment('defense', { by: parameters.defense_change });
          if (parameters.luck_change) await target.increment('luck', { by: parameters.luck_change });
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
          if (parameters.academicGrade_change) await target.increment('academicGrade', { by: parameters.academicGrade_change });
          if (parameters.sp_gain) await target.increment('skillPoints', { by: parameters.sp_gain });
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
                for (const [stat, value] of Object.entries(bonuses)) {
                    if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                        await target.increment(stat, { by: value * parameters.quantity });
                    }
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
      }

      // Notify target if it's not the current player
      if (target.whatsappId !== player.whatsappId) {
          await sock.sendMessage(target.whatsappId, {
              text: `🔔 *NOTIFICATION RP*\n\n${player.name} a interagi avec toi !\n\n${aiResponse.narrative}`
          });
      }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
