const sharp = require('sharp');

/**
 * Generates a "LINK START" intro image for the tutorial using Sharp and SVG.
 * Improved visual style with more "anime" vibe.
 */
async function generateLinkStartImage() {
    const width = 1200;
    const height = 700;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" style="stop-color:#001020;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#000005;stop-opacity:1" />
            </radialGradient>
            <linearGradient id="textGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#00ffff;stop-opacity:1" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="textGlow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Perspective lines -->
        <g stroke="#00ffff" stroke-width="0.5" opacity="0.2">
            ${Array.from({length: 20}).map((_, i) => {
                const angle = (i / 20) * Math.PI * 2;
                const x2 = 500 + Math.cos(angle) * 2000;
                const y2 = 350 + Math.sin(angle) * 2000;
                return `<line x1="600" y1="350" x2="${x2}" y2="${y2}" />`;
            }).join('')}
        </g>

        <!-- Data Particles -->
        <g>
            ${Array.from({length: 150}).map(() => {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = Math.random() * 2 + 1;
                const opacity = Math.random() * 0.7;
                return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#00ffff" opacity="${opacity}" />`;
            }).join('')}
        </g>

        <!-- "LINK START" Main Text -->
        <g filter="url(#glow)">
            <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="IPAGothic" font-weight="900" font-size="180" fill="url(#textGrad)" style="letter-spacing: 40px; filter: drop-shadow(0 0 30px #00ffff);">LINK START</text>
        </g>

        <!-- Decorative Circles -->
        <circle cx="50%" cy="45%" r="300" fill="none" stroke="#00ffff" stroke-width="1" opacity="0.2" stroke-dasharray="10 20" />
        <circle cx="50%" cy="45%" r="350" fill="none" stroke="#00ffff" stroke-width="0.5" opacity="0.1" />

        <!-- Loading Interface -->
        <g transform="translate(600, 580)">
            <!-- Progress Bar Frame -->
            <rect x="-300" y="0" width="600" height="10" fill="rgba(255, 255, 255, 0.05)" stroke="rgba(0, 255, 255, 0.3)" stroke-width="1" rx="5" />
            <!-- Active Bar -->
            <rect x="-300" y="2" width="500" height="6" fill="#00ffff" rx="3" filter="url(#textGlow)">
                <animate attributeName="width" from="0" to="600" dur="3s" repeatCount="1" />
            </rect>

            <text x="0" y="40" dominant-baseline="middle" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="20" fill="#00ffff" filter="url(#textGlow)" style="letter-spacing: 2px;">NEURAL_CONNECTION_ESTABLISHED</text>
            <text x="0" y="65" dominant-baseline="middle" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="14" fill="rgba(255, 255, 255, 0.5)">GHENO_OS v4.2.1 // WELCOME_USER</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateLinkStartImage };
