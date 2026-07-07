const sharp = require('sharp');

// ---- Canonical world data (mirrors the seeds in database.js) ----
const WORLD_NAME = 'AETHERYS';

const KINGDOMS = [
    // --- AETHERIA (High Fantasy Coast) ---
    { name: "Empire Impérial d'Elion", short: "ELION", continent: "Aetheria", color: '#f4c542', fill: 'rgba(244,197,66,0.15)', labelPos: [430, 440], polygon: [[380, 360], [450, 340], [540, 370], [560, 480], [510, 540], [390, 530], [360, 450], [350, 380]] },
    { name: 'Royaume de Valkyrr', short: 'VALKYRR', continent: "Aetheria", color: '#9fd8ff', fill: 'rgba(159,216,255,0.12)', labelPos: [450, 240], polygon: [[380, 180], [480, 160], [550, 200], [540, 340], [450, 340], [380, 310], [360, 250]] },
    { name: 'Gheno souterrain', short: 'GHENO', continent: "Aetheria", color: '#2c3e50', fill: 'rgba(44,62,80,0.25)', labelPos: [290, 340], polygon: [[260, 310], [340, 300], [360, 380], [270, 390], [250, 350]] },
    { name: 'Forêt de l\'Éveil', short: 'SYLVA', continent: "Aetheria", color: '#2ecc71', fill: 'rgba(46,204,113,0.15)', labelPos: [240, 460], polygon: [[180, 380], [340, 370], [370, 540], [200, 560], [160, 480], [150, 420]] },
    { name: 'Archipel des Murmures', short: 'MURMURES', continent: "Aetheria", color: '#1abc9c', fill: 'rgba(26,188,156,0.15)', labelPos: [180, 240], polygon: [[120, 180], [260, 170], [300, 280], [140, 320], [100, 250]] },

    // --- ZENDORA (The Wild Lands) ---
    { name: 'Terres Bestiales', short: 'BESTIALIA', continent: "Zendora", color: '#e67e22', fill: 'rgba(230,126,34,0.15)', labelPos: [960, 740], polygon: [[880, 680], [1020, 660], [1060, 780], [1010, 860], [890, 840], [860, 760], [850, 720]] },
    { name: 'Bastion d\'Orkh', short: 'ORKH', continent: "Zendora", color: '#c0392b', fill: 'rgba(192,57,43,0.15)', labelPos: [1160, 760], polygon: [[1080, 680], [1220, 670], [1260, 820], [1180, 880], [1070, 850], [1060, 750]] },
    { name: 'Montagnes de Fer', short: 'IRON', continent: "Zendora", color: '#7f8c8d', fill: 'rgba(127,140,141,0.15)', labelPos: [1060, 920], polygon: [[980, 870], [1140, 870], [1160, 980], [1050, 990], [970, 950], [960, 900]] },
    { name: 'Désert d\'Ambre', short: 'AMBRE', continent: "Zendora", color: '#f1c40f', fill: 'rgba(241,196,15,0.15)', labelPos: [1140, 590], polygon: [[1070, 530], [1240, 540], [1260, 650], [1150, 680], [1060, 640], [1050, 580]] },

    // --- UMBRA (The Shadow Continent) ---
    { name: 'Dominion Noir de Vharos', short: 'VHAROS', continent: "Umbra", color: '#8e44ad', fill: 'rgba(142,68,173,0.15)', labelPos: [240, 760], polygon: [[170, 680], [330, 670], [360, 820], [280, 870], [160, 840], [150, 750]] },
    { name: 'Nécropolis', short: 'NÉCROPOLIS', continent: "Umbra", color: '#34495e', fill: 'rgba(52,73,94,0.25)', labelPos: [460, 770], polygon: [[370, 680], [530, 690], [560, 840], [450, 880], [360, 830], [350, 750]] },
    { name: 'L\'Interstice', short: 'INTERSTICE', continent: "Umbra", color: '#000000', fill: 'rgba(0,0,0,0.4)', labelPos: [360, 930], polygon: [[280, 880], [440, 880], [460, 990], [350, 980], [270, 940], [260, 900]] },
    { name: 'Cité de Verre', short: 'VERRE', continent: "Umbra", color: '#ecf0f1', fill: 'rgba(236,240,241,0.15)', labelPos: [110, 740], polygon: [[30, 680], [160, 670], [180, 820], [80, 860], [20, 800], [10, 740]] },

    // --- CAELUM (The Floating Continent) ---
    { name: 'Royaume Céleste', short: 'CELESTIA', continent: "Caelum", color: '#ffffff', fill: 'rgba(255,255,255,0.3)', labelPos: [940, 240], polygon: [[870, 170], [1030, 160], [1060, 320], [960, 380], [860, 340], [850, 250]] },
    { name: 'Abysse Inférieur', short: 'ABYSSE', continent: "Caelum", color: '#e74c3c', fill: 'rgba(231,76,60,0.2)', labelPos: [1160, 260], polygon: [[1070, 180], [1230, 170], [1260, 330], [1170, 390], [1060, 350], [1050, 250]] },
    { name: 'Origine de l\'Existence', short: 'ORIGINE', continent: "Caelum", color: '#f39c12', fill: 'rgba(243,156,18,0.2)', labelPos: [1060, 90], polygon: [[970, 20], [1140, 10], [1160, 140], [1050, 170], [960, 130], [950, 70]] },
    { name: 'Cité de l\'Aube', short: 'AURORE', continent: "Caelum", color: '#d35400', fill: 'rgba(211,84,0,0.2)', labelPos: [1140, 460], polygon: [[1070, 370], [1240, 360], [1260, 520], [1150, 560], [1060, 510], [1050, 440]] }
];

