import { COLORS } from '../config.js';
import { displayOrderText } from '../data/dialogue.js';
import { recipeIngredientLabels } from '../data/recipes.js';
import { drawCharacterArt } from '../entities/CharacterArt.js';
import { resolveDirectionImage } from '../entities/Facing.js';

/** Card bounds chosen to clear the stock panel (left) and economy panel (right). */
const CARD = { x: 250, y: 150, w: 420, h: 305 };

/**
 * Single non-blocking greeting card: who arrived, what they actually ordered,
 * and the recipe for it. The game keeps running while this is on screen.
 */
export class ProfileCard {
  constructor() {
    /** @type {import('../entities/Customer.js').Customer|null} */
    this.customer = null;
    this.timer = 0;
    /** @type {'hidden'|'shown'} */
    this.phase = 'hidden';
    this.duration = 8;
    /** True once Game has played / scheduled the order voice. */
    this.orderCued = false;
  }

  /**
   * @param {import('../entities/Customer.js').Customer} customer
   */
  show(customer) {
    this.customer = customer;
    this.phase = 'shown';
    this.timer = this.duration;
    this.orderCued = false;
  }

  /** Mark that the order voice has been cued (from greet onEnded). */
  markOrderCued() {
    this.orderCued = true;
  }

  get active() {
    return this.phase !== 'hidden' && !!this.customer;
  }

  /** Screen-space bounds so the card can be dismissed by clicking it. */
  get bounds() {
    return { ...CARD };
  }

  /**
   * @param {number} mx
   * @param {number} my
   */
  hitTest(mx, my) {
    if (!this.active) return false;
    return (
      mx >= CARD.x && mx <= CARD.x + CARD.w && my >= CARD.y && my <= CARD.y + CARD.h
    );
  }

  /**
   * Card timer only controls dismiss. Order voice is chained from greet onEnded.
   * @param {number} dt
   * @returns {'done'|null}
   */
  update(dt) {
    if (!this.active) return null;
    this.timer -= dt;
    if (this.timer > 0) return null;
    return this.dismiss();
  }

  /** Dismiss immediately (click on the card). */
  dismiss() {
    if (!this.active) return null;
    this.phase = 'hidden';
    const c = this.customer;
    this.customer = null;
    return c ? 'done' : null;
  }

  /** @deprecated retained for callers that expect the old skip API */
  skip() {
    return this.dismiss();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../engine/AssetLoader.js').AssetLoader} assets
   */
  draw(ctx, assets) {
    if (!this.active || !this.customer) return;
    const c = this.customer;
    // Always the rolled order — never species.prefers.
    const order = c.order;
    const { x, y, w: cardW, h: cardH } = CARD;

    ctx.save();
    ctx.shadowColor = 'rgba(20, 12, 8, 0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = 'rgba(255, 248, 231, 0.98)';
    ctx.strokeStyle = COLORS.butter;
    ctx.lineWidth = 4;
    roundRect(ctx, x, y, cardW, cardH, 16);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = COLORS.butter;
    ctx.lineWidth = 4;
    roundRect(ctx, x, y, cardW, cardH, 16);
    ctx.stroke();

    // Portrait
    const px = x + 20;
    const py = y + 18;
    ctx.fillStyle = 'rgba(255, 220, 180, 0.65)';
    ctx.beginPath();
    ctx.arc(px + 38, py + 40, 42, 0, Math.PI * 2);
    ctx.fill();
    const key = c.species.spriteKey || c.species.id;
    const portrait = resolveDirectionImage(assets, key, 'front');
    drawCharacterArt(ctx, {
      id: c.species.id,
      x: px + 6,
      y: py,
      size: 64,
      color: c.species.fallbackColor,
      accent: c.species.accent,
      facing: 1,
      time: performance.now() / 1000,
      walking: false,
      image: portrait.image,
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 24px Fredoka, sans-serif';
    ctx.fillText(c.name, x + 108, y + 44);
    ctx.font = '16px Fredoka, sans-serif';
    ctx.fillStyle = '#6a4a28';
    ctx.fillText(`the ${c.species.label} · ${c.species.personality}`, x + 108, y + 68);

    ctx.fillStyle = '#5a4030';
    ctx.font = '14px Fredoka, sans-serif';
    const spoken = this.orderCued && c.orderLine ? c.orderLine : c.greetLine;
    wrapLines(ctx, `“${spoken}”`, cardW - 130, 2).forEach((line, i) => {
      ctx.fillText(line, x + 108, y + 92 + i * 17);
    });

    // Divider
    ctx.strokeStyle = 'rgba(122, 61, 36, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 140);
    ctx.lineTo(x + cardW - 20, y + 140);
    ctx.stroke();

    // The actual order
    ctx.fillStyle = COLORS.berry;
    ctx.font = 'bold 17px Fredoka, sans-serif';
    ctx.fillText('THEY WANT', x + 20, y + 168);

    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 30px Fredoka, sans-serif';
    ctx.fillText(displayOrderText(order), x + 20, y + 202);

    ctx.fillStyle = '#6a4a28';
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.fillText('Recipe', x + 20, y + 228);

    const labels = recipeIngredientLabels(order);
    ctx.fillStyle = '#5a4030';
    ctx.font = '15px Fredoka, sans-serif';
    labels.slice(0, 6).forEach((line, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      ctx.fillText(`• ${line}`, x + 28 + col * 196, y + 250 + row * 20);
    });

    ctx.fillStyle = '#8a7360';
    ctx.font = '13px Fredoka, sans-serif';
    ctx.fillText(
      `Serve from the case or bake it · click card to close (${Math.ceil(this.timer)}s)`,
      x + 20,
      y + cardH - 14,
    );
  }
}

function wrapLines(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
