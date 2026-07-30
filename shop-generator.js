const sharp = require('sharp');
const axios = require('axios');
const crypto = require('crypto');
const { escapeXml } = require('./utils');

/**
 * Automatically converts legacy wikia.nocookie.net image URLs to robust gbf.wiki redirect-compatible thumb URLs.
 * @param {string} url - Unsafe or old Wikia URL
 * @returns {string} Robust gbf.wiki URL
 */
function convertWikiaToGbfWikiUrl(url) {
    if (!url) return url;
    if (url.includes('static.wikia.nocookie.net/gbf/images/')) {
        const parts = url.split('/');
        let filename = parts[parts.length - 1];
        filename = filename.replace(/\s+/g, '_');

        const hash = crypto.createHash('md5').update(filename).digest('hex');
        const c1 = hash[0];
        const c2 = hash.substring(0, 2);

        return `https://gbf.wiki/images/thumb/${c1}/${c2}/${filename}/200px-${filename}`;
    }
    return url;
}

/**
 * Helper to fetch and resize wikipedia / gbf.wiki weapon images with a strict timeout.
 * Returns a PNG buffer with transparency or null on failure.
 * @param {string} url - Wiki image URL
 * @param {number} size - Target square size (width and height)
 */
async function fetchWikiImageBuffer(url, size = 100) {
    if (!url || !url.startsWith('http')) return null;
    let targetUrl = url;
    if (url.includes('static.wikia.nocookie.net/gbf/images/')) {
        targetUrl = convertWikiaToGbfWikiUrl(url);
    }
    try {
        const res = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            timeout: 2500,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });
        return await sharp(res.data)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();
    } catch (e) {
        console.warn(`[Wiki Image Fetch] Failed to retrieve ${targetUrl}:`, e.message);
        return null;
    }
}

/**
 * Draws a highly stylized, vector-based SVG weapon design depending on its type, element, and stats.
 * Following the stats-based logical scaling requested by the user.
 * @param {string} name - Item name
 * @param {string} type - 'weapon' or 'clothing'
 * @param {string} rarity - common, rare, epic, legendary
 * @param {string} element - Feu, Eau, Terre, Vent, Light, Dark, None
 * @param {Object} stats - statBonuses (strength, agility, defense, intelligence, etc.)
 * @param {number} scale - scaling factor for detailed views
 * @returns {string} SVG string group containing the weapon drawings.
 */
