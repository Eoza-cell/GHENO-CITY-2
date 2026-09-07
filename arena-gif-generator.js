const omggif = require('omggif');

// Extended 8x8 Pixel Bitmap Font
const font8x8 = {
  'A': [0x18,0x3c,0x66,0x66,0x7e,0x66,0x66,0x00],
  'B': [0x7c,0x66,0x66,0x7c,0x66,0x66,0x7c,0x00],
  'C': [0x3c,0x66,0x60,0x60,0x60,0x66,0x3c,0x00],
  'D': [0x78,0x6c,0x66,0x66,0x66,0x6c,0x78,0x00],
  'E': [0x7e,0x60,0x60,0x7c,0x60,0x60,0x7e,0x00],
  'F': [0x7e,0x60,0x60,0x7c,0x60,0x60,0x60,0x00],
  'G': [0x3c,0x66,0x60,0x6e,0x66,0x66,0x3c,0x00],
  'H': [0x66,0x66,0x66,0x7e,0x66,0x66,0x66,0x00],
  'I': [0x3c,0x18,0x18,0x18,0x18,0x18,0x3c,0x00],
  'J': [0x1e,0x0c,0x0c,0x0c,0x0c,0xcc,0x78,0x00],
  'K': [0x66,0x6c,0x78,0x70,0x78,0x6c,0x66,0x00],
  'L': [0x60,0x60,0x60,0x60,0x60,0x60,0x7e,0x00],
  'M': [0x63,0x77,0x7f,0x6b,0x63,0x63,0x63,0x00],
  'N': [0x66,0x76,0x7e,0x7e,0x6e,0x66,0x66,0x00],
  'O': [0x3c,0x66,0x66,0x66,0x66,0x66,0x3c,0x00],
  'P': [0x7c,0x66,0x66,0x7c,0x60,0x60,0x60,0x00],
  'Q': [0x3c,0x66,0x66,0x66,0x6e,0x3c,0x0e,0x00],
  'R': [0x7c,0x66,0x66,0x7c,0x6c,0x66,0x66,0x00],
  'S': [0x3c,0x66,0x60,0x3c,0x06,0x66,0x3c,0x00],
  'T': [0x7e,0x18,0x18,0x18,0x18,0x18,0x18,0x00],
  'U': [0x66,0x66,0x66,0x66,0x66,0x66,0x3c,0x00],
  'V': [0x66,0x66,0x66,0x66,0x66,0x3c,0x18,0x00],
  'W': [0x63,0x63,0x63,0x6b,0x7f,0x77,0x63,0x00],
  'X': [0x66,0x66,0x3c,0x18,0x3c,0x66,0x66,0x00],
  'Y': [0x66,0x66,0x66,0x3c,0x18,0x18,0x18,0x00],
  'Z': [0x7e,0x06,0x0c,0x18,0x30,0x60,0x7e,0x00],
  '0': [0x3c,0x66,0x6e,0x76,0x66,0x66,0x3c,0x00],
  '1': [0x18,0x38,0x18,0x18,0x18,0x18,0x7e,0x00],
  '2': [0x3c,0x66,0x06,0x0c,0x18,0x30,0x7e,0x00],
  '3': [0x3c,0x66,0x06,0x1c,0x06,0x66,0x3c,0x00],
  '4': [0x0c,0x1c,0x3c,0x6c,0x7e,0x0c,0x0c,0x00],
  '5': [0x7e,0x60,0x7c,0x06,0x06,0x66,0x3c,0x00],
  '6': [0x3c,0x60,0x7c,0x66,0x66,0x66,0x3c,0x00],
  '7': [0x7e,0x06,0x0c,0x18,0x30,0x30,0x30,0x00],
  '8': [0x3c,0x66,0x66,0x3c,0x66,0x66,0x3c,0x00],
  '9': [0x3c,0x66,0x66,0x3e,0x06,0x0c,0x38,0x00],
  ' ': [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
  "'": [0x18,0x18,0x30,0x00,0x00,0x00,0x00,0x00],
  ':': [0x00,0x18,0x18,0x00,0x18,0x18,0x00,0x00],
  '-': [0x00,0x00,0x00,0xfe,0x00,0x00,0x00,0x00],
  '_': [0x00,0x00,0x00,0x00,0x00,0x00,0xfe,0x00],
  '>': [0x60,0x30,0x18,0x0c,0x18,0x30,0x60,0x00],
  '<': [0x06,0x0c,0x18,0x30,0x18,0x0c,0x06,0x00],
  '[': [0x3c,0x30,0x30,0x30,0x30,0x30,0x3c,0x00],
  ']': [0x3c,0x0c,0x0c,0x0c,0x0c,0x0c,0x3c,0x00],
  '!': [0x18,0x18,0x18,0x18,0x18,0x00,0x18,0x00],
  '%': [0x62,0x66,0x0c,0x18,0x30,0x66,0x46,0x00],
  '.': [0x00,0x00,0x00,0x00,0x00,0x18,0x18,0x00],
  '/': [0x02,0x06,0x0c,0x18,0x30,0x60,0x40,0x00],
  '♦': [0x18,0x3c,0x7e,0xff,0x7e,0x3c,0x18,0x00]
};

// 16-color RGB Palette
const PALETTE = [
  0x0b0c10, // 0: Background dark slate
  0x1f2833, // 1: Panel dark blue-gray
  0x00e5ff, // 2: Neon Cyan
  0xffaa00, // 3: Gold
  0xff2a5f, // 4: Neon Crimson
  0x9d4edd, // 5: Neon Purple
  0xffffff, // 6: White
  0x007799, // 7: Dim Cyan
  0x444455, // 8: Dim Gray
  0x80f3ff, // 9: Bright Cyan
  0xffdd66, // 10: Bright Gold
  0x00ff88, // 11: Neon Emerald
  0x10121a, // 12: Grid line gray
  0x3a0050, // 13: Deep purple background
  0x003344, // 14: Deep cyan panel
  0x666677  // 15: Mid gray text
];

class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height);
    this.clear(0);
  }

  clear(colorIdx = 0) {
    this.pixels.fill(colorIdx);
  }

  setPixel(x, y, colorIdx) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.pixels[y * this.width + x] = colorIdx;
    }
  }

  drawLine(x0, y0, x1, y1, colorIdx) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.setPixel(x0, y0, colorIdx);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  drawRect(x, y, w, h, colorIdx) {
    this.drawLine(x, y, x + w - 1, y, colorIdx);
    this.drawLine(x + w - 1, y, x + w - 1, y + h - 1, colorIdx);
    this.drawLine(x, y + h - 1, x + w - 1, y + h - 1, colorIdx);
    this.drawLine(x, y, x, y + h - 1, colorIdx);
  }

  fillRect(x, y, w, h, colorIdx) {
    x = Math.max(0, Math.round(x));
    y = Math.max(0, Math.round(y));
    const maxX = Math.min(this.width, x + Math.round(w));
    const maxY = Math.min(this.height, y + Math.round(h));
    for (let py = y; py < maxY; py++) {
      for (let px = x; px < maxX; px++) {
        this.pixels[py * this.width + px] = colorIdx;
      }
    }
  }

  drawRhombus(centerX, centerY, radiusX, radiusY, colorIdx, fill = false) {
    const x0 = centerX;
    const y0 = centerY - radiusY;
    const x1 = centerX + radiusX;
    const y1 = centerY;
    const x2 = centerX;
    const y2 = centerY + radiusY;
    const x3 = centerX - radiusX;
    const y3 = centerY;

    if (fill) {
      for (let y = -radiusY; y <= radiusY; y++) {
        const factor = 1 - Math.abs(y) / radiusY;
        const widthAtY = Math.round(radiusX * factor);
        this.drawLine(centerX - widthAtY, centerY + y, centerX + widthAtY, centerY + y, colorIdx);
      }
    } else {
      this.drawLine(x0, y0, x1, y1, colorIdx);
      this.drawLine(x1, y1, x2, y2, colorIdx);
      this.drawLine(x2, y2, x3, y3, colorIdx);
      this.drawLine(x3, y3, x0, y0, colorIdx);
    }
  }

  drawText(text, startX, startY, colorIdx, scale = 1) {
    const uppercaseText = text.toUpperCase();
    let currentX = startX;

    for (let i = 0; i < uppercaseText.length; i++) {
      const char = uppercaseText[i];
      const glyph = font8x8[char] || font8x8[' '];

      for (let row = 0; row < 8; row++) {
        const line = glyph[row];
        for (let col = 0; col < 8; col++) {
          if ((line & (0x80 >> col)) !== 0) {
            if (scale === 1) {
              this.setPixel(currentX + col, startY + row, colorIdx);
            } else {
              this.fillRect(currentX + col * scale, startY + row * scale, scale, scale, colorIdx);
            }
          }
        }
      }
      currentX += 8 * scale + scale;
    }
  }

  getTextWidth(text, scale = 1) {
    return text.length * (8 * scale + scale);
  }
}

