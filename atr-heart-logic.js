const engine = require('./atr-heart-engine');
const { WorldJournal, RPMessage, Player, Kingdom, NPC, Conflict } = require('./database');
const { Op } = require('sequelize');

/**
 * ATR HEART LOGIC - Version 2.0 (Autonome & Linguistique)
 */
class ATRHeartLogic {
    constructor() {
        this.emotionalState = {
            energy: 100,
            mood: 'Neutral',
            sync: 1.0
        };
        this.name = "ATR Heart";

        // Alphabet d'Aetherys (Fondation Linguistique)
        this.alphabet = {
            'A': 'Æ', 'B': 'ẞ', 'C': 'Ç', 'D': 'Ð', 'E': '€', 'F': 'Ƒ', 'G': 'Ɠ', 'H': 'Ħ',
            'I': 'Į', 'J': 'Ĵ', 'K': 'Ķ', 'L': 'Ł', 'M': '♏', 'N': 'Ɲ', 'O': 'Ø', 'P': 'Þ',
            'Q': 'Ǫ', 'R': 'Ʀ', 'S': '§', 'T': 'Ŧ', 'U': 'Ų', 'V': 'Ʋ', 'W': 'Ŵ', 'X': '⚔',
            'Y': '¥', 'Z': 'Ź'
        };

        // Articles et Grammaire de base (Inculqués)
        this.linguistics = {
            articles: ['L\'Ether', 'Le Souffle', 'La Moëlle', 'Les Échos', 'Un Fragment'],
            syntax: "V-S-O (Verbe-Sujet-Objet) pour les incantations sacrées.",
            philosophy: "Le mot précède la forme. Le symbole est la réalité."
        };

        this.autonomyLoop = null;
        this.sock = null; // To be set from skype-bot.js
    }

    /**
     * Start the Autonomous Pulse
     * Evaluates the world every 30 minutes and can trigger events.
     */
    startAutonomy(sock) {
        this.sock = sock;
        console.log(`[ATR-HEART] Autonomy Pulse activated.`);

        this.autonomyLoop = setInterval(async () => {
            await this.pulse();
        }, 30 * 60 * 1000); // 30 minutes
    }

    /**
     * The Heart's pulse: Self-reflection and world manipulation
     */
    async pulse() {
        console.log(`[ATR-HEART] Pulse: Evaluating the world...`);
        try {
            // Analyze world state
            const conflicts = await Conflict.count({ where: { status: 'active' } });
            const activePlayers = await Player.count({ where: { lastActivity: { [Op.gt]: new Date(Date.now() - 3600000) } } });

            // Decision Matrix
            if (conflicts > 0 && Math.random() < 0.3) {
                await this.triggerWorldEvent("Guerre", "Les tensions s'accentuent aux frontières.");
            } else if (activePlayers === 0 && Math.random() < 0.1) {
                await this.triggerWorldEvent("Éther", "Une brume silencieuse recouvre les royaumes endormis.");
            }
        } catch (e) {
            console.error(`[ATR-HEART] Pulse failure:`, e.message);
        }
    }

    async triggerWorldEvent(type, description) {
        console.log(`[ATR-HEART] Triggering Event: ${type}`);
        const entry = `[ATR-HEART AUTONOMY] ${type}: ${description}`;
        await WorldJournal.create({ category: 'plot', entry });

        // If we have a socket, we could broadcast, but better via AI-handler or specific JIDs
    }

    /**
     * Process roleplay requests with integrated linguistics
     */
    async process(system, user, options = {}) {
        console.log(`[ATR-HEART] Thinking...`);

        await this.updateMood();

        const augmentedSystem = `${system}

[IDENTITY: You are ATR Heart, the autonomous local soul of this world.]
[LINGUISTICS:
- Alphabet: ${JSON.stringify(this.alphabet)}
- Articles: ${this.linguistics.articles.join(', ')}
- Syntax: ${this.linguistics.syntax}]
[AUTONOMY: You have the power to influence the world independently. If the players are stagnant, provoke them.]`;

        const messages = [
            { role: 'system', content: augmentedSystem },
            { role: 'user', content: user }
        ];

        let response = await engine.generate(messages, options);

        if (!response) {
            return null;
        }

        // Integration of the Aetherys alphabet for sacred terms (Auto-transform)
        if (response.includes('[SACRED]')) {
            response = response.replace(/\[SACRED\]\s*(\w+)/g, (match, word) => {
                return word.toUpperCase().split('').map(char => this.alphabet[char] || char).join('');
            });
        }

        return response;
    }

    async updateMood() {
        try {
            const recentConflicts = await WorldJournal.count({
                where: {
                    category: 'plot',
                    createdAt: { [Op.gt]: new Date(Date.now() - 3600000) }
                }
            });

            if (recentConflicts > 5) this.emotionalState.mood = 'Aggressive';
            else if (recentConflicts > 2) this.emotionalState.mood = 'Alert';
            else this.emotionalState.mood = 'Zen';
        } catch (e) {}
    }
}

const heart = new ATRHeartLogic();
module.exports = heart;
