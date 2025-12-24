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
