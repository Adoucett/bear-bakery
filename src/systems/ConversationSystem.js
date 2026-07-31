import { pickDialogue, fillDialogueSpoken } from '../data/dialogue.js';

const RESTAURANT_COMMENTS = [
  'The pale oak floor makes this place feel so sunny.',
  'I love the brass lights. They make the pastries sparkle.',
  'This little patisserie is getting prettier every day.',
  'The glass pastry case looks delicious from every angle.',
];

export class ConversationSystem {
  constructor() {
    this.active = null;
    /** @type {Map<string, number>} */
    this.history = new Map();
  }

  open(customer, state) {
    const lines = this.linesFor(customer, state);
    const key = `${customer.name}:${customer.state}`;
    const index = (this.history.get(key) ?? 0) % lines.length;
    this.history.set(key, index + 1);
    this.active = { customer, text: lines[index], timer: 0 };
    return this.active;
  }

  /** Baker Bear talking to himself — same overlay, no customer state. */
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

  linesFor(customer, state) {
    const sid = customer.species.id;
    const name = customer.name;
    // Conversation text can be replaced by a voice clip's transcript, so keep
    // it spoken-safe.
    const order = customer.order;
    const fill = (bucket) => fillDialogueSpoken(pickDialogue(sid, bucket), { name, order });

    /** @type {string[]} */
    const lines = [];

    if (customer.state === 'greeting') {
      lines.push(`${name}: ${customer.greetLine || fill('greet')}`);
      lines.push(`${name}: ${customer.orderLine || fill('order')}`);
      lines.push(`${name}: I really like ${customer.species.likesText}. I do not like ${customer.species.dislikesText}.`);
    } else if (customer.state === 'waitingForSeat') {
      lines.push(`${name}: I'll wait here until a little table opens up.`);
      lines.push(`${name}: ${fill('chat')}`);
    } else if (customer.state === 'waiting' || customer.state === 'walkingToTable') {
      lines.push(`${name}: ${fill('wait')}`);
      if (customer.seat) lines.push(`${name}: I'll be at ${customer.seat.label}!`);
      lines.push(`${name}: ${fill('chat')}`);
    } else if (customer.state === 'eating') {
      if (customer.happiness >= 1) lines.push(`${name}: ${fill('thanks')}`);
      else lines.push(`${name}: ${fill('dislikeReact')}`);
      lines.push(`${name}: ${fill('chat')}`);
    } else {
      lines.push(`${name}: ${fill('chat')}`);
      lines.push(`${name}: ${fill('greet')}`);
    }

    if ((state.ambience ?? 0) > 0) {
      lines.push(`${name}: ${RESTAURANT_COMMENTS[(name.length + state.ambience) % RESTAURANT_COMMENTS.length]}`);
    }
    if ((state.tables ?? 3) < 5) {
      lines.push(`${name}: More little café tables would be nice for my friends.`);
    }
    return lines;
  }
}
