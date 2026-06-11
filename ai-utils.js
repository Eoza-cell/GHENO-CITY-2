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
 * Enemy power levels with stats
 */
const ENEMY_LEVELS = {
    1: { name: "Goblin Faible", power: 1, defense: 2, speed: 8, reactionTime: 800, counterChance: 0.3 },
    2: { name: "Orc Guerrier", power: 2, defense: 4, speed: 6, reactionTime: 600, counterChance: 0.5 },
    3: { name: "Chevalier Noir", power: 3, defense: 6, speed: 5, reactionTime: 500, counterChance: 0.65 },
    4: { name: "Sorcier Ancien", power: 4, defense: 5, speed: 8, reactionTime: 400, counterChance: 0.75 },
    5: { name: "Dragon Antique", power: 5, defense: 8, speed: 7, reactionTime: 300, counterChance: 0.9 }
};

/**
 * Get random enemy with difficulty scaling
 */
function generateEnemy(difficulty = 1) {
    const level = Math.max(1, Math.min(5, difficulty));
    const enemy = { ...ENEMY_LEVELS[level], level };
    // Add variance
    enemy.power += Math.floor(Math.random() * 3) - 1;
    enemy.defense += Math.floor(Math.random() * 2);
    return enemy;
}

/**
 * Calculate enemy reaction time delay
 */
function getReactionDelay(enemy) {
    const baseDelay = enemy.reactionTime;
    const variance = Math.random() * 200 - 100;
    return Math.max(100, baseDelay + variance);
}

/**
 * Simulate enemy counter-attack
 */
function generateCounterAttack(enemy, playerRoll) {
    const willCounter = Math.random() < enemy.counterChance;
    if (!willCounter) return null;

    const counterRoll = Math.floor(Math.random() * 20) + 1;
    const enemyModifier = enemy.power * 2;
    const counterStrength = counterRoll + enemyModifier;

    return {
        willCounter: true,
        strength: counterStrength,
        severity: counterStrength > playerRoll + 10 ? "Critique" : counterStrength > playerRoll ? "Puissante" : "Modérée"
    };
}

/**
 * Call Puter.js AI with Gemini Free API
 * FIXED: Force proper response format and handle streaming correctly
 */
async function callPuterGeminiAI(system, prompt) {
    try {
        const p = initPuter();
        if (!p || !p.ai) {
            console.warn("[AI] Puter.js not properly initialized");
            return null;
        }

        console.log("[AI] 🚀 Calling Puter.js Gemini...");
        
        // Add explicit instruction to return JUST the narrative
        const enhancedPrompt = `${prompt}

IMPORTANT: Répondre UNIQUEMENT avec le texte narratif. PAS de JSON, PAS de "data: [DONE]", PAS de balisage.
Juste la narration pure en français.`;

        const resp = await p.ai.chat(enhancedPrompt, {
            system: system,
            model: "gemini-1.5-flash",
            stream: false
        });

        // Debug: Log the raw response
        console.log("[AI DEBUG] Raw response type:", typeof resp);
        console.log("[AI DEBUG] Raw response:", JSON.stringify(resp).substring(0, 200));

        let text = null;

        // Try multiple extraction methods
        if (typeof resp === 'string') {
            text = resp;
            console.log("[AI] Method: String direct");
        } else if (resp?.message?.content) {
            if (Array.isArray(resp.message.content)) {
                text = resp.message.content
                    .map(c => typeof c === 'string' ? c : (c.text || ""))
                    .filter(c => c.trim() !== "")
                    .join(" ");
            } else {
                text = resp.message.content;
            }
            console.log("[AI] Method: message.content");
        } else if (resp?.choices?.[0]?.message?.content) {
            text = resp.choices[0].message.content;
            console.log("[AI] Method: choices[0].message.content");
        } else if (resp?.text) {
            text = resp.text;
            console.log("[AI] Method: .text");
        } else if (resp?.content) {
            text = resp.content;
            console.log("[AI] Method: .content");
        }

        // Validate response
        if (!text) {
            console.warn("[AI] ❌ No text extracted from response");
            console.warn("[AI] Response object keys:", Object.keys(resp || {}));
            return null;
        }

        // Clean response
        text = text
            .trim()
            .replace(/^data:\s*\[DONE\]\s*$/i, "") // Remove streaming marker
            .replace(/^(json|JSON)\s*/i, "") // Remove language marker
            .replace(/^```[\s\S]*?```/g, "") // Remove code blocks
            .trim();

        // Final validation
        const isValid = text.length > 10 && 
                       !text.includes("data: [DONE]") && 
                       !text.includes("token_missing") &&
                       text !== "[DONE]" &&
                       text !== "";

        if (!isValid) {
            console.warn("[AI] ❌ Response failed validation");
            console.warn("[AI] Response after cleanup:", text.substring(0, 100));
            return null;
        }

        console.log("[AI] ✅ Success - Response valid");
        console.log("[AI] Response length:", text.length);
        return text;

    } catch (e) {
        console.error("[AI] ❌ Puter.js error:", e.message);
        console.error("[AI] Stack:", e.stack?.substring(0, 200));
        return null;
    }
}

