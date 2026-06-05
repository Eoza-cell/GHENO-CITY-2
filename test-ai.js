const axios = require('axios');
require('dotenv').config();

async function testOpenRouter() {
    console.log("Testing OpenRouter...");
    try {
        const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "nvidia/llama-3.1-nemotron-70b-instruct",
            messages: [{role: "user", content: "Say hello"}],
        }, {
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            }
        });
        console.log("OpenRouter Success:", res.data.choices[0].message.content);
    } catch (e) {
        console.log("OpenRouter Failed:", e.response?.status, e.response?.data || e.message);
    }
}

async function testPuter() {
    console.log("\nTesting Puter API...");
    const models = ["gpt-4o", "o3-mini", "gpt-5.5-pro"];
    for (const model of models) {
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
            return;
        } catch (e) {
            console.log(`Puter ${model} Failed:`, e.response?.status, e.response?.data || e.message);
        }
    }
}

async function testPollinations() {
    console.log("\nTesting Pollinations...");
    try {
        const res = await axios.post("https://text.pollinations.ai/", {
            messages: [{role: "user", content: "Say hello"}],
            model: "openai",
        });
        console.log("Pollinations Success:", res.data);
    } catch (e) {
        console.log("Pollinations Failed:", e.message);
    }
}

(async () => {
    await testOpenRouter();
    await testPuter();
    await testPollinations();
})();
