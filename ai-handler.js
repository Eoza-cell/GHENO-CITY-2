const { Player, Card, PlayerCard, Team, Match, RPMessage, sequelize } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

  // Get Player Team (3 players)
  const team = await Team.findOne({ where: { PlayerWhatsappId: player.whatsappId } });
  let teamStats = "";
  if (team) {
      const roles = ['shooter1Id', 'shooter2Id', 'goalkeeperId'];
      const labels = ['Tireur 1', 'Tireur 2', 'Gardien'];
      for(let i=0; i<roles.length; i++) {
          const pc = await PlayerCard.findByPk(team[roles[i]], { include: Card });
          if (pc) {
              teamStats += `- ${labels[i]}: ${pc.Card.name} (Rareté: ${pc.Card.rarity}, Shoot: ${pc.Card.shoot}, Power: ${pc.Card.power}, Precision: ${pc.Card.precision}, Diving: ${pc.Card.diving}, Reflexes: ${pc.Card.reflexes}, Skill: ${pc.Card.signatureSkillName})\n`;
          }
      }
  }

  // Get active match (Penalty session) - Updated to find match where player is in teamA or teamB
  const match = await Match.findOne({
      where: {
          [Op.and]: [
              { status: 'active' },
              {
                  [Op.or]: [
                      { playerAJid: player.whatsappId },
                      { playerBJid: player.whatsappId },
                      { teamA: { [Op.like]: `%${player.whatsappId}%` } },
                      { teamB: { [Op.like]: `%${player.whatsappId}%` } }
                  ]
              }
          ]
      },
      order: [['createdAt', 'DESC']]
  });

  let participantsState = "";
  if (match) {
      const teamA = JSON.parse(match.teamA || "[]");
      const teamB = JSON.parse(match.teamB || "[]");
      participantsState = "PARTICIPANTS:\n";
      for (const jid of teamA) {
          const p = await Player.findOne({ where: { whatsappId: jid } });
          participantsState += `- Équipe A: ${p?.name} (@${jid.split('@')[0]})\n`;
      }
      for (const jid of teamB) {
          const p = await Player.findOne({ where: { whatsappId: jid } });
          participantsState += `- Équipe B: ${p?.name} (@${jid.split('@')[0]})\n`;
      }
  }

  const matchState = match ? `
    SÉANCE EN COURS:
    - Lieu: ${match.location}
    - Score: ${match.scoreA} - ${match.scoreB}
    - Tour: ${match.round}
    - C'est au tour de: ${match.turn === 'A' ? 'Équipe A' : 'Équipe B'}
    ${participantsState}
  ` : "Hors terrain.";

  const history = await RPMessage.findAll({
      where: match ? { matchId: match.id } : { senderJid: player.whatsappId },
      order: [['id', 'DESC']],
      limit: 8
  });

  const systemPrompt = `
    Tu es le MJ expert de "GHENO FOOTBALL PENALTY", un RP de tirs au but ultra-immersif.

    TON STYLE:
    - Commentateur sportif passionné (type Grégoire Margotton ou anime Blue Lock/Captain Tsubasa).
    - Très descriptif sur la tension, le regard du tireur, le souffle, le mouvement du gardien.

    RÈGLES DU RP PENALTY:
    1. FORMAT: Séance de 3 tirs par équipe (3v3). Les joueurs d'une même équipe tirent à tour de rôle.
    2. STATS: Utilise Shoot/Power/Precision pour le tireur vs Diving/Reflexes pour le gardien de l'équipe adverse.
    3. DIRECTIONS: Les joueurs choisissent (Gauche, Milieu, Droite) + (Haut, Bas).
    4. RÉSULTAT: Si le tireur et le gardien choisissent la même direction, le gardien a une grande chance d'arrêter (selon les stats). Sinon, c'est but (sauf si Precision/Power est trop faible).
    5. MULTIJOUEUR: Identifie quel joueur de l'équipe doit tirer ou arrêter. TAGUE le joueur concerné (@JID) pour qu'il sache que c'est à lui de jouer.
    6. SIGNATURE SKILLS: Intègre les compétences spéciales (ex: "Siuuuu Strike", "Araignée Noire") dans la narration.

    INTERFACE OBLIGATOIRE:
    🥅 SCORE: [Joueur] [ScoreA] - [ScoreB] [IA/Adversaire]
    🎯 TOUR: [Round]
    🧤 Gardien adverse: [Nom]

    ACTIONS JSON:
    - "update_match": {scoreA_change, scoreB_change, round, next_turn}
    - "update_player": {gems_change, xp_gain}
    - "add_card": {cardName}
    - "end_match": {}
  `;

  const fullPrompt = `
    JOUEUR: ${player.name}
    TEAM (3 JOUEURS):
    ${teamStats}

    ${matchState}

    HISTORIQUE:
    ${history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')}

    ACTION DU JOUEUR: ${actionText}
  `;

  try {
    const content = await callAI(systemPrompt, fullPrompt);
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        await sock.sendMessage(jid, { text: content });
        return;
    }

    const aiResponse = JSON.parse(jsonMatch[0]);

    await RPMessage.create({
        senderJid: 'bot',
        senderName: 'Commentateur',
        content: aiResponse.narrative,
        matchId: match ? match.id : null
    });

    if (aiResponse.actions) {
        for (const action of aiResponse.actions) {
            if (action.type === 'update_match' && match) {
                if (action.parameters.scoreA_change) await match.increment('scoreA', { by: action.parameters.scoreA_change });
                if (action.parameters.scoreB_change) await match.increment('scoreB', { by: action.parameters.scoreB_change });
                if (action.parameters.round) await match.update({ round: action.parameters.round });
                if (action.parameters.next_turn) await match.update({ turn: action.parameters.next_turn });
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
            if (action.type === 'end_match' && match) {
                await match.update({ status: 'finished' });
            }
        }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error("AI Handler Error:", error);
    await sock.sendMessage(jid, { text: "Le ballon est crevé. Erreur MJ." });
  }
}

module.exports = { handleFreeAction };
