const sharp = require('sharp');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { escapeXml } = require('./utils');
const { generate3DVisual } = require('./three-renderer');

async function generateProfileCard(player) {
    const width = 800;
    const height = 1100;
    const templatePath = path.join(__dirname, 'assets/templates/profile_template.jpg');

    let baseImg;

    // Use player's profile picture as background if available, otherwise template
    if (player.profilePicUrl) {
        try {
            if (player.profilePicUrl.startsWith('http')) {
                const response = await axios.get(player.profilePicUrl, { responseType: 'arraybuffer' });
                baseImg = await sharp(response.data)
                    .resize(width, height, { fit: 'cover' })
                    .toBuffer();
            } else if (fs.existsSync(player.profilePicUrl)) {
                baseImg = await sharp(player.profilePicUrl)
                    .resize(width, height, { fit: 'cover' })
                    .toBuffer();
            }
        } catch (e) {
            console.warn("Could not load background profile pic:", e.message);
        }
    }

    if (!baseImg) {
        if (fs.existsSync(templatePath)) {
            baseImg = await sharp(templatePath).resize(width, height).toBuffer();
        } else {
        const svg = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#050510" />
            </svg>
        `;
        baseImg = await sharp(Buffer.from(svg)).png().toBuffer();
        }
    }

    return await addOverlay(baseImg, player, width, height);
}

async function addOverlay(baseImg, player, width, height) {
    const { Item, Bank, Skill } = require('./database');
    const [bank] = await Bank.findOrCreate({ where: { PlayerWhatsappId: player.whatsappId } });
    const bankBalance = bank ? bank.balance : 0;

    const skills = await player.getSkills();
    const skillsList = skills.map(s => s.name).slice(0, 5);

    const inventory = player.inventory || [];
    const weaponKeywords = ['épée', 'lame', 'dague', 'bâton', 'arc', 'lance', 'hache', 'sword', 'blade', 'dagger', 'staff', 'bow', 'spear', 'axe', 'katana', 'rapier'];
    const weapons = inventory.filter(i => weaponKeywords.some(k => i.name.toLowerCase().includes(k))).slice(0, 3);
    const equipment = inventory.filter(i => !weaponKeywords.some(k => i.name.toLowerCase().includes(k))).slice(0, 3);

    const rankColor = player.rank === 'S' ? '#ffd700' : (player.rank === 'A' ? '#ff4fb3' : '#4fb3ff');

    // Fetch equipped outfit details for silhouette (legacy support)
    let outfitColor = "rgba(255,255,255,0.2)";
    let isTorn = false;
    if (player.equippedOutfit) {
        const outfit = await Item.findOne({ where: { name: player.equippedOutfit } });
        if (outfit) {
            outfitColor = outfit.visualData?.color || "#ffffff";
            isTorn = outfit.durability < 50;
        }
    }

    // Helper for multi-line description
    const wrapText = (text, maxChars) => {
        if (!text) return [""];
        const words = text.split(' ');
        const lines = [];
        let currentLine = "";
        words.forEach(w => {
            if ((currentLine + w).length > maxChars) {
                lines.push(currentLine.trim());
                currentLine = w + " ";
            } else {
                currentLine += w + " ";
            }
        });
        lines.push(currentLine.trim());
        return lines.slice(0, 6);
    };

    const bioLines = wrapText(player.characterDescription || "Le destin se forge à chaque pas dans l'Interstice.", 35);

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .text { fill: white; font-family: 'Segoe UI', Verdana, sans-serif; }
                .rank { font-size: 110px; font-weight: 900; fill: ${rankColor}; font-style: italic; filter: drop-shadow(0 0 10px ${rankColor}); }
                .rank-label { font-size: 24px; font-weight: bold; fill: ${rankColor}; letter-spacing: 5px; }
                .aka { font-size: 20px; fill: rgba(255,255,255,0.6); font-weight: 300; letter-spacing: 2px; }
                .name { font-size: 50px; font-weight: 900; fill: #ffffff; text-transform: uppercase; letter-spacing: -1px; }
                .bio { font-size: 17px; fill: rgba(255,255,255,0.85); line-height: 1.5; font-style: italic; }
                .label { font-size: 16px; font-weight: bold; fill: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 3px; }
                .stat-val { font-size: 19px; font-weight: bold; fill: #ffffff; filter: drop-shadow(0 0 5px rgba(255,255,255,0.3)); }
                .about-header { font-size: 32px; font-weight: 900; fill: #ffffff; letter-spacing: 2px; }
            </style>

            <defs>
                <!-- Dramatic dark gradient to separate UI from portrait -->
                <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0.9" />
                    <stop offset="40%" style="stop-color:rgb(0,0,0);stop-opacity:0.3" />
                    <stop offset="60%" style="stop-color:rgb(0,0,0);stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.8" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <!-- Dark glass background -->
            <rect width="100%" height="100%" fill="url(#mainGrad)" />

            <!-- Fake Navbar from reference image -->
            <g transform="translate(60, 50)">
                <text x="0" y="0" style="fill:white; font-size: 20px; font-weight:900;">나 혼자만<tspan x="0" dy="18">레벨업</tspan></text>
                <text x="180" y="10" style="fill:rgba(255,255,255,0.8); font-size: 16px; font-weight:bold;">Home   Characters   Help</text>
                <text x="600" y="10" style="fill:white; font-size: 16px; font-weight:bold;">Sign Up</text>
                <rect x="680" y="-10" width="100" height="30" fill="rgba(255,255,255,0.1)" rx="5" />
                <text x="690" y="10" style="fill:rgba(255,255,255,0.4); font-size: 12px;">Search Here...</text>
            </g>

            <!-- LEFT SIDE: Identity -->
            <g transform="translate(60, 240)">
                <text x="0" y="0" class="rank" filter="url(#glow)">${player.rank}</text>
                <text x="100" y="-15" class="rank-label">RANK</text>

                <text x="0" y="50" class="aka">${escapeXml(player.derivative || "Shadow Monarch")} A.K.A</text>
                <text x="0" y="105" class="name">${escapeXml(player.name)}</text>

                <g transform="translate(0, 160)">
                    ${bioLines.map((line, i) => `
                        <text x="0" y="${i * 26}" class="bio">${escapeXml(line)}</text>
                    `).join('')}
                </g>
            </g>

            <!-- RIGHT SIDE: Attributes -->
            <g transform="translate(480, 240)">
                <text x="0" y="0" class="about-header">● ABOUT</text>

                <g transform="translate(0, 70)">
                    <text x="0" y="0" class="label">AFFILIATION</text>
                    <text x="0" y="25" class="stat-val">${escapeXml(player.organization || player.schoolName || "SOLO PLAYER")}</text>

                    <text x="0" y="70" class="label">STATUS</text>
                    <text x="0" y="95" class="stat-val">LVL ${player.level} • HP ${player.health}/${player.maxHealth}</text>

                    <text x="0" y="140" class="label">RELATIONSHIPS</text>
                    <text x="0" y="165" class="stat-val">${escapeXml(player.family || "NONE")}</text>

                    <text x="0" y="210" class="label">SKILLS</text>
                    <text x="0" y="235" class="stat-val">${skillsList.length > 0 ? skillsList.join(' • ') : "AWAKENING..."}</text>

                    <text x="0" y="280" class="label">FINANCES</text>
                    <text x="0" y="305" class="stat-val">${player.col.toLocaleString()} COL • 🏦 ${bankBalance.toLocaleString()}</text>

                    <text x="0" y="350" class="label">WEAPONS &amp; EQS</text>
                    <g transform="translate(0, 375)">
                        ${weapons.map((w, i) => `<text y="${i * 25}" class="stat-val">⚔️ ${escapeXml(w.name)}</text>`).join('')}
                        ${equipment.map((e, i) => `<text y="${(weapons.length + i) * 25}" class="stat-val">🛡️ ${escapeXml(e.name)}</text>`).join('')}
                    </g>
                </g>
            </g>

            <!-- UI Decoration lines -->
            <line x1="60" y1="200" x2="300" y2="200" style="stroke:rgba(255,255,255,0.4);stroke-width:1" />
            <line x1="480" y1="200" x2="740" y2="200" style="stroke:rgba(255,255,255,0.4);stroke-width:1" />

            <!-- Bottom Section for 3D Model -->
            <rect x="60" y="760" width="340" height="260" fill="rgba(255,255,255,0.05)" rx="10" stroke="rgba(255,255,255,0.1)" />
            <text x="75" y="790" class="label" style="fill: #ffffff; font-size: 14px;">● LIVE_3D_MODEL_SCAN</text>
            <text x="385" y="790" class="label" text-anchor="end" style="fill: #00ffff; font-size: 10px; font-weight: normal;">SYNC_STATUS: 100%</text>
            <rect x="250" y="782" width="80" height="8" fill="rgba(0,255,255,0.1)" rx="2" />
            <rect x="250" y="782" width="80" height="8" fill="#00ffff" rx="2">
                <animate attributeName="width" from="0" to="80" dur="2s" fill="freeze" />
            </rect>

            <text x="50%" y="1060" text-anchor="middle" font-family="monospace" font-size="12" fill="rgba(255,255,255,0.3)">S-RANK_ENCRYPTED_ID: ${player.whatsappId.substring(0, 16)}</text>
        </svg>
    `;

    try {
        // Generate 3D Character Model
        const modelType = (player.gender || "").toLowerCase().includes('f') ? 'female' : 'male';
        const threeBuffer = await generate3DVisual(modelType, 0x00ffff, outfitColor);
        const threeResized = await sharp(threeBuffer).resize(300, 240, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

        const compositeOperations = [
            { input: Buffer.from(overlaySvg), top: 0, left: 0 },
            { input: threeResized, top: 780, left: 80 }
        ];

        // Legacy Silhouette support if background image is missing
        const silhouettePath = path.join(__dirname, 'assets/silhouette.jpg');
        if (!player.profilePicUrl && fs.existsSync(silhouettePath)) {
            const silhouetteResized = await sharp(silhouettePath).resize(500, 800).toBuffer();
            const clothingLayer = await sharp(silhouetteResized)
                .threshold(200).negate().tint(outfitColor).modulate({ opacity: 0.6 }).toBuffer();

            let mask = null;
            if (isTorn) {
                const maskSvg = `<svg width="500" height="800"><rect width="100%" height="100%" fill="white" /><circle cx="200" cy="200" r="40" fill="black" /><circle cx="150" cy="350" r="30" fill="black" /></svg>`;
                mask = Buffer.from(maskSvg);
            }
            const finalClothing = mask ? await sharp(clothingLayer).composite([{ input: mask, blend: 'dest-in' }]).toBuffer() : clothingLayer;
            const silhouetteBlack = await sharp(silhouetteResized).threshold(240).toBuffer();

            compositeOperations.unshift({ input: silhouetteBlack, top: 250, left: 150 });
            compositeOperations.unshift({ input: finalClothing, top: 250, left: 150, blend: 'over' });
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
