/**
 * Generate a simple toilet sprite (assets/furniture/toilet.png) without deps.
 * Run: node tools/generate-toilet.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const W = 96;
const H = 128;
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

function fillRect(x0, y0, x1, y1, r, g, b, a = 255) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) set(x, y, r, g, b, a);
  }
}

function fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) set(x, y, r, g, b, a);
    }
  }
}

// Soft stall backdrop
fillRect(8, 4, W - 9, H - 5, 210, 226, 232, 70);

// Tank
fillRect(28, 10, 67, 42, 244, 248, 250);
fillRect(32, 14, 63, 22, 197, 220, 230);
fillRect(54, 16, 60, 24, 160, 190, 205); // flush button

// Bowl / seat
fillEllipse(48, 72, 30, 18, 248, 251, 252);
fillEllipse(48, 70, 18, 10, 180, 215, 228);
fillEllipse(48, 69, 10, 5, 150, 200, 220);

// Pedestal / base
fillRect(34, 86, 62, 104, 232, 240, 245);
fillRect(30, 104, 66, 118, 210, 225, 234);

// Outline accents
for (let x = 28; x <= 67; x += 1) {
  set(x, 10, 122, 159, 173);
  set(x, 42, 122, 159, 173);
}
for (let y = 10; y <= 42; y += 1) {
  set(28, y, 122, 159, 173);
  set(67, y, 122, 159, 173);
}

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

// PNG filter type 0 per row
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
