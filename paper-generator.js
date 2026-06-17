const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Generate an image representing a handwritten note or exam paper.
 */
async function generatePaperImage(text, title = "NOTE") {
    const width = 800;
    const height = 1000;

    // SVG for the paper look
    const svg = `
    <svg width="${width}" height="${height}">
        <defs>
            <filter id="roughpaper">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise" />
                <feDiffuseLighting in="noise" lighting-color="#f4e4bc" surfaceScale="2">
                    <feDistantLight azimuth="45" elevation="60" />
                </feDiffuseLighting>
            </filter>
        </defs>

        <!-- Paper Background -->
        <rect width="100%" height="100%" fill="#fdf5e6" />
        <rect width="100%" height="100%" fill="#f4e4bc" opacity="0.5" />

        <!-- Lined Paper Pattern (Optional, but looks "academic") -->
        <pattern id="lines" width="100%" height="40" patternUnits="userSpaceOnUse">
            <line x1="0" y1="39" x2="${width}" y2="39" stroke="#dcdcdc" stroke-width="1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#lines)" />

        <!-- Margin line -->
        <line x1="80" y1="0" x2="80" y2="${height}" stroke="#ff9999" stroke-width="2" />

        <!-- Title -->
        <text x="50%" y="80" font-family="cursive, serif" font-size="40" fill="#2c3e50" text-anchor="middle" font-style="italic" font-weight="bold">${title}</text>

        <!-- Content -->
        <foreignObject x="100" y="150" width="${width - 150}" height="${height - 250}">
            <div xmlns="http://www.w3.org/1999/xhtml" style="color: #1a1a1a; font-family: 'Courier New', Courier, monospace; font-size: 22px; line-height: 40px; white-space: pre-wrap; font-style: italic;">
                ${text}
            </div>
        </foreignObject>

        <!-- Signature/Stamp area -->
        <circle cx="${width - 100}" cy="${height - 100}" r="40" fill="none" stroke="#b22222" stroke-width="3" stroke-dasharray="5,5" />
        <text x="${width - 100}" y="${height - 95}" font-family="Arial" font-size="12" fill="#b22222" text-anchor="middle" font-weight="bold">SCEAU</text>
    </svg>
    `;

    const outputPath = path.join(__dirname, 'assets', `paper_${Date.now()}.png`);

    if (!fs.existsSync(path.join(__dirname, 'assets'))) {
        fs.mkdirSync(path.join(__dirname, 'assets'));
    }

    await sharp({
        create: {
            width: width,
            height: height,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    })
    .composite([{
        input: Buffer.from(svg),
        top: 0,
        left: 0
    }])
    .png()
    .toFile(outputPath);

    return outputPath;
}

module.exports = { generatePaperImage };
