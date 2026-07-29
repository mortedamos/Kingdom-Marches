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

window.GameData.TERRAIN = {
  ocean: {
    id: "ocean", label: "Ocean", color: "#1c3f5e",
    isWater: true, isDeepWater: true,
    yield: { harvest: 0, coin: 0, lore: 0 },
    moveCostLand: window.GameData.IMPASSABLE,
    moveCostNaval: 2,
  },
  coast: {
    id: "coast", label: "Shallow Water / Coast", color: "#3a6f8f",
    isWater: true, isDeepWater: false,
    yield: { harvest: 2, coin: 1, lore: 0 },
    moveCostLand: window.GameData.IMPASSABLE,
    moveCostNaval: 1,
  },
  plains: {
    id: "plains", label: "Plains", color: "#9bb35b",
    isWater: false,
    yield: { harvest: 2, coin: 1, lore: 0 },
    moveCostLand: 1,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  forest: {
    id: "forest", label: "Forest", color: "#3f6b3f",
    isWater: false,
    yield: { harvest: 1, coin: 1, lore: 0 },
    moveCostLand: 2,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  hills: {
    id: "hills", label: "Hills", color: "#a08b5f",
    isWater: false,
    yield: { harvest: 1, coin: 2, lore: 0 },
    moveCostLand: 2,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  mountains: {
    id: "mountains", label: "Mountains", color: "#6b6b70",
    isWater: false,
    yield: { harvest: 0, coin: 2, lore: 0 },
    moveCostLand: window.GameData.IMPASSABLE,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  desert: {
    id: "desert", label: "Desert", color: "#cbb878",
    isWater: false,
    yield: { harvest: 0, coin: 1, lore: 0 },
    moveCostLand: 1,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  swamp: {
    id: "swamp", label: "Swamp/Marsh", color: "#536b4d",
    isWater: false,
    yield: { harvest: 1, coin: 0, lore: 0 },
    moveCostLand: 2,
    moveCostNaval: window.GameData.IMPASSABLE,
  },
  tundra: {
    id: "tundra", label: "Tundra", color: "#c4cdd1",
    isWater: false,
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
};
window.GameData.RESOURCE_LIST = Object.keys(window.GameData.RESOURCES);

// River adjacency: +1 harvest AND +1 coin on any tile with a river edge
window.GameData.RIVER_YIELD_BONUS = { harvest: 1, coin: 1 };
