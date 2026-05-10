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
            { name: 'Désert de la Mort', description: 'Une étendue de sable infinie abritant des scorpions géants et des cités perdues.', rank: 'C', floors: 12 },
            { name: 'Tour des Épreuves', description: 'Une tour s\'élevant au-dessus des nuages, testant la volonté des héros.', rank: 'A', floors: 50 },
            { name: 'Océan de Corail', description: 'Un royaume sous-marin protégé par des sirènes guerrières.', rank: 'B', floors: 20 },
            { name: 'Volcan d\'Ignis', description: 'Le cœur brûlant du monde, gardé par un dragon de feu ancien.', rank: 'S', floors: 30 },
            { name: 'Jardin Suspendu d\'Éden', description: 'Un paradis aérien rempli de créatures célestes protectrices.', rank: 'A', floors: 15 },
            { name: 'Forteresse de Fer', description: 'Une citadelle imprenable située dans les montagnes du Nord.', rank: 'B', floors: 25 },
            { name: 'Ruines de Xanadu', description: 'Une cité antique autrefois glorieuse, maintenant hantée par des spectres.', rank: 'C', floors: 18 },
            { name: 'Abysse de l\'Oubli', description: 'Un gouffre sans fond où résident des entités cosmiques terrifiantes.', rank: 'S', floors: 50 },
            { name: 'Citadelle de Cristal', description: 'Une forteresse de verre brillant sous un soleil éternel.', rank: 'A', floors: 30 },
            { name: 'Marais Empoisonnés', description: 'Un lieu fétide où chaque pas peut être le dernier.', rank: 'C', floors: 10 },
            { name: 'Montagnes du Tonnerre', description: 'Des sommets perpétuellement frappés par la foudre.', rank: 'B', floors: 22 },
            { name: 'Nécropole de Granit', description: 'Une cité des morts sculptée dans la roche noire.', rank: 'S', floors: 45 },
            { name: 'Jardin des Murmures', description: 'Un labyrinthe végétal où les fleurs parlent aux voyageurs.', rank: 'D', floors: 8 },
            { name: 'Porte du Néant', description: 'Une faille dimensionnelle au bord du monde connu.', rank: 'S', floors: 99 },
            { name: 'Récif des Sirènes', description: 'Un paradis trompeur caché sous les vagues.', rank: 'B', floors: 15 },
            { name: 'Désert de Sel', description: 'Une étendue blanche aveuglante où rien ne survit.', rank: 'C', floors: 12 },
            { name: 'Forêt d\'Émeraude', description: 'Le berceau de la magie ancienne, gardé par des esprits sylvains.', rank: 'A', floors: 20 },
            { name: 'Crypte des Rois Oubliés', description: 'Le repos éternel de ceux qui ont jadis régné sur Skype.', rank: 'B', floors: 18 },
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
