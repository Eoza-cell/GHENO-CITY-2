const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'chivalern.sqlite',
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
  nom: {
    type: DataTypes.STRING,
  },
  prenom: {
    type: DataTypes.STRING,
  },
  surnom: {
    type: DataTypes.STRING,
    defaultValue: 'Aucun',
  },
  titreNoblesse: {
    type: DataTypes.STRING,
    defaultValue: 'Aucun',
  },
  villeActuelle: {
    type: DataTypes.STRING,
    defaultValue: 'Praven',
  },
  villeOrigine: {
    type: DataTypes.STRING,
    defaultValue: 'Praven',
  },
  age: {
    type: DataTypes.INTEGER,
    defaultValue: 18,
  },
  taille: {
    type: DataTypes.STRING,
    defaultValue: '1m70',
  },
  roliste: {
    type: DataTypes.STRING,
  },
  rang: {
    type: DataTypes.STRING,
    defaultValue: 'Civil/Paysan',
  },
  serment: {
    type: DataTypes.STRING,
    defaultValue: 'Aucun',
  },
  allegeance: {
    type: DataTypes.STRING,
    defaultValue: 'Aucun',
  },
  regionFief: {
    type: DataTypes.STRING,
    defaultValue: 'Aucune',
  },
  maitreDArmes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  puissanceDeTension: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  puissanceDeJet: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  bouclier: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  athletisme: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  equitation: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  archerieMontee: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  pistage: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  reperage: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  ingenierie: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  commandement: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  soinsDesBlessures: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  argent: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  items: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      const rawValue = this.getDataValue('items');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('items', JSON.stringify(value));
    },
  },
});

const ActiveGroup = sequelize.define('ActiveGroup', {
    groupId: {
        type: DataTypes.STRING,
        primaryKey: true,
    }
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
  ActiveGroup,
  setupDatabase,
};
