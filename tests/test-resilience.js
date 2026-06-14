require('dotenv').config();
const { callAI } = require('./ai-utils');

async function test() {
    console.log("Testing AI Chain...");
    try {
        const res = await callAI("Tu es un MJ.", "Je marche dans la forêt.");
        console.log("Response:", res);
    } catch (e) {
        console.error("Test Failed:", e);
    }
}

test();