function drawItemDesign(name, type, rarity, element, stats, scale = 1.0) {
    const str = stats.strength || 0;
    const agi = stats.agility || 0;
    const def = stats.defense || 0;
    const int = stats.intelligence || 0;
    const luk = stats.luck || 0;

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

    const statSum = str + agi + def + int + luk;
    let stars = 1;
    if (statSum > 45) stars = 5;
    else if (statSum > 25) stars = 4;
    else if (statSum > 12) stars = 3;
    else if (statSum > 5) stars = 2;

    const lowerName = name.toLowerCase();
    let weaponSubtype = 'sword'; // default
    if (lowerName.includes('dague') || lowerName.includes('dagger') || lowerName.includes('stylet')) weaponSubtype = 'dagger';
    else if (lowerName.includes('lance') || lowerName.includes('spear') || lowerName.includes('vouge')) weaponSubtype = 'spear';
    else if (lowerName.includes('bâton') || lowerName.includes('staff') || lowerName.includes('wand') || lowerName.includes('sceptre')) weaponSubtype = 'staff';
    else if (lowerName.includes('arc') || lowerName.includes('bow')) weaponSubtype = 'bow';
    else if (lowerName.includes('hache') || lowerName.includes('axe')) weaponSubtype = 'axe';
    else if (lowerName.includes('bouclier') || lowerName.includes('shield')) weaponSubtype = 'shield';
    else if (type === 'clothing') weaponSubtype = 'clothing';

    let drawingSvg = '';

    switch (weaponSubtype) {
        case 'dagger': {
            const bladeCurve = agi > 10 ? 'Q 110,60 100,20 Q 90,60' : 'L 105,40 L 100,25 L 95,40';
            const bladeWidth = 10 + Math.min(10, str * 0.5);
            drawingSvg = `
                <!-- Hilt -->
                <rect x="96" y="140" width="8" height="35" fill="#444" rx="2" />
                <rect x="94" y="170" width="12" height="8" fill="${mainColor}" rx="2" />
                <!-- Crossguard -->
                <path d="M 85,140 Q 100,135 115,140 L 110,146 Q 100,142 90,146 Z" fill="${mainColor}" />
                <!-- Blade -->
                <path d="M ${100 - bladeWidth},138 ${bladeCurve} 100,20 Q ${100 + bladeWidth},60 ${100 + bladeWidth},138 Z" fill="url(#bladeGlowGrad)" stroke="${mainColor}" stroke-width="1.5" />
                ${int > 10 ? `<line x1="100" y1="120" x2="100" y2="60" stroke="#00ffff" stroke-width="1" stroke-dasharray="2,3" />` : ''}
            `;
            break;
        }
        case 'spear': {
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
            const orbSize = 14 + Math.min(15, int * 0.3);
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
                ${rarity === 'legendary' ? `
                    <polygon points="72,40 76,44 70,46" fill="${mainColor}" />
                    <polygon points="128,40 124,44 130,46" fill="${mainColor}" />
                    <polygon points="100,20 104,25 96,25" fill="${mainColor}" />
                ` : ''}
            `;
            break;
        }
        case 'bow': {
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
                <path d="M 50,96 L 40,92 L 44,100 L 40,108 L 50,104 Z" fill="${mainColor}" />
            `;
            break;
        }
        case 'axe': {
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
                <!-- Crescent Blade Right -->
                ${str > 15 ? `
                    <path d="M 102,40 Q ${100 + axeScale * 2},30 ${100 + axeScale * 2.5},70 Q ${100 + axeScale},105 102,90 Z" fill="url(#bladeGlowGrad)" stroke="${mainColor}" stroke-width="2" />
                ` : ''}
                <rect x="92" y="50" width="16" height="25" fill="#333" stroke="${mainColor}" stroke-width="1.5" rx="3" />
            `;
            break;
        }
        case 'shield': {
            const shieldWidth = 35 + Math.min(15, def * 0.3);
            drawingSvg = `
                <!-- Inner backing -->
                <path d="M 100,30 L ${100 - shieldWidth},50 L ${100 - shieldWidth + 8},120 L 100,170 L ${100 + shieldWidth - 8},120 L ${100 + shieldWidth},50 Z" fill="#222" stroke="${mainColor}" stroke-width="2" />
                <!-- Glowing central crest -->
                <path d="M 100,45 L ${100 - shieldWidth + 12},60 L ${100 - shieldWidth + 18},110 L 100,150 L ${100 + shieldWidth - 18},110 L ${100 + shieldWidth - 12},60 Z" fill="url(#elementOrbGrad)" stroke="#fff" stroke-width="1" opacity="0.8" />
                <!-- Steel boss rivets -->
                <circle cx="100" cy="95" r="8" fill="${mainColor}" stroke="#fff" stroke-width="1" />
                ${rarity === 'epic' || rarity === 'legendary' ? `
                    <line x1="${100 - shieldWidth}" y1="50" x2="${100 + shieldWidth}" y2="50" stroke="#ffd700" stroke-width="3" />
                    <polygon points="100,20 106,30 94,30" fill="#ffd700" />
                ` : ''}
            `;
            break;
        }
        case 'clothing': {
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
            const finalThickness = 8 + Math.min(8, str * 0.3);

            drawingSvg = `
                <rect x="96" y="130" width="8" height="45" fill="#4a2c11" rx="2" />
                <circle cx="100" cy="180" r="8" fill="${mainColor}" stroke="#ffffff" stroke-width="1.5" />

                <path d="M ${100 - crossguardWidth},122 L ${100 + crossguardWidth},122 L 100,132 Z" fill="${mainColor}" stroke="#ffffff" stroke-width="1" />
                <circle cx="${100 - crossguardWidth}" cy="122" r="3" fill="#ffffff" />
                <circle cx="${100 + crossguardWidth}" cy="122" r="3" fill="#ffffff" />

                <path d="M ${100 - finalThickness},120 L ${100 - finalThickness + 2},${130 - bladeLength} L 100,${105 - bladeLength} L ${100 + finalThickness - 2},${130 - bladeLength} L ${100 + finalThickness},120 Z" fill="url(#bladeGlowGrad)" stroke="${mainColor}" stroke-width="1.8" />
                <line x1="100" y1="115" x2="100" y2="${140 - bladeLength}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" stroke-linecap="round" />
            `;
            break;
        }
    }

    let auraOverlay = '';
    if (element === 'Feu' || name.includes('[Feu]') || name.includes('flamme') || name.includes('brasier')) {
        auraOverlay = `
            <path d="M 60,140 Q 40,90 100,30 Q 160,90 140,140 Z" fill="url(#fireAuraGrad)" opacity="0.25" filter="url(#glowFilter)" />
            <circle cx="75" cy="80" r="4" fill="#ffaa00" opacity="0.6" filter="url(#glowFilter)" />
            <circle cx="125" cy="65" r="3" fill="#ffd700" opacity="0.8" filter="url(#glowFilter)" />
            <circle cx="95" cy="40" r="5" fill="#ff4500" opacity="0.5" filter="url(#glowFilter)" />
        `;
    } else if (element === 'Eau' || name.includes('[Eau]') || name.includes('glace') || name.includes('torrent')) {
        auraOverlay = `
            <path d="M 100,100 M 50,100 A 50,50 0 1,1 150,100 A 50,50 0 1,1 50,100" fill="none" stroke="#00bfff" stroke-width="1.5" stroke-dasharray="10,15" opacity="0.5" filter="url(#glowFilter)" />
            <circle cx="60" cy="70" r="4" fill="#e0ffff" opacity="0.7" />
            <circle cx="140" cy="120" r="6" fill="#1e90ff" opacity="0.4" />
        `;
    } else if (element === 'Terre' || name.includes('[Terre]') || name.includes('roc') || name.includes('cristal')) {
        auraOverlay = `
            <polygon points="50,110 58,102 54,122" fill="#ffd700" opacity="0.6" filter="url(#glowFilter)" />
            <polygon points="145,70 152,78 138,82" fill="#ffd700" opacity="0.7" filter="url(#glowFilter)" />
            <path d="M 70,150 L 130,150 L 100,170 Z" fill="#b8860b" opacity="0.3" />
        `;
    } else if (element === 'Vent' || name.includes('[Vent]') || name.includes('souffle') || name.includes('tempête')) {
        auraOverlay = `
            <path d="M 50,120 Q 100,80 150,120 M 55,60 Q 100,110 145,60" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.4" />
            <line x1="45" y1="90" x2="70" y2="90" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.3" />
            <line x1="130" y1="130" x2="155" y2="130" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.3" />
        `;
    }

    return `
    <g transform="scale(${scale}) translate(${(1 - scale) * 100}, ${(1 - scale) * 100}) translate(10, 0)">
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
        ${auraOverlay}
        ${drawingSvg}
    </g>
    `;
}

/**
 * Generates an ultra-premium visual catalog for weapons in a compact HORIZONTAL list layout
 * matching gbf.wiki/Weapon_Lists exactly. No giant progress bars, extremely clean.
 * @param {string} title - Catalog title
 * @param {Array} items - List of item records
 */
async function generateShopImage(title, items) {
    const cardWidth = 740;
    const cardHeight = 115;
    const margin = 15;
    const headerHeight = 135;
    const footerHeight = 70;

    const width = 800;
    const height = headerHeight + (items.length * (cardHeight + margin)) + footerHeight;

    const colors = {
        common: '#95a5a6',
        rare: '#2980b9',
        epic: '#8e44ad',
        legendary: '#f1c40f'
    };

    let itemsSvg = '';
    const resolvedImages = [];

    // Pre-fetch gbf.wiki images in parallel (resized specifically to match portal size)
    const imagePromises = items.map(async (item, i) => {
        if (item.imageUrl && item.imageUrl.startsWith('http')) {
            const buf = await fetchWikiImageBuffer(item.imageUrl, 90);
            if (buf) {
                const y = headerHeight + i * (cardHeight + margin);
                return { input: buf, left: 30 + 15, top: y + 12 };
            }
        }
        return null;
    });

    const resolved = await Promise.all(imagePromises);

    items.forEach((item, i) => {
        const y = headerHeight + i * (cardHeight + margin);
        const rarityColor = colors[item.rarity] || '#ffffff';

        const str = item.statBonuses?.strength || 0;
        const agi = item.statBonuses?.agility || 0;
        const def = item.statBonuses?.defense || 0;
        const int = item.statBonuses?.intelligence || 0;
        const luk = item.statBonuses?.luck || 0;

        const statSum = str + agi + def + int + luk;
        let stars = 1;
        if (statSum > 45) stars = 5;
        else if (statSum > 25) stars = 4;
        else if (statSum > 12) stars = 3;
        else if (statSum > 5) stars = 2;

        const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars);

        const itemElement = item.name.includes('[Feu]') ? 'Feu' :
                            (item.name.includes('[Eau]') ? 'Eau' :
                            (item.name.includes('[Terre]') ? 'Terre' :
                            (item.name.includes('[Vent]') ? 'Vent' : 'None')));

        const hasWikiImage = !!resolved[i];

        itemsSvg += `
            <g transform="translate(30, ${y})">
                <!-- Glowing glass horizontal card body -->
                <rect width="${cardWidth}" height="${cardHeight}" fill="rgba(10,12,24,0.85)" stroke="${rarityColor}" stroke-width="${item.rarity === 'legendary' ? 2 : 1.2}" rx="12" style="${item.rarity === 'legendary' || item.rarity === 'epic' ? `filter: drop-shadow(0 0 4px ${rarityColor})` : ''}" />
                <rect x="4" y="4" width="${cardWidth - 8}" height="${cardHeight - 8}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1" rx="9" />

                <!-- Left Portal: Weapon Art Frame -->
                <g transform="translate(10, 10)">
                    <rect width="115" height="95" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.08)" stroke-width="1" rx="8" />
                    <!-- Centered inner decorative target ring -->
                    <circle cx="57.5" cy="47.5" r="35" fill="none" stroke="${rarityColor}" stroke-dasharray="3,5" opacity="0.15" />

                    <!-- Vector drawing if wiki image load fails -->
                    ${!hasWikiImage ? `
                    <g transform="translate(-40, -50) scale(0.95)">
                        ${drawItemDesign(item.name, item.type, item.rarity, itemElement, item.statBonuses || {})}
                    </g>
                    ` : ''}
                </g>

                <!-- Middle Left Panel: Weapon Name, Element & Stars -->
                <g transform="translate(145, 18)">
                    <!-- Name (bold, crisp, clean) -->
                    <text x="0" y="12" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="900" fill="#ffffff" letter-spacing="0.2">${escapeXml(item.name.toUpperCase())}</text>

                    <!-- Stars string -->
                    <text x="0" y="32" font-family="Arial" font-size="12" fill="#f1c40f" font-weight="bold">${starStr}</text>

                    <!-- Element and Rarity pill badges -->
                    <g transform="translate(0, 44)">
                        <!-- Rarity Pill -->
                        <rect x="0" y="0" width="75" height="15" fill="rgba(255,255,255,0.04)" stroke="${rarityColor}" stroke-width="0.8" rx="4" />
                        <text x="37.5" y="11" font-family="monospace" font-size="8.5" font-weight="bold" fill="${rarityColor}" text-anchor="middle">${item.rarity.toUpperCase()}</text>

                        <!-- Element Pill -->
                        ${itemElement !== 'None' ? `
                        <rect x="82" y="0" width="45" height="15" fill="rgba(255,255,255,0.04)" stroke="${itemElement === 'Feu' ? '#e74c3c' : (itemElement === 'Eau' ? '#3498db' : (itemElement === 'Terre' ? '#d35400' : '#2ecc71'))}" stroke-width="0.8" rx="4" />
                        <text x="104.5" y="11" font-family="monospace" font-size="8.5" font-weight="bold" fill="${itemElement === 'Feu' ? '#e74c3c' : (itemElement === 'Eau' ? '#3498db' : (itemElement === 'Terre' ? '#d35400' : '#2ecc71'))}" text-anchor="middle">${itemElement.toUpperCase()}</text>
                        ` : ''}
                    </g>
                </g>

                <!-- Middle Right Panel: Stats Grid (Sleek side-by-side capsule indicators) -->
                <g transform="translate(385, 26)">
                    <!-- Compact 2x2 statistics grid layout -->
                    <!-- Row 1 -->
                    ${str > 0 ? `
                    <g transform="translate(0, 0)">
                        <rect width="80" height="22" fill="rgba(231,76,60,0.07)" stroke="#e74c3c" stroke-width="0.8" rx="5" />
                        <text x="40" y="15" font-family="monospace" font-size="10.5" font-weight="900" fill="#ff4d4d" text-anchor="middle">⚔️ FOR +${str}</text>
                    </g>
                    ` : ''}
                    ${agi > 0 ? `
                    <g transform="translate(90, 0)">
                        <rect width="80" height="22" fill="rgba(46,204,113,0.07)" stroke="#2ecc71" stroke-width="0.8" rx="5" />
                        <text x="40" y="15" font-family="monospace" font-size="10.5" font-weight="900" fill="#2ecc71" text-anchor="middle">⚡ AGI +${agi}</text>
                    </g>
                    ` : ''}

                    <!-- Row 2 -->
                    ${int > 0 ? `
                    <g transform="translate(0, 28)">
                        <rect width="80" height="22" fill="rgba(52,152,219,0.07)" stroke="#3498db" stroke-width="0.8" rx="5" />
                        <text x="40" y="15" font-family="monospace" font-size="10.5" font-weight="900" fill="#00e5ff" text-anchor="middle">🔮 INT +${int}</text>
                    </g>
                    ` : ''}
                    ${def > 0 ? `
                    <g transform="translate(90, 28)">
                        <rect width="80" height="22" fill="rgba(241,196,15,0.07)" stroke="#f1c40f" stroke-width="0.8" rx="5" />
                        <text x="40" y="15" font-family="monospace" font-size="10.5" font-weight="900" fill="#ffaa00" text-anchor="middle">🛡️ DEF +${def}</text>
                    </g>
                    ` : ''}
                </g>

                <!-- Right Panel: Buy Price in Coins -->
                <g transform="translate(580, 32)">
                    <text x="135" y="18" font-family="Impact, sans-serif" font-size="20" fill="#f1c40f" font-weight="bold" text-anchor="end" style="text-shadow: 0 0 5px rgba(241,196,15,0.45);">🪙 ${item.price.toLocaleString()} COL</text>
                    <!-- Durability tag -->
                    <text x="135" y="38" font-family="monospace" font-size="9" fill="rgba(255,255,255,0.3)" text-anchor="end">DURABILITÉ : ${item.durability || 100}/100</text>
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
            <rect width="100%" height="100%" fill="#04040a" />
            <rect width="100%" height="${headerHeight}" fill="url(#headerBackGlow)" />

            <!-- Tech Gridlines Overlay -->
            <g stroke="rgba(255,255,255,0.015)" stroke-width="1">
                ${Array.from({length: 20}).map((_, i) => `<line x1="0" y1="${i * 55}" x2="${width}" y2="${i * 55}" />`).join('')}
                ${Array.from({length: 20}).map((_, i) => `<line x1="${i * 55}" y1="0" x2="${i * 55}" y2="${height}" />`).join('')}
            </g>

            <!-- Title Header -->
            <g transform="translate(30, 50)">
                <path d="M 0,25 L 350,25" stroke="url(#cyberGoldGrad)" stroke-width="2.2" />
                <circle cx="350" cy="25" r="3" fill="#ffffff" />
                <text x="0" y="15" font-family="'Segoe UI', sans-serif" font-size="34" font-weight="900" fill="#ffffff" style="letter-spacing: 1.5px; text-shadow: 0 0 10px rgba(255,140,0,0.45);">${escapeXml(title.toUpperCase())}</text>
                <text x="0" y="38" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.4)" style="letter-spacing: 2px;">BOUTIQUE D'ÉLITE // LISTE DES ARMES D'AETHERYS</text>
                <text x="740" y="15" font-family="monospace" font-size="13" fill="#ffd700" font-weight="bold" text-anchor="end">MATRIX_V2.5</text>
            </g>

            <!-- List of horizontal weapons -->
            ${itemsSvg}

            <!-- Footer Section -->
            <g transform="translate(400, ${height - 25})">
                <rect x="-240" y="-18" width="480" height="24" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.04)" rx="5" />
                <text font-family="monospace" font-size="10" fill="rgba(255,255,255,0.45)" text-anchor="middle">UTILISEZ /ACHETER [NOM DE L'ARME] POUR COMMANDER • BASE DE DONNÉES SYNCHRONISÉE</text>
            </g>
        </svg>
    `;

    const emptyBg = await sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 4, g: 4, b: 10, alpha: 1 }
        }
    }).png().toBuffer();

    const composites = [{ input: Buffer.from(svg), top: 0, left: 0 }];
    resolved.forEach(img => {
        if (img) composites.push(img);
    });

    return await sharp(emptyBg)
        .composite(composites)
        .png()
        .toBuffer();
}

/**
 * Generates an extremely detailed single card image for any individual item.
 * Perfect for a full design visualization of the player's custom or legendary weapon.
 * @param {Object} item - Detailed Item object
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateDetailedItemCard(item) {
    const width = 600;
    const height = 850;

    const colors = {
        common: '#9e9e9e',
        rare: '#1e90ff',
        epic: '#bf00ff',
        legendary: '#ffd700'
    };
    const rarityColor = colors[item.rarity] || '#ffffff';

    const str = item.statBonuses?.strength || 0;
    const agi = item.statBonuses?.agility || 0;
    const def = item.statBonuses?.defense || 0;
    const int = item.statBonuses?.intelligence || 0;
    const luk = item.statBonuses?.luck || 0;

    const statSum = str + agi + def + int + luk;
    let stars = 1;
    if (statSum > 45) stars = 5;
    else if (statSum > 25) stars = 4;
    else if (statSum > 12) stars = 3;
    else if (statSum > 5) stars = 2;

    const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars);

    // Radar coordinate calculations for visual stats diagram
    const cx = 300;
    const cy = 630;
    const rMax = 110;
    const getPointStr = (statVal) => Math.min(1.0, statVal / 50.0);

    const pStrX = cx + 0 * rMax * Math.sin(0);
    const pStrY = cy - getPointStr(str) * rMax * Math.cos(0);

    const pAgiX = cx + getPointStr(agi) * rMax * Math.sin(72 * Math.PI / 180);
    const pAgiY = cy - getPointStr(agi) * rMax * Math.cos(72 * Math.PI / 180);

    const pIntX = cx + getPointStr(int) * rMax * Math.sin(144 * Math.PI / 180);
    const pIntY = cy - getPointStr(int) * rMax * Math.cos(144 * Math.PI / 180);

    const pDefX = cx + getPointStr(def) * rMax * Math.sin(216 * Math.PI / 180);
    const pDefY = cy - getPointStr(def) * rMax * Math.cos(216 * Math.PI / 180);

    const pLukX = cx + getPointStr(luk) * rMax * Math.sin(288 * Math.PI / 180);
    const pLukY = cy - getPointStr(luk) * rMax * Math.cos(288 * Math.PI / 180);

    const itemElement = item.name.includes('[Feu]') ? 'Feu' :
                        (item.name.includes('[Eau]') ? 'Eau' :
                        (item.name.includes('[Terre]') ? 'Terre' :
                        (item.name.includes('[Vent]') ? 'Vent' : 'None')));

    const wikiImageBuf = await fetchWikiImageBuffer(item.imageUrl, 220);
    const hasWikiImage = !!wikiImageBuf;

    const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="cyberBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#ff4500;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#ffd700;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#110033;stop-opacity:1" />
                </linearGradient>

                <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#07050f;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#0d0a1d;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#020108;stop-opacity:1" />
                </linearGradient>

                <filter id="premiumGlow">
                    <feGaussianBlur stdDeviation="10" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#cardGrad)" rx="24" />

            <rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="none" stroke="url(#cyberBorder)" stroke-width="2.5" rx="20" style="filter: drop-shadow(0 0 8px rgba(255, 69, 0, 0.45))" />
            <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1.2" rx="16" />

            <path d="M 5,45 L 5,5 L 45,5" fill="none" stroke="${rarityColor}" stroke-width="4" transform="translate(15, 15)" />
            <path d="M 555,45 L 555,5 L 515,5" fill="none" stroke="${rarityColor}" stroke-width="4" transform="translate(15, 15)" />
            <path d="M 5,785 L 5,825 L 45,825" fill="none" stroke="${rarityColor}" stroke-width="4" transform="translate(15, -5)" />
            <path d="M 555,785 L 555,825 L 515,825" fill="none" stroke="${rarityColor}" stroke-width="4" transform="translate(15, -5)" />

            <g transform="translate(50, 65)">
                <text x="0" y="10" font-family="'Impact', 'Arial Black', sans-serif" font-size="32" fill="#ffffff" style="letter-spacing: 1px; fill: url(#cyberBorder);">${escapeXml(item.name.toUpperCase())}</text>
                <text x="0" y="32" font-family="monospace" font-size="12" fill="${rarityColor}" font-weight="bold" letter-spacing="3">${item.rarity.toUpperCase()} ${item.type.toUpperCase()}</text>
                <text x="500" y="12" font-family="'Impact', sans-serif" font-size="28" fill="#ffd700" text-anchor="end">🪙 ${item.price.toLocaleString()}</text>
            </g>

            <g transform="translate(150, 110)">
                <circle cx="150" cy="180" r="140" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.04)" stroke-width="1.5" />
                <circle cx="150" cy="180" r="115" fill="none" stroke="${rarityColor}" stroke-dasharray="4,8" opacity="0.3" />

                <path d="M 25,180 A 125,125 0 0,1 275,180" fill="none" stroke="${rarityColor}" stroke-width="1" opacity="0.15" />
                <path d="M 25,180 A 125,125 0 0,0 275,180" fill="none" stroke="${rarityColor}" stroke-width="1" opacity="0.15" />

                ${!hasWikiImage ? `
                <g transform="translate(50, 80)">
                    ${drawItemDesign(item.name, item.type, item.rarity, itemElement, item.statBonuses || {}, 1.6)}
                </g>
                ` : ''}
            </g>

            <g transform="translate(50, 485)">
                <rect width="500" height="65" fill="rgba(255,255,255,0.01)" stroke="rgba(255,255,255,0.05)" rx="8" />
                <text x="15" y="24" font-family="'Segoe UI', sans-serif" font-size="13" font-style="italic" fill="#c1c2d0">${escapeXml(item.description)}</text>
                <text x="15" y="46" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.4)">ELEMENTAL ATTRIBUTE : ${itemElement.toUpperCase()} • DURABILITY: ${item.durability}/100</text>
                <text x="485" y="46" font-family="Arial" font-size="13" fill="#ffd700" font-weight="bold" text-anchor="end">${starStr}</text>
            </g>

            <g>
                ${[0.2, 0.4, 0.6, 0.8, 1.0].map((step) => {
                    const r = rMax * step;
                    const p1x = cx; const p1y = cy - r;
                    const p2x = cx + r * Math.sin(72*Math.PI/180); const p2y = cy - r * Math.cos(72*Math.PI/180);
                    const p3x = cx + r * Math.sin(144*Math.PI/180); const p3y = cy - r * Math.cos(144*Math.PI/180);
                    const p4x = cx + r * Math.sin(216*Math.PI/180); const p4y = cy - r * Math.cos(216*Math.PI/180);
                    const p5x = cx + r * Math.sin(288*Math.PI/180); const p5y = cy - r * Math.cos(288*Math.PI/180);
                    return `<polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y} ${p5x},${p5y}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1" />`;
                }).join('')}

                ${Array.from({length: 5}).map((_, i) => {
                    const angle = i * 72 * Math.PI / 180;
                    return `<line x1="${cx}" y1="${cy}" x2="${cx + rMax * Math.sin(angle)}" y2="${cy - rMax * Math.cos(angle)}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />`;
                }).join('')}

                <polygon points="${pStrX},${pStrY} ${pAgiX},${pAgiY} ${pIntX},${pIntY} ${pDefX},${pDefY} ${pLukX},${pLukY}" fill="rgba(255, 69, 0, 0.25)" stroke="#ff4500" stroke-width="2.5" style="filter: drop-shadow(0 0 3px #ff4500);" />

                <text x="${cx}" y="${cy - rMax - 10}" font-family="monospace" font-size="11" fill="#ff4d4d" font-weight="bold" text-anchor="middle">FOR [${str}]</text>
                <text x="${cx + rMax * Math.sin(72*Math.PI/180) + 12}" y="${cy - rMax * Math.cos(72*Math.PI/180)}" font-family="monospace" font-size="11" fill="#33ff33" font-weight="bold" text-anchor="start">AGI [${agi}]</text>
                <text x="${cx + rMax * Math.sin(144*Math.PI/180) + 12}" y="${cy - rMax * Math.cos(144*Math.PI/180) + 10}" font-family="monospace" font-size="11" fill="#00ffff" font-weight="bold" text-anchor="start">INT [${int}]</text>
                <text x="${cx + rMax * Math.sin(216*Math.PI/180) - 12}" y="${cy - rMax * Math.cos(216*Math.PI/180) + 10}" font-family="monospace" font-size="11" fill="#ffcc00" font-weight="bold" text-anchor="end">DEF [${def}]</text>
                <text x="${cx + rMax * Math.sin(288*Math.PI/180) - 12}" y="${cy - rMax * Math.cos(288*Math.PI/180)}" font-family="monospace" font-size="11" fill="#da70d6" font-weight="bold" text-anchor="end">LUK [${luk}]</text>

                <circle cx="${pStrX}" cy="${pStrY}" r="4" fill="#ffffff" stroke="#ff4d4d" stroke-width="1.5" />
                <circle cx="${pAgiX}" cy="${pAgiY}" r="4" fill="#ffffff" stroke="#33ff33" stroke-width="1.5" />
                <circle cx="${pIntX}" cy="${pIntY}" r="4" fill="#ffffff" stroke="#00ffff" stroke-width="1.5" />
                <circle cx="${pDefX}" cy="${pDefY}" r="4" fill="#ffffff" stroke="#ffcc00" stroke-width="1.5" />
                <circle cx="${pLukX}" cy="${pLukY}" r="4" fill="#ffffff" stroke="#da70d6" stroke-width="1.5" />
            </g>

            <g transform="translate(300, 805)">
                <line x1="-150" y1="-10" x2="150" y2="-10" stroke="rgba(255,255,255,0.06)" stroke-width="0.8" />
                <text font-family="monospace" font-size="9" fill="rgba(255,255,255,0.3)" text-anchor="middle">AETHERYS DEFENSE LABS V2 // UNIQUE CATALOG REGISTRY CODE #${Math.floor(Math.random() * 900000 + 100000)}</text>
            </g>
        </svg>
    `;

    const emptyBg = await sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 7, g: 5, b: 15, alpha: 1 }
        }
    }).png().toBuffer();

    const composites = [{ input: Buffer.from(svg), top: 0, left: 0 }];
    if (wikiImageBuf) {
        composites.push({ input: wikiImageBuf, left: 190, top: 180 });
    }

    return await sharp(emptyBg)
        .composite(composites)
        .png()
        .toBuffer();
}

module.exports = { generateShopImage, generateDetailedItemCard };
