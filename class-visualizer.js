const sharp = require('sharp');

const CLASSES = [
    {
        name: 'GUERRIER',
        color: '#ff4d4d',
        bg: '#3a1414',
        desc: 'Force et Défense',
        emblem: 'sword',
        // Guts-style warrior with broadsword and flowing cape silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Spiky anime hair & head -->
            <path d="M 131,30 L 125,22 L 133,18 L 138,25 L 145,18 L 142,28 L 148,32 L 138,38 Z" fill="#000" />
            <circle cx="135" cy="35" r="10" fill="#000" />
            <!-- Broad shoulders & armor -->
            <path d="M 110,50 L 160,50 L 175,70 L 160,110 L 110,110 L 95,70 Z" fill="#000" />
            <!-- Massive Buster Greatsword resting on shoulder -->
            <polygon points="150,20 165,15 175,120 155,125" fill="#000" stroke="#ff4d4d" stroke-width="1" />
            <!-- Flowing Cape -->
            <path d="M 100,60 Q 60,110 50,180 Q 110,160 160,180 Q 170,120 160,60 Z" fill="#000" />
        </g>`
    },
    {
        name: 'MAGE',
        color: '#4d8bff',
        bg: '#14213a',
        desc: 'Magie et Intelligence',
        emblem: 'staff',
        // Megumin / Wizard hat & glowing staff silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Pointed Wizard Hat -->
            <polygon points="135,10 105,45 165,45" fill="#000" />
            <ellipse cx="135" cy="45" rx="35" ry="8" fill="#000" />
            <!-- Hood & Head -->
            <circle cx="135" cy="55" r="12" fill="#000" />
            <!-- Long Wizard Robes -->
            <path d="M 120,65 Q 100,120 80,180 L 190,180 Q 170,120 150,65 Z" fill="#000" />
            <!-- Magic Staff with Crystal Orb -->
            <line x1="175" y1="20" x2="175" y2="180" stroke="#000" stroke-width="6" />
            <circle cx="175" cy="20" r="14" fill="#4d8bff" opacity="0.6" stroke="#000" stroke-width="2" />
        </g>`
    },
    {
        name: 'ASSASSIN',
        color: '#4dff7a',
        bg: '#143a1f',
        desc: 'Agilité et Vitesse',
        emblem: 'dagger',
        // Dual-wielding ninja crouching shadow silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Masked head & headband trailing ribbons -->
            <circle cx="130" cy="40" r="11" fill="#000" />
            <path d="M 120,38 Q 90,30 70,35 M 120,42 Q 85,45 65,40" stroke="#000" stroke-width="4" fill="none" />
            <!-- Crouching Ninja Body -->
            <path d="M 115,50 L 145,50 L 160,90 L 175,130 L 140,170 L 90,150 L 100,100 Z" fill="#000" />
            <!-- Reverse-grip Dual Kunai/Daggers -->
            <path d="M 160,85 L 205,65 L 195,60 Z M 95,95 L 50,75 L 60,70 Z" fill="#000" stroke="#4dff7a" stroke-width="1" />
        </g>`
    },
    {
        name: 'ARCHER',
        color: '#ffd24d',
        bg: '#3a2f14',
        desc: 'Précision et Distance',
        emblem: 'bow',
        // Archer drawing full bow silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Hooded Archer head -->
            <path d="M 115,25 Q 130,15 145,25 L 145,45 L 115,45 Z" fill="#000" />
            <circle cx="130" cy="38" r="9" fill="#000" />
            <!-- Archer Torsos & Quiver on back -->
            <path d="M 110,45 L 150,45 L 140,110 L 165,180 L 105,180 L 120,110 Z" fill="#000" />
            <rect x="100" y="35" width="10" height="40" fill="#000" transform="rotate(-20, 105, 55)" />
            <!-- Extended Longbow & Nocked Arrow -->
            <path d="M 175,20 Q 205,100 175,180" stroke="#000" stroke-width="6" fill="none" />
            <line x1="175" y1="20" x2="175" y2="180" stroke="#ffd24d" stroke-width="2" />
            <line x1="105" y1="100" x2="190" y2="100" stroke="#000" stroke-width="4" />
        </g>`
    },
    {
        name: 'PRÊTRE',
        color: '#f5f5f5',
        bg: '#33373a',
        desc: 'Soin et Lumière',
        emblem: 'cross',
        // Priest with angelic wings silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Angelic Wings spread out -->
            <path d="M 130,70 Q 60,20 40,90 Q 90,100 120,90 Z" fill="#000" />
            <path d="M 130,70 Q 200,20 220,90 Q 170,100 140,90 Z" fill="#000" />
            <!-- Saint Halo -->
            <ellipse cx="130" cy="22" rx="18" ry="5" fill="none" stroke="#f5f5f5" stroke-width="3" />
            <!-- Praying Cleric Body -->
            <circle cx="130" cy="35" r="10" fill="#000" />
            <path d="M 115,48 L 145,48 L 155,180 L 105,180 Z" fill="#000" />
        </g>`
    },
    {
        name: 'MOINE',
        color: '#ffa64d',
        bg: '#3a2414',
        desc: 'Combat et Esprit',
        emblem: 'fist',
        // Martial Artist / Dragon Ball Power Stance silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Spiky Hair head -->
            <path d="M 130,20 L 120,10 L 128,25 L 115,22 L 125,32 L 110,35 L 125,40 L 135,20 Z" fill="#000" />
            <circle cx="130" cy="36" r="10" fill="#000" />
            <!-- Muscular martial arts gi stance -->
            <path d="M 100,50 L 160,50 L 150,100 L 175,170 L 130,150 L 85,170 L 110,100 Z" fill="#000" />
            <!-- Outstretched aura hands -->
            <circle cx="75" cy="70" r="12" fill="#ffa64d" opacity="0.5" />
            <circle cx="185" cy="70" r="12" fill="#ffa64d" opacity="0.5" />
        </g>`
    },
    {
        name: 'PALADIN',
        color: '#4df2ff',
        bg: '#0f3a3d',
        desc: 'Protection et Sacré',
        emblem: 'shield',
        // Heavily Armored Knight with Tower Shield & War Hammer silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Horned Helmet -->
            <path d="M 115,25 L 130,10 L 145,25 L 140,40 L 120,40 Z" fill="#000" />
            <circle cx="130" cy="32" r="10" fill="#000" />
            <!-- Heavy Plate Armor Body -->
            <path d="M 105,42 L 155,42 L 165,110 L 150,180 L 110,180 L 95,110 Z" fill="#000" />
            <!-- Tower Shield on Left Arm -->
            <polygon points="65,40 105,40 100,150 65,120" fill="#000" stroke="#4df2ff" stroke-width="2" />
            <!-- War Hammer on Right Arm -->
            <rect x="170" y="30" width="25" height="15" fill="#000" />
            <line x1="182" y1="45" x2="182" y2="150" stroke="#000" stroke-width="6" />
        </g>`
    },
    {
        name: 'INVOCATEUR',
        color: '#ff66ff',
        bg: '#3a143a',
        desc: 'Créatures et Pactes',
        emblem: 'summon',
        // Summoner with Magic Circle & Familiar shadow silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Magic Pentagram Circle on ground -->
            <ellipse cx="130" cy="150" rx="75" ry="25" fill="none" stroke="#ff66ff" stroke-width="2" />
            <!-- Summoner standing inside -->
            <circle cx="130" cy="38" r="10" fill="#000" />
            <path d="M 115,48 L 145,48 L 160,150 L 100,150 Z" fill="#000" />
            <!-- Floating Familiar Shadow Creature above shoulder -->
            <path d="M 65,40 Q 55,20 75,25 Q 85,45 65,40 Z" fill="#000" />
            <circle cx="70" cy="30" r="3" fill="#ff66ff" />
        </g>`
    },
    {
        name: 'NÉCROMANCIEN',
        color: '#b14dff',
        bg: '#26143a',
        desc: 'Mort et Ombres',
        emblem: 'skull',
        // Grim Reaper with giant Scythe silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Deep Tattered Hood -->
            <path d="M 115,20 Q 130,5 145,20 L 150,45 L 110,45 Z" fill="#000" />
            <!-- Tattered Grim Reaper Cloak -->
            <path d="M 110,45 L 150,45 L 175,180 L 85,180 Z" fill="#000" />
            <!-- Giant Curved Death Scythe -->
            <path d="M 170,180 L 185,15 L 110,35 Q 150,20 185,15" fill="#000" stroke="#b14dff" stroke-width="2" />
        </g>`
    },
    {
        name: 'SAMOURAÏ',
        color: '#ff4d77',
        bg: '#3a1421',
        desc: 'Honneur et Lame',
        emblem: 'katana',
        // Samurai in Iaido draw stance silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Topknot / Chonmage & Samurai Helmet -->
            <circle cx="130" cy="18" r="5" fill="#000" />
            <path d="M 115,25 L 145,25 L 140,42 L 120,42 Z" fill="#000" />
            <circle cx="130" cy="35" r="10" fill="#000" />
            <!-- Samurai Armor & Hakama pants -->
            <path d="M 105,45 L 155,45 L 170,110 L 180,180 L 80,180 L 90,110 Z" fill="#000" />
            <!-- Curved Katana Slash Arc -->
            <path d="M 70,130 Q 130,50 205,80" stroke="#ff4d77" stroke-width="4" fill="none" />
        </g>`
    },
    {
        name: 'CH.-DRAGON',
        color: '#ff7a33',
        bg: '#3a1c0f',
        desc: 'Dragon et Cieux',
        emblem: 'dragon',
        // Dragon Slayer with Dragon Horns & Leaping Spear silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Draconic Horns on head -->
            <path d="M 115,25 Q 95,5 105,2" stroke="#000" stroke-width="4" fill="none" />
            <path d="M 145,25 Q 165,5 155,2" stroke="#000" stroke-width="4" fill="none" />
            <circle cx="130" cy="32" r="10" fill="#000" />
            <!-- Scale Armor & Dragon Tail -->
            <path d="M 110,45 L 150,45 L 160,110 L 145,180 L 115,180 L 100,110 Z" fill="#000" />
            <path d="M 145,140 Q 190,150 210,120" stroke="#000" stroke-width="8" fill="none" />
            <!-- Dragoon Thrusting Spear -->
            <line x1="60" y1="160" x2="200" y2="20" stroke="#000" stroke-width="5" />
            <polygon points="200,20 215,10 205,30" fill="#ff7a33" />
        </g>`
    },
    {
        name: 'ALCHIMISTE',
        color: '#4dffb0',
        bg: '#0f3a2a',
        desc: 'Science et Potions',
        emblem: 'flask',
        // Alchemist with Goggles, Flasks & Steampunk coat silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Alchemist Hat & Goggles -->
            <rect x="110" y="20" width="40" height="15" fill="#000" />
            <circle cx="120" cy="35" r="5" fill="#4dffb0" />
            <circle cx="140" cy="35" r="5" fill="#4dffb0" />
            <circle cx="130" cy="38" r="10" fill="#000" />
            <!-- Long Steampunk Coat with potion belt -->
            <path d="M 110,50 L 150,50 L 165,180 L 95,180 Z" fill="#000" />
            <!-- Bubbling Flasks held in hands -->
            <path d="M 75,90 L 85,90 L 90,115 L 70,115 Z" fill="#000" stroke="#4dffb0" stroke-width="1.5" />
            <path d="M 175,90 L 185,90 L 190,115 L 170,115 Z" fill="#000" stroke="#4dffb0" stroke-width="1.5" />
        </g>`
    },
    {
        name: 'BARDE',
        color: '#ff66bb',
        bg: '#3a1430',
        desc: 'Musique et Soutien',
        emblem: 'note',
        // Bard playing Lute / Harp with musical notes silhouette
        silhouetteSvg: `<g opacity="0.28">
            <!-- Feathered Cap -->
            <path d="M 110,25 Q 130,10 150,25 L 140,35 L 120,35 Z" fill="#000" />
            <path d="M 140,20 Q 170,5 160,30" stroke="#ff66bb" stroke-width="3" fill="none" />
            <circle cx="130" cy="38" r="9" fill="#000" />
            <!-- Bard Body holding Lute -->
            <path d="M 115,48 L 145,48 L 155,180 L 105,180 Z" fill="#000" />
            <!-- Lute / Guitar Instrument -->
            <ellipse cx="100" cy="100" rx="20" ry="25" fill="#000" stroke="#ff66bb" stroke-width="1" />
            <line x1="100" y1="100" x2="160" y2="70" stroke="#000" stroke-width="5" />
        </g>`
    }
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

            <!-- Distinct Anime Silhouette Background Decor -->
            ${cls.silhouetteSvg || ''}

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
        <text x="50%" y="82" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="54" fill="white" style="filter: drop-shadow(0 0 10px #6a8bff);">AFTER THE REBIRTH : CHOISIS TA CLASSE</text>
        <text x="50%" y="116" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-style="italic" font-size="20" fill="#9aa6c4">Envoie le nom de la classe par message</text>

        ${cardsSvg}
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateClassSelectionImage };
