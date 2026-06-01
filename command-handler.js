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

// Helper for aesthetic status bars
function createStatusBar(current, max, length = 10) {
    if (max === 0) return '▱'.repeat(length);
    const percentage = Math.max(0, Math.min(1, current / max));
    const filledCount = Math.round(percentage * length);
    const emptyCount = length - filledCount;
    return '▰'.repeat(filledCount) + '▱'.repeat(emptyCount);
}

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

  const staminaBar = createStatusBar(player.stamina, 100);
  const xpNeeded = player.level * 100;
  const xpBar = createStatusBar(player.xp, xpNeeded);

  const fameBar = createStatusBar(player.fame, 100);

  const profileText = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                      `┃  ⚽ PROFIL CARRIÈRE - ${player.name.toUpperCase()} \n` +
                      `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                      `📍 *PRO:* ${player.position || 'Rookie'} | ${player.currentClub}\n` +
                      `🌍 *LIEU:* ${player.location}, ${player.country}\n` +
                      `💼 *JOB:* ${player.job} | 🏳️ *NAT:* ${player.nationalTeam}\n` +
                      `💰 *VALEUR:* ${player.marketValue.toLocaleString()} €\n` +
                      `💵 *ARGENT:* ${player.money.toLocaleString()} €\n` +
                      `📊 *NIVEAU:* ${player.level} [${xpBar}]\n` +
                      `🔋 *STAMINA:* [${staminaBar}] ${player.stamina}%\n` +
                      `🌟 *CÉLÉBRITÉ:* [${fameBar}] ${player.fame}%\n` +
                      `💎 *GEMS:* ${player.gems}\n\n` +
                      `▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱\n` +
                      `👟 SHOOT: ${player.shoot}   🎯 PASSE: ${player.pass}\n` +
                      `✨ DRIB: ${player.dribble}   🛡️ DÉF: ${player.defense}\n` +
                      `⚡ VIT: ${player.speed}      🧠 IQ: ${player.iq}\n` +
                      `▰▱▰▱▰▱▰▱▰▱▰▱▰▱▰▱\n\n` +
                      `_Utilise /menu pour explorer le monde._`;

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
  const menuText = `⚽ *FOOTBALL CAREER RP* ⚽\n\n` +
                   `🎮 \`/action\` - Interaction RP.\n` +
                   `🚶 \`/explorer\` - Se promener en ville.\n` +
                   `💼 \`/travailler\` - Gagner de l'argent.\n` +
                   `🌍 \`/voyager\` - Voyager (Payant).\n` +
                   `👤 \`/profil\` - Ton dossier joueur.\n` +
                   `🏟️ \`/match\` - Jouer un match.\n` +
                   `🎰 \`/boutique\` - Gacha & Invocations.\n` +
                   `❓ \`/help\` - Guide du joueur.`;
  await sock.sendMessage(message.key.remoteJid, { text: menuText });
});

// Command: /explorer
commands.set('explorer', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await player.update({ mode: 'action' });
        await sock.sendMessage(message.key.remoteJid, { text: `🚶 Tu commences à te promener dans les rues de *${player.location}*. Que fais-tu ?` });
    }
});

// Command: /voyager
commands.set('voyager', async (sock, message) => {
    const countries = [
        { name: 'Espagne', cost: 300 },
        { name: 'Angleterre', cost: 400 },
        { name: 'Italie', cost: 350 },
        { name: 'Allemagne', cost: 400 },
        { name: 'Brésil', cost: 1200 },
        { name: 'France', cost: 0 },
        { name: 'Portugal', cost: 450 },
        { name: 'Arabie Saoudite', cost: 1500 }
    ];
    let list = "🌍 *AGENCE DE VOYAGE* 🌍\nLe prix dépend de la distance :\n\n";
    countries.forEach(c => {
        list += `✈️ *${c.name}* : ${c.cost} €\n`;
    });
    list += `\n_Tape "/aller [nom_pays]"_`;
    await sock.sendMessage(message.key.remoteJid, { text: list });
});

commands.set('aller', async (sock, message, args) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const destination = args.join(' ');

    const costs = {
        'Espagne': 300, 'Angleterre': 400, 'Italie': 350, 'Allemagne': 400,
        'Brésil': 1200, 'France': 100, 'Portugal': 450, 'Arabie Saoudite': 1500
    };

    if (player && destination) {
        const cost = costs[destination] || 500;
        if (player.money < cost) {
            await sock.sendMessage(message.key.remoteJid, { text: `❌ Tu n'as pas assez d'argent (${cost} € requis). Travaille pour en gagner !` });
            return;
        }

        await player.decrement('money', { by: cost });
        await player.update({ country: destination, location: 'Aéroport / Centre-ville' });
        await sock.sendMessage(message.key.remoteJid, { text: `✈️ Billet acheté pour ${cost} € ! Bienvenue en *${destination}*.` });
    }
});

// Command: /travailler
commands.set('travailler', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await player.update({ mode: 'action' });
        await sock.sendMessage(message.key.remoteJid, { text: `💼 Tu cherches un petit job en ville pour financer ta carrière. Que veux-tu faire ? (Livreur, Serveur, Coach...)` });
    }
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
