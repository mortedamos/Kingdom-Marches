/**
 * GAME CONFIGURATION
 * ==================
 * The game's balance dials, in one place (2026-08-03, user-directed).
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
  // PACING  (js/engine/ai.js, js/engine/tech.js)
  // =========================================================================
  pacing: {
    /** Universal turns-to-complete rate (2026-08-04, user-directed): one
     *  shared knob for every timed queue in the game -- ai.js's
     *  unitBuildTurns/buildingBuildTurns AND tech.js's researchTurns all
     *  read this now, instead of each subsystem keeping its own separate
     *  rate (units/buildings used to run at 0.24, research at 0.12 -- a 2x
     *  mismatch with no real justification). Formula shape is the same
     *  everywhere: turns = round((cost or power) / rate * slowness), min 1.
     *  Set to the FASTER of the two old values, so unit/building pacing
     *  roughly doubles in speed to match research rather than the other way
     *  around. */
    slowness: 0.1,
    /** Per-category RATIOS on top of slowness above (2026-08-06, user-
     *  directed), not a second independent rate -- units were finishing in
     *  1-2 turns almost everywhere (unit power is a small number, and
     *  unitBuildTurns' rate gets a militarism boost on top of
     *  industriousness) while buildings/walls stretched to 15-28 turns for
     *  a low-industriousness race (building coinCost is a bigger number,
     *  and buildingBuildTurns' rate is industriousness alone). Multiplying
     *  each category's turns by its own factor here fixes that gap while
     *  keeping slowness as the ONE knob that scales every queue at once --
     *  turn slowness up or down and units/buildings/research all still
     *  move together, just at their established relative pace to each
     *  other. Tuned so a mid-tier combat unit lands around 3-4 turns and a
     *  mid-tier building around half its old length (worst case, a cheap-
     *  industriousness race's priciest building, roughly 28 turns -> ~14)
     *  -- see ai.js's unitBuildTurns/buildingBuildTurns.
     *
     *  researchPaceFactor (2026-08-06, user-directed) joined the two above
     *  for the same reason -- research had grown into its own pacing
     *  problem, especially at high tiers for a low-industriousness race
     *  (Layer 5 was running 160 turns at industriousness 0.2).
     *
     *  Re-tuned again (2026-08-06, user-directed) alongside tech.js's new
     *  RESEARCH_TURNS_EXPONENT -- the two together are calibrated so that,
     *  at industriousness 0.5 (the fallback default), Layer 5 lands at
     *  exactly 20 turns and Layer 1 at 3, with Layers 0/2/3/4 falling
     *  smoothly in between (2/3/5/8/12/20) -- see researchTurns' own doc
     *  comment for why the exponent had to change too, not just this
     *  factor, to hit both. Faster/slower industriousness races and the
     *  Game Speed slider still scale proportionally from there. */
    unitPaceFactor: 2.2,
    buildingPaceFactor: 0.5,
    researchPaceFactor: 2.1,
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
     *  tally, relative to ordinary land. Applied to BOTH a civ's owned count
     *  and the total claimable pool, so a water-heavy map doesn't inflate the
     *  denominator against everyone. */
    lowValueTerrainWeight: 0.25,

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
    /** Growth is quadratic: harvest needed for the next pop level is
     *  population^2 * this. Quadratic deliberately mirrors the worked-tile
     *  AREA also growing quadratically with radius, which is what stops
     *  growth from accelerating away late-game. */
    growthThresholdPerPop: 100.0,

    /** Cap on NATURAL (population-driven) growth and radius. Tech/building
     *  radius bonuses still stack on top of this, uncapped. */
    maxPopulation: 6,

    /** Harvest consumed per population point per turn. */
    upkeepRatePerPop: 0.2,

    /** Coin and Lore produced per population point per turn. Lore raised
     *  from 0.1 to 3 (2026-08-06, user-directed): every base terrain tile
     *  yields 0 lore (see terrain.js -- harvest/coin appear on nearly every
     *  tile, lore only from rare Ruins), so unlike harvest/coin, lore was
     *  never scaling with a growing city working more tiles -- it stayed
     *  essentially flat regardless of size, a shortage that got WORSE as a
     *  city grew even though every tech needs some lore. Tying it directly
     *  to population fixes that scaling gap at its source, not just the
     *  early-game flat-bonus workaround (flatLore below). */
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

    /** FILL-IN: a tile inside a city's radius contributes nothing to
     *  influence OR yield until it has individually "filled in". This delay
     *  is the main brake on the growth feedback loop (bigger radius -> more
     *  harvest -> faster growth -> bigger radius). Each turn a city adds
     *  (fillRateBase + industriousness * fillRatePerIndustriousness) to its
     *  progress; each time that crosses fillThreshold, one random unfilled
     *  offset within the current radius fills. Filled tiles are never lost.
     *
     *  At the current values that's ~3.4 turns/tile at industriousness 0.3
     *  (Orc) down to ~1.9 at 1.0 (Halfellow). */
    fillThreshold: 3,
    fillRateBase: 0.75,
    fillRatePerIndustriousness: 0.9,

    /** Garrisoning a city speeds its fill-in by (industriousness * this).
     *  0.5 means a max-industriousness civ gets +50%, a low one only +15%. */
    garrisonFillMultRate: 0.5,

    /** How strongly industriousness scales a city's influence output.
     *  Centered on 1.0 at industriousness 0.5: 0.7 at 0, 1.3 at 1.0. */
    influenceMultPerIndustriousness: 0.6,

    /** Minimum Chebyshev distance between any two cities, anywhere, and the
     *  relaxed floor used only when a civ is stranded with no legal site. */
    minCitySpacing: 8,
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
    /** Ongoing upkeep as a fraction of a unit's raw power, per turn.
     *  Raised 0.10 -> 0.35 after a 900-turn game showed a 19-unit army
     *  costing only ~6% of income -- a rounding error rather than real
     *  economic pressure, which is why every race ended games sitting on
     *  100+ turns of unspent resources. This is the single biggest dial on
     *  "how large an army can this game sustain". */
    upkeepBaseRate: 0.35,

    /** Which resources upkeep is drawn from. Fixed and universal -- NOT the
     *  unlocking tech's cost ratio (that's used for the one-time build cost).
     *  Most units are provisioned from Harvest; thematically magical ones
     *  draw a slice from Lore instead (spellwork, wards, curse-magic). */
    upkeepSplitDefault: { harvest: 0.70, coin: 0.30 },
    upkeepSplitMagical: { harvest: 0.50, coin: 0.25, lore: 0.25 },
    magicalUnitIds: ["wizard", "bog_witch", "dragon", "paladin"],

    /** Compounding premium per tech-tree layer -- exponent is the RAW layer
     *  now, not layer-1 (2026-08-04, user-directed): Layer 1 used to be a
     *  free/no-premium baseline (exponent 0); now every layer above 0
     *  carries a real premium, just a smaller one the lower the layer.
     *  Level 0 (layer: 0, techs.js's pioneer_infrastructure/
     *  distant_horizons/distant_shores) sits at exponent 0 -- genuinely NO
     *  premium, the one true free-baseline layer now. Deliberately raises
     *  cost/upkeep across every OTHER tier.
     *
     *  buildLayerPremiumRate is the ONE-TIME purchase: (1.18)^5 ~= 2.3x for a
     *  layer-5 unit (was ~2x at layer-1 exponent). Deliberately thinner than
     *  the tech tree's own cost growth, since unit power already trends up
     *  with layer on its own.
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
  // RESEARCH  (js/data/techs.js)
  // =========================================================================
  research: {
    /** PURE TIER-BASED COST (2026-08-04, user-directed): replaces the old
     *  scheme of ~150 individually hand-authored `cost` fields in techs.js
     *  (each then multiplied by a layer premium) with a single formula --
     *  GameData.effectiveTechCost(tech) = baseCost * tierGrowth^layer. Every
     *  tech at the same layer now costs exactly the same; the old per-tech
     *  `cost` fields are no longer read by effectiveTechCost at all (left in
     *  techs.js as inert data rather than mechanically stripped from ~150
     *  entries for zero functional gain).
     *
     *  Exponent is the RAW layer, not layer-1 (2026-08-04, user-directed) --
     *  every layer-based premium in the game (this, unitLayerPremium,
     *  unitUpkeepLayerPremium) dropped its old "-1" so Layer 1 is no longer
     *  a free/no-premium baseline. Level 0 (layer: 0, as of 2026-08-06 a
     *  real integer, not the old layer: 0.5 fudge -- see
     *  GameData.effectiveTechCost/unitTechLayer's own `?? 1` fallback,
     *  fixed to treat 0 correctly instead of needing to dodge it) sits at
     *  exponent 0, i.e. genuinely free of this premium -- moot in practice
     *  since every Level 0 tech is auto-completed and never actually pays
     *  it, but still the number the tree DISPLAYS. tierGrowth: 2.0 gives
     *  Level0=10, L1=20, L2=40, L3=80, L4=160, L5=320. */
    baseCost: 10,
    tierGrowth: 2.0,
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
     *  per structure built in it. */
    cityBaseDefense: 4,
    cityDefensePerLevel: 2.5,
    cityDefensePerStructure: 1.5,

    /** City HP (2026-08-04, user-directed): a city now has a real, damage-
     *  accumulating HP pool instead of attackCity's old single win/lose roll
     *  -- maxHp = this * population level, same mitigatedDamage formula
     *  every other attack in the game already uses (see combat.js's
     *  attackStructure for the near-identical pattern this mirrors). When HP
     *  hits 0, population drops by 1 and HP refills to the new (smaller)
     *  max -- no overkill carryover into the next pool, same as a unit or
     *  structure dying doesn't cleave onto whatever's next. A level-1 city
     *  that hits 0 HP is destroyed outright rather than dropping to a
     *  nonsensical level 0. */
    cityHpPerLevel: 5,
  },

  // =========================================================================
  // VETERAN LEVELING  (js/engine/combat.js)
  // =========================================================================
  leveling: {
    maxUnitLevel: 5,

    /** Cumulative XP to REACH each level (index 0 == level 1). Front-loaded
     *  (10/15/20/25/30 per level) so surviving a few fights pays off visibly
     *  early, while level 5 stays a genuine long-game achievement. */
    xpThresholds: [10, 25, 45, 70, 100],

    /** XP awarded per combat action: a flat participation grant, a per-point
     *  of damage dealt grant, and a kill bonus that scales with how strong
     *  the victim was (so farming weak targets is a poor way to level). */
    xpParticipation: 1,
    xpPerDamage: 0.15,
    xpKillBase: 3,
    xpKillPowerMult: 0.5,

    /** Per-level bonus for each of the five upgrade paths a leveling unit
     *  can pick. Attack/Defense are flat +1 (meaningful on this game's small
     *  integer stat scale). Siege/First Strike/Double Strike are
     *  percentage-point bonuses, kept deliberately smaller per level:
     *  siegePct only applies against structures, firstStrikePct compounds
     *  every round of a fight, and doubleStrikePct (2026-08-03,
     *  user-directed) is worth roughly a whole extra attack's chance to
     *  land, so 3% per level was chosen to feel comparable to the other two
     *  percentage paths rather than to Attack/Defense's flat weight. */
    bonusValues: {
      attack: 1,
      defense: 1,
      siegePct: 0.10,
      firstStrikePct: 0.01,
      doubleStrikePct: 0.03,
    },
  },

  // =========================================================================
  // VICTORY & TURN LOOP  (js/engine/turns.js)
  // =========================================================================
  victory: {
    /** Share of the map's total claimable weight one civ must hold to win
     *  territorially, and how many consecutive turns they must hold it.
     *  Lowering this makes territorial victory dominate; the sustain
     *  requirement stops a one-turn border flicker from ending the game. */
    shareThreshold: 0.30,
    sustainTurns: 2,
  },

  world: {
    /** Per-turn chance a worked resource tile is exhausted and removed. */
    resourceExhaustionChance: 0.05,
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

    /** Purely visual glide duration for a unit moving between tiles. */
    moveAnimMs: 350,

    /**
     * Drifting cloud layer (2026-08-06, user-directed) -- purely cosmetic
     * atmosphere drawn on its own overlay canvas ABOVE the map, never
     * interacting with gameplay in any way (see js/ui/clouds.js).
     */
    clouds: {
      /** How many clouds exist at once. Deliberately sparse -- this is
       *  atmosphere, not weather. */
      count: 7,
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
       *  view (2026-08-06, user-directed -- this replaced an earlier
       *  transparent hole that followed the mouse). bandFraction is how
       *  deep that band reaches as a fraction of the viewport's width and
       *  height, so 0.15 leaves the middle ~70% x ~70% completely clear.
       *
       *  bandFeather is what portion of that band is the fade-out, measured
       *  inward: 0.6 means clouds hold full strength across the outermost
       *  40% of the band and then fade to nothing over the remaining 60%,
       *  so there's no hard line where the clouds stop. */
      bandFraction: 0.15,
      bandFeather: 0.6,
      /** Shape of the clear middle, as the exponent of a p-norm
       *  (2026-08-06, user-reported sharp corner seams).
       *
       *  The first version measured distance as min(distToVerticalEdge,
       *  distToHorizontalEdge), which is continuous in VALUE but has a
       *  kink in its DERIVATIVE along the 45-degree diagonal out of each
       *  corner -- and the eye reads a gradient discontinuity as a hard
       *  line (a Mach band) even when no pixel-to-pixel jump exists. A
       *  p-norm has no such kink anywhere, so the corners blend smoothly.
       *
       *    2 = a true ellipse (oval clear area, corners heavily clouded)
       *    4 = a rounded rectangle -- keeps more of the middle usable
       *   >6 = approaches a hard rectangle again; corner curvature gets
       *        tight enough to start reading as an edge, so don't. */
      bandShape: 4,
      /** Sprite generation: puffs per cloud and the px radius range of each
       *  puff. More/larger puffs = bigger, lumpier clouds. Raised from
       *  [6,9] (2026-08-06): too few puffs left visible gaps across the
       *  cloud's horizontal span instead of merging into one soft mass. */
      puffsPerCloud: [10, 15],
      puffRadius: [38, 78],
    },
  },
};
