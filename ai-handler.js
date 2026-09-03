const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, WorldJournal, Monster, Entity, Club, Pact, House, Duel, TournamentParticipant } = require('./database');
const { buildSceneVisual } = require('./world-visuals');
const { sendWithImage, shouldNotifyPlayer } = require('./message-handler');
const { generatePaperImage } = require('./paper-generator');
const { generateBlackboardImage } = require('./blackboard-generator');
const { generate3DVisual } = require('./three-renderer');
const { generateActionVisual } = require('./action-visual-generator');
const { generateProfileCard } = require('./profile-generator');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');
const questUtils = require('./quest-utils');
const { processActions } = require('./action-processor');
const { checkLevelUp } = require('./level-utils');
const { isDay, getWeather } = require('./game-state');
const { getRPTime, getWorldHeader } = require('./world-clock');
const { getNarrativeContext, formatMemoryContext, rememberValidatedAction } = require('./upstash-memory');

/**
 * Searches Google Images for an anime representation of a technique name,
 * with a high-speed Pollinations AI image generation fallback if blocked or unsuccessful.
 */
async function fetchTechniqueImage(techniqueName) {
    const axios = require('axios');
    const query = encodeURIComponent(`${techniqueName} anime skill visual effect`);
    const fallbackGoogleUrl = `https://www.google.com/search?q=${query}&tbm=isch`;

    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    ];

    try {
        console.log(`[Google Images] Searching for technique: ${techniqueName}`);
        const response = await axios.get(fallbackGoogleUrl, {
            headers: {
                'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 5000
        });

        const html = response.data;
        const imgRegex = /src="([^"]+)"/g;
        let match;
        const urls = [];
        while ((match = imgRegex.exec(html)) !== null) {
            const url = match[1];
            if (url.startsWith('http') && !url.includes('googlelogo') && !url.includes('gif')) {
                urls.push(url);
            }
        }

        if (urls.length > 0) {
            const targetUrl = urls[Math.min(urls.length - 1, 1)];
            console.log(`[Google Images] Found URL: ${targetUrl}`);
            const imgBuf = await axios.get(targetUrl, { responseType: 'arraybuffer', timeout: 5000 });
            return Buffer.from(imgBuf.data);
        }
    } catch (err) {
        console.error(`[Google Images] Error scraping images for ${techniqueName}:`, err.message);
    }

    // Attempt Hugging Face Image Generation first (supporting local-feeling/API-based adventure illustrations)
    try {
        console.log(`[Hugging Face] Generating image for "${techniqueName}"...`);
        const hfToken = process.env.HF_TOKEN || process.env.HF_API_KEY;
        const headers = { 'Content-Type': 'application/json' };
        if (hfToken) {
            headers['Authorization'] = `Bearer ${hfToken}`;
        }
        const promptText = `epic high resolution anime illustration of the technique called "${techniqueName}", glowing energy, masterpiece art`;
        const resp = await axios.post("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", {
            inputs: promptText
        }, {
            headers,
            responseType: 'arraybuffer',
            timeout: 8000
        });
        if (resp.status === 200 && resp.data) {
            console.log(`[Hugging Face] ✅ Success generating image!`);
            return Buffer.from(resp.data);
        }
    } catch (hfErr) {
        console.warn(`[Hugging Face] Image generation failed, falling back to Pollinations:`, hfErr.message);
    }

    try {
        console.log(`[Hugging Face] Generating image for "${techniqueName}" via Hugging Face...`);
        const cleanPrompt = `high resolution epic anime illustration of the technique called "${techniqueName}", glowing energy, spectacular visual effects, dramatic combat stance, masterpiece art`;
        const { generateHuggingFaceImage } = require('./message-handler');
        return await generateHuggingFaceImage(cleanPrompt);
    } catch (pErr) {
        console.error(`[Hugging Face Fallback] Technique generation failed:`, pErr.message);
    }

    return null;
}

/**
 * Helper to fuzzy-match player names, stripping out symbols, @mentions, spaces, and punctuation.
 */
function findMatchingPlayer(targetName, player, nearbyPlayers) {
    if (!targetName) return null;
    const clean = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const targetClean = clean(targetName);
    if (!targetClean) return null;

    if (clean(player.name).includes(targetClean) || targetClean.includes(clean(player.name))) {
        return player;
    }

    for (const p of nearbyPlayers) {
        const pClean = clean(p.name);
        if (pClean.includes(targetClean) || targetClean.includes(pClean)) {
            return p;
        }
    }
    return null;
}

/**
 * Robustly parses stat updates and save commands from pure-text AI narratives.
 * Format examples: [SINGAM II: HP -18] [HP -18] [XP +50] [Col +100] /save HP -18
 */
