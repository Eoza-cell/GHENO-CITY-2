const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, Skill } = require('./database');
const { generateEquipmentStatusImage } = require('./equipment-visualizer');
const { generateProfileCard } = require('./profile-generator');
const { handleFreeAction } = require('./ai-handler');
const { startTutorial } = require('./tutorial-handler');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');

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


const commands = new Map();

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const replyJid = message.key.remoteJid;

  if (!player) {
    await Player.create({
        whatsappId: jid,
        registrationStep: 'awaiting_name'
    });

    const startText = "*BIENVENUE DANS DRAGON BALL RP !*\n\nL'univers est vaste et rempli de guerriers surpuissants. Que tu sois un Saiyan assoiffé de combat ou un Humain cherchant à protéger la Terre, ton voyage commence ici. Rassemble les Dragon Balls, entraîne-toi sans relâche et dépasse tes limites !\n\n*...3_2_1...*\n\n*START!!*\n\nPour commencer, quel est ton nom, jeune guerrier ?";

    if (fs.existsSync('./assets/start_image.jpg')) {
        await sock.sendMessage(replyJid, {
            image: fs.readFileSync('./assets/start_image.jpg'),
            caption: startText
        });
    } else {
        await sock.sendMessage(replyJid, { text: startText });
    }
  } else if (player.registrationStep) {
    // Resume registration
    if (player.registrationStep === 'awaiting_name') {
        await sock.sendMessage(replyJid, { text: "Rappel: Quel est votre nom, aventurier ?" });
    } else if (player.registrationStep === 'awaiting_description') {
        await sock.sendMessage(replyJid, { text: `Rappel: Enchanté ${player.name}. Décris ton personnage en une phrase.` });
    }
  } else {
    await sock.sendMessage(replyJid, { text: `Content de te revoir, ${player.name} ! Utilise /quests pour voir tes objectifs.` });
  }
});

// Command: /quests
// Command: /competences
commands.set('competences', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
        return;
    }

    const skills = await player.getSkills();

    if (!skills || skills.length === 0) {
        await sock.sendMessage(replyJid, { text: "Tu ne possèdes aucune technique pour le moment. Entraîne-toi avec Maître Roshi pour en apprendre !" });
        return;
    }

    let skillText = `*Compétences de ${player.name}:*\n\n`;

    const activeSkills = skills.filter(s => s.type === 'active' || s.type === 'spell' || s.type === 'sword_technique');
    const passiveSkills = skills.filter(s => s.type === 'passive');

    if (activeSkills.length > 0) {
        skillText += "*Capacités Actives & Sorts:*\n";
        activeSkills.forEach(s => {
            skillText += `- *${s.name}* (${s.manaCost} PM): ${s.description}\n`;
        });
        skillText += "\n";
    }

    if (passiveSkills.length > 0) {
        skillText += "*Capacités Passives:*\n";
        passiveSkills.forEach(s => {
            skillText += `- *${s.name}*: ${s.description}\n`;
        });
    }

    await sock.sendMessage(replyJid, { text: skillText });
});

commands.set('quests', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
        return;
    }

    const quests = await player.getQuests();
    const activeQuests = quests.filter(q => q.status === 'in_progress' || q.PlayerQuest?.status === 'in_progress');
    const notStartedQuests = quests.filter(q => q.status === 'not_started' || q.PlayerQuest?.status === 'not_started');


    if (activeQuests.length === 0 && notStartedQuests.length === 0) {
        await sock.sendMessage(replyJid, { text: "Tu n'as pas de quête active pour le moment. Explore le monde pour en trouver !" });
        return;
    }

    let questText = '--- 📜 JOURNAL DE QUÊTES --- \n\n';
    if (activeQuests.length > 0) {
        questText += '*⚔️ En Cours:*\n' + activeQuests.map(q => `├ ${q.title}\n└ ${q.description}`).join('\n\n') + '\n\n';
    }
    if (notStartedQuests.length > 0) {
        questText += '*📍 Disponibles:*\n' + notStartedQuests.map(q => `└ ${q.title}`).join('\n');
    }

    if (activeQuests.length === 0 && notStartedQuests.length === 0) {
        questText += "Aucune quête à l'horizon. Explore le monde !";
    }

    await sock.sendMessage(replyJid, { text: questText });
});


