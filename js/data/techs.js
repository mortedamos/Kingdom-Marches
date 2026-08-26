/**
 * TECH TREE DATA
 * --------------
 * Shared shape: every race's tree is 5 LAYERS deep across 3 columns —
 * Civic, Building, Military. Layers are the unit of "power": every tech's
 * real TOTAL cost is PURE tier-based (GameData.effectiveTechCost, doubling
 * per layer -- see GameConfig.research's own doc comment), not read from
 * the individual `cost` field still authored on each node below (inert
 * data now, kept rather than mechanically stripped from every entry). That
 * total is then split across harvest/coin/lore by the node's OWN column
 * (see GameData.TECH_COST_RATIO/effectiveTechCostBreakdown): Civic leans
 * Harvest, Building leans Coin,
 * Military splits Coin/Lore evenly. A layer can hold more than one node (a
 * Building and a Civic tech may share a layer; Military may fork into two
 * choices at a layer). The one hard rule: a race's 4 buildings never share
 * a layer with EACH OTHER (each of the 4 sits on its own layer, L2-L5).
 *
 * There is no shared universal root tech -- every race's own L1 nodes (and
 * any other node with no natural prerequisite) are tree roots in their own
 * right (prereqs: []), gated only by the city-count layer gate (see
 * engine/tech.js meetsCityGate: a layer-L tech needs >= L cities).
 *
 * There is no "wonder" concept (wonderOnePerCiv) -- every building a civ
 * unlocks can be built in as many of its cities as it has adjacent slots
 * for. Just buildings.
 *
 * Military column: L1 is always the race's basic melee unit (already
 * implemented in units.js). L2/L4/L5 are STUBS for the 5 races that haven't
 * had their military column fully fleshed out yet — reserved nodes for a
 * spear/archer/elite-tier unit that doesn't exist yet (`stub: true`,
 * `plannedUnit`, `plannedRole`). Orc's tree (below) is fully fleshed out --
 * no stubs.
 *
 * `effects` types applied by engine/tech.js:
 *   civic_influence_bonus { value }        +% city influence
 *   radius_bonus          { value }        +influence radius (all cities, incl. future ones)
 *   unlock_unit            { unit }
 *   unlock_building         { building }
 *   governance_unlock                       opens governance choice
 *   harvest_pct_bonus       { value }       +% total city harvest yield
 *   coin_from_harvest_pct   { value }       converts this turn's harvest into bonus coin
 *   siege_attack_bonus      { value }       +% attack when attacking a structure (civ-wide flat multiplier)
 *   siege_property_bonus    { value }       +value to every unit's effective siegePct (civ-wide, additive)
 *   double_strike_property_bonus { value }  +value to every unit's effective doubleStrikePct (civ-wide, additive; see units.js's doubleStrikePct)
 *   raid_kill_bonus         { harvest, coin, lore }   flat stockpile bonus on kill, adds to race baseline
 *   death_lore_bonus        { value }       +lore when this civ's own unit dies in combat
 *   raise_dead_resistance   { value }       chance (0-1) this civ's defeated units resist an enemy's raise-dead
 *   ignore_terrain_penalty  { terrain }      caps that terrain's move cost to 1
 *   terrain_movement_discount  { terrain, value }  reduces the movement cost of LEAVING that terrain by
 *                                                  `value`, floored at 0.5 (civ-wide) -- see ai.js's
 *                                                  landCostForTerrain. Applies every time a unit steps off a
 *                                                  matching tile, anywhere on its path, not just at the start
 *                                                  of its turn.
 *   unit_terrain_movement_discount { terrain, value, units }  same, but scoped to specific unit type ids only
 *   unlock_mountain_tunneling               makes Mountains passable (slow) for this civ
 *   unlock_mechanic         { mechanic }     generic flag for bespoke mechanics (e.g. "dark_ritual")
 *   building_count_bonus    { bonus }        flat per-turn yield scaling with a city's built (non-wall) structure count
 *   fill_rate_mult          { value }        multiplies a city's per-turn tile fill-in rate (civ-wide)
 *   universal_range_grant   { value }        floor on every unit's effective Ranged value (civ-wide,
 *                                            Math.max against the unit's own range -- never lowers it)
 *
 * `costBreakdown` on race-tree nodes is UNRELATED to what the node itself
 * costs to research (see above) -- it's the resource-type MIX used to
 * price whatever UNIT/BUILDING that node unlocks (GameData.unitBuildCost/
 * buildingBuildCost), only present on nodes with an unlock_unit/
 * unlock_building effect worth pricing that way.
 */

window.GameData = window.GameData || {};

