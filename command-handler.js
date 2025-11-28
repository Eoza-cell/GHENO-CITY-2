const fs = require('fs');
const path = require('path');
// const sharp = require('sharp');
const { Player, Vehicle, PlayerVehicle } = require('./database');
const { isDay } = require('./game-state');
const { handleFreeAction } = require('./ai-handler');
const { generateImageFromPrompt } = require('./image-generator');
const { locations } = require('./data');

const commands = new Map();
const registrationState = new Map(); // whatsappId -> 'awaiting_name' | 'awaiting_profile_pic'

const WHEEL_SPIN_SPEED_THRESHOLD = 20;
const WHEEL_SPIN_ACCELERATION_THRESHOLD = 10;

// Helper function to send messages with potential image prompts
async function sendWithImage(sock, jid, text) {
  const promptRegex = /\[POLLINATION PROMPT: (.*?)\]/g;
  const matches = text.match(promptRegex);

  if (!matches) {
    await sock.sendMessage(jid, { text });
    return;
  }

  // Remove prompts from the original text
  const caption = text.replace(promptRegex, '').trim();

  // Send the text part first
  if (caption) {
    await sock.sendMessage(jid, { text: caption });
  }

  // Generate and send images for each prompt
  for (const match of matches) {
    const prompt = match.replace('[POLLINATION PROMPT: ', '').replace(']', '');
    try {
      const imageBuffer = await generateImageFromPrompt(prompt);
      await sock.sendMessage(jid, { image: imageBuffer });
    } catch (error) {
      // Log the detailed error for debugging
      console.error(`Échec de la génération d'image pour le prompt "${prompt}":`, error.message);

      // Inform the user with a more thematic message
      let userMessage = `[L'œil de l'esprit n'arrive pas à visualiser : "${prompt}"]`;
      if (error.message.includes('code de statut: 404')) {
          userMessage = `[L'inspiration pour "${prompt}" est introuvable dans l'éther...]`;
      } else if (error.message.includes('Erreur réseau')) {
          userMessage = `[Une tempête cosmique perturbe la connexion pour visualiser : "${prompt}"]`;
      }

      await sock.sendMessage(jid, { text: userMessage });
    }
  }
}

// The /start command
commands.set('start', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    registrationState.set(jid, 'awaiting_name');
    await sock.sendMessage(jid, { text: "Bienvenue à Gheno City 2 ! 🚗💥\n\nPour commencer, comment t'appelles-tu ?" });
  } else {
    const text = `Content de te revoir, ${player.name} ! Les rues de Gheno City t'attendaient. Utilise /quests pour continuer ta progression.`;
    await sock.sendMessage(jid, { text });
  }
});