async function parseStatsFromText(text, player, nearbyPlayers, sock, jid) {
    const updates = [];
    const playersToUpdate = new Set();
    const feedbackList = [];
    const lowerText = text.toLowerCase();

    // Normalize stat names helper
    const normalizeStat = (s) => {
        const u = s.toUpperCase();
        if (['XP', 'EXP', 'EXPERIENCE'].includes(u)) return 'XP';
        if (['COL', 'GOLD', 'OR'].includes(u)) return 'COL';
        if (['HP', 'PV', 'VIE'].includes(u)) return 'HP';
        if (['MP', 'PM', 'MANA'].includes(u)) return 'MP';
        if (['SP'].includes(u)) return 'SP';
        return u;
    };

    // 1) Named stats inside brackets or pipes: [PlayerName: STAT +/- VALUE] or [foo | PlayerName: STAT +/- VALUE]
    // e.g. [SINGAM II: HP -18] or [E.L.King: EXP +750] or [E.L.King: GOLD +950]
    const namedRegex = /(?:[\[|]|^|\s)([A-Za-z0-9\s\-_.]+?)\s*:\s*(HP|PV|VIE|MP|PM|MANA|XP|EXP|EXPERIENCE|Col|GOLD|OR|SP)\s*([+-]\s*\d+)/gi;
    let match;
    while ((match = namedRegex.exec(text)) !== null) {
        const targetName = match[1].trim();
        const statName = normalizeStat(match[2].trim());
        const value = parseInt(match[3].replace(/\s+/g, ''));

        const targetPlayer = findMatchingPlayer(targetName, player, nearbyPlayers);
        if (targetPlayer) {
            updates.push({ player: targetPlayer, stat: statName, value });
        }
    }

    // 2) Unnamed stats inside brackets: [STAT +/- VALUE]
    // e.g. [HP -18] or [EXP +750]
    const unnamedRegex = /\[\s*(HP|PV|VIE|MP|PM|MANA|XP|EXP|EXPERIENCE|Col|GOLD|OR|SP)\s*([+-]\s*\d+)/gi;
    while ((match = unnamedRegex.exec(text)) !== null) {
        const statName = normalizeStat(match[1].trim());
        const value = parseInt(match[2].replace(/\s+/g, ''));

        // Avoid double-counting if this was already captured as a named stat
        const isDuplicate = updates.some(u => u.player.whatsappId === player.whatsappId && u.stat === statName && u.value === value);
        if (!isDuplicate) {
            updates.push({ player, stat: statName, value });
        }
    }

    // 3) Support loose text-based "/save STAT +/- VALUE" commands
    const saveRegex = /\/save\s+(?:([A-Za-z0-9\s\-_.]+?)\s*:\s*)?(HP|PV|VIE|MP|PM|MANA|XP|EXP|EXPERIENCE|Col|GOLD|OR|SP)\s*([+-]\s*\d+)/gi;
    while ((match = saveRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim() : null;
        const statName = normalizeStat(match[2].trim());
        const value = parseInt(match[3].replace(/\s+/g, ''));

        let targetPlayer = targetName ? findMatchingPlayer(targetName, player, nearbyPlayers) : player;
        if (!targetPlayer) targetPlayer = player;

        updates.push({ player: targetPlayer, stat: statName, value });
    }

    // 3.5) ITEM_ADD parsing: [PlayerName: ITEM_ADD: Item1 x2, Item2] or [ITEM_ADD: Item1]
    const itemAddRegex = /\[\s*(?:([A-Za-z0-9\s\-_.]+?)\s*:\s*)?(?:ITEM_ADD|ITEMS?|OBJET_AJOUT)\s*:\s*(.+?)\s*\]/gi;
    while ((match = itemAddRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim() : null;
        const itemStr = match[2].trim();

        let targetPlayer = targetName ? findMatchingPlayer(targetName, player, nearbyPlayers) : player;
        if (!targetPlayer) targetPlayer = player;

        const itemsList = itemStr.split(',').map(s => s.trim()).filter(Boolean);
        const inv = Array.isArray(targetPlayer.inventory) ? [...targetPlayer.inventory] : [];
        const addedNames = [];

        for (const rawItem of itemsList) {
            const qtyMatch = rawItem.match(/(.+?)\s*x\s*(\d+)$/i);
            const name = (qtyMatch ? qtyMatch[1] : rawItem).trim();
            const qty = qtyMatch ? parseInt(qtyMatch[2]) : 1;

            const existing = inv.find(i => i.name.toLowerCase() === name.toLowerCase());
            if (existing) {
                existing.quantity = (existing.quantity || 1) + qty;
            } else {
                inv.push({ name, quantity: qty, type: 'misc' });
            }
            addedNames.push(`${name} (x${qty})`);
        }

        await targetPlayer.update({ inventory: inv });
        feedbackList.push(`🎒 *${targetPlayer.name}* : Objets reçus ➔ ${addedNames.join(', ')}`);
        playersToUpdate.add(targetPlayer.whatsappId);
    }

    // Check training limit for stat increases
    const todayStr = new Date().toISOString().substring(0, 10);

    // Group updates by player and apply them to the DB
    for (const update of updates) {
        const p = update.player;
        const val = update.value;
        const s = update.stat;

        // Reset training counter if new day
        if (p.lastTrainingDate !== todayStr) {
            await p.update({ dailyTrainingsCount: 0, lastTrainingDate: todayStr });
        }

        if (['FOR', 'STRENGTH', 'AGI', 'AGILITY', 'INT', 'INTELLIGENCE', 'DEF', 'DEFENSE', 'LUK', 'LUCK'].includes(s)) {
            if (val > 0) {
                if (p.dailyTrainingsCount >= 2) {
                    feedbackList.push(`⚠️ *${p.name}* : Limite d'entraînement quotidien atteinte (max 2/jour). Statistique inchangée.`);
                    continue;
                }
                const statFieldMap = {
                    'FOR': 'strength', 'STRENGTH': 'strength',
                    'AGI': 'agility', 'AGILITY': 'agility',
                    'INT': 'intelligence', 'INTELLIGENCE': 'intelligence',
                    'DEF': 'defense', 'DEFENSE': 'defense',
                    'LUK': 'luck', 'LUCK': 'luck'
                };
                const dbField = statFieldMap[s];
                if (dbField) {
                    await p.increment(dbField, { by: val });
                    await p.increment('dailyTrainingsCount', { by: 1 });
                    await p.reload();
                    feedbackList.push(`💪 *${p.name}* : ${dbField.toUpperCase()} +${val} (Entraînement ${p.dailyTrainingsCount}/2 aujourd'hui)`);
                }
            }
        } else if (s === 'HP' || s === 'PV') {
            let newH = p.health + val;
            if (newH < 0) newH = 0;
            if (newH > p.maxHealth) newH = p.maxHealth;

            let extraFeedback = "";
            if (val < 0) {
                const damageAmt = Math.floor(Math.abs(val) * 0.4) || 2;
                let newDur = (p.outfitDurability || 100) - damageAmt;
                if (newDur < 0) newDur = 0;

                let newClean = p.outfitCleanliness || 'propre';
                if (Math.abs(val) >= 15) {
                    newClean = 'couvert de sang';
                } else if (Math.abs(val) >= 5 && newClean === 'propre') {
                    newClean = 'taché de boue';
                }

                await p.update({
                    health: newH,
                    outfitDurability: newDur,
                    outfitCleanliness: newClean
                });
                extraFeedback = ` (👕 Tenue: ${newDur}% • ${newClean.toUpperCase()})`;
            } else {
                await p.update({ health: newH });
            }
            feedbackList.push(`❤️ *${p.name}* : HP ${val >= 0 ? '+' : ''}${val} (➔ ${newH}/${p.maxHealth})${extraFeedback}`);
        } else if (s === 'MP' || s === 'PM') {
            let newM = p.mana + val;
            if (newM < 0) newM = 0;
            if (newM > p.maxMana) newM = p.maxMana;
            await p.update({ mana: newM });
            feedbackList.push(`🌀 *${p.name}* : MP ${val >= 0 ? '+' : ''}${val} (➔ ${newM}/${p.maxMana})`);
        } else if (s === 'XP') {
            let newX = p.xp + val;
            await p.update({ xp: newX });
            feedbackList.push(`✨ *${p.name}* : XP +${val}`);
            // Check level up
            await checkLevelUp(p, sock);
        } else if (s === 'COL') {
            let newC = p.col + val;
            if (newC < 0) newC = 0;
            await p.update({ col: newC });
            feedbackList.push(`🪙 *${p.name}* : Col ${val >= 0 ? '+' : ''}${val} (➔ ${newC})`);
        } else if (s === 'SP') {
            let newS = p.skillPoints + val;
            if (newS < 0) newS = 0;
            await p.update({ skillPoints: newS });
            feedbackList.push(`📖 *${p.name}* : SP ${val >= 0 ? '+' : ''}${val}`);
        }
        playersToUpdate.add(p.whatsappId);
    }

    // 4) Quest Starts: [START_QUEST: Quest Title] or [DEBUT_QUETE: Quest Title]
    const questStartRegex = /\[\s*(?:([A-Za-z0-9\s\-_]+?)\s*:\s*)?(?:START_QUEST|DEBUT_QUETE)\s*:\s*(.+?)\s*\]/gi;
    while ((match = questStartRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim() : null;
        const questTitle = match[2].trim();

        let targetPlayer = targetName ? findMatchingPlayer(targetName, player, nearbyPlayers) : player;
        if (!targetPlayer) targetPlayer = player;

        const logMsg = await questUtils.startQuest(targetPlayer, questTitle);
        if (logMsg) {
            feedbackList.push(logMsg);
            playersToUpdate.add(targetPlayer.whatsappId);

            // Send stunning quest starter poster
            try {
                const questData = await questUtils.findQuest(questTitle);
                if (questData) {
                    const { generateQuestStartCard } = require('./additional-visuals');
                    const cardBuf = await generateQuestStartCard(targetPlayer.name, questData.title, questData.description, questData.reward_col, questData.reward_xp);
                    await sock.sendMessage(jid, { image: cardBuf, caption: `📜 *NOUVELLE MISSION ÉVEILLÉE POUR ${targetPlayer.name.toUpperCase()} !*` });
                }
            } catch (vErr) {
                console.error("[Quest Card Error]", vErr);
            }
        }
    }

    // 5) Quest Progress: [PROGRESS_QUEST: Quest Title | 50] or [PROGRES_QUETE: Quest Title | 50]
    const questProgressRegex = /\[\s*(?:([A-Za-z0-9\s\-_]+?)\s*:\s*)?(?:PROGRESS_QUEST|PROGRES_QUETE)\s*:\s*(.+?)\s*\|\s*(\d+)\s*\]/gi;
    while ((match = questProgressRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim() : null;
        const questTitle = match[2].trim();
        const progressVal = parseInt(match[3]);

        let targetPlayer = targetName ? findMatchingPlayer(targetName, player, nearbyPlayers) : player;
        if (!targetPlayer) targetPlayer = player;

        const logMsg = await questUtils.advanceQuest(targetPlayer, questTitle, progressVal);
        if (logMsg) {
            feedbackList.push(logMsg);
            playersToUpdate.add(targetPlayer.whatsappId);
        }
    }

    // 6) Quest Completion: [COMPLETED_QUEST: Quest Title] or [FIN_QUETE: Quest Title]
    const questCompleteRegex = /\[\s*(?:([A-Za-z0-9\s\-_]+?)\s*:\s*)?(?:COMPLETED_QUEST|FIN_QUETE)\s*:\s*(.+?)\s*\]/gi;
    while ((match = questCompleteRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim() : null;
        const questTitle = match[2].trim();

        let targetPlayer = targetName ? findMatchingPlayer(targetName, player, nearbyPlayers) : player;
        if (!targetPlayer) targetPlayer = player;

        const logMsg = await questUtils.completeQuest(targetPlayer, questTitle, sock);
        if (logMsg) {
            feedbackList.push(logMsg);
            playersToUpdate.add(targetPlayer.whatsappId);
        }
    }

    // 7) Learn/Unlock Skills: [LEARN_SKILL: Skill Name] or [APPRENDRE_COMPETENCE: Skill Name] or [TECHNIQUE: Skill Name]
    const skillLearnRegex = /\[\s*(?:([A-Za-z0-9\s\-_]+?)\s*:\s*)?(?:LEARN_SKILL|APPRENDRE_COMPETENCE|TECHNIQUE)\s*:\s*(.+?)\s*\]/gi;
    while ((match = skillLearnRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim() : null;
        const skillName = match[2].trim();

        let targetPlayer = targetName ? findMatchingPlayer(targetName, player, nearbyPlayers) : player;
        if (!targetPlayer) targetPlayer = player;

        // Query skill from database
        const { Skill: ModelSkill } = require('./database');
        const { Op } = require('sequelize');
        let skill = await ModelSkill.findOne({
            where: {
                [Op.or]: [
                    { name: skillName },
                    { name: { [Op.like]: `%${skillName}%` } }
                ]
            }
        });

        if (!skill) {
            // Dynamically create custom-invented skills/pacts so players actually learn them!
            skill = await ModelSkill.create({
                name: skillName,
                description: `Une technique mystique unique de l'Interstice ou issue d'un pacte légendaire.`,
                type: 'Unique',
                manaCost: 15,
                statBonuses: {}
            });
        }

        if (skill) {
            const hasSkill = await targetPlayer.hasSkill(skill);
            if (!hasSkill) {
                await targetPlayer.addSkill(skill);
                // Apply stat bonuses immediately
                const bonuses = skill.statBonuses || {};
                for (const [stat, val] of Object.entries(bonuses)) {
                    if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                        await targetPlayer.increment(stat, { by: val });
                    }
                }
                feedbackList.push(`📖 *${targetPlayer.name}* a appris la technique : *${skill.name.toUpperCase()}* !`);
                playersToUpdate.add(targetPlayer.whatsappId);

                // Send stunning skill scroll card
                try {
                    const { generateSkillScrollCard } = require('./additional-visuals');
                    const cardBuf = await generateSkillScrollCard(targetPlayer.name, skill.name, skill.type, skill.description);
                    await sock.sendMessage(jid, { image: cardBuf, caption: `📖 *NOUVELLE TECHNIQUE MAÎTRISÉE PAR ${targetPlayer.name.toUpperCase()} !*` });
                } catch (vErr) {
                    console.error("[Skill Scroll Card Error]", vErr);
                }
            }
        }
    }

    // 8) Support subLocation and location updates in brackets
    // e.g. [new_sub_location: la Forêt des Gobelins] or [new_location: Empire d'Elion]
    const subLocationRegex = /\[\s*(?:([A-Za-z0-9\s\-_]+?)\s*:\s*)?new_sub_location\s*:\s*(.+?)\s*\]/gi;
    while ((match = subLocationRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim() : null;
        const newSub = match[2].trim();
        let targetPlayer = targetName ? findMatchingPlayer(targetName, player, nearbyPlayers) : player;
        if (!targetPlayer) targetPlayer = player;

        await targetPlayer.update({ subLocation: newSub });
        feedbackList.push(`📍 *${targetPlayer.name}* s'est déplacé à : *${newSub}*`);
        playersToUpdate.add(targetPlayer.whatsappId);
    }

    const locationRegex = /\[\s*(?:([A-Za-z0-9\s\-_]+?)\s*:\s*)?new_location\s*:\s*(.+?)\s*\]/gi;
    while ((match = locationRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim() : null;
        const newLoc = match[2].trim();
        let targetPlayer = targetName ? findMatchingPlayer(targetName, player, nearbyPlayers) : player;
        if (!targetPlayer) targetPlayer = player;

        await targetPlayer.update({ location: newLoc });
        feedbackList.push(`🌍 *${targetPlayer.name}* a voyagé à : *${newLoc}*`);
        playersToUpdate.add(targetPlayer.whatsappId);
    }

    // 9) Proactive Consciousness Spawners
    // [SPAWN_NPC: Name | Role | Specialty | Description]
    const spawnNpcRegex = /\[\s*SPAWN_NPC\s*:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\]/gi;
    while ((match = spawnNpcRegex.exec(text)) !== null) {
        const name = match[1].trim();
        const role = match[2].trim();
        const specialty = match[3].trim();
        const description = match[4].trim();

        // Create NPC in DB
        const [npc, created] = await NPC.findOrCreate({
            where: { name },
            defaults: {
                role,
                specialty,
                description,
                location: player.location,
                subLocation: player.subLocation,
                powerLevel: 50
            }
        });
        if (created) {
            feedbackList.push(`👤 *PNJ apparu* : *${name}* (${role} | Spécialité: ${specialty})`);
        }
    }

    // [SPAWN_MONSTER: Name | Rank | HP | Strength | Defense | Agility]
    const spawnMonsterRegex = /\[\s*SPAWN_MONSTER\s*:\s*(.+?)\s*\|\s*([A-S])\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\]/gi;
    while ((match = spawnMonsterRegex.exec(text)) !== null) {
        const name = match[1].trim();
        const rank = match[2].trim();
        const health = parseInt(match[3]);
        const strength = parseInt(match[4]);
        const defense = parseInt(match[5]);
        const agility = parseInt(match[6]);

        const [monster, created] = await Monster.findOrCreate({
            where: { name },
            defaults: {
                rank,
                health,
                strength,
                defense,
                agility,
                location: player.location,
                subLocation: player.subLocation,
                xp_reward: health * 2,
                col_reward: health
            }
        });
        if (created) {
            feedbackList.push(`👾 *Monstre apparu* : *${name}* (Rang ${rank} | PV: ${health})`);
        }
    }

    // [ANNONCE: Message]
    const annonceRegex = /\[\s*ANNONCE\s*:\s*(.+?)\s*\]/gi;
    while ((match = annonceRegex.exec(text)) !== null) {
        const msg = match[1].trim();
        // Create a world journal entry for global announcement
        await WorldJournal.create({
            entry: `📢 ANNONCE MONDIALE : ${msg}`,
            importance: 5,
            category: 'general'
        });
        feedbackList.push(`📢 *ANNONCE* : ${msg}`);

        // Broadcast immediately on WhatsApp!
        try {
            await sock.sendMessage(jid, { text: `📢 *ANNONCE DE LA CONSCIENCE D'AETHERYS :*\n\n« ${msg} »` });
        } catch (err) {}
    }

    return { playersToUpdate, feedbackList };
}

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const survivalWarnings = [];

  // Logic: Always save the message first
  try {
      await RPMessage.create({
          senderJid: player.whatsappId,
          senderName: player.name,
          content: actionText,
          location: player.location,
          subLocation: player.subLocation
      });
  } catch (e) {
      console.error("[DB] RPMessage log error:", e.message);
  }

  // Technique detection: find any text written in bold (wrapped in single asterisks like *technique*)
  let techniqueImageBuffer = null;
  let techniqueDetectedName = null;
  const boldMatch = actionText.match(/\*([A-Za-zÀ-ÖØ-öø-ÿ0-9\s'-]{3,40})\*/);
  if (boldMatch) {
      techniqueDetectedName = boldMatch[1].trim();
      console.log(`[Technique Detector] Detected technique in bold: "${techniqueDetectedName}"`);
      techniqueImageBuffer = await fetchTechniqueImage(techniqueDetectedName);
  }

  // Automatic Visual: Detect writing on paper or blackboard
  const writingMatch = actionText.match(/(?:écrit|écrire|rédige|rédiger|note|noter|inscrit|dessine|trace|copie|copier)(?:\s+(?:sur|dans)\s+(?:du\s+|le\s+|la\s+)?(?:papier|tableau|mur|parchemin|lettre|examen|note|copie|tableau noir|ardoise))\s*:\s*([\s\S]+)/i);
  if (writingMatch) {
      const writtenText = writingMatch[1].trim();
      const lowerAction = actionText.toLowerCase();
      const isBlackboard = lowerAction.includes('tableau');
      const isExam = lowerAction.includes('examen');

      try {
          let visualBuffer;
          let caption = "";

          if (isBlackboard) {
              visualBuffer = await generateBlackboardImage(writtenText, "TABLEAU");
              caption = `📝 *Sur le tableau, on peut lire...*`;
          } else {
              visualBuffer = await generatePaperImage(writtenText, isExam ? "COPIE D'EXAMEN" : "NOTE MANUSCRITE");
              caption = `📜 *Tu as fini d'écrire...*\n\n"${writtenText.substring(0, 100)}${writtenText.length > 100 ? '...' : ''}"`;
          }

          await sock.sendMessage(jid, {
              image: visualBuffer,
              caption: caption
          });
      } catch (err) {
          console.error("[Writing Visual] Error generating visual:", err);
      }
  }

  // Scene Logic: Detect players in the same sub-location (Immediate view)
  const sceneFilter = {
      location: player.location,
      subLocation: player.subLocation
  };

  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        subLocation: player.subLocation
    }
  });

  const isTriggerWord = actionText.toLowerCase().trim() === 'next';

  // Scene Logic: Detect players in the same sub-location
  // MANDATE: Separation between solo and group play.
  const now = Date.now();
  const activeThreshold = 15 * 60 * 1000; // 15 minutes for broader sync

  const activeOthersInScene = nearbyPlayers.filter(p => {
      const lastActive = new Date(p.lastActivity).getTime();
      return p.whatsappId !== player.whatsappId && (now - lastActive) < activeThreshold;
  });

  // Logic: A player is "Solo" if no one else is ACTIVE in the same Sub-Location.
  const isSolo = activeOthersInScene.length === 0;

  // Synchronization: Solo players bypass 'next' for immediate response.
  // Group players MUST use 'next' or wait for the group to be ready.
  let lastMJMessage = await RPMessage.findOne({
      where: { senderName: 'ATR MJ', ...sceneFilter },
      order: [['id', 'DESC']]
  });

  // IMPORTANT: Never borrow an MJ turn from another scene.
  // Each location/sub-location has its own timeline.

  // Calculate time advancement: 10 mins per action
  const actionsSinceLastMJ = await RPMessage.count({
      where: {
          [Op.or]: [
              { senderJid: player.whatsappId },
              { subLocation: player.subLocation, location: player.location }
          ],
          id: { [Op.gt]: lastMJMessage ? lastMJMessage.id : 0 },
          senderName: { [Op.ne]: 'ATR MJ' }
      }
  });

  // Every real action is processed immediately. Passive players never block the scene.
  if (isTriggerWord) {
      await sock.sendMessage(jid, { text: "⏳ *Le monde attend une action réelle.* Ton personnage n'avance pas automatiquement." });
      return;
  }

  // Fetch all messages in the KINGDOM to detect people moving toward the scene
  const kingdomMessageQuery = {
      location: player.location,
      senderName: { [Op.ne]: 'ATR MJ' }
  };
  if (lastMJMessage) {
      kingdomMessageQuery.id = { [Op.gt]: lastMJMessage.id };
  }

  const recentKingdomActions = await RPMessage.findAll({
      where: {
          ...kingdomMessageQuery,
          content: { [Op.notLike]: 'next' }
      },
      order: [['id', 'ASC']]
  });

  // Keep actions that are in the same sub-location OR interaction with a player here
  const playersCurrentlyHere = nearbyPlayers.map(p => p.name.toLowerCase());
  const recentActions = recentKingdomActions.filter(a => {
      if (a.subLocation === player.subLocation) return true;
      const content = a.content.toLowerCase();
      // If someone in another sub-location mentions a player here
      return playersCurrentlyHere.some(pName => content.includes(pName));
  });

  // Enhanced aggregation: Detect movement and interaction intent
  const playersInKingdom = await Player.findAll({
      where: { location: player.location },
      attributes: ['name', 'subLocation']
  });

  let hasMovement = false;
  let hasInteraction = false;
  let interactionTargetSubLocation = null;

  const aggregatedActions = recentActions.length > 0
    ? recentActions.map(a => {
        let prefix = "";
        const lowContent = a.content.toLowerCase();

        // Detection of movement
        if (lowContent.match(/\b(va|vers|sort|entre|part|dirige|direction|lieu|déplace|bouge|quitte|arrive)\b/i)) {
            prefix = "[🚩 MOUVEMENT] ";
            hasMovement = true;
        }

        // Detection of interaction
        for (const p of playersInKingdom) {
            if (a.senderName !== p.name && lowContent.includes(p.name.toLowerCase())) {
                prefix = `[🤝 INTERACTION avec ${p.name}] `;
                hasInteraction = true;
                if (p.subLocation !== player.subLocation) {
                    interactionTargetSubLocation = p.subLocation;
                }
                break;
            }
        }

        return `${prefix}${a.senderName}: ${a.content}`;
    }).join('\n')
    : "(Aucune action récente des joueurs. Le MJ doit prendre l'initiative pour faire avancer le monde.)";

  // Query NPCs strictly located in the exact same location and subLocation
  const npcs = await NPC.findAll({
    where: {
        location: player.location,
        subLocation: player.subLocation
    }
  });

  const hints = [];

  if (hasMovement) hints.push("⚠️ UN JOUEUR SOUHAITE SE DÉPLACER. Priorise la description du nouveau lieu.");
  if (hasInteraction) {
      hints.push("⚠️ UNE INTERACTION ENTRE JOUEURS EST EN COURS. Ne l'interromps pas avec des PNJ.");
      if (interactionTargetSubLocation) {
          hints.push(`⚠️ LE JOUEUR ESSAIE D'INTERAGIR AVEC QUELQU'UN À '${interactionTargetSubLocation}'. Propose-lui de se déplacer là-bas ou fais-les se rencontrer.`);
      }
  }
  const otherActorsCount = activeOthersInScene.length;
  if (otherActorsCount > 0) hints.push("⚠️ PLUSIEURS JOUEURS SONT PRÉSENTS DANS LA MÊME PIÈCE. Priorise leur interaction directe. Ne crée PAS de PNJ sauf nécessité absolue.");

  // Goldfish Memory Defense: Check if player just got a new item/skill in previous turns
  const recentGains = await WorldJournal.findAll({
      where: { entry: { [Op.like]: `%${player.name}%` }, category: 'plot' },
      limit: 2,
      order: [['id', 'DESC']]
  });
  if (recentGains.length > 0) {
      hints.push(`⚠️ MÉMOIRE RÉCENTE : ${player.name} a récemment vécu : ${recentGains.map(g => g.entry).join(' | ')}.`);
  }

  const availableQuests = await Quest.findAll({
      where: {
          [Op.or]: [
              { rank_required: player.rank },
              { rank_required: 'F' }
          ]
      },
      limit: 5
  });

  hints.push("⚠️ LOIS DE CAUSALITÉ & ANTI-TRICHE : Le monde est un écosystème logique. Un joueur ne peut PAS nager 3h sans compétence spéciale (il se noie en 5min s'il est Rang F).");
  hints.push("⚠️ SENSORIALITÉ : Un joueur ne ressent pas les autres à distance sans compétence.");
  hints.push("⚠️ CONTRAINTES GÉOGRAPHIQUES : Traverser un Royaume prend DES JOURS RP.");
  hints.push("⚠️ ÉPUISEMENT : Si Sleep < 20, le joueur est physiquement incapable de courir ou de combattre efficacement.");

  // Survival Depletion Logic
  const lastActivity = new Date(player.lastActivity).getTime();
  const nowMs = Date.now();
  const realElapsedMs = nowMs - lastActivity;
  const rpElapsedHours = (realElapsedMs * 9) / (1000 * 60 * 60);

  if (rpElapsedHours > 0.05) {
      const sleepLoss = Math.floor(rpElapsedHours * 2);

      if (sleepLoss > 0) await player.decrement('sleep', { by: sleepLoss });

      // Gradual sobriety over time (sobering up)
      if (player.inebriationLevel > 0) {
          const soberingAmount = Math.floor(rpElapsedHours * 15) || 5;
          let newInebriation = player.inebriationLevel - soberingAmount;
          if (newInebriation < 0) newInebriation = 0;
          await player.update({ inebriationLevel: newInebriation });
      }

      if (sleepLoss > 0) {
          survivalWarnings.push(`💤 *${player.name}* : Sommeil -${sleepLoss} (➔ ${Math.max(0, player.sleep - sleepLoss)}/100)`);
      }

      // Poisoning damage over time (lose 5 HP per hour)
      if (player.isPoisoned) {
          const poisonDamage = Math.floor(rpElapsedHours * 5) || 2;
          await player.decrement('health', { by: poisonDamage });
          hints.push(`⚠️ EMPOISONNEMENT ACTIF : Le venin ronge tes PV (-${poisonDamage} PV). Consomme un antidote ou trouve un remède d'urgence !`);
          survivalWarnings.push(`🤢 *${player.name}* : Poison -${poisonDamage} PV (➔ ${Math.max(0, player.health - poisonDamage)}/${player.maxHealth})`);
      }

      await player.reload();
      if (player.sleep < 0) await player.update({ sleep: 0 });

      // Check if player is dead/unconscious
      const isDead = player.health <= 0;
      if (isDead) {
          hints.push("⚠️ LE JOUEUR EST MORT OU INCONSCIENT (0 PV).");
      }

      await player.update({ lastActivity: new Date() });
  }

  // Final Stat Calculation for Main Player
  let mainFor = player.strength;
  let mainAgi = player.agility;
  let mainInt = player.intelligence;
  let mainBond = "";

  if (player.masterId) {
      const master = await Player.findOne({ where: { whatsappId: player.masterId } });
      if (master) {
          const bonus = (master.strength + master.agility + master.intelligence) * 0.2;
          mainFor += bonus * 0.4; mainAgi += bonus * 0.3; mainInt += bonus * 0.3;
          mainBond = ` [SERVITEUR de ${master.name}]`;
      }
  }
  if (player.fusedWithId) {
      const partner = await Player.findOne({ where: { whatsappId: player.fusedWithId } });
      if (partner) {
          mainFor += partner.strength; mainAgi += partner.agility; mainInt += partner.intelligence;
          mainBond = ` [FUSIONNÉ avec ${partner.name} - Sync:${Math.round(player.fusionSyncLevel * 100)}%]`;
      }
  }

  if (player.hasAura) {
      mainFor = mainFor * 1.5;
      mainAgi = mainAgi * 1.5;
      mainInt = mainInt * 1.5;
      mainBond += " [⚡ AURA ACTIVE (+50% STATS)]";
  }

  const playerState = `Nom:${player.name}${player.isGod?'(GOD)':''} | Race:${player.race} | Sexe:${player.gender} | Age:${player.age} | Métier:${player.occupation} | Org:${player.organization} | Inf:${player.influence} | Bio:${player.characterDescription} | Fam:${player.family} | Classe:${player.class}(${player.derivative}) | SP:${player.skillPoints} | Rang:${player.rank} | Niv:${player.level} | XP:${player.xp}/${player.level*100} | PV:${player.health}/${player.maxHealth} | PM:${player.mana}/${player.maxMana} | Hunger:${player.hunger}/100 | Sleep:${player.sleep}/100 | Col:${player.col} | Wanted:${player.wantedLevel}/10 | Prisonnier:${player.isPrisoner?'OUI':'NON'} | Lieu:${player.location} (${player.subLocation}) | Tenue:${player.equippedOutfit || 'Aucun vêtement'} (Durabilité: ${player.outfitDurability}%, Propreté: ${player.outfitCleanliness}) | STATS: FOR:${Math.round(mainFor)} AGI:${Math.round(mainAgi)} INT:${Math.round(mainInt)} DEF:${player.defense} LUK:${player.luck}${mainBond}`;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0 ? "Inv: " + inventory.map(i => i.name).join(',') : "Inv: vide";

  const playerQuests = await player.getQuests();
  const activeQuests = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress');
  const questState = activeQuests.length > 0 ? "Quêtes: " + activeQuests.map(q => `${q.title}(Objectif:${q.objective}, Progrès:${q.PlayerQuest.progress}%, Récompenses:${q.reward_col}Col/${q.reward_xp}XP)`).join(',') : "Pas de quête";

  const availableQuestState = "Quêtes Dispo: " + availableQuests.map(q => `${q.title} (Rang ${q.rank_required})`).join(', ');

  const dungeons = await Dungeon.findAll({ limit: 1 });
  const dungeonState = "Donjon: " + dungeons.map(d => `${d.name}(${d.rank})`).join(',');

  const actingPlayerNames = new Set(recentActions.map(a => a.senderName));

  // STRICT SCENE AUTHORITY: only players physically in the exact same sub-location
  // are part of this scene. Everyone else stays completely outside the narration.
  const scenePlayersData = await Promise.all(nearbyPlayers.map(async p => {
      const pSkills = await p.getSkills();
      const pPacts = await p.getEntities();
      const pClubs = await p.getClubs();
      const pQuests = await p.getQuests();
      const pBank = await Bank.findOne({ where: { PlayerWhatsappId: p.whatsappId } });
      const bankBalance = pBank ? pBank.balance : 100;
      const pActiveQuests = pQuests.filter(q => q.PlayerQuest.status === 'in_progress');
      const pActions = recentActions.filter(a => a.senderName === p.name).map(a => a.content);

      let displayFor = p.strength;
      let displayAgi = p.agility;
      let displayInt = p.intelligence;
      let bondInfo = "";

      if (p.masterId) {
          const master = await Player.findOne({ where: { whatsappId: p.masterId } });
          if (master) {
              const bonus = (master.strength + master.agility + master.intelligence) * 0.2;
              displayFor += bonus * 0.4;
              displayAgi += bonus * 0.3;
              displayInt += bonus * 0.3;
              bondInfo = ` [SERVITEUR de ${master.name}]`;
          }
      }

      if (p.fusedWithId) {
          const partner = await Player.findOne({ where: { whatsappId: p.fusedWithId } });
          if (partner) {
              displayFor += partner.strength;
              displayAgi += partner.agility;
              displayInt += partner.intelligence;
              bondInfo = ` [FUSIONNÉ avec ${partner.name} - Sync:${Math.round(p.fusionSyncLevel * 100)}%]`;
          }
      }

      const { getDistanceInMeters } = require('./utils');
      const distToActive = getDistanceInMeters(player, p);

      return {
          nom: p.name,
          est_god: p.isGod,
          lieu_precis: p.subLocation,
          est_proche: p.subLocation === player.subLocation,
          est_acteur: (actingPlayerNames.has(p.name) || p.whatsappId === player.whatsappId),
          distance_en_metres_de_l_acteur: distToActive,
          extension_du_territoire: p.territoryExtension || "Non éveillée ou non configurée.",
          etat: `Race:${p.race} | Sexe:${p.gender} | Age:${p.age} | Niv:${p.level} | Rang:${p.rank} | PV:${p.health}/${p.maxHealth} | PM:${p.mana}/${p.maxMana} | Faim:${p.hunger} | Sommeil:${p.sleep} | Argent(Col):${p.col} | Banque:${bankBalance} | FOR:${Math.round(displayFor)} AGI:${Math.round(displayAgi)} INT:${Math.round(displayInt)} DEF:${p.defense} LUK:${p.luck} | SP:${p.skillPoints}${bondInfo}`,
          description: p.characterDescription,
          classe: `${p.class}(${p.derivative})`,
          metier: p.occupation,
          organisation: p.organization,
          influence: p.influence,
          inventaire: (p.inventory || []).map(i => i.name),
          competences: pSkills.map(s => s.name),
          pactes: pPacts.map(e => e.name),
          clubs: pClubs.map(c => c.name),
          quetes_actives: pActiveQuests.map(q => `${q.title}(Objectif:${q.objective}, Progrès:${q.PlayerQuest.progress}%)`),
          recherche: p.wantedLevel > 0 ? `Niveau ${p.wantedLevel}` : "Non recherché",
          est_prisonnier: p.isPrisoner,
          actions_recentes: pActions.length > 0 ? pActions : ["Hors-champ ou Immobile"]
      };
  }));

  const activePlayers = scenePlayersData.filter(p => p.est_acteur);
  const spectatorPlayers = scenePlayersData.filter(p => !p.est_acteur);

  const socialState = `ACTEURS: ${activePlayers.map(p => p.nom).join(', ')} | SPECTATEURS (SILENCIEUX): ${spectatorPlayers.length > 0 ? spectatorPlayers.map(p => p.nom).join(', ') : 'Aucun'}`;

  const recentPlayers = await Player.findAll({
      where: { whatsappId: { [Op.ne]: player.whatsappId } },
      order: [['lastActivity', 'DESC']],
      limit: 3
  });
  const worldSocialState = "Rumeurs: " + recentPlayers.map(p => `${p.name}(${p.location})`).join(',');

  const items = await Item.findAll({
      order: [['rarity', 'DESC']],
      limit: 15
  });
  const shopState = "Shop: " + items.map(i => `${i.name}(${i.price}COL)`).join(',');

  // Fetch history (last 20 messages) for Short Term Memory (preventing memory flooding and repetition bias)
  const history = await RPMessage.findAll({
      where: sceneFilter,
      order: [['id', 'DESC']],
      limit: 20
  });
  const historyState = history.length > 0
    ? history.reverse().map(h => ({ sender: h.senderName, msg: h.content }))
    : [];

  // Fetch World Journal entries for Long Term Memory
  const journal = await WorldJournal.findAll({
      order: [['id', 'DESC']],
      limit: 60
  });
  const journalState = journal.length > 0
    ? journal.reverse().map(j => ({ cat: j.category, entry: j.entry }))
    : [];

  // Story Hooks: Persistent JSON Memory for each player's recent narrative arc
  const { getOrAssignMandatoryMainQuest } = require('./quest-system');
  const { quest: mandatoryQuest } = await getOrAssignMandatoryMainQuest(player);

  const mandatoryQuestBlock = `
❖ QUÊTE PRINCIPALE OBLIGATOIRE DU JOUEUR : "${mandatoryQuest.title}" ❖
Description de la trame : ${mandatoryQuest.description}
OBJECTIF OBLIGATOIRE EN COURS : "${mandatoryQuest.objective}"
Rang Requis : ${mandatoryQuest.rank_required} | Récompense : +${mandatoryQuest.reward_xp} XP / +${mandatoryQuest.reward_col} COL

RÈGLES D'HISTOIRE STRUCTURÉE ET CANALISATION NARRATIVE OBLIGATOIRE :
- Le jeu d'ATR N'EST PAS un bac à sable sans fin : C'EST UNE HISTOIRE DENSE ET STRUCTURÉE GUIDÉE PAR LA QUÊTE PRINCIPALE OBLIGATOIRE.
- Bien que le joueur soit libre dans la forme de ses actions RP, TOUS LES ÉVÉNEMENTS, PNJ ET RÉACTIONS DU MONDE DOIVENT IMPÉRATIVEMENT CANALISER, ORIENTER ET GUIDER ${player.name} VERS L'ACCOMPLISSEMENT DE SON OBJECTIF OBLIGATOIRE : "${mandatoryQuest.objective}".
- Ne laisse pas le joueur errer sans but dans une liberté totale sans conséquences. Rappelle-lui constamment le poids de son destin et la nécessité d'accomplir son chapitre principal.
- Si le joueur réalise l'Objectif Obligatoire dans sa scène, valide la quête avec le tag : [${player.name}: COMPLETED_QUEST: ${mandatoryQuest.title}] et accorde les récompenses !
`;

  const storyHooks = await Promise.all(scenePlayersData.map(async p => {
      const pJournal = await WorldJournal.findAll({
          where: { entry: { [Op.like]: `%${p.nom}%` } },
          limit: 3,
          order: [['id', 'DESC']]
      });
      return {
          joueur: p.nom,
          derniers_evenements: pJournal.map(j => j.entry)
      };
  }));

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0 ? "Skills: " + playerSkills.map(s => s.name).join(', ') : "Aucun skill";

  const allKingdoms = await Kingdom.findAll();
  const worldGeography = allKingdoms.map(k => `- [${k.continent || 'Aetheria'}] ${k.name}: ${k.description}`).join('\n');

  // Find current kingdom lore even if location is a city name
  let kingdom = allKingdoms.find(k => k.name === player.location);
  if (!kingdom) {
      kingdom = allKingdoms.find(k => k.description.toLowerCase().includes(player.location.toLowerCase()));
  }
  const subLocContext = kingdom ? `\nLORE_LIEU: ${kingdom.description}` : "";

  const npcState = "PNJ_PRÉSENTS: " + npcs.map(n => `${n.name}(Rôle:${n.role}, Force:${n.powerLevel}, Spé:${n.specialty})`).join(' | ');
  const playerPacts = await player.getEntities();
  const pactState = playerPacts.length > 0 ? "Pactes: " + playerPacts.map(e => e.name).join(', ') : "Pas de pacte";
  const playerClubs = await player.getClubs();
  const clubState = playerClubs?.length > 0 ? "Clubs: " + playerClubs.map(c => c.name).join(', ') : "Pas de club";
  const monsters = await Monster.findAll({ where: { rank: player.rank }, limit: 2 });
  const monsterState = "Monstres: " + monsters.map(m => `${m.name}(PV:${m.health}, FOR:${m.strength}, DEF:${m.defense}, AGI:${m.agility}, INT:${m.intelligence})`).join(', ');

  const conflicts = await Conflict.findAll({ where: { status: 'active' } });
  const worldConflicts = conflicts.map(c => `[${c.title}] Kingdoms:${c.involvedKingdoms.join(', ')} - ${c.description}`).join(' | ');

  const schools = await School.findAll();
  const schoolLore = schools.map(s => `[${s.name}] Spec:${s.specialty} Kingdom:${s.kingdomName}`).join(' | ');

  const houses = await player.getHouses();
  const playerHouses = houses.map(h => `${h.name}(${h.location})`).join(', ');

  // Updated Time Logic: 1:9 scale + 10 mins per action
  const rpTime = getRPTime(actionsSinceLastMJ);
  const rpYearString = rpTime.formatted;
  const cycleInfo = rpTime.isDay ? "JOUR (Soleil, visibilité claire)" : "NUIT (Lune, ombres, visibilité réduite)";
  const weather = getWeather();

  const systemPrompt = `Tu es le Maître du Jeu / Narrateur d'ATR (After the Rebirth).

RÈGLE FONDAMENTALE : CHAQUE JOUEUR CONTRÔLE SON PERSONNAGE.
- Le joueur qui envoie le message est le JOUEUR ACTIF.
- Les autres joueurs présents sont des JOUEURS PASSIFS / IMMOBILES.

INTERDICTIONS ABSOLUES POUR LES JOUEURS PASSIFS :
L'IA ne doit JAMAIS, pour un joueur passif/silencieux :
- inventer une action, un déplacement, une phrase, un dialogue, une pensée, une décision, une attaque volontaire, une fuite ou une réaction volontaire.
- Si un joueur n'a pas envoyé de message, il reste dans son dernier état officiel (IMMOBILE & SILENCIEUX).
- Exemple : Si Nevo dit «Salut White !», la narration peut dire «Nevo adresse un salut à White FORGER.», mais l'IA ne doit PAS dire «White sourit et répond bonjour.». L'IA peut dire «White FORGER reste immobile et ne répond pas immédiatement.»

PNJ :
- Seuls les PNJ autorisés réellement présents dans les données de la scène peuvent être contrôlés par le MJ IA.

STYLE DE NARRATION — PRIORITÉ ABSOLUE :
- Tu es un véritable Maître du Jeu immersif, naturel et intelligent, PAS un rapport de base de données.
- Ne parle jamais de « base de données », « état officiel du jeu », « joueurs présents dans la base de données », « passant imaginaire », « réalité immédiate », « traitement de l'action » ou de tes propres règles.
- Ne commence pas mécaniquement chaque réponse par « Narration : », « Résolution de l'action : » ou « Que fait le joueur maintenant ? ».
- Réponds comme un bon MJ : observe l'intention du joueur, décris ce qui se produit naturellement, puis laisse le monde réagir de façon crédible.
- Ne répète pas les noms des joueurs passifs à chaque tour. S'ils ne sont pas pertinents à l'action, ne les mentionne pas du tout.
- Une personne silencieuse n'est pas obligée d'être décrite comme « immobile » dans chaque réponse : elle est simplement hors du récit actif tant qu'elle n'agit pas.

MONDE AMBIANT :
- L'absence d'un PNJ nommé dans les données signifie seulement qu'aucun PNJ IMPORTANT/IDENTIFIÉ n'est officiellement présent.
- Tu PEUX décrire une population générique cohérente avec le lieu : passants anonymes, étudiants anonymes, marchands anonymes, gardes anonymes, foule, bruit, circulation.
- Ces figurants ne deviennent jamais des personnages importants persistants sauf s'ils sont ensuite créés/enregistrés par le système.
- Ne dis JAMAIS « passant imaginaire » simplement parce qu'aucun PNJ nommé n'a été fourni.

ENVIRONNEMENT ET EFFETS :
- Une action courte ("Je marche", "Salut") doit produire une conséquence proportionnelle et naturelle.
- Si le joueur annonce une destination claire (« Je vais vers l'académie »), ne lui demande pas immédiatement s'il veut continuer : commence réellement le déplacement ou indique naturellement ce qui empêche d'y arriver.
- Ne transforme jamais une action simple en aventure majeure sans cause.
- Les données fournies sont la vérité absolue pour les personnages nommés, positions officielles et éléments persistants, mais la narration peut utiliser une ambiance générique cohérente avec le lieu.`;

    const memoryJson = JSON.stringify({
        monde: {
            date: rpYearString,
            cycle: cycleInfo,
            meteo: weather,
            geographie_mondiale: worldGeography,
            royaume_actuel: kingdom?.name || player.location,
            lore_lieu_actuel: kingdom?.description || "",
            geopolitique: worldConflicts,
            institutions: schoolLore
        },
        personnages_en_scene: scenePlayersData,
        env_social: {
            pnj_presents: npcs.map(n => ({ name: n.name, role: n.role, power: n.powerLevel, specialite: n.specialty, subLocation: n.subLocation })),
            monstres_locaux: monsters.map(m => ({ name: m.name, pv: m.health, for: m.strength, def: m.defense, agi: m.agility, int: m.intelligence, subLocation: m.subLocation })),
            rumeurs_monde: recentPlayers.map(p => `${p.name}(${p.location})`),
            immobilier: playerHouses
        },
        objectifs_generaux: {
            quetes_dispo: availableQuests.map(q => `${q.title} (Lieu: ${q.subLocation})`),
            donjon_local: dungeons.map(d => `${d.name}(${d.rank} | Lieu: ${d.subLocation})`)
        },
        memoire_long_terme: journalState,
        memoire_court_terme: historyState
    }, null, 2);

    const sceneCohesionText = scenePlayersData
        .map(p => {
            const status = p.est_acteur ? "ACTIF" : "SPECTATEUR (SILENCIEUX)";
            return `--- SILO_DONNÉES_ÉTANCHE: ${p.nom} ---
STATUS: ${status}
ÉTAT_PHYSIQUE: ${p.etat}
DESCRIPTION: ${p.description}
CLASSE_ACTUELLE: ${p.classe}
RECHERCHE_CRIMINELLE: ${p.recherche} | PRISONNIER: ${p.est_prisonnier ? 'OUI' : 'NON'}
INVENTAIRE_PRIVÉ: ${p.inventaire.join(', ')}
COMPÉTENCES_UNIQUES: ${p.competences.join(', ')}
OBJECTIFS_PERSONNELS: ${p.quetes_actives.join(', ')}
ACTIONS_À_TRAITER: ${p.actions_recentes.join(' -> ')}`;
        })
        .join('\n\n');

    const sceneAnalysis = `
SCÈNE_COLLECTIVE: ${player.location} (${player.subLocation})
CHRONOLOGIE_DES_ACTIONS (ORDRE STRICT):
${aggregatedActions}

RÉALITÉ PHYSIQUE:
- ACTEURS DANS LA PIÈCE: ${scenePlayersData.filter(p => p.est_proche && p.est_acteur).map(p => p.nom).join(', ')} (Ils se voient et s'entendent parfaitement)
- SPECTATEURS PROCHES: ${scenePlayersData.filter(p => p.est_proche && !p.est_acteur).map(p => p.nom).join(', ')} (Ils sont là mais immobiles)
- HORS_CHAMP (Même Royaume): ${scenePlayersData.filter(p => !p.est_proche).map(p => `${p.nom} est à ${p.lieu_precis}`).join(', ')}
- ENVIRONNEMENT: ${kingdom?.description || "Inconnu"}
`.trim();

    const actionSummary = scenePlayersData
        .filter(p => p.est_acteur)
        .map(p => `[JOUEUR: ${p.nom}] ACTIONS: ${p.actions_recentes.join(' -> ')}`)
        .join('\n');

    const worldPulse = {
        luck_seed: Math.floor(Math.random() * 100),
        critical_success: Math.random() < 0.05,
        weather_impact: weather === 'Pluvieux' ? "AGI malus" : "Normal"
    };

    // Calculate infinite memory logs and timeline
    const completedPlayerQuests = await player.getQuests({
        where: { '$PlayerQuest.status$': 'completed' }
    });
    const completedQuestsState = completedPlayerQuests.length > 0
      ? completedPlayerQuests.map(q => q.title).join(', ')
      : "Aucune quête complétée pour le moment.";

    const playerHistoryLogs = await WorldJournal.findAll({
        where: {
            entry: { [Op.like]: `%${player.name}%` }
        },
        order: [['id', 'ASC']]
    });
    const infiniteTimelineState = playerHistoryLogs.length > 0
      ? playerHistoryLogs.map(l => `- ${l.entry}`).join('\n')
      : "- Début récent de l'aventure dans l'Interstice d'Aetherys.";

    // Fetch up to 8 recent human player actions ONLY (excluding MJ_AETHERYS AI responses to avoid hallucination contamination loops)
    const playerRPHistory = await RPMessage.findAll({
        where: {
            senderJid: { [Op.ne]: 'MJ_AETHERYS' },
            [Op.or]: [
                { senderJid: player.whatsappId },
                { content: { [Op.like]: `%${player.name}%` } }
            ]
        },
        order: [['id', 'DESC']],
        limit: 8
    });
    const infiniteRPState = playerRPHistory.length > 0
      ? playerRPHistory.reverse().map(h => `- [Action Joueur] ${h.senderName}: "${h.content.substring(0, 150)}"`).join('\n')
      : "- Aucun message d'action de joueur antérieur.";

    const memoryText = `
### ÉTAT DU MONDE D'AETHERYS ###
- DATE: ${rpYearString}
- PÉRIODE: ${cycleInfo}
- MÉTÉO: ${weather}
- ROYAUME ACTUEL: ${kingdom?.name || player.location}
- DESCRIPTION DU ROYAUME: ${kingdom?.description || ""}
- GÉOGRAPHIE ET FACTIONS:
${worldGeography}
- CONFLITS POLITIQUES ACTUELS: ${worldConflicts || "Paix relative."}
- ACADÉMIES ET ÉCOLES: ${schoolLore}

### PERSONNAGES PRÉSENTS DANS LA SCÈNE (SOCIÉTÉ) ###
${scenePlayersData.map(p => {
    return `- ${p.nom} :
  * Classe: ${p.classe} (${p.metier})
  * Statut: ${p.etat}
  * Faction: ${p.organisation} (Influence: ${p.influence})
  * Équipements & Inventaire: ${p.inventaire.join(', ') || 'Aucun'}
  * Techniques maîtrisées: ${p.competences.join(', ') || 'Aucune'}
  * Pactes d'entités: ${p.pactes.join(', ') || 'Aucun'}
  * Quêtes actives: ${p.quetes_actives.join(', ') || 'Aucune'}
  * Récents gestes de ce joueur: ${p.actions_recentes.join(' -> ')}`;
}).join('\n')}

### ENVIRONNEMENT IMMÉDIAT ET OBJECTIFS ###
- PNJ PRÉSENTS PROCHES: ${npcState || "Aucun"}
- MONSTRES LOCAUX: ${monsterState || "Aucun"}
- PROPRIÉTÉS ET DOMICILES: ${playerHouses || "Aucun"}
- DONJONS ET QUÊTES DISPONIBLES: ${availableQuestState} | ${dungeonState}
`.trim();

    const storyHooksText = storyHooks.map(h => {
        return `- Souvenirs récents de ${h.joueur} :\n${h.derniers_evenements.map(e => `  * ${e}`).join('\n') || "  * Aucun événement marquant enregistré."}`;
    }).join('\n');

    const otherPlayersInScene = nearbyPlayers.filter(p => p.whatsappId !== player.whatsappId);

    const otherPlayersBlock = otherPlayersInScene.length > 0
      ? otherPlayersInScene.map(p => {
          const dx = (p.x || 100) - (player.x || 100);
          const dy = (p.y || 100) - (player.y || 100);
          const distMeters = Math.max(1, Math.round(Math.sqrt(dx*dx + dy*dy) / 10));
          return `Nom : ${p.name}
Position : ${distMeters} mètres du joueur actif (${p.location} > ${p.zone || 'Centre-ville'} > ${p.subLocation})
État officiel : ${p.state || 'idle'} (IMMOBILE)

⚠️ AUTORITÉ IA :
INTERDICTION ABSOLUE DE CONTRÔLER CE JOUEUR.
- Ne jamais inventer une action, un déplacement, une phrase, un dialogue, une pensée ou une décision pour ce joueur.`;
      }).join('\n\n')
      : "Aucun autre joueur dans la scène immédiate.";

    const npcsInSceneBlock = npcs.length > 0
      ? npcs.map(n => `Nom : ${n.name}
Rôle : ${n.role || 'Citoyen'}
Position : ${n.location} > ${n.zone || 'Centre-ville'} > ${n.subLocation}
Personnalité : ${n.personality || n.description || 'Neutre'}

AUTORITÉ IA :
AUTORISÉ À CONTRÔLER ET FAIRE PARLER CE PNJ.`).join('\n\n')
      : "Aucun PNJ présent dans la scène immédiate.";

    // Persistent narrative memory survives Render restarts through Upstash Redis.
    // PostgreSQL remains authoritative for gameplay state.
    let persistentMemoryText = '';
    try {
      const persistentMemory = await getNarrativeContext({
        player,
        location: player.location,
        subLocation: player.subLocation,
        limit: 24
      });
      persistentMemoryText = formatMemoryContext(persistentMemory);
    } catch (memoryErr) {
      console.error('[UPSTASH MEMORY] Read failed:', memoryErr.message);
      persistentMemoryText = 'Mémoire persistante temporairement indisponible.';
    }

    const fullPrompt = `=== 🚨 ÉTAT OFFICIEL DU JEU (VÉRITÉ ABSOLUE BD) ===
Ces informations proviennent directement de la base de données officielle du jeu.
Elles constituent la SEULE VÉRITÉ ABSOLUE du monde d'ATR.

POSITION OFFICIELLE :
- Royaume / Région : ${player.location}
- Zone : ${player.zone || 'Centre-ville'}
- Sous-Lieu : ${player.subLocation}
- Coordonnées : X:${player.x || 100}, Y:${player.y || 100}

JOUEUR ACTIF :
- Nom : ${player.name}
- Rang & Niveau : Niv.${player.level} (${player.rank}) | Classe: ${player.class}
- État Physique : ${player.state || 'idle'} (PV: ${player.health}/${player.maxHealth}, PM: ${player.mana}/${player.maxMana})
- TENUE OFFICIELLE : ${player.equippedOutfit || 'Tenue de base'} (Style: ${player.wardrobeStyle || 'standard'})
⚠️ Continuité visuelle : lorsque tu décris l'apparence de ${player.name}, respecte cette tenue et ne la remplace pas sans action explicite du joueur.

=== ACTION ACTUELLE DU JOUEUR ===
"${actionText}"

=== JOUEURS RÉELLEMENT PRÉSENTS EN BASE DE DONNÉES ===
${otherPlayersBlock}

=== PNJ RÉELLEMENT PRÉSENTS EN BASE DE DONNÉES ===
${npcsInSceneBlock}

=== ENVIRONNEMENT & ÉVÉNEMENTS OFFICIELS ===
Environnement : ${player.location} - ${player.zone || 'Centre-ville'} - ${player.subLocation} (${kingdom?.description || "Secteur actif."})
Événements / Conflits : ${worldConflicts || "Aucun conflit majeur immédiat."}
Quêtes Actives : ${questState}

=== MÉMOIRE PERSISTANTE UPSTASH (CONTINUITÉ NARRATIVE) ===
Cette mémoire contient des événements VALIDÉS et persistants entre les redémarrages.
- Utilise-la pour te souvenir des relations, promesses, événements et conséquences.
- Elle ne remplace JAMAIS les statistiques, positions, inventaires ou quêtes fournis par la base officielle.
- En cas de contradiction, la base officielle gagne.

${persistentMemoryText}

=== HISTORIQUE NARRATIF RÉCENT (CONTEXTUEL UNIQUEMENT) ===
⚠️ RÈGLE DE NON-CONTAMINATION :
- Les messages ci-dessous sont UNIQUEMENT des rappels contextuels d'actions de joueurs.
- ELLES NE PEUVENT JAMAIS MODIFIER L'ÉTAT OFFICIEL DU JEU (Position, PNJ présents, Bâtiments, Inventaire).
- Si une information provenant de l'historique narratif contredit l'État Officiel ci-dessus (ex: mention passée d'une académie, d'un gardien ou d'un bureau non présent en BD), TU DOIS IMPÉRATIVEMENT L'IGNORER.
- L'État Officiel est TOUJOURS la vérité absolue.

${infiniteRPState}

=== RÈGLES IMPÉRATIVES DU MJ ===
1. Une ancienne réponse du MJ IA ne constitue JAMAIS une vérité officielle si elle n'est pas inscrite en Base de Données.
2. Traite uniquement l'action actuelle du JOUEUR ACTIF (${player.name}) : "${actionText}".
3. Respecte à 100% la POSITION OFFICIELLE (${player.location} > ${player.subLocation}). N'invente aucun réveil, aucun bâtiment non répertorié ni aucune téléportation.
4. N'invente jamais un PNJ IMPORTANT nommé absent des données officielles, mais une ambiance générique cohérente (passants anonymes, étudiants anonymes, foule, gardes anonymes) est autorisée.
5. Les joueurs silencieux restent non-contrôlables et ne doivent pas être mentionnés inutilement.
6. Une action simple ("Je marche") doit produire une conséquence simple, naturelle et proportionnelle.
7. N'explique jamais les règles du système au joueur et ne transforme jamais ta réponse en rapport technique.
8. Pour une action hostile contre un civil anonyme réellement plausible dans un lieu public, résous la scène de façon crédible : réaction de la cible, témoins, gardes ou conséquences possibles, sans prétendre que la cible « n'existe pas ».
9. Privilégie toujours une narration fluide et humaine à une répétition mécanique des données officielles.`;

  try {
    let content = await callAI(systemPrompt, fullPrompt, { jsonMode: false, playerAction: actionText });
    if (!content) {
        content = "🌀 *Le flux magique est instable.* L'Ether ne répond pas à tes appels...";
    }

    // Strip out system prompt leaks or system headers if an LLM echoed system prompt
    content = content
        .replace(/MJ D'ATR[\s\S]*?DIRECTIVE[\s\S]*?\n\n/gi, '')
        .replace(/System:\s*MJ D'ATR[\s\S]*?User:/gi, '')
        .replace(/RÈGLES D'HISTOIRE STRUCTURÉE[\s\S]*?RÈGLES IMPÉRATIVES/gi, '')
        .trim();

    console.log(`[AI RAW] Contenu reçu:\n${content.substring(0, 1000)}`);

    // Programmatic anti-godmoding post-sanitization filter
    const sanitizeGodmoding = (text, playerName) => {
        if (!text) return text;
        let cleaned = text;
        // Remove repetitive waking up loops if LLM hallucinated them
        cleaned = cleaned.replace(/Tu te réveilles dans un lit[\s\S]*?Tu/gi, "Tu");
        cleaned = cleaned.replace(/Tu te réveilles[\s\S]*?\./gi, "");
        cleaned = cleaned.replace(new RegExp(`tu décides de\\s+`, 'gi'), "L'occasion se présente de ");
        cleaned = cleaned.replace(new RegExp(`tu penses que\\s+`, 'gi'), "Il semble que ");
        cleaned = cleaned.replace(new RegExp(`tu choisis de\\s+`, 'gi'), "L'occasion se présente de ");
        cleaned = cleaned.replace(new RegExp(`tu dis\\s*:\\s*".*?"`, 'gi'), "");
        cleaned = cleaned.replace(new RegExp(`tu réponds\\s*:\\s*".*?"`, 'gi'), "");
        cleaned = cleaned.replace(new RegExp(`${playerName} dit\\s*:\\s*".*?"`, 'gi'), "");
        cleaned = cleaned.replace(new RegExp(`${playerName} répond\\s*:\\s*".*?"`, 'gi'), "");
        cleaned = cleaned.replace(new RegExp(`${playerName} choisit de\\s+`, 'gi'), "L'occasion se présente de ");
        cleaned = cleaned.replace(new RegExp(`${playerName} pense que\\s+`, 'gi'), "Il semble que ");
        return cleaned;
    };
    content = sanitizeGodmoding(content, player.name);

    // Parse image generation bracket [IMAGE: ...] from content, or fallback to auto-constructing an action image prompt
    let imagePromptText = null;
    const imageRegex = /\[IMAGE:\s*([^\]]+)\]/i;
    const imageMatch = content.match(imageRegex);
    const outfitPrompt = player.equippedOutfit ? `Current outfit (must remain visually consistent): ${player.equippedOutfit}. ` : '';
    const charDescPrompt = `${player.characterDescription ? `Character visual appearance: (${player.characterDescription}). ` : ''}${outfitPrompt}`;

    if (imageMatch) {
        imagePromptText = `${charDescPrompt}${imageMatch[1].trim()}`;
        content = content.replace(imageRegex, '').trim(); // Strip bracket from output
    } else {
        // Fallback automatic prompt from narrative and action text
        const cleanNarrative = content.replace(/[*_#\[\]]/g, ' ').substring(0, 180).trim();
        imagePromptText = `${charDescPrompt}anime digital painting of ${player.name} (${player.class || 'adventurer'}) in ${player.location}, ${cleanNarrative}, high fantasy masterpiece, highly detailed, dynamic lighting, 8k resolution`;
    }

    // Extract dynamic statistics changes from the text
    const { playersToUpdate, feedbackList } = await parseStatsFromText(content, player, nearbyPlayers, sock, jid);

    // Append survival decay warnings to the feedback list so they are clearly explained to the player
    if (survivalWarnings.length > 0) {
        feedbackList.unshift(...survivalWarnings);
    }

    // Dynamic Action Visual Logic based on text content analysis
    let visualBuffer = techniqueImageBuffer || null;
    const lowerContent = content.toLowerCase();

    // If a custom technique image is NOT detected, fallback to automatic combat/magic action visuals
    if (!visualBuffer) {
        let actionType = null;
        let visualTitle = "SÉQUENCE DE COMBAT";
        let visualDesc = "Échange physique d'intensité maximale.";

        if (lowerContent.includes('attaque') || lowerContent.includes('frappe') || lowerContent.includes('combat') || lowerContent.includes('épée') || lowerContent.includes('lame') || lowerContent.includes('bâton') || lowerContent.includes('vrille') || lowerContent.includes('apôtre')) {
            actionType = 'combat';
        } else if (lowerContent.includes('magie') || lowerContent.includes('sort') || lowerContent.includes('mana') || lowerContent.includes('éther') || lowerContent.includes('lumière') || lowerContent.includes('bénit')) {
            actionType = 'magic';
            visualTitle = "FLUX ARCANIQUE";
            visualDesc = "Manipulation active du mana spirituel.";
        }

        if (actionType) {
            try {
                // Match location with assets
                const assetMap = {
                    'Eldoria': 'assets/locations/eldoria.jpg',
                    'Académie Impériale': 'assets/locations/academy.jpg',
                    'Nécropolis': 'assets/locations/necropolis.jpg',
                    'L\'Interstice': 'assets/locations/interstice.jpg'
                };
                const assetPath = assetMap[player.location] || 'assets/locations/eldoria.jpg';
                visualBuffer = await generateActionVisual({
                    actionType,
                    title: visualTitle,
                    description: visualDesc,
                    assetPath
                });
            } catch (vErr) {
                console.error("[Visual Generator Error]", vErr);
            }
        }
    }

    // 3D Trigger Logic if mentioned
    if (lowerContent.match(/3d|scan|hologramme/i) && !visualBuffer) {
        try {
            visualBuffer = await generate3DVisual('cube', 0x00ffff);
        } catch (e) {}
    }

    // Post-process LLM markdown formatting to match WhatsApp's native styles
    content = content
        .replace(/\*\*(.*?)\*\*/g, "*$1*") // Convert **bold** to *bold*
        .replace(/__(.*?)__/g, "_$1_")     // Convert __italic__ to _italic_
        .replace(/\\n/g, "\n");

    // Save ONLY validated system feedback to memory (avoiding storing hallucinated narrative text)
    const validatedSummary = `Action: "${actionText}"` + (feedbackList.length > 0 ? ` | Impacts: ${feedbackList.join(' ; ')}` : '');

    await RPMessage.create({
        senderJid: 'MJ_AETHERYS',
        senderName: 'ATR MJ',
        content: validatedSummary,
        location: player.location,
        subLocation: player.subLocation
    }).catch(e => console.error("[DB] MJ RPMessage log error:", e.message));

    // Persist validated narrative continuity in Upstash.
    // We intentionally save the action + validated impacts, not uncontrolled AI prose.
    try {
        await rememberValidatedAction({
            player,
            action: actionText,
            summary: validatedSummary,
            location: player.location,
            subLocation: player.subLocation,
            impacts: feedbackList
        });
    } catch (memoryErr) {
        console.error('[UPSTASH MEMORY] Write failed:', memoryErr.message);
    }

    // Sync ONLY validated actions & official status impacts to Excel/CSV Infinite Memory
    try {
        const { appendExcelMemory } = require('./excel-memory');
        await appendExcelMemory({
            whatsappId: player.whatsappId,
            playerName: player.name,
            location: player.location,
            subLocation: player.subLocation,
            actionType: 'VALIDATED_ACTION',
            content: validatedSummary,
            statsSnapshot: { health: player.health, maxHealth: player.maxHealth, mana: player.mana, col: player.col }
        });
    } catch (excelErr) {
        console.error("[EXCEL MEMORY] Error syncing to CSV database:", excelErr.message);
    }

    // Reload active player to sync the new stats
    await player.reload();

    // Streamlined HUD and Header for cleaner responses
    const hud = ` [❤️ ${player.health}/${player.maxHealth} | 🌀 ${player.mana}/${player.maxMana} | 💰 ${player.col}]`;

    // Preserve full narrative content cleanly for the player
    let playerSection = content;

    // Check if the response already contains a time header, if not, prepend it
    let finalMsg = playerSection;
    if (!playerSection.includes(' An ') && !playerSection.includes('📅')) {
        finalMsg = `${getWorldHeader()}\n\n${finalMsg}`;
    }

    // Filter feedback list to only show status updates for this specific active player
    const playerFeedback = feedbackList.filter(f => {
        const clean = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        return f.toLowerCase().includes(clean(player.name)) || f.includes('QUÊTE') || f.includes('COMPÉTENCE');
    });

    if (playerFeedback.length > 0) {
        finalMsg = `${finalMsg}\n\n❖ 💾 *SAUVEGARDE DES STATUTS ATR :*\n${playerFeedback.map(f => `├ ${f}`).join('\n')}`;
    }

    finalMsg = `${finalMsg}\n\n◈ 📊 *HUD TACTIQUE OBLIQUE* :${hud}`;

    // Send typing indicators
    try {
        await sock.sendPresenceUpdate('composing', jid);
    } catch (e) {}

    // CURATED WORLD VISUALS:
    // A location image is sent when the player enters a new visual scene.
    // If an illustrated NPC is physically present, the NPC is composed over the real background.
    // The same visual is never spammed every turn.
    const targetChatJid = message.key.remoteJid || jid;
    let sceneVisual = null;
    try {
        sceneVisual = await buildSceneVisual({ player, npcs });
        if (sceneVisual && sceneVisual.key !== player.lastVisualKey) {
            await sock.sendMessage(targetChatJid, {
                image: sceneVisual.buffer,
                caption: sceneVisual.caption
            });
            await player.update({ lastVisualKey: sceneVisual.key });
        }
    } catch (visualErr) {
        console.error('[WORLD VISUAL] Scene visual skipped:', visualErr.message);
    }

    // Send the final immersive output to the active group/chat session
    const messagePayload = { text: finalMsg };
    if (visualBuffer) {
        messagePayload.image = visualBuffer;
        messagePayload.caption = finalMsg;
    }
    await sock.sendMessage(targetChatJid, messagePayload);

    // Generate and send custom scene image asynchronously in the background as a follow-up to the active chat session
    if (imagePromptText) {
        // Run asynchronously without blocking the main text response
        (async () => {
            try {
                console.log(`[HF] Generating custom scene image in background for: "${imagePromptText}"...`);
                const { generateHuggingFaceImage } = require('./message-handler');
                const buf = await generateHuggingFaceImage(imagePromptText);
                if (buf) {
                    await sock.sendMessage(targetChatJid, { image: buf, caption: `🖼️ *Visualisation de la scène :* ${player.name}` });
                }
            } catch (imgErr) {
                console.error("[HF] Asynchronous image generation failed:", imgErr.message);
            }
        })();
    }

    // Silent reload of any changed players to keep cache synchronized
    if (playersToUpdate.size > 0) {
        for (const pId of playersToUpdate) {
            try {
                const pToUpdate = await Player.findOne({ where: { whatsappId: pId } });
                if (pToUpdate) await pToUpdate.reload();
            } catch (e) {}
        }
    }

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

/**
 * Safely purges hallucinated narrative memory (RPMessage, WorldJournal logs, Excel memory)
 * without touching official player state, stats, location, inventory, money, or quests.
 */
async function purgeNarrativeMemory(playerWhatsappId = null) {
    try {
        if (playerWhatsappId) {
            await RPMessage.destroy({
                where: {
                    [Op.or]: [
                        { senderJid: playerWhatsappId },
                        { senderJid: 'MJ_AETHERYS' }
                    ]
                }
            });
            await WorldJournal.destroy({
                where: {
                    entry: { [Op.like]: `%${playerWhatsappId}%` }
                }
            });
            const { purgeExcelMemory } = require('./excel-memory');
            purgeExcelMemory(playerWhatsappId);
        } else {
            await RPMessage.destroy({ where: {}, truncate: true });
            await WorldJournal.destroy({ where: {}, truncate: true });
            const { purgeExcelMemory } = require('./excel-memory');
            purgeExcelMemory(null);
        }
        return true;
    } catch (err) {
        console.error("[MEMORY PURGE] Error clearing narrative memory:", err.message);
        return false;
    }
}

module.exports = { handleFreeAction, parseStatsFromText, purgeNarrativeMemory };
