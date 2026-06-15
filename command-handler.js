const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, Skill } = require('./database');
const { generateEquipmentStatusImage } = require('./equipment-visualizer');
const { generateProfileCard } = require('./profile-generator');
const { generateWorldMapImage } = require('./world-map');
const { generateMainMenuImage } = require('./menu-generator');
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
    await sock.sendMessage(replyJid, { text: "*Soyez les bienvenus dans Skype chers joueurs, gameurs et bêta testeurs....pour votre plus grand plaisir*\n\nHélas un malheur guette nos cieux. Des portails se crée dans l'univers de Solo Leveling et apparaissent dans les mondes virtuels. La matrice de Skype est alors bourrée de failles actuellement.\n\nLe temps de réparer ce dommage collatéral, votre mission sera de conquérir les donjons , éliminer les boss tous plus impitoyables les uns que les autres , canaliser votre esprit...vous vous ferez des alliés mais aussi des énemies... mais n'oubliez surtout pas que mourir dans le jeu est un game over dans le real world...\n\n*...3_2_1...*\n\n*START!!*\n\nPour commencer, quel est votre nom, aventurier ?" });
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
    const player = await Player.findOne({ where: { whatsappId: jid }, include: Skill });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
        return;
    }

    const skills = player.Skills;

    if (!skills || skills.length === 0) {
        await sock.sendMessage(replyJid, { text: "Tu ne possèdes aucune compétence pour le moment. Étudie à l'Académie Impériale pour en apprendre !" });
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
    const player = await Player.findOne({ where: { whatsappId: jid }, include: Quest });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
        return;
    }

    const activeQuests = player.Quests.filter(q => q.PlayerQuest.status === 'in_progress');
    const notStartedQuests = player.Quests.filter(q => q.PlayerQuest.status === 'not_started');


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
      const manaBar = createStatusBar(player.mana, player.maxMana);
      const xpNeeded = player.level * 100;
      const xpBar = createStatusBar(player.xp, xpNeeded);

      const profileText = `--- 🆔 GHENO PHONE - PROFIL --- \n\n` +
                          `👤 *JOUEUR:* ${player.name}\n` +
                          `👪 *FAMILLE:* ${player.family}\n` +
                          `🎭 *CLASSE:* ${player.class}\n` +
                          `🎖️ *RANG:* ${player.rank}\n` +
                          `📊 *NIVEAU:* ${player.level}\n\n` +
                          `❤️ *VIE:*  [${healthBar}] ${player.health}/${player.maxHealth}\n` +
                          `🔷 *MANA:* [${manaBar}] ${player.mana}/${player.maxMana}\n` +
                          `✨ *XP:*   [${xpBar}] ${player.xp}/${xpNeeded}\n\n` +
                          `--- ⚔️ STATISTIQUES --- \n` +
                          `💪 Force: ${player.strength}\n` +
                          `🏃 Agilité: ${player.agility}\n` +
                          `🧠 Intelligence: ${player.intelligence}\n` +
                          `🛡️ Défense: ${player.defense}\n` +
                          `🍀 Chance: ${player.luck}\n` +
                          `✨ *SP:* ${player.skillPoints}\n\n` +
                          `💰 *COL:* ${player.col} 🪙\n` +
                          `---------------------------`;

      await sock.sendMessage(replyJid, {
          image: profileBuffer,
          caption: profileText
      });
  } catch (error) {
      console.error("Erreur génération carte profil:", error);
      const healthBar = createStatusBar(player.health, player.maxHealth);
      const manaBar = createStatusBar(player.mana, player.maxMana);
      const xpNeeded = player.level * 100;
      const xpBar = createStatusBar(player.xp, xpNeeded);

      const profileText = `--- 🆔 GHENO PHONE - PROFIL --- \n\n` +
                          `👤 *JOUEUR:* ${player.name}\n` +
                          `👪 *FAMILLE:* ${player.family}\n` +
                          `🎭 *CLASSE:* ${player.class}\n` +
                          `🎖️ *RANG:* ${player.rank}\n` +
                          `📊 *NIVEAU:* ${player.level}\n\n` +
                          `❤️ *VIE:*  [${healthBar}] ${player.health}/${player.maxHealth}\n` +
                          `🔷 *MANA:* [${manaBar}] ${player.mana}/${player.maxMana}\n` +
                          `✨ *XP:*   [${xpBar}] ${player.xp}/${xpNeeded}\n\n` +
                          `--- ⚔️ STATISTIQUES --- \n` +
                          `💪 Force: ${player.strength}\n` +
                          `🏃 Agilité: ${player.agility}\n` +
                          `🧠 Intelligence: ${player.intelligence}\n` +
                          `🛡️ Défense: ${player.defense}\n` +
                          `🍀 Chance: ${player.luck}\n` +
                          `✨ *SP:* ${player.skillPoints}\n\n` +
                          `💰 *COL:* ${player.col} 🪙\n` +
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
    const manaBar = createStatusBar(targetPlayer.mana, targetPlayer.maxMana);
    const xpNeeded = targetPlayer.level * 100;
    const xpBar = createStatusBar(targetPlayer.xp, xpNeeded);

    const profileText = `--- 🔍 INSPECTION - ${targetPlayer.name} --- \n\n` +
                        `👪 *FAMILLE:* ${targetPlayer.family}\n` +
                        `🎭 *CLASSE:* ${targetPlayer.class}\n` +
                        `🎖️ *RANG:* ${targetPlayer.rank}\n` +
                        `📊 *NIVEAU:* ${targetPlayer.level}\n\n` +
                        `❤️ *VIE:*  [${healthBar}] ${targetPlayer.health}/${targetPlayer.maxHealth}\n` +
                        `🔷 *MANA:* [${manaBar}] ${targetPlayer.mana}/${targetPlayer.maxMana}\n` +
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
    const mapText = `🗺️ *CARTE DU MONDE — AETHERYS*\n\n` +
                    `📍 *Position:* ${player.location}\n\n` +
                    `🏰 *Donjons par rang:*\n` +
                    dungeons.map(d => `├ ${d.name} (Rang ${d.rank})`).join('\n') +
                    `\n\n_Le monde est vaste. Déplace-toi via le mode /action._`;

    try {
        const mapImage = await generateWorldMapImage();
        await sock.sendMessage(replyJid, { image: mapImage, caption: mapText });
    } catch (err) {
        console.error('[MAP] Échec génération carte:', err.message);
        await sock.sendMessage(replyJid, { text: mapText });
    }
});

