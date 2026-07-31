/**
 * Generate a cozy iso-friendly toilet sprite (assets/furniture/toilet.png) without deps.
 * Run: node tools/generate-toilet.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const W = 128;
const H = 192;
const out = join(dirname(fileURLToPath(import.meta.url)), '../assets/furniture/toilet.png');

/** @type {Uint8Array} RGBA pixels */
const px = new Uint8Array(W * H * 4);

function set(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
}

function blend(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  const alpha = a / 255;
  px[i] = Math.round(px[i] * (1 - alpha) + r * alpha);
  px[i + 1] = Math.round(px[i + 1] * (1 - alpha) + g * alpha);
  px[i + 2] = Math.round(px[i + 2] * (1 - alpha) + b * alpha);
  px[i + 3] = Math.min(255, Math.round(px[i + 3] + a * (1 - px[i + 3] / 255)));
}

function fillRect(x0, y0, x1, y1, r, g, b, a = 255) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) blend(x, y, r, g, b, a);
  }
}

function fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) blend(x, y, r, g, b, a);
    }
  }
}

function strokeRect(x0, y0, x1, y1, r, g, b, a = 255) {
  for (let x = x0; x <= x1; x += 1) {
    blend(x, y0, r, g, b, a);
    blend(x, y1, r, g, b, a);
  }
  for (let y = y0; y <= y1; y += 1) {
    blend(x0, y, r, g, b, a);
    blend(x1, y, r, g, b, a);
  }
}

// Warm cream / teal restroom palette
const TEAL_WALL = [197, 224, 232];
const TEAL_DARK = [122, 159, 173];
const CREAM = [255, 248, 240];
const PORCELAIN = [248, 252, 254];
const PORCELAIN_SHADOW = [210, 232, 240];
const PORCELAIN_INNER = [175, 215, 228];
const STALL = [180, 205, 214];

// Soft floor shadow
fillEllipse(64, 178, 38, 10, 160, 175, 185, 40);

// Stall partition — left wall + back hint (iso-friendly depth)
fillRect(6, 8, 18, H - 14, ...STALL, 210);
fillRect(18, 8, 22, H - 14, ...STALL.map((c) => c - 12), 160);
for (let y = 12; y < H - 16; y += 14) {
  fillRect(8, y, 16, y + 1, ...TEAL_DARK, 80);
}
// Back stall wall
fillRect(22, 8, W - 10, 14, ...TEAL_WALL, 180);
fillRect(22, 14, W - 10, 18, ...TEAL_WALL.map((c) => c - 8), 120);

// Tank — clear rectangular cistern with lid seam
fillRect(36, 22, 91, 68, ...PORCELAIN);
fillRect(40, 26, 87, 38, ...PORCELAIN_SHADOW, 200);
strokeRect(36, 22, 91, 68, ...TEAL_DARK);
// Lid highlight
fillRect(38, 24, 89, 26, 255, 255, 255, 60);
// Flush button
fillEllipse(78, 34, 7, 5, 160, 190, 205);
fillEllipse(78, 33, 4, 2.5, 130, 170, 190);
// Tank base trim
fillRect(38, 62, 89, 66, ...TEAL_DARK, 100);

// Bowl — wide seat ring tapering to pedestal
fillEllipse(64, 98, 38, 16, ...PORCELAIN);
fillEllipse(64, 96, 38, 16, ...TEAL_DARK, 80);
fillEllipse(64, 94, 26, 11, ...PORCELAIN_SHADOW);
fillEllipse(64, 92, 16, 7, ...PORCELAIN_INNER);
fillEllipse(64, 91, 9, 4, 140, 195, 215, 180);

// Pedestal — tapered column
fillRect(48, 108, 79, 132, ...PORCELAIN);
fillRect(44, 128, 83, 134, ...PORCELAIN_SHADOW, 120);
fillRect(40, 148, 87, 158, ...PORCELAIN_SHADOW);
strokeRect(48, 108, 79, 158, ...TEAL_DARK, 140);
// Base plate
fillEllipse(64, 162, 34, 8, ...PORCELAIN);
fillEllipse(64, 163, 34, 8, ...TEAL_DARK, 100);

// Soft porcelain highlights
fillEllipse(52, 88, 8, 3, 255, 255, 255, 90);
fillRect(42, 30, 46, 32, 255, 255, 255, 35);

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y += 1) {
  const row = y * (1 + W * 4);
  raw[row] = 0;
  for (let x = 0; x < W; x += 1) {
    const si = (y * W + x) * 4;
    const di = row + 1 + x * 4;
    raw[di] = px[si];
    raw[di + 1] = px[si + 1];
    raw[di + 2] = px[si + 2];
    raw[di + 3] = px[si + 3];
  }
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(out, png);
console.log(`Wrote ${out} (${W}x${H})`);
