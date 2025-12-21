const { Player, Item, PlayerItem } = require('./database');

const commands = new Map();

// The /start command
commands.set('start', async (sock, message) => {
  const [player, created] = await Player.findOrCreate({
    where: { whatsappId: message.key.remoteJid },
  });

  let text;
  if (created) {
    text = `*Bienvenue dans Sword Art Online, joueur.*\n\n` +
           `Dans ce monde, la seule chose qui compte est votre détermination. Vous êtes piégé ici, et la seule façon de vous échapper est de conquérir les 100 étages de l'Aincrad. Mais attention... si vous mourez dans le jeu, vous mourez dans la vraie vie.\n\n` +
           `Je suis le Game Master, votre guide dans ce monde. Je ne peux pas vous aider directement, mais je peux vous donner des conseils. Pour commencer, je vous suggère de vous entraîner sur des créatures de bas niveau pour monter en niveau et gagner de l'équipement.\n\n` +
           `Votre première quête : survivre. Prouvez-moi que vous avez ce qu'il faut pour survivre dans ce monde en chassant un sanglier. Utilisez la commande /tutoriel pour commencer.\n\n` +
           `Bonne chance, joueur. Vous en aurez besoin.`;
  } else {
    text = `Content de te revoir, ${player.name} ! L'Aincrad t'attendait. Utilise /quests pour continuer ta progression.`;
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
                        "Récompense : 100 Col et 50 XP.\n\n" +
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
                      `💰 Col: ${player.money}$`;
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
                     "/start - Commence ou reprends ton aventure dans l'Aincrad.\n" +
                     "/quests - Affiche tes quêtes actuelles.\n" +
                     "/profile - Affiche ton profil de joueur.\n" +
                     "/stats - Affiche tes statistiques de combat.\n" +
                     "/tutoriel - Lance le tutoriel pour apprendre les bases.\n" +
                     "/shop - Affiche les articles disponibles dans la boutique.\n" +
                     "/buy [article] - Achète un article de la boutique.\n" +
                     "/inventory - Affiche ton inventaire.\n" +
                     "/action - Passe en mode action pour interagir avec le monde.\n" +
                     "/menu - Retourne au menu principal.\n" +
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

commands.set('donjon', async (sock, message) => {
  const player = await Player.findOne({ where: { whatsappId: message.key.remoteJid } });
  if (!player) {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (player.mode !== 'action') {
    await sock.sendMessage(message.key.remoteJid, { text: "Cette commande ne peut être utilisée qu'en mode /action." });
    return;
  }

  if (player.chapter === 1 && player.quest === 2) {
    // Simulate a boss fight
    const playerPower = player.strength + player.defense + player.agility + player.intelligence;
    const bossPower = 50; // Adjust as needed

    if (playerPower >= bossPower) {
      await player.update({ chapter: 2, quest: 1, money: player.money + 500, xp: player.xp + 200 });
      const successText = "Après un combat acharné, tu as vaincu Illfang the Kobold Lord, le boss du premier étage ! Tu as gagné de l'expérience et une belle récompense.\n\n" +
                          "Récompense : 500 Col et 200 XP.\n\n" +
                          "La voie vers le deuxième étage est maintenant ouverte. Continue ton ascension, joueur.\n" +
                          "[POLLINATION PROMPT: un guerrier de style anime se tenant victorieux au-dessus d'un grand monstre kobold vaincu dans une salle du trône de donjon, avec des trésors qui brillent en arrière-plan]";
      await sock.sendMessage(message.key.remoteJid, { text: successText });
    } else {
      await player.update({ health: player.health - 50 });
      const failureText = "Illfang the Kobold Lord est trop fort pour toi. Tu as été gravement blessé et a dû battre en retraite en utilisant un cristal de téléportation.\n\n" +
                          "Tu as perdu 50 points de vie. Entraîne-toi et reviens plus fort.";
      await sock.sendMessage(message.key.remoteJid, { text: failureText });
    }
  } else {
    await sock.sendMessage(message.key.remoteJid, { text: "Tu ne peux pas faire ça maintenant." });
  }
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
    shopText += `- ${item.name} | ${item.price} Col\n`;
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
