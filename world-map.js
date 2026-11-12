const sharp = require('sharp');
const { getPageAsset } = require('./aetherys-visual-pack');

const WORLD_NAME = 'AFTER THE REBIRTH (ATR)';

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
    // Carte officielle du dossier AETHERYS, puis carte complémentaire.
    // La liste détaillée des royaumes est construite depuis la base de données.
    const source = getPageAsset(81) || getPageAsset(84);
    if (!source) throw new Error('Carte AETHERYS non extraite : préparer le pack au démarrage.');
    return sharp(source)
        .resize({ width: 1600, height: 1100, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 92 })
        .toBuffer();
}

module.exports = { generateWorldMapImage, generateWatabouTownMap, WORLD_NAME };
