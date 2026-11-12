if (require.main === module) {
  setupDatabase()
    .then(async () => {
      console.log('[CORE] Base de données prête. Lancement prioritaire de WhatsApp...');

      // La connexion Baileys ne doit pas attendre les tâches secondaires.
      startModelServer();
      connectToWhatsApp();

      // Ces tâches sont secondaires : elles tournent en arrière-plan.
      prepareAetherysVisualPack()
        .then(() => console.log('[VISUAL] Pack visuel Aetheris prêt.'))
        .catch(err => console.error('[VISUAL] Préparation du pack visuel échouée:', err));

      require('./world-engine').initializeWorld()
        .then(() => console.log('[WORLD] Monde vivant initialisé en arrière-plan.'))
        .catch(err => console.error('[WORLD] Initialisation du monde vivant échouée:', err));
    })
    .catch(err => {
      console.error('[CRITICAL] Échec du démarrage de la base de données:', err);
      process.exit(1);
    });
}