// Helper function to create a status bar
function createStatusBar(current, max, filledChar = '▰', emptyChar = '▱', length = 10) {
    if (max === 0) return emptyChar.repeat(length); // Avoid division by zero
    const percentage = Math.max(0, Math.min(1, current / max));
    const filledCount = Math.round(percentage * length);
    const emptyCount = length - filledCount;
    return filledChar.repeat(filledCount) + emptyChar.repeat(emptyCount);
}


// Command: /profile and /profil
const profileCommand = async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const replyJid = message.key.remoteJid;

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
    return;
  }

  try {
      const profileBuffer = await generateProfileCard(player);
      const healthBar = createStatusBar(player.health, player.maxHealth);
      const manaBar = createStatusBar(player.ki, player.maxKi);
      const xpNeeded = player.level * 100;
      const xpBar = createStatusBar(player.xp, xpNeeded);

      const profileText = `--- 🆔 PROFIL GUERRIER --- \n\n` +
                          `👤 *NOM:* ${player.name}\n` +
                          `🧬 *RACE:* ${player.race}\n` +
                          `🎖️ *RANG:* ${player.rank}\n` +
                          `📊 *NIVEAU:* ${player.level}\n\n` +
                          `❤️ *VIE:*  [${healthBar}] ${player.health}/${player.maxHealth}\n` +
                          `🔷 *KI:*   [${manaBar}] ${player.ki}/${player.maxKi}\n` +
                          `✨ *XP:*   [${xpBar}] ${player.xp}/${xpNeeded}\n\n` +
                          `--- ⚔️ STATISTIQUES --- \n` +
                          `💪 Force: ${player.strength}\n` +
                          `🏃 Agilité: ${player.agility}\n` +
                          `🧠 Intelligence: ${player.intelligence}\n` +
                          `🛡️ Défense: ${player.defense}\n` +
                          `🍀 Chance: ${player.luck}\n` +
                          `✨ *SP:* ${player.skillPoints}\n\n` +
                          `💰 *ZENI:* ${player.zeni} 🪙\n` +
                          `---------------------------`;

      await sock.sendMessage(replyJid, {
          image: profileBuffer,
          caption: profileText
      });
  } catch (error) {
      console.error("Erreur génération carte profil:", error);
      const healthBar = createStatusBar(player.health, player.maxHealth);
      const manaBar = createStatusBar(player.ki, player.maxKi);
      const xpNeeded = player.level * 100;
      const xpBar = createStatusBar(player.xp, xpNeeded);

      const profileText = `--- 🆔 PROFIL GUERRIER --- \n\n` +
                          `👤 *NOM:* ${player.name}\n` +
                          `🧬 *RACE:* ${player.race}\n` +
                          `🎖️ *RANG:* ${player.rank}\n` +
                          `📊 *NIVEAU:* ${player.level}\n\n` +
                          `❤️ *VIE:*  [${healthBar}] ${player.health}/${player.maxHealth}\n` +
                          `🔷 *KI:*   [${manaBar}] ${player.ki}/${player.maxKi}\n` +
                          `✨ *XP:*   [${xpBar}] ${player.xp}/${xpNeeded}\n\n` +
                          `--- ⚔️ STATISTIQUES --- \n` +
                          `💪 Force: ${player.strength}\n` +
                          `🏃 Agilité: ${player.agility}\n` +
                          `🧠 Intelligence: ${player.intelligence}\n` +
                          `🛡️ Défense: ${player.defense}\n` +
                          `🍀 Chance: ${player.luck}\n` +
                          `✨ *SP:* ${player.skillPoints}\n\n` +
                          `💰 *ZENI:* ${player.zeni} 🪙\n` +
                          `---------------------------`;

      await sock.sendMessage(replyJid, { text: profileText });
  }
};
commands.set('profile', profileCommand);
commands.set('profil', profileCommand);

