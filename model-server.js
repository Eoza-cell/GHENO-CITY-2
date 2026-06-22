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

                // LIAISON AU MONDE : Enrichissement automatique
                // On récupère les 5 dernières entrées du journal pour la continuité mondiale
                const latestJournal = await WorldJournal.findAll({ order: [['id', 'DESC']], limit: 5 });
                const journalContext = latestJournal.map(j => `[GLOBAL] ${j.entry}`).join('\n');

                const enrichedUserMessage = `--- CONTEXTE MONDIAL ---\n${journalContext}\n\n--- ACTION JOUEUR ---\n${userMessage}`;

                const response = await callAI(systemMessage, enrichedUserMessage);

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
