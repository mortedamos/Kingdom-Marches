/**
 * SPRITE MANIFESTS
 * ----------------
 * Defines animation metadata for every sprite asset. Keyed by the same
 * strings used in window.UI.sprites.get(key).
 *
 * Layout values:
 *   "horizontal" — frames run left-to-right (default)
 *   "vertical"   — frames run top-to-bottom
 *
 * City sprites use named animations per population tier:
 *   "tier1", "tier2", "tier3" ... falling back to "idle" if absent.
 *
 * Add an entry here whenever a new sprite PNG is dropped into assets/.
 * Any key without an entry falls back to the color/symbol renderer.
 */

window.GameData = window.GameData || {};

window.GameData.SPRITE_MANIFESTS = {

  // --- Terrain ---
  "terrain/plains": {
    frameWidth: 64, frameHeight: 64, layout: "horizontal",
    animations: { idle: { frames: [0, 1], fps: 2 } },
  },
  "terrain/hills": {
    frameWidth: 64, frameHeight: 64, layout: "horizontal",
    animations: { idle: { frames: [0, 1], fps: 2 } },
  },
  // terrain/mountains: no entry — static single-frame tiles (no idle
  // animation), falls back to resolveManifest()'s single-frame default.
  "terrain/forest": {
    frameWidth: 64, frameHeight: 64, layout: "horizontal",
    animations: { idle: { frames: [0, 1], fps: 2 } },
  },
  "terrain/swamp": {
    frameWidth: 64, frameHeight: 64, layout: "horizontal",
    animations: { idle: { frames: [0, 1], fps: 2 } },
  },
  // terrain/desert, terrain/tundra: no entry — static single-frame tiles,
  // same fallback as mountains.
  "terrain/coast": {
    frameWidth: 64, frameHeight: 64, layout: "horizontal",
    animations: { idle: { frames: [0, 1], fps: 2 } },
  },
  "terrain/ocean": {
    frameWidth: 64, frameHeight: 64, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 4 } },
  },

  // --- Units ---
  "unit/skeleton": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/raider": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/goblin_miscreant": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/dragon": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/dire_wolf": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/impaler": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/wolf_rider": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/bog_witch": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/wisp": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/battering_ram": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/ogre": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/wanderer": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/pony_patrol": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/militia": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/spearguard": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/cavalry": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/knight": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/paladin": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/archer": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/longbowman": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/catapult": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/trebuchet": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/wizard": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/foehammer": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/troubadour": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/musketeer": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/runeforged_titan": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  // Universal (non-raceOnly) units with race-specific art -- key format
  // "unit/{unitId}/{raceId}", resolved via pickUnit() in js/ui/sprites.js.
  "unit/pioneer/human": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/pioneer/orc": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/pioneer/halfellow": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/pioneer/dwarf": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/pioneer/elf": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/pioneer/undead": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/scout/human": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/scout/orc": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/scout/halfellow": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/scout/dwarf": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/scout/elf": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/scout/undead": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/galley/human": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/galley/orc": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/galley/halfellow": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/galley/dwarf": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/galley/elf": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },
  "unit/galley/undead": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 1 } },
  },

  // --- Cities ---
  // "city/human": { ... },

  // --- Enhancements ---
  "enhancement/resource_iron": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 2 } },
  },
  "enhancement/resource_game": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 2 } },
  },
  "enhancement/resource_gold": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 2 } },
  },
  "enhancement/resource_fertile": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 2 } },
  },
  "enhancement/resource_fish": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 2 } },
  },
  "enhancement/ruin": {
    frameWidth: 128, frameHeight: 128, layout: "horizontal",
    animations: { idle: { frames: [0, 1, 2, 3], fps: 2 } },
  },

};
