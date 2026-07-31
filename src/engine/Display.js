import { CONFIG } from '../config.js';

/**
 * Hi-DPI / fullscreen display scaler.
 * Game logic stays in logical 960×640; the canvas backing store matches
 * the on-screen CSS size × devicePixelRatio so big screens look crisp.
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
    /** Cap DPR for battery; 3 covers most 4K / retina panels. */
    this.maxDpr = opts.maxDpr ?? 3;
    this.dpr = 1;
    this.cssW = this.logicalW;
    this.cssH = this.logicalH;
    this._attached = false;
  }

  attach() {
    if (this._attached) return;
    this._attached = true;
    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('fullscreenchange', onResize);
    // Fonts can change metrics after load — redraw sharper once ready
    if (document.fonts?.ready) {
      document.fonts.ready.then(onResize).catch(() => {});
    }
    this.resize();
  }

  isFullscreen() {
    return !!document.fullscreenElement;
  }

  /** Available CSS pixels for the game surface. */
  _viewportSize() {
    const fs = this.isFullscreen();
    const hint = document.getElementById('hint');
    const hintH = !fs && hint ? Math.min(28, hint.getBoundingClientRect().height) : 0;
    const pad = fs ? 0 : 2;
    return {
      w: Math.max(320, window.innerWidth - pad * 2),
      h: Math.max(240, window.innerHeight - hintH - pad * 2),
    };
  }

  resize() {
    const { w: maxW, h: maxH } = this._viewportSize();
    const aspect = this.logicalW / this.logicalH;
    // Prefer filling the viewport — slight letterbox only when needed.
    let cssW = maxW;
    let cssH = cssW / aspect;
    if (cssH > maxH) {
      cssH = maxH;
      cssW = cssH * aspect;
    }
    // Stretch a touch toward cover when nearly full so side gutters shrink.
    const fillX = cssW / maxW;
    const fillY = cssH / maxH;
    if (Math.min(fillX, fillY) > 0.92) {
      cssW = maxW;
      cssH = maxH;
    }
    cssW = Math.max(1, Math.floor(cssW));
    cssH = Math.max(1, Math.floor(cssH));

    const dpr = Math.min(Math.max(1, window.devicePixelRatio || 1), this.maxDpr);
    let bw = Math.round(cssW * dpr);
    let bh = Math.round(cssH * dpr);
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
   * Map drawing into logical game space and enable high-quality sampling.
   * @param {CanvasRenderingContext2D} ctx
   */
  beginFrame(ctx) {
    const sx = this.canvas.width / this.logicalW;
    const sy = this.canvas.height / this.logicalH;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      ctx.imageSmoothingQuality = 'high';
    }
  }

  /** Scale factor from logical px → device pixels (for optional stroke tweaks). */
  get pixelScale() {
    return this.canvas.width / this.logicalW;
  }
}
