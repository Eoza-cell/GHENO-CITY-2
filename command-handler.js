const fs = require('fs');
const path = require('path');

// Memory map to track the last 8 items shown to each player for easy index-based purchases
const lastViewedItems = new Map();
// Memory map to track currently sleeping players
const sleepingPlayers = new Map();
const axios = require('axios');
const sharp = require('sharp');
const { Player, Dungeon, Quest, PlayerQuest, Bank, Item, Skill, PlayerSkill, Entity, Pact, Club, PlayerClub, Kingdom, NPC, RPMessage, House, TournamentParticipant, sequelize } = require('./database');
const { Op } = require('sequelize');
const { generateEquipmentStatusImage } = require('./equipment-visualizer');
const { generateProfileCard } = require('./profile-generator');
const { generateLorePoster } = require('./lore-generator');
const { generateWorldMapImage } = require('./world-map');
const { generateMissionBoard } = require('./paper-generator');
const { generateMainMenuImage } = require('./menu-generator');
const { generateShopImage, generateDetailedItemCard } = require('./shop-generator');
const { generateSkillListImage } = require('./action-visual-generator');
const { handleFreeAction } = require('./ai-handler');
const { startTutorial } = require('./tutorial-handler');
const { sendWithImage, shouldNotifyPlayer } = require('./message-handler');
const referee = require('./referee-logic');

/**
 * Determines the correct JID (Jabber ID) for the sender of a message.
 */
function getJid(message) {
  if (!message || !message.key) return null;
  if (message.key.remoteJid && message.key.remoteJid.endsWith('@g.us')) {
      return message.key.participant || null;
  }
  return message.key.remoteJid || null;
}


const commands = new Map();

// Command: /ping
commands.set('ping', async (sock, message) => {
    const start = Date.now();
    await sock.sendMessage(message.key.remoteJid, { text: "🏓 *Pong !*" });
    const latency = Date.now() - start;
    console.log(`[DIAG] Ping latency: ${latency}ms`);
});

// Command: /start
commands.set('start', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const replyJid = message.key.remoteJid;

  if (!player) {
    await Player.create({
        whatsappId: jid,
        registrationStep: 'awaiting_name'
    });
    await sock.sendMessage(replyJid, { text: "*Bienvenue dans Aetheris, Héritier...*\n\nLe monde que tu connaissais n'est plus. Les sceaux se brisent, et l'Essence Primordiale s'éveille en toi. Entre la protection des Célestes et la menace des Bestiaux, ta lignée déterminera le futur de l'existence.\n\nTraverse l'Interstice, défie le Roi Vide et forge ton destin dans la matrice d'Aetheris.\n\n*...3_2_1...*\n\n*LINK START!!*\n\nPour commencer, quel est ton nom, Héritier ?" });
  } else if (player.registrationStep) {
    // Resume registration
    if (player.registrationStep === 'awaiting_name') {
        await sock.sendMessage(replyJid, { text: "Rappel: Quel est ton nom, Héritier ?" });
    } else if (player.registrationStep === 'awaiting_gender') {
        await sock.sendMessage(replyJid, { text: "Rappel: Quel est ton sexe, Héritier ?" });
    } else if (player.registrationStep === 'awaiting_age') {
        await sock.sendMessage(replyJid, { text: "Rappel: Quel est ton âge, Héritier ?" });
    } else if (player.registrationStep === 'awaiting_description') {
        await sock.sendMessage(replyJid, { text: `Rappel: Enchanté ${player.name}. Décris ton personnage en une phrase.` });
    }
  } else {
    await sock.sendMessage(replyJid, { text: `« Te revoilà, ${player.name}. L'Interstice s'agite en ton absence... Ne tarde pas trop. »\n\nUtilise /quests pour voir tes objectifs.` });
  }
});

// Command: /quests
// Command: /competences
commands.set('competences', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: Skill });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
        return;
    }

    const query = args.join(' ').toLowerCase();
    let skills = player.Skills;

    if (query) {
        skills = skills.filter(s => s.name.toLowerCase().includes(query) || s.type.toLowerCase().includes(query));
    }

    if (!skills || skills.length === 0) {
        const msg = query ? `Aucune compétence ne correspond à "${query}".` : "Tu ne possèdes aucune compétence pour le moment. Étudie à l'Académie Impériale pour en apprendre !";
        await sock.sendMessage(replyJid, { text: msg });
        return;
    }

    let skillText = `*Compétences de ${player.name}${query ? ' (Filtre: ' + query + ')' : ''}:*\n\n`;

    const activeSkills = skills.filter(s => s.type !== 'passive');
    const passiveSkills = skills.filter(s => s.type === 'passive');

    if (activeSkills.length > 0) {
        skillText += "⚔️ *TECHNIQUES ET SORTS ACTIFS:*\n";
        activeSkills.slice(0, 15).forEach(s => {
            skillText += `├ *${s.name.toUpperCase()}*\n`;
            skillText += `│ 💠 Coût: ${s.manaCost} PM\n`;
            skillText += `└ 📜 ${s.description}\n\n`;
        });
        if (activeSkills.length > 15) skillText += `_... et ${activeSkills.length - 15} autres techniques actives._\n\n`;
    }

    if (passiveSkills.length > 0) {
        skillText += "✨ *COMPÉTENCES PASSIVES:*\n";
        passiveSkills.slice(0, 10).forEach(s => {
            skillText += `├ *${s.name}*\n`;
            skillText += `└ 📜 ${s.description}\n\n`;
        });
        if (passiveSkills.length > 10) skillText += `_... et ${passiveSkills.length - 10} autres passifs._\n\n`;
    }

    if (player.rank === 'S') {
        skillText += "🌌 *EXTENSION DU TERRITOIRE (RANG S):*\n";
        if (player.territoryExtension) {
            skillText += `├ 🔮 Description & Effets Rebalancés:\n`;
            skillText += `└ ${player.territoryExtension}\n\n`;
            skillText += `_Utilise "/extension <effets>" pour redéfinir ton extension._\n\n`;
        } else {
            skillText += `❌ Aucune extension configurée.\n`;
            skillText += `_Utilise "/extension <votre description et vos effets>" pour éveiller ton extension unique ! L'IA supprimera les effets jugés trop "cheatés"._\n\n`;
        }
    }

    skillText += "_Débloque de nouvelles techniques à l'Académie ou via tes Pactes._";

    try {
        const skillBuffer = await generateSkillListImage(player, skills.slice(0, 15));
        await sock.sendMessage(replyJid, { image: skillBuffer, caption: skillText });
    } catch (err) {
        console.error("[Skills] Visual error:", err);
        await sock.sendMessage(replyJid, { text: skillText });
    }
});

commands.set('quests', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: Quest });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
        return;
    }

    const activeQuests = player.Quests.filter(q => q.PlayerQuest.status === 'in_progress');
    const notStartedQuests = player.Quests.filter(q => q.PlayerQuest.status === 'not_started');
    const completedQuests = player.Quests.filter(q => q.PlayerQuest.status === 'completed');

    let questText = '« Le destin n\'est pas écrit, il se forge par le sang et la volonté. »\n\n' +
                    '╔══════════════════════════╗\n' +
                    '   📜 *JOURNAL DES QUÊTES*   \n' +
                    '╚══════════════════════════╝\n\n';

    if (activeQuests.length > 0) {
        questText += '⚔️ *MISSIONS ACTIVES*\n' +
                     activeQuests.map(q => {
                         const progress = q.PlayerQuest.progress || 0;
                         const bar = createStatusBar(progress, 100, '▰', '▱', 8);
                         return `├ *${q.title}*\n` +
                                `│ 📊 Progression : [${bar}] ${progress}%\n` +
                                `│ 🎯 Objectifs : ${q.objective || 'Résoudre l\'énigme ou accomplir la tâche.'}\n` +
                                `│ 🏁 Comment finir : Décris l'accomplissement physique de l'objectif dans tes actions /action. Le MJ d'Aetherys validera automatiquement et t'attribuera les récompenses en temps réel !\n` +
                                `└ 📝 ${q.description}`;
                     }).join('\n\n') + '\n\n';
    }

    if (notStartedQuests.length > 0) {
        questText += '📍 *OBJECTIFS DÉCOUVERTS*\n' +
                     notStartedQuests.map(q => `├ 💠 *${q.title}*\n└ 📝 ${q.description}`).join('\n\n') + '\n\n';
    }

    if (completedQuests.length > 0) {
        questText += '✅ *MISSIONS TERMINÉES*\n' +
                     completedQuests.slice(0, 10).map(q => `├ 🟢 *${q.title}* (Terminée)`).join('\n') + '\n';
        if (completedQuests.length > 10) {
            questText += `└ _... et ${completedQuests.length - 10} autres quêtes complétées._\n`;
        }
        questText += '\n';
    }

    if (activeQuests.length === 0 && notStartedQuests.length === 0 && completedQuests.length === 0) {
        questText += "🌀 *Rien à signaler...*\nExplorez les environs pour trouver du travail, Héritier.";
    }

    questText += '\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

    try {
        if (activeQuests.length > 0) {
            const missionBuffer = await generateMissionBoard(player, activeQuests);
            await sock.sendMessage(replyJid, { image: missionBuffer, caption: questText });
        } else {
            await sock.sendMessage(replyJid, { text: questText });
        }
    } catch (err) {
        console.error("[Quests] Error generating board:", err);
        await sock.sendMessage(replyJid, { text: questText });
    }
});

// Alias mapping
commands.set('quest', commands.get('quests'));


// Helper function to create a status bar
function createStatusBar(current, max, filledChar = '▰', emptyChar = '▱', length = 10) {
    if (max === 0) return emptyChar.repeat(length); // Avoid division by zero
    const percentage = Math.max(0, Math.min(1, current / max));
    const filledCount = Math.round(percentage * length);
    const emptyCount = length - filledCount;
    return filledChar.repeat(filledCount) + emptyChar.repeat(emptyCount);
}


// Command: /profile and /profil
const profileCommand = async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const replyJid = message.key.remoteJid;

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
    return;
  }

  try {
      await player.reload();
      const profileBuffer = await generateProfileCard(player);
      const healthBar = createStatusBar(player.health, player.maxHealth);
      const manaBar = createStatusBar(player.mana, player.maxMana);
      const xpNeeded = player.level * 100;
      const xpBar = createStatusBar(player.xp, xpNeeded);

      const { calculatePlotImpact } = require('./profile-generator');
      const plot = await calculatePlotImpact(player);

      let baseStrength = player.strength;
      let baseAgility = player.agility;
      let baseIntelligence = player.intelligence;
      let baseDefense = player.defense;
      let baseLuck = player.luck;
      let fusionTag = "";

      if (player.fusedWithId) {
          const partner = await Player.findOne({ where: { whatsappId: player.fusedWithId } });
          if (partner) {
              baseStrength = Math.round((player.strength + partner.strength) * 1.30);
              baseAgility = Math.round((player.agility + partner.agility) * 1.30);
              baseIntelligence = Math.round((player.intelligence + partner.intelligence) * 1.30);
              baseDefense = Math.round((player.defense + partner.defense) * 1.30);
              baseLuck = Math.round((player.luck + partner.luck) * 1.30);
              fusionTag = " 🌀 [FUSION +30%]";
          }
      }

      const displayStrength = player.hasAura ? Math.round(baseStrength * 1.5) : baseStrength;
      const displayAgility = player.hasAura ? Math.round(baseAgility * 1.5) : baseAgility;
      const displayIntelligence = player.hasAura ? Math.round(baseIntelligence * 1.5) : baseIntelligence;
      const displayDefense = player.hasAura ? Math.round(baseDefense * 1.5) : baseDefense;
      const displayLuck = player.hasAura ? Math.round(baseLuck * 1.5) : baseLuck;
      const auraTag = player.hasAura ? " ⚡ [AURA BOOST +50%]" : "";

      const profileText = `--- 🆔 GHENO PHONE - PROFIL --- \n\n` +
                          `👤 *HÉRITIER:* ${player.name}\n` +
                          `⚧️ *SEXE:* ${player.gender}\n` +
                          `🎂 *ÂGE:* ${player.age} ans\n` +
                          `👪 *FAMILLE:* ${player.family}\n` +
                          `🎭 *CLASSE:* ${player.class}\n` +
                          `🎖️ *RANG:* ${player.rank}\n` +
                          `📊 *NIVEAU:* ${player.level}\n\n` +
                          `❤️ *VIE:*  [${healthBar}] ${player.health}/${player.maxHealth}\n` +
                          `🔷 *MANA:* [${manaBar}] ${player.mana}/${player.maxMana}\n` +
                          `✨ *XP:*   [${xpBar}] ${player.xp}/${xpNeeded}\n\n` +
                          `--- 👕 APPARENCE & TENUE --- \n` +
                          `👔 Tenue: ${player.equippedOutfit || "Aucun vêtement"}\n` +
                          `🔧 État: ${player.outfitDurability}% Durabilité\n` +
                          `🧼 Propreté: *${(player.outfitCleanliness || 'propre').toUpperCase()}*\n\n` +
                          `--- ⚔️ STATISTIQUES --- \n` +
                          `💪 Force: ${displayStrength}${auraTag}${fusionTag}\n` +
                          `🏃 Agilité: ${displayAgility}${auraTag}${fusionTag}\n` +
                          `🧠 Intelligence: ${displayIntelligence}${auraTag}${fusionTag}\n` +
                          `🛡️ Défense: ${displayDefense}${auraTag}${fusionTag}\n` +
                          `🍀 Chance: ${displayLuck}${auraTag}${fusionTag}\n` +
                          `✨ *SP:* ${player.skillPoints}\n\n` +
                          `💰 *COL:* ${player.col} 🪙\n` +
                          (player.masterId ? `🔗 *MAÎTRE:* ${player.masterId.substring(0, 8)}...\n` : '') +
                          (player.fusedWithId ? `🌀 *FUSION:* Sync ${Math.round(player.fusionSyncLevel * 100)}%\n` : '') +
                          `📍 *LIEU:* ${player.location} (${player.subLocation})\n\n` +
                          `--- 💥 IMPACT DE LA TRAME PRINCIPALE --- \n` +
                          `📖 Effet : *${plot.plotName}*\n` +
                          `└ ${plot.plotDesc}\n` +
                          (Object.keys(plot.modifiers).length > 0 ? `📊 Modificateurs : ${Object.entries(plot.modifiers).map(([s,v]) => `${s.toUpperCase()} : ${v>=0?'+':''}${v}`).join(' • ')}\n` : '') +
                          `---------------------------`;

      await sock.sendMessage(replyJid, {
          image: profileBuffer,
          caption: profileText
      });
  } catch (error) {
      console.error("Erreur génération carte profil:", error);
      const healthBar = createStatusBar(player.health, player.maxHealth);
      const manaBar = createStatusBar(player.mana, player.maxMana);
      const xpNeeded = player.level * 100;
      const xpBar = createStatusBar(player.xp, xpNeeded);

      const profileText = `--- 🆔 GHENO PHONE - PROFIL --- \n\n` +
                          `👤 *JOUEUR:* ${player.name}\n` +
                          `👪 *FAMILLE:* ${player.family}\n` +
                          `🎭 *CLASSE:* ${player.class}\n` +
                          `🎖️ *RANG:* ${player.rank}\n` +
                          `📊 *NIVEAU:* ${player.level}\n\n` +
                          `❤️ *VIE:*  [${healthBar}] ${player.health}/${player.maxHealth}\n` +
                          `🔷 *MANA:* [${manaBar}] ${player.mana}/${player.maxMana}\n` +
                          `✨ *XP:*   [${xpBar}] ${player.xp}/${xpNeeded}\n\n` +
                          `--- ⚔️ STATISTIQUES --- \n` +
                          `💪 Force: ${player.strength}\n` +
                          `🏃 Agilité: ${player.agility}\n` +
                          `🧠 Intelligence: ${player.intelligence}\n` +
                          `🛡️ Défense: ${player.defense}\n` +
                          `🍀 Chance: ${player.luck}\n` +
                          `✨ *SP:* ${player.skillPoints}\n\n` +
                          `💰 *COL:* ${player.col} 🪙\n` +
                          `---------------------------`;

      await sock.sendMessage(replyJid, { text: profileText });
  }
};
commands.set('profile', profileCommand);
commands.set('profil', profileCommand);

commands.set('techniques', (...args) => commands.get('competences')(...args));
commands.set('skills', (...args) => commands.get('competences')(...args));
commands.set('skill', (...args) => commands.get('competences')(...args));

commands.set('extension', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
        return;
    }

    if (player.rank !== 'S') {
        await sock.sendMessage(replyJid, { text: "❌ *Seuls les puissants guerriers et mages de Rang S* peuvent s'éveiller et personnaliser l'Extension du Territoire ! Progressez jusqu'au Rang S pour débloquer ce pouvoir ultime." });
        return;
    }

    const userInput = args.join(' ').trim();
    if (!userInput) {
        await sock.sendMessage(replyJid, { text: "❌ *Usage:* `/extension <description et effets de votre extension du territoire>`\n\nExemple:\n`/extension Une sphère de ténèbres infinies où mon agilité est doublée et les ennemis perdent leur défense.`" });
        return;
    }

    await sock.sendMessage(replyJid, { text: "🌌 *L'Éther vibre... MJ d'AETHERYS analyse et rebalance ton Extension du Territoire pour éliminer les effets cheatés...*" });

    try {
        const { callAI } = require('./ai-utils');
        const systemPrompt = `Tu es le MJ d'Aetherys. Le joueur propose une personnalisation pour son "Extension du Territoire" (Technique suprême de Rang S).
Ton rôle est de réécrire cette extension dans un style Seinen/Shonen ultra-immersif, épique et viscéral, TOUT EN SUPPRIMANT ET REBALANÇANT tout effet abusif ("trop cheaté") comme :
- Mort instantanée (auto-win / OS)
- Invincibilité, immortalité ou immunité totale
- Annulation inconditionnelle des pouvoirs de l'adversaire sans contrepartie majeure
- Stats augmentées au-delà de +30% ou boosts infinis

Tu dois impérativement rebalancer ces abus en effets épiques mais sains pour le jeu de rôle : ex. bonus de combat plafonné à max +30% aux stats clés du lanceur, malus de 15% aux ennemis proches, ou dégâts de zone magiques équilibrés, avec un coût requis de 80 PM.
Garde l'essence thématique et l'esthétique spectaculaire voulue par le joueur (ténèbres, feu, glace, miroirs, etc.), mais rends le gameplay juste et équilibré.
Écris la description finale en français de manière fluide, immersive et directe. Ne mets AUCUN commentaire méta, seulement la description finale de l'extension avec ses effets rebalancés.`;

        const processedText = await callAI(systemPrompt, `Joueur: ${player.name}\nProposition d'extension:\n${userInput}`, { jsonMode: false });

        if (processedText && processedText.trim()) {
            player.territoryExtension = processedText.trim();
            await player.save();

            const responseMsg = `🌌 *ÉVEIL DE L'EXTENSION DU TERRITOIRE :*\n\n` +
                                `_Votre extension a été purifiée de tout abus de puissance par le MJ d'Aetherys et gravée dans votre âme._\n\n` +
                                `🔮 *Description & Effets Rebalancés:*\n${player.territoryExtension}\n\n` +
                                `_Portée de l'extension: 5 mètres. Pour piéger un autre joueur, vous devez être à moins de 5m d'écart (vérifiable via la commande /joueurs ou la distance affichée lors des actions)._`;

            await sock.sendMessage(replyJid, { text: responseMsg });
        } else {
            await sock.sendMessage(replyJid, { text: "❌ Une erreur est survenue lors de l'analyse par le MJ d'Aetherys. Veuillez réessayer avec une description différente." });
        }
    } catch (err) {
        console.error("[Extension] Error:", err);
        await sock.sendMessage(replyJid, { text: "❌ Impossible de formuler l'extension pour le moment. Veuillez réessayer." });
    }
});

// Command: /background
commands.set('background', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    const imageUrl = args[0];
    if (!imageUrl || !imageUrl.startsWith('http')) {
        return await sock.sendMessage(replyJid, { text: "❌ Utilise : `/background <url de l'image>`" });
    }

    try {
        await player.update({ profilePicUrl: imageUrl });
        await sock.sendMessage(replyJid, { text: "🖼️ *Fond de profil mis à jour !* Ton nouveau style est enregistré." });
    } catch (err) {
        console.error("Background update error:", err);
        await sock.sendMessage(replyJid, { text: "❌ Impossible de mettre à jour le fond. Vérifie l'URL." });
    }
});

// Command: /creer_tenue
commands.set('creer_tenue', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    if (player.skillPoints < 1) {
        return await sock.sendMessage(replyJid, { text: "❌ Tu as besoin d'au moins 1 SP pour créer une tenue personnalisée." });
    }

    const outfitName = args.join(' ');
    if (!outfitName) {
        return await sock.sendMessage(replyJid, { text: "❌ Utilise : `/creer_tenue <nom de la tenue>`" });
    }

    await player.decrement('skillPoints', { by: 1 });

    // Create actual Item record for the custom outfit
    const itemName = `Tenue : ${outfitName}`;
    await Item.findOrCreate({
        where: { name: itemName },
        defaults: {
            name: itemName,
            description: `Une tenue sur mesure conçue par ${player.name}.`,
            price: 1000,
            type: 'clothing',
            rarity: 'rare',
            slot: 'chest',
            durability: 100,
            visualData: { color: "#" + Math.floor(Math.random()*16777215).toString(16), style: "custom" }
        }
    });

    let inventory = [...player.inventory];
    inventory.push({ name: itemName, quantity: 1 });
    player.inventory = inventory;
    await player.save();

    await sock.sendMessage(replyJid, { text: `✨ *Tenue créée !* Tu as dépensé 1 SP pour concevoir : ${outfitName}. Elle est maintenant dans ton inventaire.` });
});

// Command: /acheter
commands.set('acheter', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const rawArg = args.join(' ').trim();

    if (!player || !rawArg) return;

    let item = null;

    // Check if the argument is an index between 1 and 50
    const parsedIndex = parseInt(rawArg);
    if (!isNaN(parsedIndex) && parsedIndex >= 1 && parsedIndex <= 50) {
        const viewed = lastViewedItems.get(jid);
        if (viewed && viewed[parsedIndex - 1]) {
            const targetName = viewed[parsedIndex - 1];
            item = await Item.findOne({ where: { name: targetName } });
        }
    }

    // Fallback to fuzzy match by name
    if (!item) {
        item = await Item.findOne({ where: { name: { [Op.like]: `%${rawArg}%` } } });
    }

    if (!item) {
        return await sock.sendMessage(replyJid, { text: `❌ L'objet "${rawArg}" n'est pas disponible en magasin ou cet index n'a pas encore été affiché dans votre /boutique.` });
    }

    if (player.col < item.price) {
        return await sock.sendMessage(replyJid, { text: `❌ Tu n'as pas assez de Col (${item.price} requis).` });
    }

    await player.decrement('col', { by: item.price });

    let inventory = [...player.inventory];
    const existing = inventory.find(i => i.name === item.name);
    if (existing) existing.quantity += 1;
    else inventory.push({ name: item.name, quantity: 1 });

    player.inventory = inventory;
    await player.save();

    try {
        const cardBuffer = await generateDetailedItemCard(item);
        await sock.sendMessage(replyJid, {
            image: cardBuffer,
            caption: `🛒 *ACHAT RÉUSSI !* Tu as acquis *${item.name.toUpperCase()}* pour *${item.price} Col* !\n\nL'arme a été ajoutée à ton inventaire (/inventory). Équipe-la via la description ou l'interface de combat.`
        });
    } catch (err) {
        console.error("[ACHETER] Card render error:", err);
        await sock.sendMessage(replyJid, { text: `🛒 *Achat réussi !* Tu as acheté ${item.name} pour ${item.price} Col.` });
    }
});

// Command: /equiper
commands.set('equiper', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const outfitName = args.join(' ');

    if (!player || !outfitName) return;

    const inventory = player.inventory || [];
    const item = inventory.find(i => i.name.toLowerCase().includes(outfitName.toLowerCase()));

    if (!item) {
        return await sock.sendMessage(replyJid, { text: `❌ Tu ne possèdes pas "${outfitName}" dans ton inventaire.` });
    }

    await player.update({ equippedOutfit: item.name });
    await sock.sendMessage(replyJid, { text: `👗 *Style mis à jour !* Tu portes désormais : ${item.name}.` });
});

// Command: /retirer
commands.set('retirer', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    await player.update({ equippedOutfit: null });
    await sock.sendMessage(replyJid, { text: "👗 *Style mis à jour !* Tu as retiré ta tenue." });
});

// Command: /inspecter
commands.set('inspecter', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;

    // Check for mentions
    const mentionedJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) {
        await sock.sendMessage(replyJid, { text: "Tu dois mentionner un joueur pour l'inspecter (ex: /inspecter @joueur)." });
        return;
    }

    const targetPlayer = await Player.findOne({ where: { whatsappId: mentionedJid } });
    if (!targetPlayer) {
        await sock.sendMessage(replyJid, { text: "Ce joueur n'existe pas ou n'est pas enregistré." });
        return;
    }

    const healthBar = createStatusBar(targetPlayer.health, targetPlayer.maxHealth);
    const manaBar = createStatusBar(targetPlayer.mana, targetPlayer.maxMana);
    const xpNeeded = targetPlayer.level * 100;
    const xpBar = createStatusBar(targetPlayer.xp, xpNeeded);

    const profileText = `--- 🔍 INSPECTION - ${targetPlayer.name} --- \n\n` +
                        `⚧️ *SEXE:* ${targetPlayer.gender}\n` +
                        `🎂 *ÂGE:* ${targetPlayer.age} ans\n` +
                        `👪 *FAMILLE:* ${targetPlayer.family}\n` +
                        `🎭 *CLASSE:* ${targetPlayer.class}\n` +
                        `🎖️ *RANG:* ${targetPlayer.rank}\n` +
                        `📊 *NIVEAU:* ${targetPlayer.level}\n\n` +
                        `❤️ *VIE:*  [${healthBar}] ${targetPlayer.health}/${targetPlayer.maxHealth}\n` +
                        `🔷 *MANA:* [${manaBar}] ${targetPlayer.mana}/${targetPlayer.maxMana}\n` +
                        `✨ *XP:*   [${xpBar}] ${targetPlayer.xp}/${xpNeeded}\n\n` +
                        `📜 *BIO:* ${targetPlayer.characterDescription || 'Aucune description.'}\n\n` +
                        `--- ⚔️ STATISTIQUES --- \n` +
                        `💪 Force: ${targetPlayer.strength}\n` +
                        `🏃 Agilité: ${targetPlayer.agility}\n` +
                        `🧠 Intelligence: ${targetPlayer.intelligence}\n` +
                        `🛡️ Défense: ${targetPlayer.defense}\n` +
                        `🍀 Chance: ${targetPlayer.luck}\n\n` +
                        `📍 *LIEU:* ${targetPlayer.location} (${targetPlayer.subLocation})\n` +
                        `---------------------------`;

    await sock.sendMessage(replyJid, { text: profileText });
});

// Command: /inventory
commands.set('inventory', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const inventory = player.inventory;
    if (inventory.length === 0) {
        await sock.sendMessage(replyJid, { text: "Ton inventaire est vide." });
        return;
    }

    const inventoryText = inventory.map(item => `├ ${item.name} (x${item.quantity})`).join('\n');
    await sock.sendMessage(replyJid, { text: `« Tes possessions ne sont que des outils. C'est ta force qui compte vraiment. »\n\n--- 🎒 INVENTAIRE --- \n\n${inventoryText}\n\n└ _Utilise /action pour utiliser ou équiper un objet._` });
});

// Command: /map
commands.set('map', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

     if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const kingdoms = await Kingdom.findAll();
    const dungeons = await Dungeon.findAll();

    let mapText = `🗺️ *CARTE DU MONDE — AETHERYS*\n\n` +
                  `📍 *Position:* ${player.location} (${player.subLocation})\n\n` +
                  `🌍 *CONTINENTS ET ROYAUMES:*\n`;

    const continents = [...new Set(kingdoms.map(k => k.continent || 'Aetheria'))];
    continents.forEach(cont => {
        mapText += `\n*◈ ${cont.toUpperCase()}*\n`;
        const contKingdoms = kingdoms.filter(k => (k.continent || 'Aetheria') === cont);
        contKingdoms.forEach(k => {
            mapText += `  ├ ${k.name}\n`;
        });
    });

    mapText += `\n🏰 *DUNGEONS RECOMMANDÉS:*\n` +
               dungeons.slice(0, 8).map(d => `├ ${d.name} (Rang ${d.rank})`).join('\n') +
               `\n\n_Le monde s'est étendu. Traversez les mers via le mode /action._`;

    try {
        const mapImage = await generateWorldMapImage();
        await sock.sendMessage(replyJid, { image: mapImage, caption: mapText });
    } catch (err) {
        console.error('[MAP] Échec génération carte:', err.message);
        await sock.sendMessage(replyJid, { text: mapText });
    }
});

// Command: /maison
commands.set('maison', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Houses' });

    if (!player) return;

    if (player.Houses.length === 0) {
        const availableHouses = await House.findAll({ where: { ownerId: null } });
        let text = "🏠 *SYSTÈME IMMOBILIER*\n\nTu ne possèdes aucune propriété. Maisons disponibles à proximité :\n\n";
        availableHouses.forEach(h => {
            text += `├ *${h.name}*\n│ 📍 Lieu: ${h.location}\n│ 💰 Prix: ${h.price} Col\n└ _Utilise /achetermaison ${h.id}_\n\n`;
        });
        return await sock.sendMessage(replyJid, { text });
    }

    const house = player.Houses[0]; // For now, handle one house
    if (args[0] === 'config') {
        const newTheme = args[1] || 'moderne';
        const newColor = args[2] || 'blanc';
        await house.update({ config: { theme: newTheme, color: newColor } });
        return await sock.sendMessage(replyJid, { text: `✅ *Maison configurée !*\nThème: ${newTheme}\nCouleur: ${newColor}` });
    }

    let houseText = `🏠 *TA MAISON : ${house.name}*\n\n`;
    houseText += `🎨 Config: Thème ${house.config.theme}, Couleur ${house.config.color}\n`;
    houseText += `📦 Stockage (${house.storage.length}/20 objets) :\n`;

    if (house.storage.length === 0) {
        houseText += "└ _Vide_";
    } else {
        house.storage.forEach(item => {
            houseText += `├ ${item.name} (x${item.quantity})\n`;
        });
    }

    houseText += "\n\n_Utilise /stocker <objet> ou /recuperer <objet>_";
    await sock.sendMessage(replyJid, { text: houseText });
});

commands.set('achetermaison', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const houseId = parseInt(args[0]);

    if (!player || !houseId) return;

    const house = await House.findByPk(houseId);
    if (!house || house.ownerId) {
        return await sock.sendMessage(replyJid, { text: "❌ Cette maison n'est pas disponible." });
    }

    if (player.col < house.price) {
        return await sock.sendMessage(replyJid, { text: `❌ Tu n'as pas assez de Col (${house.price} requis).` });
    }

    await player.decrement('col', { by: house.price });
    await house.update({ ownerId: player.whatsappId });
    await sock.sendMessage(replyJid, { text: `🎉 *Félicitations !* Tu es maintenant propriétaire de : ${house.name}.` });
});

commands.set('stocker', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Houses' });
    const itemName = args.join(' ');

    if (!player || player.Houses.length === 0 || !itemName) return;

    const house = player.Houses[0];
    let inventory = [...player.inventory];
    const itemIdx = inventory.findIndex(i => i.name.toLowerCase().includes(itemName.toLowerCase()));

    if (itemIdx === -1) return await sock.sendMessage(replyJid, { text: "❌ Objet introuvable dans ton inventaire." });

    const item = inventory[itemIdx];
    let storage = [...house.storage];

    // Add to storage
    const storageIdx = storage.findIndex(i => i.name === item.name);
    if (storageIdx !== -1) storage[storageIdx].quantity += 1;
    else storage.push({ name: item.name, quantity: 1 });

    // Remove from inventory
    if (item.quantity > 1) item.quantity -= 1;
    else inventory.splice(itemIdx, 1);

    await player.update({ inventory });
    await house.update({ storage });
    await sock.sendMessage(replyJid, { text: `📦 *${item.name}* a été déposé dans ton coffre.` });
});

commands.set('recuperer', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Houses' });
    const itemName = args.join(' ');

    if (!player || player.Houses.length === 0 || !itemName) return;

    const house = player.Houses[0];
    let storage = [...house.storage];
    const itemIdx = storage.findIndex(i => i.name.toLowerCase().includes(itemName.toLowerCase()));

    if (itemIdx === -1) return await sock.sendMessage(replyJid, { text: "❌ Objet introuvable dans ta maison." });

    const item = storage[itemIdx];
    let inventory = [...player.inventory];

    // Add to inventory
    const invIdx = inventory.findIndex(i => i.name === item.name);
    if (invIdx !== -1) inventory[invIdx].quantity += 1;
    else inventory.push({ name: item.name, quantity: 1 });

    // Remove from storage
    if (item.quantity > 1) item.quantity -= 1;
    else storage.splice(itemIdx, 1);

    await player.update({ inventory });
    await house.update({ storage });
    await sock.sendMessage(replyJid, { text: `🎒 *${item.name}* a été récupéré dans ton inventaire.` });
});

