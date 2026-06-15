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

    console.log("\n--- Testing Embeddings ---");
    try {
        const emb = await aiUtils.getEmbeddings("Le ciel est bleu à cause de la diffusion de Rayleigh");
        if (emb) {
            console.log("✅ Embeddings received!");
            console.log("Dimensions:", emb.length);
        } else {
            console.log("❌ Embeddings failed (returned null)");
        }
    } catch (e) {
        console.log("❌ Embeddings error:", e.message);
    }

    await testProvider('Pollinations POST', aiUtils.callPollinationsPOST);
    await testProvider('Pollinations GET', aiUtils.callPollinationsGET);
    await testProvider('Blackbox AI', aiUtils.callBlackbox);
    await testProvider('OpenRouter Free', aiUtils.callOpenRouterFree);
}

runTests();
