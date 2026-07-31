import { COLORS } from '../config.js';
import { CUSTOMER_SPECIES } from '../data/species.js';
import { RECIPES, recipeIngredientLabels } from '../data/recipes.js';
import { BIO_TEMPLATES, FRIEND_NAMES } from '../data/bios.js';
import { getIngredient } from '../data/ingredients.js';
import { drawCharacterArt } from '../entities/CharacterArt.js';
import { resolveDirectionImage } from '../entities/Facing.js';

/**
 * Bakery study book — recipes + character profiles (press B).
 */
export class StudyBook {
  constructor() {
    this.open = false;
    /** @type {'recipes'|'characters'} */
    this.tab = 'recipes';
    this.page = 0;
  }

  toggle() {
    this.open = !this.open;
    if (this.open) this.page = 0;
    return this.open;
  }

  close() {
    this.open = false;
  }

  setTab(tab) {
    this.tab = tab;
    this.page = 0;
  }

  nextPage() {
    const max = this._maxPage();
    this.page = Math.min(max, this.page + 1);
  }

  prevPage() {
    this.page = Math.max(0, this.page - 1);
  }

  _maxPage() {
    if (this.tab === 'recipes') return Math.max(0, Object.keys(RECIPES).length - 1);
    return Math.max(0, CUSTOMER_SPECIES.length - 1);
  }

  /**
   * @param {import('../engine/Input.js').Input} input
   */
  handleInput(input) {
    if (!this.open) return;
    if (input.justPressed('arrowright') || input.justPressed('d')) this.nextPage();
    if (input.justPressed('arrowleft') || input.justPressed('a')) this.prevPage();
    if (input.justPressed('1')) this.setTab('recipes');
    if (input.justPressed('2')) this.setTab('characters');
    if (input.justPressed('escape') || input.justPressed('b')) this.close();
  }

