// game-state.js
let isCurrentlyDay = true;
let currentWeather = "clair";
let worldSimulationStarted = false;
let worldTickRunning = false;

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
    // Start the clock and persistent world simulation only once per process.
    if (!worldSimulationStarted) {
      worldSimulationStarted = true;
      setTimeout(updateDayNightCycle, DAY_DURATION);
      const runWorldTick = async () => {
        if (worldTickRunning) return;
        worldTickRunning = true;
        try { await require('./world-engine').tickWorld(); }
        catch (error) { console.error('[WORLD] Simulation tick failed:', error.message); }
        finally { worldTickRunning = false; }
      };
      setTimeout(runWorldTick, 15000);
      setInterval(runWorldTick, 5 * 60 * 1000);
      console.log('[WORLD] Simulation persistante activée (cycle de 5 minutes).');
    }
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
