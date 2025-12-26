const axios = require('axios');

/**
 * Sends a message with an optional AI-generated image from Pollinations.ai.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
async function sendWithImage(sock, jid, aiResponse) {
    const narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null) || "Il ne se passe rien.";
    const imagePrompt = aiResponse.imagePrompt;

    if (imagePrompt) {
        try {
            // URL-encode the prompt to handle special characters
            const encodedPrompt = encodeURIComponent(imagePrompt);
            const imageUrl = `https://text.pollinations.ai/${encodedPrompt}`;
            console.log(`Génération d'image (Pollinations.ai) pour le prompt : "${imagePrompt}" | URL: ${imageUrl}`);

            // Fetch the image as a buffer
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data, 'binary');

            if (imageBuffer && imageBuffer.length > 0) {
                await sock.sendMessage(jid, {
                    image: imageBuffer,
                    caption: narrative
                });
                return;
            } else {
                console.error("La génération d'image a échoué (buffer vide). Envoi du texte seul.");
            }
        } catch (error) {
            console.error(`Erreur lors de la génération de l'image (Pollinations.ai):`, {
                message: error.message,
                status: error.response?.status
            });
        }
    }

    if (narrative) {
        await sock.sendMessage(jid, { text: narrative });
    }
}

module.exports = { sendWithImage };
