const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Player, PlayerVehicle, Shop, Item, ShopItem, Family, House } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { sendWithImage } = require('./message-handler');
const { getMission, checkMissionCompletion } = require('./missions');
const { startDriving, handleDrivingAction, activeDrivers } = require('./driving-handler');
const { Op } = require('sequelize');

/**
 * Determines the correct JID (Jabber ID) for the sender of a message.
 */
function getJid(message) {
  return message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;
}

const commands = new Map();
const registrationState = new Map(); // whatsappId -> 'awaiting_name' | 'awaiting_profile_pic' | 'awaiting_description'

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const replyJid = message.key.remoteJid;

  if (!player) {
    registrationState.set(jid, 'awaiting_name');
    await sock.sendMessage(replyJid, { text: "Bienvenue à Gheno City 2 ! 🚗💥\n\nPour commencer, comment t'appelles-tu ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `Content de te revoir, ${player.name} ! Utilise /quests pour continuer.` });
  }
});

// Command: /quests
commands.set('quests', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const replyJid = message.key.remoteJid;

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const mission = getMission(player.chapter, player.quest);
  await sock.sendMessage(replyJid, { text: mission ? `*Objectif actuel:*\n${mission.objective}` : "Tu n'as pas de quête active." });
});

// Helper function to create a status bar
function createStatusBar(current, max, filledChar = '▰', emptyChar = '▱', length = 10) {
    const percentage = current / max;
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

  // No ID card generation for now, just text profile with status bars
  const healthBar = createStatusBar(player.health, 100);
  const energyBar = createStatusBar(player.energy, 100);
  const xpBar = createStatusBar(player.xp, player.level * 100);

  const family = player.FamilyId ? await Family.findByPk(player.FamilyId) : null;
  const familyName = family ? family.name : 'Indépendant';

  const profileText = `*Profil de ${player.name}*\n\n` +
                      `*Famille:* ${familyName}\n` +
                      `*Niveau:* ${player.level}\n` +
                      `*Argent:* ${player.money}$\n\n` +
                      `*Vie:* ${healthBar} ${player.health}%\n` +
                      `*Énergie:* ${energyBar} ${player.energy}%\n` +
                      `*XP:* ${xpBar} ${player.xp}/${player.level * 100}`;

  await sock.sendMessage(replyJid, { text: profileText });
};
commands.set('profile', profileCommand);
commands.set('profil', profileCommand);


// Command: /help
commands.set('help', async (sock, message) => {
  const helpText = "*Commandes Disponibles:*\n" +
                   "/start - (Re)commencer l'aventure.\n" +
                   "/quests - Voir tes objectifs.\n" +
                   "/profil - Afficher ta carte d'identité.\n" +
                   "/garage - Lister tes véhicules.\n" +
                   "/conduire [ID] - Démarrer la conduite d'un véhicule.\n" +
                   "/shop - Voir les articles du magasin local.\n" +
                   "/familles - Voir les familles influentes de la ville.\n" +
                   "/immobilier - Voir les maisons à vendre.\n" +
                   "/maisons - Voir tes propriétés.\n" +
                   "/interagir [nom] donner [article] [quantité] - Donner un objet à un joueur.\n" +
                   "/action - Passer en mode immersif (RP).\n" +
                   "/menu - Revenir au menu principal.\n" +
                   "/tagall - Mentionner tous les membres du groupe.\n" +
                   "/help - Afficher cette aide.";
  await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Command: /action
commands.set('action', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  await player.update({ mode: 'action' });
  await sock.sendMessage(message.key.remoteJid, { text: "Mode action activé. Décris tes actions en langage naturel." });
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
    await player.update({ mode: 'normal' });
  }

  const menuText = "Bienvenue à Gheno City 2.\n\nQue veux-tu faire ?\n\n" +
                   "🎮 `/action` - Passer en mode immersif (RP).\n" +
                   "👤 `/profil` - Voir ta carte d'identité.\n" +
                   "📋 `/quests` - Consulter tes objectifs.\n" +
                   "🚗 `/garage` - Accéder à tes véhicules.\n" +
                   "🛒 `/shop` - Voir les articles du magasin.\n" +
                   "❓ `/help` - Liste des commandes.";
  try {
    await sock.sendMessage(message.key.remoteJid, {
      image: fs.readFileSync('./menu_image.jpg'),
      caption: menuText
    });
  } catch (error) {
    console.error("Erreur envoi image menu:", error);
    await sock.sendMessage(message.key.remoteJid, { text: menuText });
  }
});

