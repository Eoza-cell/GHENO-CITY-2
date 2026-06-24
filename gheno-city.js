const { default: makeWASocket, delay, DisconnectReason, proto, BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { setupDatabase, Auth } = require('./database');
const { handleCommand } = require('./command-handler');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let sock;
global.pairingCode = null;
global.isConnected = false;
global.connectionError = null;
global.logs = [];

function addLog(msg) {
    const timestamp = new Date().toLocaleTimeString();
    global.logs.push(`[${timestamp}] ${msg}`);
    if (global.logs.length > 50) global.logs.shift();
    console.log(`[${timestamp}] ${msg}`);
}

async function useDatabaseAuthState() {
    const readData = async (id) => {
        try {
            const auth = await Auth.findByPk(id);
            if (!auth) return null;
            return JSON.parse(auth.value, BufferJSON.reviver);
        } catch (error) {
            return null;
        }
    };

    const writeData = async (data, id) => {
        const value = JSON.stringify(data, BufferJSON.replacer);
        await Auth.upsert({ id, value });
    };

    const removeData = async (id) => {
        await Auth.destroy({ where: { id } });
    };

    const creds = await readData('creds') || initAuthCreds();

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
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
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
                            const sId = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, sId));
                            } else {
                                tasks.push(removeData(sId));
                            }
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: () => writeData(creds, 'creds'),
    };
}

function connectToWhatsApp() {
  return new Promise(async (resolve, reject) => {
    try {
        await setupDatabase();
    } catch (dbError) {
        return reject(dbError);
    }

    const { state, saveCreds } = await useDatabaseAuthState();

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Auto-pairing if BOT_NUMBER is set and no session exists
    if (process.env.BOT_NUMBER && !state.creds.registered) {
        const number = process.env.BOT_NUMBER.replace(/\D/g, '');
        addLog(`****************************************************`);
        addLog(`AUTO-PAIRING POUR: ${number}`);
        addLog(`Génération du code de jumelage en cours...`);
        addLog(`****************************************************`);

        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(number);
                global.pairingCode = code;
                addLog(`\n\n>>> VOTRE CODE DE JUMELAGE EST : ${code} <<<\n\n`);
                addLog(`Entrez ce code sur votre téléphone WhatsApp pour finaliser le déploiement.`);
            } catch (e) {
                addLog(`Erreur auto-pairing: ${e.message}`);
            }
        }, 3000);
    } else if (state.creds.registered) {
        addLog("Session existante trouvée. Connexion automatique...");
    }

    // If no BOT_NUMBER is set, we resolve immediately so the web server can start
    // and the user can enter the number manually.
    if (!process.env.BOT_NUMBER || state.creds.registered) {
        resolve(sock);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) addLog("QR Code disponible (ignoré pour pairing code)");

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            addLog(`Connexion fermée (Code: ${statusCode}). Reconnexion: ${shouldReconnect}`);
            global.isConnected = false;

            if (shouldReconnect) {
                // If we were waiting for connection (BOT_NUMBER path), we don't re-resolve
                if (process.env.BOT_NUMBER && !state.creds.registered) {
                    connectToWhatsApp();
                } else {
                    connectToWhatsApp().then(resolve).catch(reject);
                }
            } else {
                addLog("Déconnecté par l'utilisateur ou session expirée. Suppression des identifiants...");
                try {
                    await Auth.destroy({ where: {} });
                    addLog("Session réinitialisée.");
                    connectToWhatsApp().then(resolve).catch(reject);
                } catch (e) {
                    addLog("Erreur lors de la réinitialisation: " + e.message);
                }
            }
        } else if (connection === 'open') {
            addLog('Connecté à WhatsApp !');
            global.isConnected = true;
            global.pairingCode = null;
            global.connectionError = null;
            // This resolves for the case where we were blocking startup (BOT_NUMBER path)
            resolve(sock);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        m.messages.forEach(async (message) => {
            if (!message.message || message.key.fromMe) return;
            handleCommand(sock, message);
        });
    });
  });
}

