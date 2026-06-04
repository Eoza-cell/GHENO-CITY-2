const fs = require('fs');
const path = require('path');
const { Player, Club, Trophy, ContractOffer, NPC, sequelize } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { generateFormationImage } = require('./formation-generator');
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
                     `👤 /profil - Dossier & Stats.\n` +
                     `🌍 /monde - Exploration & Monde Ouvert.\n` +
                     `📋 /formation - Voir le 11 de départ.\n` +
                     `💼 /contrats - Gérer tes offres.\n\n` +
                     `_Le MJ gère tes matchs et déplacements._\n` +
                     `_Mode Action :_ /action | /quit`;
    await sock.sendMessage(message.key.remoteJid, { text: menuText });
});

// Command: /profil
commands.set('profil', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid }, include: ['currentClub'] });
  if (!player) return;

  const staminaBar = createStatusBar(player.stamina, 100);

  const profileText = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                      `┃  ⚽ DOSSIER PRO : ${player.name.toUpperCase()} \n` +
                      `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                      `🌍 *NATION:* ${player.nation}\n` +
                      `📍 *POSTE:* ${player.position} | 🔟 *N°:* ${player.jerseyNumber}\n` +
                      `🏢 *CLUB:* ${player.currentClub?.name || 'Libre'}\n` +
                      `📅 *JOUR RP:* Jour ${player.currentDay}\n\n` +
                      `📊 *STATS :*\n` +
                      `👟 Tir: ${player.shoot} | 🎯 Passe: ${player.pass}\n` +
                      `✨ Dribble: ${player.dribble} | 🛡️ Défense: ${player.defense}\n` +
                      `⚡ Vitesse: ${player.speed} | 🔋 Stamina: [${staminaBar}]\n\n` +
                      `_Le MJ gère tes aventures._`;

  if (player.appearanceImageUrl && fs.existsSync(player.appearanceImageUrl)) {
      await sock.sendMessage(replyJid, { image: fs.readFileSync(player.appearanceImageUrl), caption: profileText });
  } else {
      await sock.sendMessage(replyJid, { text: profileText });
  }
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
    if (player) { await player.update({ mode: 'normal' }); await sock.sendMessage(message.key.remoteJid, { text: "Mode normal réactivé." }); }
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
    const start = Date.now();
    try {
        const res = await callAI("Test", "Dis 'OK' en un mot.");
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        await sock.sendMessage(jid, { text: `✅ *IA OPÉRATIONNELLE*\n⏱️ Temps: ${duration}s\n💬 Réponse: ${res.substring(0, 50)}` });
    } catch (e) {
        await sock.sendMessage(jid, { text: `❌ *IA HORS-LIGNE*\n⚠️ Erreur: ${e.message}` });
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
