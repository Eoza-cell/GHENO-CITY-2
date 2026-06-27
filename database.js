const { Sequelize, DataTypes } = require('sequelize');
const { execSync } = require('child_process');

let sequelize;
const dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
  console.log('[DB] Vérification de la connexion PostgreSQL...');
  try {
    execSync(`node -e "const { Sequelize } = require('sequelize'); const s = new Sequelize(process.env.DB_URL, { dialect: 'postgres', logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } }); s.authenticate().then(() => process.exit(0)).catch((e) => { process.exit(1); })"`, {
      env: { ...process.env, DB_URL: dbUrl },
      timeout: 10000,
      stdio: 'ignore'
    });
    console.log('[DB] PostgreSQL est accessible. Connexion en cours...');
    sequelize = new Sequelize(dbUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });
  } catch (e) {
    console.error('[DB] PostgreSQL inaccessible. Basculement sur SQLite local.');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: 'game-bot.sqlite',
      logging: false,
    });
  }
} else {
  console.log('[DB] Pas de DATABASE_URL. Utilisation de SQLite local.');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'game-bot.sqlite',
    logging: false,
  });
}

const Creds = sequelize.define('Creds', {
  key: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  value: {
    type: DataTypes.TEXT,
  },
});

const Player = sequelize.define('Player', {
  whatsappId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    defaultValue: 'Joueur',
  },
  points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
  }
});

const GameScore = sequelize.define('GameScore', {
    playerWhatsappId: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    gameType: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    score: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    }
});

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connection established.');
    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

module.exports = {
  sequelize,
  Player,
  GameScore,
  Creds,
  setupDatabase,
};
