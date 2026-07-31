import {
  SPECIES,
  ALL_CUSTOMER_SPECIES,
  EASY_CUSTOMER_IDS,
  LAUNCH_CUSTOMER_IDS,
} from '../data/species.js';
import { RECIPES } from '../data/recipes.js';
import { INGREDIENTS, getIngredient } from '../data/ingredients.js';
import { rollProfile } from '../data/bios.js';
import {
  DIALOGUE,
  ORDER_PUNS,
  pickDialogue,
  fillDialogueSpoken,
  orderLineFor,
} from '../data/dialogue.js';
import { UPGRADES } from '../data/upgrades.js';
import { DIFFICULTY_PRESETS } from '../data/difficulty.js';
import { ASSET_MANIFEST } from '../config.js';
import { AssetLoader } from '../engine/AssetLoader.js';
import { drawCharacterArt } from '../entities/CharacterArt.js';
import { resolveDirectionImage } from '../entities/Facing.js';

const animalGrid = document.querySelector('#animal-grid');
const recipeGrid = document.querySelector('#recipe-grid');
const dialogueGrid = document.querySelector('#dialogue-grid');
const musicGrid = document.querySelector('#music-grid');
const sfxGrid = document.querySelector('#sfx-grid');
const voiceGrid = document.querySelector('#voice-grid');
const furnitureGrid = document.querySelector('#furniture-grid');
const cosmeticsGrid = document.querySelector('#cosmetics-grid');
const ingredientGrid = document.querySelector('#ingredient-grid');
const upgradeGrid = document.querySelector('#upgrade-grid');
const howtoGrid = document.querySelector('#howto-grid');
const directionGrid = document.querySelector('#direction-grid');
const directionSelect = document.querySelector('#direction-species');

const MUSIC = [
  ['Laundry On The Wire', 'assets/audio/music/chill_laundry.mp3'],
  ['Keeping Cool', 'assets/audio/music/chill_keeping_cool.mp3'],
  ['Windows Down', 'assets/audio/music/chill_windows_down.mp3'],
  ['2 Hour Delay', 'assets/audio/music/chill_2hour_delay.mp3'],
  ['Snow Drift', 'assets/audio/music/chill_snow_drift.mp3'],
  ['First Snow', 'assets/audio/music/chill_first_snow.mp3'],
  ['Happy Song', 'assets/audio/music/chill_happy_song.mp3'],
  ['Bakery Loop', 'assets/audio/music/bakery_loop.mp3'],
];

const SFX = [
  ['Bell', 'assets/audio/sfx/bell.ogg', 'Guest arrives / shop opens'],
  ['Click', 'assets/audio/sfx/click.ogg', 'UI / mouse'],
  ['Confirm', 'assets/audio/sfx/confirm.ogg', 'Successful action'],
  ['Drop', 'assets/audio/sfx/drop.ogg', 'Scoop / bake start'],
  ['Happy', 'assets/audio/sfx/happy.ogg', 'Good serve / stock'],
  ['Sad', 'assets/audio/sfx/sad.ogg', 'Wrong order / empty'],
];

const FURNITURE = [
  ['oven', 'Oven', 'Bake sealed dough'],
  ['mixingBowl', 'Mixing Bowl', '3 bowls · auto-dough'],
  ['ingredientBowl', 'Ingredient Bowl', 'Scoop stations'],
  ['display', 'Pastry Case', 'Stock & pick to serve'],
  ['table', 'Cafe Table', 'Seating'],
  ['register', 'Register', 'Queue / open'],
  ['open_sign', 'Open Sign', 'Start service'],
  ['pantry', 'Pantry', 'Refill all stock'],
  ['shop', 'Shop Desk', 'Back Office unlocks'],
  ['bookcase', 'Recipe Bookcase', 'Study Book'],
  ['safe', 'Till Safe', 'Money toast'],
  ['sink', 'Dishwasher & Prep Sink', 'Carry table dishes here to wash'],
  ['sofa', 'Sofa', 'Dining decor'],
  ['citrusTree', 'Citrus Tree', 'Ambience decor'],
  ['plant', 'Plant', 'Corner plant'],
];

