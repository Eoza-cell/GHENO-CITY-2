const { extractNarrative, cleanAIResponse } = require('./ai-utils');

const testCases = [
    {
        name: "Nested Actions with Parameters",
        content: `{"narrative": "Tu frappes fort.", "actions": [{"type": "update_player", "parameters": {"xp_gain": 5, "col_change": 2}}], "imagePrompt": "A fighter"}`
    },
    {
        name: "Mixed Text and JSON",
        content: `C'est un combat épique !
        {"narrative": "L'ennemi recule.", "actions": [{"type": "notify_player", "parameters": {"target_name": "Solo", "message": "Attention !"}}]}
        Fin du tour.`
    },
    {
        name: "SSE Data with JSON",
        content: `data: {"content": "L'instructeur rigole."}
        data: {"content": " {\\\"actions\\\": [{\\\"type\\\": \\\"update_player\\\", \\\"parameters\\\": {\\\"hp\\\": -10}}]}"}
        data: [DONE]`
    },
    {
        name: "Broken Regex Case (Previously failing)",
        content: `{"narrative": "DODODO!\\nL'Instructeur esquive ton geste à la dernière seconde. \\\"C'était bien tenté, Aventurier, mais ton intention de tuer doit être plus pure !\\\" Ton action \\\"ton action\\\" a été entendue par le monde lui-même.\\n\\n(Note: Les serveurs de l'IA sont surchargés, ceci est une réponse de secours.)","actions":[{"type":"update_player","parameters":{"xp_gain":5,"col_change":2}}]}`
    }
];

testCases.forEach(tc => {
    console.log(`--- Test: ${tc.name} ---`);
    const result = extractNarrative(tc.content);
    console.log("Narrative:", result.narrative);
    console.log("Actions count:", result.actions.length);
    if (result.actions.length > 0) {
        console.log("First Action Type:", result.actions[0].type);
        console.log("First Action Params:", JSON.stringify(result.actions[0].parameters));
    }
    console.log("\n");
});
