// Charger les variables d'environnement au tout début
require('dotenv').config();

// Le bot utilise maintenant exclusivement Transformers.js local pour le moteur IA.

const http = require('http');
const crypto = require('crypto');
const { jidNormalizedUser, delay, downloadMediaMessage, makeWASocket, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { default: PQueue } = require('p-queue');
const { Sequelize } = require('sequelize');
const { setupDatabase, Creds } = require('./database');
const { useDatabaseAuth } = require('./database-auth');
const { handleCommand, getJid } = require('./command-handler');
const { startTutorial } = require('./tutorial-handler');
const { startDayNightCycle } = require('./game-state');
const { startModelServer } = require('./model-server');
const { startProactiveAIEngagement } = require('./proactive-engagement');
const { prepareAetherysVisualPack } = require('./aetherys-visual-pack');

let isWhatsAppConnected = false;
let currentPairingCode = null;
let currentQrCode = null;
let pairingLogInterval = null;
let activeSocket = null;
let connectionStarting = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let reconnectScheduled = false;
let authResetAttempts = 0;
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

function isAuthorizedPairingRequest(req) {
    const expectedToken = process.env.PAIRING_PAGE_TOKEN;
    const header = req.headers.authorization || '';
    if (!expectedToken || !header.startsWith('Basic ')) return false;
    try {
        const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
        const separator = decoded.indexOf(':');
        if (separator < 0) return false;
        const supplied = Buffer.from(decoded.slice(separator + 1));
        const expected = Buffer.from(expectedToken);
        return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
    } catch {
        return false;
    }
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/pairing/status') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ connected: isWhatsAppConnected, pairingRequired: !isWhatsAppConnected, qrAvailable: Boolean(currentQrCode) }));
    }

    if (req.url === '/pairing') {
        if (!isAuthorizedPairingRequest(req)) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="ATR Pairing"', 'Cache-Control': 'no-store' });
            return res.end('Accès protégé. Configure PAIRING_PAGE_TOKEN dans Render puis connecte-toi avec ce mot de passe.');
        }
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

    if (req.url === '/version') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            service: 'GHENO-CITY-2',
            commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown',
            branch: process.env.RENDER_GIT_BRANCH || 'unknown',
            connected: isWhatsAppConnected,
            whatsappLeader: whatsappLeaderLockAcquired ? 'owner' : 'standby',
            database: /^(1|true|yes)$/i.test(process.env.LOCAL_DATABASE || '') || !(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.AIVEN_DATABASE_URL) ? 'sqlite-local' : 'postgres-configured'
        }));
    }

    if (req.url === '/health' || req.url === '/') {
        // Render doit pouvoir vérifier le processus même avant le premier pairage WhatsApp.
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({
            status: 'healthy',
            whatsapp: isWhatsAppConnected ? 'connected' : 'awaiting_pairing'
        }));
        return;
    }

    res.writeHead(404);
    res.end();
});
const PORT = process.env.PORT || 3005;

// Une seule instance Baileys doit manipuler les clés Signal d'un compte.
// Le verrou PostgreSQL est détenu par une connexion dédiée pendant toute la vie
// du processus (un verrou advisory lié à la session PG, pas au pool Sequelize).
let whatsappLeaderLockClient = null;
let whatsappLeaderLockAcquired = false;

async function acquireWhatsAppLeaderLock() {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.AIVEN_DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('[WA-LOCK] PostgreSQL requis pour protéger la session WhatsApp contre les instances concurrentes.');
    }

    const { Client } = require('pg');
    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        keepAlive: true,
        connectionTimeoutMillis: 20000
    });
    client.on('error', (error) => {
        console.error('[WA-LOCK] Connexion du verrou perdue : arrêt immédiat pour éviter deux sockets WhatsApp actifs.', error.message);
        process.exit(1);
    });
    await client.connect();
    whatsappLeaderLockClient = client;

    while (!whatsappLeaderLockAcquired) {
        const result = await client.query(
            'SELECT pg_try_advisory_lock($1, $2) AS locked',
            [20261117, 1]
        );
        whatsappLeaderLockAcquired = result.rows?.[0]?.locked === true;
        if (whatsappLeaderLockAcquired) {
            console.log('[WA-LOCK] Verrou exclusif obtenu : cette instance est la seule autorisée à ouvrir WhatsApp.');
            break;
        }
        console.warn('[WA-LOCK] Une autre instance utilise déjà la session WhatsApp. Cette instance reste en attente sans ouvrir de socket; nouvel essai dans 15 secondes.');
        await delay(15000);
    }
}

