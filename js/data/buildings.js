/**
 * BUILDING DATA
 * -------------
 * Pure data. Buildings are no longer placed "inside" the city — each is a
 * STRUCTURE built on any of the 8 tiles adjacent to the city (as long as
 * that tile is passable and not already occupied by another structure),
 * with the city at the center. Structures have HP and can be attacked and
 * destroyed by enemy units; destroying one removes the bonus it grants until
 * the owner spends resources to rebuild it. Max 4 structures per city (one
 * per occupied adjacent tile), which is exactly each race's 4-building roster.
 *
 * Every race has EXACTLY 4 buildings, and these are the only buildings that
 * race can build.
 *
 * 2026-08-24: buildings were moved off economic adjustments (flat `yield`,
 * `yieldPct`, `unitCostMult`) and onto real game effects -- vision, combat
 * stats, unit prerequisites, timed buffs. Only Undead's Bone Reliquary still
 * carries a `yield`. Most buildings therefore have NO effect field at all
 * now: their effect lives in engine code gated on `cityHasStructure` /
 * `civHasBuiltBuilding` (see cities.js), which also means destroying the
 * structure revokes the effect for free. Each such building carries a
 * comment naming its mechanic and where it's implemented.
 *
 * Effect fields consumed by the engine:
 *   yield: { harvest, coin, lore }   flat per-turn city yield (cities.js)
 *   influenceMult: 1.20              multiplies this city's influence projection
 *   radiusBonus: 1                   +1 influence radius for this city
 *   coinPerAdjacentRoad: 1           +coin per road tile in the city's work radius
 *   lorePerAdjacentForest: 1         +lore per forest tile adjacent to the city
 *   contestedYieldPenaltyOverride    contested tiles still yield at this rate
 *   unitCostMult: 0.75               cheaper AND faster unit production in this city (all resources, not just coin -- see ai.js buildUnitOption); also discounts the owning civ's whole army's ongoing upkeep, civ-wide (see techs.js unitUpkeep)
 *   raiseDeadPowerBonus: 0.15        raised-dead units are this much stronger
 *   requiresHillsAdjacent / requiresForestAdjacent   placement constraints
 *   maxHp                            structure hit points (race-flavored)
 *   yieldPct: { harvest, coin, lore }  % bonus to THIS CITY's own total yield
 *                                      (not civ-wide), on top of flat `yield`
 *   visionRadiusBonus: 2              +vision radius for this city (see
 *                                      cities.js computeStructureEffects and
 *                                      turns.js refreshVisibility) -- the
 *                                      vision-side counterpart to radiusBonus
 *                                      above, which only ever affects
 *                                      influence radius.
 *
 * Exception to the "exactly 4, race-only, one each" rule above: wall_section
 * (isWall: true, no raceOnly) and bridge_section (isBridge: true, no
 * raceOnly) are both universal and stackable -- see their own comments
 * further down.
 */

window.GameData = window.GameData || {};

