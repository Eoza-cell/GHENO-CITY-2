const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'gheno-basketball.sqlite',
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
    defaultValue: 'Rookie',
  },
  gems: {
    type: DataTypes.INTEGER,
    defaultValue: 300,
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  xp: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  energy: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  maxEnergy: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  lastActivity: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  registrationStep: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  mode: {
    type: DataTypes.STRING,
    defaultValue: 'normal',
  },
  pityCounter: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  }
});

const Card = sequelize.define('Card', {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },
  rarity: {
    type: DataTypes.STRING, // C, B, A, S, SS, ULT
  },
  type: {
    type: DataTypes.STRING, // Base, Prime, Playoff, Legendary, Alternate Timeline
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Stats 0-100
  shoot: { type: DataTypes.INTEGER },
  layup: { type: DataTypes.INTEGER },
  dunk: { type: DataTypes.INTEGER },
  dribble: { type: DataTypes.INTEGER },
  passe: { type: DataTypes.INTEGER },
  defense: { type: DataTypes.INTEGER },
  steal: { type: DataTypes.INTEGER },
  block: { type: DataTypes.INTEGER },
  speed: { type: DataTypes.INTEGER },
  stamina: { type: DataTypes.INTEGER },
  iq: { type: DataTypes.INTEGER },
  signatureSkillName: { type: DataTypes.STRING },
  signatureSkillDesc: { type: DataTypes.TEXT },
});

const PlayerCard = sequelize.define('PlayerCard', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  xp: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  awakening: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  limitBreak: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

const Team = sequelize.define('Team', {
  pgId: { type: DataTypes.INTEGER, allowNull: true },
  sgId: { type: DataTypes.INTEGER, allowNull: true },
  sfId: { type: DataTypes.INTEGER, allowNull: true },
  pfId: { type: DataTypes.INTEGER, allowNull: true },
  cId: { type: DataTypes.INTEGER, allowNull: true },
});

const Match = sequelize.define('Match', {
  playerAJid: { type: DataTypes.STRING },
  playerBJid: { type: DataTypes.STRING, allowNull: true },
  scoreA: { type: DataTypes.INTEGER, defaultValue: 0 },
  scoreB: { type: DataTypes.INTEGER, defaultValue: 0 },
  quarter: { type: DataTypes.INTEGER, defaultValue: 1 },
  timeRemaining: { type: DataTypes.STRING, defaultValue: '12:00' },
  momentumA: { type: DataTypes.INTEGER, defaultValue: 0 },
  momentumB: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'active' },
  location: { type: DataTypes.STRING, defaultValue: 'Stadium' },
});

