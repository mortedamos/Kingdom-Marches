/**
 * TECH TREE DATA
 * --------------
 * Shared shape: every race's tree is 5 LAYERS deep across 3 columns —
 * Civic, Building, Military. Layers are the unit of "power": cost
 * scales ~1.4x per layer, and a layer can hold more than one node (a
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
 *   terrain_movement_bonus  { terrain, value }  +movement points while starting a move on that terrain (civ-wide)
 *   unit_terrain_movement_bonus { terrain, value, units }  same, but scoped to specific unit type ids only
 *   unlock_mountain_tunneling               makes Mountains passable (slow) for this civ
 *   unlock_mechanic         { mechanic }     generic flag for bespoke mechanics (e.g. "dark_ritual")
 *   building_count_bonus    { bonus }        flat per-turn yield scaling with a city's built (non-wall) structure count
 *   fill_rate_mult          { value }        multiplies a city's per-turn tile fill-in rate (civ-wide)
 *   universal_range_grant   { value }        floor on every unit's effective Ranged value (civ-wide,
 *                                            Math.max against the unit's own range -- never lowers it)
 *
 * `costBreakdown` on race-tree nodes is a PROPOSED multi-resource cost
 * (lore/coin/harvest) for review. The research engine currently only
 * spends Lore (the `cost` field) — costBreakdown is not yet wired in;
 * see the tech-tree design doc for the pending decision on that change.
 */

window.GameData = window.GameData || {};

