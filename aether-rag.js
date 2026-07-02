const { NPC, Skill, Kingdom, sequelize } = require('./database');
const { Op } = require('sequelize');

/**
 * Aetherys RAG (Retrieval-Augmented Generation) System
 * Built from scratch to handle lore retrieval without heavy vector DBs.
 * Uses weighted keyword search and context-aware ranking.
 */

class AetherRAG {
    constructor() {
        this.cache = new Map();
        this.index = {
            npcs: [],
            skills: [],
            kingdoms: []
        };
        this.lastUpdate = 0;
        this.updateInterval = 1000 * 60 * 30; // 30 minutes
    }

    /**
     * Build or refresh the internal search index
     */
    async refreshIndex() {
        if (Date.now() - this.lastUpdate < this.updateInterval && this.index.npcs.length > 0) return;

        console.log("[RAG] Refreshing Lore Index...");

        // Fetch key data for indexing
        const [npcs, skills, kingdoms] = await Promise.all([
            NPC.findAll({ attributes: ['name', 'role', 'description', 'specialty', 'location'] }),
            Skill.findAll({ attributes: ['name', 'description', 'type'] }),
            Kingdom.findAll({ attributes: ['name', 'description', 'leader'] })
        ]);

        this.index.npcs = npcs.map(n => ({
            text: `${n.name} ${n.role} ${n.description} ${n.specialty} ${n.location}`.toLowerCase(),
            ref: n
        }));

        this.index.skills = skills.map(s => ({
            text: `${s.name} ${s.description} ${s.type}`.toLowerCase(),
            ref: s
        }));

        this.index.kingdoms = kingdoms.map(k => ({
            text: `${k.name} ${k.description} ${k.leader}`.toLowerCase(),
            ref: k
        }));

        this.lastUpdate = Date.now();
        console.log(`[RAG] Indexed ${npcs.length} NPCs, ${skills.length} Skills, ${kingdoms.length} Kingdoms.`);
    }

    /**
     * Simple TF-IDF inspired keyword scoring
     */
    calculateScore(query, docText) {
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        let score = 0;

        for (const word of words) {
            // Exact match (high weight)
            if (docText.includes(` ${word} `) || docText.startsWith(`${word} `) || docText.endsWith(` ${word}`)) {
                score += 10;
            } else if (docText.includes(word)) {
                // Partial match
                score += 2;
            }
        }
        return score;
    }

    /**
     * Search for relevant lore snippets based on player action/context
     */
    async searchLore(query, location = null, limit = 5) {
        await this.refreshIndex();

        const results = [];
        const lowQuery = query.toLowerCase();

        // 1. Search NPCs
        for (const item of this.index.npcs) {
            let score = this.calculateScore(lowQuery, item.text);
            // Boost score if NPC is in the current location
            if (location && item.ref.location && item.ref.location.toLowerCase().includes(location.toLowerCase())) {
                score += 15;
            }
            if (score > 0) results.push({ type: 'NPC', data: item.ref, score });
        }

        // 2. Search Skills
        for (const item of this.index.skills) {
            let score = this.calculateScore(lowQuery, item.text);
            if (score > 0) results.push({ type: 'SKILL', data: item.ref, score });
        }

        // 3. Search Kingdoms
        for (const item of this.index.kingdoms) {
            let score = this.calculateScore(lowQuery, item.text);
            if (location && item.ref.name.toLowerCase().includes(location.toLowerCase())) {
                score += 20; // Massive boost for current kingdom lore
            }
            if (score > 0) results.push({ type: 'KINGDOM', data: item.ref, score });
        }

        // Sort by score and return top results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Format search results into a concise string for the AI prompt
     */
    async getLoreContext(query, location = null) {
        const searchResults = await this.searchLore(query, location);
        if (searchResults.length === 0) return "Aucun détail historique spécifique trouvé dans les archives pour cette action.";

        let context = "--- ARCHIVES D'AETHERYS (LORE PERTINENT) ---\n";

        for (const res of searchResults) {
            if (res.type === 'NPC') {
                context += `[PNJ: ${res.data.name}] (${res.data.role}) - ${res.data.description} (Localisation habituelle: ${res.data.location})\n`;
            } else if (res.type === 'SKILL') {
                context += `[TECHNIQUE: ${res.data.name}] Type: ${res.data.type}. ${res.data.description}\n`;
            } else if (res.type === 'KINGDOM') {
                context += `[ROYAUME: ${res.data.name}] Dirigeant: ${res.data.leader}. ${res.data.description}\n`;
            }
        }

        return context;
    }
}

module.exports = new AetherRAG();
