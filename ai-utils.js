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
    "gpt-4o",
    "claude-3-5-sonnet",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "meta-llama-3.1-70b-instruct"
];

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

    if (errorMarkers.some(m => lower.includes(m))) return false;
    if (cleaned.startsWith('data: [DONE]') || cleaned === '[DONE]') return false;
    if (lower.includes('<!doctype html>') || lower.includes('<html>')) return false;

    // Reject repetitive garbage (like in the screenshot)
    if (/([\[\]{}])\1{5,}/.test(cleaned)) return false; // More than 5 consecutive brackets

    // Reject if too few alphanumeric characters compared to length
    const alphaNumericMatch = cleaned.match(/[a-zA-Z0-9]/g);
    if (!alphaNumericMatch || alphaNumericMatch.length < cleaned.length * 0.1) {
        // Unless it's a very short but valid JSON
        if (!(cleaned.startsWith('{') && cleaned.endsWith('}') && cleaned.length > 10)) {
            return false;
        }
    }

    // Additional check: if it looks like a JSON but narrative is too short/empty
    if (cleaned.includes('{') && cleaned.includes('}')) {
        try {
            // Find the JSON block if it's wrapped in text
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            const jsonPart = cleaned.substring(start, end + 1);

            const parsed = JSON.parse(jsonPart);
            const narrative = parsed.narrative || parsed.message || parsed.text || "";
            // We want at least some narrative or at least some logical actions
            if (narrative.length < 5 && (!parsed.actions || parsed.actions.length === 0)) return false;
        } catch(e) {
            // If it's not valid JSON and doesn't look like plain text, reject
            if (cleaned.length < 20) return false;
        }
    } else {
        if (cleaned.length < 20) return false;
    }

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

