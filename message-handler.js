const axios = require('axios');
let puter = null;

function initPuter() {
    if (!puter && process.env.PUTER_API_KEY && process.env.PUTER_API_KEY !== 'test_key') {
        try {
            puter = require('@heyputer/puter.js').default || require('@heyputer/puter.js');
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
async function sendWithImage(sock, jid, aiResponse) {
    const narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null) || "Il ne se passe rien.";
    const imagePrompt = aiResponse.imagePrompt;

    let imageSent = false;

    if (imagePrompt) {
        try {
            // ONLY LOCAL FILES OR DIRECT URLS. GENERATION IS DISABLED.
            const fs = require('fs');
            if (fs.existsSync(imagePrompt) && !imagePrompt.startsWith('http')) {
                const imageBuffer = fs.readFileSync(imagePrompt);
                await sock.sendMessage(jid, { image: imageBuffer, caption: narrative, mimetype: 'image/jpeg' });
                imageSent = true;
            } else if (imagePrompt.startsWith('http')) {
                const response = await axios.get(imagePrompt, {
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 10000
                });
                const imageBuffer = Buffer.from(response.data, 'binary');
                await sock.sendMessage(jid, { image: imageBuffer, caption: narrative, mimetype: 'image/jpeg' });
                imageSent = true;
            }
        } catch (error) {
            console.error(`[IMG] Error:`, error.message);
        }
    }

    // Fallback: send text if no image was successfully sent
    if (!imageSent && narrative) {
        const cleanNarrative = narrative
            .replace(/data:\s*\[DONE\]/gi, "")
            .replace(/data:\s*\{.*?\}/gi, "")
            .replace(/data:\s*/gi, "")
            .trim();

        if (cleanNarrative.length > 0) {
            await sock.sendMessage(jid, { text: cleanNarrative });
        }
    }
}

module.exports = { sendWithImage };
