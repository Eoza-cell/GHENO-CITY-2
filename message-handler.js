const { generateImageFromPrompt } = require('./image-generator');

/**
 * Sends a message, checking for image generation prompts.
 * If prompts like [POLLINATION PROMPT: ...] are found, it generates and sends the images with a caption.
 * @param {any} sock The Baileys socket instance.
 * @param {string} jid The recipient JID.
 * @param {string} text The text to send, possibly containing image prompts.
 */
async function sendWithImage(sock, jid, text) {
  const promptRegex = /\[POLLINATION PROMPT:\s*(.*?)\s*\]/gi;
  // Use matchAll to get all prompts and map them to an array.
  const prompts = [...text.matchAll(promptRegex)].map(match => match[1]);
  // The caption is the original text with all prompt tags removed.
  const caption = text.replace(promptRegex, '').trim();

  // If there are no prompts, just send the text if it's not empty.
  if (prompts.length === 0) {
    if (caption) {
      await sock.sendMessage(jid, { text: caption });
    }
    return;
  }

  // Generate and send images for each prompt.
  for (const [index, prompt] of prompts.entries()) {
    try {
      console.log(`Génération d'image pour le prompt: "${prompt}"`);
      const imageBuffer = await generateImageFromPrompt(prompt);

      // The caption is only sent with the first image to avoid repetition.
      const messageOptions = {
        image: imageBuffer,
      };
      if (index === 0 && caption) {
        messageOptions.caption = caption;
      }

      await sock.sendMessage(jid, messageOptions);

    } catch (error) {
      console.error(`Échec de la génération ou de l'envoi de l'image pour le prompt: "${prompt}"`, error);
      // Inform the user about the failure in a clear message.
      await sock.sendMessage(jid, { text: `[La génération d'image a échoué pour le prompt: "${prompt}"]` });
    }
  }
}

module.exports = { sendWithImage };
