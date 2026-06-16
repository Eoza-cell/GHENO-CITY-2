const sharp = require('sharp');

/**
 * Generates a "LINK START" intro image for the tutorial using Sharp and SVG.
 */
async function generateLinkStartImage() {
    const width = 1000;
    const height = 600;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" style="stop-color:#000810;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
            </radialGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Abstract Data Particles -->
        <g fill="#00ffff">
            ${Array.from({length: 100}).map(() => {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = Math.random() * 3;
                const opacity = Math.random() * 0.5;
                return `<circle cx="${x}" cy="${y}" r="${size}" fill-opacity="${opacity}" />`;
            }).join('')}
        </g>

        <!-- "LINK START" Text -->
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="130" fill="white" filter="url(#glow)" style="letter-spacing: 25px;">LINK START</text>

        <!-- Loading Effect -->
        <g transform="translate(500, 520)">
            <rect x="-200" y="0" width="400" height="4" fill="rgba(255, 255, 255, 0.1)" />
            <rect x="-200" y="0" width="300" height="4" fill="#00ffff">
                <animate attributeName="width" from="0" to="400" dur="2s" repeatCount="indefinite" />
            </rect>
            <text x="0" y="30" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="18" fill="#00ffff">INITIALIZING_NEURAL_LINK...</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateLinkStartImage };
