const axios = require('axios');
const fs = require('fs');
const { generateImageVia9Router } = require('./ai-utils');

/**
 * Resolves player tags like @Name in the text and converts them to WhatsApp mentions.
 * @param {string} text
 * @returns {object} { text: string, mentions: string[] }
 */
async function resolveMentions(text) {
    if (!text) return { text: "", mentions: [] };
    const { Player } = require('./database');
    const mentions = [];

    // Fetch all players to match names against @tags
    const players = await Player.findAll({ attributes: ['name', 'whatsappId'] });

    let updatedText = text;
    for (const player of players) {
        // Match @Name (case insensitive, allowing spaces in name)
        const escapedName = player.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`@${escapedName}\\b`, 'gi');

        if (regex.test(updatedText)) {
            mentions.push(player.whatsappId);
        }
    }

    return { text: updatedText, mentions };
}

/**
 * Sends a message with an optional image from a local asset or direct URL.
 * AI Image generation is enabled via 9Router.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
async function sendWithImage(sock, jid, aiResponse) {
    let narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null) || "Il ne se passe rien.";
    const imagePrompt = aiResponse.imagePrompt;

    const { text, mentions } = await resolveMentions(narrative);

    if (imagePrompt) {
        try {
            // Local file path
            if (!imagePrompt.startsWith('http') && fs.existsSync(imagePrompt)) {
                const imageBuffer = fs.readFileSync(imagePrompt);
                await sock.sendMessage(jid, { image: imageBuffer, caption: text, mentions, mimetype: 'image/jpeg' });
                return;
            }

            // Direct URL (must be a valid image URL)
            if (imagePrompt.startsWith('http')) {
                const response = await axios.get(imagePrompt, {
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 15000
                });
                const imageBuffer = Buffer.from(response.data, 'binary');
                await sock.sendMessage(jid, { image: imageBuffer, caption: text, mentions, mimetype: 'image/jpeg' });
                return;
            }

            // If it's a text prompt, generate via 9Router
            console.log(`[IMG] Tentative de génération d'image pour: "${imagePrompt.substring(0, 50)}..."`);
            const generatedUrl = await generateImageVia9Router(imagePrompt);
            if (generatedUrl) {
                const response = await axios.get(generatedUrl, {
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 15000
                });
                const imageBuffer = Buffer.from(response.data, 'binary');
                await sock.sendMessage(jid, { image: imageBuffer, caption: text, mentions, mimetype: 'image/jpeg' });
                return;
            }
        } catch (error) {
            console.error(`[IMG] Erreur d'affichage d'image (${imagePrompt}):`, error.message);
        }
    }

    if (text) {
        await sock.sendMessage(jid, { text: text, mentions });
    }
}

// Fallback functions for backward compatibility with other modules if they still try to call them
async function generateAnimeImage() { return null; }
function buildAnimePrompt(p) { return p; }

module.exports = { sendWithImage, generateAnimeImage, buildAnimePrompt, resolveMentions };
