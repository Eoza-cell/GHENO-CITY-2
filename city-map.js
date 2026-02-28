const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;

// Coordinates for locations on our schematic map
const locationCoords = {
  'Little Sicily': { x: 150, y: 450, color: '#f1c40f', label: 'Little Sicily' },
  'Downtown': { x: 400, y: 300, color: '#3498db', label: 'Downtown' },
  'dealership': { x: 650, y: 150, color: '#e67e22', label: 'Concessionnaire' },
  'hideout': { x: 700, y: 500, color: '#2c3e50', label: 'Planque' }
};

async function generateCityMap(currentPlayerLocation, playerProfilePicPath = null) {
  // Create base SVG for the map background
  let svgBackground = `<svg width="${MAP_WIDTH}" height="${MAP_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="100%" height="100%" fill="#ecf0f1" />

    <!-- Roads -->
    <line x1="150" y1="450" x2="400" y2="300" stroke="#bdc3c7" stroke-width="20" />
    <line x1="400" y1="300" x2="650" y2="150" stroke="#bdc3c7" stroke-width="20" />
    <line x1="650" y1="150" x2="700" y2="500" stroke="#bdc3c7" stroke-width="5" stroke-dasharray="10,10" />

    <!-- Locations -->
    ${Object.entries(locationCoords).map(([name, data]) => `
      <circle cx="${data.x}" cy="${data.y}" r="25" fill="${data.color}" stroke="#fff" stroke-width="4" />
      <text x="${data.x}" y="${data.y + 45}" font-family="Arial" font-size="18" font-weight="bold" text-anchor="middle" fill="#2c3e50">${data.label}</text>
    `).join('')}
  </svg>`;

  const composites = [
    { input: Buffer.from(svgBackground), top: 0, left: 0 }
  ];

  // Add player marker if location is known
  if (locationCoords[currentPlayerLocation]) {
    const { x, y } = locationCoords[currentPlayerLocation];

    let marker;
    if (playerProfilePicPath && fs.existsSync(playerProfilePicPath)) {
        // Create a circular crop of the profile pic
        const picBuffer = fs.readFileSync(playerProfilePicPath);
        const circleMarker = await sharp(picBuffer)
            .resize(60, 60)
            .composite([{
                input: Buffer.from(`<svg><circle cx="30" cy="30" r="30" fill="white"/></svg>`),
                blend: 'dest-in'
            }])
            .toBuffer();

        composites.push({
            input: circleMarker,
            top: y - 30,
            left: x - 30
        });

        // Add a highlight ring around the profile pic
        const ring = Buffer.from(`<svg width="70" height="70"><circle cx="35" cy="35" r="33" fill="none" stroke="#e74c3c" stroke-width="4"/></svg>`);
        composites.push({
            input: ring,
            top: y - 35,
            left: x - 35
        });

    } else {
        // Default simple marker
        const simpleMarker = Buffer.from(`<svg width="40" height="40"><circle cx="20" cy="20" r="15" fill="#e74c3c" stroke="#fff" stroke-width="3"/></svg>`);
        composites.push({
            input: simpleMarker,
            top: y - 20,
            left: x - 20
        });
    }
  }

  return await sharp({
    create: {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .composite(composites)
  .jpeg()
  .toBuffer();
}

module.exports = { generateCityMap };
