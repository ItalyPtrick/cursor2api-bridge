import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import toIco from 'to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outputDir = join(projectRoot, 'assets', 'generated');

mkdirSync(outputDir, { recursive: true });

function createCanvas(size, background = [0, 0, 0, 0]) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      setPixel(png, x, y, background);
    }
  }
  return png;
}

function setPixel(png, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (png.width * y + x) << 2;
  png.data[index] = r;
  png.data[index + 1] = g;
  png.data[index + 2] = b;
  png.data[index + 3] = a;
}

function fillRect(png, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      setPixel(png, px, py, color);
    }
  }
}

function fillCircle(png, cx, cy, radius, color) {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, x, y, color);
      }
    }
  }
}

function fillTriangle(png, points, color) {
  const [a, b, c] = points;
  const minX = Math.min(a[0], b[0], c[0]);
  const maxX = Math.max(a[0], b[0], c[0]);
  const minY = Math.min(a[1], b[1], c[1]);
  const maxY = Math.max(a[1], b[1], c[1]);

  const area = (x1, y1, x2, y2, x3, y3) => (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const a1 = area(x, y, b[0], b[1], c[0], c[1]);
      const a2 = area(a[0], a[1], x, y, c[0], c[1]);
      const a3 = area(a[0], a[1], b[0], b[1], x, y);
      const hasNeg = a1 < 0 || a2 < 0 || a3 < 0;
      const hasPos = a1 > 0 || a2 > 0 || a3 > 0;
      if (!(hasNeg && hasPos)) {
        setPixel(png, x, y, color);
      }
    }
  }
}

function drawBridgeIcon(size, palette) {
  const png = createCanvas(size);
  const laneHeight = Math.max(2, Math.floor(size * 0.1));
  const bridgeHeight = Math.max(3, Math.floor(size * 0.14));
  const centerY = Math.floor(size / 2);
  const leftX = Math.floor(size * 0.18);
  const rightX = Math.floor(size * 0.82);
  const shaftWidth = Math.max(2, Math.floor(size * 0.14));
  const bridgeStart = Math.floor(size * 0.33);
  const bridgeEnd = Math.floor(size * 0.67);

  fillCircle(png, Math.floor(size / 2), Math.floor(size / 2), Math.floor(size * 0.48), palette.ring);
  fillRect(png, bridgeStart, centerY - Math.floor(bridgeHeight / 2), bridgeEnd - bridgeStart, bridgeHeight, palette.bridge);
  fillRect(png, leftX, centerY - Math.floor(laneHeight / 2), bridgeStart - leftX - shaftWidth, laneHeight, palette.left);
  fillRect(png, bridgeEnd + shaftWidth, centerY - Math.floor(laneHeight / 2), rightX - bridgeEnd - shaftWidth, laneHeight, palette.right);

  fillTriangle(
    png,
    [
      [bridgeStart - shaftWidth, centerY],
      [bridgeStart, centerY - Math.floor(size * 0.16)],
      [bridgeStart, centerY + Math.floor(size * 0.16)]
    ],
    palette.left
  );

  fillTriangle(
    png,
    [
      [bridgeEnd + shaftWidth, centerY],
      [bridgeEnd, centerY - Math.floor(size * 0.16)],
      [bridgeEnd, centerY + Math.floor(size * 0.16)]
    ],
    palette.right
  );

  return PNG.sync.write(png);
}

const palettes = {
  running: {
    ring: [20, 26, 39, 255],
    left: [42, 157, 143, 255],
    bridge: [245, 158, 11, 255],
    right: [29, 78, 216, 255]
  },
  stopped: {
    ring: [71, 85, 105, 255],
    left: [148, 163, 184, 255],
    bridge: [100, 116, 139, 255],
    right: [148, 163, 184, 255]
  },
  error: {
    ring: [69, 10, 10, 255],
    left: [239, 68, 68, 255],
    bridge: [251, 146, 60, 255],
    right: [239, 68, 68, 255]
  }
};

const trayFiles = {};

for (const [name, palette] of Object.entries(palettes)) {
  const buffer = drawBridgeIcon(64, palette);
  const file = join(outputDir, `tray-${name}.png`);
  writeFileSync(file, buffer);
  trayFiles[name] = buffer;
}

const appIconPng = drawBridgeIcon(256, palettes.running);
writeFileSync(join(outputDir, 'icon.png'), appIconPng);
const ico = await toIco([drawBridgeIcon(16, palettes.running), drawBridgeIcon(32, palettes.running), drawBridgeIcon(64, palettes.running), appIconPng]);
writeFileSync(join(outputDir, 'icon.ico'), ico);

