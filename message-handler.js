const axios = require('axios');
let puter = null;

function initPuter() {
    if (!puter) {
        try {
            const puterJS = require('@heyputer/puter.js');
            puter = puterJS.default || puterJS.puter || puterJS;
            if (process.env.PUTER_API_KEY && process.env.PUTER_API_KEY !== 'test_key') {
                puter.setAuthToken(process.env.PUTER_API_KEY);
            }
        } catch (e) {
            console.error("[IMG] Erreur chargement Puter.js:", e.message);
        }
    }
    return puter;
}

/**
 * Sends a message with an optional AI-generated image.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
async function sendLoadingSequence(sock, jid) {
    try {
        const sent = await sock.sendMessage(jid, { text: "⚽ ▱▱▱▱▱▱▱▱▱▱ 0%" });

        // We run the animation in the background so it doesn't block the main AI call
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

async function sendWithVideo(sock, jid, aiResponse) {
    const narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null) || "Il ne se passe rien.";
    const videoPrompt = aiResponse.videoPrompt;

    if (videoPrompt) {
        try {
            const puterInstance = initPuter();
            if (puterInstance) {
                console.log(`[VID] Génération Vidéo Puter pour : "${videoPrompt}"`);
                // Model sora-2 is default. We use test_mode: false for real results.
                const video = await puterInstance.ai.txt2vid(videoPrompt, { seconds: 4 });

                if (video?.error) throw new Error(video.message || "Puter Video Error");

                let buffer;
                if (typeof video === 'string') {
                    if (video.includes('base64,')) {
                        buffer = Buffer.from(video.split('base64,')[1], 'base64');
                    } else if (video.startsWith('http')) {
                        const res = await axios.get(video, { responseType: 'arraybuffer' });
                        buffer = Buffer.from(res.data);
                    } else {
                        buffer = Buffer.from(video, 'base64');
                    }
                } else if (Buffer.isBuffer(video)) {
                    buffer = video;
                } else if (video && video.src) {
                    // In some environments, it might return an object with a src (URL)
                    const res = await axios.get(video.src, { responseType: 'arraybuffer' });
                    buffer = Buffer.from(res.data);
                }

                if (buffer) {
                    await sock.sendMessage(jid, { video: buffer, caption: narrative, mimetype: 'video/mp4' });
                    return;
                }
            }
        } catch (error) {
            console.error(`[VID] Erreur vidéo:`, error.message);
        }
    }

    if (narrative) {
        await sock.sendMessage(jid, { text: narrative });
    }
}

module.exports = { sendWithVideo, sendLoadingSequence };