// Command: /vetements
const vetementsCommand = async (sock, message, args) => {
    if (args.length === 0) {
        const jid = getJid(message);
        const player = await Player.findOne({ where: { whatsappId: jid } });
        let text = "👕 *MODE & VÊTEMENTS D'AETHERYS* 👕\n\n" +
                   "Les vêtements et armures s'usent durant vos combats et se salissent selon vos aventures (boue, poussière, sang).\n" +
                   "Les PNJ et la milice réagissent de manière changeante selon votre apparence !\n\n" +
                   `🔧 *Votre tenue actuelle :* ${player?.equippedOutfit || "Aucune"}\n` +
                   `🧼 *État :* ${player?.outfitDurability || 100}% Durabilité • Propreté: ${(player?.outfitCleanliness || 'propre').toUpperCase()}\n\n` +
                   "🧼 *NETTOYER VOS HABITS :*\n" +
                   "└ Tapez `/laver` (Gratuit près d'une rivière/lac, ou 10 Col en Taverne)\n\n" +
                   "🔨 *RÉPARER VOS HABITS :*\n" +
                   "└ Tapez `/reparer` (50 Col dans une Forge ou Cité)\n\n" +
                   "🛒 *ACHETER DE NOUVELLES TENUES :*\n" +
                   "└ Tapez `/vetements boutique` pour parcourir le catalogue de mode !";
        await sock.sendMessage(message.key.remoteJid, { text });
        return;
    }
    const newArgs = ['clothing', ...args];
    const boutiqueCmd = commands.get('boutique');
    if (boutiqueCmd) {
        await boutiqueCmd(sock, message, newArgs);
    }
};
commands.set('vetements', vetementsCommand);
commands.set('vêtements', vetementsCommand);

// Command: /top
commands.set('top', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const topPlayers = await Player.findAll({
        order: [['level', 'DESC'], ['xp', 'DESC']],
        limit: 10
    });

    let topText = "🏆 *CLASSEMENT DES MEILLEURS HÉRITIERS*\n\n";
    topPlayers.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤';
        topText += `${medal} *${p.name}* (Niv ${p.level})\n└ Rang ${p.rank} • ${p.class}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: topText });
});

// Command: /up
commands.set('up', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    if (args.length === 0) {
        let text = `--- 📈 AMÉLIORATION DES STATS --- \n\n`;
        text += `✨ Points de Compétence (SP) dispos : *${player.skillPoints}*\n\n`;
        text += `Utilise \`/up <stat> <points>\` pour augmenter tes stats :\n`;
        text += `- *FOR* (Force)\n`;
        text += `- *AGI* (Agilité)\n`;
        text += `- *INT* (Intelligence)\n`;
        text += `- *DEF* (Défense)\n`;
        text += `- *LUK* (Chance)\n\n`;
        text += `Exemple : \`/up for 5\``;
        return await sock.sendMessage(replyJid, { text });
    }

    const statMap = {
        'for': 'strength', 'force': 'strength', 'strength': 'strength',
        'agi': 'agility', 'agilité': 'agility', 'agility': 'agility',
        'int': 'intelligence', 'intelligence': 'intelligence',
        'def': 'defense', 'défense': 'defense', 'defense': 'defense',
        'luk': 'luck', 'chance': 'luck', 'luck': 'luck'
    };

    const requestedStat = args[0]?.toLowerCase();
    const targetStat = statMap[requestedStat];
    const points = parseInt(args[1]) || 1;

    if (!targetStat) {
        return await sock.sendMessage(replyJid, { text: "❌ Statistique invalide. Choisis entre FOR, AGI, INT, DEF, LUK." });
    }

    if (player.skillPoints < points) {
        return await sock.sendMessage(replyJid, { text: `❌ Tu n'as pas assez de SP. Il te manque ${points - player.skillPoints} SP.` });
    }

    if (points <= 0) {
        return await sock.sendMessage(replyJid, { text: "❌ Le nombre de points doit être supérieur à 0." });
    }

    await player.decrement('skillPoints', { by: points });
    await player.increment(targetStat, { by: points });
    await player.reload();

    const newVal = player[targetStat];
    const statName = requestedStat.toUpperCase();

    await sock.sendMessage(replyJid, { text: `✅ *Amélioration réussie !*\n\n${statName} : +${points} ➔ *${newVal}*\nSP restants : ${player.skillPoints}` });
});

// Command: /boutique
commands.set('boutique', async (sock, message, args) => {
    const replyJid = message.key.remoteJid;
    let page = 1;
    let filterType = null; // 'weapon', 'clothing', or null (all)
    let searchKeyword = null;

    if (args && args.length > 0) {
        // Try to parse last argument as page number
        const lastArg = args[args.length - 1];
        const parsedPage = parseInt(lastArg);
        if (!isNaN(parsedPage) && parsedPage > 0) {
            page = parsedPage;
            args.pop(); // remove page from args to treat the rest as search/type
        }
    }

    if (args && args.length > 0) {
        const fullKeyword = args.join(' ').toLowerCase().trim();
        // Check if keyword is a type shortcut
        if (['weapon', 'weapons', 'arme', 'armes', 'armement', 'forge', 'brokk'].includes(fullKeyword)) {
            filterType = 'weapon';
        } else if (['clothing', 'clothes', 'vetement', 'vêtement', 'vetements', 'vêtements', 'mode'].includes(fullKeyword)) {
            filterType = 'clothing';
        } else {
            // General search keyword
            searchKeyword = fullKeyword;
        }
    }

    const whereClause = {};
    if (filterType) {
        whereClause.type = filterType;
    }
    if (searchKeyword) {
        whereClause[Op.or] = [
            { name: { [Op.like]: `%${searchKeyword}%` } },
            { description: { [Op.like]: `%${searchKeyword}%` } },
            { rarity: { [Op.like]: `%${searchKeyword}%` } }
        ];
    }

    const limit = 8;
    const offset = (page - 1) * limit;

    try {
        const { count, rows: items } = await Item.findAndCountAll({
            where: whereClause,
            order: [['price', 'ASC']],
            limit,
            offset
        });

        if (count === 0) {
            return await sock.sendMessage(replyJid, { text: `❌ Aucun article trouvé pour votre recherche "${searchKeyword || filterType || 'Boutique entière'}".` });
        }

        // Save listed items to track for quick index-based purchase
        const jid = getJid(message);
        lastViewedItems.set(jid, items.map(i => i.name));

        const totalPages = Math.ceil(count / limit);
        if (page > totalPages) {
            return await sock.sendMessage(replyJid, { text: `❌ Page ${page} inexistante. Le catalogue contient un maximum de ${totalPages} pages pour cette recherche.` });
        }

        // Determine catalogue title
        let catalogTitle = "FORGE DE BROKK";
        if (filterType === 'clothing') {
            catalogTitle = "MODE AETHERYS";
        } else if (searchKeyword) {
            catalogTitle = `RÉSULTATS : ${searchKeyword.toUpperCase()}`;
        } else if (!filterType) {
            catalogTitle = "CATALOGUE IMPÉRIAL";
        }

        const shopImageBuffer = await generateShopImage(catalogTitle, items);

        // Build premium caption with pagination and navigation details
        let caption = `🛒 *${catalogTitle}* (Page ${page}/${totalPages})\n`;
        if (filterType) {
            caption += `✨ Catégorie : *${filterType === 'weapon' ? 'Armes de Guerre' : 'Équipements & Vêtements'}*\n`;
        } else if (searchKeyword) {
            caption += `🔍 Recherche : *"${searchKeyword}"*\n`;
        }
        caption += `📊 Total : *${count.toLocaleString()}* articles légendaires dans la base de données !\n\n`;
        caption += `💡 *Astuce de navigation :*\n`;
        caption += `Utilisez \`/boutique [recherche/catégorie] [page]\` pour feuilleter les milliers d'armes.\n`;
        caption += `├ Ex: \`/boutique arme 2\`\n`;
        caption += `├ Ex: \`/boutique vetement 1\`\n`;
        caption += `├ Ex: \`/boutique dague\`\n`;
        caption += `└ Ex: \`/boutique legendary 1\`\n\n`;
        caption += `👉 Tapez \`/acheter [nom de l'arme]\` pour commander.`;

        await sock.sendMessage(replyJid, {
            image: shopImageBuffer,
            caption: caption
        });
    } catch (err) {
        console.error("Shop pagination / image error:", err);
        await sock.sendMessage(replyJid, { text: "❌ Erreur lors de la génération du catalogue visuel paginé." });
    }
});

// Command: /lieux
commands.set('lieux', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) return;

    const kingdom = await Kingdom.findOne({ where: { name: player.location } });

    let text = `--- 📍 POSITION ACTUELLE --- \n\n`;
    text += `🌍 *Royaume:* ${player.location}\n`;
    text += `📌 *Lieu précis:* ${player.subLocation}\n\n`;

    if (kingdom) {
        text += `📜 *Description du Royaume:*\n${kingdom.description}\n\n`;
    }

    text += `🗺️ *Où aller ?*\n`;
    text += `_Tu peux te déplacer librement via /action en décrivant ton trajet._\n`;
    text += `_Exemple: "Je sors de la taverne pour aller sur la place centrale" ou "Je quitte la ville vers les plaines"._`;

    await sock.sendMessage(replyJid, { text });
});

// Command: /joueurs
commands.set('joueurs', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const otherPlayers = await Player.findAll({
        where: {
            location: player.location,
            whatsappId: { [Op.ne]: jid }
        }
    });

    if (otherPlayers.length === 0) {
        await sock.sendMessage(replyJid, { text: `Tu es seul ici à ${player.location}.` });
        return;
    }

    const { getDistanceInMeters } = require('./utils');

    let playersText = `--- 👥 HÉRITIERS À PROXIMITÉ --- \n\n`;
    otherPlayers.forEach(p => {
        const dist = getDistanceInMeters(player, p);
        const canTerritory = dist <= 5;
        playersText += `*${p.name}*\n`;
        playersText += `├ 📏 Distance: *${dist} mètres* ${canTerritory ? '🟢 (Assez proche pour une Extension du Territoire !)' : '🔴 (Trop loin pour l\'Extension du Territoire, max 5m)'}\n`;
        playersText += `├ 📍 ${p.subLocation}\n`;
        playersText += `├ 👪 Famille: ${p.family}\n`;
        playersText += `├ 🎭 Classe: ${p.class} | 📊 Niveau: ${p.level}\n`;
        playersText += `├ 🎖️ Rang: ${p.rank}\n`;
        playersText += `└ 📜 Bio: ${p.characterDescription || '...'}\n\n`;
    });
    playersText += "_Utilise /action pour interagir avec eux._";

    await sock.sendMessage(replyJid, { text: playersText });
});

// Command: /royaumes
commands.set('royaumes', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { Kingdom } = require('./database');
    const kingdoms = await Kingdom.findAll();

    let text = "--- 🏰 ROYAUMES D'AETHERYS --- \n\n";
    kingdoms.forEach(k => {
        text += `*${k.name.toUpperCase()}*\n`;
        text += `├ 👑 Leader: ${k.leader}\n`;
        text += `├ ⚔️ Force Militaire: ${k.militaryPower}\n`;
        text += `├ 📊 Influence: ${k.influence}\n`;
        text += `└ 📜 ${k.description}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /pacts
commands.set('pacts', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Entities' });

    if (!player) return;

    const entities = await Entity.findAll();
    const playerEntities = player.Entities || [];

    let text = "--- ✨ PACTES ET ENTITÉS --- \n\n";

    if (playerEntities.length > 0) {
        text += "*Tes Pactes Actifs:*\n";
        playerEntities.forEach(e => {
            text += `🔥 *${e.name}* (${e.type})\n└ Pouvoir: ${e.power}\n`;
        });
        text += "\n";
    }

    text += "*Entités Connues d'Aetherys:*\n";
    entities.forEach(e => {
        const isLinked = playerEntities.some(pe => pe.id === e.id);
        text += `${isLinked ? '✅' : '❓'} *${e.name}* (${e.type})\n`;
        text += `├ 📜 ${e.description}\n`;
        text += `└ ✨ Bonus: ${JSON.stringify(e.pactBonus)}\n\n`;
    });

    text += "_Pour forger un pacte, trouve l'entité via /action._";

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /clubs
commands.set('clubs', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid }, include: 'Clubs' });

    if (!player) return;

    const clubs = await Club.findAll();
    const playerClubs = player.Clubs || [];

    let text = "--- 🏫 CLUBS DE L'ACADÉMIE --- \n\n";

    if (playerClubs.length > 0) {
        text += "*Tes Clubs:*\n";
        playerClubs.forEach(c => {
            text += `🔹 *${c.name}* (${c.PlayerClub.rank})\n`;
        });
        text += "\n";
    }

    text += "*Clubs Extrascolaires:*\n";
    clubs.forEach(c => {
        const isMember = playerClubs.some(pc => pc.id === c.id);
        text += `${isMember ? '✅' : '⚪'} *${c.name.toUpperCase()}*\n`;
        text += `├ 🧪 Spécialité: ${c.specialty}\n`;
        text += `├ 👑 Leader: ${c.leaderName}\n`;
        text += `└ 📜 ${c.description}\n\n`;
    });

    text += "_Rejoins un club via /action en parlant au leader._";

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /ecoles
commands.set('ecoles', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { School } = require('./database');
    const schools = await School.findAll();

    let text = "--- 🏫 ACADÉMIES D'AETHERYS --- \n\n";
    schools.forEach(s => {
        text += `*${s.name.toUpperCase()}*\n`;
        text += `├ 🧪 Spécialité: ${s.specialty}\n`;
        text += `├ 📍 Royaume: ${s.kingdomName}\n`;
        text += `└ 📜 ${s.description}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /examens
commands.set('examens', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    const academicSuffix = player.academicYear === 1 ? 'ère' : 'ème';
    let text = "--- 📝 DOSSIER ACADÉMIQUE --- \n\n";
    text += `👤 *Élève:* ${player.name}\n`;
    text += `🎓 *Année:* ${player.academicYear}${academicSuffix} Année\n`;
    text += `🏫 *École:* ${player.schoolName}\n`;
    text += `📊 *Moyenne Générale:* ${player.academicGrade}/100\n\n`;
    text += `_Les examens de ${player.academicYear}${academicSuffix} année se passent via /action (écriture sur copie)._`;

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /god
commands.set('god', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    // Handle claiming God status with code
    if (args[0] === '201148') {
        await player.update({ isGod: true });
        await sock.sendMessage(replyJid, { text: "Lien établi. Tu es désormais reconnu comme une entité divine dans la matrice d'Aetherys." });
        return;
    }

    if (!player.isGod) {
        await sock.sendMessage(replyJid, { text: "Seuls les êtres supérieurs possèdent ces pouvoirs. Utilise le code d'accès si tu en as un." });
        return;
    }

    const subCommand = args.shift()?.toLowerCase();

    if (!subCommand) {
        await sock.sendMessage(replyJid, { text: "Commandes Divines:\n/god set [@joueur] <stat> <valeur>\n/god give [@joueur] <item> <quantité>\n/god rank [@joueur] <rang>\n/god col [@joueur] <montant>\n/god pacte [@joueur] <entité>\n/god max [@joueur]\n/god settoken <key>\n\n(Si aucun joueur n'est mentionné, l'effet s'applique à toi-même)" });
        return;
    }

    let targetPlayer = null;
    let targetJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    // Helper to find player by name if no mention or ID
    const findByAny = async (str) => {
        if (!str) return null;
        const clean = str.replace('@', '').trim();
        return await Player.findOne({
            where: {
                [Op.or]: [
                    { whatsappId: clean },
                    { whatsappId: clean + '@s.whatsapp.net' },
                    { name: { [Op.like]: `%${clean}%` } }
                ]
            }
        });
    };

    // Subcommands that don't need a player target
    if (subCommand === 'settoken') {
        const newToken = args[0];
        if (newToken) {
            process.env.PUTER_TOKEN = newToken;
            process.env.PUTER_API_KEY = newToken;
            const { JSDOM } = require('jsdom');
            const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
            global.window = dom.window;
            global.document = dom.window.document;
            try {
                const puterLib = require('@heyputer/puter.js');
                const puter = puterLib.default || puterLib;
                if (typeof puter.setAuthToken === 'function') puter.setAuthToken(newToken);
                puter.authToken = newToken;
            } catch(e) {}
            await sock.sendMessage(replyJid, { text: "✅ [GOD] PUTER_TOKEN mis à jour." });
        }
        return;
    }

    // Logic to detect target
    const needsTarget = ['set', 'give', 'rank', 'col', 'pacte', 'max', 'res', 'ressusciter'].includes(subCommand);
    if (needsTarget) {
        if (targetJid) {
            targetPlayer = await Player.findOne({ where: { whatsappId: targetJid } });
        } else {
            // Try to find a player by joining progressive arguments to support names with spaces
            // e.g. ["singam", "ii", "force", "100"]
            for (let len = Math.min(args.length, 3); len >= 1; len--) {
                const candidateName = args.slice(0, len).join(' ');
                const candidate = await findByAny(candidateName);
                if (candidate) {
                    targetPlayer = candidate;
                    args = args.slice(len); // Consume the resolved target name arguments
                    break;
                }
            }
        }
    }

    // Default to self if still no target
    if (!targetPlayer) {
        targetPlayer = player;
    }
    if (!targetPlayer) return;

    const statNormalizationMap = {
        'force': 'strength', 'for': 'strength', 'str': 'strength',
        'agilité': 'agility', 'agi': 'agility',
        'intelligence': 'intelligence', 'int': 'intelligence',
        'défense': 'defense', 'def': 'defense',
        'chance': 'luck', 'luk': 'luck',
        'vie': 'health', 'pv': 'health', 'hp': 'health',
        'mana': 'mana', 'pm': 'mana', 'mp': 'mana',
        'sp': 'skillPoints', 'skillpoints': 'skillPoints',
        'xp': 'xp', 'exp': 'xp',
        'niv': 'level', 'niveau': 'level', 'lvl': 'level'
    };

    switch (subCommand) {
        case 'set':
            let stat = args[0]?.toLowerCase();
            stat = statNormalizationMap[stat] || stat;
            const value = parseInt(args[1]);
            if (stat && !isNaN(value)) {
                await targetPlayer.update({ [stat]: value });
                await targetPlayer.reload();
                await sock.sendMessage(replyJid, { text: `✅ [GOD] ${targetPlayer.name} : ${stat} fixé à ${value}.` });
            }
            break;
        case 'give':
            const itemName = args.slice(0, -1).join(' ');
            const qty = parseInt(args[args.length - 1]);
            if (itemName && !isNaN(qty)) {
                let inv = [...targetPlayer.inventory];
                inv.push({ name: itemName, quantity: qty });
                targetPlayer.inventory = inv;
                await targetPlayer.save();
                await sock.sendMessage(replyJid, { text: `${targetPlayer.name} a reçu ${qty}x ${itemName} par décret divin.` });
            }
            break;
        case 'rank':
            const newRank = args[0];
            if (newRank) {
                await targetPlayer.update({ rank: newRank });
                await sock.sendMessage(replyJid, { text: `Le rang de ${targetPlayer.name} a été changé en ${newRank} par la grâce d'Eoza.` });
            }
            break;
        case 'col':
            const amount = parseInt(args[0]);
            if (!isNaN(amount)) {
                if (amount >= 0) await targetPlayer.increment('col', { by: amount });
                else await targetPlayer.decrement('col', { by: Math.abs(amount) });
                await targetPlayer.reload();
                await sock.sendMessage(replyJid, { text: `✅ [GOD] ${targetPlayer.name} : ${amount} Col ${amount >= 0 ? 'ajoutés' : 'retirés'}.` });
            }
            break;
        case 'pacte':
            const entityName = args.join(' ');
            if (entityName) {
                const entity = await Entity.findOne({ where: { name: { [Op.like]: `%${entityName}%` } } });
                if (entity) {
                    await targetPlayer.addEntity(entity);
                    const bonuses = entity.pactBonus || {};
                    for (const [stat, value] of Object.entries(bonuses)) {
                        if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                            await targetPlayer.increment(stat, { by: value });
                        }
                    }
                    await targetPlayer.save();
                    await targetPlayer.reload();
                    await sock.sendMessage(replyJid, { text: `🔥 *Pacte divin établi !* ${targetPlayer.name} est désormais lié à ${entity.name}.` });
                } else {
                    await sock.sendMessage(replyJid, { text: `❌ Entité "${entityName}" introuvable.` });
                }
            }
            break;
        case 'max':
            await targetPlayer.update({
                strength: 999,
                agility: 999,
                intelligence: 999,
                defense: 999,
                luck: 999,
                level: 100,
                health: 9999,
                maxHealth: 9999,
                mana: 9999,
                maxMana: 9999,
                rank: 'S'
            });
            await sock.sendMessage(replyJid, { text: `La puissance absolue a été accordée à ${targetPlayer.name}.` });
            break;
        case 'res':
        case 'ressusciter':
            await targetPlayer.update({
                health: targetPlayer.maxHealth,
                location: "Empire Impérial d'Elion",
                subLocation: "Eldoria"
            });
            await targetPlayer.reload();
            await sock.sendMessage(replyJid, { text: `👼 [GOD] *RESURRECTION !* ${targetPlayer.name} a été ressuscité et ramené à Eldoria par décret divin ! Ses points de vie sont entièrement restaurés.` });
            break;
    }
});

// Command: /tournoi
commands.set('tournoi', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const participants = await TournamentParticipant.findAll();

    let text = "--- 🏆 GRAND TOURNOI D'AETHERYS --- \n\n";
    text += "Le Tournoi Inter-Écoles a lieu une fois par an.\n\n";
    text += `👥 *Inscrits:* ${participants.length}\n`;
    text += "⚔️ *Format:* Duels 1v1 par rangs.\n\n";

    if (participants.length > 0) {
        text += "*Participants Actuels:*\n";
        participants.forEach(p => {
            text += `├ ${p.playerName} (Rang ${p.rank}) - ${p.status}\n`;
        });
        text += "\n";
    }

    text += "🎁 *Récompenses:* Équipement légendaire, Col.\n\n";
    text += "👉 Utilise `/inscription_tournoi` pour participer !\n";
    text += "_Le tirage au sort sera effectué par les Administrateurs._";

    await sock.sendMessage(replyJid, { text: text });
});

commands.set('inscription_tournoi', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    const existing = await TournamentParticipant.findByPk(jid);
    if (existing) {
        return await sock.sendMessage(replyJid, { text: "❌ Tu es déjà inscrit au tournoi." });
    }

    await TournamentParticipant.create({
        playerJid: jid,
        playerName: player.name,
        rank: player.rank
    });

    await sock.sendMessage(replyJid, { text: `✅ *Inscription réussie !* Bonne chance pour le tournoi, ${player.name}.` });
});

commands.set('tirage_tournoi', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player || !player.isGod) {
        return await sock.sendMessage(replyJid, { text: "Seuls les administrateurs peuvent lancer le tirage." });
    }

    let participants = await TournamentParticipant.findAll({ where: { status: 'registered' } });

    if (participants.length === 0) {
        return await sock.sendMessage(replyJid, { text: "Aucun participant inscrit pour le moment." });
    }

    // Ensure even number by adding NPC
    if (participants.length % 2 !== 0) {
        const npcNames = ["Kaelith l'Invocatrice", "Guerrier d'Élite d'Elion", "Apprenti de Nécropolis", "Gardien du Vide"];
        const npcName = npcNames[Math.floor(Math.random() * npcNames.length)];
        const newNpc = await TournamentParticipant.create({
            playerJid: `npc_${Date.now()}`,
            playerName: `[PNJ] ${npcName}`,
            rank: 'B',
            status: 'registered'
        });
        participants.push(newNpc);
    }

    // Shuffle
    participants = participants.sort(() => Math.random() - 0.5);

    let drawText = "--- ⚔️ TIRAGE AU SORT DU TOURNOI --- \n\n";
    for (let i = 0; i < participants.length; i += 2) {
        const p1 = participants[i];
        const p2 = participants[i+1];

        await p1.update({ opponentJid: p2.playerJid, status: 'qualified' });
        await p2.update({ opponentJid: p1.playerJid, status: 'qualified' });

        drawText += `🔥 Match ${Math.floor(i/2) + 1} :\n*${p1.playerName}*  VS  *${p2.playerName}*\n\n`;
    }

    drawText += "_Les duels peuvent commencer via /action !_";
    await sock.sendMessage(replyJid, { text: drawText });
});

// Command: /conflits
commands.set('conflits', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { Conflict } = require('./database');
    const conflicts = await Conflict.findAll({ where: { status: 'active' } });

    if (conflicts.length === 0) {
        await sock.sendMessage(replyJid, { text: "Le monde est actuellement en paix... une paix fragile." });
        return;
    }

    let text = "--- 🛡️ ÉTAT DES CONFLITS --- \n\n";
    conflicts.forEach(c => {
        text += `*${c.title.toUpperCase()}*\n`;
        const involved = Array.isArray(c.involvedKingdoms) ? c.involvedKingdoms.join(', ') : c.involvedKingdoms;
        text += `├ ⚔️ Belligérants: ${involved}\n`;
        text += `└ 📜 ${c.description}\n\n`;
    });

    await sock.sendMessage(replyJid, { text: text });
});

// Command: /bank
const bankCommand = async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const [bank, created] = await Bank.findOrCreate({ where: { PlayerWhatsappId: player.whatsappId } });
    await bank.reload();

    const bankText = `--- 🏦 BANQUE D'ELION --- \n\n` +
                     `👤 *CLIENT:* ${player.name}\n` +
                     `💰 *ESPÈCES:* ${player.col} 🪙\n` +
                     `💳 *SOLDE BANCAIRE:* ${bank.balance} 🪙\n\n` +
                     `--------------------------- \n` +
                     `💡 *COMMANDES:* \n` +
                     `└ \`/deposer <montant>\` \n` +
                     `└ \`/retirer <montant>\` \n\n` +
                     `_Tu peux aussi demander au MJ en mode /action._`;

    await sock.sendMessage(replyJid, { text: bankText });
};
commands.set('bank', bankCommand);
commands.set('banque', bankCommand);

// Command: /deposer
commands.set('deposer', async (sock, message, args) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) return;

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
        return await sock.sendMessage(replyJid, { text: "❌ Utilise : `/deposer <montant>`" });
    }

    if (player.col < amount) {
        return await sock.sendMessage(replyJid, { text: `❌ Tu n'as pas assez de Col sur toi (${player.col} Col dispos).` });
    }

    const [bank] = await Bank.findOrCreate({ where: { PlayerWhatsappId: jid } });

    await player.decrement('col', { by: amount });
    await bank.increment('balance', { by: amount });

    await player.reload();
    await bank.reload();

    await sock.sendMessage(replyJid, {
        text: `🏦 *DÉPÔT RÉUSSI*\n\nMontant : ${amount} Col\nNouveau solde : ${bank.balance} Col\nEspèces restantes : ${player.col} Col`
    });
});

// Command: /retirer
commands.set('retirer', async (sock, message, args) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) return;

    const [bank] = await Bank.findOrCreate({ where: { PlayerWhatsappId: jid } });
    await bank.reload();

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
        return await sock.sendMessage(replyJid, { text: "❌ Utilise : `/retirer <montant>`" });
    }

    if (bank.balance < amount) {
        return await sock.sendMessage(replyJid, { text: `❌ Ton solde bancaire est insuffisant (${bank.balance} Col dispos).` });
    }

    await bank.decrement('balance', { by: amount });
    await player.increment('col', { by: amount });

    await player.reload();
    await bank.reload();

    await sock.sendMessage(replyJid, {
        text: `🏦 *RETRAIT RÉUSSI*\n\nMontant : ${amount} Col\nNouveau solde : ${bank.balance} Col\nEspèces sur toi : ${player.col} Col`
    });
});

// Command: /donner
commands.set('donner', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const mentionedJid = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) {
        await sock.sendMessage(replyJid, { text: "Tu dois mentionner un joueur pour lui donner quelque chose (ex: /donner @joueur 100 col)." });
        return;
    }

    const targetPlayer = await Player.findOne({ where: { whatsappId: mentionedJid } });
    if (!targetPlayer) {
        await sock.sendMessage(replyJid, { text: "Ce joueur n'existe pas." });
        return;
    }

    if (player.location !== targetPlayer.location || player.subLocation !== targetPlayer.subLocation) {
        await sock.sendMessage(replyJid, { text: "Tu dois être juste à côté du joueur pour lui donner quelque chose." });
        return;
    }

    const amountIndex = args.findIndex(arg => !isNaN(parseInt(arg)));
    const amount = amountIndex !== -1 ? parseInt(args[amountIndex]) : 0;
    const isCol = args.some(arg => arg.toLowerCase() === 'col' || arg.toLowerCase() === 'cols');

    if (isCol && amount > 0) {
        if (player.col < amount) {
            await sock.sendMessage(replyJid, { text: "Tu n'as pas assez de Col." });
            return;
        }

        await player.decrement('col', { by: amount });
        await targetPlayer.increment('col', { by: amount });

        await sock.sendMessage(replyJid, { text: `Tu as donné ${amount} Col à ${targetPlayer.name}.` });
        if (shouldNotifyPlayer(targetPlayer)) {
            await sock.sendMessage(mentionedJid, { text: `💰 ${player.name} t'a donné ${amount} Col !` });
        }
        return;
    }

    // Giving items
    const itemName = args.filter(arg => isNaN(parseInt(arg)) && !['col', 'cols'].includes(arg.toLowerCase()) && !arg.startsWith('@')).join(' ');
    if (itemName) {
        let inventory = [...player.inventory];
        const itemIndex = inventory.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());

        if (itemIndex === -1) {
            await sock.sendMessage(replyJid, { text: `Tu n'as pas d'objet nommé "${itemName}" dans ton inventaire.` });
            return;
        }

        const quantity = amount > 0 ? amount : 1;
        if (inventory[itemIndex].quantity < quantity) {
            await sock.sendMessage(replyJid, { text: `Tu n'as pas assez de "${itemName}".` });
            return;
        }

        // Remove from sender
        inventory[itemIndex].quantity -= quantity;
        if (inventory[itemIndex].quantity <= 0) {
            inventory.splice(itemIndex, 1);
        }
        player.inventory = inventory;
        await player.save();

        // Add to receiver
        let targetInventory = [...targetPlayer.inventory];
        const targetItemIndex = targetInventory.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (targetItemIndex !== -1) {
            targetInventory[targetItemIndex].quantity += quantity;
        } else {
            targetInventory.push({ name: itemName, quantity: quantity });
        }
        targetPlayer.inventory = targetInventory;
        await targetPlayer.save();

        await sock.sendMessage(replyJid, { text: `Tu as donné ${quantity}x ${itemName} à ${targetPlayer.name}.` });
        if (shouldNotifyPlayer(targetPlayer)) {
            await sock.sendMessage(mentionedJid, { text: `🎒 ${player.name} t'a donné ${quantity}x ${itemName} !` });
        }

        // Handle stat changes if it's an item with bonuses
        const itemData = await Item.findOne({ where: { name: { [Op.like]: `%${itemName}%` } } });
        if (itemData) {
            const bonuses = itemData.statBonuses;
            for (const [stat, value] of Object.entries(bonuses)) {
                if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
                    await player.decrement(stat, { by: value * quantity });
                    await targetPlayer.increment(stat, { by: value * quantity });
                }
            }
        }
    } else {
        await sock.sendMessage(replyJid, { text: "Spécifie ce que tu veux donner (ex: /donner @joueur 100 col OU /donner @joueur Épée)." });
    }
});


// Command: /statut
commands.set('statut', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Commence le jeu avec /start." });
        return;
    }

    const inventory = player.inventory;
    const equipped = {
        head: false,
        chest: false,
        arms: false,
        legs: false,
        weapon: false
    };

    // For each item in inventory, check if it's in the DB and get its slot
    // Optimization: find all items from DB that are in inventory
    const itemNames = inventory.map(i => i.name);
    const dbItems = await Item.findAll({ where: { name: { [Op.in]: itemNames } } });

    dbItems.forEach(item => {
        if (equipped[item.slot] !== undefined) {
            equipped[item.slot] = true;
        }
    });

    try {
        const imageBuffer = await generateEquipmentStatusImage(equipped);
        let caption = `*État de l'équipement de ${player.name}*\n\n`;
        caption += `🟢 Protégé | ⚪ Non protégé\n\n`;
        caption += `${equipped.head ? '🟢' : '⚪'} Tête\n`;
        caption += `${equipped.chest ? '🟢' : '⚪'} Torse\n`;
        caption += `${equipped.arms ? '🟢' : '⚪'} Bras\n`;
        caption += `${equipped.legs ? '🟢' : '⚪'} Jambes\n`;
        caption += `${equipped.weapon ? '⚔️' : '⚪'} Arme\n`;

        await sock.sendMessage(replyJid, {
            image: imageBuffer,
            caption: caption
        });
    } catch (error) {
        console.error("Erreur génération statut visuel:", error);
        await sock.sendMessage(replyJid, { text: "Impossible de générer le visuel de l'équipement." });
    }
});

