const fs = require('fs');
const { Player } = require('./database');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function handleRegistration(sock, message, player) {
  const remoteJid = message.key.remoteJid;
  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  const hasImage = !!(message.message.imageMessage);

  // Step 0: User just started, show Image 1 (Asking for name)
  if (player.registrationStep === 0) {
    await player.update({ registrationStep: 1 });
    await sock.sendMessage(remoteJid, {
      image: fs.readFileSync('./assets/step1_name.jpg')
    });
    return true;
  }

  // Step 1: User provides name, show Image 2 (Asking for photo)
  if (player.registrationStep === 1) {
    if (!messageText) return true;
    const characterName = messageText.trim();
    await player.update({ characterName, registrationStep: 2 });

    await sock.sendMessage(remoteJid, {
      image: fs.readFileSync('./assets/step2_photo.jpg')
    });
    return true;
  }

  // Step 2: User provides photo, show Image 3 (Asking for skill)
  if (player.registrationStep === 2) {
    if (!hasImage && !messageText) return true; // Wait for something

    let profileImageUrl = player.profileImageUrl;
    if (hasImage) {
        try {
            // In a real production environment, we would upload this to S3/Cloudinary
            // For now, we'll mark it as received in the database
            profileImageUrl = "RECU_MOBILE_UPLOAD";
            console.log(`[PHOTO] Image reçue pour le joueur ${player.whatsappId}`);
        } catch (e) {
            console.error("Erreur lors de la capture de l'image:", e);
        }
    }

    await player.update({
        registrationStep: 3,
        profileImageUrl: profileImageUrl
    });

    await sock.sendMessage(remoteJid, {
      image: fs.readFileSync('./assets/step3_skill.jpg')
    });
    return true;
  }

  // Step 3: User provides skill, show Image 4 (Asking for quote)
  if (player.registrationStep === 3) {
    if (!messageText) return true;
    const skill = messageText.trim();
    await player.update({ skill, registrationStep: 4 });

    await sock.sendMessage(remoteJid, {
      image: fs.readFileSync('./assets/step4_quote.jpg')
    });
    return true;
  }

  // Step 4: User provides quote, finish registration
  if (player.registrationStep === 4) {
    if (!messageText) return true;
    const quote = messageText.trim();
    await player.update({ quote, registrationStep: 5 });

    await sock.sendMessage(remoteJid, {
      text: "✅ *Fiche enregistrée avec succès !*\n\n⏳ Ta fiche sera prête dans **24h**. Tu recevras une notification dès qu'elle sera validée par Akuma.\n\n_Merci de ta patience, Héritier._"
    });
    return true;
  }

  return false;
}

module.exports = { handleRegistration };