const RPMessage = sequelize.define('RPMessage', {
    senderJid: { type: DataTypes.STRING },
    senderName: { type: DataTypes.STRING },
    content: { type: DataTypes.TEXT },
    matchId: { type: DataTypes.INTEGER, allowNull: true },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

// Relationships
Player.hasMany(PlayerCard);
PlayerCard.belongsTo(Player);

Card.hasMany(PlayerCard);
PlayerCard.belongsTo(Card);

Player.hasOne(Team);
Team.belongsTo(Player);

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Basketball Gacha Database connected.');
    await sequelize.sync({ alter: true });

    const cardCount = await Card.count();
    if (cardCount === 0) {
      console.log('Seeding 100 Basketball Players...');
      const playersToSeed = [
        // Legendary
        { name: 'Michael Jordan', rarity: 'ULT', type: 'Legendary', shoot: 95, layup: 98, dunk: 99, dribble: 92, passe: 85, defense: 98, steal: 95, block: 80, speed: 96, stamina: 99, iq: 99, signatureSkillName: 'Air Walk', signatureSkillDesc: 'Incontestable au dunk et hang-time infini.' },
        { name: 'Kobe Bryant', rarity: 'ULT', type: 'Legendary', shoot: 96, layup: 95, dunk: 90, dribble: 94, passe: 82, defense: 95, steal: 88, block: 70, speed: 92, stamina: 99, iq: 98, signatureSkillName: 'Mamba Mentality', signatureSkillDesc: 'Boost de stats massif en fin de match.' },
        { name: 'LeBron James', rarity: 'ULT', type: 'Legendary', shoot: 88, layup: 99, dunk: 98, dribble: 90, passe: 97, defense: 92, steal: 85, block: 88, speed: 94, stamina: 99, iq: 100, signatureSkillName: 'King Drive', signatureSkillDesc: 'Contact monstrueux en pénétration.' },
        { name: 'Stephen Curry', rarity: 'ULT', type: 'Prime', shoot: 100, layup: 92, dunk: 50, dribble: 99, passe: 95, defense: 75, steal: 85, block: 40, speed: 90, stamina: 95, iq: 97, signatureSkillName: 'Deep Range', signatureSkillDesc: 'Tirs logo possibles avec haute précision.' },
        { name: 'Shaquille O\'Neal', rarity: 'ULT', type: 'Legendary', shoot: 30, layup: 95, dunk: 100, dribble: 60, passe: 75, defense: 90, steal: 50, block: 98, speed: 75, stamina: 90, iq: 90, signatureSkillName: 'Black Tornado', signatureSkillDesc: 'Détruit la défense dans la raquette.' },
        { name: 'Victor Wembanyama', rarity: 'SS', type: 'Base', shoot: 85, layup: 90, dunk: 95, dribble: 85, passe: 80, defense: 97, steal: 80, block: 99, speed: 88, stamina: 85, iq: 92, signatureSkillName: 'Alien Wingspan', signatureSkillDesc: 'Énorme portée défensive et contres impossibles.' },
        { name: 'Kyrie Irving', rarity: 'SS', type: 'Prime', shoot: 92, layup: 99, dunk: 60, dribble: 100, passe: 88, defense: 70, steal: 82, block: 30, speed: 95, stamina: 90, iq: 95, signatureSkillName: 'Ankle Breaker', signatureSkillDesc: 'Peut faire tomber le défenseur sur un crossover.' },
        { name: 'Luka Doncic', rarity: 'SS', type: 'Base', shoot: 90, layup: 94, dunk: 75, dribble: 96, passe: 98, defense: 75, steal: 80, block: 50, speed: 85, stamina: 92, iq: 99, signatureSkillName: 'Stepback Master', signatureSkillDesc: 'Précision accrue sur les stepbacks à 3pts.' },
        { name: 'Kevin Durant', rarity: 'SS', type: 'Prime', shoot: 98, layup: 94, dunk: 88, dribble: 92, passe: 85, defense: 85, steal: 75, block: 82, speed: 88, stamina: 92, iq: 96, signatureSkillName: 'Slim Reaper', signatureSkillDesc: 'Tir au-dessus de n\'importe quel défenseur.' },
        { name: 'Giannis Antetokounmpo', rarity: 'SS', type: 'Base', shoot: 75, layup: 97, dunk: 99, dribble: 88, passe: 85, defense: 95, steal: 80, block: 92, speed: 94, stamina: 96, iq: 93, signatureSkillName: 'Greek Freak', signatureSkillDesc: 'Traverse le terrain en deux dribbles.' },
        // ... (I will add more players to reach ~100)
      ];

      // Batch generate some B/A/S players to reach 100
      const nbaNames = [
          'Nikola Jokic', 'Joel Embiid', 'Jayson Tatum', 'Anthony Davis', 'Jimmy Butler',
          'Kawhi Leonard', 'Damian Lillard', 'Ja Morant', 'Shai Gilgeous-Alexander', 'Devin Booker',
          'Donovan Mitchell', 'Anthony Edwards', 'Tyrese Haliburton', 'De\'Aaron Fox', 'Bam Adebayo',
          'Jaylen Brown', 'Jamal Murray', 'Trae Young', 'Paul George', 'James Harden',
          'Zion Williamson', 'Brandon Ingram', 'LaMelo Ball', 'Chet Holmgren', 'Paolo Banchero',
          'Alperen Sengun', 'Scottie Barnes', 'Tyrese Maxey', 'Cade Cunningham', 'Jalen Green',
          'Franz Wagner', 'Evan Mobley', 'Josh Giddey', 'Bennedict Mathurin', 'Keegan Murray',
          'Jabari Smith Jr.', 'Walker Kessler', 'Jalen Williams', 'Magic Johnson', 'Larry Bird',
          'Kareem Abdul-Jabbar', 'Wilt Chamberlain', 'Bill Russell', 'Tim Duncan', 'Hakeem Olajuwon',
          'Allen Iverson', 'Dwyane Wade', 'Kevin Garnett', 'Dirk Nowitzki', 'Charles Barkley',
          'Karl Malone', 'John Stockton', 'Scottie Pippen', 'Isiah Thomas', 'Julius Erving',
          'Jerry West', 'Elgin Baylor', 'Oscar Robertson', 'Chris Paul', 'Russell Westbrook',
          'Carmelo Anthony', 'Ray Allen', 'Reggie Miller', 'Vince Carter', 'Tracy McGrady',
          'Manu Ginobili', 'Tony Parker', 'Pau Gasol', 'Yao Ming', 'Dwight Howard',
          'Steve Nash', 'Jason Kidd', 'Gary Payton', 'Dominique Wilkins', 'Clyde Drexler',
          'Patrick Ewing', 'David Robinson', 'Alonzo Mourning', 'Dikembe Mutombo', 'Chris Webber',
          'Paul Pierce', 'Kevin Love', 'Kyrie Irving', 'Klay Thompson', 'Draymond Green',
          'Rudy Gobert', 'Domantas Sabonis', 'Mikal Bridges', 'Pascal Siakam', 'DeMar DeRozan',
          'Zach LaVine', 'Fred VanVleet', 'Dejounte Murray', 'Kristaps Porzingis', 'Myles Turner',
          'Aaron Gordon', 'Michael Porter Jr.', 'Marcus Smart', 'Jrue Holiday', 'Brook Lopez'
      ];

      for (const name of nbaNames) {
          if (playersToSeed.find(p => p.name === name)) continue;
          const randomRarity = ['B', 'B', 'B', 'A', 'A', 'S'][Math.floor(Math.random() * 6)];
          playersToSeed.push({
              name,
              rarity: randomRarity,
              type: 'Base',
              shoot: 70 + Math.floor(Math.random() * 25),
              layup: 70 + Math.floor(Math.random() * 25),
              dunk: 60 + Math.floor(Math.random() * 35),
              dribble: 70 + Math.floor(Math.random() * 25),
              passe: 60 + Math.floor(Math.random() * 35),
              defense: 60 + Math.floor(Math.random() * 35),
              steal: 50 + Math.floor(Math.random() * 45),
              block: 30 + Math.floor(Math.random() * 65),
              speed: 70 + Math.floor(Math.random() * 25),
              stamina: 80 + Math.floor(Math.random() * 15),
              iq: 75 + Math.floor(Math.random() * 20),
              signatureSkillName: 'Standard Talent',
              signatureSkillDesc: 'Une compétence de base.'
          });
      }

      await Card.bulkCreate(playersToSeed);
      console.log('Cards seeded.');
    }

  } catch (error) {
    console.error('Database connection error:', error);
  }
}

module.exports = {
  sequelize,
  Player,
  Card,
  PlayerCard,
  Team,
  Match,
  RPMessage,
  Creds,
  setupDatabase,
};
