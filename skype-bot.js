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
  console.log('[BOT] Démarrage de la connexion...');
  try {
    await setupDatabase();
    console.log('[BOT] Base de données prête.');
  } catch (e) {
    console.error('[BOT] Erreur lors de la configuration de la base de données:', e.message);
  }

  const { state, saveCreds } = await useDatabaseAuth();

  // Force re-pairing if requested via environment variable
  if (process.env.FORCE_REPAIRING === 'true') {
      console.log('[BOT] FORCE_REPAIRING activé. Réinitialisation des credentials...');
      state.creds = require('@whiskeysockets/baileys').initAuthCreds();
  }

  const { version } = await fetchLatestBaileysVersion();

  console.log(`[BOT] Utilisation de Baileys v${version.join('.')}`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    version,
    logger: pino({ level: 'silent' }),
    getMessage: async key => ({ conversation: '...' }),
    browser: ["Ubuntu", "Chrome", "128.0.6613.86"]
  });

  console.log(`[BOT] Statut d'enregistrement : ${sock.authState.creds.registered ? '✅ Enregistré' : '❌ Non enregistré'}`);

  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER;
    if (phoneNumber) {
        console.log(`[BOT] Demande de code de pairage pour : ${phoneNumber}`);
        await delay(5000); // Wait a bit more for socket to stabilize
        try {
            const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
            console.log('==============================================================');
            console.log('VOTRE CODE DE PAIRAGE :');
            console.log(`➡️➡️➡️   ${code?.match(/.{1,4}/g)?.join('-') || code}   ⬅️⬅️⬅️`);
            console.log('==============================================================');
        } catch (e) {
            console.error('[BOT] Échec de la demande de code de pairage:', e.message);
            console.log('Assurez-vous que le numéro est au format international (ex: 33612345678)');
        }
    } else {
        console.warn("[BOT] PHONE_NUMBER manquant dans les variables d'environnement.");
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
