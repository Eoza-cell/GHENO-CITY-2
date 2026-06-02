const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'gheno-football-career.sqlite',
  logging: false,
});

const Creds = sequelize.define('Creds', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.TEXT },
});

const Player = sequelize.define('Player', {
  whatsappId: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, defaultValue: 'Rookie' },

  // Stats
  shoot: { type: DataTypes.INTEGER, defaultValue: 40 },
  pass: { type: DataTypes.INTEGER, defaultValue: 40 },
  dribble: { type: DataTypes.INTEGER, defaultValue: 40 },
  defense: { type: DataTypes.INTEGER, defaultValue: 40 },
  speed: { type: DataTypes.INTEGER, defaultValue: 40 },
  power: { type: DataTypes.INTEGER, defaultValue: 40 },
  stamina: { type: DataTypes.INTEGER, defaultValue: 100 },
  iq: { type: DataTypes.INTEGER, defaultValue: 40 },
  goalkeeping: { type: DataTypes.INTEGER, defaultValue: 10 },

  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  xp: { type: DataTypes.INTEGER, defaultValue: 0 },

  // Career
  position: { type: DataTypes.STRING, allowNull: true },
  currentClub: { type: DataTypes.STRING, defaultValue: 'Centre de Formation' },
  nation: { type: DataTypes.STRING, defaultValue: 'France' },
  salary: { type: DataTypes.INTEGER, defaultValue: 500 },
  money: { type: DataTypes.INTEGER, defaultValue: 1000 },
  fame: { type: DataTypes.INTEGER, defaultValue: 0 },

  // Appearance
  appearanceImageUrl: { type: DataTypes.STRING, allowNull: true },

  // RP Time
  currentDay: { type: DataTypes.INTEGER, defaultValue: 1 },
  lastChronoUpdate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

  // Assets
  vehicles: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() { return JSON.parse(this.getDataValue('vehicles') || '[]'); },
    set(v) { this.setDataValue('vehicles', JSON.stringify(v)); }
  },
  properties: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() { return JSON.parse(this.getDataValue('properties') || '[]'); },
    set(v) { this.setDataValue('properties', JSON.stringify(v)); }
  },
  trophies: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() { return JSON.parse(this.getDataValue('trophies') || '[]'); },
    set(v) { this.setDataValue('trophies', JSON.stringify(v)); }
  },

  // Game State
  matchEndTime: { type: DataTypes.DATE, allowNull: true },
  mode: { type: DataTypes.STRING, defaultValue: 'normal' },
  registrationStep: { type: DataTypes.STRING, allowNull: true },
});

const NPC = sequelize.define('NPC', {
  name: { type: DataTypes.STRING, unique: true },
  role: { type: DataTypes.STRING },
  club: { type: DataTypes.STRING },
  stats: {
    type: DataTypes.TEXT,
    get() { return JSON.parse(this.getDataValue('stats') || '{}'); },
    set(v) { this.setDataValue('stats', JSON.stringify(v)); }
  }
});

const RPMessage = sequelize.define('RPMessage', {
    senderJid: { type: DataTypes.STRING },
    senderName: { type: DataTypes.STRING },
    content: { type: DataTypes.TEXT },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
  } catch (e) { console.error(e); }
}

module.exports = { sequelize, Player, NPC, RPMessage, Creds, setupDatabase };
