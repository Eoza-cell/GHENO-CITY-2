const axios = require('axios');

/**
 * ATR AI — Puter.js / Gemini primary, GPT-OSS proxy fallback.
 *
 * Puter Node.js authentication:
 *   PUTER_AUTH_TOKEN (or legacy PUTER_TOKEN)
 * Model:
 *   PUTER_MODEL (default: gemini-3.1-flash-lite)
 *
 * Puter is a user-pays service: availability and included usage depend on
 * the account/model. It must not be advertised as permanently unlimited.
 */

let puterClient = null;
let puterInitAttempted = false;

function getPuterClient() {
    if (puterClient) return puterClient;
    if (puterInitAttempted) return null;
    puterInitAttempted = true;

    const token = process.env.PUTER_AUTH_TOKEN || process.env.PUTER_TOKEN;
    if (!token) {
        console.warn('[AI] PUTER_AUTH_TOKEN / PUTER_TOKEN absent; Puter disabled.');
        return null;
    }

    try {
        const { init } = require('@heyputer/puter.js/src/init.cjs');
        puterClient = init(token);
        console.log('[AI] Puter.js initialisé.');
        return puterClient;
    } catch (error) {
        console.error('[AI] Initialisation Puter.js impossible:', error.message);
        return null;
    }
}

function extractPuterText(response) {
    const content =
        response?.message?.content ??
        response?.choices?.[0]?.message?.content ??
        response?.text ??
        response?.content ??
        response;

    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
        return content.map(part => typeof part === 'string' ? part : (part?.text || '')).join('').trim();
    }
    if (content && typeof content.toString === 'function') {
        const text = content.toString();
        return text === '[object Object]' ? '' : text.trim();
    }
    return '';
}

function isValidAIResponse(input) {
    if (!input) return false;
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    const cleaned = text.trim();
    if (cleaned.length < 3) return false;

    const lower = cleaned.toLowerCase();
    if (/^(user safety|safety|content safety)\s*:/i.test(cleaned)) return false;
    if (/^safe\s*$/.test(lower)) return false;
    if (cleaned === '[DONE]' || lower.includes('<!doctype html>') || lower.includes('<html>')) return false;

    const errors = [
        '"error":',
        'unauthorized',
        'token_missing',
        'insufficient_quota',
        'rate_limit_exceeded',
        'api_key_invalid',
        'service_unavailable',
        'permission_denied'
    ];
    if (cleaned.length < 500 && errors.some(x => lower.includes(x))) return false;

    return true;
}

async function callPuter(system, prompt, options = {}) {
    const puter = getPuterClient();
    if (!puter) return null;

    const model = options.model || process.env.PUTER_MODEL || 'google/gemini-3.8-flash';
    const timeoutMs = Number.parseInt(process.env.PUTER_TIMEOUT_MS || '90000', 10);
    const messages = [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
    ];

    let timeout;
    try {
        console.log(`[AI] Puter.js → ${model}`);
        const response = await Promise.race([
            puter.ai.chat(messages, { model }),
            new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error('Puter timeout')), timeoutMs);
            })
        ]);
        const content = extractPuterText(response);
        if (isValidAIResponse(content)) return content;
        console.warn('[AI] Puter a renvoyé une réponse vide/invalide.');
        return null;
    } catch (error) {
        console.warn('[AI] Puter indisponible:', error?.message || error);
        return null;
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

const GPTOSS_BASE_URL = (
    process.env.GPTOSS_PROXY_URL ||
    'https://gptoss-proxy.eozaatlas-3d0.workers.dev'
).replace(/\/$/, '');

async function callGPTOSS(system, prompt, options = {}) {
    const model = options.fallbackModel || process.env.GPTOSS_MODEL || 'gpt-oss-120b';
    const timeoutMs = Number.parseInt(process.env.GPTOSS_TIMEOUT_MS || '90000', 10);
    const maxTokens = Number.parseInt(options.maxOutputTokens || process.env.GPTOSS_MAX_OUTPUT_TOKENS || '8192', 10);

    try {
        console.log(`[AI] Fallback GPT-OSS ${model} → ${GPTOSS_BASE_URL}`);
        const response = await axios.post(
            `${GPTOSS_BASE_URL}/v1/chat/completions`,
            {
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt }
                ],
                stream: false,
                max_tokens: maxTokens
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: timeoutMs
            }
        );
        const content = response.data?.choices?.[0]?.message?.content;
        return isValidAIResponse(content) ? content : null;
    } catch (error) {
        console.warn('[AI] GPT-OSS fallback indisponible:', error.response?.data?.error?.message || error.message);
        return null;
    }
}

async function callAI(systemPrompt, userPrompt, options = {}) {
    const maxLength = 12000;
    const system = String(systemPrompt || '').slice(0, maxLength);
    const rawPrompt = String(userPrompt || '');
    const prompt = rawPrompt.length > maxLength
        ? rawPrompt.substring(0, 5000) + '\n...[TRUNCATED]...\n' + rawPrompt.slice(-7000)
        : rawPrompt;

    // Puter/Gemini is the primary engine. GPT-OSS remains a resilience fallback.
    const puterResult = await callPuter(system, prompt, options);
    if (isValidAIResponse(puterResult)) return puterResult;

    console.warn('[AI] Passage au moteur de secours GPT-OSS.');
    const fallbackResult = await callGPTOSS(system, prompt, options);
    return isValidAIResponse(fallbackResult) ? fallbackResult : null;
}

const callEmpero = callGPTOSS;
const callOllama = callGPTOSS;
const callHuggingFaceLocal = async () => null;
const callAether = async () => null;
const callOmniRouter = async () => null;
const call9Router = async () => null;

module.exports = {
    callAI,
    callPuter,
    callGPTOSS,
    callEmpero,
    callOllama,
    callHuggingFaceLocal,
    callAether,
    callOmniRouter,
    call9Router,
    isValidAIResponse
};
