"use strict";

// Puter is the primary RP brain for ATR.
// The token MUST come from the environment; never hard-code it.
const { init } = require("@heyputer/puter.js/src/init.cjs");

let puter = null;
let initialized = false;

function getPuter() {
    if (initialized) return puter;
    initialized = true;

    const token = process.env.PUTER_TOKEN || process.env.PUTER_AUTH_TOKEN || process.env.PUTER_API_KEY;
    if (!token) {
        console.warn("[AI] Puter: PUTER_TOKEN/PUTER_AUTH_TOKEN is missing.");
        return null;
    }

    try {
        puter = init(token);
        console.log("[AI] Puter primary provider initialized.");
    } catch (error) {
        console.warn("[AI] Puter initialization failed:", error.message);
        puter = null;
    }

    return puter;
}

function extractText(response) {
    if (!response) return null;
    if (typeof response === "string") return response.trim();

    const content = response?.message?.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
        const text = content
            .map(part => typeof part === "string" ? part : (part?.text || ""))
            .join("")
            .trim();
        return text || null;
    }

    if (typeof response?.text === "string") return response.text.trim();
    if (typeof response?.content === "string") return response.content.trim();

    return null;
}

function validNarrative(text) {
    if (!text || text.length < 3) return false;
    const value = text.trim();
    if (/^(user safety|safety|content safety)\s*:/i.test(value)) return false;
    if (/^safe$/i.test(value)) return false;
    if (/^\s*\[?(error|unauthorized|forbidden|rate[_ -]?limit)\]?\s*$/i.test(value)) return false;
    return true;
}

async function callPuterPrimary(system, prompt, options = {}) {
    const client = getPuter();
    if (!client?.ai?.chat) return null;

    const configuredModel = process.env.PUTER_RP_MODEL || "gpt-5.6-luna";
    const fallbackModels = [
        configuredModel,
        "gemini-3.1-flash-lite",
        "claude-sonnet-4-6"
    ].filter((model, index, list) => model && list.indexOf(model) === index);

    const messages = [
        { role: "system", content: system },
        { role: "user", content: prompt }
    ];

    const timeoutMs = Number(process.env.PUTER_TIMEOUT_MS || 90000);
    const temperature = Number(process.env.PUTER_TEMPERATURE || 0.85);
    const maxTokens = Number(process.env.PUTER_MAX_TOKENS || 900);

    for (const model of fallbackModels) {
        try {
            console.log(`[AI] Puter primary: ${model}`);

            const request = client.ai.chat(messages, {
                model,
                stream: false,
                normalize: true,
                temperature,
                max_tokens: maxTokens
            });

            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Puter timeout after ${timeoutMs}ms`)), timeoutMs)
            );

            const response = await Promise.race([request, timeout]);
            const text = extractText(response);

            if (validNarrative(text)) {
                console.log(`[AI] Puter primary success (${model}).`);
                return text;
            }

            console.warn(`[AI] Puter ${model}: empty/invalid narrative response.`);
        } catch (error) {
            console.warn(`[AI] Puter ${model} failed:`, error?.message || error);
        }
    }

    return null;
}

module.exports = { callPuterPrimary };
