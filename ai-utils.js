const axios = require('axios');

// The @heyputer/puter.js SDK is browser-only: it opens a socket.io WebSocket and
// throws an uncaught "Maximum call stack size exceeded" in Node, crashing the
// process. We call Puter's HTTP driver endpoint directly instead.
const PUTER_API_URL = "https://api.puter.com/drivers/call";
// Models confirmed available on the configured Puter account.
const PUTER_MODELS = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash"];

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
 * Detect responses that are not real narrative content (auth errors,
 * raw SSE streams, empty/control-only frames). Any provider returning such
 * a payload must be rejected so we fall through to the next provider / local MJ.
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
        '[done]'
    ];
    if (errorMarkers.some(m => lower.includes(m))) return false;

    return true;
}

/**
 * Parse a (possibly) Server-Sent Events / chunked response into plain text.
 * Returns null if the stream only contains control/error frames.
 */
function parseSSEResponse(raw) {
    if (raw == null) return null;
    if (typeof raw === 'object') {
        const parsed = parsePuterResponse(raw);
        return parsed && parsed !== JSON.stringify(raw) ? parsed : null;
    }
    if (typeof raw !== 'string') return null;

    // Plain text (no SSE framing): return as-is.
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
                // Non-JSON data line: treat as literal text chunk.
                out += payload;
            }
        } else {
            out += payload;
        }
    }

    out = out.trim();
    return out.length > 0 ? out : null;
}

/**
 * Extract plain text from a Puter chat-completion `message.content`,
 * which may be a string or an array of content parts.
 */
function extractMessageContent(content) {
    if (!content) return null;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
        return content.map(c => typeof c === 'string' ? c : (c.text || '')).join('').trim();
    }
    return null;
}

/**
 * Call Puter's AI over its HTTP driver endpoint (no browser SDK).
 * Requires PUTER_API_KEY (a Puter auth token).
 */
async function callPuterAI(system, prompt) {
    const key = process.env.PUTER_API_KEY;
    if (!key || key.length < 6 || key === 'test_key') return null;

    const messages = [
        { role: "system", content: system },
        { role: "user", content: prompt }
    ];

    for (const model of PUTER_MODELS) {
        try {
            console.log(`[AI] Puter HTTP - Modèle: ${model}`);
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
            console.warn(`[AI] Puter HTTP ${model} échec:`, e.response?.data?.error || e.message);
            continue;
        }
    }
    return null;
}

/**
 * Main AI entry point.
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 2) return localMJ(userPrompt, systemPrompt);

    // Sanitize prompts.
    // If userPrompt is too long, we preserve the end (which contains the current action)
    const sanitizedSystem = systemPrompt.length > 6000 ? systemPrompt.substring(0, 6000) : systemPrompt;
    let sanitizedUser = userPrompt;
    if (userPrompt.length > 4000) {
        // Keep the first 1000 (stats/context) and last 3000 (history/action)
        sanitizedUser = userPrompt.substring(0, 1000) + "\n... [TRUNCATED] ...\n" + userPrompt.substring(userPrompt.length - 3000);
    }

    const providers = [
        { name: 'Puter HTTP', fn: callPuterAI },
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
            // localMJ is the deterministic last resort: always trust it.
            if (provider.fn === localMJ && result) {
                console.log(`[AI] ✅ Succès avec ${provider.name}`);
                return result;
            }
            if (isValidAIResponse(result)) {
                console.log(`[AI] ✅ Succès avec ${provider.name}`);
                return result;
            }
            if (result) {
                console.warn(`[AI] ⚠️ ${provider.name} a renvoyé une réponse invalide (rejetée).`);
            }
        } catch (e) {
            console.warn(`[AI] ❌ Échec ${provider.name}:`, e.message || e);
        }
    }

    console.warn("[AI] Tous les providers ont échoué, utilisation du MJ Local");
    return localMJ(userPrompt, systemPrompt);
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
 * Final Fallback: Immersive local MJ with enemy system.
 */
