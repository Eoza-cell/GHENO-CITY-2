const sharp = require('sharp');

// ---- Canonical world data (mirrors the seeds in database.js) ----
const WORLD_NAME = 'AETHERYS';

const KINGDOMS = [
    // --- AETHERIA (High Fantasy Coast) ---
    { name: "Empire Impérial d'Elion", short: "ELION", continent: "Aetheria", color: '#f4c542', fill: 'rgba(244,197,66,0.11)', labelPos: [430, 440], polygon: [[380, 360], [450, 340], [540, 370], [560, 480], [510, 540], [390, 530], [360, 450], [350, 380]] },
    { name: 'Royaume de Valkyrr', short: 'VALKYRR', continent: "Aetheria", color: '#9fd8ff', fill: 'rgba(159,216,255,0.09)', labelPos: [450, 245], polygon: [[380, 180], [480, 160], [550, 200], [540, 340], [450, 340], [380, 310], [360, 250]] },
    { name: 'Gheno souterrain', short: 'GHENO', continent: "Aetheria", color: '#cf7fff', fill: 'rgba(207,127,255,0.11)', labelPos: [290, 340], polygon: [[260, 310], [340, 300], [360, 380], [270, 390], [250, 350]] },
    { name: 'Forêt de l\'Éveil', short: 'SYLVA', continent: "Aetheria", color: '#2ecc71', fill: 'rgba(46,204,113,0.10)', labelPos: [240, 460], polygon: [[180, 380], [340, 370], [370, 540], [200, 560], [160, 480], [150, 420]] },
    { name: 'Archipel des Murmures', short: 'MURMURES', continent: "Aetheria", color: '#1abc9c', fill: 'rgba(26,188,156,0.11)', labelPos: [180, 240], polygon: [[120, 180], [260, 170], [300, 280], [140, 320], [100, 250]] },

    // --- ZENDORA (The Wild Lands) ---
    { name: 'Terres Bestiales', short: 'BESTIALIA', continent: "Zendora", color: '#e67e22', fill: 'rgba(230,126,34,0.11)', labelPos: [960, 740], polygon: [[880, 680], [1020, 660], [1060, 780], [1010, 860], [890, 840], [860, 760], [850, 720]] },
    { name: 'Bastion d\'Orkh', short: 'ORKH', continent: "Zendora", color: '#c0392b', fill: 'rgba(192,57,43,0.11)', labelPos: [1160, 760], polygon: [[1080, 680], [1220, 670], [1260, 820], [1180, 880], [1070, 850], [1060, 750]] },
    { name: 'Montagnes de Fer', short: 'IRON', continent: "Zendora", color: '#bdc3c7', fill: 'rgba(189,195,199,0.11)', labelPos: [1060, 920], polygon: [[980, 870], [1140, 870], [1160, 980], [1050, 990], [970, 950], [960, 900]] },
    { name: 'Désert d\'Ambre', short: 'AMBRE', continent: "Zendora", color: '#f1c40f', fill: 'rgba(241,196,15,0.11)', labelPos: [1140, 590], polygon: [[1070, 530], [1240, 540], [1260, 650], [1150, 680], [1060, 640], [1050, 580]] },

    // --- UMBRA (The Shadow Continent) ---
    { name: 'Dominion Noir de Vharos', short: 'VHAROS', continent: "Umbra", color: '#9b59b6', fill: 'rgba(155,89,182,0.11)', labelPos: [240, 760], polygon: [[170, 680], [330, 670], [360, 820], [280, 870], [160, 840], [150, 750]] },
    { name: 'Nécropolis', short: 'NÉCROPOLIS', continent: "Umbra", color: '#34495e', fill: 'rgba(52,73,94,0.15)', labelPos: [460, 770], polygon: [[370, 680], [530, 690], [560, 840], [450, 880], [360, 830], [350, 750]] },
    { name: 'L\'Interstice', short: 'INTERSTICE', continent: "Umbra", color: '#ffffff', fill: 'rgba(0,0,0,0.3)', labelPos: [360, 930], polygon: [[280, 880], [440, 880], [460, 990], [350, 980], [270, 940], [260, 900]] },
    { name: 'Cité de Verre', short: 'VERRE', continent: "Umbra", color: '#00eeee', fill: 'rgba(0,238,238,0.11)', labelPos: [110, 740], polygon: [[30, 680], [160, 670], [180, 820], [80, 860], [20, 800], [10, 740]] },

    // --- CAELUM (The Floating Continent) ---
    { name: 'Royaume Céleste', short: 'CELESTIA', continent: "Caelum", color: '#ffffff', fill: 'rgba(255,255,255,0.22)', labelPos: [940, 240], polygon: [[870, 170], [1030, 160], [1060, 320], [960, 380], [860, 340], [850, 250]] },
    { name: 'Abysse Inférieur', short: 'ABYSSE', continent: "Caelum", color: '#e74c3c', fill: 'rgba(231,76,60,0.15)', labelPos: [1160, 260], polygon: [[1070, 180], [1230, 170], [1260, 330], [1170, 390], [1060, 350], [1050, 250]] },
    { name: 'Origine de l\'Existence', short: 'ORIGINE', continent: "Caelum", color: '#f39c12', fill: 'rgba(243,156,18,0.15)', labelPos: [1060, 90], polygon: [[970, 20], [1140, 10], [1160, 140], [1050, 170], [960, 130], [950, 70]] },
    { name: 'Cité de l\'Aube', short: 'AURORE', continent: "Caelum", color: '#e67e22', fill: 'rgba(230,126,34,0.15)', labelPos: [1140, 460], polygon: [[1070, 370], [1240, 360], [1260, 520], [1150, 560], [1060, 510], [1050, 440]] }
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

/**
 * Procedural helper to draw detailed 3D shaded cartographic mountain peaks.
 * Mimics high-end fantasy map generator aesthetics.
 */
function drawMountainPeak(x, y, scale = 1.0) {
    const w = 24 * scale;
    const h = 20 * scale;
    return `
        <!-- Shaded left slope -->
        <polygon points="${x},${y - h} ${x - w},${y} ${x},${y}" fill="#b8a178" stroke="#332715" stroke-width="1.2" />
        <!-- Illuminated right slope -->
        <polygon points="${x},${y - h} ${x + w},${y} ${x},${y}" fill="#e8dec3" stroke="#332715" stroke-width="1.2" />
        <!-- Ridge line -->
        <line x1="${x}" y1="${y - h}" x2="${x}" y2="${y}" stroke="#332715" stroke-width="1.5" />
        <!-- Ridge shadow highlights -->
        <line x1="${x}" y1="${y - h}" x2="${x - w * 0.3}" y2="${y - h * 0.3}" stroke="#332715" stroke-width="1" />
    `;
}

/**
 * Procedural helper to draw overlapping tree crown symbols.
 * Mimics hand-drawn fantasy forest layouts.
 */
function drawForestCluster(cx, cy, count = 7, r = 13) {
    let svg = '';
    const points = [
        { dx: 0, dy: 0 },
        { dx: -12, dy: -6 },
        { dx: 12, dy: -4 },
        { dx: -6, dy: 8 },
        { dx: 8, dy: 8 },
        { dx: -16, dy: 4 },
        { dx: 16, dy: 6 }
    ];

    points.slice(0, count).forEach(p => {
        const x = cx + p.dx;
        const y = cy + p.dy;
        const radius = r * (0.85 + Math.random() * 0.3);
        svg += `
            <!-- Shadow ellipse under tree crown -->
            <ellipse cx="${x}" cy="${y + radius * 0.8}" rx="${radius}" ry="${radius * 0.3}" fill="rgba(0,0,0,0.12)" />
            <!-- Little tree trunk -->
            <line x1="${x}" y1="${y + radius * 0.5}" x2="${x}" y2="${y + radius * 1.3}" stroke="#132414" stroke-width="2.2" />
            <!-- Overlapping vibrant green tree crown -->
            <circle cx="${x}" cy="${y}" r="${radius}" fill="#335c36" stroke="#132414" stroke-width="1.2" />
            <circle cx="${x - radius * 0.25}" cy="${y - radius * 0.25}" r="${radius * 0.4}" fill="#4a7d4d" opacity="0.65" />
        `;
    });
    return svg;
}

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

    // Compass Rose Coordinates and Grid details
    const compassX = 720;
    const compassY = 480;

    let continentsSvg = '';
    CONTINENTS_SHAPES.forEach(c => {
        const path = `M ${c.polygon.map(p => p.join(',')).join(' L ')} Z`;
        continentsSvg += `
            <!-- MULTIPLE NAUTICAL SHORELINE/COASTLINE ECHOES (Azgaar / Historical Map Style) -->
            <path d="${path}" fill="none" stroke="#223e59" stroke-width="3" opacity="0.6" />
            <path d="${path}" fill="none" stroke="#284a6b" stroke-width="8" opacity="0.35" />
            <path d="${path}" fill="none" stroke="#2f587d" stroke-width="15" opacity="0.22" stroke-dasharray="8,4" />
            <path d="${path}" fill="none" stroke="#35668f" stroke-width="25" opacity="0.10" stroke-dasharray="4,8" />

            <!-- Sublayered Terrain Contour / Altitude Shading (Lowland, Highland, Alpine) -->
            <path d="${path}" fill="url(#lowlandGrad)" stroke="#3e311a" stroke-width="2" style="filter: url(#roughEdge) drop-shadow(0 4px 15px rgba(0,0,0,0.6));" />

            <!-- Inset contour for Highland elevation -->
            <path d="${path}" transform="translate(${(c.name === 'Aetheria' || c.name === 'Umbra' ? 5 : -5)}, 5) scale(0.97)" fill="url(#highlandGrad)" opacity="0.45" />
            <path d="${path}" transform="translate(${(c.name === 'Aetheria' || c.name === 'Umbra' ? 12 : -12)}, 12) scale(0.93)" fill="url(#alpineGrad)" opacity="0.25" />

            <!-- Large continent text banner -->
            <text x="${c.polygon[0][0] + 120}" y="${c.polygon[0][1] + 100}" font-family="Georgia, serif" font-weight="900" font-size="44" fill="#312613" opacity="0.16" letter-spacing="22" transform="rotate(-6, ${c.polygon[0][0] + 120}, ${c.polygon[0][1] + 100})">${c.name.toUpperCase()}</text>
        `;
    });

    let kingdomsSvg = '';
    KINGDOMS.forEach(k => {
        const polyPath = `M ${k.polygon.map(p => p.join(',')).join(' L ')} Z`;
        // Beautiful fine region outlines with contrasting colors
        kingdomsSvg += `<path d="${polyPath}" fill="${k.fill}" stroke="${k.color}" stroke-width="2" stroke-dasharray="5,6" style="filter: drop-shadow(0 0 3px ${k.color});" />`;
    });

    let labelsSvg = '';
    KINGDOMS.forEach(k => {
        const cx = k.labelPos[0], cy = k.labelPos[1];
        labelsSvg += `
            <!-- Tech-fantasy banner background for region label -->
            <rect x="${cx - 65}" y="${cy - 12}" width="130" height="24" fill="rgba(15,10,5,0.72)" stroke="${k.color}" stroke-width="1.2" rx="4" />
            <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="'Courier New', Courier, monospace" font-weight="900" font-size="14" fill="${k.color}" letter-spacing="1">${k.short}</text>
        `;
    });

    let dungeonsSvg = '';
    DUNGEONS.forEach(d => {
        const color = RANK_COLORS[d.rank];
        dungeonsSvg += `
            ${getGlyphSvg(d.glyph, d.x, d.y - 16, color)}
            <path d="M ${d.x},${d.y - 9} L ${d.x + 9},${d.y} L ${d.x},${d.y + 9} L ${d.x - 9},${d.y} Z" fill="${color}" stroke="#100b05" stroke-width="1.5" style="filter: drop-shadow(0 0 5px ${color});" />
            <text x="${d.x}" y="${d.y}" text-anchor="middle" dominant-baseline="middle" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="11" fill="#100b05">${d.rank}</text>

            <!-- Sleek background card for dungeon labels to ensure 100% legibility -->
            <rect x="${d.x - 70}" y="${d.y + 11}" width="140" height="15" fill="rgba(245,238,215,0.85)" stroke="#3e311a" stroke-width="0.8" rx="2" />
            <text x="${d.x}" y="${d.y + 19}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-weight="bold" font-size="11" fill="#100b05">${d.name}</text>
        `;
    });

    let citiesSvg = '';
    CITIES.forEach(c => {
        if (c.capital) {
            citiesSvg += `
                <!-- Capital Star -->
                <path d="M ${c.x},${c.y - 14} L ${c.x + 4},${c.y - 5} L ${c.x + 13},${c.y - 5} L ${c.x + 6},${c.y + 1} L ${c.x + 8},${c.y + 10} L ${c.x},${c.y + 4} L ${c.x - 8},${c.y + 10} L ${c.x - 6},${c.y + 1} L ${c.x - 13},${c.y - 5} L ${c.x - 4},${c.y - 5} Z" fill="#ffd700" stroke="#100b05" stroke-width="1.8" style="filter: drop-shadow(0 0 8px #ffd700);" />
            `;
        } else {
            citiesSvg += `
                <circle cx="${c.x}" cy="${c.y}" r="8" fill="#fcf9f2" stroke="#bd3c30" stroke-width="2.5" style="filter: drop-shadow(0 0 3px rgba(189,60,48,0.4));" />
                <circle cx="${c.x}" cy="${c.y}" r="3" fill="#bd3c30" />
            `;
        }
        citiesSvg += `
            <text x="${c.x + 16}" y="${c.y - 4}" dominant-baseline="middle" font-family="Georgia, serif" font-weight="900" font-size="${c.capital ? 18 : 15}" fill="#0d0803" style="text-shadow: 0 0 3px white, 0 0 3px white;">${c.name}</text>
            <text x="${c.x + 16}" y="${c.y + 10}" dominant-baseline="middle" font-family="Georgia, serif" font-style="italic" font-size="11" fill="#4d3a1f" style="text-shadow: 0 0 2px white;">${c.sub}</text>
        `;
    });

    // Generate procedural mountain and forest clusters for 100% immersive detail
    let proceduralReliefSvg = '';

    // Mountain ridges along the mountain ranges
    const ranges = [
        // Aetheria Range
        { x: 410, y: 200 }, { x: 430, y: 195 }, { x: 450, y: 190 }, { x: 470, y: 195 }, { x: 490, y: 200 },
        // Zendora Range
        { x: 990, y: 810 }, { x: 1015, y: 805 }, { x: 1040, y: 800 }, { x: 1065, y: 805 }, { x: 1090, y: 810 },
        // Umbra Range
        { x: 230, y: 890 }, { x: 250, y: 885 }, { x: 270, y: 880 }, { x: 290, y: 885 }, { x: 310, y: 890 }
    ];
    ranges.forEach(pt => {
        proceduralReliefSvg += drawMountainPeak(pt.x, pt.y, 1.15);
    });

    // Forest clusters
    proceduralReliefSvg += drawForestCluster(250, 450, 7, 14); // Aetheria Forest
    proceduralReliefSvg += drawForestCluster(960, 750, 7, 15); // Zendora Jungle

    // Generate latitude / longitude graticule overlay
    let graticuleSvg = '';
    const lats = [150, 300, 450, 600, 750, 900];
    const lons = [200, 400, 600, 800, 1000, 1200];

    lats.forEach((lat, idx) => {
        graticuleSvg += `
            <line x1="0" y1="${lat}" x2="${W}" y2="${lat}" stroke="rgba(44,92,117,0.18)" stroke-width="0.8" stroke-dasharray="6,8" />
            <text x="15" y="${lat - 5}" font-family="'Courier New', monospace" font-size="10" fill="#3c657a" opacity="0.6">${(60 - idx * 15)}° N</text>
            <text x="${W - 45}" y="${lat - 5}" font-family="'Courier New', monospace" font-size="10" fill="#3c657a" opacity="0.6">${(60 - idx * 15)}° N</text>
        `;
    });
    lons.forEach((lon, idx) => {
        graticuleSvg += `
            <line x1="${lon}" y1="0" x2="${lon}" y2="${H}" stroke="rgba(44,92,117,0.18)" stroke-width="0.8" stroke-dasharray="6,8" />
            <text x="${lon + 5}" y="20" font-family="'Courier New', monospace" font-size="10" fill="#3c657a" opacity="0.6">${(idx * 20)}° E</text>
            <text x="${lon + 5}" y="${H - 15}" font-family="'Courier New', monospace" font-size="10" fill="#3c657a" opacity="0.6">${(idx * 20)}° E</text>
        `;
    });

    // Compass Rose directional lines (rhumb lines)
    let rhumbLines = '';
    const angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
    angles.forEach(angle => {
        const rad = angle * Math.PI / 180;
        const x2 = compassX + 1600 * Math.cos(rad);
        const y2 = compassY + 1600 * Math.sin(rad);
        rhumbLines += `<line x1="${compassX}" y1="${compassY}" x2="${x2}" y2="${y2}" stroke="rgba(44,92,117,0.11)" stroke-width="0.6" />`;
    });

    const svg = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <!-- Water & Land Elevation Shading Gradients -->
            <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#122333;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#06101c;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="lowlandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#d7c399;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#c8b386;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="highlandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#bfa87a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ab945a;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="alpineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#a8966b;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#857551;stop-opacity:1" />
            </linearGradient>

            <filter id="parchmentFilter">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
                <feDiffuseLighting in="noise" lighting-color="#fff5e6" surfaceScale="1.5">
                    <feDistantLight azimuth="45" elevation="65" />
                </feDiffuseLighting>
            </filter>

            <filter id="roughEdge">
                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
            </filter>

            <!-- Compass Rose Gradient -->
            <linearGradient id="compassGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#9a7b0c;stop-opacity:1" />
            </linearGradient>
        </defs>

        <!-- Ocean with immersive antique parchment texture -->
        <rect width="100%" height="100%" fill="url(#oceanGrad)" />
        <rect width="100%" height="100%" fill="#ffffff" opacity="0.035" style="filter: url(#parchmentFilter);" />

        <!-- Compass Rose Wind Directional Lines -->
        ${rhumbLines}

        <!-- Graticule lines -->
        ${graticuleSvg}

        <!-- Nautical Ocean waves -->
        <g opacity="0.25" fill="none" stroke="#254d66" stroke-width="1.5">
            <path d="M 120,240 Q 140,225 160,240 T 200,240" />
            <path d="M 450,120 Q 470,105 490,120 T 530,120" />
            <path d="M 1120,640 Q 1140,625 1160,640 T 1200,640" />
            <path d="M 820,840 Q 840,825 860,840 T 900,840" />
            <path d="M 680,180 Q 700,165 720,180 T 760,180" />
        </g>

        <!-- Landmasses & Altitudes -->
        ${continentsSvg}

        <!-- Regions, Boundaries & Kingdoms -->
        <g>
            ${kingdomsSvg}
            ${proceduralReliefSvg}
        </g>

        <!-- Compass Rose (Windrose - Azgaar Signature Style) -->
        <g transform="translate(${compassX}, ${compassY})">
            <!-- Outer compass rings -->
            <circle cx="0" cy="0" r="55" fill="none" stroke="#2f587d" stroke-width="2.5" opacity="0.75" />
            <circle cx="0" cy="0" r="50" fill="none" stroke="#1d3852" stroke-width="1" stroke-dasharray="3,3" opacity="0.8" />
            <circle cx="0" cy="0" r="10" fill="none" stroke="#ffd700" stroke-width="1.2" />

            <!-- Rhumb Directions Star Points -->
            <!-- N / S -->
            <polygon points="0,-68 -4,-10 0,0" fill="url(#compassGold)" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="0,-68 4,-10 0,0" fill="#ffffff" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="0,68 -4,10 0,0" fill="#ffffff" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="0,68 4,10 0,0" fill="url(#compassGold)" stroke="#1d3852" stroke-width="0.8" />

            <!-- E / W -->
            <polygon points="68,0 10,-4 0,0" fill="url(#compassGold)" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="68,0 10,4 0,0" fill="#ffffff" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="-68,0 -10,-4 0,0" fill="#ffffff" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="-68,0 -10,4 0,0" fill="url(#compassGold)" stroke="#1d3852" stroke-width="0.8" />

            <!-- NE / SW -->
            <polygon points="48,-48 3,-7 0,0" fill="url(#compassGold)" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="48,-48 7,-3 0,0" fill="#ffffff" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="-48,48 -3,7 0,0" fill="#ffffff" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="-48,48 -7,3 0,0" fill="url(#compassGold)" stroke="#1d3852" stroke-width="0.8" />

            <!-- NW / SE -->
            <polygon points="-48,-48 -7,-3 0,0" fill="url(#compassGold)" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="-48,-48 -3,-7 0,0" fill="#ffffff" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="48,48 7,3 0,0" fill="#ffffff" stroke="#1d3852" stroke-width="0.8" />
            <polygon points="48,48 3,7 0,0" fill="url(#compassGold)" stroke="#1d3852" stroke-width="0.8" />

            <!-- Directional Labels -->
            <text x="0" y="-76" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-weight="bold" font-size="14" fill="#ffd700" style="text-shadow: 0 0 3px black;">N</text>
            <text x="76" y="0" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-weight="bold" font-size="13" fill="#ffd700" style="text-shadow: 0 0 3px black;">E</text>
            <text x="0" y="78" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-weight="bold" font-size="13" fill="#ffd700" style="text-shadow: 0 0 3px black;">S</text>
            <text x="-78" y="0" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-weight="bold" font-size="13" fill="#ffd700" style="text-shadow: 0 0 3px black;">W</text>
        </g>

        <!-- Cities, Dungeons, and Labels -->
        ${labelsSvg}
        ${dungeonsSvg}
        ${citiesSvg}

        <!-- Grand Vintage Title Shield -->
        <g transform="translate(${W/2 - 320}, 24)">
            <!-- Double-lined classic frame -->
            <rect width="640" height="85" fill="rgba(15,10,5,0.85)" stroke="#ffd700" stroke-width="2.5" rx="6" style="filter: drop-shadow(0 6px 15px rgba(0,0,0,0.8));" />
            <rect x="5" y="5" width="630" height="75" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1" rx="4" />
            <text x="320" y="44" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="34" fill="#ffd700" style="letter-spacing: 2px;">CARTE DU MONDE — ${WORLD_NAME}</text>
            <text x="320" y="68" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="14" fill="#f0e2cd" style="letter-spacing: 1px;">AETHERIA, ZENDORA, UMBRA ET CAELUM • GENERATED COMPASS G-IV</text>
        </g>

        <!-- Comprehensive Legend and Technical Scale Bar -->
        <g transform="translate(40, ${H - 240})">
            <!-- Glass base panel -->
            <rect width="320" height="200" fill="rgba(15,10,5,0.85)" stroke="#ffd700" stroke-width="1.8" rx="6" style="filter: drop-shadow(0 8px 20px rgba(0,0,0,0.75));" />
            <rect x="5" y="5" width="310" height="190" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1" rx="4" />

            <text x="20" y="30" font-family="Georgia, serif" font-weight="bold" font-size="16" fill="#ffd700">LÉGENDE CARTOGRAPHIQUE</text>

            <!-- City / Capital -->
            <circle cx="28" cy="58" r="7" fill="#fcf9f2" stroke="#bd3c30" stroke-width="2.2" />
            <circle cx="28" cy="58" r="2.5" fill="#bd3c30" />
            <text x="44" y="63" font-family="Georgia, serif" font-size="12" fill="#e9dcb5">Lieu / Cité</text>

            <path d="M 160,50 L 163,56 L 170,56 L 165,61 L 167,68 L 160,64 L 153,68 L 155,61 L 150,56 L 157,56 Z" fill="#ffd700" stroke="#100b05" stroke-width="1" />
            <text x="180" y="63" font-family="Georgia, serif" font-size="12" fill="#e9dcb5">Capitale</text>

            <!-- Dungeons -->
            <text x="20" y="92" font-family="Georgia, serif" font-size="13" fill="#ffd700" font-weight="bold">DONJONS DE ROYAUME :</text>
            ${Object.keys(RANK_COLORS).map((r, i) => {
                const rx = 28 + (i % 3) * 95;
                const ry = 118 + Math.floor(i / 3) * 30;
                return `
                <path d="M ${rx},${ry-7} L ${rx+7},${ry} L ${rx},${ry+7} L ${rx-7},${ry} Z" fill="${RANK_COLORS[r]}" stroke="#100b05" stroke-width="1" />
                <text x="${rx+14}" y="${ry+4}" font-family="Georgia, serif" font-size="12" fill="#e9dcb5">Rang ${r}</text>
                `;
            }).join('')}

            <!-- Scale Bar in kilometers (Azgaar Custom signature) -->
            <g transform="translate(20, 160)">
                <text x="0" y="10" font-family="'Courier New', monospace" font-size="10" fill="#ffd700">ÉCHELLE :</text>

                <!-- Checkerboard alternating blocks -->
                <rect x="75" y="2" width="40" height="6" fill="#ffd700" stroke="#100b05" stroke-width="1" />
                <rect x="115" y="2" width="40" height="6" fill="#100b05" stroke="#ffd700" stroke-width="1" />
                <rect x="155" y="2" width="40" height="6" fill="#ffd700" stroke="#100b05" stroke-width="1" />
                <rect x="195" y="2" width="40" height="6" fill="#100b05" stroke="#ffd700" stroke-width="1" />

                <!-- Labels -->
                <text x="75" y="-3" font-family="'Courier New', monospace" font-size="8" fill="#e9dcb5" text-anchor="middle">0</text>
                <text x="155" y="-3" font-family="'Courier New', monospace" font-size="8" fill="#e9dcb5" text-anchor="middle">150</text>
                <text x="235" y="-3" font-family="'Courier New', monospace" font-size="8" fill="#e9dcb5" text-anchor="middle">300 km</text>
            </g>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateWorldMapImage, WORLD_NAME };
