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

    // 1. Handle SSE (Server-Sent Events) from providers like Blackbox
    // Example: data: {"type":"message", "content": "..."}
    if (cleaned.includes('data: {')) {
        let narrativeBuffer = "";
        const lines = cleaned.split('\n');
        for (const line of lines) {
            let actualLine = line.trim();
            if (actualLine.startsWith('data: ')) {
                const jsonStr = actualLine.substring(6).trim();
                if (jsonStr === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(jsonStr);
                    // Extract content from various known SSE formats
                    let content = parsed.content || parsed.text ||
                                 parsed.choices?.[0]?.delta?.content ||
                                 parsed.choices?.[0]?.message?.content || "";
                    if (content) narrativeBuffer += content;
                } catch (e) {
                    // Partial JSON or other technical data, skip
                }
            } else if (actualLine && !actualLine.startsWith('data:')) {
                // If it's not data: but has content, keep it
                narrativeBuffer += actualLine + "\n";
            }
        }
        if (narrativeBuffer.trim().length > 2) cleaned = narrativeBuffer.trim();
    }

    // 2. Aggressive technical prefix removal
    cleaned = cleaned
        .replace(/data:\s*\[DONE\]/gi, "")
        .replace(/data:\s*/gi, "")
        .trim();

    // 3. Filter technical error messages
    const technicalErrors = ['"errorText"', '"Authentication Error"', '"type":"error"', 'Unauthorized', 'Rate limit', 'Internal Server Error'];
    if (technicalErrors.some(err => cleaned.includes(err) && cleaned.length < 500)) {
        console.warn("[AI] Technical error detected in cleaning phase, discarding response.");
        return "";
    }

    // 4. Remove Markdown formatting
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

    if (typeof content === 'object' && !Array.isArray(content)) {
        aiResponse = { ...aiResponse, ...content };
        if (!aiResponse.narrative) {
            let possibleNarrative = aiResponse.text || aiResponse.content || aiResponse.message || "";
            // Handle nested message.content
            if (typeof possibleNarrative === 'object' && possibleNarrative.content) {
                possibleNarrative = possibleNarrative.content;
            }
            // Handle array of parts
            if (Array.isArray(possibleNarrative)) {
                possibleNarrative = possibleNarrative.map(p => typeof p === 'string' ? p : (p.text || "")).join("");
            }
            aiResponse.narrative = possibleNarrative;
        }
        // Ensure actions is an array
        if (aiResponse.actions && !Array.isArray(aiResponse.actions)) {
            aiResponse.actions = [aiResponse.actions];
        }
    } else {
        const cleaned = cleanAIResponse(content);

        // Improved JSON detection: look for something that looks like {"narrative": ...}
        // Try to find all JSON-like objects and merge them
        const jsonMatches = cleaned.match(/\{[\s\S]*?\}/g);

        if (jsonMatches) {
            for (const potentialJson of jsonMatches) {
                try {
                    const parsed = JSON.parse(potentialJson);
                    // Merge properties, prioritizing narrative and actions
                    if (parsed.narrative) {
                        if (aiResponse.narrative) aiResponse.narrative += "\n\n" + parsed.narrative;
                        else aiResponse.narrative = parsed.narrative;
                    }
                    if (parsed.actions) {
                        if (Array.isArray(parsed.actions)) {
                            aiResponse.actions = [...(aiResponse.actions || []), ...parsed.actions];
                        } else {
                            aiResponse.actions.push(parsed.actions);
                        }
                    }
                    if (parsed.tutorial_complete !== undefined) aiResponse.tutorial_complete = parsed.tutorial_complete;

                    // Capture other potential fields
                    if (parsed.message && !aiResponse.narrative) aiResponse.narrative = parsed.message;
                    if (parsed.content && !aiResponse.narrative) aiResponse.narrative = parsed.content;
                } catch (e) {
                    // Not valid JSON or partial, skip
                }
            }
        }

        // If narrative is still empty or we didn't find JSON, use the whole cleaned text
        if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
            // Remove the merged JSON objects from the text before using it as narrative
            let finalNarrative = cleaned;
            if (jsonMatches) {
                for (const match of jsonMatches) {
                    finalNarrative = finalNarrative.replace(match, '');
                }
            }
            aiResponse.narrative = finalNarrative.trim() || cleaned;
        }
    }

    // Final scrub of technical labels
    if (aiResponse.narrative && typeof aiResponse.narrative === 'string') {
        // Only remove JSON from narrative if we actually have actions extracted
        // This prevents deleting the only content we have if it's JSON formatted
        if (aiResponse.actions.length > 0 || aiResponse.tutorial_complete) {
            aiResponse.narrative = aiResponse.narrative.replace(/\{[\s\S]*\}/g, '').trim();
        }

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
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'OpenRouter Free', fn: callOpenRouterFree },
        { name: 'Pollinations POST', fn: callPollinationsPOST },
        { name: 'Pollinations GET', fn: callPollinationsGET },
        { name: 'Blackbox', fn: callBlackbox }
    ];

    for (const provider of providers) {
        try {
            console.log(`[AI] Tentative: ${provider.name}...`);
            let result = await provider.fn(systemPrompt, userPrompt);

            if (result) {
                // If it's a technical error string, treat as failure and continue to next provider
                const technicalErrors = ['"errorText"', '"Authentication Error"', '"type":"error"', 'Unauthorized', 'Rate limit', 'Internal Server Error', '401', '429'];
                if (typeof result === 'string' && technicalErrors.some(err => result.includes(err) && result.length < 500)) {
                    console.warn(`[AI] Technical error detected in ${provider.name} output, skipping.`);
                    continue;
                }

                if (typeof result === 'object' || result.length > 5) {
                    console.log(`[AI] ✅ Succès avec ${provider.name}`);
                    return result;
                }
            }
        } catch (e) {
            console.warn(`[AI] ❌ Échec ${provider.name}:`, e.message || "Timeout");
        }
    }

    if (depth < 3) {
        console.log(`[AI] Tous les providers ont échoué à la profondeur ${depth}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await callAI(systemPrompt, userPrompt, depth + 1);
    }

    return null;
}

async function callOpenRouterFree(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY.length < 5) return null;
    const models = [
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "nvidia/llama-3.1-nemotron-70b-instruct:free",
        "google/gemini-2.0-flash-thinking-exp:free"
    ];

    for (const model of models) {
        try {
            console.log(`[AI] OpenRouter - Tentative avec ${model}`);
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
                timeout: 25000
            });
            const content = resp.data?.choices?.[0]?.message?.content;
            if (content && content.length > 5) return content;
        } catch (e) {
            console.warn(`[AI] OpenRouter model ${model} failed:`, e.message);
            continue;
        }
    }
    return null;
}

async function callPollinationsPOST(system, prompt) {
    const models = ['openai', 'mistral', 'llama', 'p1'];
    for (const model of models) {
        try {
            console.log(`[AI] Pollinations POST - Tentative avec ${model}`);
            const response = await axios.post('https://text.pollinations.ai/', {
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt }
                ],
                model: model,
                seed: Math.floor(Math.random() * 1000000),
                jsonMode: system.toLowerCase().includes('json')
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 30000
            });

            let data = response.data;
            if (data) {
                if (typeof data === 'string' && data.length > 5) return data;
                if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
                if (typeof data === 'object') {
                    // Handle unexpected object response
                    if (data.content) return data.content;
                    if (data.text) return data.text;
                    return JSON.stringify(data);
                }
            }
        } catch (e) {
            console.warn(`[AI] Pollinations POST (${model}) failed:`, e.message);
            continue;
        }
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

    // User requested Puter.js as primary. Priority: gpt-4o > claude-3.5-sonnet > gemini-1.5-flash
    const models = ["gpt-4o", "claude-3.5-sonnet", "gemini-1.5-flash"];

    for (const model of models) {
        try {
            console.log(`[AI] Puter.js - Tentative avec ${model}`);
            const response = await p.ai.chat([
                { role: 'system', content: system },
                { role: 'user', content: prompt }
            ], { model: model, stream: false });

            // Handle multiple response formats from Puter SDK
            if (response) {
                if (typeof response === 'string' && response.length > 5) return response;
                if (response.message?.content) {
                    if (typeof response.message.content === 'string') return response.message.content;
                    if (Array.isArray(response.message.content)) return response.message.content.map(c => c.text || c).join("");
                }
                if (response.text) return response.text;
            }
        } catch (e) {
            console.warn(`[AI] Puter.js ${model} failed:`, e.message);
            continue;
        }
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
