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
 * Calls the best available AI provider.
 * Priority: Puter.js -> OpenRouter -> Pollinations.ai
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 3) {
        throw new Error("Récursion AI trop profonde détectée.");
    }

    // 1. Try Puter.js (Wrapped in a try-catch to prevent stack overflow crashes)
    const puterInstance = initPuter();
    if (puterInstance) {
        try {
            console.log("[AI] Tentative avec Puter.js (Claude 3.5 Sonnet)...");

            // Promise wrapper with timeout for Puter.js
            const puterPromise = puterInstance.ai.chat(
                "claude-3-5-sonnet",
                {
                    system: systemPrompt,
                    prompt: userPrompt,
                    stream: false,
                }
            );

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Puter.js Timeout (30s)")), 30000)
            );

            const response = await Promise.race([puterPromise, timeoutPromise]);
            return response.toString();
        } catch (error) {
            console.error("[AI] Erreur Puter.js:", error.message);
            // If Puter.js crashes with a RangeError (Stack overflow), we MUST continue to fallbacks
        }
    }

    // 2. Try OpenRouter (Free model requested)
    if (process.env.OPENROUTER_API_KEY) {
        try {
            console.log("[AI] Tentative avec OpenRouter (GPT-OSS 20B)...");
            const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
                model: "openai/gpt-oss-20b:free",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                route: "fallback"
            }, {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 30000
            });

            if (response.data && response.data.choices && response.data.choices[0]) {
                return response.data.choices[0].message.content;
            }
        } catch (error) {
            console.error("[AI] Erreur OpenRouter:", error.response?.data || error.message);
        }
    }

    // 3. Fallback to Pollinations.ai (Using a more robust method)
    try {
        console.log("[AI] Tentative avec Pollinations.ai (Flux-compatible text)...");
        const combinedPrompt = `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}`;
        const response = await axios.post('https://text.pollinations.ai/', {
            messages: [
                { role: 'user', content: combinedPrompt }
            ],
            model: 'openai', // Force a more stable model
            json: true
        }, { timeout: 40000 });

        let content = "";
        if (typeof response.data === 'string') {
            content = response.data;
        } else if (response.data && response.data.choices && response.data.choices[0]) {
            content = response.data.choices[0].message.content;
        } else {
            content = JSON.stringify(response.data);
        }

        return content;
    } catch (error) {
        console.error("[AI] Erreur Pollinations.ai:", error.response?.data || error.message);

        // 4. Ultimate Fallback: Return a static narrative if AI is totally down
        console.warn("[AI] TOUS LES FOURNISSEURS ONT ÉCHOUÉ. Utilisation du secours statique.");
        return JSON.stringify({
            narrative: "Le flux magique d'Aetherys semble perturbé par une force mystérieuse... L'action n'a pas pu se matérialiser correctement, mais ton esprit reste focalisé sur ton objectif. (Erreur Serveur AI)",
            actions: []
        });
    }
}

module.exports = { callAI };
