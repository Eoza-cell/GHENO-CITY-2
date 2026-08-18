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

/**
 * Sends a message with an optional image from a local asset or direct URL.
 * AI Image generation is DISABLED.
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
            // Direct Buffer
            if (Buffer.isBuffer(imagePrompt)) {
                await sock.sendMessage(jid, { image: imagePrompt, caption: text, mentions, mimetype: 'image/png' });
                return;
            }

            // Local file path
            if (typeof imagePrompt === 'string' && !imagePrompt.startsWith('http') && fs.existsSync(imagePrompt)) {
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

            // Generate using our beautiful Hugging Face image generator!
            if (typeof imagePrompt === 'string' && !imagePrompt.startsWith('http')) {
                console.log(`[IMG] Generating image on Hugging Face for prompt: "${imagePrompt}"...`);
                const imageBuffer = await generateHuggingFaceImage(imagePrompt);
                if (imageBuffer) {
                    await sock.sendMessage(jid, { image: imageBuffer, caption: text, mentions, mimetype: 'image/jpeg' });
                    return;
                }
            }
        } catch (error) {
            console.error(`[IMG] Erreur d'affichage d'image (${imagePrompt}):`, error.message);
        }
    }

    if (text) {
        await sock.sendMessage(jid, { text: text, mentions });
    }
}

/**
 * Beautiful image generator utilizing the Hugging Face Inference API
 * with a zero-config elegant Pollinations AI fallback.
 */
async function generateHuggingFaceImage(prompt) {
    const polishedPrompt = `${prompt}, anime style, beautiful digital illustration, high fantasy, highly detailed, vibrant colors, aesthetic masterpiece`;

    // 0. Try local Python Krea Diffusers execution if available
    try {
        const { execSync } = require('child_process');
        const path = require('path');
        const tmpOut = path.join(__dirname, 'assets', `krea_out_${Date.now()}.png`);
        const pyScript = path.join(__dirname, 'generate_krea_image.py');
        execSync(`python3 "${pyScript}" "${polishedPrompt.replace(/"/g, '')}" "${tmpOut}"`, { timeout: 15000, stdio: 'ignore' });
        if (fs.existsSync(tmpOut)) {
            const buf = fs.readFileSync(tmpOut);
            fs.unlinkSync(tmpOut);
            return buf;
        }
    } catch (pyErr) {
        // Fallback silently to HF Inference API or Pollinations
    }

    // 1. Try Hugging Face Inference API if token exists
    if (process.env.HF_TOKEN) {
        try {
            console.log("[HF] Requesting image from Hugging Face Inference API (krea/Krea-2-Turbo)...");
            const response = await axios.post(
                "https://api-inference.huggingface.co/models/krea/Krea-2-Turbo",
                { inputs: polishedPrompt },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.HF_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    responseType: 'arraybuffer',
                    timeout: 20000
                }
            );
            if (response.data && response.data.byteLength > 1000) {
                return Buffer.from(response.data);
            }
        } catch (e) {
            console.warn("[HF] Hugging Face Inference failed, falling back to Pollinations:", e.message);
        }
    }

    // 2. Fallback/Default: Pollinations AI (highly resilient, gorgeous, zero config)
    try {
        console.log("[HF] Requesting image from Pollinations AI fallback...");
        const response = await axios.get(
            `https://image.pollinations.ai/prompt/${encodeURIComponent(polishedPrompt)}?width=1024&height=768&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`,
            {
                responseType: 'arraybuffer',
                timeout: 20000
            }
        );
        if (response.data && response.data.byteLength > 1000) {
            return Buffer.from(response.data);
        }
    } catch (e) {
        console.error("[HF] Fallback image generation also failed:", e.message);
    }
    return null;
}

// Fallback functions for backward compatibility with other modules if they still try to call them
async function generateAnimeImage() { return null; }
function buildAnimePrompt(p) { return p; }

module.exports = { sendWithImage, generateHuggingFaceImage, generateAnimeImage, buildAnimePrompt, resolveMentions, shouldNotifyPlayer };
