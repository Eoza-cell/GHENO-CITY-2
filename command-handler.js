const { Player, Vehicle, PlayerVehicle } = require('./database');
const { isDay } = require('./gheno-city');
const { handleFreeAction } = require('./ai-handler');

const commands = new Map();

const WHEEL_SPIN_SPEED_THRESHOLD = 20;
const WHEEL_SPIN_ACCELERATION_THRESHOLD = 10;

// The /start command
commands.set('start', async (sock, message) => {
  const [player, created] = await Player.findOrCreate({
    where: { whatsappId: message.key.remoteJid },
  });

  let text;
  if (created) {
    text = `Bienvenue à Gheno City 2, ${player.name} ! 🚗💥\n\n` +
           "Les rues sont impitoyables, mais pleines d'opportunités. Ton voyage pour venger la mort de ton père commence maintenant. " +
           "Pour commencer, tu dois te faire un nom dans ton quartier natal, Little Sicily. Trouve un moyen de voler une voiture pour attirer l'attention. " +
           "Utilise la commande /quests pour voir tes objectifs.";
  } else {
    text = `Content de te revoir, ${player.name} ! Les rues de Gheno City t'attendaient. Utilise /quests pour continuer ta progression.`;
  }

  await sock.sendMessage(message.key.remoteJid, { text });
});

// The /quests command
commands.set('quests', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
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

  await sock.sendMessage(message.key.remoteJid, { text: questText });
});

// The /stealcar command
commands.set('stealcar', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }

  if (player.chapter === 1 && player.quest === 1) {
    await player.update({ quest: 2, money: player.money + 500, xp: player.xp + 100 });
    const successText = "Avec des mains tremblantes mais déterminées, tu parviens à forcer la serrure et à faire démarrer le moteur. La voiture rugit à la vie, une bête de métal prête à t'obéir. Tu as réussi.\n\n" +
                        "Récompense : 500$ et 100 XP.\n\n" +
                        "La nouvelle s'est répandue dans Little Sicily. Le caïd local a entendu parler de toi et veut te voir.\n" +
                        "[POLLINATION PROMPT: Scène de rue nocturne, un gangster fait démarrer une voiture volée, phares allumés, tension palpable, style cinématique, hyperréalisme]";
    await sock.sendMessage(message.key.remoteJid, { text: successText });
  } else {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu ne peux pas faire ça maintenant." });
  }
});

// The /profile command
commands.set('profile', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const profileText = `Profil de Gangster:\n\n` +
                      `👤 Nom: ${player.name}\n` +
                      `📈 Niveau: ${player.level}\n` +
                      `✨ XP: ${player.xp}\n` +
                      `💰 Argent: ${player.money}$`;
  await sock.sendMessage(message.key.remoteJid, { text: profileText });
});

// The /grab command
commands.set('grab', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }

  if (player.hasMoneyBag) {
    const amount = Math.floor(Math.random() * 500) + 250;
    await player.update({ money: player.money + amount, hasMoneyBag: false });
    await sock.sendMessage(message.key.remoteJid, { text: `Tu as ramassé le sac et trouvé ${amount}$ !` });
  } else {
    await sock.sendMessage(message.key.remoteJid, { text: "Il n'y a rien à ramasser." });
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
                     "/help - Affiche cette aide.";
    await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

commands.set('action', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  await player.update({ mode: 'action' });
  await sock.sendMessage(message.key.remoteJid, { text: "Tu es maintenant en mode action. Tes prochaines commandes seront interprétées comme des actions RP." });
});

commands.set('menu', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  await player.update({ mode: 'normal' });
  await sock.sendMessage(message.key.remoteJid, { text: "Tu es de retour en mode normal." });
});

commands.set('accelerate', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  if (!player.drivingVehicleId) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois être au volant pour accélérer." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  if (!playerVehicle) {
    await sock.sendMessage(message.key.remoteJid, { text: "Erreur: véhicule introuvable." });
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
  await sock.sendMessage(message.key.remoteJid, { text: responseText });
});

