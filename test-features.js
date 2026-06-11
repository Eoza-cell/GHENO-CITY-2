const { generateClassSelectionImage } = require('./class-visualizer');
const fs = require('fs');

async function testCanvas() {
    console.log("Testing Canvas Generation...");
    try {
        const buffer = await generateClassSelectionImage();
        fs.writeFileSync('test-class-image.png', buffer);
        console.log("Canvas image generated: test-class-image.png");
    } catch (e) {
        console.error("Canvas failed:", e);
    }
}

function testGacha(iterations = 10000) {
    console.log(`Testing Gacha Distribution (${iterations} iterations)...`);
    const counts = { "Sans Famille": 0, "Maison de la Lame d'Argent": 0, "Clan des Loups d'Acier": 0, "Famille Royale d'Elion": 0 };
    for (let i = 0; i < iterations; i++) {
        const roll = Math.random() * 100;
        let family = "Sans Famille";
        if (roll < 1) family = "Famille Royale d'Elion";
        else if (roll < 10) family = "Maison de la Lame d'Argent";
        else if (roll < 25) family = "Clan des Loups d'Acier";
        counts[family]++;
    }
    for (const [f, c] of Object.entries(counts)) {
        console.log(`${f}: ${(c/iterations*100).toFixed(2)}% (Target: ${f === "Famille Royale d'Elion" ? '1%' : f === "Maison de la Lame d'Argent" ? '9%' : f === "Clan des Loups d'Acier" ? '15%' : '75%'})`);
    }
}

async function run() {
    await testCanvas();
    testGacha();
    process.exit(0);
}

run();
