const sharp = require('sharp');

const WORLD_NAME = 'AFTER THE REBIRTH (ATR)';

/**
 * Azgaar's Fantasy Map Generator Signature Renderer
 * Renders high-fidelity cartographic maps with biomes, elevation contours,
 * winding river networks, coastal water depth rings, and Azgaar state icons.
 */

const KINGDOMS = [
    { name: "Empire Impérial d'Elion", short: "ELION", continent: "Aetheria", color: '#f1c40f', fill: 'rgba(241,196,15,0.25)', labelPos: [430, 440], polygon: [[380, 360], [450, 340], [540, 370], [560, 480], [510, 540], [390, 530], [360, 450], [350, 380]] },
    { name: 'Royaume de Valkyrr', short: 'VALKYRR', continent: "Aetheria", color: '#3498db', fill: 'rgba(52,152,219,0.25)', labelPos: [450, 245], polygon: [[380, 180], [480, 160], [550, 200], [540, 340], [450, 340], [380, 310], [360, 250]] },
    { name: 'Gheno souterrain', short: 'GHENO', continent: "Aetheria", color: '#9b59b6', fill: 'rgba(155,89,182,0.25)', labelPos: [290, 340], polygon: [[260, 310], [340, 300], [360, 380], [270, 390], [250, 350]] },
    { name: 'Forêt de l\'Éveil', short: 'SYLVA', continent: "Aetheria", color: '#2ecc71', fill: 'rgba(46,204,113,0.25)', labelPos: [240, 460], polygon: [[180, 380], [340, 370], [370, 540], [200, 560], [160, 480], [150, 420]] },
    { name: 'Archipel des Murmures', short: 'MURMURES', continent: "Aetheria", color: '#1abc9c', fill: 'rgba(26,188,156,0.25)', labelPos: [180, 240], polygon: [[120, 180], [260, 170], [300, 280], [140, 320], [100, 250]] },

    { name: 'Terres Bestiales', short: 'BESTIALIA', continent: "Zendora", color: '#e67e22', fill: 'rgba(230,126,34,0.25)', labelPos: [960, 740], polygon: [[880, 680], [1020, 660], [1060, 780], [1010, 860], [890, 840], [860, 760], [850, 720]] },
    { name: 'Bastion d\'Orkh', short: 'ORKH', continent: "Zendora", color: '#e74c3c', fill: 'rgba(231,76,60,0.25)', labelPos: [1160, 760], polygon: [[1080, 680], [1220, 670], [1260, 820], [1180, 880], [1070, 850], [1060, 750]] },
    { name: 'Montagnes de Fer', short: 'IRON', continent: "Zendora", color: '#95a5a6', fill: 'rgba(149,165,166,0.25)', labelPos: [1060, 920], polygon: [[980, 870], [1140, 870], [1160, 980], [1050, 990], [970, 950], [960, 900]] },
    { name: 'Désert d\'Ambre', short: 'AMBRE', continent: "Zendora", color: '#f39c12', fill: 'rgba(243,156,18,0.25)', labelPos: [1140, 590], polygon: [[1070, 530], [1240, 540], [1260, 650], [1150, 680], [1060, 640], [1050, 580]] },

    { name: 'Dominion Noir de Vharos', short: 'VHAROS', continent: "Umbra", color: '#8e44ad', fill: 'rgba(142,68,173,0.25)', labelPos: [240, 760], polygon: [[170, 680], [330, 670], [360, 820], [280, 870], [160, 840], [150, 750]] },
    { name: 'Nécropolis', short: 'NÉCROPOLIS', continent: "Umbra", color: '#34495e', fill: 'rgba(52,73,94,0.3)', labelPos: [460, 770], polygon: [[370, 680], [530, 690], [560, 840], [450, 880], [360, 830], [350, 750]] },
    { name: 'L\'Interstice', short: 'INTERSTICE', continent: "Umbra", color: '#2c3e50', fill: 'rgba(44,62,80,0.35)', labelPos: [360, 930], polygon: [[280, 880], [440, 880], [460, 990], [350, 980], [270, 940], [260, 900]] },

    { name: 'Royaume Céleste', short: 'CELESTIA', continent: "Caelum", color: '#00ffff', fill: 'rgba(0,255,255,0.25)', labelPos: [940, 240], polygon: [[870, 170], [1030, 160], [1060, 320], [960, 380], [860, 340], [850, 250]] },
    { name: 'Abysse Inférieur', short: 'ABYSSE', continent: "Caelum", color: '#e74c3c', fill: 'rgba(231,76,60,0.25)', labelPos: [1160, 260], polygon: [[1070, 180], [1230, 170], [1260, 330], [1170, 390], [1060, 350], [1050, 250]] }
];

