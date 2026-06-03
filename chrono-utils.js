const { User } = require('./database');

/**
 * Updates the player's RP day based on real-world time.
 * 90 mins IRL = 1 Day RP.
 * @param {object} user The user instance.
 */
async function updateChrono(user) {
    if (!user) return false;
    const now = new Date();
    const diffMs = now - user.lastChronoUpdate;
    const diffMin = diffMs / (1000 * 60);

    if (diffMin >= 90) {
        // We can keep a 'currentDay' if we want world progression,
        // but User model doesn't have it explicitly right now, let's just update lastChronoUpdate
        await user.update({ lastChronoUpdate: now });
        return true;
    }
    return false;
}

module.exports = { updateChrono };
