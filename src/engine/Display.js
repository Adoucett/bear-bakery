import { CONFIG } from '../config.js';
import { getPerf } from './Perf.js';

/**
 * Hi-DPI / fullscreen display scaler.
 * Game logic stays in logical 960×640; the canvas backing store matches
 * CSS size × capped devicePixelRatio (lower on phones).
 */
export class Display {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ logicalW?: number, logicalH?: number, maxDpr?: number }} [opts]
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.logicalW = opts.logicalW ?? CONFIG.CANVAS_W;
    this.logicalH = opts.logicalH ?? CONFIG.CANVAS_H;
    const perf = getPerf();
    this.maxDpr = opts.maxDpr ?? perf.maxDpr;
    this.dpr = 1;
    this.cssW = this.logicalW;
    this.cssH = this.logicalH;
    this._attached = false;
    this.immersive = false;
  }

  attach() {
    if (this._attached) return;
    this._attached = true;
    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
    document.addEventListener('fullscreenchange', onResize);
    document.addEventListener('webkitfullscreenchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    if (document.fonts?.ready) {
      document.fonts.ready.then(onResize).catch(() => {});
    }
    this.resize();
  }

  isFullscreen() {
    return !!(
      document.fullscreenElement ||
      /** @type {any} */ (document).webkitFullscreenElement ||
      this.immersive
    );
  }

  setImmersive(on) {
    this.immersive = !!on;
    document.documentElement.classList.toggle('is-immersive', this.immersive);
    this.resize();
  }

  /** Available CSS pixels for the game surface. */
  _viewportSize() {
    const fs = this.isFullscreen();
    const vv = window.visualViewport;
    const vw = vv?.width || window.innerWidth;
    const vh = vv?.height || window.innerHeight;
    const hint = document.getElementById('hint');
    const hintH = !fs && hint ? Math.min(28, hint.getBoundingClientRect().height) : 0;
    const pad = fs ? 0 : 2;
    return {
      w: Math.max(320, vw - pad * 2),
      h: Math.max(240, vh - hintH - pad * 2),
    };
  }

  resize() {
    const perf = getPerf();
    this.maxDpr = Math.min(this.maxDpr, perf.maxDpr);

    const { w: maxW, h: maxH } = this._viewportSize();
    const aspect = this.logicalW / this.logicalH;
    let cssW = maxW;
    let cssH = cssW / aspect;
    if (cssH > maxH) {
      cssH = maxH;
      cssW = cssH * aspect;
    }
    const fillX = cssW / maxW;
    const fillY = cssH / maxH;
    if (Math.min(fillX, fillY) > 0.92 || this.isFullscreen()) {
      cssW = maxW;
      cssH = maxH;
    }
    cssW = Math.max(1, Math.floor(cssW));
    cssH = Math.max(1, Math.floor(cssH));

    const dpr = Math.min(Math.max(1, window.devicePixelRatio || 1), this.maxDpr);
    let bw = Math.round(cssW * dpr);
    let bh = Math.round(cssH * dpr);
    // Hard cap backing-store pixels on phones (≈ 1.2MP).
    const maxPixels = perf.mobile ? 1_200_000 : 3_600_000;
    const pixels = bw * bh;
    if (pixels > maxPixels) {
      const scale = Math.sqrt(maxPixels / pixels);
      bw = Math.max(320, Math.round(bw * scale));
      bh = Math.max(240, Math.round(bh * scale));
    }
    if (bw % 2) bw += 1;
    if (bh % 2) bh += 1;

    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }

    document.documentElement.classList.toggle('is-fullscreen', this.isFullscreen());
  }

  /**
   * Map drawing into logical game space.
   * @param {CanvasRenderingContext2D} ctx
   */
  beginFrame(ctx) {
    const sx = this.canvas.width / this.logicalW;
    const sy = this.canvas.height / this.logicalH;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    const perf = getPerf();
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      ctx.imageSmoothingQuality = perf.smoothing;
    }
  }

  get pixelScale() {
    return this.canvas.width / this.logicalW;
  }
}
