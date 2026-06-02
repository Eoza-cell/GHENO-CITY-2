const fs = require('fs');
const path = require('path');
const { Player, NPC, sequelize } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { Op } = require('sequelize');

function getJid(message) {
  if (!message || !message.key) return null;
  if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
      return message.key.participant || null;
  }
  return message.key.remoteJid || null;
}

const commands = new Map();

function createStatusBar(current, max, length = 10) {
    const percentage = Math.max(0, Math.min(1, current / max));
    const filledCount = Math.round(percentage * length);
    const emptyCount = length - filledCount;
    return '▰'.repeat(filledCount) + '▱'.repeat(emptyCount);
}

async function updateChrono(player) {
    const now = new Date();
    const diffMs = now - player.lastChronoUpdate;
    const diffMin = diffMs / (1000 * 60);

    // 90 mins IRL = 1 day RP (1.5h)
    if (diffMin >= 90) {
        const daysPassed = Math.floor(diffMin / 90);
        await player.increment('currentDay', { by: daysPassed });
        await player.update({ lastChronoUpdate: now });
        return true;
    }
    return false;
}

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  let player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    player = await Player.create({
        whatsappId: jid,
        registrationStep: 'awaiting_name'
    });
    await sock.sendMessage(replyJid, { text: "⚽ *FOOTBALL CAREER PRO* ⚽\n\nBienvenue, futur crack.\n\nQuel est ton nom de joueur ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `Ravi de te revoir, ${player.name} !` });
  }
});

// Command: /profil
commands.set('profil', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player) return;

  await updateChrono(player);
  const staminaBar = createStatusBar(player.stamina, 100);

  const profileText = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                      `┃  ⚽ DOSSIER PRO : ${player.name.toUpperCase()} \n` +
                      `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                      `🌍 *NATION:* ${player.nation}\n` +
                      `📍 *POSTE:* ${player.position}\n` +
                      `🏢 *CLUB:* ${player.currentClub}\n` +
                      `📅 *JOUR RP:* Jour ${player.currentDay}\n` +
                      `💰 *SOLDE:* ${player.money.toLocaleString()} €\n\n` +
                      `📊 *STATS :*\n` +
                      `👟 Tir: ${player.shoot} | 🎯 Passe: ${player.pass}\n` +
                      `✨ Dribble: ${player.dribble} | 🛡️ Défense: ${player.defense}\n` +
                      `⚡ Vitesse: ${player.speed} | 🧠 IQ: ${player.iq}\n` +
                      `🔋 STAMINA: [${staminaBar}]\n\n` +
                      `🏆 *TROPHÉES:* ${player.trophies.length}\n` +
                      `🏎️ *GARAGE:* ${player.vehicles.length}\n\n` +
                      `_Tape /menu pour voir les options._`;

  if (player.appearanceImageUrl && fs.existsSync(player.appearanceImageUrl)) {
      await sock.sendMessage(replyJid, { image: fs.readFileSync(player.appearanceImageUrl), caption: profileText });
  } else {
      await sock.sendMessage(replyJid, { text: profileText });
  }
});

// Command: /match
commands.set('match', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    const endTime = new Date(Date.now() + 6 * 60 * 1000);
    await player.update({ matchEndTime: endTime, mode: 'action' });

    const msg = `⚽ *JOUR DE MATCH* ⚽\n\n` +
                `Le coup d'envoi est proche.\n` +
                `⏳ *DURÉE : 6 MINUTES IRL (90' RP)*\n\n` +
                `L'arbitre siffle. Que fais-tu ?`;
    await sock.sendMessage(replyJid, { text: msg });
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const menuText = `⚽ *FOOTBALL CAREER MENU* ⚽\n\n` +
                   `/profil - Ton dossier & stats.\n` +
                   `/match - Jouer un match (6min).\n` +
                   `/entrainement - Booster tes stats.\n` +
                   `/action - RP Libre.\n` +
                   `/quit - Sortir du mode RP.`;
  await sock.sendMessage(message.key.remoteJid, { text: menuText });
});

commands.set('entrainement', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await player.update({ mode: 'action' });
        await sock.sendMessage(message.key.remoteJid, { text: "🏋️ *CENTRE D'ENTRAÎNEMENT* 🏋️\nDécris ta séance pour gagner des stats." });
    }
});

commands.set('action', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await player.update({ mode: 'action' });
        await sock.sendMessage(message.key.remoteJid, { text: "⚽ MODE RP ACTIVÉ." });
    }
});

commands.set('quit', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await player.update({ mode: 'normal' });
        await sock.sendMessage(message.key.remoteJid, { text: "Mode normal réactivé." });
    }
});

async function handleCommand(sock, message) {
  if (message.key.fromMe) return;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  // Creation flow
  if (player && player.registrationStep) {
      if (player.registrationStep === 'awaiting_name') {
          await player.update({ name: messageText.trim(), registrationStep: 'awaiting_position' });
          await sock.sendMessage(replyJid, { text: `Quel est ton poste ? (GK, DEF, MID, FWD)` });
      } else if (player.registrationStep === 'awaiting_position') {
          await player.update({ position: messageText.toUpperCase(), registrationStep: 'awaiting_nation' });
          await sock.sendMessage(replyJid, { text: `Quelle est ta nation ?` });
      } else if (player.registrationStep === 'awaiting_nation') {
          await player.update({ nation: messageText.trim(), registrationStep: 'awaiting_appearance' });
          await sock.sendMessage(replyJid, { text: `Envoie ton image d'apparence (ton maillot ou ton visage).` });
      }
      return;
  }

  // Action Mode
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
