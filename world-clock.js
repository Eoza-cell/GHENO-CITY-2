const { GlobalState } = require('./database');

/**
 * World Clock Utility for Arise RPG
 * Time Scale: Action-based. 1 action = 10 minutes RP.
 */

async function getActionCount() {
    const [state] = await GlobalState.findOrCreate({
        where: { key: 'total_actions' },
        defaults: { value: '0' }
    });
    return parseInt(state.value) || 0;
}

async function incrementActionCount() {
    const [state] = await GlobalState.findOrCreate({
        where: { key: 'total_actions' },
        defaults: { value: '0' }
    });
    const newVal = (parseInt(state.value) || 0) + 1;
    await state.update({ value: newVal.toString() });
    return newVal;
}

async function getRPTime() {
    const actionCount = await getActionCount();

    // Reference date: Jan 1st 2024, 08:00
    const startTimestamp = new Date('2024-01-01T08:00:00').getTime();

    // 1 action = 10 minutes RP = 600,000 ms
    const rpElapsedMs = actionCount * 600000;
    const rpDate = new Date(startTimestamp + rpElapsedMs);

    const year = rpDate.getFullYear() - 2023;
    const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const month = months[rpDate.getMonth()];
    const day = rpDate.getDate();
    const hours = rpDate.getHours().toString().padStart(2, '0');
    const minutes = rpDate.getMinutes().toString().padStart(2, '0');

    const isDay = rpDate.getHours() >= 6 && rpDate.getHours() < 18;
    const timeIcon = isDay ? "☀️" : "🌙";

    return {
        year,
        month,
        day,
        hours,
        minutes,
        isDay,
        formatted: `📅 An ${year}, ${day} ${month} | ${timeIcon} ${hours}:${minutes}`,
        rawDate: rpDate,
        totalActions: actionCount
    };
}

async function getWorldHeader() {
    const time = await getRPTime();
    return `╔════════════════════════╗\n   ${time.formatted}\n╚════════════════════════╝`;
}

module.exports = { getRPTime, getWorldHeader, incrementActionCount };