// Command: /dbbackup
commands.set('dbbackup', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player || !player.isGod) {
        await sock.sendMessage(replyJid, { text: "Seuls les dieux peuvent extraire l'essence de la matrice." });
        return;
    }

    try {
        const models = sequelize.models;
        const backup = {};
        for (const [name, model] of Object.entries(models)) {
            backup[name] = await model.findAll();
        }

        const backupPath = path.join(__dirname, `backup_${Date.now()}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

        await sock.sendMessage(replyJid, {
            document: { url: backupPath },
            mimetype: 'application/json',
            fileName: 'Aetherys_Matrix_Backup.json',
            caption: "💾 *BACKUP DE LA MATRICE RÉUSSI*"
        });

        fs.unlinkSync(backupPath);
    } catch (error) {
        console.error("Backup error:", error);
        await sock.sendMessage(replyJid, { text: "Erreur lors de la création du backup." });
    }
});

// Command: /dbrestore
commands.set('dbrestore', async (sock, message, args, downloadMediaMessage) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player || !player.isGod) {
        await sock.sendMessage(replyJid, { text: "Seuls les dieux peuvent réécrire la matrice." });
        return;
    }

    const docMessage = message.message.documentMessage || message.message.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;

    if (!docMessage) {
        await sock.sendMessage(replyJid, { text: "Envoie ou cite un fichier JSON de backup pour restaurer la matrice." });
        return;
    }

    try {
        const targetMessage = message.message.documentMessage ? message : { message: message.message.extendedTextMessage.contextInfo.quotedMessage };
        const buffer = await downloadMediaMessage(targetMessage, 'buffer');
        const backup = JSON.parse(buffer.toString());

        await sequelize.transaction(async (t) => {
            for (const [name, data] of Object.entries(backup)) {
                const model = sequelize.models[name];
                if (model) {
                    await model.destroy({ where: {}, transaction: t });
                    await model.bulkCreate(data, { transaction: t });
                }
            }
        });

        await sock.sendMessage(replyJid, { text: "✅ *MATRICE RESTAURÉE AVEC SUCCÈS*" });
    } catch (error) {
        console.error("Restore error:", error);
        await sock.sendMessage(replyJid, { text: "Erreur lors de la restauration : " + error.message });
    }
});

// Command: /lore
commands.set('lore', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const topic = args.join(' ').trim();

    if (!topic) {
        const categories = `📚 *BIBLIOTHÈQUE D'AETHERYS*\n\nUtilise \`/lore <nom>\` pour lire une archive en texte.\n\nEntrées conseillées :\n- *Origines* : One Above All, Idee du Mal\n- *Mysteres* : Beherit, Apotres, Interstice\n- *Evenements* : Histoire, Convergence, Missions historiques\n- *Societe* : Aetherys, Academie, Clubs\n- *Royaumes* : Elion, Valkyr, Necropolis`;
        return await sock.sendMessage(replyJid, { text: categories });
    }

    await sock.sendMessage(replyJid, { text: "🔍 _Recherche dans les archives d'Aetherys..._" });

    let loreData = null;
    let type = 'LORE';

    // Search in Entities
    const entity = await Entity.findOne({ where: { name: { [Op.like]: `%${topic}%` } } });
    if (entity) { loreData = { title: entity.name, content: entity.description, type: 'ENTITY' }; }

    if (!loreData) {
        const kingdom = await Kingdom.findOne({ where: { name: { [Op.like]: `%${topic}%` } } });
        if (kingdom) { loreData = { title: kingdom.name, content: kingdom.description, type: 'KINGDOM' }; }
    }

    if (!loreData) {
        const npc = await NPC.findOne({ where: { name: { [Op.like]: `%${topic}%` } } });
        if (npc) { loreData = { title: npc.name, content: npc.description, type: 'NPC', imageUrl: npc.imageUrl }; }
    }

    if (!loreData) {
        const club = await Club.findOne({ where: { name: { [Op.like]: `%${topic}%` } } });
        if (club) { loreData = { title: club.name, content: club.description, type: 'CLUB' }; }
    }

    if (!loreData) {
        const worldLore = {
            'one above all': "Source premiere de l'existence, One Above All est l'origine du temps, de la matiere, de la vie et de la mort. Aucun temple ne peut le contenir, aucun royaume ne peut le revendiquer.\n\nDans les archives anciennes, son silence n'est pas une absence mais une attente. Le monde d'Aetherys vit encore sous le poids de ce jugement suspendu.",
            'idée du mal': "L'Idee du Mal est une conscience nee des peurs, de la haine et du desir d'explication de l'humanite. Elle ne regne pas par decret, mais par causalite, en poussant les mortels vers les moments ou leurs tenebres parlent a leur place.\n\nPlus les hommes desesperent, plus son influence gagne en densite dans l'Interstice.",
            'béhérit': "Les Beherits sont des reliques vivantes, informes, presque humaines, qui n'apparaissent qu'aux etres brises. Ils ne se possedent pas vraiment: ils choisissent.\n\nQuand le desespoir atteint son point de rupture, le Beherit ouvre la voie vers un sacrifice irreparable et une metamorphose qui depasse la condition mortelle.",
            'apôtres': "Les Apotres sont d'anciens humains qui ont livre ce qu'ils aimaient le plus pour recevoir une puissance monstrueuse. Leur force vient d'un marche absolu: abandonner leur humanite pour devenir les instruments d'une volonte plus obscure.\n\nIls conservent parfois des traces de leur ancienne personnalite, mais celles-ci servent surtout a rendre leur monstruosite encore plus troublante.",
            'interstice': "L'Interstice est la faille entre le monde materiel, les royaumes spirituels et les plans interdits. Les esprits y errent, les entites y observent, et les pactes y laissent des cicatrices qui debordent parfois sur la realite.\n\nQuand ses frontieres s'amincissent, les monstres, les visions et les presages commencent a contaminer le quotidien.",
            'origines': "Au commencement, One Above All donna forme aux puissances celestes et bestiales, puis le monde se developpa autour des mortels. Mais l'humanite, incapable d'assumer seule la somme de ses peurs, engendra peu a peu l'Idee du Mal dans les profondeurs de l'Interstice.\n\nAetherys est ne de cet equilibre instable: grandeur divine au-dessus, desir humain au centre, abime au-dessous.",
            'nécropolis': "Necropolis est la cite des morts, gouvernee par Orpheon et enveloppee d'un calme qui n'a rien de paisible. Les ames qui y arrivent n'y sont ni libres ni tout a fait condamnees: elles attendent, se souviennent, et tremblent devant le verdict final.\n\nPour les vivants, ce lieu n'est pas une legende. C'est la preuve que la mort, ici, est une frontiere administrative avant d'etre un mystere.",
            'missions historiques': "Les missions historiques projettent les Heritiers au coeur d'epoques disparues. Ils n'y vont pas comme spectateurs, mais comme temoins exposes aux decisions, aux tragedies et aux batailles qui ont forme le monde present.\n\nChute des royaumes, naissance des Apotres, guerres entre puissances antiques: chaque archive de ce type est un champ de memoire vivant.",
            'histoire': "L'histoire recente d'Aetherys est celle d'un monde moderne qui croyait avoir domestique le mana, la politique et la violence. Cet equilibre s'effondre a mesure que reapparaissent les Beherits, que les anomalies se multiplient et que la Causalite reprend ses droits.\n\nLa paix n'est plus qu'une mince couche de vernis au-dessus d'une ere de rupture.",
            'convergence': "La Convergence est le nom donne au moment ou les limites entre les dimensions cessent de tenir. Les phenomenes de l'Interstice gagnent le sol des vivants, les monstres traversent les failles, et les puissances anciennes retrouvent des relais humains.\n\nCe n'est pas seulement une apocalypse. C'est une reorganisation brutale de la realite.",
            'aetherys': "Aetherys est un monde hybride, ou la technologie moderne cohabite avec le mana ancestral, les institutions académiques et les forces metaphysiques. Les villes brillent, les clubs prosperent, les armes evoluent, mais tout cela repose sur un socle fragile.\n\nSous la surface des routines et des ambitions, la Causalite tisse une guerre invisible qui finit toujours par rattraper les vivants.",
            'mystères': "Les mysteres d'Aetherys ne se limitent pas a quelques reliques ou cultes caches. Ils concernent la logique meme du monde: pourquoi certains sont choisis, pourquoi certaines chutes semblent ecrites d'avance, et pourquoi l'Interstice repond si bien au desespoir.\n\nComprendre un mystere, ici, c'est souvent s'en approcher assez pour qu'il commence a vous regarder.",
            'société': "La societe d'Aetherys tient sur un equilibre instable entre academies, guildes, clubs, noblesse, commerce et puissance militaire. Chacun veut imposer son ordre, mais personne ne controle totalement la circulation du mana, des secrets et des dettes.\n\nL'Academie Imperiale forme l'elite. Les clubs recrutent l'influence. Les royaumes negocient. Et dans l'ombre, d'autres forces preparent un avenir moins humain."
        };
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const topicNormalized = normalize(topic);
        const key = Object.keys(worldLore).find(k => {
            const kn = normalize(k);
            return topicNormalized.includes(kn) || kn.includes(topicNormalized);
        });
        if (key) {
            loreData = { title: key.charAt(0).toUpperCase() + key.slice(1), content: worldLore[key], type: 'HISTORY' };
        }
    }

    if (!loreData) {
        return await sock.sendMessage(replyJid, { text: `❌ Aucune archive trouvée pour "${topic}".` });
    }

    try {
        const posterBuffer = await generateLorePoster(loreData.title, loreData.content, loreData.type, loreData.imageUrl);
        await sock.sendMessage(replyJid, {
            image: posterBuffer,
            caption: `📚 *Archives d'Aetherys : ${loreData.title}*\n\n${loreData.content}`
        });
    } catch (err) {
        console.error("[Lore] Error generating poster:", err);
        await sock.sendMessage(replyJid, { text: `📚 *Archives d'Aetherys : ${loreData.title}*\n\n${loreData.content}` });
    }
});

// Command: /help
// Command: /save
commands.set('save', async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu n'as pas de données à sauvegarder. Utilise /start." });
        return;
    }

    try {
        await player.save();
        await sock.sendMessage(replyJid, { text: "💾 *SAUVEGARDE RÉUSSIE*\n\nTes données ont été synchronisées avec la matrice d'Aetherys. Tu pourras reprendre ton aventure à tout moment." });
    } catch (error) {
        console.error("Erreur sauvegarde joueur:", error);
        await sock.sendMessage(replyJid, { text: "Erreur lors de la sauvegarde de tes données." });
    }
});

// Command: /tuto_rp
commands.set('tuto_rp', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { generateLorePoster } = require('./lore-generator');

    const tutoTitle = "MANUEL DU RP IMMERSIF";
    const tutoContent = "Bienvenue dans GHENO CITY, Egoïste.\n\n" +
        "1. LE MODE ACTION\nTape `/action` pour passer en mode Roleplay. Ici, tes messages sont interprétés par DARK LUST 3.2.\n\n" +
        "2. LA PRÉCISION\nNe dis pas 'Je frappe'. Dis 'Je pivote sur ma jambe gauche pour envoyer un coup de pied circulaire au niveau des côtes'. Plus tu es précis, plus le MJ est clément.\n\n" +
        "3. LES STATS\nTout est calculé. Si ton adversaire a 80 en FORCE et toi 20, tu vas souffrir. Utilise ton intelligence ou l'environnement pour compenser.\n\n" +
        "4. LE COMMERCE\nTu peux acheter des objets directement en parlant aux marchands ou au MJ. Dis 'Je veux acheter l'Épée de Fer' et si tu as les COL, le MJ mettra à jour ton profil.\n\n" +
        "5. SYNCHRONISATION\nEn multi-joueurs, utilise le mot-clé `next` quand tu as fini tes actions pour laisser le MJ répondre à tout le monde en même temps.";

    try {
        const posterBuffer = await generateLorePoster(tutoTitle, tutoContent, 'LORE');
        await sock.sendMessage(replyJid, {
            image: posterBuffer,
            caption: `📖 *GUIDE D'APPRENTISSAGE AU RP*\n\n${tutoContent}`
        });
    } catch (e) {
        console.error("Tuto RP error:", e);
        await sock.sendMessage(replyJid, { text: `*${tutoTitle}*\n\n${tutoContent}` });
    }
});
commands.set('apprendre', commands.get('tuto_rp'));

// Command: /next
commands.set('next', async (sock, message) => {
    const jid = getJid(message);
    const player = await Player.findOne({ where: { whatsappId: jid } });
    const replyJid = message.key.remoteJid;

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
        return;
    }

    try {
        await handleFreeAction(sock, message, player, "next");
    } catch (error) {
        console.error('Erreur commande /next:', error);
        await sock.sendMessage(replyJid, { text: "Le MJ n'a pas pu répondre. Réessaie." });
    }
});

commands.set('help', async (sock, message) => {
  const helpText = "*Commandes Disponibles:*\n" +
                   "/start - Commencer l'aventure.\n" +
                   "/profile - Voir ton profil de joueur.\n" +
                   "/statut - Voir l'état de ton équipement.\n" +
                   "/inventory - Consulter ton inventaire.\n" +
                   "/quests - Voir tes quêtes actives.\n" +
                   "/map - Afficher la carte du monde et les donjons.\n" +
                   "/bank - Accéder à ton compte en banque.\n" +
                   "/deposer <montant> - Déposer de l'argent en banque.\n" +
                   "/retirer <montant> - Retirer de l'argent de la banque.\n" +
                   "/boutique - Acheter de l'équipement.\n" +
                   "/joueurs - Voir les joueurs à proximité.\n" +
                   "/lieux - Voir ta position et les environs.\n" +
                   "/inspecter @joueur - Voir le profil d'un autre joueur.\n" +
                   "/donner @joueur <montant> col OU <objet> - Donner un objet ou de l'argent.\n" +
                   "/royaumes - Géopolitique mondiale.\n" +
                   "/conflits - Guerres en cours.\n" +
                   "/ecoles - Liste des académies.\n" +
                   "/examens - Dossier scolaire.\n" +
                   "/clubs - Clubs extrascolaires.\n" +
                   "/pacts - Pactes avec les entités.\n" +
                   "/save - Sauvegarder tes données.\n" +
                   "/checkai - Diagnostic IA.\n" +
                   "/up <stat> <points> - Augmenter tes statistiques (SP).\n" +
                   "/evenement <description> - Déclencher un évent MJ (GOD).\n" +
                   "/lore <topic> - Consulter la bibliothèque.\n" +
                   "/action - Mode immersif (RP).\n" +
                   "/next - Forcer la réponse du MJ.\n" +
                   "/menu - Menu principal.\n" +
                   "/reset - Réinitialiser ton personnage.\n" +
                   "/help - Cette aide.";
  await sock.sendMessage(message.key.remoteJid, { text: helpText });
});

// Command: /reset
commands.set('reset', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu n'as pas de personnage à réinitialiser." });
        return;
    }

    if (args[0] !== 'confirm') {
        await sock.sendMessage(replyJid, { text: "⚠️ *ATTENTION* ⚠️\n\nCette action supprimera définitivement ton personnage, tes statistiques, ton inventaire et ta progression.\n\nPour confirmer, tape : `/reset confirm`" });
        return;
    }

    try {
        // Complete bulletproof reset of player and all associations to ensure they are no longer an Apostle and start fresh
        await Bank.destroy({ where: { PlayerWhatsappId: jid } });
        await PlayerQuest.destroy({ where: { PlayerWhatsappId: jid } });
        await PlayerSkill.destroy({ where: { PlayerWhatsappId: jid } });
        await Pact.destroy({ where: { PlayerWhatsappId: jid } });
        await PlayerClub.destroy({ where: { PlayerWhatsappId: jid } });
        await TournamentParticipant.destroy({ where: { playerJid: jid } });
        await House.update({ ownerId: null, storage: '[]' }, { where: { ownerId: jid } });

        await player.destroy();

        await sock.sendMessage(replyJid, { text: "💥 *Personnage réinitialisé.* Ta présence et tes pouvoirs d'Apôtre ont été définitivement effacés de la matrice d'Aetherys. Utilise `/start` pour renaître de tes cendres." });
    } catch (error) {
        console.error("Erreur reset personnage:", error);
        await sock.sendMessage(replyJid, { text: "Une erreur est survenue lors de la réinitialisation de ton personnage." });
    }
});

