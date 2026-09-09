const fs = require('fs');
const path = require('path');

/**
 * ATR semantic memory.
 *
 * Transformers is NOT the RP generator here: it only converts text into
 * vectors (embeddings). The RP model receives only the few memories whose
 * vectors are closest to the current player action.
 */

const MODEL = process.env.RAG_EMBEDDING_MODEL || 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const TOP_K = Math.max(1, Math.min(Number(process.env.RAG_TOP_K || 6), 12));
const MAX_CANDIDATES = Math.max(50, Math.min(Number(process.env.RAG_MAX_CANDIDATES || 250), 500));
const CACHE_FILE = path.join(__dirname, 'assets', 'rag-vector-cache.json');

let extractorPromise = null;
const vectorCache = new Map();
const playerIndexes = new Map();
const worldIndex = [];
let cacheLoaded = false;

function clean(text, max = 1800) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return -1;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (!na || !nb) return -1;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function getExtractor() {
    if (!extractorPromise) {
        extractorPromise = (async () => {
            try {
                const { pipeline } = await import('@huggingface/transformers');
                console.log(`[RAG] Loading Transformers embedding model: ${MODEL}`);
                return await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
            } catch (err) {
                console.error('[RAG] Transformers embedding model unavailable:', err.message);
                extractorPromise = null;
                return null;
            }
        })();
    }
    return extractorPromise;
}

async function embed(text) {
    const value = clean(text);
    if (!value) return null;
    const key = value.toLowerCase();
    if (vectorCache.has(key)) return vectorCache.get(key);

    const extractor = await getExtractor();
    if (!extractor) return null;

    try {
        const output = await extractor(value, { pooling: 'mean', normalize: true });
        const raw = output?.tolist?.();
        const vector = Array.isArray(raw?.[0]) ? raw[0] : raw;
        if (!Array.isArray(vector) || vector.length < 32) return null;
        const compact = vector.map(Number);
        vectorCache.set(key, compact);
        return compact;
    } catch (err) {
        console.warn('[RAG] Embedding failed:', err.message);
        return null;
    }
}

function loadDiskCache() {
    if (cacheLoaded) return;
    cacheLoaded = true;
    try {
        if (!fs.existsSync(CACHE_FILE)) return;
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        for (const [key, vector] of Object.entries(data || {})) {
            if (Array.isArray(vector)) vectorCache.set(key, vector);
        }
        console.log(`[RAG] Loaded ${vectorCache.size} cached embeddings from disk.`);
    } catch (err) {
        console.warn('[RAG] Could not load vector cache:', err.message);
    }
}

function saveDiskCache() {
    try {
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        const entries = [...vectorCache.entries()].slice(-1500);
        fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(entries)));
    } catch (err) {
        // Render filesystems can be ephemeral/read-only; Upstash remains authoritative.
        console.warn('[RAG] Vector cache is not writable:', err.message);
    }
}

function addToIndex(index, item) {
    const existing = index.findIndex(x => x.id === item.id);
    if (existing >= 0) index[existing] = item;
    else index.unshift(item);
    if (index.length > MAX_CANDIDATES) index.length = MAX_CANDIDATES;
}

function playerIndex(playerId) {
    const key = String(playerId || 'unknown');
    if (!playerIndexes.has(key)) playerIndexes.set(key, []);
    return playerIndexes.get(key);
}

async function indexMemory(memory, scope = 'world') {
    loadDiskCache();
    if (!memory?.summary && !memory?.action && !memory?.entry) return false;

    const text = clean(memory.text || memory.summary || memory.action || memory.entry);
    if (!text) return false;
    const vector = await embed(text);
    if (!vector) return false;

    const item = {
        id: String(memory.id || `${memory.at || Date.now()}-${text.slice(0, 40)}`),
        text,
        vector,
        playerId: memory.playerId ? String(memory.playerId) : null,
        playerName: memory.playerName || null,
        location: memory.location || null,
        subLocation: memory.subLocation || null,
        at: memory.at || new Date().toISOString()
    };

    if (scope === 'player' && memory.playerId) addToIndex(playerIndex(memory.playerId), item);
    else addToIndex(worldIndex, item);
    saveDiskCache();
    return true;
}

function extractPromptContext(prompt) {
    const text = String(prompt || '');
    const player = text.match(/JOUEUR ACTIF\s*:\s*[\s\S]*?-\s*Nom\s*:\s*([^\n]+)/i)?.[1]?.trim() || null;
    const location = text.match(/POSITION OFFICIELLE\s*:[\s\S]*?-\s*Royaume \/ Région\s*:\s*([^\n]+)/i)?.[1]?.trim() || null;
    const subLocation = text.match(/POSITION OFFICIELLE\s*:[\s\S]*?-\s*Sous-Lieu\s*:\s*([^\n]+)/i)?.[1]?.trim() || null;
    const playerId = text.match(/WHATSAPP(?:ID| ID)?\s*:\s*([^\n]+)/i)?.[1]?.trim() || null;
    return { player, location, subLocation, playerId };
}

async function retrieve(prompt, options = {}) {
    loadDiskCache();
    const queryText = clean(options.query || prompt, 3500);
    const queryVector = await embed(queryText);
    if (!queryVector) return [];

    const ctx = extractPromptContext(prompt);
    const candidates = [];
    if (ctx.playerId) candidates.push(...playerIndex(ctx.playerId));
    else {
        // When the caller does not expose the DB id, keep player separation by
        // matching the active character's name from indexed metadata.
        for (const index of playerIndexes.values()) {
            for (const item of index) if (!ctx.player || item.playerName === ctx.player) candidates.push(item);
        }
    }
    candidates.push(...worldIndex);

    const unique = new Map();
    for (const item of candidates) unique.set(item.id, item);

    return [...unique.values()]
        .map(item => {
            let score = cosine(queryVector, item.vector);
            if (ctx.location && item.location === ctx.location) score += 0.035;
            if (ctx.subLocation && item.subLocation === ctx.subLocation) score += 0.06;
            if (ctx.player && item.playerName === ctx.player) score += 0.08;
            return { ...item, score };
        })
        .filter(x => x.score >= Number(process.env.RAG_MIN_SCORE || 0.30))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K);
}

function formatResults(results) {
    if (!results?.length) return '';
    return [
        '=== 🧠 MÉMOIRE SÉMANTIQUE RAG (TRANSFORMERS) ===',
        'Les souvenirs ci-dessous ont été sélectionnés par proximité sémantique avec l’action actuelle.',
        'Ils sont des rappels narratifs, jamais une source pour modifier les statistiques ou la position officielle.',
        ...results.map((r, i) => `- [${i + 1}] score=${r.score.toFixed(3)} | ${r.location || '?'} > ${r.subLocation || '?'} | ${r.text}`)
    ].join('\n');
}

async function retrieveFormatted(prompt, options = {}) {
    try {
        return formatResults(await retrieve(prompt, options));
    } catch (err) {
        console.warn('[RAG] Retrieval failed:', err.message);
        return '';
    }
}

module.exports = {
    embed,
    indexMemory,
    retrieve,
    retrieveFormatted,
    formatResults,
    stats: () => ({ cachedEmbeddings: vectorCache.size, playerIndexes: playerIndexes.size, worldMemories: worldIndex.length })
};
