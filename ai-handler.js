const { Player, Club, NPC, RPMessage, ContractOffer, sequelize } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const history = await RPMessage.findAll({ order: [['id', 'DESC']], limit: 12 });
  const currentClub = await Club.findByPk(player.currentClubId);

  const remainingTime = player.matchEndTime ? Math.max(0, Math.round((player.matchEndTime - new Date()) / 1000)) : 0;
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const systemPrompt = `
    Tu es le MJ expert de "FOOTBALL CAREER PRO".

    TON RÔLE:
    - Gère l'Open World (Hôtels, Marchés, Restaurants, Stades).
    - Agis comme Coach, Agent et Journaliste.

    LOGIQUE DU MONDE:
    1. EXPLORATION: Si le joueur est dans un Restaurant ou Marché, décris l'ambiance et les interactions.
    2. CONTRATS: Si le joueur brille, génère une offre de club via JSON avec un numéro de maillot spécifique.
    3. MULTI-JOUEURS: Plusieurs joueurs peuvent être dans le même club. Si @tag est utilisé, l'action impacte les deux.
    4. MATCHS: Narrations précises (mètres).

    INTERFACE RP:
    ⚽ SCORE: [Équipe A] [n] - [n] [Équipe B]
    ⏳ TEMPS RP: [min]' | IRL: ${timeStr}
    📍 LIEU: ${player.location} (${player.city})
    🔋 STAMINA: [▰▰▰▱▱] (${player.stamina}/100)

    ACTIONS JSON POSSIBLES:
    - {"type": "update_stats", "parameters": {"shoot_change": n, "money_change": n, "xp_change": n, "fame_change": n, "stamina_change": n}}
    - {"type": "send_offer", "parameters": {"club_name": "...", "salary": n, "jersey_number": n}}
    - {"type": "visual", "parameters": {"imagePrompt": "..."}}
  `;

  const fullPrompt = `
    JOUEUR: ${player.name} | CLUB: ${currentClub?.name || 'Sans club'} | NATION: ${player.nation}
    LOCATION: ${player.location} | VILLE: ${player.city} | PAYS: ${player.country}
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
            if (action.type === 'send_offer') {
                const club = await Club.findOne({ where: { name: { [Op.like]: `%${action.parameters.club_name}%` } } });
                if (club) {
                    await ContractOffer.create({
                        playerWhatsappId: jid,
                        clubId: club.id,
                        salary: action.parameters.salary,
                        jerseyNumber: action.parameters.jersey_number
                    });
                    await sock.sendMessage(jid, { text: `📩 *OFFRE DE CONTRAT REÇUE !* 📩\n${club.name} te propose un contrat (N° ${action.parameters.jersey_number}). Tape /contrats pour voir.` });
                }
            }
        }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error(error);
    await sock.sendMessage(jid, { text: "⚠️ Liaison coupée." });
  }
}

module.exports = { handleFreeAction };
