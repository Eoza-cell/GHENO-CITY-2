const sharp = require('sharp');

// ---- Canonical world data (mirrors the seeds in database.js) ----
const WORLD_NAME = 'AETHERYS';

const KINGDOMS = [
    // --- AETHERIA (High Fantasy Coast) ---
    { name: "Empire Impérial d'Elion", short: "ELION", continent: "Aetheria", color: '#f4c542', fill: 'rgba(244,197,66,0.14)', labelPos: [430, 440], polygon: [[380, 360], [450, 340], [540, 370], [560, 480], [510, 540], [390, 530], [360, 450], [350, 380]] },
    { name: 'Royaume de Valkyrr', short: 'VALKYRR', continent: "Aetheria", color: '#3498db', fill: 'rgba(52,152,219,0.11)', labelPos: [450, 245], polygon: [[380, 180], [480, 160], [550, 200], [540, 340], [450, 340], [380, 310], [360, 250]] },
    { name: 'Gheno souterrain', short: 'GHENO', continent: "Aetheria", color: '#9b59b6', fill: 'rgba(155,89,182,0.13)', labelPos: [290, 340], polygon: [[260, 310], [340, 300], [360, 380], [270, 390], [250, 350]] },
    { name: 'Forêt de l\'Éveil', short: 'SYLVA', continent: "Aetheria", color: '#2ecc71', fill: 'rgba(46,204,113,0.12)', labelPos: [240, 460], polygon: [[180, 380], [340, 370], [370, 540], [200, 560], [160, 480], [150, 420]] },
    { name: 'Archipel des Murmures', short: 'MURMURES', continent: "Aetheria", color: '#1abc9c', fill: 'rgba(26,188,156,0.12)', labelPos: [180, 240], polygon: [[120, 180], [260, 170], [300, 280], [140, 320], [100, 250]] },

    // --- ZENDORA (The Wild Lands) ---
    { name: 'Terres Bestiales', short: 'BESTIALIA', continent: "Zendora", color: '#e67e22', fill: 'rgba(230,126,34,0.12)', labelPos: [960, 740], polygon: [[880, 680], [1020, 660], [1060, 780], [1010, 860], [890, 840], [860, 760], [850, 720]] },
    { name: 'Bastion d\'Orkh', short: 'ORKH', continent: "Zendora", color: '#e74c3c', fill: 'rgba(231,76,60,0.12)', labelPos: [1160, 760], polygon: [[1080, 680], [1220, 670], [1260, 820], [1180, 880], [1070, 850], [1060, 750]] },
    { name: 'Montagnes de Fer', short: 'IRON', continent: "Zendora", color: '#7f8c8d', fill: 'rgba(127,140,141,0.14)', labelPos: [1060, 920], polygon: [[980, 870], [1140, 870], [1160, 980], [1050, 990], [970, 950], [960, 900]] },
    { name: 'Désert d\'Ambre', short: 'AMBRE', continent: "Zendora", color: '#f1c40f', fill: 'rgba(241,196,15,0.12)', labelPos: [1140, 590], polygon: [[1070, 530], [1240, 540], [1260, 650], [1150, 680], [1060, 640], [1050, 580]] },

    // --- UMBRA (The Shadow Continent) ---
    { name: 'Dominion Noir de Vharos', short: 'VHAROS', continent: "Umbra", color: '#8e44ad', fill: 'rgba(142,68,173,0.12)', labelPos: [240, 760], polygon: [[170, 680], [330, 670], [360, 820], [280, 870], [160, 840], [150, 750]] },
    { name: 'Nécropolis', short: 'NÉCROPOLIS', continent: "Umbra", color: '#2c3e50', fill: 'rgba(44,62,80,0.18)', labelPos: [460, 770], polygon: [[370, 680], [530, 690], [560, 840], [450, 880], [360, 830], [350, 750]] },
    { name: 'L\'Interstice', short: 'INTERSTICE', continent: "Umbra", color: '#050505', fill: 'rgba(5,5,5,0.3)', labelPos: [360, 930], polygon: [[280, 880], [440, 880], [460, 990], [350, 980], [270, 940], [260, 900]] },
    { name: 'Cité de Verre', short: 'VERRE', continent: "Umbra", color: '#34495e', fill: 'rgba(52,73,94,0.12)', labelPos: [110, 740], polygon: [[30, 680], [160, 670], [180, 820], [80, 860], [20, 800], [10, 740]] },

    // --- CAELUM (The Floating Continent) ---
    { name: 'Royaume Céleste', short: 'CELESTIA', continent: "Caelum", color: '#ffffff', fill: 'rgba(255,255,255,0.22)', labelPos: [940, 240], polygon: [[870, 170], [1030, 160], [1060, 320], [960, 380], [860, 340], [850, 250]] },
    { name: 'Abysse Inférieur', short: 'ABYSSE', continent: "Caelum", color: '#e74c3c', fill: 'rgba(231,76,60,0.15)', labelPos: [1160, 260], polygon: [[1070, 180], [1230, 170], [1260, 330], [1170, 390], [1060, 350], [1050, 250]] },
    { name: 'Origine de l\'Existence', short: 'ORIGINE', continent: "Caelum", color: '#f39c12', fill: 'rgba(243,156,18,0.15)', labelPos: [1060, 90], polygon: [[970, 20], [1140, 10], [1160, 140], [1050, 170], [960, 130], [950, 70]] },
    { name: 'Cité de l\'Aube', short: 'AURORE', continent: "Caelum", color: '#d35400', fill: 'rgba(211,84,0,0.15)', labelPos: [1140, 460], polygon: [[1070, 370], [1240, 360], [1260, 520], [1150, 560], [1060, 510], [1050, 440]] }
];

