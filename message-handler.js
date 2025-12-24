const { Puter } = require('@heyputer/puter.js');

/**
 * Converts a data URL to a Buffer.
 * @param {string} dataUrl The data URL to convert.
 * @returns {Buffer} The resulting buffer.
 */
function dataUrlToBuffer(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    return Buffer.from(base64, 'base64');
}

/**
 * Sends a message with an optional AI-generated image using Puter.js.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
async function sendWithImage(sock, jid, aiResponse) {
    const puter = new Puter();
    const narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null) || "Il ne se passe rien.";
    const imagePrompt = aiResponse.imagePrompt;

    if (imagePrompt) {
        try {
            console.log(`Génération d'image (Puter.js) pour le prompt : "${imagePrompt}"`);
            const imageDataUrl = await puter.ai.txt2img(imagePrompt, { model: "nano-banana" });
            const imageBuffer = dataUrlToBuffer(imageDataUrl);

            if (imageBuffer) {
                await sock.sendMessage(jid, {
                    image: imageBuffer,
                    caption: narrative
                });
                return;
            } else {
                console.error("La génération d'image a échoué (buffer vide). Envoi du texte seul.");
            }
        } catch (error) {
            console.error(`Erreur lors de la génération de l'image (Puter.js):`, error);
        }
    }

    if (narrative) {
        await sock.sendMessage(jid, { text: narrative });
    }
}

module.exports = { sendWithImage };
