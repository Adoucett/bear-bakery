import { UPGRADES, SHOP_CATEGORIES } from '../data/upgrades.js';
import { COLORS } from '../config.js';

/**
 * Office unlock shop: grayscale if unaffordable, gold shine if buyable, Yes/No confirm.
 */
export class ShopUI {
  constructor() {
    this.open = false;
    /** @type {import('../data/upgrades.js').UPGRADES[number]|null} */
    this.confirm = null;
    this.time = 0;
    /** @type {{x:number,y:number,w:number,h:number,id:string,kind:string}[]} */
    this.hitboxes = [];
  }

  show() {
    this.open = true;
    this.confirm = null;
  }

  hide() {
    this.open = false;
    this.confirm = null;
  }

  toggle() {
    if (this.open) this.hide();
    else this.show();
  }

  update(dt) {
    this.time += dt;
  }

  /**
   * @param {number} mx
   * @param {number} my
   * @param {import('../systems/EconomySystem.js').EconomySystem} economy
   * @param {import('../systems/InventorySystem.js').InventorySystem} inventory
   * @param {import('../systems/StockSystem.js').StockSystem} stock
   */
  click(mx, my, economy, inventory, stock) {
    if (!this.open) return null;

    if (this.confirm) {
      const yes = this.hitboxes.find((h) => h.kind === 'yes');
      const no = this.hitboxes.find((h) => h.kind === 'no');
      if (yes && inside(mx, my, yes)) {
        const upgrade = this.confirm;
        const result = economy.buy(upgrade.id, inventory, stock);
        this.confirm = null;
        return { type: 'bought', result, upgrade };
      }
      if (no && inside(mx, my, no)) {
        this.confirm = null;
        return { type: 'cancel' };
      }
      return null;
    }

    const classic = this.hitboxes.find((h) => h.kind === 'classic');
    if (classic && inside(mx, my, classic)) {
      economy.equipClassic();
      return { type: 'toggle', upgrade: { name: 'Classic Bear' } };
    }

    for (const box of this.hitboxes) {
      if (box.kind !== 'card' || !inside(mx, my, box)) continue;
      const upgrade = UPGRADES.find((u) => u.id === box.id);
      if (!upgrade) continue;
      if (economy.has(upgrade.id)) {
        if (upgrade.effect === 'cosmetic') {
          economy.toggleCosmetic(upgrade.cosmetic);
          return { type: 'toggle', upgrade };
        }
        return { type: 'owned', upgrade };
      }
      this.confirm = upgrade;
      return { type: 'confirm', upgrade };
    }
    return null;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../systems/EconomySystem.js').EconomySystem} economy
   */
  draw(ctx, economy) {
    if (!this.open) return;
    this.hitboxes = [];

    ctx.fillStyle = 'rgba(25,18,14,.55)';
    ctx.fillRect(0, 0, 960, 640);

    ctx.fillStyle = '#fff8e7';
    roundRect(ctx, 70, 48, 820, 544, 16);
    ctx.fill();
    ctx.strokeStyle = '#c8935b';
    ctx.lineWidth = 4;
    roundRect(ctx, 70, 48, 820, 544, 16);
    ctx.stroke();

    ctx.fillStyle = '#2b2118';
    ctx.font = 'bold 28px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Back Office Unlocks  •  $${economy.money}`, 410, 88);

    ctx.font = '13px Fredoka, sans-serif';
    ctx.fillStyle = '#6a4a28';
    ctx.fillText('Gold = buyable  ·  Owned styles toggle on/off', 385, 112);

    const classic = { x: 675, y: 68, w: 190, h: 48, id: 'classic', kind: 'classic' };
    const classicActive = economy.bearSpriteKey() === 'bear';
    ctx.fillStyle = classicActive ? '#5fd39a' : '#fff3c4';
    roundRect(ctx, classic.x, classic.y, classic.w, classic.h, 10);
    ctx.fill();
    ctx.strokeStyle = classicActive ? '#398766' : '#c8935b';
    ctx.lineWidth = 2;
    roundRect(ctx, classic.x, classic.y, classic.w, classic.h, 10);
    ctx.stroke();
    ctx.fillStyle = '#2b2118';
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Classic / No accessories', classic.x + classic.w / 2, classic.y + 21);
    ctx.font = '12px Fredoka, sans-serif';
    ctx.fillText(classicActive ? 'Equipped ✓' : 'Tap to equip', classic.x + classic.w / 2, classic.y + 39);
    this.hitboxes.push(classic);

    let index = 0;
    for (const category of SHOP_CATEGORIES) {
      const items = UPGRADES.filter((u) => u.category === category);
      for (const upgrade of items) {
        const c = index % 3;
        const r = Math.floor(index / 3);
        const x = 95 + c * 260;
        const y = 130 + r * 100;
        this._drawCard(ctx, upgrade, x, y, 245, 88, economy);
        index += 1;
      }
    }

    if (this.confirm) {
      this._drawConfirm(ctx, this.confirm, economy);
    }

    ctx.fillStyle = '#6a4a28';
    ctx.font = '13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press O or Esc to close', 480, 572);
  }

