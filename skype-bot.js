// Charger les variables d'environnement au tout début
require('dotenv').config();

// Le bot utilise maintenant exclusivement Transformers.js local pour le moteur IA.

const http = require('http');
const { getContentType, jidNormalizedUser, delay, downloadMediaMessage, makeWASocket, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
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
const { startProactiveAIEngagement } = require('./proactive-engagement');

let isWhatsAppConnected = false;
let currentPairingCode = null;
let currentQrCode = null;
let pairingLogInterval = null;
let activeSocket = null;
let connectionStarting = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let reconnectScheduled = false;
const MAX_RECONNECT_DELAY = 60000;

function scheduleWhatsAppReconnect(reason, minimumDelay = 5000) {
    if (reconnectScheduled || reconnectTimer || isWhatsAppConnected) return;
    reconnectScheduled = true;
    reconnectAttempts += 1;
    const backoff = Math.min(MAX_RECONNECT_DELAY, Math.max(minimumDelay, 3000 * (2 ** Math.min(reconnectAttempts - 1, 5))));
    const jitter = Math.floor(Math.random() * 1500);
    const wait = backoff + jitter;
    console.warn(`[CONN] Reconnexion planifiée dans ${Math.round(wait / 1000)}s (tentative ${reconnectAttempts}) — ${reason}`);
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        reconnectScheduled = false;
        try { await connectToWhatsApp(); }
        catch (error) { console.error('[CONN] Échec de relance:', error.message); scheduleWhatsAppReconnect('échec de relance'); }
    }, wait);
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/pairing/status') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ connected: isWhatsAppConnected, pairingRequired: !isWhatsAppConnected, code: currentPairingCode, qrAvailable: Boolean(currentQrCode) }));
    }

    if (req.url === '/pairing') {
        let qrMarkup = '';
        if (!isWhatsAppConnected && currentQrCode) {
            try { const qrImage = await QRCode.toDataURL(currentQrCode, { width: 280, margin: 2 }); qrMarkup = `<h2>Ou scanne ce QR code</h2><img alt="QR WhatsApp" src="${qrImage}" style="width:280px;max-width:90%;background:white;padding:10px;border-radius:8px"/><p>WhatsApp → Appareils connectés → Connecter un appareil</p>`; } catch (e) { console.error('[AUTH] QR render failed:', e.message); }
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(`
            <html>
                <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #121b22; color: white; margin: 0; padding: 20px; box-sizing: border-box; text-align: center;">
                    <h1>🔗 AFTER THE REBIRTH (ATR) : Connexion</h1>
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
                    ${qrMarkup}
                    <script>setTimeout(() => location.reload(), 5000)</script>
                </body>
            </html>
        `);
    }

    if (req.url === '/reset-session') {
        const { Creds } = require('./database');
        Creds.destroy({ where: {}, truncate: true })
            .then(() => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #121b22; color: white; text-align: center;">
                            <h1>✅ Session Réinitialisée !</h1>
                            <p>La table d'authentification a été nettoyée. Redémarrage du serveur et génération d'un nouveau code...</p>
                            <p><a href="/pairing" style="color: #00a884; font-weight: bold; font-size: 18px;">Accéder à la page de pairage</a></p>
                        </body>
                    </html>
                `);
                setTimeout(() => process.exit(0), 1000);
            })
            .catch(err => {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Erreur lors du reset: ${err.message}`);
            });
        return;
    }

    if (req.url === '/version') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            service: 'GHENO-CITY-2',
            commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown',
            branch: process.env.RENDER_GIT_BRANCH || 'unknown',
            connected: isWhatsAppConnected,
            database: /^(1|true|yes)$/i.test(process.env.LOCAL_DATABASE || '') || !(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.AIVEN_DATABASE_URL) ? 'sqlite-local' : 'postgres-configured'
        }));
    }

    if (req.url === '/health' || req.url === '/') {
        res.writeHead(isWhatsAppConnected ? 200 : 503, { 'Content-Type': 'text/plain' });
        res.end(isWhatsAppConnected ? 'OPERATIONAL' : 'AWAITING_WHATSAPP_PAIRING');
        return;
    }

    res.writeHead(404);
    res.end();
});
const PORT = process.env.PORT || 3005;

server.listen(PORT, () => {
    console.log(`[SYSTEM] Serveur de santé actif sur le port ${PORT}`);
});

const messageQueue = new PQueue({ concurrency: 5 });

