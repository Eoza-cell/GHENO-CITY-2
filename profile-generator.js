const sharp = require('sharp');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

async function generateProfileCard(player) {
    const width = 800;
    const height = 1100;
    const templatePath = path.join(__dirname, 'assets/templates/profile_template.jpg');

    let baseImg;

    // Use player's profile picture as background if available, otherwise template
    if (player.profilePicUrl && fs.existsSync(player.profilePicUrl)) {
        baseImg = await sharp(player.profilePicUrl)
            .resize(width, height, { fit: 'cover' })
            .toBuffer();
    } else if (fs.existsSync(templatePath)) {
        baseImg = await sharp(templatePath).resize(width, height).toBuffer();
    } else {
        const svg = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#050510" />
            </svg>
        `;
        baseImg = await sharp(Buffer.from(svg)).png().toBuffer();
    }

    return await addOverlay(baseImg, player, width, height);
}

async function addOverlay(baseImg, player, width, height) {
    const { Item } = require('./database');

    // Fetch equipped outfit details
    let outfitColor = "rgba(255,255,255,0.2)";
    let isTorn = false;
    if (player.equippedOutfit) {
        const outfit = await Item.findOne({ where: { name: player.equippedOutfit } });
        if (outfit) {
            outfitColor = outfit.visualData?.color || "#ffffff";
            isTorn = outfit.durability < 50;
        }
    }

    // Calculate bar widths
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

    const inventory = player.inventory || [];
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

            <!-- Semi-transparent dark background for readability -->
            <rect x="30" y="180" width="${width-60}" height="${height-250}" fill="#050505" rx="15" />

            <!-- Info Container Block -->
            <rect x="50" y="200" width="700" height="180" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" rx="10" />

            <!-- Player Info -->
            <text x="210" y="245" class="text name">${player.name} (${player.gender})</text>
            <text x="210" y="278" class="text value">LVL ${player.level} | ${player.age} ans</text>
            <text x="210" y="311" class="text value">${player.schoolName || 'Aventurier Libre'}</text>
            <text x="210" y="344" class="text value">RANG ${player.rank}</text>

            <text x="730" y="245" class="text value" text-anchor="end">${player.occupation || 'Citoyen'}</text>
            <text x="730" y="278" class="text value" text-anchor="end">${player.organization || 'Aucune'}</text>
            <text x="730" y="311" class="text value" text-anchor="end">INF: ${player.influence || 0}</text>
            <text x="730" y="344" class="text value" text-anchor="end">GRADE ${player.academicGrade || 0}</text>

            <!-- Stats & Survival Container Block -->
            <rect x="50" y="400" width="700" height="200" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" rx="10" />

            <!-- Stats Bars Overlay -->
            ${statsSvg}

            <!-- Survival Bars (Hunger & Sleep) -->
            <g transform="translate(420, 420)">
                <text x="15" y="15" class="text item-text" style="fill: #00ff00;">🍔 FAIM</text>
                <rect x="100" y="3" width="180" height="15" fill="#333" rx="5" />
                <rect x="100" y="3" width="${(player.hunger / 100) * 180}" height="15" fill="#00ff00" rx="5" />
                <text x="310" y="15" class="text item-qty" text-anchor="end">${player.hunger}%</text>

                <text x="15" y="50" class="text item-text" style="fill: #8a2be2;">😴 SOMMEIL</text>
                <rect x="100" y="38" width="180" height="15" fill="#333" rx="5" />
                <rect x="100" y="38" width="${(player.sleep / 100) * 180}" height="15" fill="#8a2be2" rx="5" />
                <text x="310" y="50" class="text item-qty" text-anchor="end">${player.sleep}%</text>
            </g>

            <!-- Resources Box -->
            <rect x="50" y="615" width="350" height="75" fill="rgba(255,255,255,0.05)" stroke="#ffd700" stroke-width="2" rx="15" />
            <text x="75" y="665" class="money">💰 ${(player.col || 0).toLocaleString()} COL</text>

            <!-- Family Tag -->
            <rect x="420" y="615" width="330" height="75" fill="rgba(255,255,255,0.05)" stroke="#ff00ff" stroke-width="1" rx="15" />
            <text x="585" y="660" class="text header" text-anchor="middle" style="fill: #ff00ff; font-size: 20px;">${player.family || 'SANS FAMILLE'}</text>

            <!-- Grid: Weapons -->
            <rect x="50" y="710" width="340" height="280" fill="rgba(255,255,255,0.02)" stroke="#ff4444" stroke-width="1" rx="10" />
            <text x="70" y="745" class="header" style="fill: #ff4444;">⚔️ ARMES</text>
            <g transform="translate(70, 770)">
                ${weapons.length > 0 ? weapons.map((item, i) => `
                    <g transform="translate(0, ${i * 50})">
                        <rect width="300" height="40" fill="rgba(255,255,255,0.03)" rx="5" />
                        <text x="10" y="25" class="text item-text">${item.name.substring(0, 25)}</text>
                        <text x="280" y="25" class="text item-qty" text-anchor="end">x${item.quantity}</text>
                    </g>
                `).join('') : '<text y="40" class="text value" style="fill: #555;">Aucune arme...</text>'}
            </g>

            <!-- Grid: Equipment -->
            <rect x="410" y="710" width="340" height="280" fill="rgba(255,255,255,0.02)" stroke="#4fb3ff" stroke-width="1" rx="10" />
            <text x="430" y="745" class="header" style="fill: #4fb3ff;">🛡️ ÉQUIPEMENT</text>
            <g transform="translate(430, 770)">
                ${equipment.length > 0 ? equipment.map((item, i) => `
                    <g transform="translate(0, ${i * 50})">
                        <rect width="300" height="40" fill="rgba(255,255,255,0.03)" rx="5" />
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
            compositeOperations.push({ input: profileImg, top: 200, left: 45 });
        }

        // Add human silhouette and outfit overlay
        const silhouettePath = path.join(__dirname, 'assets/silhouette.jpg');
        if (fs.existsSync(silhouettePath)) {
            // First, make silhouette black and transparent background if it's the new jpg
            // Since it's a JPG from the user, we assume it's black on white.
            // We'll mask it.
            let silhouette = sharp(silhouettePath).resize(300, 600);

            // Create the "clothing" layer by tinting the silhouette
            const clothingLayer = await sharp(silhouettePath)
                .resize(300, 600)
                .threshold(200) // Keep black parts
                .negate() // Invert so silhouette is white/alpha
                .tint(outfitColor)
                .modulate({ opacity: 0.8 })
                .toBuffer();

            // If torn, add some "holes" to the clothing layer via SVG mask
            let mask = null;
            if (isTorn) {
                const maskSvg = `
                    <svg width="300" height="600">
                        <rect width="100%" height="100%" fill="white" />
                        <circle cx="150" cy="200" r="30" fill="black" />
                        <circle cx="120" cy="350" r="20" fill="black" />
                        <rect x="50" y="450" width="100" height="10" fill="black" transform="rotate(45 100 450)"/>
                    </svg>
                `;
                mask = Buffer.from(maskSvg);
            }

            const finalClothing = mask ?
                await sharp(clothingLayer).composite([{ input: mask, blend: 'dest-in' }]).toBuffer() :
                clothingLayer;

            const silhouetteBase = await sharp(silhouettePath)
                .resize(300, 600)
                .negate() // If it's black on white, negate makes it white on black
                .toBuffer();

            // We'll use the silhouette as a mask for the outfit color
            const silhouetteBlack = await sharp(silhouettePath)
                .resize(300, 600)
                .threshold(240) // Keep the black silhouette
                .toBuffer();

            compositeOperations.push({ input: silhouetteBlack, top: 400, left: 450 });
            compositeOperations.push({ input: finalClothing, top: 400, left: 450, blend: 'over' });
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
