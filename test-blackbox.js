const axios = require('axios');

async function testBlackbox() {
    console.log("Testing Blackbox AI...");
    try {
        const res = await axios.post("https://www.blackbox.ai/api/chat", {
            messages: [{role: "user", content: "Say hello"}],
            model: "gpt-4o",
            max_tokens: 1024
        }, { timeout: 15000 });
        console.log("Blackbox Success:", res.data);
    } catch (e) {
        console.log("Blackbox Failed:", e.response?.status, e.message);
    }
}

(async () => {
    await testBlackbox();
})();
