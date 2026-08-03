const sharp = require('sharp');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { escapeXml } = require('./utils');
const { generate3DVisual } = require('./three-renderer');

/**
 * Evaluates active Conflicts and WorldJournal plot events to calculate dynamic story-driven stat modifiers and conditions.
 * @param {Object} player - The player record
 * @returns {Promise<Object>} An object containing plot effects, name, and stat modifications.
 */
async function calculatePlotImpact(player) {
    const { Conflict, WorldJournal } = require('./database');

    let plotName = "🌱 ÉVEIL DE L'HÉRITIER";
    let plotDesc = "Vous commencez à ressentir le flux d'Ether d'Aetherys. Votre destin s'éveille.";
    let modifiers = {};
    let visualEffect = "light"; // 'light', 'fire', 'dark', 'void', 'war'

    try {
        if (player && typeof player.getQuests === 'function') {
            const activeQuests = await player.getQuests({
                where: { type: 'main' },
                through: { where: { status: 'in_progress' } }
            });

            if (activeQuests && activeQuests.length > 0) {
                const mainQ = activeQuests[0];
                plotName = `📖 ${mainQ.title.toUpperCase()}`;
                plotDesc = `Trame principale en cours : ${mainQ.description}`;
                modifiers = { strength: 4, defense: 4, luck: 2 };
                visualEffect = "light";
            }
        }

        const activeConflicts = await Conflict.findAll({ where: { status: 'active' } });
        const localConflict = activeConflicts.find(c => {
            const kingdoms = Array.isArray(c.involvedKingdoms) ? c.involvedKingdoms : [];
            return kingdoms.some(k => k.toLowerCase() === player.location.toLowerCase());
        });

        if (localConflict) {
            plotName = "⚔️ MOBILISATION DE GUERRE";
            plotDesc = `Conflit actif : ${localConflict.title}. La pression militaire est extrême dans votre région.`;
            modifiers = { strength: 8, defense: 5, agility: -4 };
            visualEffect = "war";
            return { plotName, plotDesc, modifiers, visualEffect };
        }

        const latestPlot = await WorldJournal.findOne({
            where: { category: 'plot' },
            order: [['id', 'DESC']]
        });

        if (latestPlot) {
            const entryText = latestPlot.entry.toLowerCase();
            const playerNameLower = player.name.toLowerCase();
            const isPlayerConcerned = entryText.includes(playerNameLower) || entryText.includes('griffith');

            if (isPlayerConcerned && (entryText.includes('eclipse') || entryText.includes('apôtre'))) {
                plotName = "💀 MARQUE DE LA CAUSALITÉ";
                plotDesc = "Tu es marqué par l'Éclipse de l'Interstice. Ton âme appartient désormais aux Anges de la Causalité.";
                modifiers = { strength: 18, luck: -12, defense: -6 };
                visualEffect = "fire";
            } else if (isPlayerConcerned && (entryText.includes('convergence') || entryText.includes('vide') || entryText.includes('failles'))) {
                plotName = "🌀 INFLUENCE DE LA CONVERGENCE";
                plotDesc = "Les failles de l'Interstice perturbent ton esprit. Ton mana est extrêmement instable.";
                modifiers = { intelligence: 15, defense: -5, luck: 5 };
                visualEffect = "dark";
            } else if (isPlayerConcerned && (entryText.includes('néant') || entryText.includes('void'))) {
                plotName = "🖤 OMBRE DU NÉANT";
                plotDesc = "La corruption du Roi Vide rampe sur ton âme. Agilité décuplée mais résistance vitale érodée.";
                modifiers = { agility: 14, strength: -4, intelligence: 6 };
                visualEffect = "void";
            }
        }
    } catch (err) {
        console.warn("[Plot Impact] Failed to query plot impacts:", err.message);
    }

    return { plotName, plotDesc, modifiers, visualEffect };
}

async function generateProfileCard(player) {
    const width = 1150;
    const height = 750;
    const templatePath = path.join(__dirname, 'assets/templates/profile_template.jpg');

    let baseImg;

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
        // Fallback to gorgeous custom procedural horizontal background
        const svg = `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="obsidianBack" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#07050e;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#010103;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#obsidianBack)" />
            </svg>
        `;
        baseImg = await sharp(Buffer.from(svg)).png().toBuffer();
    }

    return await addOverlay(baseImg, player, width, height);
}

