const axios = require('axios');
let puter = null;

function initPuter() {
    if (!puter) {
        try {
            const puterPkg = require('@heyputer/puter.js');
            puter = puterPkg.default || puterPkg;

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
 * Enhanced Puter.js call following the latest v2 discovery and models
 */
async function callPuterV2(system, prompt) {
    try {
        const p = initPuter();
        if (!p || !p.ai) {
            console.warn("[AI] Puter.js non initialisé");
            return null;
        }

        // Models from the provided GitHub resource: https://github.com/andrew-gardner22/FREE-UNLIMITED-OpenAI
        const models = [
            "gpt-4o", "gpt-4.1", "o3-mini", "o1-mini", "gpt-4o-mini",
            "gpt-4.5-preview", "o1", "o4-mini", "claude-3-5-sonnet", "gemini-1.5-flash"
        ];

        // Ensure we handle JSON requirement if mentioned in system prompt
        const enhancedPrompt = `${prompt}\n\nIMPORTANT: Répondre uniquement avec le contenu demandé (Narration ou JSON). Pas de blabla inutile.`;
        const combinedPrompt = `[SYSTEM INSTRUCTIONS]\n${system}\n\n[USER MESSAGE]\n${enhancedPrompt}`;

        for (const model of models) {
            try {
                console.log(`[AI] Puter V2 - Essai avec ${model}...`);
                const resp = await p.ai.chat(combinedPrompt, {
                    model: model,
                    stream: false
                });

                const text = parsePuterResponse(resp);
                if (text && text.length > 10) {
                    console.log(`[AI] ✅ Puter V2 succès (${model})`);
                    return text;
                }
            } catch (e) {
                console.warn(`[AI] Puter V2 - Échec ${model}: ${e.message}`);
                continue;
            }
        }
    } catch (e) {
        console.error("[AI] ❌ Puter V2 error:", e.message);
    }
    return null;
}

/**
 * Clean AI response from common artifacts
 */
function cleanAIResponse(text) {
    if (!text || typeof text !== 'string') return "";

    let cleaned = text
        .replace(/data:\s*\[DONE\]/gi, "")
        .replace(/^data:\s*\[DONE\]/gm, "")
        .replace(/^data:\s*/gm, "") // Strip any line-starting "data: "
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
    if (depth > 2) return null;

    console.log(`[AI] callAI - Tentative globale #${depth + 1}`);

    const providers = [
        { name: 'Puter V2 (OpenAI Free)', fn: callPuterV2 },
        { name: 'OpenRouter', fn: callOpenRouter },
        { name: 'Pollinations POST', fn: callPollinationsPOST },
        { name: 'Blackbox', fn: callBlackbox },
        { name: 'Pollinations GET', fn: callPollinationsGET }
    ];

    for (const provider of providers) {
        try {
            console.log(`[AI] Tentative: ${provider.name}...`);
            let result = await provider.fn(systemPrompt, userPrompt);

            if (result) {
                result = cleanAIResponse(result);
                if (result.length > 5) {
                    console.log(`[AI] ✅ Succès avec ${provider.name}`);
                    return result;
                }
            }
        } catch (e) {
            console.warn(`[AI] ❌ Échec ${provider.name}:`, e.message);
        }
    }

    // Exponential backoff before global retry
    if (depth < 2) {
        const delayMs = (depth + 1) * 2000;
        console.log(`[AI] Attente de ${delayMs}ms avant retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return await callAI(systemPrompt, userPrompt, depth + 1);
    }

    return null;
}

async function callOpenRouter(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    const models = [
        "google/gemini-2.0-flash-exp:free",
        "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        "meta-llama/llama-3.3-70b-instruct:free"
    ];

    for (const model of models) {
        try {
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

async function callBlackbox(system, prompt) {
    const models = ["gpt-4o", "claude-3-5-sonnet", "deepseek-v3"];
    for (const model of models) {
        try {
            const resp = await axios.post("https://www.blackbox.ai/api/chat", {
                messages: [{ role: "user", content: `INSTRUCTIONS:\n${system}\n\nMESSAGE:\n${prompt}` }],
                model: model,
                max_tokens: 1024
            }, {
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
                timeout: 20000
            });

            let text = "";
            if (typeof resp.data === 'string') {
                text = resp.data.replace(/\$@\$.*?\$@\$/g, '').trim();
            } else if (resp.data?.choices?.[0]?.message?.content) {
                text = resp.data.choices[0].message.content;
            }

            if (text && text.length > 10) return text;
        } catch (e) { continue; }
    }
    return null;
}

async function callPollinationsPOST(system, prompt) {
    const models = ['openai', 'mistral', 'llama'];
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
            if (response.data && response.data.length > 5) return response.data;
        } catch (e) { continue; }
    }
    return null;
}

async function callPollinationsGET(system, prompt) {
    const shortSystem = system.substring(0, 800);
    const shortPrompt = prompt.substring(0, 800);
    const url = `https://text.pollinations.ai/${encodeURIComponent(shortPrompt)}?system=${encodeURIComponent(shortSystem)}&model=openai&seed=${Date.now()}`;
    try {
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 });
        if (response.data && response.data.length > 5) return response.data;
    } catch (e) {}
    return null;
}

function parsePuterResponse(resp) {
    if (!resp) return null;
    if (typeof resp === 'string') return resp;
    if (resp.message?.content) {
        if (Array.isArray(resp.message.content)) return resp.message.content.map(c => typeof c === 'string' ? c : (c.text || "")).join("");
        return resp.message.content;
    }
    if (resp.choices?.[0]?.message?.content) return resp.choices[0].message.content;
    if (resp.text) return resp.text;
    return JSON.stringify(resp);
}

module.exports = { callAI, cleanAIResponse };
