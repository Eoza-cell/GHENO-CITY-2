const axios = require('axios');

async function generateImageFromPrompt(prompt) {
  console.log(`[Pollinations Image] Demande de génération d'image pour : ${prompt}`);
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    // Use the reliable free endpoint
    const imageUrl = `https://pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    };

    if (process.env.POLLINATION_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.POLLINATION_API_KEY}`;
    }

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: headers
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
