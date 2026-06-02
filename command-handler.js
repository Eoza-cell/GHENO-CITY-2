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

function createStatusBar(current, max, length = 10) {
    const percentage = Math.max(0, Math.min(1, current / max));
    const filledCount = Math.round(percentage * length);
    const emptyCount = length - filledCount;
    return '▰'.repeat(filledCount) + '▱'.repeat(emptyCount);
}

async function pullGacha(player, count = 1) {
    const results = [];
    const rarities = ['C', 'B', 'A', 'S', 'SS', 'ULT'];
    const weights = [500, 300, 150, 40, 9, 1]; // Total 1000

    for (let i = 0; i < count; i++) {
        let rarity;

        // Pity System: 50 pulls guarantee SS or ULT
        if (player.pity >= 50) {
            rarity = Math.random() > 0.1 ? 'SS' : 'ULT';
            await player.update({ pity: 0 });
        } else {
            const roll = Math.floor(Math.random() * 1000);
            let sum = 0;
            for (let j = 0; j < weights.length; j++) {
                sum += weights[j];
                if (roll < sum) {
                    rarity = rarities[j];
                    break;
                }
            }
            if (['C', 'B', 'A', 'S'].includes(rarity)) {
                await player.increment('pity');
            } else {
                await player.update({ pity: 0 });
            }
        }

        const cards = await Card.findAll({ where: { rarity: rarity } });
        const selected = cards[Math.floor(Math.random() * cards.length)] || (await Card.findOne());
        const pc = await PlayerCard.create({ PlayerWhatsappId: player.whatsappId, CardId: selected.id });
        results.push({ card: selected, playerCard: pc });
    }
    return results;
}

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  let player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    player = await Player.create({
        whatsappId: jid,
        registrationStep: 'awaiting_name',
        gems: 300
    });

    const allCards = await Card.findAll({ where: { rarity: 'C' } });
    if (allCards.length >= 5) {
        for (let i = 0; i < 5; i++) {
            const c = allCards[i];
            const pos = ['PG', 'SG', 'SF', 'PF', 'C'][i];
            await PlayerCard.create({ PlayerWhatsappId: jid, CardId: c.id, isStarter: true, position: pos });
        }
    }

    // Guaranteed A pull
    const aCards = await Card.findAll({ where: { rarity: { [Op.in]: ['A', 'S', 'SS', 'ULT'] } } });
    if (aCards.length > 0) {
        const gift = aCards[Math.floor(Math.random() * aCards.length)];
        await PlayerCard.create({ PlayerWhatsappId: jid, CardId: gift.id });
    }

    await sock.sendMessage(replyJid, { text: "🏀 *BASKETBALL GACHA RP* 🏀\n\nBienvenue Manager ! Tu reçois :\n✅ 1 Équipe Starter\n💎 300 Gems\n🌟 1 Invocation Rang A+ garantie\n\nQuel est le nom de ton équipe/manager ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `Ravi de te revoir, Coach ${player.name} !` });
  }
});

// Command: /profil
commands.set('profil', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player) return;

  const cardsCount = await PlayerCard.count({ where: { PlayerWhatsappId: jid } });
  const starterCards = await PlayerCard.findAll({
      where: { PlayerWhatsappId: jid, isStarter: true },
      include: [Card]
  });

  let teamText = starterCards.map(pc => `├ ${pc.position}: ${pc.Card.name} (${pc.Card.rarity})`).join('\n');

  const profileText = `--- 🏀 PROFIL MANAGER --- \n` +
                      `👤 *NOM:* ${player.name}\n` +
                      `💎 *GEMS:* ${player.gems}\n` +
                      `🎴 *CARTES:* ${cardsCount}\n` +
                      `🔥 *NIVEAU:* ${player.level}\n` +
                      `🎟️ *PITY:* ${player.pity}/50\n\n` +
                      `🏀 *LINEUP ACTUELLE :*\n` +
                      (teamText || "└ Aucune équipe définie") + `\n\n` +
                      `_Tape /gacha pour recruter !_`;

  await sock.sendMessage(replyJid, { text: profileText });
});

// Command: /gacha
commands.set('gacha', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    const type = args[0] === '10' ? 10 : 1;
    const cost = type === 10 ? 250 : 30;

    if (player.gems < cost) {
        return sock.sendMessage(replyJid, { text: `❌ Pas assez de Gems ! (Besoin de ${cost} 💎)` });
    }

    await player.decrement('gems', { by: cost });
    const pulls = await pullGacha(player, type);

    for (const p of pulls) {
        let msg = `🎰 *INVOCATION RÉUSSIE* 🎰\n\n` +
                  `✨ [${p.card.rarity}] ${p.card.name}\n` +
                  `🏀 Type: ${p.card.type}\n` +
                  `🌟 Skill: ${p.card.signatureSkill}\n\n` +
                  `📊 *STATS :*\n` +
                  `Shoot: ${p.card.shoot} | Layup: ${p.card.layup}\n` +
                  `Dunk: ${p.card.dunk} | Dribble: ${p.card.dribble}\n` +
                  `Def: ${p.card.defense} | Speed: ${p.card.speed}`;

        if (p.card.imageUrl) {
            const axios = require('axios');
            try {
                const response = await axios.get(p.card.imageUrl, { responseType: 'arraybuffer' });
                await sock.sendMessage(replyJid, { image: Buffer.from(response.data), caption: msg });
            } catch(e) {
                await sock.sendMessage(replyJid, { text: msg });
            }
        } else {
            await sock.sendMessage(replyJid, { text: msg });
        }
    }
});

// Command: /equipe
commands.set('equipe', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    const allMyCards = await PlayerCard.findAll({
        where: { PlayerWhatsappId: jid },
        include: [Card],
        order: [['createdAt', 'DESC']],
        limit: 20
    });

    let list = `📋 *TES MEILLEURES CARTES* 📋\n\n`;
    allMyCards.forEach((pc, i) => {
        list += `${i+1}. [${pc.Card.rarity}] ${pc.Card.name} (LVL ${pc.level})\n`;
    });
    list += `\n_Utilise /setpos <num> <PG|SG|SF|PF|C> pour modifier ta lineup._`;

    await sock.sendMessage(message.key.remoteJid, { text: list });
});

// Command: /match
commands.set('match', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (!player) return;

    const endTime = new Date(Date.now() + 5 * 60 * 1000);
    await player.update({ matchEndTime: endTime, mode: 'action' });

    const msg = `🏀 *MATCH EN COURS* 🏀\n\n` +
                `Le match commence ! Ton équipe entre sur le parquet.\n` +
                `⏳ *DURÉE : 5 MINUTES IRL*\n\n` +
                `L'arbitre lance le ballon. Entre-deux ! Que fais-tu ?`;
    await sock.sendMessage(replyJid, { text: msg });
});

async function handleCommand(sock, message) {
  if (message.key.fromMe) return;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  // Creation flow
  if (player && player.registrationStep === 'awaiting_name') {
      await player.update({ name: messageText.trim(), registrationStep: null });
      await sock.sendMessage(replyJid, { text: `Bienvenue Coach ${player.name} ! Ton équipe est prête. Tape /profil pour voir ton effectif.` });
      return;
  }

  // Action Mode
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
