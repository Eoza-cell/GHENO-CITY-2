const axios = require('axios');
const { JSDOM } = require('jsdom');
const aether = require('./aether-brain');

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
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "meta-llama-3.1-70b-instruct",
    "gpt-4o",
    "claude-3-5-sonnet"
];

/**
 * Detect responses that are not real narrative content.
 */
function isValidAIResponse(input) {
    if (!input) return false;

    let text = "";
    if (typeof input === 'object') {
        text = JSON.stringify(input);
    } else if (typeof input === 'string') {
        text = input;
    } else {
        return false;
    }

    const cleaned = text.trim();
    if (cleaned.length < 3) return false;

    const lower = cleaned.toLowerCase();
    const errorMarkers = [
        '"error":',
        '"message":"unauthorized"',
        '"message":"invalid',
        'token_missing',
        'insufficient_quota',
        'rate_limit_exceeded',
        'api_key_invalid',
        'service_unavailable',
        'invalid_request_error',
        'permission_denied'
    ];

    // Robust JSON detection
    if (cleaned.startsWith('{')) {
        const lowerText = cleaned.toLowerCase();
        // If it's a JSON containing narrative or actions, it's almost certainly valid
        if (lowerText.includes('"narrative"') || lowerText.includes('"actions"')) {
            if (cleaned.length > 20) return true;
        }
    }

    // If it's a tiny response with an error marker, it's definitely an error
    if (cleaned.length < 300 && errorMarkers.some(m => lower.includes(m))) {
        // Final check: is it actually just a person talking?
        if (cleaned.length > 20 && !cleaned.includes('{') && !cleaned.includes('"')) return true;
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

async function callMLVoca(system, prompt) {
    const models = ["deepseek-r1:1.5b", "tinyllama"];
    for (const model of models) {
        try {
            console.log(`[AI] MLVoca - Tentative avec ${model}...`);
            const resp = await axios.post("https://mlvoca.com/api/generate", {
                model,
                prompt: `SYSTEM: ${system}\n\nUSER: ${prompt}`,
                stream: false,
                format: "json"
            }, { timeout: 25000 });

            const content = resp.data?.response;
            if (isValidAIResponse(content)) return content;
        } catch (e) {
            console.warn(`[AI] MLVoca Error (${model}):`, e.message);
        }
    }
    return null;
}

/**
 * Call Puter's AI over its V1 OpenAI-compatible endpoint.
 */
async function callPuterAPI(system, prompt) {
    const key = process.env.PUTER_API_KEY || process.env.PUTER_TOKEN;
    if (!key || key.length < 6 || key === 'test_key') {
        return null;
    }

    const messages = [
        { role: "system", content: system },
        { role: "user", content: prompt }
    ];

    // Priority to Flash for speed
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gpt-4o"];

    for (const model of models) {
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
            const errorBody = e.response?.data;
            const status = e.response?.status;
            console.warn(`[AI] Puter V1 API Error (${model}) [Status: ${status}]:`, errorBody || e.message);

            if (status === 401 || (errorBody && JSON.stringify(errorBody).includes("Unauthorized"))) {
                console.error("[AI] Puter API (V1) : Authentification échouée. Vérifiez votre PUTER_TOKEN.");
            }
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
    // Prioritizing Gemini as requested by user
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "meta-llama-3.1-70b-instruct", "gpt-4o"];

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
    if (!process.env.OPENROUTER_API_KEY) {
        console.warn("[AI] OpenRouter: Clé API manquante (OPENROUTER_API_KEY).");
        return null;
    }

    // Prioritizing extremely fast free models for speed
    const models = [
        "google/gemini-2.0-flash-exp:free",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemma-4-26b-a4b-it:free",
        "openrouter/free"
    ];

    for (const model of models) {
        try {
            console.log(`[AI] OpenRouter - Tentative avec ${model}...`);
            const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/skype-bot/arise',
                    'X-Title': 'Arise RPG',
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // Tight timeout for faster failover
            });

            const content = resp.data?.choices?.[0]?.message?.content;
            if (isValidAIResponse(content)) return content;
            else console.warn(`[AI] OpenRouter ${model} a renvoyé une réponse invalide.`);
        } catch (e) {
            const errorMsg = e.response?.data?.error?.message || e.message;
            console.warn(`[AI] OpenRouter Error (${model}):`, errorMsg);
            if (errorMsg.includes("credits")) {
                console.warn("[AI] OpenRouter: Plus de crédits ou modèle non gratuit. Passage au suivant.");
            }
            continue;
        }
    }
    return null;
}

