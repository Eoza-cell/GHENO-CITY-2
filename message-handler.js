const axios = require('axios');
const puter = require('@heyputer/puter.js').default;

if (process.env.PUTER_API_KEY) {
    puter.setAuthToken(process.env.PUTER_API_KEY);
}

/**
 * Sends a message with an optional AI-generated image.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
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
                await sock.sendMessage(jid, { image: imageBuffer, caption: narrative });
                return;
            }

            // Primary: Puter (Flux.1-schnell)
            if (process.env.PUTER_API_KEY) {
                try {
                    console.log(`[IMG] Génération Puter (Flux) pour : "${imagePrompt}"`);
                    const img = await puter.ai.txt2img(imagePrompt);
                    const buffer = Buffer.from(img.toString().split(',')[1], 'base64');
                    await sock.sendMessage(jid, { image: buffer, caption: narrative });
                    return;
                } catch (puterError) {
                    console.error("[IMG] Échec Puter:", puterError.message);
                }
            }

            // Fallback: Pollinations.ai
            console.log(`[IMG] Fallback Pollinations pour : "${imagePrompt}"`);
            const encodedPrompt = encodeURIComponent(imagePrompt);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const imageBuffer = Buffer.from(response.data, 'binary');
            await sock.sendMessage(jid, { image: imageBuffer, caption: narrative });
            return;
        } catch (error) {
            console.error(`[IMG] Erreur totale:`, error.message);
        }
    }

    if (narrative) {
        await sock.sendMessage(jid, { text: narrative });
    }
}

module.exports = { sendWithImage };
