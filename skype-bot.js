// Charger les variables d'environnement au tout début
require('dotenv').config();

// Note : La vérification pour GROQ_API_KEY a été supprimée car le bot utilise maintenant Pollination AI.

const http = require('http');
const { getMessageContentType, jidNormalizedUser, delay, downloadMediaMessage, makeWASocket } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { setupDatabase, Player } = require('./database');
const { useDatabaseAuth } = require('./database-auth');
const { handleCommand, getJid } = require('./command-handler');
const { startTutorial } = require('./tutorial-handler');
const { startInactivePlayerCheck } = require('./inactive-handler');
const { startDayNightCycle } = require('./game-state');

// Crée un serveur HTTP minimaliste pour répondre aux contrôles de santé de Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running');
});
const PORT = process.env.PORT || 3000;
let serverStarted = false;

async function connectToWhatsApp() {
  await setupDatabase();

  const { state, saveCreds } = await useDatabaseAuth();

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // QR code is no longer needed
    browser: ['Ubuntu', 'Chrome', '128.0.6613.86'],
    version: [2, 3000, 1027934701],
    logger: pino({ level: 'silent' }), // Suppress verbose logging
    getMessage: async key => {
        console.log('⚠️ Message non déchiffré, retry demandé:', key);
        return { conversation: '🔄 Réessaye d\'envoyer ton message' };
    }
  });

  // Handle pairing code logic
  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER;
    if (!phoneNumber) {
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error('!!! ERREUR : Le numéro de téléphone n\'est pas configuré.   !!!');
      console.error('!!! Définissez la variable d\'environnement PHONE_NUMBER.   !!!');
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      process.exit(1);
    }

    await delay(1500); // Small delay to ensure the socket is ready
    console.log(`Tentative de connexion avec le numéro de téléphone : ${phoneNumber}`);
    console.log('Demande du code de pairage...');
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('==============================================================');
      console.log('Votre code de pairage Skype :');
      console.log(`➡️➡️➡️   ${code?.match(/.{1,4}/g)?.join('-') || code}   ⬅️⬅️⬅️`);
      console.log('==============================================================');
      console.log('Ouvrez WhatsApp sur votre téléphone, allez dans "Appareils connectés" > "Connecter un appareil" et entrez ce code.');
    } catch (error) {
      console.error('Impossible de demander le code de pairage :', error);
      process.exit(1);
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== 401;
      console.log('Connection fermée à cause de :', lastDisconnect.error, ', reconnexion:', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp');
      startInactivePlayerCheck(sock);
      startDayNightCycle();

      // Démarre le serveur HTTP uniquement si ce n'est pas déjà fait
      if (!serverStarted) {
          server.listen(PORT, () => {
              console.log(`Server listening on port ${PORT} for Render health checks.`);
              serverStarted = true;
          });
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    for (const message of m.messages) {
        if (!message.message) continue;

        const jid = getJid(message);
        const player = await Player.findOne({ where: { whatsappId: jid } });

        // Handle profile picture submission
        if (player && player.awaitingProfilePic) {
            const type = getMessageContentType(message.message);
            if (type === 'imageMessage') {
                try {
                    console.log(`[PIC] Téléchargement de la photo de profil pour ${player.name}...`);
                    const buffer = await downloadMediaMessage(message, 'buffer', {}, { logger: pino({ level: 'silent' }) });
                    const filename = `${jid.split('@')[0]}.jpg`;
                    const filepath = path.join('assets', 'profiles', filename);

                    fs.writeFileSync(filepath, buffer);

                    await player.update({
                        profilePicUrl: filepath,
                        awaitingProfilePic: false
                    });

                    console.log(`[PIC] Photo de profil enregistrée : ${filepath}`);
                    await sock.sendMessage(message.key.remoteJid, { text: `Photo de profil enregistrée ! Bienvenue officiellement dans Skype.` });

                    // Trigger tutorial after profile pic
                    await startTutorial(sock, message.key.remoteJid, player);
                    continue; // Stop further processing for this message
                } catch (error) {
                    console.error('Erreur lors de l\'enregistrement de la photo de profil:', error);
                    await sock.sendMessage(message.key.remoteJid, { text: 'Une erreur est survenue lors de l\'enregistrement de votre image. Veuillez réessayer.' });
                    continue;
                }
            } else {
                 await sock.sendMessage(message.key.remoteJid, { text: 'Veuillez envoyer une image pour votre profil.' });
                 continue;
            }
        }

        // If not a profile pic submission, handle as a normal command/message
        handleCommand(sock, message, downloadMediaMessage);
    }
  });
}

connectToWhatsApp();
