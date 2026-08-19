const { GroupMessage, sequelize } = require('./database');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

/**
 * Extracts phone number string from a WhatsApp JID or participant string.
 * e.g., '33612345678@s.whatsapp.net' -> '+33612345678'
 */
function extractPhoneNumber(jidStr) {
    if (!jidStr) return 'Inconnu';
    const clean = jidStr.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    return clean ? `+${clean}` : jidStr;
}

/**
 * Saves an incoming group message into the database.
 */
async function recordGroupMessage({ groupJid, groupName, senderJid, senderName, messageText, messageType = 'text' }) {
    if (!groupJid || !messageText) return null;
    const senderNumber = extractPhoneNumber(senderJid);
    const name = senderName || senderNumber || 'Anonyme';

    try {
        const saved = await GroupMessage.create({
            groupJid,
            groupName: groupName || 'Groupe',
            senderJid,
            senderNumber,
            senderName: name,
            messageText,
            messageType,
            timestamp: new Date()
        });
        return saved;
    } catch (err) {
        console.error('[SPY] Error saving group message:', err.message);
        return null;
    }
}

/**
 * Computes deterministic stats and pattern analytics for group messages within an optional timeframe.
 */
async function computeGroupStats({ groupJid = null, startDate = null, endDate = null } = {}) {
    const whereClause = {};
    if (groupJid) whereClause.groupJid = groupJid;
    if (startDate || endDate) {
        whereClause.timestamp = {};
        if (startDate) whereClause.timestamp[Op.gte] = startDate;
        if (endDate) whereClause.timestamp[Op.lte] = endDate;
    }

    const messages = await GroupMessage.findAll({
        where: whereClause,
        order: [['timestamp', 'ASC']]
    });

    if (messages.length === 0) {
        return {
            totalMessages: 0,
            userStats: [],
            hourlyDistribution: {},
            timelineSummary: [],
            rawMessages: []
        };
    }

    // Classification per user: phone number + pseudo
    const userMap = new Map();
    const hourlyDistribution = {};

    for (const msg of messages) {
        const key = `${msg.senderNumber} (${msg.senderName})`;
        if (!userMap.has(key)) {
            userMap.set(key, {
                number: msg.senderNumber,
                name: msg.senderName,
                count: 0,
                firstSeen: msg.timestamp,
                lastSeen: msg.timestamp,
                sampleMessages: []
            });
        }

        const userData = userMap.get(key);
        userData.count += 1;
        userData.lastSeen = msg.timestamp;
        if (userData.sampleMessages.length < 5) {
            userData.sampleMessages.push(msg.messageText);
        }

        // Hourly stats
        const hour = new Date(msg.timestamp).getHours();
        hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
    }

    const userStats = Array.from(userMap.values()).sort((a, b) => b.count - a.count);

    return {
        totalMessages: messages.length,
        userStats,
        hourlyDistribution,
        rawMessages: messages
    };
}

/**
 * Generates an intelligence & surveillance report using deterministic stats + AI pattern synthesis.
 */
async function generateIntelligenceReport({ groupJid = null, periodName = "Hebdomadaire" } = {}) {
    const stats = await computeGroupStats({ groupJid });

    if (stats.totalMessages === 0) {
        return `📊 *RAPPORT D'ESPIONNAGE ET D'ANALYSE — ${periodName.toUpperCase()}*\n\n` +
               `⚠️ *Aucune donnée enregistrée* pour cette période dans les discussions de groupe.`;
    }

    // Build structured summary of user participation
    let userBreakdown = "";
    stats.userStats.forEach((u, idx) => {
        userBreakdown += `${idx + 1}. 👤 *Numéro & Pseudo:* ${u.number} — *${u.name}*\n`;
        userBreakdown += `   ├ 💬 Messages envoyés: ${u.count} (${((u.count / stats.totalMessages) * 100).toFixed(1)}%)\n`;
        userBreakdown += `   ├ 🕒 Premier message: ${new Date(u.firstSeen).toLocaleString('fr-FR')}\n`;
        userBreakdown += `   └ 🕒 Dernier message: ${new Date(u.lastSeen).toLocaleString('fr-FR')}\n\n`;
    });

    // Format raw conversation logs for AI deep pattern analysis
    const formattedLogs = stats.rawMessages.map(m => {
        const timeStr = new Date(m.timestamp).toLocaleString('fr-FR', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
        });
        return `[${timeStr}] ${m.senderNumber} (${m.senderName}): ${m.messageText}`;
    }).slice(-150).join('\n'); // Last 150 messages for AI context

    const systemPrompt = `Tu es un système de surveillance, d'espionnage et d'intelligence décisionnelle de haut niveau.
Ton rôle est d'analyser l'intégralité des discussions d'un groupe WhatsApp et de produire un rapport analytique, structuré, froid, précis et percutant.

Directives de rédaction du rapport :
1. CLASSEMENT NUMÉRO + PSEUDO : Identifie clairement qui a parlé, leur volume de messages, et la chronologie de leurs interventions (qui a dit quoi et quand).
2. LIENS ET PATTERNS : Analyse les paires d'intervenants qui se répondent souvent, les sujets/thématiques récurrentes, les tensions, affinités ou comportements suspects.
3. RHYTHME & CHRONOLOGIE : Analyse les pics d'activité horaire (ex. activité nocturne, heures de pointe).
4. SYNTHÈSE EXÉCUTIVE : Rédige une conclusion avec les points clés retenus et recommandations stratégiques.

Rédige le rapport en français avec une mise en forme soignée en Markdown WhatsApp (graisse *, puces ├ └, émojis professionnels). Ne retourne aucun code JSON, uniquement le rapport final.`;

    const userPrompt = `PERIODE: ${periodName}
TOTAL MESSAGES: ${stats.totalMessages}
NOMBRE D'INTERVENANTS DISTINCTS: ${stats.userStats.length}

STATISTIQUES PAR INTERVENANT (NUMERO + PSEUDO):
${userBreakdown}

LOGS RÉCENTS DES DISCUSSIONS (QUI A DIT QUOI ET QUAND):
${formattedLogs}`;

    let aiSynthesis = "";
    try {
        aiSynthesis = await callAI(systemPrompt, userPrompt, { jsonMode: false });
    } catch (err) {
        console.error('[SPY] AI Report Synthesis failed:', err.message);
    }

    let reportText = `🕵️‍♂️ *RAPPORT D'ESPIONNAGE & D'ANALYSE DE GROUPE — ${periodName.toUpperCase()}*\n`;
    reportText += `📅 *Généré le:* ${new Date().toLocaleString('fr-FR')}\n`;
    reportText += `📊 *Total messages enregistrés:* ${stats.totalMessages}\n`;
    reportText += `👥 *Membres actifs recensés:* ${stats.userStats.length}\n\n`;
    reportText += `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n`;
    reportText += `📋 *1. CLASSEMENT DÉTAILLÉ (NUMÉRO + PSEUDO & ACTIVITÉ)*\n\n`;
    reportText += userBreakdown;
    reportText += `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n`;

    if (aiSynthesis) {
        reportText += `🧠 *2. ANALYSE DES PATTERNS, LIENS ET DYNAMIQUES DU GROUPE (IA)*\n\n`;
        reportText += aiSynthesis.trim();
    } else {
        reportText += `⚠️ _Analyse approfondie des patterns indisponible pour le moment._`;
    }

    return reportText;
}

/**
 * Checks if a message mentions, tags, or quotes the bot.
 */
function isBotMentioned(message, sock) {
    if (!message || !message.message) return false;

    const botJid = sock?.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null;
    const botNumber = botJid ? botJid.split('@')[0] : null;

    // Check if DM (not a group)
    const remoteJid = message.key?.remoteJid;
    if (remoteJid && !remoteJid.endsWith('@g.us')) {
        return true;
    }

    const contextInfo = message.message.extendedTextMessage?.contextInfo ||
                        message.message.imageMessage?.contextInfo ||
                        message.message.videoMessage?.contextInfo;

    // Check mentionedJid array
    const mentionedJid = contextInfo?.mentionedJid || [];
    if (botJid && mentionedJid.some(j => j.includes(botNumber))) {
        return true;
    }

    // Check if quoted message belongs to bot
    const participant = contextInfo?.participant;
    if (botJid && participant && participant.includes(botNumber)) {
        return true;
    }

    // Check text for @bot or bot phone number
    const text = message.message.conversation ||
                 message.message.extendedTextMessage?.text ||
                 message.message.imageMessage?.caption || '';

    if (botNumber && text.includes(botNumber)) {
        return true;
    }

    return false;
}

