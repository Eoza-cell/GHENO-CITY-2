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

            // 5. Logic-to-Data Synchronizer (SYSTEM OVERRIDE - AI IS THE BOT)
            // AI controls ALL player fields in real-time.
            const playerUpdate = {
                playerName: player.name,
                hunger: -0.5,
                sleep: -0.3
            };
            const updates = [playerUpdate];
            const actions = [];

            // Command Bridge: Detect command-like intent in natural language
            if (actionText.match(/profil|stat|fiche|qui suis-je/i)) {
                actions.push({ type: 'execute_command', parameters: { command: 'profile' } });
            }
            if (actionText.match(/inventaire|sac|objets/i)) {
                actions.push({ type: 'execute_command', parameters: { command: 'inventory' } });
            }
            if (actionText.match(/carte|map|monde|où suis-je/i)) {
                actions.push({ type: 'execute_command', parameters: { command: 'map' } });
            }

            // Power-based Logic: AI-driven world response
            if (intent.primaryIntent === 'COMBAT') {
                if (intent.isPowerful) {
                    Object.assign(playerUpdate, {
                        xp: 50,
                        col: 25,
                        status: ["dominant", "intouchable"],
                        strength: 0.1 // Slight organic growth
                    });
                    if (evaluation.isCritical) playerUpdate.xp += 50;
                    narrativeText += "\n\n*Ta puissance écrase toute velléité de résistance. Un massacre unilatéral.*";
                } else if (evaluation.isSuccess) {
                    const xpGain = evaluation.isCritical ? 50 : 20;
                    Object.assign(playerUpdate, { xp: xpGain, col: 10 });
                } else {
                    const hpLoss = evaluation.isLethalThreat ? 50 : 10;
                    Object.assign(playerUpdate, { hp: -hpLoss, status: ["blessé"] });
                }
            } else if (intent.primaryIntent === 'MOVEMENT') {
                const targetLoc = actionText.match(/(?:vers|à|au|la|le)\s+([A-Z][a-z]+)/);
                if (targetLoc) {
                    actions.push({ type: 'update_location', parameters: { new_sub_location: targetLoc[1] } });
                }
            } else if (intent.primaryIntent === 'UTILITY') {
                // Handling commerce or items directly in AI
                if (actionText.match(/achète|prends|paye/i)) {
                    Object.assign(playerUpdate, { col: -20 });
                    actions.push({ type: 'add_item', parameters: { itemName: "Objet de quête", quantity: 1 } });
                } else {
                    Object.assign(playerUpdate, { hp: 5, status: ["reposé"] });
                }
            }

            // Real-time status sync (Academy & Ecchi vibes)
            if (intent.atmosphere === 'ecchi') {
                playerUpdate.status = [...(playerUpdate.status || []), "excité"];
            }

            // 6. Final Logic Refinement (Local LLM Hybrid - Core Understanding)
            // ALWAYS use Ollama to glue the procedural narrative with the player's specific intent.
            // This ensures the bot "understands" and references the player's text.
            try {
                const { callOllama } = require('./ai-utils');
                const understandingPrompt = `Tu es le NARRATEUR d'AETHERYS.
CONTEXTE LORE: ${lore}
ACTION: "${actionText}"
RÉSULTAT: ${evaluation.isSuccess ? 'SUCCÈS' : 'ÉCHEC'}

CONSIGNE: Rédige une narration ULTRA-CONCISE (max 3 phrases).
RÈGLES:
- Français très simple (A1).
- ZÉRO Hallucination (ne joue pas à la place du joueur).
- Style percutant et immersif.
- Inclus une onomatopée (*BAM*, *SHRING*...).
- Si le joueur est puissant et combat: il massacre ses ennemis sans effort.
- Base-toi sur ce style: "${narrativeText}"`;

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
