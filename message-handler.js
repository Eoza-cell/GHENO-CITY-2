const axios = require('axios');
let puter = null;

function initPuter() {
    if (!puter && process.env.PUTER_API_KEY && process.env.PUTER_API_KEY !== 'test_key') {
        try {
            const puterJS = require('@heyputer/puter.js');
            puter = puterJS.default || puterJS.puter || puterJS;
            puter.setAuthToken(process.env.PUTER_API_KEY);
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
        const frames = [
            "⚽ ▰▱▱▱▱▱▱▱▱▱ 10%",
            "⚽ ▰▰▰▱▱▱▱▱▱▱ 30%",
            "⚽ ▰▰▰▰▰▱▱▱▱▱ 50%",
            "⚽ ▰▰▰▰▰▰▰▱▱▱ 70%",
            "⚽ ▰▰▰▰▰▰▰▰▰▱ 90%",
            "⚽ ▰▰▰▰▰▰▰▰▰▰ 100%"
        ];

        for (const frame of frames) {
            await new Promise(r => setTimeout(r, 300));
            try {
                await sock.sendMessage(jid, { text: frame, edit: sent.key });
            } catch (e) {
                // If edit fails, we just stop the sequence to avoid crashing
                break;
            }
        }
        return sent;
    } catch (e) {
        console.error("[MSG] Error in loading sequence:", e.message);
        return null;
    }
}

async function sendWithImage(sock, jid, aiResponse) {
    const narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null) || "Il ne se passe rien.";
    const imagePrompt = aiResponse.imagePrompt;

    if (imagePrompt) {
        try {
            if (imagePrompt.startsWith('http')) {
                const response = await axios.get(imagePrompt, {
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const imageBuffer = Buffer.from(response.data, 'binary');
                await sock.sendMessage(jid, { image: imageBuffer, caption: narrative, mimetype: 'image/jpeg' });
                return;
            }

            // Primary: Puter (Flux.1-schnell)
            const puterInstance = initPuter();
            if (puterInstance) {
                try {
                    console.log(`[IMG] Génération Puter (Flux) pour : "${imagePrompt}"`);
                    const img = await puterInstance.ai.txt2img(imagePrompt);

                    if (img?.error) throw new Error(img.message || "Puter Image Error");

                    let buffer;
                    // Handle various Puter image return formats (Blob-like or DataURI string)
                    if (typeof img === 'string') {
                        if (img.includes('base64,')) {
                            buffer = Buffer.from(img.split('base64,')[1], 'base64');
                        } else {
                            buffer = Buffer.from(img, 'base64');
                        }
                    } else if (img.toString) {
                        const imgStr = img.toString();
                        if (imgStr.includes('base64,')) {
                            buffer = Buffer.from(imgStr.split('base64,')[1], 'base64');
                        } else {
                            buffer = Buffer.from(imgStr, 'base64');
                        }
                    }

                    if (buffer) {
                        await sock.sendMessage(jid, { image: buffer, caption: narrative, mimetype: 'image/jpeg' });
                        return;
                    }
                } catch (puterError) {
                    console.error("[IMG] Échec Puter:", puterError.message || puterError);
                }
            }

            // Fallback: Pollinations.ai
            console.log(`[IMG] Fallback Pollinations pour : "${imagePrompt}"`);
            const encodedPrompt = encodeURIComponent(imagePrompt);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const imageBuffer = Buffer.from(response.data, 'binary');
            await sock.sendMessage(jid, { image: imageBuffer, caption: narrative, mimetype: 'image/jpeg' });
            return;
        } catch (error) {
            console.error(`[IMG] Erreur totale:`, error.message);
        }
    }

    if (narrative) {
        await sock.sendMessage(jid, { text: narrative });
    }
}

module.exports = { sendWithImage, sendLoadingSequence };
