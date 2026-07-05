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

let currentPairingCode = null;

// Crée un serveur HTTP pour répondre aux contrôles de santé de Render et afficher le code de pairage
const server = http.createServer((req, res) => {
    if (req.url === '/pairing') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (currentPairingCode) {
            const formattedCode = currentPairingCode.match(/.{1,4}/g).join('-');
            res.end(`
                <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>🔗 Code de pairage WhatsApp</h1>
                    <p style="font-size: 24px; font-weight: bold; background: #f0f0f0; padding: 20px; display: inline-block; border-radius: 10px; letter-spacing: 2px;">
                        ${formattedCode}
                    </p>
                    <p>Entrez ce code sur votre téléphone dans <b>Appareils connectés > Connecter un appareil</b>.</p>
                    <p style="color: gray; font-size: 12px;">Dernière mise à jour : ${new Date().toLocaleTimeString()}</p>
                    <script>setTimeout(() => location.reload(), 30000);</script>
                </div>
            `);
        } else {
            res.end(`
                <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>⏳ En attente du code...</h1>
                    <p>Le bot génère un code. Veuillez rafraîchir cette page dans quelques secondes.</p>
                    <script>setTimeout(() => location.reload(), 5000);</script>
                </div>
            `);
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot is running. Visit /pairing for WhatsApp pairing code.');
    }
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

  console.log('[CONN] Initialisation de l\'authentification base de données...');
  const { state, saveCreds } = await useDatabaseAuth();

  console.log('[CONN] Récupération de la version de WhatsApp...');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[CONN] Version Baileys v${version.join('.')} (dernière : ${isLatest})`);

  console.log('[CONN] Création du socket Baileys...');
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

  console.log(`[CONN] État de l'enregistrement : ${sock.authState.creds.registered ? 'CONNECTÉ' : 'NON CONNECTÉ'}`);

  // Handle pairing code logic
  if (!sock.authState.creds.registered) {
    let phoneNumber = process.env.PHONE_NUMBER;
    if (!phoneNumber) {
      console.error('\n\x1b[31m' + '!' .repeat(60) + '\x1b[0m');
      console.error('\x1b[31m!!! ERREUR : PHONE_NUMBER non configuré dans les variables d\'env !!!\x1b[0m');
      console.error('\x1b[31m' + '!' .repeat(60) + '\x1b[0m\n');
      process.exit(1);
    }

    // Nettoyage du numéro : garder uniquement les chiffres
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    await delay(7000); // Wait for socket to be fully ready
    console.log(`[CONN] Initialisation du pairage pour le numéro : ${phoneNumber}`);

    let pairingSuccess = false;
    let attempts = 0;
    while (!pairingSuccess && attempts < 3) {
        attempts++;
        try {
            console.log(`[CONN] Demande du code de pairage (Essai ${attempts}/3)...`);
            const code = await sock.requestPairingCode(phoneNumber);
            currentPairingCode = code;

            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

            // Function to print code prominently
            const printCode = () => {
                if (!currentPairingCode) return; // Stop if already connected
                console.log('\n\n\x1b[32m' + '█'.repeat(60) + '\x1b[0m');
                console.log('\x1b[32m█\x1b[0m' + ' '.repeat(58) + '\x1b[32m█\x1b[0m');
                console.log('\x1b[32m█\x1b[0m' + '      VOTRE CODE DE PAIRAGE WHATSAPP EST PRÊT :       ' + '\x1b[32m█\x1b[0m');
                console.log('\x1b[32m█\x1b[0m' + ' '.repeat(58) + '\x1b[32m█\x1b[0m');
                console.log('\x1b[32m█\x1b[0m' + `               \x1b[1m\x1b[33m${formattedCode}\x1b[0m               ` + ' '.repeat(58 - 30 - formattedCode.length) + '\x1b[32m█\x1b[0m');
                console.log('\x1b[32m█\x1b[0m' + ' '.repeat(58) + '\x1b[32m█\x1b[0m');
                console.log('\x1b[32m█\x1b[0m' + ' '.repeat(58) + '\x1b[32m█\x1b[0m');
                console.log('\x1b[32m█\x1b[0m' + `  Web UI: http://localhost:${PORT}/pairing              ` + ' '.repeat(58 - 32 - PORT.toString().length) + '\x1b[32m█\x1b[0m');
                console.log('\x1b[32m█\x1b[0m' + ' '.repeat(58) + '\x1b[32m█\x1b[0m');
                console.log('\x1b[32m' + '█'.repeat(60) + '\x1b[0m\n\n');
            };

            printCode();

            // Repeat every 20s to keep it visible and fresh in the log buffer
            const interval = setInterval(() => {
                if (currentPairingCode && !sock.authState.creds.registered) {
                    printCode();
                } else {
                    clearInterval(interval);
                }
            }, 20000);

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
      console.log('\n\x1b[32m' + '='.repeat(60) + '\x1b[0m');
      console.log('\x1b[32m[CONN] WHATSAPP CONNECTÉ AVEC SUCCÈS ! LE BOT EST ACTIF.\x1b[0m');
      console.log('\x1b[32m' + '='.repeat(60) + '\x1b[0m\n');
      currentPairingCode = null;
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
