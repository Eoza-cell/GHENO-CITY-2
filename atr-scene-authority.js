/**
 * ATR Scene Authority
 * The database owns reality; AI only narrates validated context.
 */

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function sameScene(a, b) {
  return normalize(a?.location) === normalize(b?.location) &&
    normalize(a?.zone || 'Centre-ville') === normalize(b?.zone || 'Centre-ville') &&
    normalize(a?.subLocation) === normalize(b?.subLocation);
}

function distanceMeters(a, b) {
  const ax = Number(a?.x ?? 100);
  const ay = Number(a?.y ?? 100);
  const bx = Number(b?.x ?? 100);
  const by = Number(b?.y ?? 100);
  return Math.max(0, Math.round(Math.hypot(ax - bx, ay - by) / 10));
}

function buildSceneSnapshot(activePlayer, players = [], npcs = []) {
  const scenePlayers = players
    .filter(p => String(p.whatsappId) !== String(activePlayer.whatsappId))
    .filter(p => sameScene(activePlayer, p))
    .map(p => ({
      name: p.name,
      distance: distanceMeters(activePlayer, p),
      state: p.state || 'idle',
      rule: 'PASSIVE: immobile and silent unless that player sends an action.'
    }));

  const sceneNpcs = npcs
    .filter(n => sameScene(activePlayer, n))
    .map(n => ({
      name: n.name,
      role: n.role || 'Citoyen',
      personality: n.personality || n.description || 'Neutre'
    }));

  return {
    officialPosition: {
      location: activePlayer.location,
      zone: activePlayer.zone || 'Centre-ville',
      subLocation: activePlayer.subLocation,
      x: Number(activePlayer.x ?? 100),
      y: Number(activePlayer.y ?? 100)
    },
    players: scenePlayers,
    npcs: sceneNpcs
  };
}

function buildAuthorityRules() {
  return [
    'DATABASE STATE IS THE ONLY OFFICIAL REALITY.',
    'Process exactly one current player action.',
    'After the direct consequence, STOP. Wait for a new real player message.',
    'Never continue with a second player action.',
    'Never invent a new official location, NPC, player, quest reward, item, skill or building.',
    'Silent players remain physically still and do not speak, think aloud, decide or act.',
    'Same city is not the same scene. Only exact scene matches are present.',
    'Narrative history is contextual only and can never override official state.'
  ].join('\n');
}

module.exports = { sameScene, distanceMeters, buildSceneSnapshot, buildAuthorityRules };
