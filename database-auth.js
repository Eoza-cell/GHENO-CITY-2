const { Creds } = require('./database');
const { proto } = require('@whiskeysockets/baileys');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

/**
 * A database-backed authentication handler for Baileys.
 * This function replaces `useMultiFileAuthState` to ensure session
 * persistence on platforms with ephemeral file systems.
 *
 * @returns {Promise<{state: {creds: any, keys: {}}, saveCreds: () => Promise<void>}>}
 */
const useDatabaseAuth = async () => {
    let creds;
    let keys = {};

    // Helper function to read a file from the database
    const readData = async (key) => {
        try {
            const data = await Creds.findOne({ where: { key } });
            // The data is stored as a string, so we need to parse it
            return data ? JSON.parse(data.value, BufferJSON.reviver) : null;
        } catch (error) {
            console.error(`Failed to read key "${key}" from database`, error);
            return null;
        }
    };

    // Helper function to write data to the database
    const writeData = async (key, data) => {
        try {
            const value = JSON.stringify(data, BufferJSON.replacer);
            await Creds.upsert({ key, value });
        } catch (error) {
            console.error(`Failed to write key "${key}" to database`, error);
        }
    };

    // Helper function to remove data from the database
    const removeData = async (key) => {
        try {
            await Creds.destroy({ where: { key } });
        } catch (error) {
            console.error(`Failed to remove key "${key}" from database`, error);
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
                            if (type === 'app-state-sync-key') {
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
