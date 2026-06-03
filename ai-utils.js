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

            // Use the standard message array format for Puter.js
            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ];

            const puterPromise = puterInstance.ai.chat(messages, {
                model: "gpt-4o",
                stream: false,
            });

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

    // 3. Fallback to Pollinations.ai (GET request is more reliable/stable for free tier)
    try {
        console.log("[AI] Tentative avec Pollinations.ai (GET)...");
        const combinedPrompt = `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}`;
        const encodedPrompt = encodeURIComponent(combinedPrompt);
        const response = await axios.get(`https://text.pollinations.ai/${encodedPrompt}?model=openai&cache=false`);

        let content = response.data.toString();

        // Robustness check for JSON within text
        if (content.includes('{') && content.includes('}')) {
            // Keep the text but ensure it's not JUST a failed object string
        }

        // Remove markdown block backticks if AI decided to wrap JSON or text in them
        content = content.replace(/```json/g, "").replace(/```/g, "").trim();

        return content;
    } catch (error) {
        console.error("[AI] Erreur Pollinations.ai:", error.message);
        throw new Error("Tous les fournisseurs d'IA ont échoué.");
    }
}

module.exports = { callAI };
