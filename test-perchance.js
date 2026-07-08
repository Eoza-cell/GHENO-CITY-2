const axios = require('axios');

async function testPerchance() {
    try {
        console.log("Testing Perchance AI Text Plugin...");
        // This is a common guess for the unofficial endpoint
        const url = "https://perchance.org/api/ai-text-plugin";

        const payload = {
            prompt: "Hello, tell me a short story about a cat.",
            instructions: "You are a helpful assistant.",
            model: "mistral-7b"
        };

        const resp = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        console.log("Status:", resp.status);
        console.log("Data:", JSON.stringify(resp.data));
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.log("Response Status:", e.response.status);
            console.log("Response Data:", e.response.data);
        }
    }
}

testPerchance();
