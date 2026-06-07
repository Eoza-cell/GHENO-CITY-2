const axios = require('axios');

async function testPollinations() {
    console.log("Testing Pollinations POST...");
    try {
        const res = await axios.post("https://text.pollinations.ai/", {
            messages: [{role: "user", content: "Say hello"}],
            model: "openai"
        }, { timeout: 10000 });
        console.log("Pollinations Success:", res.data);
    } catch (e) {
        console.log("Pollinations Failed:", e.response?.status, e.message);
    }
}

async function testPollinationsGET() {
    console.log("Testing Pollinations GET...");
    try {
        const res = await axios.get("https://text.pollinations.ai/Say%20hello?model=openai", { timeout: 10000 });
        console.log("Pollinations GET Success:", res.data);
    } catch (e) {
        console.log("Pollinations GET Failed:", e.response?.status, e.message);
    }
}

(async () => {
    await testPollinations();
    await testPollinationsGET();
})();
