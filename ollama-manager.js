const { exec, spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

/**
 * Manages the Ollama process for GHENO CITY 2.
 */
class OllamaManager {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.process = null;
        this.pullingModels = new Set();
    }

    /**
     * Checks if Ollama is already running.
     */
    async isRunning() {
        try {
            await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 2000 });
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Pulls the specified model.
     */
    async pullModel(modelName) {
        if (this.pullingModels.has(modelName)) return;
        this.pullingModels.add(modelName);

        console.log(`[OLLAMA] 📥 Téléchargement du modèle ${modelName}...`);
        try {
            await new Promise((resolve, reject) => {
                const pull = spawn('ollama', ['pull', modelName]);

                pull.stdout.on('data', (data) => {
                    // Extract percentage if possible
                    const str = data.toString();
                    process.stdout.write(`[OLLAMA PULL] ${str}`);
                });

                pull.stderr.on('data', (data) => {
                    process.stderr.write(`[OLLAMA PULL ERR] ${data.toString()}`);
                });

                pull.on('close', (code) => {
                    this.pullingModels.delete(modelName);
                    if (code === 0) resolve();
                    else reject(new Error(`Ollama pull failed with code ${code}`));
                });
            });
            console.log(`[OLLAMA] ✅ Modèle ${modelName} prêt.`);
            return true;
        } catch (err) {
            this.pullingModels.delete(modelName);
            console.error(`[OLLAMA] ❌ Échec du téléchargement du modèle: ${err.message}`);
            return false;
        }
    }

    /**
     * Checks if a model is currently being pulled.
     */
    isPulling(modelName) {
        return this.pullingModels.has(modelName);
    }

    /**
     * Attempts to install Ollama if on Linux.
     */
    async tryInstall() {
        if (process.platform !== 'linux') {
            return false;
        }

        console.log('[OLLAMA] 🛠️ Tentative d\'installation automatique sur Linux...');
        try {
            await new Promise((resolve, reject) => {
                exec('curl -fsSL https://ollama.com/install.sh | sh', (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[OLLAMA] ❌ Échec de l'installation: ${stderr || error.message}`);
                        reject(error);
                    } else {
                        console.log('[OLLAMA] ✅ Installation terminée.');
                        resolve(stdout);
                    }
                });
            });
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Starts Ollama serve automatically.
     */
    async ensureStarted() {
        console.log('[OLLAMA] 🔍 Vérification du statut d\'Ollama...');

        if (await this.isRunning()) {
            console.log('[OLLAMA] ✅ Ollama est déjà en cours d\'exécution.');
            return true;
        }

        console.log('[OLLAMA] 🚀 Tentative de démarrage de "ollama serve"...');

        try {
            // Check if ollama is installed
            let installed = await new Promise((resolve) => {
                exec('ollama --version', (error) => {
                    resolve(!error);
                });
            });

            if (!installed) {
                const success = await this.tryInstall();
                if (!success) {
                    throw new Error('Ollama n\'est pas installé et l\'installation automatique a échoué.');
                }
            }

            // Start ollama serve in the background
            const ollamaProcess = spawn('ollama', ['serve'], {
                detached: true,
                stdio: 'ignore'
            });

            ollamaProcess.unref();
            this.process = ollamaProcess;

            // Wait for Ollama to be ready (max 30 seconds)
            console.log('[OLLAMA] ⏳ Attente du démarrage (max 30s)...');
            for (let i = 0; i < 30; i++) {
                if (await this.isRunning()) {
                    console.log('[OLLAMA] ✅ Ollama a démarré avec succès.');
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.error('[OLLAMA] ❌ Ollama n\'a pas pu démarrer après 30 secondes.');
            return false;
        } catch (err) {
            console.error(`[OLLAMA] ❌ Erreur lors du démarrage: ${err.message}`);
            return false;
        }
    }
}

module.exports = new OllamaManager();
