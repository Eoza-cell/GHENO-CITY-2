const axios = require('axios');

async function generateImageFromPrompt(prompt) {
  console.log(`[Pollinations] Demande de génération d'image pour : ${prompt}`);
  try {
    // L'URL encode le prompt pour s'assurer qu'il est correctement formaté
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://gen.pollinations.ai/prompt/${encodedPrompt}`;

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer' // Demande la réponse en tant que données binaires
    });

    return Buffer.from(response.data);

  } catch (error) {
    console.error("Erreur détaillée lors de la génération de l'image avec Pollinations:", {
        message: error.response ? error.response.statusText : error.message,
        prompt: prompt,
    });
    // Fournit un message d'erreur convivial
    throw new Error("Le service de génération d'images est actuellement indisponible ou a rencontré une erreur.");
  }
}

module.exports = { generateImageFromPrompt };
