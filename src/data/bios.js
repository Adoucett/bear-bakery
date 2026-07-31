/**
 * Per-species bio templates + friend-name pools.
 * Customers of the same species get randomized names, bios, and friends.
 */

export const FRIEND_NAMES = {
  bunny: ['Thumper', 'Clover', 'Cotton', 'Daisy', 'Hopscotch'],
  dog: ['Biscuit', 'Waffles', 'Scout', 'Mochi', 'Puddle'],
  frog: ['Lily', 'Puddle', 'Ribbit', 'Moss', 'Dew'],
  elephant: ['Peanut', 'Trunky', 'Nellie', 'Jumbo', 'Olive'],
  giraffe: ['Stretch', 'Maple', 'Spot', 'Tallulah', 'Leaf'],
  hedgehog: ['Prickles', 'Button', 'Quill', 'Pebble', 'Nuzzle'],
  capybara: ['Chill', 'Sofa', 'River', 'Mellow', 'Toast'],
  lion: ['Regal', 'Mane', 'Sunny', 'Roary', 'Goldie'],
  leopard: ['Dottie', 'Silk', 'Glamour', 'Spotty', 'Velvet'],
  tiger: ['Stripe', 'Ember', 'Zap', 'Blaze', 'Tigger'],
  deer: ['Willow', 'Fawn', 'Moss', 'Fern', 'Acorn'],
  squirrel: ['Nutmeg', 'Acorn', 'Rusty', 'Twig', 'Pipkin'],
  moose: ['Antler', 'Marsh', 'Bigleaf', 'Moosey', 'Timber'],
  crocodile: ['Snap', 'Gatorade', 'Swampy', 'Chomp', 'Lilybit'],
  panda: ['Bamboo', 'Snowball', 'Naps', 'Round', 'Softie'],
  owl: ['Hoot', 'Twilight', 'Wisdom', 'Feather', 'Moon'],
  pig: ['Truffle', 'Oinky', 'Mudpie', 'Squeal', 'Apple'],
  penguin: ['Waddle', 'Icecube', 'Tux', 'Slippy', 'Frost'],
  red_panda: ['Berry', 'Rufus', 'Maple', 'Ginger', 'Bamboo', 'Rust'],
};

export const BIO_TEMPLATES = {
  bunny: [
    'Loves carrot cake almost as much as hopping through flower fields.',
    'Always early, always hungry, and always asking for sprinkles.',
    'Best known for thumping the floor when cookies take too long.',
  ],
  dog: [
    'Loyal regular who greets everyone at the door with a happy woof.',
    'Collects napkin doodles and leaves tips in the tip jar.',
    'Dreams of owning a bakery truck someday.',
  ],
  frog: [
    'Sits by the rainy window and orders mint treats slowly.',
    'Says “ribbit” instead of “thank you,” but means it kindly.',
    'Prefers soft seats and softer cupcakes.',
  ],
  elephant: [
    'Never forgets a good pastry — or a bad one.',
    'Needs a slightly bigger chair and a much bigger cookie.',
    'Brings flowers from the meadow every Tuesday.',
  ],
  giraffe: [
    'Politely ducks under every doorway on the way in.',
    'Orders fruit tarts while browsing the recipe book.',
    'Leaves thoughtful thank-you notes on tall napkins.',
  ],
  hedgehog: [
    'Whispers orders and hides behind a menu when shy.',
    'Loves berry muffins and quiet rainy afternoons.',
    'Rolls into a ball when the blender is too loud.',
  ],
  capybara: [
    'The chillest customer in town — unbothered, unhurried.',
    'Will wait forever if the cocoa buns smell right.',
    'Sometimes naps near the plant by the door.',
  ],
  lion: [
    'Dramatic entrances, dramatic orders, dramatic compliments.',
    'Insists on being called “Your Bakery Majesty.”',
    'Secretly loves napkin origami.',
  ],
  leopard: [
    'Fashionable, fancy, and very particular about éclairs.',
    'Always asks if the chocolate is “elegant enough.”',
    'Tips in glitter stickers when happy.',
  ],
  tiger: [
    'Burst of energy — orders fast, eats faster, cheers louder.',
    'Loves striped cookies that match their stripes.',
    'High-fives the register (gently).',
  ],
  deer: [
    'Gentle voice, gentle steps, gentle apple danish requests.',
    'Prefers quiet corners of the dining room.',
    'Brings pressed leaves as thank-you gifts.',
  ],
  squirrel: [
    'Red fur, big ideas, and pockets full of imaginary acorns.',
    'Will trade gossip about the park for an acorn cookie.',
    'Climbs onto the stool instead of sitting normally.',
  ],
  moose: [
    'Huge antlers, huge heart, and a soft spot for apple danish.',
    'Carefully tilts sideways to fit through the bakery door.',
    'Tells long woodland stories between bites.',
  ],
  crocodile: [
    'Smile looks scary — tastes are surprisingly sweet.',
    'Orders carefully so the mint doesn’t “snap back.”',
    'Loves rainy days and warm bakery windows.',
  ],
  panda: [
    'Half awake, fully ready for a honey bun.',
    'Naps after dessert like it’s a sacred ritual.',
    'Softest applause in the dining room.',
  ],
  owl: [
    'Night owl energy in a daytime bakery — still wise.',
    'Studies the recipe book cover to cover.',
    'Hoots softly when the tart is perfect.',
  ],
  pig: [
    'Cheerful, hungry, and excellent at saying yum.',
    'Leaves hoof-shaped crumbs somehow. Don’t ask.',
    'Believes every day should start with a cookie.',
  ],
  penguin: [
    'Waddles in like they own the ice cream freezer.',
    'Orders cocoa buns “nice and warm, please.”',
    'Does a tiny slide-celebration when served.',
  ],
  red_panda: [
    'Fluffy regular who chats about berry patches between bites.',
    'Thinks every muffin is better shared — then eats the whole thing.',
    'Leaves tiny thank-you notes that smell faintly of jam.',
  ],
};

/**
 * @param {string} speciesId
 * @param {string} selfName
 * @param {() => number} rng
 */
export function rollProfile(speciesId, selfName, rng = Math.random) {
  const friendsPool = (FRIEND_NAMES[speciesId] || ['Buddy', 'Pal']).filter(
    (n) => n.toLowerCase() !== selfName.toLowerCase(),
  );
  const shuffled = [...friendsPool].sort(() => rng() - 0.5);
  const friendCount = 1 + Math.floor(rng() * Math.min(3, shuffled.length));
  const friends = shuffled.slice(0, friendCount);

  const bios = BIO_TEMPLATES[speciesId] || ['A lovely bakery regular.'];
  const bio = bios[Math.floor(rng() * bios.length)];

  return { bio, friends };
}
