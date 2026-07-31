import { CONFIG, COLORS } from '../config.js';
import { SPECIES } from '../data/species.js';
import { Character, moveWithCollision } from './Character.js';
import { facingFromMove } from './Facing.js';

export class Player extends Character {
  /**
   * @param {object} opts
   * @param {import('../engine/AssetLoader.js').AssetLoader} opts.assets
   * @param {number} opts.x
   * @param {number} opts.y
   */
  constructor({ assets, x, y }) {
    super({ species: SPECIES.bear, assets, x, y, name: 'Baker Bear' });
    this.speed = CONFIG.PLAYER_SPEED;
    this.target = null;
    /** @type {'follow'|'classic'} */
    this.controlMode = 'follow';
    this.mouseFollow = true;
    this.mouseFollowToggle = true;
    this.held = null;
    /** @type {{ recipe: object, ingredients: string[] }|null} */
    this.heldPlate = null;
    /** Dirty café dishes carried to the dishwasher (stack capacity 4). */
    this.dirtyDishes = [];
    this.dishCarryMax = 4;
  }

  holdPlate(plate) {
    this.heldPlate = plate;
    this.held = plate ? `${plate.recipe.emoji} ${plate.recipe.name}` : null;
  }

  clearHeld() {
    this.heldPlate = null;
    this.held = null;
  }

  carryDirtyDish(dish) {
    if (this.dirtyDishes.length >= this.dishCarryMax) return false;
    this.dirtyDishes.push(dish);
    return true;
  }

  washDirtyDishes() {
    const count = this.dirtyDishes.length;
    this.dirtyDishes = [];
    return count;
  }

  /**
   * @param {number} dt
   * @param {import('../engine/Input.js').Input} input
   * @param {{x:number,y:number,w:number,h:number}[]} walls
   */
  update(dt, input, walls) {
    // F toggles follow mode when already in follow; classic uses keys / touch-drag.
    if (input.justPressed('f') && this.controlMode === 'follow') {
      this.mouseFollowToggle = !this.mouseFollowToggle;
    }

    let follow = false;
    if (this.controlMode === 'follow' && this.mouseFollowToggle) {
      follow = input.wantsPointerFollow('follow');
    } else if (this.controlMode === 'classic') {
      // iPad: drag-to-move even in classic (no WASD on screen).
      follow = input.wantsPointerFollow('classic');
    } else if (this.controlMode === 'follow' && input.mouse.right) {
      follow = !input.uiBlocksFollow;
    }
    this.mouseFollow = follow;

    let mx = 0;
    let my = 0;
    let usingKeyboard = false;

    if (input.pressed('w') || input.pressed('arrowup')) my -= 1;
    if (input.pressed('s') || input.pressed('arrowdown')) my += 1;
    if (input.pressed('a') || input.pressed('arrowleft')) mx -= 1;
    if (input.pressed('d') || input.pressed('arrowright')) mx += 1;

    if (mx !== 0 || my !== 0) {
      usingKeyboard = true;
      this.target = null;
      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;
    } else if (this.mouseFollow) {
      const dx = input.mouse.x - this.cx;
      const dy = input.mouse.y - this.cy;
      const dist = Math.hypot(dx, dy);
      // Dead zone: fine taps / station clicks near the bear won't shove him.
      if (dist > CONFIG.FOLLOW_DEAD_ZONE) {
        mx = dx / dist;
        my = dy / dist;
      }
      this.target = null;
    } else if (this.target) {
      const dx = this.target.x - this.cx;
      const dy = this.target.y - this.cy;
      const dist = Math.hypot(dx, dy);
      if (dist <= CONFIG.CLICK_ARRIVE_DIST) {
        this.target = null;
      } else {
        mx = dx / dist;
        my = dy / dist;
      }
    }

    this.bob = mx !== 0 || my !== 0 ? 1 : 0;
    const face = facingFromMove(mx, my, this.facingDir);
    this.facing = face.facing;
    this.facingDir = face.facingDir;

    const body = this.getBounds();
    const next = moveWithCollision(
      body,
      mx * this.speed * dt,
      my * this.speed * dt,
      walls,
    );
    this.applyBounds(next);

    return { usingKeyboard };
  }

  setControlMode(mode) {
    this.controlMode = mode === 'classic' ? 'classic' : 'follow';
    this.mouseFollowToggle = this.controlMode === 'follow';
    this.mouseFollow = this.mouseFollowToggle;
    if (this.controlMode === 'classic') this.target = null;
  }

  setClickTarget(x, y) {
    this.target = { x, y };
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time
   */
  draw(ctx, time) {
    if (this.target) {
      ctx.fillStyle = COLORS.destination;
      ctx.beginPath();
      ctx.arc(this.target.x, this.target.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.mint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.target.x, this.target.y, 14 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    super.draw(ctx, time);

    // Held item badge
    if (this.held) {
      ctx.fillStyle = COLORS.butter;
      ctx.beginPath();
      ctx.arc(this.x + this.size - 4, this.y + 4, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.font = '12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', this.x + this.size - 4, this.y + 8);
    }

    // Mouse-follow indicator
    if (this.mouseFollow) {
      ctx.fillStyle = 'rgba(107, 191, 138, 0.9)';
      ctx.font = 'bold 10px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FOLLOW', this.cx, this.y + this.size + 12);
    }
  }
}
