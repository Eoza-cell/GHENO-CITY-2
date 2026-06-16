const axios = require('axios');

// The @heyputer/puter.js SDK is browser-only and difficult to polyfill completely in Node.
// We call Puter's HTTP driver endpoint directly.
const PUTER_API_URL = "https://api.puter.com/drivers/call";
const PUTER_MODELS = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash"];

/**
 * Detect responses that are not real narrative content.
 */
function isValidAIResponse(text) {
    if (!text || typeof text !== 'string') return false;

    const cleaned = text.trim();
    if (cleaned.length < 10) return false;

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
        '429'
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
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        if (payload.startsWith('{')) {
            try {
                const obj = JSON.parse(payload);
                if (obj.type === 'error' || obj.errorText || obj.error) return null;
                const chunk = obj.text || obj.content || obj.delta?.content
                    || obj.choices?.[0]?.delta?.content || '';
                out += chunk;
            } catch {
                out += payload;
            }
        } else {
            out += payload;
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
 * Call Puter's AI over its HTTP driver endpoint.
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
            console.log(`[AI] Puter HTTP API - Modèle: ${model}`);
            const resp = await axios.post(PUTER_API_URL, {
                interface: "puter-chat-completion",
                method: "complete",
                args: { messages, model }
            }, {
                headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                timeout: 30000
            });

            if (resp.data?.success === false) {
                console.warn(`[AI] Puter ${model} erreur:`, resp.data?.error);
                continue;
            }
            const content = extractMessageContent(resp.data?.result?.message?.content);
            if (content && content.length > 5) return content;
        } catch (e) {
            console.warn(`[AI] Puter HTTP API ${model} échec:`, e.response?.data?.error || e.message);
            continue;
        }
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
        { name: 'Puter API (Keyed)', fn: callPuterAPI },
        { name: 'OpenRouter', fn: callOpenRouter },
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
            }
        } catch (e) {
            console.warn(`[AI] ❌ Échec ${provider.name}:`, e.message || e);
        }
    }

    console.warn("[AI] Tous les providers ont échoué.");
    return JSON.stringify({
        narrative: "🌀 *Le flux magique est instable.* L'Ether ne répond pas à tes appels... (Tous les serveurs IA sont hors ligne, réessaye dans un instant).",
        actions: []
    });
}

async function callOpenRouter(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    try {
        const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "google/gemini-2.0-flash-exp:free",
            messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
            timeout: 20000
        });
        return resp.data?.choices?.[0]?.message?.content;
    } catch (e) { return null; }
}

async function callBlackbox(system, prompt) {
    try {
        const resp = await axios.post("https://www.blackbox.ai/api/chat", {
            messages: [{ role: "user", content: `SYSTEM: ${system}\n\nUSER: ${prompt}` }],
            model: "deepseek-v3",
            agentMode: {},
            trendingAgentMode: {},
            userSelectedModel: "deepseek-v3"
        }, { timeout: 15000 });
        return parseSSEResponse(resp.data);
    } catch (e) { return null; }
}

async function callPollinationsPOST(system, prompt) {
    try {
        const models = ['openai', 'mistral', 'llama'];
        const model = models[Math.floor(Math.random() * models.length)];
        const resp = await axios.post("https://text.pollinations.ai/", {
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            model: model,
            jsonMode: true,
            seed: Math.floor(Math.random() * 1000000)
        }, { timeout: 20000 });
        return typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    } catch (e) { return null; }
}

async function callPollinationsGET(system, prompt) {
    try {
        const fullPrompt = encodeURIComponent(`SYSTEM: ${system}\n\nUSER: ${prompt}`.substring(0, 1500));
        const seed = Math.floor(Math.random() * 1000000);
        const url = `https://text.pollinations.ai/${fullPrompt}?model=openai&seed=${seed}`;
        const resp = await axios.get(url, { timeout: 15000 });
        return resp.data;
    } catch (e) { return null; }
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
