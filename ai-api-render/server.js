require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const LLAMA_SERVER_PORT = 8080;
const MODEL_URL = process.env.MODEL_URL || 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';
const MODEL_PATH = path.join(__dirname, 'models', 'model.gguf');

let llamaProcess = null;
let isDownloading = false;
let isLlamaReady = false;

// Fonction pour télécharger le modèle si absent
async function downloadModel() {
    if (fs.existsSync(MODEL_PATH)) {
        console.log('[AI-SERVER] Modèle déjà présent.');
        return;
    }

    isDownloading = true;
    console.log('[AI-SERVER] Téléchargement du modèle...');
    const writer = fs.createWriteStream(MODEL_PATH);

    try {
        const response = await axios({
            url: MODEL_URL,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                isDownloading = false;
                console.log('[AI-SERVER] Téléchargement terminé.');
                resolve();
            });
            writer.on('error', (err) => {
                isDownloading = false;
                reject(err);
            });
        });
    } catch (err) {
        isDownloading = false;
        throw err;
    }
}

// Lancement de llama-server (binaire généré par le Dockerfile)
function startLlamaServer() {
    if (!fs.existsSync(MODEL_PATH)) {
        console.error('[AI-SERVER] Impossible de démarrer : Modèle manquant.');
        return;
    }

    console.log('[AI-SERVER] Démarrage de llama-server...');

    // Arguments optimisés pour la RAM
    llamaProcess = spawn('./llama-server', [
        '-m', MODEL_PATH,
        '--port', LLAMA_SERVER_PORT.toString(),
        '-c', '1024', // Contexte réduit pour économiser la RAM
        '--threads', '2', // Render Free a généralement 2 vCPUs
    ]);

    llamaProcess.stdout.on('data', (data) => {
        const msg = data.toString();
        console.log(`[LLAMA] ${msg}`);
        if (msg.includes('HTTP server listening')) {
            isLlamaReady = true;
            console.log('[AI-SERVER] llama-server est PRÊT.');
        }
    });

    llamaProcess.stderr.on('data', (data) => {
        console.error(`[LLAMA-ERR] ${data}`);
    });

    llamaProcess.on('close', (code) => {
        isLlamaReady = false;
        console.log(`[AI-SERVER] llama-server arrêté avec le code ${code}`);
        // Redémarrer après un délai si crashé
        setTimeout(startLlamaServer, 5000);
    });
}

// Route de génération
app.post('/generate', async (req, res) => {
    if (!isLlamaReady) {
        return res.status(503).json({
            error: 'Serveur IA en cours de démarrage ou téléchargement du modèle.',
            downloading: isDownloading
        });
    }

    const { prompt, max_tokens = 300, temperature = 0.7 } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt manquant' });
    }

    try {
        const response = await axios.post(`http://localhost:${LLAMA_SERVER_PORT}/completion`, {
            prompt: prompt,
            n_predict: max_tokens,
            temperature: temperature,
            stop: ["<|im_end|>", "<|endoftext|>", "###"]
        }, { timeout: 90000 });

        res.json({
            response: response.data.content.trim()
        });
    } catch (error) {
        console.error('[AI-SERVER] Erreur de génération:', error.message);
        res.status(500).json({
            error: 'Erreur lors de la génération',
            details: error.message
        });
    }
});

// Route de santé (utilisée par Render)
app.get('/health', (req, res) => {
    res.json({
        status: isLlamaReady ? 'ready' : 'initializing',
        downloading: isDownloading,
        model_present: fs.existsSync(MODEL_PATH)
    });
});

// On démarre le serveur Express IMMEDIATEMENT pour éviter le timeout Render
app.listen(PORT, async () => {
    console.log(`[AI-SERVER] API Express écoute sur le port ${PORT}`);

    try {
        await downloadModel();
        startLlamaServer();
    } catch (err) {
        console.error('[AI-SERVER] Échec de l\'initialisation du modèle:', err);
    }
});
