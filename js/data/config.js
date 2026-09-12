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
    date: "2026-09-11",
    /** Local time this build was cut, 24-hour HH:MM. */
    time: "20:26",
    /** Monotonic build counter -- increment it, don't recompute it. */
    number: 290,
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
  // GAME DIFFICULTY  (js/engine/ai.js, js/engine/tech.js, js/main.js)
  // Universal launch option, Single Player and Spectator alike.
  // =========================================================================
  //
  // 2026-08-31 (user-directed): replaces the old AI Aggression setting,
  // which was removed wholesale. That setting only ever scaled DECISION
  // WEIGHTS -- how readily an AI committed units it already had, and how
  // favorable a fight had to look before it took one. Headless measurement
  // (window.__sim) showed those were never the binding constraints:
  //
  //   - The AI banks ~66% of its lifetime income (78,684 unspent of
  //     ~111,050 earned by turn 200), so it is NOT resource-limited --
  //     which is also why none of the dials below hand out resources.
  //   - It is THROUGHPUT-limited: one research at a time and one build per
  //     city, both turn-gated. That is what buildSpeedMult/researchSpeedMult
  //     attack directly.
  //   - computeMilitaryCap scales with population, so a 2-city civ at turn
  //     30 could field only ~5 units. The early game was structurally safe
  //     for the player no matter how "aggressive" the AI was told to be.
  //
  // BASELINE SHIFT, DELIBERATE: "Easy" reproduces the game as it played
  // before this block existed -- every multiplier 1.0, every bonus 0, every
  // flag false, so it is the identity level and provably a no-op by
  // inspection rather than by simulation. Normal and Hard are both genuinely
  // harder than the old game was. This is a rebalance, not a rename.
  //
  // AI CIVS ONLY. Every consumer routes through ai.js's difficultyFor(civ),
  // which returns the identity level for the human civ and for the Monsters
  // pseudo-civ. The player is never slowed down, and their own build/research
  // time displays are unaffected -- see difficultyFor's own doc comment for
  // why that gate has to live inside each dialed function rather than at its
  // call sites.
  difficulty: {
    /** Which of `levels` below is active. Mutated by main.js's
     *  applyDifficulty at Start Game and on load. Read LIVE (never
     *  snapshotted) by every consumer, so it always reflects the last
     *  applyDifficulty call. */
    levelIndex: 1,

    /** `id` matches the difficulty STRINGS that already flow through
     *  main.js's aiDifficulty -> difficultyByCiv -> beginAITurn ->
     *  applyDifficultyNoise (ai.js's DIFFICULTY_SPREAD, target-selection
     *  jitter). Keeping them identical is what lets the two halves of the
     *  setting coexist with no mapping table between them -- do not rename
     *  one without the other.
     *
     *  buildSpeedMult / researchSpeedMult multiply an AI's build and
     *  research TURN COUNTS, so BELOW 1.0 means faster. Applied before
     *  each function's existing minBuildTurns clamp, so hard floors
     *  (Pioneer/Scout/Galley/walls) still hold. Research is dialed harder
     *  than build on purpose: research is civ-wide serial (one at a time)
     *  while building is per-city and already multiplies with city count.
     *
     *  militaryCapMult and militaryCapFloor are two halves of one idea and
     *  both are needed. The mult scales the whole curve -- a militarism-0.9
     *  Orc's ~27 ceiling becomes ~43 at Normal and ~59 at Hard. The FLOOR is
     *  what fixes the early game: cap is population-derived, so a 2-city
     *  turn-30 civ computes ~5 regardless of the mult, and only a flat
     *  minimum decouples "can this AI field an army" from "has it grown
     *  yet". The floor stops binding once population overtakes it.
     *
     *  grantsStartingTech reverses one specific existing decision. See
     *  main.js's createNewGame: every LAYER-0 tech is auto-completed for
     *  free, but race.startingTech -- each race's signature layer-1 combat
     *  unit (Raider, Spearguard, ...) -- is pointedly NOT, so "Scout is the
     *  civ's only quasi-combat capability until that finishes". Granting it
     *  to AI civs is the most direct possible answer to "the AI doesn't have
     *  its military ready quickly enough", with no tech-picking heuristic to
     *  invent.
     *
     *  bonusStartingUnits SHIPS WITH grantsStartingTech and is inert
     *  without it: at turn 0 a civ has only Pioneer/Scout/Galley unlocked,
     *  so there is no military unit to grant until the combat tech lands.
     *  Read once, at world creation -- not retroactive to a loaded save.
     *
     *  enforceRaceCultureAversion gates races.js's avoidsCultureSpread
     *  (Orc). The race flag declares the disposition; this decides whether
     *  it is honored, so at Easy an Orc AI still spends city-turns on
     *  Spread Culture -- a genuine softening, not just flavour. */
    levels: [
      { id: "easy", label: "Easy",
        buildSpeedMult: 1.00, researchSpeedMult: 1.00,
        militaryCapMult: 1.00, militaryCapFloor: 0,
        bonusStartingUnits: 0, grantsStartingTech: false,
        enforceRaceCultureAversion: false },
      { id: "normal", label: "Normal",
        buildSpeedMult: 0.85, researchSpeedMult: 0.85,
        militaryCapMult: 1.50, militaryCapFloor: 3,
        bonusStartingUnits: 1, grantsStartingTech: true,
        enforceRaceCultureAversion: true },
      { id: "hard", label: "Hard",
        buildSpeedMult: 0.70, researchSpeedMult: 0.70,
        militaryCapMult: 2.00, militaryCapFloor: 5,
        bonusStartingUnits: 1, grantsStartingTech: true,
        enforceRaceCultureAversion: true },
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
    growthThresholdExponent: 1.7,

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
    intrinsicCoinRate: 1,
    intrinsicLoreRate: 3,

    /** Flat per-city, per-turn yield, before any tiles are worked -- keeps a
     *  brand-new city from producing literally nothing. */
    flatHarvest: 2,
    flatCoin: 3,
    flatLore: 3,

    /** Extra influence a city projects per point of Lore it makes per turn. */
    loreTrickleRate: 0.0,

    /** Radius a freshly founded (population 1) city starts with. */
    baseInfluenceRadius: 2,

    /** "Resource Production" (see cities.js's applyResourceProduction): the
     *  fraction of its own yield a city adds when the player spends THIS
     *  turn's production on resources instead of a unit or building. */
    resourceProductionBonus: 1.0,

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
    cultureSpreadInfluenceMult: 1.4,
    cultureSpreadCostBase: { harvest: 5, coin: 5, lore: 5 },
    cultureSpreadCostPerPop: { harvest: 5, coin: 5, lore: 5 },

    /** "Research" (see cities.js's applyResearchBoost/researchBoostAmount):
     *  spending a city's production turn to cut the civ's current research
     *  by researchBoostAmount(city) turns ALSO now costs stockpile, same
     *  { base, perPop } shape as Spread Culture just above -- unlike Spread
     *  Culture, this is paid on TOP of consuming the city's turn, not
     *  instead of it. */
    researchBoostCostBase: { harvest: 5, coin: 10, lore: 10 },
    researchBoostCostPerPop: { harvest: 5, coin: 10, lore: 10 },

    /** "Throw a Party" (Halfellow-only, see cities.js's applyThrowAParty /
     *  techs.js's halfellow_throw_a_party): a paid, repeatable city action,
     *  same { base, perPop } stockpile-cost shape as Spread Culture/Research
     *  above -- everything else about it (heal %, buff size/duration,
     *  radius, per-city cooldown) is tuning that lives next to the effect
     *  itself in cities.js, not here, matching how every other condition's
     *  numbers (Crusade, Riddle, Devoted Companions, ...) are kept local to
     *  their own implementation rather than centralized. */
    partyCostBase: { harvest: 10, coin: 10 },
    partyCostPerPop: { harvest: 4, coin: 4 },

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
    fillRatePerIndustriousness: 1.2,

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
    minCitySpacing: 5,
    emergencyCitySpacing: 3,
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
     *  civ-creation loop) -- user-directed (2026-08-28): raised from a flat
     *  30/30/30 so EVERY kingdom can afford, turn 1, any ONE of: a Wall
     *  (GameData.buildingBuildCost("wall_section"), ~4H/7C), any of its own
     *  Layer 1 units (GameData.unitBuildCost -- the priciest across every
     *  race's L1 roster is Halfellow's Wanderer at 38H or Elf's Blade Dancer
     *  at 38L/13C), or START researching any of its own Layer 1 techs
     *  (GameData.effectiveTechCostBreakdown, paid up front by chooseResearch
     *  -- see tech.js -- the priciest single component across every L1
     *  category is Building's 106 Coin and Mystic's 106 Lore, Civic's 88
     *  Harvest). These are independent "could afford ANY ONE of" floors, not
     *  summed -- a kingdom picks one turn-1 splurge, same as the old flat
     *  30 was only ever sized for one (its own starting-tech unit). Set a
     *  little above each measured floor (88/106/106) for headroom against
     *  rounding. Re-measure via this exact query if research/unit cost
     *  formulas ever change:
     *    GameData.RACE_LIST.flatMap(r => GameData.techsForRace(r)
     *      .filter(id => GameData.getTech(id).layer === 1)
     *      .map(id => GameData.effectiveTechCostBreakdown(GameData.getTech(id))))
     */
    startingHarvest: 90,
    startingCoin: 110,
    startingLore: 110,

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
    cityBaseDefense: 1,
    cityDefensePerLevel: 0.0,
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
    xpThresholds: [5, 15, 25, 35, 45],

    /** XP awarded per combat action: a flat participation grant, a per-point
     *  of damage dealt grant, and a kill bonus that scales with how strong
     *  the victim was (so farming weak targets is a poor way to level). */
    xpParticipation: 1,
    xpPerDamage: 0.1,
    xpKillBase: 3,
    xpKillPowerMult: 0.25,

    /** XP awarded per ROUND (once per turn it's still active) of any
     *  gathering channel -- Dungeon Delving, Galley Fishing, Hunt Game, Farm
     *  Soil, Mine Vein (2026-08-31, user-directed). Flat, not scaled by the
     *  channel's own resource payout -- gathering has no "damage dealt" or
     *  "kill" analogue, so this is the whole grant, routed through the same
     *  grantXPAndAutoLevel path combat XP uses (see turns.js's own call
     *  sites) so it still picks up Altar of Ages/Neighborhood Pub/Runeforged
     *  Tools' XP-rate bonuses like any other XP grant. */
    xpPerGatheringRound: 1,

    /** Per-level bonus for each of the seven upgrade paths a leveling unit
     *  can pick. Attack/Defense are flat +0.5 (2026-09-06, user-directed;
     *  was +1 -- halved for a gentler per-level curve on this game's small
     *  stat scale; sidebar.js's levelUpChoicesHtml already formats a
     *  non-integer value to one decimal, so this needed no display changes).
     *  Siege/First Strike are percentage-point bonuses, kept deliberately
     *  smaller per level: siegePct only applies against structures and
     *  firstStrikePct compounds every round of a fight. Double Strike is
     *  +20%/level (2026-09-06, user-directed; was +7.5%) -- worth roughly a
     *  whole extra attack's chance to land, so this now climbs much faster
     *  than Siege/First Strike by design. visionRadius/movement are the
     *  same flat-add convention as Attack/Defense, on this game's
     *  already-small vision/movement scales -- see turns.js's visibility
     *  radius sum and ai.js's computeMovementBudget for where each reads
     *  unit.levelBonuses. */
    bonusValues: {
      attack: 0.5,
      defense: 0.5,
      siegePct: 0.10,
      firstStrikePct: 0.05,
      doubleStrikePct: 0.20,
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

    /**
     * RIVER COURSES (2026-09-09, user-directed: "rivers are very square")
     * ------------------------------------------------------------------
     * Tuning for worldgen.js's generateRivers. The old walk was greedy
     * steepest-descent over elevationRank(), a six-value lookup keyed off
     * TERRAIN TYPE -- plains/forest/desert/tundra all scored 3, so across a
     * continent's flat interior every candidate tied, and the tie-break
     * (`<=` against the running best, with dirs ordered n,s,e,w) handed the
     * win to WEST every single time. That is where the dead-straight runs
     * and hard right angles came from: not from the renderer, from a walk
     * with no gradient and a compass-biased tie-break.
     *
     * The replacement scores each candidate as
     *
     *     drop  +  inertia*(continues heading)  +  meander*noise
     *
     * and picks among them with a softmax rather than an arg-max. All four
     * weights below live in the same units as `drop`, i.e. raw elevation
     * difference between two adjacent tiles of the elevArr noise field.
     * That field runs 0..1 at elevationScale 0.07 (~14-tile wavelength), so
     * a typical adjacent-tile drop is a couple of hundredths -- which is
     * the magnitude every constant here is sized against.
     */
    rivers: {
      /** HOW MUCH river a map gets is NOT set here -- it is
       *  WORLD_TYPE_CONFIG's per-type `riverTileShare` in worldgen.js, since
       *  the four world types were each tuned to a different density. Every
       *  constant in this block shapes the COURSE a river takes; none of
       *  them changes how much river ends up on the map, which is the whole
       *  point of targeting a tile share rather than a river count. */
      /** Hard cap on a single course's length in tiles. Well above the old
       *  40 because a meandering course covers less straight-line distance
       *  per step, so the old cap would strand inland rivers that used to
       *  reach the sea. Rarely the binding constraint in practice -- courses
       *  end at the sea or in a basin long before this. */
      maxSteps: 120,
      /** Shortest course worth stamping, for a walk that never reached the
       *  sea. Sampling makes the walk box itself in more often than the old
       *  greedy one did, and a four-tile fragment sitting in the middle of a
       *  plain reads as a bug rather than as a spring. A course that DID
       *  reach the sea is always kept however short -- that one is a real,
       *  if stubby, river. */
      minLength: 5,
      /** Bonus for continuing the previous heading. This is what keeps a
       *  course from degenerating into a zigzag: without it, three candidates
       *  scoring within noise of each other produce a new direction almost
       *  every step. Half a typical adjacent-tile drop, so real terrain
       *  comfortably beats habit but a coin-flip does not. Raising it
       *  straightens rivers out again -- at 0.018 the longest dead-straight
       *  run went back up from 8 tiles to 13. */
      inertia: 0.010,
      /** Frequency of the meander noise field, in the same units as
       *  elevationScale. Deliberately LOWER than elevation's own 0.07 (~20-
       *  tile lobes vs ~14): the wander has to be longer-wavelength than the
       *  terrain it wanders across, or it reads as jitter rather than as a
       *  river taking the long way around. */
      meanderScale: 0.05,
      /** Weight on that field. Comparable to `inertia` -- together they are
       *  what let a river leave the locally-steepest path for a few tiles. */
      meanderWeight: 0.015,
      /** Softmax temperature for the weighted pick. At 0.010, a candidate one
       *  typical drop better than another is taken ~6x as often -- decisive
       *  where the terrain is decisive, near-random where it is flat. Set
       *  this very small to approach the old greedy behaviour. */
      temperature: 0.010,
      /** Total ELEVATION a river may climb over its whole course, to get out
       *  of the local minima a smooth noise field is full of. Without a
       *  budget, raising maxSteps buys nothing: the walk dead-ends at the
       *  first dimple, which measured as rivers averaging 22 tiles instead
       *  of the ~75 they need to reach the sea. In elevArr units, so this is
       *  a fraction of the map's whole elevation range -- small enough that
       *  a river still runs downhill overall by a wide margin. */
      uphillBudget: 0.50,
      /** ...and how much it may climb in any ONE of those steps, which is
       *  the guard that actually stops a river walking up a mountainside:
       *  the total budget alone would happily spend itself on a few big
       *  climbs. This is the single most sensitive constant in the block for
       *  course length -- at 0.04 rivers averaged 32 tiles, at 0.08 they
       *  averaged 56, because most saddles between two noise basins sit in
       *  that gap. Above ~0.08 it stops mattering (nothing is left to
       *  unblock), so this is the top of the useful range, not a limit
       *  chosen for its own sake. */
      maxStepRise: 0.08,
    },
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
      trapDamage: 2,
      /** A non-trapped chest pays out one reward, picked with equal weight
       *  from this list. "mapFragment" ignores `rewardAmount` entirely --
       *  see turns.js's revealMapFragment -- everything else banks
       *  `rewardAmount` of that resource (or grants it as XP). "reduceResearch"
       *  also ignores `rewardAmount`: it cuts 1-3 rounds off the civ's
       *  in-progress research instead (see tech.js's reduceResearchTurns) --
       *  both it and mapFragment fall back to a flat coin payout when there's
       *  nothing for them to do (no research in progress / map fully
       *  explored), same as a reward that does nothing would be a worse
       *  outcome than the trap. Equal
       *  weighting is a placeholder same as everything else here -- a
       *  temporary map reveal and a flat resource payout aren't obviously
       *  worth the same amount, that's a balancing-pass question. */
      rewardTypes: ["coin", "lore", "xp", "mapFragment", "reduceResearch"],
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

    /**
     * DAY / NIGHT CYCLE -- atmosphere (see js/ui/daynight.js) plus one
     * gameplay hook: each race sees 1 tile worse, city and unit vision
     * alike, during its own worst-sighted stretch of the cycle (see
     * races.js's visionPenaltySlots and turns.js's dayNightVisionPenaltyFor/
     * refreshVisibility). Combat and AI decision-making don't key off phase
     * directly -- only vision radius does, and the AI reacts to that
     * indirectly through a smaller visibility set, same as a human player
     * would.
     *
     * A 12-turn cycle derived from gameState.turnNumber and nothing else:
     * 4 turns of day, 2 of twilight, 4 of night, 2 of dawn. Deliberately
     * DERIVED rather than stored, so every save made before this existed
     * loads with a correct phase and needs no migration (there is no
     * migration mechanism -- savegame.js's `version` field is written and
     * never read).
     */
    /**
     * WEATHER -- rain, and sometimes a thunderstorm.
     *
     * DERIVED, NEVER STORED. Like the day/night cycle, the weather on a given
     * turn is a pure function of (mapSeed, turnNumber) -- see turns.js's
     * weatherForTurn. That is not a stylistic choice: this codebase has no
     * save-migration mechanism, so anything persisted is a compatibility
     * problem forever. Deriving it means every save written before weather
     * existed loads correctly, a reload shows the same storm instead of
     * rolling a new one, and nothing has to be serialized.
     *
     * COSMETIC TODAY, with the accessor deliberately in the engine so a later
     * rules pass has one source of truth. See weatherForTurn's own comment
     * for the intended hook points.
     */
    weather: {
      enabled: true,
      /** One "day" is one full day/night cycle. Kept as its own number rather
       *  than read from dayNight.phases so the two can be retuned apart. */
      cycleLength: 12,
      /**
       * Chance a new system begins on any given day. Raised from 0.10
       * (2026-09-09, user-directed: "around 20%") -- but note this is the RAW
       * per-day roll, not the observed frequency, and the two diverge more
       * than they might look like they should.
       *
       * weatherSystemForDay vetoes a day's roll if it would overlap a system
       * still running from an earlier day (added the same session, to stop
       * long systems merging into week-plus stretches of unbroken rain --
       * see that function's own comment). A higher raw rate means more
       * candidate start-days fall inside an existing system's shadow, so
       * more of them get thrown away. Measured: 0.10 raw -> 8.8% of days
       * actually start rain; 0.20 raw -> only 15.3%, well short of "around
       * 20%". 0.30 raw measured out to ~19.8% observed.
       *
       * Raised again to 0.34 (2026-09-12, user-directed: "rain should start
       * and stop 30% more frequently"), alongside shortening minTurns/
       * maxTurns below by the same 30% -- the two had to move together: at
       * the OLD (3-36 turn) duration range, even pushing this raw rate as
       * high as 0.70 only reached ~35% observed (measured, 160,000
       * simulated days), because a long-running system shadows so many
       * subsequent days that there's no room left for new ones to land no
       * matter how high the raw chance goes. Shortening duration first
       * frees up enough unshadowed days that a raw rate increase can
       * actually reach the target: measured (same 160,000-day methodology)
       * 0.34 raw at the NEW 2-25 turn range -> ~25.5% observed, which is
       * ~1.3x the previous ~19.7% observed baseline at the old settings --
       * i.e. every system that starts also stops exactly once, so "starts
       * and stops 30% more often" is the same target either way: 30% more
       * systems per unit time.
       */
      rainChancePerDay: 0.34,
      /** Chance a system turns thundery somewhere in its middle. The storm is
       *  always a window INSIDE the rain, so it builds out of rain and dies
       *  back into it rather than starting or ending the system. */
      stormChance: 0.30,
      /** How long a system runs, in turns. Was 3-36 (a squall passed
       *  through, up to three solid days of weather); shortened by 30% each
       *  (2026-09-12, user-directed, alongside rainChancePerDay above -- see
       *  that field's own comment for why the two moved together) to 2-25,
       *  so an individual system also stops sooner, not just starts more
       *  often. */
      minTurns: 2,
      maxTurns: 25,
      /** Clear turns required between one system ending and the next being
       *  allowed to begin. Without a gap, systems overlap and run together
       *  into stretches of rain far longer than maxTurns -- see
       *  weatherSystemForDay. Also what stops rain resuming the turn after it
       *  stops, which reads as a bug rather than as weather. */
      minGapTurns: 2,

      /** Rain fall. Angle is in degrees from vertical -- rain is wind-driven,
       *  and perfectly vertical rain reads as static. */
      rain: {
        /** Drops on screen at full rain, scaled by viewport area so a large
         *  window isn't sparser than a small one. Per million square px. */
        densityPerMpx: 900,
        stormDensityMul: 2.1,
        angleDeg: 14,
        stormAngleDeg: 24,
        speedPxPerSec: 900,
        stormSpeedMul: 1.35,
        lengthPx: [11, 22],
        widthPx: [0.8, 1.5],
        color: "#b9cfe8",
        alpha: [0.18, 0.42],
        /** Overcast wash laid under the drops. A storm is darker and greyer
         *  than plain rain, which is most of what tells the two apart at a
         *  glance. */
        overcast: "#2b3444",
        overcastAlpha: 0.10,
        stormOvercastAlpha: 0.22,
      },

      /**
       * Splashes -- drops landing on the ground (2026-09-09, user-directed:
       * "little splashes as if drops are landing"). A separate, sparser pool
       * from the streaks above: a streak is rain IN THE AIR, a splash is the
       * ground catching it, and the two need different densities and a
       * different lifecycle shape (a streak falls at a constant rate for as
       * long as it's on screen; a splash is born, rings out, and fades).
       *
       * Modeled the same way the streak pool is -- a fixed-size array,
       * particles recycled in place rather than spawned-and-forgotten -- for
       * the same payoff: under reduced motion, forcing dt to 0 (see
       * weather.js's render) freezes every splash at whatever point in its
       * ring-and-fade it happened to be at, which reads as "wet ground" with
       * no extra reduced-motion code path needed, the same trick the streaks
       * already use.
       */
      splash: {
        /** Splashes on screen at once, at full rain. Deliberately much
         *  sparser than rain's own densityPerMpx (900) -- a splash for every
         *  streak would read as noise, not rain. */
        densityPerMpx: 55,
        stormDensityMul: 1.8,
        stormRadiusMul: 1.3,
        /** How long one splash takes to ring out and fade, in ms. */
        lifetimeMs: [260, 420],
        /** The ring's radius at the end of its life, in px (before
         *  stormRadiusMul). Grows from a quarter of this at birth. */
        ringRadiusPx: [2, 5],
        color: "#dbe8f5",
        ringAlpha: 0.5,
        /** A brief bright dot at the impact point, visible only for the
         *  first slice of the lifecycle -- the "plink" a real splash reads
         *  as before it opens into a ring. */
        dotAlpha: 0.6,
      },

      /**
       * LIGHTNING -- and the photosensitivity constraint it has to live
       * inside.
       *
       * This project's standing rule is that nothing may flash or strobe.
       * Real lightning is exactly a strobe, so what ships here is not real
       * lightning: it is a soft bloom confined to the TOP of the viewport
       * (2026-09-09, user-directed "sky layer only"), tapering to nothing
       * well before the play field. The ground the player is actually
       * looking at does not change brightness.
       *
       * Every number below is a safety parameter, not a taste parameter:
       *   riseMs/fallMs  no fast edges. The rise is the dangerous direction,
       *                  so it is the one kept slowest relative to its size.
       *   peakAlpha      bounded. This is a glow, never a white-out.
       *   skyFraction    how far down the screen the bloom reaches at all.
       *   minGapMs       hard floor between flashes, so a storm can never
       *                  produce a rapid train of them however the random
       *                  numbers fall. This is the single most important
       *                  value here: isolated slow brightenings are safe,
       *                  repeated ones are not.
       * Pinned entirely off under reduced motion.
       */
      lightning: {
        enabled: true,
        color: "#cfe0ff",
        // peakAlpha/riseMs/fallMs raised and tightened together (2026-09-09,
        // user-directed: "sharper, faster, and brighter"). All three fight
        // over the SAME budget -- how much luma change lands in any one
        // frame at the top of the screen -- so they were tuned as one group
        // by actually measuring candidates against a canvas, not by picking
        // numbers and hoping. (One measurement in an earlier draft of this
        // comment claimed 18.9 without having actually been run; it was
        // wrong, and the real number for those settings was 26.1. Every
        // number below has since been re-measured for real before being
        // written down.)
        //
        // Also tried, and reverted after measuring: swapping the rise's
        // easing from smoothstep to plain linear, on the theory that
        // smoothstep's peak slope (1.5x its own average, at its midpoint)
        // must cost more per frame than a constant slope. Measured the
        // opposite -- the SAME peakAlpha/riseMs/fallMs got WORSE (15.6 ->
        // 18.2 max per-frame delta) under linear. The transition that
        // actually dominates is the very FIRST visible frame, jumping from
        // "nothing drawn" (below threshold, the whole pass is skipped) to
        // whatever the curve gives on the next frame -- smoothstep eases in
        // slowly there (its own slope is exactly 0 at the start), linear
        // does not, so linear's first frame is the bigger jump despite the
        // smaller theoretical midpoint slope. Left as smoothstep on both
        // sides; see weather.js's updateLightning for where this lives.
        //
        // Landed values, measured together over a 240-second sample at full
        // storm: peakAlpha 0.30->0.40 (+33%), riseMs 180->170, fallMs
        // 460->220 (total flash duration 640ms->390ms, the real source of
        // "faster"). Max per-frame delta at the top of the screen: 22.4,
        // up from 15.6 at the old settings but comfortably clear of the ~26
        // that the original 110ms/0.30 rise measured (which is what 180ms
        // existed to fix in the first place) -- brighter and quicker without
        // going back to the number already rejected. Play field bottom
        // stayed a flat 0 across the same sample, confirming "sky layer
        // only" still holds. If any of the three moves again, re-measure all
        // three together over a run of at least a couple of minutes, not
        // apart and not on a quick sample -- a short sample under-measured
        // this exact config by 2.5 (19.9 at 140s vs 22.4 at 240s).
        peakAlpha: 0.40,
        riseMs: 170,
        fallMs: 220,
        skyFraction: 0.42,
        /**
         * Expected seconds between strikes at full storm, and the hard floor
         * no amount of bad luck may go under.
         *
         * meanGapMs raised 7000 -> 9500 the same day as a bug fix, not a
         * taste change (2026-09-09, user-directed: "more randomness... looks
         * too regular"). The regularity was real and measurable: the old
         * scheduler was `max(floor, exponential(mean))`, and with the floor
         * this project's own safety padding had pushed up to 5400ms (see
         * updateLightning's own comment on thunderDelayMs), MORE THAN HALF
         * of all exponential draws landed below that floor and got clamped
         * UP to it -- meaning the majority of strikes arrived at exactly the
         * same 5400ms spacing, which is precisely what "too regular" looks
         * like. Fixed in weather.js by switching to `floor +
         * exponential(mean - floor)`: every gap is still >= floor, but the
         * randomness above it is now continuous instead of piling up on one
         * value. Raising meanGapMs gives that continuous part more room to
         * actually vary in -- at the old 7000 the amount above the floor
         * would have averaged only ~1600ms; at 9500 it's ~4100ms, enough
         * spread to read as genuinely irregular rather than "usually exactly
         * the floor, occasionally more."
         */
        meanGapMs: 9500,
        minGapMs: 3200,
        /** Thunder follows the flash by this much, as distant weather does.
         *  Randomized per strike within the range. Widening this range also
         *  widens how much slack weather.js's minGapMs scheduling has to pad
         *  onto the floor to keep THUNDER (not just the flash) that far
         *  apart -- see updateLightning's own comment. */
        thunderDelayMs: [400, 2600],
      },

      /**
       * Audio. NONE OF THESE FILES EXIST YET (2026-09-09) -- the system is
       * built to expect them and stays silent until they are dropped in, so
       * nothing breaks in the meantime. Rain is a continuous loop, which is
       * a channel the audio layer did not previously have (sfx.js plays
       * one-shots; music.js loops but resolves by race and situation).
       */
      audio: {
        rainLoop: "weather_rain_loop",
        stormLoop: "weather_storm_loop",
        thunder: ["weather_thunder_1", "weather_thunder_2", "weather_thunder_3"],
        rainVolume: 0.35,
        stormVolume: 0.5,
        thunderVolume: 0.7,
        /** Crossfade when rain starts, stops, or escalates into a storm. */
        fadeMs: 2500,
        /** How much rain ducks MUSIC (not this rain audio itself), 0-1, so
         *  the rain/storm loop above stays audible over it -- see main.js's
         *  animation loop, which multiplies this by the live 0-1 rain
         *  intensity (window.UI.weather.current().rain, already eased
         *  in real time) before calling MusicSystem.setAmbientDuck. Full
         *  strength (1.0 intensity) means music drops to 80% volume. */
        musicDuckPct: 0.20,
      },
    },

    dayNight: {
      /** Master default for the Interface menu's toggle. A player's own
       *  choice is persisted separately (roi_daynight_settings) and wins;
       *  this is only what a first-time player gets. */
      enabledByDefault: true,

      /** How much the Night phase specifically ducks music, 0-1 -- flat, not
       *  scaled by darkness/phaseTurn, since this is tied to the discrete
       *  "night" phase named in turns.js's phaseForTurn, the same phase
       *  convention the racial vision penalty uses (see races.js's
       *  visionPenaltySlots), not a continuous darkness value. See main.js's
       *  animation loop, which combines this with weather's own
       *  musicDuckPct (config's view.weather.audio) before calling
       *  MusicSystem.setAmbientDuck. 0.10 means music drops to 90% volume. */
      nightMusicDuckPct: 0.10,

      /** Phase table, in cycle order. Lengths must sum to 12 -- daynight.js
       *  asserts this at load rather than silently producing a lopsided
       *  cycle if someone edits one number. */
      phases: [
        { id: "day", label: "Day", turns: 4 },
        { id: "twilight", label: "Twilight", turns: 2 },
        { id: "night", label: "Night", turns: 4 },
        { id: "dawn", label: "Dawn", turns: 2 },
      ],

      /**
       * Per-slot sky, indexed by `turnNumber % 12`. `tint` is the colour
       * washed over the world and `alpha` its strength.
       *
       * `unitLights` is whether UNIT-carried light burns during that slot --
       * torches, staves, wisps, burning units. Slots 5-10 is exactly what
       * was asked for (last turn of twilight, all four of night, first turn
       * of dawn) and also exactly the half of the cycle the moon is up, so
       * the clock widget and the world agree by construction.
       *
       * BUILDING windows are deliberately NOT governed by this flag -- they
       * schedule themselves per window (see `windows` below) and start
       * lighting a turn earlier, at first twilight, because a settlement
       * lighting its lamps is what tells you dusk has arrived. A torch is
       * lit when you can no longer see; a lamp is lit when you'd rather not
       * have to.
       *
       * Alpha ceiling is deliberately well under the fog scrim's own 0.55
       * (render.js's drawRememberedTile): night has to stay comfortably
       * readable, and fogged tiles must still look MORE obscured than a lit
       * field at midnight or the fog stops reading as fog.
       *
       * EVERY NON-DAY TINT IS A DARK COLOUR, including the warm ones. These
       * are composited source-over, so the wash's own brightness is added to
       * the scene -- a literal sunset amber (#c2571f, luma ~112) made dusk
       * measurably BRIGHTER than noon, which is backwards. Keeping each tint
       * below roughly luma 45 means every slot darkens no matter what it's
       * drawn over, while the hue still does the work of saying which time of
       * day it is. Check that with the luma probe if you retune these.
       */
      slots: [
        { tint: "#000000", alpha: 0.00, cool: "#1a3a8a", colorize: 0.00, unitLights: false }, //  0  Day 1
        { tint: "#000000", alpha: 0.00, cool: "#1a3a8a", colorize: 0.00, unitLights: false }, //  1  Day 2
        { tint: "#000000", alpha: 0.00, cool: "#1a3a8a", colorize: 0.00, unitLights: false }, //  2  Day 3
        { tint: "#000000", alpha: 0.00, cool: "#1a3a8a", colorize: 0.00, unitLights: false }, //  3  Day 4
        { tint: "#3a2410", alpha: 0.15, cool: "#6e5230", colorize: 0.14, unitLights: false }, //  4  Twilight 1 -- first hint of dusk, muted amber-brown (user-reported 2026-09-07: an earlier, more saturated orange here read as "too orange" for just the first turn of dusk)
        { tint: "#2e1430", alpha: 0.22, cool: "#553a72", colorize: 0.34, unitLights: true }, //  5  Twilight 2 -- dusk violet
        { tint: "#0e1b38", alpha: 0.24, cool: "#1c46c4", colorize: 0.50, unitLights: true }, //  6  Night 1
        { tint: "#0b1730", alpha: 0.26, cool: "#1a42c0", colorize: 0.54, unitLights: true }, //  7  Night 2
        { tint: "#0a1530", alpha: 0.28, cool: "#183fbc", colorize: 0.58, unitLights: true }, //  8  Night 3 -- the small hours
        { tint: "#0d1a36", alpha: 0.25, cool: "#1d47c6", colorize: 0.52, unitLights: true }, //  9  Night 4
        { tint: "#141d3d", alpha: 0.22, cool: "#2a53c8", colorize: 0.42, unitLights: true }, // 10  Dawn 1 -- cold indigo
        { tint: "#2e2618", alpha: 0.14, cool: "#8a7038", colorize: 0.16, unitLights: false }, // 11  Dawn 2 -- first warm light
      ],

      /**
       * Denominator for the 0-1 `darkness` value derived from the slot
       * table above. `darkness` no longer drives the world's colorize pass
       * (each slot authors that directly now -- see `colorize` above), but
       * it still scales the clock dial's cloud/star crossfade and the
       * window-dot brightness, so it wants to reach a full 1.0 at the
       * deepest slot: stars should be out and lamps at full strength at
       * the small hours, whatever absolute alpha "darkest" happens to be
       * tuned to that week.
       *
       * Kept as an explicit constant rather than `max(slot.alpha)` computed
       * live so that retuning ONE slot can't silently rescale every other
       * slot's derived values. Update it deliberately, together with the
       * table, whenever the whole curve is rescaled -- as on 2026-09-09,
       * when night's peak came down 0.38 -> 0.28 (user-reported "night is
       * still too dark... we still need the human viewer to be able to see
       * what is going on") and this came down with it to match.
       */
      darknessReferencePeak: 0.28,

      /**
       * Global multiplier on each slot's own `colorize` strength -- one dial
       * to push the whole "day for night" hue shift up or down without
       * re-authoring twelve numbers. 1.0 means "use the table as written".
       *
       * The colorize pass is doing MORE work than the darkening is, and
       * deliberately so. A plain source-over wash CANNOT make a warm scene
       * read as cool: it averages toward the tint, so orange sand under a
       * dark blue at 48% comes out muddy olive-grey with red still the
       * dominant channel, and you'd have to go past 75% alpha -- unreadably
       * dark -- before blue actually won. Measured: the wash alone moved the
       * scene from strongly warm to merely neutral, never to blue.
       *
       * The "color" composite mode takes hue and saturation from the source
       * and LUMINOSITY from what's underneath, so it recolours without
       * flattening any of the art's shading. Applied through the same light
       * cutouts as the darkness, so torchlit ground stays warm while
       * everything around it goes blue.
       *
       * Per-slot `colorize` used to be DERIVED as darkness * this, which
       * coupled the two knobs backwards: making night lighter also made it
       * less blue, exactly the opposite of what "lighter but more clearly
       * night" needs. Splitting them (2026-09-09) is what let night's wash
       * drop ~26% while its blue push nearly doubled. Set to 0 to disable
       * the hue shift entirely and fall back to the wash alone.
       */
      colorizeScale: 1.0,

      /** Cross-fade when the turn advances. The sky HOLDS for the whole of a
       *  turn and only moves on End Turn, so the screen never changes while
       *  the player is thinking. Reduced motion shortens rather than removes
       *  it -- an instant full-screen brightness step 12x per cycle is
       *  exactly what the project's no-flashing rule is guarding against. */
      easeMs: 1500,
      easeMsReduced: 300,

      /** The darkness and broad-falloff layers render to an offscreen buffer
       *  at this fraction of viewport size and are upscaled on blit. Soft
       *  radial gradients survive it invisibly and it quarters the fill
       *  cost. Per-window dots bypass this and draw at full resolution --
       *  they're ~3px at default zoom and would smear. 1 disables it. */
      scratchScale: 0.5,

      lights: {
        /** Multiplies every light radius below. The tuning panel drives this. */
        radiusScale: 1.0,
        /** How much warm light is ADDED on top (the "lighter" pass), versus
         *  how much darkness each light merely removes. 0 gives a pure
         *  cutout -- ground at true daylight colour, no glow.
         *
         *  Kept LOW. The cutout pass has already brightened everything near a
         *  light by removing the night from it; the additive pass is only
         *  meant to put a warm cast on top of that. At 0.55 the two together
         *  made deepest night come out warmer and brighter than noon. */
        glowStrength: 0.20,
        /** Ceiling on how much of the night a single light may remove at its
         *  own centre. Below 1 so even a bonfire's core keeps a trace of
         *  darkness instead of reading as a hole punched through to the
         *  daytime map. */
        maxCutout: 0.82,
        /** How far a light's RADIUS wobbles, as a fraction of itself, times
         *  the source's own `flicker` rate. Pinned to 0 under reduced motion.
         *  Kept low and slow: this is a candle guttering, not a strobe. */
        flickerAmount: 0.12,
        /**
         * How far a light's BRIGHTNESS wobbles, same units.
         *
         * Radius alone turned out to be almost invisible (2026-09-09,
         * user-directed: "if a unit has the burning condition, it should have
         * ambient light that flickers"). Measured on a burning unit with only
         * the radius wobbling, the pool's core moved 0.6% and its outer
         * fringe 2.6% across a whole cycle -- because maxCutout caps the
         * middle of a light, so widening and narrowing a soft falloff barely
         * touches the part the eye is actually on. Brightness is what reads
         * as fire.
         *
         * Higher than flickerAmount for that reason, and still safe: it rides
         * the same two slow sines (periods ~3.9s and ~1.7s, i.e. 0.26Hz and
         * 0.57Hz), nowhere near the 3-60Hz band this project's no-flashing
         * rule exists to stay out of. A hearth (flicker 0.2) gets a 3%
         * breath from this; a burning unit (flicker 1.8) gets about 29%.
         */
        flickerIntensityAmount: 0.16,

        /**
         * Units that carry their own light. Radii are in TILES.
         *
         * great_bonfire's 8 matches its visionRadius (units.js: "so the
         * light it casts also reveals fog of war that far") and the aura
         * overlay overlays.js already draws at 8 -- NOT the gameplay aura's
         * radius of 4 (turns.js's GREAT_BONFIRE_AURA_RADIUS). That mismatch
         * predates this feature; 8 is the one that matches the fiction and
         * what the player already sees drawn.
         *
         * This table is the WHICH and the HOW BRIGHT. The WHERE -- which
         * pixel of the sprite the torch flame or staff crystal actually sits
         * on, per animation frame -- is authored separately in
         * js/data/window-lights.js under "unit/<typeId>[/<raceId>]/<variant>"
         * keys, the same split buildings already use (config tunes, the data
         * file places). A unit listed here with no authored entry still
         * lights; its pool just sits at the sprite's default carry position
         * instead of on the flame.
         */
        units: {
          great_bonfire: { radius: 8, color: "#ff7043", intensity: 0.85, flicker: 1.0 },
          wisp: { radius: 3, color: "#7fe6c4", intensity: 0.50, flicker: 1.6 },
          wizard: { radius: 2, color: "#cfd8ff", intensity: 0.40, flicker: 0.4 },
          militia: { radius: 2, color: "#ffb15e", intensity: 0.45, flicker: 1.2 },
        },
        /** Any unit with conditions.burning, regardless of type. */
        burning: { radius: 3, color: "#ff8a3d", intensity: 0.60, flicker: 1.8 },

        /** Off by default -- these read as fire but lighting all of them at
         *  once crowds the map. Flip to true to include. */
        optionalUnits: {
          trap_fire: false,
          dragon: false,
          mushroom: false,
        },

        /** Lamp colour by race, for cities and buildings. Warm hearth light
         *  for the living, cold witchlight for the Undead. Deliberately
         *  hand-picked rather than taken from RACES[id].color -- those are
         *  UI border colours chosen for contrast against the sidebar, and
         *  several of them are far too saturated to read as lamplight. */
        raceColors: {
          human: "#ffb765",
          halfellow: "#ffc078",
          dwarf: "#ff9a4d",
          elf: "#bfe8c8",
          orc: "#ff6b4a",
          undead: "#8fe0a8",
        },
        /** Fallback for a race with no entry above (and for the Monsters
         *  pseudo-civ, which owns no cities but can hold structures). */
        defaultRaceColor: "#ffb765",

        /**
         * Broad ambient glow each kind of structure throws, as a radius in
         * tiles and a 0-1 intensity. All four pairs live here together
         * (2026-09-09) -- city and building intensity used to be magic
         * numbers buried in daynight.js while wall and bridge were config,
         * which made "turn structure light up a bit" a two-file hunt.
         *
         * Raised across the board in that same pass (user-directed:
         * "ambient light generated by structures should be higher") --
         * intensities by roughly half, radii a little, so a settlement
         * spills light onto the ground around it rather than just glowing
         * at its own footprint. The scale is bounded from running away:
         * maxCutout caps how much night any single light may remove, and
         * the additive pass is scaled by glowStrength on top.
         */
        cityRadius: 3.0,
        cityIntensity: 0.75,
        buildingRadius: 2.0,
        buildingIntensity: 0.58,
        /** Walls get their own, smaller radius and lower intensity -- a
         *  torch or brazier mounted along a rampart, not a whole building's
         *  hearth. Falls back to the same synthetic single-window schedule
         *  a building with no authored window-lights.js entry gets, so each
         *  segment still switches on and off independently, seeded by its
         *  own tile coordinates. */
        wallRadius: 1.3,
        wallIntensity: 0.38,
        /** Bridges get the same treatment as walls -- a lantern at the
         *  crossing, not a hearth. Slightly dimmer still: a bridge is a
         *  thin band of art with a lot of dark water around it, so the same
         *  intensity reads brighter there than it does on a wall. */
        bridgeRadius: 1.2,
        bridgeIntensity: 0.32,
        /**
         * Civ-influence tile overlays -- the small per-race farmstead /
         * pig pen / graveyard sprites drawn on owned tiles (see render.js's
         * influence ambient overlay). Smallest pool of the lot: one outlying
         * cottage or a candle on a grave slab, a long way from anyone else's
         * light.
         *
         * These differ from every other structure kind in ONE important way:
         * an influence sprite with no authored entry in window-lights.js
         * emits NOTHING, where a building with no entry still gets the broad
         * synthetic glow. That is deliberate -- roughly half this art is
         * haystacks, ale barrels, cut-stone stacks and boundary markers, and
         * a glowing haystack is worse than a dark one. Authoring a lamp
         * point is what opts a variant in.
         */
        influenceRadius: 1.1,
        influenceIntensity: 0.28,

        /**
         * Flicker RATE per structure kind -- how restless each one's light is,
         * before flickerAmount / flickerIntensityAmount scale it into an
         * actual wobble. Same units as the per-unit `flicker` values in the
         * units table below (0 = dead steady, ~1 = a candle, 1.8 = a unit on
         * fire), and overridable per sprite in window-lights.js.
         *
         * City and building used to be magic numbers in daynight.js
         * (2026-09-09) while everything else about a light was config, which
         * made "settle these lamps down a bit" a two-file hunt -- the same
         * problem the intensity pair had before it moved here.
         *
         * Graded by how EXPOSED the light is rather than by how big it is: a
         * hearth behind a city's walls barely moves, a brazier on a rampart
         * and a lantern hung over a river are out in the weather, and a
         * farmstead lamp sits somewhere between the two.
         */
        cityFlicker: 0.25,
        buildingFlicker: 0.20,
        wallFlicker: 0.35,
        bridgeFlicker: 0.40,
        influenceFlicker: 0.30,
        /** City glow multiplier by population tier 1-6, so a capital burns
         *  visibly brighter than a hamlet. Index 0 is tier 1. */
        cityTierScale: [0.70, 0.80, 0.90, 1.00, 1.12, 1.25],
      },

      /**
       * MOONLIGHT -- reflected, not emitted.
       *
       * Everything else in this feature is a light SOURCE: a hearth, a torch,
       * a unit on fire. This is the opposite -- surfaces and features that
       * merely catch the moon and give a little of it back. Three things
       * follow from that, and they are why this doesn't just reuse the lamp
       * machinery:
       *
       *  1. It is COLD. Every lamp colour in this file is warm; moonlight is
       *     a pale blue-silver, and mixing the two is most of what sells it.
       *  2. It tracks the MOON, not the darkness. Strength rides
       *     state.unitLightsAlpha -- the same ramp that decides when carried
       *     torches burn, true for slots 5-10 -- so it fades in as the moon
       *     rises at second twilight and out as it sets at first dawn. No
       *     moon, no reflection, and the map agrees with the clock face by
       *     construction rather than by coincidence.
       *  3. It has no schedule and no flicker. Water does not go to bed.
       *
       * SURFACES vs FEATURES. Water is drawn as flat per-tile washes and
       * point features as small soft pools, because that is what they are --
       * but it is also a performance requirement. At minimum zoom a large map
       * puts several thousand water tiles on screen at once, and pushing that
       * many radial stamps through the light mask would cost more than the
       * whole rest of the feature. The wash is a handful of path fills no
       * matter how much ocean is in view. Ruins, chests and caves are rare
       * enough to go through the ordinary light path.
       */
      moonlight: {
        enabled: true,
        /** Pale blue-silver. Deliberately not white -- against the night's
         *  own blue wash a white highlight reads as a lamp someone left on,
         *  where a cool one reads as the moon. */
        color: "#b9d4ff",
        /**
         * Water. `cutout` is how much night the surface removes (before
         * maxCutout caps it), `glow` how much cool light it adds back.
         * Both are small on purpose: this should register as "the water is
         * catching the light" on a second look, not as lit water.
         *
         * Graded by how well each actually reflects -- open ocean is a broad
         * flat mirror, coast is broken by shallows and shore, and a river is
         * a thin ribbon crossing a land tile, so most of that tile is not
         * water at all.
         */
        surfaces: {
          ocean: { cutout: 0.20, glow: 0.13 },
          coast: { cutout: 0.15, glow: 0.10 },
          river: { cutout: 0.10, glow: 0.07 },
        },
        /**
         * Shimmer -- moonlight on water moves.
         *
         * `shimmerAmount` is how far a patch of water breathes either side of
         * its steady value. Small: this is a slow swell catching the light,
         * not glitter.
         *
         * Water is drawn as a few batched paths rather than a fill per tile
         * (see the note above), so the shimmer is bucketed: each tile lands
         * in one of `shimmerBuckets` phase groups by a hash of its own
         * coordinates, and each group is filled once. That buys an uneven
         * shimmer across a bay -- rather than the whole sea brightening at
         * once, which would read as the water being switched on -- while the
         * cost stays a fixed handful of fills however much ocean is in view.
         * The hash is of TILE coordinates, so a stretch of water keeps its
         * phase permanently and the shimmer doesn't crawl when panning.
         *
         * Two slow sines at ~0.24Hz and ~0.38Hz, nowhere near the band the
         * no-flashing rule guards; pinned flat under reduced motion.
         */
        shimmerAmount: 0.22,
        shimmerPeriodMs: 4200,
        shimmerBuckets: 6,
        /**
         * Point features, in tiles / 0-1 as everywhere else in this block.
         *
         * Graded by how well the material actually takes a low, cold light.
         * Exposed metal takes it best, which is why the two ore deposits sit
         * at the top with the chest's varnish and fittings -- gold a little
         * over iron, since iron reads as a dull grey where gold keeps some
         * brightness even by moonlight. Wet ruin stone gives back less, and
         * a cave mouth least of anything: it is a hole, and all it has to
         * offer is the damp rock around its lip.
         *
         * These share their tiles with the chest/ore GLINT in overlays.js,
         * which is a different effect doing a different job -- the glint is
         * an occasional catch of light that makes the tile findable, this is
         * a steady pool on the ground around it. They are meant to stack.
         */
        features: {
          gold: { radius: 0.8, intensity: 0.22 },
          chest: { radius: 0.8, intensity: 0.22 },
          // 0.20 rather than 0.18: at 0.18 iron measured a hair BELOW the
          // ruin below it at the tile centre, because a ruin's wider pool
          // makes up for its lower intensity. Radius and intensity both feed
          // the peak, so the ordering here isn't the ordering on screen.
          iron: { radius: 0.8, intensity: 0.20 },
          ruin: { radius: 1.0, intensity: 0.16 },
          cave: { radius: 0.8, intensity: 0.12 },
        },
      },

      windows: {
        /** Which slots a window may light on, and which it may go dark on.
         *  Lighting spans twilight into the first night turn; going dark is
         *  confined to the last three night turns, so the city empties
         *  toward morning. Each window picks one of each, deterministically
         *  per building instance per cycle -- see daynight.js's
         *  windowSchedule. */
        onSlots: [4, 5, 6],
        offSlots: [7, 8, 9],
        /** Wall-clock spread, in ms, AFTER the chosen turn begins. This is
         *  the whole point of the feature: people do not all reach for the
         *  lamp at the same instant, so a settlement has to ripple to life
         *  over several seconds rather than switching on as one object. */
        onStaggerMs: 5000,
        offStaggerMs: 5000,
        /** Each window fades at its own rate too. */
        fadeMsRange: [800, 2000],
        /** Baseline chance a window ignores offSlots and burns until dawn.
         *  window-lights.js can raise this per sprite -- a pub keeps more
         *  lamps lit through the night than a barracks does. */
        alwaysLitChance: 0.12,
        /** Dot radius in px at zoom 1.0, scaled with zoom. */
        dotRadiusPx: 2.6,
        /** Below this zoom a building is too few pixels for individual
         *  windows to resolve, so the dots are dropped and only the broad
         *  glow remains. */
        minZoom: 0.55,
      },

      /** Villager spawn rate by slot -- js/ui/villagers.js scales its own
       *  spawn rolls by this. 0 at night means no NEW wanderers; figures
       *  already out finish their route and fade through the states they
       *  already have, so the streets visibly drain at dusk instead of
       *  snapping empty. */
      villagerActivity: [1, 1, 1, 1, 0.6, 0.25, 0, 0, 0, 0, 0.25, 0.6],

      /** How far the cloud layer's own colour is dragged toward the night
       *  tint. Clouds live on a canvas ABOVE the map, so the night pass
       *  cannot reach them -- left alone they'd glow white over a dark
       *  world. 1 would fully replace their colour. */
      cloudNightBlend: 0.75,

      /** The astronomical clock hanging from the top of the map (see
       *  js/ui/daynight-clock.js) -- the lower half of a circle read as a
       *  180-degree gauge: left is rise, bottom centre is zenith, right is
       *  set. Sun and moon each ride an overlapping arc -- see
       *  daynight-clock.js's targetsForSlot for exactly which slots -- so
       *  at the handoff moments (last twilight turn, first dawn turn) both
       *  bodies sit on the dial at once, each cut in half by the horizon
       *  chord: one finishing its set on one side, the other just risen
       *  on the other. */
      clock: {
        /** The DIAL circle's own diameter in CSS px -- not the rendered
         *  canvas box, which is a little larger on every side (see
         *  daynight-clock.js's HORN_MARGIN_FRAC) to leave room for the
         *  gilded rim's corner flourishes to curl outward into. Height of
         *  the dial itself is always half this width, since the shape is
         *  exactly the lower half of a circle. */
        desktopWidth: 135,
        /** 92 * 1.75 (2026-09-11, user-directed: "make it 75% larger" once
         *  the clock moved to sit centred on the mobile sheet -- see
         *  css/mobile.css's .daynight-clock). Everything else about the
         *  dial -- the sun/moon body (bodySize below, already expressed as
         *  a fraction of dialDiameter()/desktopWidth), the track radius,
         *  the canvas box itself -- derives from this ONE number in
         *  daynight-clock.js's geometry(), so scaling it here is the whole
         *  change; nothing else needed touching to grow in proportion. */
        mobileWidth: 161,
        /** Daytime sky. Every other slot's sky is this colour mixed toward
         *  that slot's own world tint by `skyMix` x its alpha -- so the dial
         *  is derived from the same numbers the map uses and the two cannot
         *  drift apart when the slot table is retuned. */
        daySky: "#7fb6e0",
        skyMix: 2.0,
        /** Sun/moon diameter in CSS px at desktop width, scaled with the
         *  widget. Deliberately large relative to the dial -- big enough
         *  to be the focal point rather than a small icon riding a big
         *  empty arc, since the phase name is no longer written on the
         *  dial itself (see showCaption below) and the body is now the
         *  primary read. */
        bodySize: 40,
        /** The moon draws at this fraction of bodySize (2026-09-09,
         *  user-directed: "reduce the size of the moon graphic by 15%").
         *  A deliberate art-balance choice, not a correction: the two PNGs
         *  are already cropped to matching content bounds so they'd render
         *  the same size, but the moon's full lapis disc fills its frame
         *  edge to edge where the sun is mostly gaps between rays, so at
         *  equal size the moon reads as the heavier of the two. */
        moonSizeScale: 0.85,
        /** Radius of the track the body rides, as a fraction of the dial's
         *  own radius. Under 1 so the body sits inside the rim rather than
         *  half-clipped by it, and low enough that the body clears the
         *  caption when it passes through zenith at the bottom of the dial. */
        trackRadius: 0.58,
        /** Show the phase name (e.g. "Night") ONLY on hover -- no turn count
         *  (that's what the HUD's own turn counter is for), and no longer
         *  drawn at rest either: a dial with sky, sun/moon and a gilded
         *  frame reads its own phase well enough at a glance that a
         *  permanent caption competed with it rather than clarifying it.
         *  Hover detection is done in script (a mousemove listener testing
         *  distance from dial centre), NOT by making the element
         *  pointer-events:auto -- that would swallow clicks meant for the
         *  map underneath. Set false to disable the tooltip entirely. */
        showCaption: true,
        /** Clouds (day) and stars (night) painted inside the dial's
         *  own sky, faded by the same darkness value driving the world
         *  tint -- so the two can never show, say, a starry dial over a
         *  sunlit map. cloudPower/starPower shape the crossfade curve;
         *  1 is linear, higher pulls the transition later into twilight
         *  so neither layer lingers faintly through the whole phase. */
        cloudPower: 1.3,
        starPower: 1.6,
      },
    },
  },
};
