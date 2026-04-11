const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class ComfyUIClient {
    constructor(serverAddress = process.env.COMFYUI_URL || 'http://127.0.0.1:8188') {
        this.serverAddress = serverAddress.replace(/\/$/, '');
        this.baseAddress = this.serverAddress.replace(/^https?:\/\//, '');
        this.clientId = uuidv4();
        console.log(`[ComfyUI] Initialized client for server: ${this.serverAddress} (Client ID: ${this.clientId})`);
    }

    async queuePrompt(prompt) {
        const url = `${this.serverAddress}/prompt`;
        try {
            const response = await axios.post(url, {
                prompt,
                client_id: this.clientId
            });
            return response.data.prompt_id;
        } catch (error) {
            console.error(`[ComfyUI] Error queuing prompt at ${url}:`, error.response?.data || error.message);
            throw new Error(`Failed to queue prompt: ${error.message}`);
        }
    }

    async getHistory(promptId) {
        const url = `${this.serverAddress}/history/${promptId}`;
        const response = await axios.get(url);
        return response.data[promptId];
    }

    async getFile(filename, subfolder, type) {
        const url = `${this.serverAddress}/view`;
        const response = await axios.get(url, {
            params: { filename, subfolder, type },
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data);
    }

    async generateVideo(workflow, promptInjectionNodeId, prompt) {
        // Deep clone the workflow to avoid state contamination
        const workflowClone = JSON.parse(JSON.stringify(workflow));

        // Inject prompt into workflow
        if (workflowClone[promptInjectionNodeId]) {
            if (workflowClone[promptInjectionNodeId].inputs && workflowClone[promptInjectionNodeId].inputs.text !== undefined) {
                workflowClone[promptInjectionNodeId].inputs.text = prompt;
            } else if (workflowClone[promptInjectionNodeId].inputs && workflowClone[promptInjectionNodeId].inputs.prompt !== undefined) {
                workflowClone[promptInjectionNodeId].inputs.prompt = prompt;
            }
        }

        return new Promise((resolve, reject) => {
            const wsProtocol = this.serverAddress.startsWith('https') ? 'wss' : 'ws';
            const wsUrl = `${wsProtocol}://${this.baseAddress}/ws?clientId=${this.clientId}`;
            const ws = new WebSocket(wsUrl);

            let promptId = null;

            ws.on('open', async () => {
                try {
                    promptId = await this.queuePrompt(workflowClone);
                    console.log(`[ComfyUI] Prompt queued with ID: ${promptId}`);
                } catch (err) {
                    ws.close();
                    reject(err);
                }
            });

            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'executing') {
                        if (message.data.node === null && message.data.prompt_id === promptId) {
                            ws.close();

                            try {
                                const history = await this.getHistory(promptId);

                                // Find video output
                                for (const nodeId in history.outputs) {
                                    const output = history.outputs[nodeId];
                                    if (output.gifs && output.gifs.length > 0) {
                                        const videoInfo = output.gifs[0];
                                        resolve(await this.getFile(videoInfo.filename, videoInfo.subfolder, videoInfo.type));
                                        return;
                                    }
                                    if (output.videos && output.videos.length > 0) {
                                        const videoInfo = output.videos[0];
                                        resolve(await this.getFile(videoInfo.filename, videoInfo.subfolder, videoInfo.type));
                                        return;
                                    }
                                }
                                reject(new Error('No video output found in ComfyUI history'));
                            } catch (historyErr) {
                                reject(historyErr);
                            }
                        }
                    }
                } catch (e) {
                    // Ignore binary previews
                }
            });

            ws.on('error', (err) => {
                ws.close();
                reject(err);
            });

            // Timeout after 10 minutes
            setTimeout(() => {
                ws.close();
                reject(new Error('Timeout waiting for ComfyUI execution'));
            }, 600000);
        });
    }
}

module.exports = ComfyUIClient;
