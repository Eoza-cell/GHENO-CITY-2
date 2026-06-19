const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, Skill, Entity, Club, Kingdom, NPC, RPMessage, House, TournamentParticipant, sequelize } = require('./database');
const { Op } = require('sequelize');
const { generateEquipmentStatusImage } = require('./equipment-visualizer');
const { generateProfileCard } = require('./profile-generator');
const { generateLorePoster } = require('./lore-generator');
const { generateWorldMapImage } = require('./world-map');
const { generateMainMenuImage } = require('./menu-generator');
const { handleFreeAction } = require('./ai-handler');
const { startTutorial } = require('./tutorial-handler');
const { sendWithImage } = require('./message-handler');

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

// Command: /ping
commands.set('ping', async (sock, message) => {
    const start = Date.now();
    await sock.sendMessage(message.key.remoteJid, { text: "🏓 *Pong !*" });
    const latency = Date.now() - start;
    console.log(`[DIAG] Ping latency: ${latency}ms`);
});

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
    await sock.sendMessage(replyJid, { text: "*Bienvenue dans Aetheris, Héritier...*\n\nLe monde que tu connaissais n'est plus. Les sceaux se brisent, et l'Essence Primordiale s'éveille en toi. Entre la protection des Célestes et la menace des Bestiaux, ta lignée déterminera le futur de l'existence.\n\nTraverse l'Interstice, défie le Roi Vide et forge ton destin dans la matrice d'Aetheris.\n\n*...3_2_1...*\n\n*LINK START!!*\n\nPour commencer, quel est ton nom, Héritier ?" });
  } else if (player.registrationStep) {
    // Resume registration
    if (player.registrationStep === 'awaiting_name') {
        await sock.sendMessage(replyJid, { text: "Rappel: Quel est ton nom, Héritier ?" });
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
        skillText += "⚔️ *TECHNIQUES ET SORTS ACTIFS:*\n";
        activeSkills.forEach(s => {
            skillText += `├ *${s.name.toUpperCase()}*\n`;
            skillText += `│ 💠 Coût: ${s.manaCost} PM\n`;
            skillText += `└ 📜 ${s.description}\n\n`;
        });
    }

    if (passiveSkills.length > 0) {
        skillText += "✨ *COMPÉTENCES PASSIVES:*\n";
        passiveSkills.forEach(s => {
            skillText += `├ *${s.name}*\n`;
            skillText += `└ 📜 ${s.description}\n\n`;
        });
    }

    skillText += "_Débloque de nouvelles techniques à l'Académie ou via tes Pacts._";

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

    let questText = '╔══════════════════════════╗\n' +
                    '   📜 *JOURNAL DES QUÊTES*   \n' +
                    '╚══════════════════════════╝\n\n';

    if (activeQuests.length > 0) {
        questText += '⚔️ *MISSIONS ACTIVES*\n' +
                     activeQuests.map(q => {
                         const progress = q.PlayerQuest.progress || 0;
                         const bar = createStatusBar(progress, 100, '▰', '▱', 8);
                         return `├ *${q.title}*\n│ 📊 [${bar}] ${progress}%\n└ 📝 ${q.description}`;
                     }).join('\n\n') + '\n\n';
    }

    if (notStartedQuests.length > 0) {
        questText += '📍 *OBJECTIFS DÉCOUVERTS*\n' +
                     notStartedQuests.map(q => `└ 💠 ${q.title}`).join('\n') + '\n\n';
    }

    if (activeQuests.length === 0 && notStartedQuests.length === 0) {
        questText += "🌀 *Rien à signaler...*\nExplorez les environs pour trouver du travail, Héritier.";
    }

    questText += '\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

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
                          `👤 *HÉRITIER:* ${player.name}\n` +
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
                          `📍 *LIEU:* ${player.location} (${player.subLocation})\n` +
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
                        `📍 *LIEU:* ${targetPlayer.location} (${targetPlayer.subLocation})\n` +
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

// Command: /maison
commands.set('maison', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Houses' });

    if (!player) return;

    if (player.Houses.length === 0) {
        const availableHouses = await House.findAll({ where: { ownerId: null } });
        let text = "🏠 *SYSTÈME IMMOBILIER*\n\nTu ne possèdes aucune propriété. Maisons disponibles à proximité :\n\n";
        availableHouses.forEach(h => {
            text += `├ *${h.name}*\n│ 📍 Lieu: ${h.location}\n│ 💰 Prix: ${h.price} Col\n└ _Utilise /achetermaison ${h.id}_\n\n`;
        });
        return await sock.sendMessage(replyJid, { text });
    }

    const house = player.Houses[0]; // For now, handle one house
    if (args[0] === 'config') {
        const newTheme = args[1] || 'moderne';
        const newColor = args[2] || 'blanc';
        await house.update({ config: { theme: newTheme, color: newColor } });
        return await sock.sendMessage(replyJid, { text: `✅ *Maison configurée !*\nThème: ${newTheme}\nCouleur: ${newColor}` });
    }

    let houseText = `🏠 *TA MAISON : ${house.name}*\n\n`;
    houseText += `🎨 Config: Thème ${house.config.theme}, Couleur ${house.config.color}\n`;
    houseText += `📦 Stockage (${house.storage.length}/20 objets) :\n`;

    if (house.storage.length === 0) {
        houseText += "└ _Vide_";
    } else {
        house.storage.forEach(item => {
            houseText += `├ ${item.name} (x${item.quantity})\n`;
        });
    }

    houseText += "\n\n_Utilise /stocker <objet> ou /recuperer <objet>_";
    await sock.sendMessage(replyJid, { text: houseText });
});

