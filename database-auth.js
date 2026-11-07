const { Creds } = require('./database');
const { proto, BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

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
    // Baileys peut émettre plusieurs creds.update presque simultanément.
    // Sérialiser les écritures évite qu'un ancien snapshot écrase le plus récent.
    let persistenceQueue = Promise.resolve();

    // Helper function to read a file from the database
    const readData = async (key) => {
        try {
            const data = await Creds.findOne({ where: { key } });
            // The data is stored as a string, so we need to parse it
            if (!data || !data.value) return null;
            return JSON.parse(data.value, BufferJSON.reviver);
        } catch (error) {
            console.error(`[AUTH-DB] Lecture impossible pour "${key}"`, error);
            throw error;
        }
    };

    // Helper function to write data to the database
    const writeData = async (key, data) => {
        try {
            const value = JSON.stringify(data, BufferJSON.replacer);
            persistenceQueue = persistenceQueue.catch(() => {}).then(() => Creds.upsert({ key, value }));
            return persistenceQueue;
        } catch (error) {
            console.error(`[AUTH-DB] Écriture impossible pour "${key}"`, error);
            throw error;
        }
    };

    // Helper function to remove data from the database
    const removeData = async (key) => {
        try {
            persistenceQueue = persistenceQueue.catch(() => {}).then(() => Creds.destroy({ where: { key } }));
            return persistenceQueue;
        } catch (error) {
            console.error(`[AUTH-DB] Suppression impossible pour "${key}"`, error);
            throw error;
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
