// game-state.js
const { getRPTime } = require('./world-clock');
let currentWeather = "clair";

const WEATHERS = ["clair", "nuageux", "pluvieux", "brumeux", "orageux"];

function startDayNightCycle() {
    // Action-based now, so we just randomize weather periodically if we want
    setInterval(() => {
        if (Math.random() < 0.2) {
            currentWeather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
        }
    }, 5 * 60 * 1000); // Check every 5 mins
}

async function isDay() {
  const time = await getRPTime();
  return time.isDay;
}

function getWeather() {
    return currentWeather;
}

function setWeather(newWeather) {
    currentWeather = newWeather;
}

module.exports = { startDayNightCycle, isDay, getWeather, setWeather };