async function callBlackbox(system, prompt) {
    const models = ["deepseek-v3", "llama-3.1-70b", "gpt-4o", "gemini-pro"];
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
    // Priority models on gen.pollinations.ai
    const models = ['openai', 'mistral', 'llama', 'qwen-coder', 'searchgpt'];
    const key = process.env.POLLINATIONS_API_KEY;

    for (const model of models) {
        try {
            console.log(`[AI] Pollinations Gen - Tentative avec ${model}...`);
            const headers = { 'Content-Type': 'application/json' };
            if (key) headers['Authorization'] = `Bearer ${key}`;

            const resp = await axios.post("https://gen.pollinations.ai/v1/chat/completions", {
                model: model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                jsonMode: true,
                stream: false
            }, {
                headers,
                timeout: 20000
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
    // Rotating models to find one that works for free
    const models = ['openai', 'mistral', 'llama', 'qwen-coder', 'unity', 'evil', 'p1', 'searchgpt'];

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
            timeout: 30000
            });

        const content = parsePuterResponse(resp.data);
        if (isValidAIResponse(content)) return content;
        } catch (e) {
            console.warn(`[AI] Pollinations POST Error (${model}):`, e.response?.data || e.message);
            continue;
        }
    }
    return null;
}

async function callPollinationsGET(system, prompt) {
    const models = ['openai', 'mistral', 'llama'];
    for (const model of models) {
        try {
            console.log(`[AI] Pollinations GET - Tentative avec ${model}...`);
            // GET API is very sensitive to length and encoding
            const cleanedPrompt = prompt.substring(prompt.length - 1000).replace(/["']/g, '');
            const fullPrompt = encodeURIComponent(cleanedPrompt);
            const systemEncoded = encodeURIComponent(system.substring(0, 800).replace(/["']/g, ''));
            const seed = Math.floor(Math.random() * 1000000);
            const url = `https://text.pollinations.ai/${fullPrompt}?model=${model}&seed=${seed}&system=${systemEncoded}&json=true`;

            const resp = await axios.get(url, { timeout: 25000 });
            if (isValidAIResponse(resp.data)) return resp.data;
        } catch (e) {
            console.warn(`[AI] Pollinations GET Error (${model}):`, e.message);
        }
    }
    return null;
}

/**
 * Call a local Ollama instance if available.
 */
async function callOllama(system, prompt) {
    let ollamaUrl = process.env.OLLAMA_URL || "http://192.168.1.66:11434";

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

async function callGPTOSS(system, prompt) {
    const models = ["gpt-oss-120b", "gpt-oss-20b"];
    for (const model of models) {
        try {
            console.log(`[AI] GPTOSS - Tentative avec ${model}...`);
            const resp = await axios.post("https://broken-water-d859.junioralive.workers.dev/v1/chat/completions", {
                model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                stream: false
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer dummy'
                },
                timeout: 20000
            });

            const content = resp.data?.choices?.[0]?.message?.content;
            if (isValidAIResponse(content)) return content;
        } catch (e) {
            console.warn(`[AI] GPTOSS Error (${model}):`, e.response?.data || e.message);
        }
    }
    return null;
}

/**
 * Call the Aether Brain (Lightweight Soul).
 */
async function callAether(system, prompt, options = {}) {
    try {
        console.log(`[AI] Aether Brain - Consultation de l'âme...`);
        const response = await aether.think(system, prompt, options);
        if (isValidAIResponse(response)) return response;
    } catch (e) {
        console.warn(`[AI] Aether Brain error:`, e.message);
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
/**
 * Race multiple provider attempts for speed.
 */
async function callAI(systemPrompt, userPrompt, options = {}) {
    const depth = options.depth || 0;
    if (depth > 2) return null;

    const maxSystemLength = 10000;
    const maxUserLength = 12000;
    const sanitizedSystem = systemPrompt.length > maxSystemLength ? systemPrompt.substring(0, maxSystemLength) : systemPrompt;
    let sanitizedUser = userPrompt;
    if (userPrompt.length > maxUserLength) {
        sanitizedUser = userPrompt.substring(0, 5000) + "\n...[TRUNCATED]...\n" + userPrompt.substring(userPrompt.length - 7000);
    }

    const providers = [
        { name: 'Aether Local (Beta)', fn: callAether },
        { name: 'Puter API (V1)', fn: callPuterAPI },
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'GPTOSS Proxy', fn: callGPTOSS },
        { name: 'Pollinations Gen', fn: callPollinationsGen },
        { name: 'Pollinations POST (Keyless)', fn: callPollinationsPOST },
        { name: 'Pollinations GET', fn: callPollinationsGET },
        { name: 'Ollama (Local)', fn: callOllama },
        { name: 'MLVoca (Free)', fn: callMLVoca },
        { name: 'LM Studio (Local)', fn: callLMStudio },
        { name: 'OpenRouter', fn: callOpenRouter },
        { name: 'Blackbox', fn: callBlackbox },
        { name: 'World Server (Local)', fn: callWorldServer }
    ];

    // Staggered execution for speed and fallback handling
    const timeouts = [];
    const callProvider = async (provider) => {
        try {
            const start = Date.now();
            console.log(`[AI] Launching ${provider.name}...`);
            let activeSystem = sanitizedSystem;
            if (depth >= 1) activeSystem = "MJ RPG. JSON: {\"narrative\": \"...\"}";

            const res = await provider.fn(activeSystem, sanitizedUser, options);
            if (isValidAIResponse(res)) {
                console.log(`[AI] ✅ ${provider.name} won in ${(Date.now() - start)/1000}s`);
                return typeof res === 'object' ? JSON.stringify(res) : res;
            }
            throw new Error("Invalid response");
        } catch (e) {
            throw e;
        }
    };

    return new Promise((resolve) => {
        let completed = false;
        let launchedCount = 0;
        let failedCount = 0;
        const launched = new Set();

        const launchAtIndex = (index) => {
            if (completed || index >= providers.length || launched.has(index)) return;

            launched.add(index);
            launchedCount++;
            const provider = providers[index];

            callProvider(provider).then(res => {
                if (!completed) {
                    completed = true;
                    timeouts.forEach(clearTimeout);
                    resolve(res);
                }
            }).catch(err => {
                failedCount++;
                console.warn(`[AI] Provider ${provider.name} (index ${index}) failed: ${err.message}`);

                if (failedCount >= providers.length) {
                    if (!completed) {
                        completed = true;
                        timeouts.forEach(clearTimeout);
                        if (depth < 1) {
                            console.log("[AI] All providers failed. Retrying depth 1...");
                            setTimeout(() => {
                                resolve(callAI(systemPrompt, userPrompt, { ...options, depth: depth + 1 }));
                            }, 1000);
                        } else {
                            resolve(callMJFallback(userPrompt));
                        }
                    }
                } else {
                    // Try the very next one immediately on failure
                    launchAtIndex(index + 1);
                }
            });

            // Schedule the next one in the sequence anyway (staggered)
            const nextDelay = index === 0 ? 1000 : 4000;
            timeouts.push(setTimeout(() => launchAtIndex(index + 1), nextDelay));
        };

        launchAtIndex(0);
    });
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
