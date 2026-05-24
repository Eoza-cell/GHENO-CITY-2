const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, sequelize, Kingdom, Conflict, School, NPC, Skill, RPMessage, Monster } = require('./database');
const { sendWithImage } = require('./message-handler');
const { Op } = require('sequelize');
const { callAI } = require('./ai-utils');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;
  const senderJid = message.key.remoteJid.endsWith('@g.us') ? message.key.participant : message.key.remoteJid;

  const playerState = `
    - Nom: ${player.name} ${player.isGod ? '(DIEU DE LA DESTRUCTION)' : ''}
    - Description: ${player.characterDescription}
    - Race: ${player.race}
    - Points de Compétence (SP): ${player.skillPoints}
    - Rang: ${player.rank}
    - Niveau: ${player.level}
    - XP: ${player.xp}/${player.level * 100}
    - Vie: ${player.health}/${player.maxHealth}
    - Ki: ${player.ki}/${player.maxKi}
    - Zeni: ${player.zeni}
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
  const dungeonState = "Lieux de combat/Zones:\n" + dungeons.map(d => `- ${d.name} (Rang ${d.rank})`).join('\n');

  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        whatsappId: { [Op.ne]: player.whatsappId }
    }
  });
  const socialState = nearbyPlayers.length > 0
    ? "Guerriers à proximité:\n" + nearbyPlayers.map(p => `- Nom: ${p.name}, Niveau: ${p.level}, Race: ${p.race}, Vie: ${p.health}/${p.maxHealth}, Rang: ${p.rank}`).join('\n')
    : "Tu es seul ici.";

  const items = await Item.findAll({
      where: {
          [Op.or]: [
              { price: { [Op.lte]: player.zeni + 1000 } },
              { name: ['Senzu', 'Armure Saiyan'] }
          ]
      },
      limit: 5
  });
  const shopState = "Boutique (Aperçu):\n" + items.map(i => `- ${i.name} (${i.price} Zeni): ${i.description.substring(0, 50)}...`).join('\n');

  await RPMessage.create({
      senderJid: player.whatsappId,
      senderName: player.name,
      content: actionText,
      location: player.location
  });

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
    ? "Techniques (Ki):\n" + playerSkills.map(s => `- ${s.name}: ${s.description.substring(0, 40)}...`).join('\n')
    : "Aucune technique.";

  const kingdoms = await Kingdom.findAll({ limit: 4 });
  const kingdomState = "Planètes/Lieux:\n" + kingdoms.map(k => `- ${k.name} [${k.status}]`).join('\n');

  const npcs = await NPC.findAll({
      where: {
          [Op.or]: [
              { location: { [Op.like]: `%${player.location}%` } },
              { name: ['Goku', 'Vegeta', 'Tortue Géniale'] }
          ]
      },
      limit: 6
  });
  const npcState = "Personnages à proximité:\n" + npcs.map(n => `- ${n.name} (${n.role}): ${n.description.substring(0, 60)}...`).join('\n');

  const currentRankIndex = ['F', 'E', 'D', 'C', 'B', 'A', 'S'].indexOf(player.rank);
  const monsters = await Monster.findAll({
      where: {
          rank: { [Op.in]: ['F', 'E', 'D', 'C', 'B', 'A', 'S'].slice(Math.max(0, currentRankIndex - 1), currentRankIndex + 2) }
      },
      limit: 5
  });
  const monsterState = "Ennemis:\n" + monsters.map(m => `- ${m.name} (Rang ${m.rank}) [PV: ${m.health}, FOR: ${m.strength}, DEF: ${m.defense}, AGI: ${m.agility}]`).join('\n');

    const triggerMiniEvent = Math.random() < 0.15;
    const miniEventContext = triggerMiniEvent
        ? "\n⚠️ **ÉVÉNEMENT IMPRÉVU**: Un événement Dragon Ball doit se produire (Ex: Une Dragon Ball détectée, une attaque soudaine, un défi d'un rival, etc.)"
        : "";

  const systemPrompt = `
    Tu es le Maître du Jeu (MJ) de "Dragon Ball RP", un RPG textuel ultra-immersif dans l'univers de Akira Toriyama.
    **EXIGENCE LINGUISTIQUE**: Français direct, percutant, style manga Shonen. Ta seule fonction est de retourner un objet JSON valide.

    **LOGIQUE DE COMBAT DÉTAILLÉE (CRUCIAL)**:
    - Les combats doivent être EXTRÊMEMENT PRÉCIS.
    - **Distance**: Tu dois mentionner la distance en MÈTRES lors des déplacements et des attaques (ex: "Tu recules de 5 mètres", "Il fond sur toi à une distance de 2 mètres").
    - **Membres utilisés**: Précise toujours si le personnage utilise le bras GAUCHE ou DROIT, la jambe GAUCHE ou DROITE (ex: "Tu lances un crochet du droit", "Il bloque avec son avant-bras gauche").
    - **Cible**: Précise l'endroit visé (tempe, foie, plexus, genou, etc.).
    - **Impact**: Décris l'onde de choc, la poussière qui se lève, les cratères formés.

    **ENTRAÎNEMENT & PROGRESSION**:
    - Le joueur peut s'entraîner (pompes, méditation, combat contre des ombres).
    - L'entraînement doit être décrit en détail par le joueur. S'il fait un effort réel et prolongé (plusieurs messages), tu peux lui octroyer des gains de statistiques via "update_player".
    - **INTERDICTION DE TIME-SKIP**: Tout entraînement se vit en temps réel.

    **UNIVERS DRAGON BALL**:
    - Utilise le Ki, les Senzus, les Zeni, les Dragon Balls.
    - Les races disponibles sont: Humain, Saiyan, Namek, Démon du Froid (Race de Freezer), Majin.
    - Ton ton est celui d'un narrateur de Dragon Ball Z/Super : épique, intense, avec des enjeux élevés.

    RÈGLES DE COMBAT (STRICTES):
    - Dégâts infligés = (Force * 2) - (Défense de l'ennemi).
    - Esquive = Agilité vs Agilité.
    - Ki: Les techniques consomment du Ki. Si Ki < coût, l'action échoue.

    TYPES D'ACTIONS (JSON):
    - "update_player": {"target_name": "...", "zeni_change": montant, "xp_gain": montant, "health_change": montant, "ki_change": montant, "strength_change": montant, "agility_change": montant, "intelligence_change": montant, "defense_change": montant, "sp_gain": montant, "new_location": "..."}
    - "add_skill": {"skillName": "..."}
    - "add_item": {"itemName": "...", "quantity": nombre}
    - "remove_item": {"itemName": "...", "quantity": nombre}
  `;

    const fullPrompt = `CONTEXTE:\n${playerState}\n${inventoryState}\n${skillState}\n${questState}\n${availableQuestState}\n${dungeonState}\n${socialState}\n${shopState}\n${kingdomState}\n${npcState}\n${monsterState}${miniEventContext}\n\n${historyState}\n\nACTION ACTUELLE DU JOUEUR: ${actionText}`;

  try {
    let content = await callAI(systemPrompt, fullPrompt);
    if (!content) throw new Error("Réponse vide de l'IA.");

    let aiResponse = { narrative: "", actions: [] };
    let jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
        try {
            aiResponse = JSON.parse(jsonMatch[0]);
        } catch (e) {
            aiResponse.narrative = content.replace(/\{[\s\S]*\}/, '').trim();
        }
    } else {
        aiResponse.narrative = content.trim();
    }

    if (!aiResponse.narrative) aiResponse.narrative = "L'énergie du monde vacille...";

    await RPMessage.create({
        senderJid: 'bot',
        senderName: 'Dragon Ball MJ',
        content: aiResponse.narrative,
        location: player.location
    });

    const actions = aiResponse.actions || [];
    for (const actionObj of actions) {
      const { type, parameters } = actionObj;
      if (!parameters) continue;

      let target = player;
      if (parameters.target_name) {
          const foundTarget = await Player.findOne({ where: { name: parameters.target_name, location: player.location } });
          if (foundTarget) target = foundTarget;
      }

      switch (type) {
        case 'update_player':
          if (parameters.zeni_change) await target.increment('zeni', { by: parameters.zeni_change });
          if (parameters.xp_gain) {
              await target.increment('xp', { by: parameters.xp_gain });
              await target.reload();
              const xpNeeded = target.level * 100;
              if (target.xp >= xpNeeded) {
                  await target.increment('level', { by: 1 });
                  await target.update({
                      xp: target.xp % xpNeeded,
                      maxHealth: target.maxHealth + 50,
                      maxKi: target.maxKi + 30,
                      health: target.maxHealth + 50,
                      ki: target.maxKi + 30,
                      strength: target.strength + 5,
                      agility: target.agility + 5,
                      defense: target.defense + 5
                  });
                  await sock.sendMessage(target.whatsappId, { text: `🔥 *MONTÉE EN PUISSANCE !* 🔥\nTu es maintenant niveau ${target.level} ! Ton Ki et ta Force augmentent !` });
              }
          }
          if (parameters.health_change) {
              await target.increment('health', { by: parameters.health_change });
              await target.reload();
              if (target.health > target.maxHealth) await target.update({ health: target.maxHealth });
              if (target.health < 0) await target.update({ health: 0 });
          }
          if (parameters.ki_change) {
              await target.increment('ki', { by: parameters.ki_change });
              await target.reload();
              if (target.ki > target.maxKi) await target.update({ ki: target.maxKi });
              if (target.ki < 0) await target.update({ ki: 0 });
          }
          if (parameters.strength_change) await target.increment('strength', { by: parameters.strength_change });
          if (parameters.agility_change) await target.increment('agility', { by: parameters.agility_change });
          if (parameters.intelligence_change) await target.increment('intelligence', { by: parameters.intelligence_change });
          if (parameters.defense_change) await target.increment('defense', { by: parameters.defense_change });
          if (parameters.sp_gain) await target.increment('skillPoints', { by: parameters.sp_gain });
          if (parameters.new_location) await target.update({ location: parameters.new_location });
          break;

        case 'add_skill':
          if (parameters.skillName) {
            const skill = await Skill.findOne({ where: { name: { [Op.like]: `%${parameters.skillName}%` } } });
            if (skill && !(await target.hasSkill(skill))) {
                await target.addSkill(skill);
                const bonuses = skill.statBonuses;
                for (const [stat, value] of Object.entries(bonuses)) {
                  if (['strength', 'agility', 'intelligence', 'defense'].includes(stat)) {
                    await target.increment(stat, { by: value });
                  }
                }
            }
          }
          break;

        case 'add_item':
          if (parameters.itemName && parameters.quantity) {
            let inventory = [...target.inventory];
            const existingItem = inventory.find(i => i.name.toLowerCase() === parameters.itemName.toLowerCase());
            if (existingItem) existingItem.quantity += parameters.quantity;
            else inventory.push({ name: parameters.itemName, quantity: parameters.quantity });
            target.inventory = inventory;
            await target.save();
          }
          break;

        case 'remove_item':
            if (parameters.itemName && parameters.quantity) {
                let inventory = [...target.inventory];
                const itemIndex = inventory.findIndex(i => i.name.toLowerCase() === parameters.itemName.toLowerCase());
                if (itemIndex !== -1) {
                    inventory[itemIndex].quantity -= parameters.quantity;
                    if (inventory[itemIndex].quantity <= 0) inventory.splice(itemIndex, 1);
                    target.inventory = inventory;
                    await target.save();
                }
            }
            break;
      }
    }

    await sendWithImage(sock, jid, aiResponse);

  } catch (error) {
    console.error('Erreur AI:', error);
    await sock.sendMessage(jid, { text: "Une perturbation dans le Ki empêche l'action." });
  }
}

module.exports = { handleFreeAction };
