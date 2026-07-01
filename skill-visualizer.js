const sharp = require('sharp');

const ELEMENT_COLORS = {
    'GUERRIER': '#ff4d4d',
    'MAGE': '#4d8bff',
    'ASSASSIN': '#4dff7a',
    'ARCHER': '#ffd24d',
    'PRÊTRE': '#f5f5f5',
    'MOINE': '#ffa64d',
    'PALADIN': '#4df2ff',
    'INVOCATEUR': '#ff66ff',
    'NÉCROMANCIEN': '#b14dff',
    'SAMOURAÏ': '#ff4d77',
    'CH.-DRAGON': '#ff7a33',
    'ALCHIMISTE': '#4dffb0',
    'BARDE': '#ff66bb',
    'COMMUN': '#aaaaaa'
};

const ELEMENT_SYMBOLS = {
    'GUERRIER': '⚔️',
    'MAGE': '🔮',
    'ASSASSIN': '🗡️',
    'ARCHER': '🏹',
    'PRÊTRE': '✨',
    'MOINE': '👊',
    'PALADIN': '🛡️',
    'INVOCATEUR': '🌀',
    'NÉCROMANCIEN': '💀',
    'SAMOURAÏ': '🏮',
    'CH.-DRAGON': '🐲',
    'ALCHIMISTE': '⚗️',
    'BARDE': '🎵',
    'COMMUN': '📜'
};

async function generateSkillTable(skills) {
    const width = 1000;
    const itemHeight = 120;
    const padding = 40;
    const height = Math.max(400, (skills.length * itemHeight) + (padding * 2) + 100);

    let skillsSvg = '';
    skills.forEach((skill, i) => {
        const y = padding + 100 + (i * itemHeight);
        const color = ELEMENT_COLORS[skill.type] || ELEMENT_COLORS['COMMUN'];

        const symbol = ELEMENT_SYMBOLS[skill.type] || ELEMENT_SYMBOLS['COMMUN'];

        skillsSvg += `
        <g transform="translate(${padding}, ${y})">
            <!-- Background bar -->
            <rect width="${width - padding * 2}" height="${itemHeight - 10}" fill="#1a1a2e" rx="10" stroke="${color}" stroke-width="2" opacity="0.8" />

            <!-- Type indicator -->
            <rect width="10" height="${itemHeight - 10}" fill="${color}" rx="5" />

            <!-- Skill Name -->
            <text x="30" y="40" font-family="sans-serif" font-weight="bold" font-size="28" fill="white">${symbol} ${skill.name.toUpperCase()}</text>

            <!-- Skill Type -->
            <rect x="30" y="55" width="110" height="25" rx="5" fill="${color}" opacity="0.3" />
            <text x="85" y="73" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="${color}">${skill.type}</text>

            <!-- Mana Cost -->
            <text x="160" y="73" font-family="sans-serif" font-size="18" fill="#4d8bff">💧 ${skill.manaCost} PM</text>

            <!-- Description -->
            <text x="30" y="95" font-family="sans-serif" font-size="18" fill="#d5d9e6">${skill.description.substring(0, 80)}${skill.description.length > 80 ? '...' : ''}</text>
        </g>
        `;
    });

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#070710;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0f0a18;stop-opacity:1" />
            </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Title -->
        <text x="50%" y="60" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="50" fill="white">GRIMOIRE DES COMPÉTENCES</text>
        <line x1="100" y1="95" x2="900" y2="95" stroke="white" stroke-width="2" opacity="0.3" />

        ${skillsSvg}
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateSkillTable };
