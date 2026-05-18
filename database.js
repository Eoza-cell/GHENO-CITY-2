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
    defaultValue: 'F',
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
  maxHealth: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  mana: { // Changed from energy
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  maxMana: {
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
    defaultValue: 'Eldoria',
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
  registrationStep: {
    type: DataTypes.STRING,
    allowNull: true, // null means registered, or use 'completed'
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

const Skill = sequelize.define('Skill', {
    name: {
        type: DataTypes.STRING,
        unique: true,
    },
    description: {
        type: DataTypes.TEXT,
    },
    type: { // 'active', 'passive', 'spell', 'sword_technique'
        type: DataTypes.STRING,
    },
    manaCost: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
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
    }
});

const PlayerSkill = sequelize.define('PlayerSkill', {
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
    }
});

const Kingdom = sequelize.define('Kingdom', {
    name: {
        type: DataTypes.STRING,
        unique: true,
    },
    description: {
        type: DataTypes.TEXT,
    },
    status: { // 'peace', 'war', 'truce'
        type: DataTypes.STRING,
        defaultValue: 'peace',
    },
    influence: {
        type: DataTypes.INTEGER,
        defaultValue: 50,
    },
    militaryPower: {
        type: DataTypes.INTEGER,
        defaultValue: 50,
    },
    leader: {
        type: DataTypes.STRING,
    }
});

const Conflict = sequelize.define('Conflict', {
    title: {
        type: DataTypes.STRING,
    },
    description: {
        type: DataTypes.TEXT,
    },
    involvedKingdoms: {
        type: DataTypes.TEXT, // JSON string of kingdom names
    },
    status: { // 'active', 'resolved'
        type: DataTypes.STRING,
        defaultValue: 'active',
    }
});

const RPMessage = sequelize.define('RPMessage', {
    senderJid: {
        type: DataTypes.STRING,
    },
    senderName: {
        type: DataTypes.STRING,
    },
    content: {
        type: DataTypes.TEXT,
    },
    location: {
        type: DataTypes.STRING,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
});

const NPC = sequelize.define('NPC', {
    name: {
        type: DataTypes.STRING,
        unique: true,
    },
    role: {
        type: DataTypes.STRING,
    },
    description: {
        type: DataTypes.TEXT,
    },
    location: {
        type: DataTypes.STRING,
    }
});

const Monster = sequelize.define('Monster', {
    name: {
        type: DataTypes.STRING,
        unique: true,
    },
    rank: {
        type: DataTypes.STRING,
    },
    health: {
        type: DataTypes.INTEGER,
    },
    strength: {
        type: DataTypes.INTEGER,
    },
    defense: {
        type: DataTypes.INTEGER,
    },
    agility: {
        type: DataTypes.INTEGER,
    },
    xp_reward: {
        type: DataTypes.INTEGER,
    },
    col_reward: {
        type: DataTypes.INTEGER,
    }
});

// Relationships
Player.hasOne(Bank);
Bank.belongsTo(Player);

Player.belongsToMany(Quest, { through: PlayerQuest });
Quest.belongsToMany(Player, { through: PlayerQuest });

Player.belongsToMany(Skill, { through: PlayerSkill });
Skill.belongsToMany(Player, { through: PlayerSkill });


async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');

    // Seed initial game data
    const dungeonCount = await Dungeon.count();
    if (dungeonCount === 0) {
        console.log('Seeding Dungeons for Aetherys...');
        await Dungeon.bulkCreate([
            // Rang E-D : Donjons Débutants
            { name: 'Forêt des Gobelins', description: 'Une forêt dense infestée de gobelins.', rank: 'E', floors: 5 },
            { name: 'Mine de Cobalt', description: 'Ancienne mine de minerai rare, refuge des kobolds.', rank: 'D', floors: 10 },
            { name: 'Jardin des Murmures', description: 'Un labyrinthe végétal où les fleurs murmurent des secrets.', rank: 'D', floors: 8 },

            // Rang C-B : Zones Mortelles
            { name: 'Caverne des Ombres', description: 'Une grotte obscure habitée par des spectres.', rank: 'C', floors: 15 },
            { name: 'Ruines de Xanadu', description: 'Les vestiges d\'une cité antique hantée.', rank: 'C', floors: 18 },
            { name: 'Forteresse de Fer', description: 'Une citadelle imprenable gardée par des golems.', rank: 'B', floors: 25 },
            { name: 'Montagnes du Tonnerre', description: 'Sommets perpétuellement frappés par la foudre.', rank: 'B', floors: 22 },
            { name: 'Crypte des Rois Oubliés', description: 'Tombeau des anciens souverains d\'Aetherys.', rank: 'B', floors: 18 },
            { name: 'Labyrinthe d\'Aincrad', description: 'Un défi complexe de 100 étages flottant dans le ciel.', rank: 'B', floors: 100 },

            // Rang A-S : Catastrophes Vivantes
            { name: 'Volcan d\'Ignis', description: 'Le coeur brûlant d\'Aetherys, domaine des dragons.', rank: 'A', floors: 30 },
            { name: 'Tour des Épreuves', description: 'Une tour s\'élevant vers les cieux, testant les héros.', rank: 'A', floors: 50 },
            { name: 'Citadelle de Cristal', description: 'Forteresse translucide aux pouvoirs magiques intenses.', rank: 'A', floors: 30 },
            { name: 'Donjon du Destin', description: 'Un donjon imprévisible dont personne n\'est revenu.', rank: 'S', floors: 50 },
            { name: 'Porte du Néant', description: 'La frontière finale protégeant le monde de l\'annihilation.', rank: 'S', floors: 1 },
            { name: 'Abysse de l\'Oubli', description: 'Un gouffre sans fond situé dans le Dominion Noir.', rank: 'S', floors: 50 },
            { name: 'Nécropole de Granit', description: 'Cité des morts-vivants sculptée dans la roche.', rank: 'S', floors: 45 }
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
            },
            {
                name: 'Liberator',
                description: 'L\'épée et le bouclier massifs de Heathcliff.',
                price: 10000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 20, defense: 40 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/d/df/Liberator_Shield.png'
            },
            {
                name: 'Kagemitsu G4',
                description: 'Un sabre laser (Photon Sword) extrêmement léger et tranchant.',
                price: 5500,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 30, strength: 5 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/e/e0/Kagemitsu_G4_Design.png'
            },
            {
                name: 'Wind Fleuret',
                description: 'Une rapière de haut niveau pour les joueurs agiles.',
                price: 1500,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 12 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/a/a2/Wind_Fleuret.png'
            },
            {
                name: 'Anneal Blade',
                description: 'Une épée droite à une main obtenue lors d\'une quête difficile.',
                price: 1200,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 10, agility: 2 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/2/25/Anneal_Blade.png'
            },
            {
                name: 'Excalibur',
                description: 'L\'épée la plus puissante d\'ALfheim Online.',
                price: 15000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 50, intelligence: 30, agility: 20 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/4/4e/Excalibur.png'
            },
            {
                name: 'Object Eraser',
                description: 'Une épée de MJ capable d\'effacer n\'importe quel objet du monde virtuel.',
                price: 50000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 100, intelligence: 100 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/a/a8/Object_Eraser.png'
            },
            {
                name: 'Infracheur de Ciel',
                description: 'Une épée lourde capable de briser les défenses les plus solides.',
                price: 3200,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 22, defense: 5 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/b/b5/Sky_Piercing_Sword.png'
            },
            {
                name: 'Rapière de Fleur de Givre',
                description: 'Une rapière imprégnée de l\'élément glace.',
                price: 2800,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 18, intelligence: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/e/e0/Frost_Flower_Rapier.png'
            },
            {
                name: 'Épée de l\'Arbre du Destin',
                description: 'Forgée à partir du bois sacré, elle résonne avec la nature.',
                price: 4800,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { intelligence: 25, luck: 15 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/e/e7/Gigas_Cedar.png'
            },
            {
                name: 'Karakurenai',
                description: 'Le katana courbe de Klein, capable de trancher l\'acier.',
                price: 3500,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 18, agility: 12 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/b/bc/Karakurenai.png'
            },
            {
                name: 'Mate-Chopper',
                description: 'Un hachoir terrifiant utilisé par le chef des Laughing Coffin.',
                price: 4200,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 28, luck: -5 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/4/4c/Mate_Chopper_Design.png'
            },
            {
                name: 'Gram',
                description: 'L\'épée à deux mains de Sigurd, imprégnée d\'une aura de vide.',
                price: 5200,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 30, intelligence: 5 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/2/2a/Gram.png'
            },
            {
                name: 'Tyrant Dragon',
                description: 'La hache massive d\'Agil, capable de briser n\'importe quelle garde.',
                price: 3800,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 35, defense: 5 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/3/36/Tyrant_Dragon.png'
            },
            {
                name: 'Shadow Dagger',
                description: 'Une dague rapide et empoisonnée utilisée par Silica.',
                price: 2200,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 20, luck: 8 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/8/87/Shadow_Dagger.png'
            },
            {
                name: 'Radiant Light',
                description: 'La rapière divine de Stacia, émettant une lumière pure.',
                price: 9000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 35, intelligence: 20 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/2/23/Radiant_Light.png'
            },
            {
                name: 'Time Splitting Sword',
                description: 'L\'épée de Bercouli, capable de trancher le passé et le futur.',
                price: 12000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 40, intelligence: 30 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/4/4e/Time_Splitting_Sword.png'
            },
            {
                name: 'Conflagrant Flame Bow',
                description: 'L\'arc de Deusolbert, décochant des flèches de feu inextinguibles.',
                price: 6500,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 25, intelligence: 15 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/6/6d/Conflagrant_Flame_Bow.png'
            },
            {
                name: 'Frostscale Whip',
                description: 'Le fouet d\'Eldrie, se transformant en serpent de givre.',
                price: 5800,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 22, intelligence: 18 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/e/e1/Frostscale_Whip.png'
            },
            {
                name: 'Anneau de Céleste',
                description: 'Un anneau augmentant la régénération de mana.',
                price: 2000,
                type: 'accessory',
                slot: 'none',
                statBonuses: { intelligence: 15, luck: 5 }
            },
            {
                name: 'Épée de la Forêt',
                description: 'Une épée de base pour les nouveaux aventuriers.',
                price: 300,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 5 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/b/b3/Anneal_Blade.png'
            },
            {
                name: 'Rapière de Fer',
                description: 'Une arme légère pour frapper vite.',
                price: 450,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { agility: 6 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/a/a2/Wind_Fleuret.png'
            },
            {
                name: 'Cape de l\'Ombre',
                description: 'Une cape favorisant la discrétion et l\'agilité.',
                price: 1500,
                type: 'armor',
                slot: 'chest',
                statBonuses: { agility: 12, defense: 3 }
            },
            {
                name: 'Amulette de Fortune',
                description: 'Une amulette bénie qui attire la chance.',
                price: 3000,
                type: 'accessory',
                slot: 'none',
                statBonuses: { luck: 25 }
            },
            {
                name: 'Bottes de Sept Lieues',
                description: 'Des bottes magiques permettant de parcourir de grandes distances.',
                price: 4000,
                type: 'armor',
                slot: 'legs',
                statBonuses: { agility: 30 }
            },
            {
                name: 'Livre des Sorts Anciens',
                description: 'Un grimoire contenant des connaissances oubliées.',
                price: 5000,
                type: 'item',
                slot: 'none',
                statBonuses: { intelligence: 40 }
            },
            {
                name: 'Anneau de Kirito',
                description: 'Un anneau légendaire augmentant tous les sens.',
                price: 25000,
                type: 'accessory',
                slot: 'none',
                statBonuses: { strength: 10, agility: 10, intelligence: 10, luck: 10, defense: 10 }
            },
            {
                name: 'Manteau de Minuit',
                description: 'Le manteau emblématique de Kirito, favorisant la discrétion.',
                price: 12000,
                type: 'armor',
                slot: 'chest',
                statBonuses: { agility: 25, defense: 15 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/c/c8/Black_wyrm_coat.png'
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
            { title: 'L\'Héritage du Désert', description: 'Retrouvez l\'amulette de l\'ancien pharaon dans le Désert de la Mort.', type: 'main', rank_required: 'C', reward_col: 700, reward_xp: 1200 },
            { title: 'Le Chant des Sirènes', description: 'Calmez la tempête mystique qui frappe l\'Océan de Corail.', type: 'side', rank_required: 'B', reward_col: 900, reward_xp: 1800 },
            { title: 'L\'Ascension Finale', description: 'Atteignez le 50ème étage de la Tour des Épreuves.', type: 'main', rank_required: 'A', reward_col: 3000, reward_xp: 10000 },
            { title: 'Le Cœur de Feu', description: 'Récupérez une écaille du Dragon d\'Ignis au sommet du volcan.', type: 'main', rank_required: 'S', reward_col: 10000, reward_xp: 50000 },
            { title: 'Le Mystère de la Citadelle', description: 'Enquêtez sur les disparitions inexpliquées dans la Citadelle de Cristal.', type: 'side', rank_required: 'A', reward_col: 2500, reward_xp: 4000 },
            { title: 'Herboriste de l\'Ombre', description: 'Collectez des plantes rares dans les Marais Empoisonnés.', type: 'side', rank_required: 'C', reward_col: 800, reward_xp: 1200 },
            { title: 'Chasseur de Tonnerre', description: 'Capturez l\'essence de la foudre au sommet des Montagnes du Tonnerre.', type: 'main', rank_required: 'B', reward_col: 1500, reward_xp: 2500 },
            { title: 'Le Repos des Rois', description: 'Purifiez la Crypte des Rois Oubliés de son influence maléfique.', type: 'main', rank_required: 'B', reward_col: 2000, reward_xp: 3500 },
            { title: 'Murmures de Fleurs', description: 'Écoutez et rapportez les secrets du Jardin des Murmures.', type: 'side', rank_required: 'D', reward_col: 400, reward_xp: 600 },
            { title: 'Sentinelle du Néant', description: 'Gardez la Porte du Néant contre une vague d\'envahisseurs.', type: 'main', rank_required: 'S', reward_col: 20000, reward_xp: 75000 },
            { title: 'Perles de l\'Océan', description: 'Plongez dans le Récif des Sirènes pour trouver les perles de lune.', type: 'side', rank_required: 'B', reward_col: 1100, reward_xp: 1900 },
            { title: 'Mirage de Sel', description: 'Survivez à une traversée du Désert de Sel sans perdre la raison.', type: 'side', rank_required: 'C', reward_col: 1300, reward_xp: 2200 },
            { title: 'Éclat d\'Émeraude', description: 'Protégez l\'Arbre de Vie au cœur de la Forêt d\'Émeraude.', type: 'main', rank_required: 'A', reward_col: 4500, reward_xp: 8000 },
        ]);
        console.log('Quests seeded.');
    }

    const skillCount = await Skill.count();
    if (skillCount === 0) {
        console.log('Seeding Skills...');
        await Skill.bulkCreate([
            // Techniques d'épée
            { name: 'Vertical Square', description: 'Un enchaînement de 4 coups d\'épée verticaux ultra-rapides.', type: 'sword_technique', manaCost: 20 },
            { name: 'Sonic Leap', description: 'Une charge fulgurante vers l\'ennemi.', type: 'sword_technique', manaCost: 15, statBonuses: { agility: 5 } },
            { name: 'Starburst Stream', description: 'La technique ultime à deux épées (50 coups).', type: 'sword_technique', manaCost: 100, statBonuses: { strength: 20, agility: 20 } },
            // Sorts
            { name: 'Fireball', description: 'Projette une boule de feu explosive.', type: 'spell', manaCost: 30, statBonuses: { intelligence: 10 } },
            { name: 'Healing Breeze', description: 'Un vent doux qui soigne les blessures légères.', type: 'spell', manaCost: 25 },
            { name: 'Ice Spikes', description: 'Fait jaillir des pics de glace du sol.', type: 'spell', manaCost: 35, statBonuses: { intelligence: 12 } },
            // Passifs
            { name: 'Regen', description: 'Restaure lentement la santé au fil du temps.', type: 'passive', statBonuses: { defense: 5 } },
            { name: 'Senseur de Mana', description: 'Permet de détecter les créatures magiques à proximité.', type: 'passive', statBonuses: { intelligence: 15 } },
            { name: 'Force d\'Hercule', description: 'Augmente de manière permanente la force brute.', type: 'passive', statBonuses: { strength: 15 } },
        ]);
        console.log('Skills seeded.');
    }

    const kingdomCount = await Kingdom.count();
    if (kingdomCount === 0) {
        console.log('Seeding Kingdoms for Aetherys...');
        await Kingdom.bulkCreate([
            { name: 'Empire Impérial d\'Elion', description: 'Puissant royaume central, symbole du dragon doré. Capitale: Lux Aeterna.', status: 'peace', influence: 95, militaryPower: 90, leader: 'Empereur Valerius II' },
            { name: 'Royaume Nordique de Valkyrr', description: 'Nation glaciale, guerriers aux runes et dompteurs de loups.', status: 'truce', influence: 75, militaryPower: 85, leader: 'Reine Freya' },
            { name: 'Sultanat d\'Azrak', description: 'Empire du désert, maîtres des artefacts anciens. Capitale: Sahra’Zul.', status: 'peace', influence: 80, militaryPower: 70, leader: 'Sultan Malek' },
            { name: 'République Maritime de Nereïs', description: 'Puissance navale du sud, maîtres explorateurs des mers.', status: 'peace', influence: 85, militaryPower: 65, leader: 'Amiral Kael' },
            { name: 'Dominion Noir de Vharos', description: 'Royaume de nécromancie et de morts-vivants. Ennemi de tous.', status: 'war', influence: 60, militaryPower: 95, leader: 'Lich Lord Vharos' },
            { name: 'Santuaires d\'Élysée', description: 'Terres sacrées protégées par des barrières magiques, foyer des prêtres et guérisseurs.', status: 'peace', influence: 40, militaryPower: 30, leader: 'Grande Prêtresse Selene' },
            { name: 'Terres Sauvages de Kormak', description: 'Territoires sans loi habités par des tribus barbares et des monstres.', status: 'war', influence: 20, militaryPower: 50, leader: 'Chef de Guerre Grom' }
        ]);
        console.log('Kingdoms seeded.');
    }

    const conflictCount = await Conflict.count();
    if (conflictCount === 0) {
        console.log('Seeding Conflicts...');
        await Conflict.bulkCreate([
            { title: 'La Croisade du Néant', description: 'Le Dominion Noir de Vharos lance des assauts massifs sur les frontières d\'Elion.', involvedKingdoms: JSON.stringify(['Empire Impérial d\'Elion', 'Dominion Noir de Vharos']), status: 'active' },
            { title: 'Guerre de la Route de Soie', description: 'Des tensions éclatent entre Azrak et Nereïs pour le contrôle des routes commerciales.', involvedKingdoms: JSON.stringify(['Sultanat d\'Azrak', 'République Maritime de Nereïs']), status: 'active' },
            { title: 'Incursion Barbare', description: 'Les tribus de Kormak pillent les villages frontaliers de Valkyrr.', involvedKingdoms: JSON.stringify(['Royaume Nordique de Valkyrr', 'Terres Sauvages de Kormak']), status: 'active' }
        ]);
        console.log('Conflicts seeded.');
    }

    const npcCount = await NPC.count();
    if (npcCount === 0) {
        console.log('Seeding NPCs for Eldoria & Elion...');
        await NPC.bulkCreate([
            { name: 'Directeur Magnus', role: 'Directeur de l\'Académie d\'Elion', description: 'Un mage légendaire supervisant la formation des recrues.', location: 'Académie Impériale' },
            { name: 'Forgeron Brokk', role: 'Maître de la Forge Impériale', description: 'Un artisan capable de forger les armes les plus résistantes.', location: 'Eldoria' },
            { name: 'Aubergiste Silas', role: 'Propriétaire du Griffon Rouge', description: 'Toujours au courant des dernières rumeurs.', location: 'Eldoria' },
            { name: 'Capitaine Valerius', role: 'Commandant de la Garde d\'Elion', description: 'Un guerrier austère et dévoué à l\'Empereur.', location: 'Lux Aeterna' },
            { name: 'Reine Freya', role: 'Souveraine de Valkyrr', description: 'Une dirigeante sage et puissante, protectrice des terres gelées.', location: 'Valkyrr' },
            { name: 'Sultan Malek', role: 'Maître d\'Azrak', description: 'Un collectionneur d\'artefacts mystérieux et richissime.', location: 'Sahra’Zul' },
            { name: 'Amiral Kael', role: 'Protecteur de Nereïs', description: 'Un marin aguerri qui connaît tous les secrets de l\'océan.', location: 'Nereïs' },
            { name: 'Lich Lord Vharos', role: 'Souverain du Dominion Noir', description: 'Une entité ancienne cherchant à plonger le monde dans le néant.', location: 'Citadelle de Cristal' },
            { name: 'Argo', role: 'L\'Informatrice', description: 'Une informatrice agile qui vend des secrets pour quelques Col.', location: 'Eldoria' },
            { name: 'Agil', role: 'Marchand Costaud', description: 'Un ancien guerrier tenant une boutique d\'objets rares.', location: 'Eldoria' },
            { name: 'Klein', role: 'Chef de guilde', description: 'Un samouraï jovial menant la guilde Fuurinkazan.', location: 'Eldoria' },
            { name: 'Sachi', role: 'Membre des Chats Noirs', description: 'Une jeune fille douce cherchant à surmonter sa peur du combat.', location: 'Eldoria' },
            { name: 'Heathcliff', role: 'Grand Maître', description: 'Le chef de la Confrérie des Chevaliers du Sang.', location: 'Lux Aeterna' },
            { name: 'Asuna', role: 'L\'Éclair', description: 'Sous-chef des Chevaliers du Sang, célèbre pour sa rapidité.', location: 'Lux Aeterna' },

            // Éducateurs et Personnel de l'Académie
            { name: 'Maître Ghyran', role: 'Instructeur de Combat', description: 'Un vétéran balafré qui ne tolère aucune paresse.', location: 'Académie Impériale' },
            { name: 'Professeur Elena', role: 'Enseignante de Magie', description: 'Experte en manipulation du mana et en sorts élémentaires.', location: 'Académie Impériale' },
            { name: 'Bibliothécaire Otho', role: 'Gardien du Savoir', description: 'Un vieil homme qui en sait plus qu\'il ne veut bien le dire.', location: 'Académie Impériale' },
            { name: 'Infirmière Joy', role: 'Guérisseuse', description: 'Douce mais ferme, elle soigne les blessures des entraînements.', location: 'Académie Impériale' },

            // Élèves de l'Académie - Rang F (Débutants)
            { name: 'Léo', role: 'Élève (Guerrier)', description: 'Toujours enthousiaste, il rêve de devenir un Chevalier du Sang.', location: 'Académie Impériale' },
            { name: 'Mia', role: 'Élève (Mage)', description: 'Studieuse, elle passe ses nuits à la bibliothèque.', location: 'Académie Impériale' },
            { name: 'Kenji', role: 'Élève (Assassin)', description: 'Silencieux et discret, il observe tout depuis les ombres.', location: 'Académie Impériale' },
            { name: 'Toby', role: 'Élève (Guerrier)', description: 'Un peu maladroit mais possède une force brute surprenante.', location: 'Académie Impériale' },

            // Élèves de l'Académie - Rang E-D
            { name: 'Sora', role: 'Élève (Épéiste)', description: 'Un prodige arrogant qui se croit déjà au-dessus des autres.', location: 'Académie Impériale' },
            { name: 'Lyra', role: 'Élève (Archère)', description: 'Calme et précise, elle ne rate jamais sa cible au champ de tir.', location: 'Académie Impériale' },
            { name: 'Ryu', role: 'Élève (Moine)', description: 'S\'entraîne pieds nus sous la cascade de l\'Académie.', location: 'Académie Impériale' },
            { name: 'Emi', role: 'Élève (Prêtresse)', description: 'Dévouée à la Lumière, elle aide les nouveaux élèves.', location: 'Académie Impériale' },

            // Élèves de l'Académie - Rang C-B (Élites)
            { name: 'Jax', role: 'Élève (Chevalier)', description: 'Le meilleur de sa promotion, respecté de tous.', location: 'Académie Impériale' },
            { name: 'Zelda', role: 'Élève (Invocatrice)', description: 'Capable de matérialiser de petites créatures de mana.', location: 'Académie Impériale' },
            { name: 'Kaelith', role: 'Élève (Lame-Sort)', description: 'Fusionne la magie et le fer avec une grâce mortelle.', location: 'Académie Impériale' }
        ]);
        console.log('NPCs seeded.');
    }

    const monsterCount = await Monster.count();
    if (monsterCount === 0) {
        console.log('Seeding Monsters...');
        await Monster.bulkCreate([
            { name: 'Gobelin', rank: 'F', health: 50, strength: 5, defense: 2, agility: 5, xp_reward: 20, col_reward: 10 },
            { name: 'Loup Sauvage', rank: 'F', health: 40, strength: 8, defense: 1, agility: 12, xp_reward: 25, col_reward: 5 },
            { name: 'Kobold Mineur', rank: 'E', health: 100, strength: 12, defense: 8, agility: 10, xp_reward: 50, col_reward: 30 },
            { name: 'Slime Géant', rank: 'E', health: 150, strength: 10, defense: 15, agility: 2, xp_reward: 45, col_reward: 20 },
            { name: 'Orc Guerrier', rank: 'D', health: 300, strength: 25, defense: 15, agility: 10, xp_reward: 150, col_reward: 80 },
            { name: 'Spectre des Ruines', rank: 'C', health: 200, strength: 30, defense: 50, agility: 20, xp_reward: 400, col_reward: 150 },
            { name: 'Golem de Fer', rank: 'B', health: 1000, strength: 60, defense: 80, agility: 5, xp_reward: 1500, col_reward: 500 },
            { name: 'Dragon d\'Ignis', rank: 'A', health: 5000, strength: 150, defense: 120, agility: 80, xp_reward: 10000, col_reward: 5000 },
            { name: 'Le Faucheur', rank: 'S', health: 20000, strength: 400, defense: 300, agility: 500, xp_reward: 100000, col_reward: 50000 }
        ]);
        console.log('Monsters seeded.');
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
  Skill,
  Kingdom,
  Conflict,
  NPC,
  Monster,
  PlayerSkill,
  RPMessage,
  setupDatabase,
};
