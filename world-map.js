const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const WORLD_NAME = 'AFTER THE REBIRTH (ATR)';

const KINGDOMS = [
    { name: "Empire Impérial d'Elion", short: "ELION", continent: "Aetheria", color: '#f1c40f', fill: 'rgba(241,196,15,0.3)', labelPos: [430, 440] },
    { name: 'Royaume de Valkyrr', short: 'VALKYRR', continent: "Aetheria", color: '#3498db', fill: 'rgba(52,152,219,0.3)', labelPos: [450, 245] },
    { name: 'Gheno souterrain', short: 'GHENO', continent: "Aetheria", color: '#9b59b6', fill: 'rgba(155,89,182,0.3)', labelPos: [290, 340] },
    { name: 'Forêt de l\'Éveil', short: 'SYLVA', continent: "Aetheria", color: '#2ecc71', fill: 'rgba(46,204,113,0.3)', labelPos: [240, 460] },
    { name: 'Archipel des Murmures', short: 'MURMURES', continent: "Aetheria", color: '#1abc9c', fill: 'rgba(26,188,156,0.3)', labelPos: [180, 240] },

    { name: 'Terres Bestiales', short: 'BESTIALIA', continent: "Zendora", color: '#e67e22', fill: 'rgba(230,126,34,0.3)', labelPos: [960, 740] },
    { name: 'Bastion d\'Orkh', short: 'ORKH', continent: "Zendora", color: '#e74c3c', fill: 'rgba(231,76,60,0.3)', labelPos: [1160, 760] },
    { name: 'Montagnes de Fer', short: 'IRON', continent: "Zendora", color: '#95a5a6', fill: 'rgba(149,165,166,0.3)', labelPos: [1060, 920] },
    { name: 'Désert d\'Ambre', short: 'AMBRE', continent: "Zendora", color: '#f39c12', fill: 'rgba(243,156,18,0.3)', labelPos: [1140, 590] },

    { name: 'Dominion Noir de Vharos', short: 'VHAROS', continent: "Umbra", color: '#8e44ad', fill: 'rgba(142,68,173,0.3)', labelPos: [240, 760] },
    { name: 'Nécropolis', short: 'NÉCROPOLIS', continent: "Umbra", color: '#34495e', fill: 'rgba(52,73,94,0.35)', labelPos: [460, 770] },
    { name: 'L\'Interstice', short: 'INTERSTICE', continent: "Umbra", color: '#2c3e50', fill: 'rgba(44,62,80,0.4)', labelPos: [360, 930] },

    { name: 'Royaume Céleste', short: 'CELESTIA', continent: "Caelum", color: '#00ffff', fill: 'rgba(0,255,255,0.3)', labelPos: [940, 240] },
    { name: 'Abysse Inférieur', short: 'ABYSSE', continent: "Caelum", color: '#e74c3c', fill: 'rgba(231,76,60,0.3)', labelPos: [1160, 260] }
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

/**
 * Watabou Medieval Town Generator (TownGeneratorOS Style)
 */
async function generateWatabouTownMap(cityName = 'Eldoria') {
    const W = 1200, H = 900;
    const buildingRoofs = [];
    const colors = ['#b85444', '#9e4638', '#5b6b7c', '#7d8c9e', '#8c6d58'];

    for (let i = 0; i < 180; i++) {
        const cx = 350 + Math.random() * 500;
        const cy = 250 + Math.random() * 400;
        const bw = 15 + Math.random() * 25;
        const bh = 15 + Math.random() * 25;
        const color = colors[Math.floor(Math.random() * colors.length)];
        buildingRoofs.push(`
            <rect x="${cx}" y="${cy}" width="${bw}" height="${bh}" fill="${color}" stroke="#2a221b" stroke-width="1.2" transform="rotate(${Math.floor(Math.random()*45)}, ${cx+bw/2}, ${cy+bh/2})" />
        `);
    }

    const svg = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f2e6ce" />
        <path d="M 100,100 C 300,300 500,200 700,500 C 900,800 1100,700 1200,900" fill="none" stroke="#688a9e" stroke-width="45" opacity="0.8" />
        <path d="M 200,450 Q 600,450 1000,450" fill="none" stroke="#c8b89e" stroke-width="14" />
        <path d="M 600,150 Q 600,450 600,750" fill="none" stroke="#c8b89e" stroke-width="14" />
        <polygon points="300,200 600,150 900,200 950,450 900,700 600,750 300,700 250,450" fill="none" stroke="#3d332a" stroke-width="8" />
        ${buildingRoofs.join('')}
        <g transform="translate(50, 40)">
            <rect width="450" height="65" fill="#f8f0de" stroke="#3d332a" stroke-width="2.5" rx="4" />
            <text x="225" y="35" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="24" fill="#2a221b">PLAN DE LA CITÉ — ${cityName.toUpperCase()}</text>
            <text x="225" y="52" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="12" fill="#5c4a3d">WATABOU TOWN GENERATOR OS • ATR EDITION</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * High-Fidelity Azgaar & D&D Real Fantasy World Map Generator
 */
async function generateWorldMapImage() {
    const W = 1600, H = 1100;

    // A deterministic in-code fantasy map: no Pollinations, no remote image API,
    // no random background. The same world geography is rendered every time.
    const kingdomRegions = [
        { d: 'M80 160 C210 80 420 90 530 230 C500 390 310 430 110 340 Z', fill: '#d9e8d2', stroke: '#54704f' },
        { d: 'M520 120 C760 70 920 180 890 360 C790 440 610 410 500 300 Z', fill: '#cfd8b8', stroke: '#59664c' },
        { d: 'M930 120 C1250 90 1500 180 1510 420 C1370 510 1110 470 910 350 Z', fill: '#4b4239', stroke: '#2b2520' },
        { d: 'M70 420 C300 360 560 440 610 700 C460 850 190 820 70 670 Z', fill: '#3b3148', stroke: '#241d2c' },
        { d: 'M640 430 C920 350 1160 470 1100 760 C920 900 700 820 590 650 Z', fill: '#c9c59f', stroke: '#625d43' },
        { d: 'M1120 500 C1430 420 1570 560 1510 900 C1330 980 1120 860 1080 690 Z', fill: '#c89b58', stroke: '#71502c' }
    ];

    const regions = kingdomRegions.map(r => '<path d="' + r.d + '" fill="' + r.fill + '" stroke="' + r.stroke + '" stroke-width="7"/>').join('');

    const mountains = Array.from({ length: 45 }, (_, i) => {
        const x = 180 + ((i * 83) % 1200);
        const y = 180 + ((i * 137) % 650);
        return '<path d="M' + x + ',' + (y+38) + ' L' + (x+22) + ',' + (y-22) + ' L' + (x+46) + ',' + (y+38) + ' Z" fill="#6d665d" opacity=".72"/>';
    }).join('');

    const forests = Array.from({ length: 120 }, (_, i) => {
        const x = 120 + ((i * 47) % 1300);
        const y = 180 + ((i * 71) % 720);
        return '<circle cx="' + x + '" cy="' + y + '" r="' + (5 + i % 7) + '" fill="#345c3b" opacity=".72"/>';
    }).join('');

    const labels = [
        ['VALKYRR', 310, 210], ['ELION', 730, 250], ['DRAGONIA', 1210, 250],
        ['GHENO', 300, 590], ['ELDORIA', 780, 530], ['XERATH', 1290, 700],
        ['LUMENORA', 300, 760], ['AZURIA', 780, 900]
    ].map(([name,x,y]) => '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="bold" fill="#2b2118" stroke="#f3e4c2" stroke-width="1">' + name + '</text>').join('');

    const cities = CITIES.map(city =>
        '<circle cx="' + (city.x * 1.12 + 210) + '" cy="' + (city.y * 0.95 + 80) + '" r="' + (city.capital ? 10 : 7) + '" fill="' + (city.capital ? '#d4af37' : '#9d2f2f') + '" stroke="#1d1712" stroke-width="3"/>' +
        '<text x="' + (city.x * 1.12 + 225) + '" y="' + (city.y * 0.95 + 85) + '" font-family="Georgia,serif" font-size="16" fill="#241a13">' + city.name + '</text>'
    ).join('');

    const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity=".5"/></filter>
          <pattern id="waves" width="42" height="24" patternUnits="userSpaceOnUse"><path d="M0 12 Q10 2 21 12 T42 12" fill="none" stroke="#4b7180" stroke-width="2" opacity=".35"/></pattern>
        </defs>
        <rect width="100%" height="100%" fill="#163846"/>
        <rect width="100%" height="100%" fill="url(#waves)"/>
        <g filter="url(#shadow)">${regions}</g>
        <g>${mountains}</g><g>${forests}</g>
        <path d="M700 0 C650 230 850 330 760 600 S900 900 820 1100" fill="none" stroke="#7aa5ad" stroke-width="15" opacity=".8"/>
        <path d="M0 550 C300 490 470 600 760 560 S1200 500 1600 620" fill="none" stroke="#7aa5ad" stroke-width="11" opacity=".7"/>
        <g>${cities}</g><g>${labels}</g>
        <g transform="translate(95 95)">
          <circle r="55" fill="#f0dfb7" stroke="#2b2118" stroke-width="5"/>
          <path d="M0,-48 L12,0 L0,48 L-12,0 Z" fill="#9d2f2f"/><path d="M-48,0 L0,12 L48,0 L0,-12 Z" fill="#263746"/>
          <text x="0" y="-66" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#f0dfb7">N</text>
        </g>
        <g transform="translate(400 35)">
          <rect width="800" height="90" rx="12" fill="#16120e" stroke="#d4af37" stroke-width="4"/>
          <text x="400" y="42" text-anchor="middle" font-family="Georgia,serif" font-size="35" font-weight="bold" fill="#d4af37">AFTER THE REBIRTH</text>
          <text x="400" y="70" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#ead9b0">CARTE DU MONDE — AETHERIS</text>
        </g>
        <g transform="translate(1210 930)">
          <rect width="310" height="125" rx="8" fill="#16120e" stroke="#d4af37" stroke-width="3"/>
          <text x="20" y="35" font-family="Georgia,serif" font-size="18" fill="#d4af37">LÉGENDE</text>
          <circle cx="28" cy="65" r="7" fill="#d4af37"/><text x="48" y="71" font-family="Georgia,serif" font-size="15" fill="#ead9b0">Capitale</text>
          <circle cx="28" cy="95" r="6" fill="#9d2f2f"/><text x="48" y="101" font-family="Georgia,serif" font-size="15" fill="#ead9b0">Ville</text>
        </g>
      </svg>`;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateWorldMapImage, generateWatabouTownMap, WORLD_NAME };