/**
 * Clean AI response from common artifacts
 */
function cleanAIResponse(text) {
    if (!text || typeof text !== 'string') return "";

    let cleaned = text
        .replace(/data:\s*\[DONE\]/gi, "") // Remove streaming markers anywhere
        .replace(/^data:\s*\[DONE\]/gm, "");

    // If it contains "data: {" then it's probably SSE stream that needs content extraction
    if (cleaned.includes('data: {')) {
        const lines = cleaned.split('\n');
        let extractedText = "";
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const json = JSON.parse(line.substring(6));
                    if (json.text) extractedText += json.text;
                    else if (json.choices?.[0]?.delta?.content) extractedText += json.choices[0].delta.content;
                    else if (json.message?.content) extractedText += json.message.content;
                    else if (json.choices?.[0]?.text) extractedText += json.choices[0].text;
                } catch (e) {
                    // Not valid JSON or doesn't have the expected field
                }
            } else if (line.trim() !== "") {
                extractedText += line + "\n";
            }
        }
        cleaned = extractedText;
    }

    return cleaned.trim();
}

/**
 * Main AI entry point.
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 2) return await localMJ(systemPrompt, userPrompt);

    // Sanitize prompts
    const sanitizedSystem = systemPrompt.length > 4000 ? systemPrompt.substring(0, 4000) : systemPrompt;
    const sanitizedUser = userPrompt.length > 2000 ? userPrompt.substring(0, 2000) : userPrompt;

    const providers = [
        { name: 'Puter.js Gemini (Free)', fn: callPuterGeminiAI },
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
            let result = await provider.fn(sanitizedSystem, sanitizedUser);

            if (result) {
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

    console.warn("[AI] Tous les providers ont échoué, utilisation du MJ Local");
    return await localMJ(systemPrompt, userPrompt);
}

async function callPuterSDK(system, prompt) {
    const p = initPuter();
    if (!p) return null;

    // Priority: GPT-4o (User Directive) > Gemini 1.5 Flash > others
    const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash", "gemini-1.5-pro", "openai/gpt-4o", "gpt-4o-mini"];
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
    if (!process.env.PUTER_API_KEY || process.env.PUTER_API_KEY === 'test_key') return null;

    const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash"];
    for (const model of models) {
        try {
            console.log(`[AI] API Puter - Modèle: ${model}`);
            const resp = await axios.post("https://api.puter.com/v1/chat/completions", {
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ],
                model: model,
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.PUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            const content = resp.data?.choices?.[0]?.message?.content || resp.data?.message?.content;
            if (content && content.length > 10) return content;
        } catch (e) {
            console.warn(`[AI] Puter API Model ${model} failed:`, e.message);
            continue;
        }
    }
    return null;
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

        if (typeof resp.data === 'string') return resp.data;
        return JSON.stringify(resp.data);
    } catch (e) { return null; }
}

async function callPollinationsPOST(system, prompt) {
    try {
        const response = await axios.post('https://text.pollinations.ai/', {
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt }
            ],
            model: 'openai',
            seed: Math.floor(Math.random() * 1000000),
            jsonMode: system.toLowerCase().includes('json')
        }, { timeout: 15000 });
        return response.data;
    } catch (e) { return null; }
}

async function callPollinationsGET(system, prompt) {
    try {
        const encodedSystem = encodeURIComponent(system);
        const encodedPrompt = encodeURIComponent(prompt);
        const url = `https://text.pollinations.ai/${encodedPrompt}?system=${encodedSystem}&model=openai&seed=${Math.floor(Math.random() * 1000000)}`;
        const response = await axios.get(url, { timeout: 15000 });
        return response.data;
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
 * Final Fallback: Immersive local MJ with context-aware system.
 */
