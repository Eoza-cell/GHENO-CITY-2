const THREE = require('three');
const { JSDOM } = require('jsdom');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Programmatically generate 3D-styled scenes using Three.js and Sharp.
 * Returns a Buffer.
 */
async function generate3DVisual(type = 'cube', color = 0x00ff00) {
    const width = 512;
    const height = 512;

    // Create a virtual DOM for Three.js
    const { window } = new JSDOM();
    const { document } = window;

    // Setup scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    let geometry;
    if (type === 'sphere') {
        geometry = new THREE.SphereGeometry(2, 32, 32);
    } else if (type === 'pyramid') {
        geometry = new THREE.ConeGeometry(2, 3, 4);
    } else {
        geometry = new THREE.BoxGeometry(2, 2, 2);
    }

    const vertices = [];
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        // Rotate a bit for "action" feel
        v.applyAxisAngle(new THREE.Vector3(1, 1, 0), Math.PI / 4);

        // Project
        v.project(camera);

        // Map to screen
        const x = (v.x * 0.5 + 0.5) * width;
        const y = (v.y * -0.5 + 0.5) * height;
        vertices.push({ x, y });
    }

    // Draw lines for the wireframe
    let svgLines = '';
    const index = geometry.index;
    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            const v1 = vertices[index.getX(i)];
            const v2 = vertices[index.getY(i)];
            const v3 = vertices[index.getZ(i)];
            svgLines += `<polygon points="${v1.x},${v1.y} ${v2.x},${v2.y} ${v3.x},${v3.y}" fill="none" stroke="${'#' + color.toString(16).padStart(6, '0')}" stroke-width="2" />`;
        }
    } else {
        // Fallback for non-indexed
        for (let i = 0; i < vertices.length; i += 3) {
            const v1 = vertices[i];
            const v2 = vertices[i+1] || vertices[0];
            const v3 = vertices[i+2] || vertices[0];
            svgLines += `<polygon points="${v1.x},${v1.y} ${v2.x},${v2.y} ${v3.x},${v3.y}" fill="none" stroke="${'#' + color.toString(16).padStart(6, '0')}" stroke-width="2" />`;
        }
    }

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/1999/xhtml">
        <rect width="100%" height="100%" fill="#0a0a0a" />
        <g opacity="0.8">
            ${svgLines}
        </g>
        <text x="50%" y="90%" font-family="monospace" font-size="20" fill="#ffffff" text-anchor="middle">3D SCAN: ${type.toUpperCase()}</text>
    </svg>
    `;

    return await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}

module.exports = { generate3DVisual };
