const { Player, Bank, Item, Skill, NPC, Monster, House, Entity, Club, WorldJournal, Conflict, RPMessage, sequelize } = require('./database');
const { Op } = require('sequelize');
const { checkLevelUp } = require('./level-utils');
const { generatePaperImage } = require('./paper-generator');
const questUtils = require('./quest-utils');
const { shouldNotifyPlayer } = require('./message-handler');

async function processActions(sock, jid, player, actions, aiResponse, nearbyPlayers) {
    const questFeedback = [];
    const playersToUpdate = new Set();
    const notifiedTargets = new Set();

    const playerTargetableActions = [
        'update_location', 'update_stats', 'update_player', 'bank_transaction',
        'add_item', 'remove_item', 'add_skill', 'buy_item', 'use_item',
        'arrest_player', 'set_wanted_level', 'release_player', 'manage_house',
        'set_academic_status', 'get_player_details', 'modify_reputation',
        'resurrect_player', 'forge_pact', 'join_club', 'start_quest',
        'advance_quest', 'complete_quest', 'update_quest', 'p2p_transfer', 'npc_trade',
        'submit_player'
    ];

    for (const actionObj of actions) {
        try {
            const { type, parameters } = actionObj;
            if (!parameters) continue;

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
                    if (sLine) questFeedback.push(sLine);
                    break;
                case 'advance_quest':
                    const aLine = await questUtils.advanceQuest(target, parameters.questTitle, parameters.progress, parameters.note);
                    if (aLine) questFeedback.push(aLine);
                    break;
                case 'complete_quest':
                    const cLine = await questUtils.completeQuest(target, parameters.questTitle, sock);
                    if (cLine) questFeedback.push(cLine);
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
                    break;
                case 'spawn_monster':
                    await Monster.create({ ...parameters, location: player.location });
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
                case 'generate_document':
                    const docBuffer = await generatePaperImage(parameters.content, parameters.title || "DOCUMENT");
                    await sock.sendMessage(jid, { image: docBuffer, caption: `📄 ${parameters.title}` });
                    break;
                case 'query_database':
                    // AI Database Research Logic: Appends findings to WorldJournal so AI sees it in next turns
                    const researchResult = await handleAIDatabaseQuery(parameters);
                    if (researchResult) {
                        await WorldJournal.create({
                            entry: `[RECHERCHE_IA] ${researchResult}`,
                            category: 'plot',
                            importance: 1
                        });
                    }
                    break;
                case 'get_player_details':
                    const pDetails = await handleGetPlayerDetails(parameters.target_name);
                    if (pDetails) {
                        await WorldJournal.create({
                            entry: `[INFO_JOUEUR] ${pDetails}`,
                            category: 'character',
                            importance: 1
                        });
                    }
                    break;
                case 'submit_player':
                    await handleSubmitPlayer(player, target, parameters, questFeedback, playersToUpdate);
                    break;
                // Add other cases as needed...
            }
        } catch (err) {
            console.error(`[Processor] Error in ${actionObj.type}:`, err.message);
        }
    }

    return { questFeedback, playersToUpdate, notifiedTargets };
}

async function handleUpdateLocation(target, params, aiResponse, playersToUpdate) {
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

    // Progression Safeguards: Hard caps per action to prevent accidental "God-mode" leaps
    const MAX_XP_PER_ACTION = 150;
    const MAX_COL_PER_ACTION = 500;
    const MAX_STAT_PER_ACTION = 5;

    // Relative changes
    if (params.col_change) {
        const change = Math.min(params.col_change, MAX_COL_PER_ACTION);
        await target.increment('col', { by: change });
        hasChanged = true;
    }
    if (params.xp_gain) {
        const gain = Math.min(params.xp_gain, MAX_XP_PER_ACTION);
        await target.increment('xp', { by: gain });
        await checkLevelUp(target, sock);
        hasChanged = true;
    }
    if (params.health_change) {
        await target.increment('health', { by: params.health_change });
        hasChanged = true;
    }
    if (params.mana_change) {
        await target.increment('mana', { by: params.mana_change });
        hasChanged = true;
    }

    // Absolute sets (Logical sync)
    if (params.health_set !== undefined) { await target.update({ health: params.health_set }); hasChanged = true; }
    if (params.mana_set !== undefined) { await target.update({ mana: params.mana_set }); hasChanged = true; }
    if (params.col_set !== undefined) { await target.update({ col: params.col_set }); hasChanged = true; }
    if (params.xp_set !== undefined) { await target.update({ xp: params.xp_set }); hasChanged = true; }

    const stats = ['strength', 'agility', 'intelligence', 'defense', 'luck', 'skillPoints'];
    for (const s of stats) {
        const pChange = s === 'skillPoints' ? 'sp_change' : `${s}_change`;
        const pSet = s === 'skillPoints' ? 'sp_set' : `${s}_set`;

        if (params[pChange]) {
            const change = Math.min(params[pChange], MAX_STAT_PER_ACTION);
            await target.increment(s, { by: change });
            hasChanged = true;
        }
        if (params[pSet] !== undefined) {
            // We allow absolute sets (sync) but log if they are suspiciously high
            if (params[pSet] > 500 && !target.isGod) {
                console.warn(`[Safeguard] Suspicious absolute set for ${s}: ${params[pSet]} on player ${target.name}`);
            }

            // Power logic: Rank F cannot have stats > 50
            if (target.rank === 'F' && params[pSet] > 50 && s !== 'skillPoints' && !target.isGod) {
                console.warn(`[Logic] Rank F player ${target.name} tried to exceed 50 in ${s}. Capping.`);
                params[pSet] = 50;
            }
            await target.update({ [s]: params[pSet] });
            hasChanged = true;
        }
    }

    if (hasChanged) {
        await target.reload();

        // Bounds checking
        if (target.health > target.maxHealth) await target.update({ health: target.maxHealth });
        if (target.health <= 0) {
            await target.update({ health: 0, location: 'Nécropolis', subLocation: 'Le Seuil' });
            questFeedback.push(`💀 *MORT* : ${target.name} a trépassé.`);
        }
        if (target.mana > target.maxMana) await target.update({ mana: target.maxMana });
        if (target.mana < 0) await target.update({ mana: 0 });

        await target.reload();
        playersToUpdate.add(target.whatsappId);
    }
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
    const fields = ['name', 'class', 'derivative', 'rank', 'family', 'occupation', 'organization', 'characterDescription', 'profilePicUrl'];
    let hasChanged = false;
    for (const f of fields) {
        const pName = f === 'class' ? 'new_class' : (f === 'rank' ? 'new_rank' : f);
        if (params[pName]) { await target.update({ [f]: params[pName] }); hasChanged = true; }
    }
    if (hasChanged) { await target.reload(); playersToUpdate.add(target.whatsappId); }
}

async function handleBuyItem(target, params, questFeedback, playersToUpdate) {
    const item = await Item.findOne({ where: { name: { [Op.like]: `%${params.itemName}%` } } });
    const quantity = parseInt(params.quantity) || 1;
    if (item && target.col >= (item.price * quantity)) {
        const cost = item.price * quantity;
        await target.decrement('col', { by: cost });
        let inv = JSON.parse(JSON.stringify(target.inventory || []));
        const existing = inv.find(i => i.name === item.name);
        if (existing) existing.quantity = (parseInt(existing.quantity) || 1) + quantity;
        else inv.push({ name: item.name, quantity: quantity });
        target.inventory = inv;
        await target.save();
        questFeedback.push(`🛒 *ACHAT* : ${target.name} a acheté ${quantity}x ${item.name}.`);
        playersToUpdate.add(target.whatsappId);
    }
}

async function handleAddItem(target, params, aiResponse, player, playersToUpdate) {
    const itemName = params.itemName;
    const quantity = parseInt(params.quantity) || 1;
    let inv = JSON.parse(JSON.stringify(target.inventory || []));
    const existing = inv.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (existing) {
        existing.quantity = (parseInt(existing.quantity) || 1) + quantity;
    } else {
        inv.push({ name: itemName, quantity: quantity });
    }
    target.inventory = inv;
    await target.save();
    playersToUpdate.add(target.whatsappId);
}

