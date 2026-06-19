const fs = require('fs');
const path = require('path');
const { Player, Club, Trophy, ContractOffer, NPC, Card, OwnedCard, sequelize } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { startMatch, handleMatchAction } = require('./match-handler');
const { generateFormationImage } = require('./formation-generator');
const { generateStatCard } = require('./stat-visualizer');
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

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  let player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player) {
    player = await Player.create({ whatsappId: jid, registrationStep: 'awaiting_name' });
    await sock.sendMessage(replyJid, { text: "⚽ *FOOTBALL CAREER PRO* ⚽\n\nBienvenue dans le monde du foot. Prêt à devenir une légende ?\n\nQuel est ton nom de joueur ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `Ravi de te revoir, ${player.name} ! Tape /menu pour voir tes options.` });
  }
});

// Command: /menu
commands.set('menu', async (sock, message) => {
    const menuText = `⚽ *FOOTBALL CAREER MENU* ⚽\n\n` +
                     `👤 /profil - Dossier & Joueurs.\n` +
                     `📊 /stats - Fiche de renseignements.\n` +
                     `🛒 /boutique - Acheter des joueurs.\n` +
                     `💱 /convertir - Sparks -> Locks.\n` +
                     `🌍 /monde - Exploration & Monde Ouvert.\n` +
                     `📋 /formation - Voir le 11 de départ.\n` +
                     `💼 /contrats - Gérer tes offres.\n` +
                     `💾 /save - Sauvegarder ta progression.\n\n` +
                     `_Mode Action :_ /action | /quit`;
    await sock.sendMessage(message.key.remoteJid, { text: menuText });
});

// Command: /profil
commands.set('profil', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid }, include: ['currentClub'] });
  if (!player) return;

  const ownedCards = await OwnedCard.findAll({ where: { playerWhatsappId: jid }, include: [Card] });
  const cardNames = ownedCards.map(oc => oc.Card.name).join(', ') || 'Aucun';

  const profileText = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                      `┃  ⚽ DOSSIER PRO : ${player.name.toUpperCase()} \n` +
                      `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                      `🌍 *NATION:* ${player.nation}\n` +
                      `📍 *POSTE:* ${player.position} | 🔟 *N°:* ${player.jerseyNumber}\n` +
                      `💰 *LOCK:* ${player.locks} | 💎 *SPARK:* ${player.sparks}\n\n` +
                      `🎴 *JOUEURS POSSÉDÉS:* ${cardNames}\n\n` +
                      `_Tape /stats pour voir ta fiche visuelle._`;

  await sock.sendMessage(replyJid, { text: profileText });
});

commands.set('stats', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    const buffer = await generateStatCard(player);
    await sock.sendMessage(message.key.remoteJid, { image: buffer, caption: `📊 Fiche de renseignements : ${player.name}` });
});

// Command: /monde
commands.set('monde', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    const text = `🌍 *EXPLORATION MONDE* 🌍\n\n` +
                 `📍 *LIEU:* ${player.location}\n` +
                 `📍 *VILLE:* ${player.city} (${player.country})\n\n` +
                 `_Dis simplement à l'IA où tu veux aller ou ce que tu veux faire._\n` +
                 `_Ex: "Je veux aller au restaurant" ou "Je vais au stade pour m'entraîner"._`;
    await sock.sendMessage(message.key.remoteJid, { text: text });
});

commands.set('contrats', async (sock, message) => {
    const jid = getJid(message);
    const offers = await ContractOffer.findAll({ where: { playerWhatsappId: jid, status: 'pending' }, include: [Club] });
    if (offers.length === 0) return sock.sendMessage(message.key.remoteJid, { text: "📩 Aucune offre en attente." });

    let msg = `📩 *OFFRES DISPONIBLES* 📩\n\n`;
    offers.forEach((o, i) => { msg += `${i+1}. 🏢 *${o.Club.name}*\n   💰 ${o.salary}€/m | 🔟 N°${o.jerseyNumber}\n   ✅ /accepter ${o.id}\n\n`; });
    await sock.sendMessage(message.key.remoteJid, { text: msg });
});

