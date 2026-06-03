const fs = require('fs');
const { User, BasketballPlayer, PlayerCard, Team, RPMessage, sequelize } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { generateTeamImage } = require('./formation-generator');
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
  let user = await User.findOne({ where: { whatsappId: jid } });
  if (!user) {
    user = await User.create({ whatsappId: jid, registrationStep: 'awaiting_name' });
    await sock.sendMessage(replyJid, { text: "🏀 *BASKETBALL GACHA RP* 🏀\n\nBienvenue sur le parquet. Prêt à bâtir la plus grande dynastie de l'histoire ?\n\nQuel est ton nom de Manager ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `Ravi de te revoir, Coach ${user.name} ! Tape /menu pour voir tes options.` });
  }
});

// Command: /menu
commands.set('menu', async (sock, message) => {
    const menuText = `🏀 *BASKETBALL GACHA MENU* 🏀\n\n` +
                     `👤 /profil - Manager & Stats\n` +
                     `⛹️ /equipe - Gérer ton 5 de départ\n` +
                     `📋 /formation - Voir ton 5 sur le terrain\n` +
                     `🎴 /inventaire - Ta collection de cartes\n` +
                     `🎰 /gacha - Recrutement (Gems)\n` +
                     `🏟️ /match - Défier l'IA ou un joueur\n\n` +
                     `_Mode Action :_ /action | /quit`;
    await sock.sendMessage(message.key.remoteJid, { text: menuText });
});

// Command: /gacha
commands.set('gacha', async (sock, message) => {
    const jid = getJid(message);
    const user = await User.findOne({ where: { whatsappId: jid } });
    if (!user) return;

    const gachaText = `🎰 *CENTRE DE RECRUTEMENT* 🎰\n\n` +
                      `💎 Tes Gems : ${user.gems}\n\n` +
                      `1. 🎫 /pull 1 (50 Gems)\n` +
                      `2. 🎫 /pull 10 (450 Gems - _Réduction !_)\n\n` +
                      `_Taux d'obtention :_\n` +
                      `C: 50% | B: 30% | A: 15% | S: 4% | SS: 0.9% | ULT: 0.1%`;
    await sock.sendMessage(message.key.remoteJid, { text: gachaText });
});

commands.set('pull', async (sock, message, args) => {
    const jid = getJid(message);
    const user = await User.findOne({ where: { whatsappId: jid } });
    if (!user) return;

    const count = parseInt(args[0]) === 10 ? 10 : 1;
    const cost = count === 10 ? 450 : 50;

    if (user.gems < cost) {
        return sock.sendMessage(message.key.remoteJid, { text: "❌ Gems insuffisants !" });
    }

    await user.decrement('gems', { by: cost });

    const results = [];
    for (let i = 0; i < count; i++) {
        const rand = Math.random() * 100;
        let rarity = 'C';
        if (rand < 0.1) rarity = 'ULT';
        else if (rand < 1.0) rarity = 'SS';
        else if (rand < 5.0) rarity = 'S';
        else if (rand < 20.0) rarity = 'A';
        else if (rand < 50.0) rarity = 'B';

        const players = await BasketballPlayer.findAll({ where: { rarity } });
        const selected = players[Math.floor(Math.random() * players.length)];

        const card = await PlayerCard.create({ userWhatsappId: user.whatsappId, basketballPlayerId: selected.id });
        results.push(selected);
    }

    let msg = `🎰 *RÉSULTATS DU TIRAGE* 🎰\n\n`;
    results.forEach(p => {
        msg += `[${p.rarity}] ${p.name} (${p.position})\n`;
    });

    if (count === 1) {
        const p = results[0];
        await sock.sendMessage(message.key.remoteJid, {
            image: { url: p.imageUrl },
            caption: `${msg}\n🔥 *COMPÉTENCE:* ${p.signatureSkill}`
        });
    } else {
        await sock.sendMessage(message.key.remoteJid, { text: msg });
    }
});

commands.set('equipe', async (sock, message) => {
    const jid = getJid(message);
    const team = await Team.findOne({ where: { userWhatsappId: jid } });
    if (!team) {
        await Team.create({ userWhatsappId: jid });
        return sock.sendMessage(message.key.remoteJid, { text: "Ton équipe est vide ! Utilise /set [pos] [id_carte]" });
    }

    const getCardInfo = async (id) => {
        if (!id) return "Vide";
        const card = await PlayerCard.findByPk(id, { include: [BasketballPlayer] });
        return card ? `[${card.BasketballPlayer.rarity}] ${card.BasketballPlayer.name} (LVL ${card.level})` : "Inconnu";
    };

    const teamText = `⛹️ *TON 5 DE DÉPART* ⛹️\n\n` +
                     `PG: ${await getCardInfo(team.pgCardId)}\n` +
                     `SG: ${await getCardInfo(team.sgCardId)}\n` +
                     `SF: ${await getCardInfo(team.sfCardId)}\n` +
                     `PF: ${await getCardInfo(team.pfCardId)}\n` +
                     `C: ${await getCardInfo(team.cCardId)}\n\n` +
                     `_Utilise /set [PG|SG|SF|PF|C] [ID] pour modifier._\n` +
                     `_IDs dispos dans /inventaire._`;
    await sock.sendMessage(message.key.remoteJid, { text: teamText });
});