function localMJ(userPrompt, systemPrompt) {
    console.log("[AI] MJ Local activé.");

    // Extract action from userPrompt (assuming it ends with "ACTION: ...")
    const actionMatch = userPrompt.match(/ACTION: (.*)$/s);
    const playerAction = actionMatch ? actionMatch[1].trim() : "ton action";

    const up = userPrompt.toLowerCase();
    const statsMatch = systemPrompt.match(/STATS: (.*)/);
    const stats = statsMatch ? statsMatch[1] : "Moyennes";
    const difficultyMatch = systemPrompt.match(/DIFFICULTY: (\d+)/);
    const difficulty = difficultyMatch ? parseInt(difficultyMatch[1]) : 1;

    // Generate or retrieve enemy if in combat
    const isCombat = up.includes("attaque") || up.includes("frappe") || up.includes("tue") || up.includes("combat");
    const enemy = isCombat ? generateEnemy(difficulty) : null;

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
    const actions = [{ type: "update_player", parameters: { xp_gain: 10 } }];
    const metadata = { enemy: null, reactionTime: 0, counterAttack: null };

    if (actionType === "Combat" && enemy) {
        const reactionTime = getReactionDelay(enemy);
        const counterAttack = generateCounterAttack(enemy, roll);
        
        metadata.enemy = enemy;
        metadata.reactionTime = reactionTime;
        metadata.counterAttack = counterAttack;

        narrative += `⚔️ **${enemy.name}** (Niv. ${enemy.level}) apparaît !\n`;
        narrative += `├─ Puissance: ${enemy.power}/5 | Défense: ${enemy.defense} | Vitesse: ${enemy.speed}\n`;
        narrative += `├─ Temps de réaction: ${Math.round(reactionTime)}ms\n`;
        narrative += `└─ Chance de contre-attaque: ${Math.round(enemy.counterChance * 100)}%\n\n`;

        if (result === 'Réussite Critique') {
            narrative += `🎯 Tu lances une attaque foudroyante ! L'énergie crépitante te propulse en avant. Ton coup atteint directement le ${enemy.name} de plein fouet ! `;
            narrative += `Les dégâts sont dévastateurs et l'ennemi vacille sous la violence du choc.`;
            actions[0].parameters.xp_gain = 25;
        } else if (result === 'Réussite mitigée') {
            narrative += `⚡ Ton attaque déroutante tente de traverser la garde du ${enemy.name}. `;
            if (counterAttack && counterAttack.willCounter) {
                narrative += `Mais en ${counterAttack.severity === 'Critique' ? Math.round(reactionTime / 2) : Math.round(reactionTime)}ms, `;
                narrative += `l'ennemi contre-attaque avec une force ${counterAttack.severity.toLowerCase()} ! Tu dois te défendre d'urgence !`;
                actions[0].parameters.xp_gain = 15;
            } else {
                narrative += `Tu gratignes légèrement ta cible, mais l'adversaire demeure vigilant.`;
                actions[0].parameters.xp_gain = 12;
            }
        } else if (result === 'Échec') {
            narrative += `❌ Ta tentative d'attaque est repérée trop tard ! Le ${enemy.name} esquive avec aisance. `;
            if (counterAttack && counterAttack.willCounter) {
                narrative += `En seulement ${Math.round(reactionTime)}ms, il riposte avec une attaque ${counterAttack.severity.toLowerCase()}. Attention !`;
                actions[0].parameters.xp_gain = 5;
            } else {
                narrative += `L'ennemi se repositionne, prêt à la prochaine offensive.`;
                actions[0].parameters.xp_gain = 3;
            }
        } else if (result === 'Échec Critique') {
            narrative += `💥 **DÉSASTRE** ! Tu trébuches en tentant ton attaque ! Le ${enemy.name} te voit vulnérable. `;
            narrative += `En moins de ${Math.round(reactionTime / 2)}ms, il lance une contre-attaque DÉVASTATRICE. Tu subis des dégâts massifs !`;
            actions[0].parameters.xp_gain = 1;
        }

        // Add environmental hazard for high-level enemies
        if (enemy.level >= 4) {
            narrative += `\n\n🌪️ L'arène commence à se déchirer sous la puissance du combat ! Des fragments de réalité flottent autour de vous.`;
        }

    } else if (actionType === "Mouvement") {
        const meters = 10 + Math.floor(Math.random() * 90);
        narrative += `Tu parcours environ ${meters} mètres vers ta destination à travers les terres d'Aetherys. Le voyage se déroule ${result === 'Réussite Critique' ? 'magnifiquement' : result === 'Échec Critique' ? 'désastreusement' : 'sans encombre majeur'}, et tu progresses sous un ciel chargé d'éclairs de mana.`;
    } else {
        narrative += `Tu décides de : "${playerAction}".\n\nLe destin semble te ${result === 'Réussite Critique' ? 'sourire grandement' : result === 'Échec Critique' ? 'tourner le dos' : 'sourire'} alors que tu traces ton chemin à Aetherys. Tu parviens à accomplir ce que tu souhaitais avec une efficacité relative à ton jet de dé.`;
    }

    return JSON.stringify({
        narrative: narrative,
        actions: actions,
        metadata: metadata
    });
}

module.exports = { callAI, generateEnemy, getReactionDelay, generateCounterAttack, ENEMY_LEVELS };