// Command: /boutique
commands.set('boutique', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const items = await Item.findAll({ order: [['price', 'ASC']] });

    if (items.length === 0) {
        await sock.sendMessage(replyJid, { text: "La boutique est vide pour le moment." });
        return;
    }

    const rarityEmoji = {
        'common': '⚪',
        'rare': '🔵',
        'epic': '🟣',
        'legendary': '🟡',
        'artifact': '🔴'
    };

    let boutiqueText = "--- ⚔️ FORGE DE BROKK (PROMOS !) --- \n\n";
    items.forEach(item => {
        const emoji = rarityEmoji[item.rarity] || '⚪';
        boutiqueText += `${emoji} *${item.name.toUpperCase()}* (${item.rarity})\n`;
        boutiqueText += `├ 💰 Prix: ${item.price} 🪙\n`;
        const bonuses = item.statBonuses;
        const bonusStrings = Object.entries(bonuses).map(([stat, value]) => `${stat}: +${value}`);
        if (bonusStrings.length > 0) {
            boutiqueText += `├ ✨ Stats: ${bonusStrings.join(', ')}\n`;
        }
        boutiqueText += `└ 📜 ${item.description}\n\n`;
    });

    boutiqueText += "🛒 *Achat:* Utilise `/action` -> 'Je veux acheter [Objet]'.";

    // Show top-tier item image (Excalibur or Elucidator)
    const featuredItem = items.find(i => i.name === 'Excalibur') || items.find(i => i.name === 'Elucidator') || items.find(i => i.imageUrl);

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
        playersText += `├ 👪 Famille: ${p.family}\n`;
        playersText += `├ 🎭 Classe: ${p.class} | 📊 Niveau: ${p.level}\n`;
        playersText += `├ 🎖️ Rang: ${p.rank}\n`;
        playersText += `└ 📜 Bio: ${p.characterDescription || '...'}\n\n`;
    });
    playersText += "_Utilise /action pour interagir avec eux._";

    await sock.sendMessage(replyJid, { text: playersText });
});

