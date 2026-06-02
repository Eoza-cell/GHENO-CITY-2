const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'gheno-basketball-gacha.sqlite',
  logging: false,
});

const Creds = sequelize.define('Creds', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.TEXT },
});

const Player = sequelize.define('Player', {
  whatsappId: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, defaultValue: 'Rookie' },
  gems: { type: DataTypes.INTEGER, defaultValue: 300 },
  pity: { type: DataTypes.INTEGER, defaultValue: 0 },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  xp: { type: DataTypes.INTEGER, defaultValue: 0 },

  // Game state
  matchEndTime: { type: DataTypes.DATE, allowNull: true },
  energy: { type: DataTypes.INTEGER, defaultValue: 100 },

  registrationStep: { type: DataTypes.STRING, allowNull: true },
});

const Card = sequelize.define('Card', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true },
  rarity: { type: DataTypes.STRING }, // C, B, A, S, SS, ULT
  type: { type: DataTypes.STRING }, // Base, Prime, Playoff, Legendary, Alternate
  imageUrl: { type: DataTypes.STRING, allowNull: true },

  // Stats
  shoot: { type: DataTypes.INTEGER },
  layup: { type: DataTypes.INTEGER },
  dunk: { type: DataTypes.INTEGER },
  dribble: { type: DataTypes.INTEGER },
  pass: { type: DataTypes.INTEGER },
  defense: { type: DataTypes.INTEGER },
  steal: { type: DataTypes.INTEGER },
  block: { type: DataTypes.INTEGER },
  speed: { type: DataTypes.INTEGER },
  stamina: { type: DataTypes.INTEGER },
  iq: { type: DataTypes.INTEGER },

  signatureSkill: { type: DataTypes.STRING },
});

