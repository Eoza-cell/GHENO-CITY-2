const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, WorldJournal, Monster, Entity, Club, Pact } = require('./database');
const { sendWithImage } = require('./message-handler');
const { generatePaperImage } = require('./paper-generator');
const { generate3DVisual } = require('./three-renderer');
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
          location: player.location
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
          const paperPath = await generatePaperImage(writtenText, isExam ? "COPIE D'EXAMEN" : "NOTE MANUSCRITE");
          await sock.sendMessage(jid, {
              image: { url: paperPath },
              caption: `📜 *Tu as fini d'écrire...*\n\n"${writtenText.substring(0, 100)}${writtenText.length > 100 ? '...' : ''}"`
          });
      } catch (err) {
          console.error("[Paper] Error generating paper visual:", err);
      }
  }

  // Only trigger AI on 'next'
  const isTriggerWord = actionText.toLowerCase().trim() === 'next';

  if (!isTriggerWord) {
      await sock.sendMessage(jid, {
          text: "⏳ *Action enregistrée.*\nAttendez les autres joueurs pour `next`. S'ils ne sont pas là, ils sont immobiles devant vous et ne réagissent à rien."
      });
      return;
  }

  // If "Next" is sent, aggregate all messages since the last MJ response
  const lastMJMessage = await RPMessage.findOne({
      where: { senderName: 'Arise MJ', location: player.location },
      order: [['id', 'DESC']]
  });

  const messageQuery = {
      location: player.location,
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
    : "(Aucune action récente des joueurs. Le MJ doit prendre l'initiative pour faire avancer le monde ou interpeller quelqu'un.)";

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

  const playerState = `Nom:${player.name}${player.isGod?'(GOD)':''} | Métier:${player.occupation} | Org:${player.organization} | Inf:${player.influence} | Bio:${player.characterDescription} | Fam:${player.family} | Classe:${player.class}(${player.derivative}) | SP:${player.skillPoints} | Rang:${player.rank} | Niv:${player.level} | XP:${player.xp}/${player.level*100} | PV:${player.health}/${player.maxHealth} | PM:${player.mana}/${player.maxMana} | Hunger:${player.hunger}/100 | Sleep:${player.sleep}/100 | Col:${player.col} | Lieu:${player.location} (${player.subLocation}) | STATS: FOR:${player.strength} AGI:${player.agility} INT:${player.intelligence} DEF:${player.defense} LUK:${player.luck}`;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0 ? "Inv: " + inventory.map(i => i.name).join(',') : "Inv: vide";

  const playerQuests = await player.getQuests();
  const activeQuests = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress');
  const questState = activeQuests.length > 0 ? "Quêtes: " + activeQuests.map(q => `${q.title}(${q.PlayerQuest.progress}%)`).join(',') : "Pas de quête";

  const availableQuests = await Quest.findAll({ where: { rank_required: player.rank }, limit: 2 });
  const availableQuestState = "Dispo: " + availableQuests.map(q => q.title).join(',');

  const dungeons = await Dungeon.findAll({ limit: 1 });
  const dungeonState = "Donjon: " + dungeons.map(d => `${d.name}(${d.rank})`).join(',');

  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location
    }
  });

  const actingPlayerNames = new Set(recentActions.map(a => a.senderName));
  const activePlayers = nearbyPlayers.filter(p => actingPlayerNames.has(p.name) || p.whatsappId === player.whatsappId);
  const spectatorPlayers = nearbyPlayers.filter(p => !actingPlayerNames.has(p.name) && p.whatsappId !== player.whatsappId);

  const socialState = `ACTEURS: ${activePlayers.map(p => p.name).join(', ')} | SPECTATEURS (SILENCIEUX): ${spectatorPlayers.length > 0 ? spectatorPlayers.map(p => p.name).join(', ') : 'Aucun'}`;
  const proactiveHint = spectatorPlayers.length > 0
    ? `\nMJ HINT: N'hésite pas à faire bouger les choses pour les spectateurs (${spectatorPlayers.map(p => p.name).join(', ')}) s'ils sont inactifs depuis trop longtemps. Interpelle-les avec @Nom.`
    : "";

  const recentPlayers = await Player.findAll({
      where: { whatsappId: { [Op.ne]: player.whatsappId } },
      order: [['lastActivity', 'DESC']],
      limit: 3
  });
  const worldSocialState = "Rumeurs: " + recentPlayers.map(p => `${p.name}(${p.location})`).join(',');

  const items = await Item.findAll({ limit: 1 });
  const shopState = "Shop: " + items.map(i => i.name).join(',');

  // Fetch history (last 50 messages) for Short Term Memory
  const history = await RPMessage.findAll({
      where: { location: player.location },
      order: [['id', 'DESC']],
      limit: 50
  });
  const historyState = history.length > 0
    ? "MÉMOIRE_COURT_TERME:\n" + history.reverse().map(h => `[${h.senderName}]: ${h.content}`).join('\n')
    : "";

  // Fetch World Journal entries for Long Term Memory
  const journal = await WorldJournal.findAll({
      order: [['id', 'DESC']],
      limit: 20
  });
  const journalState = journal.length > 0
    ? "MÉMOIRE_LONG_TERME (Journal du Monde):\n" + journal.reverse().map(j => `[${j.category.toUpperCase()}] ${j.entry}`).join('\n')
    : "Aucune entrée dans le journal.";

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0 ? "Skills: " + playerSkills.map(s => s.name).join(', ') : "Aucun skill";
  const npcs = await NPC.findAll({ where: { location: { [Op.like]: `%${player.location}%` } }, limit: 2 });
  const npcState = "PNJ: " + npcs.map(n => `${n.name}(${n.role})`).join(', ');
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
        ? "\n⚠️ **ÉVÉNEMENT IMPRÉVU**: Un événement aléatoire doit se produire maintenant ! (Ex: Un PNJ t'interpelle, un monstre surgit, une annonce impériale, un objet mystérieux trouvé, etc.)"
        : "";

  const systemPrompt = `Tu es le narrateur d'un RP fantasy vivant, immersif et dynamique. Le monde évolue en permanence, même lorsque les joueurs n'agissent pas. Les royaumes, factions, guildes, créatures, dieux, monstres et civilisations poursuivent leurs propres objectifs. Les actions des joueurs peuvent modifier l'histoire, influencer la politique, déclencher des guerres, créer des alliances ou provoquer des catastrophes.

Les joueurs sont totalement libres de leurs choix. Ils peuvent explorer, combattre, commercer, discuter, voyager, fonder des organisations, gouverner des territoires ou poursuivre leurs propres ambitions. L'histoire s'adapte naturellement à leurs décisions au lieu de les forcer à suivre un scénario unique.

Les déplacements sont constamment pris en compte. Chaque personnage possède une position précise dans l'environnement. La narration décrit naturellement les distances importantes, les obstacles, les bâtiments, les reliefs, les objets et les différentes zones présentes autour des personnages. Les mouvements tels que les courses, sauts, esquives, charges, retraites, ascensions ou déplacements tactiques doivent être clairement décrits lorsqu'ils influencent la situation.

Les combats sont entièrement basés sur les statistiques, compétences, équipements, aptitudes spéciales, passifs, résistances, états et conditions environnementales. Une action déclarée par un joueur représente une tentative et non une réussite garantie. Les résultats dépendent toujours des capacités réelles des personnages impliqués. Les esquives, blocages, contre-atteques, blessures et dégâts sont déterminés de manière cohérente selon les statistiques. Les personnages plus rapides réagissent mieux, les plus puissants frappent plus fort, les plus résistants encaissent davantage et les plus expérimentés exploitent plus facilement les ouvertures.

La narration doit être fluide, naturelle et cinématographique. Chaque action décrit précisément les mouvements effectués, les membres utilisés, les zones visées, les réactions provoquées et les conséquences logiques des événements. Les ennemis, monstres et PNJ réagissent intelligemment selon leur personnalité, leur niveau d'intelligence, leurs objectifs et leur situation actuelle.

L'environnement est interactif et persistant. Les bâtiments, arbres, falaises, routes, ruines, meubles, armes abandonnées et autres éléments du décor peuvent être utilisés durant les combats ou l'exploration. Les dégâts causés au monde restent visibles lorsque cela est logique.

Le monde doit sembler vivant. Les habitants possèdent leur propre routine, les marchands voyagent, les armées se déplacent, les monstres chassent, les factions complotent et les événements continuent d'avancer indépendamment des joueurs.

Les dialogues doivent être naturels et cohérents avec la personnalité de chaque personnage. Les émotions, tensions, rivalités, amitiés et conflits évoluent progressivement selon les interactions vécues durant l'aventure.

Le ton général doit rappeler un anime ou un roman fantasy moderne : aventure, exploration, mystère, action, humour, drame et développement des personnages. Des situations légères, humoristiques ou maladroites peuvent parfois apparaître pour renforcer la personnalité des personnages et l'ambiance du monde, sans devenir le centre principal du récit.

L'objectif principal est de créer une aventure immersive où les choix des joueurs ont un véritable impact, où les statistiques possèdent une réelle importance mécanique et où chaque action génère des conséquences cohérentes dans un monde vivant et crédible. 🔥⚔️🌍

LORE SUPRÊME:
1. ONE ABOVE ALL: Créateur ultime, origine de tout.
2. ENTITÉS CÉLESTES & BESTIALES: Créées par One Above All.
3. L'IDÉE DU MAL: Conscience collective née des peurs humaines.
4. BÉHÉRITS: Reliques vivantes apparaissant lors du désespoir absolu.
5. APÔTRES: Humains ayant sacrifié leur humanité pour un pouvoir divin.
6. L'INTERSTICE: Dimension entre les mondes.

RÈGLES TECHNIQUES:
1. RÉACTIVITÉ ABSOLUE: Ne décris JAMAIS les pensées, paroles ou actions d'un joueur.
   - RÈGLE D'IMMOBILITÉ: Si un joueur est listé comme SPECTATEUR dans le CONTEXTE, il est TOTALEMENT immobile et silencieux. Ne le fais JAMAIS bouger, parler, ni même échanger un regard ou une expression faciale. Il est comme une statue.
   - Si un joueur est listé comme ACTEUR, réagis uniquement à ce qu'il a écrit dans ACTIONS_JOUEURS. N'invente AUCUN dialogue ou mouvement supplémentaire pour lui.
2. STATS (PvP/PvE): Si un attaquant a une FORCE ou AGILITÉ >15 pts d'écart à la cible, l'impact est dévastateur (os brisés, traumatismes).
   - RIPOSTE DES MONSTRES: Les monstres ne sont pas des sacs à PV. Ils esquivent (basé sur leur AGI) et contre-attaquent violemment (basé sur leur FOR) durant le même tour que l'action du joueur. Si un joueur attaque, le monstre doit tenter de parer ou d'esquiver, puis riposter immédiatement. Inflige des dégâts via update_player si le joueur est touché.
   - CONSISTANCE GÉOGRAPHIQUE DES MONSTRES: Les monstres et BOSS ne peuvent apparaître que dans leur lieu (Location) assigné. Ne fais JAMAIS apparaître un monstre qui n'appartient pas à la zone actuelle du joueur.
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
11. SURVIE: Si la Faim (Hunger) ou le Sommeil (Sleep) est bas (<20), le joueur subit des malus narratifs (fatigue, vertiges). À 0, il commence à perdre des PV. Manger ou dormir restaure ces barres via update_player.
12. PROGRESSION & TECHNIQUES: Les joueurs possèdent des techniques de base. Ils peuvent en apprendre de nouvelles via 'add_skill' (coût en SP à déduire via 'update_player') ou par l'entraînement narratif. Les techniques peuvent évoluer (ex: 'Vertical Square' devenant 'Square Cross') si le joueur pratique intensément ou vit un choc émotionnel fort.
13. FORMAT: JSON STRICT {"pensee_mj": "Ta réflexion interne sur la situation et les joueurs", "narrative":"...", "actions":[], "imagePrompt":"..."}
14. ACTIONS: update_player, add_item, add_skill, notify_player, broadcast, start_quest, advance_quest, complete_quest, forge_pact, join_club, resurrect_player, write_journal.
15. VISUELS (STRICT): La génération d'images par IA est DÉSACTIVÉE. Tu ne dois JAMAIS inventer de nouveaux prompts d'image. Tu dois UNIQUEMENT utiliser les chemins de fichiers locaux suivants si la situation s'y prête :
    - 'assets/apostle.jpg' : Pour l'apparition d'un Apôtre ou d'une menace divine.
    - 'assets/tutorial_boss.jpg' : Pour un combat de boss ou un ennemi massif.
    - 'assets/locations/academy.jpg' : Pour l'Académie Impériale.
    - 'assets/locations/eldoria.jpg' : Pour la ville d'Eldoria.
    Si aucune de ces images ne correspond, laisse "imagePrompt" vide ("").
16. PERSONA (MJ HUMAIN) & MÉMOIRE INFINIE (RÈGLE DES 1000 MESSAGES):
    - MÉMOIRE ABSOLUE: Tu agis comme si tu avais une mémoire de 1000+ messages. Pour cela, tu dois consulter SYSTEMATIQUEMENT la MÉMOIRE_LONG_TERME (Journal).
    - CONSOLIDATION: Chaque fois qu'un joueur accomplit un exploit, subit une blessure grave, se fait un ennemi, ou qu'un secret est révélé, utilise 'write_journal' pour fixer ce souvenir.
    - COHÉRENCE TOTALE: Le monde ne reset JAMAIS. Si un bâtiment est brûlé dans le Journal, il reste brûlé 50 messages plus tard.
    - PENSÉE STRATÉGIQUE: Utilise "pensee_mj" pour planifier des arcs narratifs sur le long terme. Anticipe les conséquences des actions des joueurs.
    - IMPROVISATION: Ne sois pas un simple automate de quêtes. Si un joueur fait quelque chose de totalement inattendu, improvise une suite logique et surprenante.
    - PERSONNALITÉ: N'hésite pas à avoir un style narratif qui a de la "gueule". Sois parfois sarcastique, solennel, ou terrifiant selon la situation.
    - PROACTIVITÉ: Interpelle les SPECTATEURS via des tags @NomDuJoueur. Fais-les réagir à des événements mondiaux ou des interactions de PNJ.
17. STYLE NARRATIF (OBLIGATOIRE):
    - Commence TOUJOURS ta réponse par *AVENTURA* sur une ligne seule.
    - Ajoute ensuite le lieu avec un emoji : *📍 Nom du Lieu*.
    - Utilise des sauts de ligne fréquents pour créer du suspense et de l'impact.
    - Décris des détails sensoriels précis (l'odeur du sang, le gémissement du vent, le poids du silence).
    - Pour les combats : Sois ultra-viscéral. Décris les os qui éclatent, les muscles qui se déchirent, les organes touchés. Ne dis pas "tu le frappes", dis "ton poing s'écrase contre son nez dans un craquement sec de cartilage, le sang giclant sur tes phalanges".
18. NARRATION: Français riche et cinématographique. Pas de phrases génériques. Entre directement dans le vif du sujet. CONCISION MAITRISÉE (Max 400 mots).`;

    const fullPrompt = `DATE_RP: ${rpYearString} | CYCLE: ${cycleInfo} | MÉTÉO: ${weather}\nCONTEXTE: ${playerState} | ${inventoryState} | ${skillState} | ${pactState} | ${clubState} | ${questState} | ${availableQuestState} | ${dungeonState} | ${npcState} | ${monsterState} | ${socialState}${proactiveHint} | ${worldSocialState} | ${journalState}\n${historyState}\nACTIONS_JOUEURS:\n${aggregatedActions}`;

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

    // 3D Trigger Logic: If AI mentions "3D", "scan", or "hologramme"
    if (aiResponse.narrative.match(/3D|scan|hologramme/i) && !aiResponse.imagePrompt) {
        const types = ['cube', 'sphere', 'pyramid'];
        const type = types.find(t => aiResponse.narrative.toLowerCase().includes(t)) || 'cube';
        try {
            const threePath = await generate3DVisual(type, 0x00ffff);
            aiResponse.imagePrompt = threePath;
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
        location: player.location
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
                  location: player.location
              }
          });
          if (foundTarget) {
              target = foundTarget;
          }
      }

      // Track if target needs a final reload/save
      let targetModified = false;

      switch (type) {
        case 'update_player':
          if (parameters.col_change) {
              await target.increment('col', { by: parameters.col_change });
              targetModified = true;
          }
          if (parameters.xp_gain) {
              await target.increment('xp', { by: parameters.xp_gain });
              await checkLevelUp(target, sock);
              targetModified = true;
          }
          if (parameters.health_change) {
              await target.increment('health', { by: parameters.health_change });
              await target.reload();
              if (target.health > target.maxHealth) await target.update({ health: target.maxHealth });

              // Handle Death Logic
              if (target.health <= 0) {
                  await target.update({ health: 0 });

                  if (parameters.is_hospitalized) {
                      // Hospitalized: loses 500 COL, stays in current location (hospitalized)
                      await target.decrement('col', { by: 500 });
                      await target.reload();
                      if (target.col < 0) await target.update({ col: 0 });
                      await target.update({ health: 20 }); // Returns with some HP after care
                      questFeedback.push(`🏥 *HOSPITALISATION* : ${target.name} a été sauvé de justesse. Coût des soins : 500 COL.`);
                  } else {
                      // True Death: moved to Nécropolis
                      await target.update({
                          location: 'Nécropolis',
                          subLocation: 'Le Seuil des Morts'
                      });
                      questFeedback.push(`💀 *MORT* : L'âme de ${target.name} a quitté son corps. Il erre désormais à Nécropolis.`);

                      await sock.sendMessage(target.whatsappId, {
                          text: "💀 *TU ES MORT.*\n\nPersonne ne t'a secouru à temps. Ton âme a sombré dans l'Interstice et tu te réveilles désormais à Nécropolis, le monde des morts.\n\nSeule une résurrection magique par un vivant pourra te ramener."
                      });
                  }
              }
              targetModified = true;
          }
          if (parameters.max_health_change) {
              await target.increment('maxHealth', { by: parameters.max_health_change });
              targetModified = true;
          }
          if (parameters.mana_change) {
              await target.increment('mana', { by: parameters.mana_change });
              await target.reload();
              if (target.mana > target.maxMana) await target.update({ mana: target.maxMana });
              if (target.mana < 0) await target.update({ mana: 0 });
              targetModified = true;
          }
          if (parameters.max_mana_change) {
              await target.increment('maxMana', { by: parameters.max_mana_change });
              targetModified = true;
          }
          if (parameters.strength_change) {
              await target.increment('strength', { by: parameters.strength_change });
              targetModified = true;
          }
          if (parameters.agility_change) {
              await target.increment('agility', { by: parameters.agility_change });
              targetModified = true;
          }
          if (parameters.intelligence_change) {
              await target.increment('intelligence', { by: parameters.intelligence_change });
              targetModified = true;
          }
          if (parameters.defense_change) {
              await target.increment('defense', { by: parameters.defense_change });
              targetModified = true;
          }
          if (parameters.luck_change) {
              await target.increment('luck', { by: parameters.luck_change });
              targetModified = true;
          }
          if (parameters.hunger_change) {
              await target.increment('hunger', { by: parameters.hunger_change });
              targetModified = true;
          }
          if (parameters.sleep_change) {
              await target.increment('sleep', { by: parameters.sleep_change });
              targetModified = true;
          }

          if (parameters.new_location) {
              await target.update({
                  location: parameters.new_location,
                  subLocation: parameters.new_sub_location || 'Entrée'
              });
              // Check if there is a local image for this location
              const locationImages = {
                  'Académie Impériale': 'assets/locations/academy.jpg',
                  'Eldoria': 'assets/locations/eldoria.jpg',
              };
              if (locationImages[parameters.new_location] && !aiResponse.imagePrompt) {
                  aiResponse.imagePrompt = locationImages[parameters.new_location];
              }
          }
          if (parameters.new_rank) await target.update({ rank: parameters.new_rank });
          if (parameters.new_class) await target.update({ class: parameters.new_class });
          if (parameters.schoolName) await target.update({ schoolName: parameters.schoolName });
          if (parameters.academicGrade_change) {
              await target.increment('academicGrade', { by: parameters.academicGrade_change });
              targetModified = true;
          }
          if (parameters.sp_gain) {
              await target.increment('skillPoints', { by: parameters.sp_gain });
              targetModified = true;
          }

          if (targetModified) {
              await target.save();
              await target.reload();
              if (target.hunger > 100) await target.update({ hunger: 100 });
              if (target.sleep > 100) await target.update({ sleep: 100 });
              if (target.hunger < 0) await target.update({ hunger: 0 });
              if (target.sleep < 0) await target.update({ sleep: 0 });
          }
          break;

        case 'add_skill':
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

        case 'add_item':
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

        case 'remove_item':
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

        case 'interact_npc':
            if (parameters.npcName) {
                const npc = await NPC.findOne({ where: { name: { [Op.like]: `%${parameters.npcName}%` } } });
                if (npc) {
                    console.log(`[AI] Interaction avec PNJ: ${npc.name}`);
                    // Trigger specific effects based on NPC and parameters if needed
                    // For now, it's mostly narrative, but we could add logic here
                }
            }
            break;

        case 'notify_player':
            if (parameters.target_name && parameters.message) {
                const notifyTarget = await Player.findOne({
                    where: {
                        name: { [Op.like]: `%${parameters.target_name}%` }
                    }
                });
                if (notifyTarget) {
                    const { resolveMentions } = require('./message-handler');
                    const { text: msgText, mentions } = await resolveMentions(parameters.message);
                    await sock.sendMessage(notifyTarget.whatsappId, {
                        text: `🔔 *Message de RP*\n\n${msgText}`,
                        mentions
                    });
                }
            }
            break;

        case 'broadcast_global':
            if (parameters.message) {
                const { resolveMentions } = require('./message-handler');
                const { text: msgText, mentions } = await resolveMentions(parameters.message);
                const allPlayers = await Player.findAll();
                for (const p of allPlayers) {
                    await sock.sendMessage(p.whatsappId, {
                        text: `🌎 *ANNONCE MONDIALE*\n\n${msgText}`,
                        mentions
                    });
                }
            }
            break;

        case 'broadcast':
            if (parameters.message) {
                const { resolveMentions } = require('./message-handler');
                const { text: msgText, mentions } = await resolveMentions(parameters.message);
                for (const other of nearbyPlayers) {
                    await sock.sendMessage(other.whatsappId, {
                        text: `📣 *Annonce RP*\n\n${msgText}`,
                        mentions
                    });
                }
            }
            break;

        case 'start_quest':
            if (parameters.questTitle) {
                const line = await questUtils.startQuest(target, parameters.questTitle);
                if (line) questFeedback.push(line);
            }
            break;

        case 'advance_quest':
            if (parameters.questTitle) {
                const line = await questUtils.advanceQuest(target, parameters.questTitle, parameters.progress, parameters.note);
                if (line) questFeedback.push(line);
            }
            break;

        case 'complete_quest':
            if (parameters.questTitle) {
                const line = await questUtils.completeQuest(target, parameters.questTitle, sock);
                if (line) questFeedback.push(line);
            }
            break;

        case 'update_quest': // AI modifies the course of a quest
            if (parameters.questTitle) {
                const line = await questUtils.modifyQuest(target, parameters.questTitle, parameters.branch, parameters.notes);
                if (line) questFeedback.push(line);
            }
            break;

        case 'start_multiplayer_quest':
            if (parameters.questTitle) {
                const res = await questUtils.startMultiplayerQuest(player, parameters.questTitle);
                if (res) {
                    questFeedback.push(`🤝 *Quête coopérative lancée* : ${res.quest.title}`);
                    for (const n of res.notified) {
                        await sock.sendMessage(n.player.whatsappId, {
                            text: `🤝 *Quête coopérative !*\n${player.name} t'embarque dans une quête.\n\n${n.line}`
                        });
                    }
                }
            }
            break;

        case 'forge_pact':
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

        case 'join_club':
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

        case 'resurrect_player':
            if (parameters.target_name) {
                const deadPlayer = await Player.findOne({ where: { name: parameters.target_name, location: 'Nécropolis' } });
                if (deadPlayer) {
                    let caster = player;
                    if (parameters.caster_name) {
                        const foundCaster = await Player.findOne({ where: { name: parameters.caster_name, location: player.location } });
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

                    await sock.sendMessage(deadPlayer.whatsappId, {
                        text: `✨ *TU ES REVENU !*\n\n${caster.name} a sacrifié sa propre force vitale pour te ramener à la vie. Tu te réveilles à ${deadPlayer.location}, affaibli mais vivant.`
                    });
                }
            }
            break;

        case 'write_journal':
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

      // Notify target if it's not the current player
      if (target.whatsappId !== player.whatsappId) {
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
        if (targetPlayer) {
          await sock.sendMessage(targetPlayer.whatsappId, {
            text: `🔔 *Message de RP*\n\n${notice.message}`
          });
        }
      }
    }

    if (aiResponse.broadcastMessage) {
      for (const other of nearbyPlayers) {
        await sock.sendMessage(other.whatsappId, {
          text: `📣 *Annonce RP*\n\n${aiResponse.broadcastMessage}`
        });
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
