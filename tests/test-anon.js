const axios = require('axios');

async function testAnon() {
    try {
        console.log("Testing Puter with 'anon' token...");
        const response = await axios.post('https://api.puter.com/v1/chat/completions', {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'hi' }]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer anon',
                'Origin': 'https://puter.com',
                'Referer': 'https://puter.com/'
            },
            timeout: 10000
        });
        console.log("Success:", response.status, response.data);
    } catch (e) {
        console.warn("Fail:", e.response?.status, e.message);
    }
}

testAnon();
