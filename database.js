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
  jerseyNumber: { type: DataTypes.INTEGER, defaultValue: 99 },
  currentClubId: { type: DataTypes.INTEGER, allowNull: true },
  nation: { type: DataTypes.STRING, defaultValue: 'France' },
  salary: { type: DataTypes.INTEGER, defaultValue: 500 },
  money: { type: DataTypes.INTEGER, defaultValue: 1000 },
  fame: { type: DataTypes.INTEGER, defaultValue: 0 },

  // Location
  country: { type: DataTypes.STRING, defaultValue: 'France' },
  city: { type: DataTypes.STRING, defaultValue: 'Paris' },
  location: { type: DataTypes.STRING, defaultValue: 'Hôtel' },

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

  // Game State
  matchEndTime: { type: DataTypes.DATE, allowNull: true },
  mode: { type: DataTypes.STRING, defaultValue: 'normal' },
  registrationStep: { type: DataTypes.STRING, allowNull: true },
});

const Club = sequelize.define('Club', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true },
  country: { type: DataTypes.STRING },
  league: { type: DataTypes.STRING },
  reputation: { type: DataTypes.INTEGER, defaultValue: 50 }, // 1-100
  formation: { type: DataTypes.STRING, defaultValue: '4-3-3' }
});

const Trophy = sequelize.define('Trophy', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING },
  type: { type: DataTypes.STRING }, // League, Cup, National
  year: { type: DataTypes.INTEGER },
  playerWhatsappId: { type: DataTypes.STRING }
});

const ContractOffer = sequelize.define('ContractOffer', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    playerWhatsappId: { type: DataTypes.STRING },
    clubId: { type: DataTypes.INTEGER },
    salary: { type: DataTypes.INTEGER },
    jerseyNumber: { type: DataTypes.INTEGER },
    status: { type: DataTypes.STRING, defaultValue: 'pending' } // pending, accepted, declined
});

const NPC = sequelize.define('NPC', {
  name: { type: DataTypes.STRING, unique: true },
  role: { type: DataTypes.STRING },
  clubId: { type: DataTypes.INTEGER, allowNull: true },
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

Player.belongsTo(Club, { as: 'currentClub', foreignKey: 'currentClubId' });
Club.hasMany(Player, { foreignKey: 'currentClubId' });

ContractOffer.belongsTo(Club, { foreignKey: 'clubId' });
Player.hasMany(ContractOffer, { foreignKey: 'playerWhatsappId' });

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const clubCount = await Club.count();
    if (clubCount === 0) {
        await Club.bulkCreate([
            { name: 'Paris Saint-Germain', country: 'France', league: 'Ligue 1', reputation: 85, formation: '4-3-3' },
            { name: 'Real Madrid', country: 'Espagne', league: 'La Liga', reputation: 95, formation: '4-3-3' },
            { name: 'Manchester City', country: 'Angleterre', league: 'Premier League', reputation: 92, formation: '4-1-4-1' },
            { name: 'Club de Formation', country: 'France', league: 'National', reputation: 20, formation: '4-4-2' }
        ]);
    }
  } catch (e) { console.error(e); }
}

module.exports = { sequelize, Player, Club, Trophy, ContractOffer, NPC, RPMessage, Creds, setupDatabase };
