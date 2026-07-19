const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function getRank(value) {
    if (value >= 90) return 'S';
    if (value >= 80) return 'A';
    if (value >= 70) return 'B';
    if (value >= 60) return 'C';
    if (value >= 50) return 'D';
    if (value >= 40) return 'E';
    if (value >= 30) return 'F';
    return 'G';
}

function getStatColor(rank) {
    const colors = {
        'S': '#FFD700', // Gold
        'A': '#FF4500', // OrangeRed
        'B': '#DA70D6', // Orchid
        'C': '#1E90FF', // DodgerBlue
        'D': '#32CD32', // LimeGreen
        'E': '#808080', // Gray
        'F': '#A52A2A', // Brown
        'G': '#000000'  // Black
    };
    return colors[rank] || '#FFFFFF';
}

async function generateStatCard(player) {
    const width = 1000;
    const height = 650;

    // Calculate Offense as average of Shoot, Dribble, Speed
    const offense = Math.round((player.shoot + player.dribble + player.speed) / 3);

    const stats = [
        { label: 'SPEED', value: player.speed },
        { label: 'DEFENSE', value: player.defense },
        { label: 'PASS', value: player.pass },
        { label: 'DRIBBLE', value: player.dribble },
        { label: 'SHOOT', value: player.shoot },
        { label: 'OFFENSE', value: offense }
    ];

    const centerX = 750;
    const centerY = 325;
    const radius = 130;

    let hexagonPath = "";
    let playerStatPath = "";

    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        hexagonPath += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;

        const statValue = Math.min(100, stats[i].value);
        const px = centerX + (radius * (statValue / 100)) * Math.cos(angle);
        const py = centerY + (radius * (statValue / 100)) * Math.sin(angle);
        playerStatPath += `${i === 0 ? 'M' : 'L'} ${px} ${py} `;
    }
    hexagonPath += "Z";
    playerStatPath += "Z";

    // Handle Player Image if it exists
    let playerImageTag = "";
    if (player.appearanceImageUrl && fs.existsSync(player.appearanceImageUrl)) {
        try {
            const imgBuffer = fs.readFileSync(player.appearanceImageUrl);
            const base64Img = imgBuffer.toString('base64');
            playerImageTag = `<image href="data:image/jpeg;base64,${base64Img}" x="50" y="140" width="320" height="420" preserveAspectRatio="xMidYMid slice" opacity="0.85" clip-path="url(#card-clip)" />`;
        } catch (e) {
            console.error("Error reading appearance image:", e.message);
        }
    }

    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#143a1a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0a1e0d;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.15" />
                <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.03" />
            </linearGradient>

            <clipPath id="card-clip">
                <rect x="50" y="140" width="320" height="420" rx="20" />
            </clipPath>
        </defs>

        <!-- BACKGROUND: Football pitch with markings -->
        <rect width="100%" height="100%" fill="url(#pitchGrad)" />

        <!-- Pitch Lines -->
        <rect x="30" y="30" width="940" height="590" fill="none" stroke="white" stroke-width="3" stroke-opacity="0.15" />
        <!-- Center line -->
        <line x1="500" y1="30" x2="500" y2="620" stroke="white" stroke-width="3" stroke-opacity="0.15" />
        <!-- Center Circle -->
        <circle cx="500" cy="325" r="100" fill="none" stroke="white" stroke-width="3" stroke-opacity="0.15" />
        <!-- Penalty Areas -->
        <rect x="30" y="162.5" width="150" height="325" fill="none" stroke="white" stroke-width="3" stroke-opacity="0.1" />
        <rect x="820" y="162.5" width="150" height="325" fill="none" stroke="white" stroke-width="3" stroke-opacity="0.1" />

        <!-- Glassmorphism transparent container -->
        <rect x="25" y="25" width="950" height="600" rx="30" fill="url(#glassGrad)" stroke="white" stroke-width="1.5" stroke-opacity="0.25" style="backdrop-filter: blur(20px);" />

        <!-- Header Info -->
        <text x="60" y="85" font-family="sans-serif" font-size="36" fill="white" font-weight="bold" letter-spacing="2">${player.name.toUpperCase()}</text>
        <text x="60" y="115" font-family="sans-serif" font-size="18" fill="#4facfe" font-weight="bold" letter-spacing="1">EGOÏSTE TYPE: ${player.position || 'FWD'}</text>

        <!-- Player Image Box -->
        <rect x="50" y="140" width="320" height="420" rx="20" fill="white" fill-opacity="0.05" stroke="white" stroke-width="1" stroke-opacity="0.2" />
        ${playerImageTag}

        <!-- Stats Rankings List -->
        <g transform="translate(400, 140)">
            ${stats.map((s, i) => `
                <g transform="translate(0, ${i * 45})">
                    <text x="0" y="25" font-family="monospace" font-size="20" fill="#ccc" font-weight="bold">${s.label}</text>
                    <rect x="110" y="10" width="60" height="24" rx="5" fill="${getStatColor(getRank(s.value))}" fill-opacity="0.2" />
                    <text x="140" y="28" font-family="sans-serif" font-size="18" fill="${getStatColor(getRank(s.value))}" font-weight="bold" text-anchor="middle">${getRank(s.value)}</text>
                    <text x="190" y="26" font-family="sans-serif" font-size="16" fill="#888">(${s.value})</text>
                </g>
            `).join('')}
        </g>

        <!-- Hexagon Background -->
        <path d="${hexagonPath}" fill="white" fill-opacity="0.03" stroke="white" stroke-width="1.5" stroke-opacity="0.2" stroke-dasharray="5,5" />

        <!-- Radar lines -->
        ${stats.map((s, i) => {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            return `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="white" stroke-opacity="0.2" stroke-width="1" />`;
        }).join('')}

        <!-- Player Stat Shape -->
        <path d="${playerStatPath}" fill="#4facfe" fill-opacity="0.35" stroke="#4facfe" stroke-width="3" />

        <!-- Labels for Hexagon -->
        ${stats.map((s, i) => {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const labelRadius = radius + 30;
            const x = centerX + labelRadius * Math.cos(angle);
            const y = centerY + labelRadius * Math.sin(angle);
            return `<text x="${x}" y="${y}" font-family="sans-serif" font-size="14" fill="white" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${s.label}</text>`;
        }).join('')}

        <!-- Special Abilities -->
        <text x="400" y="440" font-family="sans-serif" font-size="20" fill="#4facfe" font-weight="bold">CAPACITÉS SPÉCIALES:</text>
        ${(player.specialAbilities && player.specialAbilities.length > 0 ? player.specialAbilities : ['Aucune']).slice(0, 3).map((ability, i) => `
            <text x="400" y="${475 + i * 30}" font-family="sans-serif" font-size="18" fill="white">• ${ability}</text>
        `).join('')}

        <!-- Footer -->
        <text x="60" y="605" font-family="sans-serif" font-size="14" fill="#aaa" font-weight="bold">MATCHES: ${player.wins + player.losses} | VICTOIRES: ${player.wins} | DÉFAITES: ${player.losses} | BUTS: ${player.goals}</text>
        <text x="940" y="605" font-family="sans-serif" font-size="14" fill="#aaa" font-weight="bold" text-anchor="end">BLUE LOCK PROJECT</text>
    </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateStatCard };
