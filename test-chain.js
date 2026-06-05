const { callAI } = require('./ai-utils');

async function testChain() {
    console.log("--- Testing AI Fallback Chain ---");
    const result = await callAI("System: You are an AI.", "User: Hello, say test.");
    console.log("Final Result:", result);
    console.log("-------------------------------");
}

testChain();
