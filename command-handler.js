const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Player, ActiveGroup } = require('./database');
const { parseSheet } = require('./sheet-parser');
const { sendAnimatedMessage } = require('./message-handler');
const { Op } = require('sequelize');

/**
 * Determines the correct JID (Jabber ID) for the sender of a message.
 */
function getJid(message) {
  return message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;
}

const commands = new Map();
const registrationState = new Map(); // whatsappId -> 'awaiting_name' | 'awaiting_description'

// Command: /on
commands.set('on', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    if (!replyJid.endsWith('@g.us')) {
        await sock.sendMessage(replyJid, { text: "Cette commande ne peut être utilisée que dans un groupe." });
        return;
    }

    const jid = getJid(message);
    const groupMeta = await sock.groupMetadata(replyJid);
    const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);

    if (!admins.includes(jid)) {
        await sock.sendMessage(replyJid, { text: "Seul un administrateur du groupe peut activer le bot." });
        return;
    }

    const [group, created] = await ActiveGroup.findOrCreate({ where: { groupId: replyJid } });
    if (created) {
        await sock.sendMessage(replyJid, { text: "Le bot Chivalern est maintenant *activé* dans ce groupe. Utilisez `/fiche` pour commencer." });
    } else {
        await sock.sendMessage(replyJid, { text: "Le bot est déjà actif dans ce groupe." });
    }
});

// Command: /off
commands.set('off', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    if (!replyJid.endsWith('@g.us')) {
        await sock.sendMessage(replyJid, { text: "Cette commande ne peut être utilisée que dans un groupe." });
        return;
    }

    const jid = getJid(message);
    const groupMeta = await sock.groupMetadata(replyJid);
    const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);

    if (!admins.includes(jid)) {
        await sock.sendMessage(replyJid, { text: "Seul un administrateur du groupe peut désactiver le bot." });
        return;
    }

    const destroyed = await ActiveGroup.destroy({ where: { groupId: replyJid } });
    if (destroyed) {
        await sock.sendMessage(replyJid, { text: "Le bot Chivalern est maintenant *désactivé* dans ce groupe." });
    } else {
        await sock.sendMessage(replyJid, { text: "Le bot n'était pas actif dans ce groupe." });
    }
});

// Command: /fiche
commands.set('fiche', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const ficheTemplate = `
╔═══════════════════╗
║   𝕸𝖔𝖚𝖓𝖙 𝖆𝖓𝖉 𝕭𝖑𝖆𝖉𝖊 : 𝕮𝖍𝖎𝖛𝖆𝖑𝖊𝖗𝖞   ║
╚═══════════════════╝

*Nom :* (compléter)
*Prénom :* (compléter)
*Surnom :* Aucun
*Titre de Noblesse :* Aucun
*Ville/Région actuel :* Praven
*Ville/Région d'Origine :* Praven

*Âge :* 18 ans
*Taille :* 1m70
*Rôliste :* (au bot de compléter en voyant le pseudo WhatsApp)

╔═══════◇
║ *Rang :* Civil/Paysan
║ *Serment :* Aucun
║ *Allégeance :* Aucun
║ *Région/Fief :* Aucune
╚═════════════════╝
╔═════════════════╗
> Maître d'Armes              : 00
> Puissance de Tension  : 00
> Puissance de Jet           : 00
> Bouclier                           : 00
> Athlétisme                      : 00
> Équitation                       : 00
> Archerie Montée            : 00
> Pistage                            : 00
> Repérage                         : 00
> Ingénierie                        : 00
> Commandement            : 00
> Soins des blessures      : 00
╚═════════════════╝
╔═════════════════╗
▪️ Aucun
╚═════════════════╝
`;
    await sock.sendMessage(replyJid, { text: ficheTemplate });
});

// Command: /guide
commands.set('guide', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const guideDir = 'assets/guides';

    try {
        const imageFiles = fs.readdirSync(guideDir).filter(file => file.endsWith('.jpg'));

        if (imageFiles.length === 0) {
            await sock.sendMessage(replyJid, { text: "Le guide n'est pas disponible pour le moment." });
            return;
        }

        await sock.sendMessage(replyJid, { text: "Voici le guide de création de personnage :" });

        for (const file of imageFiles) {
            const imagePath = path.join(guideDir, file);
            await sock.sendMessage(replyJid, {
                image: fs.readFileSync(imagePath),
            });
        }
    } catch (error) {
        console.error("Erreur lors de l'envoi du guide :", error);
        await sock.sendMessage(replyJid, { text: "Une erreur est survenue en tentant d'envoyer le guide." });
    }
});

