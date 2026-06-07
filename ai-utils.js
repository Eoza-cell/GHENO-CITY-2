const axios = require('axios');
let puter = null;

function initPuter() {
    if (!puter) {
        try {
            puter = require('@heyputer/puter.js').default || require('@heyputer/puter.js');
            if (process.env.PUTER_API_KEY && process.env.PUTER_API_KEY !== 'test_key') {
                puter.setAuthToken(process.env.PUTER_API_KEY);
            }
        } catch (e) {
            console.error("[AI] Erreur chargement Puter.js:", e.message);
        }
    }
    return puter;
}

/**
 * Calls the best available AI provider with retries.
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 2) {
        throw new Error("Récursion AI trop profonde.");
    }

    // Sanitize prompts (truncate if too long for providers)
    const sanitizedSystem = systemPrompt.length > 4000 ? systemPrompt.substring(0, 4000) + "..." : systemPrompt;
    const sanitizedUser = userPrompt.length > 2000 ? userPrompt.substring(0, 2000) + "..." : userPrompt;

    const providers = [];

    // Priority: Puter -> OpenRouter -> Pollinations
    providers.push({ name: 'Puter', fn: callPuter });
    if (process.env.OPENROUTER_API_KEY) {
        providers.push({ name: 'OpenRouter', fn: callOpenRouter });
    }
    providers.push({ name: 'Pollinations', fn: callPollinations });

    for (const provider of providers) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`[AI] Tentative ${attempt} avec ${provider.name}...`);
                const result = await provider.fn(sanitizedSystem, sanitizedUser);
                if (result) {
                    console.log(`[AI] Succès avec ${provider.name}`);
                    return result;
                }
                console.warn(`[AI] ${provider.name} a retourné une réponse vide.`);
            } catch (error) {
                console.error(`[AI] Échec ${provider.name} (Tentative ${attempt}):`, error.message || error);
                if (error.message && error.message.includes('Maximum call stack size exceeded')) {
                    console.error("[CRITICAL] Puter SDK Stack Overflow detected. Skipping provider.");
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    console.warn("[AI] TOUS LES FOURNISSEURS ONT ÉCHOUÉ. Utilisation du secours d'urgence.");
    try {
        // Ultimate fallback: stripped-down Pollinations call
        const emergencyPrompt = "Tu es MJ. Le système a crashé. Dis au joueur de réessayer poliment en une phrase RP.";
        return await callPollinations("Tu es un MJ de RPG.", emergencyPrompt);
    } catch (e) {
        return JSON.stringify({
            narrative: "Le flux magique d'Aetherys semble perturbé... (Erreur Serveur AI)",
            actions: []
        });
    }
}

async function callOpenRouter(systemPrompt, userPrompt) {
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: "google/gemini-2.0-flash-exp:free", // Improved model for better RP and instructions following
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
    }, {
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://heyputer.com",
            "X-Title": "Arise RPG Bot"
        },
        timeout: 30000
    });

    return response.data?.choices?.[0]?.message?.content;
}

async function callPuter(systemPrompt, userPrompt) {
    const puterInstance = initPuter();
    if (!puterInstance) {
        console.warn("[AI] Puter non initialisé.");
        return null;
    }

    const models = ["gpt-4o", "openai/gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"];

    for (const model of models) {
        try {
            console.log(`[AI] Puter - Essai du modèle: ${model}`);

            // Puter.js chat can take a string as first arg, and options as second
            // OR just a prompt as first arg.
            const options = {
                model: model,
                system: systemPrompt,
                stream: false,
            };

            const puterPromise = puterInstance.ai.chat(userPrompt, options);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Puter.js Timeout (${model})`)), 20000)
            );

            const response = await Promise.race([puterPromise, timeoutPromise]);

            console.log(`[AI] Puter (${model}) Raw Response:`, JSON.stringify(response).substring(0, 200));

            if (!response || response.error || response.code === 'token_missing') {
                console.warn(`[AI] Puter (${model}) échec ou erreur d'auth.`);
                continue;
            }

            // Robust parsing of Puter.js response
            let text = "";
            if (typeof response === 'string') {
                text = response;
            } else if (response.message && response.message.content) {
                if (Array.isArray(response.message.content)) {
                    text = response.message.content.map(c => c.text || (typeof c === 'string' ? c : "")).join("");
                } else {
                    text = response.message.content;
                }
            } else if (response.text) {
                text = typeof response.text === 'function' ? await response.text() : response.text;
            } else {
                text = response.toString();
            }

            if (text && text !== "[object Object]" && text.length > 5) {
                return text;
            }
            console.warn(`[AI] Puter (${model}) a retourné une réponse invalide: ${text}`);
        } catch (e) {
            console.error(`[AI] Puter (${model}) erreur:`, e.message || e);
        }
    }

    return null;
}

async function callPollinations(systemPrompt, userPrompt) {
    const models = ['openai', 'mistral', 'llama', 'p1'];
    const combinedPrompt = `System: ${systemPrompt}\n\nUser: ${userPrompt}`;

    for (const model of models) {
        try {
            console.log(`[AI] Pollinations - Essai du modèle: ${model}`);
            const response = await axios.post('https://text.pollinations.ai/', {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: model,
                json: true
            }, { timeout: 15000 });

            let text = "";
            if (typeof response.data === 'string') {
                text = response.data;
            } else {
                text = response.data?.choices?.[0]?.message?.content || response.data?.content || JSON.stringify(response.data);
            }

            if (text && text.length > 5 && !text.includes("Error")) {
                return text;
            }
        } catch (e) {
            console.error(`[AI] Pollinations (${model}) échec:`, e.message);
        }
    }
    return null;
}


module.exports = { callAI };
