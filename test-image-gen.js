const { generateImageVia9Router } = require('./ai-utils');
require('dotenv').config();

async function test() {
    console.log("Testing image generation logic...");
    // Mocking axios to avoid real network call if key is missing or to see what it would do
    // Actually, I'll just see if it fails gracefully if no key.
    try {
        const url = await generateImageVia9Router("a test prompt");
        console.log("Result:", url);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
