const axios = require('axios');

/**
 * ATR AI — GPT-OSS Proxy only.
 *
 * OpenAI-compatible Cloudflare Worker:
 * https://gptoss-proxy.eozaatlas-3d0.workers.dev
 *
 * RAG remains separate and is injected by rag-preload.js before callAI().
 */

const GPTOSS_BASE_URL = (
    process.env.GPTOSS_PROXY_URL ||
    'https://gptoss-proxy.eozaatlas-3d0.workers.dev'
).replace(/\/$/, '');

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

async function callGPTOSS(system, prompt, options = {}) {
    const model = options.model || process.env.GPTOSS_MODEL || 'gpt-oss-120b';
    const timeoutMs = parseInt(process.env.GPTOSS_TIMEOUT_MS || '120000', 10);
    const reasoningEffort = options.reasoningEffort ||
        process.env.GPTOSS_REASONING_EFFORT ||
        'medium';

    const maxTokens = parseInt(
        options.maxOutputTokens ||
        process.env.GPTOSS_MAX_OUTPUT_TOKENS ||
        '8192',
        10
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        console.log(`[AI] GPT-OSS ${model} -> ${GPTOSS_BASE_URL}`);

        const response = await axios.post(
            `${GPTOSS_BASE_URL}/v1/chat/completions`,
            {
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt }
                ],
                stream: false,
                max_tokens: maxTokens,
                metadata: {
                    reasoning_effort: reasoningEffort,
                    gptoss_user_id: options.userId || options.playerId || 'atr',
                    gptoss_thread_id: options.threadId || options.playerId || 'atr-rp'
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: timeoutMs,
                signal: controller.signal
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;

        if (isValidAIResponse(content)) return content;

        console.warn('[AI] GPT-OSS returned an empty/invalid response.');
        return null;
    } catch (error) {
        console.warn(
            '[AI] GPT-OSS proxy unavailable:',
            error.response?.data?.error?.message ||
            error.response?.data?.error ||
            error.message
        );
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

    const result = await callGPTOSS(system, prompt, options);

    return isValidAIResponse(result) ? result : null;
}

// Compatibility aliases for legacy imports.
const callEmpero = callGPTOSS;
const callOllama = callGPTOSS;
const callHuggingFaceLocal = async () => null;
const callAether = async () => null;
const callOmniRouter = async () => null;
const call9Router = async () => null;

module.exports = {
    callAI,
    callGPTOSS,
    callEmpero,
    callOllama,
    callHuggingFaceLocal,
    callAether,
    callOmniRouter,
    call9Router,
    isValidAIResponse
};
