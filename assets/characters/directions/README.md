# Character Direction Sprites

Four-facing sprites for movement and seating cameras. Soft storybook realistic-cute style, chroma-keyed to transparent PNGs (~280 px tall).

## Naming

Flat files (primary for AssetLoader keys matching `Facing.js`):

```
{id}_front.png
{id}_side.png   # right-facing profile
{id}_back.png
{id}_left.png
```

Per-species folders (mirrors of the same frames):

```
{id}/front.png
{id}/side.png
{id}/back.png
{id}/left.png
```

## Species covered

bear, bear_hat, bear_glasses, bear_hat_glasses, bunny, dog, frog, elephant, giraffe, hedgehog, capybara, lion, leopard, tiger, deer, moose, crocodile, squirrel, panda, owl, pig, penguin, and `red_panda` when present.

## Notes

- Source turnaround sheets live under the Cursor project `assets/*-turnaround.png` cache.
- `side` is right-facing; `left` may be a dedicated view or a horizontal mirror of `side`.
- Use `src/entities/Facing.js` helpers to resolve keys with fallbacks.
