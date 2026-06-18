const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const bodyParser = require('body-parser');
const { setupDatabase } = require('./database');
const { handleCommand } = require('./command-handler');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let sock;
global.pairingCode = null;
global.isConnected = false;

async function connectToWhatsApp() {
  await setupDatabase();

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false, // User wants pairing code
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== 401;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      global.isConnected = false;
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('Connected to WhatsApp');
      global.isConnected = true;
      global.pairingCode = null;
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    m.messages.forEach(async (message) => {
      if (!message.message) return;
      handleCommand(sock, message);
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
            }

            .container {
                background-color: rgba(42, 42, 42, 0.9);
                padding: 3rem;
                border-radius: 4px;
                border: 1px solid #f39c12;
                box-shadow: 0 0 25px rgba(243, 156, 18, 0.2);
                text-align: center;
                max-width: 500px;
                width: 100%;
            }

            h2 { color: #f39c12; font-family: 'Cinzel', serif; font-size: 1.8rem; margin-top: 0; }
            p { margin-bottom: 2rem; line-height: 1.6; }

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
                transition: transform 0.2s;
            }

            button:hover { transform: scale(1.02); }

            .pairing-code-box {
                font-size: 2.5rem;
                letter-spacing: 5px;
                color: #f39c12;
                background: #111;
                padding: 20px;
                border: 2px dashed #f39c12;
                margin: 20px 0;
                font-family: monospace;
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

                ${global.isConnected ? `
                    <p>Le bot est connecté. Entrez le numéro d'un nouveau joueur pour lui envoyer une invitation.</p>
                    <form action="/invite" method="POST">
                        <input type="text" name="number" placeholder="Ex: 2250102030405" required>
                        <button type="submit">Envoyer l'Invitation</button>
                    </form>
                ` : `
                    ${global.pairingCode ? `
                        <p>Voici votre code de jumelage. Entrez-le sur votre WhatsApp (Appareils connectés > Jumeler avec le numéro de téléphone).</p>
                        <div class="pairing-code-box">${global.pairingCode}</div>
                        <p><small>Le code est valable quelques minutes.</small></p>
                        <a href="/" style="color:#f39c12">Recommencer</a>
                    ` : `
                        <p>Entrez le numéro du bot (avec code pays) pour obtenir un code de jumelage.</p>
                        <form action="/pair" method="POST">
                            <input type="text" name="number" placeholder="Ex: 2250102030405" required>
                            <button type="submit">Générer le Code</button>
                        </form>
                    `}
                `}
            </div>
        </div>
    </body>
    </html>
  `);
});

app.post('/pair', async (req, res) => {
    let number = req.body.number.replace(/\D/g, '');
    if (!number) return res.status(400).send("Numéro invalide.");

    if (sock && !global.isConnected) {
        try {
            await delay(2000);
            const code = await sock.requestPairingCode(number);
            global.pairingCode = code;
            res.redirect('/');
        } catch (e) {
            console.error("Pairing Error:", e);
            res.status(500).send("Erreur lors de la génération du code.");
        }
    } else {
        res.status(400).send("Bot déjà connecté ou non initialisé.");
    }
});

app.post('/invite', async (req, res) => {
  const number = req.body.number.replace(/\D/g, '');
  if (!number) return res.status(400).send("Numéro invalide.");

  const jid = `${number}@s.whatsapp.net`;

  if (sock && global.isConnected) {
    try {
        await sock.sendMessage(jid, { text: "⚔️ *Bienvenue dans Throne of Epsylion !* ⚔️\n\nTa destinée commence ici. Tape */start* pour forger ton identité." });
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
        res.status(500).send("Erreur lors de l'envoi du message.");
    }
  } else {
    res.status(503).send("Bot non connecté.");
  }
});

app.listen(port, () => {
  console.log(`Web server running at http://localhost:${port}`);
});

connectToWhatsApp();
