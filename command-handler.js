const fs = require('fs');
const path = require('path');
const { Player, Card, PlayerCard, sequelize } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { Op } = require('sequelize');

function getJid(message) {
  if (!message || !message.key) return null;
  if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
      return message.key.participant || null;
  }
  return message.key.remoteJid || null;
}

const commands = new Map();

function createStatusBar(current, max, length = 5) {
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
    player = await Player.create({
        whatsappId: jid,
        registrationStep: 'awaiting_name'
    });
    await sock.sendMessage(replyJid, { text: "⚽ *FOOTBALL CAREER PRO* ⚽\n\nBienvenue, futur crack. Commençons par créer ton identité.\n\nQuel est ton nom de joueur ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `Ravi de te revoir, ${player.name} !` });
  }
});

// Command: /profil
commands.set('profil', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) return;

  const staminaBar = createStatusBar(player.stamina, 100);

  const profileText = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                      `┃  ⚽ DOSSIER PRO - ${player.name.toUpperCase()} \n` +
                      `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                      `📍 *POSTE:* ${player.position || 'Rookie'}\n` +
                      `🌍 *NATION:* ${player.country}\n` +
                      `🏢 *CLUB:* ${player.currentClub}\n` +
                      `⏳ *CONTRAT:* ${player.contractDays} Jours RP\n` +
                      `🤝 *SPONSOR:* ${player.sponsor}\n` +
                      `💰 *ARGENT:* ${player.money.toLocaleString()} €\n\n` +
                      `📊 *STATS:* \n` +
                      `👟 SHOOT: ${player.shoot} | 🎯 PASSE: ${player.pass}\n` +
                      `✨ DRIB: ${player.dribble} | 🛡️ DEF: ${player.defense}\n` +
                      `⚡ VIT: ${player.speed} | 🧠 IQ: ${player.iq}\n` +
                      `🔋 STAMINA: [${staminaBar}]\n\n` +
                      `🏆 *TROPHÉES:* ${player.trophies.length}\n` +
                      `🏎️ *MOTEURS:* ${player.vehicles.length}\n` +
                      `🏢 *ENTREPRISES:* ${player.companies.length}\n\n` +
                      `_Tape /menu pour voir les options._`;

  if (player.appearanceImageUrl && fs.existsSync(player.appearanceImageUrl)) {
      await sock.sendMessage(replyJid, { image: fs.readFileSync(player.appearanceImageUrl), caption: profileText });
  } else {
      await sock.sendMessage(replyJid, { text: profileText });
  }
});

// Command: /match
commands.set('match', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    if (player.careerStage === 'prologue') {
        const endTime = new Date(Date.now() + 6 * 60 * 1000); // 6 mins IRL = 90 mins RP
        await player.update({ matchEndTime: endTime, mode: 'action' });

        const msg = `⚽ *PROLOGUE : MATCH CONTRE LE REAL MADRID* ⚽\n\n` +
                    `C'est ton moment. Marque pour impressionner les recruteurs !\n` +
                    `⏳ *DURÉE : 6 MINUTES IRL (90 MIN RP)*\n\n` +
                    `Le coup d'envoi est donné à Santiago Bernabéu. Le ballon arrive vers toi...`;
        await sock.sendMessage(replyJid, { text: msg });
    }
});

// Command: /achat
commands.set('achat', async (sock, message) => {
    const list = `🛒 *MARKETPLACE LUXE* 🛒\n\n` +
                 `🏎️ *MOTEURS :*\n` +
                 `- /acheter moto (15,000€)\n` +
                 `- /acheter supercar (250,000€)\n\n` +
                 `🏢 *ENTREPRISES :*\n` +
                 `- /acheter resto (500,000€)\n` +
                 `- /acheter club (10,000,000€)`;
    await sock.sendMessage(message.key.remoteJid, { text: list });
});

commands.set('acheter', async (sock, message, args) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const item = args[0];
    if (!player) return;

    const costs = { 'moto': 15000, 'supercar': 250000, 'resto': 500000, 'club': 10000000 };
    if (!costs[item]) return;

    if (player.money < costs[item]) {
        return sock.sendMessage(message.key.remoteJid, { text: "❌ Fonds insuffisants." });
    }

    await player.decrement('money', { by: costs[item] });
    if (['moto', 'supercar'].includes(item)) {
        const v = player.vehicles; v.push(item); player.vehicles = v;
    } else {
        const c = player.companies; c.push(item); player.companies = c;
    }
    await player.save();
    await sock.sendMessage(message.key.remoteJid, { text: `✅ Achat réussi : ${item} !` });
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const menuText = `⚽ *FOOTBALL CAREER MENU* ⚽\n\n` +
                   `/profil - Dossier pro & Stats.\n` +
                   `/match - Lancer un match (6min).\n` +
                   `/achat - Boutique moteurs & business.\n` +
                   `/action - Mode MJ (Entraînement, RP).\n` +
                   `/quit - Sortir du mode action.`;
  await sock.sendMessage(message.key.remoteJid, { text: menuText });
});

// Command: /action
commands.set('action', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await player.update({ mode: 'action' });
        await sock.sendMessage(message.key.remoteJid, { text: "⚽ MJ ACTIVÉ. Décris tes actions (entraînement, match, discussion)." });
    }
});

// Command: /quit
commands.set('quit', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        await player.update({ mode: 'normal' });
        await sock.sendMessage(message.key.remoteJid, { text: "Mode action désactivé." });
    }
});

async function handleCommand(sock, message) {
  if (message.key.fromMe) return;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  // Creation flow
  if (player && player.registrationStep) {
      if (player.registrationStep === 'awaiting_name') {
          await player.update({ name: messageText.trim(), registrationStep: 'awaiting_position' });
          await sock.sendMessage(replyJid, { text: `Quel est ton poste ? (FWD, MID, DEF, GK)` });
      } else if (player.registrationStep === 'awaiting_position') {
          await player.update({ position: messageText.toUpperCase(), registrationStep: 'awaiting_nation' });
          await sock.sendMessage(replyJid, { text: `Quelle est ta nation ? (Tous les pays du monde possibles)` });
      } else if (player.registrationStep === 'awaiting_nation') {
          await player.update({ country: messageText.trim(), registrationStep: 'awaiting_appearance' });
          await sock.sendMessage(replyJid, { text: `Envoie maintenant ton image d'apparence (ton maillot, ton visage).` });
      }
      return;
  }

  // Match Timer End Check
  if (player?.matchEndTime && new Date() > player.matchEndTime) {
      await player.update({ matchEndTime: null, careerStage: player.careerStage === 'prologue' ? 'pro' : player.careerStage, mode: 'normal' });
      await sock.sendMessage(replyJid, { text: "⏹️ *COUP DE SIFFLET FINAL !* Le match est terminé. Consulte tes offres via /action ou /profil." });
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

  if (command) {
      await command(sock, message, args);
  }
}

module.exports = { handleCommand, getJid };
