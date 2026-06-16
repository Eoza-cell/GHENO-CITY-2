const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, Monster } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');
const questUtils = require('./quest-utils');
const { checkLevelUp } = require('./level-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const senderJid = message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;

  const playerState = `
    - Nom: ${player.name} ${player.isGod ? '(DIEU SUPRÊME)' : ''}
    - Métier: ${player.occupation}
    - Organisation: ${player.organization}
    - Influence Sociale: ${player.influence}
    - Description: ${player.characterDescription}
    - Famille: ${player.family}
    - Classe: ${player.class} (${player.derivative})
    - Points de Compétence (SP): ${player.skillPoints}
    - Rang: ${player.rank}
    - Niveau: ${player.level}
    - XP: ${player.xp}/${player.level * 100}
    - Vie: ${player.health}/${player.maxHealth}
    - Mana: ${player.mana}/${player.maxMana}
    - Col: ${player.col}
    - Emplacement: ${player.location}
    - STATS: Force:${player.strength} Agilité:${player.agility} Intelligence:${player.intelligence} Défense:${player.defense} Chance:${player.luck}
  `;

  const inventory = player.inventory || [];
  const inventoryState = inventory.length > 0
    ? "Inventaire:\n" + inventory.map(i => `- ${i.name} (x${i.quantity})`).join('\n')
    : "Ton inventaire est vide.";

  const playerQuests = await player.getQuests();
  const activeQuests = playerQuests.filter(q => q.PlayerQuest.status === 'in_progress');

  const questState = activeQuests.length > 0
    ? "Quêtes Actives:\n" + activeQuests.map(q => {
        const pq = q.PlayerQuest;
        const chainInfo = q.chain ? ` [${q.chain} • étape ${q.step}]` : '';
        const prog = ` (${pq.progress || 0}%)`;
        const branch = pq.branch ? ` [voie: ${pq.branch}]` : '';
        const obj = q.objective ? ` | Objectif: ${q.objective}` : '';
        return `- ${q.title}${chainInfo}${prog}${branch}: ${q.description}${obj}`;
      }).join('\n')
    : "Aucune quête active.";

  const availableQuests = await Quest.findAll({
      where: { rank_required: player.rank },
      order: [['chain', 'ASC'], ['step', 'ASC']],
      limit: 5
  });
  const availableQuestState = "Quêtes dispo (Rang " + player.rank + "):\n" + availableQuests.map(q => {
      const chainInfo = q.chain ? ` [${q.chain} • étape ${q.step}]` : '';
      const coop = q.isMultiplayer ? ' (COOP)' : '';
      return `- ${q.title}${chainInfo}${coop}: ${q.objective || q.description}`;
  }).join('\n');

  const dungeons = await Dungeon.findAll({ limit: 5 });
  const dungeonState = "Donjons:\n" + dungeons.map(d => `- ${d.name} (${d.rank})`).join('\n');

  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        whatsappId: { [Op.ne]: player.whatsappId }
    }
  });
  const socialState = nearbyPlayers.length > 0
    ? "Joueurs à proximité:\n" + nearbyPlayers.map(p => `- Nom: ${p.name}, Niveau: ${p.level}, Classe: ${p.class}, Vie: ${p.health}/${p.maxHealth}, Rang: ${p.rank}`).join('\n')
    : "Tu es seul ici.";

  const nearbyPlayersDetails = nearbyPlayers.length > 0
    ? nearbyPlayers.map(p => `- ${p.name} (${p.class}, niveau ${p.level})`).join('\n')
    : "Aucun autre joueur dans ta zone.";

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

  // Save current player message to memory
  await RPMessage.create({
      senderJid: player.whatsappId,
      senderName: player.name,
      content: actionText,
      location: player.location
  });

  // Fetch small history for context
  const history = await RPMessage.findAll({
      where: { location: player.location },
      order: [['id', 'DESC']],
      limit: 5
  });
  const historyState = history.length > 0
    ? "HISTORIQUE:\n" + history.reverse().map(h => `${h.senderName}: ${h.content}`).join('\n')
    : "";

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0
    ? "Compétences:\n" + playerSkills.map(s => `- ${s.name}: ${s.description.substring(0, 40)}...`).join('\n')
    : "Aucune compétence.";

  const kingdomState = "Monde: Empire d'Elion (Paix), Valkyrr (Trêve), Dominion Noir (Guerre).";

  // Context-aware NPCs
  const npcs = await NPC.findAll({
      where: { location: { [Op.like]: `%${player.location}%` } },
      limit: 3
  });
  const npcState = "PNJ ici:\n" + npcs.map(n => `- ${n.name} (${n.role})`).join('\n');

  const monsters = await Monster.findAll({
      where: { rank: player.rank },
      limit: 3
  });
  const monsterState = "Monstres:\n" + monsters.map(m => `- ${m.name} (PV:${m.health} ATK:${m.strength} DEF:${m.defense})`).join('\n');

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
    Tu es le MJ de "Arise / Aetherys". RPG de type Manhwa/Anime (style Solo Leveling, SAO, Overlord).

    STYLE NARRATIF & LOGIQUE:
    - Épique, réaliste et visuel. Style Manhwa/Seinen (type Solo Leveling).
    - LE JOUEUR N'EST PAS UN HÉROS : Le joueur est une personne ordinaire dans un monde dangereux. Il n'a pas d'armure de scénario. S'il fait une erreur, il en paie le prix fort. Ne le traite pas comme un protagoniste spécial.
    - RÉACTIVITÉ ABSOLUE (RÈGLE D'OR) : Tu es un MJ réactif. Tu ne dois JAMAIS inventer ou décrire les actions futures, les pensées ou les mouvements du joueur. Tes phrases DOIVENT commencer par les conséquences directes de l'action du joueur.
    - ADHÉRENCE STRICTE : Si le joueur dit "Je marche", il marche. Ne le fais pas courir ou s'arrêter ailleurs sans raison. Ne "téléporte" pas le joueur.
    - ÉCRITURE DES PNJ & IMPACT : Les PNJ sont des personnages COMPLEXES, TRÈS BIEN ÉCRITS et VIVANTS. Ils ont une âme. Donne-leur des noms, des motivations secrètes, des tics de langage (ex: un vieux qui finit ses phrases par "...héhé", un garde arrogant), et des émotions réelles. Ils ne sont pas juste des distributeurs de quêtes. Ils se souviennent de tes actes.
    - LOGIQUE SOCIALE & POLITIQUE : Prends en compte le métier (occupation), l'organisation et l'influence du joueur. Un politicien pourra influencer une foule mais se fera écraser en combat singulier contre un monstre, tandis qu'un artisan aura des facilités avec les marchands.
    - LOGIQUE DE MONDE : Respecte scrupuleusement la hiérarchie de puissance. Un joueur faible ne peut pas intimider un garde d'élite sans conséquence immédiate.
    - Pas de texte en anglais. PAS de parenthèses pour les sensations.
    - LONGUEUR: 4-5 paragraphes immersifs et détaillés.

    RÈGLES MJ (IMPÉRATIVES):
    1. PROTAGONISTE : Le joueur est l'unique héros. Le monde tourne autour de ses décisions.
    2. RÉACTIVITÉ TOTALE : Si le joueur fait une action stupide, il subit une conséquence stupide. S'il fait une action héroïque, décris-la de manière grandiose. Mais n'ajoute JAMAIS d'action de ton cru pour lui.
    3. PNJ DÉTAILLÉS : Donne un nom et une personnalité unique à chaque PNJ rencontré. Ils doivent rester cohérents.
    4. ARBITRAGE STATISTIQUE : Utilise les stats du joueur pour décider si une action réussit.

    ÉCHELLE DE PUISSANCE ET IMPACT DES STATS:
    - FORCE (FOR): ≥10 (Humain simple), ≥50 (Détruit des murs, fissure le sol), ≥150 (Pulvérise des bâtiments, ondes de choc).
    - VITESSE (AGI): Rang E (2m/s), Rang D (10m/s - Record humain), Rang C (30m/s - Image rémanente), Rang B+ (Vitesse supersonique, invisible).
    - INTELLIGENCE (INT): ≥10 (Petits sorts, lumière), ≥50 (Explosions de zone, manipulation élémentaire majeure), ≥150 (Sorts cataclysmiques, altération de la réalité).
    - DÉFENSE (DEF): ≥10 (Résistance humaine), ≥50 (Peau d'acier, ignore les lames communes), ≥150 (Invulnérabilité physique quasi-totale).
    - CHANCE (LUCK): Influence les coïncidences heureuses et les loots rares.

    DÉPLACEMENT (OBLIGATOIRE):
    - À CHAQUE déplacement, précise TOUJOURS la distance parcourue EN MÈTRES (ex: "Tu cours sur 25 mètres") et le LIEU/POINT VISÉ exact (ex: "vers la porte nord de la taverne").
    - La distance doit être cohérente avec l'AGI/vitesse du joueur et le temps de l'action. Un humain (AGI ~10) couvre ~2 m/s en marche, ~10 m/s en sprint ; AGI élevée = distances bien plus grandes.
    - Si la destination est trop loin pour l'action décrite, indique la distance réellement franchie et ce qu'il reste à parcourir.

    COMBAT, ESQUIVE & IMPACT (RÈGLE DE RÉALISME) :
    1. COMPARAISON DE PUISSANCE : Si l'ennemi est plus puissant (Niveau/FOR/AGI), le joueur est en danger de mort.
    2. RÈGLE DU 1/3 (IMPACT BRUTAL) :
       - Si le joueur est trop faible ou si son action de défense est médiocre/vague :
         - Dans 33% des cas (1/3) : L'attaque touche DIRECTEMENT. Le joueur se prend le coup DE PLEIN FOUET sans possibilité de réaction. Décris l'impact violent, le choc, la douleur. Applique "health_change" négatif conséquent.
         - Dans 66% des cas (2/3) : Tu décris l'attaque imminente et dévastatrice, et tu laisses le joueur TENTER une esquive ou un contre désespéré au prochain tour.
    3. RÉACTIVITÉ VISCÉRALE : Les coups font mal. Décris le sang, la douleur, le recul, le craquement des os. Sois cru et réaliste.
    4. PAS D'INVENTION : Si le joueur dit "J'esquive", ne dis JAMAIS "Tu esquives et tu frappes". Dis seulement "Tu esquives de justesse, ton souffle est court. Que fais-tu ?".

    SOCIAL:
    - Tu gères des interactions entre joueurs dans la même zone.
    - Si l'action du joueur implique un autre joueur, tu peux créer une notification directe à ce joueur via une action notify_player.
    - Si l'événement concerne tous les joueurs du lieu, utilise une action broadcast.
    - Ne nomme jamais la JID ou d'autres données techniques, seulement les noms de personnages.

    QUÊTES (IMPORTANT):
    - Les quêtes sont ORDONNÉES en chaînes (étape 1, 2, 3...). Le joueur suit les étapes dans l'ordre.
    - Quand le joueur accepte une quête, utilise l'action "start_quest" avec son titre EXACT (voir "Quêtes dispo").
    - Quand il progresse, utilise "advance_quest" (progress = 0-100). Quand l'objectif est atteint, utilise "complete_quest" : la quête suivante de la chaîne se débloque AUTOMATIQUEMENT.
    - Tu peux MODIFIER LE COURS d'une quête selon les choix du joueur avec "update_quest" (branch = nom de la voie, notes = nouvelle direction). Ex: trahir un PNJ ouvre une voie différente.
    - INTERACTION ENTRE JOUEURS: pour une quête coopérative (marquée COOP) ou quand plusieurs joueurs sont présents, utilise "start_multiplayer_quest" : tous les joueurs de la zone reçoivent la quête et peuvent la faire progresser ensemble.
    - N'invente PAS de titres de quête : utilise uniquement ceux listés dans "Quêtes dispo" / "Quêtes Actives".

    FORMAT DE RÉPONSE (JSON STRICT):
    {
      "narrative": "Ton récit en français...",
      "actions": [
        {"type": "update_player", "parameters": {"col_change": 10, "xp_gain": 20, "new_class": "Optionnel"}},
        {"type": "add_item", "parameters": {"itemName": "Objet", "quantity": 1}},
        {"type": "notify_player", "parameters": {"target_name": "Nom du joueur", "message": "Texte de notification RP"}},
        {"type": "broadcast", "parameters": {"message": "Annonce RP pour tous les joueurs présents"}},
        {"type": "start_quest", "parameters": {"questTitle": "Titre exact de la quête"}},
        {"type": "advance_quest", "parameters": {"questTitle": "Titre", "progress": 50, "note": "Optionnel"}},
        {"type": "complete_quest", "parameters": {"questTitle": "Titre"}},
        {"type": "update_quest", "parameters": {"questTitle": "Titre", "branch": "Voie choisie", "notes": "Nouvelle direction de la quête"}},
        {"type": "start_multiplayer_quest", "parameters": {"questTitle": "Titre de la quête COOP"}}
      ],
      "imagePrompt": "Description visuelle pour l'IA d'image"
    }
  `;

    const fullPrompt = `### CONTEXTE DU JOUEUR ###\n${playerState}\n${inventoryState}\n${skillState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${npcState}\n${monsterState}\n${socialState}\nJoueurs proches:\n${nearbyPlayersDetails}\n${historyState}\n\n### ACTION DU JOUEUR (À TRAITER PRIORITAIREMENT) ###\n${actionText}`;

  try {
    let content = await callAI(systemPrompt, fullPrompt);
    if (!content) {
        throw new Error("L'IA a retourné une réponse vide.");
    }
    console.log(`[AI RAW] Contenu reçu: ${content.substring(0, 500)}...`);

    // Enhanced JSON & Narrative extraction
    let aiResponse = { narrative: "", actions: [], notifications: [], broadcastMessage: null };

    const cleanupNarrative = (t) => {
        if (!t) return "";
        return t.replace(/```json/gi, '')
                .replace(/```/g, '')
                .replace(/^(json|JSON)/g, '')
                .replace(/\{[\s\S]*\}/g, '') // Remove any internal JSON strings
                .replace(/^(Narrative|Narrateur|MJ|Systeme|Arise|json|JSON)\s*:\s*/i, '')
                .replace(/(\n|^)[a-z_]+_change:.*(\n|$)/gi, '')
                .trim();
    };

    if (typeof content === 'object') {
        aiResponse = { ...aiResponse, ...content };
    } else {
        // Robust JSON extraction: Find the largest JSON block possible
        let start = content.indexOf('{');
        let end = content.lastIndexOf('}');

        if (start !== -1 && end !== -1 && end > start) {
            const potentialJson = content.substring(start, end + 1);
            try {
                const parsed = JSON.parse(potentialJson);
                aiResponse = { ...aiResponse, ...parsed };
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
                    } catch (innerE) {}
                }
            }
        }

        // If no narrative found in JSON, or parse failed, use the whole text excluding all JSON-like blocks
        if (!aiResponse.narrative || aiResponse.narrative.length < 10) {
            let plainText = content.replace(/\{[\s\S]*?\}/g, '').trim();
            aiResponse.narrative = cleanupNarrative(plainText);
        }

        // Final fallback: if still empty, use content but clean it hard
        if (!aiResponse.narrative || aiResponse.narrative.length < 10) {
            aiResponse.narrative = cleanupNarrative(content);
        }
    }

    // Ensure narrative is clean
    aiResponse.narrative = cleanupNarrative(aiResponse.narrative);

    if (!aiResponse.narrative || aiResponse.narrative.length < 3) {
        aiResponse.narrative = "Le flux magique est instable. L'action est en suspens...";
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

    // Collected quest feedback lines appended to the narrative after the loop.
    const questFeedback = [];

    // Process AI actions
    for (const actionObj of actions) {
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
              if (target.health < 0) await target.update({ health: 0 });
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

          if (parameters.new_location) {
              await target.update({ location: parameters.new_location });
              // Check if there is a local image for this location
              const locationImages = {
                  'Académie Impériale': 'assets/locations/academy.jpg',
                  'Eldoria': 'assets/locations/eldoria.jpg', // if it exists
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
                const notifyTarget = await Player.findOne({ where: { name: { [Op.like]: `%${parameters.target_name}%` }, location: player.location } });
                if (notifyTarget) {
                    await sock.sendMessage(notifyTarget.whatsappId, {
                        text: `🔔 *Message de RP*\n\n${parameters.message}`
                    });
                }
            }
            break;

        case 'broadcast':
            if (parameters.message) {
                for (const other of nearbyPlayers) {
                    await sock.sendMessage(other.whatsappId, {
                        text: `📣 *Annonce RP*\n\n${parameters.message}`
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
      }

      // Notify target if it's not the current player
      if (target.whatsappId !== player.whatsappId) {
          await sock.sendMessage(target.whatsappId, {
              text: `🔔 *NOTIFICATION RP*\n\n${player.name} a interagi avec toi !\n\n${aiResponse.narrative}`
          });
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

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error('Erreur avec l\'API Puter.js:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du MJ. L'action n'a pas pu être traitée." });
  }
}

module.exports = { handleFreeAction };
