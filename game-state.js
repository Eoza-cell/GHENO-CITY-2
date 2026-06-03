// game-state.js
let isCurrentlyDay = true;

const DAY_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const NIGHT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

function updateDayNightCycle() {
  isCurrentlyDay = !isCurrentlyDay;
  //console.log(isCurrentlyDay ? "Le soleil se lève sur la Terre." : "La nuit tombe sur la Terre.");
  setTimeout(updateDayNightCycle, isCurrentlyDay ? DAY_DURATION : NIGHT_DURATION);
}

function startDayNightCycle() {
    // Start the first cycle immediately
    setTimeout(updateDayNightCycle, DAY_DURATION);
}

function isDay() {
  return isCurrentlyDay;
}

module.exports = { startDayNightCycle, isDay };
