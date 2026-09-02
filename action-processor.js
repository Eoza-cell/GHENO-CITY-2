const { Player, Bank, Item, Skill, NPC, Monster, House, Entity, Club, WorldJournal, Conflict, RPMessage, sequelize } = require('./database');
const { Op } = require('sequelize');
const { checkLevelUp } = require('./level-utils');
const { generatePaperImage } = require('./paper-generator');
const { generateBlackboardImage, generateMagicDetailBoard } = require('./blackboard-generator');
const questUtils = require('./quest-utils');
const { shouldNotifyPlayer } = require('./message-handler');

async function processActions(sock, jid, player, actions, aiResponse, nearbyPlayers) {
    const questFeedback = [];
    const playersToUpdate = new Set();
    const notifiedTargets = new Set();

    const playerTargetableActions = [
        'update_location', 'update_stats', 'update_player', 'bank_transaction',
        'add_item', 'remove_item', 'add_skill', 'buy_item', 'use_item', 'travel_to',
        'arrest_player', 'set_wanted_level', 'release_player', 'manage_house',
        'set_academic_status', 'get_player_details', 'modify_reputation',
        'resurrect_player', 'forge_pact', 'join_club', 'start_quest', 'explain_magic',
        'advance_quest', 'complete_quest', 'update_quest', 'p2p_transfer', 'npc_trade',
        'request_servitude', 'accept_servitude', 'request_fusion', 'accept_fusion', 'dissolve_fusion',
        'trigger_trap', 'apply_status_effect', 'break_equipment', 'social_consequence',
        'create_custom_item', 'manage_house', 'trigger_conflict', 'broadcast', 'notify_player', 'query_database', 'steal_item', 'create_quest'
    ];

    let turnFailed = false;

    for (const actionObj of actions) {
        try {
            const { type, parameters } = actionObj;
            if (!parameters) continue;

            // Global Requirement Failure Block: If a previous requirement check failed, skip subsequent physical/technical actions
            const failureExemptActions = ['write_journal', 'notify_player', 'query_database', 'update_stats']; // Allow some stat changes (penalties)
            if (turnFailed && !failureExemptActions.includes(type)) {
                console.log(`[Processor] Action ${type} skipped: turn failed requirement check.`);
                continue;
            }

            // Global Actor Death Block: If the acting player is dead, they can't perform physical actions
            const actorAllowedActions = ['update_stats', 'update_player', 'write_journal', 'notify_player', 'query_database', 'resurrect_player'];
            if (player.health <= 0 && !actorAllowedActions.includes(type)) {
                console.log(`[Processor] Action ${type} blocked: actor ${player.name} is dead.`);
                continue;
            }

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

            if (!targetFound && playerTargetableActions.includes(type)) {
                console.log(`[Processor] Action ${type} skipped: target "${parameters.target_name}" not found.`);
                continue;
            }

            if (target && target.whatsappId !== player.whatsappId) {
                notifiedTargets.add(target.whatsappId);
            }

            // Global Death Block: Dead players (0 HP) can only be targets of specific actions
            const allowedForDead = ['update_stats', 'resurrect_player', 'update_player', 'write_journal', 'notify_player', 'query_database'];
            if (target && target.health <= 0 && !allowedForDead.includes(type)) {
                console.log(`[Processor] Action ${type} blocked: target ${target.name} is dead.`);
                continue;
            }

            switch (type) {
                case 'update_location':
                    await handleUpdateLocation(target, parameters, aiResponse, playersToUpdate);
                    break;
                case 'update_stats':
                    await handleUpdateStats(target, parameters, questFeedback, playersToUpdate, sock);
                    break;
                case 'bank_transaction':
                    await handleBankTransaction(target, parameters, questFeedback, playersToUpdate);
                    break;
                case 'update_player':
                    await handleUpdatePlayer(target, parameters, questFeedback, playersToUpdate);
                    break;
                case 'add_skill':
                    await handleAddSkill(target, parameters, playersToUpdate);
                    break;
        case 'check_requirements':
            const checkResult = await handleCheckRequirements(target, parameters, aiResponse, playersToUpdate);
            if (checkResult.failed) turnFailed = true;
            break;
                case 'create_custom_skill':
                    await handleCreateCustomSkill(target, parameters, playersToUpdate);
                    break;
                case 'buy_item':
                    await handleBuyItem(target, parameters, questFeedback, playersToUpdate);
                    break;
                case 'use_item':
                    await handleUseItem(target, parameters, questFeedback, playersToUpdate);
                    break;
                case 'add_item':
                    await handleAddItem(target, parameters, aiResponse, player, playersToUpdate);
                    break;
                case 'remove_item':
                    await handleRemoveItem(target, parameters, playersToUpdate);
                    break;
                case 'p2p_transfer':
                    await handleP2PTransfer(player, parameters, questFeedback, playersToUpdate, sock);
                    break;
                case 'npc_trade':
                    await handleNPCTrade(player, parameters, questFeedback, playersToUpdate);
                    break;
                case 'start_quest':
                    const sLine = await questUtils.startQuest(target, parameters.questTitle);
                    if (sLine) {
                        questFeedback.push(sLine);
                        playersToUpdate.add(target.whatsappId);
                    }
                    break;
                case 'modify_quest':
                    const mLine = await questUtils.modifyQuest(target, parameters.questTitle, parameters.branch, parameters.notes);
                    if (mLine) {
                        questFeedback.push(mLine);
                        playersToUpdate.add(target.whatsappId);
                    }
                    break;
                case 'advance_quest':
                    const aLine = await questUtils.advanceQuest(target, parameters.questTitle, parameters.progress, parameters.note);
                    if (aLine) {
                        questFeedback.push(aLine);
                        playersToUpdate.add(target.whatsappId);
                    }
                    break;
                case 'complete_quest':
                    const cLine = await questUtils.completeQuest(target, parameters.questTitle, sock);
                    if (cLine) {
                        questFeedback.push(cLine);
                        playersToUpdate.add(target.whatsappId);
                    }
                    break;
                case 'write_journal':
                    await WorldJournal.create({
                        entry: parameters.entry,
                        importance: parameters.importance || 1,
                        category: parameters.category || 'general'
                    });
                    break;
                case 'spawn_npc':
                    await NPC.create({ ...parameters, location: player.location });
                    playersToUpdate.add(player.whatsappId); // Refresh to see NPC if needed (though usually text is enough)
                    break;
                case 'spawn_monster':
                    await Monster.create({ ...parameters, location: player.location });
                    playersToUpdate.add(player.whatsappId);
                    break;
                case 'change_weather':
                    require('./game-state').setWeather(parameters.weather);
                    break;
                case 'arrest_player':
                    await target.update({ isPrisoner: true, wantedLevel: 0, location: "Empire Impérial d'Elion", subLocation: 'Prison Impériale' });
                    playersToUpdate.add(target.whatsappId);
                    questFeedback.push(`⛓️ *ARRESTATION* : ${target.name} au cachot.`);
                    break;
                case 'release_player':
                    await target.update({ isPrisoner: false, subLocation: "Portes d'Elion" });
                    playersToUpdate.add(target.whatsappId);
                    break;
                case 'travel_to':
                    await handleTravelTo(target, parameters, aiResponse, playersToUpdate);
                    break;
                case 'generate_document':
                    let docBuffer;
                    if (parameters.type === 'blackboard') {
                        docBuffer = await generateBlackboardImage(parameters.content, parameters.title || "TABLEAU");
                    } else {
                        docBuffer = await generatePaperImage(parameters.content, parameters.title || "DOCUMENT");
                    }
                    await sock.sendMessage(jid, { image: docBuffer, caption: parameters.caption || `📄 ${parameters.title}` });
                    break;
                case 'explain_magic':
                    const magicSkill = await Skill.findOne({ where: { name: { [Op.like]: `%${parameters.skillName}%` } } });
                    if (magicSkill) {
                        const detailBuffer = await generateMagicDetailBoard({
                            ...magicSkill.toJSON(),
                            logic: parameters.logic,
                            power: parameters.power,
                            range: parameters.range,
                            complexity: parameters.complexity
                        });
                        await sock.sendMessage(jid, { image: detailBuffer, caption: `📖 *Analyse de Flux : ${magicSkill.name}*` });
                    }
                    break;
                case 'set_wanted_level':
                    await target.update({ wantedLevel: parameters.level != null ? parameters.level : parameters.wantedLevel });
                    playersToUpdate.add(target.whatsappId);
                    break;
                case 'forge_pact':
                    const entity = await Entity.findOne({ where: { name: { [Op.like]: `%${parameters.entityName}%` } } });
                    if (entity) {
                        await target.addEntity(entity);
                        playersToUpdate.add(target.whatsappId);
                    }
                    break;
                case 'join_club':
                    const club = await Club.findOne({ where: { name: { [Op.like]: `%${parameters.clubName}%` } } });
                    if (club) {
                        await target.addClub(club);
                        playersToUpdate.add(target.whatsappId);
                    }
                    break;
                case 'set_academic_status':
                    await target.update({
                        academicYear: parameters.academicYear || target.academicYear,
                        academicGrade: parameters.academicGrade || target.academicGrade,
                        schoolName: parameters.schoolName || target.schoolName
                    });
                    playersToUpdate.add(target.whatsappId);
                    break;
                case 'promote_player':
                    await handlePromotePlayer(player, target, parameters, questFeedback, playersToUpdate);
                    break;
                case 'resurrect_player':
                    await target.update({ health: Math.floor(target.maxHealth * 0.5), location: "Empire Impérial d'Elion", subLocation: 'Cathédrale de la Lumière' });
                    playersToUpdate.add(target.whatsappId);
                    break;
                case 'modify_reputation':
                    await target.increment('influence', { by: parameters.change });
                    playersToUpdate.add(target.whatsappId);
                    break;
                case 'request_servitude':
                    const sMaster = player;
                    const sTarget = await Player.findOne({ where: { name: { [Op.like]: `%${parameters.target_name}%` }, location: player.location } });
                    if (sTarget) {
                        aiResponse.narrative = `${aiResponse.narrative}\n\n📜 *PACT DE SERVITUDE* : ${sMaster.name} propose à ${sTarget.name} de devenir son serviteur. ${sTarget.name} doit accepter pour sceller le lien.`;
                    }
                    break;
                case 'accept_servitude':
                    const aServant = player;
                    const aMaster = await Player.findOne({ where: { name: { [Op.like]: `%${parameters.master_name}%` }, location: player.location } });
                    if (aMaster && !aServant.masterId) {
                        await aServant.update({ masterId: aMaster.whatsappId });
                        // Servant gets 20% of Master's main stats as bonus
                        const bonus = (aMaster.strength + aMaster.agility + aMaster.intelligence) * 0.2;
                        await aServant.update({ servantPowerBonus: bonus });
                        playersToUpdate.add(aServant.whatsappId);
                        questFeedback.push(`🔗 *SERVANTE* : ${aServant.name} est désormais lié à ${aMaster.name}.`);
                    }
                    break;
                case 'request_fusion':
                    const fRequester = player;
                    const fTarget = await Player.findOne({ where: { name: { [Op.like]: `%${parameters.target_name}%` }, location: player.location } });
                    if (fTarget) {
                        aiResponse.narrative = `${aiResponse.narrative}\n\n✨ *FUSION* : ${fRequester.name} propose une fusion d'âmes à ${fTarget.name}. Les puissances seront combinées.`;
                    }
                    break;
                case 'accept_fusion':
                    const p1 = player;
                    const p2 = await Player.findOne({ where: { name: { [Op.like]: `%${parameters.partner_name}%` }, location: player.location } });
                    if (p2 && !p1.fusedWithId && !p2.fusedWithId) {
                        await p1.update({ fusedWithId: p2.whatsappId, fusionSyncLevel: 0.5 });
                        await p2.update({ fusedWithId: p1.whatsappId, fusionSyncLevel: 0.5 });
                        playersToUpdate.add(p1.whatsappId);
                        playersToUpdate.add(p2.whatsappId);
                        questFeedback.push(`🌀 *SYMBIOSE* : ${p1.name} et ${p2.name} ont fusionné !`);
                    }
                    break;
                case 'dissolve_fusion':
                    if (player.fusedWithId) {
                        const partner = await Player.findOne({ where: { whatsappId: player.fusedWithId } });
                        await player.update({ fusedWithId: null, fusionSyncLevel: 0 });
                        if (partner) await partner.update({ fusedWithId: null, fusionSyncLevel: 0 });
                        playersToUpdate.add(player.whatsappId);
                        if (partner) playersToUpdate.add(partner.whatsappId);
                        questFeedback.push(`💔 *DISSOLUTION* : La fusion a pris fin.`);
                    }
                    break;
                case 'trigger_trap':
                    await target.decrement('health', { by: parameters.damage || 20 });
                    playersToUpdate.add(target.whatsappId);
                    questFeedback.push(`🪤 *PIÈGE* : ${target.name} a déclenché un piège !`);
                    break;
                case 'break_equipment':
                    let inv = [...target.inventory];
                    const idx = inv.findIndex(i => i.name.toLowerCase().includes(parameters.itemName?.toLowerCase()));
                    if (idx !== -1) {
                        inv.splice(idx, 1);
                        target.inventory = inv;
                        await target.save();
                        playersToUpdate.add(target.whatsappId);
                        questFeedback.push(`🔨 *DÉGÂTS* : L'équipement de ${target.name} s'est brisé.`);
                    }
                    break;
                case 'social_consequence':
                    await target.decrement('influence', { by: parameters.influence_loss || 10 });
                    playersToUpdate.add(target.whatsappId);
                    questFeedback.push(`📢 *RÉPUTATION* : ${target.name} subit les conséquences de ses actes.`);
                    break;
                case 'apply_status_effect':
                    // Just narrative feedback for now as we don't have a status system in DB yet
                    questFeedback.push(`✨ *ÉTAT* : ${target.name} est sous l'effet : ${parameters.effect}.`);
                    playersToUpdate.add(target.whatsappId);
                    break;
                case 'create_custom_item':
                    const newItem = await Item.create({
                        name: parameters.name,
                        description: parameters.description,
                        type: parameters.type || 'misc',
                        rarity: parameters.rarity || 'rare',
                        statBonuses: parameters.statBonuses || {}
                    });
                    let cInv = [...target.inventory];
                    cInv.push({ name: newItem.name, quantity: 1 });
                    target.inventory = cInv;
                    await target.save();
                    playersToUpdate.add(target.whatsappId);
                    questFeedback.push(`🎁 *OBJET UNIQUE* : ${target.name} a reçu "${parameters.name}".`);
                    break;
                case 'manage_house':
                    const house = await House.findOne({ where: { name: { [Op.like]: `%${parameters.houseName}%` } } });
                    if (house) {
                        if (parameters.action === 'grant') await house.update({ ownerId: target.whatsappId });
                        else if (parameters.action === 'revoke') await house.update({ ownerId: null });
                        playersToUpdate.add(target.whatsappId);
                        questFeedback.push(`🏠 *MAISON* : Le statut de la propriété "${house.name}" a changé.`);
                    }
                    break;
                case 'trigger_conflict':
                    await Conflict.create({
                        title: parameters.title,
                        description: parameters.description,
                        involvedKingdoms: parameters.involvedKingdoms,
                        status: 'active'
                    });
                    aiResponse.broadcastMessage = `⚔️ *NOUVEAU CONFLIT* : ${parameters.title} !`;
                    break;
                case 'broadcast':
                    aiResponse.broadcastMessage = parameters.message;
                    break;
                case 'notify_player':
                    aiResponse.notifications.push({
                        target_name: parameters.target_name,
                        message: parameters.message
                    });
                    break;
                case 'query_database':
                    console.log(`[MJ QUERY] Model: ${parameters.model}, Search: ${parameters.search}`);
                    // AI queries are logged, system provides info in context next turn
                    break;
                case 'steal_item':
                    const victim = target;
                    const thief = player;
                    let vInv = [...victim.inventory];
                    const sIdx = vInv.findIndex(i => i.name.toLowerCase().includes(parameters.itemName?.toLowerCase()));
                    if (sIdx !== -1) {
                        const stolenItem = vInv.splice(sIdx, 1)[0];
                        victim.inventory = vInv;
                        await victim.save();

                        let tInv = [...thief.inventory];
                        const existing = tInv.find(i => i.name === stolenItem.name);
                        if (existing) existing.quantity += 1;
                        else tInv.push({ name: stolenItem.name, quantity: 1 });
                        thief.inventory = tInv;
                        await thief.save();

                        playersToUpdate.add(victim.whatsappId);
                        playersToUpdate.add(thief.whatsappId);
                        questFeedback.push(`🕵️ *VOL* : Un objet a été dérobé à ${victim.name}.`);
                    }
                    break;
                case 'create_quest':
                    await Quest.create({
                        title: parameters.title,
                        description: parameters.description,
                        objective: parameters.objective,
                        rank_required: parameters.rank_required || 'E',
                        reward_col: parameters.reward_col || 0,
                        reward_xp: parameters.reward_xp || 0,
                        type: parameters.type || 'side'
                    });
                    questFeedback.push(`📜 *NOUVELLE MISSION DISPONIBLE* : "${parameters.title}".`);
                    break;
            }
        } catch (err) {
            console.error(`[Processor] Error in ${actionObj.type}:`, err.message);
        }
    }

    return { questFeedback, playersToUpdate, notifiedTargets };
}

