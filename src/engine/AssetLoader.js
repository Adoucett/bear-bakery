import { getPerf } from './Perf.js';

export class AssetLoader {
  constructor() {
    /** @type {Map<string, CanvasImageSource>} */
    this.images = new Map();
    this.failed = new Set();
  }

  /**
   * @param {Record<string, string>} imageMap
   */
  async loadImages(imageMap) {
    const entries = Object.entries(imageMap);
    const perf = getPerf();
    await Promise.all(
      entries.map(([key, src]) =>
        new Promise((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = async () => {
            try {
              const prepared = prepareImage(key, img);
              const optimized = await optimizeSprite(prepared, perf.spriteMaxEdge);
              this.images.set(key, /** @type {any} */ (optimized));
            } catch {
              this.images.set(key, img);
            }
            resolve();
          };
          img.onerror = () => {
            this.failed.add(key);
            console.warn(`Failed to load image: ${src}`);
            resolve();
          };
          img.src = src;
        }),
      ),
    );
  }

  get(key) {
    return this.images.get(key) || null;
  }

  has(key) {
    return this.images.has(key);
  }
}

/**
 * Decode + optionally downscale once at load so gameplay never bilinear-scales
 * huge PNGs every frame (the main iPhone lag source alongside high DPR).
 * @param {CanvasImageSource} source
 * @param {number} maxEdge
 * @returns {Promise<CanvasImageSource>}
 */
async function optimizeSprite(source, maxEdge) {
  const w =
    /** @type {any} */ (source).naturalWidth ||
    /** @type {any} */ (source).width ||
    0;
  const h =
    /** @type {any} */ (source).naturalHeight ||
    /** @type {any} */ (source).height ||
    0;
  if (!w || !h) return source;

  const longest = Math.max(w, h);
  const needsResize = longest > maxEdge;
  const scale = needsResize ? maxEdge / longest : 1;
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  if (typeof createImageBitmap === 'function') {
    try {
      if (needsResize) {
        return await createImageBitmap(source, {
          resizeWidth: tw,
          resizeHeight: th,
          resizeQuality: 'high',
        });
      }
      return await createImageBitmap(source);
    } catch {
      // Fall through to canvas path (older Safari).
    }
  }

  if (!needsResize) return source;
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(/** @type {CanvasImageSource} */ (source), 0, 0, tw, th);
  return canvas;
}

/**
 * Remove the opaque olive generation backdrop from the red-panda direction
 * set. This happens once at load time; all other PNGs stay byte-for-byte
 * visually unchanged (until optional downscale).
 *
 * @param {string} key
 * @param {HTMLImageElement} image
 * @returns {HTMLImageElement|HTMLCanvasElement}
 */
function prepareImage(key, image) {
  const isRedPandaDirection =
    key.startsWith('red_panda_') &&
    ['_front', '_back', '_left', '_side', '_sit'].some((suffix) => key.endsWith(suffix));
  if (!isRedPandaDirection || typeof document === 'undefined') return image;

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return image;

  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = frame.data;
  const background = [180, 186, 135];
  const width = canvas.width;
  const height = canvas.height;
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let read = 0;
  let write = 0;

  const distanceAt = (pixel) => {
    const offset = pixel * 4;
    const dr = data[offset] - background[0];
    const dg = data[offset + 1] - background[1];
    const db = data[offset + 2] - background[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };
  const enqueue = (pixel) => {
    if (visited[pixel] || distanceAt(pixel) >= 86) return;
    visited[pixel] = 1;
    queue[write++] = pixel;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (read < write) {
    const pixel = queue[read++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[pixel * 4 + 3] = 0;
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(frame, 0, 0);
  return canvas;
}
