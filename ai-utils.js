const axios = require('axios');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * ATR AI — Integrated with OllamaFreeAPI & Empero.
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

async function callOllamaFreeAPI(systemPrompt, userPrompt, options = {}) {
    return new Promise((resolve) => {
        try {
            console.log('[AI] Requesting via OllamaFreeAPI...');
            const sysFile = path.join(os.tmpdir(), `ollamafreeapi_sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.txt`);
            const usrFile = path.join(os.tmpdir(), `ollamafreeapi_usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.txt`);

            fs.writeFileSync(sysFile, systemPrompt || '', 'utf-8');
            fs.writeFileSync(usrFile, userPrompt || '', 'utf-8');

            const scriptPath = path.join(__dirname, 'ollamafreeapi_handler.py');
            const args = [scriptPath, sysFile, usrFile];

            execFile('python3', args, { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                try { if (fs.existsSync(sysFile)) fs.unlinkSync(sysFile); } catch (e) {}
                try { if (fs.existsSync(usrFile)) fs.unlinkSync(usrFile); } catch (e) {}

                if (error) {
                    console.warn('[AI] OllamaFreeAPI failed/timed out:', error.message);
                    return resolve(null);
                }

                const response = stdout ? stdout.trim() : '';
                if (isValidAIResponse(response)) {
                    console.log('[AI] OllamaFreeAPI success.');
                    return resolve(response);
                }
                return resolve(null);
            });
        } catch (err) {
            console.warn('[AI] OllamaFreeAPI exception:', err.message);
            resolve(null);
        }
    });
}

async function callEmpero(system, prompt, options = {}) {
    let host = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    if (!host.startsWith('http')) host = 'http://' + host;
    host = host.replace(/\/$/, '');

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
    const numPredict = parseInt(process.env.EMPERO_MAX_OUTPUT_TOKENS || '8192', 10);

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
                    repeat_penalty: repetitionPenalty,
                    num_predict: numPredict
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

    // Primary: OllamaFreeAPI
    let result = await callOllamaFreeAPI(system, prompt, options);

    // Fallback: local Empero / Ollama
    if (!isValidAIResponse(result)) {
        result = await callEmpero(system, prompt, options);
    }

    if (isValidAIResponse(result)) {
        return result;
    }

    return null;
}

// Compatibility aliases
const callOllama = callEmpero;
const callHuggingFaceLocal = async () => null;
const callAether = async () => null;
const callOmniRouter = async () => null;
const call9Router = async () => null;

module.exports = {
    callAI,
    callOllamaFreeAPI,
    callEmpero,
    callOllama,
    callHuggingFaceLocal,
    callAether,
    callOmniRouter,
    call9Router,
    isValidAIResponse
};
