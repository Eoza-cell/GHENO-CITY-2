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
        // 0. OpenRouter (Free Tier)
        {
            name: "OpenRouter (Free)",
            call: async () => {
                // Try with API key if available, otherwise it's likely to fail 401
                const apiKey = process.env.OPENROUTER_API_KEY;
                if (!apiKey) throw new Error("Missing API Key");

                const models = ["nvidia/nemotron-3-ultra-550b-a55b:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemma-4-31b-it:free"];
                for (const model of models) {
                    try {
                        console.log(`[AI] OpenRouter trying ${model}...`);
                        const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                            model: model,
                            messages: [{role: "system", content: systemSafe}, {role: "user", content: userSafe}],
                            temperature: 0.7
                        }, {
                            headers: {
                                "Authorization": `Bearer ${apiKey}`,
                                "Content-Type": "application/json",
                                "HTTP-Referer": "https://puter.com", // Some free models require referer
                                "X-Title": "Football Career Pro"
                            },
                            timeout: 15000
                        });
                        return res.data?.choices?.[0]?.message?.content;
                    } catch (e) {
                        continue;
                    }
                }
                throw new Error("All OpenRouter free models failed");
            }
        },
        // 2. Puter API (Axios) - High Priority Model Rotation
        {
            name: "Puter API (Axios)",
            call: async () => {
                // Models from 2026 Puter Tutorial
                const models = ["claude-3.5-sonnet", "gpt-5.5-pro", "gpt-5.5", "o3-mini", "gpt-4o", "gpt-5.4-pro", "gpt-4o-mini"];
                const authHeader = process.env.PUTER_API_KEY ? { "Authorization": `Bearer ${process.env.PUTER_API_KEY}` } : {};
                for (const model of models) {
                    try {
                        console.log(`[AI] Puter Axios trying ${model}...`);
                        const res = await axios.post("https://api.puter.com/v1/chat/completions", {
                            model: model,
                            messages: [{role: "system", content: systemSafe}, {role: "user", content: userSafe}],
                            temperature: 0.7
                        }, {
                            headers: {
                                ...authHeader,
                                "Content-Type": "application/json",
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                "Origin": "https://puter.com",
                                "Referer": "https://puter.com/"
                            },
                            timeout: 15000
                        });
                        const content = res.data?.choices?.[0]?.message?.content;
                        if (content && content.length > 10) return content;
                    } catch (e) {
                        console.log(`[AI] Puter Axios ${model} failed: ${e.response?.status || e.message}`);
                        continue;
                    }
                }
                throw new Error("All Puter models failed");
            }
        },
        // 3. Puter SDK - Model Rotation
        {
            name: "Puter SDK",
            call: async () => {
                const puter = initPuter();
                if (!puter) throw new Error("SDK not loaded");
                const models = ["claude-3.5-sonnet", "gpt-5.5-pro", "gpt-5.5", "o3-mini", "gpt-4o", "gpt-5.4-mini"];
                for (const model of models) {
                    try {
                        console.log(`[AI] Puter SDK trying ${model}...`);
                        const resp = await puter.ai.chat(`System: ${systemSafe}\nUser: ${userSafe}`, { model: model });
                        let text = typeof resp === 'string' ? resp : (resp?.message?.content?.[0]?.text || resp?.text);
                        if (text && text.length > 10 && !text.includes("Missing authentication")) return text;
                    } catch (e) {
                        console.log(`[AI] Puter SDK ${model} failed: ${e.message}`);
                        continue;
                    }
                }
                throw new Error("All SDK models failed");
            }
        },
        // 4. Pollinations POST (Ultra Resilient)
        {
            name: "Pollinations",
            call: async () => {
                const models = ["openai", "mistral", "llama", "search", "unity", "midjourney"];
                // Try multiple times with different seeds to bypass 429/Queue issues
                for (let attempt = 0; attempt < 3; attempt++) {
                    for (const model of models) {
                        try {
                            const seed = Math.floor(Math.random() * 9999999);
                            const res = await axios.post("https://text.pollinations.ai/", {
                                messages: [{role: "system", content: systemSafe}, {role: "user", content: userSafe}],
                                model: model,
                                seed: seed,
                                stream: false,
                                cache: false
                            }, {
                                headers: { "Content-Type": "application/json" },
                                timeout: 12000
                            });

                            let content = res.data;
                            if (typeof content === 'object') content = JSON.stringify(content);
                            if (content && content.length > 10 && !content.includes("Queue full")) return content;
                        } catch (e) {
                            // Wait a bit between attempts if 429
                            if (e.response?.status === 429) await new Promise(r => setTimeout(r, 1000));
                            continue;
                        }
                    }
                }
                throw new Error("Pollinations failed after multiple attempts");
            }
        },
        // 5. Pollinations GET (Ultra-Resilient / Emergency)
        {
            name: "Pollinations GET",
            call: async () => {
                const seed = Math.floor(Math.random() * 1000000);
                const litePrompt = `MJ Football: ${userSafe.substring(0, 500)}`;
                const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(litePrompt)}?model=search&seed=${seed}&cache=false`, { timeout: 10000 });
                return res.data?.toString();
            }
        },
        // 6. Blackbox AI (New free provider)
        {
            name: "Blackbox AI",
            call: async () => {
                const res = await axios.post("https://www.blackbox.ai/api/chat", {
                    messages: [{role: "user", content: `System: ${systemSafe}\nUser: ${userSafe}`}],
                    model: "gpt-4o",
                    max_tokens: 1024
                }, { timeout: 15000 });
                return res.data?.toString() || res.data?.choices?.[0]?.message?.content;
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

    // 6. Local MJ Narrative Engine (Last Resort)
    return generateLocalNarrative(userSafe, systemSafe);
}

/**
 * Generates a semi-dynamic narrative based on keywords when all AI fail.
 */
function generateLocalNarrative(userAction, systemPrompt) {
    const action = userAction.toLowerCase();

    // Extract name and position from system prompt if possible
    const nameMatch = systemPrompt.match(/JOUEUR: (.*?) \(/);
    const playerName = nameMatch ? nameMatch[1] : "Joueur";

    if (action.includes("tir") || action.includes("frappe") || action.includes("shoot")) {
        return `${playerName} déclenche une frappe puissante vers le but ! Le gardien plonge mais le ballon est dévié in extremis par un défenseur. L'action reste chaude !`;
    }
    if (action.includes("passe") || action.includes("centre")) {
        return "Ta passe est précise et trouve un coéquipier dans la course. L'offensive progresse rapidement vers la surface adverse !";
    }
    if (action.includes("dribble") || action.includes("élimine")) {
        return "D'un geste technique élégant, tu effaces ton vis-à-vis ! Le public se lève alors que tu t'ouvres le chemin du but.";
    }
    if (action.includes("tacle") || action.includes("défend")) {
        return "Ton intervention défensive est impeccable ! Tu récupères le ballon proprement et relances immédiatement le jeu.";
    }
    if (action.includes("entraine") || action.includes("exercice")) {
        return "Ton entraînement intensif porte ses fruits. Tu sens tes muscles brûler mais ta technique s'affine à chaque répétition. +1 XP.";
    }

    const generic = [
        "L'intensité du match est à son comble ! Tu es au cœur de l'action, luttant pour chaque ballon avec une détermination sans faille.",
        "Le coach te fait signe depuis le banc de touche. Tes efforts sont remarqués et tu continues à peser sur le jeu.",
        "Le stade gronde alors que tu prends une décision cruciale sur le terrain. Le suspense est total pour la suite de ta carrière !",
        "Chaque mouvement compte maintenant. Tu restes concentré, lisant le jeu avec une clarté impressionnante malgré la fatigue.",
        "La tension monte d'un cran ! Tu es idéalement placé pour faire la différence dans les prochaines minutes."
    ];
    return generic[Math.floor(Math.random() * generic.length)];
}

module.exports = { callAI };
