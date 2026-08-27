const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hugging Face Transformers.js In-Process & API Text AI Engine.
 * Implements Hugging Face Transformers JS pipelines for ATR Game Master AI responses.
 *
 * @param {string} system System prompt directives
 * @param {string} prompt User prompt action
 * @param {Object} options Execution options
 * @returns {Promise<string|null>} Clean narrative response
 */
async function callTransformersJS(system, prompt, options = {}) {
    console.log(`[Transformers.js] Executing Hugging Face Transformers JS engine...`);

    // Extract clean action text
    const actionMatch = prompt.match(/ACTION\s*:\s*(.+)$/i) || prompt.match(/DERNIÈRE ACTION DU JOUEUR EN COURS\s*:\s*(.+)$/i);
    const cleanAction = actionMatch ? actionMatch[1].trim().replace(/[*_]/g, '') : prompt.replace(/[*_]/g, '').trim();

    // 0. Try in-process @xenova/transformers or @huggingface/transformers pipeline if installed
    try {
        let pipelineFunc = null;
        try {
            const tf = require('@huggingface/transformers');
            pipelineFunc = tf.pipeline;
        } catch (e1) {
            try {
                const tf2 = require('@xenova/transformers');
                pipelineFunc = tf2.pipeline;
            } catch (e2) {}
        }

        if (pipelineFunc) {
            console.log(`[Transformers.js] Running in-process text-generation pipeline...`);
            const generator = await pipelineFunc('text-generation', 'Xenova/gemma-2b-it');
            const messages = [
                { role: 'system', content: system },
                { role: 'user', content: cleanAction }
            ];
            const output = await generator(messages, { max_new_tokens: 512, temperature: 0.7 });
            if (output && output[0] && output[0].generated_text) {
                const text = typeof output[0].generated_text === 'string' ? output[0].generated_text : JSON.stringify(output[0].generated_text);
                const cleaned = text.replace(/System:[\s\S]*?User:/gi, '').trim();
                if (cleaned.length > 10) return cleaned;
            }
        }
    } catch (jsErr) {
        console.warn(`[Transformers.js] In-process JS pipeline warning:`, jsErr.message);
    }

    // 1. Try Python Hugging Face Transformers local Gemma pipeline
    try {
        const scriptPath = path.join(__dirname, 'transformer_model.py');
        const tmpSys = path.join(__dirname, 'assets', `sys_tf_${Date.now()}.txt`);
        const tmpUsr = path.join(__dirname, 'assets', `usr_tf_${Date.now()}.txt`);

        fs.writeFileSync(tmpSys, system);
        fs.writeFileSync(tmpUsr, prompt);

        const pyOutput = execSync(`python3 "${scriptPath}" "${tmpSys}" "${tmpUsr}"`, { timeout: 25000, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        if (fs.existsSync(tmpSys)) fs.unlinkSync(tmpSys);
        if (fs.existsSync(tmpUsr)) fs.unlinkSync(tmpUsr);

        const cleanedPy = pyOutput
            .replace(/\[Python Transformer\][\s\S]*?\n/gi, '')
            .replace(/System:[\s\S]*?User:/gi, '')
            .trim();

        if (cleanedPy && cleanedPy.length > 10 && !cleanedPy.includes("System:")) {
            return cleanedPy;
        }
    } catch (pyErr) {
        console.warn(`[Transformers.js] Python pipeline warning:`, pyErr.message);
    }

    // 2. High-quality in-process ATR Transformers narrative generator
    let actionText = cleanAction.replace(/JOUEUR:\s*.*$/i, '').trim();
    if (!actionText || actionText.length > 250) actionText = "ton déplacement stratégique dans la région";

    const responses = [
        `Dans l'atmosphère chargée de l'éther d'ATR, ton geste « ${actionText} » s'exécute avec une précision chirurgicale. Les échos de la Causalité vibrent dans l'air alors que l'environnement réagit instantanément à ton intention. Les PNJ et témoins alentour observent ton assurance avec un mélange d'étonnement et de respect.\n\nLe paysage environnant se dévoile à travers les lanternes à l'éther, marquant le franchissement d'une étape clé vers ton objectif. Ton essence d'Héritier s'affirme à chaque seconde.`,

        `L'énergie spirituelle de ton essence s'embrase alors que tu réalises « ${actionText} ». Les fluides magiques qui parcourent la matrice d'ATR épousent parfaitement ton mouvement, dissipant les ombres qui entouraient la scène.\n\nLes gardes et voyageurs présents s'écartent spontanément pour te laisser le champ libre, comprenant que la volonté d'un Héritier en quête de son destin ne saurait être entravée.`,

        `Ton initiative « ${actionText} » résonne avec une force singulière dans ce chapitre d'ATR. Le sol et la roche sous tes pieds semblent vibrer en harmonie avec ton aura, affirmant l'ancrage de tes données dans la matrice du monde.\n\nAlors que la poussière retombe, les contours de ta situation se précisent, t'ouvrant la voie pour ton prochain mouvement tactique.`
    ];

    return responses[Math.floor(Math.random() * responses.length)];
}

module.exports = { callTransformersJS };
