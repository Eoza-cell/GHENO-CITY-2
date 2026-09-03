// ATR — Native Hugging Face Transformers.js RP engine.
// One model stays loaded in memory instead of being downloaded/recreated every turn.

let generatorPromise = null;

function extractGeneratedText(output) {
    if (!output) return null;
    const first = Array.isArray(output) ? output[0] : output;
    const value = first?.generated_text ?? first?.text ?? first;
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
        const last = value[value.length - 1];
        if (typeof last?.content === 'string') return last.content.trim();
        if (typeof last === 'string') return last.trim();
    }
    return null;
}

async function getGenerator() {
    if (!generatorPromise) {
        generatorPromise = (async () => {
            const { pipeline, env } = await import('@huggingface/transformers');

            // Keep model/cache on persistent disk when the host provides it.
            env.allowLocalModels = false;

            const model = process.env.TRANSFORMERS_RP_MODEL ||
                'onnx-community/Qwen2.5-1.5B-Instruct';
            const dtype = process.env.TRANSFORMERS_DTYPE || 'q4';

            console.log('[Transformers.js] Loading ATR RP model:', model, 'dtype:', dtype);

            return pipeline('text-generation', model, {
                dtype,
                progress_callback: data => {
                    if (data?.status === 'progress' && data?.progress === 100) {
                        console.log('[Transformers.js] Model component ready:', data.file || '');
                    }
                }
            });
        })();
    }
    return generatorPromise;
}

/**
 * Native @huggingface/transformers Game Master.
 * The complete system + current action are sent as chat messages so the model
 * understands that it is a narrator, not a player being asked what to do.
 */
async function callTransformersJS(system, prompt, options = {}) {
    try {
        const generator = await getGenerator();

        const messages = [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
        ];

        const output = await generator(messages, {
            max_new_tokens: Number(process.env.TRANSFORMERS_MAX_NEW_TOKENS || 420),
            temperature: Number(process.env.TRANSFORMERS_TEMPERATURE || 0.78),
            top_p: Number(process.env.TRANSFORMERS_TOP_P || 0.92),
            repetition_penalty: Number(process.env.TRANSFORMERS_REPETITION_PENALTY || 1.08),
            do_sample: true
        });

        const text = extractGeneratedText(output);
        if (!text || text.length < 8) return null;

        // Remove accidental prompt echoes while preserving the actual narration.
        return text
            .replace(/^assistants*[:：]s*/i, '')
            .replace(/[TRUNCATED]/gi, '')
            .trim();
    } catch (error) {
        console.warn('[Transformers.js] RP engine unavailable:', error.message);
        // Allow a future retry if model loading itself failed.
        generatorPromise = null;
        return null;
    }
}

module.exports = { callTransformersJS };
