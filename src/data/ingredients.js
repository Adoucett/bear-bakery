/** Kitchen ingredient catalog — stations map to these ids. */
export const INGREDIENTS = {
  flour: { id: 'flour', name: 'Flour', emoji: '🌾', color: '#f5f0e6' },
  eggs: { id: 'eggs', name: 'Eggs', emoji: '🥚', color: '#fff8dc' },
  milk: { id: 'milk', name: 'Milk', emoji: '🥛', color: '#f0f4ff' },
  butter: { id: 'butter', name: 'Butter', emoji: '🧈', color: '#ffe566' },
  sugar: { id: 'sugar', name: 'Sugar', emoji: '🧂', color: '#ffffff' },
  chocolate_chips: { id: 'chocolate_chips', name: 'Chocolate Chips', emoji: '🍫', color: '#5c3317' },
  carrot: { id: 'carrot', name: 'Carrot', emoji: '🥕', color: '#f08a24' },
  berries: { id: 'berries', name: 'Berries', emoji: '🫐', color: '#5b2c6f' },
  apple: { id: 'apple', name: 'Apple', emoji: '🍎', color: '#e74c3c' },
  honey: { id: 'honey', name: 'Honey', emoji: '🍯', color: '#d4a017' },
  mint: { id: 'mint', name: 'Mint', emoji: '🌿', color: '#6bbf8a' },
  peanut: { id: 'peanut', name: 'Peanut', emoji: '🥜', color: '#c4a574' },
  cocoa: { id: 'cocoa', name: 'Cocoa', emoji: '☕', color: '#4a3728' },
  fruit: { id: 'fruit', name: 'Fruit', emoji: '🍓', color: '#e85d75' },
  cheese: { id: 'cheese', name: 'Cheese', emoji: '🧀', color: '#f4d03f' },
  onion: { id: 'onion', name: 'Onion', emoji: '🧅', color: '#d2b48c' },
  spicy: { id: 'spicy', name: 'Spicy Pepper', emoji: '🌶️', color: '#c0392b' },
};

export function getIngredient(id) {
  return INGREDIENTS[id] || null;
}
