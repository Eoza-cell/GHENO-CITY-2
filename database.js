const PocketBase = require('pocketbase/cjs');
require('dotenv').config();

const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://127.0.0.1:8090');

const Op = {
    ne: Symbol('ne'),
    or: Symbol('or'),
    lte: Symbol('lte'),
    like: Symbol('like'),
    in: Symbol('in'),
    lt: Symbol('lt')
};

// Auth as admin if credentials provided
async function authAdmin() {
    if (process.env.POCKETBASE_EMAIL && process.env.POCKETBASE_PASSWORD) {
        try {
            await pb.admins.authWithPassword(process.env.POCKETBASE_EMAIL, process.env.POCKETBASE_PASSWORD);
        } catch (e) {
            console.error("[PocketBase] Admin auth failed:", e.message);
        }
    }
}

function buildFilter(where) {
    if (!where) return '';
    const parts = [];

    const parseCondition = (key, val) => {
        if (val === null) return `${key}=null`;
        if (typeof val === 'object' && !Array.isArray(val)) {
            const operator = Object.getOwnPropertySymbols(val)[0];
            const operand = val[operator];
            switch (operator) {
                case Op.ne: return `${key}!="${operand}"`;
                case Op.lte: return `${key}<=${operand}`;
                case Op.lt: return `${key}<${operand}`;
                case Op.like: return `${key}~"${operand.replace(/%/g, '')}"`;
                case Op.in:
                    if (Array.isArray(operand)) {
                        return '(' + operand.map(v => `${key}="${v}"`).join(' || ') + ')';
                    }
                    return `${key}="${operand}"`;
                default: return `${key}="${val}"`;
            }
        }
        return `${key}="${val}"`;
    };

    for (const key in where) {
        if (key === Op.or && Array.isArray(where[key])) {
            parts.push('(' + where[key].map(cond => {
                const subParts = [];
                for (const subKey in cond) {
                    subParts.push(parseCondition(subKey, cond[subKey]));
                }
                return subParts.join(' && ');
            }).join(' || ') + ')');
        } else {
            parts.push(parseCondition(key, where[key]));
        }
    }
    return parts.join(' && ');
}

// Wrapper for collection to mimic some Sequelize methods
const collection = (name) => {
    return {
        async findOne(options) {
            try {
                const filter = buildFilter(options.where);
                const result = await pb.collection(name).getFirstListItem(filter);
                return wrapRecord(name, result);
            } catch (e) {
                return null;
            }
        },
        async findAll(options = {}) {
            try {
                const filter = buildFilter(options.where);
                const result = await pb.collection(name).getFullList({
                    filter: filter,
                    sort: options.order ? (options.order[0][1] === 'DESC' ? '-' : '') + options.order[0][0] : ''
                });
                return result.map(r => wrapRecord(name, r));
            } catch (e) {
                return [];
            }
        },
        async create(data) {
            // Handle JSON fields that might be strings in Sequelize but should be objects in PB
            const sanitizedData = { ...data };
            if (typeof sanitizedData.inventory === 'string') sanitizedData.inventory = JSON.parse(sanitizedData.inventory);
            if (typeof sanitizedData.statBonuses === 'string') sanitizedData.statBonuses = JSON.parse(sanitizedData.statBonuses);
            if (typeof sanitizedData.involvedKingdoms === 'string') sanitizedData.involvedKingdoms = JSON.parse(sanitizedData.involvedKingdoms);

            const result = await pb.collection(name).create(sanitizedData);
            return wrapRecord(name, result);
        },
        async count(options = {}) {
            try {
                const filter = buildFilter(options.where);
                const result = await pb.collection(name).getList(1, 1, { filter });
                return result.totalItems;
            } catch (e) {
                return 0;
            }
        },
        async bulkCreate(dataList) {
            const results = [];
            for (const data of dataList) {
                results.push(await this.create(data));
            }
            return results;
        },
        async findOrCreate(options) {
            let record = await this.findOne(options);
            if (record) return [record, false];
            record = await this.create(options.defaults || options.where);
            return [record, true];
        }
    };
};

function wrapRecord(collectionName, record) {
    if (!record) return null;

    // Add Sequelize-like methods
    record.update = async function(data) {
        const updated = await pb.collection(collectionName).update(this.id, data);
        Object.assign(this, updated);
        return this;
    };

    record.increment = async function(field, { by }) {
        const currentVal = this[field] || 0;
        const updated = await pb.collection(collectionName).update(this.id, {
            [field]: currentVal + by
        });
        Object.assign(this, updated);
        return this;
    };

    record.decrement = async function(field, { by }) {
        const currentVal = this[field] || 0;
        const updated = await pb.collection(collectionName).update(this.id, {
            [field]: currentVal - by
        });
        Object.assign(this, updated);
        return this;
    };

    record.save = async function() {
        const { id, collectionId, collectionName: cName, created, updated, ...data } = this;
        const saved = await pb.collection(collectionName).update(this.id, data);
        Object.assign(this, saved);
        return this;
    };

    record.reload = async function() {
        const reloaded = await pb.collection(collectionName).getOne(this.id);
        Object.assign(this, reloaded);
        return this;
    };

    // Helper for many-to-many
    record.getQuests = async function() {
        // Implementation depends on how you store relationships in PB
        // Assuming 'quests' is a relation field on players
        if (!this.quests) return [];
        const quests = [];
        for (const id of this.quests) {
            const q = await pb.collection('quests').getOne(id);
            quests.push(wrapRecord('quests', q));
        }
        return quests;
    };
    record.getSkills = async function() {
        if (!this.skills) return [];
        const skills = [];
        for (const id of this.skills) {
            const s = await pb.collection('skills').getOne(id);
            skills.push(wrapRecord('skills', s));
        }
        return skills;
    };
    record.addSkill = async function(skill) {
        const skills = this.skills || [];
        if (!skills.includes(skill.id)) {
            skills.push(skill.id);
            await this.update({ skills });
        }
    };
    record.addQuest = async function(quest, options = {}) {
        const quests = this.quests || [];
        if (!quests.includes(quest.id)) {
            quests.push(quest.id);
            await this.update({ quests });
        }
        // Handle options like { through: { status: 'not_started' } } if needed
        // This would require a junction collection or a JSON field in player
    };
    record.hasSkill = async function(skill) {
        const skills = this.skills || [];
        return skills.includes(skill.id);
    };

    return record;
}

const Player = collection('players');
const Item = collection('items');
const Dungeon = collection('dungeons');
const Quest = collection('quests');
const Bank = collection('banks');
const Skill = collection('skills');
const Kingdom = collection('kingdoms');
const Conflict = collection('conflicts');
const School = collection('schools');
const RPMessage = collection('rp_messages');
const NPC = collection('npcs');
const Duel = collection('duels');
const Monster = collection('monsters');
const Creds = collection('creds');

async function setupDatabase() {
  try {
    await authAdmin();
    console.log('Connected to PocketBase.');

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
        await Item.findOrCreate({
            where: { name: item.name },
            defaults: item
        });
    }
    console.log('Items synchronisés.');

    const questCount = await Quest.count();
    if (questCount === 0) {
        console.log('Seeding Quests...');
        await Quest.bulkCreate([
            { title: 'Entraînement de Tortue Géniale', description: 'Livrez le lait et labourez la terre à mains nues.', type: 'main', rank_required: 'F', reward_zeni: 100, reward_xp: 200 },
            { title: 'La Menace de l\'Armée du Ruban Rouge', description: 'Infiltrez une base du Ruban Rouge.', type: 'main', rank_required: 'E', reward_zeni: 500, reward_xp: 1000 },
            { title: 'À la recherche des Dragon Balls', description: 'Trouvez une Dragon Ball dans le désert.', type: 'side', rank_required: 'D', reward_zeni: 1000, reward_xp: 2000 },
            { title: 'Le 21ème Tenkaichi Budokai', description: 'Participez au tournoi mondial des arts martiaux.', type: 'main', rank_required: 'C', reward_zeni: 5000, reward_xp: 5000 },
            { title: 'L\'arrivée des Saiyans', description: 'Préparez-vous à l\'arrivée de Nappa et Vegeta.', type: 'main', rank_required: 'B', reward_zeni: 10000, reward_xp: 20000 },
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
        await Monster.findOrCreate({
            where: { name: monster.name },
            defaults: monster
        });
    }
    console.log('Ennemis synchronisés.');

  } catch (error) {
    console.error('[PocketBase] Setup failed:', error.message);
  }
}

module.exports = {
  pb,
  Op,
  Player,
  Dungeon,
  Quest,
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
  RPMessage,
  setupDatabase,
};
