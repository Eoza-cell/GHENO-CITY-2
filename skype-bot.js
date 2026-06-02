require('dotenv').config();
const http = require('http');
const { getContentType, delay, downloadMediaMessage, makeWASocket, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { setupDatabase, Player } = require('./database');
const { useDatabaseAuth } = require('./database-auth');
const { handleCommand, getJid } = require('./command-handler');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Basketball Gacha RP Bot is running');
});
const PORT = process.env.PORT || 3000;
let serverStarted = false;

async function connectToWhatsApp() {
  await setupDatabase();
  const { state, saveCreds } = await useDatabaseAuth();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    version,
    logger: pino({ level: 'silent' }),
    getMessage: async key => ({ conversation: '...' }),
    browser: ["Ubuntu", "Chrome", "128.0.6613.86"]
  });

  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER;
    if (phoneNumber) {
        await delay(3000);
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('==============================================================');
        console.log('Votre code de pairage :');
        console.log(`➡️➡️➡️   ${code?.match(/.{1,4}/g)?.join('-') || code}   ⬅️⬅️⬅️`);
        console.log('==============================================================');
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== 401;
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp (Basketball Gacha)');
      if (!serverStarted) {
          server.listen(PORT, () => { console.log(`Server on port ${PORT}`); serverStarted = true; });
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    for (const message of m.messages) {
        if (!message.message) continue;
        const jid = getJid(message);
        const player = await Player.findOne({ where: { whatsappId: jid } });

        // View Once Bypass
        let viewOnceMsg = message.message.viewOnceMessage || message.message.viewOnceMessageV2;
        if (viewOnceMsg) {
            const actualContent = viewOnceMsg.message;
            const innerType = Object.keys(actualContent)[0];
            if (actualContent[innerType].viewOnce) actualContent[innerType].viewOnce = false;
            await sock.sendMessage(message.key.remoteJid, actualContent, { quoted: message });
        }

        await handleCommand(sock, message);
    }
  });
}

connectToWhatsApp();
