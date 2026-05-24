const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'dragon-ball.sqlite',
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
  race: {
    type: DataTypes.STRING,
    defaultValue: 'Humain',
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
  zeni: { // Changed from col
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
  ki: { // Changed from mana
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  maxKi: {
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
    defaultValue: 0, // Score out of 100
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
        get() {
            const rawValue = this.getDataValue('involvedKingdoms');
            try {
                return rawValue ? JSON.parse(rawValue) : [];
            } catch (e) {
                return [];
            }
        },
        set(value) {
            this.setDataValue('involvedKingdoms', JSON.stringify(value));
        },
    },
    status: { // 'active', 'resolved'
        type: DataTypes.STRING,
        defaultValue: 'active',
    }
});

const School = sequelize.define('School', {
    name: {
        type: DataTypes.STRING,
        unique: true,
    },
    specialty: {
        type: DataTypes.STRING, // e.g., 'Combat', 'Magic', 'Alchemy'
    },
    description: {
        type: DataTypes.TEXT,
    },
    kingdomName: {
        type: DataTypes.STRING,
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

const Duel = sequelize.define('Duel', {
    playerAJid: {
        type: DataTypes.STRING,
    },
    playerBJid: {
        type: DataTypes.STRING,
    },
    startTime: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    lastActionTime: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    status: { // 'active', 'finished'
        type: DataTypes.STRING,
        defaultValue: 'active',
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
    },
    imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
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
        console.log('Seeding Zones de Combat for Dragon Ball...');
        await Dungeon.bulkCreate([
            { name: 'Plaines de la Terre', description: 'Un terrain d\'entraînement basique.', rank: 'F', floors: 1 },
            { name: 'Désert de Yamcha', description: 'Un désert aride où rodent des bandits.', rank: 'E', floors: 3 },
            { name: 'Mont Paozu', description: 'La montagne où Goku a grandi, remplie de bêtes sauvages.', rank: 'D', floors: 5 },
            { name: 'Tour de Karine', description: 'Une tour immense testant l\'endurance des grimpeurs.', rank: 'C', floors: 10 },
            { name: 'Palais du Très Haut', description: 'Un lieu sacré au-dessus des nuages.', rank: 'B', floors: 5 },
            { name: 'Vaisseau de Freezer', description: 'Une forteresse technologique spatiale.', rank: 'A', floors: 15 },
            { name: 'Salle de l\'Esprit et du Temps', description: 'Un an d\'entraînement en un jour.', rank: 'S', floors: 1 },
            { name: 'Planète de Beerus', description: 'Le domaine du Dieu de la Destruction.', rank: 'S', floors: 1 }
        ]);
        console.log('Zones seeded.');
    }

    console.log('Synchronisation du contenu du jeu...');
    const itemsToSeed = [
            {
                name: 'Senzu',
                description: 'Un haricot magique qui restaure instantanément toute la santé et le Ki.',
                price: 1000,
                type: 'consumable',
                slot: 'none',
                statBonuses: {},
                imageUrl: 'https://static.wikia.nocookie.net/dragonball/images/e/e1/Senzu_Bean_Bag.png'
            },
            {
                name: 'Armure Saiyan',
                description: 'Une armure légère et ultra-résistante utilisée par l\'armée de Freezer.',
                price: 5000,
                type: 'armor',
                slot: 'chest',
                statBonuses: { defense: 50, agility: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/dragonball/images/3/31/SaiyanArmor.png'
            },
            {
                name: 'Scouter',
                description: 'Un appareil permettant de mesurer la puissance de combat.',
                price: 2000,
                type: 'accessory',
                slot: 'head',
                statBonuses: { intelligence: 30 },
                imageUrl: 'https://static.wikia.nocookie.net/dragonball/images/8/8a/Scouter_Green.png'
            },
            {
                name: 'Poids d\'entraînement',
                description: 'Des vêtements lourds pour augmenter la force lors de l\'entraînement.',
                price: 3000,
                type: 'accessory',
                slot: 'none',
                statBonuses: { strength: 20, agility: -5 },
            },
            {
                name: 'Nyoibo',
                description: 'Le bâton magique qui s\'allonge à volonté.',
                price: 4000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 15, agility: 15 },
            }
        ];

    for (const item of itemsToSeed) {
        const [dbItem, created] = await Item.findOrCreate({
            where: { name: item.name },
            defaults: item
        });
        if (!created) {
            await dbItem.update(item);
        }
    }
    console.log('Items synchronisés.');

    const questCount = await Quest.count();
    if (questCount === 0) {
        console.log('Seeding Quests...');
        await Quest.bulkCreate([
            { title: 'Entraînement de Tortue Géniale', description: 'Livrez le lait et labourez la terre à mains nues.', type: 'main', rank_required: 'F', reward_col: 100, reward_xp: 200 },
            { title: 'La Menace de l\'Armée du Ruban Rouge', description: 'Infiltrez une base du Ruban Rouge.', type: 'main', rank_required: 'E', reward_col: 500, reward_xp: 1000 },
            { title: 'À la recherche des Dragon Balls', description: 'Trouvez une Dragon Ball dans le désert.', type: 'side', rank_required: 'D', reward_col: 1000, reward_xp: 2000 },
            { title: 'Le 21ème Tenkaichi Budokai', description: 'Participez au tournoi mondial des arts martiaux.', type: 'main', rank_required: 'C', reward_col: 5000, reward_xp: 5000 },
            { title: 'L\'arrivée des Saiyans', description: 'Préparez-vous à l\'arrivée de Nappa et Vegeta.', type: 'main', rank_required: 'B', reward_col: 10000, reward_xp: 20000 },
        ]);
        console.log('Quests seeded.');
    }

    const skillCount = await Skill.count();
    if (skillCount === 0) {
        console.log('Seeding Skills...');
        await Skill.bulkCreate([
            { name: 'Kamehameha', description: 'Une puissante vague déferlante de Ki.', type: 'active', manaCost: 50, statBonuses: { intelligence: 20 } },
            { name: 'Masenko', description: 'Une décharge de Ki rapide tirée au-dessus de la tête.', type: 'active', manaCost: 40, statBonuses: { agility: 10 } },
            { name: 'Taiyoken', description: 'La morsure du soleil, aveugle temporairement l\'ennemi.', type: 'active', manaCost: 20 },
            { name: 'Vol (Bukujutsu)', description: 'Permet de se déplacer dans les airs.', type: 'passive', statBonuses: { agility: 20 } },
            { name: 'Kaioken', description: 'Multiplie la force au détriment de la santé.', type: 'active', manaCost: 80, statBonuses: { strength: 50, agility: 50 } },
            { name: 'Zenkai', description: 'Augmente la puissance après avoir frôlé la mort.', type: 'passive', statBonuses: { strength: 10, defense: 10 } },
        ]);
        console.log('Skills seeded.');
    }

    const kingdomCount = await Kingdom.count();
    if (kingdomCount === 0) {
        console.log('Seeding Locations for Dragon Ball...');
        await Kingdom.bulkCreate([
            { name: 'Terre', description: 'La planète bleue, foyer des humains et de nombreux guerriers Z.', status: 'peace', influence: 100, militaryPower: 50, leader: 'Roi de la Terre' },
            { name: 'Namek', description: 'La planète verte, foyer des Nameks et créatrice des Dragon Balls originales.', status: 'peace', influence: 50, militaryPower: 40, leader: 'Grand Chef' },
            { name: 'Planète Vegeta', description: 'Le foyer ancestral des Saiyans (détruite dans certains timelines).', status: 'war', influence: 80, militaryPower: 100, leader: 'Roi Vegeta' },
            { name: 'Planète Freezer n°79', description: 'Un avant-poste majeur de l\'armée de Freezer.', status: 'war', influence: 90, militaryPower: 95, leader: 'Freezer' }
        ]);
        console.log('Locations seeded.');
    }

    const npcCount = await NPC.count();
    if (npcCount === 0) {
        console.log('Seeding NPCs for Dragon Ball...');
        await NPC.bulkCreate([
            { name: 'Goku', role: 'Défenseur de la Terre', description: 'Un guerrier Saiyan toujours en quête de puissance.', location: 'Mont Paozu' },
            { name: 'Vegeta', role: 'Prince des Saiyans', description: 'Un guerrier fier et puissant, rival de Goku.', location: 'Capsule Corp' },
            { name: 'Tortue Géniale', role: 'Maître des Arts Martiaux', description: 'Le créateur du Kamehameha, vivant sur son île.', location: 'Kame House' },
            { name: 'Bulma', role: 'Scientifique de Génie', description: 'L\'inventrice du Dragon Radar et héritière de Capsule Corp.', location: 'Capsule Corp' },
            { name: 'Piccolo', role: 'Guerrier Namek', description: 'L\'ancien ennemi devenu le mentor de Gohan.', location: 'Palais du Très Haut' },
            { name: 'Maître Karine', role: 'Gardien de la Tour', description: 'Un chat ermite expert en arts martiaux.', location: 'Tour de Karine' },
        ]);
        console.log('NPCs seeded.');
    }

    const monstersToSeed = [
            { name: 'Saibaman', rank: 'F', health: 100, strength: 20, defense: 10, agility: 20, xp_reward: 50, col_reward: 20 },
            { name: 'Soldat de Freezer', rank: 'E', health: 250, strength: 40, defense: 30, agility: 30, xp_reward: 150, col_reward: 100 },
            { name: 'Dinosaure Sauvage', rank: 'F', health: 150, strength: 25, defense: 15, agility: 10, xp_reward: 60, col_reward: 0 },
            { name: 'Nappa', rank: 'B', health: 4000, strength: 200, defense: 150, agility: 120, xp_reward: 5000, col_reward: 1000 },
            { name: 'Cell Junior', rank: 'A', health: 8000, strength: 400, defense: 300, agility: 450, xp_reward: 20000, col_reward: 5000 },
            { name: 'Majin Buu', rank: 'S', health: 50000, strength: 1000, defense: 800, agility: 600, xp_reward: 100000, col_reward: 0 },
        ];

    for (const monster of monstersToSeed) {
        const [dbMonster, created] = await Monster.findOrCreate({
            where: { name: monster.name },
            defaults: monster
        });
        if (!created) {
            await dbMonster.update(monster);
        }
    }
    console.log('Ennemis synchronisés.');

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
  School,
  Duel,
  NPC,
  Monster,
  PlayerSkill,
  RPMessage,
  setupDatabase,
};
