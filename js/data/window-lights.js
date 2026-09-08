/**
 * WINDOW LIGHT POSITIONS
 * ----------------------
 * Where the lamps are on each building and city sprite, for the day/night
 * cycle's window lighting (see js/ui/daynight.js).
 *
 * EDIT THESE WITH tools/window-lights.html, not by typing numbers. That tool
 * shows each sprite magnified with a pixel grid, lets you drag each lamp, and
 * previews the result at real game scale -- which is the only way to tell
 * whether a dot actually reads. A building draws about 52px wide in game, so
 * a window is roughly three pixels: "looks like a lit window at 52px" matters
 * far more than sub-pixel accuracy, and six lamps where three would do just
 * merges into a blob.
 *
 * Do NOT try to detect these at runtime. The art does not cooperate. Windows
 * are frequently DARKER than the wall around them (the Palace's gothic arches
 * are near-black on pale stone), the Halfellow pub's round doors are mid-tone
 * on mid-tone timber, and a castle's arrow slits are two pixels wide. Every
 * brightness- or saturation-based heuristic misfires on at least one of them.
 *
 * A few sprites already have lit windows painted into the art -- the Dwarf
 * Great Hall's two orange panes, dwarf cities 4-6, halfellow city 1. Lamps on
 * those are placed to sit exactly on the painted glow, so the effect reads as
 * the window brightening rather than as a separate dot floating near it.
 *
 * NOT EVERY LAMP IS A WINDOW. Plenty of these buildings have none: a bazaar
 * is open stalls, a dolmen is standing stones, a dragon den is a hole in a
 * rock. Those get the light source the building would actually have at night
 * -- a stall lantern, a ritual glow, the fire down the throat of the cave --
 * because "this place is occupied after dark" is the thing being drawn, and a
 * building with no lamp at all just reads as abandoned.
 *
 * KEYS
 *   "building/<buildingId>"   e.g. "building/palace"
 *   "city/<raceId>/<tier>"    e.g. "city/human/4"   (tier is 1-6)
 * A sprite with no entry still lights and dims on a believable schedule -- it
 * just gets the broad glow and no individual dots. That's the intended
 * fallback for the four Undead buildings, which ship no art at all and render
 * as the symbol placeholder.
 *
 * ENTRY SHAPE
 *   windows: [ [x, y, size?, color?], ... ]
 *     x, y   normalized 0-1 within the sprite's own drawn rect (its IMAGE,
 *            not its tile -- building art is bottom-anchored and overhangs
 *            upward into the tile to the north)
 *     size   optional multiplier on the base dot radius
 *     color  optional per-window override, for light that isn't lamplight --
 *            a forge, a rune, a wisp-lit pool. Defaults to the owning race's
 *            lamp colour from config.js.
 *   alwaysLitChance: 0-1, chance a lamp here ignores the night-time
 *     off-schedule and burns until dawn. Raised for somewhere people would
 *     plausibly still be up (a pub, a mage college, a forge, a watchtower),
 *     lowered for somewhere they wouldn't (a barracks, a market that closed).
 */
window.GameData = window.GameData || {};

