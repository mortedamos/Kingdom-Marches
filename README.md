# Kingdom Marches

A browser-based 4X strategy game -- world generation, per-tile territory
influence, dice+HP combat, city growth, a 185-node tech tree, and a
utility-scoring AI, all running client-side with no server and no build
step.

## Working on this repo

The game needs no build step -- it's plain `<script>` tags loaded by
`index.html`, served over HTTP (not `file://`).

There is one **per-clone** setup command. It points Git at the tracked hook
directory, and without it the pre-commit hook silently does nothing:

```
git config core.hooksPath .githooks
```

`.githooks/pre-commit` stamps the build date, time and number into
`js/data/config.js` (the `build` section) on every commit, which is what the
title screen shows. Skip it for one commit with `git commit --no-verify`.

## Project structure

```
index.html               Entry point -- loads every script below in
                          dependency order (data -> engine -> audio -> ui ->
                          main.js), no bundler
css/style.css             All styling

js/data/                  PURE DATA -- no logic.
  config.js                 Every balance dial in one place (combat,
                             research, upkeep, view/clouds, the build stamp)
  races.js                    Per-race personality traits, starting tech,
                              identity/color/symbol -- combat and yield
                              bonuses come entirely from the tech tree, not
                              from this file
  race-names.js                 Curated city name lists per race
  terrain.js                      Terrain types, base yields, movement costs
  units.js                          Base unit stats; combat identity comes
                                    from properties (First Strike/Siege/
                                    Flying), not a role/counter triangle
  buildings.js                        Building data -- structures are placed
                                      on tiles adjacent to a city, not
                                      "inside" it, and can be attacked
  techs.js                              The tech tree: 185 nodes, a shared
                                        root layer plus 5 layers x 3 columns
                                        (civic/building/military) per race
  sprite-manifests.js                     Animation metadata per sprite key
  sfx-actions.js                            Which (race, unit, action)
                                            combos should have a sound,
                                            derived from units.js/races.js
  sfx-manifest.js                             GENERATED list of files that
                                              actually exist in assets/sfx/
  unit-names.js                                 Personal name/epithet pools
                                                per race (flavor only)
  quips.js                                        Flavor one-liners units
                                                   occasionally say
  riddles.js                                        Halfellow's "Riddle"
                                                     ability question bank

js/engine/                GAME LOGIC -- reads data/, has none of its own.
  worldgen.js                Elevation/climate noise -> terrain, rivers,
                             ruins, resources, minimum-landmass enforcement
  influence.js                 The core mechanic: per-tile influence
                               accumulation, the 2/3 ownership threshold,
                               contested-tile decay
  pathfinding.js                 A* search over the tile grid, with a
                                 best-effort fallback to the closest
                                 reachable tile if the target is unreachable
  cities.js                        Growth, yield, upkeep, founding, naming,
                                   structure placement, gradual tile "fill-in"
  combat.js                          Simultaneous-exchange combat (full
                                     attacker damage, half-damage defender
                                     counter unless negated), First Strike/
                                     Siege/Flying properties, plus the
                                     multi-round resolveToTheDeath used
                                     internally for AI win-probability
                                     estimation
  tech.js                              Research: pays a tech's cost up
                                       front, counts down a fixed timer,
                                       applies its effects
  quips.js                               Decides when a unit says a line
  floatingtext.js                          Drifting "+N XP"/"Level Up!"
                                           text events
  deathfx.js                                 Death animation events
  strategy.js                                  Persistent multi-turn AI
                                               doctrine, layered above ai.js
  ai.js                                          Utility-scoring AI: scores
                                                 every candidate action by
                                                 race weights + aggressiveness
                                                 and executes the best one
                                                 within budget each turn
  turns.js                                         Turn orchestration:
                                                    visibility, ownership,
                                                    city/research ticks, AI
                                                    civs, healing, victory
                                                    condition, history
  orders.js                                          Player orders -- a thin
                                                      adapter over the same
                                                      functions the AI uses,
                                                      so player and AI
                                                      attacks run identical
                                                      code; the sidebar
                                                      renders information
                                                      only, this decides
                                                      what a unit/city can do
  savegame.js                                          Serializes game state
                                                        to/from JSON

js/audio/
  music.js                 <race>_<situation>_<variant>.mp3 convention,
                           situation priority combat > default, no-repeat
                           variant cycling, volume persistence,
                           missing files logged and skipped, never a crash
  sfx.js                    Per-unit/per-action clips plus system sounds
                            (button clicks, confirmations, research
                            complete)

js/ui/
  render.js                 Canvas 2D map rendering (terrain, units,
                            cities, toggleable influence overlay)
  render3d.js                 Experimental WebGL heightmap renderer, reads
                              the same gameState as render.js with no
                              engine changes -- currently disabled in the UI
  overlays.js                   Screen-space draw helpers + the shared
                                event queue (combat anims, quips, floating
                                text, HP bars, condition badges) both
                                renderers read from
  sidebar.js                      Tabbed inspector for the selected tile
                                  (city/unit/building/terrain/kingdom) plus
                                  the civ-wide summary -- information only,
                                  no action buttons
  input.js                          Mouse interactions: click to select,
                                    drag to pan; right-click opens the ring
                                    menu
  ringmenu.js                         The radial map menu -- actions render
                                      as pills arranged around the clicked
                                      unit/city on the map itself, not a
                                      linear list at the cursor
  buildlist.js                          City build-list rows (what a city
                                        can build, cost, affordability)
  sprites.js                              Loads terrain/unit/city/
                                          enhancement PNGs; missing sprites
                                          fall back to color/symbol
  techtree.js                               Full per-civ tech tree viewer,
                                            laid out by layer x column
  reports.js                                  Line-graph viewer (influence
                                              tile count, military power)
  dialog.js                                     In-game modal dialogs
                                                (replaces confirm/prompt/
                                                alert)
  credits.js                                      Renders credits.txt (root
                                                   folder) as the scrolling
                                                   credits crawl
  clouds.js                                         Cosmetic drifting cloud
                                                     layer at the viewport
                                                     edges
  villagers.js                                        Cosmetic ambient
                                                       figures wandering
                                                       between a city's
                                                       structures

js/main.js                Bootstrap: title/setup screen, race/civ/spectator
                          selection, world+civ creation, the main render/
                          turn loop, keyboard shortcuts, save/load and
                          overlay wiring. Deliberately thin -- wires modules
                          together, minimal logic of its own.

assets/                   Real, checked-in art/audio (see "Assets" below)
credits.txt               Credits crawl source (root folder; see credits.js)
doc/                      Design references
.githooks/pre-commit      Build-stamp hook (see above)
working/                  Asset-authoring tooling (sprite slicing, chroma-
                          key, SFX manifest regeneration) -- not part of the
                          shipped game
```

## Core systems

- **Races**: Human, Elf, Dwarf, Orc, Undead, Halfellow. Each has personality
  traits (militarism, expansionism, curiosity, industriousness,
  aggressiveness) that drive its AI's decisions, plus a starting tech.
  Mechanical identity -- combat bonuses, yield bonuses, unique abilities --
  comes from each race's own branch of the tech tree, not from flat
  modifiers on the race itself.
- **Resources**: Harvest (food/growth), Coin (production + gold, merged),
  Lore (research).
- **The influence/territory system**: per-tile influence accumulates from
  city radius falloff and military unit presence; a tile flips to a civ's
  ownership once it crosses a 2/3 threshold, and reverts to neutral after a
  contested-tile grace period. This is the core mechanic the rest of the
  game is built around.
- **Combat**: a simultaneous exchange -- the attacker deals full damage, the
  defender counters for half unless negated, missed, or evaded (First
  Strike, Siege, Flying are unit properties that modify this, not a rock-
  paper-scissors counter triangle). One exchange per attack action; a human
  player re-initiates an attack each turn to keep fighting the same target.
- **The tech tree**: 185 nodes -- a shared root layer every race starts
  from, then 5 layers deep x 3 columns (civic/building/military) per race.
  Viewable in full via the "View Tech Tree" button.
- **The ring menu**: right-clicking a unit or city opens a radial menu of
  actions around it directly on the map, rather than a linear list at the
  cursor or buttons in the sidebar. The sidebar is pure information display.
- **Keyboard shortcuts**: WASD pans the map, Space acts on the current
  selection (Rest and Defend / Gather Resources), arrow keys move the
  selected unit, Shift arms a "repeat for the next 3 turns" auto-repeat on
  eligible actions, M toggles sound. Full list under Interface -> Keyboard
  Shortcuts.
- **Pathfinding**: real A* search over the tile grid, with a best-effort
  fallback to the closest reachable tile when the destination itself can't
  be reached.
- **Spectator mode**: watch two or more AI races play each other with no
  human-controlled civ, at adjustable speed, with full map visibility.
- **Save/load**: serializes the full game state to a `.json` file and back.
- **3D rendering**: an experimental WebGL heightmap renderer
  (`render3d.js`) exists and is still maintained, but is currently disabled
  in the UI in favor of the 2D canvas renderer.

## Assets

`assets/` ships real, checked-in art and audio -- it is not an empty
directory waiting on user-supplied files:

- `assets/img/` -- logo and title background
- `assets/music/` -- title, per-race default/victory tracks, neutral tracks
  for spectator mode, and a game-over sting
- `assets/sfx/` -- per-unit/per-action sound effects plus system sounds
- `assets/units/`, `assets/buildings/`, `assets/cities/`, `assets/terrain/`,
  `assets/rivers/`, `assets/roads/`, `assets/enhancements/` -- the full
  sprite set

To add or replace music, drop files named `<race>_<situation>_<variant>.mp3`
into `assets/music/` -- race is one of `human`, `elf`, `dwarf`, `orc`,
`undead`, `halfellow`; situation is `default`, `combat`, or `victory`;
variant is `1`-`3` (you don't need all three -- the system picks
randomly among whichever exist, with no-repeat cycling). For spectator mode,
use `neutral_1.mp3` / `neutral_2.mp3` / `neutral_3.mp3` instead. A missing
file is logged to the console and skipped, never a crash.

## Known gaps

- **No naval combat.** Every race has a Galley (a transport, `isNaval` +
  `canCarryUnit`), so units can cross water, but there's no dedicated
  warship type and no naval-vs-naval combat system.
- **No Guardian/ruin-delving encounter.** Ruins feed the Human Wizard's
  "Dungeon Delve" channeling ability instead -- a resource ritual, not a
  fight-to-the-death encounter. `combat.js`'s `resolveToTheDeath` resolver
  exists but is only used internally, for AI win-probability estimation.
- **No governance path selection.** One tech sets
  `civ.governanceAvailable`, but nothing reads that flag yet -- no UI, no
  mechanical effect.
- **No tile-improvement mechanic.** The dedicated Worker unit was folded
  into Pioneer (which can build roads and found cities); worked-tile yield
  fills in automatically over time rather than through a player-directed
  improvement action.
- **Contested tiles produce zero yield**, except Undead's Barrow building,
  which grants a partial rate.
