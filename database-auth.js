const { Creds } = require('./database');
const { proto } = require('@whiskeysockets/baileys');
const { Sequelize } = require('sequelize');

// Helper function to convert Buffer to JSON-compatible format and back
const BufferJSON = {
  replacer: (key, value) => {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array || value?.type === 'Buffer') {
      return {
        type: 'Buffer',
        data: Buffer.from(value?.data || value).toString('base64'),
      };
    }
    return value;
  },
  reviver: (key, value) => {
    if (typeof value === 'object' && value !== null && value.type === 'Buffer' && typeof value.data === 'string') {
      return Buffer.from(value.data, 'base64');
    }
    return value;
  },
};

const useDatabaseAuthState = async () => {
  // Read and deserialize credentials from the database
  const readData = async (key) => {
    try {
      const record = await Creds.findOne({ where: { key } });
      if (record) {
        return JSON.parse(record.value, BufferJSON.reviver);
      }
      return null;
    } catch (error) {
      console.error(`Failed to read auth data for key ${key}:`, error);
      return null;
    }
  };

  // Serialize and write credentials to the database
  const writeData = async (data, key) => {
    try {
      const jsonData = JSON.stringify(data, BufferJSON.replacer);
      await Creds.findOrCreate({ where: { key }, defaults: { value: jsonData } })
        .then(([record, created]) => {
          if (!created) {
            return record.update({ value: jsonData });
          }
        });
    } catch (error) {
      console.error(`Failed to write auth data for key ${key}:`, error);
    }
  };

  // Remove credentials from the database
  const removeData = async (key) => {
    try {
      await Creds.destroy({ where: { key } });
    } catch (error) {
      console.error(`Failed to remove auth data for key ${key}:`, error);
    }
  };

  const creds = (await readData('creds')) || {
    ...proto.Message.fromObject({}),
    noiseKey: {},
    signedIdentityKey: {},
    signedPreKey: {},
    registrationId: 0,
    advSecretKey: '',
    nextPreKeyId: 0,
    firstUnuploadedPreKeyId: 0,
    accountSettings: {
      unarchiveChats: false,
    },
  };

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
                value = proto.AppStateSyncKeyData.fromObject(value);
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
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => {
      return writeData(creds, 'creds');
    },
  };
};

module.exports = { useDatabaseAuthState };
