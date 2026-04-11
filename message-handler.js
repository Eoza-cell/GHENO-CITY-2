const { generateImageFromPrompt } = require('./image-generator');
const { generateVideoFromPrompt } = require('./video-generator');

/**
 * Sends a message, checking for image generation prompts.
 * If prompts like [POLLINATION PROMPT: ...] are found, it generates and sends the images with a caption.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {string} text The text to send, possibly containing image prompts.
 */
async function sendWithImage(sock, jid, text) {
  // S'assure que le texte est une chaîne de caractères avant de continuer.
  if (typeof text !== 'string') {
    console.warn(`[sendWithImage] Le texte fourni n'est pas une chaîne de caractères. Type reçu: ${typeof text}`);
    return; // Ne rien envoyer si le texte n'est pas valide.
  }

  const promptRegex = /\[POLLINATION PROMPT:\s*(.*?)\s*\]/gi;
  // Utilise matchAll pour obtenir toutes les invites et les mapper dans un tableau.
  const prompts = [...text.matchAll(promptRegex)].map(match => match[1]);

  const videoRegex = /\[VIDEO PROMPT:\s*(.*?)\s*\]/gi;
  const videoPrompts = [...text.matchAll(videoRegex)].map(match => match[1]);

  // La légende est le texte original dont toutes les balises d'invite ont été supprimées.
  let caption = text.replace(promptRegex, '').replace(videoRegex, '').trim();

  // If there are no image or video prompts, just send the text.
  if (prompts.length === 0 && videoPrompts.length === 0) {
    if (caption) {
      await sock.sendMessage(jid, { text: caption });
    }
    return;
  }

  // If there's a caption and media to follow, send the caption first to keep the player engaged.
  // We'll track if we've sent the caption to avoid sending it again.
  let captionSent = false;

  if (caption && (prompts.length > 0 || videoPrompts.length > 0)) {
    await sock.sendMessage(jid, { text: caption });
    captionSent = true;
  }

  // Generate and send images for each prompt.
  for (const [index, prompt] of prompts.entries()) {
    try {
      console.log(`Génération d'image pour le prompt: "${prompt}"`);
      const imageBuffer = await generateImageFromPrompt(prompt);

      await sock.sendMessage(jid, { image: imageBuffer });
    } catch (error) {
      console.error(`Échec de la génération ou de l'envoi de l'image pour le prompt: "${prompt}"`, error);
      await sock.sendMessage(jid, { text: `[La génération d'image a échoué pour le prompt: "${prompt}"]` });
    }
  }

  // Generate and send videos for each prompt.
  for (const [index, prompt] of videoPrompts.entries()) {
    try {
      console.log(`Génération de vidéo pour le prompt: "${prompt}"`);
      const videoBuffer = await generateVideoFromPrompt(prompt);

      await sock.sendMessage(jid, { video: videoBuffer });
    } catch (error) {
      console.error(`Échec de la génération ou de l'envoi de la vidéo pour le prompt: "${prompt}"`, error);
      await sock.sendMessage(jid, { text: `[La génération de vidéo a échoué pour le prompt: "${prompt}"]` });
    }
  }
}

/**
 * Sends and animates a message to show a "loading" effect.
 * It repeatedly edits the message with a sequence of dots.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {string} baseText The base text of the loading message.
 * @returns {Promise<object>} A promise that resolves with the final message object.
 */
async function sendAnimatedMessage(sock, jid, baseText) {
  // Send the initial message
  const sentMsg = await sock.sendMessage(jid, { text: baseText });
  const messageKey = sentMsg.key;

  // Animate the message
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 500)); // 0.5 second delay
    const animatedText = baseText + '.'.repeat(i + 1);
    await sock.sendMessage(jid, { text: animatedText, edit: messageKey });
  }

  return sentMsg;
}

module.exports = { sendWithImage, sendAnimatedMessage };