commands.set('formation', async (sock, message) => {
    const jid = getJid(message);
    const team = await Team.findOne({ where: { userWhatsappId: jid } });
    if (!team) return;

    const buffer = await generateTeamImage(team);
    await sock.sendMessage(message.key.remoteJid, { image: buffer, caption: `📋 *COMPOSITION DU 5 MAJEUR* 📋` });
});

commands.set('set', async (sock, message, args) => {
    const jid = getJid(message);
    const pos = args[0]?.toUpperCase();
    const cardId = parseInt(args[1]);

    if (!['PG', 'SG', 'SF', 'PF', 'C'].includes(pos) || !cardId) {
        return sock.sendMessage(message.key.remoteJid, { text: "Usage: /set [POS] [ID]" });
    }

    const card = await PlayerCard.findOne({ where: { id: cardId, userWhatsappId: jid } });
    if (!card) return sock.sendMessage(message.key.remoteJid, { text: "❌ Carte non trouvée dans ton inventaire." });

    const team = await Team.findOne({ where: { userWhatsappId: jid } });
    const updateObj = {};
    updateObj[`${pos.toLowerCase()}CardId`] = card.id;
    await team.update(updateObj);

    await sock.sendMessage(message.key.remoteJid, { text: `✅ ${pos} mis à jour avec succès !` });
});

commands.set('inventaire', async (sock, message) => {
    const jid = getJid(message);
    const cards = await PlayerCard.findAll({ where: { userWhatsappId: jid }, include: [BasketballPlayer] });

    if (cards.length === 0) return sock.sendMessage(message.key.remoteJid, { text: "Ton inventaire est vide." });

    let msg = `🎴 *TA COLLECTION (${cards.length})* 🎴\n\n`;
    cards.forEach(c => {
        msg += `ID: ${c.id} | [${c.BasketballPlayer.rarity}] ${c.BasketballPlayer.name} (${c.BasketballPlayer.position})\n`;
    });

    if (msg.length > 2000) {
        msg = msg.substring(0, 1990) + "... (trop long)";
    }
    await sock.sendMessage(message.key.remoteJid, { text: msg });
});

commands.set('profil', async (sock, message) => {
    const jid = getJid(message);
    const user = await User.findOne({ where: { whatsappId: jid } });
    if (!user) return;

    const profileText = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n` +
                        `┃  🏀 MANAGER : ${user.name.toUpperCase()} \n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
                        `💎 *GEMS:* ${user.gems}\n` +
                        `🆙 *NIVEAU:* ${user.level} (XP: ${user.xp})\n` +
                        `🌟 *FAME:* ${user.fame}\n\n` +
                        `_Prêt pour le prochain match ?_`;
    await sock.sendMessage(message.key.remoteJid, { text: profileText });
});

commands.set('action', async (sock, message) => {
    const jid = getJid(message);
    const user = await User.findOne({ where: { whatsappId: jid } });
    if (user) { await user.update({ mode: 'action' }); await sock.sendMessage(message.key.remoteJid, { text: "🏀 MODE ACTION ACTIVÉ. Décris tes actions sur le terrain." }); }
});

commands.set('quit', async (sock, message) => {
    const jid = getJid(message);
    const user = await User.findOne({ where: { whatsappId: jid } });
    if (user) { await user.update({ mode: 'normal' }); await sock.sendMessage(message.key.remoteJid, { text: "Mode normal réactivé." }); }
});

async function handleCommand(sock, message) {
  if (message.key.fromMe) return;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const user = await User.findOne({ where: { whatsappId: jid } });

  // Registration
  if (user && user.registrationStep) {
      if (user.registrationStep === 'awaiting_name') {
          await user.update({ name: messageText.trim(), registrationStep: 'awaiting_appearance' });

          // Grant starter team
          const starters = await BasketballPlayer.findAll({ where: { rarity: 'C' }, limit: 5 });
          const cardIds = [];
          for (const p of starters) {
              const card = await PlayerCard.create({ userWhatsappId: jid, basketballPlayerId: p.id });
              cardIds.push(card.id);
          }
          // Guaranteed A
          const aPlayer = await BasketballPlayer.findOne({ where: { rarity: 'A' }, order: [sequelize.random()] });
          const aCard = await PlayerCard.create({ userWhatsappId: jid, basketballPlayerId: aPlayer.id });

          await Team.create({
              userWhatsappId: jid,
              pgCardId: cardIds[0], sgCardId: cardIds[1], sfCardId: cardIds[2], pfCardId: cardIds[3], cCardId: cardIds[4]
          });

          await sock.sendMessage(replyJid, { text: `Parfait Coach ${user.name} ! Tu as reçu ton équipe starter et un joueur Rang A garanti (${aPlayer.name}).\n\nEnvoie une image pour ton avatar de manager pour terminer.` });
      }
      return;
  }

  if (user?.mode === 'action' && !messageText.startsWith('/')) { await handleFreeAction(sock, message, user, messageText); return; }
  if (!messageText.startsWith('/')) return;
  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);
  if (command) await command(sock, message, args);
}

module.exports = { handleCommand, getJid };
