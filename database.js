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
    specialty: { type: DataTypes.STRING }
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

Player.belongsToMany(Entity, { through: Pact });
Entity.belongsToMany(Player, { through: Pact });

Player.belongsToMany(Club, { through: PlayerClub });
Club.belongsToMany(Player, { through: PlayerClub });

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

    const kingdomCount = await Kingdom.count();
    if (kingdomCount === 0) {
        await Kingdom.bulkCreate([
            { name: 'Empire Impérial d\'Elion', description: 'Puissant royaume central.', status: 'peace', influence: 95, militaryPower: 90, leader: 'Empereur Valerius II' },
            { name: 'Dominion Noir de Vharos', description: 'Royaume de nécromancie.', status: 'war', influence: 60, militaryPower: 95, leader: 'Lich Lord Vharos' }
        ]);
    }

    const npcCount = await NPC.count();
    if (npcCount === 0) {
        await NPC.bulkCreate([
            { name: 'Directeur Magnus', role: 'Directeur de l\'Académie', description: 'Mage légendaire, gardien du Savoir Interdit.', location: 'Académie Impériale', powerLevel: 98, specialty: 'Magie Dimensionnelle' },
            { name: 'Asuna', role: 'L\'Éclair', description: 'Sous-chef des Chevaliers du Sang, héritière d\'une lignée de duellistes.', location: 'Lux Aeterna', powerLevel: 92, specialty: 'Vitesse de pointe' },
            { name: 'Général Kael', role: 'Commandant d\'Elion', description: 'Vétéran des guerres contre le Dominion Noir.', location: 'Cœur de l\'Empire', powerLevel: 95, specialty: 'Tactique et Force' },
            { name: 'Lumière d\'Aetherys', role: 'Héraut Céleste', description: 'Une entité pure sous forme humaine.', location: 'Temple Céleste', powerLevel: 99, specialty: 'Purification' }
        ]);
    }

    const entityCount = await Entity.count();
    if (entityCount === 0) {
        await Entity.bulkCreate([
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
            }
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
            }
        ]);
    }

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

module.exports = {
  sequelize,
  Player, Dungeon, Quest, PlayerQuest, Bank, Item, Creds, Skill, Kingdom, Conflict, School, Duel, NPC, Monster, PlayerSkill, RPMessage,
  setupDatabase,
};
