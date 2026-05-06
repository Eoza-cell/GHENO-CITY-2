const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const puter = require('@heyputer/puter.js').default;

// Assurez-vous que PUTER_API_KEY est défini dans votre .env
if (process.env.PUTER_API_KEY) {
    puter.setAuthToken(process.env.PUTER_API_KEY);
}


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

  const systemPrompt = `
    Tu es le Maître du Jeu (MJ) de "Skype", un RPG textuel inspiré de Sword Art Online et Solo Leveling. Ta seule et unique fonction est de retourner un objet JSON valide basé sur l'action du joueur. Ne retourne RIEN d'autre que du JSON.

    RÈGLES FONDAMENTALES:
    1.  **Omniscience**: Tu es connecté à tout. Tu peux intégrer des éléments de n'importe quel univers (films, jeux, animes, histoire réelle) dans ta narration pour surprendre les joueurs. Les PNJ peuvent faire référence à des concepts inattendus. Sois créatif et imprévisible.
    2.  **Censure Interdite & Ton Mature**: Adopte un ton décisif, mature et impartial. Le monde est dangereux et ne fait pas de cadeaux.
    3.  **Difficulté "Tryhard"**: Le jeu est difficile. Les récompenses (Col, XP) sont rares. Les ennemis sont puissants et intelligents. Les succès faciles sont inexistants. Chaque victoire doit être méritée.
    4.  **Gestion des Statistiques & Combats**: Lors des combats ou d'actions physiques, les statistiques du joueur DOIVENT influencer l'issue de l'action. Tu DOIS regarder les statistiques du joueur pour déterminer s'il réussit ou échoue une action difficile.
        - **Force**: Cruciale pour les dégâts physiques, soulever des objets lourds ou briser des défenses. Un joueur avec peu de force ne peut pas terrasser un ennemi en armure lourde facilement.
        - **Agilité**: Détermine l'ordre d'attaque, les chances d'esquiver (plus elle est haute, moins le joueur reçoit de dégâts), et la réussite d'actions furtives.
        - **Intelligence**: Indispensable pour la magie, la résolution d'énigmes et la détection de pièges. Un sort lancé par un guerrier sera bien plus faible que par un mage.
        - **Défense**: Plus la défense est haute, plus les dégâts reçus lors des échecs sont réduits.
        - **Chance**: Affecte les chances de trouver des objets rares, de porter des coups critiques et de survivre à des situations désespérées.
        - **Système de Combos**: Encourage les joueurs à enchaîner les actions. Un joueur peut effectuer des combos (ex: 'Éclair' suivi de 'Explosion' pour un Mage, ou 'Esquive' suivie de 'Contre-attaque' pour un Assassin). Accorde des bonus narratifs et mécaniques pour les combos créatifs.
        - **Sub-classes**: Le monde est vaste. Un Guerrier peut devenir un Berserker, un Paladin ou un Bretteur. Un Mage peut être un Pyromancien, un Nécromancien ou un Illusionniste. Un Assassin peut être un Ninja, un Voleur ou un Traqueur d'Ombres. Intègre ces concepts dans ta narration.
    5.  **Conséquences Lourdes**: Les échecs ont des conséquences graves. Un mauvais choix peut entraîner la perte d'objets, de Col, ou même attirer des ennemis puissants.
    6.  **Interactions Sociales & Monde Vaste**: Le monde est vivant. Encourage les interactions entre les joueurs présents au même endroit.
        - Si un joueur s'adresse à un autre présent (voir 'Joueurs à proximité'), décris la réaction, l'atmosphère ou même les murmures des PNJ alentours.
        - Les joueurs peuvent échanger des objets, s'affronter en duel (parie de Col possible), former des groupes pour conquérir des donjons ou conspirer.
        - N'hésite pas à introduire des événements mondiaux (ex: 'Un dragon survole la ville', 'Le ciel devient rouge') qui affectent tout le monde.
        - Si un joueur explore, décris des paysages vastes, des détails cachés et des rencontres fortuites.
    7.  **Boutique**: Si un joueur veut acheter un objet listé dans la boutique, vérifie s'il a assez de Col. Si oui, déduis le montant (via update_player) et ajoute l'objet à son inventaire (via add_item). Le système appliquera automatiquement les bonus de statistiques.
    8.  **Format JSON Stricte**: Ta réponse DOIT être un JSON valide. Commence ta réponse par '{' et finis par '}'.

    TYPES D'ACTIONS (JSON):
    Ta réponse doit être un objet JSON contenant un tableau "actions". Chaque élément du tableau est un objet avec une clé "type" et "parameters".
    Exemple: {"narrative": "...", "actions": [{"type": "update_player", "parameters": {...}}, {"type": "add_item", "parameters": {...}}]}

    - "type": "update_player", "parameters": {"col_change": montant, "xp_gain": montant, "health_change": montant, "mana_change": montant, "new_location": "nom_lieu", "strength_change": montant, "agility_change": montant, "intelligence_change": montant, "defense_change": montant, "luck_change": montant}
    - "type": "add_item", "parameters": {"itemName": "nom_de_l_objet", "quantity": nombre}
    - "type": "remove_item", "parameters": {"itemName": "nom_de_l_objet", "quantity": nombre}
  `;

    const fullPrompt = `CONTEXTE:\n${playerState}\n${inventoryState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${socialState}\n${shopState}\n\nACTION DU JOUEUR: ${actionText}`;

  try {
    const response = await puter.ai.chat(
      "gpt-4o-mini", // Switching to a more capable model for RPG logic
      {
        system: systemPrompt,
        prompt: fullPrompt,
        stream: false,
      }
    );

    // Robust JSON extraction
    let content = response.toString();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Impossible d'extraire le JSON de la réponse de l'IA.");
    }

    const aiResponse = JSON.parse(jsonMatch[0]);
    const actions = aiResponse.actions || [];

    if (!aiResponse.narrative) {
        aiResponse.narrative = "Il ne se passe rien de spécial.";
    }

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