const COSMETICS = [
  ['bear', 'Classic Baker'],
  ['bear_hat', 'Chef Hat'],
  ['bear_glasses', 'Reading Glasses'],
  ['bear_hat_glasses', 'Hat + Glasses'],
];

const HOWTO = [
  ['1 · Scoop', 'Walk to ingredient jars and press E. Ingredients land in Bowl A/B/C.'],
  ['2 · Auto-dough', 'When a bowl exactly matches a recipe, it seals as READY dough.'],
  ['3 · Bake', 'Take dough to the oven. When DONE, carry the plate yourself.'],
  ['4 · Case', 'Stock the pastry case, then tap treats to send them on the conveyor.'],
  ['5 · Guests', 'Open the shop, greet friends, seat them, and serve their order.'],
  ['6 · Put Back', 'Wrong mix? Press R or tap Put Back. Pantry refills empty jars.'],
  ['7 · Close & Clean', 'Pick up dishes at tables, carry up to four, then run them through the kitchen dishwasher.'],
];

const DIRS = [
  ['front', 'Front'],
  ['side', 'Side (right)'],
  ['left', 'Left'],
  ['back', 'Back'],
];

const assets = new AssetLoader();
const animals = [SPECIES.bear, ...ALL_CUSTOMER_SPECIES];
const easySet = new Set(EASY_CUSTOMER_IDS || []);
const launchSet = new Set(LAUNCH_CUSTOMER_IDS || []);

/** @type {ReturnType<typeof setInterval>[]} */
const timers = [];

async function boot() {
  const [, voiceManifest] = await Promise.all([
    assets.loadImages(ASSET_MANIFEST.images),
    fetch('assets/audio/voices/manifest.json')
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null),
  ]);

  for (const [title, text] of HOWTO) {
    const card = document.createElement('article');
    card.className = 'card howto-card';
    card.innerHTML = `<span class="step">${title}</span><p>${text}</p>`;
    howtoGrid.append(card);
  }

  const diffBits = Object.values(DIFFICULTY_PRESETS)
    .map((d) => `<span class="badge">${d.name}</span>`)
    .join(' ');
  const diffNote = document.createElement('article');
  diffNote.className = 'card howto-card';
  diffNote.innerHTML = `
    <span class="step">Difficulty</span>
    <p>${diffBits}</p>
    <p class="scale">Days 1–2 use the easy guest pool + favorite orders most of the time.</p>
  `;
  howtoGrid.append(diffNote);

  for (const species of animals) {
    const card = document.createElement('article');
    card.className = 'card animal-card';
    const canvas = document.createElement('canvas');
    canvas.width = 250;
    canvas.height = 180;
    card.append(canvas);
    const recipe = RECIPES[species.prefers];
    const easy = easySet.has(species.id);
    const launch = species.isPlayer || launchSet.has(species.id);
    card.insertAdjacentHTML('beforeend', `
      <div class="card-body">
        <h3>${species.label}${species.isPlayer ? ' (you)' : ''}</h3>
        <span class="badge">${launch ? 'MVP launch roster' : 'Art preview'}</span>
        ${easy ? '<span class="badge easy">Easy-day guest</span>' : ''}
        <p class="scale">Game size: ${species.size}px · patience ×${species.patience}</p>
        <p>${species.personality}</p>
        <p class="likes">Likes: ${species.likesText}</p>
        <p class="dislikes">Dislikes: ${species.dislikesText}</p>
        <p>Favorite: ${recipe?.emoji ?? ''} ${recipe?.name ?? '—'}</p>
        <p class="scale">Orders: ${(species.likesRecipes || []).join(', ')}</p>
        <a class="card-link" href="character.html?id=${species.id}">Voice & dialogue page</a>
      </div>
    `);
    animalGrid.append(card);
    animateAnimal(canvas, species, species.spriteKey || species.id, 'front');
  }

  for (const species of animals) {
    const opt = document.createElement('option');
    opt.value = species.spriteKey || species.id;
    opt.textContent = species.label;
    directionSelect.append(opt);
  }
  directionSelect.addEventListener('change', () => renderDirections(directionSelect.value));
  renderDirections(directionSelect.value || 'bunny');

  for (const [key, label, blurb] of FURNITURE) {
    const src = ASSET_MANIFEST.images[key];
    if (!src) continue;
    const card = document.createElement('article');
    card.className = 'card furniture-card';
    card.innerHTML = `
      <img src="${src}" alt="${label}" loading="lazy" />
      <h3>${label}</h3>
      <p>${blurb}</p>
      <p class="scale">${key}</p>
    `;
    furnitureGrid.append(card);
  }

  for (const [key, label] of COSMETICS) {
    const card = document.createElement('article');
    card.className = 'card cosmetic-card';
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 170;
    card.append(canvas);
    card.insertAdjacentHTML('beforeend', `
      <div class="card-body">
        <h3>${label}</h3>
        <p class="scale">${key}</p>
      </div>
    `);
    cosmeticsGrid.append(card);
    animateAnimal(canvas, SPECIES.bear, key, 'front');
  }

  for (const recipe of Object.values(RECIPES)) {
    const card = document.createElement('article');
    card.className = 'card recipe-card';
    const ingredients = recipe.ingredients.map((id) => {
      const ingredient = getIngredient(id);
      return `<span class="ingredient">${ingredient?.emoji ?? '•'} ${ingredient?.name ?? id}</span>`;
    }).join('');
    card.innerHTML = `
      <span class="emoji">${recipe.emoji}</span>
      <h3>${recipe.name}</h3>
      <p>$${recipe.price} · Oven ${recipe.bakeTime}s (sped up in-game)</p>
      <div class="ingredients">${ingredients}</div>
    `;
    recipeGrid.append(card);
  }

  for (const ing of Object.values(INGREDIENTS)) {
    if (ing.id === 'onion' || ing.id === 'spicy') continue;
    const card = document.createElement('article');
    card.className = 'card ingredient-card';
    card.innerHTML = `
      <div class="emoji">${ing.emoji}</div>
      <h3>${ing.name}</h3>
      <p class="scale">${ing.id}</p>
      <div class="swatch" style="background:${ing.color}"></div>
    `;
    ingredientGrid.append(card);
  }

  for (const upgrade of UPGRADES) {
    const card = document.createElement('article');
    card.className = 'card upgrade-card';
    card.innerHTML = `
      <h3>${upgrade.name}</h3>
      <p>${upgrade.description}</p>
      <span class="price">$${upgrade.price}</span>
      <p class="scale">${upgrade.category} · ${upgrade.id}${upgrade.effect ? ` · ${upgrade.effect}` : ''}</p>
    `;
    upgradeGrid.append(card);
  }

  for (const species of ALL_CUSTOMER_SPECIES) {
    const profile = rollProfile(species.id, species.label);
    const recipe = RECIPES[species.prefers];
    const bank = DIALOGUE[species.id] || DIALOGUE.bunny;
    const greet = fillDialogueSpoken(pickDialogue(species.id, 'greet'), {
      name: profile.friends[0] || species.label,
      order: recipe || species.prefers,
    });
    const orderLine = fillDialogueSpoken(orderLineFor(species.id, recipe), {
      name: species.label,
      order: recipe || species.prefers,
    });
    const thanks = (bank.thanks || bank.chat || ['Thanks!'])[0];
    const chat = (bank.chat || ['…'])[0];
    const card = document.createElement('article');
    card.className = 'card dialogue-card';
    card.innerHTML = `
      <h3>${species.label}</h3>
      <p class="quote">“${greet}”</p>
      <p>${profile.bio}</p>
      <p><strong>Order:</strong> “${orderLine}”</p>
      <p class="friends">Friends today: ${profile.friends.join(', ')}</p>
      <ul class="lines">
        <li>${chat}</li>
        <li>${thanks}</li>
      </ul>
      <a class="card-link" href="character.html?id=${species.id}">All dialogue & voice</a>
    `;
    dialogueGrid.append(card);
  }

  buildScriptReview(voiceManifest);

  if (voiceManifest?.clips?.length) {
    for (const clip of voiceManifest.clips) {
      const card = document.createElement('article');
      card.className = 'card voice-card';
      const pace =
        clip.speakingRate < 0.92 ? 'relaxed' :
        clip.speakingRate > 1.08 ? 'brisk' :
        'balanced';
      const rawGoogle = !clip.effectSignature;
      card.innerHTML = `
        <h3>${clip.label}</h3>
        <span class="badge">${rawGoogle ? 'Unique raw Google voice · no DSP' : 'Unique voice + unique FX'}</span>
        <span class="badge easy">${clip.bucket || 'profile'} line</span>
        <p class="voice-name">${clip.voice} · ${clip.languageCode || 'en-US'} · ${pace}</p>
        <p class="quote">“${clip.text}”</p>
        <p class="style">${clip.style}</p>
        <p class="style"><strong>Render:</strong> ${clip.soundDesign || 'Natural HD voice'}</p>
        <audio controls preload="none" src="${clip.src}"></audio>
        <a class="card-link" href="character.html?id=${clip.speciesId || clip.id}">Open character page</a>
      `;
      voiceGrid.append(card);
    }
    const source = document.createElement('p');
    source.className = 'source';
    source.textContent = `Current preview provider: ${voiceManifest.model}.`;
    voiceGrid.before(source);
  } else {
    voiceGrid.innerHTML =
      '<article class="card voice-card"><p>No generated voice manifest found yet.</p></article>';
  }

  for (const [name, src] of MUSIC) {
    const card = document.createElement('article');
    card.className = 'card music-card';
    card.innerHTML = `<h3>${name}</h3><p>Playlist track used in-game.</p><audio controls preload="none" src="${src}"></audio>`;
    musicGrid.append(card);
  }

  for (const [name, src, blurb] of SFX) {
    const card = document.createElement('article');
    card.className = 'card music-card';
    card.innerHTML = `<h3>${name}</h3><p>${blurb}</p><audio controls preload="none" src="${src}"></audio>`;
    sfxGrid.append(card);
  }
}

const BUCKET_LABELS = {
  greet: 'Walking in',
  order: 'Ordering (one per treat)',
  wait: 'Waiting at the table',
  thanks: 'Loved it',
  chat: 'Small talk',
  dislikeReact: 'Not their thing',
};

/**
 * Full script browser so the whole cast can be proof-read in one place.
 * @param {{clips?: Array<object>}|null} voiceManifest
 */
function buildScriptReview(voiceManifest) {
  const filter = document.querySelector('#script-filter');
  const search = document.querySelector('#script-search');
  const body = document.querySelector('#script-body');
  const count = document.querySelector('#script-count');
  if (!filter || !body) return;

  const cast = [SPECIES.bear, ...ALL_CUSTOMER_SPECIES];
  filter.innerHTML =
    '<option value="all">All characters</option>' +
    cast.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');

  const accentOf = (id) =>
    voiceManifest?.clips?.find((c) => c.speciesId === id)?.languageCode || 'en-US';

  const draw = () => {
    const only = filter.value;
    const needle = (search?.value || '').trim().toLowerCase();
    const shown = cast.filter((s) => only === 'all' || s.id === only);
    let lines = 0;
    body.innerHTML = '';

    for (const species of shown) {
      const bank = DIALOGUE[species.id];
      if (!bank) continue;
      const groups = [];

      for (const bucket of ['greet', 'order', 'wait', 'thanks', 'chat', 'dislikeReact']) {
        const raw = bucket === 'order'
          ? Object.entries(ORDER_PUNS[species.id] || {}).map(([recipeId, text]) => ({
              tag: RECIPES[recipeId]?.name || recipeId,
              text,
            }))
          : (bank[bucket] || []).map((text) => ({ tag: '', text }));
        const kept = raw.filter((row) => !needle || row.text.toLowerCase().includes(needle));
        if (!kept.length) continue;
        lines += kept.length;
        groups.push(`
          <h4>${BUCKET_LABELS[bucket]} <span class="scale">${kept.length}</span></h4>
          <ol class="script-lines">
            ${kept
              .map(
                (row) =>
                  `<li>${row.tag ? `<em>${row.tag}:</em> ` : ''}${escapeHtml(row.text)}</li>`,
              )
              .join('')}
          </ol>`);
      }
      if (!groups.length) continue;

      const article = document.createElement('article');
      article.className = 'card script-card';
      article.innerHTML = `
        <header class="script-head">
          <h3>${species.label}</h3>
          <span class="badge">${accentOf(species.id)}</span>
          <span class="scale">${species.personality}</span>
          <a class="card-link" href="character.html?id=${species.id}">Voice page</a>
        </header>
        ${groups.join('')}`;
      body.append(article);
    }

    if (count) count.textContent = `${lines} line${lines === 1 ? '' : 's'} shown`;
    if (!lines) body.innerHTML = '<p class="loading">No lines match that search.</p>';
  };

  filter.addEventListener('change', draw);
  search?.addEventListener('input', draw);
  draw();
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch],
  );
}

