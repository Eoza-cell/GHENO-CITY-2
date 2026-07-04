const brain = require('./aether-brain');
const rag = require('./aether-rag');
const comprehension = require('./aether-comprehension');
const narrationEngine = require('./aether-narration');

/**
 * AetherAgent: The Master Arbitrator Implementation
 * This is the high-level 'IA codée de 0' that orchestrates
 * comprehension, reasoning, lore, and procedural narration.
 */
class AetherAgent {
    /**
     * Executes the full thinking loop before returning narration.
     */
    async processPlayerTurn(systemPrompt, playerContext, actionText, player, location) {
        console.log(`[Agent] Internal Engine Processing for ${player.name}...`);

        // 1. Semantic Comprehension (IA codée de 0 - Phase 1)
        const intent = comprehension.parse(actionText, player);

        // 2. Lore Retrieval (RAG from scratch - Phase 2)
        const lore = await rag.getLoreContext(actionText, location);

        // 3. Procedural Narration (Billiards of possibilities - Phase 3)
        let narrativeText = narrationEngine.generate(intent, player, actionText, lore);

        // 4. Logic Determination (The Brain)
        const evaluation = brain.evaluateAction(player, actionText);

        // 5. Action Processor (Deterministic Logical Update)
        const updates = [];
        const actions = [];

        // Auto-calculate stat changes based on outcome and intent
        if (intent.primaryIntent === 'COMBAT') {
            if (evaluation.isSuccess) {
                const xpGain = evaluation.isCritical ? 50 : 20;
                updates.push({ playerName: player.name, xp: xpGain, col: 15 });
                if (evaluation.isCritical) narrativeText += "\n\n*COUP CRITIQUE ! Ta puissance déferle avec une violence inouïe.*";
            } else {
                const hpLoss = evaluation.isLethalThreat ? 50 : 10;
                updates.push({ playerName: player.name, hp: -hpLoss, status: ["blessé"] });
                if (evaluation.isLethalThreat) narrativeText += "\n\n*TU ES AUX PORTES DE LA MORT. Le monde s'assombrit...*";
            }
        } else if (intent.primaryIntent === 'MOVEMENT') {
            // Check if movement target is in action text
            const targetLoc = actionText.match(/(?:vers|à|au|la|le)\s+([A-Z][a-z]+)/);
            if (targetLoc) {
                actions.push({ type: 'update_location', parameters: { new_sub_location: targetLoc[1] } });
            }
        } else if (intent.primaryIntent === 'UTILITY') {
            updates.push({ playerName: player.name, hp: 5 }); // Resting or eating
        }

        // Real-time identification update if sexy scene
        if (intent.atmosphere === 'ecchi') {
             updates.push({ playerName: player.name, status: ["excité"] });
        }

        // Return the final formatted JSON
        return JSON.stringify({
            pensee_mj: `Intent: ${intent.primaryIntent}, Success: ${evaluation.isSuccess}, Danger: ${evaluation.dangerLevel}`,
            narrative: narrativeText,
            updates: updates,
            actions: actions,
            imagePrompt: `${actionText}, anime style, ${location}`
        });
    }
}

module.exports = new AetherAgent();
