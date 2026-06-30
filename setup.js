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
    const orKey = await question('Entrez votre clé API OpenRouter (Optionnel): ');

    let envContent = fs.readFileSync('.env.example', 'utf8');
    envContent = envContent.replace('PHONE_NUMBER=votre_numéro_ici', `PHONE_NUMBER=${phoneNumber}`);
    envContent = envContent.replace('OPENROUTER_API_KEY=', `OPENROUTER_API_KEY=${orKey}`);

    fs.writeFileSync('.env', envContent);
    console.log(`✅ Fichier .env créé.`);
}

async function main() {
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║  GHENO CITY 2 - Configuration                     ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    // Vérifications
    await checkNodeVersion();

    const envOk = await checkEnvFile();
    if (!envOk) {
        await setupEnv();
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
