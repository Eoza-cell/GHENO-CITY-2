const http = require('http');
const axios = require('axios');
const { Player, NPC, Kingdom, WorldJournal, RPMessage, Conflict } = require('./database');
const { Op } = require('sequelize');

const PORT = process.env.MODEL_PORT || 3001;
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';

/**
 * GHENO CITY 2.0 - Gemma 3 World Intelligence Server
 *
 * Ce serveur est le cerveau central du jeu ARISE. Il utilise Gemma 3
 * via Ollama pour générer des réponses immersives en tant que Maître du Jeu.
 *
 * Endpoint: POST /v1/chat/completions (compatible OpenAI)
 *
 * Pour démarrer:
 *   1. Installer Ollama: https://ollama.com
 *   2. Télécharger Gemma 3: ollama pull gemma3:4b
 *   3. Démarrer ce serveur: npm run server
 */

/**
 * Vérifie si Ollama est accessible et si le modèle Gemma 3 est disponible
 */
async function checkOllamaHealth() {
    try {
        const resp = await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
        const models = resp.data?.models || [];
        const targetModel = models.find(m => m.name.includes(OLLAMA_MODEL.split(':')[0]));

        if (targetModel) {
            console.log(`[MODEL-SERVER] ✅ Modèle local détecté: ${targetModel.name}`);
            console.log(`[MODEL-SERVER]    Taille: ${(targetModel.size / 1e9).toFixed(2)} GB`);
            console.log(`[MODEL-SERVER]    Format: ${targetModel.details?.format || 'N/A'}`);
            console.log(`[MODEL-SERVER]    Famille: ${targetModel.details?.family || 'N/A'}`);
            return true;
        } else {
            console.warn(`[MODEL-SERVER] ⚠️ Modèle ${OLLAMA_MODEL} non trouvé dans Ollama.`);
            console.warn(`[MODEL-SERVER]    Modèles disponibles: ${models.map(m => m.name).join(', ')}`);
            console.warn(`[MODEL-SERVER]    Exécutez: ollama pull ${OLLAMA_MODEL}`);
            return false;
        }
    } catch (err) {
        console.error(`[MODEL-SERVER] ❌ Ollama non accessible sur ${OLLAMA_URL}`);
        console.error(`[MODEL-SERVER]    Erreur: ${err.message}`);
        console.error(`[MODEL-SERVER]    Vérifiez qu'Ollama est démarré: ollama serve`);
        return false;
    }
}

/**
 * Appelle Gemma 3 via Ollama avec le contexte du monde
 */
async function callGemma3(systemPrompt, userPrompt) {
    const startTime = Date.now();

    try {
        console.log(`[MODEL-SERVER] 🧠 Appel ${OLLAMA_MODEL}...`);

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        const headers = {
            'Content-Type': 'application/json'
        };

        if (OLLAMA_API_KEY) {
            headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;
        }

        const resp = await axios.post(`${OLLAMA_URL}/api/chat`, {
            model: OLLAMA_MODEL,
            messages: messages,
            stream: false,
            format: 'json',
            options: {
                temperature: 0.85,
                num_predict: 2048,
                num_ctx: 16384,
                top_p: 0.9,
                top_k: 40,
                repeat_penalty: 1.1
            }
        }, {
            headers,
            timeout: 120000
        });

        const content = resp.data?.message?.content || resp.data?.response;
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (content) {
            console.log(`[MODEL-SERVER] ✅ Réponse reçue en ${duration}s (${content.length} chars)`);
            return content;
        } else {
            console.warn(`[MODEL-SERVER] ⚠️ Réponse vide d'Ollama`);
            console.warn(`[MODEL-SERVER]    Réponse brute:`, JSON.stringify(resp.data).substring(0, 500));
            return null;
        }
    } catch (err) {
        console.error(`[MODEL-SERVER] ❌ Erreur Ollama:`, err.response?.data || err.message);
        return null;
    }
}

/**
 * Récupère le contexte enrichi du monde depuis la base de données
 */
async function getWorldContext() {
    try {
        const [journal, activePlayers, totalNpcs, topPlayer, activeConflicts, totalCol, topKingdom] = await Promise.all([
            WorldJournal.findAll({ order: [['id', 'DESC']], limit: 40 }),
            Player.count({ where: { lastActivity: { [Op.gt]: new Date(Date.now() - 3600000) } } }),
            NPC.count(),
            Player.findOne({ order: [['level', 'DESC'], ['xp', 'DESC']] }),
            Conflict.count({ where: { status: 'active' } }),
            Player.sum('col'),
            Kingdom.findOne({ order: [['influence', 'DESC']] })
        ]);

        const journalContext = journal.map(j => `[${j.category.toUpperCase()}] ${j.entry}`).join('\n');

        return {
            activePlayers,
            totalNpcs,
            activeConflicts,
            totalCol: totalCol || 0,
            topKingdom: topKingdom ? { name: topKingdom.name, influence: topKingdom.influence } : { name: "Empire d'Elion", influence: 100 },
            topPlayer: topPlayer ? { name: topPlayer.name, level: topPlayer.level } : { name: 'Aucun', level: 0 },
            journalContext
        };
    } catch (err) {
        console.error('[MODEL-SERVER] Erreur récupération contexte monde:', err.message);
        return {
            activePlayers: 0,
            totalNpcs: 0,
            activeConflicts: 0,
            totalCol: 0,
            topKingdom: { name: "Empire d'Elion", influence: 100 },
            topPlayer: { name: 'Aucun', level: 0 },
            journalContext: ''
        };
    }
}

