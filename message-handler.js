const axios = require('axios');

const PUTER_API_URL = "https://api.puter.com/drivers/call";
// Image models to try on Puter (in order). Falls back to Pollinations if none work.
// gpt-image-1 is the model confirmed available on the account; dall-e-* are not.
const PUTER_IMAGE_MODELS = ["gpt-image-1"];

// Anime style keywords appended to every generated prompt for consistent quality.
const ANIME_STYLE_SUFFIX =
    "anime style, high quality anime illustration, vibrant colors, detailed shading, " +
    "cinematic lighting, manga aesthetic, sharp lineart, dynamic composition, 4k";

/**
 * Enriches a raw image prompt with anime-style descriptors.
 * @param {string} prompt
 * @returns {string}
 */
function buildAnimePrompt(prompt) {
    const clean = String(prompt || '').trim();
    if (!clean) return ANIME_STYLE_SUFFIX;
    if (/anime/i.test(clean)) return clean; // already styled
    return `${clean}, ${ANIME_STYLE_SUFFIX}`;
}

/**
 * Decode a data URL (data:image/...;base64,xxxx) into a Buffer.
 */
function dataUrlToBuffer(dataUrl) {
    const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.*)$/.exec(dataUrl);
    if (!match) return null;
    return Buffer.from(match[1], 'base64');
}

/**
 * Try generating an anime image via Puter's HTTP image-generation driver.
 * Requires PUTER_API_KEY. Returns a Buffer or null on failure.
 */
async function generateViaPuter(prompt) {
    const key = process.env.PUTER_API_KEY;
    if (!key || key.length < 6) return null;

    for (const model of PUTER_IMAGE_MODELS) {
        try {
            console.log(`[IMG] Puter HTTP - Modèle image: ${model}`);
            const resp = await axios.post(PUTER_API_URL, {
                interface: "puter-image-generation",
                method: "generate",
                args: { prompt, model }
            }, {
                headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                timeout: 60000
            });

            if (resp.data?.success === false) {
                console.warn(`[IMG] Puter ${model} erreur:`, resp.data?.error);
                continue;
            }

            const result = resp.data?.result;
            // Result can be a data URL string, an object with a url, or a base64 string.
            if (typeof result === 'string') {
                if (result.startsWith('data:image')) return dataUrlToBuffer(result);
                if (result.startsWith('http')) {
                    const img = await axios.get(result, { responseType: 'arraybuffer' });
                    return Buffer.from(img.data, 'binary');
                }
            }
            const url = result?.url || result?.image_url || result?.data?.[0]?.url;
            if (url) {
                const img = await axios.get(url, { responseType: 'arraybuffer' });
                return Buffer.from(img.data, 'binary');
            }
            const b64 = result?.b64_json || result?.data?.[0]?.b64_json;
            if (b64) return Buffer.from(b64, 'base64');
        } catch (e) {
            console.warn(`[IMG] Puter image ${model} échec:`, e.response?.data?.error || e.message);
            continue;
        }
    }
    return null;
}

/**
 * Generate an anime image via Pollinations.ai (free, no auth). Returns a Buffer or null.
 */
async function generateViaPollinations(prompt) {
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`[IMG] Génération Pollinations (essai ${attempt}) pour : "${prompt}"`);
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 90000
            });
            return Buffer.from(response.data, 'binary');
        } catch (error) {
            const status = error.response?.status;
            // 402/429 = per-IP queue/rate limit; wait and retry.
            if ((status === 402 || status === 429) && attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, 3000 * attempt));
                continue;
            }
            console.error(`[IMG] Pollinations échec:`, error.message);
            return null;
        }
    }
    return null;
}

/**
 * Generate an anime image from a text prompt: Puter HTTP first, then Pollinations.
 * @param {string} rawPrompt
 * @returns {Promise<Buffer|null>}
 */
async function generateAnimeImage(rawPrompt) {
    const prompt = buildAnimePrompt(rawPrompt);
    const viaPuter = await generateViaPuter(prompt);
    if (viaPuter) return viaPuter;
    return generateViaPollinations(prompt);
}

/**
 * Sends a message with an optional AI-generated image.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {object} aiResponse The JSON response from the AI handler.
 */
async function sendWithImage(sock, jid, aiResponse) {
    const narrative = aiResponse.narrative || (aiResponse.parameters ? aiResponse.parameters.reason : null) || "Il ne se passe rien.";
    const imagePrompt = aiResponse.imagePrompt;

    if (imagePrompt) {
        try {
            const fs = require('fs');
            // Local file path
            if (!imagePrompt.startsWith('http') && fs.existsSync(imagePrompt)) {
                const imageBuffer = fs.readFileSync(imagePrompt);
                await sock.sendMessage(jid, { image: imageBuffer, caption: narrative, mimetype: 'image/jpeg' });
                return;
            }

            // Direct URL
            if (imagePrompt.startsWith('http')) {
                const response = await axios.get(imagePrompt, {
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const imageBuffer = Buffer.from(response.data, 'binary');
                await sock.sendMessage(jid, { image: imageBuffer, caption: narrative, mimetype: 'image/jpeg' });
                return;
            }

            // Text prompt -> generate anime image (Puter HTTP -> Pollinations)
            const imageBuffer = await generateAnimeImage(imagePrompt);
            if (imageBuffer) {
                await sock.sendMessage(jid, { image: imageBuffer, caption: narrative, mimetype: 'image/jpeg' });
                return;
            }
        } catch (error) {
            console.error(`[IMG] Erreur totale:`, error.message);
        }
    }

    if (narrative) {
        await sock.sendMessage(jid, { text: narrative });
    }
}

module.exports = { sendWithImage, generateAnimeImage, buildAnimePrompt };
