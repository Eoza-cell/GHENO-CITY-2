const https = require('https');

async function generateImageFromPrompt(prompt) {
  const encodedPrompt = encodeURIComponent(prompt);
  // Simplifier l'URL, enlever les paramètres non supportés comme 'model'
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&seed=42`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, (response) => {
      console.log(`Image generation request sent to: ${url}`);
      console.log(`Response Status Code: ${response.statusCode}`);
      console.log('Response Headers:', response.headers);

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
