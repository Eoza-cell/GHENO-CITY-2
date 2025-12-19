const { Player, Item, PlayerItem } = require('./database');

const commands = new Map();

// The /start command
commands.set('start', async (sock, message) => {
  const [player, created] = await Player.findOrCreate({
    where: { whatsappId: message.key.remoteJid },
  });

  let text;
  if (created) {
    text = `*Soyez les bienvenus dans Skype chers joueurs, gameurs et bêta testeurs....pour votre plus grand plaisir*\n\n` +
           `*Hélas un malheur guette nos cieux. Des portails se crée dans l'univers de Solo Leveling et apparaissent dans les mondes virtuels. La matrice de Skype est alors bourrée de failles actuellement.*\n\n` +
           `*Le temps de réparer ce dommage collatéral, votre mission sera de conquérir les donjons , éliminer les boss tous plus impitoyables les uns que les autres , canaliser votre esprit...vous vous ferez des alliés mais aussi des énémis... mais n'oubliez surtout pas que mourir dans le jeu est un game over dans le real world...*\n\n` +
           `                   *...3_2_1...*\n\n` +
           `                    *START!!*`;
  } else {
    text = `Content de te revoir, ${player.name} ! Le monde de Skype t'attendait. Utilise /quests pour continuer ta progression.`;
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
    questText += "Chapitre 1: Le Commencement\n" +
                 "Objectif: Apprends les bases du combat en chassant un sanglier.\n" +
                 "Commande: /tutoriel";
  } else if (player.chapter === 1 && player.quest === 2) {
    questText += "Chapitre 1: Le Commencement\n" +
                 "Objectif: Entre dans le premier donjon et bats le boss.\n" +
                 "Commande: /donjon";
  } else {
    questText += "Tu n'as pas de quête active pour le moment.";
  }

  await sock.sendMessage(message.key.remoteJid, { text: questText });
});


commands.set('tutoriel', async (sock, message) => {
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
    await player.update({ quest: 2, money: player.money + 100, xp: player.xp + 50 });
    const successText = "Tu as chassé un sanglier et gagné de l'expérience.\n\n" +
                        "Récompense : 100$ et 50 XP.\n\n" +
                        "Tu es maintenant prêt à affronter les dangers de ce monde.\n" +
                        "[POLLINATION PROMPT: un personnage de jeu vidéo dans une forêt, debout au-dessus d'un sanglier vaincu, tenant une épée, avec des particules de lumière qui flottent autour, style anime fantastique]";
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

  const profileText = `Profil de Joueur:\n\n` +
                      `👤 Nom: ${player.name}\n` +
                      `📈 Niveau: ${player.level}\n` +
                      `✨ XP: ${player.xp}\n` +
                      `💰 Argent: ${player.money}$`;
  await sock.sendMessage(message.key.remoteJid, { text: profileText });
});

// The /stats command
commands.set('stats', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const statsText = `Statistiques de ${player.name}:\n\n` +
                      `❤️ Santé: ${player.health}\n` +
                      `💪 Force: ${player.strength}\n` +
                      `🛡️ Défense: ${player.defense}\n` +
                      `🏃 Agilité: ${player.agility}\n` +
                      `🧠 Intelligence: ${player.intelligence}`;
  await sock.sendMessage(message.key.remoteJid, { text: statsText });
});

// The /help command
commands.set('help', async (sock, message) => {
    const helpText = "Voici les commandes disponibles :\n" +
                     "/start - Commence ou reprends ton aventure.\n" +
                     "/quests - Affiche tes quêtes actuelles.\n" +
                     "/profile - Affiche ton profil de joueur.\n" +
                     "/stats - Affiche tes statistiques.\n" +
                     "/tutoriel - Lance le tutoriel.\n" +
                     "/shop - Affiche les articles d'une boutique.\n" +
                     "/buy [article] - Achète un article.\n" +
                     "/inventory - Affiche ton inventaire.\n" +
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

commands.set('inventory', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const playerItems = await PlayerItem.findAll({
    where: { PlayerWhatsappId: player.whatsappId },
    include: Item,
  });

  if (!playerItems.length) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu n'as pas d'objet dans ton inventaire." });
    return;
  }

  let inventoryText = "Ton inventaire:\n\n";
  playerItems.forEach(playerItem => {
    inventoryText += `- ${playerItem.Item.name}\n`;
  });

  await sock.sendMessage(message.key.remoteJid, { text: inventoryText });
});


// Command to view items in a shop
commands.set('shop', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }

  const items = await Item.findAll();
  let shopText = "Articles à vendre:\n\n";
  items.forEach(item => {
    shopText += `- ${item.name} | ${item.price}$\n`;
  });
  shopText += "\nUtilise /buy [nom] pour acheter.";

  await sock.sendMessage(message.key.remoteJid, { text: shopText });
});

// Command to buy an item
commands.set('buy', async (sock, message, args) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }

  const itemName = args.join(' ');
  const item = await Item.findOne({ where: { name: itemName } });

  if (!item) {
    await sock.sendMessage(message.key.remoteJid, { text: "Cet article n'est pas à vendre." });
    return;
  }

  if (player.money < item.price) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu n'as pas assez d'argent." });
    return;
  }

  await player.update({ money: player.money - item.price });
  await PlayerItem.create({
    PlayerWhatsappId: player.whatsappId,
    ItemId: item.id,
  });

  await sock.sendMessage(message.key.remoteJid, { text: `Tu as acheté un(e) ${item.name}.` });
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