window.GameData.TECHS = {
  // --- Shared infrastructure (still used by the 3 races whose trees haven't
  // been redesigned yet). Excluded for Human, Orc, and Halfellow -- their
  // full trees (below) are complete replacements, and Human gets Scout for
  // free at civ creation instead (main.js), same as Pioneer/Galley.
  // (Worker/toolcraft removed entirely -- Worker is deprecated, folded into
  // Pioneer's canImprove.) ---
  beast_sense: {
    id: "beast_sense", label: "Beast-Sense", category: "economy", layer: 1, cost: 10,
    prereqs: [], excludedRaces: ["human", "orc", "halfellow"],
    effects: [{ type: "unlock_unit", unit: "scout" }],
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
    description: "Unlocks the Spearguard (high defense, low attack, low movement).",
    costBreakdown: { lore: 11, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "spearguard" }],
  },
  spirit_of_exploration: {
    id: "spirit_of_exploration", label: "Spirit of Exploration", category: "civic", layer: 1, cost: 14,
    prereqs: [], raceOnly: "human",
    description: "+1 movement when starting a move on Plains.",
    costBreakdown: { lore: 14 },
    effects: [{ type: "terrain_movement_bonus", terrain: "plains", value: 1 }],
  },
  rivercraft: {
    id: "rivercraft", label: "Rivercraft", category: "civic", layer: 1, cost: 14,
    prereqs: [], raceOnly: "human",
    description: "+1 movement when starting a move on Rivers.",
    costBreakdown: { lore: 14 },
    // "river" is a pseudo-terrain key: rivers overlay any base terrain
    // (tile.hasRiver), so moveUnitToward checks it separately -- see ai.js.
    effects: [{ type: "terrain_movement_bonus", terrain: "river", value: 1 }],
  },
  homestead: {
    id: "homestead", label: "Homestead", category: "civic", layer: 1, cost: 20,
    prereqs: [], raceOnly: "human",
    description: "+0.5 harvest from Plains.",
    costBreakdown: { lore: 14, coin: 6 },
    effects: [{ type: "unlock_tile_bonus", terrain: "plains", bonus: { harvest: 0.5 } }],
  },
  // --- Layer 2 ---
  marketcraft: {
    id: "marketcraft", label: "Marketcraft", category: "building", layer: 2, cost: 20,
    prereqs: [], raceOnly: "human",
    description: "Unlocks the Bazaar (+10% harvest/turn, this city only).",
    costBreakdown: { coin: 12, harvest: 8 },
    effects: [{ type: "unlock_building", building: "bazaar" }],
  },
  defense_of_the_kingdom: {
    id: "defense_of_the_kingdom", label: "Defense of the Kingdom", category: "military", layer: 2, cost: 22,
    prereqs: ["spears_raised"], raceOnly: "human",
    description: "Spearguard gains +5 defense while garrisoned in a city or on a building tile.",
    costBreakdown: { lore: 22 },
    effects: [{ type: "garrison_defense_bonus", unit: "spearguard", value: 5 }],
  },
  longspear: {
    id: "longspear", label: "Longspear", category: "military", layer: 2, cost: 22,
    prereqs: ["spears_raised"], raceOnly: "human",
    // FLAGGED FOR REVIEW: this tech used to also reduce how much a
    // First-Strike attacker's counter-damage-taken got shrunk (via the now-
    // removed ranged_negation_reduction effect/mechanic) -- that entire
    // effect no longer exists anywhere in combat.js (First Strike no longer
    // touches counter damage at all), so it's been dropped here rather than
    // left as dead data. Only the stat upgrade remains; this tech may be
    // worth redesigning with a new effect to fill the gap.
    description: "Grants the Spearguard +2 attack and +1 defense.",
    costBreakdown: { lore: 22 },
    effects: [
      { type: "unit_stat_upgrade", unit: "spearguard", changes: { attack: 2, defense: 1 } },
    ],
  },
  cavalry_training: {
    id: "cavalry_training", label: "Cavalry Training", category: "military", layer: 2, cost: 25,
    prereqs: [], raceOnly: "human",
    description: "Unlocks the Cavalry (relatively high movement).",
    costBreakdown: { lore: 17, harvest: 8 },
    effects: [{ type: "unlock_unit", unit: "cavalry" }],
  },
  archery: {
    id: "archery", label: "Archery", category: "military", layer: 2, cost: 25,
    prereqs: [], raceOnly: "human",
    description: "Unlocks the Archer (Ranged 2).",
    costBreakdown: { lore: 17, coin: 8 },
    effects: [{ type: "unlock_unit", unit: "archer" }],
  },
  trade_roads: {
    id: "trade_roads", label: "Trade Roads", category: "civic", layer: 2, cost: 40,
    prereqs: ["homestead"], raceOnly: "human",
    description: "+1 coin per road tile within a city's radius.",
    costBreakdown: { coin: 40 },
    effects: [{ type: "unlock_feature_bonus", feature: "road", bonus: { coin: 1 } }],
  },
  make_way: {
    id: "make_way", label: "Make Way", category: "civic", layer: 2, cost: 22,
    prereqs: ["rivercraft"], raceOnly: "human",
    description: "Galleys gain +2 movement and +1 vision.",
    costBreakdown: { coin: 14, lore: 8 },
    effects: [{ type: "unit_stat_upgrade", unit: "galley", changes: { movement: 2, visionRadius: 1 } }],
  },

  // --- Layer 3 ---
  guild_charter: {
    id: "guild_charter", label: "Guild Charter", category: "building", layer: 3, cost: 35,
    prereqs: [], raceOnly: "human", // only the L3 city-gate applies
    description: "Unlocks the Guild Hall (+10% coin/turn, this city only).",
    costBreakdown: { lore: 22, coin: 13 },
    effects: [{ type: "unlock_building", building: "guild_hall" }],
  },
  knighthood: {
    id: "knighthood", label: "Knighthood", category: "military", layer: 3, cost: 45,
    prereqs: ["cavalry_training"], raceOnly: "human",
    description: "Unlocks the Knight (high movement, high attack) -- replaces Cavalry.",
    costBreakdown: { harvest: 20, lore: 15, coin: 10 },
    effects: [{ type: "replace_unit", from: "cavalry", to: "knight" }],
  },
  longbow: {
    id: "longbow", label: "Longbow", category: "military", layer: 3, cost: 40,
    prereqs: ["archery"], raceOnly: "human",
    description: "Unlocks the Longbowman (higher attack, Ranged 3) -- replaces Archer.",
    costBreakdown: { lore: 28, coin: 12 },
    effects: [{ type: "replace_unit", from: "archer", to: "longbowman" }],
  },
  catapult_engineering: {
    id: "catapult_engineering", label: "Catapult Engineering", category: "military", layer: 3, cost: 40,
    prereqs: ["archery"], raceOnly: "human",
    description: "Unlocks the Catapult (low movement, Ranged 2, Siege 100%) -- a separate unit from Archer/Longbowman, not a replacement.",
    costBreakdown: { lore: 28, coin: 12 },
    effects: [{ type: "unlock_unit", unit: "catapult" }],
  },
  wizardry: {
    // Moved L3 -> L2 (2026-07-17, user-directed). No prereq-chain risk: this
    // tech has no prereqs of its own, and every tech that depends on IT
    // (freezing_touch/flight at L3, dungeon_delve/mage_college_tech/
    // teleportation at L4) stays strictly later, so the chain is still
    // valid. `cost`/`costBreakdown` deliberately left as-is -- the layer
    // change alone already cuts the EFFECTIVE research cost via
    // techLayerPremium (1.15^(layer-1): ~1.32x at L3 down to 1.15x at L2),
    // plus the Wizard unit's own build-cost/upkeep layer premiums (which
    // key off this tech's layer too) -- retuning the raw sticker cost on
    // top of that is a separate balance lever the user didn't ask for.
    id: "wizardry", label: "Wizardry", category: "military", layer: 2, cost: 45,
    prereqs: [], raceOnly: "human",
    description: "Unlocks the Wizard (Ranged 2).",
    costBreakdown: { lore: 32, coin: 13 },
    effects: [{ type: "unlock_unit", unit: "wizard" }],
  },
  freezing_touch: {
    id: "freezing_touch", label: "Freezing Touch", category: "military", layer: 3, cost: 42,
    prereqs: ["wizardry"], raceOnly: "human",
    description: "The Wizard may use this action to apply the Frozen condition (0 movement, -25% attack) to an enemy unit within short range for 3 turns.",
    costBreakdown: { lore: 30, coin: 12 },
    effects: [{ type: "unlock_mechanic", mechanic: "freezing_touch" }],
  },
  common_tongue: {
    id: "common_tongue", label: "Common Tongue", category: "civic", layer: 3, cost: 55,
    prereqs: ["trade_roads"], raceOnly: "human",
    description: "+3 lore per turn for each city owned.",
    costBreakdown: { lore: 55 },
    effects: [{ type: "lore_per_city", value: 3 }],
  },
  ramparts: {
    // category "building" (2026-07-20, user-directed) despite unlocking no
    // building of its own -- filed there anyway per the user's explicit call.
    id: "ramparts", label: "Ramparts", category: "building", layer: 3, cost: 40,
    prereqs: ["archery"], raceOnly: "human",
    description: "Walls and cities can counterattack, with an attack rating (at least the Archer's), the Archer's own Ranged reach (an attacker standing further away than that takes no counter damage at all), and a 25% discount against a First-Strike attacker -- same convention as Halfellow's Rouse the People but with no attack bonus or militia spawn.",
    costBreakdown: { lore: 28, coin: 12 },
    effects: [{ type: "unlock_mechanic", mechanic: "ramparts" }],
  },
  flight: {
    id: "flight", label: "Flight", category: "military", layer: 3, cost: 60,
    prereqs: ["wizardry"], raceOnly: "human",
    description: "As an action (that consumes their turn), a Wizard may grant an adjacent allied unit the Flying property, along with +2 movement and +2 vision, for 5 turns.",
    costBreakdown: { lore: 42, coin: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "flight_grant" }],
  },

  // --- Layer 4 ---
  dungeon_delve: {
    id: "dungeon_delve", label: "Dungeon Delve", category: "civic", layer: 4, cost: 40,
    prereqs: ["wizardry"], raceOnly: "human",
    description: "A Wizard on a Ruin may start Delving it: a full-turn action that continues automatically (no move/attack) until cancelled, gradually claiming the 1-tile radius around itself just like a city fills in its own tiles (counts toward territorial victory like any owned tile), and yielding +3 lore/+3 coin per turn. Instantly loses everything it was claiming/generating if cancelled, the Wizard moves off the Ruin, or it dies.",
    costBreakdown: { lore: 26, coin: 14 },
    effects: [{ type: "unlock_mechanic", mechanic: "dungeon_delve" }],
  },
  mage_college_tech: {
    id: "mage_college_tech", label: "Mage College", category: "building", layer: 4, cost: 50,
    prereqs: ["wizardry"], raceOnly: "human",
    description: "Unlocks the Mage College (+20% lore/turn, this city only).",
    costBreakdown: { lore: 35, coin: 15 },
    effects: [{ type: "unlock_building", building: "mage_college" }],
  },
  trebuchet_engineering: {
    id: "trebuchet_engineering", label: "Trebuchet Engineering", category: "military", layer: 4, cost: 55,
    prereqs: ["catapult_engineering"], raceOnly: "human",
    description: "Unlocks the Trebuchet (very low movement, Ranged 2, Siege 200%) -- replaces Catapult.",
    costBreakdown: { lore: 38, coin: 17 },
    effects: [{ type: "replace_unit", from: "catapult", to: "trebuchet" }],
  },
  battle_mage: {
    id: "battle_mage", label: "Battle Mage", category: "military", layer: 4, cost: 55,
    prereqs: ["mage_college_tech"], raceOnly: "human",
    // This used to raise the Wizard's firstStrikePct (0.50->0.75) -- Wizard
    // no longer has that property at all (its identity moved to `range`, see
    // units.js), so this now grants +1 Ranged (base 2 -> 3) instead, on top
    // of the existing attack/defense bump. range is additive here (see
    // combat.js's effectiveRange), same as attack/defense -- it adds to the
    // Wizard's base 2 rather than replacing it.
    description: "Wizard upgraded in place (not replaced): Ranged rises to 3, plus improved attack and defense.",
    costBreakdown: { lore: 40, coin: 15 },
    effects: [{ type: "unit_stat_upgrade", unit: "wizard", changes: { range: 1, attack: 3, defense: 3 } }],
  },
  teleportation: {
    id: "teleportation", label: "Teleportation", category: "military", layer: 4, cost: 60,
    prereqs: ["wizardry"], raceOnly: "human",
    description: "Wizard may instantly move to any unoccupied tile the civ can see -- costs the whole turn (no move/attack after). The Wizard cannot act again until healed to 100% HP.",
    costBreakdown: { lore: 60, coin: 30 },
    effects: [{ type: "unlock_mechanic", mechanic: "teleportation" }],
  },
  chivalric_order: {
    id: "chivalric_order", label: "Chivalric Order", category: "military", layer: 4, cost: 55,
    prereqs: ["knighthood"], raceOnly: "human",
    description: "Unlocks the Paladin (high attack and defense) -- replaces Knight.",
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
    id: "palace_charter", label: "Palace Charter", category: "building", layer: 5, cost: 90,
    prereqs: ["sovereign_power"], raceOnly: "human",
    description: "Unlocks the Palace (+1 influence radius to the city it's built next to). Stacks with Sovereign Power on that city -- deliberately: Humans get an outsized late-game influence advantage on their capital.",
    costBreakdown: { harvest: 25, lore: 20, coin: 15 },
    effects: [{ type: "unlock_building", building: "palace" }],
  },
  fireball: {
    id: "fireball", label: "Fireball!", category: "military", layer: 5, cost: 65,
    prereqs: ["battle_mage"], raceOnly: "human",
    description: "Wizard gains Siege 75% and higher attack; damage also splashes to every enemy unit and structure adjacent to the target. Every hit -- the primary target and every splash victim, including units, buildings, and walls (not cities themselves) -- also catches fire: the Burning condition deals 1 damage at the start of the burning unit's turn for 3 turns, unless it's currently on Coast, Ocean, or a river tile.",
    costBreakdown: { lore: 65, coin: 30 },
    effects: [
      { type: "unit_stat_upgrade", unit: "wizard", changes: { siegePct: 0.75, attack: 3 } },
      { type: "unlock_mechanic", mechanic: "fireball_splash" },
    ],
  },
  invulnerability: {
    id: "invulnerability", label: "Invulnerability", category: "military", layer: 5, cost: 60,
    prereqs: ["battle_mage"], raceOnly: "human",
    description: "The wizard unit gains 33% chance to negate all damage from both incoming attacks and counterattacks.",
    costBreakdown: { lore: 60, coin: 30 },
    effects: [{ type: "unlock_mechanic", mechanic: "invulnerability_chance", value: 0.33 }],
  },
  invisibility: {
    id: "invisibility", label: "Invisibility", category: "military", layer: 5, cost: 60,
    prereqs: ["battle_mage"], raceOnly: "human",
    description: "The wizard unit can use an action to gain the hidden condition for 3 turns.",
    costBreakdown: { lore: 40, coin: 20 },
    effects: [{ type: "unlock_mechanic", mechanic: "invisibility" }],
  },
  crusade: {
    id: "crusade", label: "Crusade", category: "military", layer: 5, cost: 90,
    prereqs: ["chivalric_order", "sovereign_power"], raceOnly: "human",
    description: "The Paladin exudes a holy aura: in a 1-tile radius around itself (including itself), allied units heal 20% of their HP per turn regardless of whether they're resting, and gain +1 attack, +1 defense, and +25% siege.",
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
    description: "+1 movement when starting a move on Forest.",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_bonus", terrain: "forest", value: 1 }],
  },
  elf_nature_provides: {
    id: "elf_nature_provides", label: "Nature Provides", category: "civic", layer: 1, cost: 18,
    prereqs: [], raceOnly: "elf",
    description: "+0.5 harvest from Forest.",
    costBreakdown: { lore: 12, coin: 6 },
    effects: [{ type: "unlock_tile_bonus", terrain: "forest", bonus: { harvest: 0.5 } }],
  },
  elf_murmuring_of_leaves: {
    id: "elf_murmuring_of_leaves", label: "The Murmuring of Leaves", category: "civic", layer: 1, cost: 16,
    prereqs: [], raceOnly: "elf",
    description: "+0.5 lore from Forest.",
    costBreakdown: { lore: 16 },
    effects: [{ type: "unlock_tile_bonus", terrain: "forest", bonus: { lore: 0.5 } }],
  },
  elf_architecture_of_light_and_air: {
    id: "elf_architecture_of_light_and_air", label: "Architecture of Light and Air", category: "civic", layer: 1, cost: 20,
    prereqs: [], raceOnly: "elf",
    description: "+2 lore per building constructed in a city (walls don't count).",
    costBreakdown: { lore: 14, coin: 6 },
    effects: [{ type: "building_count_bonus", bonus: { lore: 2 } }],
  },
  elf_whispering_waters: {
    id: "elf_whispering_waters", label: "Whispering Waters", category: "civic", layer: 2, cost: 20,
    prereqs: [], raceOnly: "elf",
    description: "+0.75 lore from river.",
    costBreakdown: { lore: 14, coin: 6 },
    effects: [{ type: "unlock_feature_bonus", feature: "river", bonus: { lore: 0.75 } }],
  },
  elf_reverie_of_sunset: {
    id: "elf_reverie_of_sunset", label: "Reverie of Sunset", category: "civic", layer: 2, cost: 28,
    prereqs: ["elf_architecture_of_light_and_air"], raceOnly: "elf",
    description: "+8 lore from any tile with a ruin covered by elven influence.",
    costBreakdown: { lore: 20, coin: 8 },
    effects: [{ type: "unlock_feature_bonus", feature: "ruin", bonus: { lore: 8 } }],
  },
  elf_longstrider: {
    id: "elf_longstrider", label: "Longstrider", category: "civic", layer: 2, cost: 20,
    prereqs: [], raceOnly: "elf",
    description: "+1 movement when starting a move on Plains.",
    costBreakdown: { lore: 20 },
    effects: [{ type: "terrain_movement_bonus", terrain: "plains", value: 1 }],
  },
  elf_dancing_upon_azure_waves: {
    id: "elf_dancing_upon_azure_waves", label: "Dancing Upon Azure Waves", category: "civic", layer: 3, cost: 35,
    prereqs: ["elf_whispering_waters"], raceOnly: "elf",
    description: "Galleys gain +2 movement and +1 vision.",
    costBreakdown: { coin: 20, lore: 15 },
    effects: [{ type: "unit_stat_upgrade", unit: "galley", changes: { movement: 2, visionRadius: 1 } }],
  },
  elf_gems_of_starlight: {
    id: "elf_gems_of_starlight", label: "Gems of Starlight", category: "civic", layer: 3, cost: 30,
    prereqs: [], raceOnly: "elf",
    description: "+0.75 coin from Mountains.",
    costBreakdown: { coin: 20, lore: 10 },
    effects: [{ type: "unlock_tile_bonus", terrain: "mountains", bonus: { coin: 0.75 } }],
  },
  elf_wind_from_distant_treetops: {
    id: "elf_wind_from_distant_treetops", label: "Wind From Distant Treetops", category: "civic", layer: 4, cost: 50,
    prereqs: ["elf_murmuring_of_leaves"], raceOnly: "elf",
    description: "All Forest tiles anywhere on the map are always revealed -- no fog of war on Forest at all.",
    costBreakdown: { lore: 32, coin: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "wind_from_distant_treetops" }],
  },
  elf_vision_beyond_sight: {
    id: "elf_vision_beyond_sight", label: "Vision Beyond Sight", category: "civic", layer: 5, cost: 90,
    prereqs: ["elf_air_beneath_eyes_above"], raceOnly: "elf",
    description: "All elf units gain +1 vision.",
    costBreakdown: { lore: 55, coin: 25, harvest: 15 },
    effects: [
      { type: "unit_stat_upgrade", unit: "ranger", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "blade_dancer", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "druid", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "raptor", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "shadowsteed", changes: { visionRadius: 1 } },
      { type: "unit_stat_upgrade", unit: "awakened_oak", changes: { visionRadius: 1 } },
    ],
  },

  // --- Building ---
  elf_aelderwatch: {
    id: "elf_aelderwatch", label: "Aelderwatch", category: "building", layer: 2, cost: 20,
    prereqs: [], raceOnly: "elf",
    description: "Unlocks the Treetop Watch. The city this building is adjacent to gains +2 vision radius.",
    costBreakdown: { coin: 12, lore: 8 },
    effects: [{ type: "unlock_building", building: "treetop_watch" }],
  },
  elf_treetop_snipers: {
    id: "elf_treetop_snipers", label: "Treetop Snipers", category: "building", layer: 2, cost: 40,
    prereqs: ["elf_aelderwatch", "elf_hunters_soul"], raceOnly: "elf",
    description: "If an enemy unit is within range, there is a 50% chance each turn that an elf wall will attack that enemy unit (range 2, attack 1).",
    costBreakdown: { coin: 24, lore: 16 },
    effects: [{ type: "unlock_mechanic", mechanic: "treetop_snipers" }],
  },
  elf_silverleaf_atelier: {
    id: "elf_silverleaf_atelier", label: "Silverleaf Atelier", category: "building", layer: 3, cost: 35,
    prereqs: ["elf_architecture_of_light_and_air", "elf_gems_of_starlight"], raceOnly: "elf",
    description: "Unlocks the Silverleaf Atelier (+10% coin and +10% lore, this city only).",
    costBreakdown: { coin: 20, lore: 15 },
    effects: [{ type: "unlock_building", building: "silverleaf_atelier" }],
  },
  elf_altar_of_ages: {
    id: "elf_altar_of_ages", label: "Altar of Ages", category: "building", layer: 4, cost: 50,
    prereqs: ["elf_druidism", "elf_reverie_of_sunset"], raceOnly: "elf",
    description: "Unlocks the Altar of Ages. All elf units created in this city gain an extra 25% XP.",
    costBreakdown: { lore: 32, coin: 18 },
    effects: [
      { type: "unlock_building", building: "altar_of_ages" },
      { type: "unlock_mechanic", mechanic: "altar_of_ages", value: 0.25 },
    ],
  },
  elf_wellspring_grove: {
    id: "elf_wellspring_grove", label: "Wellspring Grove", category: "building", layer: 5, cost: 90,
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
    description: "Unlocks the Ranger (Ranged 2, First Strike). Granted free at civ creation, same as every other race's basic unit.",
    costBreakdown: { lore: 11, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "ranger" }],
  },
  elf_wind_and_flashing_steel: {
    id: "elf_wind_and_flashing_steel", label: "Wind and Flashing Steel", category: "military", layer: 1, cost: 16,
    prereqs: [], raceOnly: "elf",
    description: "Unlocks the Blade Dancer (melee, First Strike).",
    costBreakdown: { lore: 12, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "blade_dancer" }],
  },
  // 2026-07-20, user-directed: a normal action (move, then optionally act --
  // see project_turn_action_economy memory), same category as an ordinary
  // Attack, not a full-turn action. See ai.js's performBladeSweep for the
  // shared implementation and combat.js's resolveRound for the
  // attackDamageMult/counterDamageMult context both this and Blade Storm rely on.
  elf_whirlwind_strike: {
    id: "elf_whirlwind_strike", label: "Whirlwind Strike", category: "military", layer: 2, cost: 45,
    prereqs: ["elf_wind_and_flashing_steel"], raceOnly: "elf",
    description: "As a normal action, the Blade Dancer attacks every enemy unit within 1 tile of itself, each hit dealing 75% damage (as if attacking normally). Each target may counterattack, at 37.5% effectiveness.",
    costBreakdown: { lore: 30, coin: 15 },
    effects: [{ type: "unlock_mechanic", mechanic: "whirlwind_strike" }],
  },
  // Does NOT replace Whirlwind Strike (2026-07-20, user-directed) -- both
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
  elf_strike_from_the_shadows: {
    id: "elf_strike_from_the_shadows", label: "Strike from the Shadows", category: "military", layer: 2, cost: 50,
    prereqs: ["elf_shadowed_hush_unseen"], raceOnly: "elf",
    description: "A Hidden elf unit gains +50% bonus to attack score. Attacking uses this bonus, then ends Hidden as normal.",
    costBreakdown: { lore: 50 },
    effects: [{ type: "unlock_mechanic", mechanic: "strike_from_the_shadows" }],
  },
  elf_druidism: {
    id: "elf_druidism", label: "Druidism", category: "military", layer: 2, cost: 32,
    prereqs: ["elf_murmuring_of_leaves", "elf_whispering_waters"], raceOnly: "elf",
    description: "Unlocks the Druid (magic unit, like the Human Wizard -- utility unit, Ranged 2). May found a city, in addition to the normal Pioneer.",
    costBreakdown: { lore: 22, coin: 10 },
    effects: [{ type: "unlock_unit", unit: "druid" }],
  },
  elf_air_beneath_eyes_above: {
    id: "elf_air_beneath_eyes_above", label: "Air Beneath, Eyes Above", category: "military", layer: 2, cost: 34,
    prereqs: ["elf_druidism"], raceOnly: "elf",
    description: "The Druid may summon a Raptor to assist elven allies -- like a city, it spends resources and several turns \"building\" the unit, unable to move or act while doing so (though it may do this while Hidden, if already Hidden beforehand). The Raptor has Atk 1/Def 0, Flying, First Strike 2%, very high movement and vision -- its purpose is to explore and scout. Cities cannot build Raptor units.",
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
  elf_first_frost_of_autumn: {
    id: "elf_first_frost_of_autumn", label: "First Frost of Autumn", category: "military", layer: 2, cost: 30,
    prereqs: [], raceOnly: "elf",
    description: "Elf unit attacks have a 10% chance to inflict the Frozen condition on the target (0 movement, -25% attack, for a few turns).",
    costBreakdown: { lore: 20, coin: 10 },
    effects: [{ type: "unlock_mechanic", mechanic: "first_frost_of_autumn" }],
  },
  elf_hunters_soul: {
    id: "elf_hunters_soul", label: "Hunter's Soul", category: "military", layer: 3, cost: 38,
    prereqs: ["elf_watching_hunting"], raceOnly: "elf",
    description: "Rangers gain +1 range and +1 attack.",
    costBreakdown: { lore: 24, coin: 14 },
    effects: [{ type: "unit_stat_upgrade", unit: "ranger", changes: { range: 1, attack: 1 } }],
  },
  elf_natures_grace: {
    id: "elf_natures_grace", label: "Nature's Grace", category: "military", layer: 3, cost: 36,
    prereqs: ["elf_druidism", "elf_nature_provides"], raceOnly: "elf",
    description: "The Druid may use this action (costs its whole turn, no exhaustion afterward) to restore between 10% and 30% (random) health to an ally unit within its own range (not just adjacent).",
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
  elf_sudden_doom: {
    id: "elf_sudden_doom", label: "Sudden Doom", category: "military", layer: 3, cost: 50,
    prereqs: ["elf_strike_from_the_shadows"], raceOnly: "elf",
    description: "Replacing Strike from the Shadows (one effect, not two stacking bonuses), the bonus to attack score while Hidden increases to +100% instead of +50%, and the unit also gains First Strike +10%. Both bonuses end when the unit is no longer Hidden.",
    costBreakdown: { lore: 50 },
    effects: [{ type: "unlock_mechanic", mechanic: "sudden_doom" }],
  },
  elf_silverlight_steel: {
    id: "elf_silverlight_steel", label: "Silverlight Steel", category: "military", layer: 3, cost: 40,
    prereqs: ["elf_silverleaf_atelier"], raceOnly: "elf",
    description: "Blade Dancers gain +1 attack and +1% First Strike.",
    costBreakdown: { coin: 22, lore: 18 },
    effects: [{ type: "unit_stat_upgrade", unit: "blade_dancer", changes: { attack: 1, firstStrikePct: 0.01 } }],
  },
  elf_roots_of_the_world: {
    id: "elf_roots_of_the_world", label: "Roots of the World", category: "military", layer: 3, cost: 45,
    prereqs: ["elf_druidism"], raceOnly: "elf",
    description: "A Druid may instantly move itself, or an adjacent ally, to any unoccupied tile the civ has ever explored (not just currently visible). This costs the Druid's entire turn (no move/attack after), and it cannot act again until healed to 100% HP.",
    costBreakdown: { lore: 45 },
    effects: [{ type: "unlock_mechanic", mechanic: "roots_of_the_world" }],
  },
  elf_quick_as_a_shadow: {
    id: "elf_quick_as_a_shadow", label: "Quick as a Shadow", category: "military", layer: 4, cost: 50,
    prereqs: ["elf_strike_from_the_shadows"], raceOnly: "elf",
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
    id: "elf_shadowsteed", label: "Shadowsteed", category: "military", layer: 5, cost: 95,
    prereqs: ["elf_air_beneath_eyes_above", "elf_quick_as_a_shadow"], raceOnly: "elf",
    description: "The Druid may summon a Shadowsteed, a flying horse made of shadow, the same way it summons a Raptor (spends resources and several turns \"building\" it, immobile meanwhile). The Shadowsteed has Flying, Carry, First Strike 5%, Atk 1/Def 1. It cannot carry an Awakened Oak, a Raptor, or a Galley. While carrying another unit, it takes on that unit's range, attack, defense, siege, and First Strike (keeping its own First Strike if higher), then adds +3 attack, +2 defense, and +2% First Strike of its own on top. Cities cannot build Shadowsteed units.",
    costBreakdown: { lore: 55, coin: 25, harvest: 15 },
    effects: [
      { type: "unlock_unit", unit: "shadowsteed" },
      { type: "unlock_mechanic", mechanic: "shadow_steed_summon" },
    ],
  },
  elf_the_living_forest: {
    id: "elf_the_living_forest", label: "The Living Forest", category: "military", layer: 5, cost: 95,
    prereqs: ["elf_druidism", "elf_sanctuary_under_green_boughs"], raceOnly: "elf",
    description: "Unlocks the Awakened Oak, a living, walking tree -- massive, rare, very tough, high attack and defense, high siege. The elves' own siege unit: less singular and less rare than a Dwarf Titan, meant to be fielded in numbers.",
    costBreakdown: { harvest: 30, lore: 40, coin: 20 },
    effects: [{ type: "unlock_unit", unit: "awakened_oak" }],
  },
  elf_upon_the_wind: {
    id: "elf_upon_the_wind", label: "Upon the Wind", category: "military", layer: 5, cost: 90,
    prereqs: ["elf_hunters_soul", "elf_vision_beyond_sight"], raceOnly: "elf",
    description: "All Ranger and Blade Dancer units gain +2 attack. Ranger units gain +1 range while being carried (by a Shadowsteed).",
    costBreakdown: { lore: 55, coin: 20, harvest: 15 },
    effects: [
      { type: "unit_stat_upgrade", unit: "ranger", changes: { attack: 2 } },
      { type: "unit_stat_upgrade", unit: "blade_dancer", changes: { attack: 2 } },
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
    description: "+0.75 coin from Mountains.",
    costBreakdown: { coin: 10, lore: 6 },
    effects: [{ type: "unlock_tile_bonus", terrain: "mountains", bonus: { coin: 0.75 } }],
  },
  dwarf_imported_goods: {
    id: "dwarf_imported_goods", label: "Imported Goods", category: "civic", layer: 1, cost: 28,
    prereqs: [], raceOnly: "dwarf",
    description: "+1 harvest per road tile within a city's radius, up to 8 road tiles per city.",
    costBreakdown: { coin: 18, lore: 10 },
    effects: [{ type: "unlock_feature_bonus", feature: "road", bonus: { harvest: 1 } }],
  },
  dwarf_quarry: {
    id: "dwarf_quarry", label: "Quarry", category: "civic", layer: 2, cost: 20,
    prereqs: ["dwarf_stonecunning"], raceOnly: "dwarf",
    description: "+0.75 coin from Hills.",
    costBreakdown: { coin: 13, lore: 7 },
    effects: [{ type: "unlock_tile_bonus", terrain: "hills", bonus: { coin: 0.75 } }],
  },
  dwarf_deep_lore: {
    id: "dwarf_deep_lore", label: "Deep Lore", category: "civic", layer: 2, cost: 20,
    prereqs: ["dwarf_stonecunning"], raceOnly: "dwarf",
    description: "+0.75 lore from Mountains.",
    costBreakdown: { lore: 12, coin: 8 },
    effects: [{ type: "unlock_tile_bonus", terrain: "mountains", bonus: { lore: 0.75 } }],
  },
  dwarf_mountains_on_the_horizon: {
    id: "dwarf_mountains_on_the_horizon", label: "Mountains on the Horizon", category: "civic", layer: 2, cost: 20,
    prereqs: ["dwarf_stonecunning"], raceOnly: "dwarf",
    description: "All Mountain tiles anywhere on the map, as well as Hill tiles immediately adjacent to a Mountain tile, are always revealed -- no fog of war on those tiles at all.",
    costBreakdown: { lore: 12, coin: 8 },
    effects: [{ type: "unlock_mechanic", mechanic: "mountains_on_the_horizon" }],
  },
  dwarf_prospectors_claim: {
    id: "dwarf_prospectors_claim", label: "Prospector's Claim", category: "civic", layer: 3, cost: 38,
    prereqs: [], raceOnly: "dwarf",
    description: "Any dwarven unit on a Gold Vein or Iron Vein may start Prospecting it: a full-turn action that continues automatically (no move/attack) until cancelled, gradually claiming the 1-tile radius around itself just like a city fills in its own tiles (counts toward territorial victory like any owned tile), and harvesting the terrain/resource yield of every claimed tile in that radius. Yields +3 coin/+1 lore per turn on a Gold Vein, or +1 harvest/+3 coin/+1 lore per turn on an Iron Vein. Instantly loses everything it was claiming/generating if cancelled, the unit moves off the vein, or it dies.",
    costBreakdown: { coin: 24, lore: 14 },
    effects: [{ type: "unlock_mechanic", mechanic: "prospectors_claim" }],
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
    id: "dwarf_the_deep_mines", label: "The Deep Mines", category: "civic", layer: 5, cost: 70,
    prereqs: ["dwarf_prospectors_claim"], raceOnly: "dwarf",
    description: "Any dwarven unit stationed 6+ turns on a Gold Vein or Iron Vein (i.e. it already triggered Prospector's Claim at 2+ turns and stayed) increases the resources earned to +5 coin/+4 lore per turn on a Gold Vein, or +1 harvest/+6 coin/+2 lore per turn on an Iron Vein (replacing Prospector's Claim's yield either way), and gains +2 defense while it remains there.",
    costBreakdown: { coin: 44, lore: 26 },
    effects: [{ type: "unlock_mechanic", mechanic: "deep_mines" }],
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
    id: "dwarf_forgecraft", label: "Forgecraft", category: "building", layer: 2, cost: 22,
    prereqs: [], raceOnly: "dwarf",
    description: "Unlocks the Deep Forge (+10% coin per turn, this city only).",
    costBreakdown: { coin: 16, lore: 6 },
    effects: [{ type: "unlock_building", building: "deep_forge" }],
  },
  dwarf_meeting_of_the_clans: {
    id: "dwarf_meeting_of_the_clans", label: "Meeting of the Clans", category: "building", layer: 4, cost: 36,
    prereqs: ["dwarf_imported_goods"], raceOnly: "dwarf",
    description: "Unlocks the Great Hall (+5% harvest and +5% lore per turn, this city only).",
    costBreakdown: { coin: 20, lore: 16 },
    effects: [{ type: "unlock_building", building: "great_hall" }],
  },
  dwarf_runecraft: {
    id: "dwarf_runecraft", label: "Runecraft", category: "building", layer: 3, cost: 46,
    prereqs: [], raceOnly: "dwarf",
    description: "Unlocks the Runewall. Walls heal 5% of their max HP per turn.",
    costBreakdown: { coin: 28, lore: 18 },
    effects: [
      { type: "unlock_building", building: "runewall" },
      { type: "unlock_mechanic", mechanic: "hedge_walls" },
    ],
  },
  dwarf_deep_roads_rite: {
    id: "dwarf_deep_roads_rite", label: "Deep Roads Rite", category: "building", layer: 5, cost: 90,
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
    description: "Unlocks the FoeHammer (basic melee unit).",
    costBreakdown: { coin: 10, lore: 5 },
    effects: [{ type: "unlock_unit", unit: "foehammer" }],
  },
  dwarf_thunder_from_stone: {
    id: "dwarf_thunder_from_stone", label: "Thunder from Stone", category: "military", layer: 2, cost: 24,
    prereqs: [], raceOnly: "dwarf",
    description: "Unlocks the Musketeer (Ranged 2).",
    costBreakdown: { coin: 16, lore: 8 },
    effects: [{ type: "unlock_unit", unit: "musketeer" }],
  },
  dwarf_warrior_poets: {
    id: "dwarf_warrior_poets", label: "Warrior Poets", category: "military", layer: 2, cost: 26,
    prereqs: ["dwarf_deep_lore"], raceOnly: "dwarf",
    description: "Unlocks the Metal Singer (Ranged 2, utility/caster/buff). Heavy metal / Norwegian black metal inspired appearance: has an axe that is also an electric guitar.",
    costBreakdown: { coin: 17, lore: 9 },
    effects: [{ type: "unlock_unit", unit: "troubadour" }],
  },
  dwarf_arquebus_engineering: {
    id: "dwarf_arquebus_engineering", label: "Arquebus Engineering", category: "military", layer: 3, cost: 40,
    prereqs: ["dwarf_thunder_from_stone"], raceOnly: "dwarf",
    description: "Musketeer gains +1 range, +1 attack, and First Strike 2.5%.",
    costBreakdown: { coin: 26, lore: 14 },
    effects: [{ type: "unit_stat_upgrade", unit: "musketeer", changes: { range: 1, attack: 1, firstStrikePct: 0.025 } }],
  },
  dwarf_heavy_metal: {
    id: "dwarf_heavy_metal", label: "Heavy Metal", category: "military", layer: 3, cost: 58,
    prereqs: ["dwarf_warrior_poets"], raceOnly: "dwarf",
    description: "The Metal Singer exudes an aura in a 1-tile radius around itself (including itself): allied units heal 5% of their HP per turn (minimum 1), regardless of whether they're resting, and gain +1 defense and +25% siege. If the Metal Singer also has Power Metal, it can switch between the two auras as an action (never both active at once).",
    costBreakdown: { coin: 34, lore: 24 },
    effects: [
      { type: "unlock_mechanic", mechanic: "heavy_metal" },
    ],
  },
  dwarf_power_metal: {
    id: "dwarf_power_metal", label: "Power Metal", category: "military", layer: 3, cost: 58,
    prereqs: ["dwarf_warrior_poets"], raceOnly: "dwarf",
    description: "The Metal Singer exudes an aura in a 1-tile radius around itself (including itself): allied units gain +2 attack and +5% First Strike. If the Metal Singer also has Heavy Metal, it can switch between the two auras as an action (never both active at once).",
    costBreakdown: { coin: 34, lore: 24 },
    effects: [
      { type: "unlock_mechanic", mechanic: "power_metal" },
    ],
  },
  dwarf_epic_metal: {
    id: "dwarf_epic_metal", label: "Epic Metal", category: "military", layer: 4, cost: 50,
    prereqs: ["dwarf_heavy_metal"], raceOnly: "dwarf",
    description: "The Metal Singer's active aura (Heavy Metal or Power Metal, whichever is currently active) extends to a 2-tile radius.",
    costBreakdown: { coin: 32, lore: 18 },
    effects: [{ type: "unlock_mechanic", mechanic: "epic_metal" }],
  },
  dwarf_shield_wall: {
    id: "dwarf_shield_wall", label: "Shield Wall", category: "military", layer: 3, cost: 40,
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
    id: "dwarf_stonebreaker", label: "Stonebreaker", category: "military", layer: 4, cost: 42,
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
    description: "Unlocks the Runeforged Titan: a massive, slow-moving stone golem with a very high defense and a high siege score. Like a wall or city, it takes damage from an ordinary attacker as if brushing it off, but a Siege-property attacker cuts through it just as easily. A rare unit -- meant to plod overland slowly toward an enemy city, defending itself along the way, escorted by other Dwarf units.",
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
    description: "+1 movement starting on Swamp.",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_bonus", terrain: "swamp", value: 1 }],
  },
  orc_forced_march: {
    id: "orc_forced_march", label: "Forced March", category: "civic", layer: 1, cost: 14,
    prereqs: [], raceOnly: "orc",
    description: "+1 movement starting on Plains, for Raiders, Wolf Riders, and Ogres only.",
    costBreakdown: { lore: 10, harvest: 4 },
    effects: [{ type: "unit_terrain_movement_bonus", terrain: "plains", value: 1, units: ["raider", "wolf_rider", "ogre"] }],
  },
  orc_violent_momentum: {
    id: "orc_violent_momentum", label: "Violent Momentum", category: "civic", layer: 1, cost: 14,
    prereqs: [], raceOnly: "orc",
    description: "+2 movement for a unit that killed an enemy unit the previous turn.",
    costBreakdown: { lore: 14 },
    effects: [{ type: "unlock_mechanic", mechanic: "violent_momentum" }],
  },
  orc_raiders: {
    id: "orc_raiders", label: "Raiders", category: "military", layer: 1, cost: 15,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Raider (basic melee unit).",
    costBreakdown: { lore: 11, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "raider" }],
  },
  orc_miscreant: {
    id: "orc_miscreant", label: "Miscreant", category: "military", layer: 1, cost: 12,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Goblin Miscreant (Atk 1/Def 1/Mov 2/Vis 2) -- a fast, cheap, disposable gap-filler unit, not a real fighter. 30% cheaper, faster to build, and lower upkeep than its stats alone would suggest; Orc falls back to building these when nothing better is affordable or worth building right now. Building one actually produces two -- the second spawns on a random adjacent tile next to the city. Every death still triggers Honor the Dead's +5 lore bonus like any other Orc unit.",
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
    description: "Unlocks the Wolf Rider (relatively high movement). +1 movement starting on Forest.",
    costBreakdown: { lore: 12, coin: 4 },
    effects: [
      { type: "unlock_unit", unit: "wolf_rider" },
      { type: "unit_terrain_movement_bonus", terrain: "forest", value: 1, units: ["wolf_rider"] },
    ],
  },
  orc_bog_harvest: {
    id: "orc_bog_harvest", label: "Wetland Harvest", category: "civic", layer: 2, cost: 20,
    prereqs: [], raceOnly: "orc",
    description: "+0.5 Harvest from Swamp.",
    costBreakdown: { lore: 14, harvest: 6 },
    effects: [{ type: "unlock_tile_bonus", terrain: "swamp", bonus: { harvest: 0.5 } }],
  },
  orc_warcraft: {
    id: "orc_warcraft", label: "War Camp", category: "building", layer: 2, cost: 22,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the War Camp (-10% unit cost, across all resources -- not just coin).",
    costBreakdown: { lore: 18, coin: 4 },
    effects: [{ type: "unlock_building", building: "war_camp" }],
  },
  // 2026-07-20, user-directed: mirrors Human's Ramparts structurally (walls
  // AND cities, not other buildings, can counterattack; no attack bonus
  // multiplier, no militia spawn) but with a flat attack rating instead of
  // deriving from the Archer -- see combat.js's spikesCounterattack.
  orc_spikes: {
    id: "orc_spikes", label: "Spikes!", category: "building", layer: 2, cost: 22,
    prereqs: [], raceOnly: "orc",
    description: "Walls and cities can counterattack (not other buildings), with an attack rating of 1. No attack bonus multiplier and no militia spawn (unlike Halfellow's Rouse the People, which this mirrors structurally).",
    costBreakdown: { coin: 14, lore: 8 },
    effects: [{ type: "unlock_mechanic", mechanic: "spikes" }],
  },
  orc_impaler_rite: {
    id: "orc_impaler_rite", label: "Impaler Rites", category: "military", layer: 2, cost: 15,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Impaler (high defense, low attack, low movement).",
    costBreakdown: { lore: 11, coin: 4 },
    effects: [{ type: "unlock_unit", unit: "impaler" }],
  },
  orc_bog_witch: {
    id: "orc_bog_witch", label: "Bog Witch", category: "military", layer: 2, cost: 25,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Bog Witch (Ranged 2). Any unit that kills a Bog Witch loses 50% attack and 50% movement for 3 turns.",
    costBreakdown: { lore: 18, coin: 7 },
    effects: [{ type: "unlock_unit", unit: "bog_witch" }],
  },
  orc_swift_hunters: {
    id: "orc_swift_hunters", label: "Swift Hunters", category: "military", layer: 2, cost: 24,
    prereqs: ["orc_wolf_riders"], raceOnly: "orc",
    // firstStrikePct is genuinely additive (see combat.js's
    // effectiveFirstStrikePct) -- this +0.015 stacks on top of Wolf Rider's
    // baked-in base 0.02 (see units.js) for 0.035 total, rather than
    // replacing it.
    description: "Wolf Rider gains 1.5% First Strike and increased attack and movement.",
    costBreakdown: { lore: 17, coin: 7 },
    effects: [{ type: "unit_stat_upgrade", unit: "wolf_rider", changes: { firstStrikePct: 0.015, attack: 2, movement: 1 } }],
  },
  orc_spoils_of_war: {
    id: "orc_spoils_of_war", label: "Spoils of War", category: "civic", layer: 2, cost: 40,
    prereqs: ["orc_warcraft"], raceOnly: "orc",
    description: "When an Orc unit kills an enemy unit, gain +3 coin and +4 lore.",
    costBreakdown: { lore: 30, coin: 10 },
    effects: [{ type: "raid_kill_bonus", harvest: 0, coin: 3, lore: 4 }],
  },

  // --- Layer 3 ---
  // Merged with the former "Campaign of Terror" (2026-07-14, user-directed):
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
    id: "orc_pillage_and_loot", label: "Pillage and Loot", category: "civic", layer: 3, cost: 40,
    prereqs: ["orc_spoils_of_war"], raceOnly: "orc",
    description: "An Orc unit standing within an enemy city's radius has a 2-tile (Chebyshev) radius around itself which removes any filled-in enemy influence from those tiles -- cutting off their yield immediately and fully stripping the tile after 3 turns of sustained suppression -- and generates +1 harvest, +1 coin, and +1 lore for EACH tile where influence was actually suppressed this turn. Lasts until the unit moves to a new tile (the effect moves with it), leaves the enemy city's radius, or is killed. Does not stack with other Orc units on the same tile.",
    costBreakdown: { lore: 26, coin: 14 },
    effects: [{ type: "unlock_mechanic", mechanic: "pillage_and_loot" }],
  },
  orc_butchery_rites: {
    id: "orc_butchery_rites", label: "Butchery", category: "building", layer: 3, cost: 35,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Butchery (+10% harvest, any time harvest is gained).",
    costBreakdown: { lore: 28, coin: 7 },
    effects: [{ type: "unlock_building", building: "butchery" }],
  },
  orc_tip_of_the_spear: {
    id: "orc_tip_of_the_spear", label: "Tip of the Spear", category: "military", layer: 3, cost: 22,
    prereqs: ["orc_impaler_rite"], raceOnly: "orc",
    description: "Impaler gains First Strike 2.5%.",
    costBreakdown: { lore: 22 },
    effects: [{ type: "unit_stat_upgrade", unit: "impaler", changes: { firstStrikePct: 0.025 } }],
  },
  orc_battering_ram: {
    id: "orc_battering_ram", label: "Battering Ram", category: "military", layer: 3, cost: 40,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Battering Ram (relatively low movement, Siege 150%).",
    costBreakdown: { lore: 26, coin: 14 },
    effects: [{ type: "unlock_unit", unit: "battering_ram" }],
  },
  orc_ogre: {
    id: "orc_ogre", label: "Ogre", category: "military", layer: 3, cost: 42,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Ogre (high attack, Siege 50%).",
    costBreakdown: { lore: 28, coin: 14 },
    effects: [{ type: "unlock_unit", unit: "ogre" }],
  },
  orc_malefic_malediction: {
    id: "orc_malefic_malediction", label: "Malefic Malediction", category: "military", layer: 3, cost: 38,
    prereqs: ["orc_bog_witch"], raceOnly: "orc",
    description: "Any unit damaged by a Bog Witch loses 50% attack and 50% movement for 3 turns. Stacks alongside the Bog Witch's own death-curse.",
    costBreakdown: { lore: 38 },
    effects: [{ type: "unlock_mechanic", mechanic: "malefic_malediction" }],
  },
  orc_burn_it_all_down: {
    id: "orc_burn_it_all_down", label: "Burn It All Down", category: "military", layer: 3, cost: 35,
    prereqs: [], raceOnly: "orc",
    description: "Ranged attacks (not adjacent melee) from a Scout or a Dragon set their target ablaze: the Burning condition deals 1 damage at the start of the burning unit's turn for 3 turns, unless it's currently on Coast, Ocean, or a river tile.",
    costBreakdown: { lore: 22, coin: 13 },
    effects: [{ type: "unlock_mechanic", mechanic: "burn_it_all_down" }],
  },
  orc_wasteland_riders: {
    id: "orc_wasteland_riders", label: "Wasteland Riders", category: "military", layer: 3, cost: 24,
    prereqs: ["orc_forced_march"], raceOnly: "orc",
    description: "+1 movement starting on Desert, for Raiders, Wolf Riders, and Ogres only.",
    costBreakdown: { lore: 18, harvest: 6 },
    effects: [{ type: "unit_terrain_movement_bonus", terrain: "desert", value: 1, units: ["raider", "wolf_rider", "ogre"] }],
  },
  orc_hound_and_hunter: {
    id: "orc_hound_and_hunter", label: "Hound and Hunter", category: "military", layer: 3, cost: 28,
    prereqs: ["orc_wolf_riders", "orc_dire_wolf"], raceOnly: "orc",
    description: "When a Wolf Rider dies, 50% chance a Raider or a Dire Wolf (50/50 between the two) spawns in its place.",
    costBreakdown: { lore: 18, coin: 10 },
    effects: [{ type: "unlock_mechanic", mechanic: "hound_and_hunter" }],
  },
  // 2026-07-20, user-directed. Replaces (not stacks with) Spikes!'s attack
  // rating while both are known -- same "upgrade tech" convention as e.g.
  // Sudden Doom replacing Strike from the Shadows -- see combat.js's
  // spikesAttackRating.
  orc_bigger_spikes: {
    id: "orc_bigger_spikes", label: "Bigger Spikes!", category: "building", layer: 3, cost: 38,
    prereqs: ["orc_spikes"], raceOnly: "orc",
    description: "Walls and cities can counterattack (not other buildings), with an attack rating of 2. No attack bonus multiplier and no militia spawn (unlike Halfellow's Rouse the People, which this mirrors structurally).",
    costBreakdown: { coin: 22, lore: 16 },
    effects: [{ type: "unlock_mechanic", mechanic: "bigger_spikes" }],
  },

  // --- Layer 4 ---
  orc_the_old_ways: {
    id: "orc_the_old_ways", label: "The Old Ways", category: "civic", layer: 4, cost: 50,
    prereqs: [], raceOnly: "orc",
    description: "+0.5 Lore from Swamp.",
    costBreakdown: { lore: 50 },
    effects: [{ type: "unlock_tile_bonus", terrain: "swamp", bonus: { lore: 0.5 } }],
  },
  orc_honor_the_dead: {
    id: "orc_honor_the_dead", label: "Honor the Dead", category: "civic", layer: 4, cost: 55,
    prereqs: [], raceOnly: "orc",
    description: "When an Orc unit dies, gain +5 lore. Orc units have a 50% chance to resist being raised from the dead (if an Orc unit is slain by an Undead unit, only a 50% chance the Undead civ turns it into a zombie under its control).",
    costBreakdown: { lore: 45, harvest: 10 },
    effects: [
      { type: "death_lore_bonus", value: 5 },
      { type: "raise_dead_resistance", value: 0.5 },
    ],
  },
  orc_dragon_den_rite: {
    id: "orc_dragon_den_rite", label: "Dragon Den", category: "building", layer: 4, cost: 55,
    prereqs: [], raceOnly: "orc",
    description: "Unlocks the Dragon Den (+10% coin, any time coin is gained).",
    costBreakdown: { lore: 40, coin: 15 },
    effects: [{ type: "unlock_building", building: "dragon_den" }],
  },
  orc_siege_tactics: {
    id: "orc_siege_tactics", label: "Siege Tactics", category: "military", layer: 4, cost: 40,
    prereqs: ["orc_ogre", "orc_battering_ram"], raceOnly: "orc",
    description: "If an Orc unit already has the Siege property, it increases by 20 percentage points; otherwise the unit gains Siege 20%.",
    costBreakdown: { lore: 40, coin: 15 },
    effects: [{ type: "siege_property_bonus", value: 0.20 }],
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
    description: "Unlocks the Dragon (Flying, Ranged 2, Siege 66%, the single most powerful unit in the game) -- but each Dragon a civ already owns makes the next one substantially more expensive and slower to build, so fielding many at once is deliberately punishing.",
    costBreakdown: { lore: 67, coin: 25 },
    effects: [{ type: "unlock_unit", unit: "dragon" }],
  },

  // --- Layer 5 ---
  // "Campaign of Terror" removed entirely (2026-07-14) -- merged into
  // orc_pillage_and_loot above (see its comment).
  orc_ancestral_dolmen_rite: {
    id: "orc_ancestral_dolmen_rite", label: "Ancestral Dolmen", category: "building", layer: 5, cost: 95,
    prereqs: ["orc_the_old_ways"], raceOnly: "orc",
    description: "Unlocks the Ancestral Dolmen (+10% lore, any time lore is gained).",
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
    description: "Bind the first Skeletons to service.",
    costBreakdown: { lore: 15 },
    effects: [{ type: "unlock_unit", unit: "skeleton" }],
  },
  undead_mire_walkers: {
    id: "undead_mire_walkers", label: "Mire-Walkers", category: "civic", layer: 1, cost: 12,
    prereqs: [], raceOnly: "undead",
    description: "The dead do not tire in the bog. +1 movement starting on Swamp.",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_bonus", terrain: "swamp", value: 1 }],
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
    description: "Unlocks the Wanderer (basic melee unit; may found a city, in addition to the normal Pioneer). +1 movement when starting on Plains.",
    costBreakdown: { harvest: 15 },
    effects: [
      { type: "unlock_unit", unit: "wanderer" },
      { type: "terrain_movement_bonus", terrain: "plains", value: 1 },
    ],
  },
  halfellow_singing_hills: {
    id: "halfellow_singing_hills", label: "Singing Hills", category: "civic", layer: 1, cost: 12,
    prereqs: [], raceOnly: "halfellow",
    description: "+1 movement when starting on Hills. (Does not stack with Riverfolk on a hill-with-river tile -- only the higher of the two applies.)",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_bonus", terrain: "hills", value: 1 }],
  },
  halfellow_riverfolk: {
    id: "halfellow_riverfolk", label: "Riverfolk", category: "civic", layer: 1, cost: 12,
    prereqs: [], raceOnly: "halfellow",
    description: "+1 movement when starting on Rivers. (Does not stack with Singing Hills on a hill-with-river tile -- only the higher of the two applies.)",
    costBreakdown: { lore: 12 },
    effects: [{ type: "terrain_movement_bonus", terrain: "river", value: 1 }],
  },
  // Moved from L2 (2026-07-12): Halfellow's stealth kit was coming online
  // too late to matter during the exact early-rush window that was
  // deciding most Orc-vs-Halfellow games on the tighter dynamically-sized
  // map (see project_halfellow_tactics's retest). L1 means it's
  // researchable from turn one instead of gated behind a 2nd city.
  halfellow_sneaking_around: {
    id: "halfellow_sneaking_around", label: "Sneaking Around", category: "military", layer: 1, cost: 25,
    prereqs: [], raceOnly: "halfellow",
    // Restricted to Wanderer only (2026-07-20, user-directed, narrowed from
    // "every Halfellow unit") -- see combat.js's canGoHidden, which keys
    // this restriction off raceId so Elf's OWN unlock of the same shared
    // "sneaking_around" mechanic (elf_shadowed_hush_unseen) stays
    // unrestricted, race-wide as before.
    description: "The Wanderer may spend its whole turn to become Hidden for 3 turns (voluntarily cancellable early). Cannot activate with an enemy unit on an adjacent tile. Whenever a Hidden unit is revealed for ANY reason, it is forced visible for at least 1 turn before it can go Hidden again.",
    costBreakdown: { harvest: 15, lore: 10 },
    effects: [{ type: "unlock_mechanic", mechanic: "sneaking_around" }],
  },
  // 2026-07-24, user-directed: civ-wide (every Halfellow unit, not just
  // Trouble Maker -- same "grants an action race-wide" shape as Sneaking
  // Around above), a lookout post rather than a combat/economy tool. Full
  // turn action: go Hidden and hold position (see ai.js's
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
    id: "halfellow_hillside_harvest", label: "Hillside Harvest", category: "civic", layer: 2, cost: 20,
    prereqs: ["halfellow_singing_hills"], raceOnly: "halfellow",
    description: "+0.5 harvest from Hills.",
    costBreakdown: { lore: 13, coin: 7 },
    effects: [{ type: "unlock_tile_bonus", terrain: "hills", bonus: { harvest: 0.5 } }],
  },
  halfellow_road_goes_ever_on: {
    id: "halfellow_road_goes_ever_on", label: "The Road Goes Ever On", category: "civic", layer: 2, cost: 22,
    prereqs: [], raceOnly: "halfellow",
    description: "+1 lore per road tile within a city's radius, up to 8 road tiles per city.",
    costBreakdown: { lore: 14, harvest: 8 },
    effects: [{ type: "unlock_feature_bonus", feature: "road", bonus: { lore: 1 } }],
  },
  halfellow_farmers_market: {
    id: "halfellow_farmers_market", label: "Farmers Market", category: "building", layer: 2, cost: 20,
    prereqs: [], raceOnly: "halfellow",
    description: "Unlocks the Farmers Market (+10% harvest/turn, this city only).",
    costBreakdown: { coin: 12, harvest: 8 },
    effects: [{ type: "unlock_building", building: "farmers_market" }],
  },
  halfellow_pony_patrol: {
    id: "halfellow_pony_patrol", label: "Pony Patrol", category: "military", layer: 2, cost: 24,
    prereqs: ["halfellow_road_goes_ever_on"], raceOnly: "halfellow",
    description: "Unlocks the Pony Patrol (high movement).",
    costBreakdown: { harvest: 14, coin: 10 },
    effects: [{ type: "unlock_unit", unit: "pony_patrol" }],
  },
  // 2026-07-20, user-directed (unnamed in the request -- "Undaunted" is my
  // own pick, easy to rename). Mirrors Orc's Hound and Hunter structurally
  // (spawns on the dead unit's own now-vacated tile, gated on typeId at
  // every death call site) -- see combat.js's maybeSpawnPonyReplacement.
  halfellow_undaunted: {
    id: "halfellow_undaunted", label: "Undaunted", category: "military", layer: 4, cost: 50,
    prereqs: ["halfellow_pony_patrol"], raceOnly: "halfellow",
    description: "When a Pony Patrol is killed, 25% chance a Wanderer spawns in its place.",
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
  // 2026-07-20, user-directed.
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
    description: "Every Halfellow unit except Militia gains Ranged 2 (attacks from 2 tiles away and takes no counterattack when doing so).",
    costBreakdown: { harvest: 15, lore: 15 },
    effects: [{ type: "universal_range_grant", value: 2 }],
  },

  // --- Layer 3 ---
  halfellow_riverboat_trade: {
    id: "halfellow_riverboat_trade", label: "Riverboat Trade", category: "civic", layer: 3, cost: 38,
    prereqs: ["halfellow_riverfolk"], raceOnly: "halfellow",
    description: "+0.75 coin per river tile within a city's radius.",
    costBreakdown: { coin: 22, harvest: 16 },
    effects: [{ type: "unlock_feature_bonus", feature: "river", bonus: { coin: 0.75 } }],
  },
  halfellow_nice_day_fishing: {
    id: "halfellow_nice_day_fishing", label: "Nice Day for Fishing", category: "civic", layer: 3, cost: 38,
    prereqs: ["halfellow_riverfolk"], raceOnly: "halfellow",
    description: "+0.5 harvest from Rivers.",
    costBreakdown: { lore: 22, coin: 16 },
    effects: [{ type: "unlock_feature_bonus", feature: "river", bonus: { harvest: 0.5 } }],
  },
  halfellow_ice_fishing: {
    id: "halfellow_ice_fishing", label: "Ice Fishing", category: "civic", layer: 3, cost: 40,
    prereqs: ["halfellow_riverfolk"], raceOnly: "halfellow",
    description: "+0.35 harvest from Tundra.",
    costBreakdown: { lore: 16, coin: 12, harvest: 12 },
    effects: [{ type: "unlock_tile_bonus", terrain: "tundra", bonus: { harvest: 0.35 } }],
  },
  halfellow_neighborhood_pub: {
    id: "halfellow_neighborhood_pub", label: "Neighborhood Pub", category: "building", layer: 3, cost: 35,
    prereqs: [], raceOnly: "halfellow",
    description: "Unlocks the Neighborhood Pub (+10% coin/turn, this city only).",
    costBreakdown: { coin: 20, harvest: 15 },
    effects: [{ type: "unlock_building", building: "neighborhood_pub" }],
  },
  halfellow_pub_crawl: {
    id: "halfellow_pub_crawl", label: "Pub Crawl", category: "civic", layer: 3, cost: 40,
    prereqs: ["halfellow_neighborhood_pub"], raceOnly: "halfellow",
    description: "+1 coin per building constructed in a city (walls don't count).",
    costBreakdown: { lore: 16, coin: 12, harvest: 12 },
    effects: [{ type: "building_count_bonus", bonus: { coin: 1 } }],
  },
  // 2026-07-24, user-directed: unlocks the Trouble Maker unit, WITH Resource
  // Heist and Unlock the Gate already built in (no separate tech needed for
  // either -- see ai.js's maybeResourceHeistPlay/maybeUnlockTheGatePlay).
  // Riddle is the one ability that needs its own further tech (The Riddle
  // Game, below) -- same staged shape Human's Wizard uses (unit unlocked
  // first, each spell behind its own tech). Rumors of a tavern-born rascal
  // makes for a fitting requirement on Pub Crawl.
  halfellow_making_trouble: {
    id: "halfellow_making_trouble", label: "Making Trouble", category: "military", layer: 3, cost: 45,
    prereqs: ["halfellow_pub_crawl"], raceOnly: "halfellow",
    description: "Unlocks the Trouble Maker, a stealthy rogue with two built-in tricks: Resource Heist (steal a targeted enemy unit's accumulated prospecting/delving/fishing stash, resetting their claim to zero, and leaves the victim Befuddled) and Unlock the Gate (disables a targeted wall and every wall adjacent to it -- zeroing their defense and suppressing any special wall defenses -- for 3 rounds).",
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
    // category "building" (2026-07-20, user-directed) despite unlocking no
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
    // Cut back to 2.00 again (2026-07-24, user-directed), this time paired
    // with a brand-new tool for the same job -- Envoy (below) lets a
    // Pioneer/Wanderer claim a specific in-radius tile outright in a flat
    // 2 turns, independent of this multiplier. Dropping this back to 2.00
    // keeps Envoy meaningfully useful for longer instead of being
    // immediately dwarfed by a maxed-out passive rate once this tech is
    // researched.
    description: "Gain influence in tiles 100% faster.",
    costBreakdown: { harvest: 20, coin: 18, lore: 17 },
    effects: [{ type: "fill_rate_mult", value: 2.00 }],
  },
  // 2026-07-24, user-directed: a channeled action for Pioneer/Wanderer --
  // stand on (or adjacent to, see ai.js's maybeEnvoyPlay) an already-in-
  // radius, not-yet-owned tile and channel for a flat 2 turns to claim it
  // outright, independent of the normal fill-rate math -- guaranteed speed
  // and, critically, lets the player/AI CHOOSE which tile gets priority
  // instead of waiting on the passive fill order. Small cost so it isn't
  // spammed for free; deliberately not a big enough cost to matter early.
  halfellow_envoy: {
    id: "halfellow_envoy", label: "Envoy", category: "civic", layer: 4, cost: 30,
    prereqs: [], raceOnly: "halfellow",
    description: "Pioneer and Wanderer may channel for 2 turns on an already-in-radius, unclaimed tile to claim it outright, independent of the normal gradual fill-in rate.",
    costBreakdown: { coin: 10, harvest: 8, lore: 6 },
    effects: [{ type: "unlock_mechanic", mechanic: "envoy" }],
  },
  halfellow_hearth_and_homeland: {
    id: "halfellow_hearth_and_homeland", label: "Hearth and Homeland", category: "civic", layer: 4, cost: 50,
    prereqs: [], raceOnly: "halfellow",
    description: "Heal an extra 10% per turn when resting on a filled-in tile within one of your own cities' borders (not just inside the city itself).",
    costBreakdown: { harvest: 26, lore: 24 },
    effects: [{ type: "unlock_mechanic", mechanic: "hearth_and_homeland", value: 0.10 }],
  },
  halfellow_historical_society: {
    id: "halfellow_historical_society", label: "Historical Society", category: "building", layer: 4, cost: 52,
    prereqs: ["halfellow_road_goes_ever_on"], raceOnly: "halfellow",
    description: "Unlocks the Historical Society (+10% lore/turn, this city only).",
    costBreakdown: { lore: 32, coin: 20 },
    effects: [{ type: "unlock_building", building: "historical_society" }],
  },
  halfellow_rouse_the_militia: {
    id: "halfellow_rouse_the_militia", label: "Rouse the Militia", category: "military", layer: 4, cost: 55,
    prereqs: ["halfellow_historical_society"], raceOnly: "halfellow",
    description: "Unlocks the Militia (higher attack and defense than the Wanderer).",
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
  halfellow_great_stories: {
    id: "halfellow_great_stories", label: "It's Like the Great Stories", category: "military", layer: 4, cost: 50,
    prereqs: ["halfellow_historical_society"], raceOnly: "halfellow",
    description: "All Halfellow units gain an extra +50% XP whenever they earn XP.",
    costBreakdown: { lore: 28, harvest: 22 },
    effects: [{ type: "unlock_mechanic", mechanic: "great_stories", value: 0.5 }],
  },
  // 2026-07-24, user-directed: Trouble Maker's third trick, plus Wanderer
  // (not civ-wide -- only these two unit types). Ranged debuff: target
  // resists at (their race's curiosity * 0.75), so even a maximally curious
  // race (1.0) still fails a quarter of the time. On a failed resist,
  // applies Befuddled (see combat.js's applyBefuddled) -- -50% attack, 75%
  // defense, movement capped at 1, 0% First Strike, for 2 turns.
  halfellow_riddle_game: {
    id: "halfellow_riddle_game", label: "The Riddle Game", category: "military", layer: 4, cost: 48,
    prereqs: ["halfellow_making_trouble"], raceOnly: "halfellow",
    description: "Trouble Maker and Wanderer may pose a riddle to an enemy unit at range. The target resists (nothing happens) with a chance equal to its race's curiosity x 0.75 -- otherwise it becomes Befuddled for 2 turns: -50% attack, 75% defense, movement capped at 1, 0% First Strike.",
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
    id: "halfellow_strategic_reserve", label: "Strategic Reserve", category: "building", layer: 5, cost: 95,
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
    description: "If the next hit against a Halfellow unit (forward or counter) would kill it, 25% chance to negate all of that damage instead. Triggering forces the unit to Rest next turn, and permanently reduces that same unit's own trigger chance by 15 percentage points (floored at 0%) -- diminishing returns per unit, never resets. Additionally, Halfellow units have a 50% chance to resist being raised from the dead (if killed by an undead unit, only a 50% chance the undead turns it into a zombie under its control).",
    costBreakdown: { lore: 55, harvest: 35 },
    effects: [
      { type: "unlock_mechanic", mechanic: "resilient_spirit", value: 0.25 },
      { type: "raise_dead_resistance", value: 0.5 },
    ],
  },
  halfellow_rouse_the_people: {
    id: "halfellow_rouse_the_people", label: "Rouse the People", category: "military", layer: 5, cost: 95,
    prereqs: ["halfellow_hearth_and_homeland"], raceOnly: "halfellow",
    description: "Cities, walls, and buildings gain attack equal to the Militia's (if higher than their current value) and can now counterattack, but only against an attacker standing adjacent (melee range); a Ranged attack takes no counter damage. 5% chance a Militia spawns adjacent to a structure/city that's attacked; 15% chance instead if the attack actually destroys it.",
    costBreakdown: { lore: 55, harvest: 40 },
    effects: [{ type: "unlock_mechanic", mechanic: "rouse_the_people" }],
  },

  // --- "Cultural Influence" -- one per race, the tech-tree capstone
  // (2026-07-21, user-directed): a true late-game resource sink, only
  // researchable once EVERY other tech in that race's own tree is already
  // complete. `prereqs` is intentionally left empty here and filled in
  // programmatically right below (see the IIFE after TECH_LIST is computed)
  // with every other tech id belonging to that race -- hand-listing ~30
  // ids per race would silently drift out of date the moment the tree
  // changes, where a generated list can't. See chooseBuildAction/
  // progressBuildQueue/performClaimInfluenceTile in ai.js for what the
  // mechanic actually does turn to turn.
  cultural_influence_human: {
    id: "cultural_influence_human", label: "Cultural Influence", category: "civic", layer: 5, cost: 120,
    prereqs: [], raceOnly: "human",
    description: "Requires every other Human tech already researched. A city may spend several turns and a steep harvest/coin/lore cost to claim influence over one additional tile within its own radius, immediately (skipping the normal gradual fill-in wait). Repeatable until every tile in the city's radius is already its own.",
    costBreakdown: { harvest: 40, coin: 40, lore: 40 },
    effects: [{ type: "unlock_mechanic", mechanic: "cultural_influence" }],
  },
  cultural_influence_elf: {
    id: "cultural_influence_elf", label: "Cultural Influence", category: "civic", layer: 5, cost: 120,
    prereqs: [], raceOnly: "elf",
    description: "Requires every other Elf tech already researched. A city may spend several turns and a steep harvest/coin/lore cost to claim influence over one additional tile within its own radius, immediately (skipping the normal gradual fill-in wait). Repeatable until every tile in the city's radius is already its own.",
    costBreakdown: { harvest: 40, coin: 40, lore: 40 },
    effects: [{ type: "unlock_mechanic", mechanic: "cultural_influence" }],
  },
  cultural_influence_dwarf: {
    id: "cultural_influence_dwarf", label: "Cultural Influence", category: "civic", layer: 5, cost: 120,
    prereqs: [], raceOnly: "dwarf",
    description: "Requires every other Dwarf tech already researched. A city may spend several turns and a steep harvest/coin/lore cost to claim influence over one additional tile within its own radius, immediately (skipping the normal gradual fill-in wait). Repeatable until every tile in the city's radius is already its own.",
    costBreakdown: { harvest: 40, coin: 40, lore: 40 },
    effects: [{ type: "unlock_mechanic", mechanic: "cultural_influence" }],
  },
  cultural_influence_orc: {
    id: "cultural_influence_orc", label: "Cultural Influence", category: "civic", layer: 5, cost: 120,
    prereqs: [], raceOnly: "orc",
    description: "Requires every other Orc tech already researched. A city may spend several turns and a steep harvest/coin/lore cost to claim influence over one additional tile within its own radius, immediately (skipping the normal gradual fill-in wait). Repeatable until every tile in the city's radius is already its own.",
    costBreakdown: { harvest: 40, coin: 40, lore: 40 },
    effects: [{ type: "unlock_mechanic", mechanic: "cultural_influence" }],
  },
  cultural_influence_undead: {
    id: "cultural_influence_undead", label: "Cultural Influence", category: "civic", layer: 5, cost: 120,
    prereqs: [], raceOnly: "undead",
    description: "Requires every other Undead tech already researched. A city may spend several turns and a steep harvest/coin/lore cost to claim influence over one additional tile within its own radius, immediately (skipping the normal gradual fill-in wait). Repeatable until every tile in the city's radius is already its own.",
    costBreakdown: { harvest: 40, coin: 40, lore: 40 },
    effects: [{ type: "unlock_mechanic", mechanic: "cultural_influence" }],
  },
  cultural_influence_halfellow: {
    id: "cultural_influence_halfellow", label: "Cultural Influence", category: "civic", layer: 5, cost: 120,
    prereqs: [], raceOnly: "halfellow",
    description: "Requires every other Halfellow tech already researched. A city may spend several turns and a steep harvest/coin/lore cost to claim influence over one additional tile within its own radius, immediately (skipping the normal gradual fill-in wait). Repeatable until every tile in the city's radius is already its own.",
    costBreakdown: { harvest: 40, coin: 40, lore: 40 },
    effects: [{ type: "unlock_mechanic", mechanic: "cultural_influence" }],
  },
};

