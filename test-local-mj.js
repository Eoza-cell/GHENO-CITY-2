const { callAI } = require('./ai-utils');

async function testLocalMJ() {
    const system = "JOUEUR: Messi (Attaquant) Tir:99 Passe:90 Dribble:95 Vitesse:88 Défense:40";

    console.log("--- Test Tir ---");
    console.log(await callAI(system, "Je tente un tir de loin"));

    console.log("\n--- Test Passe ---");
    console.log(await callAI(system, "Je fais une passe à mon coéquipier"));

    console.log("\n--- Test Dribble ---");
    console.log(await callAI(system, "Je dribble le défenseur"));

    console.log("\n--- Test Inconnu ---");
    console.log(await callAI(system, "Je regarde le ciel"));
}

testLocalMJ();
