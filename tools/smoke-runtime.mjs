/**
 * Headless runtime smoke test.
 *
 * Boots the real Game against a minimal DOM shim and drives a full day:
 * prep, opening, a customer arriving and ordering, talking to them, scooping
 * a recipe with an extra ingredient, and closing up. Static syntax checks
 * cannot catch wiring mistakes in update/render — this can.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- DOM shim ---------- */

const noop = () => {};
function makeCtx() {
  const ctx = new Proxy(
    {
      canvas: { width: 960, height: 640 },
      measureText: (t) => ({ width: String(t).length * 7 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createPattern: () => null,
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: noop,
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        // Any other canvas call is a no-op; any property reads as writable.
        return typeof prop === 'string' ? noop : undefined;
      },
      set() {
        return true;
      },
    },
  );
  return ctx;
}

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.style = {};
    this.width = 960;
    this.height = 640;
    this.classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
    this.children = [];
  }
  getContext() {
    return makeCtx();
  }
  addEventListener() {}
  removeEventListener() {}
  focus() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 960, height: 640 };
  }
  append() {}
  insertAdjacentHTML() {}
  querySelector() {
    return null;
  }
}

const canvas = new FakeElement('canvas');

global.window = {
  addEventListener: noop,
  removeEventListener: noop,
  devicePixelRatio: 2,
  innerWidth: 1280,
  innerHeight: 800,
  requestAnimationFrame: () => 0,
};
global.document = {
  getElementById: (id) => (id === 'game' ? canvas : new FakeElement()),
  createElement: (tag) => new FakeElement(tag),
  addEventListener: noop,
  removeEventListener: noop,
  documentElement: new FakeElement('html'),
  body: new FakeElement('body'),
  fonts: { ready: Promise.resolve() },
  fullscreenElement: null,
};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = noop;

/** Images always fail to load, so the game exercises its procedural fallback. */
global.Image = class {
  constructor() {
    setTimeout(() => this.onerror && this.onerror(new Error('no images in node')), 0);
  }
};
global.Audio = class {
  constructor() {
    this.volume = 1;
    this.currentTime = 0;
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
  cloneNode() {
    return new global.Audio();
  }
  addEventListener() {}
};

const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

global.fetch = async (url) => {
  const path = join(root, String(url));
  try {
    const body = readFileSync(path, 'utf8');
    return { ok: true, json: async () => JSON.parse(body) };
  } catch {
    return { ok: false, json: async () => ({}) };
  }
};

/* ---------- boot ---------- */

const { Game } = await import('../src/engine/Game.js');
const { getRecipe } = await import('../src/data/recipes.js');

const game = new Game(canvas);
game.running = false; // drive the loop manually
await game.init();
game.running = false;

const STEP = 1 / 60;
const failures = [];
function tick(frames = 1) {
  for (let i = 0; i < frames; i += 1) {
    game.update(STEP);
    game.render();
  }
}

// Title -> prep
game.hud.dismissTitle();
game.phase = 'PREP';
game.overviewTimer = 0;
tick(30);

// Scoop a cookie plus one extra ingredient; it must still seal.
for (const id of ['flour', 'sugar', 'eggs', 'milk', 'chocolate_chips']) {
  const station = game.level.interactables.find((f) => f.ingredientId === id);
  if (!station) {
    failures.push(`no station for ${id}`);
    continue;
  }
  game.useInteractable(station);
}
const sealed = game.cooking.bowls.some((b) => b.hasDough);
if (!sealed) failures.push('bowl with an extra ingredient did not seal');
tick(10);

// Bake and carry to the case.
const oven = game.level.interactables.find((f) => f.action === 'bake');
game.useInteractable(oven);
tick(20);
game.cooking.bakeTimer = 0;
game.cooking.ovenState = 'done';
game.useInteractable(oven);
if (!game.player.heldPlate) failures.push('taking a finished bake did not put it in hand');
const display = game.level.interactables.find((f) => f.action === 'stock_display');
game.useInteractable(display);
if (game.player.heldPlate) failures.push('carrying to the case did not stock it');
if (game.pastryStock.total() < 1) failures.push('pastry case did not receive the treat');

// Open and run service until a customer arrives and orders.
game.openRestaurant();
tick(60);
game.spawner.timer = 0;
let guest = null;
for (let i = 0; i < 4000 && !guest; i += 1) {
  tick(1);
  guest = game.spawner.customers.find((c) => c.order);
}
if (!guest) failures.push('no customer ever arrived');

if (guest) {
  // The card must describe this guest's real order.
  let sawCard = false;
  for (let i = 0; i < 1200 && !sawCard; i += 1) {
    tick(1);
    sawCard = game.profile.active;
  }
  if (!sawCard) {
    failures.push('greeting card never appeared');
  } else {
    const carded = game.profile.customer;
    if (carded && !carded.orderLine.includes(carded.order.name)) {
      failures.push(
        `subtitle names the wrong treat: order=${carded.order.name} line=${carded.orderLine}`,
      );
    }
    // Card is non-blocking: the player can still move while it is up.
    const before = { x: game.player.x, y: game.player.y };
    game.input.keys.add('d');
    tick(20);
    game.input.keys.delete('d');
    if (game.player.x === before.x && game.player.y === before.y) {
      failures.push('player could not move while the order card was showing');
    }
    // And can talk to a customer during it.
    game._talkToCustomer(carded || guest);
    if (!game.conversation.active) failures.push('could not talk during the order card');
    game.conversation.close();
  }

  // Voice clip chosen for the order must match the rolled recipe.
  const target = guest.order?.id;
  const clipText = game.audio.voiceText(guest.species.id, 'order', target);
  if (clipText && !clipText.includes(getRecipe(target).name)) {
    failures.push(`order voice says the wrong treat for ${guest.species.id}/${target}`);
  }
}

// Closing: dirty a table, then let a hired busser clean it.
game.economy.owned.add('busser');
game.economy.owned.add('custodian');
game.seating.dirty.push({
  id: 'x1', tableId: 'table1', label: 'Table 1', x: 138, y: 136, dirty: true,
});
game.phase = 'CLOSING';
tick(1800);
if (game.seating.dirty.length) failures.push('busser never cleared the table');

// Save/load round trip keeps cleanup state.
game.persist();
const saved = JSON.parse(localStorage.getItem('bear-bakery-modern-patisserie-v1'));
if (!Array.isArray(saved.tableDishes)) failures.push('table dishes are not persisted');
if (!Array.isArray(saved.bathroomDirty)) failures.push('restroom state is not persisted');

if (failures.length) {
  console.error('Runtime smoke test FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `runtime OK — booted, baked a superset recipe, stocked the case, greeted ${guest?.name}, ` +
    'talked mid-card, matched the order voice, and bussed the tables.',
);
