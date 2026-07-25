const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Generates a visually stunning, dynamic main menu image using Sharp and SVG.
 * Inspired by Solo Leveling: Arise interface.
 * Features dark shadow Monarch gradients, glowing electric-blue gateways, lightning, and Hunter stats.
 * @param {Object} player - The player object from the database (optional)
 */
async function generateMainMenuImage(player) {
    const width = 1200;
    const height = 700;

    // Default guest fallback if player is not logged in or doesn't exist
    const pName = player?.name ? player.name.toUpperCase() : "HUNTER SUNG";
    const pClass = player?.class ? player.class.toUpperCase() : "SHADOW MONARCH";
    const pRank = player?.rank ? player.rank : "F";
    const pLevel = player?.level ? player.level : 1;
    const pLocation = player?.location ? player.location : "DUNGEON GATE";
    const pSubLocation = player?.subLocation ? player.subLocation : "RE-AWAKENING ROOM";
    const pHealth = player?.health != null ? player.health : 100;
    const pMaxHealth = player?.maxHealth != null ? player.maxHealth : 100;
    const pMana = player?.mana != null ? player.mana : 100;
    const pMaxMana = player?.maxMana != null ? player.maxMana : 100;
    const pCol = player?.col != null ? player.col : 100;

    // Determine rank colors for custom theme accents
    const rankColors = {
        'S': { primary: '#ffd700', secondary: '#aa8800', glow: 'rgba(255,215,0,0.8)' },
        'A': { primary: '#ff3366', secondary: '#990033', glow: 'rgba(255,51,102,0.8)' },
        'B': { primary: '#bf00ff', secondary: '#5500aa', glow: 'rgba(191,0,255,0.8)' },
        'C': { primary: '#00ffff', secondary: '#0088cc', glow: 'rgba(0,255,255,0.8)' },
        'D': { primary: '#33ff33', secondary: '#006600', glow: 'rgba(51,255,51,0.8)' },
        'E': { primary: '#4fb3ff', secondary: '#0044bb', glow: 'rgba(79,179,255,0.8)' },
        'F': { primary: '#aaaaaa', secondary: '#444444', glow: 'rgba(170,170,170,0.8)' }
    };
    const accent = rankColors[pRank] || rankColors['F'];

    // Generate random coordinates for shadow particles/electricity sparks
    const particleCount = 70;
    const particles = Array.from({ length: particleCount }).map((_, i) => {
        const x = Math.floor((Math.sin(i * 13) * 0.5 + 0.5) * width);
        const y = Math.floor((Math.cos(i * 17) * 0.5 + 0.5) * height);
        const r = (i % 3 === 0) ? 3 : (i % 2 === 0 ? 1.5 : 2);
        const opacity = (i % 4 === 0) ? 0.9 : (i % 3 === 0 ? 0.4 : 0.6);
        const isLightning = i % 6 === 0;
        return { x, y, r, opacity, isLightning };
    });

    const menuCommands = ['/action', '/profil', '/quests', '/map', '/bank', '/lore'];

    // Background flag fallback
    const flagPath = path.join(__dirname, 'assets', 'empire_elion_flag.png');
    const hasFlag = fs.existsSync(flagPath);
    const bgOpacity = hasFlag ? "0.2" : "1.0";
    const glowOpacity = hasFlag ? "0.7" : "1.0";

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <!-- Electric Blue & Shadow Purple Gate Gradients -->
            <linearGradient id="shadowPurple" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0b021d;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#340d5c;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#010a15;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="gateBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#00ffff;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#0077ff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#110033;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="neonGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00ffff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#aa00ff;stop-opacity:1" />
            </linearGradient>

            <!-- Accent specific gradient based on character Rank -->
            <linearGradient id="rankAccentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:${accent.primary};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${accent.secondary};stop-opacity:1" />
            </linearGradient>

            <radialGradient id="portalGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:#aa00ff;stop-opacity:0.3" />
                <stop offset="40%" style="stop-color:#00ffff;stop-opacity:0.15" />
                <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
            </radialGradient>

            <filter id="neonGlow">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
            <filter id="ultraGlow">
                <feGaussianBlur stdDeviation="12" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <!-- Base Background -->
        <rect width="100%" height="100%" fill="#020108" opacity="${bgOpacity}" />
        <rect width="100%" height="100%" fill="url(#portalGlow)" opacity="${glowOpacity}" />

        <!-- Cinematic Gate Grid & Vertical Shadow Rays -->
        <g stroke="rgba(0, 255, 255, 0.04)" stroke-width="1.2">
            <line x1="0" y1="80" x2="${width}" y2="80" />
            <line x1="0" y1="220" x2="${width}" y2="220" />
            <line x1="0" y1="360" x2="${width}" y2="360" />
            <line x1="0" y1="500" x2="${width}" y2="500" />
            <line x1="150" y1="0" x2="150" y2="${height}" />
            <line x1="450" y1="0" x2="450" y2="${height}" />
            <line x1="750" y1="0" x2="750" y2="${height}" />
            <line x1="1050" y1="0" x2="1050" y2="${height}" />
        </g>

        <!-- Shadow Portal Gate (Solo Leveling Central Gate) -->
        <ellipse cx="600" cy="350" rx="380" ry="240" fill="none" stroke="url(#neonGlowGrad)" stroke-width="2" filter="url(#ultraGlow)" opacity="0.45" />
        <ellipse cx="600" cy="350" rx="400" ry="260" fill="none" stroke="#00ffff" stroke-width="0.8" opacity="0.2" />

        <!-- Diagonal Slash Lines representing the Hunter's dagger/shadow strike -->
        <path d="M-50,600 L1250,150 L1250,180 L-50,630 Z" fill="url(#gateBlue)" opacity="0.25" filter="url(#neonGlow)" />
        <path d="M-50,200 L1250,-150 L1250,-120 L-50,230 Z" fill="url(#neonGlowGrad)" opacity="0.15" filter="url(#neonGlow)" />

        <!-- Lightning Sparks & Particles -->
        <g>
            ${particles.map(p => `
                <circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.isLightning ? '#00ffff' : '#aa00ff'}" opacity="${p.opacity}" ${p.isLightning ? 'filter="url(#neonGlow)"' : ''} />
                ${p.isLightning ? `
                    <path d="M ${p.x},${p.y} L ${p.x - 12},${p.y + 18} L ${p.x + 8},${p.y + 25} L ${p.x - 4},${p.y + 40}" stroke="#00ffff" stroke-width="1.2" fill="none" opacity="0.5" filter="url(#neonGlow)" />
                ` : ''}
            `).join('')}
        </g>

        <!-- Dynamic Game Title Group: SOLO LEVELING Style Bold Typography -->
        <g transform="translate(110, 100)">
            <!-- Decorative shadow glow gate background -->
            <path d="M -50,-50 L 520,-50 L 470,45 L -100,45 Z" fill="url(#neonGlowGrad)" filter="url(#ultraGlow)" opacity="0.3" />
            <path d="M -40,-45 L 510,-45 L 465,40 L -90,40 Z" fill="#05030f" />
            <path d="M -40,-45 L 40,-45 L 0,40 L -80,40 Z" fill="#aa00ff" opacity="0.7" />

            <text x="15" y="15" font-family="'Impact', 'Arial Black', sans-serif" font-size="68" fill="#ffffff" letter-spacing="4" style="filter: drop-shadow(0px 0px 15px #00ffff);">ARISE II</text>
            <text x="355" y="12" font-family="'Courier New', monospace" font-size="28" fill="#aa00ff" font-weight="900" style="letter-spacing:6px; filter:url(#neonGlow)">HUNTER</text>
            <text x="355" y="-24" font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.5)" font-weight="bold" style="letter-spacing:8px;">SHADOW GATE</text>

            <line x1="-30" y1="28" x2="445" y2="28" stroke="url(#neonGlowGrad)" stroke-width="3" filter="url(#neonGlow)" />
        </g>

        <!-- NAVIGATION MENU (Sleek Angled Glassmorphic Bars) -->
        <g transform="translate(100, 250)">
            ${menuCommands.map((cmd, i) => {
                const isActive = (i === 0);
                const itemAccent = isActive ? 'url(#neonGlowGrad)' : 'rgba(255,255,255,0.03)';
                const textColor = isActive ? '#ffffff' : '#a2a7b8';
                const buttonWidth = 350 - i * 15;
                const bevel = 35;

                return `
                <g transform="translate(${i * 20}, ${i * 64})" style="cursor: pointer;">
                    <!-- Sleek angled plate -->
                    <path d="M 0,-30 L ${buttonWidth},-30 L ${buttonWidth - bevel},25 L ${-bevel},25 Z" fill="${itemAccent}" stroke="${isActive ? '#00ffff' : 'rgba(255,255,255,0.1)'}" stroke-width="${isActive ? '2' : '0.8'}" style="${isActive ? 'filter: drop-shadow(0 0 10px rgba(0,255,255,0.5))' : ''}" />

                    <!-- Cyber highlight on the side -->
                    <path d="M ${-bevel},-30 L ${-bevel + 12},-30 L ${-bevel + 12 - 5},25 L ${-bevel - 5},25 Z" fill="${isActive ? '#aa00ff' : 'rgba(255,255,255,0.15)'}" />

                    <!-- Selection Indicator Dot -->
                    <circle cx="${-bevel - 25}" cy="-2" r="14" fill="${isActive ? '#ffffff' : 'rgba(0,0,0,0.5)'}" stroke="${isActive ? '#00ffff' : 'rgba(255,255,255,0.2)'}" stroke-width="2.5" />
                    ${isActive ? `<circle cx="${-bevel - 25}" cy="-2" r="6" fill="#00ffff" filter="url(#neonGlow)"><animate attributeName="r" values="4;7;4" dur="1.2s" repeatCount="indefinite" /></circle>` : ''}

                    <!-- Menu Command text -->
                    <text x="35" y="7" font-family="'Arial Black', sans-serif" font-size="26" font-weight="900" fill="${textColor}" style="letter-spacing: 2px; ${isActive ? 'text-shadow: 0 0 10px #00ffff, 2px 2px 4px black;' : 'text-shadow: 1px 1px 2px black;'}">${cmd.toUpperCase()}</text>

                    ${isActive ? `<path d="M ${buttonWidth - 65},-10 L ${buttonWidth - 50},-2 L ${buttonWidth - 65},6 Z" fill="#ffffff" />` : ''}
                </g>
                `;
            }).join('')}
        </g>

        <!-- RIGHT SIDE: PREMIUM HUNTER DASHBOARD (Solo Leveling Arise style card) -->
        <g transform="translate(720, 100)">
            <!-- Glassmorphic Card Panel -->
            <rect x="0" y="0" width="380" height="500" fill="rgba(5, 3, 15, 0.9)" stroke="url(#neonGlowGrad)" stroke-width="2.5" rx="20" filter="url(#neonGlow)" />
            <rect x="8" y="8" width="364" height="484" fill="none" stroke="rgba(0,255,255,0.1)" stroke-width="1.2" rx="14" />

            <!-- Sub-header accent panel -->
            <path d="M 10,10 L 370,10 L 370,45 L 10,45 Z" fill="url(#rankAccentGrad)" opacity="0.25" />
            <text x="190" y="32" font-family="Arial, sans-serif" font-size="14" fill="#00ffff" text-anchor="middle" font-weight="bold" style="letter-spacing:5px;">HUNTER STATUS PANEL</text>

            <!-- Character Profile Info -->
            <g transform="translate(30, 90)">
                <!-- Giant Glowing Rank Badge -->
                <circle cx="270" cy="15" r="42" fill="rgba(2, 1, 8, 0.85)" stroke="${accent.primary}" stroke-width="3" filter="url(#neonGlow)" />
                <text x="270" y="32" font-family="Impact, Arial Black, sans-serif" font-size="52" fill="${accent.primary}" text-anchor="middle" font-style="italic" style="filter: drop-shadow(0 0 5px ${accent.glow});">${pRank}</text>
                <text x="270" y="-35" font-family="Arial, sans-serif" font-size="10" fill="rgba(255,255,255,0.5)" font-weight="bold" text-anchor="middle" style="letter-spacing: 2px;">HUNTER RANK</text>

                <!-- Name & Title -->
                <text x="0" y="-5" font-family="'Arial Black', sans-serif" font-size="28" font-weight="900" fill="#ffffff" style="letter-spacing: -0.5px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${pName}</text>
                <text x="0" y="18" font-family="Arial, sans-serif" font-size="13" fill="#aa00ff" font-weight="bold" style="letter-spacing: 3px;">LVL ${pLevel} // ${pClass}</text>
            </g>

            <!-- Stats & Progress Gauges (Neon Solo Leveling Interface) -->
            <g transform="translate(30, 180)">
                <!-- HP Gauge -->
                <g transform="translate(0, 0)">
                    <text x="0" y="0" font-family="Arial, sans-serif" font-size="12" fill="#ff2a6d" font-weight="bold" style="letter-spacing: 1.5px;">HUNTER HEALTH (HP)</text>
                    <text x="320" y="0" font-family="monospace" font-size="13" fill="#ffffff" font-weight="bold" text-anchor="end">${pHealth}/${pMaxHealth}</text>
                    <!-- Background bar -->
                    <rect x="0" y="8" width="320" height="8" fill="rgba(255,255,255,0.08)" rx="4" />
                    <!-- Active bar -->
                    <rect x="0" y="8" width="${Math.max(10, Math.min(100, (pHealth / pMaxHealth) * 100)) * 3.2}" height="8" fill="#ff2a6d" rx="4" filter="url(#neonGlow)" />
                </g>

                <!-- MP Gauge -->
                <g transform="translate(0, 42)">
                    <text x="0" y="0" font-family="Arial, sans-serif" font-size="12" fill="#00f3ff" font-weight="bold" style="letter-spacing: 1.5px;">MANA ESSENCE (MP)</text>
                    <text x="320" y="0" font-family="monospace" font-size="13" fill="#ffffff" font-weight="bold" text-anchor="end">${pMana}/${pMaxMana}</text>
                    <!-- Background bar -->
                    <rect x="0" y="8" width="320" height="8" fill="rgba(255,255,255,0.08)" rx="4" />
                    <!-- Active bar -->
                    <rect x="0" y="8" width="${Math.max(10, Math.min(100, (pMana / pMaxMana) * 100)) * 3.2}" height="8" fill="#00f3ff" rx="4" filter="url(#neonGlow)" />
                </g>

                <!-- Location Panel -->
                <g transform="translate(0, 95)">
                    <rect x="-10" y="0" width="340" height="70" fill="rgba(170,0,255,0.04)" stroke="rgba(170,0,255,0.15)" rx="8" />
                    <text x="10" y="22" font-family="Arial, sans-serif" font-size="10" fill="rgba(255,255,255,0.4)" font-weight="bold" style="letter-spacing: 2px;">ACTIVE GATE LOCATION</text>
                    <text x="10" y="44" font-family="'Arial Black', sans-serif" font-size="16" fill="#ffffff" font-weight="900" style="letter-spacing: 0.5px;">${pLocation}</text>
                    <text x="10" y="60" font-family="Arial, sans-serif" font-size="12" fill="#00ffff" font-weight="bold" style="letter-spacing: 1px;">⚡ ${pSubLocation}</text>
                </g>

                <!-- Wallet Panel -->
                <g transform="translate(0, 185)">
                    <rect x="-10" y="0" width="160" height="60" fill="rgba(255,215,0,0.03)" stroke="rgba(255,215,0,0.15)" rx="8" />
                    <text x="10" y="20" font-family="Arial, sans-serif" font-size="10" fill="rgba(255,215,0,0.6)" font-weight="bold" style="letter-spacing: 2px;">GOLD COL</text>
                    <text x="10" y="45" font-family="'Arial Black', sans-serif" font-size="20" fill="#ffd700" style="letter-spacing: 1px;">🪙 ${pCol.toLocaleString()}</text>

                    <rect x="165" y="0" width="165" height="60" fill="rgba(0,255,255,0.03)" stroke="rgba(0,255,255,0.15)" rx="8" />
                    <text x="180" y="20" font-family="Arial, sans-serif" font-size="10" fill="rgba(0,255,255,0.6)" font-weight="bold" style="letter-spacing: 2px;">SYSTEM_SYNC</text>
                    <text x="180" y="45" font-family="'Arial Black', sans-serif" font-size="16" fill="#00ffaa" font-weight="900" style="letter-spacing: 1px;">OPERATIONAL</text>
                </g>
            </g>

            <!-- Bottom dynamic status key -->
            <g transform="translate(30, 465)">
                <line x1="-10" y1="-10" x2="330" y2="-10" stroke="rgba(255,255,255,0.08)" stroke-width="0.8" />
                <text x="0" y="8" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.3)">MONARCH_SYSTEM v7.11 // SHADOW_REALM: OPEN</text>
                <text x="320" y="8" font-family="monospace" font-size="10" fill="#00ffff" font-weight="bold" text-anchor="end">READY TO ARISE</text>
            </g>
        </g>

        <!-- Footer copyright -->
        <g transform="translate(60, ${height - 40})">
            <text font-family="'Arial Black', sans-serif" font-size="12" fill="rgba(255,255,255,0.25)" style="letter-spacing: 4px;">© 2026 SOLO LEVELING ARISE // MONARCH ENGINE II</text>
        </g>
    </svg>
    `;

    let menuSharpInstance;
    if (hasFlag) {
        try {
            const dimmedFlag = await sharp(flagPath)
                .resize(width, height, { fit: 'cover' })
                .blur(4)
                .linear(0.18, 0) // Highly dimmed and deep contrast for Solo Leveling purple shadows
                .toBuffer();

            menuSharpInstance = sharp(dimmedFlag)
                .composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
        } catch (e) {
            console.error("[Menu Generator] Error processing backdrop flag:", e);
            menuSharpInstance = sharp(Buffer.from(svg));
        }
    } else {
        menuSharpInstance = sharp(Buffer.from(svg));
    }

    return menuSharpInstance.png().toBuffer();
}

module.exports = { generateMainMenuImage };
