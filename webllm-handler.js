/**
 * WebLLM Integration Module (https://github.com/mlc-ai/web-llm)
 * Provides high-performance in-engine LLM inference powered by WebLLM / MLC-AI.
 */

const webLLM = require('@mlc-ai/web-llm');

let engineInstance = null;

async function callWebLLM(system, prompt, options = {}) {
    try {
        const selectedModel = options.model || "Llama-3.2-1B-Instruct-q4f32_1-MLC";
        console.log(`[WebLLM Engine] Executing WebLLM inference using model: ${selectedModel}...`);

        if (!engineInstance) {
            engineInstance = await webLLM.CreateMLCEngine(selectedModel, {
                initProgressCallback: (progress) => {
                    console.log(`[WebLLM Progress] ${progress.text}`);
                }
            });
        }

        const messages = [
            { role: "system", content: system },
            { role: "user", content: prompt }
        ];

        const reply = await engineInstance.chat.completions.create({
            messages,
            temperature: 0.7,
            max_tokens: 350
        });

        const content = reply?.choices?.[0]?.message?.content;
        if (content && content.length > 5) {
            return content.trim();
        }
    } catch (e) {
        console.warn(`[WebLLM Engine Warning] ${e.message}`);
    }
    return null;
}

module.exports = { callWebLLM };
