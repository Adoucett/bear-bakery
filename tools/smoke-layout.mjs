/**
 * Layout reachability smoke test.
 *
 * Flood-fills the walkable floor using the real player collision box and
 * asserts that every interactive station, seat, and routing waypoint can
 * actually be reached from the player's spawn. Catches fake doorways and
 * fixtures that wall each other off.
 */
import { PATISSERIE, collisionRects, tableDefinitions } from '../src/world/RestaurantLayout.js';
import { COLLISION } from '../src/entities/Character.js';
import { CONFIG } from '../src/config.js';

const STEP = 4;
const EXTRA_TABLES = 2;
const bodyW = CONFIG.PLAYER_SIZE * COLLISION.WIDTH_FRAC;
const bodyH = CONFIG.PLAYER_SIZE * COLLISION.HEIGHT_FRAC;
const rects = collisionRects(EXTRA_TABLES);
const { x: bx, y: by, w: bw, h: bh } = PATISSERIE.bounds;

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Player body centered on a feet position, matching Character.getBounds(). */
function bodyAt(cx, cy) {
  return { x: cx - bodyW / 2, y: cy - bodyH / 2, w: bodyW, h: bodyH };
}

function walkable(cx, cy) {
  if (cx < bx + 12 || cy < by + 12 || cx > bx + bw - 12 || cy > by + bh - 12) return false;
  const body = bodyAt(cx, cy);
  return !rects.some((r) => overlaps(body, r));
}

const cols = Math.ceil(bw / STEP);
const rows = Math.ceil(bh / STEP);
const key = (i, j) => j * cols + i;
const seen = new Set();
const start = PATISSERIE.waypoints.playerStart;

// Snap the spawn to the nearest walkable cell.
let startCell = null;
for (let radius = 0; radius < 40 && !startCell; radius += 1) {
  for (let dj = -radius; dj <= radius && !startCell; dj += 1) {
    for (let di = -radius; di <= radius && !startCell; di += 1) {
      const i = Math.round(start.x / STEP) + di;
      const j = Math.round(start.y / STEP) + dj;
      if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
      if (walkable(i * STEP, j * STEP)) startCell = [i, j];
    }
  }
}
if (!startCell) throw new Error('player spawn is not walkable');

const queue = [startCell];
seen.add(key(...startCell));
while (queue.length) {
  const [i, j] = queue.pop();
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di;
    const nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
    const k = key(ni, nj);
    if (seen.has(k)) continue;
    if (!walkable(ni * STEP, nj * STEP)) continue;
    seen.add(k);
    queue.push([ni, nj]);
  }
}

/** Can the player stand within interaction range of this target? */
function reachable(target, range = CONFIG.INTERACT_RANGE) {
  const tx = target.x + (target.w || 0) / 2;
  const ty = target.y + (target.h || 0) / 2;
  const span = Math.ceil(range / STEP);
  const ci = Math.round(tx / STEP);
  const cj = Math.round(ty / STEP);
  for (let dj = -span; dj <= span; dj += 1) {
    for (let di = -span; di <= span; di += 1) {
      const i = ci + di;
      const j = cj + dj;
      if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
      if (!seen.has(key(i, j))) continue;
      if (Math.hypot(i * STEP - tx, j * STEP - ty) <= range) return true;
    }
  }
  return false;
}

const failures = [];

for (const fixture of PATISSERIE.fixtures) {
  if (!reachable(fixture)) failures.push(`fixture unreachable: ${fixture.id}`);
}
for (const table of tableDefinitions(EXTRA_TABLES)) {
  if (!reachable(table, 90)) failures.push(`table unreachable: ${table.id}`);
}
for (const [name, point] of Object.entries(PATISSERIE.waypoints)) {
  if (!reachable({ ...point, w: 0, h: 0 }, 48)) {
    failures.push(`waypoint unreachable: ${name}`);
  }
}
for (const station of PATISSERIE.restroomStations || []) {
  for (const spot of ['toilet', 'sink']) {
    if (!reachable({ ...station[spot], w: 0, h: 0 }, 48)) {
      failures.push(`restroom ${spot} unreachable: ${station.id}`);
    }
  }
}

// Fixtures must not overlap each other.
const list = PATISSERIE.fixtures;
for (let i = 0; i < list.length; i += 1) {
  for (let j = i + 1; j < list.length; j += 1) {
    if (overlaps(list[i], list[j])) {
      failures.push(`fixtures overlap: ${list[i].id} / ${list[j].id}`);
    }
  }
}

// Each ingredient station must own its interaction radius.
const ingredients = list.filter((f) => f.kind === 'ingredientBowl');
for (const a of ingredients) {
  const near = ingredients.filter(
    (b) =>
      b !== a &&
      Math.hypot(
        a.x + a.w / 2 - (b.x + b.w / 2),
        a.y + a.h / 2 - (b.y + b.h / 2),
      ) <= CONFIG.INTERACT_RANGE,
  );
  if (near.length) {
    failures.push(`${a.id} shares its radius with ${near.map((n) => n.id).join(', ')}`);
  }
}

// The office doorway must be a real hole in the wall.
const doorway = { x: 638, y: 400, w: 10, h: 70 };
if (rects.some((r) => overlaps(r, doorway))) {
  failures.push('office doorway is blocked by a wall or fixture');
}

if (failures.length) {
  console.error('Layout smoke test FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `layout OK — ${seen.size} walkable cells, ${PATISSERIE.fixtures.length} fixtures, ` +
    `${tableDefinitions(EXTRA_TABLES).length} tables all reachable`,
);
