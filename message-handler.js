const axios = require('axios');

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
            // Check if it's a local file
            const fs = require('fs');
            if (fs.existsSync(imagePrompt) && !imagePrompt.startsWith('http')) {
                const imageBuffer = fs.readFileSync(imagePrompt);
                await sock.sendMessage(jid, { image: imageBuffer, caption: narrative, mimetype: 'image/jpeg' });
                return;
            }

            if (imagePrompt.startsWith('http')) {
                const response = await axios.get(imagePrompt, {
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const imageBuffer = Buffer.from(response.data, 'binary');
                await sock.sendMessage(jid, { image: imageBuffer, caption: narrative, mimetype: 'image/jpeg' });
                return;
            }

            // Image generation via Pollinations.ai (free, no auth).
            // The Puter.js browser SDK can't run in Node, so we don't use it here.
            console.log(`[IMG] Génération Pollinations pour : "${imagePrompt}"`);
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

module.exports = { sendWithImage };
