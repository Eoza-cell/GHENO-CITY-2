const axios = require('axios');

async function testPuterV2(model) {
    console.log(`Testing Puter V2 with model: ${model}`);
    try {
        const res = await axios.post("https://api.puter.com/v2/ai/chat", {
            model: model,
            messages: [{role: "user", content: "Say hello"}],
        }, {
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Origin": "https://puter.com",
                "Referer": "https://puter.com/"
            },
            timeout: 10000
        });
        console.log(`Puter V2 ${model} Success:`, res.data);
    } catch (e) {
        console.log(`Puter V2 ${model} Failed:`, e.response?.status, e.response?.data || e.message);
    }
}

(async () => {
    await testPuterV2("gpt-4o");
    await testPuterV2("claude-sonnet-4-6");
})();
