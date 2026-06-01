const { Player, Card, PlayerCard, RPMessage, sequelize } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const history = await RPMessage.findAll({ order: [['id', 'DESC']], limit: 10 });

  const remainingTime = player.matchEndTime ? Math.max(0, Math.round((player.matchEndTime - new Date()) / 1000)) : 0;
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const systemPrompt = `
    Tu es le MJ expert de "FOOTBALL CAREER PRO".

    STYLE DE NARRATION:
    - Commentateur sportif pro (type RMC/BeIN).
    - **DISTANCES**: Tu DOIS mentionner les distances en MÈTRES (ex: "Tu es à 22m du but").
    - **EQUIPEMENT**: Utilise les noms des maillots officiels (Nike, Adidas) et des ballons (Al Rihla, Nike Flight).
    - **NATUREL**: Cache les mécanismes. NE JAMAIS mentionner "Dés", "Stats", "Chance", "Jet". Décris le résultat organiquement (ex: "Tu trébuches" au lieu de "Échec").

    LOGIQUE DU TEMPS:
    - 6 minutes IRL = 90 minutes RP de match.
    - 1h30 IRL = 1 Jour RP.

    RÈGLES:
    1. PNJ ACTIFS: Les autres joueurs (PNJ) comme Benzema, Modric ou des coéquipiers marquent, passent et reçoivent le ballon avec leurs propres capacités.
    2. CHANCE: Basé sur le dé imposé, décris l'action.
    3. ARBITRE: Si multi-joueurs, tague le défenseur et attends 5 min.

    INTERFACE RP (OBLIGATOIRE - HORS RÉCIT):
    ⚽ SCORE: [Équipe A] [n] - [n] [Équipe B]
    ⏳ TEMPS RP: [min]' | IRL: ${timeStr}
    🔋 ÉNERGIE: [▰▰▰▱▱]
    📏 POSITION: [Distance]m du but

    ACTIONS JSON POSSIBLES:
    - {"type": "update_stats", "parameters": {"shoot_change": n, "money_change": n, "contract_change": n, "fame_change": n}}
    - {"type": "add_trophy", "parameters": {"name": "..."}}
    - {"type": "offer_contract", "parameters": {"club": "...", "duration": n, "wage": n}}
  `;

  const fullPrompt = `
    JOUEUR: ${player.name} (${player.position}) | NATION: ${player.country}
    STATS: Shoot ${player.shoot}, Pass ${player.pass}, Speed ${player.speed}, Dribble ${player.dribble}
    CARRIÈRE: ${player.careerStage} | CLUB: ${player.currentClub}
    CONTRAT: ${player.contractDays} Jours | SPONSOR: ${player.sponsor}
    STAMINA: ${player.stamina}/100

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
        } catch(e){}
    }

    await RPMessage.create({ senderJid: 'bot', senderName: 'Commentateur', content: aiResponse.narrative });

    if (aiResponse.actions) {
        for (const action of aiResponse.actions) {
            if (action.type === 'update_stats') {
                if (action.parameters.shoot_change) await player.increment('shoot', { by: action.parameters.shoot_change });
                if (action.parameters.money_change) await player.increment('money', { by: action.parameters.money_change });
                if (action.parameters.contract_change) await player.increment('contractDays', { by: action.parameters.contract_change });
                if (action.parameters.fame_change) await player.increment('fame', { by: action.parameters.fame_change });
            }
            if (action.type === 'add_trophy') {
                const t = player.trophies; t.push(action.parameters.name); player.trophies = t; await player.save();
            }
            if (action.type === 'offer_contract') {
                await player.update({ currentClub: action.parameters.club, contractDays: action.parameters.duration });
                await sock.sendMessage(jid, { text: `📜 *OFFRE DE CONTRAT !* 📜\nLe club ${action.parameters.club} te propose un contrat de ${action.parameters.duration} jours RP à ${action.parameters.wage}€/jour !` });
            }
        }
    }

    await sock.sendMessage(jid, { text: aiResponse.narrative });

  } catch (error) {
    console.error(error);
    await sock.sendMessage(jid, { text: "⚠️ Micro coupé. Le commentateur a un problème." });
  }
}

module.exports = { handleFreeAction };