commands.set('achetermaison', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const houseId = parseInt(args[0]);

    if (!player || !houseId) return;

    const house = await House.findByPk(houseId);
    if (!house || house.ownerId) {
        return await sock.sendMessage(replyJid, { text: "❌ Cette maison n'est pas disponible." });
    }

    if (player.col < house.price) {
        return await sock.sendMessage(replyJid, { text: `❌ Tu n'as pas assez de Col (${house.price} requis).` });
    }

    await player.decrement('col', { by: house.price });
    await house.update({ ownerId: player.whatsappId });
    await sock.sendMessage(replyJid, { text: `🎉 *Félicitations !* Tu es maintenant propriétaire de : ${house.name}.` });
});

commands.set('stocker', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Houses' });
    const itemName = args.join(' ');

    if (!player || player.Houses.length === 0 || !itemName) return;

    const house = player.Houses[0];
    let inventory = [...player.inventory];
    const itemIdx = inventory.findIndex(i => i.name.toLowerCase().includes(itemName.toLowerCase()));

    if (itemIdx === -1) return await sock.sendMessage(replyJid, { text: "❌ Objet introuvable dans ton inventaire." });

    const item = inventory[itemIdx];
    let storage = [...house.storage];

    // Add to storage
    const storageIdx = storage.findIndex(i => i.name === item.name);
    if (storageIdx !== -1) storage[storageIdx].quantity += 1;
    else storage.push({ name: item.name, quantity: 1 });

    // Remove from inventory
    if (item.quantity > 1) item.quantity -= 1;
    else inventory.splice(itemIdx, 1);

    await player.update({ inventory });
    await house.update({ storage });
    await sock.sendMessage(replyJid, { text: `📦 *${item.name}* a été déposé dans ton coffre.` });
});

commands.set('recuperer', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Houses' });
    const itemName = args.join(' ');

    if (!player || player.Houses.length === 0 || !itemName) return;

    const house = player.Houses[0];
    let storage = [...house.storage];
    const itemIdx = storage.findIndex(i => i.name.toLowerCase().includes(itemName.toLowerCase()));

    if (itemIdx === -1) return await sock.sendMessage(replyJid, { text: "❌ Objet introuvable dans ta maison." });

    const item = storage[itemIdx];
    let inventory = [...player.inventory];

    // Add to inventory
    const invIdx = inventory.findIndex(i => i.name === item.name);
    if (invIdx !== -1) inventory[invIdx].quantity += 1;
    else inventory.push({ name: item.name, quantity: 1 });

    // Remove from storage
    if (item.quantity > 1) item.quantity -= 1;
    else storage.splice(itemIdx, 1);

    await player.update({ inventory });
    await house.update({ storage });
    await sock.sendMessage(replyJid, { text: `🎒 *${item.name}* a été récupéré dans ton inventaire.` });
});

