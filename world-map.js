const sharp = require('sharp');

// ---- Canonical world data (mirrors the seeds in database.js) ----
const WORLD_NAME = 'AETHERYS';

const KINGDOMS = [
    {
        name: "Empire Impérial d'Elion", short: "EMPIRE D'ELION", status: 'Paix',
        color: '#f4c542', fill: 'rgba(244,197,66,0.18)',
        labelPos: [650, 450],
        polygon: [[470, 360], [760, 320], [880, 470], [820, 690], [560, 740], [430, 600]]
    },
    {
        name: 'Royaume de Valkyrr', short: 'VALKYRR', status: 'Trêve',
        color: '#9fd8ff', fill: 'rgba(159,216,255,0.15)',
        labelPos: [520, 220],
        polygon: [[360, 150], [720, 130], [770, 300], [470, 350], [330, 300]]
    },
    {
        name: 'Dominion Noir de Vharos', short: 'VHAROS', status: 'Guerre',
        color: '#b06bff', fill: 'rgba(150,70,220,0.22)',
        labelPos: [950, 620],
        polygon: [[830, 480], [1150, 540], [1180, 850], [950, 920], [770, 720], [840, 600]]
    },
    {
        name: 'Terres Bestiales', short: 'BESTIALIA', status: 'Sauvage',
        color: '#8dc63f', fill: 'rgba(141,198,63,0.15)',
        labelPos: [350, 550],
        polygon: [[150, 350], [330, 290], [430, 600], [410, 770], [200, 750], [120, 550]]
    },
    {
        name: 'Royaume Céleste', short: 'AETHERIA', status: 'Éternel',
        color: '#ffffff', fill: 'rgba(255,255,255,0.25)',
        labelPos: [1150, 250],
        polygon: [[1000, 100], [1300, 80], [1350, 350], [1100, 450], [900, 330]]
    },
    {
        name: 'Nécropolis', short: 'NÉCROPOLIS', status: 'Mort',
        color: '#7f8c8d', fill: 'rgba(127,140,141,0.25)',
        labelPos: [550, 880],
        polygon: [[410, 770], [560, 800], [690, 860], [800, 950], [400, 980], [300, 850]]
    },
    {
        name: 'Gheno souterrain', short: 'GHENO', status: 'Ombre',
        color: '#2c3e50', fill: 'rgba(44,62,80,0.3)',
        labelPos: [150, 200],
        polygon: [[50, 50], [250, 50], [300, 250], [50, 250]]
    }
];

const CONTINENT = [
    [150, 350], [350, 160], [520, 90], [760, 110], [880, 200], [1000, 100],
    [1300, 80], [1350, 350], [1100, 450], [1150, 540], [1180, 850], [950, 920],
    [800, 950], [400, 980], [300, 850], [200, 750], [120, 550]
];

const CITIES = [
    { name: 'Eldoria', sub: 'Cité de départ', x: 610, y: 540, capital: false },
    { name: 'Académie Impériale', sub: 'Académie de magie', x: 700, y: 450, capital: false },
    { name: 'Lux Aeterna', sub: 'Chevaliers du Sang', x: 540, y: 640, capital: false },
    { name: 'Solis', sub: "Capitale d'Elion", x: 660, y: 600, capital: true },
    { name: 'Oakhaven', sub: 'Village de chasseurs', x: 280, y: 520, capital: false },
    { name: 'Gearhead', sub: 'Cité minière', x: 480, y: 240, capital: false },
    { name: 'Palais d\'Argent', sub: 'Cœur Céleste', x: 1180, y: 200, capital: true },
    { name: 'Donjon de la Liche', sub: 'Trône de Vharos', x: 1020, y: 750, capital: true },
    { name: 'Le Seuil', sub: 'Porte des Morts', x: 550, y: 920, capital: true },
    { name: 'Marché Noir', sub: 'Cœur de Gheno', x: 150, y: 150, capital: true }
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
                <stop offset="0%" style="stop-color:#152b3e;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#091520;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="landGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#d4c294;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#bca876;stop-opacity:1" />
            </linearGradient>
            <pattern id="paperPattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" fill="url(#landGrad)" />
                <circle cx="20" cy="20" r="1" fill="#a69466" opacity="0.3" />
                <circle cx="80" cy="40" r="1" fill="#a69466" opacity="0.3" />
                <circle cx="50" cy="70" r="1" fill="#a69466" opacity="0.3" />
            </pattern>
            <filter id="parchmentFilter">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise" />
                <feDiffuseLighting in="noise" lighting-color="#fff5e6" surfaceScale="2">
                    <feDistantLight azimuth="45" elevation="60" />
                </feDiffuseLighting>
            </filter>
            <clipPath id="continentClip">
                <path d="${continentPath}" />
            </clipPath>
        </defs>

        <!-- Ocean with texture -->
        <rect width="100%" height="100%" fill="url(#oceanGrad)" />
        <rect width="100%" height="100%" fill="#ffffff" opacity="0.03" style="filter: url(#parchmentFilter);" />

        <!-- Waves -->
        <g opacity="0.2" fill="none" stroke="#2c5364" stroke-width="1.5">
            <path d="M 100,200 Q 120,180 140,200 T 180,200" />
            <path d="M 400,100 Q 420,80 440,100 T 480,100" />
            <path d="M 1100,600 Q 1120,580 1140,600 T 1180,600" />
            <path d="M 800,800 Q 820,780 840,800 T 880,800" />
        </g>

        <!-- Landmass -->
        <path d="${continentPath}" fill="url(#landGrad)" stroke="#4a3b22" stroke-width="5" style="filter: drop-shadow(0 0 15px rgba(0,0,0,0.6));" />
        <path d="${continentPath}" fill="#000000" opacity="0.05" style="filter: url(#parchmentFilter);" clip-path="url(#continentClip)" />

        <g clip-path="url(#continentClip)">
            ${kingdomsSvg}

            <!-- Mountain Ranges -->
            <g opacity="0.3" fill="none" stroke="#5c4a2a" stroke-width="2">
                <path d="M 500,300 L 520,270 L 540,300 M 520,270 L 530,285" />
                <path d="M 540,320 L 560,290 L 580,320 M 560,290 L 570,305" />
                <path d="M 800,500 L 820,470 L 840,500 M 820,470 L 830,485" />
            </g>

            <!-- Forests -->
            <g opacity="0.3" fill="#2d5a27">
                <circle cx="400" cy="500" r="15" />
                <circle cx="420" cy="480" r="12" />
                <circle cx="380" cy="485" r="10" />
                <circle cx="250" cy="600" r="20" />
                <circle cx="230" cy="580" r="15" />
            </g>
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
