import { COLORS } from '../config.js';
import { drawCharacterArt } from './CharacterArt.js';
import { poseFromState, resolveDirectionImage } from './Facing.js';

/**
 * Collision footprint relative to character size.
 * Tuned slightly smaller than the visual body and biased toward the feet
 * so AABB matches table/fixture bases and reduces clipping through furniture.
 */
export const COLLISION = {
  /** Width as a fraction of `size` (visual body is wider than feet). */
  WIDTH_FRAC: 0.36,
  /** Height as a fraction of `size` (short box at the feet). */
  HEIGHT_FRAC: 0.22,
  /** Nudge box upward from soles (px) so it sits on the visual feet. */
  FEET_PAD: 3,
};

/**
 * Shared character — local PNG sprites with scale + micro-animation.
 * Falls back to procedural CuteAnimals if a sprite fails to load.
 */
export class Character {
  /**
   * @param {object} opts
   * @param {import('../data/species.js').Species} opts.species
   * @param {import('../engine/AssetLoader.js').AssetLoader} opts.assets
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {string} [opts.name]
   */
  constructor({ species, assets, x, y, name = '' }) {
    this.species = species;
    this.assets = assets;
    this.x = x;
    this.y = y;
    this.name = name;
    this.size = species.size;
    this.facing = 1;
    /** @type {import('./Facing.js').FacingDir} */
    this.facingDir = 'front';
    this.bob = 0; // 1 when walking
    /** @type {string|null} */
    this.state = null;
  }

  get cx() {
    return this.x + this.size / 2;
  }

  get cy() {
    return this.y + this.size / 2;
  }

  getBounds() {
    const w = this.size * COLLISION.WIDTH_FRAC;
    const h = this.size * COLLISION.HEIGHT_FRAC;
    return {
      x: this.cx - w / 2,
      y: this.y + this.size - h - COLLISION.FEET_PAD,
      w,
      h,
    };
  }

  /** Apply collision result back onto top-left draw position. */
  applyBounds(next) {
    const w = this.size * COLLISION.WIDTH_FRAC;
    const h = this.size * COLLISION.HEIGHT_FRAC;
    this.x = next.x + w / 2 - this.size / 2;
    this.y = next.y - this.size + h + COLLISION.FEET_PAD;
  }

  /** Optional override for cosmetics (e.g. bear_hat) */
  getSpriteKey() {
    return this.spriteOverride || this.species.spriteKey || this.species.id;
  }

  /**
   * Resolve sprite image for current facing + sit pose.
   * @returns {{ image: CanvasImageSource|null, facing: number }}
   */
  resolveDrawImage() {
    const key = this.getSpriteKey();
    const pose = poseFromState(this.state);
    const resolved = resolveDirectionImage(this.assets, key, this.facingDir, pose);
    // Dedicated _left/_front/_back assets are already oriented — only flip mirrored _side
    let facing = 1;
    if (resolved.flip) facing = -1;
    return { image: resolved.image, facing };
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} [time]
   */
  draw(ctx, time = 0) {
    const walking = !!this.bob;
    const { image, facing } = this.resolveDrawImage();
    drawCharacterArt(ctx, {
      id: this.species.id,
      x: this.x,
      y: this.y,
      size: this.size,
      color: this.species.fallbackColor,
      accent: this.species.accent,
      facing,
      time,
      walking,
      state: this.state || null,
      image,
    });

    if (this.name) {
      ctx.font = 'bold 11px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      const label = this.name;
      const tw = ctx.measureText(label).width + 10;
      const ny = this.y - 4;
      ctx.fillStyle = 'rgba(43,33,24,0.78)';
      ctx.fillRect(this.cx - tw / 2, ny - 14, tw, 14);
      ctx.fillStyle = COLORS.cream;
      ctx.fillText(label, this.cx, ny - 3);
    }
  }
}

/**
 * AABB move with slide against walls.
 * @param {{x:number,y:number,w:number,h:number}} body
 * @param {number} dx
 * @param {number} dy
 * @param {{x:number,y:number,w:number,h:number}[]} walls
 */
export function moveWithCollision(body, dx, dy, walls) {
  let { x, y, w, h } = body;
  x += dx;
  for (const wall of walls) {
    if (aabb(x, y, w, h, wall)) {
      if (dx > 0) x = wall.x - w;
      else if (dx < 0) x = wall.x + wall.w;
    }
  }
  y += dy;
  for (const wall of walls) {
    if (aabb(x, y, w, h, wall)) {
      if (dy > 0) y = wall.y - h;
      else if (dy < 0) y = wall.y + wall.h;
    }
  }
  x = Math.max(8, Math.min(960 - w - 8, x));
  y = Math.max(8, Math.min(640 - h - 8, y));
  return { x, y };
}

function aabb(x, y, w, h, b) {
  return x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y;
}