// Command: /evenement
commands.set('evenement', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player || !player.isGod) {
        await sock.sendMessage(replyJid, { text: "Seuls les administrateurs peuvent manipuler le destin." });
        return;
    }

    const eventDesc = args.join(' ');
    if (!eventDesc) {
        await sock.sendMessage(replyJid, { text: "Utilise /evenement <description> pour introduire un monstre ou un événement." });
        return;
    }

    await sock.sendMessage(replyJid, { text: "🌍 *Manipulation de la réalité en cours...*" });

    const systemPrompt = `Tu es le MJ d'After the Rebirth (ATR). Un administrateur déclenche un événement spécial.
LORE: Convergence, Éveil, Monstres, Entités.
RÈGLES: Décris l'apparition brutale d'un monstre, d'une entité ou d'un événement environnemental.
FORMAT: JSON STRICT {"narrative":"...","actions":[],"imagePrompt":"..."}`;

    const userPrompt = `LIEU: ${player.location}\nSOUS_LIEU: ${player.subLocation}\nÉVÉNEMENT: ${eventDesc}`;

    try {
        const { callAI } = require('./ai-utils');
        const content = await callAI(systemPrompt, userPrompt);
        if (!content) throw new Error("IA muette");

        let aiResponse = { narrative: "L'air crépite... quelque chose arrive." };
        try {
            const start = content.indexOf('{');
            const end = content.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                aiResponse = JSON.parse(content.substring(start, end + 1));
            }
        } catch (e) {}

        // Save event to history
        await RPMessage.create({
            senderJid: 'system',
            senderName: 'ATR MJ',
            content: aiResponse.narrative,
            location: player.location,
            subLocation: player.subLocation
        });

        const { sendWithImage } = require('./message-handler');
        await sendWithImage(sock, replyJid, aiResponse);
    } catch (error) {
        console.error("[CMD] Erreur /evenement:", error);
        await sock.sendMessage(replyJid, { text: "La réalité a résisté à la modification." });
    }
});

// Command: /action
commands.set('action', async (sock, message) => {
  const jid = getJid(message);
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
      await player.update({ mode: 'action' });
      await sock.sendMessage(message.key.remoteJid, { text: "Mode action activé. Décris tes actions en langage naturel pour interagir avec le monde." });
  } else {
      await sock.sendMessage(message.key.remoteJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
  }
});

// Command: /checkai
commands.set('checkai', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const { callAI } = require('./ai-utils');

    await sock.sendMessage(replyJid, { text: "🔍 *DIAGNOSTIC DES FLUX MAGIQUES (IA)*...\nVeuillez patienter." });

    const startTime = Date.now();
    try {
        const result = await callAI("Tu es un MJ.", "MJ TEST.");
        const duration = (Date.now() - startTime) / 1000;

        let status = "🟢 *OPÉRATIONNEL*";
        if (!result || result.includes("instable")) status = "🔴 *LIMITE ATTEINTE*";

        await sock.sendMessage(replyJid, {
            text: `--- 🧠 ÉTAT DE L'IA --- \n\n` +
                  `Statut: ${status}\n` +
                  `Latence: ${duration}s\n` +
                  `Provider: Puter/Gemini\n` +
                  `Réponse brute: ${typeof result === 'string' ? result.substring(0, 60) : 'Obj'}\n\n` +
                  `_Le MJ est prêt à tisser le destin._`
        });
    } catch (e) {
        await sock.sendMessage(replyJid, { text: "🔴 *ERREUR CRITIQUE*\nAucun flux magique n'a pu être établi. Contactez l'administrateur." });
    }
});

// Command: /status
commands.set('status', async (sock, message) => {
    const replyJid = message.key.remoteJid;
    const uptime = Math.floor(process.uptime() / 60);
    const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);

    let text = "⚙️ *SYSTÈME ATR - ÉTAT ACTUEL*\n\n";
    text += `🟢 Bot Opérationnel\n`;
    text += `⏱️ Uptime: ${uptime} minutes\n`;
    text += `💾 Mémoire: ${mem} MB\n`;
    text += `🌍 Monde: Aetherys v2.0\n`;
    text += `🤖 Core: MJ Noyau Flash\n\n`;
    text += `_Système stable et synchronisé._`;

    await sock.sendMessage(replyJid, { text });
});

// Command: /arbitre
commands.set('arbitre', async (sock, message, args) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) return;

    // We can judge:
    // 1. A quoted message
    // 2. Arguments provided directly
    const quoted = message.message.extendedTextMessage?.contextInfo?.quotedMessage;
    let actionText = args.join(' ');

    if (quoted) {
        actionText = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || actionText;
    }

    if (!actionText || actionText.length < 5) {
        return await sock.sendMessage(replyJid, { text: "⚖️ *L'Arbitre attend du contenu.* Cite un pavé RP ou écris-le après la commande." });
    }

    await sock.sendMessage(replyJid, { text: "⚖️ *L'Arbitre Suprême analyse le flux des événements...*" });

    // Try to find a potential defender (mention in quoted or current message)
    let defender = null;
    const mention = message.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                    message.message.extendedTextMessage?.contextInfo?.quotedMessage?.participant;

    if (mention) {
        defender = await Player.findOne({ where: { whatsappId: mention } });
    }

    const verdict = await referee.judge(actionText, {
        attacker: player,
        defender: defender,
        environment: player.location + " (" + player.subLocation + ")"
    });

    let resultText = `⚖️ *VERDICT DE L'ARBITRE SUPRÊME* ⚖️\n\n`;
    resultText += `📢 *VERDICT :* ${verdict.verdict}\n`;
    resultText += `🧠 *ANALYSE :* ${verdict.analyse_tactique}\n\n`;
    resultText += `🎯 *INTENTION :* ${verdict.intentions_comprises}\n`;
    resultText += `🔥 *CRÉATIVITÉ :* ${verdict.score_creativite}/100\n\n`;
    resultText += `🩹 *CONSÉQUENCES :* ${verdict.consequences_directes}\n`;
    resultText += `📜 *RAISONS :* ${verdict.raisons_du_verdict}\n\n`;

    if (verdict.degats_estimes) {
        const d = verdict.degats_estimes;
        resultText += `📉 *IMPACT :* [❤️ ${d.pv || 0} PV | 🌀 ${d.pm || 0} PM | ⚡ ${d.stamina || 0} STAM]`;
    }

    try {
        const { generateLorePoster } = require('./lore-generator');
        const buffer = await generateLorePoster("VERDICT ARBITRAL", resultText, 'HISTORY');
        await sock.sendMessage(replyJid, { image: buffer, caption: resultText });
    } catch (e) {
        await sock.sendMessage(replyJid, { text: resultText });
    }
});

// Command: /journal and /changelog
const journalCommand = async (sock, message) => {
  const replyJid = message.key.remoteJid;
  const changelogText = `╔══════════════════════════╗\n` +
                        `   📓  *JOURNAL DES MISES À JOUR*  \n` +
                        `╚══════════════════════════╝\n\n` +
                        `Chers Héritiers, voici les dernières fonctionnalités ajoutées au système d'Aetherys pour vous guider :\n\n` +
                        `⚡ *1. AURA DE COMBAT* (Tapez \`/aura\`)\n` +
                        `└ Activez votre Aura d'énergie pour booster instantanément toutes vos statistiques de *+50%* !\n\n` +
                        `🌀 *2. FUSION CORPS ET ESPRIT* (Tapez \`/fusion <nom_joueur>\`)\n` +
                        `└ Fusionnez avec un autre joueur à proximité pour former un guerrier suprême unique. Vos statistiques sont cumulées et boostées de *+30% d'énergie synoptique* ! Pour vous séparer, tapez \`/defusion\`.\n\n` +
                        `🛒 *3. ACHATS SIMPLIFIÉS* (Tapez \`/acheter [Numéro]\`)\n` +
                        `└ Plus besoin d'écrire des noms complexes ! Entrez simplement le numéro affiché de l'article dans la boutique pour l'acheter directement (ex: \`/acheter 3\`).\n\n` +
                        `📚 *4. ACADÉMIE & TECHNIQUES* (Tapez \`/etudier\`)\n` +
                        `└ Lorsque vous êtes dans une Académie ou École, tapez \`/etudier\` sans paramètre pour voir les sorts de votre classe, ou \`/etudier [nom]\` pour les apprendre en dépensant vos SP.\n\n` +
                        `🎭 *5. APOTHÉOSE DE L'APÔTRE* (Tapez \`/apotheose <cible>\`)\n` +
                        `└ Si vous possédez un Béhérit rare, offrez l'âme d'une victime en sacrifice pour muter en un Apôtre de Rang S avec un look grotesque personnalisé par l'IA et un bonus massif de *+150* aux statistiques.\n\n` +
                        `🥴 *6. IVRESSE & EMPOISONNEMENT* (Objets consommables)\n` +
                        `└ Boire de l'alcool vous rend soulé (l'IA adapte votre parole et vos réflexes). Utiliser du poison active le venin (dégâts réguliers de faim/vie).\n\n` +
                        `🍗 *7. NOURRITURE ET SATIÉTÉ*\n` +
                        `└ Consommer du pain ou de la viande remplit instantanément votre jauge de faim (satiété) pour vous éviter de mourir d'inanition.\n\n` +
                        `👼 *8. RÉSURRECTION DIVINE* (Tapez \`/god res <nom_joueur>\`)\n` +
                        `└ Les dieux peuvent désormais ressusciter les joueurs trépassés en restaurant tous leurs PV à Eldoria.`;

  await sock.sendMessage(replyJid, { text: changelogText });
};
commands.set('journal', journalCommand);
commands.set('changelog', journalCommand);

// Command: /guide
const guideCommand = async (sock, message, args) => {
    const replyJid = message.key.remoteJid;
    let page = 1;
    if (args[0]) {
        const parsed = parseInt(args[0]);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
            page = parsed;
        }
    }

    try {
        const { generateGuideImage } = require('./guide-generator');
        const guideBuffer = await generateGuideImage(page);

        let introText = "";
        if (page === 1) {
            introText = `📖 *GUIDE DE L'HÉRITIER - MODULE I : STATISTIQUES & RANGS*\n\n` +
                        `Découvrez le fonctionnement de vos statistiques de combat et les limites physiques imposées à votre Héritier selon son Rang.\n\n` +
                        `👉 *Taper \`/guide 2\`* pour afficher le Guide du Combat et des Extensions.\n` +
                        `👉 *Taper \`/guide 3\`* pour afficher le Guide de la Survie et de l'Épuisement.\n` +
                        `👉 *Taper \`/guide 4\`* pour afficher le Guide de la Politique et des Élections.`;
        } else if (page === 2) {
            introText = `📖 *GUIDE DE L'HÉRITIER - MODULE II : COMBAT & BATTLE IQ*\n\n` +
                        `Maîtrisez la létalité impitoyable d'Aetherys. Sachez réagir avec tactique, esquiver et déployer votre Extension du Territoire de Rang S.\n\n` +
                        `👉 *Taper \`/guide 1\`* pour afficher le Guide des Statistiques.\n` +
                        `👉 *Taper \`/guide 3\`* pour afficher le Guide de la Survie.\n` +
                        `👉 *Taper \`/guide 4\`* pour afficher le Guide de la Politique.`;
        } else if (page === 3) {
            introText = `📖 *GUIDE DE L'HÉRITIER - MODULE III : SURVIE & ALIMENTS*\n\n` +
                        `Gérez rigoureusement vos jauges de faim, de sommeil et l'état de propreté de vos habits pour ne pas subir d'inanition ou de pénalités.\n\n` +
                        `👉 *Taper \`/guide 1\`* pour afficher le Guide des Statistiques.\n` +
                        `👉 *Taper \`/guide 2\`* pour afficher le Guide du Combat.\n` +
                        `👉 *Taper \`/guide 4\`* pour afficher le Guide de la Politique.`;
        } else {
            introText = `📖 *GUIDE DE L'HÉRITIER - MODULE IV : CARRIÈRE POLITIQUE*\n\n` +
                        `Devenez un chef d'opinion incontournable. Lancez votre campagne électorale, haranguez les foules et unissez les citoyens derrière votre projet.\n\n` +
                        `👉 *Taper \`/guide 1\`* pour afficher le Guide des Statistiques.\n` +
                        `👉 *Taper \`/guide 2\`* pour afficher le Guide du Combat.\n` +
                        `👉 *Taper \`/guide 3\`* pour afficher le Guide de la Survie.`;
        }

        await sock.sendMessage(replyJid, {
            image: guideBuffer,
            caption: introText
        });
    } catch (err) {
        console.error("[Guide] Error generating visual guide:", err);
        await sock.sendMessage(replyJid, { text: "❌ Une erreur est survenue lors de la génération du guide visuel." });
    }
};
commands.set('guide', guideCommand);

// Command: /voyager
commands.set('voyager', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const destination = args.join(' ').trim();

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Tu devez d'abord commencer le jeu avec /start." });
    return;
  }

  const subLower = (player.subLocation || "").toLowerCase();
  const locLower = (player.location || "").toLowerCase();
  const isAtPort = ["port", "quai", "atoll", "embarcadère", "crique", "mer", "phare"].some(p => subLower.includes(p) || locLower.includes(p));

  if (!isAtPort && !player.isGod) {
    await sock.sendMessage(replyJid, { text: `❌ Impossible d'embarquer ici (*${player.subLocation}*). Rends-toi à un Port, un Quai ou un Embarcadère pour voyager en bateau !` });
    return;
  }

  const destinations = {
      'valkyrr': { kingdom: 'Royaume de Valkyrr', port: 'Port-Sparkwell', days: 2, price: 50 },
      'archipel': { kingdom: 'Archipel des Murmures', port: 'Port-Brume', days: 3, price: 80 },
      'bestiales': { kingdom: 'Terres Bestiales', port: 'Claw-reach', days: 5, price: 120 },
      'vharos': { kingdom: 'Dominion Noir de Vharos', port: 'Marais Putrides', days: 6, price: 200 },
      'celeste': { kingdom: 'Royaume Céleste', port: 'Portes du Ciel', days: 7, price: 350 },
      'elion': { kingdom: 'Empire Impérial d\'Elion', port: 'Eldoria', days: 2, price: 50 }
  };

  const keys = Object.keys(destinations);
  const targetKey = keys.find(k => destination.toLowerCase().includes(k) || destinations[k].kingdom.toLowerCase().includes(destination.toLowerCase()));

  if (!destination || !targetKey) {
      let list = "🚢 *LIGNES DE VOYAGE MARITIME DISPONIBLES* 🚢\n\n";
      list += `Tu es actuellement à : *${player.subLocation}* (${player.location})\n\n`;
      list += "Pour voyager par la mer, tape \`/voyager [royaume]\` :\n\n";
      for (const [k, d] of Object.entries(destinations)) {
          list += `├ 🗺️ *${d.kingdom}* (Port : ${d.port})\n`;
          list += `│  └ ⏳ Durée : *${d.days} jours RP* • 💰 Prix : *${d.price} Col*\n\n`;
      }
      list += "└ _Note : Traverser les océans d'Aetherys prend plusieurs jours RP selon la distance, au milieu de tempêtes et de créatures marines !_";
      await sock.sendMessage(replyJid, { text: list });
      return;
  }

  const dest = destinations[targetKey];

  if (player.col < dest.price && !player.isGod) {
      await sock.sendMessage(replyJid, { text: `❌ Tu n'as pas assez de pièces pour acheter un billet de bateau pour ${dest.kingdom} (${dest.price} Col requis, tu en as *${player.col}*).` });
      return;
  }

  // Deduct fee and move player
  if (!player.isGod) {
      await player.decrement('col', { by: dest.price });
  }

  await player.update({
      location: dest.kingdom,
      subLocation: dest.port
  });

  // Advance time: each day adds 24 action counts to trigger clock forward
  const { WorldJournal } = require('./database');
  const journalLog = `🚢 VOYAGE MARITIME : ${player.name} a navigué pendant ${dest.days} jours de tempête pour rejoindre ${dest.kingdom}.`;
  await WorldJournal.create({
      entry: journalLog,
      importance: 3,
      category: 'plot'
  });

  await player.reload();

  const voyageText = `🚢 *VOYAGE EN MER TERMINÉ !* 🚢\n\n` +
                     `« Les voiles se gonflent, le bois craque sous la force des vagues d'Éther... »\n\n` +
                     `Tu as navigué durant **${dest.days} jours entiers** à travers les océans instables d'Aetherys, évitant de justesse des bancs de spectres aquatiques et des tempêtes de mana.\n\n` +
                     `📍 *Nouveau Lieu d'ancrage :* **${dest.kingdom}** (${dest.port})\n` +
                     `💰 *Prix du voyage :* -${dest.price} Col (Reste: ${player.col} Col)\n` +
                     `⏳ Le temps s'est écoulé de **${dest.days} jours** dans le monde d'Aetherys.`;

  try {
      const { generateTravelPostcard } = require('./additional-visuals');
      const distanceTravelled = dest.days * 4500;
      const buffer = await generateTravelPostcard(player.name, player.location, dest.kingdom, distanceTravelled);
      await sock.sendMessage(replyJid, { image: buffer, caption: voyageText });
  } catch (e) {
      try {
          const { generateLorePoster } = require('./lore-generator');
          const buffer = await generateLorePoster("VOYAGE MARITIME", voyageText, 'HISTORY');
          await sock.sendMessage(replyJid, { image: buffer, caption: voyageText });
      } catch (err) {
          await sock.sendMessage(replyJid, { text: voyageText });
      }
  }
});

