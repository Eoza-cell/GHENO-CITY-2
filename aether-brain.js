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
        this.version = "4.2-HybridAutonomous";
    }

    /**
     * Coordinate a "local-feeling" offline-capable response.
     */
    async think(system, user, options = {}) {
        console.log(`[AETHER-BRAIN] Processing turn via Hybrid Engine...`);

        // 1. Try Local Ollama first (completely offline LLM - pointing to gemma4 for cutting-edge roleplay)
        try {
            console.log("[AETHER-BRAIN] Attempting local Ollama...");
            const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434/api/chat";
            const resp = await axios.post(ollamaUrl, {
                model: process.env.OLLAMA_MODEL || 'gemma4',
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

        // 3. Try Hugging Face Inference API for google/gemma-4-E4B (the highly optimized encoder-free multimodal Gemma 4 model)
        try {
            console.log("[AETHER-BRAIN] Attempting Hugging Face Inference for google/gemma-4-E4B...");
            const hfToken = process.env.HF_TOKEN || process.env.HF_API_KEY;
            const headers = { 'Content-Type': 'application/json' };
            if (hfToken) {
                headers['Authorization'] = `Bearer ${hfToken}`;
            }
            const resp = await axios.post("https://api-inference.huggingface.co/models/google/gemma-4-E4B", {
                inputs: `<bos><start_of_turn>user\nSYSTEM: ${system}\n\nUSER: ${user}<end_of_turn>\n<start_of_turn>model\n`
            }, { headers, timeout: 15000 });

            let content = "";
            if (Array.isArray(resp.data)) {
                content = resp.data[0]?.generated_text || "";
            } else if (resp.data?.generated_text) {
                content = resp.data.generated_text;
            } else {
                content = JSON.stringify(resp.data);
            }

            // Strip input prompt from Hugging Face output if included
            if (content.includes("<start_of_turn>model\n")) {
                content = content.split("<start_of_turn>model\n").pop();
            }
            content = content.replace(/<end_of_turn>/g, "").trim();

            if (content && content.length > 10) {
                console.log("[AETHER-BRAIN] ✅ Success via Hugging Face google/gemma-4-E4B!");
                return content;
            }
        } catch (e) {
            console.log("[AETHER-BRAIN] Hugging Face google/gemma-4-E4B offline or rate-limited, trying google/gemma-4-31B-it...");
            try {
                const hfToken = process.env.HF_TOKEN || process.env.HF_API_KEY;
                const headers = { 'Content-Type': 'application/json' };
                if (hfToken) {
                    headers['Authorization'] = `Bearer ${hfToken}`;
                }
                const resp = await axios.post("https://api-inference.huggingface.co/models/google/gemma-4-31B-it", {
                    inputs: `<bos><start_of_turn>user\nSYSTEM: ${system}\n\nUSER: ${user}<end_of_turn>\n<start_of_turn>model\n`
                }, { headers, timeout: 15000 });

                let content = "";
                if (Array.isArray(resp.data)) {
                    content = resp.data[0]?.generated_text || "";
                } else if (resp.data?.generated_text) {
                    content = resp.data.generated_text;
                } else {
                    content = JSON.stringify(resp.data);
                }

                if (content.includes("<start_of_turn>model\n")) {
                    content = content.split("<start_of_turn>model\n").pop();
                }
                content = content.replace(/<end_of_turn>/g, "").trim();

                if (content && content.length > 10) {
                    console.log("[AETHER-BRAIN] ✅ Success via Hugging Face google/gemma-4-31B-it!");
                    return content;
                }
            } catch (e2) {
                console.log("[AETHER-BRAIN] Hugging Face google/gemma-4-31B-it offline or rate-limited:", e2.message);
            }
        }

        // 4. Try Local Python Transformers script (google/gemma-2b-it / local open-source python LLM)
        try {
            console.log("[AETHER-BRAIN] Attempting local Python Transformers execution...");
            const { execSync } = require('child_process');
            // Escape prompts safely
            const sysEscaped = JSON.stringify(system);
            const userEscaped = JSON.stringify(user);

            const pythonOutput = execSync(`python transformer_model.py ${sysEscaped} ${userEscaped}`, {
                timeout: 30000,
                encoding: 'utf8'
            });

            if (pythonOutput && pythonOutput.includes("--- RESPONSE ---")) {
                const response = pythonOutput.split("--- RESPONSE ---")[1].split("----------------")[0].trim();
                if (response.length > 10) {
                    console.log("[AETHER-BRAIN] ✅ Success via local Python Transformers!");
                    return response;
                }
            }
        } catch (e) {
            console.log("[AETHER-BRAIN] Local Python Transformers offline or dependencies missing:", e.message);
        }

        // 5. Fallback to State-of-the-Art Procedural Story Engine
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

        // 4. Determine Action Type with highly robust regexes
        const actionLower = playerAction.toLowerCase();
        let actionType = "explore";

        const isMove = /(?:va|aller|pars|part|partir|dirige|diriger|marche|marcher|rejoins|rejoindre|rend|rendre|route|chemin|bouge|déplace|déplacer|poursuite|poursuivre|lance|élance|fuis|fuir|cours|courir)/i.test(actionLower);
        const isCombat = /(?:attaque|attaquer|frappe|frapper|combat|combattre|épée|lame|sort|lance|lancer|magie|arme|coup|tue|tuer|affronte|affronter|bataille|guerre)/i.test(actionLower);
        const isQuest = /(?:quête|quete|mission|travail|objectif)/i.test(actionLower);
        const isDialogue = /(?:parle|parler|discute|discuter|salue|saluer|demande|demander|dit|répond|répondre|interroge|interroger)/i.test(actionLower);

        if (isQuest) {
            actionType = "quest_request";
        } else if (isCombat) {
            actionType = "combat";
        } else if (isMove) {
            actionType = "move";
        } else if (isDialogue) {
            actionType = "dialogue";
        }

        // Extract destination if move
        let destination = "";
        const destMatch = playerAction.match(/(?:vers|dans|à|au|aux|en|pour|la|le|les|l')\s+([A-Za-zÀ-ÖØ-öø-ÿ0-9\s'-]{3,50})/i);
        if (destMatch) {
            destination = destMatch[1].trim();
        } else {
            // Check if user named any kingdom or sublocation
            const places = ["forêt", "palais", "citadelle", "taverne", "marché", "bureau", "donjon", "mine", "lac", "montagne", "désert", "nécropolis", "interstice"];
            const matchedPlace = places.find(p => actionLower.includes(p));
            if (matchedPlace) {
                destination = matchedPlace;
            }
        }

        // Sensory pools
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

        // 6. Narrative Generation based on Action Type
        let narrative = "";
        let bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +20] [${playerName}: Col +10]`;

        if (actionType === "quest_request") {
            const selectedQuest = availableQuests.length > 0
                ? availableQuests[Math.floor(Math.random() * availableQuests.length)]
                : "La Chasse aux Gobelins";
            const questTitle = selectedQuest.split('(')[0].trim();

            const dialogs = [
                `« Ah, ${playerName}, tu tombes à pic ! » s'exclame l'officier de la Garde en t'apercevant. « Un danger immédiat menace notre sécurité. Nous avons besoin de quelqu'un pour : ${questTitle}. Te sens-tu d'attaque ? »`,
                `Un messager s'approche en courant sous un climat ${weather.toLowerCase()} : « ${playerName} ! Le chancelier réclame ton aide pour la mission urgente : ${questTitle}. C'est une question de survie ! »`,
                `L'intendant impérial hoche la tête avec sérieux : « ${playerName}, nous avons une quête d'importance majeure pour toi : ${questTitle}. Les récompenses en pièces d'or et en prestige seront généreuses. »`
            ];
            const pnjSpeech = dialogs[Math.floor(Math.random() * dialogs.length)];

            narrative = `L'atmosphère de ${playerSubLocation} se charge de tension sous le ciel ${weather.toLowerCase()}. Les passants et les soldats s'affairent autour de toi. Soudain, un contact s'établit :\n\n${pnjSpeech}\n\nTu ${getSensory(sensoryTouches)} alors que ${getSensory(sensoryAtmospheres)}, tandis que flotte ${getSensory(sensorySmells)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +30] [${playerName}: Col +20] [${playerName}: START_QUEST: ${questTitle}]`;

        } else if (actionType === "move") {
            const targetDest = destination ? destination : "la Forêt des Gobelins";

            const moveIntros = [
                `D'un pas résolu, tu te mets immédiatement en route vers ${targetDest}. Tu laisses derrière toi l'atmosphère familière de ${playerSubLocation} pour t'avancer vers l'inconnu, l'esprit concentré sur ton objectif...`,
                `Sans perdre une seconde, tu t'élances activement en direction de ${targetDest}. Ton allure est rapide et déterminée, franchissant les obstacles physiques un à un alors que le décor commence à changer sous tes yeux...`,
                `Laissant tes pas se guider par ton instinct, tu entames ton déplacement vers ${targetDest}. L'air frais te fouette le visage à mesure que tu t'éloignes des zones sécurisées...`
            ];

            const moveOutros = [
                `Le paysage de ${playerLocation} s'efface peu à peu, remplacé par des sentiers plus sauvages et escarpés à l'approche de ta destination.`,
                `Les patrouilles de la milice s'estompent au loin, te laissant seul face aux mystères de ce nouveau territoire.`,
                `Tu sens que chaque mètre parcouru te rapproche des conflits actifs et des opportunités qui t'attendent.`
            ];

            const intro = moveIntros[Math.floor(Math.random() * moveIntros.length)];
            const outro = moveOutros[Math.floor(Math.random() * moveOutros.length)];

            narrative = `${intro}\n\nSous un ciel ${weather.toLowerCase()}, tu ${getSensory(sensoryTouches)}. ${outro}\n\nPercevant ${getSensory(sensoryAtmospheres)}, tu respires ${getSensory(sensorySmells)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +25] [${playerName}: Col +0] [new_sub_location: ${targetDest}]`;

        } else if (actionType === "combat") {
            const combatIntros = [
                `L'acier chante sous l'environnement ${weather.toLowerCase()} ! Tu tires ton arme de son fourreau, le métal brillant d'une lueur bleutée sous l'effet du mana. Tu assènes une frappe circulaire dévastatrice avec une précision mortelle !`,
                `Le choc est immédiat ! Faisant preuve d'un haut Battle IQ, tu lances ton assaut de plein fouet, canalisant ton flux d'éther magique à travers ton équipement pour terrasser la cible !`,
                `Tu passes à l'attaque sans aucune hésitation ! Tes appuis sont solides sur les dalles de ${playerSubLocation} alors que tu effectues une estoc ultra-rapide visant les points faibles de l'ennemi.`
            ];

            const combatOutros = [
                `L'impact retentit sèchement dans toute la zone, provoquant la stupeur des passants et des gardes qui se mettent aussitôt sur la défensive.`,
                `Une gerbe d'étincelles de mana s'élève dans l'air, témoignant de l'extrême létalité et de la violence brute du choc physique.`,
                `Le souffle du coup balaie la poussière environnante, tandis que tes adversaires reculent d'un pas, terrifiés par ta force.`
            ];

            const intro = combatIntros[Math.floor(Math.random() * combatIntros.length)];
            const outro = combatOutros[Math.floor(Math.random() * combatOutros.length)];

            narrative = `${intro} ${outro}\n\nTu ${getSensory(sensoryTouches)} et perçois ${getSensory(sensorySmells)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -15] [${playerName}: XP +50] [${playerName}: Col +15]`;

        } else if (actionType === "dialogue") {
            const pnjName = pnjPresents.length > 0 ? pnjPresents[Math.floor(Math.random() * pnjPresents.length)].name : "un citoyen important";

            const dialogs = [
                `Celui-ci s'arrête net, se tourne lentement vers toi et ajuste sa posture avec respect. D'un ton calme mais grave, il répond : « Les temps sont troubles, ${playerName}. Les anomalies de l'Interstice exigent toute notre attention. Ne baisse jamais ta garde. »`,
                `Le regard fixé sur toi, il esquisse un léger sourire mystérieux : « ${playerName}, les forces politiques et magiques d'Eldoria sont en mouvement constant. Sois attentif aux signes de causalité autour de toi. »`,
                `S'approchant à pas feutrés, il te murmure à voix basse : « Prends garde à ceux qui t'observent dans l'ombre. L'Empereur et la milice ne toléreront aucun faux pas dans les quartiers de la ville. »`
            ];
            const responseText = dialogs[Math.floor(Math.random() * dialogs.length)];

            narrative = `Tu t'adresses directement à ${pnjName} à ${playerSubLocation} sous le ciel ${weather.toLowerCase()}.\n\n${responseText}\n\nAlors que ${getSensory(sensoryAtmospheres)}, tu ${getSensory(sensoryTouches)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +15] [${playerName}: Col +0]`;

        } else {
            // General Explore / Inspect
            const exploreIntros = [
                `Tu observes attentivement chaque recoin de ${playerSubLocation} sous un climat ${weather.toLowerCase()}. Tes yeux repèrent les runes anciennes gravées sur les piliers et le mouvement des citoyens.`,
                `Tu prends le temps d'inspecter l'environnement immédiat de ${playerSubLocation}. L'architecture de ${playerLocation} s'impose à tes yeux avec une splendeur solennelle et chargée d'histoire.`,
                `Tu scrutes activement les alentours à l'affût du moindre détail ou d'indices cachés. Les murmures de la foule se propagent doucement sous le ciel ${weather.toLowerCase()}.`
            ];
            const intro = exploreIntros[Math.floor(Math.random() * exploreIntros.length)];

            narrative = `${intro}\n\nL'ambiance est calme mais empreinte de magie. Tu ${getSensory(sensoryTouches)}, perçois ${getSensory(sensoryAtmospheres)} et respires ${getSensory(sensorySmells)}.`;
            bracketStats = `[${playerName}: HP -0] [${playerName}: MP -0] [${playerName}: XP +20] [${playerName}: Col +10]`;
        }

        // Proactive Consciousness Brackets trigger logic
        let proactiveBrackets = "";
        if (actionLower.includes("ajoute") || actionLower.includes("crée") || actionLower.includes("cree") || actionLower.includes("spawn pnj") || actionLower.includes("spawn garde") || actionLower.includes("garde")) {
            const pnjName = `Garde d'Élite #${Math.floor(Math.random() * 900 + 100)}`;
            proactiveBrackets += ` [SPAWN_NPC: ${pnjName} | Garde Impérial | Protection | Un fier garde en armure d'acier étincelante invoqué de manière proactive par la Conscience d'Aetherys]`;
        }
        if (actionLower.includes("gobelin") || actionLower.includes("goblin") || actionLower.includes("monstre") || actionLower.includes("ennemi") || actionLower.includes("spawn gobelin")) {
            const monsterName = `Gobelin Pilleur #${Math.floor(Math.random() * 9000 + 1000)}`;
            proactiveBrackets += ` [SPAWN_MONSTER: ${monsterName} | E | 60 | 14 | 6 | 12]`;
        }
        if (actionLower.includes("annonce") || actionLower.includes("annoncer") || actionLower.includes("crie") || actionLower.includes("crier") || actionLower.includes("proclame") || actionLower.includes("proclamer")) {
            const quoteMatch = playerAction.match(/"([^"]+)"/) || playerAction.match(/«([^»]+)»/);
            const msgText = quoteMatch ? quoteMatch[1] : `${playerName} élève la voix pour proclamer ses exploits sur ${playerSubLocation} !`;
            proactiveBrackets += ` [ANNONCE: ${msgText}]`;
        }

        if (proactiveBrackets) {
            bracketStats += proactiveBrackets;
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
