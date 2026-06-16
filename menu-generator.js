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
                <stop offset="50%" style="stop-color:#050520;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#020205;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffd700;stop-opacity:0.9" />
                <stop offset="100%" style="stop-color:#ffa500;stop-opacity:0.9" />
            </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Cyber Hex Grid -->
        <pattern id="hexagons" width="50" height="43.4" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
            <path d="M25 0 L50 14.4 L50 28.8 L25 43.4 L0 28.8 L0 14.4 Z" fill="none" stroke="rgba(0, 255, 255, 0.05)" stroke-width="1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#hexagons)" />

        <!-- Main Frame -->
        <rect x="30" y="30" width="${width-60}" height="${height-60}" fill="none" stroke="url(#goldGrad)" stroke-width="1" rx="15" />
        <path d="M 30 100 L 100 30 M ${width-100} ${height-30} L ${width-30} ${height-100}" stroke="#ffd700" stroke-width="4" />

        <!-- Title -->
        <text x="50%" y="30%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="100" fill="white" style="filter: drop-shadow(0 0 20px #ffd700); letter-spacing: 15px;">ARISE</text>
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="40" fill="#00ffff" style="letter-spacing: 8px; filter: drop-shadow(0 0 10px #00ffff);">AETHERYS ONLINE</text>

        <rect x="250" y="52%" width="500" height="2" fill="url(#goldGrad)" />
        <text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="25" fill="rgba(255, 255, 255, 0.7)">SYSTÈME MJ v3.0 - ALPHA PHASE</text>

        <!-- Navigation Mockup -->
        <g transform="translate(150, 450)">
            <rect width="700" height="80" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1" rx="10" />
            <text x="350" y="45" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="white" style="letter-spacing: 3px;">UTILISEZ LES COMMANDES POUR NAVIGUER</text>
        </g>

        <!-- Signature -->
        <text x="950" y="570" text-anchor="end" font-family="monospace" font-size="12" fill="rgba(255, 255, 255, 0.3)">CORE_ENGINE_STABLE // NO_GHOST_IN_THE_SHELL</text>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
