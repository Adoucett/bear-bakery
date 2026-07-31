import { RECIPES } from '../data/recipes.js';

/**
 * Finished baked goods ready to sell (make-ahead pastry case).
 */
export class StockSystem {
  /**
   * @param {{ items?: Record<string, number>, capacity?: number }|null} saved
   */
  constructor(saved = null) {
    /** @type {Record<string, number>} */
    this.items = {};
    for (const id of Object.keys(RECIPES)) this.items[id] = 0;
    this.capacity = 12;
    if (saved) this.restore(saved);
  }

  restore(saved) {
    this.capacity = Math.max(4, saved.capacity ?? this.capacity);
    for (const [id, n] of Object.entries(saved.items || {})) {
      if (id in this.items) this.items[id] = Math.max(0, n | 0);
    }
  }

  serialize() {
    return { items: { ...this.items }, capacity: this.capacity };
  }

  total() {
    return Object.values(this.items).reduce((a, b) => a + b, 0);
  }

  count(id) {
    return this.items[id] || 0;
  }

  has(id) {
    return this.count(id) > 0;
  }

  roomLeft() {
    return Math.max(0, this.capacity - this.total());
  }

  /**
   * @param {string} recipeId
   * @param {number} [n]
   */
  add(recipeId, n = 1) {
    if (!(recipeId in this.items)) return { ok: false, reason: 'unknown' };
    if (this.roomLeft() < n) return { ok: false, reason: 'full' };
    this.items[recipeId] += n;
    return { ok: true, count: this.items[recipeId] };
  }

  /**
   * @param {string} recipeId
   */
  take(recipeId) {
    if (!this.has(recipeId)) return { ok: false, reason: 'empty' };
    this.items[recipeId] -= 1;
    return { ok: true, remaining: this.items[recipeId] };
  }

  increaseCapacity(amount = 4) {
    this.capacity += amount;
  }

  /** List non-empty stock for HUD */
  list() {
    return Object.entries(this.items)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ id, n, recipe: RECIPES[id] }));
  }
}