// Command: /garage
commands.set('garage', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const playerVehicles = await PlayerVehicle.findAll({
        where: { PlayerWhatsappId: player.whatsappId },
        include: 'Vehicle',
    });

    if (!playerVehicles.length) {
        await sock.sendMessage(message.key.remoteJid, { text: "Ton garage est vide." });
        return;
    }

    const garageText = playerVehicles.map(pv =>
        `- ID: ${pv.id} | ${pv.Vehicle.name} | Dégâts: ${pv.damage}%`
    ).join('\n');
    await sock.sendMessage(message.key.remoteJid, { text: `Ton garage:\n\n${garageText}` });
});

// Command: /conduire
commands.set('conduire', async (sock, message, args) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!args.length) {
        await sock.sendMessage(replyJid, { text: "Tu dois spécifier l'ID du véhicule que tu veux conduire. Trouve-le dans ton /garage." });
        return;
    }

    const playerVehicleId = parseInt(args[0], 10);
    if (isNaN(playerVehicleId)) {
        await sock.sendMessage(replyJid, { text: "L'ID du véhicule doit être un nombre." });
        return;
    }

    const playerVehicle = await PlayerVehicle.findOne({
        where: { id: playerVehicleId, PlayerWhatsappId: player.whatsappId },
        include: 'Vehicle',
    });

    if (!playerVehicle) {
        await sock.sendMessage(replyJid, { text: "Véhicule non trouvé dans ton garage." });
        return;
    }

    if (playerVehicle.damage >= 100) {
        await sock.sendMessage(replyJid, { text: `Ta ${playerVehicle.Vehicle.name} est trop endommagée pour être conduite.` });
        return;
    }

    await player.update({ mode: 'driving' });
    startDriving(sock, message, player, playerVehicle);
});


// Command: /shop
commands.set('shop', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    const shop = await Shop.findOne({ where: { location: player.location } });

    if (!shop) {
        await sock.sendMessage(replyJid, { text: "Il n'y a pas de magasin ici." });
        return;
    }

    const items = await shop.getItems();
    if (!items.length) {
        await sock.sendMessage(replyJid, { text: `Le magasin "${shop.name}" est vide.` });
        return;
    }

    const shopText = items.map(item => {
        const quantity = item.ShopItem.quantity === -1 ? '∞' : item.ShopItem.quantity;
        return `- ${item.name} | Prix: ${item.price}$ | Stock: ${quantity}`;
    }).join('\n');

    await sock.sendMessage(replyJid, { text: `*${shop.name}*\n\n${shopText}\n\nPour acheter, passe en mode /action et décris ton achat.` });
});

