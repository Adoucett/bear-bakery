import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ASSET_MANIFEST } from '../src/config.js';
import { CookingSystem } from '../src/systems/CookingSystem.js';
import { EconomySystem } from '../src/systems/EconomySystem.js';
import { InventorySystem } from '../src/systems/InventorySystem.js';
import { SeatingSystem } from '../src/systems/SeatingSystem.js';
import { StaffSystem } from '../src/systems/StaffSystem.js';
import {
  COLLISION_FOOTPRINT,
  PATISSERIE,
  collisionRects,
  tableDefinitions,
} from '../src/world/RestaurantLayout.js';
import { selectVoiceClip } from '../src/engine/AudioManager.js';
import { SPECIES } from '../src/data/species.js';
import { DIALOGUE, orderLineFor } from '../src/data/dialogue.js';
import { getRecipe } from '../src/data/recipes.js';
import { ProfileCard } from '../src/ui/ProfileCard.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Run a system for a simulated number of seconds. */
function run(seconds, step, fn) {
  const events = [];
  for (let t = 0; t < seconds / step; t += 1) events.push(...(fn() || []));
  return events;
}

function testCosmetics() {
  const economy = new EconomySystem({ money: 1000 });
  const inventory = new InventorySystem();
  assert.equal(economy.buy('chefHat', inventory).ok, true);
  assert.equal(economy.bearSpriteKey(), 'bear_hat');
  assert.equal(economy.buy('sunglasses', inventory).ok, true);
  assert.equal(economy.bearSpriteKey(), 'bear_hat_glasses');
  economy.toggleCosmetic('hat');
  assert.equal(economy.bearSpriteKey(), 'bear_glasses');
  economy.equipClassic();
  assert.equal(economy.bearSpriteKey(), 'bear');

  for (const key of ['bear', 'bear_hat', 'bear_glasses', 'bear_hat_glasses']) {
    for (const suffix of ['', '_front', '_back', '_left', '_side']) {
      const assetKey = `${key}${suffix}`;
      assert.ok(ASSET_MANIFEST.images[assetKey], `missing manifest key ${assetKey}`);
      assert.ok(existsSync(join(root, ASSET_MANIFEST.images[assetKey])), `missing ${assetKey} file`);
    }
  }
}

function testTables() {
  const economy = new EconomySystem({ money: 1000 });
  const inventory = new InventorySystem();
  assert.equal(economy.buy('tableTwo', inventory).ok, true);
  assert.equal(economy.extraTables, 2);
  assert.equal(tableDefinitions(economy.extraTables).length, 5);
  const seating = new SeatingSystem(economy);
  assert.equal(seating.tables().length, 5);
  assert.equal(seating.seats().length, 10);
  assert.ok(seating.seats().some((seat) => seat.tableId === 'extraTable2'));
  const baseCollisions = collisionRects(0).length;
  assert.equal(collisionRects(2).length, baseCollisions + 2);
}

