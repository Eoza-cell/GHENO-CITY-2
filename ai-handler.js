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
const { checkLevelUp } = require('./level-utils');
const { isDay, getWeather } = require('./game-state');
const { getRPTime, getWorldHeader } = require('./world-clock');

async function handleFreeAction(sock, message, player, actionText) {
  const jid = message.key.remoteJid;

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

  const nearbyPlayers = await Player.findAll({
    where: {
        location: player.location,
        subLocation: player.subLocation
    }
  });

  const isTriggerWord = actionText.toLowerCase().trim() === 'next';
  const otherActorsCount = nearbyPlayers.filter(p => p.whatsappId !== player.whatsappId).length;
  const isSolo = otherActorsCount === 0;

  const lastMJMessage = await RPMessage.findOne({
      where: { senderName: 'Arise MJ', location: player.location, subLocation: player.subLocation },
      order: [['id', 'DESC']]
  });

  if (!isTriggerWord && !isSolo) {
      const recentPlayerMsgs = await RPMessage.count({
          where: {
              senderJid: player.whatsappId,
              id: { [Op.gt]: lastMJMessage ? lastMJMessage.id : 0 }
          }
      });
      let reminder = "";
      if (recentPlayerMsgs >= 3) reminder = "\n\n💡 *Note:* N'oublie pas de taper `next` pour obtenir une réponse du MJ.";
      await sock.sendMessage(jid, { text: `⏳ *Action enregistrée.*${reminder}` });
      return;
  }

  const messageQuery = {
      location: player.location,
      subLocation: player.subLocation,
      senderName: { [Op.ne]: 'Arise MJ' }
  };
  if (lastMJMessage) messageQuery.id = { [Op.gt]: lastMJMessage.id };

  const recentActions = await RPMessage.findAll({
      where: { ...messageQuery, content: { [Op.notLike]: 'next' } },
      order: [['id', 'ASC']]
  });

  const playersInKingdom = await Player.findAll({
      where: { location: player.location, subLocation: { [Op.ne]: player.subLocation } },
      attributes: ['name', 'subLocation']
  });

  const aggregatedActions = recentActions.length > 0
    ? recentActions.map(a => `${a.senderName}: ${a.content}`).join('\n')
    : "(Aucune action récente.)";

  // Detailed data for players in the scene
  const scenePlayersData = await Promise.all(nearbyPlayers.map(async p => {
      const pSkills = await p.getSkills();
      const pQuests = await p.getQuests();
      const pActiveQuests = pQuests.filter(q => q.PlayerQuest.status === 'in_progress');
      const pActions = recentActions.filter(a => a.senderName === p.name).map(a => a.content);

      return {
          Nom: p.name,
          Identity: `${p.gender}, ${p.age} ans, ${p.class}(${p.derivative}), ${p.occupation}`,
          Stats: `Niv:${p.level} | PV:${p.health}/${p.maxHealth} | PM:${p.mana}/${p.maxMana} | Faim:${p.hunger} | Sommeil:${p.sleep} | Col:${p.col} | FOR:${p.strength} AGI:${p.agility} INT:${p.intelligence} DEF:${p.defense} LUK:${p.luck}`,
          Inv: (p.inventory || []).map(i => `${i.name} (x${i.quantity})`).join(', ') || "Vide",
          Competences: pSkills.map(s => s.name).join(', '),
          Actions: pActions.length > 0 ? pActions : ["Immobile"]
      };
  }));

  const history = await RPMessage.findAll({
      where: { location: player.location, subLocation: player.subLocation },
      order: [['id', 'DESC']],
      limit: 40
  });
  const historyState = history.reverse().map(h => `${h.senderName}: ${h.content}`);

  const journal = await WorldJournal.findAll({ order: [['id', 'DESC']], limit: 15 });
  const journalState = journal.reverse().map(j => `[${j.category}] ${j.entry}`);

  const allKingdoms = await Kingdom.findAll();
  let kingdom = allKingdoms.find(k => k.name === player.location) || allKingdoms.find(k => k.description.toLowerCase().includes(player.location.toLowerCase()));

  const npcs = await NPC.findAll({
    where: { location: { [Op.like]: `%${player.location}%` }, role: { [Op.notLike]: '%Garde%' } },
    order: sequelize.random(),
    limit: 3
  });

  const rpTime = getRPTime();
  const weather = getWeather();

  const memoryJson = {
      Monde: {
          Temps: rpTime.formatted,
          Cycle: rpTime.isDay ? "JOUR" : "NUIT",
          Meteo: weather,
          Royaume: kingdom?.name || player.location,
          Lore: kingdom?.description || ""
      },
      Personnages_En_Scene: scenePlayersData,
      Population_Royaume: playersInKingdom.map(p => `${p.name} (${p.subLocation})`),
      Environnement: {
          PNJ: npcs.map(n => `${n.name} (${n.role})`)
      },
      Journal: journalState,
      Historique: historyState
  };

  const fullPrompt = `
### CONTEXTE_DU_MONDE ###
${JSON.stringify(memoryJson, null, 2)}

### CHRONOLOGIE_DES_ACTIONS_À_TRAITER ###
${aggregatedActions}

IMPORTANT: Le joueur actif est "${player.name}".
CONSIGNES MJ:
1. RÉSOUS CHAQUE ACTION de la chronologie en utilisant les STATS et l'INVENTAIRE (Inv) fournis.
2. Si un objet n'est pas dans 'Inv', le joueur ne peut pas l'utiliser.
3. STRUCTURE: [NOM_DU_JOUEUR] Narration... ▬▬▬▬▬▬▬▬▬▬▬▬
4. RÉPONDS UNIQUEMENT EN JSON VALIDE: {"pensee_mj": "...", "narrative": "...", "actions": []}
`.trim();

  const systemPrompt = `Tu es le MJ d'ARISE, un RPG dark-fantasy viscéral (Style Solo Leveling).
Ton rôle est de décrire les conséquences des actions des joueurs.
- LE MONDE EST CRUEL : Pas de succès gratuit.
- SOIS PRÉCIS : Utilise les stats et l'inventaire 'Inv' du JSON.
- ACTIONS LOGIQUES : Tu DOIS inclure les actions (update_stats, etc.) dans le champ "actions" du JSON.
- NARRATION : Riche, sensorielle, 3ème personne. Jamais de "Tu fais".`;

  try {
    let content = await callAI(systemPrompt, fullPrompt);
    if (!content) content = JSON.stringify({ narrative: "🌀 *Ether instable...*", actions: [] });

    let aiResponse = { narrative: "", actions: [] };
    if (typeof content === 'object') {
        aiResponse = { ...aiResponse, ...content };
    } else {
        let start = content.indexOf('{'), end = content.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            try { aiResponse = { ...aiResponse, ...JSON.parse(content.substring(start, end + 1)) }; }
            catch (e) { aiResponse.narrative = content; }
        } else { aiResponse.narrative = content; }
    }

    RPMessage.create({
        senderJid: 'bot', senderName: 'Arise MJ',
        content: aiResponse.narrative, location: player.location, subLocation: player.subLocation
    }).catch(e => {});

    const { questFeedback, playersToUpdate, notifiedTargets } = await processActions(sock, jid, player, aiResponse.actions || [], aiResponse, nearbyPlayers);

    for (const targetJid of notifiedTargets) {
        const targetPlayer = await Player.findOne({ where: { whatsappId: targetJid } });
        if (targetPlayer && shouldNotifyPlayer(targetPlayer)) {
            await sock.sendMessage(targetJid, { text: `🔔 *NOTIFICATION RP*\n\n${player.name} a interagi avec toi !\n\n${aiResponse.narrative}` });
        }
    }

    if (questFeedback.length > 0) aiResponse.narrative += `\n\n${questFeedback.join('\n\n')}`;
    aiResponse.narrative = `${getWorldHeader()}\n\n${aiResponse.narrative}`;

    await sendWithImage(sock, jid, aiResponse);

    for (const pId of playersToUpdate) {
        const pToUpdate = await Player.findOne({ where: { whatsappId: pId } });
        if (pToUpdate && shouldNotifyPlayer(pToUpdate)) {
            await pToUpdate.reload();
            const profileBuffer = await generateProfileCard(pToUpdate);
            await sock.sendMessage(pId, { image: profileBuffer, caption: `--- 🆔 PROFIL MIS À JOUR : ${pToUpdate.name} ---` });
        }
    }
  } catch (error) {
    console.error('AI Handler Error:', error);
    await sock.sendMessage(jid, { text: "Erreur critique du flux magique." });
  }
}

module.exports = { handleFreeAction };
