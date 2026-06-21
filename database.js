const { Sequelize, DataTypes } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      logging: false,
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: 'gheno-city.sqlite',
      logging: false,
    });

const Player = sequelize.define('Player', {
  whatsappId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  characterName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  registrationStep: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  skill: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  xp: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  money: {
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
});

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');

    try {
        await sequelize.sync({ alter: true });
    } catch (syncError) {
        if (syncError.message.includes('cannot be cast automatically') || syncError.name === 'SequelizeDatabaseError') {
            console.log('Casting error detected. Attempting manual fix for "registrationStep"...');
            try {
                // If it's Postgres, try to force the type change
                await sequelize.query('ALTER TABLE "Players" ALTER COLUMN "registrationStep" TYPE DOUBLE PRECISION USING "registrationStep"::double precision;');
                console.log('Manual fix applied. Retrying sync...');
                await sequelize.sync({ alter: true });
            } catch (manualError) {
                console.error('Manual fix failed. If this is a new deploy, you might need to drop the table manually.', manualError.message);
                // Last ditch effort for new installs: just sync without alter if tables don't exist
                await sequelize.sync();
            }
        } else {
            throw syncError;
        }
    }

    console.log('Database synchronized.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error; // Re-throw to block startup if DB is down
  }
}

module.exports = {
  sequelize,
  Player,
  setupDatabase,
};
