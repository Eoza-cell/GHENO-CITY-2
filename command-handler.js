const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Player, Card, PlayerCard, Team, Match, sequelize } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');

function getJid(message) {
  if (!message || !message.key) return null;
  if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
      return message.key.participant || null;
  }
  return message.key.remoteJid || null;
}

const GOD_NUMBER = '48198576038116@s.whatsapp.net';
const commands = new Map();

// Temporary storage for team registration per chat
const pendingTeams = {};

function getPendingTeams(chatId) {
    if (!pendingTeams[chatId]) {
        pendingTeams[chatId] = { team1: [], team2: [] };
    }
    return pendingTeams[chatId];
}

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  let player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    player = await Player.create({
        whatsappId: jid,
        gems: 300,
        registrationStep: 'completed'
    });

    // Give 1 starter team (2 shooters, 1 GK)
    const starterShooters = await Card.findAll({ where: { rarity: 'B', diving: { [Op.lt]: 50 } }, limit: 2 });
    const starterGK = await Card.findOne({ where: { rarity: 'B', diving: { [Op.gt]: 50 } } });
    const guaranteedA = await Card.findOne({ where: { rarity: 'A' }, order: sequelize.random() });

    const cardsToGive = [...starterShooters, starterGK, guaranteedA];

    for (const card of cardsToGive) {
        await PlayerCard.create({ PlayerWhatsappId: jid, CardId: card.id });
    }

    // Initialize Team (3 players)
    const playerCards = await PlayerCard.findAll({ where: { PlayerWhatsappId: jid }, include: Card });
    await Team.create({
        PlayerWhatsappId: jid,
        shooter1Id: playerCards[0].id,
        shooter2Id: playerCards[1].id,
        goalkeeperId: playerCards[2].id,
    });

    const welcomeMsg = `⚽ *BIENVENUE DANS GHENO FOOTBALL PENALTY !* ⚽\n\n` +
                       `Tu viens de recevoir ton équipe de départ (3 joueurs) et *300 Gems* ! 💎\n\n` +
                       `Ton but : marquer un maximum de pénaltys et devenir une légende du foot.\n\n` +
                       `*Ton équipe :*\n` +
                       cardsToGive.map(c => `- ${c.name} (Rang ${c.rarity})`).join('\n') +
                       `\n\nUtilise /profil pour voir ton équipe ou /penalty pour tirer !`;

    await sock.sendMessage(replyJid, { text: welcomeMsg });
  } else {
    await sock.sendMessage(replyJid, { text: `De retour sur le point de penalty, ${player.name} ?` });
  }
});

// Command: /profil
commands.set('profil', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) return;

  const team = await Team.findOne({ where: { PlayerWhatsappId: jid } });

  let profileText = `--- ⚽ GHENO PHONE - FOOTBALL --- \n\n` +
                      `👤 *JOUEUR:* ${player.name}\n` +
                      `📊 *NIVEAU:* ${player.level}\n` +
                      `💎 *GEMS:* ${player.gems}\n\n` +
                      `--- 📋 TON ÉQUIPE (3 JOUEURS) --- \n`;

  if (team) {
      const roles = ['shooter1Id', 'shooter2Id', 'goalkeeperId'];
      const labels = ['Tireur 1', 'Tireur 2', 'Gardien'];
      for(let i=0; i<roles.length; i++) {
          const pcId = team[roles[i]];
          if (pcId) {
              const pc = await PlayerCard.findByPk(pcId, { include: Card });
              profileText += `${labels[i]}: ${pc.Card.name} [${pc.Card.rarity}]\n`;
          }
      }
  }

  profileText += `\n---------------------------`;
  await sock.sendMessage(replyJid, { text: profileText });
});

// Command: /cards
commands.set('cards', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const playerCards = await PlayerCard.findAll({ where: { PlayerWhatsappId: jid }, include: Card });

    let cardsText = `--- 🎴 TA COLLECTION --- \n\n`;
    playerCards.forEach(pc => {
        cardsText += `├ ${pc.Card.name} [${pc.Card.rarity}] (Lv.${pc.level})\n`;
    });

    await sock.sendMessage(replyJid, { text: cardsText });
});

// Command: /boutique
commands.set('boutique', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const gachaText = `--- 🎰 FOOTBALL GACHA 🎰 --- \n\n` +
                      `💎 *Invocation Simple:* 100 Gems\n` +
                      `💎 *Multi (10 cartes):* 900 Gems\n\n` +
                      `*ULT:* 0.5% | *SS:* 2.5% | *S:* 7% | *A:* 30% | *B:* 60%\n\n` +
                      `_Invoque en mode /action (ex: "multi")_`;

    await sock.sendMessage(replyJid, { text: gachaText });
});

// Command: /action
commands.set('action', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
      await player.update({ mode: 'action' });
      await sock.sendMessage(message.key.remoteJid, { text: "Mode action activé. Décris ton tir ou ton arrêt." });
  }
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) await player.update({ mode: 'normal' });

  const menuText = "⚽ *GHENO FOOTBALL PENALTY* ⚽\n\n" +
                   "🎮 `/action` - Entrer sur le terrain (RP).\n" +
                   "👤 `/profil` - Ton équipe & Stats.\n" +
                   "🎴 `/cards` - Ta collection de joueurs.\n" +
                   "🎰 `/boutique` - Invocations Gacha.\n" +
                   "🥅 `/penalty` - Séance de tirs au but.\n" +
                   "❓ `/help` - Aide.";

  await sock.sendMessage(message.key.remoteJid, { text: menuText });
});

// Command: /team1
commands.set('team1', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const mentionedJids = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentionedJids.length < 3) {
        await sock.sendMessage(replyJid, { text: "Mentionne les 3 joueurs de l'équipe 1 (ex: /team1 @joueur1 @joueur2 @joueur3). Le 3ème sera le gardien." });
        return;
    }

    const chatTeams = getPendingTeams(replyJid);
    chatTeams.team1 = mentionedJids.slice(0, 3);
    await sock.sendMessage(replyJid, { text: `✅ Équipe 1 enregistrée : ${chatTeams.team1.length} joueurs. Utilise /team2 pour l'adversaire.` });
});

// Command: /team2
commands.set('team2', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const mentionedJids = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentionedJids.length < 3) {
        await sock.sendMessage(replyJid, { text: "Mentionne les 3 joueurs de l'équipe 2. Le 3ème sera le gardien." });
        return;
    }

    const chatTeams = getPendingTeams(replyJid);
    chatTeams.team2 = mentionedJids.slice(0, 3);
    await sock.sendMessage(replyJid, { text: `✅ Équipe 2 enregistrée : ${chatTeams.team2.length} joueurs. Utilise /match pour commencer la séance 3v3 !` });
});

// Command: /penalty
commands.set('penalty', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    const activeMatch = await Match.findOne({
        where: {
            status: 'active',
            [Op.or]: [
                { teamA: { [Op.like]: `%${jid}%` } },
                { teamB: { [Op.like]: `%${jid}%` } }
            ]
        }
    });

    if (activeMatch) {
        await sock.sendMessage(replyJid, { text: "Tu es déjà dans une séance ! Utilise /tir." });
        return;
    }

    const chatTeams = getPendingTeams(replyJid);
    if (chatTeams.team1.length >= 3 && chatTeams.team2.length >= 3) {
        const match = await Match.create({
            playerAJid: chatTeams.team1[0],
            playerBJid: chatTeams.team2[0],
            teamA: JSON.stringify(chatTeams.team1),
            teamB: JSON.stringify(chatTeams.team2),
            location: 'Stade de France',
            turn: 'A',
            phase: 'shoot'
        });

        const msg = `🥅 *DÉBUT DE LA SÉANCE 3v3 !* 🥅\n\n` +
                    `Équipe 1: @${chatTeams.team1[0].split('@')[0]}, @${chatTeams.team1[1].split('@')[0]}, @${chatTeams.team1[2].split('@')[0]}\n` +
                    `Équipe 2: @${chatTeams.team2[0].split('@')[0]}, @${chatTeams.team2[1].split('@')[0]}, @${chatTeams.team2[2].split('@')[0]}\n\n` +
                    `*Phase:* Équipe 1 tire.\n` +
                    `Tireur: @${chatTeams.team1[0].split('@')[0]}\n` +
                    `Gardien adverse: @${chatTeams.team2[2].split('@')[0]}\n\n` +
                    `Tireur, utilise /tir [gauche/milieu/droite]`;

        await sock.sendMessage(replyJid, { text: msg, mentions: [...chatTeams.team1, ...chatTeams.team2] });

        chatTeams.team1 = [];
        chatTeams.team2 = [];
    } else {
        await sock.sendMessage(replyJid, { text: "Il faut 3 joueurs par équipe pour lancer (/team1 et /team2)." });
    }
});

commands.set('tir', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const direction = args[0]?.toLowerCase();

    if (!['gauche', 'milieu', 'droite'].includes(direction)) {
        await sock.sendMessage(replyJid, { text: "Utilise: /tir gauche, /tir milieu ou /tir droite." });
        return;
    }

    const match = await Match.findOne({
        where: {
            status: 'active',
            phase: 'shoot',
            [Op.or]: [
                { teamA: { [Op.like]: `%${jid}%` } },
                { teamB: { [Op.like]: `%${jid}%` } }
            ]
        }
    });

    if (!match) return;

    const teamA = JSON.parse(match.teamA);
    const teamB = JSON.parse(match.teamB);
    const isTeamA = match.turn === 'A';
    const currentTeam = isTeamA ? teamA : teamB;
    const enemyTeam = isTeamA ? teamB : teamA;
    const shooterJid = currentTeam[match.currentShooterIndex % 3];
    const goalkeeperJid = enemyTeam[2]; // Fixed GK as 3rd player

    if (jid !== shooterJid) {
        await sock.sendMessage(replyJid, { text: `Ce n'est pas ton tour de tirer ! C'est à @${shooterJid.split('@')[0]}.`, mentions: [shooterJid] });
        return;
    }

    await match.update({
        lastShotDirection: direction,
        phase: 'arret'
    });

    await sock.sendMessage(replyJid, {
        text: `⚽ @${shooterJid.split('@')[0]} a tiré !\n\nGardien (@${goalkeeperJid.split('@')[0]}), choisis où plonger avec /arret [direction] !`,
        mentions: [shooterJid, goalkeeperJid]
    });
});

