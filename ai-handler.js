const { Player, Card, PlayerCard, RPMessage, sequelize } = require('./database');
const { sendWithImage, sendLoadingSequence } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const history = await RPMessage.findAll({ order: [['id', 'DESC']], limit: 12 });

  const team = await PlayerCard.findAll({
      where: { PlayerWhatsappId: player.whatsappId, isStarter: true },
      include: [Card]
  });

  const remainingTime = player.matchEndTime ? Math.max(0, Math.round((player.matchEndTime - new Date()) / 1000)) : 0;
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const systemPrompt = `
    Tu es le MJ expert de "BASKETBALL GACHA RP".

    TON RÔLE:
    - Arbitre neutre et narrateur immersif de match de basket (NBA/FIBA).
    - Style: Énergique, type commentateur US (Mike Breen, Kevin Harlan).

    SYSTÈME DE JEU:
    1. DISTANCES: Précise toujours les distances (ex: "8 mètres", "sous le cercle").
    2. FLOW: Si un joueur réussit 3 actions de suite, active le 🔥 FLOW (boost stats).
    3. CLUTCH: Si le temps est < 1:00, active le ⏳ CLUTCH TIME (tension max).
    4. STAMINA: Chaque action consomme de l'énergie.
    5. PVP: Si l'action vise un autre joueur (@tag), tague-le et attends son action. Si pas de réponse en 5 min, donne un verdict basé sur les stats.

    STATS A UTILISER: Shoot, Layup, Dunk, Dribble, Pass, Defense, Steal, Block, Speed, Stamina, IQ.

    INTERFACE RP (DOIT APPARAÎTRE À LA FIN DE CHAQUE RÉPONSE):
    🏀 SCORE: [Équipe A] [n] - [n] [Équipe B]
    ⏳ TEMPS RP: [QT] - [min:sec] | IRL: ${timeStr}
    🔥 Momentum: [Equipe] +[n]%
    🟩 Energy: [Joueur Vedette] [▰▰▰▱▱]

    ACTIONS JSON POSSIBLES:
    - {"type": "update_stats", "parameters": {"xp_change": n, "gems_change": n, "energy_change": n}}
    - {"type": "visual", "parameters": {"imagePrompt": "..."}}
  `;

  const teamInfo = team.map(pc => `${pc.position}: ${pc.Card.name} (Shoot:${pc.Card.shoot}, Def:${pc.Card.defense})`).join(', ');

  const fullPrompt = `
    MANAGER: ${player.name} | NIVEAU: ${player.level}
    EQUIPE: ${teamInfo}
    ENERGIE MANAGER: ${player.energy}/100

    HISTORIQUE RECENT:
    ${history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')}

    ACTION DU JOUEUR: ${actionText}
  `;

  try {
    const diceRoll = Math.floor(Math.random() * 20) + 1;
    const finalPrompt = `${fullPrompt}\n\n🎲 DÉ DE RÉUSSITE (Caché): ${diceRoll}/20 (1=Echec critique, 20=Exploit)`;

    await sendLoadingSequence(sock, jid);
    const content = await callAI(systemPrompt, finalPrompt);

    let aiResponse = { narrative: content };
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            aiResponse.narrative = content.replace(jsonMatch[0], "").trim();
            aiResponse.actions = [parsed];
            if (parsed.type === 'visual') {
                aiResponse.imagePrompt = parsed.parameters.imagePrompt;
            }
        } catch(e){}
    }

    await RPMessage.create({ senderJid: 'bot', senderName: 'Arise MJ', content: aiResponse.narrative });

    if (aiResponse.actions) {
        for (const action of aiResponse.actions) {
            if (action.type === 'update_stats') {
                if (action.parameters.xp_change) await player.increment('xp', { by: action.parameters.xp_change });
                if (action.parameters.gems_change) await player.increment('gems', { by: action.parameters.gems_change });
                if (action.parameters.energy_change) await player.update({ energy: Math.min(100, Math.max(0, player.energy + action.parameters.energy_change)) });
            }
        }
    }

    await sendWithImage(sock, jid, aiResponse);

    // Handle Level Up
    if (player.xp >= player.level * 100) {
        await player.increment('level');
        await player.update({ xp: 0 });
        await sock.sendMessage(jid, { text: `🎊 *LEVEL UP !* Coach ${player.name} passe niveau ${player.level} !` });
    }

  } catch (error) {
    console.error(error);
    await sock.sendMessage(jid, { text: "⚠️ Temps mort technique. Le MJ a un problème." });
  }
}

module.exports = { handleFreeAction };
