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
  const welcomeImagePath = path.join(__dirname, 'assets/efootball/victory_welcome.png');
  const hasWelcomeImg = fs.existsSync(welcomeImagePath);

  const captionText = `⚽ *Bienvenue dans la League eFootball ARISE !*\n\n` +
                      `Profil créé/activé avec succès pour *${senderName}*.\n\n` +
                      `Utilisez \`/profil\` pour voir vos stats, \`/classement\` pour voir le leaderboard, ou \`/help\` pour afficher l'aide.\n\n` +
                      `🏆 *VICTORY* • *ARISE*`;

  if (!userStats) {
    userStats = await UserStats.create({
      whatsappId: jid,
      name: senderName
    });
  }

  if (hasWelcomeImg) {
    await sock.sendMessage(replyJid, {
      image: fs.readFileSync(welcomeImagePath),
      caption: captionText
    });
  } else {
    await sock.sendMessage(replyJid, { text: captionText });
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

// Command: /addchips @mention <montant>
commands.set('addchips', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  // Check admin rights
  const isAdmin = await isGroupAdmin(sock, message, jid);
  if (!isAdmin) {
    return await sock.sendMessage(replyJid, { text: `❌ *Sécurité eFootball Casino* : Seuls les administrateurs du groupe peuvent ajouter des jetons.` });
  }

  let targetJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (!targetJid && args[0] && args[0].startsWith('@')) {
    const cleanNumber = args[0].replace(/[^0-9]/g, '');
    targetJid = `${cleanNumber}@s.whatsapp.net`;
  }

  if (!targetJid) {
    return await sock.sendMessage(replyJid, { text: `❌ Veuillez mentionner un membre pour lui donner des jetons.\nFormat : \`/addchips @joueur <montant>\`` });
  }

  if (args[0] && args[0].startsWith('@')) {
    args.shift();
  }

  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount <= 0) {
    return await sock.sendMessage(replyJid, { text: `❌ Montant invalide. Exemple : \`/addchips @joueur 1000\`` });
  }

  let userStats = await UserStats.findOne({ where: { whatsappId: targetJid } });
  if (!userStats) {
    userStats = await UserStats.create({
      whatsappId: targetJid,
      name: 'Nouveau Joueur'
    });
  }

  userStats.casinoChips += amount;
  await userStats.save();

  await sock.sendMessage(replyJid, {
    text: `🎰 *DÉPÔT CASINO ADMIN RÉUSSI !*\n\n` +
          `👤 *Bénéficiaire :* ${userStats.name}\n` +
          `🪙 *Jetons Ajoutés :* +${amount.toLocaleString()} 🪙\n` +
          `💰 *Nouveau Solde :* ${userStats.casinoChips.toLocaleString()} 🪙\n\n` +
          `⚡ *Marque de Fabrique ARISE*`
  });
});

// Command: /chips and /jetons
const chipsCommand = async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  let userStats = await UserStats.findOne({ where: { whatsappId: jid } });
  if (!userStats) {
    userStats = await UserStats.create({
      whatsappId: jid,
      name: message.pushName || 'Compétiteur'
    });
  }

  await sock.sendMessage(replyJid, {
    text: `🎰 *VOTRE PORTE-FEUILLE CASINO eFOOTBALL*\n\n` +
          `👤 *Joueur :* ${userStats.name}\n` +
          `🪙 *Solde Jetons :* ${userStats.casinoChips.toLocaleString()} 🪙\n\n` +
          `🎮 *Jeux disponibles :*\n` +
          `• \`/slots <mise>\` : Machine à sous eFootball\n` +
          `• \`/roulette <pari> <mise>\` : Roulette (rouge/noir/pair/impair/0-36)\n` +
          `• \`/blackjack <mise>\` : Duel de cartes 21 contre le croupier\n\n` +
          `⚡ *Marque de Fabrique ARISE*`
  });
};
commands.set('chips', chipsCommand);
commands.set('jetons', chipsCommand);