async function callLocalAI(system, prompt, isRaw = false) {
    const baseUrl = process.env.LOCALAI_URL || "http://localhost:8080/v1";
    const model = process.env.LOCALAI_MODEL || "gpt-4";
    try {
        console.log(`[AI] LocalAI - Tentative avec ${model}...`);
        const resp = await axios.post(`${baseUrl}/chat/completions`, {
            model: model,
            messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
            temperature: 0.7
        }, {
            timeout: 30000
        });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isRaw || isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] LocalAI Error:`, e.message);
    }
    return null;
}

// ============================================================================
// PROVIDERS CLOUD
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

    // Check for advanced auth token if available (as requested via link)
    const token = process.env.PUTER_AUTH_TOKEN;

    // Pick one model randomly to participate in the race
    const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash"];
    const model = models[Math.floor(Math.random() * models.length)];

    try {
        const options = { model: model };
        if (token) options.token = token;

        const result = await puter.ai.chat([
            { role: "system", content: system },
            { role: "user", content: prompt }
        ], options);

        return parsePuterResponse(result);
    } catch (e) {
        return null;
    }
}

async function callOpenRouter(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY) return null;

    // Select 3 best free models and shuffle them to avoid sequential failures
    const allModels = [
        "google/gemma-3-27b-it:free",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "meta-llama/llama-3.3-70b-instruct:free"
    ];
    const models = allModels.sort(() => Math.random() - 0.5).slice(0, 3);

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
    const models = ["deepseek-v3", "llama-3.1-70b"];
    // Shuffle to avoid sticking to a failing model
    const model = models[Math.floor(Math.random() * models.length)];

    try {
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
        if (typeof resp.data === 'string') {
            result = parseSSEResponse(resp.data) || resp.data;
        } else if (resp.data.text) {
            result = resp.data.text;
        } else if (Array.isArray(resp.data)) {
                result = resp.data.map(d => d.content || d.text || "").join("");
        } else {
            result = JSON.stringify(resp.data);
        }

        result = result.replace(/Generated by Blackbox\.ai/gi, '').trim();
        return result;
    } catch (e) {
        return null;
    }
}


async function callPollinationModel(system, prompt, model) {
    try {
        const maxLen = 12000;
        let activeSystem = system;
        if (system.length > maxLen) {
            activeSystem = system.substring(0, 4000) + "\n[...]\n" + system.substring(system.length - 6000);
        }
        const activePrompt = prompt.length > 10000 ? prompt.substring(prompt.length - 10000) : prompt;

        const resp = await axios.post("https://text.pollinations.ai/", {
            messages: [
                { role: "system", content: activeSystem },
                { role: "user", content: activePrompt }
            ],
            model: model,
            seed: Math.floor(Math.random() * 1000000),
            jsonMode: true
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 25000
        });

        let content = resp.data?.choices?.[0]?.message?.content || resp.data?.content;
        if (!content && typeof resp.data === 'object') content = JSON.stringify(resp.data);
        return content;
    } catch (e) {
        return null;
    }
}

async function callOllama(system, prompt, isRaw = false) {
    const baseUrl = process.env.OLLAMA_URL || "http://localhost:11434/api/chat";
    const model = process.env.OLLAMA_MODEL || "gemma3:4b";

    try {
        console.log(`[AI] Ollama Local - Tentative avec ${model}...`);
        const resp = await axios.post(baseUrl, {
            model: model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 1024
            }
        }, {
            timeout: 45000
        });

        const content = resp.data?.message?.content;
        if (isRaw || isValidAIResponse(content)) return content;
    } catch (e) {
        // Si Ollama échoue, on tente Pollinations en dernier recours
        console.warn(`[AI] Ollama Local Error:`, e.message);
        try {
            console.log(`[AI] Pollinations (Aetherys Core) - Traitement de secours...`);
            const content = await callPollinationModel(system, prompt, "openai");
            if (isRaw || isValidAIResponse(content)) return content;
        } catch (e2) {
            console.warn(`[AI] Pollinations Fallback Error:`, e2.message);
        }
    }
    return null;
}

/**
 * Local MJ Fallback in case all AI providers fail.
 */
async function callMJFallback(prompt) {
    console.log("[AI] Utilisation du MJ Fallback Local.");

    let action = "ton action";
    // Improved extraction logic for the complex RPG prompt
    const actionBlockMatch = prompt.match(/### RÉSUMÉ DES ACTIONS À TRAITER ###\n([\s\S]*?)\n\n###/);
    if (actionBlockMatch) {
        const lines = actionBlockMatch[1].trim().split('\n');
        if (lines.length > 0) {
            // Take the last action line if multiple players, or just the first one
            const lastLine = lines[lines.length - 1];
            const contentMatch = lastLine.match(/ACTIONS: (.*)$/);
            if (contentMatch) action = contentMatch[1].trim();
        }
    } else {
        // Fallback to simpler search
        const simpleMatch = prompt.match(/ACTION: (.*)$/i);
        if (simpleMatch) action = simpleMatch[1].trim();
    }

    // Truncate action if too long
    if (action.length > 100) action = action.substring(0, 97) + "...";

    const responses = [
        `Tu t'efforces de réaliser "${action}", mais une étrange brume semble ralentir tes mouvements. Tu réussis l'essentiel, bien que les conséquences précises restent floues.`,
        `Le destin semble incertain alors que tu tentes "${action}". L'énergie ambiante crépite mais ne se stabilise pas. Tu agis avec prudence.`,
        `"${action}" est accompli. Tu sens le poids de tes décisions peser sur l'air ambiant, même si le monde reste étrangement silencieux.`,
        `Alors que tu effectues "${action}", tu as l'impression d'être observé. Ton geste est précis, mais le flux magique est trop instable.`
    ];

    const narrative = responses[Math.floor(Math.random() * responses.length)];

    let note = "Le flux d'Ether est instable. Vérifiez vos clés API cloud.";

    // REMOVED redundant next trigger hint as it is appended by ai-handler.js
    return JSON.stringify({
        narrative: `[🤖 MJ FALLBACK]\n\n${narrative}\n\n_Note: ${note}_`,
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
 * Strategy: Parallel Race (First-to-Respond) to maximize reliability and speed.
 */
async function callAI(systemPrompt, userPrompt, options = {}) {
    const depth = options.depth || 0;
    if (depth > 2) return null;

    // Smart Prompt Adaptation for Retries
    let activeSystem = systemPrompt;
    if (depth === 1) {
        activeSystem = "Tu es le MJ du RPG Aetherys. Style Manhwa. Réponds au format JSON: {\"narrative\": \"...\", \"actions\": [], \"imagePrompt\": \"...\"}";
    } else if (depth >= 2) {
        activeSystem = "Réponds uniquement en JSON: {\"narrative\": \"...\"}";
    }

    // Context Compression
    const maxSystemLength = 15000;
    const maxUserLength = 20000;
    const sanitizedSystem = activeSystem.length > maxSystemLength ? activeSystem.substring(0, maxSystemLength) : activeSystem;
    let sanitizedUser = userPrompt;
    if (userPrompt.length > maxUserLength) {
        const headLength = 8000;
        const tailLength = 10000;
        sanitizedUser = userPrompt.substring(0, headLength) + "\n...[TRUNCATED]...\n" + userPrompt.substring(userPrompt.length - tailLength);
    }

    console.log(`[AI] Lancement de la Course Parallèle (depth: ${depth})...`);

    // Pollinations AI is strictly required as primary provider
    const raceModels = [
        { name: 'Pollinations-Matrix-Gemma', fn: (s, p) => callPollinationModel(s, p, "openai"), timeout: 25000 },
        { name: 'Pollinations-Matrix-Mistral', fn: (s, p) => callPollinationModel(s, p, "mistral"), timeout: 25000 }
    ];

    // Create a promise for each model that resolves only on valid response
    const racePromises = raceModels.map(m => {
        return (async () => {
            try {
                const start = Date.now();
                const result = await withTimeout(m.fn(sanitizedSystem, sanitizedUser), m.timeout, m.name);
                if (isValidAIResponse(result)) {
                    const duration = (Date.now() - start) / 1000;
                    console.log(`[AI] 🏁 GAGNANT: ${m.name} en ${duration.toFixed(2)}s`);
                    return { source: m.name, content: result };
                }
                throw new Error("Invalid response");
            } catch (e) {
                return null;
            }
        })();
    });

    // Wait for the first non-null result
    const firstResult = await new Promise(async (resolve) => {
        let finished = 0;
        let resolved = false;

        for (const p of racePromises) {
            p.then(res => {
                if (resolved) return;
                if (res) {
                    resolved = true;
                    resolve(res.content);
                } else {
                    finished++;
                    if (finished === racePromises.length) resolve(null);
                }
            });
        }

        // Safety global timeout for the whole race
        setTimeout(() => { if (!resolved) resolve(null); }, 35000);
    });

    if (firstResult) return firstResult;

    // FALLBACK CHAIN: If the race failed, try robust cloud then local
    console.warn(`[AI] La course a échoué. Tentative de secours séquentielle...`);
    const fallbacks = [
        { name: 'OpenRouter-Robust', fn: callOpenRouter, timeout: 35000 },
        { name: 'LocalAI', fn: callLocalAI, timeout: 35000 },
        { name: 'Ollama-Local', fn: callOllama, timeout: 40000 }
    ];

    for (const f of fallbacks) {
        try {
            console.log(`[AI] Secours: ${f.name}...`);
            const res = await withTimeout(f.fn(sanitizedSystem, sanitizedUser), f.timeout, f.name);
            if (isValidAIResponse(res)) {
                console.log(`[AI] ✅ Secours réussi avec ${f.name}`);
                return res;
            }
        } catch (e) {
            console.warn(`[AI] ❌ Secours échoué (${f.name}):`, e.message);
        }
    }

    // RETRY WITH BACKOFF
    if (depth < 1) {
        console.log("[AI] Échec global. Nouvelle tentative dans 3s...");
        await new Promise(r => setTimeout(r, 3000));
        return callAI(systemPrompt, userPrompt, { ...options, depth: depth + 1 });
    }

    // ULTIMATE FALLBACK
    return await callMJFallback(userPrompt);
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
