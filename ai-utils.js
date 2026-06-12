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
 * Aggressively scrubs technical AI artifacts (SSE data, technical JSON)
 * but keeps legitimate narrative text.
 */
function cleanAIResponse(text) {
    if (!text || typeof text !== 'string') return "";

    let cleaned = text;

    // 1. Strip common technical prefixes/suffixes used by SSE providers (Blackbox, Pollinations)
    // Example: data: {"type":"message", "content": "..."}
    // We try to extract the content value if it's nested in a technical JSON string
    if (cleaned.includes('data: {"type":')) {
        const matches = [...cleaned.matchAll(/data: (\{.*?\})/g)];
        let narrativeBuffer = "";
        for (const match of matches) {
            try {
                const parsed = JSON.parse(match[1]);
                if (parsed.content) narrativeBuffer += parsed.content;
                else if (parsed.text) narrativeBuffer += parsed.text;
            } catch (e) {
                // If parse fails, it might be partial or "done"
            }
        }
        if (narrativeBuffer.length > 5) cleaned = narrativeBuffer;
    }

    // 2. Remove [DONE] markers and leftover data: prefixes
    cleaned = cleaned
        .replace(/data:\s*\[DONE\]/gi, "")
        .replace(/data:\s*/gi, "")
        .trim();

    // 3. Remove technical error markers
    if (cleaned.includes('"errorText"') || cleaned.includes('"Authentication Error"') || cleaned.includes('"type":"error"')) {
        console.warn("[AI] Technical error string detected, filtering.");
        return "";
    }

    // 4. Remove markdown code blocks
    cleaned = cleaned
        .replace(/^```(json|JSON)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

    return cleaned;
}

/**
 * Robust extraction of Narrative and Actions.
 * Handles both JSON strings and plain text narratives.
 */
function extractNarrative(content) {
    let aiResponse = { narrative: "", actions: [], tutorial_complete: false };

    if (!content) return aiResponse;

    if (typeof content === 'object') {
        aiResponse = { ...aiResponse, ...content };
        if (!aiResponse.narrative) {
            aiResponse.narrative = aiResponse.text || aiResponse.content || aiResponse.message || "";
        }
    } else {
        // First pass: clean technical artifacts
        const cleaned = cleanAIResponse(content);

        // Try to locate a JSON object in the cleaned text
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
            const potentialJson = cleaned.substring(firstBrace, lastBrace + 1);
            try {
                const parsed = JSON.parse(potentialJson);
                // If it's a valid JSON with game logic, merge it
                if (parsed.narrative || parsed.actions) {
                    aiResponse = { ...aiResponse, ...parsed };
                }
            } catch (e) {
                // Not valid JSON or partial
            }
        }

        // If narrative is still empty, extract it from around the JSON or the whole string
        if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
            let textBefore = firstBrace !== -1 ? cleaned.substring(0, firstBrace).trim() : "";
            let textAfter = lastBrace !== -1 ? cleaned.substring(lastBrace + 1).trim() : "";

            if (textBefore.length > 5) aiResponse.narrative = textBefore;
            else if (textAfter.length > 5) aiResponse.narrative = textAfter;
            else if (firstBrace === -1) aiResponse.narrative = cleaned;
        }
    }

    // Final scrub of technical labels in the narrative
    if (aiResponse.narrative) {
        aiResponse.narrative = aiResponse.narrative
            .replace(/^(Narrative|Narrateur|MJ|Systeme|Arise|json|JSON)\s*[:=]\s*/i, '')
            .trim();
    }

    return aiResponse;
}

/**
 * Main AI entry point with high-resilience chain
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 3) return null;

    const providers = [
        { name: 'OpenRouter Free', fn: callOpenRouterFree },
        { name: 'Pollinations POST', fn: callPollinationsPOST },
        { name: 'Pollinations GET', fn: callPollinationsGET },
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'Blackbox', fn: callBlackbox }
    ];

    for (const provider of providers) {
        try {
            console.log(`[AI] Tentative: ${provider.name}...`);
            let result = await provider.fn(systemPrompt, userPrompt);

            if (result) {
                if (typeof result === 'object' || result.length > 10) {
                    console.log(`[AI] ✅ Succès avec ${provider.name}`);
                    return result;
                }
            }
        } catch (e) {
            console.warn(`[AI] ❌ Échec ${provider.name}:`, e.message || "Timeout");
        }
    }

    if (depth < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await callAI(systemPrompt, userPrompt, depth + 1);
    }

    return null;
}

async function callOpenRouterFree(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY.length < 10) return null;
    const models = [
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "nvidia/llama-3.1-nemotron-70b-instruct:free",
        "google/gemini-2.0-flash-thinking-exp:free"
    ];

    for (const model of models) {
        try {
            const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: model,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: prompt }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/Eoza-cell/GHENO-CITY-2',
                    'X-Title': 'Gheno City 2'
                },
                timeout: 15000
            });
            const content = resp.data?.choices?.[0]?.message?.content;
            if (content) return content;
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
                seed: Math.floor(Math.random() * 1000000)
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });

            let data = response.data;
            if (data) {
                if (typeof data === 'string' && data.length > 5) return data;
                if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
                if (typeof data === 'object') return JSON.stringify(data);
            }
        } catch (e) { continue; }
    }
    return null;
}

async function callPollinationsGET(system, prompt) {
    try {
        const combined = `System: ${system}\nUser: ${prompt}`;
        const url = `https://text.pollinations.ai/${encodeURIComponent(combined.substring(0, 800))}?model=openai&seed=${Math.floor(Math.random()*1000)}`;
        const response = await axios.get(url, { timeout: 15000 });
        if (response.data && response.data.length > 5) return response.data;
    } catch (e) {}
    return null;
}

async function callPuterSDK(system, prompt) {
    const p = initPuter();
    if (!p) return null;
    const models = ["gpt-4o", "claude-3-5-sonnet"];
    for (const model of models) {
        try {
            const combined = `[SYSTEM]\n${system}\n\n[USER]\n${prompt}`;
            const resp = await p.ai.chat(combined, { model });
            if (resp) return resp;
        } catch (e) { continue; }
    }
    return null;
}

async function callBlackbox(system, prompt) {
    try {
        const resp = await axios.post("https://www.blackbox.ai/api/chat", {
            messages: [{ role: "user", content: `SYSTEM: ${system}\n\nUSER: ${prompt}` }],
            model: "deepseek-v3"
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.blackbox.ai/'
            },
            timeout: 15000
        });
        return resp.data;
    } catch (e) { return null; }
}

module.exports = { callAI, cleanAIResponse, extractNarrative };
