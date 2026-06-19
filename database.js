const { Sequelize, DataTypes } = require('sequelize');

// Use Postgres if DATABASE_URL is provided, otherwise SQLite
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      protocol: 'postgres',
      dialectOptions: {
          ssl: {
              require: true,
              rejectUnauthorized: false
          }
      },
      logging: false
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: 'database.sqlite',
      logging: false,
    });

const Creds = sequelize.define('Creds', {
  key: { type: DataTypes.STRING, primaryKey: true },
  value: { type: DataTypes.TEXT('long') },
});

const Player = sequelize.define('Player', {
  whatsappId: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, defaultValue: 'Rookie' },
  shoot: { type: DataTypes.INTEGER, defaultValue: 40 },
  pass: { type: DataTypes.INTEGER, defaultValue: 40 },
  dribble: { type: DataTypes.INTEGER, defaultValue: 40 },
  defense: { type: DataTypes.INTEGER, defaultValue: 40 },
  speed: { type: DataTypes.INTEGER, defaultValue: 40 },
  power: { type: DataTypes.INTEGER, defaultValue: 40 },
  stamina: { type: DataTypes.INTEGER, defaultValue: 100 },
  iq: { type: DataTypes.INTEGER, defaultValue: 40 },
  goalkeeping: { type: DataTypes.INTEGER, defaultValue: 10 },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  xp: { type: DataTypes.INTEGER, defaultValue: 0 },
  position: { type: DataTypes.STRING, allowNull: true },
  jerseyNumber: { type: DataTypes.INTEGER, defaultValue: 99 },
  currentClubId: { type: DataTypes.INTEGER, allowNull: true },
  nation: { type: DataTypes.STRING, defaultValue: 'France' },
  salary: { type: DataTypes.INTEGER, defaultValue: 500 },
  money: { type: DataTypes.INTEGER, defaultValue: 1000 },
  fame: { type: DataTypes.INTEGER, defaultValue: 0 },
  country: { type: DataTypes.STRING, defaultValue: 'France' },
  city: { type: DataTypes.STRING, defaultValue: 'Paris' },
  location: { type: DataTypes.STRING, defaultValue: 'Hôtel' },
  appearanceImageUrl: { type: DataTypes.STRING, allowNull: true },
  currentDay: { type: DataTypes.INTEGER, defaultValue: 1 },
  lastChronoUpdate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  mode: { type: DataTypes.STRING, defaultValue: 'normal' },
  registrationStep: { type: DataTypes.STRING, allowNull: true },
  locks: { type: DataTypes.INTEGER, defaultValue: 0 },
  sparks: { type: DataTypes.INTEGER, defaultValue: 0 },
  wins: { type: DataTypes.INTEGER, defaultValue: 0 },
  losses: { type: DataTypes.INTEGER, defaultValue: 0 },
  goals: { type: DataTypes.INTEGER, defaultValue: 0 },
  specialAbilities: { type: DataTypes.TEXT, defaultValue: '[]', get() { return JSON.parse(this.getDataValue('specialAbilities') || '[]'); }, set(v) { this.setDataValue('specialAbilities', JSON.stringify(v)); } },
});

const Card = sequelize.define('Card', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true },
  shoot: { type: DataTypes.INTEGER, defaultValue: 50 },
  pass: { type: DataTypes.INTEGER, defaultValue: 50 },
  dribble: { type: DataTypes.INTEGER, defaultValue: 50 },
  defense: { type: DataTypes.INTEGER, defaultValue: 50 },
  speed: { type: DataTypes.INTEGER, defaultValue: 50 },
  power: { type: DataTypes.INTEGER, defaultValue: 50 },
  specialAbilities: { type: DataTypes.TEXT, defaultValue: '[]', get() { return JSON.parse(this.getDataValue('specialAbilities') || '[]'); }, set(v) { this.setDataValue('specialAbilities', JSON.stringify(v)); } },
  priceLock: { type: DataTypes.INTEGER, defaultValue: 100 },
  priceSpark: { type: DataTypes.INTEGER, defaultValue: 5000 },
  rarity: { type: DataTypes.STRING, defaultValue: 'Common' }
});

const OwnedCard = sequelize.define('OwnedCard', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  playerWhatsappId: { type: DataTypes.STRING },
  cardId: { type: DataTypes.INTEGER }
});

const Club = sequelize.define('Club', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, unique: true },
  country: { type: DataTypes.STRING },
  league: { type: DataTypes.STRING },
  reputation: { type: DataTypes.INTEGER, defaultValue: 50 },
  formation: { type: DataTypes.STRING, defaultValue: '4-3-3' }
});

const Trophy = sequelize.define('Trophy', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING },
  type: { type: DataTypes.STRING },
  year: { type: DataTypes.INTEGER },
  playerWhatsappId: { type: DataTypes.STRING }
});

const ContractOffer = sequelize.define('ContractOffer', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    playerWhatsappId: { type: DataTypes.STRING },
    clubId: { type: DataTypes.INTEGER },
    salary: { type: DataTypes.INTEGER },
    jerseyNumber: { type: DataTypes.INTEGER },
    status: { type: DataTypes.STRING, defaultValue: 'pending' }
});

const NPC = sequelize.define('NPC', {
  name: { type: DataTypes.STRING, unique: true },
  role: { type: DataTypes.STRING },
  clubId: { type: DataTypes.INTEGER, allowNull: true },
  stats: { type: DataTypes.TEXT, get() { return JSON.parse(this.getDataValue('stats') || '{}'); }, set(v) { this.setDataValue('stats', JSON.stringify(v)); } }
});

const RPMessage = sequelize.define('RPMessage', {
    senderJid: { type: DataTypes.STRING },
    senderName: { type: DataTypes.STRING },
    content: { type: DataTypes.TEXT },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

Player.belongsTo(Club, { as: 'currentClub', foreignKey: 'currentClubId' });
Club.hasMany(Player, { foreignKey: 'currentClubId' });
ContractOffer.belongsTo(Club, { foreignKey: 'clubId' });
Player.hasMany(ContractOffer, { foreignKey: 'playerWhatsappId' });
Player.hasMany(OwnedCard, { foreignKey: 'playerWhatsappId' });
OwnedCard.belongsTo(Card, { foreignKey: 'cardId' });

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const clubCount = await Club.count();
    if (clubCount < 5) {
        await Club.bulkCreate([
            { name: 'Paris Saint-Germain', country: 'France', league: 'Ligue 1', reputation: 85 },
            { name: 'FC Barcelone', country: 'Espagne', league: 'La Liga', reputation: 90 },
            { name: 'Real Madrid', country: 'Espagne', league: 'La Liga', reputation: 95 },
            { name: 'Manchester United', country: 'Angleterre', league: 'Premier League', reputation: 88 },
            { name: 'Manchester City', country: 'Angleterre', league: 'Premier League', reputation: 92 },
            { name: 'Bayern Munich', country: 'Allemagne', league: 'Bundesliga', reputation: 89 },
            { name: 'AC Milan', country: 'Italie', league: 'Serie A', reputation: 85 },
            { name: 'Club de Formation', country: 'France', league: 'National', reputation: 20 }
        ], { ignoreDuplicates: true });
    }

    const cardCount = await Card.count();
    if (cardCount === 0) {
        await Card.bulkCreate([
            { name: 'Isagi Yoichi (Equipe Z)', shoot: 70, pass: 75, dribble: 65, defense: 60, speed: 70, power: 60, specialAbilities: ['Vision Directe', 'Flair de buteur'], priceLock: 50, priceSpark: 2500 },
            { name: 'Bachira Meguru (Equipe Z)', shoot: 65, pass: 80, dribble: 90, defense: 50, speed: 85, power: 55, specialAbilities: ['Dribble Monstrueux', 'Passe de l\'instinct'], priceLock: 60, priceSpark: 3000 },
            { name: 'Kunigami Rensuke (Equipe Z)', shoot: 85, pass: 60, dribble: 60, defense: 70, speed: 75, power: 88, specialAbilities: ['Tir de loin', 'Puissance brute'], priceLock: 60, priceSpark: 3000 },
            { name: 'Chigiri Hyoma (Equipe Z)', shoot: 70, pass: 65, dribble: 75, defense: 60, speed: 95, power: 60, specialAbilities: ['Vitesse éclair', 'Sprint infini'], priceLock: 70, priceSpark: 3500 },
            { name: 'Barou Shoei', shoot: 90, pass: 50, dribble: 80, defense: 60, speed: 80, power: 92, specialAbilities: ['Coup franc de force', 'Mode Roi'], priceLock: 100, priceSpark: 5000 },
            { name: 'Itoshi Rin', shoot: 95, pass: 90, dribble: 90, defense: 85, speed: 88, power: 80, specialAbilities: ['Tir de marionnettiste', 'Vision spatiale'], priceLock: 200, priceSpark: 10000 },
            { name: 'Nagi Seishiro', shoot: 88, pass: 80, dribble: 85, defense: 50, speed: 80, power: 75, specialAbilities: ['Contrôle parfait', 'Tir acrobatique'], priceLock: 150, priceSpark: 7500 }
        ]);
    }

    const npcCount = await NPC.count();
    if (npcCount < 100) {
        const stars = [
            { name: 'Kylian Mbappé', role: 'Star', stats: { shoot: 92, speed: 99 } },
            { name: 'Lionel Messi', role: 'Legend', stats: { pass: 99, dribble: 99 } },
            { name: 'Cristiano Ronaldo', role: 'Legend', stats: { shoot: 95, power: 95 } },
            { name: 'Neymar Jr', role: 'Star', stats: { dribble: 96, pass: 92 } },
            { name: 'Erling Haaland', role: 'Star', stats: { shoot: 98, power: 98 } },
            { name: 'Kevin De Bruyne', role: 'Star', stats: { pass: 99, iq: 98 } },
            { name: 'Vinícius Júnior', role: 'Star', stats: { speed: 98, dribble: 95 } },
            { name: 'Jude Bellingham', role: 'Star', stats: { iq: 96, defense: 85 } },
            { name: 'Mohamed Salah', role: 'Star', stats: { speed: 94, shoot: 90 } },
            { name: 'Harry Kane', role: 'Star', stats: { shoot: 96, pass: 88 } }
        ];

        for (let i = 0; i < 110; i++) {
            const firstNames = ["Luka", "Robert", "Karim", "Antoine", "Toni", "Bernardo", "Ruben", "Rodri", "Alisson", "Thibaut"];
            const lastNames = ["Modric", "Lewandowski", "Benzema", "Griezmann", "Kroos", "Silva", "Dias", "Hernandez", "Becker", "Courtois"];
            const name = i < stars.length ? stars[i].name : `${firstNames[i % 10]} ${lastNames[Math.floor(i / 10) % 10]} ${i}`;
            await NPC.findOrCreate({ where: { name }, defaults: { role: 'Joueur Pro', stats: { shoot: 70 + Math.random() * 20, speed: 70 + Math.random() * 20 } } });
        }
    }
  } catch (e) { console.error(e); }
}

module.exports = { sequelize, Player, Club, Trophy, ContractOffer, NPC, RPMessage, Creds, Card, OwnedCard, setupDatabase };