window.GameData.BUILDINGS = {
  // ---------- HUMAN — see tech_tree_design.md for the full tree ----------
  // No yield/yieldPct: "Traders' Talk" reveals every rival civ's city tile
  // on the map -- merchant gossip as map knowledge, not income. See
  // turns.js's refreshVisibility, gated on civHasBuiltBuilding.
  bazaar: {
    id: "bazaar", label: "Bazaar", symbol: "$", raceOnly: "human",
    coinCost: 20, maxHp: 24,
  },
  // No yield/yieldPct: Guild Charter's free-level-up bonus is granted at
  // unit-spawn time (see ai.js's spawnUnitInCity), gated on this city
  // specifically having a Guild Hall (cityHasStructure).
  guild_hall: {
    id: "guild_hall", label: "Guild Hall", symbol: "G", raceOnly: "human",
    coinCost: 25, maxHp: 24,
  },
  // No yield/yieldPct: the Mage College IS the tower -- 75% chance each turn
  // to strike the nearest enemy unit within range 5 for 3 attack (see ai.js's
  // tickMageTowerDefense). Formerly gated behind a separate L4 "Mage Tower"
  // tech, folded into the building itself 2026-08-24.
  mage_college: {
    id: "mage_college", label: "Mage College", symbol: "M", raceOnly: "human",
    coinCost: 35, maxHp: 30,
  },
  palace: {
    id: "palace", label: "Palace", symbol: "H", raceOnly: "human",
    coinCost: 50, maxHp: 36, radiusBonus: 1,
  },

  // ---------- ELF — Forest specialists: vision, lore/coin, veteran XP, then
  // a city-wide healing grove (see techs.js's elf_* building techs) ----------
  treetop_watch: {
    id: "treetop_watch", label: "Treetop Watch", symbol: "◬", raceOnly: "elf",
    coinCost: 20, maxHp: 22, visionRadiusBonus: 4,
  },
  // No yield/yieldPct: "Silversteel Mail" -- units trained in this city are
  // created with +1 defense, permanently (see ai.js's BUILDING_UNIT_STAMPS).
  // Deliberate mirror of Dwarf's Deep Forge: dwarves forge weapons, elves
  // forge armor.
  silverleaf_atelier: {
    id: "silverleaf_atelier", label: "Silverleaf Atelier", symbol: "☾", raceOnly: "elf",
    coinCost: 30, maxHp: 26,
  },
  // No yield/yieldPct: Altar of Ages' bonus is a +25% XP grant for units
  // trained in THIS city (unit.homeCityName-gated, same convention as
  // Halfellow's Armory) -- see combat.js's hasAltarOfAgesBonus and ai.js's
  // XP-grant call sites, not a per-city economic effect.
  altar_of_ages: {
    id: "altar_of_ages", label: "Altar of Ages", symbol: "♣", raceOnly: "elf",
    coinCost: 40, maxHp: 28,
  },
  // No yield/yieldPct: Wellspring Grove's bonus is the "wellspring_grove"
  // mechanic (civ-wide check, city-radius-scoped heal -- see turns.js's
  // per-civ-turn application), not a per-city economic effect.
  wellspring_grove: {
    id: "wellspring_grove", label: "Wellspring Grove", symbol: "❀", raceOnly: "elf",
    coinCost: 55, maxHp: 30,
  },

  // ---------- DWARF — holding the hold: forged arms, self-healing walls,
  // clan musters, and the Deep Roads network ----------
  // No yield: "Forged Arms" -- units trained in this city are created with
  // +1 attack, permanently (see ai.js's BUILDING_UNIT_STAMPS).
  deep_forge: {
    id: "deep_forge", label: "Deep Forge", symbol: "⚒", raceOnly: "dwarf",
    coinCost: 25, maxHp: 28, requiresHillsAdjacent: true,
  },
  // No yield: "Meeting of the Clans" -- civ-wide, any Dwarf unit Resting and
  // Defending on ANY of this civ's cities, buildings, or walls defends at
  // +50% (see combat.js's effectiveDefense).
  great_hall: {
    id: "great_hall", label: "Great Hall", symbol: "⌂", raceOnly: "dwarf",
    coinCost: 25, maxHp: 28,
  },
  // No yield/yieldPct/influenceMult: Runewall's bonus is the "hedge_walls"
  // mechanic (walls self-heal 5% max HP/turn, civ-wide -- see cities.js
  // tickCity), the same mechanic Halfellow's Hedge Walls tech grants, not a
  // per-city economic effect.
  runewall: {
    id: "runewall", label: "Runewall", symbol: "▦", raceOnly: "dwarf",
    coinCost: 30, maxHp: 34,
  },
  // No yield/influenceMult/terrain requirement -- its value is purely the
  // Deep Roads network mechanic (see combat.js/ai.js's "deep_roads" handling
  // and techs.js's dwarf_deep_roads_rite). Dwarf-only; no other race can ever
  // build or use one, even indirectly.
  deep_gate: {
    id: "deep_gate", label: "Deep Gate", symbol: "◈", raceOnly: "dwarf",
    coinCost: 55, maxHp: 34,
  },

  // ---------- ORC — the war host: fast units, blood-feasting, dragons, and
  // ancestors who rouse the living ----------
  // No unitCostMult: units built in this city are created with +1 movement,
  // permanently (see ai.js's BUILDING_UNIT_STAMPS) -- the Orc rush identity
  // expressed as speed on the board rather than a discount.
  war_camp: {
    id: "war_camp", label: "War Camp", symbol: "⚑", raceOnly: "orc",
    coinCost: 20, maxHp: 24,
  },
  // No yieldPct: "Blood Feast" -- while one stands, this civ's units heal
  // 15% of max HP (minimum 1) on any kill. See ai.js's healOnKillPctFor.
  butchery: {
    id: "butchery", label: "Butchery", symbol: "X", raceOnly: "orc",
    coinCost: 22, maxHp: 24,
  },
  // No yieldPct: the Dragon Den is now a hard prerequisite for building
  // Dragons at all -- only a city holding one may produce them (see ai.js's
  // UNIT_BUILDING_PREREQ). Lose the Den, lose Dragon production.
  dragon_den: {
    id: "dragon_den", label: "Dragon Den", symbol: "⛉", raceOnly: "orc",
    coinCost: 40, maxHp: 30,
  },
  // No yieldPct: "Ancestral Rage" -- when a unit whose home city is this one
  // falls anywhere on the map, every friendly unit within 3 tiles of the
  // death gains +25% attack for 3 turns (see ai.js's maybeAncestralRage).
  // The fallen are honored by being avenged, not resurrected.
  ancestral_dolmen: {
    id: "ancestral_dolmen", label: "Ancestral Dolmen", symbol: "▲", raceOnly: "orc",
    coinCost: 55, maxHp: 40,
  },

  // ---------- UNDEAD — no harvest; occupation, dark lore, necromancy ----------
  barrow: {
    id: "barrow", label: "Barrow", symbol: "⚰", raceOnly: "undead",
    coinCost: 25, maxHp: 26, contestedYieldPenaltyOverride: 0.25,
  },
  bone_reliquary: {
    id: "bone_reliquary", label: "Bone Reliquary", symbol: "☠", raceOnly: "undead",
    coinCost: 25, maxHp: 26, yield: { lore: 2 },
  },
  cursed_obelisk: {
    id: "cursed_obelisk", label: "Cursed Obelisk", symbol: "†", raceOnly: "undead",
    coinCost: 30, maxHp: 26, influenceMult: 1.20,
  },
  necropolis: {
    id: "necropolis", label: "Necropolis", symbol: "N", raceOnly: "undead",
    coinCost: 60, maxHp: 40, radiusBonus: 1, raiseDeadPowerBonus: 0.15,
  },

  // ---------- HALFELLOW — hearth and home as a war footing: well-fed units,
  // tales that make veterans, antiquarian map-lore, and the Armory ----------
  // No yieldPct: "Well Fed" -- units built in this city are created with
  // +25% max HP (minimum +1), permanently. A percentage rather than a flat
  // bonus because unitMaxHP runs small (6-16 across this roster), so a flat
  // one would be worth far more to a Wanderer than a Militia. See ai.js's
  // applyBuildingUnitStamps.
  farmers_market: {
    id: "farmers_market", label: "Farmers Market", symbol: "$", raceOnly: "halfellow",
    coinCost: 20, maxHp: 22,
  },
  // No yieldPct: "It's Like the Great Stories" -- +25% XP for every unit this
  // civ owns, civ-wide (see ai.js's grantXPAndAutoLevel). Formerly a separate
  // L4 tech at +50%; folded into the building 2026-08-24 and cut to 25% to
  // match Elf's Altar of Ages, which this already beats on scope and layer.
  neighborhood_pub: {
    id: "neighborhood_pub", label: "Neighborhood Pub", symbol: "♥", raceOnly: "halfellow",
    coinCost: 25, maxHp: 22,
  },
  // No yieldPct: "Antiquarians" -- every Ruin tile on the map, plus a 1-tile
  // ring around each, is permanently revealed (see turns.js's
  // refreshVisibility).
  historical_society: {
    id: "historical_society", label: "Historical Society", symbol: "M", raceOnly: "halfellow",
    coinCost: 35, maxHp: 26,
  },
  // No yield/yieldPct: Armory's bonus is a combat stat boost (+50%
  // attack/defense) scoped to whichever city produced the
  // unit (unit.homeCityName) via cityHasStructure, not a per-city economic
  // effect and not civ-wide -- see combat.js hasArmoryBonus/
  // effectiveAttack/effectiveDefense and tech.js's halfellow_strategic_reserve.
  armory: {
    id: "armory", label: "Armory", symbol: "⚒", raceOnly: "halfellow",
    coinCost: 50, maxHp: 34,
  },

  // ---------- WALLS — universal, every race can build these (not raceOnly) ----------
  // Unlike the 4 unique buildings above, a city may hold several wall_section
  // structures at once (one per open adjacent tile) -- see cities.js
  // findStructureSlot's isWall branch, which also requires the tile to be
  // adjacent to an EXISTING structure (buildings or another wall segment)
  // rather than merely adjacent to the city. `defense` is a new field only
  // walls use so far -- combat.js attackStructure mitigates incoming damage
  // by it (def/(atk+def), same formula unit-vs-unit combat uses) instead of
  // applying it raw, the way every other (defenseless) structure still does.
  wall_section: {
    id: "wall_section", label: "Wall", symbol: "▬", isWall: true,
    // No minBuildTurns (removed 2026-08-21): build time is table-driven now
    // (see config.js's pacing.buildTurnsByLayer, keyed on
    // GameData.buildingTechLayer -- wall_section resolves to the "walls"
    // tech, Layer 0). A hardcoded 3-turn floor would have silently
    // overridden the table's own Layer 0 Fast/Fastest values (2 turns) --
    // see units.js's Pioneer for the same fix. cityDefensePerWall (see
    // combat.js's cityDefenseValue) is a separate, additional defense bonus
    // per wall.
    coinCost: 11, maxHp: 25, defense: 8,
  },

  // ---------- BRIDGES — universal, every race can build these (not raceOnly) ----------
  // Same "several segments at once, one per open tile" shape as wall_section
  // just above (isBridge instead of isWall) -- see cities.js's
  // placeBridgeSpan for how a whole span of these gets queued as one player
  // action but built one segment at a time, same pacing as a wall. Unlike
  // a wall, a bridge is deliberately NOT a movement obstacle to anyone,
  // friend or enemy (see ai.js's hasEnemyStructure) -- it's a crossing, not
  // a fortification -- and it "counts as a road" for movement discount and
  // road-count tech effects (see cities.js's tileCountsAsRoad). Exact same
  // cost/build-time as a Wall section, user-directed (2026-08-18).
  bridge_section: {
    id: "bridge_section", label: "Bridge", symbol: "═", isBridge: true,
    coinCost: 11, maxHp: 30, defense: 8,
    // No minBuildTurns -- see wall_section's own comment just above.
  },
};

