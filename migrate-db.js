/**
 * Database Migration Script: Neon DB to Aiven PostgreSQL (or SQLite to PostgreSQL)
 *
 * Usage:
 *   node migrate-db.js <SOURCE_URI> <TARGET_URI>
 *
 * Example:
 *   node migrate-db.js postgres://user:pass@neon-host/dbname postgres://user:pass@aiven-host/dbname
 *
 * If you want to migrate your local SQLite database to the new Aiven DB:
 *   node migrate-db.js sqlite://gheno-city.sqlite postgres://user:pass@aiven-host/dbname
 */

const { Sequelize, DataTypes } = require('sequelize');

const sourceUri = process.argv[2];
const targetUri = process.argv[3];

if (!sourceUri || !targetUri) {
  console.error('\x1b[31m%s\x1b[0m', 'Error: Source URI or Target URI missing!');
  console.log('Usage:');
  console.log('  node migrate-db.js <SOURCE_URI> <TARGET_URI>');
  console.log('\nExamples:');
  console.log('  node migrate-db.js postgres://user:pass@neon-host/dbname postgres://user:pass@aiven-host/dbname');
  console.log('  node migrate-db.js sqlite://gheno-city.sqlite postgres://user:pass@aiven-host/dbname');
  process.exit(1);
}

// 1. Initialize Sequeli-connections
const sourceDialectOptions = sourceUri.startsWith('postgres') ? {
  ssl: { require: true, rejectUnauthorized: false }
} : {};

const targetDialectOptions = targetUri.startsWith('postgres') ? {
  ssl: { require: true, rejectUnauthorized: false }
} : {};

const sourceSeq = new Sequelize(sourceUri, {
  logging: false,
  dialectOptions: sourceDialectOptions
});

const targetSeq = new Sequelize(targetUri, {
  logging: false,
  dialectOptions: targetDialectOptions
});

