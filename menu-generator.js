const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeXml } = require('./utils');

/**
 * Generates the ATR OS dashboard: an obsidian anime-RPG command deck with
 * glass navigation cards, an XP rail and a rank aura.
 *
 * @param {Object} player - The player object from the database (optional)
 */
async function generateMainMenuImage(player) {
    const width = 1200;
    const height = 750;

    const pName = player?.name ? player.name.toUpperCase() : "HÉRITIER SANS NOM";
    const pClass = player?.class && player.class !== 'Aucune' ? player.class.toUpperCase() : 'INITIÉ';
    const pRank = player?.rank ? String(player.rank) : "F";
    const pLevel = player?.level != null ? player.level : 1;
    const pXp = player?.xp != null ? player.xp : 0;
    const pCol = player?.col != null ? player.col : 100;
    const pLocation = player?.location ? player.location.toUpperCase() : "EMPIRE IMPÉRIAL D'ELION";

    // Rank aura palette (F → SS)
    const RANK_COLORS = {
        F: '#8d99ae', E: '#00e676', D: '#00e5ff', C: '#448aff',
        B: '#bf00ff', A: '#ff6d00', S: '#ffd700', SS: '#ff1744'
    };
    const rankColor = RANK_COLORS[pRank] || '#ffd700';

    // XP curve: need(level) grows quadratically; bar = xp / need
    const xpNeed = Math.max(100, Math.round(100 * Math.pow(Number(pLevel), 1.6)));
    const xpRatio = Math.max(0, Math.min(1, pXp / xpNeed));
    const xpBarWidth = Math.round(250 * xpRatio);

    const cardsData = [
        { cmd: '/action', title: 'AVENTURE', sub: 'COMBATS & RP', icon: '⚔', color: '#ff3c00', glow: '#ff6a3d', imagePath: path.join(__dirname, 'assets', 'tutorial_boss.jpg'), x: 50, y: 262 },
        { cmd: '/dormir', title: 'SOMMEIL', sub: 'RÉCUPÉRATION', icon: '☾', color: '#00a8ff', glow: '#4fd2ff', imagePath: path.join(__dirname, 'assets', 'silhouette.jpg'), x: 330, y: 262 },
        { cmd: '/profil', title: 'PROFIL', sub: 'STATS & AURA', icon: '❖', color: '#00e5ff', glow: '#7df9ff', imagePath: path.join(__dirname, 'assets', 'silhouette.jpg'), x: 610, y: 262 },
        { cmd: '/quests', title: 'QUÊTES', sub: 'FIL ROUGE & PRIMES', icon: '✦', color: '#ffd700', glow: '#fff0a0', imagePath: path.join(__dirname, 'assets', 'locations', 'interstice.jpg'), x: 890, y: 262 },
        { cmd: '/map', title: 'CARTE DU MONDE', sub: '17 ROYAUMES ATR', icon: '◈', color: '#00e676', glow: '#7dffc4', imagePath: path.join(__dirname, 'assets', 'locations', 'eldoria.jpg'), x: 50, y: 472 },
        { cmd: '/boutique', title: 'BOUTIQUE', sub: 'MARCHÉ & NOURRITURE', icon: '◉', color: '#ff9900', glow: '#ffc266', imagePath: path.join(__dirname, 'assets', 'apostle.jpg'), x: 330, y: 472 },
        { cmd: '/bank', title: 'BANQUE', sub: 'COFFRE-FORT COL', icon: '◆', color: '#d500f9', glow: '#e97bff', imagePath: path.join(__dirname, 'assets', 'locations', 'academy.jpg'), x: 610, y: 472 },
        { cmd: '/lore', title: 'ARCHIVES ATR', sub: 'MYTHES & SECRETS', icon: '❖', color: '#b0bec5', glow: '#e0e6ea', imagePath: path.join(__dirname, 'assets', 'locations', 'necropolis.jpg'), x: 890, y: 472 }
    ];

    const cardWidth = 260;
    const cardHeight = 190;

    const processedCards = await Promise.all(cardsData.map(async (card) => {
        let base64Img = '';
        if (fs.existsSync(card.imagePath)) {
            try {
                const buf = await sharp(card.imagePath)
                    .resize(cardWidth, cardHeight, { fit: 'cover' })
                    .linear(0.5, -18)
                    .modulate({ saturation: 1.15 })
                    .jpeg({ quality: 82 })
                    .toBuffer();
                base64Img = buf.toString('base64');
            } catch (e) {}
        }
        return { ...card, base64Img };
    }));

    const starField = Array.from({ length: 90 }).map((_, i) => {
        const x = (i * 137.508) % width;
        const y = (i * 71.317) % height;
        const r = 0.5 + ((i * 13) % 7) / 10;
        const o = 0.08 + ((i * 29) % 40) / 130;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#ffffff" opacity="${o.toFixed(2)}"/>`;
    }).join('');

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0d0a1f;stop-opacity:1" />
                <stop offset="45%" style="stop-color:#070514;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#020106;stop-opacity:1" />
            </linearGradient>

            <radialGradient id="auraCyan" cx="18%" cy="12%" r="55%">
                <stop offset="0%" style="stop-color:#00e5ff;stop-opacity:0.20" />
                <stop offset="100%" style="stop-color:#00e5ff;stop-opacity:0" />
            </radialGradient>

            <radialGradient id="auraGold" cx="88%" cy="88%" r="55%">
                <stop offset="0%" style="stop-color:#ffaa00;stop-opacity:0.16" />
                <stop offset="100%" style="stop-color:#ffaa00;stop-opacity:0" />
            </radialGradient>

            <linearGradient id="goldGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffe066" />
                <stop offset="50%" style="stop-color:#ffd700" />
                <stop offset="100%" style="stop-color:#ffaa00" />
            </linearGradient>

            <linearGradient id="xpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00e5ff" />
                <stop offset="60%" style="stop-color:#7c4dff" />
                <stop offset="100%" style="stop-color:#ffd700" />
            </linearGradient>

            <linearGradient id="glassSheen" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.10" />
                <stop offset="45%" style="stop-color:#ffffff;stop-opacity:0.02" />
                <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0" />
            </linearGradient>

            <linearGradient id="cardFade" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#05030f;stop-opacity:0.55" />
                <stop offset="55%" style="stop-color:#05030f;stop-opacity:0.80" />
                <stop offset="100%" style="stop-color:#030208;stop-opacity:0.95" />
            </linearGradient>

            <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>

            <filter id="tightGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="2.4" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>

            <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="170%">
                <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.75" />
            </filter>

            <filter id="noise">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
                <feColorMatrix in="n" type="saturate" values="0" />
            </filter>

            <clipPath id="screen"><rect width="${width}" height="${height}" rx="18" /></clipPath>
            ${processedCards.map((_, i) => `<clipPath id="clip-card-${i}"><rect width="${cardWidth}" height="${cardHeight}" rx="12" /></clipPath>`).join('')}
        </defs>

        <g clip-path="url(#screen)">
            <!-- Base layers -->
            <rect width="100%" height="100%" fill="url(#bgGrad)" />
            <rect width="100%" height="100%" fill="url(#auraCyan)" />
            <rect width="100%" height="100%" fill="url(#auraGold)" />

            <!-- Grid floor -->
            <g stroke="#4de8ff" stroke-opacity="0.05" stroke-width="1">
                ${Array.from({ length: 30 }).map((_, i) => `<line x1="${i * 50 - 150}" y1="0" x2="${i * 50 + 250}" y2="${height}" />`).join('')}
                ${Array.from({ length: 16 }).map((_, i) => `<line x1="0" y1="${i * 55}" x2="${width}" y2="${i * 55}" />`).join('')}
            </g>

            <!-- Starfield -->
            <g>${starField}</g>

            <!-- Grain -->
            <rect width="100%" height="100%" filter="url(#noise)" opacity="0.035" />

            <!-- ==================== HEADER ==================== -->
            <g transform="translate(60, 52)">
                <polygon points="22,0 44,22 22,44 0,22" fill="#0a0620" stroke="url(#goldGlow)" stroke-width="2.5" filter="url(#softGlow)" />
                <polygon points="22,8 36,22 22,36 8,22" fill="url(#goldGlow)" />

                <text x="62" y="28" font-family="'Segoe UI', 'Arial Black', sans-serif" font-size="32" font-weight="900" fill="#ffffff" letter-spacing="4" filter="url(#softGlow)">AFTER THE REBIRTH</text>
                <text x="66" y="48" font-family="monospace" font-size="10" fill="#7de8ff" opacity="0.75" letter-spacing="3">ATR OS v2.0 • SYSTÈME EN LIGNE</text>

                <line x1="62" y1="60" x2="600" y2="60" stroke="url(#goldGlow)" stroke-width="1.6" opacity="0.65" />
                <text x="612" y="30" font-family="monospace" font-size="12" font-weight="bold" fill="url(#goldGlow)" letter-spacing="3" filter="url(#softGlow)">ATR</text>
            </g>

            <!-- ==================== PLAYER PANEL ==================== -->
            <g transform="translate(700, 44)" filter="url(#cardShadow)">
                <rect width="440" height="132" rx="14" fill="rgba(10, 14, 28, 0.86)" stroke="rgba(0, 229, 255, 0.28)" stroke-width="1.4" />
                <rect width="440" height="132" rx="14" fill="url(#glassSheen)" />
                <rect x="0" y="0" width="5" height="132" rx="2.5" fill="url(#goldGlow)" />

                <!-- Level diamond -->
                <g transform="translate(52, 66)">
                    <polygon points="0,-30 30,0 0,30 -30,0" fill="#0b0722" stroke="${rankColor}" stroke-width="2.4" filter="url(#softGlow)" />
                    <polygon points="0,-22 22,0 0,22 -22,0" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1" />
                    <text x="0" y="-4" font-family="'Segoe UI', sans-serif" font-size="8" font-weight="900" fill="${rankColor}" text-anchor="middle" letter-spacing="2">LVL</text>
                    <text x="0" y="15" font-family="'Segoe UI', sans-serif" font-size="19" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(pLevel)}</text>
                </g>

                <!-- Identity -->
                <g transform="translate(98, 34)">
                    <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="19" font-weight="900" fill="#ffffff" letter-spacing="1">${escapeXml(pName)}</text>

                    <!-- Rank chip -->
                    <g transform="translate(0, 10)">
                        <rect x="0" y="0" width="74" height="19" rx="9.5" fill="rgba(255,255,255,0.08)" stroke="${rankColor}" stroke-width="1.2" />
                        <text x="37" y="13.5" font-family="monospace" font-size="10" font-weight="bold" fill="${rankColor}" text-anchor="middle" letter-spacing="1">RANG ${escapeXml(pRank)}</text>
                    </g>
                    <text x="84" y="24" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#c9b6ff" letter-spacing="1">${escapeXml(pClass)}</text>

                    <!-- Location + col -->
                    <text x="0" y="46" font-family="'Segoe UI', sans-serif" font-size="11" fill="#8fb6c9">◈ ${escapeXml(pLocation)}</text>
                    <text x="300" y="46" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="bold" fill="#ffd700" text-anchor="end">◆ ${escapeXml(Number(pCol).toLocaleString('fr-FR'))} COL</text>

                    <!-- XP rail -->
                    <g transform="translate(0, 58)">
                        <rect x="0" y="0" width="250" height="8" rx="4" fill="rgba(255,255,255,0.07)" />
                        <rect x="0" y="0" width="${xpBarWidth}" height="8" rx="4" fill="url(#xpGrad)" filter="url(#tightGlow)" />
                        <text x="258" y="8" font-family="monospace" font-size="9" fill="#7de8ff" opacity="0.8">XP ${escapeXml(pXp)} / ${escapeXml(xpNeed)}</text>
                    </g>
                </g>
            </g>

            <!-- ==================== CARD GRID ==================== -->
            ${processedCards.map((card, i) => `
            <g transform="translate(${card.x}, ${card.y})" filter="url(#cardShadow)">
                <g clip-path="url(#clip-card-${i})">
                    ${card.base64Img ? `<image x="0" y="0" width="${cardWidth}" height="${cardHeight}" xlink:href="data:image/jpeg;base64,${card.base64Img}" />` : `<rect width="${cardWidth}" height="${cardHeight}" fill="#0d0b1a" />`}
                    <rect width="${cardWidth}" height="${cardHeight}" fill="url(#cardFade)" />

                    <!-- Icon medallion -->
                    <g transform="translate(${cardWidth - 52}, 46)">
                        <circle cx="0" cy="0" r="26" fill="rgba(5,3,15,0.75)" stroke="${card.glow}" stroke-width="1.6" filter="url(#tightGlow)" />
                        <circle cx="0" cy="0" r="20" fill="none" stroke="${card.glow}" stroke-width="0.8" opacity="0.4" />
                        <text x="0" y="9" font-family="'Segoe UI', sans-serif" font-size="22" font-weight="900" fill="${card.glow}" text-anchor="middle">${card.icon}</text>
                    </g>

                    <g transform="translate(20, 26)">
                        <rect x="0" y="0" width="92" height="22" rx="5" fill="rgba(255,255,255,0.14)" stroke="${card.color}" stroke-width="0.9" />
                        <text x="46" y="15" font-family="monospace" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(card.cmd)}</text>

                        <text x="0" y="62" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="900" fill="#ffffff" letter-spacing="1">${escapeXml(card.title)}</text>
                        <text x="0" y="86" font-family="monospace" font-size="10" font-weight="bold" fill="${card.color}" letter-spacing="1">❖ ${escapeXml(card.sub)}</text>
                        <text x="0" y="108" font-family="monospace" font-size="9" fill="rgba(255,255,255,0.28)" letter-spacing="2">EXÉCUTER ▸</text>
                    </g>
                </g>

                <rect width="${cardWidth}" height="${cardHeight}" rx="12" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.2" />
                <rect x="0" y="0" width="4" height="${cardHeight}" rx="2" fill="${card.color}" filter="url(#tightGlow)" />
                <path d="M ${cardWidth - 34} 0 L ${cardWidth} 0 L ${cardWidth} 34" fill="none" stroke="${card.glow}" stroke-width="1.4" opacity="0.7" />
            </g>
            `).join('')}

            <!-- ==================== FOOTER ==================== -->
            <g transform="translate(60, ${height - 26})">
                <text font-family="monospace" font-size="10" fill="rgba(255,255,255,0.28)" letter-spacing="2">AFTER THE REBIRTH • ATR OS • TOUS LES SYSTÈMES OPÉRATIONNELS</text>
            </g>
            <g transform="translate(${width - 60}, ${height - 26})">
                <text text-anchor="end" font-family="monospace" font-size="10" fill="${rankColor}" letter-spacing="2" filter="url(#tightGlow)">◆ ${escapeXml(pRank)} — ${escapeXml(pName)}</text>
            </g>
        </g>

        <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="18" fill="none" stroke="url(#goldGlow)" stroke-width="1.6" opacity="0.45" />
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
