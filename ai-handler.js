const { Player, Vehicle, PlayerVehicle, Shop, Item, ShopItem, sequelize } = require('./database');
const { isDay } = require('./game-state');
const { sendWithImage } = require('./message-handler');
const { getMission, checkMissionCompletion } = require('./missions');
const {
  accelerateVehicle,
  brakeVehicle,
  driveVehicle,
  parkVehicle,
} = require('./vehicle-handler');
const { Op } = require('sequelize');
const axios = require('axios');

// Location data for AI context
const locations = {
  'Little Sicily': {
    description: "Ton quartier natal. Un peu miteux, mais c'est chez toi.",
    connections: ['Downtown'],
  },
  'Downtown': {
    description: "Le cœur animé de la ville. Gratte-ciels, boutiques de luxe et sirènes de police.",
    connections: ['Little Sicily'],
  },
  'dealership': {
    description: "Une concession de voitures d'occasion. L'odeur de l'essence et des rêves brisés flotte dans l'air.",
    connections: ['Little Sicily', 'hideout'],
  },
  'hideout': {
    description: "Un entrepôt désaffecté. C'est ici que le caïd local dirige ses affaires.",
    connections: ['dealership'],
  }
};

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

  // 1. Build the context for the AI
  const playerState = `
    - Nom: ${player.name}
    - Description: ${player.characterDescription}
    - Argent: ${player.money}$
    - Emplacement: ${player.location} (${locations[player.location]?.description || 'Description inconnue'})
    - Destinations possibles: ${locations[player.location]?.connections.join(', ') || 'Aucune'}
  `;

  // Vehicle context
  let playerVehicleState = "Tu n'es pas au volant.";
  const playerVehicles = await PlayerVehicle.findAll({
    where: { PlayerWhatsappId: player.whatsappId },
    include: Vehicle,
  });

  if (player.drivingVehicleId) {
    const currentVehicle = playerVehicles.find(pv => pv.id === player.drivingVehicleId);
    if (currentVehicle) {
        playerVehicleState = `Tu conduis ta ${currentVehicle.Vehicle.name}. Vitesse actuelle: ${currentVehicle.currentSpeed.toFixed(0)} km/h.`;
    }
  }

  const garageState = playerVehicles.length > 0
    ? "Véhicules dans ton garage:\n" + playerVehicles.map(pv => `- ID ${pv.id}: ${pv.Vehicle.name}`).join('\n')
    : "Ton garage est vide.";

  // Shop context
  let shopInventory = "Aucun magasin ici.";
  const currentShop = await Shop.findOne({ where: { location: player.location } });
  if (currentShop) {
      const items = await currentShop.getItems();
      if (items.length > 0) {
          shopInventory = `Articles à vendre chez "${currentShop.name}":\n` +
          items.map(item => `- ${item.name}: ${item.price}$`).join('\n');
      }
  }

  const systemPrompt = `
    Tu es le Maître du Jeu (MJ) de "Gheno City 2", un RPG textuel. Ta seule et unique fonction est de retourner un objet JSON valide basé sur l'action du joueur. Ne retourne RIEN d'autre que du JSON.

    RÈGLES FONDAMENTALES:
    1.  **Format JSON Stricte**: Ta réponse DOIT être un JSON valide.
    2.  **Réalisme Impitoyable**: Le monde est logique. Les actions impossibles (sauter entre des immeubles, esquiver des balles à bout portant) DOIVENT résulter en une action "error".
    3.  **Images Personnalisées**: La narration DOIT inclure un prompt d'image avec la description du joueur. Ex: \`[POLLINATION PROMPT: un homme grand aux cheveux noirs...]\`

    TYPES D'ACTIONS (JSON):
    - "action": "update_player", "parameters": {"money_change": montant, "xp_gain": montant}
    - "action": "steal_car", "parameters": {"success": true_ou_false, "category": "Compacte" | "Berline" | "Sportive"}
    - "action": "move", "parameters": {"destination": "nom_du_lieu"}
    - "action": "buy_item", "parameters": {"itemName": "nom_de_l_article", "quantity": nombre}
    - "action": "drive", "parameters": {"vehicleId": id_du_vehicule}
    - "action": "park"
    - "action": "accelerate"
    - "action": "brake"
    - "action": "narrate"
    - "action": "error", "parameters": {"reason": "explication"}

    CONTEXTE:
    ---
    ${playerState}
    ---
    VEHICULE:
    ---
    ${playerVehicleState}
    ---
    GARAGE:
    ---
    ${garageState}
    ---
    MAGASIN:
    ---
    ${shopInventory}
    ---
    ACTION DU JOUEUR: ${actionText}
  `;

  try {
    const payload = {
      model: "openai/gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: actionText }
      ],
      max_tokens: 1024,
      response_format: { type: "json_object" },
    };

    const response = await axios.post(
      'https://gen.pollinations.ai/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.POLLINATION_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const rawResponse = response.data.choices[0].message.content;

    let aiResponse;
    try {
      aiResponse = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('Erreur de parsing JSON de la réponse IA:', { rawResponse, error: parseError.message });
      await sock.sendMessage(jid, { text: "L'IA a renvoyé une réponse malformée. Réessayez." });
      return;
    }

    const action = aiResponse.action ? aiResponse.action.trim() : 'no_action';

    switch (action) {
      case 'update_player':
        if (aiResponse.parameters) {
          if (aiResponse.parameters.money_change) await player.increment('money', { by: aiResponse.parameters.money_change });
          if (aiResponse.parameters.xp_gain) await player.increment('xp', { by: aiResponse.parameters.xp_gain });
        }
        await sendWithImage(sock, jid, aiResponse.narrative);
        break;

      case 'steal_car':
        if (aiResponse.parameters.success) {
            const vehicleCategory = aiResponse.parameters.category;
            let priceRange;
            if (vehicleCategory === 'Compacte') priceRange = [5000, 20000];
            else if (vehicleCategory === 'Berline') priceRange = [40000, 80000];
            else priceRange = [0, 1000000]; // Fallback

            const vehicleToSteal = await Vehicle.findOne({
                where: { price: { [Op.between]: priceRange } },
                order: sequelize.random(),
            });

            if (vehicleToSteal) {
                await PlayerVehicle.create({ PlayerWhatsappId: player.whatsappId, VehicleId: vehicleToSteal.id });
                await player.increment('xp', { by: 50 });
                await sendWithImage(sock, jid, aiResponse.narrative + ` Tu as volé une ${vehicleToSteal.name} !`);
            } else {
                await sock.sendMessage(jid, { text: `Aucune voiture de catégorie "${vehicleCategory}" n'a été trouvée à voler.` });
            }
        } else {
            await sendWithImage(sock, jid, aiResponse.narrative);
        }
        break;

      case 'move':
        const destination = aiResponse.parameters.destination;
        if (locations[destination] && locations[player.location]?.connections.includes(destination)) {
          await player.update({ location: destination });
          await sendWithImage(sock, jid, aiResponse.narrative);
        } else {
          await sock.sendMessage(jid, { text: `Déplacement invalide vers '${destination}'.` });
        }
        break;

      case 'buy_item':
        const { itemName, quantity = 1 } = aiResponse.parameters;
        const shop = await Shop.findOne({ where: { location: player.location } });

        if (!shop) {
            await sock.sendMessage(jid, { text: "Il n'y a pas de magasin ici." });
            break;
        }

        const itemToBuy = await Item.findOne({ where: { name: { [Op.like]: itemName } } });
        if (!itemToBuy) {
            await sock.sendMessage(jid, { text: `Article "${itemName}" non trouvé.` });
            break;
        }

        const totalPrice = itemToBuy.price * quantity;
        if (player.money < totalPrice) {
            await sock.sendMessage(jid, { text: `Tu n'as pas assez d'argent.` });
            break;
        }

        player.money -= totalPrice;
        const playerInventory = player.inventory;
        const existingItem = playerInventory.find(i => i.name === itemToBuy.name);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            playerInventory.push({ name: itemToBuy.name, quantity });
        }
        player.inventory = playerInventory;
        await player.save();

        await sendWithImage(sock, jid, aiResponse.narrative);
        break;

      case 'drive':
        await sendWithImage(sock, jid, (await driveVehicle(player, aiResponse.parameters.vehicleId)).narrative);
        break;

      case 'narrate':
      case 'error':
        await sendWithImage(sock, jid, aiResponse.narrative || aiResponse.parameters.reason);
        break;

      default:
        console.error("Action IA non reconnue:", { response: aiResponse });
        await sock.sendMessage(jid, { text: `Action inconnue de l'IA: ${action}` });
    }

    await checkMissionCompletion(sock, player, message);

  } catch (error) {
    console.error('Erreur avec Puter.js AI:', { message: error.message });
    await sock.sendMessage(jid, { text: "Erreur de l'IA. Réessaye ton action." });
  }
}

module.exports = { handleFreeAction, locations };
