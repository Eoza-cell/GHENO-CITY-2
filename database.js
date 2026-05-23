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
    defaultValue: 'Little Sicily',
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
  age: {
    type: DataTypes.INTEGER,
    defaultValue: 18,
  },
  job: {
    type: DataTypes.STRING,
    defaultValue: 'Sans emploi',
  },
  salary: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isStudent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  careerPath: {
    type: DataTypes.STRING,
    defaultValue: 'Aucune', // Legal, Illegal, etc.
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

const Vehicle = sequelize.define('Vehicle', {
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
    topSpeed: {
        type: DataTypes.INTEGER,
        defaultValue: 150,
    },
    acceleration: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
    },
    brakePower: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
    },
    imageUrl: {
        type: DataTypes.STRING,
        allowNull: true,
    }
});

const PlayerVehicle = sequelize.define('PlayerVehicle', {
    damage: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    currentSpeed: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
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

Player.hasMany(PlayerVehicle);
PlayerVehicle.belongsTo(Player);
Vehicle.hasMany(PlayerVehicle);
PlayerVehicle.belongsTo(Vehicle);


async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');

    // Seed initial game data
    const dungeonCount = await Dungeon.count();
    if (dungeonCount === 0) {
        console.log('Seeding Territories for Gheno City...');
        await Dungeon.bulkCreate([
            // Rang E-D : Débuts dans le crime
            { name: 'Épicerie de 24/7', description: 'Un petit braquage facile pour se faire la main.', rank: 'E', floors: 1 },
            { name: 'Entrepôt Abandonné', description: 'Un squat servant de point de deal.', rank: 'D', floors: 3 },
            { name: 'Parking Souterrain', description: 'Idéal pour les échanges louches.', rank: 'D', floors: 2 },

            // Rang C-B : Crime Organisé
            { name: 'Bijouterie Vangelico', description: 'Des vitrines pleines de diamants, mais bien gardées.', rank: 'C', floors: 2 },
            { name: 'Banque de Fleeca', description: 'Une petite agence bancaire de province.', rank: 'C', floors: 1 },
            { name: 'Villa d\'un Parrain', description: 'Protection rapprochée et caméras partout.', rank: 'B', floors: 4 },
            { name: 'Port de Gheno City', description: 'Trafic de containers et douaniers corrompus.', rank: 'B', floors: 5 },

            // Rang A-S : Légendes de la Rue
            { name: 'Casino Diamond', description: 'Le coffre-fort le plus sécurisé de la ville.', rank: 'A', floors: 10 },
            { name: 'Union Depository', description: 'La banque centrale, des lingots d\'or par milliers.', rank: 'S', floors: 15 },
            { name: 'Base Militaire Fort Zancudo', description: 'Accès restreint. On y trouve le meilleur matos.', rank: 'S', floors: 5 }
        ]);
        console.log('Territories seeded.');
    }

    console.log('Synchronisation du contenu du jeu...');
    const itemsToSeed = [
            {
                name: 'Pistolet de combat',
                description: 'Une arme de poing fiable et précise.',
                price: 500,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 5, agility: 5 },
                imageUrl: 'https://static.wikia.nocookie.net/gtawiki/images/7/70/CombatPistol-GTAV.png'
            },
            {
                name: 'Carabine spéciale',
                description: 'Fusil d\'assaut polyvalent avec une cadence de tir élevée.',
                price: 2500,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 15, agility: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/gtawiki/images/3/30/SpecialCarbine-GTAV.png'
            },
            {
                name: 'Fusil à pompe',
                description: 'Dévastateur à courte portée.',
                price: 1200,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 20 },
                imageUrl: 'https://static.wikia.nocookie.net/gtawiki/images/4/4e/PumpShotgun-GTAV.png'
            },
            {
                name: 'Fusil de précision',
                description: 'Pour éliminer vos cibles à distance.',
                price: 5000,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { intelligence: 20, luck: 10 },
                imageUrl: 'https://static.wikia.nocookie.net/gtawiki/images/4/40/SniperRifle-GTAV.png'
            },
            {
                name: 'Gilet pare-balles léger',
                description: 'Une protection de base contre les tirs.',
                price: 300,
                type: 'armor',
                slot: 'chest',
                statBonuses: { defense: 10 },
            },
            {
                name: 'Gilet pare-balles lourd',
                description: 'Protection maximale pour les braquages.',
                price: 1000,
                type: 'armor',
                slot: 'chest',
                statBonuses: { defense: 25, agility: -5 },
            },
            {
                name: 'Casque de moto',
                description: 'Protège la tête et donne du style.',
                price: 150,
                type: 'armor',
                slot: 'head',
                statBonuses: { defense: 5 },
            },
            {
                name: 'Batte de baseball',
                description: 'Classique et efficace pour le corps à corps.',
                price: 50,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 10 },
            },
            {
                name: 'Poing américain',
                description: 'Pour donner plus de punch à vos patates.',
                price: 100,
                type: 'weapon',
                slot: 'weapon',
                statBonuses: { strength: 15 },
            },
            {
                name: 'Téléphone crypté',
                description: 'Indispensable pour les communications sécurisées.',
                price: 2000,
                type: 'accessory',
                slot: 'none',
                statBonuses: { intelligence: 15 },
            },
            {
                name: 'Scanner de police',
                description: 'Permet d\'écouter les fréquences du LSPD.',
                price: 1500,
                type: 'accessory',
                slot: 'none',
                statBonuses: { intelligence: 10, luck: 10 },
            },
            {
                name: 'Kit de crochetage',
                description: 'Pour ouvrir les voitures et les portes fermées.',
                price: 200,
                type: 'item',
                slot: 'none',
                statBonuses: { agility: 5, intelligence: 5 },
            }
        ];

    for (const item of itemsToSeed) {
        const [dbItem, created] = await Item.findOrCreate({
            where: { name: item.name },
            defaults: item
        });
        if (!created) {
            await dbItem.update(item); // Ensure images and stats are updated
        }
    }
    console.log('Items synchronisés.');

    const questCount = await Quest.count();
    if (questCount === 0) {
        console.log('Seeding Missions for Gheno City...');
        await Quest.bulkCreate([
            { title: 'Initiation au vol', description: 'Vole une voiture et ramène-la au garage clandestin.', type: 'main', rank_required: 'F', reward_col: 200, reward_xp: 100 },
            { title: 'Règlement de comptes', description: 'Donne une leçon à un petit revendeur qui ne paie pas sa taxe.', type: 'side', rank_required: 'E', reward_col: 500, reward_xp: 250 },
            { title: 'Le casse de l\'épicerie', description: 'Braque l\'épicerie du coin et échappe à la police.', type: 'main', rank_required: 'D', reward_col: 1000, reward_xp: 500 },
            { title: 'Livraison à haut risque', description: 'Transporte une cargaison suspecte à travers la ville sans te faire arrêter.', type: 'side', rank_required: 'C', reward_col: 2000, reward_xp: 1000 },
            { title: 'Braquage de la Bijouterie', description: 'Organise et exécute le vol de la bijouterie Vangelico.', type: 'main', rank_required: 'B', reward_col: 10000, reward_xp: 5000 },
            { title: 'Infiltration au LSPD', description: 'Récupère des dossiers compromettants au commissariat central.', type: 'main', rank_required: 'A', reward_col: 15000, reward_xp: 8000 },
            { title: 'Le Coup du Siècle', description: 'Braque l\'Union Depository.', type: 'main', rank_required: 'S', reward_col: 100000, reward_xp: 50000 },
        ]);
        console.log('Missions seeded.');
    }

    const skillCount = await Skill.count();
    if (skillCount === 0) {
        console.log('Seeding Skills...');
        await Skill.bulkCreate([
            // Techniques de Combat
            { name: 'Tir de précision', description: 'Augmente les chances de toucher les points vitaux.', type: 'active', manaCost: 20, statBonuses: { luck: 5 } },
            { name: 'Rafale contrôlée', description: 'Tire plusieurs balles avec une précision accrue.', type: 'active', manaCost: 30, statBonuses: { strength: 5 } },
            { name: 'Coup de crosse', description: 'Une attaque de mêlée puissante avec votre arme.', type: 'active', manaCost: 15, statBonuses: { strength: 8 } },

            // Conduite et Technologie
            { name: 'Pilote de course', description: 'Améliore la maniabilité et la vitesse de pointe des véhicules.', type: 'passive', statBonuses: { agility: 15 } },
            { name: 'Hacking express', description: 'Permet de pirater des terminaux simples rapidement.', type: 'active', manaCost: 25, statBonuses: { intelligence: 10 } },
            { name: 'As du volant', description: 'Réduit les dégâts subis lors des collisions en véhicule.', type: 'passive', statBonuses: { defense: 10 } },

            // Passifs et Survie
            { name: 'Peau dure', description: 'Augmente la résistance physique aux coups.', type: 'passive', statBonuses: { defense: 15 } },
            { name: 'Sang-froid', description: 'Réduit la consommation d\'énergie lors des actions stressantes.', type: 'passive', statBonuses: { luck: 10 } },
            { name: 'Réflexes d\'acier', description: 'Augmente l\'agilité de manière permanente.', type: 'passive', statBonuses: { agility: 10 } },

            // Spécialités
            { name: 'Discrétion urbaine', description: 'Permet de se fondre dans la foule ou les ombres.', type: 'active', manaCost: 20, statBonuses: { agility: 5 } },
            { name: 'Premier secours', description: 'Connaissances de base pour soigner des blessures légères.', type: 'active', manaCost: 35, statBonuses: { intelligence: 5 } }
        ]);
        console.log('Skills seeded.');
    }

    const kingdomCount = await Kingdom.count();
    if (kingdomCount === 0) {
        console.log('Seeding Factions for Gheno City...');
        await Kingdom.bulkCreate([
            { name: 'LSPD', description: 'Le Los Santos Police Department. Ils essaient de maintenir l\'ordre, ou du moins les apparences.', status: 'peace', influence: 90, militaryPower: 80, leader: 'Chef de police Goodwin' },
            { name: 'Cartel de Medellin', description: 'Importateurs massifs de drogue, basés dans le nord de la ville.', status: 'war', influence: 70, militaryPower: 90, leader: 'El Patrón' },
            { name: 'La Famille Leone', description: 'Mafia italienne traditionnelle contrôlant Little Sicily.', status: 'peace', influence: 85, militaryPower: 75, leader: 'Don Salvatore' },
            { name: 'Ballas', description: 'Gang de rue dominant les quartiers sud, reconnaissables à leurs vêtements violets.', status: 'war', influence: 50, militaryPower: 60, leader: 'Big T' },
            { name: 'The Lost MC', description: 'Club de motards hors-la-loi, rois de la route et du trafic d\'armes.', status: 'truce', influence: 40, militaryPower: 70, leader: 'Billy Grey' }
        ]);
        console.log('Factions seeded.');
    }

    const conflictCount = await Conflict.count();
    if (conflictCount === 0) {
        console.log('Seeding Conflicts...');
        await Conflict.bulkCreate([
            { title: 'Guerre de territoire au Sud', description: 'Les Ballas tentent de reprendre du terrain aux Families.', involvedKingdoms: JSON.stringify(['Ballas', 'Families']), status: 'active' },
            { title: 'Opération Clean City', description: 'Le LSPD lance une offensive majeure contre le Cartel de Medellin.', involvedKingdoms: JSON.stringify(['LSPD', 'Cartel de Medellin']), status: 'active' },
            { title: 'Tensions à Little Sicily', description: 'La Famille Leone fait face à une insurrection de petits gangs locaux.', involvedKingdoms: JSON.stringify(['La Famille Leone', 'Gangs Locaux']), status: 'active' }
        ]);
        console.log('Conflicts seeded.');
    }

    const schoolCount = await School.count();
    if (schoolCount === 0) {
        console.log('Seeding Centers...');
        await School.bulkCreate([
            { name: 'Lycée de Gheno City', specialty: 'Éducation Générale', description: 'Le passage obligé pour les mineurs de la ville.', kingdomName: 'Downtown' },
            { name: 'Stand de tir d\'Ammu-Nation', specialty: 'Armes à feu', description: 'Le meilleur endroit pour s\'entraîner au tir.', kingdomName: 'LSPD' },
            { name: 'Garage de Benny', specialty: 'Mécanique & Conduite', description: 'Apprends à piloter et à tuner tes bolides.', kingdomName: 'Families' },
            { name: 'Cyber Café DarkNet', specialty: 'Hacking & Tech', description: 'Un lieu discret pour apprendre l\'informatique souterraine.', kingdomName: 'Gangs Locaux' }
        ]);
        console.log('Centers seeded.');
    }

    const npcCount = await NPC.count();
    if (npcCount === 0) {
        console.log('Seeding NPCs for Gheno City...');
        await NPC.bulkCreate([
            { name: 'Don Salvatore', role: 'Parrain de la Famille Leone', description: 'Un vieil homme autoritaire qui dirige Little Sicily.', location: 'Little Sicily' },
            { name: 'Lamar Davis', role: 'Contact de rue', description: 'Un gars marrant qui a toujours des plans foireux.', location: 'Downtown' },
            { name: 'Inspecteur Tenpenny', role: 'Flic corrompu', description: 'Il gère la ville avec une main de fer et un compte en banque bien rempli.', location: 'LSPD' },
            { name: 'Benny', role: 'Mécano de génie', description: 'Si tu as besoin de booster ta caisse, c\'est lui qu\'il faut voir.', location: 'Strawberry' },
            { name: 'El Patrón', role: 'Chef du Cartel', description: 'Personne ne connaît son vrai visage, mais tout le monde craint son nom.', location: 'Industrial Zone' },
            { name: 'Paige Harris', role: 'Hacker experte', description: 'Elle peut faire tomber n\'importe quel pare-feu pour le bon prix.', location: 'Vinewood' },
            { name: 'Trevor Philips', role: 'Psychopathe notoire', description: 'Instable, dangereux, et possède sa propre entreprise d\'armes.', location: 'Sandy Shores' },
            { name: 'Franklin Clinton', role: 'Chauffeur d\'élite', description: 'Il connaît toutes les ruelles de la ville par cœur.', location: 'Little Sicily' },
            { name: 'Michael De Santa', role: 'Cerveau des braquages', description: 'Un pro à la retraite qui s\'ennuie dans sa villa.', location: 'Vinewood' },
            { name: 'Lester Crest', role: 'Organisateur', description: 'Le génie derrière les plus gros coups de la ville.', location: 'Downtown' },
            { name: 'Argo', role: 'Informatrice', description: 'Elle vend des secrets sur les mouvements de police.', location: 'Downtown' },
            { name: 'Agil', role: 'Vendeur d\'armes', description: 'Un colosse qui tient une boutique Ammu-Nation.', location: 'Little Sicily' },
            { name: 'Sachi', role: 'Vendeuse de café', description: 'Une jeune femme douce qui entend beaucoup de choses dans son café.', location: 'Little Sicily' },
            { name: 'Asuna', role: 'Lieutenant de gang', description: 'Aussi rapide avec un pistolet qu\'avec ses poings.', location: 'Downtown' },
            { name: 'Silica', role: 'Livreuse', description: 'Elle parcourt la ville sur son scooter pour livrer des paquets mystérieux.', location: 'Downtown' },
            { name: 'Lisbeth', role: 'Armurière', description: 'Spécialiste dans la modification d\'armes à feu.', location: 'Little Sicily' }
        ]);
        console.log('NPCs seeded.');
    }

    const monstersToSeed = [
            { name: 'Petit malfrat', rank: 'F', health: 50, strength: 5, defense: 2, agility: 5, xp_reward: 20, col_reward: 10 },
            { name: 'Chien de garde', rank: 'F', health: 40, strength: 8, defense: 1, agility: 12, xp_reward: 25, col_reward: 5 },
            { name: 'Dealer de rue', rank: 'E', health: 100, strength: 12, defense: 8, agility: 10, xp_reward: 50, col_reward: 30 },
            { name: 'Membre de gang', rank: 'D', health: 300, strength: 25, defense: 15, agility: 10, xp_reward: 150, col_reward: 80 },
            { name: 'Patrouille du LSPD', rank: 'C', health: 200, strength: 30, defense: 50, agility: 20, xp_reward: 400, col_reward: 150 },
            { name: 'Unité d\'élite NOOSE', rank: 'B', health: 1000, strength: 60, defense: 80, agility: 5, xp_reward: 1500, col_reward: 500 },
            { name: 'Agent du FIB', rank: 'A', health: 2000, strength: 100, defense: 100, agility: 40, xp_reward: 5000, col_reward: 1000 },
            // Bosses
            {
                name: 'Big T',
                rank: 'D',
                health: 800,
                strength: 40,
                defense: 30,
                agility: 25,
                xp_reward: 2000,
                col_reward: 1000,
                imageUrl: 'https://static.wikia.nocookie.net/gtawiki/images/4/41/BigT-GTAV.png'
            },
            {
                name: 'Le Boucher du Cartel',
                rank: 'A',
                health: 12000,
                strength: 180,
                defense: 150,
                agility: 100,
                xp_reward: 25000,
                col_reward: 15000,
            },
            {
                name: 'Inspecteur Tenpenny (Boss)',
                rank: 'S',
                health: 45000,
                strength: 350,
                defense: 250,
                agility: 400,
                xp_reward: 150000,
                col_reward: 80000,
            }
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
    console.log('Monsters synchronisés.');

    const vehicleCount = await Vehicle.count();
    if (vehicleCount === 0) {
        console.log('Seeding Vehicles...');
        await Vehicle.bulkCreate([
            { name: 'Bravado Gauntlet', description: 'Une muscle car américaine classique.', price: 32000, topSpeed: 180, acceleration: 12, brakePower: 8 },
            { name: 'Pegassi Zentorno', description: 'Une supercar ultra-rapide.', price: 725000, topSpeed: 340, acceleration: 25, brakePower: 15 },
            { name: 'Karin Kuruma (Blindée)', description: 'Indispensable pour les braquages.', price: 525000, topSpeed: 240, acceleration: 18, brakePower: 12 },
            { name: 'Bati 801', description: 'Une moto de sport agile et rapide.', price: 15000, topSpeed: 210, acceleration: 20, brakePower: 10 },
            { name: 'Vapid Sandking XL', description: 'Un tout-terrain massif.', price: 45000, topSpeed: 140, acceleration: 8, brakePower: 6 }
        ]);
        console.log('Vehicles seeded.');
    }

  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

module.exports = {
  sequelize,
  Player,
  Vehicle,
  PlayerVehicle,
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
  School,
  setupDatabase,
};