/** Helpers do chores; Bunny also auto-serves when the case is stocked. */
function testHelpers() {
  const economy = new EconomySystem({ money: 5000 });
  const inventory = new InventorySystem();
  assert.equal(economy.buy('stocker', inventory).ok, true);
  assert.equal(economy.buy('busser', inventory).ok, true);
  assert.equal(economy.buy('custodian', inventory).ok, true);

  const staff = new StaffSystem(economy);
  const seating = new SeatingSystem(economy);
  const bathroomDirty = new Set(['toilet1', 'toilet2']);
  inventory.stock.flour.current = 0;
  seating.dirty.push(
    { id: 'd1', tableId: 'table1', label: 'Table 1', x: 138, y: 136, dirty: true },
    { id: 'd2', tableId: 'table2', label: 'Table 2', x: 323, y: 136, dirty: true },
  );

  const step = 1 / 60;
  const events = run(60, step, () =>
    staff.update(step, inventory, null, null, {
      phase: 'CLOSING',
      seating,
      bathroomDirty,
    }),
  );

  const kinds = new Set(events.map((e) => e.type));
  assert.ok(kinds.has('stocked'), 'stocker never refilled');
  assert.ok(kinds.has('dishCollected'), 'busser never collected a dish');
  assert.ok(kinds.has('dishesWashed'), 'busser never reached the dishwasher');
  assert.ok(kinds.has('bathroomCleaned'), 'custodian never cleaned');
  assert.equal(seating.dirty.length, 0, 'tables should end clear');
  assert.equal(bathroomDirty.size, 0, 'restroom should end clean');
  assert.ok(inventory.stock.flour.current > 0, 'flour should be restocked');

  // Bunny serves via events; helpers never cook or touch inventory directly.
  assert.equal(staff.canAutoServe(), true);
  const source = readFileSync(join(root, 'src/systems/StaffSystem.js'), 'utf8');
  for (const banned of ['addIngredient', 'sendToConveyor', 'startBake', 'pastryStock.take']) {
    assert.ok(!source.includes(banned), `helpers must not call ${banned}`);
  }

  // Helpers are visible actors with a readable status.
  const active = staff.activeHelpers();
  assert.equal(active.length, 3);
  for (const helper of active) {
    assert.ok(Number.isFinite(helper.x) && Number.isFinite(helper.y));
    assert.ok(typeof helper.status === 'string');
  }

  // Old saves that bought the removed roles keep working.
  const legacy = new EconomySystem({ owned: ['server', 'prepHelper'] });
  assert.ok(legacy.has('busser'), 'server should migrate to busser');
  assert.ok(legacy.has('custodian'), 'prepHelper should migrate to custodian');
}

/** A bowl holding everything a recipe needs must work, extras included. */
function testRecipeSuperset() {
  const cooking = new CookingSystem();
  const inventory = new InventorySystem();
  inventory.take('sugar');
  const sugarAfterScoop = inventory.get('sugar').current;

  for (const id of ['flour', 'sugar', 'eggs', 'milk']) {
    cooking.addIngredient(id, 'bowl1', { inventory });
  }
  const result = cooking.addIngredient('chocolate_chips', 'bowl1', { inventory });
  const bowl = cooking.getBowl('bowl1');

  assert.equal(result.sealed?.id, 'cookie', 'superset bowl should still seal');
  assert.deepEqual(
    [...bowl.dough.ingredients].sort(),
    [...getRecipe('cookie').ingredients].sort(),
    'dough must carry only canonical ingredients',
  );
  assert.equal(
    inventory.get('sugar').current,
    sugarAfterScoop + 1,
    'unused extra should return to the pantry',
  );

  // Manual mix path accepts extras too.
  const manual = new CookingSystem();
  const inv2 = new InventorySystem();
  manual.getBowl('bowl2').ingredients.push('flour', 'eggs', 'butter', 'honey', 'mint');
  const combined = manual.combine('bowl2', null, inv2);
  assert.equal(combined.ok, true, 'manual combine rejected a valid superset');
  assert.deepEqual(combined.extras, ['mint']);

  // Genuinely incomplete bowls still report what is missing.
  const partial = new CookingSystem();
  partial.getBowl('bowl1').ingredients.push('flour', 'eggs');
  const incomplete = partial.combine('bowl1', getRecipe('cookie'));
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.reason, 'incomplete');
  assert.ok(incomplete.missing.includes('milk'));
}

