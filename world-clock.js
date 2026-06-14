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

    // Calculate custom components for "An X, Mois Y, Jour Z"
    // Since we use standard Date object on top of a factor,
    // it will follow calendar rules (leap years etc) but 9x faster.

    const day = rpDate.getUTCDate();
    const month = rpDate.getUTCMonth() + 1; // 1-12
    const year = rpDate.getUTCFullYear() - 2023; // An 1 starts in 2024

    const hours = String(rpDate.getUTCHours()).padStart(2, '0');
    const minutes = String(rpDate.getUTCMinutes()).padStart(2, '0');

    return {
        time: `${hours}:${minutes}`,
        date: `Jour ${day}, Mois ${month}, An ${year}`,
        full: `[ 🕒 ${hours}:${minutes} | 📅 Jour ${day}, Mois ${month}, An ${year} ]`
    };
}

module.exports = { getCurrentRPTime };