function renderDirections(baseKey) {
  directionGrid.innerHTML = '';
  const species =
    animals.find((s) => (s.spriteKey || s.id) === baseKey) || SPECIES.bunny;
  for (const [dir, label] of DIRS) {
    const card = document.createElement('article');
    card.className = 'card direction-card';
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 150;
    card.append(canvas);
    const resolved = resolveDirectionImage(
      assets,
      baseKey,
      dir === 'sit' ? 'front' : dir,
      dir === 'sit' ? 'sit' : null,
    );
    card.insertAdjacentHTML('beforeend', `
      <div class="card-body">
        <h3>${label}</h3>
        <p class="scale">${resolved.key || 'missing'}</p>
      </div>
    `);
    directionGrid.append(card);
    animateAnimal(canvas, species, baseKey, dir === 'sit' ? 'front' : dir, dir === 'sit' ? 'sit' : null);
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('../data/species.js').Species} species
 * @param {string} spriteKey
 * @param {import('../entities/Facing.js').FacingDir} dir
 * @param {string|null} [pose]
 */
function animateAnimal(canvas, species, spriteKey, dir = 'front', pose = null) {
  const ctx = canvas.getContext('2d');
  const render = (ms) => {
    const time = ms / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height - 28, 58, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    const resolved = resolveDirectionImage(assets, spriteKey, dir, pose);
    const size = Math.max(52, Math.min(120, (species.size || 36) * 1.85));
    drawCharacterArt(ctx, {
      id: species.id,
      x: canvas.width / 2 - size / 2,
      y: canvas.height - 28 - size,
      size,
      color: species.fallbackColor,
      accent: species.accent,
      // Dedicated left sprites already face left. Mirror only when the
      // resolver explicitly falls back to a right-facing side sprite.
      facing: resolved.flip ? -1 : 1,
      time,
      walking: !pose && Math.sin(time * 0.8 + species.size) > 0.35,
      state: pose === 'sit' ? 'waiting' : null,
      image: resolved.image || assets.get(spriteKey),
    });
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);
}

boot().catch((err) => {
  console.error('Showcase failed to load', err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<p style="padding:24px;color:#a00">Showcase failed: ${err.message}</p>`,
  );
});

// silence unused
void timers;
