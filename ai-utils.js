const axios = require('axios');
const { getCurrentRPTime } = require('./world-clock');
const ollamaLib = require('ollama');

/**
 * AI Provider functions exported for diagnostics
 */

async function callPollinationsPOST(system, prompt) {
    const models = ['openai', 'mistral', 'llama', 'unity', 'p1', 'searchgpt'];
    for (let i = 0; i < 2; i++) { // Try twice with different models
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
            const content = data?.choices?.[0]?.message?.content || (typeof data === 'string' ? data : JSON.stringify(data));
            if (content && content.length > 10 && !content.includes('Queue full')) return content;
        } catch (e) {
            if (e.response?.status === 429) continue;
        }
    }
    return null;
}

async function callPollinationsGET(system, prompt) {
    try {
        // Pollinations GET has URL length limits. Truncate prompts if necessary.
        const maxLen = 1500;
        let combined = `System: ${system}\n\nUser: ${prompt}`;
        if (combined.length > maxLen) {
            combined = `System: ${system.substring(0, 500)}\n\nUser: ${prompt.substring(0, 1000)}`;
        }

        const url = `https://text.pollinations.ai/${encodeURIComponent(combined)}?model=openai&cache=true&seed=${Math.floor(Math.random() * 1000)}`;
        const response = await axios.get(url, { timeout: 30000 });
        if (response.data) {
            const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            if (text.length > 5 && !text.includes('Queue full') && !text.includes('error')) return text;
        }
    } catch (e) { return null; }
    return null;
}

async function callPollinationsEmergency(system, prompt) {
    try {
        // Very compact for high reliability
        const q = `MJ: ${prompt.substring(0, 100)}`;
        const url = `https://text.pollinations.ai/${encodeURIComponent(q)}?model=openai&system=${encodeURIComponent(system.substring(0, 200))}`;
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
    } catch (e) { return null; }
}

async function callBlackbox(system, prompt) {
    try {
        const resp = await axios.post("https://www.blackbox.ai/api/chat", {
            messages: [{ role: "user", content: `SYSTEM: ${system}\n\nUSER: ${prompt}` }],
            model: "deepseek-v3",
            max_tokens: 1024,
            clickedContinue: false,
            previewToken: null,
            codeModelMode: true,
            agentMode: {},
            trendingAgentMode: {},
            isMicMode: false,
            isChromeExt: false,
            githubToken: null
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://www.blackbox.ai',
                'Referer': 'https://www.blackbox.ai/'
            },
            timeout: 20000
        });
        let data = resp.data;
        if (typeof data !== 'string') data = JSON.stringify(data);

        // Blackbox sometimes returns SSE fragments in a single string
        if (data.includes('data:')) {
            const lines = data.split('\n');
            let fullText = "";
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.substring(6));
                        if (json.content) fullText += json.content;
                    } catch(e) {}
                }
            }
            if (fullText.length > 5) return fullText;
        }

        if (data.includes('errorText') || data.length < 5) return null;
        return data;
    } catch (e) { return null; }
}

async function callOpenRouterFree(system, prompt) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    const models = [
        "google/gemini-2.0-flash-exp:free",
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "google/gemini-2.0-pro-exp-02-05:free",
        "deepseek/deepseek-r1:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "mistralai/pixtral-12b:free",
        "google/gemini-flash-1.5-8b:free",
        "nvidia/llama-3.1-nemotron-70b-instruct:free"
    ];

    // Try up to 4 different models from the free list
    for (let i = 0; i < 4; i++) {
        const model = models[Math.floor(Math.random() * models.length)];
        try {
            const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: model,
                messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://github.com/Eoza-cell/GHENO-CITY-2',
                    'X-Title': 'Arise RPG Bot'
                },
                timeout: 30000
            });
            const content = resp.data?.choices?.[0]?.message?.content;
            if (content && content.length > 10) return content;
        } catch (e) {
            const errorMsg = e.response?.data?.error?.message || e.message;
            console.error(`[AI] OpenRouter (${model}) error:`, errorMsg);
            if (errorMsg.includes('credits') || errorMsg.includes('balance')) return null;
            continue;
        }
    }
    return null;
}

