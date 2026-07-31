/**
 * Oblique 2.5D projection for the bakery floor.
 * World coords stay in pixels (movement/collision unchanged).
 * Mild X-skew + Y foreshortening — cozy top-down map with depth, not hard iso diamonds.
 */

export const ISO = {
  originX: 480,
  originY: 320,
  scale: 1,
  /** How much world-Y pulls screen-X (oblique tilt). Keep small for readability. */
  xSkew: 0.22,
  /** Depth compression on world-Y → screen-Y. */
  yScale: 0.78,
};

export function worldToIso(x, y, camera = { x: 480, y: 320, zoom: 1 }) {
  const z = ISO.scale * (camera.zoom || 1);
  const dx = (x - camera.x) * z;
  const dy = (y - camera.y) * z;
  return {
    x: ISO.originX + dx - dy * ISO.xSkew,
    y: ISO.originY + dy * ISO.yScale,
  };
}

export function isoToWorld(screenX, screenY, camera = { x: 480, y: 320, zoom: 1 }) {
  const z = ISO.scale * (camera.zoom || 1);
  const sx = (screenX - ISO.originX) / z;
  const sy = (screenY - ISO.originY) / (ISO.yScale * z);
  // sx = dx - dy * xSkew, sy = dy  →  dx = sx + sy * xSkew
  return {
    x: camera.x + sx + sy * ISO.xSkew,
    y: camera.y + sy,
  };
}

export function isoPoint(ctx, x, y, camera) {
  const p = worldToIso(x, y, camera);
  ctx.lineTo(p.x, p.y);
}

/** Draw a world-axis AABB as an oblique parallelogram. */
export function isoDiamond(ctx, x, y, width, height, camera) {
  const a = worldToIso(x, y, camera);
  const b = worldToIso(x + width, y, camera);
  const c = worldToIso(x + width, y + height, camera);
  const d = worldToIso(x, y + height, camera);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

/** Depth key: farther south (higher world Y / feet) draws later. */
export function isoDepth(x, y, z = 0) {
  return y + z * 0.01 + x * 0.001;
}
