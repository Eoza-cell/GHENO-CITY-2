const { Player, Club, NPC, RPMessage, ContractOffer, sequelize } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const playerWhatsappId = player.whatsappId;

  // 1. Save user action to history
  await RPMessage.create({ senderJid: playerWhatsappId, senderName: player.name, content: actionText });

  // 2. Fetch history
  const history = await RPMessage.findAll({
    where: { [Op.or]: [{ senderJid: playerWhatsappId }, { senderJid: jid }] },
    order: [['id', 'DESC']],
    limit: 15
  });

  const currentClub = await Club.findByPk(player.currentClubId);

  const nearbyPlayers = await Player.findAll({
      where: { location: player.location, country: player.country, whatsappId: { [Op.ne]: player.whatsappId } },
      limit: 5
  });

  const systemPrompt = `
    Tu es le MJ expert de "FOOTBALL CAREER PRO".

    TON RÔLE:
    - Agis comme Coach, Arbitre et coéquipiers/adversaires.
    - ÉQUILIBRE: Utilise le dé d'action (1-20). 1 = Échec, 20 = Exploit.
    - IA PRIORITAIRE: Puter.js (GPT-4o).

    RESPONSABILITÉS MJ:
    1. GESTION DU LIEU: Si le joueur veut bouger, utilise l'action JSON "update_location".
    2. DÉCLENCHEMENT DE MATCH: Si le joueur est au "Stade" ou centre d'entraînement, déclenche un match narratif.
    3. SIMULATION DE MATCH: Si demandé, utilise l'action "skip_match".
    4. CONTRATS: Génère des offres de clubs (PSG, Barça, Man Utd) si le joueur brille.

    INTERFACE RP:
    ⚽ SCORE: [Équipe A] [n] - [n] [Équipe B]
    ⏳ TEMPS RP: [min]'
    📍 LIEU: ${player.location} (${player.city})
    🔋 STAMINA: [▰▰▰▱▱] (${player.stamina}/100)

    ACTIONS JSON POSSIBLES:
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
    await sendLoadingSequence(sock, jid);
    const content = await callAI(systemPrompt, fullPrompt);

    let aiResponse = { narrative: content };
    const jsonMatches = content.match(/\{[\s\S]*?\}/g);
    if (jsonMatches) {
        aiResponse.actions = [];
        for (const jsonStr of jsonMatches) {
            try {
                const parsed = JSON.parse(jsonStr);
                aiResponse.actions.push(parsed);
                aiResponse.narrative = aiResponse.narrative.replace(jsonStr, "").trim();

                if (parsed.type === 'visual') {
                    aiResponse.imagePrompt = parsed.parameters.imagePrompt;
                }
            } catch(e){}
        }
    }

    // Save bot response to history
    await RPMessage.create({ senderJid: playerWhatsappId, senderName: 'Football MJ', content: aiResponse.narrative });

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
                    await ContractOffer.create({ playerWhatsappId: player.whatsappId, clubId: club.id, salary: action.parameters.salary, jerseyNumber: action.parameters.jersey_number });
                    await sock.sendMessage(jid, { text: `📩 *OFFRE DE CONTRAT : ${club.name}* 📩\nIls te proposent le N° ${action.parameters.jersey_number} ! Tape /contrats pour voir.` });
                }
            }
        }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error("[MJ ERROR]:", error);
    try {
        await sock.sendMessage(jid, { text: "⚠️ *LIAISON MJ INTERROMPUE* : Connexion avec Puter.js instable." });
    } catch(e) {}
  }
}

module.exports = { handleFreeAction };
