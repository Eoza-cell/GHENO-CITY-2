const { JSDOM } = require('jsdom');

// Setup JSDOM for Puter SDK
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: "https://localhost",
    referrer: "https://localhost",
    contentType: "text/html",
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;

async function testPuter() {
    try {
        console.log("Loading Puter SDK...");
        const puterLib = require('@heyputer/puter.js');
        const puter = puterLib.default || puterLib;

        const token = process.env.PUTER_TOKEN || process.env.PUTER_API_KEY;
        if (token) {
             if (typeof puter.setAuthToken === 'function') {
                puter.setAuthToken(token);
            }
            puter.authToken = token;
            console.log("Token set.");
        }

        console.log("Calling puter.ai.chat with gemini-1.5-flash...");
        const response = await puter.ai.chat("Dis bonjour en un mot.", { model: 'gemini-1.5-flash' });
        console.log("Response:", response);
    } catch (e) {
        console.error("Error:", e);
    }
}

testPuter();
