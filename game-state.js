// game-state.js
let isCurrentlyDay = true;
let currentWeather = "clair";

const WEATHERS = ["clair", "nuageux", "pluvieux", "brumeux", "orageux"];

const DAY_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const NIGHT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

function updateDayNightCycle() {
  isCurrentlyDay = !isCurrentlyDay;

  // Update weather randomly each cycle change
  if (Math.random() < 0.4) {
      currentWeather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
  }

  //console.log(isCurrentlyDay ? "Le soleil se lève sur Gheno City." : "La nuit tombe sur Gheno City.");
  setTimeout(updateDayNightCycle, isCurrentlyDay ? DAY_DURATION : NIGHT_DURATION);
}

function startDayNightCycle() {
    // Start the first cycle immediately
    setTimeout(updateDayNightCycle, DAY_DURATION);
}

function isDay() {
  return isCurrentlyDay;
}

function getWeather() {
    return currentWeather;
}

function setWeather(newWeather) {
    currentWeather = newWeather;
}

module.exports = { startDayNightCycle, isDay, getWeather, setWeather };
