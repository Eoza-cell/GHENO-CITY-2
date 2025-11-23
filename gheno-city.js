const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Sequelize } = require('sequelize');
const { setupDatabase, Player, PlayerVehicle } = require('./database');
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

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '128.0.6613.86'],
    version: [2, 3000, 1025190524],
    getMessage: async key => {
        console.log('⚠️ Message non déchiffré, retry demandé:', key);
        return { conversation: '🔄 Réessaye d\'envoyer ton message' };
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('QR code:', qr);
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== 401;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('Connected to WhatsApp');
      startInactivePlayerHandler(sock);
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
