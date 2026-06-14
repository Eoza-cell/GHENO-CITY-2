/**
 * World Clock Utility for Arise / GHENO CITY 2
 * Scale: 1 game day = 160 real minutes (Factor of 9)
 */

const START_DATE = new Date('2024-01-01T00:00:00Z').getTime();
const TIME_FACTOR = 9;

function getCurrentRPTime() {
    const now = Date.now();
    const elapsedRealMs = now - START_DATE;
    const elapsedGMS = elapsedRealMs * TIME_FACTOR;

    const rpDate = new Date(START_DATE + elapsedGMS);

    const day = rpDate.getUTCDate();
    const month = rpDate.getUTCMonth() + 1;
    const year = rpDate.getUTCFullYear() - 2023;

    const hoursNum = rpDate.getUTCHours();
    const minsNum = rpDate.getUTCMinutes();
    const hours = String(hoursNum).padStart(2, '0');
    const minutes = String(minsNum).padStart(2, '0');

    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const dayName = dayNames[rpDate.getUTCDay()];

    // Progress bar for the day (24 hours)
    const totalMinsInDay = 24 * 60;
    const currentMins = (hoursNum * 60) + minsNum;
    const progress = currentMins / totalMinsInDay;
    const barLength = 20;
    const filledCount = Math.floor(progress * barLength);
    const emptyCount = barLength - filledCount;
    const bar = "▰".repeat(filledCount) + "▱".repeat(emptyCount);

    return {
        time: `${hours}:${minutes}`,
        date: `${dayName} ${day}, Mois ${month}, An ${year}`,
        full: `╔═══════ 💠 ═══════╗\n  ${bar}\n  🕒 *HEURE:* ${hours}:${minutes}\n  📅 *DATE:* ${dayName} ${day}, Mois ${month}, An ${year}\n╚═══════ 💠 ═══════╝`
    };
}

module.exports = { getCurrentRPTime };
