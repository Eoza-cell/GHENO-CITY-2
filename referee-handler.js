const { Player } = require('./database');
const { callRefereeAI } = require('./ai-handler');

/**
 * Starts the 6-minute timer for writing a "pavé".
 */
async function startPaveTimer(sock, player, remoteJid) {
    if (player.paveStatus === 'writing') {
        await sock.sendMessage(remoteJid, { text: "Tu as déjà un chronomètre en cours !" });
        return;
    }

    await player.update({ paveStatus: 'writing' });

    let timeLeft = 6 * 60; // 6 minutes in seconds
    const initialText = `⏳ *CHRONO ARBITRE : 06:00*\n\nÉcris ton pavé maintenant. Tu as 6 minutes pour soumettre ton action RP.`;

    const sentMsg = await sock.sendMessage(remoteJid, { text: initialText });

    // Store message key to possibly edit or reference it later
    const messageKey = JSON.stringify(sentMsg.key);
    await player.update({ paveMessageKey: messageKey });

    const interval = setInterval(async () => {
        timeLeft -= 30; // Update every 30 seconds to be friendly to rate limits

        // Reload player to check if they finished early
        const p = await Player.findByPk(player.whatsappId);
        if (!p || p.paveStatus !== 'writing') {
            clearInterval(interval);
            return;
        }

        if (timeLeft <= 0) {
            clearInterval(interval);
            await p.update({ paveStatus: 'idle', paveMessageKey: null });
            await sock.sendMessage(remoteJid, {
                text: "⏰ *TEMPS ÉCOULÉ !* Le délai de 6 minutes est dépassé. Ton action n'a pas été soumise à temps.",
                edit: sentMsg.key
            });
            return;
        }

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        await sock.sendMessage(remoteJid, {
            text: `⏳ *CHRONO ARBITRE : ${timeStr}*\n\nÉcris ton pavé maintenant.`,
            edit: sentMsg.key
        }).catch(err => {
            console.error("Error updating timer:", err);
            clearInterval(interval);
        });
    }, 30000);
}

/**
 * Analyzes the submitted text and calculates energy costs.
 */
async function evaluatePave(sock, player, remoteJid, text) {
    // Immediate feedback
    await sock.sendMessage(remoteJid, { text: "🔍 *Analyse de l'Arbitre en cours...*" });

    try {
        const response = await callRefereeAI(player, text);

        const totalCost = response.totalCost || 0;

        // Update player stats
        await player.decrement('mana', { by: totalCost });
        await player.update({ paveStatus: 'idle', paveMessageKey: null });

        let replyText = `${response.validation} *ARBITRAGE TERMINÉ*\n\n`;
        replyText += `📝 *ANALYSE :* ${response.analysis}\n\n`;

        if (response.breakdown && response.breakdown.length > 0) {
            replyText += `⚔️ *DÉTAILS DU COÛT :*\n`;
            response.breakdown.forEach(b => {
                replyText += `├ ${b.action} (${b.cat}) : ${b.cost} PM\n`;
            });
            replyText += `\n`;
        }

        replyText += `📉 *COÛT TOTAL :* ${totalCost} PM\n`;

        // Reload player for up-to-date mana
        await player.reload();
        replyText += `🔷 *ÉNERGIE ACTUELLE :* ${player.mana}/${player.maxMana}`;

        await sock.sendMessage(remoteJid, { text: replyText });

    } catch (error) {
        console.error("Error in evaluatePave:", error);
        await player.update({ paveStatus: 'idle', paveMessageKey: null });
        await sock.sendMessage(remoteJid, { text: "❌ Une erreur est survenue lors de l'arbitrage." });
    }
}

module.exports = { startPaveTimer, evaluatePave };