commands.set('arret', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const dive = args[0]?.toLowerCase();

    if (!['gauche', 'milieu', 'droite'].includes(dive)) {
        await sock.sendMessage(replyJid, { text: "Utilise: /arret gauche, /arret milieu ou /arret droite." });
        return;
    }

    const match = await Match.findOne({
        where: {
            status: 'active',
            phase: 'arret',
            [Op.or]: [
                { teamA: { [Op.like]: `%${jid}%` } },
                { teamB: { [Op.like]: `%${jid}%` } }
            ]
        }
    });

    if (!match) return;

    const teamA = JSON.parse(match.teamA);
    const teamB = JSON.parse(match.teamB);
    const isTeamA = match.turn === 'A';
    const shooterTeam = isTeamA ? teamA : teamB;
    const gkTeam = isTeamA ? teamB : teamA;
    const shooterJid = shooterTeam[match.currentShooterIndex % 3];
    const goalkeeperJid = gkTeam[2];

    if (jid !== goalkeeperJid) {
        await sock.sendMessage(replyJid, { text: "Tu n'es pas le gardien !" });
        return;
    }

    let resultMsg = `🧤 @${goalkeeperJid.split('@')[0]} plonge à *${dive}*...\n` +
                    `⚽ Le tir était à *${match.lastShotDirection}*...\n\n`;

    if (dive === match.lastShotDirection) {
        resultMsg += `🛑 *ARRÊT MAGNIFIQUE !* Pas de but.`;
    } else {
        resultMsg += `🥅 *BUT !!!* Le filet tremble.`;
        if (isTeamA) match.scoreA += 1; else match.scoreB += 1;
    }

    // Prepare next turn
    let nextTurn = isTeamA ? 'B' : 'A';
    let nextRound = match.round;
    let nextIndex = match.currentShooterIndex;

    if (!isTeamA) {
        nextRound += 1;
        nextIndex += 1;
    }

    if (nextRound > 3) {
        resultMsg += `\n\n🏁 *FIN DE LA SÉANCE !*\n🏆 Score Final: ${match.scoreA} - ${match.scoreB}\n`;
        if (match.scoreA > match.scoreB) resultMsg += "Équipe 1 GAGNE !";
        else if (match.scoreB > match.scoreA) resultMsg += "Équipe 2 GAGNE !";
        else resultMsg += "ÉGALITÉ !";

        await match.update({ status: 'finished', scoreA: match.scoreA, scoreB: match.scoreB });
    } else {
        const nextShooter = (nextTurn === 'A' ? teamA : teamB)[nextIndex % 3];
        resultMsg += `\n\n🎯 *TOUR ${nextRound}*\nScore: ${match.scoreA} - ${match.scoreB}\n` +
                     `Au tour de @${nextShooter.split('@')[0]} de tirer !`;

        await match.update({
            turn: nextTurn,
            round: nextRound,
            currentShooterIndex: nextIndex,
            phase: 'shoot',
            scoreA: match.scoreA,
            scoreB: match.scoreB
        });
    }

    await sock.sendMessage(replyJid, { text: resultMsg, mentions: [goalkeeperJid, ...teamA, ...teamB] });
});

// Main handleCommand
async function handleCommand(sock, message) {
  if (message.key.fromMe) return;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player && !messageText.startsWith('/start')) {
    await sock.sendMessage(replyJid, { text: "Tape /start pour commencer ta carrière." });
    return;
  }

  if (player?.mode === 'action' && !messageText.startsWith('/')) {
      // Check if player is in an active penalty match
      const activeMatch = await Match.findOne({
          where: {
              status: 'active',
              [Op.or]: [
                  { teamA: { [Op.like]: `%${jid}%` } },
                  { teamB: { [Op.like]: `%${jid}%` } }
              ]
          }
      });

      if (activeMatch) {
          // If in penalty match, ignore non-command messages or remind them to use /tir or /arret
          await sock.sendMessage(replyJid, { text: "Utilise les commandes /tir ou /arret pour jouer la séance !" });
          return;
      }

      await handleFreeAction(sock, message, player, messageText);
      return;
  }

  if (!messageText.startsWith('/')) return;
  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);

  if (command) {
      await command(sock, message, args);
  }
}

module.exports = { handleCommand, getJid, pendingTeams };
