const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Player, Card, PlayerCard, Team, Match, sequelize } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');

function getJid(message) {
  if (!message || !message.key) return null;
  if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
      return message.key.participant || null;
  }
  return message.key.remoteJid || null;
}

const GOD_NUMBER = '48198576038116@s.whatsapp.net';
const commands = new Map();

// Temporary storage for team registration per chat (Penalty legacy)
const pendingTeams = {};
function getPendingTeams(chatId) {
    if (!pendingTeams[chatId]) {
        pendingTeams[chatId] = { team1: [], team2: [] };
    }
    return pendingTeams[chatId];
}

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  let player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    player = await Player.create({
        whatsappId: jid,
        gems: 300,
        registrationStep: 'awaiting_name'
    });
    await sock.sendMessage(replyJid, { text: "⚽ *BIENVENUE DANS TA CARRIÈRE FOOTBALL !* ⚽\n\nQuel est ton nom de scène, futur crack ?" });
  } else if (player.registrationStep === 'awaiting_name') {
      await sock.sendMessage(replyJid, { text: "Rappel : Quel est ton nom de joueur ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `De retour sur le terrain, ${player.name} ! Tape /menu pour voir tes options.` });
  }
});

// Command: /profil
commands.set('profil', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) return;

  const profileText = `--- ⚽ PROFIL CARRIÈRE - ${player.name} --- \n\n` +
                      `📍 *POSTE:* ${player.position || 'Non défini'}\n` +
                      `🏠 *CLUB:* ${player.currentClub}\n` +
                      `💰 *VALEUR:* ${player.marketValue} €\n` +
                      `📊 *NIVEAU:* ${player.level}\n` +
                      `💎 *GEMS:* ${player.gems}\n\n` +
                      `--- 📈 STATISTIQUES --- \n` +
                      `👟 Shoot: ${player.shoot} | 🎯 Passe: ${player.pass}\n` +
                      `✨ Dribble: ${player.dribble} | 🛡️ Défense: ${player.defense}\n` +
                      `⚡ Vitesse: ${player.speed} | 🔋 Stamina: ${player.stamina}\n` +
                      `🧠 IQ: ${player.iq}\n\n` +
                      `---------------------------`;

  await sock.sendMessage(replyJid, { text: profileText });
});

// Command: /boutique
commands.set('boutique', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const gachaText = `--- 🎰 FOOTBALL GACHA 🎰 --- \n\n` +
                      `💎 *Invocation Simple:* 100 Gems\n` +
                      `💎 *Multi (10 cartes):* 900 Gems\n\n` +
                      `*ULT:* 0.5% | *SS:* 2.5% | *S:* 7% | *A:* 30% | *B:* 60%\n\n` +
                      `_Invoque en mode /action (ex: "Je veux faire une multi")_`;

    await sock.sendMessage(replyJid, { text: gachaText });
});

// Command: /cards
commands.set('cards', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const playerCards = await PlayerCard.findAll({ where: { PlayerWhatsappId: jid }, include: Card });

    if (playerCards.length === 0) {
        await sock.sendMessage(replyJid, { text: "Tu n'as pas encore de cartes de joueurs." });
        return;
    }

    let cardsText = `--- 🎴 TA COLLECTION --- \n\n`;
    playerCards.forEach(pc => {
        cardsText += `├ ${pc.Card.name} [${pc.Card.rarity}] (Lv.${pc.level})\n`;
    });

    await sock.sendMessage(replyJid, { text: cardsText });
});

// Command: /match
commands.set('match', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    if (player.careerStage === 'prologue') {
        const endTime = new Date(Date.now() + 6 * 60 * 1000); // 6 minutes
        await player.update({
            matchEndTime: endTime,
            mode: 'action'
        });

        const msg = `⚽ *PROLOGUE : LE MATCH DE TA VIE* ⚽\n\n` +
                    `Lieu : Santiago Bernabéu\n` +
                    `Adversaire : *Real Madrid*\n` +
                    `Temps : *6 minutes* (Temps réel)\n\n` +
                    `Des recruteurs du monde entier sont dans les tribunes. Si tu marques, tu auras des offres de grands clubs !\n\n` +
                    `*Le coup d'envoi est donné !* Que fais-tu ?`;

        await sock.sendMessage(replyJid, { text: msg });
    } else {
        await sock.sendMessage(replyJid, { text: "Tu es déjà professionnel. Tes matchs sont gérés par ton club." });
    }
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const menuText = "⚽ *FOOTBALL CAREER RP* ⚽\n\n" +
                   "🎮 `/action` - Jouer (RP).\n" +
                   "👤 `/profil` - Tes stats & Club.\n" +
                   "🏟️ `/match` - Lancer le match (Prologue/Saison).\n" +
                   "🎰 `/boutique` - Gacha Joueurs & Items.\n" +
                   "❓ `/help` - Aide.";
  await sock.sendMessage(message.key.remoteJid, { text: menuText });
});

// Command: /action
commands.set('action', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
      await player.update({ mode: 'action' });
      await sock.sendMessage(message.key.remoteJid, { text: "Mode RP activé. Décris tes actions sur le terrain." });
  }
});

// Main handleCommand
async function handleCommand(sock, message) {
  if (message.key.fromMe) return;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  // Character creation flow
  if (player && player.registrationStep) {
      if (player.registrationStep === 'awaiting_name') {
          await player.update({ name: messageText.trim(), registrationStep: 'awaiting_position' });
          await sock.sendMessage(replyJid, { text: `Enchanté ${player.name} ! Choisis ton poste :\n1. Attaquant\n2. Milieu\n3. Défenseur\n4. Gardien` });
      } else if (player.registrationStep === 'awaiting_position') {
          const pos = messageText.toLowerCase();
          let position = "Attaquant";
          if (pos.includes('milieu')) position = "Milieu";
          else if (pos.includes('défenseur')) position = "Défenseur";
          else if (pos.includes('gardien')) position = "Gardien";

          await player.update({ position: position, registrationStep: null });
          await sock.sendMessage(replyJid, { text: `C'est noté ! Tu es maintenant un ${position}. Prépare-toi pour ton premier match contre le Real Madrid. Tape /match quand tu es prêt.` });
      }
      return;
  }

  if (!player && !messageText.startsWith('/start')) {
    await sock.sendMessage(replyJid, { text: "Tape /start pour commencer ta carrière." });
    return;
  }

  // Match Timer Check
  if (player?.matchEndTime) {
      if (new Date() > player.matchEndTime) {
          await player.update({ matchEndTime: null, mode: 'normal' });
          await sock.sendMessage(replyJid, { text: "⏹️ *FIN DU MATCH !* Le coup de sifflet final a retenti. Ton agent va analyser tes performances et les offres de clubs..." });
          // Note: In a real scenario, we'd trigger the recruitment logic here
          return;
      }
  }

  if (player?.mode === 'action' && !messageText.startsWith('/')) {
      await handleFreeAction(sock, message, player, messageText);
      return;
  }

  if (!messageText.startsWith('/')) return;
  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);

  if (command) {
      await command(sock, message, args);
  }
}

module.exports = { handleCommand, getJid };
