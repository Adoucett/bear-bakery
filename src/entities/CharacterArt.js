/**
 * Draw bakery animals from local PNG sprites with light micro-animation.
 * Falls back to procedural CuteAnimals if a sprite is missing.
 */
import { drawCuteAnimal } from './CuteAnimals.js';

/** Per-species motion profiles for PNG sprites (feet-pivoted). */
function getSpriteMotion(id, time, walking, s) {
  const t = time;
  switch (id) {
    case 'frog': {
      const hop = walking ? Math.abs(Math.sin(t * 8)) : 0;
      const land = walking ? Math.max(0, Math.cos(t * 8)) : 0;
      return {
        x: 0,
        y: -hop * s * 0.09,
        rotate: 0,
        scaleX: 1 + land * 0.02,
        scaleY: 1 - land * 0.035,
      };
    }
    case 'penguin':
    case 'pig':
      return {
        x: walking ? Math.sin(t * 8) * s * 0.01 : 0,
        y: walking ? -Math.abs(Math.sin(t * 8)) * s * 0.012 : 0,
        rotate: walking ? Math.sin(t * 8) * 0.012 : 0,
        scaleX: 1,
        scaleY: 1,
      };
    case 'owl':
      return {
        x: 0,
        y: walking ? Math.abs(Math.sin(t * 9)) * s * 0.03 : 0,
        rotate: Math.sin(t * (walking ? 5 : 1.8)) * (walking ? 0.02 : 0.012),
        scaleX: 1,
        scaleY: 1,
      };
    case 'squirrel':
    case 'red_panda':
      return {
        x: walking ? Math.sin(t * 10) * s * 0.008 : 0,
        y: walking ? -Math.abs(Math.sin(t * 10)) * s * 0.018 : 0,
        rotate: walking ? Math.sin(t * 10) * 0.012 : 0,
        scaleX: 1,
        scaleY: 1,
      };
    case 'moose':
    case 'giraffe':
    case 'elephant':
      return {
        x: 0,
        y: walking ? Math.abs(Math.sin(t * 6)) * s * 0.015 : 0,
        rotate: Math.sin(t * (walking ? 4 : 1.2)) * 0.01,
        scaleX: 1,
        scaleY: 1,
      };
    case 'bunny':
      return {
        x: 0,
        y: walking ? Math.abs(Math.sin(t * 11)) * s * 0.06 : Math.sin(t * 2.8) * s * 0.012,
        rotate: 0,
        scaleX: 1,
        scaleY: walking ? 1 - Math.abs(Math.sin(t * 11)) * 0.03 : 1,
      };
    default:
      return {
        x: 0,
        y: walking ? -Math.abs(Math.sin(t * 9)) * s * 0.01 : 0,
        rotate: 0,
        scaleX: 1,
        scaleY: 1,
      };
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 */
export function drawCharacterArt(ctx, opts) {
  const {
    id,
    x,
    y,
    size: s,
    color,
    accent,
    facing = 1,
    time = 0,
    walking = false,
    image = null,
    state = null,
  } = opts;

  if (!image) {
    drawCuteAnimal(ctx, {
      id,
      x,
      y,
      size: s,
      color,
      accent,
      facing,
      time,
      walking,
    });
    return;
  }

  const breath = Math.sin(time * 2.4 + x * 0.01) * (walking ? 0.15 : 0.45);
  const sitting = state === 'waiting' || state === 'eating';
  const walkBob = walking && !sitting ? Math.abs(Math.sin(time * 9)) * (s * 0.012) : 0;
  const happyBounce =
    state === 'eating' ? Math.abs(Math.sin(time * 6)) * s * 0.04 :
    state === 'waiting' ? Math.sin(time * 2) * s * 0.008 :
    0;
  const feetX = x + s / 2;
  const feetY = y + s;
  const motion = getSpriteMotion(id, time, walking && !sitting, s);

  // Soft ground shadow (squashes slightly when hopping)
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  const shadowScale = 1 + Math.max(0, -motion.y / (s * 0.2)) * 0.15;
  ctx.ellipse(feetX, feetY - 1, s * 0.34 * shadowScale, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  const iw = /** @type {HTMLImageElement} */ (image).naturalWidth
    || /** @type {HTMLImageElement} */ (image).width
    || 1;
  const ih = /** @type {HTMLImageElement} */ (image).naturalHeight
    || /** @type {HTMLImageElement} */ (image).height
    || 1;
  const aspect = iw / ih;

  let drawH = s * 0.98;
  let drawW = drawH * aspect;
  const maxW = s * 1.45;
  if (drawW > maxW) {
    drawW = maxW;
    drawH = drawW / aspect;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  ctx.translate(
    feetX + motion.x,
    feetY - walkBob + breath * (s / 48) + motion.y - happyBounce,
  );
  ctx.scale(facing * motion.scaleX, motion.scaleY);
  ctx.rotate(motion.rotate);
  ctx.drawImage(/** @type {CanvasImageSource} */ (image), -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
}
