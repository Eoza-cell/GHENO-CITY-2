const axios = require('axios');
const API_KEY = process.env.POLLINATION_API_KEY;

async function generateImageFromPrompt(prompt) {
  if (!API_KEY) {
    throw new Error("La clé API de Pollination n'est pas configurée. Veuillez la définir dans le fichier .env.");
  }

  console.log(`[Pollination] Demande de génération d'image pour : ${prompt}`);
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      responseType: 'arraybuffer' // Important pour recevoir les données de l'image
    });

    // Les données de l'image sont directement dans response.data
    const imageBuffer = Buffer.from(response.data);
    return imageBuffer;

  } catch (error) {
    console.error("Erreur détaillée lors de la génération de l'image avec Pollination:", {
        message: error.response ? error.response.data.toString() : error.message,
        prompt: prompt,
    });
    throw error;
  }
}

module.exports = { generateImageFromPrompt };
