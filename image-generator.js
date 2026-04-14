const axios = require('axios');

/**
 * Generates an image from a text prompt using Pollinations AI (as a reliable fallback for Puter.js).
 * @param {string} prompt The text prompt for the image.
 * @returns {Promise<Buffer>} The image data as a buffer.
 */
async function generateImageFromPrompt(prompt) {
  console.log(`[Image Generator] Demande de génération d'image pour : ${prompt}`);

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    // Pollinations is free, unlimited, and reliable.
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      }
    });

    return Buffer.from(response.data);

  } catch (error) {
    console.error("Erreur lors de la génération de l'image:", error.message);
    throw new Error("Le service de génération d'images est actuellement indisponible.");
  }
}

module.exports = { generateImageFromPrompt };
