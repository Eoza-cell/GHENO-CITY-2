const { Player, PlayerVehicle } = require('./database');

const activeDrivers = new Map(); // remoteJid -> { interval, player, vehicle, sock, policeChase: boolean }

/**
 * Starts the driving minigame for a player.
 */
function startDriving(sock, message, player, playerVehicle) {
    const chatJid = message.key.remoteJid;

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
        policeChase: false,
        interval: null,
    };

    sock.sendMessage(chatJid, { text: `Tu sautes dans ta ${playerVehicle.Vehicle.name}. Le moteur gronde. Que fais-tu ?\n\nCommandes: \`accélérer\`, \`freiner\`, \`gauche\`, \`droite\`, \`arrêter\`` });

    gameState.interval = setInterval(() => gameLoop(chatJid), 15000);
    activeDrivers.set(chatJid, gameState);
}

/**
 * The main game loop for the driving minigame.
 */
function gameLoop(chatJid) {
    const gameState = activeDrivers.get(chatJid);
    if (!gameState) return;

    const { sock } = gameState;

    gameState.distance += gameState.speed / 10;
    gameState.speed = Math.max(0, gameState.speed * 0.95 - 2); // Natural deceleration + friction

    if (gameState.policeChase) {
        handlePoliceChase(chatJid, gameState);
        return;
    }

    const eventRoll = Math.random();
    let eventMessage;

    if (eventRoll < 0.15) { // 15% chance of police
        gameState.policeChase = true;
        eventMessage = `🚨 Les gyrophares de la police remplissent tes rétroviseurs ! Tu dois les semer ! Accélère ou prends une ruelle pour t'échapper !`;
        gameState.lastEvent = 'police_start';
    } else if (eventRoll < 0.4) { // 25% chance of a sharp turn
        gameState.lastEvent = 'turn';
        eventMessage = `⚠️ Un virage serré arrive à toute vitesse ! \`droite\` ou \`gauche\` ?`;
    } else if (eventRoll < 0.6) { // 20% chance of an obstacle
        gameState.lastEvent = 'obstacle';
        eventMessage = `🚨 Un camion bloque la route ! \`freiner\` ou \`esquiver\` ?`;
    } else {
        gameState.lastEvent = null;
        eventMessage = `La route est à toi. La vitesse monte... Actuellement à ${gameState.speed.toFixed(0)} km/h.`;
    }

    sock.sendMessage(chatJid, { text: eventMessage });
}

function handlePoliceChase(chatJid, gameState) {
    const { sock } = gameState;
    let chaseMessage;

    if (gameState.speed < 40) {
        chaseMessage = "La police te rattrape ! Tu es presque coincé. Il faut accélérer !";
    } else {
        chaseMessage = "Tu zigzagues dans le trafic, les sirènes hurlent derrière toi. Continue !";
    }

    // Simple escape condition
    if (Math.random() < 0.3 && gameState.speed > 80) {
        chaseMessage = "Dans une manœuvre audacieuse, tu prends une ruelle sombre et coupes tes phares. La police passe sans te voir. Tu les as semés !";
        gameState.policeChase = false;
        gameState.lastEvent = null;
    }

    sock.sendMessage(chatJid, { text: chaseMessage });
}


/**
 * Handles incoming messages as driving actions.
 */
async function handleDrivingAction(sock, message, player, text) {
    const chatJid = message.key.remoteJid;
    const gameState = activeDrivers.get(chatJid);

    if (!gameState) {
        // This case should ideally not happen if command-handler is correct, but as a safeguard:
        const stuckPlayer = await Player.findOne({ where: { whatsappId: player.whatsappId }});
        if (stuckPlayer && stuckPlayer.mode === 'driving') {
             await stuckPlayer.update({ mode: 'normal' });
        }
        return;
    }

    const action = text.toLowerCase().trim();
    let responseText = '';

    if (gameState.lastEvent) {
        const event = gameState.lastEvent;
        gameState.lastEvent = null; // Consume the event

        if (event === 'turn' && (action === 'gauche' || action === 'droite')) {
            responseText = 'Les pneus crissent ! Tu passes le virage en dérapage contrôlé.';
        } else if (event === 'obstacle' && (action === 'freiner' || action === 'esquiver')) {
            responseText = "Tu évites l'obstacle de justesse, la carrosserie frôle le danger.";
        } else if (event === 'police_start' && (action === 'accélérer' || action === 'accelerer' || action.includes('ruelle'))) {
            gameState.speed += 20;
            responseText = "Tu enfonces l'accélérateur, le moteur hurle ! La poursuite commence vraiment.";
        } else {
            const damage = Math.floor(Math.random() * 10) + 5;
            gameState.vehicle.damage += damage;
            await gameState.vehicle.save();
            responseText = `💥 Mauvaise décision ! Tu perds le contrôle et heurtes une rambarde. Dégâts: +${damage}%.`;
            if (gameState.policeChase) responseText += " La police se rapproche !";

            if (gameState.vehicle.damage >= 100) {
                stopDriving(chatJid, "La voiture fume, le moteur est mort. La police t'arrête. Fin de la course.");
                return;
            }
        }
    } else {
        // Handle general driving actions
        switch (action) {
            case 'accélérer':
            case 'accelerer':
                gameState.speed += gameState.vehicle.Vehicle.acceleration;
                if(gameState.speed > gameState.vehicle.Vehicle.topSpeed) gameState.speed = gameState.vehicle.Vehicle.topSpeed;
                responseText = `Le moteur rugit. Vitesse: ${gameState.speed.toFixed(0)} km/h`;
                break;
            case 'freiner':
                gameState.speed = Math.max(0, gameState.speed - gameState.vehicle.Vehicle.brakePower);
                responseText = `Les pneus crissent sur l'asphalte. Vitesse: ${gameState.speed.toFixed(0)} km/h`;
                break;
            case 'arrêter':
            case 'arreter':
                stopDriving(chatJid, 'Tu te gares et coupes le moteur. Le silence revient.');
                return;
            default:
                responseText = 'Tes mains sont sur le volant, mais cette commande ne semble pas appropriée... (\`accélérer\`, \`freiner\`, \`arrêter\`)';
        }
    }

    await sock.sendMessage(chatJid, { text: responseText });

    await gameState.player.update({ lastActivity: new Date() });
}

/**
 * Stops the driving minigame.
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
