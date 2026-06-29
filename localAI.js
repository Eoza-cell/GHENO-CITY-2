const OpenAI = require("openai");
const axios = require('axios');
require('dotenv').config();

const LOCAL_API = process.env.LOCAL_API || "http://127.0.0.1:11434";
const MODEL = process.env.MODEL || "gemma3:4b";

const client = new OpenAI({
  baseURL: LOCAL_API + "/v1",
  apiKey: "ollama", // Ollama doesn't require a real key for local use
});

/**
 * GHENO CITY - Local AI Service
 * This service communicates directly with the local Ollama/vLLM instance.
 */

async function checkLocalAIStatus() {
    try {
        const response = await axios.get(`${LOCAL_API}/api/tags`);
        const data = response.data;
        const hasModel = data.models?.some(m => m.name.includes(MODEL.split(':')[0]));

        if (!hasModel) {
            console.warn(`[LOCAL-AI] ⚠️ Modèle ${MODEL} non trouvé dans Ollama.`);
            console.warn(`[LOCAL-AI]    Exécutez: ollama pull ${MODEL}`);
            return "model_missing";
        }
        return "ready";
    } catch (err) {
        console.error(`[LOCAL-AI] ❌ Ollama non accessible sur ${LOCAL_API}`);
        return "offline";
    }
}

async function askLocalAI(systemPrompt, userPrompt) {
    const status = await checkLocalAIStatus();
    if (status === "offline") {
        throw new Error(`Ollama n'est pas lancé. Lancez-le avec "ollama serve"`);
    }
    if (status === "model_missing") {
        throw new Error(`Le modèle ${MODEL} n'est pas installé dans Ollama. Exécutez: ollama pull ${MODEL}`);
    }

    try {
        const res = await client.chat.completions.create({
            model: MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        return res.choices[0].message.content;
    } catch (err) {
        console.error("[LOCAL-AI] Erreur lors de l'appel local:", err.message);
        throw err;
    }
}

module.exports = { askLocalAI, checkLocalAIStatus };
