const axios = require('axios');

async function testPuterKeyless() {
    try {
        console.log("Testing Puter v2 Chat API Keyless...");
        const response = await axios.post('https://api.puter.com/v1/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'hi' }]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Puter-App-Id': '00000000-0000-4000-8000-000000000000',
                'Origin': 'https://puter.com',
                'Referer': 'https://puter.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        console.log("Success:", response.status, response.data);
    } catch (e) {
        console.warn("Fail:", e.response?.status, e.message);
    }
}

testPuterKeyless();
