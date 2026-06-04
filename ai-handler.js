const { Player, Club, RPMessage, ContractOffer } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

/**
 * Main MJ Handler for Football Career Pro
 */
async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const playerWhatsappId = player.whatsappId;

  // 1. Context Collection
  const history = await RPMessage.findAll({
    where: { [Op.or]: [{ senderJid: playerWhatsappId }, { senderJid: jid }] },
    order: [['id', 'DESC']],
    limit: 10
  });

  const currentClub = await Club.findByPk(player.currentClubId);

  const systemPrompt = `
    Tu es le MJ expert de "FOOTBALL CAREER PRO".
    Réponds de manière immersive, courte et dynamique (max 3-4 phrases).

    TON: Adopte le ton d'un coach motivateur ou d'un journaliste sportif passionné.
    JOUEUR: ${player.name} (${player.position})
    LIEU ACTUEL: ${player.location}, ${player.city}
    CLUB: ${currentClub?.name || 'Libre'}
    STATS: Tir:${player.shoot}, Passe:${player.pass}, Dribble:${player.dribble}, Vitesse:${player.speed}, Défense:${player.defense}

    RÈGLES MJ:
    - Tes narrations doivent être basées sur les stats du joueur.
    - Si l'action est difficile, simule un jet de dé virtuel (1-20). Si le jet est bas (<10), l'action peut échouer ou être compliquée.
    - Décris les mouvements précis (pied gauche/droit, lucarne, tacle glissé, etc.).
    - Tu DOIS inclure une action JSON à la fin si l'action du joueur modifie son état ou son lieu :
      {"type": "update_stats", "parameters": {"shoot_change": 1, "money_change": 100, "stamina_change": -10, "xp_change": 50}}
      {"type": "update_location", "parameters": {"location": "Stade", "city": "Londres"}}
      {"type": "skip_match", "parameters": {"score": "2-1", "rating": 7}}
      {"type": "visual", "parameters": {"imagePrompt": "Une description visuelle cinématographique de la scène de foot"}}
  `;

  const userPrompt = `
    HISTORIQUE RÉCENT: ${history.reverse().map(h => h.content).join(' | ')}
    ACTION DU JOUEUR ${player.name}: ${actionText}
  `;

  let loadingMsg = null;
  try {
    // 2. Start Loading & AI in parallel
    const loadingPromise = sendLoadingSequence(sock, jid);
    const aiPromise = callAI(systemPrompt, userPrompt);

    const [sent, aiText] = await Promise.all([loadingPromise, aiPromise]);
    loadingMsg = sent;

    if (!aiText) throw new Error("AI returned nothing");

    // 3. Process Response
    let narrative = aiText;
    let actions = [];
    let imagePrompt = null;

    const jsonMatches = narrative.match(/\{[\s\S]*?\}/g);
    if (jsonMatches) {
        for (const match of jsonMatches) {
            try {
                const parsed = JSON.parse(match);
                actions.push(parsed);
                narrative = narrative.replace(match, "");
                if (parsed.type === 'visual') imagePrompt = parsed.parameters?.imagePrompt;
            } catch(e) {}
        }
    }

    narrative = narrative.trim() || "...";

    // 4. Save to DB
    await RPMessage.create({ senderJid: playerWhatsappId, senderName: player.name, content: actionText });
    await RPMessage.create({ senderJid: 'MJ', senderName: 'MJ', content: narrative });

    // 5. Apply Actions
    for (const act of actions) {
        if (act.type === 'update_stats' && act.parameters) {
            const p = act.parameters;
            if (p.shoot_change) await player.increment('shoot', { by: p.shoot_change });
            if (p.pass_change) await player.increment('pass', { by: p.pass_change });
            if (p.dribble_change) await player.increment('dribble', { by: p.dribble_change });
            if (p.defense_change) await player.increment('defense', { by: p.defense_change });
            if (p.speed_change) await player.increment('speed', { by: p.speed_change });
            if (p.money_change) await player.increment('money', { by: p.money_change });
            if (p.xp_change) await player.increment('xp', { by: p.xp_change });
            if (p.stamina_change) await player.update({ stamina: Math.min(100, Math.max(0, player.stamina + p.stamina_change)) });
        }
        if (act.type === 'update_location' && act.parameters?.location) {
            await player.update({ location: act.parameters.location, city: act.parameters.city || player.city });
        }
        if (act.type === 'skip_match' && act.parameters) {
            const p = act.parameters;
            await player.increment('xp', { by: (p.rating || 5) * 10 });
            await sock.sendMessage(jid, { text: `🏟️ *MATCH SIMULÉ* : Score ${p.score || '0-0'} | Note: ${p.rating || 5}/10` });
        }
    }

    // 6. Final reply
    if (loadingMsg && loadingMsg.key) {
        await sock.sendMessage(jid, { delete: loadingMsg.key }).catch(() => null);
    }

    await sendWithImage(sock, jid, { narrative, imagePrompt });

  } catch (error) {
    console.error("[MJ ERROR]:", error.message);
    if (loadingMsg && loadingMsg.key) {
        await sock.sendMessage(jid, { delete: loadingMsg.key }).catch(() => null);
    }
    await sock.sendMessage(jid, { text: `⚽ *MJ* : Le lien avec le centre technique est perturbé, mais j'ai noté ton action : "${actionText.substring(0,20)}..."` });
  }
}

module.exports = { handleFreeAction };