// Command: /vetements
const vetementsCommand = async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const items = await Item.findAll({ where: { type: 'clothing' } });

    if (items.length === 0) {
        return await sock.sendMessage(replyJid, { text: "La boutique de vêtements est vide." });
    }

    let text = "👗 *BOUTIQUE DE MODE D'AETHERYS*\n\n";

    for (const item of items) {
        const itemText = `*${item.name.toUpperCase()}*\n├ 💰 Prix: ${item.price} Col\n└ 📜 ${item.description}\n\n_Acheter via /action : "Je veux acheter ${item.name}"_`;

        if (item.imageUrl) {
            await sock.sendMessage(replyJid, {
                image: { url: item.imageUrl },
                caption: itemText
            });
        } else {
            text += itemText;
        }
    }

    if (text.length > 30) {
        await sock.sendMessage(replyJid, { text });
    }
};
commands.set('vetements', vetementsCommand);
commands.set('vêtements', vetementsCommand);

// Command: /top
commands.set('top', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const topPlayers = await Player.findAll({
        order: [['level', 'DESC'], ['xp', 'DESC']],
        limit: 10
    });

    let topText = "🏆 *CLASSEMENT DES MEILLEURS HÉRITIERS*\n\n";
    topPlayers.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
        topText += `${medal} *${p.name}* (Niv ${p.level})\n└ Rang ${p.rank} • ${p.class}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: topText });
});

// Command: /up
commands.set('up', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    if (args.length === 0) {
        let text = `--- 📈 AMÉLIORATION DES STATS --- \n\n`;
        text += `✨ Points de Compétence (SP) dispos : *${player.skillPoints}*\n\n`;
        text += `Utilise \`/up <stat> <points>\` pour augmenter tes stats :\n`;
        text += `- *FOR* (Force)\n`;
        text += `- *AGI* (Agilité)\n`;
        text += `- *INT* (Intelligence)\n`;
        text += `- *DEF* (Défense)\n`;
        text += `- *LUK* (Chance)\n\n`;
        text += `Exemple : \`/up for 5\``;
        return await sock.sendMessage(replyJid, { text });
    }

    const statMap = {
        'for': 'strength', 'force': 'strength', 'strength': 'strength',
        'agi': 'agility', 'agilité': 'agility', 'agility': 'agility',
        'int': 'intelligence', 'intelligence': 'intelligence',
        'def': 'defense', 'défense': 'defense', 'defense': 'defense',
        'luk': 'luck', 'chance': 'luck', 'luck': 'luck'
    };

    const requestedStat = args[0].toLowerCase();
    const targetStat = statMap[requestedStat];
    const points = parseInt(args[1]) || 1;

    if (!targetStat) {
        return await sock.sendMessage(replyJid, { text: "❌ Statistique invalide. Choisis entre FOR, AGI, INT, DEF, LUK." });
    }

    if (player.skillPoints < points) {
        return await sock.sendMessage(replyJid, { text: `❌ Tu n'as pas assez de SP. Il te manque ${points - player.skillPoints} SP.` });
    }

    if (points <= 0) {
        return await sock.sendMessage(replyJid, { text: "❌ Le nombre de points doit être supérieur à 0." });
    }

    await player.decrement('skillPoints', { by: points });
    await player.increment(targetStat, { by: points });
    await player.reload();

    const newVal = player[targetStat];
    const statName = requestedStat.toUpperCase();

    await sock.sendMessage(replyJid, { text: `✅ *Amélioration réussie !*\n\n${statName} : +${points} ➔ *${newVal}*\nSP restants : ${player.skillPoints}` });
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

    let playersText = `--- 👥 HÉRITIERS À PROXIMITÉ --- \n\n`;
    otherPlayers.forEach(p => {
        playersText += `*${p.name}*\n`;
        playersText += `├ 📍 ${p.subLocation}\n`;
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

// Command: /pacts
commands.set('pacts', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Entities' });

    if (!player) return;

    const entities = await Entity.findAll();
    const playerEntities = player.Entities || [];

    let text = "--- ✨ PACTES ET ENTITÉS --- \n\n";

    if (playerEntities.length > 0) {
        text += "*Tes Pactes Actifs:*\n";
        playerEntities.forEach(e => {
            text += `🔥 *${e.name}* (${e.type})\n└ Pouvoir: ${e.power}\n`;
        });
        text += "\n";
    }

    text += "*Entités Connues d'Aetherys:*\n";
    entities.forEach(e => {
        const isLinked = playerEntities.some(pe => pe.id === e.id);
        text += `${isLinked ? '✅' : '❓'} *${e.name}* (${e.type})\n`;
        text += `├ 📜 ${e.description}\n`;
        text += `└ ✨ Bonus: ${JSON.stringify(e.pactBonus)}\n\n`;
    });

    text += "_Pour forger un pacte, trouve l'entité via /action._";

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /clubs
commands.set('clubs', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Clubs' });

    if (!player) return;

    const clubs = await Club.findAll();
    const playerClubs = player.Clubs || [];

    let text = "--- 🏫 CLUBS DE L'ACADÉMIE --- \n\n";

    if (playerClubs.length > 0) {
        text += "*Tes Clubs:*\n";
        playerClubs.forEach(c => {
            text += `🔹 *${c.name}* (${c.PlayerClub.rank})\n`;
        });
        text += "\n";
    }

    text += "*Clubs Extrascolaires:*\n";
    clubs.forEach(c => {
        const isMember = playerClubs.some(pc => pc.id === c.id);
        text += `${isMember ? '✅' : '⚪'} *${c.name.toUpperCase()}*\n`;
        text += `├ 🧪 Spécialité: ${c.specialty}\n`;
        text += `├ 👑 Leader: ${c.leaderName}\n`;
        text += `└ 📜 ${c.description}\n\n`;
    });

    text += "_Rejoins un club via /action en parlant au leader._";

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

    const academicSuffix = player.academicYear === 1 ? 'ère' : 'ème';
    let text = "--- 📝 DOSSIER ACADÉMIQUE --- \n\n";
    text += `👤 *Élève:* ${player.name}\n`;
    text += `🎓 *Année:* ${player.academicYear}${academicSuffix} Année\n`;
    text += `🏫 *École:* ${player.schoolName}\n`;
    text += `📊 *Moyenne Générale:* ${player.academicGrade}/100\n\n`;
    text += `_Les examens de ${player.academicYear}${academicSuffix} année se passent via /action (écriture sur copie)._`;

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
    let targetJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    // Check if the first remaining arg is a mention (sometimes it's not in contextInfo but in text)
    if (!targetJid && args[0] && args[0].startsWith('@')) {
        const potentialId = args[0].substring(1);
        const found = await Player.findOne({ where: { whatsappId: { [Op.like]: `${potentialId}%` } } });
        if (found) {
            targetJid = found.whatsappId;
            args.shift();
        }
    } else if (targetJid && args[0] && args[0].startsWith('@')) {
        // Remove mention from args if it's there
        args.shift();
    }

    // If no mention found, target self
    if (!targetJid) {
        targetJid = jid;
    }

    if (!subCommand) {
        await sock.sendMessage(replyJid, { text: "Commandes Divines:\n/god set [@joueur] <stat> <valeur>\n/god give [@joueur] <item> <quantité>\n/god rank [@joueur] <rang>\n/god col [@joueur] <montant>\n/god pacte [@joueur] <entité>\n/god max [@joueur] (met toutes les stats à 999)\n\n(Si aucun joueur n'est mentionné, l'effet s'applique à toi-même)" });
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
        case 'pacte':
            const entityName = args.join(' ');
            if (entityName) {
                const entity = await Entity.findOne({ where: { name: { [Op.like]: `%${entityName}%` } } });
                if (entity) {
                    await targetPlayer.addEntity(entity);
                    const bonuses = entity.pactBonus || {};
                    for (const [stat, value] of Object.entries(bonuses)) {
                        if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                            await targetPlayer.increment(stat, { by: value });
                        }
                    }
                    await targetPlayer.save();
                    await targetPlayer.reload();
                    await sock.sendMessage(replyJid, { text: `🔥 *Pacte divin établi !* ${targetPlayer.name} est désormais lié à ${entity.name}.` });
                } else {
                    await sock.sendMessage(replyJid, { text: `❌ Entité "${entityName}" introuvable.` });
                }
            }
            break;
        case 'max':
            await targetPlayer.update({
                strength: 999,
                agility: 999,
                intelligence: 999,
                defense: 999,
                luck: 999,
                level: 100,
                health: 9999,
                maxHealth: 9999,
                mana: 9999,
                maxMana: 9999,
                rank: 'S'
            });
            await sock.sendMessage(replyJid, { text: `La puissance absolue a été accordée à ${targetPlayer.name}.` });
            break;
    }
});

// Command: /tournoi
commands.set('tournoi', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const participants = await TournamentParticipant.findAll();

    let text = "--- 🏆 GRAND TOURNOI D'AETHERYS --- \n\n";
    text += "Le Tournoi Inter-Écoles a lieu une fois par an.\n\n";
    text += `👥 *Inscrits:* ${participants.length}\n`;
    text += "⚔️ *Format:* Duels 1v1 par rangs.\n\n";

    if (participants.length > 0) {
        text += "*Participants Actuels:*\n";
        participants.forEach(p => {
            text += `├ ${p.playerName} (Rang ${p.rank}) - ${p.status}\n`;
        });
        text += "\n";
    }

    text += "🎁 *Récompenses:* Équipement légendaire, Col.\n\n";
    text += "👉 Utilise `/inscription_tournoi` pour participer !\n";
    text += "_Le tirage au sort sera effectué par les Administrateurs._";

    await sock.sendMessage(replyJid, { text: text });
});

