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

// Command: /penalty
commands.set('penalty', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    const activeMatch = await Match.findOne({ where: { [Op.or]: [{ playerAJid: jid }, { playerBJid: jid }], status: 'active' } });

    if (activeMatch) {
        await sock.sendMessage(replyJid, { text: "Tu es déjà dans une séance ! Utilise /action pour tirer." });
        return;
    }

    await Match.create({
        playerAJid: jid,
        playerBJid: 'IA',
        location: 'Wembley Stadium'
    });

    await player.update({ mode: 'action' });
    await sock.sendMessage(replyJid, { text: "🥅 *SÉANCE DE TIRS AU BUT DÉMARRÉE !* 🥅\n\nLieu: Wembley Stadium\nFormat: 3 vs 3 (Tirs alternés)\n\nC'est à toi de tirer en premier. Décris ton tir ou choisis une direction (gauche, milieu, droite) !" });
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

module.exports = { handleCommand, getJid };
