import { COLORS } from '../config.js';
import { displayOrderText } from '../data/dialogue.js';
import { getIngredient, INGREDIENTS } from '../data/ingredients.js';
import { recipeIngredientLabels } from '../data/recipes.js';
import { roundRect } from './canvas/drawUtils.js';

export class HUD {
  constructor() {
    /** @type {{text:string, timer:number}[]} */
    this.toasts = [];
    this.showTitle = true;
    this.guide = '';
    /** Case picker open (click pastry case while guests wait). */
    this.casePickerOpen = false;
    /** @type {{x:number,y:number,w:number,h:number,type:string,payload?:any}[]} */
    this.hitZones = [];
    /** @type {{x:number,y:number,w:number,h:number,type:string,payload?:any}[]} */
    this.menuZones = [];
  }

  toast(text, duration = 3.2) {
    this.toasts.push({ text, timer: duration });
  }

  setGuide(text) {
    this.guide = text;
  }

  dismissTitle() {
    this.showTitle = false;
  }

  update(dt) {
    for (const t of this.toasts) t.timer -= dt;
    this.toasts = this.toasts.filter((t) => t.timer > 0);
  }

  /**
   * Rebuild clickable zones BEFORE input (same layout as draw).
   * @param {object} state
   */
  rebuildHitZones(state) {
    this.hitZones = [];
    if (this.showTitle) return;
    const { cooking, pastryStock, debugMode = true, pinnedRecipe, activeOrder } = state;

    if (debugMode) {
      this.hitZones.push({ x: 200, y: 10, w: 88, h: 28, type: 'free_money' });
    }

    if (cooking?.bowls) {
      cooking.bowls.forEach((_bowl, i) => {
        const x = 26 + i * 130;
        const y = 538;
        this.hitZones.push({
          x, y, w: 120, h: 52, type: 'select_bowl', payload: cooking.bowls[i].id,
        });
      });
      this.hitZones.push({ x: 420, y: 548, w: 100, h: 36, type: 'put_back' });
    }

    if (pinnedRecipe && !activeOrder) {
      this.hitZones.push({ x: 668, y: 300, w: 70, h: 24, type: 'unpin_recipe' });
    }

    if (this.casePickerOpen && pastryStock) {
      this.hitZones.push({ x: 0, y: 0, w: 960, h: 640, type: 'case_close' });
      const list = pastryStock.list();
      list.forEach((item, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 250 + col * 120;
        const y = 230 + row * 90;
        this.hitZones.push({ x, y, w: 100, h: 70, type: 'case_serve', payload: item.id });
      });
      this.hitZones.push({ x: 400, y: 410, w: 160, h: 36, type: 'case_close' });
    }
  }

  /**
   * @param {number} mx
   * @param {number} my
   */
  hitTest(mx, my) {
    for (let i = this.hitZones.length - 1; i >= 0; i -= 1) {
      const z = this.hitZones[i];
      if (mx >= z.x && mx <= z.x + z.w && my >= z.y && my <= z.y + z.h) {
        return z;
      }
    }
    return null;
  }

