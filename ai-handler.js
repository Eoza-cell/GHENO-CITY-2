const { Player, Dungeon, Quest, PlayerQuest, Bank, sequelize } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { Puter } = require('@heyputer/puter.js');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const puter = new Puter(process.env.PUTER_API_KEY);

  // 1. Build the context for the AI
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
    1.  **Censure Interdite & Ton Mature**: Adopte un ton décisif, mature et impartial. Le monde est dangereux et ne fait pas de cadeaux.
    2.  **Difficulté "Tryhard"**: Le jeu est difficile. Les récompenses (Col, XP) sont rares. Les ennemis sont puissants et intelligents. Les succès faciles sont inexistants. Chaque victoire doit être méritée.
    3.  **Conséquences Lourdes**: Les échecs ont des conséquences graves. Un mauvais choix peut entraîner la perte d'objets, de Col, ou même attirer des ennemis puissants.
    4.  **Format JSON Stricte**: Ta réponse DOIT être un JSON valide. Commence ta réponse par `{` et finis par `}`.

    EXEMPLE DE RÉPONSE JSON VALIDE:
    {
      "action": "narrate",
      "narrative": "Vous entrez dans la forêt sombre. Le vent souffle à travers les arbres, créant une atmosphère sinistre. Vous sentez que quelque chose vous observe.",
      "imagePrompt": "A dark and eerie forest with twisted, ancient trees under a pale moonlight, mist covering the ground, cinematic, hyperrealistic, 8k."
    }
    5.  **Narration Immersive**: Décris les résultats des actions de manière vivante et détaillée. Le joueur doit se sentir dans le monde.
    6.  **Génération d'Image**: Pour chaque narration, tu DOIS inclure un champ "imagePrompt". Ce champ doit contenir une description artistique et détaillée EN ANGLAIS (pour l'IA de génération d'image) de la scène décrite.
    7.  **Logique du Monde et Combat**: Le monde a ses propres règles. Les actions impossibles (voler sans compétence) sont rejetées. Les combats sont basés sur le niveau, l'équipement et la stratégie. Un joueur de bas niveau ne peut pas vaincre un boss de haut rang.
    8.  **Interaction entre Joueurs**: Si un joueur écrit une action envers un autre joueur, tu dois créer une action "interact" pour notifier l'autre joueur.

    TYPES D'ACTIONS (JSON):
    - "action": "update_player", "parameters": {"col_change": montant, "xp_gain": montant, "health_change": montant, "mana_change": montant, "new_location": "nom_lieu"}
    - "action": "add_item", "parameters": {"itemName": "nom_de_l_objet", "quantity": nombre}
    - "action": "remove_item", "parameters": {"itemName": "nom_de_l_objet", "quantity": nombre}
    - "action": "enter_dungeon", "parameters": {"dungeonName": "nom_du_donjon"}
    - "action": "complete_quest", "parameters": {"questTitle": "titre_de_la_quete"}
    - "action": "bank_deposit", "parameters": {"amount": montant}
    - "action": "bank_withdraw", "parameters": {"amount": montant}
    - "action": "interact", "parameters": {"targetPlayerName": "nom_du_joueur", "interactionText": "ce_que_tu_as_fait"}
    - "action": "narrate"
    - "action": "error", "parameters": {"reason": "explication_de_l_erreur"}

    CONTEXTE DU MONDE:
    ---
    ${dungeonState}
    ---
    QUETES:
    ---
    ${questState}
    ---
    INVENTAIRE:
    ---
    ${inventoryState}
    ---
    ETAT DU JOUEUR:
    ---
    ${playerState}
    ---
    ACTION DU JOUEUR: ${actionText}
  `;

  try {
    const response = await puter.ai.chat(systemPrompt, { model: "pollination/flan-t5-xxl" });
    const rawResponse = response.text;

    let aiResponse;
    try {
      // Clean the response from markdown code block
      const cleanedResponse = rawResponse.replace(/```json\n|```/g, '').trim();
      aiResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Erreur de parsing JSON de la réponse IA:', { rawResponse, error: parseError.message });
      await sock.sendMessage(jid, { text: "Le MJ a renvoyé une réponse malformée. Réessayez." });
      return;
    }

    const action = aiResponse.action ? aiResponse.action.trim() : 'no_action';

    // Ensure narrative is mutable if we need to add to it.
    if (!aiResponse.narrative) {
        aiResponse.narrative = "Il ne se passe rien de spécial.";
    }

    switch (action) {
      case 'update_player':
        if (aiResponse.parameters) {
          if (aiResponse.parameters.col_change) await player.increment('col', { by: aiResponse.parameters.col_change });
          if (aiResponse.parameters.xp_gain) await player.increment('xp', { by: aiResponse.parameters.xp_gain });
          if (aiResponse.parameters.health_change) await player.increment('health', { by: aiResponse.parameters.health_change });
          if (aiResponse.parameters.mana_change) await player.increment('mana', { by: aiResponse.parameters.mana_change });
          if (aiResponse.parameters.new_location) await player.update({ location: aiResponse.parameters.new_location });

          // Check for level up
          const xpNeeded = player.level * 100;
          if (player.xp >= xpNeeded) {
              await player.increment('level', { by: 1 });
              await player.increment('xp', { by: -xpNeeded });
              await player.increment('skillPoints', { by: 5 });
              aiResponse.narrative += `\n\n**Félicitations, vous êtes passé au niveau ${player.level} !** Vous avez gagné 5 points de compétence.`;
          }
        }
        await sendWithImage(sock, jid, aiResponse);
        break;

      case 'add_item':
        const { itemName: itemToAdd, quantity: qtyToAdd = 1 } = aiResponse.parameters;
        const inventoryAdd = player.inventory;
        const existingItemAdd = inventoryAdd.find(i => i.name.toLowerCase() === itemToAdd.toLowerCase());
        if (existingItemAdd) {
            existingItemAdd.quantity += qtyToAdd;
        } else {
            inventoryAdd.push({ name: itemToAdd, quantity: qtyToAdd });
        }
        player.inventory = inventoryAdd;
        await player.save();
        await sendWithImage(sock, jid, aiResponse);
        break;

      case 'remove_item':
        const { itemName: itemToRemove, quantity: qtyToRemove = 1 } = aiResponse.parameters;
        const inventoryRemove = player.inventory;
        const itemIndex = inventoryRemove.findIndex(i => i.name.toLowerCase() === itemToRemove.toLowerCase());
        if (itemIndex > -1) {
            inventoryRemove[itemIndex].quantity -= qtyToRemove;
            if (inventoryRemove[itemIndex].quantity <= 0) {
                inventoryRemove.splice(itemIndex, 1);
            }
            player.inventory = inventoryRemove;
            await player.save();
        }
        await sendWithImage(sock, jid, aiResponse);
        break;

      case 'enter_dungeon':
          const dungeon = await Dungeon.findOne({ where: { name: { [Op.like]: aiResponse.parameters.dungeonName } } });
          if (dungeon) {
              await player.update({ location: dungeon.name, currentDungeonId: dungeon.id });
              await sendWithImage(sock, jid, aiResponse);
          } else {
              await sock.sendMessage(jid, { text: `Donjon "${aiResponse.parameters.dungeonName}" non trouvé.` });
          }
          break;

      case 'complete_quest':
          const quest = await Quest.findOne({ where: { title: { [Op.like]: aiResponse.parameters.questTitle } } });
          if (quest) {
              const playerQuest = await PlayerQuest.findOne({ where: { PlayerWhatsappId: player.whatsappId, QuestId: quest.id } });
              if (playerQuest && playerQuest.status !== 'completed') {
                  await playerQuest.update({ status: 'completed' });
                  await player.increment('col', { by: quest.reward_col });
                  await player.increment('xp', { by: quest.reward_xp });
                  aiResponse.narrative += `\n\n*Quête terminée: ${quest.title}*\n*Récompenses:* ${quest.reward_col} Col, ${quest.reward_xp} XP.`;
              }
          }
          await sendWithImage(sock, jid, aiResponse);
          break;

      case 'bank_deposit':
          const amountToDeposit = parseInt(aiResponse.parameters.amount, 10);
          if (!isNaN(amountToDeposit) && amountToDeposit > 0 && player.col >= amountToDeposit) {
              const bank = await Bank.findOne({ where: { PlayerWhatsappId: player.whatsappId }});
              await player.decrement('col', { by: amountToDeposit });
              await bank.increment('balance', { by: amountToDeposit });
              await sendWithImage(sock, jid, aiResponse);
          } else {
              await sock.sendMessage(jid, { text: "Montant invalide ou fonds insuffisants." });
          }
          break;

      case 'bank_withdraw':
          const amountToWithdraw = parseInt(aiResponse.parameters.amount, 10);
          const bank = await Bank.findOne({ where: { PlayerWhatsappId: player.whatsappId }});
          if (!isNaN(amountToWithdraw) && amountToWithdraw > 0 && bank.balance >= amountToWithdraw) {
              await bank.decrement('balance', { by: amountToWithdraw });
              await player.increment('col', { by: amountToWithdraw });
              await sendWithImage(sock, jid, aiResponse);
          } else {
              await sock.sendMessage(jid, { text: "Montant invalide ou fonds insuffisants." });
          }
          break;

      case 'interact':
          const { targetPlayerName, interactionText } = aiResponse.parameters;
          const targetPlayer = await Player.findOne({ where: { name: { [Op.like]: targetPlayerName } } });

          if (targetPlayer && targetPlayer.whatsappId !== player.whatsappId) {
              const targetJid = targetPlayer.whatsappId;
              const notificationText = `*Interaction de ${player.name}*\n\n> ${interactionText}`;
              // Send a notification to the target player in the same channel (group)
              await sock.sendMessage(jid, {
                  text: notificationText,
                  mentions: [targetJid]
              });
          }
          // Send the general narrative to the channel
          await sendWithImage(sock, jid, aiResponse);
          break;


      case 'narrate':
      case 'error':
        await sendWithImage(sock, jid, aiResponse);
        break;

      default:
        console.error("Action IA non reconnue:", { response: aiResponse });
        await sock.sendMessage(jid, { text: `Action inconnue de l'IA: ${action}` });
    }

  } catch (error) {
    console.error('Erreur avec Puter.js AI:', { message: error.message, stack: error.stack });
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
