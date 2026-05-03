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
    defaultValue: 'Bêta testeur',
  },
  rank: {
    type: DataTypes.STRING,
    defaultValue: 'E',
  },
  class: {
    type: DataTypes.STRING,
    defaultValue: 'Aucune',
  },
  skillPoints: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  xp: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  col: { // Changed from money
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  health: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  mana: { // Changed from energy
    type: DataTypes.INTEGER,
    defaultValue: 100,
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
  location: {
    type: DataTypes.STRING,
    defaultValue: 'Ville de départ',
  },
  mode: {
    type: DataTypes.STRING,
    defaultValue: 'normal', // Can be 'normal' or 'action'
  },
  characterDescription: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  currentDungeonId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  awaitingProfilePic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  profilePicUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  strength: {
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
  luck: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  defense: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
});

const Item = sequelize.define('Item', {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
  },
  price: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  type: { // weapon, armor, consumable, etc.
    type: DataTypes.STRING,
  },
  statBonuses: {
    type: DataTypes.TEXT,
    defaultValue: '{}',
    get() {
      const rawValue = this.getDataValue('statBonuses');
      return rawValue ? JSON.parse(rawValue) : {};
    },
    set(value) {
      this.setDataValue('statBonuses', JSON.stringify(value));
    },
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

const Dungeon = sequelize.define('Dungeon', {
    name: {
        type: DataTypes.STRING,
        unique: true,
    },
    description: {
        type: DataTypes.TEXT,
    },
    rank: {
        type: DataTypes.STRING,
    },
    floors: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
    }
});

const Quest = sequelize.define('Quest', {
    title: {
        type: DataTypes.STRING,
        unique: true,
    },
    description: {
        type: DataTypes.TEXT,
    },
    type: { // 'main' or 'side'
        type: DataTypes.STRING,
        defaultValue: 'side',
    },
    rank_required: {
        type: DataTypes.STRING,
        defaultValue: 'E',
    },
    reward_col: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    reward_xp: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
});

const PlayerQuest = sequelize.define('PlayerQuest', {
    status: {
        type: DataTypes.STRING,
        defaultValue: 'not_started', // in_progress, completed
    },
});

const Bank = sequelize.define('Bank', {
    balance: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    }
});

// Relationships
Player.hasOne(Bank);
Bank.belongsTo(Player);

Player.belongsToMany(Quest, { through: PlayerQuest });
Quest.belongsToMany(Player, { through: PlayerQuest });


async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');

    // Seed initial game data
    const dungeonCount = await Dungeon.count();
    if (dungeonCount === 0) {
        console.log('Seeding Dungeons...');
        await Dungeon.bulkCreate([
            { name: 'Forêt des Gobelins', description: 'Une forêt sombre grouillant de gobelins faibles.', rank: 'E', floors: 5 },
            { name: 'Mine de Cobalt', description: 'Une mine abandonnée où vivent des kobolds mineurs.', rank: 'D', floors: 10 },
            { name: 'Caverne des Ombres', description: 'Une caverne profonde où la lumière ne pénètre jamais.', rank: 'C', floors: 15 },
            { name: 'Labyrinthe d\'Aincrad', description: 'Un labyrinthe complexe menant au sommet du château volant.', rank: 'B', floors: 20 },
            { name: 'Forêt de Glace de Givre', description: 'Une forêt éternellement gelée où rôdent des créatures de glace.', rank: 'A', floors: 25 },
            { name: 'Donjon du Destin', description: 'Un donjon mystérieux qui change de forme à chaque entrée.', rank: 'S', floors: 100 },
        ]);
        console.log('Dungeons seeded.');
    }

    const itemCount = await Item.count();
    if (itemCount === 0) {
        console.log('Seeding Items...');
        await Item.bulkCreate([
            {
                name: 'Elucidator',
                description: 'Une épée noire obsidienne d\'une puissance incroyable.',
                price: 5000,
                type: 'weapon',
                statBonuses: { strength: 25, agility: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/5/53/Elucidator.png'
            },
            {
                name: 'Dark Repulser',
                description: 'Une épée forgée à partir d\'un cristal rare, compagne de l\'Elucidator.',
                price: 4500,
                type: 'weapon',
                statBonuses: { strength: 20, agility: 15 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/8/82/Dark_Repulser.png'
            },
            {
                name: 'Lambent Light',
                description: 'Une rapière élégante et rapide comme l\'éclair.',
                price: 4000,
                type: 'weapon',
                statBonuses: { agility: 25, luck: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/c/c5/Lambent_Light.png'
            },
            {
                name: 'Blue Rose Sword',
                description: 'Une épée gravée d\'une rose bleue, capable de geler les ennemis.',
                price: 6000,
                type: 'weapon',
                statBonuses: { intelligence: 20, defense: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/1/1a/Blue_Rose_Sword.png'
            },
            {
                name: 'Night Sky Sword',
                description: 'Une épée forgée à partir d\'une branche de l\'Arbre du Destin.',
                price: 7000,
                type: 'weapon',
                statBonuses: { strength: 30, intelligence: 15 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/f/f6/Night_Sky_Sword.png'
            }
        ]);
        console.log('Items seeded.');
    }

    const questCount = await Quest.count();
    if (questCount === 0) {
        console.log('Seeding Quests...');
        await Quest.bulkCreate([
            { title: 'La Chasse aux Gobelins', description: 'Éliminez 10 gobelins dans la Forêt des Gobelins.', type: 'side', rank_required: 'E', reward_col: 50, reward_xp: 100 },
            { title: 'Le Fléau des Kobolds', description: 'Venez à bout du chef des kobolds dans la Mine de Cobalt.', type: 'main', rank_required: 'D', reward_col: 200, reward_xp: 300 },
        ]);
        console.log('Quests seeded.');
    }

  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

module.exports = {
  sequelize,
  Player,
  Dungeon,
  Quest,
  PlayerQuest,
  Bank,
  Item,
  Creds,
  setupDatabase,
};
