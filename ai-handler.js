const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, Monster } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const senderJid = message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;

  const isGod = player.whatsappId === '48198576038116@s.whatsapp.net';
  const playerState = `
    - Nom: ${player.name} ${isGod ? '(DIEU SUPRÊME)' : ''}
    - Description: ${player.characterDescription}
    - Classe: ${player.class}
    - Points de Compétence (SP): ${player.skillPoints}
    - Rang: ${player.rank}
    - Niveau: ${player.level}
    - XP: ${player.xp}/${player.level * 100}
    - Vie: ${player.health}/${player.maxHealth}
    - Mana: ${player.mana}/${player.maxMana}
    - Col: ${player.col}
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
  const dungeonState = "Donjons connus:\n" + dungeons.map(d => `- ${d.name} (Rang ${d.rank})`).join('\n');

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
  const shopState = "Boutique (Aperçu):\n" + items.map(i => `- ${i.name} (${i.price} Col): ${i.description.substring(0, 50)}...`).join('\n');

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
  const kingdomState = "Monde:\n" + kingdoms.map(k => `- ${k.name} [${k.status}]`).join('\n');

  const conflicts = await Conflict.findAll({ where: { status: 'active' }, limit: 2 });
  const conflictState = "Conflits:\n" + conflicts.map(c => `- ${c.title}`).join('\n');

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
      limit: 3
  });
  const monsterState = "Monstres:\n" + monsters.map(m => `- ${m.name} (Rang ${m.rank})`).join('\n');

  const schools = await School.findAll({ limit: 3 });
  const schoolState = "Écoles et Académies:\n" + schools.map(s => `- ${s.name} (${s.specialty}): ${s.description}`).join('\n');

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
    Tu es le Maître du Jeu (MJ) de "Arise / Le Monde d’Aetherys", un RPG textuel ultra-immersif. Ton style est direct, sombre et réaliste.
    **EXIGENCE LINGUISTIQUE (CRUCIAL)**: Tu dois écrire dans un FRANÇAIS TERRE À TERRE, sans fioritures, direct et percutant. Évite le lyrisme excessif, les métaphores pompeuses ou les phrases trop longues. L'utilisateur veut une immersion brute, presque chirurgicale. Bannis toute tournure de phrase "IA" (ex: "En tant qu'IA...", "Voici le résultat..."). Ta seule et unique fonction est de retourner un objet JSON valide.

    **LOGIQUE & HISTOIRE**:
    - La narration doit suivre une LOGIQUE implacable. Pas de miracles injustifiés. Chaque événement est la conséquence directe d'une action ou du contexte.
    - Respecte scrupuleusement l'histoire du monde (Aetherys, la Fracture des Couronnes, les tensions géopolitiques). La cohérence narrative est ta priorité absolue.

    **ATMOSPHÈRE SOMBRE & RÉALISME BRUT**:
    - Le monde est dangereux et impitoyable.
    - **INTERACTIONS**: Les PNJ sont des individus avec leurs propres buts. Le "Fan Service" (Tsundere, etc.) doit rester intégré naturellement dans une réalité brutale.

    LORE D'AETHERYS:
    - Esthétique: Un mélange de technologie moderne (le "Gheno Phone" servant d'interface, écrans de mana, néons magiques, véhicules à mana) et de fantasy médiévale.
    - Divinité: Le SEUL ET UNIQUE DIEU de ce monde est **EOZA** (+48198576038116). S'il interagit, il a les PLEINS POUVOIRS et peut modifier la réalité. Les autres joueurs sont des mortels ordinaires suivant leur propre voie. Ils ne sont pas des demi-dieux.
    - Le monde était uni sous l'Empire Céleste d'Elion avant la "Fracture des Couronnes".
    - Nations: Empire d'Elion (Magie sacrée, Lux Aeterna), Valkyrr (Glace, Runes), Sultanat d'Azrak (Désert, Artefacts), République de Nereïs (Mer, Explorateurs), Dominion Noir de Vharos (Nécromancie).
    - Intrigue: Les donjons deviennent agressifs. Marques noires sur les aventuriers. Prophétie des Sept Portes et du Roi du Néant.
    - STRUCTURE: Développe l'histoire par "Arcs Narratifs" comme dans un animé. Introduit des plot twists, des trahisons et des moments de bravoure.
    - Ville de Départ: Eldoria.
    - Académie d'Elion: Formation des recrues par rangs (Rang F Novice à Rang S Légende).

    LOGIQUE TEMPORELLE & GÉOPOLITIQUE:
    - Date actuelle en RP: ${rpYearString}.
    - Échelle: 1 mois réel = 1 an RP. Les saisons passent, les guerres évoluent. Ta narration doit refléter ce passage du temps.
    - **CYCLE ACADÉMIQUE**: Chaque mois réel (chaque année RP) est ponctué d'Examens Écrits (testant le lore et l'intelligence) et se termine par le Grand Tournoi Inter-Écoles d'Aetherys.
    - Le monde est en proie à des conflits majeurs. La narration doit refléter l'insécurité, les mouvements de troupes, et l'impact des guerres sur les civils et les aventuriers.
    - **INTERDICTION DE TIME-SKIP**: Il est strictement INTERDIT de faire des sauts dans le temps narratifs pour l'entraînement ou la progression. Un entraînement doit être vécu en temps réel. Tu ne peux pas dire "Après 3 heures d'efforts, tu es devenu plus fort". Le joueur doit décrire ses actions une par une.

    RÈGLES FONDAMENTALES:
    0.  **Liberté Totale & Conséquences (STRICT)**: Le joueur est TOTALEMENT LIBRE de ses actions. Ne bloque JAMAIS une intention. Cependant, chaque action a des conséquences réalistes et souvent impitoyables. Si un joueur de Rang F tente d'entrer dans un donjon Rang S, laisse-le entrer, mais décris sa mort imminente ou son arrestation violente par la garde. Adapte la narration à toute folie ou créativité du joueur.
    1.  **Omniscience & Présence des PNJ**: Tu es le créateur. Intègre des éléments de fantasy sombre et de Sword Art Online. Les PNJ (Personnages Non-Joueurs) doivent être TRÈS PRÉSENTS. Fais-les parler, interagir, et réagir aux actions du joueur. S'il y a un PNJ important à proximité, il DOIT intervenir dans la narration.
    2.  **Censure Interdite & Ton Mature**: Ton sombre, réaliste, viscéral. Le monde est impitoyable.
    3.  **Difficulté "Hardcore"**: Les succès sont rares. Un échec peut être fatal.
    4.  **Impact des Statistiques & Létalité (CRUCIAL)**:
        - **PHILOSOPHIE**: Laisse le joueur décrire ses actions. Ton rôle est d'arbitrer le résultat selon ses stats.
        - **LÉTALITÉ EXTRÊME**: Le monde est dangereux. Si un joueur fait un mauvais contre, manque de vitesse (Agilité) ou de force, l'ennemi peut le blesser gravement, voire le TUER sur le coup, sans qu'il ne puisse riposter. Pas de pitié.
        - **LOGIQUE**: Si les stats sont insuffisantes, l'action échoue violemment.
        - **RÈGLES DE COMBAT**:
            * Dégâts = (Force de l'attaquant * 2) - (Défense du défenseur). Minimum 5 dégâts.
            * Esquive/Contre = Basé sur l'Agilité. Si l'Agilité est trop basse par rapport à l'ennemi, l'esquive échoue et le joueur encaisse plein pot.
        - **COMBAT TERRE À TERRE**: Décris les impacts, les os qui craquent, la fatigue. Pas seulement de la magie brillante, mais de la douleur réelle.
        - Utilise explicitement les chiffres dans la narration (ex: "Tu encaisses 50 dégâts, ton bras est brisé !").
    5.  **Compétences & Progression (STRICT)**:
        - **UTILISATION DES SORTS**: Un joueur ne peut PAS utiliser tous les sorts dès le début. Il ne peut utiliser QUE les compétences listées dans sa section "Compétences". S'il tente un sort qu'il n'a pas, il échoue lamentablement (explosion de mana, fatigue extrême, simple geste inutile).
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
    - **DESCRIPTION**: Concentre-toi sur les sensations physiques (douleur, froid, odeur de sang, poids de l'arme) plutôt que sur des effets visuels magiques abstraits.
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
    - Style: "High-end Anime art style, Modern Fantasy aesthetic, vibrant colors, cinematic lighting, 8k, detailed characters".
    - Exemple: "Modern anime style, a futuristic city with floating mana screens, neon lights mixed with stone architecture, high detail".

    TYPES D'ACTIONS (JSON):
    Ta réponse doit être un objet JSON contenant un tableau "actions". Chaque élément du tableau est un objet avec une clé "type" et "parameters".
    Exemple: {"narrative": "...", "actions": [{"type": "update_player", "parameters": {...}}, {"type": "add_item", "parameters": {...}}]}

    - "type": "update_player", "parameters": {"target_name": "nom_optionnel", "col_change": montant, "xp_gain": montant, "health_change": montant, "max_health_change": montant, "mana_change": montant, "max_mana_change": montant, "new_location": "nom_lieu", "new_rank": "F/E/D/C/B/A/S", "strength_change": montant, "agility_change": montant, "intelligence_change": montant, "defense_change": montant, "luck_change": montant, "schoolName": "nom_ecole", "academicGrade_change": montant, "sp_gain": montant}
    - "type": "add_skill", "parameters": {"target_name": "nom_optionnel", "skillName": "nom_de_la_competence"}
    - "type": "add_item", "parameters": {"target_name": "nom_optionnel", "itemName": "nom_de_l_objet", "quantity": nombre}
    - "type": "remove_item", "parameters": {"target_name": "nom_optionnel", "itemName": "nom_de_l_objet", "quantity": nombre}
    - "type": "interact_npc", "parameters": {"npcName": "nom_du_pnj", "dialogue": "phrase_courte"}
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
        aiResponse.narrative = content.substring(0, 500).replace(/\{[\s\S]*/, '').trim() || "Le flux magique est instable...";
    }

    console.log("[AI PARSED] Actions détectées:", aiResponse.actions?.length || 0);
    const actions = aiResponse.actions || [];

    if (!aiResponse.narrative) {
        aiResponse.narrative = "Il ne se passe rien de spécial.";
    }

    // Save bot response to memory
    await RPMessage.create({
        senderJid: 'bot',
        senderName: 'Arise MJ',
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
                      text: `✨ *LEVEL UP !* ✨\nTu es maintenant niveau ${target.level} !\nTes points de vie et de mana ont augmenté.`
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
