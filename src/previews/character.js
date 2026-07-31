import {
  SPECIES,
  ALL_CUSTOMER_SPECIES,
  EASY_CUSTOMER_IDS,
  LAUNCH_CUSTOMER_IDS,
} from '../data/species.js';
import { RECIPES, recipeIngredientLabels } from '../data/recipes.js';
import { BIO_TEMPLATES, FRIEND_NAMES } from '../data/bios.js';
import { DIALOGUE, fillDialogueSpoken } from '../data/dialogue.js';
import { ASSET_MANIFEST } from '../config.js';
import { AssetLoader } from '../engine/AssetLoader.js';
import { drawCharacterArt } from '../entities/CharacterArt.js';
import { resolveDirectionImage } from '../entities/Facing.js';

const page = document.querySelector('#character-page');
const title = document.querySelector('#page-title');
const params = new URLSearchParams(location.search);
const requestedId = params.get('id') || 'bear';
const species = SPECIES[requestedId] || SPECIES.bear;
const cast = [SPECIES.bear, ...ALL_CUSTOMER_SPECIES];
const currentIndex = Math.max(0, cast.findIndex((entry) => entry.id === species.id));
const assets = new AssetLoader();

async function boot() {
  const [, voiceManifest] = await Promise.all([
    assets.loadImages(ASSET_MANIFEST.images),
    fetch('assets/audio/voices/manifest.json')
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null),
  ]);

  const favorite = RECIPES[species.prefers];
  const voices = (voiceManifest?.clips || []).filter(
    (clip) => (clip.speciesId || clip.id) === species.id,
  );
  const voice = voices.find((clip) => clip.bucket === 'profile') || voices[0] || null;
  const voicePace = voice
    ? voice.speakingRate < 0.92
      ? 'relaxed'
      : voice.speakingRate > 1.08
        ? 'brisk'
        : 'balanced'
    : null;
  const launch = species.isPlayer || LAUNCH_CUSTOMER_IDS.includes(species.id);
  const easy = EASY_CUSTOMER_IDS.includes(species.id);
  const bio = (BIO_TEMPLATES[species.id] || ['A friendly bakery regular.'])[0];
  const friends = FRIEND_NAMES[species.id] || [];
  const baseKey = species.spriteKey || species.id;

  document.title = `${species.label} — The Bear Bakery`;
  title.textContent = `${species.label} — Character Page`;
  page.innerHTML = `
    <section class="character-hero">
      <article class="portrait-panel">
        <canvas id="hero-canvas" width="420" height="390"></canvas>
        <div class="portrait-caption">
          <span class="badge">${launch ? 'MVP launch roster' : 'Art preview'}</span>
          ${easy ? '<span class="badge easy">Easy-day guest</span>' : ''}
          <p class="scale">${baseKey} · game size ${species.size}px</p>
        </div>
      </article>
      <article class="character-details">
        <h1>${species.label}</h1>
        <p class="personality">${species.personality}</p>
        <p>${bio}</p>
        <div class="stat-grid">
          <div class="stat"><strong>Favorite</strong>${favorite?.emoji || ''} ${favorite?.name || species.prefers}</div>
          <div class="stat"><strong>Likes</strong>${species.likesText}</div>
          <div class="stat"><strong>Dislikes</strong>${species.dislikesText}</div>
          <div class="stat"><strong>Patience</strong>×${species.patience}</div>
        </div>
        <p><strong>Recipe:</strong> ${favorite ? recipeIngredientLabels(favorite).join(' · ') : '—'}</p>
        <p><strong>Friends:</strong> ${friends.join(' · ') || 'Visiting solo'}</p>
        <p><strong>Default greeting:</strong> “${species.greeting}”</p>
      </article>
    </section>

    <section class="voice-feature">
      <div>
        <h2>${species.label}'s Voice</h2>
        ${
          voice
            ? `<p><strong>${voice.voice}</strong> · ${voice.languageCode || 'en-US'} · ${voicePace} · ${voiceManifest.model}</p>
               <p class="quote">“${voice.text}”</p>
               <p class="style">${voice.style}</p>
               <p class="style"><strong>Render:</strong> ${voice.soundDesign || 'Natural HD voice'}</p>`
            : '<p>No rendered voice preview is available yet.</p>'
        }
      </div>
      ${
        voices.length
          ? `<div class="voice-playlist">
              ${voices.map((clip) => `
                <article>
                  <strong>${clip.bucket || 'profile'}</strong>
                  <p>“${clip.text}”</p>
                  <audio controls preload="metadata" src="${clip.src}"></audio>
                </article>
              `).join('')}
            </div>`
          : ''
      }
    </section>

    <section>
      <h2>Direction Art</h2>
      <p class="source">Production front / right / left / back frames used by the game.</p>
      <div id="character-directions" class="direction-page-grid"></div>
    </section>

    <section>
      <h2>Complete Dialogue Bank</h2>
      <p class="source">60 authored lines shaped by this character's biome, anatomy, and personality. Tokens are previewed using ${friends[0] || species.label} and ${favorite?.emoji || ''} ${favorite?.name || 'a treat'}.</p>
      <div id="character-dialogue"></div>
    </section>

    <nav class="character-nav">
      <a href="character.html?id=${cast[(currentIndex - 1 + cast.length) % cast.length].id}">← ${cast[(currentIndex - 1 + cast.length) % cast.length].label}</a>
      <a href="showcase.html#animals">All characters</a>
      <a href="character.html?id=${cast[(currentIndex + 1) % cast.length].id}">${cast[(currentIndex + 1) % cast.length].label} →</a>
    </nav>
  `;

  animate(
    document.querySelector('#hero-canvas'),
    species,
    baseKey,
    'front',
    210,
  );
  renderDirections(baseKey);
  renderDialogue(favorite, friends[0] || species.label);
}

