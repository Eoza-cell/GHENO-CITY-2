const { Player, Club, NPC, RPMessage, ContractOffer, sequelize } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

  // 1. Save user action to history IMMEDIATELY (Isolated by JID)
  await RPMessage.create({ senderJid: jid, senderName: player.name, content: actionText });

  // 2. Fetch history (Isolated by JID)
  const history = await RPMessage.findAll({
    where: { senderJid: jid },
    order: [['id', 'DESC']],
    limit: 12
  });

  const currentClub = await Club.findByPk(player.currentClubId);

  const nearbyPlayers = await Player.findAll({
      where: { location: player.location, country: player.country, whatsappId: { [Op.ne]: player.whatsappId } },
      limit: 5
  });

  const remainingTime = player.matchEndTime ? Math.max(0, Math.round((player.matchEndTime - new Date()) / 1000)) : 0;
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const systemPrompt = `
    Tu es le MJ expert de "FOOTBALL CAREER PRO".

    TON RÔLE:
    - Agis comme Coach, Arbitre et coéquipiers/adversaires.
    - ÉQUILIBRE: Utilise le dé d'action (1-20). 1 = Échec, 20 = Exploit.

    RESPONSABILITÉS MJ:
    1. GESTION DU LIEU: Si le joueur veut bouger, utilise l'action JSON "update_location".
    2. DÉCLENCHEMENT DE MATCH: Si le joueur est au "Stade" ou centre d'entraînement, déclenche un match.
    3. SIMULATION DE MATCH: Si le joueur demande à "passer le match" ou "simuler", utilise l'action "skip_match".
    4. CONTRATS: Génère des offres de clubs prestigieux (PSG, Barça, Man Utd) si le joueur brille.

    INTERFACE RP:
    ⚽ SCORE: [Équipe A] [n] - [n] [Équipe B]
    ⏳ TEMPS RP: [min]' | IRL: ${timeStr}
    📍 LIEU: ${player.location} (${player.city})
    🔋 STAMINA: [▰▰▰▱▱] (${player.stamina}/100)

    ACTIONS JSON (STRICTEMENT REQUISES SI NÉCESSAIRE):
    - {"type": "update_stats", "parameters": {"shoot_change": n, "money_change": n, "xp_change": n, "fame_change": n, "stamina_change": n}}
    - {"type": "update_location", "parameters": {"location": "...", "city": "...", "country": "..."}}
    - {"type": "skip_match", "parameters": {"score": "n-n", "goals": n, "assists": n, "rating": n}}
    - {"type": "send_offer", "parameters": {"club_name": "...", "salary": n, "jersey_number": n}}
    - {"type": "visual", "parameters": {"imagePrompt": "..."}}
  `;

  const matesInfo = nearbyPlayers.map(m => `${m.name} (@${m.whatsappId.split('@')[0]})`).join(', ');

  const fullPrompt = `
    JOUEUR: ${player.name} | CLUB: ${currentClub?.name || 'Libre'}
    LOCATION: ${player.location} | VILLE: ${player.city} | PAYS: ${player.country}
    STATS: Tir:${player.shoot}, Passe:${player.pass}, Dribble:${player.dribble}, Défense:${player.defense}, Vitesse:${player.speed}

    JOUEURS PROCHES: ${matesInfo || 'Seul'}

    HISTORIQUE RÉCENT:
    ${history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')}

    ACTION: ${actionText}
  `;

  try {
    const diceRoll = Math.floor(Math.random() * 20) + 1;
    const finalPrompt = `${fullPrompt}\n\n🎲 DÉ IMPOSÉ (Caché): ${diceRoll}/20`;

    await sendLoadingSequence(sock, jid);
    const content = await callAI(systemPrompt, finalPrompt);

    let aiResponse = { narrative: content };
    const jsonMatches = content.match(/\{[\s\S]*?\}/g);
    if (jsonMatches) {
        aiResponse.actions = [];
        for (const jsonStr of jsonMatches) {
            try {
                const parsed = JSON.parse(jsonStr);
                aiResponse.actions.push(parsed);
                aiResponse.narrative = aiResponse.narrative.replace(jsonStr, "").trim();

                // Set image prompt if present
                if (parsed.type === 'visual') {
                    aiResponse.imagePrompt = parsed.parameters.imagePrompt;
                }
            } catch(e){}
        }
    }

    // Save bot response to history (Isolated)
    await RPMessage.create({ senderJid: jid, senderName: 'Football MJ', content: aiResponse.narrative });

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
            if (action.type === 'update_location') {
                await player.update({ location: action.parameters.location || player.location, city: action.parameters.city || player.city, country: action.parameters.country || player.country });
            }
            if (action.type === 'skip_match') {
                const p = action.parameters;
                await player.increment('xp', { by: p.rating * 5 });
                await player.increment('fame', { by: p.goals * 2 + p.assists });
                await sock.sendMessage(jid, { text: `🏟️ *RÉSULTAT DU MATCH SIMULÉ* 🏟️\n\nScore: ${p.score}\nButs: ${p.goals}\nPasses D: ${p.assists}\nNote: ${p.rating}/10` });
            }
            if (action.type === 'send_offer') {
                const club = await Club.findOne({ where: { name: { [Op.like]: `%${action.parameters.club_name}%` } } });
                if (club) {
                    await ContractOffer.create({ playerWhatsappId: jid, clubId: club.id, salary: action.parameters.salary, jerseyNumber: action.parameters.jersey_number });
                    await sock.sendMessage(jid, { text: `📩 *OFFRE DE CONTRAT : ${club.name}* 📩\nIls te proposent le N° ${action.parameters.jersey_number} ! Tape /contrats pour voir.` });
                }
            }
        }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error(error);
    await sock.sendMessage(jid, { text: "⚠️ Liaison interrompue avec le MJ." });
  }
}

module.exports = { handleFreeAction };