window.GameData.TECH_LIST = Object.keys(window.GameData.TECHS);

// "Cultural Influence" capstone prereqs (see the tech entries above): every
// OTHER tech belonging to that same race, computed here so the list can
// never drift out of sync with the tree itself as techs are added/removed.
for (const tech of Object.values(window.GameData.TECHS)) {
  if (!tech.id.startsWith("cultural_influence_")) continue;
  tech.prereqs = window.GameData.TECH_LIST.filter(
    (id) => id !== tech.id && window.GameData.TECHS[id].raceOnly === tech.raceOnly);
}

window.GameData.getTech = function (techId) {
  const tech = window.GameData.TECHS[techId];
  if (!tech) throw new Error(`[GameData] Unknown tech id: "${techId}"`);
  return tech;
};

// Each tech's own `cost` is hand-authored per node (design intent documented
// at the top of this file: "cost scales ~1.4x per layer"), not derived from
// a formula -- so a race's later layers were already somewhat more expensive
// by construction, but only as much as whoever wrote that particular node
// happened to tune it. This is a SEPARATE, engine-level multiplier on top of
// that hand-authored cost, applied uniformly to every tech regardless of
// race, so higher layers take meaningfully longer to research everywhere,
// not just wherever a node happened to be priced steeply. Mirrors
// unitUpkeepLayerPremium's shape (compounds per layer past 1) but is its own
// independent rate -- tech research time and unit upkeep are tuned for
// different goals and shouldn't be forced to move together.
const TECH_LAYER_PREMIUM_RATE = window.GameConfig.research.layerPremiumRate;

