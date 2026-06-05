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
            if (process.env.PUTER_API_KEY && process.env.PUTER_API_KEY.length > 5) {
                puterInstance.setAuthToken(process.env.PUTER_API_KEY);
            }
        } catch (e) {
            console.error("[AI] Puter Load Error:", e.message);
        }
    }
    return puterInstance;
}

async function callAI(system, user, debug = false) {
    console.log("[AI] Starting generation...");

    // Sanitize and truncate prompts to avoid length-related errors
    const systemSafe = system.substring(0, 4000);
    const userSafe = user.substring(0, 2000);

    let debugResults = [];

    const providers = [
        // 0. ApiFreeLLM (User's preferred high-tier provider)
        {
            name: "ApiFreeLLM",
            call: async () => {
                if (!process.env.APIFREELLM_API_KEY) throw new Error("Missing API Key");
                const baseUrl = process.env.APIFREELLM_BASE_URL || "https://api.apifreellm.com/v1";
                const res = await axios.post(`${baseUrl}/chat/completions`, {
                    model: "gpt-4o",
                    messages: [{role: "system", content: systemSafe}, {role: "user", content: userSafe}]
                }, {
                    headers: { "Authorization": `Bearer ${process.env.APIFREELLM_API_KEY}` },
                    timeout: 25000
                });
                return res.data?.choices?.[0]?.message?.content;
            }
        },
        // 1. Puter API (Axios) - High Priority Model Rotation
        {
            name: "Puter API (Axios)",
            call: async () => {
                const models = ["gpt-4o", "gpt-5.5-pro", "gpt-5.5", "o3-mini", "gpt-4o-mini", "gpt-5.4-pro"];
                const authHeader = process.env.PUTER_API_KEY ? { "Authorization": `Bearer ${process.env.PUTER_API_KEY}` } : {};
                for (const model of models) {
                    try {
                        const res = await axios.post("https://api.puter.com/v1/chat/completions", {
                            model: model,
                            messages: [{role: "system", content: systemSafe}, {role: "user", content: userSafe}],
                            temperature: 0.7
                        }, {
                            headers: { ...authHeader, "Content-Type": "application/json" },
                            timeout: 20000
                        });
                        const content = res.data?.choices?.[0]?.message?.content;
                        if (content && content.length > 10) return content;
                    } catch (e) {
                        continue;
                    }
                }
                throw new Error("All Puter models failed");
            }
        },
        // 2. Puter SDK - Model Rotation
        {
            name: "Puter SDK",
            call: async () => {
                const puter = initPuter();
                if (!puter) throw new Error("SDK not loaded");
                const models = ["gpt-5.5-pro", "gpt-5.5", "o3-mini", "gpt-4o", "gpt-5.4-mini"];
                for (const model of models) {
                    try {
                        const resp = await puter.ai.chat(`System: ${systemSafe}\nUser: ${userSafe}`, { model: model });
                        let text = typeof resp === 'string' ? resp : (resp?.message?.content?.[0]?.text || resp?.text);
                        if (text && text.length > 10 && !text.includes("Missing authentication")) return text;
                    } catch (e) {
                        continue;
                    }
                }
                throw new Error("All SDK models failed");
            }
        },
        // 3. Pollinations POST (Resilient rotation)
        {
            name: "Pollinations POST",
            call: async () => {
                const models = ["openai", "mistral", "llama", "search"];
                for (const model of models) {
                    try {
                        const seed = Math.floor(Math.random() * 1000000);
                        const res = await axios.post("https://text.pollinations.ai/", {
                            messages: [{role: "system", content: systemSafe}, {role: "user", content: userSafe}],
                            model: model,
                            seed: seed,
                            stream: false
                        }, { timeout: 15000 });
                        const result = res.data?.toString();
                        if (result && result.length > 10) return result;
                    } catch (e) {}
                }
                throw new Error("Pollinations POST failed");
            }
        },
        // 4. Pollinations GET (Ultra-Resilient / Emergency)
        {
            name: "Pollinations GET",
            call: async () => {
                const seed = Math.floor(Math.random() * 1000000);
                const litePrompt = `MJ Football: ${userSafe.substring(0, 500)}`;
                const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(litePrompt)}?model=search&seed=${seed}&cache=false`, { timeout: 10000 });
                return res.data?.toString();
            }
        }
    ];

    for (const provider of providers) {
        try {
            console.log(`[AI] Trying ${provider.name}...`);
            const result = await provider.call();
            if (result && result.length > 5 && !result.includes("error") && !result.includes("Missing authentication")) {
                console.log(`[AI] ${provider.name} success!`);
                if (debug) debugResults.push(`✅ ${provider.name}: Success`);
                return debug ? debugResults.join('\n') : result;
            } else {
                throw new Error("Invalid or empty response");
            }
        } catch (e) {
            console.log(`[AI] ${provider.name} failed: ${e.message}`);
            if (debug) debugResults.push(`❌ ${provider.name}: ${e.message}`);
        }
    }

    if (debug) return debugResults.join('\n');

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
