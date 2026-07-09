const { callAI } = require('./ai-utils');

async function testCallAI() {
    console.log("Testing callAI with prioritized Puter (should fail/skip) and then Pollinations...");
    try {
        const response = await callAI("Tu es un assistant.", "Dis 'test reussi' en un mot.");
        console.log("Final Response:", response);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

testCallAI();
