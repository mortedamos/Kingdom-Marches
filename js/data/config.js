/**
 * GAME CONFIGURATION
 * ==================
 * The game's balance dials, in one place.
 *
 * Every value here is a knob a designer would plausibly want to turn to
 * change how the game FEELS -- how fast territory spreads, what an army
 * costs to keep in the field, how long research takes, how quickly cities
 * grow. Change a number here and the engine picks it up; there is no second
 * copy of any of these anywhere else.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY *NOT* HERE
 * ---------------------------------------------------------------------------
 * Per-race AI tactical heuristics -- search radii, party sizes, "how injured
 * before a Troubadour comes running", ambush staging thresholds, and the
 * hundred or so similar constants in js/engine/ai.js. Those are not balance
 * dials; each one only makes sense next to the behavior it drives, and
 * hoisting them here would turn one readable behavior into two files to
 * cross-reference. They stay where they are, named and commented in place.
 *
 * Also not here: per-unit stats (js/data/units.js), per-tech costs and
 * effects (js/data/techs.js), per-race traits (js/data/races.js), per-terrain
 * yields (js/data/terrain.js), per-building effects (js/data/buildings.js).
 * Those are the game's CONTENT, not its tuning; they belong in their own
 * data files where they can be read as tables.
 *
 * ---------------------------------------------------------------------------
 * LOAD ORDER
 * ---------------------------------------------------------------------------
 * This file must load before every other script (see index.html). Nothing
 * here depends on anything else.
 *
 * ---------------------------------------------------------------------------
 * CHANGING VALUES
 * ---------------------------------------------------------------------------
 * Most of these interact. Prior tuning passes on this project found that
 * changing one in isolation tends to move the win-condition mix in ways that
 * aren't obvious from the number alone (e.g. raising influence fill rate made
 * territorial victory win 20/20 games and elimination 0/20). Re-validate with
 * a headless batch (window.__sim in js/main.js) after touching anything in
 * the INFLUENCE, CITY, or UNIT ECONOMY sections.
 */

