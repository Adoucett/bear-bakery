/**
 * Cozy bakery floor plan — readable rooms, generous walk paths.
 * Collision boxes shrink toward visual bases so kids don't get stuck.
 */

/**
 * Collision footprint shrink for furniture AABBs.
 * Visual fixtures are taller than their solid bases; we shrink toward the
 * feet so characters can walk closer without clipping through table tops.
 */
export const COLLISION_FOOTPRINT = {
  /** Inset each side of tables (px). */
  TABLE_INSET_X: 16,
  TABLE_INSET_Y: 22,
  /** Inset for solid fixtures (oven, pantry, shop, bookcase, safe). */
  FIXTURE_INSET_X: 10,
  FIXTURE_INSET_Y: 18,
  /** Extra downward bias so the box sits on the visual base. */
  BASE_BIAS_Y: 8,
};

export const PATISSERIE = {
  bounds: { x: 0, y: 0, w: 960, h: 640 },
  rooms: [
    { id: 'dining', name: 'Dining Room', x: 28, y: 28, w: 610, h: 250, floor: '#e8c89a' },
    { id: 'counter', name: 'Pastry Counter', x: 28, y: 278, w: 610, h: 72, floor: '#f0e0c8' },
    { id: 'kitchen', name: 'Open Kitchen', x: 28, y: 350, w: 640, h: 250, floor: '#f5f1e8' },
    { id: 'office', name: 'Back Office', x: 658, y: 252, w: 262, h: 258, floor: '#e0c8a8' },
    { id: 'bathroom', name: 'Restroom', x: 650, y: 28, w: 270, h: 212, floor: '#c5e0e8' },
  ],
  // Thin outer shell + room dividers with wide door gaps for free movement
  walls: [
    // Outer shell
    { x: 14, y: 14, w: 920, h: 10 },
    { x: 14, y: 610, w: 920, h: 10 },
    { x: 14, y: 14, w: 10, h: 606 },
    { x: 920, y: 14, w: 10, h: 606 },
    // Dining / restroom divider with a broad, direct restroom doorway.
    { x: 638, y: 24, w: 10, h: 134 },
    // Kitchen / office divider, split to leave a real 70px office doorway at
    // y 400–470 that lines up with the officeDoor sprite.
    { x: 638, y: 232, w: 10, h: 168 },
    { x: 638, y: 470, w: 10, h: 40 },
    // Restroom / office divider.
    { x: 648, y: 240, w: 282, h: 10 },
    // Two roomy toilet bays. Their fronts open onto the wide central aisle.
    { x: 822, y: 112, w: 98, h: 6 },
    // Counter low wall with wide pass-through (~x 300–420)
    { x: 28, y: 272, w: 260, h: 8 },
    { x: 430, y: 272, w: 208, h: 8 },
  ],
  doors: [
    { id: 'frontDoor', x: 24, y: 140, w: 10, h: 70, label: 'Front Door' },
    { id: 'bathDoor', x: 638, y: 160, w: 10, h: 70, label: 'Restroom Door' },
    { id: 'officeDoor', x: 638, y: 400, w: 10, h: 70, label: 'Office Door' },
  ],
  fixtures: [
    { id: 'register', label: 'Cash Register', kind: 'register', action: 'open_or_order', x: 352, y: 284, w: 70, h: 44 },
    // Wide, roomy case so every stocked treat is readable at a glance.
    { id: 'display', label: 'Pastry Display', kind: 'display', action: 'stock_display', x: 58, y: 282, w: 274, h: 62 },
    // Ingredient wall: 5 per shelf on a 78px pitch so neighbouring stations
    // stop competing for the same interaction radius.
    { id: 'flour', label: 'Flour Bowl', kind: 'ingredientBowl', ingredientId: 'flour', action: 'add_ingredient', x: 44, y: 378, w: 44, h: 40 },
    { id: 'eggs', label: 'Egg Basket', kind: 'ingredientBowl', ingredientId: 'eggs', action: 'add_ingredient', x: 122, y: 378, w: 44, h: 40 },
    { id: 'milk', label: 'Milk Chiller', kind: 'ingredientBowl', ingredientId: 'milk', action: 'add_ingredient', x: 200, y: 378, w: 44, h: 40 },
    { id: 'butter', label: 'Butter Dish', kind: 'ingredientBowl', ingredientId: 'butter', action: 'add_ingredient', x: 278, y: 378, w: 44, h: 40 },
    { id: 'sugar', label: 'Sugar Jar', kind: 'ingredientBowl', ingredientId: 'sugar', action: 'add_ingredient', x: 356, y: 378, w: 44, h: 40 },
    { id: 'chips', label: 'Chocolate Chips', kind: 'ingredientBowl', ingredientId: 'chocolate_chips', action: 'add_ingredient', x: 44, y: 456, w: 44, h: 40 },
    { id: 'cocoa', label: 'Cocoa Tin', kind: 'ingredientBowl', ingredientId: 'cocoa', action: 'add_ingredient', x: 122, y: 456, w: 44, h: 40 },
    { id: 'honey', label: 'Honey Jar', kind: 'ingredientBowl', ingredientId: 'honey', action: 'add_ingredient', x: 200, y: 456, w: 44, h: 40 },
    { id: 'berries', label: 'Berry Bowl', kind: 'ingredientBowl', ingredientId: 'berries', action: 'add_ingredient', x: 278, y: 456, w: 44, h: 40 },
    { id: 'fruit', label: 'Fruit Crate', kind: 'ingredientBowl', ingredientId: 'fruit', action: 'add_ingredient', x: 356, y: 456, w: 44, h: 40 },
    { id: 'apple', label: 'Apple Bin', kind: 'ingredientBowl', ingredientId: 'apple', action: 'add_ingredient', x: 44, y: 534, w: 44, h: 40 },
    { id: 'carrot', label: 'Carrot Crate', kind: 'ingredientBowl', ingredientId: 'carrot', action: 'add_ingredient', x: 122, y: 534, w: 44, h: 40 },
    { id: 'peanut', label: 'Peanut Jar', kind: 'ingredientBowl', ingredientId: 'peanut', action: 'add_ingredient', x: 200, y: 534, w: 44, h: 40 },
    { id: 'mint', label: 'Mint Planter', kind: 'ingredientBowl', ingredientId: 'mint', action: 'add_ingredient', x: 278, y: 534, w: 44, h: 40 },
    { id: 'cheese', label: 'Cheese Plate', kind: 'ingredientBowl', ingredientId: 'cheese', action: 'add_ingredient', x: 356, y: 534, w: 44, h: 40 },
    { id: 'bowl1', label: 'Mixing Bowl A', kind: 'mixingBowl', action: 'mix_bowl', bowlId: 'bowl1', x: 432, y: 378, w: 58, h: 46 },
    { id: 'bowl2', label: 'Mixing Bowl B', kind: 'mixingBowl', action: 'mix_bowl', bowlId: 'bowl2', x: 432, y: 456, w: 58, h: 46 },
    { id: 'bowl3', label: 'Mixing Bowl C', kind: 'mixingBowl', action: 'mix_bowl', bowlId: 'bowl3', x: 432, y: 534, w: 58, h: 46 },
    // Oven beside the pastry case (~170px walk to display); compact fixture box clears ingredient row.
    { id: 'oven', label: 'Commercial Oven', kind: 'oven', action: 'bake', x: 210, y: 346, w: 88, h: 31 },
    { id: 'dishwasher', label: 'Dishwasher & Prep Sink', kind: 'dishwasher', action: 'wash_dishes', x: 500, y: 556, w: 92, h: 58 },
    { id: 'serve', label: 'Serving Counter', kind: 'serve', action: 'serve', x: 442, y: 288, w: 100, h: 46 },
    { id: 'openSign', label: 'Open / Close Sign', kind: 'register', action: 'open_restaurant', x: 32, y: 145, w: 36, h: 46 },
    // Well clear of the oven and of the office doorway approach (y 400–470).
    { id: 'pantry', label: 'Pantry Shelf', kind: 'pantry', action: 'restock', x: 612, y: 496, w: 46, h: 92 },
    { id: 'shop', label: 'Office Shop Desk', kind: 'shop', action: 'open_shop', x: 705, y: 290, w: 120, h: 58 },
    { id: 'book', label: 'Recipe Bookcase', kind: 'bookcase', action: 'open_book', x: 860, y: 290, w: 42, h: 78 },
    { id: 'safe', label: 'Till Safe', kind: 'safe', action: 'bank', x: 745, y: 430, w: 46, h: 42 },
    // Sinks and toilets face each other across a 100+ px aisle.
    { id: 'bathSink1', label: 'Restroom Sink 1', kind: 'sink', action: 'clean_sink', x: 666, y: 52, w: 62, h: 44 },
    { id: 'bathSink2', label: 'Restroom Sink 2', kind: 'sink', action: 'clean_sink', x: 666, y: 132, w: 62, h: 44 },
    { id: 'toilet1', label: 'Toilet Stall 1', kind: 'toilet', action: 'clean_toilet', x: 852, y: 48, w: 52, h: 56 },
    { id: 'toilet2', label: 'Toilet Stall 2', kind: 'toilet', action: 'clean_toilet', x: 852, y: 128, w: 52, h: 56 },
  ],
  // Tables spaced with clear aisles between / around
  tables: [
    { id: 'table1', x: 100, y: 70, w: 76, h: 54, capacity: 2 },
    { id: 'table2', x: 285, y: 70, w: 76, h: 54, capacity: 2 },
    { id: 'table3', x: 470, y: 70, w: 76, h: 54, capacity: 2 },
  ],
  decor: [
    // Corner accents — not in the main walk aisle
    { id: 'citrusTree', kind: 'citrusTree', x: 520, y: 45, w: 48, h: 56 },
    { id: 'sofa', kind: 'sofa', x: 70, y: 202, w: 110, h: 42 },
    { id: 'plant1', kind: 'plant', x: 50, y: 45, w: 28, h: 34 },
    { id: 'plant2', kind: 'plant', x: 560, y: 200, w: 28, h: 34 },
  ],
  waypoints: {
    entrance: { x: 55, y: 175 },
    posQueue: { x: 360, y: 245 },
    diningSeat: { x: 160, y: 130 },
    exit: { x: 50, y: 175 },
    playerStart: { x: 400, y: 500 },
    restroomEntry: { x: 690, y: 195 },
    restroomAisle: { x: 790, y: 195 },
  },
  restroomStations: [
    { id: 'restroom1', toiletId: 'toilet1', sinkId: 'bathSink1', toilet: { x: 815, y: 82 }, sink: { x: 758, y: 78 } },
    { id: 'restroom2', toiletId: 'toilet2', sinkId: 'bathSink2', toilet: { x: 815, y: 162 }, sink: { x: 758, y: 158 } },
  ],
};

