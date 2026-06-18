const fs = require('fs');
const { Player } = require('./database');

async function handleRegistration(sock, message, player) {
  const remoteJid = message.key.remoteJid;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;

  if (player.registrationStep === 0) {
    // Welcome message already sent by /start?
    // No, let's make it robust.
    await player.update({ registrationStep: 1 });
    await sock.sendMessage(remoteJid, {
      image: fs.readFileSync('./assets/welcome.jpg'),
      caption: "Bonjour appel moi Akuma...Bienvenue à Gaïa quel est ton nom ?...."
    });
    return true;
  }

  if (player.registrationStep === 1) {
    if (!messageText) return true;
    const characterName = messageText.trim();
    await player.update({ characterName, registrationStep: 2 });

    await sock.sendMessage(remoteJid, {
      image: fs.readFileSync('./assets/skill_intro.jpg'),
      caption: `Super ${characterName}!...maintenant tu vas créer ta première compétence de base...\n\n⚠️ Attention à bien réfléchir car elle déterminera le reste des compétences à venir... ne t'inquiète pas quelle que soit sa puissance elle sera remise à une échelle normale...`
    });
    return true;
  }

  if (player.registrationStep === 2) {
    if (!messageText) return true;
    const skill = messageText.trim();
    await player.update({ skill, registrationStep: 3 });

    await sock.sendMessage(remoteJid, {
      text: `Génial ! Ta compétence "${skill}" a été enregistrée. Ton inscription est terminée. Bienvenue dans Throne of Epsylion !`
    });
    return true;
  }

  return false; // Not in registration or finished
}

module.exports = { handleRegistration };
