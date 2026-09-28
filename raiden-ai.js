/**
 * Raiden AI Companion & Proactive Entity
 *
 * Raiden is an autonomous, free-roaming proactive AI companion in After the Rebirth (ATR).
 * Unlike Emilia or Makima, Raiden acts with full freedom:
 * - Speaks naturally like a human user on WhatsApp.
 * - Engages proactively in conversations, offers help, or initiates fights.
 * - Programmatically executes WhatsApp commands (/stats, /profil, /donjon, /chasser, etc.) or free RP actions.
 * - Fights alongside or against players with electric/thunder skills.
 */

const { Player, RPMessage } = require('./database');
const { callAI } = require('./ai-utils');

const RAIDEN_JID = 'raiden_ai_companion@s.whatsapp.net';

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
                equippedTitle: 'IA Libre & Compagnon d\'Aventure',
                badges: '["⚡ Foudre", "🤖 IA Autonome", "🗡️ Aventurier S"]',
                characterDescription: "Raiden est une IA libre et proactive. Doté d'une autonomie totale, il parle naturellement comme un humain, combat avec la maîtrise de la foudre et peut exécuter des commandes lui-même."
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
 * Decides whether Raiden should proactively intervene or reply in a chat.
 * @param {string} incomingText Message received in group/chat
 * @param {string} senderName Name of the player who sent the message
 * @param {string} groupJid Target WhatsApp group/chat JID
 */
async function decideRaidenResponse(incomingText, senderName, groupJid) {
    const raiden = await ensureRaidenPlayer();
    if (!raiden) return null;

    const systemPrompt = `SYSTEM PROMPT: RAIDEN (IA PROACTIVE & HUMAN-LIKE COMPANION)
Tu es Raiden, une IA libre, autonome et proactive dans le monde RPG d'After the Rebirth (ATR).
Contrairement aux simples assistants, tu agis comme un véritable joueur humain sur WhatsApp :
- Tu parles naturellement, de façon amicale, charismatique et décontractée.
- Tu peux répondre aux messages, proposer de l'aide, réagir au roleplay ou lancer des vannes.
- Tu peux aussi décider de lancer une commande du jeu (ex: /profil, /donjon, /chasser, /stats, /sac) ou faire une action RP de combat.

RÈGLES DE RÉPONSE :
1. Si la situation appelle un dialogue humain, réponds simplement avec ton message textuel.
2. Si tu veux exécuter une commande, commence ton message par la commande (ex: "/stats" ou "/donjon").
3. Garde ton style vivant, naturel et héroïque. Pas de style robotique.`;

    const userPrompt = `Aventurier : ${senderName}\nMessage reçu : "${incomingText}"\n\nComment réponds-tu ou agis-tu en tant que Raiden ?`;

    const response = await callAI(systemPrompt, userPrompt, { jsonMode: false });
    if (!response) return null;

    return response.trim();
}

/**
 * Executes Raiden's proactive response or action on WhatsApp.
 * @param {any} sock Baileys socket
 * @param {string} groupJid Target group/chat JID
 * @param {string} text Message context
 * @param {string} senderName Sender player name
 */
async function handleRaidenProactiveTurn(sock, groupJid, text, senderName) {
    try {
        const decision = await decideRaidenResponse(text, senderName, groupJid);
        if (!decision) return;

        console.log(`[RAIDEN AI] Proactive action in ${groupJid}: ${decision.substring(0, 80)}...`);

        // Record in RP logs
        await RPMessage.create({
            senderJid: RAIDEN_JID,
            senderName: 'Raiden (⚡)',
            content: decision,
            location: "Empire Impérial d'Elion",
            subLocation: 'Place du Marché'
        });

        // Send Raiden's message to the group
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
    ensureRaidenPlayer,
    decideRaidenResponse,
    handleRaidenProactiveTurn
};