window.GameData.BUILDING_LIST = Object.keys(window.GameData.BUILDINGS);

window.GameData.getBuilding = function (buildingId) {
  const b = window.GameData.BUILDINGS[buildingId];
  if (!b) throw new Error(`[GameData] Unknown building id: "${buildingId}"`);
  return b;
};

/** The 4 building ids available to a given race (the only ones it can build). */
window.GameData.buildingsForRace = function (raceId) {
  return window.GameData.BUILDING_LIST.filter(
    (id) => window.GameData.BUILDINGS[id].raceOnly === raceId
  );
};

/**
 * MULTI-RESOURCE BUILDING COST
 * -----------------------------
 * Every building above carries only `coinCost` -- that field is the
 * building's overall RESOURCE VALUE (used to derive the split below), not
 * literally "how much Coin it costs", for any building whose
 * unlocking tech has a costBreakdown. Kept as a single field rather than
 * hand-authoring a {harvest,coin,lore} object on every entry above so each
 * building's existing, already-balanced relative cost (which one is pricier
 * than which) can't drift out of sync with a second, hand-maintained number.
 *
 * This exactly mirrors techs.js's unitBuildCost: reuse the unlocking tech's
 * resource-type MIX (not its absolute numbers -- that was hand-tuned for
 * researching the tech, not for what the building costs to build), applied
 * to a TOTAL taken from the building's own existing coinCost (units instead
 * derive their total from unitPower, since buildings have no equivalent
 * combat-stat total).
 */

