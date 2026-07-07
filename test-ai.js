require('dotenv').config();
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: "https://localhost",
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage;

async function testChat() {
    try {
        const puterLib = require('@heyputer/puter.js');
        const puter = puterLib.default || puterLib;

        if (process.env.PUTER_TOKEN) {
            puter.authToken = process.env.PUTER_TOKEN;
            console.log("Token set.");
        } else {
            console.log("No PUTER_TOKEN in .env");
            return;
        }

        console.log("Testing gemini-1.5-flash...");
        const response = await puter.ai.chat("Hello, who are you?", { model: 'gemini-1.5-flash' });
        console.log("Response type:", typeof response);
        console.log("Response:", JSON.stringify(response));
    } catch (e) {
        console.error("Chat test failed:", e);
    }
}

testChat();
