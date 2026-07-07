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
            <linearGradient id="stormOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ff8c00;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ff4500;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="stormBlue" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#1e90ff;stop-opacity:0.8" />
                <stop offset="100%" style="stop-color:#00008b;stop-opacity:1" />
            </linearGradient>
            <filter id="stormGlow">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <!-- Background with "Storm" feel (Ink washes and radial glow) -->
        <rect width="100%" height="100%" fill="#0a0a1a" />
        <circle cx="50%" cy="50%" r="40%" fill="rgba(255,140,0,0.05)" />

        <!-- Decorative Scrolls or Energy lines -->
        <path d="M0,0 L${width},0 L${width},40 L0,10 Z" fill="url(#stormOrange)" opacity="0.4" />
        <path d="M0,${height} L${width},${height} L${width},${height-40} L0,${height-10} Z" fill="url(#stormOrange)" opacity="0.4" />

        <!-- Stylized diagonal "action" bars -->
        <path d="M-100,200 L${width+100},100 L${width+100},150 L-100,250 Z" fill="rgba(255,255,255,0.03)" />
        <path d="M-100,500 L${width+100},400 L${width+100},450 L-100,550 Z" fill="rgba(255,140,0,0.02)" />

        <!-- Background particle/dots -->
        <g opacity="0.2">
            ${Array.from({length: 50}).map(() => `<circle cx="${Math.random()*width}" cy="${Math.random()*height}" r="${Math.random()*2}" fill="#ffffff" />`).join('')}
        </g>

        <!-- Main Title Header (Naruto Storm Style) -->
        <g transform="translate(100, 80)">
            <rect x="-20" y="-40" width="450" height="80" fill="url(#stormOrange)" rx="5" transform="skewX(-15)" />
            <path d="M430,-40 L460,40 L440,40 L410,-40 Z" fill="#ffffff" opacity="0.3" transform="skewX(-15)" />
            <text x="0" y="20" font-family="Arial Black" font-size="60" fill="#ffffff" style="filter: url(#stormGlow);">ARISE II</text>
            <text x="350" y="20" font-family="Arial" font-size="24" fill="#ffffff" font-weight="bold" font-style="italic">STORM</text>
        </g>

        <!-- Menu Navigation (Circular/Stylized list) -->
        <g transform="translate(150, 250)">
            ${['/action', '/profil', '/quests', '/map', '/bank', '/lore'].map((cmd, i) => `
                <g transform="translate(${i * 35}, ${i * 65})">
                    <!-- Perspective selection bars -->
                    <rect x="0" y="-30" width="${320 - i * 10}" height="55" fill="${i === 0 ? 'url(#stormOrange)' : 'rgba(255,255,255,0.05)'}" rx="5" transform="skewX(-25)" />
                    <rect x="-15" y="-30" width="10" height="55" fill="${i === 0 ? '#ffffff' : 'rgba(255,255,255,0.1)'}" transform="skewX(-25)" />

                    <!-- Selection Indicator -->
                    <circle cx="-45" cy="-2" r="18" fill="${i === 0 ? '#ffffff' : 'none'}" stroke="${i === 0 ? '#ff4500' : 'rgba(255,255,255,0.2)'}" stroke-width="3" />
                    ${i === 0 ? `<circle cx="-45" cy="-2" r="8" fill="#ff4500" />` : ''}

                    <text x="25" y="8" font-family="Arial Black" font-size="30" fill="${i === 0 ? '#ffffff' : '#aaaaaa'}" style="${i === 0 ? 'filter: drop-shadow(0 0 5px rgba(0,0,0,0.5))' : ''}">${cmd.toUpperCase()}</text>
                </g>
            `).join('')}
        </g>

        <!-- Character Status "Storm" Window -->
        <g transform="translate(750, 150)">
            <rect x="0" y="0" width="350" height="450" fill="rgba(0,0,0,0.6)" stroke="#ff8c00" stroke-width="3" rx="20" />
            <rect x="20" y="20" width="310" height="150" fill="rgba(255,255,255,0.1)" rx="10" />
            <text x="175" y="110" font-family="Arial" font-size="20" fill="#ffffff" text-anchor="middle" font-style="italic">READY FOR BATTLE</text>

            <g transform="translate(40, 220)">
                <text x="0" y="0" font-family="Arial" font-size="16" fill="#ff8c00" font-weight="bold">SYSTEM STATUS</text>
                <text x="0" y="25" font-family="Arial" font-size="32" fill="#ffffff" font-weight="900">ONLINE</text>

                <rect x="0" y="60" width="270" height="5" fill="rgba(255,255,255,0.1)" />
                <rect x="0" y="60" width="200" height="5" fill="#ff8c00" />

                <text x="0" y="100" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.5)">GHENO MATRIX V4.5</text>
            </g>
        </g>

        <!-- Footer -->
        <g transform="translate(50, ${height - 50})">
            <text font-family="Arial Black" font-size="16" fill="rgba(255,255,255,0.3)">© 2024 ARISE II // ULTIMATE NINJA CORE</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
