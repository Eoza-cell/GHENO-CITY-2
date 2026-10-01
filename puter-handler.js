const axios = require('axios');

/**
 * ATR — Puter AI engine.
 *
 * Puter.js is keyless on the frontend but Node.js has no browser session, so the
 * SDK alone always answers 401. Two authenticated paths are used instead:
 *
 *  1. OpenAI-compatible REST gateway (https://api.puter.com/puterai/openai/v1)
 *     — the documented way to drive Puter AI from a backend with an auth token.
 *  2. The official Node bootstrap `@heyputer/puter.js/src/init.cjs` — used for
 *     capabilities that only exist in the SDK (txt2img, txt2speech).
 *
 * Token resolution order: PUTER_TOKEN, PUTER_AUTH_TOKEN, PUTER_API_KEY.
 * Create one at puter.com/dashboard -> Account -> Create token.
 */

const API_BASE = process.env.PUTER_API_BASE || 'https://api.puter.com/puterai/openai/v1';
const CHAT_TIMEOUT_MS = parseInt(process.env.PUTER_TIMEOUT_MS || '45000', 10);

const CHAT_MODELS = (
    process.env.PUTER_MODELS ||
    'gpt-5.4-nano,gpt-4o-mini,gpt-4o,gpt-5.4'
).split(',').map(m => m.trim()).filter(Boolean);

const IMAGE_MODEL = process.env.PUTER_IMAGE_MODEL || 'gpt-image-2.5-flare';

let sdkPuter = null;
let sdkLoadFailed = false;
let lastFailure = null;

function getToken() {
    return process.env.PUTER_TOKEN || process.env.PUTER_AUTH_TOKEN || process.env.PUTER_API_KEY || null;
}

function hasToken() {
    return Boolean(getToken());
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
    };
}

/**
 * Puter.js lazily through the documented Node bootstrap. Cached: the bundle is
 * evaluated inside a vm context, so it must only happen once per process.
 */
async function getSdk() {
    if (sdkPuter) return sdkPuter;
    if (sdkLoadFailed) return null;

    try {
        const { init } = require('@heyputer/puter.js/src/init.cjs');
        const token = getToken();
        if (!token) return null;
        sdkPuter = init(token);
        sdkPuter.quiet = true;
        return sdkPuter;
    } catch (error) {
        sdkLoadFailed = true;
        console.warn('[Puter] SDK indisponible:', error.message);
        return null;
    }
}

function applyToken(token) {
    if (!token) return false;
    process.env.PUTER_TOKEN = token;
    process.env.PUTER_AUTH_TOKEN = token;
    process.env.PUTER_API_KEY = token;
    sdkPuter = null;
    lastFailure = null;
    return true;
}

function normalizeContent(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') return raw.trim() || null;
    if (Array.isArray(raw)) {
        const joined = raw
            .map(part => (typeof part === 'string' ? part : part?.text || ''))
            .filter(Boolean)
            .join('\n')
            .trim();
        return joined || null;
    }
    if (typeof raw === 'object' && typeof raw.text === 'string') return raw.text.trim() || null;
    return null;
}

/**
 * Single chat completion through the OpenAI-compatible gateway.
 * @returns {Promise<string|null>} assistant text, or null on any failure.
 */
async function chatViaRest(messages, model, options = {}) {
    try {
        const response = await axios.post(
            `${API_BASE}/chat/completions`,
            {
                model,
                messages,
                temperature: options.temperature !== undefined ? Number(options.temperature) : 0.9,
                max_tokens: Number(options.maxTokens || 1200),
                stream: false
            },
            { headers: authHeaders(), timeout: CHAT_TIMEOUT_MS, maxBodyLength: Infinity }
        );

        const choice = response.data?.choices?.[0];
        return normalizeContent(choice?.message?.content) || normalizeContent(choice?.text);
    } catch (error) {
        const status = error.response?.status;
        const detail = error.response?.data?.error?.message || error.message;
        lastFailure = { status, message: detail };
        console.warn(`[Puter] ${model} indisponible (${status || 'reseau'}): ${detail}`);
        return null;
    }
}

/**
 * Chat completion with the official SDK (used when REST is unavailable).
 */
async function chatViaSdk(systemPrompt, userPrompt, model, options = {}) {
    const puter = await getSdk();
    if (!puter || !puter.ai?.chat) return null;

    try {
        const messages = systemPrompt
            ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
            : [{ role: 'user', content: userPrompt }];

        const response = await puter.ai.chat(messages, {
            model,
            temperature: options.temperature !== undefined ? Number(options.temperature) : 0.9,
            max_tokens: Number(options.maxTokens || 1200)
        });

        return normalizeContent(response?.message?.content)
            || normalizeContent(response?.text)
            || normalizeContent(response);
    } catch (error) {
        const status = error?.status || error?.response?.status;
        lastFailure = { status, message: error.message };
        console.warn(`[Puter] SDK ${model} indisponible (${status || 'reseau'}): ${error.message}`);
        return null;
    }
}

/**
 * Main Puter entry point: walks the configured model chain, then falls back to
 * the SDK. Returns null when Puter cannot serve the request so ai-utils can
 * continue down its own chain.
 */
async function callPuter(systemPrompt, userPrompt, options = {}) {
    const token = getToken();
    if (!token) {
        console.warn('[Puter] Aucun token (PUTER_TOKEN). Créez-en un sur puter.com/dashboard -> Account -> Create token.');
        return null;
    }

    const system = String(systemPrompt || '');
    const prompt = String(userPrompt || '');
    const messages = system
        ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
        : [{ role: 'user', content: prompt }];

    const models = options.model ? [options.model, ...CHAT_MODELS] : CHAT_MODELS;
    const tried = new Set();

    for (const model of models) {
        if (!model || tried.has(model)) continue;
        tried.add(model);

        let text = await chatViaRest(messages, model, options);
        if (!text && options.model !== model) {
            text = await chatViaSdk(system, prompt, model, options);
        }
        if (text) {
            console.log(`[Puter] Succès via ${model}.`);
            return text;
        }
    }

    console.warn('[Puter] Tous les modèles ont échoué.', lastFailure || '');
    return null;
}

/**
 * Image generation through Puter (GPT Image). Returns a PNG/JPEG Buffer.
 */
async function generatePuterImage(prompt, options = {}) {
    const token = getToken();
    if (!token) return null;

    const model = options.model || IMAGE_MODEL;
    try {
        console.log(`[Puter] Génération d'image via ${model}...`);
        const response = await axios.post(
            `${API_BASE}/images/generations`,
            { model, prompt: String(prompt).slice(0, 2000), n: 1, size: options.size || '1024x1024' },
            { headers: authHeaders(), timeout: parseInt(process.env.PUTER_IMAGE_TIMEOUT_MS || '90000', 10), maxBodyLength: Infinity }
        );

        const entry = Array.isArray(response.data?.data) ? response.data.data[0] : null;
        const url = entry?.url;
        const b64 = entry?.b64_json;

        if (b64) return Buffer.from(b64, 'base64');
        if (url) {
            const img = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
            return Buffer.from(img.data);
        }
        console.warn('[Puter] Réponse image sans données exploitables.');
        return null;
    } catch (error) {
        console.warn('[Puter] Image indisponible:', error.response?.data?.error?.message || error.message);
        return null;
    }
}

function getStatus() {
    return {
        configured: hasToken(),
        models: CHAT_MODELS,
        imageModel: IMAGE_MODEL,
        endpoint: API_BASE,
        lastFailure
    };
}

module.exports = {
    callPuter,
    generatePuterImage,
    applyToken,
    hasToken,
    getToken,
    getStatus
};
