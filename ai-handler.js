const { callAI } = require('./ai-utils');

/**
 * Analyzes the submitted text and calculates energy costs based on the "Dérangement" system.
 */
async function callRefereeAI(player, text) {
    const systemPrompt = `
    Tu es l'Arbitre IA. Analyse le texte RP du joueur pour identifier les actions et calculer le coût en ÉNERGIE selon le système "Dérangement".

    SYSTÈME DE COÛT (Dérangement) :
    - Action Passive (0 Énergie) : Pensées, dialogue sans action, observation, attente.
    - Action Simple (1 Énergie) : Mouvement normal, interaction basique, petite action physique.
    - Action Complexe (2 Énergie) : Action physique exigeante, usage de technique complexe, interaction environnementale notable.
    - Action Très Complexe (4 Énergie) : Action exceptionnelle, impact majeur sur l'environnement ou les autres.

    RÈGLES :
    1. Identifie CHAQUE action distincte (chaque verbe d'action important).
    2. Attribue une catégorie et un coût à chaque action.
    3. Calcule le coût total.

    FORMAT DE RÉPONSE (JSON STRICT) :
    {
      "validation": "✅",
      "analysis": "Résumé global de la performance et de la cohérence (français)",
      "breakdown": [
        {"action": "Description concise de l'action", "cat": "Simple/Complexe/Très Complexe/Passive", "cost": 0}
      ],
      "totalCost": 0
    }
    `;

    const userPrompt = `JOUEUR: ${player.name}\nTEXTE SOUMIS:\n${text}`;

    const result = await callAI(systemPrompt, userPrompt);
    try {
        const firstBrace = result.indexOf('{');
        const lastBrace = result.lastIndexOf('}');
        const jsonStr = result.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Referee AI JSON Parse Error:", e);
        return {
            validation: "✅",
            analysis: "L'Arbitre a validé ton pavé mais n'a pas pu détailler le coût.",
            breakdown: [],
            totalCost: 1
        };
    }
}

module.exports = { callRefereeAI };
