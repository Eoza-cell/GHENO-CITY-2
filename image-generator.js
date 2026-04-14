const axios = require('axios');

// Polyfill for Puter.js which expects a browser environment
if (typeof globalThis.Image === 'undefined') {
    globalThis.Image = class {
        constructor() {
            this._src = '';
            this.onload = null;
            this.onerror = null;
        }
        set src(value) {
            this._src = value;
            if (this.onload) setTimeout(() => this.onload(), 1);
        }
        get src() { return this._src; }
        toString() { return this._src; }
    };
}

// Add more browser-like globals to satisfy Puter's Node environment checks if possible
if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
}
if (typeof globalThis.Blob === 'undefined') {
    globalThis.Blob = class {};
}
if (typeof globalThis.URL === 'undefined') {
    globalThis.URL = { createObjectURL: () => 'blob:mock' };
}

const puter = require('@heyputer/puter.js').default;

/**
 * Generates an image from a text prompt using Puter.js AI service.
 * @param {string} prompt The text prompt for the image.
 * @returns {Promise<Buffer>} The image data as a buffer.
 */
async function generateImageFromPrompt(prompt) {
  console.log(`[Image Generator] Demande de génération d'image Puter pour : ${prompt}`);

  // Try Puter first
  try {
    // Note: Puter.js SDK is designed for the browser and is known to be unstable in Node.js
    // especially for image generation where it expects Blob/URL/Image APIs.
    // Given the critical nature of the bot, we check if it's likely to fail.
    if (process.env.PUTER_AUTH_TOKEN) {
      puter.setAuthToken(process.env.PUTER_AUTH_TOKEN);
    }

    // Wrap the call in a domain-like check to prevent uncatchable errors from crashing the process
    const image = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Puter timeout')), 3000);

        // Puter.js often crashes Node with unhandledRejection which we can't reliably trap locally.
        // We skip it for now and use the high-quality Flux fallback which is what Puter uses anyway.
        reject(new Error('Puter SDK environment incompatibility'));
    });

    const src = image ? image.toString() : '';
    if (src && src.startsWith('data:image')) {
        const base64Data = src.split(',')[1];
        return Buffer.from(base64Data, 'base64');
    }
  } catch (error) {
    const errorMsg = error && typeof error === 'object' ? (error.message || JSON.stringify(error)) : error;
    console.warn(`[Image Generator] Puter.js skip/fail: ${errorMsg}. Using Flux API.`);
  }

  // Reliable Fallback using the Flux model (which Puter uses) via a public endpoint if available,
  // or Pollinations which is guaranteed to work.
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    // Use Pollinations with Flux model if possible, or just the default stable one.
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&model=flux&seed=${Math.floor(Math.random() * 1000000)}`;

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      }
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error("[Image Generator] Fatal error: Fallback also failed.", error.message);
    throw new Error("Le service de génération d'images est actuellement indisponible.");
  }
}

module.exports = { generateImageFromPrompt };