const CONTINENTS_SHAPES = [
    { name: "Aetheria", path: "M 110,180 C 130,120 180,110 240,90 C 310,70 380,80 430,95 C 490,110 520,70 570,90 C 620,110 650,180 620,240 C 600,290 630,330 600,380 C 580,410 590,460 550,510 C 510,560 420,550 380,580 C 330,600 270,550 210,570 C 160,590 120,530 110,470 C 100,430 70,390 90,320 Z", biomeColor: "#6b8e23" },
    { name: "Zendora", path: "M 840,580 C 890,520 950,510 1020,490 C 1090,470 1180,500 1240,520 C 1310,540 1340,610 1310,680 C 1290,730 1320,780 1290,840 C 1260,890 1180,940 1130,970 C 1070,990 990,960 940,940 C 890,920 840,940 810,870 C 790,810 820,750 790,690 Z", biomeColor: "#d2b48c" },
    { name: "Umbra", path: "M 40,680 C 90,640 160,630 220,620 C 290,610 380,640 440,650 C 500,660 540,710 510,780 C 490,830 520,880 490,930 C 460,970 380,990 330,995 C 270,1000 200,970 150,950 C 100,930 60,940 30,880 Z", biomeColor: "#4a5568" },
    { name: "Caelum", path: "M 850,80 C 900,40 980,30 1060,20 C 1140,10 1220,40 1270,70 C 1320,110 1350,180 1320,240 C 1290,290 1320,340 1290,400 C 1260,450 1180,480 1130,490 C 1070,500 990,470 940,450 Z", biomeColor: "#a0aec0" }
];

const AZGAAR_RIVERS = [
    "M 450,190 Q 420,280 400,500",
    "M 480,200 Q 510,320 520,480",
    "M 220,420 Q 240,440 250,450 Q 280,490 300,550",
    "M 1040,800 Q 1010,750 980,780 Q 940,790 920,850",
    "M 270,880 Q 250,780 200,700"
];

const CITIES = [
    { name: 'Eldoria', sub: 'Cité de départ', x: 400, y: 500, capital: false },
    { name: 'Solis', sub: "Capitale d'Elion", x: 450, y: 450, capital: true },
    { name: 'Riverbend', sub: 'Port Fluvial', x: 380, y: 460, capital: false },
    { name: 'Sparkwell', sub: 'Cité Technomage', x: 480, y: 200, capital: true },
    { name: 'Marché Noir', sub: 'Cœur de Gheno', x: 300, y: 350, capital: true },
    { name: 'Sylva-Lumia', sub: 'Cité de Lumière', x: 250, y: 450, capital: true },
    { name: 'Pic du Prédateur', sub: 'Sommet Sauvage', x: 980, y: 780, capital: true },
    { name: 'Fort-Sang', sub: 'Capitale Orc', x: 1150, y: 750, capital: true },
    { name: 'Donjon de la Liche', sub: 'Trône Noir', x: 250, y: 750, capital: true },
    { name: 'Palais d\'Argent', sub: 'Cœur Céleste', x: 950, y: 250, capital: true }
];