async function connectToWhatsApp() {
  if (isWhatsAppConnected || connectionStarting || (activeSocket && activeSocket.ws && activeSocket.ws.readyState === 1)) {
      console.log('[CONN] Démarrage ignoré : une connexion WhatsApp est déjà active ou en cours.');
      return;
  }
  connectionStarting = true;
  try {
  if (!fs.existsSync(path.join('assets', 'profiles'))) {
      fs.mkdirSync(path.join('assets', 'profiles'), { recursive: true });
  }

  if (process.env.RESET_SESSION === 'true') {
      console.warn('[AUTH] RESET_SESSION est défini, mais la session persistante est conservée pour éviter un nouveau pairage à chaque redémarrage. Retire cette variable après une réinitialisation volontaire.');
  }

  const { state, saveCreds } = await useDatabaseAuth();
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Utilisation de la version Baileys v${version.join('.')} (dernière version : ${isLatest})`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.macOS('Chrome'),
    syncFullHistory: false,
    version,
    logger: pino({ level: 'debug' }),
    getMessage: async key => {
        console.log('⚠️ Message non déchiffré, retry demandé:', key);
        return undefined;
    }
  });

  activeSocket = sock;
  sock.ev.on('creds.update', async () => {
    try {
      await saveCreds();
      console.log(`[AUTH] Session WhatsApp persistée dans ${require('./database').sequelize.getDialect()}.`);
    } catch (error) {
      console.error('[AUTH] Échec de persistance des credentials:', error.message);
    }
  });

  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER?.replace(/[^0-9]/g, '');
    console.log(`[AUTH] État de registration : non-enregistré. Numéro cible : ${phoneNumber}`);

    if (!phoneNumber) {
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error("!!! ERREUR : Le numéro de téléphone n'est pas configuré.   !!!");
      console.error("!!! Définissez la variable d'environnement PHONE_NUMBER.   !!!");
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      process.exit(1);
    }

    let pairingRequested = false;
    let pairingRetryCount = 0;
    let socketClosedDuringPairing = false;

    const requestAndShowCode = async () => {
        if (pairingRequested || isWhatsAppConnected || sock.authState.creds.registered) return;

        pairingRequested = true;
        try {
            // Ne jamais demander le code tant que le WebSocket n'est pas réellement ouvert.
            // L'événement "connecting" peut arriver avant l'ouverture effective du socket.
            const socketWaitStartedAt = Date.now();
            while (sock.ws?.readyState !== 1 && Date.now() - socketWaitStartedAt < 15000) {
                if (socketClosedDuringPairing || sock.ws?.readyState === 3) break;
                await delay(250);
            }
            if (socketClosedDuringPairing || sock.ws?.readyState !== 1 || isWhatsAppConnected || sock.authState.creds.registered) {
                pairingRequested = false;
                console.warn(`[AUTH] Code non demandé : WebSocket non prêt (readyState=${sock.ws?.readyState ?? 'indisponible'}).`);
                return;
            }
            console.log(`[AUTH] WebSocket ouvert. Demande du code pour : ${phoneNumber} (Tentative ${pairingRetryCount + 1})`);
            const code = await sock.requestPairingCode(phoneNumber);
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
            currentPairingCode = formattedCode;

            // Ligne simple, immédiatement repérable dans les logs Render.
            console.log(`[PAIRING_CODE] ${formattedCode}`);
            console.log('[AUTH] Saisir ce code dans WhatsApp > Appareils connectés > Lier avec un numéro de téléphone.');

        } catch (err) {
            pairingRequested = false;
            pairingRetryCount++;
            console.error('[AUTH] Échec demande code pairing:', err.message);

            if (pairingRetryCount < 4) {
                console.log('[AUTH] Nouvelle tentative automatique dans 3 secondes...');
                setTimeout(() => {
                    if (!socketClosedDuringPairing && !isWhatsAppConnected && !sock.authState.creds.registered) {
                        requestAndShowCode();
                    }
                }, 3000);
            }
        }
    };

    if (pairingLogInterval) clearInterval(pairingLogInterval);
    pairingLogInterval = setInterval(() => {
        if (currentPairingCode) {
            console.log(`[PAIRING_CODE] ${currentPairingCode}`);
        } else if (!isWhatsAppConnected) {
            console.warn('[AUTH] En attente de génération du code pairing...');
        }
    }, 20000);

    sock.ev.on('connection.update', async (update) => {
        if (update.connection === 'close') {
            socketClosedDuringPairing = true;
            if (pairingLogInterval) { clearInterval(pairingLogInterval); pairingLogInterval = null; }
            currentPairingCode = null;
            currentQrCode = null;
            console.warn('[AUTH] Connexion interrompue : ancien code effacé, un nouveau sera demandé après reconnexion.');
        }
        if (update.qr) currentQrCode = update.qr;
        if (update.connection === 'connecting' && !sock.authState.creds.registered && pairingRetryCount < 4) {
            await requestAndShowCode();
        }

        if (update.connection === 'open') {
            if (pairingLogInterval) { clearInterval(pairingLogInterval); pairingLogInterval = null; }
            socketClosedDuringPairing = false;
            currentPairingCode = null;
            currentQrCode = null;
        }
    });
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      // Ignore les événements tardifs d'un ancien socket après une reconnexion.
      if (activeSocket && activeSocket !== sock) return;
      isWhatsAppConnected = false;
      const disconnectError = lastDisconnect?.error;
      const statusCode = disconnectError?.output?.statusCode;
      const isConflict = statusCode === 440 || disconnectError?.message?.toLowerCase().includes('conflict');
      const isLoggedOut = statusCode === 401;

      console.log(`[CONN] Fermée. Code: ${statusCode}, Conflict: ${isConflict}, LoggedOut: ${isLoggedOut}`);

      if (activeSocket === sock) activeSocket = null;
      currentPairingCode = null;
      currentQrCode = null;
      if (pairingLogInterval) { clearInterval(pairingLogInterval); pairingLogInterval = null; }

      if (isLoggedOut) {
          if (!sock.authState.creds.registered) {
              console.error('[CONN] 401 pendant un premier pairage : aucune session WhatsApp enregistrée. Les identifiants provisoires restent intacts pour diagnostic ; aucun effacement automatique.');
          } else {
              console.error('[CONN] Session enregistrée refusée (401). Arrêt automatique : les identifiants sont conservés pour éviter toute perte de session.');
          }
          return;
      }

      if (isConflict) {
          console.error('[CONN] Conflit Baileys 440 : une autre instance utilise probablement cette session. Vérifie que Render ne lance qu’une seule instance et qu’aucun ancien déploiement ne tourne.');
          scheduleWhatsAppReconnect('conflit de session 440', 25000);
          return;
      }

      scheduleWhatsAppReconnect('connexion fermée (' + (statusCode || 'sans code') + ')', 5000);
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp');
      isWhatsAppConnected = true;
      reconnectAttempts = 0;
      reconnectScheduled = false;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      try {
        await saveCreds();
        console.log('[AUTH] Snapshot final de session enregistré.');
      } catch (error) {
        console.error("[AUTH] Impossible d'enregistrer le snapshot de session:", error.message);
      }
      currentPairingCode = null;
      currentQrCode = null;

      try {
          const botJid = jidNormalizedUser(sock.user.id);
          sock.sendMessage(botJid, { text: "🚀 *SYSTÈME OPÉRATIONNEL* - After the Rebirth (ATR) est en ligne." });
      } catch (e) {}

      startDayNightCycle();
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
                            await sock.sendMessage(message.key.remoteJid, { text: `Photo de profil enregistrée ! Bienvenue officiellement dans After the Rebirth (ATR).` });

                            await startTutorial(sock, message.key.remoteJid, player);
                            return;
                        } catch (error) {
                            console.error("Erreur lors de l'enregistrement de la photo de profil:", error);
                            await sock.sendMessage(message.key.remoteJid, { text: "Une erreur est survenue lors de l'enregistrement de votre image. Veuillez réessayer." });
                            return;
                        }
                    } else {
                         await player.update({ awaitingProfilePic: false });
                         await sock.sendMessage(message.key.remoteJid, { text: `Photo de profil ignorée (avatar par défaut attribué). Bienvenue dans After the Rebirth (ATR) !` });
                         await startTutorial(sock, message.key.remoteJid, player);
                         return;
                    }
                }

                await handleCommand(sock, message, downloadMediaMessage);
            } catch (globalError) {
                console.error("[CRITICAL] Erreur lors du traitement d'un message upsert:", globalError);
            }
        });
    }
  });
  } finally {
    connectionStarting = false;
  }
}

if (require.main === module) {
  setupDatabase()
    .then(async () => {
      console.log('[CORE] Base de données prête. Lancement du bot...');

      startModelServer();

      connectToWhatsApp();
    })
    .catch(err => {
      console.error('[CRITICAL] Échec du démarrage de la base de données:', err);
      process.exit(1);
    });
}
