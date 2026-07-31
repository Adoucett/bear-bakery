export const DIFFICULTY_PRESETS = {
  cozy: {
    id: 'cozy',
    name: 'Cozy',
    startingMoney: 100,
    spawnMultiplier: 1.7,
    pickiness: 0.45,
    dayLength: 400,
    description: '1 friend at a time, lots of thinking time.',
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    startingMoney: 50,
    spawnMultiplier: 1,
    pickiness: 1,
    dayLength: 300,
    description: 'A few friends may visit together.',
  },
  busy: {
    id: 'busy',
    name: 'Busy',
    startingMoney: 30,
    spawnMultiplier: 0.72,
    pickiness: 1.3,
    dayLength: 240,
    description: 'Quicker orders and shorter waiting time.',
  },
};
