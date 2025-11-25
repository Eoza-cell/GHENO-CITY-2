// Charger les variables d'environnement au tout début
require('dotenv').config();

// Vérification de la clé API Groq
if (!process.env.GROQ_API_KEY) {
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('!!! ERREUR : La clé API Groq est manquante.                  !!!');
  console.error('!!! Assurez-vous de créer un fichier .env et d\'y ajouter   !!!');
  console.error('!!! votre GROQ_API_KEY. Voir .env.example pour référence.    !!!');
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  process.exit(1);
}

const { default: makeWASocket, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Sequelize } = require('sequelize');
const { setupDatabase, Player, PlayerVehicle } = require('./database');
const { useDatabaseAuth } = require('./database-auth');
const { handleCommand } = require('./command-handler');
const { startInactivePlayerHandler } = require('./inactive-handler');

const GAME_TICK_RATE = 5000; // 5 seconds
const DAY_DURATION_MS = 30 * 60 * 1000; // 30 minutes

let gameTime = 0; // In-game time in milliseconds

function isDay() {
  const cyclePosition = gameTime / DAY_DURATION_MS;
  return cyclePosition % 1 < 0.5; // Day is the first half of the cycle
}

async function gameLoop(sock) {
  // Update game time
  gameTime += GAME_TICK_RATE;
  if (gameTime >= DAY_DURATION_MS) {
    gameTime = 0; // Reset after a full day
  }

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

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // QR code is no longer needed
    browser: ['Ubuntu', 'Chrome', '128.0.6613.86'],
    version: [2, 3000, 1025190524],
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
      startInactivePlayerHandler(sock);
      // Start the game loop only after a successful connection
      setInterval(() => gameLoop(sock), GAME_TICK_RATE);
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

module.exports = { isDay };
