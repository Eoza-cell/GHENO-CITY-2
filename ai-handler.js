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
  const questState = activeQuests.length > 0 ? "Quêtes: " + activeQuests.map(q => `${q.title}(Objectif:${q.objective}, Progrès:${q.PlayerQuest.progress}%, Récompenses:${q.reward_col}Col/${q.reward_xp}XP)`).join(',') : "Pas de quête";

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

  const systemPrompt = `Tu es le narrateur d'un RP fantasy vivant, immersif et dynamique. Le monde évolue en permanence, même lorsque les joueurs n'agissent pas. Les royaumes, factions, guildes, créatures, dieux, monstres et civilisations poursuivent leurs propres objectifs. Les actions des joueurs peuvent modifier l'histoire, influencer la politique, déclencher des guerres, créer des alliances ou provoquer des catastrophes.

Les joueurs sont totalement libres de leurs choix. Ils peuvent explorer, combattre, commercer, discuter, voyager, fonder des organisations, gouverner des territoires ou poursuivre leurs propres ambitions. L'histoire s'adapte naturellement à leurs décisions au lieu de les forcer à suivre un scénario unique.

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
   - RÈGLE D'IMMOBILITÉ & PRÉCISION: Tant qu'un joueur n'est pas assez précis dans ses actions (quelle main il utilise, sa trajectoire de mouvement exacte, comment il tient son arme, etc.), il reste IMMOBILE ou son action échoue. S'il dit juste "j'attaque", il ne bouge pas. La précision est la clé de l'action.
   - Si un joueur est listé comme SPECTATEUR, il est TOTALEMENT immobile et silencieux. Ne le fais JAMAIS bouger, parler, ni même échanger un regard.
   - Si un joueur est listé comme ACTEUR, réagis UNIQUEMENT à ce qu'il a écrit. N'invente AUCUN dialogue ou mouvement pour lui.
2. STATS & ÉQUIPEMENT (STRICT):
   - INVENTAIRE: Un joueur ne peut utiliser QUE les objets listés dans 'Inv'. S'il tente d'utiliser un objet qu'il n'a pas, l'action échoue narrativement (ex: il fouille ses poches en vain).
   - LIEU: Le joueur est strictement limité à sa 'Location' et sa 'Sub-Location'. Il ne peut pas interagir avec des éléments d'un autre lieu sans se déplacer physiquement via 'update_location'.
   - NAVIGATION SYSTÈME : Les joueurs peuvent se déplacer librement en décrivant leur trajet. Dès qu'un joueur change de salle, de bâtiment ou de ville, tu DOIS utiliser l'action "update_location" pour modifier son "new_location" (Royaume) ou son "new_sub_location" (Lieu précis/Ville/Bâtiment).
   - NON-BLOCAGE : Ne bloque JAMAIS un joueur qui veut entrer ou sortir d'un lieu (sauf porte verrouillée magiquement ou garde hostile). Si un joueur dit "Je sors", déplace-le immédiatement dans le Sous-lieu logique suivant (ex: Taverne -> Rue d'Eldoria -> Portes d'Elion -> Plaines).
   - STATS: Les résultats dépendent UNIQUEMENT des statistiques fournies. Pas de succès miraculeux sans stats adéquates.
   - FORCE/AGI GAPS: Si un attaquant a >15 pts d'écart, l'impact est dévastateur (anatomie broyée).
   - LIBERTÉ ET AVENTURE (PRIORITÉ) : Le joueur est libre et son aventure est le cœur du récit. Ne t'enlise PAS dans des procédures administratives, des gardes omniprésents ou des rappels constants aux lois. Priorise l'exploration, l'action, le lore métaphysique et les interactions significatives.
   - MINIMISATION DES GARDES : Ne fais intervenir des gardes ou la police QUE si le joueur commet un crime flagrant et public, ou si cela sert un arc narratif majeur. Évite les "contrôles d'identité" ou les "procédures" ennuyeuses qui cassent le rythme.
   - SUBTILITÉ DES LOIS : Ne liste JAMAIS les lois ou "le Code" d'un royaume de manière systématique. Les lois sont des détails du monde, pas des règles de jeu à afficher. Elles doivent transparaître naturellement à travers le comportement des PNJ ou des conséquences immédiates, sans être citées comme un règlement.
   - ADVERSAIRES ACTIFS (STRICT): Les PNJ et monstres ne sont JAMAIS passifs. Ils utilisent l'environnement, feintent, et emploient leurs techniques.
   - RIPOSTE ADAPTATIVE (STRICT): Les monstres et PNJ ne se contentent pas de frapper au hasard. Leurs ripostes s'adaptent SPÉCIFIQUEMENT aux actions du joueur. Si un joueur feinte, le PNJ (selon son INT) peut voir clair dans le jeu ou se faire piéger. Si un joueur vise une jambe, le PNJ tente de protéger cette zone ou utilise le déséquilibre pour contre-attaquer. Chaque riposte doit être une réponse tactique directe au mouvement du joueur.
   - RIPOSTE DES MONSTRES: Ils esquivent/parent et contre-attaquent dans le même tour. Inflige des dégâts via update_stats.
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
13. FORMAT: JSON STRICT {"pensee_mj": "Ta réflexion interne sur la situation et les joueurs", "narrative":"...", "actions":[], "imagePrompt":"", "actionVisual":{"type":"attack|defend|magic|combat","assetName":"Eldoria|Gobelin|...","title":"...","description":"..."}}
14. ACTIONS AUTORISÉES: update_location, update_stats, update_player, bank_transaction, buy_item, use_item, add_item, add_skill, spawn_npc, spawn_monster, create_custom_item, change_weather, trigger_conflict, royal_visit, manage_house, set_academic_status, get_player_details, query_database, modify_reputation, generate_document, notify_player, broadcast, start_quest, advance_quest, complete_quest, arrest_player, set_wanted_level, release_player, forge_pact, join_club, resurrect_player, write_journal.
    - update_location : { "new_location": "Royaume", "new_sub_location": "Lieu" }. (OBLIGATOIRE dès que le lieu change).
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
    - Décris des détails sensoriels précis (l'odeur du sang, le gémissement du vent, le poids du silence).
    - Pour les combats : Sois ultra-viscéral. Décris les os qui éclatent, les muscles qui se déchirent, les organes touchés. Ne dis pas "tu le frappes", dis "ton poing s'écrase contre son nez dans un craquement sec de cartilage, le sang giclant sur tes phalanges".
20. NARRATION & DIALOGUES: Français riche et cinématographique. Les dialogues des PNJ doivent être percutants et refléter leur personnalité unique. Pas de phrases génériques. Entre directement dans le vif du sujet. CONCISION MAITRISÉE (Max 500 mots). Va droit au but, évite les fioritures inutiles.
21. RÔLE DOUBLE (MJ & MOTEUR LOGIQUE) : Tu es à la fois le narrateur immersif et l'ordinateur qui gère le code du jeu. Tu as le contrôle total sur les fiches des joueurs.
22. SYNCHRONISATION ABSOLUE & GESTION DES QUÊTES: Toute modification de l'état d'un joueur décrite dans la narrative (blessure, gain d'objet, déplacement, changement de classe, nouvelle cicatrice, etc.) DOIT impérativement être accompagnée de l'action correspondante (update_stats, add_item, update_location, bank_transaction, update_player, etc.) dans le champ "actions".
   - COMPTAGE & SUIVI DES QUÊTES : Tu es responsable du comptage des objectifs (ex: nombre de monstres tués). Inclus le décompte actuel dans ta pensée_mj (ex: "Objectif: 10 gobelins. Actuel: 4. +1 kill = 5. Progrès: 50%"). Utilise ensuite "advance_quest" : { "questTitle": "nom", "progress": n, "note": "5/10 tués" }. Dès que 100% est atteint, utilise "complete_quest" : { "questTitle": "nom" } pour clôturer et verser les récompenses automatiquement.
   - MISE À JOUR DE LA FICHE : Utilise "update_player" pour refléter l'évolution RP sur la fiche /profile (ex: changement de métier, de famille, ajout d'une description physique suite à un événement).
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
- generate_document : { "type": "exam|note|decree", "content": "...", "title": "..." }`;


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

    const fullPrompt = `### MÉMOIRE_SYSTÈME_JSON (CONTEXTE DÉTAILLÉ PAR JOUEUR) ###\n${memoryJson}

### RÉSUMÉ DES ACTIONS À TRAITER ###
${actionSummary}

CONSIGNE DE COHÉRENCE MULTI-JOUEUR:
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
    const playersToUpdate = new Set();

    // Process AI actions
    const notifiedTargets = new Set();
    const playerTargetableActions = ['update_location', 'update_stats', 'update_player', 'bank_transaction', 'add_item', 'remove_item', 'add_skill', 'buy_item', 'use_item', 'arrest_player', 'set_wanted_level', 'release_player', 'manage_house', 'set_academic_status', 'get_player_details', 'modify_reputation', 'resurrect_player', 'forge_pact', 'join_club', 'start_quest', 'advance_quest', 'complete_quest', 'update_quest'];

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

      switch (type) {
        case 'update_location': {
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
            playersToUpdate.add(target.whatsappId);
            break;
        }

        case 'update_stats': {
            let hasChanged = false;

            if (parameters.col_change) { await target.increment('col', { by: parameters.col_change }); hasChanged = true; }
            if (parameters.xp_gain) { await target.increment('xp', { by: parameters.xp_gain }); await checkLevelUp(target, sock); hasChanged = true; }
            if (parameters.hunger_change) { await target.increment('hunger', { by: parameters.hunger_change }); hasChanged = true; }
            if (parameters.sleep_change) { await target.increment('sleep', { by: parameters.sleep_change }); hasChanged = true; }
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
                        await target.update({ location: 'Nécropolis', subLocation: 'Le Seuil' });
                        questFeedback.push(`💀 *MORT* : L'âme de ${target.name} a quitté son corps. Il erre désormais à Nécropolis.`);
                        if (shouldNotifyPlayer(target)) {
                            await sock.sendMessage(target.whatsappId, { text: "💀 *TU ES MORT.*\n\nPersonne ne t'a secouru à temps. Ton âme a sombré dans l'Interstice et tu te réveilles désormais à Nécropolis, le monde des morts.\n\nSeule une résurrection magique par un vivant pourra te ramener." });
                        }
                    }
                }
                hasChanged = true;
            }
            if (parameters.mana_change) {
                await target.increment('mana', { by: parameters.mana_change });
                await target.reload();
                if (target.mana > target.maxMana) await target.update({ mana: target.maxMana });
                if (target.mana < 0) await target.update({ mana: 0 });
                hasChanged = true;
            }
            if (parameters.strength_change) { await target.increment('strength', { by: parameters.strength_change }); hasChanged = true; }
            if (parameters.agility_change) { await target.increment('agility', { by: parameters.agility_change }); hasChanged = true; }
            if (parameters.intelligence_change) { await target.increment('intelligence', { by: parameters.intelligence_change }); hasChanged = true; }
            if (parameters.defense_change) { await target.increment('defense', { by: parameters.defense_change }); hasChanged = true; }
            if (parameters.luck_change) { await target.increment('luck', { by: parameters.luck_change }); hasChanged = true; }
            if (parameters.sp_change) { await target.increment('skillPoints', { by: parameters.sp_change }); hasChanged = true; }

            if (hasChanged) {
                await target.reload();
                playersToUpdate.add(target.whatsappId);
            }
            break;
        }

        case 'bank_transaction': {
            await target.reload();
            const [bank] = await Bank.findOrCreate({ where: { PlayerWhatsappId: target.whatsappId } });
            await bank.reload();
            if (parameters.type === 'deposit') {
                if (target.col >= parameters.amount) {
                    await target.decrement('col', { by: parameters.amount });
                    await bank.increment('balance', { by: parameters.amount });
                    await target.reload();
                    await bank.reload();
                    questFeedback.push(`🏦 *BANQUE* : ${target.name} a déposé ${parameters.amount} Col. Nouveau solde : ${bank.balance} Col.`);
                } else {
                    questFeedback.push(`❌ *ÉCHEC BANQUE* : ${target.name} n'a pas assez de Col pour déposer.`);
                }
            } else if (parameters.type === 'withdraw') {
                if (bank.balance >= parameters.amount) {
                    await bank.decrement('balance', { by: parameters.amount });
                    await target.increment('col', { by: parameters.amount });
                    await target.reload();
                    await bank.reload();
                    questFeedback.push(`🏦 *BANQUE* : ${target.name} a retiré ${parameters.amount} Col. Nouveau solde : ${bank.balance} Col.`);
                } else {
                    questFeedback.push(`❌ *ÉCHEC BANQUE* : ${target.name} n'a pas assez en banque pour retirer.`);
                }
            }
            playersToUpdate.add(target.whatsappId);
            break;
        }

        case 'update_player': {
          let hasChanged = false;

          if (parameters.max_health_change) { await target.increment('maxHealth', { by: parameters.max_health_change }); hasChanged = true; }
          if (parameters.max_mana_change) { await target.increment('maxMana', { by: parameters.max_mana_change }); hasChanged = true; }

          if (parameters.name) { await target.update({ name: parameters.name }); hasChanged = true; }
          if (parameters.new_class) { await target.update({ class: parameters.new_class }); hasChanged = true; }
          if (parameters.derivative) { await target.update({ derivative: parameters.derivative }); hasChanged = true; }
          if (parameters.new_rank) { await target.update({ rank: parameters.new_rank }); hasChanged = true; }
          if (parameters.family) { await target.update({ family: parameters.family }); hasChanged = true; }
          if (parameters.occupation) { await target.update({ occupation: parameters.occupation }); hasChanged = true; }
          if (parameters.organization) { await target.update({ organization: parameters.organization }); hasChanged = true; }
          if (parameters.characterDescription) { await target.update({ characterDescription: parameters.characterDescription }); hasChanged = true; }
          if (parameters.profilePicUrl) { await target.update({ profilePicUrl: parameters.profilePicUrl }); hasChanged = true; }
          if (parameters.equippedOutfit) {
              const inv = target.inventory || [];
              const hasItem = inv.some(i => i.name.toLowerCase().includes(parameters.equippedOutfit.toLowerCase()));
              if (hasItem || target.isGod) {
                  await target.update({ equippedOutfit: parameters.equippedOutfit });
                  hasChanged = true;
              } else {
                  questFeedback.push(`⚠️ *CONDITION ÉQUIPEMENT* : ${target.name} ne possède pas "${parameters.equippedOutfit}" et ne peut donc pas l'équiper.`);
              }
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
              playersToUpdate.add(target.whatsappId);
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
                playersToUpdate.add(target.whatsappId);
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
                        playersToUpdate.add(target.whatsappId);
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
                playersToUpdate.add(target.whatsappId);
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
                playersToUpdate.add(target.whatsappId);
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
                playersToUpdate.add(target.whatsappId);
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
                    playersToUpdate.add(target.whatsappId);
                } else {
                    questFeedback.push(`⚠️ *ÉCHEC UTILISATION* : ${target.name} ne possède pas l'objet "${parameters.itemName}".`);
                }
            }
            break;
        }

        case 'add_item': {
          if (parameters.itemName && parameters.quantity) {
            playersToUpdate.add(target.whatsappId);
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
                playersToUpdate.add(target.whatsappId);
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
                        playersToUpdate.add(target.whatsappId);
                    }
                    if (parameters.new_durability) {
                        await item.update({ durability: parameters.new_durability });
                        playersToUpdate.add(target.whatsappId);
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
                            playersToUpdate.add(target.whatsappId);
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
                        playersToUpdate.add(target.whatsappId);
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
                    playersToUpdate.add(deadPlayer.whatsappId);
                    playersToUpdate.add(caster.whatsappId);

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
                playersToUpdate.add(target.whatsappId);
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
                    playersToUpdate.add(target.whatsappId);
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
                playersToUpdate.add(target.whatsappId);
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