/**
 * Generates a horizontal GIF buffer for arena selection/shift
 * @param {string} arenaName Short or full arena name (e.g., 'SYLVAR ARENA')
 * @param {number} changeGauge Progress percentage (0 to 100)
 * @returns {Buffer} Animated GIF buffer
 */
function generateArenaGif(arenaName = "SYLVAR ARENA", changeGauge = 0) {
  const width = 480;
  const height = 130;
  const numFrames = 8;
  const frameDelayMs = 15; // smooth animation ~150ms per loop

  const canvas = new PixelCanvas(width, height);
  const outBuf = Buffer.alloc(width * height * numFrames * 2 + 64000);
  const gifWriter = new omggif.GifWriter(outBuf, width, height, { loop: 0 });

  const cleanArenaName = arenaName.replace(/[^\w\s\-_]/gi, '').trim().toUpperCase() || "ARENA";

  for (let frame = 0; frame < numFrames; frame++) {
    // 1. Clear background
    canvas.clear(0);

    // 2. Animated grid lines in background
    const offset = (frame * 3) % 20;
    for (let x = offset; x < width; x += 20) {
      canvas.drawLine(x, 0, x, height, 12);
    }
    for (let y = offset; y < height; y += 20) {
      canvas.drawLine(0, y, width, y, 12);
    }

    // 3. Slanted oblique rhombus HUD panel border
    const borderColor = frame % 2 === 0 ? 2 : 9; // Pulsing cyan
    const goldColor = frame % 2 === 0 ? 3 : 10; // Pulsing gold

    // Outer slanted border
    canvas.drawLine(15, 10, width - 25, 10, borderColor);
    canvas.drawLine(width - 25, 10, width - 10, height - 10, borderColor);
    canvas.drawLine(width - 10, height - 10, 30, height - 10, borderColor);
    canvas.drawLine(30, height - 10, 15, 10, borderColor);

    // Inner panel background shadow
    canvas.fillRect(35, 18, width - 65, height - 36, 1);

    // 4. Header title: "CHOIX DE L'ARENE"
    const title = "♦ CHOIX DE L'ARENE ♦";
    const titleWidth = canvas.getTextWidth(title, 1);
    const titleX = Math.round((width - titleWidth) / 2);
    canvas.drawText(title, titleX, 22, goldColor, 1);

    // Dynamic underline line with animated pulse center
    canvas.drawLine(60, 34, width - 60, 34, 7);
    const pulseX = 60 + ((frame * 40) % (width - 120));
    canvas.drawLine(pulseX, 34, pulseX + 30, 34, 2);

    // 5. Active Arena Name Display (Large font)
    const nameStr = cleanArenaName;
    const nameWidth = canvas.getTextWidth(nameStr, 2);
    const nameX = Math.round((width - nameWidth) / 2);

    // Drop shadow
    canvas.drawText(nameStr, nameX + 2, 47, 0, 2);
    // Main text
    canvas.drawText(nameStr, nameX, 45, 6, 2);

    // Decorative side diamonds
    canvas.drawRhombus(nameX - 20, 53, 6, 6, borderColor, true);
    canvas.drawRhombus(nameX + nameWidth + 20, 53, 6, 6, borderColor, true);

    // 6. Change Bar HUD
    const barX = 70;
    const barY = 82;
    const barW = 340;
    const barH = 16;

    // Bar frame container
    canvas.drawRect(barX, barY, barW, barH, 8);
    canvas.drawRect(barX - 1, barY - 1, barW + 2, barH + 2, borderColor);

    // Fill gauge progress
    const fillWidth = Math.round((changeGauge / 100) * (barW - 4));
    if (fillWidth > 0) {
      canvas.fillRect(barX + 2, barY + 2, fillWidth, barH - 4, changeGauge >= 100 ? 4 : 2);

      // Animated scanline across gauge
      const scanX = barX + 2 + ((frame * 25) % (fillWidth || 1));
      if (scanX < barX + 2 + fillWidth) {
        canvas.drawLine(scanX, barY + 2, scanX + 4, barY + barH - 3, 6);
      }
    }

    // Gauge text labels
    const gaugeText = `CHANGEMENT : ${changeGauge}%`;
    const gTextW = canvas.getTextWidth(gaugeText, 1);
    canvas.drawText(gaugeText, Math.round((width - gTextW) / 2), 104, goldColor, 1);

    // 7. Corner neon rhombuses
    canvas.drawRhombus(20, 15, 5, 5, goldColor, true);
    canvas.drawRhombus(width - 15, 15, 5, 5, goldColor, true);
    canvas.drawRhombus(33, height - 15, 5, 5, goldColor, true);
    canvas.drawRhombus(width - 12, height - 15, 5, 5, goldColor, true);

    // Add frame to GIF encoder
    gifWriter.addFrame(0, 0, width, height, canvas.pixels, {
      palette: PALETTE,
      delay: frameDelayMs
    });
  }

  return outBuf.slice(0, gifWriter.end());
}

module.exports = {
  generateArenaGif,
  PixelCanvas,
  PALETTE
};
