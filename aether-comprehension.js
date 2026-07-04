/**
 * AetherComprehension: Semantic Intent Parser
 * Part of the "IA codé de 0" Aetherys stack.
 * Analyzes player actions without cloud dependency for core intent detection.
 */

class AetherComprehension {
    constructor() {
        this.intents = {
            COMBAT: ["attaque", "frappe", "tue", "combat", "épée", "magie", "sort", "lance", "dague", "coupe", "sang", "détruit", "brise"],
            MOVEMENT: ["va", "vers", "entre", "sort", "marche", "court", "dirige", "déplace", "quitte", "arrive", "explore"],
            SOCIAL: ["parle", "dis", "demande", "salue", "regarde", "observe", "aide", "donne", "échange"],
            ACADEMY: ["académie", "école", "étudie", "cours", "examen", "professeur", "élève", "classe", "bibliothèque", "lycée"],
            NSFW: ["sexy", "nu", "poitrine", "regard", "rougit", "ecchi", "sexy", "sous-vêtement", "douche", "bain", "proche", "peau"],
            UTILITY: ["inventaire", "sac", "banque", "argent", "stat", "profil", "objet", "utilise", "mange", "dort"]
        };

        this.entities = {
            MONSTERS: ["gobelin", "loup", "orque", "spectre", "chimère", "dragon", "roi", "liche", "golem"],
            NPCS: ["griffith", "void", "orpheon", "magnus", "valerius", "seraphina", "lucian", "erius", "lukas", "maya", "sora", "lila", "kaelith", "vrax", "uriel"]
        };
    }

    /**
     * Extracts intent and relevant data from action text.
     */
    parse(text, player) {
        const lowText = text.toLowerCase();
        const results = {
            primaryIntent: 'SOCIAL',
            confidence: 0,
            targets: [],
            detectedKeywords: [],
            isPowerful: player.level > 20 || player.rank === 'S' || player.rank === 'A',
            atmosphere: 'normal'
        };

        // 1. Keyword detection and intent scoring
        const scores = {};
        for (const [intent, keywords] of Object.entries(this.intents)) {
            scores[intent] = 0;
            for (const kw of keywords) {
                if (lowText.includes(kw)) {
                    scores[intent] += 1;
                    results.detectedKeywords.push(kw);
                }
            }
        }

        // 2. Select primary intent
        const sortedIntents = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        if (sortedIntents[0][1] > 0) {
            results.primaryIntent = sortedIntents[0][0];
            results.confidence = sortedIntents[0][1];
        }

        // 3. Target detection (NPCs and Monsters)
        for (const [group, list] of Object.entries(this.entities)) {
            for (const ent of list) {
                if (lowText.includes(ent)) {
                    results.targets.push({ name: ent, type: group });
                }
            }
        }

        // 4. Special Contextual detection
        if (lowText.includes('?')) results.isQuestion = true;
        if (lowText.match(/!{2,}/)) results.isIntense = true;

        // 5. Atmosphere check (Academy Chill vs Brutal)
        if (player.subLocation.toLowerCase().includes('académie') || player.subLocation.toLowerCase().includes('école')) {
            results.atmosphere = 'academy';
        }
        if (results.primaryIntent === 'NSFW') {
            results.atmosphere = 'ecchi';
        }

        return results;
    }
}

module.exports = new AetherComprehension();
