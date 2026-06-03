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

const User = sequelize.define('User', {
  whatsappId: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, defaultValue: 'Rookie' },
  gems: { type: DataTypes.INTEGER, defaultValue: 300 },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  xp: { type: DataTypes.INTEGER, defaultValue: 0 },
  fame: { type: DataTypes.INTEGER, defaultValue: 0 },
  mode: { type: DataTypes.STRING, defaultValue: 'normal' }, // normal or action
  registrationStep: { type: DataTypes.STRING, allowNull: true },
  lastChronoUpdate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  pendingMatchAction: { type: DataTypes.BOOLEAN, defaultValue: false },
  lastMatchActionTime: { type: DataTypes.DATE, allowNull: true },
});

const BasketballPlayer = sequelize.define('BasketballPlayer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true },
  rarity: { type: DataTypes.STRING }, // C, B, A, S, SS, ULT
  type: { type: DataTypes.STRING }, // Base, Prime, Playoff, Legendary, Alternate
  position: { type: DataTypes.STRING }, // PG, SG, SF, PF, C
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
  imageUrl: { type: DataTypes.STRING },
  signatureSkill: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT }
});

const PlayerCard = sequelize.define('PlayerCard', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userWhatsappId: { type: DataTypes.STRING },
  basketballPlayerId: { type: DataTypes.INTEGER },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  xp: { type: DataTypes.INTEGER, defaultValue: 0 },
  staminaCurrent: { type: DataTypes.INTEGER, defaultValue: 100 },
  isLocked: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const Team = sequelize.define('Team', {
  userWhatsappId: { type: DataTypes.STRING, primaryKey: true },
  pgCardId: { type: DataTypes.INTEGER, allowNull: true },
  sgCardId: { type: DataTypes.INTEGER, allowNull: true },
  sfCardId: { type: DataTypes.INTEGER, allowNull: true },
  pfCardId: { type: DataTypes.INTEGER, allowNull: true },
  cCardId: { type: DataTypes.INTEGER, allowNull: true },
});

const RPMessage = sequelize.define('RPMessage', {
    senderJid: { type: DataTypes.STRING },
    senderName: { type: DataTypes.STRING },
    content: { type: DataTypes.TEXT },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

// Relations
PlayerCard.belongsTo(User, { foreignKey: 'userWhatsappId' });
User.hasMany(PlayerCard, { foreignKey: 'userWhatsappId' });
PlayerCard.belongsTo(BasketballPlayer, { foreignKey: 'basketballPlayerId' });
Team.belongsTo(User, { foreignKey: 'userWhatsappId' });

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const playerCount = await BasketballPlayer.count();
    if (playerCount < 100) {
        const initialPlayers = [
            {
                name: 'Stephen Curry', rarity: 'SS', type: 'Prime', position: 'PG',
                shoot: 99, layup: 90, dunk: 65, dribble: 98, pass: 94, defense: 70, steal: 85, block: 40, speed: 88, stamina: 95, iq: 97,
                signatureSkill: 'Deep Range', imageUrl: 'https://i.imgur.com/uPId3vK.jpeg'
            },
            {
                name: 'LeBron James', rarity: 'ULT', type: 'Legendary', position: 'SF',
                shoot: 85, layup: 98, dunk: 99, dribble: 90, pass: 97, defense: 90, steal: 80, block: 85, speed: 92, stamina: 98, iq: 99,
                signatureSkill: 'King Drive', imageUrl: 'https://i.imgur.com/8f8wBvE.jpeg'
            },
            {
                name: 'Kyrie Irving', rarity: 'S', type: 'Base', position: 'PG',
                shoot: 92, layup: 99, dunk: 70, dribble: 99, pass: 90, defense: 72, steal: 82, block: 45, speed: 94, stamina: 92, iq: 95,
                signatureSkill: 'Ankle Breaker', imageUrl: 'https://i.imgur.com/1O8z7yA.jpeg'
            },
            {
                name: 'Victor Wembanyama', rarity: 'S', type: 'Base', position: 'C',
                shoot: 82, layup: 88, dunk: 95, dribble: 80, pass: 78, defense: 98, steal: 85, block: 99, speed: 85, stamina: 90, iq: 92,
                signatureSkill: 'Alien Wingspan', imageUrl: 'https://i.imgur.com/W2l4v9U.jpeg'
            },
            {
                name: 'Shaquille O\'Neal', rarity: 'ULT', type: 'Legendary', position: 'C',
                shoot: 30, layup: 95, dunk: 99, dribble: 60, pass: 70, defense: 95, steal: 60, block: 98, speed: 75, stamina: 90, iq: 88,
                signatureSkill: 'Diesel Power', imageUrl: 'https://i.imgur.com/Q9E1K7v.jpeg'
            },
            {
                name: 'Kobe Bryant', rarity: 'ULT', type: 'Legendary', position: 'SG',
                shoot: 95, layup: 96, dunk: 94, dribble: 94, pass: 88, defense: 96, steal: 88, block: 70, speed: 92, stamina: 99, iq: 98,
                signatureSkill: 'Mamba Mentality', imageUrl: 'https://i.imgur.com/9K6L6E2.jpeg'
            },
            {
                name: 'Michael Jordan', rarity: 'ULT', type: 'Legendary', position: 'SG',
                shoot: 94, layup: 99, dunk: 99, dribble: 95, pass: 90, defense: 99, steal: 99, block: 85, speed: 98, stamina: 99, iq: 99,
                signatureSkill: 'Air Walk', imageUrl: 'https://i.imgur.com/L1N7n9Y.jpeg'
            }
        ];

        for (const p of initialPlayers) {
            await BasketballPlayer.findOrCreate({ where: { name: p.name }, defaults: p });
        }

        // Fill remaining up to 100 with procedural/basic players
        const names = ["Luka Doncic", "Giannis Antetokounmpo", "Kevin Durant", "Nikola Jokic", "Joel Embiid", "Jayson Tatum", "Ja Morant", "Zion Williamson", "Shai Gilgeous-Alexander", "Devin Booker"];
        for (let i = 0; i < 93; i++) {
            const baseName = names[i % names.length];
            const name = `${baseName} ${Math.floor(i / names.length) + 1}`;
            const rarity = i % 20 === 0 ? 'S' : (i % 10 === 0 ? 'A' : (i % 5 === 0 ? 'B' : 'C'));
            await BasketballPlayer.findOrCreate({
                where: { name },
                defaults: {
                    name, rarity, type: 'Base', position: ['PG', 'SG', 'SF', 'PF', 'C'][i % 5],
                    shoot: 40 + Math.random() * 40, layup: 40 + Math.random() * 40, dunk: 40 + Math.random() * 40,
                    dribble: 40 + Math.random() * 40, pass: 40 + Math.random() * 40, defense: 40 + Math.random() * 40,
                    steal: 40 + Math.random() * 40, block: 40 + Math.random() * 40, speed: 40 + Math.random() * 40,
                    stamina: 80, iq: 70, signatureSkill: 'Standard', imageUrl: 'https://via.placeholder.com/500'
                }
            });
        }
    }
  } catch (e) { console.error(e); }
}

module.exports = { sequelize, User, BasketballPlayer, PlayerCard, Team, RPMessage, Creds, setupDatabase };
