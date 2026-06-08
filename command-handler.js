const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Player } = require('./database');
const { startPaveTimer, evaluatePave } = require('./referee-handler');

/**
 * Determines the correct JID (Jabber ID) for the sender of a message.
 */
function getJid(message) {
  if (!message || !message.key) return null;
  if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
      return message.key.participant || null;
  }
  return message.key.remoteJid || null;
}

const commands = new Map();

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const replyJid = message.key.remoteJid;

  if (!player) {
    await Player.create({
        whatsappId: jid,
        registrationStep: 'awaiting_name'
    });
    await sock.sendMessage(replyJid, { text: "Bienvenue. Je suis l'Arbitre IA.\n\nPour commencer, quel est ton nom ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `Content de te revoir, ${player.name} ! Utilise /pave pour lancer un arbitrage.` });
  }
});

// Command: /profile and /profil
const profileCommand = async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const replyJid = message.key.remoteJid;

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Utilise /start pour commencer." });
    return;
  }

  const profileText = `--- 🆔 PROFIL --- \n\n` +
                      `👤 *NOM:* ${player.name}\n` +
                      `🔷 *ÉNERGIE:* ${player.mana}/${player.maxMana}\n` +
                      `---------------------------`;

  await sock.sendMessage(replyJid, { text: profileText });
};
commands.set('profile', profileCommand);
commands.set('profil', profileCommand);

// Command: /pave
commands.set('pave', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await startPaveTimer(sock, player, message.key.remoteJid);
    } else {
        await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord utiliser /start." });
    }
});

// Command: /save
commands.set('save', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    try {
        await player.save();
        await sock.sendMessage(replyJid, { text: "💾 Données sauvegardées." });
    } catch (error) {
        await sock.sendMessage(replyJid, { text: "Erreur lors de la sauvegarde." });
    }
});

// Command: /help
commands.set('help', async (sock, message) => {
  const helpText = "*Commandes Disponibles:*\n" +
                   "/start - Initialiser ton profil.\n" +
                   "/pave - Lancer un chronomètre de 6 min pour un arbitrage.\n" +
                   "/profil - Voir tes statistiques.\n" +
                   "/help - Afficher cette aide.";
  await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Main command handler
async function handleCommand(sock, message) {
  if (message.key.fromMe) return;

  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  const player = await Player.findOne({ where: { whatsappId: jid } });

  // Handle registration flow
  if (player && player.registrationStep === 'awaiting_name') {
      const playerName = messageText.trim();
      if (playerName.length > 2 && playerName.length <= 20 && !playerName.startsWith('/')) {
          await player.update({ name: playerName, registrationStep: null });
          await sock.sendMessage(replyJid, { text: `Enchanté, ${playerName}. Tu peux maintenant utiliser /pave pour soumettre tes actions à l'Arbitre.` });
      } else {
          await sock.sendMessage(replyJid, { text: "Nom invalide. Réessaie." });
      }
      return;
  }

  // Handle Pave writing submission
  if (player && player.paveStatus === 'writing' && !messageText.startsWith('/')) {
      await evaluatePave(sock, player, replyJid, messageText);
      return;
  }

  if (!player && !messageText.startsWith('/start')) {
    await sock.sendMessage(replyJid, { text: "Utilise /start pour commencer." });
    return;
  }

  // Handle standard commands
  if (!messageText.startsWith('/')) return;

  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);

  if (command) {
    try {
      await command(sock, message, args);
      if (player) {
          await player.update({ lastActivity: new Date() });
      }
    } catch (error) {
      console.error(`Erreur commande ${commandName}:`, error);
      await sock.sendMessage(replyJid, { text: "Une erreur est survenue." });
    }
  }
}

module.exports = { handleCommand, getJid };
