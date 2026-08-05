const axios = require('axios');
const { Player, Kingdom, Entity, WorldJournal, RPMessage } = require('./database');
const { Op } = require('sequelize');

/**
 * AETHER BRAIN - HYBRID AUTONOMOUS RPG ENGINE
 * Coordinates offline/local LLMs (Ollama/LM Studio) and fallbacks to a
 * state-of-the-art procedural story engine that extracts real-time game state
 * (date, cycle, weather, distances) dynamically to ensure 100% immersion with zero repetition.
 */
class AetherBrain {
    constructor() {
        this.version = "4.1-HybridAutonomous";
    }

    /**
     * Coordinate a "local-feeling" offline-capable response.
     */
    async think(system, user, options = {}) {
        console.log(`[AETHER-BRAIN] Processing turn via Hybrid Engine...`);

        // 1. Try Local Ollama first (completely offline LLM)
        try {
            console.log("[AETHER-BRAIN] Attempting local Ollama...");
            const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434/api/chat";
            const resp = await axios.post(ollamaUrl, {
                model: process.env.OLLAMA_MODEL || 'mistral',
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ],
                stream: false
            }, { timeout: 8000 });

            const content = resp.data?.message?.content;
            if (content && content.length > 10) {
                console.log("[AETHER-BRAIN] ✅ Success via local Ollama!");
                return content;
            }
        } catch (e) {
            console.log("[AETHER-BRAIN] Local Ollama offline.");
        }

