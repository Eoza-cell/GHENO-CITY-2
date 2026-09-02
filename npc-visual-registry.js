/**
 * Visual registry for important NPCs and world illustrations.
 * Image files are intentionally separated from game logic.
 * Put approved files in assets/npcs/ and reference them here.
 */
const NPC_VISUALS = {
  academy_staff: {
    label: "Personnel des académies",
    directory: "assets/npcs/schools",
    supported: true
  },
  important_npcs: {
    label: "PNJ importants",
    directory: "assets/npcs/important",
    supported: true
  }
};

function npcImagePath(filename, group = 'important') {
  return `assets/npcs/${group}/${filename}`;
}

module.exports = { NPC_VISUALS, npcImagePath };
