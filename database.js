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
  gender: {
    type: DataTypes.STRING,
    defaultValue: 'Non-défini',
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
    defaultValue: 'Eldoria',
  },
  subLocation: {
    type: DataTypes.STRING,
    defaultValue: 'Place Centrale',
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
    subLocation: { type: DataTypes.STRING, defaultValue: 'Entrée' },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const WorldJournal = sequelize.define('WorldJournal', {
    entry: { type: DataTypes.TEXT },
    importance: { type: DataTypes.INTEGER, defaultValue: 1 }, // 1: normal, 5: critical
    category: { type: DataTypes.STRING, defaultValue: 'general' }, // 'plot', 'character', 'world_event'
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

const TournamentParticipant = sequelize.define('TournamentParticipant', {
    playerJid: { type: DataTypes.STRING, primaryKey: true },
    playerName: { type: DataTypes.STRING },
    rank: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'registered' }, // 'registered', 'qualified', 'eliminated', 'winner'
    opponentJid: { type: DataTypes.STRING, allowNull: true },
    round: { type: DataTypes.INTEGER, defaultValue: 1 }
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
    intelligence: { type: DataTypes.INTEGER, defaultValue: 10 },
    location: { type: DataTypes.STRING, defaultValue: 'Eldoria' },
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
      WorldJournals: WorldJournal.rawAttributes
    };

    for (const [tableName, attributes] of Object.entries(tableDefinitions)) {
      try {
        // Check if table exists first to avoid describeTable error noise
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
            // Techniques de base par Classe
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
            { name: 'Souffle de Salamandre', description: 'Un cône de flammes ardentes.', type: 'Chevalier-Dragon', manaCost: 40, statBonuses: { strength: 10, intelligence: 10 } },

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
        { name: 'Origine de l\'Existence', description: 'Le domaine de ONE ABOVE ALL. Sub-locations: Autel de la Causalité, Mer de Conscience, Les Portes du Temps.', status: 'eternal', influence: 100, militaryPower: 100, leader: 'ONE ABOVE ALL' },
        { name: 'L\'Interstice', description: 'Dimension entre les mondes. Sub-locations: Ravin des Âmes, Forêt des Béhérits, Tour de la Main de Dieu.', status: 'unknown', influence: 80, militaryPower: 90, leader: 'L\'Idée du Mal' },
        { name: 'Royaume Céleste', description: 'Domaine des Entités Célestes. Sub-locations: Palais d\'Argent, Jardins d\'Éther, Cascade des Lumières.', status: 'peace', influence: 90, militaryPower: 85, leader: 'Aetherius' },
        { name: 'Terres Bestiales', description: 'Instinct et évolution. Sub-locations: Jungle de Fer, Caverne Primordiale, Pic du Prédateur.', status: 'neutral', influence: 70, militaryPower: 95, leader: 'Krakos' },
        { name: 'Empire d\'Elion', description: 'Royaume humain. Sub-locations: Place d\'Armes d\'Eldoria, Quartier des Nobles, Cathédrale de la Lumière, Bas-fonds.', status: 'peace', influence: 95, militaryPower: 90, leader: 'Empereur Valerius II' },
        { name: 'Nécropolis', description: 'Cité des morts. Sub-locations: Le Seuil des Morts, Allée des Tombeaux Oubliés, Trône du Jugement.', status: 'neutral', influence: 100, militaryPower: 80, leader: 'Orpheon' },
        { name: 'Vharos le Maudit', description: 'Territoire de l\'Apôtre. Sub-locations: Marais Putrides, Donjon de la Liche, Champs de Bataille Éternels.', status: 'war', influence: 60, militaryPower: 98, leader: 'Seigneur Vharos' },
        { name: 'Valkyr', description: 'Centre technologique. Sub-locations: Grand Laboratoire, Marché de l\'Éther, Académie de Magie, Tour de Surveillance.', status: 'peace', influence: 80, militaryPower: 70, leader: 'Archimage Kaelen' },
        { name: 'Gheno souterrain', description: 'Trafic de reliques. Sub-locations: Le Marché Noir, Le Caveau des Ombres, Taverne de l\'Exilé.', status: 'neutral', influence: 90, militaryPower: 60, leader: 'L\'Ombre' }
    ];
    for (const k of kingdomsToSeed) {
        await Kingdom.findOrCreate({ where: { name: k.name }, defaults: k });
    }

    const npcsToSeed = [
        { name: 'Griffith', role: 'Chef des Apôtres', description: 'A sacrifié son humanité via un Béhérit rouge pour devenir une divinité de l\'Interstice.', location: 'Interstice', powerLevel: 100, specialty: 'Aspiration Divine', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20Griffith%20Berserk%20femto%20look,%20god%20hand,%20interstice%20background?model=flux-anime' },
        { name: 'Void', role: 'Héraut de l\'Idée du Mal', description: 'Un être de pure volonté manipulant les Béhérits.', location: 'L\'Interstice', powerLevel: 100, specialty: 'Distorsion de Réalité', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20mysterious%20Void%20character%20with%20brain%20exposed,%20Berserk%20inspired?model=flux-anime' },
        { name: 'Orpheon', role: 'Juge des Âmes', description: 'Gardien de Nécropolis, il prépare les âmes au jugement final de One Above All.', location: 'Nécropolis', powerLevel: 99, specialty: 'Balance de l\'Existence', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20majestic%20judge%20of%20souls%20Orpheon?model=flux-anime' },
        { name: 'Directeur Magnus', role: 'Directeur de l\'Académie', description: 'Cherche désespérément un moyen de sceller les Béhérits.', location: 'Académie Impériale', powerLevel: 98, specialty: 'Sceaux Interdits', imageUrl: 'https://images.pollinations.ai/prompt/Anime%20style%20elderly%20powerful%20wizard%20Magnus?model=flux-anime' }
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
    } else {
        // Update existing monsters to ensure intelligence and location are set
        const monsters = [
            { name: 'Loup d\'Ombre', intelligence: 10, location: 'Forêt des Gobelins' },
            { name: 'Gobelin Éclaireur', intelligence: 8, location: 'Forêt des Gobelins' },
            { name: 'Orque Guerrier', intelligence: 12, location: 'Mine de Cobalt' },
            { name: 'Spectre des Mines', intelligence: 20, location: 'Mine de Cobalt' },
            { name: 'Chimère de Sang', intelligence: 25, location: 'Caverne des Ombres' },
            { name: 'Dragon d\'Azur', intelligence: 60, location: 'Volcan d\'Ignis' },
            { name: 'Le Roi Gobelin (BOSS)', intelligence: 35, location: 'Forêt des Gobelins' },
            { name: 'Vharos le Seigneur Liche (BOSS)', intelligence: 95, location: 'Vharos le Maudit' },
            { name: 'L\'Ombre du Néant (BOSS FINAL)', intelligence: 150, location: 'Origine de l\'Existence' }
        ];
        for (const m of monsters) {
            await Monster.update({ intelligence: m.intelligence, location: m.location }, { where: { name: m.name } });
        }
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
  Player, Dungeon, Quest, PlayerQuest, Bank, Item, Creds, Skill, Kingdom, Conflict, School, Duel, NPC, Monster, PlayerSkill, RPMessage, WorldJournal, Entity, Pact, Club, PlayerClub, House, TournamentParticipant,
  setupDatabase,
};
