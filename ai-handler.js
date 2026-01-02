const { Player, Dungeon, Quest, PlayerQuest, Bank, sequelize } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const axios = require('axios');


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

    STRUCTURE JSON ATTENDUE :
    {
      "narrative": "Une description textuelle de ce qui se passe. C'est obligatoire.",
      "imagePrompt": "Un prompt court pour générer une image illustrant la scène. C'est optionnel.",
      "action": "type_action",
      "parameters": { ... }
    }

    TYPES D'ACTIONS POSSIBLES DANS LE JSON :
    - "narrate": Ne fait que raconter l'histoire.
    - "update_player": Modifie les stats du joueur. Ex: "parameters": {"col_change": -10, "xp_gain": 50, "health_change": -20}
    - "add_item": Ajoute un objet à l'inventaire. Ex: "parameters": {"itemName": "Potion de vie", "quantity": 1}
    - "remove_item": Retire un objet. Ex: "parameters": {"itemName": "Épée rouillée", "quantity": 1}

    IMPORTANT : Ta réponse doit TOUJOURS contenir une clé "narrative".
  `;

    const fullPrompt = `CONTEXTE:\n${playerState}\n${inventoryState}\n${questState}\n${dungeonState}\n\nACTION DU JOUEUR: ${actionText}`;

  try {
    const payload = {
      model: "openai",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: fullPrompt }
      ],
    };

    const response = await axios.post(
      "https://text.pollinations.ai/openai",
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    const responseContent = response.data.choices[0].message.content;

    const aiResponse = JSON.parse(responseContent);
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
    console.error('Erreur détaillée de l\'API Pollination AI:', {
      message: error.message,
      data: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
      requestData: error.config?.data,
    });
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
