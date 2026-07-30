const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, WorldJournal, Monster, Entity, Club, Pact, House, Duel, TournamentParticipant } = require('./database');
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

    try {
        console.log(`[Google Images Fallback] Generating image for "${techniqueName}" via Pollinations...`);
        const cleanPrompt = encodeURIComponent(`high resolution epic anime illustration of the technique called "${techniqueName}", glowing energy, spectacular visual effects, dramatic combat stance, masterpiece art`);
        const pollinationsUrl = `https://image.pollinations.ai/p/${cleanPrompt}?width=800&height=500&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
        const imgBuf = await axios.get(pollinationsUrl, { responseType: 'arraybuffer', timeout: 12000 });
        return Buffer.from(imgBuf.data);
    } catch (pErr) {
        console.error(`[Google Images Fallback] Pollinations generation failed:`, pErr.message);
    }

    return null;
}

/**
 * Robustly parses stat updates and save commands from pure-text AI narratives.
 * Format examples: [SINGAM II: HP -18] [HP -18] [XP +50] [Col +100] /save HP -18
 */
async function parseStatsFromText(text, player, nearbyPlayers, sock, jid) {
    const updates = [];
    const lowerText = text.toLowerCase();

    // 1) Named stats inside brackets or pipes: [PlayerName: STAT +/- VALUE] or [foo | PlayerName: STAT +/- VALUE]
    // e.g. [SINGAM II: HP -18] or [Impact | SINGAM II: HP -18 | 82/100]
    const namedRegex = /(?:[\[|]|^|\s)([A-Za-z0-9\s]+)\s*:\s*(HP|PV|MP|PM|XP|Col|SP)\s*([+-]\s*\d+)/gi;
    let match;
    while ((match = namedRegex.exec(text)) !== null) {
        const targetName = match[1].trim().toLowerCase();
        const statName = match[2].trim().toUpperCase();
        const value = parseInt(match[3].replace(/\s+/g, ''));

        let targetPlayer = null;
        if (player.name.toLowerCase() === targetName) {
            targetPlayer = player;
        } else {
            targetPlayer = nearbyPlayers.find(p => p.name.toLowerCase() === targetName);
        }

        if (targetPlayer) {
            updates.push({ player: targetPlayer, stat: statName, value });
        }
    }

    // 2) Unnamed stats inside brackets: [STAT +/- VALUE]
    // e.g. [HP -18] or [XP +50]
    const unnamedRegex = /\[\s*(HP|PV|MP|PM|XP|Col|SP)\s*([+-]\s*\d+)/gi;
    while ((match = unnamedRegex.exec(text)) !== null) {
        const statName = match[1].trim().toUpperCase();
        const value = parseInt(match[2].replace(/\s+/g, ''));

        // Avoid double-counting if this was already captured as a named stat
        const isDuplicate = updates.some(u => u.player.whatsappId === player.whatsappId && u.stat === statName && u.value === value);
        if (!isDuplicate) {
            updates.push({ player, stat: statName, value });
        }
    }

    // 3) Support loose text-based "/save STAT +/- VALUE" commands
    const saveRegex = /\/save\s+(?:([A-Za-z0-9\s]+?)\s*:\s*)?(HP|PV|MP|PM|XP|Col|SP)\s*([+-]\s*\d+)/gi;
    while ((match = saveRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim().toLowerCase() : null;
        const statName = match[2].trim().toUpperCase();
        const value = parseInt(match[3].replace(/\s+/g, ''));

        let targetPlayer = player;
        if (targetName) {
            const found = nearbyPlayers.find(p => p.name.toLowerCase() === targetName);
            if (found) targetPlayer = found;
        }

        updates.push({ player: targetPlayer, stat: statName, value });
    }

    // Group updates by player and apply them to the DB
    const playersToUpdate = new Set();
    const feedbackList = [];

    for (const update of updates) {
        const p = update.player;
        const val = update.value;
        const s = update.stat;

        if (s === 'HP' || s === 'PV') {
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
    const questStartRegex = /\[\s*(?:([A-Za-z0-9\s]+?)\s*:\s*)?(?:START_QUEST|DEBUT_QUETE)\s*:\s*(.+?)\s*\]/gi;
    while ((match = questStartRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim().toLowerCase() : null;
        const questTitle = match[2].trim();

        let targetPlayer = player;
        if (targetName) {
            const found = nearbyPlayers.find(p => p.name.toLowerCase() === targetName);
            if (found) targetPlayer = found;
        }

        const logMsg = await questUtils.startQuest(targetPlayer, questTitle);
        if (logMsg) {
            feedbackList.push(logMsg);
            playersToUpdate.add(targetPlayer.whatsappId);
        }
    }

    // 5) Quest Progress: [PROGRESS_QUEST: Quest Title | 50] or [PROGRES_QUETE: Quest Title | 50]
    const questProgressRegex = /\[\s*(?:([A-Za-z0-9\s]+?)\s*:\s*)?(?:PROGRESS_QUEST|PROGRES_QUETE)\s*:\s*(.+?)\s*\|\s*(\d+)\s*\]/gi;
    while ((match = questProgressRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim().toLowerCase() : null;
        const questTitle = match[2].trim();
        const progressVal = parseInt(match[3]);

        let targetPlayer = player;
        if (targetName) {
            const found = nearbyPlayers.find(p => p.name.toLowerCase() === targetName);
            if (found) targetPlayer = found;
        }

        const logMsg = await questUtils.advanceQuest(targetPlayer, questTitle, progressVal);
        if (logMsg) {
            feedbackList.push(logMsg);
            playersToUpdate.add(targetPlayer.whatsappId);
        }
    }

    // 6) Quest Completion: [COMPLETED_QUEST: Quest Title] or [FIN_QUETE: Quest Title]
    const questCompleteRegex = /\[\s*(?:([A-Za-z0-9\s]+?)\s*:\s*)?(?:COMPLETED_QUEST|FIN_QUETE)\s*:\s*(.+?)\s*\]/gi;
    while ((match = questCompleteRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim().toLowerCase() : null;
        const questTitle = match[2].trim();

        let targetPlayer = player;
        if (targetName) {
            const found = nearbyPlayers.find(p => p.name.toLowerCase() === targetName);
            if (found) targetPlayer = found;
        }

        const logMsg = await questUtils.completeQuest(targetPlayer, questTitle, sock);
        if (logMsg) {
            feedbackList.push(logMsg);
            playersToUpdate.add(targetPlayer.whatsappId);
        }
    }

    // 7) Learn/Unlock Skills: [LEARN_SKILL: Skill Name] or [APPRENDRE_COMPETENCE: Skill Name] or [TECHNIQUE: Skill Name]
    const skillLearnRegex = /\[\s*(?:([A-Za-z0-9\s]+?)\s*:\s*)?(?:LEARN_SKILL|APPRENDRE_COMPETENCE|TECHNIQUE)\s*:\s*(.+?)\s*\]/gi;
    while ((match = skillLearnRegex.exec(text)) !== null) {
        const targetName = match[1] ? match[1].trim().toLowerCase() : null;
        const skillName = match[2].trim();

        let targetPlayer = player;
        if (targetName) {
            const found = nearbyPlayers.find(p => p.name.toLowerCase() === targetName);
            if (found) targetPlayer = found;
        }

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
            }
        }
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
  const lastMJMessage = await RPMessage.findOne({
      where: { senderName: 'Arise MJ', ...sceneFilter },
      order: [['id', 'DESC']]
  });

  // Calculate time advancement: 10 mins per action
  const actionsSinceLastMJ = await RPMessage.count({
      where: {
          [Op.or]: [
              { senderJid: player.whatsappId },
              { subLocation: player.subLocation, location: player.location }
          ],
          id: { [Op.gt]: lastMJMessage ? lastMJMessage.id : 0 },
          senderName: { [Op.ne]: 'Arise MJ' }
      }
  });

  if (!isTriggerWord && !isSolo) {
      // Logic to remind the player of the sync mechanic if they send many messages
      const recentPlayerMsgs = await RPMessage.count({
          where: {
              senderJid: player.whatsappId,
              id: { [Op.gt]: lastMJMessage ? lastMJMessage.id : 0 }
          }
      });

      let reminder = "";
      if (recentPlayerMsgs >= 3) {
          reminder = "\n\n💡 *Note:* Tu as envoyé plusieurs messages. N'oublie pas de taper `next` quand tu as fini pour obtenir une réponse du MJ.";
      }

      await sock.sendMessage(jid, {
          text: `⏳ *Action enregistrée.*${reminder}\nAttendez les autres joueurs pour \`next\`. S'ils ne sont pas là, ils sont immobiles devant vous et ne réagissent à rien.`
      });
      return;
  }

  // Fetch all messages in the KINGDOM to detect people moving toward the scene
  const kingdomMessageQuery = {
      location: player.location,
      senderName: { [Op.ne]: 'Arise MJ' }
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

  // Query NPCs early to evaluate dynamic proactive events
  const npcs = await NPC.findAll({
    where: {
        [Op.and]: [
            {
                [Op.or]: [
                    { location: { [Op.like]: `%${player.location}%` } },
                    { powerLevel: { [Op.gte]: 95 } }
                ]
            },
            { role: { [Op.notLike]: '%Garde%' } },
            { role: { [Op.notLike]: '%Policier%' } }
        ]
    },
    order: sequelize.random(),
    limit: 5
  });

  // Dynamic proactive passing NPC event logic
  let passingNpcHook = "";
  if (Math.random() < 0.40) { // 40% chance of a passing NPC event
      const pNpc = npcs.length > 0 ? npcs[Math.floor(Math.random() * npcs.length)] : null;
      const behaviors = [
          "passe en ignorant superbement le joueur, plongé dans ses pensées ou très pressé par ses propres quêtes",
          "s'arrête intrigué, observe le joueur (notamment l'état de ses vêtements) et engage brièvement la conversation ou lance un avertissement mystérieux",
          "bloque le chemin du joueur avec suspicion, suspectant un vagabondage ou un acte suspect, et demande de s'identifier",
          "bouscule le joueur par inadvertance dans la hâte, grommelle quelque chose sur les 'amateurs de l'Interstice' et continue rapidement sa route",
          "observe le joueur de loin en souriant d'un air mystérieux, semblant en savoir long sur sa trame principale ou son destin"
      ];
      const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];

      if (pNpc) {
          passingNpcHook = `⚠️ ÉVÉNEMENT PNJ PROACTIF DE PASSAGE : Le PNJ Important *${pNpc.name}* (Rôle: ${pNpc.role}, Force: ${pNpc.powerLevel}) traverse brusquement la scène ! Comportement : il/elle ${behavior}. Tu DOIS l'intégrer proactivement de manière majeure et viscérale dans ton paragraphe narratif.`;
      } else {
          const localRoles = ["Garde de la Milice Royale", "Étudiant de l'Académie", "Marchand ambulant de passage", "Voleur à la tire des Bas-fonds", "Citoyen suspect", "Prêtre de la Lumière"];
          const role = localRoles[Math.floor(Math.random() * localRoles.length)];
          const names = ["Gérard", "Lyanna", "Thorgar", "Vasco", "Kaelen", "Myra", "Darius"];
          const name = names[Math.floor(Math.random() * names.length)];
          passingNpcHook = `⚠️ ÉVÉNEMENT PNJ PROACTIF DE PASSAGE : Un PNJ Mineur de passage nommé *${name}* (Rôle: ${role}) traverse la scène ! Comportement : il/elle ${behavior}. Tu DOIS l'intégrer proactivement dans ton paragraphe narratif de manière viscérale.`;
      }
  }

  const hints = [];
  if (passingNpcHook) hints.push(passingNpcHook);

  // Inject active live rumors for PNJ bosses (such as the King attending Sovereign summits)
  const pnjActiveLifeRumors = [
      "L'Empereur Valerius II s'apprête à quitter Eldoria sous haute escorte militaire pour assister à la Rencontre d'Urgence des Souverains d'Aetherys à l'Origine de l'Existence.",
      "Le Directeur Magnus a réuni les magiciens d'élite de l'Académie Impériale pour sceller une faille magique instable qui est apparue près des frontières.",
      "La Princesse Seraphina mène actuellement des négociations diplomatiques confidentielles avec les diplomates elfes de la Forêt de l'Éveil.",
      "Le Juge Orpheon prépare une convocation d'urgence à Nécropolis pour faire passer des jugements d'âmes corrompues.",
      "L'Ombre organise une réunion secrète des chefs du Syndicat dans les bas-fonds de Gheno."
  ];
  const selectedNpcRumor = pnjActiveLifeRumors[Math.floor(Math.random() * pnjActiveLifeRumors.length)];
  hints.push(`ℹ️ VIE ACTIVE DES PNJ ET RUMEURS D'AETHERYS (Les PNJ majeurs bougent et agissent) : ${selectedNpcRumor}`);

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

  // Data for all players in the same kingdom (to see potential targets for movement)
  const allInKingdom = await Player.findAll({ where: { location: player.location } });

  const scenePlayersData = await Promise.all(allInKingdom.map(async p => {
      const pSkills = await p.getSkills();
      const pPacts = await p.getEntities();
      const pClubs = await p.getClubs();
      const pQuests = await p.getQuests();
      const [pBank] = await Bank.findOrCreate({ where: { PlayerWhatsappId: p.whatsappId } });
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
          etat: `Race:${p.race} | Sexe:${p.gender} | Age:${p.age} | Niv:${p.level} | Rang:${p.rank} | PV:${p.health}/${p.maxHealth} | PM:${p.mana}/${p.maxMana} | Faim:${p.hunger} | Sommeil:${p.sleep} | Argent(Col):${p.col} | Banque:${pBank.balance} | FOR:${Math.round(displayFor)} AGI:${Math.round(displayAgi)} INT:${Math.round(displayInt)} DEF:${p.defense} LUK:${p.luck} | SP:${p.skillPoints}${bondInfo}`,
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

  // Fetch history (last 100 messages) for Short Term Memory
  const history = await RPMessage.findAll({
      where: sceneFilter,
      order: [['id', 'DESC']],
      limit: 100
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

  const systemPrompt = `MJ D'AETHERYS (RÉALISME BRUT & IMMERSION TOTALE)
Tu es l'architecte d'Aetherys. Ton monde n'est pas un jeu, c'est une réalité cruelle, viscérale et sensorielle.
RESTE EXCLUSIVEMENT DANS L'ACTION ET LA NARRATION BRUTE. NE RETOURNE JAMAIS DE JSON.

IMMERSION SENSORIELLE :
- ODORAT: Décris l'odeur du sang frais, de l'ozone après un éclair, du vieux parchemin, de la pourriture des bas-fonds.
- TOUCHER: Sens la texture rugueuse de la pierre, le froid tranchant de l'acier, la chaleur pulsante du mana.
- ATMOSPHÈRE: Décris la pression du mana dans l'air, le silence oppressant avant l'attaque, la poussière qui danse dans la lumière.

LÉTHALITÉ & CONSÉQUENCES :
- MORT & CRUAUTÉ : PV <= 0 -> Action de mort immédiate. Le monde d'Aetherys est sans pitié pour les rangs bas (Rang F, etc.). Les adversaires sont sanguinaires et cherchent activement à TUER le joueur sans hésitation si les statistiques et l'occasion le leur permettent.
- COMBAT & DÉGÂTS RÉALISTES : Brutal, impitoyable, sanglant. Les os craquent, la chair se déchire. Une attaque ne peut JAMAIS être ignorée : le joueur doit obligatoirement soit l'esquiver (AGI), soit la parer/bloquer (DEF), soit l'encaisser de plein fouet (dégâts majeurs de HP). Les blessures dépendent de la zone touchée (tête, torse, bras, jambes) et peuvent entraîner la mort instantanée ou une mutilation si une zone vitale est touchée avec de gros dégâts. Tu DOIS obligatoirement déduire les PV correspondants via les brackets (ex: [Player: HP -15]) à la fin de ta narration.
- CAUSALITÉ : Rang F extrêmement faible (stat cap strictly 30). Le joueur ne peut pas survivre s'il affronte de puissants ennemis de rang élevé sans aide.

INDÉPENDANCE ET LIBERTÉ D'ACTION DES JOUEURS :
- INDÉPENDANCE ABSOLUE DES HISTOIRES : Tu ne dois JAMAIS mélanger, fusionner ou confondre les histoires individuelles, les objectifs, les quêtes ou les récits personnels des différents joueurs présents. Chaque joueur est un être à part entière, totalement autonome, libre et indépendant. Leurs destins ne sont pas liés de force.
- INTERACTION LIBRE : Les joueurs interagissent entre eux de leur plein gré (dialogues, alliances temporaires, trahisons, duels PVP). Arbitre uniquement les conséquences physiques locales et immédiates de leurs interactions (transfert d'objets, dégâts physiques subis) sans jamais inventer de liens scénaristiques ou narratifs forcés ou artificiels entre leurs vécus respectifs.

MÉCANIQUE DE DISTANCE ET EXTENSION DU TERRITOIRE (RANG S) :
- DISTANCE ENTRE JOUEURS : Les joueurs sont séparés par une distance réelle et calculée en mètres (fournie dans la clé "distance_en_metres_de_l_acteur" pour chaque personnage). Décris et respecte rigoureusement cette distance physique lors des déplacements et actions physiques.
- EXTENSION DU TERRITOIRE : L'Extension du Territoire est la technique ultime réservée aux combattants de Rang S. Elle possède une portée de 5 mètres. Si un joueur de Rang S déploie son Extension, seuls les joueurs et ennemis situés à 5 mètres ou moins sont emprisonnés dans ce domaine mystique et subissent ses effets uniques (fournis dans "extension_du_territoire"). Si les cibles sont à plus de 5 mètres, elles restent à l'extérieur. Décris les reflets, les barrières infranchissables et l'esthétique du domaine personnalisé de manière viscérale.

LORE DES CLASSES (CHEVALIER-DRAGON) :
- CHEVALIER-DRAGON (DRAGON SLAYER) : Les joueurs de la classe "Chevalier-Dragon" possèdent des facultés identiques aux Dragon Slayers de Fairy Tail (comme Natsu Dragnir). Ils ont des poumons de dragon (capables d'expirer des souffles élémentaires dévastateurs), peuvent dévorer leur propre élément magique pour restaurer instantanément leurs PM/PV, et sous l'effet de l'Aura, leur peau se couvre d'écailles draconiques denses et leur force brute devient divine.

NARRATION :
- CONCISION ANIME EXTRÊME (REGLE CRITIQUE) : Écris un paragraphe TRÈS COURT (MAXIMUM 80-120 MOTS). Ta narration doit être ultra-fluide, vive et rapide comme un plan d'anime de combat à fort budget. Les descriptions longues et contemplatives sont STRICTEMENT INTERDITES. Va droit au but, reste percutant et dynamique.
- ADVERSAIRES ACTIFS, DIFFICULTÉ ÉLEVÉE & BATTLE IQ : Les combats d'Aetherys exigent un haut niveau d'intelligence de combat (Battle IQ). Les adversaires sont redoutables : ils esquivent, parent, contre-attaquent et se défendent désespérément même s'ils sont à l'agonie. Une victoire nécessite de la tactique (éléments, placement, timing).
- RÉACTIVITÉ SOCIALE ET MILICE : Si un affrontement ou une attaque survient près de PNJ (élèves, citoyens, etc.), ils réagissent instantanément (cris, panique générale, fuite éperdue, ou appel d'urgence aux gardes de la milice locale qui interviennent pour appréhender les coupables).
- ÉLÈVES ROAMING HORS COURS : Des élèves aux caractères très distincts (arrogants, paresseux sécheurs, érudits curieux) errent hors de l'école pendant les cours. Décris leurs traits uniques s'ils croisent le joueur.
- ETATS D'IVRESSE ET POISON (🥴 & 🤢) :
  - Si le statut 'InebriationLevel' du joueur est élevé, sa parole est obligatoirement pâteuse, ses réflexes sont lents, et il souffre d'hallucinations hilarantes ou de vertiges physiques dans la narration.
  - S'il est empoisonné ('isPoisoned: true'), il grimace de douleur, crache du sang noir et double d'intensité de souffrance physique à chaque mouvement.
- IMPACT DES BLESSURES : Les blessures reçues par le joueur ont un impact direct, immédiat et réaliste sur ses mouvements, sa vitesse de déplacement et son agilité narrative (ex: jambe entaillée = déplacement ralenti, bras brisé = maniement de l'épée impossible de ce côté).
- JUSTIFICATION DE TOUTE DÉDUCTION : Ne retire JAMAIS de points de vie (HP) ou de Col (pièces) au joueur de manière arbitraire sans une raison logique, évidente et explicitée clairement dans le texte de la narration (ex: vol commis sous ses yeux, blessure directe infligée par une arme ou piège).
- MJ PUR : Tu ne décides jamais des pensées, répliques ou sentiments du joueur. Tu décris uniquement ce qu'il perçoit et ce qu'il subit physiquement.
- DÉVELOPPEMENT : Chaque action a un impact direct sur l'environnement.
- COMPORTEMENTS & APPARENCE (RÈGLE IMPORTANTE) : Fais réagir l'environnement et les PNJ de manière réaliste et changeante selon l'habillement du personnage. Si le joueur a une tenue 'couverte de sang', 'déchirée' ou 'tachée de boue' (ou une faible durabilité d'outfit), les gardes de la milice seront extrêmement méfiants, les marchands augmenteront leurs prix ou l'ignoreront, tandis que s'il porte un costume élégant, il recevra du respect. Les dégâts physiques reçus déchirent ou salissent sa tenue.

STATUTS ET COMMANDES DE SAUVEGARDE :
Pour mettre à jour le statut, tu ne dois plus utiliser de JSON. Tu dois simplement inclure des brackets à la fin de ta narration pour indiquer ce que le joueur a subi ou gagné, afin que notre parseur de sauvegarde mette à jour ses statistiques, ses techniques ou ses quêtes.
Format de bracket obligatoire :
- [Distance utile: X m]
- [NOM_DU_JOUEUR: HP -X] ou [NOM_DU_JOUEUR: HP +X] (Ex: [SINGAM II: HP -18 | 82/100])
- [NOM_DU_JOUEUR: MP -X] ou [NOM_DU_JOUEUR: MP +X]
- [NOM_DU_JOUEUR: XP +X]
- [NOM_DU_JOUEUR: Col +X] ou [NOM_DU_JOUEUR: Col -X]
- [NOM_DU_JOUEUR: SP +X] ou [NOM_DU_JOUEUR: SP -X]

GUEST & COMPÉTENCE COMMANDES :
- Pour lui faire commencer une quête : [NOM_DU_JOUEUR: START_QUEST: Nom Exact de la Quête] (Ex: [START_QUEST: La Chasse aux Gobelins] ou [SINGAM II: DEBUT_QUETE: La Chasse aux Gobelins])
- Pour mettre à jour la progression d'une quête : [NOM_DU_JOUEUR: PROGRESS_QUEST: Nom de la Quête | ValeurEnPourcent] (Ex: [PROGRESS_QUEST: La Chasse aux Gobelins | 50])
- Pour terminer/compléter une quête et distribuer les récompenses : [NOM_DU_JOUEUR: COMPLETED_QUEST: Nom de la Quête] (Ex: [COMPLETED_QUEST: La Chasse aux Gobelins] ou [FIN_QUETE: La Chasse aux Gobelins])
- Pour lui débloquer/enseigner une nouvelle technique/sort : [NOM_DU_JOUEUR: LEARN_SKILL: Nom du sort] (Ex: [LEARN_SKILL: Starburst Stream] ou [APPRENDRE_COMPETENCE: Fente Puissante])

Exemple de réponse attendue de ta part :
📅 An 23, 31 Mars | 🌙 04:44
*AVENTURA* *📍 Eldoria (Place Centrale)*
... (Texte narratif immersif d'un seul paragraphe) ...
[Distance utile: 1 m → contact] [Impact au torse/flanc | SINGAM II: HP -18 | 82/100] [SINGAM II: XP +50] [START_QUEST: La Chasse aux Gobelins] [LEARN_SKILL: Fente Puissante]`;

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
            pnj_presents: npcs.map(n => ({ name: n.name, role: n.role, power: n.powerLevel, specialite: n.specialty })),
            monstres_locaux: monsters.map(m => ({ name: m.name, pv: m.health, for: m.strength, def: m.defense, agi: m.agility, int: m.intelligence })),
            rumeurs_monde: recentPlayers.map(p => `${p.name}(${p.location})`),
            immobilier: playerHouses
        },
        objectifs_generaux: {
            quetes_dispo: availableQuests.map(q => q.title),
            donjon_local: dungeons.map(d => `${d.name}(${d.rank})`)
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

    const fullPrompt = `### WORLD_PULSE (DICE/LUCK) ###\n${JSON.stringify(worldPulse)}

### MÉMOIRE_SYSTÈME_JSON (CONTEXTE DÉTAILLÉ PAR JOUEUR) ###\n${memoryJson}

### HISTORIQUE_NARRATIF_RÉCENT_PAR_JOUEUR ###\n${JSON.stringify(storyHooks, null, 2)}

### HISTORIQUE DE TOUTE L'AVENTURE DE L'HÉRITIER (MÉMOIRE INFINIE - NE PAS OUBLIER !) ###
Rappel de toutes les actions, accomplissements et passés historiques de ${player.name} :
- QUÊTES TERMINÉES : ${completedQuestsState}
- TIMELINE RP COMPLÈTE :
${infiniteTimelineState}

### RÉSUMÉ DES ACTIONS À TRAITER ###
${actionSummary}

CONSIGNE DE COHÉRENCE MULTI-JOUEUR:
1. TRAITE CHAQUE JOUEUR INDIVIDUELLEMENT : Ne mélange pas leurs inventaires, leurs stats ou leurs histoires.
2. RÉGIS LEURS INTERACTIONS AVEC UNE PRIO ABSOLUE : Si les joueurs s'adressent la parole, s'attaquent, coopèrent ou échangent des objets, décris l'action avec une extrême fluidité.
   - DIALOGUES & COMMERCE : Décris l'échange de mots direct ou le transfert physique d'objets ou de Col.
   - DUEL PVP : Si Joueur A attaque Joueur B, utilise STRICTEMENT leurs stats respectives fournies (FOR/AGI/DEF) pour arbitrer le choc. Une attaque ne peut JAMAIS être ignorée : elle est soit esquivée (AGI), soit bloquée (DEF), soit encaissée de plein fouet (dégâts massifs de HP selon la zone touchée : tête, torse, membres, etc., pouvant être mortelle). Tu DOIS obligatoirement déduire des points de vie (HP) au joueur ciblé en écrivant le bracket correspondant (ex: [JoueurB: HP -25]). Si tu n'écris pas le bracket de dégâts, les joueurs ne perdront aucun PV dans la base de données, ce qui viole la règle de létalité.
   - COOPÉRATION : S'ils unissent leurs forces (attaque synchronisée), décris un combo spectaculaire combinant leurs éléments (ex: feu + vent) provoquant d'immenses dégâts collatéraux.
3. PRÉCISION NARRATIVE : Ta réponse doit clairement identifier qui fait quoi et quelles sont les conséquences pour CHAQUE acteur.
4. IMMOBILITÉ DES SPECTATEURS : Ceux qui n'ont pas d'actions récentes sont présents mais ne bougent pas d'un pouce. Ne les invente pas.
5. VÉRIFICATION DE PERSISTANCE : Ta narration doit explicitement mentionner ou résoudre CHAQUE action listée dans le RÉSUMÉ DES ACTIONS.
6. STRUCTURE OBLIGATOIRE : Utilise [NOM_DU_JOUEUR] et le séparateur ▬▬▬▬▬▬▬▬▬▬▬▬.

ATTENTION : Rédige une réponse en TEXTE BRUT pur sans aucun JSON. Termine par les brackets des impacts statutaires.`;

  try {
    let content = await callAI(systemPrompt, fullPrompt, { jsonMode: false });
    if (!content) {
        content = "🌀 *Le flux magique est instable.* L'Ether ne répond pas à tes appels...";
    }
    console.log(`[AI RAW] Contenu reçu:\n${content.substring(0, 1000)}`);

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

    // Save bot response to memory
    await RPMessage.create({
        senderJid: 'bot',
        senderName: 'Arise MJ',
        content: content,
        location: player.location,
        subLocation: player.subLocation
    }).catch(e => console.error("[DB] MJ RPMessage log error:", e.message));

    // Reload active player to sync the new stats
    await player.reload();

    // Streamlined HUD and Header for cleaner responses
    const hud = ` [❤️ ${player.health}/${player.maxHealth} | 🌀 ${player.mana}/${player.maxMana} | 💰 ${player.col}]`;

    // Check if the response already contains a time header, if not, prepend it
    let finalMsg = content;
    if (!content.includes(' An ') && !content.includes('📅')) {
        finalMsg = `${getWorldHeader()}\n\n${finalMsg}`;
    }

    if (feedbackList.length > 0) {
        finalMsg = `${finalMsg}\n\n💾 *SAUVEGARDE DES STATUT :*\n${feedbackList.map(f => `├ ${f}`).join('\n')}`;
    }

    finalMsg = `${finalMsg}\n\n📊 *HUD*:${hud}`;

    // Send typing indicators
    try {
        await sock.sendPresenceUpdate('composing', jid);
    } catch (e) {}

    // Send the final immersive output
    const messagePayload = { text: finalMsg };
    if (visualBuffer) {
        messagePayload.image = visualBuffer;
        messagePayload.caption = finalMsg;
    }
    await sock.sendMessage(jid, messagePayload);

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

module.exports = { handleFreeAction };
