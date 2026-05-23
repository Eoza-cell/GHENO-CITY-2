const axios = require('axios');
let puter = null;

function initPuter() {
    if (!puter && process.env.PUTER_API_KEY && process.env.PUTER_API_KEY !== 'test_key') {
        try {
            puter = require('@heyputer/puter.js').default;
            puter.setAuthToken(process.env.PUTER_API_KEY);
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

    const providers = [];

    // Priority: OpenRouter (if key exists) -> Puter -> Pollinations
    if (process.env.OPENROUTER_API_KEY) {
        providers.push({ name: 'OpenRouter', fn: callOpenRouter });
    }
    providers.push({ name: 'Puter', fn: callPuter });
    providers.push({ name: 'Pollinations', fn: callPollinations });

    for (const provider of providers) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`[AI] Tentative ${attempt} avec ${provider.name}...`);
                const result = await provider.fn(systemPrompt, userPrompt);
                if (result) return result;
            } catch (error) {
                console.error(`[AI] Échec ${provider.name} (Tentative ${attempt}):`, error.message);
                if (error.message.includes('Maximum call stack size exceeded')) {
                    console.error("[CRITICAL] Puter SDK Stack Overflow detected. Skipping provider.");
                    break; // Skip to next provider immediately on stack overflow
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

    console.warn("[AI] TOUS LES FOURNISSEURS ONT ÉCHOUÉ. Utilisation du secours statique.");
    return JSON.stringify({
        narrative: "Le flux magique d'Aetherys semble perturbé... (Erreur Serveur AI)",
        actions: []
    });
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
    if (!puterInstance) return null;

    const puterPromise = puterInstance.ai.chat(
        "claude-3-5-sonnet",
        {
            system: systemPrompt,
            prompt: userPrompt,
            stream: false,
        }
    );

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Puter.js Timeout")), 25000)
    );

    const response = await Promise.race([puterPromise, timeoutPromise]);
    return response.toString();
}

async function callPollinations(systemPrompt, userPrompt) {
    const combinedPrompt = `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}`;
    const response = await axios.post('https://text.pollinations.ai/', {
        messages: [{ role: 'user', content: combinedPrompt }],
        model: 'openai',
        json: true
    }, { timeout: 30000 });

    if (typeof response.data === 'string') return response.data;
    return response.data?.choices?.[0]?.message?.content || JSON.stringify(response.data);
}


module.exports = { callAI };
