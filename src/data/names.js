export const FIRST_NAMES = [
  'Pip', 'Mochi', 'Bean', 'Noodle', 'Butter', 'Clover', 'Pebble', 'Sunny',
  'Maple', 'Biscuit', 'Olive', 'Pepper', 'Jam', 'Honey', 'Waffle', 'Toast',
  'Luna', 'Mango', 'Pudding', 'Crumb', 'Sprinkle', 'Cocoa', 'Berry', 'Ziggy',
  'Fizz', 'Tater', 'Dumpling', 'Sprout', 'Cookie', 'Nimbus',
];

export function randomName(rng = Math.random) {
  return FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
}
