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

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      const target = frame || document.documentElement;
      await target.requestFullscreen?.({ navigationUI: 'hide' });
    }
  } catch (err) {
    console.warn('Fullscreen unavailable:', err);
  }
}

fullscreenButton?.addEventListener('click', () => {
  toggleFullscreen();
});

document.addEventListener('fullscreenchange', () => {
  if (fullscreenButton) {
    fullscreenButton.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
  }
  game.display?.resize();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    toggleFullscreen();
  }
});

// Helpful for kid debugging in the console
window.BearBakery = game;
