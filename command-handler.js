const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Player, Dungeon, Quest, PlayerQuest, Bank } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');

/**
 * Determines the correct JID (Jabber ID) for the sender of a message.
 */
function getJid(message) {
  return message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;
}

const commands = new Map();
const registrationState = new Map(); // whatsappId -> 'awaiting_name' | 'awaiting_description' | 'awaiting_profile_pic'

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const replyJid = message.key.remoteJid;

  if (!player) {
    registrationState.set(jid, 'awaiting_name');
    await sock.sendMessage(replyJid, { text: "*Soyez les bienvenus dans Skype chers joueurs, gameurs et bêta testeurs....pour votre plus grand plaisir*\n\nHélas un malheur guette nos cieux. Des portails se crée dans l'univers de Solo Leveling et apparaissent dans les mondes virtuels. La matrice de Skype est alors bourrée de failles actuellement.\n\nLe temps de réparer ce dommage collatéral, votre mission sera de conquérir les donjons , éliminer les boss tous plus impitoyables les uns que les autres , canaliser votre esprit...vous vous ferez des alliés mais aussi des énemies... mais n'oubliez surtout pas que mourir dans le jeu est un game over dans le real world...\n\n*...3_2_1...*\n\n*START!!*\n\nPour commencer, quel est votre nom, aventurier ?" });
  } else {
    await sock.sendMessage(replyJid, { text: `Content de te revoir, ${player.name} ! Utilise /quests pour voir tes objectifs.` });
  }
});

// Command: /quests
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

    let questText = '';
    if (activeQuests.length > 0) {
        questText += '*Quêtes en cours:*\n' + activeQuests.map(q => `- ${q.title}: ${q.description}`).join('\n') + '\n\n';
    }
    if (notStartedQuests.length > 0) {
        questText += '*Quêtes disponibles:*\n' + notStartedQuests.map(q => `- ${q.title}`).join('\n');
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

  const healthBar = createStatusBar(player.health, 100);
  const manaBar = createStatusBar(player.mana, 100);
  const xpNeeded = player.level * 100;
  const xpBar = createStatusBar(player.xp, xpNeeded);

  const profileText = `*Profil de ${player.name}*\n\n` +
                      `*Classe:* ${player.class} | *Rang:* ${player.rank}\n` +
                      `*Niveau:* ${player.level}\n\n` +
                      `*Vie:* ${healthBar} ${player.health}%\n` +
                      `*Mana:* ${manaBar} ${player.mana}%\n` +
                      `*XP:* ${xpBar} ${player.xp}/${xpNeeded}\n\n` +
                      `*Col:* ${player.col} 🪙`;

  await sock.sendMessage(replyJid, { text: profileText });
};
commands.set('profile', profileCommand);
commands.set('profil', profileCommand);

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

    const inventoryText = inventory.map(item => `- ${item.name} (x${item.quantity})`).join('\n');
    await sock.sendMessage(replyJid, { text: `*Inventaire:*\n\n${inventoryText}` });
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
    const mapText = `*Carte du monde*\n\n` +
                    `*Emplacement actuel:* ${player.location}\n\n` +
                    `*Donjons disponibles:*\n` +
                    dungeons.map(d => `- ${d.name} (Rang ${d.rank})`).join('\n');

    await sock.sendMessage(replyJid, { text: mapText });
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

    const bankText = `*Banque Centrale de Skype*\n\n` +
                     `*Solde:* ${bank.balance} 🪙\n\n` +
                     `Pour déposer ou retirer, utilise le mode /action.\n` +
                     `Ex: "Je dépose 50 col à la banque" ou "Je retire 100 col".`;

    await sock.sendMessage(replyJid, { text: bankText });
});


// Command: /help
commands.set('help', async (sock, message) => {
  const helpText = "*Commandes Disponibles:*\n" +
                   "/start - Commencer l'aventure.\n" +
                   "/profile - Voir ton profil de joueur.\n" +
                   "/inventory - Consulter ton inventaire.\n" +
                   "/quests - Voir tes quêtes actives.\n" +
                   "/map - Afficher la carte du monde et les donjons.\n" +
                   "/bank - Accéder à ton compte en banque.\n" +
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

// Command: /menu
commands.set('menu', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
    await player.update({ mode: 'normal' });
  }

  const menuText = "Menu Principal\n\n" +
                   "Que veux-tu faire ?\n\n" +
                   "🎮 `/action` - Passer en mode immersif (RP).\n" +
                   "👤 `/profil` - Voir ton statut.\n" +
                   "📋 `/quests` - Consulter tes quêtes.\n" +
                   "🗺️ `/map` - Ouvrir la carte du monde.\n" +
                   "💰 `/bank` - Accéder à la banque.\n" +
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
  const registrationStep = registrationState.get(jid);
  if (registrationStep) {
      if (registrationStep === 'awaiting_name') {
          const playerName = messageText.trim();
          if (playerName.length > 2 && playerName.length <= 20 && !playerName.startsWith('/')) {
               const [newPlayer, created] = await Player.findOrCreate({
                  where: { whatsappId: jid },
                  defaults: { name: playerName },
              });
               if (created) {
                   await Bank.create({ PlayerWhatsappId: jid }); // Create a bank account
                   // Assign starting quests
                   const startingQuest = await Quest.findOne({ where: { title: 'La Chasse aux Gobelins' } });
                   if (startingQuest) {
                       await newPlayer.addQuest(startingQuest, { through: { status: 'not_started' } });
                   }
               }
              registrationState.set(jid, 'awaiting_description');
              await sock.sendMessage(replyJid, { text: `Enchanté, ${playerName}. Maintenant, décris ton personnage en une phrase (ex: "un épéiste rapide aux cheveux argentés", "une mage spécialisée dans les sorts de glace").` });
          } else {
              await sock.sendMessage(replyJid, { text: "Nom invalide (3-20 caractères, pas de '/'). Réessaie." });
          }
      } else if (registrationStep === 'awaiting_description') {
        const description = messageText.trim();
        if (description.length > 10 && description.length <= 150) {
            await Player.update({ characterDescription: description, awaitingProfilePic: true }, { where: { whatsappId: jid } });
            registrationState.delete(jid); // We'll handle the pic upload outside the registration flow
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
      await handleFreeAction(sock, message, player, messageText);
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

module.exports = { handleCommand };