async function handleUpdateLocation(target, params, aiResponse, playersToUpdate) {
    if (target.health <= 0) return; // Dead players can't move
    const updates = {};
    if (params.new_location) updates.location = params.new_location;
    if (params.new_sub_location) updates.subLocation = params.new_sub_location;
    await target.update(updates);

    const locationImages = {
        'Académie Impériale': 'assets/locations/academy.jpg',
        'Eldoria': 'assets/locations/eldoria.jpg',
        'Nécropolis': 'assets/locations/necropolis.jpg',
        'L\'Interstice': 'assets/locations/interstice.jpg',
        'Gheno souterrain': 'assets/locations/gheno.jpg'
    };
    const finalLoc = params.new_location || target.location;
    if (locationImages[finalLoc]) aiResponse.imagePrompt = locationImages[finalLoc];
    playersToUpdate.add(target.whatsappId);
}

async function handleUpdateStats(target, params, questFeedback, playersToUpdate, sock) {
    let hasChanged = false;

    // Stat Capping & Progression Safeguards
    const rankMap = { 'G': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'B': 5, 'A': 6, 'S': 7 };
    const playerRankVal = rankMap[target.rank] || 0;
    const statCap = playerRankVal === 1 ? 30 : 9999; // Strict cap for Rank F (Low stats)

    if (params.col_change) { await target.increment('col', { by: params.col_change }); hasChanged = true; }
    if (params.xp_gain) {
        const limitedXP = Math.min(params.xp_gain, 150); // Cap XP gain per action
        await target.increment('xp', { by: limitedXP });
        await checkLevelUp(target, sock);
        hasChanged = true;
    }
    if (params.health_change) {
        await target.increment('health', { by: params.health_change });
        await target.reload();

        // Handle clothing durability and stains on damage in combat
        if (params.health_change < 0) {
            const damageAmt = Math.floor(Math.abs(params.health_change) * 0.4) || 2;
            let newDur = (target.outfitDurability || 100) - damageAmt;
            if (newDur < 0) newDur = 0;

            let newClean = target.outfitCleanliness || 'propre';
            if (Math.abs(params.health_change) >= 15) {
                newClean = 'couvert de sang';
            } else if (Math.abs(params.health_change) >= 5 && newClean === 'propre') {
                newClean = 'taché de boue';
            }

            await target.update({
                outfitDurability: newDur,
                outfitCleanliness: newClean
            });
        }

        // Class-specific recovery bonus
        if (params.health_change > 0 && target.class === 'Moine' && params.is_meditation) {
            await target.increment('mana', { by: Math.floor(params.health_change * 1.5) });
            questFeedback.push(`🧘 *MÉDITATION* : En tant que Moine, ${target.name} récupère aussi son mana.`);
        }

        if (target.health > target.maxHealth) await target.update({ health: target.maxHealth });
        if (target.health <= 0) {
            await target.update({ health: 0, location: 'Nécropolis', subLocation: 'Le Seuil' });
            questFeedback.push(`💀 *MORT* : ${target.name} a trépassé.`);
        }
        hasChanged = true;
    }
    if (params.mana_change) {
        // Enforce mana cost logic: No negative mana unless special power
        await target.increment('mana', { by: params.mana_change });
        await target.reload();
        if (target.mana > target.maxMana) await target.update({ mana: target.maxMana });
        if (target.mana < 0) {
            // Mana Burn/Exhaustion
            const burnDamage = Math.abs(target.mana) * 2;
            await target.update({ mana: 0 });
            await target.decrement('health', { by: burnDamage });
            questFeedback.push(`🔥 *RÉSIDU DE MANA* : ${target.name} a forcé ses limites magiques et subit ${burnDamage} dégâts !`);
        }
        hasChanged = true;
    }
    const stats = ['strength', 'agility', 'intelligence', 'defense', 'luck', 'skillPoints'];
    for (const s of stats) {
        const pName = s === 'skillPoints' ? 'sp_change' : `${s}_change`;
        if (params[pName]) {
            let change = params[pName];
            if (s !== 'skillPoints') {
                // Limit stat growth per action
                change = Math.min(change, 5);
                // Enforce Rank F stat cap
                if (target[s] + change > statCap) change = Math.max(0, statCap - target[s]);
            }
            if (change !== 0) {
                await target.increment(s, { by: change });
                hasChanged = true;
            }
        }
    }
    if (hasChanged) { await target.reload(); playersToUpdate.add(target.whatsappId); }
}

