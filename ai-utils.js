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

    // If it's just technical jargon without narrative content
    if (cleaned.startsWith('data: [DONE]') || cleaned === '[DONE]') return false;

    // Check if it's an HTML error page
    if (lower.includes('<!doctype html>') || lower.includes('<html>')) return false;

    // Robust JSON detection
    if (cleaned.startsWith('{')) {
        try {
            const parsed = JSON.parse(cleaned);
            if (parsed.error || parsed.err || parsed.errorMessage) return false;

            // If it's a valid OpenAI-compatible JSON envelope
            if (parsed.choices && parsed.choices[0]?.message?.content) {
                return true;
            }

            // If it's a direct structured roleplay response with narrative
            const lowerText = cleaned.toLowerCase();
            if (lowerText.includes('"narrative"') || lowerText.includes('"actions"')) {
                if (cleaned.length > 20) return true;
            }
        } catch (e) {
            // Not parseable as JSON, could be plain text starting with {
        }
    }

    // If it's a tiny response with an error marker, it's definitely an error
    if (cleaned.length < 300 && errorMarkers.some(m => lower.includes(m))) {
        return false;
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

async function callG4F(system, prompt, options = {}) {
    try {
        console.log(`[AI] Executing GPT4Free (g4f) python provider engine...`);
        const { execSync } = require('child_process');
        const path = require('path');
        const scriptPath = path.join(__dirname, 'g4f_handler.py');

        const tmpSys = path.join(__dirname, 'assets', `sys_g4f_${Date.now()}.txt`);
        const tmpUsr = path.join(__dirname, 'assets', `usr_g4f_${Date.now()}.txt`);
        const fs = require('fs');
        fs.writeFileSync(tmpSys, system);
        fs.writeFileSync(tmpUsr, prompt);

        const output = execSync(`python3 "${scriptPath}" "${tmpSys}" "${tmpUsr}"`, { timeout: 25000, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        if (fs.existsSync(tmpSys)) fs.unlinkSync(tmpSys);
        if (fs.existsSync(tmpUsr)) fs.unlinkSync(tmpUsr);

        const cleanedOutput = output.replace(/System:[\s\S]*?User:/gi, '').trim();
        if (isValidAIResponse(cleanedOutput)) return cleanedOutput;
    } catch (e) {
        console.warn(`[AI] GPT4Free (g4f) execution failed:`, e.message);
    }
    return null;
}

/**
 * Call the Khoj AI assistant self-hosted endpoint if available.
 */
async function callKhoj(system, prompt, options = {}) {
    const url = process.env.KHOJ_URL || "http://localhost:8000/v1/chat/completions";
    const apiKey = process.env.KHOJ_API_KEY || "dummy";
    try {
        console.log(`[AI] Khoj Assistant - Tentative sur ${url}...`);
        const resp = await axios.post(url, {
            model: "khoj",
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] Khoj Assistant indisponible: ${e.message}`);
    }
    return null;
}

/**
 * Call the Kimi K3 Free Desktop AI proxy endpoint if available.
 */
async function callKimiK3(system, prompt, options = {}) {
    const url = process.env.KIMI_K3_URL || "http://localhost:5000/v1/chat/completions";
    const apiKey = process.env.KIMI_K3_API_KEY || "dummy";
    try {
        console.log(`[AI] Kimi K3 Proxy - Tentative sur ${url}...`);
        const resp = await axios.post(url, {
            model: "kimi-k3-code",
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] Kimi K3 Proxy indisponible: ${e.message}`);
    }
    return null;
}

/**
 * Call the OmniBrain AI Proxy Smart endpoint if available.
 */
/**
 * Call a vLLM OpenAI-compatible online serving server.
 * Documentation: https://docs.vllm.ai/en/stable/serving/online_serving/#openai-compatible-server
 */
/**
 * Calls local Python Hugging Face Transformers pipeline (Gemma 4B / 2B).
 */
async function callLocalGemmaTransformers(system, prompt, options = {}) {
    const { exec } = require('child_process');
    const path = require('path');

    return new Promise((resolve) => {
        const scriptPath = path.join(__dirname, 'transformer_model.py');
        const sysArg = JSON.stringify(system);
        const userArg = JSON.stringify(prompt);

        console.log("[AI] Launching Local Gemma 4B Hugging Face Transformers Python Process...");
        exec(`python3 "${scriptPath}" ${sysArg} ${userArg}`, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                console.warn("[AI] Local Gemma Transformers Process Error:", error.message);
                return resolve(null);
            }
            if (stdout && stdout.includes("--- RESPONSE ---")) {
                const match = stdout.match(/--- RESPONSE ---\s*([\s\S]*?)\s*----------------/);
                if (match && match[1]) {
                    const text = match[1].trim();
                    if (isValidAIResponse(text)) return resolve(text);
                }
            }
            resolve(null);
        });
    });
}

async function callVLLM(system, prompt, options = {}) {
    let vllmUrl = process.env.VLLM_URL || "http://192.168.1.66:8000/v1/chat/completions";
    if (!vllmUrl.startsWith('http')) vllmUrl = 'http://' + vllmUrl;
    if (!vllmUrl.includes('/v1/chat/completions')) {
        vllmUrl = vllmUrl.replace(/\/$/, '') + '/v1/chat/completions';
    }

    const apiKey = process.env.VLLM_API_KEY || "token-dummy";
    const model = process.env.VLLM_MODEL || "zai-org/GLM-5.2";

    try {
        console.log(`[AI] vLLM Server - Tentative sur ${vllmUrl} (Modèle: ${model})...`);
        const resp = await axios.post(vllmUrl, {
            model: model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2048,
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 20000
        });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] vLLM Server Error (${vllmUrl}):`, e.message);
    }
    return null;
}

async function callOmniBrain(system, prompt, options = {}) {
    const url = process.env.OMNIBRAIN_URL || "http://localhost:8080/v1/chat/completions";
    const apiKey = process.env.OMNIBRAIN_API_KEY || "dummy";
    try {
        console.log(`[AI] OmniBrain Proxy - Tentative sur ${url}...`);
        const resp = await axios.post(url, {
            model: "google/gemma-4-31b-it",
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] OmniBrain Proxy indisponible: ${e.message}`);
    }
    return null;
}

