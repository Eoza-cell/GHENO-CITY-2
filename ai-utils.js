const axios = require('axios');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { callTransformersJS } = require('./transformers-js-handler');

/**
 * ATR AI Engine — High Availability with Puter, NVIDIA API, Transformers.js, OllamaFreeAPI & Fallbacks.
 */

function isValidAIResponse(input) {
    if (!input) return false;
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    const cleaned = text.trim();
    if (cleaned.length < 2) return false;

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

async function callPuter(systemPrompt, userPrompt, options = {}) {
    try {
        const { JSDOM } = require('jsdom');
        if (!global.window) {
            const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
            global.window = dom.window;
            global.document = dom.window.document;
            global.navigator = dom.window.navigator;
        }

        const puterLib = require('@heyputer/puter.js');
        const puter = puterLib.default || puterLib;

        const token = process.env.PUTER_TOKEN || process.env.PUTER_API_KEY;
        if (token) {
            puter.setAuthToken(token);
        }

        console.log('[AI] Requesting via Puter AI...');
        const prompt = systemPrompt ? `System: ${systemPrompt}\nUser: ${userPrompt}` : userPrompt;
        const resp = await puter.ai.chat(prompt, { model: options.model || 'gpt-4o-mini' });

        const content = typeof resp === 'string' ? resp : (resp?.message?.content || resp?.text);
        if (isValidAIResponse(content)) {
            console.log('[AI] Puter AI success.');
            return content.trim();
        }
    } catch (e) {
        console.warn('[AI] Puter AI error:', e.message);
    }
    return null;
}

async function callTransformersLocal(systemPrompt, userPrompt, options = {}) {
    try {
        console.log('[AI] Requesting via Transformers.js ONNX local engine...');
        const result = await callTransformersJS(systemPrompt, userPrompt, options);
        if (isValidAIResponse(result)) {
            console.log('[AI] Transformers.js ONNX success.');
            return result.trim();
        }
    } catch (err) {
        console.warn('[AI] Transformers.js engine error:', err.message);
    }
    return null;
}

async function callNvidia(systemPrompt, userPrompt, options = {}) {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return null;

    const model = process.env.NVIDIA_MODEL || 'z-ai/glm-5.3';
    const timeoutMs = parseInt(process.env.NVIDIA_TIMEOUT_MS || '10000', 10);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        console.log(`[AI] Requesting via NVIDIA API (${model})...`);
        const response = await axios.post(
            'https://integrate.api.nvidia.com/v1/chat/completions',
            {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: Number(options.temperature || 0.5),
                top_p: Number(options.topP || 1),
                max_tokens: parseInt(options.maxTokens || '1024', 10),
                stream: false
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: timeoutMs,
                signal: controller.signal
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (isValidAIResponse(content)) {
            console.log('[AI] NVIDIA API success.');
            return content.trim();
        }
        return null;
    } catch (error) {
        console.warn('[AI] NVIDIA API unavailable:', error.message);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function callOllamaFreeAPI(systemPrompt, userPrompt, options = {}) {
    return new Promise((resolve) => {
        try {
            console.log('[AI] Requesting via OllamaFreeAPI Python bridge...');
            const sysFile = path.join(os.tmpdir(), `ollamafreeapi_sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.txt`);
            const usrFile = path.join(os.tmpdir(), `ollamafreeapi_usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.txt`);

            fs.writeFileSync(sysFile, systemPrompt || '', 'utf-8');
            fs.writeFileSync(usrFile, userPrompt || '', 'utf-8');

            const scriptPath = path.join(__dirname, 'ollamafreeapi_handler.py');
            const args = [scriptPath, sysFile, usrFile];

            execFile('python3', args, { timeout: 8000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
                try { if (fs.existsSync(sysFile)) fs.unlinkSync(sysFile); } catch (e) {}
                try { if (fs.existsSync(usrFile)) fs.unlinkSync(usrFile); } catch (e) {}

                if (error) return resolve(null);

                const response = stdout ? stdout.trim() : '';
                if (isValidAIResponse(response)) {
                    console.log('[AI] OllamaFreeAPI success.');
                    return resolve(response);
                }
                return resolve(null);
            });
        } catch (err) {
            resolve(null);
        }
    });
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

    // 1. Try Puter AI
    let result = await callPuter(system, prompt, options);

    // 2. Primary fast local engine: Transformers.js ONNX
    if (!isValidAIResponse(result)) {
        result = await callTransformersLocal(system, prompt, options);
    }

    // 3. Try NVIDIA API if key exists
    if (!isValidAIResponse(result)) {
        result = await callNvidia(system, prompt, options);
    }

    // 4. Try OllamaFreeAPI Python bridge
    if (!isValidAIResponse(result)) {
        result = await callOllamaFreeAPI(system, prompt, options);
    }

    // 5. Guaranteed narrative fallback so AI NEVER returns null or fails
    if (!isValidAIResponse(result)) {
        result = `[NARRATION ATR]\nL'atmosphère crépite d'énergie pure. Les choix de l'Héritier résonnent à travers les dimensions d'After the Rebirth. L'aventure se poursuit !`;
    }

    return result;
}

// Compatibility aliases
const callOllama = async () => null;
const callHuggingFaceLocal = callTransformersJS;
const callAether = async () => null;
const callOmniRouter = async () => null;
const call9Router = async () => null;

module.exports = {
    callAI,
    callPuter,
    callNvidia,
    callTransformersJS,
    callOllamaFreeAPI,
    callHuggingFaceLocal,
    callAether,
    callOmniRouter,
    call9Router,
    isValidAIResponse
};
