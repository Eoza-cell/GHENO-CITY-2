const fs = require('fs');
const path = require('path');
const db = require('./database');

/**
 * Exports all database tables to a single JSON object.
 */
async function exportDatabase() {
    const data = {};
    const models = [
        'Player', 'Dungeon', 'Quest', 'PlayerQuest', 'Bank', 'Item',
        'Creds', 'Skill', 'Kingdom', 'Conflict', 'School', 'Duel',
        'NPC', 'Monster', 'PlayerSkill', 'RPMessage'
    ];

    for (const modelName of models) {
        try {
            const records = await db[modelName].findAll();
            data[modelName] = records;
            console.log(`[BACKUP] Exported ${records.length} records from ${modelName}`);
        } catch (e) {
            console.error(`[BACKUP] Error exporting ${modelName}:`, e.message);
        }
    }

    return data;
}

/**
 * Imports data from a JSON object into the database.
 * Warning: This can overwrite existing data.
 */
async function importDatabase(data) {
    if (!data || typeof data !== 'object') {
        throw new Error("Invalid data format for import.");
    }

    const models = [
        'Player', 'Dungeon', 'Quest', 'PlayerQuest', 'Bank', 'Item',
        'Creds', 'Skill', 'Kingdom', 'Conflict', 'School', 'Duel',
        'NPC', 'Monster', 'PlayerSkill', 'RPMessage'
    ];

    for (const modelName of models) {
        if (data[modelName] && Array.isArray(data[modelName])) {
            try {
                console.log(`[RESTORE] Importing ${data[modelName].length} records into ${modelName}...`);

                for (const record of data[modelName]) {
                    // Use upsert or findOrCreate based on primary keys
                    // For Player, the primary key is whatsappId
                    if (modelName === 'Player') {
                        await db.Player.upsert(record);
                    } else if (modelName === 'Creds') {
                        await db.Creds.upsert(record);
                    } else if (modelName === 'Quest') {
                        await db.Quest.upsert(record);
                    } else if (modelName === 'Item') {
                        await db.Item.upsert(record);
                    } else if (modelName === 'Skill') {
                        await db.Skill.upsert(record);
                    } else if (modelName === 'Kingdom') {
                        await db.Kingdom.upsert(record);
                    } else if (modelName === 'NPC') {
                        await db.NPC.upsert(record);
                    } else if (modelName === 'Monster') {
                        await db.Monster.upsert(record);
                    } else if (modelName === 'Dungeon') {
                        await db.Dungeon.upsert(record);
                    } else {
                        // For others, we might just try to create or find a way to match
                        // This is a simplified restore
                        await db[modelName].create(record).catch(err => {
                            // Ignore duplicates for simple many-to-many or history tables
                        });
                    }
                }
            } catch (e) {
                console.error(`[RESTORE] Error importing ${modelName}:`, e.message);
            }
        }
    }
}

module.exports = { exportDatabase, importDatabase };