// Command: /inspecter
commands.set('inspecter', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;

    // Check for mentions
    const mentionedJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) {
        await sock.sendMessage(replyJid, { text: "Tu dois mentionner un joueur pour l'inspecter (ex: /inspecter @joueur)." });
        return;
    }

    const targetPlayer = await Player.findOne({ where: { whatsappId: mentionedJid } });
    if (!targetPlayer) {
        await sock.sendMessage(replyJid, { text: "Ce joueur n'existe pas ou n'est pas enregistré." });
        return;
    }

    const healthBar = createStatusBar(targetPlayer.health, targetPlayer.maxHealth);
    const manaBar = createStatusBar(targetPlayer.ki, targetPlayer.maxKi);
    const xpNeeded = targetPlayer.level * 100;
    const xpBar = createStatusBar(targetPlayer.xp, xpNeeded);

    const profileText = `--- 🔍 INSPECTION - ${targetPlayer.name} --- \n\n` +
                        `🧬 *RACE:* ${targetPlayer.race}\n` +
                        `🎖️ *RANG:* ${targetPlayer.rank}\n` +
                        `📊 *NIVEAU:* ${targetPlayer.level}\n\n` +
                        `❤️ *VIE:*  [${healthBar}] ${targetPlayer.health}/${targetPlayer.maxHealth}\n` +
                        `🔷 *KI:*    [${manaBar}] ${targetPlayer.ki}/${targetPlayer.maxKi}\n` +
                        `✨ *XP:*   [${xpBar}] ${targetPlayer.xp}/${xpNeeded}\n\n` +
                        `📜 *BIO:* ${targetPlayer.characterDescription || 'Aucune description.'}\n\n` +
                        `--- ⚔️ STATISTIQUES --- \n` +
                        `💪 Force: ${targetPlayer.strength}\n` +
                        `🏃 Agilité: ${targetPlayer.agility}\n` +
                        `🧠 Intelligence: ${targetPlayer.intelligence}\n` +
                        `🛡️ Défense: ${targetPlayer.defense}\n` +
                        `🍀 Chance: ${targetPlayer.luck}\n\n` +
                        `📍 *LIEU:* ${targetPlayer.location}\n` +
                        `---------------------------`;

    await sock.sendMessage(replyJid, { text: profileText });
});

// Command: /inventory
commands.set('inventory', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const inventory = player.inventory;
    if (inventory.length === 0) {
        await sock.sendMessage(replyJid, { text: "Ton inventaire est vide." });
        return;
    }

    const inventoryText = inventory.map(item => `├ ${item.name} (x${item.quantity})`).join('\n');
    await sock.sendMessage(replyJid, { text: `--- 🎒 INVENTAIRE --- \n\n${inventoryText}\n\n└ _Utilise /action pour utiliser ou équiper un objet._` });
});

// Command: /map
commands.set('map', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

     if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const dungeons = await Dungeon.findAll();
    const mapText = `--- 🗺️ CARTE DE L'UNIVERS --- \n\n` +
                    `📍 *POSITION:* ${player.location}\n\n` +
                    `🏰 *ZONES CONNUES:* \n` +
                    dungeons.map(d => `├ ${d.name} (Rang ${d.rank})`).join('\n') +
                    `\n\n_L'univers est vaste. Déplace-toi via le mode /action._`;

    await sock.sendMessage(replyJid, { text: mapText });
});

