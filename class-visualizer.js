const sharp = require('sharp');

/**
 * Generates an SVG image for class selection.
 * @returns {Promise<Buffer>} The image buffer.
 */
async function generateClassSelectionImage() {
    const width = 800;
    const height = 400;

    const svgString = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#121212" />

            <!-- Braqueur -->
            <rect x="50" y="50" width="200" height="300" rx="15" fill="#4a1a1a" stroke="#ff4d4d" stroke-width="3" />
            <text x="150" y="100" font-family="Arial" font-size="24" fill="#ff4d4d" text-anchor="middle" font-weight="bold">BRAQUEUR</text>
            <path d="M120 150 L180 150 L180 280 L120 280 Z" fill="#888" /> <!-- Gun placeholder -->
            <text x="150" y="320" font-family="Arial" font-size="14" fill="white" text-anchor="middle">Force &amp; Braquage</text>

            <!-- Hacker -->
            <rect x="300" y="50" width="200" height="300" rx="15" fill="#1a1a4a" stroke="#4d4dff" stroke-width="3" />
            <text x="400" y="100" font-family="Arial" font-size="24" fill="#4d4dff" text-anchor="middle" font-weight="bold">HACKER</text>
            <rect x="360" y="180" width="80" height="50" fill="#4d4dff" opacity="0.6" /> <!-- Laptop placeholder -->
            <text x="400" y="320" font-family="Arial" font-size="14" fill="white" text-anchor="middle">Tech &amp; Intelligence</text>

            <!-- Pilote -->
            <rect x="550" y="50" width="200" height="300" rx="15" fill="#1a4a1a" stroke="#4dff4d" stroke-width="3" />
            <text x="650" y="100" font-family="Arial" font-size="24" fill="#4dff4d" text-anchor="middle" font-weight="bold">PILOTE</text>
            <circle cx="650" cy="200" r="40" fill="#444" stroke="white" stroke-width="5" stroke-dasharray="20,10" /> <!-- Steering wheel placeholder -->
            <text x="650" y="320" font-family="Arial" font-size="14" fill="white" text-anchor="middle">Agilité &amp; Vitesse</text>

            <text x="400" y="380" font-family="Arial" font-size="20" fill="white" text-anchor="middle">Choisissez votre destinée</text>
        </svg>
    `;

    return sharp(Buffer.from(svgString)).png().toBuffer();
}

module.exports = { generateClassSelectionImage };
