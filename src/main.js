import { Game } from './engine/Game.js';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas #game not found');
}

const game = new Game(canvas);
game.init().catch((err) => {
  console.error('Failed to start Bear Bakery:', err);
});

const fullscreenButton = document.getElementById('fullscreen');
const frame = document.getElementById('frame');

function isFsActive() {
  return !!(
    document.fullscreenElement ||
    /** @type {any} */ (document).webkitFullscreenElement ||
    game.display?.immersive
  );
}

function syncFullscreenLabel() {
  if (fullscreenButton) {
    fullscreenButton.textContent = isFsActive() ? 'Exit Fullscreen' : 'Fullscreen';
  }
}

/**
 * iPhone Safari often rejects Fullscreen API on divs — fall back to an
 * immersive CSS mode that still fills the visual viewport.
 */
async function toggleFullscreen() {
  const docAny = /** @type {any} */ (document);
  try {
    if (document.fullscreenElement || docAny.webkitFullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (docAny.webkitExitFullscreen) docAny.webkitExitFullscreen();
      game.display?.setImmersive(false);
    } else if (game.display?.immersive) {
      game.display.setImmersive(false);
    } else {
      const target = /** @type {any} */ (frame || document.documentElement);
      let entered = false;
      try {
        if (target.requestFullscreen) {
          await target.requestFullscreen({ navigationUI: 'hide' });
          entered = true;
        } else if (target.webkitRequestFullscreen) {
          target.webkitRequestFullscreen();
          entered = true;
        }
      } catch {
        entered = false;
      }
      if (!entered) {
        // iOS fallback: CSS immersive + hide browser chrome as much as possible.
        game.display?.setImmersive(true);
        window.scrollTo(0, 1);
        canvas.focus();
      }
    }
  } catch (err) {
    console.warn('Fullscreen unavailable:', err);
    game.display?.setImmersive(true);
  }
  syncFullscreenLabel();
  game.display?.resize();
}

fullscreenButton?.addEventListener('click', () => {
  toggleFullscreen();
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) game.display?.setImmersive(false);
  syncFullscreenLabel();
  game.display?.resize();
});
document.addEventListener('webkitfullscreenchange', () => {
  syncFullscreenLabel();
  game.display?.resize();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    toggleFullscreen();
  }
  if (e.key === 'Escape' && game.display?.immersive) {
    game.display.setImmersive(false);
    syncFullscreenLabel();
  }
});

// Lock orientation hint for phones (no-op if unsupported).
try {
  screen.orientation?.lock?.('landscape').catch(() => {});
} catch {
  // ignore
}

window.BearBakery = game;