/** Which tech first grants a given building id (via unlock_building),
 *  scanned once across every tech's effects. wall_section resolves to
 *  pioneer_infrastructure -- see pioneer_infrastructure's own doc comment
 *  in techs.js -- but stays universal/never research-GATED
 *  (unlockedBuildings never checks it, see this file's own header comment
 *  on walls); only its cost model comes from that tech. */
window.GameData._TECH_FOR_BUILDING = (() => {
  const map = {};
  for (const tech of Object.values(window.GameData.TECHS)) {
    for (const effect of tech.effects || []) {
      if (effect.type === "unlock_building") map[effect.building] = tech.id;
    }
  }
  return map;
})();
window.GameData.techForBuilding = function (buildingId) {
  return window.GameData._TECH_FOR_BUILDING[buildingId] || null;
};

/** Tech-tree depth the building was FIRST unlocked at (the unlocking tech's
 *  own `layer`) -- mirrors techs.js's unitTechLayer exactly, same `?? 1`
 *  defensive fallback for the hypothetical case of a building with no
 *  unlock_building tech at all (doesn't currently happen -- every building,
 *  wall_section/bridge_section included, resolves to a real tech). Used by
 *  ai.js's buildingBuildTurns to index config.js's pacing.buildTurnsByLayer. */
window.GameData.buildingTechLayer = function (buildingId) {
  const techId = window.GameData.techForBuilding(buildingId);
  if (!techId) return 1;
  return window.GameData.TECHS[techId].layer ?? 1;
};

/** A building's one-time cost, split across harvest/coin/lore in the same
 *  ratio as its unlocking tech's own costBreakdown, scaled to the
 *  building's own coinCost total. Returns null when there's no unlocking
 *  tech, or that tech has no costBreakdown -- ai.js's buildingOption falls
 *  back to the legacy flat-coinCost model whenever this returns null, the
 *  same convention window.GameData.unitBuildCost already established for
 *  units (kept only as a defensive path for a hypothetical future building
 *  authored without a costBreakdown-bearing unlock). */
window.GameData.buildingBuildCost = function (buildingId) {
  const techId = window.GameData.techForBuilding(buildingId);
  if (!techId) return null;
  const breakdown = window.GameData.TECHS[techId].costBreakdown;
  if (!breakdown) return null;
  const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const total = window.GameData.getBuilding(buildingId).coinCost || 0;
  if (total <= 0) return null;
  const cost = {};
  for (const [k, v] of Object.entries(breakdown)) {
    cost[k] = Math.round(total * (v / sum));
  }
  return cost;
};
