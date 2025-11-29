const axios = require('axios');

async function generateImageFromPrompt(prompt) {
  const encodedPrompt = encodeURIComponent(prompt);
  // Utiliser le paramètre `model=flux` comme recommandé pour une meilleure qualité
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&seed=42&model=flux`;

  try {
    console.log(`Envoi de la requête de génération d'image à : ${url}`);

    // Utiliser axios pour effectuer la requête GET
    // Définir responseType à 'arraybuffer' pour gérer correctement les données d'image
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000 // Ajouter un timeout de 60 secondes pour être sûr
    });

    // Vérifier que la réponse est valide
    if (response.status !== 200) {
      throw new Error(`Échec de la récupération de l'image, code de statut: ${response.status}`);
    }

    // Vérifier le type de contenu pour s'assurer qu'il s'agit d'une image
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Réponse inattendue du serveur, type de contenu: ${contentType}`);
    }

    // Retourner les données de l'image sous forme de Buffer
    return Buffer.from(response.data);

  } catch (error) {
    // Améliorer le logging d'erreur pour inclure les détails de la requête
    console.error('Erreur détaillée lors de la génération de l\'image:', {
        message: error.message,
        url: url,
        responseStatus: error.response ? error.response.status : 'N/A',
        responseData: error.response ? error.response.data.toString().slice(0, 200) + '...' : 'N/A'
    });
    // Renvoyer l'erreur pour que l'appelant puisse la gérer
    throw error;
  }
}

module.exports = { generateImageFromPrompt };