  menuHitTest(mx, my) {
    for (let i = this.menuZones.length - 1; i >= 0; i -= 1) {
      const z = this.menuZones[i];
      if (mx >= z.x && mx <= z.x + z.w && my >= z.y && my <= z.y + z.h) {
        return z;
      }
    }
    return null;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} state
   */
  draw(ctx, state) {
    this.rebuildHitZones(state);
    const {
      day, money, stars, muted, mouseFollow, paused,
      dayTimeLeft, phase, cooking, activeOrder, activeCustomerName, nextHint, inventory, economy,
      heldPlate, dirtyDishCount = 0, pastryStock, debugMode = true,
      seatCount = 6, helpers = [], talkTarget = null,
      tableDishCount = 0, dishCarryMax = 4,
      pinnedRecipe = null, difficulty = 'cozy',
    } = state;

    ctx.fillStyle = 'rgba(43, 33, 24, 0.88)';
    ctx.fillRect(0, 0, 960, 48);

    ctx.fillStyle = COLORS.butter;
    ctx.font = 'bold 22px Fredoka, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Day ${day}`, 14, 32);

    ctx.fillStyle = COLORS.cream;
    ctx.fillText(`$${money}`, 110, 32);

    if (debugMode && !this.showTitle) {
      this._paintButton(ctx, 200, 10, 88, 28, '+$100', COLORS.mint);
    }

    const starStr = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
    ctx.fillStyle = COLORS.butter;
    ctx.font = 'bold 20px Fredoka, sans-serif';
    ctx.fillText(starStr, debugMode ? 300 : 190, 32);

    const mins = Math.floor(Math.max(0, dayTimeLeft) / 60);
    const secs = Math.floor(Math.max(0, dayTimeLeft) % 60);
    ctx.fillStyle = COLORS.cream;
    ctx.font = 'bold 18px Fredoka, sans-serif';
    ctx.fillText(`⏱ ${mins}:${secs.toString().padStart(2, '0')}  ${phase}`, 420, 32);

    ctx.textAlign = 'right';
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.fillStyle = muted ? COLORS.berry : COLORS.cream;
    ctx.fillText(muted ? '🔇 M' : '🔊 M', 860, 32);
    ctx.fillStyle = paused ? COLORS.butter : COLORS.cream;
    ctx.fillText(paused ? '⏸ MENU' : '📒 B · Menu P', 946, 32);

    const guide = nextHint || this.guide;
    if (guide && !this.showTitle) {
      ctx.fillStyle = 'rgba(43,33,24,0.88)';
      roundRect(ctx, 60, 56, 840, 48, 12);
      ctx.fill();
      ctx.fillStyle = COLORS.butter;
      ctx.font = 'bold 20px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(guide, 480, 88);
    }

    // Active customer order takes the side panel; otherwise show pinned recipe.
    if (activeOrder && !this.showTitle) {
      const r = activeOrder;
      ctx.fillStyle = 'rgba(255,248,231,0.96)';
      ctx.strokeStyle = COLORS.butter;
      ctx.lineWidth = 3;
      roundRect(ctx, 668, 116, 276, 200, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.berry;
      ctx.font = 'bold 16px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(activeCustomerName ? `${activeCustomerName} wants` : 'THEY WANT', 684, 144);
      ctx.fillStyle = COLORS.ink;
      ctx.font = 'bold 26px Fredoka, sans-serif';
      ctx.fillText(displayOrderText(r), 684, 176);
      ctx.font = 'bold 15px Fredoka, sans-serif';
      ctx.fillStyle = '#5a4030';
      recipeIngredientLabels(r).forEach((line, i) => {
        ctx.fillText(line, 684, 204 + i * 20);
      });
      ctx.fillStyle = '#6a4a28';
      ctx.font = 'bold 14px Fredoka, sans-serif';
      ctx.fillText(`Bake ${r.bakeTime}s · stock · serve`, 684, 300);
    } else if (pinnedRecipe && !this.showTitle) {
      const r = pinnedRecipe;
      ctx.fillStyle = 'rgba(255,248,231,0.96)';
      ctx.strokeStyle = COLORS.mint;
      ctx.lineWidth = 3;
      roundRect(ctx, 668, 116, 276, 210, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.mint;
      ctx.font = 'bold 14px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('PINNED RECIPE', 684, 140);
      ctx.fillStyle = COLORS.ink;
      ctx.font = 'bold 24px Fredoka, sans-serif';
      ctx.fillText(displayOrderText(r), 684, 172);
      ctx.font = 'bold 15px Fredoka, sans-serif';
      ctx.fillStyle = '#5a4030';
      recipeIngredientLabels(r).forEach((line, i) => {
        ctx.fillText(line, 684, 200 + i * 20);
      });
      this._paintButton(ctx, 668, 300, 70, 24, 'Unpin', COLORS.berry);
    }

    if (cooking?.bowls && !this.showTitle) {
      ctx.fillStyle = 'rgba(43,33,24,0.88)';
      roundRect(ctx, 14, 500, 520, 126, 12);
      ctx.fill();
      ctx.fillStyle = COLORS.cream;
      ctx.font = 'bold 15px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Mixing bowls (auto-dough when recipe matches)', 26, 524);
      cooking.bowls.forEach((bowl, i) => {
        const x = 26 + i * 130;
        const y = 538;
        const active = cooking.activeBowlId === bowl.id;
        ctx.fillStyle = active ? 'rgba(255,201,74,0.35)' : 'rgba(255,246,224,0.12)';
        roundRect(ctx, x, y, 120, 52, 8);
        ctx.fill();
        ctx.fillStyle = COLORS.cream;
        ctx.font = 'bold 13px Fredoka, sans-serif';
        ctx.fillText(bowl.label, x + 8, y + 18);
        if (bowl.hasDough) {
          ctx.font = 'bold 16px Fredoka, sans-serif';
          ctx.fillText(`${bowl.dough.recipe.emoji} READY`, x + 8, y + 42);
        } else {
          ctx.font = '18px serif';
          bowl.ingredients.slice(0, 5).forEach((id, j) => {
            ctx.fillText(getIngredient(id)?.emoji || '?', x + 8 + j * 20, y + 44);
          });
          if (!bowl.ingredients.length) {
            ctx.font = '12px Fredoka, sans-serif';
            ctx.fillStyle = 'rgba(255,246,224,0.6)';
            ctx.fillText('empty', x + 8, y + 42);
          }
        }
      });
      this._paintButton(ctx, 420, 548, 100, 36, 'Put Back', COLORS.berry);
    }

    // Compact stock strip — emoji + count only
    if (inventory && !this.showTitle) {
      const ids = Object.keys(INGREDIENTS).filter((id) => id !== 'onion' && id !== 'spicy');
      ctx.fillStyle = 'rgba(43,33,24,.82)';
      roundRect(ctx, 12, 112, 140, 168, 10);
      ctx.fill();
      ctx.fillStyle = COLORS.cream;
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px Fredoka, sans-serif';
      ctx.fillText('Stock', 22, 130);
      ids.forEach((id, index) => {
        const ing = getIngredient(id);
        const qty = inventory.get(id);
        const x = 22 + (index % 2) * 62;
        const y = 148 + Math.floor(index / 2) * 22;
        if (y > 268) return;
        ctx.fillStyle = qty.current === 0 ? COLORS.berry : COLORS.cream;
        ctx.font = 'bold 12px Fredoka, sans-serif';
        ctx.fillText(`${ing?.emoji ?? ''} ${qty.current}`, x, y);
      });
    }

    if (economy && !this.showTitle) {
      ctx.fillStyle = 'rgba(255,248,231,.96)';
      const helperHeight = helpers.length ? 30 + helpers.length * 18 : 0;
      roundRect(ctx, 678, 340, 260, 64 + helperHeight, 10);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px Fredoka, sans-serif';
      ctx.fillText(`Ambience ${economy.ambience}  •  Seats ${seatCount}`, 692, 366);
      if (pastryStock) {
        ctx.fillStyle = '#6a4a28';
        ctx.fillText(`Pastry case ${pastryStock.total()}/${pastryStock.capacity}`, 692, 388);
      }
      if (helpers.length) {
        ctx.fillStyle = COLORS.mint;
        ctx.font = 'bold 13px Fredoka, sans-serif';
        ctx.fillText('Helpers on the bakery floor:', 692, 414);
        ctx.fillStyle = '#5a4030';
        ctx.font = '12px Fredoka, sans-serif';
        helpers.forEach((helper, i) => {
          ctx.fillText(`${helper.name}: ${helper.role}`, 692, 434 + i * 18);
        });
      }
    }

    if (talkTarget && !this.showTitle) {
      ctx.fillStyle = 'rgba(43,33,24,.94)';
      roundRect(ctx, 286, 444, 388, 42, 12);
      ctx.fill();
      ctx.fillStyle = COLORS.butter;
      ctx.font = 'bold 17px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`💬 Press E to talk to ${talkTarget.name} · or click them`, 480, 471);
    }

    if (heldPlate && !this.showTitle) {
      ctx.fillStyle = COLORS.mint;
      ctx.font = 'bold 18px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `Carrying: ${heldPlate.recipe.emoji} ${heldPlate.recipe.name} → take to CASE`,
        14,
        108,
      );
    }
    if (!this.showTitle && (dirtyDishCount || tableDishCount)) {
      const panelY = 404;
      ctx.fillStyle = 'rgba(43,33,24,.88)';
      roundRect(ctx, 12, panelY, 232, 62, 10);
      ctx.fill();
      ctx.fillStyle = '#b8f0ff';
      ctx.font = 'bold 14px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        `Carrying dishes ${dirtyDishCount}/${dishCarryMax}`,
        24,
        panelY + 22,
      );
      for (let i = 0; i < dishCarryMax; i += 1) {
        const sx = 24 + i * 26;
        const filled = i < dirtyDishCount;
        ctx.fillStyle = filled ? '#cfefff' : 'rgba(255,246,224,0.18)';
        roundRect(ctx, sx, panelY + 30, 22, 22, 6);
        ctx.fill();
        if (filled) {
          ctx.font = '14px serif';
          ctx.textAlign = 'center';
          ctx.fillText('🍽️', sx + 11, panelY + 46);
          ctx.textAlign = 'left';
        }
      }
      ctx.fillStyle = tableDishCount ? COLORS.berry : COLORS.mint;
      ctx.font = 'bold 12px Fredoka, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        tableDishCount ? `${tableDishCount} on tables` : 'tables clear',
        232,
        panelY + 46,
      );
      ctx.textAlign = 'left';
    }

    if (this.casePickerOpen && pastryStock && !this.showTitle) {
      const list = pastryStock.list();
      ctx.fillStyle = 'rgba(20,12,8,0.45)';
      ctx.fillRect(0, 0, 960, 640);
      ctx.fillStyle = 'rgba(255,248,231,0.98)';
      roundRect(ctx, 220, 140, 520, 320, 16);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.font = 'bold 24px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pastry Case — tap a treat to serve', 480, 180);
      ctx.font = '15px Fredoka, sans-serif';
      ctx.fillStyle = '#6a4a28';
      ctx.fillText('Sends it on the conveyor to a waiting friend', 480, 208);
      if (!list.length) {
        ctx.fillText('Case is empty — bake & carry treats here first!', 480, 280);
      } else {
        list.forEach((item, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const x = 250 + col * 120;
          const y = 230 + row * 90;
          ctx.fillStyle = 'rgba(255,201,74,0.35)';
          roundRect(ctx, x, y, 100, 70, 10);
          ctx.fill();
          ctx.font = '28px serif';
          ctx.fillText(item.recipe?.emoji || '?', x + 50, y + 36);
          ctx.fillStyle = COLORS.ink;
          ctx.font = 'bold 13px Fredoka, sans-serif';
          ctx.fillText(`×${item.n}`, x + 50, y + 58);
        });
      }
      this._paintButton(ctx, 400, 410, 160, 36, 'Close', '#c8935b');
    }

    if (mouseFollow && !this.showTitle) {
      ctx.fillStyle = COLORS.mint;
      ctx.font = 'bold 14px Fredoka, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Follow ON (F)', 946, 112);
    }

    let ty = 116;
    for (const t of this.toasts) {
      const alpha = Math.min(1, t.timer);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px Fredoka, sans-serif';
      const tw = Math.min(760, ctx.measureText(t.text).width + 36);
      ctx.fillStyle = 'rgba(43,33,24,0.92)';
      roundRect(ctx, 480 - tw / 2, ty, tw, 40, 10);
      ctx.fill();
      ctx.fillStyle = COLORS.cream;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, 480, ty + 27);
      ctx.globalAlpha = 1;
      ty += 46;
    }

    if (paused && !this.showTitle) {
      this._drawMenu(ctx, {
        muted,
        difficulty,
        controlMode: state.controlMode || 'follow',
      });
    }

    if (this.showTitle) {
      ctx.fillStyle = 'rgba(42, 31, 24, 0.72)';
      ctx.fillRect(0, 0, 960, 640);
      ctx.fillStyle = COLORS.butter;
      ctx.font = 'bold 58px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('The Bear Bakery', 480, 220);
      ctx.fillStyle = COLORS.cream;
      ctx.font = '22px Fredoka, sans-serif';
      ctx.fillText('Chat with friends, bake simple treats, serve with a smile!', 480, 270);
      ctx.fillStyle = COLORS.mint;
      ctx.font = 'bold 26px Fredoka, sans-serif';
      ctx.fillText('Click to start prep', 480, 340);
      ctx.fillStyle = 'rgba(255,246,224,0.95)';
      ctx.font = '18px Fredoka, sans-serif';
      ctx.fillText('1 Cozy · 2 Balanced · 3 Busy — progress is saved!', 480, 400);
      ctx.fillText('WASD / mouse follow · E use/talk · Click animals · O shop', 480, 434);
    }
  }

  _drawMenu(ctx, { muted, difficulty, controlMode = 'follow' }) {
    this.menuZones = [];
    ctx.fillStyle = 'rgba(20,12,8,0.55)';
    ctx.fillRect(0, 0, 960, 640);
    ctx.fillStyle = 'rgba(255,248,231,0.98)';
    roundRect(ctx, 250, 40, 460, 560, 18);
    ctx.fill();
    ctx.strokeStyle = COLORS.butter;
    ctx.lineWidth = 4;
    roundRect(ctx, 250, 40, 460, 560, 18);
    ctx.stroke();

    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 34px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Menu', 480, 85);

    const buttons = [
      { y: 105, label: 'Continue', type: 'menu_continue', color: COLORS.mint },
      { y: 150, label: 'Save Now', type: 'menu_save', color: COLORS.butter },
      { y: 195, label: 'Download Save File', type: 'menu_download_save', color: '#c8935b' },
      { y: 240, label: 'Load Save File', type: 'menu_load_save', color: '#c8935b' },
      { y: 285, label: 'Skip to Next Day', type: 'menu_skip_day', color: '#a87850' },
      { y: 330, label: muted ? 'Unmute Music' : 'Mute Music', type: 'menu_mute', color: COLORS.berry },
    ];
    for (const b of buttons) {
      this._paintButton(ctx, 320, b.y, 320, 36, b.label, b.color);
      this.menuZones.push({ x: 320, y: b.y, w: 320, h: 36, type: b.type });
    }

    ctx.fillStyle = '#6a4a28';
    ctx.font = 'bold 15px Fredoka, sans-serif';
    ctx.fillText('Controls', 480, 390);
    const modes = [
      { id: 'classic', label: 'Classic WASD+E', x: 290 },
      { id: 'follow', label: 'Mouse Follow', x: 490 },
    ];
    for (const m of modes) {
      const active = controlMode === m.id;
      this._paintButton(ctx, m.x, 405, 180, 34, m.label, active ? COLORS.mint : '#e0c090');
      this.menuZones.push({
        x: m.x, y: 405, w: 180, h: 34, type: 'menu_controls', payload: m.id,
      });
    }

    ctx.fillStyle = '#6a4a28';
    ctx.font = 'bold 15px Fredoka, sans-serif';
    ctx.fillText('Difficulty (next day)', 480, 470);
    const diffs = [
      { id: 'cozy', label: 'Cozy', x: 290 },
      { id: 'balanced', label: 'Balanced', x: 420 },
      { id: 'busy', label: 'Busy', x: 560 },
    ];
    for (const d of diffs) {
      const active = difficulty === d.id;
      this._paintButton(ctx, d.x, 485, 100, 34, d.label, active ? COLORS.mint : '#e0c090');
      this.menuZones.push({
        x: d.x, y: 485, w: 100, h: 34, type: 'menu_difficulty', payload: d.id,
      });
    }

    ctx.fillStyle = '#8a7360';
    ctx.font = '13px Fredoka, sans-serif';
    ctx.fillText('Tap / E use · Drag to move · Pin recipes in Study Book (B) · P closes menu', 480, 560);
  }

  _paintButton(ctx, x, y, w, h, label, color) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 5);
  }
}
