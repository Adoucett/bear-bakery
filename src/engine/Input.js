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
    /** True while a finger / pen / mouse button is down on the canvas. */
    this.pointerDown = false;
    /** True once the active pointer moved beyond TAP_SLOP (drag-to-move). */
    this.isDragging = false;
    /** 'mouse' | 'touch' | 'pen' */
    this.pointerType = 'mouse';
    /** When true, Player ignores mouse-follow (cursor over HUD). */
    this.uiBlocksFollow = false;
    this._bound = false;
    this._activePointerId = null;
    this._downX = 0;
    this._downY = 0;
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

    // Pointer events cover mouse + touch + pen (iPad Safari included).
    this.canvas.addEventListener('pointermove', (e) => {
      const p = this._toLogical(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      if (!this.pointerDown) return;
      if (this._activePointerId != null && e.pointerId !== this._activePointerId) return;
      const dist = Math.hypot(p.x - this._downX, p.y - this._downY);
      if (dist >= CONFIG.TAP_SLOP) this.isDragging = true;
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      const p = this._toLogical(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.pointerDown = true;
      this.isDragging = false;
      this.pointerType = e.pointerType || 'mouse';
      this._activePointerId = e.pointerId;
      this._downX = p.x;
      this._downY = p.y;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers reject capture on certain pointer types.
      }
      if (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen') {
        this.mouse.left = true;
        // leftClick fires on release if it was a tap (see endPointer).
      }
      if (e.button === 2) {
        this.mouse.right = true;
        this.mouse.rightClick = true;
      }
      this.canvas.focus();
      e.preventDefault();
    }, { passive: false });

    const endPointer = (e) => {
      if (this._activePointerId != null && e.pointerId !== this._activePointerId) return;
      const wasTap =
        this.pointerDown &&
        !this.isDragging &&
        (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen' || e.type === 'pointercancel');
      if (wasTap && (e.type === 'pointerup' || e.type === 'pointercancel')) {
        // Re-sample in case the OS coalesced the last move.
        if (e.clientX != null) {
          const p = this._toLogical(e);
          this.mouse.x = p.x;
          this.mouse.y = p.y;
        }
        this.mouse.leftClick = true;
      }
      this.pointerDown = false;
      this.isDragging = false;
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

  /**
   * True when movement should chase the pointer (desktop hover-follow or
   * touch/pen drag). Taps never count as follow.
   */
  wantsPointerFollow(controlMode) {
    if (this.uiBlocksFollow) return false;
    if (controlMode === 'classic') {
      // iPad has no WASD — drag still moves in classic; mouse hover does not.
      return this.pointerDown && this.isDragging && this.pointerType !== 'mouse';
    }
    // Follow mode: mouse chases cursor; touch/pen only while dragging.
    if (this.pointerType === 'touch' || this.pointerType === 'pen') {
      return this.pointerDown && this.isDragging;
    }
    return true;
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