// Command: /boutique
commands.set('boutique', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const items = await Item.findAll();

    if (items.length === 0) {
        await sock.sendMessage(replyJid, { text: "La boutique est vide pour le moment." });
        return;
    }

    let boutiqueText = "--- 🛒 BOUTIQUE CAPSULE CORP --- \n\n";
    items.forEach(item => {
        boutiqueText += `*${item.name.toUpperCase()}*\n`;
        boutiqueText += `├ 💰 Prix: ${item.price} Zeni\n`;
        const bonuses = item.statBonuses;
        const bonusStrings = Object.entries(bonuses).map(([stat, value]) => `${stat}: +${value}`);
        if (bonusStrings.length > 0) {
            boutiqueText += `├ ✨ Stats: ${bonusStrings.join(', ')}\n`;
        }
        boutiqueText += `└ 📜 ${item.description}\n\n`;
    });

    boutiqueText += "🛒 *Achat:* Utilise `/action` -> 'Je veux acheter [Objet]'.";

    // Show top-tier item image (Senzu or Scouter)
    const featuredItem = items.find(i => i.name === 'Senzu') || items.find(i => i.name === 'Scouter') || items.find(i => i.imageUrl);

    if (featuredItem && featuredItem.imageUrl) {
        try {
            const response = await axios.get(featuredItem.imageUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const imageBuffer = Buffer.from(response.data, 'binary');
            await sock.sendMessage(replyJid, {
                image: imageBuffer,
                caption: boutiqueText
            });
        } catch (error) {
            console.error("Erreur envoi image boutique:", error.message);
            await sock.sendMessage(replyJid, { text: boutiqueText });
        }
    } else {
        await sock.sendMessage(replyJid, { text: boutiqueText });
    }
});

// Command: /joueurs
commands.set('joueurs', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const otherPlayers = await Player.findAll({
        where: {
            location: player.location,
            whatsappId: { [Op.ne]: jid }
        }
    });

    if (otherPlayers.length === 0) {
        await sock.sendMessage(replyJid, { text: `Tu es seul ici à ${player.location}.` });
        return;
    }

    let playersText = `--- 👥 AVENTURIERS À PROXIMITÉ --- \n\n`;
    otherPlayers.forEach(p => {
        playersText += `*${p.name}*\n`;
        playersText += `├ 🧬 Race: ${p.race} | 📊 Niveau: ${p.level}\n`;
        playersText += `├ 🎖️ Rang: ${p.rank}\n`;
        playersText += `└ 📜 Bio: ${p.characterDescription || '...'}\n\n`;
    });
    playersText += "_Utilise /action pour interagir avec eux._";

    await sock.sendMessage(replyJid, { text: playersText });
});