/**
 * Crée le serveur HTTP avec l'API compatible OpenAI
 */
const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check endpoint
    if (req.method === 'GET' && req.url === '/health') {
        const ollamaHealthy = await checkOllamaHealth();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: ollamaHealthy ? 'healthy' : 'degraded',
            model: OLLAMA_MODEL,
            ollama_url: OLLAMA_URL,
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Info endpoint
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            name: 'GHENO CITY 2 - Gemma 3 World Intelligence Server',
            version: '2.0.0',
            model: OLLAMA_MODEL,
            endpoints: {
                'POST /v1/chat/completions': 'API compatible OpenAI pour le MJ',
                'GET /health': 'Vérification de santé',
                'GET /': 'Informations du serveur'
            }
        }));
        return;
    }

    // Main endpoint: OpenAI-compatible chat completions
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const messages = data.messages || [];
                const userMessage = messages.find(m => m.role === 'user')?.content || '';
                const systemMessage = messages.find(m => m.role === 'system')?.content || '';

                console.log(`[MODEL-SERVER] 📥 Requête reçue (${userMessage.length} chars utilisateur, ${systemMessage.length} chars système)`);

                // Récupère le contexte du monde
                const worldCtx = await getWorldContext();

                const symbioseContext = `
--- MÉMOIRE SYSTÈME V5 (SYMBIOSE GEMMA 3) ---
MÉTRIX_BOT:
- Actifs (1h): ${worldCtx.activePlayers}
- NPCs Totaux: ${worldCtx.totalNpcs}
- Conflits mondiaux: ${worldCtx.activeConflicts}
- Économie Globale (COL): ${worldCtx.totalCol}
- Puissance Dominante: ${worldCtx.topKingdom.name} (${worldCtx.topKingdom.influence} INF)
- Légende Actuelle: ${worldCtx.topPlayer.name} (Niv ${worldCtx.topPlayer.level})

MÉMOIRE_MONDE_PROFONDE (HISTORIQUE RÉCENT):
${worldCtx.journalContext}

--- SESSION_RP ---
${userMessage}`;

                // Appelle Gemma 3
                const response = await callGemma3(systemMessage, symbioseContext);

                if (!response) {
                    // Fallback: réponse minimale si Gemma 3 échoue
                    const fallbackResponse = JSON.stringify({
                        narrative: "🌀 *Le flux magique est instable...* L'Ether ne répond pas à tes appels. Réessaie dans un instant.",
                        actions: []
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        id: `gc2-fallback-${Date.now()}`,
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: OLLAMA_MODEL,
                        choices: [{
                            message: {
                                role: 'assistant',
                                content: fallbackResponse
                            },
                            finish_reason: 'stop'
                        }]
                    }));
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: `gc2-${Date.now()}`,
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: OLLAMA_MODEL,
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: response
                        },
                        finish_reason: 'stop'
                    }],
                    usage: {
                        prompt_tokens: systemMessage.length + userMessage.length,
                        completion_tokens: response.length,
                        total_tokens: systemMessage.length + userMessage.length + response.length
                    }
                }));
            } catch (err) {
                console.error('[MODEL-SERVER] Erreur traitement requête:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

/**
 * Démarre le serveur de modèle
 */
async function startModelServer() {
    // Vérifie Ollama au démarrage
    console.log('[MODEL-SERVER] 🔍 Vérification de la connexion à Ollama...');
    const healthy = await checkOllamaHealth();

    if (!healthy) {
        console.warn('[MODEL-SERVER] ⚠️ Ollama n\'est pas prêt. Le serveur démarre quand même.');
        console.warn('[MODEL-SERVER]    Les requêtes retourneront des réponses de fallback.');
        console.warn('[MODEL-SERVER]    Pour installer Gemma 3:');
        console.warn('[MODEL-SERVER]      1. ollama pull gemma3:4b');
        console.warn('[MODEL-SERVER]      2. ollama serve');
    }

    server.listen(PORT, () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║         🧠 LOCAL WORLD INTELLIGENCE SERVER 🧠                ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║  Modèle: ${OLLAMA_MODEL.padEnd(52)} ║`);
        console.log(`║  Ollama: ${OLLAMA_URL.padEnd(52)} ║`);
        console.log(`║  Port:   ${PORT.toString().padEnd(52)} ║`);
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log('║  Endpoints:                                                  ║');
        console.log('║    POST /v1/chat/completions  - API MJ (compatible OpenAI)   ║');
        console.log('║    GET  /health               - Vérification de santé        ║');
        console.log('║    GET  /                     - Informations                 ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
    });
}

if (require.main === module) {
    startModelServer();
}

module.exports = { startModelServer, checkOllamaHealth };
