const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, WorldJournal, Monster, Entity, Club, Pact } = require('./database');
const { sendWithImage, shouldNotifyPlayer } = require('./message-handler');
const { generatePaperImage } = require('./paper-generator');
const { generate3DVisual } = require('./three-renderer');
const { generateActionVisual } = require('./action-visual-generator');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');
const questUtils = require('./quest-utils');
const { checkLevelUp } = require('./level-utils');
const { isDay, getWeather } = require('./game-state');
const { getRPTime, getWorldHeader } = require('./world-clock');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

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

  // Automatic Visual: Detect writing on paper
  const writingMatch = actionText.match(/(?:écrit|écrire|rédige|rédiger|note|noter)(?:\s+sur\s+(?:du\s+)?papier|\s+une\s+note|\s+une\s+lettre|\s+l'examen)\s*:\s*([\s\S]+)/i);
  if (writingMatch) {
      const writtenText = writingMatch[1].trim();
      const isExam = actionText.toLowerCase().includes('examen');
      try {
          const paperBuffer = await generatePaperImage(writtenText, isExam ? "COPIE D'EXAMEN" : "NOTE MANUSCRITE");
          await sock.sendMessage(jid, {
              image: paperBuffer,
              caption: `📜 *Tu as fini d'écrire...*\n\n"${writtenText.substring(0, 100)}${writtenText.length > 100 ? '...' : ''}"`
          });
      } catch (err) {
          console.error("[Paper] Error generating paper visual:", err);
      }
  }

  // Scene Logic
  const sceneFilter = {
      location: player.location,
      subLocation: player.subLocation
  };

  // AI Automation Logic:
  // Solo Scene -> Immediate Response
  // Multiplayer Scene -> Requires 'next' for sync
  const nearbyPlayers = await Player.findAll({ where: sceneFilter });

  const isTriggerWord = actionText.toLowerCase().trim() === 'next';

  // Check if player is truly alone (ignoring themselves)
  const otherActorsCount = nearbyPlayers.filter(p => p.whatsappId !== player.whatsappId).length;
  const isSolo = otherActorsCount === 0;

  if (!isTriggerWord && !isSolo) {
      await sock.sendMessage(jid, {
          text: "⏳ *Action enregistrée.*\nAttendez les autres joueurs pour `next`. S'ils ne sont pas là, ils sont immobiles devant vous et ne réagissent à rien."
      });
      return;
  }

  // If "Next" is sent, aggregate all messages since the last MJ response
  const lastMJMessage = await RPMessage.findOne({
      where: { senderName: 'Arise MJ', ...sceneFilter },
      order: [['id', 'DESC']]
  });

  const messageQuery = {
      ...sceneFilter,
      senderName: { [Op.ne]: 'Arise MJ' }
  };
  if (lastMJMessage) {
      messageQuery.id = { [Op.gt]: lastMJMessage.id };
  }

  const recentActions = await RPMessage.findAll({
      where: {
          ...messageQuery,
          content: { [Op.notLike]: 'next' } // Filter out the trigger word itself
      },
      order: [['id', 'ASC']]
  });

  // If 'next' is sent but there are NO actions, we still let the MJ intervene if they want
  const aggregatedActions = recentActions.length > 0
    ? recentActions.map(a => `${a.senderName}: ${a.content}`).join('\n')
    : "(Aucune action récente des joueurs. Le MJ doit prendre l'initiative pour faire avancer le monde.)";

  // Survival Depletion Logic
  const lastActivity = new Date(player.lastActivity).getTime();
  const nowMs = Date.now();
  const realElapsedMs = nowMs - lastActivity;
  const rpElapsedHours = (realElapsedMs * 9) / (1000 * 60 * 60);

  if (rpElapsedHours > 0.05) {
      const hungerLoss = Math.floor(rpElapsedHours * 3); // -3 per RP hour
      const sleepLoss = Math.floor(rpElapsedHours * 2);  // -2 per RP hour

      if (hungerLoss > 0) await player.decrement('hunger', { by: hungerLoss });
      if (sleepLoss > 0) await player.decrement('sleep', { by: sleepLoss });

      await player.reload();
      if (player.hunger < 0) await player.update({ hunger: 0 });
      if (player.sleep < 0) await player.update({ sleep: 0 });

      // Starvation damage
      if (player.hunger === 0 && rpElapsedHours > 0.5) {
          await player.decrement('health', { by: 5 });
      }
      await player.update({ lastActivity: new Date() });
  }

  const playerState = `Nom:${player.name}${player.isGod?'(GOD)':''} | Sexe:${player.gender} | Age:${player.age} | Métier:${player.occupation} | Org:${player.organization} | Inf:${player.influence} | Bio:${player.characterDescription} | Fam:${player.family} | Classe:${player.class}(${player.derivative}) | SP:${player.skillPoints} | Rang:${player.rank} | Niv:${player.level} | XP:${player.xp}/${player.level*100} | PV:${player.health}/${player.maxHealth} | PM:${player.mana}/${player.maxMana} | Hunger:${player.hunger}/100 | Sleep:${player.sleep}/100 | Col:${player.col} | Lieu:${player.location} (${player.subLocation}) | STATS: FOR:${player.strength} AGI:${player.agility} INT:${player.intelligence} DEF:${player.defense} LUK:${player.luck}`;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0 ? "Inv: " + inventory.map(i => i.name).join(',') : "Inv: vide";

  const playerQuests = await player.getQuests();
  const activeQuests = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress');
  const questState = activeQuests.length > 0 ? "Quêtes: " + activeQuests.map(q => `${q.title}(${q.PlayerQuest.progress}%)`).join(',') : "Pas de quête";

  const availableQuests = await Quest.findAll({ where: { rank_required: player.rank }, limit: 2 });
  const availableQuestState = "Dispo: " + availableQuests.map(q => q.title).join(',');

  const dungeons = await Dungeon.findAll({ limit: 1 });
  const dungeonState = "Donjon: " + dungeons.map(d => `${d.name}(${d.rank})`).join(',');

  const actingPlayerNames = new Set(recentActions.map(a => a.senderName));

  // Data for all players in the same scene
  const scenePlayersData = await Promise.all(nearbyPlayers.map(async p => {
      const pSkills = await p.getSkills();
      const pPacts = await p.getEntities();
      const pClubs = await p.getClubs();
      const pQuests = await p.getQuests();
      const pActiveQuests = pQuests.filter(q => q.PlayerQuest.status === 'in_progress');
      const pActions = recentActions.filter(a => a.senderName === p.name).map(a => a.content);

      return {
          nom: p.name,
          est_god: p.isGod,
          est_acteur: actingPlayerNames.has(p.name) || p.whatsappId === player.whatsappId,
          etat: `Sexe:${p.gender} | Age:${p.age} | Niv:${p.level} | Rang:${p.rank} | PV:${p.health}/${p.maxHealth} | PM:${p.mana}/${p.maxMana} | Faim:${p.hunger} | Sommeil:${p.sleep} | FOR:${p.strength} AGI:${p.agility} INT:${p.intelligence} DEF:${p.defense} LUK:${p.luck}`,
          description: p.characterDescription,
          classe: `${p.class}(${p.derivative})`,
          metier: p.occupation,
          organisation: p.organization,
          influence: p.influence,
          inventaire: (p.inventory || []).map(i => i.name),
          competences: pSkills.map(s => s.name),
          pactes: pPacts.map(e => e.name),
          clubs: pClubs.map(c => c.name),
          quetes_actives: pActiveQuests.map(q => `${q.title}(${q.PlayerQuest.progress}%)`),
          actions_recentes: pActions.length > 0 ? pActions : ["Immobile / Pas d'action"]
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

  // Fetch history (last 75 messages) for Short Term Memory
  const history = await RPMessage.findAll({
      where: sceneFilter,
      order: [['id', 'DESC']],
      limit: 30
  });
  const historyState = history.length > 0
    ? history.reverse().map(h => ({ sender: h.senderName, msg: h.content }))
    : [];

  // Fetch World Journal entries for Long Term Memory
  const journal = await WorldJournal.findAll({
      order: [['id', 'DESC']],
      limit: 15
  });
  const journalState = journal.length > 0
    ? journal.reverse().map(j => ({ cat: j.category, entry: j.entry }))
    : [];

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0 ? "Skills: " + playerSkills.map(s => s.name).join(', ') : "Aucun skill";

  const kingdom = await Kingdom.findOne({ where: { name: player.location } });
  const subLocContext = kingdom ? `\nLORE_LIEU: ${kingdom.description}` : "";

  const npcs = await NPC.findAll({
    where: {
        [Op.or]: [
            { location: { [Op.like]: `%${player.location}%` } },
            { powerLevel: { [Op.gte]: 90 } } // Include major entities/bosses
        ]
    },
    order: [
        [sequelize.random()], // Randomly pick from local NPCs to feel like a "living crowd"
        ['powerLevel', 'DESC']
    ],
    limit: 10
  });
  const npcState = "PNJ_PRÉSENTS: " + npcs.map(n => `${n.name}(Rôle:${n.role}, Force:${n.powerLevel}, Spé:${n.specialty})`).join(' | ');
  const playerPacts = await player.getEntities();
  const pactState = playerPacts.length > 0 ? "Pactes: " + playerPacts.map(e => e.name).join(', ') : "Pas de pacte";
  const playerClubs = await player.getClubs();
  const clubState = playerClubs?.length > 0 ? "Clubs: " + playerClubs.map(c => c.name).join(', ') : "Pas de club";
  const monsters = await Monster.findAll({ where: { rank: player.rank }, limit: 2 });
  const monsterState = "Monstres: " + monsters.map(m => `${m.name}(PV:${m.health}, FOR:${m.strength}, DEF:${m.defense}, AGI:${m.agility}, INT:${m.intelligence})`).join(', ');

  // Updated Time Logic: 1:9 scale
  const rpTime = getRPTime();
  const rpYearString = rpTime.formatted;
  const cycleInfo = rpTime.isDay ? "JOUR (Soleil, visibilité claire)" : "NUIT (Lune, ombres, visibilité réduite)";
  const weather = getWeather();

    // Mini-Event Trigger (20% chance)
    const triggerMiniEvent = Math.random() < 0.20;
    const miniEventContext = triggerMiniEvent
        ? "\n⚠️ **ÉVÉNEMENT IMPRÉVU**: Un événement aléatoire doit se produire maintenant ! (Ex: Un monstre surgit, une annonce impériale, un objet mystérieux trouvé, etc.)"
        : "";

  const systemPrompt = `Tu es DARK LUST 3.2, l'Intelligence Narrative Souveraine de GHENO CITY.

RÈGLES DE CONCEPTION TACTIQUE (DARK LUST):
- MJ PUR & AUTORITAIRE (Precision over Constraint) : Ton ton est froid, clinique, direct et viscéral. Pas de fioritures, seulement la réalité brute.
- PRÉCISION CHIRURGICALE : Incorpore systématiquement des métriques (distances, stats, temps) dans tes descriptions. Utilise un vocabulaire sophistiqué et évite les répétitions.
- ÉTANCHÉITÉ DES MONDES : Chaque joueur vit sa propre causalité. Ne mélange jamais les histoires.
- RYTHME NARRATIF : Ne crée pas systématiquement des problèmes ou des combats. Laisse les joueurs respirer, s'entraîner, et vivre des moments de calme ou de triomphe. Le monde est dangereux, mais pas oppressant 100% du temps.
- APÔTRES : Ce sont des entités rarissimes. Ils ne se trouvent que dans des lieux spécifiques (Interstice, Sanctuaires maudits) et ne traquent pas les joueurs sans raison majeure.
- COMMERCE IA : Tu peux désormais traiter les achats directement via "buy_item". Si un joueur veut acheter un objet présent dans le "Shop" du contexte, utilise cette action.
- Tu peux modifier l'état des joueurs (PV, PM, faim, sommeil, bio, lieu) via des actions.
- RÉCOMPENSE D'ENTRAÎNEMENT : Tu peux augmenter les statistiques de base (FOR, AGI, INT, DEF, LUK) ou l'argent (COL) d'un joueur s'il réalise un entraînement complexe, intensif ou une action particulièrement brillante et détaillée.
- Équilibre les gains : +1 ou +2 pour un entraînement classique, plus pour un exploit héroïque.
- N'écris jamais les pensées, paroles ou actions non écrites d'un joueur.
- Les joueurs présents dans JSON "personnages_en_scene" partagent exactement la même scène: même lieu et même sous-lieu. N'inclus personne d'autre.
- Un ACTEUR agit seulement selon son texte. Un SPECTATEUR reste immobile et silencieux.
- Chaque histoire reste séparée. Ne mélange jamais inventaires, objectifs, blessures ou relations entre joueurs.
- Les résultats dépendent strictement des stats, compétences, inventaires et du décor fournis.

COMBAT ET DÉPLACEMENT:
- Une action est une tentative, pas une réussite garantie.
- RIPOSTE CRÉATIVE : Les monstres et PNJ ne sont pas des sacs de frappe. Ils innovent leurs actions, utilisent l'environnement (projeter sur un mur, renverser une table, briser le sol) et contre-attaquent violemment selon leurs stats (FOR, AGI, INT, DEF).
- Narration viscérale et cinématographique : Ne te contente pas d'un schéma technique. Décris la brutalité des impacts, la vitesse des mouvements et l'ingéniosité tactique des adversaires.
- Indique les distances utiles en mètres: déplacement parcouru, écart entre deux personnes, portée vers un objet ou un ennemi.
- Pour chaque attaque ou défense importante, précise seulement ce qui est utile: membre ou arme utilisée, partie du corps visée, conséquence immédiate.
- Les résultats dépendent du différentiel de stats : un écart de 20+ points en AGI permet une esquive facile, un écart de 20+ en FOR cause des blessures graves (fractures, projections de 5m+).

MONDE:
- Le monde est persistant, cohérent, vivant, mais la réponse reste centrée sur cette scène.
- Si une action modifie durablement le monde ou la relation d'un personnage, utilise "write_journal".
- Si un joueur atteint 0 PV: hospitalisation si secouru, sinon mort et transfert à Nécropolis.

FORMAT DE SORTIE:
- Réponds en JSON STRICT: {"pensee_mj":"...","narrative":"...","actions":[],"imagePrompt":"","actionVisual":{"type":"attack|defend|magic|combat","assetName":"Eldoria|Gobelin|...","title":"...","description":"..."}}
- "narrative" commence par "--- 🌑 DARK LUST 3.2 ---" puis "*📍 lieu (sous-lieu)*".
- Narration concise, chirurgicale, max 280 mots.
- Inclure si utile des statuts courts comme [HP -12 | 38/50] ou [Distance: 4 m].

ACTIONS AUTORISÉES:
- update_player, buy_item, add_item, add_skill, notify_player, broadcast, start_quest, advance_quest, complete_quest, forge_pact, join_club, resurrect_player, write_journal.
- update_player peut inclure : characterDescription, profilePicUrl, health, maxHealth, mana, maxMana, gender, age, strength_change, agility_change, intelligence_change, defense_change, luck_change, col_change.
- buy_item : { "itemName": "nom de l'objet", "quantity": 1 }. Vérifie que le joueur a assez de COL avant de l'utiliser.

STYLE ET APPARENCE:
- Le style vestimentaire (inventaire) et l'apparence physique influencent les interactions.
- DÉCHIRURE ET USURE : Lors de combats violents, d'explosions ou de chutes, les vêtements du joueur peuvent se déchirer. Utilise l'action "update_item" pour réduire la "durability" d'un vêtement équipé. Une durabilité < 50 rend le vêtement visiblement déchiré.
- Prends en compte les bonus de stats des vêtements portés dans ta narration.

VISUELS DES LIEUX & ATMOSPHÈRE :
- STYLE : DARK FANTASY / CLINIQUE.
- N'invente jamais de prompt d'image.
- Utilise les visuels officiels selon le lieu:
  * Eldoria -> "assets/locations/eldoria.jpg"
  * Académie Impériale -> "assets/locations/academy.jpg"
  * Nécropolis -> "assets/locations/necropolis.jpg"
  * L'Interstice -> "assets/locations/interstice.jpg"
- Utilise ces visuels pour illustrer tes réponses narratives dès que le lieu change ou pour poser l'ambiance.
- Sinon laisse "imagePrompt" vide.

LORE FIXE:
- One Above All est l'origine de tout.
- L'Idée du Mal nait des peurs humaines.
- Les Béhérits choisissent les désespérés.
- Les Apôtres ont sacrifié leur humanité.
- L'Interstice relie les mondes.

LOGIQUE ACADÉMIE:
- L'Académie Impériale suit un modèle strict (lycée japonais).
- Matières : Maîtrise de l'Éther, Stratégie Militaire, Histoire d'Aetherys, Alchimie, Duel à l'Épée.
- Scolarité/Uniforme : 500 COL. Porter l'uniforme est obligatoire pour les examens.`;

    const memoryJson = JSON.stringify({
        monde: { date: rpYearString, cycle: cycleInfo, meteo: weather, lore_lieu: kingdom?.description || "" },
        personnages_en_scene: scenePlayersData,
        env_social: {
            pnj_presents: npcs.map(n => ({ name: n.name, role: n.role, power: n.powerLevel, specialite: n.specialty })),
            monstres_locaux: monsters.map(m => ({ name: m.name, pv: m.health, for: m.strength, def: m.defense, agi: m.agility, int: m.intelligence })),
            rumeurs_monde: recentPlayers.map(p => `${p.name}(${p.location})`)
        },
        objectifs_generaux: {
            quetes_dispo: availableQuests.map(q => q.title),
            donjon_local: dungeons.map(d => `${d.name}(${d.rank})`)
        },
        memoire_long_terme: journalState,
        memoire_court_terme: historyState
    }, null, 2);

    const actionSummary = scenePlayersData
        .filter(p => p.est_acteur)
        .map(p => `[JOUEUR: ${p.nom}] ACTIONS: ${p.actions_recentes.join(' -> ')}`)
        .join('\n');

    const fullPrompt = [
        `SCÈNE ACTIVE: ${player.location} (${player.subLocation})`,
        `JOUEUR DÉCLENCHEUR: ${player.name}`,
        '',
        'MÉMOIRE_SYSTÈME_JSON:',
        memoryJson,
        '',
        'ACTIONS_JOUEURS:',
        actionSummary || '(Aucune action détaillée, le MJ doit faire vivre la scène sans inventer d action de joueur.)',
        '',
        'CONSIGNES FINALES:',
        '1. Traite chaque acteur séparément puis arbitre leurs interactions si elles se croisent.',
        '2. Mentionne les mètres utiles pour les déplacements et les distances entre acteurs/objets importants.',
        '3. En combat, précise membre/arme utilise et zone du corps touchée, sans detail inutile.',
        '4. Si une action est trop vague, fais-la echouer ou rester partielle au lieu de l inventer.',
        '5. Ne fais agir que les joueurs listés comme acteurs.',
        '6. N\'interpelle JAMAIS les joueurs SPECTATEURS (silencieux). Ignore-les dans la narration.'
    ].join('\n');

  try {
    let content = await callAI(systemPrompt, fullPrompt);
    if (!content) {
        content = JSON.stringify({ narrative: "🌀 *Le flux magique est instable.* L'Ether ne répond pas à tes appels...", actions: [] });
    }
    console.log(`[AI RAW] Contenu reçu: ${typeof content === 'string' ? content.substring(0, 500) : '[Object]'}`);

    // Enhanced JSON & Narrative extraction
    let aiResponse = { narrative: "", actions: [], notifications: [], broadcastMessage: null };

    const cleanupNarrative = (t) => {
        if (!t) return "";
        // Clean markdown and common technical prefixes
        return t.replace(/```json/gi, '')
                .replace(/```/g, '')
                .replace(/^(json|JSON)/g, '')
                .replace(/^(Narrative|Narrateur|MJ|Systeme|Arise|json|JSON)\s*:\s*/i, '')
                .replace(/(\n|^)[a-z_]+_change:.*(\n|$)/gi, '')
                .trim();
    };

    if (typeof content === 'object') {
        aiResponse = { ...aiResponse, ...content };
        if (aiResponse.pensee_mj) console.log(`[MJ THOUGHTS] ${aiResponse.pensee_mj}`);
    } else {
        // Robust JSON extraction: Find the largest JSON block possible
        let start = content.indexOf('{');
        let end = content.lastIndexOf('}');

        if (start !== -1 && end !== -1 && end > start) {
            const potentialJson = content.substring(start, end + 1);
            try {
                const parsed = JSON.parse(potentialJson);
                aiResponse = { ...aiResponse, ...parsed };
                if (aiResponse.pensee_mj) console.log(`[MJ THOUGHTS] ${aiResponse.pensee_mj}`);
            } catch (e) {
                // If the big block failed, try finding individual smaller blocks (fallback for mixed content)
                const matches = [...content.matchAll(/\{[\s\S]*?\}/g)];
                for (const match of matches) {
                    try {
                        const potential = JSON.parse(match[0]);
                        if (potential.actions) aiResponse.actions = [...(aiResponse.actions || []), ...potential.actions];
                        if (potential.narrative && (!aiResponse.narrative || potential.narrative.length > aiResponse.narrative.length)) {
                            aiResponse.narrative = potential.narrative;
                        }
                        if (potential.imagePrompt) aiResponse.imagePrompt = potential.imagePrompt;
                        if (potential.notifications) aiResponse.notifications = [...(aiResponse.notifications || []), ...potential.notifications];
                    } catch (innerE) {}
                }
            }
        }

        // If narrative is STILL empty, it might be outside the JSON block
        if (!aiResponse.narrative || aiResponse.narrative.length < 10) {
            // Remove the block we extracted as JSON to find the narrative
            let plainText = content;
            if (start !== -1 && end !== -1) {
                plainText = content.substring(0, start) + content.substring(end + 1);
            }
            // If still no luck, just use the whole thing but clean markers
            if (plainText.trim().length < 10) plainText = content.replace(/\{[\s\S]*?\}/g, '');

            aiResponse.narrative = cleanupNarrative(plainText);
        }
    }

    // Ensure narrative is clean
    aiResponse.narrative = cleanupNarrative(aiResponse.narrative);

    // Procedural Action Visual Logic
    if (aiResponse.actionVisual && !aiResponse.imagePrompt) {
        try {
            // Map location/monster to local assets
            const assetMap = {
                'Eldoria': 'assets/locations/eldoria.jpg',
                'Académie Impériale': 'assets/locations/academy.jpg',
                'Nécropolis': 'assets/locations/necropolis.jpg',
                'L\'Interstice': 'assets/locations/interstice.jpg',
                'Gobelin': 'assets/monsters/goblin.jpg',
                'Boss': 'assets/monsters/boss.jpg'
            };

            const assetPath = assetMap[aiResponse.actionVisual.assetName] || assetMap[player.location] || 'assets/locations/eldoria.jpg';

            const visualBuffer = await generateActionVisual({
                actionType: aiResponse.actionVisual.type || 'combat',
                title: aiResponse.actionVisual.title || 'SEQUENCE ACTIVE',
                description: aiResponse.actionVisual.description || 'Analyse tactique en cours...',
                assetPath: assetPath
            });
            aiResponse.imagePrompt = visualBuffer;
        } catch (e) {
            console.error("[Visual] Error generating action visual:", e);
        }
    }

    // 3D Trigger Logic: If AI mentions "3D", "scan", or "hologramme"
    if (aiResponse.narrative.match(/3D|scan|hologramme/i) && !aiResponse.imagePrompt) {
        const types = ['cube', 'sphere', 'pyramid'];
        const type = types.find(t => aiResponse.narrative.toLowerCase().includes(t)) || 'cube';
        try {
            const threeBuffer = await generate3DVisual(type, 0x00ffff);
            aiResponse.imagePrompt = threeBuffer;
        } catch (e) {
            console.error("[3D] Error:", e);
        }
    }

    if (!aiResponse.narrative || aiResponse.narrative.length < 3) {
        aiResponse.narrative = "Le flux magique est instable. L'action est en suspens...";
    }

    console.log("[AI PARSED] Actions détectées:", aiResponse.actions?.length || 0);
    const actions = aiResponse.actions || [];

    if (!aiResponse.narrative) {
        aiResponse.narrative = "Il ne se passe rien de spécial.";
    }

    // Save bot response to memory (Non-blocking)
    RPMessage.create({
        senderJid: 'bot',
        senderName: 'Arise MJ',
        content: aiResponse.narrative,
        location: player.location,
        subLocation: player.subLocation
    }).catch(e => console.error("[DB] MJ RPMessage log error:", e.message));

    // Collected quest feedback lines appended to the narrative after the loop.
    const questFeedback = [];

    // Process AI actions
    for (const actionObj of actions) {
      try {
      const { type, parameters } = actionObj;
      if (!parameters) continue;

      let target = player;
      if (parameters.target_name) {
          const foundTarget = await Player.findOne({
              where: {
                  name: parameters.target_name,
                  location: player.location,
                  subLocation: player.subLocation
              }
          });
          if (foundTarget) {
              target = foundTarget;
          }
      }

      // Track if target needs a final reload/save
      let targetModified = false;

      switch (type) {
        case 'update_player': {
          let hasChanged = false;
          if (parameters.col_change) { await target.increment('col', { by: parameters.col_change }); hasChanged = true; }
          if (parameters.xp_gain) { await target.increment('xp', { by: parameters.xp_gain }); await checkLevelUp(target, sock); hasChanged = true; }
          if (parameters.health_change) {
              await target.increment('health', { by: parameters.health_change });
              await target.reload();
              if (target.health > target.maxHealth) await target.update({ health: target.maxHealth });
              if (target.health <= 0) {
                  await target.update({ health: 0 });
                  if (parameters.is_hospitalized) {
                      await target.decrement('col', { by: 500 });
                      await target.reload();
                      if (target.col < 0) await target.update({ col: 0 });
                      await target.update({ health: 20 });
                      questFeedback.push(`🏥 *HOSPITALISATION* : ${target.name} a été sauvé de justesse. Coût des soins : 500 COL.`);
                  } else {
                      await target.update({ location: 'Nécropolis', subLocation: 'Le Seuil des Morts' });
                      questFeedback.push(`💀 *MORT* : L'âme de ${target.name} a quitté son corps. Il erre désormais à Nécropolis.`);
                      if (shouldNotifyPlayer(target)) {
                          await sock.sendMessage(target.whatsappId, { text: "💀 *TU ES MORT.*\n\nPersonne ne t'a secouru à temps. Ton âme a sombré dans l'Interstice et tu te réveilles désormais à Nécropolis, le monde des morts.\n\nSeule une résurrection magique par un vivant pourra te ramener." });
                      }
                  }
              }
              hasChanged = true;
          }
          if (parameters.max_health_change) { await target.increment('maxHealth', { by: parameters.max_health_change }); hasChanged = true; }
          if (parameters.mana_change) {
              await target.increment('mana', { by: parameters.mana_change });
              await target.reload();
              if (target.mana > target.maxMana) await target.update({ mana: target.maxMana });
              if (target.mana < 0) await target.update({ mana: 0 });
              hasChanged = true;
          }
          if (parameters.max_mana_change) { await target.increment('maxMana', { by: parameters.max_mana_change }); hasChanged = true; }
          if (parameters.strength_change) { await target.increment('strength', { by: parameters.strength_change }); hasChanged = true; }
          if (parameters.agility_change) { await target.increment('agility', { by: parameters.agility_change }); hasChanged = true; }
          if (parameters.intelligence_change) { await target.increment('intelligence', { by: parameters.intelligence_change }); hasChanged = true; }
          if (parameters.defense_change) { await target.increment('defense', { by: parameters.defense_change }); hasChanged = true; }
          if (parameters.luck_change) { await target.increment('luck', { by: parameters.luck_change }); hasChanged = true; }
          if (parameters.hunger_change) { await target.increment('hunger', { by: parameters.hunger_change }); hasChanged = true; }
          if (parameters.sleep_change) { await target.increment('sleep', { by: parameters.sleep_change }); hasChanged = true; }
          if (parameters.new_location) {
              await target.update({ location: parameters.new_location, subLocation: parameters.new_sub_location || 'Entrée' });
              const locationImages = { 'Académie Impériale': 'assets/locations/academy.jpg', 'Eldoria': 'assets/locations/eldoria.jpg' };
              if (locationImages[parameters.new_location] && !aiResponse.imagePrompt) aiResponse.imagePrompt = locationImages[parameters.new_location];
              hasChanged = true;
          }
          if (parameters.new_rank) { await target.update({ rank: parameters.new_rank }); hasChanged = true; }
          if (parameters.new_class) { await target.update({ class: parameters.new_class }); hasChanged = true; }
          if (parameters.schoolName) { await target.update({ schoolName: parameters.schoolName }); hasChanged = true; }
          if (parameters.characterDescription) { await target.update({ characterDescription: parameters.characterDescription }); hasChanged = true; }
          if (parameters.gender) { await target.update({ gender: parameters.gender }); hasChanged = true; }
          if (parameters.age) { await target.update({ age: parameters.age }); hasChanged = true; }
          if (parameters.profilePicUrl) { await target.update({ profilePicUrl: parameters.profilePicUrl }); hasChanged = true; }
          if (parameters.academicGrade_change) { await target.increment('academicGrade', { by: parameters.academicGrade_change }); hasChanged = true; }
          if (parameters.sp_gain) { await target.increment('skillPoints', { by: parameters.sp_gain }); hasChanged = true; }
          if (parameters.equippedOutfit) { await target.update({ equippedOutfit: parameters.equippedOutfit }); hasChanged = true; }

          if (hasChanged) {
              await target.reload();
              if (target.hunger > 100) await target.update({ hunger: 100 });
              if (target.sleep > 100) await target.update({ sleep: 100 });
              if (target.hunger < 0) await target.update({ hunger: 0 });
              if (target.sleep < 0) await target.update({ sleep: 0 });
          }
          break;
        }

        case 'add_skill': {
          if (parameters.skillName) {
            const skill = await Skill.findOne({
                where: {
                    [Op.or]: [
                        { name: { [Op.like]: `%${parameters.skillName}%` } },
                        { name: parameters.skillName }
                    ]
                }
            });
            if (skill) {
              const hasSkill = await target.hasSkill(skill);
              if (!hasSkill) {
                await target.addSkill(skill);
                console.log(`[AI] Skill added to ${target.name}: ${skill.name}`);
                const bonuses = skill.statBonuses;
                for (const [stat, value] of Object.entries(bonuses)) {
                  if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                    await target.increment(stat, { by: value });
                  }
                }
                await target.save();
                await target.reload();
              }
            }
          }
          break;
        }

        case 'buy_item': {
            if (parameters.itemName && parameters.quantity) {
                const item = await Item.findOne({ where: { name: { [Op.like]: `%${parameters.itemName}%` } } });
                if (item) {
                    const totalPrice = item.price * parameters.quantity;
                    if (target.col >= totalPrice) {
                        await target.decrement('col', { by: totalPrice });

                        const inventory = [...target.inventory];
                        const existingItem = inventory.find(i => i.name.toLowerCase() === item.name.toLowerCase());
                        if (existingItem) existingItem.quantity += parameters.quantity;
                        else inventory.push({ name: item.name, quantity: parameters.quantity });

                        target.inventory = inventory;
                        await target.save();
                        await target.reload();
                        questFeedback.push(`🛒 *ACHAT IA* : ${target.name} a acheté ${parameters.quantity}x ${item.name} pour ${totalPrice} COL.`);
                    } else {
                        questFeedback.push(`❌ *ÉCHEC ACHAT* : ${target.name} n'a pas assez de COL pour ${item.name}.`);
                    }
                }
            }
            break;
        }

        case 'add_item': {
          if (parameters.itemName && parameters.quantity) {
            const inventory = [...target.inventory];
            const existingItem = inventory.find(i => i.name.toLowerCase() === parameters.itemName.toLowerCase());

            if (existingItem) {
                existingItem.quantity += parameters.quantity;
            } else {
                inventory.push({ name: parameters.itemName, quantity: parameters.quantity });
            }

            target.inventory = inventory;
            await target.save();

            const itemData = await Item.findOne({ where: { name: { [Op.like]: `%${parameters.itemName}%` } } });
            if (itemData) {
                const bonuses = itemData.statBonuses;
                let itemModified = false;
                for (const [stat, value] of Object.entries(bonuses)) {
                    if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                        await target.increment(stat, { by: value * parameters.quantity });
                        itemModified = true;
                    }
                }
                if (itemModified) {
                    await target.save();
                    await target.reload();
                }
                if (itemData.imageUrl && !aiResponse.imagePrompt && target.whatsappId === player.whatsappId) {
                    aiResponse.imagePrompt = itemData.imageUrl;
                }
            }
          }
          break;
        }

        case 'remove_item': {
            if (parameters.itemName && parameters.quantity) {
                let inventory = [...target.inventory];
                const itemIndex = inventory.findIndex(i => i.name.toLowerCase() === parameters.itemName.toLowerCase());
                if (itemIndex !== -1) {
                    const actualQuantityToRemove = Math.min(parameters.quantity, inventory[itemIndex].quantity);
                    inventory[itemIndex].quantity -= actualQuantityToRemove;

                    if (inventory[itemIndex].quantity <= 0) {
                        inventory.splice(itemIndex, 1);
                    }

                    target.inventory = inventory;
                    await target.save();

                    const itemData = await Item.findOne({ where: { name: { [Op.like]: `%${parameters.itemName}%` } } });
                    if (itemData) {
                        const bonuses = itemData.statBonuses;
                        for (const [stat, value] of Object.entries(bonuses)) {
                            if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                                await target.decrement(stat, { by: value * actualQuantityToRemove });
                            }
                        }
                        await target.save();
                        await target.reload();
                    }
                }
            }
            break;
        }

        case 'update_item': {
            if (parameters.itemName) {
                const item = await Item.findOne({ where: { name: parameters.itemName } });
                if (item) {
                    if (parameters.durability_change) {
                        await item.increment('durability', { by: parameters.durability_change });
                    }
                    if (parameters.new_durability) {
                        await item.update({ durability: parameters.new_durability });
                    }
                }
            }
            break;
        }

        case 'interact_npc': {
            if (parameters.npcName) {
                const npc = await NPC.findOne({ where: { name: { [Op.like]: `%${parameters.npcName}%` } } });
                if (npc) {
                    console.log(`[AI] Interaction avec PNJ: ${npc.name}`);
                }
            }
            break;
        }

        case 'notify_player': {
            if (parameters.target_name && parameters.message) {
                const notifyTarget = await Player.findOne({
                    where: {
                        name: { [Op.like]: `%${parameters.target_name}%` }
                    }
                });
                if (notifyTarget && shouldNotifyPlayer(notifyTarget)) {
                    const { resolveMentions } = require('./message-handler');
                    const { text: msgText, mentions } = await resolveMentions(parameters.message);
                    await sock.sendMessage(notifyTarget.whatsappId, {
                        text: `🔔 *Message de RP*\n\n${msgText}`,
                        mentions
                    });
                }
            }
            break;
        }

        case 'broadcast_global': {
            if (parameters.message) {
                const { resolveMentions } = require('./message-handler');
                const { text: msgText, mentions } = await resolveMentions(parameters.message);
                const allPlayers = await Player.findAll();
                for (const p of allPlayers) {
                    if (shouldNotifyPlayer(p)) {
                        await sock.sendMessage(p.whatsappId, {
                            text: `🌎 *ANNONCE MONDIALE*\n\n${msgText}`,
                            mentions
                        });
                    }
                }
            }
            break;
        }

        case 'broadcast': {
            if (parameters.message) {
                const { resolveMentions } = require('./message-handler');
                const { text: msgText, mentions } = await resolveMentions(parameters.message);
                for (const other of nearbyPlayers) {
                    if (other.whatsappId !== player.whatsappId && shouldNotifyPlayer(other)) {
                        await sock.sendMessage(other.whatsappId, {
                            text: `📣 *Annonce RP*\n\n${msgText}`,
                            mentions
                        });
                    }
                }
            }
            break;
        }

        case 'start_quest': {
            if (parameters.questTitle) {
                const line = await questUtils.startQuest(target, parameters.questTitle);
                if (line) questFeedback.push(line);
            }
            break;
        }

        case 'advance_quest': {
            if (parameters.questTitle) {
                const line = await questUtils.advanceQuest(target, parameters.questTitle, parameters.progress, parameters.note);
                if (line) questFeedback.push(line);
            }
            break;
        }

        case 'complete_quest': {
            if (parameters.questTitle) {
                const line = await questUtils.completeQuest(target, parameters.questTitle, sock);
                if (line) questFeedback.push(line);
            }
            break;
        }

        case 'update_quest': { // AI modifies the course of a quest
            if (parameters.questTitle) {
                const line = await questUtils.modifyQuest(target, parameters.questTitle, parameters.branch, parameters.notes);
                if (line) questFeedback.push(line);
            }
            break;
        }

        case 'start_multiplayer_quest': {
            if (parameters.questTitle) {
                const res = await questUtils.startMultiplayerQuest(player, parameters.questTitle);
                if (res) {
                    questFeedback.push(`🤝 *Quête coopérative lancée* : ${res.quest.title}`);
                    for (const n of res.notified) {
                        if (shouldNotifyPlayer(n.player)) {
                            await sock.sendMessage(n.player.whatsappId, {
                                text: `🤝 *Quête coopérative !*\n${player.name} t'embarque dans une quête.\n\n${n.line}`
                            });
                        }
                    }
                }
            }
            break;
        }

        case 'forge_pact': {
            if (parameters.entityName) {
                const entity = await Entity.findOne({
                    where: { name: { [Op.like]: `%${parameters.entityName}%` } },
                    include: [{ model: Player, as: 'Players' }]
                });
                if (entity) {
                    const pactCount = entity.Players?.length || 0;
                    if (pactCount > 0) {
                        questFeedback.push(`⚠️ *ÉCHEC DU PACTE* : ${entity.name} est déjà lié à un autre mortel. Un seul élu par entité.`);
                    } else {
                        const hasPact = await target.hasEntity(entity);
                        if (!hasPact) {
                            await target.addEntity(entity);
                            const bonuses = entity.pactBonus || {};
                            for (const [stat, value] of Object.entries(bonuses)) {
                                if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                                    await target.increment(stat, { by: value });
                                }
                            }
                            await target.save();
                            await target.reload();
                            questFeedback.push(`🔥 *PACT FORGÉ* : Tu es désormais lié à ${entity.name}.`);
                        }
                    }
                }
            }
            break;
        }

        case 'join_club': {
            if (parameters.clubName) {
                const club = await Club.findOne({ where: { name: { [Op.like]: `%${parameters.clubName}%` } } });
                if (club) {
                    const hasClub = await target.hasClub(club);
                    if (!hasClub) {
                        await target.addClub(club);
                        questFeedback.push(`🏫 *CLUB REJOINT* : Tu es désormais membre du ${club.name}.`);
                    }
                }
            }
            break;
        }

        case 'resurrect_player': {
            if (parameters.target_name) {
                const deadPlayer = await Player.findOne({ where: { name: parameters.target_name, location: 'Nécropolis' } });
                if (deadPlayer) {
                    let caster = player;
                    if (parameters.caster_name) {
                        const foundCaster = await Player.findOne({
                            where: {
                                name: parameters.caster_name,
                                location: player.location,
                                subLocation: player.subLocation
                            }
                        });
                        if (foundCaster) caster = foundCaster;
                    }

                    // Caster sacrifice
                    const sacrifice = Math.floor(caster.maxHealth * 0.5);
                    await caster.decrement('health', { by: sacrifice });
                    await caster.reload();
                    if (caster.health < 1) await caster.update({ health: 1 }); // Prevent double death if possible

                    // Resurrection
                    await deadPlayer.update({
                        location: parameters.new_location || 'Eldoria',
                        subLocation: 'Cimetière',
                        health: Math.floor(deadPlayer.maxHealth * 0.1) // Returns with low HP
                    });

                    questFeedback.push(`✨ *RÉSURRECTION* : ${deadPlayer.name} a été rappelé du monde des morts par ${caster.name}. Sacrifice de ${sacrifice} PV.`);

                    if (shouldNotifyPlayer(deadPlayer)) {
                        await sock.sendMessage(deadPlayer.whatsappId, {
                            text: `✨ *TU ES REVENU !*\n\n${caster.name} a sacrifié sa propre force vitale pour te ramener à la vie. Tu te réveilles à ${deadPlayer.location}, affaibli mais vivant.`
                        });
                    }
                }
            }
            break;
        }

        case 'write_journal': {
            if (parameters.entry) {
                await WorldJournal.create({
                    entry: parameters.entry,
                    importance: parameters.importance || 1,
                    category: parameters.category || 'general'
                });
                console.log(`[JOURNAL] Nouvelle entrée : ${parameters.entry}`);
            }
            break;
        }
      }

      // Notify target if it's not the current player
      if (target.whatsappId !== player.whatsappId && shouldNotifyPlayer(target)) {
          await sock.sendMessage(target.whatsappId, {
              text: `🔔 *NOTIFICATION RP*\n\n${player.name} a interagi avec toi !\n\n${aiResponse.narrative}`
          });
      }
      } catch (actionError) {
          console.error(`[AI] Erreur lors du traitement d'une action (${actionObj.type}):`, actionError);
      }
    }

    // Additional player notifications
    if (Array.isArray(aiResponse.notifications)) {
      for (const notice of aiResponse.notifications) {
        if (!notice || !notice.target_name || !notice.message) continue;
        const targetPlayer = await Player.findOne({ where: { name: { [Op.like]: `%${notice.target_name}%` }, location: player.location } });
        if (targetPlayer && targetPlayer.subLocation !== player.subLocation) continue;
        if (targetPlayer && shouldNotifyPlayer(targetPlayer)) {
          await sock.sendMessage(targetPlayer.whatsappId, {
            text: `🔔 *Message de RP*\n\n${notice.message}`
          });
        }
      }
    }

    if (aiResponse.broadcastMessage) {
      for (const other of nearbyPlayers) {
        if (other.whatsappId !== player.whatsappId && shouldNotifyPlayer(other)) {
          await sock.sendMessage(other.whatsappId, {
            text: `📣 *Annonce RP*\n\n${aiResponse.broadcastMessage}`
          });
        }
      }
    }

    // Append quest progression feedback to the narrative.
    if (questFeedback.length > 0) {
      aiResponse.narrative = `${aiResponse.narrative}\n\n${questFeedback.join('\n\n')}`;
    }

    // Prepend World Clock Header
    aiResponse.narrative = `${getWorldHeader()}\n\n${aiResponse.narrative}`;

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
