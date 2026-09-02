/**
 * World Clock Utility for Arise RPG
 * Time Scale: 10 minutes per Action.
 */

// Keep track of when the server was launched to progress time smoothly from the starting point
const serverLaunchTime = Date.now();

function getRPTime(playerActionsCount = 0) {
    // Virtual starting point: March 31st 2024 at 04:44 (representing Year 23 of Aetherys)
    const virtualStart = new Date('2024-03-31T04:44:00').getTime();

    // Each action adds 10 minutes
    const actionMs = playerActionsCount * 10 * 60 * 1000;

    // Real-time elapsed since server launch
    const elapsedMs = Math.max(0, Date.now() - serverLaunchTime);

    // RP date combines virtual start, real-time drift since launch, and actions
    const rpDate = new Date(virtualStart + elapsedMs + actionMs);

    // Year starts at 23 based on 2024 virtual start
    const year = 23 + (rpDate.getFullYear() - 2024);

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
        formatted: `An ${year}, ${day} ${month} | ${timeIcon} ${hours}:${minutes}`,
        rawDate: rpDate
    };
}

function getWorldHeader() {
    const time = getRPTime();
    return `❖ ═════ ◈ AFTER THE REBIRTH ◈ ═════ ❖\n   📅 ${time.formatted}\n❖ ═════════════════════════════════ ❖`;
}

module.exports = { getRPTime, getWorldHeader };
