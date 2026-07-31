import { tableDefinitions } from '../world/RestaurantLayout.js';

/**
 * Assigns customers to real café tables (respects bought extra tables).
 */
export class SeatingSystem {
  /**
   * @param {import('./EconomySystem.js').EconomySystem} economy
   */
  constructor(economy) {
    this.economy = economy;
    /** @type {Map<string, import('../entities/Customer.js').Customer>} */
    this.occupied = new Map();
    /** @type {Array<{ id: string, tableId: string, label: string, x: number, y: number, dirty: boolean }>} */
    this.dirty = [];
  }

  /** All seat slots including upgrade tables */
  seats() {
    const seats = [];
    for (const table of this.tables()) {
      for (let i = 0; i < table.capacity; i += 1) {
        seats.push({
          id: `${table.id}_${i}`,
          tableId: table.id,
          label: table.id.startsWith('extraTable')
            ? `Extra Table ${table.id.replace('extraTable', '')}`
            : `Table ${table.id.replace('table', '')}`,
          x: table.x + 20 + i * 36,
          y: table.y + table.h + 12,
        });
      }
    }
    return seats;
  }

  /** Shared visible/collidable table list. */
  tables() {
    return tableDefinitions(this.economy.extraTables || 0);
  }

  freeSeats() {
    return this.seats().filter((s) => !this.occupied.has(s.id));
  }

  /**
   * @param {import('../entities/Customer.js').Customer} customer
   */
  assign(customer) {
    const free = this.freeSeats();
    if (!free.length) return null;
    const seat = free[0];
    this.occupied.set(seat.id, customer);
    customer.seat = seat;
    return seat;
  }

  /**
   * @param {import('../entities/Customer.js').Customer} customer
   */
  release(customer, leaveDirty = true) {
    const seat = customer.seat;
    if (!seat) return;
    this.occupied.delete(seat.id);
    if (leaveDirty && customer.served) {
      this.dirty.push({
        id: `dirty_${seat.id}_${Date.now()}`,
        tableId: seat.tableId,
        label: seat.label,
        x: seat.x,
        y: seat.y,
        dirty: true,
      });
    }
    customer.seat = null;
  }

  dirtyCount() {
    return this.dirty.length;
  }

  /**
   * Pick up nearest dirty plate within range of a point.
   * @param {number} x
   * @param {number} y
   * @param {number} [range]
   */
  takeNear(x, y, range = 56) {
    let best = null;
    let bestDist = range;
    for (const plate of this.dirty) {
      const d = Math.hypot(plate.x - x, plate.y - y);
      if (d < bestDist) {
        best = plate;
        bestDist = d;
      }
    }
    if (!best) return null;
    this.dirty = this.dirty.filter((p) => p !== best);
    return best;
  }

  take(plate) {
    if (!plate || !this.dirty.includes(plate)) return null;
    this.dirty = this.dirty.filter((item) => item !== plate);
    return plate;
  }

  returnDish(plate) {
    if (plate && !this.dirty.includes(plate)) this.dirty.push(plate);
  }

  hitDirty(x, y, range = 64) {
    return this.dirty.find((p) => Math.hypot(p.x - x, p.y - y) < range) || null;
  }
}
