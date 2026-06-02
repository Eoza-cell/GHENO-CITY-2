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

async function updateChrono(player) {
    const now = new Date();
    const diffMs = now - player.lastChronoUpdate;
    const diffMin = diffMs / (1000 * 60);
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
    player = await Player.create({ whatsappId: jid, registrationStep: 'awaiting_name' });
    await sock.sendMessage(replyJid, { text: "⚽ *FOOTBALL CAREER PRO* ⚽\n\nBienvenue, futur crack.\nQuel est ton nom de joueur ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `Ravi de te revoir, ${player.name} !` });
  }
});

// Command: /profil
commands.set('profil', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid }, include: ['currentClub'] });
  if (!player) return;

  await updateChrono(player);
  const staminaBar = createStatusBar(player.stamina, 100);

  const profileText = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                      `┃  ⚽ DOSSIER PRO : ${player.name.toUpperCase()} \n` +
                      `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                      `🌍 *NATION:* ${player.nation}\n` +
                      `📍 *POSTE:* ${player.position} | 🔟 *NUMÉRO:* ${player.jerseyNumber}\n` +
                      `🏢 *CLUB:* ${player.currentClub?.name || 'Sans club'}\n` +
                      `📅 *JOUR RP:* Jour ${player.currentDay}\n` +
                      `📍 *LIEU:* ${player.location} (${player.city}, ${player.country})\n` +
                      `💰 *SOLDE:* ${player.money.toLocaleString()} €\n\n` +
                      `📊 *STATS :*\n` +
                      `👟 Tir: ${player.shoot} | 🎯 Passe: ${player.pass}\n` +
                      `✨ Dribble: ${player.dribble} | 🛡️ Défense: ${player.defense}\n` +
                      `⚡ Vitesse: ${player.speed} | 🧠 IQ: ${player.iq}\n` +
                      `🔋 STAMINA: [${staminaBar}]\n\n` +
                      `_Tape /monde pour explorer._`;

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

    const text = `🌍 *OPEN WORLD EXPLORATION* 🌍\n\n` +
                 `📍 *LIEU ACTUEL:* ${player.location || 'Hôtel'}\n\n` +
                 `🚗 *DÉPLACEMENTS :*\n` +
                 `- /visiter [Hôtel | Restaurant | Marché | Stade | Entraînement]\n` +
                 `- /voyager [Pays] (Coût: 500€)\n\n` +
                 `💼 *CARRIÈRE :*\n` +
                 `- /contrats : Voir les offres de clubs.\n` +
                 `- /formation : Voir le 11 de départ.`;
    await sock.sendMessage(message.key.remoteJid, { text: text });
});

commands.set('visiter', async (sock, message, args) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const place = args[0];
    if (!player || !place) return;

    await player.update({ location: place, mode: 'action' });
    await sock.sendMessage(message.key.remoteJid, { text: `📍 Tu arrives à : *${place}*. Que fais-tu ?` });
});

commands.set('voyager', async (sock, message, args) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const pays = args.join(' ');
    if (!player || !pays) return;

    if (player.money < 500) return sock.sendMessage(message.key.remoteJid, { text: "❌ Pas assez d'argent pour le billet d'avion (500€)." });

    await player.decrement('money', { by: 500 });
    await player.update({ country: pays, city: 'Capitale', location: 'Aéroport' });
    await sock.sendMessage(message.key.remoteJid, { text: `✈️ Bienvenue en *${pays}* ! Ton solde : ${player.money}€.` });
});

commands.set('contrats', async (sock, message) => {
    const jid = getJid(message);
    const offers = await ContractOffer.findAll({ where: { playerWhatsappId: jid, status: 'pending' }, include: [Club] });

    if (offers.length === 0) return sock.sendMessage(message.key.remoteJid, { text: "📩 Aucune offre de contrat pour le moment." });

    let msg = `📩 *OFFRES DE CONTRAT* 📩\n\n`;
    offers.forEach((o, i) => {
        msg += `${i+1}. 🏢 *${o.Club.name}*\n   💰 Salaire: ${o.salary}€/match\n   🔟 Numéro proposé: ${o.jerseyNumber}\n   ✅ /accepter ${o.id}\n\n`;
    });
    await sock.sendMessage(message.key.remoteJid, { text: msg });
});

commands.set('formation', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid }, include: ['currentClub'] });
    if (!player) return;

    const buffer = await generateFormationImage(player);
    await sock.sendMessage(message.key.remoteJid, { image: buffer, caption: `📋 *FORMATION TACTIQUE : ${player.currentClub?.name || 'Sans club'}*\nPoste: ${player.position} | Numéro: ${player.jerseyNumber}` });
});

commands.set('accepter', async (sock, message, args) => {
    const jid = getJid(message);
    const offerId = args[0];
    const offer = await ContractOffer.findOne({ where: { id: offerId, playerWhatsappId: jid }, include: [Club] });
    if (!offer) return;

    const player = await Player.findOne({ where: { whatsappId: jid } });
    await player.update({ currentClubId: offer.clubId, salary: offer.salary, jerseyNumber: offer.jerseyNumber });
    await offer.update({ status: 'accepted' });

    await sock.sendMessage(message.key.remoteJid, { text: `✅ Félicitations ! Tu as signé chez *${offer.Club.name}* avec le numéro ${offer.jerseyNumber} !` });
});

// Command: /match
commands.set('match', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    const endTime = new Date(Date.now() + 6 * 60 * 1000);
    await player.update({ matchEndTime: endTime, mode: 'action' });
    await sock.sendMessage(message.key.remoteJid, { text: `⚽ *JOUR DE MATCH* ⚽\nL'arbitre siffle. Que fais-tu ?` });
});

async function handleCommand(sock, message) {
  if (message.key.fromMe) return;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

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
