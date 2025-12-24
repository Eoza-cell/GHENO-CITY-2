const { generateImage } = require('./image-generator');

/**
 * Sends a message with an optional AI-generated image.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
async function sendWithImage(sock, jid, aiResponse) {
    const narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null) || "Il ne se passe rien.";
    const imagePrompt = aiResponse.imagePrompt;

    // If there is an image prompt, attempt to generate and send the image
    if (imagePrompt) {
        try {
            console.log(`Génération d'image pour le prompt : "${imagePrompt}"`);
            const imageBuffer = await generateImage(imagePrompt);

            if (imageBuffer) {
                await sock.sendMessage(jid, {
                    image: imageBuffer,
                    caption: narrative
                });
                return; // Exit after successful send
            } else {
                console.error("La génération d'image a échoué (buffer vide). Envoi du texte seul.");
            }
        } catch (error) {
            console.error(`Erreur lors de la génération de l'image pour le prompt: "${imagePrompt}"`, error);
            // Fall through to send text only if image generation fails
        }
    }

    // Fallback: If there's no image prompt or if generation failed, send the narrative as a plain text message.
    if (narrative) {
        await sock.sendMessage(jid, { text: narrative });
    }
}

module.exports = { sendWithImage };