async function handleBankTransaction(target, params, questFeedback, playersToUpdate) {
    await target.reload();
    const [bank] = await Bank.findOrCreate({ where: { PlayerWhatsappId: target.whatsappId } });
    await bank.reload();
    if (params.type === 'deposit' && target.col >= params.amount) {
        await target.decrement('col', { by: params.amount });
        await bank.increment('balance', { by: params.amount });
        questFeedback.push(`🏦 *BANQUE* : ${target.name} a déposé ${params.amount} Col.`);
    } else if (params.type === 'withdraw' && bank.balance >= params.amount) {
        await bank.decrement('balance', { by: params.amount });
        await target.increment('col', { by: params.amount });
        questFeedback.push(`🏦 *BANQUE* : ${target.name} a retiré ${params.amount} Col.`);
    }
    playersToUpdate.add(target.whatsappId);
}

async function handleUpdatePlayer(target, params, questFeedback, playersToUpdate) {
    const fields = ['name', 'class', 'derivative', 'rank', 'family', 'occupation', 'organization', 'characterDescription', 'profilePicUrl', 'fusionSyncLevel'];
    let hasChanged = false;
    for (const f of fields) {
        const pName = f === 'class' ? 'new_class' : (f === 'rank' ? 'new_rank' : f);
        if (params[pName]) { await target.update({ [f]: params[pName] }); hasChanged = true; }
    }
    if (hasChanged) { await target.reload(); playersToUpdate.add(target.whatsappId); }
}

