const { callAI } = require('./ai-utils');

async function runTests() {
    console.log("--- Testing AI Provider Chain Resilience V2 ---");

    const startTime = Date.now();
    try {
        const result = await callAI("Tu es un testeur.", "Réponds juste 'OK' si tu m'entends.");
        const duration = (Date.now() - startTime) / 1000;

        if (result) {
            console.log(`✅ Success! Duration: ${duration}s`);
            console.log(`Result: ${JSON.stringify(result).substring(0, 100)}...`);
        } else {
            console.log("❌ Failed to get a response from any provider.");
        }
    } catch (e) {
        console.error("❌ Test crashed:", e.message);
    }
}

runTests();
