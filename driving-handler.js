const { Player, PlayerVehicle } = require('./database');

const activeDrivers = new Map(); // jid -> { interval, player, vehicle, sock }

/**
 * Starts the driving minigame for a player.
 * @param {object} sock The WebSocket connection object.
 * @param {object} player The player object from the database.
 * @param {object} playerVehicle The player's vehicle object.
 */
function startDriving(sock, player, playerVehicle) {
    const jid = player.whatsappId;
    const replyJid = player.whatsappId; // In driving mode, we can assume direct message.

    // If already driving, stop the old session first
    if (activeDrivers.has(jid)) {
        stopDriving(jid);
    }

    const gameState = {
        sock,
        player,
        vehicle: playerVehicle,
        speed: 0,
        distance: 0,
        lastEvent: null,
        interval: null,
    };

    sock.sendMessage(replyJid, { text: `Vous montez dans votre ${playerVehicle.Vehicle.name}. Moteur allumé.\n\nEnvoyez des commandes simples comme "accélérer", "freiner", "gauche", "droite" pour conduire.` });

    gameState.interval = setInterval(() => gameLoop(jid), 15000); // 15 seconds
    activeDrivers.set(jid, gameState);
}

/**
 * The main game loop for the driving minigame.
 * @param {string} jid The JID of the player.
 */
function gameLoop(jid) {
    const gameState = activeDrivers.get(jid);
    if (!gameState) return;

    const { sock, player, vehicle } = gameState;
    const replyJid = player.whatsappId;

    // Simulate some basic physics/events
    gameState.distance += gameState.speed / 10;
    gameState.speed *= 0.95; // Natural deceleration

    // Random event logic
    const eventRoll = Math.random();
    let eventMessage = `Rapport de conduite:\nVitesse: ${gameState.speed.toFixed(1)} km/h\nDistance parcourue: ${gameState.distance.toFixed(2)} km`;

    if (eventRoll < 0.2) { // 20% chance of a sharp turn
        gameState.lastEvent = 'turn';
        eventMessage += "\n\n⚠️ Virage serré en approche ! Envoyez `droite` ou `gauche` pour négocier.";
    } else if (eventRoll < 0.4) { // 20% chance of an obstacle
        gameState.lastEvent = 'obstacle';
        eventMessage += "\n\n🚨 Obstacle sur la route ! Envoyez `freiner` ou `esquiver`.";
    } else {
        gameState.lastEvent = null; // No specific event
        eventMessage += "\n\nLa route est libre. Continuez de conduire.";
    }

    sock.sendMessage(replyJid, { text: eventMessage });
}

/**
 * Handles incoming messages as driving actions.
 * @param {object} sock The WebSocket connection object.
 * @param {object} message The message object from Baileys.
 * @param {object} player The player object.
 * @param {string} text The text from the message.
 */
async function handleDrivingAction(sock, message, player, text) {
    const jid = player.whatsappId;
    const replyJid = message.key.remoteJid;
    const gameState = activeDrivers.get(jid);

    if (!gameState) {
        await sock.sendMessage(replyJid, { text: "Vous n'êtes pas en train de conduire." });
        await player.update({ mode: 'normal' });
        return;
    }

    const action = text.toLowerCase().trim();
    let responseText = '';

    // Handle responses to events
    if (gameState.lastEvent) {
        if (gameState.lastEvent === 'turn' && (action === 'gauche' || action === 'droite')) {
            responseText = 'Vous négociez le virage avec succès !';
            gameState.lastEvent = null;
        } else if (gameState.lastEvent === 'obstacle' && (action === 'freiner' || action === 'esquiver')) {
            responseText = "Vous évitez l'obstacle de justesse !";
            gameState.lastEvent = null;
        } else {
            const damage = 5;
            gameState.vehicle.damage += damage;
            await gameState.vehicle.save();
            responseText = `Mauvaise manœuvre ! Vous heurtez quelque chose. Votre véhicule subit ${damage}% de dégâts.`;
            gameState.lastEvent = null;

            if (gameState.vehicle.damage >= 100) {
                stopDriving(jid, "Votre véhicule est hors d'usage !");
                return;
            }
        }
    } else {
        // Handle general driving actions
        switch (action) {
            case 'accélérer':
                gameState.speed += 10;
                responseText = `Vous accélérez. Vitesse: ${gameState.speed.toFixed(1)} km/h`;
                break;
            case 'freiner':
                gameState.speed = Math.max(0, gameState.speed - 15);
                responseText = `Vous freinez. Vitesse: ${gameState.speed.toFixed(1)} km/h`;
                break;
            case 'arrêter':
                stopDriving(jid, 'Vous vous garez sur le côté de la route.');
                return;
            default:
                responseText = 'Commande de conduite non reconnue. (accélérer, freiner, gauche, droite, arrêter)';
        }
    }

    await sock.sendMessage(replyJid, { text: responseText });
}


/**
 * Stops the driving minigame for a player.
 * @param {string} jid The JID of the player.
 * @param {string} [reason] An optional message to send when stopping.
 */
async function stopDriving(jid, reason) {
    const gameState = activeDrivers.get(jid);
    if (gameState) {
        clearInterval(gameState.interval);
        activeDrivers.delete(jid);
        await gameState.player.update({ mode: 'normal' });
        if (reason) {
            await gameState.sock.sendMessage(jid, { text: reason });
        }
        console.log(`[Driving] Session arrêtée pour ${jid}.`);
    }
}

module.exports = { startDriving, stopDriving, handleDrivingAction };