// Command: /royaumes
commands.set('royaumes', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { Kingdom } = require('./database');
    const kingdoms = await Kingdom.findAll();

    let text = "--- 🏰 ROYAUMES D'AETHERYS --- \n\n";
    kingdoms.forEach(k => {
        text += `*${k.name.toUpperCase()}*\n`;
        text += `├ 👑 Leader: ${k.leader}\n`;
        text += `├ ⚔️ Force Militaire: ${k.militaryPower}\n`;
        text += `├ 📊 Influence: ${k.influence}\n`;
        text += `└ 📜 ${k.description}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /ecoles
commands.set('ecoles', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { School } = require('./database');
    const schools = await School.findAll();

    let text = "--- 🏫 ACADÉMIES D'AETHERYS --- \n\n";
    schools.forEach(s => {
        text += `*${s.name.toUpperCase()}*\n`;
        text += `├ 🧪 Spécialité: ${s.specialty}\n`;
        text += `├ 📍 Royaume: ${s.kingdomName}\n`;
        text += `└ 📜 ${s.description}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /examens
commands.set('examens', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    let text = "--- 📝 DOSSIER ACADÉMIQUE --- \n\n";
    text += `👤 *Élève:* ${player.name}\n`;
    text += `🏫 *École:* ${player.schoolName}\n`;
    text += `📊 *Moyenne Générale:* ${player.academicGrade}/100\n\n`;
    text += `_Participe aux cours via /action pour améliorer tes notes et passer les examens._`;

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
        await sock.sendMessage(replyJid, { text: "Lien établi. Tu es désormais reconnu comme une entité divine dans la matrice d'Aetherys." });
        return;
    }

    if (!player.isGod) {
        await sock.sendMessage(replyJid, { text: "Seuls les êtres supérieurs possèdent ces pouvoirs. Utilise le code d'accès si tu en as un." });
        return;
    }

    const subCommand = args.shift()?.toLowerCase();
    const targetJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!subCommand) {
        await sock.sendMessage(replyJid, { text: "Commandes Divines:\n/god set @joueur <stat> <valeur>\n/god give @joueur <item> <quantité>\n/god rank @joueur <rang>\n/god col @joueur <montant>" });
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
        case 'col':
            const amount = parseInt(args[0]);
            if (!isNaN(amount)) {
                await targetPlayer.increment('col', { by: amount });
                await sock.sendMessage(replyJid, { text: `${targetPlayer.name} a reçu ${amount} Col de la part du créateur.` });
            }
            break;
    }
});

// Command: /tournoi
commands.set('tournoi', async (sock, message) => {
    const replyJid = message.key.remoteJid;

    let text = "--- 🏆 GRAND TOURNOI D'AETHERYS --- \n\n";
    text += "Le Tournoi Inter-Écoles a lieu une fois par an (chaque mois réel).\n\n";
    text += "⚔️ *Format:* Duels 1v1 par rangs.\n";
    text += "🎁 *Récompenses:* Équipement légendaire, Col, et titres de noblesse.\n\n";
    text += "_Les inscriptions s'ouvriront bientôt auprès du Directeur de ton école._";

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

    const bankText = `--- 🏦 BANQUE D'ELION --- \n\n` +
                     `💳 *SOLDE:* ${bank.balance} 🪙\n\n` +
                     `--------------------------- \n` +
                     `_Pour déposer ou retirer, utilise le mode /action._\n` +
                     `_Ex: "Je dépose 50 col à la banque"_`;

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
    const isCol = args.some(arg => arg.toLowerCase() === 'col' || arg.toLowerCase() === 'cols');

    if (isCol && amount > 0) {
        if (player.col < amount) {
            await sock.sendMessage(replyJid, { text: "Tu n'as pas assez de Col." });
            return;
        }

        await player.decrement('col', { by: amount });
        await targetPlayer.increment('col', { by: amount });

        await sock.sendMessage(replyJid, { text: `Tu as donné ${amount} Col à ${targetPlayer.name}.` });
        await sock.sendMessage(mentionedJid, { text: `💰 ${player.name} t'a donné ${amount} Col !` });
        return;
    }

    // Giving items
    const itemName = args.filter(arg => isNaN(parseInt(arg)) && !['col', 'cols'].includes(arg.toLowerCase()) && !arg.startsWith('@')).join(' ');
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
        await sock.sendMessage(replyJid, { text: "Spécifie ce que tu veux donner (ex: /donner @joueur 100 col OU /donner @joueur Épée)." });
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
// Command: /save
commands.set('save', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu n'as pas de données à sauvegarder. Utilise /start." });
        return;
    }

    try {
        await player.save();
        await sock.sendMessage(replyJid, { text: "💾 *SAUVEGARDE RÉUSSIE*\n\nTes données ont été synchronisées avec la matrice d'Aetherys. Tu pourras reprendre ton aventure à tout moment." });
    } catch (error) {
        console.error("Erreur sauvegarde joueur:", error);
        await sock.sendMessage(replyJid, { text: "Erreur lors de la sauvegarde de tes données." });
    }
});

