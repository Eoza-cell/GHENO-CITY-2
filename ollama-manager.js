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
            await new Promise((resolve, reject) => {
                exec('ollama --version', (error) => {
                    if (error) reject(new Error('Ollama n\'est pas installé.'));
                    else resolve();
                });
            });

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
