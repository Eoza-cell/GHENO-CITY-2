const axios = require('axios');

/**
 * AI UTILS - Football Career Pro
 * Highly resilient AI caller using Puter.js and Pollinations
 */

let puterInstance = null;

function initPuter() {
    if (!puterInstance) {
        try {
            const p = require('@heyputer/puter.js');
            puterInstance = p.default || p.puter || p;
            if (process.env.PUTER_API_KEY) {
                puterInstance.setAuthToken(process.env.PUTER_API_KEY);
            }
        } catch (e) {
            console.error("[AI] Puter Load Error:", e.message);
        }
    }
    return puterInstance;
}

async function callAI(system, user) {
    console.log("[AI] Starting generation...");

    const providers = [
        // 0. ApiFreeLLM (User's preferred high-tier provider)
        async () => {
            if (!process.env.APIFREELLM_API_KEY) return null;
            console.log("[AI] Trying ApiFreeLLM...");
            const baseUrl = process.env.APIFREELLM_BASE_URL || "https://api.apifreellm.com/v1";
            const res = await axios.post(`${baseUrl}/chat/completions`, {
                model: "gpt-4o",
                messages: [{role: "system", content: system}, {role: "user", content: user}]
            }, {
                headers: { "Authorization": `Bearer ${process.env.APIFREELLM_API_KEY}` },
                timeout: 25000
            });
            return res.data?.choices?.[0]?.message?.content;
        },
        // 1. Puter API (Axios) - High Priority Model Rotation
        async () => {
            if (!process.env.PUTER_API_KEY) return null;
            const models = ["gpt-4o", "gpt-5.5", "o3-mini", "gpt-4o-mini"];
            for (const model of models) {
                try {
                    console.log(`[AI] Trying Puter API (${model})...`);
                    const res = await axios.post("https://api.puter.com/v1/chat/completions", {
                        model: model,
                        messages: [{role: "system", content: system}, {role: "user", content: user}]
                    }, {
                        headers: { "Authorization": `Bearer ${process.env.PUTER_API_KEY}` },
                        timeout: 15000
                    });
                    const content = res.data?.choices?.[0]?.message?.content;
                    if (content) return content;
                } catch (e) {
                    console.log(`[AI] Puter API ${model} failed: ${e.message}`);
                    continue;
                }
            }
            return null;
        },
        // 2. Puter SDK - Model Rotation
        async () => {
            const puter = initPuter();
            if (!puter) return null;
            const models = ["gpt-4o", "gpt-5.5", "gpt-5.5-pro", "o3-mini", "gpt-4o-mini"];
            for (const model of models) {
                try {
                    console.log(`[AI] Trying Puter SDK (${model})...`);
                    const resp = await puter.ai.chat(`System: ${system}\nUser: ${user}`, { model: model });
                    let text = typeof resp === 'string' ? resp : (resp?.message?.content?.[0]?.text || resp?.text);
                    if (text && text.length > 5) return text;
                } catch (e) {
                    console.log(`[AI] Puter SDK ${model} failed: ${e.message}`);
                    continue;
                }
            }
            throw new Error("Puter SDK models failed");
        },
        // 3. Pollinations POST
        async () => {
            console.log("[AI] Trying Pollinations POST...");
            const res = await axios.post("https://text.pollinations.ai/", {
                messages: [{role: "system", content: system}, {role: "user", content: user}],
                model: "openai",
                stream: false
            }, { timeout: 15000 });
            return res.data?.toString();
        },
        // 4. Pollinations GET (Ultra-Fast)
        async () => {
            console.log("[AI] Trying Pollinations GET...");
            const encoded = encodeURIComponent(`System: ${system.substring(0, 500)}\nUser: ${user.substring(0, 500)}`);
            const res = await axios.get(`https://text.pollinations.ai/${encoded}?model=search&cache=false`, { timeout: 10000 });
            return res.data?.toString();
        }
    ];

    for (let i = 0; i < providers.length; i++) {
        try {
            const result = await providers[i]();
            if (result && result.length > 5 && !result.includes("error") && !result.includes("Missing authentication")) {
                console.log(`[AI] Provider ${i} success!`);
                return result;
            }
        } catch (e) {
            console.log(`[AI] Provider ${i} failed: ${e.message}`);
        }
    }

    // 5. Emergency Dynamic Narrative (Matches the one in user's screenshot)
    const fallbacks = [
        "Le match continue intensément ! L'action est confuse mais tu gardes le contrôle. (Le serveur MJ est un peu surchargé, mais ton action est enregistrée).",
        "L'arbitre siffle une faute alors que l'action devenait confuse ! Le jeu reprendra dans un instant, reste concentré.",
        "Le coach te donne des consignes tactiques mais le bruit du stade couvre sa voix. Tu continues ton action avec détermination.",
        "Une contre-attaque rapide se dessine ! Tu sprintes vers le ballon, l'adrénaline monte alors que le MJ prépare la suite.",
        "Le match est d'une intensité folle ! Tu reprends ton souffle pendant un arrêt de jeu technique."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

module.exports = { callAI };
