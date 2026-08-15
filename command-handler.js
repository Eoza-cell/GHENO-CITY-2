const { Player } = require('./database');
const { callAI } = require('./ai-utils');

/**
 * Extrait l'identifiant (JID) de l'expéditeur du message.
 */
function getJid(message) {
  if (!message || !message.key) return null;
  if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
      return message.key.participant || null;
  }
  return message.key.remoteJid || null;
}

/**
 * Gère la réception d'un message, traite les commandes ou appelle l'IA par défaut.
 */
async function handleCommand(sock, message) {
  if (message.key.fromMe) return;

  const text = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!text) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;

  // Récupérer ou créer l'utilisateur dans la base de données
  let [player] = await Player.findOrCreate({
    where: { whatsappId: jid },
    defaults: { name: message.pushName || 'Utilisateur' }
  });

  console.log(`[MESSAGE] Reçu de ${player.name} : "${text}"`);

  // 1. Gestion des commandes simples
  if (text.startsWith('/')) {
    const args = text.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'start') {
      await sock.sendMessage(replyJid, {
        text: `Bonjour *${player.name}* ! Bienvenue sur ce bot basique.\n\nJe suis équipé d'une IA intégrée.\nVous pouvez me parler naturellement ou utiliser des commandes comme /help.`
      });
    } else if (command === 'help') {
      await sock.sendMessage(replyJid, {
        text: `Voici les commandes disponibles :\n\n` +
              `* /start* : Initialiser le bot et saluer\n` +
              `* /help* : Afficher cette aide\n` +
              `* /ping* : Tester la latence du bot\n` +
              `* /name <nouveau_nom>* : Changer votre nom dans ma base de données`
      });
    } else if (command === 'ping') {
      const start = Date.now();
      const sent = await sock.sendMessage(replyJid, { text: "🏓 *Pong !*" });
      const latency = Date.now() - start;
      await sock.sendMessage(replyJid, { text: `🏓 *Pong !* (Latence : ${latency}ms)`, edit: sent.key });
    } else if (command === 'name') {
      const newName = args.join(' ').trim();
      if (!newName) {
        await sock.sendMessage(replyJid, { text: "Veuillez spécifier un nom. Exemple : `/name Arthur`" });
      } else {
        await player.update({ name: newName });
        await sock.sendMessage(replyJid, { text: `Nom mis à jour avec succès ! Je vous appellerai désormais *${newName}*.` });
      }
    } else {
      await sock.sendMessage(replyJid, { text: "Commande inconnue. Tapez /help pour voir la liste des commandes." });
    }
  } else {
    // 2. Appel à l'IA intégrée par défaut si ce n'est pas une commande
    // On envoie un indicateur visuel de frappe
    try {
      await sock.sendPresenceUpdate('composing', replyJid);
    } catch (e) {}

    const systemPrompt = "Tu es un assistant WhatsApp amical, concis et serviable. Réponds de manière chaleureuse en français.";
    const aiResponse = await callAI(systemPrompt, `L'utilisateur ${player.name} te dit : ${text}`);

    await sock.sendMessage(replyJid, { text: aiResponse });
  }
}

module.exports = { handleCommand, getJid };
