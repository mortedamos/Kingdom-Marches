# Kingdom Marches -- Prototype

A working, playable prototype of the territory-control strategy game
designed across the `realms_of_influence_*.md` design docs. This is a
**real implementation of the core mechanics**, not a mockup -- world
generation, the influence/territory system, dice+HP combat, city
growth/founding, tech research, and a utility-scoring AI all actually run.

## Project structure

```
index.html              Entry point, loads everything in dependency order
css/style.css            All styling

js/data/                 PURE DATA -- no logic. Every race bonus, terrain
                         yield, unit stat, tech effect, and city name list
                         lives here, never hardcoded in engine files.
  races.js                Per-race stat modifiers, identity, mechanics flags
  race-names.js            18 curated city names per race + naming logic
  terrain.js                Terrain types, yields, movement costs, resources
  units.js                   Base unit stats (generic + race-unique)
  techs.js                     17-node tech tree subset (see below)
  buildings.js                   Building effects

js/engine/               GAME LOGIC -- reads data/, has no data of its own.
  worldgen.js              Elevation/climate noise, rivers, ruins, resources,
                           minimum-landmass-size enforcement
  influence.js              The core mechanic: per-tile influence accumulation,
                            2/3 ownership threshold, contested-tile decay
  cities.js                  Growth, yield, upkeep, founding restrictions, naming
  combat.js                   Dice (3d6) + HP combat resolution, counters, healing
  tech.js                      Research progress + effect application
  ai.js                          Utility-scoring AI: settle/build/explore/attack
  turns.js                        Turn loop orchestration, victory condition

js/audio/
  music.js                 Full music system per the spec: file-existence
                           scanning, graceful missing-file fallback, crossfade,
                           no-repeat variant cycling, situation priority
                           (combat > discovery > default), volume persistence.
                           NO REAL MP3 FILES ARE INCLUDED -- see "Adding your
                           own music" below.

js/ui/
  render.js                 Canvas map rendering (terrain, units, cities,
                            toggleable influence overlay)
  sidebar.js                  City/unit/civ info panels
  input.js                     Mouse interactions, city naming prompt

js/main.js                Bootstrap: setup screen, game creation, main loop.
                          Deliberately thin -- wires modules together,
                          contains minimal logic of its own.

assets/music/             Empty -- drop your own files here (see below).
```

## Adding your own music

Per the music addendum's spec, drop files named:

```
<race>_<situation>_<variant>.mp3
```

into `assets/music/`. Race is one of `human`, `elf`, `dwarf`, `orc`,
`undead`, `halfellow`. Situation is `default`, `combat`, or `discovery`.
Variant is `1`, `2`, or `3` (you don't need all 3 -- the system picks
randomly among whichever exist, with no-repeat cycling).

Example: `orc_combat_1.mp3`, `human_default_2.mp3`.

For all-AI spectator mode (no human-controlled race), drop
`neutral_1.mp3` / `neutral_2.mp3` / `neutral_3.mp3` instead.

**You don't need to add anything for the prototype to run.** Open the
browser console and you'll see every missing file logged clearly
(`[music] missing: orc_combat_1.mp3 - skipping`) with zero crashes --
that's the graceful-fallback behavior working as designed.

## What's fully implemented (real, tested mechanics)

- **World generation**: hand-rolled value-noise terrain (elevation +
  moisture + latitude-based temperature), all 9 terrain types, rivers as
  edge features with yield bonuses, Ancient Ruins (guaranteed per
  landmass, hidden until scouted), the resource layer, and **minimum
  landmass size enforcement** (verified via flood-fill testing).
- **The influence/territory system** -- the actual core mechanic of the
  whole design. Per-tile influence accumulation from city radius falloff
  + military unit presence, the 2/3 ownership threshold, and the
  contested-tile grace period before a tile reverts to neutral. Tested
  against synthetic scenarios confirming all three states (owned,
  contested, neutral) resolve correctly.