async function getEmbeddings(text) {
    if (!process.env.OLLAMA_URL) return null;
    try {
        let host = process.env.OLLAMA_URL.replace(/\s+/g, '').trim();
        if (host && !host.startsWith('http')) host = 'http://' + host;
        host = host.replace(/\/api\/(generate|chat)\/?$/, '').replace(/\/$/, '');

        const OllamaClient = ollamaLib.Ollama || (ollamaLib.default && ollamaLib.default.Ollama) || ollamaLib.default;
        const client = new OllamaClient({ host });

        const response = await client.embed({
            model: process.env.OLLAMA_EMBED_MODEL || 'qwen3-embedding',
            input: text,
        });
        return response.embeddings;
    } catch (e) {
        console.error("[AI] Ollama Embedding Error:", e.message);
        return null;
    }
}

async function callOllama(system, prompt) {
    if (!process.env.OLLAMA_URL) return null;
    try {
        // Sanitize URL: remove spaces and trailing API paths
        let host = process.env.OLLAMA_URL.replace(/\s+/g, '').trim();

        // Ensure protocol exists
        if (host && !host.startsWith('http')) {
            host = 'http://' + host;
        }

        host = host.replace(/\/api\/(generate|chat)\/?$/, '');
        host = host.replace(/\/$/, '');

        const OllamaClient = ollamaLib.Ollama || (ollamaLib.default && ollamaLib.default.Ollama) || ollamaLib.default;
        const client = new OllamaClient({ host });

        const response = await client.chat({
            model: process.env.OLLAMA_MODEL || 'Plexi09/SentientAI',
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: prompt }
            ],
            stream: false,
            format: 'json'
        });

        if (response && response.message) {
            return response.message.content;
        }
    } catch (e) {
        console.error("[AI] Ollama Error:", e.message);
        if (e.code === 'ECONNREFUSED') {
            console.error("[AI] Ollama n'est pas lancé ou inaccessible sur", process.env.OLLAMA_URL);
        } else if (e.message.includes('not found')) {
            console.error("[AI] Modèle Ollama non trouvé:", process.env.OLLAMA_MODEL || 'Plexi09/SentientAI');
        }
        return null;
    }
}

async function callPuterAPI(system, prompt) {
    try {
        const models = ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-flash", "gpt-4o-mini"];
        for (const model of models) {
            try {
                const config = {
                    headers: {
                        'Content-Type': 'application/json',
                        'Origin': 'https://puter.com',
                        'Referer': 'https://puter.com/',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 15000
                };

                if (process.env.PUTER_API_KEY) {
                    config.headers['Authorization'] = `Bearer ${process.env.PUTER_API_KEY}`;
                }

                const response = await axios.post('https://api.puter.com/v1/chat/completions', {
                    model: model,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: prompt }
                    ],
                    stream: false
                }, config);

                if (response.data?.choices?.[0]?.message?.content) {
                    return response.data.choices[0].message.content;
                }
            } catch (err) {
                // If 401/403 and no key, maybe keyless is dead for this model
                if (err.response?.status === 401 || err.response?.status === 403) {
                    if (!process.env.PUTER_API_KEY) continue;
                }
            }
        }
    } catch (e) {}
    return null;
}

let puterSDK = null;

function initPuterSDK() {
    if (puterSDK) return puterSDK;
    try {
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: "https://puter.com/",
            referrer: "https://puter.com/",
            contentType: "text/html",
        });

        global.window = dom.window;
        global.document = dom.window.document;
        global.navigator = dom.window.navigator;
        global.location = dom.window.location;
        global.localStorage = dom.window.localStorage;
        global.XMLHttpRequest = dom.window.XMLHttpRequest;
        if (!global.fetch) global.fetch = require('node-fetch');

        const puter = require('@heyputer/puter.js');
        puterSDK = puter.default || puter;
        return puterSDK;
    } catch (e) {
        console.error("[AI] Puter SDK Init Error:", e.message);
        return null;
    }
}

