const { callAI } = require('./ai-utils');
const { handleFreeAction } = require('./ai-handler');
const fs = require('fs');

async function testProviders() {
    console.log("Checking ai-utils.js for provider priority...");
    const content = fs.readFileSync('ai-utils.js', 'utf8');
    const match = content.match(/const providers = \[([\s\S]*?)\];/);
    if (match) {
        console.log("Providers order:");
        console.log(match[1].trim());
        if (match[1].includes('Pollinations POST')) {
            console.log("✅ Pollinations is in the list.");
        } else {
            console.log("❌ Pollinations NOT found in the list.");
        }
    } else {
        console.log("❌ Could not find providers list in ai-utils.js");
    }
}

async function testPrompt() {
    console.log("Checking ai-handler.js for actionVisual instruction...");
    const content = fs.readFileSync('ai-handler.js', 'utf8');
    if (content.includes('actionVisual')) {
        console.log("✅ actionVisual instruction found in system prompt.");
    } else {
        console.log("❌ actionVisual instruction NOT found.");
    }
}

async function testDatabaseSeeding() {
    console.log("Checking database.js for skill seeding...");
    const content = fs.readFileSync('database.js', 'utf8');
    const classSkillMatch = content.match(/for \(let i = 0; i < 1000; i\+\+\) \{[\s\S]*?classSkills\.push/);
    const elementalSkillMatch = content.match(/for \(let i = 0; i < 3000; i\+\+\) \{[\s\S]*?elementalSkills\.push/);

    if (classSkillMatch) console.log("✅ 1000 Class skills seeding found.");
    else console.log("❌ 1000 Class skills seeding NOT found.");

    if (elementalSkillMatch) console.log("✅ 3000 Elemental skills seeding found.");
    else console.log("❌ 3000 Elemental skills seeding NOT found.");
}

testProviders();
testPrompt();
testDatabaseSeeding();
