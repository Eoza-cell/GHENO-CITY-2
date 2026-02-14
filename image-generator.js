const axios = require('axios');

async function generateImageFromPrompt(prompt, retries = 2) {
  console.log(`[Pollinations Image] Demande de génération d'image pour : ${prompt}`);

  for (let i = 0; i <= retries; i++) {
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512`;

      const response = await axios.get(imageUrl, {
        responseType: 'stream',
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const chunks = [];
      for await (const chunk of response.data) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.length > 0) {
        return buffer;
      }
      throw new Error("Réponse vide du service d'image.");

    } catch (error) {
      console.warn(`Tentative ${i + 1} échouée pour la génération d'image:`, error.message);
      if (i === retries) {
        console.error("Erreur détaillée lors de la génération de l'image avec Pollinations:", {
            message: error.response ? (typeof error.response.data === 'string' ? error.response.data : error.response.statusText) : error.message,
            prompt: prompt,
        });
        throw new Error("Le service de génération d'images est actuellement indisponible ou a rencontré une erreur.");
      }
      // Attend un peu avant de réessayer
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { generateImageFromPrompt };
