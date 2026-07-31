import { INGREDIENTS } from './ingredients.js';

/**
 * Recipes require assembling ingredients in the mixing bowl, then baking.
 * bakeTime is seconds of oven time (slow, kid-friendly pace).
 */
export const RECIPES = {
  cookie: {
    id: 'cookie',
    name: 'Cookie',
    price: 5,
    emoji: '🍪',
    ingredients: ['flour', 'eggs', 'milk', 'chocolate_chips'],
    bakeTime: 18,
  },
  honey_bun: {
    id: 'honey_bun',
    name: 'Honey Bun',
    price: 6,
    emoji: '🍯',
    ingredients: ['flour', 'eggs', 'butter', 'honey'],
    bakeTime: 22,
  },
  carrot_cake: {
    id: 'carrot_cake',
    name: 'Carrot Cake',
    price: 8,
    emoji: '🥕',
    ingredients: ['flour', 'eggs', 'carrot', 'sugar'],
    bakeTime: 35,
  },
  mint_cupcake: {
    id: 'mint_cupcake',
    name: 'Mint Cupcake',
    price: 6,
    emoji: '🧁',
    ingredients: ['flour', 'eggs', 'milk', 'mint'],
    bakeTime: 26,
  },
  peanut_pastry: {
    id: 'peanut_pastry',
    name: 'Peanut Pastry',
    price: 8,
    emoji: '🥜',
    ingredients: ['flour', 'butter', 'peanut', 'sugar'],
    bakeTime: 32,
  },
  fruit_tart: {
    id: 'fruit_tart',
    name: 'Fruit Tart',
    price: 7,
    emoji: '🍓',
    ingredients: ['flour', 'butter', 'fruit', 'sugar'],
    bakeTime: 30,
  },
  berry_muffin: {
    id: 'berry_muffin',
    name: 'Berry Muffin',
    price: 5,
    emoji: '🫐',
    ingredients: ['flour', 'eggs', 'milk', 'berries'],
    bakeTime: 28,
  },
  cocoa_bun: {
    id: 'cocoa_bun',
    name: 'Hot Cocoa Bun',
    price: 6,
    emoji: '☕',
    ingredients: ['flour', 'milk', 'butter', 'cocoa'],
    bakeTime: 30,
  },
  savory_pie: {
    id: 'savory_pie',
    name: 'Savory Pie',
    price: 9,
    emoji: '🥧',
    ingredients: ['flour', 'butter', 'cheese', 'eggs'],
    bakeTime: 36,
  },
  eclair: {
    id: 'eclair',
    name: 'Chocolate Éclair',
    price: 8,
    emoji: '🍫',
    ingredients: ['flour', 'eggs', 'milk', 'cocoa'],
    bakeTime: 34,
  },
  striped_cookie: {
    id: 'striped_cookie',
    name: 'Striped Cookie',
    price: 5,
    emoji: '🐯',
    ingredients: ['flour', 'eggs', 'sugar', 'chocolate_chips'],
    bakeTime: 26,
  },
  apple_danish: {
    id: 'apple_danish',
    name: 'Apple Danish',
    price: 6,
    emoji: '🍎',
    ingredients: ['flour', 'butter', 'apple', 'sugar'],
    bakeTime: 32,
  },
  acorn_cookie: {
    id: 'acorn_cookie',
    name: 'Acorn Cookie',
    price: 5,
    emoji: '🌰',
    ingredients: ['flour', 'butter', 'peanut', 'honey'],
    bakeTime: 27,
  },
};

export function getRecipe(id) {
  return RECIPES[id] || RECIPES.cookie;
}

export function recipeIngredientLabels(recipe) {
  return recipe.ingredients.map((id) => {
    const ing = INGREDIENTS[id];
    return ing ? `${ing.emoji} ${ing.name}` : id;
  });
}

/** True if bowl has at least every required ingredient (extras allowed unless disliked). */
export function bowlMatchesRecipe(bowlIds, recipe) {
  const have = new Set(bowlIds);
  return recipe.ingredients.every((id) => have.has(id));
}
