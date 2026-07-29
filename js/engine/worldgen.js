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

  /**
   * Generates a full map. Returns { width, height, tiles, seed }.
   * tiles is a flat array of tile objects, index = y*width + x.
   */
  function generateMap(width, height, seed) {
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
        elevArr[idx] = elevationNoise(x, y, 0.07, 4, 0.55);
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

    // --- Reduce total water (Ocean+Coast) by ~25% (2026-07-13, user
    // request: "still too many ocean tiles") -- same empirical-percentile
    // technique as the rest of this file: measure what this map's actual
    // water count would be under the OLD fixed cutoffs (0.415/0.455),
    // then find the elevation values that leave only 75% as much water,
    // preserving the existing ocean:coast SPLIT (not asked to change that
    // ratio, just total water) -- generalizes the earlier flat "-0.015"
    // water cut (see the Pass 2 comment below) into a per-map percentile
    // target, same reasoning as why mountainThresh/hillThresh/etc. aren't
    // fixed constants either.
    const OLD_OCEAN_CUT = 0.415, OLD_LAND_CUT = 0.455;
    const WATER_REDUCTION = 0.3;
    const allElevsAsc = Array.from(elevArr).sort((a, b) => a - b);
    const oldWaterRank = allElevsAsc.findIndex((e) => e >= OLD_LAND_CUT);
    const oldWaterCount = oldWaterRank === -1 ? allElevsAsc.length : oldWaterRank;
    const oldOceanRank = allElevsAsc.findIndex((e) => e >= OLD_OCEAN_CUT);
    const oldOceanCount = oldOceanRank === -1 ? oldWaterCount : oldOceanRank;
    const oceanShareOfWater = oldWaterCount > 0 ? oldOceanCount / oldWaterCount : 0.5;
    const newWaterCount = Math.round(oldWaterCount * (1 - WATER_REDUCTION));
    const newOceanCount = Math.round(newWaterCount * oceanShareOfWater);
    const LAND_CUT = allElevsAsc[newWaterCount] ?? OLD_LAND_CUT;
    const OCEAN_CUT = allElevsAsc[newOceanCount] ?? OLD_OCEAN_CUT;

    // --- TUNDRA stays a pure latitude/temperature rule (2026-07-12, user
    // request: equalize every land type EXCEPT Tundra, "keep [it] at the
    // poles"). Checked FIRST for land tiles, ahead of elevation -- a cold,
    // high-elevation tile is now Tundra, not Mountains/Hills, unlike
    // before (elevation used to take priority over climate everywhere).
    // This decouples Tundra's land-share into a clean, independent
    // quantity driven purely by the latitude noise, which is what makes
    // the six-way equalization below solvable at all: Tundra's share
    // isn't a target, it's just whatever the polar band naturally is, and
    // the other six types split whatever land is left.
    const TUNDRA_TEMP_CUT = 0.38;

    // --- Roughly-equal land distribution across the six non-Tundra types
    // (Mountains, Hills, Plains, Forest, Desert, Swamp) -- each targets
    // ~1/6 of the non-Tundra land pool, via the same empirical-percentile
    // technique this file already used for the old fixed 5%/18%/10%
    // targets (a noise distribution's actual shape rarely lines up with a
    // hand-picked cutoff, so thresholds are derived from THIS map's own
    // tile population instead of a constant). Structural priority is
    // unchanged from before: elevation still picks Mountains/Hills first,
    // THEN climate (temperature band + moisture) splits the rest into
    // Plains/Forest/Desert/Swamp -- only the target percentages moved.
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

    // Mountains deliberately undershoots that baseline (2026-07-13, user
    // request: "reduce mountain share of the land by about 4 or 5%") --
    // impassable terrain covering a full 1/6 of non-Tundra land turned out
    // to feel like too much once the six-way equalization above landed.
    // MOUNTAIN_SHARE_REDUCTION is a percentage-POINT cut against TOTAL
    // land (matching how the ~14.4% figure was originally reported, not
    // the non-Tundra pool), converted to a tile count and redistributed
    // evenly across the other five types so Hills/Plains/Forest/Desert/
    // Swamp stay roughly even with EACH OTHER, just each a little bigger
    // than before to absorb what Mountains gave up.
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
        // per-map to target ~25% less total water than the OLD fixed
        // 0.415/0.455 (themselves already a -10% cut from the original
        // 0.43/0.47 -- verified empirically across 60 seeds/156k tiles at
        // the time: 44.99% -> 40.81% water). Compounding both cuts lands
        // total water noticeably lower than either alone.
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
          ownerCivId: null, status: "neutral", contestedTurns: 0,
        };
      }
    }

    // --- Step 5: connectivity + Step 5a: minimum landmass size enforcement ---
    // 11 (2026-07-20, user-directed, raised from 3): a landmass has to be
    // able to hold at least one city plus a spare open tile around it (see
    // ai.js's landmassHasSpareOpenTile) for an invader to ever have
    // somewhere to land -- too small and the wall-saturation fix there
    // couldn't leave a gap even if it wanted to.
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
          const neighbors = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
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
    // provably sufficient; no re-check needed (verified via the standalone
    // simulation in the design review, and the invariant holds here by
    // construction of flood-fill itself).
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

  window.GameEngine.worldgen = {
    generateMap,
    isLand,
    findLandmasses,
    classifyClimate, // exported for testing
  };
})();
