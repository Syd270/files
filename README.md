# Survivor

A survivor-style browser game. A knight on a rescue mission fights an endless skeleton horde, levels up, picks upgrades, and faces tougher dragons the longer he lasts. Built with plain JavaScript and HTML5 Canvas, with no frameworks, libraries, or build step.

### [▶ Play it here]https://syd270.github.io/files/


## How to play

- Your knight **fires automatically** at the nearest enemy (a dragon takes priority when it's in range).
- Skeletons drop **green XP gems** when they die. Grab them before they vanish (10 seconds).
- Each level-up lets you **pick 1 of 3 upgrades**: faster fire, more damage, extra projectiles, move speed, bullet speed, or pickup range.
- A **dragon arrives every 4 levels** (4, 8, 12, ...). Each one has more health than the last, hovers at a distance, and breathes fans of fireballs.
- One touch from a skeleton or a fireball ends the run. Your best survival time is saved in your browser.

| Action | Controls |
|---|---|
| Move | WASD or arrow keys |
| Pause / resume | P or Esc, the pause button, or a click while paused |
| Pick an upgrade | Click a card, or press 1 / 2 / 3 |
| Start / restart | Enter or click (R also restarts after a game over) |

The game also pauses automatically if you switch to another window or tab.

## Features

- **Delta-time game loop**: movement is speed × seconds elapsed, so the game runs at the same speed on 60 Hz and 144 Hz screens.
- **Mode-based state machine**: `menu`, `playing`, `paused`, `levelup`, and `gameover`, with separate `update` and `draw` steps each frame.
- **Auto-targeting combat**: nearest-enemy aiming, dragon priority within 500 px, multi-projectile fans, and circle-vs-circle collision.
- **Difficulty scaling**: the spawn interval shrinks from 1.0 s to a 0.25 s floor, enemy speed and health rise over time, and each dragon has 30 more HP than the one before.
- **Dragon boss fights**: dragons enter from the side away from the player, hover about 240 px away, breathe 3-fireball fans, show a health bar, and drop a burst of large XP gems when killed.
- **Upgrade system**: each upgrade is a name, a description, and a function that changes a player stat, so adding a new one is a single entry in `UPGRADES`.
- **Smooth level-ups**: a short slow-motion moment, a shockwave that knocks back and stuns nearby skeletons and clears nearby fireballs, a fade-in menu with a click-lock so accidental clicks don't pick, and 2 seconds of invulnerability after choosing.
- **Pixel art defined as code**: every sprite is a text grid in `sprites.js` that is turned into an image at load time, with mirrored and hit-flash versions pre-rendered.
- **Polish**: hit flashes, particle bursts, expiring XP gems that blink before they vanish, and a splash screen.
- **Persistence**: best survival time stored in `localStorage`, with a safe fallback if storage is blocked.

## Run it locally

No install needed.

## Project structure

```
index.html   page shell and canvas
style.css    page layout
sprites.js   pixel art (text grids), palettes, sprite builder
game.js      game loop, input, entities, combat, upgrades, drawing
```

## Tuning

| Setting | Where | Current value |
|---|---|---|
| XP gem lifetime | `GEM_LIFETIME` | 10 s |
| A dragon every N levels | `BOSS_EVERY` | 4 |
| Level-up slow-motion | `SLOWMO_TIME` | 0.6 s |
| Level-up shockwave reach | `SHOCK_RADIUS` | 520 px |
| Dragon health | `spawnDragon()` | 60 + 30 per dragon already spawned |
| Upgrades | `UPGRADES` | 6 |

## What I learned

- Structuring a game around a loop with `update(dt)` and `draw()`, and why delta time matters.
- Using a small state machine instead of scattered boolean flags.
- Tuning game feel: the first version's level-up froze the game and often got the player killed, so I added slow-motion, a shockwave, and a grace period.
- Keeping rendering separate from game logic made it easy to swap placeholder circles for pixel-art sprites late in the project.

## Known limitations and next steps

- Keyboard and mouse only. There are no touch controls yet, so it isn't playable on phones.
- Possible additions: new enemy types, sound effects, more upgrades and weapons, and an online leaderboard.

## Credits

- Code, design, and pixel art are original. No external assets or libraries.
- Built with AI assistance (Claude).
