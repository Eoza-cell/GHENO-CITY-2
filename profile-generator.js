const sharp = require('sharp');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('fr-FR');
}

function getRatio(current, max) {
    if (!max || max <= 0) return 0;
    return Math.max(0, Math.min(1, current / max));
}

function wrapTextLines(value, maxChars = 34, maxLines = 3) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const lines = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxChars) {
            current = candidate;
            continue;
        }

        if (current) lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) break;
    }

    if (lines.length < maxLines && current) lines.push(current);

    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
        lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, maxChars - 1))}…`;
    }

    return lines;
}

async function generateProfileCard(player) {
    const templatePath = path.join(__dirname, 'assets/templates/profile_template.jpg');

    // Check if template exists
    if (!fs.existsSync(templatePath)) {
        console.warn("Profile template not found, using blank background.");
        // Create a premium dark background if template missing.
        const width = 800;
        const height = 1100;
        const svg = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#081024" />
                        <stop offset="55%" stop-color="#101c43" />
                        <stop offset="100%" stop-color="#050811" />
                    </linearGradient>
                    <radialGradient id="glowCyan" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="rgba(88,230,255,0.35)" />
                        <stop offset="100%" stop-color="rgba(88,230,255,0)" />
                    </radialGradient>
                    <radialGradient id="glowGold" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="rgba(255,215,122,0.26)" />
                        <stop offset="100%" stop-color="rgba(255,215,122,0)" />
                    </radialGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#bg)" />
                <circle cx="180" cy="160" r="190" fill="url(#glowCyan)" />
                <circle cx="640" cy="920" r="220" fill="url(#glowGold)" />
                <rect x="22" y="22" width="${width - 44}" height="${height - 44}" fill="rgba(255,255,255,0.02)" stroke="rgba(255,226,138,0.75)" stroke-width="2" rx="28" />
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
    const designWidth = 800;
    const designHeight = 1100;
    const scaleX = width / designWidth;
    const scaleY = height / designHeight;

    const safeName = escapeXml(player.name || 'Sans Nom');
    const safeClass = escapeXml(player.class || 'Inconnu');
    const safeDerivative = escapeXml(player.derivative || 'Aucune specialisation');
    const safeOccupation = escapeXml(player.occupation || 'Citoyen');
    const safeOrganization = escapeXml(player.organization || 'Aucune');
    const safeFamily = escapeXml(player.family || 'Sans famille');
    const safeSchool = escapeXml(player.schoolName || 'Aventurier libre');
    const safeLocation = escapeXml(player.location || 'Zone inconnue');
    const safeWhatsappId = escapeXml((player.whatsappId || 'N/A').slice(0, 12));
    const descriptionLines = wrapTextLines(player.characterDescription || 'Aucune description connue.', 32, 3);
    const initials = escapeXml((player.name || '??').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '??');

    const stats = [
        { name: 'Force', value: player.strength || 0, color: '#ff8b8b' },
        { name: 'Agilite', value: player.agility || 0, color: '#7ad7ff' },
        { name: 'Intelligence', value: player.intelligence || 0, color: '#8f8bff' },
        { name: 'Defense', value: player.defense || 0, color: '#ffd36f' },
        { name: 'Chance', value: player.luck || 0, color: '#7cf0c3' }
    ];

    const inventory = player.inventory || [];
    const weaponKeywords = ['épée', 'lame', 'dague', 'bâton', 'arc', 'lance', 'hache', 'sword', 'blade', 'dagger', 'staff', 'bow', 'spear', 'axe', 'katana', 'rapier'];
    const weapons = inventory.filter(i => weaponKeywords.some(k => i.name.toLowerCase().includes(k))).slice(0, 4);
    const equipment = inventory.filter(i => !weaponKeywords.some(k => i.name.toLowerCase().includes(k))).slice(0, 4);
    const hpRatio = getRatio(player.health || 0, player.maxHealth || 0);
    const manaRatio = getRatio(player.mana || 0, player.maxMana || 0);
    const xpRatio = getRatio(player.xp || 0, (player.level || 1) * 100);

    const statRows = stats.map((stat, index) => {
        const y = 356 + (index * 56);
        const widthRatio = Math.max(0.05, Math.min(1, stat.value / 100));
        const fillWidth = 250 * widthRatio;
        return `
            <text x="436" y="${y}" class="label">${escapeXml(stat.name)}</text>
            <text x="708" y="${y}" class="valueStrong" text-anchor="end">${formatNumber(stat.value)}</text>
            <rect x="436" y="${y + 14}" width="272" height="14" rx="7" fill="rgba(255,255,255,0.08)" />
            <rect x="436" y="${y + 14}" width="${fillWidth}" height="14" rx="7" fill="${stat.color}" />
        `;
    }).join('');

    const resourceBars = [
        { label: 'HP', y: 770, ratio: hpRatio, fill: '#ff6b6b', value: `${player.health || 0}/${player.maxHealth || 0}` },
        { label: 'MANA', y: 822, ratio: manaRatio, fill: '#67c7ff', value: `${player.mana || 0}/${player.maxMana || 0}` },
        { label: 'XP', y: 874, ratio: xpRatio, fill: '#ffd36f', value: `${player.xp || 0}/${(player.level || 1) * 100}` }
    ].map((bar) => `
        <text x="84" y="${bar.y}" class="label">${bar.label}</text>
        <text x="356" y="${bar.y}" class="valueStrong" text-anchor="end">${escapeXml(bar.value)}</text>
        <rect x="84" y="${bar.y + 16}" width="272" height="15" rx="7.5" fill="rgba(255,255,255,0.08)" />
        <rect x="84" y="${bar.y + 16}" width="${Math.max(6, 272 * bar.ratio)}" height="15" rx="7.5" fill="${bar.fill}" />
    `).join('');

    const descriptionSvg = descriptionLines.map((line, index) => `
        <text x="84" y="${592 + index * 28}" class="body">${escapeXml(line)}</text>
    `).join('');

    const weaponListSvg = weapons.length > 0
        ? weapons.map((item, index) => `
            <g transform="translate(0, ${index * 34})">
                <rect width="290" height="26" rx="13" fill="rgba(255,255,255,0.04)" />
                <text x="14" y="18" class="item">${escapeXml(item.name.slice(0, 23))}</text>
                <text x="274" y="18" class="itemQty" text-anchor="end">x${item.quantity}</text>
            </g>
        `).join('')
        : '<text x="0" y="24" class="body">Aucune arme equipee.</text>';

    const equipmentListSvg = equipment.length > 0
        ? equipment.map((item, index) => `
            <g transform="translate(0, ${index * 34})">
                <rect width="290" height="26" rx="13" fill="rgba(255,255,255,0.04)" />
                <text x="14" y="18" class="item">${escapeXml(item.name.slice(0, 23))}</text>
                <text x="274" y="18" class="itemQty" text-anchor="end">x${item.quantity}</text>
            </g>
        `).join('')
        : '<text x="0" y="24" class="body">Aucun equipement stocke.</text>';

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${designWidth} ${designHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="panelBg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="rgba(8,16,36,0.90)" />
                    <stop offset="100%" stop-color="rgba(4,8,20,0.84)" />
                </linearGradient>
                <linearGradient id="headerBg" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(103,199,255,0.22)" />
                    <stop offset="100%" stop-color="rgba(255,211,111,0.12)" />
                </linearGradient>
            </defs>
            <style>
                .text { fill: white; font-family: Arial, sans-serif; }
                .muted { fill: rgba(255,255,255,0.68); font-size: 18px; font-family: Arial, sans-serif; }
                .label { fill: rgba(255,255,255,0.78); font-size: 17px; font-family: Arial, sans-serif; letter-spacing: 1px; }
                .title { fill: #ffffff; font-size: 46px; font-family: Arial Black, Arial, sans-serif; }
                .subtitle { fill: #ffd36f; font-size: 24px; font-family: Arial, sans-serif; font-weight: bold; }
                .section { fill: #7ad7ff; font-size: 21px; font-family: Arial, sans-serif; font-weight: bold; letter-spacing: 2px; }
                .valueStrong { fill: #ffffff; font-size: 24px; font-family: Arial, sans-serif; font-weight: bold; }
                .money { fill: #ffd36f; font-size: 34px; font-family: Arial Black, Arial, sans-serif; }
                .body { fill: rgba(255,255,255,0.72); font-size: 17px; font-family: Arial, sans-serif; }
                .item { fill: #ffffff; font-size: 16px; font-family: Arial, sans-serif; }
                .itemQty { fill: #7ad7ff; font-size: 15px; font-family: Arial, sans-serif; font-weight: bold; }
            </style>

            <rect x="28" y="28" width="${designWidth - 56}" height="${designHeight - 56}" rx="30" fill="url(#panelBg)" stroke="rgba(255,255,255,0.08)" stroke-width="2" />
            <rect x="44" y="44" width="${designWidth - 88}" height="154" rx="24" fill="url(#headerBg)" stroke="rgba(122,215,255,0.18)" stroke-width="1.5" />
            <circle cx="140" cy="122" r="82" fill="rgba(255,255,255,0.05)" stroke="rgba(122,215,255,0.18)" stroke-width="2" />
            <text x="140" y="136" text-anchor="middle" class="title" style="font-size:42px;">${initials}</text>

            <text x="250" y="110" class="subtitle">RANG ${escapeXml(player.rank || 'E')} • NIVEAU ${player.level || 1}</text>
            <text x="250" y="154" class="title">${safeName}</text>
            <text x="250" y="186" class="muted">${safeClass} • ${safeDerivative}</text>

            <rect x="52" y="230" width="320" height="438" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(122,215,255,0.16)" />
            <rect x="404" y="230" width="344" height="438" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(255,211,111,0.16)" />
            <rect x="52" y="688" width="696" height="356" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(122,215,255,0.14)" />

            <text x="84" y="272" class="section">PROFIL</text>
            <text x="440" y="272" class="section">STATISTIQUES</text>
            <text x="84" y="728" class="section">RESSOURCES ET EQUIPEMENT</text>

            <text x="84" y="316" class="label">Academie</text>
            <text x="84" y="344" class="valueStrong">${safeSchool}</text>
            <text x="84" y="388" class="label">Occupation</text>
            <text x="84" y="416" class="valueStrong">${safeOccupation}</text>
            <text x="84" y="460" class="label">Organisation</text>
            <text x="84" y="488" class="valueStrong">${safeOrganization}</text>
            <text x="84" y="532" class="label">Description</text>
            ${descriptionSvg}
            <text x="84" y="652" class="muted">${safeFamily} • ${safeLocation}</text>

            ${statRows}

            <rect x="436" y="316" width="272" height="86" rx="18" fill="rgba(255,255,255,0.04)" />
            <text x="464" y="350" class="label">COL</text>
            <text x="464" y="384" class="money">${formatNumber(player.col || 0)}</text>

            ${resourceBars}

            <rect x="428" y="754" width="300" height="74" rx="18" fill="rgba(255,255,255,0.05)" />
            <rect x="428" y="842" width="300" height="74" rx="18" fill="rgba(255,255,255,0.05)" />
            <text x="456" y="785" class="label">Influence</text>
            <text x="456" y="814" class="valueStrong">${formatNumber(player.influence || 0)}</text>
            <text x="456" y="873" class="label">Points de competence</text>
            <text x="456" y="902" class="valueStrong">${formatNumber(player.skillPoints || 0)}</text>

            <g transform="translate(64, 928)">
                <text x="16" y="36" class="section" style="font-size:18px; fill:#ff9a9a;">ARMES</text>
                <g transform="translate(16, 54)">${weaponListSvg}</g>
            </g>
            <g transform="translate(424, 928)">
                <text x="16" y="36" class="section" style="font-size:18px; fill:#7ad7ff;">EQUIPEMENT</text>
                <g transform="translate(16, 54)">${equipmentListSvg}</g>
            </g>

            <text x="50%" y="1072" text-anchor="middle" font-family="monospace" font-size="14" fill="rgba(255,255,255,0.36)">ID ${safeWhatsappId}... // CARTE JOUEUR SECURISEE</text>
        </svg>
    `;

    try {
        let profileImg;
        if (player.profilePicUrl) {
            try {
                if (player.profilePicUrl.startsWith('http')) {
                    const response = await axios.get(player.profilePicUrl, { responseType: 'arraybuffer' });
                    const avatarSize = Math.round(170 * Math.min(scaleX, scaleY));
                    profileImg = await sharp(response.data)
                        .resize(avatarSize, avatarSize, { fit: 'cover' })
                        .composite([{
                            input: Buffer.from(`<svg width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="#fff"/></svg>`),
                            blend: 'dest-in'
                        }])
                        .png()
                        .toBuffer();
                } else if (fs.existsSync(player.profilePicUrl)) {
                    const avatarSize = Math.round(170 * Math.min(scaleX, scaleY));
                    profileImg = await sharp(player.profilePicUrl)
                        .resize(avatarSize, avatarSize, { fit: 'cover' })
                        .composite([{
                            input: Buffer.from(`<svg width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="#fff"/></svg>`),
                            blend: 'dest-in'
                        }])
                        .png()
                        .toBuffer();
                }
            } catch (e) {
                console.warn("Could not load profile pic:", e.message);
            }
        }

        const compositeOperations = [
            { input: Buffer.from(overlaySvg), top: 0, left: 0 }
        ];

        if (profileImg) {
            const borderWidth = Math.round(190 * scaleX);
            const borderHeight = Math.round(190 * scaleY);
            compositeOperations.push({
                input: profileImg,
                top: Math.round(56 * scaleY),
                left: Math.round(58 * scaleX)
            });
            compositeOperations.push({
                input: Buffer.from(`
                    <svg width="${borderWidth}" height="${borderHeight}" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="${borderWidth / 2}" cy="${borderHeight / 2}" r="${Math.max(1, (borderWidth / 2) - 7)}" fill="none" stroke="rgba(122,215,255,0.9)" stroke-width="4"/>
                        <circle cx="${borderWidth / 2}" cy="${borderHeight / 2}" r="${Math.max(1, (borderWidth / 2) - 2)}" fill="none" stroke="rgba(255,211,111,0.42)" stroke-width="2"/>
                    </svg>
                `),
                top: Math.round(47 * scaleY),
                left: Math.round(49 * scaleX)
            });
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
