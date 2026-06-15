const sharp = require('sharp');

/**
 * Generates a visually appealing main menu image using Sharp and SVG.
 */
async function generateMainMenuImage() {
    const width = 1000;
    const height = 600;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#020205;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#0a0a1f;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#020205;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#00aaff;stop-opacity:0" />
                <stop offset="100%" style="stop-color:#00aaff;stop-opacity:0.3" />
            </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Grid -->
        <g stroke="rgba(0, 150, 255, 0.1)" stroke-width="1">
            ${Array.from({length: 21}).map((_, i) => `<line x1="${i*50}" y1="0" x2="${i*50}" y2="${height}" />`).join('')}
            ${Array.from({length: 13}).map((_, i) => `<line x1="0" y1="${i*50}" x2="${width}" y2="${i*50}" />`).join('')}
        </g>

        <!-- Title Section -->
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="70" fill="white" style="filter: drop-shadow(0 0 10px #00aaff);">ARISE : AETHERYS</text>
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="30" fill="#00ccff">GHENO CITY 2 • LINK START</text>

        <!-- Bottom Decorative Bar -->
        <rect x="0" y="${height-100}" width="${width}" height="100" fill="url(#barGrad)" />
        <line x1="100" y1="${height-50}" x2="${width-100}" y2="${height-50}" stroke="#00aaff" stroke-width="4" />

        <text x="50%" y="${height-20}" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-style="italic" font-size="18" fill="rgba(255, 255, 255, 0.7)">Le destin est entre tes mains, voyageur.</text>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