commands.set('formation', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid }, include: ['currentClub'] });
    if (!player) return;

    const buffer = await generateFormationImage(player);
    await sock.sendMessage(message.key.remoteJid, { image: buffer, caption: `📋 *TACTIQUE : ${player.currentClub?.name || 'Libre'}*\nPoste: ${player.position} | N°: ${player.jerseyNumber}` });
});

commands.set('accepter', async (sock, message, args) => {
    const jid = getJid(message);
    const offer = await ContractOffer.findOne({ where: { id: args[0], playerWhatsappId: jid }, include: [Club] });
    if (!offer) return;
    const player = await Player.findOne({ where: { whatsappId: jid } });
    await player.update({ currentClubId: offer.clubId, salary: offer.salary, jerseyNumber: offer.jerseyNumber });
    await offer.update({ status: 'accepted' });
    await sock.sendMessage(message.key.remoteJid, { text: `✅ Signature chez *${offer.Club.name}* !` });
});

commands.set('action', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) { await player.update({ mode: 'action' }); await sock.sendMessage(message.key.remoteJid, { text: "⚽ MODE ACTION ACTIVÉ. Parle librement à l'IA." }); }
});

commands.set('quit', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) { await player.update({ mode: 'normal' }); await sock.sendMessage(message.key.remoteJid, { text: "🚪 Mode action quitté. Tu es libre de tes mouvements." }); }
});

commands.set('save', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await player.save();
        await sock.sendMessage(message.key.remoteJid, { text: "💾 *PROGRES SAUVEGARDÉS* : Ta carrière est en sécurité dans le Cloud." });
    }
});

commands.set('boutique', async (sock, message) => {
    const cards = await Card.findAll();
    let msg = `🛒 *BOUTIQUE BLUE LOCK* 🛒\n\n`;
    cards.forEach(c => {
        msg += `🎴 *${c.name}*\n`;
        msg += `   📊 Tir:${c.shoot} Vit:${c.speed} Dri:${c.dribble}\n`;
        msg += `   💰 ${c.priceLock} Locks | ${c.priceSpark} Sparks\n`;
        msg += `   🛒 /acheter ${c.id}\n\n`;
    });
    await sock.sendMessage(message.key.remoteJid, { text: msg });
});

commands.set('acheter', async (sock, message, args) => {
    const jid = getJid(message);
    const cardId = args[0];
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const card = await Card.findByPk(cardId);

    if (!card) return sock.sendMessage(message.key.remoteJid, { text: "❌ Joueur introuvable." });

    const alreadyOwned = await OwnedCard.findOne({ where: { playerWhatsappId: jid, cardId } });
    if (alreadyOwned) return sock.sendMessage(message.key.remoteJid, { text: "❌ Tu possèdes déjà ce joueur." });

    if (player.locks >= card.priceLock) {
        await player.decrement('locks', { by: card.priceLock });
    } else if (player.sparks >= card.priceSpark) {
        await player.decrement('sparks', { by: card.priceSpark });
    } else {
        return sock.sendMessage(message.key.remoteJid, { text: "❌ Fonds insuffisants (Locks ou Sparks)." });
    }

    await OwnedCard.create({ playerWhatsappId: jid, cardId });
    await sock.sendMessage(message.key.remoteJid, { text: `✅ Tu as acheté *${card.name}* !` });
});

commands.set('match', async (sock, message, args) => {
    const type = args[0] || '1v1'; // 1v1, 2v2, 3v3
    const replyJid = message.key.remoteJid;
    const jid = getJid(message);

    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    let participants = [player];

    const mentions = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    for (const mJid of mentions) {
        const p = await Player.findOne({ where: { whatsappId: mJid } });
        if (p) participants.push(p);
    }

    if (type === '1v1' && participants.length < 2) {
        const opponent = await Player.findOne({ where: { whatsappId: { [Op.ne]: jid } } });
        if (opponent) participants.push(opponent);
        else return sock.sendMessage(replyJid, { text: "❌ Il faut au moins un autre joueur enregistré pour un 1v1." });
    }

    await startMatch(sock, replyJid, type, participants);
});

commands.set('convertir', async (sock, message, args) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const amountSpark = parseInt(args[0]) || 250;

    if (amountSpark < 250) return sock.sendMessage(message.key.remoteJid, { text: "❌ Minimum 250 Sparks pour convertir." });
    if (player.sparks < amountSpark) return sock.sendMessage(message.key.remoteJid, { text: "❌ Pas assez de Sparks." });

    const locksGained = Math.floor(amountSpark / 250) * 5;
    const spentSparks = Math.floor(amountSpark / 250) * 250;

    await player.decrement('sparks', { by: spentSparks });
    await player.increment('locks', { by: locksGained });

    await sock.sendMessage(message.key.remoteJid, { text: `✅ Conversion réussie : ${spentSparks} Sparks ➔ ${locksGained} Locks.` });
});

commands.set('reset', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await player.destroy();
        await sock.sendMessage(message.key.remoteJid, { text: "✅ Ton profil a été réinitialisé. Tape /start pour recommencer ta carrière." });
    }
});

commands.set('status', async (sock, message) => {
    try {
        await sequelize.authenticate();
        const playerCount = await Player.count();
        const clubCount = await Club.count();
        const dbType = process.env.DATABASE_URL ? "PostgreSQL (Cloud)" : "SQLite (Local)";

        const statusMsg = `📊 *SYSTÈME FOOTBALL CAREER* 📊\n\n` +
                          `🗄️ *Base de données:* ${dbType}\n` +
                          `👥 *Joueurs enregistrés:* ${playerCount}\n` +
                          `🏢 *Clubs actifs:* ${clubCount}\n` +
                          `✅ *Connexion:* Stable`;
        await sock.sendMessage(message.key.remoteJid, { text: statusMsg });
    } catch (e) {
        await sock.sendMessage(message.key.remoteJid, { text: "❌ *ERREUR SYSTÈME* : Base de données inaccessible." });
    }
});

commands.set('checkai', async (sock, message) => {
    const jid = message.key.remoteJid;
    await sock.sendMessage(jid, { text: "🔍 *DIAGNOSTIC IA* : Test des serveurs en cours..." });

    const { callAI } = require('./ai-utils');
    try {
        const res = await callAI("Test", "Dis 'OK' en un mot.", true);
        await sock.sendMessage(jid, { text: `🔍 *RÉSULTATS DIAGNOSTIC :*\n\n${res}` });
    } catch (e) {
        await sock.sendMessage(jid, { text: `❌ *ERREUR DIAGNOSTIC* : ${e.message}` });
    }
});

async function handleCommand(sock, message) {
  if (message.key.fromMe) return;
  const messageText = message.message.conversation ||
                      message.message.extendedTextMessage?.text ||
                      message.message.imageMessage?.caption ||
                      message.message.videoMessage?.caption;

  if (!messageText) return;

  const jid = getJid(message);
  console.log(`[CMD] Message reçu de ${jid}: ${messageText.substring(0, 50)}...`);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  // Match Action Interception
  if (player && !messageText.startsWith('/')) {
      const inMatch = await handleMatchAction(sock, message, player, messageText);
      if (inMatch) return;
  }

  // Registration
  if (player && player.registrationStep) {
      if (player.registrationStep === 'awaiting_name') {
          await player.update({ name: messageText.trim(), registrationStep: 'awaiting_position' });
          await sock.sendMessage(replyJid, { text: `Poste ? (GK, DEF, MID, FWD)` });
      } else if (player.registrationStep === 'awaiting_position') {
          await player.update({ position: messageText.toUpperCase(), registrationStep: 'awaiting_nation' });
          await sock.sendMessage(replyJid, { text: `Nation ?` });
      } else if (player.registrationStep === 'awaiting_nation') {
          const club = await Club.findOne({ where: { name: 'Club de Formation' } });
          await player.update({ nation: messageText.trim(), registrationStep: 'awaiting_appearance', currentClubId: club.id });
          await sock.sendMessage(replyJid, { text: `Envoie ton image d'apparence.` });
      }
      return;
  }

  if (player?.mode === 'action' && !messageText.startsWith('/')) {
    console.log(`[CMD] Transfert vers handleFreeAction pour ${player.name}`);
    await handleFreeAction(sock, message, player, messageText);
    return;
  }

  if (!messageText.startsWith('/')) return;
  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);
  if (command) await command(sock, message, args);
}

module.exports = { handleCommand, getJid };
