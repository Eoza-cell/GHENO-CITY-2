// Charger les variables d'environnement au tout début
require('dotenv').config();

// Note : La vérification pour GROQ_API_KEY a été supprimée car le bot utilise maintenant Pollination AI.

const http = require('http');
const { getContentType, jidNormalizedUser, delay, downloadMediaMessage, makeWASocket, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
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
const { startModelServer } = require('./model-server');

let isWhatsAppConnected = false;
let currentPairingCode = null;

// Crée un serveur HTTP qui bloque le déploiement tant que WA n'est pas connecté
const server = http.createServer((req, res) => {
    if (req.url === '/pairing') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`
            <html>
                <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #121b22; color: white; margin: 0; padding: 20px; box-sizing: border-box; text-align: center;">
                    <h1>🔗 GHENO-CITY : Connexion</h1>

                    ${isWhatsAppConnected ? `
                        <div style="border: 2px solid #00a884; padding: 40px; border-radius: 15px;">
                            <p style="color: #00a884; font-size: 48px; margin: 0;">✅ CONNECTÉ</p>
                            <p style="font-size: 18px; margin-top: 10px;">Le bot est en ligne et prêt à jouer.</p>
                        </div>
                    ` : currentPairingCode ? `
                        <div style="background: #1d2a33; padding: 30px; border-radius: 15px; border: 1px solid #3b4a54; max-width: 500px;">
                            <p style="font-size: 18px; margin-bottom: 20px;">Utilisez ce code sur votre téléphone :</p>
                            <div style="background: #00a884; padding: 20px; border-radius: 10px; font-size: 42px; font-weight: bold; letter-spacing: 5px; color: #121b22; margin: 20px 0;">
                                ${currentPairingCode}
                            </div>
                            <div style="text-align: left; font-size: 14px; color: #aebac1; line-height: 1.6;">
                                <p><strong>Instructions :</strong></p>
                                <ol>
                                    <li>Ouvrez WhatsApp sur votre téléphone.</li>
                                    <li>Allez dans <strong>Appareils connectés</strong>.</li>
                                    <li>Appuyez sur <strong>Connecter un appareil</strong>.</li>
                                    <li>Appuyez sur <strong>Lier avec le numéro de téléphone</strong>.</li>
                                    <li>Entrez le code affiché ci-dessus.</li>
                                </ol>
                            </div>
                        </div>
                    ` : `
                        <div style="padding: 20px;">
                            <p style="font-size: 20px;">⏳ Génération du code en cours...</p>
                            <p style="color: #aebac1;">Si rien n'apparaît après 1 minute, vérifiez le numéro de téléphone dans vos variables d'environnement.</p>
                        </div>
                    `}
                    <script>setTimeout(() => location.reload(), 10000)</script>
                </body>
            </html>
        `);
    }

    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(isWhatsAppConnected ? 'OPERATIONAL' : 'AWAITING_PAIRING');
        return;
    }

    res.writeHead(404);
    res.end();
});
const PORT = process.env.PORT || 3000;

// Start server IMMEDIATELY to satisfy Render
server.listen(PORT, () => {
    console.log(`[SYSTEM] Serveur de santé actif sur le port ${PORT}`);
});

// Initialisation de la queue pour gérer la charge
const messageQueue = new PQueue({ concurrency: 5 });

