import { isoToWorld } from '../world/IsoMath.js';

/**
 * Gentle follow camera for the oblique bakery map.
 * Keeps most of the floor readable — no aggressive zoom.
 */
export class IsoCamera {
  constructor() {
    this.x = 460;
    this.y = 330;
    this.zoom = 1;
    this.targetX = this.x;
    this.targetY = this.y;
    this.targetZoom = this.zoom;
    this.followZoom = 1.12;
    this.mode = 'overview';
    this.focusTimer = 0;
  }

  setOverview() {
    this.mode = 'overview';
    this.targetX = 460;
    this.targetY = 330;
    this.targetZoom = 1.02;
  }

  follow(entity, zoom = 1.12) {
    this.mode = 'follow';
    this.followZoom = zoom;
    this.targetX = entity.cx ?? entity.x;
    this.targetY = entity.cy ?? entity.y;
    this.targetZoom = zoom;
  }

  focus(point, zoom = 1.22, seconds = 3) {
    this.mode = 'focus';
    this.focusTimer = seconds;
    this.targetX = point.cx ?? point.x;
    this.targetY = point.cy ?? point.y;
    this.targetZoom = zoom;
  }

  update(dt, followTarget) {
    if (this.mode === 'focus') {
      this.focusTimer -= dt;
      if (this.focusTimer <= 0) this.mode = 'follow';
    }
    if (this.mode === 'follow' && followTarget) {
      this.targetX = followTarget.cx ?? followTarget.x;
      this.targetY = followTarget.cy ?? followTarget.y;
      this.targetZoom = this.followZoom;
    }
    const amount = Math.min(1, dt * 4);
    this.x += (this.targetX - this.x) * amount;
    this.y += (this.targetY - this.y) * amount;
    this.zoom += (this.targetZoom - this.zoom) * amount;
  }

  screenToWorld(sx, sy) {
    return isoToWorld(sx, sy, this);
  }

  begin() {}
  end() {}
}
