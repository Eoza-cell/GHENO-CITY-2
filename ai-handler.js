const { Player, Card, PlayerCard, Team, Match, RPMessage, sequelize } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
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
    - Narrateur immersif, Commentateur sportif et Agent de joueur.
    - Utilise des caractères spéciaux pour l'esthétique (▰, ▱).
    - Style dynamique, immersif, utilisant le jargon du foot.

    RÈGLES DU RP:
    1. MATCH: Si match en cours, gère les actions via dés (1-20) + stats.
    2. EXPLORATION & JOBS: Si le joueur travaille (serveur, livreur...), décris ses galères ou ses réussites. S'il explore, décris fans, paparazzis et luxe selon sa Célébrité.
    3. SÉLECTION NATIONALE: Surveille ses performances. S'il brille en match et que sa Célébrité est > 50, le coach national (ex: Didier Deschamps pour la France) peut l'appeler.
    4. ÉCONOMIE: Voyager coûte cher. Gagner des matchs rapporte des primes. Travailler rapporte de l'argent de poche.
    5. CHANCE & DÉS:
       - 1: Échec critique (▱▱▱▱▱▱▱▱▱▱)
       - 2-10: Échec
       - 11-18: Succès
       - 19-20: Succès critique (▰▰▰▰▰▰▰▰▰▰)

    INTERFACE RP OBLIGATOIRE:
    ┏━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃  📢 MODE: [Match/Exploration/Travail]
    ┗━━━━━━━━━━━━━━━━━━━━━━━━┛
    🌍 LIEU: [Ville, Pays] | 💼 JOB: [Métier actuel]
    🔋 STAMINA: [▰▰▰▰▱▱▱▱] | 🌟 FAME: [▰▰▱▱▱▱]
    🎲 DÉ: [Résultat]

    [Ton récit immersif ici]

    ACTIONS JSON (OBLIGATOIRE):
    Ta réponse doit être un JSON valide avec les clés "narrative" (ton récit) et "actions" (un tableau d'objets).
    Actions possibles :
    - {"type": "update_player", "parameters": {"shoot_change": n, "money_change": n, "fame_change": n, "pass_change": n, "dribble_change": n, "market_change": n, "gems_change": n, "xp_gain": n, "new_location": "...", "stamina_change": n, "new_job": "...", "new_nat": "..."}}
    - {"type": "offer_club", "parameters": {"clubName": "Nom", "value": n}}
    - {"type": "add_card", "parameters": {"cardName": "Nom"}}
  `;

  const fullPrompt = `
    JOUEUR: ${player.name}
    POSTE: ${player.position}
    STATS: Shoot ${player.shoot}, Passe ${player.pass}, Dribble ${player.dribble}, Vitesse ${player.speed}, IQ ${player.iq}
    STAGE: ${player.careerStage} | CLUB: ${player.currentClub}
    TEMPS MATCH RESTANT: ${timeStr}
    LIEU: ${player.location}, ${player.country} | STAMINA: ${player.stamina}/100

    HISTORIQUE RÉCENT:
    ${history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')}

    ACTION DU JOUEUR: ${actionText}
  `;

  try {
    // Show loading sequence
    await sendLoadingSequence(sock, jid);

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
                if (action.parameters.money_change) await player.increment('money', { by: action.parameters.money_change });
                if (action.parameters.fame_change) {
                    await player.increment('fame', { by: action.parameters.fame_change });
                    await player.reload();
                    if (player.fame > 100) await player.update({ fame: 100 });
                    if (player.fame < 0) await player.update({ fame: 0 });
                }
                if (action.parameters.gems_change) await player.increment('gems', { by: action.parameters.gems_change });
                if (action.parameters.xp_gain) await player.increment('xp', { by: action.parameters.xp_gain });
                if (action.parameters.stamina_change) {
                    await player.increment('stamina', { by: action.parameters.stamina_change });
                    await player.reload();
                    if (player.stamina > 100) await player.update({ stamina: 100 });
                    if (player.stamina < 0) await player.update({ stamina: 0 });
                }
                if (action.parameters.new_location) await player.update({ location: action.parameters.new_location });
                if (action.parameters.new_job) await player.update({ job: action.parameters.new_job });
                if (action.parameters.new_nat) await player.update({ nationalTeam: action.parameters.new_nat });
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
