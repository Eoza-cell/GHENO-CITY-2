const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeXml } = require('./utils');

/**
 * Generates an ultra-premium Anime / Manga RPG UI Title Screen and Dashboard Menu.
 * Inspired by Genshin Impact, Honkai Star Rail, Solo Leveling & Sword Art Online UI.
 *
 * @param {Object} player - The player object from the database (optional)
 */
async function generateMainMenuImage(player) {
    const width = 1200;
    const height = 750;

    const pName = player?.name ? player.name.toUpperCase() : "HÉRITIER SANS NOM";
    const pClass = player?.class ? player.class.toUpperCase() : "INITIÉ";
    const pRace = player?.race ? player.race.toUpperCase() : "HUMAIN";
    const pRank = player?.rank ? player.rank : "F";
    const pLevel = player?.level ? player.level : 1;
    const pCol = player?.col != null ? player.col : 100;
    const pHealth = player?.health != null ? player.health : 100;
    const pMaxHealth = player?.maxHealth != null ? player.maxHealth : 100;
    const pMana = player?.mana != null ? player.mana : 100;
    const pMaxMana = player?.maxMana != null ? player.maxMana : 100;
    const pLocation = player?.location ? player.location.toUpperCase() : "EMPIRE IMPÉRIAL D'ELION";
    const pSubLocation = player?.subLocation ? player.subLocation.toUpperCase() : "PLACE DU MARCHÉ";

    // Menu Cards Array with Anime/Manga RPG Styling
    const cardsData = [
        {
            cmd: '/action',
            title: 'AVENTURE',
            sub: 'COMBATS & RP',
            icon: '⚔️',
            color: '#ff3c00',
            imagePath: path.join(__dirname, 'assets', 'tutorial_boss.jpg'),
            x: 50,
            y: 280
        },
        {
            cmd: '/dormir',
            title: 'SOMMEIL',
            sub: 'RÉCUPÉRATION',
            icon: '🌙',
            color: '#00a8ff',
            imagePath: path.join(__dirname, 'assets', 'silhouette.jpg'),
            x: 330,
            y: 280
        },
        {
            cmd: '/profil',
            title: 'PROFIL HÉRITIER',
            sub: 'STATS & AURA',
            icon: '❖',
            color: '#00e5ff',
            imagePath: path.join(__dirname, 'assets', 'silhouette.jpg'),
            x: 610,
            y: 280
        },
        {
            cmd: '/quests',
            title: 'QUÊTES',
            sub: 'FIL ROUGE & PRIMES',
            icon: '📜',
            color: '#ffd700',
            imagePath: path.join(__dirname, 'assets', 'locations', 'interstice.jpg'),
            x: 890,
            y: 280
        },
        {
            cmd: '/map',
            title: 'CARTE DU MONDE',
            sub: '17 ROYAUMES ATR',
            icon: '🗺️',
            color: '#00e676',
            imagePath: path.join(__dirname, 'assets', 'locations', 'eldoria.jpg'),
            x: 50,
            y: 490
        },
        {
            cmd: '/boutique',
            title: 'BOUTIQUE',
            sub: 'MARCHÉ & NOURRITURE',
            icon: '🛍️',
            color: '#ff9900',
            imagePath: path.join(__dirname, 'assets', 'apostle.jpg'),
            x: 330,
            y: 490
        },
        {
            cmd: '/bank',
            title: 'BANQUE',
            sub: 'COFFRE-FORT COL',
            icon: '🪙',
            color: '#d500f9',
            imagePath: path.join(__dirname, 'assets', 'locations', 'academy.jpg'),
            x: 610,
            y: 490
        },
        {
            cmd: '/lore',
            title: 'ARCHIVES ATR',
            sub: 'MYTHES & SECRETS',
            icon: '🏛️',
            color: '#b0bec5',
            imagePath: path.join(__dirname, 'assets', 'locations', 'necropolis.jpg'),
            x: 890,
            y: 490
        }
    ];

    const cardWidth = 260;
    const cardHeight = 185;

    // Load card backgrounds
    const processedCards = await Promise.all(cardsData.map(async (card) => {
        let base64Img = '';
        if (fs.existsSync(card.imagePath)) {
            try {
                const buf = await sharp(card.imagePath)
                    .resize(cardWidth, cardHeight, { fit: 'cover' })
                    .linear(0.35, 0)
                    .jpeg({ quality: 80 })
                    .toBuffer();
                base64Img = buf.toString('base64');
            } catch (e) {}
        }
        return { ...card, base64Img };
    }));

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#080612;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#04030a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#010103;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="goldGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffe066;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#ffd700;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ffaa00;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="cyanNeon" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00ffff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0088ff;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="rubyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
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

            ${processedCards.map((_, i) => `
            <clipPath id="clip-card-${i}">
                <rect width="${cardWidth}" height="${cardHeight}" rx="10" />
            </clipPath>
            `).join('')}
        </defs>

        <!-- Obsidian Anime Glass Background -->
        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Diagonal High-Tech Geometry Lines -->
        <g stroke="rgba(0, 255, 255, 0.03)" stroke-width="1">
            ${Array.from({ length: 25 }).map((_, i) => `<line x1="${i * 50 - 100}" y1="0" x2="${i * 50 + 300}" y2="${height}" />`).join('')}
        </g>

        <!-- ==================== HEADER: ANIME RPG GAME LOGO ==================== -->
        <g transform="translate(60, 50)">
            <!-- Diamond Badge Emblem -->
            <polygon points="20,0 40,20 20,40 0,20" fill="none" stroke="url(#goldGlow)" stroke-width="2.5" filter="url(#softGlow)"/>
            <polygon points="20,7 33,20 20,33 7,20" fill="url(#goldGlow)"/>

            <text x="55" y="26" font-family="'Segoe UI', 'Arial Black', sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="3">AFTER THE REBIRTH</text>
            <text x="385" y="26" font-family="monospace" font-size="12" font-weight="bold" fill="url(#goldGlow)" letter-spacing="4" filter="url(#softGlow)">ATR OS v2.0</text>
            <text x="55" y="45" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.4)" letter-spacing="2">SYSTEM DASHBOARD • ANIME RPG INTERFACE</text>

            <line x1="55" y1="56" x2="480" y2="56" stroke="url(#goldGlow)" stroke-width="1.8" opacity="0.8" />
        </g>

        <!-- ==================== PLAYER STATUS ANIME HUD ==================== -->
        <g transform="translate(620, 35)">
            <rect width="530" height="210" fill="rgba(12, 16, 28, 0.85)" stroke="rgba(255, 215, 0, 0.3)" stroke-width="1.5" rx="12" filter="drop-shadow(0 10px 25px rgba(0,0,0,0.8))" />

            <!-- Level Diamond Badge -->
            <g transform="translate(45, 60)">
                <polygon points="0,-26 26,0 0,26 -26,0" fill="rgba(10,5,25,0.9)" stroke="url(#goldGlow)" stroke-width="2" filter="url(#softGlow)"/>
                <text x="0" y="-6" font-family="'Segoe UI', sans-serif" font-size="8" font-weight="900" fill="#ffaa00" text-anchor="middle">LVL</text>
                <text x="0" y="12" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(pLevel)}</text>
            </g>

            <!-- Name, Class, Race -->
            <g transform="translate(90, 45)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="900" fill="#ffffff">${escapeXml(pName)}</text>
                <text x="0" y="18" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#ffd700">❖ ${escapeXml(pClass)} • ${escapeXml(pRace)} | RANG ${escapeXml(pRank)}</text>
            </g>

            <!-- Gauges Section -->
            <g transform="translate(45, 105)">
                <!-- HP Gauge -->
                <text x="0" y="10" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="900" fill="#ff4081">HP ❖</text>
                <text x="440" y="10" font-family="monospace" font-size="10" fill="#ffffff" font-weight="bold" text-anchor="end">${escapeXml(pHealth)} / ${escapeXml(pMaxHealth)}</text>
                <rect x="0" y="16" width="440" height="6" fill="rgba(255,255,255,0.08)" rx="3" />
                <rect x="0" y="16" width="${Math.max(10, Math.min(100, (pHealth / pMaxHealth) * 100)) * 4.4}" height="6" fill="url(#rubyGrad)" rx="3" filter="url(#softGlow)" />

                <!-- MP Gauge -->
                <g transform="translate(0, 32)">
                    <text x="0" y="10" font-family="'Segoe UI', sans-serif" font-size="10" font-weight="900" fill="#00ffff">MP ❖</text>
                    <text x="440" y="10" font-family="monospace" font-size="10" fill="#ffffff" font-weight="bold" text-anchor="end">${escapeXml(pMana)} / ${escapeXml(pMaxMana)}</text>
                    <rect x="0" y="16" width="440" height="6" fill="rgba(255,255,255,0.08)" rx="3" />
                    <rect x="0" y="16" width="${Math.max(10, Math.min(100, (pMana / pMaxMana) * 100)) * 4.4}" height="6" fill="url(#cyanNeon)" rx="3" filter="url(#softGlow)" />
                </g>
            </g>

            <!-- Location & Col Footer -->
            <g transform="translate(45, 188)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#00e676">📍 ${escapeXml(pLocation)} • ${escapeXml(pSubLocation)}</text>
                <text x="440" y="0" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="900" fill="#ffd700" text-anchor="end">🪙 ${escapeXml(pCol.toLocaleString())} COL</text>
            </g>
        </g>

        <!-- ==================== CARDS GRID ==================== -->
        ${processedCards.map((card, i) => `
        <g transform="translate(${card.x}, ${card.y})">
            <g clip-path="url(#clip-card-${i})">
                ${card.base64Img ? `
                <image x="0" y="0" width="${cardWidth}" height="${cardHeight}" xlink:href="data:image/jpeg;base64,${card.base64Img}" />
                ` : `
                <rect width="${cardWidth}" height="${cardHeight}" fill="#0d0b1a" />
                `}
                <rect width="${cardWidth}" height="${cardHeight}" fill="rgba(8, 6, 18, 0.70)" />

                <!-- Card Content -->
                <g transform="translate(20, 25)">
                    <!-- Command Tag -->
                    <rect x="0" y="0" width="85" height="20" fill="rgba(255,255,255,0.12)" rx="4" />
                    <text x="42.5" y="14" font-family="monospace" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(card.cmd)}</text>

                    <!-- Icon & Title -->
                    <text x="0" y="52" font-family="'Segoe UI', sans-serif" font-size="20">${card.icon}</text>
                    <text x="32" y="52" font-family="'Segoe UI', sans-serif" font-size="17" font-weight="900" fill="#ffffff" letter-spacing="1">${escapeXml(card.title)}</text>
                    <text x="0" y="74" font-family="monospace" font-size="10" font-weight="bold" fill="${card.color}">❖ ${escapeXml(card.sub)}</text>
                </g>
            </g>

            <!-- Card Outer Border -->
            <rect width="${cardWidth}" height="${cardHeight}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.2" rx="10" />
            <rect x="0" y="0" width="4" height="${cardHeight}" fill="${card.color}" rx="2" />
        </g>
        `).join('')}

        <!-- Footer -->
        <g transform="translate(60, ${height - 20})">
            <text font-family="monospace" font-size="10" fill="rgba(255,255,255,0.2)" letter-spacing="2">AFTER THE REBIRTH • ANIME RPG OS • ALL SYSTEMS OPERATIONAL</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
