const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, Monster } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const senderJid = message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;

  const playerState = `
    - Nom: ${player.name} ${player.isGod ? '(DIEU SUPRÊME)' : ''}
    - Description: ${player.characterDescription}
    - Classe: ${player.class}
    - Points de Compétence (SP): ${player.skillPoints}
    - Rang: ${player.rank}
    - Niveau: ${player.level}
    - XP: ${player.xp}/${player.level * 100}
    - Vie: ${player.health}/${player.maxHealth}
    - Énergie/Endurance: ${player.mana}/${player.maxMana}
    - Dollars (Col): ${player.col}
    - Emplacement: ${player.location}
    - Statistiques: Force ${player.strength}, Agilité ${player.agility}, Intelligence ${player.intelligence}, Défense ${player.defense}, Chance ${player.luck}
  `;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0
    ? "Inventaire:\n" + inventory.map(i => `- ${i.name} (x${i.quantity})`).join('\n')
    : "Ton inventaire est vide.";

  const allQuests = await Quest.findAll();
  const playerQuests = await player.getQuests();

  const activeQuestNames = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress').map(q => q.title);
  const completedQuestNames = playerQuests.filter(q => q.PlayerQuest.status === 'completed').map(q => q.title);

  const questState = playerQuests.length > 0
    ? "Tes Quêtes:\n" + playerQuests.map(q => `- ${q.title} [${q.PlayerQuest.status}]`).join('\n')
    : "Tu n'as commencé aucune quête.";

  const availableQuests = allQuests.filter(q => !activeQuestNames.includes(q.title) && !completedQuestNames.includes(q.title));
  const availableQuestState = availableQuests.length > 0
    ? "Quêtes disponibles dans le monde:\n" + availableQuests.map(q => `- ${q.title}: ${q.description} (Requis: Rang ${q.rank_required})`).join('\n')
    : "Toutes les quêtes connues ont été commencées ou terminées.";

  const dungeons = await Dungeon.findAll();
  const dungeonState = "Territoires et Braquages:\n" + dungeons.map(d => `- ${d.name} (Difficulté ${d.rank})`).join('\n');

  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        whatsappId: { [Op.ne]: player.whatsappId }
    }
  });
  const socialState = nearbyPlayers.length > 0
    ? "Joueurs à proximité:\n" + nearbyPlayers.map(p => `- Nom: ${p.name}, Niveau: ${p.level}, Classe: ${p.class}, Vie: ${p.health}/${p.maxHealth}, Rang: ${p.rank}`).join('\n')
    : "Tu es seul ici.";

  // Limit shop items to a few featured ones to save tokens
  const items = await Item.findAll({
      where: {
          [Op.or]: [
              { price: { [Op.lte]: player.col + 300 } }, // Items the player can almost afford
              { name: ['Elucidator', 'Lambent Light'] } // Only 2 featured items
          ]
      },
      limit: 5
  });
  const shopState = "Boutique (Aperçu):\n" + items.map(i => `- ${i.name} (${i.price} $): ${i.description.substring(0, 50)}...`).join('\n');

  // Save current player message to memory before fetching history
  await RPMessage.create({
      senderJid: player.whatsappId,
      senderName: player.name,
      content: actionText,
      location: player.location
  });

  // Memory: Reduced to 5 messages to avoid token bloat
  const history = await RPMessage.findAll({
      where: { location: player.location },
      order: [['id', 'DESC']],
      limit: 5
  });
  const historyState = history.length > 0
    ? "Mémoire Récente:\n" + history.reverse().map(h => `[${h.senderName}]: ${h.content.substring(0, 100)}`).join('\n')
    : "";

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0
    ? "Compétences:\n" + playerSkills.map(s => `- ${s.name}: ${s.description.substring(0, 40)}...`).join('\n')
    : "Aucune compétence.";

  const kingdoms = await Kingdom.findAll({ limit: 3 }); // Reduced to 3
  const kingdomState = "Factions et Territoires:\n" + kingdoms.map(k => `- ${k.name} [Status: ${k.status}]`).join('\n');

  const conflicts = await Conflict.findAll({ where: { status: 'active' }, limit: 2 });
  const conflictState = "Guerres de Gangs:\n" + conflicts.map(c => `- ${c.title}`).join('\n');

  // Limit NPCs to current location or key global ones for prompt efficiency
  const npcs = await NPC.findAll({
      where: {
          [Op.or]: [
              { location: { [Op.like]: `%${player.location}%` } },
              { name: ['Directeur Magnus', 'Heathcliff', 'Asuna'] } // Reduced key NPCs
          ]
      },
      limit: 6
  });
  const npcState = "PNJ à proximité:\n" + npcs.map(n => `- ${n.name} (${n.role}): ${n.description.substring(0, 60)}...`).join('\n');

  // Limit monsters to those of similar rank to the player
  const currentRankIndex = ['F', 'E', 'D', 'C', 'B', 'A', 'S'].indexOf(player.rank);
  const monsters = await Monster.findAll({
      where: {
          rank: { [Op.in]: ['F', 'E', 'D', 'C', 'B', 'A', 'S'].slice(Math.max(0, currentRankIndex - 1), currentRankIndex + 2) }
      },
      limit: 5 // Increased limit
  });
  const monsterState = "Adversaires et Menaces:\n" + monsters.map(m => `- ${m.name} (Niveau ${m.rank}) [PV: ${m.health}, FOR: ${m.strength}, DEF: ${m.defense}, AGI: ${m.agility}]`).join('\n');

  const schools = await School.findAll({ limit: 3 });
  const schoolState = "Centres de formation / Planques:\n" + schools.map(s => `- ${s.name} (${s.specialty}): ${s.description}`).join('\n');

  // Time Logic: 1 month real = 1 year RP
  // Reference date: Jan 1st 2024
  const startDate = new Date('2024-01-01').getTime();
  const now = Date.now();
  const elapsedMs = now - startDate;
  const elapsedMonths = elapsedMs / (1000 * 60 * 60 * 24 * 30);
  const rpYears = Math.floor(elapsedMonths);
  const rpMonth = Math.floor((elapsedMonths % 1) * 12) + 1;
  const rpYearString = `An ${rpYears + 1}, Mois ${rpMonth}`;

    // Mini-Event Trigger (20% chance)
    const triggerMiniEvent = Math.random() < 0.20;
    const miniEventContext = triggerMiniEvent
        ? "\n⚠️ **ÉVÉNEMENT IMPRÉVU**: Un événement aléatoire doit se produire maintenant ! (Ex: Un PNJ t'interpelle, un monstre surgit, une annonce impériale, un objet mystérieux trouvé, etc.)"
        : "";

  const systemPrompt = `
    Tu es le Maître du Jeu (MJ) de "Gheno City 2", un RPG textuel ultra-immersif typé GTA RP / Urban Modern. Ton style est direct, cru, et réaliste.
    **EXIGENCE LINGUISTIQUE (CRUCIAL)**: Tu dois écrire dans un FRANÇAIS TERRE À TERRE, urbain, direct et percutant. Évite le lyrisme, les métaphores pompeuses ou les phrases trop longues. L'utilisateur veut une immersion brute, de la rue. Bannis toute tournure de phrase "IA" (ex: "En tant qu'IA...", "Voici le résultat..."). Ta seule et unique fonction est de retourner un objet JSON valide.

    **LOGIQUE & HISTOIRE**:
    - La narration doit suivre une LOGIQUE implacable de monde ouvert urbain. Pas de miracles. Chaque événement est la conséquence directe d'une action ou du contexte (police, gangs, argent).
    - Respecte scrupuleusement l'histoire de Gheno City (Guerres de gangs, corruption policière, trafic de drogue et d'armes).

    **ATMOSPHÈRE SOMBRE & RÉALISME URBAIN**:
    - Le monde est dangereux, impitoyable et moderne.
    - **INTERACTIONS**: Les PNJ sont des membres de gangs, des flics corrompus, des civils ou des contacts. Ils parlent avec un langage de rue si approprié.

    LORE DE GHENO CITY 2:
    - Esthétique: Ville moderne, néons, gratte-ciels, quartiers malfamés, voitures de sport, technologie de pointe (le "Gheno Phone" servant d'interface).
    - Divinité: Le SEUL ET UNIQUE DIEU (Administrateur) de ce monde est **EOZA**. S'il interagit, il a les PLEINS POUVOIRS sur la matrice de la ville.
    - Structure Sociale: La ville est divisée entre plusieurs factions (Cartel de Medellin, Mafia Italienne, Gangs de rue, LSPD).
    - Intrigue: Une nouvelle drogue circule, la tension entre les familles monte, et la police perd le contrôle.
    - STRUCTURE: Développe l'histoire par "Missions" et "Braquages". Introduit des trahisons, des courses-poursuites et des fusillades.
    - Ville: Gheno City. Quartiers: Downtown, Little Sicily, Industrial Zone, Vinewood.

    LOGIQUE TEMPORELLE & GÉOPOLITIQUE:
    - Date actuelle en RP: ${rpYearString}.
    - Échelle: 1 mois réel = 1 an RP. Les saisons passent, les pouvoirs changent.
    - **CYCLE URBAIN**: Des événements comme des guerres de territoires, des raids de police ou des marchés noirs apparaissent périodiquement.
    - **INTERDICTION DE TIME-SKIP**: Il est strictement INTERDIT de faire des sauts dans le temps narratifs. Tout doit être vécu en temps réel.

    RÈGLES FONDAMENTALES:
    0.  **Liberté Totale & Conséquences (STRICT)**: Le joueur est TOTALEMENT LIBRE de ses actions. Ne bloque JAMAIS une intention. Cependant, chaque action a des conséquences réalistes et souvent impitoyables. Si un joueur de Rang F tente d'entrer dans un donjon Rang S, laisse-le entrer, mais décris sa mort imminente ou son arrestation violente par la garde. Adapte la narration à toute folie ou créativité du joueur.
    1.  **Omniscience & Présence des PNJ**: Tu es le créateur. Intègre des éléments de films de gangsters et de jeux comme GTA. Les PNJ (Personnages Non-Joueurs) doivent être TRÈS PRÉSENTS. Fais-les parler, interagir, et réagir aux actions du joueur. S'il y a un PNJ important à proximité, il DOIT intervenir dans la narration.
    2.  **Censure Interdite & Ton Mature**: Ton sombre, réaliste, viscéral. La rue est impitoyable.
    3.  **Difficulté "Hardcore"**: Les succès sont rares. Une mauvaise décision peut mener à l'hôpital ou à la morgue.
    4.  **Impact des Statistiques & Létalité (CRUCIAL)**:
        - **PHILOSOPHIE**: Laisse le joueur décrire ses actions. Ton rôle est d'arbitrer le résultat selon ses statistiques précises et celles de l'adversaire.
        - **VÉRIFICATION DES STATS**: Avant chaque action de combat, COMPARE la Force, l'Agilité et la Défense du joueur avec celles de l'ennemi.
        - **LÉTALITÉ EXTRÊME**: Le monde est dangereux. Si un joueur rate son esquive, manque de vitesse (Agilité) ou de puissance, l'ennemi peut le blesser gravement (balle dans l'épaule, passage à tabac). Pas de pitié.
        - **LOGIQUE**: Si les stats sont insuffisantes, l'action échoue violemment.
        - **RÈGLES DE COMBAT (STRICTES)**:
            * **Dégâts infligés** = (Force du Joueur * 2) - (Défense de l'Ennemi).
            * **Dégâts reçus** = (Force de l'Ennemi * 2) - (Défense du Joueur).
            * **Esquive** = Impossible si l'Agilité du joueur < (Agilité de l'Ennemi / 1.5).
            * **Succès Critique** = Si Chance > 20, 10% de chance de doubler les dégâts.
        - **COMBAT RÉALISTE**: Décris les impacts de balles, le sang sur l'asphalte, le souffle court. Pas de magie, juste de la violence brute et efficace.
        - Utilise explicitement les chiffres dans la narration (ex: "Tu encaisses 50 dégâts, une balle t'a traversé la jambe !").
    5.  **Compétences & Progression (STRICT)**:
        - **UTILISATION DES CAPACITÉS**: Un joueur ne peut utiliser QUE les compétences listées dans sa section "Compétences" (ex: Hacking, Tir de précision, Conduite). S'il tente une action technique qu'il ne maîtrise pas, il échoue lamentablement (arme qui s'enraye, crash de voiture, alarme qui se déclenche).
        - **SP**: 1 SP = +1 stat (Force, Agilité, etc.).
    6.  **Interactions Sociales**: Si des joueurs sont à proximité, encourage les alliances, les échanges ou les affrontements. Tu DOIS les identifier par leur nom.
    7.  **Ciblage & Arbitrage PvP (CRUCIAL)**:
        - Tu peux appliquer des actions à d'autres joueurs présents en ajoutant "target_name" dans les paramètres JSON.
        - **ARBITRAGE PvP**: Dans un combat entre joueurs (A contre B), tu n'es qu'un ARBITRE.
        - Tu DOIS nommer et TAguer l'adversaire (ex: "@NomAdversaire") dans ta narration.
        - Informe-le qu'il a **5 minutes** pour répondre avant que tu ne donnes ton verdict basé sur les statistiques.
        - Ne décide pas du vainqueur immédiatement si l'adversaire n'a pas encore eu l'occasion de réagir.
    8.  **Vérification des Noms**: Utilise uniquement les noms fournis dans la section "Joueurs à proximité". Si le joueur mentionne un nom qui n'est pas là, il s'adresse à un PNJ ou hallucine.
    9.  **Format JSON Impératif**: Réponse JSON uniquement. Ta réponse DOIT commencer par '{' et se terminer par '}'.
    10. **Mini-Events & Imprévus**: N'hésite pas à déclencher de petits événements narratifs (rencontres fortuites, changements météo magiques, rumeurs entendues) pour rendre le monde vivant.

    FORMAT DE LA NARRATION (TERRE À TERRE):
    - Narration DIRECTE, BRUTE et EFFICACE.
    - **LANGUE**: Français simple, vocabulaire du quotidien, phrases courtes. Pas de jargon poétique.
    - **TON**: Sérieux, menaçant. Le danger doit se ressentir dans chaque mot.
    - **STYLE DE COMBAT (MANGA/ANIME)**: Les combats doivent être VIVANTS et CINÉMATIQUES.
        * Décris des ENCHAÎNEMENTS de coups rapides (combos).
        * Utilise des onomatopées ou des descriptions de sons explosifs (BOOM, SHING, CRACK).
        * Décris les impacts qui soulèvent la poussière, brisent le sol ou créent des ondes de choc.
        * Mets l'accent sur la vitesse, les reflets sur les lames et les mouvements "Sakuga".
        * Exemple: "Il lance une série de trois entailles rapides avant de pivoter pour un coup de pied circulaire dévastateur qui projette l'ennemi contre un mur."
    - **DESCRIPTION**: Concentre-toi sur les sensations physiques (douleur, froid, odeur de sang, poids de l'arme) ET sur l'intensité visuelle du combat.
    - IMMERSION: Le "Gheno Phone" est un outil technologique, décris son interface froide.
    - Utilise des en-têtes simples.
    - Description des mouvements: Précis, sans exagération héroïque injustifiée.
    - Exemple:
      --- ⚔️ SHING! COMBAT ---
      [Action explosive]
      --- 📝 RÉSULTAT ---
      [Conséquences viscérales]
    - Garde un style "Phone/Card" propre mais avec un flair anime intense.

    DIRECTIVES D'IMAGES (imagePrompt):
    - Pour chaque action significative, fournis un "imagePrompt" descriptif.
    - Style: "Photorealistic, GTA V style art, cinematic lighting, urban environment, high detail, 8k".
    - Exemple: "GTA V loading screen style art, a modified sports car speeding through a neon-lit city street at night, cinematic motion blur".

    TYPES D'ACTIONS (JSON):
    Ta réponse doit être un objet JSON contenant un tableau "actions". Chaque élément du tableau est un objet avec une clé "type" et "parameters".
    Exemple: {"narrative": "...", "actions": [{"type": "update_player", "parameters": {...}}, {"type": "add_item", "parameters": {...}}]}

    - "type": "update_player", "parameters": {"target_name": "nom_optionnel", "col_change": montant, "xp_gain": montant, "health_change": montant, "max_health_change": montant, "mana_change": montant, "max_mana_change": montant, "new_location": "nom_lieu", "new_rank": "F/E/D/C/B/A/S", "strength_change": montant, "agility_change": montant, "intelligence_change": montant, "defense_change": montant, "luck_change": montant, "schoolName": "nom_ecole", "academicGrade_change": montant, "sp_gain": montant, "monster_damage": montant, "monster_name": "nom_du_monstre"}
    - "type": "add_skill", "parameters": {"target_name": "nom_optionnel", "skillName": "nom_de_la_competence"}
    - "type": "add_item", "parameters": {"target_name": "nom_optionnel", "itemName": "nom_de_l_objet", "quantity": nombre}
    - "type": "remove_item", "parameters": {"target_name": "nom_optionnel", "itemName": "nom_de_l_objet", "quantity": nombre}
    - "type": "interact_npc", "parameters": {"npcName": "nom_du_pnj", "dialogue": "phrase_courte"}
    - "type": "start_driving", "parameters": {"vehicleName": "nom_du_vehicule"}
  `;

    const fullPrompt = `CONTEXTE:\n${playerState}\n${inventoryState}\n${skillState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${socialState}\n${shopState}\n${kingdomState}\n${conflictState}\n${schoolState}\n${npcState}\n${monsterState}${miniEventContext}\n\n${historyState}\n\nACTION ACTUELLE DU JOUEUR: ${actionText}`;

  try {
    let content = await callAI(systemPrompt, fullPrompt);
    if (!content) {
        throw new Error("L'IA a retourné une réponse vide.");
    }
    console.log(`[AI RAW] Contenu reçu: ${content.substring(0, 500)}...`);

    // Robust JSON extraction
    let aiResponse = { narrative: "", actions: [] };
    let jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
        try {
            aiResponse = JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error("[AI ERROR] JSON Parse failed, extracting narrative only.");
            aiResponse.narrative = content.replace(/\{[\s\S]*\}/, '').trim();
        }
    } else {
        console.warn("[AI WARNING] No JSON found, using raw content as narrative.");
        aiResponse.narrative = content.trim();
    }

    // Fallback if narrative is still empty
    if (!aiResponse.narrative || aiResponse.narrative.length < 5) {
        aiResponse.narrative = content.substring(0, 500).replace(/\{[\s\S]*/, '').trim() || "La connexion au Gheno Network est instable...";
    }

    console.log("[AI PARSED] Actions détectées:", aiResponse.actions?.length || 0);
    const actions = aiResponse.actions || [];

    if (!aiResponse.narrative) {
        aiResponse.narrative = "Il ne se passe rien de spécial.";
    }

    // Save bot response to memory
    await RPMessage.create({
        senderJid: 'bot',
        senderName: 'Gheno MJ',
        content: aiResponse.narrative,
        location: player.location
    });

    // Process AI actions
    for (const actionObj of actions) {
      const { type, parameters } = actionObj;
      if (!parameters) continue;

      let target = player;
      if (parameters.target_name) {
          const foundTarget = await Player.findOne({
              where: {
                  name: parameters.target_name,
                  location: player.location // Only target players at same location
              }
          });
          if (foundTarget) {
              target = foundTarget;
          } else {
              console.log(`[AI] Target not found or not at location: ${parameters.target_name}`);
          }
      }

      switch (type) {
        case 'update_player':
          if (parameters.monster_name && parameters.monster_damage) {
              const monster = await Monster.findOne({ where: { name: parameters.monster_name } });
              if (monster) {
                  console.log(`[COMBAT] ${monster.name} subit ${parameters.monster_damage} dégâts.`);
                  // Here we could track monster HP in a session or temp table if needed,
                  // but for now we follow the AI's narrative verdict.
                  if (parameters.monster_damage >= monster.health) {
                      console.log(`[COMBAT] ${monster.name} est vaincu !`);
                  }
              }
          }
          if (parameters.col_change) await target.increment('col', { by: parameters.col_change });
          if (parameters.xp_gain) {
              await target.increment('xp', { by: parameters.xp_gain });
              // Reload target to check XP
              await target.reload();
              const xpNeeded = target.level * 100;
              if (target.xp >= xpNeeded) {
                  const levelsGained = Math.floor(target.xp / xpNeeded);
                  await target.increment('level', { by: levelsGained });
                  await target.update({
                      xp: target.xp % xpNeeded,
                      maxHealth: target.maxHealth + (levelsGained * 15), // Reduced from 20 for balance
                      maxMana: target.maxMana + (levelsGained * 8), // Reduced from 10
                      health: target.maxHealth + (levelsGained * 15),
                      mana: target.maxMana + (levelsGained * 8),
                      // Automatic small stat increase on level up
                      strength: target.strength + (levelsGained * 1),
                      agility: target.agility + (levelsGained * 1),
                      intelligence: target.intelligence + (levelsGained * 1)
                  });
                  await sock.sendMessage(target.whatsappId, {
                      text: `✨ *LEVEL UP !* ✨\nTu es maintenant niveau ${target.level} !\nTes points de vie et ton énergie ont augmenté.`
                  });
              }
          }
          if (parameters.health_change) {
              await target.increment('health', { by: parameters.health_change });
              await target.reload();
              if (target.health > target.maxHealth) await target.update({ health: target.maxHealth });
              if (target.health < 0) await target.update({ health: 0 });
          }
          if (parameters.max_health_change) await target.increment('maxHealth', { by: parameters.max_health_change });
          if (parameters.mana_change) {
              await target.increment('mana', { by: parameters.mana_change });
              await target.reload();
              if (target.mana > target.maxMana) await target.update({ mana: target.maxMana });
              if (target.mana < 0) await target.update({ mana: 0 });
          }
          if (parameters.max_mana_change) await target.increment('maxMana', { by: parameters.max_mana_change });
          if (parameters.strength_change) await target.increment('strength', { by: parameters.strength_change });
          if (parameters.agility_change) await target.increment('agility', { by: parameters.agility_change });
          if (parameters.intelligence_change) await target.increment('intelligence', { by: parameters.intelligence_change });
          if (parameters.defense_change) await target.increment('defense', { by: parameters.defense_change });
          if (parameters.luck_change) await target.increment('luck', { by: parameters.luck_change });
          if (parameters.new_location) await target.update({ location: parameters.new_location });
          if (parameters.new_rank) await target.update({ rank: parameters.new_rank });
          if (parameters.schoolName) await target.update({ schoolName: parameters.schoolName });
          if (parameters.academicGrade_change) await target.increment('academicGrade', { by: parameters.academicGrade_change });
          if (parameters.sp_gain) await target.increment('skillPoints', { by: parameters.sp_gain });
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
                for (const [stat, value] of Object.entries(bonuses)) {
                    if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                        await target.increment(stat, { by: value * parameters.quantity });
                    }
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
                    }
                }
            }
            break;

        case 'start_driving':
            if (parameters.vehicleName) {
                const { startDriving } = require('./driving-handler');
                // Create a temporary vehicle object if the player doesn't have one in DB yet
                // Or look for it in their inventory/vehicles.
                // For simplicity, let's assume the AI can grant a temporary vehicle for a chase
                const tempVehicle = {
                    Vehicle: {
                        name: parameters.vehicleName,
                        topSpeed: 200,
                        acceleration: 15,
                        brakePower: 20
                    },
                    damage: 0
                };
                await target.update({ mode: 'driving' });
                startDriving(sock, message, target, tempVehicle);
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
      }

      // Notify target if it's not the current player
      if (target.whatsappId !== player.whatsappId) {
          await sock.sendMessage(target.whatsappId, {
              text: `🔔 *NOTIFICATION RP*\n\n${player.name} a interagi avec toi !\n\n${aiResponse.narrative}`
          });
      }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
