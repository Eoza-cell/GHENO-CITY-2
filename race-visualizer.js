const sharp = require('sharp');

/**
 * Generates an SVG image for race selection in Dragon Ball.
 * @returns {Promise<Buffer>} The image buffer.
 */
async function generateRaceSelectionImage() {
    const width = 1000;
    const height = 400;

    const svgString = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#0a0a0a" />

            <!-- Humain -->
            <rect x="20" y="50" width="180" height="300" rx="10" fill="#2a1a0a" stroke="#ffa500" stroke-width="2" />
            <text x="110" y="90" font-family="Arial" font-size="20" fill="#ffa500" text-anchor="middle" font-weight="bold">HUMAIN</text>
            <text x="110" y="320" font-family="Arial" font-size="12" fill="white" text-anchor="middle">Équilibré &amp; Technique</text>

            <!-- Saiyan -->
            <rect x="215" y="50" width="180" height="300" rx="10" fill="#1a1a2a" stroke="#4d4dff" stroke-width="2" />
            <text x="305" y="90" font-family="Arial" font-size="20" fill="#4d4dff" text-anchor="middle" font-weight="bold">SAIYAN</text>
            <text x="305" y="320" font-family="Arial" font-size="12" fill="white" text-anchor="middle">Force &amp; Zenkai</text>

            <!-- Namek -->
            <rect x="410" y="50" width="180" height="300" rx="10" fill="#0a2a0a" stroke="#4dff4d" stroke-width="2" />
            <text x="500" y="90" font-family="Arial" font-size="20" fill="#4dff4d" text-anchor="middle" font-weight="bold">NAMEK</text>
            <text x="500" y="320" font-family="Arial" font-size="12" fill="white" text-anchor="middle">Soin &amp; Ki</text>

            <!-- Démon du Froid -->
            <rect x="605" y="50" width="180" height="300" rx="10" fill="#1a0a2a" stroke="#ff00ff" stroke-width="2" />
            <text x="695" y="90" font-family="Arial" font-size="20" fill="#ff00ff" text-anchor="middle" font-weight="bold">FROID</text>
            <text x="695" y="320" font-family="Arial" font-size="12" fill="white" text-anchor="middle">Vitesse &amp; Élite</text>

            <!-- Majin -->
            <rect x="800" y="50" width="180" height="300" rx="10" fill="#2a0a1a" stroke="#ff4d4d" stroke-width="2" />
            <text x="890" y="90" font-family="Arial" font-size="20" fill="#ff4d4d" text-anchor="middle" font-weight="bold">MAJIN</text>
            <text x="890" y="320" font-family="Arial" font-size="12" fill="white" text-anchor="middle">Régénération</text>

            <text x="500" y="380" font-family="Arial" font-size="22" fill="white" text-anchor="middle">Choisissez votre race</text>
        </svg>
    `;

    return sharp(Buffer.from(svgString)).png().toBuffer();
}

module.exports = { generateRaceSelectionImage };
