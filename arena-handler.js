const { Player, Duel, RPMessage } = require('./database');
const { callAI } = require('./ai-utils');
const sharp = require('sharp');

/**
 * ATR ARENA - PvP System
 * Manages duels, timers, and AI referee logic.
 */

const DUEL_DURATION = 6 * 60 * 1000; // 6 minutes

class ArenaHandler {
    constructor() {
        this.activeTimers = new Map();
    }

    /**
     * Starts a duel between two players
     */
    async startDuel(sock, playerAJid, playerBJid, location) {
        const duel = await Duel.create({
            playerAJid,
            playerBJid,
            location,
            status: 'active',
            startTime: new Date(),
            lastActionTime: new Date()
        });

        // Start 6-minute countdown
        this.startTimer(sock, duel.id, playerAJid, playerBJid);

        const playerA = await Player.findByPk(playerAJid);
        const playerB = await Player.findByPk(playerBJid);

        const arenaMessage = `
🏟️ *BIENVENUE DANS L'ATR ARENA* 🏟️
━━━━━━━━━━━━━━━━━━━━━━
⚔️ *DUEL :* @${playerAJid.split('@')[0]} vs @${playerBJid.split('@')[0]}
⏳ *TEMPS :* 6:00
⚖️ *RÈGLES :*
1. Précision par membre requise.
2. Distance et vitesse impactent les coups.
3. Le MJ (Arbitre) valide chaque échange.
━━━━━━━━━━━━━━━━━━━━━━
*QUE LE MEILLEUR GAGNE !*
        `;

        await sock.sendMessage(playerAJid, { text: arenaMessage, mentions: [playerAJid, playerBJid] });
        if (playerAJid !== playerBJid) {
            await sock.sendMessage(playerBJid, { text: arenaMessage, mentions: [playerAJid, playerBJid] });
        }

        return duel;
    }

    startTimer(sock, duelId, playerAJid, playerBJid) {
        let timeLeft = 6 * 60; // seconds

        const interval = setInterval(async () => {
            timeLeft -= 30; // Update every 30s to avoid spam but keep tension

            if (timeLeft <= 0) {
                clearInterval(interval);
                this.endDuel(sock, duelId, "TEMPS ÉCOULÉ");
                return;
            }

            // Optional: send a countdown reminder at 1m, 30s, etc.
            if (timeLeft === 60 || timeLeft === 30) {
                 const msg = `⚠️ *ATR ARENA* : Il reste ${timeLeft} secondes !`;
                 await sock.sendMessage(playerAJid, { text: msg });
                 await sock.sendMessage(playerBJid, { text: msg });
            }

        }, 30000);

        this.activeTimers.set(duelId, interval);
    }

    async endDuel(sock, duelId, reason) {
        const interval = this.activeTimers.get(duelId);
        if (interval) clearInterval(interval);
        this.activeTimers.delete(duelId);

        const duel = await Duel.findByPk(duelId);
        if (!duel || duel.status !== 'active') return;

        duel.status = 'finished';
        await duel.save();

        const msg = `🏁 *ATR ARENA* : Duel terminé ! (${reason})`;
        await sock.sendMessage(duel.playerAJid, { text: msg });
        await sock.sendMessage(duel.playerBJid, { text: msg });
    }

    /**
     * AI Referee Logic
     * Checks if a move is valid based on stats, limb targeted, and distance.
     */
    async refereeAction(player, opponent, actionDescription) {
        const systemPrompt = `
Tu es l'Arbitre Suprême de l'ATR ARENA. Ton rôle est purement technique, clinique et impitoyable.
VÉRIFIE LA LOGIQUE DU COUP AVEC UNE RIGUEUR ABSOLUE :
1. DISTANCE : L'attaquant est-il à portée ? (Corps-à-corps, mi-distance, longue portée).
2. PRÉCISION : Le membre visé est-il exposé ? (Tête, Bras G/D, Jambes G/D, Torse).
3. STATS : Compare AGILITÉ (Attaque) vs AGILITÉ (Esquive) et FORCE (Dégâts) vs DÉFENSE (Absorption).
4. TRAUMA : Si le coup porte, décris les dommages anatomiques précis (ex: éclatement de la rotule, déchirure du deltoïde, hémorragie faciale).

FORMAT JSON :
{
  "valid": true/false,
  "damage": 0-100,
  "hitLimb": "nom_du_membre",
  "narrative": "Description courte, brutale et chirurgicale de l'impact ou de l'échec. Utilise un ton froid.",
  "distanceChange": 0
}
        `;

        const userPrompt = `
ATTAQUANT: ${player.name} (STR:${player.strength}, AGI:${player.agility}, INT:${player.intelligence})
CIBLE: ${opponent.name} (STR:${opponent.strength}, AGI:${opponent.agility}, DEF:${player.defense})
ACTION: ${actionDescription}
        `;

        try {
            const response = await callAI(systemPrompt, userPrompt);
            return JSON.parse(response);
        } catch (e) {
            return { valid: true, damage: 10, narrative: "Le combat fait rage." };
        }
    }

    /**
     * Generates the "Fight Pad" UI image
     */
    async generateFightPad(player, opponent) {
        const svg = `
        <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#1a1a1a" />
            <path d="M0 0 L600 0 L550 400 L50 400 Z" fill="#2a2a2a" />

            <!-- Health Bars -->
            <rect x="50" y="50" width="200" height="20" fill="#444" rx="10" />
            <rect x="50" y="50" width="${(player.health / player.maxHealth) * 200}" height="20" fill="#e74c3c" rx="10" />

            <rect x="350" y="50" width="200" height="20" fill="#444" rx="10" />
            <rect x="350" y="50" width="${(opponent.health / opponent.maxHealth) * 200}" height="20" fill="#3498db" rx="10" />

            <text x="50" y="40" font-family="Arial" font-size="18" fill="white">${player.name}</text>
            <text x="550" y="40" font-family="Arial" font-size="18" fill="white" text-anchor="end">${opponent.name}</text>

            <!-- Limb Selection Visual -->
            <circle cx="300" cy="200" r="80" fill="none" stroke="#666" stroke-width="2" />
            <text x="300" y="140" text-anchor="middle" fill="#ccc" font-size="12">TÊTE</text>
            <text x="210" y="200" text-anchor="middle" fill="#ccc" font-size="12">BRAS G</text>
            <text x="390" y="200" text-anchor="middle" fill="#ccc" font-size="12">BRAS D</text>
            <text x="300" y="280" text-anchor="middle" fill="#ccc" font-size="12">JAMBES</text>

            <text x="300" y="350" text-anchor="middle" fill="#f1c40f" font-size="24" font-weight="bold">ATR ARENA</text>
        </svg>
        `;

        return await sharp(Buffer.from(svg)).png().toBuffer();
    }
}

module.exports = new ArenaHandler();