/** The written script: pun-based, kid-readable, one joke per treat. */
function testScript() {
  const conversational = ['greet', 'wait', 'thanks', 'chat', 'dislikeReact'];
  const seen = new Set();
  let orderPuns = 0;

  for (const [speciesId, species] of Object.entries(SPECIES)) {
    const bank = DIALOGUE[speciesId];
    assert.ok(bank, `no dialogue for ${speciesId}`);

    for (const bucket of conversational) {
      assert.equal(bank[bucket]?.length, 10, `${speciesId}.${bucket} must have 10 lines`);
      for (const line of bank[bucket]) {
        // Conversational lines must never name a treat — they play in any order.
        const tokens = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
        assert.deepEqual(
          tokens.filter((t) => t !== 'name'),
          [],
          `${speciesId}.${bucket} has an unsupported token`,
        );
        assert.ok(!/\p{Extended_Pictographic}/u.test(line), `emoji in ${speciesId}.${bucket}`);
        assert.ok(!seen.has(line), `duplicate line: ${line}`);
        seen.add(line);
      }
    }

    // Every treat this guest can order has its own pun naming that treat.
    const rollable = species.likesRecipes?.length ? species.likesRecipes : [species.prefers];
    for (const recipeId of rollable) {
      const recipe = getRecipe(recipeId);
      const line = orderLineFor(speciesId, recipe);
      orderPuns += 1;
      assert.ok(
        normalize(line).includes(normalize(recipe.name)),
        `${speciesId}/${recipeId} order line must name the treat: ${line}`,
      );
      assert.ok(!/\{/.test(line), `${speciesId}/${recipeId} leaked a token`);
      assert.ok(!seen.has(line), `duplicate order line: ${line}`);
      seen.add(line);
    }
  }

  assert.equal(orderPuns, 79, 'every species/treat pair needs its own pun');
  assert.equal(seen.size, 1000 + 79, 'all script lines must be unique');
}

/** Accents are strip accents for comparison ("Éclair" vs "Eclair"). */
function normalize(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Spoken order lines must name the treat the customer actually rolled. */
function testVoices() {
  const manifest = JSON.parse(
    readFileSync(join(root, 'assets/audio/voices/manifest.json'), 'utf8'),
  );

  // Director-mandated accents.
  const mandated = { frog: 'fr-FR', owl: 'en-GB', crocodile: 'en-AU' };
  for (const [speciesId, locale] of Object.entries(mandated)) {
    const clip = selectVoiceClip(manifest, speciesId, 'greet');
    assert.equal(clip?.languageCode, locale, `${speciesId} must speak ${locale}`);
  }
  const locales = new Set(manifest.clips.map((c) => c.languageCode));
  assert.ok(locales.size >= 5, `want accent variety, got ${[...locales].join(', ')}`);
  // Locales that failed the speech-to-text intelligibility check are banned.
  for (const banned of ['es-ES', 'ja-JP']) {
    assert.ok(!locales.has(banned), `${banned} was rejected as hard to understand`);
  }

  for (const [speciesId, species] of Object.entries(SPECIES)) {
    for (const bucket of ['profile', 'greet', 'chat']) {
      const clip = selectVoiceClip(manifest, speciesId, bucket);
      assert.equal(clip?.bucket, bucket, `${speciesId} missing ${bucket}`);
      assert.ok(clip?.text);
      assert.ok(existsSync(join(root, clip.src)), `missing voice file ${clip?.src}`);
      assert.ok(
        !/\{order\}/.test(clip.text),
        `${speciesId} ${bucket} must not depend on the order`,
      );
    }

    // Every treat this species can roll needs its own matching order clip.
    const rollable = species.likesRecipes?.length ? species.likesRecipes : [species.prefers];
    for (const recipeId of rollable) {
      const clip = selectVoiceClip(manifest, speciesId, 'order', recipeId);
      assert.equal(clip?.recipeId, recipeId, `${speciesId} missing order clip for ${recipeId}`);
      assert.ok(existsSync(join(root, clip.src)), `missing voice file ${clip.src}`);
      // "Chocolate Eclair" is intentionally written without the accent so the
      // speech engine pronounces it, so compare accent-insensitively.
      const treat = getRecipe(recipeId).name;
      assert.ok(
        normalize(clip.text).includes(normalize(treat)),
        `${speciesId} order clip should say "${treat}" but says: ${clip.text}`,
      );
    }
  }

  // A missing per-recipe render degrades to the character's own voice.
  const fallback = selectVoiceClip(manifest, 'bunny', 'order', 'not_a_recipe');
  assert.ok(fallback, 'order lookup should fall back rather than go silent');
  assert.equal(fallback.speciesId, 'bunny');
}

/** One card, showing the real order, that never blocks play. */
function testOrderCard() {
  const card = new ProfileCard();
  const customer = {
    name: 'Testy',
    order: getRecipe('fruit_tart'),
    greetLine: 'hello',
    orderLine: 'a tart please',
    species: SPECIES.frog,
    bio: 'bio',
    friends: [],
  };

  card.show(customer);
  assert.equal(card.active, true);
  // Card timer only dismisses — order voice is chained from greet onEnded.
  assert.equal(card.orderCued, false);
  assert.equal(card.update(0.1), null);
  assert.equal(card.update(card.duration - 0.2), null);
  assert.equal(card.update(0.2), 'done');
  assert.equal(card.active, false);

  // Clicking the card dismisses it; clicks elsewhere fall through to the world.
  card.show(customer);
  const { x, y, w, h } = card.bounds;
  assert.equal(card.hitTest(x + w / 2, y + h / 2), true);
  assert.equal(card.hitTest(x - 40, y - 40), false);
  assert.equal(card.dismiss(), 'done');

  // The card must read the rolled order, never the species favourite.
  const code = readFileSync(join(root, 'src/ui/ProfileCard.js'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
  assert.ok(!code.includes('species.prefers'), 'card must not fall back to the favourite treat');
}

/** Polish pass: voiced lines, mouse follow, second oven, bunny serve, menu. */
async function testPolish() {
  const { voicedGreetLine, voicedChatLine, BEAR_SELF_TALK } = await import('../src/data/dialogue.js');
  const { CookingSystem } = await import('../src/systems/CookingSystem.js');
  const { fixtureDefinitions } = await import('../src/world/RestaurantLayout.js');
  const { getUpgrade } = await import('../src/data/upgrades.js');

  const greet = voicedGreetLine('bear', { name: 'Baker Bear' });
  const chat = voicedChatLine('bear', { name: 'Baker Bear' });
  assert.ok(greet.length > 4, 'voiced greet should be a real line');
  assert.ok(chat.length > 4, 'voiced chat should be a real line');
  assert.ok(BEAR_SELF_TALK.length >= 8, 'bear needs self-talk lines');

  // Mouse-follow on by default for touchscreens.
  const playerSource = readFileSync(join(root, 'src/entities/Player.js'), 'utf8');
  assert.ok(playerSource.includes('mouseFollowToggle = true'), 'bear should follow pointer by default');

  const cooking = new CookingSystem();
  assert.equal(cooking.ovens.length, 1);
  cooking.ensureOvens(true);
  assert.equal(cooking.ovens.length, 2);
  assert.ok(getUpgrade('secondOven'), 'second oven upgrade must exist');
  const withSecond = fixtureDefinitions({ secondOven: true });
  assert.ok(withSecond.some((f) => f.id === 'oven2'), 'second oven fixture missing');

  const oven = PATISSERIE.fixtures.find((f) => f.id === 'oven');
  const display = PATISSERIE.fixtures.find((f) => f.id === 'display');
  const ovenFeet = { x: oven.x + oven.w / 2, y: oven.y + oven.h + 12 };
  const displayFeet = { x: display.x + display.w / 2, y: display.y + display.h + 12 };
  const walk = Math.hypot(ovenFeet.x - displayFeet.x, ovenFeet.y - displayFeet.y);
  assert.ok(walk <= 220, `oven→display walk should be short, got ${walk.toFixed(0)}px`);

  const iso = readFileSync(join(root, 'src/world/IsoRenderer.js'), 'utf8');
  assert.ok(
    iso.includes("if (showTip) drawTooltip(ctx, p.x, p.y - spriteH - 10, '🍽️ DISHWASHER'"),
    'dishwasher label must be hover-only',
  );

  const hudSource = readFileSync(join(root, 'src/ui/HUD.js'), 'utf8');
  assert.ok(hudSource.includes('menu_save'), 'pause menu needs Save');
  assert.ok(hudSource.includes('menu_skip_day'), 'pause menu needs Skip day');
  assert.ok(hudSource.includes('menu_difficulty'), 'pause menu needs difficulty');
  assert.ok(hudSource.includes('PINNED RECIPE'), 'pinned recipe panel missing');

  const audioSource = readFileSync(join(root, 'src/engine/AudioManager.js'), 'utf8');
  assert.ok(audioSource.includes('onEnded'), 'voice needs onEnded chaining');
  assert.ok(audioSource.includes('stopVoice'), 'voice needs stopVoice');
}

function overlapsBody(point, rect, size = 76) {
  const w = size * 0.36;
  const h = size * 0.22;
  const body = { x: point.x - w / 2, y: point.y - h / 2, w, h };
  return body.x < rect.x + rect.w
    && body.x + body.w > rect.x
    && body.y < rect.y + rect.h
    && body.y + body.h > rect.y;
}

function assertClearSegment(from, to, walls, label) {
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
    assert.ok(!walls.some((wall) => overlapsBody(point, wall)), `${label} blocked at ${i}/24`);
  }
}

function testLayoutReachability() {
  const walls = collisionRects(2);
  for (const station of PATISSERIE.restroomStations) {
    const route = [
      { x: 590, y: 195 },
      PATISSERIE.waypoints.restroomEntry,
      PATISSERIE.waypoints.restroomAisle,
      { x: 785, y: station.toilet.y },
      station.toilet,
      { x: 785, y: station.toilet.y },
      PATISSERIE.waypoints.restroomAisle,
      station.sink,
      { x: station.sink.x, y: PATISSERIE.waypoints.restroomAisle.y },
      PATISSERIE.waypoints.restroomEntry,
    ];
    route.forEach((point, index) => {
      assert.ok(!walls.some((wall) => overlapsBody(point, wall)), `${station.id} waypoint ${index}`);
      if (index) assertClearSegment(route[index - 1], point, walls, `${station.id} leg ${index}`);
    });
    for (const [fixtureId, approach] of [
      [station.toiletId, station.toilet],
      [station.sinkId, station.sink],
    ]) {
      const fixture = PATISSERIE.fixtures.find((item) => item.id === fixtureId);
      assert.ok(
        Math.hypot(
          approach.x - (fixture.x + fixture.w / 2),
          approach.y - (fixture.y + fixture.h / 2),
        ) <= 72,
        `${fixtureId} is outside interaction range`,
      );
    }
  }

  // The office door must be a real opening, not decoration on a solid wall.
  const officeDoor = PATISSERIE.doors.find((door) => door.id === 'officeDoor');
  assert.ok(officeDoor);
  const doorCenter = {
    x: officeDoor.x + officeDoor.w / 2,
    y: officeDoor.y + officeDoor.h / 2,
  };
  assert.ok(
    !walls.some((wall) => overlapsBody(doorCenter, wall)),
    'office door is blocked — it would be a fake door again',
  );
  assertClearSegment(
    { x: doorCenter.x - 40, y: doorCenter.y },
    { x: doorCenter.x + 50, y: doorCenter.y },
    walls,
    'office doorway',
  );

  // Fixtures must not sit on top of one another.
  const fixtures = PATISSERIE.fixtures;
  for (let i = 0; i < fixtures.length; i += 1) {
    for (let j = i + 1; j < fixtures.length; j += 1) {
      const a = fixtures[i];
      const b = fixtures[j];
      const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!hit, `fixtures overlap: ${a.id} / ${b.id}`);
    }
  }

  // Each ingredient station owns its interaction radius, so scooping is precise.
  const ingredients = fixtures.filter((f) => f.kind === 'ingredientBowl');
  assert.equal(ingredients.length, 15);
  for (const a of ingredients) {
    for (const b of ingredients) {
      if (a === b) continue;
      const distance = Math.hypot(
        a.x + a.w / 2 - (b.x + b.w / 2),
        a.y + a.h / 2 - (b.y + b.h / 2),
      );
      assert.ok(distance > 72, `${a.id} and ${b.id} share an interaction radius`);
    }
  }

  // Pantry and oven need breathing room between them.
  const oven = fixtures.find((f) => f.id === 'oven');
  const pantry = fixtures.find((f) => f.id === 'pantry');
  const gapX = Math.max(oven.x, pantry.x) - Math.min(oven.x + oven.w, pantry.x + pantry.w);
  const gapY = Math.max(oven.y, pantry.y) - Math.min(oven.y + oven.h, pantry.y + pantry.h);
  assert.ok(Math.max(gapX, gapY) >= 24, 'pantry and oven are still crowding each other');

  assert.ok(COLLISION_FOOTPRINT.FIXTURE_INSET_X > 0);
}

testCosmetics();
testTables();
testHelpers();
testRecipeSuperset();
testScript();
testVoices();
testOrderCard();
testLayoutReachability();
await testPolish();

console.log(
  'Playability smoke tests passed: cosmetics, tables, chore helpers + Bunny serve, recipe supersets, ' +
    '1,079 unique pun lines, accented per-treat voices, single order card, layout reachability, and polish pass.',
);