/**
 * Call the Puter Account Pool Manager proxy endpoint if available.
 */
async function callPuterPoolManager(system, prompt, options = {}) {
    const baseUrl = process.env.PUTER_POOL_URL || "http://localhost:3000/v1";
    try {
        console.log(`[AI] Puter Pool Manager - Tentative sur ${baseUrl}/chat/completions...`);
        const resp = await axios.post(`${baseUrl}/chat/completions`, {
            model: "google/gemma-4-31b-it",
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            stream: false
        }, { timeout: 15000 });

        const content = resp.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] Puter Pool Manager indisponible: ${e.message}`);
    }
    return null;
}

async function callMLVoca(system, prompt, options = {}) {
    const models = ["deepseek-r1:1.5b", "tinyllama"];
    const jsonMode = options.jsonMode !== false;
    for (const model of models) {
        try {
            console.log(`[AI] MLVoca - Tentative avec ${model}...`);
            const payload = {
                model,
                prompt: `SYSTEM: ${system}\n\nUSER: ${prompt}`,
                stream: false
            };
            if (jsonMode) {
                payload.format = "json";
            }
            const resp = await axios.post("https://mlvoca.com/api/generate", payload, { timeout: 25000 });

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
async function callPuterAPI(system, prompt, options = {}) {
    const key = process.env.PUTER_API_KEY || process.env.PUTER_TOKEN;
    if (!key || key.length < 6 || key === 'test_key') {
        return null;
    }

    const messages = [
        { role: "system", content: system },
        { role: "user", content: prompt }
    ];

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
async function callPuterSDK(system, prompt, options = {}) {
    if (!puter || !puter.ai) {
        console.warn("[AI] Puter SDK non initialisé ou indisponible.");
        return null;
    }
    const models = ["google/gemma-4-31b-it", "google/gemma-4-26b-a4b-it", "gemini-1.5-flash", "gemini-1.5-pro", "meta-llama-3.1-70b-instruct", "gpt-4o"];

    for (const model of models) {
        try {
            console.log(`[AI] Puter SDK - Tentative avec ${model}...`);

            const chatPromise = (async () => {
                try {
                    return await puter.ai.chat([
                        { role: "system", content: system },
                        { role: "user", content: prompt }
                    ], { model: model });
                } catch (err) {
                    return await puter.ai.chat(`${system}\n\n${prompt}`, { model: model });
                }
            })();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout SDK Puter")), 25000)
            );

            const result = await Promise.race([chatPromise, timeoutPromise]);

            const content = parsePuterResponse(result);
            if (isValidAIResponse(content)) return content;
        } catch (e) {
            console.warn(`[AI] Puter SDK Error (${model}):`, e.message);
            continue;
        }
    }
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

async function callOpenRouter(system, prompt, options = {}) {
    if (!process.env.OPENROUTER_API_KEY) {
        console.warn("[AI] OpenRouter: Clé API manquante (OPENROUTER_API_KEY).");
        return null;
    }

    const models = [
        "google/gemma-4-31b-it:free",
        "google/gemma-4-26b-a4b-it:free",
        "google/gemini-2.0-flash-exp:free",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "meta-llama/llama-3.3-70b-instruct:free",
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
                timeout: 15000
            });

            const content = resp.data?.choices?.[0]?.message?.content;
            if (isValidAIResponse(content)) return content;
        } catch (e) {
            const errorMsg = e.response?.data?.error?.message || e.message;
            console.warn(`[AI] OpenRouter Error (${model}):`, errorMsg);
            continue;
        }
    }
    return null;
}

async function callBlackbox(system, prompt, options = {}) {
    const models = ["deepseek-v3", "llama-3.1-70b", "gpt-4o", "gemini-pro"];
    const jsonMode = options.jsonMode !== false;
    for (const model of models) {
        try {
            console.log(`[AI] Blackbox - Tentative avec ${model}...`);
            const resp = await axios.post("https://www.blackbox.ai/api/chat", {
                messages: [
                    { role: "user", content: `SYSTEM: ${system}\n\nUSER_ACTION: ${prompt}${jsonMode ? '\n\nIMPORTANT: Réponds uniquement en JSON valide.' : ''}` }
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

async function callHuggingFaceLocal(system, prompt, options = {}) {
    try {
        console.log(`[AI] Executing Hugging Face Transformers local model...`);
        const { execSync } = require('child_process');
        const path = require('path');
        const scriptPath = path.join(__dirname, 'transformer_model.py');

        // Pass system prompt and user action as separate clean JSON/arguments
        const tmpSys = path.join(__dirname, 'assets', `sys_${Date.now()}.txt`);
        const tmpUsr = path.join(__dirname, 'assets', `usr_${Date.now()}.txt`);
        const fs = require('fs');
        fs.writeFileSync(tmpSys, system);
        fs.writeFileSync(tmpUsr, prompt);

        const output = execSync(`python3 "${scriptPath}" "${tmpSys}" "${tmpUsr}"`, { timeout: 25000, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        if (fs.existsSync(tmpSys)) fs.unlinkSync(tmpSys);
        if (fs.existsSync(tmpUsr)) fs.unlinkSync(tmpUsr);

        const cleanedOutput = output
            .replace(/\[Python Transformer\][\s\S]*?\n/gi, '')
            .replace(/System:[\s\S]*?User:/gi, '')
            .trim();
        if (isValidAIResponse(cleanedOutput)) return cleanedOutput;
    } catch (e) {
        console.warn(`[AI] Hugging Face Transformers local execution failed:`, e.message);
    }
    return null;
}

/**
 * Call a local Ollama instance if available.
 */
async function callOllama(system, prompt, options = {}) {
    let ollamaUrl = process.env.OLLAMA_URL || "http://192.168.1.66:12434";
    const jsonMode = options.jsonMode !== false;

    if (!ollamaUrl.startsWith('http')) {
        ollamaUrl = 'http://' + ollamaUrl;
    }

    const apiBaseUrl = ollamaUrl.replace(/\/$/, '') + (ollamaUrl.includes('/api') ? '' : '/api');
    const isCloud = ollamaUrl.includes('ollama.com');

    try {
        console.log(`[AI] Ollama - Tentative sur ${apiBaseUrl}`);

        const payload = {
            // Default model is 'gemma4' local as requested by the user
            model: process.env.OLLAMA_MODEL || 'gemma4',
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt }
            ],
            stream: false,
            options: {
                temperature: 0.2,
                num_predict: 2048,  // Higher predict limit for deep world details
                num_ctx: 32768      // Expanding to 32k context window (Infinite Memory)
            }
        };
        if (jsonMode) {
            payload.format = 'json';
        }

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

async function call9Router(system, prompt, options = {}) {
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

async function callWorldServer(system, prompt, options = {}) {
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

async function callLlamafile(system, prompt, options = {}) {
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

async function callGPTOSS(system, prompt, options = {}) {
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

/**
 * Call the DevToolbox Free Keyless AI completion endpoint.
 */
async function callDevToolbox(system, prompt, options = {}) {
    try {
        console.log(`[AI] DevToolbox AI (Llama 3.2) - Tentative d'accès...`);
        const resp = await axios.post("https://devtoolbox-api.devtoolbox-api.workers.dev/ai/generate", {
            prompt: `SYSTEM: ${system}\n\nUSER: ${prompt}`,
            max_tokens: 1500,
            temperature: 0.85
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        const content = resp.data?.response;
        if (isValidAIResponse(content)) return content;
    } catch (e) {
        console.warn(`[AI] DevToolbox AI error:`, e.message);
    }
    return null;
}

async function callLMStudio(system, prompt, options = {}) {
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
 */
function callMJFallback(prompt) {
    console.log("[AI] Utilisation du Moteur Narratif ATR.");

    let action = "ton action";
    const actionMatch = prompt.match(/ACTION: (.*)$/i);
    if (actionMatch) action = actionMatch[1].trim().replace(/[*_]/g, '');

    const responses = [
        `Dans la pénombre d'ATR, ton geste « ${action} » s'exécute avec une précision glaciale. Les échos de la Causalité résonnent autour de toi alors que tu poursuis ton chapitre obligatoire.`,
        `Le fluide de l'éther réagit à ta volonté alors que tu accomplis « ${action} ». Les PNJ locaux observent ton déploiement de puissance avec un respect mêlé de crainte.`,
        `Ton action « ${action} » tranche le silence ambiant. Ton essence d'Héritier s'affirme et le chemin vers ton prochain objectif s'ouvre.`,
        `La résolution de ton être s'affirme lorsque tu réalises « ${action} ». Le destin d'ATR s'écrit à chacun de tes mouvements.`
    ];

    return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Main AI entry point.
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

    const { callTransformersJS } = require('./transformers-js-handler');
    const providers = [
        { name: 'Transformers.js Engine (@huggingface/transformers)', fn: callTransformersJS },
        { name: 'Ollama (Local Gemma 4)', fn: callOllama },
        { name: 'Hugging Face Transformers (Local Gemma)', fn: callHuggingFaceLocal },
        { name: 'GPT4Free (g4f) Engine', fn: callG4F },
        { name: 'Blackbox AI (Free)', fn: callBlackbox },
        { name: 'vLLM OpenAI Server', fn: callVLLM },
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'Puter Pool Manager', fn: callPuterPoolManager },
        { name: 'OmniBrain Proxy', fn: callOmniBrain },
        { name: 'OpenRouter', fn: callOpenRouter }
    ];

    const timeouts = [];
    const callProvider = async (provider) => {
        try {
            const start = Date.now();
            console.log(`[AI] Launching ${provider.name}...`);
            let activeSystem = sanitizedSystem;
            if (depth >= 1 && options.jsonMode !== false) activeSystem = "MJ RPG. JSON: {\"narrative\": \"...\"}";

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

        // Safety Global Timeout: 35 seconds max for the entire AI call
        const globalTimeout = setTimeout(() => {
            if (!completed) {
                completed = true;
                console.warn("[AI] 🚨 GLOBAL TIMEOUT REACHED (35s)! Forcing local MJ Fallback response...");
                timeouts.forEach(clearTimeout);
                resolve(callMJFallback(userPrompt));
            }
        }, 35000);

        const resolveWithClear = (res) => {
            if (!completed) {
                completed = true;
                clearTimeout(globalTimeout);
                timeouts.forEach(clearTimeout);
                resolve(res);
            }
        };

        const launchAtIndex = (index) => {
            if (completed || index >= providers.length || launched.has(index)) return;

            launched.add(index);
            launchedCount++;
            const provider = providers[index];

            callProvider(provider).then(res => {
                resolveWithClear(res);
            }).catch(err => {
                failedCount++;
                console.warn(`[AI] Provider ${provider.name} (index ${index}) failed: ${err.message}`);

                if (failedCount >= providers.length) {
                    if (!completed) {
                        if (depth < 1) {
                            console.log("[AI] All providers failed. Retrying depth 1...");
                            setTimeout(() => {
                                if (!completed) {
                                    resolve(callAI(systemPrompt, userPrompt, { ...options, depth: depth + 1 }));
                                }
                            }, 1000);
                        } else {
                            resolveWithClear(callMJFallback(userPrompt));
                        }
                    }
                } else {
                    launchAtIndex(index + 1);
                }
            });

            const nextDelay = index === 0 ? 1000 : 4000;
            timeouts.push(setTimeout(() => launchAtIndex(index + 1), nextDelay));
        };

        launchAtIndex(0);
    });
}

function parsePuterResponse(resp) {
    if (!resp) return null;
    if (typeof resp === 'string') return resp;

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
