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
                <stop offset="100%" style="stop-color:#7000ff;stop-opacity:0.8" />
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
            <text x="50%" y="32%" dominant-baseline="middle" text-anchor="middle" font-family="IPAGothic" font-weight="900" font-size="180" fill="white" style="letter-spacing: 30px; filter: drop-shadow(0 0 30px rgba(0,255,255,1));">ARISE</text>
            <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle" font-family="IPAGothic" font-weight="bold" font-size="65" fill="url(#goldGrad)" style="letter-spacing: 15px;">GHENO CITY: AWAKENING</text>
        </g>

        <!-- Central Decorative Elements -->
        <g transform="translate(600, 500)">
            <rect x="-450" y="0" width="900" height="2" fill="url(#blueGrad)" />
            <rect x="-200" y="-10" width="400" height="20" fill="none" stroke="rgba(0, 255, 255, 0.3)" stroke-width="1" />
            <text x="0" y="5" dominant-baseline="middle" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="16" fill="#00ffff" opacity="0.9" style="letter-spacing: 8px;">SYSTEM_ONLINE</text>
        </g>

        <!-- Menu Text Mockup -->
        <g filter="url(#glow)">
            <text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="28" fill="#ffffff" style="letter-spacing: 5px; font-weight: bold;">[ NAVIGATION INTERFACE ]</text>
        </g>
        <text x="50%" y="72%" dominant-baseline="middle" text-anchor="middle" font-family="IPAGothic" font-size="20" fill="#00ffff" opacity="0.8" style="letter-spacing: 2px;">VOTRE DESTIN VOUS ATTEND DANS L'INTERSTICE</text>

        <!-- Signature / Version -->
        <g transform="translate(30, 670)">
            <text font-family="DejaVu Sans Mono" font-size="14" fill="rgba(255, 255, 255, 0.4)">VERSION: 3.0.0_ULTRA</text>
        </g>
        <g transform="translate(1170, 670)">
            <text text-anchor="end" font-family="DejaVu Sans Mono" font-size="14" fill="rgba(255, 255, 255, 0.4)">ENGINE: SHARP_SVG_RENDERER</text>
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
