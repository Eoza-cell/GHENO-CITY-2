const sharp = require('sharp');
const { escapeXml } = require('./utils');

/**
 * Wraps text into an array of lines based on max width.
 */
function wrapText(text, maxCharsPerLine) {
    if (!text) return [];
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
 * Generate an image representing a blackboard with chalk writing.
 */
async function generateBlackboardImage(text, title = "LEÇON DU JOUR") {
    const width = 1000;
    const height = 700;
    const padding = 80;
    const maxChars = 60;
    const lineHeight = 45;

    const lines = wrapText(text, maxChars);
    const textSvg = lines.map((line, i) =>
        `<text x="${padding}" y="${180 + (i * lineHeight)}" font-family="monospace" font-size="28" fill="#f0f0f0" opacity="0.9" style="filter: url(#chalkBlur);">${escapeXml(line)}</text>`
    ).join('\n');

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="chalkBlur">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
                <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
            </filter>
            <filter id="slateTexture">
                <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="4" result="noise" />
                <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.15 0" />
            </filter>
        </defs>

        <!-- Blackboard Frame -->
        <rect width="${width}" height="${height}" fill="#2b1d1a" />

        <!-- Slate Surface -->
        <rect x="15" y="15" width="${width - 30}" height="${height - 30}" fill="#16261e" />
        <rect x="15" y="15" width="${width - 30}" height="${height - 30}" fill="url(#slateTexture)" opacity="0.4" />

        <!-- Chalk Dust Overlays -->
        <rect x="15" y="15" width="${width - 30}" height="${height - 30}" fill="white" opacity="0.03" filter="url(#chalkBlur)" />

        <!-- Title -->
        <text x="50%" y="85" font-family="monospace" font-size="48" fill="#ffffff" text-anchor="middle" font-weight="bold" opacity="0.9" style="filter: url(#chalkBlur);">${escapeXml(title)}</text>
        <line x1="150" y1="110" x2="850" y2="110" stroke="white" stroke-width="3" opacity="0.4" stroke-dasharray="8,4" />

        <!-- Content -->
        ${textSvg}

        <!-- Chalk on the bottom ledge -->
        <rect x="800" y="${height - 45}" width="60" height="15" fill="white" rx="5" opacity="0.9" />
    </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generate a detailed magic technique explanation board.
 */
async function generateMagicDetailBoard(skill) {
    const width = 1000;
    const height = 800;

    const color = skill.type === 'Magique' ? '#cc44ff' : '#ffd700';

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#020208;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0a0a1a;stop-opacity:1" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Border -->
        <rect x="20" y="20" width="${width - 40}" height="${height - 40}" fill="none" stroke="${color}" stroke-width="2" rx="15" opacity="0.5" />

        <!-- Header -->
        <path d="M 0 0 L 400 0 L 450 80 L 0 80 Z" fill="${color}" opacity="0.8" transform="translate(20, 20)" />
        <text x="50" y="75" font-family="Arial Black" font-size="35" fill="white" filter="url(#glow)">${escapeXml(skill.name.toUpperCase())}</text>

        <!-- Type & Cost -->
        <text x="500" y="70" font-family="Arial" font-size="24" fill="${color}" font-weight="bold">TYPE: ${escapeXml(skill.type)}</text>
        <text x="${width - 50}" y="70" text-anchor="end" font-family="Arial" font-size="24" fill="${color}" font-weight="bold">COÛT: ${skill.manaCost} PM</text>

        <!-- Main Description Section -->
        <rect x="50" y="150" width="${width - 100}" height="150" fill="rgba(255,255,255,0.05)" rx="10" />
        <text x="70" y="190" font-family="Arial" font-size="22" fill="#ffffff" font-weight="bold">DESCRIPTION :</text>
        <foreignObject x="70" y="205" width="${width - 140}" height="80">
            <div xmlns="http://www.w3.org/1999/xhtml" style="color: #ddd; font-family: Arial; font-size: 18px; line-height: 1.4;">
                ${escapeXml(skill.description)}
            </div>
        </foreignObject>

        <!-- Logic Section -->
        <rect x="50" y="320" width="${width - 100}" height="200" fill="rgba(255,255,255,0.05)" rx="10" />
        <text x="70" y="360" font-family="Arial" font-size="22" fill="${color}" font-weight="bold">LOGIQUE DE FLUX :</text>
        <foreignObject x="70" y="375" width="${width - 140}" height="130">
            <div xmlns="http://www.w3.org/1999/xhtml" style="color: #ddd; font-family: Arial; font-size: 18px; line-height: 1.4; font-style: italic;">
                ${escapeXml(skill.logic || "Cette technique manipule l'éther environnant pour créer une manifestation physique de volonté. Sa puissance dépend de la concentration et de la maîtrise du flux.")}
            </div>
        </foreignObject>

        <!-- Stats/Diagram placeholder -->
        <g transform="translate(50, 540)">
            <rect width="${width - 100}" height="200" fill="rgba(255,255,255,0.05)" rx="10" />
            <text x="20" y="40" font-family="Arial" font-size="22" fill="#ffffff" font-weight="bold">POTENTIEL TACTIQUE :</text>

            <!-- Bars -->
            <text x="20" y="80" font-family="Arial" font-size="18" fill="#aaa">PUISSANCE</text>
            <rect x="150" y="65" width="600" height="15" fill="rgba(255,255,255,0.1)" rx="5" />
            <rect x="150" y="65" width="${(skill.power || 70) * 6}" height="15" fill="${color}" rx="5" />

            <text x="20" y="120" font-family="Arial" font-size="18" fill="#aaa">PORTÉE</text>
            <rect x="150" y="105" width="600" height="15" fill="rgba(255,255,255,0.1)" rx="5" />
            <rect x="150" y="105" width="${(skill.range || 40) * 6}" height="15" fill="${color}" rx="5" />

            <text x="20" y="160" font-family="Arial" font-size="18" fill="#aaa">COMPLEXITÉ</text>
            <rect x="150" y="145" width="600" height="15" fill="rgba(255,255,255,0.1)" rx="5" />
            <rect x="150" y="145" width="${(skill.complexity || 50) * 6}" height="15" fill="${color}" rx="5" />
        </g>

        <!-- System Footer -->
        <text x="50%" y="${height - 20}" font-family="monospace" font-size="14" fill="${color}" text-anchor="middle" opacity="0.6">
            ARCHIVES MAGIQUES D'AETHERYS // ANALYSE DE FLUX RÉSOLUE // UNITÉ MJ ATR
        </text>
    </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateBlackboardImage, generateMagicDetailBoard };
