const sharp = require('sharp');

/**
 * Generates a visually appealing main menu image using Sharp and SVG.
 * Optimized for ARISE II - GHENO CITY theme.
 */
async function generateMainMenuImage() {
    const width = 1200;
    const height = 700;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#050510;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#0a0a25;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#050510;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00ffff;stop-opacity:0.8" />
                <stop offset="100%" style="stop-color:#0088ff;stop-opacity:0.8" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ff8800;stop-opacity:1" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Cyber grid with perspective effect -->
        <g stroke="rgba(0, 255, 255, 0.1)" stroke-width="1">
            ${Array.from({length: 25}).map((_, i) => `<line x1="${i*50}" y1="0" x2="${i*50}" y2="${height}" />`).join('')}
            ${Array.from({length: 15}).map((_, i) => `<line x1="0" y1="${i*50}" x2="${width}" y2="${i*50}" />`).join('')}
        </g>

        <!-- Background decorative elements -->
        <circle cx="900" cy="150" r="200" fill="url(#blueGrad)" opacity="0.05" filter="url(#glow)" />
        <rect x="50" y="50" width="100" height="2" fill="#00ffff" opacity="0.5" />
        <rect x="50" y="50" width="2" height="100" fill="#00ffff" opacity="0.5" />

        <!-- Main Title -->
        <g filter="url(#glow)">
            <text x="50%" y="35%" dominant-baseline="middle" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="160" fill="white" style="letter-spacing: 25px;">ARISE II</text>
            <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="50" fill="url(#goldGrad)" style="letter-spacing: 12px;">GHENO CITY : MATRIX REBORN</text>
        </g>

        <!-- Central Bar -->
        <rect x="200" y="58%" width="800" height="2" fill="url(#blueGrad)" />
        <circle cx="500" cy="58%" r="4" fill="#00ffff" />

        <!-- Menu Text Mockup -->
        <text x="50%" y="68%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="22" fill="rgba(255, 255, 255, 0.6)" style="letter-spacing: 4px;">INITIALIZING_NEURAL_LINK... OK</text>
        <text x="50%" y="74%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="18" fill="#00ffff" opacity="0.8">TAPEZ /action POUR ENTRER DANS LA MATRICE</text>

        <!-- Signature / Version -->
        <g transform="translate(30, 670)">
            <text font-family="monospace" font-size="14" fill="rgba(255, 255, 255, 0.4)">VERSION: 2.1.0_STABLE</text>
        </g>
        <g transform="translate(1170, 670)">
            <text text-anchor="end" font-family="monospace" font-size="14" fill="rgba(255, 255, 255, 0.4)">ENGINE: SHARP_SVG_RENDERER</text>
        </g>

        <!-- Corners -->
        <path d="M 30 100 L 30 30 L 100 30" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
        <path d="M ${width-100} 30 L ${width-30} 30 L ${width-30} 100" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
        <path d="M 30 ${height-100} L 30 ${height-30} L 100 ${height-30}" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
        <path d="M ${width-100} ${height-30} L ${width-30} ${height-30} L ${width-30} ${height-100}" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
