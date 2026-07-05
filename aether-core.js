const { callAI } = require('./ai-utils');
const rag = require('./aether-rag');
const { getRPTime } = require('./world-clock');

/**
 * AetherCore: The Master Brain of Aetherys
 * Orchestrates RAG, World State, and AI Inference.
 */
class AetherCore {
    /**
     * Enhanced inference that injects lore context based on the situation.
     */
    async generateNarration(systemPrompt, playerContext, actionText, location) {
        console.log(`[AetherCore] Processing action for situation at ${location}...`);

        // 1. Retrieve relevant Lore from RAG
        const loreContext = await rag.getLoreContext(actionText, location);

        // 2. Get current world time/cycle
        const timeState = await getRPTime();
        const ethericHeader = `### INFOS MONDE ###
TEMPS: ${timeState.formatted}
MOMENT: ${timeState.isDay ? 'JOUR' : 'NUIT'}
${loreContext}
`;

        // 3. Construct the Final Augmented Prompt
        const augmentedPrompt = `${ethericHeader}\n\n${playerContext}`;

        // 4. Trigger the Parallel Race Inference
        try {
            const result = await callAI(systemPrompt, augmentedPrompt);
            return result;
        } catch (error) {
            console.error("[AetherCore] Inference failed:", error);
            // Fallback is handled by callAI itself (MJ Fallback)
            throw error;
        }
    }

    /**
     * Pre-process actions to add "flavor" before narration if needed
     */
    async enrichContext(player, aggregatedActions) {
        // Logic to add status effects, player vibes, etc.
        return aggregatedActions;
    }
}

module.exports = new AetherCore();
