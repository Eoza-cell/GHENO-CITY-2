/**
 * Shared level-up logic. Reloads the player, and while accumulated XP meets the
 * threshold (level * 100), levels up and upgrades stats. Notifies via WhatsApp
 * when a sock is provided.
 * @param {object} player Sequelize Player instance
 * @param {object} [sock] optional Baileys socket for notification
 * @returns {Promise<boolean>} true if at least one level was gained
 */
async function checkLevelUp(player, sock) {
    const { shouldNotifyPlayer } = require('./message-handler');
    await player.reload();
    const xpNeeded = player.level * 100;
    if (player.xp < xpNeeded) return false;

    const levelsGained = Math.floor(player.xp / xpNeeded);
    await player.increment('level', { by: levelsGained });
    await player.update({
        xp: player.xp % xpNeeded,
        maxHealth: player.maxHealth + (levelsGained * 15),
        maxMana: player.maxMana + (levelsGained * 8),
        health: player.maxHealth + (levelsGained * 15),
        mana: player.maxMana + (levelsGained * 8),
        strength: player.strength + (levelsGained * 1),
        agility: player.agility + (levelsGained * 1),
        intelligence: player.intelligence + (levelsGained * 1)
    });

    if (sock && shouldNotifyPlayer(player)) {
        await sock.sendMessage(player.whatsappId, {
            text: `✨ *LEVEL UP !* ✨\nTu es maintenant niveau ${player.level} !\nTes stats ont augmenté.`
        });
    }
    return true;
}

module.exports = { checkLevelUp };
