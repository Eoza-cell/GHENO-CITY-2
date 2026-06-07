const { createCanvas, registerFont } = require('canvas');

/**
 * Generates a Canvas image for class selection with a grid of 13 classes.
 * @returns {Promise<Buffer>} The image buffer.
 */
async function generateClassSelectionImage() {
    const width = 1200;
    const height = 1000;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

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
        { name: 'CH.-DRAGON', color: '#ff5e00', bg: '#4a1c00', desc: 'Dragon & Cieux' },
        { name: 'ALCHIMISTE', color: '#00ff88', bg: '#004a28', desc: 'Science & Potions' },
        { name: 'BARDE', color: '#ff00aa', bg: '#4a0031', desc: 'Musique & Soutien' }
    ];

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = 'white';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CHOISISSEZ VOTRE CLASSE', width / 2, 60);

    const columns = 4;
    const cardWidth = 260;
    const cardHeight = 180;
    const marginX = 30;
    const marginY = 30;
    const startX = (width - (columns * cardWidth + (columns - 1) * marginX)) / 2;
    const startY = 120;

    classes.forEach((cls, i) => {
        const row = Math.floor(i / columns);
        const col = i % columns;
        const x = startX + col * (cardWidth + marginX);
        const y = startY + row * (cardHeight + marginY);

        // Card shadow/glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = cls.color;

        // Card Background
        ctx.fillStyle = cls.bg;
        ctx.beginPath();
        ctx.roundRect(x, y, cardWidth, cardHeight, 15);
        ctx.fill();

        ctx.shadowBlur = 0; // Reset shadow

        // Card border
        ctx.strokeStyle = cls.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Class Name
        ctx.fillStyle = cls.color;
        ctx.font = 'bold 24px Arial';
        ctx.fillText(cls.name, x + cardWidth / 2, y + 60);

        // Description
        ctx.fillStyle = '#cccccc';
        ctx.font = '16px Arial';
        ctx.fillText(cls.desc, x + cardWidth / 2, y + 100);

        // Decoration
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.roundRect(x + 20, y + 130, cardWidth - 40, 30, 8);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'italic 12px Arial';
        ctx.fillText('Sélectionnez via message', x + cardWidth / 2, y + 150);
    });

    return canvas.toBuffer('image/png');
}

module.exports = { generateClassSelectionImage };
