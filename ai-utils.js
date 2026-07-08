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
    const puterLib = require('@heyputer/puter.js');
    puter = puterLib.default || puterLib;

    const token = process.env.PUTER_TOKEN || process.env.PUTER_API_KEY;
    if (token) {
        if (typeof puter.setAuthToken === 'function') {
            puter.setAuthToken(token);
        }
        puter.authToken = token;
        console.log("[AI] Puter SDK : Token configuré.");
    }
} catch (e) {
    console.warn("[AI] Puter SDK could not be loaded:", e.message);
}

const PUTER_MODELS = [
    "meta-llama-3.1-70b-instruct",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gpt-4o",
    "claude-3-5-sonnet"
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
        'unauthorized',
        'rate limit',
        '401',
        '404 not found',
        '429',
        'internal server error',
        'queue full',
        'too many requests',
        'invalid_request_error',
        'insufficient_quota',
        'bad gateway',
        'service unavailable'
    ];

    // If it's a tiny response with an error marker, it's definitely an error
    if (cleaned.length < 250 && errorMarkers.some(m => lower.includes(m))) {
        // Double check it's not a valid small JSON action response
        if (cleaned.startsWith('{') && cleaned.endsWith('}') && lower.includes('"narrative"')) return true;
        return false;
    }

    // If it's just technical jargon without narrative content
    if (cleaned.startsWith('data: [DONE]') || cleaned === '[DONE]') return false;

    // Check if it's an HTML error page
    if (lower.includes('<!doctype html>') || lower.includes('<html>')) return false;

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
    const key = process.env.PUTER_API_KEY || process.env.PUTER_TOKEN;
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
                timeout: 15000
            });

            const content = resp.data?.choices?.[0]?.message?.content;
            if (isValidAIResponse(content)) return content;
        } catch (e) {
            console.warn(`[AI] Puter V1 API Error (${model}):`, e.response?.data || e.message);
            continue;
        }
    }
    return null;
}

/**
 * Try Puter SDK.
 */
async function callPuterSDK(system, prompt) {
    if (!puter || !puter.ai) {
        console.warn("[AI] Puter SDK non initialisé ou indisponible.");
        return null;
    }
    // Prioritizing Llama 3.1 70B for Roleplay and stability on Puter Free
    const models = ["meta-llama-3.1-70b-instruct", "gemini-1.5-flash", "gemini-1.5-pro", "gpt-4o"];

    for (const model of models) {
        try {
            console.log(`[AI] Puter SDK - Tentative avec ${model}...`);

            // Timeout wrapper for SDK call
            const chatPromise = (async () => {
                try {
                    return await puter.ai.chat([
                        { role: "system", content: system },
                        { role: "user", content: prompt }
                    ], { model: model });
                } catch (err) {
                    console.warn(`[AI] Puter SDK Chat Array/Options failed for ${model}, trying simplified call...`);
                    return await puter.ai.chat(`${system}\n\n${prompt}`, { model: model });
                }
            })();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout SDK Puter")), 25000)
            );

            const result = await Promise.race([chatPromise, timeoutPromise]);

            const content = parsePuterResponse(result);
            if (isValidAIResponse(content)) return content;
            else console.warn(`[AI] Puter SDK ${model} a renvoyé une réponse vide ou invalide.`);
        } catch (e) {
            console.warn(`[AI] Puter SDK Error (${model}):`, e.message);
            continue;
        }
    }
    // ULTIMATE FALLBACK: No model specified, let Puter decide (usually uses a free default)
    try {
        console.log("[AI] Puter SDK - Tentative finale sans modèle spécifié...");
        const result = await puter.ai.chat(`${system}\n\n${prompt}`);
        const content = parsePuterResponse(result);
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn("[AI] Puter SDK Ultimate Fallback failed:", e.message);
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
        "nvidia/llama-3.1-nemotron-70b-instruct:free",
        "google/gemma-2-9b-it:free",
        "google/gemma-4-26b-a4b-it:free"
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
                timeout: 8000
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
    const models = ["deepseek-v3", "llama-3.1-70b", "gpt-4o"];
    for (const model of models) {
        try {
            console.log(`[AI] Blackbox - Tentative avec ${model}...`);
            const resp = await axios.post("https://www.blackbox.ai/api/chat", {
                messages: [
                    { role: "user", content: `SYSTEM: ${system}\n\nUSER_ACTION: ${prompt}\n\nIMPORTANT: Réponds uniquement en JSON valide.` }
                ],
                model: model,
                agentMode: {},
                trendingAgentMode: {},
                userSelectedModel: model,
                clickedContinue: false,
                previewToken: null,
                codeModelMode: true
            }, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Referer': 'https://www.blackbox.ai/',
                    'Origin': 'https://www.blackbox.ai/',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'x-blackbox-device-id': Math.random().toString(36).substring(2, 15)
                },
                timeout: 10000
            });

            let result = "";
            if (typeof resp.data === 'string') {
                result = parseSSEResponse(resp.data);
            } else {
                result = resp.data.text || resp.data.content || JSON.stringify(resp.data);
            }

            if (isValidAIResponse(result)) return result;
        } catch (e) {
            console.warn(`[AI] Blackbox error (${model}): ${e.message}`);
            continue;
        }
    }
    return null;
}

