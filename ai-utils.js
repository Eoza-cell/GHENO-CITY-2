const axios = require('axios');
const puter = require('@heyputer/puter.js').default;

if (process.env.PUTER_API_KEY) {
    puter.setAuthToken(process.env.PUTER_API_KEY);
}

/**
 * Calls the best available AI provider.
 * Priority: Puter.js -> Pollinations.ai
 */
async function callAI(systemPrompt, userPrompt) {
    // 1. Try Puter.js
    if (process.env.PUTER_API_KEY) {
        try {
            console.log("[AI] Tentative avec Puter.js (Claude 3.5 Sonnet)...");
            const response = await puter.ai.chat(
                "claude-3-5-sonnet", // Upgraded for better reasoning
                {
                    system: systemPrompt,
                    prompt: userPrompt,
                    stream: false,
                }
            );
            return response.toString();
        } catch (error) {
            console.error("[AI] Erreur Puter.js:", error.message);
        }
    }

    // 2. Fallback to Pollinations.ai
    try {
        console.log("[AI] Tentative avec Pollinations.ai...");
        const response = await axios.post('https://text.pollinations.ai/', {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            model: 'openai',
            jsonMode: true
        }, { timeout: 20000 });

        return typeof response.data === 'object' ? JSON.stringify(response.data) : response.data.toString();
    } catch (error) {
        console.error("[AI] Erreur Pollinations.ai:", error.message);
        throw new Error("Tous les fournisseurs d'IA ont échoué.");
    }
}

module.exports = { callAI };
