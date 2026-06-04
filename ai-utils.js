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
 * Priority: Puter API -> Puter.js -> QVAC -> OpenRouter -> Pollinations.ai
 */
async function callAI(systemPrompt, userPrompt, depth = 0) {
    if (depth > 3) {
        throw new Error("Récursion AI trop profonde détectée.");
    }

    // 1. Try Puter OpenAI-Compatible API (via axios)
    if (process.env.PUTER_API_KEY) {
        try {
            console.log("[AI] Tentative avec Puter API (GPT-4o)...");
            const response = await axios.post("https://api.puter.com/v1/chat/completions", {
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                stream: false
            }, {
                headers: {
                    "Authorization": `Bearer ${process.env.PUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 30000
            });

            if (response.data && response.data.choices && response.data.choices[0]) {
                return response.data.choices[0].message.content;
            }
        } catch (error) {
            console.error("[AI] Erreur Puter API (Axios):", error.response?.data || error.message);
        }
    }

    // 2. Try Puter.js SDK
    const puterInstance = initPuter();
    if (puterInstance) {
        try {
            console.log("[AI] Tentative avec Puter.js SDK (GPT-4o)...");

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Puter.js Timeout (30s)")), 30000)
            );

            let response;
            try {
                response = await Promise.race([
                    puterInstance.ai.chat(`System: ${systemPrompt}\n\nUser: ${userPrompt}`, { model: "gpt-4o", stream: false }),
                    timeoutPromise
                ]);
            } catch (err) {
                console.log("[AI] Échec GPT-4o SDK, tentative avec GPT-4o-mini...");
                response = await Promise.race([
                    puterInstance.ai.chat(`System: ${systemPrompt}\n\nUser: ${userPrompt}`, { model: "gpt-4o-mini", stream: false }),
                    timeoutPromise
                ]);
            }

            if (response?.error || response?.code === 'token_missing') {
                throw new Error(response.message || "Puter Token Error");
            }
            if (typeof response === 'string') return response;
            if (response?.message?.content?.[0]?.text) return response.message.content[0].text;
            if (response?.message?.content) return response.message.content;
            if (response?.text) return response.text;

            return response.toString();
        } catch (error) {
            console.error("[AI] Erreur Puter.js SDK:", error.message);
        }
    }

    // 2. Try QVAC (Local/P2P Inference) - Only if Node version allows (requires WebGPU or similar often)
    // We wrap this carefully as it can be heavy.
    if (process.env.ENABLE_QVAC === 'true') {
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

    // 3. Fallback to Pollinations.ai (POST is more reliable for long prompts)
    const models = ["gpt-4o", "mistral", "llama"];
    for (const model of models) {
        try {
            console.log(`[AI] Tentative avec Pollinations.ai (${model})...`);
            const response = await axios.post("https://text.pollinations.ai/", {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                model: model,
                json: false
            }, { timeout: 30000 });

            let content = response.data.toString();
            content = content.replace(/```json/g, "").replace(/```/g, "").trim();
            if (content) return content;
        } catch (error) {
            console.error(`[AI] Erreur Pollinations.ai (${model}):`, error.message);
        }
    }

    throw new Error("Tous les fournisseurs d'IA ont échoué.");
}

module.exports = { callAI };