async function addOverlay(baseImg, player, width, height) {
    const { Item, Bank } = require('./database');
    const [bank] = await Bank.findOrCreate({ where: { PlayerWhatsappId: player.whatsappId } });
    const bankBalance = bank ? bank.balance : 0;

    const skills = await player.getSkills();
    const skillsList = skills.map(s => s.name).slice(0, 5);

    const inventory = player.inventory || [];
    const weaponKeywords = ['épée', 'lame', 'dague', 'bâton', 'arc', 'lance', 'hache', 'sword', 'blade', 'dagger', 'staff', 'bow', 'spear', 'axe', 'katana', 'rapier'];
    const weapons = inventory.filter(i => weaponKeywords.some(k => i.name.toLowerCase().includes(k))).slice(0, 3);
    const equipment = inventory.filter(i => !weaponKeywords.some(k => i.name.toLowerCase().includes(k))).slice(0, 3);

    const rankColor = player.rank === 'S' ? '#ffd700' : (player.rank === 'A' ? '#ff4fb3' : '#4fb3ff');

    let outfitColor = "rgba(255,255,255,0.2)";
    let isTorn = player.outfitDurability < 50;
    if (player.equippedOutfit) {
        const outfit = await Item.findOne({ where: { name: player.equippedOutfit } });
        if (outfit) {
            outfitColor = outfit.visualData?.color || "#ffffff";
        }
    }

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
        return lines;
    };

    const bioLines = wrapText(player.characterDescription || "Le destin se forge à chaque pas dans l'Interstice.", 35);

    const plotImpact = await calculatePlotImpact(player);
    const plotLines = wrapText(plotImpact.plotDesc, 110);

    let plotVisualOverlaySvg = '';
    if (plotImpact.visualEffect === 'fire') {
        plotVisualOverlaySvg = `
            <rect width="100%" height="100%" fill="none" stroke="#ff3300" stroke-width="4" opacity="0.35" filter="url(#glow)" />
        `;
    } else if (plotImpact.visualEffect === 'dark') {
        plotVisualOverlaySvg = `
            <rect width="100%" height="100%" fill="none" stroke="#bf00ff" stroke-width="4" opacity="0.25" filter="url(#glow)" />
        `;
    } else if (plotImpact.visualEffect === 'void') {
        plotVisualOverlaySvg = `
            <rect width="100%" height="100%" fill="none" stroke="#00ffff" stroke-width="2" opacity="0.3" filter="url(#glow)" />
        `;
    }

    let auraSvgDecoration = '';
    if (player.hasAura) {
        auraSvgDecoration = `
            <rect width="100%" height="100%" fill="none" stroke="#00f3ff" stroke-width="5" opacity="0.5" filter="url(#glow)" />
            <text x="${width - 60}" y="45" font-family="'Segoe UI', sans-serif" font-size="11" font-weight="900" fill="#00f3ff" text-anchor="end" style="letter-spacing:2px; filter: drop-shadow(0 0 5px #00f3ff)">AURA ENERGIE ACTIVED</text>
        `;
    }

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .text { fill: white; font-family: 'Segoe UI', Verdana, sans-serif; }
                .rank { font-size: 72px; font-weight: 900; fill: ${rankColor}; font-style: italic; filter: drop-shadow(0 0 10px ${rankColor}); }
                .rank-label { font-size: 16px; font-weight: bold; fill: ${rankColor}; letter-spacing: 4px; }
                .aka { font-size: 13px; fill: rgba(255,255,255,0.4); font-weight: 300; letter-spacing: 1.5px; }
                .name { font-size: 32px; font-weight: 900; fill: #ffffff; text-transform: uppercase; letter-spacing: 1px; }
                .bio { font-size: 12px; fill: rgba(255,255,255,0.7); line-height: 1.4; font-style: italic; }
                .label { font-size: 12px; font-weight: bold; fill: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 2px; }
                .stat-val { font-size: 14px; font-weight: bold; fill: #ffffff; }
                .about-header { font-size: 14px; font-weight: 900; fill: ${rankColor}; letter-spacing: 2px; }
                .plot-title { font-size: 14px; font-weight: 900; fill: #ff4500; filter: drop-shadow(0 0 3px #ff4500); }
                .plot-desc { font-size: 11.5px; fill: rgba(255,255,255,0.7); font-style: italic; }
                .plot-modifier { font-size: 11px; font-family: monospace; fill: #00ff66; font-weight: bold; }
            </style>

            <defs>
                <linearGradient id="mainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#120e24;stop-opacity:0.2" />
                    <stop offset="100%" style="stop-color:#080612;stop-opacity:0.9" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#mainGrad)" />

            <!-- Cyber grid lines backdrop -->
            <g stroke="rgba(255, 255, 255, 0.01)" stroke-width="1">
                ${Array.from({ length: 15 }).map((_, i) => `<line x1="0" y1="${i * 50}" x2="${width}" y2="${i * 50}" />`).join('')}
                ${Array.from({ length: 23 }).map((_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="${height}" />`).join('')}
            </g>

            ${plotVisualOverlaySvg}
            ${auraSvgDecoration}

            <!-- Top Header Navbar -->
            <g transform="translate(60, 55)">
                <rect x="-10" y="-12" width="4" height="28" fill="${rankColor}" />
                <text x="10" y="8" font-family="'Segoe UI', sans-serif" font-size="20" font-weight="900" fill="#ffffff" letter-spacing="3">FICHE D'IDENTITÉ HÉRITIER</text>
                <text x="350" y="6" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.3)" letter-spacing="2">INTERFACE SECURE IV • GHENO CITY</text>
            </g>

            <!-- CADRANT 1 (Top-Left): Identity -->
            <g transform="translate(60, 120)">
                <!-- Glass frame -->
                <rect width="330" height="260" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.06)" rx="8" />
                <rect x="5" y="5" width="320" height="250" fill="none" stroke="${rankColor}" stroke-width="1.2" opacity="0.1" rx="6" />

                <g transform="translate(20, 30)">
                    <text x="0" y="32" class="rank" filter="url(#glow)">${player.rank}</text>
                    <text x="85" y="-5" class="rank-label">RANG</text>

                    <text x="0" y="70" class="aka">${escapeXml(player.derivative || "Shadow Monarch").toUpperCase()} • A.K.A</text>
                    <text x="0" y="105" class="name">${escapeXml(player.name)}</text>

                    <g transform="translate(0, 140)">
                        ${bioLines.slice(0, 4).map((line, i) => `
                            <text x="0" y="${i * 20}" class="bio">${escapeXml(line)}</text>
                        `).join('')}
                    </g>
                </g>
            </g>

            <!-- CADRANT 2 (Top-Right): Stats & Finances -->
            <g transform="translate(420, 120)">
                <rect width="320" height="260" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.06)" rx="8" />
                <rect x="5" y="5" width="310" height="250" fill="none" stroke="${rankColor}" stroke-width="1.2" opacity="0.1" rx="6" />

                <g transform="translate(20, 30)">
                    <text x="0" y="12" class="about-header">● VITALITÉ &amp; STATUT</text>

                    <text x="0" y="42" class="label">NIVEAU ACTUEL</text>
                    <text x="0" y="62" class="stat-val">LVL ${player.level} (XP : ${player.xp})</text>

                    <text x="0" y="98" class="label">AFFILIATION / FACTION</text>
                    <text x="0" y="118" class="stat-val">${escapeXml(player.organization || player.schoolName || "SOLO PLAYER")}</text>

                    <text x="0" y="154" class="label">FAMILLE / LIGNÉE</text>
                    <text x="0" y="174" class="stat-val">${escapeXml(player.family || "SANS LIGNÉE")}</text>

                    <text x="0" y="210" class="label">LIVRET DE COMPTE</text>
                    <text x="0" y="230" class="stat-val" style="fill:#ffd700;">🪙 ${player.col.toLocaleString()} COL | 🏦 ${bankBalance.toLocaleString()} COL</text>
                </g>
            </g>

            <!-- CADRANT 3 (Middle-Left): Skills -->
            <g transform="translate(60, 410)">
                <rect width="330" height="210" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.06)" rx="8" />
                <rect x="5" y="5" width="320" height="200" fill="none" stroke="${rankColor}" stroke-width="1.2" opacity="0.1" rx="6" />

                <g transform="translate(20, 30)">
                    <text x="0" y="12" class="about-header">● TECHNIQUES MAÎTRISÉES</text>

                    <g transform="translate(0, 40)">
                        ${skillsList.length > 0 ? skillsList.map((s, i) => `
                            <rect x="0" y="${i * 32}" width="12" height="12" fill="${rankColor}" opacity="0.5" rx="2" />
                            <text x="24" y="${i * 32 + 11}" class="stat-val">${escapeXml(s.toUpperCase())}</text>
                        `).join('') : `
                            <text x="0" y="20" class="bio">Éveillez votre potentiel magique...</text>
                        `}
                    </g>
                </g>
            </g>

            <!-- CADRANT 4 (Middle-Right): Equipment & Weapons -->
            <g transform="translate(420, 410)">
                <rect width="320" height="210" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.06)" rx="8" />
                <rect x="5" y="5" width="310" height="200" fill="none" stroke="${rankColor}" stroke-width="1.2" opacity="0.1" rx="6" />

                <g transform="translate(20, 30)">
                    <text x="0" y="12" class="about-header">● ÉQUIPEMENTS ÉQUIPÉS</text>

                    <text x="0" y="42" class="label">TENUE &amp; RÉSISTANCE</text>
                    <text x="0" y="62" class="stat-val" style="fill:#00ffcc;">${escapeXml(player.equippedOutfit || "Aucun vêtement")} (${player.outfitDurability}% • ${player.outfitCleanliness.toUpperCase()})</text>

                    <text x="0" y="98" class="label">ARMES ET ACCESSOIRES</text>
                    <g transform="translate(0, 120)">
                        ${weapons.slice(0, 2).map((w, i) => `<text x="0" y="${i * 22}" class="stat-val">⚔️ ${escapeXml(w.name)}</text>`).join('')}
                        ${equipment.slice(0, 1).map((e, i) => `<text x="0" y="${(weapons.length > 2 ? 2 : weapons.length) * 22}" class="stat-val">🛡️ ${escapeXml(e.name)}</text>`).join('')}
                        ${weapons.length === 0 && equipment.length === 0 ? '<text y="15" class="bio">Aucune arme équipée.</text>' : ''}
                    </g>
                </g>
            </g>

            <!-- CADRANT 5 (Far-Right): Live 3D Model Scan -->
            <g transform="translate(770, 120)">
                <rect width="320" height="500" fill="rgba(255,255,255,0.015)" stroke="rgba(255,255,255,0.06)" rx="8" />
                <rect x="5" y="5" width="310" height="490" fill="none" stroke="${rankColor}" stroke-width="1.2" opacity="0.15" rx="6" />

                <!-- 3D frame header -->
                <text x="20" y="32" class="label" style="fill: #ffffff; font-size: 13px;">● SCAN MODEL PHYSIQUE</text>
                <text x="300" y="32" class="label" text-anchor="end" style="fill: #00ffff; font-size: 10px; font-weight: normal;">SYNC_ACTIVE</text>
                <line x1="20" y1="42" x2="300" y2="42" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
            </g>

            <!-- CADRANT 6 (Bottom-Row): Main Plot / Plot Impacts -->
            <g transform="translate(60, 640)">
                <rect width="1030" height="75" fill="rgba(255,69,0,0.02)" stroke="rgba(255,69,0,0.12)" rx="8" />

                <g transform="translate(20, 20)">
                    <text x="0" y="12" class="plot-title" style="font-size:15px;">● TRAME : ${escapeXml(plotImpact.plotName)}</text>
                    <text x="0" y="32" class="plot-desc">${escapeXml(plotLines[0] || "Aucune perturbation majeure active sur votre âme.")}</text>

                    <!-- Stats modification row -->
                    <g transform="translate(650, 12)">
                        <text x="0" y="0" class="label" style="font-size:9.5px; fill:rgba(255,255,255,0.4)">MODIFICATEURS :</text>
                        <g transform="translate(100, -8)">
                            ${Object.keys(plotImpact.modifiers).length > 0 ?
                                Object.entries(plotImpact.modifiers).map(([stat, val], i) => `
                                    <text x="${i * 70}" y="10" class="plot-modifier" style="font-size:11.5px;">
                                        ${stat.substring(0,3).toUpperCase()}:${val >= 0 ? '+' : ''}${val}
                                    </text>
                                `).join('') :
                                `<text x="0" y="10" class="plot-desc" style="fill:rgba(255,255,255,0.4); font-size:11px;">Aucun</text>`
                            }
                        </g>
                    </g>
                </g>
            </g>

            <text x="50%" y="740" text-anchor="middle" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.2)">S-RANK_ENCRYPTED_ID: ${player.whatsappId.substring(0, 16)}</text>
        </svg>
    `;

    try {
        const modelType = (player.gender || "").toLowerCase().includes('f') ? 'female' : 'male';
        const threeBuffer = await generate3DVisual(modelType, 0x00ffff, outfitColor);
        const threeResized = await sharp(threeBuffer).resize(280, 420, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

        const compositeOperations = [
            { input: Buffer.from(overlaySvg), top: 0, left: 0 },
            { input: threeResized, top: 170, left: 790 }
        ];

        const silhouettePath = path.join(__dirname, 'assets/silhouette.jpg');
        if (!player.profilePicUrl && fs.existsSync(silhouettePath)) {
            const silhouetteResized = await sharp(silhouettePath).resize(240, 360).toBuffer();
            const clothingLayer = await sharp(silhouetteResized)
                .threshold(200).negate().tint(outfitColor).modulate({ opacity: 0.6 }).toBuffer();

            let mask = null;
            if (isTorn) {
                const maskSvg = `<svg width="240" height="360"><rect width="100%" height="100%" fill="white" /><circle cx="100" cy="100" r="20" fill="black" /><circle cx="80" cy="180" r="15" fill="black" /></svg>`;
                mask = Buffer.from(maskSvg);
            }
            const finalClothing = mask ? await sharp(clothingLayer).composite([{ input: mask, blend: 'dest-in' }]).toBuffer() : clothingLayer;
            const silhouetteBlack = await sharp(silhouetteResized).threshold(240).toBuffer();

            // Place silouhette nicely in the 3D frame
            compositeOperations.unshift({ input: silhouetteBlack, top: 200, left: 810 });
            compositeOperations.unshift({ input: finalClothing, top: 200, left: 810, blend: 'over' });
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

module.exports = { generateProfileCard, calculatePlotImpact };
