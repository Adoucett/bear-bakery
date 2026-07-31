# The Bear Bakery

A cozy kid-friendly bakery sim. Meet animal customers, read their likes & dislikes, assemble ingredients, bake, and serve!

## Play online

**[Play The Bear Bakery](https://adoucett.github.io/bear-bakery/)** — works in a phone, tablet, or laptop browser. Tap/click to move the bear; press Fullscreen for kiosk mode.

## Preview and explore the current game content

Open the interactive creative gallery:

`http://localhost:8000/showcase.html`

It previews the **current full-body PNG animals** (in `assets/characters/current/`),
all recipes, dialogue/bio samples, friend lists, and playable music. The old files in
`assets/sprites/animals/` are legacy head art and are not used by the game.

For a simple map of every important source file, see
[docs/FILE_GUIDE.md](docs/FILE_GUIDE.md).

## Run locally (macOS)

```bash
cd BearBakery
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

## How to play

1. **Prep** first: bake treats into the pastry case (make ahead!).
2. Press **Enter** or use the **Open sign** to open for customers.
3. Guests order something from their **likes list** (random each visit) and sit at a **table**.
4. Send matching stock from the **Serving Counter** — food rides the conveyor to their table.
5. Talk to anyone anytime. Clean dirty plates. Buy unlocks in the **Back Office (O)**.
6. If a dish includes something they dislike → they spit it out!

Take your time. Prep, then serve; days use a soft timer.

## Controls

| Action | Input |
|--------|--------|
| Move | `WASD` / arrows |
| Click-to-walk | Left-click floor |
| Mouse-follow | Right-click hold or `F` |
| Interact | `E` or click station |
| Study Book | `B` (or office bookshelf) |
| Pause | `P` or `Esc` |
| Mute | `M` |
| Next chill song | `N` |

The Study Book has every recipe (ingredients + bake time) and every animal’s personality, likes/dislikes, mini bios, and same-species friends.

## Progression

- **Day 1–2:** one customer at a time (easy)
- Later days: more customers can show up
- More animals unlock in the roster (red squirrel, red panda, and friends!)

## Assets

See [assets/README.md](assets/README.md) for current/legacy asset details and CC0 music credits.
Drop your own music tracks into `assets/audio/music/` and add them to the audio playlist in `src/config.js`.
