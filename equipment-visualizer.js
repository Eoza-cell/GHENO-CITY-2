const sharp = require('sharp');
const path = require('path');

/**
 * Generates an SVG silhouette with highlighted equipment parts.
 * @param {Object} equipment Status of each slot (true if equipped, false otherwise)
 * @returns {Promise<Buffer>} The image buffer.
 */
async function generateEquipmentStatusImage(equipment) {
    const width = 400;
    const height = 600;

    // Colors
    const baseColor = '#555555';
    const highlightColor = '#00FF00';

    // SVG paths for different body parts (simplified)
    const parts = {
        head: `<circle cx="200" cy="80" r="40" fill="${equipment.head ? highlightColor : baseColor}" stroke="white" stroke-width="1" />`,
        chest: `<rect x="150" y="130" width="100" height="150" rx="10" fill="${equipment.chest ? highlightColor : baseColor}" stroke="white" stroke-width="1" />`,
        arms: `
            <rect x="100" y="140" width="40" height="120" rx="5" fill="${equipment.arms ? highlightColor : baseColor}" stroke="white" stroke-width="1" />
            <rect x="260" y="140" width="40" height="120" rx="5" fill="${equipment.arms ? highlightColor : baseColor}" stroke="white" stroke-width="1" />
        `,
        legs: `
            <rect x="155" y="290" width="40" height="150" rx="5" fill="${equipment.legs ? highlightColor : baseColor}" stroke="white" stroke-width="1" />
            <rect x="205" y="290" width="40" height="150" rx="5" fill="${equipment.legs ? highlightColor : baseColor}" stroke="white" stroke-width="1" />
        `,
        weapon: `<rect x="310" y="100" width="15" height="200" rx="2" fill="${equipment.weapon ? highlightColor : baseColor}" transform="rotate(15, 310, 100)" stroke="white" stroke-width="1" />`
    };

    const svgString = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#1a1a1a" />
            <text x="200" y="40" font-family="Arial" font-size="28" fill="white" text-anchor="middle" font-weight="bold">ÉTAT DE L'ÉQUIPEMENT</text>
            ${parts.head}
            ${parts.chest}
            ${parts.arms}
            ${parts.legs}
            ${parts.weapon}
            <text x="200" y="520" font-family="Arial" font-size="18" fill="#00FF00" text-anchor="middle">🟢 PROTÉGÉ</text>
            <text x="200" y="550" font-family="Arial" font-size="18" fill="#555555" text-anchor="middle">⚪ NON PROTÉGÉ</text>
        </svg>
    `;

    return sharp(Buffer.from(svgString)).png().toBuffer();
}

module.exports = { generateEquipmentStatusImage };
