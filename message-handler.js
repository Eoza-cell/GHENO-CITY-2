const axios = require('axios');

/**
 * MESSAGE HANDLER - Football Career Pro
 * Simplified text-only handler
 */

async function sendLoadingSequence(sock, jid) {
    try {
        const sent = await sock.sendMessage(jid, { text: "⚽ ▱▱▱▱▱▱▱▱▱▱ 0%" });

        (async () => {
            const frames = [
                "⚽ ▰▱▱▱▱▱▱▱▱▱ 10%",
                "⚽ ▰▰▰▱▱▱▱▱▱▱ 30%",
                "⚽ ▰▰▰▰▰▱▱▱▱▱ 50%",
                "⚽ ▰▰▰▰▰▰▰▱▱▱ 70%",
                "⚽ ▰▰▰▰▰▰▰▰▰▱ 90%",
                "⚽ ▰▰▰▰▰▰▰▰▰▰ 100%"
            ];

            for (const frame of frames) {
                await new Promise(r => setTimeout(r, 400));
                try {
                    await sock.sendMessage(jid, { text: frame, edit: sent.key }).catch(() => null);
                } catch (e) {
                    break;
                }
            }
        })();

        return sent;
    } catch (e) {
        console.error("[MSG] Error in loading sequence:", e.message);
        return null;
    }
}

// Media generation is disabled as requested
async function sendWithVideo(sock, jid, aiResponse) {
    const narrative = aiResponse.narrative || "Il ne se passe rien.";
    await sock.sendMessage(jid, { text: narrative });
}

module.exports = { sendWithVideo, sendLoadingSequence };
