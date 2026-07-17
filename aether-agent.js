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
     * ZERO KEY - 100% Procedural & Neural-Matrix Hybrid.
     */
    async processPlayerTurn(systemPrompt, playerContext, actionText, player, location) {
        console.log(`[Agent] Aether-Matrix "Gemma 3" active for ${player.name}...`);

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

            // Command Bridge disabled: AI responds only in action mode.

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

            // 6. Final Logic Refinement (Neural Matrix Hybrid - Core Understanding)
            // ALWAYS use the Matrix (Pollinations) to glue the procedural narrative with the player's specific intent.
            // This ensures the bot "understands" and references the player's text.
            try {
                const { callAI } = require('./ai-utils');
                const understandingPrompt = `Tu es le SYSTÈME AETHERYS (Noyau Gemma 3).
CONTEXTE LORE: ${lore}
ACTION DU JOUEUR: "${actionText}"
RÉSULTAT LOGIQUE: ${evaluation.isSuccess ? 'SUCCÈS' : 'ÉCHEC'}
DÉTERMINATION: ${intent.isPowerful ? 'DOMINATION TOTALE' : 'NORMAL'}

CONSIGNE: Rédige une narration ULTRA-CONCISE (max 3 phrases).
RÈGLES:
- Français très simple (A1).
- ZÉRO Hallucination (ne joue pas à la place du joueur).
- Style percutant et immersif.
- Inclus une onomatopée (*BAM*, *SHRING*...).
- Si domination: le joueur écrase ses ennemis sans effort.
- Applique les changements de statut.

Base-toi sur ce canevas pour le style: "${narrativeText}"`;

                const refinement = await callAI("Arbitre Lore", understandingPrompt);
                if (refinement && refinement.length > 20 && !refinement.includes("FALLBACK")) {
                    narrativeText = refinement;
                }
            } catch (e) {
                console.warn("[Aether] Matrix refinement failed, using procedural base.");
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
