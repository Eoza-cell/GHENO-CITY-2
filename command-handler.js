const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, Skill } = require('./database');
const { generateEquipmentStatusImage } = require('./equipment-visualizer');
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
    await sock.sendMessage(replyJid, { text: "*Bienvenue à Gheno City, l'endroit où tout est possible si tu as le cran et le flingue pour...*\n\nIci, la rue ne pardonne pas. Que tu sois un petit malfrat de Little Sicily ou que tu vises le sommet de la tour de l'Union Depository, tu vas devoir te faire un nom. Les gangs se battent pour chaque centimètre d'asphalte, le LSPD est partout, et l'argent est le seul dieu reconnu.\n\n*Prépare-toi... la ville t'attend.*\n\n*3... 2... 1... GO!*\n\nPour commencer, quel est ton nom de rue, petit ?" });
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
        await sock.sendMessage(replyJid, { text: "Tu ne possèdes aucune spécialité pour le moment. Entraîne-toi dans les centres de formation pour en apprendre !" });
        return;
    }

    let skillText = `*Spécialités de ${player.name}:*\n\n`;

    const activeSkills = skills.filter(s => s.type === 'active' || s.type === 'spell' || s.type === 'sword_technique');
    const passiveSkills = skills.filter(s => s.type === 'passive');

    if (activeSkills.length > 0) {
        skillText += "*Capacités Actives:*\n";
        activeSkills.forEach(s => {
            skillText += `- *${s.name}* (${s.manaCost} Énergie): ${s.description}\n`;
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

    let questText = '--- 📜 LISTE DES CONTRATS --- \n\n';
    if (activeQuests.length > 0) {
        questText += '*⚔️ En Cours:*\n' + activeQuests.map(q => `├ ${q.title}\n└ ${q.description}`).join('\n\n') + '\n\n';
    }
    if (notStartedQuests.length > 0) {
        questText += '*📍 Disponibles:*\n' + notStartedQuests.map(q => `└ ${q.title}`).join('\n');
    }

    if (activeQuests.length === 0 && notStartedQuests.length === 0) {
        questText += "Aucun contrat à l'horizon. Fais-toi discret ou cherche du boulot !";
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

  const healthBar = createStatusBar(player.health, player.maxHealth);
  const manaBar = createStatusBar(player.mana, player.maxMana);
  const xpNeeded = player.level * 100;
  const xpBar = createStatusBar(player.xp, xpNeeded);

  const profileText = `--- 🆔 GHENO PHONE - PROFIL --- \n\n` +
                      `👤 *JOUEUR:* ${player.name} (${player.age} ans)\n` +
                      `🎭 *RÔLE:* ${player.class}\n` +
                      `💼 *JOB:* ${player.job} (${player.salary} $/mois)\n` +
                      `🎖️ *NOTORIÉTÉ:* ${player.rank}\n` +
                      `📊 *NIVEAU:* ${player.level}\n\n` +
                      `❤️ *VIE:*  [${healthBar}] ${player.health}/${player.maxHealth}\n` +
                      `⚡ *ÉNERGIE:* [${manaBar}] ${player.mana}/${player.maxMana}\n` +
                      `✨ *XP:*   [${xpBar}] ${player.xp}/${xpNeeded}\n\n` +
                      `--- ⚔️ CAPACITÉS --- \n` +
                      `💪 Force: ${player.strength}\n` +
                      `🏃 Agilité: ${player.agility}\n` +
                      `🧠 Intelligence: ${player.intelligence}\n` +
                      `🛡️ Défense: ${player.defense}\n` +
                      `🍀 Chance: ${player.luck}\n` +
                      `✨ *SP:* ${player.skillPoints}\n\n` +
                      `💰 *DOLLARS:* ${player.col} $\n` +
                      `---------------------------`;

  await sock.sendMessage(replyJid, { text: profileText });
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
                        `🎭 *RÔLE:* ${targetPlayer.class}\n` +
                        `🎖️ *NOTORIÉTÉ:* ${targetPlayer.rank}\n` +
                        `📊 *NIVEAU:* ${targetPlayer.level}\n\n` +
                        `❤️ *VIE:*  [${healthBar}] ${targetPlayer.health}/${targetPlayer.maxHealth}\n` +
                        `⚡ *ÉNERGIE:* [${manaBar}] ${targetPlayer.mana}/${targetPlayer.maxMana}\n` +
                        `✨ *XP:*   [${xpBar}] ${targetPlayer.xp}/${xpNeeded}\n\n` +
                        `📜 *BIO:* ${targetPlayer.characterDescription || 'Aucune description.'}\n\n` +
                        `--- ⚔️ CAPACITÉS --- \n` +
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
    const mapText = `--- 🗺️ CARTE DE GHENO CITY --- \n\n` +
                    `📍 *QUARTIER:* ${player.location}\n\n` +
                    `🏰 *TERRITOIRES & POINTS D'INTÉRÊT:* \n` +
                    dungeons.map(d => `├ ${d.name} (Difficulté ${d.rank})`).join('\n') +
                    `\n\n_La ville est immense. Déplace-toi via le mode /action._`;

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

    let boutiqueText = "--- ⚔️ AMMU-NATION --- \n\n";
    items.forEach(item => {
        boutiqueText += `*${item.name.toUpperCase()}*\n`;
        boutiqueText += `├ 💰 Prix: ${item.price} $\n`;
        const bonuses = item.statBonuses;
        const bonusStrings = Object.entries(bonuses).map(([stat, value]) => `${stat}: +${value}`);
        if (bonusStrings.length > 0) {
            boutiqueText += `├ ✨ Stats: ${bonusStrings.join(', ')}\n`;
        }
        boutiqueText += `└ 📜 ${item.description}\n\n`;
    });

    boutiqueText += "🛒 *Achat:* Utilise `/action` -> 'Je veux acheter [Objet]'.";

    // Show top-tier item image
    const featuredItem = items.find(i => i.name === 'Carabine spéciale') || items.find(i => i.name === 'Fusil de précision') || items.find(i => i.imageUrl);

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

    let text = "--- 🏰 FACTIONS DE GHENO CITY --- \n\n";
    kingdoms.forEach(k => {
        text += `*${k.name.toUpperCase()}*\n`;
        text += `├ 👑 Boss: ${k.leader}\n`;
        text += `├ ⚔️ Puissance de feu: ${k.militaryPower}\n`;
        text += `├ 📊 Influence urbaine: ${k.influence}\n`;
        text += `└ 📜 ${k.description}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /ecoles
commands.set('ecoles', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { School } = require('./database');
    const schools = await School.findAll();

    let text = "--- 🏫 CENTRES DE FORMATION --- \n\n";
    schools.forEach(s => {
        text += `*${s.name.toUpperCase()}*\n`;
        text += `├ 🧪 Spécialité: ${s.specialty}\n`;
        text += `├ 📍 Quartier: ${s.kingdomName}\n`;
        text += `└ 📜 ${s.description}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /examens
const examensCommand = async (sock, message) => {
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
};
commands.set('examen', examensCommand);
commands.set('examens', examensCommand);

// Command: /god
commands.set('god', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    // Handle claiming God status with code
    if (args[0] === '201148') {
        await player.update({ isGod: true });
        await sock.sendMessage(replyJid, { text: "Lien établi. Tu es désormais reconnu comme une entité divine dans la matrice de Gheno City." });
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
            const amountCol = parseInt(args[0]);
            if (!isNaN(amountCol)) {
                await targetPlayer.increment('col', { by: amountCol });
                await sock.sendMessage(replyJid, { text: `${targetPlayer.name} a reçu ${amountCol} $ de la part du créateur.` });
            }
            break;
    }
});

// Command: /tournoi
commands.set('tournoi', async (sock, message) => {
    const replyJid = message.key.remoteJid;

    let text = "--- 🏆 L'ARENE DES GANGS --- \n\n";
    text += "Le Grand Tournoi de la Ville a lieu une fois par an (chaque mois réel).\n\n";
    text += "⚔️ *Format:* Duels 1v1 ou Guerres de Gangs.\n";
    text += "🎁 *Récompenses:* Armes de collection, Dollars, et contrôle de quartiers.\n\n";
    text += "_Les inscriptions s'ouvriront bientôt auprès de tes contacts._";

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

    const bankText = `--- 🏦 BANQUE DE MAZE BANK --- \n\n` +
                     `💳 *SOLDE:* ${bank.balance} $\n\n` +
                     `--------------------------- \n` +
                     `_Pour déposer ou retirer, utilise le mode /action._\n` +
                     `_Ex: "Je dépose 50 $ à la banque"_`;

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
    const isCol = args.some(arg => arg.toLowerCase() === 'col' || arg.toLowerCase() === 'cols' || arg.toLowerCase() === '$' || arg.toLowerCase() === 'dollars');

    if (isCol && amount > 0) {
        if (player.col < amount) {
            await sock.sendMessage(replyJid, { text: "Tu n'as pas assez d'argent." });
            return;
        }

        await player.decrement('col', { by: amount });
        await targetPlayer.increment('col', { by: amount });

        await sock.sendMessage(replyJid, { text: `Tu as donné ${amount} $ à ${targetPlayer.name}.` });
        await sock.sendMessage(mentionedJid, { text: `💰 ${player.name} t'a donné ${amount} $ !` });
        return;
    }

    // Giving items
    const itemName = args.filter(arg => isNaN(parseInt(arg)) && !['col', 'cols', '$', 'dollars'].includes(arg.toLowerCase()) && !arg.startsWith('@')).join(' ');
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
        let caption = `*État de l'équipement tactique de ${player.name}*\n\n`;
        caption += `🟢 Équipé | ⚪ Vide\n\n`;
        caption += `${equipped.head ? '🟢' : '⚪'} Casque\n`;
        caption += `${equipped.chest ? '🟢' : '⚪'} Gilet\n`;
        caption += `${equipped.arms ? '🟢' : '⚪'} Gants\n`;
        caption += `${equipped.legs ? '🟢' : '⚪'} Jambières\n`;
        caption += `${equipped.weapon ? '🔫' : '⚪'} Arme\n`;

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
                   "/action - Passer en mode immersif (RP).\n" +
                   "/menu - Revenir au menu principal.\n" +
                   "/help - Afficher cette aide.";
  await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Command: /mode
commands.set('mode', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    const newMode = args[0]?.toLowerCase();
    if (newMode === 'story' || newMode === 'open') {
        const modeName = newMode === 'story' ? 'story' : 'open_world';
        await player.update({ rpMode: modeName });
        const displayMode = modeName === 'story' ? '📖 MODE HISTOIRE' : '🌎 MODE OPEN WORLD';
        await sock.sendMessage(replyJid, { text: `Mode de jeu changé pour : *${displayMode}*.\n\n${modeName === 'story' ? 'Tu te concentres désormais sur ton ascension personnelle et les missions principales.' : 'Tu es maintenant plongé dans le chaos de la ville avec les autres joueurs.'}` });
    } else {
        await sock.sendMessage(replyJid, { text: "Usage: /mode [story/open]\n\n📖 *Mode Histoire*: Focus sur ta narration et tes quêtes solo.\n🌎 *Open World*: Interaction multijoueur, guerres de territoires et événements globaux." });
    }
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

  const currentMode = player.rpMode === 'story' ? '📖 Histoire' : '🌎 Open World';
  const menuText = "🌆 *GHENO CITY 2: THE UNDERWORLD* 🌆\n" +
                   "━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                   `📍 *SESSION:* ${currentMode}\n` +
                   `👤 *IDENTITÉ:* ${player.name}\n` +
                   "━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                   "🎮 *DÉMARRAGE*\n" +
                   "└ `/action` - Entrer dans la matrice RP\n" +
                   "└ `/mode` - Changer de type de session\n\n" +
                   "📊 *DÉPARTEMENT CRIMINEL*\n" +
                   "├ `/profil` - Dossier complet\n" +
                   "├ `/statut` - Équipement tactique\n" +
                   "└ `/competences` - Spécialités\n\n" +
                   "🗺️ *NAVIGATION & CRIMES*\n" +
                   "├ `/map` - Territoires & Planques\n" +
                   "├ `/quests` - Contrats actifs\n" +
                   "└ `/boutique` - Ammu-Nation\n\n" +
                   "🏦 *FINANCES*\n" +
                   "└ `/bank` - Maze Bank Management\n\n" +
                   "🏙️ *CITY LIFE*\n" +
                   "├ `/joueurs` - Rivaux à proximité\n" +
                   "├ `/royaumes` - Factions & Gangs\n" +
                   "└ `/conflits` - Guerres en cours\n\n" +
                   "🎓 *FORMATION*\n" +
                   "├ `/ecoles` - Centres d'entraînement\n" +
                   "└ `/examens` - Casier & Études\n\n" +
                   "🏆 *ÉVÉNEMENTS*\n" +
                   "└ `/tournoi` - L'arène souterraine\n\n" +
                   "━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                   "❓ `/help` - Manuel de survie urbaine";

  // GTA V Style Menu Image - Check for local assets first
  let imageBuffer = null;
  // Use the specific user-provided background
  const localMenuPath = path.join(__dirname, 'assets', 'Screenshot_20260523-230447.jpg');

  try {
    if (fs.existsSync(localMenuPath)) {
        imageBuffer = fs.readFileSync(localMenuPath);
    } else if (fs.existsSync(path.join(__dirname, 'menu_image.jpg'))) {
        imageBuffer = fs.readFileSync(path.join(__dirname, 'menu_image.jpg'));
    } else {
        const menuImageUrl = "https://media-rockstargames-com.akamaized.net/rockstargames-newsite/img/global/games/fob/640/V.jpg";
        const response = await axios.get(menuImageUrl, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        imageBuffer = Buffer.from(response.data, 'binary');
    }

    await sock.sendMessage(message.key.remoteJid, {
      image: imageBuffer,
      caption: menuText
    });
  } catch (error) {
    console.error("Erreur envoi image menu:", error.message);
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
              await player.update({ name: playerName, registrationStep: 'awaiting_age' });

              // Create a bank account if not exists
              await Bank.findOrCreate({ where: { PlayerWhatsappId: jid } });

              // Assign starting quests
              const startingQuest = await Quest.findOne({ where: { title: 'Initiation au vol' } });
              if (startingQuest) {
                  await player.addQuest(startingQuest, { through: { status: 'not_started' } });
              }

              await sock.sendMessage(replyJid, { text: `Ok, ${playerName}. Quel âge as-tu ?` });
          } else {
              await sock.sendMessage(replyJid, { text: "Nom invalide (3-20 caractères, pas de '/'). Réessaie." });
          }
      } else if (player.registrationStep === 'awaiting_age') {
        const age = parseInt(messageText.trim());
        if (!isNaN(age) && age > 5 && age < 100) {
            const isStudent = age < 18;
            await player.update({
                age: age,
                isStudent: isStudent,
                schoolName: isStudent ? 'Lycée de Gheno City' : 'Aucune',
                registrationStep: 'awaiting_description'
            });
            let reply = `D'accord, ${age} ans. `;
            if (isStudent) {
                reply += "Comme tu es mineur, tu es inscrit d'office au *Lycée de Gheno City*. Tes résultats scolaires détermineront ton avenir.\n\n";
            }
            reply += "Maintenant, décris ton personnage en une phrase (ex: 'un jeune ambitieux des quartiers sud' ou 'un ancien pro du volant').";
            await sock.sendMessage(replyJid, { text: reply });
        } else {
            await sock.sendMessage(replyJid, { text: "Âge invalide. Entre un nombre entre 6 et 99." });
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

  // Handle driving mode (now integrated with AI MJ)
  if (player?.mode === 'driving' && !messageText.startsWith('/')) {
    try {
        await handleFreeAction(sock, message, player, messageText);
    } catch (error) {
        console.error('Erreur mode conduite AI:', error);
        await sock.sendMessage(replyJid, { text: "La connexion au véhicule est perdue." });
    } finally {
        await player.update({ lastActivity: new Date() });
    }
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