- **Dice + HP combat**: every unit has real HP (`2.2x` its attack stat,
  per the design doc's calibration), each combat round both sides roll
  their own 3d6, damage is randomized (`+-3d6%` of attack stat), ties
  deal mutual damage, the rock-paper-scissors counter triangle is fully
  wired in, city defense and Undead's ruin-defense bonus both work,
  healing (field rate, doubled in any city, **tripled** in a Halfellow's
  own city) all function as specified.
- **City founding & economy**: Settlers cost Toil to build + a population
  level from the source city on completion, the 3-tile-from-any-city
  spacing rule, water/Mountain/Ruin exclusions, city upkeep (Harvest cost
  scaling with population), intrinsic Toil/Lore generation from a city's
  own existence (separate from worked-tile yield).
- **All 6 races** (Goblin and Giant were cut during design, per the
  design docs) with their actual mechanical identities wired in: Human's
  trade-continues-during-war framing, Elf's forest-conditional
  combat/influence, Dwarf's hills bonus + Mountain-tunneling movement
  exception, Orc's attack bonus, Undead's no-upkeep/no-healing/Raise-Dead/
  ruin-defense, and Halfellow's boosted influence + city healing (the
  buffs added specifically to offset the wide-expansion structural
  advantage found during design).
- **AI**: real utility scoring across Settle, Build (buildings AND
  units -- a gap found and fixed during design), Research, Garrison,
  Attack, and a simplified Explore. Race weight tables and the
  Aggressiveness win-probability threshold are both wired in.
- **The music system's full mechanical spec** -- see above.
- **City naming**: 108 curated names (18 x 6 races), human-player prompt,
  AI auto-assignment with list-exhaustion cycling.

## What's simplified or stubbed for this prototype pass

Being direct about this rather than letting it surface as a surprise:

- **Tech tree: 17 of the full design's 35 nodes.** A representative
  slice -- the root, a meaningful spread across all four categories and
  several depths, the governance unlock -- not every node. See `techs.js`'s
  header comment for the exact list and rationale.
- **No naval units/combat.** The design docs have a full naval addendum
  (Transport, Warship, boarding mechanic); none of it is implemented
  here. Coast tiles are claimable territory (as designed) but there's no
  way to physically cross open ocean yet.
- **No Guardian/ruin-delving encounter resolution.** Ruins exist on the
  map and are hidden until scouted, but the actual "delve a ruin" player
  action and its Guardian-fight-to-the-death resolution aren't wired into
  the AI or input layer yet -- the combat engine *could* run that
  resolution (`resolveToTheDeath` exists for exactly this), it's just not
  triggered by anything yet.
- **No governance path selection UI.** `bound_lore`'s effect unlocks
  `civ.governanceAvailable`, but there's no UI for actually picking
  Steadfast Rule / Open Markets / War Council, and no mechanical effect
  from any of the three paths is implemented yet.
- **Worker/tile-improvement AI is a no-op.** Workers can be built (the
  unit exists) but nothing tells them what to do -- flagged explicitly in
  `ai.js`'s `maybeMoveUnits`.
- **Contested tiles produce zero yield**, not the design doc's -50%/-25%
  partial yield (Undead's Barrow-adjusted rate included) -- a
  simplification flagged inline in `cities.js`.
- **No pathfinding** -- units move in a naive straight line toward their
  target each turn (`moveUnitToward` in `ai.js`) and simply stop if the
  very next tile in that direction is impassable, rather than routing
  around obstacles. This is good enough for open terrain but can leave a
  unit "stuck" against an irregular coastline or mountain range it could
  have walked around. Found and fixed the worst case of this (Coast tiles
  were accidentally walkable, causing Settlers to wander onto water and
  get permanently stuck -- see "Bugs found" below) but the underlying
  no-pathfinding limitation remains.
- **Combat in the live game resolves one round per turn** (a unit attacks
  once when you click it onto an enemy), not the full `resolveToTheDeath`
  multi-round-in-one-go used internally for Guardian fights and AI win-
  probability estimation. This matches the design doc's intent (either
  side can disengage between turns) but means a human player needs to
  re-initiate an attack each turn to keep fighting the same target.
