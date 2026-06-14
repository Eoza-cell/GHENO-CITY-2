const axios = require('axios');

async function testPuterChat() {
    try {
        console.log("Testing Puter Drivers Chat API Keyless...");
        const response = await axios.post('https://api.puter.com/drivers/call', {
            interface: 'puter-chat-completion',
            driver: 'ai-chat',
            method: 'complete',
            args: {
                messages: [{ role: 'user', content: 'hi' }],
                model: 'gemini-1.5-flash'
            }
        }, {
            headers: {
                'Content-Type': 'text/plain;actually=json',
                'Origin': 'https://puter.com',
                'Referer': 'https://puter.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        console.log("Success:", response.status, response.data);
    } catch (e) {
        console.warn("Fail:", e.response?.status, e.response?.data || e.message);
    }
}

testPuterChat();
