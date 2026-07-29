# Tech Tree Design — Review Document

Status: **draft for review**. Human is fully modeled; the other five races
follow the identical shape with their own content. Costs shown are proposed
splits across Lore/Coin/Harvest — the research engine currently only spends
Lore (see "Open questions" at the end).

> **Design-doc only.** Nothing in this document is implemented in code yet.
> Related non-tree rule changes (city spacing, combat resolution, unit
> properties, unit-panel UI) live in `game_rules_adjustments.md`.

## Shared shape

Every race's tree is **5 layers** across **3 columns** (the former *Mechanics*
column has been merged into **Civics**):

| Column | What it holds |
|---|---|
| **Civics** | Influence-boosting techs (flat %, radius) **and** race-flavored ability/mechanic nodes, **and** the folded-in favored-terrain/feature yield bonuses (the old `tileBonuses`/`featureBonuses`). This column carries a race's whole non-military identity. |
| **Building** | Unlocks one of the race's 4 structures. Each building sits on its own layer — no two buildings ever share a layer. (Human's prototype places its 4 buildings at L1–L4; there's no mandatory L5 "wonder" — that was an earlier assumption, now dropped. A race's building layers are that race's design choice as long as they don't collide.) |
| **Military** | L1 is always the race's basic melee unit. Beyond L1, this column is a genuine branching tree, not a simple fork — see Human's prototype below. A tech can: unlock a **brand-new unit** (Cavalry, Archery, Wizardry), **replace** an existing unit with a stronger version (Knighthood replaces Cavalry with Knight; this resolves the earlier "upgrade fork" open question), or **upgrade a unit in place** without replacing it (Battle Mage buffs the Wizard's stats/properties, still called "Wizard"). |

### Layout rules

1. **Layers scale in power and cost** (~1.4× per layer).
2. **Multiple options per layer are allowed, in every column.** A column can
   offer several parallel techs at the same layer — not just Civics. Human's
   Military L2, for instance, has four independent options (Defense of the
   Kingdom, Longspear, Cavalry, Archery). These aren't a forced sequence; the
   player/AI researches them in any order, subject to prereqs and the city
   gate. Some form branches (Archery → Longbow *or* Catapult, both valid),
   others reconverge (Battle Mage requires the Mage College building AND
   feeds three different L5 Wizard techs). The tree diagram needs to show
   this as a real graph, not strict per-layer columns.
3. **City gate.** To purchase a tech at layer L, the civ must have **at least
   L cities**. Prereqs still apply on top of the gate.
4. **Building-per-layer rule** applies only within the Building column.
5. **Cross-column prereqs are allowed and expected.** A Civic tech can require
   a Military tech (Dungeon Delve requires Wizardry) and a Building can
   require a Civic tech (Palace requires Sovereign Power) or a Military tech
   (Mage College requires Wizardry). Prereqs are graph edges, not
   column-local.

## Effect types

Implemented in engine already: `civic_influence_bonus`, `radius_bonus`,
`unlock_unit`, `unlock_building`, `harvest_pct_bonus`, `coin_from_harvest_pct`,
`siege_attack_bonus`, `raid_kill_bonus`, `ignore_terrain_penalty`,
`terrain_movement_bonus`, `unlock_mountain_tunneling`, `unlock_mechanic`.

Proposed / not yet in code: `unlock_tile_bonus` `{terrain,bonus}`,
`unlock_feature_bonus` `{feature,bonus}`, `unlock_forest_affinity` (Elf combat +
influence bundle). These carry the favored-terrain bonuses that used to be free
defaults in `races.js`.

> Category note: the former `category: "mechanics"` nodes are now
> `category: "civic"`. No effect *type* changed — only the column they sit in.

**New effect types introduced by Human's prototype tree** (none implemented yet):

| Effect | Does |
|---|---|
| `lore_per_city` `{value}` | +Lore/turn per city the civ owns (Common Tongue) — scales automatically with expansion |
| `building_yield_pct` `{harvest\|coin\|lore: pct}` | **Building-level** field (not a tech effect) — a structure that adds a % bonus to its city's yield instead of a flat amount. Bazaar/Guild Hall/Mage College all use this; `buildings.js`'s `yield` field is currently flat-only, needs this alongside it. |
| `garrison_defense_bonus` `{value}` | +defense for a specific unit type while garrisoned in a city or on a building tile. Directly implements the new "cities/structures don't counterattack — garrison instead" rule (Defense of the Kingdom). |
| `ranged_negation_reduction` `{value}` | Anti-ranged: when THIS unit is the counterattacker, it reduces the attacking Ranged unit's negation chance by this amount (Longspear: -20%). |
| `replace_unit` `{from, to}` | This civ's `unlockedUnits` swaps `from` for `to` — existing/future production of `from` becomes `to`. (Knighthood: Cavalry→Knight; Longbow: Archer→Longbowman; Trebuchet: Catapult→Trebuchet.) |
| `unit_stat_upgrade` `{unit, changes}` | Buffs an existing unit type **in place** (same name, no replacement) — `changes` can touch stats (`attack`, `defense`) or properties (`rangedPct`, `siegePct`). (Battle Mage buffs Wizard's ranged/attack/defense.) |
| `unlock_mechanic` *(reused)* | Bespoke, code-implemented one-offs too specific for a generic type: `fireball_splash` (AoE damage to adjacent enemies/structures), `teleportation` (instant move + post-teleport exhaustion until 100% HP), `invulnerability` (immune to all counterattack damage), `dungeon_delve` (Wizard-on-Ruin influence projection + lore, same pattern as Undead's Dark Ritual). |

---

## HUMAN (model tree — v2, user prototype)

This supersedes the earlier Human model entirely. Costs show only resource
*types* as given; the specific numbers below are **proposed**, following the
established ~1.4×/layer cost curve — adjust freely.

**Worker and Scout are not part of this tree.** They're generic infrastructure
(like Pioneer/Galley), granted free at civ creation, same as every other race.
The old shared `toolcraft`/`beast_sense` nodes that used to unlock them are
excluded for Human specifically (`excludedRaces: ["human"]`) — those nodes
still exist for the five races whose trees haven't been redesigned yet.

### Civics

| Layer | Tech | Requires | Effect | Cost (proposed) |
|---|---|---|---|---|
| L1 | **Spirit of Exploration** | — | +2 movement starting on Plains, Rivers, or Coast | 14 Lore |
| L2 | **Homestead** | — | +1 harvest from Plains | 16 Lore, 8 Coin |
| L3 | **Trade Roads** | — | +1 coin per road tile within a city's radius | 40 Coin |
| L4 | **Common Tongue** | — | +1 lore/turn for each city owned (new `lore_per_city` effect) | 55 Lore |
| L4 | **Dungeon Delve** | Wizardry (Military L3) | A Wizard stationed 2+ turns on a Ruin projects influence in a 1-tile radius and yields **+5 lore, +3 coin per turn** (bumped up from the original +3 lore-only — see rationale below) — same pattern as Undead's Dark Ritual, Human's version | 40 Lore, 15 Coin |
| L5 | **Sovereign Power** | — | +1 influence radius in every city | 60 Lore, 25 Coin, 15 Harvest |

**Dungeon Delve payout — confirmed direction, proposed number.** You asked
whether the bonus should be higher and split across lore+coin given the real
cost (tying down an increasingly valuable Wizard, plus needing a reachable
Ruin at all). Proposal: **+5 lore, +3 coin/turn** (up from +3 lore-only) — the
combined value roughly matches what a small dedicated city would produce,
which feels proportionate to permanently parking your best unit. Adjust
further once the Wizard's full kit (Battle Mage/Fireball/Invulnerability) is
locked in, since a stronger Wizard raises the opportunity cost further.

### Building

Buildings shifted up one layer — **there is no L1 building anymore.**
Guild Charter's Trade Roads prereq is removed (no prereq now). This also
resolves the earlier layer/prereq mismatch: Mage College (now L4) and Palace
(now L5) both sit at or above the layer of their own prereqs.

| Layer | Tech | Requires | Effect | Cost (proposed) |
|---|---|---|---|---|
| L2 | **Marketcraft** | — | Unlocks Bazaar: +10% harvest/turn, **this city only** | 12 Coin, 8 Harvest |
| L3 | **Guild Charter** | — *(prereq removed)* | Unlocks Guild Hall: +10% coin/turn, **this city only** | 22 Lore, 13 Coin |
| L4 | **Mage College** | Wizardry (Military L3) | Unlocks Mage College: +10% lore/turn, **this city only** | 35 Lore, 15 Coin |
| L5 | **Palace** | Sovereign Power | Unlocks Palace: +1 influence radius to the city it's built next to (uses existing `radiusBonus` building field) | 25 Harvest, 20 Lore, 15 Coin |

**Per-city only, confirmed.** Each of these structure bonuses applies to the
one city that built it, not civ-wide — this is already how the structure
system works (each city has its own 4 cardinal slots, effects computed per
city in `computeStructureEffects`), so no engine change needed here, just
confirming the design intent matches the existing mechanic. A wide empire
still gets more *total* bonus (more cities × their own bonus), but it's
additive per-city rather than compounding across the whole civ — tones down
the runaway-snowball risk I'd flagged.

### Military

| Layer | Tech | Requires | Effect | Cost (proposed) |
|---|---|---|---|---|
| L1 | **Spears Raised** | — | Unlocks **Spearguard** — high defense, low attack, low movement | 14 Lore |
| L2 | **Defense of the Kingdom** | Spears Raised | Spearguard gets a defense bonus while garrisoned in a city or on a building tile — the concrete implementation of "cities/structures don't counterattack, garrison instead" (`garrison_defense_bonus`) | 22 Lore |
| L2 | **Longspear** | Spears Raised | Spearguard's counterattack vs. a Ranged attacker gets +20% to hit — reduces the attacker's Ranged-negation chance by 20% (`ranged_negation_reduction`) | 22 Lore |
| L2 | **Cavalry** | — | Unlocks **Cavalry** — relatively high movement | 16 Lore, 8 Harvest |
| L2 | **Archery** | — | Unlocks **Archer** — Ranged 35% | 16 Lore, 8 Coin |
| L3 | **Knighthood** | Cavalry | Unlocks **Knight**, *replaces Cavalry* — high movement and high attack (`replace_unit`) | 20 Harvest, 15 Lore, 10 Coin |
| L3 | **Longbow** | Archery | Unlocks **Longbowman**, *replaces Archer* — higher attack, Ranged 60% (`replace_unit`) | 28 Lore, 12 Coin |
| L3 | **Catapult** | Archery | Unlocks **Catapult** (new unit, doesn't replace Archer — these are two distinct unit identities, not exclusive alternatives: Archer/Longbowman is the anti-unit Ranged line, Catapult/Trebuchet is the anti-structure Siege line, and a player can have both) — low movement, Ranged 10%, Siege 100% | 28 Lore, 12 Coin |
| L3 | **Wizardry** | — | Unlocks **Wizard** — Ranged 15% | 32 Lore, 10 Coin |
| L4 | **Trebuchet** | Catapult | Unlocks **Trebuchet**, *replaces Catapult* — very low movement, Ranged 20%, Siege 200% (`replace_unit`) | 38 Lore, 17 Coin |
| L4 | **Battle Mage** | Mage College (Building L4) | Wizard *upgraded in place* (not replaced): Ranged → 30%, improved attack & defense (`unit_stat_upgrade`) | 40 Lore, 15 Coin |
| L5 | **Fireball!** | Battle Mage | Wizard gains Siege 50%, higher attack; damage also splashes to all enemy units/structures adjacent to the target (`unlock_mechanic: fireball_splash`) | 65 Lore, 30 Coin |
| L5 | **Teleportation** | Wizardry | Wizard may instantly move to any unoccupied *seen* tile — costs the entire turn (no move/attack after); the Wizard cannot act again until healed to 100% HP (`unlock_mechanic: teleportation`) | 60 Lore, 30 Coin |
| L5 | **Invulnerability** | Battle Mage | **25% chance to negate all damage** — both incoming attacks *and* counterattacks — not a flat immunity (`unlock_mechanic: invulnerability_chance`, value 0.25). Revised from the original "no counterattack damage, ever" — this version is a chance-based damage negation that applies more broadly (regular attacks too) but isn't guaranteed, so it doesn't fully eclipse the Ranged property's own counter-negation the way a flat immunity would have. | 60 Lore, 30 Coin |

**All three L5 Wizard techs are stackable, by design.** You've confirmed the
Wizard is meant to be Human's single big-investment payoff unit — Wizardry +
Mage College + Battle Mage + all three L5 finishers is the intended "maxed
Wizard," not something to be prevented via exclusivity. A fully-teched Wizard
ends up with: Ranged 30%, Siege 50% AoE splash, 25%-chance total damage
negation, and on-demand teleport (with the exhaustion downside). That's the
point — six techs and a building, all funneling into one unit, is the cost
of that payoff.

**Archer and Cavalry lines dead-ending at L3 is intentional** — confirmed.
Wizard (and the Siege line) are Human's deep, late-game specialties; Cavalry
and basic Archer are solid mid-tier options that don't need further scaling.

**Military branch map** (for the eventual tree-diagram layout):

```
Spears Raised (L1) ─┬─ Defense of the Kingdom (L2)
                     └─ Longspear (L2)

Cavalry (L2) ── Knighthood (L3, replaces)

Archery (L2) ─┬─ Longbow (L3, replaces)
              └─ Catapult (L3) ── Trebuchet (L4, replaces)

Wizardry (L3) ─┬─ [Mage College building, L4] ── Battle Mage (L4) ─┬─ Fireball! (L5)
               │                                                    └─ Invulnerability (L5, 25% negate-all chance)
               └─ Teleportation (L5)

Wizardry (L3) ──(civic-column cross-req)──> Dungeon Delve (Civics L4)
```

Note Wizard is the single richest line: one L3 unlock feeds a Building prereq
(Mage College), which feeds a Military upgrade (Battle Mage), which forks into
two L5 finishers, while Wizardry *itself* also directly gates a third L5 tech
(Teleportation) and a Civics L4 tech (Dungeon Delve) in parallel. This is the
clearest real example yet of the graph-not-grid shape rule 2/5 describe.

---

> ⚠ **The five tables below (Elf through Halfellow) are the OLD model** —
> written before Human's real prototype above. They still use the simple
> "one stub fork per layer" Military shape and the old mandatory-buildings-
> on-L2–L5 assumption, both superseded. Once Human's tree is locked in, these
> five need a full rewrite in the same per-column-table style with real
> branching (new units, replacements, in-place upgrades, cross-column
> prereqs) — not just a find-and-replace of names. Left as-is for now so
> nothing is lost, but treat every number/node below as provisional.

## ELF

| Layer | Civics | Building | Military |
|---|---|---|---|
| **L1** | *(shared trunk — see note)*<br>**Pathless Stride** — ignore Forest move penalty; +1 harvest, +1 lore from Forest · *18 Lore* | — | **Bladesong** — unlocks Bladesinger · *11 Lore, 4 Coin* |
| **L2** | | **Grovespeech** — unlocks Grove Shrine (+lore/adj. forest) · *22 Lore* | **Sentinel Watch** *(stub)* — fork: Sentinel (spear, forest stealth) or deepen Bladesinger · *18 Lore, 7 Coin* |
| **L3** | **Wildwood Bond** — ×1.5 atk/def in Forest (×0.9 outside); city influence +up to 25% scaling with surrounding forest density · *45 Lore* | **Moon Rite** — unlocks Moonwell (+2 lore) · *35 Lore* | — |
| **L4** | | **Heartwood Bond** — unlocks Heartwood (×1.15 influence) · *50 Lore* | **Marksmanship** *(stub)* — fork: Sylvan Archer or deepen prior · *40 Lore, 15 Coin* |
| **L5** | | **World-Song** *(wonder)* — unlocks World-Tree (+1 radius, ×1.15 influence) · *100 Lore* | **Shadow Ranger Rite** *(stub, ultimate)* — unlocks Shadow Ranger, a **flying** elite unit. Details TBD · *70 Lore, 25 Coin* |

---

## DWARF

| Layer | Civics | Building | Military |
|---|---|---|---|
| **L1** | *(shared trunk)*<br>**Stonecunning** — ignore Hills penalty + Mountain tunneling; +1 harvest & +1 coin from Hills, +1 coin from Mountains · *14 Lore, 6 Harvest* | — | **Axe-Oath** — unlocks Axeguard · *11 Lore, 4 Coin* |
| **L2** | | **Forgecraft** — unlocks Deep Forge (+3 coin, needs adj. Hills/Mtn) · *22 Lore* | **Hold Guard Oath** *(stub)* — fork: Hold Guard (spear) or deepen Axeguard · *18 Lore, 7 Coin* |
| **L3** | | **Hall-Moot** — unlocks Great Hall (+1 harvest, +1 lore) · *35 Lore* | — |
| **L4** | | **Runecraft** — unlocks Runewall (×1.15 influence) · *50 Lore* | **Thunder-Forge** *(stub)* — fork: Thunderer (archer) or deepen prior · *40 Lore, 15 Coin* |
| **L5** | | **Vault-Keeping** *(wonder)* — unlocks Vault of Ages (×1.20 influence, needs adj. Hills/Mtn) · *100 Lore* | **Siege-Oath** *(stub, ultimate)* — unlocks Dwarven Siege Engine (heavy siege; **no cavalry** for Dwarves) · *70 Lore, 25 Coin* |

---

## ORC

**Favored terrain: Swamp** (confirmed).

| Layer | Civics | Building | Military |
|---|---|---|---|
| **L1** | *(shared trunk)*<br>**Bog Runners** — +1 move starting on Swamp; +1 harvest from Swamp · *16 Lore* | — | **Warband** — unlocks Grunt · *11 Lore, 4 Coin* |
| **L2** | | **Warcraft** — unlocks War Camp (-25% unit coin cost) · *18 Lore, 4 Coin* | **Impaler Rite** *(stub)* — fork: Impaler (spear) or deepen Grunt · *18 Lore, 7 Coin* |
| **L3** | **Spoils of War** — +2 harvest/+2 coin/+2 lore added to every kill payout · *30 Lore, 8 Coin* | **Butchery Rites** — unlocks Butchery (+2 coin) · *32 Lore, 3 Coin* | — |
| **L4** | | **Totem Carving** — unlocks War Totem (×1.15 influence) · *50 Lore* | **Skull-Throwing** *(stub)* — fork: Skullthrower (archer) or deepen prior · *40 Lore, 15 Coin* |
| **L5** | **Siege Tactics** — +25% attack when razing enemy structures · *75 Lore, 15 Coin* | **Great Warcamp Rite** *(wonder)* — unlocks Great Warcamp (-40% unit cost, +1 radius) · *90 Lore, 10 Coin* | **Dragon-Bond** *(stub, ultimate)* — unlocks Dragon Riders, a **highly destructive flying unit**. Details TBD · *70 Lore, 25 Coin* |

---

## UNDEAD

**No terrain affinity.** Confirmed: Undead drop terrain affinity entirely
(Swamp belongs to Orc now). Their identity runs through the **Ruin** feature
instead (Dark Ritual, Reliquary, ruin yield bonus). Their L1 Civics slot is
open — the user may still work bonuses into this tree elsewhere; not filled
in until specified.

| Layer | Civics | Building | Military |
|---|---|---|---|
| **L1** | *(shared trunk)* | — | **Grave-Bound Rite** — unlocks Skeleton · *15 Lore* |
| **L2** | | **Barrow Rite** — unlocks Barrow (contested tiles yield 25%) · *22 Lore* | **Wight-Binding** *(stub)* — fork: Wight (spear) or deepen Skeleton · *25 Lore* |
| **L3** | **Dark Ritual** — a unit stationed 2+ turns on a Ruin projects influence in a 1-tile radius (vanishes if it moves off or dies); +1 lore, +1 harvest from Ruins · *45 Lore* | **Reliquary Rite** — unlocks Bone Reliquary (+2 lore) · *35 Lore* | — |
| **L4** | | **Obelisk Rite** — unlocks Cursed Obelisk (×1.20 influence) · *50 Lore* | **Bone Archery** *(stub)* — fork: Bone Archer (archer) or deepen prior · *55 Lore* |
| **L5** | | **Necropolis Rite** *(wonder)* — unlocks Necropolis (+1 radius, stronger Raise Dead) · *100 Lore* | **Grave Colossus Rite** *(stub, ultimate)* — unlocks Grave Colossus (heavy siege; **no cavalry** for Undead) · *95 Lore* |

---

## HALFELLOW

| Layer | Civics | Building | Military |
|---|---|---|---|
| **L1** | *(shared trunk)*<br>**Hillfolk** — ignore Hills move penalty; +1 harvest from Plains, Hills, and Rivers · *20 Lore* | — | **Muster** — unlocks Home Guard · *11 Lore, 4 Coin* |
| **L2** | **Farmer's Market** — coin yield this turn +5% of that turn's harvest yield · *18 Lore, 6 Harvest* | **Hearthcraft** — unlocks Hearth Hall (coin→lore) · *22 Lore* | **Pike Muster** *(stub)* — fork: Pike Militia (spear) or deepen Home Guard · *18 Lore, 7 Coin* |
| **L3** | | **Common Charter** — unlocks Common House (+2 harvest) · *30 Lore, 5 Harvest* | — |
| **L4** | | **Green Moot** — unlocks Village Green (×1.20 influence) · *50 Lore* | **Skirmish Training** *(stub)* — fork: Skirmish Archer or deepen prior · *40 Lore, 15 Coin* |
| **L5** | | **Mootcraft** *(wonder)* — unlocks Mootground (+1 radius, +1 harvest) · *100 Lore* | **Pony Riders** *(stub, ultimate)* — unlocks Pony Rider (cavalry) · *65 Lore, 25 Coin* |

---

## Cavalry / flying identity notes

- **Dwarf, Undead**: no cavalry tier — ultimate slot is heavy siege instead (fits "doesn't ride" identity).
- **Elf, Orc**: ultimate slot is a **flying** unit (Shadow Ranger, Dragon Riders). See `game_rules_adjustments.md` for the new Flying unit property these will use.
- **Human, Halfellow**: conventional cavalry ultimate (Knight, Pony Rider).

## What's *not* yet modeled

- **Elf/Dwarf/Orc/Undead/Halfellow trees are still the old, superseded shape**
  (see the ⚠ note above) — need a full rewrite matching Human's real
  branching structure once that's locked in.
- Those five still draw their base influence techs from the shared civic
  trunk (`spoken_memory → the_long_telling / wardstones → bound_lore`). Only
  Human has a bespoke Civics identity so far.
- Human's own new mechanics need engine design before they're buildable:
  **splash damage** (Fireball — combat.js has no AoE concept today),
  **unit exhaustion status** (Teleportation's "can't act until 100% HP" is a
  new unit state, separate from normal HP tracking), and **garrison detection**
  (Defense of the Kingdom needs the engine to know "is this unit sitting in a
  city or on a building tile" at combat-resolution time).

## Open questions

1. **Multi-resource research cost.** `costBreakdown` splits (Lore/Coin/Harvest)
   are proposed but not wired — the engine spends only Lore. Wire it?
2. ~~Military upgrade-fork mechanics~~ — **resolved** by Human's prototype:
   there are two real patterns, `replace_unit` (Knighthood swaps Cavalry for
   Knight) and `unit_stat_upgrade` (Battle Mage buffs Wizard without renaming
   it). Both need engine support; see Effect types above.
3. **Per-race Civics/Building/Military columns** for the five non-Human races —
   not designed to Human's new standard yet.
4. **Terrain/feature yield bonuses off `races.js` defaults** — folded into the
   Civics column above but still live as free defaults in code; wiring pending.
5. **Does every race need a Building L5 wonder?** Human's prototype has none
   (tops out at L4). Was the wonder concept race-specific flavor, or should
   it be dropped as a shared-shape requirement entirely?

### Resolved
- ~~Undead favored terrain~~ — **dropped entirely.** Undead run on Ruins, not
  a base terrain type. Bonuses may still be added elsewhere in their tree later.
- ~~City gate vs. wonders~~ — **intended as-is.** Slow-expansion races (Dwarf,
  Undead) are meant to feel the L5-needs-5-cities pinch; compensate via that
  race's own tech content rather than exempting wonders from the gate. See the
  new **AI research-planning** note below — the AI is expected to prioritize
  expansion when a desired tech is gated behind city count it doesn't have yet.

## AI research planning (new, not yet implemented)

Today's AI (`maybeChooseResearch`) picks the single best-scoring *available*
tech each time it's idle — it can't "want" something it doesn't qualify for
yet. With the city-gate rule, this needs to become goal-directed:

1. AI evaluates the **full tree** (not just currently-available nodes) and
   picks a target tech by value (civic bonus, unit, building, its city-gate
   layer).
2. It walks the target's `prereqs` chain backward to find what it can research
   *right now* toward that goal, and queues those first.
3. If the target is blocked by the **city gate** (not enough cities yet), that
   should feed back into `chooseStrategy`'s settle-vs-other-focus scoring —
   i.e., "I want an L4 tech and only have 2 cities" becomes a real pressure
   to expand, not just background expansionism-trait noise.

This is a `ai.js` behavior change (new tech-planning function + a link into
the existing settle-scoring), not a tech-tree data change — flagged here
since it's a direct consequence of the city-gate rule, to build once the tree
itself is locked.
