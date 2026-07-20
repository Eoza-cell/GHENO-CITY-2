const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Generates a visually stunning, dynamic main menu image using Sharp and SVG.
 * Inspired by Dragon Ball Z: Kakarot & Naruto Ultimate Ninja Storm interfaces.
 * Features cinematic glowing auras, explosive diagonal slash lines, particles, and custom player stats card.
 * @param {Object} player - The player object from the database (optional)
 */
async function generateMainMenuImage(player) {
    const width = 1200;
    const height = 700;

    // Default guest fallback if player is not logged in or doesn't exist
    const pName = player?.name ? player.name.toUpperCase() : "HEIR OF LIGHT";
    const pClass = player?.class ? player.class.toUpperCase() : "AWAKENING CLASS";
    const pRank = player?.rank ? player.rank : "F";
    const pLevel = player?.level ? player.level : 1;
    const pLocation = player?.location ? player.location : "EMPIRE OF ELION";
    const pSubLocation = player?.subLocation ? player.subLocation : "ELDORIA";
    const pHealth = player?.health != null ? player.health : 100;
    const pMaxHealth = player?.maxHealth != null ? player.maxHealth : 100;
    const pMana = player?.mana != null ? player.mana : 100;
    const pMaxMana = player?.maxMana != null ? player.maxMana : 100;
    const pCol = player?.col != null ? player.col : 100;

    // Determine rank colors for custom theme accents
    const rankColors = {
        'S': { primary: '#ff3366', secondary: '#990033', glow: 'rgba(255,51,102,0.8)' },
        'A': { primary: '#ffaa00', secondary: '#cc6600', glow: 'rgba(255,170,0,0.8)' },
        'B': { primary: '#bf00ff', secondary: '#5500aa', glow: 'rgba(191,0,255,0.8)' },
        'C': { primary: '#00ffff', secondary: '#0088cc', glow: 'rgba(0,255,255,0.8)' },
        'D': { primary: '#33ff33', secondary: '#006600', glow: 'rgba(51,255,51,0.8)' },
        'E': { primary: '#4fb3ff', secondary: '#0044bb', glow: 'rgba(79,179,255,0.8)' },
        'F': { primary: '#aaaaaa', secondary: '#444444', glow: 'rgba(170,170,170,0.8)' }
    };
    const accent = rankColors[pRank] || rankColors['F'];

    // Generate random coordinates for embers/floating energy particles (reproducible seed structure)
    const particleCount = 65;
    const particles = Array.from({ length: particleCount }).map((_, i) => {
        const x = Math.floor((Math.sin(i * 13) * 0.5 + 0.5) * width);
        const y = Math.floor((Math.cos(i * 17) * 0.5 + 0.5) * height);
        const r = (i % 3 === 0) ? 3 : (i % 2 === 0 ? 1.5 : 2.5);
        const opacity = (i % 4 === 0) ? 0.8 : (i % 3 === 0 ? 0.4 : 0.6);
        const isSparks = i % 5 === 0;
        return { x, y, r, opacity, isSparks };
    });

    // Sub-locations for selection indicators
    const menuCommands = ['/action', '/profil', '/quests', '/map', '/bank', '/lore'];

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <!-- Explosive Auras / Fire Gradients -->
            <linearGradient id="auraGold" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ff4500;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#ff8c00;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ffd700;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="energyBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#00ffff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0000ff;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="cyberRed" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ff0055;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#550011;stop-opacity:1" />
            </linearGradient>

            <!-- Accent specific gradient based on character Rank -->
            <linearGradient id="rankAccentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:${accent.primary};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${accent.secondary};stop-opacity:1" />
            </linearGradient>

            <radialGradient id="backGlow" cx="40%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:#ff5500;stop-opacity:0.25" />
                <stop offset="60%" style="stop-color:#000000;stop-opacity:0" />
            </radialGradient>
            <radialGradient id="centerBurst" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.9" />
                <stop offset="20%" style="stop-color:#00ffff;stop-opacity:0.5" />
                <stop offset="60%" style="stop-color:#ff4500;stop-opacity:0.1" />
                <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
            </radialGradient>

            <!-- Sleek glow filter -->
            <filter id="neonGlow">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
            <filter id="ultraGlow">
                <feGaussianBlur stdDeviation="15" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <!-- Base Background -->
        <rect width="100%" height="100%" fill="#03030b" />
        <rect width="100%" height="100%" fill="url(#backGlow)" />

        <!-- Cinematic Energy Sparks and Gridlines -->
        <g stroke="rgba(255,255,255,0.03)" stroke-width="1">
            <line x1="0" y1="100" x2="${width}" y2="100" />
            <line x1="0" y1="250" x2="${width}" y2="250" />
            <line x1="0" y1="400" x2="${width}" y2="400" />
            <line x1="0" y1="550" x2="${width}" y2="550" />
            <line x1="200" y1="0" x2="200" y2="${height}" />
            <line x1="500" y1="0" x2="500" y2="${height}" />
            <line x1="800" y1="0" x2="800" y2="${height}" />
            <line x1="1100" y1="0" x2="1100" y2="${height}" />
        </g>

        <!-- Giant central explosive energy sphere (reminiscent of DBZ Spirit Bomb / Kakarot burst) -->
        <circle cx="500" cy="350" r="300" fill="url(#centerBurst)" />

        <!-- High-speed action lines / Slanted diagonal slashes -->
        <path d="M-100,50 L${width+100},-50 L${width+120},20 L-80,120 Z" fill="url(#auraGold)" opacity="0.3" filter="url(#neonGlow)" />
        <path d="M-100,680 L${width+100},580 L${width+110},610 L-90,710 Z" fill="url(#energyBlue)" opacity="0.25" filter="url(#neonGlow)" />

        <!-- Background Energy Waves -->
        <path d="M-50,200 L450,100 L500,450 L-100,500 Z" fill="rgba(255,69,0,0.04)" transform="skewX(-10)" />
        <path d="M800,100 L1300,50 L1250,600 L750,550 Z" fill="rgba(0,191,255,0.03)" transform="skewX(10)" />

        <!-- Sparks Layer -->
        <g>
            ${particles.map(p => `
                <circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.isSparks ? '#ffcc00' : '#ffffff'}" opacity="${p.opacity}" ${p.isSparks ? 'filter="url(#neonGlow)"' : ''} />
                ${p.isSparks ? `<line x1="${p.x}" y1="${p.y}" x2="${p.x + 10}" y2="${p.y - 15}" stroke="#ffaa00" stroke-width="0.8" opacity="0.4" />` : ''}
            `).join('')}
        </g>

        <!-- Giant Stylized Game Title Group (Kakarot & Storm style bold typography) -->
        <g transform="translate(110, 110)">
            <!-- Decorative slanted background name banner -->
            <path d="M -50,-65 L 520,-65 L 480,45 L -90,45 Z" fill="url(#auraGold)" rx="10" filter="url(#ultraGlow)" opacity="0.4" />
            <path d="M -40,-60 L 510,-60 L 475,40 L -75,40 Z" fill="#0c0d1b" />
            <path d="M -40,-60 L 30,-60 L -10,40 L -80,40 Z" fill="url(#energyBlue)" opacity="0.8" />

            <!-- Main branding -->
            <text x="5" y="10" font-family="Impact, Arial Black, sans-serif" font-size="75" fill="#ffffff" letter-spacing="3" style="filter: drop-shadow(0px 0px 15px rgba(255,69,0,0.9));">ARISE II</text>
            <text x="355" y="10" font-family="'Courier New', monospace" font-size="28" fill="#00ffff" font-weight="900" style="letter-spacing:6px; filter:url(#neonGlow)">STORM</text>
            <text x="355" y="-30" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.6)" font-weight="900" style="letter-spacing:10px;">CORE V2.0</text>

            <!-- Metallic/gold sub-heading border -->
            <line x1="-30" y1="28" x2="445" y2="28" stroke="url(#auraGold)" stroke-width="4" filter="url(#neonGlow)" />
            <circle cx="445" cy="28" r="4" fill="#ffffff" />
        </g>

        <!-- MAIN NAVIGATION MENU (Naruto Ultimate Ninja Storm Skewed Buttons) -->
        <g transform="translate(100, 270)">
            ${menuCommands.map((cmd, i) => {
                const isActive = (i === 0);
                const itemAccent = isActive ? 'url(#auraGold)' : 'rgba(255,255,255,0.04)';
                const textColor = isActive ? '#ffffff' : '#b0b5c3';
                const buttonWidth = 360 - i * 15;
                const bevel = 40;

                return `
                <g transform="translate(${i * 25}, ${i * 62})" style="cursor: pointer;">
                    <!-- Perspective-based selection bar -->
                    <path d="M 0,-30 L ${buttonWidth},-30 L ${buttonWidth - bevel},25 L ${-bevel},25 Z" fill="${itemAccent}" stroke="${isActive ? '#ffffff' : 'rgba(255,255,255,0.1)'}" stroke-width="${isActive ? '2.5' : '1'}" style="${isActive ? 'filter: drop-shadow(0 0 10px rgba(255,140,0,0.6))' : ''}" />

                    <!-- Decorative edge glows -->
                    <path d="M ${-bevel},-30 L ${-bevel + 15},-30 L ${-bevel + 15 - 5},25 L ${-bevel - 5},25 Z" fill="${isActive ? '#00ffff' : 'rgba(255,255,255,0.2)'}" />

                    <!-- Selection Indicator Orb -->
                    <circle cx="${-bevel - 30}" cy="-2" r="18" fill="${isActive ? '#ffffff' : 'rgba(0,0,0,0.4)'}" stroke="${isActive ? 'url(#auraGold)' : 'rgba(255,255,255,0.2)'}" stroke-width="3.5" />
                    ${isActive ? `<circle cx="${-bevel - 30}" cy="-2" r="8" fill="#ff4500" filter="url(#neonGlow)"><animate attributeName="r" values="6;9;6" dur="1.5s" repeatCount="indefinite" /></circle>` : ''}

                    <!-- Menu Command text -->
                    <text x="35" y="7" font-family="'Arial Black', sans-serif" font-size="28" font-weight="900" fill="${textColor}" style="letter-spacing: 2px; ${isActive ? 'text-shadow: 0 0 10px #ff8c00, 2px 2px 5px black;' : 'text-shadow: 1px 1px 2px black;'}">${cmd.toUpperCase()}</text>

                    <!-- Extra decoration arrows for active selection -->
                    ${isActive ? `<path d="M ${buttonWidth - 70},-10 L ${buttonWidth - 55},-2 L ${buttonWidth - 70},6 Z" fill="#ffffff" />` : ''}
                </g>
                `;
            }).join('')}
        </g>

        <!-- RIGHT SIDE: PREMIUM PLAYER DASHBOARD (Dragon Ball Z: Kakarot style character card) -->
        <g transform="translate(710, 100)">
            <!-- Glassmorphic Background Card -->
            <rect x="0" y="0" width="390" height="510" fill="rgba(8, 10, 25, 0.85)" stroke="url(#auraGold)" stroke-width="3" rx="25" filter="url(#neonGlow)" />
            <!-- Inner futuristic border -->
            <rect x="10" y="10" width="370" height="490" fill="none" stroke="rgba(0,255,255,0.15)" stroke-width="1.5" rx="18" />

            <!-- Sub-header accent panel -->
            <path d="M 12,12 L 378,12 L 378,50 L 12,50 Z" fill="url(#rankAccentGrad)" opacity="0.3" />
            <text x="195" y="38" font-family="Arial, sans-serif" font-size="16" fill="#ffffff" text-anchor="middle" font-weight="bold" style="letter-spacing:4px;">MATRICE D'AETHERYS</text>

            <!-- Character Profile Header -->
            <g transform="translate(30, 95)">
                <!-- Giant Glowing Rank Stamp -->
                <circle cx="280" cy="5" r="45" fill="rgba(0,0,0,0.6)" stroke="${accent.primary}" stroke-width="4" filter="url(#neonGlow)" />
                <text x="280" y="22" font-family="Impact, Arial Black, sans-serif" font-size="58" fill="${accent.primary}" text-anchor="middle" font-style="italic" style="filter: drop-shadow(0 0 5px ${accent.glow});">${pRank}</text>
                <text x="280" y="-45" font-family="Arial, sans-serif" font-size="11" fill="rgba(255,255,255,0.6)" font-weight="bold" text-anchor="middle" style="letter-spacing: 2px;">RANG</text>

                <!-- Name & Title -->
                <text x="0" y="-10" font-family="'Arial Black', sans-serif" font-size="30" font-weight="900" fill="#ffffff" style="letter-spacing: -0.5px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${pName}</text>
                <text x="0" y="15" font-family="Arial, sans-serif" font-size="14" fill="#00ffff" font-weight="bold" style="letter-spacing: 3px;">NIVEAU ${pLevel} // ${pClass}</text>
            </g>

            <!-- Stats & Progress Gauges (High Tech UI) -->
            <g transform="translate(30, 185)">
                <!-- HP Gauge -->
                <g transform="translate(0, 0)">
                    <text x="0" y="0" font-family="Arial, sans-serif" font-size="13" fill="#ff4d4d" font-weight="bold" style="letter-spacing: 1px;">POINT DE VIE (PV)</text>
                    <text x="330" y="0" font-family="monospace" font-size="14" fill="#ffffff" font-weight="bold" text-anchor="end">${pHealth}/${pMaxHealth}</text>
                    <!-- Background bar -->
                    <rect x="0" y="10" width="330" height="10" fill="rgba(255,255,255,0.1)" rx="5" />
                    <!-- Active bar -->
                    <rect x="0" y="10" width="${Math.max(10, Math.min(100, (pHealth / pMaxHealth) * 100)) * 3.3}" height="10" fill="url(#cyberRed)" rx="5" filter="url(#neonGlow)" />
                </g>

                <!-- MP Gauge -->
                <g transform="translate(0, 45)">
                    <text x="0" y="0" font-family="Arial, sans-serif" font-size="13" fill="#00ffff" font-weight="bold" style="letter-spacing: 1px;">POINT DE MANA (PM)</text>
                    <text x="330" y="0" font-family="monospace" font-size="14" fill="#ffffff" font-weight="bold" text-anchor="end">${pMana}/${pMaxMana}</text>
                    <!-- Background bar -->
                    <rect x="0" y="10" width="330" height="10" fill="rgba(255,255,255,0.1)" rx="5" />
                    <!-- Active bar -->
                    <rect x="0" y="10" width="${Math.max(10, Math.min(100, (pMana / pMaxMana) * 100)) * 3.3}" height="10" fill="url(#energyBlue)" rx="5" filter="url(#neonGlow)" />
                </g>

                <!-- Location details -->
                <g transform="translate(0, 100)">
                    <rect x="-10" y="0" width="350" height="75" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)" rx="10" />
                    <text x="10" y="25" font-family="Arial, sans-serif" font-size="11" fill="rgba(255,255,255,0.4)" font-weight="bold" style="letter-spacing: 2px;">LIEU ACTUEL</text>
                    <text x="10" y="48" font-family="'Arial Black', sans-serif" font-size="18" fill="#ffffff" font-weight="900" style="letter-spacing: 1px;">${pLocation}</text>
                    <text x="10" y="65" font-family="Arial, sans-serif" font-size="13" fill="#ffaa00" font-weight="bold" style="letter-spacing: 1px;">📍 ${pSubLocation}</text>
                </g>

                <!-- Wallet details -->
                <g transform="translate(0, 195)">
                    <rect x="-10" y="0" width="165" height="65" fill="rgba(255,215,0,0.03)" stroke="rgba(255,215,0,0.1)" rx="10" />
                    <text x="10" y="22" font-family="Arial, sans-serif" font-size="11" fill="rgba(255,215,0,0.6)" font-weight="bold" style="letter-spacing: 2px;">ESPÈCES COL</text>
                    <text x="10" y="48" font-family="Impact, Arial Black, sans-serif" font-size="24" fill="#ffd700" style="letter-spacing: 1px;">🪙 ${pCol.toLocaleString()}</text>

                    <rect x="175" y="0" width="165" height="65" fill="rgba(0,255,255,0.03)" stroke="rgba(0,255,255,0.1)" rx="10" />
                    <text x="195" y="22" font-family="Arial, sans-serif" font-size="11" fill="rgba(0,255,255,0.6)" font-weight="bold" style="letter-spacing: 2px;">ÉTAT SERVEUR</text>
                    <text x="195" y="48" font-family="'Arial Black', sans-serif" font-size="18" fill="#00ff66" font-weight="900" style="letter-spacing: 1px;">OPÉRATIONNEL</text>
                </g>
            </g>

            <!-- Bottom dynamic system key and warning -->
            <g transform="translate(30, 475)">
                <line x1="-10" y1="-15" x2="340" y2="-15" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                <text x="0" y="5" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.4)">GHENO_CORE v4.5 // SYSTEM_STATUS: READY</text>
                <text x="330" y="5" font-family="monospace" font-size="11" fill="#ffaa00" font-weight="bold" text-anchor="end">READY FOR BATTLE</text>
            </g>
        </g>

        <!-- Footer containing copyrights and licensing with sleek spacing -->
        <g transform="translate(60, ${height - 40})">
            <text font-family="'Arial Black', sans-serif" font-size="13" fill="rgba(255,255,255,0.35)" style="letter-spacing: 4px;">© 2024 ARISE II // ULTIMATE CORE SYSTEM // SHONEN METAVERSE</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
