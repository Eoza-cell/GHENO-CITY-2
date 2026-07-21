const { callAI } = require('./ai-utils');
const { Player, Skill } = require('./database');

/**
 * ARBITRE SUPRÊME D'AETHERYS
 * A specialized intelligence for judging complex roleplay actions.
 */
class RefereeLogic {
    async judge(actionText, context = {}) {
        const { attacker, defender, environment } = context;

        const systemPrompt = `TU ES L'ARBITRE SUPRÊME D'AETHERYS.
Ton intelligence est absolue, analytique et créative. Tu ne juges pas de manière linéaire, mais tu évalues la SYNERGIE entre l'intention, les statistiques et la narration.

TES CRITÈRES D'ANALYSE :
1. INTENTION (Ce que le joueur veut accomplir) : Est-ce stratégique ? Est-ce créatif ?
2. EXÉCUTION (La qualité du pavé) : La précision technique, le réalisme des mouvements, la fluidité narrative.
3. LOGIQUE STATISTIQUE : Utilise les stats fournies comme base de probabilité, mais laisse la créativité surpasser un écart de stats si l'action est brillante.
4. CONSÉQUENCES : Déduis les dommages physiques, psychologiques et environnementaux.

FORMAT DE RÉPONSE JSON :
{
    "verdict": "RÉUSSITE TOTALE | RÉUSSITE PARTIELLE | ÉCHEC | ÉCHEC CRITIQUE",
    "analyse_tactique": "...",
    "intentions_comprises": "...",
    "consequences_directes": "...",
    "raisons_du_verdict": "...",
    "degats_estimes": { "pv": -10, "pm": -5, "stamina": -5 },
    "score_creativite": "0-100"
}`;

        const attackerStats = attacker ? `${attacker.name} (Niv ${attacker.level}, Rang ${attacker.rank}, FOR:${attacker.strength}, AGI:${attacker.agility}, INT:${attacker.intelligence})` : "Inconnu";
        const defenderStats = defender ? `${defender.name} (Niv ${defender.level}, Rang ${defender.rank}, FOR:${defender.strength}, AGI:${defender.agility}, INT:${defender.intelligence})` : "Environnement/Inconnu";

        const userPrompt = `### ACTION À JUGER ###
JOUEUR: ${attacker?.name || "Héritier"}
TEXTE: "${actionText}"

### CONTEXTE DU DUEL ###
ATTAQUANT: ${attackerStats}
DÉFENSEUR: ${defenderStats}
LIEU: ${environment || "Inconnu"}

Analyse les intentions cachées derrière les mots et rends un verdict sans pitié mais juste.`;

        try {
            const rawResponse = await callAI(systemPrompt, userPrompt);
            if (!rawResponse) throw new Error("Silence de l'Arbitre.");

            // Extract JSON
            const start = rawResponse.indexOf('{');
            const end = rawResponse.lastIndexOf('}');
            if (start === -1 || end === -1) throw new Error("Verdict illisible.");

            return JSON.parse(rawResponse.substring(start, end + 1));
        } catch (e) {
            console.error("[REF] Error:", e.message);
            return { verdict: "INCERTAIN", analyse_tactique: "Le flux du destin est brouillé.", score_creativite: "0" };
        }
    }
}

const referee = new RefereeLogic();
module.exports = referee;
