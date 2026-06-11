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
        
        // Ensure the prompt encourages the requested format
        const enhancedPrompt = `${prompt}\n\nIMPORTANT: Répondre au format JSON si demandé dans le prompt système, sinon répondre avec la narration pure en français. Pas de "data: [DONE]".`;

        // User Directive: models to prioritize: gpt-4o, claude-3-5-sonnet, gemini-1.5-flash
        const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash"];
        let resp = null;
        let lastError = null;

        for (const model of models) {
            try {
                console.log(`[AI] Puter.js - Essai avec ${model}...`);
                resp = await p.ai.chat(enhancedPrompt, {
                    model: model,
                    system: system,
                    stream: false
                });
                if (resp) break;
            } catch (e) {
                lastError = e;
                console.warn(`[AI] Modèle ${model} échoué: ${e.message}`);
                continue;
            }
        }

        if (!resp) throw lastError || new Error("Tous les modèles Puter ont échoué");

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
        .replace(/^data:\s*\[DONE\]/gm, "")
        .trim();

    // Clean markdown blocks and leading labels
    cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .replace(/^(json|JSON)\s*/i, "")
        .trim();

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
    if (depth > 2) return null;

    console.log(`[AI] callAI - Tentative globale #${depth + 1}`);

    // Sanitize prompts
    const sanitizedSystem = systemPrompt.length > 4000 ? systemPrompt.substring(0, 4000) : systemPrompt;
    const sanitizedUser = userPrompt.length > 2000 ? userPrompt.substring(0, 2000) : userPrompt;

    const providers = [
        { name: 'Puter.js Gemini (Free)', fn: callPuterGeminiAI },
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'Puter API', fn: callPuterAPI },
        { name: 'OpenRouter', fn: callOpenRouter },
        { name: 'Blackbox', fn: callBlackbox },
        { name: 'Pollinations GET', fn: callPollinationsGET },
        { name: 'Pollinations POST', fn: callPollinationsPOST }
    ];

    for (const provider of providers) {
        try {
            console.log(`[AI] Tentative: ${provider.name}...`);
            let result = await provider.fn(sanitizedSystem, sanitizedUser);

            if (result) {
                result = cleanAIResponse(result);
                if (result.length > 5) { // Lowered threshold slightly
                    console.log(`[AI] ✅ Succès avec ${provider.name}`);
                    return result;
                } else {
                    console.warn(`[AI] ⚠️ Réponse trop courte de ${provider.name}: "${result}"`);
                }
            }
        } catch (e) {
            console.warn(`[AI] ❌ Échec ${provider.name}:`, e.message || e);
        }
    }

    console.error(`[AI] ❌ Tous les providers AI ont échoué à la tentative #${depth + 1}.`);

    // Exponential backoff before global retry
    if (depth < 2) {
        const delayMs = (depth + 1) * 2000;
        console.log(`[AI] Attente de ${delayMs}ms avant retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return await callAI(systemPrompt, userPrompt, depth + 1);
    }

    return null;
}

async function callPuterSDK(system, prompt) {
    const p = initPuter();
    if (!p || !p.ai) return null;

    // Priority: GPT-4o (User Directive) > Gemini 1.5 Flash > others
    const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash", "gemini-1.5-pro", "openai/gpt-4o", "gpt-4o-mini", "claude-3-haiku", "meta-llama/llama-3-70b-instruct"];
    for (const model of models) {
        try {
            console.log(`[AI] SDK Puter - Modèle: ${model}`);
            const resp = await p.ai.chat(prompt, {
                model: model,
                system: system,
                stream: false
            });
            const text = parsePuterResponse(resp);
            if (text && text.length > 10 && !text.includes("token_missing") && !text.includes("error")) return text;
        } catch (e) {
            console.warn(`[AI] Puter SDK model ${model} failed:`, e.message);
            continue;
        }
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
    const models = [
        "google/gemini-2.0-flash-exp:free",
        "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemma-2-9b-it:free",
        "mistralai/mistral-7b-instruct:free"
    ];

    for (const model of models) {
        try {
            console.log(`[AI] OpenRouter - Essai avec ${model}...`);
            const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: model,
                messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
            }, {
                headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
                timeout: 15000
            });
            const content = resp.data?.choices?.[0]?.message?.content;
            if (content && content.length > 10) return content;
        } catch (e) {
            console.warn(`[AI] OpenRouter model ${model} failed:`, e.message);
            continue;
        }
    }
    return null;
}

async function callBlackbox(system, prompt) {
    const models = ["deepseek-v3", "gpt-4o", "claude-3.5-sonnet"];
    for (const model of models) {
        try {
            console.log(`[AI] Blackbox - Essai avec ${model}...`);
            const resp = await axios.post("https://www.blackbox.ai/api/chat", {
                messages: [{ role: "user", content: `SYSTEM: ${system}\n\nUSER: ${prompt}` }],
                model: model,
                agentMode: {},
                trendingAgentMode: {},
                userSelectedModel: model
            }, { timeout: 15000 });

            let text = "";
            if (typeof resp.data === 'string') text = resp.data;
            else text = JSON.stringify(resp.data);

            if (text && text.length > 10) return text;
        } catch (e) {
            console.warn(`[AI] Blackbox model ${model} failed:`, e.message);
            continue;
        }
    }
    return null;
}

async function callPollinationsPOST(system, prompt) {
    const models = ['openai', 'mistral', 'llama', 'p1'];
    for (const model of models) {
        try {
            console.log(`[AI] Pollinations POST - Essai avec ${model}...`);
            const response = await axios.post('https://text.pollinations.ai/', {
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt }
                ],
                model: model,
                seed: Math.floor(Math.random() * 1000000),
                jsonMode: system.toLowerCase().includes('json')
            }, { timeout: 15000 });
            if (response.data && response.data.length > 5) return response.data;
        } catch (e) {
            console.warn(`[AI] Pollinations model ${model} failed:`, e.response?.data?.error || e.message);
            continue;
        }
    }
    return null;
}

async function callPollinationsGET(system, prompt) {
    const models = ['openai', 'mistral', 'llama'];
    for (const model of models) {
        try {
            const encodedSystem = encodeURIComponent(system);
            const encodedPrompt = encodeURIComponent(prompt);
            const url = `https://text.pollinations.ai/${encodedPrompt}?system=${encodedSystem}&model=${model}&seed=${Math.floor(Math.random() * 1000000)}`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000
            });
            if (response.data && response.data.length > 5) return response.data;
        } catch (e) {
            continue;
        }
    }
    return null;
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

module.exports = { callAI, cleanAIResponse };
