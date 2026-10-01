// ATR — Native Hugging Face Transformers.js RP engine.

let generatorPromise = null;

function extractGeneratedText(output) {
    if (!output) return null;
    const first = Array.isArray(output) ? output[0] : output;
    const value = first?.generated_text ?? first?.text ?? first;
    if (typeof value === 'string') return value.trim();

    if (Array.isArray(value)) {
        const assistant = [...value].reverse().find(m => m?.role === 'assistant' && typeof m?.content === 'string');
        if (assistant) return assistant.content.trim();
        const last = value[value.length - 1];
        if (typeof last?.content === 'string') return last.content.trim();
        if (typeof last === 'string') return last.trim();
    }
    return null;
}

async function buildGenerator() {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;

    const model = process.env.TRANSFORMERS_RP_MODEL || 'onnx-community/Qwen2.5-0.5B-Instruct';
    const dtype = process.env.TRANSFORMERS_DTYPE || 'q4';

    console.log('[Transformers.js] Loading ATR RP model:', model, 'dtype:', dtype);

    try {
        return await pipeline('text-generation', model, { dtype });
    } catch (quantizedError) {
        console.warn('[Transformers.js] Requested dtype failed; retrying default model files:', quantizedError.message);
        return await pipeline('text-generation', model);
    }
}

async function getGenerator() {
    if (!generatorPromise) generatorPromise = buildGenerator();
    try {
        return await generatorPromise;
    } catch (error) {
        generatorPromise = null;
        throw error;
    }
}

async function callTransformersJS(system, prompt, options = {}) {
    const safeSystem = String(system || '').slice(-2000);
    const safePrompt = String(prompt || '').slice(-2000);
    try {
        const generator = await getGenerator();
        const output = await generator([
            { role: 'system', content: safeSystem },
            { role: 'user', content: safePrompt }
        ], {
            max_new_tokens: Number(process.env.TRANSFORMERS_MAX_NEW_TOKENS || 80),
            temperature: Number(process.env.TRANSFORMERS_TEMPERATURE || 0.7),
            top_p: Number(process.env.TRANSFORMERS_TOP_P || 0.9),
            repetition_penalty: Number(process.env.TRANSFORMERS_REPETITION_PENALTY || 1.1),
            do_sample: true
        });

        const text = extractGeneratedText(output);
        if (!text || text.length < 5) {
            return null;
        }

        return text
            .replace(/^assistant\s*[:：]\s*/i, '')
            .replace(/\[TRUNCATED\]/gi, '')
            .trim();
    } catch (error) {
        console.error('[Transformers.js] RP engine unavailable:', error.stack || error.message);
        generatorPromise = null;
        return null;
    }
}

module.exports = { callTransformersJS };
