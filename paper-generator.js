const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeXml } = require('./utils');

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
                </feDiffuseLighting>
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

async function generateMissionBoard(player, activeQuests) {
    const width = 800;
    const height = 600;

    let questRows = activeQuests.map((q, i) => {
        const progress = (q.PlayerQuest && q.PlayerQuest.progress) ? q.PlayerQuest.progress : 0;
        const barWidth = (progress / 100) * 380;
        return `
            <g transform="translate(100, ${150 + i * 120})">
                <!-- Slanted Quest Item Rhombus Box -->
                <polygon points="12,0 580,0 562,95 0,95" fill="rgba(15,10,30,0.85)" stroke="#ffd700" stroke-width="1.5"/>

                <g transform="translate(25, 25)">
                    <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="20" fill="#ffd700" font-weight="bold">❖ ${escapeXml(q.title)}</text>
                    <text x="0" y="24" font-family="'Segoe UI', sans-serif" font-size="14" fill="#ffffff" opacity="0.8">${escapeXml(q.objective || q.description).substring(0, 65)}...</text>

                    <!-- Oblique Progress Bar -->
                    <polygon points="0,38 380,38 368,52 -12,52" fill="rgba(255,255,255,0.1)" />
                    <polygon points="0,38 ${barWidth},38 ${barWidth - 12},52 -12,52" fill="#00ffcc" />
                    <text x="395" y="50" font-family="monospace" font-size="14" fill="#00ffcc" font-weight="bold">${progress}%</text>
                </g>
            </g>
        `;
    }).join('');

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#05030e" />

        <!-- Outer Oblique Rhomboid Border -->
        <polygon points="30,20 ${width-30},20 ${width-50},${height-20} 10,${height-20}" fill="none" stroke="#ffd700" stroke-width="2.5" opacity="0.8" />

        <!-- Header -->
        <polygon points="150,35 650,35 630,90 130,90" fill="rgba(20,15,40,0.8)" stroke="#ffd700" stroke-width="1.8" />
        <text x="50%" y="70" font-family="'Segoe UI', sans-serif" font-size="30" fill="#ffffff" text-anchor="middle" font-weight="900" letter-spacing="4">❖ TABLEAU DES MISSIONS ATR ❖</text>

        ${questRows}

        <text x="50%" y="${height - 40}" font-family="monospace" font-size="12" fill="#ffd700" text-anchor="middle" opacity="0.6">SYSTÈME DE SUIVI TACTIQUE ATR // ${player.name.toUpperCase()}</text>
    </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generatePaperImage, generateMissionBoard };
