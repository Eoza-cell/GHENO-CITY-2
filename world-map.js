const sharp = require('sharp');

// ---- Canonical world data (mirrors the seeds in database.js) ----
const WORLD_NAME = 'AETHERYS';

const KINGDOMS = [
    {
        name: "Empire Impérial d'Elion", short: "EMPIRE D'ELION", status: 'Paix',
        color: '#f4c542', fill: 'rgba(244,197,66,0.16)',
        labelPos: [620, 410],
        polygon: [[470, 360], [760, 320], [880, 470], [820, 690], [560, 740], [430, 600]]
    },
    {
        name: 'Royaume de Valkyrr', short: 'VALKYRR', status: 'Trêve',
        color: '#9fd8ff', fill: 'rgba(159,216,255,0.14)',
        labelPos: [520, 200],
        polygon: [[360, 150], [720, 130], [770, 300], [470, 350], [330, 300]]
    },
    {
        name: 'Dominion Noir de Vharos', short: 'DOMINION NOIR', status: 'Guerre',
        color: '#b06bff', fill: 'rgba(150,70,220,0.20)',
        labelPos: [890, 560],
        polygon: [[830, 480], [1040, 540], [1060, 760], [880, 850], [770, 720], [840, 600]]
    }
];

const CONTINENT = [
    [330, 290], [350, 160], [520, 90], [760, 110], [880, 200], [900, 330],
    [1010, 470], [1075, 620], [1040, 800], [880, 880], [690, 860], [560, 800],
    [410, 770], [300, 640], [270, 470]
];

const CITIES = [
    { name: 'Eldoria', sub: 'Cité de départ', x: 610, y: 540, capital: false },
    { name: 'Académie Impériale', sub: 'Académie de magie', x: 700, y: 450, capital: false },
    { name: 'Lux Aeterna', sub: 'Chevaliers du Sang', x: 540, y: 640, capital: false },
    { name: 'Solis', sub: "Capitale d'Elion", x: 660, y: 600, capital: true }
];

const RANK_COLORS = {
    E: '#7bd88f', D: '#69b7ff', C: '#ffd24d', B: '#ff9a3d', A: '#ff5d5d', S: '#c34bff'
};
const DUNGEONS = [
    { name: 'Forêt des Gobelins', rank: 'E', x: 400, y: 470, glyph: 'tree' },
    { name: 'Mine de Cobalt', rank: 'D', x: 650, y: 230, glyph: 'mountain' },
    { name: 'Caverne des Ombres', rank: 'C', x: 860, y: 360, glyph: 'cave' },
    { name: "Labyrinthe d'Aincrad", rank: 'B', x: 720, y: 720, glyph: 'tower' },
    { name: "Volcan d'Ignis", rank: 'A', x: 985, y: 660, glyph: 'volcano' },
    { name: 'Donjon du Destin', rank: 'S', x: 950, y: 790, glyph: 'skull' }
];

function getGlyphSvg(glyph, x, y, color) {
    const s = 11;
    if (glyph === 'tree') return `<path d="M ${x},${y - s} L ${x + s * 0.7},${y + s * 0.4} L ${x - s * 0.7},${y + s * 0.4} Z" fill="${color}" stroke="#2a2118" stroke-width="1.5" />`;
    if (glyph === 'mountain') return `<path d="M ${x - s},${y + s * 0.5} L ${x},${y - s} L ${x + s},${y + s * 0.5} Z" fill="${color}" stroke="#2a2118" stroke-width="1.5" />`;
    if (glyph === 'volcano') return `
        <path d="M ${x - s},${y + s * 0.5} L ${x - s * 0.3},${y - s * 0.6} L ${x + s * 0.3},${y - s * 0.6} L ${x + s},${y + s * 0.5} Z" fill="${color}" stroke="#2a2118" stroke-width="1.5" />
        <path d="M ${x - s * 0.3},${y - s * 0.6} L ${x},${y - s * 1.3} L ${x + s * 0.3},${y - s * 0.6} Z" fill="#ff7a2d" />`;
    if (glyph === 'cave') return `<path d="M ${x - s * 0.8},${y + s * 0.5} L ${x + s * 0.8},${y + s * 0.5} A ${s * 0.8},${s * 0.8} 0 0,0 ${x - s * 0.8},${y + s * 0.5} Z" fill="${color}" stroke="#2a2118" stroke-width="1.5" />`;
    if (glyph === 'tower') return `<rect x="${x - s * 0.5}" y="${y - s}" width="${s}" height="${s * 1.6}" fill="${color}" stroke="#2a2118" stroke-width="1.5" />`;
    if (glyph === 'skull') return `
        <circle cx="${x}" cy="${y - 2}" r="${s * 0.7}" fill="${color}" stroke="#2a2118" stroke-width="1.5" />
        <circle cx="${x - 3}" cy="${y - 3}" r="1.8" fill="#1a1410" />
        <circle cx="${x + 3}" cy="${y - 3}" r="1.8" fill="#1a1410" />`;
    return '';
}

async function generateWorldMapImage() {
    const W = 1400, H = 1000;

    const continentPath = `M ${CONTINENT.map(p => p.join(',')).join(' L ')} Z`;

    let kingdomsSvg = '';
    KINGDOMS.forEach(k => {
        const polyPath = `M ${k.polygon.map(p => p.join(',')).join(' L ')} Z`;
        kingdomsSvg += `<path d="${polyPath}" fill="${k.fill}" stroke="${k.color}" stroke-width="2" stroke-dasharray="8,6" />`;
    });

    let labelsSvg = '';
    KINGDOMS.forEach(k => {
        const cx = k.labelPos[0], cy = k.labelPos[1];
        labelsSvg += `
            <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="serif" font-weight="bold" font-size="22" fill="${k.color}" style="filter: drop-shadow(0 0 4px rgba(0,0,0,0.6));">${k.short}</text>
            <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="serif" font-style="italic" font-size="15" fill="#3c2d19">« ${k.status} »</text>
        `;
    });

    let dungeonsSvg = '';
    DUNGEONS.forEach(d => {
        const color = RANK_COLORS[d.rank];
        dungeonsSvg += `
            ${getGlyphSvg(d.glyph, d.x, d.y - 16, color)}
            <path d="M ${d.x},${d.y - 9} L ${d.x + 9},${d.y} L ${d.x},${d.y + 9} L ${d.x - 9},${d.y} Z" fill="${color}" stroke="#2a2118" stroke-width="1.5" style="filter: drop-shadow(0 0 5px ${color});" />
            <text x="${d.x}" y="${d.y}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-weight="bold" font-size="11" fill="#1a1410">${d.rank}</text>
            <text x="${d.x}" y="${d.y + 12}" text-anchor="middle" dominant-baseline="hanging" font-family="serif" font-size="13" fill="#2a2118">${d.name}</text>
        `;
    });

    let citiesSvg = '';
    CITIES.forEach(c => {
        if (c.capital) {
            citiesSvg += `
                <path d="M ${c.x},${c.y - 13} L ${c.x + 3},${c.y - 6} L ${c.x + 10},${c.y - 6} L ${c.x + 5},${c.y} L ${c.x + 7},${c.y + 7} L ${c.x},${c.y + 3} L ${c.x - 7},${c.y + 7} L ${c.x - 5},${c.y} L ${c.x - 10},${c.y - 6} L ${c.x - 3},${c.y - 6} Z" fill="#f4c542" stroke="#5c4a2a" stroke-width="1.5" style="filter: drop-shadow(0 0 8px #f4c542);" />
            `;
        } else {
            citiesSvg += `
                <circle cx="${c.x}" cy="${c.y}" r="7" fill="#f6f1e3" stroke="#8a2b22" stroke-width="3" />
                <circle cx="${c.x}" cy="${c.y}" r="3" fill="#8a2b22" />
            `;
        }
        citiesSvg += `
            <text x="${c.x + 14}" y="${c.y - 2}" dominant-baseline="middle" font-family="serif" font-weight="bold" font-size="${c.capital ? 18 : 16}" fill="#1a1410">${c.name}</text>
            <text x="${c.x + 14}" y="${c.y + 13}" dominant-baseline="middle" font-family="serif" font-style="italic" font-size="12" fill="#5c4a2a">${c.sub}</text>
        `;
    });

    const svg = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#1b3a55;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0e2236;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="landGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#e9dcb5;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#cdb988;stop-opacity:1" />
            </linearGradient>
            <clipPath id="continentClip">
                <path d="${continentPath}" />
            </clipPath>
        </defs>

        <rect width="100%" height="100%" fill="url(#oceanGrad)" />

        <!-- Landmass -->
        <path d="${continentPath}" fill="url(#landGrad)" stroke="#5c4a2a" stroke-width="4" style="filter: drop-shadow(0 0 20px rgba(0,0,0,0.5));" />

        <g clip-path="url(#continentClip)">
            ${kingdomsSvg}
        </g>

        ${labelsSvg}
        ${dungeonsSvg}
        ${citiesSvg}

        <!-- Title -->
        <rect x="${W/2 - 320}" y="24" width="640" height="78" fill="rgba(20,12,6,0.72)" stroke="#c9a24a" stroke-width="3" />
        <text x="${W/2}" y="64" text-anchor="middle" font-family="serif" font-weight="bold" font-size="44" fill="#f4e3b0">CARTE DU MONDE — ${WORLD_NAME}</text>
        <text x="${W/2}" y="90" text-anchor="middle" font-family="serif" font-style="italic" font-size="18" fill="#cbb682">Continent de l'Empire, des terres libres et du Dominion Noir</text>

        <!-- Legend -->
        <g transform="translate(40, ${H - 240})">
            <rect width="320" height="200" fill="rgba(20,12,6,0.78)" stroke="#c9a24a" stroke-width="2" />
            <text x="16" y="26" font-family="serif" font-weight="bold" font-size="18" fill="#f4e3b0">LÉGENDE</text>
            <circle cx="24" cy="52" r="6" fill="#8a2b22" />
            <text x="40" y="57" font-family="sans-serif" font-size="14" fill="#e9dcb5">Cité / lieu</text>
            <path d="M 170,44 L 172,48 L 176,48 L 173,51 L 174,56 L 170,53 L 166,56 L 167,51 L 164,48 L 168,48 Z" fill="#f4c542" />
            <text x="186" y="57" font-family="sans-serif" font-size="14" fill="#e9dcb5">Capitale</text>
            <text x="16" y="84" font-family="sans-serif" font-size="14" fill="#e9dcb5">Donjons par rang :</text>
            ${Object.keys(RANK_COLORS).map((r, i) => {
                const rx = 24 + (i % 3) * 95;
                const ry = 110 + Math.floor(i / 3) * 30;
                return `
                <path d="M ${rx},${ry-7} L ${rx+7},${ry} L ${rx},${ry+7} L ${rx-7},${ry} Z" fill="${RANK_COLORS[r]}" stroke="#2a2118" />
                <text x="${rx+14}" y="${ry+5}" font-family="sans-serif" font-size="14" fill="#e9dcb5">Rang ${r}</text>
                `;
            }).join('')}
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateWorldMapImage, WORLD_NAME };
