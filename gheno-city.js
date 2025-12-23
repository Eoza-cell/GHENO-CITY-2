require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const fs = require('fs');
const { setupDatabase } = require('./database');
const { handleCommand } = require('./command-handler');
const { startInactivePlayerHandler } = require('./inactive-handler');

async function connectToWhatsApp() {
  await setupDatabase();

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '128.0.6613.86'],
    version,
    logger: pino({ level: 'silent' }),
    getMessage: async key => {
        console.log('⚠️ Message non déchiffré, retry demandé:', key);
        return { conversation: '🔄 Réessaye d\'envoyer ton message' };
    }
  });

  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER;
    if (!phoneNumber) {
      console.error('Numéro de téléphone non configuré. Veuillez définir la variable d\'environnement PHONE_NUMBER.');
      process.exit(1);
    }
    const code = await sock.requestPairingCode(phoneNumber);
    console.log(`\nVotre code d'appairage : ${code}\n`);
  }


  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
        const statusCode = lastDisconnect.error?.output?.statusCode;
        if (statusCode === 401 || statusCode === 428) {
            console.error(`Erreur de connexion fatale (${statusCode}). Suppression des identifiants et redémarrage...`);
            // Supprimer le dossier d'authentification pour forcer une nouvelle session
            fs.rmdirSync('./auth_info_baileys', { recursive: true });
            // Quitter le processus pour permettre à Render de redémarrer l'application
            process.exit(1);
        } else {
            console.log('Connection closed, reconnecting...', lastDisconnect.error);
            connectToWhatsApp();
        }
    } else if (connection === 'open') {
        console.log('Connecté à WhatsApp');
        startInactivePlayerHandler(sock);
    }
});

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    m.messages.forEach(async (message) => {
      if (!message.message) return;
      handleCommand(sock, message);
    });
  });
}

connectToWhatsApp();

// Create a simple HTTP server to keep the Render service alive
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WhatsApp Bot is running.\\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
