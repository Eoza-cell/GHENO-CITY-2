const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Player, PlayerVehicle } = require('./database');
const { handleFreeAction } = require('./ai-handler');
const { sendWithImage } = require('./message-handler');
const { getMission, checkMissionCompletion } = require('./missions');
const {
  accelerateVehicle,
  brakeVehicle,
  driveVehicle,
  parkVehicle,
} = require('./vehicle-handler');

/**
 * Determines the correct JID (Jabber ID) for the sender of a message.
 */
function getJid(message) {
  return message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;
}

const commands = new Map();
const registrationState = new Map(); // whatsappId -> 'awaiting_name' | 'awaiting_profile_pic'

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

// Helper function to generate ID card
async function generateIdCard(player) {
    // SVG is a better choice for text on images as it scales well.
    const textSvg = `
    <svg width="450" height="300">
      <style>
        .label { fill: #bbb; font-size: 30px; font-family: Arial, sans-serif; }
        .info { fill: #fff; font-size: 35px; font-family: Arial, sans-serif; }
      </style>
      <text x="0" y="40" class="label">NOM:</text>
      <text x="0" y="80" class="info">${player.name}</text>
      <text x="0" y="140" class="label">NIVEAU:</text>
      <text x="0" y="180" class="info">${player.level}</text>
      <text x="0" y="240" class="label">ARGENT:</text>
      <text x="0" y="280" class="info">${player.money}$</text>
    </svg>`;

    const resizedProfilePic = await sharp(player.profilePicPath).resize(250, 250).toBuffer();

    return sharp('./assets/id_card_template.png')
        .composite([
            { input: resizedProfilePic, top: 125, left: 50 },
            { input: Buffer.from(textSvg), top: 125, left: 350 },
        ])
        .png()
        .toBuffer();
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
  if (!player.profilePicPath) {
    registrationState.set(jid, 'awaiting_profile_pic');
    await sock.sendMessage(replyJid, { text: "Envoie une photo de profil pour générer ta carte d'identité." });
    return;
  }

  try {
    const idCardBuffer = await generateIdCard(player);
    const profileText = `*Profil de ${player.name}*\n\n` +
                        `*Niveau:* ${player.level}\n` +
                        `*XP:* ${player.xp}\n` +
                        `*Argent:* ${player.money}$`;
    await sock.sendMessage(replyJid, { image: idCardBuffer, caption: profileText });
  } catch (error) {
    console.error("Erreur lors de la génération de la carte d'identité:", error);
    await sock.sendMessage(replyJid, { text: "Erreur lors de la création de ta carte d'identité." });
  }
};
commands.set('profile', profileCommand);
commands.set('profil', profileCommand);


// Command: /help
commands.set('help', async (sock, message) => {
  const helpText = "Commandes disponibles:\n" +
                   "/start - (Re)commencer l'aventure.\n" +
                   "/quests - Voir tes objectifs.\n" +
                   "/profile - Afficher ton profil.\n" +
                   "/garage - Lister tes véhicules.\n" +
                   "/drive [id] - Conduire un véhicule.\n" +
                   "/park - Quitter le véhicule.\n" +
                   "/accelerate - Accélérer.\n" +
                   "/brake - Freiner.\n" +
                   "/action - Mode immersif (RP).\n" +
                   "/menu - Mode normal.\n" +
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

// Vehicle Commands
commands.set('accelerate', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  const result = await accelerateVehicle(player);
  await sendWithImage(sock, message.key.remoteJid, result.narrative);
});

commands.set('brake', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  const result = await brakeVehicle(player);
  await sendWithImage(sock, message.key.remoteJid, result.narrative);
});

commands.set('drive', async (sock, message, args) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  const vehicleId = args[0];
  const result = await driveVehicle(player, vehicleId);
  await sendWithImage(sock, message.key.remoteJid, result.narrative);
});

commands.set('park', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  const result = await parkVehicle(player);
  await sendWithImage(sock, message.key.remoteJid, result.narrative);
});

// Command: /garage
commands.set('garage', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const playerVehicles = await PlayerVehicle.findAll({
        where: { PlayerWhatsappId: player.whatsappId },
        include: 'Vehicle', // Assumes a 'Vehicle' association exists
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

commands.set('grab', async (sock, message) => {
  await sock.sendMessage(message.key.remoteJid, { text: 'Action de prendre effectuée.' });
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
              const [player] = await Player.findOrCreate({
                  where: { whatsappId: jid },
                  defaults: { name: playerName },
              });
              registrationState.delete(jid);
              const mission = getMission(player.chapter, player.quest);
              await sock.sendMessage(replyJid, { text: `Bienvenue, ${player.name}!\n\n*Objectif:*\n${mission.objective}` });
          } else {
              await sock.sendMessage(replyJid, { text: "Nom invalide (1-15 caractères, pas de '/')." });
          }
      }
      return;
  }

  const player = await Player.findOne({ where: { whatsappId: jid } });
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
          await checkMissionCompletion(sock, player);
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
