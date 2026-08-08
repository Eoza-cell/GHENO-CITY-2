const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Generates an elegant glassmorphic card for an eFootball player.
 * @param {object} p FootballPlayer instance
 */
async function generatePlayerCard(p) {
    const width = 600;
    const height = 800;

    // Resolve card styling colors based on Card Type
    let cardBgStart = '#11032c';
    let cardBgEnd = '#050114';
    let strokeColor = '#8a7dff';
    let typeLabel = p.cardType || 'Epic';

    if (typeLabel.toLowerCase() === 'big time') {
        cardBgStart = '#3c001a';
        cardBgEnd = '#130005';
        strokeColor = '#ff3c78';
    } else if (typeLabel.toLowerCase() === 'show time') {
        cardBgStart = '#022c2a';
        cardBgEnd = '#000c0a';
        strokeColor = '#00ffd0';
    } else if (typeLabel.toLowerCase() === 'epic') {
        cardBgStart = '#2d1e00';
        cardBgEnd = '#0e0900';
        strokeColor = '#ffbb00';
    } else if (typeLabel.toLowerCase() === 'highlight') {
        cardBgStart = '#001a3c';
        cardBgEnd = '#000513';
        strokeColor = '#0084ff';
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
        // Resize image to fit neatly on card
        const playerBuffer = await sharp(p.imagePath)
            .resize(320, 320, { fit: 'inside' })
            .toBuffer();
        playerImageBase64 = `data:image/png;base64,${playerBuffer.toString('base64')}`;
    }

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${cardBgStart};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${cardBgEnd};stop-opacity:1" />
            </linearGradient>
            <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${strokeColor};stop-opacity:0.9" />
                <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.2" />
            </linearGradient>
            <linearGradient id="textGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffe6a3;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ff8a3d;stop-opacity:1" />
            </linearGradient>
            <filter id="cardGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        <!-- Base Background Card -->
        <rect width="${width}" height="${height}" fill="url(#bgGrad)" rx="30" />
        <rect x="15" y="15" width="${width - 30}" height="${height - 30}" rx="25" fill="none" stroke="url(#glowGrad)" stroke-width="3.5" />

        <!-- Diagonal accent lines (eFootball thematic) -->
        <g opacity="0.15" stroke="${strokeColor}" stroke-width="2">
            <line x1="-50" y1="100" x2="650" y2="250" />
            <line x1="-50" y1="200" x2="650" y2="350" />
            <line x1="-50" y1="300" x2="650" y2="450" />
            <line x1="-50" y1="400" x2="650" y2="550" />
            <line x1="-50" y1="500" x2="650" y2="650" />
        </g>

        <!-- Watermark/ARISE Brand Overlay -->
        ${watermarkBase64 ? `
            <image href="${watermarkBase64}" x="180" y="700" width="240" height="70" opacity="0.65" />
        ` : `
            <text x="300" y="740" font-family="'Impact', Arial" font-size="34" fill="rgba(255,255,255,0.15)" text-anchor="middle" letter-spacing="6">ARISE</text>
        `}

        <!-- Player Crop Image -->
        ${playerImageBase64 ? `
            <image href="${playerImageBase64}" x="140" y="100" width="320" height="320" />
        ` : ''}

        <!-- eFootball Card UI: Position and Rating -->
        <g transform="translate(45, 65)">
            <rect width="90" height="90" rx="15" fill="rgba(255,255,255,0.06)" stroke="${strokeColor}" stroke-width="1.5" />
            <text x="45" y="42" font-family="'Arial Black', sans-serif" font-size="36" fill="#ffffff" text-anchor="middle" font-weight="900">${p.rating}</text>
            <text x="45" y="75" font-family="'Arial Black', sans-serif" font-size="22" fill="${strokeColor}" text-anchor="middle" font-weight="900">${p.position}</text>
        </g>

        <!-- Card Type Tag -->
        <g transform="translate(435, 65)">
            <rect width="120" height="35" rx="8" fill="rgba(0,0,0,0.6)" stroke="${strokeColor}" stroke-width="1" />
            <text x="60" y="23" font-family="'Arial', sans-serif" font-size="14" fill="#ffffff" font-weight="bold" text-anchor="middle">${typeLabel.toUpperCase()}</text>
        </g>

        <!-- Player Info (Name, Club, Country) -->
        <g transform="translate(300, 460)">
            <text font-family="'Arial Black', sans-serif" font-size="38" fill="#ffffff" text-anchor="middle" font-weight="900">${p.name.toUpperCase()}</text>
            <text y="42" font-family="'Arial', sans-serif" font-size="20" fill="rgba(255,255,255,0.7)" text-anchor="middle">${p.club} | ${p.country}</text>
        </g>

        <!-- Stats Section -->
        <g transform="translate(50, 560)">
            <!-- Speed (VIT) -->
            <g transform="translate(0, 0)">
                <text x="0" y="20" font-family="'Arial Black', sans-serif" font-size="16" fill="rgba(255,255,255,0.5)">VIT</text>
                <text x="0" y="55" font-family="'Arial Black', sans-serif" font-size="26" fill="#ffffff" font-weight="900">${p.speed}</text>
                <rect x="0" y="65" width="60" height="4" fill="#444" rx="2" />
                <rect x="0" y="65" width="${(p.speed / 100) * 60}" height="4" fill="${strokeColor}" rx="2" />
            </g>

            <!-- Dribbling (DRI) -->
            <g transform="translate(85, 0)">
                <text x="0" y="20" font-family="'Arial Black', sans-serif" font-size="16" fill="rgba(255,255,255,0.5)">DRI</text>
                <text x="0" y="55" font-family="'Arial Black', sans-serif" font-size="26" fill="#ffffff" font-weight="900">${p.dribbling}</text>
                <rect x="0" y="65" width="60" height="4" fill="#444" rx="2" />
                <rect x="0" y="65" width="${(p.dribbling / 100) * 60}" height="4" fill="${strokeColor}" rx="2" />
            </g>

            <!-- Shooting (TIR) -->
            <g transform="translate(170, 0)">
                <text x="0" y="20" font-family="'Arial Black', sans-serif" font-size="16" fill="rgba(255,255,255,0.5)">TIR</text>
                <text x="0" y="55" font-family="'Arial Black', sans-serif" font-size="26" fill="#ffffff" font-weight="900">${p.shooting}</text>
                <rect x="0" y="65" width="60" height="4" fill="#444" rx="2" />
                <rect x="0" y="65" width="${(p.shooting / 100) * 60}" height="4" fill="${strokeColor}" rx="2" />
            </g>

            <!-- Passing (PAS) -->
            <g transform="translate(255, 0)">
                <text x="0" y="20" font-family="'Arial Black', sans-serif" font-size="16" fill="rgba(255,255,255,0.5)">PAS</text>
                <text x="0" y="55" font-family="'Arial Black', sans-serif" font-size="26" fill="#ffffff" font-weight="900">${p.passing}</text>
                <rect x="0" y="65" width="60" height="4" fill="#444" rx="2" />
                <rect x="0" y="65" width="${(p.passing / 100) * 60}" height="4" fill="${strokeColor}" rx="2" />
            </g>

            <!-- Defense (DEF) -->
            <g transform="translate(340, 0)">
                <text x="0" y="20" font-family="'Arial Black', sans-serif" font-size="16" fill="rgba(255,255,255,0.5)">DEF</text>
                <text x="0" y="55" font-family="'Arial Black', sans-serif" font-size="26" fill="#ffffff" font-weight="900">${p.defense}</text>
                <rect x="0" y="65" width="60" height="4" fill="#444" rx="2" />
                <rect x="0" y="65" width="${(p.defense / 100) * 60}" height="4" fill="${strokeColor}" rx="2" />
            </g>

            <!-- Physical (PHY) -->
            <g transform="translate(425, 0)">
                <text x="0" y="20" font-family="'Arial Black', sans-serif" font-size="16" fill="rgba(255,255,255,0.5)">PHY</text>
                <text x="0" y="55" font-family="'Arial Black', sans-serif" font-size="26" fill="#ffffff" font-weight="900">${p.physical}</text>
                <rect x="0" y="65" width="60" height="4" fill="#444" rx="2" />
                <rect x="0" y="65" width="${(p.physical / 100) * 60}" height="4" fill="${strokeColor}" rx="2" />
            </g>
        </g>

    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generates an elegant stats card for a user's local league performance.
 */
async function generateUserStatsCard(u) {
    const width = 800;
    const height = 500;

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
                <stop offset="0%" style="stop-color:#0d0a21;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#04020a;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00e5ff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#8a2be2;stop-opacity:1" />
            </linearGradient>
        </defs>

        <!-- Base Background Card -->
        <rect width="${width}" height="${height}" fill="url(#bgGrad)" rx="20" />
        <rect x="15" y="15" width="${width - 30}" height="${height - 30}" rx="15" fill="none" stroke="url(#accentGrad)" stroke-width="2" />

        <!-- Watermark/ARISE Brand Overlay -->
        ${watermarkBase64 ? `
            <image href="${watermarkBase64}" x="520" y="380" width="240" height="70" opacity="0.65" />
        ` : `
            <text x="640" y="420" font-family="'Impact', Arial" font-size="34" fill="rgba(255,255,255,0.15)" text-anchor="middle" letter-spacing="6">ARISE</text>
        `}

        <g transform="translate(50, 70)">
            <!-- Title -->
            <text font-family="'Arial Black', sans-serif" font-size="32" fill="#ffffff" font-weight="900">PROFIL COMPÉTITEUR eFOOTBALL</text>
            <text y="35" font-family="'Arial', sans-serif" font-size="20" fill="#00e5ff">${u.name}</text>

            <!-- Main stats columns -->
            <g transform="translate(0, 100)">
                <!-- Wins -->
                <g transform="translate(0, 0)">
                    <rect width="130" height="120" rx="10" fill="rgba(0, 229, 255, 0.05)" stroke="rgba(0, 229, 255, 0.2)" stroke-width="1" />
                    <text x="65" y="50" font-family="'Arial Black', sans-serif" font-size="14" fill="#00e5ff" text-anchor="middle">VICTOIRES</text>
                    <text x="65" y="100" font-family="'Arial Black', sans-serif" font-size="44" fill="#ffffff" text-anchor="middle" font-weight="900">${u.wins}</text>
                </g>

                <!-- Draws -->
                <g transform="translate(160, 0)">
                    <rect width="130" height="120" rx="10" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1" />
                    <text x="65" y="50" font-family="'Arial Black', sans-serif" font-size="14" fill="#aaaaaa" text-anchor="middle">NULS</text>
                    <text x="65" y="100" font-family="'Arial Black', sans-serif" font-size="44" fill="#ffffff" text-anchor="middle" font-weight="900">${u.draws}</text>
                </g>

                <!-- Losses -->
                <g transform="translate(320, 0)">
                    <rect width="130" height="120" rx="10" fill="rgba(255, 60, 120, 0.05)" stroke="rgba(255, 60, 120, 0.2)" stroke-width="1" />
                    <text x="65" y="50" font-family="'Arial Black', sans-serif" font-size="14" fill="#ff3c78" text-anchor="middle">DÉFAITES</text>
                    <text x="65" y="100" font-family="'Arial Black', sans-serif" font-size="44" fill="#ffffff" text-anchor="middle" font-weight="900">${u.losses}</text>
                </g>

                <!-- Points -->
                <g transform="translate(480, 0)">
                    <rect width="150" height="120" rx="10" fill="rgba(255, 187, 0, 0.1)" stroke="rgba(255, 187, 0, 0.4)" stroke-width="1.5" />
                    <text x="75" y="45" font-family="'Arial Black', sans-serif" font-size="14" fill="#ffbb00" text-anchor="middle">POINTS LEAGUE</text>
                    <text x="75" y="95" font-family="'Arial Black', sans-serif" font-size="48" fill="#ffffff" text-anchor="middle" font-weight="900">${u.points}</text>
                </g>
            </g>

            <!-- Goals Scored/Conceded/Total Games Section -->
            <g transform="translate(0, 270)">
                <text font-family="'Arial', sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">Matchs Joués : <tspan fill="#ffffff" font-weight="bold">${totalGames}</tspan></text>
                <text y="35" font-family="'Arial', sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">Buts Marqués : <tspan fill="#00e5ff" font-weight="bold">${u.goalsScored}</tspan></text>
                <text y="70" font-family="'Arial', sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">Buts Encaissés : <tspan fill="#ff3c78" font-weight="bold">${u.goalsConceded}</tspan></text>
                <text y="105" font-family="'Arial', sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">Différence de Buts : <tspan fill="${(u.goalsScored - u.goalsConceded) >= 0 ? '#00e5ff' : '#ff3c78'}" font-weight="bold">${u.goalsScored - u.goalsConceded}</tspan></text>
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
