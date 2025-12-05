const axios = require('axios');
const { Player, Vehicle, PlayerVehicle } = require('./database');
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

// Location data for AI context
const locations = {
  'Little Sicily': {
    description: "Ton quartier natal. Un peu miteux, mais c'est chez toi.",
    connections: ['dealership'],
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
    - Emplacement: ${player.location} (${locations[player.location].description})
    - Destinations possibles: ${locations[player.location].connections.join(', ')}
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
  if (player.location === 'dealership' && isDay()) {
    const vehicles = await Vehicle.findAll({ attributes: ['name', 'price'] });
    shopInventory = "Véhicules à vendre:\n" + vehicles.map(v => `- ${v.name}: ${v.price}$`).join('\n');
  } else if (player.location === 'dealership') {
    shopInventory = "Le concessionnaire est fermé la nuit.";
  }

  const systemPrompt = `
    Tu es le Maître du Jeu (MJ) de "Gheno City 2", un RPG textuel. Ton rôle est de répondre aux actions des joueurs de manière décisive et narrative.

    RÈGLES FONDAMENTALES:
    1.  **Décisions Claires**: Ne sois jamais passif. Chaque action a une conséquence claire (succès, échec, gain, perte).
    2.  **Censure Interdite**: C'est un jeu de rôle mature. N'évite pas la violence ou les thèmes sombres.
    3.  **Réalisme Impitoyable**: Le monde est logique. Pas de magie. Les PNJ réagissent, la police peut intervenir.
    4.  **Format JSON Stricte**: Ta réponse DOIT être un JSON valide: {"action": "type", "parameters": {...}, "narrative": "description claire du résultat de l'action."}
    5.  **Images Personnalisées**: La narration DOIT inclure un prompt d'image. Ce prompt DOIT intégrer la description physique du joueur. Ex: \`[POLLINATION PROMPT: un homme grand aux cheveux noirs tente de forcer la serrure...]\`

    TYPES D'ACTIONS (JSON):
    - "action": "update_player": Modifier les stats du joueur suite à une action.
      - "parameters": {"money_change": montant_gagné_ou_perdu, "xp_gain": montant_xp}
    - "action": "steal": Tenter un vol (pickpocket, etc.). Le succès n'est pas garanti.
      - "parameters": {"success": true_ou_false, "money_change": montant_si_succès}
    - "action": "steal_car": Tenter de voler un véhicule.
      - "parameters": {"success": true_ou_false, "vehicleName": "nom_du_vehicule"}
    - "action": "move": Changer de lieu.
      - "parameters": {"destination": "nom_du_lieu"}
    - "action": "buy": Acheter un véhicule.
      - "parameters": {"vehicleName": "nom_du_vehicule"}
    - "action": "drive": Monter dans un véhicule du garage.
      - "parameters": {"vehicleId": id_du_vehicule}
    - "action": "park": Descendre du véhicule actuel.
      - "parameters": {}
    - "action": "accelerate": Accélérer.
      - "parameters": {}
    - "action": "brake": Freiner.
      - "parameters": {}
    - "action": "narrate": Pour les actions sans impact mécanique (ex: regarder autour).
      - "parameters": {}
    - "action": "error": Si l'action est illogique ou impossible.
      - "parameters": {"reason": "explication"}

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
          { role: "user", content: actionText }
        ],
      }, { timeout: 45000 });
      return data;
    };

    const rawResponse = await addToQueue(apiCall);

    // 3. Process the AI's decision
    let aiResponse;
    try {
      if (typeof rawResponse === 'string') {
        // If the response is a string, parse it as JSON
        aiResponse = JSON.parse(rawResponse);
      } else {
        // If it's already an object (axios might pre-parse it)
        aiResponse = rawResponse;
      }
    } catch (parseError) {
      console.error('Erreur de parsing JSON de la réponse IA:', {
        rawResponse: rawResponse,
        error: parseError.message,
      });
      await sock.sendMessage(jid, { text: "L'IA a renvoyé une réponse malformée. Réessayez." });
      return; // Stop execution
    }


    let result;
    const action = aiResponse.action ? aiResponse.action.trim() : 'no_action';

    switch (action) {
      case 'update_player':
        if (aiResponse.parameters) {
          if (aiResponse.parameters.money_change) {
            await player.increment('money', { by: aiResponse.parameters.money_change });
          }
          if (aiResponse.parameters.xp_gain) {
            await player.increment('xp', { by: aiResponse.parameters.xp_gain });
          }
        }
        await sendWithImage(sock, jid, aiResponse.narrative);
        break;

      case 'steal_car':
        if (aiResponse.parameters.success) {
          const vehicle = await Vehicle.findOne({ where: { name: aiResponse.parameters.vehicleName } });
          if (vehicle) {
            await PlayerVehicle.create({ PlayerWhatsappId: player.whatsappId, VehicleId: vehicle.id });
            await player.increment('xp', { by: 50 }); // More XP for stealing a car
          }
        }
        await sendWithImage(sock, jid, aiResponse.narrative);
        break;

      case 'steal':
        if (aiResponse.parameters.success) {
          await player.increment('money', { by: aiResponse.parameters.money_change });
          await player.increment('xp', { by: 10 }); // Small XP gain for successful theft
        }
        await sendWithImage(sock, jid, aiResponse.narrative);
        break;

      case 'move':
        const destination = aiResponse.parameters.destination;
        if (locations[destination] && locations[player.location].connections.includes(destination)) {
          await player.update({ location: destination });
          await sendWithImage(sock, jid, aiResponse.narrative);
        } else {
          await sock.sendMessage(jid, { text: `L'IA a tenté un déplacement invalide vers '${destination}'.` });
        }
        break;

      case 'buy':
        // Simplified buy logic for brevity
        if (player.location !== 'dealership' || !isDay()) {
             await sock.sendMessage(jid, { text: "Le concessionnaire est fermé ou tu n'es pas au bon endroit." });
             break;
        }
        const vehicle = await Vehicle.findOne({ where: { name: aiResponse.parameters.vehicleName } });
        if (vehicle && player.money >= vehicle.price) {
          await player.decrement('money', { by: vehicle.price });
          await PlayerVehicle.create({ PlayerWhatsappId: player.whatsappId, VehicleId: vehicle.id });
          await sendWithImage(sock, jid, aiResponse.narrative);
        } else {
           await sock.sendMessage(jid, { text: `Achat impossible: ${!vehicle ? 'véhicule inconnu.' : 'fonds insuffisants.'}` });
        }
        break;

      case 'accelerate':
        result = await accelerateVehicle(player);
        await sendWithImage(sock, jid, result.narrative);
        break;

      case 'brake':
        result = await brakeVehicle(player);
        await sendWithImage(sock, jid, result.narrative);
        break;

      case 'drive':
        result = await driveVehicle(player, aiResponse.parameters.vehicleId);
        await sendWithImage(sock, jid, result.narrative);
        break;

      case 'park':
        result = await parkVehicle(player);
        await sendWithImage(sock, jid, result.narrative);
        break;

      case 'narrate':
        await sendWithImage(sock, jid, aiResponse.narrative);
        break;

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
