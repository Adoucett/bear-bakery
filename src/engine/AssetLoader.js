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
    await Promise.all(
      entries.map(([key, src]) =>
        new Promise((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = async () => {
            try {
              const prepared = prepareImage(key, img);
              // Prefer decoded bitmap when available (sharper + less jank on first draw)
              if (typeof createImageBitmap === 'function') {
                const bmp = await createImageBitmap(prepared, {
                  premultiplyAlpha: 'premultiply',
                  colorSpaceConversion: 'default',
                });
                this.images.set(key, /** @type {any} */ (bmp));
              } else {
                this.images.set(key, prepared);
              }
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
 * Remove the opaque olive generation backdrop from the red-panda direction
 * set. This happens once at load time; all other PNGs stay byte-for-byte
 * visually unchanged.
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

  // Flood only from the canvas perimeter. This removes the generated
  // backdrop while preserving similarly colored fur/details enclosed by
  // the character silhouette.
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
