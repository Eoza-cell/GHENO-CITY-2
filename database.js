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
    defaultValue: 'New Gangster',
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
  hasMoneyBag: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  location: {
    type: DataTypes.STRING,
    defaultValue: 'Little Sicily',
  },
  drivingVehicleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  mode: {
    type: DataTypes.STRING,
    defaultValue: 'normal', // Can be 'normal' or 'action'
  },
});

const Vehicle = sequelize.define('Vehicle', {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },
  acceleration: { // Speed gained per second
    type: DataTypes.FLOAT,
    defaultValue: 5,
  },
  topSpeed: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  handling: { // Represents inertia, lower is better
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
  },
  price: {
    type: DataTypes.INTEGER,
    defaultValue: 10000,
  },
});

const PlayerVehicle = sequelize.define('PlayerVehicle', {
  damage: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  currentSpeed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

// Relationships
Player.hasMany(PlayerVehicle);
PlayerVehicle.belongsTo(Player);

Vehicle.hasMany(PlayerVehicle);
PlayerVehicle.belongsTo(Vehicle);

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');

    // Seed vehicles if the table is empty
    const vehicleCount = await Vehicle.count();
    if (vehicleCount === 0) {
      await Vehicle.bulkCreate([
        { name: 'Old Sedan', acceleration: 8, topSpeed: 120, handling: 1.2, price: 5000 },
        { name: 'Sports Coupe', acceleration: 15, topSpeed: 200, handling: 0.8, price: 25000 },
        { name: 'Heavy Truck', acceleration: 4, topSpeed: 90, handling: 1.8, price: 15000 },
      ]);
      console.log('Vehicle database seeded.');
    }
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

module.exports = {
  sequelize,
  Player,
  Vehicle,
  PlayerVehicle,
  setupDatabase,
};
