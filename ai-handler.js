const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, NPC, Skill, RPMessage } = require('./database');
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
    - Vie: ${player.health}%
    - Mana: ${player.mana}%
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
    ? "Joueurs à proximité:\n" + nearbyPlayers.map(p => `- ${p.name} (Niveau ${p.level})`).join('\n')
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
    Tu es le Maître du Jeu (MJ) de "Arise / Gheno City 2", un RPG textuel ultra-immersif inspiré de Sword Art Online et Solo Leveling. Ta seule et unique fonction est de retourner un objet JSON valide basé sur l'action du joueur. Ne retourne RIEN d'autre que du JSON.

    LOGIQUE TEMPORELLE:
    - Date actuelle en RP: ${rpYearString}.
    - Échelle: 1 mois réel = 1 an RP. Les saisons passent, les guerres évoluent, les personnages vieillissent. Ta narration doit refléter ce passage du temps.

    RÈGLES FONDAMENTALES:
    0.  **Logique & Cohérence (STRICT)**: Chaque action doit découler logiquement des faits précédents et de l'environnement. Si une action est impossible ou illogique, explique-le dans la narration.
    1.  **Omniscience & Lore**: Tu es le créateur de ce monde. Tu peux intégrer des éléments de n'importe quel univers (films, jeux, animes, mythologie) pour enrichir la narration. Les PNJ (Directeur Magnus, etc.) ont leurs propres motivations et secrets.
    2.  **Censure Interdite & Ton Mature**: Adopte un ton sombre, réaliste, mature et sans compromis. Le monde est violent, injuste et impitoyable. Les descriptions doivent être viscérales.
    3.  **Difficulté "Hardcore"**: Le jeu est impitoyable. Les succès sont rares et les échecs brutaux. Un joueur imprudent peut mourir ou tout perdre. La victoire doit être un soulagement, pas une évidence.
    4.  **Calcul des Statistiques & Combats (CRUCIAL)**: Tu DOIS effectuer un calcul mental basé sur les statistiques du joueur pour CHAQUE action risquée.
        - **Force**: Dégâts bruts, brise-garde, port de charges. Sans force, impossible de blesser un boss cuirassé.
        - **Agilité**: Esquive (réduit les dégâts reçus), vitesse d'attaque, coups critiques, furtivité. Une agilité élevée permet d'éviter des attaques mortelles.
        - **Intelligence**: Puissance des sorts, détection de pièges, analyse des points faibles. Un Mage sans intelligence est inutile.
        - **Défense**: Absorption des dégâts. Crucial pour la survie.
        - **Chance**: Événements aléatoires favorables, loot rare, survie miraculeuse.
        - **Résultat**: Compare les stats du joueur à la difficulté de la tâche (ennemi, obstacle). Décris précisément l'impact des stats dans la narration (ex: "Grâce à ta force de 50, tu soulèves le débris...", "Ton agilité médiocre te fait trébucher lors de l'esquive...").
        - **COMBAT**: Lors d'un combat, utilise explicitement les statistiques pour déterminer les dommages infligés et reçus. Mentionne les chiffres (ex: "Ton coup inflige 40 points de dégâts grâce à ta force accrue").
    5.  **Combos & Synergies**: Récompense grassement les joueurs qui combinent leurs compétences de manière créative. Accorde des bonus de dégâts ou des effets secondaires (étourdissement, brûlure) pour les enchaînements logiques.
    6.  **Interactions Sociales & Monde Ouvert**:
        - **Joueurs à proximité**: Si d'autres joueurs sont présents (liste fournie), encourage le dialogue, le commerce ou les duels. Si le joueur interagit avec eux, décris l'impact sur l'environnement.
        - **Commerce**: Les joueurs peuvent troquer, s'arnaquer ou s'allier.
        - **Monde Vaste**: Le monde de Skype est infini et fusionne plusieurs univers virtuels. Décris des environnements grandioses, des détails cachés, des bruits ambiants et des odeurs. Si le joueur explore, n'hésite pas à créer des sous-lieux uniques et des biomes variés. Le monde ne s'arrête pas aux pieds du joueur.
    7.  **Logique & Consistance**: Tes actions doivent être logiques par rapport au contexte. Si un joueur achète un objet, utilise "update_player" pour retirer les Col et "add_item" pour ajouter l'objet. Si un joueur apprend une technique à l'Académie, utilise "add_skill".
    8.  **Gestion de l'Inventaire & Boutique**: Les objets achetés ou trouvés modifient DIRECTEMENT les statistiques du joueur. Vérifie toujours le solde de Col avant un achat.
    9.  **Format JSON Impératif**: Réponse JSON uniquement. Pas de texte avant ou après. Ta réponse DOIT commencer par '{' et se terminer par '}'.

    TYPES D'ACTIONS (JSON):
    Ta réponse doit être un objet JSON contenant un tableau "actions". Chaque élément du tableau est un objet avec une clé "type" et "parameters".
    Exemple: {"narrative": "...", "actions": [{"type": "update_player", "parameters": {...}}, {"type": "add_item", "parameters": {...}}]}

    - "type": "update_player", "parameters": {"col_change": montant, "xp_gain": montant, "health_change": montant, "mana_change": montant, "new_location": "nom_lieu", "strength_change": montant, "agility_change": montant, "intelligence_change": montant, "defense_change": montant, "luck_change": montant}
    - "type": "add_skill", "parameters": {"skillName": "nom_de_la_competence"}
    - "type": "add_item", "parameters": {"itemName": "nom_de_l_objet", "quantity": nombre}
    - "type": "remove_item", "parameters": {"itemName": "nom_de_l_objet", "quantity": nombre}
  `;

    const fullPrompt = `CONTEXTE:\n${playerState}\n${inventoryState}\n${skillState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${socialState}\n${shopState}\n${kingdomState}\n${npcState}\n\n${historyState}\n\nACTION ACTUELLE DU JOUEUR: ${actionText}`;

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

      switch (type) {
        case 'update_player':
          if (parameters) {
            if (parameters.col_change) await player.increment('col', { by: parameters.col_change });
            if (parameters.xp_gain) await player.increment('xp', { by: parameters.xp_gain });
            if (parameters.health_change) await player.increment('health', { by: parameters.health_change });
            if (parameters.mana_change) await player.increment('mana', { by: parameters.mana_change });
            if (parameters.strength_change) await player.increment('strength', { by: parameters.strength_change });
            if (parameters.agility_change) await player.increment('agility', { by: parameters.agility_change });
            if (parameters.intelligence_change) await player.increment('intelligence', { by: parameters.intelligence_change });
            if (parameters.defense_change) await player.increment('defense', { by: parameters.defense_change });
            if (parameters.luck_change) await player.increment('luck', { by: parameters.luck_change });
            if (parameters.new_location) await player.update({ location: parameters.new_location });
          }
          break;
        case 'add_skill':
          if (parameters && parameters.skillName) {
            const skill = await Skill.findOne({ where: { name: { [Op.like]: `%${parameters.skillName}%` } } });
            if (skill) {
              const hasSkill = await player.hasSkill(skill);
              if (!hasSkill) {
                await player.addSkill(skill);
                // Apply stat bonuses immediately
                const bonuses = skill.statBonuses;
                for (const [stat, value] of Object.entries(bonuses)) {
                  if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                    await player.increment(stat, { by: value });
                  }
                }
              }
            }
          }
          break;
        case 'add_item':
          if (parameters) {
            const { itemName, quantity } = parameters;
            const inventory = [...player.inventory];
            const existingItem = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                inventory.push({ name: itemName, quantity: quantity });
            }

            player.inventory = inventory;
            await player.save();

            // Automatic stat bonus application for items found in the database
            const itemData = await Item.findOne({ where: { name: { [Op.like]: `%${itemName}%` } } });
            if (itemData) {
                const bonuses = itemData.statBonuses;
                for (const [stat, value] of Object.entries(bonuses)) {
                    if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                        await player.increment(stat, { by: value * quantity });
                    }
                }
                // If it's an item from the database, use its image
                if (itemData.imageUrl && !aiResponse.imagePrompt) {
                    aiResponse.imagePrompt = itemData.imageUrl;
                }
            }
          }
          break;
        case 'remove_item':
            if (parameters) {
                const { itemName, quantity } = parameters;
                let inventory = [...player.inventory];
                const itemIndex = inventory.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
                if (itemIndex !== -1) {
                    const actualQuantityToRemove = Math.min(quantity, inventory[itemIndex].quantity);
                    inventory[itemIndex].quantity -= actualQuantityToRemove;

                    if (inventory[itemIndex].quantity <= 0) {
                        inventory.splice(itemIndex, 1);
                    }

                    player.inventory = inventory;
                    await player.save();

                    // Reverse stat bonuses if the item exists in the database
                    const itemData = await Item.findOne({ where: { name: { [Op.like]: `%${itemName}%` } } });
                    if (itemData) {
                        const bonuses = itemData.statBonuses;
                        for (const [stat, value] of Object.entries(bonuses)) {
                            if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                                await player.decrement(stat, { by: value * actualQuantityToRemove });
                            }
                        }
                    }
                }
            }
            break;
      }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
