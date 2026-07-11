const engine = require('./aether-engine');
const { WorldJournal, Kingdom, Entity, Skill } = require('./database');
const { Op } = require('sequelize');

/**
 * AETHER WEAVER
 * The training and immersion layer.
 * It 'teaches' the local model by injecting core lore.
 */
class AetherWeaver {
    constructor() {
        this.loreCache = "";
    }

    /**
     * "Training" step: Ingest database world-building into context
     */
    async ingestWorldKnowledge() {
        console.log(`[WEAVER] Ingesting Aetherys chronicles...`);
        try {
            const [kingdoms, entities, skills] = await Promise.all([
                Kingdom.findAll({ limit: 10 }),
                Entity.findAll({ limit: 5 }),
                Skill.findAll({ limit: 10 })
            ]);

            this.loreCache = `
--- WORLD DATA (AETHERYS) ---
ROYAUMES: ${kingdoms.map(k => k.name).join(', ')}
PACTES: ${entities.map(e => e.name).join(', ')}
POUVOIRS: ${skills.map(s => s.name).join(', ')}
---------------------------
`;
            console.log(`[WEAVER] Lore synchronized.`);
        } catch (e) {
            console.warn(`[WEAVER] Lore ingestion incomplete:`, e.message);
        }
    }

    /**
     * Weave a response using local engine + world immersion
     */
    async weave(system, user, options = {}) {
        if (!this.loreCache) await this.ingestWorldKnowledge();

        // Enforce the MJ d'Aetherys persona
        const immersionSystem = `${system}\n\n${this.loreCache}\n[INSTRUCTION: You are the local soul of Aetherys. Your narration is visceral, sensory, and follows strict causality. Respond in valid JSON.]`;

        const messages = [
            { role: 'system', content: immersionSystem },
            { role: 'user', content: user }
        ];

        let result = await engine.generate(messages, options);

        if (!result) return null;

        // Post-processing for beauty and formatting
        if (!result.startsWith('{')) {
            // Attempt to wrap in JSON if model failed format but gave good text
            result = JSON.stringify({
                narrative: result,
                actions: []
            });
        }

        return result;
    }
}

const weaver = new AetherWeaver();
module.exports = weaver;
