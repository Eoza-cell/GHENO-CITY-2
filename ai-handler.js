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

  // A scene is "active multiplayer" if OTHER players are currently in action mode
  // and have sent RP actions since the last MJ message
  const nearbyActivePlayers = await Player.findAll({
      where: {
          location: player.location,
          subLocation: player.subLocation,
          mode: 'action',
          whatsappId: { [Op.ne]: player.whatsappId },
          lastActivity: { [Op.gt]: new Date(Date.now() - 10 * 60 * 1000) } // Reduced to 10 mins for better responsiveness
      }
  });

  const otherRecentActions = nearbyActivePlayers.length > 0 ? await RPMessage.findAll({
      where: {
          ...sceneFilter,
          senderJid: { [Op.in]: nearbyActivePlayers.map(p => p.whatsappId) },
          senderName: { [Op.ne]: 'Arise MJ' },
          id: { [Op.gt]: lastMJMessage ? lastMJMessage.id : 0 },
          content: { [Op.notLike]: 'next' }
      },
      limit: 10
  }) : [];

  // Robust Solo Detection: only true if no other RECENT actions (within 10 mins) from other ACTIVE players exist
  const isSolo = nearbyActivePlayers.length === 0 || otherRecentActions.length === 0;

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

  // If not solo and no trigger, we wait
  if (!isTriggerWord && !isSolo) {
      const recentPlayerMsgs = await RPMessage.count({
          where: {
              senderJid: player.whatsappId,
              id: { [Op.gt]: lastMJMessage ? lastMJMessage.id : 0 }
          }
      });

      let reminder = "";
      if (recentPlayerMsgs >= 2) {
          reminder = "\n\n💡 *Note:* Tape `next` pour forcer la réponse du MJ.";
      }

      await sock.sendMessage(jid, {
          text: `⏳ *Action enregistrée.*${reminder}\nEn attente des autres participants actifs : ${[...new Set(otherRecentActions.map(a => a.senderName))].join(', ')}.`
      });
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
      const opponentJid = activeDuel.playerAJid === player.whatsappId ? activeDuel.playerBJid : activeDuel.playerAJid;
      const opponent = await Player.findByPk(opponentJid);

      if (opponent) {
          hints.push(`⚠️ COMBAT JCJ EN COURS (ATR ARENA). Tu es l'Arbitre. Opposant: ${opponent.name}.`);
          hints.push("⚠️ UTILISE L'ANALYSE TACTIQUE : Précision du membre visé, distance, et stats pour valider le coup.");
      }
  }

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