async function handleRemoveItem(target, params, playersToUpdate) {
    const itemName = params.itemName;
    const quantity = parseInt(params.quantity) || 1;
    let inv = JSON.parse(JSON.stringify(target.inventory || []));
    let idx = inv.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());

    if (idx === -1) {
        idx = inv.findIndex(i => i.name.toLowerCase().includes(itemName.toLowerCase()));
    }

    if (idx !== -1) {
        inv[idx].quantity = (parseInt(inv[idx].quantity) || 1) - quantity;
        if (inv[idx].quantity <= 0) inv.splice(idx, 1);
        target.inventory = inv;
        await target.save();
        playersToUpdate.add(target.whatsappId);
    }
}

async function handleUseItem(target, params, questFeedback, playersToUpdate) {
    let inv = JSON.parse(JSON.stringify(target.inventory || []));
    const idx = inv.findIndex(i => i.name.toLowerCase() === params.itemName.toLowerCase());
    if (idx === -1) {
        // Fallback to fuzzy if exact match fails
        const fuzzyIdx = inv.findIndex(i => i.name.toLowerCase().includes(params.itemName.toLowerCase()));
        if (fuzzyIdx !== -1) {
            return await handleUseItem(target, { ...params, itemName: inv[fuzzyIdx].name }, questFeedback, playersToUpdate);
        }
    }

    if (idx !== -1) {
        const usedItemName = inv[idx].name;
        const item = await Item.findOne({ where: { name: usedItemName } });
        inv[idx].quantity = (parseInt(inv[idx].quantity) || 1) - 1;
        if (inv[idx].quantity <= 0) inv.splice(idx, 1);
        target.inventory = inv;
        await target.save();
        if (item && item.statBonuses) {
            for (const [s, v] of Object.entries(item.statBonuses)) {
                if (['health', 'mana', 'strength', 'agility', 'intelligence', 'luck', 'defense'].includes(s)) {
                    await target.increment(s, { by: v });
                }
            }
        }
        await target.reload();
        playersToUpdate.add(target.whatsappId);
        questFeedback.push(`🎒 *OBJET* : ${target.name} utilise ${usedItemName}.`);
    }
}

async function handleAddSkill(target, params, playersToUpdate) {
    const skill = await Skill.findOne({
        where: {
            [Op.or]: [
                { name: { [Op.like]: `%${params.skillName}%` } },
                { name: params.skillName }
            ]
        }
    });

    if (skill) {
        const hasSkill = await target.hasSkill(skill);
        if (hasSkill) return;

        // Progression Safeguard: Skill acquisition requires SP or "Exam" context
        const isExam = target.subLocation.toLowerCase().includes('académie') || target.subLocation.toLowerCase().includes('école') || params.is_exam;
        const spCost = params.sp_cost || 1;

        if (!isExam && !target.isGod) {
            if (target.skillPoints < spCost) {
                console.log(`[Safeguard] ${target.name} tried to learn ${skill.name} without enough SP.`);
                return;
            }
            await target.decrement('skillPoints', { by: spCost });
        }

        await target.addSkill(skill);
        playersToUpdate.add(target.whatsappId);
    } else {
        console.warn(`[Skills] Skill not found: ${params.skillName}`);
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
        let sInv = JSON.parse(JSON.stringify(sender.inventory || []));
        let idx = sInv.findIndex(i => i.name.toLowerCase() === params.itemName.toLowerCase());
        if (idx === -1) {
            idx = sInv.findIndex(i => i.name.toLowerCase().includes(params.itemName.toLowerCase()));
        }

        if (idx !== -1) {
            const quantity = parseInt(params.quantity) || 1;
            const qty = Math.min(quantity, parseInt(sInv[idx].quantity) || 1);
            const itemRealName = sInv[idx].name;
            sInv[idx].quantity = (parseInt(sInv[idx].quantity) || 1) - qty;
            if (sInv[idx].quantity <= 0) sInv.splice(idx, 1);
            sender.inventory = sInv;
            await sender.save();

            let rInv = JSON.parse(JSON.stringify(recipient.inventory || []));
            const rIdx = rInv.findIndex(i => i.name === itemRealName);
            if (rIdx !== -1) rInv[rIdx].quantity = (parseInt(rInv[rIdx].quantity) || 1) + qty;
            else rInv.push({ name: itemRealName, quantity: qty });
            recipient.inventory = rInv;
            await recipient.save();
            questFeedback.push(`🎒 *ÉCHANGE* : ${sender.name} donne ${qty}x ${itemRealName} à ${recipient.name}.`);
        }
    }
    playersToUpdate.add(sender.whatsappId);
    playersToUpdate.add(recipient.whatsappId);
}