/** Second oven — appended when the upgrade is owned. */
export const SECOND_OVEN_FIXTURE = {
  id: 'oven2',
  label: 'Second Oven',
  kind: 'oven',
  action: 'bake',
  x: 300,
  y: 430,
  w: 88,
  h: 31,
};

/**
 * Active fixtures for the current save (second oven is dynamic).
 * @param {{ secondOven?: boolean }} [opts]
 */
export function fixtureDefinitions(opts = {}) {
  const { secondOven = false } = opts;
  if (!secondOven) return [...PATISSERIE.fixtures];
  return [...PATISSERIE.fixtures, SECOND_OVEN_FIXTURE];
}

/** Upgrade table definitions. `extraTables` is a table count, not a seat count. */
export function tableDefinitions(extraTables = 0) {
  const positions = [
    { id: 'extraTable1', x: 255, y: 190, w: 76, h: 54, capacity: 2 },
    { id: 'extraTable2', x: 455, y: 190, w: 76, h: 54, capacity: 2 },
  ];
  return [...PATISSERIE.tables, ...positions.slice(0, Math.max(0, extraTables))];
}

export function collisionRects(extraTables = 0, layoutOpts = {}) {
  const {
    TABLE_INSET_X,
    TABLE_INSET_Y,
    FIXTURE_INSET_X,
    FIXTURE_INSET_Y,
    BASE_BIAS_Y,
  } = COLLISION_FOOTPRINT;

  return [
    ...PATISSERIE.walls,
    ...fixtureDefinitions(layoutOpts)
      .filter((f) => ['oven', 'pantry', 'shop', 'bookcase', 'safe', 'dishwasher', 'sink', 'toilet'].includes(f.kind))
      .map(({ x, y, w, h }) => ({
        x: x + FIXTURE_INSET_X,
        y: y + FIXTURE_INSET_Y + BASE_BIAS_Y,
        w: Math.max(10, w - FIXTURE_INSET_X * 2),
        h: Math.max(10, h - FIXTURE_INSET_Y * 2 - BASE_BIAS_Y),
      })),
    ...tableDefinitions(extraTables).map(({ x, y, w, h }) => ({
      x: x + TABLE_INSET_X,
      y: y + TABLE_INSET_Y + BASE_BIAS_Y,
      w: Math.max(10, w - TABLE_INSET_X * 2),
      h: Math.max(10, h - TABLE_INSET_Y * 2 - BASE_BIAS_Y),
    })),
  ];
}
