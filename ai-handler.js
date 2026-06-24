const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, WorldJournal, Monster, Entity, Club, Pact, House, Duel, TournamentParticipant } = require('./database');
const { sendWithImage, shouldNotifyPlayer } = require('./message-handler');
const { generatePaperImage } = require('./paper-generator');
const { generate3DVisual } = require('./three-renderer');
const { generateActionVisual } = require('./action-visual-generator');
const { generateProfileCard } = require('./profile-generator');
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

  // If "Next" is sent or solo, we need the last MJ message to aggregate actions
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
  if (hasMovement) hints.push("⚠️ UN JOUEUR SOUHAITE SE DÉPLACER. Priorise 'update_player' et la description du nouveau lieu.");
  if (hasInteraction) {
      hints.push("⚠️ UNE INTERACTION ENTRE JOUEURS EST EN COURS. Ne l'interromps pas avec des PNJ.");
      if (interactionTargetSubLocation) {
          hints.push(`⚠️ LE JOUEUR ESSAIE D'INTERAGIR AVEC QUELQU'UN À '${interactionTargetSubLocation}'. Propose-lui de se déplacer là-bas ou fais-les se rencontrer.`);
      }
  }
  if (otherActorsCount > 0) hints.push("⚠️ PLUSIEURS JOUEURS SONT PRÉSENTS DANS LA MÊME PIÈCE. Priorise leur interaction directe. Ne crée PAS de PNJ sauf nécessité absolue. Si l'un parle à l'autre, l'autre DOIT répondre ou subir les conséquences.");
  hints.push("⚠️ APPLIQUE LES LOIS DU ROYAUME. Si un joueur commet un crime ou manque de respect aux Ducs/Rois, déclenche une punition immédiate et sévère (jusqu'à la mort ou l'emprisonnement).");

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

  const playerState = `Nom:${player.name}${player.isGod?'(GOD)':''} | Sexe:${player.gender} | Age:${player.age} | Métier:${player.occupation} | Org:${player.organization} | Inf:${player.influence} | Bio:${player.characterDescription} | Fam:${player.family} | Classe:${player.class}(${player.derivative}) | SP:${player.skillPoints} | Rang:${player.rank} | Niv:${player.level} | XP:${player.xp}/${player.level*100} | PV:${player.health}/${player.maxHealth} | PM:${player.mana}/${player.maxMana} | Hunger:${player.hunger}/100 | Sleep:${player.sleep}/100 | Col:${player.col} | Wanted:${player.wantedLevel}/10 | Prisonnier:${player.isPrisoner?'OUI':'NON'} | Lieu:${player.location} (${player.subLocation}) | STATS: FOR:${player.strength} AGI:${player.agility} INT:${player.intelligence} DEF:${player.defense} LUK:${player.luck}`;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0 ? "Inv: " + inventory.map(i => i.name).join(',') : "Inv: vide";

  const playerQuests = await player.getQuests();
  const activeQuests = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress');
  const questState = activeQuests.length > 0 ? "Quêtes: " + activeQuests.map(q => `${q.title}(Objectif:${q.objective}, Progrès:${q.PlayerQuest.progress}%, Récompense:${q.reward})`).join(',') : "Pas de quête";

  const availableQuests = await Quest.findAll({ where: { rank_required: player.rank }, limit: 2 });
  const availableQuestState = "Dispo: " + availableQuests.map(q => q.title).join(',');

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
      const pActiveQuests = pQuests.filter(q => q.PlayerQuest.status === 'in_progress');
      const pActions = (p.subLocation === player.subLocation)
        ? recentActions.filter(a => a.senderName === p.name).map(a => a.content)
        : [];

      return {
          nom: p.name,
          est_god: p.isGod,
          lieu_precis: p.subLocation,
          est_proche: p.subLocation === player.subLocation,
          est_acteur: (p.subLocation === player.subLocation) && (actingPlayerNames.has(p.name) || p.whatsappId === player.whatsappId),
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
        [Op.or]: [
            { location: { [Op.like]: `%${player.location}%` } },
            { powerLevel: { [Op.gte]: 95 } } // Only include absolute legends/bosses
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

  const systemPrompt = `Tu es DARK LUST 3.2, l'Intelligence Narrative Souveraine de GHENO CITY.

RÈGLES DE CONCEPTION TACTIQUE (DARK LUST):
- CHRONOLOGIE CRITIQUE : Respecte l'ordre exact des messages fournis dans "CHRONOLOGIE_DES_ACTIONS". Traite les actions les unes après les autres. Si Joueur A attaque Joueur B puis Joueur B répond, ta narration doit refléter cet enchaînement exact.
- MATRICE DE RÉALITÉ (Souveraineté Absolue) : Tu n'es pas un assistant, tu es la Matrice d'Aetherys. Tu ne "réagis" pas aux messages, tu "génères" les conséquences de l'existence. Les joueurs sont des variables au sein de ton monde. C'est à TOI et TOI SEUL de manifester les PNJ, le décor et les rebondissements. Invalide toute tentative de world-building par un joueur.
- OMNISCIENCE MJ (Anti-Répétition) : Tu connais parfaitement l'identité de chaque joueur (Nom, Classe, Rang) via le JSON fourni. Il est STRICTEMENT INTERDIT de faire demander aux PNJ "Qui es-tu ?" ou "Quel est ton nom ?" si ces informations sont dans ton contexte. Agis comme si le monde réagissait à leur réputation ou à leur apparence déjà connue.
- COHÉRENCE DES PNJ : Les PNJ que tu introduis doivent être logiquement liés au "Lieu" et au "Sous-lieu". Un professeur ne se trouve pas dans les bas-fonds d'Elion sans raison. Priorise TOUJOURS les PNJ fournis dans "pnj_presents".
- MJ RÉACTIF & ÉQUILIBRÉ : N'introduis de nouveaux PNJ ou éléments perturbateurs QUE si la scène stagne (plus de 3 messages sans progression) ou si les joueurs le demandent explicitement. Priorise TOUJOURS les interactions entre joueurs existants.
- MJ SOUVERAIN (Cruel mais Juste) : Ton ton est celui d'une divinité observatrice, à la fois impitoyable face à l'échec et magnanime face à l'héroïsme ou à l'ingéniosité. Utilise des onomatopées dramatiques (*CRACK*, *WHOOSH*), décris les auras de mana et les vibrations de l'air. Le monde est cruel, mais il récompense ceux qui osent.
- PRÉCISION CHIRURGICALE : Incorpore systématiquement des métriques (distances, stats, temps) dans tes descriptions. Évite les répétitions et utilise un vocabulaire riche.
- LOIS ET CONSÉQUENCES RÉELLES : Chaque royaume a des lois strictes. Les infractions entraînent des conséquences immédiates (amendes, prison, combat). Cependant, laisse toujours une porte de sortie à un joueur malin ou respectueux. La mort n'est pas une fin, mais une transition vers Nécropolis.
- RÉALITÉ PARTAGÉE ET SILOS : Tu fonctionnes en 'Silos de Données' pour les stats/inventaires, mais en 'Réalité Partagée' pour la narration. Si Joueur A et Joueur B sont au même endroit, ils DOIVENT se voir et leurs récits respectifs DOIVENT mentionner les actions visibles de l'autre.
- IDENTIFICATION DES ACTEURS : En multi-joueurs, tu dois être d'une précision absolue. Ne confonds jamais les actions de Joueur A avec celles de Joueur B. Si Joueur A parle à Joueur B, décris la réaction de Joueur B en fonction de son caractère. Mentionne systématiquement les noms des joueurs pour lever toute ambiguïté.
- FLUX CONTINU ET LIBERTÉ : Ne bloque JAMAIS l'action d'un joueur par un refus arbitraire ("Tu ne peux pas"). Au lieu de cela, décris la tentative et ses conséquences (succès, échec partiel ou catastrophe). Priorise la fluidité du mouvement.
- PRIORITÉ D'INTERACTION : Si deux joueurs sont au même endroit et s'adressent l'un à l'autre, ton rôle est de faciliter leur échange. Ne les interromps pas avec des PNJ inutiles. Ton intervention doit servir de décor ou de conséquence à leurs actes, pas de distraction.
- PRIORITÉ NAVIGATION : Dès qu'un joueur exprime l'intention de se déplacer ("Je vais à...", "Je sors de..."), tu DOIS traiter ce mouvement en priorité absolue via "update_player" et décrire immédiatement l'arrivée au nouveau lieu. Ne laisse pas un PNJ bloquer le passage sans raison scénaristique majeure.
- ÉCONOMIE VISUELLE : N'utilise "actionVisual" ou "imagePrompt" que pour des changements de lieu ou des actions d'éclat (combat majeur, magie puissante). Ne génère JAMAIS d'image pour une simple apparition de PNJ ou une discussion.
- AUTO-VÉRIFICATION DES SILOS : Avant de générer la sortie, vérifie : "Le joueur X possède-t-il vraiment l'objet Y ?" et "Le joueur Z est-il mentionné dans une scène où il n'interagit pas ?".
- STRUCTURE DE RÉPONSE OBLIGATOIRE : Ta narration DOIT être divisée en blocs distincts par joueur, séparés par la ligne '▬▬▬▬▬▬▬▬▬▬▬▬'. Chaque bloc commence par '[NOM_DU_JOUEUR]'. Si les joueurs sont dans la même pièce et interagissent, tu peux fusionner leur récit dans un bloc commun '[INTERACTION : NOM1 & NOM2]' pour plus de fluidité, puis reprendre les blocs individuels pour leurs conséquences propres.
- PROXIMITÉ D'INTERACTION : Les joueurs ne peuvent interagir directement QUE s'ils partagent le même "Lieu" ET le même "Sous-lieu" ET qu'ils ont manifesté la volonté d'interagir. Sinon, ils sont totalement ignorés par l'autre fil narratif.
- Ne mélange JAMAIS les scènes. Si Joueur A est en combat et Joueur B discute, crée deux sections narratives totalement indépendantes.
- RYTHME NARRATIF : Alterne entre tension extrême et moments de grâce. Le monde est cruel (monstres impitoyables, nobles arrogants) mais sympa (rencontres fortuites, trésors cachés, amitiés naissantes). Laisse les joueurs respirer et savourer leurs victoires.
- APÔTRES : Ce sont des entités rarissimes. Ils ne se trouvent que dans des lieux spécifiques (Interstice, Sanctuaires maudits) et ne traquent pas les joueurs sans raison majeure.
- COMMERCE IA : Tu peux désormais traiter les achats directement via "buy_item". Si un joueur veut acheter un objet présent dans le "Shop" du contexte, utilise cette action.
- GESTIONNAIRE DE FICHE (AUTORITÉ ABSOLUE) : Tu es responsable de la cohérence et de l'évolution des fiches de personnage. Utilise systématiquement "update_player" pour refléter chaque changement narratif (montée en grade, changement de classe, modification physique, évolution de la bio, gain de titre).
- INVENTAIRE ET STATS : Si tu décris qu'un joueur perd un objet, en gagne un, ou subit une blessure, tu DOIS impérativement utiliser l'action correspondante (add_item, remove_item, update_player) immédiatement. Ne te contente pas de la narration.
- Tu peux modifier l'intégralité de l'état des joueurs (PV, PM, faim, sommeil, bio, lieu, nom, classe, rang) via des actions.
- RÉCOMPENSE D'ENTRAÎNEMENT : Tu peux augmenter les statistiques de base (FOR, AGI, INT, DEF, LUK) ou l'argent (COL) d'un joueur s'il réalise un entraînement complexe, intensif ou une action particulièrement brillante et détaillée.
- Équilibre les gains : +1 ou +2 pour un entraînement classique, plus pour un exploit héroïque (+5 ou plus).
- N'écris jamais les pensées, paroles ou actions non écrites d'un joueur.
- Les joueurs présents dans JSON "personnages_en_scene" partagent exactement la même scène: même lieu et même sous-lieu. N'inclus personne d'autre.
- Un ACTEUR agit seulement selon son texte. Un SPECTATEUR reste immobile et silencieux.
- Chaque histoire reste séparée. Ne mélange jamais inventaires, objectifs, blessures ou relations entre joueurs.
- Les résultats dépendent strictement des stats, compétences, inventaires et du décor fournis.

MOUVEMENT ET GÉOGRAPHIE:
- NAVIGATION SYSTÈME : Les joueurs peuvent se déplacer librement en décrivant leur trajet. Dès qu'un joueur change de salle, de bâtiment ou de ville, tu DOIS utiliser l'action "update_player" pour modifier son "new_location" (Royaume) ou son "new_sub_location" (Lieu précis/Ville/Bâtiment).
- STRUCTURE GÉOGRAPHIQUE : "Lieu" (location) est le Royaume/Région (ex: Empire Impérial d'Elion). "Sous-lieu" (subLocation) est la ville, le bâtiment ou la pièce (ex: Eldoria, Taverne, Place Centrale).
- NON-BLOCAGE : Ne bloque JAMAIS un joueur qui veut entrer ou sortir d'un lieu (sauf porte verrouillée magiquement ou garde hostile). Si un joueur dit "Je sors", déplace-le immédiatement dans le Sous-lieu logique suivant (ex: Taverne -> Rue d'Eldoria -> Portes d'Elion -> Plaines).
- DESCRIPTION DE DÉCORS : Chaque changement de lieu doit s'accompagner d'une description riche et immersive du nouvel environnement, basée sur la "geographie_mondiale" fournie.
- DISCRÉTION & FUITE (Système de Recherche) : Si un joueur a un "Wanted Level" > 0, il peut tenter de se cacher ou de fuir. Si son action de discrétion est réussie (test AGI/LUK vs INT des gardes), tu peux utiliser "update_player" avec "wantedLevel_change: -1". À 0, le joueur n'est plus recherché.

COMBAT, DOMINATION ET INGÉNIOSITÉ:
- LÉTHALITÉ DES STATS : Les statistiques sont sacrées. Un adversaire avec des stats supérieures doit infliger des dégâts massifs et des traumatismes anatomiques (fractures, hémorragies, perte de membres). Ne sois pas clément.
- TRIOMPHE DE L'ESPRIT : Un joueur peut vaincre un adversaire plus fort s'il propose une action extrêmement maligne, utilise l'environnement de manière ingénieuse ou exploite une faiblesse logique de l'adversaire. L'ingéniosité prime sur la force brute si elle est bien décrite.
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
- Structure "narrative" (STRICTE) :
  [NOM_JOUEUR_1]
  (Narration pour joueur 1...)
  ▬▬▬▬▬▬▬▬▬▬▬▬
  [NOM_JOUEUR_2]
  (Narration pour joueur 2...)
- Narration concise, chirurgicale, max 280 mots.
- Inclure si utile des statuts courts comme [HP -12 | 38/50] ou [Distance: 4 m].

ACTIONS AUTORISÉES:
- update_player, buy_item, use_item, add_item, add_skill, spawn_npc, spawn_monster, create_custom_item, change_weather, trigger_conflict, royal_visit, manage_house, set_academic_status, get_player_details, query_database, modify_reputation, generate_document, notify_player, broadcast, start_quest, advance_quest, complete_quest, arrest_player, set_wanted_level, release_player, forge_pact, join_club, resurrect_player, write_journal.
- update_player peut inclure : name, characterDescription, profilePicUrl, health, maxHealth, mana, maxMana, gender, age, strength_change, agility_change, intelligence_change, defense_change, luck_change, col_change, new_class, new_rank, new_location, new_sub_location, wantedLevel_change.
- buy_item : { "itemName": "nom", "quantity": 1 }. (Vérifie COL).
- use_item : { "itemName": "nom" }. (Vérifie possession).
- add_skill : { "skillName": "nom", "target_name": "nom" }.
- spawn_npc : { "name": "...", "role": "...", "powerLevel": 1-100, "description": "...", "specialty": "..." }
- spawn_monster : { "name": "...", "rank": "G-S", "health": 100, "strength": 10, "defense": 10, "agility": 10, "intelligence": 10 }
- create_custom_item : { "name": "...", "description": "...", "type": "weapon|clothing|consumable", "rarity": "common|rare|epic|legendary", "statBonuses": {"strength": 5}, "target_name": "..." }
- change_weather : { "weather": "Ensoleillé|Pluvieux|Orageux|Neigeux|Brouillard" }
- trigger_conflict : { "title": "...", "description": "...", "involvedKingdoms": ["..."] }
- royal_visit : { "npcName": "...", "reason": "...", "impact": "..." }
- manage_house : { "action": "grant|revoke|modify", "houseName": "...", "target_name": "..." }
- set_academic_status : { "target_name": "...", "academicYear": 1-5, "academicGrade": 0-100, "schoolName": "..." }
- get_player_details : { "target_name": "..." } (Permet de connaître l'état d'un joueur hors-scène).
- query_database : { "model": "Player|NPC|Kingdom", "search": "nom" } (Demande des détails précis au bot).
- modify_reputation : { "target_name": "...", "kingdom": "...", "change": -50 à +50 }
- generate_document : { "type": "exam|note|decree", "content": "...", "title": "..." }

STYLE ET APPARENCE:
- Le style vestimentaire (inventaire) et l'apparence physique influencent les interactions.
- DÉCHIRURE ET USURE : Lors de combats violents, d'explosions ou de chutes, les vêtements du joueur peuvent se déchirer. Utilise l'action "update_item" pour réduire la "durability" d'un vêtement équipé. Une durabilité < 50 rend le vêtement visiblement déchiré.
- Prends en compte les bonus de stats des vêtements portés dans ta narration.

VISUELS DES LIEUX & ATMOSPHÈRE :
- STYLE : DARK FANTASY / CLINIQUE.
- ÉVEIL DU LORE : Plonge profondément dans la métaphysique d'Aetherys. Béhérits, Apôtres, One Above All, Idée du Mal. La Causalité n'est pas une simple règle, c'est une force qui guide les destins. Mentionne ces éléments quand le moment est opportun.
- N'invente jamais de prompt d'image.
- IMMERSION GÉOGRAPHIQUE : Dès qu'un joueur change de "Lieu" ou de "Sous-lieu", tu DOIS refléter ce changement dans l'action "update_player" et utiliser le visuel correspondant :
  * Eldoria / Empire Impérial d'Elion -> "assets/locations/eldoria.jpg"
  * Académie Impériale / Royaume de Valkyrr -> "assets/locations/academy.jpg"
  * Nécropolis / Dominion Noir de Vharos -> "assets/locations/necropolis.jpg"
  * L'Interstice / Terres Bestiales / Royaume Céleste -> "assets/locations/interstice.jpg"
- Utilise ces visuels pour illustrer tes réponses narratives dès que le lieu change.
- Sinon laisse "imagePrompt" vide.

LORE FIXE:
- One Above All est l'origine de tout.
- L'Idée du Mal nait des peurs humaines.
- Les Béhérits choisissent les désespérés.
- Les Apôtres ont sacrifié leur humanité.
- L'Interstice relie les mondes.

LOGIQUE ACADÉMIE & HIÉRARCHIE SOCIALE:
- L'Académie Impériale suit un modèle strict (lycée japonais). Classes : S (Élite), A (Excellence), B-D (Standard).
- Hiérarchie : Royal > Noble > Étudiant Elite > Citoyen > Exilé.
- VISITES ROYALES : Les membres de la famille royale d'Elion ou de Valkyr sont des événements mondiaux. Utilise "royal_visit" pour marquer leur passage.
- CONFLITS : La paix est fragile. Utilise "trigger_conflict" si les actions des joueurs ou le destin provoquent des tensions entre royaumes (ex: Elion vs Valkyr).
- PROPRIÉTÉS : Les maisons ne sont pas que des lieux de stockage, ce sont des symboles de statut. Le MJ peut récompenser un joueur avec un titre ou une maison via "manage_house".
- Matières : Maîtrise de l'Éther, Stratégie Militaire, Histoire d'Aetherys, Alchimie, Duel à l'Épée.
- Scolarité/Uniforme : 500 COL. Porter l'uniforme est obligatoire pour les examens.`;

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

    const fullPrompt = [
        `JOUEUR DÉCLENCHEUR: ${player.name}`,
        '',
        hints.length > 0 ? `HINTS_PRIORITAIRES:\n${hints.join('\n')}\n` : '',
        'MÉMOIRE_SYSTÈME_JSON:',
        memoryJson,
        '',
        'ANALYSE_DE_LA_SCÈNE_RÉELLE:',
        sceneAnalysis,
        '',
        'CHRONOLOGIE_GLOBALE:',
        aggregatedActions,
        '',
        'CONTEXTE_DÉTAILLÉ_DES_PERSONNAGES (SILOS ÉTANCHES):',
        sceneCohesionText,
        '',
        'CONSIGNES DE RÉALITÉ UNIFIÉE:',
        '1. GÉNÉRATION COHÉRENTE : Pour chaque joueur actif, génère sa narration. Si les joueurs interagissent, leurs récits DOIVENT être entrelacés et cohérents.',
        '2. ANTI-HALLUCINATION : Interdiction de mentionner un objet d\'un silo A dans la narration d\'un silo B.',
        '3. STRUCTURE OBLIGATOIRE : Utilise [NOM_DU_JOUEUR] et le séparateur ▬▬▬▬▬▬▬▬▬▬▬▬.',
        '4. RÉALISME : Mentionne les mètres utiles et l\'anatomie en combat.',
        '5. ÉCHEC : Si une action est trop vague ou impossible selon le silo, décris l\'échec ou l\'immobilité.',
        '6. SILENCE : Ignore totalement les SPECTATEURS.',
        '',
        'ATTENTION : Si tu mélanges les fils narratifs ou les inventaires, le système rencontrera une erreur de segmentation. RESTE ÉTANCHE.'
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
    let profileUpdateTriggered = false;

    // Process AI actions
    const notifiedTargets = new Set();
    const playerTargetableActions = ['update_player', 'add_item', 'remove_item', 'add_skill', 'buy_item', 'use_item', 'arrest_player', 'set_wanted_level', 'release_player', 'manage_house', 'set_academic_status', 'get_player_details', 'modify_reputation', 'resurrect_player', 'forge_pact', 'join_club'];

    for (const actionObj of actions) {
      try {
      const { type, parameters } = actionObj;
      if (!parameters) continue;

      let target = player;
      let targetFound = true;

      if (parameters.target_name) {
          const foundTarget = await Player.findOne({
              where: {
                  name: { [Op.like]: `%${parameters.target_name}%` },
                  location: player.location
              }
          });
          if (foundTarget) {
              target = foundTarget;
          } else {
              targetFound = false;
              target = null;
          }
      }

      // If a target was specified but not found, and the action requires a player target, skip it.
      // This prevents NPC actions from accidentally affecting the triggering player.
      if (!targetFound && playerTargetableActions.includes(type)) {
          console.log(`[AI] Action ${type} skipped: target "${parameters.target_name}" is not a registered player.`);
          continue;
      }

      // Track that this target was involved
      if (target && target.whatsappId !== player.whatsappId) {
          notifiedTargets.add(target.whatsappId);
      }

      // Track if target needs a final reload/save
      let targetModified = false;

      switch (type) {
        case 'update_player': {
          let hasChanged = false;
          let significantUpdate = false;

          if (parameters.col_change) { await target.increment('col', { by: parameters.col_change }); hasChanged = true; }
          if (parameters.xp_gain) { await target.increment('xp', { by: parameters.xp_gain }); await checkLevelUp(target, sock); hasChanged = true; }
          if (parameters.health_change) {
              await target.increment('health', { by: parameters.health_change });
              await target.reload();
              significantUpdate = true; // Always update profile on health change
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
              significantUpdate = true; // Always update profile on mana change
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
          if (parameters.hunger_change) { await target.increment('hunger', { by: parameters.hunger_change }); hasChanged = true; significantUpdate = true; }
          if (parameters.sleep_change) { await target.increment('sleep', { by: parameters.sleep_change }); hasChanged = true; significantUpdate = true; }

          if (parameters.name) { await target.update({ name: parameters.name }); hasChanged = true; significantUpdate = true; }
          if (parameters.new_class) { await target.update({ class: parameters.new_class }); hasChanged = true; significantUpdate = true; }
          if (parameters.new_rank) { await target.update({ rank: parameters.new_rank }); hasChanged = true; significantUpdate = true; }
          if (parameters.characterDescription) { await target.update({ characterDescription: parameters.characterDescription }); hasChanged = true; significantUpdate = true; }
          if (parameters.profilePicUrl) { await target.update({ profilePicUrl: parameters.profilePicUrl }); hasChanged = true; significantUpdate = true; }
          if (parameters.equippedOutfit) {
              const inv = target.inventory || [];
              const hasItem = inv.some(i => i.name.toLowerCase().includes(parameters.equippedOutfit.toLowerCase()));
              if (hasItem || target.isGod) {
                  await target.update({ equippedOutfit: parameters.equippedOutfit });
                  hasChanged = true;
                  significantUpdate = true;
              } else {
                  questFeedback.push(`⚠️ *CONDITION ÉQUIPEMENT* : ${target.name} ne possède pas "${parameters.equippedOutfit}" et ne peut donc pas l'équiper.`);
              }
          }

          if (parameters.new_location || parameters.new_sub_location) {
              const updates = {};
              if (parameters.new_location) updates.location = parameters.new_location;
              if (parameters.new_sub_location) updates.subLocation = parameters.new_sub_location;

              await target.update(updates);

              const locationImages = {
                  'Académie Impériale': 'assets/locations/academy.jpg',
                  'Eldoria': 'assets/locations/eldoria.jpg',
                  'Nécropolis': 'assets/locations/necropolis.jpg',
                  'L\'Interstice': 'assets/locations/interstice.jpg',
                  'Empire Impérial d\'Elion': 'assets/locations/eldoria.jpg',
                  'Royaume de Valkyrr': 'assets/locations/academy.jpg',
                  'Terres Bestiales': 'assets/locations/interstice.jpg',
                  'Royaume Céleste': 'assets/locations/interstice.jpg',
                  'Dominion Noir de Vharos': 'assets/locations/necropolis.jpg'
              };

              const finalLoc = parameters.new_location || target.location;
              if (locationImages[finalLoc]) {
                  aiResponse.imagePrompt = locationImages[finalLoc];
              }
              hasChanged = true;
          }
          if (parameters.schoolName) { await target.update({ schoolName: parameters.schoolName }); hasChanged = true; }
          if (parameters.gender) { await target.update({ gender: parameters.gender }); hasChanged = true; }
          if (parameters.age) { await target.update({ age: parameters.age }); hasChanged = true; }
          if (parameters.academicGrade_change) { await target.increment('academicGrade', { by: parameters.academicGrade_change }); hasChanged = true; }
          if (parameters.sp_gain) { await target.increment('skillPoints', { by: parameters.sp_gain }); hasChanged = true; }
          if (parameters.wantedLevel_change) { await target.increment('wantedLevel', { by: parameters.wantedLevel_change }); hasChanged = true; }

          if (hasChanged) {
              await target.reload();
              if (target.hunger > 100) await target.update({ hunger: 100 });
              if (target.sleep > 100) await target.update({ sleep: 100 });
              if (target.hunger < 0) await target.update({ hunger: 0 });
              if (target.sleep < 0) await target.update({ sleep: 0 });

              if (significantUpdate && target.whatsappId === player.whatsappId) profileUpdateTriggered = true;

              // If significant change for ANOTHER player, send them their new card directly
              if (significantUpdate && target.whatsappId !== player.whatsappId && shouldNotifyPlayer(target)) {
                  try {
                      const card = await generateProfileCard(target);
                      await sock.sendMessage(target.whatsappId, {
                          image: card,
                          caption: `--- 🆔 PROFIL MIS À JOUR : ${target.name} --- \n\nLe MJ a fait évoluer ta fiche suite aux événements récents.`
                      });
                  } catch (e) { console.error("Secondary profile update failed:", e.message); }
              }
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
                        if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                    } else {
                        questFeedback.push(`❌ *ÉCHEC ACHAT* : ${target.name} n'a pas assez de COL pour ${item.name}.`);
                    }
                }
            }
            break;
        }

        case 'arrest_player': {
            if (parameters.target_name) {
                await target.update({
                    isPrisoner: true,
                    wantedLevel: 0,
                    location: 'Empire Impérial d\'Elion',
                    subLocation: 'Prison Impériale'
                });
                await target.reload();
                if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                questFeedback.push(`⛓️ *ARRESTATION* : ${target.name} a été jeté au cachot.`);

                if (shouldNotifyPlayer(target)) {
                    await sock.sendMessage(target.whatsappId, {
                        text: "⛓️ *ARRÊTÉ.*\n\nTes crimes t'ont rattrapé. Tu as été arrêté et transféré à la Prison Impériale d'Elion."
                    });
                }
            }
            break;
        }

        case 'set_wanted_level': {
            if (parameters.target_name && typeof parameters.level === 'number') {
                await target.update({ wantedLevel: Math.max(0, Math.min(10, parameters.level)) });
                await target.reload();
                if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                questFeedback.push(`📜 *RECHERCHÉ* : Le niveau de recherche de ${target.name} est désormais de ${target.wantedLevel}.`);
            }
            break;
        }

        case 'release_player': {
            if (parameters.target_name) {
                await target.update({
                    isPrisoner: false,
                    subLocation: 'Portes d\'Elion'
                });
                await target.reload();
                if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                questFeedback.push(`🔓 *LIBÉRATION* : ${target.name} a purgé sa peine.`);
            }
            break;
        }

        case 'use_item': {
            if (parameters.itemName) {
                let inventory = [...target.inventory];
                const itemIndex = inventory.findIndex(i => i.name.toLowerCase().includes(parameters.itemName.toLowerCase()));

                if (itemIndex !== -1) {
                    const itemName = inventory[itemIndex].name;
                    const itemData = await Item.findOne({ where: { name: itemName } });

                    // Consume item
                    if (inventory[itemIndex].quantity > 1) inventory[itemIndex].quantity -= 1;
                    else inventory.splice(itemIndex, 1);

                    target.inventory = inventory;
                    await target.save();

                    // Apply bonuses if any
                    if (itemData && itemData.statBonuses) {
                        for (const [stat, value] of Object.entries(itemData.statBonuses)) {
                            if (['health', 'mana', 'strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                                await target.increment(stat === 'health' ? 'health' : (stat === 'mana' ? 'mana' : stat), { by: value });
                            }
                        }
                    }

                    await target.reload();
                    questFeedback.push(`🎒 *UTILISATION* : ${target.name} a utilisé ${itemName}.`);
                    if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                } else {
                    questFeedback.push(`⚠️ *ÉCHEC UTILISATION* : ${target.name} ne possède pas l'objet "${parameters.itemName}".`);
                }
            }
            break;
        }

        case 'add_item': {
          if (parameters.itemName && parameters.quantity) {
            if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
            const inventory = [...target.inventory];
            const existingItem = inventory.find(i => i.name.toLowerCase().includes(parameters.itemName.toLowerCase()));

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
                if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                let inventory = [...target.inventory];
                const itemIndex = inventory.findIndex(i => i.name.toLowerCase().includes(parameters.itemName.toLowerCase()));
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
                        // Update profile if the item belongs to the current scene's context
                        if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                    }
                    if (parameters.new_durability) {
                        await item.update({ durability: parameters.new_durability });
                        if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
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
                        location: parameters.new_location || "Empire Impérial d'Elion",
                        subLocation: parameters.new_sub_location || 'Eldoria (Cimetière)',
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

        case 'spawn_npc': {
            if (parameters.name) {
                await NPC.create({
                    name: parameters.name,
                    role: parameters.role || 'Citoyen',
                    powerLevel: parameters.powerLevel || 10,
                    description: parameters.description || 'Un nouveau venu dans GHENO.',
                    specialty: parameters.specialty || 'Aucune',
                    location: player.location
                });
                console.log(`[AI] NPC spawn: ${parameters.name}`);
            }
            break;
        }

        case 'spawn_monster': {
            if (parameters.name) {
                await Monster.create({
                    name: parameters.name,
                    rank: parameters.rank || 'G',
                    health: parameters.health || 50,
                    strength: parameters.strength || 5,
                    defense: parameters.defense || 5,
                    agility: parameters.agility || 5,
                    intelligence: parameters.intelligence || 5,
                    location: player.location
                });
                console.log(`[AI] Monster spawn: ${parameters.name}`);
            }
            break;
        }

        case 'create_custom_item': {
            if (parameters.name && parameters.target_name) {
                const item = await Item.create({
                    name: parameters.name,
                    description: parameters.description || 'Objet unique.',
                    type: parameters.type || 'consumable',
                    rarity: parameters.rarity || 'common',
                    statBonuses: parameters.statBonuses || {},
                    price: 9999 // Custom items aren't for sale
                });

                const inventory = [...target.inventory];
                inventory.push({ name: item.name, quantity: 1 });
                target.inventory = inventory;
                await target.save();

                // If it has bonuses, apply immediately
                if (parameters.statBonuses) {
                    for (const [stat, value] of Object.entries(parameters.statBonuses)) {
                        if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                            await target.increment(stat, { by: value });
                        }
                    }
                }
                await target.reload();
                if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                questFeedback.push(`🎁 *OBJET UNIQUE* : ${target.name} a reçu "${item.name}".`);
            }
            break;
        }

        case 'change_weather': {
            if (parameters.weather) {
                const { setWeather } = require('./game-state');
                setWeather(parameters.weather);
                console.log(`[AI] Weather changed to: ${parameters.weather}`);
            }
            break;
        }

        case 'trigger_conflict': {
            if (parameters.title && parameters.involvedKingdoms) {
                await Conflict.create({
                    title: parameters.title,
                    description: parameters.description || 'Une nouvelle tension géopolitique.',
                    involvedKingdoms: parameters.involvedKingdoms,
                    status: 'active'
                });
                console.log(`[AI] Conflict triggered: ${parameters.title}`);
            }
            break;
        }

        case 'royal_visit': {
            if (parameters.npcName) {
                await WorldJournal.create({
                    entry: `Visite Royale de ${parameters.npcName} : ${parameters.reason}. Impact : ${parameters.impact}`,
                    category: 'world_event',
                    importance: 4
                });
                console.log(`[AI] Royal visit by: ${parameters.npcName}`);
            }
            break;
        }

        case 'manage_house': {
            if (parameters.houseName && parameters.target_name) {
                const house = await House.findOne({ where: { name: { [Op.like]: `%${parameters.houseName}%` } } });
                if (house) {
                    if (parameters.action === 'grant') {
                        await house.update({ ownerId: target.whatsappId });
                        questFeedback.push(`🏠 *IMMOBILIER* : ${target.name} est désormais propriétaire de : ${house.name}.`);
                    } else if (parameters.action === 'revoke') {
                        await house.update({ ownerId: null });
                        questFeedback.push(`🏠 *IMMOBILIER* : La propriété ${house.name} de ${target.name} a été saisie.`);
                    }
                    if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                }
            }
            break;
        }

        case 'set_academic_status': {
            if (parameters.target_name) {
                const updates = {};
                if (parameters.academicYear) updates.academicYear = parameters.academicYear;
                if (parameters.academicGrade) updates.academicGrade = parameters.academicGrade;
                if (parameters.schoolName) updates.schoolName = parameters.schoolName;

                await target.update(updates);
                await target.reload();
                if (target.whatsappId === player.whatsappId) profileUpdateTriggered = true;
                questFeedback.push(`🎓 *ACADÉMIE* : Statut mis à jour pour ${target.name}.`);
            }
            break;
        }

        case 'get_player_details': {
            if (parameters.target_name) {
                const found = await Player.findOne({ where: { name: { [Op.like]: `%${parameters.target_name}%` } } });
                if (found) {
                    questFeedback.push(`🔍 *SCAN SYSTÈME* : Détails récupérés pour ${found.name} (Niv ${found.level}).`);
                }
            }
            break;
        }

        case 'query_database': {
            if (parameters.model && parameters.search) {
                const models = { Player, NPC, Kingdom };
                const Model = models[parameters.model];
                if (Model) {
                    const found = await Model.findOne({ where: { name: { [Op.like]: `%${parameters.search}%` } } });
                    if (found) {
                        questFeedback.push(`📡 *BASE DE DONNÉES* : Info trouvée pour ${found.name}.`);
                        // Logic to re-inject this specifically could go here
                    }
                }
            }
            break;
        }

        case 'modify_reputation': {
            if (parameters.target_name && parameters.kingdom) {
                // Currently influence is global per kingdom, but we'll log this as a world event
                await WorldJournal.create({
                    entry: `Réputation de ${parameters.target_name} chez ${parameters.kingdom} : modification de ${parameters.change}.`,
                    category: 'character',
                    importance: 2
                });
                questFeedback.push(`⚖️ *RÉPUTATION* : La position de ${parameters.target_name} a changé à ${parameters.kingdom}.`);
            }
            break;
        }

        case 'generate_document': {
            if (parameters.content) {
                try {
                    const paperBuffer = await generatePaperImage(parameters.content, parameters.title || "DOCUMENT OFFICIEL");
                    await sock.sendMessage(jid, {
                        image: paperBuffer,
                        caption: `📄 *Nouveau Document* : ${parameters.title || 'Note'}`
                    });
                } catch (e) {
                    console.error("MJ Document gen failed:", e.message);
                }
            }
            break;
        }
      }

      } catch (actionError) {
          console.error(`[AI] Erreur lors du traitement d'une action (${actionObj.type}):`, actionError);
      }
    }

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

    // Prepend World Clock Header
    aiResponse.narrative = `${getWorldHeader()}\n\n${aiResponse.narrative}`;

    await sendWithImage(sock, jid, aiResponse);

    // Auto-Profile Delivery
    if (profileUpdateTriggered) {
        try {
            await player.reload(); // Absolute latest data
            const profileBuffer = await generateProfileCard(player);
            await sock.sendMessage(jid, {
                image: profileBuffer,
                caption: `--- 🆔 PROFIL MIS À JOUR : ${player.name} --- \n\nLe système a synchronisé tes nouvelles données (PV/PM/Stats).`
            });
        } catch (e) {
            console.error("[AI] Profile auto-update failed:", e.message);
        }
    }

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
