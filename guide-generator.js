const sharp = require('sharp');
const { escapeXml } = require('./utils');

/**
 * Generates an ultra-premium, modern visual guide infographic card based on selected topics.
 * @param {number} page - The guide page index (1 to 4)
 */
async function generateGuideImage(page) {
    const width = 1100;
    const height = 700;

    let title = "GUIDE DU JOUEUR : CODES ET RÈGLES";
    let subtitle = "LES SYSTÈMES ET MÉCANIQUES DE GHENO-CITY";
    let color = "#00ffff"; // Neon Cyan

    // Content structures depending on page index
    let rows = [];

    if (page === 1) {
        title = "GUIDE I : STATISTIQUES & RANGS";
        subtitle = "NORMALISATION ET LIMITES DE PUISSANCE";
        color = "#ff3c00"; // Ruby Red
        rows = [
            { label: "⚔️ FOR (FORCE)", desc: "Augmente vos dégâts physiques dévastateurs et physiques de mêlée." },
            { label: "🌀 AGI (AGILITÉ)", desc: "Augmente votre vitesse de déplacement, votre capacité d'esquive et de fuite." },
            { label: "🔮 INT (INTELLIGENCE)", desc: "Augmente la puissance de vos sorts arcaniques, magies élémentaires et soins." },
            { label: "🛡️ DEF (DÉFENSE)", desc: "Réduit les dégâts brutaux infligés par les attaques adverses physiques." },
            { label: "🍀 LUK (LUCK)", desc: "Augmente les chances de coups critiques, drops d'objets rares et réussite d'actions." },
            { label: "🎖️ RANGS ET CAPS", desc: "Caps de stats max : Rang F: 50 | E: 100 | D: 150 | C: 250 | B: 400 | A: 600 | S: 1000." }
        ];
    } else if (page === 2) {
        title = "GUIDE II : COMBAT & BATTLE IQ";
        subtitle = "LÉTHALITÉ EXTENSION ET COMBATS STRATÉGIQUES";
        color = "#00e5ff"; // Bright Cyan
        rows = [
            { label: "💀 LÉTHALITÉ ABSOLUE", desc: "Si vos PV tombent à 0, vous mourez sur le coup ! Soyez extrêmement prudent." },
            { label: "🧠 INTÉLLIGENCE DE COMBAT", desc: "Les adversaires sont redoutables. Prévoyez leurs contres et réagissez tactiquement." },
            { label: "⚡ CHANCE DE RÉACT", desc: "Même face au danger extrême, le MJ vous laisse toujours une chance de réagir." },
            { label: "🌌 EXTENSION (RANG S)", desc: "Technique ultime de Rang S. Elle piège uniquement les cibles dans un rayon de 5m." },
            { label: "📍 PROXIMITÉ DE 5 METRES", desc: "La distance réelle est calculée et visible dans /joueurs ou lors des actions RP." },
            { label: "🔥 COMBO ET ÉLÉMENTS", desc: "Fusionnez vos éléments avec d'autres mages pour déclencher des combos élémentaires." }
        ];
    } else if (page === 3) {
        title = "GUIDE III : SURVIE & ALIMENTS";
        subtitle = "GÉRER LA FAIM, LE SOMMEIL ET L'ÉPOUISEMENT";
        color = "#00e676"; // Emerald Green
        rows = [
            { label: "🍖 FAIM ET INANITION", desc: "La faim diminue à chaque action physique. À 0, vous perdez du sang régulièrement." },
            { label: "💤 SOMMEIL & FATIGUE", desc: "Le manque de sommeil inflige des malus d'Agilité et réduit la régénération de Mana." },
            { label: "🍞 ALIMENTATION (PAIN)", desc: "Consommez du Pain (Pain/Viande) pour récupérer instantanément +45 de Faim." },
            { label: "☕ CAFEINE & ÉNERGIE", desc: "Boire du Café ou dormir restaure immédiatement +45 de votre barre de Sommeil." },
            { label: "🧼 PROPRETÉ & VÊTEMENT", desc: "Des habits sales/déchirés rendent la milice méfiante et les marchands hostiles." },
            { label: "🤢 POISON ET STATUT", desc: "Le poison inflige des dégâts constants à chaque tour d'action. Purgez-le vite !" }
        ];
    } else {
        page = 4;
        title = "GUIDE IV : CARRIÈRE POLITIQUE";
        subtitle = "ÉLECTIONS, CAMPAGNES ET CONQUÊTE DU POUVOIR";
        color = "#ffd700"; // Gold
        rows = [
            { label: "🗳️ CANDIDATURES", desc: "Tout citoyen peut briguer un mandat politique local (Conseiller, Chancelier, Maire)." },
            { label: "📢 CAMPAGNES PUBLIQUES", desc: "Organisez des campagnes d'affichage, distribuez des tracts et donnez des discours." },
            { label: "💬 PROMISSES & DÉBATS", desc: "Participez à des débats enflammés sur la place publique face à vos rivaux politiques." },
            { label: "👥 INFLUENCE ET POPULARITÉ", desc: "Gagnez le respect et l'influence des citoyens (PNJ) pour récolter de précieuses voix." },
            { label: "⚖️ MANDAT DE POUVOIR", desc: "Une fois élu, édictez des lois régionales, ajustez les taxes et dirigez la milice." },
            { label: "🤝 CORRUPTION & INTRIGUES", desc: "Sachez corrompre les bonnes personnes en pièces de Col ou manipuler l'opinion." }
        ];
    }

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="obsidianBack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0a0718;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#010103;stop-opacity:1" />
            </linearGradient>

            <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
                <stop offset="100%" style="stop-color:#003366;stop-opacity:1" />
            </linearGradient>

            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <!-- Solid Background -->
        <rect width="100%" height="100%" fill="url(#obsidianBack)" />

        <!-- Futuristic Hexagonal Grid Backdrop -->
        <g stroke="rgba(255, 255, 255, 0.015)" stroke-width="1.2">
            ${Array.from({ length: 14 }).map((_, i) => `<line x1="0" y1="${i * 55}" x2="${width}" y2="${i * 55}" />`).join('')}
            ${Array.from({ length: 22 }).map((_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${height}" />`).join('')}
        </g>

        <!-- Glowing border accents -->
        <rect x="15" y="15" width="${width - 30}" height="${height - 30}" fill="none" stroke="${color}" stroke-width="1" opacity="0.15" rx="16" />
        <rect x="25" y="25" width="${width - 50}" height="${height - 50}" fill="none" stroke="${color}" stroke-width="1.8" opacity="0.65" rx="12" style="filter: url(#softGlow)" />

        <!-- Title block -->
        <g transform="translate(60, 75)">
            <rect x="-10" y="5" width="6" height="65" fill="${color}" style="filter: url(#softGlow)" />
            <text x="15" y="32" font-family="'Segoe UI', sans-serif" font-size="34" font-weight="900" fill="#ffffff" letter-spacing="3">${escapeXml(title)}</text>
            <text x="15" y="55" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="700" fill="${color}" letter-spacing="4" opacity="0.95">${escapeXml(subtitle)}</text>
        </g>

        <!-- Right Side Page Index Selector Visual -->
        <g transform="translate(${width - 240}, 75)">
            ${[1, 2, 3, 4].map((p, idx) => {
                const isActive = p === page;
                const dotColor = isActive ? color : 'rgba(255,255,255,0.15)';
                const textColor = isActive ? '#0a0718' : 'rgba(255,255,255,0.4)';
                const fillStyle = isActive ? dotColor : 'none';
                const strokeStyle = isActive ? 'none' : 'rgba(255,255,255,0.2)';
                return `
                <g transform="translate(${idx * 42}, 15)">
                    <circle cx="15" cy="15" r="14" fill="${fillStyle}" stroke="${strokeStyle}" stroke-width="1.5" />
                    <text x="15" y="20" font-family="monospace" font-size="12" font-weight="900" fill="${textColor}" text-anchor="middle">${p}</text>
                </g>
                `;
            }).join('')}
            <text x="-15" y="35" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.3)" text-anchor="end">MODULES DE CONSEIL :</text>
        </g>

        <!-- 2x3 Grid Content Cards (Total 6 segments) -->
        <g transform="translate(60, 175)">
            ${rows.map((row, idx) => {
                const isLeft = idx % 2 === 0;
                const x = isLeft ? 0 : 510;
                const y = Math.floor(idx / 2) * 155;
                const cardWidth = 470;
                const cardHeight = 135;

                return `
                <g transform="translate(${x}, ${y})">
                    <!-- Glassmorphic Card Background -->
                    <rect width="${cardWidth}" height="${cardHeight}" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.07)" stroke-width="1" rx="10" />
                    <rect x="5" y="5" width="${cardWidth - 10}" height="${cardHeight - 10}" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.15" rx="8" />

                    <!-- Corner indicator -->
                    <path d="M 12,24 L 12,12 L 24,12" fill="none" stroke="${color}" stroke-width="2.2" opacity="0.8" style="filter: url(#softGlow)" />
                    <circle cx="${cardWidth - 20}" cy="20" r="3" fill="${color}" opacity="0.5" />

                    <!-- Content texts -->
                    <text x="30" y="42" font-family="'Segoe UI', sans-serif" font-size="17" font-weight="900" fill="#ffffff" letter-spacing="1.5">${escapeXml(row.label)}</text>

                    <!-- Structured Paragraph Block -->
                    <text x="30" y="70" font-family="'Segoe UI', sans-serif" font-size="12.5" fill="rgba(255,255,255,0.6)" width="${cardWidth - 60}">
                        <tspan x="30" dy="0">${escapeXml(row.desc.substring(0, 58))}</tspan>
                        ${row.desc.length > 58 ? `<tspan x="30" dy="18">${escapeXml(row.desc.substring(58, 120))}</tspan>` : ''}
                    </text>
                </g>
                `;
            }).join('')}
        </g>

        <!-- Interactive bottom footer -->
        <g transform="translate(60, ${height - 55})">
            <line x1="0" y1="0" x2="${width - 120}" y2="0" stroke="rgba(255,255,255,0.07)" stroke-width="1.2" />
            <text x="0" y="24" font-family="'Segoe UI', sans-serif" font-size="11" fill="rgba(255,255,255,0.2)" letter-spacing="3">CONSEIL D'AETHERYS • TAPEZ /GUIDE [INDEX] POUR CHANGER DE PAGE</text>
            <text x="${width - 120}" y="24" font-family="monospace" font-size="11" fill="${color}" font-weight="bold" text-anchor="end" style="filter: url(#softGlow)">STATUS: PRÊT // MODULE_PAGE_${page}_SYNCHRONISÉ</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateGuideImage };
