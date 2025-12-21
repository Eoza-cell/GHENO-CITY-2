const axios = require('axios');
const { addToQueue } = require('./rate-limiter');

async function generateImageFromPrompt(prompt) {
  const url = `https://api.4oimageapi.workers.dev/`;
  const payload = {
    prompt: prompt,
    width: 512,
    height: 512,
  };

  try {
    console.log(`Ajout de la requête de génération d'image à la file d'attente pour : ${prompt}`);

    const apiCall = async () => {
        const response = await axios.post(url, payload, {
            responseType: 'arraybuffer',
            timeout: 60000, // 60 seconds timeout
        });

        if (response.status !== 200) {
            throw new Error(`Échec de la récupération de l'image, code de statut: ${response.status}`);
        }

        const contentType = response.headers['content-type'];
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error(`Réponse inattendue du serveur, type de contenu: ${contentType}`);
        }

        return response.data;
    };

    const imageData = await addToQueue(apiCall);
    return Buffer.from(imageData);

  } catch (error) {
    console.error('Erreur détaillée lors de la génération de l\'image:', {
        message: error.message,
        url: url,
        prompt: prompt,
        responseStatus: error.response ? error.response.status : 'N/A',
        responseData: error.response ? error.response.data.toString().slice(0, 200) + '...' : 'N/A'
    });
    throw error;
  }
}

module.exports = { generateImageFromPrompt };
