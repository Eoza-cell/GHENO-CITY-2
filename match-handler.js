const { Player, RPMessage } = require('./database');
const { callAI } = require('./ai-utils');

const activeMatches = new Map();

const { Card, OwnedCard } = require('./database');

async function startMatch(sock, jid, type, participants) {
    const matchId = `match_${Date.now()}`;

    // Enrich participants with their owned cards
    for (let p of participants) {
        const owned = await OwnedCard.findAll({ where: { playerWhatsappId: p.whatsappId }, include: [Card] });
        p.cards = owned.map(oc => oc.Card);
    }

    const match = {
        id: matchId,
        type, // '1v1', '2v2', '3v3'
        participants, // Array of player objects (now with .cards)
        score: { A: 0, B: 0 },
        sequences: 0,
        maxSequences: 4,
        history: [],
        status: 'active'
    };
    activeMatches.set(jid, match);

    let msg = `⚽ *MATCH DÉMARRÉ (${type})* ⚽\n\n`;
    if (type === '1v1') {
        msg += `👤 ${participants[0].name} vs ${participants[1].name}\n`;
    } else {
        msg += `👥 Match d'équipe engagé !\n`;
    }
    msg += `🧤 *Gardien:* Blue Lock Man (IA)\n`;
    msg += `🏆 Objectif: 3 buts ou 4 séquences.\n\n_Le MJ attend vos actions (pavés RP)._`;

    await sock.sendMessage(jid, { text: msg });
    return match;
}

async function handleMatchAction(sock, message, player, actionText) {
    const jid = message.key.remoteJid;
    const match = activeMatches.get(jid);
    if (!match) return false;

    // Check if player is in match
    const isParticipant = match.participants.some(p => p.whatsappId === player.whatsappId);
    if (!isParticipant) return false;

    match.sequences++;

    const systemPrompt = `
        Tu es l'arbitre et le MJ de Blue Lock.
        Un match est en cours : ${match.type}.
        Score: ${match.score.A} - ${match.score.B}
        Séquence: ${match.sequences}/${match.maxSequences}

        PARTICIPANTS: ${match.participants.map(p => {
            const cardInfo = p.cards && p.cards.length > 0 ? ` [Cartes: ${p.cards.map(c => c.name).join(', ')}]` : '';
            return `${p.name} (${p.position})${cardInfo}`;
        }).join('\n')}

        GARDIEN (BLUE LOCK MAN):
        - C'est une IA de défense ultime.
        - Ses arrêts sont basés sur un niveau moyen de 80 en Goalkeeping.
        - Il ne fait pas d'erreurs d'arbitrage.

        RÈGLES:
        - Analyse le pavé RP du joueur.
        - Détermine si l'action mène à un but, un arrêt de Blue Lock Man, ou une perte de balle.
        - Si un joueur tire, simule l'opposition avec Blue Lock Man.
        - Réponds avec une narration "Hardboiled" et technique.
        - Termine TOUJOURS par un JSON indiquant le résultat :
          {"goal": "A" ou "B" ou null, "end": boolean}
    `;

    const aiText = await callAI(systemPrompt, `Action de ${player.name}: ${actionText}`);

    let narrative = aiText;
    let result = { goal: null, end: false };

    const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
        try {
            result = JSON.parse(jsonMatch[0]);
            narrative = narrative.replace(jsonMatch[0], "").trim();
        } catch(e) {}
    }

    if (result.goal === 'A') match.score.A++;
    if (result.goal === 'B') match.score.B++;

    let footer = `\n\n📊 *SCORE:* ${match.score.A} - ${match.score.B}\n`;
    footer += `⏱️ *SÉQUENCE:* ${match.sequences}/${match.maxSequences}`;

    if (match.score.A >= 3 || match.score.B >= 3 || match.sequences >= match.maxSequences) {
        result.end = true;
    }

    await sock.sendMessage(jid, { text: narrative + footer });

    if (result.end) {
        const winner = match.score.A > match.score.B ? "Équipe A" : (match.score.B > match.score.A ? "Équipe B" : "Égalité");
        await sock.sendMessage(jid, { text: `🏁 *FIN DU MATCH !* \n\nVictoire: ${winner}\nRécompenses: +50 Locks, +1000 Sparks pour les gagnants.` });

        // Reward players
        for (const p of match.participants) {
            const dbPlayer = await Player.findByPk(p.whatsappId);
            if (winner !== "Égalité") {
                const isWinner = (match.score.A > match.score.B && match.participants.indexOf(p) % 2 === 0) || (match.score.B > match.score.A && match.participants.indexOf(p) % 2 !== 0);
                if (isWinner) {
                    await dbPlayer.increment({ locks: 50, sparks: 1000, wins: 1 });
                } else {
                    await dbPlayer.increment('losses', { by: 1 });
                }
            }
            // Update goals could be more complex, but let's assume players mentioned in narrative get goals
            // Simplified: if goal happened in this turn, current player gets +1 goal
            if (result.goal) await dbPlayer.increment('goals', { by: 1 });
        }

        activeMatches.delete(jid);
    }

    return true;
}

module.exports = { startMatch, handleMatchAction, activeMatches };
