import { pickDialogue, fillDialogueSpoken } from '../data/dialogue.js';

/**
 * Short talk overlay. When voice is available, Game overwrites `text` with the
 * exact MP3 transcript so the subtitle never drifts from audio.
 */
export class ConversationSystem {
  constructor() {
    this.active = null;
  }

  open(customer, _state) {
    // Always open on the voiced chat line — random unvoiced banter caused
    // on-screen text to disagree with the MP3.
    const line = customer.chatLine || fillDialogueSpoken(
      pickDialogue(customer.species.id, 'chat'),
      { name: customer.name, order: customer.order },
    );
    this.active = {
      customer,
      text: `${customer.name}: ${line}`,
      timer: 0,
    };
    return this.active;
  }

  /** Baker Bear talking to himself — kept for tooling; gameplay no longer uses it. */
  openSelf(text) {
    this.active = {
      customer: { name: 'Baker Bear', species: { id: 'bear' } },
      text: `Baker Bear: ${text}`,
      timer: 0,
    };
    return this.active;
  }

  close() {
    this.active = null;
  }
}
