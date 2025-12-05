
const { Player, PlayerVehicle, Vehicle } = require('./database');
const { sendWithImage } = require('./message-handler');

// This object will store the state of all active driving sessions.
// The key will be the player's JID (whatsappId).
const drivingSessions = {};

/**
 * Initiates a new driving session for a player.
 * @param {object} sock - The Baileys socket instance.
 * @param {Player} player - The player instance from the database.
 * @param {PlayerVehicle} playerVehicle - The specific vehicle instance the player is driving.
 */
async function startDrivingSession(sock, player, playerVehicle) {
    if (!playerVehicle) {
        return sendWithImage(sock, player.whatsappId, "Vous n'êtes dans aucun véhicule. Utilisez la commande appropriée pour monter dans une voiture.");
    }

    // Retrieve the base vehicle details for performance stats
    const baseVehicle = await Vehicle.findOne({ where: { id: playerVehicle.VehicleId } });
    if (!baseVehicle) {
        // This should not happen if data is consistent
        return sendWithImage(sock, player.whatsappId, "Erreur: Impossible de trouver les détails du véhicule que vous conduisez.");
    }

    player.mode = 'driving';
    await player.save();

    drivingSessions[player.whatsappId] = {
        player,
        vehicle: playerVehicle,
        baseVehicle,
        speed: 0, // km/h
        engineOn: false,
        currentTurn: 1,
        // More state can be added here: e.g., location, road conditions, police presence
    };

    const welcomeMessage = `Vous êtes maintenant en mode conduite. Le moteur est actuellement coupé. Utilisez les commandes pour interagir avec le véhicule.\n\n*Commandes de conduite:*\n- /demarrer\n- /accelerer\n- /freiner\n- /eteindre\n- /sortir`;
    await sendWithImage(sock, player.whatsappId, welcomeMessage);
}

/**
 * Ends a player's driving session.
 * @param {object} sock - The Baileys socket instance.
 * @param {string} jid - The player's JID.
 */
async function endDrivingSession(sock, jid) {
    const session = drivingSessions[jid];
    if (session) {
        session.player.mode = 'action'; // Return to default action mode
        await session.player.save();
        delete drivingSessions[jid];
        await sendWithImage(sock, jid, "Vous êtes sorti du véhicule et êtes de retour en mode normal.");
    }
}

/**
 * Handles all commands sent by a player while they are in a driving session.
 * @param {object} sock - The Baileys socket instance.
 * @param {Player} player - The player instance.
 * @param {string} command - The command issued by the player (e.g., 'accelerer').
 */
async function handleDrivingCommand(sock, player, command) {
    const jid = player.whatsappId;
    const session = drivingSessions[jid];

    if (!session) {
        player.mode = 'action';
        await player.save();
        return sendWithImage(sock, jid, "Erreur: Votre session de conduite est introuvable. Retour au mode normal.");
    }

    let responseMessage = "";

    switch (command) {
        case '/demarrer':
            if (session.engineOn) {
                responseMessage = "Le moteur est déjà allumé.";
            } else {
                session.engineOn = true;
                responseMessage = "Vous démarrez le moteur. Le V8 gronde sous le capot.";
            }
            break;

        case '/eteindre':
            if (!session.engineOn) {
                responseMessage = "Le moteur est déjà éteint.";
            } else if (session.speed > 0) {
                responseMessage = "Vous ne pouvez pas éteindre le moteur alors que la voiture roule !";
            } else {
                session.engineOn = false;
                responseMessage = "Vous coupez le contact. Le silence s'installe.";
            }
            break;

        case '/accelerer':
            if (!session.engineOn) {
                responseMessage = "Le moteur est éteint. Vous devez le démarrer d'abord.";
            } else {
                // Acceleration logic depends on the vehicle's stats
                const acceleration = session.baseVehicle.acceleration; // A value representing acceleration power
                const topSpeed = session.baseVehicle.topSpeed;

                let speedGain = Math.round(acceleration * (1 - (session.speed / topSpeed)));
                speedGain = Math.max(speedGain, 5); // Minimum speed gain

                session.speed += speedGain;
                if (session.speed > topSpeed) {
                    session.speed = topSpeed;
                }

                responseMessage = `Vous appuyez sur l'accélérateur. La voiture bondit en avant.\nVitesse actuelle : ${session.speed} km/h.`;
            }
            break;

        case '/freiner':
            if (session.speed === 0) {
                responseMessage = "La voiture est déjà à l'arrêt.";
            } else {
                // Braking logic
                const brakePower = session.baseVehicle.brakePower;
                let speedLoss = Math.round(brakePower * (session.speed / session.baseVehicle.topSpeed));
                speedLoss = Math.max(speedLoss, 10); // Minimum speed loss

                session.speed -= speedLoss;
                if (session.speed < 0) {
                    session.speed = 0;
                }

                responseMessage = `Vous freinez brusquement.\nVitesse actuelle : ${session.speed} km/h.`;
                 if (session.speed === 0) {
                    responseMessage += "\nLa voiture s'immobilise.";
                }
            }
            break;

        case '/sortir':
             if (session.speed > 0) {
                responseMessage = "Vous ne pouvez pas sortir d'un véhicule en mouvement ! Arrêtez-vous d'abord.";
            } else {
                // End the session
                return endDrivingSession(sock, jid);
            }
            break;

        default:
            responseMessage = `Commande inconnue en mode conduite. Commandes disponibles: /demarrer, /accelerer, /freiner, /eteindre, /sortir.`;
            break;
    }

    await sendWithImage(sock, jid, responseMessage);
}

module.exports = {
    startDrivingSession,
    handleDrivingCommand,
    drivingSessions, // Export for external checks if needed
};
