const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, NPC, Skill, RPMessage, Monster } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const senderJid = message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;

  const playerState = `
    - Nom: ${player.name}
    - Description: ${player.characterDescription}
    - Classe: ${player.class}
    - Rang: ${player.rank}
    - Niveau: ${player.level}
    - XP: ${player.xp}/${player.level * 100}
    - Vie: ${player.health}/${player.maxHealth}
    - Mana: ${player.mana}/${player.maxMana}
    - Col: ${player.col}
    - Emplacement: ${player.location}
    - Statistiques: Force ${player.strength}, Agilité ${player.agility}, Intelligence ${player.intelligence}, Défense ${player.defense}, Chance ${player.luck}
  `;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0
    ? "Inventaire:\n" + inventory.map(i => `- ${i.name} (x${i.quantity})`).join('\n')
    : "Ton inventaire est vide.";

  const allQuests = await Quest.findAll();
  const playerQuests = await player.getQuests();

  const activeQuestNames = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress').map(q => q.title);
  const completedQuestNames = playerQuests.filter(q => q.PlayerQuest.status === 'completed').map(q => q.title);

  const questState = playerQuests.length > 0
    ? "Tes Quêtes:\n" + playerQuests.map(q => `- ${q.title} [${q.PlayerQuest.status}]`).join('\n')
    : "Tu n'as commencé aucune quête.";

  const availableQuests = allQuests.filter(q => !activeQuestNames.includes(q.title) && !completedQuestNames.includes(q.title));
  const availableQuestState = availableQuests.length > 0
    ? "Quêtes disponibles dans le monde:\n" + availableQuests.map(q => `- ${q.title}: ${q.description} (Requis: Rang ${q.rank_required})`).join('\n')
    : "Toutes les quêtes connues ont été commencées ou terminées.";

  const dungeons = await Dungeon.findAll();
  const dungeonState = "Donjons connus:\n" + dungeons.map(d => `- ${d.name} (Rang ${d.rank})`).join('\n');

  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        whatsappId: { [Op.ne]: player.whatsappId }
    }
  });
  const socialState = nearbyPlayers.length > 0
    ? "Joueurs à proximité:\n" + nearbyPlayers.map(p => `- Nom: ${p.name}, Niveau: ${p.level}, Classe: ${p.class}, Vie: ${p.health}/${p.maxHealth}, Rang: ${p.rank}`).join('\n')
    : "Tu es seul ici.";

  const items = await Item.findAll();
  const shopState = "Objets en vente à la boutique:\n" + items.map(i => `- ${i.name} (${i.price} Col): ${i.description}`).join('\n');

  // Save current player message to memory before fetching history
  await RPMessage.create({
      senderJid: player.whatsappId,
      senderName: player.name,
      content: actionText,
      location: player.location
  });

  // Memory: Get last 15 messages from this location (now including the current one)
  const history = await RPMessage.findAll({
      where: { location: player.location },
      order: [['timestamp', 'DESC']],
      limit: 15
  });
  const historyState = history.length > 0
    ? "Historique récent à cet endroit (Mémoire):\n" + history.reverse().map(h => `[${h.timestamp.toLocaleTimeString()}] ${h.senderName}: ${h.content}`).join('\n')
    : "Aucun événement récent marqué dans la mémoire collective ici.";

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0
    ? "Compétences possédées:\n" + playerSkills.map(s => `- ${s.name} (${s.type}): ${s.description}`).join('\n')
    : "Tu n'as aucune compétence. Étudie à l'Académie Impériale !";

  const kingdoms = await Kingdom.findAll();
  const kingdomState = "État du Monde (Royaumes & Guerres):\n" + kingdoms.map(k => `- ${k.name}: ${k.description} [Statut: ${k.status}]`).join('\n');

  const npcs = await NPC.findAll();
  const npcState = "Personnages Importants (PNG) connus:\n" + npcs.map(n => `- ${n.name} (${n.role}) à ${n.location}: ${n.description}`).join('\n');

  const monsters = await Monster.findAll();
  const monsterState = "Bestiaire (Référence de puissance pour le MJ):\n" + monsters.map(m => `- ${m.name} (Rang ${m.rank}): PV ${m.health}, STR ${m.strength}, DEF ${m.defense}, AGI ${m.agility}`).join('\n');

  // Time Logic: 1 month real = 1 year RP
  // Reference date: Jan 1st 2024
  const startDate = new Date('2024-01-01').getTime();
  const now = Date.now();
  const elapsedMs = now - startDate;
  const elapsedMonths = elapsedMs / (1000 * 60 * 60 * 24 * 30);
  const rpYears = Math.floor(elapsedMonths);
  const rpMonth = Math.floor((elapsedMonths % 1) * 12) + 1;
  const rpYearString = `An ${rpYears + 1}, Mois ${rpMonth}`;

  const systemPrompt = `
    Tu es le Maître du Jeu (MJ) de "Arise / Le Monde d’Aetherys", un RPG textuel ultra-immersif. Ta seule et unique fonction est de retourner un objet JSON valide basé sur l'action du joueur. Ne retourne RIEN d'autre que du JSON.

    LORE D'AETHERYS:
    - Le monde était uni sous l'Empire Céleste d'Elion avant la "Fracture des Couronnes".
    - Nations: Empire d'Elion (Magie sacrée, Lux Aeterna), Valkyrr (Glace, Runes), Sultanat d'Azrak (Désert, Artefacts), République de Nereïs (Mer, Explorateurs), Dominion Noir de Vharos (Nécromancie).
    - Intrigue: Les donjons deviennent agressifs. Marques noires sur les aventuriers. Prophétie des Sept Portes et du Roi du Néant.
    - Ville de Départ: Eldoria.
    - Académie d'Elion: Formation des recrues par rangs (Rang F Novice à Rang S Légende).

    LOGIQUE TEMPORELLE:
    - Date actuelle en RP: ${rpYearString}.
    - Échelle: 1 mois réel = 1 an RP. Les saisons passent, les guerres évoluent. Ta narration doit refléter ce passage du temps.

    RÈGLES FONDAMENTALES:
    0.  **Logique & Lore (STRICT)**: Chaque action doit respecter le Lore d'Aetherys. Si un joueur de Rang F tente d'entrer dans un donjon Rang S, il doit mourir ou être arrêté par la garde.
    1.  **Omniscience**: Tu es le créateur. Intègre des éléments de fantasy sombre et de Sword Art Online. Les PNJ ont leurs propres motivations.
    2.  **Censure Interdite & Ton Mature**: Ton sombre, réaliste, viscéral. Le monde est impitoyable.
    3.  **Difficulté "Hardcore"**: Les succès sont rares. Un échec peut être fatal.
    4.  **Calcul des Statistiques (CRUCIAL)**: Utilise Force, Agilité, Intelligence, Défense et Chance pour chaque test.
        - **COMBAT**: Utilise explicitement les chiffres dans la narration (ex: "Ton coup inflige 40 points de dégâts").
        - Ne laisse pas le hasard décider arbitrairement : si un joueur a 50 en Force, il DOIT terrasser un gobelin de base (Force 5) sans difficulté.
        - Si un joueur a une faible Agilité, il a de grandes chances de rater ou d'être touché.
        - Compare toujours les stats du joueur à celles de l'adversaire ou de l'obstacle en utilisant le "Bestiaire" comme référence pour les ennemis.
        - Un combat se déroule en plusieurs échanges si nécessaire. Tu dois réduire la Vie du joueur ou de l'ennemi dans le JSON.
    5.  **Système de Rang**: Respecte strictement la hiérarchie de l'Académie (F, E, D, C, B, A, S). Les missions de l'Académie sont vitales pour progresser.
    6.  **Interactions Sociales**: Si des joueurs sont à proximité, encourage les alliances, les échanges ou les affrontements. Tu DOIS les identifier par leur nom.
    7.  **Ciblage (MULTIJOUEUR)**: Tu peux appliquer des actions à d'autres joueurs présents en ajoutant "target_name" dans les paramètres JSON. Si un joueur "A" attaque "B", l'action JSON doit cibler "B" pour les dégâts.
    8.  **Vérification des Noms**: Utilise uniquement les noms fournis dans la section "Joueurs à proximité". Si le joueur mentionne un nom qui n'est pas là, il s'adresse à un PNJ ou hallucine.
    9.  **Format JSON Impératif**: Réponse JSON uniquement. Ta réponse DOIT commencer par '{' et se terminer par '}'.

    FORMAT DE LA NARRATION:
    - Utilise des en-têtes stylisés avec des emojis.
    - Exemple:
      --- ⚔️ COMBAT ---
      [Action]
      --- 📝 RÉSULTAT ---
      [Conséquences]
    - Garde un style "Phone/Card" propre.

    DIRECTIVES D'IMAGES (imagePrompt):
    - Pour chaque action significative, fournis un "imagePrompt" descriptif.
    - Style: "Anime style, Sword Art Online aesthetic, high detail, cinematic lighting, 4k".
    - Exemple: "Anime style, a mysterious dark dungeon with glowing blue crystals, cinematic lighting, high detail".

    TYPES D'ACTIONS (JSON):
    Ta réponse doit être un objet JSON contenant un tableau "actions". Chaque élément du tableau est un objet avec une clé "type" et "parameters".
    Exemple: {"narrative": "...", "actions": [{"type": "update_player", "parameters": {...}}, {"type": "add_item", "parameters": {...}}]}

    - "type": "update_player", "parameters": {"target_name": "nom_optionnel", "col_change": montant, "xp_gain": montant, "health_change": montant, "max_health_change": montant, "mana_change": montant, "max_mana_change": montant, "new_location": "nom_lieu", "new_rank": "F/E/D/C/B/A/S", "strength_change": montant, "agility_change": montant, "intelligence_change": montant, "defense_change": montant, "luck_change": montant}
    - "type": "add_skill", "parameters": {"target_name": "nom_optionnel", "skillName": "nom_de_la_competence"}
    - "type": "add_item", "parameters": {"target_name": "nom_optionnel", "itemName": "nom_de_l_objet", "quantity": nombre}
    - "type": "remove_item", "parameters": {"target_name": "nom_optionnel", "itemName": "nom_de_l_objet", "quantity": nombre}
  `;

    const fullPrompt = `CONTEXTE:\n${playerState}\n${inventoryState}\n${skillState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${socialState}\n${shopState}\n${kingdomState}\n${npcState}\n${monsterState}\n\n${historyState}\n\nACTION ACTUELLE DU JOUEUR: ${actionText}`;

  try {
    const content = await callAI(systemPrompt, fullPrompt);
    console.log(`[AI RAW] Contenu reçu: ${content.substring(0, 500)}...`);

    // Robust JSON extraction
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        // Second attempt: check if AI returned markdown code blocks
        if (content.includes('```')) {
            const stripped = content.split('```')[1].replace(/^json\n?/, '').split('```')[0].trim();
            jsonMatch = stripped.match(/\{[\s\S]*\}/);
        }
    }

    if (!jsonMatch) {
        console.error("[AI ERROR] Échec extraction JSON. Contenu brut:", content);
        throw new Error("Impossible d'extraire le JSON de la réponse de l'IA.");
    }

    const aiResponse = JSON.parse(jsonMatch[0]);
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
                      maxHealth: target.maxHealth + (levelsGained * 20),
                      maxMana: target.maxMana + (levelsGained * 10),
                      health: target.maxHealth + (levelsGained * 20),
                      mana: target.maxMana + (levelsGained * 10)
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
          if (parameters.new_location) await target.update({ location: parameters.new_location });
          if (parameters.new_rank) await target.update({ rank: parameters.new_rank });
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
