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
    let secondaryColor = '#0055ff';
    if (actionType === 'attack') { primaryColor = '#ff3333'; secondaryColor = '#660000'; }
    if (actionType === 'defend') { primaryColor = '#33ff33'; secondaryColor = '#004400'; }
    if (actionType === 'magic') { primaryColor = '#bf00ff'; secondaryColor = '#2a0033'; }
    if (actionType === 'skill') { primaryColor = '#ffcc00'; secondaryColor = '#554400'; }
    if (actionType === 'travel') { primaryColor = '#00ffcc'; secondaryColor = '#003322'; }

    // Handle Elemental colors
    let elementalOverlay = '';
    if (description.includes('[Feu]') || title.includes('Feu')) {
        primaryColor = '#ff4500'; secondaryColor = '#ff0000';
        elementalOverlay = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="url(#fireGrad)" opacity="0.3" />
            <circle cx="${width/2}" cy="${height/2}" r="200" fill="url(#radialFire)" opacity="0.4" />
        `;
    }
    if (description.includes('[Eau]') || title.includes('Eau')) {
        primaryColor = '#00ffff'; secondaryColor = '#0088ff';
        elementalOverlay = `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#waterGrad)" opacity="0.2" />`;
    }
    if (description.includes('[Terre]') || title.includes('Terre')) {
        primaryColor = '#8b4513'; secondaryColor = '#442200';
        elementalOverlay = `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#earthGrad)" opacity="0.2" />`;
    }
    if (description.includes('[Vent]') || title.includes('Vent')) {
        primaryColor = '#ffffff'; secondaryColor = '#cccccc';
        elementalOverlay = `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#windGrad)" opacity="0.15" />`;
    }

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="textGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:black;stop-opacity:0" />
                    <stop offset="100%" style="stop-color:black;stop-opacity:0.9" />
                </linearGradient>
                <linearGradient id="fireGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" style="stop-color:#ff4500;stop-opacity:0.6" />
                    <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
                </linearGradient>
                <radialGradient id="radialFire" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style="stop-color:#ffff00;stop-opacity:0.5" />
                    <stop offset="100%" style="stop-color:#ff4500;stop-opacity:0" />
                </radialGradient>
                <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#00ffff;stop-opacity:0.4" />
                    <stop offset="100%" style="stop-color:#0000ff;stop-opacity:0.4" />
                </linearGradient>
                <linearGradient id="earthGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" style="stop-color:#8b4513;stop-opacity:0.5" />
                    <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
                </linearGradient>
                <linearGradient id="windGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
                <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
                    <stop offset="50%" style="stop-color:white;stop-opacity:0.8" />
                    <stop offset="100%" style="stop-color:${secondaryColor};stop-opacity:1" />
                </linearGradient>
            </defs>

            ${elementalOverlay}

            <!-- Bottom UI Area -->
            <rect x="0" y="${height * 0.5}" width="${width}" height="${height * 0.5}" fill="url(#textGrad)" />

            <!-- Frame with Gradient and Glow -->
            <rect x="15" y="15" width="${width-30}" height="${height-30}" fill="none" stroke="url(#frameGrad)" stroke-width="5" rx="15" opacity="0.9" filter="url(#glow)" />

            <!-- Tech Name Box -->
            <path d="M 0 40 L 350 40 L 380 90 L 0 90 Z" fill="rgba(0,0,0,0.85)" stroke="${primaryColor}" stroke-width="2" />
            <text x="30" y="75" font-family="Arial Black" font-size="32" fill="${primaryColor}" filter="url(#glow)">${escapeXml(title.toUpperCase())}</text>

            <!-- Usage Description -->
            <rect x="30" y="${height - 120}" width="${width - 60}" height="80" fill="rgba(0,0,0,0.5)" rx="5" />
            <text x="50" y="${height - 85}" font-family="Arial" font-size="22" fill="white" font-weight="bold" style="text-shadow: 2px 2px 4px black;">
                ${escapeXml(description)}
            </text>

            <!-- System Info -->
            <text x="30" y="${height - 35}" font-family="monospace" font-size="14" fill="${primaryColor}" opacity="0.9">
                ARISE_OS_v3.2 // CAPTURE_SEQUENCE [${actionType.toUpperCase()}] // STABLE_FLUX
            </text>

            <!-- Rank/Level Decoration -->
            <circle cx="${width - 70}" cy="70" r="40" fill="rgba(0,0,0,0.8)" stroke="${primaryColor}" stroke-width="3" />
            <text x="${width - 70}" y="82" text-anchor="middle" font-family="Arial Black" font-size="35" fill="${primaryColor}">${actionType.substring(0,1).toUpperCase()}</text>
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
