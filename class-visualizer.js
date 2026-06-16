const sharp = require('sharp');

const CLASSES = [
    { name: 'GUERRIER', color: '#ff4d4d', bg: '#3a1414', desc: 'Force et Défense', emblem: 'sword' },
    { name: 'MAGE', color: '#4d8bff', bg: '#14213a', desc: 'Magie et Intelligence', emblem: 'staff' },
    { name: 'ASSASSIN', color: '#4dff7a', bg: '#143a1f', desc: 'Agilité et Vitesse', emblem: 'dagger' },
    { name: 'ARCHER', color: '#ffd24d', bg: '#3a2f14', desc: 'Précision et Distance', emblem: 'bow' },
    { name: 'PRÊTRE', color: '#f5f5f5', bg: '#33373a', desc: 'Soin et Lumière', emblem: 'cross' },
    { name: 'MOINE', color: '#ffa64d', bg: '#3a2414', desc: 'Combat et Esprit', emblem: 'fist' },
    { name: 'PALADIN', color: '#4df2ff', bg: '#0f3a3d', desc: 'Protection et Sacré', emblem: 'shield' },
    { name: 'INVOCATEUR', color: '#ff66ff', bg: '#3a143a', desc: 'Créatures et Pactes', emblem: 'summon' },
    { name: 'NÉCROMANCIEN', color: '#b14dff', bg: '#26143a', desc: 'Mort et Ombres', emblem: 'skull' },
    { name: 'SAMOURAÏ', color: '#ff4d77', bg: '#3a1421', desc: 'Honneur et Lame', emblem: 'katana' },
    { name: 'CH.-DRAGON', color: '#ff7a33', bg: '#3a1c0f', desc: 'Dragon et Cieux', emblem: 'dragon' },
    { name: 'ALCHIMISTE', color: '#4dffb0', bg: '#0f3a2a', desc: 'Science et Potions', emblem: 'flask' },
    { name: 'BARDE', color: '#ff66bb', bg: '#3a1430', desc: 'Musique et Soutien', emblem: 'note' }
];

function getEmblemPath(type, s) {
    const paths = {
        sword: `<path d="M 0,-${s} L 0,${s * 0.4} M -${s * 0.4},${s * 0.4} L ${s * 0.4},${s * 0.4} M 0,${s * 0.4} L 0,${s * 0.8}" stroke-width="${s * 0.1}" fill="none" />`,
        staff: `<path d="M 0,-${s * 0.6} L 0,${s}" stroke-width="${s * 0.1}" fill="none" /><circle cx="0" cy="-${s * 0.7}" r="${s * 0.35}" fill="none" stroke-width="${s * 0.1}" />`,
        dagger: `<path d="M -${s * 0.5},-${s * 0.5} L ${s * 0.5},${s * 0.5} M ${s * 0.5},-${s * 0.5} L -${s * 0.5},${s * 0.5}" stroke-width="${s * 0.1}" fill="none" />`,
        bow: `<path d="M 0,-${s * 0.8} A ${s * 0.8},${s * 0.8} 0 0,1 0,${s * 0.8}" fill="none" stroke-width="${s * 0.1}" /><path d="M 0,-${s * 0.8} L 0,${s * 0.8} M 0,0 L -${s},0" fill="none" stroke-width="${s * 0.05}" />`,
        cross: `<path d="M 0,-${s} L 0,${s} M -${s * 0.6},-${s * 0.3} L ${s * 0.6},-${s * 0.3}" stroke-width="${s * 0.15}" fill="none" />`,
        fist: `<circle cx="0" cy="0" r="${s * 0.6}" fill="none" stroke-width="${s * 0.1}" /><path d="M -${s * 0.3},-${s * 0.6} L -${s * 0.3},-${s * 0.9} M 0,-${s * 0.6} L 0,-${s * 0.9} M ${s * 0.3},-${s * 0.6} L ${s * 0.3},-${s * 0.9}" stroke-width="${s * 0.1}" fill="none" />`,
        shield: `<path d="M 0,-${s} L ${s * 0.7},-${s * 0.6} L ${s * 0.7},${s * 0.2} L 0,${s} L -${s * 0.7},${s * 0.2} L -${s * 0.7},-${s * 0.6} Z" fill="none" stroke-width="${s * 0.1}" />`,
        summon: `<circle cx="0" cy="0" r="${s * 0.8}" fill="none" stroke-width="${s * 0.05}" /><path d="M 0,-${s * 0.8} L ${s * 0.76},${s * 0.25} L -${s * 0.47},${s * 0.65} L -${s * 0.47},-${s * 0.65} L ${s * 0.76},-${s * 0.25} Z" fill="none" stroke-width="${s * 0.05}" />`,
        skull: `<path d="M -${s * 0.55},-${s * 0.2} A ${s * 0.55},${s * 0.55} 0 1,1 ${s * 0.55},-${s * 0.2} L ${s * 0.55},${s * 0.2} L -${s * 0.55},${s * 0.2} Z" fill="none" stroke-width="${s * 0.1}" /><circle cx="-${s * 0.22}" cy="-${s * 0.15}" r="${s * 0.12}" fill="currentColor" /><circle cx="${s * 0.22}" cy="-${s * 0.15}" r="${s * 0.12}" fill="currentColor" />`,
        katana: `<path d="M -${s * 0.7},${s * 0.7} Q 0,-${s * 0.2} ${s * 0.8},-${s * 0.8}" fill="none" stroke-width="${s * 0.08}" /><path d="M -${s * 0.85},${s * 0.55} L -${s * 0.55},${s * 0.85}" fill="none" stroke-width="${s * 0.1}" />`,
        dragon: `<path d="M -${s * 0.8},${s * 0.6} Q -${s * 0.2},-${s * 0.9} ${s * 0.8},-${s * 0.4}" fill="none" stroke-width="${s * 0.08}" /><path d="M 0,-${s * 0.35} L ${s * 0.5},-${s} L ${s * 0.6},-${s * 0.2}" fill="none" stroke-width="${s * 0.08}" />`,
        flask: `<path d="M -${s * 0.25},-${s * 0.7} L -${s * 0.25},-${s * 0.2} L -${s * 0.6},${s * 0.7} L ${s * 0.6},${s * 0.7} L ${s * 0.25},-${s * 0.2} L ${s * 0.25},-${s * 0.7} M -${s * 0.35},-${s * 0.7} L ${s * 0.35},-${s * 0.7}" fill="none" stroke-width="${s * 0.1}" />`,
        note: `<path d="M ${s * 0.4},-${s * 0.8} L ${s * 0.4},${s * 0.4}" fill="none" stroke-width="${s * 0.1}" /><ellipse cx="${s * 0.15}" cy="${s * 0.4}" rx="${s * 0.28}" ry="${s * 0.2}" fill="currentColor" transform="rotate(-23, ${s * 0.15}, ${s * 0.4})" />`
    };
    return paths[type] || paths.sword;
}

