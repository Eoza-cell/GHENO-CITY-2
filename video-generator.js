const { Client } = require("@gradio/client");
const axios = require("axios");

/**
 * Generates a video from a text prompt using the Omni-Video-Factory on Hugging Face.
 * @param {string} prompt The text prompt for the video.
 * @returns {Promise<Buffer>} The video data as a buffer.
 */
async function generateVideoFromPrompt(prompt) {
    console.log(`[Video Generator] Generating video for: ${prompt}`);
    try {
        const client = await Client.connect("FrameAI4687/Omni-Video-Factory");

        const result = await client.predict("/_submit_t2v", {
            scene_count: 1,
            seconds_per_scene: 3,
            resolution: 512,
            aspect_ratio: "9:16",
            base_prompt: prompt,
            s1: prompt,
            s2: "",
            s3: "",
            s4: "",
        });

        if (result.data && result.data[1] && result.data[1].video && result.data[1].video.url) {
            const videoUrl = result.data[1].video.url;
            console.log(`[Video Generator] Video generated at: ${videoUrl}`);

            const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            return Buffer.from(response.data);
        } else {
            throw new Error("Video generation failed or returned unexpected data structure.");
        }
    } catch (error) {
        console.error("[Video Generator] Error generating video:", error.message);
        throw error;
    }
}

module.exports = { generateVideoFromPrompt };
