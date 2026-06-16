const axios = require('axios');
const { JSDOM } = require('jsdom');

// Setup JSDOM for Puter SDK if needed
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: "https://localhost",
    referrer: "https://localhost",
    contentType: "text/html",
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
    puter = require('@heyputer/puter.js');
} catch (e) {
    console.warn("[AI] Puter SDK could not be loaded:", e.message);
}

const PUTER_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite",
    "gpt-4o",
    "claude-3-5-sonnet",
    "meta-llama-3.1-70b-instruct"
];

/**
 * Detect responses that are not real narrative content.
 */
function isValidAIResponse(text) {
    if (!text || typeof text !== 'string') return false;

    const cleaned = text.trim();
    if (cleaned.length < 5) return false;

    const lower = cleaned.toLowerCase();
    const errorMarkers = [
        'token_missing',
        'missing authentication token',
        'authentication error',
        'no api key',
        '"type":"error"',
        'errortext',
        'data: [done]',
        '[done]',
        'unauthorized',
        'rate limit',
        '401',
        '429',
        'internal server error',
        'queue full',
        'too many requests',
        'invalid_request_error',
        'insufficient_quota'
    ];
    if (errorMarkers.some(m => lower.includes(m))) return false;

    return true;
}

/**
 * Parse a (possibly) Server-Sent Events / chunked response into plain text.
 */
function parseSSEResponse(raw) {
    if (raw == null) return null;
    if (typeof raw === 'object') {
        const parsed = parsePuterResponse(raw);
        return parsed && parsed !== JSON.stringify(raw) ? parsed : null;
    }
    if (typeof raw !== 'string') return null;

    if (!raw.includes('data:')) return raw.trim();

    let out = '';
    const lines = raw.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        if (payload.startsWith('{')) {
            try {
                const obj = JSON.parse(payload);
                if (obj.type === 'error' || obj.errorText || obj.error) continue;
                const chunk = obj.text || obj.content || obj.delta?.content
                    || obj.choices?.[0]?.delta?.content || '';
                out += chunk;
            } catch {
                // If it's not JSON, might be raw text
            }
        }
    }

    out = out.trim();
    return out.length > 0 ? out : null;
}

function extractMessageContent(content) {
    if (!content) return null;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
        return content.map(c => typeof c === 'string' ? c : (c.text || '')).join('').trim();
    }
    return null;
}

/**
 * Call Puter's AI over its V1 OpenAI-compatible endpoint.
 */
async function callPuterAPI(system, prompt) {
    const key = process.env.PUTER_API_KEY;
    if (!key || key.length < 6 || key === 'test_key') return null;

    const messages = [
        { role: "system", content: system },
        { role: "user", content: prompt }
    ];

    for (const model of PUTER_MODELS) {
        try {
            console.log(`[AI] Puter V1 API - Modèle: ${model}`);
            const resp = await axios.post("https://api.puter.com/v1/chat/completions", {
                messages,
                model,
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const content = resp.data?.choices?.[0]?.message?.content;
            if (content && content.length > 5) return content;
        } catch (e) {
            console.warn(`[AI] Puter V1 API Error (${model}):`, e.response?.data || e.message);
            continue;
        }
    }
    return null;
}

/**
 * Try Puter SDK (Keyless).
 */
async function callPuterSDK(system, prompt) {
    if (!puter || !puter.ai) return null;
    const models = ["gemini-3.5-flash", "gpt-4o", "claude-3-5-sonnet"];

    for (const model of models) {
        try {
            console.log(`[AI] Puter SDK (Keyless) - Tentative avec ${model}...`);
            // Using array format for better system prompt adherence
            const result = await puter.ai.chat([
                { role: "system", content: system },
                { role: "user", content: prompt }
            ], { model: model });

            const content = parsePuterResponse(result);
            if (isValidAIResponse(content)) return content;
        } catch (e) {
            console.warn(`[AI] Puter SDK Error (${model}):`, e.message);
            continue;
        }
    }
    return null;
}

async function callOpenRouter(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    const models = [
        "google/gemini-2.0-flash-exp:free",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "google/gemini-2.0-pro-exp-02-05:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-r1:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "nvidia/llama-3.1-nemotron-70b-instruct:free"
    ];

    for (const model of models) {
        try {
            console.log(`[AI] OpenRouter - Tentative avec ${model}`);
            const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: model,
                messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/skype-bot/arise',
                    'X-Title': 'Arise RPG'
                },
                timeout: 20000
            });
            const content = resp.data?.choices?.[0]?.message?.content;
            if (isValidAIResponse(content)) return content;
        } catch (e) {
            console.warn(`[AI] OpenRouter Error (${model}):`, e.response?.data || e.message);
            continue;
        }
    }
    return null;
}

