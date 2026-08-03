const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeXml } = require('./utils');

/**
 * Generates a stunning, glowing Adventure Quest Start Poster using SVG and Sharp.
 */
async function generateQuestStartCard(playerName, questTitle, description, colReward, xpReward) {
    const width = 850;
    const height = 450;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="parchment" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#1e140a;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#0d0804;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#050301;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffe066;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#ffd700;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ffaa00;stop-opacity:1" />
            </linearGradient>

            <filter id="glowing" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#parchment)" />

        <!-- Vintage ornate borders -->
        <rect x="25" y="25" width="${width - 50}" height="${height - 50}" fill="none" stroke="url(#goldGrad)" stroke-width="2" opacity="0.8" rx="8" />
        <rect x="35" y="35" width="${width - 70}" height="${height - 70}" fill="none" stroke="url(#goldGrad)" stroke-width="1.2" opacity="0.3" rx="6" />

        <!-- Ornate corners -->
        <path d="M 15,45 L 45,45 L 45,15" fill="none" stroke="#ffd700" stroke-width="2.5" />
        <path d="M ${width - 15},45 L ${width - 45},45 L ${width - 45},15" fill="none" stroke="#ffd700" stroke-width="2.5" />
        <path d="M 15,${height - 45} L 45,${height - 45} L 45,${height - 15}" fill="none" stroke="#ffd700" stroke-width="2.5" />
        <path d="M ${width - 15},${height - 45} L ${width - 45},${height - 45} L ${width - 45},${height - 15}" fill="none" stroke="#ffd700" stroke-width="2.5" />

        <!-- Quest content -->
        <g transform="translate(60, 80)">
            <text x="0" y="32" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffaa00" letter-spacing="4">NOUVELLE MISSION ÉVEILLÉE</text>
            <text x="0" y="80" font-family="'Segoe UI', sans-serif" font-size="38" font-weight="900" fill="#ffffff" letter-spacing="1" style="filter: url(#glowing);">${escapeXml(questTitle.toUpperCase())}</text>

            <line x1="0" y1="110" x2="350" y2="110" stroke="url(#goldGrad)" stroke-width="2" />
            <circle cx="350" cy="110" r="3" fill="#ffd700" />

            <text x="0" y="150" font-family="'Segoe UI', sans-serif" font-size="14.5" fill="rgba(255,255,255,0.7)" font-style="italic">Destinataire : ${escapeXml(playerName)}</text>

            <!-- Description -->
            <g transform="translate(0, 190)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="rgba(255,255,255,0.4)" letter-spacing="2">CHRONIQUE / DEVOIR :</text>
                <text x="0" y="24" font-family="'Segoe UI', sans-serif" font-size="15" fill="#ffffff" width="600">
                    <tspan x="0" dy="0">${escapeXml(description.substring(0, 68))}</tspan>
                    ${description.length > 68 ? `<tspan x="0" dy="22">${escapeXml(description.substring(68, 140))}</tspan>` : ''}
                </text>
            </g>

            <!-- Rewards block -->
            <g transform="translate(520, 160)">
                <rect x="-15" y="-15" width="220" height="150" fill="rgba(255,215,0,0.02)" stroke="url(#goldGrad)" stroke-width="1" opacity="0.4" rx="6" />
                <text x="10" y="20" font-family="monospace" font-size="11" fill="#ffaa00" font-weight="bold" letter-spacing="2">RÉCOMPENSES :</text>

                <text x="10" y="65" font-family="'Segoe UI', sans-serif" font-size="22" font-weight="900" fill="#ffffff">🪙 ${colReward.toLocaleString()}</text>
                <text x="10" y="90" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.4)">PIÈCES COL</text>

                <text x="10" y="125" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="900" fill="#00ffff">✨ +${xpReward.toLocaleString()} XP</text>
            </g>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generates a stunning, glowing Magical Scroll Poster when a skill is Studied/Unlocked.
 */
