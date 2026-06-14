// Advanced Polyfills for Puter.js in Node.js
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: "https://puter.com/",
    referrer: "https://puter.com/",
    contentType: "text/html",
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.localStorage = dom.window.localStorage;
global.XMLHttpRequest = dom.window.XMLHttpRequest;
global.fetch = fetch;

const puter = require('@heyputer/puter.js');
const p = puter.default || puter;

async function test() {
    try {
        console.log("Calling Puter AI with JSDOM polyfills...");
        // models: gemini-1.5-flash, gemini-2.0-flash, gpt-4o-mini
        const res = await p.ai.chat("Say 'Hello' in a very epic way", { model: 'gemini-1.5-flash' });
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e.message);
        if (e.stack) console.error(e.stack);
    }
}

test();
