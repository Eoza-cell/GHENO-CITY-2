const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'gheno-football.sqlite',
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
  // Character Stats (for Personal Player)
  shoot: { type: DataTypes.INTEGER, defaultValue: 40 },
  power: { type: DataTypes.INTEGER, defaultValue: 40 },
  precision: { type: DataTypes.INTEGER, defaultValue: 40 },
  pass: { type: DataTypes.INTEGER, defaultValue: 40 },
  dribble: { type: DataTypes.INTEGER, defaultValue: 40 },
  defense: { type: DataTypes.INTEGER, defaultValue: 40 },
  speed: { type: DataTypes.INTEGER, defaultValue: 40 },
  stamina: { type: DataTypes.INTEGER, defaultValue: 60 },
  iq: { type: DataTypes.INTEGER, defaultValue: 40 },
  position: {
    type: DataTypes.STRING,
    allowNull: true, // Attaquant, Milieu, Défenseur, Gardien
  },
  currentClub: {
    type: DataTypes.STRING,
    defaultValue: 'Sans club (Agent libre)',
  },
  marketValue: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  careerStage: {
    type: DataTypes.STRING,
    defaultValue: 'prologue', // prologue, pro, legend
  },
  appearanceImageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contractDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sponsor: {
    type: DataTypes.STRING,
    defaultValue: 'Aucun',
  },
  vehicles: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      const rawValue = this.getDataValue('vehicles');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('vehicles', JSON.stringify(value));
    },
  },
  companies: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      const rawValue = this.getDataValue('companies');
      return rawValue ? JSON.parse(rawValue) : [];
    },
    set(value) {
      this.setDataValue('companies', JSON.stringify(value));
    },
  },
  startRpDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  location: {
    type: DataTypes.STRING,
    defaultValue: 'Centre-ville',
  },
  country: {
    type: DataTypes.STRING,
    defaultValue: 'France',
  },
  matchEndTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  money: {
    type: DataTypes.INTEGER,
    defaultValue: 500, // En Euros
  },
  fame: {
    type: DataTypes.INTEGER,
    defaultValue: 0, // 0-100
  },
  job: {
    type: DataTypes.STRING,
    defaultValue: 'Aucun',
  },
  nationalTeam: {
    type: DataTypes.STRING,
    defaultValue: 'Aucune',
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
    type: DataTypes.STRING, // Base, Prime, Legendary, Alternate Timeline
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Stats 0-100
  shoot: { type: DataTypes.INTEGER, defaultValue: 10 },
  pass: { type: DataTypes.INTEGER, defaultValue: 10 },
  dribble: { type: DataTypes.INTEGER, defaultValue: 10 },
  defense: { type: DataTypes.INTEGER, defaultValue: 10 },
  speed: { type: DataTypes.INTEGER, defaultValue: 10 },
  stamina: { type: DataTypes.INTEGER, defaultValue: 50 },
  iq: { type: DataTypes.INTEGER, defaultValue: 10 },
  diving: { type: DataTypes.INTEGER, defaultValue: 5 },
  reflexes: { type: DataTypes.INTEGER, defaultValue: 5 },
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
  shooter1Id: { type: DataTypes.INTEGER, allowNull: true },
  shooter2Id: { type: DataTypes.INTEGER, allowNull: true },
  goalkeeperId: { type: DataTypes.INTEGER, allowNull: true },
});

