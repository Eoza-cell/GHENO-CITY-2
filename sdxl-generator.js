const axios = require('axios');

/**
 * SDXL Generator for Aetherys
 * Specializes in "Techno-Fantasy 3D Game World" aesthetics.
 */
class SDXLGenerator {
    constructor() {
        this.baseUrl = "https://image.pollinations.ai/prompt/";
        this.defaultParams = "?model=flux&width=1024&height=1024&nologo=true";

        // The "Techno-Fantasy 3D" master style
        this.styleSuffix = ", techno-fantasy style, high-end 3D game world graphics, Unreal Engine 5 render, cinematic lighting, glowing mana circuits, cybernetic armor, hyper-detailed environments, 8k resolution, volumetric fog, intricate magic circles";
    }

    /**
     * Generates an image URL based on a prompt
     * @param {string} prompt
     * @returns {string} The URL of the generated image
     */
    generateImageUrl(prompt) {
        if (!prompt) return null;

        // Clean and prepare the prompt
        const cleanPrompt = prompt.replace(/[^\w\s]/gi, '').substring(0, 400);
        const styledPrompt = encodeURIComponent(cleanPrompt + this.styleSuffix);

        const finalUrl = `${this.baseUrl}${styledPrompt}${this.defaultParams}`;
        console.log(`[SDXL] Generated URL for: ${cleanPrompt.substring(0, 50)}...`);

        return finalUrl;
    }

    /**
     * Optional: Fetch the image as a buffer if direct URL doesn't work for some reason
     */
    async generateImageBuffer(prompt) {
        const url = this.generateImageUrl(prompt);
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
            return Buffer.from(response.data, 'binary');
        } catch (e) {
            console.error("[SDXL] Buffer generation failed:", e.message);
            return null;
        }
    }
}

module.exports = new SDXLGenerator();
