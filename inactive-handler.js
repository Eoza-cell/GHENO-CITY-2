const { Player } = require('./database');
const { Op } = require('sequelize');
const { sendWithImage } = require('./message-handler');

const INACTIVITY_THRESHOLD_MINUTES = 30;
const CHECK_INTERVAL_MINUTES = 5;

/**
 * Starts a periodic check for inactive players.
 * @param {object} sock The WebSocket connection object.
 */
function startInactivePlayerCheck(sock) {
    console.log(`[InactiveHandler] Démarrage de la vérification d'inactivité (toutes les ${CHECK_INTERVAL_MINUTES} minutes).`);

    setInterval(async () => {
        try {
            const thirtyMinutesAgo = new Date(Date.now() - INACTIVITY_THRESHOLD_MINUTES * 60 * 1000);

            const inactivePlayers = await Player.findAll({
                where: {
                    lastActivity: {
                        [Op.lt]: thirtyMinutesAgo,
                    },
                    // Avoid spamming players who have already been notified
                    [Op.or]: [
                        { lastInactiveMessageSentAt: null },
                        { lastInactiveMessageSentAt: { [Op.lt]: thirtyMinutesAgo } }
                    ]
                }
            });

            if (inactivePlayers.length > 0) {
                console.log(`[InactiveHandler] ${inactivePlayers.length} joueur(s) inactif(s) trouvé(s).`);
                for (const player of inactivePlayers) {
                    const message = `Le monde de Gheno City continue d'évoluer sans toi, ${player.name}. Tu es considéré comme immobile. Envoie une commande ou une action pour te réveiller.`;
                    await sendWithImage(sock, player.whatsappId, message);

                    // Update the timestamp to avoid sending another message right away
                    player.lastInactiveMessageSentAt = new Date();
                    await player.save();
                }
            }
        } catch (error) {
            console.error('[InactiveHandler] Erreur lors de la vérification des joueurs inactifs:', error);
        }
    }, CHECK_INTERVAL_MINUTES * 60 * 1000);
}

module.exports = { startInactivePlayerCheck };