/** Multiplier on a tech's authored `cost`, purely from how deep its layer
 *  is -- L1 pays none, L5 pays roughly (1.15)^4 =~1.75x on top of whatever
 *  that tech's own authored cost already reflects. */
window.GameData.techLayerPremium = function (layer) {
  return Math.pow(1 + TECH_LAYER_PREMIUM_RATE, Math.max(0, (layer || 1) - 1));
};

// Pacing experiment (2026-07-12): global 20% cut to research time, on top
// of (not instead of) the per-layer premium above -- applied as a flat
// multiplier here rather than touching TECH_LAYER_PREMIUM_RATE or any
// individual tech's authored `cost`, so the RELATIVE cost curve (cheap
// early techs vs. expensive late ones) is preserved exactly, just
// compressed in absolute time. See project_pacing_experiment memory.
const TECH_RESEARCH_TIME_MULT = window.GameConfig.research.researchTimeMult;

/** The REAL Lore cost to complete a tech -- authored `cost` times
 *  techLayerPremium times TECH_RESEARCH_TIME_MULT. Every consumer that
 *  cares how much Lore a tech actually takes (the research engine's own
 *  completion check, and any UI showing a tech's cost or research progress
 *  %) should read this instead of `tech.cost` directly, or they'll
 *  under-count how long research actually takes / show a stale cost number. */
