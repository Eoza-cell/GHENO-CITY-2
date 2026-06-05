const { puter } = require('@heyputer/puter.js');

async function testSDK(model) {
    console.log(`Testing Puter SDK with model: ${model}`);
    try {
        const resp = await puter.ai.chat("Say hello", { model: model });
        console.log(`Puter SDK ${model} Success:`, resp);
    } catch (e) {
        console.log(`Puter SDK ${model} Failed:`, e.message);
    }
}

(async () => {
    await testSDK("gpt-4o");
    await testSDK("gpt-5.5-pro");
    await testSDK("gpt-5.4-nano");
})();
