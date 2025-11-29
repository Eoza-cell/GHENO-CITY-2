const { generateImageFromPrompt } = require('./image-generator');

/**
 * Sends a message, checking for image generation prompts.
 * If prompts like [POLLINATION PROMPT: ...] are found, it generates and sends the images.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {string} text The text to send, possibly containing image prompts.
 */
async function sendWithImage(sock, jid, text) {
  // Regex pour trouver les prompts de Pollination, insensible à la casse et gérant les espaces
  const promptRegex = /\[POLLINATION PROMPT:\s*(.*?)\s*\]/gi;
  let matches;
  const prompts = [];

  // Utiliser un `while` avec `exec` pour trouver toutes les correspondances
  while ((matches = promptRegex.exec(text)) !== null) {
    prompts.push(matches[1]);
  }

  // S'il n'y a pas de prompts, envoyer simplement le texte.
  if (prompts.length === 0) {
    if (text.trim()) { // S'assurer que le texte n'est pas vide
         await sock.sendMessage(jid, { text });
    }
    return;
  }

  // Retirer les prompts du texte original pour créer la légende.
  const caption = text.replace(promptRegex, '').trim();

  // Envoyer d'abord la partie textuelle (la légende) si elle n'est pas vide.
  if (caption) {
    await sock.sendMessage(jid, { text: caption });
  }

  // Boucler sur chaque prompt trouvé, générer et envoyer l'image.
  for (const prompt of prompts) {
    try {
      console.log(`Génération d'image demandée avec le prompt : "${prompt}"`);
      const imageBuffer = await generateImageFromPrompt(prompt);
      await sock.sendMessage(jid, {
        image: imageBuffer,
        // On ne met la légende que sur la première image pour éviter la redondance
        caption: prompts.indexOf(prompt) === 0 && !caption ? prompt : undefined
      });
    } catch (error) {
      console.error(`Erreur lors de la génération de l'image pour le prompt : "${prompt}"`, error);
      // En cas d'échec, envoyer un message d'erreur clair au joueur.
      await sock.sendMessage(jid, { text: `[La génération d'image a échoué pour le prompt : "${prompt}"]` });
    }
  }
}

module.exports = { sendWithImage };
