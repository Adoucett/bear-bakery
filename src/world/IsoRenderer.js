import { isoDiamond, isoDepth, worldToIso } from './IsoMath.js';
import { PATISSERIE, tableDefinitions } from './RestaurantLayout.js';
import { getIngredient } from '../data/ingredients.js';
import { drawCharacterArt } from '../entities/CharacterArt.js';
import { poseFromState, resolveDirectionImage } from '../entities/Facing.js';
import { getSpecies } from '../data/species.js';
import { COLORS } from '../config.js';

/** fixture.kind / decor.kind → ASSET_MANIFEST image key */
const FURNITURE_KEYS = {
  oven: 'oven',
  display: 'display',
  register: 'register',
  table: 'table',
  sink: 'sink',
  dishwasher: 'sink',
  toilet: 'toilet',
  pantry: 'pantry',
  shop: 'shop',
  bookcase: 'bookcase',
  safe: 'safe',
  citrusTree: 'citrusTree',
  sofa: 'sofa',
  plant: 'plant',
  mixingBowl: 'mixingBowl',
  ingredientBowl: 'ingredientBowl',
  open_sign: 'open_sign',
  serve: null,
};

/** Feet / sort key at bottom of world AABB (or character soles). */
function feetY(item) {
  if (item.layer === 'character') return item.character.y + item.character.size;
  return (item.y || 0) + (item.h || 0);
}

export class IsoRenderer {
  constructor() {
    this.time = 0;
    /** @type {import('../engine/AssetLoader.js').AssetLoader|null} */
    this.assets = null;
  }

  /** @param {import('../engine/AssetLoader.js').AssetLoader} assets */
  setAssets(assets) {
    this.assets = assets;
  }

  update(dt) {
    this.time += dt;
  }

  draw(ctx, camera, inventory, cooking, economy, characters, tickets, extras = {}) {
    const {
      foodTrays = [],
      dirtyPlates = [],
      pastryStock = null,
      assets = null,
      highlightId = null,
      hoverId = null,
      helpers = [],
      fixtures = PATISSERIE.fixtures,
      decor = PATISSERIE.decor,
      phase = 'PREP',
    } = extras;
    if (assets) this.assets = assets;
    ctx.fillStyle = '#ebe4d8';
    ctx.fillRect(0, 0, 960, 640);

    for (const room of PATISSERIE.rooms) this.drawRoom(ctx, room, camera);
    this.drawWalls(ctx, camera);
    for (const door of PATISSERIE.doors) this.drawDoor(ctx, door, camera, phase);

    const layers = [
      ...decor.map((item) => ({ ...item, layer: 'decor' })),
      ...tableDefinitions(economy.extraTables || 0).map((item) => ({
        ...item, kind: 'table', layer: 'table',
      })),
      ...fixtures.map((item) => ({ ...item, layer: 'fixture' })),
      // Live helper actors carry their current position and chore status.
      ...helpers.map((helper) => ({
        ...helper, w: 36, h: 36, layer: 'helper',
      })),
      ...characters.map((character) => ({
        character,
        layer: 'character',
        x: character.x,
        y: character.y,
        w: character.size,
        h: character.size,
      })),
    ].sort((a, b) => isoDepth(a.x || 0, feetY(a)) - isoDepth(b.x || 0, feetY(b)));

    for (const item of layers) {
      if (item.layer === 'character') this.drawCharacter(ctx, item.character, camera);
      else if (item.layer === 'helper') this.drawHelper(ctx, item, camera);
      else if (item.layer === 'fixture') {
        this.drawFixture(ctx, item, camera, inventory, cooking, economy, pastryStock, {
          highlightId,
          hoverId,
          phase,
        });
      } else if (item.kind === 'table') this.drawTable(ctx, item, camera);
      else this.drawDecor(ctx, item, camera);
    }
    this.drawClickTargets(ctx, characters, camera);
    this.drawDirtyPlates(ctx, dirtyPlates, camera);
    this.drawFoodTrays(ctx, foodTrays, camera);
    this.drawTickets(ctx, tickets, camera);
    this.drawIngredientLabels(ctx, camera, inventory, highlightId, hoverId, fixtures);
  }

