#!/usr/bin/env node
/**
 * Script de configuration automatique pour GHENO CITY 2
 * Vérifie l'environnement et guide l'utilisateur
 */

const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise(resolve => rl.question(prompt, resolve));
}

async function checkNodeVersion() {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    if (major < 18) {
        console.error(`❌ Node.js ${version} détecté. Version 18+ requise.`);
        process.exit(1);
    }
    console.log(`✅ Node.js ${version}`);
}

async function checkOllama() {
    try {
        const result = execSync('which ollama', { encoding: 'utf8' });
        console.log(`✅ Ollama installé: ${result.trim()}`);
        return true;
    } catch {
        console.log('❌ Ollama non installé.');
        console.log('   Installez depuis: https://ollama.com');
        console.log('   Linux/Mac: curl -fsSL https://ollama.com/install.sh | sh');
        return false;
    }
}

async function checkGemmaModel() {
    try {
        const result = execSync('ollama list', { encoding: 'utf8' });
        if (result.includes('gemma')) {
            const lines = result.split('\n').filter(l => l.includes('gemma'));
            console.log(`✅ Modèle Gemma détecté:`);
            lines.forEach(l => console.log(`   ${l.trim()}`));
            return true;
        } else {
            console.log('❌ Modèle Gemma non trouvé.');
            console.log('   Exécutez: ollama pull gemma4:31b');
            return false;
        }
    } catch {
        console.log('❌ Impossible de vérifier les modèles Ollama.');
        return false;
    }
}

async function checkEnvFile() {
    if (fs.existsSync('.env')) {
        console.log('✅ Fichier .env trouvé');
        const content = fs.readFileSync('.env', 'utf8');
        if (content.includes('PHONE_NUMBER=') && !content.includes('votre_numero')) {
            const match = content.match(/PHONE_NUMBER=(\d+)/);
            if (match) {
                console.log(`   Numéro configuré: ${match[1]}`);
                return true;
            }
        }
    }
    console.log('❌ Fichier .env manquant ou incomplet.');
    return false;
}

async function setupEnv() {
    console.log('\n📝 Configuration du fichier .env');

    const phoneNumber = await question('Entrez votre numéro WhatsApp (avec indicatif pays, ex: 33612345678): ');

    let envContent = fs.readFileSync('.env.example', 'utf8');
    envContent = envContent.replace('PHONE_NUMBER=votre_numéro_de_téléphone_ici', `PHONE_NUMBER=${phoneNumber}`);

    // Proposer le choix du modèle
    console.log('\nChoisissez votre modèle local (via Ollama):');
    console.log('--- QWEN 2.5 (Alibaba) - Recommandé pour la rapidité ---');
    console.log('  1. qwen2.5:1.5b (Ultra-léger)');
    console.log('  2. qwen2.5:3b   (Recommandé - Équilibré)');
    console.log('  3. qwen2.5:7b   (Puissant)');
    console.log('--- GEMMA 4 (Google) - Créativité & Raisonnement ---');
    console.log('  4. gemma4:31b   (Recommandé - Frontier/Lourd)');
    console.log('  5. gemma4:12b   (Gemma 4 - Puissant)');
    console.log('  6. gemma4:e4b   (Gemma 4 Edge - Rapide)');
    console.log('  7. gemma3:4b    (Gemma 3 - Équilibré)');

    console.log('--- HUGGING FACE (Direct) ---');
    console.log('  8. Qwen 2.5 3B GGUF (via HF)');

    const choice = await question('Votre choix (1-8, défaut: 4): ') || '4';
    const models = {
        '1': 'qwen2.5:1.5b', '2': 'qwen2.5:3b', '3': 'qwen2.5:7b',
        '4': 'gemma4:31b', '5': 'gemma4:12b', '6': 'gemma4:e4b', '7': 'gemma3:4b',
        '8': 'qwen2.5-3b-gguf'
    };
    const model = models[choice] || 'gemma4:31b';

    envContent += `\nAI_PROVIDER=local\nLOCAL_API=http://127.0.0.1:11434\nMODEL=${model}\nOLLAMA_MODEL=${model}\nOLLAMA_URL=http://localhost:11434`;

    fs.writeFileSync('.env', envContent);
    console.log(`✅ Fichier .env créé avec le modèle ${model}`);
}

async function main() {
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║  GHENO CITY 2 - Configuration IA Locale           ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    // Vérifications
    await checkNodeVersion();

    const ollamaOk = await checkOllama();
    if (!ollamaOk) {
        const install = await question('\nVoulez-vous continuer sans Ollama ? (les APIs cloud seront utilisées) [y/N]: ');
        if (install.toLowerCase() !== 'y') {
            console.log('\nInstallez Ollama puis relancez: npm run setup');
            process.exit(0);
        }
    }

    const envOk = await checkEnvFile();
    if (!envOk) {
        await setupEnv();
    }

    const envContentFinal = fs.readFileSync('.env', 'utf8');
    const modelMatch = envContentFinal.match(/OLLAMA_MODEL=([^\n]+)/);
    const selectedModel = modelMatch ? modelMatch[1] : 'gemma4:31b';

    if (selectedModel.includes('gguf')) {
        const hf = require('./hf-downloader');
        console.log(`\n📥 Téléchargement de ${selectedModel} via Hugging Face...`);
        try {
            await hf.downloadFromHF("Qwen/Qwen2.5-3B-Instruct-GGUF", "qwen2.5-3b-instruct-q4_k_m.gguf");
            console.log("✅ Modèle GGUF téléchargé dans ./models/");
        } catch (e) {
            console.log("❌ Échec HF:", e.message);
        }
    } else if (ollamaOk) {
        const modelsList = execSync('ollama list', { encoding: 'utf8' });
        if (!modelsList.includes(selectedModel.split(':')[0])) {
            const install = await question(`\nVoulez-vous télécharger ${selectedModel} maintenant ? [Y/n]: `);
            if (install.toLowerCase() !== 'n') {
                console.log(`\n📥 Téléchargement de ${selectedModel}...`);
                try {
                    execSync(`ollama pull ${selectedModel}`, { stdio: 'inherit' });
                    console.log(`✅ ${selectedModel} installé !`);
                } catch {
                    console.log('❌ Échec du téléchargement.');
                }
            }
        } else {
            console.log(`✅ Modèle ${selectedModel} déjà présent.`);
        }
    }

    // Vérifier les dépendances
    console.log('\n📦 Vérification des dépendances...');
    if (!fs.existsSync('node_modules')) {
        console.log('Installation des dépendances...');
        try {
            execSync('npm install', { stdio: 'inherit' });
            console.log('✅ Dépendances installées');
        } catch {
            console.log('❌ Échec de l\'installation.');
            process.exit(1);
        }
    } else {
        console.log('✅ Dépendances déjà installées');
    }

    // Créer les dossiers nécessaires
    const dirs = ['assets/locations', 'assets/monsters', 'assets/profiles'];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Dossier créé: ${dir}`);
        }
    }

    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║  ✅ Configuration terminée !                      ║');
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log('║  Pour démarrer:                                   ║');
    console.log('║    npm start    (Bot + Serveur IA Locale)         ║');
    console.log('║    npm run dev  (Mode développement)              ║');
    console.log('╚═══════════════════════════════════════════════════╝');

    rl.close();
}

main().catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
});