// The /quests command
commands.set('quests', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player) {
    await sock.sendMessage(jid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (player.mode !== 'action') {
    await sock.sendMessage(jid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }

  let questText = "Quêtes Actuelles:\n\n";
  if (player.chapter === 1 && player.quest === 1) {
    questText += "Chapitre 1: Les Racines de Little Sicily\n" +
                 "Objectif: Vole une voiture pour te faire un nom.\n" +
                 "Commande: /stealcar";
  } else {
    questText += "Tu n'as pas de quête active pour le moment.";
  }

  await sock.sendMessage(jid, { text: questText });
});

// The /stealcar command
commands.set('stealcar', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player) {
    await sock.sendMessage(jid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (player.mode !== 'action') {
    await sock.sendMessage(jid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }

  if (player.chapter === 1 && player.quest === 1) {
    await player.update({ quest: 2, money: player.money + 500, xp: player.xp + 100 });
    const successText = "Avec des mains tremblantes mais déterminées, tu parviens à forcer la serrure et à faire démarrer le moteur. La voiture rugit à la vie, une bête de métal prête à t'obéir. Tu as réussi.\n\n" +
                        "Récompense : 500$ et 100 XP.\n\n" +
                        "La nouvelle s'est répandue dans Little Sicily. Le caïd local a entendu parler de toi et veut te voir.\n" +
                        "[POLLINATION PROMPT: Scène de rue nocturne, un gangster fait démarrer une voiture volée, phares allumés, tension palpable, style cinématique, hyperréalisme]";
    await sendWithImage(sock, jid, successText);
  } else {
    await sock.sendMessage(jid, { text: "Tu ne peux pas faire ça maintenant." });
  }
});


commands.set('profil', commands.get('profile')); // Alias
commands.set('profile', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player) {
    await sock.sendMessage(jid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const profileText = `
--- Carte d'Identité ---
👤 Nom: ${player.name}
🎖️ Niveau: ${player.level}
💰 Argent: ${player.money}$
-----------------------
  `.trim();

  await sock.sendMessage(jid, { text: profileText });
});

// The /grab command
commands.set('grab', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player) {
    await sock.sendMessage(jid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (player.mode !== 'action') {
    await sock.sendMessage(jid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }

  if (player.hasMoneyBag) {
    const amount = Math.floor(Math.random() * 500) + 250;
    await player.update({ money: player.money + amount, hasMoneyBag: false });
    await sock.sendMessage(jid, { text: `Tu as ramassé le sac et trouvé ${amount}$ !` });
  } else {
    await sock.sendMessage(jid, { text: "Il n'y a rien à ramasser." });
  }
});

// The /help command
commands.set('help', async (sock, message) => {
    const helpText = "Voici les commandes disponibles :\n" +
                     "/start - Commence ou reprends ton aventure.\n" +
                     "/quests - Affiche tes quêtes actuelles.\n" +
                     "/profile - Affiche ton profil de gangster.\n" +
                     "/garage - Affiche tes véhicules.\n" +
                     "/drive [id] - Monte dans un véhicule.\n" +
                     "/park - Descends du véhicule.\n" +
                     "/accelerate - Accélère.\n" +
                     "/action - Passe en mode action (RP).\n" +
                     "/menu - Retourne au mode normal.\n" +
                     "/map - Affiche la carte et tes destinations possibles.\n" + // Updated description
                     "/help - Affiche cette aide.";
    await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

commands.set('map', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player) {
    await sock.sendMessage(jid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const playerLocation = locations[player.location];
  if (!playerLocation) {
    await sock.sendMessage(jid, { text: "Erreur : lieu actuel inconnu." });
    return;
  }

  let mapText = `📍 *Tu es ici : ${playerLocation.name}*\n`;
  mapText += `_${playerLocation.description}_\n\n`;
  mapText += "🗺️ *Destinations possibles :*\n";
  playerLocation.connections.forEach(conn => {
    mapText += `- ${locations[conn].name}\n`;
  });

  await sock.sendMessage(jid, { text: mapText });
});

commands.set('action', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  await player.update({ mode: 'action' });
  await sock.sendMessage(jid, { text: "Tu es maintenant en mode action. Tes prochaines commandes seront interprétées comme des actions RP." });
});

commands.set('menu', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
    await player.update({ mode: 'normal' });
  }

  const menuText = "Bienvenue à Gheno City 2.\n\n" +
                   "Les rues sont à toi. Que veux-tu faire ?\n\n" +
                   "🎮 `/action` - Passer en mode immersif (RP).\n" +
                   "👤 `/profil` - Voir ta carte d'identité.\n" +
                   "📋 `/quests` - Consulter tes objectifs.\n" +
                   "🚗 `/garage` - Accéder à tes véhicules.\n" +
                   "❓ `/help` - Obtenir la liste complète des commandes.";

  try {
    const imageBuffer = fs.readFileSync('./menu_image.jpg');
    await sock.sendMessage(jid, {
      image: imageBuffer,
      caption: menuText
    });
  } catch (error) {
    console.error("Impossible d'envoyer l'image du menu:", error);
    // Fallback to text message if image fails
    await sock.sendMessage(jid, { text: menuText });
  }
});

commands.set('accelerate', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(jid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  if (!player.drivingVehicleId) {
    await sock.sendMessage(jid, { text: "Tu dois être au volant pour accélérer." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  if (!playerVehicle) {
    await sock.sendMessage(jid, { text: "Erreur: véhicule introuvable." });
    return;
  }

  const vehicle = playerVehicle.Vehicle;
  const engineModifier = playerVehicle.engineHealth / 100;
  let acceleration = (vehicle.acceleration * engineModifier) / vehicle.inertia;

  let responseText = "";

  if (playerVehicle.currentSpeed < WHEEL_SPIN_SPEED_THRESHOLD && acceleration > WHEEL_SPIN_ACCELERATION_THRESHOLD) {
    responseText += "Tu appuies trop fort sur l'accélérateur, les pneus patinent ! ";
    responseText += "\n[POLLINATION PROMPT: Vue arrière d'une voiture de sport, fumée s'échappant des pneus crissants sur l'asphalte, action intense, style cinématique]";
    acceleration *= 0.5; // Patinage
  }

  let newSpeed = playerVehicle.currentSpeed + acceleration;
  if (newSpeed > vehicle.topSpeed * engineModifier) {
    newSpeed = vehicle.topSpeed * engineModifier;
  }

  await playerVehicle.update({ currentSpeed: newSpeed });

  responseText += `Tu accélères... Vitesse actuelle : ${newSpeed.toFixed(0)} km/h.`;
  await sendWithImage(sock, jid, responseText);
});

commands.set('brake', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(jid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  if (!player.drivingVehicleId) {
    await sock.sendMessage(jid, { text: "Tu dois être au volant pour freiner." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  if (!playerVehicle) {
    await sock.sendMessage(jid, { text: "Erreur: véhicule introuvable." });
    return;
  }

  const vehicle = playerVehicle.Vehicle;
  const deceleration = vehicle.brakePower / vehicle.inertia;
  let newSpeed = playerVehicle.currentSpeed - deceleration;
  if (newSpeed < 0) {
    newSpeed = 0;
  }

  await playerVehicle.update({ currentSpeed: newSpeed });

  let responseText = `Tu freines... Vitesse actuelle : ${newSpeed.toFixed(0)} km/h.`;
  if (deceleration > 15) { // Seuil pour un freinage brusque
    responseText += "\n[POLLINATION PROMPT: Pneu de voiture bloqué crissant sur l'asphalte, laissant une trace de gomme noire, en gros plan, action intense, photoréalisme]";
  }
  await sendWithImage(sock, jid, responseText);
});

commands.set('garage', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const playerVehicles = await PlayerVehicle.findAll({
    where: { PlayerWhatsappId: player.whatsappId },
    include: Vehicle,
  });

  if (!playerVehicles.length) {
    await sock.sendMessage(jid, { text: "Tu n'as pas de véhicule." });
    return;
  }

  let garageText = "Ton garage:\n\n";
  playerVehicles.forEach(pv => {
    garageText += `- ID: ${pv.id} | ${pv.Vehicle.name} | Dégâts: ${pv.damage}%\n`;
  });

  await sock.sendMessage(jid, { text: garageText });
});

commands.set('drive', async (sock, message, args) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(jid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  if (player.drivingVehicleId) {
    await sock.sendMessage(jid, { text: "Tu es déjà au volant." });
    return;
  }

  const playerVehicleId = args[0];
  if (!playerVehicleId) {
    await sock.sendMessage(jid, { text: "Indique l'ID du véhicule que tu veux conduire." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findOne({
    where: { id: playerVehicleId, PlayerWhatsappId: player.whatsappId },
    include: Vehicle,
  });

  if (!playerVehicle) {
    await sock.sendMessage(jid, { text: "Ce n'est pas ton véhicule." });
    return;
  }

  await player.update({ drivingVehicleId: playerVehicle.id });
  const responseText = `Tu te glisses derrière le volant de ta ${playerVehicle.Vehicle.name}. L'odeur du cuir usé et de l'essence remplit tes narines.\n` +
                       `[POLLINATION PROMPT: Vue à la première personne depuis l'intérieur d'une voiture, mains sur le volant, regardant à travers le pare-brise une rue de la ville la nuit, reflets des néons, cinématique, réaliste]`;
  await sendWithImage(sock, jid, responseText);
});

commands.set('park', async (sock, message) => {
  const jid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(jid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  if (!player.drivingVehicleId) {
    await sock.sendMessage(jid, { text: "Tu n'es pas au volant." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  await player.update({ drivingVehicleId: null });
  await playerVehicle.update({ currentSpeed: 0 }); // Reset speed when parking

  await sock.sendMessage(jid, { text: `Tu as garé la ${playerVehicle.Vehicle.name}.` });
});

async function handleCommand(sock, message, downloadMediaMessage) {
  // Ignore messages sent by the bot itself to prevent spam loops
  if (message.key.fromMe) {
    return;
  }

  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) {
    return;
  }

  const jid = message.key.remoteJid;


  // Player registration flow
  if (registrationState.get(jid) === 'awaiting_name') {
    const playerName = messageText.trim();
    if (playerName.length > 0 && playerName.length <= 15 && !playerName.startsWith('/')) {
      const [player, created] = await Player.findOrCreate({
        where: { whatsappId: jid },
        defaults: { name: playerName },
      });

      if (created) {
        registrationState.delete(jid);
        const welcomeText = `Bienvenue à Gheno City 2, ${player.name} ! 🚗💥\n\n` +
                            "Les rues sont impitoyables, mais pleines d'opportunités. Ton voyage pour venger la mort de ton père commence maintenant. " +
                            "Pour commencer, tu dois te faire un nom dans ton quartier natal, Little Sicily. Trouve un moyen de voler une voiture pour attirer l'attention. " +
                            "Utilise la commande /quests pour voir tes objectifs.";
        await sock.sendMessage(jid, { text: welcomeText });
      } else {
        registrationState.delete(jid);
        await sock.sendMessage(jid, { text: `Content de te revoir, ${player.name}!` });
      }
    } else {
      await sock.sendMessage(jid, { text: "Nom invalide. Veuillez choisir un nom entre 1 et 15 caractères, sans commencer par '/'." });
    }
    return;
  }

  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (!player && !messageText.startsWith('/start')) {
    await sock.sendMessage(jid, { text: "Bienvenue ! Utilise /start pour commencer ton aventure à Gheno City." });
    return;
  }

  if (player && player.mode === 'action' && !messageText.startsWith('/')) {
    try {
      await handleFreeAction(sock, message, player, messageText);
      await Player.update({ lastActivity: new Date() }, { where: { whatsappId: jid } });
    } catch (error) {
      console.error('Error executing free action:', error);
      await sock.sendMessage(jid, { text: "Une erreur est survenue lors de l'interprétation de ton action." });
    }
    return;
  }

  if (!messageText.startsWith('/')) {
    return;
  }

  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = commands.get(commandName);
  if (command) {
    try {
      await command(sock, message, args);
      await Player.update({ lastActivity: new Date() }, { where: { whatsappId: jid } });
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await sock.sendMessage(jid, { text: "Une erreur est survenue lors de l'exécution de la commande." });
    }
  } else {
    await sock.sendMessage(jid, { text: "Commande inconnue. Tapez /help pour voir la liste des commandes." });
  }
}

module.exports = { handleCommand, sendWithImage };
