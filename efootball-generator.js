const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Generates an ultra-hd glassmorphic eFootball player card.
 * @param {object} p FootballPlayer instance
 */
async function generatePlayerCard(p) {
    const width = 640;
    const height = 900;

    // Resolve card styling colors based on Card Type
    let cardBgStart = '#180436';
    let cardBgMid = '#0c021f';
    let cardBgEnd = '#03000a';
    let strokeColor = '#9d8eff';
    let typeLabel = p.cardType || 'Epic';

    if (typeLabel.toLowerCase() === 'big time') {
        cardBgStart = '#4d001e';
        cardBgMid = '#24000b';
        cardBgEnd = '#080003';
        strokeColor = '#ff2b6d';
    } else if (typeLabel.toLowerCase() === 'show time') {
        cardBgStart = '#023835';
        cardBgMid = '#011c1a';
        cardBgEnd = '#000808';
        strokeColor = '#00ffe1';
    } else if (typeLabel.toLowerCase() === 'epic') {
        cardBgStart = '#3b2600';
        cardBgMid = '#1c1300';
        cardBgEnd = '#080500';
        strokeColor = '#ffc800';
    } else if (typeLabel.toLowerCase() === 'highlight') {
        cardBgStart = '#002554';
        cardBgMid = '#00112b';
        cardBgEnd = '#00040d';
        strokeColor = '#0095ff';
    } else if (typeLabel.toLowerCase() === 'legend') {
        cardBgStart = '#2b0052';
        cardBgMid = '#130029';
        cardBgEnd = '#04000d';
        strokeColor = '#d24eff';
    }

    const watermarkPath = path.join(__dirname, 'assets/efootball/arise_watermark.png');
    let watermarkBase64 = '';
    if (fs.existsSync(watermarkPath)) {
        const watermarkBuffer = fs.readFileSync(watermarkPath);
        watermarkBase64 = `data:image/png;base64,${watermarkBuffer.toString('base64')}`;
    }

    // Load the cropped player image if exists
    let playerImageBase64 = '';
    if (p.imagePath && fs.existsSync(p.imagePath)) {
        const playerBuffer = await sharp(p.imagePath)
            .resize(360, 360, { fit: 'inside' })
            .toBuffer();
        playerImageBase64 = `data:image/png;base64,${playerBuffer.toString('base64')}`;
    }

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${cardBgStart};stop-opacity:1" />
                <stop offset="50%" style="stop-color:${cardBgMid};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${cardBgEnd};stop-opacity:1" />
            </linearGradient>
            <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${strokeColor};stop-opacity:1" />
                <stop offset="50%" style="stop-color:#ffffff;stop-opacity:0.8" />
                <stop offset="100%" style="stop-color:${strokeColor};stop-opacity:1" />
            </linearGradient>
            <linearGradient id="goldBadge" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ef4444;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:${strokeColor};stop-opacity:0.25" />
                <stop offset="100%" style="stop-color:${strokeColor};stop-opacity:0.05" />
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        <!-- Outer Authentic eFootball Card Shape -->
        <rect width="${width}" height="${height}" fill="url(#bgGrad)" rx="36" />
        <rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="30" fill="none" stroke="url(#glowGrad)" stroke-width="5" filter="url(#neonGlow)" />

        <!-- Top Header: Official eFOOTBALL Logo Tag & Card Type -->
        <rect x="25" y="25" width="180" height="34" rx="8" fill="rgba(0, 0, 0, 0.8)" stroke="${strokeColor}" stroke-width="1.5" />
        <text x="115" y="47" font-family="'Impact', 'Arial Black', sans-serif" font-size="16" fill="#38bdf8" text-anchor="middle" letter-spacing="1">eFOOTBALL DB</text>

        <rect x="${width - 185}" y="25" width="160" height="34" rx="8" fill="rgba(0, 0, 0, 0.8)" stroke="${strokeColor}" stroke-width="1.5" />
        <text x="${width - 105}" y="47" font-family="'Impact', 'Arial Black', sans-serif" font-size="16" fill="#ffd700" text-anchor="middle" letter-spacing="1">${typeLabel.toUpperCase()}</text>

        <!-- Top-Left Player Rating & Position Capsule -->
        <g transform="translate(35, 80)">
            <circle cx="50" cy="50" r="45" fill="url(#goldBadge)" stroke="#ffffff" stroke-width="3" />
            <text x="50" y="60" font-family="'Impact', 'Arial Black', sans-serif" font-size="46" fill="#ffffff" text-anchor="middle" font-weight="900">${p.rating}</text>

            <rect x="10" y="102" width="80" height="30" rx="8" fill="rgba(0,0,0,0.85)" stroke="${strokeColor}" stroke-width="2" />
            <text x="50" y="123" font-family="'Arial Black', sans-serif" font-size="18" fill="${strokeColor}" text-anchor="middle" font-weight="900">${p.position}</text>
        </g>

        <!-- Player Portrait Cutout or Silhouette -->
        ${playerImageBase64 ? `
            <image href="${playerImageBase64}" x="140" y="110" width="360" height="360" />
        ` : `
            <g transform="translate(320, 270)" opacity="0.9">
                <circle r="110" fill="rgba(255,255,255,0.05)" stroke="${strokeColor}" stroke-width="2" />
                <path d="M -50 -30 L 0 -80 L 50 -30 L 30 40 L -30 40 Z" fill="none" stroke="${strokeColor}" stroke-width="3" />
                <text y="10" font-family="'Arial Black', sans-serif" font-size="28" fill="#ffffff" text-anchor="middle" font-weight="900">${p.position}</text>
            </g>
        `}

        <!-- Player Main Banner Info -->
        <g transform="translate(320, 480)">
            <rect x="-260" y="-15" width="520" height="65" rx="14" fill="rgba(0, 0, 0, 0.85)" stroke="${strokeColor}" stroke-width="2" />
            <text y="28" font-family="'Impact', 'Arial Black', sans-serif" font-size="36" fill="#ffffff" text-anchor="middle" letter-spacing="1">${p.name.toUpperCase()}</text>
            <text y="75" font-family="'Arial', sans-serif" font-size="20" fill="${strokeColor}" font-weight="bold" text-anchor="middle">${p.club} • ${p.country}</text>
        </g>

        <!-- Detailed Stat Pills Section (6 Key Attributes) -->
        <g transform="translate(40, 595)">
            <!-- Speed (VIT) -->
            <g transform="translate(0, 0)">
                <rect width="85" height="90" rx="14" fill="url(#badgeGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
                <text x="42.5" y="30" font-family="'Arial Black', sans-serif" font-size="15" fill="rgba(255,255,255,0.7)" text-anchor="middle">VIT</text>
                <text x="42.5" y="70" font-family="'Impact', sans-serif" font-size="32" fill="#38bdf8" text-anchor="middle">${p.speed}</text>
            </g>

            <!-- Dribbling (DRI) -->
            <g transform="translate(95, 0)">
                <rect width="85" height="90" rx="14" fill="url(#badgeGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
                <text x="42.5" y="30" font-family="'Arial Black', sans-serif" font-size="15" fill="rgba(255,255,255,0.7)" text-anchor="middle">DRI</text>
                <text x="42.5" y="70" font-family="'Impact', sans-serif" font-size="32" fill="#38bdf8" text-anchor="middle">${p.dribbling}</text>
            </g>

            <!-- Shooting (TIR) -->
            <g transform="translate(190, 0)">
                <rect width="85" height="90" rx="14" fill="url(#badgeGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
                <text x="42.5" y="30" font-family="'Arial Black', sans-serif" font-size="15" fill="rgba(255,255,255,0.7)" text-anchor="middle">TIR</text>
                <text x="42.5" y="70" font-family="'Impact', sans-serif" font-size="32" fill="#38bdf8" text-anchor="middle">${p.shooting}</text>
            </g>

            <!-- Passing (PAS) -->
            <g transform="translate(285, 0)">
                <rect width="85" height="90" rx="14" fill="url(#badgeGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
                <text x="42.5" y="30" font-family="'Arial Black', sans-serif" font-size="15" fill="rgba(255,255,255,0.7)" text-anchor="middle">PAS</text>
                <text x="42.5" y="70" font-family="'Impact', sans-serif" font-size="32" fill="#38bdf8" text-anchor="middle">${p.passing}</text>
            </g>

            <!-- Defense (DEF) -->
            <g transform="translate(380, 0)">
                <rect width="85" height="90" rx="14" fill="url(#badgeGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
                <text x="42.5" y="30" font-family="'Arial Black', sans-serif" font-size="15" fill="rgba(255,255,255,0.7)" text-anchor="middle">DEF</text>
                <text x="42.5" y="70" font-family="'Impact', sans-serif" font-size="32" fill="#38bdf8" text-anchor="middle">${p.defense}</text>
            </g>

            <!-- Physical (PHY) -->
            <g transform="translate(475, 0)">
                <rect width="85" height="90" rx="14" fill="url(#badgeGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
                <text x="42.5" y="30" font-family="'Arial Black', sans-serif" font-size="15" fill="rgba(255,255,255,0.7)" text-anchor="middle">PHY</text>
                <text x="42.5" y="70" font-family="'Impact', sans-serif" font-size="32" fill="#38bdf8" text-anchor="middle">${p.physical}</text>
            </g>
        </g>

        <!-- Bottom Footer Watermark (ARISE eFootball) -->
        <rect x="0" y="${height - 50}" width="${width}" height="50" fill="rgba(0, 0, 0, 0.95)" />
        ${watermarkBase64 ? `
            <image href="${watermarkBase64}" x="190" y="${height - 48}" width="260" height="45" opacity="0.9" />
        ` : `
            <text x="25" y="${height - 18}" fill="#38bdf8" font-size="14" font-family="sans-serif" font-weight="bold">⚡ ARISE eFootball League</text>
            <text x="${width - 25}" y="${height - 18}" fill="#ffd700" font-size="13" font-family="sans-serif" text-anchor="end">Official eFootballdb Card</text>
        `}
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generates an elegant stats card for a user's local league performance.
 */
async function generateUserStatsCard(u) {
    const width = 850;
    const height = 540;

    const watermarkPath = path.join(__dirname, 'assets/efootball/arise_watermark.png');
    let watermarkBase64 = '';
    if (fs.existsSync(watermarkPath)) {
        const watermarkBuffer = fs.readFileSync(watermarkPath);
        watermarkBase64 = `data:image/png;base64,${watermarkBuffer.toString('base64')}`;
    }

    const totalGames = (u.wins || 0) + (u.draws || 0) + (u.losses || 0);

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#0f0b29;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#03020a;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00f0ff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#7000ff;stop-opacity:1" />
            </linearGradient>
        </defs>

        <rect width="${width}" height="${height}" fill="url(#bgGrad)" rx="24" />
        <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="18" fill="none" stroke="url(#accentGrad)" stroke-width="3" />

        ${watermarkBase64 ? `
            <image href="${watermarkBase64}" x="550" y="420" width="250" height="80" opacity="0.75" />
        ` : `
            <text x="680" y="460" font-family="'Impact', Arial" font-size="36" fill="rgba(255,255,255,0.2)" text-anchor="middle" letter-spacing="6">ARISE</text>
        `}

        <g transform="translate(55, 75)">
            <text font-family="'Arial Black', sans-serif" font-size="34" fill="#ffffff" font-weight="900">PROFIL COMPÉTITEUR eFOOTBALL</text>
            <text y="38" font-family="'Arial', sans-serif" font-size="22" fill="#00f0ff" font-weight="bold">${u.name}</text>

            <g transform="translate(0, 110)">
                <!-- Wins -->
                <g transform="translate(0, 0)">
                    <rect width="140" height="130" rx="14" fill="rgba(0, 240, 255, 0.06)" stroke="rgba(0, 240, 255, 0.3)" stroke-width="1.5" />
                    <text x="70" y="52" font-family="'Arial Black', sans-serif" font-size="15" fill="#00f0ff" text-anchor="middle">VICTOIRES</text>
                    <text x="70" y="106" font-family="'Arial Black', sans-serif" font-size="48" fill="#ffffff" text-anchor="middle" font-weight="900">${u.wins}</text>
                </g>

                <!-- Draws -->
                <g transform="translate(170, 0)">
                    <rect width="140" height="130" rx="14" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.3)" stroke-width="1.5" />
                    <text x="70" y="52" font-family="'Arial Black', sans-serif" font-size="15" fill="#bbbbbb" text-anchor="middle">NULS</text>
                    <text x="70" y="106" font-family="'Arial Black', sans-serif" font-size="48" fill="#ffffff" text-anchor="middle" font-weight="900">${u.draws}</text>
                </g>

                <!-- Losses -->
                <g transform="translate(340, 0)">
                    <rect width="140" height="130" rx="14" fill="rgba(255, 43, 109, 0.06)" stroke="rgba(255, 43, 109, 0.3)" stroke-width="1.5" />
                    <text x="70" y="52" font-family="'Arial Black', sans-serif" font-size="15" fill="#ff2b6d" text-anchor="middle">DÉFAITES</text>
                    <text x="70" y="106" font-family="'Arial Black', sans-serif" font-size="48" fill="#ffffff" text-anchor="middle" font-weight="900">${u.losses}</text>
                </g>

                <!-- Points -->
                <g transform="translate(510, 0)">
                    <rect width="170" height="130" rx="14" fill="rgba(255, 200, 0, 0.12)" stroke="rgba(255, 200, 0, 0.5)" stroke-width="2" />
                    <text x="85" y="48" font-family="'Arial Black', sans-serif" font-size="15" fill="#ffc800" text-anchor="middle">POINTS LEAGUE</text>
                    <text x="85" y="104" font-family="'Arial Black', sans-serif" font-size="52" fill="#ffffff" text-anchor="middle" font-weight="900">${u.points}</text>
                </g>
            </g>

            <g transform="translate(0, 290)">
                <text font-family="'Arial', sans-serif" font-size="19" fill="rgba(255,255,255,0.75)">Matchs Joués : <tspan fill="#ffffff" font-weight="bold">${totalGames}</tspan></text>
                <text y="38" font-family="'Arial', sans-serif" font-size="19" fill="rgba(255,255,255,0.75)">Buts Marqués : <tspan fill="#00f0ff" font-weight="bold">${u.goalsScored}</tspan></text>
                <text y="76" font-family="'Arial', sans-serif" font-size="19" fill="rgba(255,255,255,0.75)">Buts Encaissés : <tspan fill="#ff2b6d" font-weight="bold">${u.goalsConceded}</tspan></text>
                <text y="114" font-family="'Arial', sans-serif" font-size="19" fill="rgba(255,255,255,0.75)">Différence de Buts : <tspan fill="${(u.goalsScored - u.goalsConceded) >= 0 ? '#00f0ff' : '#ff2b6d'}" font-weight="bold">${u.goalsScored - u.goalsConceded}</tspan></text>
            </g>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = {
    generatePlayerCard,
    generateUserStatsCard
};
