/**
 * 4-direction facing helpers for character sprites.
 * sprite keys: {base}_front | {base}_side | {base}_back | {base}_left
 * pose keys:   {base}_sit  (waiting / eating at a seat)
 * (left may be a dedicated asset or a mirrored side view)
 */

/** @typedef {'front'|'back'|'side'|'left'} FacingDir */

/**
 * Update facing from movement delta.
 * @param {number} dx
 * @param {number} dy
 * @param {FacingDir} [prev]
 * @returns {{ facing: number, facingDir: FacingDir }}
 */
export function facingFromMove(dx, dy, prev = 'front') {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
    return { facing: prev === 'left' ? -1 : 1, facingDir: prev };
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx < 0) return { facing: -1, facingDir: 'left' };
    return { facing: 1, facingDir: 'side' };
  }
  if (dy < 0) return { facing: 1, facingDir: 'back' };
  return { facing: 1, facingDir: 'front' };
}

/**
 * Resolve image key for a character base sprite + direction.
 * @param {string} baseKey e.g. bear, bear_hat, bunny
 * @param {FacingDir} dir
 */
export function directionSpriteKey(baseKey, dir = 'front') {
  const d = dir || 'front';
  if (d === 'left') return `${baseKey}_left`;
  if (d === 'side') return `${baseKey}_side`;
  if (d === 'back') return `${baseKey}_back`;
  return `${baseKey}_front`;
}

/**
 * Pick best available image from AssetLoader for direction and optional pose.
 * Pose `sit` tries `{base}_sit` first, then falls through to direction sprites.
 * Falls back: sit → requested dir → front → side.
 * @param {import('../engine/AssetLoader.js').AssetLoader} assets
 * @param {string} baseKey
 * @param {FacingDir} dir
 * @param {string|null} [pose] e.g. 'sit'
 * @returns {{ image: CanvasImageSource|null, flip: boolean, key: string }}
 */
export function resolveDirectionImage(assets, baseKey, dir = 'front', pose = null) {
  if (!assets) return { image: null, flip: false, key: baseKey };

  const tryKeys = [];
  if (pose === 'sit') {
    tryKeys.push(`${baseKey}_sit`);
  }
  if (dir === 'left') {
    tryKeys.push(`${baseKey}_left`, `${baseKey}_side`);
  } else if (dir === 'side') {
    tryKeys.push(`${baseKey}_side`);
  } else if (dir === 'back') {
    tryKeys.push(`${baseKey}_back`);
  } else {
    tryKeys.push(`${baseKey}_front`);
  }
  tryKeys.push(`${baseKey}_front`, `${baseKey}_side`);

  for (const key of tryKeys) {
    const image = assets.get(key);
    if (image) {
      const flip = dir === 'left' && key.endsWith('_side') && !assets.get(`${baseKey}_left`);
      return { image, flip, key };
    }
  }
  return { image: null, flip: false, key: baseKey };
}

/**
 * Seated customers (waiting / eating at a table) use the sit pose when available.
 * @param {string|null|undefined} state
 */
export function poseFromState(state) {
  // The generated sit set has inconsistent chairs, framing, and chroma-key
  // residue. Keep customers on their clean directional sprites until a
  // production-quality sit set is available.
  const USE_HQ_SIT_POSES = false;
  if (USE_HQ_SIT_POSES && (state === 'waiting' || state === 'eating')) return 'sit';
  return null;
}
