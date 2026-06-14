const axios = require('axios');

/**
 * AI Provider functions exported for diagnostics
 */

async function callPollinationsPOST(system, prompt) {
    const models = ['openai', 'mistral', 'llama', 'unity', 'p1', 'searchgpt'];
    const model = models[Math.floor(Math.random() * models.length)];
    try {
        const response = await axios.post('https://text.pollinations.ai/', {
            messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
            model: model, jsonMode: true, seed: Math.floor(Math.random() * 1000000)
        }, {
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
            timeout: 20000
        });
        const data = response.data;
        if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
        return typeof data === 'string' ? data : JSON.stringify(data);
    } catch (e) { return null; }
}

async function callPollinationsGET(system, prompt) {
    try {
        const combined = `System: ${system}\n\nUser: ${prompt}`;
        // No seed to increase cache hits if possible, or just keep it simple
        const url = `https://text.pollinations.ai/${encodeURIComponent(combined)}?model=openai&cache=true`;
        const response = await axios.get(url, { timeout: 30000 });
        if (response.data) return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (e) {
        console.error("[AI] Pollinations GET error:", e.message);
        return null;
    }
    return null;
}

async function callBlackbox(system, prompt) {
    try {
        const resp = await axios.post("https://www.blackbox.ai/api/chat", {
            messages: [{ role: "user", content: `SYSTEM: ${system}\n\nUSER: ${prompt}` }],
            model: "deepseek-v3"
        }, { timeout: 20000 });
        const data = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        if (data.includes('errorText')) return null;
        return data;
    } catch (e) { return null; }
}

async function callOpenRouterFree(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    try {
        const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "google/gemini-2.0-flash-exp:free",
            messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://github.com/Eoza-cell/GHENO-CITY-2' },
            timeout: 25000
        });
        return resp.data?.choices?.[0]?.message?.content;
    } catch (e) { return null; }
}

async function callOllama(system, prompt) {
    try {
        const response = await axios.post(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/generate`, {
            model: 'qwen2.5:7b', prompt: prompt, system: system, stream: false
        }, { timeout: 30000 });
        return response.data?.response;
    } catch (e) { return null; }
}

async function callPuterSDK(system, prompt) {
    try {
        const puter = require('@heyputer/puter.js');
        const p = puter.default || puter;
        const combined = `System: ${system}\n\nUser: ${prompt}`;

        // Prioritize models that are often free/available keyless
        const models = ["gemini-1.5-flash", "gpt-4o-mini", "claude-3-5-sonnet"];

        for (const model of models) {
            try {
                const response = await Promise.race([
                    p.ai.chat(combined, { model: model }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12000))
                ]);

                if (response) {
                    const text = typeof response === 'string' ? response : (response.text || response.message?.content);
                    if (text && text.length > 5 && !text.includes('Unauthorized') && !text.includes('Error')) {
                        return text;
                    }
                }
            } catch (err) {
                // If it's a stack overflow, stop trying Puter models
                if (err instanceof RangeError || err.message.includes('stack')) return null;
            }
        }
    } catch (e) {}
    return null;
}

async function callMJFallback(system, prompt) {
    console.warn("[AI] ⚠️ MJ Fallback activé.");
    let actionPart = "ton action";
    if (prompt.includes('ACTION DU JOUEUR:')) actionPart = prompt.split('ACTION DU JOUEUR:').pop().trim();
    else if (prompt.includes('ACTION:')) actionPart = prompt.split('ACTION:').pop().trim();

    let playerName = "Aventurier";
    if (prompt.includes('- Nom:')) playerName = prompt.split('- Nom:')[1].split('\n')[0].trim();

    const templates = [
        `*Le monde semble vibrer sous l'impact de ta volonté.* \n\n${playerName}, tu exécutes ton geste avec détermination : "${actionPart}". \nL'Instructeur t'observe avec un regard impénétrable. "Pas mal," grogne-t-il, "mais la route est encore longue." Tu sens ton expérience s'affiner.`,
        `Une onde de choc parcourt la zone alors que tu tentes de "${actionPart}". \nLe destin sourit à ton audace, ${playerName}. Bien que l'avenir soit incertain, ton geste laisse une marque indélébile dans les couloirs d'Aetherys.`,
        `*DODODO!* \nL'Instructeur esquive ton geste à la dernière seconde. "C'était bien tenté, ${playerName}, mais ton intention de tuer doit être plus pure !" Ton action a été entendue par le monde lui-même.`
    ];
    return {
        narrative: templates[Math.floor(Math.random() * templates.length)] + "\n\n(Note: Les serveurs de l'IA sont surchargés, ceci est une réponse de secours.)",
        actions: [{"type": "update_player", "parameters": {"xp_gain": 5, "col_change": 2}}]
    };
}

/**
 * Robust Narrative & Action Extraction
 */
function cleanAIResponse(text) {
    if (!text || typeof text !== 'string') return "";
    return text
        .replace(/^```(json|JSON)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .replace(/data:\s*\[DONE\]/gi, "")
        .replace(/data:\s*/gi, "")
        .trim();
}

function extractNarrative(content) {
    let aiResponse = { narrative: "", actions: [], tutorial_complete: false };
    if (!content) return aiResponse;
    if (typeof content === 'object' && !Array.isArray(content)) {
        aiResponse = { ...aiResponse, ...content };
        if (!aiResponse.narrative) aiResponse.narrative = aiResponse.text || aiResponse.message || aiResponse.content || "";
        return aiResponse;
    }
    const cleaned = cleanAIResponse(content);
    const jsonObjects = [];
    let braceCount = 0, startIndex = -1;
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') { if (braceCount === 0) startIndex = i; braceCount++; }
        else if (cleaned[i] === '}') { braceCount--; if (braceCount === 0 && startIndex !== -1) { jsonObjects.push(cleaned.substring(startIndex, i + 1)); startIndex = -1; } }
    }
    let textSegments = [], currentPos = 0;
    if (jsonObjects.length > 0) {
        for (const potentialJson of jsonObjects) {
            const jsonIndex = cleaned.indexOf(potentialJson, currentPos);
            if (jsonIndex > currentPos) textSegments.push(cleaned.substring(currentPos, jsonIndex));
            currentPos = jsonIndex + potentialJson.length;
            try {
                const parsed = JSON.parse(potentialJson);
                if (parsed.narrative) textSegments.push(parsed.narrative);
                else if (parsed.message) textSegments.push(parsed.message);
                if (parsed.actions) { if (Array.isArray(parsed.actions)) aiResponse.actions = [...aiResponse.actions, ...parsed.actions]; else aiResponse.actions.push(parsed.actions); }
                if (parsed.tutorial_complete !== undefined) aiResponse.tutorial_complete = parsed.tutorial_complete;
            } catch (e) { textSegments.push(potentialJson); }
        }
        if (currentPos < cleaned.length) textSegments.push(cleaned.substring(currentPos));
    }
    aiResponse.narrative = textSegments.map(s => s.trim()).filter(s => s.length > 0).join("\n\n");
    if (!aiResponse.narrative || aiResponse.narrative.length < 2) aiResponse.narrative = cleaned;
    return aiResponse;
}

/**
 * Main AI Loop
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 2) return null;
    const providers = [
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'Pollinations POST', fn: callPollinationsPOST },
        { name: 'Pollinations GET', fn: callPollinationsGET },
        { name: 'OpenRouter Free', fn: callOpenRouterFree },
        { name: 'Blackbox AI', fn: callBlackbox },
        { name: 'Ollama', fn: callOllama }
    ];
    for (const p of providers) {
        try {
            console.log(`[AI] Tentative: ${p.name}...`);
            const res = await p.fn(systemPrompt, userPrompt);
            if (res) {
                if (typeof res === 'string' && (res.includes('Unauthorized') || res.includes('401') || res.includes('429')) && res.length < 300) continue;
                return res;
            }
        } catch (e) {}
    }
    return await callMJFallback(systemPrompt, userPrompt);
}

module.exports = {
    callAI, cleanAIResponse, extractNarrative,
    callPollinationsPOST, callPollinationsGET, callBlackbox, callOpenRouterFree, callOllama, callPuterSDK, callMJFallback
};