async function generateSkillScrollCard(playerName, skillName, element, description) {
    const width = 850;
    const height = 450;
    const color = element?.toLowerCase().includes('feu') ? '#ff3c00' : (element?.toLowerCase().includes('eau') ? '#00e5ff' : '#a000ff');

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0d061a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#010103;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
                <stop offset="100%" style="stop-color:#4a00e0;stop-opacity:1" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#bg)" />

        <rect x="25" y="25" width="${width - 50}" height="${height - 50}" fill="none" stroke="${color}" stroke-width="1.8" opacity="0.4" rx="8" />
        <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="url(#neon)" stroke-width="1.5" opacity="0.75" style="filter: url(#glow)" rx="6" />

        <g transform="translate(60, 80)">
            <text x="0" y="32" font-family="monospace" font-size="14" fill="${color}" font-weight="bold" letter-spacing="4">NOUVELLE TECHNIQUE MAÎTRISÉE</text>
            <text x="0" y="80" font-family="'Segoe UI', sans-serif" font-size="38" font-weight="900" fill="#ffffff" letter-spacing="1" style="filter: url(#glow);">${escapeXml(skillName.toUpperCase())}</text>

            <line x1="0" y1="110" x2="350" y2="110" stroke="url(#neon)" stroke-width="2" />
            <circle cx="350" cy="110" r="3" fill="${color}" />

            <text x="0" y="150" font-family="'Segoe UI', sans-serif" font-size="14.5" fill="rgba(255,255,255,0.7)">Éveillé par : ${escapeXml(playerName)}</text>

            <g transform="translate(0, 190)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="rgba(255,255,255,0.4)" letter-spacing="2">EFFETS ET PUISSANCE :</text>
                <text x="0" y="24" font-family="'Segoe UI', sans-serif" font-size="15" fill="#ffffff" width="600">
                    <tspan x="0" dy="0">${escapeXml(description.substring(0, 68))}</tspan>
                    ${description.length > 68 ? `<tspan x="0" dy="22">${escapeXml(description.substring(68, 140))}</tspan>` : ''}
                </text>
            </g>

            <!-- Seal graphic -->
            <g transform="translate(600, 160)" filter="url(#glow)">
                <circle cx="50" cy="50" r="50" fill="none" stroke="url(#neon)" stroke-width="2" opacity="0.8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#neon)" stroke-width="1" stroke-dasharray="5,5" opacity="0.6" />
                <polygon points="50,15 15,80 85,80" fill="none" stroke="url(#neon)" stroke-width="1.5" opacity="0.8" />
                <text x="50" y="55" font-family="monospace" font-size="11" fill="#ffffff" font-weight="bold" text-anchor="middle">${escapeXml((element || 'MAGIC').toUpperCase())}</text>
            </g>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generates a gorgeous panoramic travel route postcard when traveling to a new kingdom or location.
 */
async function generateTravelPostcard(playerName, sourceLocation, destLocation, distance) {
    const width = 850;
    const height = 450;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#0b1326;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#03050a;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00e676;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0088ff;stop-opacity:1" />
            </linearGradient>

            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#sky)" />

        <rect x="25" y="25" width="${width - 50}" height="${height - 50}" fill="none" stroke="url(#accent)" stroke-width="1.8" opacity="0.4" rx="8" />
        <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="url(#accent)" stroke-width="1.2" opacity="0.2" rx="6" />

        <g transform="translate(60, 80)">
            <text x="0" y="32" font-family="monospace" font-size="14" fill="#00e676" font-weight="bold" letter-spacing="4">RAPPORT DE DÉPLACEMENT</text>
            <text x="0" y="80" font-family="'Segoe UI', sans-serif" font-size="38" font-weight="900" fill="#ffffff" letter-spacing="1" style="filter: url(#softGlow);">VOYAGE EN COURS</text>

            <line x1="0" y1="110" x2="350" y2="110" stroke="url(#accent)" stroke-width="2" />
            <circle cx="350" cy="110" r="3" fill="#00e676" />

            <!-- Route Info -->
            <g transform="translate(0, 160)">
                <text x="0" y="0" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.4)" letter-spacing="2">TRAJET :</text>

                <text x="0" y="35" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${escapeXml(sourceLocation.toUpperCase())}</text>
                <text x="0" y="60" font-family="'Segoe UI', sans-serif" font-size="13" fill="rgba(255,255,255,0.5)">Point de départ</text>

                <!-- Travel arrow -->
                <g transform="translate(260, 20)" filter="url(#softGlow)">
                    <line x1="0" y1="15" x2="100" y2="15" stroke="#00e676" stroke-width="2" stroke-dasharray="5,5" />
                    <polygon points="100,15 90,10 90,20" fill="#00e676" />
                </g>

                <text x="390" y="35" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="bold" fill="#00e676" style="filter: url(#softGlow);">${escapeXml(destLocation.toUpperCase())}</text>
                <text x="390" y="60" font-family="'Segoe UI', sans-serif" font-size="13" fill="rgba(255,255,255,0.5)">Destination d'arrivée</text>
            </g>

            <text x="0" y="290" font-family="'Segoe UI', sans-serif" font-size="14.5" fill="rgba(255,255,255,0.7)">Héritier en transit : ${escapeXml(playerName)}</text>

            <!-- Distance display -->
            <g transform="translate(560, 160)">
                <rect x="-15" y="-15" width="180" height="130" fill="rgba(0,230,118,0.02)" stroke="url(#accent)" stroke-width="1" opacity="0.4" rx="6" />
                <text x="10" y="20" font-family="monospace" font-size="11" fill="#00e676" font-weight="bold" letter-spacing="2">DISTANCE :</text>

                <text x="10" y="65" font-family="'Segoe UI', sans-serif" font-size="26" font-weight="900" fill="#ffffff">${distance.toLocaleString()} m</text>
                <text x="10" y="90" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.4)">METRES PARCOURUS</text>
            </g>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateQuestStartCard, generateSkillScrollCard, generateTravelPostcard };
