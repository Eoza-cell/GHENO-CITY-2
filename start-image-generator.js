const sharp = require('sharp');

/**
 * Generates an ultra-premium "LINK START" intro image for After the Rebirth (ATR)
 * utilizing Sharp and modern vector SVG graphics.
 */
async function generateLinkStartImage() {
    const width = 1200;
    const height = 700;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" style="stop-color:#020b18;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#000207;stop-opacity:1" />
            </radialGradient>
            <linearGradient id="textGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#00ffcc;stop-opacity:1" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="12" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="textGlow">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#bgGrad)" />

        <!-- Futuristic Perspective gridlines -->
        <g stroke="#00ffcc" stroke-width="0.5" opacity="0.15">
            ${Array.from({length: 30}).map((_, i) => {
                const angle = (i / 30) * Math.PI * 2;
                const x2 = 600 + Math.cos(angle) * 2000;
                const y2 = 320 + Math.sin(angle) * 2000;
                return `<line x1="600" y1="320" x2="${x2}" y2="${y2}" />`;
            }).join('')}
        </g>

        <!-- Digital Data Particles / Starfield -->
        <g>
            ${Array.from({length: 200}).map(() => {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = Math.random() * 3 + 1;
                const opacity = Math.random() * 0.8;
                return `<circle cx="${x}" cy="${y}" r="${size}" fill="#00ffcc" opacity="${opacity}" />`;
            }).join('')}
        </g>

        <!-- Circular Tech Decors -->
        <circle cx="50%" cy="45%" r="320" fill="none" stroke="#00ffcc" stroke-width="1.5" opacity="0.3" stroke-dasharray="15 30" />
        <circle cx="50%" cy="45%" r="360" fill="none" stroke="#00ffcc" stroke-width="0.5" opacity="0.15" />
        <circle cx="50%" cy="45%" r="400" fill="none" stroke="#00ffcc" stroke-width="1" opacity="0.1" stroke-dasharray="5 10" />

        <!-- Hexagon grid overlay in background -->
        <g opacity="0.08" stroke="#00ffcc" stroke-width="1" fill="none">
            <polygon points="600,100 773,200 773,400 600,500 427,400 427,200" />
            <polygon points="600,150 730,225 730,375 600,450 470,375 470,225" />
        </g>

        <!-- Header Brand Text -->
        <g transform="translate(600, 100)" text-anchor="middle">
            <text font-family="'Segoe UI', sans-serif" font-weight="900" font-size="20" fill="#00ffcc" letter-spacing="12" filter="url(#textGlow)">SYSTEM INITIALIZATION</text>
            <text y="28" font-family="'Segoe UI', sans-serif" font-size="12" fill="rgba(255, 255, 255, 0.4)" letter-spacing="4">AFTER THE REBIRTH • DIRECT ACCESS</text>
        </g>

        <!-- "LINK START" Main Text with custom ATR styling -->
        <g filter="url(#glow)">
            <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" font-family="'Segoe UI', 'Arial Black', sans-serif" font-weight="900" font-size="140" fill="url(#textGrad)" style="letter-spacing: 25px; filter: drop-shadow(0 0 40px #00ffcc);">LINK START</text>
        </g>

        <!-- Loading Interface / Bottom Status HUD -->
        <g transform="translate(600, 560)">
            <!-- Progress Bar Frame -->
            <rect x="-350" y="0" width="700" height="12" fill="rgba(0, 255, 204, 0.05)" stroke="rgba(0, 255, 204, 0.4)" stroke-width="1.5" rx="6" />
            <!-- Active Progress Bar with nice glow -->
            <rect x="-350" y="2" width="580" height="8" fill="#00ffcc" rx="4" filter="url(#textGlow)">
                <animate attributeName="width" from="0" to="700" dur="2s" repeatCount="1" />
            </rect>

            <!-- Loading Info/Bar Markers -->
            <text x="-350" y="-12" font-family="monospace" font-size="11" fill="#00ffcc" opacity="0.8">ATR_OS_CORE_CONNECTED: 85%</text>
            <text x="350" y="-12" font-family="monospace" font-size="11" fill="#00ffcc" opacity="0.8" text-anchor="end">SYS_READY_OK</text>

            <text x="0" y="42" dominant-baseline="middle" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-size="18" font-weight="bold" fill="#00ffcc" filter="url(#textGlow)" style="letter-spacing: 4px;">NEURAL_CONNECTION_ESTABLISHED</text>
            <text x="0" y="68" dominant-baseline="middle" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-size="13" fill="rgba(255, 255, 255, 0.5)">AFTER THE REBIRTH (ATR) • OS v5.0.2 // WELCOME_USER</text>
        </g>
    </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateLinkStartImage };
