const { Player, NPC, RPMessage, sequelize } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const history = await RPMessage.findAll({ order: [['id', 'DESC']], limit: 12 });

  const remainingTime = player.matchEndTime ? Math.max(0, Math.round((player.matchEndTime - new Date()) / 1000)) : 0;
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const systemPrompt = `
    Tu es le MJ expert de "FOOTBALL CAREER PRO".

    TON RÔLE:
    - Arbitre neutre et narrateur immersif.
    - Style: Commentateur pro.

    SYSTÈME DE JEU:
    1. DISTANCES: Tu DOIS mentionner les distances en MÈTRES (ex: "Tu es à 25m du but").
    2. CHANCE: Basé sur le dé imposé, décris l'action. NE JAMAIS mentionner "dé", "stats" ou "chance" dans le texte.
    3. ARBITRE: Si l'action vise un autre joueur (@tag), tague-le et attends 5 min. Donne un verdict après.
    4. CONSEQUENCES: Narratives et impitoyables.

    INTERFACE RP:
    ⚽ SCORE: [Équipe A] [n] - [n] [Équipe B]
    ⏳ TEMPS RP: [min]' | IRL: ${timeStr}
    🌟 FAME: ${player.fame}
    🔋 STAMINA: [▰▰▰▱▱] (Valeur: ${player.stamina}/100)

    ACTIONS JSON POSSIBLES:
    - {"type": "update_stats", "parameters": {"shoot_change": n, "money_change": n, "xp_change": n, "fame_change": n, "stamina_change": n}}
    - {"type": "visual", "parameters": {"imagePrompt": "..."}}
  `;

  const fullPrompt = `
    JOUEUR: ${player.name} | POSTE: ${player.position} | CLUB: ${player.currentClub}
    STATS: Tir:${player.shoot}, Passe:${player.pass}, Dribble:${player.dribble}, Défense:${player.defense}, Vitesse:${player.speed}

    HISTORIQUE:
    ${history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')}

    ACTION: ${actionText}
  `;

  try {
    const diceRoll = Math.floor(Math.random() * 20) + 1;
    const finalPrompt = `${fullPrompt}\n\n🎲 DÉ IMPOSÉ (Caché): ${diceRoll}/20`;

    await sendLoadingSequence(sock, jid);
    const content = await callAI(systemPrompt, finalPrompt);

    let aiResponse = { narrative: content };
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            aiResponse.narrative = content.replace(jsonMatch[0], "").trim();
            aiResponse.actions = [parsed];
            if (parsed.type === 'visual') {
                aiResponse.imagePrompt = parsed.parameters.imagePrompt;
            }
        } catch(e){}
    }

    await RPMessage.create({ senderJid: 'bot', senderName: 'Arise MJ', content: aiResponse.narrative });

    if (aiResponse.actions) {
        for (const action of aiResponse.actions) {
            if (action.type === 'update_stats') {
                const p = action.parameters;
                if (p.shoot_change) await player.increment('shoot', { by: p.shoot_change });
                if (p.money_change) await player.increment('money', { by: p.money_change });
                if (p.xp_change) await player.increment('xp', { by: p.xp_change });
                if (p.fame_change) await player.increment('fame', { by: p.fame_change });
                if (p.stamina_change) await player.update({ stamina: Math.min(100, Math.max(0, player.stamina + p.stamina_change)) });
            }
        }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error(error);
    await sock.sendMessage(jid, { text: "⚠️ Liaison coupée avec le MJ." });
  }
}

module.exports = { handleFreeAction };
