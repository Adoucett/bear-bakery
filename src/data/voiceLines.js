/**
 * Exact spoken transcripts from the voice manifest — keep on-screen text
 * identical to the MP3s (no {name} substitution drift).
 */
import manifest from '../../assets/audio/voices/manifest.json' with { type: 'json' };

/** @type {Map<string, string>} */
const TEXTS = new Map();

for (const clip of manifest.clips || []) {
  if (!clip?.speciesId || !clip?.bucket || !clip?.text) continue;
  const full = `${clip.speciesId}:${clip.bucket}:${clip.recipeId || ''}`;
  TEXTS.set(full, clip.text);
  const fallback = `${clip.speciesId}:${clip.bucket}:`;
  if (!clip.recipeId && !TEXTS.has(fallback)) TEXTS.set(fallback, clip.text);
  if (clip.recipeId && !TEXTS.has(fallback)) {
    // Keep first order line as bucket fallback only if none exists.
  }
}

/**
 * @param {string} speciesId
 * @param {string} bucket
 * @param {string|null} [recipeId]
 * @returns {string|null}
 */
export function manifestVoiceText(speciesId, bucket, recipeId = null) {
  if (!speciesId || !bucket) return null;
  if (recipeId) {
    const hit = TEXTS.get(`${speciesId}:${bucket}:${recipeId}`);
    if (hit) return hit;
  }
  return TEXTS.get(`${speciesId}:${bucket}:`) || null;
}