function renderDirections(baseKey) {
  const grid = document.querySelector('#character-directions');
  for (const [dir, label] of [
    ['front', 'Front'],
    ['side', 'Right'],
    ['left', 'Left'],
    ['back', 'Back'],
  ]) {
    const resolved = resolveDirectionImage(assets, baseKey, dir);
    const card = document.createElement('article');
    card.className = 'card direction-card';
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 230;
    card.append(canvas);
    card.insertAdjacentHTML(
      'beforeend',
      `<div class="card-body"><h3>${label}</h3><p class="scale">${resolved.key}</p></div>`,
    );
    grid.append(card);
    animate(canvas, species, baseKey, dir, 130);
  }
}

function renderDialogue(favorite, previewName) {
  const root = document.querySelector('#character-dialogue');
  const bank = DIALOGUE[species.id] || DIALOGUE.bunny;
  // These previews sit next to the voice clips, so they mirror the spoken text.
  const tokens = { name: previewName, order: favorite };
  for (const [bucket, lines] of Object.entries(bank)) {
    const section = document.createElement('article');
    section.className = 'dialogue-section';
    section.innerHTML = `
      <h3>${bucket.replace(/([A-Z])/g, ' $1')}</h3>
      <ul class="dialogue-lines">
        ${lines.map((line) => `<li>“${fillDialogueSpoken(line, tokens)}”</li>`).join('')}
      </ul>
    `;
    root.append(section);
  }
}

function animate(canvas, character, baseKey, dir, size) {
  const ctx = canvas.getContext('2d');
  const render = (ms) => {
    const resolved = resolveDirectionImage(assets, baseKey, dir);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height - 28, size * 0.4, size * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCharacterArt(ctx, {
      id: character.id,
      x: canvas.width / 2 - size / 2,
      y: canvas.height - 28 - size,
      size,
      color: character.fallbackColor,
      accent: character.accent,
      facing: resolved.flip ? -1 : 1,
      time: ms / 1000,
      walking: false,
      image: resolved.image,
    });
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}

boot().catch((error) => {
  console.error('Character page failed', error);
  page.innerHTML = `<p class="loading">Character page failed: ${error.message}</p>`;
});
