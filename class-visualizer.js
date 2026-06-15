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
 * Draws an oblique (diagonal-cut) card panel. The top-left and bottom-right
 * corners are clipped to give a dynamic, anime "tech-card" silhouette.
 */
function drawObliqueCard(ctx, x, y, w, h, cut) {
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
}

/**
 * Draws a simple stylized silhouette emblem for a class.
 * Pure geometric shapes (no copyrighted characters), tinted with the class color.
 */
function drawClassEmblem(ctx, type, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.06);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const s = size;

    const sword = () => {
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(0, s * 0.4);
        ctx.moveTo(-s * 0.4, s * 0.4); ctx.lineTo(s * 0.4, s * 0.4); // guard
        ctx.moveTo(0, s * 0.4); ctx.lineTo(0, s * 0.8); // grip
        ctx.stroke();
    };
    const staff = () => {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.6); ctx.lineTo(0, s); // shaft
        ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -s * 0.7, s * 0.35, 0, Math.PI * 2); ctx.stroke(); // orb
    };
    const dagger = () => {
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, -s * 0.5); ctx.lineTo(s * 0.5, s * 0.5);
        ctx.moveTo(s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.5, s * 0.5);
        ctx.stroke();
    };
    const bow = () => {
        ctx.beginPath(); ctx.arc(0, 0, s * 0.8, -Math.PI / 2.2, Math.PI / 2.2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s * 0.55, -s * 0.62); ctx.lineTo(s * 0.55, s * 0.62); // string
        ctx.moveTo(s * 0.55, 0); ctx.lineTo(-s * 0.9, 0); // arrow
        ctx.stroke();
    };
    const cross = () => {
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(0, s);
        ctx.moveTo(-s * 0.6, -s * 0.3); ctx.lineTo(s * 0.6, -s * 0.3);
        ctx.stroke();
    };
    const fist = () => {
        ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) { ctx.moveTo(i * s * 0.3, -s * 0.6); ctx.lineTo(i * s * 0.3, -s * 0.9); }
        ctx.stroke();
    };
    const shield = () => {
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, -s * 0.6);
        ctx.lineTo(s * 0.7, s * 0.2); ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.7, s * 0.2); ctx.lineTo(-s * 0.7, -s * 0.6);
        ctx.closePath(); ctx.stroke();
    };
    const summon = () => {
        ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
            const a2 = a + Math.PI * 4 / 5;
            ctx.moveTo(Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8);
            ctx.lineTo(Math.cos(a2) * s * 0.8, Math.sin(a2) * s * 0.8);
        }
        ctx.stroke(); // pentagram
    };
    const skull = () => {
        ctx.beginPath(); ctx.arc(0, -s * 0.2, s * 0.55, Math.PI, 0); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s * 0.55, -s * 0.2); ctx.lineTo(-s * 0.55, s * 0.2);
        ctx.lineTo(s * 0.55, s * 0.2); ctx.lineTo(s * 0.55, -s * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-s * 0.22, -s * 0.15, s * 0.12, 0, Math.PI * 2);
        ctx.arc(s * 0.22, -s * 0.15, s * 0.12, 0, Math.PI * 2);
        ctx.fill(); // eyes
    };
    const katana = () => {
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, s * 0.7); ctx.quadraticCurveTo(0, -s * 0.2, s * 0.8, -s * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-s * 0.85, s * 0.55); ctx.lineTo(-s * 0.55, s * 0.85); // guard
        ctx.stroke();
    };
    const dragon = () => {
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, s * 0.6);
        ctx.quadraticCurveTo(-s * 0.2, -s * 0.9, s * 0.8, -s * 0.4);
        ctx.stroke();
        ctx.beginPath(); // wing
        ctx.moveTo(0, -s * 0.35); ctx.lineTo(s * 0.5, -s); ctx.lineTo(s * 0.6, -s * 0.2);
        ctx.stroke();
    };
    const flask = () => {
        ctx.beginPath();
        ctx.moveTo(-s * 0.25, -s * 0.7); ctx.lineTo(-s * 0.25, -s * 0.2);
        ctx.lineTo(-s * 0.6, s * 0.7); ctx.lineTo(s * 0.6, s * 0.7);
        ctx.lineTo(s * 0.25, -s * 0.2); ctx.lineTo(s * 0.25, -s * 0.7);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 0.7); ctx.lineTo(s * 0.35, -s * 0.7); ctx.stroke();
    };
    const note = () => {
        ctx.beginPath();
        ctx.moveTo(s * 0.4, -s * 0.8); ctx.lineTo(s * 0.4, s * 0.4);
        ctx.stroke();
        ctx.beginPath(); ctx.ellipse(s * 0.15, s * 0.4, s * 0.28, s * 0.2, -0.4, 0, Math.PI * 2); ctx.fill();
    };

    const emblems = {
        sword, staff, dagger, bow, cross, fist, shield, summon, skull, katana, dragon, flask, note
    };
    (emblems[type] || sword)();
    ctx.restore();
}

