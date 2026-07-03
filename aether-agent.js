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
        const logicHeader = `### ANALYSE DU SYSTÈME (SANS PITIÉ) ###
DÉTERMINATION_SYSTÈME: Tu DOIS suivre les résultats ci-dessous. Le MJ ne peut pas contredire le moteur de jeu.

RÉSULTAT_DÉS: ${evaluation.roll}/${evaluation.chance}
RÉUSSITE_LOGIQUE: ${evaluation.isSuccess ? 'OUI' : 'NON'}
RANG_VALIDE: ${evaluation.rankValid ? 'OUI' : 'NON'}
CRITIQUE: ${evaluation.isCritical ? 'OUI' : 'NON'}
NIVEAU_DANGER: ${evaluation.dangerLevel}/100
MENACE_LÉTALE: ${evaluation.isLethalThreat ? 'OUI (Le joueur peut mourir ici)' : 'NON'}

RÈGLES D'EXÉCUTION :
1. SI RÉUSSITE_LOGIQUE est NON : L'action échoue. Si le danger est haut, le joueur est blessé.
2. SI RANG_VALIDE est NON : Le joueur est puni violemment par le monde (il n'est rien).
3. SI MENACE_LÉTALE est OUI : N'hésite pas à tuer le joueur ou à le laisser mourant (HP à 0).
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