// Command: /mondes
commands.set('mondes', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { Kingdom } = require('./database');
    const kingdoms = await Kingdom.findAll();

    let text = "--- 🌌 PLANÈTES & MONDES --- \n\n";
    kingdoms.forEach(k => {
        text += `*${k.name.toUpperCase()}*\n`;
        text += `├ 👑 Leader: ${k.leader}\n`;
        text += `├ ⚔️ Force Militaire: ${k.militaryPower}\n`;
        text += `├ 📊 Influence: ${k.influence}\n`;
        text += `└ 📜 ${k.description}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: text });
});


// Command: /god
commands.set('god', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    // Handle claiming God status with code
    if (args[0] === '201148') {
        await player.update({ isGod: true });
        await sock.sendMessage(replyJid, { text: "Ki divin détecté. Tu es désormais un Dieu de la Destruction." });
        return;
    }

    if (!player.isGod) {
        await sock.sendMessage(replyJid, { text: "Ton Ki est trop faible pour accéder aux pouvoirs divins." });
        return;
    }

    const subCommand = args.shift()?.toLowerCase();
    const targetJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!subCommand) {
        await sock.sendMessage(replyJid, { text: "Commandes Divines:\n/god set @joueur <stat> <valeur>\n/god give @joueur <item> <quantité>\n/god rank @joueur <rang>\n/god zeni @joueur <montant>" });
        return;
    }

    if (!targetJid) {
        await sock.sendMessage(replyJid, { text: "Tu dois mentionner un mortel pour exercer ton pouvoir." });
        return;
    }

    const targetPlayer = await Player.findOne({ where: { whatsappId: targetJid } });
    if (!targetPlayer) return;

    switch (subCommand) {
        case 'set':
            const stat = args[0];
            const value = parseInt(args[1]);
            if (stat && !isNaN(value)) {
                await targetPlayer.update({ [stat]: value });
                await sock.sendMessage(replyJid, { text: `La statistique ${stat} de ${targetPlayer.name} a été fixée à ${value} par la main de Dieu.` });
            }
            break;
        case 'give':
            const itemName = args.slice(0, -1).join(' ');
            const qty = parseInt(args[args.length - 1]);
            if (itemName && !isNaN(qty)) {
                let inv = [...targetPlayer.inventory];
                inv.push({ name: itemName, quantity: qty });
                targetPlayer.inventory = inv;
                await targetPlayer.save();
                await sock.sendMessage(replyJid, { text: `${targetPlayer.name} a reçu ${qty}x ${itemName} par décret divin.` });
            }
            break;
        case 'rank':
            const newRank = args[0];
            if (newRank) {
                await targetPlayer.update({ rank: newRank });
                await sock.sendMessage(replyJid, { text: `Le rang de ${targetPlayer.name} a été changé en ${newRank} par la grâce d'Eoza.` });
            }
            break;
        case 'zeni':
            const amount = parseInt(args[0]);
            if (!isNaN(amount)) {
                await targetPlayer.increment('zeni', { by: amount });
                await sock.sendMessage(replyJid, { text: `${targetPlayer.name} a reçu ${amount} Zeni de la part du créateur.` });
            }
            break;
    }
});