server.listen(PORT, () => {
    console.log(`[SYSTEM] Serveur de santé actif sur le port ${PORT}`);
});

const messageQueue = new PQueue({ concurrency: 5 });

async function connectToWhatsApp() {
  const socketState = activeSocket?.ws?.readyState;
  // WebSocket CONNECTING (0) et OPEN (1) : ne jamais créer un second socket.
  if (isWhatsAppConnected || connectionStarting || socketState === 0 || socketState === 1) {
      console.log(`[CONN] Démarrage ignoré : connexion déjà active/en cours (readyState=${socketState ?? 'n/a'}).`);
      return;
  }
  if (activeSocket && socketState !== 0 && socketState !== 1) activeSocket = null;
  connectionStarting = true;
  try {
  if (!fs.existsSync(path.join('assets', 'profiles'))) {
      fs.mkdirSync(path.join('assets', 'profiles'), { recursive: true });
  }

  const { state, saveCreds, clearSession } = await useDatabaseAuth();

  const resetToken = (process.env.RESET_SESSION || '').trim();
  if (resetToken && !['false', '0', 'no'].includes(resetToken.toLowerCase())) {
      const marker = await Creds.findOne({ where: { key: 'reset-marker' } });
      if (!marker || marker.value !== resetToken) {
          console.warn('[AUTH] RESET_SESSION demandé : effacement volontaire de la session WhatsApp.');
          await clearSession();
          await Creds.upsert({ key: 'reset-marker', value: resetToken });
          connectionStarting = false;
          return connectToWhatsApp();
      }
  }
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Utilisation de la version Baileys v${version.join('.')} (dernière version : ${isLatest})`);

  const baileysLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'info' });
  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger)
    },
    printQRInTerminal: false,
    syncFullHistory: false,
    version,
    logger: baileysLogger,
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
    let pairingCheckScheduled = false;
    let pairingRetryCount = 0;
    let socketClosedDuringPairing = false;

    const schedulePairingRequest = (waitMs = 1000) => {
        if (pairingCheckScheduled || pairingRequested || socketClosedDuringPairing) return;
        pairingCheckScheduled = true;
        setTimeout(() => {
            pairingCheckScheduled = false;
            requestAndShowCode();
        }, waitMs);
    };

    const requestAndShowCode = async () => {
        if (pairingRequested || isWhatsAppConnected || sock.authState.creds.registered || socketClosedDuringPairing) return;

        // Baileys 6.7.24 ne publie pas toujours sock.ws :
        // readyState peut rester indisponible même après le handshake.
        // La demande est déclenchée depuis connection.update, sans dépendre
        // d'une propriété interne du socket.
        pairingRequested = true;
        try {
            console.log(`[AUTH] WebSocket prêt. Demande du code de pairage pour ${phoneNumber} (tentative ${pairingRetryCount + 1}).`);
            const code = await sock.requestPairingCode(phoneNumber);
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
            currentPairingCode = formattedCode;
            console.log(`[PAIRING_CODE] ${formattedCode}`);
            console.log('[AUTH] WhatsApp > Appareils connectés > Lier avec un numéro de téléphone.');
        } catch (err) {
            pairingRequested = false;
            pairingRetryCount++;
            console.error('[AUTH] Échec demande code pairing:', err?.message || err);

            if (pairingRetryCount < 4 && !socketClosedDuringPairing) {
                console.log('[AUTH] Nouvelle tentative automatique dans 5 secondes...');
                schedulePairingRequest(5000);
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
        if (update.qr) {
            currentQrCode = update.qr;
            if (!sock.authState.creds.registered) await requestAndShowCode();
        }
        if (update.connection === 'connecting' && !sock.authState.creds.registered) {
            console.log('[AUTH] Événement connecting reçu : préparation du code de pairage.');
            schedulePairingRequest(1200);
        }
        if (update.connection === 'open') {
            if (pairingLogInterval) { clearInterval(pairingLogInterval); pairingLogInterval = null; }
            socketClosedDuringPairing = false;
            currentPairingCode = null;
            currentQrCode = null;
        }
    });

    // Filet de sécurité : ne pas dépendre uniquement de "connecting",
    // qui peut avoir été émis avant l'abonnement à connection.update.
    schedulePairingRequest(4000);
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
          authResetAttempts += 1;
          console.error(`[CONN] WhatsApp a signalé une déconnexion 401 (tentative ${authResetAttempts}). Session conservée : aucune clé ne sera effacée automatiquement. Vérifie l'état des appareils liés avant toute action manuelle.`);
          // Une réponse 401 ne suffit pas à justifier la destruction des clés Signal.
          // On laisse les credentials intacts pour éviter une perte de session irréversible.
          scheduleWhatsAppReconnect('déconnexion 401 — session préservée', 15000);
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
      authResetAttempts = 0;
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
    const batch = Array.isArray(m?.messages) ? m.messages : [];
    console.log(`[WA-IN] upsert type=${m?.type || 'unknown'} count=${batch.length}`);
    for (const message of batch) {
        const key = message?.key || {};
        console.log(`[WA-IN] id=${key.id || 'n/a'} fromMe=${Boolean(key.fromMe)} remote=${key.remoteJid || 'n/a'} participant=${key.participant || 'n/a'} content=${Boolean(message?.message)}`);
        messageQueue.add(async () => {
            try {
                if (!message.message) {
                    console.warn(`[WA-IN] Message ignoré : contenu absent après upsert (id=${key.id || 'n/a'}).`);
                    return;
                }

                const jid = getJid(message);
                if (!jid) {
                    console.warn(`[WA-IN] Message ignoré : expéditeur/JID introuvable (id=${key.id || 'n/a'}).`);
                    return;
                }

                // Profile-image upload / 'passer' is handled once in command-handler.js.
                // Keeping a second handler here caused duplicate onboarding and premature auto-skip.

                await handleCommand(sock, message, downloadMediaMessage);
            } catch (globalError) {
                console.error("[CRITICAL] Erreur lors du traitement d'un message upsert:", globalError);
            }
        });
    }
  });
  } catch (error) {
    console.error('[CONN] Échec pendant la préparation de la connexion WhatsApp:', error?.stack || error?.message || error);
    if (!isWhatsAppConnected) {
      scheduleWhatsAppReconnect('erreur de préparation Baileys', 8000);
    }
  } finally {
    connectionStarting = false;
  }
}

if (require.main === module) {
  acquireWhatsAppLeaderLock()
    .then(() => setupDatabase())
    .then(() => {
      console.log('[CORE] Base de données prête. Verrou WhatsApp exclusif actif; lancement prioritaire de WhatsApp...');

      // Démarrer Baileys immédiatement après la base, sans attendre les tâches secondaires.
      try {
        startModelServer();
      } catch (error) {
        console.error('[AI] Démarrage du serveur de modèle impossible (WhatsApp continue):', error?.message || error);
      }
      connectToWhatsApp();

      // Préparation visuelle et monde vivant en arrière-plan.
      prepareAetherysVisualPack()
        .then(() => console.log('[VISUAL] Pack visuel Aetheris prêt.'))
        .catch(err => console.error('[VISUAL] Préparation du pack visuel échouée:', err));

      require('./world-engine').initializeWorld()
        .then(() => console.log('[WORLD] Monde vivant initialisé en arrière-plan.'))
        .catch(err => console.error('[WORLD] Initialisation du monde vivant échouée:', err));
    })
    .catch(err => {
      console.error('[CRITICAL] Échec du démarrage de la base de données:', err);
      process.exit(1);
    });
}

