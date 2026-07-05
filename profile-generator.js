const sharp = require('sharp');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

async function generateProfileCard(player) {
    const templatePath = path.join(__dirname, 'assets/templates/profile_template.jpg');

    // Check if template exists
    if (!fs.existsSync(templatePath)) {
        console.warn("Profile template not found, using blank background.");
        // Create a blank dark blue background if template missing
        const width = 800;
        const height = 1100;
        const svg = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#050510" />
                <rect x="20" y="20" width="${width-40}" height="${height-40}" fill="none" stroke="#ffd700" stroke-width="2" rx="15" />
            </svg>
        `;
        const baseImg = await sharp(Buffer.from(svg)).png().toBuffer();
        return await addOverlay(baseImg, player, width, height);
    }

    const metadata = await sharp(templatePath).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const baseImg = await sharp(templatePath).toBuffer();
    return await addOverlay(baseImg, player, width, height);
}

async function addOverlay(baseImg, player, width, height) {
    // Calculate bar widths (template bars are approx 150px wide in the design)
    const maxBarWidth = 150;
    const getBarWidth = (current, max) => Math.max(5, Math.min(maxBarWidth, (current / Math.max(1, max)) * maxBarWidth));

    const stats = [
        { name: 'Force', value: player.strength, max: 100, y: 412 },
        { name: 'Dextérité', value: player.agility, max: 100, y: 445 },
        { name: 'Intelligence', value: player.intelligence, max: 100, y: 478 },
        { name: 'Endurance', value: player.defense, max: 100, y: 511 },
        { name: 'Charisme', value: player.luck, max: 100, y: 544 },
        { name: 'Chance', value: player.luck, max: 100, y: 577 }
    ];

    let statsSvg = '';
    stats.forEach(stat => {
        const barWidth = getBarWidth(stat.value, stat.max);
        statsSvg += `<rect x="230" y="${stat.y}" width="${barWidth}" height="12" fill="#4fb3ff" rx="2" />`;
    });

    // Handle inventory categories
    const inventory = player.inventory || [];
    // Enhanced filtering for weapons vs equipment
    const weaponKeywords = ['épée', 'lame', 'dague', 'bâton', 'arc', 'lance', 'hache', 'sword', 'blade', 'dagger', 'staff', 'bow', 'spear', 'axe', 'katana', 'rapier'];
    const weapons = inventory.filter(i => weaponKeywords.some(k => i.name.toLowerCase().includes(k))).slice(0, 4);
    const equipment = inventory.filter(i => !weaponKeywords.some(k => i.name.toLowerCase().includes(k))).slice(0, 4);

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .text { fill: white; font-family: 'Arial'; font-weight: bold; }
                .name { font-size: 28px; fill: #ffd700; }
                .value { font-size: 20px; }
                .header { font-size: 22px; fill: #4fb3ff; }
                .money { font-size: 32px; fill: #ffd700; font-weight: 900; }
                .item-text { font-size: 16px; fill: #ffffff; }
                .item-qty { font-size: 14px; fill: #00ffff; }
            </style>

            <!-- Player Info -->
            <text x="210" y="235" class="text name">${player.name}</text>
            <text x="210" y="268" class="text value">LVL ${player.level}</text>
            <text x="210" y="301" class="text value">${player.schoolName || 'Aventurier Libre'}</text>
            <text x="210" y="334" class="text value">RANG ${player.rank}</text>

            <text x="600" y="235" class="text value" text-anchor="end">${player.occupation || 'Citoyen'}</text>
            <text x="600" y="268" class="text value" text-anchor="end">${player.organization || 'Aucune'}</text>
            <text x="600" y="301" class="text value" text-anchor="end">INF: ${player.influence || 0}</text>
            <text x="600" y="334" class="text value" text-anchor="end">GRADE ${player.academicGrade || 0}</text>

            <!-- Stats Bars Overlay -->
            ${statsSvg}

            <!-- Survival Bars (Hunger & Sleep) -->
            <rect x="420" y="412" width="330" height="75" fill="rgba(0,0,0,0.8)" stroke="#00ff00" stroke-width="1" rx="10" />
            <text x="435" y="435" class="text item-text" style="fill: #00ff00;">🍔 FAIM</text>
            <rect x="520" y="423" width="200" height="15" fill="#333" rx="5" />
            <rect x="520" y="423" width="${(player.hunger / 100) * 200}" height="15" fill="#00ff00" rx="5" />
            <text x="730" y="435" class="text item-qty">${player.hunger}%</text>

            <text x="435" y="470" class="text item-text" style="fill: #8a2be2;">😴 SOMMEIL</text>
            <rect x="520" y="458" width="200" height="15" fill="#333" rx="5" />
            <rect x="520" y="458" width="${(player.sleep / 100) * 200}" height="15" fill="#8a2be2" rx="5" />
            <text x="730" y="470" class="text item-qty">${player.sleep}%</text>

            <!-- Resources Box -->
            <rect x="50" y="615" width="350" height="75" fill="rgba(0,0,0,0.8)" stroke="#ffd700" stroke-width="3" rx="15" />
            <text x="75" y="665" class="money">💰 ${(player.col || 0).toLocaleString()} COL</text>

            <!-- Family Tag -->
            <rect x="420" y="615" width="330" height="75" fill="rgba(0,0,0,0.8)" stroke="#ff00ff" stroke-width="2" rx="15" />
            <text x="585" y="660" class="text header" text-anchor="middle" style="fill: #ff00ff; font-size: 20px;">${player.family || 'SANS FAMILLE'}</text>

            <!-- Grid: Weapons -->
            <rect x="50" y="710" width="340" height="280" fill="rgba(0,0,0,0.6)" stroke="#ff4444" stroke-width="1" rx="10" />
            <text x="70" y="745" class="header" style="fill: #ff4444;">⚔️ ARMES</text>
            <g transform="translate(70, 770)">
                ${weapons.length > 0 ? weapons.map((item, i) => `
                    <g transform="translate(0, ${i * 50})">
                        <rect width="300" height="40" fill="rgba(255,255,255,0.05)" rx="5" />
                        <text x="10" y="25" class="text item-text">${item.name.substring(0, 25)}</text>
                        <text x="280" y="25" class="text item-qty" text-anchor="end">x${item.quantity}</text>
                    </g>
                `).join('') : '<text y="40" class="text value" style="fill: #555;">Aucune arme...</text>'}
            </g>

            <!-- Grid: Equipment -->
            <rect x="410" y="710" width="340" height="280" fill="rgba(0,0,0,0.6)" stroke="#4fb3ff" stroke-width="1" rx="10" />
            <text x="430" y="745" class="header" style="fill: #4fb3ff;">🛡️ ÉQUIPEMENT</text>
            <g transform="translate(430, 770)">
                ${equipment.length > 0 ? equipment.map((item, i) => `
                    <g transform="translate(0, ${i * 50})">
                        <rect width="300" height="40" fill="rgba(255,255,255,0.05)" rx="5" />
                        <text x="10" y="25" class="text item-text">${item.name.substring(0, 25)}</text>
                        <text x="280" y="25" class="text item-qty" text-anchor="end">x${item.quantity}</text>
                    </g>
                `).join('') : '<text y="40" class="text value" style="fill: #555;">Aucun équipement...</text>'}
            </g>

            <text x="50%" y="1050" text-anchor="middle" font-family="monospace" font-size="14" fill="rgba(255,255,255,0.4)">ID_ENCRYPTED: ${player.whatsappId.substring(0, 8)}...</text>
        </svg>
    `;

    try {
        let profileImg;
        if (player.profilePicUrl) {
            try {
                if (player.profilePicUrl.startsWith('http')) {
                    const response = await axios.get(player.profilePicUrl, { responseType: 'arraybuffer' });
                    profileImg = await sharp(response.data).resize(150, 150).toBuffer();
                } else if (fs.existsSync(player.profilePicUrl)) {
                    profileImg = await sharp(player.profilePicUrl).resize(150, 150).toBuffer();
                }
            } catch (e) {
                console.warn("Could not load profile pic:", e.message);
            }
        }

        const compositeOperations = [
            { input: Buffer.from(overlaySvg), top: 0, left: 0 }
        ];

        if (profileImg) {
            compositeOperations.push({ input: profileImg, top: 180, left: 45 });
        }

        return await sharp(baseImg)
            .composite(compositeOperations)
            .jpeg()
            .toBuffer();
    } catch (error) {
        console.error("Error generating profile card:", error);
        throw error;
    }
}

module.exports = { generateProfileCard };