async function handleBuyItem(target, params, questFeedback, playersToUpdate) {
    const item = await Item.findOne({ where: { name: { [Op.like]: `%${params.itemName}%` } } });
    if (item && target.col >= (item.price * (params.quantity || 1))) {
        const cost = item.price * (params.quantity || 1);
        await target.decrement('col', { by: cost });
        let inv = [...target.inventory];
        const existing = inv.find(i => i.name === item.name);
        if (existing) existing.quantity += (params.quantity || 1);
        else inv.push({ name: item.name, quantity: (params.quantity || 1) });
        target.inventory = inv;
        await target.save();
        questFeedback.push(`🛒 *ACHAT* : ${target.name} a acheté ${params.quantity || 1}x ${item.name}.`);
        playersToUpdate.add(target.whatsappId);
    }
}

async function handleTravelTo(target, params, aiResponse, playersToUpdate) {
    if (target.health <= 0) return; // Dead players can't travel
    if (params.new_location || params.new_sub_location) {
        const updates = {};
        if (params.new_location) updates.location = params.new_location;
        if (params.new_sub_location) updates.subLocation = params.new_sub_location;
        await target.update(updates);
        playersToUpdate.add(target.whatsappId);

        // Trigger travel visual
        aiResponse.actionVisual = {
            type: 'travel',
            assetName: params.new_location || target.location,
            title: 'VOYAGE EN COURS',
            description: `Destination : ${params.new_sub_location || params.new_location}`
        };
    }
}

