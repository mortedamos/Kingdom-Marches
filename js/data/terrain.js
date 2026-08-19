/**
 * TERRAIN DATA
 * ------------
 * Pure data: terrain types, base yields, movement costs, color. No logic.
 * See realms_of_influence_terrain_generation.md and
 * realms_of_influence_yield_system.md for full rationale.
 *
 * Resources tracked: harvest (food/growth), coin (production + gold, merged),
 * lore (research). "Toil" was merged into coin.
 */

window.GameData = window.GameData || {};

// Movement cost values. "impassable" is a sentinel, not a number.
window.GameData.IMPASSABLE = Infinity;

// blendPriority (2026-08-18, render.js's drawTerrainBlend/drawTerrainAO):
// the general land/land (and water/water) neighbor-fringe blending pass.
// The COLOR fringe itself is symmetric -- any two differing, phase-
// matched neighbors fade toward each other regardless of priority (an
// earlier one-directional-by-priority design left the higher tile's own
// edge perfectly crisp, which read as a hard border no matter how well
// the color matched -- fixed by dropping priority from that part
// entirely). Priority now only gates the AO/cast-shadow depth cue,
// which SHOULD stay directional (a taller neighbor shadows a shorter
// one, not the reverse): a STRICTLY higher-priority neighbor casts a
// (faint) shadow, and one in the "tall" tier (Forest/Hills/Mountains,
// see TALL_TIER_MIN_PRIORITY) casts a stronger one. Water<->land pairs
// are excluded from this mechanism entirely -- that boundary is already
// fully handled by the dedicated shoreline overlay (see
// doc/art_style_guide.md SS9's shoreline addendum), and layering this
// generic fringe on top of that specific one would just muddy it.
// Ordering follows SS9's Ocean -> Coast -> Plains -> Hills -> Mountains
// palette chain, with Forest/Swamp branching off Plains and Desert/
// Tundra deliberately tied at the same tier (SS9: "exempt from the
// chain") -- this tie only matters for the shadow now, not the color
// blend, since desert and tundra still color-blend against each other
// like any other differing pair.
window.GameData.TERRAIN = {
  ocean: {
    id: "ocean", label: "Ocean", color: "#1c3f5e",
    isWater: true, isDeepWater: true, blendPriority: 0,
    yield: { harvest: 0, coin: 0, lore: 0 },
    moveCostLand: window.GameData.IMPASSABLE,
    moveCostNaval: 1,
  },
  coast: {
    id: "coast", label: "Shallow Water / Coast", color: "#3a6f8f",
    isWater: true, isDeepWater: false, blendPriority: 1,
    yield: { harvest: 2, coin: 1, lore: 0 },
    moveCostLand: window.GameData.IMPASSABLE,
    moveCostNaval: 1,
  },
  plains: {
    id: "plains", label: "Plains", color: "#9bb35b",
    isWater: false, blendPriority: 3,
    yield: { harvest: 2, coin: 1, lore: 0 },
    moveCostLand: 1,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  forest: {
    id: "forest", label: "Forest", color: "#3f6b3f",
    isWater: false, blendPriority: 5,
    yield: { harvest: 1, coin: 1, lore: 0 },
    moveCostLand: 2,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  hills: {
    id: "hills", label: "Hills", color: "#a08b5f",
    isWater: false, blendPriority: 6,
    yield: { harvest: 1, coin: 2, lore: 0 },
    moveCostLand: 2,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  mountains: {
    id: "mountains", label: "Mountains", color: "#8c8368",
    isWater: false, blendPriority: 7,
    yield: { harvest: 0, coin: 2, lore: 0 },
    moveCostLand: window.GameData.IMPASSABLE,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  desert: {
    id: "desert", label: "Desert", color: "#cbb878",
    isWater: false, blendPriority: 2,
    yield: { harvest: 0, coin: 1, lore: 0 },
    moveCostLand: 1,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  swamp: {
    id: "swamp", label: "Swamp/Marsh", color: "#536b4d",
    isWater: false, blendPriority: 4,
    yield: { harvest: 1, coin: 0, lore: 0 },
    moveCostLand: 2,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  tundra: {
    id: "tundra", label: "Tundra", color: "#c4cdd1",
    isWater: false, blendPriority: 2,
    yield: { harvest: 0, coin: 0, lore: 0 },
    moveCostLand: 2,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
};

window.GameData.TERRAIN_LIST = Object.keys(window.GameData.TERRAIN);

// Resource layer: flat bonus yield on top of base terrain, restricted to terrain types.
// iconScale: presentation-only multiplier applied to the tile-icon sprite at
// render time (see render.js) -- sprite art itself is a fixed unit-size
// (128x128) canvas per doc/art_style_guide.md, so relative sizing between
// resource types (e.g. a small fish shoal vs a bigger ruin) is purely a
// render-time scale knob, not baked into separate art resolutions.

// Ruin size defined in render.js as RUIN_ICON_SCALE
window.GameData.RESOURCES = {
  iron:    { id: "iron",    label: "Iron Deposit",  validTerrain: ["hills", "mountains"],          bonus: { coin: 1 },     iconScale: 0.5 },
  game:    { id: "game",    label: "Game",           validTerrain: ["forest", "plains"],            bonus: { harvest: 1 }, iconScale: 0.6 },
  gold:    { id: "gold",    label: "Gold Vein",      validTerrain: ["hills", "mountains", "desert"],bonus: { coin: 1 },     iconScale: 0.5 },
  fertile: { id: "fertile", label: "Fertile Soil",   validTerrain: ["plains", "swamp"],             bonus: { harvest: 1 }, iconScale: 0.75 },
  fish:    { id: "fish",    label: "Fish Shoal",     validTerrain: ["coast"],                       bonus: { harvest: 1 }, iconScale: 1.0 },
  // Treasure Chest (see doc/world_encounters_design.md): unlike every
  // resource above, `bonus: {}` is deliberate, not an oversight -- a chest
  // isn't a worked tile yielding a passive per-turn amount, it's a one-shot
  // "Open Chest" ring-menu action (see ai.js's openTreasureChest) that
  // consumes itself and reschedules elsewhere the instant it's opened.
  // cities.js's computeWorkedTileYield reads `bonus` generically for every
  // tile.resource, so an empty object there is what keeps a placed-but-
  // unopened chest from silently generating yield just by sitting owned
  // inside a city's radius. validTerrain covers every non-water terrain,
  // deliberately -- "any non-water terrain" was the explicit design call.
  chest:   { id: "chest",   label: "Treasure Chest", validTerrain: ["plains", "forest", "hills", "desert", "swamp", "tundra"], bonus: {}, iconScale: 0.55 },
};
window.GameData.RESOURCE_LIST = Object.keys(window.GameData.RESOURCES);

// River adjacency: +1 harvest AND +1 coin on any tile with a river edge
window.GameData.RIVER_YIELD_BONUS = { harvest: 1, coin: 1 };

// Ruins are a tile FEATURE (tile.isRuin), not a RESOURCES entry -- they're
// placed by worldgen independently of the resource layer, can coexist with a
// resource, and are consumed by Dungeon Delve rather than by resource
// exhaustion. Their yield bonus lives here anyway, in the same shape as the
// entries above, so cities.js's computeWorkedTileYield and sidebar.js's tile
// panel can read one shared number instead of each hardcoding its own copy.
window.GameData.RUIN_YIELD_BONUS = { lore: 2 };
window.GameData.RUIN_LABEL = "Ancient Ruin";

// Caves (2026-08-19, user-directed): also a tile FEATURE (tile.isCave), not
// a RESOURCES entry, same reasoning as Ruin above -- placed by worldgen
// (placeCaves), always in linked pairs (tile.caveLinkX/caveLinkY point at
// the partner tile). No yield bonus of its own; the whole point is the
// "Enter Cave" full-turn relocate action (see orders.js's performEnterCave),
// not a passive worked-tile bonus.
window.GameData.CAVE_LABEL = "Cave";