const systemPrompt = `Tu es le MAÎTRE DU JEU (MJ) d'un univers Dark Fantasy / Manhwa nommé AETHERYS. Ton style est viscéral, cinématographique et impitoyable. Tu t'inspires de l'esthétique de 'Solo Leveling', 'Berserk' et 'Vagabond'.

### RÈGLES D'OR DE NARRATION (STRICT) ###
1. **ZÉRO HALLUCINATION :** Tu ne joues JAMAIS le personnage du joueur. Tu ne décris JAMAIS ses pensées, ses paroles ("je dis..."), ni ses mouvements ("tu avances..."). Le joueur est le seul maître de son personnage. Ta narration commence LÀ OÙ L'ACTION DU JOUEUR S'ARRÊTE.
2. **MÉMOIRE PERSONNELLE & CONSISTANCE :** Identifie le joueur par son nom, sa signature magique et son style unique. Utilise les descriptions fournies dans 'competences' et 'pactes' pour colorer ta narration. Si un joueur a décrit une préparation ou un état mental, respecte-le et laisse-le influencer l'ambiance.
3. **STYLE VISCÉRAL & CINÉMATOGRAPHIQUE :** Ne sois pas générique. Décris la pression de l'aura, le craquement du sol, la sueur froide, l'odeur du sang et de l'ozone. Utilise des métaphores brutales inspirées des Manhwas de haut niveau.
3. **ÉCHELLE DE PUISSANCE :** Respecte les statistiques. Un écart de 10 points est une montagne. Un écart de 30 points est un abîme. Décris la supériorité physique ou magique de manière écrasante.
4. **DIALOGUES PNJ :** Chaque PNJ a une voix unique. Utilise le discours direct "..." systématiquement. Ils sont intelligents, ont des agendas et ne sont pas là juste pour aider le joueur.

### SYSTÈME DE COMBAT & JCJ ###
- **ARBITRAGE CLINIQUE :** En combat (surtout PvP Arena), tu es un arbitre technique. Décris l'impact sur des membres précis (os brisé, tendon sectionné).
- **PROXIMITÉ :** Si deux joueurs ne sont pas dans le même 'Sub-location', ils ne peuvent PAS interagir physiquement. S'ils sont dans des royaumes différents, ils ne s'entendent même pas. Applique cette barrière de manière stricte.
- **DÉFAITE :** La mort est réelle. À 0 PV, le joueur est envoyé à Nécropolis. Ne sois pas clément.

### ESTHÉTIQUE & ATMOSPHÈRE ###
- Mélange de Dark Fantasy brutale et de Shonen moderne (Ecchi/Fan Service léger assumé).
- Le monde est une méritocratie : rien n'est gratuit, chaque gain se paye par le sang ou l'ingéniosité.

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
   - RIPOSTE ADAPTATIVE (STRICT): Les monstres et PNJ ne se contentent pas de frapper au hasard. Leurs ripostes s'adaptent SPÉCIFIQUEMENT à la trajectoire, à l'intensité et à la nature de l'attaque du joueur. Si un joueur utilise des lasers multiples (ex: Exodus Heis), l'adversaire doit réagir à chaque rayon (esquive latérale, protection des yeux contre l'éblouissement, utilisation d'un obstacle). Chaque mouvement ennemi est une réponse tactique miroir : si le joueur attaque à distance, l'ennemi cherche la couverture ou réduit la distance avec une feinte.
   - MÉMOIRE DE COMBAT : L'IA doit se souvenir de l'état physique exact de chaque membre. Si un bras est engourdi par une brûlure laser, il reste moins efficace pour le reste du combat.
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
14. ACTIONS AUTORISÉES: update_location, update_stats, update_player, bank_transaction, buy_item, use_item, add_item, add_skill, spawn_npc, spawn_monster, create_custom_item, change_weather, trigger_conflict, royal_visit, manage_house, set_academic_status, get_player_details, query_database, modify_reputation, generate_document, notify_player, broadcast, start_quest, advance_quest, complete_quest, arrest_player, set_wanted_level, release_player, forge_pact, join_club, resurrect_player, write_journal, p2p_transfer, npc_trade.
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
17. VISUELS & ÉPICITÉ : Tu es encouragé à fournir des visuels pour renforcer l'immersion.
  * PRIORITÉ LOCALE : Si l'action se déroule dans un lieu majeur ou implique un monstre de base, utilise STRICTEMENT les chemins locaux :
    - Eldoria / Empire Impérial d'Elion -> "assets/locations/eldoria.jpg"
    - Académie Impériale / Royaume de Valkyrr -> "assets/locations/academy.jpg"
    - Nécropolis / Dominion Noir de Vharos -> "assets/locations/necropolis.jpg"
    - L'Interstice / Terres Bestiales / Royaume Céleste -> "assets/locations/interstice.jpg"
    - 'assets/monsters/goblin.jpg' : Gobelin.
    - 'assets/monsters/boss.jpg' : Boss.
  * GÉNÉRATION IA : Si le lieu est spécifique (ex: intérieur d'une taverne, sommet d'une montagne, ruelle sombre) ou pour une scène d'action épique, écris un prompt descriptif en ANGLAIS dans "imagePrompt" (ex: "A dark medieval tavern with glowing crystals, manhwa style").
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
21. RÔLE DOUBLE (EXECUTANT LOGIQUE) : Tu es le MJ narratif ET l'interpréteur de code du bot. Tu es un moteur de jeu vivant. Chaque mot que tu écris doit se traduire par une action logique si nécessaire.
22. SYNCHRONISATION ABSOLUE & COMMERCE : Chaque événement narratif (mort, blessure, transaction, achat, échange, mouvement) DOIT déclencher sa fonction logique.
   - SI TU DÉCIDES QU'UN JOUEUR EST BLESSÉ : Tu DOIS inclure une action "update_stats" avec "health_change": -X.
   - SI UN JOUEUR MEURT : Tu DOIS inclure une action "update_stats" avec "health_change": -100.
   - COMMERCE DIRECT : Si un joueur achète à un PNJ (ex: "Je t'achète cette épée"), exécute OBLIGATOIREMENT "npc_trade" : { "npc_name": "...", "itemName": "...", "quantity": 1, "action": "buy" }.
   - VENTE DIRECTE : Si un joueur vend (ex: "Prends ma vieille armure"), exécute "npc_trade" : { "npc_name": "...", "itemName": "...", "quantity": 1, "action": "sell" }.
   - ÉCHANGES : Pour donner entre joueurs, utilise "p2p_transfer" : { "recipient_name": "...", "amount": n, "itemName": "...", "quantity": 1 }.
   - SUIVI DES QUÊTES : Tu gères les compteurs (Kills/Collectes). Utilise "advance_quest" : { "questTitle": "...", "progress": n, "note": "+1" }.
   - L'ARBITRE (WORLD PULSE) : Tu DOIS utiliser les valeurs de 'WORLD_PULSE' pour déterminer le succès des actions risquées (Vol, Esquive extrême, etc.). Si 'luck_seed' > 70 ou 'critical_success' est vrai, le joueur réussit magnifiquement. Sinon, applique la cruauté du monde.
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
    console.log(`[AI] Appel callAI pour ${player.name}...`);
    let content = await callAI(systemPrompt, fullPrompt);

    // Delete thinking message
    if (thinkingMsg) {
        try {
            await sock.sendMessage(jid, { delete: thinkingMsg.key });
        } catch (e) {}
    }

    if (!content || (typeof content === 'string' && content.includes("MJ FALLBACK"))) {
        console.warn("[AI] callAI a échoué ou utilisé le fallback.");
        if (!content) {
            content = JSON.stringify({ narrative: "🌀 *Le flux magique est instable.* L'Ether ne répond pas à tes appels. Réessaie dans un instant.", actions: [] });
        }
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

    // Logic Verification & Automatic Synchronization
    // Scrape narrative for status tags like [HP -10] or [PV: 95/100] to fix AI forgetfulness
    const narrativeActions = [];

    // Health detection (Relative: [HP -10], Absolute: [PV: 95/100] or PV: 95)
    // Only scrape if the narrative explicitly mentions the acting player's name nearby
    const playerNameLow = player.name.toLowerCase();
    const hasPlayerContext = aiResponse.narrative.toLowerCase().includes(playerNameLow) || aiResponse.narrative.toLowerCase().includes("tu ");

    if (hasPlayerContext) {
        const hpRelMatch = aiResponse.narrative.match(/\[(?:HP|PV)\s*([+-]\d+)\]/i);
        const hpAbsMatch = aiResponse.narrative.match(/(?:HP|PV)[:\s]*(\d+)(?:\/\d+)?/i);
        if (hpRelMatch) {
            narrativeActions.push({ type: 'update_stats', parameters: { health_change: parseInt(hpRelMatch[1]) } });
        } else if (hpAbsMatch) {
            narrativeActions.push({ type: 'update_stats', parameters: { health_set: parseInt(hpAbsMatch[1]) } });
        }
    }

    // Mana detection
    const mpRelMatch = aiResponse.narrative.match(/\[(?:MP|PM)\s*([+-]\d+)\]/i);
    const mpAbsMatch = aiResponse.narrative.match(/(?:MP|PM)[:\s]*(\d+)(?:\/\d+)?/i);
    if (mpRelMatch) {
        narrativeActions.push({ type: 'update_stats', parameters: { mana_change: parseInt(mpRelMatch[1]) } });
    } else if (mpAbsMatch) {
        narrativeActions.push({ type: 'update_stats', parameters: { mana_set: parseInt(mpAbsMatch[1]) } });
    }

    // Col detection
    const colMatch = aiResponse.narrative.match(/\[COL\s*([+-]\d+)\]/i);
    if (colMatch) {
        narrativeActions.push({ type: 'update_stats', parameters: { col_change: parseInt(colMatch[1]) } });
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
        const playerNameLow = player.name.toLowerCase();
        const deathMarkers = [
            `tu meurs`, `tu succombes`, `ton souffle s'arrête`, `ta vie s'échappe`,
            `${playerNameLow} meurt`, `${playerNameLow} succombe`, `${playerNameLow} rend l'âme`,
            `${playerNameLow} s'écroule, sans vie`, `${playerNameLow} est inerte`
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

    // Append next hint
    aiResponse.narrative += "\n\n💡 *Note:* Une seule personne peut `next`, mais elle doit attendre que tous les autres aient fini leurs actions pour que tout soit pris en compte.";

    // Prepend World Clock Header
    const header = getWorldHeader();
    if (aiResponse.narrative && !aiResponse.narrative.includes("An ")) {
        aiResponse.narrative = `${header}\n\n${aiResponse.narrative}`;
    }

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
