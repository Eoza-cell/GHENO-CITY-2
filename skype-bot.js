// Charger les variables d'environnement au tout début
require('dotenv').config();

// Note : La vérification pour GROQ_API_KEY a été supprimée car le bot utilise maintenant Pollination AI.

const http = require('http');
const { getContentType, jidNormalizedUser, delay, downloadMediaMessage, makeWASocket, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { default: PQueue } = require('p-queue');
const { Sequelize } = require('sequelize');
const { setupDatabase, Player } = require('./database');
const { useDatabaseAuth } = require('./database-auth');
const { handleCommand, getJid } = require('./command-handler');
const { startTutorial } = require('./tutorial-handler');
const { startDayNightCycle } = require('./game-state');

// Crée un serveur HTTP minimaliste pour répondre aux contrôles de santé de Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[CORE] Server listening on port ${PORT} for Render health checks.`);
});

// Initialisation de la queue pour gérer la charge
const messageQueue = new PQueue({ concurrency: 5 });

async function connectToWhatsApp() {
  // Check for manual session reset via ENV
  if (process.env.RESET_SESSION === 'true') {
      console.log('[CONN] RESET_SESSION=true détecté. Nettoyage de la base de données auth...');
      const { Creds } = require('./database');
      await Creds.destroy({ where: {} });
      console.log('[CONN] Session réinitialisée. Pour éviter un nouveau reset, retirez la variable RESET_SESSION.');
  }

  // Assure que le dossier des profils existe
  if (!fs.existsSync(path.join('assets', 'profiles'))) {
      fs.mkdirSync(path.join('assets', 'profiles'), { recursive: true });
  }

  const { state, saveCreds } = await useDatabaseAuth();
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Utilisation de la version Baileys v${version.join('.')} (dernière version : ${isLatest})`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // Pairing code is used instead
    browser: ['Mac OS', 'Safari', '10.15.7'], // More standard browser for stability
    version,
    logger: pino({ level: 'error' }), // Only show errors to reduce noise but keep critical info
    getMessage: async key => {
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

    await delay(5000); // Wait longer for the socket to stabilize
    console.log(`[CONN] Tentative de connexion avec : ${phoneNumber}`);

    let pairingSuccess = false;
    let attempts = 0;
    while (!pairingSuccess && attempts < 3) {
        attempts++;
        try {
            console.log(`[CONN] Demande du code de pairage (Essai ${attempts}/3)...`);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log('==============================================================');
            console.log('Votre code de pairage Skype :');
            console.log(`➡️➡️➡️   ${code?.match(/.{1,4}/g)?.join('-') || code}   ⬅️⬅️⬅️`);
            console.log('==============================================================');
            console.log('Ouvrez WhatsApp sur votre téléphone, allez dans "Appareils connectés" > "Connecter un appareil" et entrez ce code.');
            pairingSuccess = true;
        } catch (error) {
            console.error(`[CONN] Échec demande code (Essai ${attempts}):`, error.message);
            if (attempts < 3) await delay(10000); // Wait 10s before retry
            else {
                console.error('[CONN] Impossible de générer un code de pairage après 3 essais.');
                process.exit(1);
            }
        }
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = (lastDisconnect.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== 401;

      console.log(`[CONN] Connection fermée (Code: ${statusCode}). Reconnexion: ${shouldReconnect}`);

      if (statusCode === 401) {
          console.error('[CONN] Session expirée ou déconnectée. Réinitialisation des identifiants...');
          const { Creds } = require('./database');
          await Creds.destroy({ where: {} });
          console.log('[CONN] Cache de session vidé. Redémarrage pour nouveau pairage...');
          process.exit(1); // Exit and let the process manager restart it
      }

      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('[CONN] Connecté à WhatsApp avec succès !');
      startDayNightCycle();
    }
  });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    console.log('[AUTH] Session synchronisée avec la base de données.');
  });

  sock.ev.on('messages.upsert', async (m) => {
    for (const message of m.messages) {
        messageQueue.add(async () => {
            try {
                if (!message.message) return;

                const jid = getJid(message);
                if (!jid) return;

                const player = await Player.findOne({ where: { whatsappId: jid } });

                // Handle profile picture submission
                if (player && player.awaitingProfilePic) {
                    const type = getContentType(message.message);
                    if (type === 'imageMessage') {
                        try {
                            console.log(`[PIC] Téléchargement de la photo de profil pour ${player.name}...`);
                            const buffer = await downloadMediaMessage(message, 'buffer', {}, { logger: pino({ level: 'silent' }) });

                            const idPart = jid.includes('@') ? jid.split('@')[0] : jid;
                            const filename = `${idPart}.jpg`;
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
                            return;
                        } catch (error) {
                            console.error('Erreur lors de l\'enregistrement de la photo de profil:', error);
                            await sock.sendMessage(message.key.remoteJid, { text: 'Une erreur est survenue lors de l\'enregistrement de votre image. Veuillez réessayer.' });
                            return;
                        }
                    } else {
                         // Only warn if it's not a command
                         const text = message.message.conversation || message.message.extendedTextMessage?.text;
                         if (!text || !text.startsWith('/')) {
                             await sock.sendMessage(message.key.remoteJid, { text: 'Veuillez envoyer une image pour votre profil.' });
                             return;
                         }
                    }
                }

                // If not a profile pic submission, handle as a normal command/message
                await handleCommand(sock, message, downloadMediaMessage);
            } catch (globalError) {
                console.error('[CRITICAL] Erreur lors du traitement d\'un message upsert:', globalError);
            }
        });
    }
  });
}

setupDatabase()
  .then(() => {
    console.log('[CORE] Base de données prête. Lancement du bot...');
    connectToWhatsApp();
  })
  .catch(err => {
    console.error('[CRITICAL] Échec du démarrage de la base de données:', err);
    process.exit(1);
  });
