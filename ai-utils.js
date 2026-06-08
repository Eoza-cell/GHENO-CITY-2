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
 * Main AI entry point.
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 2) return localMJ(userPrompt, systemPrompt);

    // Sanitize prompts
    const sanitizedSystem = systemPrompt.length > 4000 ? systemPrompt.substring(0, 4000) : systemPrompt;
    const sanitizedUser = userPrompt.length > 2000 ? userPrompt.substring(0, 2000) : userPrompt;

    const providers = [
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'Puter API', fn: callPuterAPI },
        { name: 'OpenRouter', fn: callOpenRouter },
        { name: 'Blackbox', fn: callBlackbox },
        { name: 'Pollinations POST', fn: callPollinationsPOST },
        { name: 'Pollinations GET', fn: callPollinationsGET },
        { name: 'Local MJ', fn: localMJ }
    ];

    for (const provider of providers) {
        try {
            console.log(`[AI] Tentative: ${provider.name}...`);
            const result = await provider.fn(sanitizedSystem, sanitizedUser);
            if (result && result.length > 10) {
                console.log(`[AI] Succès avec ${provider.name}`);
                return result;
            }
        } catch (e) {
            console.warn(`[AI] Échec ${provider.name}:`, e.message || e);
        }
    }

    return localMJ(userPrompt, systemPrompt);
}

async function callPuterSDK(system, prompt) {
    const p = initPuter();
    if (!p) return null;

    const models = ["gpt-4o", "openai/gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"];
    for (const model of models) {
        try {
            console.log(`[AI] SDK Puter - Modèle: ${model}`);
            const resp = await p.ai.chat(prompt, { model, system, stream: false });
            const text = parsePuterResponse(resp);
            if (text && text.length > 5 && !text.includes("token_missing")) return text;
        } catch (e) { continue; }
    }
    return null;
}

async function callPuterAPI(system, prompt) {
    if (!process.env.PUTER_API_KEY) return null;

    try {
        // Updated to use the official Puter OpenAI-compatible endpoint
        // https://developer.puter.com/tutorials/free-unlimited-openai-api/
        const resp = await axios.post("https://api.puter.com/v1/chat/completions", {
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
            stream: false
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.PUTER_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        // Handle OpenAI format response
        return resp.data?.choices?.[0]?.message?.content || resp.data?.message?.content;
    } catch (e) {
        console.error("[AI] Puter API Error:", e.response?.data || e.message);
        return null;
    }
}

async function callOpenRouter(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    try {
        const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "nvidia/llama-3.3-nemotron-super-49b-v1.5", // Good free alternative
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
        return resp.data;
    } catch (e) { return null; }
}

async function callPollinationsPOST(system, prompt) {
    try {
        const resp = await axios.post("https://text.pollinations.ai/", {
            messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
            model: "openai",
            json: true,
            seed: Math.floor(Math.random() * 1000)
        }, { timeout: 15000 });
        return resp.data?.choices?.[0]?.message?.content || resp.data;
    } catch (e) { return null; }
}

async function callPollinationsGET(system, prompt) {
    try {
        const full = `System: ${system}\nUser: ${prompt}`;
        const encoded = encodeURIComponent(full.substring(0, 1000));
        const resp = await axios.get(`https://text.pollinations.ai/${encoded}?model=p1`);
        return typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    } catch (e) { return null; }
}

function parsePuterResponse(resp) {
    if (!resp) return null;
    if (typeof resp === 'string') return resp;

    // Extract from message.content (SDK v2)
    if (resp.message && resp.message.content) {
        if (Array.isArray(resp.message.content)) {
            return resp.message.content.map(c => typeof c === 'string' ? c : (c.text || "")).join("");
        }
        return resp.message.content;
    }

    // Extract from choices (OpenAI style)
    if (resp.choices && resp.choices[0]?.message?.content) {
        return resp.choices[0].message.content;
    }

    if (resp.text && typeof resp.text === 'string') return resp.text;

    return JSON.stringify(resp);
}

/**
 * Final Fallback: Immersive local MJ.
 */
function localMJ(userPrompt, systemPrompt) {
    console.log("[AI] MJ Local activé.");

    const up = userPrompt.toLowerCase();
    const statsMatch = systemPrompt.match(/STATS: (.*)/);
    const stats = statsMatch ? statsMatch[1] : "Moyennes";

    let actionType = "Action";
    let roll = Math.floor(Math.random() * 20) + 1;
    let result = "Réussite";

    if (up.includes("attaque") || up.includes("frappe") || up.includes("tue")) actionType = "Combat";
    else if (up.includes("va à") || up.includes("déplace") || up.includes("entre")) actionType = "Mouvement";
    else if (up.includes("parle") || up.includes("dis") || up.includes("demande")) actionType = "Social";

    if (roll === 1) result = "Échec Critique";
    else if (roll < 8) result = "Échec";
    else if (roll < 14) result = "Réussite mitigée";
    else if (roll === 20) result = "Réussite Critique";

    let narrative = `[MJ Local] (Dé: ${roll} - ${result})\n\n`;

    if (actionType === "Combat") {
        narrative += `Tu tentes une offensive ! Le choc des armes résonne dans l'air. Malgré le flux de mana instable, ta détermination te permet d'infliger des dégâts. ${result === 'Réussite' ? 'Ton ennemi recule brusquement.' : 'L\'échange est rude.'}`;
    } else if (actionType === "Mouvement") {
        narrative += `Tu te mets en route à travers les terres d'Aetherys. Le voyage se déroule sans encombre majeure, et tu atteins ton but sous un ciel chargé d'éclairs de mana.`;
    } else {
        narrative += `Tu agis avec assurance dans ce monde de dangers. Le destin semble te sourire alors que tu traces ton chemin à Eldoria.`;
    }

    return JSON.stringify({
        narrative: narrative,
        actions: [{ type: "update_player", parameters: { xp_gain: 10 } }]
    });
}

module.exports = { callAI };