// Command: /etudier
commands.set('etudier', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const skillName = args.join(' ').trim();

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const subLower = (player.subLocation || "").toLowerCase();
  const isAcademy = ["académie", "lycée", "école", "school", "collège", "sanctuaire", "citadelle", "bibliothèque", "temple"].some(sch => subLower.includes(sch));

  if (!isAcademy && !player.isGod) {
    await sock.sendMessage(replyJid, { text: `❌ Impossible d'étudier ici (*${player.subLocation}*). Rends-toi dans une Académie, une École, une Bibliothèque ou un Sanctuaire pour apprendre de nouvelles techniques !` });
    return;
  }

  if (!skillName) {
    // Show list of learnable skills matching class type or elemental
    const { Skill } = require('./database');
    const learnable = await Skill.findAll({
        where: {
            [Op.or]: [
                { type: player.class },
                { type: { [Op.like]: '%Élémentaire%' } }
            ]
        },
        limit: 12
    });

    let listText = `📚 *BIBLIOTHÈQUE DE L'ACADÉMIE - TECHNIQUES DISPONIBLES* 📚\n` +
                   `📍 Lieu : ${player.subLocation}\n` +
                   `✨ Tes SP dispos : *${player.skillPoints} SP*\n\n` +
                   `Pour apprendre une technique, tape \`/etudier [nom de la technique]\` (Coût: *5 SP* par technique) :\n\n`;

    learnable.forEach(s => {
        listText += `├ 📖 *${s.name.toUpperCase()}*\n`;
        listText += `│  └ 📜 ${s.description}\n`;
    });
    listText += `\n└ _Chaque technique apprise augmente définitivement tes statistiques de base !_`;

    await sock.sendMessage(replyJid, { text: listText });
    return;
  }

  const { Skill } = require('./database');
  const skill = await Skill.findOne({
      where: {
          name: { [Op.like]: `%${skillName}%` }
      }
  });

  if (!skill) {
      await sock.sendMessage(replyJid, { text: `❌ La technique "${skillName}" n'existe pas ou n'est pas répertoriée dans la bibliothèque.` });
      return;
  }

  const hasSkill = await player.hasSkill(skill);
  if (hasSkill) {
      await sock.sendMessage(replyJid, { text: `❌ Tu maîtrises déjà la technique *${skill.name.toUpperCase()}* !` });
      return;
  }

  if (player.skillPoints < 5 && !player.isGod) {
      await sock.sendMessage(replyJid, { text: `❌ Tu n'as pas assez de Points de Compétence (5 SP requis, tu en as *${player.skillPoints} SP*). Complète des quêtes ou monte de niveau pour en gagner !` });
      return;
  }

  // Study cost and learn skill
  if (!player.isGod) {
      await player.decrement('skillPoints', { by: 5 });
  }
  await player.addSkill(skill);

  // Apply stat bonuses immediately
  const bonuses = skill.statBonuses || {};
  for (const [stat, val] of Object.entries(bonuses)) {
      if (['strength', 'agility', 'intelligence', 'luck', 'defense'].includes(stat)) {
          await player.increment(stat, { by: val });
      }
  }
  await player.reload();

  const studyText = `📖 *APPRENTISSAGE RÉUSSI !* Tu as étudié avec succès la technique *${skill.name.toUpperCase()}* pour 5 SP !\n\n└ 📜 _Effet :_ ${skill.description}\n✨ Tes SP restants : *${player.skillPoints} SP*`;

  try {
      const { generateSkillScrollCard } = require('./additional-visuals');
      const cardBuf = await generateSkillScrollCard(player.name, skill.name, skill.type, skill.description);
      await sock.sendMessage(replyJid, { image: cardBuf, caption: studyText });
  } catch (err) {
      console.error("[Etudier Visual] Failed:", err);
      await sock.sendMessage(replyJid, { text: studyText });
  }
});

// Command: /missions
commands.set('missions', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid }, include: Quest });

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const actionSub = args[0]?.toLowerCase();

  if (actionSub === 'accepter' || actionSub === 'accept') {
    const questStr = args.slice(1).join(' ').trim();
    if (!questStr) {
        await sock.sendMessage(replyJid, { text: "⚠️ Indique l'index ou le nom de la mission secondaire à accepter (ex: `/missions accepter 3`)." });
        return;
    }

    const { startQuest } = require('./quest-utils');
    const { Quest: ModelQuest } = require('./database');
    let questToAccept = null;

    const parsedIndex = parseInt(questStr);
    if (!isNaN(parsedIndex) && parsedIndex >= 1 && parsedIndex <= 15) {
        const sideQuests = await ModelQuest.findAll({
            where: { type: 'side', rank_required: player.rank },
            limit: 15
        });
        if (sideQuests[parsedIndex - 1]) {
            questToAccept = sideQuests[parsedIndex - 1];
        }
    }

    if (!questToAccept) {
        questToAccept = await ModelQuest.findOne({
            where: { title: { [Op.like]: `%${questStr}%` }, type: 'side' }
        });
    }

    if (!questToAccept) {
        await sock.sendMessage(replyJid, { text: `❌ Impossible de trouver la mission secondaire "${questStr}".` });
        return;
    }

    const logMsg = await startQuest(player, questToAccept.title);
    if (logMsg) {
        await sock.sendMessage(replyJid, { text: `✅ *Mission secondaire acceptée !*\n\n${logMsg}` });
    } else {
        await sock.sendMessage(replyJid, { text: `❌ Tu as déjà accepté ou terminé cette mission : "${questToAccept.title}".` });
    }
    return;
  }

  // Display available side quests of their rank
  const { Quest: ModelQuest } = require('./database');
  const sideQuests = await ModelQuest.findAll({
      where: { type: 'side', rank_required: player.rank },
      limit: 15
  });

  let boardText = `📜 *TABLEAU DES MISSIONS SECONDAIRES (RANG ${player.rank})* 📜\n` +
                  `De nombreuses missions secondaires sont disponibles partout dans le monde pour gagner de l'XP et de l'argent !\n\n`;

  sideQuests.forEach((q, i) => {
      const isAlreadyAccepted = player.Quests.some(pq => pq.id === q.id);
      const statusIcon = isAlreadyAccepted ? "⏳" : "💠";
      boardText += `${i + 1}. [${statusIcon}] *${q.title}*\n`;
      boardText += `   ├ 📝 ${q.description}\n`;
      boardText += `   └ 🪙 Récompense : *${q.reward_col} Col* • ✨ *${q.reward_xp} XP*\n\n`;
  });

  boardText += `👉 Pour accepter une mission, tapez : \`/missions accepter [Numéro]\` (Ex: \`/missions accepter 2\`)`;

  await sock.sendMessage(replyJid, { text: boardText });
});

// Command: /aura
commands.set('aura', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const newState = !player.hasAura;
  await player.update({ hasAura: newState });

  if (newState) {
    await sock.sendMessage(replyJid, { text: "🔥 *AURA ACTIVÉE !* Tu déploies une énergie phénoménale qui booste temporairement toutes tes statistiques de *+50%* ! Ton corps s'entoure d'une aura flamboyante et tes capacités s'éveillent !" });
  } else {
    await sock.sendMessage(replyJid, { text: "💤 *Aura dissipée.* Ton énergie se stabilise et retourne à son état normal." });
  }
});

// Command: /apotheose
commands.set('apotheose', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  // 1. Verify if the player has a Béhérit in their inventory
  let inventory = player.inventory || [];
  const beheritIndex = inventory.findIndex(i => i.name.toLowerCase().includes('béhérit') || i.name.toLowerCase().includes('beherit'));

  if (beheritIndex === -1 && !player.isGod) {
    await sock.sendMessage(replyJid, { text: "❌ *L'appel du Néant échoue...* Tu ne possèdes pas de Béhérit (l'œuf du conquérant extrêmement rare) pour ouvrir les portes de l'Interstice." });
    return;
  }

  // 2. Validate sacrifice target
  const targetStr = args.join(' ').trim();
  if (!targetStr) {
    await sock.sendMessage(replyJid, { text: "⚠️ *Qui souhaites-tu sacrifier ?* Indique le nom d'un autre joueur ou d'un PNJ proche à qui tu tiens ou avec qui tu as un lien.\n\nUsage : `/apotheose <nom_cible>`" });
    return;
  }

  // Helper to find player or PNJ
  const cleanTarget = targetStr.replace('@', '').trim();
  const targetPlayer = await Player.findOne({
    where: {
        name: { [Op.like]: `%${cleanTarget}%` }
    }
  });

  const { NPC } = require('./database');
  const targetNpc = await NPC.findOne({
    where: {
        name: { [Op.like]: `%${cleanTarget}%` },
        location: player.location
    }
  });

  if (!targetPlayer && !targetNpc) {
    await sock.sendMessage(replyJid, { text: `❌ Impossible de trouver la cible "${targetStr}" à sacrifier ici. Elle doit être à portée pour offrir son âme à l'Interstice.` });
    return;
  }

  const victimName = targetPlayer ? targetPlayer.name : targetNpc.name;

  // 3. Consume Beherit from inventory
  if (!player.isGod) {
    inventory.splice(beheritIndex, 1);
    player.inventory = inventory;
    await player.save();
  }

  // 4. Sacrifice the victim (Kill player or delete NPC)
  if (targetPlayer) {
    await targetPlayer.update({
        health: 0,
        location: 'Nécropolis',
        subLocation: 'Le Seuil',
        characterDescription: `${targetPlayer.name} a été sacrifié par ${player.name} lors de l'Éclipse pour ouvrir les portes de l'Interstice. Son âme erre éternellement.`
    });
    try {
        await sock.sendMessage(targetPlayer.whatsappId, { text: `💀 *SACRIFICE DE L'ÉCLIPSE !* Tu as été sacrifié par *${player.name}* ! Ton âme est consumée et envoyée à Nécropolis.` });
    } catch(e) {}
  } else if (targetNpc) {
    await targetNpc.destroy();
  }

  // 5. Transform the player into an Apostle (Powered by custom AI narration of their exact mutation look)
  const originalDescription = player.characterDescription || "Un aventurier";
  let selectedLook = "une abomination gigantesque aux yeux écarlates et plaques osseuses de démon.";

  try {
      const transformPrompt = `Génère une description ultra-sombre, viscérale et grotesque de la transformation de ${player.name} en Apôtre de l'Interstice.
Sa description originale : "${originalDescription}"
Sa classe : ${player.class} (${player.derivative})
Victime sacrifiée : ${victimName}

Consigne de style : Style Berserk / Seinen sombre. Décris en détail sa nouvelle apparence démoniaque (sa peau, ses cornes, ses membres distordus, son regard) qui reflète son caractère et sa classe de combat. Maximum 80 mots.`;

      const { callAI } = require('./ai-utils');
      const mutationDescription = await callAI(`Tu es le narrateur de l'Interstice d'Aetherys. Décris la mutation démoniaque terrifiante d'un nouvel Apôtre.`, transformPrompt, { jsonMode: false });
      if (mutationDescription) {
          selectedLook = mutationDescription.trim().replace(/\{[\s\S]*?\}/g, '');
      }
  } catch (e) {
      console.error("[Eclipse AI] Failed to generate AI apostle look, falling back:", e.message);
  }

  await player.update({
      class: "Apôtre de l'Interstice",
      rank: "S",
      strength: player.strength + 150,
      defense: player.defense + 150,
      agility: player.agility + 150,
      characterDescription: `Anciennement ${player.name} (${originalDescription}). Désormais un Apôtre de la Main de Dieu. Description : ${selectedLook}`
  });

  await player.reload();

  // 6. Log the Eclipse event in World Journal
  const { WorldJournal } = require('./database');
  await WorldJournal.create({
      entry: `🩸 ÉCLIPSE MAJEURE : ${player.name} a sacrifié ${victimName} et est devenu un APÔTRE DE L'INTERSTICE !`,
      importance: 5,
      category: 'plot'
  });

  const announcement = `🩸 *APOTHÉOSE DE L'ÉCLIPSE !* 🩸\n\n` +
                       `« Les portes de l'Interstice se sont ouvertes dans un geyser de sang et d'ombre. »\n\n` +
                       `*${player.name}* a brandi le Béhérit et a offert l'âme de **${victimName}** en sacrifice aux cinq Anges de la Causalité !\n\n` +
                       `✨ *TRANSFORMATION COMPLÈTE* : Sa classe est désormais **Apôtre de l'Interstice** (Rang S) ! Sa force brute et sa défense augmentent massivement de *+150* ! Son enveloppe charnelle a muté en une abomination terrifiante.\n\n` +
                       `💀 **${victimName}** est mort, son âme consumée par le Vide éternel.`;

  try {
      const { generateLorePoster } = require('./lore-generator');
      const buffer = await generateLorePoster("APOTHÉOSE", announcement, 'WAR');
      await sock.sendMessage(replyJid, { image: buffer, caption: announcement });
  } catch (e) {
      await sock.sendMessage(replyJid, { text: announcement });
  }
});

// Command: /fusion
commands.set('fusion', async (sock, message, args) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  const targetStr = args.join(' ').trim();

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  if (!targetStr) {
    await sock.sendMessage(replyJid, { text: "⚠️ *Avec qui souhaites-tu fusionner ton corps et ton esprit ?* Indique le nom de l'autre joueur.\n\nUsage : `/fusion <nom_joueur>`" });
    return;
  }

  // Find target player
  const cleanTarget = targetStr.replace('@', '').trim();
  const targetPlayer = await Player.findOne({
    where: {
        name: { [Op.like]: `%${cleanTarget}%` },
        whatsappId: { [Op.ne]: jid } // Can't fuse with oneself
    }
  });

  if (!targetPlayer) {
    await sock.sendMessage(replyJid, { text: `❌ Impossible de trouver le joueur "${targetStr}" à proximité pour fusionner.` });
    return;
  }

  if (player.fusedWithId || targetPlayer.fusedWithId) {
    await sock.sendMessage(replyJid, { text: "❌ L'un des deux joueurs est déjà engagé dans une fusion ! Vous devez d'abord vous défusionner." });
    return;
  }

  // Set fusion state
  await player.update({ fusedWithId: targetPlayer.whatsappId, fusionSyncLevel: 1.30 });
  await targetPlayer.update({ fusedWithId: player.whatsappId, fusionSyncLevel: 1.30 });

  await player.reload();
  await targetPlayer.reload();

  const combinedName = `${player.name.substring(0, Math.floor(player.name.length/2))}${targetPlayer.name.substring(Math.floor(targetPlayer.name.length/2))}`.toUpperCase();
  const announcement = `🌀 *FUSION SUPRÊME !* 🌀\n\n` +
                       `« Deux corps, deux esprits, une seule et unique volonté absolue. »\n\n` +
                       `*${player.name}* et *${targetPlayer.name}* ont harmonisé leurs flux d'Ether et fusionné dans une décharge d'énergie aveuglante !\n\n` +
                       `👤 *NOUVEL HÉRITIER :* **${combinedName}**\n` +
                       `📈 *PUISSANCE :* Leurs statistiques primaires sont combinées et décuplées de **+30% d'énergie synoptique** !\n` +
                       `✨ Le monde tremble devant ce nouveau guerrier d'une puissance inouïe.`;

  try {
      const { generateLorePoster } = require('./lore-generator');
      const buffer = await generateLorePoster("FUSION", announcement, 'HISTORY');
      await sock.sendMessage(replyJid, { image: buffer, caption: announcement });
      await sock.sendMessage(targetPlayer.whatsappId, { image: buffer, caption: announcement });
  } catch (e) {
      await sock.sendMessage(replyJid, { text: announcement });
  }
});

// Command: /defusion
commands.set('defusion', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) return;

  if (!player.fusedWithId) {
    await sock.sendMessage(replyJid, { text: "❌ Tu n'es pas engagé dans une fusion actuellement." });
    return;
  }

  const partner = await Player.findOne({ where: { whatsappId: player.fusedWithId } });

  await player.update({ fusedWithId: null, fusionSyncLevel: 0 });
  if (partner) {
      await partner.update({ fusedWithId: null, fusionSyncLevel: 0 });
  }

  const msg = `💔 *DISSOLUTION !* La fusion spirituelle a pris fin. *${player.name}* et *${partner ? partner.name : "son partenaire"}* retrouvent leurs formes et esprits individuels distincts.`;
  await sock.sendMessage(replyJid, { text: msg });
  if (partner) {
      await sock.sendMessage(partner.whatsappId, { text: msg });
  }
});