// Command: /interagir
commands.set('interagir', async (sock, message, args) => {
    const jid = getJid(message);
    const sourcePlayer = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (args.length < 3) {
        await sock.sendMessage(replyJid, { text: "Utilisation: /interagir [nom_joueur] donner [objet] [quantité?]" });
        return;
    }

    const targetPlayerName = args[0];
    const action = args[1].toLowerCase();

    if (targetPlayerName.toLowerCase() === sourcePlayer.name.toLowerCase()) {
        await sock.sendMessage(replyJid, { text: "Tu ne peux pas interagir avec toi-même." });
        return;
    }

    const targetPlayer = await Player.findOne({ where: { name: { [Op.like]: targetPlayerName } } });
    if (!targetPlayer) {
        await sock.sendMessage(replyJid, { text: `Joueur "${targetPlayerName}" non trouvé.` });
        return;
    }

    if (action === 'donner') {
        const itemName = args[2];
        const quantity = args.length > 3 ? parseInt(args[3], 10) : 1;

        if (isNaN(quantity) || quantity <= 0) {
            await sock.sendMessage(replyJid, { text: "La quantité doit être un nombre positif." });
            return;
        }

        const sourceInventory = sourcePlayer.inventory;
        const itemInInventory = sourceInventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());

        if (!itemInInventory || itemInInventory.quantity < quantity) {
            await sock.sendMessage(replyJid, { text: `Tu n'as pas assez de "${itemName}" (tu as ${itemInInventory ? itemInInventory.quantity : 0}).` });
            return;
        }

        // Retirer de l'inventaire source
        itemInInventory.quantity -= quantity;
        if (itemInInventory.quantity === 0) {
            sourcePlayer.inventory = sourceInventory.filter(i => i.name.toLowerCase() !== itemName.toLowerCase());
        } else {
            sourcePlayer.inventory = sourceInventory;
        }
        await sourcePlayer.save();

        // Ajouter à l'inventaire cible
        const targetInventory = targetPlayer.inventory;
        const targetItem = targetInventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (targetItem) {
            targetItem.quantity += quantity;
        } else {
            targetInventory.push({ name: itemInInventory.name, quantity: quantity });
        }
        targetPlayer.inventory = targetInventory;
        await targetPlayer.save();

        await sock.sendMessage(replyJid, { text: `Tu as donné ${quantity}x ${itemInInventory.name} à ${targetPlayer.name}.` });

        // Envoyer une notification au joueur cible (nécessite d'être dans le même groupe/chat)
        await sock.sendMessage(targetPlayer.whatsappId.endsWith('@g.us') ? targetPlayer.whatsappId : message.key.remoteJid, { text: `${sourcePlayer.name} t'a donné ${quantity}x ${itemInInventory.name}.` });

    } else {
        await sock.sendMessage(replyJid, { text: `Action "${action}" non reconnue.` });
    }
});


// Command: /familles
commands.set('familles', async (sock, message) => {
    const families = await Family.findAll();
    const replyJid = message.key.remoteJid;

    if (!families.length) {
        await sock.sendMessage(replyJid, { text: "Il n'y a pas encore de familles influentes répertoriées." });
        return;
    }

    const familyText = families.map(f =>
        `*${f.name}* (${f.influence} influence)\n_${f.description}_\n📍 Base: ${f.baseLocation}`
    ).join('\n\n');

    await sock.sendMessage(replyJid, { text: `*Les Familles de Gheno City*\n\n${familyText}\n\nPour rejoindre une famille, progresse dans tes missions.` });
});

// Command: /immobilier
commands.set('immobilier', async (sock, message) => {
    const houses = await House.findAll();
    const replyJid = message.key.remoteJid;

    if (!houses.length) {
        await sock.sendMessage(replyJid, { text: "Aucun bien immobilier n'est disponible pour le moment." });
        return;
    }

    const houseText = houses.map(h =>
        `🏠 *${h.name}*\n_${h.description}_\n📍 Lieu: ${h.location}\n💰 Prix: ${h.price}$`
    ).join('\n\n');

    await sock.sendMessage(replyJid, { text: `*Immobilier à Gheno City*\n\n${houseText}\n\nPour acheter, passe en mode /action et décris ton achat.` });
});

// Command: /maisons
commands.set('maisons', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({
        where: { whatsappId: jid },
        include: House
    });
    const replyJid = message.key.remoteJid;

    if (!player.Houses || player.Houses.length === 0) {
        await sock.sendMessage(replyJid, { text: "Tu ne possèdes aucune maison. Utilise /immobilier pour en trouver une." });
        return;
    }

    const houseText = player.Houses.map(h =>
        `- ${h.name} à ${h.location}`
    ).join('\n');

    await sock.sendMessage(replyJid, { text: `*Tes Propriétés:*\n\n${houseText}` });
});

