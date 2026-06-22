const http = require('http');
const { Player, NPC, Kingdom, WorldJournal, RPMessage } = require('./database');
const { callAI } = require('./ai-utils');
const { Op } = require('sequelize');

const PORT = process.env.MODEL_PORT || 3001;

/**
 * DARK LUST 3.2 - World Intelligence Server
 * This server acts as the central brain, combining database state with AI reasoning.
 */
const server = http.createServer(async (req, res) => {
    // Basic OpenAI-compatible endpoint structure
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const messages = data.messages || [];
                const userMessage = messages.find(m => m.role === 'user')?.content || '';
                const systemMessage = messages.find(m => m.role === 'system')?.content || '';

                console.log(`[MODEL-SERVER] Processing request...`);

                // MÉMOIRE SYMBIOSE : L'IA accède directement à la moëlle épinière du bot
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

                const symbioseContext = `
--- MÉMOIRE SYSTÈME V4 (SYMBIOSE TOTALE) ---
MÉTRIX_BOT:
- Actifs (1h): ${activePlayers}
- NPCs Totaux: ${totalNpcs}
- Conflits mondiaux: ${activeConflicts}
- Économie Globale (COL): ${totalCol || 0}
- Puissance Dominante: ${topKingdom ? topKingdom.name : 'Empire d\'Elion'} (${topKingdom ? topKingdom.influence : 100} INF)
- Légende Actuelle: ${topPlayer ? topPlayer.name : 'Aucun'} (Niv ${topPlayer ? topPlayer.level : 0})

MÉMOIRE_MONDE_PROFONDE (HISTORIQUE RÉCENT):
${journalContext}

--- SESSION_RP ---
${userMessage}`;

                const enrichedUserMessage = symbioseContext;

                const response = await callAI(systemMessage, enrichedUserMessage, { skipWorldServer: true });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: `dl-${Date.now()}`,
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: 'dark-lust-3.2-1b',
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: response
                        },
                        finish_reason: 'stop'
                    }]
                }));
            } catch (err) {
                console.error('[MODEL-SERVER] Error:', err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

function startModelServer() {
    server.listen(PORT, () => {
        console.log(`[MODEL-SERVER] DARK LUST 3.2 World Model Server running on port ${PORT}`);
    });
}

if (require.main === module) {
    startModelServer();
}

module.exports = { startModelServer };
