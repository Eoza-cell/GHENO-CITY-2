const axios = require('axios');
const qvac = require("@qvac/sdk");
let puter = null;
let qvacModelId = null;

function initPuter() {
    if (!puter && process.env.PUTER_API_KEY && process.env.PUTER_API_KEY !== 'test_key') {
        try {
            const puterJS = require('@heyputer/puter.js');
            puter = puterJS.default || puterJS.puter || puterJS;
            puter.setAuthToken(process.env.PUTER_API_KEY);
        } catch (e) {
            console.error("[AI] Erreur chargement Puter.js:", e.message);
        }
    }
    return puter;
}

/**
 * Calls the best available AI provider.
 * Priority: Puter.js -> QVAC -> OpenRouter -> Pollinations.ai
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 3) {
        throw new Error("Récursion AI trop profonde détectée.");
    }

    // 1. Try Puter.js (Wrapped in a try-catch to prevent stack overflow crashes)
    const puterInstance = initPuter();
    if (puterInstance) {
        try {
            console.log("[AI] Tentative avec Puter.js (GPT-4o)...");

            // Promise wrapper with timeout for Puter.js
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Puter.js Timeout (30s)")), 30000)
            );

            let response;
            try {
                console.log("[AI] Tentative avec Puter.js (GPT-4o)...");
                response = await Promise.race([
                    puterInstance.ai.chat(`System: ${systemPrompt}\n\nUser: ${userPrompt}`, { model: "gpt-4o", stream: false }),
                    timeoutPromise
                ]);
            } catch (err) {
                console.log("[AI] Échec GPT-4o, tentative avec GPT-4o-mini...");
                response = await Promise.race([
                    puterInstance.ai.chat(`System: ${systemPrompt}\n\nUser: ${userPrompt}`, { model: "gpt-4o-mini", stream: false }),
                    timeoutPromise
                ]);
            }

            // Robust extraction of the content
            if (response?.error || response?.code === 'token_missing') {
                throw new Error(response.message || "Puter Token Error");
            }
            if (typeof response === 'string') return response;
            if (response?.message?.content?.[0]?.text) return response.message.content[0].text;
            if (response?.message?.content) return response.message.content;
            if (response?.text) return response.text;

            return response.toString();
        } catch (error) {
            console.error("[AI] Erreur Puter.js:", error.message);
            // If Puter.js crashes with a RangeError (Stack overflow), we MUST continue to fallbacks
        }
    }

    // 2. Try QVAC (Local/P2P Inference)
    try {
        if (!qvacModelId) {
            console.log("[AI] Chargement du modèle QVAC (Llama 3.2 1B)...");
            qvacModelId = await qvac.loadModel({
                modelSrc: qvac.LLAMA_3_2_1B_INST_Q4_0,
                modelType: "llm"
            });
        }

        console.log("[AI] Tentative avec QVAC...");
        const history = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];

        let fullText = "";
        const stream = qvac.completion({ modelId: qvacModelId, history, stream: true });
        for await (const token of stream.tokenStream) {
            fullText += token;
        }

        if (fullText.trim()) return fullText.trim();
    } catch (error) {
        console.error("[AI] Erreur QVAC:", error.message);
    }

    // 3. Try OpenRouter (Free model requested)
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

    // 3. Fallback to Pollinations.ai (Mistral)
    try {
        console.log("[AI] Tentative avec Pollinations.ai (Mistral)...");
        const combinedPrompt = `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}`;
        const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(combinedPrompt)}?model=mistral&cache=false`, { timeout: 30000 });

        let content = response.data.toString();
        content = content.replace(/```json/g, "").replace(/```/g, "").trim();
        return content;
    } catch (error) {
        console.error("[AI] Erreur Pollinations.ai (Mistral):", error.message);
    }

    // 4. Ultimate Fallback to Pollinations.ai (Llama)
    try {
        console.log("[AI] Tentative avec Pollinations.ai (Llama)...");
        const combinedPrompt = `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}`;
        const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(combinedPrompt)}?model=llama&cache=false`, { timeout: 30000 });

        let content = response.data.toString();
        content = content.replace(/```json/g, "").replace(/```/g, "").trim();
        return content;
    } catch (error) {
        console.error("[AI] Erreur Pollinations.ai (Llama):", error.message);
        throw new Error("Tous les fournisseurs d'IA ont échoué.");
    }
}

module.exports = { callAI };
