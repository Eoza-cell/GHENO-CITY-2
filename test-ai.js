require('dotenv').config();
const aiUtils = require('./ai-utils');

async function testProvider(name, fn) {
    console.log(`\n--- Testing ${name} ---`);
    const start = Date.now();
    try {
        const res = await fn("Tu es un MJ d'Aetherys. Réponds uniquement par 'OK' si tu fonctionnes.", "Bonjour, test système.");
        const duration = (Date.now() - start) / 1000;
        if (res) {
            console.log(`✅ Success in ${duration}s`);
            console.log(`Response: ${typeof res === 'string' ? res.substring(0, 100) : JSON.stringify(res).substring(0, 100)}...`);
        } else {
            console.log(`❌ Failed: Returned null/empty`);
        }
    } catch (e) {
        console.log(`❌ Failed with error: ${e.message}`);
    }
}

async function runTests() {
    console.log("Starting AI Provider Diagnostics...");
    console.log("Environment Keys:");
    console.log("- OPENROUTER_API_KEY:", process.env.OPENROUTER_API_KEY ? "SET" : "MISSING");
    console.log("- PUTER_API_KEY:", process.env.PUTER_API_KEY ? "SET" : "MISSING");
    console.log("- OLLAMA_URL:", process.env.OLLAMA_URL || "MISSING");

    await testProvider('Pollinations POST', aiUtils.callPollinationsPOST);
    await testProvider('Pollinations GET', aiUtils.callPollinationsGET);
    await testProvider('Blackbox AI', aiUtils.callBlackbox);
    await testProvider('OpenRouter Free', aiUtils.callOpenRouterFree);
    await testProvider('Ollama', aiUtils.callOllama);
    await testProvider('Puter SDK', aiUtils.callPuterSDK);

    console.log("\n--- Testing Main callAI Loop ---");
    const mainStart = Date.now();
    const mainRes = await aiUtils.callAI("Tu es un MJ.", "Test global.", 0, (name) => console.log(`Chosen provider: ${name}`));
    console.log(`Main Loop took ${(Date.now() - mainStart) / 1000}s`);
    console.log(`Final Response snippet: ${typeof mainRes === 'string' ? mainRes.substring(0, 50) : JSON.stringify(mainRes).substring(0, 50)}`);
}

runTests();
