const axios = require('axios');

/**
 * ATR AI — Empero only.
 *
 * Runtime model: Empero Qwythos-9B-v2 through a local Ollama server.
 * No Puter, Omni Router, OpenRouter, Aether, Hugging Face remote fallback,
 * or secondary provider is used for RP generation.
 *
 * RAG remains separate and is injected by rag-preload.js before callAI().
 */

function isValidAIResponse(input) {
    if (!input) return false;
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    const cleaned = text.trim();
    if (cleaned.length < 3) return false;

    const lower = cleaned.toLowerCase();
    if (/^(user safety|safety|content safety)\s*:/i.test(cleaned)) return false;
    if (/^safe\s*$/i.test(cleaned)) return false;
    if (cleaned === '[DONE]' || lower.includes('<!doctype html>') || lower.includes('<html>')) return false;

    const errors = [
        '"error":',
        'unauthorized',
        'token_missing',
        'insufficient_quota',
        'rate_limit_exceeded',
        'api_key_invalid',
        'service_unavailable',
        'permission_denied'
    ];
    if (cleaned.length < 500 && errors.some(x => lower.includes(x))) return false;

    return true;
}

async function callEmpero(system, prompt, options = {}) {
    let host = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    if (!host.startsWith('http')) host = 'http://' + host;
    host = host.replace(/\/$/, '');

    // Empero's Qwythos-9B-v2 is the single RP model.
    const model = process.env.EMPPERO_MODEL ||
        process.env.EMPERO_MODEL ||
        process.env.OLLAMA_MODEL ||
        'qwythos-9b-v2';

    const numCtx = parseInt(process.env.OLLAMA_NUM_CTX || '32768', 10);
    const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);
    const temperature = Number(process.env.EMPERO_TEMPERATURE || '0.6');
    const topP = Number(process.env.EMPERO_TOP_P || '0.95');
    const topK = Number(process.env.EMPERO_TOP_K || '20');
    const repetitionPenalty = Number(process.env.EMPERO_REPETITION_PENALTY || '1.05');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        console.log(`[AI] Empero Qwythos-9B-v2 -> Ollama (${host})`);

        const response = await axios.post(
            `${host}/api/chat`,
            {
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt }
                ],
                stream: false,
                options: {
                    num_ctx: numCtx,
                    temperature,
                    top_p: topP,
                    top_k: topK,
                    repeat_penalty: repetitionPenalty
                }
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: timeoutMs,
                signal: controller.signal
            }
        );

        const content = response.data?.message?.content;
        if (isValidAIResponse(content)) return content;

        console.warn('[AI] Empero returned an empty/invalid response.');
        return null;
    } catch (error) {
        console.warn('[AI] Empero/Ollama unavailable:', error.response?.data?.error || error.message);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function callAI(systemPrompt, userPrompt, options = {}) {
    const maxSystemLength = 16000;
    const maxUserLength = 16000;

    const system = String(systemPrompt || '').length > maxSystemLength
        ? String(systemPrompt).substring(0, maxSystemLength)
        : String(systemPrompt || '');

    const prompt = String(userPrompt || '').length > maxUserLength
        ? String(userPrompt).substring(0, 7000) + '\n...[TRUNCATED]...\n' + String(userPrompt).slice(-9000)
        : String(userPrompt || '');

    const result = await callEmpero(system, prompt, options);

    if (isValidAIResponse(result)) {
        return result;
    }

    return null;
}

// Compatibility aliases for code that already imports callOllama.
const callOllama = callEmpero;
const callHuggingFaceLocal = async () => null;
const callAether = async () => null;
const callOmniRouter = async () => null;
const call9Router = async () => null;

module.exports = {
    callAI,
    callEmpero,
    callOllama,
    callHuggingFaceLocal,
    callAether,
    callOmniRouter,
    call9Router,
    isValidAIResponse
};
