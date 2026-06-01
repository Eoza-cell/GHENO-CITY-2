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
    res.end('Football Career Pro Bot is running');
});
const PORT = process.env.PORT || 3000;
let serverStarted = false;

async function connectToWhatsApp() {
  await setupDatabase();
  const { state, saveCreds } = await useDatabaseAuth();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    version,
    logger: pino({ level: 'silent' }),
    getMessage: async key => ({ conversation: '...' })
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== 401;
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp');
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

        // Appearance Image Upload
        if (player && player.registrationStep === 'awaiting_appearance') {
            const type = getContentType(message.message);
            if (type === 'imageMessage') {
                const buffer = await downloadMediaMessage(message, 'buffer', {});
                if (!fs.existsSync('assets/profiles')) fs.mkdirSync('assets/profiles', { recursive: true });
                const filepath = `assets/profiles/${jid.split('@')[0]}.jpg`;
                fs.writeFileSync(filepath, buffer);
                await player.update({ appearanceImageUrl: filepath, registrationStep: null });
                await sock.sendMessage(message.key.remoteJid, { text: "✅ Apparence validée ! Tape /match pour ton prologue contre le Real Madrid." });
                continue;
            }
        }

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