// Command: /slots <mise>
commands.set('slots', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  let userStats = await UserStats.findOne({ where: { whatsappId: jid } });
  if (!userStats) {
    userStats = await UserStats.create({
      whatsappId: jid,
      name: message.pushName || 'Compétiteur'
    });
  }

  const bet = parseInt(args[0]);
  if (isNaN(bet) || bet <= 0) {
    return await sock.sendMessage(replyJid, { text: `❌ Veuillez indiquer une mise valide. Exemple : \`/slots 100\`` });
  }

  if (userStats.casinoChips < bet) {
    return await sock.sendMessage(replyJid, { text: `❌ Jetons insuffisants (${userStats.casinoChips.toLocaleString()} 🪙 disponibles). Demandez à un admin avec \`/addchips\`.` });
  }

  const symbols = ['⚽', '🏆', '🥇', '👟', '🥅', '⭐', '🔥'];
  const r1 = symbols[Math.floor(Math.random() * symbols.length)];
  const r2 = symbols[Math.floor(Math.random() * symbols.length)];
  const r3 = symbols[Math.floor(Math.random() * symbols.length)];

  let winMult = 0;
  if (r1 === r2 && r2 === r3) {
    if (r1 === '⚽') winMult = 10;
    else if (r1 === '🏆') winMult = 7;
    else winMult = 5;
  } else if (r1 === r2 || r2 === r3 || r1 === r3) {
    winMult = 2;
  }

  const netGain = (bet * winMult) - bet;
  userStats.casinoChips += netGain;
  await userStats.save();

  let resultMsg = `🎰 *MACHINE À SOUS eFOOTBALL*\n\n` +
                  `╔═════════════════╗\n` +
                  `   [  ${r1}  |  ${r2}  |  ${r3}  ]   \n` +
                  `╚═════════════════╝\n\n`;

  if (winMult > 0) {
    resultMsg += `🎉 *JACKPOT !* Vous gagnez x${winMult} ( +${(bet * winMult).toLocaleString()} 🪙 ) !\n`;
  } else {
    resultMsg += `💸 *Perdu...* (-${bet.toLocaleString()} 🪙)\n`;
  }

  resultMsg += `💰 *Nouveau Solde :* ${userStats.casinoChips.toLocaleString()} 🪙\n\n` +
               `⚡ *Marque de Fabrique ARISE*`;

  await sock.sendMessage(replyJid, { text: resultMsg });
});

// Command: /roulette <pari> <mise>
commands.set('roulette', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  let userStats = await UserStats.findOne({ where: { whatsappId: jid } });
  if (!userStats) {
    userStats = await UserStats.create({
      whatsappId: jid,
      name: message.pushName || 'Compétiteur'
    });
  }

  const betType = args[0]?.toLowerCase();
  const bet = parseInt(args[1]);

  if (!betType || isNaN(bet) || bet <= 0) {
    return await sock.sendMessage(replyJid, { text: `❌ Format invalide.\nUsage : \`/roulette <rouge/noir/pair/impair/0-36> <mise>\`\nExemple : \`/roulette rouge 200\`` });
  }

  if (userStats.casinoChips < bet) {
    return await sock.sendMessage(replyJid, { text: `❌ Jetons insuffisants (${userStats.casinoChips.toLocaleString()} 🪙 disponibles).` });
  }

  const num = Math.floor(Math.random() * 37); // 0 to 36
  const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const color = num === 0 ? 'vert' : (redNumbers.includes(num) ? 'rouge' : 'noir');
  const parity = num === 0 ? 'zero' : (num % 2 === 0 ? 'pair' : 'impair');

  let won = false;
  let mult = 0;

  if (betType === color) {
    won = true;
    mult = 2;
  } else if (betType === parity) {
    won = true;
    mult = 2;
  } else if (!isNaN(parseInt(betType)) && parseInt(betType) === num) {
    won = true;
    mult = 36;
  }

  const netGain = won ? (bet * mult) - bet : -bet;
  userStats.casinoChips += netGain;
  await userStats.save();

  let msg = `🎡 *ROULETTE CASINO ARISE*\n\n` +
            `🎯 *Résultat de la bille :* ${num} (${color.toUpperCase()}, ${parity.toUpperCase()})\n\n`;

  if (won) {
    msg += `🎉 *GAGNÉ !* Vous remportez +${(bet * mult).toLocaleString()} 🪙 !\n`;
  } else {
    msg += `💸 *PERDU...* (-${bet.toLocaleString()} 🪙)\n`;
  }

  msg += `💰 *Solde Actuel :* ${userStats.casinoChips.toLocaleString()} 🪙\n\n` +
         `⚡ *Marque de Fabrique ARISE*`;

  await sock.sendMessage(replyJid, { text: msg });
});

