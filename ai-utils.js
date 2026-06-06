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
                const litePrompt = `[MJ FOOTBALL] Action: ${userSafe.substring(0, 300)}\nRéponds en 2 phrases max.`;
                const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(litePrompt)}?model=openai&seed=${seed}&system=Tu+es+un+MJ+expert+en+football.+Reste+immersif+et+court.`, { timeout: 10000 });
                const result = res.data?.toString();
                if (result && result.length > 5 && !result.includes("Queue full") && !result.includes("error")) return result;
                throw new Error("Pollinations GET failed");
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
 * Generates a highly context-aware narrative based on keywords and player stats when all AI fail.
 */
function generateLocalNarrative(userAction, systemPrompt) {
    const action = userAction.trim();
    const actionLower = action.toLowerCase();

    // 1. Context Extraction
    const nameMatch = systemPrompt.match(/JOUEUR: (.*?) \(/);
    const playerName = nameMatch ? nameMatch[1] : "Joueur";

    const posMatch = systemPrompt.match(/\((.*?)\)/);
    const playerPos = posMatch ? posMatch[1] : "Joueur";

    const stats = {
        tir: parseInt(systemPrompt.match(/Tir:(\d+)/)?.[1] || "50"),
        passe: parseInt(systemPrompt.match(/Passe:(\d+)/)?.[1] || "50"),
        dribble: parseInt(systemPrompt.match(/Dribble:(\d+)/)?.[1] || "50"),
        vitesse: parseInt(systemPrompt.match(/Vitesse:(\d+)/)?.[1] || "50"),
        defense: parseInt(systemPrompt.match(/Défense:(\d+)/)?.[1] || "50")
    };

    // 2. Mechanics: d20 Roll
    const roll = Math.floor(Math.random() * 20) + 1;
    const isSuccess = roll > 10;
    const isCritical = roll === 20;

    // 3. Scoring System for Keywords
    const categories = [
        { id: "tir", keywords: ["tir", "frappe", "shoot", "but", "lucarne", "poteau", "reprise", "enroule", "volée"], score: 0 },
        { id: "passe", keywords: ["passe", "centre", "transversale", "ouverture", "transmission", "servir", "appuyé", "une-deux"], score: 0 },
        { id: "dribble", keywords: ["dribble", "élimine", "crochet", "geste", "technique", "petit pont", "roulette", "feinte", "déborde"], score: 0 },
        { id: "defense", keywords: ["tacle", "défend", "intercepte", "duel", "marquage", "récupère", "bloc", "charge", "épaule"], score: 0 },
        { id: "entraine", keywords: ["entraine", "exercice", "physique", "musculation", "cardio", "gammes", "progrès", "préparation"], score: 0 },
        { id: "social", keywords: ["parle", "discute", "coach", "agent", "vestiaire", "presse", "journaliste", "fan", "supporter", "coéquipier"], score: 0 }
    ];

    categories.forEach(cat => {
        cat.keywords.forEach(kw => {
            if (actionLower.includes(kw)) cat.score += 1;
        });
    });

    const bestCat = categories.sort((a, b) => b.score - a.score)[0];
    const category = (bestCat.score > 0) ? bestCat.id : "generic";

    let narrative = "";
    let jsonAction = null;

    // 4. Contextual Narratives
    if (category === "tir") {
        const difficulty = 65;
        const total = stats.tir + (roll * 2);

        if (total > difficulty + 20 || isCritical) {
            const options = [
                `🎙️ **COMMENTATEUR**: QUEL BUT !! ${playerName} prend ses responsabilités et déclenche une frappe monstrueuse qui nettoie la lucarne ! Le stade est en délire !`,
                `🏟️ **MATCH**: Incroyable ! Tu déclenches une volée foudroyante à l'entrée de la surface. Le gardien ne peut que constater les dégâts. Magnifique but !`
            ];
            narrative = options[Math.floor(Math.random() * options.length)];
            jsonAction = { type: "update_stats", parameters: { xp_change: 100, money_change: 50, shoot_change: 1 } };
        } else if (total > difficulty) {
            narrative = `🏟️ **MATCH**: Tu tentes ta chance avec une frappe placée. Le gardien est battu mais le ballon rase le poteau extérieur ! C'était tout proche, ${playerName}.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 30, shoot_change: 1 } };
        } else {
            narrative = `🏟️ **MATCH**: Ta tentative de tir manque de conviction. Le ballon s'envole dans les tribunes, provoquant les sifflets d'une partie du public. Travaille ta précision !`;
            jsonAction = { type: "update_stats", parameters: { stamina_change: -10 } };
        }
    }
    else if (category === "passe") {
        if (isSuccess) {
            narrative = `⚽ **TERRAIN**: Magnifique vision de jeu ! Ta passe pour le latéral droit est millimétrée, cassant deux lignes adverses. L'offensive se poursuit !`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 40, pass_change: 1 } };
        } else {
            narrative = `⚽ **TERRAIN**: Tu cherches l'ouverture mais ta transmission est trop courte et interceptée. Le bloc adverse remonte vite, il va falloir redescendre défendre !`;
            jsonAction = { type: "update_stats", parameters: { stamina_change: -15 } };
        }
    }
    else if (category === "dribble") {
        if (stats.dribble + (roll * 1.5) > 75) {
            narrative = `✨ **ACTION**: Quel régal technique ! Tu élimines ton défenseur d'un petit pont dévastateur. Le public scande ton nom alors que tu t'enfonces dans la surface.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 50, dribble_change: 1 } };
        } else {
            narrative = `✨ **ACTION**: Tu tentes un geste technique audacieux, mais le défenseur ne tombe pas dans le panneau et récupère le cuir. Tu dois être plus vif !`;
            jsonAction = { type: "update_stats", parameters: { stamina_change: -10 } };
        }
    }
    else if (category === "defense") {
        if (stats.defense + roll > 60) {
            narrative = `🛡️ **DÉFENSE**: Intervention autoritaire de ${playerName} ! Tu récupères le ballon proprement avec un tacle glissé parfaitement exécuté. Le coach apprécie ton engagement.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 45, defense_change: 1 } };
        } else {
            narrative = `🛡️ **DÉFENSE**: Ton intervention est en retard. L'arbitre n'hésite pas et te siffle une faute dangereuse. Attention à ne pas prendre de carton idiot !`;
            jsonAction = { type: "update_stats", parameters: { stamina_change: -20 } };
        }
    }
    else if (category === "entraine") {
        narrative = `🏋️ **ENTRAÎNEMENT**: Séance intense au centre de formation. Tu répètes tes gammes jusqu'à l'épuisement. Tu sens que ton physique s'améliore progressivement.`;
        jsonAction = { type: "update_stats", parameters: { xp_change: 60, stamina_change: -30, speed_change: 1 } };
    }
    else if (category === "social") {
        narrative = `🗣️ **VESTIAIRES**: Tu échanges avec ton entourage pro. Les discussions sont constructives pour ton avenir. "Reste concentré sur le terrain", te glisse-t-on avec insistance.`;
        jsonAction = { type: "update_stats", parameters: { xp_change: 15 } };
    }
    else {
        // Echo the user action to make it feel responsive
        const shortAction = action.length > 50 ? action.substring(0, 47) + "..." : action;
        const options = [
            `🏟️ **STADE**: "${shortAction}". Tu effectues ton action sous les yeux attentifs des recruteurs. Le match suit son cours et ton influence grandit.`,
            `👟 **TERRAIN**: "${shortAction}". Tes coéquipiers t'encouragent. Tu restes bien en place tactiquement pour la suite du match.`
        ];
        narrative = options[Math.floor(Math.random() * options.length)];
        jsonAction = { type: "update_stats", parameters: { xp_change: 15, stamina_change: -5 } };
    }

    // 5. Return combined result (Narrative + optional JSON)
    return narrative + (jsonAction ? "\n\n" + JSON.stringify(jsonAction) : "");
}

module.exports = { callAI };
