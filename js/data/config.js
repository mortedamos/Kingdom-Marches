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
    date: "2026-08-19",
    /** Local time this build was cut, 24-hour HH:MM. */
    time: "12:33",
    /** Monotonic build counter -- increment it, don't recompute it. */
    number: 134,
  },

  // =========================================================================
  // PACING  (js/engine/ai.js, js/engine/tech.js)
  // =========================================================================
  pacing: {
    /** Universal turns-to-complete rate: one shared knob for every timed
     *  queue in the game -- ai.js's unitBuildTurns/buildingBuildTurns and
     *  tech.js's researchTurns all read this. Formula shape is the same
     *  everywhere: turns = round((cost or power) / rate * slowness), min 1. */
    slowness: 0.1,
    /** Per-category RATIOS on top of slowness above, not a second
     *  independent rate -- keeps slowness as the ONE knob that scales every
     *  queue at once while letting units/buildings/research each move at
     *  their own established relative pace. Tuned so a mid-tier combat unit
     *  lands around 3-4 turns, and (paired with tech.js's
     *  RESEARCH_TURNS_EXPONENT) research at industriousness 0.5 lands
     *  Layer 1 at 3 turns and Layer 5 at 20, with Layers 0/2/3/4 falling
     *  smoothly in between (2/3/5/8/12/20) -- see researchTurns' own doc
     *  comment. Faster/slower industriousness races and the Game Speed
     *  slider scale proportionally from there. */
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
     *  set the { coin, lore } cost as a flat amount plus a per-population
     *  scale, so the price keeps pace with a growing city the same way
     *  researchBoostAmount's payoff already does. */
    cultureSpreadInfluenceMult: 1.5,
    cultureSpreadCostBase: { coin: 5, lore: 3 },
    cultureSpreadCostPerPop: { coin: 2, lore: 1 },

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
     *  entirely -- a Human (industriousness 0.7) city reaches a full radius 4
     *  in ~94 turns instead of ~178, with per-ring times of ~17/23/26/28
     *  turns instead of ~17/35/52/70. Set to 0 to restore the old flat
     *  behavior exactly. */
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

    /** Coin every civ starts the game with (main.js's civ-creation loop) --
     *  exactly covers every race's own starting-tech unit (Spearguard,
     *  Ranger, FoeHammer, Raider, Wanderer, Skeleton all coinCost: 15), so
     *  a kingdom can build its first defender turn 1 instead of waiting on
     *  a few turns of production first. */
    startingCoin: 15,

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
    /** Longest straight-line stretch of open water a single bridge project
     *  can span, in tiles (see cities.js's computeBridgePath) -- keeps a
     *  Pioneer from queueing an absurd deep-ocean crossing that would tie
     *  it up for dozens of turns. A narrow strait or river mouth easily
     *  fits well under this; a genuine ocean gap between landmasses won't. */
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
     *  tree DISPLAYS. tierGrowth: 2.0 gives Level0=10, L1=20, L2=40, L3=80,
     *  L4=160, L5=320. */
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

    /** +defense per alive Wall structure, ON TOP of the generic
     *  cityDefensePerStructure every structure already gives -- a wall is
     *  still a structure, so it already contributes that 1.5; this is the
     *  wall-specific premium for actually being a wall. See
     *  combat.js's cityDefenseValue for where the two add together, and
     *  sidebar.js's renderCityPanel for the "Defense" row that surfaces the
     *  total (base + level + structures + walls) to the player. */
    cityDefensePerWall: 1,

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
      siegePct: 0.10,
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
    /** Same, for a civ with Elf's "Tending to the Earth" tech researched --
     *  see turns.js's resourceExhaustionChanceFor. */
    resourceExhaustionChanceTendingToTheEarth: 0.02,
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

    /** Purely visual glide duration for a unit moving between tiles. */
    moveAnimMs: 350,

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
