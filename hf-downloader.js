const { downloadFile } = require("@huggingface/hub");
const fs = require('fs');
const path = require('path');

/**
 * Downloads a model from Hugging Face.
 * Since GGUF is common for local LLMs, we target those if needed.
 */
async function downloadFromHF(repo, filename, destDir = './models') {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const destPath = path.join(destDir, filename);
    console.log(`[HF] Téléchargement de ${repo}/${filename} vers ${destPath}...`);

    try {
        const response = await downloadFile({
            repo: repo,
            path: filename,
        });

        if (!response.body) throw new Error("No body in response");

        const writer = fs.createWriteStream(destPath);
        const reader = response.body.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            writer.write(Buffer.from(value));
        }

        writer.end();
        console.log(`[HF] ✅ Téléchargement terminé !`);
        return destPath;
    } catch (err) {
        console.error(`[HF] ❌ Erreur de téléchargement:`, err.message);
        throw err;
    }
}

module.exports = { downloadFromHF };
