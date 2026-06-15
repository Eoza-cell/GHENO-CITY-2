const sharp = require('sharp');

/**
 * Generates a "LINK START" intro image for the tutorial using Sharp and SVG.
 */
async function generateLinkStartImage() {
    const width = 1000;
    const height = 600;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" style="stop-color:#001a33;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
            </radialGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Tech lines -->
        <g stroke="rgba(0, 200, 255, 0.2)" stroke-width="1">
            ${Array.from({length: 20}).map(() => {
                const x1 = Math.random() * width;
                const x2 = Math.random() * width;
                return `<line x1="${x1}" y1="0" x2="${x2}" y2="${height}" />`;
            }).join('')}
        </g>

        <!-- "LINK START" Text -->
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="90" fill="white" style="filter: drop-shadow(0 0 15px #00ffff);">LINK START</text>

        <!-- Subtitle -->
        <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#00aaff">CHARGEMENT DE LA MATRICE...</text>

        <!-- Progress Bar (Fake) -->
        <rect x="300" y="450" width="400" height="10" fill="none" stroke="#004466" stroke-width="1" />
        <rect x="300" y="450" width="320" height="10" fill="#00ffff" />
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateLinkStartImage };
