/**
 * Soft ambient playlist — coffee-shop / rainy-day vibes.
 * Unlocks on first user gesture; playMusic is safe to call repeatedly after unlock.
 */
/**
 * Order clips are recorded per treat, so the spoken line always names the
 * treat the customer actually rolled. Other buckets are order-agnostic.
 * @param {string} speciesId
 * @param {string} bucket
 * @param {string|null} [recipeId]
 */
export function voiceKey(speciesId, bucket, recipeId = null) {
  return recipeId ? `${speciesId}:${bucket}:${recipeId}` : `${speciesId}:${bucket}`;
}

/**
 * Pure manifest lookup used by runtime and smoke tests.
 * Prefers the clip recorded for this exact recipe; falls back to any clip for
 * the bucket so a missing render degrades to audio that at least fits the
 * character.
 * @param {{clips?: Array<object>}} manifest
 * @param {string} speciesId
 * @param {string} bucket
 * @param {string|null} [recipeId]
 */
export function selectVoiceClip(manifest, speciesId, bucket, recipeId = null) {
  const clips = (manifest?.clips || []).filter(
    (clip) => clip.speciesId === speciesId && clip.bucket === bucket && clip.status !== 'failed',
  );
  if (!clips.length) return null;
  if (recipeId) {
    const exact = clips.find((clip) => clip.recipeId === recipeId);
    if (exact) return exact;
  }
  return clips.find((clip) => !clip.recipeId) || clips[0];
}

export class AudioManager {
  /**
   * @param {Record<string, string>} manifest
   */
  constructor(manifest) {
    this.manifest = manifest;
    /** @type {Map<string, HTMLAudioElement>} */
    this.clips = new Map();
    /** @type {HTMLAudioElement[]} */
    this.playlist = [];
    this.trackIndex = 0;
    this.music = null;
    /** @type {Map<string, HTMLAudioElement>} */
    this.voiceClips = new Map();
    /** @type {Map<string, string>} */
    this.voiceLines = new Map();
    this.activeVoice = null;
    /** @type {(() => void)|null} */
    this._voiceOnEnded = null;
    this.activeSfx = new Set();
    this.pendingVoice = null;
    this.muted = false;
    this.unlocked = false;
    /** True while an unlock attempt is in flight (avoids spam). */
    this._unlocking = false;
    this.musicVolume = 0.22;
    this.sfxVolume = 0.45;
    this.voiceVolume = 0.72;
    this._preload();
    this.voiceReady = this._loadVoiceManifest();
  }

  _preload() {
    const musicKeys = ['music', 'music2', 'music3', 'music4', 'music5', 'music6', 'music7', 'music8', 'musicTitle'];
    for (const [key, src] of Object.entries(this.manifest)) {
      const a = new Audio(src);
      a.preload = 'auto';
      if (musicKeys.includes(key)) {
        a.loop = false;
        a.volume = this.musicVolume;
        this.playlist.push(a);
        a.addEventListener('ended', () => this._nextTrack());
      } else {
        a.volume = this.sfxVolume;
        this.clips.set(key, a);
      }
    }
    this.music = this.playlist[0] || null;
  }

  async _loadVoiceManifest() {
    try {
      const response = await fetch('assets/audio/voices/manifest.json');
      if (!response.ok) return;
      const manifest = await response.json();
      for (const clip of manifest.clips || []) {
        if (!clip.speciesId || !clip.bucket || clip.status === 'failed') continue;
        const audio = new Audio(clip.src);
        audio.preload = 'metadata';
        audio.volume = this.voiceVolume;
        const key = voiceKey(clip.speciesId, clip.bucket, clip.recipeId || null);
        this.voiceClips.set(key, audio);
        this.voiceLines.set(key, clip.text);
        // Also register a bucket-level fallback for missing per-recipe renders.
        const fallbackKey = voiceKey(clip.speciesId, clip.bucket);
        if (!this.voiceClips.has(fallbackKey)) {
          this.voiceClips.set(fallbackKey, audio);
          this.voiceLines.set(fallbackKey, clip.text);
        }
      }
      if (this.pendingVoice && this.unlocked) {
        const pending = this.pendingVoice;
        this.pendingVoice = null;
        this.playVoice(pending.speciesId, pending.bucket, pending.recipeId, pending.opts);
      }
    } catch {
      // Voice previews are optional; the rest of the audio system still works.
    }
  }

  _nextTrack() {
    if (!this.playlist.length || this.muted) return;
    this.trackIndex = (this.trackIndex + 1) % this.playlist.length;
    this.music = this.playlist[this.trackIndex];
    this.music.volume = this.musicVolume;
    this.music.play().catch(() => {});
  }

  /**
   * Unlock audio on first user gesture. Idempotent — skips if already unlocked
   * or an unlock is in progress. Soft-fails if the browser still blocks play.
   * @returns {Promise<boolean>} true when unlocked (or already was)
   */
  async unlock() {
    if (this.unlocked) return true;
    if (this._unlocking) return false;
    this._unlocking = true;
    try {
      // Prime a silent play on a clip if available, then start music
      const probe = this.playlist[0] || this.clips.values().next().value || null;
      if (probe) {
        const prevVol = probe.volume;
        probe.volume = 0.001;
        await probe.play();
        probe.pause();
        probe.currentTime = 0;
        probe.volume = prevVol;
      }
      this.unlocked = true;
      this.playMusic();
      if (this.pendingVoice) {
        const pending = this.pendingVoice;
        this.pendingVoice = null;
        this.playVoice(pending.speciesId, pending.bucket, pending.recipeId, pending.opts);
      }
      return true;
    } catch (err) {
      // Soft-fail: browser may still require a later gesture
      console.warn('Audio unlock blocked until gesture:', err?.message || err);
      this.unlocked = false;
      return false;
    } finally {
      this._unlocking = false;
    }
  }

  /**
   * Start / resume playlist. Safe after unlock; no-ops if muted or empty.
   * Does not flip unlocked — call unlock() from a user gesture first.
   */
  playMusic() {
    if (!this.playlist.length || this.muted) return;
    if (!this.unlocked) return;
    for (const t of this.playlist) {
      if (t !== this.music) {
        t.pause();
        t.currentTime = 0;
      }
    }
    if (!this.music) this.music = this.playlist[this.trackIndex];
    this.music.volume = this.musicVolume;
    this.music.play().catch(() => {});
  }

  nextSong() {
    if (!this.playlist.length || !this.unlocked) return;
    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
    }
    this._nextTrack();
  }

  playSfx(key) {
    if (this.muted || !this.unlocked) return;
    if (this.activeVoice) return;
    const base = this.clips.get(key);
    if (!base) return;
    const node = base.cloneNode();
    node.volume = this.sfxVolume;
    this.activeSfx.add(node);
    const clear = () => this.activeSfx.delete(node);
    node.addEventListener('ended', clear, { once: true });
    node.addEventListener('error', clear, { once: true });
    node.play().catch(clear);
  }

  voiceText(speciesId, bucket = 'chat', recipeId = null) {
    return (
      this.voiceLines.get(voiceKey(speciesId, bucket, recipeId)) ||
      this.voiceLines.get(voiceKey(speciesId, bucket)) ||
      null
    );
  }

  /**
   * Stop the current voice clip.
   * @param {{ force?: boolean }} [opts]
   */
  stopVoice({ force = true } = {}) {
    if (!this.activeVoice) {
      this._voiceOnEnded = null;
      return;
    }
    const node = this.activeVoice;
    this._voiceOnEnded = null;
    node.pause();
    node.currentTime = 0;
    this.activeVoice = null;
    if (this.music) this.music.volume = this.musicVolume;
    if (!force) return;
  }

  get isVoicePlaying() {
    return !!this.activeVoice;
  }

  /**
   * @param {string} speciesId
   * @param {string} [bucket]
   * @param {string|null} [recipeId]
   * @param {{ onEnded?: () => void, interrupt?: boolean }} [opts]
   */
  playVoice(speciesId, bucket = 'chat', recipeId = null, opts = {}) {
    if (this.muted) return false;
    const interrupt = opts.interrupt !== false;
    const onEnded = typeof opts.onEnded === 'function' ? opts.onEnded : null;
    const base =
      this.voiceClips.get(voiceKey(speciesId, bucket, recipeId)) ||
      this.voiceClips.get(voiceKey(speciesId, bucket));
    if (!this.unlocked || !base) {
      this.pendingVoice = { speciesId, bucket, recipeId, opts };
      return false;
    }

    if (this.activeVoice && !interrupt) {
      return false;
    }

    if (this.activeVoice) {
      this.activeVoice.pause();
      this.activeVoice.currentTime = 0;
    }
    this._voiceOnEnded = onEnded;
    for (const sfx of this.activeSfx) {
      sfx.pause();
      sfx.currentTime = 0;
    }
    this.activeSfx.clear();
    const node = /** @type {HTMLAudioElement} */ (base.cloneNode());
    node.volume = this.voiceVolume;
    this.activeVoice = node;

    const previousMusicVolume = this.music?.volume ?? this.musicVolume;
    if (this.music) this.music.volume = Math.min(previousMusicVolume, 0.07);
    const finish = () => {
      if (this.activeVoice === node) this.activeVoice = null;
      if (this.music) this.music.volume = this.musicVolume;
      const cb = this._voiceOnEnded;
      this._voiceOnEnded = null;
      if (cb) cb();
    };
    node.addEventListener('ended', finish, { once: true });
    node.addEventListener('error', () => {
      if (this.activeVoice === node) this.activeVoice = null;
      if (this.music) this.music.volume = this.musicVolume;
      this._voiceOnEnded = null;
    }, { once: true });
    node.play().catch(() => {
      if (this.activeVoice === node) this.activeVoice = null;
      if (this.music) this.music.volume = this.musicVolume;
      this._voiceOnEnded = null;
    });
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.music) {
      if (this.muted) this.music.pause();
      else if (this.unlocked) {
        this.music.volume = this.musicVolume;
        this.music.play().catch(() => {});
      }
    }
    if (this.muted && this.activeVoice) {
      this.stopVoice({ force: true });
    }
    if (this.muted) this.pendingVoice = null;
    return this.muted;
  }
}
