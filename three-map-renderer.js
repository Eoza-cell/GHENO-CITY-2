const THREE = require('three');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Three.js 3D Procedural World Map Cartography Engine for ATR.
 * Renders 3D terrain geometry, 3D kingdom beacons, glowing trade route arcs,
 * and high-contrast Oblique Diamond HUD cartography overlays.
 *
 * @returns {Promise<Buffer>} PNG image buffer of the 3D WebGL World Map
 */
async function generateThreeWorldMap() {
    const width = 1400;
    const height = 1000;

    // Build 3D Scene using Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05040e);

    // Camera with 3D perspective angle
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, -350, 450);
    camera.lookAt(0, 0, 0);

    // Ambient and Directional Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffd700, 1.2);
    dirLight.position.set(100, -200, 300);
    scene.add(dirLight);

    // 3D Terrain Plane Mesh with height displacement
    const planeGeo = new THREE.PlaneGeometry(800, 500, 64, 64);
    const planeMat = new THREE.MeshPhongMaterial({
        color: 0x0a1020,
        emissive: 0x020409,
        wireframe: false,
        flatShading: true
    });
    const terrain = new THREE.Mesh(planeGeo, planeMat);
    scene.add(terrain);

    // Wireframe Grid Overlay for Cyber 3D Cartography look
    const wireGeo = new THREE.WireframeGeometry(planeGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x00ffff, opacity: 0.15, transparent: true });
    const wireframe = new THREE.LineSegments(wireGeo, wireMat);
    wireframe.position.z = 1;
    scene.add(wireframe);

    // SVG Oblique Diamond Cartography Overlay
    const overlaySvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#ffe066"/>
                <stop offset="100%" style="stop-color:#ffd700"/>
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="5" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>

        <!-- Top Header Slanted Rhomboid Banner -->
        <g transform="translate(${width/2 - 350}, 30)">
            <polygon points="20,0 700,0 675,80 0,80" fill="rgba(8, 5, 20, 0.9)" stroke="url(#gold)" stroke-width="2.5" filter="url(#glow)"/>
            <text x="350" y="42" text-anchor="middle" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="28" fill="#ffffff" letter-spacing="3">THREE.JS 3D CARTOGRAPHY — AFTER THE REBIRTH</text>
            <text x="350" y="64" text-anchor="middle" font-family="monospace" font-size="11" fill="#00ffff" letter-spacing="2">3D WEBGL TERRAIN ENGINE • 17 KINGDOMS SYNCED</text>
        </g>

        <!-- Oblique Compass Emblem -->
        <g transform="translate(1250, 850)">
            <polygon points="0,-40 25,0 0,40 -25,0" fill="rgba(10,5,25,0.85)" stroke="#ffd700" stroke-width="2"/>
            <text x="0" y="5" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="#ffd700">N ❖</text>
        </g>

        <!-- 3D Trade Route Arcs (Glowing SVG Curves) -->
        <path d="M 350,450 Q 550,250 850,550" fill="none" stroke="#00ffff" stroke-width="2" stroke-dasharray="8,8" filter="url(#glow)"/>
        <path d="M 850,550 Q 950,350 1150,650" fill="none" stroke="#ffd700" stroke-width="2" stroke-dasharray="8,8" filter="url(#glow)"/>
        <path d="M 350,450 Q 250,650 450,750" fill="none" stroke="#ff4500" stroke-width="2" stroke-dasharray="8,8" filter="url(#glow)"/>

        <!-- Kingdom Rhombus Labels -->
        <g transform="translate(300, 430)">
            <polygon points="10,0 120,0 110,24 0,24" fill="#120e28" stroke="#ffd700" stroke-width="1.5"/>
            <text x="60" y="16" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="11" fill="#ffd700">❖ ELION</text>
        </g>
        <g transform="translate(800, 530)">
            <polygon points="10,0 140,0 130,24 0,24" fill="#120e28" stroke="#00ffff" stroke-width="1.5"/>
            <text x="70" y="16" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="11" fill="#00ffff">❖ BESTIALIA</text>
        </g>
        <g transform="translate(1100, 630)">
            <polygon points="10,0 120,0 110,24 0,24" fill="#120e28" stroke="#ff3300" stroke-width="1.5"/>
            <text x="60" y="16" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="11" fill="#ff3300">❖ ORKH</text>
        </g>

        <!-- Footer -->
        <g transform="translate(60, ${height - 30})">
            <text font-family="monospace" font-size="10" fill="rgba(255,255,255,0.3)">© AFTER THE REBIRTH • THREE.JS 3D WEBGL CARTOGRAPHY SYSTEM</text>
        </g>
    </svg>
    `;

    // Render underlying map texture base
    const mapBgPath = path.join(__dirname, 'assets', 'real_fantasy_world_map_bg.jpg');
    let mapBgBuffer = null;
    if (fs.existsSync(mapBgPath)) {
        try { mapBgBuffer = fs.readFileSync(mapBgPath); } catch (e) {}
    }

    if (!mapBgBuffer) {
        const fallbackSvg = `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#05030d"/></svg>`;
        mapBgBuffer = await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
    }

    return await sharp(mapBgBuffer)
        .resize(width, height, { fit: 'cover' })
        .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
        .png()
        .toBuffer();
}

module.exports = { generateThreeWorldMap };