// Command: /give <@player> <amount>
commands.set('give', async (sock, message, args) => {
    const replyJid = message.key.remoteJid;
    const jid = getJid(message);

    const groupMeta = await sock.groupMetadata(replyJid);
    const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);

    if (!admins.includes(jid)) {
        await sock.sendMessage(replyJid, { text: "Seul un administrateur peut utiliser cette commande." });
        return;
    }

    const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) {
        await sock.sendMessage(replyJid, { text: "Tu dois mentionner un joueur. Usage: `/give @joueur <montant>`" });
        return;
    }

    const amount = parseInt(args[1], 10);
    if (isNaN(amount) || amount <= 0) {
        await sock.sendMessage(replyJid, { text: "Montant invalide. Usage: `/give @joueur <montant>`" });
        return;
    }

    const player = await Player.findOne({ where: { whatsappId: mentionedJid } });
    if (!player) {
        await sock.sendMessage(replyJid, { text: "Ce joueur n'a pas de fiche." });
        return;
    }

    await player.increment('argent', { by: amount });
    await sock.sendMessage(replyJid, { text: `${amount} argent(s) ont été donné(s) à ${player.prenom}.` });
});

// Command: /set <@player> <stat> <value>
commands.set('set', async (sock, message, args) => {
    const replyJid = message.key.remoteJid;
    const jid = getJid(message);

    const groupMeta = await sock.groupMetadata(replyJid);
    const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);

    if (!admins.includes(jid)) {
        await sock.sendMessage(replyJid, { text: "Seul un administrateur peut utiliser cette commande." });
        return;
    }

    const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const statName = args[1];
    const value = parseInt(args[2], 10);

    if (!mentionedJid || !statName || isNaN(value)) {
        await sock.sendMessage(replyJid, { text: "Usage incorrect. `/set @joueur <stat> <valeur>`" });
        return;
    }

    const player = await Player.findOne({ where: { whatsappId: mentionedJid } });
    if (!player) {
        await sock.sendMessage(replyJid, { text: "Ce joueur n'a pas de fiche." });
        return;
    }

    const validStats = [
        'maitreDArmes', 'puissanceDeTension', 'puissanceDeJet', 'bouclier',
        'athletisme', 'equitation', 'archerieMontee', 'pistage', 'reperage',
        'ingenierie', 'commandement', 'soinsDesBlessures', 'age', 'argent'
    ];

    // For user-friendliness, we allow common names
    const statAlias = {
        "maitredarmes": "maitreDArmes", "tension": "puissanceDeTension", "jet": "puissanceDeJet",
    };

    const normalizedStatName = statName.toLowerCase().replace(/\s/g, '');
    const dbStatName = statAlias[normalizedStatName] || normalizedStatName;

    if (!validStats.includes(dbStatName)) {
        await sock.sendMessage(replyJid, { text: `Statistique "${statName}" invalide.` });
        return;
    }

    try {
        await player.update({ [dbStatName]: value });
        await sock.sendMessage(replyJid, { text: `La statistique *${statName}* de ${player.prenom} a été mise à jour à ${value}.` });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la stat:", error);
        await sock.sendMessage(replyJid, { text: "Une erreur est survenue lors de la mise à jour." });
    }
});

// Command: /valider <@player>
commands.set('valider', async (sock, message, args) => {
    const replyJid = message.key.remoteJid;
    const jid = getJid(message);

    const groupMeta = await sock.groupMetadata(replyJid);
    const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);

    if (!admins.includes(jid)) {
        await sock.sendMessage(replyJid, { text: "Seul un administrateur peut utiliser cette commande." });
        return;
    }

    const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) {
        await sock.sendMessage(replyJid, { text: "Tu dois mentionner un joueur. Usage: `/valider @joueur`" });
        return;
    }

    const player = await Player.findOne({ where: { whatsappId: mentionedJid } });
    if (!player) {
        await sock.sendMessage(replyJid, { text: "Ce joueur n'a pas de fiche." });
        return;
    }

    await player.update({ validated: true });
    await sock.sendMessage(replyJid, { text: `La fiche de ${player.prenom} a été validée.` });
});


// Command: /retirer <@player> <amount>
commands.set('retirer', async (sock, message, args) => {
    const replyJid = message.key.remoteJid;
    const jid = getJid(message);

    const groupMeta = await sock.groupMetadata(replyJid);
    const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);

    if (!admins.includes(jid)) {
        await sock.sendMessage(replyJid, { text: "Seul un administrateur peut utiliser cette commande." });
        return;
    }

    const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) {
        await sock.sendMessage(replyJid, { text: "Tu dois mentionner un joueur. Usage: `/retirer @joueur <montant>`" });
        return;
    }

    const amount = parseInt(args[1], 10);
    if (isNaN(amount) || amount <= 0) {
        await sock.sendMessage(replyJid, { text: "Montant invalide. Usage: `/retirer @joueur <montant>`" });
        return;
    }

    const player = await Player.findOne({ where: { whatsappId: mentionedJid } });
    if (!player) {
        await sock.sendMessage(replyJid, { text: "Ce joueur n'a pas de fiche." });
        return;
    }

    if (player.argent < amount) {
        await sock.sendMessage(replyJid, { text: `${player.prenom} n'a pas assez d'argent. Son solde est de ${player.argent}.` });
        return;
    }

    await player.decrement('argent', { by: amount });
    await sock.sendMessage(replyJid, { text: `${amount} argent(s) ont été retiré(s) à ${player.prenom}.` });
});

