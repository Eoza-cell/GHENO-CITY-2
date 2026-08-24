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
    let currentXp = player.xp || 0;
    let currentLvl = player.level || 1;
    let levelsGained = 0;

    while (currentXp >= currentLvl * 100) {
        currentXp -= currentLvl * 100;
        currentLvl += 1;
        levelsGained += 1;
    }

    if (levelsGained > 0) {
        const hpBonus = levelsGained * 20;
        const mpBonus = levelsGained * 20;
        const newMaxHp = (player.maxHealth || 100) + hpBonus;
        const newMaxMp = (player.maxMana || 100) + mpBonus;

        await player.update({
            level: currentLvl,
            xp: currentXp,
            maxHealth: newMaxHp,
            maxMana: newMaxMp,
            health: newMaxHp,
            mana: newMaxMp,
            skillPoints: (player.skillPoints || 0) + (levelsGained * 5),
            strength: (player.strength || 10) + (levelsGained * 2),
            agility: (player.agility || 10) + (levelsGained * 2),
            intelligence: (player.intelligence || 10) + (levelsGained * 2),
            defense: (player.defense || 10) + (levelsGained * 2)
        });

        if (sock && shouldNotifyPlayer(player)) {
            try {
                const targetJid = player.whatsappId;
                await sock.sendMessage(targetJid, {
                    text: `🎉 *MONTÉE EN NIVEAU ! LEVEL UP !* 🎉\n\n` +
                          `👤 **${player.name}** atteint le **NIVEAU ${player.level}** !\n` +
                          `❤️ Max HP +${hpBonus} (Restauré à 100% : ${newMaxHp}/${newMaxHp})\n` +
                          `🌀 Max MP +${mpBonus} (Restauré à 100% : ${newMaxMp}/${newMaxMp})\n` +
                          `📖 SP +${levelsGained * 5} Point(s) de compétence\n` +
                          `💪 Statistiques de combat améliorées (+2 partout)`
                });
            } catch (e) {
                console.error("[LevelUp Notification Error]", e.message);
            }
        }
        return true;
    }
    return false;
}

module.exports = { checkLevelUp };
