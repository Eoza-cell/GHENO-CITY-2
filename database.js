const { Sequelize, DataTypes } = require('sequelize');
const { execSync } = require('child_process');

let sequelize;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
  console.log('[DB] Vérification de la connexion PostgreSQL...');
  try {
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
    console.error('[DB] PostgreSQL inaccessible. Basculement sur SQLite local.');
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

// Separate database dedicated strictly to generated media assets / images
// This protects the main gheno-city database from swelling rapidly.
const mediaSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'gheno-media.sqlite',
  logging: false,
});

const MediaAsset = mediaSequelize.define('MediaAsset', {
  key: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  base64Data: {
    type: DataTypes.TEXT,
  },
  mimeType: {
    type: DataTypes.STRING,
    defaultValue: 'image/png',
  }
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
  gender: {
    type: DataTypes.STRING,
    defaultValue: 'Non-défini',
  },
  race: {
    type: DataTypes.STRING,
    defaultValue: 'Humain',
  },
  age: {
    type: DataTypes.INTEGER,
    defaultValue: 18,
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
    defaultValue: 1,
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
  hunger: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  sleep: {
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
    defaultValue: "Empire Impérial d'Elion",
  },
  subLocation: {
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
  spouseJid: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  equippedTitle: {
    type: DataTypes.STRING,
    defaultValue: "Aventurier Novice",
  },
  badges: {
    type: DataTypes.TEXT,
    defaultValue: '["🔰 Novice"]',
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
    defaultValue: 5,
  },
  agility: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  intelligence: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  luck: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
  },
  defense: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
  },
  equippedOutfit: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  outfitDurability: {
    type: DataTypes.INTEGER,
    defaultValue: 100, // 0 to 100%
  },
  outfitCleanliness: {
    type: DataTypes.STRING,
    defaultValue: 'propre', // 'propre', 'poussiéreux', 'taché de boue', 'couvert de sang', 'déchiré'
  },
  wantedLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isPrisoner: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  masterId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  servantPowerBonus: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  fusedWithId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fusionSyncLevel: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  hasAura: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  inebriationLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 0, // 0 to 100% drunk
  },
  isPoisoned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  territoryExtension: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

const Item = sequelize.define('Item', {
  name: { type: DataTypes.STRING, unique: true },
  description: { type: DataTypes.TEXT },
  price: { type: DataTypes.INTEGER, defaultValue: 0 },
  type: { type: DataTypes.STRING },
  rarity: { type: DataTypes.STRING, defaultValue: 'common' },
  slot: { type: DataTypes.STRING, defaultValue: 'none' },
  durability: { type: DataTypes.INTEGER, defaultValue: 100 },
  visualData: {
    type: DataTypes.TEXT,
    defaultValue: '{"color": "#ffffff", "style": "standard"}',
    get() {
      const raw = this.getDataValue('visualData');
      try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
    },
    set(val) { this.setDataValue('visualData', JSON.stringify(val)); }
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
  imageUrl: { type: DataTypes.STRING, allowNull: true },
});

const Dungeon = sequelize.define('Dungeon', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    rank: { type: DataTypes.STRING },
    floors: { type: DataTypes.INTEGER, defaultValue: 1 },
    subLocation: { type: DataTypes.STRING, defaultValue: 'Entrée' }
});

const Quest = sequelize.define('Quest', {
    title: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    type: { type: DataTypes.STRING, defaultValue: 'side' },
    rank_required: { type: DataTypes.STRING, defaultValue: 'E' },
    reward_col: { type: DataTypes.INTEGER, defaultValue: 0 },
    reward_xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    chain: { type: DataTypes.STRING, allowNull: true },
    step: { type: DataTypes.INTEGER, defaultValue: 1 },
    objective: { type: DataTypes.TEXT, allowNull: true },
    nextQuestTitle: { type: DataTypes.STRING, allowNull: true },
    isMultiplayer: { type: DataTypes.BOOLEAN, defaultValue: false },
    subLocation: { type: DataTypes.STRING, defaultValue: 'Bureau des Missions' }
});

const PlayerQuest = sequelize.define('PlayerQuest', {
    status: { type: DataTypes.STRING, defaultValue: 'not_started' },
    progress: { type: DataTypes.INTEGER, defaultValue: 0 },
    branch: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    metadata: {
        type: DataTypes.TEXT,
        defaultValue: '{}',
        get() {
            const raw = this.getDataValue('metadata');
            try { return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
        },
        set(val) { this.setDataValue('metadata', JSON.stringify(val)); }
    }
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
    continent: { type: DataTypes.STRING, defaultValue: 'Aetheria' },
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
    kingdomName: { type: DataTypes.STRING },
    subLocation: { type: DataTypes.STRING, defaultValue: 'Quartier Scolaire' }
});

const RPMessage = sequelize.define('RPMessage', {
    senderJid: { type: DataTypes.STRING },
    senderName: { type: DataTypes.STRING },
    content: { type: DataTypes.TEXT },
    location: { type: DataTypes.STRING },
    subLocation: { type: DataTypes.STRING, defaultValue: 'Entrée' },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const WorldJournal = sequelize.define('WorldJournal', {
    entry: { type: DataTypes.TEXT },
    importance: { type: DataTypes.INTEGER, defaultValue: 1 },
    category: { type: DataTypes.STRING, defaultValue: 'general' },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const NPC = sequelize.define('NPC', {
    name: { type: DataTypes.STRING, unique: true },
    role: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    location: { type: DataTypes.STRING },
    subLocation: { type: DataTypes.STRING, defaultValue: 'Place Centrale' },
    powerLevel: { type: DataTypes.INTEGER, defaultValue: 50 },
    specialty: { type: DataTypes.STRING },
    imageUrl: { type: DataTypes.STRING, allowNull: true }
});

const Entity = sequelize.define('Entity', {
    name: { type: DataTypes.STRING, unique: true },
    type: { type: DataTypes.STRING },
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
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    resonance: { type: DataTypes.INTEGER, defaultValue: 10 }
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

const TournamentParticipant = sequelize.define('TournamentParticipant', {
    playerJid: { type: DataTypes.STRING, primaryKey: true },
    playerName: { type: DataTypes.STRING },
    rank: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'registered' },
    opponentJid: { type: DataTypes.STRING, allowNull: true },
    round: { type: DataTypes.INTEGER, defaultValue: 1 }
});

const House = sequelize.define('House', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING },
    price: { type: DataTypes.INTEGER },
    location: { type: DataTypes.STRING },
    subLocation: { type: DataTypes.STRING, defaultValue: 'Quartier Résidentiel' },
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
    intelligence: { type: DataTypes.INTEGER, defaultValue: 10 },
    location: { type: DataTypes.STRING, defaultValue: 'Eldoria' },
    subLocation: { type: DataTypes.STRING, defaultValue: 'Forêt des Gobelins' },
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
    await mediaSequelize.authenticate();
    console.log('Main and Media Connections established.');

    // Explicitly handle missing columns because sync({ alter: true }) can be unreliable
    const queryInterface = sequelize.getQueryInterface();
    const tableDefinitions = {
      Players: Player.rawAttributes,
      Monsters: Monster.rawAttributes,
      NPCs: NPC.rawAttributes,
      Quests: Quest.rawAttributes,
      Items: Item.rawAttributes,
      PlayerQuests: PlayerQuest.rawAttributes,
      PlayerSkills: PlayerSkill.rawAttributes,
      Houses: House.rawAttributes,
      Kingdoms: Kingdom.rawAttributes,
      Schools: School.rawAttributes,
      RPMessages: RPMessage.rawAttributes,
      WorldJournals: WorldJournal.rawAttributes,
      Dungeons: Dungeon.rawAttributes
    };

    for (const [tableName, attributes] of Object.entries(tableDefinitions)) {
      try {
        const tables = await queryInterface.showAllTables();
        if (!tables.includes(tableName)) continue;

        const tableInfo = await queryInterface.describeTable(tableName);
        for (const [colName, colDefinition] of Object.entries(attributes)) {
          if (!tableInfo[colName]) {
            console.log(`[DB] Column ${colName} missing in ${tableName}. Adding it...`);
            await queryInterface.addColumn(tableName, colName, colDefinition);
          }
        }
      } catch (err) {
        console.warn(`[DB] Error checking/adding columns for ${tableName}:`, err.message);
      }
    }

    await sequelize.sync({ alter: true });
    await mediaSequelize.sync({ alter: true });
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
                name: 'Uniforme de la Seconde',
                description: 'L\'uniforme réglementaire pour les élèves de seconde (2nd) à l\'Académie.',
                price: 500,
                type: 'clothing',
                rarity: 'common',
                slot: 'chest',
                statBonuses: { intelligence: 2, defense: 2 },
                imageUrl: 'https://gamesfashionarchive.net/viewer/images/large/Girls_Side_1st_Love/1st_Love_034.jpg'
            },
            {
                name: 'Uniforme de la Première',
                description: 'L\'uniforme réglementaire pour les élèves de première (1ere) à l\'Académie.',
                price: 700,
                type: 'clothing',
                rarity: 'common',
                slot: 'chest',
                statBonuses: { intelligence: 5, defense: 3 },
                imageUrl: 'https://gamesfashionarchive.net/viewer/images/large/Girls_Side_1st_Love/1st_Love_034.jpg'
            },
            {
                name: 'Uniforme de la Terminale',
                description: 'L\'uniforme réglementaire pour les élèves de terminale (Tle) à l\'Académie.',
                price: 1000,
                type: 'clothing',
                rarity: 'rare',
                slot: 'chest',
                statBonuses: { intelligence: 10, defense: 5 },
                imageUrl: 'https://gamesfashionarchive.net/viewer/images/large/Girls_Side_1st_Love/1st_Love_034.jpg'
            },
            {
                name: 'Seven-Star Sword',
                description: 'Une épée de lumière légendaire (Revenant Weapon) de Granblue Fantasy.',
                price: 8000,
                type: 'weapon',
                rarity: 'legendary',
                slot: 'weapon',
                statBonuses: { strength: 40, defense: 20 },
                imageUrl: 'https://gbf.wiki/images/thumb/7/71/Seven-Star_Sword.png/200px-Seven-Star_Sword.png'
            },
            {
                name: 'Luminiera Sword Omega',
                description: 'Une épée de lumière légendaire imprégnée du pouvoir divin de la Chevalier.',
                price: 9000,
                type: 'weapon',
                rarity: 'legendary',
                slot: 'weapon',
                statBonuses: { strength: 35, defense: 25 },
                imageUrl: 'https://gbf.wiki/images/thumb/e/e1/Luminiera_Sword_Omega.png/200px-Luminiera_Sword_Omega.png'
            },
            {
                name: 'Tiamat Bolt Omega',
                description: 'Un arc/arbalète de vent capable de déchaîner des tempêtes foudroyantes.',
                price: 4200,
                type: 'weapon',
                rarity: 'epic',
                slot: 'weapon',
                statBonuses: { agility: 28, luck: 10 },
                imageUrl: 'https://gbf.wiki/images/thumb/b/ba/Tiamat_Bolt_Omega.png/200px-Tiamat_Bolt_Omega.png'
            },
            {
                name: 'Leviathan Gaze Omega',
                description: 'Une dague d\'eau de l\'océan libérant des torrents destructeurs.',
                price: 4200,
                type: 'weapon',
                rarity: 'epic',
                slot: 'weapon',
                statBonuses: { strength: 15, agility: 25 },
                imageUrl: 'https://gbf.wiki/images/thumb/e/e9/Leviathan_Gaze_Omega.png/200px-Leviathan_Gaze_Omega.png'
            },
            {
                name: 'Colossus Cane Omega',
                description: 'Un bâton de mage enflammé brûlant d\'une fureur volcanique divine.',
                price: 3800,
                type: 'weapon',
                rarity: 'epic',
                slot: 'weapon',
                statBonuses: { intelligence: 35, defense: 5 },
                imageUrl: 'https://gbf.wiki/images/thumb/7/75/Colossus_Cane_Omega.png/200px-Colossus_Cane_Omega.png'
            },
            {
                name: 'Bahamut Dagger',
                description: 'Une dague maudite forgée à partir de la corne du Dragon de l\'Origine.',
                price: 12000,
                type: 'weapon',
                rarity: 'legendary',
                slot: 'weapon',
                statBonuses: { strength: 50, agility: 30 },
                imageUrl: 'https://gbf.wiki/images/thumb/a/aa/Bahamut_Dagger.png/200px-Bahamut_Dagger.png'
            },
            {
                name: 'Purifying Thunderbolt',
                description: 'Une lance sacrée étincelante libérant des torrents de foudre sacrée.',
                price: 15000,
                type: 'weapon',
                rarity: 'legendary',
                slot: 'weapon',
                statBonuses: { strength: 60, intelligence: 30 },
                imageUrl: 'https://gbf.wiki/images/thumb/6/64/Purifying_Thunderbolt.png/200px-Purifying_Thunderbolt.png'
            },
            {
                name: 'Murgleis',
                description: 'Une épée fine étincelante imprégnée de l\'élément Eau.',
                price: 14000,
                type: 'weapon',
                rarity: 'legendary',
                slot: 'weapon',
                statBonuses: { strength: 55, defense: 25 },
                imageUrl: 'https://gbf.wiki/images/thumb/f/ff/Murgleis.png/200px-Murgleis.png'
            },
            {
                name: 'Benedia',
                description: 'Un fusil de feu précis d\'une valeur inestimable.',
                price: 11000,
                type: 'weapon',
                rarity: 'legendary',
                slot: 'weapon',
                statBonuses: { agility: 45, luck: 25 },
                imageUrl: 'https://gbf.wiki/images/thumb/f/f5/Benedia.png/200px-Benedia.png'
            },
            {
                name: 'Ichigo Hitofuri',
                description: 'Un katana d\'une finesse et d\'un tranchant incomparables.',
                price: 13500,
                type: 'weapon',
                rarity: 'legendary',
                slot: 'weapon',
                statBonuses: { strength: 50, agility: 25 },
                imageUrl: 'https://gbf.wiki/images/thumb/1/19/Ichigo_Hitofuri.png/200px-Ichigo_Hitofuri.png'
            }
        ];

    for (const item of itemsToSeed) {
        await Item.findOrCreate({ where: { name: item.name }, defaults: item });
    }

    // Seed 3000 Varied Items
    const currentItemCount = await Item.count();
    if (currentItemCount < 3000) {
        console.log(`[SEED] Generating ${3000 - currentItemCount} additional items...`);
        const adjectives = ["Élégant", "Sombre", "Guerrier", "Mystique", "Ancien", "Royal", "Oublié", "Céleste", "Bestial", "Vaporeux", "Renforcé", "Léger", "Lourd", "Scintillant", "Maudit", "Sacré", "Interdit", "Nomade", "Urbain", "Techno-magique", "Solaire", "Lunaire", "Abyssal", "Éthéré", "Corrompu", "Divin", "Mécano", "Néon", "Rune", "Plasma", "Vibration"];
        const clothingBases = ["Manteau", "Tunique", "Armure", "Robe", "Veste", "Costume", "Plastron", "Cape", "Haut", "Gilet", "Tabard", "Kimonos", "Yukata", "Uniforme", "Tenue"];
        const weaponBases = ["Épée", "Lance", "Dague", "Arc", "Bâton", "Hache", "Masse", "Katana", "Faux", "Griffes", "Gantelets", "Sabre", "Rapière", "Marteau", "Fronde"];
        const materials = ["de Soie", "de Fer", "de Mana", "en Cuir", "de Velours", "de Lin", "d'Éther", "en Écailles", "de Cristal", "de Dragon", "d'Ombre", "de Lumière", "d'Obsidienne", "de Mithril", "d'Adamantite", "de Plasma", "de Force"];
        const colors = ["#ffffff", "#000000", "#ff0000", "#0000ff", "#ffff00", "#00ff00", "#8a2be2", "#ffd700", "#c0c0c0", "#ff4500", "#2f4f4f", "#4b0082"];

        const batchSize = 100;
        const targetCount = 3000;
        for (let i = currentItemCount; i < targetCount; i += batchSize) {
            const batch = [];
            for (let j = 0; j < batchSize && (i + j) < targetCount; j++) {
                const isWeapon = Math.random() > 0.5;
                const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
                const base = isWeapon ? weaponBases[Math.floor(Math.random() * weaponBases.length)] : clothingBases[Math.floor(Math.random() * clothingBases.length)];
                const mat = materials[Math.floor(Math.random() * materials.length)];
                const rarityRoll = Math.random();
                let rarity = 'common';
                let priceMult = 1;
                if (rarityRoll < 0.05) { rarity = 'legendary'; priceMult = 10; }
                else if (rarityRoll < 0.15) { rarity = 'epic'; priceMult = 5; }
                else if (rarityRoll < 0.35) { rarity = 'rare'; priceMult = 2; }

                const name = `${adj} ${base} ${mat} #${Math.floor(Math.random() * 100000)}`;
                const statBonuses = {};
                if (isWeapon) {
                    statBonuses.strength = rarity === 'common' ? 2 : Math.floor(Math.random() * 15 * priceMult);
                    statBonuses.agility = Math.floor(Math.random() * 10 * priceMult);
                } else {
                    statBonuses.defense = rarity === 'common' ? 1 : Math.floor(Math.random() * 12 * priceMult);
                    statBonuses.intelligence = Math.floor(Math.random() * 8 * priceMult);
                }

                batch.push({
                    name,
                    description: `Un objet de type ${isWeapon ? 'arme' : 'vêtement'} forgé dans les terres d'Aetherys. Propriétés: ${adj}, ${mat}.`,
                    price: Math.floor((Math.random() * 600 + 150) * priceMult),
                    type: isWeapon ? 'weapon' : 'clothing',
                    rarity,
                    slot: isWeapon ? 'weapon' : 'chest',
                    durability: 100,
                    visualData: {
                        color: colors[Math.floor(Math.random() * colors.length)],
                        style: adj.toLowerCase()
                    },
                    statBonuses
                });
            }
            await Item.bulkCreate(batch, { ignoreDuplicates: true });
        }
    }

    // Seed 1100 Culinary Specialties (After the Rebirth - ATR Food)
    const currentFoodCount = await Item.count({ where: { type: 'food' } });
    if (currentFoodCount < 1100) {
        console.log(`[SEED] Generating ${1100 - currentFoodCount} additional culinary specialties...`);
        const foodBases = ["Ramen", "Onigiri", "Sushi", "Tempura", "Bento", "Udon", "Soba", "Yakitori", "Takoyaki", "Okonomiyaki", "Dorayaki", "Taiyaki", "Mochi", "Daifuku", "Tartare", "Ragoût", "Brochette", "Gâteau", "Soupe", "Rôti", "Fondue", "Pâtisserie", "Beignet", "Tarte", "Salade", "Brioche", "Velouté", "Gratin", "Poêlée", "Confit"];
        const foodAdjectives = ["Légendaire", "Céleste", "Infernal", "Abyssal", "Lunaire", "Solaire", "Ancestral", "Magique", "d'Éther", "d'Or", "d'Argent", "Royal", "de Dragon", "de Phénix", "Étoilé", "Parfumé", "Épicé", "Sucré", "Salé", "Divin", "Secret", "Impérial", "Croustillant", "Fondant", "Moelleux", "Volcanique", "Givré", "Spectral", "Brillant", "Suprême", "Sombre", "Pur", "Éthéré", "Mystique", "Exotique", "Onctueux", "Parfait", "d'Aetherys", "d'Après la Renaissance"];
        const foodIngredients = ["au Poulet de braise", "au Bœuf d'Asgard", "au Saumon des glaces", "aux Champignons de l'Ombre", "aux Baies d'Émeraudes", "au Miel de fée", "aux Épices de feu", "aux Algues de Poséidon", "aux Truffes des cavernes", "au Fromage céleste", "au Chocolat d'obsession", "aux Fruits du verger perdu", "aux Épices de l'Abîme", "au Nectar d'Olympe", "au Riz de Lune", "aux Pommes d'Éden", "au Crabe de cristal", "à la Truite d'argent", "aux Noix de mana", "aux Cerises de sang", "au Thé d'Étoiles", "à la Crème d'Éther", "au Sucre de givre", "au Basilic magique", "au Safran impérial", "à la Vanille des Songes", "au Gingembre sauvage", "au Citron de foudre", "à la Pêche céleste", "au Melon royal", "à la Goyave de feu", "à l'Avocat magique", "au Wasabi de lave", "au Rôti d'hydre", "au Ragoût de chimère"];
        const foodColors = ["#ffd700", "#ffaa00", "#ff66cc", "#ff3c00", "#00ffff", "#00e5ff", "#00e676", "#ffa64d"];

        const foodBatchSize = 100;
        const targetFoodCount = 1100;
        for (let i = currentFoodCount; i < targetFoodCount; i += foodBatchSize) {
            const batch = [];
            for (let j = 0; j < foodBatchSize && (i + j) < targetFoodCount; j++) {
                const base = foodBases[Math.floor(Math.random() * foodBases.length)];
                const adj = foodAdjectives[Math.floor(Math.random() * foodAdjectives.length)];
                const ing = foodIngredients[Math.floor(Math.random() * foodIngredients.length)];

                // Construct a completely unique name using index to avoid rare name collisions
                const name = `${base} ${adj} ${ing} (Spécialité #${i + j + 1})`;

                const rarityRoll = Math.random();
                let rarity = 'common';
                let statMult = 1;
                if (rarityRoll < 0.05) { rarity = 'legendary'; statMult = 3; }
                else if (rarityRoll < 0.15) { rarity = 'epic'; statMult = 2; }
                else if (rarityRoll < 0.35) { rarity = 'rare'; statMult = 1.5; }

                const hungerBonus = Math.floor((Math.random() * 20 + 20) * statMult);
                const sleepBonus = Math.floor((Math.random() * 15 + 15) * statMult);

                batch.push({
                    name,
                    description: `Une spécialité culinaire exquise du jeu After the Rebirth (ATR). Style: ${adj}, avec ${ing}. Restaure l'énergie et rassasie l'Héritier.`,
                    price: Math.floor((Math.random() * 80 + 20) * statMult),
                    type: 'food',
                    rarity,
                    slot: 'none',
                    durability: 100,
                    visualData: {
                        color: foodColors[Math.floor(Math.random() * foodColors.length)],
                        style: adj.toLowerCase()
                    },
                    statBonuses: {
                        hunger: hungerBonus,
                        sleep: sleepBonus
                    }
                });
            }
            await Item.bulkCreate(batch, { ignoreDuplicates: true });
        }
    }

    const skillCount = await Skill.count();
    if (skillCount < 4000) {
        console.log(`[SEED] Seeding skills (Current: ${skillCount})...`);
        const baseSkills = [
            { name: 'Fente Puissante', description: 'Un coup d\'estoc dévastateur.', type: 'Guerrier', manaCost: 10, statBonuses: { strength: 5 } },
            { name: 'Cri de Guerre', description: 'Augmente la force brute temporairement.', type: 'Guerrier', manaCost: 20, statBonuses: { strength: 10 } },
            { name: 'Projectile Magique', description: 'Une décharge d\'énergie pure.', type: 'Mage', manaCost: 10, statBonuses: { intelligence: 5 } },
            { name: 'Barrière d\'Éther', description: 'Un bouclier magique protecteur.', type: 'Mage', manaCost: 25, statBonuses: { defense: 10 } },
            { name: 'Frappe Fantôme', description: 'Attaque surprise depuis les ombres.', type: 'Assassin', manaCost: 15, statBonuses: { agility: 10 } },
            { name: 'Lame Empoisonnée', description: 'Enduit l\'arme d\'un poison mortel.', type: 'Assassin', manaCost: 20, statBonuses: { strength: 5, luck: 5 } },
            { name: 'Tir de Précision', description: 'Une flèche visant les points vitaux.', type: 'Archer', manaCost: 10, statBonuses: { luck: 10 } },
            { name: 'Pluie de Flèches', description: 'Déluge de projectiles sur une zone.', type: 'Archer', manaCost: 30, statBonuses: { agility: 5, strength: 5 } },
            { name: 'Soins Mineurs', description: 'Restaure une petite quantité de PV.', type: 'Prêtre', manaCost: 15, statBonuses: { intelligence: 5 } },
            { name: 'Bénédiction', description: 'Accorde la faveur divine aux alliés.', type: 'Prêtre', manaCost: 25, statBonuses: { luck: 10, defense: 5 } },
            { name: 'Paume de Fer', description: 'Un coup de paume brisant les os.', type: 'Moine', manaCost: 10, statBonuses: { strength: 8 } },
            { name: 'Méditation', description: 'Restaure le mana en se concentrant.', type: 'Moine', manaCost: 0, statBonuses: { intelligence: 5 } },
            { name: 'Frappe Sacrée', description: 'Une attaque imprégnée de lumière.', type: 'Paladin', manaCost: 20, statBonuses: { strength: 10, defense: 5 } },
            { name: 'Bouclier de Lumière', description: 'Une protection divine impénétrable.', type: 'Paladin', manaCost: 30, statBonuses: { defense: 20 } },
            { name: 'Appel du Familier', description: 'Invoque un esprit animal mineur.', type: 'Invocateur', manaCost: 40, statBonuses: { intelligence: 10 } },
            { name: 'Lien Spirituel', description: 'Renforce les capacités via le familier.', type: 'Invocateur', manaCost: 20, statBonuses: { intelligence: 5, agility: 5 } },
            { name: 'Éveil Squelettique', description: 'Réanime un serviteur des os.', type: 'Nécromancien', manaCost: 50, statBonuses: { intelligence: 15 } },
            { name: 'Ponction de Vie', description: 'Vole l\'énergie vitale de la cible.', type: 'Nécromancien', manaCost: 30, statBonuses: { intelligence: 10, health: 10 } },
            { name: 'Iaijutsu', description: 'Frappe éclair au dégainage.', type: 'Samouraï', manaCost: 15, statBonuses: { agility: 15 } },
            { name: 'Esprit du Bushido', description: 'Renforce la volonté et la résistance.', type: 'Samouraï', manaCost: 20, statBonuses: { strength: 5, defense: 10 } },
            { name: 'Saut Draconique', description: 'Attaque plongeante dévastatrice.', type: 'Chevalier-Dragon', manaCost: 25, statBonuses: { strength: 15, agility: 5 } },
            { name: 'Souffle de Salamandre', description: 'Un cône de flammes ardentes (poumons de dragon).', type: 'Chevalier-Dragon', manaCost: 40, statBonuses: { strength: 10, intelligence: 10 } },
            { name: 'Poing de l\'Acier du Dragon', description: 'Un coup de poing enflammé dévastateur (type Dragon Slayer).', type: 'Chevalier-Dragon', manaCost: 20, statBonuses: { strength: 12 } },
            { name: 'Consommation Élémentaire', description: 'Dévore de la magie élémentaire (feu, foudre...) pour restaurer instantanément ses PM.', type: 'Chevalier-Dragon', manaCost: 0, statBonuses: { intelligence: 5 } },
            { name: 'Écailles du Dragon', description: 'Couvre le corps d\'écailles de dragon denses qui augmentent drastiquement la défense.', type: 'Chevalier-Dragon', manaCost: 35, statBonuses: { defense: 20 } },
            { name: 'Mixture Explosive', description: 'Lance une fiole de produits volatils.', type: 'Alchimiste', manaCost: 20, statBonuses: { intelligence: 10, luck: 5 } },
            { name: 'Élixir Régénérant', description: 'Une potion soignant sur la durée.', type: 'Alchimiste', manaCost: 30, statBonuses: { intelligence: 5, defense: 5 } },
            { name: 'Chant de Bravoure', description: 'Un hymne qui galvanise les cœurs.', type: 'Barde', manaCost: 20, statBonuses: { strength: 10, luck: 10 } },
            { name: 'Mélodie Apaisante', description: 'Calme les esprits et réduit la fatigue.', type: 'Barde', manaCost: 25, statBonuses: { intelligence: 10, defense: 5 } },

            // Techniques avancées & Auras
            { name: 'Vertical Square', description: 'Un enchaînement de 4 coups verticaux.', type: 'sword_technique', manaCost: 20 },
            { name: 'Sonic Leap', description: 'Une charge fulgurante.', type: 'sword_technique', manaCost: 15, statBonuses: { agility: 5 } },
            { name: 'Starburst Stream', description: 'Technique ultime à deux épées (50 coups).', type: 'sword_technique', manaCost: 100, statBonuses: { strength: 20, agility: 20 } },
            { name: 'Aura de Bravoure', description: 'Une aura rouge augmentant la force.', type: 'aura', manaCost: 40, statBonuses: { strength: 15 } },
            { name: 'Aura de Gardien', description: 'Une aura dorée renforçant la défense.', type: 'aura', manaCost: 40, statBonuses: { defense: 15 } },
            { name: 'Aura de Célérité', description: 'Une aura verte décuplant la vitesse.', type: 'aura', manaCost: 40, statBonuses: { agility: 15 } },
            { name: 'Aura de Mana', description: 'Une aura bleue augmentant la puissance magique.', type: 'aura', manaCost: 40, statBonuses: { intelligence: 15 } },
            { name: 'Aura du Dieu de la Mort', description: 'Une aura noire qui terrifie l\'ennemi.', type: 'aura', manaCost: 80, statBonuses: { strength: 40, luck: 20 } },
            { name: 'Brasier de l\'Enfer', description: 'Une tornade de feu noir consumant tout.', type: 'spell', manaCost: 90, statBonuses: { intelligence: 45 } },
            { name: 'Zéro Absolu', description: 'Gèle tout instantanément dans une zone massive.', type: 'spell', manaCost: 90, statBonuses: { intelligence: 45 } },
            { name: 'Éclair Enchaîné', description: 'Foudre bondissant entre les cibles.', type: 'spell', manaCost: 50, statBonuses: { intelligence: 20 } },
            { name: 'Trou Noir', description: 'Crée un vide attirant et écrasant tout.', type: 'spell', manaCost: 80, statBonuses: { intelligence: 30 } },
            { name: 'Pluie de Météores', description: 'Déluge de feu s\'abattant du ciel.', type: 'spell', manaCost: 150, statBonuses: { intelligence: 60 } },
            { name: 'Régénération Accélérée', description: 'Soigne les blessures au fil du temps.', type: 'passive', statBonuses: { defense: 5 } },
            { name: 'Senseur de Mana', description: 'Détecte les présences magiques.', type: 'passive', statBonuses: { intelligence: 10 } }
        ];

        for (const s of baseSkills) {
            await Skill.findOrCreate({ where: { name: s.name }, defaults: s });
        }

        const classes = {
            'Guerrier': { stat: 'strength', bases: ["Fente", "Cri", "Charge", "Brise-Garde", "Tranchant", "Fracas"] },
            'Mage': { stat: 'intelligence', bases: ["Projectile", "Barrière", "Sphère", "Explosion", "Rayon", "Sceau"] },
            'Assassin': { stat: 'agility', bases: ["Frappe", "Lame", "Ombre", "Disparition", "Poison", "Éviscération"] },
            'Archer': { stat: 'luck', bases: ["Tir", "Pluie", "Flèche", "Visée", "Piège", "Salto"] },
            'Prêtre': { stat: 'intelligence', bases: ["Soins", "Bénédiction", "Lumière", "Sanctuaire", "Expiation", "Prière"] },
            'Moine': { stat: 'strength', bases: ["Paume", "Coup", "Karaté", "Zen", "Posture", "Impact"] },
            'Paladin': { stat: 'defense', bases: ["Bouclier", "Lance", "Garde", "Consécration", "Jugement", "Bastion"] },
            'Invocateur': { stat: 'intelligence', bases: ["Appel", "Lien", "Pacte", "Portail", "Murmure", "Vision"] },
            'Nécromancien': { stat: 'intelligence', bases: ["Éveil", "Siphon", "Os", "Tombeau", "Désolation", "Peste"] },
            'Samouraï': { stat: 'agility', bases: ["Iaijutsu", "Katana", "Sabre", "Honneur", "Tranche-Âme", "Méditation"] },
            'Chevalier-Dragon': { stat: 'strength', bases: ["Saut", "Souffle", "Écaille", "Draconique", "Envol", "Griffe"] },
            'Alchimiste': { stat: 'intelligence', bases: ["Mixture", "Élixir", "Transmutation", "Fiole", "Gaz", "Métamorphose"] },
            'Barde': { stat: 'luck', bases: ["Chant", "Mélodie", "Accord", "Rime", "Lyre", "Écho"] }
        };

        const classAdjectives = ["Puissant", "Rapide", "Mortel", "Divin", "Sombre", "Ancestral", "Éternel", "Spectral", "Enchanté", "Maudit", "Sacré", "Brutal", "Éclair", "Furtif", "Légendaire", "Héroïque", "Infaillible", "Silencieux", "Vibrant", "Ardent"];

        const classSkills = [];
        const classList = Object.keys(classes);
        for (let i = 0; i < 1000; i++) {
            const cls = classList[i % classList.length];
            const adj = classAdjectives[Math.floor(Math.random() * classAdjectives.length)];
            const base = classes[cls].bases[Math.floor(Math.random() * classes[cls].bases.length)];
            const name = `${base} ${adj} de ${cls} #${i}`;
            classSkills.push({
                name,
                description: `Une technique avancée de la classe ${cls}.`,
                type: cls,
                manaCost: 10 + Math.floor(Math.random() * 40),
                statBonuses: { [classes[cls].stat]: 5 + Math.floor(Math.random() * 15) }
            });
            if (classSkills.length >= 100) {
                await Skill.bulkCreate(classSkills, { ignoreDuplicates: true });
                classSkills.length = 0;
            }
        }
        if (classSkills.length > 0) await Skill.bulkCreate(classSkills, { ignoreDuplicates: true });

        const elements = {
            'Feu': { stat: 'intelligence', bases: ["Flamme", "Brasier", "Étincelle", "Cendre", "Volcan", "Soleil", "Inferno", "Magma", "Braise", "Foyer", "Éclat", "Pyre"] },
            'Eau': { stat: 'intelligence', bases: ["Vague", "Marée", "Goutte", "Glace", "Océan", "Brume", "Torrent", "Source", "Geyser", "Cascade", "Givre", "Averse"] },
            'Terre': { stat: 'defense', bases: ["Roc", "Séisme", "Pierre", "Sable", "Montagne", "Cristal", "Moteur", "Falaise", "Gravier", "Sillon", "Grotte", "Noyau"] },
            'Vent': { stat: 'agility', bases: ["Souffle", "Tornade", "Brise", "Cyclone", "Tempête", "Zéphyr", "Rafale", "Ouragan", "Alizé", "Mistral", "Aura", "Vol"] }
        };

        const elementalAdjectives = ["Dévastateur", "Apocalyptique", "Primordial", "Pur", "Infini", "Chaos", "Radiant", "Obscur", "Flamboyant", "Gelé", "Sismique", "Tourbillonnant", "Céleste", "Infernal", "Instable", "Ancestral", "Légendaire", "Maudit", "Sacré", "Éternel", "Éphémère", "Brutal", "Élégant", "Sorcier", "Souverain"];

        const elementalSkills = [];
        const elementList = Object.keys(elements);
        for (let i = 0; i < 3000; i++) {
            const elem = elementList[i % elementList.length];
            const adj = elementalAdjectives[Math.floor(Math.random() * elementalAdjectives.length)];
            const base = elements[elem].bases[Math.floor(Math.random() * elements[elem].bases.length)];
            const name = `${base} ${adj} [${elem}] #${i + 1000}`;
            elementalSkills.push({
                name,
                description: `Une puissante manipulation de l'élément ${elem}. Variante #${i + 1000}.`,
                type: `Élémentaire (${elem})`,
                manaCost: 20 + Math.floor(Math.random() * 80),
                statBonuses: { [elements[elem].stat]: 10 + Math.floor(Math.random() * 30) }
            });
            if (elementalSkills.length >= 100) {
                await Skill.bulkCreate(elementalSkills, { ignoreDuplicates: true });
                elementalSkills.length = 0;
            }
        }
        if (elementalSkills.length > 0) await Skill.bulkCreate(elementalSkills, { ignoreDuplicates: true });
    }

    const houseCount = await House.count();
    if (houseCount === 0) {
        await House.bulkCreate([
            { name: 'Appartement Moderne à Eldoria', price: 10000, location: 'Eldoria', subLocation: 'Quartier Résidentiel' },
            { name: 'Villa de Luxe à Valkyr', price: 50000, location: 'Valkyr', subLocation: 'Colline des Nobles' },
            { name: 'Studio Étudiant (Académie)', price: 5000, location: 'Académie Impériale', subLocation: 'Dortoirs' }
        ]);
    } else {
        // Also update existing houses if they exist
        const houses = await House.findAll();
        for (const h of houses) {
            if (h.name.includes('Eldoria')) await h.update({ subLocation: 'Quartier Résidentiel' });
            else if (h.name.includes('Valkyr')) await h.update({ subLocation: 'Colline des Nobles' });
            else if (h.name.includes('Académie')) await h.update({ subLocation: 'Dortoirs' });
        }
    }

    const kingdomsToSeed = [
        {
            name: 'Empire Impérial d\'Elion', continent: 'Aetheria',
            description: 'Royaume humain central. Villes: Eldoria (Capitale), Solis, Riverbend, Green-Fields, Portes d\'Elion.',
            status: 'peace', influence: 95, militaryPower: 90, leader: 'Empereur Valerius II'
        },
        {
            name: 'Royaume de Valkyrr', continent: 'Aetheria',
            description: 'Centre technologique. Villes: Gearhead, Sparkwell, Grand Laboratoire, Marché de l\'Éther, Lycée de l\'Éther.',
            status: 'peace', influence: 80, militaryPower: 70, leader: 'Archimage Kaelen'
        },
        {
            name: 'Gheno souterrain', continent: 'Aetheria',
            description: 'Cité criminelle. Villes: Marché Noir, Caveau des Ombres, Taverne de l\'Exilé, École des Ombres, Bas-fonds.',
            status: 'neutral', influence: 90, militaryPower: 60, leader: 'L\'Ombre'
        },
        {
            name: 'Forêt de l\'Éveil', continent: 'Aetheria',
            description: 'Refuge Elfique. Villes: Sylva-Lumia, Arbre-Mère, Sources d\'Argent, Clairière du Destin, Racines Éternelles.',
            status: 'peace', influence: 85, militaryPower: 85, leader: 'Reine Elara'
        },
        {
            name: 'Archipel des Murmures', continent: 'Aetheria',
            description: 'Îles brumeuses. Villes: Port-Brume, Crique de Corail, Phare d\'Écume, Atoll des Sirènes, Rocher Percé.',
            status: 'neutral', influence: 65, militaryPower: 50, leader: 'Capitaine Drake'
        },
        {
            name: 'Terres Bestiales', continent: 'Zendora',
            description: 'Plaines sauvages. Villes: Oakhaven, Claw-reach, Jungle de Fer, Caverne Primordiale, Pic du Prédateur.',
            status: 'neutral', influence: 70, militaryPower: 95, leader: 'Krakos'
        },
        {
            name: 'Bastion d\'Orkh', continent: 'Zendora',
            description: 'Domaine Orc. Villes: Fort-Sang, Arène de Iron, Mines Rouges, Canyon des Crânes, Temple de la Rage.',
            status: 'war', influence: 40, militaryPower: 98, leader: 'Grommash'
        },
        {
            name: 'Montagnes de Iron', continent: 'Zendora',
            description: 'Royaume Nain. Villes: Forge-Profonde, Cité-Sous-Montagne, Gouffre d\'Or, Porte de Granit, Salle du Trône.',
            status: 'peace', influence: 75, militaryPower: 90, leader: 'Roi Thrain'
        },
        {
            name: 'Désert d\'Ambre', continent: 'Zendora',
            description: 'Étendue de sable. Villes: Oasis d\'Or, Cité des Dunes, Souk des Mirages, Pyramide de Cristal, Temple Solaire.',
            status: 'neutral', influence: 55, militaryPower: 65, leader: 'Sultan Malek'
        },
        {
            name: 'Dominion Noir de Vharos', continent: 'Umbra',
            description: 'Terre morte. Villes: Marais Putrides, Donjon de la Liche, Champs Éternels, Fort-Désolation, Sépulture de Sang.',
            status: 'war', influence: 60, militaryPower: 98, leader: 'Seigneur Vharos'
        },
        {
            name: 'Nécropolis', continent: 'Umbra',
            description: 'Cité des morts. Villes: Le Seuil, Allée des Tombeaux, Trône du Jugement, Val des Pleurs, Nécropole d\'Ébène.',
            status: 'neutral', influence: 100, militaryPower: 80, leader: 'Orpheon'
        },
        {
            name: 'L\'Interstice', continent: 'Umbra',
            description: 'Zone de faille. Villes: Ravin des Âmes, Forêt des Béhérits, Tour de la Main, Miroir Déformé, Fissure du Néant.',
            status: 'unknown', influence: 80, militaryPower: 90, leader: 'L\'Idée du Mal'
        },
        {
            name: 'Cité de Verre', continent: 'Umbra',
            description: 'Reflets et miroirs. Villes: Palais des Reflets, Prisme d\'Ombre, Labyrinthe de Cristal, Tour de Verre, Miroir Brisé.',
            status: 'neutral', influence: 70, militaryPower: 60, leader: 'Le Miroir'
        },
        {
            name: 'Royaume Céleste', continent: 'Caelum',
            description: 'Îles flottantes. Villes: Palais d\'Argent, Jardins d\'Éther, Cascade des Lumières, Portes du Ciel, Sanctuaire Ailé.',
            status: 'peace', influence: 90, militaryPower: 85, leader: 'Aetherius'
        },
        {
            name: 'Abysse Inférieur', continent: 'Caelum',
            description: 'Domaine Démoniaque. Villes: Cité de Pandémonium, Lac de Soufre, Trône de Flammes, Bastion du Pêché, Fosse de Sang.',
            status: 'war', influence: 50, militaryPower: 95, leader: 'Belial'
        },
        {
            name: 'Origine de l\'Existence', continent: 'Caelum',
            description: 'Sommet sacré. Villes: Autel de la Causalité, Mer de Conscience, Portes du Temps, Origine du Vide, Zenith Absolu.',
            status: 'eternal', influence: 100, militaryPower: 100, leader: 'ONE ABOVE ALL'
        },
        {
            name: 'Cité de l\'Aube', continent: 'Caelum',
            description: 'Premier lever de soleil. Villes: Bastion de l\'Aurore, Palais d\'Or, Jardins Suspendus, Port de Lumière, Tour du Matin.',
            status: 'peace', influence: 85, militaryPower: 80, leader: 'Dame Aurora'
        }
    ];

    for (const k of kingdomsToSeed) {
        const [kingdom, created] = await Kingdom.findOrCreate({ where: { name: k.name }, defaults: k });
        if (!created) {
            await kingdom.update({
                description: k.description,
                leader: k.leader,
                continent: k.continent
            });
        }
    }

    // Seed advanced Wizardry / Martial / Divine Schools & Milices for ALL 17 Realms
    console.log('[SEED] Registering comprehensive schools, milices, and factions...');
    const schoolsToSeed = [
      { name: 'Académie Royale d\'Elion', specialty: 'Escrime de Mana & Droit Impérial', description: 'Le bastion d\'élite où étudient les héritiers et chevaliers d\'Elion.', kingdomName: 'Empire Impérial d\'Elion', subLocation: 'Quartier Militaire' },
      { name: 'Garde Impériale de Fer', specialty: 'Milice & Maintien de l\'Ordre', description: 'La force d\'intervention rapide d\'Eldoria.', kingdomName: 'Empire Impérial d\'Elion', subLocation: 'Quartier Général' },
      { name: 'Lycée Supérieur de l\'Éther', specialty: 'Techno-magie & Ondes de Mana', description: 'Université scientifique de premier plan pour ingénieurs russes et magiciens.', kingdomName: 'Royaume de Valkyrr', subLocation: 'Quartier des Sciences' },
      { name: 'Milice de Sparkwell', specialty: 'Patrouilles Mécanisées', description: 'Forces de défense cybernétique à Valkyrr.', kingdomName: 'Royaume de Valkyrr', subLocation: 'Poste de Contrôle' },
      { name: 'École de l\'Ombre Silencieuse', specialty: 'Infiltration, Dagues & Poisons', description: 'Cité d\'entraînement illégale dissimulée sous la surface.', kingdomName: 'Gheno souterrain', subLocation: 'Bas-fonds' },
      { name: 'Syndicat du Marché Noir', specialty: 'Fidélité et Contrebande', description: 'La milice de l\'Ombre maintenant le contrôle criminel.', kingdomName: 'Gheno souterrain', subLocation: 'Marché Noir' },
      { name: 'Collège Elfique de Sylva-Lumia', specialty: 'Sorcellerie Végétale & Tir Sylvestre', description: 'Sanctuaire d\'étude de la nature et de l\'arc lunaire.', kingdomName: 'Forêt de l\'Éveil', subLocation: 'Sylva-Lumia' },
      { name: 'Garde Blanche des Frontières', specialty: 'Escortes d\'Archipel', description: 'Forte milice maritime maintenant l\'ordre sur l\'archipel.', kingdomName: 'Archipel des Murmures', subLocation: 'Port-Brume' },
      { name: 'Clan de la Griffe Sauvage', specialty: 'Combat Bestial et Instinct', description: 'Lycée d\'honneur tribal formant de redoutables combattants physiques.', kingdomName: 'Terres Bestiales', subLocation: 'Jungle de Fer' },
      { name: 'Arène des Sables Sanglants', specialty: 'Rage Brutale & Haches Lourdes', description: 'Le lieu d\'apprentissage brutal de la survie d\'Orkh.', kingdomName: 'Bastion d\'Orkh', subLocation: 'Fort-Sang' },
      { name: 'Citadelle de Forge-Profonde', specialty: 'Métallurgie Runique & Défense', description: 'Académie naine légendaire d\'ingénierie et de forge blindée.', kingdomName: 'Montagnes de Iron', subLocation: 'Forge-Profonde' },
      { name: 'Académie Solaire des Dunes', specialty: 'Magie du Sable & Alchimie du Mirage', description: 'École mystique bâtie au milieu des vagues de chaleur du désert.', kingdomName: 'Désert d\'Ambre', subLocation: 'Oasis d\'Or' },
      { name: 'Sanctuaire de l\'Abîme', specialty: 'Sorcellerie de la Mort & Squelettes', description: 'Lieu d\'étude maudit de la magie interdite de Vharos.', kingdomName: 'Dominion Noir de Vharos', subLocation: 'Donjon de la Liche' },
      { name: 'Ordre de la Justice Céleste', specialty: 'Lumière Divine & Ailes de Volonté', description: 'L\'école des archanges et protecteurs ailés.', kingdomName: 'Royaume Céleste', subLocation: 'Palais d\'Argent' },
      { name: 'Lycée du Pandémonium', specialty: 'Magie du Feu Noir & Pactes Démoniaques', description: 'Institution d\'élite pour les démons nobles de haut niveau.', kingdomName: 'Abysse Inférieur', subLocation: 'Cité de Pandémonium' },
    ];

    for (const sc of schoolsToSeed) {
      const [schoolInstance, created] = await School.findOrCreate({ where: { name: sc.name }, defaults: sc });
      if (!created) {
          await schoolInstance.update({
              specialty: sc.specialty,
              description: sc.description,
              kingdomName: sc.kingdomName,
              subLocation: sc.subLocation
          });
      }
    }

    const npcsToSeed = [
        { name: 'Griffith', role: 'Chef des Apôtres', description: 'A sacrifié son humanité via un Béhérit rouge pour devenir une divinité de l\'Interstice. Parle avec une élégance glaciale, presque surnaturelle.', location: 'Interstice', subLocation: 'Tour de la Main', powerLevel: 100, specialty: 'Aspiration Divine', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20Griffith%20Berserk%20femto%20look,%20god%20hand,%20interstice%20background?model=flux-anime' },
        { name: 'Void', role: 'Héraut de l\'Idée du Mal', description: 'Un être de pure volonté s\'exprimant par énigmes métaphysiques.', location: 'L\'Interstice', subLocation: 'Miroir Déformé', powerLevel: 100, specialty: 'Distorsion de Réalité', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20mysterious%20Void%20character%20with%20brain%20exposed,%20Berserk%20inspired?model=flux-anime' },
        { name: 'Orpheon', role: 'Juge des Âmes', description: 'Gardien de Nécropolis, calme et impartial.', location: 'Nécropolis', subLocation: 'Trône du Jugement', powerLevel: 99, specialty: 'Balance de l\'Existence', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20majestic%20judge%20of%20souls%20Orpheon?model=flux-anime' },
        { name: 'Directeur Magnus', role: 'Directeur de l\'Académie', description: 'Cherche désespérément un moyen de sceller les Béhérits.', location: 'Académie Impériale', subLocation: 'Bureau du Directeur', powerLevel: 98, specialty: 'Sceaux Interdits', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20elderly%20powerful%20wizard%20Magnus?model=flux-anime' },
        { name: 'Empereur Valerius II', role: 'Souverain d\'Elion', description: 'Un monarque sévère et puissant, gardien du Code.', location: 'Empire Impérial d\'Elion', subLocation: "Château d'Eldoria", powerLevel: 100, specialty: 'Autorité Impériale', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20stern%20emperor%20with%20golden%20crown%20and%20heavy%20armor?model=flux-anime' },
    ];
    for (const npc of npcsToSeed) {
        const [npcInstance, created] = await NPC.findOrCreate({
            where: { name: npc.name },
            defaults: npc
        });
        if (!created) {
            await npcInstance.update({
                role: npc.role,
                description: npc.description,
                location: npc.location,
                subLocation: npc.subLocation,
                powerLevel: npc.powerLevel,
                specialty: npc.specialty,
                imageUrl: npc.imageUrl
            });
        }
    }

    // Generate ~1000 Unique NPCs
    const npcCount = await NPC.count();
    if (npcCount < 1000) {
        console.log(`[SEED] Generating ${1000 - npcCount} additional NPCs...`);
        const firstNames = ["Kael", "Lyra", "Jax", "Elena", "Finn", "Soren", "Mira", "Thorne", "Valen", "Aria", "Zane", "Luna", "Cyrus", "Nyx", "Elias", "Ivy", "Kento", "Yuki", "Sakura", "Ren", "Akira", "Haru", "Misaki", "Tari", "Kenji"];
        const lastNames = ["Storm", "Shadow", "Light", "Blade", "Heart", "Soul", "Flame", "Frost", "Wind", "Iron", "Silva", "Vance", "Kuro", "Sato", "Watanabe", "Tanaka", "Ito", "Nakamura", "Kobayashi", "Kato"];
        const roles = ["Étudiant", "Professeur", "Garde", "Marchand", "Citoyen", "Aventurier", "Mercenaire", "Noble", "Prêtre", "Voleur"];
        const behaviors = ["Calme", "Agressif", "Mystérieux", "Serviable", "Arrogant", "Distrait", "Studieux", "Protecteur", "Malicieux", "Loyal"];
        const locations = kingdomsToSeed.map(k => k.name);

        const batchSize = 100;
        for (let i = 0; i < 1000 - npcCount; i += batchSize) {
            const batch = [];
            for (let j = 0; j < batchSize && (i + j) < (1000 - npcCount); j++) {
                const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
                const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
                const name = `${firstName} ${lastName} #${Math.floor(Math.random() * 10000)}`;
                const role = roles[Math.floor(Math.random() * roles.length)];
                const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
                const location = locations[Math.floor(Math.random() * locations.length)];
                const power = Math.floor(Math.random() * 80 + 10);

                const eyes = ["cyan éclatant", "or sombre", "rouge écarlate", "noir abysse", "vert émeraude", "améthyste", "argent glacé"];
                const hair = ["argentés et longs", "courts et ébouriffés d'un noir corbeau", "blonds dorés tressés", "flamboyants comme le feu", "bleus profonds comme l'océan"];
                const clothing = ["l'uniforme noir boutonné de l'Académie", "une armure de plaques argentée et étincelante", "une cape à capuchon miteuse couverte de boue", "des robes de soie fine parfumées à la lavande", "un manteau de cuir usé portant des cicatrices de combat"];
                const motivation = ["qui cherche à venger sa famille", "déterminé à grimper l'échelle politique d'Elion", "à la recherche de parchemins magiques interdits", "vendant des rumeurs croustillantes sur la milice locale", "qui adore lancer des défis en duel aux nouveaux venus"];

                const selectedEye = eyes[Math.floor(Math.random() * eyes.length)];
                const selectedHair = hair[Math.floor(Math.random() * hair.length)];
                const selectedOutfit = clothing[Math.floor(Math.random() * clothing.length)];
                const selectedGoal = motivation[Math.floor(Math.random() * motivation.length)];

                const fullDescription = `Héritier au regard ${selectedEye} et aux cheveux ${selectedHair}. ` +
                                        `Il porte ${selectedOutfit}. C'est un ${role} au tempérament ${behavior.toLowerCase()} ` +
                                        `${selectedGoal}.`;

                batch.push({
                    name,
                    role,
                    description: fullDescription,
                    location,
                    powerLevel: power,
                    specialty: behavior,
                    imageUrl: `https://images.pollinations.ai/prompt/Anime%20style%20portrait%20of%20${role}%20character%20${firstName}%20in%20${location}?model=flux-anime`
                });
            }
            await NPC.bulkCreate(batch, { ignoreDuplicates: true });
        }
    }

    const entitiesToSeed = [
        {
            name: 'Aetherius', type: 'celestial', description: 'Le Gardien du mana pur, incarnation de la volonté de One Above All.',
            power: 'Contrôle de l\'Ether.', pactBonus: { intelligence: 50, luck: 10 }
        },
        {
            name: 'Krakos', type: 'bestial', description: 'La bête originelle, force de l\'instinct et de la destruction physique.',
            power: 'Force Primordiale.', pactBonus: { strength: 50, defense: 20 }
        },
        {
            name: 'L\'Idée du Mal', type: 'ancient', description: 'Une conscience collective née du désespoir de l\'humanité.',
            power: 'Causalité et Destin.', pactBonus: { intelligence: 100, luck: 100 }
        }
    ];
    for (const entity of entitiesToSeed) {
        await Entity.findOrCreate({ where: { name: entity.name }, defaults: entity });
    }

    const monsterCount = await Monster.count();
    if (monsterCount === 0) {
        console.log('Seeding Monsters & Bosses...');
        await Monster.bulkCreate([
            { name: 'Loup d\'Ombre', rank: 'E', health: 50, strength: 12, defense: 5, agility: 15, intelligence: 10, location: 'Forêt des Gobelins', xp_reward: 20, col_reward: 10 },
            { name: 'Gobelin Éclaireur', rank: 'E', health: 40, strength: 10, defense: 4, agility: 12, intelligence: 8, location: 'Forêt des Gobelins', xp_reward: 15, col_reward: 8 },
            { name: 'Orque Guerrier', rank: 'D', health: 150, strength: 25, defense: 15, agility: 8, intelligence: 12, location: 'Mine de Cobalt', xp_reward: 80, col_reward: 50 },
            { name: 'Spectre des Mines', rank: 'C', health: 200, strength: 35, defense: 25, agility: 30, intelligence: 20, location: 'Mine de Cobalt', xp_reward: 200, col_reward: 150 },
            { name: 'Chimère de Sang', rank: 'B', health: 500, strength: 60, defense: 45, agility: 50, intelligence: 25, location: 'Caverne des Ombres', xp_reward: 600, col_reward: 400 },
            { name: 'Dragon d\'Azur', rank: 'A', health: 2000, strength: 150, defense: 120, agility: 80, intelligence: 60, location: 'Volcan d\'Ignis', xp_reward: 5000, col_reward: 3000 },
            { name: 'Le Roi Gobelin (BOSS)', rank: 'D', health: 400, strength: 40, defense: 30, agility: 20, intelligence: 35, location: 'Forêt des Gobelins', xp_reward: 500, col_reward: 1000 },
            { name: 'Vharos le Seigneur Liche (BOSS)', rank: 'A', health: 3000, strength: 200, defense: 150, agility: 100, intelligence: 95, location: 'Vharos le Maudit', xp_reward: 10000, col_reward: 5000 },
            { name: 'L\'Ombre du Néant (BOSS FINAL)', rank: 'S', health: 10000, strength: 500, defense: 400, agility: 300, intelligence: 150, location: 'Origine de l\'Existence', xp_reward: 100000, col_reward: 50000 }
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
    if (questCount < 500) {
        console.log(`[SEED] Seeding quests (Current: ${questCount})...`);
        const baseQuests = [
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
                nextQuestTitle: 'Chasse au Loup-Gris Sauvage', rank_required: 'F', reward_col: 500, reward_xp: 400
            },
            {
                title: 'Chasse au Loup-Gris Sauvage', description: 'Les loups féroces rôdent aux abords d\'Eldoria.',
                objective: 'Traque et neutralise le Loup-Gris des Terres Sauvages.',
                type: 'side', rank_required: 'F', reward_col: 300, reward_xp: 200, subLocation: 'Forêt des Gobelins'
            },
            {
                title: 'Exploration des Mines de Cobalt', description: 'Des anomalies magiques perturbent la mine.',
                objective: 'Explore la Mine de Cobalt et sécurise le secteur.',
                type: 'side', rank_required: 'E', reward_col: 600, reward_xp: 450, subLocation: 'Valkyrr'
            },
            {
                title: 'Escorte du Convoi d\'Éther', description: 'Un convoi marchand traverse la vallée des ombres.',
                objective: 'Protège les marchands contre les attaques de bandits.',
                type: 'side', rank_required: 'D', reward_col: 1200, reward_xp: 800, subLocation: 'Solis'
            },
            {
                title: 'Infiltration du Marché Noir de Gheno', description: 'Obtiens des renseignements sur le syndicat criminel.',
                objective: 'Infiltre le Marché Noir de Gheno sans te faire repérer.',
                type: 'side', rank_required: 'C', reward_col: 2500, reward_xp: 1800, subLocation: 'Gheno souterrain'
            },
            {
                title: 'Purification du Sanctuaire de Nécropolis', description: 'Des esprits affolés menacent la frontière des morts.',
                objective: 'Purifie 3 stèles rituelles dans Nécropolis.',
                type: 'side', rank_required: 'B', reward_col: 5000, reward_xp: 3500, subLocation: 'Nécropolis'
            },
            {
                title: 'Traque de la Bête Céleste : Phénix d\'Or', description: 'Une bête légendaire s\'est éveillée dans le désert.',
                objective: 'Affronte le Phénix d\'Or et récupère sa plume magique.',
                type: 'boss', rank_required: 'A', reward_col: 12000, reward_xp: 8000, subLocation: 'Désert d\'Ambre'
            },
            {
                title: 'Subjugation de l\'Hydre Abyssale', description: 'L\'entité primordiale émerge des profondeurs de Caelum.',
                objective: 'Vaincs l\'Hydre Abyssale au sommet de l\'Abysse Inférieur.',
                type: 'boss', rank_required: 'S', reward_col: 30000, reward_xp: 25000, subLocation: 'Caelum'
            }
        ];

        for (const q of baseQuests) {
            await Quest.findOrCreate({ where: { title: q.title }, defaults: q });
        }

        const questTypes = ["Chasse", "Récolte", "Exploration", "Escorte", "Infiltration", "Diplomatie"];
        const ranks = ["F", "E", "D", "C", "B", "A", "S"];
        const targets = ["Gobelins", "Loups", "Orques", "Spectres", "Dragons", "Slimes", "Bandits", "Apôtres"];
        const locations = ["Forêt", "Mine", "Grotte", "Plaine", "Montagne", "Ruines", "Château"];

        const proceduralQuests = [];
        for (let i = 0; i < 600; i++) {
            const type = questTypes[Math.floor(Math.random() * questTypes.length)];
            const rank = ranks[Math.floor(Math.random() * ranks.length)];
            const target = targets[Math.floor(Math.random() * targets.length)];
            const loc = locations[Math.floor(Math.random() * locations.length)];
            const title = `${type} de ${target} à ${loc} #${i}`;
            const xp = (ranks.indexOf(rank) + 1) * 200 + Math.floor(Math.random() * 100);
            const col = (ranks.indexOf(rank) + 1) * 300 + Math.floor(Math.random() * 200);

            proceduralQuests.push({
                title,
                description: `Une mission de type ${type} visant les ${target} dans la zone : ${loc}.`,
                objective: `Terminer l'opération ${type} avec succès.`,
                type: type.toLowerCase(),
                rank_required: rank,
                reward_col: col,
                reward_xp: xp
            });

            if (proceduralQuests.length >= 100) {
                await Quest.bulkCreate(proceduralQuests, { ignoreDuplicates: true });
                proceduralQuests.length = 0;
            }
        }
        if (proceduralQuests.length > 0) await Quest.bulkCreate(proceduralQuests, { ignoreDuplicates: true });
    }

    console.log('[DB] Normalizing all player stats to safeguard rank caps...');
    const rankCaps = { 'F': 50, 'E': 100, 'D': 150, 'C': 250, 'B': 400, 'A': 600, 'S': 1000 };
    const players = await Player.findAll();
    for (const p of players) {
        const cap = rankCaps[p.rank] || 50;
        let changed = false;

        const stats = ['strength', 'agility', 'intelligence', 'defense', 'luck'];
        for (const s of stats) {
            if (p[s] > cap) {
                console.log(`[DB Normalization] Clamping ${p.name} (${p.rank}) ${s}: ${p[s]} ➔ ${cap}`);
                p[s] = cap;
                changed = true;
            }
        }
        if (changed) {
            await p.save();
        }
    }

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

module.exports = {
  sequelize,
  mediaSequelize,
  Player, Dungeon, Quest, PlayerQuest, Bank, Item, Creds, Skill, Kingdom, Conflict, School, Duel, NPC, Monster, PlayerSkill, RPMessage, WorldJournal, Entity, Pact, Club, PlayerClub, House, TournamentParticipant, MediaAsset,
  setupDatabase,
};
