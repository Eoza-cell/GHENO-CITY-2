const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeXml } = require('./utils');

/**
 * Generates an immersive action visual by overlaying text and descriptions on local assets.
 * Returns a Buffer.
 */
async function generateActionVisual(data) {
    const width = 800;
    const height = 500;
    const { actionType, title, description, assetPath } = data;

    if (!fs.existsSync(assetPath)) {
        throw new Error(`Asset not found: ${assetPath}`);
    }

    // Determine primary color based on action
    let primaryColor = '#4fb3ff'; // Default Blue
    if (actionType === 'attack') primaryColor = '#ff4444'; // Red
    if (actionType === 'defend') primaryColor = '#44ff44'; // Green
    if (actionType === 'magic') primaryColor = '#cc44ff';  // Purple

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <!-- Dark bottom gradient for text readability -->
            <defs>
                <linearGradient id="textGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:black;stop-opacity:0" />
                    <stop offset="100%" style="stop-color:black;stop-opacity:0.8" />
                </linearGradient>
            </defs>
            <rect x="0" y="${height * 0.6}" width="${width}" height="${height * 0.4}" fill="url(#textGrad)" />

            <!-- Frame -->
            <rect x="10" y="10" width="${width-20}" height="${height-20}" fill="none" stroke="${primaryColor}" stroke-width="4" rx="10" opacity="0.6" />

            <!-- Title -->
            <rect x="0" y="30" width="300" height="50" fill="rgba(0,0,0,0.7)" rx="0" ry="0" />
            <text x="30" y="65" font-family="Arial" font-size="28" fill="${primaryColor}" font-weight="bold">${escapeXml(title.toUpperCase())}</text>

            <!-- Description -->
            <text x="30" y="${height - 60}" font-family="Arial" font-size="20" fill="white" font-weight="bold">${escapeXml(description)}</text>
            <text x="30" y="${height - 30}" font-family="monospace" font-size="12" fill="${primaryColor}" opacity="0.8">OS_ARISE_IMMERSION_V1 // SEQUENCE_${actionType.toUpperCase()}</text>
        </svg>
    `;

    return await sharp(assetPath)
        .resize(width, height)
        .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
        .png()
        .toBuffer();
}

module.exports = { generateActionVisual };
