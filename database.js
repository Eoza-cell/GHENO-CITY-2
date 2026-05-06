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
  tutorialStep: {
    type: DataTypes.INTEGER,
    defaultValue: 0, // 0: not started, 1: class choice, 2: combat training, 3: completed
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
  slot: { // head, chest, arms, legs, weapon, none
    type: DataTypes.STRING,
    defaultValue: 'none',
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
                slot: 'weapon',
                statBonuses: { strength: 25, agility: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/5/53/Elucidator.png'
            },
            {
                name: 'Dark Repulser',
                description: 'Une épée forgée à partir d\'un cristal rare, compagne de l\'Elucidator.',
                price: 4500,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 20, agility: 15 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/8/82/Dark_Repulser.png'
            },
            {
                name: 'Lambent Light',
                description: 'Une rapière élégante et rapide comme l\'éclair.',
                price: 4000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 25, luck: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/c/c5/Lambent_Light.png'
            },
            {
                name: 'Blue Rose Sword',
                description: 'Une épée gravée d\'une rose bleue, capable de geler les ennemis.',
                price: 6000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { intelligence: 20, defense: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/1/1a/Blue_Rose_Sword.png'
            },
            {
                name: 'Night Sky Sword',
                description: 'Une épée forgée à partir d\'une branche de l\'Arbre du Destin.',
                price: 7000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 30, intelligence: 15 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/f/f6/Night_Sky_Sword.png'
            },
            // Armures
            {
                name: 'Plastron de la Confrérie',
                description: 'L\'armure emblématique des Chevaliers du Sang.',
                price: 3000,
                type: 'armor',
                slot: 'chest',
                statBonuses: { defense: 20, strength: 5 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/b/b3/Knights_of_the_Blood_Uniform.png'
            },
            {
                name: 'Heaume de Fer',
                description: 'Un casque solide offrant une protection basique.',
                price: 800,
                type: 'armor',
                slot: 'head',
                statBonuses: { defense: 10 },
            },
            {
                name: 'Gantelets de Combat',
                description: 'Des gantelets renforçant les coups et la garde.',
                price: 600,
                type: 'armor',
                slot: 'arms',
                statBonuses: { defense: 5, strength: 3 },
            },
            {
                name: 'Jambières de Vitesse',
                description: 'Des bottes légères favorisant le mouvement.',
                price: 1200,
                type: 'armor',
                slot: 'legs',
                statBonuses: { defense: 8, agility: 10 },
            },
            {
                name: 'Arc Elfique',
                description: 'Un arc élégant sculpté dans du bois de lothlorien.',
                price: 2500,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 15, luck: 5 },
            },
            {
                name: 'Bouclier en Os de Dragon',
                description: 'Un bouclier massif forgé à partir des restes d\'un dragon ancien.',
                price: 3500,
                type: 'armor',
                slot: 'arms',
                statBonuses: { defense: 25, strength: 10 },
            },
            {
                name: 'Tunique de Soie Magique',
                description: 'Une tunique légère imprégnée de mana.',
                price: 1800,
                type: 'armor',
                slot: 'chest',
                statBonuses: { intelligence: 15, defense: 5 },
            },
            {
                name: 'Fragrant Olive Sword',
                description: 'L\'épée divine d\'Alice, capable de se diviser en mille pétales.',
                price: 8000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 35, defense: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/4/43/Fragrant_Olive_Sword.png'
            },
            {
                name: 'Heaven Piercing Sword',
                description: 'L\'épée de Fanatio, dont la lumière peut tout transpercer.',
                price: 7500,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { intelligence: 30, agility: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/7/77/Heaven_Piercing_Sword.png'
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
            { title: 'L\'Énigme d\'Aincrad', description: 'Explorez le premier palier du labyrinthe et trouvez la stèle ancienne.', type: 'main', rank_required: 'C', reward_col: 500, reward_xp: 1000 },
            { title: 'Larmes de Glace', description: 'Récupérez 5 cristaux de givre dans la Forêt de Glace.', type: 'side', rank_required: 'B', reward_col: 800, reward_xp: 1500 },
            { title: 'Le Duel des Maîtres', description: 'Affrontez un épéiste légendaire pour prouver votre valeur.', type: 'main', rank_required: 'A', reward_col: 2000, reward_xp: 5000 },
            { title: 'La Menace Volante', description: 'Éliminez les wyvernes qui terrorisent les caravanes marchandes.', type: 'side', rank_required: 'B', reward_col: 1200, reward_xp: 2000 },
            { title: 'Le Secret du Forgeron', description: 'Aidez le forgeron de la ville de départ à retrouver son marteau volé.', type: 'side', rank_required: 'D', reward_col: 300, reward_xp: 500 },
            { title: 'Le Trésor Oublié', description: 'Une légende parle d\'un trésor caché au fond des Mines de Cobalt.', type: 'side', rank_required: 'D', reward_col: 600, reward_xp: 800 },
            { title: 'Invasion de Monstres', description: 'Repoussez l\'attaque soudaine de monstres sur le village de pêcheurs.', type: 'side', rank_required: 'C', reward_col: 1000, reward_xp: 2000 },
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