// Command: /tournoi
commands.set('tournoi', async (sock, message) => {
    const replyJid = message.key.remoteJid;

    let text = "--- 🏆 TENKAICHI BUDOKAI --- \n\n";
    text += "Le tournoi mondial des arts martiaux réunit les meilleurs guerriers de la planète.\n\n";
    text += "⚔️ *Format:* Duels 1v1 par élimination directe.\n";
    text += "🎁 *Récompenses:* Titre de champion, Zeni, et gloire éternelle.\n\n";
    text += "_Inscris-toi dès que l'annonce officielle retentira ! Petit conseil : entraîne-toi dur._";

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /conflits
commands.set('conflits', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { Conflict } = require('./database');
    const conflicts = await Conflict.findAll({ where: { status: 'active' } });

    if (conflicts.length === 0) {
        await sock.sendMessage(replyJid, { text: "Le monde est actuellement en paix... une paix fragile." });
        return;
    }

    let text = "--- 🛡️ ÉTAT DES CONFLITS --- \n\n";
    conflicts.forEach(c => {
        text += `*${c.title.toUpperCase()}*\n`;
        const involved = Array.isArray(c.involvedKingdoms) ? c.involvedKingdoms.join(', ') : c.involvedKingdoms;
        text += `├ ⚔️ Belligérants: ${involved}\n`;
        text += `└ 📜 ${c.description}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /bank
commands.set('bank', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const [bank, created] = await Bank.findOrCreate({ where: { PlayerWhatsappId: player.whatsappId } });

    const bankText = `--- 🏦 BANQUE MONDIALE --- \n\n` +
                     `💳 *SOLDE:* ${bank.balance} Zeni\n\n` +
                     `--------------------------- \n` +
                     `_Pour déposer ou retirer, utilise le mode /action._\n` +
                     `_Ex: "Je dépose 50 zeni à la banque"_`;

    await sock.sendMessage(replyJid, { text: bankText });
});

// Command: /donner
commands.set('donner', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const mentionedJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) {
        await sock.sendMessage(replyJid, { text: "Tu dois mentionner un joueur pour lui donner quelque chose (ex: /donner @joueur 100 col)." });
        return;
    }

    const targetPlayer = await Player.findOne({ where: { whatsappId: mentionedJid } });
    if (!targetPlayer) {
        await sock.sendMessage(replyJid, { text: "Ce joueur n'existe pas." });
        return;
    }

    if (player.location !== targetPlayer.location) {
        await sock.sendMessage(replyJid, { text: "Tu dois être au même endroit que le joueur pour lui donner quelque chose." });
        return;
    }

    const amountIndex = args.findIndex(arg => !isNaN(parseInt(arg)));
    const amount = amountIndex !== -1 ? parseInt(args[amountIndex]) : 0;
    const isZeni = args.some(arg => arg.toLowerCase() === 'zeni');

    if (isZeni && amount > 0) {
        if (player.zeni < amount) {
            await sock.sendMessage(replyJid, { text: "Tu n'as pas assez de Zeni." });
            return;
        }

        await player.decrement('zeni', { by: amount });
        await targetPlayer.increment('zeni', { by: amount });

        await sock.sendMessage(replyJid, { text: `Tu as donné ${amount} Zeni à ${targetPlayer.name}.` });
        await sock.sendMessage(mentionedJid, { text: `💰 ${player.name} t'a donné ${amount} Zeni !` });
        return;
    }

    // Giving items
    const itemName = args.filter(arg => isNaN(parseInt(arg)) && !['zeni'].includes(arg.toLowerCase()) && !arg.startsWith('@')).join(' ');
    if (itemName) {
        let inventory = [...player.inventory];
        const itemIndex = inventory.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());

        if (itemIndex === -1) {
            await sock.sendMessage(replyJid, { text: `Tu n'as pas d'objet nommé "${itemName}" dans ton inventaire.` });
            return;
        }

        const quantity = amount > 0 ? amount : 1;
        if (inventory[itemIndex].quantity < quantity) {
            await sock.sendMessage(replyJid, { text: `Tu n'as pas assez de "${itemName}".` });
            return;
        }

        // Remove from sender
        inventory[itemIndex].quantity -= quantity;
        if (inventory[itemIndex].quantity <= 0) {
            inventory.splice(itemIndex, 1);
        }
        player.inventory = inventory;
        await player.save();

        // Add to receiver
        let targetInventory = [...targetPlayer.inventory];
        const targetItemIndex = targetInventory.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (targetItemIndex !== -1) {
            targetInventory[targetItemIndex].quantity += quantity;
        } else {
            targetInventory.push({ name: itemName, quantity: quantity });
        }
        targetPlayer.inventory = targetInventory;
        await targetPlayer.save();

        await sock.sendMessage(replyJid, { text: `Tu as donné ${quantity}x ${itemName} à ${targetPlayer.name}.` });
        await sock.sendMessage(mentionedJid, { text: `🎒 ${player.name} t'a donné ${quantity}x ${itemName} !` });

        // Handle stat changes if it's an item with bonuses
        const itemData = await Item.findOne({ where: { name: { [Op.like]: `%${itemName}%` } } });
        if (itemData) {
            const bonuses = itemData.statBonuses;
            for (const [stat, value] of Object.entries(bonuses)) {
                if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                    await player.decrement(stat, { by: value * quantity });
                    await targetPlayer.increment(stat, { by: value * quantity });
                }
            }
        }
    } else {
        await sock.sendMessage(replyJid, { text: "Spécifie ce que tu veux donner (ex: /donner @joueur 100 zeni OU /donner @joueur Senzu)." });
    }
});


