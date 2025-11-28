const DAY_DURATION_MS = 30 * 60 * 1000; // 30 minutes
let gameTime = 0; // In-game time in milliseconds

function isDay() {
  const cyclePosition = gameTime / DAY_DURATION_MS;
  return cyclePosition % 1 < 0.5; // Day is the first half of the cycle
}

function updateGameTime(tickRate) {
  gameTime += tickRate;
  if (gameTime >= DAY_DURATION_MS) {
    gameTime = 0; // Reset after a full day
  }
}

module.exports = {
  isDay,
  updateGameTime,
  getGameTime: () => gameTime, // Exporting for potential debugging or other features
  DAY_DURATION_MS,
};
