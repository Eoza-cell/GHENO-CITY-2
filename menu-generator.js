const sharp = require('sharp');

/**
 * Generates a visually appealing main menu image using Sharp and SVG.
 * Optimized for ARISE II - GHENO CITY theme.
 */
async function generateMainMenuImage() {
    const width = 1400;
    const height = 820;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#04040d;stop-opacity:1" />
                <stop offset="45%" style="stop-color:#0b1233;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#03030a;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:rgba(20,26,58,0.92);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(8,11,28,0.88);stop-opacity:1" />
            </linearGradient>
            <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#67f7ff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#5c7cff;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffe28a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ff9b39;stop-opacity:1" />
            </linearGradient>
            <radialGradient id="orbLeft" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:rgba(0,255,255,0.45);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(0,255,255,0);stop-opacity:0" />
            </radialGradient>
            <radialGradient id="orbRight" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:rgba(126,92,255,0.38);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(126,92,255,0);stop-opacity:0" />
            </radialGradient>
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="16" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(103,247,255,0.09)" stroke-width="1"/>
            </pattern>
            <linearGradient id="scanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:rgba(255,255,255,0.12);stop-opacity:1" />
                <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
            </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />
        <rect width="100%" height="100%" fill="url(#grid)" />

        <circle cx="280" cy="180" r="260" fill="url(#orbLeft)" />
        <circle cx="1120" cy="210" r="280" fill="url(#orbRight)" />
        <ellipse cx="700" cy="780" rx="540" ry="90" fill="rgba(93,138,255,0.16)" filter="url(#glow)" />

        <!-- City skyline -->
        <g transform="translate(110, 450)" opacity="0.75">
            ${Array.from({ length: 18 }).map((_, i) => {
                const x = i * 65;
                const h = 110 + ((i * 37) % 180);
                const lit = i % 2 === 0 ? 'rgba(103,247,255,0.18)' : 'rgba(255,226,138,0.12)';
                return `
                    <rect x="${x}" y="${180 - h}" width="46" height="${h}" rx="4" fill="rgba(10,16,40,0.9)" stroke="rgba(103,247,255,0.15)" stroke-width="1" />
                    <rect x="${x + 9}" y="${190 - h}" width="28" height="10" fill="${lit}" opacity="0.7" />
                    <rect x="${x + 9}" y="${210 - h}" width="28" height="10" fill="${lit}" opacity="0.45" />
                `;
            }).join('')}
        </g>

        <!-- Main panel -->
        <g>
            <rect x="90" y="85" width="1220" height="610" rx="34" fill="url(#panelGrad)" stroke="rgba(103,247,255,0.24)" stroke-width="2" />
            <rect x="114" y="109" width="1172" height="562" rx="26" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
            <path d="M 120 150 Q 700 90 1280 150" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1.2" />
            <rect x="114" y="109" width="1172" height="170" rx="26" fill="url(#scanGrad)" opacity="0.45" />
        </g>

        <!-- Top labels -->
        <g font-family="Arial, sans-serif">
            <rect x="150" y="136" width="178" height="34" rx="17" fill="rgba(103,247,255,0.12)" stroke="rgba(103,247,255,0.35)" />
            <text x="239" y="158" text-anchor="middle" font-size="16" fill="#bffcff" letter-spacing="2">SYSTEM ONLINE</text>
            <text x="1180" y="158" text-anchor="end" font-size="16" fill="rgba(255,255,255,0.56)" letter-spacing="2">WHATSAPP RPG INTERFACE</text>
        </g>

        <!-- Main title -->
        <g filter="url(#glow)">
            <text x="50%" y="265" dominant-baseline="middle" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="182" fill="#ffffff" style="letter-spacing: 22px;">ARISE</text>
            <text x="50%" y="344" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="62" fill="url(#goldGrad)" style="letter-spacing: 11px;">GHENO CITY AWAKENING</text>
        </g>

        <text x="50%" y="405" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.78)" letter-spacing="1.5">
            Plonge dans un monde manhwa sombre, tactique et vivant.
        </text>

        <!-- Information cards -->
        <g transform="translate(170, 470)">
            <rect width="300" height="126" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(103,247,255,0.22)" />
            <text x="28" y="40" font-family="Arial, sans-serif" font-size="18" fill="#67f7ff" letter-spacing="2">ACTION LIBRE</text>
            <text x="28" y="78" font-family="Arial Black, sans-serif" font-size="34" fill="#ffffff">/action</text>
            <text x="28" y="104" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.70)">Le MJ reagit a tes choix en temps reel.</text>
        </g>
        <g transform="translate(550, 470)">
            <rect width="300" height="126" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,226,138,0.26)" />
            <text x="28" y="40" font-family="Arial, sans-serif" font-size="18" fill="#ffe28a" letter-spacing="2">PROGRESSION</text>
            <text x="28" y="78" font-family="Arial Black, sans-serif" font-size="34" fill="#ffffff">/profile</text>
            <text x="28" y="104" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.70)">Stats, ressources, equipement et rang.</text>
        </g>
        <g transform="translate(930, 470)">
            <rect width="300" height="126" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(92,124,255,0.30)" />
            <text x="28" y="40" font-family="Arial, sans-serif" font-size="18" fill="#8fa8ff" letter-spacing="2">EXPLORATION</text>
            <text x="28" y="78" font-family="Arial Black, sans-serif" font-size="34" fill="#ffffff">/map</text>
            <text x="28" y="104" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.70)">Visualise royaumes, villes et donjons.</text>
        </g>

        <!-- CTA strip -->
        <g transform="translate(240, 632)">
            <rect width="920" height="42" rx="21" fill="rgba(7,14,32,0.9)" stroke="url(#cyanGrad)" stroke-width="1.5" />
            <circle cx="34" cy="21" r="6" fill="#67f7ff" filter="url(#softGlow)" />
            <text x="76" y="27" font-family="monospace" font-size="19" fill="#eafcff" letter-spacing="1.2">TAPE /start POUR COMMENCER, /menu POUR NAVIGUER, /action POUR JOUER EN TEMPS REEL</text>
        </g>

        <!-- Signature / Version -->
        <g transform="translate(92, 764)">
            <text font-family="monospace" font-size="14" fill="rgba(255, 255, 255, 0.42)">VERSION 4.1.0 // AETHERYS VISUAL CORE</text>
        </g>
        <g transform="translate(1308, 764)">
            <text text-anchor="end" font-family="monospace" font-size="14" fill="rgba(255, 255, 255, 0.42)">ENGINE // SHARP SVG RENDERER</text>
        </g>

        <!-- Corners -->
        <path d="M 34 108 L 34 34 L 108 34" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
        <path d="M ${width - 108} 34 L ${width - 34} 34 L ${width - 34} 108" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
        <path d="M 34 ${height - 108} L 34 ${height - 34} L 108 ${height - 34}" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
        <path d="M ${width - 108} ${height - 34} L ${width - 34} ${height - 34} L ${width - 34} ${height - 108}" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