// Command: /statut
commands.set('statut', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const inventory = player.inventory;
    const equipped = {
        head: false,
        chest: false,
        arms: false,
        legs: false,
        weapon: false
    };

    // For each item in inventory, check if it's in the DB and get its slot
    // Optimization: find all items from DB that are in inventory
    const itemNames = inventory.map(i => i.name);
    const dbItems = await Item.findAll({ where: { name: { [Op.in]: itemNames } } });

    dbItems.forEach(item => {
        if (equipped[item.slot] !== undefined) {
            equipped[item.slot] = true;
        }
    });

    try {
        const imageBuffer = await generateEquipmentStatusImage(equipped);
        let caption = `*État de l'équipement de ${player.name}*\n\n`;
        caption += `🟢 Protégé | ⚪ Non protégé\n\n`;
        caption += `${equipped.head ? '🟢' : '⚪'} Tête\n`;
        caption += `${equipped.chest ? '🟢' : '⚪'} Torse\n`;
        caption += `${equipped.arms ? '🟢' : '⚪'} Bras\n`;
        caption += `${equipped.legs ? '🟢' : '⚪'} Jambes\n`;
        caption += `${equipped.weapon ? '⚔️' : '⚪'} Arme\n`;

        await sock.sendMessage(replyJid, {
            image: imageBuffer,
            caption: caption
        });
    } catch (error) {
        console.error("Erreur génération statut visuel:", error);
        await sock.sendMessage(replyJid, { text: "Impossible de générer le visuel de l'équipement." });
    }
});

// Command: /help
commands.set('help', async (sock, message) => {
  const helpText = "*Commandes Disponibles:*\n" +
                   "/start - Commencer l'aventure Dragon Ball.\n" +
                   "/profile - Voir ton profil de guerrier.\n" +
                   "/statut - Voir l'état de ton équipement.\n" +
                   "/inventory - Consulter ton inventaire.\n" +
                   "/quests - Voir tes missions en cours.\n" +
                   "/map - Afficher la carte de l'univers.\n" +
                   "/bank - Accéder à tes Zeni.\n" +
                   "/boutique - Capsule Corp Shop.\n" +
                   "/joueurs - Voir les guerriers à proximité.\n" +
                   "/inspecter @joueur - Voir le profil d'un rival.\n" +
                   "/donner @joueur <montant> zeni OU <objet> - Donner un objet ou de l'argent.\n" +
                   "/action - Passer en mode RP.\n" +
                   "/menu - Revenir au menu principal.\n" +
                   "/help - Afficher cette aide.";
  await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Command: /action
commands.set('action', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
      await player.update({ mode: 'action' });
      await sock.sendMessage(message.key.remoteJid, { text: "Mode action activé. Décris tes actions en langage naturel pour interagir avec le monde." });
  } else {
      await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
  }
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
    await player.update({ mode: 'normal' });
  }

  const menuText = "🐉 *DRAGON BALL RP* 🐉\n\n" +
                   "Que souhaites-tu faire, guerrier ?\n\n" +
                   "🎮 `/action` - Entrer dans le monde (RP).\n" +
                   "👤 `/profil` - Ton profil de guerrier.\n" +
                   "📋 `/quests` - Tes missions.\n" +
                   "🗺️ `/map` - Carte de l'univers.\n" +
                   "💰 `/bank` - Gestion de tes Zeni.\n" +
                   "🛡️ `/statut` - Ton équipement.\n" +
                   "✨ `/competences` - Tes techniques de combat.\n" +
                   "🛒 `/boutique` - Capsule Corp Shop.\n" +
                   "👥 `/joueurs` - Guerriers aux alentours.\n" +
                   "🔍 `/inspecter @joueur` - Étudier un rival.\n" +
                   "🤝 `/donner @joueur ...` - Donner un objet.\n" +
                   "🌌 `/mondes` - Lieux de l'univers.\n" +
                   "🏆 `/tournoi` - Tenkaichi Budokai.\n" +
                   "❓ `/help` - Aide.";

  // Try sending the local menu image first
  try {
    if (fs.existsSync('./menu_image.jpg')) {
        await sock.sendMessage(message.key.remoteJid, {
            image: fs.readFileSync('./menu_image.jpg'),
            caption: menuText
        });
    } else {
        throw new Error("Local menu image not found");
    }
  } catch (error) {
    console.warn("Erreur envoi image menu locale, tentative fallback URL:", error.message);
    const dbzMenuUrl = "https://wallpaperaccess.com/full/18927.jpg"; // DBZ Wallpaper
    try {
        const response = await axios.get(dbzMenuUrl, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const imageBuffer = Buffer.from(response.data, 'binary');
        await sock.sendMessage(message.key.remoteJid, {
            image: imageBuffer,
            caption: menuText
        });
    } catch (fallbackError) {
        await sock.sendMessage(message.key.remoteJid, { text: menuText });
    }
  }
});

