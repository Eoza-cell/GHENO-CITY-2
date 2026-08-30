const { Player } = require('./database');
const { handleRegistration } = require('./registration-handler');
const { ARENAS, getArenaState, shiftArena, advanceGauge, formatArenaDisplay } = require('./arena-system');
const { generateArenaGif } = require('./arena-gif-generator');

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

  if (!player || player.registrationStep < 5) {
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
                     "/arena - Afficher et gérer l'arène de combat.\n" +
                     "/choix_arene [sylvar|abyssal|solarys|dracocrypt] - Sélectionner une arène.\n" +
                     "/change_arene [montant] - Faire avancer la barre de changement d'arène.\n" +
                     "/ping - Vérifier la connexion du bot.\n" +
                     "/help - Afficher ce message.";
    await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Arena command: /arena or /arene
const handleArenaCommand = async (sock, message, args) => {
  const remoteJid = message.key.remoteJid;
  const state = getArenaState(remoteJid);
  const arena = ARENAS[state.currentArenaId];

  const gifBuffer = generateArenaGif(arena.shortName, state.changeGauge);
  const captionText = formatArenaDisplay(remoteJid);

  await sock.sendMessage(remoteJid, {
    video: gifBuffer,
    gifPlayback: true,
    caption: captionText,
    mimetype: 'image/gif'
  });
};

commands.set('arena', handleArenaCommand);
commands.set('arene', handleArenaCommand);

// Arena Selection command: /choix_arene or /select_arena
const handleArenaChoiceCommand = async (sock, message, args) => {
  const remoteJid = message.key.remoteJid;
  const targetArg = (args[0] || '').toLowerCase();

  let selectedId = null;
  for (const [key, arenaData] of Object.entries(ARENAS)) {
    if (key === targetArg || arenaData.shortName.toLowerCase().includes(targetArg)) {
      selectedId = key;
      break;
    }
  }

  if (!selectedId) {
    const listText = "⚔️ *CHOIX DE L'ARÈNE DISPONIBLES :*\n\n" +
                     "1. `sylvar` - 🏟️ Sylvar Arena\n" +
                     "2. `abyssal` - 🌑 Abyssal Arena\n" +
                     "3. `solarys` - 🏜️ Solarys Dune\n" +
                     "4. `dracocrypt` - 🐉 Dracocrypt Arena\n\n" +
                     "Exemple: `/choix_arene sylvar` ou `/arene` pour voir l'actuelle.";
    await sock.sendMessage(remoteJid, { text: listText });
    return;
  }

  const { arena } = shiftArena(remoteJid, selectedId);
  const gifBuffer = generateArenaGif(arena.shortName, 0);
  const captionText = `🔄 *NOUVELLE ARÈNE SÉLECTIONNÉE !*\n\n` + formatArenaDisplay(remoteJid);

  await sock.sendMessage(remoteJid, {
    video: gifBuffer,
    gifPlayback: true,
    caption: captionText,
    mimetype: 'image/gif'
  });
};

commands.set('choix_arene', handleArenaChoiceCommand);
commands.set('choix_arena', handleArenaChoiceCommand);
commands.set('select_arena', handleArenaChoiceCommand);

// Arena gauge advance command: /change_arene or /shift_arene
const handleArenaGaugeCommand = async (sock, message, args) => {
  const remoteJid = message.key.remoteJid;
  const amount = parseInt(args[0], 10) || 25;

  const { shifted } = advanceGauge(remoteJid, amount);
  const state = getArenaState(remoteJid);
  const arena = ARENAS[state.currentArenaId];

  const gifBuffer = generateArenaGif(arena.shortName, state.changeGauge);
  const prefix = shifted ? "💥 *L'ARÈNE A BASCULÉ !*\n\n" : "⚡ *BARRE DE CHANGEMENT D'ARÈNE MISE À JOUR !*\n\n";
  const captionText = prefix + formatArenaDisplay(remoteJid);

  await sock.sendMessage(remoteJid, {
    video: gifBuffer,
    gifPlayback: true,
    caption: captionText,
    mimetype: 'image/gif'
  });
};

commands.set('change_arene', handleArenaGaugeCommand);
commands.set('change_arena', handleArenaGaugeCommand);
commands.set('shift_arene', handleArenaGaugeCommand);

commands.set('ping', async (sock, message) => {
    const start = Date.now();
    await sock.sendMessage(message.key.remoteJid, { text: "🏓 Pong !" });
    const end = Date.now();
    // Optionnel: On peut renvoyer la latence dans un second message ou éditer le premier
    // Mais Baileys ne supporte pas l'édition de message aussi simplement.
    // On va juste confirmer que le bot est en ligne.
});

async function handleCommand(sock, message) {
  const remoteJid = message.key.remoteJid;

  // Only process private chats
  if (!remoteJid.endsWith('@s.whatsapp.net')) return;

  const msg = message.message;
  const messageText = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption;

  const player = await Player.findOne({ where: { whatsappId: remoteJid } });

  // If player is in registration, intercept all messages except /start or @start
  if (player && player.registrationStep < 5 && messageText !== '/start' && messageText !== '@start') {
    const intercepted = await handleRegistration(sock, message, player);
    if (intercepted) {
        await Player.update({ lastActivity: new Date() }, { where: { whatsappId: remoteJid } });
        return;
    }
  }

  if (!messageText || (!messageText.startsWith('/') && !messageText.startsWith('@'))) {
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
