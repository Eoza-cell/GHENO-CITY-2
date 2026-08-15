const { Sequelize, DataTypes } = require('sequelize');

// Initialisation de la base de données SQLite locale pour plus de simplicité
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'bot-database.sqlite',
  logging: false,
});

// Modèle pour stocker la session d'authentification de WhatsApp (Baileys)
const Creds = sequelize.define('Creds', {
  key: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  value: {
    type: DataTypes.TEXT,
  },
});

// Modèle Utilisateur basique pour stocker les profils
const Player = sequelize.define('Player', {
  whatsappId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    defaultValue: 'Utilisateur',
  },
});

async function setupDatabase() {
  await sequelize.sync();
  console.log('[DATABASE] Base de données SQLite initialisée avec succès.');
}

module.exports = {
  sequelize,
  Creds,
  Player,
  setupDatabase,
};
