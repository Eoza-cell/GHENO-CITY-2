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
 * Sends a message with an optional AI-generated image.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
const delay = ms => new Promise(res => setTimeout(res, ms));

async function sendLoadingSequence(sock, jid) {
    try {
        const steps = [
            { label: "Synchronisation", progress: 10 },
            { label: "Détection du Ki", progress: 30 },
            { label: "Analyse environnementale", progress: 50 },
            { label: "Appel du Dragon", progress: 80 },
            { label: "Chargement terminé", progress: 100 }
        ];

        let { key } = await sock.sendMessage(jid, { text: "🐉 *Initialisation de la connexion...*" });

        for (const step of steps) {
            const barLength = 10;
            const filled = Math.round((step.progress / 100) * barLength);
            const bar = "▰".repeat(filled) + "▱".repeat(barLength - filled);

            const message = `🐉 *GENETWORK RP*\n\n` +
                          `⚙️ *${step.label}...*\n` +
                          `[${bar}] ${step.progress}%\n\n` +
                          `_Veuillez patienter..._`;

            await sock.sendMessage(jid, { text: message, edit: key });
            await delay(400);
        }

        return key;
    } catch (e) {
        console.error("Erreur loading sequence:", e);
        return null;
    }
}

async function sendWithImage(sock, jid, aiResponse, loadingKey = null) {
    let narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null);

    // Safety check: if narrative is still missing but we have actions, don't show the JSON
    if (!narrative && aiResponse.actions && aiResponse.actions.length > 0) {
        narrative = "L'action s'accomplit dans un éclat de lumière...";
    }

    if (!narrative) narrative = "Le silence retombe sur le monde.";

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
        if (loadingKey) {
            await sock.sendMessage(jid, { text: narrative, edit: loadingKey });
        } else {
            await sock.sendMessage(jid, { text: narrative });
        }
    }
}

module.exports = { sendWithImage, sendLoadingSequence };
