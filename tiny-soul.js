const { pipeline, env } = require('@xenova/transformers');
const path = require('path');
const { Kingdom, NPC, WorldJournal } = require('./database');

env.allowRemoteModels = true;
env.cacheDir = path.join(__dirname, '.cache/tiny-soul');

/**
 * TINY SOUL - 0.1B PARAMETER CORE
 * Custom coded local IA using SmolLM2-135M.
 * Ultra-fast, low RAM, unlimited.
 */
class TinySoul {
    constructor() {
        this.modelId = 'Xenova/SmolLM2-135M-Instruct';
        this.pipe = null;
        this.isReady = false;
        this.isLoading = false;
    }

    async ignite() {
        if (this.isReady || this.isLoading) return;
        this.isLoading = true;
        console.log(`[TINY-SOUL] Igniting core: ${this.modelId}...`);
        try {
            this.pipe = await pipeline('text-generation', this.modelId);
            this.isReady = true;
            console.log(`[TINY-SOUL] Core ignited and stable.`);
        } catch (e) {
            console.error(`[TINY-SOUL] Ignition failure:`, e.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Specialized function: Get current world context from DB
     */
    async fetchWorldVitals() {
        try {
            const [k, n, j] = await Promise.all([
                Kingdom.count(),
                NPC.count(),
                WorldJournal.findOne({ order: [['id', 'DESC']] })
            ]);
            return `MÉMOIRE: ${k} royaumes, ${n} légendes. Dernier fait: ${j ? j.entry.substring(0, 40) : 'Néant'}.`;
        } catch (e) { return ""; }
    }

    async think(system, user, options = {}) {
        if (!this.isReady) await this.ignite();
        if (!this.pipe) return null;

        const vitals = await this.fetchWorldVitals();
        const fullSystem = `${system}\n[VITALS: ${vitals}]`;

        const prompt = `<|im_start|>system\n${fullSystem}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n`;

        try {
            const output = await this.pipe(prompt, {
                max_new_tokens: options.maxTokens || 256,
                temperature: 0.6,
                do_sample: true,
                top_k: 40,
            });

            let text = output[0].generated_text;
            text = text.replace(prompt, '').trim();
            return text.split('<|im_end|>')[0].trim();
        } catch (e) {
            console.error(`[TINY-SOUL] Mental block:`, e.message);
            return null;
        }
    }
}

const soul = new TinySoul();
module.exports = soul;