// Import model configurations dynamically based on database.js or re-declare schemas precisely
function defineModelsForConn(sequelizeInstance) {
  const Creds = sequelizeInstance.define('Creds', {
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.TEXT },
  });

  const Player = sequelizeInstance.define('Player', {
    whatsappId: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, defaultValue: 'Bêta testeur' },
    gender: { type: DataTypes.STRING, defaultValue: 'Non-défini' },
    race: { type: DataTypes.STRING, defaultValue: 'Humain' },
    age: { type: DataTypes.INTEGER, defaultValue: 18 },
    rank: { type: DataTypes.STRING, defaultValue: 'F' },
    class: { type: DataTypes.STRING, defaultValue: 'Aucune' },
    family: { type: DataTypes.STRING, defaultValue: 'Aucune' },
    derivative: { type: DataTypes.STRING, defaultValue: 'Aucun' },
    skillPoints: { type: DataTypes.INTEGER, defaultValue: 0 },
    level: { type: DataTypes.INTEGER, defaultValue: 1 },
    xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    academicYear: { type: DataTypes.INTEGER, defaultValue: 1 },
    col: { type: DataTypes.INTEGER, defaultValue: 100 },
    health: { type: DataTypes.INTEGER, defaultValue: 100 },
    maxHealth: { type: DataTypes.INTEGER, defaultValue: 100 },
    mana: { type: DataTypes.INTEGER, defaultValue: 100 },
    maxMana: { type: DataTypes.INTEGER, defaultValue: 100 },
    hunger: { type: DataTypes.INTEGER, defaultValue: 100 },
    sleep: { type: DataTypes.INTEGER, defaultValue: 100 },
    inventory: { type: DataTypes.TEXT, defaultValue: '[]' },
    lastActivity: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    lastInactiveMessageSentAt: { type: DataTypes.DATE, allowNull: true },
    location: { type: DataTypes.STRING, defaultValue: "Empire Impérial d'Elion" },
    subLocation: { type: DataTypes.STRING, defaultValue: 'Eldoria' },
    mode: { type: DataTypes.STRING, defaultValue: 'normal' },
    characterDescription: { type: DataTypes.TEXT, allowNull: true },
    currentDungeonId: { type: DataTypes.INTEGER, allowNull: true },
    registrationStep: { type: DataTypes.STRING, allowNull: true },
    awaitingProfilePic: { type: DataTypes.BOOLEAN, defaultValue: false },
    isGod: { type: DataTypes.BOOLEAN, defaultValue: false },
    profilePicUrl: { type: DataTypes.STRING, allowNull: true },
    schoolName: { type: DataTypes.STRING, defaultValue: 'Aucune' },
    academicGrade: { type: DataTypes.INTEGER, defaultValue: 0 },
    occupation: { type: DataTypes.STRING, defaultValue: 'Citoyen' },
    organization: { type: DataTypes.STRING, defaultValue: 'Aucune' },
    influence: { type: DataTypes.INTEGER, defaultValue: 0 },
    tutorialStep: { type: DataTypes.FLOAT, defaultValue: 0 },
    tutorialTurns: { type: DataTypes.INTEGER, defaultValue: 0 },
    strength: { type: DataTypes.INTEGER, defaultValue: 5 },
    agility: { type: DataTypes.INTEGER, defaultValue: 5 },
    intelligence: { type: DataTypes.INTEGER, defaultValue: 5 },
    luck: { type: DataTypes.INTEGER, defaultValue: 2 },
    defense: { type: DataTypes.INTEGER, defaultValue: 5 },
    equippedOutfit: { type: DataTypes.STRING, allowNull: true },
    wantedLevel: { type: DataTypes.INTEGER, defaultValue: 0 },
    isPrisoner: { type: DataTypes.BOOLEAN, defaultValue: false },
    masterId: { type: DataTypes.STRING, allowNull: true },
    servantPowerBonus: { type: DataTypes.FLOAT, defaultValue: 0 },
    fusedWithId: { type: DataTypes.STRING, allowNull: true },
    fusionSyncLevel: { type: DataTypes.FLOAT, defaultValue: 0 },
  });

  const Item = sequelizeInstance.define('Item', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    price: { type: DataTypes.INTEGER, defaultValue: 0 },
    type: { type: DataTypes.STRING },
    rarity: { type: DataTypes.STRING, defaultValue: 'common' },
    slot: { type: DataTypes.STRING, defaultValue: 'none' },
    durability: { type: DataTypes.INTEGER, defaultValue: 100 },
    visualData: { type: DataTypes.TEXT, defaultValue: '{"color": "#ffffff", "style": "standard"}' },
    statBonuses: { type: DataTypes.TEXT, defaultValue: '{}' },
    imageUrl: { type: DataTypes.STRING, allowNull: true },
  });

  const Dungeon = sequelizeInstance.define('Dungeon', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    rank: { type: DataTypes.STRING },
    floors: { type: DataTypes.INTEGER, defaultValue: 1 }
  });

  const Quest = sequelizeInstance.define('Quest', {
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
  });

  const PlayerQuest = sequelizeInstance.define('PlayerQuest', {
    status: { type: DataTypes.STRING, defaultValue: 'not_started' },
    progress: { type: DataTypes.INTEGER, defaultValue: 0 },
    branch: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.TEXT, defaultValue: '{}' }
  });

  const Bank = sequelizeInstance.define('Bank', {
    balance: { type: DataTypes.INTEGER, defaultValue: 0 }
  });

  const Skill = sequelizeInstance.define('Skill', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    type: { type: DataTypes.STRING },
    manaCost: { type: DataTypes.INTEGER, defaultValue: 0 },
    statBonuses: { type: DataTypes.TEXT, defaultValue: '{}' }
  });

  const PlayerSkill = sequelizeInstance.define('PlayerSkill', {
    level: { type: DataTypes.INTEGER, defaultValue: 1 }
  });

  const Kingdom = sequelizeInstance.define('Kingdom', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    continent: { type: DataTypes.STRING, defaultValue: 'Aetheria' },
    status: { type: DataTypes.STRING, defaultValue: 'peace' },
    influence: { type: DataTypes.INTEGER, defaultValue: 50 },
    militaryPower: { type: DataTypes.INTEGER, defaultValue: 50 },
    leader: { type: DataTypes.STRING }
  });

  const Conflict = sequelizeInstance.define('Conflict', {
    title: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    involvedKingdoms: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: 'active' }
  });

  const School = sequelizeInstance.define('School', {
    name: { type: DataTypes.STRING, unique: true },
    specialty: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    kingdomName: { type: DataTypes.STRING }
  });

  const RPMessage = sequelizeInstance.define('RPMessage', {
    senderJid: { type: DataTypes.STRING },
    senderName: { type: DataTypes.STRING },
    content: { type: DataTypes.TEXT },
    location: { type: DataTypes.STRING },
    subLocation: { type: DataTypes.STRING, defaultValue: 'Entrée' },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  });

  const WorldJournal = sequelizeInstance.define('WorldJournal', {
    entry: { type: DataTypes.TEXT },
    importance: { type: DataTypes.INTEGER, defaultValue: 1 },
    category: { type: DataTypes.STRING, defaultValue: 'general' },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  });

  const NPC = sequelizeInstance.define('NPC', {
    name: { type: DataTypes.STRING, unique: true },
    role: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    location: { type: DataTypes.STRING },
    powerLevel: { type: DataTypes.INTEGER, defaultValue: 50 },
    specialty: { type: DataTypes.STRING },
    imageUrl: { type: DataTypes.STRING, allowNull: true }
  });

  const Entity = sequelizeInstance.define('Entity', {
    name: { type: DataTypes.STRING, unique: true },
    type: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    power: { type: DataTypes.TEXT },
    pactBonus: { type: DataTypes.TEXT }
  });

  const Pact = sequelizeInstance.define('Pact', {
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    resonance: { type: DataTypes.INTEGER, defaultValue: 10 }
  });

  const Club = sequelizeInstance.define('Club', {
    name: { type: DataTypes.STRING, unique: true },
    description: { type: DataTypes.TEXT },
    specialty: { type: DataTypes.STRING },
    leaderName: { type: DataTypes.STRING }
  });

  const PlayerClub = sequelizeInstance.define('PlayerClub', {
    rank: { type: DataTypes.STRING, defaultValue: 'Membre' }
  });

  const Duel = sequelizeInstance.define('Duel', {
    playerAJid: { type: DataTypes.STRING },
    playerBJid: { type: DataTypes.STRING },
    startTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    lastActionTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    location: { type: DataTypes.STRING }
  });

  const TournamentParticipant = sequelizeInstance.define('TournamentParticipant', {
    playerJid: { type: DataTypes.STRING, primaryKey: true },
    playerName: { type: DataTypes.STRING },
    rank: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'registered' },
    opponentJid: { type: DataTypes.STRING, allowNull: true },
    round: { type: DataTypes.INTEGER, defaultValue: 1 }
  });

  const House = sequelizeInstance.define('House', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING },
    price: { type: DataTypes.INTEGER },
    location: { type: DataTypes.STRING },
    ownerId: { type: DataTypes.STRING, allowNull: true },
    storage: { type: DataTypes.TEXT, defaultValue: '[]' },
    config: { type: DataTypes.TEXT, defaultValue: '{"theme": "moderne", "color": "blanc"}' }
  });

  const Monster = sequelizeInstance.define('Monster', {
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

  return {
    Creds, Player, Dungeon, Quest, PlayerQuest, Bank, Item, Skill, PlayerSkill, Kingdom,
    Conflict, School, RPMessage, WorldJournal, NPC, Entity, Pact, Club, PlayerClub,
    Duel, TournamentParticipant, House, Monster
  };
}

const sourceModels = defineModelsForConn(sourceSeq);
const targetModels = defineModelsForConn(targetSeq);

// Associate schemas (crucial for Sequelize validations if any)
function buildAssociations(models) {
  models.Player.hasOne(models.Bank);
  models.Bank.belongsTo(models.Player);
  models.Player.belongsToMany(models.Quest, { through: models.PlayerQuest });
  models.Quest.belongsToMany(models.Player, { through: models.PlayerQuest });
  models.Player.belongsToMany(models.Skill, { through: models.PlayerSkill });
  models.Skill.belongsToMany(models.Player, { through: models.PlayerSkill });

  models.Player.belongsToMany(models.Entity, { through: models.Pact, as: 'Entities' });
  models.Entity.belongsToMany(models.Player, { through: models.Pact, as: 'Players' });

  models.Player.belongsToMany(models.Club, { through: models.PlayerClub, as: 'Clubs' });
  models.Club.belongsToMany(models.Player, { through: models.PlayerClub, as: 'Players' });

  models.Player.hasMany(models.House, { foreignKey: 'ownerId', as: 'Houses' });
  models.House.belongsTo(models.Player, { foreignKey: 'ownerId', as: 'Owner' });
}

buildAssociations(sourceModels);
buildAssociations(targetModels);

async function startMigration() {
  try {
    console.log('[MIGRATION] Authenticating with SOURCE database...');
    await sourceSeq.authenticate();
    console.log('[MIGRATION] SOURCE database connected.');

    console.log('[MIGRATION] Authenticating with TARGET database...');
    await targetSeq.authenticate();
    console.log('[MIGRATION] TARGET database connected.');

    console.log('[MIGRATION] Synchronizing TARGET models (creating schemas)...');
    await targetSeq.sync({ force: false }); // Do not force drop existing target tables, just create if not exists
    console.log('[MIGRATION] TARGET schemas ready.');

    // We migrate table-by-table. List them in order of dependencies (independent tables first)
    const tablesToMigrate = [
      { name: 'Creds', modelKey: 'Creds' },
      { name: 'Player', modelKey: 'Player' },
      { name: 'Dungeon', modelKey: 'Dungeon' },
      { name: 'Quest', modelKey: 'Quest' },
      { name: 'Item', modelKey: 'Item' },
      { name: 'Bank', modelKey: 'Bank' },
      { name: 'Skill', modelKey: 'Skill' },
      { name: 'Kingdom', modelKey: 'Kingdom' },
      { name: 'Conflict', modelKey: 'Conflict' },
      { name: 'School', modelKey: 'School' },
      { name: 'RPMessage', modelKey: 'RPMessage' },
      { name: 'WorldJournal', modelKey: 'WorldJournal' },
      { name: 'NPC', modelKey: 'NPC' },
      { name: 'Entity', modelKey: 'Entity' },
      { name: 'Club', modelKey: 'Club' },
      { name: 'Monster', modelKey: 'Monster' },
      { name: 'Duel', modelKey: 'Duel' },
      { name: 'TournamentParticipant', modelKey: 'TournamentParticipant' },
      { name: 'House', modelKey: 'House' },
      // Junction/dependent tables
      { name: 'PlayerQuest', modelKey: 'PlayerQuest' },
      { name: 'PlayerSkill', modelKey: 'PlayerSkill' },
      { name: 'Pact', modelKey: 'Pact' },
      { name: 'PlayerClub', modelKey: 'PlayerClub' },
    ];

    console.log('\nStarting full table data migration. Let\'s begin...');

    for (const table of tablesToMigrate) {
      const srcModel = sourceModels[table.modelKey];
      const tgtModel = targetModels[table.modelKey];

      console.log(`\n[MIGRATION] Querying '${table.name}' from source...`);
      const sourceRecords = await srcModel.findAll({ raw: true });
      console.log(`[MIGRATION] Found ${sourceRecords.length} records in source for '${table.name}'.`);

      if (sourceRecords.length === 0) {
        continue;
      }

      console.log(`[MIGRATION] Truncating target table '${table.name}' to prevent duplicates...`);
      try {
        await tgtModel.destroy({ where: {}, truncate: true, cascade: true });
      } catch (err) {
        // Fallback if truncate isn't fully supported on some dialect setups
        await tgtModel.destroy({ where: {} });
      }

      console.log(`[MIGRATION] Inserting ${sourceRecords.length} records into target...`);
      // Chunk insertions for very large tables to prevent memory limit crashes
      const chunkSize = 250;
      for (let i = 0; i < sourceRecords.length; i += chunkSize) {
        const chunk = sourceRecords.slice(i, i + chunkSize);
        await tgtModel.bulkCreate(chunk, { ignoreDuplicates: true, validate: false });
      }
      console.log(`\x1b[32m[SUCCESS]\x1b[0m Migrated table '${table.name}' successfully!`);
    }

    console.log('\n\x1b[32m===================================================\x1b[0m');
    console.log('\x1b[32m[COMPLETE] DATABASE MIGRATION COMPLETED SUCCESSFULLY!\x1b[0m');
    console.log('\x1b[32m===================================================\x1b[0m');

  } catch (err) {
    console.error('\n\x1b[31m[ERROR] Migration failed:\x1b[0m', err);
    process.exit(1);
  } finally {
    await sourceSeq.close();
    await targetSeq.close();
  }
}

startMigration();
