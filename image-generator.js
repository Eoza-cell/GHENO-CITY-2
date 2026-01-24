const axios = require('axios');
const API_KEY = process.env.VENICE_API_KEY;

async function generateImageFromPrompt(prompt) {
  if (!API_KEY) {
    throw new Error("La clé API de Venice n'est pas configurée.");
  }

  console.log(`[Venice.ai] Demande de génération d'image pour : ${prompt}`);
  try {
    const response = await axios.post(
      'https://api.venice.ai/api/v1/image/generate',
      {
        model: 'z-image-turbo',
        prompt: prompt,
        return_binary: false // Important: Venice renvoie du base64 par défaut
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        }
      }
    );

    // La réponse contient une image encodée en base64
    const base64Image = response.data.images[0];
    return Buffer.from(base64Image, 'base64');

  } catch (error) {
    console.error("Erreur détaillée lors de la génération de l'image avec Venice.ai:", {
        message: error.response ? error.response.data : error.message,
        prompt: prompt,
    });
    throw new Error("Le service de génération d'images est actuellement indisponible ou a rencontré une erreur.");
  }
}

module.exports = { generateImageFromPrompt };
