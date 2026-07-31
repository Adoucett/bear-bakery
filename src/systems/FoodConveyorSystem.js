/** Conveyor belt path — along the counter toward the dining pickup window. */
export const CONVEYOR_PATH = {
  start: { x: 400, y: 305 },
  hold: { x: 370, y: 310 },
  pickup: { x: 575, y: 250 },
};

const { start: START, hold: HOLD, pickup: PICKUP } = CONVEYOR_PATH;
/** World-distance the lead tray must clear before the next is released. */
const RELEASE_SPACING = 48;
/** Slot offset between queued trays at the holding area. */
const QUEUE_SLOT = 18;
const SPEED = 55;

/**
 * Food trays ride from the register along the counter belt to the pickup window.
 * Multiple trays stagger at a holding area and release when the previous
 * has cleared RELEASE_SPACING from START. Game handles customer walk-to-pickup.
 */
export class FoodConveyorSystem {
  constructor() {
    /** @type {Array<{
     *  id: number,
     *  plate: object,
     *  customer: object,
     *  seat: object,
     *  x: number,
     *  y: number,
     *  delivered: boolean,
     *  queued: boolean,
     *  released: boolean,
     * }>} */
    this.trays = [];
    this._next = 1;
  }

  /**
   * @param {object} plate
   * @param {import('../entities/Customer.js').Customer} customer
   */
  enqueue(plate, customer) {
    const seat = customer.seat || {
      x: customer.cx,
      y: customer.cy,
      label: 'Table',
    };
    const hasActive = this.trays.some((t) => !t.delivered && t.released);
    const queueIndex = this.trays.filter((t) => !t.delivered && t.queued).length;
    const tray = {
      id: this._next++,
      plate,
      customer,
      seat,
      x: hasActive ? HOLD.x - queueIndex * QUEUE_SLOT : START.x,
      y: hasActive ? HOLD.y + queueIndex * 4 : START.y,
      delivered: false,
      queued: hasActive,
      released: !hasActive,
    };
    this.trays.push(tray);
    return tray;
  }

  /**
   * @param {number} dt
   * @returns {object[]} delivered trays this frame
   */
  update(dt) {
    // Release next queued tray when the active lead has cleared spacing
    const active = this.trays.filter((t) => !t.delivered && t.released);
    const queued = this.trays.filter((t) => !t.delivered && t.queued);
    if (queued.length) {
      const lead = active[0];
      const clearToRelease = !lead || Math.hypot(lead.x - START.x, lead.y - START.y) >= RELEASE_SPACING;
      if (clearToRelease) {
        const next = queued[0];
        next.queued = false;
        next.released = true;
        next.x = START.x;
        next.y = START.y;
        // Compact remaining queue slots
        const rest = this.trays.filter((t) => !t.delivered && t.queued);
        rest.forEach((t, i) => {
          t.x = HOLD.x - i * QUEUE_SLOT;
          t.y = HOLD.y + i * 4;
        });
      }
    }

    const done = [];
    for (const tray of this.trays) {
      if (tray.delivered || tray.queued) continue;
      const tx = PICKUP.x;
      const ty = PICKUP.y;
      const dx = tx - tray.x;
      const dy = ty - tray.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) {
        tray.x = tx;
        tray.y = ty;
        tray.delivered = true;
        done.push(tray);
        continue;
      }
      const step = SPEED * dt;
      tray.x += (dx / dist) * step;
      tray.y += (dy / dist) * step;
    }
    this.trays = this.trays.filter((t) => !t.delivered);
    return done;
  }

  hasTrayFor(customer) {
    return this.trays.some((t) => t.customer === customer && !t.delivered);
  }
}
