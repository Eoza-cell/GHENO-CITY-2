const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeXml } = require('./utils');

/**
 * Generates an ultra-clean, minimalist title screen & dashboard for ATR Bot.
 * Sleek, high-contrast, obsidian dark mode with subtle neon cyan & gold accents.
 *
 * @param {Object} player - The player object from the database (optional)
 */
async function generateMainMenuImage(player) {
    const width = 1200;
    const height = 720;

    const pName = player?.name ? player.name.toUpperCase() : "HÉRITIER SANS NOM";
    const pClass = player?.class ? player.class.toUpperCase() : "INITIÉ";
    const pRank = player?.rank ? player.rank : "F";
    const pLevel = player?.level ? player.level : 1;
    const pCol = player?.col != null ? player.col : 100;
    const pLocation = player?.location ? player.location.toUpperCase() : "EMPIRE D'ELION";

    // Clean Minimalist Cards Data
    const cardWidth = 260;
    const cardHeight = 180;

    const cardsData = [
        {
            cmd: '/action',
            title: 'AVENTURE',
            sub: 'COMBAT & RP',
            icon: '⚔️',
            color: '#ff3c00',
            x: 50,
            y: 280
        },
        {
            cmd: '/dormir',
            title: 'SOMMEIL',
            sub: 'RÉCUPÉRATION',
            icon: '🌙',
            color: '#00a8ff',
            x: 330,
            y: 280
        },
        {
            cmd: '/profil',
            title: 'PROFIL',
            sub: 'FICHE & STATS',
            icon: '❖',
            color: '#00e5ff',
            x: 610,
            y: 280
        },
        {
            cmd: '/quests',
            title: 'QUÊTES',
            sub: 'JOURNAL ACTIVE',
            icon: '📜',
            color: '#ffd700',
            x: 890,
            y: 280
        },
        {
            cmd: '/map',
            title: 'CARTE',
            sub: '17 ROYAUMES',
            icon: '🗺️',
            color: '#00e676',
            x: 50,
            y: 480
        },
        {
            cmd: '/boutique',
            title: 'BOUTIQUE',
            sub: 'MARCHÉ & ÉQUIP.',
            icon: '🛍️',
            color: '#ff9900',
            x: 330,
            y: 480
        },
        {
            cmd: '/bank',
            title: 'BANQUE',
            sub: 'GÉRER LES COLS',
            icon: '🪙',
            color: '#d500f9',
            x: 610,
            y: 480
        },
        {
            cmd: '/lore',
            title: 'ARCHIVES',
            sub: 'LORE & MYTHES',
            icon: '🏛️',
            color: '#b0bec5',
            x: 890,
            y: 480
        }
    ];

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#06080e;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#020306;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="cyanNeon" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00ffff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0088ff;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="goldGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ffaa00;stop-opacity:1" />
            </linearGradient>

            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <!-- Obsidian Background -->
        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Minimalist Diamond Grid Accent -->
        <g stroke="rgba(255, 255, 255, 0.02)" stroke-width="1">
            ${Array.from({ length: 20 }).map((_, i) => `<line x1="${i * 70}" y1="0" x2="${i * 70}" y2="${height}" />`).join('')}
            ${Array.from({ length: 12 }).map((_, i) => `<line x1="0" y1="${i * 70}" x2="${width}" y2="${i * 70}" />`).join('')}
        </g>

        <!-- ==================== MINIMALIST TITLE SCREEN ==================== -->
        <g transform="translate(60, 65)">
            <!-- Diamond Icon -->
            <polygon points="16,0 32,16 16,32 0,16" fill="url(#goldGlow)" filter="url(#softGlow)"/>

            <text x="48" y="22" font-family="'Segoe UI', 'Helvetica', sans-serif" font-size="32" font-weight="900" fill="#ffffff" letter-spacing="4">AFTER THE REBIRTH</text>
            <text x="48" y="44" font-family="monospace" font-size="11" fill="url(#cyanNeon)" letter-spacing="3">ATR BOT • MINIMALIST SYSTEM DASHBOARD</text>

            <line x1="48" y1="56" x2="480" y2="56" stroke="url(#goldGlow)" stroke-width="1.5" opacity="0.8" />
        </g>

        <!-- Player Minimalist Status Badge -->
        <g transform="translate(750, 55)">
            <rect width="390" height="150" fill="rgba(12, 16, 25, 0.75)" stroke="rgba(0, 255, 255, 0.2)" stroke-width="1" rx="8" />

            <g transform="translate(25, 35)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="900" fill="#ffffff">${escapeXml(pName)}</text>
                <text x="0" y="20" font-family="'Segoe UI', sans-serif" font-size="12" font-weight="bold" fill="#ffd700">LVL ${escapeXml(pLevel)} • RANG ${escapeXml(pRank)} | ${escapeXml(pClass)}</text>

                <text x="0" y="55" font-family="'Segoe UI', sans-serif" font-size="11" fill="rgba(255,255,255,0.6)">📍 ${escapeXml(pLocation)}</text>
                <text x="0" y="75" font-family="monospace" font-size="13" font-weight="900" fill="#00e676">🪙 ${escapeXml(pCol.toLocaleString())} COL</text>
            </g>
        </g>

        <!-- ==================== DASHBOARD GRID CARDS ==================== -->
        ${cardsData.map((card) => `
        <g transform="translate(${card.x}, ${card.y})">
            <!-- Glassmorphic Card Background -->
            <rect width="${cardWidth}" height="${cardHeight}" fill="rgba(14, 18, 28, 0.85)" stroke="rgba(255,255,255,0.08)" stroke-width="1" rx="8" />

            <!-- Minimalist Accent Line -->
            <rect x="0" y="0" width="4" height="${cardHeight}" fill="${card.color}" rx="2" />

            <!-- Card Contents -->
            <g transform="translate(25, 30)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="22">${card.icon}</text>

                <text x="0" y="38" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="900" fill="#ffffff" letter-spacing="1">${escapeXml(card.title)}</text>
                <text x="0" y="58" font-family="monospace" font-size="10" font-weight="bold" fill="${card.color}">${escapeXml(card.sub)}</text>

                <!-- Command Tag -->
                <rect x="0" y="85" width="110" height="22" fill="rgba(255,255,255,0.05)" rx="4" />
                <text x="55" y="100" font-family="monospace" font-size="10" font-weight="bold" fill="#00e5ff" text-anchor="middle">${escapeXml(card.cmd)}</text>
            </g>
        </g>
        `).join('')}

        <!-- Footer -->
        <g transform="translate(60, ${height - 25})">
            <text font-family="monospace" font-size="10" fill="rgba(255,255,255,0.2)" letter-spacing="2">ATR BOT SYSTEM • VERSION 2.0 • ALL SYSTEMS OPERATIONAL</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateMainMenuImage };
