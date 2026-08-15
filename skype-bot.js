require('dotenv').config();

const http = require('http');
const { jidNormalizedUser, delay, makeWASocket, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { default: PQueue } = require('p-queue');
const { setupDatabase } = require('./database');
const { useDatabaseAuth } = require('./database-auth');
const { handleCommand, getJid } = require('./command-handler');

let isWhatsAppConnected = false;
let currentPairingCode = null;

// Crée un serveur HTTP basique pour afficher l'état de connexion et le code de pairage
const server = http.createServer((req, res) => {
    if (req.url === '/pairing' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`
            <html>
                <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #121b22; color: white; margin: 0; padding: 20px; box-sizing: border-box; text-align: center;">
                    <h1>🔗 Assistant Bot WhatsApp : Connexion</h1>

                    ${isWhatsAppConnected ? `
                        <div style="border: 2px solid #00a884; padding: 40px; border-radius: 15px;">
                            <p style="color: #00a884; font-size: 48px; margin: 0;">✅ CONNECTÉ</p>
                            <p style="font-size: 18px; margin-top: 10px;">Le bot est en ligne et prêt à répondre.</p>
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

    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(isWhatsAppConnected ? 'OPERATIONAL' : 'AWAITING_PAIRING');
        return;
    }

    res.writeHead(404);
    res.end();
});
const PORT = process.env.PORT || 3005;

server.listen(PORT, () => {
    console.log(`[SYSTEM] Serveur HTTP actif sur le port ${PORT}`);
});

// File d'attente pour gérer les messages de manière ordonnée
const messageQueue = new PQueue({ concurrency: 5 });

async function connectToWhatsApp() {
  const { state, saveCreds } = await useDatabaseAuth();
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[BOT] Lancement de Baileys v${version.join('.')} (dernière version : ${isLatest})`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    version,
    logger: pino({ level: 'info' }),
    getMessage: async key => {
        return undefined;
    }
  });

  // Gestion du code d'association/pairing
  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER?.replace(/[^0-9]/g, '');
    console.log(`[AUTH] Non-enregistré. Numéro configuré : ${phoneNumber}`);

    if (!phoneNumber) {
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error('!!! ERREUR : Le numéro de téléphone n\'est pas configuré.   !!!');
      console.error('!!! Définissez la variable d\'environnement PHONE_NUMBER.   !!!');
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      process.exit(1);
    }

    await delay(2000);

    const requestAndShowCode = async (retryCount = 0) => {
        try {
            console.log(`[AUTH] Demande du code pour : ${phoneNumber} (Tentative ${retryCount + 1})`);
            const code = await sock.requestPairingCode(phoneNumber);
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
            currentPairingCode = formattedCode;

            console.log('\n' + '*'.repeat(65));
            console.log('*   CODE DE PAIRAGE WHATSAPP :');
            console.log('*');
            console.log(`*   ➡️➡️➡️   ${formattedCode}   ⬅️⬅️⬅️`);
            console.log('*');
            console.log('*   Entrez ce code dans WhatsApp > Appareils connectés');
            console.log('*'.repeat(65) + '\n');
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
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      isWhatsAppConnected = false;
      const statusCode = (lastDisconnect.error)?.output?.statusCode;
      const isLoggedOut = statusCode === 401;

      console.log(`[CONN] Fermée. Code: ${statusCode}, LoggedOut: ${isLoggedOut}`);

      if (isLoggedOut) {
          console.log('[CONN] Déconnexion détectée. Nettoyage de la base de données de session...');
          const { Creds } = require('./database');
          try {
              await Creds.destroy({ where: {}, truncate: true });
              console.log('[CONN] Session réinitialisée. Attente de 15 secondes avant de regénérer un code...');
              await delay(15000);
              connectToWhatsApp();
          } catch (e) {
              console.error('[CONN] Erreur lors du nettoyage de la session:', e.message);
          }
          return;
      }

      console.log('[CONN] Reconnexion dans 10s...');
      await delay(10000);
      connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('[CONN] Connecté avec succès à WhatsApp !');
      isWhatsAppConnected = true;
      currentPairingCode = null;

      try {
          const botJid = jidNormalizedUser(sock.user.id);
          sock.sendMessage(botJid, { text: "🚀 *SYSTÈME OPÉRATIONNEL* - Le bot basique avec IA intégrée est en ligne !" });
      } catch (e) {}
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
                await handleCommand(sock, message);
            } catch (globalError) {
                console.error('[CRITICAL] Erreur lors du traitement d\'un message:', globalError);
            }
        });
    }
  });
}

if (require.main === module) {
  setupDatabase()
    .then(async () => {
      console.log('[CORE] Lancement du bot...');
      connectToWhatsApp();
    })
    .catch(err => {
      console.error('[CRITICAL] Échec du démarrage de la base de données:', err);
      process.exit(1);
    });
}