async function connectToWhatsApp() {
  // Assure que le dossier des profils existe
  if (!fs.existsSync(path.join('assets', 'profiles'))) {
      fs.mkdirSync(path.join('assets', 'profiles'), { recursive: true });
  }

  // Session Reset Logic
  if (process.env.RESET_SESSION === 'true') {
      const { Creds } = require('./database');
      console.log('⚠️ [AUTH] RESET_SESSION=true détecté. Nettoyage complet de la session...');
      try {
          await Creds.destroy({ where: {}, truncate: true });
          console.log('✅ [AUTH] Session réinitialisée avec succès.');
      } catch (e) {
          console.error('[AUTH] Erreur lors du nettoyage de la session:', e.message);
      }
  }

  const { state, saveCreds } = await useDatabaseAuth();
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Utilisation de la version Baileys v${version.join('.')} (dernière version : ${isLatest})`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    version,
    logger: pino({ level: 'debug' }), // Set to debug for troubleshooting
    getMessage: async key => {
        console.log('⚠️ Message non déchiffré, retry demandé:', key);
        return { conversation: '🔄 Réessaye d\'envoyer ton message' };
    }
  });

  // Handle pairing code logic
  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER?.replace(/[^0-9]/g, '');
    console.log(`[AUTH] État de registration : non-enregistré. Numéro cible : ${phoneNumber}`);

    if (!phoneNumber) {
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error('!!! ERREUR : Le numéro de téléphone n\'est pas configuré.   !!!');
      console.error('!!! Définissez la variable d\'environnement PHONE_NUMBER.   !!!');
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      process.exit(1);
    }

    await delay(2000); // Wait for socket to be ready

    let pairingInterval = null;
    const requestAndShowCode = async (retryCount = 0) => {
        try {
            console.log(`[AUTH] Demande du code pour : ${phoneNumber} (Tentative ${retryCount + 1})`);
            const code = await sock.requestPairingCode(phoneNumber);
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
            currentPairingCode = formattedCode;

            console.log('\n' + '*'.repeat(65));
            console.log('*   VOTRE CODE DE PAIRAGE WHATSAPP (GHENO-CITY) :');
            console.log('*');
            console.log(`*   ➡️➡️➡️   ${formattedCode}   ⬅️⬅️⬅️`);
            console.log('*');
            console.log('*   Entrez ce code dans WhatsApp > Appareils connectés');
            console.log('*'.repeat(65) + '\n');

            // Repeat in color for supported terminals
            console.log('\x1b[42m\x1b[30m' + ' '.repeat(62) + '\x1b[0m');
            console.log('\x1b[42m\x1b[30m   CODE PAIRING : ' + formattedCode + ' '.repeat(62 - 18 - formattedCode.length) + '\x1b[0m');
            console.log('\x1b[42m\x1b[30m' + ' '.repeat(62) + '\x1b[0m\n');
        } catch (err) {
            console.error('[AUTH] Échec demande code pairing:', err.message);
            if (retryCount < 3) {
                console.log('[AUTH] Nouvelle tentative dans 5s...');
                await delay(5000);
                return requestAndShowCode(retryCount + 1);
            }
        }
    };

    await requestAndShowCode();

    // Repeat the CURRENT code in console every 20 seconds to keep it visible
    const logInterval = setInterval(() => {
        if (currentPairingCode) {
            console.log(`\n[AUTH] CODE DE PAIRAGE : ${currentPairingCode} (WhatsApp > Appareils connectés)\n`);
        } else if (!isWhatsAppConnected) {
            console.warn('[AUTH] Toujours en attente de génération du code ou de connexion (60s+)...');
        }
    }, 20000);

    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            clearInterval(logInterval);
            currentPairingCode = null;
        }
    });
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      isWhatsAppConnected = false;
      const statusCode = (lastDisconnect.error)?.output?.statusCode;
      const isConflict = statusCode === 440 || lastDisconnect.error?.message?.includes('conflict');
      const isLoggedOut = statusCode === 401;

      console.log(`[CONN] Fermée. Code: ${statusCode}, Conflict: ${isConflict}, LoggedOut: ${isLoggedOut}`);

      if (isConflict) {
          console.error('!!! CONFLIT DE SESSION : Le bot est connecté ailleurs.');
          return;
      }

      const shouldReconnect = !isLoggedOut;
      if (shouldReconnect) {
        console.log('[CONN] Reconnexion dans 10s...');
        await delay(10000);
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp');
      isWhatsAppConnected = true;
      currentPairingCode = null;

      try {
          const botJid = jidNormalizedUser(sock.user.id);
          sock.sendMessage(botJid, { text: "🚀 *SYSTÈME OPÉRATIONNEL* - Gheno-City est en ligne." });
      } catch (e) {}

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
  .then(async () => {
    console.log('[CORE] Base de données prête. Lancement du bot...');

    // Démarre le 2ème serveur pour le modèle DARK LUST
    startModelServer();

    connectToWhatsApp();
  })
  .catch(err => {
    console.error('[CRITICAL] Échec du démarrage de la base de données:', err);
    process.exit(1);
  });
