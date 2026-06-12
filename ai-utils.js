const axios = require('axios');
let puter = null;

function initPuter() {
    if (!puter) {
        try {
            puter = require('@heyputer/puter.js').default || require('@heyputer/puter.js');
            if (process.env.PUTER_API_KEY && process.env.PUTER_API_KEY.length > 5 && process.env.PUTER_API_KEY !== 'test_key') {
                puter.setAuthToken(process.env.PUTER_API_KEY);
            }
        } catch (e) {
            console.error("[AI] Erreur chargement SDK Puter.js:", e.message);
        }
    }
    return puter;
}

/**
 * Clean AI response from common artifacts (SSE, data:, markdown)
 */
function cleanAIResponse(text) {
    if (!text || typeof text !== 'string') return "";

    let cleaned = text
        .replace(/data:\s*\[DONE\]/gi, "")
        .replace(/data:\s*/gi, "")
        .trim();

    // Clean markdown blocks
    cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .replace(/^(json|JSON)\s*/i, "")
        .trim();

    return cleaned.trim();
}

/**
 * Main AI entry point with high-resilience chain
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 3) return null;

    console.log(`[AI] callAI - Tentative globale #${depth + 1}`);

    const providers = [
        { name: 'OpenRouter Free', fn: callOpenRouterFree },
        { name: 'Pollinations POST', fn: callPollinationsPOST },
        { name: 'Pollinations GET', fn: callPollinationsGET },
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'Blackbox', fn: callBlackbox }
    ];

    for (const provider of providers) {
        try {
            console.log(`[AI] Tentative: ${provider.name}...`);
            let result = await provider.fn(systemPrompt, userPrompt);

            if (result) {
                if (typeof result === 'object') {
                    console.log(`[AI] ✅ Succès avec ${provider.name} (Object)`);
                    return result;
                }

                result = cleanAIResponse(result);
                if (result.length > 10) {
                    console.log(`[AI] ✅ Succès avec ${provider.name}`);
                    return result;
                }
            }
        } catch (e) {
            console.warn(`[AI] ❌ Échec ${provider.name}:`, e.message || e);
        }
    }

    if (depth < 3) {
        const delayMs = (depth + 1) * 2000;
        console.log(`[AI] Attente de ${delayMs}ms avant retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return await callAI(systemPrompt, userPrompt, depth + 1);
    }

    return null;
}

async function callOpenRouterFree(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    const models = [
        "google/gemini-2.0-flash-exp:free",
        "google/gemini-2.0-flash-thinking-exp:free",
        "nvidia/llama-3.1-nemotron-70b-instruct:free",
        "meta-llama/llama-3.3-70b-instruct:free"
    ];

    for (const model of models) {
        try {
            console.log(`[AI] OpenRouter - Modèle: ${model}`);
            const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: model,
                messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
            }, {
                headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
                timeout: 15000
            });
            const content = resp.data?.choices?.[0]?.message?.content;
            if (content && content.length > 10) return content;
        } catch (e) { continue; }
    }
    return null;
}

async function callPollinationsPOST(system, prompt) {
    const models = ['openai', 'mistral', 'llama', 'p1'];
    for (const model of models) {
        try {
            const response = await axios.post('https://text.pollinations.ai/', {
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt }
                ],
                model: model,
                seed: Math.floor(Math.random() * 1000000),
                jsonMode: system.toLowerCase().includes('json')
            }, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
                timeout: 15000
            });

            if (response.data) {
                if (typeof response.data === 'string' && response.data.length > 5) return response.data;
                if (response.data.choices?.[0]?.message?.content) return response.data.choices[0].message.content;
                if (typeof response.data === 'object') return JSON.stringify(response.data);
            }
        } catch (e) { continue; }
    }
    return null;
}

async function callPollinationsGET(system, prompt) {
    const cleanPrompt = prompt.substring(0, 500);
    const cleanSystem = system.substring(0, 200);
    const combined = `Instructions: ${cleanSystem}. Message: ${cleanPrompt}`;
    try {
        const url = `https://text.pollinations.ai/${encodeURIComponent(combined)}?model=openai&seed=${Math.floor(Math.random()*1000)}`;
        const response = await axios.get(url, { headers: { 'User-Agent': 'curl/8.5.0' }, timeout: 15000 });
        if (response.data && typeof response.data === 'string' && response.data.length > 10 && !response.data.includes('"error"')) {
            return response.data;
        }
    } catch (e) {}
    return null;
}

async function callPuterSDK(system, prompt) {
    const p = initPuter();
    if (!p) return null;
    const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash"];
    for (const model of models) {
        try {
            const resp = await p.ai.chat(prompt, { model, system, stream: false });
            const text = parsePuterResponse(resp);
            if (text && text.length > 10) return text;
        } catch (e) { continue; }
    }
    return null;
}

async function callBlackbox(system, prompt) {
    try {
        const resp = await axios.post("https://www.blackbox.ai/api/chat", {
            messages: [{ role: "user", content: `SYSTEM: ${system}\n\nUSER: ${prompt}` }],
            model: "deepseek-v3"
        }, { timeout: 15000 });
        return resp.data;
    } catch (e) { return null; }
}

function parsePuterResponse(resp) {
    if (!resp) return null;
    if (typeof resp === 'string') return resp;
    if (resp.message?.content) {
        if (Array.isArray(resp.message.content)) return resp.message.content.map(c => typeof c === 'string' ? c : (c.text || "")).join("");
        return resp.message.content;
    }
    if (resp.choices?.[0]?.message?.content) return resp.choices[0].message.content;
    return JSON.stringify(resp);
}

module.exports = { callAI, cleanAIResponse };
