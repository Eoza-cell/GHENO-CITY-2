const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { escapeXml } = require('./utils');

/**
 * Generates an ultra-premium Oblique Diamond Action Visual Card overlay.
 * Returns a Buffer.
 */
async function generateActionVisual(data) {
    const width = 800;
    const height = 500;
    const { actionType, title, description, assetPath } = data;

    let bgBuffer = null;
    if (assetPath && fs.existsSync(assetPath)) {
        try {
            bgBuffer = await sharp(assetPath).resize(width, height, { fit: 'cover' }).toBuffer();
        } catch (e) {}
    }

    if (!bgBuffer) {
        // Fallback gradient if asset doesn't exist
        const fallbackSvg = `<svg width="${width}" height="${height}">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0a0518" />
                    <stop offset="100%" stop-color="#020108" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#bg)"/>
        </svg>`;
        bgBuffer = await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
    }

    // Determine primary color based on action
    let primaryColor = '#00ffcc'; // Default Cyber Teal
    if (actionType === 'combat' || actionType === 'attack') { primaryColor = '#ff3333'; }
    if (actionType === 'defend') { primaryColor = '#00ff66'; }
    if (actionType === 'magic') { primaryColor = '#bf00ff'; }
    if (actionType === 'skill') { primaryColor = '#ffd700'; }
    if (actionType === 'travel') { primaryColor = '#00ffff'; }

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="textGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#000000;stop-opacity:0" />
                    <stop offset="100%" style="stop-color:#020108;stop-opacity:0.92" />
                </linearGradient>
                <linearGradient id="primaryGold" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#ffe066" />
                    <stop offset="100%" style="stop-color:${primaryColor}" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <!-- Bottom Dark Gradient Area -->
            <rect x="0" y="${height * 0.4}" width="${width}" height="${height * 0.6}" fill="url(#textGrad)" />

            <!-- Oblique Outer Rhomboid Frame -->
            <polygon points="25,25 ${width-25},25 ${width-45},${height-25} 5,${height-25}" fill="none" stroke="url(#primaryGold)" stroke-width="3.5" opacity="0.9" filter="url(#glow)"/>

            <!-- Action Name Slanted Banner -->
            <polygon points="20,35 380,35 360,95 0,95" fill="rgba(8, 5, 20, 0.9)" stroke="${primaryColor}" stroke-width="2" />
            <text x="35" y="75" font-family="'Segoe UI', Arial, sans-serif" font-weight="900" font-size="26" fill="${primaryColor}" filter="url(#glow)">❖ ${escapeXml(title.toUpperCase())}</text>

            <!-- Action Description Slanted Container -->
            <polygon points="40,${height - 130} ${width - 30},${height - 130} ${width - 50},${height - 40} 20,${height - 40}" fill="rgba(5, 3, 15, 0.85)" stroke="${primaryColor}" stroke-width="1.5" />
            <text x="50" y="${height - 85}" font-family="'Segoe UI', sans-serif" font-size="20" fill="#ffffff" font-weight="bold" style="text-shadow: 2px 2px 6px black;">
                ${escapeXml(description)}
            </text>

            <!-- System Info Stamp -->
            <text x="50" y="${height - 50}" font-family="monospace" font-size="11" fill="${primaryColor}" opacity="0.8">
                AFTER THE REBIRTH (ATR) // SEQUENCE [${actionType.toUpperCase()}] ❖ STABLE_FLUX
            </text>

            <!-- Rhombus Diamond Badge -->
            <polygon points="${width - 70},40 ${width - 50},60 ${width - 70},80 ${width - 90},60" fill="rgba(0,0,0,0.85)" stroke="${primaryColor}" stroke-width="2" />
            <text x="${width - 70}" y="66" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="18" fill="${primaryColor}">❖</text>
        </svg>
    `;

    return await sharp(bgBuffer)
        .resize(width, height)
        .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
        .png()
        .toBuffer();
}

/**
 * Generates a grid of skill cards for the player's profile or /skills command in Oblique Diamond style.
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

        let color = '#00ffcc';
        if (skill.name.includes('[Feu]')) color = '#ff4500';
        if (skill.name.includes('[Eau]')) color = '#00ffff';
        if (skill.name.includes('[Terre]')) color = '#8b4513';
        if (skill.name.includes('[Vent]')) color = '#ffffff';

        skillsSvg += `
            <g transform="translate(${x}, ${y})">
                <polygon points="12,0 ${cardWidth},0 ${cardWidth - 12},${cardHeight} 0,${cardHeight}" fill="#100b24" stroke="${color}" stroke-width="1.8" />
                <text x="20" y="38" font-family="'Segoe UI', sans-serif" font-size="18" fill="${color}" font-weight="bold">❖ ${escapeXml(skill.name.substring(0, 20))}</text>
                <text x="20" y="62" font-family="monospace" font-size="12" fill="#aaa">Coût: ${skill.manaCost} PM</text>
                <foreignObject x="20" y="75" width="${cardWidth - 40}" height="60">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="color: #eee; font-family: 'Segoe UI', sans-serif; font-size: 11px; line-height: 1.3;">
                        ${escapeXml(skill.description)}
                    </div>
                </foreignObject>
            </g>
        `;
    });

    const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#060412" />
            <defs>
                <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#ff4500;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#ffd700;stop-opacity:1" />
                </linearGradient>
            </defs>
            <polygon points="0,0 ${width},0 ${width},90 0,100" fill="url(#headerGrad)" />
            <text x="40" y="60" font-family="'Segoe UI', sans-serif" font-size="32" font-weight="900" fill="#000">TECHNIQUES ET SORTS ❖ RANG ${player.rank}</text>
            <text x="${width - 40}" y="60" text-anchor="end" font-family="monospace" font-size="18" font-weight="bold" fill="#000">${player.name.toUpperCase()} // LVL ${player.level}</text>

            ${skillsSvg}
        </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateActionVisual, generateSkillListImage };
