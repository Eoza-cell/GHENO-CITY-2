const { Player, Vehicle, PlayerVehicle, Shop, Item, ShopItem, Family, House, sequelize } = require('./database');
const { isDay } = require('./game-state');
const { sendWithImage, sendAnimatedMessage } = require('./message-handler');
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
    connections: ['Little Sicily', 'dealership'],
  },
  'dealership': {
    description: "Une concession de voitures d'occasion. L'odeur de l'essence et des rêves brisés flotte dans l'air.",
    connections: ['Downtown', 'hideout'],
  },
  'hideout': {
    description: "Un entrepôt désaffecté. C'est ici que le caïd local dirige ses affaires.",
    connections: ['dealership'],
  }
};

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

  // 1. Build the context for the AI
  const playerHouses = await player.getHouses();
  const playerState = `
    - Nom: ${player.name}
    - Description: ${player.characterDescription}
    - Argent: ${player.money}$
    - Emplacement: ${player.location} (${locations[player.location]?.description || 'Description inconnue'})
    - Destinations possibles: ${locations[player.location]?.connections.join(', ') || 'Aucune'}
    - Propriétés possédées: ${playerHouses.length > 0 ? playerHouses.map(h => h.name).join(', ') : 'Aucune'}
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
    2.  **Champ "narrative" Obligatoire**: Chaque réponse JSON DOIT contenir un champ "narrative" (string) qui décrit le résultat de l'action pour le joueur.
    3.  **Réalisme Impitoyable**: Le monde est logique. Les actions impossibles (sauter entre des immeubles, esquiver des balles à bout portant) DOIVENT résulter en une action "error".
    4.  **Images Personnalisées**: La narration DOIT inclure un prompt d'image avec la description du joueur. Ex: \`[POLLINATION PROMPT: un homme grand aux cheveux noirs...]\`
    5.  **Mise à jour de la carte**: À CHAQUE déplacement ou action importante, ajoute le tag de carte: \`[GENERATE_MAP:${player.location}:${player.profilePicPath || 'null'}]\`

    TYPES D'ACTIONS (JSON):
    - "action": "update_player", "parameters": {"money_change": montant, "xp_gain": montant}, "narrative": "Tu as gagné X argent..."
    - "action": "steal_car", "parameters": {"success": true_ou_false, "category": "Compacte" | "Berline" | "Sportive"}
    - "action": "move", "parameters": {"destination": "nom_du_lieu"}
    - "action": "buy_item", "parameters": {"itemName": "nom_de_l_article", "quantity": nombre}
    - "action": "buy_house", "parameters": {"houseName": "nom_de_la_maison"}
    - "action": "drive", "parameters": {"vehicleId": id_du_vehicule}
    - "action": "park"
    - "action": "accelerate"
    - "action": "brake"
    - "action": "join_family", "parameters": {"familyName": "nom_de_la_famille"}
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
    const animatedMessage = await sendAnimatedMessage(sock, jid, "Génération de la réponse en cours...");

    const providers = [
      {
        url: 'https://text.pollinations.ai/openai',
        data: {
          messages: [
            { role: "system", content: "Vous êtes un maître du jeu de rôle." },
            { role: "user", content: systemPrompt }
          ]
        }
      },
      {
        url: 'https://text.pollinations.ai/',
        data: {
          messages: [
            { role: "system", content: "Vous êtes un maître du jeu de rôle." },
            { role: "user", content: systemPrompt }
          ]
        }
      },
      {
        url: 'https://api.airforce/v1/chat/completions',
        data: {
          model: "step-3.5-flash:free",
          messages: [
            { role: "system", content: "Vous êtes un maître du jeu de rôle." },
            { role: "user", content: systemPrompt }
          ]
        }
      }
    ];

    let response;
    let lastError;

    for (const provider of providers) {
      try {
        console.log(`[AI Handler] Tentative avec le fournisseur : ${provider.url}`);
        response = await axios.post(provider.url, provider.data, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        if (response.data) {
            console.log(`[AI Handler] Succès avec ${provider.url}`);
            break;
        }
      } catch (e) {
        console.warn(`[AI Handler] Le fournisseur AI à ${provider.url} a échoué:`, e.response ? `Status ${e.response.status}` : e.message);
        lastError = e;
      }
    }

    if (!response || !response.data) {
        throw lastError || new Error("Tous les fournisseurs d'IA ont échoué.");
    }

    let aiResponseText;
    console.log("[AI Handler] Données brutes reçues de l'API:", JSON.stringify(response.data).substring(0, 500));

    if (typeof response.data === 'string') {
      aiResponseText = response.data;
    } else if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      aiResponseText = response.data.choices[0].message.content;
    } else {
      aiResponseText = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data);
    }

    if (!aiResponseText || aiResponseText.trim() === '') {
        throw new Error("L'IA a retourné une réponse vide.");
    }

    // Extract JSON from the response (it might be wrapped in markdown or have extra text)
    const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiResponseText = jsonMatch[0];
    }

    let aiResponse;
    try {
      aiResponse = JSON.parse(aiResponseText);
    } catch (parseError) {
      console.warn("La réponse de l'IA n'était pas un JSON valide. Contenu:", aiResponseText);
      // If parsing fails, wrap the raw string in a narrate action.
      aiResponse = { action: 'narrate', narrative: aiResponseText };
    }

    // Ensure we have a narrative even if the AI used a different field name
    if (!aiResponse.narrative && aiResponse.description) {
      aiResponse.narrative = aiResponse.description;
    }
    if (!aiResponse.narrative && aiResponse.message) {
      aiResponse.narrative = aiResponse.message;
    }

    // Default to 'narrate' if no action is specified but we have a narrative
    // Ensure map is generated on move
    if (aiResponse.action === 'move' && aiResponse.narrative) {
        if (!aiResponse.narrative.includes('[GENERATE_MAP:')) {
            aiResponse.narrative += ` [GENERATE_MAP:${aiResponse.parameters.destination || player.location}:${player.profilePicPath || 'null'}]`;
        }
    }

    let action = aiResponse.action ? aiResponse.action.trim() : null;
    if (!action && aiResponse.narrative) {
      action = 'narrate';
    }
    if (!action) action = 'no_action';

    // Log the determined action
    console.log(`[AI Handler] Action déterminée: ${action}`);

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

      case 'buy_house':
        const hName = aiResponse.parameters.houseName;
        const houseToBuy = await House.findOne({ where: { name: { [Op.like]: `%${hName}%` } } });

        if (!houseToBuy) {
            await sock.sendMessage(jid, { text: `Maison "${hName}" non trouvée.` });
            break;
        }

        if (player.money < houseToBuy.price) {
            await sock.sendMessage(jid, { text: `Tu n'as pas assez d'argent pour acheter "${houseToBuy.name}".` });
            break;
        }

        const alreadyOwned = await player.hasHouse(houseToBuy);
        if (alreadyOwned) {
            await sock.sendMessage(jid, { text: `Tu possèdes déjà "${houseToBuy.name}".` });
            break;
        }

        await player.addHouse(houseToBuy);
        await player.decrement('money', { by: houseToBuy.price });
        await sendWithImage(sock, jid, aiResponse.narrative + `\n\nFélicitations ! Tu es maintenant l'heureux propriétaire de : ${houseToBuy.name}.`);
        break;

      case 'drive':
        await sendWithImage(sock, jid, (await driveVehicle(player, aiResponse.parameters.vehicleId)).narrative);
        break;

      case 'park':
        await sendWithImage(sock, jid, (await parkVehicle(player)).narrative);
        break;

      case 'accelerate':
        await sendWithImage(sock, jid, (await accelerateVehicle(player)).narrative);
        break;

      case 'brake':
        await sendWithImage(sock, jid, (await brakeVehicle(player)).narrative);
        break;

      case 'join_family':
        const famName = aiResponse.parameters.familyName;
        const familyToJoin = await Family.findOne({ where: { name: { [Op.like]: `%${famName}%` } } });
        if (familyToJoin) {
          // Check if player is at the right location to join
          if (player.location === familyToJoin.baseLocation) {
            await player.update({ FamilyId: familyToJoin.id });
            await sendWithImage(sock, jid, aiResponse.narrative + `\n\nFélicitations, tu fais maintenant partie de la ${familyToJoin.name} !`);
          } else {
            await sock.sendMessage(jid, { text: `Tu dois te rendre à ${familyToJoin.baseLocation} pour rejoindre cette famille.` });
          }
        } else {
          await sock.sendMessage(jid, { text: `La famille "${famName}" n'existe pas.` });
        }
        break;

      case 'narrate':
      case 'error':
        await sendWithImage(sock, jid, aiResponse.narrative || aiResponse.parameters?.reason || "Désolé, je n'ai pas pu générer de réponse.");
        break;

      default:
        console.error("Action IA non reconnue:", { response: aiResponse });
        await sock.sendMessage(jid, { text: `Action inconnue de l'IA: ${action}` });
    }

    await checkMissionCompletion(sock, player, message);

  } catch (error) {
    console.error("Erreur lors de l'interaction avec l'IA:", error.response ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)) : error.message);
    await sock.sendMessage(jid, { text: "Désolé, une erreur s'est produite lors de la connexion à l'IA. Veuillez réessayer." });
  }
}

module.exports = { handleFreeAction, locations };