commands.set('inscription_tournoi', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    const existing = await TournamentParticipant.findByPk(jid);
    if (existing) {
        return await sock.sendMessage(replyJid, { text: "❌ Tu es déjà inscrit au tournoi." });
    }

    await TournamentParticipant.create({
        playerJid: jid,
        playerName: player.name,
        rank: player.rank
    });

    await sock.sendMessage(replyJid, { text: `✅ *Inscription réussie !* Bonne chance pour le tournoi, ${player.name}.` });
});

commands.set('tirage_tournoi', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player || !player.isGod) {
        return await sock.sendMessage(replyJid, { text: "Seuls les administrateurs peuvent lancer le tirage." });
    }

    let participants = await TournamentParticipant.findAll({ where: { status: 'registered' } });

    if (participants.length === 0) {
        return await sock.sendMessage(replyJid, { text: "Aucun participant inscrit pour le moment." });
    }

    // Ensure even number by adding NPC
    if (participants.length % 2 !== 0) {
        const npcNames = ["Kaelith l'Invocatrice", "Guerrier d'Élite d'Elion", "Apprenti de Nécropolis", "Gardien du Vide"];
        const npcName = npcNames[Math.floor(Math.random() * npcNames.length)];
        const newNpc = await TournamentParticipant.create({
            playerJid: `npc_${Date.now()}`,
            playerName: `[PNJ] ${npcName}`,
            rank: 'B',
            status: 'registered'
        });
        participants.push(newNpc);
    }

    // Shuffle
    participants = participants.sort(() => Math.random() - 0.5);

    let drawText = "--- ⚔️ TIRAGE AU SORT DU TOURNOI --- \n\n";
    for (let i = 0; i < participants.length; i += 2) {
        const p1 = participants[i];
        const p2 = participants[i+1];

        await p1.update({ opponentJid: p2.playerJid, status: 'qualified' });
        await p2.update({ opponentJid: p1.playerJid, status: 'qualified' });

        drawText += `🔥 Match ${Math.floor(i/2) + 1} :\n*${p1.playerName}*  VS  *${p2.playerName}*\n\n`;
    }

    drawText += "_Les duels peuvent commencer via /action !_";
    await sock.sendMessage(replyJid, { text: drawText });
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

    if (player.location !== targetPlayer.location || player.subLocation !== targetPlayer.subLocation) {
        await sock.sendMessage(replyJid, { text: "Tu dois être juste à côté du joueur pour lui donner quelque chose." });
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

// Command: /dbbackup
commands.set('dbbackup', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player || !player.isGod) {
        await sock.sendMessage(replyJid, { text: "Seuls les dieux peuvent extraire l'essence de la matrice." });
        return;
    }

    try {
        const models = sequelize.models;
        const backup = {};
        for (const [name, model] of Object.entries(models)) {
            backup[name] = await model.findAll();
        }

        const backupPath = path.join(__dirname, `backup_${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

        await sock.sendMessage(replyJid, {
            document: { url: backupPath },
            mimetype: 'application/json',
            fileName: 'Aetherys_Matrix_Backup.json',
            caption: "💾 *BACKUP DE LA MATRICE RÉUSSI*"
        });

        fs.unlinkSync(backupPath);
    } catch (error) {
        console.error("Backup error:", error);
        await sock.sendMessage(replyJid, { text: "Erreur lors de la création du backup." });
    }
});

// Command: /dbrestore
commands.set('dbrestore', async (sock, message, args, downloadMediaMessage) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player || !player.isGod) {
        await sock.sendMessage(replyJid, { text: "Seuls les dieux peuvent réécrire la matrice." });
        return;
    }

    const docMessage = message.message.documentMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;

    if (!docMessage) {
        await sock.sendMessage(replyJid, { text: "Envoie ou cite un fichier JSON de backup pour restaurer la matrice." });
        return;
    }

    try {
        const targetMessage = message.message.documentMessage ? message : { message: message.message.extendedTextMessage.contextInfo.quotedMessage };
        const buffer = await downloadMediaMessage(targetMessage, 'buffer');
        const backup = JSON.parse(buffer.toString());

        await sequelize.transaction(async (t) => {
            for (const [name, data] of Object.entries(backup)) {
                const model = sequelize.models[name];
                if (model) {
                    await model.destroy({ where: {}, transaction: t });
                    await model.bulkCreate(data, { transaction: t });
                }
            }
        });

        await sock.sendMessage(replyJid, { text: "✅ *MATRICE RESTAURÉE AVEC SUCCÈS*" });
    } catch (error) {
        console.error("Restore error:", error);
        await sock.sendMessage(replyJid, { text: "Erreur lors de la restauration : " + error.message });
    }
});

// Command: /lore
commands.set('lore', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const topic = args.join(' ').trim();

    if (!topic) {
        const categories = `📚 *BIBLIOTHÈQUE D'AETHERYS*\n\nUtilise \`/lore <nom>\` pour en savoir plus :\n\n- *Royaumes* (Néanthea, Elion, etc.)\n- *Lieux* (Interstice, Nécropolis, etc.)\n- *Entités* (Roi Vide, Ignis, etc.)\n- *Clubs* (Kendo, Occultisme, etc.)\n- *Histoire* (Héritiers, Convergence, Éveil)`;
        return await sock.sendMessage(replyJid, { text: categories });
    }

    await sock.sendMessage(replyJid, { text: "🔍 _Recherche dans les archives d'Aetherys..._" });

    let loreData = null;
    let type = 'LORE';

    // Search in Entities
    const entity = await Entity.findOne({ where: { name: { [Op.like]: `%${topic}%` } } });
    if (entity) { loreData = { title: entity.name, content: entity.description, type: 'ENTITY' }; }

    if (!loreData) {
        const kingdom = await Kingdom.findOne({ where: { name: { [Op.like]: `%${topic}%` } } });
        if (kingdom) { loreData = { title: kingdom.name, content: kingdom.description, type: 'KINGDOM' }; }
    }

    if (!loreData) {
        const npc = await NPC.findOne({ where: { name: { [Op.like]: `%${topic}%` } } });
        if (npc) { loreData = { title: npc.name, content: npc.description, type: 'NPC', imageUrl: npc.imageUrl }; }
    }

    if (!loreData) {
        const club = await Club.findOne({ where: { name: { [Op.like]: `%${topic}%` } } });
        if (club) { loreData = { title: club.name, content: club.description, type: 'CLUB' }; }
    }

    if (!loreData) {
        const worldLore = {
            'one above all': "L'origine même de l'existence, le créateur du temps, de l'espace, de la vie et de la mort. Il demeure silencieux mais reviendra juger sa création.",
            'idée du mal': "Conscience collective alimentée par les peurs et la haine de l'humanité. Elle manipule discrètement le destin du monde depuis les profondeurs.",
            'béhérit': "Reliques vivantes ressemblant à des visages de pierre déformés. Ils choisissent leur propriétaire lors d'un désespoir absolu. Impossibles à trouver sans aide divine.",
            'apôtres': "Humains ayant sacrifié ce qu'ils chérissent le plus via un Béhérit pour obtenir un pouvoir dépassant celui des mortels.",
            'interstice': "Dimension située entre tous les mondes. C'est là que l'Idée du Mal réside et que les pactes interdits sont conclus.",
            'origines': "Au commencement, One Above All façonna les Entités Célestes et Bestiales. L'humanité prospéra jusqu'à la naissance de l'Idée du Mal.",
            'nécropolis': "La cité silencieuse des morts gouvernée par Orpheon. Les âmes y attendent le jugement final du Dieu Suprême.",
            'missions historiques': "Quêtes projetant un Héritier dans le passé pour revivre la chute de grands royaumes ou la naissance des premiers Apôtres.",
            'histoire': "Le monde approche d'un nouvel âge chaotique où les Béhérits réapparaissent et les frontières entre les mondes s'effacent."
        };
        const key = Object.keys(worldLore).find(k => topic.toLowerCase().includes(k));
        if (key) {
            loreData = { title: key.charAt(0).toUpperCase() + key.slice(1), content: worldLore[key], type: 'HISTORY' };
        }
    }

    if (!loreData) {
        return await sock.sendMessage(replyJid, { text: `❌ Aucune archive trouvée pour "${topic}".` });
    }

    try {
        const posterPath = await generateLorePoster(loreData.title, loreData.content, loreData.type, loreData.imageUrl);
        await sock.sendMessage(replyJid, {
            image: { url: posterPath },
            caption: `📚 *Archives d'Aetherys : ${loreData.title}*\n\n${loreData.content}`
        });
    } catch (err) {
        console.error("[Lore] Error generating poster:", err);
        await sock.sendMessage(replyJid, { text: `📚 *Archives d'Aetherys : ${loreData.title}*\n\n${loreData.content}` });
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
                   "/royaumes - Géopolitique mondiale.\n" +
                   "/conflits - Guerres en cours.\n" +
                   "/ecoles - Liste des académies.\n" +
                   "/examens - Dossier scolaire.\n" +
                   "/clubs - Clubs extrascolaires.\n" +
                   "/pacts - Pactes avec les entités.\n" +
                   "/save - Sauvegarder tes données.\n" +
                   "/checkai - Diagnostic IA.\n" +
                   "/up <stat> <points> - Augmenter tes statistiques (SP).\n" +
                   "/evenement <description> - Déclencher un évent MJ (GOD).\n" +
                   "/lore <topic> - Consulter la bibliothèque.\n" +
                   "/action - Mode immersif (RP).\n" +
                   "/menu - Menu principal.\n" +
                   "/reset - Réinitialiser ton personnage.\n" +
                   "/help - Cette aide.";
  await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Command: /reset
commands.set('reset', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu n'as pas de personnage à réinitialiser." });
        return;
    }

    if (args[0] !== 'confirm') {
        await sock.sendMessage(replyJid, { text: "⚠️ *ATTENTION* ⚠️\n\nCette action supprimera définitivement ton personnage, tes statistiques, ton inventaire et ta progression.\n\nPour confirmer, tape : `/reset confirm`" });
        return;
    }

    try {
        // We delete the player. Associations like Bank might need manual cleanup if not cascading.
        await Bank.destroy({ where: { PlayerWhatsappId: jid } });
        // PlayerQuest and PlayerSkill should be handled by sequelize if constraints are right,
        // but often in SQLite/Manual sync we might need to be careful.
        // However, destroying the player is the core.
        await player.destroy();

        await sock.sendMessage(replyJid, { text: "💥 *Personnage réinitialisé.* Ta présence a été effacée de la matrice d'Aetherys. Utilise `/start` pour renaître." });
    } catch (error) {
        console.error("Erreur reset personnage:", error);
        await sock.sendMessage(replyJid, { text: "Une erreur est survenue lors de la réinitialisation de ton personnage." });
    }
});

// Command: /evenement
commands.set('evenement', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player || !player.isGod) {
        await sock.sendMessage(replyJid, { text: "Seuls les administrateurs peuvent manipuler le destin." });
        return;
    }

    const eventDesc = args.join(' ');
    if (!eventDesc) {
        await sock.sendMessage(replyJid, { text: "Utilise /evenement <description> pour introduire un monstre ou un événement." });
        return;
    }

    await sock.sendMessage(replyJid, { text: "🌍 *Manipulation de la réalité en cours...*" });

    const systemPrompt = `Tu es le MJ d'Arise. Un administrateur déclenche un événement spécial.
LORE: Convergence, Éveil, Monstres, Entités.
RÈGLES: Décris l'apparition brutale d'un monstre, d'une entité ou d'un événement environnemental.
FORMAT: JSON STRICT {"narrative":"...","actions":[],"imagePrompt":"..."}`;

    const userPrompt = `LIEU: ${player.location}\nÉVÉNEMENT: ${eventDesc}`;

    try {
        const { callAI } = require('./ai-utils');
        const content = await callAI(systemPrompt, userPrompt);
        if (!content) throw new Error("IA muette");

        let aiResponse = { narrative: "L'air crépite... quelque chose arrive." };
        try {
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                aiResponse = JSON.parse(content.substring(start, end + 1));
            }
        } catch (e) {}

        // Save event to history
        await RPMessage.create({
            senderJid: 'system',
            senderName: 'Arise MJ',
            content: aiResponse.narrative,
            location: player.location
        });

        const { sendWithImage } = require('./message-handler');
        await sendWithImage(sock, replyJid, aiResponse);
    } catch (error) {
        console.error("[CMD] Erreur /evenement:", error);
        await sock.sendMessage(replyJid, { text: "La réalité a résisté à la modification." });
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
        if (result.includes("Le flux magique est instable")) status = "🔴 *LIMITE ATTEINTE*";

        await sock.sendMessage(replyJid, {
            text: `--- 🧠 ÉTAT DE L'IA --- \n\n` +
                  `Statut: ${status}\n` +
                  `Latence: ${duration}s\n` +
                  `Serveur Ollama: ${process.env.OLLAMA_URL || 'http://localhost:11434'}\n` +
                  `Réponse: ${result.substring(0, 100)}...\n\n` +
                  `_Si le statut est dégradé, vérifiez vos clés API ou la connexion Ollama._`
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

  const menuText = "╔══════════════════════════╗\n" +
                   "   🌐  *ARISE : GHENO CITY*  🌐\n" +
                   "╚══════════════════════════╝\n\n" +
                   "🕹️ *IMMERSION*\n" +
                   "└ `/action` - Entrer dans le RP\n\n" +
                   "👤 *HÉRITIER*\n" +
                   "├ `/profil` - Statut & Stats\n" +
                   "├ `/inventory` - Sac à dos\n" +
                   "└ `/competences` - Sorts & Skills\n\n" +
                   "📍 *NAVIGATION*\n" +
                   "├ `/map` - Monde & Donjons\n" +
                   "├ `/quests` - Journal d'objectifs\n" +
                   "└ `/joueurs` - Qui est ici ?\n\n" +
                   "💰 *ÉCONOMIE*\n" +
                   "├ `/bank` - Ton compte (Col)\n" +
                   "├ `/boutique` - Armes & Items\n" +
                   "└ `/vetements` - Mode Aetherys\n\n" +
                   "🏛️ *SOCIÉTÉ*\n" +
                   "├ `/lore` - Bibliothèque\n" +
                   "├ `/pacts` - Entités & Pactes\n" +
                   "├ `/maison` - Ton domicile\n" +
                   "└ `/clubs` - Clubs Académiques\n\n" +
                   "🏆 *COMPÉTITION*\n" +
                   "├ `/top` - Classement Global\n" +
                   "└ `/tournoi` - Événements PVP\n\n" +
                   "⚙️ *SYSTÈME*\n" +
                   "├ `/help` - Aide complète\n" +
                   "└ `/save` - Sauvegarder\n\n" +
                   "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬";

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
