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
                <stop offset="0%" style="stop-color:#050510;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#101030;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#050510;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ff00ff;stop-opacity:0.8" />
                <stop offset="100%" style="stop-color:#00ffff;stop-opacity:0.8" />
            </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Cyber Grid -->
        <g stroke="rgba(0, 255, 255, 0.15)" stroke-width="1">
            ${Array.from({length: 41}).map((_, i) => `<line x1="${i*25}" y1="0" x2="${i*25}" y2="${height}" />`).join('')}
            ${Array.from({length: 25}).map((_, i) => `<line x1="0" y1="${i*25}" x2="${width}" y2="${i*25}" />`).join('')}
        </g>

        <!-- Decorative Frames -->
        <rect x="50" y="50" width="${width-100}" height="${height-100}" fill="none" stroke="url(#neonGrad)" stroke-width="2" rx="10" />
        <path d="M 50 150 L 150 50 M ${width-150} ${height-50} L ${width-50} ${height-150}" stroke="#00ffff" stroke-width="5" />

        <!-- Title Section -->
        <text x="50%" y="35%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="120" fill="white" style="filter: drop-shadow(0 0 30px #00ffff); letter-spacing: 20px;">LINK START</text>
        <rect x="200" y="42%" width="600" height="4" fill="url(#neonGrad)" />
        <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="50" fill="#ff00ff" style="letter-spacing: 10px; filter: drop-shadow(0 0 15px #ff00ff);">GATEWAY TO AETHERYS</text>

        <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="22" fill="rgba(255, 255, 255, 0.8)">- SYSTÈME DE JEU v2.5 -</text>

        <!-- Stats Preview Mockup -->
        <g transform="translate(100, 450)">
            <rect width="200" height="60" fill="rgba(0,0,0,0.5)" stroke="#00ffff" stroke-width="1" />
            <text x="10" y="35" font-family="monospace" font-size="18" fill="#00ffff">STATUS: ONLINE</text>

            <rect x="250" y="0" width="300" height="60" fill="rgba(0,0,0,0.5)" stroke="#ff00ff" stroke-width="1" />
            <text x="260" y="35" font-family="monospace" font-size="18" fill="#ff00ff">WORLD: ELDORIA [PVP-ON]</text>
        </g>

        <!-- Bottom Tag -->
        <text x="50%" y="${height-80}" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-style="italic" font-size="20" fill="rgba(255, 255, 255, 0.6)">Préparez-vous à l'éveil.</text>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
