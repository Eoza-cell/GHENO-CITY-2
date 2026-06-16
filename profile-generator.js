const sharp = require('sharp');
const path = require('path');
const axios = require('axios');

async function generateProfileCard(player) {
    const templatePath = path.join(__dirname, 'assets/templates/profile_template.jpg');

    // Get metadata to ensure overlay matches dimensions
    const metadata = await sharp(templatePath).metadata();
    const width = metadata.width;
    const height = metadata.height;

    // Calculate bar widths (template bars are approx 150px wide in the design)
    const maxBarWidth = 150;
    const getBarWidth = (current, max) => Math.max(5, Math.min(maxBarWidth, (current / max) * maxBarWidth));

    const stats = [
        { name: 'Force', value: player.strength, max: 100, y: 412 },
        { name: 'Dextérité', value: player.agility, max: 100, y: 445 },
        { name: 'Intelligence', value: player.intelligence, max: 100, y: 478 },
        { name: 'Endurance', value: player.defense, max: 100, y: 511 },
        { name: 'Charisme', value: player.luck, max: 100, y: 544 }, // Using luck for charisma in template
        { name: 'Chance', value: player.luck, max: 100, y: 577 }
    ];

    let statsSvg = '';
    stats.forEach(stat => {
        const barWidth = getBarWidth(stat.value, stat.max);
        statsSvg += `<rect x="230" y="${stat.y}" width="${barWidth}" height="12" fill="#4fb3ff" rx="2" />`;
    });

    const xpNeeded = player.level * 100;

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .text { fill: white; font-family: 'Arial'; font-weight: bold; }
                .name { font-size: 24px; }
                .value { font-size: 20px; }
                .header { font-size: 22px; fill: #4fb3ff; }
                .money { font-size: 28px; fill: #ffd700; font-weight: 900; }
            </style>

            <!-- Player Info -->
            <text x="210" y="235" class="text name">${player.name}</text>
            <text x="210" y="268" class="text value">${player.level}</text>
            <text x="210" y="301" class="text value">${player.schoolName || 'Aucune'}</text>
            <text x="210" y="334" class="text value">Rang ${player.rank}</text>

            <text x="650" y="235" class="text value">${player.class}</text>
            <text x="650" y="268" class="text value">${player.level}</text>
            <text x="650" y="334" class="text value">Grade ${player.academicGrade}</text>

            <!-- Stats Bars Overlay -->
            ${statsSvg}

            <!-- Inventory Summary (Equipment & Weapons) -->
            <rect x="50" y="700" width="700" height="400" fill="rgba(0,0,0,0.4)" rx="10" />
            <text x="70" y="740" class="header">📦 INVENTAIRE ET ÉQUIPEMENT</text>
            <line x1="70" y1="755" x2="400" y2="755" stroke="#4fb3ff" stroke-width="2" />

            <g transform="translate(70, 800)">
                ${(player.inventory || []).length > 0 ? (player.inventory || []).slice(0, 10).map((item, i) => `
                    <text x="${(i % 2) * 350}" y="${Math.floor(i / 2) * 45}" class="text value">▶ ${item.name.length > 22 ? item.name.substring(0, 19) + '...' : item.name} (x${item.quantity})</text>
                `).join('') : '<text y="40" class="text value" style="fill: #888;">Aucun équipement...</text>'}
            </g>

            <!-- Resources -->
            <rect x="50" y="620" width="350" height="60" fill="rgba(0,0,0,0.6)" stroke="#ffd700" stroke-width="2" rx="5" />
            <text x="70" y="660" class="money">💰 ${(player.col || 0).toLocaleString()} COL</text>

            <!-- Family Tag -->
            <text x="500" y="660" class="text header" style="fill: #ff00ff;">FAMILLE: ${player.family || 'Inconnue'}</text>
        </svg>
    `;

    try {
        let profileImg;
        if (player.profilePicUrl) {
            try {
                const response = await axios.get(player.profilePicUrl, { responseType: 'arraybuffer' });
                profileImg = await sharp(response.data)
                    .resize(150, 150)
                    .toBuffer();
            } catch (e) {
                console.warn("Could not load profile pic:", e.message);
            }
        }

        const template = sharp(templatePath);
        const compositeOperations = [
            { input: Buffer.from(overlaySvg), top: 0, left: 0 }
        ];

        if (profileImg) {
            // Place profile pic in a placeholder spot if template has one,
            // otherwise just overlay somewhere sensible.
            // For this template, let's try top left area or next to name.
            compositeOperations.push({ input: profileImg, top: 180, left: 50 });
        }

        return await template
            .composite(compositeOperations)
            .jpeg()
            .toBuffer();
    } catch (error) {
        console.error("Error generating profile card:", error);
        throw error;
    }
}

module.exports = { generateProfileCard };
