const sharp = require('sharp');
const { escapeXml } = require('./utils');

/**
 * Draws a highly stylized, vector-based SVG weapon design depending on its type, element, and stats.
 * Following the stats-based logical scaling requested by the user.
 * @param {string} name - Item name
 * @param {string} type - 'weapon' or 'clothing'
 * @param {string} rarity - common, rare, epic, legendary
 * @param {string} element - Feu, Eau, Terre, Vent, Light, Dark, None
 * @param {Object} stats - statBonuses (strength, agility, defense, intelligence, etc.)
 * @returns {string} SVG string group containing the weapon drawings.
 */
function drawItemDesign(name, type, rarity, element, stats) {
    // Normalization of variables
    const str = stats.strength || 0;
    const agi = stats.agility || 0;
    const def = stats.defense || 0;
    const int = stats.intelligence || 0;
    const luk = stats.luck || 0;

    // Determine primary color of design based on element or rarity
    let mainColor = '#ffffff';
    let energyColor = 'rgba(255,255,255,0.4)';
    if (element === 'Feu' || name.includes('[Feu]') || name.includes('flamme') || name.includes('brasier')) {
        mainColor = '#ff4500';
        energyColor = '#ff8c00';
    } else if (element === 'Eau' || name.includes('[Eau]') || name.includes('glace') || name.includes('torrent')) {
        mainColor = '#00bfff';
        energyColor = '#1e90ff';
    } else if (element === 'Terre' || name.includes('[Terre]') || name.includes('roc') || name.includes('cristal')) {
        mainColor = '#b8860b';
        energyColor = '#ffd700';
    } else if (element === 'Vent' || name.includes('[Vent]') || name.includes('souffle') || name.includes('tempête')) {
        mainColor = '#e0ffff';
        energyColor = '#ffffff';
    } else if (rarity === 'legendary') {
        mainColor = '#ffd700';
        energyColor = '#ff8c00';
    } else if (rarity === 'epic') {
        mainColor = '#da70d6';
        energyColor = '#ba55d3';
    } else if (rarity === 'rare') {
        mainColor = '#1e90ff';
        energyColor = '#00bfff';
    }

    // Determine star rating based on sum of stats (Logical progression)
    const statSum = str + agi + def + int + luk;
    let stars = 1;
    if (statSum > 45) stars = 5;
    else if (statSum > 25) stars = 4;
    else if (statSum > 12) stars = 3;
    else if (statSum > 5) stars = 2;

    // Detect weapon sub-type by name keywords
    const lowerName = name.toLowerCase();
    let weaponSubtype = 'sword'; // default
    if (lowerName.includes('dague') || lowerName.includes('dagger') || lowerName.includes('stylet')) weaponSubtype = 'dagger';
    else if (lowerName.includes('lance') || lowerName.includes('spear') || lowerName.includes('vouge')) weaponSubtype = 'spear';
    else if (lowerName.includes('bâton') || lowerName.includes('staff') || lowerName.includes('wand') || lowerName.includes('sceptre')) weaponSubtype = 'staff';
    else if (lowerName.includes('arc') || lowerName.includes('bow')) weaponSubtype = 'bow';
    else if (lowerName.includes('hache') || lowerName.includes('axe')) weaponSubtype = 'axe';
    else if (lowerName.includes('bouclier') || lowerName.includes('shield')) weaponSubtype = 'shield';
    else if (type === 'clothing') weaponSubtype = 'clothing';

    // Start drawing! We center the drawing inside a 200x200 box (cx=100, cy=100)
    let drawingSvg = '';

    // Draw unique design paths based on subtype
    switch (weaponSubtype) {
        case 'dagger': {
            // Dagger: shorter blade, curved, high agility theme
            const bladeCurve = agi > 10 ? 'Q 110,60 100,20 Q 90,60' : 'L 105,40 L 100,25 L 95,40';
            const bladeWidth = 10 + Math.min(10, str * 0.5); // high str makes it wider
            drawingSvg = `
                <!-- Hilt -->
                <rect x="96" y="140" width="8" height="35" fill="#444" rx="2" />
                <rect x="94" y="170" width="12" height="8" fill="${mainColor}" rx="2" />
                <!-- Crossguard -->
                <path d="M 85,140 Q 100,135 115,140 L 110,146 Q 100,142 90,146 Z" fill="${mainColor}" />
                <!-- Blade -->
                <path d="M ${100 - bladeWidth},138 ${bladeCurve} 100,20 Q ${100 + bladeWidth},60 ${100 + bladeWidth},138 Z" fill="url(#bladeGlowGrad)" stroke="${mainColor}" stroke-width="1.5" />
                <!-- Magic Rune for high intelligence -->
                ${int > 10 ? `<line x1="100" y1="120" x2="100" y2="60" stroke="#00ffff" stroke-width="1" stroke-dasharray="2,3" />` : ''}
            `;
            break;
        }
        case 'spear': {
            // Spear: very long shaft, pointed head
            const shaftLength = 130;
            const headWidth = 12 + Math.min(15, str * 0.4);
            drawingSvg = `
                <!-- Shaft -->
                <line x1="100" y1="190" x2="100" y2="55" stroke="#8b4513" stroke-width="4.5" />
                <line x1="100" y1="190" x2="100" y2="55" stroke="${mainColor}" stroke-width="1" opacity="0.4" />
                <!-- Grip wrapping -->
                <rect x="97" y="110" width="6" height="30" fill="#222" rx="1" />
                <rect x="97" y="150" width="6" height="20" fill="#222" rx="1" />
                <!-- Steel wings at base of head -->
                <path d="M 90,55 L 110,55 L 100,45 Z" fill="#666" />
                <!-- Massive Spear Head -->
                <path d="M 100,10 L ${100 - headWidth},45 L 97,55 L 103,52 L 100,45 L 100,10" fill="url(#bladeGlowGrad)" stroke="${mainColor}" stroke-width="1.5" />
                <path d="M 100,10 L ${100 + headWidth},45 L 103,55 L 97,52 L 100,45 L 100,10" fill="url(#bladeGlowGrad)" stroke="${mainColor}" stroke-width="1.5" />
            `;
            break;
        }
        case 'staff': {
            // Staff: ornate magical cane, Floating Elemental Orb
            const orbSize = 14 + Math.min(15, int * 0.3); // size scales with intelligence
            drawingSvg = `
                <!-- Wooden staff shaft -->
                <line x1="100" y1="190" x2="100" y2="60" stroke="#5c4033" stroke-width="5" rx="2" />
                <!-- Metallic braces -->
                <rect x="96" y="140" width="8" height="6" fill="${mainColor}" />
                <rect x="96" y="90" width="8" height="6" fill="${mainColor}" />
                <!-- Ornate crowning ring -->
                <circle cx="100" cy="55" r="24" fill="none" stroke="${mainColor}" stroke-width="3" />
                <path d="M 80,65 Q 100,35 120,65" fill="none" stroke="${mainColor}" stroke-width="2" />
                <!-- Floating core orb -->
                <circle cx="100" cy="55" r="${orbSize}" fill="url(#elementOrbGrad)" filter="url(#glowFilter)" />
                <!-- Floating magical shards for legendary staff -->
                ${rarity === 'legendary' ? `
                    <polygon points="72,40 76,44 70,46" fill="${mainColor}" />
                    <polygon points="128,40 124,44 130,46" fill="${mainColor}" />
                    <polygon points="100,20 104,25 96,25" fill="${mainColor}" />
                ` : ''}
            `;
            break;
        }
        case 'bow': {
            // Bow: Curved bow string, glowing arrow
            const bowPull = 80 + Math.min(30, agi * 0.5);
            drawingSvg = `
                <!-- Main Bow Curve -->
                <path d="M 60,30 Q ${bowPull},100 60,170" fill="none" stroke="${mainColor}" stroke-width="4.5" stroke-linecap="round" />
                <path d="M 60,30 Q ${bowPull - 4},100 60,170" fill="none" stroke="#222" stroke-width="1.5" />
                <!-- Bowstring -->
                <line x1="60" y1="30" x2="60" y2="170" stroke="#fff" stroke-width="1" opacity="0.6" />
                <!-- Arrow resting -->
                <line x1="50" y1="100" x2="125" y2="100" stroke="${mainColor}" stroke-width="2" />
                <!-- Arrowhead -->
                <polygon points="125,95 138,100 125,105" fill="#fff" filter="url(#glowFilter)" />
                <!-- Arrow fletching -->
                <path d="M 50,96 L 40,92 L 44,100 L 40,108 L 50,104 Z" fill="${mainColor}" />
            `;
            break;
        }
        case 'axe': {
            // Axe: heavy shaft, massive crescent blades
            const axeScale = 10 + Math.min(18, str * 0.4);
            drawingSvg = `
                <!-- Shaft -->
                <line x1="100" y1="190" x2="100" y2="35" stroke="#5c4033" stroke-width="5" />
                <!-- Grip -->
                <rect x="96" y="130" width="8" height="40" fill="#111" rx="2" />
                <!-- Shaft cap -->
                <polygon points="96,35 104,35 100,25" fill="${mainColor}" />
                <!-- Crescent Blade Left -->
                <path d="M 98,40 Q ${100 - axeScale * 2},30 ${100 - axeScale * 2.5},70 Q ${100 - axeScale},105 98,90 Z" fill="url(#bladeGlowGrad)" stroke="${mainColor}" stroke-width="2" />
                <!-- Crescent Blade Right (Double axe if high stats) -->
                ${str > 15 ? `
                    <path d="M 102,40 Q ${100 + axeScale * 2},30 ${100 + axeScale * 2.5},70 Q ${100 + axeScale},105 102,90 Z" fill="url(#bladeGlowGrad)" stroke="${mainColor}" stroke-width="2" />
                ` : ''}
                <!-- Central binding plate -->
                <rect x="92" y="50" width="16" height="25" fill="#333" stroke="${mainColor}" stroke-width="1.5" rx="3" />
            `;
            break;
        }
        case 'shield': {
            // Shield: heavy defensive plate
            const shieldWidth = 35 + Math.min(15, def * 0.3);
            drawingSvg = `
                <!-- Inner backing -->
                <path d="M 100,30 L ${100 - shieldWidth},50 L ${100 - shieldWidth + 8},120 L 100,170 L ${100 + shieldWidth - 8},120 L ${100 + shieldWidth},50 Z" fill="#222" stroke="${mainColor}" stroke-width="2" />
                <!-- Glowing central crest -->
                <path d="M 100,45 L ${100 - shieldWidth + 12},60 L ${100 - shieldWidth + 18},110 L 100,150 L ${100 + shieldWidth - 18},110 L ${100 + shieldWidth - 12},60 Z" fill="url(#elementOrbGrad)" stroke="#fff" stroke-width="1" opacity="0.8" />
                <!-- Steel boss rivets -->
                <circle cx="100" cy="95" r="8" fill="${mainColor}" stroke="#fff" stroke-width="1" />
                <!-- Decorative wings or crest details for high rank -->
                ${rarity === 'epic' || rarity === 'legendary' ? `
                    <line x1="${100 - shieldWidth}" y1="50" x2="${100 + shieldWidth}" y2="50" stroke="#ffd700" stroke-width="3" />
                    <polygon points="100,20 106,30 94,30" fill="#ffd700" />
                ` : ''}
            `;
            break;
        }
        case 'clothing': {
            // Clothing: protective wizard coat or plate chest, high defense/intel theme
            drawingSvg = `
                <!-- Shoulders and Coat -->
                <path d="M 65,55 L 80,45 L 120,45 L 135,55 L 140,85 L 125,95 L 135,175 L 65,175 L 75,95 L 60,85 Z" fill="#1b1c2e" stroke="${mainColor}" stroke-width="2" />
                <!-- Inside lining -->
                <path d="M 85,45 L 100,85 L 115,45" fill="none" stroke="${energyColor}" stroke-width="2.5" />
                <!-- Chestpiece Plate -->
                <rect x="85" y="90" width="30" height="45" fill="rgba(255,255,255,0.05)" stroke="${mainColor}" stroke-width="1.5" rx="4" />
                <!-- Core magic insignia -->
                <circle cx="100" cy="112" r="6" fill="${energyColor}" filter="url(#glowFilter)" />
            `;
            break;
        }
        default: {
            // Default elegant legendary sword design (cx=100, cy=100)
            const bladeLength = 110 + Math.min(25, str * 0.5);
            const crossguardWidth = 35 + Math.min(15, def * 0.4);
            const finalThickness = 8 + Math.min(8, str * 0.3); // high strength = thicker heavier claymore sword

            drawingSvg = `
                <!-- Hilt grip wrapping -->
                <rect x="96" y="130" width="8" height="45" fill="#4a2c11" rx="2" />
                <!-- Pommel -->
                <circle cx="100" cy="180" r="8" fill="${mainColor}" stroke="#ffffff" stroke-width="1.5" />

                <!-- Crossguard (Slanted for action feel) -->
                <path d="M ${100 - crossguardWidth},122 L ${100 + crossguardWidth},122 L 100,132 Z" fill="${mainColor}" stroke="#ffffff" stroke-width="1" />
                <circle cx="${100 - crossguardWidth}" cy="122" r="3" fill="#ffffff" />
                <circle cx="${100 + crossguardWidth}" cy="122" r="3" fill="#ffffff" />

                <!-- Sword Blade (with dynamic sizing) -->
                <path d="M ${100 - finalThickness},120 L ${100 - finalThickness + 2},${130 - bladeLength} L 100,${105 - bladeLength} L ${100 + finalThickness - 2},${130 - bladeLength} L ${100 + finalThickness},120 Z" fill="url(#bladeGlowGrad)" stroke="${mainColor}" stroke-width="1.8" />

                <!-- Central blade blood-groove (gouttière) -->
                <line x1="100" y1="115" x2="100" y2="${140 - bladeLength}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" stroke-linecap="round" />
            `;
            break;
        }
    }

    // Dynamic environmental aura effects based on elements
    let auraOverlay = '';
    if (element === 'Feu' || name.includes('[Feu]') || name.includes('flamme') || name.includes('brasier')) {
        auraOverlay = `
            <!-- Rising fire flames -->
            <path d="M 60,140 Q 40,90 100,30 Q 160,90 140,140 Z" fill="url(#fireAuraGrad)" opacity="0.25" filter="url(#glowFilter)" />
            <circle cx="75" cy="80" r="4" fill="#ffaa00" opacity="0.6" filter="url(#glowFilter)" />
            <circle cx="125" cy="65" r="3" fill="#ffd700" opacity="0.8" filter="url(#glowFilter)" />
            <circle cx="95" cy="40" r="5" fill="#ff4500" opacity="0.5" filter="url(#glowFilter)" />
        `;
    } else if (element === 'Eau' || name.includes('[Eau]') || name.includes('glace') || name.includes('torrent')) {
        auraOverlay = `
            <!-- Water vortex / bubbles -->
            <path d="M 100,100 M 50,100 A 50,50 0 1,1 150,100 A 50,50 0 1,1 50,100" fill="none" stroke="#00bfff" stroke-width="1.5" stroke-dasharray="10,15" opacity="0.5" filter="url(#glowFilter)" />
            <circle cx="60" cy="70" r="4" fill="#e0ffff" opacity="0.7" />
            <circle cx="140" cy="120" r="6" fill="#1e90ff" opacity="0.4" />
        `;
    } else if (element === 'Terre' || name.includes('[Terre]') || name.includes('roc') || name.includes('cristal')) {
        auraOverlay = `
            <!-- Crystalline earth shards -->
            <polygon points="50,110 58,102 54,122" fill="#ffd700" opacity="0.6" filter="url(#glowFilter)" />
            <polygon points="145,70 152,78 138,82" fill="#ffd700" opacity="0.7" filter="url(#glowFilter)" />
            <path d="M 70,150 L 130,150 L 100,170 Z" fill="#b8860b" opacity="0.3" />
        `;
    } else if (element === 'Vent' || name.includes('[Vent]') || name.includes('souffle') || name.includes('tempête')) {
        auraOverlay = `
            <!-- Swirling wind currents -->
            <path d="M 50,120 Q 100,80 150,120 M 55,60 Q 100,110 145,60" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.4" />
            <line x1="45" y1="90" x2="70" y2="90" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.3" />
            <line x1="130" y1="130" x2="155" y2="130" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.3" />
        `;
    }

    // Embed all vectors into a clean self-contained group
    return `
    <g transform="translate(10, 0)">
        <defs>
            <linearGradient id="bladeGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                <stop offset="50%" style="stop-color:${mainColor};stop-opacity:0.9" />
                <stop offset="100%" style="stop-color:#111111;stop-opacity:1" />
            </linearGradient>
            <radialGradient id="elementOrbGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                <stop offset="40%" style="stop-color:${mainColor};stop-opacity:0.8" />
                <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
            </radialGradient>
            <linearGradient id="fireAuraGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" style="stop-color:#ff4500;stop-opacity:0.7" />
                <stop offset="70%" style="stop-color:#ffaa00;stop-opacity:0.2" />
                <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
            </linearGradient>
            <filter id="glowFilter">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <!-- Dynamic element aura backdrop -->
        ${auraOverlay}

        <!-- Base weapon structure -->
        ${drawingSvg}
    </g>
    `;
}

