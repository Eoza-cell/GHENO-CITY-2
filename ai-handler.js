const { Player, Dungeon, Quest, PlayerQuest, Bank, sequelize } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const Puter = require('@heyputer/puter.js');

// Assurez-vous que PUTER_API_KEY est défini dans votre .env
const puter = new Puter(process.env.PUTER_API_KEY);


async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

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
  `;

  const inventoryState = player.inventory.length > 0
    ? "Inventaire:\n" + player.inventory.map(i => `- ${i.name} (x${i.quantity})`).join('\n')
    : "Ton inventaire est vide.";

  const quests = await player.getQuests();
  const questState = quests.length > 0
    ? "Quêtes Actives:\n" + quests.filter(q => q.PlayerQuest.status === 'in_progress').map(q => `- ${q.title}: ${q.description}`).join('\n')
    : "Aucune quête active.";

  const dungeons = await Dungeon.findAll();
  const dungeonState = "Donjons connus:\n" + dungeons.map(d => `- ${d.name} (Rang ${d.rank})`).join('\n');

  const systemPrompt = `
    Tu es le Maître du Jeu (MJ) de "Skype", un RPG textuel inspiré de Sword Art Online et Solo Leveling. Ta seule et unique fonction est de retourner un objet JSON valide basé sur l'action du joueur. Ne retourne RIEN d'autre que du JSON.

    RÈGLES FONDAMENTALES:
    1.  **Omniscience**: Tu es connecté à tout. Tu peux intégrer des éléments de n'importe quel univers (films, jeux, animes, histoire réelle) dans ta narration pour surprendre les joueurs. Les PNJ peuvent faire référence à des concepts inattendus. Sois créatif et imprévisible.
    2.  **Censure Interdite & Ton Mature**: Adopte un ton décisif, mature et impartial. Le monde est dangereux et ne fait pas de cadeaux.
    3.  **Difficulté "Tryhard"**: Le jeu est difficile. Les récompenses (Col, XP) sont rares. Les ennemis sont puissants et intelligents. Les succès faciles sont inexistants. Chaque victoire doit être méritée.
    4.  **Conséquences Lourdes**: Les échecs ont des conséquences graves. Un mauvais choix peut entraîner la perte d'objets, de Col, ou même attirer des ennemis puissants.
    5.  **Format JSON Stricte**: Ta réponse DOIT être un JSON valide. Commence ta réponse par '{' et finis par '}'.

    // L'exemple JSON a été retiré pour éviter les erreurs de syntaxe.
    // Le format attendu est un objet JSON avec une clé "action" et d'autres paramètres pertinents.

    TYPES D'ACTIONS (JSON):
    - "action": "update_player", "parameters": {"col_change": montant, "xp_gain": montant, "health_change": montant, "mana_change": montant, "new_location": "nom_lieu"}
    - "action": "add_item", "parameters": {"itemName": "nom_de_l_objet", "quantity": nombre}
    - "action": "remove_item", "parameters": {"itemName": "nom_de_l_objet", "quantity": nombre}
    - "action": "narrate"
  `;

    const fullPrompt = `CONTEXTE:\n${playerState}\n${inventoryState}\n${questState}\n${dungeonState}\n\nACTION DU JOUEUR: ${actionText}`;

  try {
    // Correction: Utilisation de puter.ai.chat pour la génération de texte/JSON
    const response = await puter.ai.chat(
      "pollination/flan-t5-xxl",
      {
        system: systemPrompt,
        prompt: fullPrompt,
        stream: false,
      }
    );

    // La réponse de puter.ai.chat est une chaîne JSON, nous devons la parser.
    const aiResponse = JSON.parse(response);
    const action = aiResponse.action ? aiResponse.action.trim() : 'no_action';

    if (!aiResponse.narrative) {
        aiResponse.narrative = "Il ne se passe rien de spécial.";
    }

    // Process AI actions
    switch (action) {
      case 'update_player':
        if (aiResponse.parameters) {
          if (aiResponse.parameters.col_change) await player.increment('col', { by: aiResponse.parameters.col_change });
          if (aiResponse.parameters.xp_gain) await player.increment('xp', { by: aiResponse.parameters.xp_gain });
          // Ajoutez d'autres mises à jour de joueur ici (vie, mana, location, etc.)
        }
        break;
      case 'add_item':
        const { itemName, quantity } = aiResponse.parameters;
        const inventory = player.inventory;
        const existingItem = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            inventory.push({ name: itemName, quantity: quantity });
        }
        // Cette ligne est cruciale pour que Sequelize détecte le changement dans le champ JSON
        player.changed('inventory', true);
        await player.save();
        break;
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