async function generateClassSelectionImage() {
    const width = 1200;
    const height = 1180;

    const columns = 4;
    const cardWidth = 262;
    const cardHeight = 200;
    const marginX = 28;
    const marginY = 30;
    const startX = (width - (columns * cardWidth + (columns - 1) * marginX)) / 2;
    const startY = 150;
    const cut = 26;

    let cardsSvg = '';
    CLASSES.forEach((cls, i) => {
        const row = Math.floor(i / columns);
        const col = i % columns;
        const x = startX + col * (cardWidth + marginX);
        const y = startY + row * (cardHeight + marginY);
        const emblemSize = 34;

        cardsSvg += `
        <g transform="translate(${x}, ${y})">
            <!-- Card Background with Oblique Cut -->
            <path d="M ${cut},0 L ${cardWidth},0 L ${cardWidth},${cardHeight - cut} L ${cardWidth - cut},${cardHeight} L 0,${cardHeight} L 0,${cut} Z"
                  fill="${cls.bg}" stroke="${cls.color}" stroke-width="3" style="filter: drop-shadow(0 0 10px ${cls.color});" />

            <!-- Diagonal Accent -->
            <path d="M 0,${cardHeight} L ${cardWidth * 0.55},0 L ${cardWidth},0 L ${cardWidth},${cardHeight * 0.45} Z"
                  fill="${cls.color}" opacity="0.12" />

            <!-- Emblem -->
            <g transform="translate(${cardWidth - 58}, 64) scale(1)" color="${cls.color}" stroke="${cls.color}" fill="none">
                ${getEmblemPath(cls.emblem, emblemSize)}
            </g>

            <!-- Info -->
            <text x="18" y="38" font-family="sans-serif" font-weight="bold" font-size="18" fill="${cls.color}">${String(i + 1).padStart(2, '0')}</text>
            <text x="18" y="112" font-family="sans-serif" font-weight="bold" font-size="27" fill="white">${cls.name}</text>
            <line x1="18" y1="124" x2="88" y2="124" stroke="${cls.color}" stroke-width="3" />
            <text x="18" y="154" font-family="sans-serif" font-size="17" fill="#d5d9e6">${cls.desc}</text>
            <text x="18" y="182" font-family="sans-serif" font-style="italic" font-size="13" fill="rgba(255,255,255,0.55)">» écris "${cls.name.toLowerCase()}"</text>
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

        <!-- Diagonal grid -->
        <g stroke="rgba(120,120,160,0.05)" stroke-width="1">
            ${Array.from({length: 40}).map((_, i) => `<line x1="${i*48 - 1180}" y1="0" x2="${i*48}" y2="${height}" />`).join('')}
        </g>

        <!-- Title -->
        <text x="50%" y="82" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="54" fill="white" style="filter: drop-shadow(0 0 10px #6a8bff);">LINK START : CHOISIS TA CLASSE</text>
        <text x="50%" y="116" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-style="italic" font-size="20" fill="#9aa6c4">Envoie le nom de la classe par message</text>

        ${cardsSvg}
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateClassSelectionImage };
