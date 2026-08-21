const sharp = require('sharp');
const axios = require('axios');
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
    const W = 1400, H = 1000;

    let kingdomsSvg = '';
    KINGDOMS.forEach(k => {
        kingdomsSvg += `
            <rect x="${k.labelPos[0] - 70}" y="${k.labelPos[1] - 14}" width="140" height="28" fill="#12181b" stroke="${k.color}" stroke-width="2" rx="5" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.8));" />
            <text x="${k.labelPos[0]}" y="${k.labelPos[1] + 5}" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="13" fill="${k.color}" letter-spacing="1.5">${k.short}</text>
        `;
    });

    let citiesSvg = '';
    CITIES.forEach(c => {
        if (c.capital) {
            citiesSvg += `
                <path d="M ${c.x},${c.y - 12} L ${c.x + 4},${c.y - 4} L ${c.x + 12},${c.y - 4} L ${c.x + 6},${c.y + 1} L ${c.x + 8},${c.y + 9} L ${c.x},${c.y + 4} L ${c.x - 8},${c.y + 9} L ${c.x - 6},${c.y + 1} L ${c.x - 12},${c.y - 4} L ${c.x - 4},${c.y - 4} Z" fill="#ffd700" stroke="#000000" stroke-width="2" style="filter: drop-shadow(0 0 6px #ffd700);" />
            `;
        } else {
            citiesSvg += `
                <circle cx="${c.x}" cy="${c.y}" r="6" fill="#e74c3c" stroke="#ffffff" stroke-width="2" style="filter: drop-shadow(0 0 4px #e74c3c);" />
            `;
        }
        citiesSvg += `
            <text x="${c.x + 16}" y="${c.y + 4}" font-family="Georgia, serif" font-weight="bold" font-size="15" fill="#ffffff" style="text-shadow: 2px 2px 4px black;">${c.name}</text>
        `;
    });

    const overlaySvg = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <!-- Azgaar Cartographic Grid Overlay -->
        <g stroke="rgba(255,255,255,0.08)" stroke-width="1">
            ${Array.from({length: 20}).map((_, i) => `<line x1="${i*70}" y1="0" x2="${i*70}" y2="${H}" />`).join('')}
            ${Array.from({length: 15}).map((_, i) => `<line x1="0" y1="${i*70}" x2="${W}" y2="${i*70}" />`).join('')}
        </g>

        <!-- Kingdom Region Markers -->
        ${kingdomsSvg}

        <!-- Cities & Capitals -->
        ${citiesSvg}

        <!-- Azgaar Compass Rose -->
        <g transform="translate(1250, 850)">
            <circle cx="0" cy="0" r="50" fill="rgba(10,15,20,0.8)" stroke="#ffd700" stroke-width="2" />
            <path d="M 0,-45 L 6,-8 L 0,0 L -6,-8 Z" fill="#ffd700" />
            <path d="M 0,45 L 6,8 L 0,0 L -6,8 Z" fill="#ffffff" />
            <path d="M 45,0 L 8,6 L 0,0 L 8,-6 Z" fill="#ffd700" />
            <path d="M -45,0 L -8,6 L 0,0 L -8,-6 Z" fill="#ffffff" />
            <text x="0" y="-55" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="14" fill="#ffd700">N</text>
        </g>

        <!-- Grand Azgaar / ATR Title Banner -->
        <g transform="translate(${W/2 - 320}, 30)">
            <rect width="640" height="80" fill="rgba(10, 15, 20, 0.9)" stroke="#ffd700" stroke-width="2.5" rx="8" style="filter: drop-shadow(0 6px 15px rgba(0,0,0,0.8));" />
            <text x="320" y="42" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="28" fill="#ffd700">AZGAAR FANTASY MAP — ${WORLD_NAME}</text>
            <text x="320" y="64" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-size="12" fill="#a0aec0">ROYAUMES, CITES ET FRONTIÈRES CARTOGRAPHIQUES ATR</text>
        </g>
    </svg>
    `;

    // Try using cached real fantasy map artwork background if present, or fetch from Pollinations
    const bgPath = path.join(__dirname, 'assets', 'real_fantasy_world_map_bg.jpg');
    let bgBuffer = null;

    if (fs.existsSync(bgPath)) {
        try {
            bgBuffer = fs.readFileSync(bgPath);
        } catch (e) {}
    }

    if (!bgBuffer) {
        try {
            const prompt = 'ultra detailed epic fantasy world map, parchment texture, ancient continents, oceans, mountains, rivers, cartography masterpiece, D&D fantasy map style';
            const { generateHuggingFaceImage } = require('./message-handler');
            const hfBuf = await generateHuggingFaceImage(prompt);
            if (hfBuf) {
                bgBuffer = hfBuf;
                fs.writeFileSync(bgPath, bgBuffer);
            }
        } catch (e) {
            console.warn("[WORLD MAP] Could not fetch map background via Hugging Face, using fallback color:", e.message);
        }
    }

    if (bgBuffer) {
        return sharp(bgBuffer)
            .resize(W, H, { fit: 'cover' })
            .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
            .png()
            .toBuffer();
    } else {
        const fallbackSvg = `<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="#122534" />${overlaySvg}</svg>`;
        return sharp(Buffer.from(fallbackSvg)).png().toBuffer();
    }
}

module.exports = { generateWorldMapImage, generateWatabouTownMap, WORLD_NAME };
