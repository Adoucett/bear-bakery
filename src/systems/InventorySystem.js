import { getIngredient, INGREDIENTS } from '../data/ingredients.js';

export class InventorySystem {
  constructor(saved = null) {
    this.stock = {};
    for (const id of Object.keys(INGREDIENTS)) {
      this.stock[id] = { current: 10, max: 10 };
    }
    if (saved) this.restore(saved);
  }

  restore(saved) {
    for (const [id, qty] of Object.entries(saved)) {
      if (!this.stock[id]) continue;
      const max = Math.max(1, qty.max ?? this.stock[id].max);
      this.stock[id].max = max;
      this.stock[id].current = Math.max(0, Math.min(max, qty.current ?? qty));
    }
  }

  serialize() {
    return structuredClone(this.stock);
  }

  get(id) {
    return this.stock[id] ?? { current: 0, max: 0 };
  }

  take(id) {
    const item = this.stock[id];
    if (!item || item.current <= 0) return { ok: false, reason: 'empty' };
    item.current -= 1;
    return { ok: true, ingredient: getIngredient(id), remaining: item.current };
  }

  refill(id, amount = Infinity) {
    const item = this.stock[id];
    if (!item) return 0;
    const added = Math.min(item.max - item.current, amount);
    item.current += added;
    return added;
  }

  refillAll() {
    for (const id of Object.keys(this.stock)) this.refill(id);
  }

  increaseCapacity(id, amount = 5) {
    const item = this.stock[id];
    if (!item) return;
    item.max += amount;
    item.current = Math.min(item.max, item.current + amount);
  }
}