window.GameData.effectiveTechCost = function (tech) {
  return tech.cost * window.GameData.techLayerPremium(tech.layer) * TECH_RESEARCH_TIME_MULT;
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
 *  scanned once across every tech's effects. null for the 3 units that were
 *  never tech-gated at all -- Pioneer, Galley, and Human's free Scout (every
 *  other race's Scout comes from beast_sense, which IS a tech, but has no
 *  costBreakdown to derive a resource mix from -- see unitBuildCost below). */
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
 *  doesn't relocate the unit in the tree). 1 for the 3 legacy units with no
 *  associated tech (Pioneer/Galley/Human's free Scout), same fallback
 *  unitBuildCost already uses. */
window.GameData.unitTechLayer = function (unitId) {
  const techId = window.GameData.techForUnit(unitId);
  if (!techId) return 1;
  return window.GameData.TECHS[techId].layer || 1;
};

// Deliberately smaller than the tech tree's own ~1.4x/layer cost growth
// (see the file-header comment above) -- unit power already trends up with
// layer on its own (deeper units tend to have better stats), so this is a
// second, thinner "sophistication tax" layered on top of that, not a
// restatement of it. Compounds per layer past 1; the tree tops out at
// layer 5, so a layer-5 unit (Dragon-tier) lands at roughly (1.18)^4 =~2x
// a layer-1 unit of identical power -- enough to actually feel expensive
// without the curve running away, since 4 layer-steps is the whole range.
const LAYER_PREMIUM_RATE = window.GameConfig.units.buildLayerPremiumRate;

/** Multiplier applied to unitBuildCost (the one-time purchase) for how deep
 *  in the tech tree a unit sits -- an L1 unit (or a legacy one) pays no
 *  premium; an L3 unit pays roughly (1.18)^2, an L5 unit (Dragon-tier)
 *  roughly (1.18)^4 =~2x. Makes late-tree units expensive to actually build
 *  on top of (not instead of) their raw power already making them pricey. */
window.GameData.unitLayerPremium = function (unitId) {
  const layer = window.GameData.unitTechLayer(unitId);
  return Math.pow(1 + LAYER_PREMIUM_RATE, Math.max(0, layer - 1));
};

// Deliberately much steeper than LAYER_PREMIUM_RATE above -- a one-time
// purchase only limits how FAST a civ can amass an elite army, but ongoing
// upkeep is what determines whether it can actually be SUSTAINED turn after
// turn. At this rate a layer-5 unit's upkeep runs roughly (1.40)^4 =~3.8x a
// layer-1 unit's, for identical raw power -- steep enough that fielding an
// entire army of top-tier units (not just a few, on top of a mixed-tier
// core) should bankrupt the economy that's paying for it, rather than merely
// costing more the way the one-time build price does.
const UPKEEP_LAYER_PREMIUM_RATE = window.GameConfig.units.upkeepLayerPremiumRate;

/** Same shape as unitLayerPremium above, but at UPKEEP_LAYER_PREMIUM_RATE --
 *  used ONLY by unitUpkeep, never unitBuildCost. Kept as a separate function
 *  (not a shared helper parameterized by rate) so each call site's intent
 *  reads directly from its own name at the call site. */
window.GameData.unitUpkeepLayerPremium = function (unitId) {
  const layer = window.GameData.unitTechLayer(unitId);
  return Math.pow(1 + UPKEEP_LAYER_PREMIUM_RATE, Math.max(0, layer - 1));
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

// Base upkeep rate: 10% -> 35% (2026-07-17, user-directed). Measured
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
 *  `unit` (2026-07-14, user-directed) is the optional actual unit INSTANCE,
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
  // Elf Raptor/Shadowsteed (2026-07-18, user-directed): `noUpkeep: true`
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
