const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'gheno-city.sqlite',
  logging: false,
});

const Player = sequelize.define('Player', {
  whatsappId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    defaultValue: 'Nouveau Joueur',
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  xp: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  money: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  health: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  strength: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  defense: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  agility: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  intelligence: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  chapter: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  quest: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  inventory: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      const rawValue = this.getDataValue('inventory');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('inventory', JSON.stringify(value));
    },
  },
  lastActivity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  lastInactiveMessageSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  mode: {
    type: DataTypes.STRING,
    defaultValue: 'normal', // Can be 'normal' or 'action'
  },
});

const Item = sequelize.define('Item', {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },
  price: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
});

const PlayerItem = sequelize.define('PlayerItem', {
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
});

// Relationships
Player.hasMany(PlayerItem);
PlayerItem.belongsTo(Player);

Item.hasMany(PlayerItem);
PlayerItem.belongsTo(Item);

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');

    // Seed items if the table is empty
    const itemCount = await Item.count();
    if (itemCount === 0) {
      await Item.bulkCreate([
        { name: 'Anneau de Vent', price: 100 },
        { name: 'Epée basique', price: 150 },
        { name: 'Potion de soin', price: 50 },
		{ name: 'Cristal de téléportation', price: 200 },
      ]);
      console.log('Item database seeded.');
    }
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

module.exports = {
  sequelize,
  Player,
  Item,
  PlayerItem,
  setupDatabase,
};