const Match = sequelize.define('Match', {
  playerAJid: { type: DataTypes.STRING }, // Captain A
  playerBJid: { type: DataTypes.STRING, allowNull: true }, // Captain B
  teamA: {
    type: DataTypes.TEXT, // JSON array of JIDs
    defaultValue: '[]',
  },
  teamB: {
    type: DataTypes.TEXT, // JSON array of JIDs
    defaultValue: '[]',
  },
  scoreA: { type: DataTypes.INTEGER, defaultValue: 0 },
  scoreB: { type: DataTypes.INTEGER, defaultValue: 0 },
  round: { type: DataTypes.INTEGER, defaultValue: 1 },
  turn: { type: DataTypes.STRING, defaultValue: 'A' }, // 'A' or 'B' (Team currently shooting)
  phase: { type: DataTypes.STRING, defaultValue: 'shoot' }, // 'shoot' or 'dive'
  lastShotDirection: { type: DataTypes.STRING, allowNull: true }, // gauche, milieu, droite
  currentShooterIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
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
    console.log('Football Penalty Database connected.');
    await sequelize.sync({ alter: true });

    const cardCount = await Card.count();
    if (cardCount === 0) {
      console.log('Seeding 100 Football Players...');
      const playersToSeed = [
        // Legendary / ULT
        { name: 'Lionel Messi', rarity: 'ULT', type: 'Legendary', shoot: 98, power: 85, precision: 99, diving: 30, reflexes: 40, speed: 92, stamina: 90, iq: 100, signatureSkillName: 'Ankara Messi', signatureSkillDesc: 'Dribble et finition chirurgicale impossible à arrêter.' },
        { name: 'Cristiano Ronaldo', rarity: 'ULT', type: 'Legendary', shoot: 99, power: 98, precision: 95, diving: 40, reflexes: 45, speed: 95, stamina: 99, iq: 98, signatureSkillName: 'Siuuuu Strike', signatureSkillDesc: 'Puissance de frappe phénoménale.' },
        { name: 'Pelé', rarity: 'ULT', type: 'Legendary', shoot: 97, power: 90, precision: 96, diving: 35, reflexes: 42, speed: 94, stamina: 95, iq: 99, signatureSkillName: 'O Rei', signatureSkillDesc: 'Le génie pur du football.' },
        { name: 'Zinedine Zidane', rarity: 'ULT', type: 'Legendary', shoot: 92, power: 88, precision: 98, diving: 30, reflexes: 35, speed: 85, stamina: 92, iq: 100, signatureSkillName: 'Panenka Royale', signatureSkillDesc: 'Sang-froid absolu sur penalty.' },
        { name: 'Lev Yashin', rarity: 'ULT', type: 'Legendary', shoot: 20, power: 50, precision: 30, diving: 100, reflexes: 100, speed: 88, stamina: 95, iq: 99, signatureSkillName: 'Araignée Noire', signatureSkillDesc: 'Arrête absolument tous les tirs.' },
        { name: 'Gianluigi Buffon', rarity: 'ULT', type: 'Legendary', shoot: 15, power: 45, precision: 25, diving: 98, reflexes: 96, speed: 80, stamina: 90, iq: 98, signatureSkillName: 'Mur Éternel', signatureSkillDesc: 'Infranchissable sur sa ligne.' },
        { name: 'Kylian Mbappé', rarity: 'SS', type: 'Base', shoot: 94, power: 90, precision: 92, diving: 25, reflexes: 30, speed: 100, stamina: 95, iq: 94, signatureSkillName: 'Flash Sprint', signatureSkillDesc: 'Vitesse de déclenchement fulgurante.' },
        { name: 'Erling Haaland', rarity: 'SS', type: 'Base', shoot: 98, power: 100, precision: 90, diving: 20, reflexes: 25, speed: 94, stamina: 96, iq: 92, signatureSkillName: 'Cyborg Shot', signatureSkillDesc: 'Frappe surpuissante dévastatrice.' },
        { name: 'Neymar Jr', rarity: 'SS', type: 'Base', shoot: 92, power: 80, precision: 96, diving: 30, reflexes: 35, speed: 90, stamina: 88, iq: 96, signatureSkillName: 'Jinga Style', signatureSkillDesc: 'Feinte le gardien avant de tirer.' },
        { name: 'Manuel Neuer', rarity: 'SS', type: 'Base', shoot: 40, power: 70, precision: 50, diving: 96, reflexes: 94, speed: 85, stamina: 92, iq: 97, signatureSkillName: 'Sweeper Keeper', signatureSkillDesc: 'Anticipation parfaite des tirs.' },
      ];

      const footballNames = [
          'Kevin De Bruyne', 'Robert Lewandowski', 'Mohamed Salah', 'Karim Benzema', 'Luka Modric',
          'Harry Kane', 'Virgil van Dijk', 'Alisson Becker', 'Thibaut Courtois', 'Jan Oblak',
          'Marc-André ter Stegen', 'Ederson', 'Gianluigi Donnarumma', 'Mike Maignan', 'Emiliano Martínez',
          'Vinícius Júnior', 'Antoine Griezmann', 'Bernardo Silva', 'Rodri', 'Jude Bellingham',
          'Bukayo Saka', 'Martin Ødegaard', 'Bruno Fernandes', 'Son Heung-min', 'Rúben Dias',
          'Leroy Sané', 'Phil Foden', 'Jamal Musiala', 'Florian Wirtz', 'Pedri',
          'Gavi', 'Federico Valverde', 'Aurélien Tchouaméni', 'Eduardo Camavinga', 'Alphonso Davies',
          'Trent Alexander-Arnold', 'Achraf Hakimi', 'Theo Hernández', 'Marquinhos', 'Ronald Araújo',
          'Victor Osimhen', 'Lautaro Martínez', 'Julian Alvarez', 'Rafael Leão', 'Marcus Rashford',
          'Jack Grealish', 'Darwin Núñez', 'Luis Díaz', 'Christopher Nkunku', 'Ousmane Dembélé',
          'Ronaldinho', 'Ronaldo Nazário', 'Diego Maradona', 'Johan Cruyff', 'Michel Platini',
          'Marco van Basten', 'Paolo Maldini', 'Franco Baresi', 'Fabio Cannavaro', 'Oliver Kahn',
          'Iker Casillas', 'Petr Čech', 'Edwin van der Sar', 'Peter Schmeichel', 'Dida',
          'Roberto Carlos', 'Cafu', 'Xavi', 'Andrés Iniesta', 'Andrea Pirlo',
          'Steven Gerrard', 'Frank Lampard', 'Paul Scholes', 'David Beckham', 'Ryan Giggs',
          'Thierry Henry', 'Samuel Eto\'o', 'Didier Drogba', 'George Weah', 'Zlatan Ibrahimović',
          'Luis Suárez', 'Edison Cavani', 'Radamel Falcao', 'Sergio Agüero', 'Angel Di María',
          'Joshua Kimmich', 'Ilkay Gündogan', 'Toni Kroos', 'Casemiro', 'Keylor Navas',
          'Hugo Lloris', 'Wojciech Szczęsny', 'Jordan Pickford', 'Yann Sommer', 'Kasper Schmeichel'
      ];

      for (const name of footballNames) {
          if (playersToSeed.find(p => p.name === name)) continue;
          const randomRarity = ['B', 'B', 'B', 'A', 'A', 'S'][Math.floor(Math.random() * 6)];
          const isGK = Math.random() < 0.2; // 20% chances of being a GK

          playersToSeed.push({
              name,
              rarity: randomRarity,
              type: 'Base',
              shoot: isGK ? 10 + Math.floor(Math.random() * 40) : 70 + Math.floor(Math.random() * 25),
              power: 60 + Math.floor(Math.random() * 35),
              precision: isGK ? 20 + Math.floor(Math.random() * 40) : 70 + Math.floor(Math.random() * 25),
              diving: isGK ? 80 + Math.floor(Math.random() * 18) : 10 + Math.floor(Math.random() * 30),
              reflexes: isGK ? 80 + Math.floor(Math.random() * 18) : 15 + Math.floor(Math.random() * 35),
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
