const axios = require('axios');
const FormData = require('form-data');

/**
 * Generates an image using the ImagineArt API.
 * @param {string} prompt - The text prompt to generate the image from.
 * @returns {Promise<Buffer|null>} - A promise that resolves to the image buffer, or null if an error occurs.
 */
async function generateImage(prompt) {
    const apiKey = process.env.IMAGINE_ART_API_KEY;

    if (!apiKey) {
        console.error("IMAGINE_ART_API_KEY is not set in the environment variables.");
        return null;
    }

    try {
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("style", "photorealistic"); // Using a style that fits the fantasy theme
        formData.append("aspect_ratio", "1:1");

        const response = await axios.post("https://api.vyro.ai/v2/image/generations", formData, {
            headers: {
                ...formData.getHeaders(),
                "Authorization": `Bearer ${apiKey}`,
            },
            responseType: 'arraybuffer', // Important to get the image data as a buffer
        });

        return Buffer.from(response.data, 'binary');

    } catch (error) {
        console.error("Error generating image with ImagineArt API:", {
            message: error.message,
            status: error.response ? error.response.status : 'N/A',
            data: error.response ? error.response.data.toString() : 'N/A' // Convert buffer to string for logging
        });
        return null;
    }
}

module.exports = { generateImage };
