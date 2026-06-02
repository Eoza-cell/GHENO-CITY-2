const { createCanvas, loadImage } = require('canvas');
const { Player, Club } = require('./database');

/**
 * Generates a tactical board image showing the player's position in the team.
 * @param {object} player The player object.
 */
async function generateFormationImage(player) {
    const canvas = createCanvas(800, 1000);
    const ctx = canvas.getContext('2d');

    // Draw Pitch
    ctx.fillStyle = '#2e7d32'; // Green
    ctx.fillRect(0, 0, 800, 1000);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeRect(50, 50, 700, 900);

    // Half line
    ctx.beginPath();
    ctx.moveTo(50, 500);
    ctx.lineTo(750, 500);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(400, 500, 100, 0, Math.PI * 2);
    ctx.stroke();

    // Player Mapping (simplified 4-3-3 for this example)
    const positions = {
        'GK': { x: 400, y: 880 },
        'DEF': { x: 200, y: 700 },
        'MID': { x: 400, y: 500 },
        'FWD': { x: 400, y: 150 }
    };

    const pos = positions[player.position] || { x: 400, y: 500 };

    // Draw teammates (gray dots)
    ctx.fillStyle = '#cccccc';
    const teammates = [
        { x: 600, y: 700 }, { x: 400, y: 700 }, { x: 200, y: 700 }, // DEF
        { x: 600, y: 500 }, { x: 400, y: 500 }, { x: 200, y: 500 }, // MID
        { x: 600, y: 250 }, { x: 400, y: 250 }, { x: 200, y: 250 }  // FWD
    ];
    teammates.forEach(t => {
        if (Math.abs(t.x - pos.x) < 10 && Math.abs(t.y - pos.y) < 10) return; // Skip current player slot
        ctx.beginPath();
        ctx.arc(t.x, t.y, 25, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Current Player (Red dot)
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Name and Number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${player.name} (${player.jerseyNumber})`, pos.x, pos.y + 70);

    return canvas.toBuffer('image/jpeg');
}

module.exports = { generateFormationImage };
