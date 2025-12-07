const axios = require('axios');
const { Player, Vehicle, PlayerVehicle, Shop, Item, ShopItem, sequelize } = require('./database');
const { isDay } = require('./game-state');
const { sendWithImage } = require('./message-handler');
const { getMission, checkMissionCompletion } = require('./missions');
const { addToQueue } = require('./rate-limiter');
const {
  accelerateVehicle,
  brakeVehicle,
  driveVehicle,
  parkVehicle,
} = require('./vehicle-handler');
const { Op } = require('sequelize');


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

  // Shop context - Now dynamic
  let shopInventory = "Aucun magasin ici.";
  const currentShop = await Shop.findOne({ where: { location: player.location } });

  if (currentShop) {
      const items = await currentShop.getItems();
      if (items.length > 0) {
          shopInventory = `Articles à vendre chez "${currentShop.name}":\n` +
          items.map(item => {
              const quantity = item.ShopItem.quantity === -1 ? 'illimité' : item.ShopItem.quantity;
              return `- ${item.name}: ${item.price}$ (Stock: ${quantity})`;
          }).join('\n');
      } else {
          shopInventory = `Le magasin "${currentShop.name}" est vide.`;
      }
  } else if (player.location === 'dealership' && isDay()) { // Keep old dealership logic as fallback
    const vehicles = await Vehicle.findAll({ attributes: ['name', 'price'] });
    shopInventory = "Véhicules à vendre:\n" + vehicles.map(v => `- ${v.name}: ${v.price}$`).join('\n');
  } else if (player.location === 'dealership') {
    shopInventory = "Le concessionnaire est fermé la nuit.";
  }


  const systemPrompt = `
    Tu es le Maître du Jeu (MJ) de "Gheno City 2", un RPG textuel. Ta seule et unique fonction est de retourner un objet JSON valide basé sur l'action du joueur. Ne retourne RIEN d'autre que du JSON.

    RÈGLES FONDAMENTALES:
    1.  **Format JSON Stricte**: Ta réponse DOIT être un JSON valide.
    2.  **Décisions Claires**: Chaque action a une conséquence claire.
    3.  **Censure Interdite**: C'est un jeu mature.
    4.  **Réalisme Impitoyable**: Le monde est logique. Les actions physiquement impossibles (sauter entre des immeubles, esquiver des balles à bout portant) DOIVENT résulter en une action "error" avec une explication. Un joueur ne peut pas acheter quelque chose s'il n'est pas dans le bon magasin.
    5.  **Images Personnalisées**: La narration DOIT inclure un prompt d'image intégrant la description physique du joueur.

    TYPES D'ACTIONS (JSON):
    - "action": "update_player": Modifier les stats du joueur.
      - "parameters": {"money_change": montant, "xp_gain": montant}
    - "action": "steal_car": Tenter de voler un véhicule. La catégorie est OBLIGATOIRE.
      - "parameters": {"success": true_ou_false, "category": "Compacte" | "Berline" | "Sportive"}
    - "action": "move": Changer de lieu.
      - "parameters": {"destination": "nom_du_lieu"}
    - "action": "buy_item": Acheter un article dans un magasin.
      - "parameters": {"itemName": "nom_de_l_article", "quantity": nombre}
    - "action": "drive": Monter dans un véhicule du garage.
      - "parameters": {"vehicleId": id_du_vehicule}
    - "action": "park": Descendre du véhicule actuel.
      - "parameters": {}
    - "action": "accelerate": Accélérer.
      - "parameters": {}
    - "action": "brake": Freiner.
      - "parameters": {}
    - "action": "narrate": Pour les actions sans impact mécanique.
      - "parameters": {}
    - "action": "error": Si l'action est illogique, impossible ou viole les règles de réalisme.
      - "parameters": {"reason": "explication claire de l'échec"}

    CONTEXTE DE LA SCÈNE:
    ---
    ${playerState}
    ---
    ÉTAT DU VÉHICULE:
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
  `;

  try {
    const apiCall = async () => {
      const { data } = await axios.post('https://text.pollinations.ai/', {
        model: "openai",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "je saute sur le toit de l'immeuble d'en face" },
          { role: "assistant", content: `{
              "action": "error",
              "parameters": {
                  "reason": "L'écart est trop grand, tu ne peux pas sauter si loin."
              },
              "narrative": "Tu prends ton élan, mais en t'approchant du bord, tu réalises que le saut est impossible. Une chute pareille serait fatale. [POLLINATION PROMPT: un homme grand aux cheveux noirs se tient au bord d'un toit, regardant le vide avec une expression de doute, style cinématographique, nuit.]"
            }`
          },
          { role: "user", content: actionText }
        ],
      }, { timeout: 45000 });
      return data;
    };

    const rawResponse = await addToQueue(apiCall);

    let aiResponse;
    try {
      aiResponse = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
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
            else if (vehicleCategory === 'Sportive') priceRange = [80000, 200000];
            else priceRange = [0, 1000000]; // Fallback

            const vehicleToSteal = await Vehicle.findOne({
                where: { price: { [Op.between]: priceRange } },
                order: sequelize.random(),
            });

            if (vehicleToSteal) {
                await PlayerVehicle.create({ PlayerWhatsappId: player.whatsappId, VehicleId: vehicleToSteal.id });
                await player.increment('xp', { by: 50 });
                // La mission se terminera via checkMissionCompletion
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
          await sock.sendMessage(jid, { text: `L'IA a tenté un déplacement invalide vers '${destination}'.` });
        }
        break;

      case 'buy_item':
        const { itemName, quantity = 1 } = aiResponse.parameters;
        const shop = await Shop.findOne({ where: { location: player.location } });

        if (!shop) {
            await sock.sendMessage(jid, { text: "Il n'y a pas de magasin ici pour acheter ça." });
            break;
        }

        const itemToBuy = await Item.findOne({ where: { name: { [Op.like]: itemName } } });
        if (!itemToBuy) {
            await sock.sendMessage(jid, { text: `L'IA a essayé de te faire acheter un article qui n'existe pas : "${itemName}".` });
            break;
        }

        const shopItem = await ShopItem.findOne({ where: { ShopId: shop.id, ItemId: itemToBuy.id } });
        if (!shopItem) {
            await sock.sendMessage(jid, { text: `"${itemToBuy.name}" n'est pas vendu ici.` });
            break;
        }

        if (shopItem.quantity !== -1 && shopItem.quantity < quantity) {
            await sock.sendMessage(jid, { text: `Stock insuffisant pour "${itemToBuy.name}".` });
            break;
        }

        const totalPrice = itemToBuy.price * quantity;
        if (player.money < totalPrice) {
            await sock.sendMessage(jid, { text: `Tu n'as pas assez d'argent. Il te manque ${totalPrice - player.money}$.` });
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

        if (shopItem.quantity !== -1) {
            shopItem.quantity -= quantity;
            await shopItem.save();
        }

        await sendWithImage(sock, jid, aiResponse.narrative);
        break;

      case 'accelerate':
        await sendWithImage(sock, jid, (await accelerateVehicle(player)).narrative);
        break;

      case 'brake':
        await sendWithImage(sock, jid, (await brakeVehicle(player)).narrative);
        break;

      case 'drive':
        await sendWithImage(sock, jid, (await driveVehicle(player, aiResponse.parameters.vehicleId)).narrative);
        break;

      case 'park':
        await sendWithImage(sock, jid, (await parkVehicle(player)).narrative);
        break;

      case 'narrate':
      case 'error':
        await sendWithImage(sock, jid, aiResponse.narrative || aiResponse.parameters.reason);
        break;

      default:
        console.error("Action IA non reconnue ou manquante:", { response: aiResponse });
        await sock.sendMessage(jid, { text: `Action inconnue de l'IA: ${action}` });
    }

    await checkMissionCompletion(sock, player);

  } catch (error) {
    console.error('Erreur communication API Pollination:', {
        message: error.message,
        response: error.response ? JSON.stringify(error.response.data) : 'N/A'
    });
    await sock.sendMessage(jid, { text: "Erreur de l'IA. Réessaye ton action." });
  }
}

module.exports = { handleFreeAction, locations };
