const THREE = require('three');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Programmatically generate 3D-styled scenes using Three.js and Sharp.
 * Returns a Buffer.
 */
async function generate3DVisual(type = 'cube', color = 0x00ff00, outfitColor = "#ffffff") {
    const width = 600;
    const height = 800;

    const { window } = new JSDOM();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 1, 0);

    const group = new THREE.Group();
    scene.add(group);

    if (type === 'male' || type === 'female' || type === 'humanoid') {
        const isFemale = type === 'female';

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8));
        head.position.y = 1.8;
        group.add(head);

        // Torso
        const torsoWidth = isFemale ? 0.35 : 0.45;
        const waistWidth = isFemale ? 0.25 : 0.4;
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoWidth, waistWidth, 0.6, 6));
        torso.position.y = 1.4;
        group.add(torso);

        // Pelvis
        const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(waistWidth, torsoWidth, 0.2, 6));
        pelvis.position.y = 1.1;
        group.add(pelvis);

        // Arms
        const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.7, 4));
        lArm.position.set(-0.35, 1.4, 0);
        lArm.rotation.z = 0.2;
        group.add(lArm);

        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.7, 4));
        rArm.position.set(0.35, 1.4, 0);
        rArm.rotation.z = -0.2;
        group.add(rArm);

        // Legs
        const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.9, 4));
        lLeg.position.set(-0.15, 0.6, 0);
        group.add(lLeg);

        const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.9, 4));
        rLeg.position.set(0.15, 0.6, 0);
        group.add(rLeg);

    } else {
        let geometry;
        if (type === 'sphere') geometry = new THREE.SphereGeometry(1.5, 16, 16);
        else if (type === 'pyramid') geometry = new THREE.ConeGeometry(1.5, 2, 4);
        else geometry = new THREE.BoxGeometry(2, 2, 2);

        const mesh = new THREE.Mesh(geometry);
        group.add(mesh);
    }

    // Slightly rotate the group for a 3/4 view
    group.rotation.y = Math.PI / 8;

    let svgContent = '';

    group.children.forEach(mesh => {
        const geometry = mesh.geometry;
        const pos = geometry.attributes.position;
        const index = geometry.index;

        const worldPos = new THREE.Vector3();
        const vertices = [];

        for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
            v.applyMatrix4(mesh.matrixWorld);
            v.project(camera);

            const x = (v.x * 0.5 + 0.5) * width;
            const y = (v.y * -0.5 + 0.5) * height;
            vertices.push({ x, y, z: v.z });
        }

        const stroke = mesh.position.y < 1.7 && mesh.position.y > 0.5 ? outfitColor : ('#' + color.toString(16).padStart(6, '0'));

        if (index) {
            for (let i = 0; i < index.count; i += 3) {
                const v1 = vertices[index.getX(i)];
                const v2 = vertices[index.getY(i)];
                const v3 = vertices[index.getZ(i)];
                // Simple depth sort (ignore if behind camera)
                if (v1.z < 1 && v2.z < 1 && v3.z < 1) {
                    svgContent += `<polygon points="${v1.x},${v1.y} ${v2.x},${v2.y} ${v3.x},${v3.y}" fill="rgba(0,0,0,0.3)" stroke="${stroke}" stroke-width="1" />`;
                }
            }
        } else {
             for (let i = 0; i < vertices.length; i += 3) {
                const v1 = vertices[i];
                const v2 = vertices[i+1] || vertices[0];
                const v3 = vertices[i+2] || vertices[0];
                if (v1.z < 1) {
                    svgContent += `<polygon points="${v1.x},${v1.y} ${v2.x},${v2.y} ${v3.x},${v3.y}" fill="rgba(0,0,0,0.3)" stroke="${stroke}" stroke-width="1" />`;
                }
            }
        }
    });

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="glow3d">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>
        <rect width="100%" height="100%" fill="transparent" />
        <g filter="url(#glow3d)" opacity="0.9">
            ${svgContent}
        </g>

        <!-- Grid Floor -->
        <g opacity="0.2">
            ${[0, 1, 2, 3, 4, 5].map(i => `<line x1="0" y1="${height - i*20}" x2="${width}" y2="${height - i*20}" stroke="cyan" />`).join('')}
            ${[0, 1, 2, 3, 4, 5].map(i => `<line x1="${i*120}" y1="${height}" x2="${i*120}" y2="${height-100}" stroke="cyan" />`).join('')}
        </g>

        <text x="50%" y="95%" font-family="monospace" font-size="14" fill="#00ffff" text-anchor="middle" letter-spacing="3">● SKETCHFAB_ENGINE_SYNC: ${type.toUpperCase()}</text>
    </svg>
    `;

    return await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}

module.exports = { generate3DVisual };
