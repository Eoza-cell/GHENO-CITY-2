const axios = require('axios');
const puter = require('@heyputer/puter.js').default;

if (process.env.PUTER_API_KEY) {
    puter.setAuthToken(process.env.PUTER_API_KEY);
}

/**
 * Calls the best available AI provider.
 * Priority: Puter.js -> OpenRouter -> Pollinations.ai
 */
async function callAI(systemPrompt, userPrompt) {
    // 1. Try Puter.js
    if (process.env.PUTER_API_KEY && process.env.PUTER_API_KEY !== 'test_key') {
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

    // 3. Fallback to Pollinations.ai
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

        const content = typeof response.data === 'object' ? JSON.stringify(response.data) : response.data.toString();

        // Final robustness check: strip any leading/trailing non-json chars if possible
        if (content.includes('{') && content.includes('}')) {
            return content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
        }
        return content;
    } catch (error) {
        console.error("[AI] Erreur Pollinations.ai:", error.message);
        throw new Error("Tous les fournisseurs d'IA ont échoué.");
    }
}

module.exports = { callAI };
