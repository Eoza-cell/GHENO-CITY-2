const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { execSync } = require('child_process');

/**
 * Downloads a local GGUF model for llama.cpp if not present.
 */
async function downloadModel() {
    const modelDir = path.join(__dirname, 'models');
    if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir);

    const modelPath = path.join(modelDir, 'gemma-2-2b-it.Q4_K_M.gguf');
    const modelUrl = "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it.Q4_K_M.gguf";

    if (fs.existsSync(modelPath)) {
        console.log("[Llama] Model already exists.");
        return modelPath;
    }

    console.log("[Llama] Downloading Gemma 2b GGUF (this may take a while)...");
    try {
        execSync(`wget -O ${modelPath} ${modelUrl}`, { stdio: 'inherit' });
        return modelPath;
    } catch (e) {
        console.error("[Llama] Download failed:", e.message);
        return null;
    }
}

let llamaContext = null;
let chatSession = null;

async function initLlama() {
    try {
        const { LlamaModel, LlamaContext, LlamaChatSession } = await import("node-llama-cpp");
        const modelPath = await downloadModel();

        if (!modelPath) throw new Error("No model found.");

        const model = new LlamaModel({ modelPath });
        llamaContext = new LlamaContext({ model });
        chatSession = new LlamaChatSession({ context: llamaContext });
        console.log("[Llama] Engine Initialized.");
    } catch (e) {
        console.error("[Llama] Init failed:", e.message);
    }
}

async function callLlama(system, prompt) {
    if (!chatSession) await initLlama();
    if (!chatSession) return null;

    try {
        const fullPrompt = `System: ${system}\n\nUser: ${prompt}`;
        const response = await chatSession.prompt(fullPrompt);
        return response;
    } catch (e) {
        console.error("[Llama] Prompt error:", e.message);
        return null;
    }
}

module.exports = { callLlama };
