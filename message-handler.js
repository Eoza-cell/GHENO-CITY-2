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

    // 0. Puter GPT Image (primary — keyless OpenAI image API via auth token)
    try {
        const { generatePuterImage } = require('./puter-handler');
        if (require('./puter-handler').hasToken()) {
            const puterBuffer = await generatePuterImage(polishedPrompt);
            if (puterBuffer && puterBuffer.length > 1000) return puterBuffer;
        }
    } catch (e) {
        // Fall through to the local/HF pipelines
    }

    // 1. Local Python Diffusers execution if available
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

    // 1. Try Flagship Hugging Face Inference API models if token exists
    if (process.env.HF_TOKEN) {
        const hfModels = [
            "black-forest-labs/FLUX.1-dev",
            "black-forest-labs/FLUX.1-schnell",
            "cagliostrolab/animagine-xl-3.1",
            "stabilityai/stable-diffusion-3.5-large"
        ];
        for (const model of hfModels) {
            try {
                console.log(`[HF Flagship] Requesting high-resolution image from Hugging Face (${model})...`);
                const response = await axios.post(
                    `https://api-inference.huggingface.co/models/${model}`,
                    { inputs: polishedPrompt },
                    {
                        headers: {
                            Authorization: `Bearer ${process.env.HF_TOKEN}`,
                            "Content-Type": "application/json"
                        },
                        responseType: 'arraybuffer',
                        timeout: 30000
                    }
                );
                if (response.data && response.data.byteLength > 1000) {
                    return Buffer.from(response.data);
                }
            } catch (e) {
                console.warn(`[HF Flagship] Hugging Face model ${model} failed: ${e.message}`);
            }
        }
    }

    // 2. Public Flagship Hugging Face open inference endpoints fallback
    const publicHfEndpoints = [
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev",
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
        "https://api-inference.huggingface.co/models/cagliostrolab/animagine-xl-3.1"
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
        const cleanPrompt = String(prompt).replace(/[*_#\[\]]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 160);
        const esc = v => String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        const words = cleanPrompt.split(' ');
        const line1 = esc(words.slice(0, 9).join(' '));
        const line2 = esc(words.slice(9, 18).join(' '));
        const line3 = esc(words.slice(18, 26).join(' '));
        const svg = `
        <svg width="1024" height="768" viewBox="0 0 1024 768" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#120a24"/>
                    <stop offset="50%" stop-color="#0a0a18"/>
                    <stop offset="100%" stop-color="#050310"/>
                </linearGradient>
                <radialGradient id="halo" cx="50%" cy="38%" r="45%">
                    <stop offset="0%" stop-color="#7c4dff" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="#7c4dff" stop-opacity="0"/>
                </radialGradient>
                <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#d4af37"/>
                    <stop offset="50%" stop-color="#fff3c4"/>
                    <stop offset="100%" stop-color="#d4af37"/>
                </linearGradient>
                <linearGradient id="goldV" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#fff3c4"/>
                    <stop offset="100%" stop-color="#b8860b"/>
                </linearGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="b"/>
                    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="shadow" x="-20%" y="-20%" width="150%" height="160%">
                    <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#000000" flood-opacity="0.85"/>
                </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#bg)"/>
            <rect width="100%" height="100%" fill="url(#halo)"/>

            <g stroke="#7de8ff" stroke-opacity="0.05">
                ${Array.from({ length: 18 }).map((_, i) => `<line x1="${i * 62}" y1="0" x2="${i * 62 - 120}" y2="768"/>`).join('')}
            </g>

            <!-- Emblem -->
            <g filter="url(#glow)" transform="translate(512, 250)">
                <polygon points="0,-130 96,-42 60,96 0,130 -60,96 -96,-42" fill="#0b0720" stroke="url(#gold)" stroke-width="4"/>
                <polygon points="0,-104 74,-32 46,74 0,100 -46,74 -74,-32" fill="none" stroke="#00e5ff" stroke-width="1.6" opacity="0.6"/>
                <text x="0" y="26" font-family="'Segoe UI', sans-serif" font-size="86" font-weight="900" fill="url(#goldV)" text-anchor="middle">⚔</text>
            </g>

            <!-- Title -->
            <text x="512" y="470" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="40" fill="#ffffff" letter-spacing="8" filter="url(#glow)">AFTER THE REBIRTH</text>
            <text x="512" y="502" text-anchor="middle" font-family="monospace" font-size="15" fill="#7de8ff" letter-spacing="7">ATR OS • MANIFESTATION VISUELLE</text>
            <line x1="300" y1="524" x2="724" y2="524" stroke="url(#gold)" stroke-width="2" opacity="0.8"/>

            <!-- Prompt panel -->
            <g filter="url(#shadow)">
                <rect x="110" y="556" width="804" height="118" rx="14" fill="rgba(8, 6, 20, 0.9)" stroke="url(#gold)" stroke-width="2"/>
                <text x="140" y="596" font-family="'Segoe UI', sans-serif" font-size="19" fill="#f0f6fc">${line1}</text>
                <text x="140" y="626" font-family="'Segoe UI', sans-serif" font-size="19" fill="#f0f6fc">${line2}</text>
                <text x="140" y="656" font-family="'Segoe UI', sans-serif" font-size="19" fill="#f0f6fc">${line3}</text>
            </g>

            <text x="512" y="722" text-anchor="middle" font-family="monospace" font-size="12" fill="rgba(255,255,255,0.35)" letter-spacing="3">SIGNAL STABLE_FLUX • RENDU SVG DE SECOURS</text>
        </svg>`;
        return await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
    } catch (sErr) {
        console.error("[HF] SVG Fallback error:", sErr.message);
    }

    return null;
}

// Fallback functions for backward compatibility with other modules if they still try to call them
async function generateAnimeImage() { return null; }
function buildAnimePrompt(p) { return p; }

module.exports = { sendWithImage, generateHuggingFaceImage, generateAnimeImage, buildAnimePrompt, resolveMentions, shouldNotifyPlayer };
