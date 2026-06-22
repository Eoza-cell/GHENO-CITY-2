const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

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
 * Generate a beautiful lore poster using Sharp and SVG.
 * Returns a Buffer.
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

    // Wrap text manually for SVG since foreignObject is unreliable with Sharp
    function wrapText(text, maxWidth, fontSize) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        // Approximate character width (very rough)
        const avgCharWidth = fontSize * 0.55;
        const maxChars = Math.floor(maxWidth / avgCharWidth);

        words.forEach(word => {
            if ((currentLine + word).length > maxChars) {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine += word + ' ';
            }
        });
        lines.push(currentLine.trim());
        return lines;
    }

    const contentLines = [];
    content.split('\n').forEach(p => {
        if (p.trim()) {
            const wrapped = wrapText(p.trim(), width - 160, 22);
            contentLines.push(...wrapped, ''); // Empty string for paragraph spacing
        }
    });

    const startY = imageBuffer ? 780 : 350;
    const lineHeight = 30;

    let contentSvg = '';
    contentLines.forEach((line, i) => {
        if (startY + i * lineHeight < height - 150) {
            contentSvg += `<text x="80" y="${startY + i * lineHeight}" font-family="serif" font-size="22" fill="#ffffff">${escapeXml(line)}</text>`;
        }
    });

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
        <text x="50%" y="150" font-family="sans-serif" font-size="60" font-weight="bold" fill="#d4af37" text-anchor="middle" style="text-transform: uppercase; letter-spacing: 5px;">${escapeXml(title)}</text>
        <line x1="200" y1="180" x2="600" y2="180" stroke="#d4af37" stroke-width="2" />

        <!-- Type Tag -->
        <rect x="50%" y="210" width="120" height="30" fill="#d4af37" transform="translate(-60, 0)" rx="5" />
        <text x="50%" y="230" font-family="monospace" font-size="18" font-weight="bold" fill="#000" text-anchor="middle">${escapeXml(type)}</text>

        <!-- Content -->
        ${contentSvg}

        <!-- Footer -->
        <text x="50%" y="${height - 100}" font-family="monospace" font-size="20" fill="#666" text-anchor="middle" font-style="italic">ARISE: GHENO CITY - CHRONIQUES D'AETHERYS</text>
    </svg>
    `;

    const composites = [];
    if (imageBuffer) {
        composites.push({ input: imageBuffer, top: 250, left: 50 });
    }
    composites.push({ input: Buffer.from(svg), top: 0, left: 0 });

    return await sharp({
        create: {
            width: width,
            height: height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 }
        }
    })
    .composite(composites)
    .png()
    .toBuffer();
}

module.exports = { generateLorePoster };
