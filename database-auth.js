const { Creds } = require('./database');
const { proto } = require('@whiskeysockets/baileys');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

/**
 * A MongoDB-backed authentication handler for Baileys.
 *
 * @returns {Promise<{state: {creds: any, keys: {}}, saveCreds: () => Promise<void>}>}
 */
const useDatabaseAuth = async () => {
    let creds;

    // Helper function to read data from MongoDB
    const readData = async (key) => {
        try {
            const data = await Creds.findOne({ where: { key } });
            return data ? JSON.parse(data.value, BufferJSON.reviver) : null;
        } catch (error) {
            console.error(`[MONGO-AUTH] Failed to read key "${key}"`, error.message);
            return null;
        }
    };

    // Helper function to write data to MongoDB
    const writeData = async (key, data) => {
        try {
            const value = JSON.stringify(data, BufferJSON.replacer);
            const existing = await Creds.findOne({ where: { key } });
            if (existing) {
                await existing.update({ value });
            } else {
                await Creds.create({ key, value });
            }
        } catch (error) {
            console.error(`[MONGO-AUTH] Failed to write key "${key}"`, error.message);
        }
    };

    // Helper function to remove data from MongoDB
    const removeData = async (key) => {
        try {
            const existing = await Creds.findOne({ where: { key } });
            if (existing) {
                // In MongoDB we can just delete
                await existing.deleteOne();
            }
        } catch (error) {
            console.error(`[MONGO-AUTH] Failed to remove key "${key}"`, error.message);
        }
    };

    creds = await readData('creds') || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(key, value) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: () => {
            return writeData('creds', creds);
        },
    };
};

module.exports = { useDatabaseAuth };
