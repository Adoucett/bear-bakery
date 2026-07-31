import { bowlMatchesRecipe, getRecipe, RECIPES } from '../data/recipes.js';
import { getIngredient } from '../data/ingredients.js';

/** One physical mixing bowl on the counter. */
export class MixingBowlState {
  /**
   * @param {string} id
   * @param {string} label
   */
  constructor(id, label) {
    this.id = id;
    this.label = label;
    /** @type {string[]} */
    this.ingredients = [];
    /** @type {{ recipe: object, ingredients: string[] }|null} */
    this.dough = null;
  }

  get isEmpty() {
    return this.ingredients.length === 0 && !this.dough;
  }

  get hasDough() {
    return !!this.dough;
  }
}

/** @returns {object} one oven slot with independent bake state */
export function createOvenState(id) {
  return {
    id,
    /** @type {'empty'|'baking'|'done'} */
    state: 'empty',
    bakeTimer: 0,
    bakeTotal: 0,
    /** @type {object|null} */
    activeRecipe: null,
    /** @type {string[]|null} */
    doughIngredients: null,
    ovenFromBowlId: null,
  };
}

/**
 * Multi-bowl kitchen: scoop into any bowl, auto-seal dough when a recipe matches,
 * bake one tray at a time per oven, carry finished plates to the pastry case.
 */
export class CookingSystem {
  constructor() {
    this.bowls = [
      new MixingBowlState('bowl1', 'Bowl A'),
      new MixingBowlState('bowl2', 'Bowl B'),
      new MixingBowlState('bowl3', 'Bowl C'),
    ];
    this.activeBowlId = 'bowl1';
    /** @type {ReturnType<typeof createOvenState>[]} */
    this.ovens = [createOvenState('oven')];
    /** @type {object|null} leftover compat — prefer player.heldPlate */
    this.plated = null;
  }

  /** @deprecated use bowls — kept for older HUD snippets during transition */
  get bowl() {
    return this.getActiveBowl()?.ingredients || [];
  }

  /** Primary oven state — backward compat for older callers. */
  get ovenState() {
    return this.getOven('oven').state;
  }

  set ovenState(value) {
    this.getOven('oven').state = value;
  }

  get bakeTimer() {
    return this.getOven('oven').bakeTimer;
  }

  set bakeTimer(value) {
    this.getOven('oven').bakeTimer = value;
  }

  get bakeTotal() {
    return this.getOven('oven').bakeTotal;
  }

  set bakeTotal(value) {
    this.getOven('oven').bakeTotal = value;
  }

  get activeRecipe() {
    return this.getOven('oven').activeRecipe;
  }

  set activeRecipe(value) {
    this.getOven('oven').activeRecipe = value;
  }

  get doughIngredients() {
    return this.getOven('oven').doughIngredients;
  }

  set doughIngredients(value) {
    this.getOven('oven').doughIngredients = value;
  }

  get ovenFromBowlId() {
    return this.getOven('oven').ovenFromBowlId;
  }

  set ovenFromBowlId(value) {
    this.getOven('oven').ovenFromBowlId = value;
  }

  get hasDoughReady() {
    return this.bowls.some((b) => b.hasDough);
  }

  /** @param {string} [id] */
  getOven(id = 'oven') {
    return this.ovens.find((o) => o.id === id) || this.ovens[0];
  }

  /** Add the second oven slot when the upgrade is owned. */
  ensureOvens(hasSecond = false) {
    if (hasSecond && !this.ovens.some((o) => o.id === 'oven2')) {
      this.ovens.push(createOvenState('oven2'));
    }
  }

  anyOvenBaking() {
    return this.ovens.some((o) => o.state === 'baking');
  }

  anyOvenDone() {
    return this.ovens.some((o) => o.state === 'done');
  }

  /** First oven that can accept dough, or null. */
  firstAvailableOven() {
    return this.ovens.find((o) => o.state === 'empty') || null;
  }

  getBowl(id) {
    return this.bowls.find((b) => b.id === id) || null;
  }

  getActiveBowl() {
    return this.getBowl(this.activeBowlId) || this.bowls[0];
  }

  setActiveBowl(id) {
    if (this.getBowl(id)) this.activeBowlId = id;
  }

  /** Any bowl that already has sealed dough waiting for the oven. */
  firstDoughBowl() {
    return this.bowls.find((b) => b.hasDough) || null;
  }

