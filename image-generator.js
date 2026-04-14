const puter = require('@heyputer/puter.js').default;

/**
 * Generates an image from a text prompt using Puter.js AI service.
 * @param {string} prompt The text prompt for the image.
 * @returns {Promise<Buffer>} The image data as a buffer.
 */
async function generateImageFromPrompt(prompt) {
  console.log(`[Puter Image] Demande de génération d'image pour : ${prompt}`);

  if (process.env.PUTER_AUTH_TOKEN) {
    puter.setAuthToken(process.env.PUTER_AUTH_TOKEN);
  }

  try {
    // Puter.js txt2img returns an object representing the image.
    // In many environments, it's an FSItem that can be read.
    // In others, its toString() returns a data URL.
    const image = await puter.ai.txt2img(prompt, {
        model: 'black-forest-labs/FLUX.1-schnell-Free'
    });

    // Check for toString() returning Data URI
    const imageData = image.toString();
    if (imageData && imageData.startsWith('data:')) {
        const base64Data = imageData.split(',')[1];
        return Buffer.from(base64Data, 'base64');
    }

    // Check if it's a PuterFile/FSItem with a read method
    if (image && typeof image.read === 'function') {
        const data = await image.read();
        return Buffer.from(data);
    }

    // Fallback if it's already a buffer
    if (Buffer.isBuffer(image)) {
        return image;
    }

    throw new Error("Échec de la récupération des données de l'image Puter (Format inconnu)");

  } catch (error) {
    console.error("Erreur lors de la génération de l'image avec Puter:", error.message || error);
    throw new Error("Le service de génération d'images Puter a rencontré une erreur.");
  }
}

module.exports = { generateImageFromPrompt };
