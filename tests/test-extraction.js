const { extractNarrative } = require('./ai-utils');

const testCases = [
    {
        name: "Standard JSON",
        content: `{"narrative": "Le combat commence !", "actions": []}`
    },
    {
        name: "Narrative before JSON",
        content: `Voici ce qui se passe : {"narrative": "Le combat commence !", "actions": []}`
    },
    {
        name: "Narrative after JSON",
        content: `{"narrative": "Le combat commence !", "actions": []} Fin du tour.`
    },
    {
        name: "Nested JSON in actions",
        content: `{"narrative": "Ok", "actions": [{"type": "update", "parameters": {"hp": 10}}]}`
    },
    {
        name: "Broken JSON at end",
        content: `{"narrative": "Presque...", "actions": []`
    }
];

testCases.forEach(tc => {
    console.log(`--- Test: ${tc.name} ---`);
    const res = extractNarrative(tc.content);
    console.log("Narrative:", res.narrative);
    console.log("Actions count:", res.actions?.length || 0);
    console.log("\n");
});