window.GameConfig = {

  // =========================================================================
  // BUILD STAMP  (js/main.js's renderBuildStamp)
  // =========================================================================
  // "Which copy of the game am I looking at" -- shown under the Start Game
  // button on the launch screen.
  //
  // Not a balance dial, unlike everything below it, but it lives here for the
  // same reason they do: one place to change, and this file is already the
  // first script loaded (see LOAD ORDER above), so the launch screen can read
  // it synchronously with no ordering question.
  //
  // Hand-maintained on purpose -- avoids depending on the network, the repo
  // being public, or an API rate limit; a value typed here always renders,
  // offline included.
  //
  // BUMP THESE WHEN YOU SHIP. Nothing enforces it -- a stale stamp is a wrong
  // stamp, and the only cost of forgetting is being told the wrong thing.
  build: {
    /** Local date this build was cut, YYYY-MM-DD. */
    date: "2026-08-26",
    /** Local time this build was cut, 24-hour HH:MM. */
    time: "10:53",
    /** Monotonic build counter -- increment it, don't recompute it. */
    number: 174,
  },

  // =========================================================================
  // PACING  (js/engine/ai.js, js/engine/tech.js)
  // How many turns a unit, building, or tech takes to complete -- table-
  // driven (2026-08-21), replacing the old continuous cost/rate formula.
  // =========================================================================
  pacing: {
    /** Which of the 5 named Game Speed levels (Slowest/Slow/Normal/Fast/
     *  Fastest, indices 0-4) is active right now -- the live index INTO
     *  researchTurnsByLayer/buildTurnsByLayer below. 2 (Normal) by default;
     *  mutated by main.js's applyGameSpeed at Start Game (and on save/
     *  multiplayer load) from whichever percent the launch-screen slider
     *  maps to. Read live (not snapshotted) by tech.js's researchTurns and
     *  ai.js's unitBuildTurns/buildingBuildTurns, so a mid-session speed
     *  change (not currently exposed in the UI, but nothing stops a future
     *  one) would take effect immediately -- unlike the OLD pacing.slowness
     *  this replaces, which ai.js's unitBuildTurns/buildingBuildTurns used
     *  to snapshot into a module-level const at page-load time, silently
     *  making the Game Speed slider never actually affect unit/building
     *  build turns at all (only research, which read it live). Fixed as a
     *  side effect of this rewrite. */
    speedLevelIndex: 2,

    /** The industriousness value researchTurnsByLayer/buildTurnsByLayer
     *  below are CALIBRATED against -- matches the `?? 0.5` fallback used
     *  everywhere a race's industriousness is read, so an unspecified race
     *  reproduces the table exactly. A race's actual industriousness (and,
     *  for units, militarism -- see ai.js's raceUnitBuildRate) still scales
     *  turns up/down from there: turns = round(tableValue *
     *  (baselineIndustriousness / actualRate) ^
     *  industriousnessDampExponent), preserving the same "higher
     *  industriousness -> fewer turns" relationship the old cost/rate
     *  formula had, just anchored to the table instead of a continuous
     *  formula. */
    baselineIndustriousness: 0.5,

    /** Dampens how much industriousness (and, for units, militarism) can
     *  swing build/research turns away from the table's baseline (2026-08-21,
     *  user-directed -- an UNDAMPENED ratio spans ~0.56x (Dwarf, 0.9) to
     *  ~2.5x (Undead, 0.2), a ~4.5x gap between the fastest and slowest
     *  race for the identical item). Applied as an EXPONENT on the ratio
     *  (baselineIndustriousness / actualRate) ^ this, not a flat multiplier
     *  or a clamp -- compresses the whole curve smoothly at both ends while
     *  preserving direction and relative ordering (still-faster stays
     *  faster). 1.0 is the old, undampened behavior; 0.0 would make
     *  industriousness/militarism irrelevant to pacing entirely. At 0.4:
     *  Dwarf ~0.75x, Human ~0.87x, Orc ~1.28x, Undead ~1.44x -- a mild nudge
     *  rather than a defining trait. */
    industriousnessDampExponent: 0.4,

    /** Tech Research Time (turns), by tech layer (0-5) and speed level
     *  (Slowest/Slow/Normal/Fast/Fastest, indices 0-4) -- user-authored
     *  spreadsheet (2026-08-21), ~1.5x turns per speed step AND per layer
     *  step (both axes share the identical underlying geometric sequence:
     *  round(2 * 1.5^n) for n = layer - speedIndex + 3 -- verified against
     *  every one of the sheet's 25 given cells with zero mismatches). Layer
     *  0's row wasn't given in the source sheet; derived by extending that
     *  exact same sequence one step further (n=-4 -> round(2/1.5)=1 at
     *  Fastest), not guessed independently -- flag to the user if wrong. */
    researchTurnsByLayer: [
      [8, 5, 3, 2, 1],    // Layer 0 (derived, see comment above)
      [12, 8, 5, 3, 2],   // Layer 1
      [18, 12, 8, 5, 3],  // Layer 2
      [27, 18, 12, 8, 5], // Layer 3
      [41, 27, 18, 12, 8],// Layer 4
      [62, 41, 27, 18, 12], // Layer 5
    ],

    /** Unit + Structure Build Time (turns), by BUILD layer and speed level,
     *  same shape as researchTurnsByLayer above -- user-authored spreadsheet
     *  (2026-08-21), given complete for all 6 layers (no derived rows).
     *  "Build layer" is NOT a separate concept from the tech tree: a unit's
     *  layer is window.GameData.unitTechLayer(unitId) (the layer of the
     *  tech that first unlocks it), a building's is
     *  window.GameData.buildingTechLayer(buildingId) -- see ai.js's
     *  unitBuildTurns/buildingBuildTurns. ~1.25x per step, noisier than
     *  research's clean 1.5x (small integers round-trip less exactly), with
     *  a floor of 2 turns visible at the low end (Layer 0/Fastest and
     *  Layer 1/Fastest both clamp to 2 rather than continuing down to 1). */
    buildTurnsByLayer: [
      [5, 4, 3, 2, 2],   // Layer 0 (Bridge, Wall, Pioneer, ...)
      [6, 5, 4, 3, 2],   // Layer 1 (Ranger, Spearguard, ...)
      [8, 6, 5, 4, 3],   // Layer 2 (Wizard, ...)
      [10, 8, 6, 5, 4],  // Layer 3 (Bombard, ...)
      [13, 10, 8, 6, 5], // Layer 4 (Awakened Oak, ...)
      [16, 13, 10, 8, 6],// Layer 5 (Dragon, Runeforged Titan, ...)
    ],
  },

  // =========================================================================
  // AI AGGRESSION  (js/engine/ai.js)
  // Universal launch option, Single Player and Spectator alike (2026-08-21,
  // user-directed): how readily a kingdom commits its EXISTING military to
  // fights. Deliberately narrow in scope -- see levels' own doc comment for
  // the reasoning.
  // =========================================================================
  aiAggression: {
    /** Which of `levels` below (Low/Normal/High, indices 0-2) is active
     *  right now. 1 (Normal) by default, matching the launch-screen
     *  slider's own default. Mutated by main.js's applyAiAggression at
     *  Start Game (and on save/multiplayer load) -- applies to every AI
     *  civ, in both Single Player and Spectator mode. Read live (not
     *  snapshotted) by ai.js's racialWeights/minAcceptableWinProbability. */
    levelIndex: 1,

    /** combatWeightMult scales FOUR things, all decision-time multipliers on
     *  top of a civ's own race traits, never anything settle/build/research
     *  reads directly: racialWeights' attack/raid outputs,
     *  minAcceptableWinProbability's threshold (via winProbFloorShift
     *  below), AND -- added 2026-08-21 after headless testing (see below)
     *  showed the first two barely moved whole-game combat stats even
     *  pushed well past High -- the offense-lean of militaryPostureFor and
     *  explorePostureFor's militaryNeed term. Those last two turned out to
     *  be the REAL bottleneck: a unit can only accept a fight it's already
     *  in range of, and militaryPostureFor/explorePostureFor are what
     *  decide whether an idle unit goes LOOKING for one (huntEnemyInfra-
     *  structure) or defaults to reinforcing/exploring instead, upstream of
     *  ever reaching the attack-scoring code the first two touch. Explicitly
     *  NOT touched, still: settle/build/research/garrison weights,
     *  rollsForSettleNeed's drag term, and computeMilitaryCap (2026-08-21,
     *  user-directed: "I dont want a kingdom to avoid building tech or
     *  cities... an [aggressive] kingdom [shouldn't] get stuck with basic,
     *  weak units") -- a bigger standing army also means more upkeep
     *  competing with the SAME stockpile that funds research/building, so
     *  this only makes a civ commit the forces it already has, and seek out
     *  more fights with them, more readily -- never trades its economy for
     *  its army.
     *
     *  winProbFloorShift subtracts straight off minAcceptableWinProbability
     *  (today: 0.9 - aggressiveness*0.4, i.e. a passive race holds out for
     *  ~90% win odds) -- clamped in ai.js so it can never drop below a
     *  reckless floor.
     *
     *  Low (index 0) = 1.0x / +0, reproducing the CURRENT game exactly --
     *  today's AI is the "Low" baseline (2026-08-21, user-directed).
     *  Normal/High's values below were re-validated via an 8-seed/4-race
     *  headless batch (window.__sim) after the posture-function wiring
     *  above was added -- see project memory for the actual before/after
     *  numbers. Re-run that batch before changing these further; watch
     *  army size, tech-layer progress, and win-condition mix same as any
     *  other pacing change (see this file's own top-of-file CHANGING
     *  VALUES note). */
    levels: [
      { label: "Low", combatWeightMult: 1.0, winProbFloorShift: 0 },
      { label: "Normal", combatWeightMult: 1.35, winProbFloorShift: 0.10 },
      { label: "High", combatWeightMult: 1.7, winProbFloorShift: 0.20 },
    ],
  },

  // =========================================================================
  // INFLUENCE & TERRITORY  (js/engine/influence.js)
  // How fast borders spread, and what it takes to actually own ground.
  // =========================================================================
  influence: {
    /** Share of a tile's total influence one civ needs to OWN it outright.
     *  Below this the tile is Contested and pays reduced yield. Raising this
     *  makes borders harder to hold and pushes games toward stalemate lines;
     *  lowering it makes territory flip quickly and favors territorial
     *  victory over conquest. */
    ownershipThreshold: 2 / 3,

    /** Consecutive turns a tile can sit contested (or with no influence on it
     *  at all) before it reverts to neutral. A grace period, so a single turn
     *  of an enemy army walking past doesn't cost you the tile. */
    contestedGraceTurns: 3,

    /** How much an ocean, coast, or tundra tile counts for in the victory
     *  tally, relative to ordinary land.
     *
     *  2026-08-25: now 1.0 -- every owned tile counts the same. This used to
     *  be 0.25, which existed to stop a water-heavy map inflating the
     *  denominator of the old percentage-based victory condition. With
     *  victory now an absolute tile count (see victory.tileTarget) there IS
     *  no denominator, so the weighting's original purpose is gone. Keeping
     *  it would only have meant a coastal tile counted as a quarter of a
     *  step toward the target, which is hard to read on a progress
     *  indicator and made naval expansion quietly worthless.
     *
     *  Known consequence, accepted deliberately: influence spreads with no
     *  terrain restriction, so ocean IS claimable -- counting it fully is a
     *  real buff to coastal and island play, not a neutral cleanup. */
    lowValueTerrainWeight: 1.0,

    /** City influence falloff steepness. Influence is full strength at
     *  distance 0-1 and interpolates down to (1 - this) at the radius edge --
     *  0.85 puts the edge at ~15% strength. Higher = sharper borders. */
    cityFalloffDecay: 0.85,
  },

  // =========================================================================
  // CITIES  (js/engine/cities.js)
  // Growth pace, yields, and how quickly a city's radius fills in.
  // =========================================================================
  city: {
    /** ADMINISTRATIVE UPKEEP (2026-08-25): each city past the first keeps
     *  (1 - index * adminUpkeepPerCity) of its own yield, floored by
     *  adminUpkeepMax. City 1 keeps 100%, city 2 keeps 92%, city 3 84%, and
     *  so on down to the 45% floor at city 8+.
     *
     *  This is the economy's only recurring, scaling sink. Everything else a
     *  civ can buy is finite (the whole tech tree costs ~1,500; four
     *  buildings per city ~650) or hard-capped (unit upkeep, bounded by an
     *  18-27 unit army cap), while income compounds past 1,100/turn -- so
     *  kingdoms banked 65-86 turns of unspendable income. It is also the
     *  brake that keeps the retapered settle drive (ai.js) from making
     *  expansion free: a wide empire still out-earns a tall one, just
     *  sub-linearly, so "how many cities can I actually run" becomes a real
     *  decision and the "consolidate" doctrine goal gains a purpose.
     *
     *  Deliberately a yield share rather than a flat per-city bill: a flat
     *  cost would fall hardest on small/new cities and effectively ban
     *  frontier settling, which is the opposite of the intent. */
    adminUpkeepPerCity: 0.08,
    adminUpkeepMax: 0.55,

    /** Harvest needed for the next pop level is
     *  population^growthThresholdExponent * growthThresholdPerPop.
     *
     *  The exponent used to be a hardcoded 2.0 (pure quadratic), on the
     *  reasoning that it "mirrors the worked-tile AREA also growing
     *  quadratically with radius, which is what stops growth from
     *  accelerating away late-game." That reasoning treats growth as the
     *  only brake on the area feedback loop -- but the FILL-IN system below
     *  is already a second, independent brake on the exact same loop, and a
     *  much harder one: an unfilled tile pays no yield at all, so the
     *  quadratic area a quadratic threshold was sized against is never
     *  actually realized in the first place. The two together made each
     *  successive pop level take strictly longer than the last (at ~25-30
     *  harvest/turn: pop 3->4 ~32 turns, 4->5 ~46, 5->6 ~56), which is what
     *  made the mid-game drag.
     *
     *  Lowered to 1.6 (2026-08-17) so the curve still rises -- bigger cities
     *  still cost more to grow -- without compounding against fill-in's own
     *  deceleration. At 1.6 the thresholds run 100/303/580/919/1313 instead
     *  of 100/400/900/1600/2500, roughly a 40% cut to the total harvest
     *  needed to reach max population. Paired deliberately with
     *  fillRateRadiusScale below; tune the two together, not separately. */
    growthThresholdPerPop: 100.0,
    growthThresholdExponent: 1.6,

    /** Cap on NATURAL (population-driven) growth and radius. Tech/building
     *  radius bonuses still stack on top of this, uncapped. */
    maxPopulation: 6,

    /** Harvest consumed per population point per turn. Zeroed -- population
     *  costs no upkeep. cities.js's tickCity still computes `upkeep =
     *  UPKEEP_RATE * city.population` and subtracts it from totalHarvest
     *  every turn; at 0 that's a no-op multiplication rather than removed
     *  code, so a future balance pass can reintroduce a cost here without
     *  touching the formula itself. */
    upkeepRatePerPop: 0,

    /** Coin and Lore produced per population point per turn. Lore is tied
     *  to population because base terrain tiles yield 0 lore (see
     *  terrain.js -- harvest/coin appear on nearly every tile, lore only
     *  from rare Ruins), so unlike harvest/coin it wouldn't otherwise scale
     *  with a growing city working more tiles -- this is what keeps lore
     *  income growing with city size instead of staying flat. */
    intrinsicCoinRate: 0.1,
    intrinsicLoreRate: 3,

    /** Flat per-city, per-turn yield, before any tiles are worked -- keeps a
     *  brand-new city from producing literally nothing. */
    flatHarvest: 2,
    flatCoin: 2,
    flatLore: 2,

    /** Extra influence a city projects per point of Lore it makes per turn. */
    loreTrickleRate: 0.0,

    /** Radius a freshly founded (population 1) city starts with. */
    baseInfluenceRadius: 2,

    /** "Resource Production" (see cities.js's applyResourceProduction): the
     *  fraction of its own yield a city adds when the player spends THIS
     *  turn's production on resources instead of a unit or building. */
    resourceProductionBonus: 0.5,

    /** "Spread Culture" (see cities.js's applyCultureSpread): a paid,
     *  one-turn boost to a city's influence spread, independent of what the
     *  city is building -- unlike Resource Production/Research, this
     *  doesn't consume the city's turn, it spends
     *  stockpile instead. cultureSpreadInfluenceMult is the multiplier
     *  applied to the city's influence strength for the turn it fires (see
     *  influence.js's computeInfluenceMap); cultureSpreadCostBase/PerPop
     *  set the { harvest, lore } cost as a flat amount plus a per-population
     *  scale, so the price keeps pace with a growing city the same way
     *  researchBoostAmount's payoff already does. */
    cultureSpreadInfluenceMult: 1.5,
    cultureSpreadCostBase: { harvest: 5, lore: 3 },
    cultureSpreadCostPerPop: { harvest: 2, lore: 1 },

    /** "Research" (see cities.js's applyResearchBoost/researchBoostAmount):
     *  spending a city's production turn to cut the civ's current research
     *  by researchBoostAmount(city) turns ALSO now costs stockpile, same
     *  { base, perPop } shape as Spread Culture just above -- unlike Spread
     *  Culture, this is paid on TOP of consuming the city's turn, not
     *  instead of it. */
    researchBoostCostBase: { coin: 5, lore: 2 },
    researchBoostCostPerPop: { coin: 2, lore: 1 },

    /** "Expedite Unit Build" (see cities.js's applyExpediteBuild) -- the
     *  Human Bazaar's city action: pay stockpile to knock one turn off the
     *  unit this city is currently building.
     *
     *  The price is ONE TURN'S SHARE of that unit's own up-front cost
     *  (cost / totalTurns), times this multiplier. Deriving it from the unit
     *  rather than from a flat base is what keeps it honest at both ends of
     *  the roster: rushing a Militia is cheap, rushing a Dragon is not, and
     *  nothing has to be re-tuned when a unit's cost changes. Above 1.0
     *  because buying a turn is a premium over doing the work -- at 1.5 you
     *  pay 150% of a turn's labour to skip it, so expediting a build from
     *  start to finish costs about half the unit again on top of its price.
     *  Lower this to make rush-buying a routine tempo play; raise it to make
     *  it an emergency lever. */
    expediteCostMult: 3,

    /** How readily an AI city spends an otherwise-WASTED turn on a Research
     *  boost, as `min(1, race.curiosity * this)` -- see ai.js's
     *  maybeBoostResearch. 0 disables the behavior entirely; a value high
     *  enough to saturate every race's curiosity (>= 10) makes it fire on
     *  every eligible idle turn, untempered by race.
     *
     *  2026-08-25: added because the AI had NO path to Research at all --
     *  applyResearchBoost was only ever reached from the human automation
     *  quota (cities.js) and the human ring menu (main.js), so across four
     *  full headless games the action fired exactly zero times for AI civs
     *  while Spread Culture fired 49-236 times. Not a scoring bug; the
     *  capability was simply never wired into chooseBuildAction, whose
     *  options are only ever unit/building/pioneer.
     *
     *  It matters because the tech tree is about twice as long as a game:
     *  finishing a race's own tree costs 389 (Human) to 471 (Halfellow)
     *  turns of research at Normal speed, and games resolve around turn
     *  125-155. Measured consequence -- across 15 games, layer 4 was
     *  completed 13 times and layer 5 zero times, leaving 44 authored techs
     *  as content no one ever sees. Research boost is the designed relief
     *  valve for exactly that, and only the human player could reach it.
     *
     *  Genuinely spare city turns are RARER than they look: measured at the
     *  branch itself, cities are progressing an existing build queue 61-73%
     *  of the time and chooseBuildAction comes back empty only 3-19% of the
     *  time. (An earlier "24-28% of city-turns are idle" read was wrong --
     *  it counted end-of-turn buildQueue==null, which also catches cities
     *  that had just FINISHED a build that turn.) The action still lands
     *  ~82 times per 5 games at 0.3, because a failed roll doesn't consume
     *  the opportunity -- the city idles and rolls again next turn, so the
     *  realized rate runs well above the per-roll probability.
     *
     *  Same-seed comparison across 5 games, best civ's completed techs and
     *  total layer-4/5 completions:
     *
     *      rate 0 (before)   0 boosts   32 techs   L4: 1    L5: 0
     *      rate 0.3          82 boosts  37 techs   L4: 11   L5: 5
     *      rate 100 (always) 205 boosts 46 techs   L4: 25   L5: 13
     *
     *  Gating rather than firing always is a PACING call. A race's reachable
     *  tree is 35-40 paid techs plus 11 auto-completed layer-0, so the
     *  ungated arm's 46 means the leader essentially completes its tree
     *  every game -- and the mechanic has no per-civ cap, so five pop-6
     *  cities cut 25+ research-turns per turn for ~125 stockpile, free
     *  against a late-game bank of ~78,000. Ungated, pacing's
     *  researchTurnsByLayer stops being the gate on research at all.
     *
     *  Curiosity is the natural trait to gate on -- it's the trait's
     *  already-documented job (races.js: "research-focus weighting"),
     *  matching how expansionism gates Pioneers. NOT yet demonstrated,
     *  though: that it produces real race differentiation. A per-race
     *  breakdown at n=2-4 per race showed depth tracking who was WINNING,
     *  not curiosity (Human at 0.9 came out lowest). Treat the race spread
     *  as unverified until a larger run says otherwise; the justification
     *  that holds today is pacing. */
    researchBoostCuriosityRate: 0.3,

    /** FILL-IN: a tile inside a city's radius contributes nothing to
     *  influence OR yield until it has individually "filled in". This delay
     *  is the main brake on the growth feedback loop (bigger radius -> more
     *  harvest -> faster growth -> bigger radius). Each turn a city adds
     *  (fillRateBase + industriousness * fillRatePerIndustriousness) to its
     *  progress; each time that crosses fillThreshold, one random unfilled
     *  offset within the current radius fills. Filled tiles are never lost.
     *
     *  History: 0.9/1.08 originally, cut 10% (2026-08-20) to 0.81/0.972, cut
     *  another 10% (2026-08-24) to 0.729/0.8748, then raised 1.5x
     *  (2026-08-25) to the current values as part of moving victory to an
     *  absolute 500-tile target (see victory.tileTarget).
     *
     *  Why the reversal: measurement showed fill-in, not population, was the
     *  rate limiter on the entire territorial win condition. A capital took
     *  ~85 turns to reach population 6 but ~137 turns to actually fill the
     *  169 tiles that population entitles it to, and only 10 of 17 tracked
     *  capitals ever finished filling inside 200 turns. Territory was still
     *  climbing when games hit the clock -- the map sat unclaimed because
     *  filling never caught up with settlement, not because kingdoms stopped
     *  expanding.
     *
     *  1.5x is deliberately modest. Fill rate has sharply diminishing
     *  returns: a 50x test buff produced only ~1.7x the claimed tiles,
     *  because the real ceiling is the city radius (= floor(population)) and
     *  contested borders, not the fill clock. This is sized to land 500
     *  tiles around turn 150, not to make filling instant. */
    fillThreshold: 3,
    fillRateBase: 1.0935,
    fillRatePerIndustriousness: 1.3122,

    /** How much the fill rate above scales with the city's CURRENT radius:
     *  the per-turn rate is multiplied by (1 + (influenceRadius - 1) * this).
     *
     *  Why this exists (2026-08-17): the base rate is flat, but the number of
     *  tiles in a radius-R city's outermost ring is 8R -- so with no scaling
     *  at all, each successive ring takes strictly longer to fill than the
     *  one before it, and a city's borders visibly grind to a halt exactly as
     *  it gets big enough to matter. Since an unfilled tile projects NO
     *  influence (the victory metric) and pays NO yield (growth), that made
     *  fill-in the single dominant brake on the whole mid-game, and one that
     *  tightened over time rather than easing.
     *
     *  At 1.0 the rate scales exactly with radius, making time-per-RING
     *  constant (the fully-compensated case). 0.5 is the deliberate middle:
     *  it roughly halves the deceleration without removing the brake
     *  entirely -- a Human (industriousness 0.7) city used to reach a full
     *  radius 4 in ~94 turns instead of ~178, with per-ring times of
     *  ~17/23/26/28 turns instead of ~17/35/52/70 (both figures ~17% faster
     *  since fillRateBase/fillRatePerIndustriousness's own 2026-08-20 speed-up
     *  -- ratios between rings are unaffected, only absolute turn counts).
     *  Set to 0 to restore the old flat behavior exactly. */
    fillRateRadiusScale: 0.5,

    /** A unit actively Resting and Defending in a city speeds its fill-in
     *  by (industriousness * this) -- also the gate for this bonus existing
     *  at all (2026-08-19, user-directed: was any military unit merely
     *  standing there, regardless of orders; now requires the Rest and
     *  Defend channel specifically). 0.5 means a max-industriousness civ
     *  gets +50%, a low one only +15%. */
    garrisonFillMultRate: 0.5,

    /** Flat additional fill-in speed bonus on top of garrisonFillMultRate's
     *  industriousness-scaled one, while a unit is Resting and Defending in
     *  the city (2026-08-19, user-directed) -- same "city influence gain
     *  increased by 25%" bonus this channel grants. */
    restAndDefendInfluenceBonus: 0.25,

    /** How strongly industriousness scales a city's influence output.
     *  Centered on 1.0 at industriousness 0.5: 0.7 at 0, 1.3 at 1.0. */
    influenceMultPerIndustriousness: 0.6,

    /** Minimum Chebyshev distance between any two cities, anywhere, and the
     *  relaxed floor used only when a civ is stranded with no legal site. */
    minCitySpacing: 6,
    emergencyCitySpacing: 3,

    /** How many road tiles in a city's radius can pay a road yield bonus.
     *  Without a cap, paving every tile becomes the dominant strategy. */
    roadBonusTileCap: 8,
  },

  // =========================================================================
  // UNIT ECONOMY  (js/data/techs.js, js/engine/ai.js)
  // What units cost to buy and — more importantly — to keep.
  // =========================================================================
  units: {
    /** Ongoing upkeep as a fraction of a unit's raw power, per turn. This is
     *  the single biggest dial on "how large an army can this game
     *  sustain". */
    upkeepBaseRate: 0.35,

    /** Which resources upkeep is drawn from. Fixed and universal -- NOT the
     *  unlocking tech's cost ratio (that's used for the one-time build cost).
     *  Most units are provisioned from Harvest; thematically magical ones
     *  draw a slice from Lore instead (spellwork, wards, curse-magic). */
    upkeepSplitDefault: { harvest: 0.70, coin: 0.30 },
    upkeepSplitMagical: { harvest: 0.50, coin: 0.25, lore: 0.25 },
    magicalUnitIds: ["wizard", "bog_witch", "dragon", "paladin"],

    /** Harvest/coin/lore every civ starts the game with (main.js's
     *  civ-creation loop) -- user-directed flat 30 across all three
     *  resources (2026-08-19). Covers every race's own starting-tech unit
     *  (Spearguard, Ranger, FoeHammer, Raider, Wanderer, Skeleton all
     *  coinCost: 15) with room to spare, so a kingdom can build its first
     *  defender turn 1 instead of waiting on a few turns of production first. */
    startingHarvest: 30,
    startingCoin: 30,
    startingLore: 30,

    /** Compounding premium per tech-tree layer -- exponent is the raw
     *  layer, so Level 0 (layer: 0, techs.js's pioneer_infrastructure/
     *  distant_horizons/distant_shores) sits at exponent 0, genuinely no
     *  premium, while every layer above it carries a real one.
     *
     *  buildLayerPremiumRate is the ONE-TIME purchase: (1.18)^5 ~= 2.3x for
     *  a layer-5 unit. Deliberately thinner than the tech tree's own cost
     *  growth, since unit power already trends up with layer on its own.
     *
     *  upkeepLayerPremiumRate is much steeper: (1.40)^5 ~= 5.4x. A one-time
     *  price only limits how FAST a civ can amass an elite army; ongoing
     *  upkeep is what decides whether it can be SUSTAINED. At this rate an
     *  army made entirely of top-tier units should bankrupt the economy
     *  paying for it. */
    buildLayerPremiumRate: 0.18,
    upkeepLayerPremiumRate: 0.40,

    /** Each copy a civ already owns (or has queued) of a `rare` unit
     *  compounds the cost AND build time of the next one by this rate. At
     *  0.45: 2nd copy 1.45x, 3rd 2.10x, 5th 4.42x -- 2-3 is a real army
     *  anchor, past that is ruinous.
     *
     *  `veryRare` (currently only the Runeforged Titan) is the steeper tier,
     *  mutually exclusive with `rare`. At 1.50: 2nd copy 2.5x, 3rd 6.25x --
     *  a second one is a genuinely hard commitment and a third effectively
     *  never worth it. */
    rarePremiumRate: 0.45,
    veryRarePremiumRate: 1.50,

    /** Mirror image of the rarity premium: a `cheap: true` unit (currently
     *  only the Goblin Miscreant) gets this much off cost, build time AND
     *  upkeep -- deliberately weak bulk filler, discounted beyond what its
     *  low raw power alone would give it. */
    cheapUnitDiscountRate: 0.30,
  },

  // =========================================================================
  // BRIDGES  (js/data/buildings.js's bridge_section, js/engine/cities.js)
  // =========================================================================
  bridges: {
    /** Longest straight-line stretch of open water the AI will consider
     *  bridging toward a far shore, in tiles (see ai.js's
     *  scanForBridgeTarget/estimateBridgeSpan) -- keeps a Pioneer from
     *  committing to an absurd deep-ocean crossing that would tie it up for
     *  dozens of turns, one segment at a time. A narrow strait or river
     *  mouth easily fits well under this; a genuine ocean gap between
     *  landmasses won't. The player isn't bound by this at all -- Build
     *  Bridge is a manual one-segment-at-a-time action (cities.js's
     *  canBuildBridgeSegment), so a human can keep extending one as far as
     *  they're willing to spend the turns and Coin on. */
    maxSpan: 8,
  },

  // =========================================================================
  // RESEARCH  (js/data/techs.js)
  // =========================================================================
  research: {
    /** PURE TIER-BASED COST: every tech's cost is
     *  GameData.effectiveTechCost(tech) = baseCost * tierGrowth^layer --
     *  every tech at the same layer costs exactly the same; the per-tech
     *  `cost` field still authored on each techs.js entry is inert data,
     *  not read by effectiveTechCost.
     *
     *  Exponent is the raw layer. Level 0 sits at exponent 0, genuinely
     *  free of this premium -- moot in practice since every Level 0 tech is
     *  auto-completed and never actually pays it, but still the number the
     *  tree DISPLAYS. These values give Level0=80, L1=176, L2=387, L3=852,
     *  L4=1874, L5=4124.
     *
     *  2026-08-25: was baseCost 10 / tierGrowth 2.0 (L1=20 ... L5=320).
     *  Headless measurement showed that curve had come completely unmoored
     *  from the economy it was meant to price against. Timestamping every
     *  tech completion across 8 games gave each layer's median research
     *  turn; cross-referencing the median leader's income at that turn
     *  showed EVERY layer costing under a third of a single turn's income:
     *
     *      layer   median turn   old cost   turns of income
     *        1         24           20           0.3
     *        2         88           40           0.1
     *        3        141           80           0.1
     *        4        177          160           0.1
     *        5        192          320           0.3
     *
     *  The doubling was never the problem -- income grows ~16x over a game
     *  (67/turn at T25 to 1,100/turn at T200) while prices were fixed at
     *  authoring time, so by T88 a kingdom held ~16,000 banked against a
     *  40-cost tech. The stockpile payment had become decorative and the
     *  turn-count timer (pacing.researchTurnsByLayer) was the only real
     *  gate on research.
     *
     *  Raising the base ~8x and steepening slightly puts cost back in the
     *  same order of magnitude as income at each layer's actual research
     *  time (L1 ~2.6 turns, L5 ~3.8). Deliberately the conservative end of
     *  the options measured -- steeper curves were available, but cost and
     *  the turn timer are meant to be CO-gates, and pricing much past this
     *  makes cost the only binding constraint and the timer inert, which
     *  just inverts the original problem. Note also that these income
     *  figures were measured under the old free-research regime; pricier
     *  research slows yield-building too, so the curve it's priced against
     *  flattens once this lands -- expect this to bite somewhat harder than
     *  the table above predicts. */
    baseCost: 80,
    tierGrowth: 2.2,
  },

  // =========================================================================
  // COMBAT  (js/engine/combat.js)
  // =========================================================================
  combat: {
    /** Flat chance a non-Ranged attacker (effective range < 2) simply misses
     *  a Flying target outright. Symmetric: it applies to a melee defender's
     *  counter against a Flying attacker just as much as to a melee
     *  attacker's forward hit against a Flying defender. */
    flyingEvasionMissChance: 0.25,

    /** Death-save techs (Halfellow "Resilient Spirit", Dwarf "Unyielding"):
     *  each successful save permanently costs THAT UNIT this many percentage
     *  points off its own future trigger chance. Diminishing returns per unit
     *  instance rather than a civ-wide cooldown, so a unit that keeps
     *  cheating death becomes steadily less able to. */
    resilientSpiritDecayPerTrigger: 0.15,
    unyieldingDecayPerTrigger: 0.15,

    /** Chance an "Unyielding" save ALSO forces a Rest next turn. Resilient
     *  Spirit's forced Rest is unconditional; this is the one deliberate
     *  difference between the two mechanics. */
    unyieldingForcedRestChance: 0.5,

    /** How tough a city is to crack: base, plus per population level, plus
     *  per structure built in it.
     *
     *  2026-08-25 recomposition. These were 4 / 2.5 / 1.5, which put a
     *  developed pop-6 city at defense 45 -- and since mitigatedDamage is
     *  roll(atk) * atk/(atk+def), that floored EVERY line unit in the game at
     *  the minimum 1 damage, taking 63 hits to raze one city. Headless
     *  testing found kingdoms launching 58-173 city attacks per game and
     *  capturing a median of zero. Conquest wasn't expensive, it was
     *  arithmetically closed.
     *
     *  The numbers are now derived from a target rather than guessed: for an
     *  attacker to clear 1 damage it needs atk^2/(atk+def) >= 1.5, so a
     *  typical attack-5 line unit needs def <= 11. Base 2 + 0.5/level puts an
     *  unwalled pop-6 city at 5 (soft -- an undefended boomtown SHOULD fall),
     *  and 2/wall puts the cutover between 3 and 4 walls: at 3 walls def is
     *  11 and a line unit still does 2, at 4 walls it drops to 1 and siege
     *  becomes required. Buildings contribute nothing now -- fortification is
     *  what walls are FOR, and a Mage College fortifying a city more than a
     *  wall did was always backwards. */
    cityBaseDefense: 2,
    cityDefensePerLevel: 0.5,
    cityDefensePerStructure: 0,

    /** +defense per alive Wall structure. With cityDefensePerStructure now 0
     *  this is the ONLY structural contribution -- walls alone decide how
     *  fortified a city is. See combat.js's cityDefenseValue, and
     *  sidebar.js's renderCityPanel for the "Defense" row shown to the
     *  player. */
    cityDefensePerWall: 2,

    /** Siege defense bypass: a unit with the Siege property ignores this
     *  fraction of a city/wall/building's defense PER POINT of siegePct,
     *  capped by siegeDefenseBypassMax. Applied on top of the existing
     *  isSiege attack multiplier (see combat.js's effectiveAttack).
     *
     *  Why bypass rather than just more attack (2026-08-25): mitigatedDamage
     *  divides by (atk+def), so simply scaling attack hits diminishing
     *  returns against exactly the high-defense targets siege exists to
     *  crack. Bypassing defense instead makes siege read as DEFEATING
     *  fortification rather than out-muscling it. At these values a
     *  Battering Ram (siegePct 2.0) ignores 50% of a city's defense and
     *  razes a developed pop-6 city in ~5 hits; an Ogre (0.5) takes ~11; a
     *  Raider (no siege) still takes 63. */
    siegeDefenseBypassPerPct: 0.25,
    siegeDefenseBypassMax: 0.75,

    /** City HP: a city has a real, damage-accumulating HP pool -- maxHp =
     *  this * population level, same mitigatedDamage formula
     *  every other attack in the game uses (see combat.js's
     *  attackStructure for the near-identical pattern this mirrors). When HP
     *  hits 0, population drops by 1 and HP refills to the new (smaller)
     *  max -- no overkill carryover into the next pool, same as a unit or
     *  structure dying doesn't cleave onto whatever's next. A level-1 city
     *  that hits 0 HP is destroyed outright rather than dropping to a
     *  nonsensical level 0. */
    cityHpPerLevel: 3,
  },

  // =========================================================================
  // VETERAN LEVELING  (js/engine/combat.js)
  // =========================================================================
  leveling: {
    maxUnitLevel: 5,

    /** Cumulative XP to REACH each level (index 0 == level 1). Front-loaded
     *  (5/8/10/13/15 per level) so surviving a few fights pays off visibly
     *  early, while level 5 stays a genuine long-game achievement.
     *  sidebar.js's "X / Y XP" readout shows this threshold raw, unrounded. */
    xpThresholds: [5, 13, 23, 36, 51],

    /** XP awarded per combat action: a flat participation grant, a per-point
     *  of damage dealt grant, and a kill bonus that scales with how strong
     *  the victim was (so farming weak targets is a poor way to level). */
    xpParticipation: 1,
    xpPerDamage: 0.15,
    xpKillBase: 3,
    xpKillPowerMult: 0.5,

    /** Per-level bonus for each of the seven upgrade paths a leveling unit
     *  can pick. Attack/Defense are flat +1 (meaningful on this game's small
     *  integer stat scale). Siege/First Strike/Double Strike are
     *  percentage-point bonuses, kept deliberately smaller per level:
     *  siegePct only applies against structures, firstStrikePct compounds
     *  every round of a fight, and doubleStrikePct is worth roughly a whole
     *  extra attack's chance to land. visionRadius/movement are the
     *  same flat-add convention as Attack/Defense, on this game's
     *  already-small vision/movement scales -- see turns.js's visibility
     *  radius sum and ai.js's computeMovementBudget for where each reads
     *  unit.levelBonuses. */
    bonusValues: {
      attack: 1,
      defense: 1,
      siegePct: 0.20,
      firstStrikePct: 0.04,
      doubleStrikePct: 0.07,
      visionRadius: 1,
      movement: 0.5,
    },
  },

  // =========================================================================
  // VICTORY & TURN LOOP  (js/engine/turns.js)
  // =========================================================================
  victory: {
    /** Tiles a civ must hold to win territorially, and how many consecutive
     *  turns they must hold them. The sustain requirement stops a one-turn
     *  border flicker from ending the game.
     *
     *  2026-08-25: this replaced a 30% SHARE of the map's claimable weight.
     *  A share threshold silently changed difficulty with every map variable
     *  -- the map scales with player count, so 30% meant 0.6x a fair share at
     *  2 players but 1.5x at 5, and headless testing found 2-player games
     *  resolving 83% of the time against 0% at 5 players. World type made it
     *  worse still: deep ocean counted toward the denominator, so an Islands
     *  map required ~59% of its claimable weight, which no game ever reached.
     *
     *  An absolute tile count removes every one of those couplings at once --
     *  no denominator, no player-count table, no world-type special case --
     *  and gives the player a legible goal ("312 / 400") instead of a
     *  percentage.
     *
     *  400 is calibrated against a 42-game headless sweep that recorded each
     *  game's full 200-turn tile trajectory, so every candidate target could
     *  be scored against the SAME games. Results (median winning turn, and
     *  share of games that resolved at all inside 200 turns):
     *
     *      300 -> 98% resolve, turn 100     500 -> 57% resolve, turn 155
     *      400 -> 90% resolve, turn 125
     *
     *  500 left 43% of games unfinished -- though not stalled: 14 of those 22
     *  sat between 419 and 497 tiles and would have crossed by turn ~210-240.
     *  300 resolved almost everything but compressed 90% of games into turns
     *  80-115, and its faster clock beat conquest to the finish so reliably
     *  that military wins fell to 5% of decided games (against 15% at 500).
     *  400 keeps resolution high without that compression, and is the largest
     *  target measured that still resolves 90% of games. */
    tileTarget: 400,
    sustainTurns: 2,
  },

  world: {
    /** Per-turn chance a worked resource tile is exhausted and removed. */
    resourceExhaustionChance: 0.10,
    /** Same, for a civ with Elf's "Tending to the Earth" tech researched --
     *  see turns.js's resourceExhaustionChanceFor. Scaled up alongside the
     *  base rate above (2026-08-24) to preserve the tech's original ~60%
     *  relative reduction rather than letting it passively double in value. */
    resourceExhaustionChanceTendingToTheEarth: 0.04,
  },

  // =========================================================================
  // WORLD ENCOUNTERS  (see doc/world_encounters_design.md)
  // Treasure Chests, the universal Ruin Delve, and Wandering Monsters.
  // Every numeric value below is a first-pass placeholder -- tune through
  // the same playtesting/headless-batch process the rest of this file's
  // constants get tuned through, not by reasoning from first principles.
  // =========================================================================
  worldEncounters: {
    treasureChest: {
      /** Chance an opened chest is trapped instead of paying out. */
      trapChance: 0.20,
      /** Flat damage a sprung trap deals, on top of its Frozen/Burning
       *  status -- same shape as Halfellow's Set the Trap (see
       *  checkTrapSpring in ai.js). */
      trapDamage: 4,
      /** A non-trapped chest pays out one reward, picked with equal weight
       *  from this list. "mapFragment" ignores `rewardAmount` entirely --
       *  see turns.js's revealMapFragment -- everything else banks
       *  `rewardAmount` of that resource (or grants it as XP). Equal
       *  weighting is a placeholder same as everything else here -- a
       *  temporary map reveal and a flat resource payout aren't obviously
       *  worth the same amount, that's a balancing-pass question. */
      rewardTypes: ["coin", "lore", "xp", "mapFragment"],
      rewardAmount: 15,
    },
    ruin: {
      /** Delay range (turns) before an exhausted Ruin reappears elsewhere --
       *  same shape as RESPAWN_MIN_DELAY/RESPAWN_MAX_DELAY in turns.js,
       *  which this deliberately does not reuse (Ruins are a tile FEATURE,
       *  not a RESOURCES entry, so they need their own respawn scheduler --
       *  see doc/world_encounters_design.md's Section 1 finding). */
      respawnMinDelay: 1,
      respawnMaxDelay: 3,
      /** Per-turn chance, while a unit channels Delve on a Ruin, of
       *  triggering that Ruin's monster encounter or treasure find. Each of
       *  the two can only ever fire once per Ruin, ever. */
      monsterEncounterChance: 0.08,
      treasureFindChance: 0.08,
    },
    monsters: {
      /** Id of the pseudo-civ every Wandering Monster unit belongs to (see
       *  ai.js's ensureMonsterCiv) -- a real entry in gameState.civs so
       *  rendering/combat/turns.js's per-civ loops handle it for free, but
       *  explicitly excluded from checkVictory/checkElimination in turns.js
       *  and never treated as a real kingdom anywhere in the UI. */
      civId: "MONSTERS",
      /** Each turn, if under the population cap, spawn chance =
       *  max(minSpawnChance, this * (1 - exploredFraction)), where
       *  exploredFraction is the share of LAND tiles explored by any civ.
       *  Linear falloff. Tuned so a fresh game doesn't have a high chance of
       *  showing zero monsters through its first few turns. */
      baseSpawnChance: 0.15,
      /** Floor under the falloff above (2026-08-17). Without it the spawn
       *  chance decays to literally zero as the map gets explored, so the
       *  wilderness threat was hard-wired to be an exploration-phase
       *  mechanic that dissolved completely the moment exploration ended --
       *  the world went quiet exactly when the mid-game began. This keeps a
       *  steady trickle refilling the population cap (perKingdomCap below)
       *  for the rest of the game. Set to 0 to restore the old
       *  decays-to-nothing behavior. */
      minSpawnChance: 0.04,
      /** Population cap = this * number of civs still alive (not
       *  eliminated). Shrinks as civs are eliminated. */
      perKingdomCap: 2,
      /** Monsters placed at world-gen time, before turn 1. Count = this *
       *  number of civs in play, same multiply-by-headcount shape as
       *  perKingdomCap -- see
       *  ai.js's seedInitialMonsters, which also keeps every initial
       *  placement well clear of every civ's starting units so a fresh
       *  Pioneer never has one bearing down on it before the player's had
       *  a real turn. */
      initialPerKingdom: 1,
    },
  },

  // =========================================================================
  // VIEW  (js/ui/render.js)
  // Presentation only -- no gameplay effect.
  // =========================================================================
  view: {
    /** Base tile size in px. Rendered size is this * zoomLevel, so this is
     *  effectively the default zoom: raising it starts the map more zoomed
     *  in while keeping the zoom readout meaningful (100% == the intended
     *  default view). The zoom bounds are scaled to match. */
    tileSize: 52,
    minZoom: 0.25,
    maxZoom: 2.0,

    /** Bare mouse wheel zooms toward the cursor (matches every other
     *  strategy game's convention) when true; Shift+wheel pans
     *  horizontally, Alt+wheel pans vertically. When false, restores the
     *  original bare-wheel-pans/Ctrl-wheel-zooms behavior. One flag to
     *  revert (see js/ui/input.js's wheel handler). */
    wheelZooms: true,

    /** Purely visual glide duration for a unit moving between ONE pair of
     *  adjacent tiles. A unit that walks several tiles in a turn animates
     *  the whole route step by step (see render.js's getVisualPos and
     *  ai.js's spendMovement, which records the tiles actually walked), so
     *  this is a per-STEP duration, not the duration of a whole move. */
    moveAnimMs: 350,

    /** Per-step duration used INSTEAD of moveAnimMs once a route is longer
     *  than one tile. A full 350ms per tile makes a six-tile march take over
     *  two seconds, which reads as sluggish when a whole AI civ is moving; a
     *  single hop still gets the slower, more deliberate moveAnimMs. */
    moveStepAnimMs: 170,

    /** Hard ceiling on how long one unit's whole multi-tile walk may take.
     *  A mounted unit crossing ten tiles of road compresses its per-step
     *  time to fit inside this instead of holding the eye for seconds;
     *  render.js's MOVE_STEP_MIN_MS keeps that compression from collapsing
     *  the walk into an invisible blur. */
    moveAnimMaxMs: 1500,

    /**
     * Drifting cloud layer -- purely cosmetic atmosphere drawn on its own
     * overlay canvas ABOVE the map, never interacting with gameplay in any
     * way (see js/ui/clouds.js).
     */
    clouds: {
      /** How many clouds exist at once. Deliberately sparse -- this is
       *  atmosphere, not weather. */
      count: 12,
      /** Peak alpha of a cloud's densest point. Low enough that terrain,
       *  units and borders stay readable straight through them. */
      opacity: 0.20,
      /** Base drift, px/second, left -> right (the user's stated
       *  direction). Slow enough to read as "floating", not "blowing". */
      driftSpeed: 7,
      /** Vertical drift is a very slow sine rather than a constant, so the
       *  wind ANGLE wanders over minutes instead of holding one fixed
       *  diagonal. Amplitude is in px/second; period is in seconds. */
      angleDriftSpeed: 2.5,
      angleDriftPeriod: 90,
      /** How much of the map's own scroll the cloud layer follows. Below 1
       *  means clouds pan SLOWER than the ground -- the parallax cue that
       *  actually sells "high above the field". 0 would pin them to the
       *  screen, 1 would glue them to the terrain. */
      parallax: 0.3,
      /** Clouds are confined to a band around the OUTER edge of the map
       *  view. bandFraction is how deep that band reaches as a fraction of
       *  the viewport's width and height, so 0.15 leaves the middle
       *  ~70% x ~70% completely clear.
       *
       *  bandFeather is what portion of that band is the fade-out, measured
       *  inward: 0.6 means clouds hold full strength across the outermost
       *  40% of the band and then fade to nothing over the remaining 60%,
       *  so there's no hard line where the clouds stop. */
      bandFraction: 0.15,
      bandFeather: 0.6,
      /** Shape of the clear middle, as the exponent of a p-norm. Measuring
       *  distance as min(distToVerticalEdge, distToHorizontalEdge) is
       *  continuous in VALUE but has a kink in its DERIVATIVE along the
       *  45-degree diagonal out of each corner -- and the eye reads a
       *  gradient discontinuity as a hard line (a Mach band) even when no
       *  pixel-to-pixel jump exists. A p-norm has no such kink anywhere, so
       *  the corners blend smoothly.
       *
       *    2 = a true ellipse (oval clear area, corners heavily clouded)
       *    4 = a rounded rectangle -- keeps more of the middle usable
       *   >6 = approaches a hard rectangle again; corner curvature gets
       *        tight enough to start reading as an edge, so don't. */
      bandShape: 4,
      /** Sprite generation: puffs per cloud and the px radius range of each
       *  puff. More/larger puffs = bigger, lumpier clouds -- too few leaves
       *  visible gaps across the cloud's horizontal span instead of
       *  merging into one soft mass. */
      puffsPerCloud: [10, 15],
      puffRadius: [38, 78],
    },
  },
};
