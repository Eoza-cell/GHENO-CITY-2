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
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#04040c;stop-opacity:1" />
                <stop offset="45%" style="stop-color:#11132c;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#060712;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="skyGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#42f5ff;stop-opacity:0.8" />
                <stop offset="50%" style="stop-color:#8a7dff;stop-opacity:0.75" />
                <stop offset="100%" style="stop-color:#f7b4ff;stop-opacity:0.65" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffe6a3;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#ffc94d;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ff8a3d;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0a1226;stop-opacity:0.85" />
                <stop offset="100%" style="stop-color:#0e0a20;stop-opacity:0.92" />
            </linearGradient>
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="18" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="16" fill="none" stroke="rgba(120,215,255,0.45)" stroke-width="2" />
        <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="22" fill="none" stroke="rgba(255,214,120,0.16)" stroke-width="1.5" />

        <g opacity="0.16" stroke="rgba(120,230,255,0.32)" stroke-width="1">
            ${Array.from({ length: 28 }).map((_, i) => `<line x1="${i * 46}" y1="0" x2="${i * 46 + 90}" y2="${height}" />`).join('')}
            ${Array.from({ length: 12 }).map((_, i) => `<line x1="0" y1="${320 + i * 28}" x2="${width}" y2="${320 + i * 28}" />`).join('')}
        </g>

        <circle cx="965" cy="130" r="108" fill="rgba(232,245,255,0.95)" opacity="0.18" filter="url(#softGlow)" />
        <circle cx="965" cy="130" r="70" fill="none" stroke="url(#skyGlow)" stroke-width="2" opacity="0.55" />
        <circle cx="965" cy="130" r="145" fill="url(#skyGlow)" opacity="0.08" filter="url(#softGlow)" />

        <g transform="translate(600 245)" opacity="0.42" filter="url(#softGlow)">
            <circle r="126" fill="none" stroke="url(#skyGlow)" stroke-width="2" />
            <circle r="96" fill="none" stroke="rgba(255,216,120,0.42)" stroke-width="1.4" stroke-dasharray="6 10" />
            <circle r="54" fill="none" stroke="rgba(120,245,255,0.42)" stroke-width="1.4" />
            <path d="M 0 -126 L 0 126 M -126 0 L 126 0 M -89 -89 L 89 89 M 89 -89 L -89 89" stroke="rgba(120,245,255,0.18)" stroke-width="1.1" />
        </g>

        <path d="M0 485
                 L60 450 L110 462 L150 410 L205 430 L255 360 L308 382 L350 300 L410 355 L460 260
                 L520 312 L565 258 L620 326 L690 246 L738 298 L792 238 L850 320 L920 255 L990 340
                 L1050 274 L1120 350 L1200 300 L1200 700 L0 700 Z"
              fill="rgba(8,12,24,0.92)" />
        <path d="M0 540
                 L55 505 L96 516 L142 468 L196 490 L242 435 L290 452 L340 395 L390 430 L448 372
                 L520 420 L582 358 L648 438 L710 375 L780 426 L850 360 L920 440 L990 390 L1060 455
                 L1125 408 L1200 468 L1200 700 L0 700 Z"
              fill="rgba(15,20,40,0.95)" />

        <g opacity="0.7">
            ${Array.from({ length: 38 }).map((_, i) => {
                const x = 28 + i * 30;
                const h = 10 + (i % 4) * 4;
                return `<rect x="${x}" y="${560 - h}" width="7" height="${h}" fill="rgba(93,245,255,0.70)" />`;
            }).join('')}
            ${Array.from({ length: 28 }).map((_, i) => {
                const x = 640 + i * 18;
                const h = 8 + (i % 5) * 3;
                return `<rect x="${x}" y="${530 - h}" width="5" height="${h}" fill="rgba(255,199,89,0.65)" />`;
            }).join('')}
        </g>

        <g transform="translate(122 84)">
            <text font-family="DejaVu Sans Mono" font-size="17" fill="#8ef6ff" letter-spacing="4">AETHERYS // MAIN GATE</text>
            <rect x="0" y="18" width="198" height="2" fill="url(#skyGlow)" opacity="0.75" />
        </g>

        <g filter="url(#glow)">
            <text x="50%" y="29%" dominant-baseline="middle" text-anchor="middle" font-family="IPAGothic" font-weight="900" font-size="176" fill="#f8fbff" style="letter-spacing: 28px;">ARISE</text>
            <text x="50%" y="41%" dominant-baseline="middle" text-anchor="middle" font-family="IPAGothic" font-weight="bold" font-size="56" fill="url(#goldGrad)" style="letter-spacing: 12px;">GHENO CITY</text>
            <text x="50%" y="48.5%" dominant-baseline="middle" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="20" fill="#8ef6ff" opacity="0.9" style="letter-spacing: 7px;">CHRONIQUES DE L'INTERSTICE</text>
        </g>

        <g transform="translate(145 420)">
            <rect width="910" height="174" rx="18" fill="url(#panelGrad)" stroke="rgba(106,234,255,0.34)" stroke-width="2" />
            <rect x="18" y="18" width="874" height="138" rx="12" fill="none" stroke="rgba(255,213,125,0.18)" stroke-width="1" />
            <text x="42" y="52" font-family="DejaVu Sans Mono" font-size="23" fill="#f9fbff" letter-spacing="4">[ MENU PRINCIPAL ]</text>
            <text x="42" y="86" font-family="DejaVu Sans Mono" font-size="16" fill="#95f2ff">RP libre, archives, pactes, quetes, economie et conflits vivants.</text>
            <text x="42" y="120" font-family="DejaVu Sans Mono" font-size="16" fill="#ffd58a">Entrez dans la scene, faites avancer votre propre histoire, croisez celle des autres.</text>
            <text x="42" y="150" font-family="DejaVu Sans Mono" font-size="15" fill="rgba(255,255,255,0.78)">/action  /lore  /quests  /map  /clubs  /pacts  /bank</text>
        </g>

        <g transform="translate(600 630)">
            <rect x="-265" y="-18" width="530" height="36" rx="18" fill="rgba(9,16,33,0.80)" stroke="rgba(120,245,255,0.18)" stroke-width="1" />
            <text text-anchor="middle" font-family="DejaVu Sans Mono" font-size="15" fill="#9af4ff" letter-spacing="3">VOTRE DESTIN COMMENCE ENTRE LA VILLE ET L'INTERSTICE</text>
        </g>

        <g transform="translate(34, 670)">
            <text font-family="DejaVu Sans Mono" font-size="13" fill="rgba(255,255,255,0.45)">VERSION 4.1 // SHARP SVG</text>
        </g>
        <g transform="translate(1168, 670)">
            <text text-anchor="end" font-family="DejaVu Sans Mono" font-size="13" fill="rgba(255,255,255,0.45)">SYSTEM STATUS: ONLINE</text>
        </g>

        <path d="M 30 100 L 30 30 L 100 30" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
        <path d="M ${width-100} 30 L ${width-30} 30 L ${width-30} 100" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
        <path d="M 30 ${height-100} L 30 ${height-30} L 100 ${height-30}" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
        <path d="M ${width-100} ${height-30} L ${width-30} ${height-30} L ${width-30} ${height-100}" fill="none" stroke="url(#goldGrad)" stroke-width="4" />
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