async function generateWorldMapImage() {
    const W = 1400, H = 1000;

    let continentsSvg = '';
    CONTINENTS_SHAPES.forEach(c => {
        continentsSvg += `
            <!-- Coastal Water Depth Contour Rings (Azgaar Style) -->
            <path d="${c.path}" fill="none" stroke="#2b5060" stroke-width="12" opacity="0.6" />
            <path d="${c.path}" fill="none" stroke="#203d4c" stroke-width="24" opacity="0.4" />
            <path d="${c.path}" fill="none" stroke="#162b38" stroke-width="36" opacity="0.25" />

            <!-- Biome Base Landmass -->
            <path d="${c.path}" fill="${c.biomeColor}" stroke="#1e2518" stroke-width="3.5" style="filter: drop-shadow(0 8px 18px rgba(0,0,0,0.6));" />
            <path d="${c.path}" transform="scale(0.96)" fill="rgba(255,255,255,0.08)" />
            <text x="${c.name === 'Aetheria' ? 250 : (c.name === 'Zendora' ? 1000 : (c.name === 'Umbra' ? 200 : 1000))}" y="${c.name === 'Aetheria' ? 220 : (c.name === 'Zendora' ? 620 : (c.name === 'Umbra' ? 780 : 150))}" font-family="Georgia, serif" font-weight="900" font-size="42" fill="#000000" opacity="0.22" letter-spacing="18">${c.name.toUpperCase()}</text>
        `;
    });

    let riversSvg = '';
    AZGAAR_RIVERS.forEach(rPath => {
        riversSvg += `<path d="${rPath}" fill="none" stroke="#2b5e7e" stroke-width="3.5" stroke-linecap="round" />`;
    });

    let kingdomsSvg = '';
    KINGDOMS.forEach(k => {
        const polyPath = `M ${k.polygon.map(p => p.join(',')).join(' L ')} Z`;
        kingdomsSvg += `
            <path d="${polyPath}" fill="${k.fill}" stroke="${k.color}" stroke-width="3" stroke-dasharray="8,4" />
            <rect x="${k.labelPos[0] - 65}" y="${k.labelPos[1] - 12}" width="130" height="24" fill="#12181b" stroke="${k.color}" stroke-width="1.8" rx="4" />
            <text x="${k.labelPos[0]}" y="${k.labelPos[1] + 5}" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="12" fill="${k.color}" letter-spacing="1.5">${k.short}</text>
        `;
    });

    let citiesSvg = '';
    CITIES.forEach(c => {
        if (c.capital) {
            citiesSvg += `
                <!-- Azgaar Golden Capital Star -->
                <path d="M ${c.x},${c.y - 12} L ${c.x + 4},${c.y - 4} L ${c.x + 12},${c.y - 4} L ${c.x + 6},${c.y + 1} L ${c.x + 8},${c.y + 9} L ${c.x},${c.y + 4} L ${c.x - 8},${c.y + 9} L ${c.x - 6},${c.y + 1} L ${c.x - 12},${c.y - 4} L ${c.x - 4},${c.y - 4} Z" fill="#ffd700" stroke="#000000" stroke-width="2" />
            `;
        } else {
            citiesSvg += `
                <!-- Azgaar Town Circle -->
                <circle cx="${c.x}" cy="${c.y}" r="6" fill="#e74c3c" stroke="#ffffff" stroke-width="2" />
            `;
        }
        citiesSvg += `
            <text x="${c.x + 15}" y="${c.y + 4}" font-family="Georgia, serif" font-weight="bold" font-size="14" fill="#ffffff" style="text-shadow: 1px 1px 3px black;">${c.name}</text>
        `;
    });

    const svg = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <!-- Ocean Background -->
        <rect width="100%" height="100%" fill="#122534" />

        <!-- Azgaar Grid -->
        <g stroke="rgba(255,255,255,0.05)" stroke-width="1">
            ${Array.from({length: 20}).map((_, i) => `<line x1="${i*70}" y1="0" x2="${i*70}" y2="${H}" />`).join('')}
            ${Array.from({length: 15}).map((_, i) => `<line x1="0" y1="${i*70}" x2="${W}" y2="${i*70}" />`).join('')}
        </g>

        <!-- Continents and Biomes -->
        ${continentsSvg}

        <!-- Rivers -->
        ${riversSvg}

        <!-- States / Kingdoms -->
        ${kingdomsSvg}

        <!-- Cities -->
        ${citiesSvg}

        <!-- Title Shield -->
        <g transform="translate(${W/2 - 300}, 25)">
            <rect width="600" height="75" fill="rgba(10, 15, 20, 0.9)" stroke="#ffd700" stroke-width="2" rx="8" />
            <text x="300" y="40" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="28" fill="#ffd700">AZGAAR FANTASY MAP — ${WORLD_NAME}</text>
            <text x="300" y="62" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="12" fill="#a0aec0">ROYAUMES, FLEUVES ET BIOMES DU MONDE ATR</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateWorldMapImage, WORLD_NAME };
