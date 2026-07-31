import assert from 'node:assert/strict';

import {
  DIALOGUE,
  displayOrderText,
  fillDialogue,
  fillDialogueDisplay,
  fillDialogueSpoken,
  spokenOrderText,
  stripEmoji,
} from '../src/data/dialogue.js';
import { getRecipe } from '../src/data/recipes.js';
import { SPECIES } from '../src/data/species.js';

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/u;
const COOKIE = getRecipe('cookie');

function occurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function testOrderTokens() {
  assert.equal(spokenOrderText(COOKIE), COOKIE.name);
  assert.equal(displayOrderText(COOKIE), `${COOKIE.emoji} ${COOKIE.name}`);
  // Pre-formatted strings from older call sites must still come out clean.
  assert.equal(spokenOrderText(`${COOKIE.emoji} ${COOKIE.name}`), COOKIE.name);
  assert.equal(
    displayOrderText(`${COOKIE.emoji} ${COOKIE.name}`),
    `${COOKIE.emoji} ${COOKIE.name}`,
  );
  assert.equal(spokenOrderText(undefined), 'treat');
  assert.equal(displayOrderText(null), 'treat');
  assert.equal(stripEmoji('🍪  Cookie 🎉'), 'Cookie');
}

function testSpokenFill() {
  const template = 'I\'ll have a {order}, please, said {name} about the {order}.';
  const spoken = fillDialogueSpoken(template, { name: 'Mira', order: COOKIE });
  assert.ok(!EMOJI.test(spoken), `spoken fill leaked an emoji: ${spoken}`);
  assert.equal(occurrences(spoken, COOKIE.name), 2, 'one name per {order} token');
  assert.ok(spoken.includes('Mira'));

  const single = fillDialogueSpoken('One {order}, please.', { order: COOKIE });
  assert.equal(single, `One ${COOKIE.name}, please.`);
  assert.equal(occurrences(single, COOKIE.name), 1);

  // fillDialogue is the deprecated alias and must stay spoken-safe.
  const legacy = fillDialogue('One {order}, please.', {
    order: `${COOKIE.emoji} ${COOKIE.name}`,
  });
  assert.equal(legacy, single);
  assert.ok(!EMOJI.test(legacy));
}

function testDisplayFill() {
  const display = fillDialogueDisplay('One {order}, please.', { order: COOKIE });
  assert.equal(display, `One ${COOKIE.emoji} ${COOKIE.name}, please.`);
  assert.equal(occurrences(display, COOKIE.name), 1, 'name rendered exactly once');
  assert.equal(occurrences(display, COOKIE.emoji), 1, 'emoji rendered exactly once');
}

function testEverySpeciesLine() {
  for (const [speciesId, species] of Object.entries(SPECIES)) {
    const bank = DIALOGUE[speciesId];
    if (!bank) continue;
    const recipe = getRecipe(species.prefers);
    for (const [bucket, lines] of Object.entries(bank)) {
      for (const line of lines) {
        const spoken = fillDialogueSpoken(line, { name: species.label, order: recipe });
        assert.ok(
          !EMOJI.test(spoken),
          `${speciesId}/${bucket} produced an emoji in spoken text: ${spoken}`,
        );
        assert.ok(!spoken.includes('{order}') && !spoken.includes('{name}'));
      }
    }
  }
}

testOrderTokens();
testSpokenFill();
testDisplayFill();
testEverySpeciesLine();

console.log('Dialogue token smoke tests passed: spoken fill is emoji-free, display fill shows emoji + name once.');
