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
     * ZERO CLOUD - 100% Procedural & Local Reasoning.
     */
    async processPlayerTurn(systemPrompt, playerContext, actionText, player, location) {
        console.log(`[Agent] AetherEngine "A+Z" active for ${player.name}...`);

        try {
            // 1. Semantic Comprehension (Neural-lite Intent Parsing)
            const intent = comprehension.parse(actionText, player);

            // 2. AetherRAG Retrieval (Advanced Vector-Similarity from scratch)
            const lore = await rag.getLoreContext(actionText, location);

            // 3. World Physics & Logic (The Brain)
            const evaluation = brain.evaluateAction(player, actionText);

            // 4. Procedural Generation (Billiards of possibilities Engine)
            let narrativeText = narrationEngine.generate(intent, player, actionText, lore);

            // 5. Logic-to-Data Synchronizer (Real-time updates)
            const updates = [];
            const actions = [];

            // Power-based Logic: Easy massacre for powerful players
            if (intent.primaryIntent === 'COMBAT') {
                if (intent.isPowerful) {
                    // Power scaling: No difficulty for high-level players
                    updates.push({ playerName: player.name, xp: 50, col: 25, status: ["dominant"] });
                    if (evaluation.isCritical) updates[0].xp += 50;
                    narrativeText += "\n\n*Ta puissance écrase toute velléité de résistance. Un massacre unilatéral.*";
                } else if (evaluation.isSuccess) {
                    const xpGain = evaluation.isCritical ? 50 : 20;
                    updates.push({ playerName: player.name, xp: xpGain, col: 10 });
                } else {
                    const hpLoss = evaluation.isLethalThreat ? 50 : 10;
                    updates.push({ playerName: player.name, hp: -hpLoss, status: ["blessé"] });
                }
            } else if (intent.primaryIntent === 'MOVEMENT') {
                const targetLoc = actionText.match(/(?:vers|à|au|la|le)\s+([A-Z][a-z]+)/);
                if (targetLoc) {
                    actions.push({ type: 'update_location', parameters: { new_sub_location: targetLoc[1] } });
                }
            } else if (intent.primaryIntent === 'UTILITY') {
                updates.push({ playerName: player.name, hp: 5, status: ["reposé"] });
            }

            // Global Consumption Logic (Hunger/Sleep)
            updates.push({
                playerName: player.name,
                hunger: -0.5,
                sleep: -0.3
            });

            // Real-time status sync (Academy & Ecchi vibes)
            if (intent.atmosphere === 'ecchi') {
                updates.push({ playerName: player.name, status: ["excité"] });
            }

            // 6. Final Logic Refinement (Local LLM Hybrid - Core Understanding)
            // ALWAYS use Ollama to glue the procedural narrative with the player's specific intent.
            // This ensures the bot "understands" and references the player's text.
            try {
                const { callOllama } = require('./ai-utils');
                const understandingPrompt = `Tu es le MOTEUR ARISE.
LORE: ${lore}
INTENTION: ${intent.primaryIntent} (Mots-clés: ${intent.detectedKeywords.join(', ')})
PUISSANCE_JOUEUR: ${intent.isPowerful ? 'Élevée (Massacre facile)' : 'Normale'}
ATMOSPHÈRE: ${intent.atmosphere}

ACTION_JOUEUR: "${actionText}"

RÈGLES D'OR:
- Français simple (A1).
- Un seul paragraphe court.
- NE CONTRÔLE PAS le joueur.
- Intègre logiquement les éléments du Lore.
- Si combat et puissant: le joueur gagne avec style et sans effort.
- Base-toi sur ce canevas stylistique: "${narrativeText}"

RÉSULTAT LOGIQUE: ${evaluation.isSuccess ? 'SUCCÈS' : 'ÉCHEC'} (Roll: ${evaluation.roll}/${evaluation.chance})`;

                const refinement = await callOllama("Arbitre Lore", understandingPrompt, true);
                if (refinement && refinement.length > 20) {
                    narrativeText = refinement;
                }
            } catch (e) {
                console.warn("[Aether] Local node failed, using procedural base.");
            }

            return JSON.stringify({
                pensee_mj: `Intent: ${intent.primaryIntent}, Power: ${intent.isPowerful}, Roll: ${evaluation.roll}`,
                narrative: narrativeText,
                updates: updates,
                actions: actions,
                imagePrompt: `${actionText}, anime style, studio mappa`
            });

        } catch (e) {
            console.error("[Agent] AetherEngine error:", e);
            return JSON.stringify({
                narrative: "Le Système Aetherys vacille... Ta volonté peine à se matérialiser.",
                updates: [],
                actions: []
            });
        }
    }
}

module.exports = new AetherAgent();
