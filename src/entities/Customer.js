import { CONFIG } from '../config.js';
import { getRecipe } from '../data/recipes.js';
import { rollProfile } from '../data/bios.js';
import {
  fillDialogueSpoken,
  orderLineFor,
  voicedChatLine,
  voicedGreetLine,
} from '../data/dialogue.js';
import { Character, moveWithCollision } from './Character.js';
import { facingFromMove } from './Facing.js';
import { PATISSERIE } from '../world/RestaurantLayout.js';

/** @typedef {'enter'|'queue'|'greeting'|'waitingForSeat'|'walkingToTable'|'waiting'|'eating'|'restroomWalking'|'restroomUsing'|'washingHands'|'leaving'|'done'} CustomerState */

/**
 * Roll a liked recipe. Early days stick to favorites (easy baking).
 * @param {import('../data/species.js').Species} species
 * @param {{ easy?: boolean }} [opts]
 */
export function rollLikedOrder(species, opts = {}) {
  const likes = species.likesRecipes?.length
    ? [...species.likesRecipes]
    : [species.prefers];
  const favorite = species.prefers;
  const favorWeight = opts.easy ? 0.9 : 0.4;
  if (Math.random() < favorWeight && likes.includes(favorite)) {
    return getRecipe(favorite);
  }
  const pick = likes[Math.floor(Math.random() * likes.length)];
  return getRecipe(pick);
}

export class Customer extends Character {
  /**
   * @param {object} opts
   * @param {boolean} [opts.easy]
   */
  constructor({ species, assets, name, x, y, easy = false }) {
    super({ species, assets, x, y, name });
    this.speed = CONFIG.CUSTOMER_SPEED * (0.85 + species.patience * 0.15);
    /** @type {CustomerState} */
    this.state = 'enter';
    this.target = { ...PATISSERIE.waypoints.posQueue };
    this.order = rollLikedOrder(species, { easy });
    const profile = rollProfile(species.id, name);
    this.bio = profile.bio;
    this.friends = profile.friends;
    this.waitTimer = 0;
    this.bubbleTimer = 0;
    this.emote = null;
    this.emoteTimer = 0;
    this.ordered = false;
    this.served = false;
    this.ticketId = null;
    this.happiness = 1;
    /** @type {{ id: string, tableId: string, label: string, x: number, y: number }|null} */
    this.seat = null;
    // Voiced lines must match the recorded MP3s (fixed indices / order puns).
    this.orderLine = fillDialogueSpoken(
      orderLineFor(species.id, this.order),
      { name, order: this.order },
    );
    this.greetLine = voicedGreetLine(species.id, { name, order: this.order });
    this.chatLine = voicedChatLine(species.id, { name, order: this.order });
    this.restroomRoute = [];
    this.restroomRouteIndex = 0;
    this.restroomPause = 0;
    this._routeLastDistance = Infinity;
    this._routeStuckTimer = 0;
  }

  get speech() {
    return this.orderLine;
  }

  /**
   * @param {number} dt
   * @param {{x:number,y:number,w:number,h:number}[]} walls
   * @param {object} hooks
   */
  update(dt, walls, hooks) {
    if (this.bubbleTimer > 0) this.bubbleTimer -= dt;
    if (this.emoteTimer > 0) {
      this.emoteTimer -= dt;
      if (this.emoteTimer <= 0) this.emote = null;
    }

    if (this.state === 'done' || this.state === 'greeting' || this.state === 'waitingForSeat') return;

    if (this.state === 'restroomUsing' || this.state === 'washingHands') {
      this.restroomPause -= dt;
      if (this.restroomPause <= 0) this._advanceRestroomRoute(hooks);
      return;
    }

    if (this.state === 'waiting') {
      this.waitTimer += dt;
      const patienceLimit = CONFIG.CUSTOMER_PATIENCE * this.species.patience;
      if (this.waitTimer > patienceLimit && !this.served) {
        this.happiness = 0.4;
        this.emote = 'sad';
        this.emoteTimer = 2;
        this.state = 'leaving';
        this.target = { ...PATISSERIE.waypoints.exit };
        hooks?.onLeave?.(this, false);
      }
      return;
    }

    if (this.state === 'eating' && !this.target) {
      this.waitTimer += dt;
      if (this.waitTimer > 4) {
        hooks?.onFinishedEating?.(this);
        const route = hooks?.onRequestRestroom?.(this);
        if (route?.length) this.startRestroomVisit(route);
        else {
          this.state = 'leaving';
          this.target = { ...PATISSERIE.waypoints.exit };
        }
      }
      return;
    }

    if (this.target) {
      const dx = this.target.x - this.cx;
      const dy = this.target.y - this.cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        this._arrive(hooks);
      } else {
        const mx = (dx / dist) * this.speed * dt;
        const my = (dy / dist) * this.speed * dt;
        const face = facingFromMove(dx, dy, this.facingDir);
        this.facing = face.facing;
        this.facingDir = face.facingDir;
        this.bob = 1;
        const body = this.getBounds();
        const next = moveWithCollision(body, mx, my, walls);
        this.applyBounds(next);
        if (this.state === 'restroomWalking') {
          if (dist >= this._routeLastDistance - 0.5) this._routeStuckTimer += dt;
          else this._routeStuckTimer = 0;
          this._routeLastDistance = dist;
          // A fixture edge should never softlock a guest: safely advance after
          // a few seconds of no progress on the authored restroom route.
          if (this._routeStuckTimer > 3) {
            this.x = this.target.x - this.size / 2;
            this.y = this.target.y - this.size / 2;
            this._arrive(hooks);
          }
        }
      }
    } else {
      this.bob = 0;
    }
  }

  _arrive(hooks) {
    this.bob = 0;
    if (this.state === 'enter' || this.state === 'queue') {
      this.state = 'greeting';
      hooks?.onReadyToOrder?.(this);
    } else if (this.state === 'walkingToTable') {
      this.state = 'waiting';
      this.waitTimer = 0;
      this.target = null;
      this.bob = 0;
      this.facingDir = 'front';
      this.facing = 1;
      this.bubbleTimer = 5;
    } else if (this.state === 'eating') {
      this.target = null;
      this.waitTimer = 0;
    } else if (this.state === 'restroomWalking') {
      const step = this.restroomRoute[this.restroomRouteIndex];
      if (step?.action === 'toilet') {
        this.state = 'restroomUsing';
        this.target = null;
        this.restroomPause = step.duration || 2.5;
        this.emote = 'restroom';
        this.emoteTimer = this.restroomPause;
      } else if (step?.action === 'sink') {
        this.state = 'washingHands';
        this.target = null;
        this.restroomPause = step.duration || 2;
        this.emote = 'wash';
        this.emoteTimer = this.restroomPause;
      } else if (step?.action === 'done') {
        hooks?.onRestroomDone?.(this);
        this.state = 'leaving';
        this.target = { ...PATISSERIE.waypoints.exit };
      } else {
        this._advanceRestroomRoute(hooks);
      }
    } else if (this.state === 'leaving') {
      this.state = 'done';
    }
  }

  startRestroomVisit(route) {
    this.restroomRoute = route;
    this.restroomRouteIndex = 0;
    this.state = 'restroomWalking';
    this.waitTimer = 0;
    this._setRestroomTarget();
  }

  _setRestroomTarget() {
    const step = this.restroomRoute[this.restroomRouteIndex];
    if (!step) return;
    this.target = { x: step.x, y: step.y };
    this._routeLastDistance = Infinity;
    this._routeStuckTimer = 0;
  }

  _advanceRestroomRoute(hooks) {
    this.restroomRouteIndex += 1;
    if (this.restroomRouteIndex >= this.restroomRoute.length) {
      hooks?.onRestroomDone?.(this);
      this.state = 'leaving';
      this.target = { ...PATISSERIE.waypoints.exit };
      return;
    }
    this.state = 'restroomWalking';
    this._setRestroomTarget();
  }

  /** Hold near register until a seat opens */
  waitForSeat() {
    this.ordered = false;
    this.state = 'waitingForSeat';
    this.target = null;
    this.bob = 0;
  }

  /**
   * @param {{ id: string, label: string, x: number, y: number }} seat
   */
  placeOrder(seat) {
    this.ordered = true;
    this.waitTimer = 0;
    this.bubbleTimer = 5;
    this.seat = seat;
    this.state = 'walkingToTable';
    this.target = { x: seat.x, y: seat.y };
  }

  /**
   * @param {boolean} good
   * @param {'happy'|'sad'|'spit'} [emote]
   */
  receiveFood(good = true, emote = good ? 'happy' : 'sad') {
    this.served = true;
    this.happiness = good ? 1 : 0.3;
    this.emote = emote;
    this.emoteTimer = emote === 'spit' ? 3.5 : 2.5;
    this.state = 'eating';
    this.waitTimer = 0;
    this.bob = 0;
    this.facingDir = 'front';
    this.facing = 1;
    // Stay at assigned seat if we have one (sit pose via state)
    if (this.seat) {
      this.target = null;
      this.x = this.seat.x - this.size / 2;
      this.y = this.seat.y - this.size;
    } else {
      this.target = { ...PATISSERIE.waypoints.diningSeat };
      this.target.x += (Math.random() - 0.5) * 80;
      this.target.y += (Math.random() - 0.5) * 40;
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} time
   */
  draw(ctx, time) {
    super.draw(ctx, time);

    if (this.emote) {
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      const icon =
        this.emote === 'happy' ? '😄' :
        this.emote === 'spit' ? '🤢💨' :
        this.emote === 'restroom' ? '🚻' :
        this.emote === 'wash' ? '🧼' :
        '😢';
      ctx.fillText(icon, this.cx, this.y - 22);
    }

    if ((this.state === 'waiting' || this.state === 'walkingToTable') && this.order) {
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.order.emoji, this.cx + 18, this.y + 8);
    }
  }
}
