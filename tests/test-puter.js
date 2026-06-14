require('dotenv').config();
const { callAI } = require('./ai-utils');

async function testPuter() {
    console.log("--- TEST PRIORITÉ PUTER.JS ---");
    const system = "Tu es un assistant. Réponds en JSON: {\"narrative\": \"...\"}";
    const prompt = "Dis 'Bonjour' de manière épique.";

    try {
        const result = await callAI(system, prompt);
        console.log("Résultat final:", result);
    } catch (e) {
        console.error("Erreur test:", e);
    }
}

testPuter();
