const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Generates a visually stunning, dynamic main menu image using Sharp and SVG.
 * Inspired by the high-contrast cinematic DBZ: Kakarot interface.
 * Features neon orange/yellow energy auras, angular bracket panels, Ki sparks, and character stats.
 * @param {Object} player - The player object from the database (optional)
 */
async function generateMainMenuImage(player) {
    const width = 1200;
    const height = 700;

    // Fallbacks and details
    const pName = player?.name ? player.name.toUpperCase() : "HÉRITIER SANS NOM";
    const pClass = player?.class ? player.class.toUpperCase() : "COMMENÇANT";
    const pRace = player?.race ? player.race.toUpperCase() : "HUMAIN";
    const pRank = player?.rank ? player.rank : "F";
    const pLevel = player?.level ? player.level : 1;
    const pLocation = player?.location ? player.location : "MONDE D'AETHERYS";
    const pSubLocation = player?.subLocation ? player.subLocation : "ZONE INITIALE";
    const pHealth = player?.health != null ? player.health : 100;
    const pMaxHealth = player?.maxHealth != null ? player.maxHealth : 100;
    const pMana = player?.mana != null ? player.mana : 100;
    const pMaxMana = player?.maxMana != null ? player.maxMana : 100;
    const pCol = player?.col != null ? player.col : 100;

    const pStrength = player?.strength != null ? player.strength : 5;
    const pAgility = player?.agility != null ? player.agility : 5;
    const pIntelligence = player?.intelligence != null ? player.intelligence : 5;
    const pDefense = player?.defense != null ? player.defense : 5;
    const pLuck = player?.luck != null ? player.luck : 2;

    // Determine Rank themed accent colors (using fiery high-contrast DBZ/Kakarot colors)
    const rankThemes = {
        'S': { primary: '#ff3c00', secondary: '#ffbb00', glow: 'rgba(255, 60, 0, 0.95)', aura: '#ffaa00' },
        'A': { primary: '#ff8800', secondary: '#ffd000', glow: 'rgba(255, 136, 0, 0.85)', aura: '#ffea00' },
        'B': { primary: '#e60067', secondary: '#ff779d', glow: 'rgba(230, 0, 103, 0.8)', aura: '#ff00aa' },
        'C': { primary: '#00ccff', secondary: '#0055ff', glow: 'rgba(0, 204, 255, 0.8)', aura: '#00ffff' },
        'D': { primary: '#00ff66', secondary: '#009933', glow: 'rgba(0, 255, 102, 0.8)', aura: '#33ffaa' },
        'E': { primary: '#9d33ff', secondary: '#5e00b3', glow: 'rgba(157, 51, 255, 0.7)', aura: '#aa00ff' },
        'F': { primary: '#9e9e9e', secondary: '#424242', glow: 'rgba(158, 158, 158, 0.6)', aura: '#ffffff' }
    };
    const theme = rankThemes[pRank] || rankThemes['F'];

    // Generate Ki energy sparks / aura particle coordinates
    const sparkCount = 80;
    const sparks = Array.from({ length: sparkCount }).map((_, i) => {
        const x = Math.floor((Math.sin(i * 19) * 0.5 + 0.5) * width);
        const y = Math.floor((Math.cos(i * 23) * 0.5 + 0.5) * height);
        const r = (i % 4 === 0) ? 3.5 : ((i % 3 === 0) ? 2 : 1.5);
        const opacity = (i % 3 === 0) ? 0.9 : 0.65;
        const isSpike = i % 5 === 0;
        return { x, y, r, opacity, isSpike };
    });

    const menuCommands = ['/action', '/profil', '/quests', '/map', '/bank', '/lore'];

    // Use kakarot-reference.png if it exists as a backdrop overlay
    const kakarotRefPath = path.join(__dirname, 'assets', 'kakarot-reference.png');
    const hasBackdrop = fs.existsSync(kakarotRefPath);

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <!-- DBZ Flame & Energy Gradients -->
            <linearGradient id="kakarotOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ff3c00;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#ff9000;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ffcc00;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="darkSpace" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#050201;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#140803;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="glowGold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffcc00;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ff3c00;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="hpGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#39ff14;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#00aa00;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="mpCyan" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00f3ff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0055ff;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="kiAura" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" style="stop-color:#ff3c00;stop-opacity:0" />
                <stop offset="50%" style="stop-color:#ffbb00;stop-opacity:0.25" />
                <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0" />
            </linearGradient>

            <!-- Filters for high-energy glowing elements -->
            <filter id="kakarotGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>

            <filter id="auraIntense" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="16" result="blur" />
                <feColorMatrix type="matrix" values="1 0 0 0 1  0 1 0 0 0.5  0 0 1 0 0  0 0 0 2 -0.1" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <!-- Base Dark Cinematic Space Background -->
        <rect width="100%" height="100%" fill="url(#darkSpace)" />

        <!-- Fiery Radial Aura (Middle background glow) -->
        <circle cx="600" cy="350" r="450" fill="url(#kiAura)" opacity="0.8" />

        <!-- Cinematic Angled Grid Lines and Tech/Ki lines -->
        <g stroke="rgba(255, 140, 0, 0.05)" stroke-width="1.2">
            <line x1="0" y1="100" x2="${width}" y2="100" />
            <line x1="0" y1="250" x2="${width}" y2="250" />
            <line x1="0" y1="400" x2="${width}" y2="400" />
            <line x1="0" y1="550" x2="${width}" y2="550" />

            <line x1="200" y1="0" x2="200" y2="${height}" />
            <line x1="500" y1="0" x2="500" y2="${height}" />
            <line x1="800" y1="0" x2="800" y2="${height}" />
            <line x1="1100" y1="0" x2="1100" y2="${height}" />
        </g>

        <!-- Dynamic Diagonals representing Ki cuts -->
        <path d="M-100,550 L1300,100 L1300,120 L-100,570 Z" fill="url(#glowGold)" opacity="0.12" filter="url(#kakarotGlow)" />
        <path d="M-100,200 L1300,-150 L1300,-130 L-100,220 Z" fill="#ff3c00" opacity="0.08" filter="url(#kakarotGlow)" />

        <!-- Sparkles & Aura lightning effects -->
        <g>
            ${sparks.map(s => `
                <circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${s.isSpike ? '#ffbb00' : '#ffffff'}" opacity="${s.opacity}" ${s.isSpike ? 'filter="url(#kakarotGlow)"' : ''} />
                ${s.isSpike ? `
                    <path d="M ${s.x},${s.y} L ${s.x - 15},${s.y + 12} L ${s.x + 5},${s.y + 20} L ${s.x - 10},${s.y + 35}" stroke="#ffaa00" stroke-width="1.5" fill="none" opacity="0.7" filter="url(#kakarotGlow)" />
                ` : ''}
            `).join('')}
        </g>

        <!-- GAME LOGO: KAKAROT inspired Bold Title -->
        <g transform="translate(120, 110)">
            <!-- Backdrop banner under title -->
            <path d="M -70,-55 L 530,-55 L 480,50 L -120,50 Z" fill="url(#kakarotOrange)" filter="url(#auraIntense)" opacity="0.22" />
            <path d="M -60,-50 L 520,-50 L 475,45 L -110,45 Z" fill="#0c0402" stroke="#ff5500" stroke-width="1.5" />
            <path d="M -60,-50 L 30,-50 L -10,45 L -100,45 Z" fill="#ff3c00" opacity="0.85" />

            <text x="5" y="18" font-family="'Impact', 'Arial Black', sans-serif" font-size="62" fill="#ffffff" letter-spacing="4" style="filter: drop-shadow(0px 0px 12px #ffbb00); text-shadow: 3px 3px 0px #000;">AETHERYS</text>
            <text x="355" y="15" font-family="'Impact', Arial, sans-serif" font-size="34" fill="#ffbb00" style="letter-spacing:4px; filter:url(#kakarotGlow); text-shadow: 2px 2px 0px #000;">EVOLUTION</text>
            <text x="355" y="-18" font-family="'Courier New', monospace" font-size="14" fill="rgba(255,255,255,0.6)" font-weight="bold" style="letter-spacing:6px;">NOYAU GEMMA 3</text>

            <line x1="-50" y1="32" x2="455" y2="32" stroke="url(#glowGold)" stroke-width="3" filter="url(#kakarotGlow)" />
        </g>

        <!-- COMMAND NAVIGATION SYSTEM (Fiery Angled Bars with cyber brackets) -->
        <g transform="translate(100, 260)">
            ${menuCommands.map((cmd, i) => {
                const isActive = (i === 0);
                const barWidth = 360 - i * 14;
                const heightBar = 46;
                const slant = 24;

                const plateFill = isActive ? 'url(#kakarotOrange)' : 'rgba(255, 255, 255, 0.03)';
                const strokeColor = isActive ? '#ffcc00' : 'rgba(255, 140, 0, 0.25)';
                const textColor = isActive ? '#ffffff' : '#e0a080';
                const shadow = isActive ? 'filter: drop-shadow(0px 0px 8px #ff6600);' : '';

                return `
                <g transform="translate(${i * 18}, ${i * 62})" style="${shadow}">
                    <!-- Outer bracket frame -->
                    <path d="M -15,-22 L ${barWidth + 10},-22 L ${barWidth + 10 - slant},22 L -15 -22" fill="none" stroke="${strokeColor}" stroke-width="0.5" opacity="0.5" />

                    <!-- Main Angled Glassmorphic bar -->
                    <path d="M 0,-20 L ${barWidth},-20 L ${barWidth - slant},20 L ${-slant},20 Z" fill="${plateFill}" stroke="${strokeColor}" stroke-width="${isActive ? '2.5' : '1'}" />

                    <!-- Cyber brackets decor on the edges -->
                    <path d="M ${-slant},-20 L ${-slant + 10},-20 L ${-slant + 5},20 L ${-slant - 5},20 Z" fill="${isActive ? '#ffffff' : '#ff5500'}" opacity="0.8" />

                    <!-- Selection Indicator Light -->
                    <circle cx="${-slant - 30}" cy="0" r="13" fill="${isActive ? '#ffffff' : '#0a0301'}" stroke="${strokeColor}" stroke-width="2" />
                    ${isActive ? `<circle cx="${-slant - 30}" cy="0" r="6" fill="#ffcc00" filter="url(#kakarotGlow)" />` : ''}

                    <!-- Command text -->
                    <text x="25" y="8" font-family="'Impact', 'Arial Black', sans-serif" font-size="24" fill="${textColor}" letter-spacing="1.5" style="text-shadow: 2px 2px 3px rgba(0,0,0,0.9);">${cmd.toUpperCase()}</text>

                    ${isActive ? `<polygon points="${barWidth - slant - 25},-6 ${barWidth - slant - 15},0 ${barWidth - slant - 25},6" fill="#ffffff" />` : ''}
                </g>
                `;
            }).join('')}
        </g>

        <!-- KAKAROT-STYLE CHARACTER STATUS BOARD (Sleek Glassmorphic card with bracket frames) -->
        <g transform="translate(710, 110)">
            <!-- Main Board Backdrop -->
            <rect x="0" y="0" width="390" height="500" fill="rgba(8, 4, 2, 0.92)" stroke="url(#kakarotOrange)" stroke-width="2.5" rx="16" filter="url(#kakarotGlow)" />
            <rect x="8" y="8" width="374" height="484" fill="none" stroke="rgba(255, 140, 0, 0.15)" stroke-width="1.2" rx="10" />

            <!-- Corner Angular Cyber Brackets (Authentic Kakarot Detail) -->
            <path d="M -5,25 L -5,-5 L 25,-5" fill="none" stroke="#ffbb00" stroke-width="4.5" />
            <path d="M 395,25 L 395,-5 L 365,-5" fill="none" stroke="#ffbb00" stroke-width="4.5" />
            <path d="M -5,475 L -5,505 L 25,505" fill="none" stroke="#ffbb00" stroke-width="4.5" />
            <path d="M 395,475 L 395,505 L 365,505" fill="none" stroke="#ffbb00" stroke-width="4.5" />

            <!-- Sub Header Title banner -->
            <path d="M 12,12 L 378,12 L 360,48 L 30,48 Z" fill="url(#kakarotOrange)" opacity="0.3" />
            <text x="195" y="34" font-family="'Impact', sans-serif" font-size="16" fill="#ffbb00" text-anchor="middle" letter-spacing="4" style="text-shadow: 1px 1px 2px #000;">CARACTÉRISTIQUES DE L'HÉRITIER</text>

            <!-- Character Profile Header Details -->
            <g transform="translate(30, 95)">
                <!-- Giant glowing Level Badge -->
                <polygon points="300,-15 345,15 300,45 255,15" fill="#000000" stroke="${theme.primary}" stroke-width="3.5" filter="url(#kakarotGlow)" />
                <text x="300" y="8" font-family="'Impact', Arial Black, sans-serif" font-size="12" fill="#ffaa00" text-anchor="middle" style="letter-spacing: 1px;">LEVEL</text>
                <text x="300" y="32" font-family="'Impact', Arial Black, sans-serif" font-size="28" fill="#ffffff" text-anchor="middle" style="text-shadow: 2px 2px 0px #000;">${pLevel}</text>

                <!-- Name & Subtitles -->
                <text x="0" y="-12" font-family="'Impact', sans-serif" font-size="32" fill="#ffffff" style="letter-spacing: 1px; text-shadow: 3px 3px 0px #000; fill: url(#glowGold);">${pName}</text>
                <text x="0" y="14" font-family="Arial, sans-serif" font-size="14" fill="#ff5500" font-weight="900" letter-spacing="1.5">${pClass} • ${pRace}</text>
                <text x="0" y="32" font-family="'Courier New', monospace" font-size="12" fill="rgba(255,255,255,0.5)">GHENO ID: ${(player?.whatsappId || 'GUEST').substring(0, 12)}</text>
            </g>

            <!-- HP, MP/Ki & Stats display -->
            <g transform="translate(30, 185)">
                <!-- HP Gauge -->
                <g transform="translate(0, 0)">
                    <text x="0" y="0" font-family="'Impact', sans-serif" font-size="14" fill="#39ff14" letter-spacing="1">POINTS DE VIE (HP)</text>
                    <text x="330" y="0" font-family="monospace" font-size="14" fill="#ffffff" font-weight="bold" text-anchor="end">${pHealth} / ${pMaxHealth}</text>
                    <rect x="0" y="8" width="330" height="10" fill="rgba(255,255,255,0.06)" rx="5" />
                    <rect x="0" y="8" width="${Math.max(10, Math.min(100, (pHealth / pMaxHealth) * 100)) * 3.3}" height="10" fill="url(#hpGreen)" rx="5" filter="url(#kakarotGlow)" />
                </g>

                <!-- MP/KI Gauge -->
                <g transform="translate(0, 46)">
                    <text x="0" y="0" font-family="'Impact', sans-serif" font-size="14" fill="#00f3ff" letter-spacing="1">RÉSERVE DE KI (MP)</text>
                    <text x="330" y="0" font-family="monospace" font-size="14" fill="#ffffff" font-weight="bold" text-anchor="end">${pMana} / ${pMaxMana}</text>
                    <rect x="0" y="8" width="330" height="10" fill="rgba(255,255,255,0.06)" rx="5" />
                    <rect x="0" y="8" width="${Math.max(10, Math.min(100, (pMana / pMaxMana) * 100)) * 3.3}" height="10" fill="url(#mpCyan)" rx="5" filter="url(#kakarotGlow)" />
                </g>

                <!-- Stats values aligned with Kakarot numerical scaling -->
                <g transform="translate(0, 104)">
                    <rect x="-10" y="0" width="350" height="142" fill="rgba(255, 140, 0, 0.02)" stroke="rgba(255, 140, 0, 0.15)" rx="8" />
                    <text x="10" y="22" font-family="'Impact', sans-serif" font-size="13" fill="#ffaa00" letter-spacing="2">STATISTIQUES DE COMBAT</text>

                    <!-- Grid of stats -->
                    <g transform="translate(15, 45)" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff">
                        <text x="0" y="0">💪 FORCE :</text>
                        <text x="110" y="0" fill="#ffcc00">${pStrength}</text>
                        <text x="160" y="0">🛡️ DÉFENSE :</text>
                        <text x="270" y="0" fill="#ffcc00">${pDefense}</text>

                        <text x="0" y="32">🏃 AGILITÉ :</text>
                        <text x="110" y="32" fill="#ffcc00">${pAgility}</text>
                        <text x="160" y="32">🧠 INTEL :</text>
                        <text x="270" y="32" fill="#ffcc00">${pIntelligence}</text>

                        <text x="0" y="64">🍀 CHANCE :</text>
                        <text x="110" y="64" fill="#ffcc00">${pLuck}</text>
                        <text x="160" y="64">🎖️ SYNC :</text>
                        <text x="270" y="64" fill="#39ff14">${player?.fusedWithId ? 'FUSÉ' : 'STABLE'}</text>
                    </g>
                </g>

                <!-- Location Panel -->
                <g transform="translate(0, 260)">
                    <rect x="-10" y="0" width="350" height="42" fill="rgba(255,60,0,0.04)" stroke="rgba(255,60,0,0.2)" rx="6" />
                    <text x="10" y="16" font-family="'Courier New', monospace" font-size="9" fill="rgba(255,255,255,0.4)" font-weight="bold" letter-spacing="2">SECTEUR ET COORDONNÉES</text>
                    <text x="10" y="32" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" letter-spacing="0.5">📍 ${pLocation} // ${pSubLocation}</text>
                </g>
            </g>

            <!-- Bottom system diagnostic status keys -->
            <g transform="translate(30, 465)">
                <line x1="-10" y1="-10" x2="340" y2="-10" stroke="rgba(255,255,255,0.08)" stroke-width="0.8" />
                <text x="0" y="8" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.3)">MATRIX CORE v3.21 // EMULATED SYSTEM: OK</text>
                <text x="330" y="8" font-family="monospace" font-size="10" fill="#ffaa00" font-weight="bold" text-anchor="end">🪙 ${pCol.toLocaleString()} COL</text>
            </g>
        </g>

        <!-- Footer watermark -->
        <g transform="translate(60, ${height - 35})">
            <text font-family="'Arial Black', sans-serif" font-size="11" fill="rgba(255,255,255,0.25)" letter-spacing="4">© DBZ: KAKAROT CORE ADAPTATION // AETHERYS EVOLUTION ENGINE 2026</text>
        </g>
    </svg>
    `;

    let menuSharpInstance;
    if (hasBackdrop) {
        try {
            // Composite custom design on top of reference background
            const dimmedBackdrop = await sharp(kakarotRefPath)
                .resize(width, height, { fit: 'cover' })
                .blur(3)
                .linear(0.25, 0) // dim back for heavy readable text
                .toBuffer();

            menuSharpInstance = sharp(dimmedBackdrop)
                .composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
        } catch (e) {
            console.error("[Menu Generator] Error compositing reference backdrop:", e);
            menuSharpInstance = sharp(Buffer.from(svg));
        }
    } else {
        menuSharpInstance = sharp(Buffer.from(svg));
    }

    return menuSharpInstance.png().toBuffer();
}

module.exports = { generateMainMenuImage };
