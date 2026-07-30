const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Generates an ultra-premium, modern anime-RPG main menu image using Sharp and SVG.
 * Features a classy, sleek layout with dark glassmorphic obsidian panels, gold & cyan accents,
 * glowing ethereal stardust, and elegant typography.
 * Completely removes combat statistics as requested.
 * @param {Object} player - The player object from the database (optional)
 */
async function generateMainMenuImage(player) {
    const width = 1200;
    const height = 700;

    // Fallbacks and high-level details
    const pName = player?.name ? player.name.toUpperCase() : "HÉRITIER SANS NOM";
    const pClass = player?.class ? player.class.toUpperCase() : "CLASSE INITIALE";
    const pRace = player?.race ? player.race.toUpperCase() : "HUMAIN";
    const pRank = player?.rank ? player.rank : "F";
    const pLevel = player?.level ? player.level : 1;
    const pLocation = player?.location ? player.location : "MONDE D'AETHERYS";
    const pSubLocation = player?.subLocation ? player.subLocation : "ZONE INITIALE";
    const pHealth = player?.health != null ? player.health : 100;
    const pMaxHealth = player?.maxHealth != null ? player.maxHealth : 100;
    const pMana = player?.mana != null ? player.mana : 100;
    const pMaxMana = player?.maxMana != null ? player.maxMana : 100;
    const pCol = player?.col != null ? player.col : 100;

    // Premium Rank Theme Accents
    const rankThemes = {
        'S': { primary: '#ffd700', secondary: '#ff8c00', glow: '#ffd700' },
        'A': { primary: '#ff3c00', secondary: '#ffaa00', glow: '#ff3c00' },
        'B': { primary: '#d500f9', secondary: '#7b1fa2', glow: '#d500f9' },
        'C': { primary: '#00e5ff', secondary: '#00b0ff', glow: '#00e5ff' },
        'D': { primary: '#00e676', secondary: '#00c853', glow: '#00e676' },
        'E': { primary: '#2979ff', secondary: '#2962ff', glow: '#2979ff' },
        'F': { primary: '#b0bec5', secondary: '#37474f', glow: '#b0bec5' }
    };
    const theme = rankThemes[pRank] || rankThemes['F'];

    // Generate floating ethereal light particles / stardust coords
    const particleCount = 65;
    const particles = Array.from({ length: particleCount }).map((_, i) => {
        const x = Math.floor((Math.sin(i * 17) * 0.5 + 0.5) * width);
        const y = Math.floor((Math.cos(i * 13) * 0.5 + 0.5) * height);
        const r = (i % 3 === 0) ? 3 : ((i % 2 === 0) ? 1.8 : 1.2);
        const opacity = (i % 4 === 0) ? 0.8 : 0.5;
        const glow = i % 5 === 0;
        return { x, y, r, opacity, glow };
    });

    const menuCommands = ['/action', '/profil', '/quests', '/map', '/bank', '/lore'];

    // Check if background template or elion flag exists
    const flagPath = path.join(__dirname, 'assets', 'empire_elion_flag.png');
    const hasFlag = fs.existsSync(flagPath);

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <!-- Ethereal & Dark Glassmorphic Gradients -->
            <linearGradient id="obsidianGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0d0b18;stop-opacity:0.96" />
                <stop offset="100%" style="stop-color:#040308;stop-opacity:0.98" />
            </linearGradient>

            <linearGradient id="premiumGold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffe066;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#ffd700;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ffaa00;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="cyberCyan" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00ffff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0088ff;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="softRuby" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ff4081;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#d500f9;stop-opacity:1" />
            </linearGradient>

            <radialGradient id="vignetteGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:#161028;stop-opacity:0.4" />
                <stop offset="60%" style="stop-color:#06040c;stop-opacity:0.8" />
                <stop offset="100%" style="stop-color:#020104;stop-opacity:1" />
            </radialGradient>

            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>

            <filter id="intenseGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="15" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <!-- Main Background Vignette -->
        <rect width="100%" height="100%" fill="url(#vignetteGlow)" />

        <!-- Ethereal Cybernet Matrix gridlines -->
        <g stroke="rgba(255, 215, 0, 0.03)" stroke-width="1">
            ${Array.from({ length: 12 }).map((_, i) => `<line x1="0" y1="${i * 65}" x2="${width}" y2="${i * 65}" />`).join('')}
            ${Array.from({ length: 20 }).map((_, i) => `<line x1="${i * 65}" y1="0" x2="${i * 65}" y2="${height}" />`).join('')}
        </g>

        <!-- Soft diagonal luxury streaks -->
        <path d="M-100,500 L1300,100 L1300,105 L-100,505 Z" fill="url(#premiumGold)" opacity="0.08" filter="url(#softGlow)" />
        <path d="M-100,300 L1300,-100 L1300,-95 L-100,305 Z" fill="url(#cyberCyan)" opacity="0.05" filter="url(#softGlow)" />

        <!-- Floating ambient stardust -->
        <g>
            ${particles.map(p => `
                <circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.glow ? '#ffd700' : '#00ffff'}" opacity="${p.opacity}" ${p.glow ? 'filter="url(#softGlow)"' : ''} />
            `).join('')}
        </g>

        <!-- GAME LOGO: Clean Modern & Majestic Typography -->
        <g transform="translate(120, 110)">
            <text x="0" y="10" font-family="'Segoe UI', 'Arial Black', sans-serif" font-size="52" font-weight="900" fill="#ffffff" letter-spacing="3" style="text-shadow: 0px 4px 15px rgba(0,0,0,0.8);">AETHERYS</text>
            <text x="320" y="10" font-family="'Segoe UI', 'Arial Black', sans-serif" font-size="28" font-weight="300" fill="url(#premiumGold)" letter-spacing="8" style="filter: url(#softGlow)">EVOLUTION</text>
            <text x="0" y="32" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.4)" letter-spacing="4">NOYAU INTELLIGENT • GEMMA 3 STORY ENGINE</text>

            <!-- Sleek gold underlines -->
            <line x1="0" y1="45" x2="520" y2="45" stroke="url(#premiumGold)" stroke-width="2.5" />
            <circle cx="520" cy="45" r="3" fill="#ffd700" />
        </g>

        <!-- GLASSMORPHIC NAVIGATION MENU (Sleek Modern Slabs with cyber brackets) -->
        <g transform="translate(100, 240)">
            ${menuCommands.map((cmd, i) => {
                const isActive = (i === 0);
                const itemWidth = 350 - i * 12;
                const plateFill = isActive ? 'url(#premiumGold)' : 'rgba(255, 255, 255, 0.02)';
                const strokeColor = isActive ? '#ffd700' : 'rgba(255, 255, 255, 0.08)';
                const textColor = isActive ? '#0a0910' : '#c1c2d0';
                const textGlow = isActive ? 'font-weight: 900;' : '';

                return `
                <g transform="translate(${i * 20}, ${i * 64})" style="cursor: pointer;">
                    <!-- Elegant Rounded Slab -->
                    <rect x="0" y="-20" width="${itemWidth}" height="42" fill="${plateFill}" stroke="${strokeColor}" stroke-width="${isActive ? '2' : '0.8'}" rx="6" style="${isActive ? 'filter: drop-shadow(0px 0px 10px rgba(255, 215, 0, 0.45));' : ''}" />

                    <!-- Cyan Accent Highlight Bar on Left side -->
                    <rect x="0" y="-20" width="6" height="42" fill="${isActive ? '#ffffff' : 'url(#cyberCyan)'}" rx="3" opacity="0.9" />

                    <!-- Active Selector Dot -->
                    <circle cx="-25" cy="1" r="10" fill="${isActive ? '#ffd700' : 'rgba(0,0,0,0.5)'}" stroke="${strokeColor}" stroke-width="1.5" />
                    ${isActive ? `<circle cx="-25" cy="1" r="4" fill="#ffffff" />` : ''}

                    <!-- Command text -->
                    <text x="25" y="7" font-family="'Segoe UI', Arial, sans-serif" font-size="20" font-weight="bold" fill="${textColor}" letter-spacing="1.5" style="${textGlow}">${cmd.toUpperCase()}</text>

                    ${isActive ? `<polygon points="${itemWidth - 25},-3 ${itemWidth - 15},1 ${itemWidth - 25},5" fill="#000000" />` : ''}
                </g>
                `;
            }).join('')}
        </g>

        <!-- RIGHT SIDE: PREMIUM MODERN HUD CARD (Clean Obsidian glass with no statistics) -->
        <g transform="translate(710, 110)">
            <!-- Main Board Backdrop -->
            <rect x="0" y="0" width="390" height="500" fill="url(#obsidianGlass)" stroke="rgba(255,255,255,0.08)" stroke-width="1.2" rx="20" style="filter: drop-shadow(0 15px 35px rgba(0,0,0,0.8));" />
            <rect x="10" y="10" width="370" height="480" fill="none" stroke="rgba(255, 215, 0, 0.04)" stroke-width="1" rx="12" />

            <!-- Corner aesthetics -->
            <path d="M 0,25 L 0,0 L 25,0" fill="none" stroke="#ffd700" stroke-width="3" transform="translate(15, 15)" />
            <path d="M 360,0 L 385,0 L 360,25" fill="none" stroke="#ffd700" stroke-width="1" transform="translate(-10, 15)" />

            <!-- Sub Header Title -->
            <path d="M 12,12 L 378,12 L 378,45 L 12,45 Z" fill="rgba(255, 215, 0, 0.03)" />
            <text x="195" y="33" font-family="'Segoe UI', sans-serif" font-size="14" font-weight="900" fill="#ffd700" text-anchor="middle" letter-spacing="4">FICHE DE L'HÉRITIER</text>

            <!-- Character Profile Info -->
            <g transform="translate(30, 95)">
                <!-- Modern Circular Level Badge -->
                <circle cx="300" cy="15" r="35" fill="rgba(0,0,0,0.6)" stroke="url(#premiumGold)" stroke-width="2.5" />
                <text x="300" y="8" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="900" fill="#ffaa00" text-anchor="middle">LEVEL</text>
                <text x="300" y="30" font-family="'Segoe UI', sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle">${pLevel}</text>

                <!-- Name & Subtitle -->
                <text x="0" y="-5" font-family="'Segoe UI', sans-serif" font-size="28" font-weight="900" fill="#ffffff" style="letter-spacing: -0.5px;">${pName}</text>
                <text x="0" y="18" font-family="'Segoe UI', sans-serif" font-size="14" fill="#00ffff" font-weight="700" letter-spacing="2">${pClass} • ${pRace}</text>
                <text x="0" y="35" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.4)">RANG DE PUISSANCE : ${pRank}</text>
            </g>

            <!-- Resource Progress Meters -->
            <g transform="translate(30, 185)">
                <!-- HP Gauge -->
                <g transform="translate(0, 0)">
                    <rect x="0" y="-18" width="10" height="10" fill="url(#softRuby)" rx="2" />
                    <text x="18" y="-10" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="900" fill="#ff4081" letter-spacing="1.5">POINTS DE VIE (HP)</text>
                    <text x="330" y="-10" font-family="monospace" font-size="13" fill="#ffffff" font-weight="bold" text-anchor="end">${pHealth} / ${pMaxHealth}</text>
                    <rect x="0" y="0" width="330" height="8" fill="rgba(255,255,255,0.06)" rx="4" />
                    <rect x="0" y="0" width="${Math.max(10, Math.min(100, (pHealth / pMaxHealth) * 100)) * 3.3}" height="8" fill="url(#softRuby)" rx="4" filter="url(#softGlow)" />
                </g>

                <!-- MP Gauge -->
                <g transform="translate(0, 52)">
                    <rect x="0" y="-18" width="10" height="10" fill="url(#cyberCyan)" rx="2" />
                    <text x="18" y="-10" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="900" fill="#00ffff" letter-spacing="1.5">RÉSERVE D'ÉTHER (MP)</text>
                    <text x="330" y="-10" font-family="monospace" font-size="13" fill="#ffffff" font-weight="bold" text-anchor="end">${pMana} / ${pMaxMana}</text>
                    <rect x="0" y="0" width="330" height="8" fill="rgba(255,255,255,0.06)" rx="4" />
                    <rect x="0" y="0" width="${Math.max(10, Math.min(100, (pMana / pMaxMana) * 100)) * 3.3}" height="8" fill="url(#cyberCyan)" rx="4" filter="url(#softGlow)" />
                </g>

                <!-- Location & Sector Coordinates Panel -->
                <g transform="translate(0, 115)">
                    <rect x="-10" y="0" width="350" height="68" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.06)" rx="8" />
                    <text x="15" y="24" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="900" fill="#ffd700" letter-spacing="2.5">SECTEUR ACTUEL</text>
                    <text x="15" y="44" font-family="'Segoe UI', sans-serif" font-size="15" font-weight="bold" fill="#ffffff" letter-spacing="0.5">📍 ${pLocation}</text>
                    <text x="15" y="58" font-family="monospace" font-size="11" fill="#00ffff" font-weight="bold">⚡ ${pSubLocation}</text>
                </g>

                <!-- Status overview icons and gold -->
                <g transform="translate(0, 205)">
                    <rect x="-10" y="0" width="165" height="52" fill="rgba(255,215,0,0.01)" stroke="rgba(255,215,0,0.08)" rx="8" />
                    <text x="10" y="18" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="rgba(255,215,0,0.6)" letter-spacing="1">COL EN ESPÈCES</text>
                    <text x="10" y="40" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="900" fill="#ffd700">🪙 ${pCol.toLocaleString()}</text>

                    <rect x="175" y="0" width="165" height="52" fill="rgba(0,255,255,0.01)" stroke="rgba(0,255,255,0.08)" rx="8" />
                    <text x="195" y="18" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="rgba(0,255,255,0.6)" letter-spacing="1">STABILITÉ MATRICE</text>
                    <text x="195" y="40" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="900" fill="#00f3ff">CONNECTÉ</text>
                </g>
            </g>

            <!-- Bottom system diagnostic status keys -->
            <g transform="translate(30, 465)">
                <line x1="-10" y1="-10" x2="340" y2="-10" stroke="rgba(255,255,255,0.06)" stroke-width="0.8" />
                <text x="0" y="8" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.3)">MATRIX CORE v4.12 // EMULATED SYSTEM: SECURE</text>
                <text x="330" y="8" font-family="monospace" font-size="10" fill="#ffaa00" font-weight="bold" text-anchor="end">RANG ${pRank}</text>
            </g>
        </g>

        <!-- Footer watermark -->
        <g transform="translate(60, ${height - 35})">
            <text font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="rgba(255,255,255,0.2)" letter-spacing="4">© AETHERYS ENTERTAINMENT LABS // PREMIUM ANIME-RPG INTERFACE 2026</text>
        </g>
    </svg>
    `;

    let menuSharpInstance;
    if (hasFlag) {
        try {
            // Overlay flag as a soft background texture
            const dimmedFlag = await sharp(flagPath)
                .resize(width, height, { fit: 'cover' })
                .blur(5)
                .linear(0.12, 0) // heavily dimmed for maximum premium readability
                .toBuffer();

            menuSharpInstance = sharp(dimmedFlag)
                .composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
        } catch (e) {
            console.error("[Menu Generator] Error processing flag background:", e);
            menuSharpInstance = sharp(Buffer.from(svg));
        }
    } else {
        menuSharpInstance = sharp(Buffer.from(svg));
    }

    return menuSharpInstance.png().toBuffer();
}

module.exports = { generateMainMenuImage };
