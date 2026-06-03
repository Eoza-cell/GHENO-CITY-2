require('dotenv').config();
const http = require('http');
const { getContentType, delay, downloadMediaMessage, makeWASocket, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { setupDatabase, Player, RPMessage } = require('./database');
const { useDatabaseAuth } = require('./database-auth');
const { handleCommand, getJid } = require('./command-handler');
const { updateChrono } = require('./chrono-utils');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Football Career RPG is running');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Server is running on port ${PORT} (Health check active)`); });

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
        const code = await sock.requestPairingCode(phoneNumber).catch(e => console.error("Pairing Error:", e));
        if (code) {
          console.log('==============================================================');
          console.log('Votre code de pairage :');
          console.log(`➡️➡️➡️   ${code?.match(/.{1,4}/g)?.join('-') || code}   ⬅️⬅️⬅️`);
          console.log('==============================================================');
        }
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== 401;
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp (Football Career RPG)');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    for (const message of m.messages) {
        if (!message.message) continue;
        const jid = getJid(message);
        const player = await Player.findOne({ where: { whatsappId: jid } });

        if (player) await updateChrono(player);

        // Registration Flow: Appearance Image Upload
        if (player && player.registrationStep === 'awaiting_appearance') {
            const type = getContentType(message.message);
            if (type === 'imageMessage') {
                const buffer = await downloadMediaMessage(message, 'buffer', {});
                if (!fs.existsSync('assets/profiles')) fs.mkdirSync('assets/profiles', { recursive: true });
                const filepath = `assets/profiles/${jid.split('@')[0]}.jpg`;
                fs.writeFileSync(filepath, buffer);
                await player.update({ appearanceImageUrl: filepath, registrationStep: null });
                await sock.sendMessage(message.key.remoteJid, { text: "✅ Apparence validée ! Ton dossier pro est complet. Tape /monde pour explorer ou /action pour parler au MJ." });
                continue;
            }
        }

        await handleCommand(sock, message);
    }
  });
}

connectToWhatsApp();