async function handleNPCTrade(player, params, questFeedback, playersToUpdate) {
    const npc = await NPC.findOne({ where: { name: { [Op.like]: `%${params.npc_name}%` }, location: player.location } });
    if (!npc) return;

    const item = await Item.findOne({ where: { name: { [Op.like]: `%${params.itemName}%` } } });
    if (!item) return;

    const quantity = parseInt(params.quantity) || 1;

    if (params.action === 'buy') {
        const cost = item.price * quantity;
        if (player.col >= cost) {
            await player.decrement('col', { by: cost });
            let inv = JSON.parse(JSON.stringify(player.inventory || []));
            const existing = inv.find(i => i.name === item.name);
            if (existing) existing.quantity = (parseInt(existing.quantity) || 1) + quantity;
            else inv.push({ name: item.name, quantity: quantity });
            player.inventory = inv;
            await player.save();
            questFeedback.push(`🤝 *ACHAT PNJ* : Tu as acheté ${quantity}x ${item.name} à ${npc.name}.`);
        }
    } else if (params.action === 'sell') {
        let inv = JSON.parse(JSON.stringify(player.inventory || []));
        const idx = inv.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
        if (idx !== -1) {
            const qty = Math.min(quantity, parseInt(inv[idx].quantity) || 1);
            const gain = Math.floor(item.price * 0.5) * qty;
            const soldItemName = inv[idx].name;
            inv[idx].quantity = (parseInt(inv[idx].quantity) || 1) - qty;
            if (inv[idx].quantity <= 0) inv.splice(idx, 1);
            player.inventory = inv;
            await player.save();
            await player.increment('col', { by: gain });
            questFeedback.push(`🤝 *VENTE PNJ* : Tu as vendu ${qty}x ${soldItemName} à ${npc.name} pour ${gain} Col.`);
        }
    }
    playersToUpdate.add(player.whatsappId);
}

async function handleAIDatabaseQuery(params) {
    const { model, search } = params;
    if (!model || !search) return null;

    try {
        const { NPC, Item, Skill, Kingdom } = require('./database');
        let result = null;

        switch(model.toLowerCase()) {
            case 'npc':
                const npc = await NPC.findOne({ where: { name: { [Op.like]: `%${search}%` } } });
                if (npc) result = `PNJ ${npc.name}: ${npc.role}, Force ${npc.powerLevel}, Spécialité ${npc.specialty}. Bio: ${npc.description}`;
                break;
            case 'item':
                const item = await Item.findOne({ where: { name: { [Op.like]: `%${search}%` } } });
                if (item) result = `OBJET ${item.name}: Type ${item.type}, Prix ${item.price} COL. Desc: ${item.description}`;
                break;
            case 'skill':
                const skill = await Skill.findOne({ where: { name: { [Op.like]: `%${search}%` } } });
                if (skill) result = `COMPÉTENCE ${skill.name}: Type ${skill.type}, Coût ${skill.manaCost} PM. Desc: ${skill.description}`;
                break;
            case 'kingdom':
                const kingdom = await Kingdom.findOne({ where: { name: { [Op.like]: `%${search}%` } } });
                if (kingdom) result = `ROYAUME ${kingdom.name}: Leader ${kingdom.leader}, Militaire ${kingdom.militaryPower}. Lore: ${kingdom.description}`;
                break;
        }
        return result;
    } catch (e) {
        return `Erreur de recherche pour ${model}:${search}`;
    }
}

async function handleGetPlayerDetails(name) {
    if (!name) return null;
    const { Player } = require('./database');
    const p = await Player.findOne({ where: { name: { [Op.like]: `%${name}%` } } });
    if (!p) return `Joueur "${name}" introuvable.`;

    return `STATUT_JOUEUR ${p.name}: Niv ${p.level}, Classe ${p.class}, PV ${p.health}/${p.maxHealth}, PM ${p.mana}/${p.maxMana}, Lieu ${p.location}(${p.subLocation}), Argent ${p.col} COL.`;
}

async function handleSubmitPlayer(master, target, params, questFeedback, playersToUpdate) {
    if (!master || !target || master.whatsappId === target.whatsappId) return;

    // Power Check: Master must be significantly stronger or have high rank
    const masterPower = (master.level * 10) + master.strength + master.intelligence;
    const targetPower = (target.level * 10) + target.strength + target.intelligence;

    if (masterPower < targetPower * 1.5 && !master.isGod) {
        console.log(`[Submission] ${master.name} failed to submit ${target.name}: not strong enough.`);
        return;
    }

    // Level adjustment: Target rises to a fraction of Master's level
    const newLevel = Math.max(target.level, master.level - 5);
    const oldName = target.name;
    const newName = params.new_name || target.name;

    await target.update({
        name: newName,
        level: newLevel,
        organization: `Serviteur de ${master.name}`,
        characterDescription: (target.characterDescription || "") + `\n(A été soumis par ${master.name})`
    });

    questFeedback.push(`⛓️ *SOUMISSION* : ${oldName} est maintenant ${newName}, serviteur de ${master.name}. (Niveau synchronisé au Niv ${newLevel})`);
    playersToUpdate.add(target.whatsappId);
}

/**
 * Applies AI-suggested stat updates with validation and safeguards.
 * @param {Array} updates Array of update objects from AI JSON.
 * @param {Set} playersToUpdate Set of player IDs to notify.
 */
async function applyPlayerUpdates(updates, playersToUpdate) {
    if (!Array.isArray(updates)) return;

    for (const update of updates) {
        try {
            const { playerName, hp, mp, xp, col, sp, status } = update;
            if (!playerName) continue;

            const player = await Player.findOne({ where: { name: { [Op.like]: `%${playerName}%` } } });
            if (!player) continue;

            // Apply validated changes
            const hChange = parseInt(hp) || 0;
            const mChange = parseInt(mp) || 0;
            const xGain = Math.min(parseInt(xp) || 0, 150); // Hard cap 150 XP
            const cGain = Math.min(parseInt(col) || 0, 500); // Hard cap 500 Col
            const sGain = Math.min(parseInt(sp) || 0, 5);   // Hard cap 5 SP

            // Update stats with bounds checking
            let newHp = Math.max(0, Math.min(player.maxHealth, player.health + hChange));
            let newMp = Math.max(0, Math.min(player.maxMana, player.mana + mChange));

            // Handle Status Effects
            let currentStatus = player.statusEffects || [];
            if (Array.isArray(status)) {
                currentStatus = [...new Set([...currentStatus, ...status])];
            }

            await player.update({
                health: newHp,
                mana: newMp,
                xp: player.xp + xGain,
                col: player.col + cGain,
                skillPoints: player.skillPoints + sGain,
                statusEffects: currentStatus
            });

            // Handle death state
            if (newHp === 0 && player.location !== 'Nécropolis') {
                await player.update({ location: 'Nécropolis', subLocation: 'Le Seuil' });
            }

            playersToUpdate.add(player.whatsappId);
            console.log(`[Arbitrator] Applied updates to ${player.name}: HP:${hChange}, XP:${xGain}`);
        } catch (e) {
            console.error("[Arbitrator] Error applying update:", e.message);
        }
    }
}

module.exports = { processActions, applyPlayerUpdates };
