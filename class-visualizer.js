const { createCanvas } = require('canvas');

/**
 * Helper to draw rounded rectangles for cross-version compatibility.
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Generates a Canvas image for class selection with a grid of 13 classes.
 * @returns {Promise<Buffer>} The image buffer.
 */
async function generateClassSelectionImage() {
    const width = 1200;
    const height = 1100;
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

    // Grid lines effect
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
    }
    for (let i = 0; i < height; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    // Title
    ctx.fillStyle = 'white';
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10; ctx.shadowColor = 'white';
    ctx.fillText('LINK START : CHOISIS TA CLASSE', width / 2, 80);
    ctx.shadowBlur = 0;

    const columns = 4;
    const cardWidth = 260;
    const cardHeight = 180;
    const marginX = 30;
    const marginY = 35;
    const startX = (width - (columns * cardWidth + (columns - 1) * marginX)) / 2;
    const startY = 150;

    classes.forEach((cls, i) => {
        const row = Math.floor(i / columns);
        const col = i % columns;
        const x = startX + col * (cardWidth + marginX);
        const y = startY + row * (cardHeight + marginY);

        // Card Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = cls.color;

        // Card Background
        ctx.fillStyle = cls.bg;
        drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 15);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Card Border
        ctx.strokeStyle = cls.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Class Name
        ctx.fillStyle = cls.color;
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(cls.name, x + cardWidth / 2, y + 60);

        // Description
        ctx.fillStyle = '#eeeeee';
        ctx.font = '16px sans-serif';
        ctx.fillText(cls.desc, x + cardWidth / 2, y + 100);

        // Footer button-like look
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        drawRoundedRect(ctx, x + 20, y + 130, cardWidth - 40, 30, 8);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'italic 13px sans-serif';
        ctx.fillText('Envoie le nom par message', x + cardWidth / 2, y + 150);
    });

    return canvas.toBuffer('image/png');
}

module.exports = { generateClassSelectionImage };
