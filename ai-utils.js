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
                const models = ["gpt-5.5-pro", "gpt-5.5", "gpt-5.4-pro", "gpt-5.4", "gpt-5.4-nano", "o3-mini", "gpt-4.5-preview", "gpt-4o", "claude-3.5-sonnet"];
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
                                "Referer": "https://puter.com/",
                                "X-Puter-App-Name": "Football Career Pro",
                                "Sec-Fetch-Mode": "cors",
                                "Sec-Fetch-Site": "cross-site"
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
                const models = ["gpt-5.5-pro", "gpt-5.5", "gpt-5.4-pro", "gpt-5.4", "gpt-5.4-nano", "o3-mini", "gpt-4o"];
                for (const model of models) {
                    try {
                        console.log(`[AI] Puter SDK trying ${model}...`);
                        const resp = await puter.ai.chat(`System: ${systemSafe}\nUser: ${userSafe}`, { model: model });
                        let text = typeof resp === 'string' ? resp : (resp?.message?.content?.[0]?.text || resp?.text);
                        if (text && text.length > 10 && !text.includes("Missing authentication") && !text.includes("error")) return text;
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
                const models = ["p1", "openai", "mistral", "llama", "unity"];
                // Try multiple times with different seeds to bypass 429/Queue issues
                for (let attempt = 0; attempt < 3; attempt++) {
                    for (const model of models) {
                        try {
                            const seed = Math.floor(Math.random() * 9999999);
                            console.log(`[AI] Pollinations trying ${model} (attempt ${attempt+1})...`);
                            const res = await axios.post("https://text.pollinations.ai/", {
                                messages: [{role: "system", content: systemSafe}, {role: "user", content: userSafe}],
                                model: model,
                                seed: seed,
                                stream: false,
                                cache: false
                            }, {
                                headers: {
                                    "Content-Type": "application/json",
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                                },
                                timeout: 15000
                            });

                            let content = res.data;
                            if (typeof content === 'object') content = JSON.stringify(content);
                            if (content && content.length > 10 && !content.includes("Queue full") && !content.includes("error")) return content;
                        } catch (e) {
                            if (e.response?.status === 429) await new Promise(r => setTimeout(r, 2000));
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
                const litePrompt = `[MJ FOOTBALL] Action: ${userSafe.substring(0, 300)}`;
                const sys = encodeURIComponent("Tu es un MJ expert en football. Réponds en 2 phrases max.");
                // Use a different model for GET to increase success chance
                const res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(litePrompt)}?model=p1&seed=${seed}&system=${sys}`, {
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
                    timeout: 10000
                });
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
    const localRes = generateLocalNarrative(userSafe, systemSafe);
    console.log("[AI] Falling back to Local MJ...");
    return localRes;
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
        defense: parseInt(systemPrompt.match(/Défense:(\d+)/)?.[1] || "50"),
        stamina: parseInt(systemPrompt.match(/Stamina:(\d+)/)?.[1] || "100")
    };

    // 2. Mechanics: d20 Roll
    const roll = Math.floor(Math.random() * 20) + 1;
    const isCriticalSuccess = roll === 20;
    const isCriticalFailure = roll === 1;

    // 3. Scoring System for Keywords
    const categories = [
        { id: "tir", keywords: ["tir", "frappe", "shoot", "but", "lucarne", "poteau", "reprise", "enroule", "volée", "surface", "filet", "angle", "lob", "penalty", "coup franc", "plexus", "temple", "poitrine"], score: 0 },
        { id: "passe", keywords: ["passe", "centre", "transversale", "ouverture", "transmission", "servir", "appuyé", "une-deux", "profondeur", "déviation", "talonmade", "remise"], score: 0 },
        { id: "dribble", keywords: ["dribble", "élimine", "crochet", "geste", "technique", "petit pont", "roulette", "feinte", "déborde", "vitesse", "accélère", "flip-flap", "elastico", "sombrero", "foulée"], score: 0 },
        { id: "defense", keywords: ["tacle", "défend", "intercepte", "duel", "marquage", "récupère", "bloc", "charge", "épaule", "tête", "dégage", "poitrine", "contrent"], score: 0 },
        { id: "entraine", keywords: ["entraine", "exercice", "physique", "musculation", "cardio", "gammes", "progrès", "préparation", "échauffement", "pompes", "abdos", "footing"], score: 0 },
        { id: "social", keywords: ["parle", "discute", "coach", "agent", "vestiaire", "presse", "journaliste", "fan", "supporter", "coéquipier", "signature", "contrat", "interview"], score: 0 }
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
    let rollDetails = "";

    // 4. Contextual Narratives
    if (category === "tir") {
        const total = stats.tir + (roll * 2);
        const diff = 75;
        let status = total > diff + 15 ? 'Réussite totale' : (total > diff ? 'Réussite' : (total > diff - 15 ? 'Réussite mitigée' : 'Échec'));
        rollDetails = `\n\n*Jet de dé virtuel (Tir + Technique) : ${roll}/20 — ${status}.*`;

        if (isCriticalSuccess || total > diff + 15) {
            narrative = `Tu plantes ton appui et déclenches une frappe *rasante et vicieuse*. Le ballon nettoie le petit filet opposé ! Magnifique but, ${playerName}.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 100, money_change: 50, shoot_change: 1 } };
        } else if (total > diff) {
            narrative = `Ta frappe à mi-hauteur est puissante. Le gardien la touche mais ne peut l'empêcher d'entrer. C'est au fond !`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 60, shoot_change: 1 } };
        } else {
            narrative = `Ta tentative manque de précision et s'envole au-dessus de la transversale. Le public gronde légèrement.`;
            jsonAction = { type: "update_stats", parameters: { stamina_change: -10 } };
        }
    }
    else if (category === "passe") {
        const total = stats.passe + (roll * 2);
        const diff = 70;
        let status = total > diff + 15 ? 'Réussite totale' : (total > diff ? 'Réussite' : (total > diff - 15 ? 'Réussite mitigée' : 'Échec'));
        rollDetails = `\n\n*Jet de dé virtuel (Passe + Vision) : ${roll}/20 — ${status}.*`;

        if (total > diff + 10) {
            narrative = `Quelle vista ! Tu délivres une passe laser qui transperce tout le bloc adverse. Ton attaquant n'a plus qu'à pousser le cuir au fond. Le stade scande ton nom pour cette offrande royale.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 70, pass_change: 1 } };
        } else if (total > diff) {
            narrative = `Une transmission propre dans les pieds. Le jeu progresse et tu assures la possession pour ton équipe. Simple, efficace, du travail de pro.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 30 } };
        } else {
            narrative = `Ta passe manque de conviction. Elle est interceptée par un Mamadou aux aguets qui lance immédiatement la contre-attaque. "T'as cru que j'allais te laisser faire ?", te lance-t-il avec un sourire en coin.`;
            jsonAction = { type: "update_stats", parameters: { stamina_change: -15 } };
        }
    }
    else if (category === "dribble") {
        const total = stats.dribble + (roll * 2);
        const diff = 75;
        let status = total > diff + 15 ? 'Réussite totale' : (total > diff ? 'Réussite' : (total > diff - 15 ? 'Réussite mitigée' : 'Échec'));
        rollDetails = `\n\n*Jet de dé virtuel (Dribble + Agilité) : ${roll}/20 — ${status}.*`;

        if (isCriticalSuccess || total > diff + 15) {
            narrative = `C'est de la magie ! Roulette, double contact, et tu laisses ton vis-à-vis sur les fesses. Tu t'enfonces dans la surface avec une élégance rare. Même le coach adverse ne peut s'empêcher d'applaudir.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 80, dribble_change: 1 } };
        } else if (total > diff) {
            narrative = `Un crochet court bien senti qui te permet de déborder sur l'aile. Le centre qui suit est dangereux, tu as fait la différence sur ce coup-là.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 40, dribble_change: 1 } };
        } else {
            narrative = `Tu tentes le geste de trop. Le défenseur reste sur ses appuis et te subtilise le ballon proprement. Tu finis le nez dans le gazon, avec les jambes en coton.`;
            jsonAction = { type: "update_stats", parameters: { stamina_change: -10 } };
        }
    }
    else if (category === "defense") {
        const total = stats.defense + (roll * 2);
        const diff = 70;
        let status = total > diff + 15 ? 'Réussite totale' : (total > diff ? 'Réussite' : (total > diff - 15 ? 'Réussite mitigée' : 'Échec'));
        rollDetails = `\n\n*Jet de dé virtuel (Défense + Force) : ${roll}/20 — ${status}.*`;

        if (total > diff + 10) {
            narrative = `Un tacle glissé d'anthologie ! Tu emportes le ballon sans même effleurer l'adversaire. Une intervention qui redonne confiance à toute ton équipe. Impérial, ${playerName}.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 70, defense_change: 1 } };
        } else if (total > diff) {
            narrative = `Tu gagnes ton duel à l'épaule et tu relances proprement. Tu es un vrai poison pour les attaquants aujourd'hui.`;
            jsonAction = { type: "update_stats", parameters: { xp_change: 30 } };
        } else {
            narrative = `Tu te fais aspirer par la feinte. L'attaquant te passe comme si tu n'existais pas. Heureusement que ton gardien veille au grain... Travaille tes appuis !`;
            jsonAction = { type: "update_stats", parameters: { stamina_change: -20 } };
        }
    }
    else if (category === "entraine") {
        narrative = `Séance intense au centre de formation. Tes cuisses brûlent sous l'effort, mais tu ne lâches rien. Cinq. Encore cinq. Tu répètes tes gammes jusqu'à ce que le geste devienne instinctif. Tu sens que ton corps s'endurcit.`;
        jsonAction = { type: "update_stats", parameters: { xp_change: 60, stamina_change: -30, speed_change: 1 } };
    }
    else if (category === "social") {
        narrative = `Tu échanges avec ton agent dans un café branché. "Ton profil intéresse du monde, reste focus", te glisse-t-il. Les rumeurs de transfert commencent à circuler, à toi de confirmer sur le terrain.`;
        jsonAction = { type: "update_stats", parameters: { xp_change: 20 } };
    }
    else {
        const shortAction = action.length > 50 ? action.substring(0, 47) + "..." : action;
        narrative = `Tu t'appliques sur ton action : "${shortAction}". Le jeu se poursuit sur un rythme élevé et chaque ballon devient une bataille. Tu restes concentré, prêt à saisir la moindre opportunité.`;
        jsonAction = { type: "update_stats", parameters: { xp_change: 15, stamina_change: -5 } };
    }

    // 5. Final Formatting
    return narrative + rollDetails + (jsonAction ? "\n\n" + JSON.stringify(jsonAction) : "");
}

module.exports = { callAI };
