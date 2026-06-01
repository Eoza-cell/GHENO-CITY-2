const { Player, Card, PlayerCard, Team, Match, RPMessage, sequelize } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

  const history = await RPMessage.findAll({
      where: { senderJid: player.whatsappId },
      order: [['id', 'DESC']],
      limit: 10
  });

  const remainingTime = player.matchEndTime ? Math.max(0, Math.round((player.matchEndTime - new Date()) / 1000)) : 0;
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const systemPrompt = `
    Tu es le MJ expert de "FOOTBALL CAREER RP", un RP où le joueur incarne un futur crack du football.

    TON STYLE:
    - Commentateur sportif et Agent de joueur.
    - Style dynamique, immersif, utilisant le jargon du foot (Roulette, Petit-pont, Lucarne, Pressing).
    - Très descriptif sur l'ambiance du stade (Santiago Bernabéu) et la pression des recruteurs.

    RÈGLES DU RP CARRIÈRE:
    1. PROLOGUE: Le joueur joue contre le REAL MADRID. C'est sa seule chance d'être repéré.
    2. CHANCE & DÉS: Pour chaque action (tir, passe, dribble), simule un jet de dé (1-20) et combine-le avec les statistiques du joueur (Shoot, Dribble, etc.).
    3. RÉSULTAT:
       - 1: Échec critique (chute, blessure légère, perte de balle ridicule).
       - 2-10: Échec (le défenseur intercepte, le tir passe à côté).
       - 11-18: Succès (belle passe, dribble réussi).
       - 19-20: Succès critique (but magnifique, geste technique de classe mondiale).
    4. TEMPS RÉEL: Le match dure 6 minutes IRL. S'il reste moins de 1 minute, augmente la tension dramatique.
    5. OFFRES DE CLUBS: Si le joueur réalise une action exceptionnelle (but, passe décisive), mentionne qu'un recruteur (ex: scout de Manchester United, PSG, Bayern) prend des notes.

    INTERFACE RP:
    ⚽ MATCH: [Joueur] vs REAL MADRID
    ⏳ TEMPS RESTANT: ${timeStr}
    🎲 DERNIER JET: [Résultat du Dé]
    📢 COMMENTAIRE: [Ton récit]

    ACTIONS JSON (OBLIGATOIRE):
    Ta réponse doit être un JSON valide avec les clés "narrative" (ton récit) et "actions" (un tableau d'objets).
    Actions possibles :
    - {"type": "update_player", "parameters": {"shoot_change": n, "pass_change": n, "dribble_change": n, "market_change": n, "gems_change": n, "xp_gain": n}}
    - {"type": "offer_club", "parameters": {"clubName": "Nom", "value": n}}
    - {"type": "add_card", "parameters": {"cardName": "Nom"}}
  `;

  const fullPrompt = `
    JOUEUR: ${player.name}
    POSTE: ${player.position}
    STATS: Shoot ${player.shoot}, Passe ${player.pass}, Dribble ${player.dribble}, Vitesse ${player.speed}, IQ ${player.iq}
    STAGE: ${player.careerStage}
    CLUB ACTUEL: ${player.currentClub}

    HISTORIQUE RÉCENT:
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
    });

    if (aiResponse.actions) {
        for (const action of aiResponse.actions) {
            if (action.type === 'update_player') {
                if (action.parameters.shoot_change) await player.increment('shoot', { by: action.parameters.shoot_change });
                if (action.parameters.pass_change) await player.increment('pass', { by: action.parameters.pass_change });
                if (action.parameters.market_change) await player.increment('marketValue', { by: action.parameters.market_change });
                if (action.parameters.gems_change) await player.increment('gems', { by: action.parameters.gems_change });
                if (action.parameters.xp_gain) await player.increment('xp', { by: action.parameters.xp_gain });
            }
            if (action.type === 'offer_club') {
                // Handle recruitment logic - maybe store in a temporary field or send a special message
                await sock.sendMessage(jid, { text: `📜 *OFFRE DE TRANSFERT* 📜\nLe club ${action.parameters.clubName} propose de te recruter pour ${action.parameters.value} € !\nUtilise /action pour répondre.` });
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
    await sock.sendMessage(jid, { text: "Le stade est plongé dans le noir. Erreur MJ." });
  }
}

module.exports = { handleFreeAction };
