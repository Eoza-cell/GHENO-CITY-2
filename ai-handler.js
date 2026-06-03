const { User, Team, PlayerCard, BasketballPlayer, RPMessage, sequelize } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, user, actionText) {
  const jid = message.key.remoteJid;
  const userWhatsappId = user.whatsappId;

  // 1. Save user action to history
  await RPMessage.create({ senderJid: userWhatsappId, senderName: user.name, content: actionText });

  // 2. Fetch history
  const history = await RPMessage.findAll({
    where: { [Op.or]: [{ senderJid: userWhatsappId }, { senderJid: jid }] },
    order: [['id', 'DESC']],
    limit: 15
  });

  // 3. Fetch Team info
  const team = await Team.findOne({ where: { userWhatsappId: user.whatsappId } });
  const cardIds = [team.pgCardId, team.sgCardId, team.sfCardId, team.pfCardId, team.cCardId].filter(id => id !== null);
  const cards = await PlayerCard.findAll({
      where: { id: { [Op.in]: cardIds } },
      include: [BasketballPlayer]
  });

  const teamDescription = cards.map(c => {
      const p = c.BasketballPlayer;
      return `${p.position}: ${p.name} (Rarity: ${p.rarity}, Shoot: ${p.shoot}, Defense: ${p.defense}, Stamina: ${c.staminaCurrent}/100)`;
  }).join('\n');

  const systemPrompt = `
    Tu es le MJ expert de "BASKETBALL GACHA RP".

    TON RÔLE:
    - Arbitre, Commentateur et IA des adversaires.
    - ÉQUILIBRE: Utilise les statistiques des cartes pour résoudre les actions.
    - SYSTÈME: 5v5, 4 quart-temps, chrono RP (1 tour = 3-5 sec).

    RÈGLES DU JEU:
    1. FLOW: Si un joueur domine (stats > adversaire + dé chance), active le 🔥 FLOW.
    2. STAMINA: Chaque action consomme de l'énergie (-10% sprint, -15% iso, -20% dunk). Moins d'énergie = moins de précision.
    3. DISTANCE: Respecte les positions (Zones: Raquette, Corner, Aile, Top key, Mid-range).
    4. FOULS:Reach-in, Blocking, Charge, Shooting foul. 6 fautes = exclusion.
    5. CLUTCH: En fin de match, active le ⏳ CLUTCH TIME (boost stats joueurs clutch).

    PVP & ARBITRAGE:
    - Si l'action manque de précision, agis comme arbitre neutre.
    - En cas de conflit entre joueurs, tag le joueur concerné (@jid) et laisse 5 min pour répondre avant de donner un verdict basé sur les stats.

    INTERFACE RP OBLIGATOIRE:
    🏀 SCORE: [Équipe A] [n] - [n] [Équipe B]
    ⏳ [QT] - [TEMPS]
    🔥 Momentum: [Équipe] +n%
    🔋 Energy: [Nom] [▰▰▰▱▱] (n/100)

    ACTIONS JSON POSSIBLES:
    - {"type": "update_player_card", "parameters": {"cardId": n, "stamina_change": n, "xp_change": n}}
    - {"type": "update_user", "parameters": {"gems_change": n, "xp_change": n, "fame_change": n}}
    - {"type": "visual", "parameters": {"imagePrompt": "..."}}
  `;

  const fullPrompt = `
    MANAGER: ${user.name} | NIVEAU: ${user.level}
    ÉQUIPE ACTUELLE:
    ${teamDescription}

    HISTORIQUE RÉCENT:
    ${history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')}

    ACTION MANAGER: ${actionText}
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
    await RPMessage.create({ senderJid: userWhatsappId, senderName: 'Basketball MJ', content: aiResponse.narrative });

    // Handle 5-minute verdict tracking
    if (aiResponse.narrative.includes('@')) {
        await user.update({ pendingMatchAction: true, lastMatchActionTime: new Date() });
    } else {
        await user.update({ pendingMatchAction: false });
    }

    if (aiResponse.actions) {
        for (const action of aiResponse.actions) {
            if (action.type === 'update_player_card') {
                const p = action.parameters;
                const card = await PlayerCard.findByPk(p.cardId);
                if (card) {
                    if (p.stamina_change) await card.update({ staminaCurrent: Math.min(100, Math.max(0, card.staminaCurrent + p.stamina_change)) });
                    if (p.xp_change) await card.increment('xp', { by: p.xp_change });
                }
            }
            if (action.type === 'update_user') {
                const p = action.parameters;
                if (p.gems_change) await user.increment('gems', { by: p.gems_change });
                if (p.xp_change) await user.increment('xp', { by: p.xp_change });
                if (p.fame_change) await user.increment('fame', { by: p.fame_change });
            }
        }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error("[MJ ERROR]:", error);
    try {
        await sock.sendMessage(jid, { text: "⚠️ *LIAISON MJ INTERROMPUE* : Connexion avec l'IA instable." });
    } catch(e) {}
  }
}

module.exports = { handleFreeAction };