  _drawCard(ctx, upgrade, x, y, w, h, economy) {
    const owned = economy.has(upgrade.id);
    const canBuy = economy.canBuy(upgrade.id);
    const shine = canBuy && !owned;

    ctx.save();
    if (owned) {
      ctx.fillStyle = '#d8eadb';
      ctx.globalAlpha = 1;
    } else if (canBuy) {
      ctx.fillStyle = '#fff3c4';
    } else {
      ctx.fillStyle = '#c8c2b8';
      ctx.filter = 'grayscale(1)';
    }
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.filter = 'none';

    if (shine) {
      const pulse = 0.45 + Math.sin(this.time * 4) * 0.25;
      ctx.strokeStyle = `rgba(212, 160, 40, ${0.55 + pulse})`;
      ctx.lineWidth = 3 + pulse;
      roundRect(ctx, x, y, w, h, 10);
      ctx.stroke();
      // gold shimmer stripe
      const gx = x + ((this.time * 60) % (w + 40)) - 20;
      const grad = ctx.createLinearGradient(gx, y, gx + 40, y + h);
      grad.addColorStop(0, 'rgba(255,220,100,0)');
      grad.addColorStop(0.5, `rgba(255,215,80,${0.35 + pulse * 0.2})`);
      grad.addColorStop(1, 'rgba(255,220,100,0)');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, w, h, 10);
      ctx.fill();
    } else {
      ctx.strokeStyle = owned ? '#7aaa7a' : '#9a9080';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, h, 10);
      ctx.stroke();
    }

    ctx.fillStyle = owned || canBuy ? '#2b2118' : '#5a544c';
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.fillText(upgrade.name, x + 12, y + 24);
    ctx.font = '12px Fredoka, sans-serif';
    wrapCardText(ctx, upgrade.description, w - 24).slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, x + 12, y + 44 + i * 13);
    });
    ctx.font = 'bold 13px Fredoka, sans-serif';
    if (owned) {
      const equipped =
        upgrade.effect === 'cosmetic' &&
        ((upgrade.cosmetic === 'hat' && economy.cosmetics.hat) ||
          (upgrade.cosmetic === 'glasses' && economy.cosmetics.glasses));
      ctx.fillStyle = COLORS.mint;
      ctx.fillText(
        upgrade.effect === 'cosmetic'
          ? equipped
            ? 'Owned · Equipped (tap to toggle)'
            : 'Owned · Tap to equip'
          : 'Owned ✓',
        x + 12,
        y + 80,
      );
    } else {
      ctx.fillStyle = canBuy ? '#b8860b' : '#666';
      ctx.fillText(canBuy ? `$${upgrade.price} · Tap to buy` : `$${upgrade.price} · Need more coins`, x + 12, y + 80);
    }
    ctx.restore();

    this.hitboxes.push({ x, y, w, h, id: upgrade.id, kind: 'card' });
  }

  _drawConfirm(ctx, upgrade, economy) {
    ctx.fillStyle = 'rgba(20,12,8,0.45)';
    ctx.fillRect(0, 0, 960, 640);
    const x = 260;
    const y = 210;
    const w = 440;
    const h = 200;
    ctx.fillStyle = '#fff8e7';
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = '#d4a028';
    ctx.lineWidth = 4;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();

    ctx.fillStyle = '#2b2118';
    ctx.font = 'bold 20px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Purchase this item?', 480, y + 48);
    ctx.font = '16px Fredoka, sans-serif';
    ctx.fillText(`${upgrade.name} for $${upgrade.price}?`, 480, y + 82);
    ctx.font = '13px Fredoka, sans-serif';
    ctx.fillStyle = '#6a4a28';
    ctx.fillText(upgrade.description, 480, y + 108);

    const by = y + 130;
    const yes = { x: 310, y: by, w: 140, h: 44, id: 'yes', kind: 'yes' };
    const no = { x: 510, y: by, w: 140, h: 44, id: 'no', kind: 'no' };
    ctx.fillStyle = economy.canBuy(upgrade.id) ? '#5fd39a' : '#aaa';
    roundRect(ctx, yes.x, yes.y, yes.w, yes.h, 10);
    ctx.fill();
    ctx.fillStyle = '#e85d75';
    roundRect(ctx, no.x, no.y, no.w, no.h, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Fredoka, sans-serif';
    ctx.fillText('Yes', yes.x + yes.w / 2, yes.y + 29);
    ctx.fillText('No', no.x + no.w / 2, no.y + 29);
    this.hitboxes.push(yes, no);
  }
}

function inside(mx, my, box) {
  return mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h;
}

function wrapCardText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
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
