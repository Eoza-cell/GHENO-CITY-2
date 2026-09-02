const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeXml } = require('./utils');

/**
 * Generates an ultra-premium, modern anime-RPG main menu image in Oblique Diamond / Rhombus HUD style.
 * Features oblique tilted containers, diagonal gold/cyan neon border trims, slanted badge containers,
 * and high-tech anime HUD diamond visual geometry.
 *
 * @param {Object} player - The player object from the database (optional)
 */
async function generateMainMenuImage(player) {
    const width = 1200;
    const height = 780;

    // Fallbacks and details
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

    // Grid details & options mapping (Oblique Diamond Slanted Layout)
    const cardWidth = 260;
    const cardHeight = 210;

    const cardsData = [
        {
            cmd: '/action',
            title: 'AVENTURE',
            sub: 'Combats & RP',
            desc: 'Défiez des monstres et gagnez de l\'XP',
            color: '#ff3c00', // Ruby Red
            imagePath: path.join(__dirname, 'assets', 'tutorial_boss.jpg'),
            x: 40,
            y: 210
        },
        {
            cmd: '/dormir',
            title: 'SOMMEIL',
            sub: 'Récupération (3 min)',
            desc: 'Restaurez à 100% votre jauge d\'énergie',
            color: '#3399ff', // Soft Blue
            imagePath: path.join(__dirname, 'assets', 'silhouette.jpg'),
            x: 320,
            y: 210
        },
        {
            cmd: '/profil',
            title: 'FICHE HÉRITIER',
            sub: 'Stats & Aura',
            desc: 'Visualisez votre niveau et puissance',
            color: '#00e5ff', // Cyan Neon
            imagePath: path.join(__dirname, 'assets', 'silhouette.jpg'),
            x: 600,
            y: 210
        },
        {
            cmd: '/quests',
            title: 'JOURNAL DE QUÊTES',
            sub: 'Missions & Fil Rouge',
            desc: 'Suivez vos objectifs actifs et primes',
            color: '#ffd700', // Gold/Amber
            imagePath: path.join(__dirname, 'assets', 'locations', 'interstice.jpg'),
            x: 880,
            y: 210
        },
        {
            cmd: '/map',
            title: 'CARTE DU MONDE',
            sub: 'Navigation & Voy.',
            desc: 'Explorez les 17 royaumes d\'ATR',
            color: '#00e676', // Emerald Green
            imagePath: path.join(__dirname, 'assets', 'locations', 'eldoria.jpg'),
            x: 40,
            y: 460
        },
        {
            cmd: '/boutique',
            title: 'BOUTIQUE',
            sub: 'Armes & Nourriture',
            desc: 'Achetez des objets et consommables',
            color: '#ff9900', // Amber Orange
            imagePath: path.join(__dirname, 'assets', 'apostle.jpg'),
            x: 320,
            y: 460
        },
        {
            cmd: '/bank',
            title: 'COFFRE-FORT',
            sub: 'Dépôts & Retraits',
            desc: 'Gérez votre fortune en pièces Col',
            color: '#d500f9', // Magenta Purple
            imagePath: path.join(__dirname, 'assets', 'locations', 'academy.jpg'),
            x: 600,
            y: 460
        },
        {
            cmd: '/lore',
            title: 'ARCHIVES ATR',
            sub: 'Lore & Mythes',
            desc: 'Découvrez les secrets de la Renaissance',
            color: '#b0bec5', // Slate Grey
            imagePath: path.join(__dirname, 'assets', 'locations', 'necropolis.jpg'),
            x: 880,
            y: 460
        }
    ];

    // Load and process card background images in parallel to Base64 buffers
    const processedCards = await Promise.all(cardsData.map(async (card) => {
        let base64Img = '';
        if (fs.existsSync(card.imagePath)) {
            try {
                const buf = await sharp(card.imagePath)
                    .resize(cardWidth, cardHeight, { fit: 'cover' })
                    .linear(0.40, 0)
                    .jpeg({ quality: 80 })
                    .toBuffer();
                base64Img = buf.toString('base64');
            } catch (e) {
                console.error(`[Menu Generator] Error processing card image ${card.title}:`, e.message);
            }
        }
        return {
            ...card,
            base64Img
        };
    }));

    // Floating particles / stardust coordinates
    const particleCount = 45;
    const particles = Array.from({ length: particleCount }).map((_, i) => {
        const x = Math.floor((Math.sin(i * 19) * 0.5 + 0.5) * width);
        const y = Math.floor((Math.cos(i * 11) * 0.5 + 0.5) * height);
        const r = (i % 3 === 0) ? 2.5 : ((i % 2 === 0) ? 1.5 : 1.0);
        const opacity = (i % 4 === 0) ? 0.7 : 0.4;
        const glow = i % 5 === 0;
        return { x, y, r, opacity, glow };
    });

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
            <!-- Sleek Glassmorphic & Cyber Gradients -->
            <linearGradient id="obsidianBack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#070514;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#030209;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#010003;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="glassHud" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#140e2d;stop-opacity:0.92" />
                <stop offset="100%" style="stop-color:#060410;stop-opacity:0.96" />
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
                <stop offset="100%" style="stop-color:#ff3c00;stop-opacity:1" />
            </linearGradient>

            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>

            <!-- Oblique Rhomboid ClipPaths for Slanted Menu Cards -->
            ${processedCards.map((_, i) => `
            <clipPath id="clip-rhomboid-${i}">
                <polygon points="18,0 ${cardWidth},0 ${cardWidth - 18},${cardHeight} 0,${cardHeight}" />
            </clipPath>
            `).join('')}
        </defs>

        <!-- Base Ambient Background Layers -->
        <rect width="100%" height="100%" fill="url(#obsidianBack)" />

        <!-- Diagonal Grid Lines (Oblique Geometry Accent) -->
        <g stroke="rgba(0, 255, 255, 0.03)" stroke-width="1">
            ${Array.from({ length: 25 }).map((_, i) => `<line x1="${i * 60 - 200}" y1="0" x2="${i * 60 + 400}" y2="${height}" />`).join('')}
            ${Array.from({ length: 25 }).map((_, i) => `<line x1="${i * 60 + 400}" y1="0" x2="${i * 60 - 200}" y2="${height}" />`).join('')}
        </g>

        <!-- Oblique Background Glow Rays -->
        <path d="M-100,600 L1300,100 L1300,108 L-100,608 Z" fill="url(#premiumGold)" opacity="0.12" filter="url(#softGlow)" />
        <path d="M-100,300 L1300,-100 L1300,-92 L-100,308 Z" fill="url(#cyberCyan)" opacity="0.08" filter="url(#softGlow)" />

        <!-- Floating Ambient Stardust Particles -->
        <g>
            ${particles.map(p => `
                <circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.glow ? '#ffd700' : '#00ffff'}" opacity="${p.opacity}" ${p.glow ? 'filter="url(#softGlow)"' : ''} />
            `).join('')}
        </g>

        <!-- ==================== HEADER / OBLIQUE TOP PANEL ==================== -->
        <!-- Logo Section -->
        <g transform="translate(60, 40)">
            <!-- Oblique Diamond Badge Emblem -->
            <polygon points="20,0 40,20 20,40 0,20" fill="none" stroke="url(#premiumGold)" stroke-width="2.5" filter="url(#softGlow)"/>
            <polygon points="20,7 33,20 20,33 7,20" fill="url(#premiumGold)"/>

            <text x="55" y="28" font-family="'Segoe UI', 'Arial Black', sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="2">AFTER THE REBIRTH</text>
            <text x="375" y="28" font-family="'Segoe UI', 'Arial Black', sans-serif" font-size="14" font-weight="300" fill="url(#premiumGold)" letter-spacing="4" filter="url(#softGlow)">ATR OS</text>
            <text x="55" y="46" font-family="monospace" font-size="9" fill="rgba(255,255,255,0.4)" letter-spacing="3">MJ D'AFTER THE REBIRTH • INTERFACE TACTIQUE OBLIQUE</text>

            <line x1="55" y1="56" x2="380" y2="56" stroke="url(#premiumGold)" stroke-width="1.8" opacity="0.8" />
        </g>

        <!-- Oblique Glassmorphic Player HUD Container -->
        <g transform="translate(480, 25)">
            <!-- Slanted Rhomboid Glass Base -->
            <polygon points="25,0 660,0 635,145 0,145" fill="url(#glassHud)" stroke="rgba(255,215,0,0.3)" stroke-width="1.5" filter="drop-shadow(0 10px 25px rgba(0,0,0,0.8))" />

            <!-- Oblique Inner Accent Trim -->
            <polygon points="32,8 650,8 627,137 9,137" fill="none" stroke="rgba(0,255,255,0.15)" stroke-width="1" />

            <!-- Diamond Level Badge -->
            <g transform="translate(55, 72)">
                <polygon points="0,-28 28,0 0,28 -28,0" fill="rgba(10,5,25,0.85)" stroke="url(#premiumGold)" stroke-width="2" filter="url(#softGlow)"/>
                <text x="0" y="-8" font-family="'Segoe UI', sans-serif" font-size="8" font-weight="900" fill="#ffaa00" text-anchor="middle">LEVEL</text>
                <text x="0" y="12" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(pLevel)}</text>
            </g>

            <!-- Name, Class, Race -->
            <g transform="translate(105, 38)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="900" fill="#ffffff">${escapeXml(pName)}</text>
                <text x="0" y="18" font-family="'Segoe UI', sans-serif" font-size="12" fill="#ffd700" font-weight="bold" letter-spacing="1.5">❖ ${escapeXml(pClass)} • ${escapeXml(pRace)}</text>
                <text x="0" y="32" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.4)">RANG : <tspan fill="#00ffff" font-weight="bold">${escapeXml(pRank)}</tspan> • COORDONNÉES MATRIX SECURE</text>
            </g>

            <!-- HP / MP Gauges on Right side of the HUD -->
            <g transform="translate(365, 26)">
                <!-- HP Gauge -->
                <g transform="translate(0, 0)">
                    <text x="0" y="10" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="900" fill="#ff4081" letter-spacing="1">HP ❖</text>
                    <text x="240" y="10" font-family="monospace" font-size="10" fill="#ffffff" font-weight="bold" text-anchor="end">${escapeXml(pHealth)} / ${escapeXml(pMaxHealth)}</text>
                    <rect x="0" y="16" width="240" height="6" fill="rgba(255,255,255,0.07)" rx="3" />
                    <rect x="0" y="16" width="${Math.max(10, Math.min(100, (pHealth / pMaxHealth) * 100)) * 2.4}" height="6" fill="url(#softRuby)" rx="3" filter="url(#softGlow)" />
                </g>

                <!-- MP Gauge -->
                <g transform="translate(0, 32)">
                    <text x="0" y="10" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="900" fill="#00ffff" letter-spacing="1">MP ❖</text>
                    <text x="240" y="10" font-family="monospace" font-size="10" fill="#ffffff" font-weight="bold" text-anchor="end">${escapeXml(pMana)} / ${escapeXml(pMaxMana)}</text>
                    <rect x="0" y="16" width="240" height="6" fill="rgba(255,255,255,0.07)" rx="3" />
                    <rect x="0" y="16" width="${Math.max(10, Math.min(100, (pMana / pMaxMana) * 100)) * 2.4}" height="6" fill="url(#cyberCyan)" rx="3" filter="url(#softGlow)" />
                </g>

                <!-- ATR System Loading Bar -->
                <g transform="translate(0, 64)">
                    <text x="0" y="10" font-family="'Segoe UI', sans-serif" font-size="9" font-weight="900" fill="#00ffcc" letter-spacing="1">ATR MATRIX</text>
                    <text x="240" y="10" font-family="monospace" font-size="9" fill="#00ffcc" font-weight="bold" text-anchor="end">ONLINE // 100%</text>
                    <rect x="0" y="16" width="240" height="4" fill="rgba(255,255,255,0.07)" rx="2" />
                    <rect x="0" y="16" width="240" height="4" fill="#00ffcc" rx="2" style="filter: drop-shadow(0 0 4px #00ffcc);" />
                </g>
            </g>

            <!-- Bottom location & Col panel in HUD -->
            <g transform="translate(105, 118)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#00e676">📍 ${escapeXml(pLocation.toUpperCase())} <tspan fill="rgba(255,255,255,0.4)">|</tspan> ${escapeXml(pSubLocation.toUpperCase())}</text>
                <text x="500" y="0" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="900" fill="#ffd700" text-anchor="end">🪙 ${escapeXml(pCol.toLocaleString())} COL</text>
            </g>
        </g>

        <!-- ==================== MAIN OBLIQUE CARDS GRID ==================== -->
        ${processedCards.map((card, i) => {
            const isActive = (i === 0);
            const borderGrad = isActive ? 'url(#premiumGold)' : 'rgba(0,255,255,0.25)';
            const shadowGlow = isActive ? `filter: drop-shadow(0px 0px 15px rgba(255, 215, 0, 0.45)); stroke-width: 2.2;` : 'stroke-width: 1.2;';
            const badgeBg = isActive ? '#ffd700' : 'rgba(255,255,255,0.08)';
            const badgeTextColor = isActive ? '#05040a' : card.color;

            return `
            <g transform="translate(${card.x}, ${card.y})">
                <!-- Rhomboid Slanted ClipPath for Card Background -->
                <g clip-path="url(#clip-rhomboid-${i})">
                    <!-- Embedded Card Background Image -->
                    ${card.base64Img ? `
                    <image x="0" y="0" width="${cardWidth}" height="${cardHeight}" xlink:href="data:image/jpeg;base64,${card.base64Img}" />
                    ` : `
                    <rect width="${cardWidth}" height="${cardHeight}" fill="#0d0b1a" />
                    <rect width="${cardWidth}" height="${cardHeight}" fill="${card.color}" opacity="0.08" />
                    `}

                    <!-- Dark glassmorphic tint -->
                    <rect width="${cardWidth}" height="${cardHeight}" fill="rgba(8, 5, 18, 0.60)" />

                    <!-- Oblique Neon Diagonal Stripe -->
                    <line x1="-20" y1="${cardHeight}" x2="${cardWidth + 20}" y2="0" stroke="${card.color}" stroke-width="2" opacity="0.3" filter="url(#softGlow)"/>

                    <!-- Card Contents -->
                    <g transform="translate(30, 30)">
                        <!-- Slanted Rhombus Command Badge -->
                        <polygon points="8,0 90,0 82,18 0,18" fill="${badgeBg}" />
                        <text x="42" y="12" font-family="monospace" font-size="9" font-weight="900" fill="${badgeTextColor}" text-anchor="middle">${escapeXml(card.cmd.toUpperCase())}</text>

                        <!-- Glowing Oblique Diamond Emblem -->
                        <polygon points="${cardWidth - 65},5 ${cardWidth - 55},15 ${cardWidth - 65},25 ${cardWidth - 75},15" fill="${card.color}" opacity="${isActive ? 0.9 : 0.5}" filter="url(#softGlow)"/>

                        <!-- Title and sub -->
                        <text x="0" y="46" font-family="'Segoe UI', Arial, sans-serif" font-size="21" font-weight="900" fill="#ffffff" letter-spacing="1" style="text-shadow: 0px 2px 8px rgba(0,0,0,0.95);">${escapeXml(card.title)}</text>
                        <text x="0" y="68" font-family="'Segoe UI', sans-serif" font-size="12" fill="${card.color}" font-weight="bold" letter-spacing="0.5">❖ ${escapeXml(card.sub)}</text>

                        <!-- Description -->
                        <text x="0" y="96" font-family="'Segoe UI', sans-serif" font-size="11" fill="rgba(255,255,255,0.6)" width="${cardWidth - 50}">${escapeXml(card.desc)}</text>
                    </g>

                    <!-- Active card highlight overlays -->
                    ${isActive ? `
                    <polygon points="12,182 24,182 18,172" fill="#ffd700" />
                    <text x="32" y="181" font-family="monospace" font-size="9" font-weight="bold" fill="#ffd700" letter-spacing="1">SÉLECTION ACTIVE ❖</text>
                    ` : ''}
                </g>

                <!-- Sharp Oblique Rhombus Outer Border Frame -->
                <polygon points="18,0 ${cardWidth},0 ${cardWidth - 18},${cardHeight} 0,${cardHeight}" fill="none" stroke="${borderGrad}" style="${shadowGlow}" />
            </g>
            `;
        }).join('')}

        <!-- ==================== FOOTER ==================== -->
        <g transform="translate(60, ${height - 35})">
            <text font-family="'Segoe UI', sans-serif" font-size="10" font-weight="bold" fill="rgba(255,255,255,0.2)" letter-spacing="4">© AFTER THE REBIRTH • ENTERTAINMENT LABS • CONSEIL TACTIQUE OBLIQUE</text>
            <text x="1080" y="0" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.2)" text-anchor="end">SYS_STATUS: OPTIMAL // SYNC_ACTIVE</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