// Command: /fiches
commands.set('fiches', async (sock, message) => {
    const replyJid = message.key.remoteJid;

    try {
        const players = await Player.findAll();

        if (players.length === 0) {
            await sock.sendMessage(replyJid, { text: "Il n'y a encore aucune fiche de personnage enregistrée." });
            return;
        }

        let fichesList = "📜 *Liste de toutes les fiches de personnage*\n\n";

        players.forEach(player => {
            const validationStatus = player.validated ? '✅ Validée' : '❌ En attente';
            fichesList += `*${player.prenom} ${player.nom}*\n`;
            fichesList += `> *Titre:* ${player.titreNoblesse}\n`;
            fichesList += `> *Rang:* ${player.rang}\n`;
            fichesList += `> *Statut:* ${validationStatus}\n\n`;
        });

        await sock.sendMessage(replyJid, { text: fichesList });

    } catch (error) {
        console.error("Erreur lors de la récupération des fiches:", error);
        await sock.sendMessage(replyJid, { text: "Une erreur est survenue en tentant de récupérer la liste des fiches." });
    }
});


// Main command handler
async function handleCommand(sock, message, downloadMediaMessage) {
  if (message.key.fromMe) return;

  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const replyJid = message.key.remoteJid;

  // Group activation check
  if (replyJid.endsWith('@g.us')) {
      const commandName = (messageText.startsWith('/') ? messageText.slice(1).trim().split(/ +/)[0].toLowerCase() : "");
      if (commandName !== 'on') {
          const isActive = await ActiveGroup.findOne({ where: { groupId: replyJid } });
          if (!isActive) {
              console.log(`[INACTIVE] Ignored message in group ${replyJid} because bot is not active.`);
              return; // Bot is not active in this group, so ignore the message.
          }
      }
  }


  const jid = getJid(message);
  const senderName = message.pushName || "Inconnu";

  console.log(`[MSG] From "${senderName}" (${jid}) in ${replyJid}: "${messageText}"`);

    // Handle Character Sheet Submission
    if (messageText.includes("𝕸𝖔𝖚𝖓𝖙 𝖆𝖓𝖉 𝕭𝖑𝖆𝖉𝖊 : 𝕮𝖍𝖎𝖛𝖆𝖑𝖊𝖗𝖞")) {
        let loadingKey;
        try {
            loadingKey = await sendAnimatedMessage(sock, replyJid, "Lecture de la fiche...");
            const playerData = parseSheet(messageText, senderName);

            const [player, created] = await Player.findOrCreate({
                where: { whatsappId: jid },
                defaults: playerData
            });

            if (created) {
                await sock.sendMessage(replyJid, { text: `Fiche de ${playerData.prenom} ${playerData.nom} enregistrée !`, edit: loadingKey });

                // Notify admins in a separate message
                const groupMeta = await sock.groupMetadata(replyJid);
                const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);

                if (admins.length > 0) {
                    const adminMentions = admins.map(a => `@${a.split('@')[0]}`).join(' ');
                    const text = `${adminMentions}, veuillez valider la nouvelle fiche de @${jid.split('@')[0]}.`;
                    await sock.sendMessage(replyJid, {
                        text: text,
                        mentions: [...admins, jid]
                    });
                }

            } else {
                await Player.update(playerData, { where: { whatsappId: jid } });
                await sock.sendMessage(replyJid, { text: `Ta fiche a été mise à jour, ${playerData.prenom}.`, edit: loadingKey });

                 // Notify admins in a separate message
                const groupMeta = await sock.groupMetadata(replyJid);
                const admins = groupMeta.participants.filter(p => p.admin).map(p => p.id);
                if (admins.length > 0) {
                    const adminMentions = admins.map(a => `@${a.split('@')[0]}`).join(' ');
                    const text = `${adminMentions}, la fiche de @${jid.split('@')[0]} a été mise à jour. Veuillez la valider.`;
                    await sock.sendMessage(replyJid, {
                        text: text,
                        mentions: [...admins, jid]
                    });
                }
            }
            return; // Done processing the sheet
        } catch (error) {
            console.error("Erreur de parsing de la fiche:", error);
            const errorMessage = `Je n'ai pas pu lire ta fiche. Assure-toi de bien remplir tous les champs sans modifier le modèle.\n*Erreur:* ${error.message}`;
            if (loadingKey) {
                await sock.sendMessage(replyJid, { text: errorMessage, edit: loadingKey });
            } else {
                await sock.sendMessage(replyJid, { text: errorMessage });
            }
            return; // Stop processing on error
        }
    }


  // Handle standard commands
  if (!messageText.startsWith('/')) return;

  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);

  if (command) {
    try {
      await command(sock, message, args);
    } catch (error) {
      console.error(`Erreur commande ${commandName}:`, error);
      await sock.sendMessage(replyJid, { text: "Une erreur est survenue lors de l'exécution de la commande." });
    }
  } else {
    // We don't send "unknown command" to avoid spamming for messages that aren't commands.
  }
}

module.exports = { handleCommand };
