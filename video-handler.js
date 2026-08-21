const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Generates an animated video clip from a text prompt or image using Hugging Face Transformers
 * Text-to-Video models (e.g., THUDM/CogVideoX-5b, Wan-AI/Wan2.1-T2V-14B) with resilient fallbacks.
 *
 * @param {string} prompt Video description prompt (e.g. "An anime warrior swinging a fiery sword in 8k")
 * @returns {Promise<Buffer|null>} Video buffer (mp4/webm) or null if generation fails
 */
async function generateHuggingFaceVideo(prompt) {
    const shonenVideoBooster = "anime animated scene, studio ufotable MAPPA animation, 60fps cinematic video, highly detailed anime motion visual";
    const polishedPrompt = `${prompt}, ${shonenVideoBooster}`;

    console.log(`[HF Video] Generating video clip for prompt: "${prompt.substring(0, 80)}..."`);

    // 0. Try Hugging Face Inference API text-to-video models if token is present
    if (process.env.HF_TOKEN) {
        const videoModels = [
            "THUDM/CogVideoX-5b",
            "ali-vilab/i2vgen-xl",
            "damo-vilab/text-to-video-ms-1.7b"
        ];

        for (const model of videoModels) {
            try {
                console.log(`[HF Video] Requesting video from Hugging Face Model Hub (${model})...`);
                const response = await axios.post(
                    `https://api-inference.huggingface.co/models/${model}`,
                    { inputs: polishedPrompt },
                    {
                        headers: {
                            Authorization: `Bearer ${process.env.HF_TOKEN}`,
                            "Content-Type": "application/json"
                        },
                        responseType: 'arraybuffer',
                        timeout: 45000
                    }
                );

                if (response.data && response.data.byteLength > 10000) {
                    console.log(`[HF Video] Successfully generated video from ${model}! Size: ${response.data.byteLength} bytes.`);
                    return Buffer.from(response.data);
                }
            } catch (e) {
                console.warn(`[HF Video] Model ${model} failed:`, e.message);
            }
        }
    }

    // 1. Pollinations / Luma video fallback API
    try {
        console.log(`[HF Video] Requesting video from Pollinations Video API...`);
        const encoded = encodeURIComponent(polishedPrompt);
        const seed = Math.floor(Math.random() * 1000000);
        const videoUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=576&model=flux&nologo=true&seed=${seed}`;

        // Fetch generated keyframe and convert to 3-second MP4 loop using ffmpeg if installed
        const imgResponse = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 25000 });
        if (imgResponse.data && imgResponse.data.byteLength > 1000) {
            const tmpImg = path.join(__dirname, 'assets', `v_frame_${Date.now()}.png`);
            const tmpVid = path.join(__dirname, 'assets', `v_out_${Date.now()}.mp4`);
            fs.writeFileSync(tmpImg, Buffer.from(imgResponse.data));

            try {
                execSync(`ffmpeg -y -loop 1 -i "${tmpImg}" -c:v libx264 -t 3 -pix_fmt yuv420p "${tmpVid}"`, { stdio: 'ignore', timeout: 15000 });
                if (fs.existsSync(tmpVid)) {
                    const vidBuf = fs.readFileSync(tmpVid);
                    fs.unlinkSync(tmpImg);
                    fs.unlinkSync(tmpVid);
                    return vidBuf;
                }
            } catch (ffErr) {
                if (fs.existsSync(tmpImg)) fs.unlinkSync(tmpImg);
            }
        }
    } catch (err) {
        console.error(`[HF Video] Video generation failed:`, err.message);
    }

    return null;
}

module.exports = { generateHuggingFaceVideo };
