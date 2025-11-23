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
  inertia: { // Higher is worse
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
  },
  brakePower: {
    type: DataTypes.FLOAT,
    defaultValue: 5,
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
  engineHealth: { // 100 is perfect, 0 is destroyed
    type: DataTypes.FLOAT,
    defaultValue: 100,
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
        // Compacts
        { name: 'Rizeo Mini-K1', price: 9500, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Zotara Pico SX', price: 11200, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Felion Pocket GT', price: 13800, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Miero 200', price: 8000, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Kumi ShortRide', price: 10500, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Polaro Lite', price: 6900, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Cinetta N12', price: 7800, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Velto Citybug', price: 12700, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Haimu Slice', price: 14200, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Fretto Curve', price: 9100, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Dorian U6', price: 8800, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Optera V5', price: 15900, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Lynko Simplex', price: 9400, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Orbitron I3', price: 11300, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Brento ShortStar', price: 14950, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Calvio Bee', price: 6200, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Neon Koco', price: 12250, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Kestra J7', price: 13500, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Amini Cuto', price: 16200, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Pento MicroWave', price: 7400, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Fluto CityCup', price: 11750, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Denzo Pocket 2', price: 9900, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Rado Nano V', price: 13200, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Vista C-Lite', price: 10050, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Lixio Ball', price: 6300, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Xento SlimDrive', price: 16800, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Piko C-Class', price: 14800, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Alovero Clip', price: 11050, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Quarra Shori', price: 8400, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Verona MiniSport', price: 21700, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Fuzeko Y-Zero', price: 12300, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Zilko 22', price: 10750, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Eosmo MiniWing', price: 18600, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Zerko Quick', price: 11880, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Rosset MiniLift', price: 15700, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Tetra Pop', price: 4800, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Moita Cube', price: 7600, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Nevia ShortCut', price: 13950, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Kera Kibe', price: 9000, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Novar Fuze', price: 17400, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Votto A3', price: 12600, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Fento CityFlex', price: 18150, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Miko Hop', price: 5300, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Hestro 4Z', price: 16900, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Nilka 100', price: 6900, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Virex MiniSport Turbo', price: 32000, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Bolto Q-Drive', price: 14550, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Ketro NanoSpeed', price: 22400, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Solvino MiniS', price: 19100, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        { name: 'Jaro XP-One', price: 24500, acceleration: 9, topSpeed: 140, inertia: 1.3, brakePower: 6 },
        // Sedans
        { name: 'Amperon Classico', price: 44000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Fereno L4', price: 47600, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Vastelon Solis', price: 53800, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Grelios Prime', price: 61200, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Rante Core-Sedan', price: 49900, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Silvera Glow', price: 55700, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Krono Luxury 500', price: 132000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Opex Diana', price: 88400, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Revero Monarch', price: 97600, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Delano M Prestige', price: 120000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Molion R-Sede', price: 75200, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Zestra Black', price: 110000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Nova Orion', price: 86700, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Pentatec Elegance', price: 103900, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Doral S7', price: 56300, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Sorivo Saint', price: 149500, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Astra Dynor', price: 80300, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Valiance RoadKing', price: 92000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Elexus NV-8', price: 170400, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Korvel 12', price: 71800, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Stellon Imperia', price: 119600, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Kairo Opulence', price: 178000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Ferano WhiteRose', price: 142700, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Dalton R8', price: 84400, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Rimega Cloud', price: 66100, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Nembrio Palace', price: 108300, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Arturo S-Prime', price: 154200, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Helico Marchéon', price: 148200, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Xevo Coronado', price: 176600, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Ivento Solaris', price: 152900, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Presto Luma', price: 95700, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Nilo Sovereign', price: 138000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Brava NightLegend', price: 172900, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Solaris M4', price: 78700, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Rios Omega', price: 145300, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Portello Perfect', price: 121000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Kekto RoadLux', price: 63600, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Metrion Class-S', price: 164800, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Zokian Flair', price: 73500, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Driftel Royce', price: 189000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Haizon 800', price: 130600, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Esparo Violette', price: 68200, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Kallisto Vision', price: 134900, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Savora Crest', price: 169200, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Oscaro Triumph', price: 146500, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Vesper deLuxe', price: 125300, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Lexona M-Class', price: 184000, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Helix Hallmark', price: 178700, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Allero Centurion', price: 149900, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
        { name: 'Vastella Edition One', price: 183600, acceleration: 11, topSpeed: 170, inertia: 1.6, brakePower: 7 },
      ]);
      console.log('Vehicle database seeded with 100 vehicles.');
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
