const { Player, Vehicle, PlayerVehicle } = require('./database');

const commands = new Map();

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

  if (player.chapter === 1 && player.quest === 1) {
    await player.update({ quest: 2, money: player.money + 500, xp: player.xp + 100 });
    const successText = "Tu as réussi à voler une voiture ! Tu as gagné 500$ et 100 XP.\n\n" +
                        "La nouvelle s'est répandue dans Little Sicily. Le caïd local, a entendu parler de toi et veut te voir. " +
                        "Utilise /quests pour voir ton prochain objectif.";
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
                     "/goto [lieu] - Te déplace vers un lieu.\n" +
                     "/shop - Affiche les articles d'une boutique.\n" +
                     "/buy [article] - Achète un article.\n" +
                     "/garage - Affiche tes véhicules.\n" +
                     "/drive [id] - Monte dans un véhicule.\n" +
                     "/park - Descends du véhicule.\n" +
                     "/accelerate - Accélère.\n" +
                     "/help - Affiche cette aide.";
    await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

commands.set('accelerate', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player.drivingVehicleId) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois être au volant pour accélérer." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  if (!playerVehicle) {
    // This should not happen if the database is consistent
    await sock.sendMessage(message.key.remoteJid, { text: "Erreur: véhicule introuvable." });
    return;
  }

  const vehicle = playerVehicle.Vehicle;
  let newSpeed = playerVehicle.currentSpeed + vehicle.acceleration;
  if (newSpeed > vehicle.topSpeed) {
    newSpeed = vehicle.topSpeed;
  }

  await playerVehicle.update({ currentSpeed: newSpeed });

  await sock.sendMessage(message.key.remoteJid, { text: `Tu accélères... Vitesse actuelle : ${newSpeed.toFixed(0)} km/h.` });
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
  await sock.sendMessage(message.key.remoteJid, { text: `Tu es maintenant au volant de ta ${playerVehicle.Vehicle.name}.` });
});

commands.set('park', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player.drivingVehicleId) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu n'es pas au volant." });
    return;
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  await player.update({ drivingVehicleId: null });
  await playerVehicle.update({ currentSpeed: 0 }); // Reset speed when parking

  await sock.sendMessage(message.key.remoteJid, { text: `Tu as garé la ${playerVehicle.Vehicle.name}.` });
});

// Location data
const locations = {
  'Little Sicily': {
    description: "Ton quartier natal. Un peu miteux, mais c'est chez toi.",
    connections: ['dealership'],
  },
  'dealership': {
    description: "Une concession de voitures d'occasion. L'odeur de l'essence et des rêves brisés flotte dans l'air.",
    connections: ['Little Sicily'],
  },
};

// Command to move between locations
commands.set('goto', async (sock, message, args) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const destination = args[0];
  if (!destination || !locations[destination]) {
    await sock.sendMessage(message.key.remoteJid, { text: "Destination inconnue." });
    return;
  }

  const currentConnections = locations[player.location]?.connections;
  if (!currentConnections || !currentConnections.includes(destination)) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu ne peux pas y aller depuis ta position actuelle." });
    return;
  }

  await player.update({ location: destination });
  await sock.sendMessage(message.key.remoteJid, { text: `Tu es maintenant à ${destination}.\n\n${locations[destination].description}` });
});

// Command to view items in a shop
commands.set('shop', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (player.location !== 'dealership') {
    await sock.sendMessage(message.key.remoteJid, { text: "Il n'y a pas de boutique ici." });
    return;
  }

  const vehicles = await Vehicle.findAll();
  let shopText = "Véhicules à vendre:\n\n";
  vehicles.forEach(v => {
    shopText += `- ${v.name} | ${v.price}$\n`;
  });
  shopText += "\nUtilise /buy [nom] pour acheter.";

  await sock.sendMessage(message.key.remoteJid, { text: shopText });
});

// Command to buy an item
commands.set('buy', async (sock, message, args) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (player.location !== 'dealership') {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois être chez le concessionnaire pour acheter une voiture." });
    return;
  }

  const vehicleName = args.join(' ');
  const vehicle = await Vehicle.findOne({ where: { name: vehicleName } });

  if (!vehicle) {
    await sock.sendMessage(message.key.remoteJid, { text: "Ce véhicule n'est pas à vendre." });
    return;
  }

  if (player.money < vehicle.price) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu n'as pas assez d'argent." });
    return;
  }

  await player.update({ money: player.money - vehicle.price });
  await PlayerVehicle.create({
    PlayerWhatsappId: player.whatsappId,
    VehicleId: vehicle.id,
  });

  await sock.sendMessage(message.key.remoteJid, { text: `Félicitations ! Tu as acheté une ${vehicle.name}.` });
});

async function handleCommand(sock, message) {
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText || !messageText.startsWith('/')) {
    return;
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
