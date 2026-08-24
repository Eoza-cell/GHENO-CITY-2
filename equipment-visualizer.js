const sharp = require('sharp');
const path = require('path');

/**
 * Generates an ultra-premium Oblique Diamond / Rhombus equipment and outfit visual status card.
 *
 * @param {Object} player Player object
 * @param {Object} equipment Status of each slot (head, chest, arms, legs, weapon, outfit)
 * @returns {Promise<Buffer>} The PNG image buffer.
 */
async function generateEquipmentStatusImage(player, equipment = {}) {
    const width = 800;
    const height = 650;

    const pName = player?.name ? player.name.toUpperCase() : "HÉRITIER";
    const pOutfit = player?.equippedOutfit || "Tenue Initiale d'Aventurier";
    const pDurability = player?.outfitDurability != null ? player.outfitDurability : 100;
    const pCleanliness = (player?.outfitCleanliness || "PROPRE").toUpperCase();
    const isTorn = pDurability < 50;

    const slotStates = {
        head: equipment.head || false,
        chest: equipment.chest || !!player?.equippedOutfit,
        arms: equipment.arms || false,
        legs: equipment.legs || false,
        weapon: equipment.weapon || false
    };

    const svgString = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#070514;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#03020a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#010003;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffe066"/>
                <stop offset="100%" style="stop-color:#ffd700"/>
            </linearGradient>

            <linearGradient id="cyan" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#00ffff"/>
                <stop offset="100%" style="stop-color:#0088ff"/>
            </linearGradient>

            <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <!-- Background -->
        <rect width="100%" height="100%" fill="url(#bgGrad)"/>

        <!-- Grid Lines -->
        <g stroke="rgba(0, 255, 255, 0.03)" stroke-width="1">
            ${Array.from({ length: 15 }).map((_, i) => `<line x1="0" y1="${i * 45}" x2="${width}" y2="${i * 45}" />`).join('')}
            ${Array.from({ length: 18 }).map((_, i) => `<line x1="${i * 45}" y1="0" x2="${i * 45}" y2="${height}" />`).join('')}
        </g>

        <!-- Header Panel -->
        <g transform="translate(50, 40)">
            <polygon points="15,0 700,0 680,50 0,50" fill="rgba(20, 14, 45, 0.8)" stroke="url(#gold)" stroke-width="2" filter="url(#glow)"/>
            <text x="30" y="32" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22" fill="#ffffff" letter-spacing="2">EQUIPEMENT &amp; TENUE ❖ ${pName}</text>
            <text x="650" y="32" font-family="monospace" font-size="11" fill="#00ffff" text-anchor="end">ATR_ARMOR_SYS</text>
        </g>

        <!-- Left Oblique Rhomboid Body Scanner -->
        <g transform="translate(50, 120)">
            <polygon points="20,0 340,0 315,480 0,480" fill="rgba(10, 6, 25, 0.7)" stroke="rgba(0, 255, 255, 0.3)" stroke-width="1.5"/>

            <!-- Character Body Parts Highlights -->
            <!-- Head -->
            <polygon points="170,40 190,40 180,65 160,65" fill="${slotStates.head ? '#00ffcc' : '#222'}" stroke="#d4af37" stroke-width="1.5" />
            <text x="170" y="30" font-family="sans-serif" font-size="10" font-weight="bold" fill="#00ffcc" text-anchor="middle">TÊTE</text>

            <!-- Chest / Armor -->
            <polygon points="140,80 220,80 200,200 120,200" fill="${slotStates.chest ? '#00ffcc' : '#222'}" stroke="#d4af37" stroke-width="1.5" opacity="${isTorn ? 0.6 : 0.9}"/>
            <text x="170" y="140" font-family="sans-serif" font-size="12" font-weight="bold" fill="#000" text-anchor="middle">BUSTE</text>

            <!-- Arms -->
            <polygon points="85,90 125,90 110,210 70,210" fill="${slotStates.arms ? '#00ffcc' : '#222'}" stroke="#d4af37" stroke-width="1.5"/>
            <polygon points="235,90 275,90 255,210 215,210" fill="${slotStates.arms ? '#00ffcc' : '#222'}" stroke="#d4af37" stroke-width="1.5"/>

            <!-- Legs -->
            <polygon points="125,210 160,210 140,380 105,380" fill="${slotStates.legs ? '#00ffcc' : '#222'}" stroke="#d4af37" stroke-width="1.5"/>
            <polygon points="175,210 210,210 190,380 155,380" fill="${slotStates.legs ? '#00ffcc' : '#222'}" stroke="#d4af37" stroke-width="1.5"/>

            <!-- Weapon Slot -->
            <polygon points="280,120 300,100 320,280 300,300" fill="${slotStates.weapon ? '#ffd700' : '#222'}" stroke="#ffd700" stroke-width="1.5"/>
            <text x="300" y="90" font-family="sans-serif" font-size="10" font-weight="bold" fill="#ffd700" text-anchor="middle">ARME ⚔️</text>
        </g>

        <!-- Right Oblique Rhomboid Outfit Stats Card -->
        <g transform="translate(420, 120)">
            <polygon points="20,0 330,0 305,480 0,480" fill="rgba(15, 10, 35, 0.85)" stroke="url(#gold)" stroke-width="2"/>

            <g transform="translate(30, 40)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="14" font-weight="900" fill="#ffd700" letter-spacing="1">❖ TENUE ÉQUIPÉE ACTUELLE</text>
                <text x="0" y="28" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${pOutfit}</text>

                <line x1="0" y1="42" x2="260" y2="42" stroke="rgba(255,215,0,0.3)" stroke-width="1"/>

                <!-- Durability Gauge -->
                <text x="0" y="80" font-family="sans-serif" font-size="11" font-weight="bold" fill="#00ffff" letter-spacing="1">DURABILITÉ DU VÊTEMENT</text>
                <text x="250" y="80" font-family="monospace" font-size="11" font-weight="bold" fill="#00ffff" text-anchor="end">${pDurability}%</text>
                <rect x="0" y="90" width="250" height="8" fill="rgba(255,255,255,0.1)" rx="4"/>
                <rect x="0" y="90" width="${pDurability * 2.5}" height="8" fill="${pDurability < 30 ? '#ff3300' : '#00ffcc'}" rx="4" filter="url(#glow)"/>

                <!-- Cleanliness & State -->
                <text x="0" y="130" font-family="sans-serif" font-size="11" font-weight="bold" fill="#aaa">ÉTAT DE PROPRETÉ</text>
                <text x="0" y="152" font-family="sans-serif" font-size="16" font-weight="bold" fill="${pCleanliness.includes('SANG') ? '#ff3300' : '#00ffcc'}">🧼 ${pCleanliness}</text>

                <!-- Integrity Warning -->
                <text x="0" y="190" font-family="sans-serif" font-size="11" font-weight="bold" fill="#aaa">INTÉGRITÉ DE LA TENUE</text>
                <text x="0" y="212" font-family="sans-serif" font-size="15" font-weight="bold" fill="${isTorn ? '#ff3300' : '#00e676'}">
                    ${isTorn ? '⚠️ DÉCHIRÉE / ENDOMMAGÉE' : '✅ TENUE INTACTE'}
                </text>

                <!-- Defense Bonus -->
                <rect x="0" y="250" width="250" height="80" fill="rgba(0,255,204,0.05)" stroke="#00ffcc" stroke-width="1" rx="8"/>
                <text x="15" y="280" font-family="sans-serif" font-size="13" font-weight="bold" fill="#00ffcc">🛡️ DÉFENSE PHYSIQUE : +${Math.round(pDurability * 0.2)} DEF</text>
                <text x="15" y="305" font-family="sans-serif" font-size="11" fill="rgba(255,255,255,0.6)">Prends soin de ta tenue avec /laver et /reparer !</text>
            </g>
        </g>

        <!-- Footer -->
        <g transform="translate(50, 620)">
            <text font-family="monospace" font-size="10" fill="rgba(255,255,255,0.3)">© AFTER THE REBIRTH • ARMOR VISUAL ENGINE</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svgString)).png().toBuffer();
}

module.exports = { generateEquipmentStatusImage };
