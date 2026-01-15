const { Puter } = require('@heyputer/puter.js');

async function generateImageFromPrompt(prompt) {
  try {
    console.log(`[Puter.js] Demande de génération d'image pour : ${prompt}`);

    // Initialise Puter.js
    const puter = new Puter(process.env.PUTER_API_KEY);

    // Génère l'image en utilisant Puter.js
    // La fonction txt2img renvoie un élément <img> HTMLImageElement
    const imageElement = await puter.ai.txt2img({
      prompt: prompt,
      model: 'grok-2-image',
      provider: 'xai',
    });

    // Pour obtenir les données brutes de l'image, nous devons extraire le contenu de l'attribut `src`,
    // qui est une URL de données (data URL) encodée en Base64.
    const src = imageElement.src;
    if (!src.startsWith('data:image/')) {
        throw new Error('La source de l\'image renvoyée par Puter.js n\'est pas une URL de données valide.');
    }

    // Sépare le préfixe de l'URL de données pour obtenir uniquement les données Base64
    const base64Data = src.split(',')[1];

    // Convertit la chaîne Base64 en un Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    return imageBuffer;

  } catch (error) {
    console.error('Erreur détaillée lors de la génération de l\'image avec Puter.js:', {
        message: error.message,
        prompt: prompt,
    });
    throw error;
  }
}

module.exports = { generateImageFromPrompt };