async function handleAddItem(target, params, aiResponse, player, playersToUpdate) {
    let inv = [...target.inventory];
    const existing = inv.find(i => i.name.toLowerCase().includes(params.itemName.toLowerCase()));
    if (existing) existing.quantity += (params.quantity || 1);
    else inv.push({ name: params.itemName, quantity: (params.quantity || 1) });
    target.inventory = inv;
    await target.save();
    playersToUpdate.add(target.whatsappId);
}

async function handleRemoveItem(target, params, playersToUpdate) {
    let inv = [...target.inventory];
    const idx = inv.findIndex(i => i.name.toLowerCase().includes(params.itemName.toLowerCase()));
    if (idx !== -1) {
        inv[idx].quantity -= (params.quantity || 1);
        if (inv[idx].quantity <= 0) inv.splice(idx, 1);
        target.inventory = inv;
        await target.save();
        playersToUpdate.add(target.whatsappId);
    }
}

async function handleUseItem(target, params, questFeedback, playersToUpdate) {
    let inv = [...target.inventory];
    const idx = inv.findIndex(i => i.name.toLowerCase().includes(params.itemName.toLowerCase()));
    if (idx !== -1) {
        const item = await Item.findOne({ where: { name: inv[idx].name } });
        inv[idx].quantity -= 1;
        if (inv[idx].quantity <= 0) inv.splice(idx, 1);
        target.inventory = inv;
        await target.save();
        if (item && item.statBonuses) {
            for (const [s, v] of Object.entries(item.statBonuses)) {
                if (['health', 'mana', 'strength', 'agility', 'intelligence', 'luck', 'defense', 'hunger', 'sleep'].includes(s)) {
                    await target.increment(s, { by: v });
                }
            }
            await target.reload();
            if (target.hunger > 100) await target.update({ hunger: 100 });
            if (target.sleep > 100) await target.update({ sleep: 100 });
            await target.reload();
            const rankCaps = { 'F': 50, 'E': 100, 'D': 150, 'C': 250, 'B': 400, 'A': 600, 'S': 1000 };
            const cap = rankCaps[target.rank] || 50;
            const stats = ['strength', 'agility', 'intelligence', 'defense', 'luck'];
            let capChanged = false;
            for (const s of stats) {
                if (target[s] > cap) {
                    target[s] = cap;
                    capChanged = true;
                }
            }
            if (capChanged) {
                await target.save();
            }
        }

        // Apply dynamic Inebriation (drunkenness) and Poisoning side-effects based on item naming
        const itemNameLower = params.itemName.toLowerCase();
        let effectMsg = "";

        const alcoholKeywords = ["bière", "vin", "alcool", "liqueur", "hydromel", "sake", "beverage", "rum", "whisky", "vodka", "grog", "champagne", "biere"];
        const isAlcohol = alcoholKeywords.some(k => itemNameLower.includes(k));

        const poisonKeywords = ["poison", "venin", "toxique", "potion maudite", "fiole de peste", "arsenic", "cyanure"];
        const isPoison = poisonKeywords.some(k => itemNameLower.includes(k));

        // Dynamic hunger/sleep backup safeguards for intuitive items
        let addedHunger = 0;
        let addedSleep = 0;
        if (["pain", "viande", "nourriture", "steak", "pomme", "biscuit", "gateau", "repas", "ration", "fraise"].some(f => itemNameLower.includes(f))) {
            addedHunger = 45;
        }
        if (["café", "cafe", "sommeil", "dodo", "energy", "repos", "lit"].some(r => itemNameLower.includes(r))) {
            addedSleep = 45;
        }

        if (addedHunger > 0) {
            await target.increment('hunger', { by: addedHunger });
            effectMsg += ` 🍖 *SATIÉTÉ* : +${addedHunger}% de nourriture (➔ ${Math.min(100, target.hunger + addedHunger)}/100)`;
        }
        if (addedSleep > 0) {
            await target.increment('sleep', { by: addedSleep });
            effectMsg += ` 💤 *ÉNERGIE* : +${addedSleep}% d'énergie restaurée (➔ ${Math.min(100, target.sleep + addedSleep)}/100)`;
        }

        if (isAlcohol) {
            const addedInebriation = 30;
            let currentInebriation = (target.inebriationLevel || 0) + addedInebriation;
            if (currentInebriation > 100) currentInebriation = 100;
            await target.update({ inebriationLevel: currentInebriation });
            effectMsg += ` 🥴 *IVRESSE* : +${addedInebriation}% d'alcoolémie (${currentInebriation}% - Soulé)`;
        }

        if (isPoison) {
            await target.update({ isPoisoned: true });
            effectMsg += ` 🤢 *EMPOISONNEMENT* : Un venin se répand dans ton corps !`;
        }

        await target.reload();
        playersToUpdate.add(target.whatsappId);
        questFeedback.push(`🎒 *OBJET* : ${target.name} utilise ${params.itemName}.${effectMsg}`);
    }
}

