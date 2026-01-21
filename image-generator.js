const axios = require('axios');

async function generateImageFromPrompt(prompt) {
  console.log(`[subnp] Demande de génération d'image pour : ${prompt}`);
  try {
    const url = `https://subnp.com/api/free/generate`;

    const response = await axios.post(url, { prompt }, {
      responseType: 'text'
    });

    const responseText = response.data;

    // The API returns a stream of JSON objects as a single text response.
    // We need to parse this text to find the relevant information.
    const lines = responseText.trim().split('\n');
    const jsonEvents = lines
      .map(line => line.replace(/^data: /, ''))
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          // Ignore lines that are not valid JSON.
          return null;
        }
      })
      .filter(Boolean); // Remove null entries.

    const errorEvent = jsonEvents.find(event => event.status === 'error');
    if (errorEvent) {
      // The API reported a specific error, so we'll use its message.
      throw new Error(errorEvent.message || 'Le service d\'images a échoué à générer une image.');
    }

    // Based on observed behavior, a successful generation includes an event with a 'url' field.
    const successEvent = jsonEvents.find(event => event.url);
    if (successEvent && successEvent.url) {
      // We found the image URL, now we download the image data.
      const imageResponse = await axios.get(successEvent.url, { responseType: 'arraybuffer' });
      return Buffer.from(imageResponse.data);
    } else {
      // If there's no error and no success event, the API's response is ambiguous.
      // We'll throw a generic error to the user.
      throw new Error('La réponse du service d\'images n\'a pas pu être traitée.');
    }

  } catch (error) {
    console.error("Erreur détaillée lors de la génération de l'image avec subnp:", {
        message: error.response ? error.response.data : error.message,
        prompt: prompt,
    });
    // Provide a user-friendly error message, hiding the implementation details.
    throw new Error("Le service de génération d'images est actuellement indisponible ou a rencontré une erreur.");
  }
}

module.exports = { generateImageFromPrompt };
