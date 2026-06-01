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

    // Give 1 guaranteed A-rank card as starter reward
    const guaranteedA = await Card.findOne({ where: { rarity: 'A' }, order: sequelize.random() });
    if (guaranteedA) {
        await PlayerCard.create({ PlayerWhatsappId: jid, CardId: guaranteedA.id });
    }
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
                      `🏆 *TROPHÉES:* ${player.trophies.length} remportés\n\n` +
                      `_Utilise /menu pour explorer le monde._`;

  if (player.appearanceImageUrl && fs.existsSync(player.appearanceImageUrl)) {
      await sock.sendMessage(replyJid, {
          image: fs.readFileSync(player.appearanceImageUrl),
          caption: profileText
      });
  } else {
      await sock.sendMessage(replyJid, { text: profileText });
  }
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
                    `Temps : *6 minutes* IRL (Equivalent 90 min de match)\n\n` +
                    `Des recruteurs du monde entier sont dans les tribunes. Si tu marques, tu auras des offres de grands clubs !\n\n` +
                    `*Le coup d'envoi est donné !* Que fais-tu ?`;

        await sock.sendMessage(replyJid, { text: msg });
    } else {
        await sock.sendMessage(replyJid, { text: "Tu es déjà professionnel. Tes matchs sont gérés par ton club. Utilise /action pour demander à jouer." });
    }
});

// Command: /contrat
commands.set('contrat', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        const text = `📜 *DÉTAILS DU CONTRAT* 📜\n\n` +
                     `🏠 *CLUB:* ${player.currentClub}\n` +
                     `⏳ *DURÉE:* ${player.contractDays} Jours RP\n` +
                     `🤝 *SPONSOR:* ${player.sponsor}\n` +
                     `💰 *PRIME:* À négocier selon tes performances.`;
        await sock.sendMessage(message.key.remoteJid, { text: text });
    }
});

// Command: /trophées
commands.set('trophées', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        const trophies = player.trophies || [];
        let text = `🏆 *TON PALMARÈS* 🏆\n\n`;
        if (trophies.length === 0) {
            text += "Ton armoire à trophées est vide... Pour l'instant !";
        } else {
            trophies.forEach((t, i) => {
                text += `${i+1}. 🥇 ${t}\n`;
            });
        }
        await sock.sendMessage(message.key.remoteJid, { text: text });
    }
});

// Command: /assets
commands.set('assets', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    if (player) {
        const vehicles = player.vehicles || [];
        const companies = player.companies || [];
        const text = `🏎️ *TES BIENS & ASSETS* 🏎️\n\n` +
                     `🚙 *VÉHICULES:* ${vehicles.length > 0 ? vehicles.join(', ') : 'Aucun'}\n` +
                     `🏢 *ENTREPRISES:* ${companies.length > 0 ? companies.join(', ') : 'Aucune'}\n\n` +
                     `_Utilise /achat pour investir ton argent._`;
        await sock.sendMessage(message.key.remoteJid, { text: text });
    }
});

// Command: /achat
commands.set('achat', async (sock, message) => {
    const items = [
        { name: 'Moto Sportive', type: 'vehicle', cost: 15000 },
        { name: 'Ferrari 488', type: 'vehicle', cost: 250000 },
        { name: 'Jet Privé', type: 'vehicle', cost: 5000000 },
        { name: 'Restaurant Local', type: 'company', cost: 500000 },
        { name: 'Marque de Vêtements', type: 'company', cost: 2000000 },
        { name: 'Chaîne d\'Hôtels', type: 'company', cost: 15000000 }
    ];
    let list = "💰 *MARKETPLACE DE LUXE* 💰\n\n";
    items.forEach((it, i) => {
        list += `${i+1}. *${it.name}* (${it.type}) : ${it.cost.toLocaleString()} €\n`;
    });
    list += `\n_Tape "/investir [nom]"_`;
    await sock.sendMessage(message.key.remoteJid, { text: list });
});

commands.set('investir', async (sock, message, args) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const itName = args.join(' ');

    const catalog = [
        { name: 'Moto Sportive', type: 'vehicle', cost: 15000 },
        { name: 'Ferrari 488', type: 'vehicle', cost: 250000 },
        { name: 'Jet Privé', type: 'vehicle', cost: 5000000 },
        { name: 'Restaurant Local', type: 'company', cost: 500000 },
        { name: 'Marque de Vêtements', type: 'company', cost: 2000000 },
        { name: 'Chaîne d\'Hôtels', type: 'company', cost: 15000000 }
    ];

    const item = catalog.find(i => i.name.toLowerCase() === itName.toLowerCase());
    if (player && item) {
        if (player.money < item.cost) {
            await sock.sendMessage(message.key.remoteJid, { text: `❌ Fonds insuffisants (${item.cost.toLocaleString()} € requis).` });
            return;
        }

        await player.decrement('money', { by: item.cost });
        if (item.type === 'vehicle') {
            const v = player.vehicles || [];
            v.push(item.name);
            player.vehicles = v;
        } else {
            const c = player.companies || [];
            c.push(item.name);
            player.companies = c;
        }
        await player.save();
        await sock.sendMessage(message.key.remoteJid, { text: `🎉 Félicitations ! Tu viens d'acquérir : *${item.name}* !` });
    }
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const menuText = `⚽ *FOOTBALL CAREER PRO* ⚽\n\n` +
                   `🎮 \`/action\` - Interaction RP.\n` +
                   `🏟️ \`/match\` - Match Pro.\n` +
                   `🌍 \`/voyager\` - Voyager (Payant).\n` +
                   `💰 \`/achat\` - Acheter Biens/Entreprises.\n` +
                   `📜 \`/contrat\` - Contrat & Sponsor.\n` +
                   `🏆 \`/trophées\` - Ton Palmarès.\n` +
                   `🏎️ \`/assets\` - Tes possessions.\n` +
                   `👤 \`/profil\` - Stats & Carrière.\n` +
                   `🎰 \`/boutique\` - Gacha Invocations.\n` +
                   `❓ \`/help\` - Aide.`;
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

          await player.update({ position: position, registrationStep: 'awaiting_nation' });
          await sock.sendMessage(replyJid, { text: `C'est noté ! Tu es maintenant un ${position}.\n\n🌍 *NATION :* De quel pays viens-tu ? (Ex: France, Brésil, Japon...)` });
      } else if (player.registrationStep === 'awaiting_nation') {
          const country = messageText.trim();
          await player.update({ country: country, registrationStep: 'awaiting_appearance' });
          await sock.sendMessage(replyJid, { text: `Représente fièrement le drapeau de ${country} !\n\n📸 *APPARENCE :* Envoie une image qui représente ton personnage (ton visage, ton style).` });
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
          const wasPrologue = player.careerStage === 'prologue';
          await player.update({
              matchEndTime: null,
              mode: 'normal',
              careerStage: wasPrologue ? 'pro' : player.careerStage
          });

          let finishMsg = "⏹️ *FIN DU MATCH !* Le coup de sifflet final a retenti.";
          if (wasPrologue) {
              finishMsg += "\n\nFélicitations, tu as terminé ton match d'essai ! Tu es désormais un joueur professionnel en quête d'un club. Utilise /explorer pour trouver ton premier contrat ou /voyager pour changer de championnat.";
          }
          await sock.sendMessage(replyJid, { text: finishMsg });
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
