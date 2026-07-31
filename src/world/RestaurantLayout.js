/**
 * Cozy bakery floor plan — real-kitchen flow:
 * ingredients on the west wall, prep bowls on the counter, big oven east,
 * pastry case + register + conveyor along the front counter.
 */

export const COLLISION_FOOTPRINT = {
  TABLE_INSET_X: 16,
  TABLE_INSET_Y: 22,
  FIXTURE_INSET_X: 10,
  FIXTURE_INSET_Y: 18,
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
  walls: [
    { x: 14, y: 14, w: 920, h: 10 },
    { x: 14, y: 610, w: 920, h: 10 },
    { x: 14, y: 14, w: 10, h: 606 },
    { x: 920, y: 14, w: 10, h: 606 },
    { x: 638, y: 24, w: 10, h: 134 },
    { x: 638, y: 232, w: 10, h: 168 },
    { x: 638, y: 470, w: 10, h: 40 },
    { x: 648, y: 240, w: 282, h: 10 },
    { x: 822, y: 112, w: 98, h: 6 },
    // Counter divider with pass-through for the conveyor lane (~x 300–420)
    { x: 28, y: 272, w: 250, h: 8 },
    { x: 430, y: 272, w: 208, h: 8 },
  ],
  doors: [
    { id: 'frontDoor', x: 18, y: 130, w: 16, h: 90, label: 'Front Door' },
    { id: 'bathDoor', x: 638, y: 160, w: 10, h: 70, label: 'Restroom Door' },
    { id: 'officeDoor', x: 638, y: 400, w: 10, h: 70, label: 'Office Door' },
  ],
  fixtures: [
    // —— Front counter: case → register → conveyor → serve window ——
    { id: 'display', label: 'Pastry Display', kind: 'display', action: 'stock_display', x: 48, y: 280, w: 220, h: 64 },
    { id: 'register', label: 'Cash Register', kind: 'register', action: 'open_or_order', x: 280, y: 284, w: 70, h: 44 },
    { id: 'conveyor', label: 'Serving Conveyor', kind: 'conveyor', action: 'serve', x: 360, y: 286, w: 160, h: 40 },
    { id: 'serve', label: 'Pickup Window', kind: 'serve', action: 'serve', x: 530, y: 284, w: 90, h: 46 },
    { id: 'openSign', label: 'Open / Close Sign', kind: 'openSign', action: 'open_restaurant', x: 28, y: 138, w: 40, h: 52 },

    // Big oven(s) under the pastry case — short carry up to the display
    { id: 'oven', label: 'Commercial Oven', kind: 'oven', action: 'bake', x: 90, y: 360, w: 140, h: 90 },
    { id: 'dishwasher', label: 'Dishwasher & Prep Sink', kind: 'dishwasher', action: 'wash_dishes', x: 480, y: 380, w: 100, h: 58 },
    { id: 'pantry', label: 'Pantry Shelf', kind: 'pantry', action: 'restock', x: 640, y: 500, w: 46, h: 80 },

    // Mixing bowls on prep island (south of ovens)
    { id: 'bowl1', label: 'Mixing Bowl A', kind: 'mixingBowl', action: 'mix_bowl', bowlId: 'bowl1', x: 200, y: 480, w: 58, h: 46 },
    { id: 'bowl2', label: 'Mixing Bowl B', kind: 'mixingBowl', action: 'mix_bowl', bowlId: 'bowl2', x: 280, y: 480, w: 58, h: 46 },
    { id: 'bowl3', label: 'Mixing Bowl C', kind: 'mixingBowl', action: 'mix_bowl', bowlId: 'bowl3', x: 360, y: 480, w: 58, h: 46 },

    // Ingredients along west wall + south strip (≈80px centers)
    { id: 'flour', label: 'Flour Bowl', kind: 'ingredientBowl', ingredientId: 'flour', action: 'add_ingredient', x: 40, y: 370, w: 44, h: 40 },
    { id: 'eggs', label: 'Egg Basket', kind: 'ingredientBowl', ingredientId: 'eggs', action: 'add_ingredient', x: 40, y: 450, w: 44, h: 40 },
    { id: 'milk', label: 'Milk Chiller', kind: 'ingredientBowl', ingredientId: 'milk', action: 'add_ingredient', x: 40, y: 530, w: 44, h: 40 },
    { id: 'butter', label: 'Butter Dish', kind: 'ingredientBowl', ingredientId: 'butter', action: 'add_ingredient', x: 120, y: 450, w: 44, h: 40 },
    { id: 'sugar', label: 'Sugar Jar', kind: 'ingredientBowl', ingredientId: 'sugar', action: 'add_ingredient', x: 120, y: 530, w: 44, h: 40 },
    { id: 'chips', label: 'Chocolate Chips', kind: 'ingredientBowl', ingredientId: 'chocolate_chips', action: 'add_ingredient', x: 200, y: 560, w: 44, h: 40 },
    { id: 'cocoa', label: 'Cocoa Tin', kind: 'ingredientBowl', ingredientId: 'cocoa', action: 'add_ingredient', x: 280, y: 560, w: 44, h: 40 },
    { id: 'honey', label: 'Honey Jar', kind: 'ingredientBowl', ingredientId: 'honey', action: 'add_ingredient', x: 360, y: 560, w: 44, h: 40 },
    { id: 'berries', label: 'Berry Bowl', kind: 'ingredientBowl', ingredientId: 'berries', action: 'add_ingredient', x: 440, y: 560, w: 44, h: 40 },
    { id: 'fruit', label: 'Fruit Crate', kind: 'ingredientBowl', ingredientId: 'fruit', action: 'add_ingredient', x: 520, y: 560, w: 44, h: 40 },
    { id: 'apple', label: 'Apple Bin', kind: 'ingredientBowl', ingredientId: 'apple', action: 'add_ingredient', x: 440, y: 480, w: 44, h: 40 },
    { id: 'carrot', label: 'Carrot Crate', kind: 'ingredientBowl', ingredientId: 'carrot', action: 'add_ingredient', x: 520, y: 480, w: 44, h: 40 },
    { id: 'peanut', label: 'Peanut Jar', kind: 'ingredientBowl', ingredientId: 'peanut', action: 'add_ingredient', x: 620, y: 430, w: 44, h: 40 },
    { id: 'mint', label: 'Mint Planter', kind: 'ingredientBowl', ingredientId: 'mint', action: 'add_ingredient', x: 620, y: 350, w: 44, h: 40 },
    { id: 'cheese', label: 'Cheese Plate', kind: 'ingredientBowl', ingredientId: 'cheese', action: 'add_ingredient', x: 400, y: 400, w: 44, h: 40 },

    // —— Office ——
    { id: 'shop', label: 'Office Shop Desk', kind: 'shop', action: 'open_shop', x: 705, y: 290, w: 120, h: 58 },
    { id: 'book', label: 'Recipe Bookcase', kind: 'bookcase', action: 'open_book', x: 860, y: 290, w: 42, h: 78 },
    { id: 'safe', label: 'Till Safe', kind: 'safe', action: 'bank', x: 745, y: 430, w: 46, h: 42 },

    // —— Restroom ——
    { id: 'bathSink1', label: 'Restroom Sink 1', kind: 'sink', action: 'clean_sink', x: 666, y: 52, w: 62, h: 44 },
    { id: 'bathSink2', label: 'Restroom Sink 2', kind: 'sink', action: 'clean_sink', x: 666, y: 132, w: 62, h: 44 },
    { id: 'toilet1', label: 'Toilet Stall 1', kind: 'toilet', action: 'clean_toilet', x: 852, y: 48, w: 52, h: 56 },
    { id: 'toilet2', label: 'Toilet Stall 2', kind: 'toilet', action: 'clean_toilet', x: 852, y: 128, w: 52, h: 56 },
  ],
  tables: [
    { id: 'table1', x: 100, y: 70, w: 76, h: 54, capacity: 2 },
    { id: 'table2', x: 285, y: 70, w: 76, h: 54, capacity: 2 },
    { id: 'table3', x: 470, y: 70, w: 76, h: 54, capacity: 2 },
  ],
  decor: [
    { id: 'citrusTree', kind: 'citrusTree', x: 520, y: 45, w: 48, h: 56 },
    { id: 'sofa', kind: 'sofa', x: 70, y: 202, w: 110, h: 42 },
    { id: 'plant1', kind: 'plant', x: 50, y: 45, w: 28, h: 34 },
    { id: 'plant2', kind: 'plant', x: 560, y: 200, w: 28, h: 34 },
  ],
  waypoints: {
    entrance: { x: 55, y: 175 },
    posQueue: { x: 300, y: 245 },
    diningSeat: { x: 160, y: 130 },
    exit: { x: 50, y: 175 },
    playerStart: { x: 300, y: 490 },
    pickup: { x: 575, y: 250 },
    restroomEntry: { x: 690, y: 195 },
    restroomAisle: { x: 790, y: 195 },
  },
  restroomStations: [
    { id: 'restroom1', toiletId: 'toilet1', sinkId: 'bathSink1', toilet: { x: 815, y: 82 }, sink: { x: 758, y: 78 } },
    { id: 'restroom2', toiletId: 'toilet2', sinkId: 'bathSink2', toilet: { x: 815, y: 162 }, sink: { x: 758, y: 158 } },
  ],
};