// Command: /blackjack <mise>
commands.set('blackjack', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  let userStats = await UserStats.findOne({ where: { whatsappId: jid } });
  if (!userStats) {
    userStats = await UserStats.create({
      whatsappId: jid,
      name: message.pushName || 'Compétiteur'
    });
  }

  const bet = parseInt(args[0]);
  if (isNaN(bet) || bet <= 0) {
    return await sock.sendMessage(replyJid, { text: `❌ Veuillez indiquer une mise valide. Exemple : \`/blackjack 150\`` });
  }

  if (userStats.casinoChips < bet) {
    return await sock.sendMessage(replyJid, { text: `❌ Jetons insuffisants (${userStats.casinoChips.toLocaleString()} 🪙 disponibles).` });
  }

  const drawCard = () => Math.floor(Math.random() * 10) + 1; // 1 to 10
  const userScore = drawCard() + drawCard();
  let dealerScore = drawCard() + drawCard();

  while (dealerScore < 16) {
    dealerScore += drawCard();
  }

  let won = false;
  let draw = false;

  if (userScore > 21) {
    won = false;
  } else if (dealerScore > 21 || userScore > dealerScore) {
    won = true;
  } else if (userScore === dealerScore) {
    draw = true;
  }

  let netGain = 0;
  if (won) {
    netGain = bet;
    userStats.casinoChips += netGain;
  } else if (!draw) {
    netGain = -bet;
    userStats.casinoChips += netGain;
  }
  await userStats.save();

  let msg = `🎴 *DUEL BLACKJACK eFOOTBALL*\n\n` +
            `👤 *Vos cartes :* Score de ${userScore}\n` +
            `🎰 *Croupier :* Score de ${dealerScore}\n\n`;

  if (won) {
    msg += `🎉 *VICTOIRE !* Vous gagnez +${bet.toLocaleString()} 🪙 !\n`;
  } else if (draw) {
    msg += `🤝 *ÉGALITÉ !* Votre mise de ${bet.toLocaleString()} 🪙 vous est rendue.\n`;
  } else {
    msg += `💸 *DÉFAITE...* (-${bet.toLocaleString()} 🪙)\n`;
  }

  msg += `💰 *Nouveau Solde :* ${userStats.casinoChips.toLocaleString()} 🪙\n\n` +
         `⚡ *Marque de Fabrique ARISE*`;

  await sock.sendMessage(replyJid, { text: msg });
});

// Command: /tagall and /all
const tagAllCommand = async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  if (!replyJid.endsWith('@g.us')) {
    return await sock.sendMessage(replyJid, { text: `❌ La commande /tagall ne peut être utilisée que dans un groupe WhatsApp.` });
  }

  // Check admin rights
  const isAdmin = await isGroupAdmin(sock, message, jid);
  if (!isAdmin) {
    return await sock.sendMessage(replyJid, { text: `❌ *Sécurité eFootball* : Seuls les administrateurs du groupe peuvent faire un Tag All.` });
  }

  try {
    const metadata = await sock.groupMetadata(replyJid);
    const participants = metadata.participants || [];

    if (participants.length === 0) {
      return await sock.sendMessage(replyJid, { text: `❌ Aucun membre trouvé dans le groupe.` });
    }

    const mentions = participants.map(p => p.id);
    const customMessage = args.join(' ').trim() || "Message de l'administrateur";

    let tagText = `📢 *CONVOCATION eFOOTBALL LEAGUE - TAG ALL*\n\n`;
    tagText += `📝 *Message :* ${customMessage}\n\n`;
    participants.forEach((p, idx) => {
      const num = p.id.split('@')[0];
      tagText += `${idx + 1}. @${num}\n`;
    });
    tagText += `\n⚡ *Marque de Fabrique ARISE*`;

    await sock.sendMessage(replyJid, {
      text: tagText,
      mentions: mentions
    });
  } catch (err) {
    console.error('Error in tagall command:', err);
    await sock.sendMessage(replyJid, { text: `Erreur lors de l'exécution de la commande /tagall.` });
  }
};

commands.set('tagall', tagAllCommand);
commands.set('all', tagAllCommand);

// Command: /help
commands.set('help', async (sock, message) => {
  const helpText = `╔══════════════════════════╗\n` +
                   `   ⚽ *AIDE BOT eFOOTBALL ARISE*  \n` +
                   `╚══════════════════════════╝\n\n` +
                   `Voici la liste des commandes disponibles :\n\n` +
                   `• \`/start\` : Créer ou réactiver son profil de ligue eFootball.\n` +
                   `• \`/profil\` / \`/stats\` : Afficher sa carte de statistiques et performances ARISE.\n` +
                   `• \`/classement\` : Voir le classement de la ligue du groupe WhatsApp.\n` +
                   `• \`/joueur <nom>\` : Afficher une carte eFootball détaillée (Messi, Mbappé, Haaland, Ronaldo).\n\n` +
                   `🎰 *Jeux de Casino eFootball* :\n` +
                   `• \`/chips\` / \`/jetons\` : Afficher votre solde de jetons casino.\n` +
                   `• \`/slots <mise>\` : Machine à sous eFootball.\n` +
                   `• \`/roulette <rouge/noir/pair/impair/0-36> <mise>\` : Roulette casino.\n` +
                   `• \`/blackjack <mise>\` : Duel 21 contre le croupier.\n\n` +
                   `👮 *Commandes Administrateur* :\n` +
                   `• \`/update_stats @mention <V/N/D> <buts_marqués> <buts_encaissés>\` : Met à jour les stats d'un joueur suite à un match.\n` +
                   `• \`/addchips @mention <montant>\` : Ajoute des jetons casino à un membre du groupe.\n` +
                   `• \`/tagall\` / \`/all [message]\` : Mentionne tous les membres du groupe WhatsApp.\n\n` +
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
