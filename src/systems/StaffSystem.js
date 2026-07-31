import { PATISSERIE } from '../world/RestaurantLayout.js';

/**
 * Hired helpers handle chores. Bunny also auto-serves from the pastry case
 * when a waiting guest's treat is stocked. Baking stays with the player.
 */
export const HELPER_ROSTER = [
  {
    id: 'stocker',
    name: 'Squirrel Stocker',
    spriteKey: 'squirrel',
    speciesId: 'squirrel',
    // Home post; helpers walk out from here to their chores.
    x: 616,
    y: 420,
    role: 'Refills low ingredient bowls',
  },
  {
    id: 'busser',
    name: 'Bunny Server',
    spriteKey: 'bunny',
    speciesId: 'bunny',
    x: 470,
    y: 300,
    role: 'Serves from the case and clears dirty dishes',
  },
  {
    id: 'custodian',
    name: 'Frog Custodian',
    spriteKey: 'frog',
    speciesId: 'frog',
    x: 690,
    y: 205,
    role: 'Scrubs the restroom',
  },
];

/** Where a busser drops dishes off. */
function dishwasherPoint() {
  const dw = PATISSERIE.fixtures.find((f) => f.action === 'wash_dishes');
  return dw ? { x: dw.x + dw.w / 2, y: dw.y + dw.h + 12 } : { x: 626, y: 590 };
}

function displayPoint() {
  const display = PATISSERIE.fixtures.find((f) => f.kind === 'display');
  return display
    ? { x: display.x + display.w / 2, y: display.y + display.h + 12 }
    : { x: 195, y: 350 };
}

function servePoint() {
  const serve = PATISSERIE.fixtures.find((f) => f.kind === 'serve');
  return serve
    ? { x: serve.x + serve.w / 2, y: serve.y + serve.h + 12 }
    : { x: 492, y: 340 };
}

/** Walk `helper` toward a point; true once it arrives. */
function stepToward(helper, target, dt, speed = 96) {
  const dx = target.x - helper.x;
  const dy = target.y - helper.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return true;
  const move = Math.min(dist, speed * dt);
  helper.x += (dx / dist) * move;
  helper.y += (dy / dist) * move;
  helper.facing = dx < 0 ? -1 : 1;
  helper.walking = true;
  return false;
}

export class StaffSystem {
  constructor(economy) {
    this.economy = economy;
    this.stockTimer = 0;
    /**
     * Live, moving helper state keyed by roster id. Rendered so the player can
     * see exactly what each hire is doing.
     * @type {Map<string, object>}
     */
    this.actors = new Map();
  }

  /** Create or fetch the live actor for a roster entry. */
  _actor(entry) {
    let actor = this.actors.get(entry.id);
    if (!actor) {
      actor = {
        ...entry,
        home: { x: entry.x, y: entry.y },
        task: 'idle',
        status: '',
        facing: 1,
        walking: false,
        carrying: 0,
        /** @type {string|null} emoji while delivering a treat */
        carryingTreat: null,
        /** @type {'toDisplay'|'toServe'|null} */
        servePhase: null,
        /** @type {import('../entities/Customer.js').Customer|null} */
        serveCustomer: null,
        /** @type {string|null} */
        serveRecipeId: null,
        targetId: null,
        cooldown: 0,
      };
      this.actors.set(entry.id, actor);
    }
    return actor;
  }

  /**
   * @param {number} dt
   * @param {import('./InventorySystem.js').InventorySystem} inventory
   * @param {import('./CookingSystem.js').CookingSystem} _cooking unused: helpers never cook
   * @param {import('../entities/Customer.js').Customer|null} waitingCustomer
   * @param {object} opts
   * @param {import('./SeatingSystem.js').SeatingSystem} [opts.seating]
   * @param {Set<string>} [opts.bathroomDirty]
   * @param {import('./StockSystem.js').StockSystem} [opts.pastryStock]
   * @param {string} [opts.phase]
   * @param {boolean} [opts.serveBlocked]
   */
  update(dt, inventory, _cooking, waitingCustomer, opts = {}) {
    const events = [];
    const seating = opts.seating;
    const bathroomDirty = opts.bathroomDirty;

    if (this.economy.has('stocker')) {
      events.push(...this._updateStocker(dt, inventory));
    }
    if (this.economy.has('busser') && seating) {
      events.push(
        ...this._updateBusser(dt, seating, waitingCustomer, opts.pastryStock, opts.phase, opts.serveBlocked),
      );
    }
    if (this.economy.has('custodian') && bathroomDirty) {
      events.push(...this._updateCustodian(dt, bathroomDirty));
    }

    for (const actor of this.actors.values()) {
      if (actor.task === 'idle') {
        actor.walking = false;
        stepToward(actor, actor.home, dt, 70);
      }
    }
    return events;
  }

