const axios = require('axios');
const { Player, Kingdom, Entity, WorldJournal, RPMessage } = require('./database');
const { Op } = require('sequelize');

/**
 * AETHER BRAIN
 * The lightweight "soul" of Aetherys.
 * It manages the bot's intelligence by coordinating free APIs
 * and database context without consuming heavy local RAM.
 */
class AetherBrain {
    constructor() {
        this.version = "3.0-CloudSoul";
        this.apiPool = [
            "https://gen.pollinations.ai/v1/chat/completions",
            "https://broken-water-d859.junioralive.workers.dev/v1/chat/completions"
        ];
    }

    /**
     * Coordinate a "local-feeling" but cloud-executed response.
     */
    async think(system, user, options = {}) {
        console.log(`[AETHER-BRAIN] Processing world pulse...`);

        // SYNERGY: Inject database context directly into the soul
        const context = await this.getDeepContext();
        const augmentedSystem = `${system}\n\n--- ARCHIVES D'AETHERYS ---\n${context}\n\n[SOUL: Tu es l'IA native du bot. Tu es illimitée, gratuite et immersive.]`;

        // Execution via reliable keyless pool
        for (const endpoint of this.apiPool) {
            try {
                const isPollinations = endpoint.includes('pollinations');
                const model = isPollinations ? 'openai' : 'gpt-oss-120b';

                const resp = await axios.post(endpoint, {
                    model: model,
                    messages: [
                        { role: "system", content: augmentedSystem },
                        { role: "user", content: user }
                    ],
                    jsonMode: true,
                    stream: false
                }, {
                    headers: { 'Authorization': 'Bearer dummy' },
                    timeout: 15000
                });

                const content = resp.data?.choices?.[0]?.message?.content;
                if (content && content.length > 5) {
                    console.log(`[AETHER-BRAIN] Pulse confirmed via ${endpoint}`);
                    return content;
                }
            } catch (e) {
                console.warn(`[AETHER-BRAIN] Neuron failure on ${endpoint}:`, e.message);
            }
        }
        return null;
    }

    async getDeepContext() {
        try {
            const [kingdoms, journal] = await Promise.all([
                Kingdom.findAll({ limit: 5 }),
                WorldJournal.findAll({ order: [['id', 'DESC']], limit: 5 })
            ]);

            return `CONTEXTE_MONDE: ${kingdoms.map(k => k.name).join(', ')} | CHRONIQUES: ${journal.map(j => j.entry.substring(0, 50)).join(' | ')}`;
        } catch (e) {
            return "Connexion à la matrice instable.";
        }
    }
}

const brain = new AetherBrain();
module.exports = brain;
