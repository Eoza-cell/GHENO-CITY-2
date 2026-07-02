const axios = require('axios');
const fs = require('fs');

// Inactivity threshold for private notifications (24 hours)
const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Checks if a player should receive a private notification based on their last activity.
 * This prevents spamming inactive players.
 * @param {object} player Sequelize Player instance
 * @returns {boolean}
 */
function shouldNotifyPlayer(player) {
    if (!player || !player.lastActivity) return true;
    const now = Date.now();
    const lastActivity = new Date(player.lastActivity).getTime();
    return (now - lastActivity) < INACTIVITY_THRESHOLD_MS;
}

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

const sdxl = require('./sdxl-generator');

/**
 * Sends a message with an optional image from a local asset or direct URL.
 * Re-enabled image generation using SDXL (Flux).
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
async function sendWithImage(sock, jid, aiResponse) {
    console.log(`[MSG] Envoi de la réponse à ${jid}...`);
    let narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null) || "Il ne se passe rien.";
    let imagePrompt = aiResponse.imagePrompt;

    const { text, mentions } = await resolveMentions(narrative);

    if (imagePrompt) {
        try {
            // Case 1: Direct Buffer (e.g. from local generators)
            if (Buffer.isBuffer(imagePrompt)) {
                await sock.sendMessage(jid, { image: imagePrompt, caption: text, mentions, mimetype: 'image/png' });
                return;
            }

            // Case 2: Local file path
            if (typeof imagePrompt === 'string' && !imagePrompt.startsWith('http') && fs.existsSync(imagePrompt)) {
                const imageBuffer = fs.readFileSync(imagePrompt);
                await sock.sendMessage(jid, { image: imageBuffer, caption: text, mentions, mimetype: 'image/jpeg' });
                return;
            }

            // Case 3: Direct URL (must be a valid image URL)
            if (typeof imagePrompt === 'string' && imagePrompt.startsWith('http')) {
                const response = await axios.get(imagePrompt, {
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 15000
                });
                const imageBuffer = Buffer.from(response.data, 'binary');
                await sock.sendMessage(jid, { image: imageBuffer, caption: text, mentions, mimetype: 'image/jpeg' });
                return;
            }

            // Case 4: Text Prompt -> Generate via SDXL
            if (typeof imagePrompt === 'string' && imagePrompt.length > 5) {
                const generatedUrl = sdxl.generateImageUrl(imagePrompt);
                const response = await axios.get(generatedUrl, {
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    timeout: 20000
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
        try {
            await sock.sendMessage(jid, { text: text, mentions });
            console.log(`[MSG] Texte envoyé avec succès à ${jid}.`);
        } catch (e) {
            console.error(`[MSG] ❌ Échec envoi texte à ${jid}:`, e.message);
            // One retry for critical narrative
            try {
                await delay(1000);
                await sock.sendMessage(jid, { text: text, mentions });
            } catch (retryErr) {
                console.error(`[MSG] ❌ Échec second essai:`, retryErr.message);
            }
        }
    }
}

// Fallback functions for backward compatibility with other modules if they still try to call them
async function generateAnimeImage() { return null; }
function buildAnimePrompt(p) { return p; }

module.exports = { sendWithImage, generateAnimeImage, buildAnimePrompt, resolveMentions, shouldNotifyPlayer };
