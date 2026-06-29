const axios = require('axios');
const { JSDOM } = require('jsdom');
const { askLocalAI, checkLocalAIStatus } = require('./localAI');

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
    "gpt-4o",
    "claude-3-5-sonnet",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "meta-llama-3.1-70b-instruct"
];

// Configuration Gemma 3
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
const WORLD_SERVER_URL = `http://localhost:${process.env.MODEL_PORT || 3001}`;

/**
 * Detect responses that are not real narrative content.
 */
function isValidAIResponse(text) {
    if (!text) return false;

    // If it's an object, it's probably a valid JSON response already
    if (typeof text === 'object') return true;
    if (typeof text !== 'string') return false;

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

    if (cleaned.length < 150 && errorMarkers.some(m => lower.includes(m))) return false;
    if (cleaned.startsWith('data: [DONE]') || cleaned === '[DONE]') return false;
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

// ============================================================================
// PROVIDERS AI - ORDRE DE PRIORITÉ (IA Locale en premier)
// ============================================================================

/**
 * [1] Local AI Service (Ollama / vLLM) - PRIORITÉ MAXIMALE
 */
async function callLocalOpenAI(system, prompt) {
    try {
        console.log(`[AI] 🧠 Local AI Service (${process.env.MODEL || OLLAMA_MODEL}) - Tentative...`);
        const content = await askLocalAI(system, prompt);
        if (isValidAIResponse(content)) {
            console.log(`[AI] ✅ Local AI - Succès`);
            return content;
        }
    } catch (e) {
        console.warn(`[AI] ❌ Local AI indisponible ou erreur: ${e.message}`);
    }
    return null;
}

/**
 * [2] World Server Local - Proxy enrichi (PRIORITÉ SECONDAIRE)
 */
async function callWorldServer(system, prompt) {
    try {
        console.log(`[AI] 🧠 World Server (Proxy) - Tentative sur ${WORLD_SERVER_URL}...`);
        const resp = await axios.post(`${WORLD_SERVER_URL}/v1/chat/completions`, {
            model: OLLAMA_MODEL,
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            stream: false
        }, { timeout: 8000 }); // Fast fail for local proxy

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) {
            console.log(`[AI] ✅ World Server - Succès`);
            return content;
        }
    } catch (e) {
        console.warn(`[AI] ❌ World Server indisponible: ${e.message}`);
    }
    return null;
}

/**
 * [2] Ollama Direct - Connexion directe à Ollama (BYPASS World Server)
 */
async function callOllama(system, prompt) {
    const apiBaseUrl = OLLAMA_URL + (OLLAMA_URL.includes('/api') ? '' : '/api');
    const isCloud = OLLAMA_URL.includes('ollama.com');

    try {
        console.log(`[AI] 🧠 Ollama Direct (${OLLAMA_MODEL}) - Tentative sur ${apiBaseUrl}...`);

        const payload = {
            model: OLLAMA_MODEL,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt }
            ],
            stream: false,
            format: 'json',
            options: {
                temperature: 0.85,
                num_predict: 2048,
                num_ctx: 16384,
                top_p: 0.9,
                repeat_penalty: 1.1
            }
        };

        const headers = { 'Content-Type': 'application/json' };
        if (isCloud && process.env.OLLAMA_API_KEY) {
            headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`;
        }

        const resp = await axios.post(`${apiBaseUrl}/chat`, payload, {
            headers,
            timeout: 10000 // Fast fail for direct local Ollama
        });

        const content = resp.data?.message?.content || resp.data?.response;
        if (isValidAIResponse(content)) {
            console.log(`[AI] ✅ Ollama Direct (${OLLAMA_MODEL}) - Succès`);
            return content;
        }
    } catch (e) {
        console.warn(`[AI] ❌ Ollama Direct error: ${e.response?.data?.error || e.message}`);
    }
    return null;
}

/**
 * [3] Llamafile (Local) - Alternative locale
 */
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
        }, { timeout: 45000 });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] Llamafile indisponible: ${e.message}`);
    }
    return null;
}