window.GameData.TECHS = {
  // --- LEVEL 0: shared starting infrastructure. Every race, no
  // raceOnly/excludedRaces, layer: 0. ALL are auto-completed for every civ
  // at creation (main.js's createNewGame) -- nothing at Level 0 is ever
  // actually researched/paid for. A civ's own signature combat
  // unit (Raider, Spearguard, etc., via that race's real Level 1
  // startingTech) must still actually be researched like anything else;
  // Scout is deliberately the civ's only quasi-"combat" capability until
  // that finishes. ---
  pioneer_infrastructure: {
    id: "pioneer_infrastructure", label: "Pioneer", category: "civic", layer: 0, cost: 10,
    prereqs: [],
    description: "Unlocks the Pioneer, who can found new cities and build roads.",
    // costBreakdown (2026-08-05, originally shared_infrastructure's):
    // gives Pioneer the same power-derived, multi-resource build-cost
    // MODEL every other teched unit already uses (see techs.js's
    // unitBuildCost) instead of the old flat units.js coinCost. Ratio only
    // (not absolute numbers) -- coin-weighted over harvest since this was
    // a coin-only unit before, just no longer 100% coin. No `lore`
    // component -- Pioneer isn't a scholarly unit.
    costBreakdown: { harvest: 2, coin: 3 },
    effects: [
      { type: "unlock_unit", unit: "pioneer" },
    ],
  },
  distant_horizons: {
    id: "distant_horizons", label: "Distant Horizons", category: "military", layer: 0, cost: 10,
    prereqs: [],
    description: "Unlocks the Scout, a fast, far-seeing unit for exploring the map.",
    costBreakdown: { harvest: 2, coin: 3 },
    effects: [{ type: "unlock_unit", unit: "scout" }],
  },
  distant_shores: {
    id: "distant_shores", label: "Distant Shores", category: "military", layer: 0, cost: 10,
    prereqs: [],
    description: "Unlocks the Galley, a naval unit for crossing water and carrying other units aboard.",
    costBreakdown: { harvest: 2, coin: 3 },
    effects: [{ type: "unlock_unit", unit: "galley" }],
  },
  // Pioneer/Scout resource actions -- each unlocks one channeled action
  // (js/ui/sidebar.js's channelActions, js/engine/turns.js), named for its
  // specific resource ("Hunt Game"/"Farm Soil").
  hunt_game: {
    id: "hunt_game", label: "Hunt Game", category: "civic", layer: 0, cost: 10,
    prereqs: [],
    description: "Pioneers and Trackers can hunt Game tiles for bonus Harvest.",
    effects: [{ type: "unlock_mechanic", mechanic: "hunt_game" }],
  },
  farm_soil: {
    id: "farm_soil", label: "Farm Soil", category: "civic", layer: 0, cost: 10,
    prereqs: [],
    description: "Pioneers and Trackers can farm Fertile Soil tiles for bonus Harvest.",
    effects: [{ type: "unlock_mechanic", mechanic: "farm_soil" }],
  },
  // Ruin Delving (see doc/world_encounters_design.md): Level 0 shared
  // infrastructure, same tier as Pioneer/Scout/Galley/Hunt Game/Farm Soil --
  // every civ starts with it, no race restriction, any unit can Delve.
  // Grants the "dungeon_delve" mechanic id (read by orders.js/ai.js/turns.js).
  //
  // Category "mystic", not "civic" (2026-08-26, user-directed): unlike
  // Hunt Game/Farm Soil/Fishing/Mining, which are all mundane labor on an
  // ordinary tile, this is picking apart the leavings of something old and
  // half-understood -- the Mystic column is where the tree already files
  // exactly that kind of content.
  //
  // Description simplified to match the terse "unit can X for bonus Y"
  // register the other Level 0 gathering techs use, in place of the old
  // text's blow-by-blow of channel/cancel/claim mechanics -- none of the
  // sibling techs explain their own persistence rules either, so this
  // brings it in line rather than making it the odd one out. The
  // treasure/monster line reflects a real mechanic, not added flavor: see
  // turns.js's once-per-Ruin rolls against config.js's
  // worldEncounters.ruin.treasureFindChance/monsterEncounterChance.
  ruin_delving: {
    id: "ruin_delving", label: "Ruin Delving", category: "mystic", layer: 0, cost: 10,
    prereqs: [],
    description: "Any unit can Delve a Ruin for steady Coin and Lore, with a chance to uncover treasure or disturb something dangerous.",
    effects: [{ type: "unlock_mechanic", mechanic: "dungeon_delve" }],
  },
  // Fishing/Mining/Walls: each mechanic already
  // existed and was already unconditionally usable -- these three Level 0
  // techs don't change any behavior, they just make what was already true
  // ("any Galley can fish", "any Pioneer/Tracker can mine", "walls are
  // buildable") explicit and visible to the player, same tier and
  // auto-completed-for-everyone treatment as Hunt Game/Farm Soil/Ruin
  // Delving above. See orders.js's contextMenuOptions and turns.js's
  // Fishing/Mining channel blocks for the gate checks this actually adds.
  fishing: {
    id: "fishing", label: "Fishing", category: "civic", layer: 0, cost: 10,
    prereqs: [],
    description: "Galleys can fish Fishing Shoal tiles for bonus Harvest and Coin.",
    effects: [{ type: "unlock_mechanic", mechanic: "fishing" }],
  },
  mining: {
    id: "mining", label: "Mining", category: "civic", layer: 0, cost: 10,
    prereqs: [],
    description: "Pioneers and Trackers can mine Gold Veins and Iron Veins for bonus Coin.",
    effects: [{ type: "unlock_mechanic", mechanic: "mining" }],
  },
  // costBreakdown (2026-08-17): moved here from pioneer_infrastructure,
  // which used to bundle wall_section's unlock_building effect alongside
  // its own Pioneer unlock -- same harvest/coin ratio preserved exactly so
  // a wall's actual build cost doesn't shift just from this split (see
  // buildings.js's buildingBuildCost, which reads whichever tech's
  // unlock_building effect names a given building).
  walls: {
    id: "walls", label: "Walls", category: "building", layer: 0, cost: 10,
    prereqs: [],
    description: "Unlocks the Wall Section, a defensive structure cities can build to protect themselves.",
    costBreakdown: { harvest: 2, coin: 3 },
    effects: [{ type: "unlock_building", building: "wall_section" }],
  },
  // Same universal, never-research-gated shape as walls above -- a Pioneer
  // adjacent to water gets the ring-menu action regardless of civ.unlocked-
  // Buildings (see buildings.js's header comment on wall_section for why);
  // only the bridge's cost model actually comes from this tech.
  bridges: {
    id: "bridges", label: "Bridges", category: "building", layer: 0, cost: 10,
    prereqs: [],
    description: "Unlocks the Bridge Section, letting Pioneers span water to connect otherwise-separated land.",
    costBreakdown: { harvest: 2, coin: 3 },
    effects: [{ type: "unlock_building", building: "bridge_section" }],
  },

  // --- Shared civic trunk: fallback for races not yet promoted to their own
  // civic column (currently only Undead -- Dwarf, Elf both got their own
  // bespoke civic columns). Excluded per-race once that race gets a bespoke
  // civic column (see excludedRaces). ---
  spoken_memory: {
    id: "spoken_memory", label: "Spoken Memory", category: "civic", layer: 1, cost: 10,
    prereqs: [], excludedRaces: ["human", "orc", "halfellow", "dwarf", "elf"],
    effects: [{ type: "civic_influence_bonus", value: 0.05 }],
  },
  the_long_telling: {
    id: "the_long_telling", label: "The Long Telling", category: "civic", layer: 2, cost: 30,
    prereqs: ["spoken_memory"], excludedRaces: ["human", "orc", "halfellow", "dwarf", "elf"],
    effects: [{ type: "civic_influence_bonus", value: 0.10 }],
  },
  wardstones: {
    id: "wardstones", label: "Wardstones", category: "civic", layer: 2, cost: 30,
    prereqs: ["spoken_memory"], excludedRaces: ["human", "orc", "halfellow", "dwarf", "elf"],
    effects: [{ type: "radius_bonus", value: 1 }],
  },
  bound_lore: {
    id: "bound_lore", label: "Bound Lore", category: "civic", layer: 3, cost: 60,
    prereqs: ["the_long_telling", "wardstones"], excludedRaces: ["human", "orc", "halfellow", "dwarf", "elf"],
    effects: [{ type: "civic_influence_bonus", value: 0.15 }, { type: "governance_unlock" }],
  },

  // =========================================================================
  // HUMAN -- full prototype tree, see tech_tree_design.md for the reviewed
  // design. Three columns: civic, building, military. Building starts at L2
  // (no L1 building). City gate: layer L needs >= L cities.
  // =========================================================================

  // --- Layer 1 ---
  spears_raised: {
    id: "spears_raised", label: "Spears Raised", category: "military", layer: 1, cost: 15,
    prereqs: [], raceOnly: "human",
    description: "Unlocks the Spearguard, a sturdy defender built to hold ground rather than strike hard.",
    costBreakdown: { lore: 11, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "spearguard" }],
  },
  // Moved L2 -> L1: a second Layer 1 military
  // choice alongside Spears Raised, per the file header's own "Military may
  // fork into two choices at a layer" rule. No prereq-chain risk -- archery
  // has no prereqs of its own, and every tech that depends on it (longbow/
  // catapult_engineering/ramparts) stays strictly later regardless of which
  // layer archery itself sits at.
  archery: {
    id: "archery", label: "Archery", category: "military", layer: 1, cost: 25,
    prereqs: [], raceOnly: "human",
    description: "Unlocks the Archer, a ranged attacker that strikes without exposing itself to a counterattack.",
    costBreakdown: { lore: 17, coin: 8 },
    effects: [{ type: "unlock_unit", unit: "archer" }],
  },
  spirit_of_exploration: {
    id: "spirit_of_exploration", label: "Spirit of Exploration", category: "civic", layer: 1, cost: 14,
    prereqs: [], raceOnly: "human",
    description: "Reduces the movement cost of Plains by 0.5. +0.1 lore per Plains tile under your influence.",
    costBreakdown: { lore: 14 },
    effects: [
      { type: "terrain_movement_discount", terrain: "plains", value: 0.5 },
      { type: "lore_per_influence_tile", terrain: "plains", value: 0.1 },
    ],
  },
  rivercraft: {
    id: "rivercraft", label: "Rivercraft", category: "civic", layer: 1, cost: 14,
    prereqs: [], raceOnly: "human",
    description: "Reduces the movement cost of River tiles by 0.5. +0.2 lore per River tile under your influence.",
    costBreakdown: { lore: 14 },
    // "river" is a pseudo-terrain key: rivers overlay any base terrain
    // (tile.hasRiver), so getMoveCost/landCostForTerrain check it separately
    // -- see ai.js. Same pseudo-terrain key reused by the
    // lore_per_influence_tile effect below -- see turns.js's beginCivTurn.
    effects: [
      { type: "terrain_movement_discount", terrain: "river", value: 0.5 },
      { type: "lore_per_influence_tile", terrain: "river", value: 0.2 },
    ],
  },
  homestead: {
    id: "homestead", label: "Homestead", category: "civic", layer: 1, cost: 20,
    prereqs: [], raceOnly: "human",
    description: "+0.25 harvest from Plains.",
    costBreakdown: { lore: 14, coin: 6 },
    effects: [{ type: "unlock_tile_bonus", terrain: "plains", bonus: { harvest: 0.25 } }],
  },
  // --- Layer 2 ---
  marketcraft: {
    id: "marketcraft", label: "Marketcraft", category: "building", layer: 1, cost: 20,
    prereqs: [], raceOnly: "human",
    description: "Unlocks the Bazaar. A city with a Bazaar can spend resources to Expedite Unit Build, cutting one turn off the unit it is currently building.",
    costBreakdown: { coin: 12, harvest: 8 },
    effects: [
      { type: "unlock_building", building: "bazaar" },
      { type: "unlock_mechanic", mechanic: "marketcraft" },
    ],
  },
  // Labeled "Ramparts!" (2026-08-24) rather than "Defend the Walls" like the
  // other three races' equivalents -- the name freed up by removing the old
  // Human Ramparts tech. Mechanic id stays defend_the_walls_human: it's
  // internal, and renaming it would strand the string in existing saves.
  human_defend_the_walls: {
    id: "human_defend_the_walls", label: "Ramparts!", category: "building", layer: 1, cost: 18,
    prereqs: [], raceOnly: "human",
    description: "50% chance each turn a Human wall attacks an enemy unit within range 1 for 2 attack.",
    costBreakdown: { coin: 12, lore: 6 },
    effects: [{ type: "unlock_mechanic", mechanic: "defend_the_walls_human" }],
  },
  // Absorbed "Longspear": that tech's own
  // effect (Spearguard +2 attack/+1 defense) is folded into this one's
  // effects array below, and the "longspear" tech id no longer exists --
  // nothing else in the codebase referenced it by id (no unit unlocks, no
  // other tech's prereqs), so removing it is a clean data-only cut.
  defense_of_the_kingdom: {
    id: "defense_of_the_kingdom", label: "Defense of the Kingdom", category: "military", layer: 2, cost: 22,
    prereqs: ["spears_raised"], raceOnly: "human",
    description: "Spearguard gains +5 defense while garrisoned in a city or on a building tile, plus +2 attack and +1 defense always.",
    costBreakdown: { lore: 22 },
    effects: [
      { type: "garrison_defense_bonus", unit: "spearguard", value: 5 },
      { type: "unit_stat_upgrade", unit: "spearguard", changes: { attack: 2, defense: 1 } },
    ],
  },
  cavalry_training: {
    id: "cavalry_training", label: "Cavalry Training", category: "military", layer: 2, cost: 25,
    prereqs: [], raceOnly: "human",
    description: "Unlocks the Cavalry, a fast-moving mounted unit for chasing down or outrunning the enemy.",
    costBreakdown: { lore: 17, harvest: 8 },
    effects: [{ type: "unlock_unit", unit: "cavalry" }],
  },
  trade_roads: {
    id: "trade_roads", label: "Trade Roads", category: "civic", layer: 2, cost: 40,
    prereqs: ["homestead"], raceOnly: "human",
    description: "+0.5 coin, +0.5 lore per road tile within a city's radius.",
    costBreakdown: { coin: 40 },
    effects: [{ type: "unlock_feature_bonus", feature: "road", bonus: { coin: 0.5, lore: 0.5 } }],
  },
  make_way: {
    id: "make_way", label: "Make Way", category: "civic", layer: 2, cost: 22,
    prereqs: ["rivercraft"], raceOnly: "human",
    description: "Galleys gain +2 movement and +1 vision.",
    costBreakdown: { coin: 14, lore: 8 },
    effects: [{ type: "unit_stat_upgrade", unit: "galley", changes: { movement: 2, visionRadius: 1 } }],
  },
  // Moved L3 -> L2, following archery down a
  // layer. Its own prereq (archery) is now L1, so the ordering stays sound.
  catapult_engineering: {
    id: "catapult_engineering", label: "Catapult Engineering", category: "military", layer: 2, cost: 40,
    prereqs: ["archery"], raceOnly: "human",
    description: "Unlocks the Catapult, a slow-moving siege engine built to break down walls and structures. A separate unit from Archer/Longbowman, not a replacement -- a civ can field both.",
    costBreakdown: { lore: 28, coin: 12 },
    effects: [{ type: "unlock_unit", unit: "catapult" }],
  },
  // 2026-08-24: the Human "Ramparts" tech stood here -- walls and cities
  // counterattacking with a resting unit's attack. Removed; the name was
  // reclaimed by human_defend_the_walls (now "Ramparts!"), and the
  // inherit-a-resting-unit's-attack idea now lives on Elf's Warden of the
  // Trees as a proactive wall shot instead. See combat.js's attackStructure.

  // --- Layer 3 ---
  guild_charter: {
    id: "guild_charter", label: "Guild Charter", category: "building", layer: 2, cost: 35,
    prereqs: [], raceOnly: "human", // only the L2 city-gate applies
    description: "Unlocks the Guild Hall. Every new unit built in a city with a Guild Hall receives a free level-up.",
    costBreakdown: { lore: 22, coin: 13 },
    effects: [{ type: "unlock_building", building: "guild_hall" }],
  },
  knighthood: {
    id: "knighthood", label: "Knighthood", category: "military", layer: 3, cost: 45,
    prereqs: ["cavalry_training"], raceOnly: "human",
    description: "Unlocks the Knight, a heavier mounted unit that replaces the Cavalry.",
    costBreakdown: { harvest: 20, lore: 15, coin: 10 },
    effects: [{ type: "replace_unit", from: "cavalry", to: "knight" }],
  },
  longbow: {
    id: "longbow", label: "Longbow", category: "military", layer: 3, cost: 40,
    prereqs: ["archery"], raceOnly: "human",
    description: "Unlocks the Longbowman, a stronger, longer-ranged replacement for the Archer.",
    costBreakdown: { lore: 28, coin: 12 },
    effects: [{ type: "replace_unit", from: "archer", to: "longbowman" }],
  },
  wizardry: {
    // Moved L3 -> L2. No prereq-chain risk: this
    // tech has no prereqs of its own, and every tech that depends on IT
    // (freezing_touch/flight at L3, dungeon_delve/mage_college_tech/
    // teleportation at L4) stays strictly later, so the chain is still
    // valid. `cost`/`costBreakdown` below are inert now (2026-08-04, see
    // GameData.effectiveTechCost) -- this tech's REAL Lore cost is purely
    // its layer, so the L3->L2 move alone already halves it (tierGrowth's
    // 2.0x per layer), plus the Wizard unit's own build-cost/upkeep layer
    // premiums (which key off this tech's layer too).
    id: "wizardry", label: "Wizardry", category: "mystic", layer: 2, cost: 45,
    prereqs: [], raceOnly: "human",
    description: "Unlocks the Wizard, a utility spellcaster that strikes from range.",
    costBreakdown: { lore: 32, coin: 13 },
    effects: [{ type: "unlock_unit", unit: "wizard" }],
  },
  // Moved L3 -> L2 and reworked from an active
  // targeted cast into a passive on-hit chance -- see
  // ai.js's considerAttackOrGarrison (Human "Freezing Touch" block, right
  // next to Fireball's burnChancePct trigger).
  //
  // Bugfix (2026-08-26): that ai.js block gates the whole roll behind
  // `civ.unlockedMechanics.has("freezing_touch")`, but this tech's only
  // effect was unit_stat_upgrade -- nothing ever added "freezing_touch" to
  // unlockedMechanics (that Set is populated exclusively by unlock_mechanic
  // effects, see tech.js's applyTechEffects). The +50% frozenChancePct WAS
  // being applied to the Wizard's stats correctly; the roll that would
  // actually spend it just never ran. Researching this tech had zero
  // gameplay effect. Added the missing unlock_mechanic effect below --
  // mechanic id matches the tech id, same as every other same-shaped tech
  // (poisonous_extracts, burn_it_all_down, first_frost_of_autumn all name
  // their own tech id as the mechanic they grant).
  freezing_touch: {
    id: "freezing_touch", label: "Freezing Touch", category: "mystic", layer: 2, cost: 42,
    prereqs: ["wizardry"], raceOnly: "human",
    description: "The Wizard's attacks gain +50% chance to inflict the Frozen condition.",
    costBreakdown: { lore: 30, coin: 12 },
    effects: [
      { type: "unit_stat_upgrade", unit: "wizard", changes: { frozenChancePct: 0.5 } },
      { type: "unlock_mechanic", mechanic: "freezing_touch" },
    ],
  },
  common_tongue: {
    id: "common_tongue", label: "Common Tongue", category: "civic", layer: 3, cost: 55,
    prereqs: ["trade_roads"], raceOnly: "human",
    description: "+3 lore per turn for each city owned.",
    costBreakdown: { lore: 55 },
    effects: [{ type: "lore_per_city", value: 3 }],
  },
  // New tech: the user's own request left this
  // tech unnamed ("HUMAN - CIVIC - L3: \"\""); "Sea Charts" was picked here
  // as a placeholder that fits the file's naming register and Make Way's own
  // travel/cartography flavor -- rename freely.
  sea_charts: {
    id: "sea_charts", label: "Sea Charts", category: "civic", layer: 3, cost: 45,
    prereqs: ["make_way"], raceOnly: "human",
    description: "All Ocean and Coast tiles anywhere on the map are always revealed -- no fog of war on those tiles at all. +0.1 lore per Ocean and Coast tile under your influence.",
    costBreakdown: { lore: 27, coin: 18 },
    // Same "unlock_mechanic" + turns.js hand-check pattern as Elf's Wind
    // From Distant Treetops and Dwarf's Mountains on the Horizon -- see
    // turns.js's refreshVisibility, which is where "sea_charts" is actually
    // read (there is no dedicated reveal-by-terrain effect type; every
    // terrain-reveal tech in the game goes through this same generic flag).
    // Two separate lore_per_influence_tile entries (not one effect with a
    // terrain list) -- every other tech-effect in this file targets exactly
    // one terrain per entry; see turns.js's beginCivTurn for where these are
    // totaled up each turn.
    effects: [
      { type: "unlock_mechanic", mechanic: "sea_charts" },
      { type: "lore_per_influence_tile", terrain: "ocean", value: 0.1 },
      { type: "lore_per_influence_tile", terrain: "coast", value: 0.1 },
    ],
  },
  flight: {
    id: "flight", label: "Flight", category: "mystic", layer: 3, cost: 60,
    prereqs: ["wizardry"], raceOnly: "human",
    description: "As an action (that consumes their turn), a Wizard may grant an adjacent allied unit the Flying property, along with +2 movement and +2 vision, for 5 turns.",
    costBreakdown: { lore: 42, coin: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "flight_grant" }],
  },

  // --- Layer 4 ---
  // dungeon_delve (Human-only, Wizard-gated) retired 2026-08-14, user-
  // directed -- see doc/world_encounters_design.md. Delving a Ruin is now
  // universal, shared Level 0 infrastructure (see ruin_delving above,
  // alongside pioneer_infrastructure/hunt_game/farm_soil): the mechanic id
  // "dungeon_delve" itself is UNCHANGED and still what orders.js/ai.js/
  // turns.js check via civ.unlockedMechanics.has("dungeon_delve") -- only
  // the tech that grants it, and which units/races can use it, changed.
  // 2026-08-24: the separate L4 "Mage Tower" tech that used to follow this
  // one was removed -- its effect is now intrinsic to the Mage College
  // building itself (see ai.js's tickMageTowerDefense), part of moving
  // buildings off economic yields and onto real game effects.
  mage_college_tech: {
    id: "mage_college_tech", label: "Mage College", category: "building", layer: 3, cost: 50,
    prereqs: ["wizardry"], raceOnly: "human",
    description: "Unlocks the Mage College. Each turn, a Mage College has a 75% chance to attack an enemy unit within range 5 for 3 attack.",
    costBreakdown: { lore: 35, coin: 15 },
    effects: [{ type: "unlock_building", building: "mage_college" }],
  },
  // Moved L4 -> L3, following catapult_engineering
  // down a layer. Its prereq is now L2, so the ordering stays sound.
  trebuchet_engineering: {
    id: "trebuchet_engineering", label: "Trebuchet Engineering", category: "military", layer: 3, cost: 55,
    prereqs: ["catapult_engineering"], raceOnly: "human",
    description: "Unlocks the Trebuchet, a heavier, harder-hitting siege engine that replaces the Catapult.",
    costBreakdown: { lore: 38, coin: 17 },
    effects: [{ type: "replace_unit", from: "catapult", to: "trebuchet" }],
  },
  battle_mage: {
    id: "battle_mage", label: "Battle Mage", category: "mystic", layer: 3, cost: 55,
    prereqs: ["mage_college_tech"], raceOnly: "human",
    // This used to raise the Wizard's firstStrikePct (0.50->0.75) -- Wizard
    // no longer has that property at all (its identity moved to `range`, see
    // units.js), so this now grants +1 Ranged (base 2 -> 3) instead, on top
    // of the existing attack/defense bump. range is additive here (see
    // combat.js's effectiveRange), same as attack/defense -- it adds to the
    // Wizard's base 2 rather than replacing it.
    description: "The Wizard grows more powerful in every way: greater range, attack, and defense.",
    costBreakdown: { lore: 40, coin: 15 },
    effects: [{ type: "unit_stat_upgrade", unit: "wizard", changes: { range: 1, attack: 3, defense: 3 } }],
  },
  teleportation: {
    id: "teleportation", label: "Teleportation", category: "mystic", layer: 4, cost: 60,
    prereqs: ["wizardry", "sea_charts"], raceOnly: "human",
    description: "As a full turn action, the wizard may instantly move itself or an adjacent friendly unit to any unoccupied tile the civ has ever explored. The teleported unit has a 50% chance to land Befuddled for 1 turn.",
    costBreakdown: { lore: 60, coin: 30 },
    effects: [{ type: "unlock_mechanic", mechanic: "teleportation" }],
  },
  chivalric_order: {
    id: "chivalric_order", label: "Chivalric Order", category: "military", layer: 4, cost: 55,
    prereqs: ["knighthood"], raceOnly: "human",
    description: "Unlocks the Paladin, a mighty holy warrior that replaces the Knight.",
    costBreakdown: { harvest: 22, lore: 20, coin: 13 },
    effects: [{ type: "replace_unit", from: "knight", to: "paladin" }],
  },

  // --- Layer 5 ---
  sovereign_power: {
    id: "sovereign_power", label: "Sovereign Power", category: "civic", layer: 5, cost: 100,
    prereqs: ["common_tongue"], raceOnly: "human",
    description: "+1 influence radius in every city.",
    costBreakdown: { lore: 60, coin: 25, harvest: 15 },
    effects: [{ type: "radius_bonus", value: 1 }],
  },
  palace_charter: {
    id: "palace_charter", label: "Palace Charter", category: "building", layer: 4, cost: 90,
    prereqs: ["chivalric_order"], raceOnly: "human",
    description: "Unlocks the Palace (+1 influence radius to the city it's built next to). Stacks with Sovereign Power on that city -- deliberately: Humans get an outsized late-game influence advantage on their capital.",
    costBreakdown: { harvest: 25, lore: 20, coin: 15 },
    effects: [{ type: "unlock_building", building: "palace" }],
  },
  // Moved L5 -> L3 -> L4 and reworked from automatic
  // splash-on-attack into a standalone targeted action -- see ai.js's
  // performWizardFireball/maybeFireballStrike. Ignite chance is now a fixed
  // 50% (FIREBALL_IGNITE_CHANCE in ai.js), not the Wizard's own
  // burnChancePct stat, so that effect was dropped from this tech's
  // unit_stat_upgrade below. Prereq (battle_mage) stays put regardless of
  // its own layer -- same "move the layer only" policy as Palace Charter/
  // Invisibility above (2026-08-19: battle_mage itself moved L4 -> L3 the
  // same day, which happens to resolve the L3-tech-gated-behind-an-L4-
  // prereq inversion this comment used to describe -- coincidental, not
  // the reason for either move).
  fireball: {
    id: "fireball", label: "Fireball!", category: "mystic", layer: 4, cost: 65,
    prereqs: ["battle_mage"], raceOnly: "human",
    description: "The wizard may target a tile within range. All units and structures on that tile, and adjacent to that tile, take damage and have a 50% chance to be set on fire (gain the burning condition).",
    costBreakdown: { lore: 65, coin: 30 },
    effects: [
      { type: "unit_stat_upgrade", unit: "wizard", changes: { siegePct: 0.75, attack: 3 } },
      { type: "unlock_mechanic", mechanic: "fireball_splash" },
    ],
  },
  invulnerability: {
    id: "invulnerability", label: "Invulnerability", category: "mystic", layer: 5, cost: 60,
    prereqs: ["battle_mage"], raceOnly: "human",
    description: "The Wizard has a 33% chance to negate all damage from both incoming attacks and counterattacks.",
    costBreakdown: { lore: 60, coin: 30 },
    effects: [{ type: "unlock_mechanic", mechanic: "invulnerability_chance", value: 0.33 }],
  },
  // Moved L5 -> L2. Prereq battle_mage removed
  // -- no longer gated behind it now that
  // Invisibility sits well below Battle Mage's own L4.
  invisibility: {
    id: "invisibility", label: "Invisibility", category: "mystic", layer: 2, cost: 60,
    prereqs: [], raceOnly: "human",
    description: "The Wizard may spend an action to turn Hidden for 3 turns.",
    costBreakdown: { lore: 40, coin: 20 },
    effects: [{ type: "unlock_mechanic", mechanic: "invisibility" }],
  },
  crusade: {
    id: "crusade", label: "Crusade", category: "military", layer: 5, cost: 90,
    prereqs: ["chivalric_order", "sovereign_power"], raceOnly: "human",
    description: "The Paladin exudes a holy aura: in a 1-tile radius around itself (including itself), allied units heal 10% of their HP (minimum 1) per turn regardless of whether they're resting, and gain +2 attack, +1 defense, and +25% siege.",
    costBreakdown: { lore: 55, coin: 20, harvest: 15 },
    effects: [{ type: "unlock_mechanic", mechanic: "crusade" }],
  },

  // =========================================================================
  // ELF -- full designed tree (user-authored, see doc/tech tree - elf.txt for
  // the source review). Three throughlines: Forest as the racial terrain
  // (movement/harvest/lore/defense/permanent reveal, mirroring Dwarf's
  // Mountain identity), a Hidden-based ranged-ambush kit built on the shared
  // "sneaking_around" mechanic (ranged Ranger kites hide-shoot-hide; melee
  // Blade Dancer ambushes like Halfellow), and a Druid who fields its own
  // mini-roster (Raptor scout, Shadowsteed carrier) via a bespoke unit-builds-
  // a-unit mechanic instead of city production -- see ai.js's
  // maybeElfDruidPlay/progressDruidSummon. City gate: layer L needs >= L
  // cities.
  // =========================================================================

  // --- Civic ---
  elf_home_in_the_trees: {
    id: "elf_home_in_the_trees", label: "Home in the Trees", category: "civic", layer: 1, cost: 12,
    prereqs: [], raceOnly: "elf",
    description: "Reduces the movement cost of Forest by 0.5.",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_discount", terrain: "forest", value: 0.5 }],
  },
  elf_nature_provides: {
    id: "elf_nature_provides", label: "Nature Provides", category: "civic", layer: 1, cost: 18,
    prereqs: [], raceOnly: "elf",
    description: "+0.25 harvest from Forest.",
    costBreakdown: { lore: 12, coin: 6 },
    effects: [{ type: "unlock_tile_bonus", terrain: "forest", bonus: { harvest: 0.25 } }],
  },
  elf_murmuring_of_leaves: {
    id: "elf_murmuring_of_leaves", label: "The Murmuring of Leaves", category: "civic", layer: 1, cost: 16,
    prereqs: [], raceOnly: "elf",
    description: "+0.3 lore from Forest.",
    costBreakdown: { lore: 16 },
    effects: [{ type: "unlock_tile_bonus", terrain: "forest", bonus: { lore: 0.3 } }],
  },
  // Halves the flat RESOURCE_EXHAUSTION_CHANCE (5%->2%) for this civ's
  // Ruin/Gold Vein/Iron Vein/Fish Shoal/Game/Fertile Soil channels -- see
  // turns.js's resourceExhaustionChanceFor.
  elf_tending_to_the_earth: {
    id: "elf_tending_to_the_earth", label: "Tending to the Earth", category: "civic", layer: 1, cost: 18,
    prereqs: [], raceOnly: "elf",
    description: "Any resource gathering activity only has a 2% chance per turn to exhaust the resource, not the normal 5%.",
    costBreakdown: { lore: 12, coin: 6 },
    effects: [{ type: "unlock_mechanic", mechanic: "tending_to_the_earth" }],
  },
  elf_whispering_waters: {
    id: "elf_whispering_waters", label: "Whispering Waters", category: "civic", layer: 2, cost: 20,
    prereqs: [], raceOnly: "elf",
    description: "+0.3 lore from river.",
    costBreakdown: { lore: 14, coin: 6 },
    effects: [{ type: "unlock_feature_bonus", feature: "river", bonus: { lore: 0.3 } }],
  },
  elf_longstrider: {
    id: "elf_longstrider", label: "Longstrider", category: "civic", layer: 2, cost: 20,
    prereqs: [], raceOnly: "elf",
    description: "Reduces the movement cost of Plains by 0.5.",
    costBreakdown: { lore: 20 },
    effects: [{ type: "terrain_movement_discount", terrain: "plains", value: 0.5 }],
  },
  elf_gems_of_starlight: {
    id: "elf_gems_of_starlight", label: "Gems of Starlight", category: "civic", layer: 3, cost: 30,
    prereqs: ["elf_silverleaf_atelier"], raceOnly: "elf",
    description: "+0.25 coin from Mountains.",
    costBreakdown: { coin: 20, lore: 10 },
    effects: [{ type: "unlock_tile_bonus", terrain: "mountains", bonus: { coin: 0.25 } }],
  },
  elf_wind_from_distant_treetops: {
    id: "elf_wind_from_distant_treetops", label: "Wind From Distant Treetops", category: "civic", layer: 4, cost: 50,
    prereqs: ["elf_murmuring_of_leaves"], raceOnly: "elf",
    description: "All Forest tiles anywhere on the map are always revealed -- no fog of war on Forest at all.",
    costBreakdown: { lore: 32, coin: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "wind_from_distant_treetops" }],
  },
  // 2026-08-24: "Vision Beyond Sight" (L5, +1 vision to the whole Elf
  // roster) was removed. Elf units keep their base vision -- the bonus is
  // simply gone, user-directed. It was also a prereq of Upon the Wind, which
  // now depends on Hunter's Soul alone.

  // --- Building ---
  elf_aelderwatch: {
    id: "elf_aelderwatch", label: "Aelderwatch", category: "building", layer: 1, cost: 20,
    prereqs: [], raceOnly: "elf",
    description: "Unlocks the Treetop Watch. The city this building is adjacent to gains +4 vision radius.",
    costBreakdown: { coin: 12, lore: 8 },
    effects: [{ type: "unlock_building", building: "treetop_watch" }],
  },
  elf_treetop_snipers: {
    id: "elf_treetop_snipers", label: "Treetop Snipers", category: "building", layer: 1, cost: 40,
    prereqs: ["elf_aelderwatch", "elf_watching_hunting"], raceOnly: "elf",
    description: "50% chance each turn an elf wall attacks an enemy unit within range 2 for 2 attack.",
    costBreakdown: { coin: 24, lore: 16 },
    effects: [{ type: "unlock_mechanic", mechanic: "treetop_snipers" }],
  },
  // Replaced "Long Range Snipers" (2026-08-24), which was just a longer-
  // ranged wall-defense tier. Warden of the Trees is not a tier at all: it
  // leaves the walls' reach at Treetop Snipers' range 2 and instead lends
  // them a resting woodland fighter's own attack and on-hit properties.
  // See ai.js's tickWallDefense / WARDEN_UNIT_TYPES.
  elf_warden_of_the_trees: {
    id: "elf_warden_of_the_trees", label: "Warden of the Trees", category: "building", layer: 3, cost: 45,
    prereqs: ["elf_treetop_snipers"], raceOnly: "elf",
    description: "While a Tracker, Ranger, Blade Dancer, or Druid is Resting and Defending in this city, its walls attack with that unit's attack strength and gain its attack properties (chance to poison, chance to freeze, Double Strike).",
    costBreakdown: { coin: 27, lore: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "warden_of_the_trees" }],
  },
  // Moved L3 -> L2. Prereq elf_gems_of_starlight
  // (L3) stays put -- one-layer inversion, same policy as above.
  elf_silverleaf_atelier: {
    id: "elf_silverleaf_atelier", label: "Silverleaf Atelier", category: "building", layer: 2, cost: 35,
    prereqs: [], raceOnly: "elf",
    description: "Unlocks the Silverleaf Atelier. Units trained in this city are armored in elven silversteel: +1 defense, permanently.",
    costBreakdown: { coin: 20, lore: 15 },
    effects: [{ type: "unlock_building", building: "silverleaf_atelier" }],
  },
  elf_altar_of_ages: {
    id: "elf_altar_of_ages", label: "Altar of Ages", category: "building", layer: 3, cost: 50,
    prereqs: ["elf_druidism"], raceOnly: "elf",
    description: "Unlocks the Altar of Ages. All elf units created in this city gain an extra 25% XP.",
    costBreakdown: { lore: 32, coin: 18 },
    effects: [
      { type: "unlock_building", building: "altar_of_ages" },
      { type: "unlock_mechanic", mechanic: "altar_of_ages", value: 0.25 },
    ],
  },
  elf_wellspring_grove: {
    id: "elf_wellspring_grove", label: "Wellspring Grove", category: "building", layer: 4, cost: 90,
    prereqs: ["elf_murmuring_of_leaves", "elf_whispering_waters"], raceOnly: "elf",
    description: "Unlocks the Wellspring Grove. All elf units, walls, and buildings within this city's radius heal 5% health per turn (minimum 1 HP), regardless of whether they're resting.",
    costBreakdown: { coin: 35, lore: 35, harvest: 20 },
    effects: [
      { type: "unlock_building", building: "wellspring_grove" },
      { type: "unlock_mechanic", mechanic: "wellspring_grove" },
    ],
  },

  // --- Military ---
  elf_watching_hunting: {
    id: "elf_watching_hunting", label: "Watching, Hunting", category: "military", layer: 1, cost: 15,
    prereqs: [], raceOnly: "elf",
    description: "Unlocks the Ranger, a ranged skirmisher with a chance to strike before its target can react. Granted free at civ creation, same as every other race's basic unit.",
    costBreakdown: { lore: 11, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "ranger" }],
  },
  elf_wind_and_flashing_steel: {
    id: "elf_wind_and_flashing_steel", label: "Wind and Flashing Steel", category: "military", layer: 1, cost: 16,
    prereqs: [], raceOnly: "elf",
    description: "Unlocks the Blade Dancer, a melee duelist with a chance to strike before its target can react.",
    costBreakdown: { lore: 12, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "blade_dancer" }],
  },
  // A normal action (move, then optionally act), same category as an
  // ordinary Attack, not a full-turn action. See ai.js's performBladeSweep
  // for the
  // shared implementation and combat.js's resolveRound for the
  // attackDamageMult/counterDamageMult context both this and Blade Storm rely on.
  elf_whirlwind_strike: {
    id: "elf_whirlwind_strike", label: "Whirlwind Strike", category: "military", layer: 2, cost: 45,
    prereqs: ["elf_wind_and_flashing_steel"], raceOnly: "elf",
    description: "As a normal action, the Blade Dancer attacks every enemy unit within 1 tile of itself, each hit dealing 75% damage (as if attacking normally). Each target may counterattack, at 37.5% effectiveness.",
    costBreakdown: { lore: 30, coin: 15 },
    effects: [{ type: "unlock_mechanic", mechanic: "whirlwind_strike" }],
  },
  // Does NOT replace Whirlwind Strike -- both
  // mechanics stay independently usable; the AI picks whichever suits the
  // current cluster of targets (see ai.js's maybeBladeDancerSweep).
  elf_blade_storm: {
    id: "elf_blade_storm", label: "Blade Storm", category: "military", layer: 3, cost: 55,
    prereqs: ["elf_whirlwind_strike"], raceOnly: "elf",
    description: "Does not replace Whirlwind Strike. As a normal action, the Blade Dancer attacks every enemy unit within 2 tiles of itself, each hit dealing 50% damage (as if attacking normally). Only targets adjacent to the Blade Dancer may counterattack, at 25% effectiveness.",
    costBreakdown: { lore: 35, coin: 20 },
    effects: [{ type: "unlock_mechanic", mechanic: "blade_storm" }],
  },
  elf_shadowed_hush_unseen: {
    id: "elf_shadowed_hush_unseen", label: "Shadowed Hush, Unseen", category: "military", layer: 1, cost: 25,
    prereqs: [], raceOnly: "elf",
    description: "Every elf unit may spend its whole turn to become Hidden for 3 turns (voluntarily cancellable early). Cannot activate with an enemy unit on an adjacent tile. Whenever a Hidden unit is revealed for any reason, it is forced visible for at least 1 turn before it can go Hidden again.",
    costBreakdown: { lore: 16, coin: 9 },
    // Shares Halfellow's "sneaking_around" mechanic id -- the Hidden system
    // (combat.js's canGoHidden/enterHidden/revealHidden) is already fully
    // race-agnostic, so a second race unlocking the identical capability
    // reuses the same flag rather than duplicating it under a new name.
    effects: [{ type: "unlock_mechanic", mechanic: "sneaking_around" }],
  },
  // 2026-08-24: the L2 "Strike from the Shadows" (+50% attack while Hidden)
  // was removed and the two-step progression collapsed into one. The former
  // "Sudden Doom" below now carries this name and grants the full +100% /
  // +10% First Strike outright.
  elf_druidism: {
    id: "elf_druidism", label: "Druidism", category: "mystic", layer: 2, cost: 32,
    prereqs: ["elf_murmuring_of_leaves", "elf_whispering_waters"], raceOnly: "elf",
    description: "Unlocks the Druid, a utility spellcaster who may also found cities, in addition to the normal Pioneer.",
    costBreakdown: { lore: 22, coin: 10 },
    effects: [{ type: "unlock_unit", unit: "druid" }],
  },
  elf_air_beneath_eyes_above: {
    id: "elf_air_beneath_eyes_above", label: "Air Beneath, Eyes Above", category: "mystic", layer: 2, cost: 34,
    prereqs: ["elf_druidism"], raceOnly: "elf",
    description: "The Druid may instantly summon a Raptor to assist elven allies, appearing on an open adjacent tile. Cities cannot build Raptor units.",
    costBreakdown: { lore: 22, coin: 12 },
    // unlock_unit registers "raptor" with techForUnit (so unitBuildCost can
    // derive its resource split from this tech's costBreakdown) even though
    // no CITY can ever actually build one -- see units.js's cityBuildable:
    // false and ai.js's unlockedMilitary filter, which strips it back out of
    // every city build-menu scoring pass. Only the Druid's own summon action
    // (ai.js's maybeElfDruidPlay/startDruidSummon) ever spends this.
    effects: [
      { type: "unlock_unit", unit: "raptor" },
      { type: "unlock_mechanic", mechanic: "raptor_summon" },
    ],
  },
  elf_beast_sight: {
    id: "elf_beast_sight", label: "Beast Sight", category: "mystic", layer: 3, cost: 40,
    prereqs: ["elf_air_beneath_eyes_above"], raceOnly: "elf",
    description: "Drawing upon their connection to nature, the elves gain all wandering monsters' vision, allowing them to see what those units can see.",
    costBreakdown: { lore: 27, coin: 13 },
    effects: [{ type: "unlock_mechanic", mechanic: "beast_sight" }],
  },
  elf_first_frost_of_autumn: {
    id: "elf_first_frost_of_autumn", label: "First Frost of Autumn", category: "military", layer: 2, cost: 30,
    prereqs: [], raceOnly: "elf",
    description: "Elf unit attacks have a 10% chance to inflict the Frozen condition on the target (0 movement, -25% attack, for a few turns).",
    costBreakdown: { lore: 20, coin: 10 },
    // frozenChancePct: chance to inflict Frozen
    // now lives as a per-unit data field, same convention as siegePct/
    // doubleStrikePct, instead of ai.js's hardcoded FIRST_FROST_CHANCE
    // constant -- see applyElfCombatMechanics. 0.10 on every elf combat
    // unit preserves this tech's existing civ-wide 10% exactly.
    effects: [
      { type: "unit_stat_upgrade", unit: "ranger", changes: { frozenChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "blade_dancer", changes: { frozenChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "druid", changes: { frozenChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "raptor", changes: { frozenChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "shadowsteed", changes: { frozenChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "awakened_oak", changes: { frozenChancePct: 0.10 } },
      { type: "unlock_mechanic", mechanic: "first_frost_of_autumn" },
    ],
  },
  // Same shape as elf_first_frost_of_autumn --
  // poisonChancePct is a per-unit data field (see ai.js's applyPoisoned/
  // baseMonster.poisonChancePct on Marsh Adder), not a hardcoded constant.
  elf_poisonous_extracts: {
    id: "elf_poisonous_extracts", label: "Poisonous Extracts", category: "military", layer: 3, cost: 34,
    prereqs: [], raceOnly: "elf",
    description: "Elf unit attacks have a 10% chance to inflict the Poison condition on the target.",
    costBreakdown: { lore: 22, coin: 12 },
    effects: [
      { type: "unit_stat_upgrade", unit: "ranger", changes: { poisonChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "blade_dancer", changes: { poisonChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "druid", changes: { poisonChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "raptor", changes: { poisonChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "shadowsteed", changes: { poisonChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "awakened_oak", changes: { poisonChancePct: 0.10 } },
      { type: "unlock_mechanic", mechanic: "poisonous_extracts" },
    ],
  },
  elf_hunters_soul: {
    id: "elf_hunters_soul", label: "Hunter's Soul", category: "military", layer: 2, cost: 38,
    prereqs: ["elf_watching_hunting"], raceOnly: "elf",
    description: "Rangers gain +1 range and 25% Double Strike.",
    costBreakdown: { lore: 24, coin: 14 },
    effects: [{ type: "unit_stat_upgrade", unit: "ranger", changes: { range: 1, doubleStrikePct: 0.25 } }],
  },
  elf_natures_grace: {
    id: "elf_natures_grace", label: "Nature's Grace", category: "mystic", layer: 3, cost: 36,
    prereqs: ["elf_druidism", "elf_nature_provides"], raceOnly: "elf",
    description: "The Druid may use this action (costs its whole turn, no exhaustion afterward) to restore between 30% and 60% (random) health to an ally unit within its own range (not just adjacent).",
    costBreakdown: { lore: 24, harvest: 12 },
    effects: [{ type: "unlock_mechanic", mechanic: "natures_grace" }],
  },
  elf_steely_eyed: {
    id: "elf_steely_eyed", label: "Steely Eyed", category: "military", layer: 3, cost: 34,
    prereqs: [], raceOnly: "elf",
    description: "All elf units gain +1 vision.",
    costBreakdown: { lore: 34 },
    effects: [
      { type: "unit_stat_upgrade", unit: "ranger", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "blade_dancer", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "druid", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "raptor", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "shadowsteed", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "awakened_oak", changes: { visionRadius: 1 } },
    ],
  },
  // Was "Sudden Doom" until 2026-08-24, when the L2 tech it used to upgrade
  // was removed and this inherited its name. Mechanic id stays sudden_doom:
  // it's internal, and renaming it would strand the string in existing
  // saves' unlockedMechanics (same reasoning as human_defend_the_walls).
  // Prereq re-pointed to elf_shadowed_hush_unseen, the deleted tech's own
  // prereq, so the stealth line stays connected instead of dead-ending.
  elf_sudden_doom: {
    id: "elf_sudden_doom", label: "Strike from the Shadows", category: "military", layer: 3, cost: 50,
    prereqs: ["elf_shadowed_hush_unseen"], raceOnly: "elf",
    description: "While Hidden, an elf unit gains +100% bonus to attack score and +10% First Strike. Attacking uses these bonuses, then ends Hidden as normal.",
    costBreakdown: { lore: 50 },
    effects: [{ type: "unlock_mechanic", mechanic: "sudden_doom" }],
  },
  elf_silverlight_steel: {
    id: "elf_silverlight_steel", label: "Silverlight Steel", category: "military", layer: 3, cost: 40,
    prereqs: ["elf_silverleaf_atelier"], raceOnly: "elf",
    description: "Blade Dancers gain 20% Double Strike and 5% First Strike.",
    costBreakdown: { coin: 22, lore: 18 },
    effects: [{ type: "unit_stat_upgrade", unit: "blade_dancer", changes: { doubleStrikePct: 0.20, firstStrikePct: 0.05 } }],
  },
  elf_roots_of_the_world: {
    id: "elf_roots_of_the_world", label: "Roots of the World", category: "mystic", layer: 3, cost: 45,
    prereqs: ["elf_druidism"], raceOnly: "elf",
    description: "As a full turn action, the druid may instantly move itself or an adjacent friendly unit to any unoccupied forest tile the civ has ever explored.",
    costBreakdown: { lore: 45 },
    effects: [{ type: "unlock_mechanic", mechanic: "roots_of_the_world" }],
  },
  elf_quick_as_a_shadow: {
    id: "elf_quick_as_a_shadow", label: "Quick as a Shadow", category: "military", layer: 4, cost: 50,
    // Re-pointed 2026-08-24 from the removed L2 elf_strike_from_the_shadows
    // to elf_sudden_doom (L3, now labeled "Strike from the Shadows") --
    // keeps this L4 tech downstream of the stealth-attack line rather than
    // jumping straight from the L1 Shadowed Hush, Unseen.
    prereqs: ["elf_sudden_doom"], raceOnly: "elf",
    description: "A Hidden elf unit can move at full speed, unlike most Hidden units.",
    costBreakdown: { lore: 50 },
    effects: [{ type: "unlock_mechanic", mechanic: "quick_as_a_shadow" }],
  },
  elf_sanctuary_under_green_boughs: {
    id: "elf_sanctuary_under_green_boughs", label: "Sanctuary under Green Boughs", category: "military", layer: 4, cost: 48,
    prereqs: [], raceOnly: "elf",
    description: "All elves gain +20% defense when in Forest.",
    costBreakdown: { lore: 30, harvest: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "sanctuary_under_green_boughs" }],
  },
  elf_shadowsteed: {
    id: "elf_shadowsteed", label: "Shadowsteed", category: "mystic", layer: 5, cost: 95,
    prereqs: ["elf_air_beneath_eyes_above", "elf_quick_as_a_shadow"], raceOnly: "elf",
    description: "The Druid may instantly summon a Shadowsteed, a flying horse made of shadow, the same way it summons a Raptor: appearing on an open adjacent tile. It cannot carry an Awakened Oak, a Raptor, or a Galley. While carrying another unit, it takes on that unit's range, attack, defense, siege, and First Strike (keeping its own First Strike if higher), then adds its own bonuses on top. Cities cannot build Shadowsteed units directly.",
    costBreakdown: { lore: 55, coin: 25, harvest: 15 },
    effects: [
      { type: "unlock_unit", unit: "shadowsteed" },
      { type: "unlock_mechanic", mechanic: "shadow_steed_summon" },
    ],
  },
  // Unlocks "dire_bear" via unlock_unit purely for cost/tech-layer lookup
  // purposes (unitBuildCost/unitMaxHP), same convention as Raptor/
  // Shadowsteed -- cityBuildable: false (units.js) strips it back out of
  // every build menu regardless; the ONLY way to ever field one is an
  // existing Druid transforming in place (see ai.js's
  // performDireBearTransform/maybeElfDruidPlay and orders.js's
  // contextMenuOptions "direBearForm" pill).
  elf_natures_fury: {
    id: "elf_natures_fury", label: "Nature's Fury", category: "mystic", layer: 5, cost: 95,
    prereqs: ["elf_sanctuary_under_green_boughs", "elf_beast_sight"], raceOnly: "elf",
    description: "The Druid may embrace the power of nature and become a Dire Bear (a full-turn action), trading its healing/summoning/city-founding kit for a hulking combat form -- same name, same veteran bonuses, HP carried over as a percentage of max HP. A Dire Bear may likewise spend a full turn to revert to Druid form. Neither form can be built by cities or summoned; a Dire Bear also still counts as a Druid for the purposes of the civ's Raptor/Shadowsteed summon capacity.",
    costBreakdown: { lore: 55, coin: 25, harvest: 15 },
    effects: [
      { type: "unlock_unit", unit: "dire_bear" },
      { type: "unlock_mechanic", mechanic: "natures_fury" },
    ],
  },
  elf_the_living_forest: {
    id: "elf_the_living_forest", label: "The Living Forest", category: "mystic", layer: 4, cost: 95,
    prereqs: ["elf_druidism", "elf_sanctuary_under_green_boughs"], raceOnly: "elf",
    description: "Unlocks the Awakened Oak, a living, walking tree and the elves' own siege unit -- rare, but meant to be fielded in numbers rather than as a single centerpiece.",
    costBreakdown: { harvest: 30, lore: 40, coin: 20 },
    effects: [{ type: "unlock_unit", unit: "awakened_oak" }],
  },
  elf_upon_the_wind: {
    id: "elf_upon_the_wind", label: "Upon the Wind", category: "military", layer: 5, cost: 90,
    prereqs: ["elf_hunters_soul"], raceOnly: "elf", // elf_vision_beyond_sight removed 2026-08-24
    description: "All Ranger and Blade Dancer units gain 40% Double Strike. Ranger units gain +1 range while being carried (by a Shadowsteed).",
    costBreakdown: { lore: 55, coin: 20, harvest: 15 },
    effects: [
      { type: "unit_stat_upgrade", unit: "ranger", changes: { doubleStrikePct: 0.40 } },
      { type: "unit_stat_upgrade", unit: "blade_dancer", changes: { doubleStrikePct: 0.40 } },
      { type: "unlock_mechanic", mechanic: "upon_the_wind" },
    ],
  },

  // =========================================================================
  // DWARF -- full tree (replaces the old 3-stub military column and the
  // shared-trunk civic fallback). Design pillars: mountain/hills mastery,
  // the Book of Grudges (never forgive, never forget), magic as
  // craft-imbuement, and "few strong holds, deepened not widened" -- no
  // cavalry, ever, and no +1-radius capstone. See project_dwarf_tech_tree
  // memory for the full review history. City gate: layer L needs >= L cities.
  // =========================================================================

  // --- Civic ---
  dwarf_stonecunning: {
    id: "dwarf_stonecunning", label: "Stonecunning", category: "civic", layer: 1, cost: 14,
    prereqs: [], raceOnly: "dwarf",
    description: "Dwarves read stone like a map: ignores Hills movement penalty and tunnels through Mountains. Dwarves still cannot build cities, buildings, or walls on Mountains.",
    costBreakdown: { coin: 9, lore: 5 },
    effects: [
      { type: "ignore_terrain_penalty", terrain: "hills" },
      { type: "unlock_mountain_tunneling" },
    ],
  },
  dwarf_wealth_of_the_earth: {
    id: "dwarf_wealth_of_the_earth", label: "Wealth of the Earth", category: "civic", layer: 1, cost: 16,
    prereqs: [], raceOnly: "dwarf",
    description: "+0.25 coin from Mountains.",
    costBreakdown: { coin: 10, lore: 6 },
    effects: [{ type: "unlock_tile_bonus", terrain: "mountains", bonus: { coin: 0.25 } }],
  },
  dwarf_imported_goods: {
    id: "dwarf_imported_goods", label: "Imported Goods", category: "civic", layer: 2, cost: 28,
    prereqs: [], raceOnly: "dwarf",
    description: "+0.5 harvest, +0.25 lore per road tile within a city's radius.",
    costBreakdown: { coin: 18, lore: 10 },
    effects: [{ type: "unlock_feature_bonus", feature: "road", bonus: { harvest: 0.5, lore: 0.25 } }],
  },
  dwarf_dwarven_mining: {
    id: "dwarf_dwarven_mining", label: "Dwarven Mining", category: "civic", layer: 1, cost: 16,
    prereqs: [], raceOnly: "dwarf",
    description: "Any Dwarf unit, not just Pioneers and Trackers, can mine Gold Veins and Iron Veins.",
    costBreakdown: { coin: 10, lore: 6 },
    effects: [{ type: "unlock_mechanic", mechanic: "dwarven_mining" }],
  },
  dwarf_quarry: {
    id: "dwarf_quarry", label: "Quarry", category: "civic", layer: 1, cost: 20,
    prereqs: ["dwarf_stonecunning"], raceOnly: "dwarf",
    description: "+0.25 coin from Hills.",
    costBreakdown: { coin: 13, lore: 7 },
    effects: [{ type: "unlock_tile_bonus", terrain: "hills", bonus: { coin: 0.25 } }],
  },
  dwarf_deep_lore: {
    id: "dwarf_deep_lore", label: "Deep Lore", category: "mystic", layer: 1, cost: 20,
    prereqs: ["dwarf_stonecunning"], raceOnly: "dwarf",
    description: "+0.3 lore from Mountains.",
    costBreakdown: { lore: 12, coin: 8 },
    effects: [{ type: "unlock_tile_bonus", terrain: "mountains", bonus: { lore: 0.3 } }],
  },
  dwarf_mountains_on_the_horizon: {
    id: "dwarf_mountains_on_the_horizon", label: "Mountains on the Horizon", category: "civic", layer: 2, cost: 20,
    prereqs: ["dwarf_stonecunning"], raceOnly: "dwarf",
    description: "All Mountain tiles anywhere on the map, as well as Hill tiles immediately adjacent to a Mountain tile, are always revealed -- no fog of war on those tiles at all.",
    costBreakdown: { lore: 12, coin: 8 },
    effects: [{ type: "unlock_mechanic", mechanic: "mountains_on_the_horizon" }],
  },
  // No explicit prereq requested -- same "just the layer gate" default as
  // several other L3 Dwarf techs with no natural single prerequisite (e.g.
  // dwarf_stonebreaker).
  dwarf_passages_in_stone: {
    id: "dwarf_passages_in_stone", label: "Passages in Stone", category: "civic", layer: 3, cost: 40,
    prereqs: [], raceOnly: "dwarf",
    description: "All Caves, and the area in a radius of 2 around those caves, are always revealed -- no fog of war on those tiles at all.",
    costBreakdown: { lore: 24, coin: 16 },
    effects: [{ type: "unlock_mechanic", mechanic: "passages_in_stone" }],
  },
  dwarf_prospectors_claim: {
    id: "dwarf_prospectors_claim", label: "Prospector's Claim", category: "civic", layer: 2, cost: 26,
    prereqs: ["dwarf_dwarven_mining"], raceOnly: "dwarf",
    description: "Increases resources earned from mining Gold or Iron by 100%.",
    costBreakdown: { coin: 17, lore: 9 },
    effects: [{ type: "unlock_mechanic", mechanic: "prospectors_claim_yield", value: 1.0 }],
  },
  dwarf_chronicle_in_stone: {
    id: "dwarf_chronicle_in_stone", label: "Chronicle in Stone", category: "civic", layer: 3, cost: 36,
    prereqs: ["dwarf_deep_lore"], raceOnly: "dwarf",
    description: "+3 lore per building constructed in a city (walls don't count).",
    costBreakdown: { coin: 20, lore: 16 },
    effects: [{ type: "building_count_bonus", bonus: { lore: 3 } }],
  },
  dwarf_the_long_reckoning: {
    id: "dwarf_the_long_reckoning", label: "The Long Reckoning", category: "civic", layer: 3, cost: 42,
    prereqs: ["dwarf_chronicle_in_stone"], raceOnly: "dwarf",
    description: "Dwarves do not forgive. If an enemy civ ever destroys one of this civ's cities or buildings (not walls), that civ is permanently marked as a rival: this civ's units gain +25% attack against that specific civ's units, cities, and structures forever after (tracked per-enemy-civ, never expires, does not require the mark-holder to still be alive).",
    costBreakdown: { coin: 24, lore: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "the_long_reckoning" }],
  },
  dwarf_runeforged_tools: {
    id: "dwarf_runeforged_tools", label: "Runeforged Tools", category: "civic", layer: 4, cost: 50,
    prereqs: ["dwarf_runecraft"], raceOnly: "dwarf",
    description: "Dwarf units gain an extra +25% XP whenever they earn XP.",
    costBreakdown: { coin: 32, lore: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "runeforged_tools", value: 0.25 }],
  },
  dwarf_the_deep_mines: {
    id: "dwarf_the_deep_mines", label: "The Deep Mines", category: "civic", layer: 3, cost: 42,
    prereqs: ["dwarf_prospectors_claim"], raceOnly: "dwarf",
    description: "Increases resources earned from mining Gold or Iron by 200%.",
    costBreakdown: { coin: 27, lore: 15 },
    effects: [{ type: "unlock_mechanic", mechanic: "deep_mines_yield", value: 2.0 }],
  },
  dwarf_council_of_the_deep: {
    id: "dwarf_council_of_the_deep", label: "Council of the Deep", category: "civic", layer: 5, cost: 95,
    prereqs: ["dwarf_chronicle_in_stone", "dwarf_meeting_of_the_clans"], raceOnly: "dwarf",
    description: "Dwarven influence counts as 1.25 tiles of influence, in terms of map-filled-in toward the territorial victory condition. Deliberately NOT a +1 radius bonus like Human/Halfellow's capstone -- Dwarves deepen what they hold rather than spreading wider.",
    costBreakdown: { coin: 55, lore: 30, harvest: 10 },
    effects: [{ type: "unlock_mechanic", mechanic: "council_of_the_deep" }],
  },

  // --- Building ---
  dwarf_forgecraft: {
    id: "dwarf_forgecraft", label: "Forgecraft", category: "building", layer: 1, cost: 22,
    prereqs: [], raceOnly: "dwarf",
    description: "Unlocks the Deep Forge. Units trained in this city carry forge-worked arms: +1 attack, permanently.",
    costBreakdown: { coin: 16, lore: 6 },
    effects: [{ type: "unlock_building", building: "deep_forge" }],
  },
  dwarf_meeting_of_the_clans: {
    id: "dwarf_meeting_of_the_clans", label: "Meeting of the Clans", category: "building", layer: 3, cost: 36,
    prereqs: ["dwarf_imported_goods"], raceOnly: "dwarf",
    description: "Unlocks the Great Hall. All Dwarf units Resting and Defending on any of this kingdom's cities, buildings, or walls defend at +50%.",
    costBreakdown: { coin: 20, lore: 16 },
    effects: [{ type: "unlock_building", building: "great_hall" }],
  },
  dwarf_runecraft: {
    id: "dwarf_runecraft", label: "Runecraft", category: "building", layer: 2, cost: 46,
    prereqs: [], raceOnly: "dwarf",
    description: "Unlocks the Runewall. Walls heal 5% of their max HP per turn.",
    costBreakdown: { coin: 28, lore: 18 },
    effects: [
      { type: "unlock_building", building: "runewall" },
      { type: "unlock_mechanic", mechanic: "hedge_walls" },
    ],
  },
  dwarf_defend_the_walls: {
    id: "dwarf_defend_the_walls", label: "Defend the Walls", category: "building", layer: 1, cost: 18,
    prereqs: [], raceOnly: "dwarf",
    description: "50% chance each turn a Dwarf wall attacks an enemy unit within range 1 for 1 attack.",
    costBreakdown: { coin: 12, lore: 6 },
    effects: [{ type: "unlock_mechanic", mechanic: "defend_the_walls_dwarf" }],
  },
  dwarf_deep_roads_rite: {
    id: "dwarf_deep_roads_rite", label: "Deep Roads Rite", category: "building", layer: 4, cost: 90,
    prereqs: ["dwarf_the_deep_mines"], raceOnly: "dwarf",
    description: "Unlocks the Deep Gate building. A Dwarf unit standing on any Deep Gate may instantly relocate to any other Deep Gate this civ owns (owner's choice of destination) -- the whole turn is spent arriving, no move or attack after. Dwarf-only: no other race can ever use one.",
    costBreakdown: { coin: 54, lore: 28, harvest: 8 },
    effects: [
      { type: "unlock_building", building: "deep_gate" },
      { type: "unlock_mechanic", mechanic: "deep_roads" },
    ],
  },

  // --- Military ---
  dwarf_foe_hammer: {
    id: "dwarf_foe_hammer", label: "Foe Hammer", category: "military", layer: 1, cost: 15,
    prereqs: [], raceOnly: "dwarf",
    description: "Unlocks the FoeHammer, the dwarves' basic melee fighter.",
    costBreakdown: { coin: 10, lore: 5 },
    effects: [{ type: "unlock_unit", unit: "foehammer" }],
  },
  dwarf_thunder_from_stone: {
    id: "dwarf_thunder_from_stone", label: "Thunder from Stone", category: "military", layer: 2, cost: 24,
    prereqs: [], raceOnly: "dwarf",
    description: "Unlocks the Musketeer, a ranged gunner that strikes without exposing itself to a counterattack.",
    costBreakdown: { coin: 16, lore: 8 },
    effects: [{ type: "unlock_unit", unit: "musketeer" }],
  },
  dwarf_warrior_poets: {
    id: "dwarf_warrior_poets", label: "Warrior Poets", category: "mystic", layer: 2, cost: 26,
    prereqs: ["dwarf_deep_lore"], raceOnly: "dwarf",
    description: "Unlocks the Metal Singer, a utility unit that rallies allies with an aura -- wields an axe that's also an electric guitar.",
    costBreakdown: { coin: 17, lore: 9 },
    effects: [{ type: "unlock_unit", unit: "troubadour" }],
  },
  dwarf_arquebus_engineering: {
    id: "dwarf_arquebus_engineering", label: "Arquebus Engineering", category: "military", layer: 3, cost: 40,
    prereqs: ["dwarf_thunder_from_stone"], raceOnly: "dwarf",
    description: "Musketeer gains +1 range and +1 attack.",
    costBreakdown: { coin: 26, lore: 14 },
    effects: [{ type: "unit_stat_upgrade", unit: "musketeer", changes: { range: 1, attack: 1 } }],
  },
  // Unlocks "bombard" via unlock_unit purely for cost/tech-layer lookup
  // purposes (unitBuildCost/unitMaxHP) -- same convention as every other
  // unlock_unit tech. Bombard IS normally cityBuildable (unlike Raptor/
  // Shadowsteed/Dire Bear), so this is also the real, only way a Dwarf
  // civ ever fields one.
  dwarf_bombardment: {
    id: "dwarf_bombardment", label: "Bombardment", category: "military", layer: 4, cost: 80,
    prereqs: ["dwarf_arquebus_engineering"], raceOnly: "dwarf",
    description: "Unlocks the Bombard, a powerful ranged cannon. Rather than a normal attack, the Bombard may target any tile within range as a full-turn \"Bombardment\" action: every unit and structure in the resulting 2x2 area takes damage, allies included.",
    costBreakdown: { coin: 50, lore: 30 },
    effects: [
      { type: "unlock_unit", unit: "bombard" },
      { type: "unlock_mechanic", mechanic: "bombardment" },
    ],
  },
  dwarf_heavy_metal: {
    id: "dwarf_heavy_metal", label: "Heavy Metal", category: "mystic", layer: 3, cost: 58,
    prereqs: ["dwarf_warrior_poets"], raceOnly: "dwarf",
    description: "Grants the Metal Singer an aura it can activate from its ring menu: allied units within a 1-tile radius (including itself) heal 5% of their HP per turn (minimum 1), regardless of whether they're resting, and gain +1 defense and +25% siege. If the Metal Singer also knows Power Metal, only one of the two auras can be active at a time.",
    costBreakdown: { coin: 34, lore: 24 },
    effects: [
      { type: "unlock_mechanic", mechanic: "heavy_metal" },
    ],
  },
  dwarf_power_metal: {
    id: "dwarf_power_metal", label: "Power Metal", category: "mystic", layer: 3, cost: 58,
    prereqs: ["dwarf_warrior_poets"], raceOnly: "dwarf",
    description: "Grants the Metal Singer an aura it can activate from its ring menu: allied units within a 1-tile radius (including itself) gain +2 attack and +5% First Strike. If the Metal Singer also knows Heavy Metal, only one of the two auras can be active at a time.",
    costBreakdown: { coin: 34, lore: 24 },
    effects: [
      { type: "unlock_mechanic", mechanic: "power_metal" },
    ],
  },
  dwarf_epic_metal: {
    id: "dwarf_epic_metal", label: "Epic Metal", category: "mystic", layer: 4, cost: 50,
    prereqs: ["dwarf_heavy_metal"], raceOnly: "dwarf",
    description: "The Metal Singer's active aura (Heavy Metal or Power Metal, whichever is currently active) extends to a 2-tile radius.",
    costBreakdown: { coin: 32, lore: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "epic_metal" }],
  },
  dwarf_shield_wall: {
    id: "dwarf_shield_wall", label: "Shield Wall", category: "military", layer: 2, cost: 40,
    prereqs: [], raceOnly: "dwarf",
    description: "Any Dwarf military unit standing adjacent to at least one other Dwarf military unit gains a flat +2 defense.",
    costBreakdown: { coin: 24, lore: 16 },
    effects: [{ type: "unlock_mechanic", mechanic: "shieldwall" }],
  },
  dwarf_runeforged_armory: {
    id: "dwarf_runeforged_armory", label: "Runeforged Armory", category: "military", layer: 3, cost: 52,
    prereqs: ["dwarf_runecraft"], raceOnly: "dwarf",
    description: "All Dwarf units gain +1 defense, +1 attack.",
    costBreakdown: { coin: 34, lore: 18 },
    effects: [
      { type: "unit_stat_upgrade", unit: "foehammer", changes: { attack: 1, defense: 1 } },
      { type: "unit_stat_upgrade", unit: "troubadour", changes: { attack: 1, defense: 1 } },
      { type: "unit_stat_upgrade", unit: "musketeer", changes: { attack: 1, defense: 1 } },
      { type: "unit_stat_upgrade", unit: "runeforged_titan", changes: { attack: 1, defense: 1 } },
    ],
  },
  dwarf_stonebreaker: {
    id: "dwarf_stonebreaker", label: "Stonebreaker", category: "military", layer: 3, cost: 42,
    prereqs: [], raceOnly: "dwarf",
    description: "All Dwarf units gain +50% siege.",
    costBreakdown: { coin: 27, lore: 15 },
    effects: [{ type: "siege_property_bonus", value: 0.5 }],
  },
  dwarf_unyielding: {
    id: "dwarf_unyielding", label: "Unyielding", category: "military", layer: 5, cost: 95,
    prereqs: ["dwarf_chronicle_in_stone"], raceOnly: "dwarf",
    description: "If the next hit against a unit (forward or counter) would kill it, 50% chance to negate all of that damage instead. Triggering has a 50% chance to force the unit to rest the next turn, and permanently reduces that unit's own trigger chance by 15 percentage points (floored at 0%) -- diminishing returns per unit, never resets.",
    costBreakdown: { coin: 55, lore: 28, harvest: 12 },
    effects: [{ type: "unlock_mechanic", mechanic: "unyielding", value: 0.5 }],
  },
  dwarf_runeforged_titan: {
    id: "dwarf_runeforged_titan", label: "Runeforged Titan", category: "military", layer: 5, cost: 90,
    prereqs: ["dwarf_stonebreaker", "dwarf_runeforged_armory"], raceOnly: "dwarf",
    description: "Unlocks the Runeforged Titan, a massive, slow-moving stone golem. Like a wall or city, it shrugs off an ordinary attacker almost unharmed, but a Siege-property attacker cuts through it just as easily. A rare unit meant to plod overland slowly toward an enemy city, defending itself along the way, escorted by other Dwarf units.",
    costBreakdown: { coin: 55, lore: 28, harvest: 7 },
    effects: [{ type: "unlock_unit", unit: "runeforged_titan" }],
  },

  // =========================================================================
  // ORC -- full prototype tree (redesigned). No stubs, no Mechanics column
  // (folded into Civic). Raiders (L1 Military) is Orc's startingTech --
  // free at civ creation, same treatment every other race's L1 melee unit
  // gets. See tech_tree_design session notes for the full review history.
  // =========================================================================

  // --- Layer 1 ---
  orc_marsh_paths: {
    id: "orc_marsh_paths", label: "Marsh Paths", category: "civic", layer: 1, cost: 12,
    prereqs: [], raceOnly: "orc",
    description: "Reduces the movement cost of Swamp by 0.5.",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_discount", terrain: "swamp", value: 0.5 }],
  },
  orc_forced_march: {
    id: "orc_forced_march", label: "Forced March", category: "civic", layer: 2, cost: 14,
    prereqs: [], raceOnly: "orc",
    // Civ-wide: terrain_movement_discount applies to every unit this civ
    // owns (unlike unit_terrain_movement_discount's units:[] allowlist).
    description: "Reduces the movement cost of Plains by 0.5.",
    costBreakdown: { lore: 10, harvest: 4 },
    effects: [{ type: "terrain_movement_discount", terrain: "plains", value: 0.5 }],
  },
  orc_violent_momentum: {
    id: "orc_violent_momentum", label: "Violent Momentum", category: "civic", layer: 1, cost: 14,
    prereqs: [], raceOnly: "orc",
    description: "+3 movement, 10% First Strike, and 10% Double Strike for a unit that killed an enemy unit within the previous 3 turns.",
    costBreakdown: { lore: 14 },
    effects: [{ type: "unlock_mechanic", mechanic: "violent_momentum" }],
  },
  // "plunder" is read directly by ai.js's openTreasureChest (2026-08-26,
  // user-directed) -- a chest that would've paid something other than coin
  // also pays a bonus coin haul on top, and any coin a chest DOES pay
  // (primary or the bonus) is tripled. Deliberately scoped to actually
  // opening a Treasure Chest only, not Ruin Delve finds or Wandering
  // Monster kills -- those reuse the same reward table through a separate
  // function, grantMonsterKillReward, which this doesn't touch.
  orc_plunder: {
    id: "orc_plunder", label: "Plunder", category: "civic", layer: 1, cost: 16,
    prereqs: [], raceOnly: "orc",
    description: "Opening a Treasure Chest always finds coin, on top of whatever else was found, and any coin found is tripled.",
    costBreakdown: { coin: 10, lore: 6 },
    effects: [{ type: "unlock_mechanic", mechanic: "plunder" }],
  },
  orc_raiders: {
    id: "orc_raiders", label: "Raiders", category: "military", layer: 1, cost: 15,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Raider, the orcs' basic melee fighter.",
    costBreakdown: { lore: 11, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "raider" }],
  },
  orc_miscreant: {
    id: "orc_miscreant", label: "Miscreant", category: "military", layer: 1, cost: 12,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Goblin Miscreant, a fast, cheap, disposable gap-filler unit rather than a real fighter -- cheaper to build and maintain than its stats alone suggest. Building one actually produces two: the second spawns on a random adjacent tile next to the city.",
    costBreakdown: { lore: 8, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "goblin_miscreant" }],
  },
  orc_dire_wolf: {
    id: "orc_dire_wolf", label: "Dire Wolf", category: "military", layer: 1, cost: 13,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Dire Wolf: a fast, savage hunter-beast. Regardless of fog of war, a Dire Wolf always knows the way to the nearest enemy unit on its own landmass and relentlessly closes the distance, attacking anything it catches along the way -- its preferred action, ahead of every other Orc strategy. Orc civ strategy always tries to keep at least one Dire Wolf active, and stops building new Scouts once Dire Wolf is available.",
    costBreakdown: { lore: 9, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "dire_wolf" }],
  },

  // --- Layer 2 ---
  orc_wolf_riders: {
    id: "orc_wolf_riders", label: "Wolf Riders", category: "military", layer: 2, cost: 16,
    prereqs: ["orc_dire_wolf"], raceOnly: "orc",
    description: "Unlocks the Wolf Rider, a fast-moving mounted raider. Also reduces the movement cost of Forest by 0.5 for Wolf Riders only.",
    costBreakdown: { lore: 12, coin: 4 },
    effects: [
      { type: "unlock_unit", unit: "wolf_rider" },
      { type: "unit_terrain_movement_discount", terrain: "forest", value: 0.5, units: ["wolf_rider"] },
    ],
  },
  orc_bog_harvest: {
    id: "orc_bog_harvest", label: "Wetland Harvest", category: "civic", layer: 1, cost: 20,
    prereqs: [], raceOnly: "orc",
    description: "+0.25 Harvest from Swamp.",
    costBreakdown: { lore: 14, harvest: 6 },
    effects: [{ type: "unlock_tile_bonus", terrain: "swamp", bonus: { harvest: 0.25 } }],
  },
  orc_warcraft: {
    id: "orc_warcraft", label: "War Camp", category: "building", layer: 1, cost: 22,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the War Camp. Units built in this city march harder: +1 movement, permanently.",
    costBreakdown: { lore: 18, coin: 4 },
    effects: [{ type: "unlock_building", building: "war_camp" }],
  },
  orc_defend_the_walls: {
    id: "orc_defend_the_walls", label: "Defend the Walls", category: "building", layer: 1, cost: 18,
    prereqs: [], raceOnly: "orc",
    description: "50% chance each turn an Orc wall attacks an enemy unit within range 1 for 2 attack.",
    costBreakdown: { coin: 12, lore: 6 },
    effects: [{ type: "unlock_mechanic", mechanic: "defend_the_walls_orc" }],
  },
  // See combat.js's spikesAttackRating/spikesCounterattack. Covers ANY Orc
  // structure (walls, buildings, cities) -- no attack bonus multiplier, no
  // militia spawn, flat attack rating instead of deriving from the Archer.
  orc_spikes: {
    id: "orc_spikes", label: "Spikes!", category: "building", layer: 2, cost: 22,
    prereqs: [], raceOnly: "orc",
    description: "Orc structures (walls, buildings, cities) can counterattack with attack rating 2.",
    costBreakdown: { coin: 14, lore: 8 },
    effects: [{ type: "unlock_mechanic", mechanic: "spikes" }],
  },
  orc_impaler_rite: {
    id: "orc_impaler_rite", label: "Impaler Rites", category: "military", layer: 2, cost: 15,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Impaler, a sturdy defender built to hold ground rather than strike hard.",
    costBreakdown: { lore: 11, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "impaler" }],
  },
  orc_bog_witch: {
    id: "orc_bog_witch", label: "Bog Witch", category: "mystic", layer: 2, cost: 25,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Bog Witch. Any unit that kills a Bog Witch loses 50% attack and 50% movement for 5 turns -- a death-curse for whoever finishes her off.",
    costBreakdown: { lore: 18, coin: 7 },
    effects: [{ type: "unlock_unit", unit: "bog_witch" }],
  },
  orc_swift_hunters: {
    id: "orc_swift_hunters", label: "Swift Hunters", category: "military", layer: 2, cost: 24,
    prereqs: ["orc_wolf_riders"], raceOnly: "orc",
    // firstStrikePct is genuinely additive with the unit's own base value
    // (see combat.js's effectiveFirstStrikePct) -- this +0.02 stacks on top
    // of Wolf Rider's baked-in base (see units.js) rather than replacing it.
    // 0.015 -> 0.02.
    description: "Wolf Rider gains 2% First Strike and increased attack and movement. Raider also gains +1 movement.",
    costBreakdown: { lore: 17, coin: 7 },
    effects: [
      { type: "unit_stat_upgrade", unit: "wolf_rider", changes: { firstStrikePct: 0.02, attack: 2, movement: 1 } },
      { type: "unit_stat_upgrade", unit: "raider", changes: { movement: 1 } },
    ],
  },
  orc_spoils_of_war: {
    id: "orc_spoils_of_war", label: "Spoils of War", category: "civic", layer: 2, cost: 40,
    prereqs: ["orc_warcraft"], raceOnly: "orc",
    description: "When an Orc unit kills an enemy unit, gain +12 coin and +12 lore.",
    costBreakdown: { lore: 30, coin: 10 },
    effects: [{ type: "raid_kill_bonus", harvest: 0, coin: 12, lore: 12 }],
  },

  // --- Layer 3 ---
  // Merged with the former "Campaign of Terror":
  // that tech (L5) has been removed entirely and its influence-suppression
  // effect folded in here, moving it up to L3 -- a real timing buff, not
  // just a naming change. The resource payout also changed from a flat
  // +1/+1/+1 regardless of position to +1 of each resource PER TILE the
  // unit actually suppressed this turn (see influence.js computeInfluenceMap
  // recording unit._pillageTilesSuppressed, read in turns.js's runCivTurn) --
  // so raiding near an enemy city's still-full territory pays much more than
  // raiding land that's already stripped bare. See
  // project_campaign_of_terror_fix / project_pairwise_balance_human_orc_halfellow
  // memory for the investigation this grew out of.
  orc_pillage_and_loot: {
    id: "orc_pillage_and_loot", label: "Pillage and Loot", category: "civic", layer: 4, cost: 40,
    prereqs: ["orc_spoils_of_war"], raceOnly: "orc",
    description: "An Orc unit standing within an enemy city's radius has a 2-tile (Chebyshev) radius around itself which removes any filled-in enemy influence from those tiles -- cutting off their yield immediately and fully stripping the tile after 3 turns of sustained suppression -- and generates +1 harvest, +1 coin, and +1 lore for EACH tile where influence was actually suppressed this turn. Lasts until the unit moves to a new tile (the effect moves with it), leaves the enemy city's radius, or is killed. Does not stack with other Orc units on the same tile.",
    costBreakdown: { lore: 26, coin: 14 },
    effects: [{ type: "unlock_mechanic", mechanic: "pillage_and_loot" }],
  },
  orc_butchery_rites: {
    id: "orc_butchery_rites", label: "Butchery", category: "building", layer: 2, cost: 35,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Butchery. While at least one stands, your units heal 15% of their maximum health (minimum 1) whenever they kill an enemy.",
    costBreakdown: { lore: 28, coin: 7 },
    effects: [{ type: "unlock_building", building: "butchery" }],
  },
  orc_tip_of_the_spear: {
    id: "orc_tip_of_the_spear", label: "Tip of the Spear", category: "military", layer: 3, cost: 22,
    prereqs: ["orc_impaler_rite"], raceOnly: "orc",
    description: "Impaler gains First Strike 10%.",
    costBreakdown: { lore: 22 },
    effects: [{ type: "unit_stat_upgrade", unit: "impaler", changes: { firstStrikePct: 0.10 } }],
  },
  orc_battering_ram: {
    id: "orc_battering_ram", label: "Battering Ram", category: "military", layer: 3, cost: 40,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Battering Ram, a slow-moving siege engine built to break down walls and structures.",
    costBreakdown: { lore: 26, coin: 14 },
    effects: [{ type: "unlock_unit", unit: "battering_ram" }],
  },
  orc_ogre: {
    id: "orc_ogre", label: "Ogre", category: "military", layer: 3, cost: 42,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Ogre, a hard-hitting brute that can also help break down walls and structures.",
    costBreakdown: { lore: 28, coin: 14 },
    effects: [{ type: "unlock_unit", unit: "ogre" }],
  },
  orc_malefic_malediction: {
    id: "orc_malefic_malediction", label: "Malefic Malediction", category: "mystic", layer: 3, cost: 38,
    prereqs: ["orc_bog_witch"], raceOnly: "orc",
    description: "Any unit damaged by a Bog Witch loses 50% attack and 50% movement for 5 turns. Stacks alongside the Bog Witch's own death-curse.",
    costBreakdown: { lore: 38 },
    effects: [{ type: "unlock_mechanic", mechanic: "malefic_malediction" }],
  },
  // New per-unit data fields introduced here: befuddledChancePct and
  // curseChancePct, same generic on-hit-chance convention as
  // poisonChancePct/frozenChancePct/burnChancePct -- see ai.js's
  // applyOrcCombatMechanics for where they're actually rolled. curseChancePct
  // reuses Malefic Malediction's own debuff shape (-50% attack, -50%
  // movement, 5 turns) -- since Malefic Malediction is a required prereq
  // here and already applies that same curse unconditionally on every
  // landed Bog Witch hit, this specific clause is currently redundant in
  // practice (curse already always lands once both techs are known); kept
  // as authored since the tech's own wording asks for it, and it stops
  // being redundant if Malefic Malediction's own unconditional application
  // is ever reworked.
  orc_afflictions_of_anguish: {
    id: "orc_afflictions_of_anguish", label: "Afflictions of Anguish", category: "mystic", layer: 4, cost: 65,
    prereqs: ["orc_bog_witch", "orc_malefic_malediction"], raceOnly: "orc",
    description: "Bog Witch gains +1 vision. Her attacks gain a 20% chance to inflict Poison, 25% chance to inflict Befuddled, 25% chance to Curse (the same debuff Malefic Malediction already applies), and +10% chance to inflict Frozen.",
    costBreakdown: { lore: 45, coin: 20 },
    effects: [
      { type: "unit_stat_upgrade", unit: "bog_witch", changes: {
        visionRadius: 1, poisonChancePct: 0.20, befuddledChancePct: 0.25, curseChancePct: 0.25, frozenChancePct: 0.10,
      } },
      { type: "unlock_mechanic", mechanic: "afflictions_of_anguish" },
    ],
  },
  orc_bog_spirit: {
    id: "orc_bog_spirit", label: "Bog Spirit", category: "mystic", layer: 3, cost: 40,
    prereqs: ["orc_bog_witch"], raceOnly: "orc",
    description: "The Bog Witch may instantly summon a Wisp, a small flying spirit of the swamp, into any swamp tile the Orc kingdom has ever explored -- even one it can't currently see. A Wisp can hide, and is permanently bound to swamp terrain: it flies at speed over swamp but can never cross onto any other kind of tile. The Orc kingdom may field at most one Wisp per living Bog Witch -- if a Bog Witch dies and that leaves too many Wisps behind, one must be disbanded.",
    // unlock_unit registers "wisp" with techForUnit (so unitBuildCost can
    // derive its resource split from this tech's costBreakdown) even though
    // no CITY can ever build one -- see units.js's cityBuildable: false.
    // Mirrors Elf's Raptor/Shadowsteed summon pattern (elf_air_beneath_
    // eyes_above/elf_shadowsteed): a Bog Witch's own summon action is the
    // only thing that ever spends this.
    costBreakdown: { harvest: 4, coin: 12, lore: 24 },
    effects: [
      { type: "unlock_unit", unit: "wisp" },
      { type: "unlock_mechanic", mechanic: "wisp_summon" },
    ],
  },
  // 2026-08-20 redesign, user-directed: was a hardcoded Scout/Dragon
  // ranged-only + Goblin Miscreant melee-always 100% special case; now a
  // flat +10% burnChancePct on every Orc combat unit's attacks, any hit,
  // any range -- see ai.js's applyOrcCombatMechanics for the matching
  // engine-side generic-gate change.
  orc_burn_it_all_down: {
    id: "orc_burn_it_all_down", label: "Burn It All Down", category: "military", layer: 3, cost: 35,
    prereqs: [], raceOnly: "orc",
    description: "All Orc units' attacks gain a 10% chance to inflict the Burning condition on the target: 1 damage at the start of the burning unit's turn for 3 turns, unless it's currently on Coast, Ocean, or a river tile.",
    costBreakdown: { lore: 22, coin: 13 },
    effects: [
      { type: "unit_stat_upgrade", unit: "scout", changes: { burnChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "raider", changes: { burnChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "goblin_miscreant", changes: { burnChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "impaler", changes: { burnChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "dire_wolf", changes: { burnChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "wolf_rider", changes: { burnChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "bog_witch", changes: { burnChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "battering_ram", changes: { burnChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "ogre", changes: { burnChancePct: 0.10 } },
      { type: "unit_stat_upgrade", unit: "dragon", changes: { burnChancePct: 0.10 } },
      { type: "unlock_mechanic", mechanic: "burn_it_all_down" },
    ],
  },
  // unit_stat_upgrade REPLACES a non-additive field (burnChancePct/
  // poisonChancePct) rather than adding to it -- see tech.js's
  // unit_stat_upgrade handler. Since orc_burn_it_all_down is a REQUIRED
  // prereq here (always researched first), the burnChancePct values below
  // are the COMBINED total (Burn It All Down's own 0.10 baseline + this
  // tech's stated bonus), not just this tech's own increment, so the two
  // techs' effects actually stack instead of one silently overwriting the
  // other: Raider 0.10+0.10=0.20, Goblin Miscreant 0.10+0.20=0.30.
  orc_pyromania: {
    id: "orc_pyromania", label: "Pyromania", category: "military", layer: 4, cost: 60,
    prereqs: ["orc_burn_it_all_down"], raceOnly: "orc",
    description: "Raider gains +1 attack and +10% chance to inflict Burning (on top of Burn It All Down's own 10%). Goblin Miscreant gains +20% chance to inflict Burning (on top of Burn It All Down's own 10%) and +10% chance to inflict Poison.",
    costBreakdown: { lore: 30, coin: 20, harvest: 10 },
    effects: [
      { type: "unit_stat_upgrade", unit: "raider", changes: { attack: 1, burnChancePct: 0.20 } },
      { type: "unit_stat_upgrade", unit: "goblin_miscreant", changes: { burnChancePct: 0.30, poisonChancePct: 0.10 } },
      { type: "unlock_mechanic", mechanic: "pyromania" },
    ],
  },
  orc_wasteland_riders: {
    id: "orc_wasteland_riders", label: "Wasteland Riders", category: "military", layer: 2, cost: 24,
    prereqs: ["orc_forced_march"], raceOnly: "orc",
    // Civ-wide, not unit-restricted, same fix
    // and same reasoning as orc_forced_march above.
    description: "Reduces the movement cost of Desert by 0.5.",
    costBreakdown: { lore: 18, harvest: 6 },
    effects: [{ type: "terrain_movement_discount", terrain: "desert", value: 0.5 }],
  },
  orc_hound_and_hunter: {
    id: "orc_hound_and_hunter", label: "Hound and Hunter", category: "military", layer: 3, cost: 28,
    prereqs: ["orc_wolf_riders", "orc_dire_wolf"], raceOnly: "orc",
    description: "When a Wolf Rider dies, 50% chance a Raider or a Dire Wolf (50/50 between the two) spawns in its place.",
    costBreakdown: { lore: 18, coin: 10 },
    effects: [{ type: "unlock_mechanic", mechanic: "hound_and_hunter" }],
  },
  // Replaces (not stacks with) Spikes!'s attack rating while both are
  // known -- same "upgrade tech" convention as e.g. Sudden Doom replacing
  // Strike from the Shadows -- see combat.js's spikesAttackRating.
  orc_bigger_spikes: {
    id: "orc_bigger_spikes", label: "Bigger Spikes!", category: "building", layer: 3, cost: 38,
    prereqs: ["orc_spikes"], raceOnly: "orc",
    description: "Orc structures (walls, buildings, cities) can counterattack with attack rating 4.",
    costBreakdown: { coin: 22, lore: 16 },
    effects: [{ type: "unlock_mechanic", mechanic: "bigger_spikes" }],
  },

  // --- Layer 4 ---
  orc_the_old_ways: {
    id: "orc_the_old_ways", label: "The Old Ways", category: "mystic", layer: 1, cost: 50,
    prereqs: [], raceOnly: "orc",
    description: "+0.5 Lore from Swamp.",
    costBreakdown: { lore: 50 },
    effects: [{ type: "unlock_tile_bonus", terrain: "swamp", bonus: { lore: 0.5 } }],
  },
  orc_honor_the_dead: {
    id: "orc_honor_the_dead", label: "Honor the Dead", category: "mystic", layer: 1, cost: 55,
    prereqs: [], raceOnly: "orc",
    description: "When an Orc unit dies, gain +30 lore. Orc units have a 50% chance to resist being raised from the dead (if an Orc unit is slain by an Undead unit, only a 50% chance the Undead civ turns it into a zombie under its control).",
    costBreakdown: { lore: 45, harvest: 10 },
    effects: [
      { type: "death_lore_bonus", value: 30 },
      { type: "raise_dead_resistance", value: 0.5 },
    ],
  },
  orc_dragon_den_rite: {
    id: "orc_dragon_den_rite", label: "Dragon Den", category: "building", layer: 3, cost: 55,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Dragon Den. Dragons may only be built in a city that has one -- lose the Den and that city can no longer raise them.",
    costBreakdown: { lore: 40, coin: 15 },
    effects: [{ type: "unlock_building", building: "dragon_den" }],
  },
  orc_siege_tactics: {
    id: "orc_siege_tactics", label: "Siege Tactics", category: "military", layer: 4, cost: 40,
    prereqs: ["orc_ogre", "orc_battering_ram"], raceOnly: "orc",
    description: "If an Orc unit already has the Siege property, it increases by 30 percentage points; otherwise the unit gains Siege 30%.",
    costBreakdown: { lore: 40, coin: 15 },
    effects: [{ type: "siege_property_bonus", value: 0.30 }],
  },
  orc_draconic_mastery: {
    id: "orc_draconic_mastery", label: "Draconic Mastery", category: "military", layer: 5, cost: 92,
    prereqs: ["orc_dragon_den_rite"], raceOnly: "orc",
    // Pinnacle unit (2026-07-12): Dragon is meant to be the single most
    // powerful, most feared unit in the game -- not just strong, genuinely
    // rare. Stats raised (11/8 -> 14/10 attack/defense) AND each additional
    // Dragon a civ already owns compounds the cost/build time of the next
    // one (see units.js's `rare` flag, ai.js's buildUnitOption). See
    // project_dragon_rebalance memory for the before/after data.
    description: "Unlocks the Dragon, a flying terror and the single most powerful unit in the game -- but each Dragon a civ already owns makes the next one substantially more expensive and slower to build, so fielding many at once is deliberately punishing.",
    costBreakdown: { lore: 67, coin: 25 },
    effects: [{ type: "unlock_unit", unit: "dragon" }],
  },

  // --- Layer 5 ---
  // "Campaign of Terror" removed entirely (2026-07-14) -- merged into
  // orc_pillage_and_loot above (see its comment).
  orc_ancestral_dolmen_rite: {
    id: "orc_ancestral_dolmen_rite", label: "Ancestral Dolmen", category: "building", layer: 4, cost: 95,
    prereqs: ["orc_the_old_ways"], raceOnly: "orc",
    description: "Unlocks the Ancestral Dolmen. When a unit built in this city falls anywhere on the map, every friendly unit within 3 tiles is roused to avenge it: +25% attack for 3 turns.",
    costBreakdown: { lore: 95 },
    effects: [{ type: "unlock_building", building: "ancestral_dolmen" }],
  },
  orc_dragon_riders: {
    id: "orc_dragon_riders", label: "Dragon Riders", category: "military", layer: 5, cost: 95,
    prereqs: ["orc_draconic_mastery"], raceOnly: "orc",
    description: "Dragon gains the Carry property (can only carry one other Orc unit, not another Dragon). If the Dragon dies while carrying a unit, that unit spawns into the space the Dragon formerly occupied. A carried unit cannot act except to disembark.",
    costBreakdown: { lore: 70, coin: 25 },
    effects: [{ type: "unit_stat_upgrade", unit: "dragon", changes: { canCarryUnit: true } }],
  },

  // =========================================================================
  // UNDEAD
  // =========================================================================
  undead_arms: {
    id: "undead_arms", label: "Grave-Bound Rite", category: "military", layer: 1, cost: 15,
    prereqs: [], raceOnly: "undead",
    description: "Unlocks the Skeleton, binding the first of the risen dead to service.",
    costBreakdown: { lore: 15 },
    effects: [{ type: "unlock_unit", unit: "skeleton" }],
  },
  undead_mire_walkers: {
    id: "undead_mire_walkers", label: "Mire-Walkers", category: "civic", layer: 1, cost: 12,
    prereqs: [], raceOnly: "undead",
    description: "The dead do not tire in the bog. Reduces the movement cost of Swamp by 0.5.",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_discount", terrain: "swamp", value: 0.5 }],
  },

  undead_barrow_rite: {
    id: "undead_barrow_rite", label: "Barrow Rite", category: "building", layer: 2, cost: 22,
    prereqs: ["undead_arms"], raceOnly: "undead",
    description: "Unlocks the Barrow (contested tiles still yield 25%).",
    costBreakdown: { lore: 22 },
    effects: [{ type: "unlock_building", building: "barrow" }],
  },
  undead_wight_binding: {
    id: "undead_wight_binding", label: "Wight-Binding", category: "military", layer: 2, cost: 25,
    prereqs: ["undead_arms"], raceOnly: "undead",
    description: "STUB — fork: unlock the Wight (spear-tier) OR deepen the Skeleton.",
    costBreakdown: { lore: 25 },
    stub: true, plannedUnit: "wight", plannedRole: "spear",
    effects: [],
  },

  undead_reliquary_rite: {
    id: "undead_reliquary_rite", label: "Reliquary Rite", category: "building", layer: 3, cost: 35,
    prereqs: ["undead_barrow_rite"], raceOnly: "undead",
    description: "Unlocks the Bone Reliquary (+2 lore).",
    costBreakdown: { lore: 35 },
    effects: [{ type: "unlock_building", building: "bone_reliquary" }],
  },
  undead_dark_ritual: {
    id: "undead_dark_ritual", label: "Dark Ritual", category: "civic", layer: 3, cost: 40,
    prereqs: ["undead_mire_walkers"], raceOnly: "undead",
    description: "A unit stationed 2+ turns on a Ruin channels its power, projecting influence in a 1-tile radius. Vanishes the instant the unit moves off the Ruin or dies.",
    costBreakdown: { lore: 40 },
    effects: [{ type: "unlock_mechanic", mechanic: "dark_ritual" }],
  },

  undead_obelisk_rite: {
    id: "undead_obelisk_rite", label: "Obelisk Rite", category: "building", layer: 4, cost: 50,
    prereqs: ["undead_reliquary_rite"], raceOnly: "undead",
    description: "Unlocks the Cursed Obelisk (×1.20 influence).",
    costBreakdown: { lore: 50 },
    effects: [{ type: "unlock_building", building: "cursed_obelisk" }],
  },
  undead_bone_archery: {
    id: "undead_bone_archery", label: "Bone Archery", category: "military", layer: 4, cost: 55,
    prereqs: ["undead_wight_binding"], raceOnly: "undead",
    description: "STUB — fork: unlock the Bone Archer (archer-tier) OR deepen the prior unit.",
    costBreakdown: { lore: 55 },
    stub: true, plannedUnit: "bone_archer", plannedRole: "archer",
    effects: [],
  },

  undead_necropolis_rite: {
    id: "undead_necropolis_rite", label: "Necropolis Rite", category: "building", layer: 5, cost: 100,
    prereqs: ["undead_obelisk_rite"], raceOnly: "undead",
    description: "Unlocks the Necropolis (+1 radius, stronger Raise Dead).",
    costBreakdown: { lore: 100 },
    effects: [{ type: "unlock_building", building: "necropolis" }],
  },
  undead_grave_colossus: {
    id: "undead_grave_colossus", label: "Grave Colossus Rite", category: "military", layer: 5, cost: 95,
    prereqs: ["undead_bone_archery"], raceOnly: "undead",
    description: "STUB (ultimate) — unlocks the Grave Colossus (heavy siege-tier; Undead field no cavalry).",
    costBreakdown: { lore: 95 },
    stub: true, plannedUnit: "grave_colossus", plannedRole: "siege",
    effects: [],
  },

  // =========================================================================
  // HALFELLOW -- full designed tree (user-authored, see project notes).
  // Three themes run through it: hearth-and-home economy (filled-tile
  // influence, healing, per-building yield%), a "fight smarter, not harder"
  // military column built on the hidden condition, and a village-defense
  // capstone (structures that fight back). See combat.js/ai.js/cities.js
  // for the supporting engine mechanics each node below plugs into.
  // =========================================================================

  // --- Layer 1 ---
  halfellow_arms: {
    id: "halfellow_arms", label: "Wanderer", category: "military", layer: 1, cost: 15,
    prereqs: [], raceOnly: "halfellow",
    // Wanderer's ability to found a city removed 2026-08-17, user-directed
    // (see units.js's wanderer entry) -- description below updated to match.
    description: "Unlocks the Wanderer, the halfellows' basic melee fighter. Also reduces the movement cost of Plains by 0.5.",
    costBreakdown: { harvest: 15 },
    effects: [
      { type: "unlock_unit", unit: "wanderer" },
      { type: "terrain_movement_discount", terrain: "plains", value: 0.5 },
    ],
  },
  halfellow_singing_hills: {
    id: "halfellow_singing_hills", label: "Singing Hills", category: "civic", layer: 1, cost: 12,
    prereqs: [], raceOnly: "halfellow",
    description: "Reduces the movement cost of Hills by 0.5. (Does not stack with Riverfolk on a hill-with-river tile -- only the higher of the two applies.)",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_discount", terrain: "hills", value: 0.5 }],
  },
  halfellow_riverfolk: {
    id: "halfellow_riverfolk", label: "Riverfolk", category: "civic", layer: 1, cost: 12,
    prereqs: [], raceOnly: "halfellow",
    description: "Reduces the movement cost of River tiles by 0.5. (Does not stack with Singing Hills on a hill-with-river tile -- only the higher of the two applies.)",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_discount", terrain: "river", value: 0.5 }],
  },
  // Moved from L2 (2026-07-12): Halfellow's stealth kit was coming online
  // too late to matter during the exact early-rush window that was
  // deciding most Orc-vs-Halfellow games on the tighter dynamically-sized
  // map (see project_halfellow_tactics's retest). L1 means it's
  // researchable from turn one instead of gated behind a 2nd city.
  halfellow_sneaking_around: {
    id: "halfellow_sneaking_around", label: "Sneaking Around", category: "military", layer: 1, cost: 25,
    prereqs: [], raceOnly: "halfellow",
    // Restricted to Wanderer only -- see combat.js's canGoHidden, which
    // keys this restriction off raceId so Elf's own unlock of the same
    // shared "sneaking_around" mechanic (elf_shadowed_hush_unseen) stays
    // race-wide.
    description: "The Wanderer may spend its whole turn to become Hidden for 3 turns (voluntarily cancellable early). Cannot activate with an enemy unit on an adjacent tile. Whenever a Hidden unit is revealed for ANY reason, it is forced visible for at least 1 turn before it can go Hidden again.",
    costBreakdown: { harvest: 15, lore: 10 },
    effects: [{ type: "unlock_mechanic", mechanic: "sneaking_around" }],
  },
  // Civ-wide (every Halfellow unit), a lookout post rather than a
  // combat/economy tool. Full turn action: go Hidden and hold position (see ai.js's
  // maybeHalfellowKeepAnEyeOut) with a flat +3 vision radius for the
  // duration -- see combat.js/sidebar.js wherever visionRadius is read.
  halfellow_keep_an_eye_out: {
    id: "halfellow_keep_an_eye_out", label: "Keep an Eye Out", category: "military", layer: 1, cost: 22,
    prereqs: [], raceOnly: "halfellow",
    description: "Any Halfellow unit may spend its whole turn to go Hidden and hold position, gaining +3 vision radius for as long as it stays there. Ends the same way Hidden normally ends (moving, an enemy walking onto its tile, attacking, ...).",
    costBreakdown: { harvest: 12, lore: 10 },
    effects: [{ type: "unlock_mechanic", mechanic: "keep_an_eye_out", value: 3 }],
  },

  // --- Layer 2 ---
  halfellow_hillside_harvest: {
    id: "halfellow_hillside_harvest", label: "Hillside Harvest", category: "civic", layer: 1, cost: 20,
    prereqs: ["halfellow_singing_hills"], raceOnly: "halfellow",
    description: "+0.25 harvest from Hills.",
    costBreakdown: { lore: 13, coin: 7 },
    effects: [{ type: "unlock_tile_bonus", terrain: "hills", bonus: { harvest: 0.25 } }],
  },
  halfellow_road_goes_ever_on: {
    id: "halfellow_road_goes_ever_on", label: "The Road Goes Ever On", category: "civic", layer: 2, cost: 22,
    prereqs: [], raceOnly: "halfellow",
    description: "+0.5 lore per road tile within a city's radius.",
    costBreakdown: { lore: 14, harvest: 8 },
    effects: [{ type: "unlock_feature_bonus", feature: "road", bonus: { lore: 0.5 } }],
  },
  halfellow_farmers_market: {
    id: "halfellow_farmers_market", label: "Farmers Market", category: "building", layer: 1, cost: 20,
    prereqs: [], raceOnly: "halfellow",
    description: "Unlocks the Farmers Market. Units built in this city are well fed: +25% maximum health, permanently.",
    costBreakdown: { coin: 12, harvest: 8 },
    effects: [{ type: "unlock_building", building: "farmers_market" }],
  },
  halfellow_defend_the_walls: {
    id: "halfellow_defend_the_walls", label: "Defend the Walls", category: "building", layer: 1, cost: 18,
    prereqs: [], raceOnly: "halfellow",
    description: "50% chance each turn a Halfellow wall attacks an enemy unit within range 1 for 1 attack.",
    costBreakdown: { coin: 12, harvest: 6 },
    effects: [{ type: "unlock_mechanic", mechanic: "defend_the_walls_halfellow" }],
  },
  halfellow_pony_patrol: {
    id: "halfellow_pony_patrol", label: "Pony Patrol", category: "military", layer: 2, cost: 24,
    prereqs: ["halfellow_road_goes_ever_on"], raceOnly: "halfellow",
    description: "Unlocks the Pony Patrol, a fast-moving scout-fighter.",
    costBreakdown: { harvest: 14, coin: 10 },
    effects: [{ type: "unlock_unit", unit: "pony_patrol" }],
  },
  // Mirrors Orc's Hound and Hunter structurally (spawns on the dead unit's
  // own now-vacated tile, gated on typeId at every death call site) -- see
  // combat.js's maybeSpawnPonyReplacement.
  halfellow_undaunted: {
    id: "halfellow_undaunted", label: "Undaunted", category: "military", layer: 4, cost: 50,
    prereqs: ["halfellow_pony_patrol"], raceOnly: "halfellow",
    description: "When a Pony Patrol is killed, 50% chance a Wanderer spawns in its place.",
    costBreakdown: { harvest: 28, lore: 22 },
    effects: [{ type: "unlock_mechanic", mechanic: "undaunted" }],
  },
  // Moved from L4 (2026-07-12), alongside Sneaking Around's move to L1 --
  // see that tech's comment. Its own prereq (Sneaking Around) is still
  // satisfied regardless of layer number; only the city-count gate and
  // cost premium change.
  halfellow_knife_in_the_dark: {
    id: "halfellow_knife_in_the_dark", label: "A Knife in the Dark", category: "military", layer: 2, cost: 50,
    prereqs: ["halfellow_sneaking_around"], raceOnly: "halfellow",
    description: "A Hidden Halfellow unit attacks at 175%. Attacking always ends Hidden as normal.",
    costBreakdown: { lore: 50 },
    effects: [{ type: "unlock_mechanic", mechanic: "knife_in_the_dark" }],
  },
  halfellow_courage: {
    id: "halfellow_courage", label: "Courage", category: "military", layer: 3, cost: 40,
    prereqs: ["halfellow_knife_in_the_dark"], raceOnly: "halfellow",
    description: "Wanderer gains +2 attack, +1 defense, and 3% First Strike.",
    costBreakdown: { harvest: 20, lore: 20 },
    effects: [{ type: "unit_stat_upgrade", unit: "wanderer", changes: { attack: 2, defense: 1, firstStrikePct: 0.03 } }],
  },
  // New (2026-07-12): a race-wide Ranged grant, added alongside Sneaking
  // Around/Knife in the Dark's move to L1/L2 -- together meant to give
  // Halfellow a genuine early-game combat toolkit (hide, ambush, AND now
  // kite at range) that can actually matter during the tight early-contact
  // window a smaller map creates, rather than mostly-civic techs. Uses a
  // new civ-wide "universal_range_grant" effect (tech.js/combat.js) rather
  // than unit_stat_upgrade's per-unit-type overrides, since this applies
  // uniformly to every Halfellow unit at once, present and future --
  // implemented as a FLOOR (Math.max against a unit's own range), not an
  // additive bonus, so it can never make an already-ranged unit worse and
  // never stacks oddly with a future per-unit range override.
  halfellow_boomerang: {
    id: "halfellow_boomerang", label: "Boomerang", category: "military", layer: 2, cost: 30,
    prereqs: [], raceOnly: "halfellow",
    description: "Every Halfellow unit gains Ranged 2 (attacks from 2 tiles away and takes no counterattack when doing so).",
    costBreakdown: { harvest: 15, lore: 15 },
    effects: [{ type: "universal_range_grant", value: 2 }],
  },

  // --- Layer 3 ---
  halfellow_riverboat_trade: {
    id: "halfellow_riverboat_trade", label: "Riverboat Trade", category: "civic", layer: 2, cost: 38,
    prereqs: ["halfellow_riverfolk"], raceOnly: "halfellow",
    description: "+0.5 coin per river tile within a city's radius.",
    costBreakdown: { coin: 22, harvest: 16 },
    effects: [{ type: "unlock_feature_bonus", feature: "river", bonus: { coin: 0.5 } }],
  },
  halfellow_nice_day_fishing: {
    id: "halfellow_nice_day_fishing", label: "A Nice Day for Fishing", category: "civic", layer: 2, cost: 38,
    prereqs: ["halfellow_riverfolk"], raceOnly: "halfellow",
    description: "+0.5 harvest from Rivers.",
    costBreakdown: { lore: 22, coin: 16 },
    effects: [{ type: "unlock_feature_bonus", feature: "river", bonus: { harvest: 0.5 } }],
  },
  halfellow_ice_fishing: {
    id: "halfellow_ice_fishing", label: "Ice Fishing", category: "civic", layer: 3, cost: 40,
    prereqs: ["halfellow_riverfolk"], raceOnly: "halfellow",
    description: "+1 harvest from Tundra.",
    costBreakdown: { lore: 16, coin: 12, harvest: 12 },
    effects: [{ type: "unlock_tile_bonus", terrain: "tundra", bonus: { harvest: 1 } }],
  },
  // New (2026-08-17, user-directed): a Halfellow-only upgrade to the
  // universal "Farm Soil" channel (see turns.js's farming-channel block,
  // "hunt_game/farm_soil" -- both Level 0, shared by every race). Gated
  // behind that shared tech, same "race-specific upgrade to a universal
  // base mechanic" shape Dwarf's Prospector's Claim/The Deep Mines use for
  // Mine Vein (see mechanicValues.prospectors_claim_yield/deep_mines_yield,
  // summed the same additive-fraction way this reads its own
  // agriculture_culture value). value: 2.0 -- a 200% INCREASE, i.e. the
  // farming payout becomes 1 + 2.0 = 3x, not 2x.
  halfellow_agriculture_culture: {
    id: "halfellow_agriculture_culture", label: "Agriculture Culture", category: "civic", layer: 3, cost: 38,
    prereqs: ["farm_soil"], raceOnly: "halfellow",
    description: "Increases resources earned from Farming Fertile Soil by 200%.",
    costBreakdown: { harvest: 20, coin: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "agriculture_culture", value: 2.0 }],
  },
  halfellow_neighborhood_pub: {
    id: "halfellow_neighborhood_pub", label: "Neighborhood Pub", category: "building", layer: 2, cost: 35,
    prereqs: [], raceOnly: "halfellow",
    description: "Unlocks the Neighborhood Pub. Tales told over a pint make veterans of everyone: all Halfellow units gain +25% XP whenever they earn XP.",
    costBreakdown: { coin: 20, harvest: 15 },
    effects: [{ type: "unlock_building", building: "neighborhood_pub" }],
  },
  halfellow_pub_crawl: {
    id: "halfellow_pub_crawl", label: "Pub Crawl", category: "civic", layer: 2, cost: 40,
    prereqs: ["halfellow_neighborhood_pub"], raceOnly: "halfellow",
    description: "+3 coin per building constructed in a city (walls don't count).",
    costBreakdown: { lore: 16, coin: 12, harvest: 12 },
    effects: [{ type: "building_count_bonus", bonus: { coin: 3 } }],
  },
  // Unlocks the Trouble Maker unit, with Resource Heist and Unlock the Gate
  // already built in (see ai.js's maybeResourceHeistPlay/
  // maybeUnlockTheGatePlay). Riddle needs its own further tech (The Riddle
  // Game, below) -- unit unlocked first, each spell behind its own tech.
  halfellow_making_trouble: {
    id: "halfellow_making_trouble", label: "Making Trouble", category: "mystic", layer: 2, cost: 45,
    prereqs: ["halfellow_pub_crawl"], raceOnly: "halfellow",
    description: "Unlocks the Trouble Maker, a stealthy rogue with two built-in tricks: Resource Heist (steal a targeted enemy unit's accumulated prospecting/delving/fishing stash, resetting their claim to zero, and leaves the victim Befuddled) and Unlock the Gate (disables a targeted wall and every wall adjacent to it -- zeroing their defense and suppressing any special wall defenses -- for 3 rounds). When opening a Treasure Chest, a Trouble Maker is able to disarm traps: a trap that would have sprung is instead disarmed harmlessly.",
    costBreakdown: { harvest: 22, lore: 23 },
    effects: [
      { type: "unlock_unit", unit: "trouble_maker" },
      { type: "unlock_mechanic", mechanic: "resource_heist" },
      { type: "unlock_mechanic", mechanic: "unlock_the_gate" },
      // Bug fix (2026-07-24, found live): combat.js's canGoHidden checks
      // for this exact mechanic id to grant Trouble Maker its own innate
      // stealth -- without this effect the check could never pass, since
      // "making_trouble" was never actually added to
      // civ.unlockedMechanics. Confirmed dead via live testing: 0 Hidden
      // entries for any Trouble Maker across 32 games before this fix.
      { type: "unlock_mechanic", mechanic: "making_trouble" },
    ],
  },
  halfellow_high_ground: {
    id: "halfellow_high_ground", label: "High Ground", category: "military", layer: 3, cost: 40,
    prereqs: ["halfellow_singing_hills"], raceOnly: "halfellow",
    description: "While standing on Hills: +50% defense, and +50% counterattack damage, regardless of whether the incoming attack was First Strike or not.",
    costBreakdown: { harvest: 24, lore: 16 },
    effects: [{ type: "unlock_mechanic", mechanic: "high_ground" }],
  },
  halfellow_hedge_walls: {
    // category "building" despite unlocking no
    // building of its own -- same call as Ramparts above.
    id: "halfellow_hedge_walls", label: "Hedge Walls", category: "building", layer: 3, cost: 38,
    prereqs: ["halfellow_hillside_harvest"], raceOnly: "halfellow",
    description: "Walls heal 5% of their max HP every turn.",
    costBreakdown: { harvest: 22, lore: 16 },
    effects: [{ type: "unlock_mechanic", mechanic: "hedge_walls" }],
  },

  // --- Layer 4 ---
  halfellow_community_fellowship: {
    id: "halfellow_community_fellowship", label: "Community Fellowship", category: "civic", layer: 4, cost: 55,
    prereqs: ["halfellow_neighborhood_pub"], raceOnly: "halfellow",
    // Pacing/balance experiment (2026-07-12): raised from 2.00 (+100%) to
    // 2.50 -- Halfellow's win rate had been sliding badly against Orc at
    // the time (10% vs. Orc's 65% in the most recent batch then). See
    // project_pacing_experiment memory for that history.
    // Tried cutting to 2.00 (2026-07-14) alongside a War Camp discount
    // increase and an Orc attack buff -- the combined pass made Orc's win
    // rate WORSE in both Halfellow and Human matchups and lengthened games,
    // so reverted back to 2.50. See project_pairwise_balance_human_orc_halfellow
    // memory.
    // Cut back to 2.00 again, this time paired
    // with a brand-new tool for the same job -- Envoy (below) lets a
    // Pioneer/Wanderer claim a specific in-radius tile outright in a single
    // turn (originally a flat 2-turn channel; changed to a one-turn action
    // 2026-08-17, user-directed), independent of this multiplier. Dropping
    // this back to 2.00 keeps Envoy meaningfully useful for longer instead
    // of being immediately dwarfed by a maxed-out passive rate once this
    // tech is researched.
    description: "Gain influence in tiles 100% faster.",
    costBreakdown: { harvest: 20, coin: 18, lore: 17 },
    effects: [{ type: "fill_rate_mult", value: 2.00 }],
  },
  // A one-shot action for Pioneer/Wanderer (2026-08-17: changed from a
  // 2-turn channel to a single full-turn action, user-directed; see ai.js's
  // resolveEnvoyClaim/envoyTargetAt and its own ring-menu pill in
  // orders.js's contextMenuOptions) -- stand on an already-in-radius,
  // not-yet-owned tile and spend the turn to claim it outright, independent
  // of the normal fill-rate math -- guaranteed speed and, critically, lets
  // the player/AI CHOOSE which tile gets priority instead of waiting on the
  // passive fill order. Small cost so it isn't spammed for free;
  // deliberately not a big enough cost to matter early.
  halfellow_envoy: {
    id: "halfellow_envoy", label: "Envoy", category: "civic", layer: 4, cost: 30,
    prereqs: [], raceOnly: "halfellow",
    description: "Pioneer and Wanderer may spend a full turn on an already-in-radius, unclaimed tile to claim it outright, independent of the normal gradual fill-in rate.",
    costBreakdown: { coin: 10, harvest: 8, lore: 6 },
    effects: [{ type: "unlock_mechanic", mechanic: "envoy" }],
  },
  halfellow_hearth_and_homeland: {
    id: "halfellow_hearth_and_homeland", label: "Hearth and Homeland", category: "civic", layer: 4, cost: 50,
    prereqs: [], raceOnly: "halfellow",
    // 25%, minimum 1 point (2026-08-17, user-directed -- was 10% with no
    // floor of its own; see combat.js's healUnit for the floor).
    description: "Heal an extra 25% (minimum 1 point) per turn when resting on a filled-in tile within one of your own cities' borders (not just inside the city itself).",
    costBreakdown: { harvest: 26, lore: 24 },
    effects: [{ type: "unlock_mechanic", mechanic: "hearth_and_homeland", value: 0.25 }],
  },
  halfellow_historical_society: {
    id: "halfellow_historical_society", label: "Historical Society", category: "building", layer: 3, cost: 52,
    prereqs: ["halfellow_road_goes_ever_on"], raceOnly: "halfellow",
    description: "Unlocks the Historical Society. Its antiquarians map every Ruin on the world, revealing each one and the land immediately around it.",
    costBreakdown: { lore: 32, coin: 20 },
    effects: [{ type: "unlock_building", building: "historical_society" }],
  },
  halfellow_rouse_the_militia: {
    id: "halfellow_rouse_the_militia", label: "Rouse the Militia", category: "military", layer: 4, cost: 55,
    prereqs: ["halfellow_historical_society"], raceOnly: "halfellow",
    description: "Unlocks the Militia, a stronger standing fighter than the Wanderer.",
    costBreakdown: { harvest: 30, coin: 25 },
    effects: [{ type: "unlock_unit", unit: "militia" }],
  },
  halfellow_devoted_companions: {
    id: "halfellow_devoted_companions", label: "Devoted Companions", category: "military", layer: 4, cost: 55,
    prereqs: ["halfellow_community_fellowship"], raceOnly: "halfellow",
    description: "Halfellow units may carry any other Halfellow unit (-25% movement while carrying). The passenger heals 50% faster and doesn't need the carrier to Rest. If the carrier dies, the passenger drops onto the same tile.",
    costBreakdown: { lore: 30, harvest: 25 },
    effects: [{ type: "unlock_mechanic", mechanic: "devoted_companions" }],
  },
  // 2026-08-24: "It's Like the Great Stories" (L4, +50% XP civ-wide) was
  // removed as a separate tech -- its effect is now intrinsic to the
  // Neighborhood Pub building at +25% (see ai.js's grantXPAndAutoLevel and
  // halfellow_neighborhood_pub), part of moving buildings off economic
  // yields and onto real game effects.
  // Trouble Maker's third trick, plus Wanderer (not civ-wide -- only these
  // two unit types). Ranged debuff: target
  // resists at (their race's curiosity * 0.75), so even a maximally curious
  // race (1.0) still fails a quarter of the time. On a failed resist,
  // applies Befuddled (see combat.js's applyBefuddled) -- -50% attack, 75%
  // defense, movement capped at 1, 0% First Strike, for 2 turns.
  halfellow_riddle_game: {
    id: "halfellow_riddle_game", label: "The Riddle Game", category: "mystic", layer: 2, cost: 48,
    prereqs: ["halfellow_making_trouble"], raceOnly: "halfellow",
    description: "Trouble Maker and Wanderer may pose a riddle to an enemy unit at range. A more curious race is more likely to resist and shrug it off; otherwise the target becomes Befuddled for 2 turns: -75% attack, movement, and defense, 0% First Strike.",
    costBreakdown: { lore: 26, harvest: 22 },
    effects: [{ type: "unlock_mechanic", mechanic: "riddle" }],
  },

  // --- Layer 5 ---
  halfellow_family_and_friendship: {
    id: "halfellow_family_and_friendship", label: "Family and Friendship", category: "civic", layer: 5, cost: 95,
    prereqs: ["halfellow_historical_society", "halfellow_neighborhood_pub"], raceOnly: "halfellow",
    description: "+1 influence radius in every city.",
    costBreakdown: { lore: 40, coin: 30, harvest: 25 },
    effects: [{ type: "radius_bonus", value: 1 }],
  },
  halfellow_strategic_reserve: {
    id: "halfellow_strategic_reserve", label: "Strategic Reserve", category: "building", layer: 4, cost: 95,
    prereqs: ["halfellow_historical_society"], raceOnly: "halfellow",
    description: "Unlocks the Armory. A unit gains +50% attack and +50% defense only while its home city has an Armory built -- units trained elsewhere get nothing, even if another city of yours has one.",
    costBreakdown: { coin: 35, lore: 35, harvest: 25 },
    effects: [
      { type: "unlock_building", building: "armory" },
      { type: "unlock_mechanic", mechanic: "strategic_reserve" },
    ],
  },
  halfellow_resilient_spirit: {
    id: "halfellow_resilient_spirit", label: "Resilient Spirit", category: "military", layer: 5, cost: 90,
    prereqs: ["halfellow_family_and_friendship"], raceOnly: "halfellow",
    description: "If the next hit against a Halfellow unit (forward or counter) would kill it, 33% chance to negate all of that damage instead. Triggering forces the unit to Rest next turn, and permanently reduces that same unit's own trigger chance by 15 percentage points (floored at 0%) -- diminishing returns per unit, never resets. Additionally, Halfellow units have a 50% chance to resist being raised from the dead (if killed by an undead unit, only a 50% chance the undead turns it into a zombie under its control).",
    costBreakdown: { lore: 55, harvest: 35 },
    effects: [
      { type: "unlock_mechanic", mechanic: "resilient_spirit", value: 0.33 },
      { type: "raise_dead_resistance", value: 0.5 },
    ],
  },
  // "Banish the Darkness": Wanderer's new full-turn action, "Create The
  // Great Bonfire" -- summons a stationary, destructible object (unit
  // "great_bonfire", see units.js) on an open adjacent tile, free (costs
  // only the Wanderer's turn, no resources -- see ai.js's
  // startWandererBonfireSummon). Per-civ singleton: summoning a new one
  // dismisses this civ's own old one, if it has one. Burns for 5 turns,
  // then self-dismisses. See turns.js's beginCivTurn for its aura (heal,
  // stat buffs, negative-condition cure/immunity) and expiry tick.
  halfellow_banish_the_darkness: {
    id: "halfellow_banish_the_darkness", label: "Banish the Darkness", category: "mystic", layer: 5, cost: 95,
    prereqs: ["halfellow_hearth_and_homeland", "halfellow_devoted_companions"], raceOnly: "halfellow",
    description: "The Wanderer gains a new full-turn action: Create The Great Bonfire, summoning it onto an open adjacent tile (not Water or Mountains). Only one Great Bonfire may burn at a time for this kingdom -- summoning a new one dismisses the old. It burns for 5 turns before self-dismissing, and radiates Bonfire's Blessing in a 4-tile radius: allied units there (including the Bonfire itself) heal 10% of their max HP per turn (minimum 1) regardless of resting, gain +2 defense, +2 vision, +1 movement, +5% First Strike, and +10% Double Strike, and are cured of, and immune to, Burning, Poisoned, Frozen, Curse, Befuddled, and Webbed for as long as they stay in range.",
    costBreakdown: { lore: 55, coin: 25, harvest: 15 },
    effects: [
      { type: "unlock_unit", unit: "great_bonfire" },
      { type: "unlock_mechanic", mechanic: "banish_the_darkness" },
    ],
  },
  halfellow_rouse_the_people: {
    id: "halfellow_rouse_the_people", label: "Rouse the People", category: "military", layer: 5, cost: 95,
    prereqs: ["halfellow_hearth_and_homeland"], raceOnly: "halfellow",
    description: "Cities, walls, and buildings gain attack equal to the Militia's (if higher than their current value) and can now counterattack, but only against an attacker standing adjacent (melee range); a Ranged attack takes no counter damage. 5% chance a Militia spawns adjacent to a structure/city that's attacked; 15% chance instead if the attack actually destroys it.",
    costBreakdown: { lore: 55, harvest: 40 },
    effects: [{ type: "unlock_mechanic", mechanic: "rouse_the_people" }],
  },
  // "Set the Trap": the Trouble Maker's third
  // trick. Gated behind A Nice Day for Fishing (2026-08-26, user-directed --
  // was gated behind Ice Fishing before that, and The Riddle Game before
  // that). Unlocks BOTH trap flavors at once -- the
  // player picks Frost or Fire per placement, not a separate tech per
  // flavor. Two unlock_unit effects register both "trap_frost"/"trap_fire"
  // with techForUnit (so unitBuildCost can derive each one's resource split
  // from this tech's shared costBreakdown) even though no city can ever
  // build either -- see units.js's cityBuildable: false, mirrors Orc's Bog
  // Spirit/Wisp pattern exactly.
  halfellow_set_the_trap: {
    id: "halfellow_set_the_trap", label: "Set the Trap", category: "mystic", layer: 3, cost: 90,
    prereqs: ["halfellow_nice_day_fishing"], raceOnly: "halfellow",
    description: "The Trouble Maker may set a Frost Trap or a Fire Trap on any unoccupied tile within its own range. Either trap stays hidden indefinitely -- it is never spotted by normal means, though a splash/area attack that happens to land on it can still catch it by accident, same as any other hidden unit. The instant an enemy unit ends a move adjacent to it, the trap springs: 4 damage plus Frozen (0 movement, -25% attack, 3 turns) for a Frost Trap, or 4 damage plus Burning (1 damage/turn for 3 turns, no effect on Coast/Ocean/river) for a Fire Trap -- then the trap is spent. The Halfellow kingdom may field at most one trap (of either flavor) per living Trouble Maker.",
    costBreakdown: { harvest: 8, coin: 12, lore: 20 },
    effects: [
      { type: "unlock_unit", unit: "trap_frost" },
      { type: "unlock_unit", unit: "trap_fire" },
      { type: "unlock_mechanic", mechanic: "trap_summon" },
    ],
  },

};

window.GameData.TECH_LIST = Object.keys(window.GameData.TECHS);

window.GameData.getTech = function (techId) {
  const tech = window.GameData.TECHS[techId];
  if (!tech) throw new Error(`[GameData] Unknown tech id: "${techId}"`);
  return tech;
};

// PURE TIER-BASED COST: every tech's REAL Lore
// price is now derived entirely from its layer, not from the individually
// hand-authored `cost` field still sitting on each tech definition above --
// those numbers are inert data now, kept in place rather than mechanically
// stripped from ~150 entries for no functional gain. See
// GameConfig.research's own doc comment for the exact formula and the
// reasoning for picking baseCost/tierGrowth. Paired with tech.js's
// chooseResearch/researchTurns: the FULL cost is paid up front from the
// civ's stockpile the moment research starts (same one-time-purchase model
// GameData.unitBuildCost/buildingBuildCost already use for units and
// buildings), and researchTurns derives a turn-count timer from this same
// cost -- cost and time are two independent formulas fed by the same tier
// number, exactly mirroring how a unit's build cost and build time both
// derive from unitPower without one being computed from the other.
// `?? 1`, not `|| 1`: a real Level 0 tech's
// `layer` is literally 0, which `||` treats as falsy and would wrongly
// substitute 1 -- `??` only substitutes on null/undefined, so an explicit
// 0 passes through correctly (Level 0 tech tree items are all
// auto-completed and never actually pay this, but the tree still DISPLAYS
// this number, and unitTechLayer/unitLayerPremium below read layer the
// same way for a Level 0 unit's real build cost).
window.GameData.effectiveTechCost = function (tech) {
  const cfg = window.GameConfig.research;
  return cfg.baseCost * Math.pow(cfg.tierGrowth, tech.layer ?? 1);
};

// Tech cost mix: every tech's cost used to be
// paid entirely in Lore -- now split across harvest/coin/lore by column,
// each ratio reflecting what that kind of research draws on: Civic leans
// Harvest (labor/population-driven), Building leans Coin (construction),
// Military splits Coin/Lore evenly (drilling + doctrine) with a smaller
// Harvest slice (provisioning). Categories outside the 3 real columns
// fall back to Civic's ratio -- same fallback techtree.js's own columnFor
// already uses for display. The TOTAL magnitude is unchanged
// (effectiveTechCost's own pure-layer formula) -- only how it's split
// across resources changes.
// mystic (Wizard/Druid/Metal Singer/Bog Witch/Trouble Maker): leans Lore
// harder than Military does, reflecting arcane study rather than martial
// drilling -- its own distinct economic identity, same as how each of the
// other three leans a different resource.
window.GameData.TECH_COST_RATIO = {
  civic: { harvest: 0.5, coin: 0.2, lore: 0.3 },
  building: { harvest: 0.1, coin: 0.6, lore: 0.3 },
  military: { harvest: 0.2, coin: 0.4, lore: 0.4 },
  mystic: { harvest: 0.1, coin: 0.3, lore: 0.6 },
};

window.GameData.techCostRatio = function (tech) {
  return window.GameData.TECH_COST_RATIO[tech.category] || window.GameData.TECH_COST_RATIO.civic;
};

/** A tech's real cost, split across harvest/coin/lore by techCostRatio --
 *  paid up front from the civ's stockpile the moment chooseResearch picks
 *  it (see tech.js), same one-time-purchase model as unitBuildCost/
 *  buildingBuildCost. Rounds each component independently, same convention
 *  those two already use. */
window.GameData.effectiveTechCostBreakdown = function (tech) {
  const total = window.GameData.effectiveTechCost(tech);
  const ratio = window.GameData.techCostRatio(tech);
  return {
    harvest: Math.round(total * ratio.harvest),
    coin: Math.round(total * ratio.coin),
    lore: Math.round(total * ratio.lore),
  };
};

/** Techs available to a given race: shared (no raceOnly) + that race's own raceOnly nodes,
 *  minus any shared node explicitly excluded for that race (excludedRaces). */
window.GameData.techsForRace = function (raceId) {
  return window.GameData.TECH_LIST.filter((id) => {
    const t = window.GameData.TECHS[id];
    if (t.raceOnly) return t.raceOnly === raceId;
    return !(t.excludedRaces || []).includes(raceId);
  });
};

/**
 * POWER-BASED UNIT BUILD COST
 * ---------------------------
 * Replaces the old flat per-unit coinCost (units.js) for any unit that has
 * an "associated tech" -- see ai.js's buildUnitOption/unitBuildTurns for how
 * this feeds into the actual build queue (one-time purchase from
 * civ.stockpile, then a fixed turn-count timer instead of a coin-income
 * countdown).
 */

/** Sum of a unit's BASE attack+defense+movement+visionRadius (units.js), plus
 *  a weighted contribution from its other combat-relevant PROPERTIES --
 *  0.75 per point of range (so a Ranged unit's reach counts toward its power,
 *  not just its stats), 1.0 per point of firstStrikePct (a 0-1 value, so e.g.
 *  0.25 First Strike adds 0.25 power), 1.0 per point of siegePct (same
 *  per-point weight as firstStrikePct -- both are combat-effectiveness
 *  multipliers rather than raw stats, see militaryValue's analogous credit
 *  in ai.js), and a flat +2 if it's Flying -- deliberately never includes
 *  tech-granted unitOverrides bonuses (see combat.js effectiveAttack/
 *  effectiveDefense), since a unit's build cost shouldn't retroactively
 *  change as its owner researches upgrades. Added siegePct 2026-07-15 after
 *  a headless regression run turned up 8-9 simultaneous Runeforged Titans in
 *  a single 250-turn game -- its 3.00 siegePct was invisible to this formula,
 *  undercosting it below Orc's Dragon despite the Titan being a much
 *  stronger siege unit; the existing `rare`-flag premium (ai.js
 *  RARE_UNIT_PREMIUM_RATE) was compounding from that too-low a baseline.
 *  Titan's own defense was separately raised to reflect its `siegeTarget`
 *  redesign (see units.js) -- that flows through the plain `defense` term
 *  above with no dedicated weighting needed. See project_titan_cost_underpricing
 *  memory. */
window.GameData.unitPower = function (unitId) {
  const u = window.GameData.getUnit(unitId);
  return (u.attack || 0) + (u.defense || 0) + (u.movement || 0) + (u.visionRadius || 0)
    + (u.range || 1) * 0.75 + (u.firstStrikePct || 0) + (u.siegePct || 0)
    // Double Strike is worth considerably more per point than First Strike or
    // Siege: those shade an exchange's outcome, while this one adds a whole
    // extra uncountered hit. Weighted 2.0/point (i.e. a 50% Double Strike is
    // worth ~1 power) on the reading that it multiplies expected forward
    // damage by (1 + pct) -- roughly half an extra attack's worth at 50%,
    // and free of any counter-damage cost.
    + (u.doubleStrikePct || 0) * 2.0
    + (u.flying ? 2 : 0);
};

/** Which tech first grants a given unit id (via unlock_unit or, for a
 *  replacement unit like Knight/Longbowman/Trebuchet, replace_unit's `to`),
 *  scanned once across every tech's effects. Pioneer, Galley, and Scout
 *  each resolve to their own Level 0 tech (pioneer_infrastructure/
 *  distant_shores/distant_horizons, 2026-08-06 -- previously bundled into
 *  one "shared_infrastructure" tech) -- the Level 0 techs every civ starts
 *  with already completed -- each of which carries its own costBreakdown
 *  (2026-08-05), so unitBuildCost below prices these 3 the same
 *  power-derived, multi-resource way as every other teched unit; their old
 *  units.js flat coinCost field has been removed. */
window.GameData._TECH_FOR_UNIT = (() => {
  const map = {};
  for (const tech of Object.values(window.GameData.TECHS)) {
    for (const effect of tech.effects || []) {
      if (effect.type === "unlock_unit") map[effect.unit] = tech.id;
      if (effect.type === "replace_unit") map[effect.to] = tech.id;
    }
  }
  return map;
})();
window.GameData.techForUnit = function (unitId) {
  return window.GameData._TECH_FOR_UNIT[unitId] || null;
};

/** Tech-tree depth the unit was FIRST unlocked at (the unlocking tech's own
 *  `layer`, e.g. Wizard staying at whatever layer originally unlocked it
 *  even after later techs buff its stats via unitOverrides -- an upgrade
 *  doesn't relocate the unit in the tree). 1 is now only a defensive
 *  fallback for malformed data -- every real unit resolves to a real tech
 *  since Level 0's own techs (2026-08-06) cover Pioneer, Galley, and Scout,
 *  the last 3 that used to have none at all. `?? 1`, not `|| 1` -- a
 *  Level 0 unit's real layer is 0, which `||` would wrongly treat as
 *  missing and substitute 1 for, silently overcharging unitLayerPremium
 *  below (Math.pow(1.18, 1) instead of the correct Math.pow(1.18, 0) = 1,
 *  i.e. no premium at all -- exactly what a Level 0 unit should get). */
window.GameData.unitTechLayer = function (unitId) {
  const techId = window.GameData.techForUnit(unitId);
  if (!techId) return 1;
  return window.GameData.TECHS[techId].layer ?? 1;
};

// Deliberately smaller than the tech tree's own cost growth (see
// GameConfig.research's own doc comment) -- unit power already trends up
// with layer on its own (deeper units tend to have better stats), so this is
// a second, thinner "sophistication tax" layered on top of that, not a
// restatement of it. Exponent is the RAW layer, matching
// effectiveTechCost's own convention -- a layer-5 unit (Dragon-tier) lands
// at roughly (1.18)^5 =~2.3x a layer-1 unit of identical power.
const LAYER_PREMIUM_RATE = window.GameConfig.units.buildLayerPremiumRate;

/** Multiplier applied to unitBuildCost (the one-time purchase) for how deep
 *  in the tech tree a unit sits. Makes late-tree units expensive to actually
 *  build on top of (not instead of) their raw power already making them
 *  pricey. */
window.GameData.unitLayerPremium = function (unitId) {
  const layer = window.GameData.unitTechLayer(unitId);
  return Math.pow(1 + LAYER_PREMIUM_RATE, layer);
};

// Deliberately much steeper than LAYER_PREMIUM_RATE above -- a one-time
// purchase only limits how FAST a civ can amass an elite army, but ongoing
// upkeep is what determines whether it can actually be SUSTAINED turn after
// turn. At this rate a layer-5 unit's upkeep runs roughly (1.40)^5 =~5.4x a
// layer-1 unit's (raw layer exponent now, not layer-1 -- see
// unitLayerPremium's own comment), for identical raw power -- steep enough
// that fielding an entire army of top-tier units (not just a few, on top of
// a mixed-tier core) should bankrupt the economy that's paying for it,
// rather than merely costing more the way the one-time build price does.
const UPKEEP_LAYER_PREMIUM_RATE = window.GameConfig.units.upkeepLayerPremiumRate;

/** Same shape as unitLayerPremium above (raw layer as the exponent, not
 *  layer-1), but at UPKEEP_LAYER_PREMIUM_RATE -- used ONLY by unitUpkeep,
 *  never unitBuildCost. Kept as a separate function (not a shared helper
 *  parameterized by rate) so each call site's intent reads directly from
 *  its own name at the call site. */
window.GameData.unitUpkeepLayerPremium = function (unitId) {
  const layer = window.GameData.unitTechLayer(unitId);
  return Math.pow(1 + UPKEEP_LAYER_PREMIUM_RATE, layer);
};

/** Power-based build cost for a unit with an associated tech -- null falls
 *  the caller back to the unit's old flat coinCost instead (see
 *  ai.js buildUnitOption). Total resource cost = unitPower * 3 * the
 *  tech-layer premium above, split across whichever harvest/coin/lore keys
 *  the unlocking tech's own costBreakdown uses, in that tech's own ratio
 *  (e.g. a tech that's 11 lore/4 coin -- 73%/27% -- splits the unit's total
 *  the same way). Deliberately reuses only the tech's resource-type MIX,
 *  not its absolute numbers -- those were hand-tuned per node during
 *  design, not derived from unit power, so reusing them directly wouldn't
 *  actually scale with power the way this is meant to. */
window.GameData.unitBuildCost = function (unitId) {
  const techId = window.GameData.techForUnit(unitId);
  if (!techId) return null;
  const breakdown = window.GameData.TECHS[techId].costBreakdown;
  if (!breakdown) return null;
  const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const total = window.GameData.unitPower(unitId) * 3 * window.GameData.unitLayerPremium(unitId);
  const cost = {};
  for (const [k, v] of Object.entries(breakdown)) {
    cost[k] = Math.round(total * (v / sum));
  }
  return cost;
};

// Upkeep's resource split is fixed and universal -- NOT the unlocking
// tech's cost ratio (unlike unitBuildCost/the one-time purchase). Most
// units draw upkeep mostly from Harvest (garrisons/armies are provisioned,
// not paid in scholarship); the 3 thematically "magical" units draw a
// slice from Lore instead, reflecting the arcane upkeep of maintaining
// them (spellwork, wards, the Bog Witch's curse-magic).
const UNIT_UPKEEP_SPLIT_DEFAULT = window.GameConfig.units.upkeepSplitDefault;
const UNIT_UPKEEP_SPLIT_MAGICAL = window.GameConfig.units.upkeepSplitMagical;
const MAGICAL_UNIT_IDS = new Set(window.GameConfig.units.magicalUnitIds);

// Base upkeep rate: 10% -> 35%. Measured
// directly in a real 900-turn game (see [[project_roads_upkeep_stall_review]])
// that at 10% a 19-unit army (14 military) cost only 6.3%/3.4% of a civ's
// harvest/coin income -- a rounding error, not real economic pressure, and
// the direct mechanical cause of that same review's finding that every
// race ends a typical game sitting on 95-142 turns' worth of unspent
// harvest/coin. 35% (a 3.5x raise) is meant to make upkeep a genuinely
// felt cost of fielding an army without stifling normal play -- applies
// uniformly to every race through this same formula, so it shouldn't
// disturb relative race balance on its own. Re-validate via a headless
// balance batch after any further change to this constant, same caveat
// this project's own code has flagged before for the layer-premium rate
// just below (see UPKEEP_LAYER_PREMIUM_RATE's comment).
const UPKEEP_BASE_RATE = window.GameConfig.units.upkeepBaseRate;

/** Ongoing per-turn upkeep for a unit: UPKEEP_BASE_RATE of its raw power
 *  (GameData.unitPower -- NOT its build cost; upkeep is deliberately
 *  cheaper than the one-time purchase) times unitUpkeepLayerPremium -- a
 *  deliberately steeper tech-layer premium than unitBuildCost's, so a
 *  deep-tree unit's ONGOING cost outpaces its one-time price the longer a
 *  civ keeps fielding it (see UPKEEP_LAYER_PREMIUM_RATE above) -- split
 *  across resources per UNIT_UPKEEP_SPLIT_DEFAULT/_MAGICAL above. Defined
 *  for every unit (power is always computable, even for Pioneer/Galley/
 *  Scout), so unlike unitBuildCost there's no tech-lookup fallback needed
 *  here at all. Not rounded -- civ.stockpile already accumulates fractional
 *  amounts every turn, same as income.
 *
 *  `civ` is optional (omit for a context-free "sticker price", e.g. a
 *  build-menu tooltip for a unit not yet owned). When passed, and the unit
 *  is military category, the result is further scaled by
 *  ai.js's upkeepStrainMultiplier(civ) -- the army-size-driven economic
 *  strain that kicks in once a civ's land military outgrows what its
 *  population/militarism can sustain at ease. That's an orthogonal, SIZE-
 *  driven penalty; this function's own layer premium is a COMPOSITION-driven
 *  one -- together they mean a large army is expensive regardless of tier,
 *  and an all-elite army is expensive regardless of size. Non-military
 *  units (Pioneer/Galley/Scout) never carry strain -- it's a military
 *  logistics burden, not a general upkeep tax.
 *
 *  War Camp upkeep discount (2026-07-14): a unitCostMult-granting structure
 *  (currently only Orc's War Camp) previously ONLY discounted the one-time
 *  build cost/time (see ai.js buildUnitOption), never the ongoing per-turn
 *  upkeep computed here -- meaning it did nothing to relieve the upkeep
 *  strain that throttles chooseBuildAction's militaryEconMult once a civ's
 *  army outpaces its income. Civ-wide (any city with the structure, not
 *  scoped to a unit's home city -- upkeep is computed per unit TYPE here,
 *  not per unit instance by default, so there's no home-city to check against
 *  the way buildUnitOption's build-time cost discount can). Generic over any
 *  future unitCostMult building, not hardcoded to War Camp by name -- takes
 *  the best (lowest) discount across the civ's own structures, same
 *  selection rule chooseBuildAction already uses for the cost/build-time
 *  side.
 *
 *  `unit` is the optional actual unit INSTANCE,
 *  not just its type -- when passed and `unit.startingUnit` is set, upkeep
 *  is zero regardless of everything else. Civ-creation's free starting
 *  Pioneer/2-Scouts (see main.js createNewGame) are stamped with this flag;
 *  any later-built scout (or anything else) never gets it, so it costs
 *  upkeep normally like every other unit -- this is a one-time perk on the
 *  specific starting-unit instances, not a blanket exemption for the
 *  Scout/Pioneer unit TYPES. Every caller that iterates real owned units
 *  (totalUnitUpkeep, the per-turn stockpile deduction in turns.js, sidebar
 *  displays) passes the instance; canAffordUnitUpkeep's "what would one
 *  more cost" check has no instance to pass (there isn't one yet) and
 *  correctly omits it, so a hypothetical new unit is never accidentally
 *  treated as free. */
window.GameData.unitUpkeep = function (unitId, civ, unit) {
  if (unit && unit.startingUnit) return { harvest: 0, coin: 0, lore: 0 };
  const unitData = window.GameData.getUnit(unitId);
  // Elf Raptor/Shadowsteed: `noUpkeep: true`
  // (units.js) -- both are Druid-summoned support units (scout / carrier),
  // not standing-army units, so they carry no ongoing cost at all.
  if (unitData.noUpkeep) return { harvest: 0, coin: 0, lore: 0 };
  let total = window.GameData.unitPower(unitId) * UPKEEP_BASE_RATE * window.GameData.unitUpkeepLayerPremium(unitId);
  // Disposable-filler discount (2026-07-14): a `cheap: true` unit (currently
  // only Orc's Goblin Miscreant) also carries 30% less ongoing upkeep, same
  // rate/flag as buildUnitOption's cost/build-time discount (ai.js) --
  // applied unconditionally (not gated on `civ` below) since it's an
  // intrinsic property of the unit itself, not a civ-side structure bonus.
  if (unitData.cheap) total *= 0.50;
  if (civ) {
    if (unitData.category === "military") {
      total *= window.GameEngine.ai.upkeepStrainMultiplier(civ);
    }
    let upkeepDiscount = 1.0;
    for (const city of civ.cities || []) {
      for (const s of city.structures || []) {
        const b = window.GameData.getBuilding(s.id);
        if (b.unitCostMult && b.unitCostMult < upkeepDiscount) upkeepDiscount = b.unitCostMult;
      }
    }
    total *= upkeepDiscount;
  }
  const split = MAGICAL_UNIT_IDS.has(unitId) ? UNIT_UPKEEP_SPLIT_MAGICAL : UNIT_UPKEEP_SPLIT_DEFAULT;
  const upkeep = {};
  for (const [k, pct] of Object.entries(split)) upkeep[k] = total * pct;
  return upkeep;
};
