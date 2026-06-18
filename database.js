const { Sequelize, DataTypes } = require('sequelize');
const { execSync } = require('child_process');

let sequelize;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
  console.log('[DB] Vérification de la connexion PostgreSQL...');
  try {
    // Probe sync avec un timeout de 10 secondes
    execSync(`node -e "const { Sequelize } = require('sequelize'); const s = new Sequelize(process.env.DB_URL, { dialect: 'postgres', logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } }); s.authenticate().then(() => process.exit(0)).catch((e) => { process.exit(1); })"`, {
      env: { ...process.env, DB_URL: dbUrl },
      timeout: 10000,
      stdio: 'ignore'
    });
    console.log('[DB] PostgreSQL est accessible. Connexion en cours...');
    sequelize = new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });
  } catch (e) {
    console.error('[DB] PostgreSQL inaccessible (ENOTFOUND ou Timeout). Basculement sur SQLite local.');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: 'gheno-city.sqlite',
      logging: false,
    });
  }
} else {
  console.log('[DB] Pas de DATABASE_URL. Utilisation de SQLite local.');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'gheno-city.sqlite',
    logging: false,
  });
}

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
  family: {
    type: DataTypes.STRING,
    defaultValue: 'Aucune',
  },
  derivative: {
    type: DataTypes.STRING,
    defaultValue: 'Aucun',
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
  academicYear: {
    type: DataTypes.INTEGER,
    defaultValue: 1, // 1ere année, etc.
  },
  col: {
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
  mana: {
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
      try {
          return rawValue ? JSON.parse(rawValue) : [];
      } catch (e) {
          return [];
      }
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
    defaultValue: 'normal',
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
    allowNull: true,
  },
  awaitingProfilePic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isGod: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  profilePicUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  schoolName: {
    type: DataTypes.STRING,
    defaultValue: 'Aucune',
  },
  academicGrade: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  occupation: {
    type: DataTypes.STRING,
    defaultValue: 'Citoyen',
  },
  organization: {
    type: DataTypes.STRING,
    defaultValue: 'Aucune',
  },
  influence: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  tutorialStep: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  tutorialTurns: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
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
  name: { type: DataTypes.STRING, unique: true },
  description: { type: DataTypes.TEXT },
  price: { type: DataTypes.INTEGER, defaultValue: 0 },
  type: { type: DataTypes.STRING },
  rarity: { type: DataTypes.STRING, defaultValue: 'common' },
  slot: { type: DataTypes.STRING, defaultValue: 'none' },
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
  imageUrl: { type: DataTypes.STRING, allowNull: true },
});

const Dungeon = sequelize.define('Dungeon', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    rank: { type: DataTypes.STRING },
    floors: { type: DataTypes.INTEGER, defaultValue: 1 }
});

const Quest = sequelize.define('Quest', {
    title: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    type: { type: DataTypes.STRING, defaultValue: 'side' },
    rank_required: { type: DataTypes.STRING, defaultValue: 'E' },
    reward_col: { type: DataTypes.INTEGER, defaultValue: 0 },
    reward_xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    // Ordered quest chains ("quêtes qui suivent des ordres").
    chain: { type: DataTypes.STRING, allowNull: true }, // name of the chain
    step: { type: DataTypes.INTEGER, defaultValue: 1 }, // order within the chain
    objective: { type: DataTypes.TEXT, allowNull: true },
    nextQuestTitle: { type: DataTypes.STRING, allowNull: true }, // next quest in the chain
    isMultiplayer: { type: DataTypes.BOOLEAN, defaultValue: false }, // shared/co-op quest
});

const PlayerQuest = sequelize.define('PlayerQuest', {
    status: { type: DataTypes.STRING, defaultValue: 'not_started' },
    progress: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0-100
    // Lets the AI "modifier le cours de certaines quêtes".
    branch: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
});

const Bank = sequelize.define('Bank', {
    balance: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const Skill = sequelize.define('Skill', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    type: { type: DataTypes.STRING },
    manaCost: { type: DataTypes.INTEGER, defaultValue: 0 },
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
    level: { type: DataTypes.INTEGER, defaultValue: 1 }
});

const Kingdom = sequelize.define('Kingdom', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: 'peace' },
    influence: { type: DataTypes.INTEGER, defaultValue: 50 },
    militaryPower: { type: DataTypes.INTEGER, defaultValue: 50 },
    leader: { type: DataTypes.STRING }
});

const Conflict = sequelize.define('Conflict', {
    title: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    involvedKingdoms: {
        type: DataTypes.TEXT,
        get() {
            const rawValue = this.getDataValue('involvedKingdoms');
            try { return rawValue ? JSON.parse(rawValue) : []; } catch (e) { return []; }
        },
        set(value) { this.setDataValue('involvedKingdoms', JSON.stringify(value)); },
    },
    status: { type: DataTypes.STRING, defaultValue: 'active' }
});

const School = sequelize.define('School', {
    name: { type: DataTypes.STRING, unique: true },
    specialty: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    kingdomName: { type: DataTypes.STRING }
});

const RPMessage = sequelize.define('RPMessage', {
    senderJid: { type: DataTypes.STRING },
    senderName: { type: DataTypes.STRING },
    content: { type: DataTypes.TEXT },
    location: { type: DataTypes.STRING },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const NPC = sequelize.define('NPC', {
    name: { type: DataTypes.STRING, unique: true },
    role: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    location: { type: DataTypes.STRING },
    powerLevel: { type: DataTypes.INTEGER, defaultValue: 50 },
    specialty: { type: DataTypes.STRING },
    imageUrl: { type: DataTypes.STRING, allowNull: true }
});

const Entity = sequelize.define('Entity', {
    name: { type: DataTypes.STRING, unique: true },
    type: { type: DataTypes.STRING }, // 'celestial', 'bestial', 'ancient'
    description: { type: DataTypes.TEXT },
    power: { type: DataTypes.TEXT },
    pactBonus: {
        type: DataTypes.TEXT,
        get() {
            const raw = this.getDataValue('pactBonus');
            return raw ? JSON.parse(raw) : {};
        },
        set(val) { this.setDataValue('pactBonus', JSON.stringify(val)); }
    }
});

const Pact = sequelize.define('Pact', {
    status: { type: DataTypes.STRING, defaultValue: 'active' }, // 'active', 'broken'
    resonance: { type: DataTypes.INTEGER, defaultValue: 10 } // resonance level 0-100
});

const Club = sequelize.define('Club', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    specialty: { type: DataTypes.STRING },
    leaderName: { type: DataTypes.STRING }
});

const PlayerClub = sequelize.define('PlayerClub', {
    rank: { type: DataTypes.STRING, defaultValue: 'Membre' }
});

const Duel = sequelize.define('Duel', {
    playerAJid: { type: DataTypes.STRING },
    playerBJid: { type: DataTypes.STRING },
    startTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    lastActionTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    location: { type: DataTypes.STRING }
});

const House = sequelize.define('House', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING },
    price: { type: DataTypes.INTEGER },
    location: { type: DataTypes.STRING },
    ownerId: { type: DataTypes.STRING, allowNull: true },
    storage: {
        type: DataTypes.TEXT,
        defaultValue: '[]',
        get() {
            const raw = this.getDataValue('storage');
            try { return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
        },
        set(val) { this.setDataValue('storage', JSON.stringify(val)); }
    },
    config: {
        type: DataTypes.TEXT,
        defaultValue: '{"theme": "moderne", "color": "blanc"}',
        get() {
            const raw = this.getDataValue('config');
            try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
        },
        set(val) { this.setDataValue('config', JSON.stringify(val)); }
    }
});

const Monster = sequelize.define('Monster', {
    name: { type: DataTypes.STRING, unique: true },
    rank: { type: DataTypes.STRING },
    health: { type: DataTypes.INTEGER },
    strength: { type: DataTypes.INTEGER },
    defense: { type: DataTypes.INTEGER },
    agility: { type: DataTypes.INTEGER },
    xp_reward: { type: DataTypes.INTEGER },
    col_reward: { type: DataTypes.INTEGER },
    imageUrl: { type: DataTypes.STRING, allowNull: true }
});

Player.hasOne(Bank);
Bank.belongsTo(Player);
Player.belongsToMany(Quest, { through: PlayerQuest });
Quest.belongsToMany(Player, { through: PlayerQuest });
Player.belongsToMany(Skill, { through: PlayerSkill });
Skill.belongsToMany(Player, { through: PlayerSkill });

Player.belongsToMany(Entity, { through: Pact, as: 'Entities' });
Entity.belongsToMany(Player, { through: Pact, as: 'Players' });