const PlayerCard = sequelize.define('PlayerCard', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  isStarter: { type: DataTypes.BOOLEAN, defaultValue: false },
  position: { type: DataTypes.STRING, allowNull: true }, // PG, SG, SF, PF, C
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
    if (cardCount < 10) {
      const players = [
        // ULT
        { name: 'Stephen Curry', rarity: 'ULT', type: 'Prime', shoot: 99, layup: 90, dunk: 30, dribble: 98, pass: 95, defense: 70, steal: 85, block: 20, speed: 90, stamina: 92, iq: 99, signatureSkill: 'Deep Range', imageUrl: 'https://i.ibb.co/VWVvN7V/curry.jpg' },
        { name: 'LeBron James', rarity: 'ULT', type: 'Legendary', shoot: 85, layup: 98, dunk: 99, dribble: 90, pass: 96, defense: 90, steal: 80, block: 85, speed: 92, stamina: 98, iq: 100, signatureSkill: 'King Drive', imageUrl: 'https://i.ibb.co/60Zp3Bv/lebron.jpg' },
        { name: 'Michael Jordan', rarity: 'ULT', type: 'Legendary', shoot: 92, layup: 98, dunk: 99, dribble: 95, pass: 88, defense: 98, steal: 95, block: 85, speed: 96, stamina: 100, iq: 100, signatureSkill: 'Air Walk', imageUrl: 'https://i.ibb.co/XzB18V7/jordan.jpg' },
        { name: 'Kobe Bryant', rarity: 'ULT', type: 'Legendary', shoot: 95, layup: 94, dunk: 95, dribble: 92, pass: 85, defense: 95, steal: 88, block: 70, speed: 92, stamina: 99, iq: 98, signatureSkill: 'Mamba Mentality', imageUrl: 'https://i.ibb.co/60Zp3Bv/kobe.jpg' },
        { name: 'Shaquille O\'Neal', rarity: 'ULT', type: 'Legendary', shoot: 30, layup: 95, dunk: 99, dribble: 60, pass: 75, defense: 90, steal: 50, block: 98, speed: 75, stamina: 85, iq: 90, signatureSkill: 'Diesel Power', imageUrl: 'https://i.ibb.co/60Zp3Bv/shaq.jpg' },

        // SS
        { name: 'Kyrie Irving', rarity: 'SS', type: 'Prime', shoot: 90, layup: 99, dunk: 40, dribble: 99, pass: 92, defense: 65, steal: 82, block: 30, speed: 94, stamina: 88, iq: 95, signatureSkill: 'Ankle Breaker', imageUrl: 'https://i.ibb.co/qDzm8hM/kyrie.jpg' },
        { name: 'Kevin Durant', rarity: 'SS', type: 'Prime', shoot: 98, layup: 92, dunk: 90, dribble: 88, pass: 85, defense: 85, steal: 75, block: 88, speed: 85, stamina: 90, iq: 96, signatureSkill: 'Easy Money', imageUrl: 'https://i.ibb.co/qDzm8hM/kd.jpg' },
        { name: 'Giannis Antetokounmpo', rarity: 'SS', type: 'Prime', shoot: 75, layup: 98, dunk: 99, dribble: 85, pass: 82, defense: 96, steal: 80, block: 92, speed: 92, stamina: 96, iq: 90, signatureSkill: 'Greek Freak', imageUrl: 'https://i.ibb.co/qDzm8hM/giannis.jpg' },

        // S
        { name: 'Victor Wembanyama', rarity: 'S', type: 'Base', shoot: 82, layup: 88, dunk: 95, dribble: 75, pass: 78, defense: 96, steal: 75, block: 99, speed: 85, stamina: 85, iq: 92, signatureSkill: 'Alien Wingspan', imageUrl: 'https://i.ibb.co/R9Ym3N7/wemby.jpg' },
        { name: 'Luka Doncic', rarity: 'S', type: 'Base', shoot: 90, layup: 92, dunk: 70, dribble: 96, pass: 98, defense: 75, steal: 78, block: 40, speed: 80, stamina: 88, iq: 99, signatureSkill: 'Magic Luka', imageUrl: 'https://i.ibb.co/R9Ym3N7/luka.jpg' },
        { name: 'Ja Morant', rarity: 'S', type: 'Base', shoot: 80, layup: 96, dunk: 98, dribble: 94, pass: 88, defense: 70, steal: 82, block: 60, speed: 98, stamina: 90, iq: 88, signatureSkill: 'Posterizer', imageUrl: 'https://i.ibb.co/R9Ym3N7/ja.jpg' },

        // A
        { name: 'Klay Thompson', rarity: 'A', type: 'Base', shoot: 95, layup: 80, dunk: 60, dribble: 75, pass: 80, defense: 88, steal: 75, block: 50, speed: 82, stamina: 90, iq: 92, signatureSkill: 'Catch & Shoot', imageUrl: 'https://i.ibb.co/R9Ym3N7/klay.jpg' },
        { name: 'Draymond Green', rarity: 'A', type: 'Base', shoot: 70, layup: 75, dunk: 70, dribble: 78, pass: 92, defense: 98, steal: 88, block: 85, speed: 80, stamina: 92, iq: 99, signatureSkill: 'Defensive Anchor', imageUrl: 'https://i.ibb.co/R9Ym3N7/dray.jpg' },

        // B
        { name: 'Austin Reaves', rarity: 'B', type: 'Base', shoot: 82, layup: 85, dunk: 65, dribble: 82, pass: 82, defense: 75, steal: 75, block: 40, speed: 84, stamina: 85, iq: 88, signatureSkill: 'Clutch Hillbilly', imageUrl: 'https://i.ibb.co/R9Ym3N7/reaves.jpg' },

        // C
        { name: 'Alex Caruso', rarity: 'C', type: 'Base', shoot: 75, layup: 78, dunk: 80, dribble: 75, pass: 78, defense: 92, steal: 90, block: 60, speed: 88, stamina: 90, iq: 90, signatureSkill: 'Carushow', imageUrl: 'https://i.ibb.co/R9Ym3N7/caruso.jpg' },
      ];

      // Add more to reach 100 (automated generation for variety)
      const surnames = ['Johnson', 'Smith', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
      const firstnames = ['James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Joseph', 'Thomas', 'Christopher'];

      for (let i = 0; i < 85; i++) {
          const name = `${firstnames[i % 10]} ${surnames[Math.floor(i / 10) % 10]} ${i}`;
          if (players.find(p => p.name === name)) continue;
          const r = Math.random();
          let rarity = 'C';
          if (r < 0.05) rarity = 'S';
          else if (r < 0.2) rarity = 'A';
          else if (r < 0.5) rarity = 'B';

          players.push({
              name: name,
              rarity: rarity,
              type: 'Base',
              shoot: 50 + Math.floor(Math.random() * 40),
              layup: 50 + Math.floor(Math.random() * 40),
              dunk: 50 + Math.floor(Math.random() * 40),
              dribble: 50 + Math.floor(Math.random() * 40),
              pass: 50 + Math.floor(Math.random() * 40),
              defense: 50 + Math.floor(Math.random() * 40),
              steal: 40 + Math.floor(Math.random() * 40),
              block: 40 + Math.floor(Math.random() * 40),
              speed: 60 + Math.floor(Math.random() * 30),
              stamina: 70 + Math.floor(Math.random() * 30),
              iq: 60 + Math.floor(Math.random() * 40),
              signatureSkill: 'Standard Play',
              imageUrl: 'https://i.ibb.co/R9Ym3N7/default.jpg'
          });
      }

      for (const p of players) {
          await Card.findOrCreate({ where: { name: p.name }, defaults: p });
      }
    }
  } catch (e) { console.error(e); }
}

module.exports = { sequelize, Player, Card, PlayerCard, RPMessage, Creds, setupDatabase };
