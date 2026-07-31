import { daySettings } from '../config.js';
import { randomCustomerSpecies } from '../data/species.js';
import { randomName } from '../data/names.js';
import { Customer } from '../entities/Customer.js';
import { PATISSERIE } from '../world/RestaurantLayout.js';

export class CustomerSpawner {
  /**
   * @param {import('../engine/AssetLoader.js').AssetLoader} assets
   */
  constructor(assets) {
    this.assets = assets;
    /** @type {Customer[]} */
    this.customers = [];
    this.timer = 3;
    this.enabled = false;
    this.day = 1;
    this.spawnMultiplier = 1;
    this.pickiness = 1;
  }

  setDay(day) {
    this.day = day;
  }

  /**
   * @param {{ spawnMultiplier?: number, pickiness?: number }} settings
   */
  setDifficulty(settings = {}) {
    this.spawnMultiplier = settings.spawnMultiplier ?? 1;
    this.pickiness = settings.pickiness ?? 1;
  }

  setEnabled(on) {
    this.enabled = on;
  }

  activeCount() {
    return this.customers.filter((c) => c.state !== 'done').length;
  }

  /** True if someone is still walking up / introducing (don't overlap intros). */
  introBusy() {
    return this.customers.some((c) =>
      ['greeting', 'enter', 'queue'].includes(c.state),
    );
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number,w:number,h:number}[]} walls
   * @param {object} hooks
   */
  update(dt, walls, hooks) {
    const settings = daySettings(this.day);

    if (this.enabled) {
      const active = this.activeCount();
      // Early days: one customer in the whole shop until they leave
      const earlyBlock = settings.oneAtATime && active > 0;
      // Never overlap greetings
      const blocked = earlyBlock || this.introBusy();
      if (active < settings.maxCustomers && !blocked) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.spawn();
          this.timer = settings.spawnInterval * this.spawnMultiplier * (0.85 + Math.random() * 0.3);
        }
      }
    }

    const before = this.activeCount();
    for (const c of this.customers) {
      c.update(dt, walls, hooks);
    }
    this.customers = this.customers.filter((c) => c.state !== 'done');
    // After the shop empties, next guest arrives soon (still cozy, not frantic)
    if (before > 0 && this.activeCount() === 0) {
      this.timer = Math.min(this.timer, this.day <= 2 ? 16 : 10);
    }
  }

  spawn() {
    const settings = daySettings(this.day);
    const species = randomCustomerSpecies(Math.random, !!settings.easyPool);
    const name = randomName();
    const c = new Customer({
      species,
      assets: this.assets,
      name,
      x: PATISSERIE.waypoints.entrance.x - species.size / 2,
      y: PATISSERIE.waypoints.entrance.y - species.size / 2,
      easy: !!settings.easyPool,
    });
    c.state = 'enter';
    c.target = { ...PATISSERIE.waypoints.posQueue };
    // Pickier difficulties = less patience
    c.species = { ...c.species, patience: Math.max(0.45, c.species.patience / this.pickiness) };
    const waiting = this.customers.filter((x) =>
      ['enter', 'queue', 'greeting', 'waitingForSeat', 'walkingToTable', 'waiting'].includes(x.state),
    ).length;
    c.target.x -= waiting * 40;
    this.customers.push(c);
    return c;
  }

  findWaitingForSeat() {
    return this.customers.find((c) => c.state === 'waitingForSeat');
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time
   */
  draw(ctx, time) {
    const sorted = [...this.customers].sort((a, b) => a.y - b.y);
    for (const c of sorted) c.draw(ctx, time);
  }

  findWaitingForFood() {
    const waiting = this.customers.filter(
      (c) => c.state === 'waiting' && c.ordered && !c.served,
    );
    if (!waiting.length) return null;
    waiting.sort((a, b) => (b.waitTimer || 0) - (a.waitTimer || 0));
    return waiting[0];
  }

  /** Customers stuck in greeting who never got a profile card. */
  findGreetingStuck() {
    return this.customers.filter((c) => c.state === 'greeting');
  }
}
