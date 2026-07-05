require('dotenv').config();
const { Creds, setupDatabase, sequelize } = require('./database');

async function resetAuth() {
    console.log('--- RÉINITIALISATION DE LA SESSION WHATSAPP ---');
    try {
        await setupDatabase();
        const count = await Creds.count();
        console.log(`Données de session trouvées : ${count} entrées.`);

        await Creds.destroy({ where: {} });
        console.log('✅ Toutes les données de session ont été supprimées de la base de données.');
        console.log('⚠️ Les données des joueurs (noms, niveaux, progression) sont INTACTES.');
        console.log('\nVous pouvez maintenant redémarrer le bot pour obtenir un nouveau code de pairage.');
    } catch (error) {
        console.error('Erreur lors de la réinitialisation :', error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

resetAuth();
