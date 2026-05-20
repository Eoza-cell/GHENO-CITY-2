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
        registrationStep: 'completed' // Skipping complex registration for now to be fluid
    });

    // Give 1 starter team (generic players or low rank)
    const starterCards = await Card.findAll({ where: { rarity: 'B' }, limit: 4 });
    const guaranteedA = await Card.findOne({ where: { rarity: 'A' }, order: sequelize.random() });

    const allStarterCards = [...starterCards, guaranteedA];

    for (const card of allStarterCards) {
        await PlayerCard.create({ PlayerWhatsappId: jid, CardId: card.id });
    }

    // Initialize Team
    const playerCards = await PlayerCard.findAll({ where: { PlayerWhatsappId: jid }, include: Card });
    await Team.create({
        PlayerWhatsappId: jid,
        pgId: playerCards[0].id,
        sgId: playerCards[1].id,
        sfId: playerCards[2].id,
        pfId: playerCards[3].id,
        cId: playerCards[4].id,
    });

    const welcomeMsg = `🏀 *BIENVENUE DANS GHENO BASKETBALL GACHA !* 🏀\n\n` +
                       `Tu viens de recevoir ton équipe de départ et *300 Gems* ! 💎\n\n` +
                       `C'est ton heure de gloire. Recrute les meilleures stars NBA & FIBA, gère ton roster et domine les parquets.\n\n` +
                       `*Ton équipe de départ :*\n` +
                       allStarterCards.map(c => `- ${c.name} (Rang ${c.rarity})`).join('\n') +
                       `\n\nUtilise /profil pour voir tes stats ou /boutique pour tes premières invocations !`;

    await sock.sendMessage(replyJid, { text: welcomeMsg });
  } else {
    await sock.sendMessage(replyJid, { text: `Content de te revoir sur le parquet, ${player.name} !` });
  }
});

// Command: /profil
commands.set('profil', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) return;

  const team = await Team.findOne({ where: { PlayerWhatsappId: jid } });

  let profileText = `--- 🏀 GHENO PHONE - BASKETBALL --- \n\n` +
                      `👤 *JOUEUR:* ${player.name}\n` +
                      `📊 *NIVEAU:* ${player.level}\n` +
                      `💎 *GEMS:* ${player.gems}\n` +
                      `⚡ *ÉNERGIE:* ${player.energy}/${player.maxEnergy}\n\n` +
                      `--- 📋 LINEUP ACTUEL --- \n`;

  if (team) {
      const positions = ['pgId', 'sgId', 'sfId', 'pfId', 'cId'];
      const labels = ['PG', 'SG', 'SF', 'PF', 'C'];
      for(let i=0; i<positions.length; i++) {
          const pcId = team[positions[i]];
          if (pcId) {
              const pc = await PlayerCard.findByPk(pcId, { include: Card });
              profileText += `${labels[i]}: ${pc.Card.name} (Lv.${pc.level})\n`;
          } else {
              profileText += `${labels[i]}: vide\n`;
          }
      }
  }

  profileText += `\n---------------------------`;
  await sock.sendMessage(replyJid, { text: profileText });
});

// Command: /inventory -> Renamed to /cards
commands.set('cards', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const playerCards = await PlayerCard.findAll({ where: { PlayerWhatsappId: jid }, include: Card });

    if (playerCards.length === 0) {
        await sock.sendMessage(replyJid, { text: "Tu n'as pas encore de cartes." });
        return;
    }

    let cardsText = `--- 🎴 TA COLLECTION --- \n\n`;
    playerCards.forEach(pc => {
        cardsText += `├ ${pc.Card.name} [${pc.Card.rarity}] (Lv.${pc.level})\n`;
    });

    await sock.sendMessage(replyJid, { text: cardsText });
});

// Command: /boutique (Gacha)
commands.set('boutique', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const gachaText = `--- 🎰 BASKETBALL GACHA 🎰 --- \n\n` +
                      `💎 *Invocation Simple:* 100 Gems\n` +
                      `💎 *Multi (10 cartes):* 900 Gems\n\n` +
                      `*Raretés:* B (60%), A (30%), S (7%), SS (2.5%), ULT (0.5%)\n\n` +
                      `_Utilise /action pour invoquer (ex: "Je fais une multi")_`;

    await sock.sendMessage(replyJid, { text: gachaText });
});

// Command: /action
commands.set('action', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
      await player.update({ mode: 'action' });
      await sock.sendMessage(message.key.remoteJid, { text: "Mode action RP activé. Décris tes mouvements sur le parquet." });
  }
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) await player.update({ mode: 'normal' });

  const menuText = "🏀 *GHENO BASKETBALL GACHA* 🏀\n\n" +
                   "🎮 `/action` - Entrer sur le terrain (RP).\n" +
                   "👤 `/profil` - Ton équipe & Stats.\n" +
                   "🎴 `/cards` - Ta collection de joueurs.\n" +
                   "🎰 `/boutique` - Invocations Gacha.\n" +
                   "🏟️ `/match` - Démarrer un match (IA/PvP).\n" +
                   "❓ `/help` - Aide.";

  await sock.sendMessage(message.key.remoteJid, { text: menuText });
});

// Command: /match
commands.set('match', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    // Check if there's an active match
    const activeMatch = await Match.findOne({ where: { [Op.or]: [{ playerAJid: jid }, { playerBJid: jid }], status: 'active' } });

    if (activeMatch) {
        await sock.sendMessage(replyJid, { text: "Tu es déjà dans un match ! Utilise /action pour jouer." });
        return;
    }

    // Start a new match against IA for now
    await Match.create({
        playerAJid: jid,
        playerBJid: 'IA',
        location: 'Madison Square Garden'
    });

    await player.update({ mode: 'action' });
    await sock.sendMessage(replyJid, { text: "🏀 MATCH DÉMARRÉ ! 🏀\n\nLieu: Madison Square Garden\nFormat: 5v5 - 4 Quarters\n\nLe match commence. Tu as la balle. Que fais-tu ?" });
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
