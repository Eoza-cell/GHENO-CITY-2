const { createCanvas } = require('canvas');
const { PlayerCard, BasketballPlayer } = require('./database');

/**
 * Generates a tactical board image showing the team's position on the basketball court.
 */
async function generateTeamImage(team) {
    const canvas = createCanvas(800, 1000);
    const ctx = canvas.getContext('2d');

    // Draw Basketball Court (Orange/Wood color)
    ctx.fillStyle = '#d38c5d'; // Wood
    ctx.fillRect(0, 0, 800, 1000);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;

    // Boundary
    ctx.strokeRect(50, 50, 700, 900);

    // Mid court line
    ctx.beginPath();
    ctx.moveTo(50, 500);
    ctx.lineTo(750, 500);
    ctx.stroke();

    // Mid court circle
    ctx.beginPath();
    ctx.arc(400, 500, 100, 0, Math.PI * 2);
    ctx.stroke();

    // Three point line (Top)
    ctx.beginPath();
    ctx.arc(400, 100, 300, 0, Math.PI);
    ctx.stroke();

    // Three point line (Bottom)
    ctx.beginPath();
    ctx.arc(400, 900, 300, Math.PI, 0);
    ctx.stroke();

    // Key (Paint) - Top
    ctx.strokeRect(300, 50, 200, 250);
    // Key (Paint) - Bottom
    ctx.strokeRect(300, 700, 200, 250);

    // Positions mapping
    const posMapping = {
        'PG': { x: 400, y: 400 },
        'SG': { x: 150, y: 300 },
        'SF': { x: 650, y: 300 },
        'PF': { x: 550, y: 150 },
        'C':  { x: 250, y: 150 }
    };

    const cardIds = {
        'PG': team.pgCardId,
        'SG': team.sgCardId,
        'SF': team.sfCardId,
        'PF': team.pfCardId,
        'C':  team.cCardId
    };

    for (const [pos, cardId] of Object.entries(cardIds)) {
        const coords = posMapping[pos];

        // Draw Player Circle
        ctx.fillStyle = cardId ? '#1a237e' : '#757575'; // Blue if set, Gray if empty
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Position Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(pos, coords.x, coords.y + 8);

        if (cardId) {
            const card = await PlayerCard.findByPk(cardId, { include: [BasketballPlayer] });
            if (card) {
                ctx.fillStyle = '#000000';
                ctx.font = '18px Arial';
                ctx.fillText(card.BasketballPlayer.name, coords.x, coords.y + 65);
            }
        }
    }

    return canvas.toBuffer('image/jpeg');
}

module.exports = { generateTeamImage };
