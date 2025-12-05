const { Player, Vehicle, PlayerVehicle } = require('./database');

const WHEEL_SPIN_SPEED_THRESHOLD = 20;
const WHEEL_SPIN_ACCELERATION_THRESHOLD = 10;

/**
 * Handles the logic for a player accelerating a vehicle.
 * @param {Player} player The player instance.
 * @returns {Promise<{success: boolean, narrative: string}>} The result of the action.
 */
async function accelerateVehicle(player) {
  if (!player.drivingVehicleId) {
    return { success: false, narrative: "Tu dois être au volant pour accélérer." };
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  if (!playerVehicle) {
    await player.update({ drivingVehicleId: null }); // Data integrity check
    return { success: false, narrative: "Erreur: Véhicule introuvable. Tu as été éjecté." };
  }

  const vehicle = playerVehicle.Vehicle;
  const engineModifier = playerVehicle.engineHealth / 100;
  let acceleration = (vehicle.acceleration * engineModifier) / vehicle.inertia;
  let narrative = "";

  if (playerVehicle.currentSpeed < WHEEL_SPIN_SPEED_THRESHOLD && acceleration > WHEEL_SPIN_ACCELERATION_THRESHOLD) {
    narrative += "Tu appuies trop fort sur l'accélérateur, les pneus patinent ! ";
    narrative += "\n[POLLINATION PROMPT: Vue arrière d'une voiture de sport, fumée s'échappant des pneus crissants sur l'asphalte, action intense, style cinématique]";
    acceleration *= 0.5; // Patinage
  }

  let newSpeed = playerVehicle.currentSpeed + acceleration;
  if (newSpeed > vehicle.topSpeed * engineModifier) {
    newSpeed = vehicle.topSpeed * engineModifier;
  }

  await playerVehicle.update({ currentSpeed: newSpeed });
  narrative += `Tu accélères... Vitesse actuelle : ${newSpeed.toFixed(0)} km/h.`;
  return { success: true, narrative };
}

/**
 * Handles the logic for a player braking a vehicle.
 * @param {Player} player The player instance.
 * @returns {Promise<{success: boolean, narrative: string}>} The result of the action.
 */
async function brakeVehicle(player) {
  if (!player.drivingVehicleId) {
    return { success: false, narrative: "Tu dois être au volant pour freiner." };
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  if (!playerVehicle) {
    await player.update({ drivingVehicleId: null });
    return { success: false, narrative: "Erreur: Véhicule introuvable. Tu as été éjecté." };
  }

  const vehicle = playerVehicle.Vehicle;
  const deceleration = vehicle.brakePower / vehicle.inertia;
  let newSpeed = playerVehicle.currentSpeed - deceleration;
  if (newSpeed < 0) {
    newSpeed = 0;
  }

  await playerVehicle.update({ currentSpeed: newSpeed });
  let narrative = `Tu freines... Vitesse actuelle : ${newSpeed.toFixed(0)} km/h.`;
  if (deceleration > 15) { // Seuil pour un freinage brusque
    narrative += "\n[POLLINATION PROMPT: Pneu de voiture bloqué crissant sur l'asphalte, laissant une trace de gomme noire, en gros plan, action intense, photoréalisme]";
  }
  return { success: true, narrative };
}

/**
 * Handles the logic for a player entering a vehicle.
 * @param {Player} player The player instance.
 * @param {number} playerVehicleId The ID of the PlayerVehicle entry.
 * @returns {Promise<{success: boolean, narrative: string}>} The result of the action.
 */
async function driveVehicle(player, playerVehicleId) {
  if (player.drivingVehicleId) {
    return { success: false, narrative: "Tu es déjà au volant." };
  }
  if (!playerVehicleId) {
    return { success: false, narrative: "Indique l'ID du véhicule que tu veux conduire." };
  }

  const playerVehicle = await PlayerVehicle.findOne({
    where: { id: playerVehicleId, PlayerWhatsappId: player.whatsappId },
    include: Vehicle,
  });

  if (!playerVehicle) {
    return { success: false, narrative: "Ce n'est pas ton véhicule ou l'ID est incorrect." };
  }

  await player.update({ drivingVehicleId: playerVehicle.id });
  const narrative = `Tu te glisses derrière le volant de ta ${playerVehicle.Vehicle.name}. L'odeur du cuir usé et de l'essence remplit tes narines.\n` +
                    `[POLLINATION PROMPT: Vue à la première personne depuis l'intérieur d'une voiture, mains sur le volant, regardant à travers le pare-brise une rue de la ville la nuit, reflets des néons, cinématique, réaliste]`;
  return { success: true, narrative };
}

/**
 * Handles the logic for a player parking and exiting a vehicle.
 * @param {Player} player The player instance.
 * @returns {Promise<{success: boolean, narrative: string}>} The result of the action.
 */
async function parkVehicle(player) {
  if (!player.drivingVehicleId) {
    return { success: false, narrative: "Tu n'es pas au volant." };
  }

  const playerVehicle = await PlayerVehicle.findByPk(player.drivingVehicleId, { include: Vehicle });
  await player.update({ drivingVehicleId: null });
  await playerVehicle.update({ currentSpeed: 0 }); // Reset speed when parking

  return { success: true, narrative: `Tu as garé la ${playerVehicle.Vehicle.name}.` };
}

module.exports = {
  accelerateVehicle,
  brakeVehicle,
  driveVehicle,
  parkVehicle,
};