const CONTINENTS_SHAPES = [
    { name: "Aetheria", polygon: [[120, 150], [180, 130], [250, 110], [350, 120], [450, 130], [520, 115], [580, 110], [610, 200], [630, 320], [610, 450], [590, 550], [500, 580], [420, 590], [320, 580], [250, 570], [180, 580], [110, 540], [90, 450], [70, 330], [90, 220]] },
    { name: "Zendora", polygon: [[850, 550], [920, 530], [1000, 520], [1100, 530], [1200, 540], [1280, 580], [1340, 680], [1320, 780], [1310, 880], [1240, 950], [1150, 980], [1050, 990], [950, 970], [880, 940], [820, 850], [800, 780], [790, 700], [810, 620]] },
    { name: "Umbra", polygon: [[50, 660], [120, 650], [200, 640], [320, 645], [450, 650], [520, 700], [580, 780], [560, 880], [540, 960], [450, 985], [350, 990], [250, 995], [150, 970], [80, 940], [30, 880], [25, 800], [20, 750], [30, 700]] },
    { name: "Caelum", polygon: [[860, 60], [950, 40], [1050, 30], [1150, 40], [1250, 60], [1310, 120], [1340, 220], [1320, 350], [1280, 450], [1180, 480], [1080, 490], [980, 485], [880, 460], [840, 400], [820, 300], [825, 220], [830, 150], [845, 100]] }
];

const CITIES = [
    // Elion
    { name: 'Eldoria', sub: 'Cité de départ', x: 400, y: 500, capital: false },
    { name: 'Solis', sub: "Capitale d'Elion", x: 450, y: 450, capital: true },
    { name: 'Riverbend', sub: 'Port Fluvial', x: 380, y: 460, capital: false },
    { name: 'Green-Fields', sub: 'Grenier d\'Elion', x: 480, y: 520, capital: false },
    { name: 'Portes d\'Elion', sub: 'Garde Royale', x: 520, y: 480, capital: false },
    // Valkyrr
    { name: 'Gearhead', sub: 'Cité minière', x: 420, y: 240, capital: false },
    { name: 'Sparkwell', sub: 'Cité Technomage', x: 480, y: 200, capital: true },
    { name: 'Grand Laboratoire', sub: 'Recherche Alpha', x: 520, y: 260, capital: false },
    // Gheno
    { name: 'Marché Noir', sub: 'Cœur de Gheno', x: 300, y: 350, capital: true },
    { name: 'Caveau des Ombres', sub: 'Trésors Volés', x: 280, y: 380, capital: false },
    // Sylva
    { name: 'Sylva-Lumia', sub: 'Cité de Lumière', x: 250, y: 450, capital: true },
    { name: 'Arbre-Mère', sub: 'Cœur Elfique', x: 220, y: 420, capital: false },
    // Zendora / Bestialia
    { name: 'Oakhaven', sub: 'Village Chasseur', x: 920, y: 720, capital: false },
    { name: 'Pic du Prédateur', sub: 'Sommet Sauvage', x: 980, y: 780, capital: true },
    // Bastion d'Orkh
    { name: 'Fort-Sang', sub: 'Capitale Orc', x: 1150, y: 750, capital: true },
    { name: 'Arène de Fer', sub: 'Lieu de Combat', x: 1180, y: 720, capital: false },
    // Umbra / Vharos
    { name: 'Marais Putrides', sub: 'Entrée Dominion', x: 200, y: 700, capital: false },
    { name: 'Donjon de la Liche', sub: 'Trône Noir', x: 250, y: 750, capital: true },
    // Nécropolis
    { name: 'Le Seuil', sub: 'Porte des Morts', x: 450, y: 750, capital: true },
    { name: 'Allée des Tombeaux', sub: 'Repos Éternel', x: 420, y: 780, capital: false },
    // Caelum
    { name: 'Palais d\'Argent', sub: 'Cœur Céleste', x: 950, y: 250, capital: true },
    { name: 'Abysse Inférieur', sub: 'Pandémonium', x: 1150, y: 250, capital: true },
    { name: 'Zenith Absolu', sub: 'Origine', x: 1050, y: 50, capital: true }
];

