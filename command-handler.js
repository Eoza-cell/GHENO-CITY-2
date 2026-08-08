const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { FootballPlayer, UserStats, sequelize } = require('./database');
const { Op } = require('sequelize');
const { generatePlayerCard, generateUserStatsCard } = require('./efootball-generator');

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

/**
 * Helper to check if a user is an admin of the WhatsApp group.
 */
async function isGroupAdmin(sock, message, jid) {
  try {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith('@g.us')) {
      // In private chats, allow any user to edit stats for themselves/testing,
      // but in group chats we enforce strictly.
      return true;
    }
    const metadata = await sock.groupMetadata(remoteJid);
    const participants = metadata.participants || [];
    const user = participants.find(p => p.id === jid);
    return user && (user.admin === 'admin' || user.admin === 'superadmin');
  } catch (e) {
    console.error('[ADMIN CHECK ERROR]', e);
    return false;
  }
}

const commands = new Map();

// Command: /ping
commands.set('ping', async (sock, message) => {
    const start = Date.now();
    await sock.sendMessage(message.key.remoteJid, { text: "🏓 *Pong !* Bot eFootball opérationnel." });
    const latency = Date.now() - start;
    console.log(`[DIAG] Ping latency: ${latency}ms`);
});

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const senderName = message.pushName || 'Compétiteur eFootball';

  let userStats = await UserStats.findOne({ where: { whatsappId: jid } });
  if (!userStats) {
    userStats = await UserStats.create({
      whatsappId: jid,
      name: senderName
    });
    await sock.sendMessage(replyJid, { text: `⚽ *Bienvenue dans la League eFootball ARISE !*\n\nProfil créé avec succès pour *${senderName}*.\n\nUtilisez \`/profil\` pour voir vos stats, \`/classement\` pour voir le leaderboard, ou \`/help\` pour afficher l'aide.` });
  } else {
    await sock.sendMessage(replyJid, { text: `⚽ Content de vous revoir, *${userStats.name}* !\nVos statistiques sont déjà prêtes dans la base de données. Tapez \`/profil\` pour les consulter.` });
  }
});

// Command: /profil and /stats
const profileCommand = async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  let userStats = await UserStats.findOne({ where: { whatsappId: jid } });
  if (!userStats) {
    const senderName = message.pushName || 'Compétiteur';
    userStats = await UserStats.create({
      whatsappId: jid,
      name: senderName
    });
  }

  try {
    const cardBuffer = await generateUserStatsCard(userStats);
    const textCaption = `╔══════════════════════════╗\n` +
                        `   📊 *STATS LEAGUE eFOOTBALL*   \n` +
                        `╚══════════════════════════╝\n\n` +
                        `👤 *Compétiteur :* ${userStats.name}\n` +
                        `🏆 *Points :* ${userStats.points} pts\n` +
                        `✅ *Victoires :* ${userStats.wins}\n` +
                        `🤝 *Nuls :* ${userStats.draws}\n` +
                        `❌ *Défaites :* ${userStats.losses}\n\n` +
                        `⚽ *Buts Marqués :* ${userStats.goalsScored}\n` +
                        `🛡️ *Buts Encaissés :* ${userStats.goalsConceded}\n` +
                        `📈 *Différence :* ${userStats.goalsScored - userStats.goalsConceded}\n\n` +
                        `⚡ *Marque de Fabrique ARISE*`;

    await sock.sendMessage(replyJid, {
      image: cardBuffer,
      caption: textCaption
    });
  } catch (err) {
    console.error('Error in profile command:', err);
    await sock.sendMessage(replyJid, { text: `Erreur lors de la génération de votre visuel.` });
  }
};
commands.set('profile', profileCommand);
commands.set('profil', profileCommand);
commands.set('stats', profileCommand);