async function callPuterSDK(system, prompt) {
    try {
        const p = initPuterSDK();
        if (!p) return null;

        const combined = `System: ${system}\n\nUser: ${prompt}`;
        const models = ["gpt-4o-mini", "gemini-1.5-flash"];

        for (const model of models) {
            try {
                const response = await Promise.race([
                    p.ai.chat(combined, { model: model }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000))
                ]);

                if (response) {
                    const text = typeof response === 'string' ? response : (response.text || response.message?.content);
                    if (text && text.length > 10 && !text.includes('Unauthorized')) {
                        return text;
                    }
                }
            } catch (err) {
                if (err instanceof RangeError) {
                    console.error("[AI] Puter SDK Stack Overflow detected.");
                    return null;
                }
            }
        }
    } catch (e) {}
    return null;
}

async function callMJFallback(system, prompt) {
    console.warn("[AI] ⚠️ MJ Fallback activé.");
    let actionPart = "ton action";
    const actionMatch = prompt.match(/ACTION (?:DU JOUEUR)?: (.*)/i);
    if (actionMatch) actionPart = actionMatch[1].trim();

    let playerName = "Aventurier";
    const nameMatch = prompt.match(/- Nom: ([^\n\r]+)/);
    if (nameMatch) playerName = nameMatch[1].trim().replace(/\(DIEU SUPRÊME\)/g, '').trim();

    const templates = [
        `*Le monde semble vibrer sous l'impact de ta volonté.* \n\n${playerName}, tu exécutes ton geste avec détermination : "${actionPart}". \nL'Instructeur t'observe avec un regard impénétrable. "Pas mal," grogne-t-il, "mais la route est encore longue." Tu sens ton expérience s'affiner.`,
        `Une onde de choc parcourt la zone alors que tu tentes de "${actionPart}". \nLe destin sourit à ton audace, ${playerName}. Bien que l'avenir soit incertain, ton geste laisse une marque indélébile dans les couloirs d'Aetherys.`,
        `*DODODO!* \nL'Instructeur esquive ton geste à la dernière seconde. "C'était bien tenté, ${playerName}, mais ton intention de tuer doit être plus pure !" Ton action a été entendue par le monde lui-même.`,
        `*Sshhh...* \nLes flux de mana se tordent autour de toi alors que tu effectues : "${actionPart}". ${playerName}, tu sens une puissance ancienne guider ton mouvement. L'Instructeur plisse les yeux, impressionné par ta technique.`,
        `*BAM!* \nL'impact de ton action : "${actionPart}" résonne dans toute la zone. ${playerName}, tes stats de combat s'améliorent alors que tu repousses tes limites. "Continue comme ça," lance l'Instructeur d'un ton sec.`
    ];

    // Attempt to inject some dynamic metrics to satisfy the user's request for precision even in fallback
    const distance = Math.floor(Math.random() * 5) + 1;
    const bodyPart = ["bras", "torse", "jambe", "épaule", "tête"][Math.floor(Math.random() * 5)];
    const technique = ["Coup précis", "Frappe lourde", "Mouvement fluide", "Assaut vif"][Math.floor(Math.random() * 4)];

    const rpTime = getCurrentRPTime();

    const narrative = templates[Math.floor(Math.random() * templates.length)];
    const enrichedNarrative = `${rpTime.full}\n\n` + narrative + `\n\n*Précision Tactique:* Technique: ${technique} | Cible: ${bodyPart} | Distance: ${distance}m.`;

    return {
        narrative: enrichedNarrative + "\n\n*(Note: Les flux magiques sont instables, le MJ utilise son intuition pour maintenir la réalité)*",
        actions: [{"type": "update_player", "parameters": {"xp_gain": 5, "col_change": 2}}]
    };
}

