const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'gheno-city.sqlite',
  logging: false,
});

const Creds = sequelize.define('Creds', {
  key: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  value: {
    type: DataTypes.TEXT,
  },
});

const Player = sequelize.define('Player', {
  whatsappId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    defaultValue: 'Utilisateur',
  },
  mana: { // Used as energy/action points for the referee
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  maxMana: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  paveStatus: {
    type: DataTypes.STRING,
    defaultValue: 'idle', // 'idle', 'writing'
  },
  paveMessageKey: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  registrationStep: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastActivity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

module.exports = {
  sequelize,
  Player,
  Creds,
  setupDatabase,
};
