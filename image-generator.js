const axios = require('axios');
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const IMAGE_GENERATION_MODEL_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";

async function generateImageFromPrompt(prompt) {
  if (!HUGGINGFACE_API_KEY) {
    throw new Error("La clé API de Hugging Face n'est pas configurée.");
  }

  console.log(`[Hugging Face] Demande de génération d'image pour : ${prompt}`);
  try {
    const response = await axios.post(
      IMAGE_GENERATION_MODEL_URL,
      { inputs: prompt },
      {
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer', // Demande une réponse binaire (l'image)
      }
    );

    return Buffer.from(response.data);

  } catch (error) {
    console.error("Erreur détaillée lors de la génération de l'image avec Hugging Face:", {
        message: error.response ? error.response.data.toString() : error.message,
        prompt: prompt,
    });
    throw new Error("Le service de génération d'images est actuellement indisponible ou a rencontré une erreur.");
  }
}

module.exports = { generateImageFromPrompt };
