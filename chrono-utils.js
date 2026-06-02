const { Player } = require('./database');

/**
 * Updates the player's RP day based on real-world time.
 * 90 mins IRL = 1 Day RP.
 * @param {object} player The player instance.
 */
async function updateChrono(player) {
    if (!player) return false;
    const now = new Date();
    const diffMs = now - player.lastChronoUpdate;
    const diffMin = diffMs / (1000 * 60);

    if (diffMin >= 90) {
        const daysPassed = Math.floor(diffMin / 90);
        await player.increment('currentDay', { by: daysPassed });
        await player.update({ lastChronoUpdate: now });
        return true;
    }
    return false;
}

module.exports = { updateChrono };
