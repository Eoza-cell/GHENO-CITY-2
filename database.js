const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dragonballrp';

const Op = {
    ne: Symbol('ne'),
    or: Symbol('or'),
    lte: Symbol('lte'),
    like: Symbol('like'),
    in: Symbol('in'),
    lt: Symbol('lt')
};

const OpMap = {
    ne: '$ne',
    or: '$or',
    lte: '$lte',
    like: '$regex',
    in: '$in',
    lt: '$lt'
};

// --- SCHEMAS ---

const PlayerSchema = new mongoose.Schema({
    whatsappId: { type: String, unique: true, required: true },
    name: { type: String, default: 'Bêta testeur' },
    rank: { type: String, default: 'F' },
    race: { type: String, default: 'Humain' },
    skillPoints: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    zeni: { type: Number, default: 100 },
    health: { type: Number, default: 100 },
    maxHealth: { type: Number, default: 100 },
    ki: { type: Number, default: 100 },
    maxKi: { type: Number, default: 100 },
    inventory: { type: Array, default: [] },
    lastActivity: { type: Date, default: Date.now },
    lastInactiveMessageSentAt: { type: Date },
    location: { type: String, default: 'Mont Paozu' },
    mode: { type: String, default: 'normal' },
    characterDescription: { type: String },
    currentDungeonId: { type: String },
    registrationStep: { type: String },
    awaitingProfilePic: { type: Boolean, default: false },
    isGod: { type: Boolean, default: false },
    profilePicUrl: { type: String },
    schoolName: { type: String, default: 'Aucune' },
    academicGrade: { type: Number, default: 0 },
    tutorialStep: { type: Number, default: 0 },
    chapter: { type: Number, default: 1 },
    quest: { type: Number, default: 1 },
    strength: { type: Number, default: 10 },
    agility: { type: Number, default: 10 },
    intelligence: { type: Number, default: 10 },
    luck: { type: Number, default: 5 },
    defense: { type: Number, default: 10 },
    skills: [{
        skill: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },
        level: { type: Number, default: 1 }
    }],
    quests: [{
        quest: { type: mongoose.Schema.Types.ObjectId, ref: 'Quest' },
        status: { type: String, default: 'not_started' }
    }]
}, { timestamps: true });

// Emulate Sequelize methods
const updateMethod = function(data) {
    return this.set(data).save();
};

PlayerSchema.methods.update = updateMethod;

PlayerSchema.methods.increment = function(field, { by }) {
    this[field] = (this[field] || 0) + by;
    return this.save();
};

PlayerSchema.methods.decrement = function(field, { by }) {
    this[field] = (this[field] || 0) - by;
    return this.save();
};

PlayerSchema.methods.reload = async function() {
    return await Player.findById(this._id);
};

PlayerSchema.methods.getQuests = async function() {
    await this.populate('quests.quest');
    return this.quests.map(pq => {
        if (!pq.quest) return null;
        const q = pq.quest.toObject();
        q.PlayerQuest = { status: pq.status };
        return q;
    }).filter(q => q !== null);
};

PlayerSchema.methods.getSkills = async function() {
    await this.populate('skills.skill');
    return this.skills.map(ps => {
        if (!ps.skill) return null;
        const s = ps.skill.toObject();
        s.PlayerSkill = { level: ps.level };
        return s;
    }).filter(s => s !== null);
};

PlayerSchema.methods.addSkill = async function(skill) {
    if (!this.skills.find(s => s.skill.toString() === skill._id.toString())) {
        this.skills.push({ skill: skill._id });
        await this.save();
    }
};

PlayerSchema.methods.addQuest = async function(quest, options = {}) {
    if (!this.quests.find(q => q.quest.toString() === quest._id.toString())) {
        const status = (options.through && options.through.status) || 'not_started';
        this.quests.push({ quest: quest._id, status });
        await this.save();
    }
};

PlayerSchema.methods.hasSkill = async function(skill) {
    return this.skills.some(s => s.skill.toString() === skill._id.toString());
};

const ItemSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    description: String,
    price: { type: Number, default: 0 },
    type: String,
    slot: { type: String, default: 'none' },
    statBonuses: { type: Map, of: Number, default: {} },
    imageUrl: String
});

const DungeonSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    description: String,
    rank: String,
    floors: { type: Number, default: 1 }
});

const QuestSchema = new mongoose.Schema({
    title: { type: String, unique: true },
    description: String,
    type: { type: String, default: 'side' },
    rank_required: { type: String, default: 'E' },
    reward_zeni: { type: Number, default: 0 },
    reward_xp: { type: Number, default: 0 }
});

const BankSchema = new mongoose.Schema({
    playerWhatsappId: String,
    balance: { type: Number, default: 0 }
});

const SkillSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    description: String,
    type: String,
    manaCost: { type: Number, default: 0 },
    statBonuses: { type: Map, of: Number, default: {} }
});

const KingdomSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    description: String,
    status: { type: String, default: 'peace' },
    influence: { type: Number, default: 50 },
    militaryPower: { type: Number, default: 50 },
    leader: String
});

const ConflictSchema = new mongoose.Schema({
    title: String,
    description: String,
    involvedKingdoms: [String],
    status: { type: String, default: 'active' }
});

const SchoolSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    specialty: String,
    description: String,
    kingdomName: String
});

const RPMessageSchema = new mongoose.Schema({
    senderJid: String,
    senderName: String,
    content: String,
    location: String,
    timestamp: { type: Date, default: Date.now }
});

const NPCSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    role: String,
    description: String,
    location: String
});

const DuelSchema = new mongoose.Schema({
    playerAJid: String,
    playerBJid: String,
    startTime: { type: Date, default: Date.now },
    lastActionTime: { type: Date, default: Date.now },
    status: { type: String, default: 'active' },
    location: String
});

const MonsterSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    rank: String,
    health: Number,
    strength: Number,
    defense: Number,
    agility: Number,
    xp_reward: Number,
    zeni_reward: Number,
    imageUrl: String
});

const CredsSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String
});

CredsSchema.methods.update = updateMethod;

// --- MODELS ---

const Player = mongoose.model('Player', PlayerSchema);
const Item = mongoose.model('Item', ItemSchema);
const Dungeon = mongoose.model('Dungeon', DungeonSchema);
const Quest = mongoose.model('Quest', QuestSchema);
const Bank = mongoose.model('Bank', BankSchema);
const Skill = mongoose.model('Skill', SkillSchema);
const Kingdom = mongoose.model('Kingdom', KingdomSchema);
const Conflict = mongoose.model('Conflict', ConflictSchema);
const School = mongoose.model('School', SchoolSchema);
const RPMessage = mongoose.model('RPMessage', RPMessageSchema);
const NPC = mongoose.model('NPC', NPCSchema);
const Duel = mongoose.model('Duel', DuelSchema);
const Monster = mongoose.model('Monster', MonsterSchema);
const Creds = mongoose.model('Creds', CredsSchema);

// --- COMPATIBILITY WRAPPERS ---

function wrapModel(model) {
    return {
        async findOne(options) {
            const query = convertWhere(options.where);
            const doc = await model.findOne(query);
            return doc;
        },
        async findAll(options = {}) {
            const query = convertWhere(options.where);
            const mQuery = model.find(query);
            if (options.order) {
                const sort = {};
                options.order.forEach(([field, dir]) => {
                    sort[field] = dir === 'DESC' ? -1 : 1;
                });
                mQuery.sort(sort);
            }
            if (options.limit) {
                mQuery.limit(options.limit);
            }
            return await mQuery.exec();
        },
        async create(data) {
            return await model.create(data);
        },
        async count(options = {}) {
            const query = convertWhere(options.where);
            return await model.countDocuments(query);
        },
        async bulkCreate(dataList) {
            return await model.insertMany(dataList);
        },
        async findOrCreate(options) {
            let record = await this.findOne(options);
            if (record) return [record, false];
            record = await this.create(options.defaults || options.where);
            return [record, true];
        }
    };
}

function convertWhere(where) {
    if (!where) return {};
    const mongoQuery = {};

    // Handle top-level Op.or
    const symbols = Object.getOwnPropertySymbols(where);
    symbols.forEach(sym => {
        if (sym === Op.or) {
            mongoQuery['$or'] = where[sym].map(cond => convertWhere(cond));
        }
    });

    for (const key in where) {
        let val = where[key];
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            const subSymbols = Object.getOwnPropertySymbols(val);
            if (subSymbols.length > 0) {
                const operatorSym = subSymbols[0];
                const mOperator = OpMap[operatorSym.description] || operatorSym.description;
                let mVal = val[operatorSym];
                if (mOperator === '$regex' && typeof mVal === 'string') {
                    mVal = new RegExp(mVal.replace(/%/g, ''), 'i');
                }
                mongoQuery[key] = { [mOperator]: mVal };
            } else {
                mongoQuery[key] = val;
            }
        } else {
            if (Array.isArray(val)) {
                mongoQuery[key] = { $in: val };
            } else {
                mongoQuery[key] = val;
            }
        }
    }
    return mongoQuery;
}

const WrappedPlayer = wrapModel(Player);
const WrappedItem = wrapModel(Item);
const WrappedDungeon = wrapModel(Dungeon);
const WrappedQuest = wrapModel(Quest);
const WrappedBank = wrapModel(Bank);
const WrappedSkill = wrapModel(Skill);
const WrappedKingdom = wrapModel(Kingdom);
const WrappedConflict = wrapModel(Conflict);
const WrappedSchool = wrapModel(School);
const WrappedRPMessage = wrapModel(RPMessage);
const WrappedNPC = wrapModel(NPC);
const WrappedDuel = wrapModel(Duel);
const WrappedMonster = wrapModel(Monster);
const WrappedCreds = wrapModel(Creds);

async function setupDatabase() {
    try {
        await mongoose.connect(uri);
        console.log('Connected to MongoDB.');

        // Seed initial game data
        const dungeonCount = await Dungeon.countDocuments();
        if (dungeonCount === 0) {
            console.log('Seeding Zones de Combat for Dragon Ball...');
            await Dungeon.insertMany([
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
            await Item.findOneAndUpdate(
                { name: item.name },
                { $set: item },
                { upsert: true, new: true }
            );
        }
        console.log('Items synchronisés.');

        const questCount = await Quest.countDocuments();
        if (questCount === 0) {
            console.log('Seeding Quests...');
            await Quest.insertMany([
                { title: 'Entraînement de Tortue Géniale', description: 'Livrez le lait et labourez la terre à mains nues.', type: 'main', rank_required: 'F', reward_zeni: 100, reward_xp: 200 },
                { title: 'La Menace de l\'Armée du Ruban Rouge', description: 'Infiltrez une base du Ruban Rouge.', type: 'main', rank_required: 'E', reward_zeni: 500, reward_xp: 1000 },
                { title: 'À la recherche des Dragon Balls', description: 'Trouvez une Dragon Ball dans le désert.', type: 'side', rank_required: 'D', reward_zeni: 1000, reward_xp: 2000 },
                { title: 'Le 21ème Tenkaichi Budokai', description: 'Participez au tournoi mondial des arts martiaux.', type: 'main', rank_required: 'C', reward_zeni: 5000, reward_xp: 5000 },
                { title: 'L\'arrivée des Saiyans', description: 'Préparez-vous à l\'arrivée de Nappa et Vegeta.', type: 'main', rank_required: 'B', reward_zeni: 10000, reward_xp: 20000 },
            ]);
            console.log('Quests seeded.');
        }

        const skillCount = await Skill.countDocuments();
        if (skillCount === 0) {
            console.log('Seeding Skills...');
            await Skill.insertMany([
                { name: 'Kamehameha', description: 'Une puissante vague déferlante de Ki.', type: 'active', manaCost: 50, statBonuses: { intelligence: 20 } },
                { name: 'Masenko', description: 'Une décharge de Ki rapide tirée au-dessus de la tête.', type: 'active', manaCost: 40, statBonuses: { agility: 10 } },
                { name: 'Taiyoken', description: 'La morsure du soleil, aveugle temporairement l\'ennemi.', type: 'active', manaCost: 20 },
                { name: 'Vol (Bukujutsu)', description: 'Permet de se déplacer dans les airs.', type: 'passive', statBonuses: { agility: 20 } },
                { name: 'Kaioken', description: 'Multiplie la force au détriment de la santé.', type: 'active', manaCost: 80, statBonuses: { strength: 50, agility: 50 } },
                { name: 'Zenkai', description: 'Augmente la puissance après avoir frôlé la mort.', type: 'passive', statBonuses: { strength: 10, defense: 10 } },
            ]);
            console.log('Skills seeded.');
        }

        const kingdomCount = await Kingdom.countDocuments();
        if (kingdomCount === 0) {
            console.log('Seeding Locations for Dragon Ball...');
            await Kingdom.insertMany([
                { name: 'Terre', description: 'La planète bleue, foyer des humains et de nombreux guerriers Z.', status: 'peace', influence: 100, militaryPower: 50, leader: 'Roi de la Terre' },
                { name: 'Namek', description: 'La planète verte, foyer des Nameks et créatrice des Dragon Balls originales.', status: 'peace', influence: 50, militaryPower: 40, leader: 'Grand Chef' },
                { name: 'Planète Vegeta', description: 'Le foyer ancestral des Saiyans (détruite dans certains timelines).', status: 'war', influence: 80, militaryPower: 100, leader: 'Roi Vegeta' },
                { name: 'Planète Freezer n°79', description: 'Un avant-poste majeur de l\'armée de Freezer.', status: 'war', influence: 90, militaryPower: 95, leader: 'Freezer' }
            ]);
            console.log('Locations seeded.');
        }

        const npcCount = await NPC.countDocuments();
        if (npcCount === 0) {
            console.log('Seeding NPCs for Dragon Ball...');
            await NPC.insertMany([
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
            { name: 'Saibaman', rank: 'F', health: 100, strength: 20, defense: 10, agility: 20, xp_reward: 50, zeni_reward: 20 },
            { name: 'Soldat de Freezer', rank: 'E', health: 250, strength: 40, defense: 30, agility: 30, xp_reward: 150, zeni_reward: 100 },
            { name: 'Dinosaure Sauvage', rank: 'F', health: 150, strength: 25, defense: 15, agility: 10, xp_reward: 60, zeni_reward: 0 },
            { name: 'Nappa', rank: 'B', health: 4000, strength: 200, defense: 150, agility: 120, xp_reward: 5000, zeni_reward: 1000 },
            { name: 'Cell Junior', rank: 'A', health: 8000, strength: 400, defense: 300, agility: 450, xp_reward: 20000, zeni_reward: 5000 },
            { name: 'Majin Buu', rank: 'S', health: 50000, strength: 1000, defense: 800, agility: 600, xp_reward: 100000, zeni_reward: 0 },
        ];

        for (const monster of monstersToSeed) {
            await Monster.findOneAndUpdate(
                { name: monster.name },
                { $set: monster },
                { upsert: true, new: true }
            );
        }
        console.log('Ennemis synchronisés.');

    } catch (error) {
        console.error('[MongoDB] Setup failed:', error.message);
    }
}

module.exports = {
    mongoose,
    Op,
    Player: WrappedPlayer,
    Dungeon: WrappedDungeon,
    Quest: WrappedQuest,
    Bank: WrappedBank,
    Item: WrappedItem,
    Creds: WrappedCreds,
    Skill: WrappedSkill,
    Kingdom: WrappedKingdom,
    Conflict: WrappedConflict,
    School: WrappedSchool,
    Duel: WrappedDuel,
    NPC: WrappedNPC,
    Monster: WrappedMonster,
    RPMessage: WrappedRPMessage,
    setupDatabase,
};
