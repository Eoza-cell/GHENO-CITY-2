const ComfyUIClient = require('./comfyui-client');
const fs = require('fs');
const path = require('path');

// Default workflow for text-to-video.
// In a real scenario, this would be a complex JSON exported from ComfyUI (API format).
// For now, we'll try to use a placeholder or load from a file if it exists.
let defaultWorkflow = null;
const workflowPath = path.join(__dirname, 'assets', 'workflows', 't2v_workflow.json');

try {
    if (fs.existsSync(workflowPath)) {
        defaultWorkflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    }
} catch (error) {
    console.error('[Video Generator] Error loading workflow:', error.message);
}

/**
 * Generates a video from a text prompt using a ComfyUI instance.
 * @param {string} prompt The text prompt for the video.
 * @returns {Promise<Buffer>} The video data as a buffer.
 */
async function generateVideoFromPrompt(prompt) {
    console.log(`[Video Generator] Generating video via ComfyUI for: ${prompt}`);

    if (!defaultWorkflow) {
        console.warn('[Video Generator] No ComfyUI workflow found. Falling back to old implementation or throwing error.');
        // If no workflow is provided, we can't use ComfyUI properly.
        // For the sake of this task, I'll assume the user wants the structure ready.
        throw new Error("ComfyUI workflow not configured. Please add a valid API JSON in assets/workflows/t2v_workflow.json");
    }

    try {
        const client = new ComfyUIClient();
        // Assuming node "6" is the CLIPTextEncode for the positive prompt in a standard workflow
        // or whatever node ID is appropriate for the configured workflow.
        // We might want to make this configurable in the workflow JSON metadata.
        const promptNodeId = defaultWorkflow._meta?.promptNodeId || "6";

        const videoBuffer = await client.generateVideo(defaultWorkflow, promptNodeId, prompt);
        return videoBuffer;
    } catch (error) {
        console.error("[Video Generator] Error generating video via ComfyUI:", error.message);
        throw error;
    }
}

module.exports = { generateVideoFromPrompt };