const CLASSES = [
    { name: 'GUERRIER', color: '#ff4d4d', bg: '#3a1414', desc: 'Force & Défense', emblem: 'sword' },
    { name: 'MAGE', color: '#4d8bff', bg: '#14213a', desc: 'Magie & Intelligence', emblem: 'staff' },
    { name: 'ASSASSIN', color: '#4dff7a', bg: '#143a1f', desc: 'Agilité & Vitesse', emblem: 'dagger' },
    { name: 'ARCHER', color: '#ffd24d', bg: '#3a2f14', desc: 'Précision & Distance', emblem: 'bow' },
    { name: 'PRÊTRE', color: '#f5f5f5', bg: '#33373a', desc: 'Soin & Lumière', emblem: 'cross' },
    { name: 'MOINE', color: '#ffa64d', bg: '#3a2414', desc: 'Combat & Esprit', emblem: 'fist' },
    { name: 'PALADIN', color: '#4df2ff', bg: '#0f3a3d', desc: 'Protection & Sacré', emblem: 'shield' },
    { name: 'INVOCATEUR', color: '#ff66ff', bg: '#3a143a', desc: 'Créatures & Pactes', emblem: 'summon' },
    { name: 'NÉCROMANCIEN', color: '#b14dff', bg: '#26143a', desc: 'Mort & Ombres', emblem: 'skull' },
    { name: 'SAMOURAÏ', color: '#ff4d77', bg: '#3a1421', desc: 'Honneur & Lame', emblem: 'katana' },
    { name: 'CH.-DRAGON', color: '#ff7a33', bg: '#3a1c0f', desc: 'Dragon & Cieux', emblem: 'dragon' },
    { name: 'ALCHIMISTE', color: '#4dffb0', bg: '#0f3a2a', desc: 'Science & Potions', emblem: 'flask' },
    { name: 'BARDE', color: '#ff66bb', bg: '#3a1430', desc: 'Musique & Soutien', emblem: 'note' }
];

/**
 * Generates a Canvas image for class selection with a grid of 13 classes.
 * Oblique-cut cards with stylized geometric emblems per class.
 * @returns {Promise<Buffer>} The image buffer.
 */
async function generateClassSelectionImage() {
    const width = 1200;
    const height = 1180;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#070710');
    bgGrad.addColorStop(1, '#0f0a18');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Diagonal grid effect
    ctx.strokeStyle = 'rgba(120,120,160,0.05)';
    ctx.lineWidth = 1;
    for (let i = -height; i < width; i += 48) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke();
    }

    // Title
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 54px sans-serif';
    ctx.shadowBlur = 18; ctx.shadowColor = '#6a8bff';
    ctx.fillText('LINK START : CHOISIS TA CLASSE', width / 2, 82);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9aa6c4';
    ctx.font = 'italic 20px sans-serif';
    ctx.fillText('Envoie le nom de la classe par message', width / 2, 116);

    const columns = 4;
    const cardWidth = 262;
    const cardHeight = 200;
    const marginX = 28;
    const marginY = 30;
    const startX = (width - (columns * cardWidth + (columns - 1) * marginX)) / 2;
    const startY = 150;
    const cut = 26;

    CLASSES.forEach((cls, i) => {
        const row = Math.floor(i / columns);
        const col = i % columns;
        const x = startX + col * (cardWidth + marginX);
        const y = startY + row * (cardHeight + marginY);

        // Card glow + oblique background
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = cls.color;
        const cardGrad = ctx.createLinearGradient(x, y, x + cardWidth, y + cardHeight);
        cardGrad.addColorStop(0, cls.bg);
        cardGrad.addColorStop(1, '#0a0a12');
        ctx.fillStyle = cardGrad;
        drawObliqueCard(ctx, x, y, cardWidth, cardHeight, cut);
        ctx.fill();
        ctx.restore();

        // Oblique border
        ctx.strokeStyle = cls.color;
        ctx.lineWidth = 3;
        drawObliqueCard(ctx, x, y, cardWidth, cardHeight, cut);
        ctx.stroke();

        // Diagonal accent stripe (clipped to card)
        ctx.save();
        drawObliqueCard(ctx, x, y, cardWidth, cardHeight, cut);
        ctx.clip();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = cls.color;
        ctx.beginPath();
        ctx.moveTo(x, y + cardHeight);
        ctx.lineTo(x + cardWidth * 0.55, y);
        ctx.lineTo(x + cardWidth, y);
        ctx.lineTo(x + cardWidth, y + cardHeight * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Stylized emblem silhouette
        ctx.globalAlpha = 0.9;
        drawClassEmblem(ctx, cls.emblem, x + cardWidth - 58, y + 64, 34, cls.color);
        ctx.globalAlpha = 1;
        ctx.restore();

        // Class index badge
        ctx.fillStyle = cls.color;
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(String(i + 1).padStart(2, '0'), x + 18, y + 38);

        // Class name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 27px sans-serif';
        ctx.fillText(cls.name, x + 18, y + 112);

        // Accent underline
        ctx.strokeStyle = cls.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 18, y + 124);
        ctx.lineTo(x + 18 + 70, y + 124);
        ctx.stroke();

        // Description
        ctx.fillStyle = '#d5d9e6';
        ctx.font = '17px sans-serif';
        ctx.fillText(cls.desc, x + 18, y + 154);

        // Footer hint
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'italic 13px sans-serif';
        ctx.fillText(`» écris "${cls.name.toLowerCase()}"`, x + 18, y + 182);
    });

    return canvas.toBuffer('image/png');
}

module.exports = { generateClassSelectionImage };
