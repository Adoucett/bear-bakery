import { CONFIG } from '../config.js';

export class InteractionSystem {
  constructor() {
    /** @type {object|null} */
    this.nearest = null;
  }

  /**
   * @param {{cx:number,cy:number}} player
   * @param {object[]} interactables
   */
  update(player, interactables) {
    let best = null;
    let bestDist = CONFIG.INTERACT_RANGE;
    for (const item of interactables) {
      const ix = item.x + item.w / 2;
      const iy = item.y + item.h / 2;
      const d = Math.hypot(player.cx - ix, player.cy - iy);
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    this.nearest = best;
    return best;
  }

  /**
   * True when the player stands close enough to use this specific fixture.
   * Clicking a station should use the station you clicked, not whichever one
   * happens to be marginally nearer.
   * @param {{cx:number,cy:number}} player
   * @param {{x:number,y:number,w:number,h:number}|null} item
   */
  inReach(player, item) {
    if (!item) return false;
    const ix = item.x + item.w / 2;
    const iy = item.y + item.h / 2;
    return Math.hypot(player.cx - ix, player.cy - iy) <= CONFIG.INTERACT_RANGE;
  }

  /**
   * Hit-test mouse against interactables (slightly expanded).
   * @param {number} mx
   * @param {number} my
   * @param {object[]} interactables
   */
  hitTest(mx, my, interactables) {
    const pad = 6;
    for (const item of interactables) {
      if (
        mx >= item.x - pad &&
        mx <= item.x + item.w + pad &&
        my >= item.y - pad &&
        my <= item.y + item.h + pad
      ) {
        return item;
      }
    }
    return null;
  }
}
