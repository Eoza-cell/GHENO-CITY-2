const { pipeline, env } = require('@xenova/transformers');
const path = require('path');

// Optimization for restricted environments (Render)
env.allowRemoteModels = true;
env.cacheDir = path.join(__dirname, '.cache/aether');

/**
 * AETHER ENGINE
 * Local, lightweight inference engine for GHENO-CITY.
 * Zero quota, zero cost, total autonomy.
 */
class AetherEngine {
    constructor() {
        this.modelName = 'Xenova/Qwen2-0.5B-Instruct';
        this.generator = null;
        this.isReady = false;
        this.isLoading = false;
    }

    async init() {
        if (this.isReady || this.isLoading) return;
        this.isLoading = true;
        console.log(`[AETHER] Awakening local soul (${this.modelName})...`);

        try {
            this.generator = await pipeline('text-generation', this.modelName, {
                quantized: true,
                progress_callback: (p) => {
                    if (p.status === 'done') console.log(`[AETHER] Core shard loaded: ${p.file}`);
                }
            });
            this.isReady = true;
            console.log(`[AETHER] Local core is now active and breathing.`);
        } catch (e) {
            console.error(`[AETHER] Failed to ignite local core:`, e.message);
        } finally {
            this.isLoading = false;
        }
    }

    async generate(messages, options = {}) {
        if (!this.isReady) await this.init();
        if (!this.generator) return null;

        // Construct ChatML prompt
        const prompt = messages.map(m => {
            return `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`;
        }).join('') + `<|im_start|>assistant\n`;

        try {
            const output = await this.generator(prompt, {
                max_new_tokens: options.maxTokens || 400,
                temperature: options.temperature || 0.7,
                do_sample: true,
                top_k: 50,
                repetition_penalty: 1.1
            });

            let text = output[0].generated_text;
            text = text.replace(prompt, '').trim();
            return text.split('<|im_end|>')[0].trim();
        } catch (e) {
            console.error(`[AETHER] Resonance error:`, e.message);
            return null;
        }
    }
}

const engine = new AetherEngine();
module.exports = engine;
