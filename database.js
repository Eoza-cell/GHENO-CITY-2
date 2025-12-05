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
    characterDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
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
    profilePicPath: {
      type: DataTypes.STRING,
      allowNull: true,
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
    type: DataTypes.FLOAT,
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
        { name: 'Rizeo Mini-K1', price: 9500, acceleration: 9.36, topSpeed: 147, inertia: 1.19, brakePower: 6.05 },
        { name: 'Zotara Pico SX', price: 11200, acceleration: 9.24, topSpeed: 150, inertia: 1.28, brakePower: 5.63 },
        { name: 'Felion Pocket GT', price: 13800, acceleration: 8.88, topSpeed: 147, inertia: 1.1, brakePower: 6.11 },
        { name: 'Miero 200', price: 8000, acceleration: 9.47, topSpeed: 146, inertia: 1.17, brakePower: 6.94 },
        { name: 'Kumi ShortRide', price: 10500, acceleration: 9.31, topSpeed: 130, inertia: 1.12, brakePower: 6.04 },
        { name: 'Polaro Lite', price: 6900, acceleration: 9.14, topSpeed: 144, inertia: 1.4, brakePower: 6.21 },
        { name: 'Cinetta N12', price: 7800, acceleration: 9.81, topSpeed: 142, inertia: 1.27, brakePower: 6.73 },
        { name: 'Velto Citybug', price: 12700, acceleration: 8.99, topSpeed: 132, inertia: 1.36, brakePower: 6.55 },
        { name: 'Haimu Slice', price: 14200, acceleration: 9.57, topSpeed: 145, inertia: 1.37, brakePower: 5.26 },
        { name: 'Fretto Curve', price: 9100, acceleration: 8.42, topSpeed: 148, inertia: 1.31, brakePower: 5.91 },
        { name: 'Dorian U6', price: 8800, acceleration: 8.73, topSpeed: 132, inertia: 1.26, brakePower: 6.52 },
        { name: 'Optera V5', price: 15900, acceleration: 8.96, topSpeed: 143, inertia: 1.49, brakePower: 5.38 },
        { name: 'Lynko Simplex', price: 9400, acceleration: 9.89, topSpeed: 136, inertia: 1.46, brakePower: 6.89 },
        { name: 'Orbitron I3', price: 11300, acceleration: 8.85, topSpeed: 131, inertia: 1.24, brakePower: 6.98 },
        { name: 'Brento ShortStar', price: 14950, acceleration: 9.99, topSpeed: 136, inertia: 1.24, brakePower: 6.03 },
        { name: 'Calvio Bee', price: 6200, acceleration: 8.9, topSpeed: 136, inertia: 1.32, brakePower: 5.88 },
        { name: 'Neon Koco', price: 12250, acceleration: 8.86, topSpeed: 148, inertia: 1.32, brakePower: 5.01 },
        { name: 'Kestra J7', price: 13500, acceleration: 9.27, topSpeed: 147, inertia: 1.28, brakePower: 5.58 },
        { name: 'Amini Cuto', price: 16200, acceleration: 9.27, topSpeed: 136, inertia: 1.26, brakePower: 6.82 },
        { name: 'Pento MicroWave', price: 7400, acceleration: 9.71, topSpeed: 140, inertia: 1.37, brakePower: 6.6 },
        { name: 'Fluto CityCup', price: 11750, acceleration: 9.27, topSpeed: 131, inertia: 1.47, brakePower: 5.13 },
        { name: 'Denzo Pocket 2', price: 9900, acceleration: 8.64, topSpeed: 133, inertia: 1.41, brakePower: 6.09 },
        { name: 'Rado Nano V', price: 13200, acceleration: 9.64, topSpeed: 135, inertia: 1.15, brakePower: 5.79 },
        { name: 'Vista C-Lite', price: 10050, acceleration: 8.3, topSpeed: 141, inertia: 1.49, brakePower: 5.44 },
        { name: 'Lixio Ball', price: 6300, acceleration: 9.91, topSpeed: 138, inertia: 1.12, brakePower: 6.8 },
        { name: 'Xento SlimDrive', price: 16800, acceleration: 9.79, topSpeed: 149, inertia: 1.14, brakePower: 6.81 },
        { name: 'Piko C-Class', price: 14800, acceleration: 9.68, topSpeed: 140, inertia: 1.13, brakePower: 6.99 },
        { name: 'Alovero Clip', price: 11050, acceleration: 8.01, topSpeed: 141, inertia: 1.15, brakePower: 5.73 },
        { name: 'Quarra Shori', price: 8400, acceleration: 9.14, topSpeed: 134, inertia: 1.38, brakePower: 6.31 },
        { name: 'Verona MiniSport', price: 21700, acceleration: 9.11, topSpeed: 143, inertia: 1.24, brakePower: 5.45 },
        { name: 'Fuzeko Y-Zero', price: 12300, acceleration: 8.41, topSpeed: 132, inertia: 1.15, brakePower: 6.75 },
        { name: 'Zilko 22', price: 10750, acceleration: 9.36, topSpeed: 150, inertia: 1.26, brakePower: 5.68 },
        { name: 'Eosmo MiniWing', price: 18600, acceleration: 8.27, topSpeed: 148, inertia: 1.38, brakePower: 5.48 },
        { name: 'Zerko Quick', price: 11880, acceleration: 8.14, topSpeed: 136, inertia: 1.23, brakePower: 5.68 },
        { name: 'Rosset MiniLift', price: 15700, acceleration: 8.94, topSpeed: 139, inertia: 1.37, brakePower: 5.75 },
        { name: 'Tetra Pop', price: 4800, acceleration: 8.14, topSpeed: 148, inertia: 1.19, brakePower: 6.2 },
        { name: 'Moita Cube', price: 7600, acceleration: 8.63, topSpeed: 132, inertia: 1.24, brakePower: 6.81 },
        { name: 'Nevia ShortCut', price: 13950, acceleration: 8.87, topSpeed: 147, inertia: 1.41, brakePower: 6.5 },
        { name: 'Kera Kibe', price: 9000, acceleration: 8.35, topSpeed: 144, inertia: 1.42, brakePower: 6.93 },
        { name: 'Novar Fuze', price: 17400, acceleration: 9.46, topSpeed: 147, inertia: 1.49, brakePower: 5.96 },
        { name: 'Votto A3', price: 12600, acceleration: 8.81, topSpeed: 144, inertia: 1.15, brakePower: 5.22 },
        { name: 'Fento CityFlex', price: 18150, acceleration: 8.49, topSpeed: 140, inertia: 1.1, brakePower: 6.48 },
        { name: 'Miko Hop', price: 5300, acceleration: 8.84, topSpeed: 133, inertia: 1.49, brakePower: 6.84 },
        { name: 'Hestro 4Z', price: 16900, acceleration: 8.07, topSpeed: 136, inertia: 1.22, brakePower: 6.86 },
        { name: 'Nilka 100', price: 6900, acceleration: 8.71, topSpeed: 132, inertia: 1.36, brakePower: 5.19 },
        { name: 'Virex MiniSport Turbo', price: 32000, acceleration: 9.94, topSpeed: 148, inertia: 1.41, brakePower: 6.58 },
        { name: 'Bolto Q-Drive', price: 14550, acceleration: 8.42, topSpeed: 140, inertia: 1.43, brakePower: 5.97 },
        { name: 'Ketro NanoSpeed', price: 22400, acceleration: 9.64, topSpeed: 132, inertia: 1.48, brakePower: 6.73 },
        { name: 'Solvino MiniS', price: 19100, acceleration: 8.93, topSpeed: 134, inertia: 1.49, brakePower: 5.94 },
        { name: 'Jaro XP-One', price: 24500, acceleration: 9.45, topSpeed: 146, inertia: 1.33, brakePower: 6.28 },
        // Sedans
        { name: 'Amperon Classico', price: 44000, acceleration: 10.31, topSpeed: 164, inertia: 1.67, brakePower: 6.53 },
        { name: 'Fereno L4', price: 47600, acceleration: 11.78, topSpeed: 171, inertia: 1.52, brakePower: 6.93 },
        { name: 'Vastelon Solis', price: 53800, acceleration: 10.26, topSpeed: 161, inertia: 1.63, brakePower: 6.15 },
        { name: 'Grelios Prime', price: 61200, acceleration: 11.59, topSpeed: 166, inertia: 1.64, brakePower: 7.2 },
        { name: 'Rante Core-Sedan', price: 49900, acceleration: 11.29, topSpeed: 170, inertia: 1.72, brakePower: 6.26 },
        { name: 'Silvera Glow', price: 55700, acceleration: 10.67, topSpeed: 163, inertia: 1.52, brakePower: 7.6 },
        { name: 'Krono Luxury 500', price: 132000, acceleration: 10.33, topSpeed: 169, inertia: 1.6, brakePower: 6.12 },
        { name: 'Opex Diana', price: 88400, acceleration: 10.18, topSpeed: 179, inertia: 1.6, brakePower: 6.72 },
        { name: 'Revero Monarch', price: 97600, acceleration: 10.71, topSpeed: 165, inertia: 1.74, brakePower: 6.07 },
        { name: 'Delano M Prestige', price: 120000, acceleration: 10.41, topSpeed: 166, inertia: 1.54, brakePower: 6.32 },
        { name: 'Molion R-Sede', price: 75200, acceleration: 10.6, topSpeed: 168, inertia: 1.55, brakePower: 7.53 },
        { name: 'Zestra Black', price: 110000, acceleration: 10.38, topSpeed: 166, inertia: 1.49, brakePower: 7.26 },
        { name: 'Nova Orion', price: 86700, acceleration: 11.65, topSpeed: 176, inertia: 1.58, brakePower: 6.63 },
        { name: 'Pentatec Elegance', price: 103900, acceleration: 11.42, topSpeed: 176, inertia: 1.79, brakePower: 7.88 },
        { name: 'Doral S7', price: 56300, acceleration: 11.53, topSpeed: 163, inertia: 1.54, brakePower: 7.93 },
        { name: 'Sorivo Saint', price: 149500, acceleration: 11.54, topSpeed: 177, inertia: 1.42, brakePower: 6.6 },
        { name: 'Astra Dynor', price: 80300, acceleration: 10.83, topSpeed: 169, inertia: 1.58, brakePower: 6.92 },
        { name: 'Valiance RoadKing', price: 92000, acceleration: 10.18, topSpeed: 168, inertia: 1.41, brakePower: 6.32 },
        { name: 'Elexus NV-8', price: 170400, acceleration: 11.51, topSpeed: 173, inertia: 1.63, brakePower: 6.49 },
        { name: 'Korvel 12', price: 71800, acceleration: 11.05, topSpeed: 174, inertia: 1.44, brakePower: 6.73 },
        { name: 'Stellon Imperia', price: 119600, acceleration: 10.9, topSpeed: 180, inertia: 1.67, brakePower: 7.82 },
        { name: 'Kairo Opulence', price: 178000, acceleration: 10.88, topSpeed: 177, inertia: 1.62, brakePower: 6.81 },
        { name: 'Ferano WhiteRose', price: 142700, acceleration: 10.16, topSpeed: 169, inertia: 1.42, brakePower: 6.04 },
        { name: 'Dalton R8', price: 84400, acceleration: 11.4, topSpeed: 169, inertia: 1.64, brakePower: 6.82 },
        { name: 'Rimega Cloud', price: 66100, acceleration: 11.15, topSpeed: 177, inertia: 1.48, brakePower: 7.86 },
        { name: 'Nembrio Palace', price: 108300, acceleration: 11.69, topSpeed: 162, inertia: 1.68, brakePower: 7.6 },
        { name: 'Arturo S-Prime', price: 154200, acceleration: 11.42, topSpeed: 171, inertia: 1.63, brakePower: 6.45 },
        { name: 'Helico Marchéon', price: 148200, acceleration: 11.07, topSpeed: 169, inertia: 1.78, brakePower: 7.68 },
        { name: 'Xevo Coronado', price: 176600, acceleration: 11.93, topSpeed: 170, inertia: 1.4, brakePower: 7.27 },
        { name: 'Ivento Solaris', price: 152900, acceleration: 11.01, topSpeed: 165, inertia: 1.72, brakePower: 6.11 },
        { name: 'Presto Luma', price: 95700, acceleration: 10.54, topSpeed: 164, inertia: 1.67, brakePower: 6.14 },
        { name: 'Nilo Sovereign', price: 138000, acceleration: 10.97, topSpeed: 169, inertia: 1.54, brakePower: 6.14 },
        { name: 'Brava NightLegend', price: 172900, acceleration: 10.2, topSpeed: 162, inertia: 1.71, brakePower: 6.45 },
        { name: 'Solaris M4', price: 78700, acceleration: 11.91, topSpeed: 169, inertia: 1.43, brakePower: 7.1 },
        { name: 'Rios Omega', price: 145300, acceleration: 10.96, topSpeed: 163, inertia: 1.54, brakePower: 6.31 },
        { name: 'Portello Perfect', price: 121000, acceleration: 10.36, topSpeed: 175, inertia: 1.73, brakePower: 7.63 },
        { name: 'Kekto RoadLux', price: 63600, acceleration: 11.35, topSpeed: 176, inertia: 1.59, brakePower: 6.71 },
        { name: 'Metrion Class-S', price: 164800, acceleration: 11.21, topSpeed: 172, inertia: 1.63, brakePower: 7.62 },
        { name: 'Zokian Flair', price: 73500, acceleration: 10.9, topSpeed: 162, inertia: 1.73, brakePower: 7.28 },
        { name: 'Driftel Royce', price: 189000, acceleration: 10.46, topSpeed: 175, inertia: 1.52, brakePower: 7.05 },
        { name: 'Haizon 800', price: 130600, acceleration: 11.11, topSpeed: 171, inertia: 1.69, brakePower: 7.23 },
        { name: 'Esparo Violette', price: 68200, acceleration: 10.93, topSpeed: 165, inertia: 1.64, brakePower: 6.65 },
        { name: 'Kallisto Vision', price: 134900, acceleration: 10.63, topSpeed: 165, inertia: 1.49, brakePower: 7.22 },
        { name: 'Savora Crest', price: 169200, acceleration: 10.95, topSpeed: 166, inertia: 1.75, brakePower: 6.12 },
        { name: 'Oscaro Triumph', price: 146500, acceleration: 10.32, topSpeed: 166, inertia: 1.57, brakePower: 6.83 },
        { name: 'Vesper deLuxe', price: 125300, acceleration: 11.92, topSpeed: 176, inertia: 1.67, brakePower: 7.75 },
        { name: 'Lexona M-Class', price: 184000, acceleration: 11.77, topSpeed: 166, inertia: 1.45, brakePower: 6.3 },
        { name: 'Helix Hallmark', price: 178700, acceleration: 10.02, topSpeed: 170, inertia: 1.46, brakePower: 7.28 },
        { name: 'Allero Centurion', price: 149900, acceleration: 10.18, topSpeed: 171, inertia: 1.66, brakePower: 7.67 },
        { name: 'Vastella Edition One', price: 183600, acceleration: 10.56, topSpeed: 163, inertia: 1.58, brakePower: 6.13 },
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
  Creds,
  setupDatabase,
};
