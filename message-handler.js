const axios = require('axios');
let puter = null;

function initPuter() {
    if (!puter && process.env.PUTER_API_KEY && process.env.PUTER_API_KEY !== 'test_key') {
        try {
            puter = require('@heyputer/puter.js').default;
            puter.setAuthToken(process.env.PUTER_API_KEY);
        } catch (e) {
            console.error("[IMG] Erreur chargement Puter.js:", e.message);
        }
    }
    return puter;
}

/**
 * Sends a loading sequence that modifies itself before the final response.
 */
async function sendLoadingSequence(sock, jid) {
    const steps = [
        "🌐 Connexion au Gheno Network...",
        "📡 Synchronisation du GPS urbain...",
        "🗂️ Analyse de la base de données criminelle...",
        "🔋 MJ en cours de réflexion..."
    ];

    let { key } = await sock.sendMessage(jid, { text: steps[0] });

    for (let i = 1; i < steps.length; i++) {
        await new Promise(r => setTimeout(r, 800));
        await sock.sendMessage(jid, { edit: key, text: steps[i] });
    }

    return key;
}

/**
 * Sends a message with an optional AI-generated image.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
async function sendWithImage(sock, jid, aiResponse, editKey = null) {
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
                    const imgStr = img.toString();
                    let buffer;
                    if (imgStr.includes(',')) {
                        buffer = Buffer.from(imgStr.split(',')[1], 'base64');
                    } else {
                        buffer = Buffer.from(imgStr, 'base64');
                    }
                    await sock.sendMessage(jid, { image: buffer, caption: narrative, mimetype: 'image/jpeg' });
                    return;
                } catch (puterError) {
                    console.error("[IMG] Échec Puter:", puterError.message);
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
        if (editKey) {
            await sock.sendMessage(jid, { edit: editKey, text: narrative });
        } else {
            await sock.sendMessage(jid, { text: narrative });
        }
    }
}

module.exports = { sendWithImage, sendLoadingSequence };