  /**
   * Hit-test UI buttons (screen space).
   * @returns {false|{type:string,recipeId?:string}|true}
   */
  click(sx, sy) {
    if (!this.open) return false;
    // tabs
    if (sy >= 86 && sy <= 118) {
      if (sx >= 140 && sx <= 280) {
        this.setTab('recipes');
        return true;
      }
      if (sx >= 290 && sx <= 460) {
        this.setTab('characters');
        return true;
      }
    }
    // Pin recipe button
    if (this.tab === 'recipes' && sy >= 468 && sy <= 504 && sx >= 520 && sx <= 720) {
      const list = Object.values(RECIPES);
      const r = list[this.page];
      if (r) return { type: 'pin_recipe', recipeId: r.id };
    }
    // nav
    if (sy >= 560 && sy <= 592) {
      if (sx >= 160 && sx <= 260) {
        this.prevPage();
        return true;
      }
      if (sx >= 700 && sx <= 800) {
        this.nextPage();
        return true;
      }
      if (sx >= 420 && sx <= 540) {
        this.close();
        return true;
      }
    }
    return true; // consume clicks while open
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../engine/AssetLoader.js').AssetLoader} assets
   */
  draw(ctx, assets) {
    if (!this.open) return;

    ctx.fillStyle = 'rgba(30, 18, 12, 0.62)';
    ctx.fillRect(0, 0, 960, 640);

    // Book body
    roundRect(ctx, 80, 60, 800, 520, 18);
    ctx.fillStyle = '#f7e2b8';
    ctx.fill();
    ctx.strokeStyle = '#c4893a';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Spine shade
    ctx.fillStyle = 'rgba(180, 120, 50, 0.25)';
    ctx.fillRect(470, 60, 20, 520);

    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 28px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📒 Bakery Study Book', 480, 100);

    // Tabs
    drawTab(ctx, 140, 112, 140, 32, 'Recipes (1)', this.tab === 'recipes');
    drawTab(ctx, 290, 112, 170, 32, 'Characters (2)', this.tab === 'characters');

    if (this.tab === 'recipes') this._drawRecipePage(ctx);
    else this._drawCharacterPage(ctx, assets);

    // Footer nav
    drawBtn(ctx, 160, 560, 100, 32, '◀ Prev');
    drawBtn(ctx, 420, 560, 120, 32, 'Close (B)');
    drawBtn(ctx, 700, 560, 100, 32, 'Next ▶');

    ctx.fillStyle = '#6a4a28';
    ctx.font = '13px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${this.page + 1} / ${this._maxPage() + 1}   ·   Study before the rush!`, 480, 548);
  }

  _drawRecipePage(ctx) {
    const list = Object.values(RECIPES);
    const r = list[this.page];
    if (!r) return;

    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 26px Fredoka, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${r.emoji}  ${r.name}`, 130, 180);

    ctx.font = '16px Fredoka, sans-serif';
    ctx.fillStyle = '#6a4a28';
    ctx.fillText(`Price when served: $${r.price}   ·   Oven time: ${r.bakeTime}s`, 130, 210);

    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 18px Fredoka, sans-serif';
    ctx.fillText('Ingredients to gather:', 130, 250);

    r.ingredients.forEach((id, i) => {
      const ing = getIngredient(id);
      const col = i % 2 === 0 ? '#fff8e7' : '#ffe8c8';
      ctx.fillStyle = col;
      roundRect(ctx, 130, 270 + i * 42, 360, 36, 8);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.font = '18px Fredoka, sans-serif';
      ctx.fillText(`${ing?.emoji || '?'}  ${ing?.name || id}`, 148, 294 + i * 42);
    });

    // Tip card
    ctx.fillStyle = '#d4f5e2';
    roundRect(ctx, 520, 250, 320, 200, 12);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.fillText('How to make it', 540, 280);
    ctx.font = '15px Fredoka, sans-serif';
    const steps = [
      '1. Pick up each ingredient',
      '2. They go in the Mixing Bowl',
      '3. Click bowl to combine',
      '4. Bake in the Oven',
      '5. Carry to case & serve',
      '',
      'Pin this recipe to keep it',
      'visible while you bake!',
    ];
    steps.forEach((line, i) => ctx.fillText(line, 540, 310 + i * 20));

    drawBtn(ctx, 520, 468, 200, 36, 'Pin to side');
  }

  _drawCharacterPage(ctx, assets) {
    const s = CUSTOMER_SPECIES[this.page];
    if (!s) return;
    const recipe = RECIPES[s.prefers];
    const bios = BIO_TEMPLATES[s.id] || [];
    const friends = FRIEND_NAMES[s.id] || [];

    // Full-body cute portrait
    ctx.fillStyle = 'rgba(255, 220, 180, 0.55)';
    ctx.beginPath();
    ctx.arc(200, 250, 62, 0, Math.PI * 2);
    ctx.fill();
    const key = s.spriteKey || s.id;
    const portrait = resolveDirectionImage(assets, key, 'front');
    drawCharacterArt(ctx, {
      id: s.id,
      x: 152,
      y: 198,
      size: 96,
      color: s.fallbackColor,
      accent: s.accent,
      facing: 1,
      time: performance.now() / 1000,
      walking: false,
      image: portrait.image,
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 28px Fredoka, sans-serif';
    ctx.fillText(s.label, 290, 210);
    ctx.font = '16px Fredoka, sans-serif';
    ctx.fillStyle = COLORS.berry;
    ctx.fillText(`Personality: ${s.personality}`, 290, 240);

    ctx.fillStyle = COLORS.mint;
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.fillText(`💚 Likes: ${s.likesText}`, 290, 275);
    ctx.fillStyle = COLORS.berry;
    ctx.fillText(`💔 Dislikes: ${s.dislikesText}`, 290, 300);

    ctx.fillStyle = COLORS.ink;
    ctx.font = '15px Fredoka, sans-serif';
    ctx.fillText(`Favorite order: ${recipe?.emoji || ''} ${recipe?.name || s.prefers}`, 290, 330);
    if (recipe) {
      ctx.fillStyle = '#6a4a28';
      ctx.font = '13px Fredoka, sans-serif';
      ctx.fillText(`Recipe: ${recipeIngredientLabels(recipe).join(' · ')}`, 290, 352);
    }

    // Bio box
    ctx.fillStyle = '#fff8e7';
    roundRect(ctx, 120, 380, 700, 70, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.fillText('Mini bios (randomized per visit):', 140, 404);
    ctx.font = '14px Fredoka, sans-serif';
    ctx.fillText(bios[0] || 'A lovely bakery friend.', 140, 428);

    // Friends
    ctx.fillStyle = '#e8f4ff';
    roundRect(ctx, 120, 460, 700, 70, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.fillText(`Friends who are also ${s.label}s:`, 140, 484);
    ctx.font = '15px Fredoka, sans-serif';
    ctx.fillText(friends.join(' · '), 140, 510);

    ctx.fillStyle = '#6a4a28';
    ctx.font = '12px Fredoka, sans-serif';
    ctx.fillText('Each visit rolls a random name + bio + 1–3 friends of the same species.', 140, 545);
  }
}

function drawTab(ctx, x, y, w, h, label, active) {
  ctx.fillStyle = active ? '#fff6e0' : '#e0c090';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = active ? COLORS.butter : '#b8843a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.font = 'bold 14px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 21);
}

function drawBtn(ctx, x, y, w, h, label) {
  ctx.fillStyle = COLORS.mint;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = COLORS.ink;
  ctx.font = 'bold 14px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 21);
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
