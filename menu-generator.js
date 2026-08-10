const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeXml } = require('./utils');

/**
 * Generates an ultra-premium, modern anime-RPG main menu image using Sharp and SVG.
 * Features a gorgeous dashboard layout with a sleek player HUD header and a grid of 6
 * beautiful card frames (cadres) representing each menu option, complete with custom background
 * illustrations, glassmorphic filters, neon glowing borders, and elegant typography.
 * @param {Object} player - The player object from the database (optional)
 */
async function generateMainMenuImage(player) {
    const width = 1200;
    const height = 750;

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

    // Grid details & options mapping
    const cardWidth = 340;
    const cardHeight = 200;

    const cardsData = [
        {
            cmd: '/action',
            title: 'AVENTURE',
            sub: 'Combats, Chasses & Exploration',
            desc: 'Défiez des monstres et gagnez de l\'XP',
            color: '#ff3c00', // Ruby Red
            imagePath: path.join(__dirname, 'assets', 'tutorial_boss.jpg'),
            x: 60,
            y: 220
        },
        {
            cmd: '/profil',
            title: 'FICHE D\'IDENTITÉ',
            sub: 'Statistiques & Équipements',
            desc: 'Visualisez l\'aura et la puissance',
            color: '#00e5ff', // Cyan Neon
            imagePath: path.join(__dirname, 'assets', 'silhouette.jpg'),
            x: 430,
            y: 220
        },
        {
            cmd: '/quests',
            title: 'JOURNAL DE QUÊTES',
            sub: 'Chroniques du Destin',
            desc: 'Suivez le fil rouge des missions',
            color: '#ffd700', // Gold/Amber
            imagePath: path.join(__dirname, 'assets', 'locations', 'interstice.jpg'),
            x: 800,
            y: 220
        },
        {
            cmd: '/map',
            title: 'CARTE DU MONDE',
            sub: 'Navigation & Voyage',
            desc: 'Explorez les 17 royaumes d\'Aetherys',
            color: '#00e676', // Emerald Green
            imagePath: path.join(__dirname, 'assets', 'locations', 'eldoria.jpg'),
            x: 60,
            y: 450
        },
        {
            cmd: '/bank',
            title: 'COFFRE-FORT',
            sub: 'Dépôts, Retraits & Prêts',
            desc: 'Gérez votre richesse en pièces Col',
            color: '#d500f9', // Magenta Purple
            imagePath: path.join(__dirname, 'assets', 'locations', 'academy.jpg'),
            x: 430,
            y: 450
        },
        {
            cmd: '/lore',
            title: 'ENCYCLOPÉDIE',
            sub: 'Mythes & Histoires d\'Aetherys',
            desc: 'Découvrez les secrets fondateurs',
            color: '#b0bec5', // Slate Grey
            imagePath: path.join(__dirname, 'assets', 'locations', 'necropolis.jpg'),
            x: 800,
            y: 450
        }
    ];

    // Load and process card background images in parallel to Base64 buffers
    const processedCards = await Promise.all(cardsData.map(async (card, idx) => {
        let base64Img = '';
        if (fs.existsSync(card.imagePath)) {
            try {
                const buf = await sharp(card.imagePath)
                    .resize(cardWidth, cardHeight, { fit: 'cover' })
                    .linear(0.45, 0) // Heavily dimmed to ensure high text contrast
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
                <stop offset="0%" style="stop-color:#07050e;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#010103;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="glassHud" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#120e24;stop-opacity:0.85" />
                <stop offset="100%" style="stop-color:#080612;stop-opacity:0.95" />
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

            <radialGradient id="ambientBackGlow" cx="50%" cy="40%" r="60%">
                <stop offset="0%" style="stop-color:#181033;stop-opacity:0.5" />
                <stop offset="50%" style="stop-color:#05030b;stop-opacity:0.9" />
                <stop offset="100%" style="stop-color:#010103;stop-opacity:1" />
            </radialGradient>

            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>

            <!-- Rounded clipPaths for grid cards background images -->
            ${processedCards.map((_, i) => `
            <clipPath id="clip-card-${i}">
                <rect x="0" y="0" width="${cardWidth}" height="${cardHeight}" rx="14" ry="14" />
            </clipPath>
            `).join('')}
        </defs>

        <!-- Base Ambient Background Layers -->
        <rect width="100%" height="100%" fill="url(#obsidianBack)" />
        <rect width="100%" height="100%" fill="url(#ambientBackGlow)" />

        <!-- Ethereal Space Matrix Gridlines -->
        <g stroke="rgba(255, 215, 0, 0.015)" stroke-width="1">
            ${Array.from({ length: 15 }).map((_, i) => `<line x1="0" y1="${i * 55}" x2="${width}" y2="${i * 55}" />`).join('')}
            ${Array.from({ length: 25 }).map((_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${height}" />`).join('')}
        </g>

        <!-- Soft luxury background sweeps -->
        <path d="M-100,550 L1300,150 L1300,154 L-100,554 Z" fill="url(#premiumGold)" opacity="0.06" filter="url(#softGlow)" />
        <path d="M-100,350 L1300,-50 L1300,-46 L-100,354 Z" fill="url(#cyberCyan)" opacity="0.04" filter="url(#softGlow)" />

        <!-- Floating Ambient Stardust Particles -->
        <g>
            ${particles.map(p => `
                <circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.glow ? '#ffd700' : '#00ffff'}" opacity="${p.opacity}" ${p.glow ? 'filter="url(#softGlow)"' : ''} />
            `).join('')}
        </g>

        <!-- ==================== HEADER / TOP PANEL ==================== -->
        <!-- Logo Section -->
        <g transform="translate(60, 45)">
            <text x="0" y="32" font-family="'Segoe UI', 'Arial Black', sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="2" style="text-shadow: 0px 4px 12px rgba(0,0,0,0.9);">AFTER THE REBIRTH</text>
            <text x="315" y="32" font-family="'Segoe UI', 'Arial Black', sans-serif" font-size="14" font-weight="300" fill="url(#premiumGold)" letter-spacing="4" style="filter: url(#softGlow)">ATR OS</text>
            <text x="0" y="50" font-family="monospace" font-size="9" fill="rgba(255,255,255,0.35)" letter-spacing="3.5">MJ D'AFTER THE REBIRTH • INTERFACE TACTIQUE</text>

            <line x1="0" y1="62" x2="350" y2="62" stroke="url(#premiumGold)" stroke-width="1.8" opacity="0.8" />
            <circle cx="350" cy="62" r="2.5" fill="#ffd700" />
        </g>

        <!-- Glassmorphic Player HUD Banner -->
        <g transform="translate(480, 35)">
            <!-- Glass panel base -->
            <rect x="0" y="0" width="660" height="135" fill="url(#glassHud)" stroke="rgba(255,255,255,0.08)" stroke-width="1" rx="16" style="filter: drop-shadow(0 10px 25px rgba(0,0,0,0.65));" />
            <rect x="6" y="6" width="648" height="123" fill="none" stroke="rgba(255,215,0,0.02)" stroke-width="1" rx="10" />

            <!-- Decorative Bracket accents -->
            <path d="M 12,25 L 12,12 L 25,12" fill="none" stroke="#ffd700" stroke-width="2" />
            <path d="M 648,110 L 648,123 L 635,123" fill="none" stroke="#ffd700" stroke-width="2" />

            <!-- Player Rank Badge -->
            <circle cx="50" cy="68" r="32" fill="rgba(0,0,0,0.5)" stroke="url(#premiumGold)" stroke-width="2" />
            <text x="50" y="55" font-family="'Segoe UI', sans-serif" font-size="9" font-weight="900" fill="#ffaa00" text-anchor="middle">LEVEL</text>
            <text x="50" y="78" font-family="'Segoe UI', sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(pLevel)}</text>

            <!-- Name, Class, Race -->
            <g transform="translate(100, 36)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="900" fill="#ffffff">${escapeXml(pName)}</text>
                <text x="0" y="18" font-family="'Segoe UI', sans-serif" font-size="12" fill="#ffd700" font-weight="bold" letter-spacing="1.5">${escapeXml(pClass)} • ${escapeXml(pRace)}</text>
                <text x="0" y="32" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.4)">RANG : <tspan fill="#00ffff" font-weight="bold">${escapeXml(pRank)}</tspan> • COORDONNÉES MATRIX SECURE</text>
            </g>

            <!-- HP / MP Gauges on Right side of the HUD -->
            <g transform="translate(370, 26)">
                <!-- HP Gauge -->
                <g transform="translate(0, 0)">
                    <text x="0" y="10" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="900" fill="#ff4081" letter-spacing="1">HP</text>
                    <text x="260" y="10" font-family="monospace" font-size="10" fill="#ffffff" font-weight="bold" text-anchor="end">${escapeXml(pHealth)} / ${escapeXml(pMaxHealth)}</text>
                    <rect x="0" y="16" width="260" height="6" fill="rgba(255,255,255,0.07)" rx="3" />
                    <rect x="0" y="16" width="${Math.max(10, Math.min(100, (pHealth / pMaxHealth) * 100)) * 2.6}" height="6" fill="url(#softRuby)" rx="3" filter="url(#softGlow)" />
                </g>

                <!-- MP Gauge -->
                <g transform="translate(0, 32)">
                    <text x="0" y="10" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="900" fill="#00ffff" letter-spacing="1">MP</text>
                    <text x="260" y="10" font-family="monospace" font-size="10" fill="#ffffff" font-weight="bold" text-anchor="end">${escapeXml(pMana)} / ${escapeXml(pMaxMana)}</text>
                    <rect x="0" y="16" width="260" height="6" fill="rgba(255,255,255,0.07)" rx="3" />
                    <rect x="0" y="16" width="${Math.max(10, Math.min(100, (pMana / pMaxMana) * 100)) * 2.6}" height="6" fill="url(#cyberCyan)" rx="3" filter="url(#softGlow)" />
                </g>

                <!-- ATR System Loading Bar -->
                <g transform="translate(0, 64)">
                    <text x="0" y="10" font-family="'Segoe UI', sans-serif" font-size="9" font-weight="900" fill="#00ffcc" letter-spacing="1">ATR CONNECTIVITY</text>
                    <text x="260" y="10" font-family="monospace" font-size="9" fill="#00ffcc" font-weight="bold" text-anchor="end">ONLINE // 100%</text>
                    <rect x="0" y="16" width="260" height="4" fill="rgba(255,255,255,0.07)" rx="2" />
                    <rect x="0" y="16" width="260" height="4" fill="#00ffcc" rx="2" style="filter: drop-shadow(0 0 4px #00ffcc);" />
                </g>
            </g>

            <!-- Bottom location & Col panel in HUD -->
            <g transform="translate(100, 108)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#00e676">📍 ${escapeXml(pLocation.toUpperCase())} <tspan fill="rgba(255,255,255,0.4)">|</tspan> ${escapeXml(pSubLocation.toUpperCase())}</text>
                <text x="548" y="0" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="900" fill="#ffd700" text-anchor="end">🪙 ${escapeXml(pCol.toLocaleString())} COL</text>
            </g>
        </g>

        <!-- ==================== MAIN CARDS GRID (CADRES) ==================== -->
        ${processedCards.map((card, i) => {
            const isActive = (i === 0); // Adventure /action is active/highlighted by default
            const borderGrad = isActive ? 'url(#premiumGold)' : 'rgba(255,255,255,0.12)';
            const shadowGlow = isActive ? `filter: drop-shadow(0px 0px 15px rgba(255, 215, 0, 0.45)); stroke-width: 2.5;` : 'stroke-width: 1.2;';
            const badgeBg = isActive ? '#ffd700' : 'rgba(255,255,255,0.06)';
            const badgeTextColor = isActive ? '#05040a' : card.color;

            return `
            <g transform="translate(${card.x}, ${card.y})">
                <!-- Group-level clip path to keep card completely rounded -->
                <g clip-path="url(#clip-card-${i})">
                    <!-- Embedded Card Background Image (processed/dimmed) -->
                    ${card.base64Img ? `
                    <image x="0" y="0" width="${cardWidth}" height="${cardHeight}" xlink:href="data:image/jpeg;base64,${card.base64Img}" />
                    ` : `
                    <!-- Solid gradient fallback if asset doesn't exist -->
                    <rect width="${cardWidth}" height="${cardHeight}" fill="#0d0b1a" />
                    <rect width="${cardWidth}" height="${cardHeight}" fill="${card.color}" opacity="0.08" />
                    `}

                    <!-- Dark premium glassmorphic overlay inside card -->
                    <rect width="${cardWidth}" height="${cardHeight}" fill="rgba(9, 7, 18, 0.55)" />

                    <!-- Cyber diagonal luxury stripes -->
                    <path d="M 0,${cardHeight} L ${cardWidth},30" stroke="${card.color}" stroke-width="1.5" opacity="0.12" />

                    <!-- Card Contents -->
                    <g transform="translate(25, 30)">
                        <!-- Command Badge -->
                        <rect x="0" y="0" width="85" height="16" fill="${badgeBg}" rx="4" />
                        <text x="42.5" y="11" font-family="monospace" font-size="9" font-weight="900" fill="${badgeTextColor}" text-anchor="middle">${escapeXml(card.cmd.toUpperCase())}</text>

                        <!-- Glowing decorative indicator at top-right of card content -->
                        <circle cx="${cardWidth - 55}" cy="8" r="4" fill="${card.color}" style="filter: url(#softGlow);" opacity="${isActive ? 0.9 : 0.5}" />

                        <!-- Title and sub -->
                        <text x="0" y="44" font-family="'Segoe UI', Arial, sans-serif" font-size="22" font-weight="900" fill="#ffffff" letter-spacing="1" style="text-shadow: 0px 2px 8px rgba(0,0,0,0.95);">${escapeXml(card.title)}</text>
                        <text x="0" y="66" font-family="'Segoe UI', sans-serif" font-size="12" fill="${card.color}" font-weight="bold" letter-spacing="0.5">${escapeXml(card.sub)}</text>

                        <!-- Description -->
                        <text x="0" y="94" font-family="'Segoe UI', sans-serif" font-size="11" fill="rgba(255,255,255,0.55)" width="${cardWidth - 50}">${escapeXml(card.desc)}</text>
                    </g>

                    <!-- Active card highlight overlays -->
                    ${isActive ? `
                    <rect x="1" y="1" width="${cardWidth - 2}" height="${cardHeight - 2}" fill="none" stroke="url(#premiumGold)" stroke-width="1.5" opacity="0.35" rx="13" />
                    <polygon points="12,185 24,185 18,175" fill="#ffd700" />
                    <text x="32" y="184" font-family="monospace" font-size="9" font-weight="bold" fill="#ffd700" letter-spacing="1">SÉLECTION ACTIVE</text>
                    ` : ''}

                    <!-- Beautiful sci-fi design corners inside card -->
                    <path d="M 12,20 L 12,12 L 20,12" fill="none" stroke="${card.color}" stroke-width="1.5" opacity="0.5" />
                    <path d="M ${cardWidth - 12},${cardHeight - 20} L ${cardWidth - 12},${cardHeight - 12} L ${cardWidth - 20},${cardHeight - 12}" fill="none" stroke="${card.color}" stroke-width="1.5" opacity="0.5" />
                </g>

                <!-- High-contrast crisp border outside clipping to look incredibly sharp -->
                <rect x="0" y="0" width="${cardWidth}" height="${cardHeight}" fill="none" stroke="${borderGrad}" style="${shadowGlow}" rx="14" ry="14" />
            </g>
            `;
        }).join('')}

        <!-- ==================== FOOTER ==================== -->
        <g transform="translate(60, ${height - 35})">
            <text font-family="'Segoe UI', sans-serif" font-size="10" font-weight="bold" fill="rgba(255,255,255,0.2)" letter-spacing="4">© AETHERYS ENTERTAINMENT LABS • CONSEIL TACTIQUE GENERATION IV</text>
            <text x="1080" y="0" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.2)" text-anchor="end">SYS_STATUS: OPTIMAL // SYNC_ACTIVE</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
