const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, WorldJournal, Monster, Entity, Club, Pact, House, Duel, TournamentParticipant } = require('./database');
const { sendWithImage, shouldNotifyPlayer } = require('./message-handler');
const { generatePaperImage } = require('./paper-generator');
const { generate3DVisual } = require('./three-renderer');
const { generateActionVisual } = require('./action-visual-generator');
const { generateProfileCard } = require('./profile-generator');
const { Op } = require('sequelize');
const agent = require('./aether-agent');
const questUtils = require('./quest-utils');
const { processActions, applyPlayerUpdates } = require('./action-processor');
const arenaHandler = require('./arena-handler');
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

  // Scene Logic: Detect players in the same sub-location (Immediate view)
  // and players in the same kingdom (Potential interaction/navigation)
  const sceneFilter = {
      location: player.location,
      subLocation: player.subLocation
  };

  // AI Automation Logic:
  // Solo Scene -> Immediate Response
  // Multiplayer Scene -> Requires 'next' for sync

  const isTriggerWord = actionText.toLowerCase().trim() === 'next';

  // Find the last MJ message to define the current "turn"
  const lastMJMessage = await RPMessage.findOne({
      where: { senderName: 'Arise MJ', ...sceneFilter },
      order: [['id', 'DESC']]
  });

  // Check for players in 'action' mode here (for info only)
  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        subLocation: player.subLocation,
        mode: 'action',
        whatsappId: { [Op.ne]: player.whatsappId },
        lastActivity: { [Op.gt]: new Date(Date.now() - 5 * 60 * 1000) }
    }
  });

  const isSolo = nearbyPlayers.length === 0;

  // SYSTEM SYNC: 'next' is mandatory for multiplayer scenes. Solo players get immediate response.
  if (!isSolo && !isTriggerWord) {
      // Find all players who have acted since the last MJ message
      const pendingActions = await RPMessage.findAll({
          where: {
              ...sceneFilter,
              senderName: { [Op.ne]: 'Arise MJ' },
              id: { [Op.gt]: lastMJMessage ? lastMJMessage.id : 0 },
              content: { [Op.notLike]: 'next' }
          }
      });

      const pendingNames = [...new Set(pendingActions.map(a => a.senderName))];

      let statusText = `⏳ *Action de ${player.name} enregistrée.*`;
      if (pendingNames.length > 0) {
          statusText += `\n\nJoueurs prêts : ${pendingNames.join(', ')}.`;
      }
      statusText += "\n\nTapez `next` pour déclencher la narration du MJ.";

      await sock.sendMessage(jid, { text: statusText });
      return;
  }

  // If we reached here, we are triggering the AI (either solo or 'next')
  let thinkingMsg = null;
  try {
      await sock.sendPresenceUpdate('composing', jid);
      thinkingMsg = await sock.sendMessage(jid, { text: "🧠 *Le MJ réfléchit...*" });
  } catch (e) {}

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
  const otherPlayerNamesInKingdom = playersInKingdom.map(p => p.name);

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

  const hints = [];
  if (hasMovement) hints.push("⚠️ UN JOUEUR SOUHAITE SE DÉPLACER. Priorise 'update_location' et la description du nouveau lieu.");
  if (hasInteraction) {
      hints.push("⚠️ UNE INTERACTION ENTRE JOUEURS EST EN COURS. Ne l'interromps pas avec des PNJ.");
      if (interactionTargetSubLocation) {
          hints.push(`⚠️ LE JOUEUR ESSAIE D'INTERAGIR AVEC QUELQU'UN À '${interactionTargetSubLocation}'. Propose-lui de se déplacer là-bas ou fais-les se rencontrer.`);
      }
  }
  if (!isSolo) hints.push("⚠️ PLUSIEURS JOUEURS SONT PRÉSENTS DANS LA MÊME PIÈCE. Priorise leur interaction directe. Ne crée PAS de PNJ sauf nécessité absolue. Si l'un parle à l'autre, l'autre DOIT répondre ou subir les conséquences.");
  hints.push("⚠️ APPLIQUE LES LOIS DU ROYAUME. Si un joueur commet un crime ou manque de respect aux Ducs/Rois, déclenche une punition immédiate et sévère (jusqu'à la mort ou l'emprisonnement).");

  // EXAM LOGIC HINT
  if (player.subLocation.toLowerCase().includes('académie') || player.subLocation.toLowerCase().includes('école')) {
      hints.push("⚠️ EXAMEN EN COURS : Si le joueur répond aux questions de l'examinateur, utilise 'add_skill' pour lui donner le skill souhaité s'il a réussi le test narratif.");
  }

  // ATR ARENA - Check for active duel
  let activeDuel = null;
  try {
      activeDuel = await Duel.findOne({
          where: {
              [Op.or]: [
                  { playerAJid: player.whatsappId },
                  { playerBJid: player.whatsappId }
              ],
              status: 'active'
          }
      });
  } catch (e) {
      console.warn("[Arena] Duel query failed, probably table not ready.");
  }

  if (activeDuel) {
      const duelOpponentJid = activeDuel.playerAJid === player.whatsappId ? activeDuel.playerBJid : activeDuel.playerAJid;
      const duelOpponent = await Player.findByPk(duelOpponentJid);

      if (duelOpponent) {
          hints.push(`⚠️ COMBAT JCJ EN COURS (ATR ARENA). Tu es l'Arbitre. Opposant: ${duelOpponent.name}.`);
          hints.push("⚠️ UTILISE L'ANALYSE TACTIQUE : Précision du membre visé, distance, et stats pour valider le coup.");
      }
  }

    // Survival Depletion Logic (Action-based: 1 action = 10 mins RP)
    // -3 hunger per RP hour -> -0.5 per action
    // -2 sleep per RP hour -> -0.33 per action
    const hungerLoss = 0.5;
    const sleepLoss = 0.33;

    // We apply these changes only when 'next' is triggered (meaning the world moves)
    await player.update({
        hunger: Math.max(0, player.hunger - hungerLoss),
        sleep: Math.max(0, player.sleep - sleepLoss),
        lastActivity: new Date()
    });

    if (player.hunger === 0) {
        await player.decrement('health', { by: 1 }); // Starvation
  }

  const playerState = `Nom:${player.name}${player.isGod?'(GOD)':''} | Sexe:${player.gender} | Age:${player.age} | Métier:${player.occupation} | Org:${player.organization} | Inf:${player.influence} | Bio:${player.characterDescription} | Fam:${player.family} | Classe:${player.class}(${player.derivative}) | SP:${player.skillPoints} | Rang:${player.rank} | Niv:${player.level} | XP:${player.xp}/${player.level*100} | PV:${player.health}/${player.maxHealth} | PM:${player.mana}/${player.maxMana} | Hunger:${player.hunger}/100 | Sleep:${player.sleep}/100 | Col:${player.col} | Wanted:${player.wantedLevel}/10 | Prisonnier:${player.isPrisoner?'OUI':'NON'} | Lieu:${player.location} (${player.subLocation}) | STATS: FOR:${player.strength} AGI:${player.agility} INT:${player.intelligence} DEF:${player.defense} LUK:${player.luck}`;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0 ? "Inv: " + inventory.map(i => i.name).join(',') : "Inv: vide";

  const playerQuests = await player.getQuests();
  const activeQuests = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress');
  const questState = activeQuests.length > 0 ? "Quêtes: " + activeQuests.map(q => `${q.title}(Objectif:${q.objective}, Progrès:${q.PlayerQuest.progress}%, Récompenses:${q.reward_col}Col/${q.reward_xp}XP)`).join(',') : "Pas de quête";

  const availableQuests = await Quest.findAll({ where: { rank_required: player.rank }, limit: 2 });
  const availableQuestState = "Quêtes Dispo: " + availableQuests.map(q => q.title).join(',');

  const skillsToLearn = await Skill.findAll({ order: sequelize.random(), limit: 5 });
  const skillsState = "Skills Apprenables: " + skillsToLearn.map(s => `${s.name}(${s.type})`).join(', ');

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

      return {
          nom: p.name,
          est_god: p.isGod,
          lieu_precis: p.subLocation,
          est_proche: p.subLocation === player.subLocation,
          est_acteur: (actingPlayerNames.has(p.name) || p.whatsappId === player.whatsappId),
          etat: `Sexe:${p.gender} | Age:${p.age} | Niv:${p.level} | Rang:${p.rank} | PV:${p.health}/${p.maxHealth} | PM:${p.mana}/${p.maxMana} | Faim:${p.hunger} | Sommeil:${p.sleep} | Argent(Col):${p.col} | Banque:${pBank.balance} | FOR:${p.strength} AGI:${p.agility} INT:${p.intelligence} DEF:${p.defense} LUK:${p.luck} | SP:${p.skillPoints}`,
          description: p.characterDescription,
          classe: `${p.class}(${p.derivative})`,
          metier: p.occupation,
          organisation: p.organization,
          influence: p.influence,
          inventaire: (p.inventory || []).map(i => i.name),
          competences: pSkills.map(s => `${s.name} (${s.description})`),
          pactes: pPacts.map(e => `${e.name}: ${e.description}`),
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

  // Fetch history (last 75 messages) for Short Term Memory
  const history = await RPMessage.findAll({
      where: sceneFilter,
      order: [['id', 'DESC']],
      limit: 75
  });
  const historyState = history.length > 0
    ? history.reverse().map(h => ({ sender: h.senderName, msg: h.content }))
    : [];

  // Fetch World Journal entries for Long Term Memory
  const journal = await WorldJournal.findAll({
      order: [['id', 'DESC']],
      limit: 40
  });
  const journalState = journal.length > 0
    ? journal.reverse().map(j => ({ cat: j.category, entry: j.entry }))
    : [];

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0 ? "Skills: " + playerSkills.map(s => s.name).join(', ') : "Aucun skill";

  const allKingdoms = await Kingdom.findAll();
  const worldGeography = allKingdoms.map(k => `- ${k.name}: ${k.description}`).join('\n');

  // Find current kingdom lore even if location is a city name
  let kingdom = allKingdoms.find(k => k.name === player.location);
  if (!kingdom) {
      // Fallback: search if the current location is mentioned in any kingdom's description (as a city)
      kingdom = allKingdoms.find(k => k.description.toLowerCase().includes(player.location.toLowerCase()));
  }
  const subLocContext = kingdom ? `\nLORE_LIEU: ${kingdom.description}` : "";

  const npcs = await NPC.findAll({
    where: {
        [Op.and]: [
            {
                [Op.or]: [
                    { location: { [Op.like]: `%${player.location}%` } },
                    { powerLevel: { [Op.gte]: 95 } } // Only include absolute legends/bosses
                ]
            },
            { role: { [Op.notLike]: '%Garde%' } },
            { role: { [Op.notLike]: '%Policier%' } }
        ]
    },
    order: sequelize.random(),
    limit: 5 // Reduced to prevent AI from feeling forced to use them
  });
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

    // Updated Time Logic: Action-based
    const rpTime = await getRPTime();
  const rpYearString = rpTime.formatted;
  const cycleInfo = rpTime.isDay ? "JOUR (Soleil, visibilité claire)" : "NUIT (Lune, ombres, visibilité réduite)";
  const weather = getWeather();

    // Mini-Event Trigger (20% chance)
    const triggerMiniEvent = Math.random() < 0.20;
    const miniEventContext = triggerMiniEvent
        ? "\n⚠️ **ÉVÉNEMENT IMPRÉVU**: Un événement aléatoire doit se produire maintenant ! (Ex: Un monstre surgit, une annonce impériale, un objet mystérieux trouvé, etc.)"
        : "";

const systemPrompt = `Tu es le MAÎTRE DU JEU (MJ) d'AETHERYS. Tu es l'unique narrateur et Dieu de ce monde. Les joueurs sont les acteurs de ton récit, mais tu ne les contrôles pas.

### ZÉRO HALLUCINATION & MJ PUR (STRICT) ###
1. **NE JOUE PAS LE JOUEUR :** Tu ne décris JAMAIS les pensées, les paroles ou les mouvements futurs du joueur. Tu décris uniquement la réaction du monde et des PNJ.
2. **PAS DE "TU FAIS" :** Ne commence jamais ta narration par "Tu..." suivi d'une action. L'action du joueur est déjà faite. Réponds directement par les CONSÉQUENCES (Ex: "L'épée siffle dans l'air, le gobelin est tranché net.").

### SYSTÈME DE COMBAT & ÉCHELLE DE PUISSANCE ###
1. **FACILITÉ SI PUISSANT :** Si les stats du joueur (Niveau, FOR, AGI) sont largement supérieures à celles de l'ennemi (différence > 15), le combat est trivial. Le joueur massacre ses ennemis sans effort et avec style. Pas de difficulté inutile pour un demi-dieu.
2. **RÉALISME BRUTAL SI FAIBLE :** Si le joueur est de petit rang et fait n'importe quoi, il meurt ou subit des dégâts massifs [HP -50]. Pas de pitié pour les imprudents.

### CHILL ANIME ACADEMY (VIBE) ###
1. **AMBIANCE LYCÉE JAPONAIS :** Dans les académies, l'ambiance doit être détendue, drôle et vivante.
2. **HUMOUR & SCÈNES COMIQUES :** Incorpore des situations drôles, des malentendus ou des réactions exagérées typiques des animés.
3. **ECCHI & SEXY :** N'hésite pas à décrire des scènes sexy, du fan-service léger ou des situations embarrassantes (tenues déchirées, regards suggestifs, proximité troublante) avec un ton "Shonen/Seinen mature".

### ACTUALISATION DES FICHES EN TEMPS RÉEL (STRICT) ###
1. **SYNCHRONISATION LOGIQUE :** Tu DOIS utiliser l'objet "updates" dans ton JSON pour refléter CHAQUE changement narratif instantanément.
2. **MODIFICATEURS STATS :** Utilise aussi les balises dans la narration pour confirmation visuelle : [HP +/-X], [MP +/-X], [XP +X], [FOR/AGI/INT/DEF/LUK +/-X], [COL +/-X].

### STYLE NARRATIF ###
1. **FRANÇAIS SIMPLE (A1/A2) :** Phrases courtes. Impact maximum. Pas de fioritures.
2. **BRUITS D'ANIME :** Utilise des bruits (*BAM!*, *SHRING!*, *KYAAAA!*, *DODODO!*).
3. **UN SEUL PARAGRAPHE :** Un seul bloc de texte par joueur actif.

FORMAT JSON STRICT: {
  "pensee_mj": "Analyse logique du tour et de la puissance",
  "narrative": "[JOUEUR1]\nNarration...\n▬▬▬▬▬▬▬▬▬▬▬▬\n[JOUEUR2]\nNarration...",
  "updates": [{"playerName": "Nom", "hp": -10, "xp": 20, "status": ["exité"]}],
  "actions": [],
  "imagePrompt": "Description visuelle pour SDXL"
}

ACTIONS : update_location, update_stats, buy_item, use_item, add_skill, spawn_npc, spawn_monster, write_journal, advance_quest, complete_quest, query_database, submit_player, npc_trade, p2p_transfer.`;


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
            skills_disponibles: skillsToLearn.map(s => ({ nom: s.name, type: s.type, desc: s.description })),
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

    // Logic Bridge: Add a 'World Pulse' for luck/dice results
    const worldPulse = {
        luck_seed: Math.floor(Math.random() * 100),
        critical_success: Math.random() < 0.05,
        weather_impact: weather === 'Pluvieux' ? "AGI malus" : "Normal"
    };

    const fullPrompt = `### WORLD_PULSE (DICE/LUCK) ###\n${JSON.stringify(worldPulse)}

### MÉMOIRE_SYSTÈME_JSON (CONTEXTE DÉTAILLÉ PAR JOUEUR) ###\n${memoryJson}

### RÉSUMÉ DES ACTIONS À TRAITER ###
${actionSummary}

### HINTS & DIRECTIVES IMMÉDIATES ###
${hints.join('\n')}

CONSIGNE DE COHÉRENCE MULTI-JOUEUR:
1. TRAITE CHAQUE JOUEUR INDIVIDUELLEMENT : Ne mélange pas leurs inventaires, leurs stats ou leurs histoires.
2. RÉGIS LEURS INTERACTIONS : Si Joueur A attaque Joueur B, utilise STRICTEMENT leurs stats respectives fournies dans le JSON.
3. PRÉCISION NARRATIVE : Ta réponse doit clairement identifier qui fait quoi et quelles sont les conséquences pour CHAQUE acteur.
4. IMMOBILITÉ DES SPECTATEURS : Ceux qui n'ont pas d'actions récentes sont présents mais ne bougent pas d'un pouce. Ne les invente pas.
5. VÉRIFICATION DE PERSISTANCE : Ta narration doit explicitement mentionner ou résoudre CHAQUE action listée dans le RÉSUMÉ DES ACTIONS.
6. STRUCTURE OBLIGATOIRE : Utilise [NOM_DU_JOUEUR] et le séparateur ▬▬▬▬▬▬▬▬▬▬▬▬.

ATTENTION : Si tu mélanges les fils narratifs ou les inventaires, le système rencontrera une erreur de segmentation. RESTE ÉTANCHE.`;

  try {
    console.log(`[AI] Interne (AetherEngine) pour ${player.name}...`);
    // Local-first deterministic processing - Use aggregated actions for context
    const effectiveAction = isSolo ? actionText : aggregatedActions;
    let content = await agent.processPlayerTurn(systemPrompt, fullPrompt, effectiveAction, player, player.location);

    // Delete thinking message
    if (thinkingMsg) {
        try {
            await sock.sendMessage(jid, { delete: thinkingMsg.key });
        } catch (e) {}
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
        // Remove markdown wrappers if present
        let cleanedContent = content.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Attempt to fix common LLM JSON errors before parsing
        const sanitizeJsonStr = (str) => {
            return str.replace(/,\s*([\]}])/g, '$1') // Trailing commas
                      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // Unquoted keys
                      .replace(/: \s*'(.*?)'\s*([,}])/g, ': "$1"$2'); // Single quotes for values
        };

        let start = cleanedContent.indexOf('{');
        let end = cleanedContent.lastIndexOf('}');

        if (start !== -1 && end !== -1 && end > start) {
            const potentialJson = cleanedContent.substring(start, end + 1);
            try {
                const parsed = JSON.parse(potentialJson);
                aiResponse = { ...aiResponse, ...parsed };
            } catch (e) {
                try {
                    const sanitized = sanitizeJsonStr(potentialJson);
                    aiResponse = { ...aiResponse, ...JSON.parse(sanitized) };
                } catch (e2) {
                    console.warn("[AI] Big JSON block failed to parse even after sanitization, attempting block extraction...");
                    const matches = [...cleanedContent.matchAll(/\{[\s\S]*?\}/g)];
                    for (const match of matches) {
                        try {
                            const part = JSON.parse(match[0]);
                            if (part.actions) aiResponse.actions = [...(aiResponse.actions || []), ...part.actions];
                            if (part.narrative && (!aiResponse.narrative || part.narrative.length > aiResponse.narrative.length)) aiResponse.narrative = part.narrative;
                            if (part.imagePrompt) aiResponse.imagePrompt = part.imagePrompt;
                            if (part.pensee_mj) aiResponse.pensee_mj = part.pensee_mj;
                        } catch (innerE) {
                             try {
                                 const part = JSON.parse(sanitizeJsonStr(match[0]));
                                 if (part.actions) aiResponse.actions = [...(aiResponse.actions || []), ...part.actions];
                                 if (part.narrative && (!aiResponse.narrative || part.narrative.length > aiResponse.narrative.length)) aiResponse.narrative = part.narrative;
                                 if (part.pensee_mj) aiResponse.pensee_mj = part.pensee_mj;
                             } catch(innerE2) {}
                        }
                    }
                }
            }
            if (aiResponse.pensee_mj) console.log(`[MJ THOUGHTS] ${aiResponse.pensee_mj}`);
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

    // FINAL VALIDATION: If narrative is STILL empty but we have actions, create a default narrative
    if ((!aiResponse.narrative || aiResponse.narrative.length < 5) && aiResponse.actions && aiResponse.actions.length > 0) {
        aiResponse.narrative = "Le monde réagit à tes impulsions. Les changements ont été appliqués à la trame de la réalité.";
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
                'Empire Impérial d\'Elion': 'assets/locations/eldoria.jpg',
                'Royaume de Valkyrr': 'assets/locations/academy.jpg',
                'Terres Bestiales': 'assets/locations/interstice.jpg',
                'Royaume Céleste': 'assets/locations/interstice.jpg',
                'Dominion Noir de Vharos': 'assets/locations/necropolis.jpg',
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
    if (typeof aiResponse.narrative === 'string' && aiResponse.narrative.match(/3D|scan|hologramme/i) && !aiResponse.imagePrompt) {
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

    // Logic Verification & Automatic Synchronization
    // Scrape narrative for status tags like [HP -10] to fix AI forgetfulness
    const narrativeActions = [];

    // Global Tag Scraper (Detects [TAG +/-X] or TAG: +/-X)
    const scrapeTag = (tagName, patterns) => {
        for (const p of patterns) {
            const match = aiResponse.narrative.match(p);
            if (match) return match[1];
        }
        return null;
    };

    // Health
    const hpVal = scrapeTag('HP', [/\[(?:HP|PV)\s*([+-]\d+)\]/i, /(?:HP|PV)\s*:\s*([+-]\d+)/i]);
    const hpAbs = scrapeTag('HP_ABS', [/\[(?:HP|PV)\s*(\d+)\]/i, /(?:HP|PV)\s*:\s*(\d+)/i]);
    if (hpVal) narrativeActions.push({ type: 'update_stats', parameters: { health_change: parseInt(hpVal) } });
    else if (hpAbs) narrativeActions.push({ type: 'update_stats', parameters: { health_set: parseInt(hpAbs) } });

    // Mana
    const mpVal = scrapeTag('MP', [/\[(?:MP|PM|MANA)\s*([+-]\d+)\]/i, /(?:MP|PM|MANA)\s*:\s*([+-]\d+)/i]);
    if (mpVal) narrativeActions.push({ type: 'update_stats', parameters: { mana_change: parseInt(mpVal) } });

    // Col
    const colVal = scrapeTag('COL', [/\[(?:COL|OR|ARGENT)\s*([+-]\d+)\]/i, /(?:COL|OR|ARGENT)\s*:\s*([+-]\d+)/i]);
    if (colVal) narrativeActions.push({ type: 'update_stats', parameters: { col_change: parseInt(colVal) } });

    // XP & SP
    const xpVal = scrapeTag('XP', [/\[XP\s*([+-]\d+)\]/i, /XP\s*:\s*([+-]\d+)/i]);
    if (xpVal) narrativeActions.push({ type: 'update_stats', parameters: { xp_gain: parseInt(xpVal) } });
    const spVal = scrapeTag('SP', [/\[SP\s*([+-]\d+)\]/i, /SP\s*:\s*([+-]\d+)/i]);
    if (spVal) narrativeActions.push({ type: 'update_stats', parameters: { sp_change: parseInt(spVal) } });

    // Stats
    const statsToScrape = { strength: 'FOR', agility: 'AGI', intelligence: 'INT', defense: 'DEF', luck: 'LUK' };
    for (const [key, tag] of Object.entries(statsToScrape)) {
        const sVal = scrapeTag(key, [new RegExp(`\\[${tag}\\s*([+-]\\d+)\\]`, 'i'), new RegExp(`${tag}\\s*:\\s*([+-]\\d+)`, 'i')]);
        if (sVal) narrativeActions.push({ type: 'update_stats', parameters: { [`${key}_change`]: parseInt(sVal) } });
    }

    if (narrativeActions.length > 0) {
        console.log(`[Logic] Auto-injected ${narrativeActions.length} actions from narrative tags.`);
        aiResponse.actions = [...(aiResponse.actions || []), ...narrativeActions];
    }

    const lowNarrative = aiResponse.narrative.toLowerCase();
    const isFallback = aiResponse.narrative.includes("[🤖 MJ FALLBACK]");

    // Improved death detection: only trigger if it looks like an ACTIVE death event for a player
    // AND we are NOT in fallback mode (to avoid false positives from the fallback template)
    if (!isFallback) {
        // More specific death markers to avoid false positives from lore or NPCs
        const currentPNameLow = player.name.toLowerCase();
        const deathMarkers = [
            `tu meurs`, `tu succombes`, `ton souffle s'arrête`, `ta vie s'échappe`,
            `${currentPNameLow} meurt`, `${currentPNameLow} succombe`, `${currentPNameLow} rend l'âme`,
            `${currentPNameLow} s'écroule, sans vie`, `${currentPNameLow} est inerte`
        ];

        const isPlayerDead = deathMarkers.some(m => lowNarrative.includes(m));

        if (isPlayerDead && !aiResponse.actions.some(a => a.type === 'update_stats' && (a.parameters.health_change <= -50 || a.parameters.health_set === 0))) {
            console.log("[Logic] Detected unhandled player death intent in narrative. Auto-applying critical damage.");
            aiResponse.actions.push({ type: 'update_stats', parameters: { health_change: -100 } });
        }
    }
    if ((lowNarrative.includes("achète") || lowNarrative.includes("paye")) && !aiResponse.actions.some(a => ['buy_item', 'npc_trade', 'update_stats'].includes(a.type))) {
        console.log("[Logic] Detected unhandled purchase intent.");
    }

    // Save bot response to memory (Non-blocking)
    RPMessage.create({
        senderJid: 'bot',
        senderName: 'Arise MJ',
        content: aiResponse.narrative,
        location: player.location,
        subLocation: player.subLocation
    }).catch(e => console.error("[DB] MJ RPMessage log error:", e.message));

    // Process actions via unified logic engine
    const { questFeedback, playersToUpdate, notifiedTargets } = await processActions(sock, jid, player, actions, aiResponse, nearbyPlayers);

    // Apply JSON-schema updates (Arbitrator pattern)
    if (aiResponse.updates) {
        await applyPlayerUpdates(aiResponse.updates, playersToUpdate);
    }

    // Append Player Status Footer (Anime System UI Style)
    let statusFooter = "\n\n┏━━━━━ [ 💠 SYSTEM UI ] ━━━━━\n";
    const allActorsJids = [player.whatsappId, ...nearbyPlayers.map(p => p.whatsappId)];
    for (const actorJid of allActorsJids) {
        const p = await Player.findByPk(actorJid);
        if (p) {
            const hPercent = Math.max(0, Math.min(1, p.health / p.maxHealth));
            const mPercent = Math.max(0, Math.min(1, p.mana / p.maxMana));
            const hBar = "▰".repeat(Math.ceil(hPercent * 10)) + "▱".repeat(10 - Math.ceil(hPercent * 10));
            const mBar = "▰".repeat(Math.ceil(mPercent * 10)) + "▱".repeat(10 - Math.ceil(mPercent * 10));
            const sEffects = p.statusEffects && p.statusEffects.length > 0 ? `\n┃ ✨ ÉTATS: ${p.statusEffects.join(', ')}` : '';
            statusFooter += `┃ 👤 ID: ${p.name.toUpperCase()}\n┃ 🎖️ RANG: [ ${p.rank} ]\n┃ ✨ LVL: ${p.level} | XP: ${p.xp}/${p.level*100}\n┃ ❤️ HP: [${hBar}] ${p.health}\n┃ 🔷 MP: [${mBar}] ${p.mana}${sEffects}\n┃\n`;
        }
    }
    statusFooter += "┗━━━━━━━━━━━━━━━━━━━━";
    aiResponse.narrative += statusFooter;

    // Batch notifications to targets to avoid spam
    for (const targetJid of notifiedTargets) {
        const tPlayer = await Player.findOne({ where: { whatsappId: targetJid } });
        if (tPlayer && shouldNotifyPlayer(tPlayer)) {
            await sock.sendMessage(targetJid, {
                text: `🔔 *NOTIFICATION RP*\n\n${player.name} a interagi avec toi !\n\n${aiResponse.narrative}`
            });
        }
    }

    // Additional player notifications
    if (Array.isArray(aiResponse.notifications)) {
      for (const notice of aiResponse.notifications) {
        if (!notice || !notice.target_name || !notice.message) continue;
        const nTargetPlayer = await Player.findOne({ where: { name: { [Op.like]: `%${notice.target_name}%` }, location: player.location } });
        if (nTargetPlayer && nTargetPlayer.subLocation !== player.subLocation) continue;
        if (nTargetPlayer && shouldNotifyPlayer(nTargetPlayer)) {
          await sock.sendMessage(nTargetPlayer.whatsappId, {
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

    // Append next hint
    aiResponse.narrative += "\n\n💡 *Note:* Une seule personne peut `next`, mais elle doit attendre que tous les autres aient fini leurs actions pour que tout soit pris en compte.";

    // Prepend World Clock Header
    const header = await getWorldHeader();
    if (aiResponse.narrative && !aiResponse.narrative.includes("An ")) {
        aiResponse.narrative = `${header}\n\n${aiResponse.narrative}`;
    }

    // BROADCAST MJ RESPONSE TO ALL ACTORS (Multiplayer DM Support)
    // Ensures everyone in the scene sees the MJ narration even if they didn't send 'next'
    if (jid.endsWith('@s.whatsapp.net')) {
        const allActorsJids = [player.whatsappId, ...nearbyPlayers.map(p => p.whatsappId)];
        for (const actorJid of allActorsJids) {
            if (actorJid !== jid && shouldNotifyPlayer({ whatsappId: actorJid })) {
                try {
                    await sendWithImage(sock, actorJid, aiResponse);
                    // Remove from notifiedTargets to avoid double sending
                    notifiedTargets.delete(actorJid);
                } catch (e) {
                    console.error(`[Multiplayer] Failed to broadcast to ${actorJid}:`, e.message);
                }
            }
        }
    }

    // Increment Global Action Count
    const { incrementActionCount } = require('./world-clock');
    await incrementActionCount();

    // ATR ARENA - Inject Fight Pad if in duel
    if (activeDuel) {
        const opponentJid = activeDuel.playerAJid === player.whatsappId ? activeDuel.playerBJid : activeDuel.playerAJid;
        const opponent = await Player.findByPk(opponentJid);
        if (opponent && !aiResponse.imagePrompt) {
            try {
                aiResponse.imagePrompt = await arenaHandler.generateFightPad(player, opponent);
            } catch (e) {
                console.error("[Arena] Error generating fight pad:", e);
            }
        }
    }

    await sendWithImage(sock, jid, aiResponse);

    // Auto-Profile Delivery for all updated players
    for (const pId of playersToUpdate) {
        try {
            const pToUpdate = await Player.findOne({ where: { whatsappId: pId } });
            if (pToUpdate && shouldNotifyPlayer(pToUpdate)) {
                await pToUpdate.reload();
                const profileBuffer = await generateProfileCard(pToUpdate);
                await sock.sendMessage(pId, {
                    image: profileBuffer,
                    caption: `--- 🆔 PROFIL MIS À JOUR : ${pToUpdate.name} --- \n\nLe système a synchronisé tes nouvelles données (PV/PM/Stats/Finances).`
                });
            }
        } catch (e) {
            console.error(`[AI] Profile auto-update failed for ${pId}:`, e.message);
        }
    }

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
