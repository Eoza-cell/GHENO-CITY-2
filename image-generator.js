const axios = require('axios');
const API_KEY = process.env.STABLE_HORDE_API_KEY || '0000000000';

// Helper function to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to check the status of a generation request
async function checkGenerationStatus(id) {
  try {
    const response = await axios.get(`https://stablehorde.net/api/v2/generate/status/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la vérification du statut pour l'ID ${id}:`, error.message);
    // If status check fails, retry after a delay
    await sleep(5000);
    return checkGenerationStatus(id);
  }
}


async function generateImageFromPrompt(prompt) {
    console.log(`[Stable Horde] Demande de génération d'image pour : ${prompt}`);
    try {
        // 1. Make the initial request to generate the image asynchronously
        const initialResponse = await axios.post(
            "https://stablehorde.net/api/v2/generate/async",
            {
                prompt: prompt,
                params: {
                    width: 512,
                    height: 512,
                    steps: 25,
                },
                nsfw: false,
                models: ["stable_diffusion"],
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "apikey": API_KEY,
                },
            }
        );

        const generationId = initialResponse.data.id;
        if (!generationId) {
            throw new Error("N'a pas pu obtenir l'ID de génération de Stable Horde.");
        }
        console.log(`[Stable Horde] ID de génération obtenu : ${generationId}`);

        // 2. Poll for the result
        let attempts = 0;
        const maxAttempts = 60; // Poll for a maximum of 5 minutes (60 * 5s)
        while (attempts < maxAttempts) {
            await sleep(5000); // Wait 5 seconds between checks
            const status = await checkGenerationStatus(generationId);

            if (status.done) {
                console.log(`[Stable Horde] Génération terminée pour l'ID : ${generationId}`);
                if (status.generations && status.generations.length > 0) {
                    const imgBase64 = status.generations[0].img;
                    const imageBuffer = Buffer.from(imgBase64, "base64");
                    return imageBuffer;
                } else {
                    throw new Error("La génération a été terminée par Stable Horde mais aucune image n'a été retournée.");
                }
            } else {
                const queuePosition = status.queue_position;
                const waitTime = status.wait_time;
                console.log(`[Stable Horde] En attente... Position dans la file : ${queuePosition}, Temps d'attente estimé : ${waitTime}s`);
            }
            attempts++;
        }
        throw new Error("La génération d'image a expiré après 5 minutes.");

    } catch (error) {
        console.error("Erreur détaillée lors de la génération de l'image avec Stable Horde:", {
            message: error.response ? error.response.data : error.message,
            prompt: prompt,
        });
        throw error;
    }
}

module.exports = { generateImageFromPrompt };
