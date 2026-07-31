import { CONFIG } from '../config.js';

export class Input {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.keysJustPressed = new Set();
    this.mouse = { x: 0, y: 0, left: false, right: false, leftClick: false, rightClick: false };
    /** True while a finger / pen is actively touching the canvas. */
    this.pointerDown = false;
    /** When true, Player ignores mouse-follow (cursor over HUD). */
    this.uiBlocksFollow = false;
    this._bound = false;
    this._activePointerId = null;
    this.bind();
  }

  bind() {
    if (this._bound) return;
    this._bound = true;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'space'].includes(k) || k === ' ') {
        e.preventDefault();
      }
      if (!this.keys.has(k)) this.keysJustPressed.add(k);
      this.keys.add(k);
      if (e.code === 'Space') {
        if (!this.keys.has(' ')) this.keysJustPressed.add(' ');
        this.keys.add(' ');
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (e.code === 'Space') this.keys.delete(' ');
    });

    // Pointer events cover mouse + touch + pen for bakery touchscreens.
    this.canvas.addEventListener('pointermove', (e) => {
      const p = this._toLogical(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      const p = this._toLogical(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.pointerDown = true;
      this._activePointerId = e.pointerId;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers reject capture on certain pointer types.
      }
      if (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen') {
        this.mouse.left = true;
        this.mouse.leftClick = true;
      }
      if (e.button === 2) {
        this.mouse.right = true;
        this.mouse.rightClick = true;
      }
      this.canvas.focus();
    });

    const endPointer = (e) => {
      if (this._activePointerId != null && e.pointerId !== this._activePointerId) return;
      this.pointerDown = false;
      this._activePointerId = null;
      if (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen') {
        this.mouse.left = false;
      }
      if (e.button === 2) this.mouse.right = false;
    };

    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** CSS display pixels → logical game coordinates (960×640). */
  _toLogical(e) {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    return {
      x: ((e.clientX - rect.left) / w) * CONFIG.CANVAS_W,
      y: ((e.clientY - rect.top) / h) * CONFIG.CANVAS_H,
    };
  }

  pressed(key) {
    return this.keys.has(key.toLowerCase());
  }

  justPressed(key) {
    return this.keysJustPressed.has(key.toLowerCase());
  }

  wasdActive() {
    return (
      this.pressed('w') || this.pressed('a') || this.pressed('s') || this.pressed('d') ||
      this.pressed('arrowup') || this.pressed('arrowdown') ||
      this.pressed('arrowleft') || this.pressed('arrowright')
    );
  }

  /** Call at end of each frame to clear edge-triggered inputs. */
  endFrame() {
    this.keysJustPressed.clear();
    this.mouse.leftClick = false;
    this.mouse.rightClick = false;
  }
}
