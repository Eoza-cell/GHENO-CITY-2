"use strict";

// Runtime bridge: makes Puter the primary callAI provider without rewriting the
// large legacy ai-utils.js file. Enable with NODE_OPTIONS=--require ./puter-preload.js
// (Render: add NODE_OPTIONS as an environment variable).

const Module = require("module");
const originalLoad = Module._load;
const { callPuterPrimary } = require("./puter-primary-provider");

let installed = false;

Module._load = function patchedModuleLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);

    if (!installed && /(?:^|[\\/])ai-utils(?:\.js)?$/.test(request)) {
        installed = true;
        if (loaded && typeof loaded.callAI === "function") {
            const legacyCallAI = loaded.callAI;

            loaded.callAI = async function puterFirstCallAI(systemPrompt, userPrompt, options = {}) {
                const primary = await callPuterPrimary(systemPrompt, userPrompt, options);
                if (primary) return primary;

                console.warn("[AI] Puter primary unavailable; falling back to legacy AI provider chain.");
                return legacyCallAI(systemPrompt, userPrompt, options);
            };

            console.log("[AI] Puter runtime bridge installed: Puter is now primary.");
        }
    }

    return loaded;
};
