/**
 * Node preload bridge for ATR semantic RAG.
 * This keeps the existing ai-handler/ai-utils architecture intact: callAI is
 * wrapped before ai-handler imports it, so no provider implementation needs to
 * know anything about embeddings.
 */

const Module = require('module');
const originalLoad = Module._load;
const rag = require('./rag-memory');

let synced = false;
let syncPromise = null;

async function syncRecentUpstash() {
    if (synced || syncPromise) return syncPromise;
    syncPromise = (async () => {
        try {
            const { Redis } = require('@upstash/redis');
            if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
                synced = true;
                return;
            }
            const redis = Redis.fromEnv();
            const rows = await redis.lrange('atr:memory:v1:world:events', 0, 39);
            let count = 0;
            for (const row of rows || []) {
                let event = row;
                if (typeof row === 'string') {
                    try { event = JSON.parse(row); } catch { continue; }
                }
                if (!event) continue;
                const ok = await rag.indexMemory({
                    id: event.id || `${event.at || ''}-${event.playerId || ''}-${event.summary || event.action || ''}`,
                    text: event.summary || event.action || event.entry,
                    playerId: event.playerId,
                    playerName: event.playerName,
                    location: event.location,
                    subLocation: event.subLocation,
                    at: event.at
                }, 'world');
                if (ok) count++;
            }
            console.log(`[RAG] Startup sync: ${count} recent semantic memories indexed.`);
            synced = true;
        } catch (err) {
            console.warn('[RAG] Startup Upstash sync skipped:', err.message);
            synced = true;
        } finally {
            syncPromise = null;
        }
    })();
    return syncPromise;
}

Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);
    if (request !== './ai-utils' && !request.endsWith('/ai-utils')) return loaded;
    if (!loaded || typeof loaded.callAI !== 'function' || loaded.__atrRagWrapped) return loaded;

    const originalCallAI = loaded.callAI;
    const wrapped = async function callAIWithSemanticRAG(systemPrompt, userPrompt, options = {}) {
        await syncRecentUpstash();

        const ragText = await rag.retrieveFormatted(userPrompt, {
            query: options.playerAction || userPrompt
        });

        if (!ragText) return originalCallAI(systemPrompt, userPrompt, options);

        const augmentedSystem = `${systemPrompt}\n\n${ragText}`;
        return originalCallAI(augmentedSystem, userPrompt, options);
    };

    Object.assign(wrapped, { __atrRagWrapped: true });
    loaded.callAI = wrapped;
    console.log('[RAG] ✅ Transformers semantic retrieval attached to callAI.');
    return loaded;
};
