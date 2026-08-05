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
 * race can build. Effect fields consumed by the engine:
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
 * (isWall: true, no raceOnly) is universal and stackable -- see its own
 * comment further down.
 */

window.GameData = window.GameData || {};

window.GameData.BUILDINGS = {
  // ---------- HUMAN — see tech_tree_design.md for the full tree ----------
  bazaar: {
    id: "bazaar", label: "Bazaar", symbol: "$", raceOnly: "human",
    coinCost: 20, maxHp: 24, yieldPct: { harvest: 0.10 },
  },
  guild_hall: {
    id: "guild_hall", label: "Guild Hall", symbol: "G", raceOnly: "human",
    coinCost: 25, maxHp: 24, yieldPct: { coin: 0.10 },
  },
  mage_college: {
    id: "mage_college", label: "Mage College", symbol: "M", raceOnly: "human",
    coinCost: 35, maxHp: 30, yieldPct: { lore: 0.20 },
  },
  palace: {
    id: "palace", label: "Palace", symbol: "H", raceOnly: "human",
    coinCost: 50, maxHp: 36, radiusBonus: 1,
  },

  // ---------- ELF — Forest specialists: vision, lore/coin, veteran XP, then
  // a city-wide healing grove (see techs.js's elf_* building techs) ----------
  treetop_watch: {
    id: "treetop_watch", label: "Treetop Watch", symbol: "◬", raceOnly: "elf",
    coinCost: 20, maxHp: 22, visionRadiusBonus: 2,
  },
  silverleaf_atelier: {
    id: "silverleaf_atelier", label: "Silverleaf Atelier", symbol: "☾", raceOnly: "elf",
    coinCost: 30, maxHp: 26, yieldPct: { coin: 0.10, lore: 0.10 },
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

  // ---------- DWARF — deep production, few strong holds ----------
  deep_forge: {
    id: "deep_forge", label: "Deep Forge", symbol: "⚒", raceOnly: "dwarf",
    coinCost: 25, maxHp: 28, yield: { coin: 3 }, requiresHillsAdjacent: true,
  },
  great_hall: {
    id: "great_hall", label: "Great Hall", symbol: "⌂", raceOnly: "dwarf",
    coinCost: 25, maxHp: 28, yield: { harvest: 1, lore: 1 },
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

  // ---------- ORC — war economy: cheap units, plunder, ancestor-lore ----------
  war_camp: {
    id: "war_camp", label: "War Camp", symbol: "⚑", raceOnly: "orc",
    // Raised 10%->20% discount (2026-07-14) -- also now speeds up build TIME
    // by the same fraction, not just resource cost (see ai.js buildUnitOption).
    // Part of a combined Orc-buff pass tested against Halfellow/Human -- see
    // project_pairwise_balance_human_orc_halfellow memory.
    coinCost: 20, maxHp: 24, unitCostMult: 0.80,
  },
  butchery: {
    id: "butchery", label: "Butchery", symbol: "X", raceOnly: "orc",
    coinCost: 22, maxHp: 24, yieldPct: { harvest: 0.10 },
  },
  dragon_den: {
    id: "dragon_den", label: "Dragon Den", symbol: "⛉", raceOnly: "orc",
    coinCost: 40, maxHp: 30, yieldPct: { coin: 0.10 },
  },
  ancestral_dolmen: {
    id: "ancestral_dolmen", label: "Ancestral Dolmen", symbol: "▲", raceOnly: "orc",
    coinCost: 55, maxHp: 40, yieldPct: { lore: 0.10 },
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

  // ---------- HALFELLOW — hearth-and-home economy: filled-tile yield%, then a
  // per-home-city combat buff (Armory) rather than a per-city yield ----------
  farmers_market: {
    id: "farmers_market", label: "Farmers Market", symbol: "$", raceOnly: "halfellow",
    coinCost: 20, maxHp: 22, yieldPct: { harvest: 0.10 },
  },
  neighborhood_pub: {
    id: "neighborhood_pub", label: "Neighborhood Pub", symbol: "♥", raceOnly: "halfellow",
    coinCost: 25, maxHp: 22, yieldPct: { coin: 0.10 },
  },
  historical_society: {
    id: "historical_society", label: "Historical Society", symbol: "M", raceOnly: "halfellow",
    coinCost: 35, maxHp: 26, yieldPct: { lore: 0.10 },
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
    coinCost: 15, maxHp: 40, defense: 8,
    // Hard floor on build time, independent of the city's coin income (see
    // ai.js progressBuildQueue) -- a wealthy city can't just insta-build a
    // wall. 14 turns comfortably exceeds how long a typical non-siege
    // attacker (attack ~7-9 vs this wall's defense 8, ~3-4 dmg/hit after
    // mitigation) takes to tear one down (~10-12 turns), so a wall is never
    // finished faster than an ordinary enemy could destroy an existing one.
    // Dedicated siege units (Catapult/Trebuchet, already the intentional
    // hard-counter to structures via siegePct) still break through faster --
    // that's their established identity, not something this is meant to stop.
    minBuildTurns: 14,
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
 * MULTI-RESOURCE BUILDING COST (2026-08-03, user-directed)
 * ----------------------------------------------------------
 * Every building above still carries only `coinCost` -- that field is now
 * the building's overall RESOURCE VALUE (used to derive the split below),
 * not literally "how much Coin it costs" anymore, for any building whose
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
 *  scanned once across every tech's effects. Deliberately excludes
 *  wall_section even though shared_infrastructure's own effects DO include
 *  an unlock_building for it (2026-08-04) -- wall_section is meant to stay
 *  universal and never gated by research (see this file's own header
 *  comment on walls), so it's carved out here rather than left to
 *  incidentally pick up shared_infrastructure's costBreakdown (added
 *  2026-08-05 for Pioneer/Galley/Scout's own build cost) as an unrelated
 *  side effect -- callers fall back to the legacy flat-coinCost model for
 *  it, same as they always have. */
window.GameData._TECH_FOR_BUILDING = (() => {
  const map = {};
  for (const tech of Object.values(window.GameData.TECHS)) {
    for (const effect of tech.effects || []) {
      if (effect.type === "unlock_building" && effect.building !== "wall_section") map[effect.building] = tech.id;
    }
  }
  return map;
})();
window.GameData.techForBuilding = function (buildingId) {
  return window.GameData._TECH_FOR_BUILDING[buildingId] || null;
};

/** A building's one-time cost, split across harvest/coin/lore in the same
 *  ratio as its unlocking tech's own costBreakdown, scaled to the
 *  building's own coinCost total. Returns null when there's no unlocking
 *  tech (wall_section) or that tech has no costBreakdown -- ai.js's
 *  buildingOption falls back to the legacy flat-coinCost model whenever
 *  this returns null, the same convention window.GameData.unitBuildCost
 *  already established for units. */
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