// Command: /joueur <nom>
commands.set('joueur', async (sock, message, args) => {
  const replyJid = message.key.remoteJid;
  const nameQuery = args.join(' ').trim();

  if (!nameQuery) {
    // Show available players
    const players = await FootballPlayer.findAll();
    const listText = players.map(p => `• *${p.name}* (${p.position} - ${p.rating})`).join('\n');
    return await sock.sendMessage(replyJid, { text: `⚽ *Joueurs eFootball Disponibles :*\n\n${listText}\n\nUtilisez \`/joueur <nom>\` pour voir la carte complète d'un joueur !` });
  }

  const p = await FootballPlayer.findOne({
    where: {
      name: { [Op.like]: `%${nameQuery}%` }
    }
  });

  if (!p) {
    return await sock.sendMessage(replyJid, { text: `❌ Impossible de trouver un joueur correspondant à "${nameQuery}".` });
  }

  try {
    const cardBuffer = await generatePlayerCard(p);
    const caption = `🌟 *CARTE eFOOTBALL DU JOUEUR : ${p.name.toUpperCase()}*\n\n` +
                    `🏅 *Note Générale :* ${p.rating}\n` +
                    `🏃 *Poste :* ${p.position}\n` +
                    `🏳️ *Pays :* ${p.country}\n` +
                    `🛡️ *Club :* ${p.club}\n` +
                    `🏷️ *Type :* ${p.cardType}\n\n` +
                    `⚡ *Marque de Fabrique ARISE*`;

    await sock.sendMessage(replyJid, {
      image: cardBuffer,
      caption: caption
    });
  } catch (err) {
    console.error('Error generating player card:', err);
    await sock.sendMessage(replyJid, { text: `Erreur lors de la génération de la carte du joueur.` });
  }
});

// Command: /update_stats @mention <V/N/D> <goals_p> <goals_c>
commands.set('update_stats', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  // Check admin rights
  const isAdmin = await isGroupAdmin(sock, message, jid);
  if (!isAdmin) {
    return await sock.sendMessage(replyJid, { text: `❌ *Sécurité eFootball* : Seuls les administrateurs du groupe peuvent modifier les statistiques des joueurs.` });
  }

  let targetJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  // Check if JID can be extracted from text or args
  if (!targetJid && args[0] && args[0].startsWith('@')) {
    const cleanNumber = args[0].replace(/[^0-9]/g, '');
    targetJid = `${cleanNumber}@s.whatsapp.net`;
  }

  if (!targetJid) {
    return await sock.sendMessage(replyJid, { text: `❌ Veuillez mentionner un joueur pour mettre à jour ses statistiques.\nFormat : \`/update_stats @joueur <V/N/D> <buts_pour> <buts_contre>\`` });
  }

  // Shift target out of args if it's there
  if (args[0] && args[0].startsWith('@')) {
    args.shift();
  }

  const resultType = args[0]?.toUpperCase(); // V, N, or D
  const goalsP = parseInt(args[1]);
  const goalsC = parseInt(args[2]);

  if (!['V', 'N', 'D'].includes(resultType) || isNaN(goalsP) || isNaN(goalsC)) {
    return await sock.sendMessage(replyJid, { text: `❌ Format d'arguments invalide.\nFormat : \`/update_stats @joueur <V/N/D> <buts_pour> <buts_contre>\`\nExemple : \`/update_stats @John N 2 2\`` });
  }

  let userStats = await UserStats.findOne({ where: { whatsappId: targetJid } });
  if (!userStats) {
    userStats = await UserStats.create({
      whatsappId: targetJid,
      name: 'Nouveau Joueur'
    });
  }

  let ptsToAdd = 0;
  if (resultType === 'V') {
    userStats.wins += 1;
    ptsToAdd = 3;
  } else if (resultType === 'N') {
    userStats.draws += 1;
    ptsToAdd = 1;
  } else if (resultType === 'D') {
    userStats.losses += 1;
  }

  userStats.goalsScored += goalsP;
  userStats.goalsConceded += goalsC;
  userStats.points += ptsToAdd;

  await userStats.save();

  // Generate newly updated card
  try {
    const cardBuffer = await generateUserStatsCard(userStats);
    await sock.sendMessage(replyJid, {
      image: cardBuffer,
      caption: `✅ *Mise à jour réussie par l'Administrateur !*\n\nCompétiteur : *${userStats.name}*\nRésultat : *${resultType === 'V' ? 'Victoire' : (resultType === 'N' ? 'Nul' : 'Défaite')}* (${goalsP} - ${goalsC})\nNouveau total de points : *${userStats.points} pts*\n\n⚡ *Marque de Fabrique ARISE*`
    });
  } catch (err) {
    await sock.sendMessage(replyJid, { text: `✅ *Statistiques mises à jour !* (Erreur lors du rendu de l'image de profil)` });
  }
});

