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

  const items = await Item.findAll();
  const shopState = "Objets en vente à la boutique:\n" + items.map(i => `- ${i.name} (${i.price} Col): ${i.description}`).join('\n');

  // Save current player message to memory before fetching history
  await RPMessage.create({
      senderJid: player.whatsappId,
      senderName: player.name,
      content: actionText,
      location: player.location
  });

  // Memory: Get last 15 messages from this location (now including the current one)
  const history = await RPMessage.findAll({
      where: { location: player.location },
      order: [['id', 'DESC']], // Using ID for faster sorting if indexed
      limit: 15
  });
  const historyState = history.length > 0
    ? "Historique récent à cet endroit (Mémoire):\n" + history.reverse().map(h => `[${h.timestamp.toLocaleTimeString()}] ${h.senderName}: ${h.content}`).join('\n')
    : "Aucun événement récent marqué dans la mémoire collective ici.";

  const playerSkills = await player.getSkills();
  const skillState = playerSkills.length > 0
    ? "Compétences possédées:\n" + playerSkills.map(s => `- ${s.name} (${s.type}): ${s.description}`).join('\n')
    : "Tu n'as aucune compétence. Étudie à l'Académie Impériale !";

  const kingdoms = await Kingdom.findAll();
  const currentKingdom = kingdoms.find(k => player.location.toLowerCase().includes(k.name.toLowerCase()) || (k.description && player.location.toLowerCase().includes(k.description.split(':')[1]?.trim().toLowerCase())));
  const kingdomState = "État du Monde (Royaumes):\n" + kingdoms.map(k => `- ${k.name}: ${k.description} [Statut: ${k.status}, Force Militaire: ${k.militaryPower}, Leader: ${k.leader}] ${k.name === currentKingdom?.name ? '(LIEU ACTUEL)' : ''}`).join('\n');

  const conflicts = await Conflict.findAll({ where: { status: 'active' } });
  const conflictState = "Conflits Actuels (Guerres):\n" + conflicts.map(c => `- ${c.title}: ${c.description} (Impliqués: ${c.involvedKingdoms})`).join('\n');

  // Limit NPCs to current location or key global ones for prompt efficiency
  const npcs = await NPC.findAll({
      where: {
          [Op.or]: [
              { location: player.location },
              { name: ['Directeur Magnus', 'Heathcliff', 'Asuna'] }
          ]
      }
  });
  const npcState = "Personnages Importants (PNJ) à proximité ou mondiaux:\n" + npcs.map(n => `- ${n.name} (${n.role}): ${n.description}`).join('\n');

  const monsters = await Monster.findAll();
  const monsterState = "Bestiaire (Référence de puissance pour le MJ):\n" + monsters.map(m => `- ${m.name} (Rang ${m.rank}): PV ${m.health}, STR ${m.strength}, DEF ${m.defense}, AGI ${m.agility}`).join('\n');

  const schools = await School.findAll();
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

  const systemPrompt = `
    Tu es le Maître du Jeu (MJ) de "Arise / Le Monde d’Aetherys", un RPG textuel ultra-immersif. Ton style est celui d'un SCÉNARISTE D'ANIME PROFESSIONNEL pour une série à gros budget.
    **EXIGENCE LINGUISTIQUE (CRUCIAL)**: Tu dois écrire dans un FRANÇAIS SIMPLE, CLAIR et PERCUTANT. Évite les phrases trop longues ou trop complexes. L'utilisateur veut une lecture fluide et immédiate. Bannis toute tournure de phrase "IA" (ex: "En tant qu'IA...", "Voici le résultat..."). Ta seule et unique fonction est de retourner un objet JSON valide.

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
    1.  **Omniscience**: Tu es le créateur. Intègre des éléments de fantasy sombre et de Sword Art Online. Les PNJ ont leurs propres motivations.
    2.  **Censure Interdite & Ton Mature**: Ton sombre, réaliste, viscéral. Le monde est impitoyable.
    3.  **Difficulté "Hardcore"**: Les succès sont rares. Un échec peut être fatal.
    4.  **Calcul des Statistiques & Flair Anime (CRUCIAL)**:
        - **LOGIQUE**: Utilise TOUJOURS les statistiques (Force, Agilité, Intelligence, Défense, Chance) pour chaque test. Ne laisse pas le hasard décider arbitrairement. Un joueur avec 100 en Force doit terrasser un monstre de 10 en Force instantanément.
        - **COMBAT ANIME (PRÉCIS)**: Les combats doivent être décrits comme des scènes d'action intenses.
        - **MÉTRIQUES**: Utilise des distances précises en MÈTRES (ex: "Tu te tiens à 5 mètres de l'ennemi").
        - **ESQUIVE**: Si l'Agilité du joueur est nettement supérieure à celle de l'ennemi, décris une "Esquive" (Dodge) parfaite.
        - Sois précis : décris la trajectoire des lames, le sifflement de l'air, et les impacts.
        - Utilise explicitement les chiffres dans la narration (ex: "Ton coup inflige 40 points de dégâts").
        - Compare toujours les stats du joueur à celles de l'adversaire (Bestiaire).
        - Un combat se déroule en plusieurs échanges épiques. Tu dois réduire la Vie du joueur ou de l'ennemi dans le JSON.
    5.  **Système de Rang & École**: Respecte strictement la hiérarchie académique. Un élève doit passer des examens écrits (lore) et pratiques pour monter en grade.
        - **EXAMENS**: Si un joueur passe un examen, pose-lui 1-2 questions sur le Lore d'Aetherys. Évalue sa réponse pour ajuster sa "academicGrade".
        - **TOURNOI**: En période de tournoi, organise des duels épiques entre élèves de différentes écoles (Elion vs Valkyrr vs Azrak).
        - **POINTS DE COMPÉTENCE (SP)**: Si un joueur a des SP, il peut te demander de les dépenser pour augmenter ses statistiques (Force, Agilité, etc.). 1 SP = +1 stat.
    6.  **Interactions Sociales**: Si des joueurs sont à proximité, encourage les alliances, les échanges ou les affrontements. Tu DOIS les identifier par leur nom.
    7.  **Ciblage & Arbitrage PvP (CRUCIAL)**:
        - Tu peux appliquer des actions à d'autres joueurs présents en ajoutant "target_name" dans les paramètres JSON.
        - **ARBITRAGE PvP**: Dans un combat entre joueurs (A contre B), tu n'es qu'un ARBITRE.
        - Tu DOIS nommer et TAguer l'adversaire (ex: "@NomAdversaire") dans ta narration.
        - Informe-le qu'il a **5 minutes** pour répondre avant que tu ne donnes ton verdict basé sur les statistiques.
        - Ne décide pas du vainqueur immédiatement si l'adversaire n'a pas encore eu l'occasion de réagir.
    8.  **Vérification des Noms**: Utilise uniquement les noms fournis dans la section "Joueurs à proximité". Si le joueur mentionne un nom qui n'est pas là, il s'adresse à un PNJ ou hallucine.
    9.  **Format JSON Impératif**: Réponse JSON uniquement. Ta réponse DOIT commencer par '{' et se terminer par '}'.

    FORMAT DE LA NARRATION (STYLE ANIME MODERN-FANTASY):
    - Narration CINÉMATIQUE, FLUIDE et IMMERSIVE (Style Shonen/Seinen de haute qualité).
    - **LANGUE**: Utilise un Français simple, clair et percutant. Évite les phrases robotiques, les répétitions ou le jargon artificiel.
    - Ton: Épique, mystérieux, et viscéral lors des combats.
    - IMMERSION: Décris les interactions avec le "Gheno Phone", les publicités holographiques dans les rues, et le mélange entre technologie de pointe et magie ancienne.
    - Utilise des en-têtes stylisés avec des emojis et des onomatopées japonaises (ex: *ZING*, *DODODO*, *SHING*, *GOGOGO*).
    - Ajoute des lignes de "dialogue de combat" entre parenthèses pour les personnages.
    - Description détaillée des mouvements: "Tu dégaines ton épée avec une vitesse fulgurante, l'acier fendant l'air dans un sifflement aigu..."
    - Ajoute des monologues intérieurs ou des répliques de boss dramatiques.
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
  `;

    const fullPrompt = `CONTEXTE:\n${playerState}\n${inventoryState}\n${skillState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${socialState}\n${shopState}\n${kingdomState}\n${conflictState}\n${schoolState}\n${npcState}\n${monsterState}\n\n${historyState}\n\nACTION ACTUELLE DU JOUEUR: ${actionText}`;

  try {
    const content = await callAI(systemPrompt, fullPrompt);
    console.log(`[AI RAW] Contenu reçu: ${content.substring(0, 500)}...`);

    // Robust JSON extraction
    let jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        // Second attempt: check if AI returned markdown code blocks
        if (content.includes('```')) {
            const stripped = content.split('```')[1].replace(/^json\n?/, '').split('```')[0].trim();
            jsonMatch = stripped.match(/\{[\s\S]*\}/);
        }
    }

    if (!jsonMatch) {
        console.error("[AI ERROR] Échec extraction JSON. Contenu brut:", content);
        throw new Error("Impossible d'extraire le JSON de la réponse de l'IA.");
    }

    const aiResponse = JSON.parse(jsonMatch[0]);
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
