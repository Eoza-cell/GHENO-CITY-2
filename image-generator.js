const axios = require('axios');

async function generateImageFromPrompt(prompt) {
  console.log(`[Pollinations Image] Demande de génération d'image pour : ${prompt}`);
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512`;

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);

  } catch (error) {
    console.error("Erreur détaillée lors de la génération de l'image avec Pollinations:", {
        message: error.response ? error.response.statusText : error.message,
        prompt: prompt,
    });
    throw new Error("Le service de génération d'images est actuellement indisponible ou a rencontré une erreur.");
  }
}

module.exports = { generateImageFromPrompt };
