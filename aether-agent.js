const aether = require('./aether-core');
const brain = require('./aether-brain');

/**
 * AetherAgent: The Master Arbitrator Implementation
 * This is the high-level 'AI coded from scratch' that orchestrates
 * reasoning, lore, and world physics.
 */
class AetherAgent {
    /**
     * Executes the full thinking loop before returning narration.
     */
    async processPlayerTurn(systemPrompt, playerContext, actionText, player, location) {
        console.log(`[Agent] Thinking loop started for ${player.name}...`);

        // 1. Internal Logical Analysis (The Brain)
        // Evaluate the action against world physics and rank
        const evaluation = brain.evaluateAction(player, actionText);

        // 2. Pre-Reasoning context injection
        const logicHeader = `### ANALYSE DU SYSTÈME (STRICT) ###
RÉSULTAT_DÉS: ${evaluation.roll}/${evaluation.chance}
RÉUSSITE_LOGIQUE: ${evaluation.isSuccess ? 'OUI' : 'NON'}
RANG_VALIDE: ${evaluation.rankValid ? 'OUI' : 'NON (Action trop puissante pour ce rang)'}
CRITIQUE: ${evaluation.isCritical ? 'OUI' : 'NON'}

SI RÉUSSITE_LOGIQUE est NON, tu DOIS faire échouer l'action du joueur dans ton texte.
SI RANG_VALIDE est NON, le joueur doit subir une conséquence grave (blessure, humiliation).
`;

        // 3. Narrative Generation (The Core Brain)
        // This calls the context-augmented inference
        const fullSystemPrompt = `${systemPrompt}\n\n${logicHeader}`;

        try {
            const narration = await aether.generateNarration(fullSystemPrompt, playerContext, actionText, location);
            console.log(`[Agent] Narration generated successfully.`);
            return narration;
        } catch (error) {
            console.error("[Agent] Thinking loop failed:", error);
            throw error;
        }
    }
}

module.exports = new AetherAgent();