// Command: /classement
commands.set('classement', async (sock, message) => {
  const replyJid = message.key.remoteJid;

  const users = await UserStats.findAll({
    order: [
      ['points', 'DESC'],
      [sequelize.literal('"goalsScored" - "goalsConceded"'), 'DESC'],
      ['goalsScored', 'DESC']
    ],
    limit: 15
  });

  if (users.length === 0) {
    return await sock.sendMessage(replyJid, { text: `⚽ Aucun joueur enregistré pour le moment. Utilisez \`/start\` pour vous inscrire !` });
  }

  let text = `╔══════════════════════════╗\n` +
             `   🏆 *LEADERBOARD eFOOTBALL ARISE*  \n` +
             `╚══════════════════════════╝\n\n`;

  users.forEach((u, i) => {
    const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : '👤'));
    const gd = u.goalsScored - u.goalsConceded;
    const gdSign = gd >= 0 ? `+${gd}` : `${gd}`;
    text += `${medal} *${i + 1}. ${u.name}*\n└ *${u.points} pts* | M: ${u.wins + u.draws + u.losses} | V: ${u.wins} N: ${u.draws} D: ${u.losses} | Diff: ${gdSign}\n\n`;
  });

  text += `⚡ *Marque de Fabrique ARISE*`;

  await sock.sendMessage(replyJid, { text });
});

// Command: /help
commands.set('help', async (sock, message) => {
  const helpText = `╔══════════════════════════╗\n` +
                   `   ⚽ *AIDE BOT eFOOTBALL ARISE*  \n` +
                   `╚══════════════════════════╝\n\n` +
                   `Voici la liste des commandes disponibles :\n\n` +
                   `• \`/start\` : Créer ou réactiver son profil de ligue eFootball.\n` +
                   `• \`/profil\` / \`/stats\` : Afficher sa carte de statistiques et performances ARISE.\n` +
                   `• \`/classement\` : Voir le classement de la ligue du groupe WhatsApp.\n` +
                   `• \`/joueur <nom>\` : Afficher une carte eFootball détaillée (Messi, Ronaldo, Neymar, Yamal).\n\n` +
                   `👮 *Commandes Administrateur* :\n` +
                   `• \`/update_stats @mention <V/N/D> <buts_marqués> <buts_encaissés>\` : Met à jour les stats d'un joueur suite à un match.\n\n` +
                   `⚡ *Marque de Fabrique ARISE*`;

  await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Main command handler
async function handleCommand(sock, message, downloadMediaMessage) {
  if (message.key.fromMe) return;

  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const senderName = message.pushName || jid;

  console.log(`[eFootball MSG] From "${senderName}" (${jid}) in ${replyJid}: "${messageText}"`);

  // Handle standard commands
  if (!messageText.startsWith('/')) return;

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
  } else {
    await sock.sendMessage(replyJid, { text: "Commande inconnue. Tape /help pour voir la liste des commandes eFootball." });
  }
}

module.exports = { handleCommand, getJid };
