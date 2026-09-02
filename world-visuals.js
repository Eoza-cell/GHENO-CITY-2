const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * AETHERYS VISUAL WORLD
 *
 * Backgrounds come from the curated Aetherys art pack.
 * Put them in assets/world/backgrounds/.
 * NPC portraits come from NPC.imageUrl (local path or https URL).
 *
 * This module NEVER generates random scenery: it only uses approved visuals.
 */

const ROOT = path.join(__dirname, 'assets', 'world');

const SCENE_BACKGROUNDS = {
  // Curated PDF environment pages
  'eldoria': 'backgrounds/eldoria.jpg',
  'eldoria|centre-ville': 'backgrounds/eldoria-city.jpg',
  'eldoria|académie': 'backgrounds/academy.jpg',
  'académie impériale': 'backgrounds/academy.jpg',
  'empire impérial d\'elion|centre-ville': 'backgrounds/eldoria-city.jpg',
  'necropolis': 'backgrounds/necropolis.jpg',
  'interstice': 'backgrounds/interstice.jpg',
  'solis': 'backgrounds/solis.jpg',
  'riverbend': 'backgrounds/riverbend.jpg'
};

function normalize(value = '') {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

function findBackground(player) {
  const location = normalize(player.location);
  const zone = normalize(player.zone);
  const subLocation = normalize(player.subLocation);

  const keys = [
    `${location}|${zone}|${subLocation}`,
    `${location}|${subLocation}`,
    `${location}|${zone}`,
    subLocation,
    zone,
    location
  ];

  for (const key of keys) {
    if (SCENE_BACKGROUNDS[key]) {
      const file = path.join(ROOT, SCENE_BACKGROUNDS[key]);
      if (fs.existsSync(file)) return { key: `bg:${key}`, file };
    }
  }
  return null;
}

async function readVisual(source) {
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) {
    const axios = require('axios');
    const response = await axios.get(source, { responseType: 'arraybuffer', timeout: 12000 });
    return Buffer.from(response.data);
  }

  const file = path.isAbsolute(source) ? source : path.join(__dirname, source);
  if (!fs.existsSync(file)) return null;
  return fs.promises.readFile(file);
}

function chooseFeaturedNpc(npcs = []) {
  // An explicitly illustrated NPC always has priority.
  return npcs.find(n => n.imageUrl) || null;
}

async function buildSceneVisual({ player, npcs = [] }) {
  const background = findBackground(player);
  const featuredNpc = chooseFeaturedNpc(npcs);

  if (!background && !featuredNpc) return null;

  const npcKey = featuredNpc ? `npc:${featuredNpc.id || featuredNpc.name}` : 'no-npc';
  const outfitName = player.equippedOutfit || 'base-outfit';
  const visualKey = `${background ? background.key : 'no-bg'}|${npcKey}|outfit:${outfitName}`;

  try {
    const backgroundBuffer = background ? await fs.promises.readFile(background.file) : null;
    const npcBuffer = featuredNpc ? await readVisual(featuredNpc.imageUrl) : null;

    if (backgroundBuffer && npcBuffer) {
      const bg = sharp(backgroundBuffer);
      const meta = await bg.metadata();
      const width = meta.width || 1280;
      const height = meta.height || 720;

      const portrait = await sharp(npcBuffer)
        .resize({
          width: Math.round(width * 0.52),
          height: Math.round(height * 0.88),
          fit: 'contain',
          withoutEnlargement: true
        })
        .png()
        .toBuffer();

      const composed = await bg
        .resize(width, height, { fit: 'cover' })
        .composite([{ input: portrait, gravity: 'southeast' }])
        .jpeg({ quality: 88 })
        .toBuffer();

      return {
        buffer: composed,
        key: visualKey,
        caption: `📍 *${player.location} — ${player.subLocation}*\n👤 *${featuredNpc.name}* est présent dans cette scène.\n👗 *Style de ${player.name} :* ${outfitName}`
      };
    }

    if (backgroundBuffer) {
      return {
        buffer: backgroundBuffer,
        key: visualKey,
        caption: `📍 *${player.location} — ${player.subLocation}*\n👗 *Style :* ${outfitName}`
      };
    }

    if (npcBuffer) {
      return {
        buffer: npcBuffer,
        key: visualKey,
        caption: `👤 *${featuredNpc.name}* — ${featuredNpc.role || 'PNJ'}`
      };
    }
  } catch (error) {
    console.error('[WORLD VISUAL] Impossible de construire le visuel:', error.message);
  }

  return null;
}

module.exports = {
  SCENE_BACKGROUNDS,
  findBackground,
  buildSceneVisual
};