// Command: /tagall
commands.set('tagall', async (sock, message) => {
    const jid = message.key.remoteJid;
    if (!jid.endsWith('@g.us')) {
        await sock.sendMessage(jid, { text: "Cette commande ne peut être utilisée que dans un groupe." });
        return;
    }

    try {
        const groupMetadata = await sock.groupMetadata(jid);
        const participants = groupMetadata.participants;
        let text = "Mention de tous les membres du groupe:\n";
        let mentions = [];

        for (let participant of participants) {
            const userJid = participant.id;
            text += `@${userJid.split('@')[0]}\n`;
            mentions.push(userJid);
        }

        await sock.sendMessage(jid, { text, mentions });
    } catch (error) {
        console.error("Erreur /tagall:", error);
        await sock.sendMessage(jid, { text: "Impossible de récupérer les membres du groupe." });
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

  console.log(`[DEBUG] Message de "${senderName}" (${jid}) dans ${replyJid}: "${messageText}"`);

  const player = await Player.findOne({ where: { whatsappId: jid } });

  // --- Driving Mode Check ---
  // Give driving priority. If a driving session is active in this chat, all non-command messages are driving actions.
  if (activeDrivers.has(replyJid) && !messageText.startsWith('/')) {
      const drivingPlayer = activeDrivers.get(replyJid).player;
      await handleDrivingAction(sock, message, drivingPlayer, messageText);
      return;
  }

  // Handle registration flow
  const registrationStep = registrationState.get(jid);
  if (registrationStep) {
      if (registrationStep === 'awaiting_profile_pic' && message.message.imageMessage) {
          try {
              const buffer = await downloadMediaMessage(message, 'buffer', {});
              const filePath = path.join('./assets/profile_pics', `${jid}.png`);
              await sharp(buffer).resize(250, 250).toFile(filePath);
              await Player.update({ profilePicPath: filePath }, { where: { whatsappId: jid } });
              registrationState.delete(jid);
              await sock.sendMessage(replyJid, { text: "Photo de profil enregistrée !" });
              await commands.get('profile')(sock, message);
          } catch (error) {
              console.error("Erreur sauvegarde photo:", error);
              await sock.sendMessage(replyJid, { text: "Erreur lors de la sauvegarde. Réessaie." });
          }
      } else if (registrationStep === 'awaiting_name') {
          const playerName = messageText.trim();
          if (playerName.length > 0 && playerName.length <= 15 && !playerName.startsWith('/')) {
               await Player.findOrCreate({
                  where: { whatsappId: jid },
                  defaults: { name: playerName },
              });
              registrationState.set(jid, 'awaiting_description');
              await sock.sendMessage(replyJid, { text: `Ok, ${playerName}. Maintenant, décris ton personnage en une phrase (ex: "un homme grand aux cheveux noirs", "une femme athlétique avec une cicatrice sur l'oeil").` });
          } else {
              await sock.sendMessage(replyJid, { text: "Nom invalide (1-15 caractères, pas de '/')." });
          }
      } else if (registrationStep === 'awaiting_description') {
        const description = messageText.trim();
        if (description.length > 10 && description.length <= 150) {
            await Player.update({ characterDescription: description }, { where: { whatsappId: jid } });
            registrationState.delete(jid);
            const player = await Player.findOne({ where: { whatsappId: jid } });
            const mission = getMission(player.chapter, player.quest);
            await sock.sendMessage(replyJid, { text: `Description enregistrée !\n\n*Objectif:*\n${mission.objective}` });
        } else {
            await sock.sendMessage(replyJid, { text: "Description trop courte ou trop longue (10-150 caractères)." });
        }
      }
      return;
  }

  if (!player && !messageText.startsWith('/start')) {
    await sock.sendMessage(replyJid, { text: "Utilise /start pour commencer." });
    return;
  }

  // Handle free action mode (if not driving)
  if (player?.mode === 'action' && !messageText.startsWith('/')) {
    try {
      await handleFreeAction(sock, message, player, messageText);
    } catch (error) {
      console.error('Erreur action libre:', error);
      await sock.sendMessage(replyJid, { text: "Erreur d'interprétation de l'action." });
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
          await checkMissionCompletion(sock, player, message);
      }
    } catch (error) {
      console.error(`Erreur commande ${commandName}:`, error);
      await sock.sendMessage(replyJid, { text: "Erreur exécution commande." });
    }
  } else {
    await sock.sendMessage(replyJid, { text: "Commande inconnue. Tape /help." });
  }
}

module.exports = { handleCommand };