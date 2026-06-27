const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Generates a visually appealing main menu image inspired by Satisfactory UI.
 * Optimized for ARISE II - GHENO CITY theme.
 */
async function generateMainMenuImage() {
    const width = 1200;
    const height = 675; // 16:9 ratio

    const backgroundPath = 'assets/locations/eldoria.jpg';
    const newsImagePath = 'assets/locations/necropolis.jpg';

    let background;
    if (fs.existsSync(backgroundPath)) {
        background = await sharp(backgroundPath)
            .resize(width, height)
            .blur(1.2)
            .modulate({ brightness: 0.7, saturation: 0.8 })
            .toBuffer();
    } else {
        background = await sharp({
            create: { width, height, channels: 4, background: { r: 15, g: 15, b: 25, alpha: 1 } }
        }).png().toBuffer();
    }

    let newsImage;
    if (fs.existsSync(newsImagePath)) {
        newsImage = await sharp(newsImagePath)
            .resize(300, 150, { fit: 'cover' })
            .toBuffer();
    } else {
        newsImage = await sharp({
            create: { width: 300, height: 150, channels: 4, background: { r: 40, g: 40, b: 60, alpha: 1 } }
        }).png().toBuffer();
    }

    const svgOverlay = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="blackFade" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:black;stop-opacity:0.8" />
                <stop offset="40%" style="stop-color:black;stop-opacity:0.4" />
                <stop offset="100%" style="stop-color:black;stop-opacity:0" />
            </linearGradient>
        </defs>

        <!-- Left side fade for text readability -->
        <rect width="600" height="${height}" fill="url(#blackFade)" />

        <!-- Logo / Title -->
        <g transform="translate(70, 70)">
            <text font-family="sans-serif" font-weight="900" font-size="90" fill="white" style="letter-spacing: 2px;">ARISE</text>
            <text x="5" y="115" font-family="sans-serif" font-weight="bold" font-size="28" fill="#ffaa00" style="letter-spacing: 12px;">GHENO CITY</text>
            <rect x="0" y="135" width="260" height="5" fill="#ffaa00" />
            <text x="0" y="165" font-family="sans-serif" font-size="16" fill="white" opacity="0.8">EARLY ACCESS VERSION 2.0 // GEMMA 3</text>
        </g>

        <!-- Primary Menu Items -->
        <g transform="translate(70, 260)" font-family="sans-serif" font-weight="bold" font-size="42" fill="white">
            <text y="0">CONTINUER</text>
            <text y="70" opacity="0.8">NOUVELLE PARTIE</text>
            <text y="140" opacity="0.8">REJOINDRE</text>
            <text y="210" opacity="0.8">CHARGER</text>
        </g>

        <!-- Secondary Menu Items -->
        <g transform="translate(70, 520)" font-family="sans-serif" font-weight="bold" font-size="24" fill="white" opacity="0.6">
            <text y="0">OPTIONS</text>
            <text y="45">CRÉDITS</text>
            <text y="90">QUITTER</text>
        </g>

        <!-- Right Side Panel (News / Patch Notes) -->
        <g transform="translate(830, 70)">
            <rect width="320" height="520" rx="4" fill="rgba(0,0,0,0.75)" stroke="rgba(255,255,255,0.15)" stroke-width="1" />

            <rect width="320" height="45" rx="4" fill="#ffaa00" />
            <text x="160" y="30" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="20" fill="black">UPDATE 2.0 NOTES</text>

            <!-- Placeholder for news image (will be composited) -->
            <rect x="10" y="55" width="300" height="150" fill="none" />

            <g transform="translate(15, 230)" font-family="sans-serif" fill="white">
                <text font-weight="bold" font-size="18">L'Éveil de Gemma 3</text>
                <text y="25" font-size="13" opacity="0.6">Build 211839 - ARISE Team</text>

                <text y="60" font-size="14" opacity="0.9">Le serveur d'intelligence mondiale</text>
                <text y="80" font-size="14" opacity="0.9">est désormais opérationnel.</text>

                <text y="110" font-size="14" opacity="0.9">• IA Gemma 3 ultra-réactive</text>
                <text y="130" font-size="14" opacity="0.9">• Synchronisation Inventaire</text>
                <text y="150" font-size="14" opacity="0.9">• Géopolitique dynamique</text>
                <text y="170" font-size="14" opacity="0.9">• Nouveaux Donjons de Rang S</text>

                <text y="210" font-size="14" font-weight="bold" fill="#ffaa00">LIRE LA SUITE...</text>
            </g>
        </g>

        <!-- Footer Info -->
        <g transform="translate(30, 655)" font-family="sans-serif" font-size="12" fill="white" opacity="0.4">
            <text>NOT LOGGED INTO VOID // CONNECTED AS PIONEER</text>
            <text x="1140" text-anchor="end">SYSTEM STATUS: NOMINAL // ARISE ENGINE v2.0</text>
        </g>

        <!-- Social Icons Simulation -->
        <g transform="translate(930, 640)" opacity="0.7">
             <circle cx="0" cy="0" r="14" fill="none" stroke="white" stroke-width="2" />
             <circle cx="40" cy="0" r="14" fill="none" stroke="white" stroke-width="2" />
             <circle cx="80" cy="0" r="14" fill="none" stroke="white" stroke-width="2" />
             <circle cx="120" cy="0" r="14" fill="none" stroke="white" stroke-width="2" />
             <circle cx="160" cy="0" r="14" fill="none" stroke="white" stroke-width="2" />
             <circle cx="200" cy="0" r="14" fill="none" stroke="white" stroke-width="2" />
        </g>
    </svg>
    `;

    return sharp(background)
        .composite([
            { input: Buffer.from(svgOverlay), top: 0, left: 0 },
            { input: newsImage, top: 125, left: 840 } // Adjust top/left to match the rectangle in SVG
        ])
        .png()
        .toBuffer();
}

module.exports = { generateMainMenuImage };
