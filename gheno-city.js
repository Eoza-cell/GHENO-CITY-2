// Charger les variables d'environnement au tout début
require('dotenv').config();

// Note : La vérification pour GROQ_API_KEY a été supprimée car le bot utilise maintenant Pollination AI.

const http = require('http');
const { default: makeWASocket, delay, downloadMediaMessage, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Sequelize } = require('sequelize');
const { setupDatabase, Player, PlayerVehicle } = require('./database');
const { useDatabaseAuth } = require('./database-auth');
const { handleCommand } = require('./command-handler');
const { startInactivePlayerCheck } = require('./inactive-handler');
const { startDayNightCycle } = require('./game-state');

// Crée un serveur HTTP minimaliste pour répondre aux contrôles de santé de Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running');
});
const PORT = process.env.PORT || 3000;
let serverStarted = false;

const GAME_TICK_RATE = 5000; // 5 seconds

async function gameLoop(sock) {
  // Friction
  const drivingPlayers = await Player.findAll({ where: { drivingVehicleId: { [Sequelize.Op.ne]: null } } });
  for (const player of drivingPlayers) {
    const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId);
    if (playerVehicle && playerVehicle.currentSpeed > 0) {
      const newSpeed = playerVehicle.currentSpeed - 1; // Simple friction
      await playerVehicle.update({ currentSpeed: newSpeed < 0 ? 0 : newSpeed });
    }
  }
}

async function connectToWhatsApp() {
  await setupDatabase();

  const { state, saveCreds } = await useDatabaseAuth();

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Utilisation de la version Baileys v${version.join('.')} (Dernière version : ${isLatest})`);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // QR code is no longer needed
    browser: ['Ubuntu', 'Chrome', '128.0.6613.86'],
    version,
    logger: pino({ level: 'silent' }), // Suppress verbose logging
    getMessage: async key => {
        console.log('⚠️ Message non déchiffré, retry demandé:', key);
        return { conversation: '🔄 Réessaye d\'envoyer ton message' };
    }
  });

  // Handle pairing code logic
  if (!sock.authState.creds.registered) {
    const phoneNumber = process.env.PHONE_NUMBER;
    if (!phoneNumber) {
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error('!!! ERREUR : Le numéro de téléphone n\'est pas configuré.   !!!');
      console.error('!!! Définissez la variable d\'environnement PHONE_NUMBER.   !!!');
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      process.exit(1);
    }

    await delay(1500); // Small delay to ensure the socket is ready
    console.log('Demande du code de pairage...');
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('==============================================================');
      console.log('Votre code de pairage Gheno City 2 :');
      console.log(`➡️➡️➡️   ${code?.match(/.{1,4}/g)?.join('-') || code}   ⬅️⬅️⬅️`);
      console.log('==============================================================');
      console.log('Ouvrez WhatsApp sur votre téléphone, allez dans "Appareils connectés" > "Connecter un appareil" et entrez ce code.');
    } catch (error) {
      console.error('Impossible de demander le code de pairage :', error);
      process.exit(1);
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== 401;
      console.log('Connection fermée à cause de :', lastDisconnect.error, ', reconnexion:', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('Connecté à WhatsApp');
      startInactivePlayerCheck(sock);
      startDayNightCycle();
      // Start the game loop only after a successful connection
      setInterval(() => gameLoop(sock), GAME_TICK_RATE);

      // Démarre le serveur HTTP uniquement si ce n'est pas déjà fait
      if (!serverStarted) {
          server.listen(PORT, () => {
              console.log(`Server listening on port ${PORT} for Render health checks.`);
              serverStarted = true;
          });
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    m.messages.forEach(async (message) => {
      if (!message.message) return;
      handleCommand(sock, message, downloadMediaMessage);
    });
  });
}

connectToWhatsApp();
