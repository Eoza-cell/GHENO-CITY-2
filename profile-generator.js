const sharp = require('sharp');
const path = require('path');
const axios = require('axios');

async function generateProfileCard(player) {
    const templatePath = path.join(__dirname, 'assets/templates/profile_template.jpg');
    const width = 800;
    const height = 1200;

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
            <text x="60" y="730" class="header">ÉQUIPEMENT & ARMES</text>
            <g transform="translate(60, 775)">
                ${(player.inventory || []).slice(0, 6).map((item, i) => `
                    <text y="${i * 35}" class="text value">${item.name.length > 20 ? item.name.substring(0, 17) + '...' : item.name} x${item.quantity}</text>
                `).join('')}
            </g>

            <!-- Resources -->
            <rect x="50" y="630" width="300" height="40" fill="rgba(0, 170, 255, 0.2)" rx="5" />
            <text x="60" y="658" class="text value" style="fill: #ffd700;">💰 COL: ${(player.col || 0).toLocaleString()}</text>
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
