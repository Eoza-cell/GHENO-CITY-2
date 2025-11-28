const https = require('https');

async function generateImageFromPrompt(prompt) {
  const encodedPrompt = encodeURIComponent(prompt);
  // Ajout de paramètres pour améliorer la qualité et la cohérence
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&seed=42&model=dall-e-3`;

  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Échec de la récupération de l'image, code de statut: ${response.statusCode}`));
        return;
      }

      // Vérifier le type de contenu pour s'assurer qu'il s'agit d'une image
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        reject(new Error(`Réponse inattendue du serveur, type de contenu: ${contentType}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });

      response.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = { generateImageFromPrompt };