/**
 * [4] 9Router (Local)
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
                timeout: 15000
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

/**
 * [5] LM Studio (Local)
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

// ============================================================================
// PROVIDERS CLOUD (FALLBACKS)
// ============================================================================

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
                timeout: 10000
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

async function callPuterSDK(system, prompt) {
    if (!puter || !puter.ai) return null;
    const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash"];

    for (const model of models) {
        try {
            console.log(`[AI] Puter SDK (Keyless) - Tentative avec ${model}...`);
            const result = await withTimeout(
                puter.ai.chat([
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ], { model: model }),
                20000,
                `Puter SDK (${model})`
            );

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
        "google/gemma-3-4b-it:free",
        "google/gemma-3-12b-it:free",
        "google/gemma-3-27b-it:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "google/gemini-2.0-flash-exp:free",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "google/gemini-2.0-pro-exp-02-05:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-r1:free",
        "nvidia/llama-3.1-nemotron-70b-instruct:free",
        "mistralai/mistral-7b-instruct:free",
        "microsoft/phi-3-mini-128k-instruct:free",
        "openchat/openchat-7b:free"
    ];

    for (const model of models) {
        try {
            console.log(`[AI] OpenRouter - Tentative avec ${model}`);
            const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: model,
                messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
                transforms: ["middle-out"]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/Eoza-cell/GHENO-CITY-2',
                    'X-Title': 'Gheno City 2'
                },
                timeout: 10000
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
                    { role: "user", content: `System Instruction: ${system}\n\nUser RPG Action: ${prompt}\n\nFormat your output as a valid JSON object starting with { and ending with }. Ensure all keys are quoted.` }
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
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Referer': 'https://www.blackbox.ai/',
                    'Origin': 'https://www.blackbox.ai/',
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'x-blackbox-device-id': 'gc2-' + Math.random().toString(36).substring(2, 15)
                },
                timeout: 25000
            });

            let result = "";
            // Blackbox often returns a stream or a combined text
            if (typeof resp.data === 'string') {
                result = parseSSEResponse(resp.data) || resp.data;
            } else if (resp.data.text) {
                result = resp.data.text;
            } else if (Array.isArray(resp.data)) {
                 result = resp.data.map(d => d.content || d.text || "").join("");
            } else {
                result = JSON.stringify(resp.data);
            }

            // Cleanup potential extra markers from Blackbox
            result = result.replace(/Generated by Blackbox\.ai/gi, '').trim();

            if (isValidAIResponse(result)) {
                console.log(`[AI] ✅ Blackbox - Succès (${model})`);
                return result;
            }
        } catch (e) {
            console.warn(`[AI] ❌ Blackbox error (${model}): ${e.message}`);
            continue;
        }
    }
    return null;
}

async function callPollinationsPOST(system, prompt) {
    const models = ['openai', 'mistral', 'llama', 'p1'];
    const shuffled = models.sort(() => Math.random() - 0.5);

    for (const model of shuffled) {
        try {
            console.log(`[AI] Pollinations V1 (Keyless) - Tentative avec ${model}...`);
            const resp = await axios.post("https://text.pollinations.ai/", {
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                model: model,
                seed: Math.floor(Math.random() * 1000000),
                jsonMode: true
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 25000
            });

            let content = "";
            if (typeof resp.data === 'string') {
                content = resp.data;
            } else if (resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message) {
                content = resp.data.choices[0].message.content;
            } else {
                content = JSON.stringify(resp.data);
            }

            if (isValidAIResponse(content)) {
                console.log(`[AI] ✅ Pollinations V1 - Succès (${model})`);
                return content;
            }
        } catch (e) {
            console.warn(`[AI] ❌ Pollinations V1 Error (${model}):`, e.message);
            continue;
        }
    }
    return null;
}

async function callPollinationsGen(system, prompt) {
    const key = process.env.POLLINATIONS_API_KEY;
    if (!key) return null;

    const models = ['openai', 'mistral', 'llama', 'unity'];
    for (const model of models) {
        try {
            console.log(`[AI] Pollinations Gen (Keyed) - Tentative avec ${model}...`);
            const resp = await axios.post("https://gen.pollinations.ai/v1/chat/completions", {
                model: model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            }, {
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                },
                timeout: 12000
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

async function callPollinationsGET(system, prompt) {
    try {
        console.log(`[AI] Pollinations GET - Tentative...`);
        // Pollinations has strict limits on URL length
        const miniPrompt = prompt.substring(prompt.length - 1200);
        const fullPrompt = encodeURIComponent(miniPrompt);
        const systemEncoded = encodeURIComponent(system.substring(0, 1000));
        const seed = Math.floor(Math.random() * 1000000);
        const url = `https://text.pollinations.ai/${fullPrompt}?model=openai&seed=${seed}&system=${systemEncoded}&json=true`;

        const resp = await axios.get(url, { timeout: 15000 });
        let content = resp.data;
        if (typeof content === 'object') {
            content = content.choices?.[0]?.message?.content || JSON.stringify(content);
        }
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] Pollinations GET Error:`, e.message);
        return null;
    }
    return null;
}

/**
 * Local MJ Fallback in case all AI providers fail.
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
        narrative: `[🤖 MJ FALLBACK]\n\n${narrative}\n\n_Note: Gemma 3 (IA locale) est actuellement indisponible. Utilisez **ollama serve** ou vérifiez vos clés API cloud._\n\n💡 *Note:* Une seule personne peut \`next\`, mais elle doit attendre que tous les autres aient fini leurs actions pour que tout soit pris en compte.`,
        actions: []
    });
}

// ============================================================================
// MAIN AI ENTRY POINT
// ============================================================================

/**
 * Helper to wrap a promise with a timeout
 */
