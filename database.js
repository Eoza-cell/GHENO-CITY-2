const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'gheno-football-pro.sqlite',
  logging: false,
});

const Creds = sequelize.define('Creds', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.TEXT },
});

const Player = sequelize.define('Player', {
  whatsappId: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, defaultValue: 'Rookie' },

  // Basketball/Football Stats (adapted to Football as per latest)
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

  position: { type: DataTypes.STRING, allowNull: true },
  currentClub: { type: DataTypes.STRING, defaultValue: 'Sans club' },
  country: { type: DataTypes.STRING, defaultValue: 'France' },
  money: { type: DataTypes.INTEGER, defaultValue: 1000 },
  fame: { type: DataTypes.INTEGER, defaultValue: 0 },

  careerStage: { type: DataTypes.STRING, defaultValue: 'prologue' }, // prologue, pro, legend
  contractDays: { type: DataTypes.INTEGER, defaultValue: 0 },
  sponsor: { type: DataTypes.STRING, defaultValue: 'Aucun' },

  appearanceImageUrl: { type: DataTypes.STRING, allowNull: true },
  location: { type: DataTypes.STRING, defaultValue: 'Centre d\'entraînement' },

  vehicles: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() { return JSON.parse(this.getDataValue('vehicles') || '[]'); },
    set(v) { this.setDataValue('vehicles', JSON.stringify(v)); }
  },
  companies: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() { return JSON.parse(this.getDataValue('companies') || '[]'); },
    set(v) { this.setDataValue('companies', JSON.stringify(v)); }
  },
  trophies: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() { return JSON.parse(this.getDataValue('trophies') || '[]'); },
    set(v) { this.setDataValue('trophies', JSON.stringify(v)); }
  },

  registrationStep: { type: DataTypes.STRING, allowNull: true },
  mode: { type: DataTypes.STRING, defaultValue: 'normal' },
  matchEndTime: { type: DataTypes.DATE, allowNull: true },
  lastActivity: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

const Card = sequelize.define('Card', {
  name: { type: DataTypes.STRING, unique: true },
  rarity: { type: DataTypes.STRING }, // C, B, A, S, SS, ULT
  type: { type: DataTypes.STRING }, // Base, Prime, Playoff, Legendary
  imageUrl: { type: DataTypes.STRING, allowNull: true },
  shoot: { type: DataTypes.INTEGER },
  pass: { type: DataTypes.INTEGER },
  dribble: { type: DataTypes.INTEGER },
  defense: { type: DataTypes.INTEGER },
  speed: { type: DataTypes.INTEGER },
  power: { type: DataTypes.INTEGER },
  stamina: { type: DataTypes.INTEGER },
  iq: { type: DataTypes.INTEGER },
  goalkeeping: { type: DataTypes.INTEGER },
  signatureSkill: { type: DataTypes.STRING },
});

const PlayerCard = sequelize.define('PlayerCard', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  level: { type: DataTypes.INTEGER, defaultValue: 1 }
});

const RPMessage = sequelize.define('RPMessage', {
    senderJid: { type: DataTypes.STRING },
    senderName: { type: DataTypes.STRING },
    content: { type: DataTypes.TEXT },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

Player.hasMany(PlayerCard);
PlayerCard.belongsTo(Player);
Card.hasMany(PlayerCard);
PlayerCard.belongsTo(Card);

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const cardCount = await Card.count();
    if (cardCount === 0) {
      await Card.bulkCreate([
        { name: 'Lionel Messi', rarity: 'ULT', type: 'Legendary', shoot: 95, pass: 98, dribble: 99, defense: 40, speed: 85, power: 70, stamina: 80, iq: 100, goalkeeping: 10, signatureSkill: 'Génie' },
        { name: 'Cristiano Ronaldo', rarity: 'ULT', type: 'Legendary', shoot: 98, pass: 82, dribble: 88, defense: 35, speed: 90, power: 95, stamina: 95, iq: 95, goalkeeping: 10, signatureSkill: 'Siuuuu' },
        { name: 'Kylian Mbappé', rarity: 'SS', type: 'Base', shoot: 92, pass: 80, dribble: 94, defense: 40, speed: 99, power: 85, stamina: 90, iq: 92, goalkeeping: 10, signatureSkill: 'Flash' }
      ]);
    }
  } catch (e) { console.error(e); }
}

module.exports = { sequelize, Player, Card, PlayerCard, RPMessage, Creds, setupDatabase };
