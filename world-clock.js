/**
 * World Clock Utility for Arise RPG
 * Time Scale: 1:9 (1 day RP = 2h40m Real Time)
 */

function getRPTime() {
    // Reference date: Jan 1st 2024
    const startDate = new Date('2024-01-01').getTime();
    const now = Date.now();
    const elapsedMs = now - startDate;

    // Scale 1:9
    const rpElapsedMs = elapsedMs * 9;

    const rpDate = new Date(startDate + rpElapsedMs);

    const year = rpDate.getFullYear() - 2023; // Year 1 starts in 2024
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
        rawDate: rpDate
    };
}

function getWorldHeader() {
    const time = getRPTime();
    return `╔════════════════════════╗\n   ${time.formatted}\n╚════════════════════════╝`;
}

module.exports = { getRPTime, getWorldHeader };
