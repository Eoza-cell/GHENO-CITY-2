require('dotenv').config();
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: "https://localhost",
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = dom.window.localStorage;

try {
    const puter = require('@heyputer/puter.js');
    console.log("Puter keys:", Object.keys(puter));
    if (puter.default) console.log("Puter.default keys:", Object.keys(puter.default));

    const instance = puter.default || puter;
    console.log("AI keys:", instance.ai ? Object.keys(instance.ai) : "No AI");
} catch (e) {
    console.error("Error loading Puter:", e);
}
