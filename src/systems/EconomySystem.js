import { getUpgrade } from '../data/upgrades.js';

/** Staff roles were rewritten; Bunny serves from the case when idle chores allow. Keep old saves valid. */
const LEGACY_UPGRADE_IDS = {
  server: 'busser',
  prepHelper: 'custodian',
};

export class EconomySystem {
  constructor(saved = {}) {
    this.money = saved.money ?? 80;
    this.owned = new Set(
      (saved.owned ?? []).map((id) => LEGACY_UPGRADE_IDS[id] || id),
    );
    this.ambience = saved.ambience ?? 0;
    this.extraTables = saved.extraTables ?? 0;
    this.cosmetics = {
      hat: !!(saved.cosmetics?.hat),
      glasses: !!(saved.cosmetics?.glasses),
    };
    // Auto-equip owned cosmetics from save flags
    if (saved.equipped) {
      this.cosmetics.hat = !!saved.equipped.hat;
      this.cosmetics.glasses = !!saved.equipped.glasses;
    }
  }

  canBuy(id) {
    const upgrade = getUpgrade(id);
    return !!upgrade && !this.owned.has(id) && this.money >= upgrade.price;
  }

  /**
   * @param {string} id
   * @param {import('./InventorySystem.js').InventorySystem} inventory
   * @param {import('./StockSystem.js').StockSystem} [stock]
   */
  buy(id, inventory, stock = null) {
    const upgrade = getUpgrade(id);
    if (!upgrade) return { ok: false, reason: 'missing' };
    if (this.owned.has(id)) return { ok: false, reason: 'owned' };
    if (this.money < upgrade.price) return { ok: false, reason: 'money' };
    this.money -= upgrade.price;
    this.owned.add(id);
    if (upgrade.effect === 'ambience') this.ambience += upgrade.amount;
    if (upgrade.effect === 'tables') this.extraTables += upgrade.amount;
    if (upgrade.effect === 'capacity') {
      for (const key of Object.keys(inventory.stock)) {
        inventory.increaseCapacity(key, upgrade.amount);
      }
    }
    if (upgrade.effect === 'stockCapacity' && stock) {
      stock.increaseCapacity(upgrade.amount);
    }
    if (upgrade.effect === 'cosmetic' && upgrade.cosmetic) {
      this.cosmetics[upgrade.cosmetic] = true;
    }
    return { ok: true, upgrade };
  }

  has(id) {
    return this.owned.has(id);
  }

  /** Tip multiplier from ambience decor */
  tipBonus(basePrice) {
    if (this.ambience <= 0) return 0;
    return Math.max(1, Math.round(basePrice * 0.15 * this.ambience));
  }

  bearSpriteKey() {
    const hat = this.has('chefHat') && this.cosmetics.hat;
    const glasses = this.has('sunglasses') && this.cosmetics.glasses;
    if (hat && glasses) return 'bear_hat_glasses';
    if (hat) return 'bear_hat';
    if (glasses) return 'bear_glasses';
    return 'bear';
  }

  toggleCosmetic(kind) {
    if (kind === 'hat' && this.has('chefHat')) {
      this.cosmetics.hat = !this.cosmetics.hat;
      return this.cosmetics.hat;
    }
    if (kind === 'glasses' && this.has('sunglasses')) {
      this.cosmetics.glasses = !this.cosmetics.glasses;
      return this.cosmetics.glasses;
    }
    return null;
  }

  equipClassic() {
    this.cosmetics.hat = false;
    this.cosmetics.glasses = false;
    return this.bearSpriteKey();
  }

  earn(amount) {
    this.money += Math.max(0, amount);
  }

  serialize() {
    return {
      money: this.money,
      owned: [...this.owned],
      ambience: this.ambience,
      extraTables: this.extraTables,
      cosmetics: { ...this.cosmetics },
      equipped: { ...this.cosmetics },
    };
  }
}