async function localMJ(systemPrompt, userPrompt) {
    console.log("[AI] MJ Local activé.");

    const up = userPrompt.toLowerCase();
    const statsMatch = systemPrompt.match(/STATS: (.*)/);
    const stats = statsMatch ? statsMatch[1] : "Moyennes";
    const difficultyMatch = systemPrompt.match(/DIFFICULTY: (\d+)/);
    const difficulty = difficultyMatch ? parseInt(difficultyMatch[1]) : 1;

    // Context Detection
    const isTutorial = systemPrompt.toLowerCase().includes("instructeur") || userPrompt.toLowerCase().includes("instructeur");

    // Better opponent detection: look for names in system prompt or nearby players list
    let existingOpponent = null;
    const pnjMatch = systemPrompt.match(/PNJ ici:\n- ([^\n:]+)/);
    const playerMatch = systemPrompt.match(/Joueurs à proximité:\n- Nom: ([^,]+)/);
    const historyMatch = systemPrompt.match(/HISTORIQUE:\n([^:]+):/);

    if (pnjMatch) existingOpponent = pnjMatch[1].split('(')[0].trim();
    else if (playerMatch) existingOpponent = playerMatch[1].trim();
    else if (historyMatch) existingOpponent = historyMatch[1].trim();

    // Generate or retrieve enemy if in combat
    const isCombat = up.includes("attaque") || up.includes("frappe") || up.includes("tue") || up.includes("combat") || up.includes("découpe");

    let enemy = null;
    if (isCombat) {
        if (isTutorial) {
            enemy = { name: "Instructeur", level: 99, power: 5, defense: 5, speed: 10, reactionTime: 200, counterChance: 0.9 };
        } else if (existingOpponent && !up.includes("gobelin") && !up.includes("goblin")) {
            enemy = { name: existingOpponent, level: difficulty, power: difficulty, defense: difficulty, speed: 5 + difficulty, reactionTime: 1000 - (difficulty * 100), counterChance: 0.2 + (difficulty * 0.1) };
        } else {
            enemy = generateEnemy(difficulty);
        }
    }

    let actionType = "Action";
    let roll = Math.floor(Math.random() * 20) + 1;
    let result = "Réussite";

    if (isCombat) actionType = "Combat";
    else if (up.includes("va à") || up.includes("déplace") || up.includes("entre")) actionType = "Mouvement";
    else if (up.includes("parle") || up.includes("dis") || up.includes("demande")) actionType = "Social";

    if (roll === 1) result = "Échec Critique";
    else if (roll < 8) result = "Échec";
    else if (roll < 14) result = "Réussite mitigée";
    else if (roll === 20) result = "Réussite Critique";

    let narrative = `[MJ Local] (Dé: ${roll} - ${result})\n\n`;
    const actions = [{ type: "update_player", parameters: { xp_gain: 10 } }];
    const metadata = { enemy: null, reactionTime: 0, counterAttack: null };

    if (actionType === "Combat" && enemy) {
        const reactionTime = getReactionDelay(enemy);
        const counterAttack = generateCounterAttack(enemy, roll);
        
        metadata.enemy = enemy;
        metadata.reactionTime = reactionTime;
        metadata.counterAttack = counterAttack;

        if (!isTutorial && !existingOpponent) {
            narrative += `⚔️ **${enemy.name}** (Niv. ${enemy.level}) apparaît !\n`;
            narrative += `├─ Puissance: ${enemy.power}/5 | Défense: ${enemy.defense} | Vitesse: ${enemy.speed}\n`;
            narrative += `├─ Temps de réaction: ${Math.round(reactionTime)}ms\n`;
            narrative += `└─ Chance de contre-attaque: ${Math.round(enemy.counterChance * 100)}%\n\n`;
        }

        if (isTutorial) {
            if (result === 'Réussite Critique') {
                narrative += `🎯 L'Instructeur écarquille les yeux ! Ta lame fend l'air avec une précision chirurgicale, l'obligeant à parer de justesse. "Ho... pas mal du tout, gamin !"`;
                actions[0].parameters.xp_gain = 50;
                actions.push({ type: "tutorial_complete", parameters: { tutorial_complete: true } });
            } else if (result === 'Réussite' || result === 'Réussite mitigée') {
                narrative += `⚡ Ton coup est vif, mais l'Instructeur dévie ta trajectoire d'un simple mouvement du poignet. "C'est ça l'intention de tuer ? Tu peux faire mieux !"`;
                actions[0].parameters.xp_gain = 20;
            } else {
                narrative += `❌ L'Instructeur évite ton assaut sans même sembler bouger. "Trop lent ! Dans un donjon de Rang S, tu serais déjà mort."`;
                actions[0].parameters.xp_gain = 5;
            }
        } else {
            if (result === 'Réussite Critique') {
                narrative += `🎯 Tu lances une attaque foudroyante ! L'énergie crépitante te propulse en avant. Ton coup atteint directement ${enemy.name} de plein fouet ! `;
                narrative += `Les dégâts sont dévastateurs et l'ennemi vacille sous la violence du choc.`;
                actions[0].parameters.xp_gain = 25;
            } else if (result === 'Réussite mitigée') {
                narrative += `⚡ Ton attaque déroutante tente de traverser la garde de ${enemy.name}. `;
                if (counterAttack && counterAttack.willCounter) {
                    narrative += `Mais en ${counterAttack.severity === 'Critique' ? Math.round(reactionTime / 2) : Math.round(reactionTime)}ms, `;
                    narrative += `l'ennemi contre-attaque avec une force ${counterAttack.severity.toLowerCase()} ! Tu dois te défendre d'urgence !`;
                    actions[0].parameters.xp_gain = 15;
                } else {
                    narrative += `Tu gratignes légèrement ta cible, mais l'adversaire demeure vigilant.`;
                    actions[0].parameters.xp_gain = 12;
                }
            } else if (result === 'Échec') {
                narrative += `❌ Ta tentative d'attaque est repérée trop tard ! ${enemy.name} esquive avec aisance. `;
                if (counterAttack && counterAttack.willCounter) {
                    narrative += `En seulement ${Math.round(reactionTime)}ms, il riposte avec une attaque ${counterAttack.severity.toLowerCase()}. Attention !`;
                    actions[0].parameters.xp_gain = 5;
                } else {
                    narrative += `L'ennemi se repositionne, prêt à la prochaine offensive.`;
                    actions[0].parameters.xp_gain = 3;
                }
            } else if (result === 'Échec Critique') {
                narrative += `💥 **DÉSASTRE** ! Tu trébuches en tentant ton attaque ! ${enemy.name} te voit vulnérable. `;
                narrative += `En moins de ${Math.round(reactionTime / 2)}ms, il lance une contre-attaque DÉVASTATRICE. Tu subis des dégâts massifs !`;
                actions[0].parameters.xp_gain = 1;
            }
        }

        // Add environmental hazard for high-level enemies
        if (enemy.level >= 4 && !isTutorial) {
            narrative += `\n\n🌪️ L'arène commence à se déchirer sous la puissance du combat ! Des fragments de réalité flottent autour de vous.`;
        }

    } else if (actionType === "Mouvement") {
        narrative += `Tu te mets en route à travers les terres d'Aetherys. Le voyage se déroule ${result === 'Réussite Critique' ? 'magnifiquement' : result === 'Échec Critique' ? 'désastreusement' : 'sans encombre majeur'}, et tu atteins ton but sous un ciel chargé d'éclairs de mana.`;
    } else {
        narrative += `Tu agis avec assurance dans ce monde de dangers. Le destin semble te ${result === 'Réussite Critique' ? 'sourire grandement' : result === 'Échec Critique' ? 'tourner le dos' : 'sourire'} alors que tu traces ton chemin à Eldoria.`;
    }

    return JSON.stringify({
        narrative: narrative,
        actions: actions,
        metadata: metadata
    });
}

module.exports = { callAI, cleanAIResponse, generateEnemy, getReactionDelay, generateCounterAttack, ENEMY_LEVELS };