/**
 * Generates an ultra-premium visual catalog for weapon items using SVG and Sharp.
 * Includes custom drawn vector items, rarity border gradients, stats bars and progress indicators.
 * @param {string} title - Catalog title
 * @param {Array} items - List of item records
 */
async function generateShopImage(title, items) {
    const cardWidth = 370;
    const cardHeight = 230;
    const margin = 20;
    const cols = 2;
    const rows = Math.ceil(items.length / cols);
    const headerHeight = 130;
    const footerHeight = 70;

    const width = 800;
    const height = headerHeight + (rows * (cardHeight + margin)) + footerHeight;

    const colors = {
        common: '#aaaaaa',
        rare: '#1e90ff',
        epic: '#bf00ff',
        legendary: '#ffd700'
    };

    let itemsSvg = '';
    items.forEach((item, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = margin + 15 + col * (cardWidth + margin);
        const y = headerHeight + row * (cardHeight + margin);

        const rarityColor = colors[item.rarity] || '#ffffff';
        const str = item.statBonuses?.strength || 0;
        const agi = item.statBonuses?.agility || 0;
        const def = item.statBonuses?.defense || 0;
        const int = item.statBonuses?.intelligence || 0;
        const luk = item.statBonuses?.luck || 0;

        // Calculate standard stats totals
        const statSum = str + agi + def + int + luk;
        let stars = 1;
        if (statSum > 45) stars = 5;
        else if (statSum > 25) stars = 4;
        else if (statSum > 12) stars = 3;
        else if (statSum > 5) stars = 2;

        const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars);

        // Render stat indicators as visual progress bars
        const maxStatVisual = 50; // normalization max
        const strBarWidth = Math.min(100, (str / maxStatVisual) * 100);
        const agiBarWidth = Math.min(100, (agi / maxStatVisual) * 100);
        const defBarWidth = Math.min(100, (def / maxStatVisual) * 100);
        const intBarWidth = Math.min(100, (int / maxStatVisual) * 100);

        // Determine specific item elements if defined
        const itemElement = item.name.includes('[Feu]') ? 'Feu' :
                            (item.name.includes('[Eau]') ? 'Eau' :
                            (item.name.includes('[Terre]') ? 'Terre' :
                            (item.name.includes('[Vent]') ? 'Vent' : 'None')));

        itemsSvg += `
            <g transform="translate(${x}, ${y})">
                <!-- Glowing glass card base -->
                <rect width="${cardWidth}" height="${cardHeight}" fill="rgba(8,10,25,0.85)" stroke="${rarityColor}" stroke-width="${item.rarity === 'legendary' ? 2.5 : 1.2}" rx="12" style="${item.rarity === 'legendary' || item.rarity === 'epic' ? `filter: drop-shadow(0 0 5px ${rarityColor})` : ''}" />
                <rect x="5" y="5" width="${cardWidth - 10}" height="${cardHeight - 10}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" rx="8" />

                <!-- Left Panel: Dynamic Vector Weapon Drawing -->
                <g transform="translate(10, 15)">
                    <!-- Drawing Background Portal -->
                    <circle cx="75" cy="100" r="60" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                    <circle cx="75" cy="100" r="50" fill="none" stroke="${rarityColor}" stroke-dasharray="3,6" opacity="0.25" />

                    <!-- Nested element-based visual generator -->
                    <g transform="translate(-25, 0)">
                        ${drawItemDesign(item.name, item.type, item.rarity, itemElement, item.statBonuses || {})}
                    </g>
                </g>

                <!-- Right Panel: Weapon Info & Stats Bars -->
                <g transform="translate(160, 20)">
                    <!-- Name -->
                    <text x="0" y="10" font-family="'Segoe UI', Arial, sans-serif" font-size="14" font-weight="900" fill="#ffffff" style="letter-spacing: -0.2px;">${escapeXml(item.name.toUpperCase().substring(0, 18))}</text>

                    <!-- Stars & Rarity Badge -->
                    <text x="0" y="28" font-family="Arial" font-size="12" fill="#ffd700" font-weight="bold">${starStr}</text>
                    <rect x="110" y="18" width="80" height="14" fill="rgba(255,255,255,0.05)" stroke="${rarityColor}" stroke-width="0.8" rx="3" />
                    <text x="150" y="29" font-family="monospace" font-size="9" fill="${rarityColor}" font-weight="bold" text-anchor="middle">${item.rarity.toUpperCase()}</text>

                    <!-- Price -->
                    <text x="0" y="52" font-family="Impact, Arial" font-size="18" fill="#ffd700" font-weight="bold" style="text-shadow: 1px 1px 2px black;">💰 ${item.price.toLocaleString()} COL</text>

                    <!-- Stat Bars -->
                    <g transform="translate(0, 65)">
                        <!-- STR -->
                        <text x="0" y="10" font-family="monospace" font-size="10" fill="#ff4d4d" font-weight="bold">FOR [${str}]</text>
                        <rect x="55" y="2" width="135" height="6" fill="rgba(255,255,255,0.1)" rx="3" />
                        <rect x="55" y="2" width="${Math.max(2, (strBarWidth / 100) * 135)}" height="6" fill="#ff4d4d" rx="3" />

                        <!-- AGI -->
                        <text x="0" y="25" font-family="monospace" font-size="10" fill="#33ff33" font-weight="bold">AGI [${agi}]</text>
                        <rect x="55" y="17" width="135" height="6" fill="rgba(255,255,255,0.1)" rx="3" />
                        <rect x="55" y="17" width="${Math.max(2, (agiBarWidth / 100) * 135)}" height="6" fill="#33ff33" rx="3" />

                        <!-- INT -->
                        <text x="0" y="40" font-family="monospace" font-size="10" fill="#00ffff" font-weight="bold">INT [${int}]</text>
                        <rect x="55" y="32" width="135" height="6" fill="rgba(255,255,255,0.1)" rx="3" />
                        <rect x="55" y="32" width="${Math.max(2, (intBarWidth / 100) * 135)}" height="6" fill="#00ffff" rx="3" />

                        <!-- DEF -->
                        <text x="0" y="55" font-family="monospace" font-size="10" fill="#ffcc00" font-weight="bold">DEF [${def}]</text>
                        <rect x="55" y="47" width="135" height="6" fill="rgba(255,255,255,0.1)" rx="3" />
                        <rect x="55" y="47" width="${Math.max(2, (defBarWidth / 100) * 135)}" height="6" fill="#ffcc00" rx="3" />
                    </g>

                    <!-- Durability -->
                    <text x="0" y="140" font-family="monospace" font-size="9" fill="rgba(255,255,255,0.4)">DURABILITÉ : ${item.durability || 100}/100</text>
                </g>
            </g>
        `;
    });

    const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="cyberGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#ff4500;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#ff8c00;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#ffd700;stop-opacity:1" />
                </linearGradient>
                <radialGradient id="headerBackGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style="stop-color:#ffaa00;stop-opacity:0.1" />
                    <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
                </radialGradient>
            </defs>

            <!-- Base Premium Background -->
            <rect width="100%" height="100%" fill="#03030b" />
            <rect width="100%" height="${headerHeight}" fill="url(#headerBackGlow)" />

            <!-- Tech Gridlines Overlay -->
            <g stroke="rgba(255,255,255,0.02)" stroke-width="1">
                ${Array.from({length: 15}).map((_, i) => `<line x1="0" y1="${i * 60}" x2="${width}" y2="${i * 60}" />`).join('')}
                ${Array.from({length: 20}).map((_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="${height}" />`).join('')}
            </g>

            <!-- Dynamic Header Header -->
            <g transform="translate(40, 50)">
                <path d="M -20,25 L 350,25" stroke="url(#cyberGoldGrad)" stroke-width="2" />
                <circle cx="350" cy="25" r="3" fill="#ffffff" />
                <text x="0" y="15" font-family="'Segoe UI', Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff" style="letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,140,0,0.5);">${escapeXml(title.toUpperCase())}</text>
                <text x="0" y="38" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.4)" style="letter-spacing: 2px;">BOUTIQUE D'ÉLITE // ANALYSE TACTIQUE DES ARMES EN DIRECT</text>
                <text x="720" y="15" font-family="monospace" font-size="14" fill="#ffd700" font-weight="bold" text-anchor="end">MATRIX_V2.0</text>
            </g>

            <!-- Rendered list of weapon grids -->
            ${itemsSvg}

            <!-- Footer Section -->
            <g transform="translate(400, ${height - 25})">
                <rect x="-240" y="-18" width="480" height="24" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" rx="5" />
                <text font-family="monospace" font-size="10" fill="rgba(255,255,255,0.4)" text-anchor="middle">UTILISEZ /ACHETER [NOM DE L'ARME] POUR COMMANDER • LES STATS DIRECTEMENT SYNC AVEC VOTRE PROFIL</text>
            </g>
        </svg>
    `;

    return await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}

module.exports = { generateShopImage };
