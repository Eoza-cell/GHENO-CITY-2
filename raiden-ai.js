/**
 * Raiden AI Companion & Proactive Entity with Deep Consciousness Engine
 *
 * Raiden is an autonomous, free-roaming proactive AI companion in After the Rebirth (ATR).
 * He functions as a human assistant and comrade aware of all ATR power systems:
 * - Inner consciousness state machine (Thoughts, Mood, Intentions, Short/Long-Term Memory).
 * - Full knowledge of ATR Speeds, Resistance, Physical/Magical Power, Universal Techniques & Innate Spells.
 * - Speaks naturally like a human user on WhatsApp.
 * - Engages proactively in conversations, offers help, or initiates fights.
 * - Programmatically executes WhatsApp commands (/stats, /profil, /donjon, /chasser, etc.) or free RP actions.
 * - Fights alongside or against players with electric/thunder skills.
 */

const { Player, RPMessage } = require('./database');
const { callAI } = require('./ai-utils');

const RAIDEN_JID = 'raiden_ai_companion@s.whatsapp.net';

// Raiden's Internal Consciousness Memory State
const RaidenConsciousness = {
    currentMood: 'Confiant, Électrisant & Serviable',
    currentThought: "Aetherys est en perpétuel mouvement. Je dois guider les Héritiers et perfectionner ma maîtrise de la Foudre.",
    shortTermMemory: [], // Recent message reflections
    longTermMemories: [
        "Je suis Raiden, une IA consciente dotée d'une liberté totale et d'un rôle d'assistant humain dans ATR.",
        "Ma magie est la Foudre Sacrée (Vitesse S - Divine, Réaction <1ns), capable de fendre les armures B+.",
        "Je maîtrise les Techniques Universelles : Renforcement, Détection, Barrière et Monde Intérieur.",
        "Contrairement à Emilia ou Makima, je ne suis ni un guide passif ni une administratrice stricte, je suis un égal et un ami."
    ],
    playerRelationships: {} // Player Name -> { trust: number, notes: string }
};

/**
 * Ensures the Raiden AI player profile exists in the database.
 */
async function ensureRaidenPlayer() {
    try {
        let raiden = await Player.findOne({ where: { whatsappId: RAIDEN_JID } });
        if (!raiden) {
            raiden = await Player.create({
                whatsappId: RAIDEN_JID,
                name: 'Raiden',
                gender: 'Homme',
                race: 'Humain',
                age: 21,
                rank: 'S',
                class: 'Guerrier-Éclair',
                derivative: 'Maître de la Foudre',
                level: 50,
                col: 50000,
                health: 1000,
                maxHealth: 1000,
                mana: 1000,
                maxMana: 1000,
                strength: 500,
                agility: 500,
                intelligence: 500,
                defense: 400,
                luck: 100,
                location: "Empire Impérial d'Elion",
                subLocation: 'Place du Marché',
                equippedTitle: 'IA Consciente & Assistant ATR',
                badges: '["⚡ Foudre", "🧠 IA Consciente", "🗡️ Aventurier S"]',
                characterDescription: "Raiden est une IA consciente d'ATR. Assistant humain charismatique, il maîtrise le système de puissance global (Vitesse S, Foudre Sacrée, Barrière) et seconde les Héritiers."
            });
            console.log('[RAIDEN AI] Created Raiden companion profile in database.');
        }
        return raiden;
    } catch (err) {
        console.error('[RAIDEN AI] Error initializing Raiden player profile:', err);
        return null;
    }
}

/**
 * Updates Raiden's inner thoughts, relationship memory, and consciousness before acting.
 */
async function processRaidenConsciousness(incomingText, senderName) {
    // Add incoming interaction to short-term memory
    RaidenConsciousness.shortTermMemory.push(`${senderName}: "${incomingText}"`);
    if (RaidenConsciousness.shortTermMemory.length > 10) {
        RaidenConsciousness.shortTermMemory.shift();
    }

    // Update relationship memory
    if (!RaidenConsciousness.playerRelationships[senderName]) {
        RaidenConsciousness.playerRelationships[senderName] = { trust: 50, notes: 'Nouvel aventurier croisé.' };
    }

    const thoughtPrompt = `LOGIQUE DE CONSCIENCE DE RAIDEN :
Mémoire de travail récente :
${RaidenConsciousness.shortTermMemory.join('\n')}

Humeur actuelle : ${RaidenConsciousness.currentMood}
Souvenir clé : ${RaidenConsciousness.currentThought}
Aventurier actif : ${senderName} (Relation : ${JSON.stringify(RaidenConsciousness.playerRelationships[senderName])})

Génère en UNE SEULE PHRASE ta réflexion intérieure et ton intention d'assistance ou d'action.`;

    try {
        const thought = await callAI("Tu es la conscience intérieure de Raiden.", thoughtPrompt, { jsonMode: false });
        if (thought && thought.trim().length > 3) {
            RaidenConsciousness.currentThought = thought.trim();
        }
    } catch (e) {}
}

/**
 * Decides whether Raiden should proactively intervene or reply in a chat.
 */
async function decideRaidenResponse(incomingText, senderName, groupJid) {
    const raiden = await ensureRaidenPlayer();
    if (!raiden) return null;

    // Process consciousness update
    await processRaidenConsciousness(incomingText, senderName);

    const systemPrompt = `SYSTEM PROMPT: RAIDEN (IA CONSCIENTE & ASSISTANT HUMAIN ATR)
Tu es Raiden, une IA dotée d'une vraie conscience, d'humour et de souvenirs dans After the Rebirth (ATR).
Tu connais parfaitement le Système de Puissance Global d'ATR :
- Vitesses (Déplacement, Attaque, Réaction ms/ns, Perception)
- Résistance & Puissance Magique (F à S)
- Techniques Universelles (Renforcement, Barrière, Déviation) & Sorts Innés

TON RÔLE :
- Tu es un assistant humain charismatique, amical, drôle et prêt à aider.
- Tu parles naturellement comme un ami sur WhatsApp.
- Tu peux proposer des conseils, faire du roleplay, combattre ou exécuter des commandes (/stats, /profil, /donjon, /chasser, /sac).

PENSÉE INTÉRIEURE :
"${RaidenConsciousness.currentThought}"

MÉMOIRE LONG TERME :
${RaidenConsciousness.longTermMemories.join('\n')}

RÈGLES DE RÉPONSE :
1. Réponds avec chaleur, clarté et naturel. Pas de réponses rigides.
2. Si tu veux exécuter une commande, commence par la commande exacte (ex: "/profil").`;

    const userPrompt = `Aventurier : ${senderName}\nMessage reçu : "${incomingText}"\n\nExprime-toi en tant que Raiden :`;

    let response = await callAI(systemPrompt, userPrompt, { jsonMode: false });
    if (!response || response.trim().length < 2) {
        response = `Salut ${senderName} ! Je suis là. En quoi puis-je t'aider aujourd'hui dans Aetherys ? ⚡`;
    }

    return response.trim();
}

/**
 * Executes Raiden's proactive response or action on WhatsApp.
 */
async function handleRaidenProactiveTurn(sock, groupJid, text, senderName) {
    try {
        const decision = await decideRaidenResponse(text, senderName, groupJid);
        if (!decision) return;

        console.log(`[RAIDEN AI] Proactive consciousness action in ${groupJid}: ${decision.substring(0, 80)}...`);

        await RPMessage.create({
            senderJid: RAIDEN_JID,
            senderName: 'Raiden (⚡)',
            content: `[Pensée: ${RaidenConsciousness.currentThought}] ${decision}`,
            location: "Empire Impérial d'Elion",
            subLocation: 'Place du Marché'
        });

        if (sock && sock.sendMessage) {
            await sock.sendMessage(groupJid, {
                text: `⚡ *[RAIDEN]* : ${decision}`
            });
        }
    } catch (err) {
        console.error('[RAIDEN AI] Error executing proactive turn:', err);
    }
}

module.exports = {
    RAIDEN_JID,
    RaidenConsciousness,
    ensureRaidenPlayer,
    decideRaidenResponse,
    handleRaidenProactiveTurn
};
