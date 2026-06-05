const axios = require('axios');

async function testPuter(model) {
    console.log(`Testing Puter with model: ${model}`);
    try {
        const res = await axios.post("https://api.puter.com/v1/chat/completions", {
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
        console.log(`Puter ${model} Success:`, res.data.choices[0].message.content);
    } catch (e) {
        console.log(`Puter ${model} Failed:`, e.response?.status, e.response?.data || e.message);
    }
}

(async () => {
    await testPuter("claude-3.5-sonnet");
    await testPuter("gpt-4.0-pro");
    await testPuter("gpt-4o-mini");
    await testPuter("claude-3.5-sonnet-v2");
    await testPuter("gpt-3.5-turbo");
})();
