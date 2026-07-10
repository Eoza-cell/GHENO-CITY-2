require('dotenv').config();
const { callAI } = require('./ai-utils');

async function diagnose() {
    console.log("Starting AI diagnostics...");
    console.log("OPENROUTER_API_KEY present:", !!process.env.OPENROUTER_API_KEY);
    console.log("PUTER_API_KEY present:", !!process.env.PUTER_API_KEY);
    console.log("PUTER_TOKEN present:", !!process.env.PUTER_TOKEN);
    console.log("POLLINATIONS_API_KEY present:", !!process.env.POLLINATIONS_API_KEY);

    const system = "Tu es un assistant. Réponds par 'OK'.";
    const prompt = "Diagnostic.";

    try {
        const result = await callAI(system, prompt);
        console.log("Result received:", result);
    } catch (e) {
        console.error("Critical error in callAI:", e);
    }
}

diagnose();
