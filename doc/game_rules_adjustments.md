# Game Rule Adjustments — Review Document

Status: **draft for review, design-only.** None of this is implemented in code
yet. These are the non-tech-tree rule changes raised during tech-tree
prototyping. The tech tree itself lives in `tech_tree_design.md`.

---

## Cities

**City spacing: 5+ tiles.** Cities must be founded **at least 5 tiles apart**
from every other city (any owner).

- *Current code:* `MIN_CITY_SPACING = 3` (Chebyshev distance) in `cities.js`;
  an emergency-founding path relaxes this to 2.
- *Change:* base spacing → **5**. Open question: does the emergency-relax path
  survive (e.g. relax to 4), or is 5 a hard floor? Larger spacing plus the new
  tech city-gate (below) means expansion is slower and each city claims more
  exclusive ground — worth watching that small landmasses can still fit 3+
  cities for the L3 tech gate.

## Tech purchase gate (cross-reference)

A tech at layer **L** requires the civ to have **≥ L cities**. Full rule and
rationale in `tech_tree_design.md` → *Shared shape → Layout rules*. Noted here
because it couples directly to city spacing: wider spacing makes hitting the
city counts for deep tech harder.

---

## Combat

**Simultaneous resolution.** A single attack resolves both sides at once:

- **Attacker deals full damage.**
- **Defender deals half damage** as a counterattack (simultaneously — the
  counterattack lands even if the attack would reduce the defender to 0).
- **Buildings/structures never counterattack. Cities never counterattack either** —
  confirmed, same rule extends to cities. A city under attack with no
  garrisoned unit takes full damage and hits back for nothing. This is
  deliberate: it's the lever that makes garrisoning worthwhile (see below).

*Current code:* `combat.js` uses a per-round 3d6 contest — each side rolls,
higher total is the "round winner", winner deals full and loser deals half,
resolved over multiple rounds. **The new model replaces the round-winner
contest**: no roll decides who "wins" the exchange; the attacker always deals
full and the defender always counters for half.

**Confirmed:** keep the damage-roll spread for variance, and defense mitigates
incoming damage (attack vs. defense, not attack vs. attack) — this is the only
randomness left once the round-winner roll is removed. Formula still needs to
be worked out concretely (see below), but the shape is confirmed.

**Confirmed: defense values need an across-the-board reduction.** AI-vs-AI
combat has been observed stalling — neither side does enough damage to
overcome (defense mitigation + passive per-turn healing), so fights drag
without a winner. Two changes address this together:

1. **Rebalance pass on unit defense stats** (all units, not just Undead/Dwarf's
   naturally tanky lines) — numbers TBD once the new damage formula is drafted,
   but the direction is down, not up.
2. **Healing becomes an action, not a passive tick** (see below) — removes the
   "stalemate because both sides out-heal each other for free" failure mode
   directly, independent of the stat rebalance.

**Garrisoning (confirmed rationale).** Since neither cities nor structures
counterattack on their own, the intended design is that a city or building is
only as defensible as the units stationed on/in it. This is meant to actively
pull player and AI behavior toward garrisoning:
- A defended city/structure counterattacks *through* its garrison — the
  attacker faces the garrisoned unit's counter, not the city's.
- An undefended city/structure just absorbs damage — no counter at all,
  making raids into empty territory cheap and effective (rewards Orc-style
  play; punishes leaving cities empty).
- Human's prototype military tree (below) has a concrete implementation of
  this: **Defense of the Kingdom** grants the Spearguard a defense bonus
  specifically while garrisoned in a city or on a building tile — the first
  real "garrison bonus" tech. This is the pattern other races' trees should
  follow if they want a defensive specialist identity.
- Open question: does the AI's build/deploy logic need an explicit "garrison
  this city" priority now that empty cities are truly undefended? (Likely
  yes — flagged for the eventual AI pass alongside Rest.)

**Garrison targeting priority — confirmed.** When a unit attacks a city or
structure that has a garrisoned defender, **the garrisoned unit is attacked
first** (and counterattacks normally, per the rules above) — the city/
structure itself takes no damage while a defender is present to intercept.
A city/structure only takes direct damage when **unguarded**. This is what
makes the Siege property's structure-damage bonus meaningfully risky to use:
a Siege unit attacking a garrisoned city fights the garrison like any other
unit (no siege bonus applies, since it's not hitting the structure), and only
gets its bonus once the garrison is cleared or the target is already empty.

Open questions:
- **Concrete damage formula.** Need the actual attack-vs-defense math (e.g.
  `damage = attackerAtk × spread − defenderDef × mitigationRate`, or a
  percentage-reduction model like `damage = attackerAtk × spread × (1 −
  defenderDef / (defenderDef + K))`). Flagged for a follow-up pass once we're
  ready to pin down numbers.

## Resting (NEW — replaces passive per-turn healing)

**Rest is now an explicit action**, not something that happens automatically
to every unit that didn't act. A unit must choose to Rest on its turn (instead
of moving/attacking) to heal; healing no longer ticks for free on idle units.

- *Current code:* `turns.js` heals every unit that didn't act this turn
  (`if (unit.usedThisTurn) continue;` — i.e. healing is the *default* for
  anything idle). This is being replaced: healing only happens if the unit's
  action *this turn* was specifically "Rest."
