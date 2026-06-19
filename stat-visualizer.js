const sharp = require('sharp');

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

async function generateStatCard(player, cards = []) {
    const width = 800;
    const height = 600;

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

    const centerX = 550;
    const centerY = 300;
    const radius = 150;

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

    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0f0f13;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#23232e;stop-opacity:1" />
            </linearGradient>
        </defs>

        <!-- Background -->
        <rect width="100%" height="100%" fill="url(#grad1)" />

        <!-- Grid pattern overlay -->
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" stroke-width="0.5" stroke-opacity="0.1"/>
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Header Info -->
        <rect x="20" y="20" width="300" height="100" rx="10" fill="white" fill-opacity="0.05" stroke="white" stroke-width="2" />
        <text x="40" y="60" font-family="sans-serif" font-size="24" fill="white" font-weight="bold">${player.name.toUpperCase()}</text>
        <text x="40" y="95" font-family="sans-serif" font-size="18" fill="#aaa">EGOÏSTE TYPE: ${player.position || 'FWD'}</text>

        <!-- Stats Rankings List -->
        <g transform="translate(40, 150)">
            ${stats.map((s, i) => `
                <g transform="translate(0, ${i * 45})">
                    <text x="0" y="25" font-family="monospace" font-size="20" fill="white">${s.label}:</text>
                    <text x="120" y="25" font-family="sans-serif" font-size="24" fill="${getStatColor(getRank(s.value))}" font-weight="bold">${getRank(s.value)}</text>
                    <text x="160" y="25" font-family="sans-serif" font-size="16" fill="#666">(${s.value})</text>
                </g>
            `).join('')}
        </g>

        <!-- Hexagon Background -->
        <path d="${hexagonPath}" fill="white" fill-opacity="0.05" stroke="white" stroke-width="1" stroke-dasharray="5,5" />

        <!-- Radar lines -->
        ${stats.map((s, i) => {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            return `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="white" stroke-opacity="0.2" stroke-width="1" />`;
        }).join('')}

        <!-- Player Stat Shape -->
        <path d="${playerStatPath}" fill="#4facfe" fill-opacity="0.4" stroke="#4facfe" stroke-width="3" />

        <!-- Labels for Hexagon -->
        ${stats.map((s, i) => {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const labelRadius = radius + 30;
            const x = centerX + labelRadius * Math.cos(angle);
            const y = centerY + labelRadius * Math.sin(angle);
            return `<text x="${x}" y="${y}" font-family="sans-serif" font-size="14" fill="white" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${s.label}</text>`;
        }).join('')}

        <!-- Special Abilities -->
        <text x="40" y="450" font-family="sans-serif" font-size="20" fill="#4facfe" font-weight="bold">CAPACITÉS SPÉCIALES:</text>
        ${(player.specialAbilities || ['Aucune']).slice(0, 3).map((ability, i) => `
            <text x="40" y="${480 + i * 30}" font-family="sans-serif" font-size="18" fill="white">• ${ability}</text>
        `).join('')}

        <!-- Footer -->
        <text x="40" y="570" font-family="sans-serif" font-size="14" fill="#666">WIN: ${player.wins} | LOSS: ${player.losses} | GOALS: ${player.goals}</text>
        <text x="760" y="570" font-family="sans-serif" font-size="14" fill="#666" text-anchor="end">BLUE LOCK PROJECT</text>
    </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateStatCard };
