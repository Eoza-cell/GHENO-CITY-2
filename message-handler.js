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
    const polishedPrompt = `${prompt}, anime style, beautiful digital illustration, high fantasy masterpiece, highly detailed, vibrant colors, aesthetic masterpiece, 8k resolution`;

    // 0. Try local Python Diffusers execution if available
    try {
        const { execSync } = require('child_process');
        const path = require('path');
        const tmpOut = path.join(__dirname, 'assets', `gen_out_${Date.now()}.png`);
        const pyScript = path.join(__dirname, 'generate_krea_image.py');
        execSync(`python3 "${pyScript}" "${polishedPrompt.replace(/"/g, '')}" "${tmpOut}"`, { timeout: 25000, stdio: 'ignore' });
        if (fs.existsSync(tmpOut)) {
            const buf = fs.readFileSync(tmpOut);
            fs.unlinkSync(tmpOut);
            return buf;
        }
    } catch (pyErr) {
        // Fallback silently to HF Inference API or Pollinations
    }

    // 1. Try Hugging Face Inference API models if token exists
    if (process.env.HF_TOKEN) {
        const hfModels = [
            "cagliostrolab/animagine-xl-3.1",
            "black-forest-labs/FLUX.1-schnell",
            "krea/Krea-2-Turbo"
        ];
        for (const model of hfModels) {
            try {
                console.log(`[HF] Requesting image from Hugging Face Inference API (${model})...`);
                const response = await axios.post(
                    `https://api-inference.huggingface.co/models/${model}`,
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
                console.warn(`[HF] Hugging Face Inference for ${model} failed: ${e.message}`);
            }
        }
    }

    // 2. Public Hugging Face open inference endpoints fallback
    const publicHfEndpoints = [
        "https://api-inference.huggingface.co/models/cagliostrolab/animagine-xl-3.1",
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
    ];

    for (const endpoint of publicHfEndpoints) {
        try {
            console.log(`[HF] Requesting image from Hugging Face Inference endpoint: ${endpoint}...`);
            const response = await axios.post(
                endpoint,
                { inputs: polishedPrompt },
                {
                    headers: { "Content-Type": "application/json" },
                    responseType: 'arraybuffer',
                    timeout: 25000
                }
            );
            if (response.data && response.data.byteLength > 1000) {
                return Buffer.from(response.data);
            }
        } catch (e) {
            console.warn(`[HF] Public endpoint ${endpoint} failed: ${e.message}`);
        }
    }

    // 3. Render High-Res SVG Card Fallback via Sharp
    try {
        const sharp = require('sharp');
        const cleanPrompt = prompt.replace(/[*_#\[\]]/g, ' ').substring(0, 120);
        const svg = `
        <svg width="1024" height="768" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0a0e17"/>
                    <stop offset="50%" stop-color="#161b26"/>
                    <stop offset="100%" stop-color="#050811"/>
                </linearGradient>
                <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#d4af37"/>
                    <stop offset="100%" stop-color="#fff8dc"/>
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#bg)"/>
            <rect x="40" y="40" width="944" height="688" rx="16" fill="none" stroke="url(#gold)" stroke-width="4"/>
            <text x="512" y="120" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="32" fill="#ffd700" letter-spacing="3">AFTER THE REBIRTH (ATR)</text>
            <text x="512" y="170" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="18" fill="#8b949e" letter-spacing="1">HUGGING FACE TRANSFORMERS VISUAL ENGINE</text>
            <circle cx="512" cy="380" r="140" fill="#1f293d" stroke="#d4af37" stroke-width="3"/>
            <text x="512" y="395" text-anchor="middle" font-size="72">⚔️</text>
            <rect x="80" y="580" width="864" height="110" rx="12" fill="#0d1117" opacity="0.9" stroke="#d4af37" stroke-width="2"/>
            <text x="512" y="640" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="20" fill="#f0f6fc">${cleanPrompt}</text>
        </svg>`;
        return await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
    } catch (sErr) {
        console.error("[HF] SVG Fallback error:", sErr.message);
    }

    return null;
}

// Fallback functions for backward compatibility with other modules if they still try to call them
async function generateAnimeImage() { return null; }
function buildAnimePrompt(p) { return p; }

module.exports = { sendWithImage, generateHuggingFaceImage, generateAnimeImage, buildAnimePrompt, resolveMentions, shouldNotifyPlayer };
