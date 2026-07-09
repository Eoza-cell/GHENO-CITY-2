const { pipeline, env } = require('@xenova/transformers');
const path = require('path');

// Configure transformers for local-only or cache-first usage
env.allowRemoteModels = true;
env.cacheDir = path.join(__dirname, '.cache/hparams');

/**
 * ATR HEART ENGINE
 * The local core of the AI, using ONNX Runtime via Transformers.js
 */
class ATRHeartEngine {
    constructor() {
        this.modelName = 'Xenova/Qwen1.5-0.5B-Chat';
        this.generator = null;
        this.tokenizer = null;
        this.isReady = false;
        this.loading = false;
    }

    async init() {
        if (this.isReady || this.loading) return;
        this.loading = true;
        console.log(`[ATR-HEART] Initializing local heart with ${this.modelName}...`);

        try {
            // Text generation pipeline
            this.generator = await pipeline('text-generation', this.modelName);
            this.isReady = true;
            console.log(`[ATR-HEART] Local core is beating.`);
        } catch (e) {
            console.error(`[ATR-HEART] Cardiac arrest during init:`, e.message);
        } finally {
            this.loading = false;
        }
    }

    /**
     * Generate a response using the local ONNX model
     */
    async generate(messages, options = {}) {
        if (!this.isReady) {
            await this.init();
        }

        if (!this.generator) return null;

        // Construct a prompt from messages if not already handled by pipeline
        const prompt = messages.map(m => {
            if (m.role === 'system') return `<|im_start|>system\n${m.content}<|im_end|>\n`;
            if (m.role === 'user') return `<|im_start|>user\n${m.content}<|im_end|>\n`;
            return `<|im_start|>assistant\n${m.content}<|im_end|>\n`;
        }).join('') + `<|im_start|>assistant\n`;

        try {
            const output = await this.generator(prompt, {
                max_new_tokens: options.maxTokens || 256,
                temperature: options.temperature || 0.7,
                do_sample: true,
                top_k: 50,
            });

            let text = output[0].generated_text;
            // Strip the prompt from output
            text = text.replace(prompt, '').trim();
            // Remove ending markers
            text = text.split('<|im_end|>')[0].trim();

            return text;
        } catch (e) {
            console.error(`[ATR-HEART] Generation error:`, e.message);
            return null;
        }
    }
}

const engine = new ATRHeartEngine();
module.exports = engine;
