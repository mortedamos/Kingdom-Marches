/**
 * WORLD GENERATION ENGINE
 * ------------------------
 * Implements: elevation noise -> terrain classification, climate (moisture +
 * temperature) -> land terrain typing, connectivity/min-landmass enforcement,
 * resource placement, simplified river generation, ruin placement.
 *
 * See realms_of_influence_terrain_generation.md and the ruins addendum for
 * full design rationale. This is a real implementation of that pipeline,
 * using a hand-rolled value-noise function (no external noise library
 * dependency, to keep this a zero-build-step vanilla JS project).
 */

window.GameEngine = window.GameEngine || {};

(function () {
  const TERRAIN = window.GameData.TERRAIN;
  const RESOURCES = window.GameData.RESOURCES;

  // --- Seeded PRNG (mulberry32) so maps are reproducible from a seed ---
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Simple 2D value noise (not true Simplex, but produces comparable
  //     smooth, multi-octave terrain without an external dependency) ---
  function makeValueNoise(rng) {
    const gridSize = 256;
    const grad = new Float32Array(gridSize * gridSize);
    // Centered gradients (-1..1, not 0..1) -- critical for multi-octave
    // summing to preserve variance rather than regressing toward the mean.
    // (Found via testing: 0..1 gradients made every map ~85-95% land with
    // only one giant connected landmass, which contradicted the intended
    // multi-continent world shape entirely.)
    for (let i = 0; i < grad.length; i++) grad[i] = rng() * 2 - 1;

    function sample(x, y) {
      const xi = Math.floor(x) & (gridSize - 1);
      const yi = Math.floor(y) & (gridSize - 1);
      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const x1 = (xi + 1) & (gridSize - 1);
      const y1 = (yi + 1) & (gridSize - 1);

      const v00 = grad[yi * gridSize + xi];
      const v10 = grad[yi * gridSize + x1];
      const v01 = grad[y1 * gridSize + xi];
      const v11 = grad[y1 * gridSize + x1];

      const sx = xf * xf * (3 - 2 * xf); // smoothstep
      const sy = yf * yf * (3 - 2 * yf);

      const top = v00 + sx * (v10 - v00);
      const bottom = v01 + sx * (v11 - v01);
      return top + sy * (bottom - top);
    }

    // Multi-octave wrapper. persistence=0.55 (not the more common 0.5)
    // tested as giving slightly more high-frequency detail without losing
    // the large-scale landmass shapes that low frequency provides.
    return function octaveNoise(x, y, scale, octaves = 4, persistence = 0.55) {
      let value = 0, amplitude = 1, frequency = scale, maxAmp = 0;
      for (let o = 0; o < octaves; o++) {
        value += sample(x * frequency, y * frequency) * amplitude;
        maxAmp += amplitude;
        amplitude *= persistence;
        frequency *= 2;
      }
      return (value / maxAmp + 1) / 2; // remap from ~-1..1 back to 0..1
    };
  }

  /** Per-worldType tuning for the water-threshold/elevation-frequency logic
   *  just below (see WORLD_TYPES' own doc comment). "continent" is the
   *  original, unparametrized behavior (WATER_REDUCTION 0.3, elevation
   *  scale 0.07) -- every other entry is defined relative to it so a design
   *  tweak to continent's own numbers propagates sensibly rather than
   *  silently decoupling the four types. */
  const WORLD_TYPE_CONFIG = {
    // waterMode "reduce": same empirical-percentile technique as the
    // original code -- shrink THIS map's own old-cutoff water count by a
    // fraction, rather than targeting an absolute tile count, so it stays
    // robust to a given seed's actual noise distribution.
    continent: { elevationScale: 0.07, elevationOctaves: 4, waterMode: "reduce", waterReduction: 0.3 },
    // "+15% water tiles from current" (2026-08-19, user-directed): current
    // == continent's own resulting water count (oldWaterCount * 0.7), so
    // the equivalent single reduction fraction is 1 - 0.7*1.15.
    normal: { elevationScale: 0.07, elevationOctaves: 4, waterMode: "reduce", waterReduction: 1 - 0.7 * 1.15 },
    // Islands need BOTH more water AND smaller, more numerous landmasses --
    // reduce alone would just shrink the same few continents, not fragment
    // them. waterMode "fraction" targets an absolute share of the whole
    // map instead of a relative reduction (a single continent's worth of
    // land pushed that low would read as "one small landmass", not
    // "archipelago"). elevationScale more than triples the noise frequency
    // AND elevationOctaves drops from 4 to 2 -- fewer octaves means less of
    // the low-frequency "continent-shaped" component that otherwise still
    // dominates the overall land layout even at a higher base frequency
    // (found via testing: scale alone still produced an occasional
    // 200+-tile landmass every few seeds, because octaves 3-4 kept adding
    // back broad, low-frequency structure on top of the higher-frequency
    // detail). With just 2 octaves at this frequency, high ground breaks
    // into many separate small bumps instead of one connected shape --
    // enforceMinimumLandmassSize's existing 13-tile floor (one city plus a
    // spare open tile) then does the rest of the "1-2 cities each" sizing
    // for free.
    islands: { elevationScale: 0.30, elevationOctaves: 2, waterMode: "fraction", waterFraction: 0.72 },
    // waterMode "none": every tile skips the ocean/coast branch entirely
    // (see LAND_CUT/OCEAN_CUT below) and falls through to the ordinary
    // land classification, so this reuses the whole Tundra/Mountains/Hills/
    // climate pipeline as-is rather than needing a separate "convert water
    // to land" pass after the fact.
    noWater: { elevationScale: 0.07, elevationOctaves: 4, waterMode: "none" },
  };

  /**
   * Generates a full map. Returns { width, height, tiles, seed }.
   * tiles is a flat array of tile objects, index = y*width + x.
   * worldType selects one of WORLD_TYPE_CONFIG's keys (default "continent",
   * today's original behavior, unchanged) -- see main.js's Game Options
   * "World Type" slider.
   */
  function generateMap(width, height, seed, worldType) {
    const typeConfig = WORLD_TYPE_CONFIG[worldType] || WORLD_TYPE_CONFIG.continent;
    const rng = makeRng(seed);
    const elevationNoise = makeValueNoise(rng);
    const moistureNoise = makeValueNoise(rng); // independent gradient set
    const tempNoise = makeValueNoise(rng);     // perturbation for polar boundary

    const tiles = new Array(width * height);

    // --- Pass 1: sample elevation/moisture/temperature for every tile ---
    const elevArr = new Float32Array(width * height);
    const moistArr = new Float32Array(width * height);
    const tempArr = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        elevArr[idx] = elevationNoise(x, y, typeConfig.elevationScale, typeConfig.elevationOctaves, 0.55);
        moistArr[idx] = moistureNoise(x, y, 0.06, 3, 0.55);
        // Base temperature from latitude, plus a low-frequency noise offset so
        // the tundra boundary is irregular rather than a straight horizontal line.
        const latTemp = 1.0 - Math.pow(Math.abs(y - height / 2) / (height / 2), 1.8);
        // Higher noise frequency (0.10 vs 0.04) gives ~10-tile feature widths instead of
        // ~25-tile widths, producing a visibly jagged polar border rather than a smooth line.
        // Larger magnitude (0.28 vs 0.18) creates deeper finger-like protrusions.
        const jitter = tempNoise(x, y, 0.10, 3, 0.55) * 0.28;
        tempArr[idx] = Math.max(0, Math.min(1, latTemp + jitter));
      }
    }

    // --- Water (Ocean+Coast) share, relative to the fixed cutoffs
    // (0.415/0.455) -- empirical-percentile technique, same as the rest of
    // this file: measure what this map's actual water count would be under
    // those fixed cutoffs, then find the elevation values that leave only
    // the worldType's own target fraction of that, preserving the existing
    // ocean:coast SPLIT. Per-map percentile target rather than a fixed
    // constant, same reasoning as why mountainThresh/hillThresh/etc. aren't
    // fixed constants either. See WORLD_TYPE_CONFIG for what each type
    // actually targets.
    const OLD_OCEAN_CUT = 0.415, OLD_LAND_CUT = 0.455;
    const allElevsAsc = Array.from(elevArr).sort((a, b) => a - b);
    const oldWaterRank = allElevsAsc.findIndex((e) => e >= OLD_LAND_CUT);
    const oldWaterCount = oldWaterRank === -1 ? allElevsAsc.length : oldWaterRank;
    const oldOceanRank = allElevsAsc.findIndex((e) => e >= OLD_OCEAN_CUT);
    const oldOceanCount = oldOceanRank === -1 ? oldWaterCount : oldOceanRank;
    const oceanShareOfWater = oldWaterCount > 0 ? oldOceanCount / oldWaterCount : 0.5;

    let LAND_CUT, OCEAN_CUT;
    if (typeConfig.waterMode === "none") {
      // Every real elevation value is >= 0 after the noise remap (see
      // makeValueNoise's octaveNoise) -- a cutoff below that never matches,
      // so every tile falls through to the ordinary land classification.
      LAND_CUT = -1;
      OCEAN_CUT = -1;
    } else {
      const newWaterCount = typeConfig.waterMode === "fraction"
        ? Math.round(allElevsAsc.length * typeConfig.waterFraction)
        : Math.round(oldWaterCount * (1 - typeConfig.waterReduction));
      const newOceanCount = Math.round(newWaterCount * oceanShareOfWater);
      LAND_CUT = allElevsAsc[newWaterCount] ?? OLD_LAND_CUT;
      OCEAN_CUT = allElevsAsc[newOceanCount] ?? OLD_OCEAN_CUT;
    }

    // --- TUNDRA stays a pure latitude/temperature rule, kept at the poles
    // rather than equalized like the other land types below. Checked FIRST
    // for land tiles, ahead of elevation -- a cold, high-elevation tile is
    // Tundra, not Mountains/Hills. This decouples Tundra's land-share into a
    // clean, independent quantity driven purely by the latitude noise, which
    // is what makes the six-way equalization below solvable at all: Tundra's
    // share isn't a target, it's just whatever the polar band naturally is,
    // and the other six types split whatever land is left.
    const TUNDRA_TEMP_CUT = 0.38;

    // --- Roughly-equal land distribution across the six non-Tundra types
    // (Mountains, Hills, Plains, Forest, Desert, Swamp) -- each targets
    // ~1/6 of the non-Tundra land pool, via the same empirical-percentile
    // technique this file uses elsewhere (a noise distribution's actual
    // shape rarely lines up with a hand-picked cutoff, so thresholds are
    // derived from THIS map's own tile population instead of a constant).
    // Elevation still picks Mountains/Hills first, THEN climate (temperature
    // band + moisture) splits the rest into Plains/Forest/Desert/Swamp.
    const equalizablePool = [];
    let totalLandCount = 0;
    for (let i = 0; i < elevArr.length; i++) {
      if (elevArr[i] < LAND_CUT) continue; // water
      totalLandCount++;
      if (tempArr[i] <= TUNDRA_TEMP_CUT) continue; // polar land -- always Tundra, excluded from equalization
      equalizablePool.push(i);
    }
    const NUM_EQUAL_TYPES = 6; // Mountains, Hills, Plains, Forest, Desert, Swamp
    const basePerType = equalizablePool.length / NUM_EQUAL_TYPES; // even 1/6-each baseline

    // Mountains deliberately undershoots that baseline -- impassable terrain
    // covering a full 1/6 of non-Tundra land feels like too much.
    // MOUNTAIN_SHARE_REDUCTION is a percentage-POINT cut against TOTAL land,
    // converted to a tile count and redistributed evenly across the other
    // five types so Hills/Plains/Forest/Desert/Swamp stay roughly even with
    // EACH OTHER, just each a little bigger to absorb what Mountains gave up.
    const MOUNTAIN_SHARE_REDUCTION = 0.06;
    const mountainReductionCount = MOUNTAIN_SHARE_REDUCTION * totalLandCount;
    const mountainTarget = Math.max(0, basePerType - mountainReductionCount);
    const otherTarget = basePerType + (basePerType - mountainTarget) / 5;

    const poolElevsDesc = equalizablePool.map((i) => elevArr[i]).sort((a, b) => b - a);
    const mountainThresh = poolElevsDesc[Math.floor(mountainTarget)] ?? 0.88;
    const hillThresh     = poolElevsDesc[Math.floor(mountainTarget + otherTarget)] ?? 0.78;

    // Flat (non-Mountains, non-Hills) pool tiles, split by the same hot/
    // temperate temperature band classifyClimate already keys off of.
    const hotMoist = [], temperateMoist = [];
    for (const i of equalizablePool) {
      if (elevArr[i] >= hillThresh) continue; // already Mountains/Hills
      if (tempArr[i] > 0.66) hotMoist.push(moistArr[i]);
      else temperateMoist.push(moistArr[i]); // temp > TUNDRA_TEMP_CUT guaranteed by pool membership
    }
    hotMoist.sort((a, b) => a - b);        // ascending: dry -> wet
    temperateMoist.sort((a, b) => a - b);

    // Hot band has 3 outcomes (Desert/Plains/Swamp): Desert takes the
    // driest slice, Swamp the wettest, Plains whatever's left in the
    // middle. Desert/Swamp each target otherTarget tiles out of the
    // WHOLE pool, not just this band (otherTarget, not basePerType --
    // see the Mountains reduction above, whose freed share these five
    // types absorb), so their in-band fraction is otherTarget/hotMoist.length
    // -- capped at 45% each so the two can never consume an entire
    // (possibly small) hot band and squeeze Plains out of it completely.
    let desertCut = 0.33, swampCut = 0.66;
    if (hotMoist.length > 0) {
      const edgeFrac = Math.min(0.45, otherTarget / hotMoist.length);
      const desertIdx = Math.max(0, Math.round(hotMoist.length * edgeFrac) - 1);
      const swampIdx = Math.min(hotMoist.length - 1, hotMoist.length - Math.round(hotMoist.length * edgeFrac));
      desertCut = hotMoist[desertIdx];
      swampCut = hotMoist[Math.max(desertIdx, swampIdx)];
    }

    // Temperate band has 2 outcomes (Plains/Forest): Forest takes the
    // wettest slice (same direction as the original design), Plains the
    // rest. Forest targets otherTarget out of the whole pool, capped at
    // 90% of the band so a tiny temperate band can't go 100% Forest.
    let forestCut = 0.66;
    if (temperateMoist.length > 0) {
      const forestFrac = Math.min(0.9, otherTarget / temperateMoist.length);
      const forestIdx = Math.max(0, temperateMoist.length - Math.round(temperateMoist.length * forestFrac));
      forestCut = temperateMoist[Math.min(temperateMoist.length - 1, forestIdx)];
    }

    // --- Pass 2: classify terrain using percentile-derived thresholds ---
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const elevation = elevArr[idx];
        const moisture  = moistArr[idx];
        const temperature = tempArr[idx];

        // Ocean/coast cutoffs are OCEAN_CUT/LAND_CUT, computed once above
        // per-map to target less total water than the fixed 0.415/0.455
        // baseline (see WATER_REDUCTION above).
        let terrainId;
        if (elevation < OCEAN_CUT) terrainId = "ocean";
        else if (elevation < LAND_CUT) terrainId = "coast";
        else if (temperature <= TUNDRA_TEMP_CUT) terrainId = "tundra";
        else if (elevation >= mountainThresh) terrainId = "mountains";
        else if (elevation >= hillThresh) terrainId = "hills";
        else {
          terrainId = classifyClimate(temperature, moisture, desertCut, swampCut, forestCut);
        }

        tiles[idx] = {
          x, y, terrain: terrainId,
          resource: null, hasRoad: false, hasRiver: { n: false, s: false, e: false, w: false },
          isRuin: false, landmassId: -1,
          isCave: false, caveLinkX: -1, caveLinkY: -1,
          ownerCivId: null, status: "neutral", contestedTurns: 0,
          tallMountainEligible: false,
        };
      }
    }

    // --- Step 4a: no tile fully walled in by Mountains ---
    // Before landmass sizing below: whether a demoted ring tile survives
    // enforceMinimumLandmassSize is irrelevant to it (Mountains and Hills are
    // both land for flood-fill purposes -- this never changes which tiles
    // ARE land, only which land tiles are Mountains), but running it first
    // keeps this as a pure extension of Pass 2's own classification, before
    // any other step starts reasoning about the terrain map's shape.
    breakMountainRings(tiles, width, height, elevArr);

    // --- Step 4b: mark interior tiles of large mountain ranges eligible for
    // the occasional tall/overhanging peak sprite. Purely geographic --
    // render.js still rolls the actual rarity per eligible tile at render
    // time; this pass only decides which tiles are ALLOWED to roll at all,
    // so a small mountain patch or the edge of a large range never gets the
    // dramatic overhang treatment, only tiles buried well inside a genuinely
    // large contiguous range. Run after breakMountainRings so it sees the
    // final mountain layout, not one that's about to lose edge tiles to the
    // ring fix.
    markTallMountainEligibility(tiles, width, height);

    // --- Step 5: connectivity + Step 5a: minimum landmass size enforcement ---
    // A landmass has to be able to hold at least one city plus a spare open
    // tile around it (see ai.js's landmassHasSpareOpenTile) for an invader to
    // ever have somewhere to land -- too small and the wall-saturation fix
    // there couldn't leave a gap even if it wanted to.
    let landmasses = findLandmasses(tiles, width, height);
    landmasses = enforceMinimumLandmassSize(tiles, landmasses, 13);

    // Stamp landmassId onto each tile so road-connectivity checks can detect
    // cross-island founding (which is exempt from the road-connection requirement).
    for (let lmIdx = 0; lmIdx < landmasses.length; lmIdx++) {
      for (const tileIdx of landmasses[lmIdx]) {
        tiles[tileIdx].landmassId = lmIdx;
      }
    }

    // --- Step 6: resource placement + fairness pass ---
    placeResources(tiles, width, height, rng, landmasses);

    // --- Step 7: rivers ---
    generateRivers(tiles, width, height, rng, landmasses);

    // --- Ruins (guaranteed minimum per landmass, land-only, never on water) ---
    placeRuins(tiles, width, height, rng, landmasses);

    // --- Caves (1-2 linked pairs per map, land-only, never on water) ---
    placeCaves(tiles, width, height, rng, landmasses);

    return { width, height, tiles, seed, landmasses };
  }

  /** Per terrain doc §3.3 lookup table -- desertCut/swampCut/forestCut are
   *  the percentile-derived Plains-band cutoffs computed per-map above
   *  (replacing the old fixed 0.33/0.66 literals) so Plains lands close to
   *  TARGET_PLAINS_FRACTION of land regardless of this seed's actual
   *  moisture distribution. */
  function classifyClimate(temperature, moisture, desertCut = 0.33, swampCut = 0.66, forestCut = 0.66) {
    if (temperature > 0.66) {
      if (moisture > swampCut) return "swamp";
      if (moisture > desertCut) return "plains";
      return "desert";
    }
    if (temperature > 0.38) {
      if (moisture > forestCut) return "forest";
      return "plains";
    }
    return "tundra";
  }

  function isLand(tile) {
    return !TERRAIN[tile.terrain].isWater;
  }

  /**
   * 8-directional (diagonal-inclusive) flood fill -- MUST match the
   * connectivity every actual movement/reachability check in ai.js uses
   * (canReachByLand's own BFS, and the Chebyshev distance used pervasively
   * throughout), not just cardinal neighbors. A 4-directional fill would
   * assign two land tiles touching only at a corner (a common "pinch point"
   * in procedurally generated coastlines) to different landmassId's even
   * though a unit can walk diagonally between them -- every landmassId-based
   * pre-filter in ai.js (Dire Wolf's hunt among many others) would then
   * wrongly discard a genuinely reachable target/tile before its own,
   * correctly-8-directional reachability check ever got a chance to confirm
   * it.
   */
  function findLandmasses(tiles, width, height) {
    const visited = new Uint8Array(width * height);
    const landmasses = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (visited[idx] || !isLand(tiles[idx])) continue;
        const stack = [idx];
        const group = [];
        visited[idx] = 1;
        while (stack.length) {
          const cur = stack.pop();
          group.push(cur);
          const cx = cur % width, cy = Math.floor(cur / width);
          const neighbors = [
            [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1],
            [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1],
          ];
          for (const [nx, ny] of neighbors) {
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const nIdx = ny * width + nx;
            if (visited[nIdx] || !isLand(tiles[nIdx])) continue;
            visited[nIdx] = 1;
            stack.push(nIdx);
          }
        }
        landmasses.push(group);
      }
    }
    return landmasses;
  }

  function enforceMinimumLandmassSize(tiles, landmasses, minSize) {
    // Removing sub-minimum landmasses (converting to ocean) cannot fragment
    // a *surviving* landmass into smaller pieces -- flood-fill groups are
    // already maximal connected components, and deleting one group entirely
    // doesn't touch the tiles of any other group. So a single pass is
    // provably sufficient; no re-check needed.
    const survivors = [];
    for (const group of landmasses) {
      if (group.length < minSize) {
        for (const idx of group) tiles[idx].terrain = "ocean";
      } else {
        survivors.push(group);
      }
    }
    return survivors;
  }

  /**
   * Ensures no non-Mountain, non-water tile is entirely walled in by
   * Mountains. Movement in this game is 8-directional (see ai.js's
   * canReachByLand/buildMoveRules -- diagonal steps are legal moves, not
   * just a rendering nicety), and Mountains are flatly IMPASSABLE for a land
   * unit (terrain.js) short of a specific mid-tree tech (mountain tunneling)
   * or flight -- so a tile whose every EXISTING neighbor (all 8 in the
   * interior; fewer at a map edge, where "off map" blocks a step just as
   * completely as Mountains would) is Mountains is a genuine, permanent
   * trap that could hand one race a founding site no other civ's army could
   * ever physically reach. Demotes the LOWEST-elevation (most Hills-like, so
   * the fix reads as natural terrain rather than an obviously patched tile)
   * surrounding Mountain to Hills for each ringed tile found -- the minimum
   * edit that opens a way through.
   *
   * Deliberately scoped to PURE Mountain rings, not "any impassable
   * terrain" (which would also pull in Ocean/Coast, and turn this into a
   * much larger general reachability audit).
   *
   * A single top-to-bottom pass is sufficient: demoting a Mountain to Hills
   * can only ever OPEN a path, never close one, so fixing tile A can't ring
   * in some other tile B that was fine before -- there's nothing for a
   * second pass to find that the first one wouldn't already have caught.
   */
  function breakMountainRings(tiles, width, height, elevArr) {
    const TERRAIN = window.GameData.TERRAIN;
    let fixedCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const tile = tiles[idx];
        if (tile.terrain === "mountains" || TERRAIN[tile.terrain].isWater) continue;

        let allMountains = true;
        let bestNeighborIdx = -1;
        let bestElev = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue; // off-map: blocks a step, doesn't break the ring
            const nIdx = ny * width + nx;
            if (tiles[nIdx].terrain !== "mountains") { allMountains = false; continue; }
            if (elevArr[nIdx] < bestElev) { bestElev = elevArr[nIdx]; bestNeighborIdx = nIdx; }
          }
        }
        if (allMountains && bestNeighborIdx >= 0) {
          tiles[bestNeighborIdx].terrain = "hills";
          fixedCount++;
        }
      }
    }
    return fixedCount;
  }

  // Thresholds for markTallMountainEligibility below. RANGE size is the
  // count of tiles in the mountain's own 8-connected component (so a
  // range has to actually be sizeable, not just a couple of adjacent
  // peaks); NEIGHBORS is how many of a tile's 8 neighbors must themselves
  // be Mountains for that tile to count as "buried in the middle" rather
  // than sitting on the range's outer edge.
  const TALL_MOUNTAIN_MIN_RANGE_SIZE = 12;
  const TALL_MOUNTAIN_MIN_NEIGHBORS = 6;

  /** Flood-fills Mountain tiles into 8-connected ranges (same adjacency
   *  convention as breakMountainRings/findLandmasses) and flags each tile
   *  tallMountainEligible when its range is large AND it sits deep enough
   *  inside that range -- see the Step 4b call site for the full rationale.
   *  Purely structural; the actual tall-vs-flat sprite roll for an eligible
   *  tile happens later, at render time (see render.js). */
  function markTallMountainEligibility(tiles, width, height) {
    const n = width * height;
    const componentId = new Int32Array(n).fill(-1);
    const componentSizes = [];
    const stack = [];
    for (let start = 0; start < n; start++) {
      if (tiles[start].terrain !== "mountains" || componentId[start] !== -1) continue;
      const compIdx = componentSizes.length;
      let size = 0;
      stack.push(start);
      componentId[start] = compIdx;
      while (stack.length) {
        const idx = stack.pop();
        size++;
        const x = idx % width, y = Math.floor(idx / width);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const nIdx = ny * width + nx;
            if (tiles[nIdx].terrain === "mountains" && componentId[nIdx] === -1) {
              componentId[nIdx] = compIdx;
              stack.push(nIdx);
            }
          }
        }
      }
      componentSizes.push(size);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const tile = tiles[idx];
        if (tile.terrain !== "mountains") continue;
        if (componentSizes[componentId[idx]] < TALL_MOUNTAIN_MIN_RANGE_SIZE) continue;
        let mountainNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            if (tiles[ny * width + nx].terrain === "mountains") mountainNeighbors++;
          }
        }
        tile.tallMountainEligible = mountainNeighbors >= TALL_MOUNTAIN_MIN_NEIGHBORS;
      }
    }
  }

  function placeResources(tiles, width, height, rng, landmasses) {
    const PLACEMENT_CHANCE = 0.045;
    for (const tile of tiles) {
      if (!isLand(tile) && tile.terrain !== "coast") continue;
      const validResources = window.GameData.RESOURCE_LIST.filter((rid) =>
        RESOURCES[rid].validTerrain.includes(tile.terrain)
      );
      if (validResources.length === 0) continue;
      if (rng() < PLACEMENT_CHANCE) {
        tile.resource = validResources[Math.floor(rng() * validResources.length)];
      }
    }
    // Fairness pass: ensure every landmass with >= 8 tiles has at least one resource
    for (const group of landmasses) {
      if (group.length < 8) continue;
      const hasResource = group.some((idx) => tiles[idx].resource);
      if (!hasResource) {
        const candidates = group.filter((idx) => {
          const t = tiles[idx];
          return window.GameData.RESOURCE_LIST.some((rid) => RESOURCES[rid].validTerrain.includes(t.terrain));
        });
        if (candidates.length > 0) {
          const idx = candidates[Math.floor(rng() * candidates.length)];
          const t = tiles[idx];
          const validResources = window.GameData.RESOURCE_LIST.filter((rid) =>
            RESOURCES[rid].validTerrain.includes(t.terrain)
          );
          t.resource = validResources[Math.floor(rng() * validResources.length)];
        }
      }
    }
  }

  function generateRivers(tiles, width, height, rng, landmasses) {
    // Simplified downhill-flow river generation: pick high-elevation tiles
    // (Hills/Mountains) as sources, flow toward the nearest lower-or-equal
    // neighbor until reaching water or running out of downhill options.
    const RIVER_DENSITY = 150; // ~1 river per 150 land tiles, per design doc
    for (const group of landmasses) {
      const numRivers = Math.max(0, Math.floor(group.length / RIVER_DENSITY));
      const sources = group.filter((idx) => {
        const t = tiles[idx];
        return t.terrain === "hills" || t.terrain === "mountains";
      });
      for (let i = 0; i < numRivers && sources.length > 0; i++) {
        let cur = sources[Math.floor(rng() * sources.length)];
        const visited = new Set();
        let steps = 0;
        while (steps < 40) {
          steps++;
          visited.add(cur);
          const cx = cur % width, cy = Math.floor(cur / width);
          const t = tiles[cur];
          if (TERRAIN[t.terrain].isWater) break; // reached the sea

          // Find a lower-or-equal unvisited neighbor (downhill flow)
          const dirs = [
            [0, -1, "n", "s"], [0, 1, "s", "n"],
            [1, 0, "e", "w"], [-1, 0, "w", "e"],
          ];
          let best = null;
          for (const [dx, dy, edgeHere, edgeThere] of dirs) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const nIdx = ny * width + nx;
            if (visited.has(nIdx)) continue;
            if (!best || elevationRank(tiles[nIdx]) <= elevationRank(tiles[best.idx])) {
              best = { idx: nIdx, edgeHere, edgeThere };
            }
          }
          if (!best) break; // local basin, river just ends here (endorheic)
          t.hasRiver[best.edgeHere] = true;
          // Stamp the edge on the tile the river is flowing INTO -- unless
          // that tile is already water (coast/ocean). Water tiles are
          // already rendered as water; painting a river-mouth overlay onto
          // one would be redundant clutter on top of already-blue tiles.
          // The land tile just above still gets its own edge marked (from
          // the line above), so the river visually still runs right up to
          // the coastline, it just doesn't paint anything on the water side.
          if (!TERRAIN[tiles[best.idx].terrain].isWater) {
            tiles[best.idx].hasRiver[best.edgeThere] = true;
          }
          cur = best.idx;
        }
      }
    }
  }

  function elevationRank(tile) {
    const order = { ocean: 0, coast: 1, swamp: 2, plains: 3, forest: 3, desert: 3, tundra: 3, hills: 4, mountains: 5 };
    return order[tile.terrain] ?? 3;
  }

  function placeRuins(tiles, width, height, rng, landmasses) {
    const RUIN_DENSITY = 150;
    for (const group of landmasses) {
      const targetCount = Math.max(1, Math.floor(group.length / RUIN_DENSITY));
      // Eligible: any land tile, confirmed never on water (group is land-only already)
      const eligible = [...group];
      let placed = 0;
      let attempts = 0;
      const placedTiles = [];
      while (placed < targetCount && attempts < group.length * 2) {
        attempts++;
        const idx = eligible[Math.floor(rng() * eligible.length)];
        const t = tiles[idx];
        if (t.isRuin) continue;
        // Minimum spacing: avoid placing within 2 tiles of another ruin
        const cx = idx % width, cy = Math.floor(idx / width);
        const tooClose = placedTiles.some((pIdx) => {
          const px = pIdx % width, py = Math.floor(pIdx / width);
          return Math.max(Math.abs(px - cx), Math.abs(py - cy)) <= 2;
        });
        if (tooClose) continue;
        t.isRuin = true;
        placedTiles.push(idx);
        placed++;
      }
    }
  }

  /** Caves (2026-08-19, user-directed): 1-2 linked PAIRS per map, land-only
   *  (never on water, same constraint as Ruins), reusing the same
   *  min-spacing-via-rejection-sampling shape as placeRuins above. Unlike
   *  Ruins, a cave's two tiles are stamped as a linked PAIR spanning the
   *  whole map (not per-landmass) -- see js/engine/orders.js's
   *  performEnterCave, which reads tile.caveLinkX/caveLinkY to know where a
   *  unit standing on tile.isCave teleports to. A pair is deliberately
   *  required to land far apart (at least a quarter of the map's diagonal)
   *  so it reads as a real shortcut, not two adjacent tiles that happen to
   *  be linked. */
  function placeCaves(tiles, width, height, rng, landmasses) {
    const PAIR_COUNT = rng() < 0.5 ? 1 : 2;
    const MIN_LINK_DIST = Math.floor(Math.hypot(width, height) / 4);
    const MIN_SPACING_FROM_OTHER_CAVES = 3;
    const eligible = [];
    for (const group of landmasses) {
      for (const idx of group) {
        const t = tiles[idx];
        // Mountains is technically part of a landmass (findLandmasses
        // groups by "not water", not by "actually walkable" -- see its own
        // doc comment), but genuinely IMPASSABLE for ordinary land
        // movement. A cave linking there was still a legal placement, and
        // performEnterCave has no passability check of its own (a cave is
        // meant to bypass terrain rules) -- so a unit that used one
        // arrived somewhere it could never take a single step away from
        // again, since leaving Mountains costs the same IMPASSABLE value
        // that blocks ever entering it (2026-08-19 bugfix; see
        // ai.js's getMoveCost for the runtime safety net that also covers
        // any cave already placed on Mountains in an existing save).
        if (t.terrain === "mountains") continue;
        if (!t.isRuin && !t.resource) eligible.push(idx);
      }
    }
    const placedTiles = [];
    const tooCloseToPlaced = (cx, cy) => placedTiles.some((pIdx) => {
      const px = pIdx % width, py = Math.floor(pIdx / width);
      return Math.max(Math.abs(px - cx), Math.abs(py - cy)) <= MIN_SPACING_FROM_OTHER_CAVES;
    });
    let pairsPlaced = 0;
    let pairAttempts = 0;
    while (pairsPlaced < PAIR_COUNT && pairAttempts < 60) {
      pairAttempts++;
      const idxA = eligible[Math.floor(rng() * eligible.length)];
      const ax = idxA % width, ay = Math.floor(idxA / width);
      if (tiles[idxA].isCave || tooCloseToPlaced(ax, ay)) continue;
      let idxB = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        const candidate = eligible[Math.floor(rng() * eligible.length)];
        const bx = candidate % width, by = Math.floor(candidate / width);
        if (tiles[candidate].isCave || candidate === idxA || tooCloseToPlaced(bx, by)) continue;
        if (Math.max(Math.abs(bx - ax), Math.abs(by - ay)) < MIN_LINK_DIST) continue;
        idxB = candidate;
        break;
      }
      if (idxB === null) continue; // no far-enough partner found this attempt -- retry pair from scratch
      const bx = idxB % width, by = Math.floor(idxB / width);
      tiles[idxA].isCave = true;
      tiles[idxA].caveLinkX = bx;
      tiles[idxA].caveLinkY = by;
      tiles[idxB].isCave = true;
      tiles[idxB].caveLinkX = ax;
      tiles[idxB].caveLinkY = ay;
      placedTiles.push(idxA, idxB);
      pairsPlaced++;
    }
  }

  window.GameEngine.worldgen = {
    generateMap,
    isLand,
    findLandmasses,
    classifyClimate, // exported for testing
    breakMountainRings, // exported for testing
  };
})();
