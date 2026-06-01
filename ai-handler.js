const { Player, Card, PlayerCard, Team, Match, RPMessage, sequelize } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

  const history = await RPMessage.findAll({
      where: { [Op.or]: [{ senderJid: player.whatsappId }, { senderJid: 'bot' }] },
      order: [['id', 'DESC']],
      limit: 10
  });

  const remainingTime = player.matchEndTime ? Math.max(0, Math.round((player.matchEndTime - new Date()) / 1000)) : 0;
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const systemPrompt = `
    Tu es le MJ expert de "FOOTBALL CAREER PRO", un RP où le joueur incarne une star montante du football mondial.

    TON STYLE:
    - Narrateur immersif, Commentateur sportif (type Blue Lock / Captain Tsubasa) et Agent.
    - Utilise des caractères spéciaux pour l'esthétique (▰, ▱).
    - Style dynamique, immersif, utilisant le jargon technique du foot.

    RÈGLES DU RP (PRO):
    1. DISTANCE & PRÉCISION: Chaque action doit mentionner la distance en MÈTRES (ex: "Tu es à 25m du but", "Passe de 10m"). C'est CRUCIAL.
    2. PNJ ACTIFS: Incarne les coéquipiers et adversaires. Ils doivent passer la balle, marquer, ou défendre activement selon leurs personnalités (ex: un défenseur agressif, un ailier rapide).
    3. ÉQUIPEMENT OFFICIEL: Utilise TOUJOURS les noms des maillots officiels (ex: Maillot Domicile Real Madrid 2024 Nike, Maillot France FFF Adidas) et des ballons officiels (Adidas Al Rihla, Nike Flight, etc.) dans tes descriptions.
    4. MATCHS: 6min IRL = 90min RP. Le match est intense. Gère les remplacements, les cartons, et la fatigue.
    4. BUSINESS: Le joueur possède des véhicules (engins) et des entreprises. Intègre cela dans sa vie sociale (paparazzis, prestige).
    5. CONTRATS & SPONSORS: Les contrats ont une durée en JOURS RP (1.5h IRL = 1 Jour). S'il joue mal, son contrat ne sera pas renouvelé. Les sponsors (Nike, Adidas, etc.) donnent des bonus.
    6. SYSTÈME DE CHANCE (DÉ 1-20):
       - 1: Échec critique (▱▱▱▱▱▱▱▱▱▱)
       - 2-10: Échec
       - 11-17: Succès (Action réussie, geste propre).
       - 18-20: Succès critique (▰▰▰▰▰▰▰▰▰▰)

    INTERFACE RP OBLIGATOIRE:
    ┏━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃  📢 MODE: [Match/Exploration/Affaires]
    ┗━━━━━━━━━━━━━━━━━━━━━━━━┛
    🌍 LIEU: [Ville, Pays] | 🤝 SPONSOR: [Marque]
    🔋 STAMINA: [▰▰▰▰▱▱▱▱] | ⏳ CONTRAT: [n Jours]
    📏 DISTANCE DU BUT: [n]m | 🎲 DÉ: [Résultat]

    [Ton récit immersif ici]

    ACTIONS JSON (OBLIGATOIRE):
    Ta réponse doit être un JSON valide avec les clés "narrative" (ton récit) et "actions" (un tableau d'objects).
    Actions possibles :
    - {"type": "update_player", "parameters": {"shoot_change": n, "money_change": n, "fame_change": n, "pass_change": n, "market_change": n, "contract_change": n, "stamina_change": n, "new_sponsor": "...", "new_location": "..."}}
    - {"type": "offer_club", "parameters": {"clubName": "Nom", "value": n, "duration": n}}
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
    // True Chance System: Generate a dice roll here so the AI must respect it
    const diceRoll = Math.floor(Math.random() * 20) + 1;
    const finalPrompt = `${fullPrompt}\n\n🎲 RÉSULTAT DU DÉ IMPOSÉ POUR CETTE ACTION: ${diceRoll} (Tu DOIS baser ton récit sur ce chiffre)`;

    // Show loading sequence
    await sendLoadingSequence(sock, jid);

    const content = await callAI(systemPrompt, finalPrompt);
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
                if (action.parameters.dribble_change) await player.increment('dribble', { by: action.parameters.dribble_change });
                if (action.parameters.power_change) await player.increment('power', { by: action.parameters.power_change });
                if (action.parameters.precision_change) await player.increment('precision', { by: action.parameters.precision_change });
                if (action.parameters.defense_change) await player.increment('defense', { by: action.parameters.defense_change });
                if (action.parameters.speed_change) await player.increment('speed', { by: action.parameters.speed_change });
                if (action.parameters.iq_change) await player.increment('iq', { by: action.parameters.iq_change });
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
                if (action.parameters.contract_change) await player.increment('contractDays', { by: action.parameters.contract_change });
                if (action.parameters.new_sponsor) await player.update({ sponsor: action.parameters.new_sponsor });
                if (action.parameters.new_location) await player.update({ location: action.parameters.new_location });
                if (action.parameters.new_job) await player.update({ job: action.parameters.new_job });
                if (action.parameters.new_nat) await player.update({ nationalTeam: action.parameters.new_nat });
            }
            if (action.type === 'offer_club') {
                // Handle recruitment logic
                if (action.parameters.duration) await player.update({ contractDays: action.parameters.duration });
                await player.update({ currentClub: action.parameters.clubName });
                await sock.sendMessage(jid, { text: `📜 *OFFRE DE TRANSFERT ACCEPTÉE* 📜\nBienvenue au club ${action.parameters.clubName} !\nValeur du contrat : ${action.parameters.value.toLocaleString()} €\nDurée : ${action.parameters.duration || 30} Jours RP.` });
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