// Main command handler
async function handleCommand(sock, message, downloadMediaMessage) {
  if (message.key.fromMe) return;

  const messageText = (message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage?.caption) || "";
  if (!messageText && !message.message.imageMessage) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const senderName = message.pushName || jid;

  console.log(`[MSG] From "${senderName}" (${jid}) in ${replyJid}: "${messageText}"`);

  const player = await Player.findOne({ where: { whatsappId: jid } });

  // Handle registration flow
  if (player && player.registrationStep) {
      if (player.registrationStep === 'awaiting_name') {
          const playerName = messageText.trim();
          if (playerName.length > 2 && playerName.length <= 20 && !playerName.startsWith('/')) {
              await player.update({ name: playerName, registrationStep: 'awaiting_description' });

              // Create a bank account if not exists
              await Bank.findOrCreate({ where: { PlayerWhatsappId: jid } });

              // Assign starting quests
              const startingQuest = await Quest.findOne({ where: { title: 'Entraînement de Tortue Géniale' } });
              if (startingQuest) {
                  await player.addQuest(startingQuest, { through: { status: 'not_started' } });
              }

              await sock.sendMessage(replyJid, { text: `Enchanté, ${playerName}. Maintenant, décris ton personnage en une phrase (ex: "un guerrier fier de ses racines", "un prodige des arts martiaux").` });
          } else {
              await sock.sendMessage(replyJid, { text: "Nom invalide (3-20 caractères, pas de '/'). Réessaie." });
          }
      } else if (player.registrationStep === 'awaiting_description') {
        const description = messageText.trim();
        if (description.length > 10 && description.length <= 150) {
            await player.update({
                characterDescription: description,
                registrationStep: null, // Registration finished
                awaitingProfilePic: true
            });
            await sock.sendMessage(replyJid, { text: `Description enregistrée ! Pour terminer, envoie une image qui représentera ton personnage.` });
        } else {
            await sock.sendMessage(replyJid, { text: "Description trop courte ou trop longue (10-150 caractères). Réessaie." });
        }
      }
      return;
  }

  if (!player && !messageText.startsWith('/start')) {
    await sock.sendMessage(replyJid, { text: "Utilise /start pour commencer." });
    return;
  }

  // Handle free action mode
  if (player?.mode === 'action' && !messageText.startsWith('/')) {
    try {
        if (player.tutorialStep > 0 && player.tutorialStep < 3) {
            const { handleTutorialAction } = require('./tutorial-handler');
            await handleTutorialAction(sock, message, player, messageText);
        } else {
            await handleFreeAction(sock, message, player, messageText);
        }
    } catch (error) {
      console.error('Erreur action libre:', error);
      await sock.sendMessage(replyJid, { text: "Le MJ n'a pas pu interpréter ton action. Réessaie." });
    } finally {
        await player.update({ lastActivity: new Date() });
    }
    return;
  }


  // Handle standard commands
  if (!messageText.startsWith('/')) return;

  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);

  if (command) {
    try {
      await command(sock, message, args);
      if (player) {
          await player.update({ lastActivity: new Date() });
          // Mission completion will be handled by the AI now
      }
    } catch (error) {
      console.error(`Erreur commande ${commandName}:`, error);
      await sock.sendMessage(replyJid, { text: "Une erreur est survenue lors de l'exécution de la commande." });
    }
  } else {
    await sock.sendMessage(replyJid, { text: "Commande inconnue. Tape /help pour voir la liste des commandes." });
  }
}

module.exports = { handleCommand, getJid };
