const { Player, GameScore, Chat } = require('./database');
const { gameLogic, handleGameMessage, activeGames } = require('./games-handler');

const OWNER_NUMBER = process.env.OWNER_NUMBER || '33700000000@s.whatsapp.net';

/**
 * Determines the correct JID (Jabber ID) for the sender of a message.
 */
function getJid(message) {
  if (!message || !message.key) return null;

  // If it's a group message, the sender is in 'participant'
  if (message.key.participant) {
      return message.key.participant;
  }

  // If it's a DM, the remoteJid is the sender (unless it's from me)
  if (message.key.remoteJid) {
      if (message.key.fromMe) {
          // If we want to know who "we" are, but usually we care about the other person in DM
          return message.key.remoteJid;
      }
      return message.key.remoteJid;
  }

  return null;
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
                   "👤 */me* - Voir tes infos\n" +
                   "ℹ️ */ping* - Vérifier la latence";
  await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Command: /me
commands.set('me', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    const msg = `👤 *PROFIL DE ${player.name}*\n\n` +
                `🆔 ID: ${jid.split('@')[0]}\n` +
                `💰 Points: ${player.points}`;
    await sock.sendMessage(message.key.remoteJid, { text: msg });
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

// Command: /activer
commands.set('activer', async (sock, message) => {
    const jid = getJid(message);
    if (jid !== OWNER_NUMBER && !message.key.fromMe) {
        return await sock.sendMessage(message.key.remoteJid, { text: "❌ Seul le propriétaire peut activer le bot." });
    }
    const [chat, created] = await Chat.findOrCreate({ where: { jid: message.key.remoteJid } });
    await chat.update({ isActive: true });
    await sock.sendMessage(message.key.remoteJid, { text: "✅ Le bot est maintenant activé pour ce groupe/chat." });
});

// Command: /desactiver
commands.set('desactiver', async (sock, message) => {
    const jid = getJid(message);
    if (jid !== OWNER_NUMBER && !message.key.fromMe) {
        return await sock.sendMessage(message.key.remoteJid, { text: "❌ Seul le propriétaire peut désactiver le bot." });
    }
    const [chat, created] = await Chat.findOrCreate({ where: { jid: message.key.remoteJid } });
    await chat.update({ isActive: false });
    await sock.sendMessage(message.key.remoteJid, { text: "🛑 Le bot est désormais désactivé pour ce groupe/chat." });
});

// Command: /top
commands.set('top', async (sock, message) => {
    const topPlayers = await Player.findAll({
        order: [['points', 'DESC']],
        limit: 10
    });

    let topText = "🏆 *CLASSEMENT GÉNÉRAL*\n\n";
    const mentions = [];
    topPlayers.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
        topText += `${medal} @${p.whatsappId.split('@')[0]}: ${p.points} points\n`;
        mentions.push(p.whatsappId);
    });

    await sock.sendMessage(message.key.remoteJid, { text: topText, mentions });
});

// Main command handler
async function handleCommand(sock, message, downloadMediaMessage) {
  const messageText = message.message.conversation ||
                      message.message.extendedTextMessage?.text ||
                      message.message.imageMessage?.caption;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  if (!jid) return;

  const isOwner = jid === OWNER_NUMBER || message.key.fromMe;

  // Auto-activation of the chat if owner speaks
  let chat = await Chat.findOne({ where: { jid: replyJid } });
  if (!chat) {
      chat = await Chat.create({ jid: replyJid, isActive: isOwner });
  } else if (isOwner && !chat.isActive) {
      await chat.update({ isActive: true });
  }

  // If chat is not active and not owner, ignore
  if (!chat.isActive && !isOwner) {
      return;
  }

  // Auto-registration of the player
  let player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player) {
      player = await Player.create({
          whatsappId: jid,
          name: message.pushName || 'Joueur'
      });
      console.log(`[AUTH] Nouveau joueur enregistré: ${player.name} (${jid})`);
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
