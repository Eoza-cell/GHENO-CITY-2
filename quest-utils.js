const { Quest, Player } = require('./database');
const { Op } = require('sequelize');
const { checkLevelUp } = require('./level-utils');

/**
 * Find a quest by (fuzzy) title.
 */
async function findQuest(title) {
    if (!title) return null;
    return Quest.findOne({
        where: {
            [Op.or]: [
                { title: title },
                { title: { [Op.like]: `%${title}%` } }
            ]
        }
    });
}

/**
 * Get the PlayerQuest join row for a player + quest, if any.
 */
async function getPlayerQuest(player, quest) {
    const rows = await player.getQuests({ where: { id: quest.id } });
    return rows.length > 0 ? rows[0].PlayerQuest : null;
}

/**
 * Assign a quest to a player (status in_progress). Idempotent.
 * Returns a short narrative line, or null if nothing changed.
 */
async function startQuest(player, title) {
    const quest = await findQuest(title);
    if (!quest) return null;

    const existing = await getPlayerQuest(player, quest);
    if (existing && existing.status === 'in_progress') return null;
    if (existing && existing.status === 'completed') return null;

    if (existing) {
        await existing.update({ status: 'in_progress', progress: 0 });
    } else {
        await player.addQuest(quest, { through: { status: 'in_progress', progress: 0 } });
    }
    return `📜 *Nouvelle quête${quest.chain ? ` [${quest.chain} • étape ${quest.step}]` : ''}* : ${quest.title}\n${quest.objective || quest.description}`;
}

/**
 * Update the progress of a quest (0-100). Optional note stored per player.
 */
async function advanceQuest(player, title, progress, note) {
    const quest = await findQuest(title);
    if (!quest) return null;
    const pq = await getPlayerQuest(player, quest);
    if (!pq || pq.status === 'completed') return null;

    const newProgress = Math.max(0, Math.min(100, progress != null ? Number(progress) : pq.progress));

    // Auto-Logic: If progress is a increment string like "+1", handle metadata
    if (typeof progress === 'string' && progress.startsWith('+')) {
        const inc = parseInt(progress.substring(1)) || 0;
        const meta = pq.metadata || {};
        meta.counter = (meta.counter || 0) + inc;
        await pq.update({ metadata: meta, progress: newProgress, notes: note || pq.notes });
    } else {
        await pq.update({ progress: newProgress, notes: note || pq.notes });
    }

    return `📈 *${quest.title}* — progression : ${newProgress}%\n${renderProgressBar(newProgress)}`;
}

function renderProgressBar(progress) {
    const size = 10;
    const filled = Math.round((progress / 100) * size);
    const empty = size - filled;
    return "◈" + "▰".repeat(filled) + "▱".repeat(empty) + "◈";
}

/**
 * AI modifies the course of a quest for this player (branch + notes).
 */
async function modifyQuest(player, title, branch, notes) {
    const quest = await findQuest(title);
    if (!quest) return null;
    const pq = await getPlayerQuest(player, quest);
    if (!pq) return null;

    await pq.update({
        branch: branch || pq.branch,
        notes: notes || pq.notes
    });
    return `🔀 *Le cours de la quête "${quest.title}" a changé !*${branch ? ` (${branch})` : ''}${notes ? `\n${notes}` : ''}`;
}

/**
 * Complete a quest: grant rewards, mark completed, auto-start the next quest
 * in the chain (ordered quests). Returns a multi-line narrative string.
 */
async function completeQuest(player, title, sock) {
    const quest = await findQuest(title);
    if (!quest) return null;
    const pq = await getPlayerQuest(player, quest);
    if (!pq || pq.status === 'completed') return null;

    await pq.update({ status: 'completed', progress: 100 });
    await pq.save();

    if (quest.reward_col) await player.increment('col', { by: quest.reward_col });
    if (quest.reward_xp) {
        await player.increment('xp', { by: quest.reward_xp });
        await checkLevelUp(player, sock);
    }
    await player.reload();

    let msg = `✅ *Quête terminée* : ${quest.title}\nRécompense : ${quest.reward_col} Col, ${quest.reward_xp} XP.`;

    // Ordered chain: automatically unlock the next quest.
    if (quest.nextQuestTitle) {
        const nextLine = await startQuest(player, quest.nextQuestTitle);
        if (nextLine) msg += `\n\n➡️ *Suite de "${quest.chain}"*\n${nextLine}`;
    } else if (quest.chain) {
        msg += `\n\n🏆 Tu as terminé la chaîne *"${quest.chain}"* !`;
    }
    return msg;
}

/**
 * Assign a multiplayer/co-op quest to the player and every other player in the
 * same location, so they can interact and progress together.
 * Returns { narrative, notified: [names] }.
 */
async function startMultiplayerQuest(player, title) {
    const quest = await findQuest(title);
    if (!quest) return null;

    const startedSelf = await startQuest(player, title);

    const others = await Player.findAll({
        where: { location: player.location, whatsappId: { [Op.ne]: player.whatsappId } }
    });

    const notified = [];
    for (const other of others) {
        const line = await startQuest(other, title);
        if (line) notified.push({ player: other, line });
    }

    return {
        quest,
        narrative: startedSelf || `📜 *Quête coopérative* : ${quest.title}`,
        notified
    };
}

module.exports = {
    findQuest,
    startQuest,
    advanceQuest,
    modifyQuest,
    completeQuest,
    startMultiplayerQuest,
};