  _updateStocker(dt, inventory) {
    const events = [];
    const actor = this._actor(HELPER_ROSTER[0]);
    this.stockTimer -= dt;

    const low = Object.entries(inventory.stock).find(
      ([, qty]) => qty.current <= Math.max(2, qty.max * 0.25),
    );
    if (!low) {
      actor.task = 'idle';
      actor.status = 'Watching the shelves';
      return events;
    }

    const station = PATISSERIE.fixtures.find(
      (f) => f.kind === 'ingredientBowl' && f.ingredientId === low[0],
    );
    const target = station
      ? { x: station.x + station.w / 2, y: station.y + station.h + 14 }
      : actor.home;

    actor.task = 'restock';
    actor.status = `Refilling ${low[0].replace('_', ' ')}`;
    if (stepToward(actor, target, dt) && this.stockTimer <= 0) {
      inventory.refill(low[0], 3);
      events.push({ type: 'stocked', ingredientId: low[0] });
      this.stockTimer = 8;
    }
    return events;
  }

  _updateBusser(dt, seating, waitingCustomer, pastryStock, phase, serveBlocked = false) {
    const events = [];
    const actor = this._actor(HELPER_ROSTER[1]);

    // Delivering a treat from the case to the serve counter.
    if (actor.servePhase === 'toServe' && actor.serveCustomer && actor.carryingTreat) {
      actor.task = 'serve';
      actor.status = `Serving ${actor.carryingTreat} to ${actor.serveCustomer.name}`;
      if (stepToward(actor, servePoint(), dt)) {
        events.push({
          type: 'serve',
          customer: actor.serveCustomer,
          recipeId: actor.serveRecipeId,
        });
        actor.servePhase = null;
        actor.serveCustomer = null;
        actor.serveRecipeId = null;
        actor.carryingTreat = null;
        actor.status = 'Order sent!';
      }
      return events;
    }

    if (actor.servePhase === 'toDisplay' && actor.serveCustomer) {
      actor.task = 'serve';
      actor.status = `Grabbing ${actor.serveCustomer.order?.emoji || 'treat'} from case`;
      if (stepToward(actor, displayPoint(), dt)) {
        actor.carryingTreat = actor.serveCustomer.order?.emoji || '🍰';
        actor.serveRecipeId = actor.serveCustomer.order?.id || null;
        actor.servePhase = 'toServe';
      }
      return events;
    }

    const canServe =
      phase === 'SERVICE' &&
      waitingCustomer &&
      !serveBlocked &&
      pastryStock?.has(waitingCustomer.order?.id);

    if (canServe && actor.carrying === 0) {
      actor.serveCustomer = waitingCustomer;
      actor.servePhase = 'toDisplay';
      actor.task = 'serve';
      actor.status = `Fetching ${waitingCustomer.order.emoji} for ${waitingCustomer.name}`;
      stepToward(actor, displayPoint(), dt);
      return events;
    }

    // Carrying dirty dishes? Take them to the dishwasher.
    if (actor.carrying > 0) {
      actor.task = 'wash';
      actor.status = `Carrying ${actor.carrying} dish${actor.carrying === 1 ? '' : 'es'}`;
      if (stepToward(actor, dishwasherPoint(), dt)) {
        events.push({ type: 'dishesWashed', count: actor.carrying });
        actor.carrying = 0;
        actor.status = 'Loaded the dishwasher';
      }
      return events;
    }

    const plate = seating.dirty[0];
    if (!plate) {
      actor.task = 'idle';
      actor.status = canServe ? 'Ready to serve' : 'Tables are clear';
      return events;
    }

    actor.task = 'collect';
    actor.status = `Clearing ${plate.label}`;
    if (stepToward(actor, plate, dt)) {
      const taken = seating.take(plate);
      if (taken) {
        actor.carrying += 1;
        events.push({ type: 'dishCollected', label: taken.label });
      }
    }
    return events;
  }

  _updateCustodian(dt, bathroomDirty) {
    const events = [];
    const actor = this._actor(HELPER_ROSTER[2]);
    const nextId = [...bathroomDirty][0];

    if (!nextId) {
      actor.task = 'idle';
      actor.status = 'Restroom is spotless';
      return events;
    }

    const fixture = PATISSERIE.fixtures.find((f) => f.id === nextId);
    const target = fixture
      ? { x: fixture.x - 22, y: fixture.y + fixture.h / 2 }
      : actor.home;

    actor.task = 'clean';
    actor.status = `Scrubbing ${fixture?.label || 'the restroom'}`;
    if (stepToward(actor, target, dt)) {
      bathroomDirty.delete(nextId);
      events.push({ type: 'bathroomCleaned', fixtureId: nextId });
    }
    return events;
  }

  canAutoServe() {
    return this.economy.has('busser');
  }

  activeHelpers() {
    return HELPER_ROSTER.filter((helper) => this.economy.has(helper.id)).map((helper) =>
      this._actor(helper),
    );
  }
}
