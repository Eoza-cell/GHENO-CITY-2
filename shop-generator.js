const sharp = require('sharp');
const path = require('path');

/**
 * Escapes characters for SVG/XML.
 */
function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

/**
 * Generates a visual catalog for shop items using SVG and Sharp.
 * Returns a Buffer.
 */
async function generateShopImage(title, items) {
    const width = 800;
    const itemHeight = 100;
    const headerHeight = 120;
    const footerHeight = 60;
    const height = headerHeight + (items.length * itemHeight) + footerHeight;

    const colors = {
        common: '#ffffff',
        rare: '#4fb3ff',
        epic: '#cc44ff',
        legendary: '#ffd700'
    };

    let itemsSvg = '';
    items.forEach((item, i) => {
        const y = headerHeight + (i * itemHeight);
        const rarityColor = colors[item.rarity] || '#ffffff';

        itemsSvg += `
            <g transform="translate(40, ${y})">
                <rect width="720" height="90" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" rx="5" />
                <text x="20" y="35" font-family="Arial" font-size="20" font-weight="bold" fill="${rarityColor}">${escapeXml(item.name.toUpperCase())}</text>
                <text x="20" y="65" font-family="Arial" font-size="14" fill="#aaa">${escapeXml(item.description.substring(0, 70))}...</text>
                <text x="700" y="50" font-family="Arial" font-size="24" font-weight="900" fill="#ffd700" text-anchor="end">${item.price} COL</text>
                <line x1="20" y1="75" x2="150" y2="75" stroke="${rarityColor}" stroke-width="2" opacity="0.5" />
            </g>
        `;
    });

    const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#0a0a0a" />

            <!-- Grid Background -->
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />

            <!-- Header -->
            <rect width="100%" height="${headerHeight}" fill="rgba(255,215,0,0.1)" />
            <text x="40" y="70" font-family="Arial" font-size="42" font-weight="900" fill="#ffd700">${escapeXml(title)}</text>
            <text x="40" y="100" font-family="monospace" font-size="14" fill="#888">DISPONIBILITÉ LIMITÉE // SYSTÈME DE COMMERCE ARISE</text>

            <!-- Items -->
            ${itemsSvg}

            <!-- Footer -->
            <text x="400" y="${height - 25}" font-family="monospace" font-size="14" fill="#555" text-anchor="middle">UTILISEZ /ACHETER [NOM] POUR ACQUÉRIR UN OBJET</text>
        </svg>
    `;

    return await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}

module.exports = { generateShopImage };
