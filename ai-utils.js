const axios = require('axios');

/**
 * AI UTILS - Football Career Pro
 * Highly resilient AI caller using Puter.js and Pollinations
 */

let puterInstance = null;

function initPuter() {
    if (!puterInstance) {
        try {
            const p = require('@heyputer/puter.js');
            puterInstance = p.default || p.puter || p;
            if (process.env.PUTER_API_KEY) {
                puterInstance.setAuthToken(process.env.PUTER_API_KEY);
            }
        } catch (e) {
            console.error("[AI] Puter Load Error:", e.message);
        }
    }
    return puterInstance;
}

async function callAI(system, user) {
    console.log("[AI] Starting generation...");

    const providers = [
        // 1. Puter API (Axios - Often more stable in Node than SDK)
        async () => {
            if (!process.env.PUTER_API_KEY) return null;
            const res = await axios.post("https://api.puter.com/v1/chat/completions", {
                model: "gpt-4o",
                messages: [{role: "system", content: system}, {role: "user", content: user}]
            }, {
                headers: { "Authorization": `Bearer ${process.env.PUTER_API_KEY}` },
                timeout: 20000
            });
            return res.data?.choices?.[0]?.message?.content;
        },
        // 2. Puter SDK
        async () => {
            const puter = initPuter();
            if (!puter) return null;
            const resp = await puter.ai.chat(`System: ${system}\nUser: ${user}`, { model: "gpt-4o" });
            if (typeof resp === 'string') return resp;
            if (resp?.error) throw new Error(resp.message);
            return resp?.message?.content?.[0]?.text || resp?.text;
        },
        // 3. Pollinations (Reliable Free Fallback)
        async () => {
            const res = await axios.post("https://text.pollinations.ai/", {
                messages: [{role: "system", content: system}, {role: "user", content: user}],
                model: "openai",
                stream: false
            }, { timeout: 15000 });
            return res.data?.toString();
        }
    ];

    for (let i = 0; i < providers.length; i++) {
        try {
            const result = await providers[i]();
            if (result && result.length > 5) {
                console.log(`[AI] Provider ${i} success!`);
                return result;
            }
        } catch (e) {
            console.log(`[AI] Provider ${i} failed: ${e.message}`);
        }
    }

    // 4. Emergency Dummy Narrative (Prevents MJ Link Interrupted error)
    return "Le match continue intensément ! L'action est confuse mais tu gardes le contrôle. (Le serveur MJ est un peu surchargé, mais ton action est enregistrée).";
}

module.exports = { callAI };