// Web Interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Throne of Epsylion - Inscription</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=MedievalSharp&display=swap');

            body {
                font-family: 'MedievalSharp', cursive;
                background-color: #0d0d0d;
                color: #e0d0b0;
                display: flex;
                height: 100vh;
                margin: 0;
                overflow: hidden;
            }

            .banner {
                width: 250px;
                height: 100%;
                background-image: linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('https://images.unsplash.com/photo-1599707367072-cd6adb2bc3ad?q=80&w=1000&auto=format&fit=crop');
                background-size: cover;
                background-position: center;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                border-right: 3px solid #f39c12;
                box-shadow: 5px 0 15px rgba(0,0,0,0.8);
                z-index: 10;
            }

            .banner h1 {
                writing-mode: vertical-rl;
                text-orientation: mixed;
                font-family: 'Cinzel', serif;
                font-size: 3rem;
                color: #f39c12;
                text-transform: uppercase;
                letter-spacing: 10px;
                margin: 0;
                text-shadow: 2px 2px 5px black;
                transform: rotate(180deg);
            }

            .main-content {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 2rem;
                background: radial-gradient(circle, #1a1a1a 0%, #0d0d0d 100%);
                position: relative;
                overflow-y: auto;
            }

            .container {
                background-color: rgba(42, 42, 42, 0.9);
                padding: 2rem;
                border-radius: 4px;
                border: 1px solid #f39c12;
                box-shadow: 0 0 25px rgba(243, 156, 18, 0.2);
                text-align: center;
                max-width: 500px;
                width: 100%;
                margin-bottom: 2rem;
            }

            .logs-container {
                max-width: 800px;
                width: 100%;
                background: #111;
                border: 1px solid #444;
                padding: 1rem;
                font-family: monospace;
                font-size: 0.8rem;
                height: 150px;
                overflow-y: scroll;
                color: #888;
                text-align: left;
            }

            h2 { color: #f39c12; font-family: 'Cinzel', serif; font-size: 1.8rem; margin-top: 0; }
            p { margin-bottom: 1.5rem; line-height: 1.6; }

            input {
                width: 100%;
                padding: 12px;
                margin-bottom: 1.5rem;
                background: #111;
                border: 1px solid #444;
                border-radius: 2px;
                color: #fff;
                box-sizing: border-box;
                font-family: inherit;
            }

            input:focus { border-color: #f39c12; outline: none; }

            button {
                background: linear-gradient(to bottom, #f39c12, #d35400);
                color: #000;
                border: none;
                padding: 12px 20px;
                border-radius: 2px;
                cursor: pointer;
                font-weight: bold;
                width: 100%;
                font-family: 'Cinzel', serif;
                text-transform: uppercase;
                margin-bottom: 1rem;
            }

            button.secondary {
                background: #444;
                color: #ccc;
            }

            .pairing-code-box {
                font-size: 2.5rem;
                letter-spacing: 5px;
                color: #f39c12;
                background: #000;
                padding: 20px;
                border: 2px dashed #f39c12;
                margin: 20px 0;
                font-family: monospace;
                transition: transform 0.2s;
            }
            .pairing-code-box:active {
                transform: scale(0.95);
            }

            .status-badge {
                padding: 5px 15px;
                border-radius: 20px;
                font-size: 0.8rem;
                margin-bottom: 1rem;
                display: inline-block;
            }
            .status-offline { background: #c0392b; color: #fff; }
            .status-online { background: #27ae60; color: #fff; }

            .error-msg { color: #e74c3c; margin-bottom: 1rem; font-size: 0.9rem; }
        </style>
    </head>
    <body>
        <div class="banner">
            <h1>Throne of Epsylon</h1>
        </div>

        <div class="main-content">
            <div class="container">
                <div class="status-badge ${global.isConnected ? 'status-online' : 'status-offline'}">
                    ${global.isConnected ? 'Bot en ligne' : 'Bot hors-ligne'}
                </div>

                <h2>Bienvenue Voyageur</h2>

                ${global.connectionError ? `<div class="error-msg">${global.connectionError}</div>` : ''}

                ${global.isConnected ? `
                    <p>Le bot est connecté et prêt à l'action.</p>
                    <div style="text-align: left; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; margin-bottom: 20px;">
                        <p style="margin: 0; font-size: 0.9rem; color: #f39c12;">🎯 <strong>Actions Rapides :</strong></p>
                        <ul style="font-size: 0.85rem; padding-left: 20px; margin: 5px 0;">
                            <li>Les joueurs peuvent s'inscrire via <b>/start</b></li>
                            <li>Gérez les inscriptions depuis WhatsApp</li>
                        </ul>
                    </div>
                    <form action="/invite" method="POST">
                        <label style="display:block; text-align:left; font-size: 0.8rem; margin-bottom: 5px;">Inviter un nouveau joueur :</label>
                        <input type="text" name="number" id="invite-number" placeholder="Ex: 2250102030405" required>
                        <button type="submit">Envoyer l'Invitation</button>
                    </form>
                ` : `
                    ${global.pairingCode ? `
                        <p>Cliquez sur le code pour le copier, puis allez sur WhatsApp : <b>Appareils connectés > Lier un appareil > Lier avec le numéro de téléphone</b>.</p>
                        <div class="pairing-code-box" id="pcode" onclick="copyCode()" style="cursor:pointer">${global.pairingCode}</div>
                        <p><small id="copy-hint">Cliquez pour copier</small></p>
                        <form action="/reset" method="POST">
                            <button type="submit" class="secondary">Annuler</button>
                        </form>
                    ` : `
                        ${process.env.BOT_NUMBER ? `
                            <p>Génération du code pour <strong>${process.env.BOT_NUMBER}</strong>...</p>
                            <div class="loader" style="margin: 20px auto; border: 4px solid #333; border-top: 4px solid #f39c12; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite;"></div>
                            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                        ` : `
                            <p>Entrez le numéro du bot (avec code pays) pour obtenir votre code de jumelage.</p>
                            <form action="/pair" method="POST">
                                <input type="text" name="number" id="bot-number" placeholder="Ex: 2250102030405" required>
                                <button type="submit">Obtenir le Code</button>
                            </form>
                        `}
                    `}
                `}

                <form action="/reset" method="POST" style="margin-top: 1rem;">
                    <button type="submit" style="background: none; color: #666; font-size: 0.7rem; border: none; text-decoration: underline; cursor: pointer; width: auto;">Réinitialiser la session (Dépannage)</button>
                </form>
            </div>

            <div class="logs-container" id="logs">
                ${global.logs.map(log => `<div>${log}</div>`).join('')}
            </div>

            <div style="margin-top: 10px;">
                <button onclick="location.reload()" class="secondary" style="width: auto; padding: 5px 15px; font-size: 0.8rem;">Actualiser Statut & Logs</button>
            </div>

            <script>
                const logs = document.getElementById('logs');
                logs.scrollTop = logs.scrollHeight;

                const hasPairingCode = ${global.pairingCode ? 'true' : 'false'};
                const isConnected = ${global.isConnected ? 'true' : 'false'};

                // Refresh every 20s if not typing and not already displaying a code/connected
                setInterval(() => {
                    const botInput = document.getElementById('bot-number');
                    const inviteInput = document.getElementById('invite-number');
                    const isTyping = (botInput && (botInput === document.activeElement || botInput.value.length > 0)) ||
                                     (inviteInput && (inviteInput === document.activeElement || inviteInput.value.length > 0));

                    if (!isTyping && !hasPairingCode && !isConnected) {
                        location.reload();
                    }
                }, 20000);

                function copyCode() {
                    const code = document.getElementById('pcode').innerText;
                    navigator.clipboard.writeText(code).then(() => {
                        const hint = document.getElementById('copy-hint');
                        hint.innerText = "Copié ! ✅";
                        hint.style.color = "#27ae60";
                        setTimeout(() => {
                            hint.innerText = "Cliquez pour copier";
                            hint.style.color = "#e0d0b0";
                        }, 2000);
                    });
                }
            </script>
        </div>
    </body>
    </html>
  `);
});

app.post('/pair', async (req, res) => {
    let number = req.body.number.replace(/\D/g, '');
    if (!number) return res.status(400).send("Numéro invalide.");

    addLog(`Demande de code pour le numéro: ${number}`);

    if (sock && !global.isConnected) {
        try {
            await delay(3500);
            const code = await sock.requestPairingCode(number);
            global.pairingCode = code;
            addLog(`\n\n>>> VOTRE CODE DE JUMELAGE EST : ${code} <<<\n\n`);
            res.redirect('/');
        } catch (e) {
            addLog(`Erreur de jumelage: ${e.message}`);
            global.connectionError = "Erreur lors de la génération du code. Assurez-vous que le bot n'est pas déjà connecté ailleurs.";
            res.redirect('/');
        }
    } else {
        res.status(400).send("Bot déjà connecté ou non initialisé.");
    }
});

app.post('/reset', async (req, res) => {
    addLog("Demande de réinitialisation de session...");
    try {
        if (sock) {
            try { await sock.logout(); } catch (e) {}
            try { sock.end(); } catch (e) {}
        }
        await Auth.destroy({ where: {} });
        global.isConnected = false;
        global.pairingCode = null;
        global.connectionError = null;
        addLog("Session effacée. Redémarrage du bot...");
        connectToWhatsApp();
        res.redirect('/');
    } catch (e) {
        addLog(`Erreur Reset: ${e.message}`);
        res.status(500).send("Erreur lors de la réinitialisation.");
    }
});

app.post('/invite', async (req, res) => {
  const number = req.body.number.replace(/\D/g, '');
  if (!number) return res.status(400).send("Numéro invalide.");

  const jid = `${number}@s.whatsapp.net`;

  if (sock && global.isConnected) {
    try {
        await sock.sendMessage(jid, { text: "⚔️ *Bienvenue dans Throne of Epsylion !* ⚔️\n\nTa destinée commence ici. Tape */start* pour forger ton identité." });
        addLog(`Invitation envoyée à ${number}`);
        res.send(`
            <html>
            <body style="background:#0d0d0d; color:#e0d0b0; font-family:sans-serif; text-align:center; padding:100px;">
                <h1 style="color:#f39c12">Succès !</h1>
                <p>Invitation envoyée au numéro ${number}.</p>
                <a href="/" style="color:#f39c12">Retour</a>
            </body>
            </html>
        `);
    } catch (e) {
        addLog(`Erreur d'envoi à ${number}: ${e.message}`);
        res.status(500).send("Erreur lors de l'envoi du message.");
    }
  } else {
    res.status(503).send("Bot non connecté.");
  }
});

// STARTUP WRAPPER
(async () => {
    addLog("Initialisation du système...");
    try {
        // If BOT_NUMBER is set, we block until paired.
        // Otherwise, we start immediately so the user can use the website to enter the number.
        await connectToWhatsApp();

        app.listen(port, () => {
          addLog(`Serveur web démarré sur http://localhost:${port}`);
          addLog(`Déploiement prêt.`);
        });
    } catch (err) {
        addLog(`ERREUR FATALE AU DÉMARRAGE: ${err.message}`);
        process.exit(1);
    }
})();
