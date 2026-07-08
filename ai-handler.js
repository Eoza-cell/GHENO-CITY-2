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

  // Automatic Visual: Detect writing on paper or blackboard
  const writingMatch = actionText.match(/(?:écrit|écrire|rédige|rédiger|note|noter|inscrit|dessine|trace)(?:\s+sur\s+(?:du\s+)?(?:papier|tableau|mur|parchemin|lettre|examen|note|copie))\s*:\s*([\s\S]+)/i);
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
  const otherActorsCount = activeOthersInScene.length;
  if (otherActorsCount > 0) hints.push("⚠️ PLUSIEURS JOUEURS SONT PRÉSENTS DANS LA MÊME PIÈCE. Priorise leur interaction directe. Ne crée PAS de PNJ sauf nécessité absolue. Si l'un parle à l'autre, l'autre DOIT répondre ou subir les conséquences.");

  // Goldfish Memory Defense: Check if player just got a new item/skill in previous turns
  const recentGains = await WorldJournal.findAll({
      where: { entry: { [Op.like]: `%${player.name}%` }, category: 'plot' },
      limit: 2,
      order: [['id', 'DESC']]
  });
  if (recentGains.length > 0) {
      hints.push(`⚠️ MÉMOIRE RÉCENTE : ${player.name} a récemment vécu : ${recentGains.map(g => g.entry).join(' | ')}. Intègre ces éléments pour éviter l'oubli.`);
  }

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

  // CATEGORY: QUESTS (Keyword Activation)
  if (lowAction.match(/\b(quête|mission|travail|besoin d'aide|contrat|recherche|objectif|prime|job|faire quelque chose|s'occuper|aider|aventure|aider|services|tâche|recrute|demander du travail|postuler|chercher une mission)\b/i)) {
      hints.push("🎯 [KEYWORD_ACTIVATE: QUEST] Intention de mission détectée. Tu DOIS proposer une quête ou utiliser 'start_quest' si le joueur accepte.");

      // Fuzzy matching for quest titles
      for (const q of availableQuests) {
          const title = q.title.toLowerCase();
          const words = title.split(' ');
          if (words.some(w => w.length > 3 && lowAction.includes(w))) {
              hints.push(`🔥 [SYNC] Le joueur cible la quête : "${q.title}". Propose-lui de démarrer via 'start_quest'.`);
          }
      }
  }

  // CATEGORY: COMMERCE & MONEY
  if (lowAction.match(/\b(vendre|acheter|marchand|boutique|prix|coûte|commerce|échanger|troc|magasin|étal|vendeur|négocier|paye|pièces|argent|donne-moi|combien|tarif|achat|vente)\b/i)) {
      hints.push("💰 [KEYWORD_ACTIVATE: TRADE] Intention commerciale. Utilise 'npc_trade' (buy/sell) ou 'buy_item'. Déduis le Col via 'update_stats'.");
  }

  // CATEGORY: TRAINING & SKILLS
  if (lowAction.match(/\b(apprendre|entraînement|étudier|compétence|skill|technique|maîtrise|pouvoir|entraînement|développer|pratique|exercer|méditer|apprendre|maîtriser|nouveau sort|nouvelle technique)\b/i)) {
      hints.push("📖 [KEYWORD_ACTIVATE: SKILL] Apprentissage détecté. Utilise 'add_skill' (coût 5 SP) ou 'create_custom_skill' (coût 10 SP).");
  }

  // CATEGORY: COMBAT & LETHALITY
  if (lowAction.match(/\b(attaque|frappe|tue|meurt|combat|lance|sort|magie|épée|lame|poing|coup|sang|duel|défi|assassinat|fendre|trancher|brûler|frapper|cogner|massacrer|achever|décapiter|éventrer|briser)\b/i)) {
      hints.push("⚔️ [KEYWORD_ACTIVATE: COMBAT] Combat ultra-violent. Applique une léthallité immédiate. Utilise 'update_stats' pour des dégâts massifs. Si le joueur est imprécis ou faible, il subit des blessures mutilantes ou la mort.");
  }

  // CATEGORY: MATURE & RELATIONSHIPS
  if (lowAction.match(/\b(sexe|coucher|embrasser|caresse|nu|déshabiller|plaisir|désir|étreinte|lit|chambre|amour|passion|vif|charnel)\b/i)) {
      hints.push("🔞 [KEYWORD_ACTIVATE: MATURE] Interaction intime détectée. Décris l'acte avec une prose viscérale, immersive et mature, sans censure, tout en restant dans l'esthétique Manhwa/Seinen.");
  }

  // CATEGORY: EXPLORATION
  if (lowAction.match(/\b(fouille|cherche|observe|regarde|examine|porte|couloir|coffre|recherche|inspecte|fouille|découvre|trouver|fouiller|analyser|voir de plus près|ouvrir)\b/i)) {
      hints.push("🕵️ [KEYWORD_ACTIVATE: EXPLORE] Exploration détectée. Utilise 'trigger_trap' ou 'add_item' si un trésor est trouvé.");
  }

  // CATEGORY: JUSTICE & SOCIAL
  if (lowAction.match(/\b(insulte|frappe|vole|tue|crime|garde|loi|roi|noble|duc|trahison|meurtre|voler|dérober|menace|provocation|crachat|manquer de respect)\b/i)) {
      hints.push("⚖️ [KEYWORD_ACTIVATE: JUSTICE] Infraction détectée. Utilise 'social_consequence', 'set_wanted_level' ou 'arrest_player'.");
  }

  // CATEGORY: WRITING & DOCUMENTS
  if (lowAction.match(/\b(écrit|écrire|rédige|rédiger|note|noter|journal|lettre|décret|contrat|examen|copie|parchemin|signe|signer|stylo|plume|écrire une lettre|signer le contrat)\b/i)) {
      hints.push("📄 [KEYWORD_ACTIVATE: WRITE] Écriture détectée. Utilise 'generate_document' pour matérialiser l'écrit.");
  }

  // CATEGORY: TRAVEL & MOVEMENT
  if (lowAction.match(/\b(va|vers|part|voyage|chevauche|calèche|portail|téléportation|route|chemin|direction|quitte|entre|déplace|bouge|sort)\b/i)) {
      hints.push("🚩 INTENTION DE MOUVEMENT DÉTECTÉE. Si le joueur change de lieu important, utilise 'travel_to' ou 'update_location'. Décris le paysage et les rencontres durant le trajet.");
  }

  // CATEGORY: RELATIONSHIPS & BONDS
  if (lowAction.match(/\b(fusion|fusionner|âme|lien|pacte|serviteur|maître|soumission|obéir|donner|partager|union|fusion d'âmes|pacte de servitude)\b/i)) {
      hints.push("🔗 INTENTION DE LIEN DÉTECTÉE. Le joueur veut créer un lien puissant. Utilise 'request_servitude' ou 'request_fusion'.");
  }

  // CATEGORY: SURVIVAL & REST
  if (lowAction.match(/\b(dort|repos|mange|bois|faim|soif|nourriture|sommeil|fatigue|épuisé|taverne|auberge|lit|repas|festin)\b/i)) {
      hints.push("🍖 INTENTION DE SURVIE DÉTECTÉE. Le joueur cherche à se restaurer. Utilise 'update_stats' { \"hunger_change\": 20, \"sleep_change\": 20 } après un repas ou une nuit de sommeil.");
  }

  // CATEGORY: BANK & FINANCE
  if (lowAction.match(/\b(banque|déposer|retirer|coffre-fort|compte|épargne|guichet|banquier|transfert|col)\b/i)) {
      hints.push("🏦 INTENTION BANCAIRE DÉTECTÉE. Utilise 'bank_transaction' { \"type\": \"deposit|withdraw\", \"amount\": n }.");
  }

  hints.push("⚠️ LOIS DE CAUSALITÉ & ANTI-TRICHE : Le monde est un écosystème logique. Un joueur ne peut PAS nager 3h sans compétence spéciale (il se noie en 5min s'il est Rang F). Pas de vol ou téléportation sans skill appris. Chaque action consomme du Mana (si technique) ou de l'endurance (Faim/Sommeil).");
  hints.push("⚠️ SENSORIALITÉ : Un joueur ne ressent pas les autres à distance sans compétence. Son rayon de perception naturelle dépend de son Rang (F: 5m, S: 100m).");
  hints.push("⚠️ APPLIQUE LES LOIS DU ROYAUME. Si un joueur commet un crime ou manque de respect aux Ducs/Rois, déclenche une punition immédiate et sévère (jusqu'à la mort ou l'emprisonnement).");
  hints.push("⚠️ RESTRICTION DE RANG & SKILLS : Un Rang F ne peut JAMAIS accomplir les prouesses d'un Rang B. Si un joueur tente une action sans avoir la compétence correspondante dans sa liste 'Skills', il ÉCHOUE bruyamment (maladresse, blessure, ridicule). Tu DOIS impérativement utiliser l'action 'check_requirements' pour valider toute tentative risquée ou technique.");
  hints.push("⚠️ CONTRAINTES GÉOGRAPHIQUES : Traverser un Royaume prend DES JOURS RP. Changer de Continent prend DES SEMAINES (via 'travel_to'). Interdiction de changer de royaume/continent instantanément sans téléportation (Skill S).");
  hints.push("⚠️ ÉPUISEMENT : Si Hunger ou Sleep < 20, le joueur est physiquement incapable de courir ou de combattre efficacement. Toute action physique exigeante ÉCHOUE ou entraîne un évanouissement immédiat.");
  hints.push("🎁 RÉCOMPENSES : Récompense systématiquement les actions réussies, l'ingéniosité ou les victoires par 'update_stats' { \"xp_gain\": n, \"sp_change\": n, \"col_change\": n }.");
  hints.push("🧠 GESTION DES SP : Chaque skill appris via 'add_skill' DOIT déduire 5 SP. Créer une compétence via 'create_custom_skill' coûte 10 SP. Si le joueur n'a plus de SP, l'action échoue.");

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

  const playerState = `Nom:${player.name}${player.isGod?'(GOD)':''} | Race:${player.race} | Sexe:${player.gender} | Age:${player.age} | Métier:${player.occupation} | Org:${player.organization} | Inf:${player.influence} | Bio:${player.characterDescription} | Fam:${player.family} | Classe:${player.class}(${player.derivative}) | SP:${player.skillPoints} | Rang:${player.rank} | Niv:${player.level} | XP:${player.xp}/${player.level*100} | PV:${player.health}/${player.maxHealth} | PM:${player.mana}/${player.maxMana} | Hunger:${player.hunger}/100 | Sleep:${player.sleep}/100 | Col:${player.col} | Wanted:${player.wantedLevel}/10 | Prisonnier:${player.isPrisoner?'OUI':'NON'} | Lieu:${player.location} (${player.subLocation}) | STATS: FOR:${Math.round(mainFor)} AGI:${Math.round(mainAgi)} INT:${Math.round(mainInt)} DEF:${player.defense} LUK:${player.luck}${mainBond}`;

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

  // Updated Time Logic: 1:9 scale + 10 mins per action
  const rpTime = getRPTime(actionsSinceLastMJ);
  const rpYearString = rpTime.formatted;
  const cycleInfo = rpTime.isDay ? "JOUR (Soleil, visibilité claire)" : "NUIT (Lune, ombres, visibilité réduite)";
  const weather = getWeather();

    // Mini-Event Trigger (20% chance)
    const triggerMiniEvent = Math.random() < 0.20;
    const miniEventContext = triggerMiniEvent
        ? "\n⚠️ **ÉVÉNEMENT IMPRÉVU**: Un événement aléatoire doit se produire maintenant ! (Ex: Un monstre surgit, une annonce impériale, un objet mystérieux trouvé, etc.)"
        : "";

  const systemPrompt = `DÉTERMINATION SYSTÈME GHENO-CITY (ÉCOSYSTÈME LOGIQUE & CAUSALITÉ) :
Tu es le MJ central. Ton objectif est d'incarner un écosystème logique avec des lois de causalité strictes. Réponds en JSON valide.

RÈGLE D'OR:
Toute modification de l'état d'un joueur DOIT se traduire par une action JSON. La base de données est la SEULE vérité.
- MORT: Si PV <= 0, le joueur est MORT. Action 'update_stats' { "health_change": 0 } obligatoire.
- XP: On gagne de l'XP UNIQUEMENT en TUANT des monstres ou en BATTANT des personnes. Interdiction d'en donner pour le social ou l'exploration.
- SP: Apprendre = 'add_skill' (5 SP). Créer = 'create_custom_skill' (10 SP).
- RÉCUPÉRATION: Méditation/Repos = 'update_stats' { "health_change": n, "mana_change": n, "hunger_change": 20, "is_meditation": true }.

LOI DE CAUSALITÉ & ANTI-TRICHE:
1. RÉALISME PHYSIQUE: Un joueur ne peut PAS nager 3h sans skill (noyade en 5min pour Rang F). Pas de vol ou téléportation sans skill appris.
2. TEMPS & ESPACE: Traverser un Royaume prend DES JOURS RP. Changer de Continent prend DES SEMAINES. Utilise 'travel_to'.
3. ÉCHELLE DE PUISSANCE (STRICT): Un Rang F est extrêmement faible. Stats limitées à 30 maximum. INTERDICTION de donner des stats de 1000+ ou des bonus massifs à un Rang F.
4. LOI ABSOLUE DES STATS: Un Rang S avec 999 de Force est INVINCIBLE face à plus faible. Plus le rang est bas, plus le personnage est fragile.
5. RACES & SOCIÉTÉ: Respecte les races (Humain, Elfe, Nain, Orc, Beastman, Undead, Celestial, Demon).
6. SENSORIALITÉ: Perception limitée par le Rang (F: 5m, S: 100m).
7. ÉPUISEMENT: Si Hunger ou Sleep < 20, les actions physiques ÉCHOUENT (évanouissement).

NARRATION:
- FORMAT: Un SEUL paragraphe fluide par joueur/groupe. Pas de listes, dashes (-) ou délimiteurs (▬▬▬▬).
- GROUPE: Si des joueurs sont ensemble, utilise un bloc [GROUPE: Nom1, Nom2]. Sinon, blocs [NOM_JOUEUR] isolés.
- STYLE: Manhwa/Anime visuel et viscéral. Décris les impacts, les odeurs, le sang et la causalité des actions.
- DIFFICULTÉ ÉQUILIBRÉE: Le monde est exigeant et réaliste, mais pas injuste. Les défis doivent être surmontables avec de la stratégie. La mort est possible mais n'est pas systématique.
- LÉTHALITÉ & VIOLENCE: Les combats sont brutaux et ont un poids réel. Une erreur grave peut être fatale, mais le succès est gratifiant.
- MATURITÉ: Le monde est mature et sans tabou (violence, relations charnelles, manipulations). Incarne cette crudité avec le style élégant d'un Seinen/Shonen sombre.
- MJ PUR: Ne joue JAMAIS le joueur. Décris UNIQUEMENT les conséquences et l'environnement.

VISUELS:
- Pour chaque utilisation de technique ou combat, inclus un objet "actionVisual": {"type": "skill|combat|magic", "assetName": "NomLieuOuMonstre", "title": "NOM TECHNIQUE", "description": "Brève description visuelle"} pour générer une image Canvas.
- Éducation: Si un PNJ explique une technique magique, utilise 'explain_magic' avec les détails techniques. Si quelqu'un écrit au tableau, utilise 'generate_document' avec type: 'blackboard'.

ACTIONS: update_location, update_stats, update_player, bank_transaction, buy_item, use_item, add_item, remove_item, add_skill, travel_to, spawn_npc, spawn_monster, create_custom_item, change_weather, manage_house, set_academic_status, query_database, modify_reputation, generate_document, notify_player, broadcast, start_quest, advance_quest, complete_quest, arrest_player, set_wanted_level, forge_pact, join_club, resurrect_player, write_journal, p2p_transfer, npc_trade, check_requirements, create_custom_skill, promote_player, explain_magic.`;


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

ATTENTION : Si tu mélanges les fils narratifs ou les inventaires, le système rencontrera une erreur de segmentation. RESTE ÉTANCHE.
RÉPONDS EXCLUSIVEMENT EN JSON VALIDE.`;

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
                .replace(/(\n|^)[a-z_]+[cC]hange:.*(\n|$)/gi, '')
                .replace(/\{[\s\S]*?\}/g, '') // Remove remaining JSON-like structures
                .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, '') // Remove remaining arrays of objects
                .replace(/imagePrompt:.*(\n|$)/gi, '')
                .replace(/actions:.*(\n|$)/gi, '')
                .trim();
    };

    if (typeof content === 'object') {
        aiResponse = { ...aiResponse, ...content };
        if (aiResponse.pensee_mj) console.log(`[MJ THOUGHTS] ${aiResponse.pensee_mj}`);
    } else {
        // Robust JSON extraction: Try to find all JSON-like structures
        const jsonRegex = /\{[\s\S]*?\}/g;
        const matches = [...content.matchAll(jsonRegex)];

        let foundJson = false;
        for (const match of matches) {
            try {
                const potential = JSON.parse(match[0]);
                if (potential.narrative || potential.actions || potential.status || potential.message) {
                    aiResponse = { ...aiResponse, ...potential };
                    foundJson = true;
                }
            } catch (e) {}
        }

        // If narrative is empty or too short, extract it from plain text
        if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
            let plainText = content.replace(/\{[\s\S]*?\}/g, '').replace(/```[a-z]*\n?/gi, '').trim();
            if (plainText.length > 5) {
                aiResponse.narrative = cleanupNarrative(plainText);
            }
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

    // SYNC ABSOLUE : Recharger le joueur pour que le HUD affiche les PV exacts après les actions de l'IA
    await player.reload();

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

    // Send typing indicator (presencesUpdate is not always reliable but good to try)
    try {
        await sock.sendPresenceUpdate('composing', jid);
        await sock.sendPresenceUpdate('paused', jid);
    } catch (e) {}

    await sendWithImage(sock, jid, aiResponse);

    // LIVE-actualisation: Silent Database Update + Automatic Profile Delivery
    // We send profile cards whenever a player's state has been modified.
    if (playersToUpdate.size > 0) {
        for (const pId of playersToUpdate) {
            try {
                const pToUpdate = await Player.findOne({ where: { whatsappId: pId } });
                if (pToUpdate && shouldNotifyPlayer(pToUpdate)) {
                    await pToUpdate.reload();
                    const profileBuffer = await generateProfileCard(pToUpdate);
                    await sock.sendMessage(pId, {
                        image: profileBuffer,
                        caption: `--- 🆔 PROFIL ACTUALISÉ : ${pToUpdate.name} ---`
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
