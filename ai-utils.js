const axios = require('axios');
const { JSDOM } = require('jsdom');
const aether = require('./aether-brain');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://localhost', referrer: 'https://localhost', contentType: 'text/html'
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
global.customElements = dom.window.customElements;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.Element = dom.window.Element;

let puter = null;
try {
    const puterLib = require('@heyputer/puter.js');
    puter = puterLib.default || puterLib;
    const token = process.env.PUTER_TOKEN || process.env.PUTER_API_KEY;
    if (token) {
        if (typeof puter.setAuthToken === 'function') puter.setAuthToken(token);
        puter.authToken = token;
    }
} catch (e) {}

function isValidAIResponse(input) {
    if (!input) return false;
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    const cleaned = text.trim();
    if (cleaned.length < 3) return false;
    const lower = cleaned.toLowerCase();
    if (/^(user safety|safety|content safety)\s*:/i.test(cleaned)) return false;
    if (/^safe\s*$/i.test(cleaned)) return false;
    if (cleaned === '[DONE]' || lower.includes('<!doctype html>') || lower.includes('<html>')) return false;
    const errors = ['"error":', 'unauthorized', 'token_missing', 'insufficient_quota', 'rate_limit_exceeded', 'api_key_invalid', 'service_unavailable', 'permission_denied'];
    if (cleaned.length < 500 && errors.some(x => lower.includes(x))) return false;
    return true;
}

/**
 * Omni Router / 9Router OpenAI-compatible gateway.
 * The router chooses among the models configured by the user/router.
 * It can run locally (recommended for self-hosting) or at a custom URL.
 */
async function callOmniRouter(system, prompt, options = {}) {
    let baseUrl = process.env.OMNI_ROUTER_URL || process.env.NINEROUTER_URL || 'http://localhost:20128/v1';
    baseUrl = baseUrl.replace(/\/$/, '');
    if (!baseUrl.endsWith('/v1')) baseUrl += '/v1';

    const apiKey = process.env.OMNI_ROUTER_API_KEY || process.env.NINEROUTER_API_KEY || 'omni-router';
    const model = process.env.OMNI_ROUTER_MODEL || process.env.NINEROUTER_MODEL || 'auto';
    const timeout = Number(process.env.OMNI_ROUTER_TIMEOUT_MS || 90000);

    try {
        console.log(`[AI] Omni Router - ${model} -> ${baseUrl}/chat/completions`);
        const resp = await axios.post(`${baseUrl}/chat/completions`, {
            model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt }
            ],
            temperature: Number(process.env.OMNI_ROUTER_TEMPERATURE || 0.82),
            max_tokens: Number(process.env.OMNI_ROUTER_MAX_TOKENS || 1800),
            stream: false
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout
        });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
        console.warn('[AI] Omni Router returned an empty/invalid response.');
    } catch (e) {
        console.warn('[AI] Omni Router unavailable:', e.response?.data?.error?.message || e.message);
    }
    return null;
}

// Backward-compatible alias for older code/configuration.
const call9Router = callOmniRouter;

async function callOllama(system, prompt, options = {}) {
    let host = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    if (!host.startsWith('http')) host = 'http://' + host;
    const model = process.env.OLLAMA_MODEL || 'gemma4:e4b';
    const numCtx = parseInt(process.env.OLLAMA_NUM_CTX || '32768', 10);
    const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '60000', 10);

    try {
        console.log(`[AI] Ollama fallback - ${model}`);
        const { Ollama } = require('ollama');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const client = new Ollama({ host });
            const response = await client.chat({
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt }
                ],
                options: { num_ctx: numCtx },
                stream: false,
                signal: controller.signal
            });
            const content = response?.message?.content;
            if (isValidAIResponse(content)) return content;
        } finally {
            clearTimeout(timer);
        }
    } catch (e) {
        console.warn('[AI] Ollama fallback unavailable:', e.message);
    }
    return null;
}

async function callHuggingFaceLocal(system, prompt, options = {}) {
    const hfToken = process.env.HF_TOKEN || process.env.HF_API_KEY;
    const model = process.env.HF_RP_REMOTE_MODEL || options.model || process.env.HF_RP_MODEL || 'Qwen/Qwen2.5-1.5B-Instruct';
    if (hfToken) {
        try {
            const resp = await axios.post('https://router.huggingface.co/v1/chat/completions', {
                model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
                temperature: 0.82, top_p: 0.92, max_tokens: 420, stream: false
            }, { headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' }, timeout: 30000 });
            const content = resp.data?.choices?.[0]?.message?.content;
            if (isValidAIResponse(content)) return content;
        } catch (e) { console.warn('[AI] Hugging Face unavailable:', e.message); }
    }
    return null;
}

async function callAether(system, prompt, options = {}) {
    try {
        const response = await aether.think(system, prompt, options);
        if (isValidAIResponse(response)) return response;
    } catch (e) {}
    return null;
}

/**
 * Main AI entry point.
 * Priority: Omni Router -> Ollama local fallback -> Aether fallback.
 * RAG is injected by rag-preload.js before this function receives the prompt.
 */
async function callAI(systemPrompt, userPrompt, options = {}) {
    const depth = options.depth || 0;
    if (depth > 2) return null;

    const maxSystemLength = 16000;
    const maxUserLength = 16000;
    const system = String(systemPrompt || '').length > maxSystemLength
        ? String(systemPrompt).substring(0, maxSystemLength)
        : String(systemPrompt || '');
    const prompt = String(userPrompt || '').length > maxUserLength
        ? String(userPrompt).substring(0, 7000) + '\n...[TRUNCATED]...\n' + String(userPrompt).slice(-9000)
        : String(userPrompt || '');

    const providers = [
        { name: 'Omni Router', fn: callOmniRouter },
        { name: 'Ollama Local', fn: callOllama },
        { name: 'Aether Brain', fn: callAether }
    ];

    for (const provider of providers) {
        try {
            const started = Date.now();
            const result = await provider.fn(system, prompt, options);
            if (isValidAIResponse(result)) {
                console.log(`[AI] ✅ ${provider.name} responded in ${((Date.now() - started) / 1000).toFixed(1)}s`);
                return typeof result === 'object' ? JSON.stringify(result) : result;
            }
        } catch (e) {
            console.warn(`[AI] ${provider.name} failed:`, e.message);
        }
    }

    if (depth < 1) {
        console.warn('[AI] Providers failed; retrying once.');
        return callAI(systemPrompt, userPrompt, { ...options, depth: depth + 1 });
    }
    return null;
}

module.exports = {
    callAI,
    callOmniRouter,
    call9Router,
    callOllama,
    callHuggingFaceLocal,
    callAether,
    isValidAIResponse
};
