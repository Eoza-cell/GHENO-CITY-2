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

let pairingCode = null;
let isWhatsAppConnected = false;

// Crée un serveur HTTP minimaliste pour répondre aux contrôles de santé de Render
const server = http.createServer((req, res) => {
    if (req.url === '/pairing') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (pairingCode) {
            res.end(`
                <html>
                    <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #121212; color: white;">
                        <h1>Code de Pairage Skype</h1>
                        <p style="font-size: 1.2em;">Entrez ce code sur votre téléphone :</p>
                        <div style="font-size: 3em; font-weight: bold; color: #25D366; letter-spacing: 5px; margin: 20px 0; border: 2px solid #25D366; padding: 20px; display: inline-block;">
                            ${pairingCode.match(/.{1,4}/g)?.join('-') || pairingCode}
                        </div>
                        <p>Allez dans WhatsApp > Appareils connectés > Connecter un appareil > Se connecter avec le numéro de téléphone</p>
                    </body>
                </html>
            `);
        } else {
            res.end("<h1>Code non généré.</h1><p>Vérifiez que le bot est en train de démarrer ou qu'il n'est pas déjà connecté.</p>");
        }
        return;
    }

    if (req.url === '/health') {
        if (isWhatsAppConnected) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
        } else {
            res.writeHead(503, { 'Content-Type': 'text/plain' });
            res.end('WhatsApp not connected');
        }
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running. Visit /pairing for WhatsApp code.');
});
const PORT = process.env.PORT || 3000;

// Initialisation de la queue pour gérer la charge
const messageQueue = new PQueue({ concurrency: 5 });

async function connectToWhatsApp() {
  console.log('[CORE] Initialisation de la connexion WhatsApp...');
  // Assure que le dossier des profils existe
  if (!fs.existsSync(path.join('assets', 'profiles'))) {
      fs.mkdirSync(path.join('assets', 'profiles'), { recursive: true });
  }

  const { state, saveCreds } = await useDatabaseAuth();
  console.log('[AUTH] État de session chargé depuis la DB.');

  let version;
  try {
      const v = await fetchLatestBaileysVersion();
      version = v.version;
      console.log(`[CORE] Utilisation de la version Baileys v${version.join('.')} (dernière : ${v.isLatest})`);
  } catch (e) {
      console.warn('[CORE] Échec de la récupération de la version Baileys, utilisation du défaut [2, 3000, 1015970611].');
      version = [2, 3000, 1015970611];
  }

  console.log('[CORE] Création de la socket WhatsApp...');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.ubuntu('Chrome'),
    version,
    logger: pino({ level: 'debug' }), // Increased logging level for diagnostics
    getMessage: async key => {
        console.log('⚠️ Message non déchiffré, retry demandé:', key);
        return { conversation: '🔄 Réessaye d\'envoyer ton message' };
    }
  });

  // Handle pairing code logic
  if (!sock.authState.creds.registered) {
    const phoneNumber = (process.env.PHONE_NUMBER || "").replace(/\D/g, "").trim();
    if (!phoneNumber) {
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error('!!! ERREUR : Le numéro de téléphone n\'est pas configuré.   !!!');
      console.error('!!! Définissez la variable d\'environnement PHONE_NUMBER.   !!!');
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      process.exit(1);
    }

    await delay(5000); // Increased delay to ensure socket is fully ready
    console.log(`[AUTH] Tentative de connexion avec le numéro : ${phoneNumber}`);

    let retryCount = 0;
    const maxRetries = 3;

    const getCode = async () => {
        try {
            console.log(`[AUTH] Demande du code de pairage (tentative ${retryCount + 1}/${maxRetries})...`);
            const code = await sock.requestPairingCode(phoneNumber);
            pairingCode = code;

            const displayCode = () => {
                if (sock.authState.creds.registered) return;
                console.log('\x1b[33m%s\x1b[0m', '==============================================================');
                console.log('\x1b[32m%s\x1b[0m', 'VOTRE CODE DE PAIRAGE WHATSAPP :');
                console.log('\x1b[32m%s\x1b[0m', `➡️➡️➡️   ${pairingCode?.match(/.{1,4}/g)?.join('-') || pairingCode}   ⬅️⬅️⬅️`);
                console.log('\x1b[33m%s\x1b[0m', '==============================================================');
                console.log('\x1b[36m%s\x1b[0m', `CONSULTEZ AUSSI ICI : /pairing sur votre URL de déploiement`);
                console.log('\x1b[33m%s\x1b[0m', '==============================================================');

                if (!sock.authState.creds.registered) {
                    setTimeout(displayCode, 20000);
                }
            };

            displayCode();
        } catch (error) {
            console.error('[AUTH] Erreur lors de la demande du code :', error.message);
            if (retryCount < maxRetries) {
                retryCount++;
                await delay(5000);
                return getCode();
            }
            process.exit(1);
        }
    };

    getCode();
  }

  // Connection Watchdog
  setTimeout(() => {
      if (!isWhatsAppConnected && !pairingCode) {
          console.warn('[WATCHDOG] La connexion WhatsApp semble bloquée. Aucune session et aucun code de pairage généré.');
          console.warn('[WATCHDOG] Vérifiez la variable PHONE_NUMBER et DATABASE_URL.');
      }
  }, 60000);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = (lastDisconnect.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== 401;

      console.log('Connection fermée à cause de :', lastDisconnect.error, ', reconnexion:', shouldReconnect);

      isWhatsAppConnected = false;
      if (statusCode === 401) {
          console.error('!!! SESSION INVALIDÉE (401) !!!');
          console.log('Réinitialisation de la session dans la base de données...');
          const { Creds } = require('./database');
          await Creds.destroy({ where: {} });
          console.log('Session effacée. Relancement pour nouveau pairage...');
          connectToWhatsApp();
      } else if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp');
      isWhatsAppConnected = true;

      // Envoyer une notification de connexion au numéro du bot
      try {
          const botId = jidNormalizedUser(sock.user.id);
          await sock.sendMessage(botId, { text: '✅ *SYSTÈME OPÉRATIONNEL* : Le Noyau Gemma 3 est maintenant en ligne et synchronisé avec WhatsApp.' });
          console.log('[AUTH] Notification de connexion envoyée.');
      } catch (e) {
          console.error('[AUTH] Échec de l\'envoi de la notification de connexion :', e.message);
      }

      startDayNightCycle();
    }
  });

  sock.ev.on('creds.update', async () => {
    try {
        await saveCreds();
        console.log('[AUTH] Session synchronisée avec la base de données.');
    } catch (e) {
        console.error('[AUTH] Erreur lors de la sauvegarde des crédits :', e.message);
    }
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
                            await sock.sendMessage(message.key.remoteJid, { text: `✅ *IDENTITÉ CONFIRMÉE* : Ta photo a été gravée dans les archives d'Aetherys.` });

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
                try {
                    await sock.sendMessage(message.key.remoteJid, { text: "⚠️ *ERREUR DE LA MATRICE*\nLe système a rencontré une anomalie critique lors du traitement de ton action. Si le problème persiste, contacte l'administrateur." });
                } catch (e) {}
            }
        });
    }
  });
}

setupDatabase()
  .then(async () => {
    console.log('[CORE] Base de données prête.');

    if (process.env.RESET_SESSION === 'true') {
        console.log('[AUTH] RESET_SESSION est activé. Nettoyage de la session...');
        const { Creds } = require('./database');
        await Creds.destroy({ where: {} });
        console.log('[AUTH] Session réinitialisée.');
    }

    // On lance le serveur HTTP immédiatement pour éviter le timeout de Render sur le port
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`[CORE] Server listening on port ${PORT}. Health checks available on /health.`);
    });

    console.log('[CORE] Lancement du bot...');
    connectToWhatsApp();
  })
  .catch(err => {
    console.error('[CRITICAL] Échec du démarrage de la base de données:', err);
    process.exit(1);
  });