/** Second oven beside the primary oven. */
export const SECOND_OVEN_FIXTURE = {
  id: 'oven2',
  label: 'Second Oven',
  kind: 'oven',
  action: 'bake',
  x: 250,
  y: 360,
  w: 110,
  h: 90,
};

/** Extra lounge couch — appended when owned. */
export const EXTRA_COUCH_DECOR = {
  id: 'extraCouch',
  kind: 'sofa',
  x: 200,
  y: 200,
  w: 110,
  h: 42,
};

/** Café chairs near dining — appended when owned. */
export const EXTRA_CHAIRS_DECOR = [
  { id: 'chair1', kind: 'chair', x: 175, y: 95, w: 28, h: 28 },
  { id: 'chair2', kind: 'chair', x: 250, y: 95, w: 28, h: 28 },
  { id: 'chair3', kind: 'chair', x: 360, y: 95, w: 28, h: 28 },
  { id: 'chair4', kind: 'chair', x: 435, y: 95, w: 28, h: 28 },
];

/**
 * @param {{ secondOven?: boolean }} [opts]
 */
export function fixtureDefinitions(opts = {}) {
  const { secondOven = false } = opts;
  if (!secondOven) return [...PATISSERIE.fixtures];
  return [...PATISSERIE.fixtures, SECOND_OVEN_FIXTURE];
}

/**
 * @param {{ extraCouch?: boolean, extraChairs?: boolean }} [opts]
 */
export function decorDefinitions(opts = {}) {
  const list = [...PATISSERIE.decor];
  if (opts.extraCouch) list.push(EXTRA_COUCH_DECOR);
  if (opts.extraChairs) list.push(...EXTRA_CHAIRS_DECOR);
  return list;
}

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
