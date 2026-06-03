const sharp = require('sharp');

/**
 * Generates an SVG image for class selection with a grid of 13 classes.
 * @returns {Promise<Buffer>} The image buffer.
 */
async function generateClassSelectionImage() {
    const width = 1000;
    const height = 800;
    const columns = 4;
    const cardWidth = 220;
    const cardHeight = 160;
    const margin = 20;

    const classes = [
        { name: 'GUERRIER', color: '#ff4d4d', bg: '#4a1a1a', desc: 'Force & Défense' },
        { name: 'MAGE', color: '#4d4dff', bg: '#1a1a4a', desc: 'Magie & Intelligence' },
        { name: 'ASSASSIN', color: '#4dff4d', bg: '#1a4a1a', desc: 'Agilité & Vitesse' },
        { name: 'ARCHER', color: '#ffea00', bg: '#4a4100', desc: 'Précision & Distance' },
        { name: 'PRÊTRE', color: '#ffffff', bg: '#4a4a4a', desc: 'Soin & Lumière' },
        { name: 'MOINE', color: '#ffa500', bg: '#4a2d00', desc: 'Combat & Esprit' },
        { name: 'PALADIN', color: '#00fbff', bg: '#00434a', desc: 'Protection & Sacré' },
        { name: 'INVOCATEUR', color: '#ff00ff', bg: '#4a004a', desc: 'Créatures & Pactes' },
        { name: 'NÉCROMANCIEN', color: '#a200ff', bg: '#2a004a', desc: 'Mort & Ombres' },
        { name: 'SAMOURAÏ', color: '#ff0055', bg: '#4a0019', desc: 'Honneur & Lame' },
        { name: 'CHEVALIER-DRAGON', color: '#ff5e00', bg: '#4a1c00', desc: 'Dragon & Cieux' },
        { name: 'ALCHIMISTE', color: '#00ff88', bg: '#004a28', desc: 'Science & Potions' },
        { name: 'BARDE', color: '#ff00aa', bg: '#4a0031', desc: 'Musique & Soutien' }
    ];

    let svgContent = `<rect width="100%" height="100%" fill="#0a0a0a" />`;
    svgContent += `<text x="${width / 2}" y="50" font-family="Arial" font-size="32" fill="white" text-anchor="middle" font-weight="bold">CHOISISSEZ VOTRE CLASSE</text>`;

    classes.forEach((cls, i) => {
        const row = Math.floor(i / columns);
        const col = i % columns;
        const x = margin + col * (cardWidth + margin);
        const y = 80 + row * (cardHeight + margin);

        svgContent += `
            <g transform="translate(${x}, ${y})">
                <rect width="${cardWidth}" height="${cardHeight}" rx="10" fill="${cls.bg}" stroke="${cls.color}" stroke-width="2" />
                <text x="${cardWidth / 2}" y="60" font-family="Arial" font-size="18" fill="${cls.color}" text-anchor="middle" font-weight="bold">${cls.name}</text>
                <text x="${cardWidth / 2}" y="100" font-family="Arial" font-size="12" fill="#cccccc" text-anchor="middle">${cls.desc}</text>
                <rect x="20" y="120" width="${cardWidth - 40}" height="20" rx="5" fill="#00000033" />
                <text x="${cardWidth / 2}" y="135" font-family="Arial" font-size="10" fill="white" text-anchor="middle" font-style="italic">Cliquez pour choisir</text>
            </g>
        `;
    });

    const svgString = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            ${svgContent}
        </svg>
    `;

    return sharp(Buffer.from(svgString)).png().toBuffer();
}

module.exports = { generateClassSelectionImage };
