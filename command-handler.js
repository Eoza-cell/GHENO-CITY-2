const { Player, GameScore } = require('./database');
const { gameLogic, handleGameMessage, activeGames } = require('./games-handler');

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

// Command: /ping
commands.set('ping', async (sock, message) => {
    const start = Date.now();
    await sock.sendMessage(message.key.remoteJid, { text: "🏓 *Pong !*" });
    const latency = Date.now() - start;
    console.log(`[DIAG] Ping latency: ${latency}ms`);
});

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  let player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    player = await Player.create({
        whatsappId: jid,
        name: message.pushName || 'Joueur'
    });
    await sock.sendMessage(replyJid, { text: `👋 Bienvenue *${player.name}* ! Le bot est prêt.\nTape /help pour voir les jeux disponibles.` });
  } else {
    await sock.sendMessage(replyJid, { text: `Salut ${player.name} ! Prêt pour une partie ?\nTape /help pour voir les jeux disponibles.` });
  }
});

// Command: /help
commands.set('help', async (sock, message) => {
  const helpText = "🎮 *Jeux Disponibles:*\n\n" +
                   "🐺 */loup* - Lancer une partie de Loup-Garou (Groupe)\n" +
                   "📝 */mot* - Devine le mot\n" +
                   "🎨 */artiste* - Devine l'artiste\n" +
                   "🏎️ */course* - Jeu de course Nitro Asphalt\n\n" +
                   "📊 */top* - Classement général\n" +
                   "ℹ️ */ping* - Vérifier la latence\n" +
                   "🚀 */start* - Initialiser ton profil";
  await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Game Commands
commands.set('mot', async (sock, message) => {
    await gameLogic.word(sock, message.key.remoteJid);
});

commands.set('artiste', async (sock, message) => {
    await gameLogic.artist(sock, message.key.remoteJid);
});

commands.set('course', async (sock, message) => {
    await gameLogic.course(sock, message.key.remoteJid);
});

commands.set('loup', async (sock, message) => {
    await gameLogic.loup(sock, message.key.remoteJid);
});

commands.set('join', async (sock, message) => {
    const chatJid = message.key.remoteJid;
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    const game = activeGames.get(chatJid);
    if (!game) return;

    if (game.type === 'course' && game.status === 'joining') {
        if (!game.participants.find(p => p.jid === jid)) {
            game.participants.push({ jid, name: player.name, position: 0 });
            await sock.sendMessage(chatJid, { text: `✅ ${player.name} a rejoint la course ! (${game.participants.length} joueurs)` });
        }
    } else if (game.type === 'loup' && game.status === 'joining') {
        if (!game.participants.find(p => p.jid === jid)) {
            game.participants.push({ jid, name: player.name });
            await sock.sendMessage(chatJid, { text: `✅ ${player.name} a rejoint le village ! (${game.participants.length} joueurs)` });
        }
    }
});

// Command: /top
commands.set('top', async (sock, message) => {
    const topPlayers = await Player.findAll({
        order: [['points', 'DESC']],
        limit: 10
    });

    let topText = "🏆 *CLASSEMENT GÉNÉRAL*\n\n";
    topPlayers.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
        topText += `${medal} *${p.name}*: ${p.points} points\n`;
    });

    await sock.sendMessage(message.key.remoteJid, { text: topText });
});

// Main command handler
async function handleCommand(sock, message, downloadMediaMessage) {
  if (message.key.fromMe) return;

  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player && !messageText.startsWith('/start')) {
      return;
  }

  // Handle standard commands
  if (messageText.startsWith('/')) {
      const args = messageText.slice(1).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = commands.get(commandName);

      if (command) {
          try {
              await command(sock, message, args);
          } catch (error) {
              console.error(`Erreur commande ${commandName}:`, error);
              await sock.sendMessage(replyJid, { text: "Une erreur est survenue lors de l'exécution de la commande." });
          }
          return;
      }
  }

  // Handle game messages (guesses, boosts, etc.)
  if (player) {
      const handled = await handleGameMessage(sock, message, player, messageText);
      if (handled) return;
  }
}

module.exports = { handleCommand, getJid, commands };