  /**
   * Feet-anchored furniture PNG. Kept modest so stations stay readable.
   */
  drawFurnitureSprite(ctx, kind, p, fixture, camera) {
    const key = FURNITURE_KEYS[kind] ?? kind;
    if (!key || !this.assets) return false;
    const img = this.assets.get(key) || this.assets.get(`furniture_${key}`);
    if (!img) return false;

    const z = camera.zoom;
    const iw = /** @type {HTMLImageElement} */ (img).naturalWidth
      || /** @type {HTMLImageElement} */ (img).width || 1;
    const ih = /** @type {HTMLImageElement} */ (img).naturalHeight
      || /** @type {HTMLImageElement} */ (img).height || 1;
    const aspect = iw / ih;
    // Slightly larger draw so furniture reads clearly on big screens
    const targetH = Math.max(28, (fixture.h || 48) * 1.18) * z;
    let drawH = targetH;
    let drawW = drawH * aspect;
    const maxW = Math.max(36, (fixture.w || 60) * 1.28) * z;
    if (drawW > maxW) {
      drawW = maxW;
      drawH = drawW / aspect;
    }
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(/** @type {CanvasImageSource} */ (img), p.x - drawW / 2, p.y - drawH, drawW, drawH);
    return true;
  }

  /** Screen point at the feet (bottom-center) of a world AABB. */
  feetPoint(x, y, w, h, camera) {
    return worldToIso(x + w / 2, y + h, camera);
  }

  drawClickTargets(ctx, characters, camera) {
    for (const character of characters) {
      if (!character?.target) continue;
      const p = worldToIso(character.target.x, character.target.y, camera);
      const pulse = 12 + Math.sin(this.time * 6) * 2;
      ctx.fillStyle = 'rgba(95, 211, 154, 0.55)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5fd39a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawHelper(ctx, helper, camera) {
    const species = getSpecies(helper.speciesId);
    const p = worldToIso(helper.x, helper.y + 30, camera);
    const size = 34 * camera.zoom;
    const dir = helper.facing === -1 ? 'left' : 'side';
    const resolved = resolveDirectionImage(
      this.assets,
      helper.spriteKey,
      helper.walking ? dir : 'front',
    );
    drawCharacterArt(ctx, {
      id: helper.speciesId,
      x: p.x - size / 2,
      y: p.y - size,
      size,
      color: species.fallbackColor,
      accent: species.accent,
      facing: resolved.flip ? -1 : 1,
      time: this.time,
      walking: !!helper.walking,
      image: resolved.image,
    });

    if (helper.carryingTreat) {
      ctx.font = `${Math.max(12, 13 * camera.zoom)}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(helper.carryingTreat, p.x + size * 0.45, p.y - size * 0.5);
    } else if (helper.carrying > 0) {
      ctx.font = `${Math.max(12, 13 * camera.zoom)}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🍽️', p.x + size * 0.45, p.y - size * 0.5);
    }

    // Name plus what they are doing right now, so hires are never mysterious.
    const label = helper.status ? `★ ${helper.name} · ${helper.status}` : `★ ${helper.name}`;
    ctx.font = `bold ${Math.max(10, 10 * camera.zoom)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    const width = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(43,33,24,.9)';
    ctx.fillRect(p.x - width / 2, p.y - size - 19, width, 16);
    ctx.fillStyle = '#fff6e0';
    ctx.fillText(label, p.x, p.y - size - 7);
  }

  drawDirtyPlates(ctx, plates, camera) {
    for (const plate of plates) {
      const p = worldToIso(plate.x, plate.y, camera);
      const z = camera.zoom;
      ctx.fillStyle = '#e8e0d4';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 14 * z, 6 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a89070';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,70,40,.55)';
      ctx.beginPath();
      ctx.arc(p.x - 4 * z, p.y - 1 * z, 2 * z, 0, Math.PI * 2);
      ctx.arc(p.x + 3 * z, p.y + 1 * z, 1.5 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(80,40,20,.8)';
      ctx.font = `bold ${9 * z}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('pick up!', p.x, p.y + 14 * z);
    }
  }

  drawFoodTrays(ctx, trays, camera) {
    for (const tray of trays) {
      const p = worldToIso(tray.x, tray.y, camera);
      const z = camera.zoom;
      const queued = tray.queued;
      ctx.globalAlpha = queued ? 0.85 : 1;
      ctx.fillStyle = queued ? '#c4b090' : '#d8c4a0';
      ctx.fillRect(p.x - 20 * z, p.y - 8 * z, 40 * z, 12 * z);
      ctx.fillStyle = '#f5f0e6';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 6 * z, 12 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = queued ? '#a88850' : '#d4a028';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = `${15 * z}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText(tray.plate?.recipe?.emoji || '🍰', p.x, p.y - 2 * z);
      if (!queued) {
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.beginPath();
        ctx.moveTo(p.x + 8 * z, p.y - 14 * z);
        ctx.quadraticCurveTo(p.x + 12 * z, p.y - 20 * z, p.x + 8 * z, p.y - 26 * z);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  drawRoom(ctx, room, camera) {
    isoDiamond(ctx, room.x, room.y, room.w, room.h, camera);
    ctx.fillStyle = room.floor;
    ctx.fill();
    ctx.strokeStyle = room.id === 'kitchen' ? 'rgba(123,115,96,.22)' : 'rgba(109,82,54,.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Soft plank / tile guides (horizontal in world → readable oblique lines)
    for (let y = room.y + 28; y < room.y + room.h; y += 36) {
      const a = worldToIso(room.x + 8, y, camera);
      const b = worldToIso(room.x + room.w - 8, y, camera);
      ctx.strokeStyle = 'rgba(92,72,52,.08)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  drawWalls(ctx, camera) {
    for (const wall of PATISSERIE.walls) {
      isoDiamond(ctx, wall.x, wall.y, wall.w, wall.h, camera);
      ctx.fillStyle = '#f4f0e6';
      ctx.fill();
      ctx.strokeStyle = '#b8ae9c';
      ctx.lineWidth = 1.5 * camera.zoom;
      ctx.stroke();
    }
  }

  drawDoor(ctx, door, camera, phase = 'PREP') {
    const p = this.feetPoint(door.x, door.y, door.w, door.h, camera);
    const z = camera.zoom;
    const isFront = door.id === 'frontDoor';
    const tall = door.h >= door.w;
    const open = phase === 'SERVICE';

    if (isFront) {
      // Wood panel door with brass handle — ajar during service hours
      const panelW = 22 * z;
      const panelH = 46 * z;
      const swing = open ? -10 * z : 0;
      ctx.save();
      ctx.translate(p.x + swing, p.y - panelH);
      // Frame / jamb
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(-panelW / 2 - 3 * z, -2 * z, panelW + 6 * z, panelH + 4 * z);
      // Door panel
      ctx.fillStyle = '#a47145';
      ctx.fillRect(-panelW / 2, 0, panelW, panelH);
      ctx.strokeStyle = '#704527';
      ctx.lineWidth = 1.5 * z;
      ctx.strokeRect(-panelW / 2, 0, panelW, panelH);
      // Recessed panels
      ctx.strokeStyle = 'rgba(112,69,39,.55)';
      ctx.lineWidth = 1 * z;
      ctx.strokeRect(-panelW / 2 + 3 * z, 6 * z, panelW - 6 * z, panelH * 0.38);
      ctx.strokeRect(-panelW / 2 + 3 * z, panelH * 0.52, panelW - 6 * z, panelH * 0.38);
      // Brass handle
      ctx.fillStyle = '#e5b85b';
      ctx.beginPath();
      ctx.arc(panelW / 2 - 5 * z, panelH * 0.52, 2.5 * z, 0, Math.PI * 2);
      ctx.fill();
      // Glass window inset
      ctx.fillStyle = 'rgba(207,238,244,.65)';
      ctx.fillRect(-panelW / 2 + 5 * z, 8 * z, panelW - 10 * z, 10 * z);
      ctx.restore();
      if (open) {
        ctx.fillStyle = 'rgba(95,211,154,.25)';
        ctx.beginPath();
        ctx.moveTo(p.x - 8 * z, p.y);
        ctx.lineTo(p.x + 14 * z, p.y - panelH * 0.3);
        ctx.lineTo(p.x + 14 * z, p.y);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }

    const bw = tall ? 14 * z : 28 * z;
    const bh = tall ? 32 * z : 14 * z;
    ctx.fillStyle = '#8a5b3c';
    ctx.fillRect(p.x - bw / 2, p.y - bh, bw, bh);
    ctx.strokeStyle = '#5c3018';
    ctx.lineWidth = 1.5 * z;
    ctx.strokeRect(p.x - bw / 2, p.y - bh, bw, bh);
    ctx.fillStyle = '#e5b85b';
    ctx.beginPath();
    ctx.arc(p.x + (tall ? 3 * z : 0), p.y - bh * 0.45, 2 * z, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTable(ctx, table, camera) {
    const p = this.feetPoint(table.x, table.y, table.w, table.h, camera);
    if (this.drawFurnitureSprite(ctx, 'table', p, table, camera)) return;
    ctx.fillStyle = '#c58c56';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 10, 24, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a5b3c';
    ctx.fillRect(p.x - 3, p.y - 10, 6, 10);
    for (const x of [-28, 28]) {
      ctx.fillStyle = '#e5dfd5';
      ctx.fillRect(p.x + x - 7, p.y - 2, 14, 10);
    }
  }

  drawDecor(ctx, item, camera) {
    const p = this.feetPoint(item.x, item.y, item.w, item.h, camera);
    if (this.drawFurnitureSprite(ctx, item.kind, p, item, camera)) return;
    if (item.kind === 'citrusTree') {
      ctx.fillStyle = '#9a693d';
      ctx.fillRect(p.x - 3, p.y - 40, 6, 32);
      ctx.fillStyle = '#5f9e54';
      for (const [x, y] of [[0, -50], [-14, -36], [14, -36], [-6, -26], [8, -25]]) {
        ctx.beginPath();
        ctx.arc(p.x + x, p.y + y, 13, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f2b443';
      for (const [x, y] of [[-6, -40], [10, -32], [0, -52]]) {
        ctx.beginPath();
        ctx.arc(p.x + x, p.y + y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.kind === 'sofa') {
      ctx.fillStyle = '#d9dcc8';
      ctx.fillRect(p.x - 40, p.y - 22, 80, 18);
      ctx.fillStyle = '#bec3aa';
      ctx.fillRect(p.x - 40, p.y - 6, 80, 6);
    } else if (item.kind === 'chair') {
      const z = camera.zoom;
      ctx.fillStyle = '#c4893a';
      ctx.fillRect(p.x - 10 * z, p.y - 18 * z, 20 * z, 12 * z);
      ctx.fillStyle = '#a87850';
      ctx.fillRect(p.x - 10 * z, p.y - 28 * z, 4 * z, 12 * z);
      ctx.fillRect(p.x + 6 * z, p.y - 28 * z, 4 * z, 12 * z);
      ctx.fillStyle = '#e8c89a';
      ctx.fillRect(p.x - 9 * z, p.y - 20 * z, 18 * z, 5 * z);
    } else {
      ctx.fillStyle = '#b77c4f';
      ctx.fillRect(p.x - 6, p.y - 12, 12, 12);
      ctx.fillStyle = '#65a45c';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 20, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawIngredientLabels(ctx, camera, inventory, highlightId, hoverId, fixtures = PATISSERIE.fixtures) {
    for (const fixture of fixtures) {
      if (fixture.kind !== 'ingredientBowl') continue;
      const p = this.feetPoint(fixture.x, fixture.y, fixture.w, fixture.h, camera);
      const z = camera.zoom;
      const spriteH = Math.max(28, (fixture.h || 40) * 1.2) * z;
      drawIngredientBadge(
        ctx,
        p.x,
        p.y - spriteH - 8,
        getIngredient(fixture.ingredientId),
        inventory.get(fixture.ingredientId),
        z,
        fixture.id === highlightId || fixture.id === hoverId,
      );
    }
  }

  drawFixture(ctx, fixture, camera, inventory, cooking, economy, pastryStock = null, opts = {}) {
    const p = this.feetPoint(fixture.x, fixture.y, fixture.w, fixture.h, camera);
    const isOpenSign = fixture.id === 'openSign' || fixture.kind === 'openSign';
    const kind = isOpenSign ? 'open_sign' : fixture.kind;
    const drewSprite = kind !== 'serve' && !isOpenSign && fixture.kind !== 'conveyor'
      && this.drawFurnitureSprite(ctx, kind, p, fixture, camera);
    const z = camera.zoom;
    const spriteH = Math.max(28, (fixture.h || 40) * 1.2) * z;
    const showTip =
      fixture.id === opts.highlightId ||
      fixture.id === opts.hoverId;

    switch (fixture.kind) {
      case 'ingredientBowl': {
        if (!drewSprite) {
          const ingredient = getIngredient(fixture.ingredientId);
          ctx.fillStyle = '#e9ecef';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 8, 18, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = ingredient?.color ?? '#c9a77d';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 11, 13, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'oven': {
        const oven = cooking.getOven?.(fixture.id) ?? {
          state: cooking.ovenState,
          bakeTimer: cooking.bakeTimer,
        };
        if (!drewSprite) {
          ctx.fillStyle = '#59616a';
          ctx.fillRect(p.x - 30, p.y - 50, 60, 44);
          ctx.fillStyle = '#262c30';
          ctx.fillRect(p.x - 20, p.y - 38, 40, 22);
          const baking = oven.state === 'baking';
          ctx.fillStyle = baking ? '#f1893c' : oven.state === 'done' ? '#68c68b' : '#20252a';
          ctx.fillRect(p.x - 15, p.y - 32, 30, 14);
          ctx.fillStyle = '#d6d4cf';
          ctx.fillRect(p.x - 32, p.y - 5, 64, 8);
        }
        if (oven.state === 'baking') {
          drawTooltip(ctx, p.x, p.y - spriteH - 10, `${Math.ceil(oven.bakeTimer)}s`, z);
        } else if (oven.state === 'done') {
          drawTooltip(ctx, p.x, p.y - spriteH - 10, 'DONE!', z);
        } else if (showTip) {
          drawTooltip(ctx, p.x, p.y - spriteH - 10, fixture.label || 'Oven', z);
        }
        break;
      }
      case 'mixingBowl': {
        if (!drewSprite) {
          ctx.fillStyle = '#b6c4cc';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 12, 22, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#778891';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 14, 16, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        const bowl = cooking.getBowl?.(fixture.bowlId || fixture.id) || null;
        const active = cooking.activeBowlId === (fixture.bowlId || fixture.id);
        let tip = fixture.label?.replace('Mixing ', '') || 'Bowl';
        if (bowl?.hasDough) tip = `${bowl.dough.recipe.emoji} READY`;
        else if (bowl) tip = `${bowl.ingredients.length} in`;
        if (active) tip = `▶ ${tip}`;
        if (showTip || active) {
          drawTooltip(ctx, p.x, p.y - spriteH - 10, tip, z);
        }
        break;
      }
      case 'register':
        if (!drewSprite) {
          ctx.fillStyle = '#35434d';
          ctx.fillRect(p.x - 24, p.y - 32, 48, 26);
          ctx.fillStyle = '#7bd3b1';
          ctx.fillRect(p.x - 14, p.y - 28, 22, 8);
          ctx.fillStyle = '#c8935b';
          ctx.fillRect(p.x - 26, p.y - 6, 52, 8);
        }
        break;
      case 'display': {
        // Glass case: two shelves sized to the fixture, emojis clipped inside.
        const caseW = (fixture.w || 210) * z;
        const caseH = (fixture.h || 62) * z;
        const caseX = p.x - caseW / 2;
        const caseY = p.y - caseH - 4 * z;
        if (!drewSprite) {
          ctx.fillStyle = 'rgba(207,238,244,.78)';
          ctx.fillRect(caseX, caseY, caseW, caseH);
          ctx.strokeStyle = '#ae7650';
          ctx.lineWidth = 3;
          ctx.strokeRect(caseX, caseY, caseW, caseH);
          ctx.strokeStyle = 'rgba(174,118,80,.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(caseX, caseY + caseH / 2);
          ctx.lineTo(caseX + caseW, caseY + caseH / 2);
          ctx.stroke();
        }

        const stocked = pastryStock?.list?.() || [];
        if (stocked.length) {
          const perRow = Math.max(4, Math.ceil(stocked.length / 2));
          const slotW = caseW / perRow;
          const topRowY = caseY + caseH * 0.28;
          const bottomRowY = caseY + caseH * 0.72;
          ctx.save();
          ctx.beginPath();
          ctx.rect(caseX + 2 * z, caseY + 2 * z, caseW - 4 * z, caseH - 4 * z);
          ctx.clip();
          stocked.forEach((item, i) => {
            const col = i % perRow;
            const row = Math.floor(i / perRow);
            const sx = caseX + slotW * (col + 0.5);
            const sy = row === 0 ? topRowY : bottomRowY;
            const emojiSize = Math.max(12, Math.min(20, slotW * 0.55));
            ctx.textAlign = 'center';
            ctx.font = `${emojiSize}px serif`;
            ctx.fillStyle = '#2b2118';
            ctx.fillText(item.recipe?.emoji || '🍪', sx, sy);
            if (item.n > 1) {
              ctx.font = `bold ${Math.max(8, emojiSize * 0.55)}px Fredoka, sans-serif`;
              ctx.fillText(`x${item.n}`, sx, sy + emojiSize * 0.65);
            }
          });
          ctx.restore();
          if (showTip) {
            drawTooltip(
              ctx,
              p.x,
              p.y - spriteH - 10,
              `Case ${pastryStock.total()}/${pastryStock.capacity}`,
              z,
            );
          }
        } else if (showTip) {
          drawTooltip(ctx, p.x, p.y - spriteH - 10, 'Empty case — bake to stock!', z);
        }
        break;
      }
      case 'sink':
        if (!drewSprite) {
          ctx.fillStyle = '#b7c9d1';
          ctx.fillRect(p.x - 28, p.y - 26, 56, 22);
          ctx.fillStyle = '#6d8791';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 18, 18, 7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'dishwasher':
        if (!drewSprite) {
          ctx.fillStyle = '#dbe7eb';
          ctx.fillRect(p.x - 34, p.y - 36, 68, 32);
          ctx.fillStyle = '#708a94';
          ctx.fillRect(p.x - 26, p.y - 29, 52, 18);
        }
        if (showTip) drawTooltip(ctx, p.x, p.y - spriteH - 10, '🍽️ DISHWASHER', z);
        break;
      case 'toilet':
        if (!drewSprite) {
          // Stall partition (left wall + back hint)
          ctx.fillStyle = 'rgba(180, 200, 210, 0.6)';
          ctx.fillRect(p.x - 28, p.y - 58, 8, 52);
          ctx.fillStyle = 'rgba(160, 185, 195, 0.35)';
          ctx.fillRect(p.x - 20, p.y - 58, 40, 52);
          ctx.fillStyle = 'rgba(197, 224, 232, 0.45)';
          ctx.fillRect(p.x - 18, p.y - 58, 36, 8);
          // Tank
          ctx.fillStyle = '#f8fbfc';
          ctx.strokeStyle = '#7a9fad';
          ctx.lineWidth = 1.5;
          ctx.fillRect(p.x - 14, p.y - 54, 28, 20);
          ctx.strokeRect(p.x - 14, p.y - 54, 28, 20);
          ctx.fillStyle = '#c5dce6';
          ctx.fillRect(p.x - 10, p.y - 48, 20, 5);
          ctx.fillStyle = '#a0c0d0';
          ctx.beginPath();
          ctx.arc(p.x + 8, p.y - 46, 2.5, 0, Math.PI * 2);
          ctx.fill();
          // Bowl — seat ring + inner bowl
          ctx.fillStyle = '#f8fbfc';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 26, 18, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#eef6f9';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 27, 12, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#9ec4d0';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 27, 7, 3.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          // Pedestal + base
          ctx.fillStyle = '#e8f0f4';
          ctx.fillRect(p.x - 10, p.y - 16, 20, 8);
          ctx.fillRect(p.x - 12, p.y - 8, 24, 6);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - 2, 14, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#7a9fad';
          ctx.stroke();
        }
        if (showTip) drawTooltip(ctx, p.x, p.y - spriteH - 10, '🧽 CLEAN', z);
        break;
      case 'pantry':
      case 'bookcase':
        if (!drewSprite) {
          ctx.fillStyle = '#a47145';
          ctx.fillRect(p.x - 18, p.y - 56, 36, 52);
          ctx.strokeStyle = '#704527';
          ctx.lineWidth = 2;
          for (let y = -42; y <= -8; y += 16) {
            ctx.beginPath();
            ctx.moveTo(p.x - 18, p.y + y);
            ctx.lineTo(p.x + 18, p.y + y);
            ctx.stroke();
          }
        }
        break;
      case 'shop':
        if (!drewSprite) {
          ctx.fillStyle = '#674735';
          ctx.fillRect(p.x - 42, p.y - 28, 84, 24);
          ctx.fillStyle = '#f5deb3';
          ctx.font = 'bold 12px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SHOP', p.x, p.y - 12);
        }
        break;
      case 'serve':
        ctx.fillStyle = '#d5b16d';
        ctx.fillRect(p.x - 40, p.y - 26, 80, 22);
        ctx.fillStyle = '#fff8e7';
        ctx.font = 'bold 11px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SERVE', p.x, p.y - 12);
        break;
      case 'conveyor': {
        const beltW = (fixture.w || 160) * z;
        const beltH = 14 * z;
        const beltX = p.x - beltW / 2;
        const beltY = p.y - beltH - 2 * z;
        // Side rails
        ctx.fillStyle = COLORS.conveyor;
        ctx.fillRect(beltX - 3 * z, beltY - 3 * z, beltW + 6 * z, beltH + 6 * z);
        // Belt surface with moving stripe hint
        ctx.fillStyle = COLORS.conveyorBelt;
        ctx.fillRect(beltX, beltY, beltW, beltH);
        const stripeOffset = (this.time * 40) % (16 * z);
        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.lineWidth = 2 * z;
        for (let sx = beltX - stripeOffset; sx < beltX + beltW; sx += 16 * z) {
          ctx.beginPath();
          ctx.moveTo(sx, beltY + 2 * z);
          ctx.lineTo(sx + 8 * z, beltY + beltH - 2 * z);
          ctx.stroke();
        }
        // Rollers at each end
        ctx.fillStyle = '#4a5a6a';
        for (const rx of [beltX + 6 * z, beltX + beltW - 6 * z]) {
          ctx.beginPath();
          ctx.arc(rx, beltY + beltH / 2, 5 * z, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#3a4a5a';
          ctx.lineWidth = 1.5 * z;
          ctx.stroke();
        }
        if (showTip) drawTooltip(ctx, p.x, p.y - spriteH - 10, 'Conveyor belt', z);
        break;
      }
      case 'openSign': {
        const open = opts.phase === 'SERVICE';
        const signH = Math.min(spriteH, 44 * z);
        const signW = signH * 0.72;
        const signY = p.y - signH - 6 * z;
        const img = this.assets?.get('open_sign') || this.assets?.get('furniture_open_sign');
        if (img) {
          ctx.save();
          if (!open) {
            ctx.translate(p.x, signY + signH / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(/** @type {CanvasImageSource} */ (img), -signW / 2, -signH / 2, signW, signH);
          } else {
            ctx.drawImage(/** @type {CanvasImageSource} */ (img), p.x - signW / 2, signY, signW, signH);
          }
          ctx.restore();
        } else {
          ctx.fillStyle = open ? '#5fd39a' : COLORS.berry;
          ctx.fillRect(p.x - signW / 2, signY, signW, signH);
        }
        const badgeW = 38 * z;
        const badgeH = 16 * z;
        const badgeY = p.y - 4 * z;
        ctx.fillStyle = open ? 'rgba(95,211,154,.92)' : 'rgba(232,93,117,.92)';
        roundRectPath(ctx, p.x - badgeW / 2, badgeY - badgeH, badgeW, badgeH, 5 * z);
        ctx.fill();
        ctx.fillStyle = open ? '#1a4d38' : '#fff6e0';
        ctx.font = `bold ${9 * z}px Fredoka, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(open ? 'OPEN' : 'CLOSED', p.x, badgeY - 4 * z);
        if (showTip) {
          drawTooltip(ctx, p.x, p.y - spriteH - 10, open ? 'Tap to close' : 'Tap to open', z);
        }
        break;
      }
      case 'safe':
        if (!drewSprite) {
          ctx.fillStyle = '#59616a';
          ctx.fillRect(p.x - 18, p.y - 24, 36, 20);
          ctx.fillStyle = '#f2c14e';
          ctx.beginPath();
          ctx.arc(p.x, p.y - 14, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      default:
        if (!drewSprite) {
          ctx.fillStyle = '#cdb189';
          ctx.fillRect(p.x - 18, p.y - 22, 36, 16);
        }
    }
    if (fixture.kind === 'shop' && economy.extraTables) {
      ctx.fillStyle = '#5fd39a';
      ctx.font = '10px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Tables +${economy.extraTables}`, p.x, p.y + 10);
    }
  }

  drawCharacter(ctx, character, camera) {
    // Anchor at soles so Y-sort matches furniture feet
    const p = worldToIso(character.cx, character.y + character.size, camera);
    const size = character.size * 1.05 * camera.zoom;
    const key = character.getSpriteKey?.() || character.species.spriteKey || character.species.id;
    const pose = poseFromState(character.state);
    const dir = character.facingDir || 'front';
    const resolved = resolveDirectionImage(character.assets || this.assets, key, dir, pose);
    let facing = 1;
    if (resolved.flip) facing = -1;

    drawCharacterArt(ctx, {
      id: character.species.id,
      x: p.x - size / 2,
      y: p.y - size,
      size,
      color: character.species.fallbackColor,
      accent: character.species.accent,
      facing,
      time: this.time,
      walking: !!character.bob,
      state: character.state || null,
      image: resolved.image,
    });
    if (character.dirtyDishes?.length) {
      ctx.font = `bold ${Math.max(16, 15 * camera.zoom)}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff8e7';
      ctx.strokeStyle = '#2b2118';
      ctx.lineWidth = 3;
      const dishLabel = `🍽️×${character.dirtyDishes.length}`;
      const dishX = p.x + size * 0.38;
      const dishY = p.y - size * 0.62;
      ctx.strokeText(dishLabel, dishX, dishY);
      ctx.fillText(dishLabel, dishX, dishY);
    }
    if (character.name) {
      const labelSize = Math.max(13, 12 * camera.zoom);
      ctx.font = `bold ${labelSize}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(43,33,24,.88)';
      const width = ctx.measureText(character.name).width + 14;
      const h = labelSize + 8;
      ctx.fillRect(p.x - width / 2, p.y - size - h - 4, width, h);
      ctx.fillStyle = '#fff6e0';
      ctx.fillText(character.name, p.x, p.y - size - 8);
    }
  }

  drawTickets(ctx, tickets, camera) {
    for (const ticket of tickets.tickets) {
      if (ticket.served) continue;
      const p = worldToIso(ticket.x, ticket.y, camera);
      ctx.fillStyle = '#fff8e7';
      ctx.fillRect(p.x - 31, p.y - 18, 62, 25);
      ctx.strokeStyle = ticket.ready ? '#5fd39a' : '#c6a56d';
      ctx.strokeRect(p.x - 31, p.y - 18, 62, 25);
      ctx.fillStyle = '#2b2118';
      ctx.font = 'bold 9px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ticket.recipe.emoji, p.x, p.y - 2);
    }
  }
}

function drawIngredientBadge(ctx, x, y, ingredient, stock, z = 1, active = false) {
  const scale = Math.max(1, z);
  const shortNames = {
    chocolate_chips: 'Choc Chips',
  };
  const name = shortNames[ingredient?.id] || ingredient?.name || 'Ingredient';
  const width = 58 * scale;
  const height = 34 * scale;
  ctx.fillStyle = active ? 'rgba(255,201,74,.96)' : 'rgba(43,33,24,.9)';
  roundRectPath(ctx, x - width / 2, y - height, width, height, 7 * scale);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = active ? '#2b2118' : '#fff6e0';
  ctx.font = `bold ${9 * scale}px Fredoka, sans-serif`;
  ctx.fillText(name, x, y - 20 * scale);
  ctx.font = `bold ${12 * scale}px Fredoka, sans-serif`;
  ctx.fillText(
    `${ingredient?.emoji ?? ''} ${stock.current}/${stock.max}`,
    x,
    y - 6 * scale,
  );
}

function drawTooltip(ctx, x, y, text, z = 1) {
  const scale = Math.max(1.15, z);
  ctx.font = `bold ${16 * scale}px Fredoka, sans-serif`;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width + 22;
  const th = 28 * scale;
  ctx.fillStyle = 'rgba(43,33,24,0.92)';
  roundRectPath(ctx, x - tw / 2, y - th + 4, tw, th, 9);
  ctx.fill();
  ctx.fillStyle = '#fff6e0';
  ctx.fillText(text, x, y - 6);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