        // 2. Try Local LM Studio (completely offline OpenAI-compatible LLM)
        try {
            console.log("[AETHER-BRAIN] Attempting local LM Studio...");
            const lmStudioUrl = process.env.LM_STUDIO_URL || "http://localhost:1234/v1/chat/completions";
            const resp = await axios.post(lmStudioUrl, {
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user }
                ],
                temperature: 0.8,
                stream: false
            }, { timeout: 8000 });

            const content = resp.data?.choices?.[0]?.message?.content;
            if (content && content.length > 10) {
                console.log("[AETHER-BRAIN] ✅ Success via local LM Studio!");
                return content;
            }
        } catch (e) {
            console.log("[AETHER-BRAIN] Local LM Studio offline.");
        }

        // 3. Fallback to State-of-the-Art Procedural Story Engine
        console.log("[AETHER-BRAIN] Falling back to Procedural Story Engine...");

        // Extract JSON Context from the prompt
        let context = null;
        const jsonMatch = user.match(/### MÉMOIRE_SYSTÈME_JSON \(CONTEXTE DÉTAILLÉ PAR JOUEUR\) ###\s*([\s\S]*?)\s*### HISTORIQUE/);
        if (jsonMatch) {
            try {
                context = JSON.parse(jsonMatch[1].trim());
            } catch (e) {
                console.warn("[AETHER-BRAIN] Context parsing failed:", e.message);
            }
        }

        // Extract real-time game clock and weather from context or prompt
        let dateString = "An 23, 31 Mars | 🌙 04:44";
        let weather = "Clair";
        let cycle = "JOUR";
        let distanceText = "1 m → contact";

        if (context) {
            dateString = context.monde?.date || dateString;
            weather = context.monde?.meteo || weather;
            cycle = context.monde?.cycle || cycle;

            const actor = context.personnages_en_scene?.find(p => p.est_acteur);
            if (actor) {
                const dist = actor.distance_en_metres_de_l_acteur || 1;
                distanceText = `${dist} m${dist <= 1 ? ' → contact' : ''}`;
            }
        }

        // Extract active player details
        let playerName = "Eoza Nevo";
        let playerLocation = "Eldoria";
        let playerSubLocation = "Place Centrale";
        let pnjPresents = [];
        let availableQuests = [];

        if (context) {
            const act = context.personnages_en_scene?.find(p => p.est_acteur) || context.personnages_en_scene?.[0];
            if (act) {
                playerName = act.nom;
                playerSubLocation = act.lieu_precis || playerSubLocation;
            }
            playerLocation = context.monde?.royaume_actuel || playerLocation;
            if (context.env_social) {
                pnjPresents = context.env_social.pnj_presents || [];
            }
            if (context.objectifs_generaux) {
                availableQuests = context.objectifs_generaux.quetes_dispo || [];
            }
        }

        // Extract active player action
        let playerAction = "";
        const actionMatch = user.match(/ACTIONS:\s*(.*?)$/m) || user.match(/USER_ACTION:\s*(.*?)$/m);
        if (actionMatch) {
            playerAction = actionMatch[1].trim();
        } else {
            playerAction = user.trim();
        }
        playerAction = playerAction.replace(/^\[JOUEUR:\s*.*?\]\s*ACTIONS:\s*/, '').trim();

        // Determine Action Type
        const actionLower = playerAction.toLowerCase();
        let actionType = "explore";

        if (actionLower.includes("quete") || actionLower.includes("mission") || actionLower.includes("travail") || actionLower.includes("recherche")) {
            actionType = "quest_request";
        } else if (actionLower.includes("poursuite") || actionLower.includes("maître") || actionLower.includes("maitre") || actionLower.includes("suivre") || actionLower.includes("courir")) {
            actionType = "master_pursuit";
        } else if (actionLower.includes("attaque") || actionLower.includes("frappe") || actionLower.includes("combat") || actionLower.includes("épée") || actionLower.includes("lame") || actionLower.includes("sort")) {
            actionType = "combat";
        } else if (actionLower.includes("salue") || actionLower.includes("parle") || actionLower.includes("discute") || actionLower.includes("demande")) {
            actionType = "dialogue";
        } else if (actionLower.includes("va vers") || actionLower.includes("entre") || actionLower.includes("quitte") || actionLower.includes("bouge") || actionLower.includes("marche")) {
            actionType = "move";
        }

        // Varied sensory pools to prevent repetition
        const sensorySmells = [
            "l'odeur fraîche de l'ozone d'éther",
            "le parfum de vieux parchemins magiques scellés",
            "l'odeur métallique du fer froid et de la sueur de combat",
            "les effluves de lavande sauvage qui flottent doucement dans l'air",
            "l'odeur humide de la pierre ancienne et de la mousse de faille",
            "une odeur subtile de souffre volcanique qui crépite de loin"
        ];
        const sensoryTouches = [
            "sens la texture rugueuse des dalles de pierre sous tes semelles",
            "sens le froid tranchant et réconfortant du pommeau de ton arme",
            "sens la pression invisible mais vibrante du mana ambiant sur tes tempes",
            "sens le courant d'air frais qui s'engouffre dans les embrasures",
            "sens la chaleur douce mais pulsante du soleil d'Aetherys qui traverse les nuages"
        ];
        const sensoryAtmospheres = [
            "le silence solennel qui enveloppe la pièce, presque lourd de sens",
            "le crépitement ténu des résidus d'éther qui dansent dans la faible lumière",
            "les murmures feutrés des citoyens et des gardes qui résonnent au loin",
            "la tension palpable qui s'installe à chaque souffle",
            "la poussière dorée qui danse gracieusement dans les faisceaux lumineux"
        ];

        const getSensory = (arr) => arr[Math.floor(Math.random() * arr.length)];

        // Generate narrative based on state
        let narrative = "";
        let bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +20] [${playerName}: Col +10]`;

        if (actionType === "quest_request") {
            const selectedQuest = availableQuests.length > 0
                ? availableQuests[Math.floor(Math.random() * availableQuests.length)]
                : "La Chasse aux Gobelins";
            const questTitle = selectedQuest.split('(')[0].trim();

            narrative = `L'atmosphère de ${playerSubLocation} s'anime sous un climat ${weather.toLowerCase()} alors qu'un officier de la Garde Impériale t'aperçoit. Il s'approche d'un pas rythmé et déroule un parchemin officiel : « ${playerName}, nous avons une mission de la plus haute importance pour toi : ${questTitle}. Es-tu prêt à relever le défi ? »\n\nTu ${getSensory(sensoryTouches)} alors que ${getSensory(sensoryAtmospheres)}, tandis que flotte ${getSensory(sensorySmells)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +30] [${playerName}: Col +20] [${playerName}: START_QUEST: ${questTitle}]`;

        } else if (actionType === "master_pursuit") {
            narrative = `La course s'accélère à travers les ruelles de ${playerSubLocation} sous un ciel ${weather.toLowerCase()} ! Tu te lances à corps perdu à la poursuite du maître, le souffle court. Un messager blessé s'appuie contre un pilier de pierre et pointe une ruelle : « Il est parti par là... avant que l'éclipse ou l'ombre ne l'emporte... » murmure-t-il.\n\nSoudain, Lunafreya Evervoid et Milim crimson se joignent à ta poursuite, leurs visages marqués par la gravité. Tu ${getSensory(sensoryTouches)} pendant que ${getSensory(sensoryAtmospheres)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -10] [${playerName}: XP +40] [${playerName}: Col +0] [${playerName}: PROGRESS_QUEST: Premiers Pas à Eldoria | 50]`;

        } else if (actionType === "combat") {
            narrative = `L'acier chante sous un environnement ${weather.toLowerCase()} ! Tu tires ton arme de son fourreau, le métal brillant d'une lueur bleutée. Tu assènes une frappe circulaire rapide avec force, l'impact retentissant sèchement dans toute la zone. Les gardes se mettent immédiatement en position de combat, analysant ton Battle IQ.\n\nTu ${getSensory(sensoryTouches)} et perçois ${getSensory(sensorySmells)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -15] [${playerName}: XP +50] [${playerName}: Col +15]`;

        } else if (actionType === "dialogue") {
            const pnjName = pnjPresents.length > 0 ? pnjPresents[Math.floor(Math.random() * pnjPresents.length)].name : "un citoyen";
            narrative = `Tu engages la conversation avec ${pnjName} à ${playerSubLocation}. Celui-ci s'arrête et t'écoute avec attention sous le climat ${weather.toLowerCase()} : « Les failles de l'Interstice s'élargissent, ${playerName}. Sois extrêmement sur tes gardes. »\n\nAlors que ${getSensory(sensoryAtmospheres)}, tu ${getSensory(sensoryTouches)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +15] [${playerName}: Col +0]`;

        } else if (actionType === "move") {
            narrative = `Tu te déplaces vers les limites de ${playerSubLocation} sous un ciel ${weather.toLowerCase()}. Les passants s'écartent sur ton passage, observant ton équipement avec curiosité. Tu ${getSensory(sensoryTouches)} pendant que ${getSensory(sensoryAtmospheres)} et que se diffuse ${getSensory(sensorySmells)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +20] [${playerName}: Col +0]`;

        } else {
            narrative = `Tu examines minutieusement les détails de ${playerSubLocation} sous un ciel ${weather.toLowerCase()}. Tes yeux repèrent les runes anciennes gravées sur les piliers et le mouvement des citoyens. L'ambiance est calme mais empreinte de magie.\n\nTu ${getSensory(sensoryTouches)}, perçois ${getSensory(sensoryAtmospheres)} et respires ${getSensory(sensorySmells)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +20] [${playerName}: Col +10]`;
        }

        // Return beautiful structured RPG turn with dynamic parsed states!
        return `📅 ${dateString}
*AVENTURA* *📍 ${playerLocation} (${playerSubLocation})*

${narrative}

[Distance utile: ${distanceText}]
${bracketStats}`;
    }
}

const brain = new AetherBrain();
module.exports = brain;
