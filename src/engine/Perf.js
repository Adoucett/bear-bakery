/**
 * Runtime performance profile — phones get a lighter canvas/sprite path.
 * iPhone lag was mostly max DPR * huge PNG downscales every frame.
 */

function coarsePointer() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function smallViewport() {
  const w = Math.min(window.innerWidth || 960, window.innerHeight || 640);
  return w < 900;
}

function touchPrimary() {
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}

/**
 * @returns {{
 *  mobile: boolean,
 *  maxDpr: number,
 *  spriteMaxEdge: number,
 *  smoothing: 'low'|'medium'|'high',
 *  shadows: boolean,
 *  desynchronized: boolean,
 *  targetFps: number,
 * }}
 */
export function detectPerf() {
  const mobile = coarsePointer() || (touchPrimary() && smallViewport());
  // iPhone retina at DPR 3 + fullscreen ≈ millions of pixels/frame.
  const maxDpr = mobile ? 1.5 : 2;
  return {
    mobile,
    maxDpr,
    /** Downscale character/furniture bitmaps once at load. */
    spriteMaxEdge: mobile ? 128 : 192,
    smoothing: mobile ? 'medium' : 'high',
    shadows: !mobile,
    desynchronized: !mobile,
    targetFps: mobile ? 30 : 60,
  };
}

/** @type {ReturnType<typeof detectPerf>|null} */
let cached = null;

export function getPerf() {
  if (!cached) cached = detectPerf();
  return cached;
}

/** Re-evaluate after orientation / resize (rare). */
export function refreshPerf() {
  cached = detectPerf();
  return cached;
}