async function callBlackbox(system, prompt) {
    try {
        const resp = await axios.post("https://www.blackbox.ai/api/chat", {
            messages: [{ role: "user", content: `SYSTEM: ${system}\n\nUSER: ${prompt}` }],
            model: "deepseek-v3",
            agentMode: {},
            trendingAgentMode: {},
            userSelectedModel: "deepseek-v3"
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.blackbox.ai/',
                'Origin': 'https://www.blackbox.ai/'
            },
            timeout: 15000
        });
        return parseSSEResponse(resp.data);
    } catch (e) { return null; }
}

async function callPollinationsPOST(system, prompt) {
    const models = ['openai', 'mistral', 'llama', 'unity'];
    for (const model of models) {
        try {
            const resp = await axios.post("https://text.pollinations.ai/", {
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                model: model,
                jsonMode: true,
                seed: Math.floor(Math.random() * 1000000)
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 20000
            });

            let resText = "";
            if (typeof resp.data === 'object') {
                resText = resp.data.narrative || resp.data.content || JSON.stringify(resp.data);
            } else {
                resText = resp.data;
            }

            if (isValidAIResponse(resText)) return resText;
        } catch (e) { continue; }
    }
    return null;
}

async function callPollinationsGET(system, prompt) {
    try {
        const fullPrompt = encodeURIComponent(`SYSTEM: ${system}\n\nUSER: ${prompt}`.substring(0, 1500));
        const seed = Math.floor(Math.random() * 1000000);
        const url = `https://text.pollinations.ai/${fullPrompt}?model=openai&seed=${seed}`;
        const resp = await axios.get(url, { timeout: 15000 });
        if (isValidAIResponse(resp.data)) return resp.data;
    } catch (e) { return null; }
    return null;
}

/**
 * Call a local LM Studio instance if available.
 */
async function callLMStudio(system, prompt) {
    const url = process.env.LM_STUDIO_URL || "http://localhost:1234/v1/chat/completions";
    try {
        console.log(`[AI] LM Studio - Tentative sur ${url}`);
        const resp = await axios.post(url, {
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: -1,
            stream: false
        }, { timeout: 15000 });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] LM Studio inaccessible: ${e.message}`);
    }
    return null;
}

/**
 * Main AI entry point.
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 2) return null;

    // Sanitize prompts
    const sanitizedSystem = systemPrompt.length > 6000 ? systemPrompt.substring(0, 6000) : systemPrompt;
    let sanitizedUser = userPrompt;
    if (userPrompt.length > 4000) {
        sanitizedUser = userPrompt.substring(0, 1000) + "\n... [TRUNCATED] ...\n" + userPrompt.substring(userPrompt.length - 3000);
    }

    const providers = [
        { name: 'LM Studio (Local)', fn: callLMStudio },
        { name: 'Puter API (Keyed)', fn: callPuterAPI },
        { name: 'OpenRouter', fn: callOpenRouter },
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'Blackbox', fn: callBlackbox },
        { name: 'Pollinations POST', fn: callPollinationsPOST },
        { name: 'Pollinations GET', fn: callPollinationsGET }
    ];

    for (const provider of providers) {
        try {
            console.log(`[AI] Tentative: ${provider.name}...`);
            const result = await provider.fn(sanitizedSystem, sanitizedUser);
            if (isValidAIResponse(result)) {
                console.log(`[AI] ✅ Succès avec ${provider.name}`);
                return result;
            } else {
                console.warn(`[AI] ⚠️ ${provider.name} réponse invalide ou erreur.`);
            }
        } catch (e) {
            console.warn(`[AI] ❌ Échec ${provider.name}:`, e.message || e);
        }
    }

    console.warn("[AI] Tous les providers ont échoué. Tentative finale (retry)...");
    if (depth < 1) {
        await new Promise(r => setTimeout(r, 2000));
        return callAI(systemPrompt, userPrompt, depth + 1);
    }

    return JSON.stringify({
        narrative: "🌀 *Le flux magique est instable.* L'Ether ne répond pas à tes appels... (Tous les serveurs IA sont hors ligne, réessaye dans un instant).",
        actions: []
    });
}

function parsePuterResponse(resp) {
    if (!resp) return null;
    if (typeof resp === 'string') return resp;

    if (resp.message && resp.message.content) {
        if (Array.isArray(resp.message.content)) {
            return resp.message.content.map(c => typeof c === 'string' ? c : (c.text || "")).join("");
        }
        return resp.message.content;
    }

    if (resp.choices && resp.choices[0]?.message?.content) {
        return resp.choices[0].message.content;
    }

    if (resp.text && typeof resp.text === 'string') return resp.text;

    return JSON.stringify(resp);
}

module.exports = { callAI };
