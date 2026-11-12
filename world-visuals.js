const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getPageAsset, getNpcPortrait } = require('./aetherys-visual-pack');

/**
 * Décors officiels du pack AETHERYS.
 * Les numéros renvoient aux pages illustrées du PDF source.
 * Les anciens fichiers locaux restent des solutions de secours.
 */
const SCENE_PAGES = [
  { page: 47, terms: ['eldoria', 'elion', 'solis', 'academie imperiale', 'lame d argent'] },
  { page: 48, terms: ['valkyrr', 'sparkwell', 'lycee de l ether'] },
  { page: 50, terms: ['gheno', 'marche noir', 'ombre silencieuse'] },
  { page: 49, terms: ['sylva', 'foret de l eveil', 'sylva lumia', 'college elfique'] },
  { page: 46, terms: ['necropolis', 'vharos', 'dominion noir'] },
  { page: 51, terms: ['interstice', 'miroir deform'] },
  { page: 44, terms: ['abysse inferieur', 'pandemonium'] }
];

function normalize(value = '') {
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findBackground(player = {}) {
  const location = normalize(player.location);
  const zone = normalize(player.zone);
  const subLocation = normalize(player.subLocation);
  const context = [location, zone, subLocation].filter(Boolean).join(' ');

  const official = SCENE_PAGES.find(entry =>
    entry.terms.some(term => context.includes(normalize(term)))
  );
  if (official) {
    const file = getPageAsset(official.page);
    if (file) return { key: 'pdf-page:' + official.page, file };
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
  return npcs.find(n => n.imageUrl) ||
    npcs.find(n => getNpcPortrait(n)) ||
    null;
}

function sceneHudSvg(width, height, player, npc) {
  const esc = v => String(v || '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const location = esc(player.location || 'Aetherys');
  const sub = esc(player.subLocation || 'Zone inconnue');
  const npcLine = npc ? 'PNJ : ' + esc(npc.name) : 'ZONE ACTIVE';
  const svg = '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="0" y="' + (height-145) + '" width="' + Math.min(width,620) + '" height="145" fill="#071019" fill-opacity="0.88"/>' +
    '<rect x="0" y="' + (height-145) + '" width="10" height="145" fill="#33c7ff"/>' +
    '<text x="34" y="' + (height-102) + '" fill="#dff7ff" font-family="Arial" font-size="30" font-weight="700">' + location + '</text>' +
    '<text x="34" y="' + (height-66) + '" fill="#8ca7bb" font-family="Arial" font-size="19">' + sub + '</text>' +
    '<text x="34" y="' + (height-28) + '" fill="#ffffff" font-family="Arial" font-size="17">' + npcLine + ' • STYLE : ' + esc(player.equippedOutfit || 'Base') + '</text></svg>';
  return Buffer.from(svg);
}

async function buildSceneVisual({ player, npcs = [] }) {
  const background = findBackground(player);
  const featuredNpc = chooseFeaturedNpc(npcs);
  if (!background && !featuredNpc) return null;

  const npcKey = featuredNpc ? 'npc:' + (featuredNpc.id || featuredNpc.name) : 'no-npc';
  const outfitName = player.equippedOutfit || 'base-outfit';
  const visualKey = (background ? background.key : 'no-bg') + '|' + npcKey + '|outfit:' + outfitName;

  try {
    const backgroundBuffer = background ? await fs.promises.readFile(background.file) : null;
    const portraitSource = featuredNpc ? (featuredNpc.imageUrl || getNpcPortrait(featuredNpc)) : null;
    const npcBuffer = portraitSource ? await readVisual(portraitSource) : null;

    if (backgroundBuffer && npcBuffer) {
      const meta = await sharp(backgroundBuffer).metadata();
      const width = meta.width || 1280;
      const height = meta.height || 720;
      const portrait = await sharp(npcBuffer)
        .resize({ width: Math.round(width * 0.52), height: Math.round(height * 0.88), fit: 'contain', withoutEnlargement: true })
        .png().toBuffer();

      const composed = await sharp(backgroundBuffer)
        .resize(width, height, { fit: 'cover' })
        .composite([
          { input: portrait, gravity: 'southeast' },
          { input: sceneHudSvg(width, height, player, featuredNpc), top: 0, left: 0 }
        ])
        .jpeg({ quality: 88 }).toBuffer();

      return {
        buffer: composed,
        key: visualKey,
        caption: '📍 *' + player.location + ' — ' + player.subLocation + '*\n👤 *' + featuredNpc.name + '* est présent dans cette scène.\n👗 *Style de ' + player.name + ' :* ' + outfitName
      };
    }

    if (backgroundBuffer) {
      return {
        buffer: await sharp(backgroundBuffer).resize(1280, 720, { fit: 'cover' })
          .composite([{ input: sceneHudSvg(1280, 720, player, null), top: 0, left: 0 }])
          .jpeg({ quality: 88 }).toBuffer(),
        key: visualKey,
        caption: '📍 *' + player.location + ' — ' + player.subLocation + '*\n👗 *Style :* ' + outfitName
      };
    }

    if (npcBuffer) {
      return {
        buffer: npcBuffer,
        key: visualKey,
        caption: '👤 *' + featuredNpc.name + '* — ' + (featuredNpc.role || 'PNJ')
      };
    }
  } catch (error) {
    console.error('[WORLD VISUAL] Impossible de construire le visuel:', error.message);
  }
  return null;
}

module.exports = { SCENE_PAGES, findBackground, buildSceneVisual, sceneHudSvg };
