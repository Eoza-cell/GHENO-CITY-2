'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ARCHIVE = path.join(__dirname, 'AETHERYS_visual_pack_for_GHENO_CITY_2.zip');
const ROOT = path.join(__dirname, 'assets', 'world');
const PAGES = path.join(ROOT, 'pages');
const MANIFEST = path.join(ROOT, 'manifest.json');
const MAX_IMAGE_COUNT = 160;
const MAX_FILE_BYTES = 24 * 1024 * 1024;
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

let cachedManifest = null;

function safeImageName(name) {
  const normalized = String(name || '').replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) return false;
  return IMAGE_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

function readZipEntries(buffer) {
  const min = Math.max(0, buffer.length - 0x10000 - 22);
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < min || eocd < 0) throw new Error('Fin de répertoire ZIP introuvable.');
  const count = buffer.readUInt16LE(eocd + 10);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (count > 1000 || directoryOffset >= buffer.length) throw new Error('Répertoire ZIP invalide.');

  const entries = [];
  let cursor = directoryOffset;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = nameBytes.toString((flags & 0x800) ? 'utf8' : 'latin1');

    if (safeImageName(name) && !(flags & 1) && [0, 8].includes(method) &&
        uncompressedSize > 0 && uncompressedSize <= MAX_FILE_BYTES &&
        compressedSize <= MAX_FILE_BYTES && localOffset < buffer.length) {
      entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  ).slice(0, MAX_IMAGE_COUNT);
}

function extractEntry(buffer, entry) {
  const offset = entry.localOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error('En-tête ZIP local invalide pour ' + entry.name);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.length) throw new Error('Données ZIP tronquées pour ' + entry.name);
  const compressed = buffer.subarray(start, end);
  const output = entry.method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed);
  if (output.length !== entry.uncompressedSize) throw new Error('Taille ZIP incohérente pour ' + entry.name);
  return output;
}

async function prepareAetherysVisualPack() {
  if (!fs.existsSync(ARCHIVE)) {
    console.warn('[AETHERYS VISUALS] Pack visuel absent : les visuels locaux déjà présents restent disponibles.');
    return { extracted: 0, available: false };
  }

  try {
    fs.mkdirSync(PAGES, { recursive: true });
    const archive = await fs.promises.readFile(ARCHIVE);
    const entries = readZipEntries(archive);
    if (!entries.length) throw new Error('Aucune image exploitable trouvée dans le pack.');

    const pages = [];
    let totalBytes = 0;
    for (const entry of entries) {
      if (totalBytes + entry.uncompressedSize > MAX_TOTAL_BYTES) {
        console.warn('[AETHERYS VISUALS] Limite de taille atteinte, fin de l’extraction.');
        break;
      }
      try {
        const image = extractEntry(archive, entry);
        const index = pages.length + 1;
        const ext = path.extname(entry.name).toLowerCase() || '.jpg';
        const filename = 'page-' + String(index).padStart(3, '0') + ext;
        const destination = path.join(PAGES, filename);
        await fs.promises.writeFile(destination, image);
        pages.push({ page: index, source: entry.name, file: path.relative(__dirname, destination).replace(/\\/g, '/'), bytes: image.length });
        totalBytes += image.length;
      } catch (error) {
        console.warn('[AETHERYS VISUALS] Image ignorée (' + entry.name + '): ' + error.message);
      }
    }

    const manifest = {
      source: path.basename(ARCHIVE),
      extractedAt: new Date().toISOString(),
      count: pages.length,
      pages
    };
    await fs.promises.writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
    cachedManifest = manifest;
    console.log('[AETHERYS VISUALS] ' + pages.length + ' images du pack chargées dans assets/world/pages/.');
    return { extracted: pages.length, available: pages.length > 0 };
  } catch (error) {
    console.error('[AETHERYS VISUALS] Extraction ignorée sans bloquer le bot :', error.message);
    return { extracted: 0, available: false, error: error.message };
  }
}

function getManifest() {
  if (cachedManifest) return cachedManifest;
  try {
    cachedManifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return cachedManifest;
  } catch {
    return null;
  }
}

function getPageAsset(pageNumber) {
  const manifest = getManifest();
  const entry = manifest?.pages?.find(item => item.page === Number(pageNumber));
  if (!entry) return null;
  const file = path.join(__dirname, entry.file);
  return fs.existsSync(file) ? file : null;
}

function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function getNpcPortrait(npc) {
  const name = normalize(npc?.name);
  if (name.includes('darius') && name.includes('freindry')) return getPageAsset(9);
  if (name.includes('elysia') && name.includes('argentia')) return getPageAsset(39);
  return null;
}

module.exports = {
  prepareAetherysVisualPack,
  getPageAsset,
  getNpcPortrait,
  getManifest
};
