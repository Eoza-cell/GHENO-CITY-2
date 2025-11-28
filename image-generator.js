const https = require('https');

// Service d'images principal
const primaryService = (prompt) => {
  const encodedPrompt = encodeURIComponent(prompt);
  // Using a more stable Unsplash URL for reliability
  const url = `https://source.unsplash.com/1024x1024/?${encodedPrompt.replace(/%20/g, ',')}`;
  return fetchImage(url);
};


// Tente de récupérer une image depuis une URL donnée
function fetchImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
        return fetchImage(response.headers.location).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`Échec de la récupération de l'image, code de statut: ${response.statusCode} de ${url}`));
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', (err) => reject(new Error(`Erreur réseau lors de la tentative de récupération de l'image de ${url}: ${err.message}`)));
  });
}

// Fonction principale pour générer l'image
async function generateImageFromPrompt(prompt) {
  console.log(`Tentative de génération d'image pour le prompt : "${prompt}"`);
  try {
    const imageBuffer = await primaryService(prompt);
    console.log("Image générée avec succès via le service principal (Unsplash).");
    return imageBuffer;
  } catch (primaryError) {
    console.warn(`Le service principal a échoué : ${primaryError.message}.`);
    // Si vous aviez un service de secours, vous l'appelleriez ici.
    // Pour l'instant, nous propageons l'erreur.
    throw primaryError; // Rethrowing the error to be handled by the caller
  }
}

module.exports = { generateImageFromPrompt };
