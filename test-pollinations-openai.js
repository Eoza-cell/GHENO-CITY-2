const axios = require('axios');

async function testPollinations() {
    const system = "Tu es un MJ. Réponds en JSON: {\"narrative\": \"Test\"}";
    const prompt = "Bonjour";

    try {
        console.log("Testing Pollinations POST (openai)...");
        const resp = await axios.post("https://text.pollinations.ai/", {
            messages: [
                { role: "system", content: system },
                { role: "user", content: prompt }
            ],
            model: "openai",
            jsonMode: true,
            seed: 42
        }, { timeout: 15000 });

        console.log("Status:", resp.status);
        console.log("Data type:", typeof resp.data);
        console.log("Data:", JSON.stringify(resp.data));
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.log("Response data:", e.response.data);
    }
}

testPollinations();