function withTimeout(promise, ms, label = "Operation") {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

/**
 * Main AI entry point.
 * Priorité: IA Locale > Ollama Direct > Autres locaux > Cloud > Fallback
 */
async function callAI(systemPrompt, userPrompt, options = {}) {
    const depth = options.depth || 0;
    if (depth > 2) return null;

    // Preserve context: the RP engine relies on scene isolation and detailed stats.
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

    // ORDRE DE PRIORITÉ: Optimisé pour la réactivité (OpenRouter en priorité suite à demande utilisateur)
    const providers = [
        // === CLOUD (Priorité suite à demande utilisateur) ===
        { name: 'OpenRouter Free', fn: callOpenRouter, timeout: 25000 },
        { name: 'Pollinations Free', fn: callPollinationsFree, timeout: 20000 },

        // === LOCAUX ===
        { name: 'Local OpenAI', fn: callLocalOpenAI, timeout: 15000 },
        ...(options.skipWorldServer ? [] : [{ name: 'World Server', fn: callWorldServer, timeout: 15000 }]),
        { name: 'Ollama Direct', fn: callOllama, timeout: 20000 },

        // === CLOUD (Fallbacks robustes) ===
        { name: 'Blackbox', fn: callBlackbox, timeout: 30000 },
        { name: 'Pollinations POST', fn: callPollinationsPOST, timeout: 25000 },

        // === CLOUD SECONDAIRES ===
        { name: 'Puter SDK', fn: callPuterSDK, timeout: 15000 },
        { name: 'Puter API', fn: callPuterAPI, timeout: 10000 }
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

            // Apply provider-specific timeout
            const result = await withTimeout(
                provider.fn(activeSystem, sanitizedUser, options),
                provider.timeout || 30000,
                provider.name
            );
            const providerDuration = (Date.now() - providerStart) / 1000;

            if (isValidAIResponse(result)) {
                console.log(`[AI] ✅ Succès avec ${provider.name} en ${providerDuration.toFixed(2)}s`);
                // Verify the result is not just a technical JSON dump without narrative
                if (result.trim().startsWith('{')) {
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

    // Ultimate fallback
    return callMJFallback(userPrompt);
}

/**
 * [FREE] Pollinations (Direct link) - Ultre-rapide et gratuit, pas besoin de clé.
 */
async function callPollinationsFree(system, prompt) {
    try {
        const seed = Math.floor(Math.random() * 1000000);
        // Using GET as a more reliable fallback for Pollinations Free
        const url = `https://text.pollinations.ai/${encodeURIComponent(prompt.substring(0, 1000))}?model=openai&system=${encodeURIComponent(system.substring(0, 1000))}&seed=${seed}&json=true`;

        console.log(`[AI] Pollinations Free - Tentative via GET...`);
        const resp = await axios.get(url, { timeout: 15000 });

        let content = resp.data;
        if (typeof content === 'object') {
             content = content.choices?.[0]?.message?.content || JSON.stringify(content);
        }

        if (isValidAIResponse(content)) {
            console.log("[AI] ✅ Pollinations Free - Succès");
            return content;
        }
    } catch (e) {
        console.warn("[AI] ❌ Pollinations Free Error:", e.message);

        // Final fallback to POST if GET fails
        try {
            const resp = await axios.post("https://text.pollinations.ai/", {
                messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
                model: "openai",
                jsonMode: true
            }, { timeout: 15000 });
            let content = resp.data?.choices?.[0]?.message?.content || (typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data));
            if (isValidAIResponse(content)) return content;
        } catch (innerE) {}
    }
    return null;
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