commands.set('help', async (sock, message) => {
  const helpText = "*Commandes Disponibles:*\n" +
                   "/start - Commencer l'aventure.\n" +
                   "/profile - Voir ton profil de joueur.\n" +
                   "/statut - Voir l'état de ton équipement.\n" +
                   "/inventory - Consulter ton inventaire.\n" +
                   "/quests - Voir tes quêtes actives.\n" +
                   "/map - Afficher la carte du monde et les donjons.\n" +
                   "/bank - Accéder à ton compte en banque.\n" +
                   "/boutique - Acheter de l'équipement.\n" +
                   "/joueurs - Voir les joueurs à proximité.\n" +
                   "/inspecter @joueur - Voir le profil d'un autre joueur.\n" +
                   "/donner @joueur <montant> col OU <objet> - Donner un objet ou de l'argent.\n" +
                   "/save - Sauvegarder tes données manuellement.\n" +
                   "/checkai - Diagnostiquer l'état des serveurs IA.\n" +
                   "/action - Passer en mode immersif (RP).\n" +
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

// Command: /checkai
commands.set('checkai', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { callAI } = require('./ai-utils');

    await sock.sendMessage(replyJid, { text: "🔍 *DIAGNOSTIC DES FLUX MAGIQUES (IA)*...\nVeuillez patienter." });

    const startTime = Date.now();
    try {
        const result = await callAI("Tu es un testeur.", "Réponds juste 'OK' si tu m'entends.");
        const duration = (Date.now() - startTime) / 1000;

        let status = "🟢 *OPÉRATIONNEL*";
        if (result.includes("moteur MJ Local")) status = "🟡 *MODE DÉGRADÉ* (MJ Local)";

        await sock.sendMessage(replyJid, {
            text: `--- 🧠 ÉTAT DE L'IA --- \n\n` +
                  `Statut: ${status}\n` +
                  `Latence: ${duration}s\n` +
                  `Réponse: ${result.substring(0, 100)}...\n\n` +
                  `_Si le statut est dégradé, vérifiez vos clés API ou attendez quelques minutes._`
        });
    } catch (e) {
        await sock.sendMessage(replyJid, { text: "🔴 *ERREUR CRITIQUE*\nAucun flux magique n'a pu être établi. Contactez l'administrateur." });
    }
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
    await player.update({ mode: 'normal' });
  }

  const menuText = "🌐 *GHENO CITY 2: LINK START* 🌐\n\n" +
                   "Que souhaites-tu faire, voyageur ?\n\n" +
                   "🎮 `/action` - Entrer dans la matrice (RP).\n" +
                   "👤 `/profil` - Ton profil de joueur.\n" +
                   "📋 `/quests` - Liste de tes objectifs.\n" +
                   "🗺️ `/map` - Carte du monde & Donjons.\n" +
                   "💰 `/bank` - Gestion de tes Col (🪙).\n" +
                   "🛡️ `/statut` - État de ton équipement.\n" +
                   "✨ `/competences` - Sorts & Techniques.\n" +
                   "🛒 `/boutique` - Boutique d'objets.\n" +
                   "👥 `/joueurs` - Joueurs aux alentours.\n" +
                   "🔍 `/inspecter @joueur` - Inspecter un rival.\n" +
                   "🤝 `/donner @joueur ...` - Échange d'objets.\n" +
                   "🏰 `/royaumes` - Géopolitique mondiale.\n" +
                   "🛡️ `/conflits` - Guerres en cours.\n" +
                   "🏫 `/ecoles` - Liste des académies.\n" +
                   "📝 `/examens` - Ton dossier scolaire.\n" +
                   "🏆 `/tournoi` - Infos sur le grand tournoi.\n" +
                   "❓ `/help` - Guide de survie.";

  try {
    const menuImage = await generateMainMenuImage();
    await sock.sendMessage(message.key.remoteJid, {
        image: menuImage,
        caption: menuText
    });
  } catch (error) {
    console.warn("Erreur génération image menu:", error.message);
    await sock.sendMessage(message.key.remoteJid, { text: menuText });
  }
});

// Main command handler
async function handleCommand(sock, message, downloadMediaMessage) {
  if (message.key.fromMe) return;

  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

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
              const startingQuest = await Quest.findOne({ where: { title: 'La Chasse aux Gobelins' } });
              if (startingQuest) {
                  await player.addQuest(startingQuest, { through: { status: 'not_started' } });
              }

              await sock.sendMessage(replyJid, { text: `Enchanté, ${playerName}. Maintenant, décris ton personnage en une phrase (ex: "un épéiste rapide aux cheveux argentés", "une mage spécialisée dans les sorts de glace").` });
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
        if (player.tutorialStep >= 0 && player.tutorialStep < 3) {
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
