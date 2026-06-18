const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

/**
 * Generate a beautiful lore poster using Sharp and SVG.
 */
async function generateLorePoster(title, content, type = 'LORE', imageUrl = null) {
    const width = 800;
    const height = 1200;

    // Background color based on type
    const colors = {
        'LORE': '#1a1a1a',
        'ENTITY': '#1a0d00',
        'NPC': '#001a1a',
        'KINGDOM': '#1a001a',
        'HISTORY': '#1a1a00'
    };
    const bgColor = colors[type] || '#1a1a1a';

    let imageBuffer = null;
    if (imageUrl) {
        try {
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
            imageBuffer = await sharp(Buffer.from(response.data)).resize(width - 100, 450, { fit: 'cover' }).toBuffer();
        } catch (e) {
            console.error("[LORE] Failed to fetch image:", e.message);
        }
    }

    // SVG Overlay
    const svg = `
    <svg width="${width}" height="${height}">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
                <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />

        <!-- Border -->
        <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="#d4af37" stroke-width="4" />
        <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="#d4af37" stroke-width="1" />

        <!-- Title -->
        <text x="50%" y="150" font-family="Arial" font-size="60" font-weight="bold" fill="#d4af37" text-anchor="middle" style="text-transform: uppercase; letter-spacing: 5px;">${title}</text>
        <line x1="200" y1="180" x2="600" y2="180" stroke="#d4af37" stroke-width="2" />

        <!-- Type Tag -->
        <rect x="50%" y="210" width="120" height="30" fill="#d4af37" transform="translate(-60, 0)" rx="5" />
        <text x="50%" y="230" font-family="Arial" font-size="18" font-weight="bold" fill="#000" text-anchor="middle">${type}</text>

        <!-- Content -->
        <foreignObject x="80" y="${imageBuffer ? 750 : 300}" width="${width - 160}" height="${imageBuffer ? height - 850 : height - 400}">
            <div xmlns="http://www.w3.org/1999/xhtml" style="color: #ffffff; font-family: 'Georgia', serif; font-size: 22px; line-height: 1.5; text-align: justify;">
                ${content.split('\n').map(line => `<p>${line}</p>`).join('')}
            </div>
        </foreignObject>

        <!-- Footer -->
        <text x="50%" y="${height - 100}" font-family="Arial" font-size="20" fill="#666" text-anchor="middle" font-style="italic">ARISE: GHENO CITY - CHRONIQUES D'AETHERYS</text>
    </svg>
    `;

    const outputPath = path.join(__dirname, 'assets', `lore_${Date.now()}.png`);

    // Ensure assets directory exists
    if (!fs.existsSync(path.join(__dirname, 'assets'))) {
        fs.mkdirSync(path.join(__dirname, 'assets'));
    }

    const composites = [];
    if (imageBuffer) {
        composites.push({ input: imageBuffer, top: 250, left: 50 });
    }
    composites.push({ input: Buffer.from(svg), top: 0, left: 0 });

    await sharp({
        create: {
            width: width,
            height: height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 }
        }
    })
    .composite(composites)
    .png()
    .toFile(outputPath);

    return outputPath;
}

module.exports = { generateLorePoster };