Player.belongsToMany(Club, { through: PlayerClub, as: 'Clubs' });
Club.belongsToMany(Player, { through: PlayerClub, as: 'Players' });

Player.hasMany(House, { foreignKey: 'ownerId', as: 'Houses' });
House.belongsTo(Player, { foreignKey: 'ownerId', as: 'Owner' });

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connection established.');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');

    // Seed initial game data if empty
    const dungeonCount = await Dungeon.count();
    if (dungeonCount === 0) {
        console.log('Seeding Dungeons...');
        await Dungeon.bulkCreate([
            { name: 'Forêt des Gobelins', description: 'Une forêt dense infestée de gobelins.', rank: 'E', floors: 5 },
            { name: 'Mine de Cobalt', description: 'Ancienne mine de minerai rare.', rank: 'D', floors: 10 },
            { name: 'Caverne des Ombres', description: 'Une grotte obscure habitée par des spectres.', rank: 'C', floors: 15 },
            { name: 'Labyrinthe d\'Aincrad', description: 'Un défi complexe de 100 étages.', rank: 'B', floors: 100 },
            { name: 'Volcan d\'Ignis', description: 'Le coeur brûlant d\'Aetherys.', rank: 'A', floors: 30 },
            { name: 'Donjon du Destin', description: 'Un donjon imprévisible.', rank: 'S', floors: 50 }
        ]);
    }

    const itemsToSeed = [
            {
                name: 'Costume de Héritier Élégant',
                description: 'Un costume moderne infusé de fibres de mana.',
                price: 1200,
                type: 'clothing',
                rarity: 'rare',
                slot: 'chest',
                statBonuses: { luck: 5, intelligence: 2 },
                imageUrl: 'https://gamesfashionarchive.net/viewer/images/large/Girls_Side_1st_Love/1st_Love_010.jpg'
            },
            {
                name: 'Uniforme de l\'Académie (1ère Année)',
                description: 'L\'uniforme standard pour les nouveaux étudiants.',
                price: 500,
                type: 'clothing',
                rarity: 'common',
                slot: 'chest',
                statBonuses: { intelligence: 5 },
                imageUrl: 'https://gamesfashionarchive.net/viewer/images/large/Girls_Side_1st_Love/1st_Love_034.jpg'
            },
            {
                name: 'Elucidator',
                description: 'Une épée noire obsidienne d\'une puissance incroyable.',
                price: 5000,
                type: 'weapon',
                rarity: 'legendary',
                slot: 'weapon',
                statBonuses: { strength: 25, agility: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/5/53/Elucidator.png'
            },
            {
                name: 'Dark Repulser',
                description: 'Une épée forgée à partir d\'un cristal rare.',
                price: 4500,
                type: 'weapon',
                rarity: 'legendary',
                slot: 'weapon',
                statBonuses: { strength: 20, agility: 15 },
                imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/8/82/Dark_Repulser.png'
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
                name: 'Manteau de l\'Exilé',
                description: 'Un long manteau en cuir sombre, idéal pour la discrétion.',
                price: 800,
                type: 'clothing',
                rarity: 'rare',
                slot: 'chest',
                statBonuses: { agility: 8, luck: 3 },
                imageUrl: 'https://gamesfashionarchive.net/viewer/images/large/Girls_Side_1st_Love/1st_Love_060.jpg'
            },
            {
                name: 'Robe d\'Enchanteur Lunaire',
                description: 'Tissée avec des fils d\'argent qui brillent sous la lune.',
                price: 2500,
                type: 'clothing',
                rarity: 'epic',
                slot: 'chest',
                statBonuses: { intelligence: 15, mana: 100 },
                imageUrl: 'https://gamesfashionarchive.net/viewer/images/large/Girls_Side_1st_Love/1st_Love_122.jpg'
            },
            {
                name: 'Armure de Plate d\'Orgueil',
                description: 'Une armure étincelante imposante.',
                price: 3000,
                type: 'clothing',
                rarity: 'rare',
                slot: 'chest',
                statBonuses: { defense: 20, strength: 5 },
                imageUrl: 'https://gamesfashionarchive.net/viewer/images/large/Girls_Side_1st_Love/1st_Love_210.jpg'
            }
        ];

    for (const item of itemsToSeed) {
        await Item.findOrCreate({ where: { name: item.name }, defaults: item });
    }

    const skillCount = await Skill.count();
    if (skillCount === 0) {
        await Skill.bulkCreate([
            // Techniques d'épée
            { name: 'Vertical Square', description: 'Un enchaînement de 4 coups verticaux.', type: 'sword_technique', manaCost: 20 },
            { name: 'Sonic Leap', description: 'Une charge fulgurante.', type: 'sword_technique', manaCost: 15, statBonuses: { agility: 5 } },
            { name: 'Starburst Stream', description: 'Technique ultime à deux épées (50 coups).', type: 'sword_technique', manaCost: 100, statBonuses: { strength: 20, agility: 20 } },

            // Auras
            { name: 'Aura de Bravoure', description: 'Une aura rouge augmentant la force.', type: 'aura', manaCost: 40, statBonuses: { strength: 15 } },
            { name: 'Aura de Gardien', description: 'Une aura dorée renforçant la défense.', type: 'aura', manaCost: 40, statBonuses: { defense: 15 } },
            { name: 'Aura de Célérité', description: 'Une aura verte décuplant la vitesse.', type: 'aura', manaCost: 40, statBonuses: { agility: 15 } },
            { name: 'Aura de Mana', description: 'Une aura bleue augmentant la puissance magique.', type: 'aura', manaCost: 40, statBonuses: { intelligence: 15 } },
            { name: 'Aura du Dieu de la Mort', description: 'Une aura noire qui terrifie l\'ennemi.', type: 'aura', manaCost: 80, statBonuses: { strength: 40, luck: 20 } },

            // Magie Avancée
            { name: 'Brasier de l\'Enfer', description: 'Une tornade de feu noir consumant tout.', type: 'spell', manaCost: 90, statBonuses: { intelligence: 45 } },
            { name: 'Zéro Absolu', description: 'Gèle tout instantanément dans une zone massive.', type: 'spell', manaCost: 90, statBonuses: { intelligence: 45 } },
            { name: 'Éclair Enchaîné', description: 'Foudre bondissant entre les cibles.', type: 'spell', manaCost: 50, statBonuses: { intelligence: 20 } },
            { name: 'Trou Noir', description: 'Crée un vide attirant et écrasant tout.', type: 'spell', manaCost: 80, statBonuses: { intelligence: 30 } },
            { name: 'Pluie de Météores', description: 'Déluge de feu s\'abattant du ciel.', type: 'spell', manaCost: 150, statBonuses: { intelligence: 60 } },

            // Passifs
            { name: 'Régénération Accélérée', description: 'Soigne les blessures au fil du temps.', type: 'passive', statBonuses: { defense: 5 } },
            { name: 'Senseur de Mana', description: 'Détecte les présences magiques.', type: 'passive', statBonuses: { intelligence: 10 } }
        ]);
    }

    const houseCount = await House.count();
    if (houseCount === 0) {
        await House.bulkCreate([
            { name: 'Appartement Moderne à Eldoria', price: 10000, location: 'Eldoria' },
            { name: 'Villa de Luxe à Valkyr', price: 50000, location: 'Valkyr' },
            { name: 'Studio Étudiant (Académie)', price: 5000, location: 'Académie Impériale' }
        ]);
    }

    const kingdomsToSeed = [
        { name: 'Néanthea', description: 'Ancienne civilisation disparue, maudite par les dieux pour avoir exploré l\'Interstice.', status: 'destroyed', influence: 0, militaryPower: 100, leader: 'Roi Aldren' },
        { name: 'Nécropolis', description: 'Le Monde des Morts, une cité silencieuse où les âmes attendent leur jugement.', status: 'neutral', influence: 100, militaryPower: 80, leader: 'Orpheon' },
        { name: 'Empire Impérial d\'Elion', description: 'Puissant royaume central.', status: 'peace', influence: 95, militaryPower: 90, leader: 'Empereur Valerius II' },
        { name: 'Dominion Noir de Vharos', description: 'Royaume de nécromancie.', status: 'war', influence: 60, militaryPower: 95, leader: 'Lich Lord Vharos' },
        { name: 'Principauté de Valkyr', description: 'Centre technologique et magique d\'avant-garde.', status: 'peace', influence: 80, militaryPower: 70, leader: 'Archimage Kaelen' },
        { name: 'Ordre de la Rose d\'Argent', description: 'Chevalerie d\'élite protégeant les frontières.', status: 'peace', influence: 70, militaryPower: 85, leader: 'Grand Maître Alistair' },
        { name: 'Syndicat de Gheno', description: 'Puissant cartel contrôlant l\'économie souterraine.', status: 'neutral', influence: 90, militaryPower: 60, leader: 'L\'Ombre' },
        { name: 'Ligue des Explorateurs', description: 'Guilde dédiée à la découverte de reliques anciennes.', status: 'peace', influence: 50, militaryPower: 40, leader: 'Elena Drake' },
        { name: 'Sanctuaire d\'Yggdrasil', description: 'Coalition de protecteurs de la nature et des esprits.', status: 'peace', influence: 60, militaryPower: 50, leader: 'Dryade Elara' },
        { name: 'Coalition de Forgefer', description: 'Union de forgerons et de marchands d\'armes.', status: 'peace', influence: 75, militaryPower: 65, leader: 'Thrain Cœur-de-Enclume' },
        { name: 'Cité Flottante de Laputa', description: 'Refuge secret pour les mages les plus érudits.', status: 'neutral', influence: 85, militaryPower: 80, leader: 'Conseil des Sept' },
        { name: 'Inquisition de la Lumière', description: 'Groupe religieux traquant les déviances magiques.', status: 'peace', influence: 65, militaryPower: 75, leader: 'Inquisiteur Malakai' },
        { name: 'Clan des Crocs de Fer', description: 'Alliance de tribus guerrières nomades.', status: 'war', influence: 40, militaryPower: 90, leader: 'Gromm le Sanguinaire' },
        { name: 'Archive Éternelle', description: 'Institution neutre gardienne de l\'histoire du monde.', status: 'neutral', influence: 95, militaryPower: 30, leader: 'Le Conservateur' }
    ];
    for (const k of kingdomsToSeed) {
        await Kingdom.findOrCreate({ where: { name: k.name }, defaults: k });
    }

    const npcsToSeed = [
        { name: 'Aldren', role: 'Roi de Néanthea', description: 'Souverain déchu ayant ouvert les portes de l\'Interstice.', location: 'Interstice', powerLevel: 100, specialty: 'Essence Primordiale', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20fallen%20king%20Aldren%20of%20Neanthea,%20void%20armor,%20majestic%20but%20broken?model=flux-anime' },
        { name: 'Orpheon', role: 'Juge des Âmes', description: 'Gouverneur mystérieux de Nécropolis.', location: 'Nécropolis', powerLevel: 99, specialty: 'Jugement Mortuaire', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20mysterious%20judge%20of%20souls%20Orpheon,%20Necropolis,%20cloak%20of%20shadows?model=flux-anime' },
        { name: 'Directeur Magnus', role: 'Directeur de l\'Académie', description: 'Mage légendaire, gardien du Savoir Interdit.', location: 'Académie Impériale', powerLevel: 98, specialty: 'Magie Dimensionnelle', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20elderly%20powerful%20wizard%20Director%20Magnus,%20Imperial%20Academy,%20blue%20robes?model=flux-anime' },
        { name: 'Asuna', role: 'L\'Éclair', description: 'Sous-chef des Chevaliers du Sang, héritière d\'une lignée de duellistes.', location: 'Lux Aeterna', powerLevel: 92, specialty: 'Vitesse de pointe', imageUrl: 'https://static.wikia.nocookie.net/swordartonline/images/8/8d/Asuna_Ordinal_Scale.png' },
        { name: 'Général Kael', role: 'Commandant d\'Elion', description: 'Vétéran des guerres contre le Dominion Noir.', location: 'Cœur de l\'Empire', powerLevel: 95, specialty: 'Tactique et Force', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20battle-hardened%20general%20Kael,%20golden%20armor,%20stern%20look?model=flux-anime' },
        { name: 'Lumière d\'Aetherys', role: 'Héraut Céleste', description: 'Une entité pure sous forme humaine.', location: 'Temple Céleste', powerLevel: 99, specialty: 'Purification', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20divine%20herald%20Light%20of%20Aetherys,%20glowing%20white%20wings,%20ethereal?model=flux-anime' },
        { name: 'Archimage Kaelen', role: 'Souverain de Valkyr', description: 'Visionnaire alliant magie et technologie.', location: 'Valkyr', powerLevel: 94, specialty: 'Technomancie', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20magical%20engineer%20Archmage%20Kaelen,%20steampunk%20elements,%20Valkyr?model=flux-anime' },
        { name: 'Grand Maître Alistair', role: 'Chef de la Rose d\'Argent', description: 'Chevalier d\'une droiture inflexible.', location: 'Citadelle d\'Argent', powerLevel: 90, specialty: 'Escrime Sacrée', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20noble%20knight%20Alistair,%20Silver%20Rose%20armor,%20claymore?model=flux-anime' },
        { name: 'L\'Ombre', role: 'Maître du Syndicat', description: 'Nul ne connaît son visage, mais tous craignent son influence.', location: 'Bas-fonds de Gheno', powerLevel: 88, specialty: 'Assassinat et Espionnage', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20masked%20assassin%20The%20Shadow,%20rogue%20attire,%20daggers?model=flux-anime' },
        { name: 'Elena Drake', role: 'Maîtresse de la Ligue', description: 'Exploratrice intrépide assoiffée de découvertes.', location: 'Hall des Explorateurs', powerLevel: 85, specialty: 'Archéologie Magique', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20adventurer%20Elena%20Drake,%20explorer%20hat,%20magical%20artifact?model=flux-anime' },
        { name: 'Dryade Elara', role: 'Gardienne d\'Yggdrasil', description: 'Communie directement avec l\'arbre monde.', location: 'Forêt Éternelle', powerLevel: 93, specialty: 'Magie Naturelle', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20forest%20spirit%20Dryad%20Elara,%20green%20hair,%20vine%20dress?model=flux-anime' },
        { name: 'Thrain Cœur-de-Enclume', role: 'Doyen de Forgefer', description: 'Le plus grand forgeron vivant.', location: 'Forge Centrale', powerLevel: 82, specialty: 'Métallurgie Divine', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20stout%20dwarf%20blacksmith%20Thrain,%20glowing%20forge,%20giant%20hammer?model=flux-anime' },
        { name: 'Malakai l\'Inquisiteur', role: 'Héraut de la Lumière', description: 'Traque sans relâche les "corrompus".', location: 'Grand Temple', powerLevel: 91, specialty: 'Magie de Purge', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20scary%20inquisitor%20Malakai,%20white%20and%20red%20robes,%20burning%20cross?model=flux-anime' },
        { name: 'Gromm le Sanguinaire', role: 'Seigneur de Guerre', description: 'Un colosse ne vivant que pour la bataille.', location: 'Terres Sauvages', powerLevel: 92, specialty: 'Berserker', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20giant%20orc%20warrior%20Gromm,%20savage%20axes,%20bloodstained?model=flux-anime' },
        { name: 'Le Conservateur', role: 'Gardien de l\'Archive', description: 'Une entité qui semble exister hors du temps.', location: 'L\'Archive Éternelle', powerLevel: 97, specialty: 'Omniscience', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20cosmic%20librarian%20The%20Curator,%20floating%20books,%20nebula%20skin?model=flux-anime' }
    ];
    for (const npc of npcsToSeed) {
        await NPC.findOrCreate({
            where: { name: npc.name },
            defaults: npc
        });
        // Also update existing ones to add imageUrl if they were already seeded
        await NPC.update({ imageUrl: npc.imageUrl }, { where: { name: npc.name } });
    }

    const entitiesToSeed = [
        {
            name: 'Le Roi Vide', type: 'ancient', description: 'Entité endormie au cœur de l\'Interstice, gardien ou destructeur selon les récits.',
            power: 'Contrôle du Néant et instabilité temporelle.', pactBonus: { intelligence: 50, luck: 50 }
        },
        {
            name: 'Ignis le Phénix', type: 'bestial', description: 'Le souverain des flammes éternelles.',
            power: 'Contrôle absolu du feu.', pactBonus: { strength: 20, intelligence: 10 }
        },
        {
            name: 'Aeria la Céleste', type: 'celestial', description: 'La protectrice des cieux de cristal.',
            power: 'Manipulation des courants d\'air et soins.', pactBonus: { agility: 20, luck: 15 }
        },
        {
            name: 'Valthar l\'Ancien', type: 'ancient', description: 'Un titan de pierre oublié.',
            power: 'Résistance physique inébranlable.', pactBonus: { defense: 30, strength: 5 }
        },
        {
            name: 'Umbra, le Voile Nocturne', type: 'ancient', description: 'Entité née de l\'absence de lumière.',
            power: 'Dissimulation parfaite et ombres tranchantes.', pactBonus: { agility: 25, intelligence: 5 }
        },
        {
            name: 'Solariel, le Flambeau Céleste', type: 'celestial', description: 'Archange de pur éclat, symbole de justice.',
            power: 'Lumière purificatrice et jugement divin.', pactBonus: { intelligence: 20, defense: 10 }
        },
        {
            name: 'Krakos l\'Indomptable', type: 'bestial', description: 'Léviathan des abysses, force brute des océans.',
            power: 'Contrôle des marées et force colossale.', pactBonus: { strength: 30, defense: 5 }
        },
        {
            name: 'Chronos, l\'Horloger du Destin', type: 'ancient', description: 'Gardien des flux temporels.',
            power: 'Manipulation mineure du temps et prémonition.', pactBonus: { luck: 30, agility: 10 }
        },
        {
            name: 'Gaia, le Cœur du Monde', type: 'ancient', description: 'L\'esprit de la terre et des racines profondes.',
            power: 'Géokinésie et régénération vitale.', pactBonus: { defense: 35, strength: 5 }
        },
        {
            name: 'Sylphi, la Muse des Brises', type: 'bestial', description: 'Esprit féérique de l\'air et de la liberté.',
            power: 'Vol et contrôle des vents.', pactBonus: { agility: 30, luck: 10 }
        },
        {
            name: 'Obsidius, le Forgeur de Mondes', type: 'ancient', description: 'Géant de magma vivant dans les volcans.',
            power: 'Forge magique et contrôle de la lave.', pactBonus: { strength: 25, defense: 15 }
        },
        {
            name: "Lunaris, l'Astre d'Argent", type: 'celestial', description: 'Déesse de la lune et des secrets nocturnes.',
            power: 'Illusions lunaires et clairvoyance.', pactBonus: { intelligence: 30, luck: 15 }
        },
        {
            name: 'Venomys, le Roi des Vipères', type: 'bestial', description: 'Serpent colossal au poison corrosif.',
            power: 'Toxicité absolue et morsure mortelle.', pactBonus: { agility: 25, strength: 10 }
        },
        {
            name: 'Aetherius, le Gardien du Vide', type: 'celestial', description: 'Entité abstraite régnant sur le mana pur.',
            power: 'Absorption et projection de mana brut.', pactBonus: { intelligence: 40 }
        }
    ];
    for (const entity of entitiesToSeed) {
        await Entity.findOrCreate({ where: { name: entity.name }, defaults: entity });
    }

    const monsterCount = await Monster.count();
    if (monsterCount === 0) {
        console.log('Seeding Monsters & Bosses...');
        await Monster.bulkCreate([
            { name: 'Loup d\'Ombre', rank: 'E', health: 50, strength: 12, defense: 5, agility: 15, xp_reward: 20, col_reward: 10 },
            { name: 'Gobelin Éclaireur', rank: 'E', health: 40, strength: 10, defense: 4, agility: 12, xp_reward: 15, col_reward: 8 },
            { name: 'Orque Guerrier', rank: 'D', health: 150, strength: 25, defense: 15, agility: 8, xp_reward: 80, col_reward: 50 },
            { name: 'Spectre des Mines', rank: 'C', health: 200, strength: 35, defense: 25, agility: 30, xp_reward: 200, col_reward: 150 },
            { name: 'Chimère de Sang', rank: 'B', health: 500, strength: 60, defense: 45, agility: 50, xp_reward: 600, col_reward: 400 },
            { name: 'Dragon d\'Azur', rank: 'A', health: 2000, strength: 150, defense: 120, agility: 80, xp_reward: 5000, col_reward: 3000 },
            { name: 'Le Roi Gobelin (BOSS)', rank: 'D', health: 400, strength: 40, defense: 30, agility: 20, xp_reward: 500, col_reward: 1000 },
            { name: 'Vharos le Seigneur Liche (BOSS)', rank: 'A', health: 3000, strength: 200, defense: 150, agility: 100, xp_reward: 10000, col_reward: 5000 },
            { name: 'L\'Ombre du Néant (BOSS FINAL)', rank: 'S', health: 10000, strength: 500, defense: 400, agility: 300, xp_reward: 100000, col_reward: 50000 }
        ]);
    }

    const clubCount = await Club.count();
    if (clubCount === 0) {
        await Club.bulkCreate([
            { name: 'Club de Kendo Magique', description: 'Entraînement intensif à la lame infusée de mana.', specialty: 'Dégâts physiques/magiques', leaderName: 'Kazuma' },
            { name: 'Club d\'Occultisme', description: 'Étude des pactes et des entités anciennes.', specialty: 'Connaissance des entités', leaderName: 'Rias' },
            { name: 'Club de Musique de l\'Ether', description: 'Utilisation des ondes sonores pour buff les alliés.', specialty: 'Support/Heal', leaderName: 'Mio' },
            { name: 'Conseil des Élèves', description: 'Gestion administrative et discipline de l\'école.', specialty: 'Influence sociale', leaderName: 'Satsuki' }
        ]);
    }

    const questCount = await Quest.count();
    if (questCount === 0) {
        console.log('Seeding Quests...');
        await Quest.bulkCreate([
            // Ordered chain "L'Ascension de l'Aventurier" (quêtes qui se suivent dans l'ordre)
            {
                title: 'Premiers Pas à Eldoria', description: 'Le départ de ton aventure à Eldoria.',
                objective: "Parle à un PNJ d'Eldoria et accepte ta première mission de chasse.",
                type: 'main', chain: "L'Ascension de l'Aventurier", step: 1,
                nextQuestTitle: 'La Chasse aux Gobelins', rank_required: 'F', reward_col: 100, reward_xp: 80
            },
            {
                title: 'La Chasse aux Gobelins', description: 'Les gobelins menacent les routes commerciales.',
                objective: 'Élimine 5 gobelins dans la Forêt des Gobelins.',
                type: 'main', chain: "L'Ascension de l'Aventurier", step: 2,
                nextQuestTitle: "L'Antre du Chef Gobelin", rank_required: 'F', reward_col: 250, reward_xp: 150
            },
            {
                title: "L'Antre du Chef Gobelin", description: 'Le chef gobelin doit tomber.',
                objective: 'Affronte et vaincs le Chef Gobelin au fond de la forêt.',
                type: 'main', chain: "L'Ascension de l'Aventurier", step: 3,
                nextQuestTitle: null, rank_required: 'F', reward_col: 500, reward_xp: 400
            },
            // Multiplayer / co-op quest
            {
                title: 'Le Raid du Donjon Maudit', description: 'Un donjon de rang D nécessite une équipe.',
                objective: "Rassemble d'autres aventuriers dans ta zone et franchissez le donjon ensemble.",
                type: 'raid', chain: 'Raids Coopératifs', step: 1, isMultiplayer: true,
                nextQuestTitle: null, rank_required: 'F', reward_col: 800, reward_xp: 600
            },
            // Historic Missions (Temporal)
            {
                title: 'La Chute de Néanthea', description: "Voyage à travers une faille temporelle vers l'époque où Néanthea a sombré.",
                objective: "Assiste à l'ouverture de l'Interstice et survit à l'assaut initial des créatures du Néant.",
                type: 'historic', chain: 'Chroniques du Passé', step: 1,
                nextQuestTitle: 'Duel avec le Roi Aldren', rank_required: 'D', reward_col: 2000, reward_xp: 1500
            },
            {
                title: 'Duel avec le Roi Aldren', description: "Aldren a perdu la raison. Tu dois le stopper avant qu'il n'ouvre la porte.",
                objective: "Affronte Aldren au sommet de la Tour d'Ivoire dans le passé.",
                type: 'historic', chain: 'Chroniques du Passé', step: 2,
                nextQuestTitle: null, rank_required: 'C', reward_col: 5000, reward_xp: 3000
            },
            {
                title: 'Le Premier Sceau', description: "Assiste à la création des sceaux par les Célestes il y a des millénaires.",
                objective: "Protège les prêtres célestes pendant le rituel de scellage contre les Entités Bestiales.",
                type: 'historic', chain: 'Chroniques du Passé', step: 3,
                nextQuestTitle: null, rank_required: 'B', reward_col: 10000, reward_xp: 8000
            }
        ]);
    }

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

module.exports = {
  sequelize,
  Player, Dungeon, Quest, PlayerQuest, Bank, Item, Creds, Skill, Kingdom, Conflict, School, Duel, NPC, Monster, PlayerSkill, RPMessage, Entity, Pact, Club, PlayerClub, House,
  setupDatabase,
};