async function handleAddSkill(target, params, playersToUpdate) {
    const skill = await Skill.findOne({ where: { name: { [Op.like]: `%${params.skillName}%` } } });
    if (skill && !(await target.hasSkill(skill))) {
        const cost = params.sp_cost || 5; // Standard cost is 5 SP
        if (target.skillPoints >= cost) {
            await target.decrement('skillPoints', { by: cost });
            await target.addSkill(skill);
            playersToUpdate.add(target.whatsappId);
        } else {
            console.log(`[Processor] add_skill failed: ${target.name} has only ${target.skillPoints}/${cost} SP.`);
        }
    }
}

async function handleCheckRequirements(target, params, aiResponse, playersToUpdate) {
    const rankMap = { 'G': 0, 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'B': 5, 'A': 6, 'S': 7 };
    const requiredRankValue = rankMap[params.rank_required] || 0;
    const playerRankValue = rankMap[target.rank] || 0;

    let failed = false;
    let reason = "";

    if (playerRankValue < requiredRankValue) {
        failed = true;
        reason = `Rang ${params.rank_required} requis (tu es Rang ${target.rank})`;
    }

    if (params.skill_required) {
        const hasSkill = (await target.getSkills()).some(s => s.name.toLowerCase().includes(params.skill_required.toLowerCase()));
        if (!hasSkill) {
            failed = true;
            reason = `Compétence "${params.skill_required}" requise`;
        }
    }

    if (failed) {
        aiResponse.narrative = `${aiResponse.narrative}\n\n❌ *ÉCHEC CRITIQUE* : ${reason}. L'action a échoué lamentablement.`;
        // Penalize
        await target.decrement('health', { by: 15 });
        playersToUpdate.add(target.whatsappId);
        return { failed: true };
    }
    return { failed: false };
}

