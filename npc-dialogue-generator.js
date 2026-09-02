const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Generates an RPG visual card showing an NPC with a rectangular dialogue box overlay at the bottom.
 *
 * @param {string} npcName Name of the NPC (e.g., "Empereur Valerius II")
 * @param {string} dialogueText What the NPC is saying
 * @param {string} [imageUrl] Optional image URL or asset path for the NPC portrait
 * @returns {Promise<Buffer>} Image buffer containing the NPC visual card with the dialogue box
 */
async function generateNpcDialogueCard(npcName, dialogueText, imageUrl) {
    const width = 1000;
    const height = 650;

    // 1. Fetch or prepare NPC portrait background buffer
    let bgBuffer = null;

    if (imageUrl && imageUrl.startsWith('http')) {
        try {
            const resp = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
            bgBuffer = await sharp(Buffer.from(resp.data)).resize(width, height, { fit: 'cover' }).toBuffer();
        } catch (e) {
            console.warn("[NPC Dialogue] Failed to fetch NPC image URL, generating fallback visual:", e.message);
        }
    } else if (imageUrl && fs.existsSync(imageUrl)) {
        try {
            bgBuffer = await sharp(imageUrl).resize(width, height, { fit: 'cover' }).toBuffer();
        } catch (e) {}
    }

    if (!bgBuffer) {
        // Fallback: Generate an AI portrait for the NPC
        try {
            const { generateHuggingFaceImage } = require('./message-handler');
            const aiImg = await generateHuggingFaceImage(`Anime portrait of ${npcName}, official anime art, studio ufotable MAPPA style, high fantasy key visual`);
            if (aiImg) {
                bgBuffer = await sharp(aiImg).resize(width, height, { fit: 'cover' }).toBuffer();
            }
        } catch (e) {}
    }

    if (!bgBuffer) {
        // Fallback gradient background if image generation is unavailable
        const fallbackSvg = `<svg width="${width}" height="${height}">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0d1117" />
                    <stop offset="50%" stop-color="#161b22" />
                    <stop offset="100%" stop-color="#090d16" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#bg)"/>
        </svg>`;
        bgBuffer = await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
    }

    // Wrap dialogue text into lines
    const maxLineLen = 65;
    const words = dialogueText.split(' ');
    let lines = [];
    let currentLine = '';

    for (const w of words) {
        if ((currentLine + ' ' + w).length <= maxLineLen) {
            currentLine += (currentLine ? ' ' : '') + w;
        } else {
            lines.push(currentLine);
            currentLine = w;
        }
    }
    if (currentLine) lines.push(currentLine);

    // Limit dialogue lines display to 4 max
    if (lines.length > 4) {
        lines = lines.slice(0, 3);
        lines.push('...');
    }

    const dialogueTspans = lines.map((line, idx) =>
        `<tspan x="70" y="${515 + (idx * 26)}" fill="#f0f6fc" font-size="20" font-family="'Segoe UI', Roboto, sans-serif" font-weight="500">${escapeXml(line)}</tspan>`
    ).join('\n');

    // CreateJS / SVG rectangular RPG dialogue box overlay
    const overlaySvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <!-- Vignette shadow gradient -->
            <linearGradient id="topVignette" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#000" stop-opacity="0.6"/>
                <stop offset="100%" stop-color="#000" stop-opacity="0.0"/>
            </linearGradient>

            <!-- Dialogue box glassmorphism gradient -->
            <linearGradient id="boxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#0d1117" stop-opacity="0.92"/>
                <stop offset="100%" stop-color="#040d1a" stop-opacity="0.96"/>
            </linearGradient>

            <!-- Gold accent trim gradient -->
            <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#d4af37"/>
                <stop offset="50%" stop-color="#fff8dc"/>
                <stop offset="100%" stop-color="#d4af37"/>
            </linearGradient>
        </defs>

        <!-- Top Header Darkening -->
        <rect x="0" y="0" width="${width}" height="100" fill="url(#topVignette)"/>

        <!-- ATR World Stamp -->
        <text x="40" y="45" font-family="'Segoe UI', sans-serif" font-weight="bold" font-size="18" fill="#d4af37" letter-spacing="2">
            AFTER THE REBIRTH (ATR) • DIALOGUE ENGINE
        </text>

        <!-- Bottom RPG Oblique Diamond / Rhomboid Dialogue Box Container -->
        <!-- Outer Gold Border -->
        <polygon points="60,430 960,430 940,610 40,610" fill="none" stroke="url(#goldBorder)" stroke-width="3"/>

        <!-- Main Dark Glass Dialogue Box Body -->
        <polygon points="62,432 958,432 938,608 42,608" fill="url(#boxGrad)"/>

        <!-- NPC Slanted Name Plate Banner -->
        <polygon points="75,400 360,400 340,442 55,442" fill="#161b22" stroke="#d4af37" stroke-width="2"/>
        <text x="85" y="428" font-family="'Segoe UI', Roboto, sans-serif" font-weight="bold" font-size="20" fill="#ffd700" letter-spacing="1">
            🗣️ ${escapeXml(npcName.toUpperCase())} ❖
        </text>

        <!-- Dialogue Text Lines -->
        <g id="dialogue-text">
            ${dialogueTspans}
        </g>

        <!-- Blinking Prompt Indicator -->
        <polygon points="920,580 935,580 927,592" fill="#ffd700"/>
    </svg>`;

    const overlayBuffer = Buffer.from(overlaySvg);

    // Composite overlay onto background
    const finalBuffer = await sharp(bgBuffer)
        .composite([{ input: overlayBuffer, top: 0, left: 0 }])
        .jpeg({ quality: 92 })
        .toBuffer();

    return finalBuffer;
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

module.exports = { generateNpcDialogueCard };
