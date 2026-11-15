const { Creds } = require('./database');
const { Op } = require('sequelize');
const { proto, BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

const useDatabaseAuth = async () => {
    let queue = Promise.resolve();
    const enqueue = (fn) => {
        const run = queue.catch(() => {}).then(fn);
        queue = run;
        return run;
    };
    const parse = (raw) => (raw ? JSON.parse(raw, BufferJSON.reviver) : null);
    const stringify = (data) => JSON.stringify(data, BufferJSON.replacer);
    const readOne = async (key) => {
        const row = await Creds.findOne({ where: { key } });
        return row && row.value ? parse(row.value) : null;
    };

    let creds = await readOne('creds');
    if (!creds) creds = initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    if (!ids.length) return data;
                    const keyNames = ids.map((id) => `${type}-${id}`);
                    const rows = await Creds.findAll({ where: { key: { [Op.in]: keyNames } } });
                    const byKey = new Map(rows.map((row) => [row.key, row.value]));
                    for (const id of ids) {
                        let value = null;
                        try { value = parse(byKey.get(`${type}-${id}`)); }
                        catch (error) { console.error(`[AUTH-DB] Clé corrompue ${type}-${id}, ignorée:`, error.message); }
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    const toUpsert = [];
                    const toDelete = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) toUpsert.push({ key, value: stringify(value) });
                            else toDelete.push(key);
                        }
                    }
                    await enqueue(async () => {
                        for (let i = 0; i < toUpsert.length; i += 200) {
                            await Creds.bulkCreate(toUpsert.slice(i, i + 200), { updateOnDuplicate: ['value'] });
                        }
                        for (let i = 0; i < toDelete.length; i += 200) {
                            await Creds.destroy({ where: { key: { [Op.in]: toDelete.slice(i, i + 200) } } });
                        }
                    });
                },
            },
        },
        saveCreds: () => enqueue(() => Creds.upsert({ key: 'creds', value: stringify(creds) })),
        clearSession: () => enqueue(() => Creds.destroy({ where: {} })),
    };
};

module.exports = { useDatabaseAuth };
