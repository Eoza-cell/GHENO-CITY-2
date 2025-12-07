const { Player, PlayerVehicle } = require('./database');

const activeDrivers = new Map(); // remoteJid -> { interval, player, vehicle, sock }

/**
 * Starts the driving minigame for a player.
 * @param {object} sock The WebSocket connection object.
 * @param {object} message The message object from Baileys to get the chat JID.
 * @param {object} player The player object from the database.
 * @param {object} playerVehicle The player's vehicle object.
 */
function startDriving(sock, message, player, playerVehicle) {
    const playerJid = player.whatsappId;
    const chatJid = message.key.remoteJid;

    // Use chatJid as the key to keep the game session scoped to the chat
    if (activeDrivers.has(chatJid)) {
        stopDriving(chatJid);
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

    sock.sendMessage(chatJid, { text: `Vous montez dans votre ${playerVehicle.Vehicle.name}. Moteur allumé.\n\nEnvoyez des commandes simples comme "accélérer", "freiner", "gauche", "droite" pour conduire.` });

    gameState.interval = setInterval(() => gameLoop(chatJid), 15000);
    activeDrivers.set(chatJid, gameState);
}


/**
 * The main game loop for the driving minigame.
 * @param {string} chatJid The JID of the chat where the game is running.
 */
function gameLoop(chatJid) {
    const gameState = activeDrivers.get(chatJid);
    if (!gameState) return;

    const { sock } = gameState;

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

    sock.sendMessage(chatJid, { text: eventMessage });
}

/**
 * Handles incoming messages as driving actions.
 * @param {object} sock The WebSocket connection object.
 * @param {object} message The message object from Baileys.
 * @param {object} player The player object.
 * @param {string} text The text from the message.
 */
async function handleDrivingAction(sock, message, player, text) {
    const chatJid = message.key.remoteJid;
    const gameState = activeDrivers.get(chatJid);

    if (!gameState) {
        await sock.sendMessage(chatJid, { text: "Personne ne conduit dans ce chat." });
        // Find the player who sent the message and reset their mode if they are stuck
        const stuckPlayer = await Player.findOne({ where: { whatsappId: player.whatsappId }});
        if (stuckPlayer && stuckPlayer.mode === 'driving') {
             await stuckPlayer.update({ mode: 'normal' });
        }
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
                stopDriving(chatJid, "Votre véhicule est hors d'usage !");
                return;
            }
        }
    } else {
        // Handle general driving actions
        switch (action) {
            case 'accélérer':
            case 'accelerer':
                gameState.speed += 10;
                responseText = `Vous accélérez. Vitesse: ${gameState.speed.toFixed(1)} km/h`;
                break;
            case 'freiner':
                gameState.speed = Math.max(0, gameState.speed - 15);
                responseText = `Vous freinez. Vitesse: ${gameState.speed.toFixed(1)} km/h`;
                break;
            case 'arrêter':
            case 'arreter':
                stopDriving(chatJid, 'Vous vous garez sur le côté de la route.');
                return;
            default:
                responseText = 'Commande de conduite non reconnue. (accélérer, freiner, gauche, droite, arrêter)';
        }
    }

    await sock.sendMessage(chatJid, { text: responseText });
}


/**
 * Stops the driving minigame for a player.
 * @param {string} chatJid The JID of the chat where the game is running.
 * @param {string} [reason] An optional message to send when stopping.
 */
async function stopDriving(chatJid, reason) {
    const gameState = activeDrivers.get(chatJid);
    if (gameState) {
        clearInterval(gameState.interval);
        activeDrivers.delete(chatJid);
        await gameState.player.update({ mode: 'normal' });
        if (reason) {
            await gameState.sock.sendMessage(chatJid, { text: reason });
        }
        console.log(`[Driving] Session arrêtée pour le chat ${chatJid}.`);
    }
}

module.exports = { startDriving, stopDriving, handleDrivingAction, activeDrivers };
