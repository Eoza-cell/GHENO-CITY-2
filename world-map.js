const { createCanvas } = require('canvas');

// ---- Canonical world data (mirrors the seeds in database.js) ----
const WORLD_NAME = 'AETHERYS';

const KINGDOMS = [
    {
        name: "Empire Impérial d'Elion", short: "EMPIRE D'ELION", status: 'Paix',
        color: '#f4c542', fill: 'rgba(244,197,66,0.16)',
        labelPos: [620, 410],
        polygon: [[470, 360], [760, 320], [880, 470], [820, 690], [560, 740], [430, 600]]
    },
    {
        name: 'Royaume de Valkyrr', short: 'VALKYRR', status: 'Trêve',
        color: '#9fd8ff', fill: 'rgba(159,216,255,0.14)',
        labelPos: [520, 200],
        polygon: [[360, 150], [720, 130], [770, 300], [470, 350], [330, 300]]
    },
    {
        name: 'Dominion Noir de Vharos', short: 'DOMINION NOIR', status: 'Guerre',
        color: '#b06bff', fill: 'rgba(150,70,220,0.20)',
        labelPos: [890, 560],
        polygon: [[830, 480], [1040, 540], [1060, 760], [880, 850], [770, 720], [840, 600]]
    }
];

// Coastline of the continent (single landmass)
const CONTINENT = [
    [330, 290], [350, 160], [520, 90], [760, 110], [880, 200], [900, 330],
    [1010, 470], [1075, 620], [1040, 800], [880, 880], [690, 860], [560, 800],
    [410, 770], [300, 640], [270, 470]
];

const CITIES = [
    { name: 'Eldoria', sub: 'Cité de départ', x: 610, y: 540, capital: false },
    { name: 'Académie Impériale', sub: 'Académie de magie', x: 700, y: 450, capital: false },
    { name: 'Lux Aeterna', sub: 'Chevaliers du Sang', x: 540, y: 640, capital: false },
    { name: 'Solis', sub: "Capitale d'Elion", x: 660, y: 600, capital: true }
];

// Dungeons by rank. Color scales with danger (E -> S).
const RANK_COLORS = {
    E: '#7bd88f', D: '#69b7ff', C: '#ffd24d', B: '#ff9a3d', A: '#ff5d5d', S: '#c34bff'
};
const DUNGEONS = [
    { name: 'Forêt des Gobelins', rank: 'E', x: 400, y: 470, glyph: 'tree' },
    { name: 'Mine de Cobalt', rank: 'D', x: 650, y: 230, glyph: 'mountain' },
    { name: 'Caverne des Ombres', rank: 'C', x: 860, y: 360, glyph: 'cave' },
    { name: "Labyrinthe d'Aincrad", rank: 'B', x: 720, y: 720, glyph: 'tower' },
    { name: "Volcan d'Ignis", rank: 'A', x: 985, y: 660, glyph: 'volcano' },
    { name: 'Donjon du Destin', rank: 'S', x: 950, y: 790, glyph: 'skull' }
];

function poly(ctx, points, close = true) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (close) ctx.closePath();
}

function star(ctx, cx, cy, spikes, outer, inner) {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    for (let i = 0; i < spikes; i++) {
        rot += step; ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
        rot += step; ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
    }
    ctx.closePath();
}

function diamond(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
    ctx.closePath();
}

function drawGlyph(ctx, glyph, x, y, color) {
    ctx.save();
    ctx.strokeStyle = '#2a2118';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = color;
    const s = 11;
    if (glyph === 'tree') {
        ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y + s * 0.4); ctx.lineTo(x - s * 0.7, y + s * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (glyph === 'mountain') {
        ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.5); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y + s * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (glyph === 'volcano') {
        ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.5); ctx.lineTo(x - s * 0.3, y - s * 0.6); ctx.lineTo(x + s * 0.3, y - s * 0.6); ctx.lineTo(x + s, y + s * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff7a2d'; ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.6); ctx.lineTo(x, y - s * 1.3); ctx.lineTo(x + s * 0.3, y - s * 0.6); ctx.closePath(); ctx.fill();
    } else if (glyph === 'cave') {
        ctx.beginPath(); ctx.arc(x, y, s * 0.8, Math.PI, 0); ctx.lineTo(x + s * 0.8, y + s * 0.5); ctx.lineTo(x - s * 0.8, y + s * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (glyph === 'tower') {
        ctx.fillRect(x - s * 0.5, y - s, s, s * 1.6); ctx.strokeRect(x - s * 0.5, y - s, s, s * 1.6);
    } else if (glyph === 'skull') {
        ctx.beginPath(); ctx.arc(x, y - 2, s * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 1.8, 0, Math.PI * 2); ctx.arc(x + 3, y - 3, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

function drawCompass(ctx, cx, cy, r) {
    ctx.save();
    ctx.strokeStyle = 'rgba(60,45,25,0.7)';
    ctx.fillStyle = 'rgba(60,45,25,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 - Math.PI / 2;
        const a2 = a + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a2) * r * 0.25, cy + Math.sin(a2) * r * 0.25);
        ctx.lineTo(cx + Math.cos(a + Math.PI / 2) * r, cy + Math.sin(a + Math.PI / 2) * r);
        ctx.lineTo(cx + Math.cos(a2 + Math.PI / 2) * r * 0.25, cy + Math.sin(a2 + Math.PI / 2) * r * 0.25);
        if (i % 2 === 0) { ctx.fillStyle = 'rgba(120,40,30,0.75)'; ctx.fill(); }
        ctx.stroke();
    }
    ctx.fillStyle = '#3c2d19';
    ctx.font = 'bold 18px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - r - 14);
    ctx.fillText('S', cx, cy + r + 14);
    ctx.fillText('O', cx - r - 14, cy);
    ctx.fillText('E', cx + r + 14, cy);
    ctx.restore();
}

/**
 * Generates a stylized fantasy world map of Aetherys.
 * @returns {Promise<Buffer>}
 */
async function generateWorldMapImage() {
    const W = 1400, H = 1000;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Ocean
    const ocean = ctx.createLinearGradient(0, 0, W, H);
    ocean.addColorStop(0, '#1b3a55');
    ocean.addColorStop(1, '#0e2236');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, W, H);

    // Ocean wave lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let y = 40; y < H; y += 36) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin((x + y) / 60) * 4);
        ctx.stroke();
    }

    // Landmass shadow + fill (parchment)
    ctx.save();
    ctx.shadowBlur = 40; ctx.shadowColor = 'rgba(0,0,0,0.55)';
    poly(ctx, CONTINENT);
    const land = ctx.createLinearGradient(0, 100, 0, 900);
    land.addColorStop(0, '#e9dcb5');
    land.addColorStop(1, '#cdb988');
    ctx.fillStyle = land;
    ctx.fill();
    ctx.restore();

    // Coastline
    poly(ctx, CONTINENT);
    ctx.strokeStyle = '#5c4a2a';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Kingdom regions (clipped to land)
    ctx.save();
    poly(ctx, CONTINENT); ctx.clip();
    KINGDOMS.forEach(k => {
        poly(ctx, k.polygon);
        ctx.fillStyle = k.fill;
        ctx.fill();
        ctx.strokeStyle = k.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
    });
    ctx.restore();

    // Kingdom labels
    ctx.textAlign = 'center';
    KINGDOMS.forEach(k => {
        const cx = k.labelPos ? k.labelPos[0] : k.polygon.reduce((a, p) => a + p[0], 0) / k.polygon.length;
        const cy = k.labelPos ? k.labelPos[1] : k.polygon.reduce((a, p) => a + p[1], 0) / k.polygon.length;
        ctx.fillStyle = k.color;
        ctx.font = 'bold 22px serif';
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.fillText(k.short, cx, cy - 6);
        ctx.font = 'italic 15px serif';
        ctx.fillStyle = '#3c2d19';
        ctx.shadowBlur = 0;
        ctx.fillText(`« ${k.status} »`, cx, cy + 16);
    });

    // Dungeons
    DUNGEONS.forEach(d => {
        const color = RANK_COLORS[d.rank] || '#fff';
        drawGlyph(ctx, d.glyph, d.x, d.y - 16, color);
        // marker diamond + rank
        ctx.save();
        ctx.shadowBlur = 8; ctx.shadowColor = color;
        diamond(ctx, d.x, d.y, 9);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = '#2a2118'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#1a1410';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.rank, d.x, d.y);
        // label
        ctx.fillStyle = '#2a2118';
        ctx.font = '13px serif';
        ctx.textBaseline = 'top';
        ctx.fillText(d.name, d.x, d.y + 12);
    });

    // Cities
    CITIES.forEach(c => {
        ctx.save();
        if (c.capital) {
            ctx.shadowBlur = 10; ctx.shadowColor = '#f4c542';
            star(ctx, c.x, c.y, 5, 13, 6);
            ctx.fillStyle = '#f4c542'; ctx.fill();
            ctx.strokeStyle = '#5c4a2a'; ctx.lineWidth = 1.5; ctx.stroke();
        } else {
            ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#f6f1e3'; ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = '#8a2b22'; ctx.stroke();
            ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#8a2b22'; ctx.fill();
        }
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a1410';
        ctx.font = `bold ${c.capital ? 18 : 16}px serif`;
        ctx.fillText(c.name, c.x + 14, c.y - 2);
        ctx.font = 'italic 12px serif';
        ctx.fillStyle = '#5c4a2a';
        ctx.fillText(c.sub, c.x + 14, c.y + 13);
    });

    // Compass
    drawCompass(ctx, W - 110, 150, 56);

    // Title banner
    ctx.save();
    ctx.fillStyle = 'rgba(20,12,6,0.72)';
    ctx.fillRect(W / 2 - 320, 24, 640, 78);
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 3;
    ctx.strokeRect(W / 2 - 320, 24, 640, 78);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4e3b0';
    ctx.font = 'bold 44px serif';
    ctx.fillText(`CARTE DU MONDE — ${WORLD_NAME}`, W / 2, 64);
    ctx.fillStyle = '#cbb682';
    ctx.font = 'italic 18px serif';
    ctx.fillText('Continent de l\'Empire, des terres libres et du Dominion Noir', W / 2, 90);
    ctx.restore();

    // Legend
    const lx = 40, ly = H - 240, lw = 320, lh = 200;
    ctx.fillStyle = 'rgba(20,12,6,0.78)';
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 2;
    ctx.strokeRect(lx, ly, lw, lh);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f4e3b0';
    ctx.font = 'bold 18px serif';
    ctx.fillText('LÉGENDE', lx + 16, ly + 26);

    ctx.font = '14px sans-serif';
    let yy = ly + 52;
    // city + capital
    ctx.fillStyle = '#8a2b22'; ctx.beginPath(); ctx.arc(lx + 24, yy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9dcb5'; ctx.fillText('Cité / lieu', lx + 40, yy + 4);
    ctx.fillStyle = '#f4c542'; star(ctx, lx + 170, yy, 5, 8, 4); ctx.fill();
    ctx.fillStyle = '#e9dcb5'; ctx.fillText('Capitale', lx + 186, yy + 4);
    yy += 28;
    ctx.fillStyle = '#e9dcb5'; ctx.fillText('Donjons par rang :', lx + 16, yy + 4);
    yy += 24;
    const ranks = Object.keys(RANK_COLORS);
    ranks.forEach((r, i) => {
        const rx = lx + 24 + (i % 3) * 95;
        const ry = yy + Math.floor(i / 3) * 30;
        diamond(ctx, rx, ry, 7); ctx.fillStyle = RANK_COLORS[r]; ctx.fill();
        ctx.strokeStyle = '#2a2118'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#e9dcb5'; ctx.fillText(`Rang ${r}`, rx + 14, ry + 4);
    });

    return canvas.toBuffer('image/png');
}

module.exports = { generateWorldMapImage, WORLD_NAME };