commands.set('brake', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  if (!player.drivingVehicleId) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois être au volant pour freiner." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  if (!playerVehicle) {
    await sock.sendMessage(message.key.remoteJid, { text: "Erreur: véhicule introuvable." });
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
  await sock.sendMessage(message.key.remoteJid, { text: responseText });
});

commands.set('garage', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  const playerVehicles = await PlayerVehicle.findAll({
    where: { PlayerWhatsappId: player.whatsappId },
    include: Vehicle,
  });

  if (!playerVehicles.length) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu n'as pas de véhicule." });
    return;
  }

  let garageText = "Ton garage:\n\n";
  playerVehicles.forEach(pv => {
    garageText += `- ID: ${pv.id} | ${pv.Vehicle.name} | Dégâts: ${pv.damage}%\n`;
  });

  await sock.sendMessage(message.key.remoteJid, { text: garageText });
});

commands.set('drive', async (sock, message, args) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  if (player.drivingVehicleId) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu es déjà au volant." });
    return;
  }

  const playerVehicleId = args[0];
  if (!playerVehicleId) {
    await sock.sendMessage(message.key.remoteJid, { text: "Indique l'ID du véhicule que tu veux conduire." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findOne({
    where: { id: playerVehicleId, PlayerWhatsappId: player.whatsappId },
    include: Vehicle,
  });

  if (!playerVehicle) {
    await sock.sendMessage(message.key.remoteJid, { text: "Ce n'est pas ton véhicule." });
    return;
  }

  await player.update({ drivingVehicleId: playerVehicle.id });
  const responseText = `Tu te glisses derrière le volant de ta ${playerVehicle.Vehicle.name}. L'odeur du cuir usé et de l'essence remplit tes narines.\n` +
                       `[POLLINATION PROMPT: Vue à la première personne depuis l'intérieur d'une voiture, mains sur le volant, regardant à travers le pare-brise une rue de la ville la nuit, reflets des néons, cinématique, réaliste]`;
  await sock.sendMessage(message.key.remoteJid, { text: responseText });
});

commands.set('park', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }
  if (!player.drivingVehicleId) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu n'es pas au volant." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  await player.update({ drivingVehicleId: null });
  await playerVehicle.update({ currentSpeed: 0 }); // Reset speed when parking

  await sock.sendMessage(message.key.remoteJid, { text: `Tu as garé la ${playerVehicle.Vehicle.name}.` });
});



async function handleCommand(sock, message) {
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) {
    return;
  }

  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player && !messageText.startsWith('/start')) {
     await sock.sendMessage(message.key.remoteJid, { text: "Bienvenue ! Utilise /start pour commencer ton aventure à Gheno City." });
     return;
  }

  // Si le joueur est en mode action et que le message n'est pas une commande, on le traite comme une action libre.
  if (player && player.mode === 'action' && !messageText.startsWith('/')) {
    try {
      await handleFreeAction(sock, message, player, messageText);
      await Player.update({ lastActivity: new Date() }, { where: { whatsappId: message.key.remoteJid } });
    } catch (error) {
      console.error('Error executing free action:', error);
      await sock.sendMessage(message.key.remoteJid, { text: "Une erreur est survenue lors de l'interprétation de ton action." });
    }
    return; // On arrête le traitement ici pour ne pas chercher de commande.
  }

  // Logique pour les commandes qui commencent par /
  if (!messageText.startsWith('/')) {
    return; // Ignore les messages normaux si pas en mode action
  }

  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = commands.get(commandName);
  if (command) {
    try {
      await command(sock, message, args);
      // Update last activity timestamp
      await Player.update({ lastActivity: new Date() }, { where: { whatsappId: message.key.remoteJid } });
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await sock.sendMessage(message.key.remoteJid, { text: "Une erreur est survenue lors de l'exécution de la commande." });
    }
  } else {
    await sock.sendMessage(message.key.remoteJid, { text: "Commande inconnue. Tapez /help pour voir la liste des commandes." });
  }
}

module.exports = { handleCommand };
