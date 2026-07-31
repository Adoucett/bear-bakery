# Bear Bakery File Guide

Use this guide when you want to change something without guessing where it
lives. Start with `showcase.html` to preview the current cast, recipes,
dialogue, and music.

## The important distinction

| Folder / file | Status | What it is |
|---|---|---|
| `assets/characters/current/` | Current | Full-body realistic-cute PNG sprites. |
| `assets/characters/directions/` | Current | 4-way facing (`{id}_front/back/side/left.png`). |
| `assets/characters/poses/` | Optional | Sit poses (`{id}_sit.png`) for waiting/eating. |
| `assets/furniture/` | Current | Oven, display, tables, decor PNGs (procedural fallback). |
| `src/entities/CharacterArt.js` | Current | Draws sprites + breath/walk micro-animation. |
| `src/entities/Facing.js` | Current | facingDir + sit pose image resolution. |
| `src/entities/CuteAnimals.js` | Fallback | Old procedural drawings if a PNG fails. |
| `assets/sprites/animals/` | Legacy, not used | Old Kenney cropped animal heads. |
| `assets/audio/music/` | Current | The actual cozy tracks the game plays. |
| `assets/audio/sfx/` | Current | Clicks, bells, happy/sad sounds. |

## Change an animal

1. To change how they look: replace `assets/characters/current/<id>.png`
   (transparent PNG, full body). Baker Bear cosmetics: `bear_hat.png`,
   `bear_glasses.png`, `bear_hat_glasses.png`.
2. Facing: add `assets/characters/directions/<id>_front.png` (and back/side/left).
3. Sit pose (optional): `assets/characters/poses/<id>_sit.png` — used while
   waiting/eating at a seat. Missing files fall back to front/standing.
4. Register new keys in `src/config.js` → `ASSET_MANIFEST.images` (AssetLoader
   soft-fails if a registered file is not on disk yet).
5. Open `src/data/species.js` for size, personality, likes, dislikes.
6. Dialogue: `src/data/dialogue.js`. Bios: `src/data/bios.js`.
7. Micro-animation lives in `src/entities/CharacterArt.js`.

## Prep, stock, shop, service

| File | Role |
|---|---|
| `src/systems/StockSystem.js` | Finished pastry case inventory |
| `src/systems/SeatingSystem.js` | Table seats + dirty dishes |
| `src/systems/FoodConveyorSystem.js` | Food trays to tables (queued/staggered) |
| `src/ui/ShopUI.js` | Gold/gray unlock shop + Yes/No |
| `src/data/upgrades.js` | Tables, decor, equipment, bear style, staff |
| `src/engine/Game.js` | PREP → open → SERVICE → clean → new day |
| `src/engine/AudioManager.js` | Unlock on first gesture; playlist |

## Change dialogue

| File | Changes |
|---|---|
| `src/data/bios.js` | Mini bios and friend name pools |
| `src/data/species.js` | Greeting, likes, dislikes, personality |
| `src/systems/ConversationSystem.js` | Dynamic in-store conversation rules |
| `src/ui/ProfileCard.js` | Arrival/customer profile card look |

## Change food and inventory

| File | Changes |
|---|---|
| `src/data/ingredients.js` | Ingredient name, emoji, color |
| `src/data/recipes.js` | Recipes, ingredients, price, bake time |
| `src/systems/InventorySystem.js` | Bowl quantities, refill rules |
| `src/systems/CookingSystem.js` | Combine, bake, and serving rules |

## Change the restaurant

| File | Changes |
|---|---|
| `src/world/RestaurantLayout.js` | Rooms, fixtures, doors, tables; `COLLISION_FOOTPRINT` |
| `src/entities/Character.js` | `COLLISION` feet-biased AABB |
| `src/world/IsoRenderer.js` | Furniture PNGs + procedural fallback, direction/sit, Y-sort by feet |
| `src/world/IsoMath.js` | Oblique 2.5D projection (mild skew + Y foreshortening) |
| `src/engine/IsoCamera.js` | Camera follow, focus, zoom |

## Change shop/economy/difficulty

| File | Changes |
|---|---|
| `src/data/upgrades.js` | Shop item names, prices, effects |
| `src/data/difficulty.js` | Cozy/Balanced/Busy setup |
| `src/systems/EconomySystem.js` | Money and purchase logic |
| `src/systems/StaffSystem.js` | Server, stocker, prep helper automation |
| `src/engine/SaveManager.js` | Browser save data |

## Preview pages

| URL | Use |
|---|---|
| `http://localhost:8000/` | Play the current game |
| `http://localhost:8000/showcase.html` | Browse animals, recipes, dialogue, and music |

## Current asset paths

```
assets/
  audio/
    music/                 # Cozy playlist
    sfx/                   # UI / feedback sounds
  characters/
    current/               # Standing body sprites
    directions/            # {id}_front|back|side|left.png (+ nested folders)
    poses/                 # {id}_sit.png (optional, art in progress)
  furniture/               # Oven, display, tables, decor
  sprites/
    animals/               # Legacy unused Kenney heads
```