/**
 * Robust Narrative & Action Extraction
 */
function cleanAIResponse(text) {
    if (!text || typeof text !== 'string') return "";

    let cleaned = text;

    // Handle SSE fragments specifically if they leaked into the string
    if (cleaned.includes('data:')) {
        const lines = cleaned.split('\n');
        let combinedText = "";
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const fragment = line.substring(6).trim();
                if (fragment === '[DONE]') continue;
                try {
                    const json = JSON.parse(fragment);
                    if (json.choices?.[0]?.delta?.content) combinedText += json.choices[0].delta.content;
                    else if (json.content) combinedText += json.content;
                    // Handle string arrays [\"Hello \", \"world\"]
                    else if (Array.isArray(json)) combinedText += json.join('');
                } catch (e) {
                    // Not valid JSON, might be raw fragment
                    if (!fragment.startsWith('{') && !fragment.startsWith('[')) combinedText += fragment;
                }
            } else if (line.trim().length > 0 && !line.includes('data:')) {
                combinedText += line + "\n";
            }
        }
        if (combinedText.length > 5) cleaned = combinedText;
    }

    return cleaned
        .replace(/^```(json|JSON)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .replace(/data:\s*\[DONE\]/gi, "")
        .replace(/data:\s*\{.*?\}/gi, "")
        .replace(/data:\s*/gi, "")
        .trim();
}

function extractNarrative(content) {
    let aiResponse = { narrative: "", actions: [], tutorial_complete: false };
    if (!content) return aiResponse;

    // Helper to normalize actions to always be an array
    const normalizeActions = (obj) => {
        let acts = obj.actions || [];
        if (!Array.isArray(acts)) acts = [acts];
        return acts;
    };

    // Handle case where content is already an object
    if (typeof content === 'object' && !Array.isArray(content)) {
        const narrative = content.narrative || content.message || content.text || content.content || content.response || "";
        const actions = normalizeActions(content);
        aiResponse = { ...aiResponse, ...content, narrative, actions };
        return aiResponse;
    }

    const cleaned = cleanAIResponse(content);

    // Try to parse the entire response as a single JSON
    try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
            const narrative = parsed.narrative || parsed.message || parsed.text || parsed.content || parsed.response || "";
            const actions = normalizeActions(parsed);
            aiResponse = { ...aiResponse, ...parsed, narrative, actions };
            // If we have a narrative, we are good.
            if (aiResponse.narrative) return aiResponse;
        }
    } catch (e) {
        // Not a single JSON
    }

    const jsonObjects = [];
    let braceCount = 0, startIndex = -1;
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') {
            if (braceCount === 0) startIndex = i;
            braceCount++;
        } else if (cleaned[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startIndex !== -1) {
                jsonObjects.push(cleaned.substring(startIndex, i + 1));
                startIndex = -1;
            }
        }
    }

    let textSegments = [];
    let currentPos = 0;

    if (jsonObjects.length > 0) {
        for (const potentialJson of jsonObjects) {
            const jsonIndex = cleaned.indexOf(potentialJson, currentPos);
            if (jsonIndex > currentPos) {
                textSegments.push(cleaned.substring(currentPos, jsonIndex));
            }
            currentPos = jsonIndex + potentialJson.length;

            try {
                const parsed = JSON.parse(potentialJson);

                // Merge narrative part
                const narrativePart = parsed.narrative || parsed.message || parsed.text || parsed.content || parsed.response;
                if (narrativePart) textSegments.push(narrativePart);

                // Merge actions part robustly
                if (parsed.actions) {
                    const acts = normalizeActions(parsed);
                    aiResponse.actions = [...aiResponse.actions, ...acts];
                }

                // Merge other fields (like imagePrompt, tutorial_complete, etc.)
                for (const key in parsed) {
                    if (!['narrative', 'message', 'text', 'content', 'response', 'actions'].includes(key)) {
                        aiResponse[key] = parsed[key];
                    }
                }
            } catch (e) {
                textSegments.push(potentialJson);
            }
        }
        // Remaining text after last JSON
        if (currentPos < cleaned.length) {
            textSegments.push(cleaned.substring(currentPos));
        }
    } else {
        // No JSON found
        aiResponse.narrative = cleaned;
        return aiResponse;
    }

    // Merge all narrative segments
    aiResponse.narrative = textSegments
        .map(s => {
            if (typeof s === 'string') return s.trim();
            try { return JSON.stringify(s); } catch(e) { return String(s); }
        })
        .filter(s => s.length > 0)
        .join("\n\n");

    // Final fallback
    if (!aiResponse.narrative || aiResponse.narrative.length < 2) {
        aiResponse.narrative = cleaned;
    }

    // Ensure parameters key exists in actions if missing
    if (aiResponse.actions) {
        aiResponse.actions = aiResponse.actions.map(act => {
            if (act.type && !act.parameters) act.parameters = {};
            return act;
        });
    }

    return aiResponse;
}

/**
 * Main AI Loop
 */
async function callAI(systemPrompt, userPrompt, depth = 0, onProviderSuccess = null) {
    if (depth > 2) return null;

    // Priority List: Fast/Configured -> Slow/Fallback
    const providers = [];

    if (process.env.OLLAMA_URL) providers.push({ name: 'Ollama', fn: callOllama });
    if (process.env.PUTER_API_KEY) providers.push({ name: 'Puter API', fn: callPuterAPI });
    if (process.env.OPENROUTER_API_KEY) providers.push({ name: 'OpenRouter Free', fn: callOpenRouterFree });

    // Public/Free Fallbacks
    providers.push(
        { name: 'Blackbox AI', fn: callBlackbox },
        { name: 'Pollinations POST', fn: callPollinationsPOST },
        { name: 'Puter API (Keyless)', fn: callPuterAPI },
        { name: 'Puter SDK', fn: callPuterSDK },
        { name: 'Pollinations GET', fn: callPollinationsGET },
        { name: 'Pollinations Emergency', fn: callPollinationsEmergency }
    );

    const skipKeywords = ['Unauthorized', '401', '429', 'Rate limit', 'Internal Server Error', 'Queue full', 'Too Many Requests'];

    for (const p of providers) {
        try {
            console.log(`[AI] Tentative: ${p.name}... (depth: ${depth})`);
            const res = await p.fn(systemPrompt, userPrompt);
            if (res) {
                const resStr = typeof res === 'string' ? res : JSON.stringify(res);
                if (resStr.length < 500 && skipKeywords.some(k => resStr.includes(k))) {
                    console.warn(`[AI] ${p.name} a renvoyé une erreur technique: ${resStr.substring(0, 50)}`);
                    continue;
                }
                if (onProviderSuccess) onProviderSuccess(p.name);
                return res;
            } else {
                console.warn(`[AI] ${p.name} n'a rien renvoyé.`);
            }
        } catch (e) {
            console.error(`[AI] ${p.name} a échoué:`, e.message);
        }
    }

    // If everything failed, retry the whole loop once after a delay
    if (depth === 0) {
        console.warn("[AI] 🔄 Tous les providers ont échoué. Tentative de retry global dans 2s...");
        await new Promise(r => setTimeout(r, 2000));
        return await callAI(systemPrompt, userPrompt, depth + 1, onProviderSuccess);
    }

    if (onProviderSuccess) onProviderSuccess("MJ Fallback");
    return await callMJFallback(systemPrompt, userPrompt);
}

module.exports = {
    callAI, cleanAIResponse, extractNarrative, getEmbeddings,
    callPollinationsPOST, callPollinationsGET, callBlackbox, callOpenRouterFree, callOllama, callPuterSDK, callMJFallback
};