/**
 * Generates a casual, natural human-like reply when the bot is tagged or mentioned.
 */
async function generateHumanReply(userText, senderName, groupName = 'le groupe') {
    const systemPrompt = `Tu es un membre humain naturel et sympathique dans un groupe WhatsApp ("${groupName}").
Tu réponds de manière totalement naturelle, décontractée, fluide et humaine.
RÈGLES IMPÉRATIVES :
- Écris en français comme une vraie personne sur WhatsApp (1 à 3 phrases max, court, spontané).
- Ne dis JAMAIS que tu es un bot, une IA, un assistant ou un programme.
- Ne fais référence à aucun jeu vidéo, RPG ou menu.
- Adopte un ton amical, simple, parfois un peu d'humour léger ou de répartie naturelle.
- N'utilise pas de langage soutenu exagéré ou de formules d'assistant d'entreprise.`;

    const userPrompt = `${senderName} s'adresse à toi ou te mentionne dans le groupe : "${userText}"`;

    const fallbacks = [
        "Haha oui totalement !",
        "Je suis là ! Qu'est-ce qui se passe ?",
        "Ça marche, je regarde ça !",
        "Ah yes, exact !",
        "Tranquille et toi ?"
    ];

    try {
        const reply = await callAI(systemPrompt, userPrompt, { jsonMode: false });
        if (reply && reply.trim()) {
            const cleanReply = reply.trim().replace(/^["']|["']$/g, '');
            // Check if the reply is a technical fallback or contains bot/RPG jargon
            const lower = cleanReply.toLowerCase();
            if (lower.includes('mj fallback') || lower.includes('flux magiques') || lower.includes('mode dégradé') || lower.includes('rpg')) {
                return fallbacks[Math.floor(Math.random() * fallbacks.length)];
            }
            return cleanReply;
        }
    } catch (e) {
        console.error('[SPY] Human reply generation error:', e.message);
    }

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

let schedulerInterval = null;

/**
 * Starts the automatic scheduler to send intelligence reports every Thursday & Sunday at 20:00 (8 PM).
 */
function startReportScheduler(sock) {
    if (schedulerInterval) clearInterval(schedulerInterval);

    console.log('[SPY SCHEDULER] Programmé pour envoyer un rapport chaque Jeudi et Dimanche à 20h00.');

    let lastSentDayKey = null;

    schedulerInterval = setInterval(async () => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 4 = Thursday
        const hours = now.getHours();
        const minutes = now.getMinutes();

        // Target: Thursday (4) or Sunday (0) around 20:00
        const isTargetDay = (dayOfWeek === 4 || dayOfWeek === 0);
        const isTargetTime = (hours === 20 && minutes < 5);

        const currentDayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

        if (isTargetDay && isTargetTime && lastSentDayKey !== currentDayKey) {
            lastSentDayKey = currentDayKey;
            const dayName = dayOfWeek === 4 ? "Jeudi" : "Dimanche";
            console.log(`[SPY SCHEDULER] 🚨 Déclenchement du rapport automatique du ${dayName} !`);

            const adminNumber = process.env.ADMIN_PHONE_NUMBER || process.env.PHONE_NUMBER;
            if (!adminNumber) {
                console.warn('[SPY SCHEDULER] Aucun numéro destinataire configuré (ADMIN_PHONE_NUMBER / PHONE_NUMBER).');
                return;
            }

            const cleanNum = adminNumber.replace(/[^0-9]/g, '');
            const targetJid = `${cleanNum}@s.whatsapp.net`;

            try {
                const reportText = await generateIntelligenceReport({ periodName: `Hebdomadaire - ${dayName}` });
                await sock.sendMessage(targetJid, { text: reportText });
                console.log(`[SPY SCHEDULER] ✅ Rapport du ${dayName} envoyé à ${targetJid}`);
            } catch (err) {
                console.error(`[SPY SCHEDULER] Erreur lors de l'envoi du rapport :`, err.message);
            }
        }
    }, 60000); // Check every minute
}

module.exports = {
    extractPhoneNumber,
    recordGroupMessage,
    computeGroupStats,
    generateIntelligenceReport,
    isBotMentioned,
    generateHumanReply,
    startReportScheduler
};