async function handleCreateCustomSkill(target, params, playersToUpdate) {
    const cost = params.sp_cost || 10;
    if (target.skillPoints >= cost) {
        const [skill, created] = await Skill.findOrCreate({
            where: { name: params.name },
            defaults: {
                description: params.description,
                type: 'Custom',
                manaCost: params.manaCost || 20,
                statBonuses: params.statBonuses || {}
            }
        });
        await target.addSkill(skill);
        await target.decrement('skillPoints', { by: cost });
        await target.reload();
        playersToUpdate.add(target.whatsappId);
    }
}

async function handleP2PTransfer(player, params, questFeedback, playersToUpdate, sock) {
    const sender = player;
    const recipient = await Player.findOne({ where: { name: { [Op.like]: `%${params.recipient_name}%` }, location: player.location } });
    if (!recipient) return;

    if (params.amount && sender.col >= params.amount) {
        await sender.decrement('col', { by: params.amount });
        await recipient.increment('col', { by: params.amount });
        questFeedback.push(`💰 *TRANSFERT* : ${sender.name} donne ${params.amount} Col à ${recipient.name}.`);
    }

    if (params.itemName) {
        let sInv = [...sender.inventory];
        const idx = sInv.findIndex(i => i.name.toLowerCase().includes(params.itemName.toLowerCase()));
        if (idx !== -1) {
            const qty = Math.min(params.quantity || 1, sInv[idx].quantity);
            const itemRealName = sInv[idx].name;
            sInv[idx].quantity -= qty;
            if (sInv[idx].quantity <= 0) sInv.splice(idx, 1);
            sender.inventory = sInv;
            await sender.save();

            let rInv = [...recipient.inventory];
            const rIdx = rInv.findIndex(i => i.name === itemRealName);
            if (rIdx !== -1) rInv[rIdx].quantity += qty;
            else rInv.push({ name: itemRealName, quantity: qty });
            recipient.inventory = rInv;
            await recipient.save();
            questFeedback.push(`🎒 *ÉCHANGE* : ${sender.name} donne ${qty}x ${itemRealName} à ${recipient.name}.`);
        }
    }
    playersToUpdate.add(sender.whatsappId);
    playersToUpdate.add(recipient.whatsappId);
}