async function callPollinationsGen(system, prompt) {
    const key = process.env.POLLINATIONS_API_KEY;
    if (!key) return null;

    const models = ['openai', 'mistral', 'llama', 'qwen-coder'];
    for (const model of models) {
        try {
            console.log(`[AI] Pollinations Gen (Keyed) - Tentative avec ${model}...`);
            const resp = await axios.post("https://gen.pollinations.ai/v1/chat/completions", {
                model: model,
                messages: [
                    { role: "system", content: system + "\n\nIMPORTANT: Réponds UNIQUEMENT en JSON valide." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            }, {
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            const content = resp.data?.choices?.[0]?.message?.content;
            if (isValidAIResponse(content)) return content;
        } catch (e) {
            console.warn(`[AI] Pollinations Gen Error (${model}):`, e.response?.data || e.message);
            continue;
        }
    }
    return null;
}

async function callPollinationsPOST(system, prompt) {
    const models = ['openai', 'mistral', 'llama'];

    for (const model of models) {
        try {
            console.log(`[AI] Pollinations POST (Keyless) - Tentative avec ${model}...`);
            const resp = await axios.post("https://text.pollinations.ai/", {
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                model: model,
                jsonMode: true,
                seed: Math.floor(Math.random() * 1000000),
                cache: false
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36`
                },
                timeout: 15000
            });

            let resText = typeof resp.data === 'object' ? JSON.stringify(resp.data) : resp.data;
            if (isValidAIResponse(resText)) return resText;
        } catch (e) {
            console.warn(`[AI] Pollinations POST Error (${model}):`, e.response?.data || e.message);
            continue;
        }
    }
    return null;
}

async function callPollinationsGET(system, prompt) {
    try {
        console.log(`[AI] Pollinations GET - Tentative...`);
        const miniPrompt = `MJ Arise. Action: ${prompt.substring(prompt.length - 1000)}`;
        const fullPrompt = encodeURIComponent(miniPrompt);
        const systemEncoded = encodeURIComponent(system.substring(0, 1000));
        const seed = Math.floor(Math.random() * 1000000);
        const url = `https://text.pollinations.ai/${fullPrompt}?model=openai&seed=${seed}&system=${systemEncoded}&json=true`;

        const resp = await axios.get(url, { timeout: 15000 });
        if (isValidAIResponse(resp.data)) return resp.data;
    } catch (e) {
        console.warn(`[AI] Pollinations GET Error:`, e.message);
        return null;
    }
    return null;
}

/**
 * Call a local Ollama instance if available.
 */
async function callOllama(system, prompt) {
    let ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    // Robust sanitization of OLLAMA_URL
    if (!ollamaUrl.startsWith('http')) {
        ollamaUrl = 'http://' + ollamaUrl;
    }

    // According to docs, the API is served at /api
    const apiBaseUrl = ollamaUrl.replace(/\/$/, '') + (ollamaUrl.includes('/api') ? '' : '/api');
    const isCloud = ollamaUrl.includes('ollama.com');

    try {
        console.log(`[AI] Ollama - Tentative sur ${apiBaseUrl}`);

        const payload = {
            model: process.env.OLLAMA_MODEL || 'dark-lust',
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt }
            ],
            stream: false,
            format: 'json',
            options: {
                temperature: 0.2,
                num_predict: 1024,
                num_ctx: 8192
            }
        };

        const headers = { 'Content-Type': 'application/json' };
        if (isCloud && process.env.OLLAMA_API_KEY) {
            headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`;
        }

        const resp = await axios.post(`${apiBaseUrl}/chat`, payload, {
            headers,
            timeout: 15000
        });

        const content = resp.data?.message?.content || resp.data?.response;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] Ollama error on ${ollamaUrl}:`, e.response?.data || e.message);
    }
    return null;
}

/**
 * Call a local LM Studio instance if available.
 */
async function call9Router(system, prompt) {
    const baseUrl = process.env.NINEROUTER_URL || "http://localhost:20128/v1";
    const key = process.env.NINEROUTER_API_KEY || "9router";

    const models = [
        "qw/qwen-2.5-72b-instruct",
        "mi/mistral-large",
        "gg/gemini-2.0-flash",
        "ll/llama-3.3-70b",
        "ds/deepseek-r1"
    ];

    for (const model of models) {
        try {
            console.log(`[AI] 9Router - Tentative avec ${model}...`);
            const resp = await axios.post(`${baseUrl}/chat/completions`, {
                model: model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            const content = resp.data?.choices?.[0]?.message?.content;
            if (isValidAIResponse(content)) return content;
        } catch (e) {
            console.warn(`[AI] 9Router error (${model}): ${e.message}`);
            continue;
        }
    }
    return null;
}

async function callWorldServer(system, prompt) {
    const url = "http://localhost:3001/v1/chat/completions";
    try {
        console.log(`[AI] World Server - Tentative...`);
        const resp = await axios.post(url, {
            model: "dark-lust-3.2-1b",
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            stream: false
        }, { timeout: 15000 });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] World Server indisponible: ${e.message}`);
    }
    return null;
}

async function callLlamafile(system, prompt) {
    const url = process.env.LLAMAFILE_URL || "http://localhost:8080/v1/chat/completions";
    try {
        console.log(`[AI] Llamafile - Tentative sur ${url}`);
        const resp = await axios.post(url, {
            model: "LLaMA_CPP",
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            stream: false
        }, { timeout: 15000 });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] Llamafile indisponible: ${e.message}`);
    }
    return null;
}

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
 * Local MJ Fallback in case all AI providers fail.
 * Generates a simple but immersive response based on the action.
 */
function callMJFallback(prompt) {
    console.log("[AI] Utilisation du MJ Fallback Local.");

    let action = "ton action";
    const actionMatch = prompt.match(/ACTION: (.*)$/);
    if (actionMatch) action = actionMatch[1].trim();

    const responses = [
        `Tu t'efforces de réaliser "${action}", mais une étrange brume semble ralentir tes mouvements. Tu réussis l'essentiel, bien que les conséquences précises restent floues.`,
        `Le destin semble incertain alors que tu tentes "${action}". L'énergie ambiante crépite mais ne se stabilise pas. Tu agis avec prudence.`,
        `"${action}" est accompli. Tu sens le poids de tes décisions peser sur l'air ambiant, même si le monde reste étrangement silencieux.`,
        `Alors que tu effectues "${action}", tu as l'impression d'être observé. Ton geste est précis, mais le flux magique est trop instable.`
    ];

    const narrative = responses[Math.floor(Math.random() * responses.length)];

    return JSON.stringify({
        narrative: `[🤖 MJ FALLBACK]\n\n${narrative}\n\n_Note: Les flux magiques (IA) sont actuellement instables. Ton action a été traitée en mode dégradé._`,
        actions: []
    });
}

/**
 * Main AI entry point.
 */
async function callAI(systemPrompt, userPrompt, options = {}) {
    const depth = options.depth || 0;
    if (depth > 2) return null;

    // Preserve more context: the RP engine relies on scene isolation and detailed stats.
    const maxSystemLength = 12000;
    const maxUserLength = 16000;
    const sanitizedSystem = systemPrompt.length > maxSystemLength
        ? systemPrompt.substring(0, maxSystemLength)
        : systemPrompt;
    let sanitizedUser = userPrompt;
    if (userPrompt.length > maxUserLength) {
        const headLength = 6000;
        const tailLength = 9000;
        sanitizedUser = userPrompt.substring(0, headLength) + "\n...[TRUNCATED]...\n" + userPrompt.substring(userPrompt.length - tailLength);
    }

    const providers = [
        // Prioritize Puter SDK as user provided a token
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: '9Router', fn: call9Router },
        { name: 'Pollinations GET', fn: callPollinationsGET },
        { name: 'Pollinations POST (Keyless)', fn: callPollinationsPOST },
        { name: 'Pollinations Gen (Keyed)', fn: callPollinationsGen },
        { name: 'OpenRouter', fn: callOpenRouter },
        { name: 'Puter API (Keyed)', fn: callPuterAPI },
        { name: 'Blackbox', fn: callBlackbox },
        ...(options.skipWorldServer ? [] : [{ name: 'World Server (Local)', fn: callWorldServer }]),
        { name: 'Ollama (Local)', fn: callOllama },
        { name: 'Llamafile (Local)', fn: callLlamafile },
        { name: 'LM Studio (Local)', fn: callLMStudio }
    ];

    for (const provider of providers) {
        try {
            const providerStart = Date.now();
            console.log(`[AI] Tentative: ${provider.name}... (depth: ${depth})`);

            // Smart Fallback: if it's a retry, use a simplified prompt
            let activeSystem = sanitizedSystem;
            if (depth === 1) {
                activeSystem = "Tu es le MJ du RPG Aetherys. Style Manhwa. Réponds au format JSON: {\"narrative\": \"...\", \"actions\": [], \"imagePrompt\": \"...\"}";
            } else if (depth >= 2) {
                activeSystem = "Réponds uniquement en JSON: {\"narrative\": \"...\"}";
            }

            let result = await provider.fn(activeSystem, sanitizedUser, options);
            const providerDuration = (Date.now() - providerStart) / 1000;

            // Handle potential JSON objects from some providers
            if (typeof result === 'object' && result !== null) {
                result = JSON.stringify(result);
            }

            if (isValidAIResponse(result)) {
                console.log(`[AI] ✅ Succès avec ${provider.name} en ${providerDuration}s`);
                // Verify the result is not just a technical JSON dump without narrative
                if (result && result.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(result);
                        if (!parsed.narrative && !parsed.message && !parsed.text) {
                             console.warn(`[AI] ⚠️ ${provider.name} JSON sans narration. Fallback.`);
                             continue;
                        }
                    } catch(e) {}
                }
                return result;
            } else {
                console.warn(`[AI] ⚠️ ${provider.name} réponse invalide ou erreur.`);
            }
        } catch (e) {
            console.warn(`[AI] ❌ Échec ${provider.name}:`, e.message || e);
        }
    }

    console.warn("[AI] Tous les providers ont échoué.");
    if (depth < 1) {
        console.log("[AI] Nouvelle tentative dans 1s avec jitter...");
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
        return callAI(systemPrompt, userPrompt, { ...options, depth: depth + 1 });
    }

    // Ultimate fallback if even retry fails
    return callMJFallback(userPrompt);
}

function parsePuterResponse(resp) {
    if (!resp) return null;
    // Puter SDK often returns an object with a .text property or a toString() that returns the content
    if (typeof resp === 'string') return resp;

    // Handle SDK v2+ response objects
    if (resp.text && typeof resp.text === 'string') return resp.text;
    if (typeof resp.toString === 'function' && resp.toString() !== '[object Object]') {
        const ts = resp.toString();
        if (ts && ts.length > 5) return ts;
    }

    if (resp.message && resp.message.content) {
        if (Array.isArray(resp.message.content)) {
            return resp.message.content.map(c => typeof c === 'string' ? c : (c.text || "")).join("");
        }
        return resp.message.content;
    }

    if (resp.choices && resp.choices[0]?.message?.content) {
        return resp.choices[0].message.content;
    }

    return JSON.stringify(resp);
}

module.exports = { callAI };
