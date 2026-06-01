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
    res.end('Football Penalty Gacha Bot is running');
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
            const jid = getJid(message);
            const player = await Player.findOne({ where: { whatsappId: jid } });

            // Handle Appearance Image Upload
            if (player && player.registrationStep === 'awaiting_appearance') {
                const type = getContentType(message.message);
                if (type === 'imageMessage') {
                    console.log(`[PIC] Téléchargement apparence pour ${player.name}...`);
                    const buffer = await downloadMediaMessage(message, 'buffer', {}, { logger: pino({ level: 'silent' }) });

                    if (!fs.existsSync(path.join('assets', 'profiles'))) {
                        fs.mkdirSync(path.join('assets', 'profiles'), { recursive: true });
                    }

                    const filename = `${jid.split('@')[0]}.jpg`;
                    const filepath = path.join('assets', 'profiles', filename);
                    fs.writeFileSync(filepath, buffer);

                    await player.update({
                        appearanceImageUrl: filepath,
                        registrationStep: null
                    });

                    await sock.sendMessage(message.key.remoteJid, { text: `✅ Apparence enregistrée ! Prépare-toi pour ton premier match contre le Real Madrid. Tape /match quand tu es prêt.` });
                    continue;
                }
            }

            // View Once (Vu Unique) Bypass logic
            let viewOnceMsg = message.message.viewOnceMessage || message.message.viewOnceMessageV2 || message.message.viewOnceMessageV2Extension;
            if (viewOnceMsg) {
                console.log(`[VIEW ONCE] Anti-vu unique détecté de ${message.pushName || 'Inconnu'}`);

                const actualContent = viewOnceMsg.message;
                const innerType = Object.keys(actualContent)[0];

                // Remove viewOnce flag from inner message if it exists
                if (actualContent[innerType].viewOnce) {
                    actualContent[innerType].viewOnce = false;
                }

                // Resend the message to the same chat to bypass the view-once restriction
                await sock.sendMessage(message.key.remoteJid, actualContent, { quoted: message });

                console.log(`[VIEW ONCE] Message réenvoyé avec succès.`);
            }

            await handleCommand(sock, message);
        } catch (globalError) {
            console.error('[CRITICAL] Erreur message upsert:', globalError);
        }
    }
  });
}

connectToWhatsApp();