async function handlePromotePlayer(actor, target, params, questFeedback, playersToUpdate) {
    // Only Rank S players or GODs can promote others
    if (!actor.isGod && actor.rank !== 'S') {
        console.log(`[Processor] promote_player failed: ${actor.name} is not Rank S.`);
        return;
    }

    // Must have a skill that allows promotion or breaking limits
    const skills = await actor.getSkills();
    const hasPromotionSkill = skills.some(s => s.name.toLowerCase().includes('briser les limites') || s.name.toLowerCase().includes('éveil') || s.name.toLowerCase().includes('mentor'));

    if (!actor.isGod && !hasPromotionSkill) {
        console.log(`[Processor] promote_player failed: ${actor.name} lacks promotion skill.`);
        return;
    }

    const rankMap = { 'F': 1, 'E': 2, 'D': 3, 'C': 4, 'B': 5, 'A': 6, 'S': 7 };
    const currentRankVal = rankMap[target.rank] || 0;
    const newRank = params.new_rank;

    if (newRank && rankMap[newRank]) {
        await target.update({ rank: newRank });
        playersToUpdate.add(target.whatsappId);
        questFeedback.push(`✨ *ÉVEIL DE RANG* : ${actor.name} a brisé les limites de ${target.name}, l'élevant au Rang ${newRank} !`);
    }
}

async function handleNPCTrade(player, params, questFeedback, playersToUpdate) {
    const npc = await NPC.findOne({ where: { name: { [Op.like]: `%${params.npc_name}%` }, location: player.location, subLocation: player.subLocation } });
    if (!npc) return;

    const item = await Item.findOne({ where: { name: { [Op.like]: `%${params.itemName}%` } } });
    if (!item) return;

    if (params.action === 'buy') {
        const cost = item.price * (params.quantity || 1);
        if (player.col >= cost) {
            await player.decrement('col', { by: cost });
            let inv = [...player.inventory];
            const existing = inv.find(i => i.name === item.name);
            if (existing) existing.quantity += (params.quantity || 1);
            else inv.push({ name: item.name, quantity: (params.quantity || 1) });
            player.inventory = inv;
            await player.save();
            questFeedback.push(`🤝 *ACHAT PNJ* : Tu as acheté ${params.quantity || 1}x ${item.name} à ${npc.name}.`);
        }
    } else if (params.action === 'sell') {
        let inv = [...player.inventory];
        const idx = inv.findIndex(i => i.name.toLowerCase().includes(params.itemName.toLowerCase()));
        if (idx !== -1) {
            const soldItemName = inv[idx].name;
            const qty = Math.min(params.quantity || 1, inv[idx].quantity);
            const gain = Math.floor(item.price * 0.5) * qty;
            inv[idx].quantity -= qty;
            if (inv[idx].quantity <= 0) inv.splice(idx, 1);
            player.inventory = inv;
            await player.save();
            await player.increment('col', { by: gain });
            questFeedback.push(`🤝 *VENTE PNJ* : Tu as vendu ${qty}x ${soldItemName} à ${npc.name} pour ${gain} Col.`);
        }
    }
    playersToUpdate.add(player.whatsappId);
}

module.exports = { processActions };
