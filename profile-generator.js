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
    const { Conflict, WorldJournal, Quest } = require('./database');

    let plotName = "🌱 ÉVEIL DE L'HÉRITIER";
    let plotDesc = "Vous commencez à ressentir le flux d'Ether d'Aetherys. Votre destin s'éveille.";
    let modifiers = {};
    let visualEffect = "light"; // 'light', 'fire', 'dark', 'void', 'war'

    try {
        // Fetch active main quests for this player
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
    const width = 800;
    const height = 1100;
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

    const rankConfigs = {
        'S': { color: '#ffd700', font: "'Impact', 'Arial Black', sans-serif", style: "italic" },
        'A': { color: '#ff0055', font: "'Times New Roman', 'Georgia', serif", style: "normal" },
        'B': { color: '#bf00ff', font: "'Courier New', monospace", style: "normal" },
        'C': { color: '#00e5ff', font: "'Georgia', serif", style: "italic" },
        'D': { color: '#00e676', font: "'Trebuchet MS', sans-serif", style: "normal" },
        'E': { color: '#2979ff', font: "'Arial Black', sans-serif", style: "normal" },
        'F': { color: '#b0bec5', font: "'Arial', sans-serif", style: "normal" }
    };
    const rConf = rankConfigs[player.rank] || rankConfigs['F'];
    const rankColor = rConf.color;
    const rankFont = rConf.font;
    const rankStyle = rConf.style;

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
        return lines.slice(0, 6);
    };

    const bioLines = wrapText(player.characterDescription || "Le destin se forge à chaque pas dans l'Interstice.", 35);

    const plotImpact = await calculatePlotImpact(player);
    const plotLines = wrapText(plotImpact.plotDesc, 38);

    let plotVisualOverlaySvg = '';
    if (plotImpact.visualEffect === 'fire') {
        plotVisualOverlaySvg = `
            <rect width="100%" height="100%" fill="none" stroke="#ff3300" stroke-width="4" opacity="0.35" filter="url(#glow)" />
            <g transform="translate(100, 480)" filter="url(#glow)">
                <path d="M 0,0 L 25,40 L 50,0 Q 25,-10 0,0" fill="none" stroke="#ff0000" stroke-width="4.5" />
                <line x1="25" y1="10" x2="25" y2="45" stroke="#ff0000" stroke-width="4.5" />
                <circle cx="25" cy="5" r="4" fill="#ff0000" />
                <text x="-40" y="-15" font-family="monospace" font-size="10" font-weight="bold" fill="#ff3333" letter-spacing="1">CAUSALITY BRANDED</text>
            </g>
        `;
    } else if (plotImpact.visualEffect === 'dark') {
        plotVisualOverlaySvg = `
            <rect width="100%" height="100%" fill="none" stroke="#bf00ff" stroke-width="4" opacity="0.25" filter="url(#glow)" />
            <circle cx="200" cy="550" r="120" fill="none" stroke="#bf00ff" stroke-width="2" stroke-dasharray="10,15" opacity="0.4" />
        `;
    } else if (plotImpact.visualEffect === 'void') {
        plotVisualOverlaySvg = `
            <rect width="100%" height="100%" fill="none" stroke="#050515" stroke-width="8" opacity="0.8" />
            <rect width="100%" height="100%" fill="none" stroke="#00ffff" stroke-width="2" opacity="0.3" filter="url(#glow)" />
        `;
    } else if (plotImpact.visualEffect === 'war') {
        plotVisualOverlaySvg = `
            <rect width="100%" height="100%" fill="none" stroke="#ffcc00" stroke-width="3" opacity="0.3" />
            <line x1="15" y1="15" x2="60" y2="15" stroke="#ffcc00" stroke-width="4" />
            <line x1="15" y1="15" x2="15" y2="60" stroke="#ffcc00" stroke-width="4" />
        `;
    }

    let auraSvgDecoration = '';
    if (player.hasAura) {
        auraSvgDecoration = `
            <!-- Pulse glow aura effect representing Natsu/Dragon Slayer aura -->
            <rect width="100%" height="100%" fill="none" stroke="#00f3ff" stroke-width="6" opacity="0.65" filter="url(#glow)" />
            <ellipse cx="400" cy="550" rx="360" ry="500" fill="none" stroke="#aa00ff" stroke-width="2.5" stroke-dasharray="5,15" opacity="0.4" filter="url(#glow)" />
            <text x="740" y="160" font-family="'Arial Black', sans-serif" font-size="12" font-weight="900" fill="#00f3ff" text-anchor="end" style="letter-spacing:4px; filter: drop-shadow(0 0 5px #00f3ff)">AURA ENERGIE BOOST ACTIVE</text>
        `;
    }

    const overlaySvg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .text { fill: white; font-family: 'Segoe UI', Verdana, sans-serif; }
                .rank { font-size: 110px; font-weight: 900; fill: ${rankColor}; font-family: ${rankFont}; font-style: ${rankStyle}; filter: drop-shadow(0 0 15px ${rankColor}); }
                .rank-label { font-size: 24px; font-weight: bold; fill: ${rankColor}; letter-spacing: 5px; }
                .aka { font-size: 20px; fill: rgba(255,255,255,0.6); font-weight: 300; letter-spacing: 2px; }
                .name { font-size: 50px; font-weight: 900; fill: #ffffff; text-transform: uppercase; letter-spacing: -1px; }
                .bio { font-size: 17px; fill: rgba(255,255,255,0.85); line-height: 1.5; font-style: italic; }
                .label { font-size: 16px; font-weight: bold; fill: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 3px; }
                .stat-val { font-size: 19px; font-weight: bold; fill: #ffffff; filter: drop-shadow(0 0 5px rgba(255,255,255,0.3)); }
                .about-header { font-size: 32px; font-weight: 900; fill: #ffffff; letter-spacing: 2px; }
                .plot-title { font-size: 19px; font-weight: 900; fill: #ff4500; filter: drop-shadow(0 0 3px #ff4500); }
                .plot-desc { font-size: 14px; fill: rgba(255,255,255,0.8); font-style: italic; line-height: 1.4; }
                .plot-modifier { font-size: 13px; font-family: monospace; fill: #00ff66; font-weight: bold; }
            </style>

            <defs>
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

            <rect width="100%" height="100%" fill="url(#mainGrad)" />

            ${plotVisualOverlaySvg}

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

                    <text x="0" y="210" class="label">OUTFIT ASPECT</text>
                    <text x="0" y="235" class="stat-val" style="fill:#ffd700">${escapeXml(player.equippedOutfit || "Aucun vêtement")} (${player.outfitDurability}% • ${player.outfitCleanliness.toUpperCase()})</text>

                    <text x="0" y="280" class="label">SKILLS</text>
                    <text x="0" y="305" class="stat-val">${skillsList.length > 0 ? skillsList.join(' • ') : "AWAKENING..."}</text>

                    ${player.masterId || player.fusedWithId ? `
                        <text x="0" y="350" class="label" style="fill:#00ffff">${player.masterId ? 'SERVITUDE BOND' : 'FUSION SYNC'}</text>
                        <text x="0" y="375" class="stat-val" style="fill:#00ffff">${player.masterId ? 'ACTIVE' : (Math.round(player.fusionSyncLevel * 100) + '%')}</text>
                    ` : ''}

                    <text x="0" y="${player.masterId || player.fusedWithId ? 420 : 350}" class="label">FINANCES</text>
                    <text x="0" y="375" class="stat-val">${player.col.toLocaleString()} COL • 🏦 ${bankBalance.toLocaleString()}</text>

                    <text x="0" y="420" class="label">WEAPONS &amp; EQS</text>
                    <g transform="translate(0, 445)">
                        ${weapons.map((w, i) => `<text y="${i * 25}" class="stat-val">⚔️ ${escapeXml(w.name)}</text>`).join('')}
                        ${equipment.map((e, i) => `<text y="${(weapons.length + i) * 25}" class="stat-val">🛡️ ${escapeXml(e.name)}</text>`).join('')}
                    </g>
                </g>
            </g>

            <!-- EXTRA BOTTOM ROW: DYNAMIC IMPACT OF THE MAIN PLOT -->
            <g transform="translate(480, 760)">
                <rect x="-10" y="-10" width="280" height="260" fill="rgba(255,69,0,0.04)" stroke="rgba(255,69,0,0.15)" stroke-width="1.5" rx="10" />
                <text x="10" y="20" class="label" style="fill:#ff8c00;">● TRAME PRINCIPALE</text>

                <g transform="translate(10, 50)">
                    <text x="0" y="0" class="plot-title">${escapeXml(plotImpact.plotName)}</text>

                    <g transform="translate(0, 20)">
                        ${plotLines.slice(0, 3).map((line, i) => `
                            <text x="0" y="${i * 18}" class="plot-desc">${escapeXml(line)}</text>
                        `).join('')}
                    </g>

                    <g transform="translate(0, 100)">
                        <text x="0" y="0" class="label" style="font-size:10px; fill:rgba(255,255,255,0.4)">MODIFICATEURS DE STATS :</text>
                        ${Object.keys(plotImpact.modifiers).length > 0 ?
                            Object.entries(plotImpact.modifiers).map(([stat, val], i) => `
                                <text x="${(i%2)*120}" y="${18 + Math.floor(i/2)*20}" class="plot-modifier">
                                    ${stat.toUpperCase()} : ${val >= 0 ? '+' : ''}${val}
                                </text>
                            `).join('') :
                            `<text x="0" y="18" class="plot-desc" style="fill:rgba(255,255,255,0.4)">Aucune perturbation active.</text>`
                        }
                    </g>
                </g>
            </g>

            <line x1="60" y1="200" x2="300" y2="200" style="stroke:rgba(255,255,255,0.4);stroke-width:1" />
            <line x1="480" y1="200" x2="740" y2="200" style="stroke:rgba(255,255,255,0.4);stroke-width:1" />

            <!-- Bottom Section for 3D Model -->
            <rect x="60" y="760" width="370" height="260" fill="rgba(255,255,255,0.05)" rx="10" stroke="rgba(255,255,255,0.1)" />
            <text x="75" y="790" class="label" style="fill: #ffffff; font-size: 14px;">● LIVE_3D_MODEL_SCAN</text>
            <text x="415" y="790" class="label" text-anchor="end" style="fill: #00ffff; font-size: 10px; font-weight: normal;">SYNC_STATUS: 100%</text>
            <rect x="250" y="782" width="80" height="8" fill="rgba(0,255,255,0.1)" rx="2" />
            <rect x="250" y="782" width="80" height="8" fill="#00ffff" rx="2">
                <animate attributeName="width" from="0" to="80" dur="2s" fill="freeze" />
            </rect>

            <text x="50%" y="1060" text-anchor="middle" font-family="monospace" font-size="12" fill="rgba(255,255,255,0.3)">S-RANK_ENCRYPTED_ID: ${player.whatsappId.substring(0, 16)}</text>
        </svg>
    `;

    try {
        const modelType = (player.gender || "").toLowerCase().includes('f') ? 'female' : 'male';
        const threeBuffer = await generate3DVisual(modelType, 0x00ffff, outfitColor);
        const threeResized = await sharp(threeBuffer).resize(330, 240, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

        const compositeOperations = [
            { input: Buffer.from(overlaySvg), top: 0, left: 0 },
            { input: threeResized, top: 780, left: 80 }
        ];

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

module.exports = { generateProfileCard, calculatePlotImpact };
