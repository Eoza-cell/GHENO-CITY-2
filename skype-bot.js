// Charger les variables d'environnement au tout début
require('dotenv').config();

const http = require('http');
const { getContentType, delay, downloadMediaMessage, makeWASocket, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { setupDatabase, Player } = require('./database');
const { useDatabaseAuth } = require('./database-auth');
const { handleCommand, getJid } = require('./command-handler');

// Crée un serveur HTTP minimaliste pour répondre aux contrôles de santé
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Basketball Gacha Bot is running');
});
const PORT = process.env.PORT || 3000;
let serverStarted = false;

async function connectToWhatsApp() {
  await setupDatabase();

  const { state, saveCreds } = await useDatabaseAuth();
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Utilisation de la version Baileys v${version.join('.')} (dernière version : ${isLatest})`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '128.0.6613.86'],
    version,
    logger: pino({ level: 'silent' }),
    getMessage: async key => {
        return { conversation: '🔄 Réessaye d\'envoyer ton message' };
    }
  });

  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER;
    if (!phoneNumber) {
      console.error('PHONE_NUMBER non configuré.');
      process.exit(1);
    }

    await delay(1500);
    console.log(`Tentative de connexion : ${phoneNumber}`);
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('==============================================================');
      console.log('Votre code de pairage :');
      console.log(`➡️➡️➡️   ${code?.match(/.{1,4}/g)?.join('-') || code}   ⬅️⬅️⬅️`);
      console.log('==============================================================');
    } catch (error) {
      console.error('Impossible de demander le code de pairage :', error);
      process.exit(1);
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== 401;
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp');
      if (!serverStarted) {
          server.listen(PORT, () => {
              console.log(`Server listening on port ${PORT}`);
              serverStarted = true;
          });
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    for (const message of m.messages) {
        try {
            if (!message.message) continue;
            await handleCommand(sock, message);
        } catch (globalError) {
            console.error('[CRITICAL] Erreur message upsert:', globalError);
        }
    }
  });
}

connectToWhatsApp();
