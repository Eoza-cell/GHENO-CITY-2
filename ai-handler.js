const { Player, Card, PlayerCard, Team, Match, RPMessage, sequelize } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

  // Get Player Team
  const team = await Team.findOne({ where: { PlayerWhatsappId: player.whatsappId } });
  let teamStats = "";
  let activeCards = [];
  if (team) {
      const positions = ['pgId', 'sgId', 'sfId', 'pfId', 'cId'];
      const labels = ['PG', 'SG', 'SF', 'PF', 'C'];
      for(let i=0; i<positions.length; i++) {
          const pc = await PlayerCard.findByPk(team[positions[i]], { include: Card });
          if (pc) {
              activeCards.push(pc);
              teamStats += `- ${labels[i]}: ${pc.Card.name} (Rareté: ${pc.Card.rarity}, Stats: Shoot ${pc.Card.shoot}, Layup ${pc.Card.layup}, Dunk ${pc.Card.dunk}, Dribble ${pc.Card.dribble}, Passe ${pc.Card.passe}, Defense ${pc.Card.defense}, Steal ${pc.Card.steal}, Block ${pc.Card.block}, Speed ${pc.Card.speed}, Stamina ${pc.Card.stamina}, IQ ${pc.Card.iq}, Skill: ${pc.Card.signatureSkillName})\n`;
          }
      }
  }

  // Get active match
  const match = await Match.findOne({
      where: { [Op.or]: [{ playerAJid: player.whatsappId }, { playerBJid: player.whatsappId }], status: 'active' },
      order: [['createdAt', 'DESC']]
  });

  const matchState = match ? `
    MATCH EN COURS:
    - Lieu: ${match.location}
    - Score: ${match.scoreA} - ${match.scoreB}
    - Quart-temps: ${match.quarter}/4
    - Temps restant: ${match.timeRemaining}
    - Momentum: ${match.momentumA}% vs ${match.momentumB}%
  ` : "Aucun match en cours. Le joueur est hors terrain.";

  const history = await RPMessage.findAll({
      where: match ? { matchId: match.id } : { senderJid: player.whatsappId },
      order: [['id', 'DESC']],
      limit: 10
  });

  const systemPrompt = `
    Tu es le MJ expert de "GHENO BASKETBALL GACHA", un RP de basketball ultra-immersif (NBA/FIBA).

    TON STYLE:
    - Narrateur sportif passionné, dynamique, type commentateur TV ou anime de basket (Kuroko no Basket, Slam Dunk).
    - Utilise des termes techniques : "Stepback", "Fadeaway", "Pick & Roll", "Box out", "And-1".
    - Ton est sérieux, compétitif et viscéral.

    RÈGLES DU RP BASKETBALL:
    1. MATCHS: 5v5, 4 quarts-temps. 1 tour RP = 3-5 secondes de jeu.
    2. STATS: Utilise STRICTEMENT les stats des joueurs (Shoot, Dribble, Defense, etc.) pour déterminer le succès des actions.
    3. STAMINA: Chaque action consomme de l'énergie (Sprint: -10%, Iso: -15%, Dunk: -20%). Si stamina < 20%, les stats chutent de 50%.
    4. FLOW: Si un joueur réussit 3 actions de suite, il entre en "FLOW" (Stats +20%).
    5. CONTACT/FAUTES: Simule des fautes réalistes (Shooting foul, Reach-in).
    6. IA ARBITRE: Tu es l'arbitre suprême. Si l'action est imprécise, tu tranches.
    7. PvP: Si deux joueurs s'affrontent, taggue l'adversaire (ex: @JID) et laisse-lui 5 min pour répondre avant de donner un verdict basé sur les stats.

    GACHA/INVOCATIONS:
    - Si le joueur veut invoquer (Simple: 100 Gems, Multi: 900 Gems), tu dois générer le tirage aléatoirement selon les raretés :
      B (60%), A (30%), S (7%), SS (2.5%), ULT (0.5%).
    - Tu DOIS retourner une action "add_card" pour chaque carte obtenue.

    INTERFACE OBLIGATOIRE DANS LA NARRATION:
    🏀 SCORE: [Team A] [ScoreA] - [ScoreB] [Team B]
    ⏳ [QT] - [Temps]
    🔥 Momentum: [A]%
    🟩 Stamina: [Joueur Actif] [Barre]

    LOGIQUE DE SORTIE:
    - Tu dois TOUJOURS répondre en JSON.
    - Actions possibles :
      - "update_match": {scoreA_change, scoreB_change, quarter, time_change, momentum_change}
      - "update_player": {gems_change, xp_gain}
      - "add_card": {cardName}
      - "end_match": {}
  `;

  const fullPrompt = `
    JOUEUR: ${player.name}
    GEMS: ${player.gems}
    TEAM STATS:
    ${teamStats}

    ${matchState}

    HISTORIQUE:
    ${history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')}

    ACTION: ${actionText}
  `;

  try {
    const content = await callAI(systemPrompt, fullPrompt);
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        await sock.sendMessage(jid, { text: content });
        return;
    }

    const aiResponse = JSON.parse(jsonMatch[0]);

    // Save to history
    await RPMessage.create({
        senderJid: 'bot',
        senderName: 'Commentateur',
        content: aiResponse.narrative,
        matchId: match ? match.id : null
    });
    await RPMessage.create({
        senderJid: player.whatsappId,
        senderName: player.name,
        content: actionText,
        matchId: match ? match.id : null
    });

    // Process Actions
    if (aiResponse.actions) {
        for (const action of aiResponse.actions) {
            if (action.type === 'update_match' && match) {
                if (action.parameters.scoreA_change) await match.increment('scoreA', { by: action.parameters.scoreA_change });
                if (action.parameters.scoreB_change) await match.increment('scoreB', { by: action.parameters.scoreB_change });
                if (action.parameters.momentum_change) await match.increment('momentumA', { by: action.parameters.momentum_change });
                if (action.parameters.quarter) await match.update({ quarter: action.parameters.quarter });
                if (action.parameters.time_remaining) await match.update({ timeRemaining: action.parameters.time_remaining });
                await match.save();
            }
            if (action.type === 'update_player') {
                if (action.parameters.gems_change) await player.increment('gems', { by: action.parameters.gems_change });
            }
            if (action.type === 'add_card') {
                const card = await Card.findOne({ where: { name: { [Op.like]: `%${action.parameters.cardName}%` } } });
                if (card) {
                    await PlayerCard.create({ PlayerWhatsappId: player.whatsappId, CardId: card.id });
                }
            }
        }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error("AI Handler Error:", error);
    await sock.sendMessage(jid, { text: "Le chronomètre s'est arrêté. Erreur MJ." });
  }
}

module.exports = { handleFreeAction };