const RANK_COLORS = {
    E: '#7bd88f', D: '#69b7ff', C: '#ffd24d', B: '#ff9a3d', A: '#ff5d5d', S: '#c34bff'
};
const DUNGEONS = [
    // Aetheria
    { name: 'Forêt des Gobelins', rank: 'E', x: 350, y: 480, glyph: 'tree' },
    { name: 'Mine de Cobalt', rank: 'D', x: 450, y: 280, glyph: 'mountain' },
    { name: 'Caverne des Ombres', rank: 'C', x: 320, y: 320, glyph: 'cave' },
    // Zendora
    { name: 'Arène de Fer', rank: 'B', x: 1100, y: 800, glyph: 'tower' },
    { name: 'Canyon des Crânes', rank: 'A', x: 1200, y: 750, glyph: 'cave' },
    { name: 'Mines Rouges', rank: 'D', x: 1050, y: 850, glyph: 'mountain' },
    // Umbra
    { name: 'Champs Éternels', rank: 'C', x: 300, y: 720, glyph: 'tree' },
    { name: 'Fissure du Néant', rank: 'A', x: 350, y: 920, glyph: 'volcano' },
    { name: 'Labyrinthe de Cristal', rank: 'S', x: 100, y: 800, glyph: 'tower' },
    // Caelum
    { name: 'Cascade des Lumières', rank: 'B', x: 1000, y: 350, glyph: 'volcano' },
    { name: 'Fosse de Sang', rank: 'A', x: 1200, y: 200, glyph: 'skull' },
    { name: 'Portes du Temps', rank: 'S', x: 1050, y: 120, glyph: 'tower' }
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

    let continentsSvg = '';
    CONTINENTS_SHAPES.forEach(c => {
        const path = `M ${c.polygon.map(p => p.join(',')).join(' L ')} Z`;
        continentsSvg += `
            <!-- Land Glow -->
            <path d="${path}" fill="none" stroke="${c.name === 'Umbra' ? '#4a0082' : '#c9a24a'}" stroke-width="12" opacity="0.2" style="filter: blur(10px);" />
            <!-- Land Surface -->
            <path d="${path}" fill="url(#landGrad)" stroke="#4a3b22" stroke-width="3" style="filter: url(#roughEdge) drop-shadow(0 0 10px rgba(0,0,0,0.5));" />
            <!-- Continent Name -->
            <text x="${c.polygon[0][0] + 80}" y="${c.polygon[0][1] + 80}" font-family="serif" font-weight="900" font-size="35" fill="#4a3b22" opacity="0.15" letter-spacing="15" transform="rotate(-5, ${c.polygon[0][0]}, ${c.polygon[0][1]})">${c.name.toUpperCase()}</text>
        `;
    });

    let kingdomsSvg = '';
    KINGDOMS.forEach(k => {
        const polyPath = `M ${k.polygon.map(p => p.join(',')).join(' L ')} Z`;
        kingdomsSvg += `<path d="${polyPath}" fill="${k.fill}" stroke="${k.color}" stroke-width="1.5" stroke-dasharray="4,4" />`;
    });

    let labelsSvg = '';
    KINGDOMS.forEach(k => {
        const cx = k.labelPos[0], cy = k.labelPos[1];
        labelsSvg += `
            <text x="${cx}" y="${cy}" text-anchor="middle" font-family="serif" font-weight="bold" font-size="16" fill="${k.color}" style="filter: drop-shadow(0 0 3px rgba(0,0,0,0.8));">${k.short}</text>
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
            <filter id="roughEdge">
                <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
            </filter>
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

        <!-- Landmasses -->
        ${continentsSvg}

        <g>
            ${kingdomsSvg}

            <!-- Geographical Features -->
            <g opacity="0.25" fill="none" stroke="#5c4a2a" stroke-width="2">
                <!-- Mountains Aetheria -->
                <path d="M 400,200 L 420,170 L 440,200 M 420,170 L 430,185" />
                <path d="M 440,220 L 460,190 L 480,220 M 460,190 L 470,205" />
                <!-- Mountains Zendora -->
                <path d="M 1000,800 L 1020,770 L 1040,800" />
                <path d="M 1040,820 L 1060,790 L 1080,820" />
            </g>

            <!-- Forests -->
            <g opacity="0.2" fill="#2d5a27">
                <!-- Aetheria Forest -->
                <circle cx="250" cy="450" r="30" />
                <circle cx="280" cy="430" r="25" />
                <circle cx="220" cy="470" r="20" />
                <!-- Zendora Jungle -->
                <circle cx="950" cy="750" r="40" />
                <circle cx="980" cy="730" r="35" />
            </g>
        </g>

        ${labelsSvg}
        ${dungeonsSvg}
        ${citiesSvg}

        <!-- Title -->
        <rect x="${W/2 - 320}" y="24" width="640" height="78" fill="rgba(20,12,6,0.72)" stroke="#c9a24a" stroke-width="3" />
        <text x="${W/2}" y="64" text-anchor="middle" font-family="serif" font-weight="bold" font-size="44" fill="#f4e3b0">CARTE DU MONDE — ${WORLD_NAME}</text>
        <text x="${W/2}" y="90" text-anchor="middle" font-family="serif" font-style="italic" font-size="18" fill="#cbb682">Aetheria, Zendora, Umbra et Caelum</text>

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