// Rich, highly complex organic fractal shoreline paths for the 4 continents
// Replaces previous rigid straight-edged forms with top-tier geographical contours
const CONTINENTS_SHAPES = [
    {
        name: "Aetheria",
        path: "M 110,180 C 130,120 180,110 240,90 C 310,70 380,80 430,95 C 490,110 520,70 570,90 C 620,110 650,180 620,240 C 600,290 630,330 600,380 C 580,410 590,460 550,510 C 510,560 420,550 380,580 C 330,600 270,550 210,570 C 160,590 120,530 110,470 C 100,430 70,390 90,320 C 100,270 80,210 110,180 Z"
    },
    {
        name: "Zendora",
        path: "M 840,580 C 890,520 950,510 1020,490 C 1090,470 1180,500 1240,520 C 1310,540 1340,610 1310,680 C 1290,730 1320,780 1290,840 C 1260,890 1180,940 1130,970 C 1070,990 990,960 940,940 C 890,920 840,940 810,870 C 790,810 820,750 790,690 C 770,640 800,610 840,580 Z"
    },
    {
        name: "Umbra",
        path: "M 40,680 C 90,640 160,630 220,620 C 290,610 380,640 440,650 C 500,660 540,710 510,780 C 490,830 520,880 490,930 C 460,970 380,990 330,995 C 270,1000 200,970 150,950 C 100,930 60,940 30,880 C 10,830 40,770 20,720 C 10,690 20,680 40,680 Z"
    },
    {
        name: "Caelum",
        path: "M 850,80 C 900,40 980,30 1060,20 C 1140,10 1220,40 1270,70 C 1320,110 1350,180 1320,240 C 1290,290 1320,340 1290,400 C 1260,450 1180,480 1130,490 C 1070,500 990,470 940,450 C 890,430 840,450 810,390 C 790,340 820,290 790,240 C 770,190 800,110 850,80 Z"
    }
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

// Defined travel lines / highways between cities with precise distances in meters
const TRAVEL_ROUTES = [
    { from: 'Eldoria', to: 'Solis', dist: '4 500 m', ax: 400, ay: 500, bx: 450, by: 450 },
    { from: 'Eldoria', to: 'Riverbend', dist: '3 200 m', ax: 400, ay: 500, bx: 380, by: 460 },
    { from: 'Solis', to: 'Portes d\'Elion', dist: '5 800 m', ax: 450, ay: 450, bx: 520, by: 480 },
    { from: 'Solis', to: 'Sparkwell', dist: '18 500 m', ax: 450, ay: 450, bx: 480, by: 200 },
    { from: 'Gearhead', to: 'Sparkwell', dist: '6 200 m', ax: 420, ay: 240, bx: 480, by: 200 },
    { from: 'Sylva-Lumia', to: 'Arbre-Mère', dist: '2 400 m', ax: 250, ay: 450, bx: 220, by: 420 },
    { from: 'Eldoria', to: 'Marché Noir', dist: '15 000 m', ax: 400, ay: 500, bx: 300, by: 350 },
    { from: 'Donjon de la Liche', to: 'Le Seuil', dist: '9 600 m', ax: 250, ay: 750, bx: 450, by: 750 },
    { from: 'Palais d\'Argent', to: 'Zenith Absolu', dist: '24 000 m', ax: 950, ay: 250, bx: 1050, by: 50 },
    { from: 'Pic du Prédateur', to: 'Fort-Sang', dist: '14 000 m', ax: 980, ay: 780, bx: 1150, by: 750 }
];

const RANK_COLORS = {
    E: '#2ecc71', D: '#3498db', C: '#f1c40f', B: '#e67e22', A: '#e74c3c', S: '#9b59b6'
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
        <polygon points="${x},${y - h} ${x - w},${y} ${x},${y}" fill="#b8a178" stroke="#251a08" stroke-width="1.5" />
        <!-- Illuminated right slope -->
        <polygon points="${x},${y - h} ${x + w},${y} ${x},${y}" fill="#ebdcb9" stroke="#251a08" stroke-width="1.5" />
        <!-- Ridge line -->
        <line x1="${x}" y1="${y - h}" x2="${x}" y2="${y}" stroke="#251a08" stroke-width="1.8" />
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
            <ellipse cx="${x}" cy="${y + radius * 0.8}" rx="${radius}" ry="${radius * 0.3}" fill="rgba(0,0,0,0.15)" />
            <!-- Little tree trunk -->
            <line x1="${x}" y1="${y + radius * 0.5}" x2="${x}" y2="${y + radius * 1.3}" stroke="#132414" stroke-width="2.5" />
            <!-- Overlapping vibrant green tree crown -->
            <circle cx="${x}" cy="${y}" r="${radius}" fill="#2e5430" stroke="#132414" stroke-width="1.5" />
            <circle cx="${x - radius * 0.25}" cy="${y - radius * 0.25}" r="${radius * 0.4}" fill="#417844" opacity="0.65" />
        `;
    });
    return svg;
}

function getGlyphSvg(glyph, x, y, color) {
    const s = 11;
    if (glyph === 'tree') return `<path d="M ${x},${y - s} L ${x + s * 0.7},${y + s * 0.4} L ${x - s * 0.7},${y + s * 0.4} Z" fill="${color}" stroke="#1c140a" stroke-width="1.5" />`;
    if (glyph === 'mountain') return `<path d="M ${x - s},${y + s * 0.5} L ${x},${y - s} L ${x + s},${y + s * 0.5} Z" fill="${color}" stroke="#1c140a" stroke-width="1.5" />`;
    if (glyph === 'volcano') return `
        <path d="M ${x - s},${y + s * 0.5} L ${x - s * 0.3},${y - s * 0.6} L ${x + s * 0.3},${y - s * 0.6} L ${x + s},${y + s * 0.5} Z" fill="${color}" stroke="#1c140a" stroke-width="1.5" />
        <path d="M ${x - s * 0.3},${y - s * 0.6} L ${x},${y - s * 1.3} L ${x + s * 0.3},${y - s * 0.6} Z" fill="#ff5d24" />`;
    if (glyph === 'cave') return `<path d="M ${x - s * 0.8},${y + s * 0.5} L ${x + s * 0.8},${y + s * 0.5} A ${s * 0.8},${s * 0.8} 0 0,0 ${x - s * 0.8},${y + s * 0.5} Z" fill="${color}" stroke="#1c140a" stroke-width="1.5" />`;
    if (glyph === 'tower') return `<rect x="${x - s * 0.5}" y="${y - s}" width="${s}" height="${s * 1.6}" fill="${color}" stroke="#1c140a" stroke-width="1.5" />`;
    if (glyph === 'skull') return `
        <circle cx="${x}" cy="${y - 2}" r="${s * 0.7}" fill="${color}" stroke="#1c140a" stroke-width="1.5" />
        <circle cx="${x - 3}" cy="${y - 3}" r="1.8" fill="#1c140a" />
        <circle cx="${x + 3}" cy="${y - 3}" r="1.8" fill="#1c140a" />`;
    return '';
}

async function generateWorldMapImage() {
    const W = 1400, H = 1000;

    const compassX = 720;
    const compassY = 480;

    let continentsSvg = '';
    CONTINENTS_SHAPES.forEach(c => {
        continentsSvg += `
            <!-- Concentric Shoreline wave echoes -->
            <path d="${c.path}" fill="none" stroke="#1d2e3f" stroke-width="3" opacity="0.65" />
            <path d="${c.path}" fill="none" stroke="#253e52" stroke-width="8" opacity="0.4" />
            <path d="${c.path}" fill="none" stroke="#2a4a5e" stroke-width="16" opacity="0.25" stroke-dasharray="6,4" />
            <path d="${c.path}" fill="none" stroke="#2f5770" stroke-width="26" opacity="0.12" stroke-dasharray="3,6" />

            <!-- Core Land surface with rich antique gradient -->
            <path d="${c.path}" fill="url(#lowlandGrad)" stroke="#23170a" stroke-width="3.5" style="filter: url(#roughEdge) drop-shadow(0 6px 15px rgba(0,0,0,0.55));" />

            <!-- Inset elevation contours -->
            <path d="${c.path}" transform="translate(${(c.name === 'Aetheria' || c.name === 'Umbra' ? 5 : -5)}, 5) scale(0.97)" fill="url(#highlandGrad)" stroke="#23170a" stroke-width="1.2" stroke-dasharray="3,4" opacity="0.5" />
            <path d="${c.path}" transform="translate(${(c.name === 'Aetheria' || c.name === 'Umbra' ? 12 : -12)}, 12) scale(0.93)" fill="url(#alpineGrad)" stroke="#23170a" stroke-width="1" stroke-dasharray="2,3" opacity="0.35" />

            <!-- Large continent text label -->
            <text x="${c.name === 'Aetheria' ? 250 : (c.name === 'Zendora' ? 1000 : (c.name === 'Umbra' ? 200 : 1000))}" y="${c.name === 'Aetheria' ? 220 : (c.name === 'Zendora' ? 620 : (c.name === 'Umbra' ? 780 : 150))}" font-family="Georgia, serif" font-weight="900" font-size="44" fill="#201509" opacity="0.18" letter-spacing="22" transform="rotate(-6, ${c.name === 'Aetheria' ? 250 : (c.name === 'Zendora' ? 1000 : (c.name === 'Umbra' ? 200 : 1000))}, ${c.name === 'Aetheria' ? 220 : (c.name === 'Zendora' ? 620 : (c.name === 'Umbra' ? 780 : 150))})">${c.name.toUpperCase()}</text>
        `;
    });

    // Political limitations and boundaries (solid, thick, and colored, with custom strokes)
    let kingdomsSvg = '';
    KINGDOMS.forEach(k => {
        const polyPath = `M ${k.polygon.map(p => p.join(',')).join(' L ')} Z`;
        kingdomsSvg += `
            <!-- Inner border glow -->
            <path d="${polyPath}" fill="${k.fill}" stroke="${k.color}" stroke-width="4.5" opacity="0.3" />
            <!-- Solid sharp political border trait (territorial limitations) -->
            <path d="${polyPath}" fill="none" stroke="${k.color}" stroke-width="2.5" stroke-dasharray="10,5" style="filter: drop-shadow(0 0 3px rgba(0,0,0,0.8));" />
        `;
    });

    // Drawing elegant travels dashed lines with distances inside capsule labels
    let routesSvg = '';
    TRAVEL_ROUTES.forEach(route => {
        const midX = (route.ax + route.bx) / 2;
        const midY = (route.ay + route.by) / 2;
        routesSvg += `
            <!-- Route path -->
            <line x1="${route.ax}" y1="${route.ay}" x2="${route.bx}" y2="${route.by}" stroke="#bd3c30" stroke-width="1.8" stroke-dasharray="3,5" opacity="0.8" />

            <!-- Distance capsule label (paint-order/stroke for contrast) -->
            <rect x="${midX - 35}" y="${midY - 9}" width="70" height="18" fill="#faf5e1" stroke="#251a08" stroke-width="1" rx="4" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" />
            <text x="${midX}" y="${midY + 1}" text-anchor="middle" dominant-baseline="middle" font-family="'Courier New', Courier, monospace" font-weight="900" font-size="10.5" fill="#bd3c30">${route.dist}</text>
        `;
    });

    let labelsSvg = '';
    KINGDOMS.forEach(k => {
        const cx = k.labelPos[0], cy = k.labelPos[1];
        labelsSvg += `
            <!-- Rigid vintage plate label for kingdom boundary -->
            <rect x="${cx - 75}" y="${cy - 14}" width="150" height="28" fill="#150f08" stroke="${k.color}" stroke-width="2.2" rx="4" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.85));" />
            <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="'Courier New', monospace" font-weight="900" font-size="14" fill="${k.color}" letter-spacing="1.5">${k.short}</text>
        `;
    });

    let dungeonsSvg = '';
    DUNGEONS.forEach(d => {
        const color = RANK_COLORS[d.rank];
        dungeonsSvg += `
            ${getGlyphSvg(d.glyph, d.x, d.y - 18, color)}
            <!-- Star diamond base for dungeon marker -->
            <path d="M ${d.x},${d.y - 11} L ${d.x + 11},${d.y} L ${d.x},${d.y + 11} L ${d.x - 11},${d.y} Z" fill="${color}" stroke="#0a0502" stroke-width="2" style="filter: drop-shadow(0 0 5px ${color});" />
            <text x="${d.x}" y="${d.y}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-weight="900" font-size="12" fill="#0a0502">${d.rank}</text>

            <!-- High contrast text label with clean background shield -->
            <rect x="${d.x - 75}" y="${d.y + 14}" width="150" height="18" fill="#faf5e1" stroke="#251a08" stroke-width="1.2" rx="3" />
            <text x="${d.x}" y="${d.y + 23}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-weight="900" font-size="11" fill="#0a0502">${d.name}</text>
        `;
    });

    let citiesSvg = '';
    CITIES.forEach(c => {
        if (c.capital) {
            citiesSvg += `
                <!-- Capital Star -->
                <path d="M ${c.x},${c.y - 15} L ${c.x + 5},${c.y - 5} L ${c.x + 15},${c.y - 5} L ${c.x + 7},${c.y + 1} L ${c.x + 9},${c.y + 11} L ${c.x},${c.y + 5} L ${c.x - 9},${c.y + 11} L ${c.x - 7},${c.y + 1} L ${c.x - 15},${c.y - 5} L ${c.x - 5},${c.y - 5} Z" fill="#ffd700" stroke="#0e0702" stroke-width="2.2" style="filter: drop-shadow(0 0 6px #ffd700);" />
            `;
        } else {
            citiesSvg += `
                <circle cx="${c.x}" cy="${c.y}" r="8.5" fill="#fefdf9" stroke="#b02c22" stroke-width="3" style="filter: drop-shadow(0 0 3px rgba(176,44,34,0.5));" />
                <circle cx="${c.x}" cy="${c.y}" r="3" fill="#b02c22" />
            `;
        }
        citiesSvg += `
            <!-- Text outline strokes using paint-order for ultimate legibility -->
            <text x="${c.x + 18}" y="${c.y - 4}" dominant-baseline="middle" font-family="Georgia, serif" font-weight="900" font-size="${c.capital ? 18 : 15}" fill="#0a0502" paint-order="stroke" stroke="#fdfbf4" stroke-width="4px" stroke-linejoin="round">${c.name}</text>
            <text x="${c.x + 18}" y="${c.y + 10}" dominant-baseline="middle" font-family="Georgia, serif" font-style="italic" font-size="11" fill="#4a371c" paint-order="stroke" stroke="#fdfbf4" stroke-width="3px" stroke-linejoin="round">${c.sub}</text>
        `;
    });

    // Procedural hills, mountains, and forests
    let proceduralReliefSvg = '';
    const ranges = [
        // Aetheria Range
        { x: 410, y: 200 }, { x: 430, y: 195 }, { x: 450, y: 190 }, { x: 470, y: 195 }, { x: 490, y: 200 },
        // Zendora Range
        { x: 990, y: 810 }, { x: 1015, y: 805 }, { x: 1040, y: 800 }, { x: 1065, y: 805 }, { x: 1090, y: 810 },
        // Umbra Range
        { x: 230, y: 890 }, { x: 250, y: 885 }, { x: 270, y: 880 }, { x: 290, y: 885 }, { x: 310, y: 890 }
    ];
    ranges.forEach(pt => {
        proceduralReliefSvg += drawMountainPeak(pt.x, pt.y, 1.2);
    });

    proceduralReliefSvg += drawForestCluster(250, 450, 7, 14); // Aetheria Forest
    proceduralReliefSvg += drawForestCluster(960, 750, 7, 15); // Zendora Jungle

    // Graticule grid system
    let graticuleSvg = '';
    const lats = [150, 300, 450, 600, 750, 900];
    const lons = [200, 400, 600, 800, 1000, 1200];

    lats.forEach((lat, idx) => {
        graticuleSvg += `
            <line x1="15" y1="${lat}" x2="${W - 15}" y2="${lat}" stroke="rgba(35,68,92,0.18)" stroke-width="0.8" stroke-dasharray="6,8" />
            <text x="30" y="${lat - 5}" font-family="'Courier New', monospace" font-size="10" fill="#2d536c" opacity="0.6" font-weight="bold">${(60 - idx * 15)}° N</text>
            <text x="${W - 65}" y="${lat - 5}" font-family="'Courier New', monospace" font-size="10" fill="#2d536c" opacity="0.6" font-weight="bold">${(60 - idx * 15)}° N</text>
        `;
    });
    lons.forEach((lon, idx) => {
        graticuleSvg += `
            <line x1="${lon}" y1="15" x2="${lon}" y2="${H - 15}" stroke="rgba(35,68,92,0.18)" stroke-width="0.8" stroke-dasharray="6,8" />
            <text x="${lon + 5}" y="35" font-family="'Courier New', monospace" font-size="10" fill="#2d536c" opacity="0.6" font-weight="bold">${(idx * 20)}° E</text>
            <text x="${lon + 5}" y="${H - 30}" font-family="'Courier New', monospace" font-size="10" fill="#2d536c" opacity="0.6" font-weight="bold">${(idx * 20)}° E</text>
        `;
    });

    // Rhumb Lines
    let rhumbLines = '';
    const angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
    angles.forEach(angle => {
        const rad = angle * Math.PI / 180;
        const x2 = compassX + 1600 * Math.cos(rad);
        const y2 = compassY + 1600 * Math.sin(rad);
        rhumbLines += `<line x1="${compassX}" y1="${compassY}" x2="${x2}" y2="${y2}" stroke="rgba(35,68,92,0.11)" stroke-width="0.6" />`;
    });

    const svg = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0f1e2d;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#050b14;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="lowlandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#dcd1b4;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#cbbe95;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="highlandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#c8b590;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#b5a075;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="alpineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#bfa87a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#9e8a5b;stop-opacity:1" />
            </linearGradient>

            <filter id="parchmentFilter">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
                <feDiffuseLighting in="noise" lighting-color="#fff5e6" surfaceScale="1.5">
                    <feDistantLight azimuth="45" elevation="65" />
                </feDiffuseLighting>
            </filter>

            <filter id="roughEdge">
                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
            </filter>

            <linearGradient id="compassGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#b5910c;stop-opacity:1" />
            </linearGradient>
        </defs>

        <!-- Ocean with immersive antique parchment texture -->
        <rect width="100%" height="100%" fill="url(#oceanGrad)" />
        <rect width="100%" height="100%" fill="#ffffff" opacity="0.035" style="filter: url(#parchmentFilter);" />

        <!-- Compass Rose Wind Directional Lines -->
        ${rhumbLines}

        <!-- Graticule lines -->
        ${graticuleSvg}

        <!-- Ocean waves -->
        <g opacity="0.25" fill="none" stroke="#1d3852" stroke-width="1.5">
            <path d="M 120,240 Q 140,225 160,240 T 200,240" />
            <path d="M 450,120 Q 470,105 490,120 T 530,120" />
            <path d="M 1120,640 Q 1140,625 1160,640 T 1200,640" />
            <path d="M 820,840 Q 840,825 860,840 T 900,840" />
        </g>

        <!-- Landmasses & Altitudes -->
        ${continentsSvg}

        <!-- Travel routes & precise distances in meters -->
        ${routesSvg}

        <!-- Regions, Boundaries & Kingdoms -->
        <g>
            ${kingdomsSvg}
            ${proceduralReliefSvg}
        </g>

        <!-- Compass Rose (Windrose - Azgaar Signature Style) -->
        <g transform="translate(${compassX}, ${compassY})">
            <circle cx="0" cy="0" r="55" fill="none" stroke="#2a4561" stroke-width="2.5" opacity="0.75" />
            <circle cx="0" cy="0" r="50" fill="none" stroke="#1b304a" stroke-width="1" stroke-dasharray="3,3" opacity="0.8" />
            <circle cx="0" cy="0" r="10" fill="none" stroke="#ffd700" stroke-width="1.2" />

            <!-- Rhumb Directions Star Points -->
            <polygon points="0,-68 -4,-10 0,0" fill="url(#compassGold)" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="0,-68 4,-10 0,0" fill="#ffffff" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="0,68 -4,10 0,0" fill="#ffffff" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="0,68 4,10 0,0" fill="url(#compassGold)" stroke="#172a3f" stroke-width="0.8" />

            <polygon points="68,0 10,-4 0,0" fill="url(#compassGold)" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="68,0 10,4 0,0" fill="#ffffff" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="-68,0 -10,-4 0,0" fill="#ffffff" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="-68,0 -10,4 0,0" fill="url(#compassGold)" stroke="#172a3f" stroke-width="0.8" />

            <polygon points="48,-48 3,-7 0,0" fill="url(#compassGold)" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="48,-48 7,-3 0,0" fill="#ffffff" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="-48,48 -3,7 0,0" fill="#ffffff" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="-48,48 -7,3 0,0" fill="url(#compassGold)" stroke="#172a3f" stroke-width="0.8" />

            <polygon points="-48,-48 -7,-3 0,0" fill="url(#compassGold)" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="-48,-48 -3,-7 0,0" fill="#ffffff" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="48,48 7,3 0,0" fill="#ffffff" stroke="#172a3f" stroke-width="0.8" />
            <polygon points="48,48 3,7 0,0" fill="url(#compassGold)" stroke="#172a3f" stroke-width="0.8" />

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
            <rect width="320" height="200" fill="rgba(15,10,5,0.88)" stroke="#ffd700" stroke-width="1.8" rx="6" style="filter: drop-shadow(0 8px 20px rgba(0,0,0,0.75));" />
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

        <!-- ==================== MAP THICK VINTAGE BORDER FRAME ==================== -->
        <!-- Elegant outer double-line map border with coordinates numbers and tick markings -->
        <g stroke="#3e2612" fill="none" stroke-width="3">
            <rect x="10" y="10" width="1380" height="980" stroke-width="3" />
            <rect x="16" y="16" width="1368" height="968" stroke-width="1.2" />
        </g>

        <!-- Ornate corner markers -->
        <path d="M 8,40 L 8,8 L 40,8" fill="none" stroke="#ffd700" stroke-width="4.5" />
        <path d="M 1392,40 L 1392,8 L 1360,8" fill="none" stroke="#ffd700" stroke-width="4.5" />
        <path d="M 8,960 L 8,992 L 40,992" fill="none" stroke="#ffd700" stroke-width="4.5" />
        <path d="M 1392,960 L 1392,992 L 1360,992" fill="none" stroke="#ffd700" stroke-width="4.5" />
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateWorldMapImage, WORLD_NAME };