window.GameData.WINDOW_LIGHTS = {
  // ===================================================================
  // BUILDINGS
  // ===================================================================

  // ---- Human ----
  "building/bazaar": {
    // Open-air stalls under awnings -- no windows, so these are the traders'
    // own hanging lanterns over the goods.
    windows: [[0.30, 0.600], [0.42, 0.585], [0.52, 0.605, 0.8]],
    alwaysLitChance: 0.08, // a market packs up at dusk
  },
  "building/guild_hall": {
    // Round gable window over the arched door, plus the side-wing panes.
    windows: [
      [0.470, 0.470, 1.2],
      [0.400, 0.620],
      [0.660, 0.620],
      [0.740, 0.640, 0.8],
      [0.500, 0.700, 0.9],
    ],
    alwaysLitChance: 0.25,
  },
  "building/mage_college": {
    // The crystal at the tower's crown is already emissive in the art, so it
    // gets a big cool-white lamp rather than the race's warm candle.
    windows: [
      [0.500, 0.300, 1.5, "#9fd0ff"],
      [0.500, 0.450, 1.1],
      [0.440, 0.570, 0.8],
      [0.550, 0.630, 0.8],
      [0.560, 0.730, 0.9],
    ],
    alwaysLitChance: 0.50, // scholars keep terrible hours
  },
  "building/palace": {
    // Gothic nave: one tall arch over the entrance, flanking arches down both
    // aisles, and a single lit window high in the spire.
    windows: [
      [0.500, 0.620, 1.2],
      [0.420, 0.630],
      [0.580, 0.610],
      [0.660, 0.600],
      [0.730, 0.630, 0.8],
      [0.360, 0.610, 0.8],
      [0.500, 0.400, 0.9],
    ],
    alwaysLitChance: 0.22,
  },

  // ---- Elf ----
  "building/altar_of_ages": {
    // Standing stones round a totem. No windows -- this is the altar flame
    // and the glimmer it throws on the nearest stones.
    windows: [[0.500, 0.550, 1.2], [0.300, 0.620, 0.6], [0.680, 0.620, 0.6]],
    alwaysLitChance: 0.40,
  },
  "building/silverleaf_atelier": {
    windows: [
      [0.360, 0.650, 1.1],
      [0.530, 0.620],
      [0.630, 0.640],
      [0.720, 0.660, 0.8],
    ],
    alwaysLitChance: 0.35, // craftwork runs late
  },
  "building/treetop_watch": {
    // Only the crow's nest is occupied; the ladder foot gets a token lamp.
    windows: [[0.520, 0.320, 1.2], [0.500, 0.850, 0.6]],
    alwaysLitChance: 0.60, // someone is on watch all night, by definition
  },
  "building/wellspring_grove": {
    // The pool itself is the light, cool rather than warm.
    windows: [
      [0.500, 0.600, 1.5, "#bfe8ff"],
      [0.350, 0.450, 0.6],
      [0.650, 0.450, 0.6],
    ],
    alwaysLitChance: 0.55, // a spring doesn't go to bed
  },

  // ---- Dwarf ----
  "building/deep_forge": {
    // Chimney mouth and the forge's own opening -- both fire, not lamplight.
    windows: [
      [0.430, 0.300, 1.0, "#ffb14a"],
      [0.600, 0.600, 1.3, "#ff9a4d"],
      [0.500, 0.580, 0.7],
    ],
    alwaysLitChance: 0.65, // a forge banked overnight still glows
  },
  "building/deep_gate": {
    // The violet runes around the arch, plus the dark of the gateway itself.
    windows: [
      [0.500, 0.360, 1.0, "#b48cff"],
      [0.380, 0.480, 0.8, "#b48cff"],
      [0.620, 0.480, 0.8, "#b48cff"],
      [0.500, 0.580, 0.9],
    ],
    alwaysLitChance: 0.75, // runes don't sleep
  },
  "building/great_hall": {
    // Two lit panes are already painted into this sprite; these sit on them.
    windows: [
      [0.455, 0.600, 1.2],
      [0.525, 0.655, 1.2],
      [0.660, 0.470, 0.7],
      [0.630, 0.660, 0.8],
    ],
    alwaysLitChance: 0.35,
  },
  "building/runewall": {
    windows: [
      [0.420, 0.370, 0.9, "#8fe4ff"],
      [0.550, 0.420, 0.9, "#8fe4ff"],
      [0.500, 0.620, 1.1, "#8fe4ff"],
      [0.330, 0.570, 0.7, "#8fe4ff"],
      [0.670, 0.520, 0.7, "#8fe4ff"],
    ],
    alwaysLitChance: 0.80,
  },

  // ---- Orc ----
  "building/ancestral_dolmen": {
    windows: [[0.500, 0.600, 0.9], [0.300, 0.660, 0.7]],
    alwaysLitChance: 0.30,
  },
  "building/butchery": {
    // The stone fire pit does all the work here.
    windows: [[0.530, 0.720, 1.4], [0.460, 0.550, 0.6]],
    alwaysLitChance: 0.30,
  },
  "building/dragon_den": {
    // Something is awake down there.
    windows: [[0.520, 0.640, 1.5, "#ff7a3a"], [0.440, 0.580, 0.6]],
    alwaysLitChance: 0.50,
  },
  "building/war_camp": {
    windows: [[0.520, 0.620, 1.1], [0.400, 0.570, 0.6]],
    alwaysLitChance: 0.45, // a war camp posts a watch
  },

  // ---- Halfellow ----
  "building/armory": {
    windows: [[0.370, 0.660, 1.0], [0.550, 0.670, 1.0], [0.640, 0.620, 0.7]],
    alwaysLitChance: 0.12, // barracks: lights out
  },
  "building/farmers_market": {
    windows: [[0.400, 0.630, 1.0], [0.520, 0.670, 0.9], [0.620, 0.620, 0.7]],
    alwaysLitChance: 0.08,
  },
  "building/historical_society": {
    // The clock face reads as a lit disc at night; the round door beside it
    // and the small side window fill the rest.
    windows: [[0.420, 0.630, 1.0], [0.660, 0.630, 0.9], [0.570, 0.680, 1.1]],
    alwaysLitChance: 0.30,
  },
  "building/neighborhood_pub": {
    // The two round golden panes are painted into the art already; the big
    // red door spills light too.
    windows: [[0.355, 0.545, 1.1], [0.635, 0.600, 1.1], [0.500, 0.560, 1.3]],
    alwaysLitChance: 0.65, // last one out gets the lamps
  },

  // ===================================================================
  // CITIES  (tier 1-6; the same settlement growing, so lamp counts grow too)
  // ===================================================================

  // ---- Human: chapel -> hamlet -> walled castle ----
  "city/human/1": { windows: [[0.420, 0.755, 1.0], [0.530, 0.775, 0.9]] },
  "city/human/2": {
    windows: [
      [0.500, 0.600, 0.9], [0.400, 0.720], [0.300, 0.755, 0.8],
      [0.600, 0.745], [0.520, 0.780, 0.8],
    ],
  },
  "city/human/3": {
    windows: [
      [0.500, 0.560, 0.9], [0.370, 0.660], [0.420, 0.685],
      [0.600, 0.650], [0.660, 0.670, 0.8], [0.450, 0.725, 0.8], [0.550, 0.720, 0.8],
    ],
  },
  "city/human/4": {
    windows: [
      [0.440, 0.620, 0.9], [0.570, 0.600, 0.9],
      [0.400, 0.720], [0.500, 0.720], [0.600, 0.710],
      [0.330, 0.780, 0.7], [0.680, 0.780, 0.7], [0.500, 0.820, 1.0],
    ],
  },
  "city/human/5": {
    windows: [
      [0.550, 0.300, 0.9], [0.400, 0.420, 0.8], [0.680, 0.450, 0.8],
      [0.380, 0.590], [0.470, 0.580], [0.560, 0.585], [0.640, 0.600],
      [0.350, 0.700, 0.8], [0.520, 0.700], [0.650, 0.710, 0.8],
      [0.480, 0.830, 1.0],
    ],
  },
  "city/human/6": {
    windows: [
      [0.530, 0.350, 0.9], [0.380, 0.470, 0.8], [0.680, 0.480, 0.8],
      [0.360, 0.620], [0.460, 0.605], [0.560, 0.615], [0.660, 0.630],
      [0.330, 0.720, 0.8], [0.500, 0.715], [0.670, 0.730, 0.8],
      [0.500, 0.840, 1.0],
    ],
  },

  // ---- Elf: hollow tree -> treehouse village -> great spire ----
  // Elf lamps are the pale silver-green from config, so these read as
  // witchlight in the canopy rather than hearth fire.
  "city/elf/1": { windows: [[0.420, 0.820, 1.0]] },
  "city/elf/2": {
    windows: [[0.570, 0.720], [0.330, 0.755, 0.8], [0.470, 0.780, 0.9]],
  },
  "city/elf/3": {
    windows: [
      [0.420, 0.660], [0.610, 0.630], [0.500, 0.720, 0.8], [0.380, 0.725, 0.8],
    ],
  },
  "city/elf/4": {
    windows: [
      [0.350, 0.530], [0.630, 0.530], [0.320, 0.680], [0.660, 0.660],
      [0.400, 0.750, 0.8], [0.600, 0.740, 0.8], [0.500, 0.830, 1.0],
    ],
  },
  "city/elf/5": {
    windows: [
      [0.500, 0.300, 0.8], [0.370, 0.580], [0.620, 0.570],
      [0.300, 0.700, 0.8], [0.680, 0.700, 0.8],
      [0.450, 0.780, 0.8], [0.570, 0.780, 0.8], [0.500, 0.850, 0.9],
    ],
  },
  "city/elf/6": {
    windows: [
      [0.500, 0.220, 0.9], [0.420, 0.450, 0.8], [0.580, 0.450, 0.8],
      [0.350, 0.590], [0.650, 0.585], [0.300, 0.700, 0.8], [0.700, 0.700, 0.8],
      [0.440, 0.780, 0.8], [0.560, 0.780, 0.8], [0.500, 0.850, 0.9],
    ],
  },

  // ---- Dwarf: blockhouse -> hold -> mountain fortress ----
  // Tiers 4-6 have forge glow painted into the art; these sit on it.
  "city/dwarf/1": { windows: [[0.470, 0.760, 1.0]] },
  "city/dwarf/2": { windows: [[0.370, 0.730], [0.600, 0.750]] },
  "city/dwarf/3": {
    windows: [
      [0.400, 0.575, 0.9, "#ff9a4d"], [0.620, 0.750], [0.450, 0.680, 0.8],
    ],
  },
  "city/dwarf/4": {
    windows: [
      [0.400, 0.720], [0.500, 0.725], [0.585, 0.720],
      [0.620, 0.575, 0.8, "#ff9a4d"], [0.300, 0.740, 0.8],
    ],
  },
  "city/dwarf/5": {
    windows: [
      [0.440, 0.420], [0.550, 0.420], [0.380, 0.550], [0.500, 0.570, 1.2, "#ff9a4d"],
      [0.600, 0.550], [0.420, 0.720], [0.550, 0.700], [0.660, 0.700, 0.8],
    ],
  },
  "city/dwarf/6": {
    windows: [
      [0.550, 0.510, 0.8, "#ff9a4d"], [0.600, 0.500, 0.8, "#ff9a4d"],
      [0.650, 0.500, 0.8, "#ff9a4d"],
      [0.420, 0.720, 1.1], [0.330, 0.680], [0.700, 0.700], [0.500, 0.780, 0.8],
    ],
  },

  // ---- Orc: camp -> palisade -> stronghold ----
  // Almost all firelight -- orcs don't glaze windows.
  "city/orc/1": { windows: [[0.550, 0.685, 1.1]] },
  "city/orc/2": { windows: [[0.500, 0.785, 1.2], [0.620, 0.720, 0.7]] },
  "city/orc/3": {
    windows: [[0.440, 0.720], [0.620, 0.730], [0.520, 0.680, 0.8]],
  },
  "city/orc/4": {
    windows: [[0.420, 0.580, 0.9], [0.560, 0.600, 0.9], [0.480, 0.700, 0.8]],
  },
  "city/orc/5": {
    windows: [
      [0.615, 0.565, 1.4, "#ff7a3a"], [0.420, 0.550], [0.530, 0.520, 0.8],
      [0.680, 0.570, 0.8], [0.500, 0.660, 0.8],
    ],
  },
  "city/orc/6": {
    windows: [
      [0.700, 0.620, 1.0], [0.450, 0.580, 0.9], [0.570, 0.560, 0.9],
      [0.360, 0.660, 0.8], [0.520, 0.700, 0.8],
    ],
  },

  // ---- Halfellow: burrow -> hill village -> mill town ----
  "city/halfellow/1": {
    windows: [[0.245, 0.790, 1.0], [0.330, 0.790, 1.1], [0.200, 0.800, 0.8]],
    alwaysLitChance: 0.30, // halfellows are a sociable lot
  },
  "city/halfellow/2": {
    windows: [
      [0.400, 0.775], [0.520, 0.775], [0.620, 0.780, 0.8], [0.300, 0.790, 0.8],
    ],
    alwaysLitChance: 0.30,
  },
  "city/halfellow/3": {
    windows: [
      [0.360, 0.775], [0.440, 0.775], [0.560, 0.775], [0.640, 0.780, 0.8],
      [0.500, 0.800, 0.8],
    ],
    alwaysLitChance: 0.30,
  },
  "city/halfellow/4": {
    windows: [
      [0.570, 0.660, 0.9], [0.330, 0.790], [0.420, 0.755], [0.520, 0.755],
      [0.630, 0.790, 0.8], [0.250, 0.800, 0.8],
    ],
    alwaysLitChance: 0.30,
  },
  "city/halfellow/5": {
    windows: [
      [0.440, 0.660, 0.9], [0.580, 0.790, 0.8], [0.300, 0.790],
      [0.400, 0.770], [0.620, 0.750], [0.700, 0.790, 0.8],
    ],
    alwaysLitChance: 0.30,
  },
  "city/halfellow/6": {
    windows: [
      [0.560, 0.650, 0.9], [0.280, 0.790], [0.380, 0.770], [0.470, 0.790],
      [0.620, 0.760], [0.720, 0.790, 0.8], [0.550, 0.850, 0.8],
    ],
    alwaysLitChance: 0.30,
  },
};
