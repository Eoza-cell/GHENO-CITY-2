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

function sceneHudSvg(width, height, player, npc) {
  const esc = v => String(v || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const location = esc(player.location || 'Aetherys');
  const sub = esc(player.subLocation || 'Zone inconnue');
  const npcLine = npc ? `PNJ : ${esc(npc.name)}` : 'ZONE ACTIVE';
  const outfit = esc(player.equippedOutfit || 'Base');
  const rankColor = { F:'#8d99ae', E:'#00e676', D:'#00e5ff', C:'#448aff', B:'#bf00ff', A:'#ff6d00', S:'#ffd700', SS:'#ff1744' }[player.rank] || '#ffd700';
  const barWidth = Math.min(width, 660);
  const barHeight = 158;
  const top = height - barHeight;

  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hudFade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#05030f" stop-opacity="0"/>
        <stop offset="35%" stop-color="#05030f" stop-opacity="0.82"/>
        <stop offset="100%" stop-color="#020108" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="hudEdge" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#33c7ff"/>
        <stop offset="100%" stop-color="#ffd700" stop-opacity="0.25"/>
      </linearGradient>
      <linearGradient id="hudSheen" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <filter id="hudGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="hudShadow" x="-20%" y="-20%" width="150%" height="160%">
        <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.8"/>
      </filter>
    </defs>

    <rect x="0" y="${top - 90}" width="${width}" height="${barHeight + 90}" fill="url(#hudFade)"/>

    <g filter="url(#hudShadow)">
      <rect x="18" y="${top + 14}" width="${barWidth}" height="${barHeight - 30}" rx="14" fill="rgba(6, 12, 24, 0.86)" stroke="rgba(51, 199, 255, 0.30)" stroke-width="1.4"/>
      <rect x="18" y="${top + 14}" width="${barWidth}" height="${barHeight - 30}" rx="14" fill="url(#hudSheen)"/>
      <rect x="18" y="${top + 14}" width="5" height="${barHeight - 30}" rx="2.5" fill="url(#hudEdge)"/>

      <g transform="translate(62, ${top + 74})">
        <polygon points="0,-24 24,0 0,24 -24,0" fill="#0a0f1e" stroke="${rankColor}" stroke-width="2" filter="url(#hudGlow)"/>
        <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="9" font-weight="900" fill="${rankColor}" text-anchor="middle">LVL</text>
        <text x="0" y="16" font-family="'Segoe UI', sans-serif" font-size="15" font-weight="900" fill="#ffffff" text-anchor="middle">${esc(player.level || 1)}</text>
      </g>

      <g transform="translate(104, ${top + 46})">
        <text font-family="'Segoe UI', sans-serif" font-size="32" font-weight="900" fill="#eaf9ff" letter-spacing="1" filter="url(#hudGlow)">${location}</text>
        <text y="26" font-family="'Segoe UI', sans-serif" font-size="17" fill="#7fa8bd">${sub}</text>
        <text y="52" font-family="monospace" font-size="14" font-weight="bold" fill="${rankColor}">◆ ${esc(player.rank || 'F')} • ${esc(player.name || '')}</text>
      </g>

      <g transform="translate(${barWidth - 34}, ${top + 40})" text-anchor="end">
        <text font-family="monospace" font-size="12" font-weight="bold" fill="#ffd700">◆ ${esc(Number(player.col || 0).toLocaleString('fr-FR'))} COL</text>
        <text y="20" font-family="monospace" font-size="12" fill="#c9b6ff">✦ ${esc(player.equippedWeapon || '—')}</text>
        <text y="40" font-family="monospace" font-size="12" fill="#7de8ff">◈ ${npcLine}</text>
        <text y="60" font-family="monospace" font-size="12" fill="#8fb6c9">❖ STYLE : ${outfit}</text>
      </g>
    </g>
  </svg>`);
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
        .composite([{ input: portrait, gravity: 'southeast' }, { input: sceneHudSvg(width, height, player, featuredNpc), top: 0, left: 0 }])
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
        buffer: await sharp(backgroundBuffer).resize(1280, 720, { fit: 'cover' }).composite([{ input: sceneHudSvg(1280, 720, player, null), top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer(),
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
  buildSceneVisual,
  sceneHudSvg
};
