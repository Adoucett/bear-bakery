import { WOODLAND_DIALOGUE, WOODLAND_ORDER_PUNS } from './dialogue-expansions/woodland.js';
import { WETLANDS_DIALOGUE, WETLANDS_ORDER_PUNS } from './dialogue-expansions/wetlands.js';
import { WILD_DIALOGUE, WILD_ORDER_PUNS } from './dialogue-expansions/wild.js';
import { COZY_DIALOGUE, COZY_ORDER_PUNS } from './dialogue-expansions/cozy.js';

/**
 * Per-species dialogue. Conversational buckets (greet, wait, thanks, chat,
 * dislikeReact) hold 10 pun-flavoured lines each and never mention a treat, so
 * they are always true whatever the guest ordered.
 *
 * Order lines are different: the joke is built around the specific treat
 * ("They smell berry good"), so they live in ORDER_PUNS keyed by recipe.
 *
 * Token: {name} — the character's own name. Order lines take no tokens.
 */
export const DIALOGUE = {
  ...WOODLAND_DIALOGUE,
  ...WETLANDS_DIALOGUE,
  ...WILD_DIALOGUE,
  ...COZY_DIALOGUE,
};

/** ORDER_PUNS[speciesId][recipeId] — one punny line naming that exact treat. */
export const ORDER_PUNS = {
  ...WOODLAND_ORDER_PUNS,
  ...WETLANDS_ORDER_PUNS,
  ...WILD_ORDER_PUNS,
  ...COZY_ORDER_PUNS,
};

// Expose the order puns as a normal bucket so existing callers, the study book,
// and the showcase can browse them like any other dialogue.
for (const [speciesId, puns] of Object.entries(ORDER_PUNS)) {
  if (!DIALOGUE[speciesId]) continue;
  DIALOGUE[speciesId].order = Object.values(puns);
}

const EMOJI_PATTERN = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

export function stripEmoji(text) {
  return String(text ?? '')
    .replace(EMOJI_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Treat name only: a voice reading "🍪 Cookie" says the name twice. */
export function spokenOrderText(order) {
  if (!order) return 'treat';
  const name = typeof order === 'object' ? order.name : order;
  return stripEmoji(name) || 'treat';
}

/** Emoji + name, for on-screen text that is never synthesized. */
export function displayOrderText(order) {
  if (!order) return 'treat';
  if (typeof order !== 'object') {
    return String(order).replace(/\s+/g, ' ').trim() || 'treat';
  }
  const name = stripEmoji(order.name) || 'treat';
  return order.emoji ? `${order.emoji} ${name}` : name;
}

function applyTokens(template, name, order) {
  return String(template).replaceAll('{name}', name).replaceAll('{order}', order);
}

export function fillDialogueSpoken(template, { name = 'Friend', order } = {}) {
  return applyTokens(template, stripEmoji(name) || 'Friend', spokenOrderText(order));
}

export function fillDialogueDisplay(template, { name = 'Friend', order } = {}) {
  return applyTokens(template, name, displayOrderText(order));
}

/** @deprecated Prefer fillDialogueSpoken or fillDialogueDisplay. */
export const fillDialogue = fillDialogueSpoken;

export function pickDialogue(speciesId, bucket, rng = Math.random) {
  const bank = DIALOGUE[speciesId] || DIALOGUE.bunny;
  const lines = bank[bucket] || bank.chat;
  return lines[Math.floor(rng() * lines.length)] || lines[0];
}

/**
 * Prefer a line that never mentions the order, so it stays always-true.
 * Index matches TTS generation (greet=4, chat=7).
 * @param {string[]} lines
 * @param {number} index
 */
export function orderAgnosticLine(lines, index) {
  const clean = (lines || []).filter((line) => !String(line).includes('{order}'));
  const pool = clean.length ? clean : lines || [];
  if (!pool.length) return '';
  return pool[index % pool.length];
}

/** Fixed greet line that matches the recorded MP3 (TTS index 4). */
export function voicedGreetLine(speciesId, { name = 'Friend', order } = {}) {
  const bank = DIALOGUE[speciesId] || DIALOGUE.bunny;
  return fillDialogueSpoken(orderAgnosticLine(bank.greet, 4), { name, order });
}

/** Fixed chat line that matches the recorded MP3 (TTS index 7). */
export function voicedChatLine(speciesId, { name = 'Friend', order } = {}) {
  const bank = DIALOGUE[speciesId] || DIALOGUE.bunny;
  return fillDialogueSpoken(orderAgnosticLine(bank.chat, 7), { name, order });
}

/**
 * The punny line for what this guest actually ordered. Falls back to a plain
 * request so an unwritten species/recipe pair can never break a visit.
 * @param {string} speciesId
 * @param {{id?: string, name?: string}|null} recipe
 */
export function orderLineFor(speciesId, recipe) {
  const pun = recipe?.id ? ORDER_PUNS[speciesId]?.[recipe.id] : null;
  if (pun) return pun;
  return `One ${spokenOrderText(recipe)}, please.`;
}

/** Baker Bear self-talk when the player clicks themselves. */
export const BEAR_SELF_TALK = [
  'Alright, Baker Bear — time to bake something sweet!',
  'Hmm… flour on my fur again. Occupational hazard.',
  'One more treat and this place will smell amazing.',
  'I got this. Whisk, bake, serve. Easy as pie.',
  'Customers love a smile — and a warm muffin.',
  'Check the case, check the oven, keep the line moving!',
  'Maybe I should pin a recipe so I do not forget.',
  'Dishes later. Treats first. Priorities!',
  'This bakery runs on butter, berries, and bravery.',
  'Deep breath. You are the best baker in the woods.',
];

export function pickBearSelfTalk(rng = Math.random) {
  return BEAR_SELF_TALK[Math.floor(rng() * BEAR_SELF_TALK.length)] || BEAR_SELF_TALK[0];
}
