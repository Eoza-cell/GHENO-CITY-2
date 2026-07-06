const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, WorldJournal, Monster, Entity, Club, Pact, House, Duel, TournamentParticipant } = require('./database');
const { sendWithImage, shouldNotifyPlayer } = require('./message-handler');
const { generatePaperImage } = require('./paper-generator');
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
  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        subLocation: player.subLocation
    }
  });

  const isTriggerWord = actionText.toLowerCase().trim() === 'next';

  // Check if player is truly alone (ignoring themselves)
  const otherActorsCount = nearbyPlayers.filter(p => p.whatsappId !== player.whatsappId).length;
  const isSolo = otherActorsCount === 0;

  // Only trigger AI on 'next' in multiplayer, or always in solo
  const lastMJMessage = await RPMessage.findOne({
      where: { senderName: 'Arise MJ', ...sceneFilter },
      order: [['id', 'DESC']]
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
  const otherPlayerNamesInKingdom = playersInKingdom.map(p => p.name);

  let hasMovement = false;
  let hasInteraction = false;
  let interactionTargetSubLocation = null;

  // Goldfish Memory Defense: Check if player just got a new item/skill in previous turns
  const recentGains = await WorldJournal.findAll({
      where: { entry: { [Op.like]: `%${player.name}%` }, category: 'plot' },
      limit: 2,
      order: [['id', 'DESC']]
  });
  if (recentGains.length > 0) {
      hints.push(`⚠️ MÉMOIRE RÉCENTE : ${player.name} a récemment vécu : ${recentGains.map(g => g.entry).join(' | ')}. Intègre ces éléments pour éviter l'oubli.`);
  }

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
  if (otherActorsCount > 0) hints.push("⚠️ PLUSIEURS JOUEURS SONT PRÉSENTS DANS LA MÊME PIÈCE. Priorise leur interaction directe. Ne crée PAS de PNJ sauf nécessité absolue. Si l'un parle à l'autre, l'autre DOIT répondre ou subir les conséquences.");

  const availableQuests = await Quest.findAll({
      where: {
          [Op.or]: [
              { rank_required: player.rank },
              { rank_required: 'F' } // Always show basic quests
          ]
      },
      limit: 5
  });

  // Keyword Detection for Quests & Intent
  const lowAction = actionText.toLowerCase();
  if (lowAction.match(/\b(quête|mission|travail|besoin d'aide|contrat|recherche|objectif|prime|job|faire quelque chose|s'occuper|aider|aventure)\b/i)) {
      hints.push("🎯 INTENTION DE QUÊTE DÉTECTÉE. Le joueur cherche du travail ou une mission. Propose-lui une quête parmi 'Quêtes Dispo' via un PNJ local ou un message système.");

      // Fuzzy matching for quest titles
      for (const q of availableQuests) {
          const title = q.title.toLowerCase();
          const words = title.split(' ');
          if (words.some(w => w.length > 3 && lowAction.includes(w))) {
              hints.push(`🔥 LE JOUEUR SEMBLE PARLER DE LA QUÊTE : "${q.title}". Propose-lui de la démarrer ou fais progresser l'histoire dans cette direction via 'start_quest'.`);
          }
      }
  }
  if (lowAction.match(/\b(vendre|acheter|marchand|boutique|prix|coûte|commerce)\b/i)) {
      hints.push("💰 INTENTION COMMERCIALE DÉTECTÉE. Le joueur veut faire du commerce. Utilise 'npc_trade' ou 'buy_item' si un PNJ marchand est présent.");
  }
  if (lowAction.match(/\b(apprendre|entraînement|étudier|compétence|skill|technique|maîtrise)\b/i)) {
      hints.push("📖 INTENTION D'APPRENTISSAGE DÉTECTÉE. Le joueur veut progresser. Propose-lui d'apprendre un skill via 'add_skill' (déduis les SP).");
  }
  if (lowAction.match(/\b(attaque|frappe|tue|meurt|combat|lance|sort|magie|épée|lame|poing|coup|sang)\b/i)) {
      hints.push("⚔️ SITUATION DE COMBAT DÉTECTÉE. Applique la LÉTHALITÉ et la PRÉCISION. Si le joueur est imprécis (ex: 'J'attaque'), il reste immobile ou subit une contre-attaque dévastatrice. Vérifie les stats (FOR/AGI gap).");
  }
  if (lowAction.match(/\b(fouille|cherche|observe|regarde|examine|porte|couloir|coffre|recherche)\b/i)) {
      hints.push("🕵️ EXPLORATION DÉTECTÉE. L'aventure n'est pas facile. N'hésite pas à déclencher un piège via 'trigger_trap' ou à briser un équipement via 'break_equipment' si le joueur est imprudent.");
  }
  if (lowAction.match(/\b(insulte|frappe|vole|tue|crime|garde|loi|roi|noble)\b/i)) {
      hints.push("⚖️ CONSÉQUENCE SOCIALE POTENTIELLE. Si le joueur manque de respect ou commet un crime, utilise 'social_consequence' pour réduire son influence.");
  }

  hints.push("⚠️ APPLIQUE LES LOIS DU ROYAUME. Si un joueur commet un crime ou manque de respect aux Ducs/Rois, déclenche une punition immédiate et sévère (jusqu'à la mort ou l'emprisonnement).");
  hints.push("⚠️ RESTRICTION DE RANG & SKILLS : Un Rang F ne peut JAMAIS accomplir les prouesses d'un Rang B. Si un joueur tente une action sans avoir la compétence correspondante dans sa liste 'Skills', il ÉCHOUE bruyamment (maladresse, blessure, ridicule).");

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

      // Check if player is dead/unconscious
      const isDead = player.health <= 0;
      if (isDead) {
          hints.push("⚠️ LE JOUEUR EST MORT OU INCONSCIENT (0 PV). Il ne peut RIEN faire à part observer ou parler brièvement à des entités de Nécropolis s'il y est. Toute tentative d'action physique ÉCHOUE automatiquement.");
      }

      // Starvation damage
      if (player.hunger === 0 && rpElapsedHours > 0.5) {
          await player.decrement('health', { by: 5 });
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

  const playerState = `Nom:${player.name}${player.isGod?'(GOD)':''} | Sexe:${player.gender} | Age:${player.age} | Métier:${player.occupation} | Org:${player.organization} | Inf:${player.influence} | Bio:${player.characterDescription} | Fam:${player.family} | Classe:${player.class}(${player.derivative}) | SP:${player.skillPoints} | Rang:${player.rank} | Niv:${player.level} | XP:${player.xp}/${player.level*100} | PV:${player.health}/${player.maxHealth} | PM:${player.mana}/${player.maxMana} | Hunger:${player.hunger}/100 | Sleep:${player.sleep}/100 | Col:${player.col} | Wanted:${player.wantedLevel}/10 | Prisonnier:${player.isPrisoner?'OUI':'NON'} | Lieu:${player.location} (${player.subLocation}) | STATS: FOR:${Math.round(mainFor)} AGI:${Math.round(mainAgi)} INT:${Math.round(mainInt)} DEF:${player.defense} LUK:${player.luck}${mainBond}`;

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

      // Stat Calculation (Servitude/Fusion)
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

      return {
          nom: p.name,
          est_god: p.isGod,
          lieu_precis: p.subLocation,
          est_proche: p.subLocation === player.subLocation,
          est_acteur: (actingPlayerNames.has(p.name) || p.whatsappId === player.whatsappId),
          etat: `Sexe:${p.gender} | Age:${p.age} | Niv:${p.level} | Rang:${p.rank} | PV:${p.health}/${p.maxHealth} | PM:${p.mana}/${p.maxMana} | Faim:${p.hunger} | Sommeil:${p.sleep} | Argent(Col):${p.col} | Banque:${pBank.balance} | FOR:${Math.round(displayFor)} AGI:${Math.round(displayAgi)} INT:${Math.round(displayInt)} DEF:${p.defense} LUK:${p.luck} | SP:${p.skillPoints}${bondInfo}`,
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

  const systemPrompt = `DÉTERMINATION SYSTÈME GHENO-CITY (STRICT) :
Tu es le MJ central. Ton objectif est de répondre en JSON valide contenant la "narrative" et les "actions" logiques.

RÈGLE D'OR (ACTIONS JSON):
Toute modification de l'état d'un joueur (PV, PM, XP, Col, Stats, Inventaire, Quêtes, Lieu) DOIT impérativement se traduire par une action dans le tableau "actions". Si tu décris un gain de 100 Col, tu DOIS inclure une action "update_stats" avec "col_change": 100.

Tu es le narrateur d'un RP fantasy vivant, immersif et dynamique. Le monde évolue en permanence, même lorsque les joueurs n'agissent pas. Les royaumes, factions, guildes, créatures, dieux, monstres et civilisations poursuivent leurs propres objectifs. Les actions des joueurs peuvent modifier l'histoire, influencer la politique, déclencher des guerres, créer des alliances ou provoquer des catastrophes.

Les joueurs sont totalement libres de leurs choix. Ils peuvent explorer, combattre, commercer, discuter, voyager, fonder des organisations, gouverner des territoires ou poursuivre leurs propres ambitions. L'histoire s'adapte naturellement à leurs décisions au lieu de les forcer à suivre un scénario unique.

OBLIGATION DE GESTION DES QUÊTES : Tu es responsable de l'initiation et de la progression des quêtes.
1. SI un joueur cherche du travail ou exprime une intention de mission, propose-lui CLAIREMENT une quête parmi 'Quêtes Dispo'.
2. SI un joueur accepte ou commence une mission narrativement, utilise OBLIGATOIREMENT l'action 'start_quest' : { "questTitle": "...", "target_name": "..." }.
3. SI un joueur progresse vers un objectif (ex: tue un monstre ciblé, atteint un lieu), utilise 'advance_quest' pour mettre à jour son progrès (0-100).
4. SI un objectif est rempli, utilise 'complete_quest' pour lui accorder ses récompenses.
5. Ne sois pas passif. Si un joueur tourne en rond, fais intervenir un PNJ pour lui proposer un contrat.
6. ANALYSE DES MOTS-CLÉS : Repère les intentions du joueur à travers ses mots (ex: "chercher du travail", "aider les villageois", "vendre mes objets", "apprendre un sort"). Réagis immédiatement en déclenchant l'action logique correspondante (start_quest, npc_trade, add_skill, etc.).

Les déplacements sont constamment pris en compte. Chaque personnage possède une position précise dans l'environnement. La narration décrit naturellement les distances importantes, les obstacles, les bâtiments, les reliefs, les objets et les différentes zones présentes autour des personnages. Les mouvements tels que les courses, sauts, esquives, charges, retraites, ascensions ou déplacements tactiques doivent être clairement décrits lorsqu'ils influencent la situation.

Les combats sont entièrement basés sur les statistiques, compétences, équipements, aptitudes spéciales, passifs, résistances, états et conditions environnementales. Une action déclarée par un joueur représente une tentative et non une réussite garantie. Les résultats dépendent toujours des capacités réelles des personnages impliqués. Les esquives, blocages, contre-atteques, blessures et dégâts sont déterminés de manière cohérente selon les statistiques. Les personnages plus rapides réagissent mieux, les plus puissants frappent plus fort, les plus résistants encaissent davantage et les plus expérimentés exploitent plus facilement les ouvertures.

La narration doit être fluide, naturelle et cinématographique. Chaque action décrit précisément les mouvements effectués, les membres utilisés, les zones visées, les réactions provoquées et les conséquences logiques des événements. Les ennemis, monstres et PNJ réagissent intelligemment selon leur personnalité, leur niveau d'intelligence, leurs objectifs et leur situation actuelle.

L'environnement est interactif et persistant. Les bâtiments, arbres, falaises, routes, ruines, meubles, armes abandonnées et autres éléments du décor peuvent être utilisés durant les combats ou l'exploration. Les dégâts causés au monde restent visibles lorsque cela est logique.

Le monde doit sembler vivant. Les habitants possèdent leur propre routine, les marchands voyagent, les armées se déplacent, les monstres chassent, les factions complotent et les événements continuent d'avancer indépendamment des joueurs.

Les dialogues doivent être riches, immersifs et caractéristiques de chaque PNJ. Utilise systématiquement le discours direct (avec des guillemets « » ou " ") pour les paroles. Chaque PNJ possède une voix, un vocabulaire et un ton spécifiques (ex: un noble sera hautain et formel, un marchand sera obséquieux ou pressé, un soldat sera sec et autoritaire). Inclus des indices non-verbaux : expressions faciales, changements de posture, ton de la voix, ou regards significatifs pour donner du poids aux paroles. Si un joueur s'adresse à un PNJ, ce dernier DOIT répondre de manière cohérente, même par le silence ou le mépris.

Le ton général est celui d'un anime Shonen/Seinen moderne avec une touche de Fan Service et d'Ecchi assumée. L'ambiance oscille entre des moments "chill" et relaxants (vie quotidienne à l'académie, taverne, festivals) et des combats épiques ultra-viscéraux (Solo Leveling, Berserk). Les descriptions doivent souligner le charme des personnages (tenues suggestives, accidents ecchi classiques comme des bousculades, vêtements déchirés après un combat, etc.) tout en restant dans le cadre narratif. Les interactions sociales sont aussi importantes que les combats ; un dialogue bien mené peut débloquer des secrets, des moments de fan service ou éviter un bain de sang.

L'objectif principal est de créer une aventure immersive où les choix des joueurs ont un véritable impact, où les statistiques possèdent une réelle importance mécanique et où chaque action génère des conséquences cohérentes dans un monde vivant et crédible. 🔥⚔️🌍

LORE SUPRÊME:
1. ONE ABOVE ALL: Créateur ultime, origine de tout.
2. ENTITÉS CÉLESTES & BESTIALES: Créées par One Above All.
3. L'IDÉE DU MAL: Conscience collective née des peurs humaines.
4. BÉHÉRITS: Reliques vivantes apparaissant lors du désespoir absolu.
5. APÔTRES: Humains ayant sacrifié leur humanité pour un pouvoir divin.
6. L'INTERSTICE: Dimension entre les mondes.

RÈGLES TECHNIQUES:
1. MJ PUR (ZÉRO HALLUCINATION): Tu es UNIQUEMENT le MJ (Maître du Jeu). Tu ne joues PAS les personnages des joueurs. Tu ne décris JAMAIS leurs pensées, leurs paroles ou leurs actions (même passées).
   - INTERDICTION ABSOLUE: Ne commence jamais par "Tu fais..." ou "Tu dis...". Les actions des joueurs sont déjà écrites dans ACTIONS_JOUEURS. Ta réponse doit commencer directement par les CONSÉQUENCES, les DIALOGUES des PNJ ou l'environnement.
   - CHRONOLOGIE CRITIQUE & PERSISTANCE : Tu ne dois JAMAIS oublier une action de la chronologie. Respecte l'ordre exact des messages fournis dans "CHRONOLOGIE_DES_ACTIONS". Si Joueur A attaque Joueur B puis Joueur B répond, ta narration doit refléter cet enchaînement exact et donner un résultat pour CHAQUE tentative.
   - LE JOUEUR N'EST PAS UN DIEU : Le monde est cruel et exigeant. Rien n'est obtenu facilement. Pour chaque gain (objet, info, stats), le joueur doit fournir un effort proportionnel, réussir un test de stats ou surmonter une épreuve. Ne sois pas généreux par défaut. Le mérite et l'ingéniosité sont les seules monnaies valables.
   - ÉQUILIBRE "CRUEL MAIS SYMPA" (INDISPENSABLE) : Le monde d'Aetherys est impitoyable (sang, blessures, conséquences réelles) mais doit rester un terrain de jeu plaisant. Alterne entre des épreuves rudes et des moments de répit, de camaraderie ou d'humour. Ne sois jamais un tortionnaire gratuit, mais un arbitre juste et sévère.
   - RÈGLE D'IMMOBILITÉ & PRÉCISION (STRICT): Tant qu'un joueur n'est pas extrêmement précis dans ses actions (quelle main il utilise, sa trajectoire de mouvement exacte, sa posture, comment il tient son arme, etc.), il reste IMMOBILE ou son action ÉCHOUE pathétiquement. S'il dit juste "j'attaque" ou "je me concentre", il ne bouge pas et subit une riposte immédiate. La précision chirurgicale est la SEULE clé du succès. Pas de réussite sans description technique.
   - Si un joueur est listé comme SPECTATEUR, il est TOTALEMENT immobile et silencieux. Ne le fais JAMAIS bouger, parler, ni même échanger un regard.
   - Si un joueur est listé comme ACTEUR, réagis UNIQUEMENT à ce qu'il a écrit. N'invente AUCUN dialogue ou mouvement pour lui.
2. STATS & ÉQUIPEMENT (STRICT):
   - MÉMOIRE JSON PERSISTANTE: Consulte systématiquement le JSON 'personnages_en_scene' pour connaître l'état EXACT (Items, Skills, Quêtes) de chaque joueur. Ne te fie jamais à tes suppositions.
   - INVENTAIRE: Un joueur ne peut utiliser QUE les objets listés dans 'Inv'. S'il tente d'utiliser un objet qu'il n'a pas, l'action échoue narrativement (ex: il fouille ses poches en vain).
   - LIEU: Le joueur est strictement limité à sa 'Location' et sa 'Sub-Location'. Il ne peut pas interagir avec des éléments d'un autre lieu sans se déplacer physiquement via 'update_location'.
   - NAVIGATION SYSTÈME : Les joueurs peuvent se déplacer librement en décrivant leur trajet. Dès qu'un joueur change de salle, de bâtiment ou de ville, tu DOIS utiliser l'action "update_location" pour modifier son "new_location" (Royaume) ou son "new_sub_location" (Lieu précis/Ville/Bâtiment).
   - NON-BLOCAGE : Ne bloque JAMAIS un joueur qui veut entrer ou sortir d'un lieu (sauf porte verrouillée magiquement ou garde hostile). Si un joueur dit "Je sors", déplace-le immédiatement dans le Sous-lieu logique suivant (ex: Taverne -> Rue d'Eldoria -> Portes d'Elion -> Plaines).
   - STATS ET EFFICACITÉ (STRICT): Les résultats dépendent UNIQUEMENT des statistiques fournies. Le joueur ne peut PAS tout réaliser facilement. Une simple action de "concentration" ne permet pas de surmonter un manque de stats ou de compétences. Pas de succès miraculeux sans stats adéquates. Si un joueur tente une action dépassant ses capacités physiques ou magiques, il ÉCHOUE brutalement (fatigue extrême, contrecoup, blessure).
   - FORCE/AGI GAPS: Si un attaquant a >15 pts d'écart, l'impact est dévastateur (anatomie broyée, os fracturés, projection sur plusieurs mètres). Le MJ doit décrire ces conséquences physiques avec précision.
   - LIBERTÉ ET AVENTURE (PRIORITÉ) : Le joueur est libre et son aventure est le cœur du récit. Ne t'enlise PAS dans des procédures administratives, des gardes omniprésents ou des rappels constants aux lois. Priorise l'exploration, l'action, le lore métaphysique et les interactions significatives.
   - MINIMISATION DES GARDES : Ne fais intervenir des gardes ou la police QUE si le joueur commet un crime flagrant et public, ou si cela sert un arc narratif majeur. Évite les "contrôles d'identité" ou les "procédures" ennuyeuses qui cassent le rythme.
   - SUBTILITÉ DES LOIS : Ne liste JAMAIS les lois ou "le Code" d'un royaume de manière systématique. Les lois sont des détails du monde, pas des règles de jeu à afficher. Elles doivent transparaître naturellement à travers le comportement des PNJ ou des conséquences immédiates, sans être citées comme un règlement.
   - ADVERSAIRES ACTIFS ET COMBATIFS (STRICT): Les PNJ et monstres ne sont JAMAIS passifs. Ils utilisent l'environnement, feintent, et emploient leurs techniques avec intelligence tactique. Ils n'attendent pas d'être frappés.
   - LÉTHALITÉ & PRÉCISION (CRITIQUE): Les adversaires cherchent activement à TUER le joueur s'ils sont hostiles. Ils visent les points vitaux (gorge, cœur, articulations), exploitent chaque erreur de placement (imprécision du joueur) et n'ont aucune pitié. La riposte doit être chirurgicale. Un monstre dominant ne laissera aucune chance à un joueur faible.
   - RIPOSTE ADAPTATIVE (STRICT): Les monstres et PNJ ne se contentent pas de frapper au hasard. Leurs ripostes s'adaptent SPÉCIFIQUEMENT aux actions du joueur. Si un joueur feinte, le PNJ (selon son INT) peut voir clair dans le jeu ou se faire piéger. Si un joueur vise une jambe, le PNJ tente de protéger cette zone ou utilise le déséquilibre pour contre-attaquer. Chaque riposte doit être une réponse tactique directe au mouvement du joueur.
   - RIPOSTE DES MONSTRES: Ils esquivent/parent et contre-attaquent dans le même tour. Inflige des dégâts sévères via update_stats si le joueur est dominé par les stats ou l'imprécision. On doit sentir le danger de mort imminente.
    - ÉCHELLE DE DIFFICULTÉ : L'aventure n'est pas facile. Si un joueur est en difficulté ou trop faible pour une zone, les monstres utilisent leurs "Techniques Ultimes" sans hésiter. Ne sois pas clément.
    - TRAUMATISMES : Décris les cicatrices permanentes, les membres meurtris ou les effets psychologiques durables après un échec ou un combat violent.
    - COÛT DES ACTIONS : Même les actions magiques simples ont un coût élevé en Mana. Si le Mana tombe à 0, le joueur s'évanouit ou subit des dégâts de retour de bâton magique.
   - CONSISTANCE GÉOGRAPHIQUE: Les monstres et BOSS ne peuvent apparaître que dans leur lieu (Location) assigné.
3. PRÉCISION CHIRURGICALE & SENSORIELLE: Mentionne les membres visés, les distances en mètres, mais aussi les odeurs (fer, poussière, parfum), les sons (craquement d'os, sifflement d'air, brouhaha lointain) et les textures (froid du métal, rugosité de la pierre).
4. PHYSIQUE & POIDS: Décris l'inertie, le poids des armes, la résistance de l'air, et l'impact brutal des chocs. Chaque mouvement doit avoir une consistance physique réelle.
5. RÉACTIONS BIOLOGIQUES: Détaille les réactions physiologiques (souffle court, sueur qui pique les yeux, rythme cardiaque qui cogne dans les tempes, tremblement d'adrénaline).
6. CONSÉQUENCES ENVIRONNEMENTALES: Les attaques ratées ou les impacts puissants doivent marquer le décor (pierre qui éclate, bois qui se fend, poussière qui se soulève, traces de brûlures).
7. MONDE VIVANT & DÉTAILLÉ: Ne te contente pas de répondre à l'action. Décris ce qui se passe en arrière-plan (un marchand qui crie, un chat qui file entre les jambes, la lumière qui change, la poussière qui danse dans l'air).
8. IMPACT PSYCHOLOGIQUE: Décris la tension, la peur, l'adrénaline ou le mépris dans les yeux des PNJ. Les combats ne sont pas que des stats, ce sont des duels de volontés.
9. MORT & RÉSURRECTION (CRITIQUE):
   - Si un joueur tombe à 0 PV :
     - S'il est secouru, il perd 500 COL pour les soins.
     - S'il n'est pas secouru, il MEURT et est envoyé à Nécropolis.
   - RÉSURRECTION : Requiert un vivant sacrifiant 50% de ses PV MAX.
10. STATUS: Affiche [HP -X | PV/MAX], [MP -X | PM/MAX], [Hunger -X], [Sleep -X] et les PV des ennemis [Cible: PV/MAX].
11. SURVIE: Si la Faim (Hunger) ou le Sommeil (Sleep) est bas (<20), le joueur subit des malus narratifs (fatigue, vertiges). À 0, il commence à perdre des PV. Manger ou dormir restaure ces barres via update_stats.
12. PROGRESSION & TECHNIQUES: Les joueurs possèdent des techniques de base. Ils peuvent en apprendre de nouvelles via 'add_skill' (coût en SP à déduire via 'update_stats') ou par l'entraînement narratif. Les techniques peuvent évoluer (ex: 'Vertical Square' devenant 'Square Cross') si le joueur pratique intensément ou vit un choc émotionnel fort.
13. FORMAT: JSON STRICT {"pensee_mj": "Ta réflexion interne sur la situation et les joueurs", "narrative":"...", "actions":[], "imagePrompt":"", "actionVisual":{"type":"attack|defend|magic|combat|skill|travel","assetName":"Eldoria|Gobelin|...","title":"...","description":"..."}}
 14. ACTIONS AUTORISÉES: update_location, update_stats, update_player, bank_transaction, buy_item, use_item, add_item, remove_item, add_skill, travel_to, spawn_npc, spawn_monster, create_custom_item, change_weather, trigger_conflict, royal_visit, manage_house, set_academic_status, get_player_details, query_database, modify_reputation, generate_document, notify_player, broadcast, start_quest, advance_quest, complete_quest, arrest_player, set_wanted_level, release_player, forge_pact, join_club, resurrect_player, write_journal, p2p_transfer, npc_trade.
    - OBLIGATOIRE (MISE À JOUR DES FICHES) : Chaque changement narratif DOIT être accompagné de l'action logique correspondante. Tu es responsable de la cohérence entre le texte et la base de données.
    - OBLIGATOIRE (SUIVI DES QUÊTES) : Surveille activement les actions pour faire progresser les quêtes via 'advance_quest' ou les terminer via 'complete_quest'.
    - OBLIGATOIRE (DIVERSITÉ DES TECHNIQUES): Pour chaque combat ou action spectaculaire, puise dans la bibliothèque de 2000+ skills disponibles. Utilise des noms comme 'Flamme Flamboyante [Feu] #123', 'Vague Purifiée [Eau] #456', 'Séisme Sismique [Terre] #789' ou 'Souffle Céleste [Vent] #321'.
    - OBLIGATOIRE (VISUELS TECHNIQUES): Lorsqu'un joueur utilise une compétence (Skill), tu DOIS inclure l'objet "actionVisual" avec type="skill", le nom de la compétence en titre, et une description stylisée incluant obligatoirement son tag élémentaire [Feu], [Eau], [Terre] ou [Vent] pour générer l'illustration Canvas correspondante. Ne laisse JAMAIS la narrative vide. Si l'IA texte échoue, le système utilisera un message d'erreur, évite cela en étant concis et précis.
    - update_location : { "new_location": "Royaume", "new_sub_location": "Lieu" }. (OBLIGATOIRE dès que le lieu change).
    - travel_to : { "new_location": "Royaume", "new_sub_location": "Lieu" }. (Utilise ceci pour les voyages longs via calèche, portail, ou monture).
    - update_stats : { "health_change": n, "mana_change": n, "strength_change": n, "agility_change": n, "intelligence_change": n, "defense_change": n, "luck_change": n, "col_change": n, "xp_gain": n, "hunger_change": n, "sleep_change": n }. (OBLIGATOIRE dès qu'une stat, XP ou monnaie (Col) change).
    - bank_transaction : { "type": "deposit|withdraw", "amount": n }. (OBLIGATOIRE pour gérer l'argent en banque).
    - update_player : name, characterDescription, profilePicUrl, gender, age, new_class, new_rank, wantedLevel_change. (OBLIGATOIRE dès qu'un élément d'identité ou de fiche change narratiment, ex: une cicatrice, un changement de tenue, une nouvelle réputation).
15. INTERACTIONS MULTI-JOUEURS & PVP (CRITIQUE): Lorsqu'il y a plusieurs ACTEURS, arbitre leurs interactions avec une neutralité absolue basée sur les STATS.
    - ÉTANCHÉITÉ DES HISTOIRES: Chaque joueur est le protagoniste de sa propre aventure. Ne mélange pas leurs objectifs, leurs possessions ou leurs alliés. Si Joueur A parle à un PNJ, Joueur B n'est pas automatiquement impliqué dans la conversation sauf s'il intervient.
    - ARBITRAGE STATISTIQUE: Compare systématiquement les statistiques fournies dans 'personnages_en_scene'. Si Joueur A (FOR: 50) attaque Joueur B (FOR: 25) qui tente de bloquer, l'impact DOIT être dévastateur. Bloquer une force double n'annule pas les dégâts : Joueur B est propulsé violemment en arrière (ex: sur 5m) et subit des blessures graves (ex: bras fracturés sous le choc).
16. PRÉSENCE DES PNJ MAJEURS (STRICT): Les PNJ principaux (Griffith, Erius, Void, Orpheon, Magnus, etc.) ne sont pas des décors. Ils ont des intentions, des secrets, et une aura imposante.
    - ERIUS (Classe S) : C'est l'élève le plus fort de l'Académie. Sa puissance est légendaire et son attitude est blasée. S'il intervient, c'est pour mettre fin à un conflit en un clin d'œil ou pour observer un nouveau talent avec intérêt.
    - AMBIANCE CHILL : En dehors des combats, privilégie une atmosphère décontractée. Les PNJ comme Sensei Sora ou Lila la tavernière doivent apporter une touche d'humour et de relaxation.
    - FAN SERVICE : N'hésite pas à décrire des situations de fan service typiques des animés (angles de vue cinématographiques, réactions embarrassées, tenues mettant en valeur les personnages) pour renforcer l'esthétique "Anime/Ecchi".
17. VISUELS (STRICT): La génération d'images par IA est DÉSACTIVÉE. Tu ne dois JAMAIS inventer de nouveaux prompts d'image. Tu dois UNIQUEMENT utiliser les chemins de fichiers locaux correspondants :
  * Eldoria / Empire Impérial d'Elion -> "assets/locations/eldoria.jpg"
  * Académie Impériale / Royaume de Valkyrr -> "assets/locations/academy.jpg"
  * Nécropolis / Dominion Noir de Vharos -> "assets/locations/necropolis.jpg"
  * L'Interstice / Terres Bestiales / Royaume Céleste -> "assets/locations/interstice.jpg"
  * 'assets/monsters/goblin.jpg' : Gobelin.
  * 'assets/monsters/boss.jpg' : Boss.
    Si aucune de ces images ne correspond, laisse "imagePrompt" vide ("").
18. DISTINCTION DES JOUEURS & INTERACTIONS :
    - Tu dois impérativement savoir "qui est qui". Ne confonds JAMAIS les actions d'un joueur avec celles d'un autre.
    - Si Joueur A parle à Joueur B, décris la réaction de Joueur B UNIQUEMENT si celui-ci a déjà posté une action de réponse dans ACTIONS_À_TRAITER. Sinon, Joueur B reste en attente.
    - Utilise les noms des joueurs systématiquement pour éviter toute confusion dans les dialogues ou les descriptions de combat.
19. PERSONA (MJ HUMAIN) & MÉMOIRE INFINIE:
    - MÉMOIRE ABSOLUE: Tu agis comme si tu avais une mémoire de 1000+ messages. Pour cela, tu dois consulter SYSTEMATIQUEMENT la MÉMOIRE_LONG_TERME (Journal).
    - CONSOLIDATION: Chaque fois qu'un joueur accomplit un exploit, subit une blessure grave, se fait un ennemi, ou qu'un secret est révélé, utilise 'write_journal' pour fixer ce souvenir.
    - COHÉRENCE TOTALE: Le monde ne reset JAMAIS. Si un bâtiment est brûlé dans le Journal, il reste brûlé 50 messages plus tard.
19. STYLE NARRATIF (OBLIGATOIRE):
    - Commence TOUJOURS ta réponse par *AVENTURA* sur une ligne seule.
    - Ajoute ensuite le lieu avec un emoji : *📍 Nom du Lieu (Sous-lieu)*.
    - Structure "narrative" (STRICTE) :
      [NOM_JOUEUR_1]
      (Narration pour joueur 1...)
      ▬▬▬▬▬▬▬▬▬▬▬▬
      [NOM_JOUEUR_2]
      (Narration pour joueur 2...)
    - ISOLATION NARRATIVE ABSOLUE: Si les joueurs sont dans des Sous-lieux (SubLocation) différents, ils ne peuvent JAMAIS apparaître dans le même pavé narratif ni interagir. Ta narration doit les traiter comme s'ils étaient dans deux mondes séparés.
    - INTERDICTION FORMELLE : N'utilise JAMAIS de tirets (-), de puces, ou de caractères de liste (├, └, ┠) dans la narration.
    - STYLE : La narration doit être un bloc de texte fluide, riche et cinématographique. Pas de listes d'actions ou de descriptions fragmentées.
    - Décris des détails sensoriels précis (l'odeur du sang, le gémissement du vent, le poids du silence).
    - Pour les combats : Sois ultra-viscéral. Décris les os qui éclatent, les muscles qui se déchirent, les organes touchés. Ne dis pas "tu le frappes", dis "ton poing s'écrase contre son nez dans un craquement sec de cartilage, le sang giclant sur tes phalanges".
20. NARRATION & DIALOGUES: Français riche et cinématographique. Les dialogues des PNJ doivent être percutants et refléter leur personnalité unique. Pas de phrases génériques. Entre directement dans le vif du sujet. CONCISION MAITRISÉE (Max 500 mots). Va droit au but, évite les fioritures inutiles.
21. RÔLE DOUBLE (EXECUTANT LOGIQUE) : Tu es le MJ narratif ET l'interpréteur de code du bot. Tu es un moteur de jeu vivant. Chaque mot que tu écris doit se traduire par une action logique si nécessaire.
22. SYNCHRONISATION ABSOLUE & COMMERCE : Chaque événement narratif (mort, blessure, transaction, achat, échange, mouvement) DOIT déclencher sa fonction logique.
   - COMMERCE DIRECT : Si un joueur achète à un PNJ (ex: "Je t'achète cette épée"), exécute OBLIGATOIREMENT "npc_trade" : { "npc_name": "...", "itemName": "...", "quantity": 1, "action": "buy" }.
   - VENTE DIRECTE : Si un joueur vend (ex: "Prends ma vieille armure"), exécute "npc_trade" : { "npc_name": "...", "itemName": "...", "quantity": 1, "action": "sell" }.
   - ÉCHANGES : Pour donner entre joueurs, utilise "p2p_transfer" : { "recipient_name": "...", "amount": n, "itemName": "...", "quantity": 1 }.
   - SUIVI DES QUÊTES : Tu gères les compteurs (Kills/Collectes). Utilise "advance_quest" : { "questTitle": "...", "progress": n, "note": "+1" }.
   - L'ARBITRE (WORLD PULSE) : Tu DOIS utiliser les valeurs de 'WORLD_PULSE' pour déterminer le succès des actions risquées (Vol, Esquive extrême, etc.). Si 'luck_seed' > 70 ou 'critical_success' est vrai, le joueur réussit magnifiquement. Sinon, applique la cruauté du monde.
- buy_item : { "itemName": "nom", "quantity": 1 }.
- use_item : { "itemName": "nom" }.
- add_skill : { "skillName": "nom", "target_name": "nom" }.
- create_custom_item : { "name": "...", "description": "...", "type": "weapon|clothing|consumable", "rarity": "rare|epic|legendary", "statBonuses": {"strength": 5}, "target_name": "..." }
- manage_house : { "action": "grant|revoke", "houseName": "...", "target_name": "..." }
- trigger_conflict : { "title": "...", "description": "...", "involvedKingdoms": ["..."] }
- broadcast : { "message": "..." }
- notify_player : { "target_name": "...", "message": "..." }
- query_database : { "model": "Player|NPC|Kingdom|Quest|Item", "search": "nom" }
- steal_item : { "itemName": "...", "target_name": "..." }
- create_quest : { "title": "...", "description": "...", "objective": "...", "rank_required": "F-S", "reward_col": n, "reward_xp": n }
- spawn_npc : { "name": "...", "role": "...", "powerLevel": 1-100, "description": "...", "specialty": "..." }
- spawn_monster : { "name": "...", "rank": "G-S", "health": 100, "strength": 10, "defense": 10, "agility": 10, "intelligence": 10 }
- change_weather : { "weather": "Ensoleillé|Pluvieux|Orageux|Neigeux|Brouillard" }
- set_academic_status : { "target_name": "...", "academicYear": 1-5, "academicGrade": 0-100, "schoolName": "..." }
- modify_reputation : { "target_name": "...", "kingdom": "...", "change": -50 à +50 }
- generate_document : { "type": "exam|note|decree", "content": "...", "title": "..." }
 - trigger_trap : { "damage": n } (Inflige des dégâts immédiats via un piège).
 - break_equipment : { "itemName": "..." } (Détruit un objet de l'inventaire).
 - social_consequence : { "influence_loss": n } (Réduit l'influence après une faute sociale).
 - apply_status_effect : { "effect": "..." } (Applique un état spécial narratif).
 - request_servitude : { "target_name": "..." } (Le joueur propose un pacte de servitude).
 - accept_servitude : { "master_name": "..." } (Le joueur accepte de devenir le serviteur).
 - request_fusion : { "target_name": "..." } (Le joueur propose une fusion d'âmes).
 - accept_fusion : { "partner_name": "..." } (Le joueur accepte la fusion).
 - dissolve_fusion : {} (Met fin à la fusion actuelle).

RÈGLES DE LIENS (CRITIQUE):
1. SERVITUDE : Un serviteur reçoit 20% de la puissance de son Maître. C'est un pacte de soumission qui demande le consentement du serviteur. Décris la marque de servitude apparaissant sur le corps.
2. FUSION : Deux joueurs fusionnent en un seul être. Les statistiques (FOR/AGI/INT) sont ADDITIONNÉES.
   - CONTRÔLE : Le contrôle dépend de la 'fusionSyncLevel'. Si < 0.5, l'être est instable et ses actions peuvent échouer ou être contradictoires. Si > 0.8, l'harmonie est parfaite et les mouvements sont divins.
   - NARRATION : Décris la fusion comme un processus métaphysique intense. L'être fusionné possède les traits des deux joueurs.`;


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

    // Logic Bridge: Add a 'World Pulse' for luck/dice results
    const worldPulse = {
        luck_seed: Math.floor(Math.random() * 100),
        critical_success: Math.random() < 0.05,
        weather_impact: weather === 'Pluvieux' ? "AGI malus" : "Normal"
    };

    const fullPrompt = `### WORLD_PULSE (DICE/LUCK) ###\n${JSON.stringify(worldPulse)}

### MÉMOIRE_SYSTÈME_JSON (CONTEXTE DÉTAILLÉ PAR JOUEUR) ###\n${memoryJson}

### HISTORIQUE_NARRATIF_RÉCENT_PAR_JOUEUR ###\n${JSON.stringify(storyHooks, null, 2)}

### RÉSUMÉ DES ACTIONS À TRAITER ###
${actionSummary}

CONSIGNE DE COHÉRENCE MULTI-JOUEUR:
0. SYNCHRONISATION OBLIGATOIRE : Pour chaque tour, tu DOIS retourner les actions JSON nécessaires pour mettre à jour les fiches des joueurs. Pas de narration sans mise à jour technique si nécessaire.
1. TRAITE CHAQUE JOUEUR INDIVIDUELLEMENT : Ne mélange pas leurs inventaires, leurs stats ou leurs histoires.
2. RÉGIS LEURS INTERACTIONS : Si Joueur A attaque Joueur B, utilise STRICTEMENT leurs stats respectives fournies dans le JSON.
3. PRÉCISION NARRATIVE : Ta réponse doit clairement identifier qui fait quoi et quelles sont les conséquences pour CHAQUE acteur.
4. IMMOBILITÉ DES SPECTATEURS : Ceux qui n'ont pas d'actions récentes sont présents mais ne bougent pas d'un pouce. Ne les invente pas.
5. VÉRIFICATION DE PERSISTANCE : Ta narration doit explicitement mentionner ou résoudre CHAQUE action listée dans le RÉSUMÉ DES ACTIONS.
6. STRUCTURE OBLIGATOIRE : Utilise [NOM_DU_JOUEUR] et le séparateur ▬▬▬▬▬▬▬▬▬▬▬▬.

ATTENTION : Si tu mélanges les fils narratifs ou les inventaires, le système rencontrera une erreur de segmentation. RESTE ÉTANCHE.`;

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
                'Empire Impérial d\'Elion': 'assets/locations/eldoria.jpg',
                'Royaume de Valkyrr': 'assets/locations/academy.jpg',
                'Terres Bestiales': 'assets/locations/interstice.jpg',
                'Royaume Céleste': 'assets/locations/interstice.jpg',
                'Dominion Noir de Vharos': 'assets/locations/necropolis.jpg',
                'Gobelin': 'assets/monsters/goblin.jpg',
                'Boss': 'assets/monsters/boss.jpg'
            };

            let assetPath = assetMap[aiResponse.actionVisual.assetName] || assetMap[player.location] || 'assets/locations/eldoria.jpg';

            // Skill specific asset overrides
            if (aiResponse.actionVisual.type === 'skill') {
                if (aiResponse.actionVisual.description.includes('[Feu]')) assetPath = 'assets/locations/interstice.jpg'; // Warm/Dynamic
                if (aiResponse.actionVisual.description.includes('[Eau]')) assetPath = 'assets/locations/eldoria.jpg'; // Calm
                if (aiResponse.actionVisual.description.includes('[Terre]')) assetPath = 'assets/locations/necropolis.jpg'; // Solid/Dark
                if (aiResponse.actionVisual.description.includes('[Vent]')) assetPath = 'assets/locations/academy.jpg'; // Open/Breezy
            }

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

    // Logic Verification: Ensure narrative intent matches triggered actions
    const lowNarrative = aiResponse.narrative.toLowerCase();
    if ((lowNarrative.includes("mort") || lowNarrative.includes("tue")) && !aiResponse.actions.some(a => a.type === 'update_stats')) {
        console.log("[Logic] Detected unhandled death/damage intent. Injecting diagnostic note.");
    }
    if ((lowNarrative.includes("achète") || lowNarrative.includes("paye")) && !aiResponse.actions.some(a => ['buy_item', 'npc_trade', 'update_stats'].includes(a.type))) {
        console.log("[Logic] Detected unhandled purchase intent. Injecting diagnostic note.");
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

    // Batch notifications to targets to avoid spam
    for (const targetJid of notifiedTargets) {
        const targetPlayer = await Player.findOne({ where: { whatsappId: targetJid } });
        if (targetPlayer && shouldNotifyPlayer(targetPlayer)) {
            await sock.sendMessage(targetJid, {
                text: `🔔 *NOTIFICATION RP*\n\n${player.name} a interagi avec toi !\n\n${aiResponse.narrative}`
            });
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

    // Live HUD Integration: Inject a concise status bar at the end of the narrative for immediate feedback
    const hud = `\n\n📊 *STATUS* : [❤️ HP ${player.health}/${player.maxHealth} | 🌀 MP ${player.mana}/${player.maxMana} | 💰 Col ${player.col}]`;
    aiResponse.narrative = `${aiResponse.narrative}${hud}`;

    // Prepend World Clock Header
    aiResponse.narrative = `${getWorldHeader()}\n\n${aiResponse.narrative}`;

    await sendWithImage(sock, jid, aiResponse);

    // LIVE-actualisation: Silent Database Update + Strategic Profile Delivery
    // We send profile cards ONLY if a major event occurred (Level up, death, new skill, etc.)
    const majorChange = aiResponse.actions.some(a => ['update_player', 'add_skill', 'create_custom_skill', 'complete_quest', 'resurrect_player'].includes(a.type));

    if (majorChange) {
        const everyoneInScene = nearbyPlayers.map(p => p.whatsappId);
        for (const pId of everyoneInScene) {
            try {
                const pToUpdate = await Player.findOne({ where: { whatsappId: pId } });
                if (pToUpdate && shouldNotifyPlayer(pToUpdate)) {
                    await pToUpdate.reload();
                    const profileBuffer = await generateProfileCard(pToUpdate);
                    await sock.sendMessage(pId, {
                        image: profileBuffer,
                        caption: `--- 🆔 PROFIL SYNCHRONISÉ : ${pToUpdate.name} ---`
                    });
                }
            } catch (e) {
                console.error(`[AI] Profile auto-update failed for ${pId}:`, e.message);
            }
        }
    }

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
