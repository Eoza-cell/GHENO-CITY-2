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
    if (actionType === 'skill') primaryColor = '#ffd700';  // Gold for skills
    if (actionType === 'travel') primaryColor = '#00ffcc'; // Teal for travel

    // Handle Elemental colors
    let elementalOverlay = '';
    if (description.includes('[Feu]')) {
        primaryColor = '#ff4500';
        elementalOverlay = `<rect x="0" y="0" width="${width}" height="${height}" fill="orange" opacity="0.1" />`;
    }
    if (description.includes('[Eau]')) {
        primaryColor = '#00ffff';
        elementalOverlay = `<rect x="0" y="0" width="${width}" height="${height}" fill="cyan" opacity="0.1" />`;
    }
    if (description.includes('[Terre]')) {
        primaryColor = '#8b4513';
        elementalOverlay = `<rect x="0" y="0" width="${width}" height="${height}" fill="brown" opacity="0.1" />`;
    }
    if (description.includes('[Vent]')) {
        primaryColor = '#ffffff';
        elementalOverlay = `<rect x="0" y="0" width="${width}" height="${height}" fill="white" opacity="0.1" />`;
    }

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            ${elementalOverlay}
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

/**
 * Generates a grid of skill cards for the player's profile or /skills command.
 */
async function generateSkillListImage(player, skills) {
    const width = 1000;
    const cardWidth = 300;
    const cardHeight = 150;
    const margin = 20;
    const cols = 3;
    const rows = Math.ceil(skills.length / cols);
    const height = Math.max(400, rows * (cardHeight + margin) + 150);

    let skillsSvg = '';
    skills.forEach((skill, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = margin + col * (cardWidth + margin);
        const y = 120 + row * (cardHeight + margin);

        let color = '#4fb3ff';
        if (skill.name.includes('[Feu]')) color = '#ff4500';
        if (skill.name.includes('[Eau]')) color = '#00ffff';
        if (skill.name.includes('[Terre]')) color = '#8b4513';
        if (skill.name.includes('[Vent]')) color = '#ffffff';

        skillsSvg += `
            <g transform="translate(${x}, ${y})">
                <rect width="${cardWidth}" height="${cardHeight}" fill="#1a1a2e" stroke="${color}" stroke-width="2" rx="10" />
                <text x="15" y="40" font-family="Arial" font-size="20" fill="${color}" font-weight="bold">${escapeXml(skill.name.substring(0, 22))}</text>
                <text x="15" y="70" font-family="Arial" font-size="14" fill="#aaa">Coût: ${skill.manaCost} PM</text>
                <foreignObject x="15" y="85" width="${cardWidth - 30}" height="55">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="color: #eee; font-family: Arial; font-size: 12px; line-height: 1.2;">
                        ${escapeXml(skill.description)}
                    </div>
                </foreignObject>
            </g>
        `;
    });

    const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#0a0a1a" />
            <defs>
                <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#ff4500;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#ffd700;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect x="0" y="0" width="${width}" height="100" fill="url(#headerGrad)" />
            <text x="40" y="65" font-family="Arial Black" font-size="40" fill="black">TECHNIQUES DE RANG ${player.rank}</text>
            <text x="${width - 40}" y="65" text-anchor="end" font-family="monospace" font-size="20" fill="black">${player.name.toUpperCase()} // LVL ${player.level}</text>

            ${skillsSvg}
        </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateActionVisual, generateSkillListImage };