- Field/city healing-rate multipliers, and the race-specific healing hooks
  (Halfellow's own-city/own-influence bonus, Undead's ruin-only healing and
  heal-on-kill) all still apply — they just gate on "did this unit Rest" or
  "did this unit kill something" instead of "did this unit do nothing."
- Open question: can a unit Rest and still count as garrisoning/holding a tile
  for influence purposes? (Should — Resting shouldn't cost territory.)
- Open question: AI behavior change needed — `ai.js` currently never chooses
  a deliberate "do nothing" action; it needs a real Rest decision (e.g. damaged
  unit with nothing better to do rests instead of wandering/exploring).

---

## Unit Properties

**Properties replace the old role/counter-triangle system entirely —
confirmed.** The earlier design (spear counters cavalry, cavalry counters
archer, archer counters spear, via `unit.role` + a `counters` list in
`combat.js`) is dropped. Tactical identity now comes from **properties**
(Ranged / Siege / Flying, below) instead of a rock-paper-scissors role match.
When this is implemented, `combat.js`'s `counterModifier`/`COUNTER_BONUS`
role-counter logic gets removed, not just supplemented. A unit can have more
than one property (e.g. a unit could conceivably be both Ranged and Siege —
Catapult/Trebuchet already are).

**Damage-negation family, for context.** Ranged's counter-negation and
Human's Invulnerability (25% chance to negate *all* damage, not just
counters — see `tech_tree_design.md`) are two instances of the same broader
pattern: a % chance to fully negate incoming damage. They stack independently
rather than overriding each other, since Invulnerability's trigger condition
(any damage) is broader than Ranged's (counters only).

### Ranged
- On being counterattacked, a Ranged unit **negates the counterattack X% of the
  time** (takes no counter damage); otherwise it takes the normal half-damage
  counter.
- **Exception:** if the counterattacking unit is *also* Ranged, the negation
  does not apply — that counterattack follows normal rules.
- The negation chance **X% can be modified by abilities/techs.** **Confirmed:**
  this is anti-ranged tech — some units/abilities lower an enemy Ranged unit's
  negation chance against them (not a Ranged unit boosting its own negation).

### Siege
- Deals **+X% damage to buildings and cities.**
- *Current code:* an analogous `bonusVsCity` multiplier already exists on some
  unit data and a `siege_attack_bonus` tech effect (from the tech pass) applies
  when attacking structures. Siege-as-a-property would generalize/replace those.

### Flying
- Can **only be attacked by other Flying units or Ranged units.**
- Takes **no counterattack damage** except when the counterattacker is Flying or
  Ranged.
- **Moves over all terrain types** (ignores all land movement costs and
  impassability — including Mountains and, presumably, water; confirm water).

Interaction notes to resolve:
- Flying + Ranged on the same unit (both Elf Shadow Ranger and Orc Dragon Riders
  are "flying"; are they also Ranged?). Define the stack.
- Naval units (Galley) vs. Flying — any special case?

## Influence holding — confirmed rule

**No unit holds a tile for influence, full stop — not even by standing on it.**
Influence is projected only by:
1. **Cities** (the existing city-radius-falloff projection), and
2. **Specific tech-unlocked unit abilities** that explicitly say they project
   influence — currently Undead's **Dark Ritual** (unit on a Ruin 2+ turns) and
   Human's new **Dungeon Delve** (a Wizard on a Ruin 2+ turns, see Human tree
   below). These are narrow, named exceptions, not a general "units project
   influence" rule.

This resolves the earlier open question about Flying units holding tiles —
moot now, since *no* unit type holds tiles regardless of Flying/land/naval.
`pushTowardInfluenceFrontier`-style AI logic (moving units toward contested
tiles to "help hold" them) needs to be understood as pressuring the *city*
projection in that area (or garrisoning to defend the city that projects
there) — not the unit itself contributing influence, except via the two named
abilities above.

---

## UI

**Unit panel — list properties.** When a unit is selected on the map, the
sidebar/toolbar unit panel should list its **properties** (Ranged / Siege /
Flying / role) alongside the stats it already shows (HP, attack, defense,
movement, upkeep). Presentation TBD (tag chips vs. a "Properties" stat row).

---

## Summary of engine areas each change will touch (for the eventual build)

| Change | Primary files (when implemented) |
|---|---|
| City spacing → 5 | `cities.js` (`MIN_CITY_SPACING`, emergency path) |
| Tech city-gate | `tech.js` (availableTechs/chooseResearch), `ai.js` research pick |
| AI research planning | `ai.js` (new goal-directed tech planner, feeds `chooseStrategy` settle-scoring) — see `tech_tree_design.md` |
| Simultaneous combat + defense rebalance | `combat.js` (`resolveRound`/`resolveToTheDeath`), `races.js`/`units.js` defense values, callers in `ai.js` |
| Rest-as-action | `turns.js` (remove passive heal-on-idle), `ai.js` (new Rest decision), `units.js`/UI (a Rest action for the human player) |
| Ranged / Siege / Flying | `units.js` (property tags), `combat.js`, movement in `ai.js` (`getMoveCost`, `canReachByLand`), attack targeting in `ai.js` |
| Unit-panel properties | `sidebar.js` (`renderUnitPanel`) |

*(Listed for planning only — not to be built until the design is locked.)*