- **AI win-probability estimation is sampling-based** (~20-30 simulated
  playouts), not the exact Markov-chain computation the AI behavior doc
  describes as the "proper" approach once implemented for real. Good
  enough for a prototype; flagged as a known approximation.
- **Difficulty setting: now wired through for combat decisions** (fixed
  during this pass -- `main.js` was reading the setup screen's dropdown
  into a local variable and never actually passing it anywhere). It now
  flows into `applyDifficultyNoise` for Attack/Raid scoring, which is
  where the design doc's difficulty model (decision-quality noise, not
  yield handicaps) actually applies. **Not yet applied to Settle
  decisions** -- `maybeFoundCity` receives the `difficulty` parameter but
  doesn't use it, since settling noise wasn't part of the original
  difficulty design (only combat decision-quality was specified).
- **Spectator mode's full map reveal: verified working, not just
  implemented.** Traced the actual data flow (`main.js` sets
  `humanCivId = null` for spectator mode → `viewState.humanCivId` receives
  it → `render.js`'s visibility check falls back to `fullVisibilitySet(map)`)
  to confirm this rather than just assuming it from having written the
  code -- it's correct.

## Bugs found and fixed during this build (worth knowing about)

Building the real engine surfaced several issues the design docs'
abstract balance simulations never caught, since those simulations used
simplified constants that never exercised these specific interactions:

1. **Civ elimination bug (serious):** the elimination check originally
   read "no cities AND all units are civilian" -- which matches *every
   civ's normal starting state* (a lone Settler, zero cities, before
   it's had a chance to found anything). This silently eliminated every
   civ after turn 1, before any game could ever progress. Fixed to only
   eliminate when a civ has *zero cities and zero units of any kind*.
2. **Coast tiles were walkable by land units** (`moveCostLand: 1` instead
   of impassable) despite being marked as water -- this let Settlers
   wander onto coastal water and get permanently stuck, unable to found a
   city there and with no pathfinding to route back. Fixed to match
   Ocean's impassability.
3. **Worldgen noise produced ~85-95% land with one giant landmass**
   instead of the designed multi-continent world, because the noise
   gradients were sampled from `[0,1)` instead of a centered `[-1,1]`
   range -- multi-octave averaging on an uncentered distribution regresses
   toward the mean and collapses variance. Fixed by centering the
   gradients and re-deriving sensible elevation thresholds from the
   actual (now-correct) output distribution.
4. **City growth ran away unboundedly** (population 101, radius 35, after
   just 100 turns on a test map) once tile-yield was actually computed
   from real owned tiles rather than the design docs' abstract flat-
   constant-Harvest simplification -- bigger radius meant quadratically
   more worked tiles, which fed growth faster, which grew radius further,
   with no equilibrium. Fixed by separating a capped, fixed "working
   radius" (yield generation) from the "influence radius" (territory
   claiming, which can still grow with population) -- the classic
   Civ-likes "fat cross" pattern, applied here for the same reason it's
   always needed.
5. **The combat counter bonus, run through the full dice+HP engine,
   produced a 100% deterministic outcome** for the cavalry-vs-archer
   matchup -- the original 1.5x counter multiplier, once it stacked with
   that pairing's own attack/defense gap and compounded across multiple
   rounds, removed all tactical uncertainty. Reduced to 1.3x, which keeps
   even a clean counter matchup genuinely contestable rather than
   guaranteed.

None of these were caught by the extensive design-phase balance
simulations, because those simulations tested formulas in isolation with
simplified inputs -- they never ran the actual interacting systems
together. This is exactly the kind of thing a real implementation surfaces
that a spreadsheet-style simulation can't.

## Numeric constants that are still placeholders

Every numeric constant introduced fresh while building the engine (city
upkeep rate, intrinsic Toil/Lore rates, AI search radii, garrison-
sufficiency curve, exploration decay) is a reasonable-but-untested
starting point, consistent with how every number in the design docs was
always treated. Look for inline comments marking these in `cities.js` and
`ai.js` if you want to retune them.
