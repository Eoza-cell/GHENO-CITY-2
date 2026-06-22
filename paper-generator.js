const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Escapes characters for SVG/XML.
 */
function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

/**
 * Wraps text into an array of lines based on max width.
 */
function wrapText(text, maxCharsPerLine) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = "";

    words.forEach(word => {
        if ((currentLine + word).length <= maxCharsPerLine) {
            currentLine += (currentLine === "" ? "" : " ") + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
}

/**
 * Generate an image representing a handwritten note or exam paper.
 * Returns a Buffer.
 */
async function generatePaperImage(text, title = "NOTE") {
    const width = 800;
    const height = 1000;
    const padding = 100;
    const maxChars = 50;
    const lineHeight = 40;

    const lines = wrapText(text, maxChars);
    const textSvg = lines.map((line, i) =>
        `<text x="${padding}" y="${180 + (i * lineHeight)}" font-family="FreeSerif, serif" font-size="22" fill="#1a1a1a" font-style="italic">${escapeXml(line)}</text>`
    ).join('\n');

    // SVG for the paper look
    const svg = `
    <svg width="${width}" height="${height}">
        <defs>
            <filter id="roughpaper">
                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise" />
                <feDiffuseLighting in="noise" lighting-color="#f4e4bc" surfaceScale="2">
                    <feDistantLight azimuth="45" elevation="60" />
                </feDistantLight>
            </diffuseLighting>
            </filter>
        </defs>

        <!-- Paper Background -->
        <rect width="100%" height="100%" fill="#fdf5e6" />
        <rect width="100%" height="100%" fill="#f4e4bc" opacity="0.5" />

        <!-- Lined Paper Pattern -->
        <pattern id="lines" width="100%" height="40" patternUnits="userSpaceOnUse">
            <line x1="0" y1="39" x2="${width}" y2="39" stroke="#dcdcdc" stroke-width="1" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#lines)" />

        <!-- Margin line -->
        <line x1="80" y1="0" x2="80" y2="${height}" stroke="#ff9999" stroke-width="2" />

        <!-- Title -->
        <text x="50%" y="80" font-family="FreeSerif, serif" font-size="40" fill="#2c3e50" text-anchor="middle" font-style="italic" font-weight="bold">${escapeXml(title)}</text>

        <!-- Content -->
        ${textSvg}

        <!-- Signature/Stamp area -->
        <circle cx="${width - 100}" cy="${height - 100}" r="40" fill="none" stroke="#b22222" stroke-width="3" stroke-dasharray="5,5" />
        <text x="${width - 100}" y="${height - 95}" font-family="Arial" font-size="12" fill="#b22222" text-anchor="middle" font-weight="bold">SCEAU</text>
    </svg>
    `;

    return await sharp({
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
    .toBuffer();
}

module.exports = { generatePaperImage };
