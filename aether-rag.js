const { NPC, Skill, Kingdom, Item, Quest, sequelize } = require('./database');
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
            kingdoms: [],
            items: [],
            quests: []
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
        const [npcs, skills, kingdoms, items, quests] = await Promise.all([
            NPC.findAll({ attributes: ['name', 'role', 'description', 'specialty', 'location'] }),
            Skill.findAll({ attributes: ['name', 'description', 'type'] }),
            Kingdom.findAll({ attributes: ['name', 'description', 'leader'] }),
            Item.findAll({ attributes: ['name', 'description', 'type', 'price'] }),
            Quest.findAll({ attributes: ['title', 'description', 'objective'] })
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

        this.index.items = items.map(i => ({
            text: `${i.name} ${i.description} ${i.type}`.toLowerCase(),
            ref: i
        }));

        this.index.quests = quests.map(q => ({
            text: `${q.title} ${q.description} ${q.objective}`.toLowerCase(),
            ref: q
        }));

        this.lastUpdate = Date.now();
        console.log(`[RAG] Indexed ${npcs.length} NPCs, ${skills.length} Skills, ${kingdoms.length} Kingdoms, ${items.length} Items, ${quests.length} Quests.`);
    }

    /**
     * Normalizes text by removing stop words and filler
     */
    normalize(text) {
        const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'un', 'une', 'et', 'en', 'à', 'pour', 'dans', 'sur', 'est', 'ai', 'tu', 'je', 'vous', 'nous', 'ce', 'cette', 'mon', 'ma', 'ton', 'ta']);
        return text.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .split(/\s+/)
            .filter(w => w.length > 1 && !stopWords.has(w));
    }

    /**
     * Creates a term frequency vector for cosine similarity
     */
    getVector(words) {
        const vec = {};
        words.forEach(w => vec[w] = (vec[w] || 0) + 1);
        return vec;
    }

    /**
     * Calculates Cosine Similarity between two word vectors (The "A+Z" way)
     */
    calculateSimilarity(vec1, vec2) {
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;

        for (const [word, count] of Object.entries(vec1)) {
            if (vec2[word]) dotProduct += count * vec2[word];
            mag1 += count * count;
        }

        for (const count of Object.values(vec2)) {
            mag2 += count * count;
        }

        if (mag1 === 0 || mag2 === 0) return 0;
        return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
    }

    /**
     * Advanced Score: Combines Vector Similarity and BM25-lite logic
     */
    calculateScore(queryWords, docText) {
        const docWords = this.normalize(docText);
        const queryVec = this.getVector(queryWords);
        const docVec = this.getVector(docWords);

        const similarity = this.calculateSimilarity(queryVec, docVec);
        let bm25 = 0;

        for (const word of queryWords) {
             const count = (docText.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
             if (count > 0) bm25 += (count * 2.5) / (count + 1.5);
        }

        return (similarity * 50) + (bm25 * 5);
    }

    /**
     * Extracts "concepts" from a query to expand search
     */
    expandQuery(query) {
        const concepts = {
            'combat': ['épée', 'sang', 'tue', 'attaque', 'mort', 'frappe', 'arme', 'fer'],
            'magie': ['mana', 'sort', 'incantation', 'éther', 'aura', 'rituel', 'flux'],
            'académie': ['professeur', 'étudiant', 'classe', 'examen', 'école', 'leçon', 'livre'],
            'argent': ['col', 'boutique', 'achat', 'vendre', 'prix', 'banque', 'commerce']
        };

        const words = this.normalize(query);
        const expanded = [...words];
        for (const [key, aliases] of Object.entries(concepts)) {
            if (words.includes(key)) {
                expanded.push(...aliases);
            }
        }
        return [...new Set(expanded)];
    }

    /**
     * Search for relevant lore snippets based on player action/context
     */
    async searchLore(query, location = null, limit = 5) {
        await this.refreshIndex();

        const results = [];
        const queryWords = this.expandQuery(query);

        // 1. Search NPCs
        for (const item of this.index.npcs) {
            let score = this.calculateScore(queryWords, item.text);
            // Boost score if NPC is in the current location
            if (location && item.ref.location && item.ref.location.toLowerCase().includes(location.toLowerCase())) {
                score += 15;
            }
            if (score > 0) results.push({ type: 'NPC', data: item.ref, score });
        }

        // 2. Search Skills
        for (const item of this.index.skills) {
            let score = this.calculateScore(queryWords, item.text);
            if (score > 0) results.push({ type: 'SKILL', data: item.ref, score });
        }

        // 3. Search Kingdoms
        for (const item of this.index.kingdoms) {
            let score = this.calculateScore(queryWords, item.text);
            if (location && item.ref.name.toLowerCase().includes(location.toLowerCase())) {
                score += 20; // Massive boost for current kingdom lore
            }
            if (score > 0) results.push({ type: 'KINGDOM', data: item.ref, score });
        }

        // 4. Search Items
        for (const item of this.index.items) {
            let score = this.calculateScore(queryWords, item.text);
            if (score > 0) results.push({ type: 'ITEM', data: item.ref, score });
        }

        // 5. Search Quests
        for (const item of this.index.quests) {
            let score = this.calculateScore(queryWords, item.text);
            if (score > 0) results.push({ type: 'QUEST', data: item.ref, score });
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
        if (searchResults.length === 0) return "Pas d'infos spéciales.";

        let context = "--- INFOS IMPORTANTES ---\n";

        for (const res of searchResults) {
            if (res.type === 'NPC') {
                context += `[Personne: ${res.data.name}] (${res.data.role}) - ${res.data.description}\n`;
            } else if (res.type === 'SKILL') {
                context += `[Magie: ${res.data.name}] ${res.data.description}\n`;
            } else if (res.type === 'KINGDOM') {
                context += `[Lieu: ${res.data.name}] ${res.data.description}\n`;
            } else if (res.type === 'ITEM') {
                context += `[Objet: ${res.data.name}] ${res.data.description} (Prix: ${res.data.price} COL)\n`;
            } else if (res.type === 'QUEST') {
                context += `[Mission: ${res.data.title}] Faire: ${res.data.objective}\n`;
            }
        }

        return context;
    }
}

module.exports = new AetherRAG();