  /**
   * Pick the best bowl for an ingredient scoop.
   * Prefers active bowl, then a bowl that progresses toward a recipe, then empty.
   * @param {string} ingredientId
   */
  pickBowlFor(ingredientId) {
    const active = this.getActiveBowl();
    if (active && !active.hasDough && !active.ingredients.includes(ingredientId) && active.ingredients.length < 8) {
      return active;
    }
    // Prefer bowls where this ingredient is still needed for some unfinished recipe path
    let best = null;
    let bestScore = -1;
    for (const bowl of this.bowls) {
      if (bowl.hasDough) continue;
      if (bowl.ingredients.includes(ingredientId)) continue;
      if (bowl.ingredients.length >= 8) continue;
      const next = [...bowl.ingredients, ingredientId];
      let score = bowl === active ? 2 : 0;
      for (const r of Object.values(RECIPES)) {
        if (!r.ingredients.includes(ingredientId)) continue;
        const have = r.ingredients.filter((id) => next.includes(id)).length;
        const need = r.ingredients.length;
        // Completing a recipe wins, extras or not.
        if (have === need) score += next.length === need ? 100 : 80;
        else if (bowl.ingredients.every((id) => r.ingredients.includes(id))) score += have * 10;
      }
      if (bowl.isEmpty) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = bowl;
      }
    }
    return best;
  }

  /**
   * Scoop an ingredient into a bowl. Seals automatically as soon as the bowl
   * holds everything some recipe needs, even with extras present.
   * @param {string} ingredientId
   * @param {string} [bowlId]
   * @param {{ targetRecipe?: object|null, inventory?: object|null }} [opts]
   */
  addIngredient(ingredientId, bowlId, opts = {}) {
    const bowl = bowlId ? this.getBowl(bowlId) : this.pickBowlFor(ingredientId);
    if (!bowl) return { ok: false, reason: 'no_bowl' };
    if (bowl.hasDough) return { ok: false, reason: 'dough_waiting', bowl };
    if (bowl.ingredients.includes(ingredientId)) return { ok: false, reason: 'already', bowl };
    if (bowl.ingredients.length >= 8) return { ok: false, reason: 'full', bowl };

    this.activeBowlId = bowl.id;
    bowl.ingredients.push(ingredientId);

    const sealed = this._tryAutoSeal(
      bowl,
      opts.targetRecipe || null,
      opts.inventory || null,
    );
    return {
      ok: true,
      bowl,
      sealed: sealed || null,
    };
  }

  /**
   * Seal a bowl into dough once it holds everything a recipe needs.
   * @param {MixingBowlState} bowl
   * @param {object|null} [targetRecipe] the waiting customer's order, if any
   * @param {import('./InventorySystem.js').InventorySystem|null} [inventory]
   */
  _tryAutoSeal(bowl, targetRecipe = null, inventory = null) {
    if (bowl.hasDough || bowl.ingredients.length === 0) return null;
    const recipe = this._guessBest(bowl.ingredients, targetRecipe);
    if (!recipe) return null;
    this._sealBowl(bowl, recipe, inventory);
    return recipe;
  }

  /**
   * Commit a recipe to a bowl. Dough carries only the canonical ingredient
   * list so a stray extra can never trigger a customer's dislike, and any
   * surplus goes back to the pantry rather than vanishing.
   * @param {MixingBowlState} bowl
   * @param {object} recipe
   * @param {import('./InventorySystem.js').InventorySystem|null} [inventory]
   * @returns {string[]} ingredients returned to inventory
   */
  _sealBowl(bowl, recipe, inventory = null) {
    const extras = bowl.ingredients.filter((id) => !recipe.ingredients.includes(id));
    bowl.dough = { recipe, ingredients: [...recipe.ingredients] };
    bowl.ingredients = [];
    if (inventory) {
      for (const id of extras) inventory.refill(id, 1);
    }
    return extras;
  }

  /**
   * Best recipe for what is in the bowl. Extra ingredients are fine: as long
   * as everything a recipe needs is present it can be made. Prefers an exact
   * match, then the treat the guest actually ordered, then the recipe that
   * wastes the fewest leftovers.
   * @param {string[]} ids
   * @param {object|null} [targetRecipe]
   */
  _guessBest(ids, targetRecipe = null) {
    const matches = Object.values(RECIPES).filter((r) => bowlMatchesRecipe(ids, r));
    if (!matches.length) return null;

    const exact = matches.find((r) => r.ingredients.length === ids.length);
    if (exact) return exact;
    if (targetRecipe && matches.some((r) => r.id === targetRecipe.id)) return targetRecipe;

    return matches.reduce((best, r) =>
      ids.length - r.ingredients.length < ids.length - best.ingredients.length ? r : best,
    );
  }

  /** @deprecated use _guessBest — kept for older callers/tests */
  _guessExact(ids) {
    for (const r of Object.values(RECIPES)) {
      if (ids.length === r.ingredients.length && bowlMatchesRecipe(ids, r)) return r;
    }
    return null;
  }

  /**
   * Manual combine (Mix button / interact). Extra ingredients are allowed;
   * incomplete bowls report what is still missing.
   * @param {string} [bowlId]
   * @param {object|null} [targetRecipe]
   * @param {import('./InventorySystem.js').InventorySystem|null} [inventory]
   */
  combine(bowlId, targetRecipe = null, inventory = null) {
    const bowl = this.getBowl(bowlId || this.activeBowlId) || this.getActiveBowl();
    if (!bowl) return { ok: false, reason: 'empty' };
    if (bowl.hasDough) return { ok: true, recipe: bowl.dough.recipe, already: true, bowl };
    if (bowl.ingredients.length === 0) return { ok: false, reason: 'empty', bowl };

    const recipe = this._guessBest(bowl.ingredients, targetRecipe);

    if (!recipe) {
      // Soft fail — never lock inventory; suggest put-back
      const partial = targetRecipe && !bowlMatchesRecipe(bowl.ingredients, targetRecipe)
        ? targetRecipe
        : Object.values(RECIPES).find((r) => bowl.ingredients.every((id) => r.ingredients.includes(id)));
      if (partial && !bowlMatchesRecipe(bowl.ingredients, partial)) {
        return {
          ok: false,
          reason: 'incomplete',
          recipe: partial,
          missing: partial.ingredients.filter((i) => !bowl.ingredients.includes(i)),
          bowl,
        };
      }
      return { ok: false, reason: 'unknown', bowl };
    }

    const extras = this._sealBowl(bowl, recipe, inventory);
    this.activeBowlId = bowl.id;
    return { ok: true, recipe, bowl, extras };
  }

  /**
   * Return bowl contents (loose ingredients or sealed dough) back to inventory.
   * @param {import('./InventorySystem.js').InventorySystem} inventory
   * @param {string} [bowlId]
   */
  putBack(inventory, bowlId) {
    const bowl = this.getBowl(bowlId || this.activeBowlId) || this.getActiveBowl();
    if (!bowl) return { ok: false, reason: 'none', returned: [] };
    /** @type {string[]} */
    const returned = [];
    if (bowl.hasDough) {
      for (const id of bowl.dough.ingredients) {
        inventory.refill(id, 1);
        returned.push(id);
      }
      bowl.dough = null;
    }
    for (const id of bowl.ingredients) {
      inventory.refill(id, 1);
      returned.push(id);
    }
    bowl.ingredients = [];
    return { ok: returned.length > 0, returned, bowl };
  }

  /** Put back every bowl (panic clear). */
  putBackAll(inventory) {
    let total = 0;
    for (const bowl of this.bowls) {
      const res = this.putBack(inventory, bowl.id);
      total += res.returned?.length || 0;
    }
    return total;
  }

  /**
   * Load sealed dough into an oven.
   * @param {string} [bowlId]
   * @param {string} [ovenId]
   */
  startBake(bowlId, ovenId = 'oven') {
    const oven = this.getOven(ovenId);
    if (oven.state === 'baking') return { ok: false, reason: 'busy' };
    if (oven.state === 'done') return { ok: false, reason: 'take_first' };

    let bowl = bowlId ? this.getBowl(bowlId) : null;
    if (!bowl?.hasDough) bowl = this.firstDoughBowl();
    if (!bowl?.hasDough) return { ok: false, reason: 'no_dough' };

    oven.activeRecipe = bowl.dough.recipe;
    oven.doughIngredients = [...bowl.dough.ingredients];
    oven.ovenFromBowlId = bowl.id;
    bowl.dough = null;
    oven.state = 'baking';
    oven.bakeTotal = oven.activeRecipe.bakeTime;
    oven.bakeTimer = oven.bakeTotal;
    this.activeBowlId = bowl.id;
    return { ok: true, bakeTime: oven.bakeTotal, recipe: oven.activeRecipe, bowl, ovenId: oven.id };
  }

  update(dt) {
    for (const oven of this.ovens) {
      if (oven.state === 'baking') {
        oven.bakeTimer -= dt;
        if (oven.bakeTimer <= 0) {
          oven.bakeTimer = 0;
          oven.state = 'done';
        }
      }
    }
  }

  /** Pull finished bake — caller should put on player hands to carry to case. */
  takeFromOven(ovenId = 'oven') {
    const oven = this.getOven(ovenId);
    if (oven.state !== 'done') return null;
    const plate = {
      recipe: oven.activeRecipe,
      ingredients: [...(oven.doughIngredients || [])],
    };
    this.plated = plate;
    oven.state = 'empty';
    oven.doughIngredients = null;
    oven.activeRecipe = null;
    oven.ovenFromBowlId = null;
    return plate;
  }

  /**
   * @param {object} plate
   * @param {import('../entities/Customer.js').Customer} customer
   */
  judgeServe(plate, customer) {
    if (!plate || !customer) return { good: false, reason: 'none', emote: 'sad' };
    const disliked = (customer.species.dislikeIngredients || []).filter((id) =>
      plate.ingredients.includes(id),
    );
    if (disliked.length) {
      return {
        good: false,
        reason: 'dislike',
        emote: 'spit',
        bad: disliked.map((id) => getIngredient(id)?.name || id),
      };
    }
    const wanted = customer.order || getRecipe(customer.species.prefers);
    if (plate.recipe?.id !== wanted.id) {
      return { good: false, reason: 'wrong', emote: 'sad', wanted };
    }
    return { good: true, reason: 'perfect', emote: 'happy' };
  }

  clearPlated() {
    this.plated = null;
  }

  serialize() {
    return {
      activeBowlId: this.activeBowlId,
      bowls: this.bowls.map((b) => ({
        id: b.id,
        ingredients: [...b.ingredients],
        dough: b.dough
          ? { recipeId: b.dough.recipe.id, ingredients: [...b.dough.ingredients] }
          : null,
      })),
      ovens: this.ovens.map((o) => ({
        id: o.id,
        state: o.state,
        bakeTimer: o.bakeTimer,
        bakeTotal: o.bakeTotal,
        activeRecipeId: o.activeRecipe?.id ?? null,
        doughIngredients: o.doughIngredients ? [...o.doughIngredients] : null,
        ovenFromBowlId: o.ovenFromBowlId,
      })),
      // Legacy single-oven fields for older saves reading partial state
      ovenState: this.ovenState,
      bakeTimer: this.bakeTimer,
      bakeTotal: this.bakeTotal,
      activeRecipeId: this.activeRecipe?.id ?? null,
      doughIngredients: this.doughIngredients ? [...this.doughIngredients] : null,
      ovenFromBowlId: this.ovenFromBowlId,
    };
  }

  /**
   * @param {object|null} saved
   */
  restore(saved) {
    if (!saved) return;
    if (saved.activeBowlId) this.activeBowlId = saved.activeBowlId;
    for (const row of saved.bowls || []) {
      const bowl = this.getBowl(row.id);
      if (!bowl) continue;
      bowl.ingredients = [...(row.ingredients || [])];
      if (row.dough?.recipeId) {
        bowl.dough = {
          recipe: getRecipe(row.dough.recipeId),
          ingredients: [...(row.dough.ingredients || [])],
        };
      } else {
        bowl.dough = null;
      }
    }

    if (saved.ovens?.length) {
      for (const row of saved.ovens) {
        let oven = this.getOven(row.id);
        if (!oven && row.id === 'oven2') {
          this.ovens.push(createOvenState('oven2'));
          oven = this.getOven('oven2');
        }
        if (!oven) continue;
        oven.state = row.state || 'empty';
        oven.bakeTimer = row.bakeTimer || 0;
        oven.bakeTotal = row.bakeTotal || 0;
        oven.activeRecipe = row.activeRecipeId ? getRecipe(row.activeRecipeId) : null;
        oven.doughIngredients = row.doughIngredients ? [...row.doughIngredients] : null;
        oven.ovenFromBowlId = row.ovenFromBowlId || null;
      }
    } else {
      const primary = this.getOven('oven');
      primary.state = saved.ovenState || 'empty';
      primary.bakeTimer = saved.bakeTimer || 0;
      primary.bakeTotal = saved.bakeTotal || 0;
      primary.activeRecipe = saved.activeRecipeId ? getRecipe(saved.activeRecipeId) : null;
      primary.doughIngredients = saved.doughIngredients ? [...saved.doughIngredients] : null;
      primary.ovenFromBowlId = saved.ovenFromBowlId || null;
    }
    this.plated = null;
  }

  /** Reset kitchen (new day) without refunding — call putBackAll first if needed. */
  resetKitchen() {
    for (const bowl of this.bowls) {
      bowl.ingredients = [];
      bowl.dough = null;
    }
    for (const oven of this.ovens) {
      oven.state = 'empty';
      oven.bakeTimer = 0;
      oven.bakeTotal = 0;
      oven.activeRecipe = null;
      oven.doughIngredients = null;
      oven.ovenFromBowlId = null;
    }
    this.plated = null;
    this.activeBowlId = 'bowl1';
  }
}
