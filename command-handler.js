const { Player } = require('./database');
const { handleRegistration } = require('./registration-handler');

const commands = new Map();

// The /start command
commands.set('start', async (sock, message) => {
  const remoteJid = message.key.remoteJid;
  const [player, created] = await Player.findOrCreate({
    where: { whatsappId: remoteJid },
  });

  // Always allow restarting registration if not finished or explicitly requested
  await player.update({ registrationStep: 0 });
  await handleRegistration(sock, message, player);
});

// The /profile command
commands.set('profile', async (sock, message) => {
  const remoteJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: remoteJid } });

  if (!player || player.registrationStep < 3) {
    await sock.sendMessage(remoteJid, { text: "Tu dois d'abord terminer ton inscription avec /start." });
    return;
  }

  const profileText = `📜 *Fiche de Personnage - Throne of Epsylion* 📜\n\n` +
                      `👤 *Nom RP:* ${player.characterName}\n` +
                      `✨ *Compétence Initiale:* ${player.skill}\n` +
                      `📈 *Niveau:* ${player.level}\n` +
                      `💰 *Argent:* ${player.money} Écus`;
  await sock.sendMessage(remoteJid, { text: profileText });
});

// The /help command
commands.set('help', async (sock, message) => {
    const helpText = "🏰 *Aide - Throne of Epsylion* 🏰\n\n" +
                     "/start - Commencer ou recommencer l'inscription.\n" +
                     "/profile - Voir ta fiche de personnage.\n" +
                     "/help - Afficher ce message.";
    await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

async function handleCommand(sock, message) {
  const remoteJid = message.key.remoteJid;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;

  const player = await Player.findOne({ where: { whatsappId: remoteJid } });

  // If player is in registration, intercept all messages except /start
  if (player && player.registrationStep < 3 && messageText !== '/start') {
    const intercepted = await handleRegistration(sock, message, player);
    if (intercepted) {
        await Player.update({ lastActivity: new Date() }, { where: { whatsappId: remoteJid } });
        return;
    }
  }

  if (!messageText || !messageText.startsWith('/')) {
    return;
  }

  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = commands.get(commandName);
  if (command) {
    try {
      await command(sock, message, args);
      await Player.update({ lastActivity: new Date() }, { where: { whatsappId: remoteJid } });
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await sock.sendMessage(remoteJid, { text: "Une erreur est survenue." });
    }
  }
}

module.exports = { handleCommand };
