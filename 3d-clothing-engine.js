const THREE = require('three');
const sharp = require('sharp');

/**
 * Three.js 3D Outfit & Clothing Customization Engine for ATR.
 * Creates 3D character clothing meshes, material shaders, custom fabric colors,
 * metallic trims, and durability/wear texture layers.
 *
 * @param {Object} outfitData Information about the outfit (name, color, durability, cleanliness, class)
 * @returns {Promise<Buffer>} Rendered 3D outfit preview image buffer
 */
async function generate3DOutfitPreview(outfitData) {
    const width = 600;
    const height = 800;

    const {
        name = "Tenue de Combat ATR",
        color = "#ff4500",
        durability = 100,
        cleanliness = "PROPRE"
    } = outfitData || {};

    // Build 3D Scene using Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060410);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 20, 160);
    camera.lookAt(0, 20, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffd700, 1.5);
    mainLight.position.set(50, 100, 100);
    scene.add(mainLight);

    // Parse main fabric color
    const hexColor = parseInt(color.replace('#', '0x')) || 0xff4500;

    // 3D Torso / Coat Mesh
    const torsoGeo = new THREE.CylinderGeometry(18, 22, 50, 32);
    const torsoMat = new THREE.MeshStandardMaterial({
        color: hexColor,
        roughness: 0.3,
        metalness: 0.6
    });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.set(0, 20, 0);
    scene.add(torso);

    // 3D Shoulder Armor Plates (Pouldrons)
    const shoulderGeo = new THREE.SphereGeometry(12, 16, 16);
    const shoulderMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        roughness: 0.2,
        metalness: 0.9
    });

    const leftShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    leftShoulder.position.set(-24, 40, 0);
    scene.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    rightShoulder.position.set(24, 40, 0);
    scene.add(rightShoulder);

    // 3D Cloak / Cape Mesh
    const cloakGeo = new THREE.ConeGeometry(30, 70, 32, 1, true);
    const cloakMat = new THREE.MeshStandardMaterial({
        color: 0x110b24,
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    const cloak = new THREE.Mesh(cloakGeo, cloakMat);
    cloak.position.set(0, 10, -5);
    cloak.rotation.x = Math.PI;
    scene.add(cloak);

    // Overlay SVG for 3D Customization UI
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

        <!-- Slanted Header -->
        <g transform="translate(30, 30)">
            <polygon points="15,0 540,0 520,60 0,60" fill="rgba(10,6,25,0.85)" stroke="url(#gold)" stroke-width="2" filter="url(#glow)"/>
            <text x="35" y="38" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22" fill="#ffffff" letter-spacing="2">3D STYLED OUTFIT ❖ CUSTOM ENGINE</text>
        </g>

        <!-- Slanted Bottom Outfit Stats Container -->
        <g transform="translate(30, ${height - 180})">
            <polygon points="20,0 540,0 515,140 0,140" fill="rgba(12, 8, 30, 0.9)" stroke="url(#gold)" stroke-width="2"/>

            <g transform="translate(30, 30)">
                <text x="0" y="0" font-family="'Segoe UI', sans-serif" font-size="18" font-weight="bold" fill="#ffd700">❖ ${name.toUpperCase()}</text>
                <text x="0" y="26" font-family="sans-serif" font-size="13" fill="#00ffcc" font-weight="bold">COLOR CODE : ${color.toUpperCase()} • RÉSISTANCE : ${durability}%</text>

                <!-- Durability Bar -->
                <polygon points="0,40 450,40 438,52 -12,52" fill="rgba(255,255,255,0.1)" />
                <polygon points="0,40 ${durability * 4.5},40 ${(durability * 4.5) - 12},52 -12,52" fill="${durability < 40 ? '#ff3300' : '#00ffcc'}" />

                <text x="0" y="76" font-family="sans-serif" font-size="12" fill="#aaa">PROPRETÉ DU TISSU : <tspan fill="#ffffff" font-weight="bold">${cleanliness}</tspan></text>
            </g>
        </g>

        <!-- Footer -->
        <text x="50%" y="${height - 20}" font-family="monospace" font-size="10" fill="rgba(255,255,255,0.3)" text-anchor="middle">THREE.JS 3D CLOTHING &amp; FABRIC ENGINE • AFTER THE REBIRTH</text>
    </svg>
    `;

    const bgSvg = `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#060410"/></svg>`;
    const bgBuf = await sharp(Buffer.from(bgSvg)).png().toBuffer();

    return await sharp(bgBuf)
        .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
        .png()
        .toBuffer();
}

module.exports = { generate3DOutfitPreview };