// Command: /laver
commands.set('laver', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const locationLower = (player.subLocation || "").toLowerCase();
  const isNearWater = ["source", "rivière", "lac", "cascade", "mer", "phare", "crique", "sources", "flot", "ruisseau"].some(w => locationLower.includes(w));

  if (isNearWater) {
    await player.update({ outfitCleanliness: 'propre' });
    await sock.sendMessage(replyJid, { text: `🧼 *Nettoyage gratuit !* Tu laves tes vêtements dans l'eau fraîche de *${player.subLocation}*. Ta tenue est maintenant parfaitement *PROPRE* !` });
  } else {
    if (player.col < 10) {
      await sock.sendMessage(replyJid, { text: "❌ Tu n'as pas assez de pièces (10 Col requis) pour laver tes vêtements à la taverne. Trouve une source d'eau naturelle !" });
      return;
    }
    await player.decrement('col', { by: 10 });
    await player.update({ outfitCleanliness: 'propre' });
    await sock.sendMessage(replyJid, { text: `🧼 *Service de lavage !* Tu paies 10 Col à la tavernière locale. Tes vêtements sont lavés, repassés et sentent bon le propre !` });
  }
});

// Command: /reparer
commands.set('reparer', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });

  if (!player) {
    await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
    return;
  }

  const locationLower = (player.subLocation || "").toLowerCase();
  const hasForge = ["forge", "grand laboratoire", "marché", "taverne", "eldoria", "académie", "fort", "cité", "palais", "bastion", "atelier"].some(f => locationLower.includes(f));

  if (!hasForge) {
    await sock.sendMessage(replyJid, { text: `❌ Impossible de réparer tes vêtements ici (*${player.subLocation}*). Rends-toi dans une Cité, une Forge, une Taverne ou un Atelier !` });
    return;
  }

  if (player.col < 50) {
    await sock.sendMessage(replyJid, { text: `❌ Tu n'as pas assez de pièces (50 Col requis) pour faire réparer ton armure/vêtement par un tailleur ou forgeron.` });
    return;
  }

  await player.decrement('col', { by: 50 });
  await player.update({ outfitDurability: 100 });
  await sock.sendMessage(replyJid, { text: `🔧 *Réparation effectuée !* Un artisan local raccommode tes vêtements et renforce les coutures pour 50 Col. Durabilité remontée à *100%* !` });
});

// Command: /menu
commands.set('menu', async (sock, message) => {
  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const player = await Player.findOne({ where: { whatsappId: jid } });
  if (player) {
    await player.update({ mode: 'normal' });
  }

  // Promise delay helper
  const delayHelper = ms => new Promise(res => setTimeout(res, ms));

  // Stylish loading bar sequence
  const loadingMsg = await sock.sendMessage(replyJid, { text: "🔷 [◽◽◽◽◽◽◽◽◽◽] 0% - Initialisation de l'interface ATR..." });

  await delayHelper(350);
  await sock.sendMessage(replyJid, { text: "🔷 [🔷🔷🔷◽◽◽◽◽◽◽] 30% - Synchronisation avec la matrice...", edit: loadingMsg.key });

  await delayHelper(350);
  await sock.sendMessage(replyJid, { text: "🔷 [🔷🔷🔷🔷🔷🔷◽◽◽◽] 60% - Récupération de l'Héritier...", edit: loadingMsg.key });

  await delayHelper(350);
  await sock.sendMessage(replyJid, { text: "🔷 [🔷🔷🔷🔷🔷🔷🔷🔷🔷◽] 90% - Rendu de la carte d'accès tactique...", edit: loadingMsg.key });

  await delayHelper(250);
  await sock.sendMessage(replyJid, { delete: loadingMsg.key });

  const menuText = "╔══════════════════════════════════╗\n" +
                   "   🌐  *AFTER THE REBIRTH (ATR)*  🌐\n" +
                   "╚══════════════════════════════════╝\n" +
                   "_Matrice Tactique • Chroniques & Destin d'Aetherys_\n\n" +
                   "✦ ⚔️ *AVENTURE & COMBAT*\n" +
                   "  ├ `/action` (`/a`) - Entrer dans le RP (Mode Action)\n" +
                   "  └ `/dormir` (`/d`) - Sommeil (3 min, +100% Énergie)\n\n" +
                   "✦ 👤 *PROFIL & STATISTIQUES*\n" +
                   "  ├ `/profil` (`/p`) - Carte d'identité & aura\n" +
                   "  ├ `/inventory` (`/i`) - Sac à dos & équipements\n" +
                   "  └ `/competences` (`/s`) - Sorts & compétences\n\n" +
                   "✦ 📍 *EXPLORATION & MONDE*\n" +
                   "  ├ `/map` - Carte interactive des 17 Royaumes\n" +
                   "  ├ `/quests` (`/q`) - Journal de quêtes & objectifs\n" +
                   "  ├ `/lieux` - Position actuelle & environnements\n" +
                   "  └ `/joueurs` - Héritiers actifs à proximité\n\n" +
                   "✦ 🪙 *ÉCONOMIE & MARCHÉ*\n" +
                   "  ├ `/bank` - Banque centrale Col & comptes\n" +
                   "  ├ `/boutique` - Armes, armures & nourriture\n" +
                   "  └ `/vetements` - Tenues, réparations & lavage\n\n" +
                   "✦ 🏛️ *SOCIÉTÉ & FACTIONS*\n" +
                   "  ├ `/maison` - Domicile & stockage privé\n" +
                   "  ├ `/clubs` - Factions académiques & guildes\n" +
                   "  ├ `/pacts` - Pactes d'entités mystiques\n" +
                   "  └ `/lore` - Archives historiques d'ATR\n\n" +
                   "✦ 🏆 *COMPÉTITION & RANGS*\n" +
                   "  ├ `/top` - Classement mondial des Héritiers\n" +
                   "  └ `/tournoi` - Événements PVP & Arènes\n\n" +
                   "✦ ⚙️ *SYSTÈME & RACCOURCIS*\n" +
                   "  ├ `/menu` (`/m`) - Réafficher ce menu\n" +
                   "  ├ `/status` - Diagnostic système\n" +
                   "  └ `/help` - Aide complète\n\n" +
                   "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n" +
                   "💡 *Astuce:* Utilisez les boutons ci-dessous ou les raccourcis (`/a`, `/p`, `/d`, `/m`) !";

  try {
    const menuImage = await generateMainMenuImage(player);
    await sock.sendMessage(message.key.remoteJid, {
        image: menuImage,
        caption: menuText
    });

    // Send WhatsApp Interactive Quick Reply Buttons
    try {
        const { sendButtons } = require('@ryuu-reinzz/button-helper');
        await sendButtons(sock, message.key.remoteJid, {
            text: "Choisissez votre action rapide de l'Héritier :",
            footer: "AFTER THE REBIRTH (ATR)",
            buttons: [
                { id: "/action", text: "⚔️ Commencer l'Aventure" },
                { id: "/profil", text: "👤 Fiche d'Identité" },
                { id: "/quests", text: "📜 Journal de Quêtes" }
            ]
        });
    } catch (btnErr) {
        console.warn("Boutons non supportés ou erreur d'émission:", btnErr.message);
    }
  } catch (error) {
    console.warn("Erreur génération image menu:", error.message);
    await sock.sendMessage(message.key.remoteJid, { text: menuText });
  }
});

// Command: /dormir & /sleep
const dormirCommand = async (sock, message) => {
    const jid = getJid(message);
    const replyJid = message.key.remoteJid;
    const player = await Player.findOne({ where: { whatsappId: jid } });

    if (!player) {
        await sock.sendMessage(replyJid, { text: "Tu dois d'abord commencer le jeu avec /start." });
        return;
    }

    if (player.mode === 'sleep' || sleepingPlayers.has(player.whatsappId)) {
        await sock.sendMessage(replyJid, { text: "Tu es déjà en train de dormir !" });
        return;
    }

    // Enter sleep cycle
    await player.update({ mode: 'sleep' });

    const duration = 180 * 1000; // 3 minutes
    const endTime = Date.now() + duration;

    const sent = await sock.sendMessage(replyJid, {
        text: `💤 *AFTER THE REBIRTH (ATR) - Cycle de Sommeil* 💤\n\n` +
              `Tu t'allonges pour récupérer tes forces pendant 3 minutes...\n\n` +
              `🔷 [◽◽◽◽◽◽◽◽◽◽] 0%`
    });

    const intervalId = setInterval(async () => {
        const p = await Player.findOne({ where: { whatsappId: jid } });
        if (!p || p.mode !== 'sleep') {
            clearInterval(intervalId);
            sleepingPlayers.delete(jid);
            return;
        }

        const now = Date.now();
        if (now >= endTime) {
            clearInterval(intervalId);
            sleepingPlayers.delete(jid);
            await p.update({ mode: 'normal', sleep: 100 });

            await sock.sendMessage(replyJid, {
                text: `🔷 *AFTER THE REBIRTH (ATR) - Réveil !* 🔷\n\n` +
                      `Tu te réveilles en pleine forme ! Ta jauge d'énergie/sommeil a été entièrement restaurée (+100%).\n\n` +
                      `🔷 [🔷🔷🔷🔷🔷🔷🔷🔷🔷🔷] 100%`,
                edit: sent.key
            }).catch(e => console.warn("Erreur réveil message:", e.message));
        } else {
            const elapsed = now - (endTime - duration);
            const percent = Math.min(99, Math.floor((elapsed / duration) * 100));
            const filled = Math.floor(percent / 10);
            const empty = 10 - filled;
            const progressBar = "🔷".repeat(filled) + "◽".repeat(empty);

            let statusText = "Transition vers le sommeil...";
            if (percent >= 15 && percent < 35) {
                statusText = "Sommeil léger. Votre esprit dérive dans les limbes d'After the Rebirth...";
            } else if (percent >= 35 && percent < 55) {
                statusText = "Sommeil lourd. Restauration de vos flux de mana et réparation corporelle...";
            } else if (percent >= 55 && percent < 75) {
                statusText = "Sommeil profond. Rêves lucides de victoires et de renaissance...";
            } else if (percent >= 75) {
                statusText = "Réveil progressif. L'énergie déborde à nouveau dans votre âme...";
            }

            await sock.sendMessage(replyJid, {
                text: `💤 *AFTER THE REBIRTH (ATR) - Cycle de Sommeil* 💤\n\n` +
                      `${statusText}\n\n` +
                      `🔷 [${progressBar}] ${percent}%`,
                edit: sent.key
            }).catch(e => console.warn("Erreur d'édition du sommeil:", e.message));
        }
    }, 20000);

    sleepingPlayers.set(jid, {
        endTime,
        duration,
        intervalId,
        messageKey: sent.key
    });
};

commands.set('dormir', dormirCommand);
commands.set('sleep', dormirCommand);
commands.set('d', dormirCommand);

// Restructured Modular Command Shortcuts/Aliases
commands.set('a', (...args) => commands.get('action')(...args));
commands.set('m', (...args) => commands.get('menu')(...args));
commands.set('p', (...args) => commands.get('profil')(...args));
commands.set('i', (...args) => commands.get('inventory')(...args));
commands.set('q', (...args) => commands.get('quests')(...args));
commands.set('s', (...args) => commands.get('competences')(...args));

// Main command handler
async function handleCommand(sock, message, downloadMediaMessage) {
  if (message.key.fromMe) return;

  const messageText = message.message.conversation || message.message.extendedTextMessage?.text;
  if (!messageText) return;

  const jid = getJid(message);
  const replyJid = message.key.remoteJid;
  const senderName = message.pushName || jid;

  console.log(`[MSG] From "${senderName}" (${jid}) in ${replyJid}: "${messageText}"`);

  const player = await Player.findOne({ where: { whatsappId: jid } });

  // Handle sleep blocking logic
  if (player && (player.mode === 'sleep' || sleepingPlayers.has(player.whatsappId))) {
      const now = Date.now();
      const sleepInfo = sleepingPlayers.get(player.whatsappId);

      if (sleepInfo && now < sleepInfo.endTime) {
          const elapsed = now - (sleepInfo.endTime - sleepInfo.duration);
          const percent = Math.min(99, Math.floor((elapsed / sleepInfo.duration) * 100));
          const filled = Math.floor(percent / 10);
          const empty = 10 - filled;
          const progressBar = "🔷".repeat(filled) + "◽".repeat(empty);
          const timeLeft = Math.ceil((sleepInfo.endTime - now) / 1000);

          await sock.sendMessage(replyJid, {
              text: `💤 *AFTER THE REBIRTH (ATR) - Cycle de Sommeil en cours* 💤\n\n` +
                    `Chuuut... Tu dors profondément en ce moment. Attends de te réveiller avant d'agir !\n\n` +
                    `🔷 [${progressBar}] ${percent}%\n` +
                    `⏳ Temps restant : ${timeLeft} secondes.`
          });
          return; // BLOCK ALL ACTIONS
      } else {
          // If the timer ended or isn't set up (e.g. server restart), wake them up!
          if (sleepInfo) clearInterval(sleepInfo.intervalId);
          sleepingPlayers.delete(player.whatsappId);
          await player.update({ mode: 'normal', sleep: 100 });
      }
  }

  // Handle registration flow
  if (player && player.registrationStep) {
      if (player.registrationStep === 'awaiting_name') {
          const playerName = messageText.trim();
          if (playerName.length > 2 && playerName.length <= 20 && !playerName.startsWith('/')) {
              await player.update({ name: playerName, registrationStep: 'awaiting_gender' });

              // Create a bank account if not exists
              await Bank.findOrCreate({ where: { PlayerWhatsappId: jid } });

              // Assign starting quests
              const startingQuest = await Quest.findOne({ where: { title: 'La Chasse aux Gobelins' } });
              if (startingQuest) {
                  await player.addQuest(startingQuest, { through: { status: 'not_started' } });
              }

              await sock.sendMessage(replyJid, { text: `« ${playerName}... Un nom qui résonnera bientôt dans les couloirs de l'Interstice, je l'espère. »\n\nEnchanté. Quel est ton sexe, Héritier ?` });
          } else {
              await sock.sendMessage(replyJid, { text: "Nom invalide (3-20 caractères, pas de '/'). Réessaie." });
          }
      } else if (player.registrationStep === 'awaiting_gender') {
          const gender = messageText.trim();
          await player.update({ gender, registrationStep: 'awaiting_age' });
          await sock.sendMessage(replyJid, { text: `« Très bien. Et quel est ton âge, Héritier ? Le temps s'écoule différemment ici, mais ton enveloppe charnelle a bien une origine. »` });
      } else if (player.registrationStep === 'awaiting_age') {
          const age = parseInt(messageText.trim());
          if (!isNaN(age) && age > 0 && age < 150) {
              await player.update({ age, registrationStep: 'awaiting_description' });
              await sock.sendMessage(replyJid, { text: `Très bien. Maintenant, décris ton personnage en une phrase (ex: "un épéiste rapide aux cheveux argentés", "une mage spécialisée dans les sorts de glace").` });
          } else {
              await sock.sendMessage(replyJid, { text: "Âge invalide. Réessaie." });
          }
      } else if (player.registrationStep === 'awaiting_description') {
        const description = messageText.trim();
        if (description.length > 10 && description.length <= 150) {
            await player.update({
                characterDescription: description,
                registrationStep: null, // Registration finished
                awaitingProfilePic: true
            });
            await sock.sendMessage(replyJid, { text: `« Je vois... Ton essence commence à se stabiliser. »\n\nDescription enregistrée ! Pour terminer, envoie une image qui représentera ton personnage. Elle sera gravée dans la matrice d'Aetherys.` });
        } else {
            await sock.sendMessage(replyJid, { text: "Description trop courte ou trop longue (10-150 caractères). Réessaie." });
        }
      }
      return;
  }

  if (!player && !messageText.startsWith('/start')) {
    await sock.sendMessage(replyJid, { text: "Utilise /start pour commencer." });
    return;
  }

  // Handle free action mode
  if (player?.mode === 'action' && !messageText.startsWith('/')) {
    try {
        if (player.tutorialStep >= 0 && player.tutorialStep < 3) {
            const { handleTutorialAction } = require('./tutorial-handler');
            await handleTutorialAction(sock, message, player, messageText);
        } else {
            await handleFreeAction(sock, message, player, messageText);
        }
    } catch (error) {
      console.error('Erreur action libre:', error);
      await sock.sendMessage(replyJid, { text: "Le MJ n'a pas pu interpréter ton action. Réessaie." });
    } finally {
        await player.update({ lastActivity: new Date() });
    }
    return;
  }


  // Handle standard commands
  if (!messageText.startsWith('/')) return;

  const args = messageText.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = commands.get(commandName);

  if (command) {
    try {
      await command(sock, message, args);
      if (player) {
          await player.update({ lastActivity: new Date() });
          // Mission completion will be handled by the AI now
      }
    } catch (error) {
      console.error(`Erreur commande ${commandName}:`, error);
      await sock.sendMessage(replyJid, { text: "Une erreur est survenue lors de l'exécution de la commande." });
    }
  } else {
    await sock.sendMessage(replyJid, { text: "Commande inconnue. Tape /help pour voir la liste des commandes." });
  }
}

module.exports = { handleCommand, getJid };
