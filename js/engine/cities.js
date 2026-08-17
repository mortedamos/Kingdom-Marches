/**
 * CITIES ENGINE
 * -------------
 * City growth (Harvest surplus -> population), yield generation (worked
 * tiles + intrinsic Coin/Lore from population), upkeep (Harvest cost
 * scaling with population), founding restrictions, and naming.
 *
 * Resources: harvest (food/growth), coin (production + gold, merged),
 * lore (research). 
 */

window.GameEngine = window.GameEngine || {};

(function () {
  const TERRAIN = window.GameData.TERRAIN;
  // Tuning lives in js/data/config.js -- see its CITY section. The local
  // names below are kept so the (extensive) explanatory comments around each
  // one stay attached to the code that actually uses them.
  const CFG = window.GameConfig.city;

  // Quadratic, not linear: threshold = population^2 * GROWTH_THRESHOLD_PER_POP
  // (see tickCity). This deliberately mirrors the geometry of the merged
  // radius/yield system -- a city's worked-tile AREA already grows quadratically
  // with radius/population ((2r+1)^2 tiles), so a linear threshold meant each
  // successive population level was effectively CHEAPER relative to the
  // resources available to reach it, causing growth to visibly accelerate
  // late-game. Matching the threshold's growth rate to the area's growth rate
  // keeps the pace roughly constant across levels instead of snowballing.
  const GROWTH_THRESHOLD_PER_POP = CFG.growthThresholdPerPop;
  // Cap on a city's NATURAL (population-driven) growth and radius. This is
  // not a hard ceiling on city.influenceRadius itself -- tech/building radius
  // bonuses (extraRadiusBonus/structureRadiusBonus) still add on top, uncapped
  // (see tickCity's radius formula). 6 replaces the old population cap of 10;
  // it's also the point at which the merged influence/working radius (below)
  // tops out under its own steam.
  const MAX_CITY_POPULATION = CFG.maxPopulation;
  const UPKEEP_RATE = CFG.upkeepRatePerPop;       // Harvest cost per population point per turn
  const INTRINSIC_COIN_RATE = CFG.intrinsicCoinRate; // population-based coin production
  const INTRINSIC_LORE_RATE = CFG.intrinsicLoreRate;
  const FLAT_CITY_HARVEST = CFG.flatHarvest; // flat per-city per-turn base yield
  const FLAT_CITY_COIN    = CFG.flatCoin;
  const FLAT_CITY_LORE    = CFG.flatLore;
  const LORE_TRICKLE_RATE = CFG.loreTrickleRate;  // influence bonus per point of Lore/turn
  // Share of its own yield a city adds when its turn's production goes into
  // resources instead of a unit/building -- see applyResourceProduction.
  const RESOURCE_PRODUCTION_BONUS = CFG.resourceProductionBonus;
  const BASE_INFLUENCE_RADIUS = CFG.baseInfluenceRadius; // pop 1 city starts with radius 1
  // "Spread Culture" (see applyCultureSpread below).
  const CULTURE_SPREAD_INFLUENCE_MULT = CFG.cultureSpreadInfluenceMult;
  const CULTURE_SPREAD_COST_BASE = CFG.cultureSpreadCostBase;
  const CULTURE_SPREAD_COST_PER_POP = CFG.cultureSpreadCostPerPop;

  // city.influenceRadius is now the SINGLE radius governing both territory
  // influence (influence.js's computeInfluenceMap) and worked-tile yield
  // (computeWorkedTileYield below) -- previously these were two independent
  // systems (a population-scaled influenceRadius for territory, and a fixed
  // WORKING_RADIUS=2 for yield) to avoid a feedback loop: bigger radius ->
  // quadratically more worked tiles -> more Harvest -> faster growth ->
  // even bigger radius -> ... -> population 101 and radius 35 after only
  // 100 turns in earlier testing. The feedback loop is now broken a
  // different way: tiles within the radius don't contribute to EITHER
  // system the instant the radius reaches them -- each tile must individually
  // "fill in" first (see filledOffsets/advanceCityFill below), at a rate
  // gated by the race's industriousness. That fill-in delay is what keeps
  // growth in check even with radius and yield now sharing one number.
  //
  // Fill-in mechanic: each city tracks which (dx,dy) offsets (relative to
  // its own tile) have "filled in" in filledOffsets. A tile only counts
  // toward influence/yield once its offset is in that set -- nothing is
  // pre-filled at founding, not even the city's own tile. Each turn,
  // advanceCityFill() adds an industriousness-scaled amount to fillProgress;
  // once it crosses FILL_THRESHOLD, one random not-yet-filled offset within
  // the CURRENT radius (old rings and newly-exposed rings pooled together,
  // no per-ring sequencing) is added to filledOffsets. Filled offsets are
  // never removed, so growth never erases progress even if the radius grows
  // again before an earlier ring finishes.
  const FILL_THRESHOLD = CFG.fillThreshold;
  // Pacing experiment (2026-07-12): first doubled from 0.4/0.65 to 0.8/1.3,
  // then dialed back 25% from THAT (not back to the original) once a
  // territory-heavy batch under the doubled rate + a 25% victory threshold
  // won 20/20 games by territory and zero by elimination -- military
  // victory needs influence to grow slower than that so a war of conquest
  // can still outrace it. Net vs. the ORIGINAL pre-experiment values: 1.5x,
  // not 2x. See project_pacing_experiment memory.
  const FILL_RATE_BASE = CFG.fillRateBase;
  const FILL_RATE_PER_INDUSTRIOUSNESS = CFG.fillRatePerIndustriousness;
  // ~3.4 turns/tile at industriousness 0.3 (current low end, Orc) down to
  // ~1.9 turns/tile at industriousness 1.0 (current high end, Halfellow) --
  // partway back up from the doubled rate's 2.5/1.4, but still faster than
  // the original 5.0/2.9. Placeholder values pending playtesting, same as
  // GROWTH_THRESHOLD_PER_POP above.

  // Universal garrison rule (2026-07-12) -- see advanceCityFill below for
  // the full reasoning. 0.5 means a max-industriousness civ (Halfellow,
  // 1.0) gets +50% fill-in speed from garrisoning a city; a low-
  // industriousness one (Orc, 0.3) only gets +15%.
  const GARRISON_FILL_MULT_RATE = CFG.garrisonFillMultRate;

  // Influence-per-population multiplier: deliberately NOT a per-race flat
  // field (races.js used to carry a bespoke `influenceMult`, e.g. Halfellow's
  // 1.30) -- it's now derived from industriousness alone, the same trait
  // that already governs a city's fill-in speed above, so a race's economic
  // investment is the ONLY thing that grows its influence footprint beyond
  // the tech tree's own civic_influence_bonus/radius_bonus/building effects.
  // Centered on 1.0 at industriousness 0.5 (Undead's value): 0.7 at 0 up to
  // 1.3 at 1.0 (Halfellow) -- same ceiling Halfellow's old flat field had,
  // so this reproduces that number as an emergent consequence of already
  // having the highest industriousness, not a second hidden bonus on top of it.
  const INFLUENCE_MULT_PER_INDUSTRIOUSNESS = CFG.influenceMultPerIndustriousness;
  function industriousnessInfluenceMult(race) {
    return 1.0 + ((race.industriousness ?? 0.5) - 0.5) * INFLUENCE_MULT_PER_INDUSTRIOUSNESS;
  }

  const SETTLER_MIN_POP = 1;
  const MIN_CITY_SPACING = CFG.minCitySpacing; // Chebyshev distance, from ANY city
  const EMERGENCY_CITY_SPACING = CFG.emergencyCitySpacing; // relaxed floor when a civ is stranded with no other option

  /** Creates a new city object at founding (population 1) */
  function createCity({ x, y, civId, raceId, name, map, radiusBonus = 0 }) {
    const race = window.GameData.getRace(raceId);
    // Detect port cities: founded on water tile or adjacent to water
    let isPort = false;
    if (map) {
      const tile = map.tiles[y * map.width + x];
      if (TERRAIN[tile.terrain].isWater) {
        isPort = true;
      } else {
        for (let dy = -1; dy <= 1 && !isPort; dy++) {
          for (let dx = -1; dx <= 1 && !isPort; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
            if (TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) isPort = true;
          }
        }
      }
    }
    return {
      x, y, civId, name, isPort,
      population: 1.0,
      // City HP: CITY_HP_PER_LEVEL at level 1 --
      // see combat.js's cityMaxHp for the general (population-derived)
      // formula this stays in sync with as population changes later.
      hp: window.GameConfig.combat.cityHpPerLevel,
      harvestSurplus: 0.0,
      coinBanked: 0.0,
      influenceRadius: BASE_INFLUENCE_RADIUS,
      extraRadiusBonus: radiusBonus, // seeded from civ.radiusBonus so techs apply to cities founded after research
      structureRadiusBonus: 0,
      buildingInfluenceMult: 1.0,
      filledOffsets: new Set(), // "dx,dy" keys, relative to city.x/y -- see fill-in mechanic note above
      fillProgress: 0,
      structures: [], // { id, x, y, hp, maxHp } -- buildings on the 8 ring-1 tiles, walls on ring-1 or ring-2 (see findStructureSlot)
      buildQueue: null,
      get baseCityInfluence() {
        return 1.0 * this.population * industriousnessInfluenceMult(race);
      },
    };
  }

  // ---------------------------------------------------------------------------
  // STRUCTURES — a race's 4 buildings sit on any of the 8 tiles adjacent to
  // their city (ring 1, not just the 4 cardinal directions); walls may sit on
  // ring 1 too, but prefer the 16 tiles at Chebyshev distance 2 (ring 2) so
  // they encircle the ring-1 building area instead of competing with it for
  // space (see findStructureSlot). Structures have HP and can be attacked/
  // destroyed. These helpers manage placement and lookup.
  // ---------------------------------------------------------------------------

  const ADJACENT_OFFSETS = [
    [0, -1], [0, 1], [-1, 0], [1, 0],   // N, S, W, E
    [-1, -1], [1, -1], [-1, 1], [1, 1], // NW, NE, SW, SE
  ];

  /** The 16 tiles at exact Chebyshev distance 2 from a city -- the outer
   *  edge of the 5x5 square centered on it. Walls prefer these tiles (see
   *  findStructureSlot) so they ring the reserved ring-1 building area
   *  instead of competing with it for space. */
  const RING2_OFFSETS = (() => {
    const offsets = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) offsets.push([dx, dy]);
      }
    }
    return offsets;
  })();

  /** True if this city currently has an (alive) structure of the given id. */
  function cityHasStructure(city, buildingId) {
    return city.structures.some((s) => s.id === buildingId);
  }

  /** True if ANY of this civ's cities currently has an (alive) structure of
   *  the given id -- for civ-wide, build-only-one-anywhere bonuses (e.g.
   *  Halfellow's Armory) as opposed to yieldPct's per-city-only scope. Unlike
   *  a tech-completion check, this can become false again if every copy of
   *  the building is destroyed. */
  function civHasBuiltBuilding(civ, buildingId) {
    return civ.cities.some((c) => cityHasStructure(c, buildingId));
  }

  function anyTerrainAdjacent(map, x, y, terrainIds) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (terrainIds.includes(map.tiles[ny * map.width + nx].terrain)) return true;
      }
    }
    return false;
  }

  /** True if any of the 8 tiles surrounding (x,y) already holds a structure
   *  (building or wall segment) -- used to gate wall placement below. */
  function hasAdjacentStructure(map, x, y) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (map.tiles[ny * map.width + nx].structure) return true;
      }
    }
    return false;
  }

  /** True if any unit belonging to a civ OTHER than `civId` currently stands
   *  on (x,y) -- used to keep a wall from being raised directly on top of an
   *  enemy that's standing there (own units don't block their own wall). */
  function hasEnemyUnitAt(civs, civId, x, y) {
    if (!civs) return false;
    for (const other of Object.values(civs)) {
      if (other.id === civId) continue;
      if (other.units.some((u) => u.x === x && u.y === y)) return true;
    }
    return false;
  }

  /** True if (nx,ny) passes every generic placement check for `building` --
   *  on-map, not water/mountain, not already occupied, not a city tile, and
   *  any requiresHillsAdjacent/requiresForestAdjacent/enemy-occupancy checks
   *  a wall needs. Deliberately does NOT check the wall "must touch an
   *  existing structure" rule -- that's applied separately, only for the
   *  ring-1 fallback search in findStructureSlot, since ring-2 walls are
   *  meant to freely ring the reserved building area even before anything
   *  is built there yet. */
  function isPlaceableTile(map, civ, civs, building, nx, ny) {
    if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) return false; // off-map
    const tile = map.tiles[ny * map.width + nx];
    const terrain = TERRAIN[tile.terrain];
    if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) return false; // no water / mountains
    if (tile.structure) return false; // already occupied by another building
    if (civ.cities.some((c) => c.x === nx && c.y === ny)) return false; // never on a city tile
    if (building.requiresHillsAdjacent && !anyTerrainAdjacent(map, nx, ny, ["hills", "mountains"])) return false;
    if (building.requiresForestAdjacent && !anyTerrainAdjacent(map, nx, ny, ["forest"])) return false;
    if (building.isWall && hasEnemyUnitAt(civs, civ.id, nx, ny)) return false;
    return true;
  }

  /** Finds a free, valid tile for a given building; returns {x,y} or null.
   *  A race's 4 buildings only ever search the 8 ring-1 tiles immediately
   *  surrounding the city (ADJACENT_OFFSETS). Walls instead prefer the 16
   *  ring-2 tiles (RING2_OFFSETS, Chebyshev distance 2) -- freely, with no
   *  "touch an existing structure" requirement, so they can ring the
   *  reserved ring-1 building area even before anything is actually built
   *  there -- and only fall back to a ring-1 tile (which DOES still need to
   *  touch an existing structure, same as before this change) once every
   *  ring-2 tile is unavailable (occupied, blocked by terrain/an enemy, or
   *  off-map). Walls also skip the "already occupied" uniqueness a caller
   *  would normally check via cityHasStructure -- a city can hold several
   *  wall_section entries (one per open ring tile), unlike every other
   *  building here, which is capped at one copy per city. `civs` is only
   *  needed for the wall enemy-occupancy check; safe to omit otherwise.
   *
   *  Slot reservation: since the 8 ring-1 tiles are the ONLY tiles a race's
   *  buildings can ever use, and walls are unlocked from turn one with no
   *  tech gate while a race's 4 buildings often aren't unlocked until well
   *  into the tech tree, a civ that falls back to ring-1 walls early could
   *  otherwise fill every remaining ring-1 tile before a building's tech
   *  even finishes researching -- permanently locking that building out. So
   *  a new ring-1 wall is refused once building it would leave fewer open
   *  ring-1 tiles than this race has buildings left to build here,
   *  regardless of whether those buildings are unlocked yet. This only ever
   *  applies to the ring-1 fallback path -- ring-2 walls never compete with
   *  buildings, since buildings never place there. */
  function findStructureSlot(city, civ, map, buildingId, civs) {
    const building = window.GameData.getBuilding(buildingId);

    if (building.isWall) {
      for (const [dx, dy] of RING2_OFFSETS) {
        const nx = city.x + dx, ny = city.y + dy;
        if (isPlaceableTile(map, civ, civs, building, nx, ny)) return { x: nx, y: ny };
      }

      const raceBuildingIds = window.GameData.buildingsForRace(civ.raceId);
      const stillNeeded = raceBuildingIds.filter((id) => !cityHasStructure(city, id)).length;
      const ring1Structures = city.structures.filter(
        (s) => window.GameEngine.influence.chebyshev(s.x, s.y, city.x, city.y) <= 1
      ).length;
      const openRing1Slots = ADJACENT_OFFSETS.length - ring1Structures;
      if (openRing1Slots <= stillNeeded) return null; // every remaining ring-1 tile is reserved for a future building

      for (const [dx, dy] of ADJACENT_OFFSETS) {
        const nx = city.x + dx, ny = city.y + dy;
        if (!isPlaceableTile(map, civ, civs, building, nx, ny)) continue;
        if (!hasAdjacentStructure(map, nx, ny)) continue; // ring-1 walls must still chain off an existing structure
        return { x: nx, y: ny };
      }
      return null;
    }

    for (const [dx, dy] of ADJACENT_OFFSETS) {
      const nx = city.x + dx, ny = city.y + dy;
      if (isPlaceableTile(map, civ, civs, building, nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }

  /**
   * EVERY tile this building could legally be placed on, not just the first
   * one findStructureSlot happens to pick.
   *
   * Added for the player UI: a human player picks
   * the tile at queue time -- walls in particular are positional, and
   * auto-placing them wherever the loop landed is exactly the decision a
   * player wants to make themselves. Deliberately mirrors findStructureSlot's
   * rules rather than reimplementing them: ring-2 first for walls, the
   * ring-1 reservation rule that stops walls locking out future buildings,
   * the ring-1 chaining requirement, and ring-1 only for ordinary buildings.
   */
  function validStructureSlots(city, civ, map, buildingId, civs) {
    const building = window.GameData.getBuilding(buildingId);
    const slots = [];

    if (building.isWall) {
      for (const [dx, dy] of RING2_OFFSETS) {
        const nx = city.x + dx, ny = city.y + dy;
        if (isPlaceableTile(map, civ, civs, building, nx, ny)) slots.push({ x: nx, y: ny, ring: 2 });
      }
      // Ring-1 walls are only offered when they wouldn't eat a slot this
      // race still needs for an actual building (see findStructureSlot's own
      // explanation), and must chain off an existing structure.
      const raceBuildingIds = window.GameData.buildingsForRace(civ.raceId);
      const stillNeeded = raceBuildingIds.filter((id) => !cityHasStructure(city, id)).length;
      const ring1Structures = city.structures.filter(
        (s) => window.GameEngine.influence.chebyshev(s.x, s.y, city.x, city.y) <= 1
      ).length;
      const openRing1Slots = ADJACENT_OFFSETS.length - ring1Structures;
      if (openRing1Slots > stillNeeded) {
        for (const [dx, dy] of ADJACENT_OFFSETS) {
          const nx = city.x + dx, ny = city.y + dy;
          if (!isPlaceableTile(map, civ, civs, building, nx, ny)) continue;
          if (!hasAdjacentStructure(map, nx, ny)) continue;
          slots.push({ x: nx, y: ny, ring: 1 });
        }
      }
      return slots;
    }

    for (const [dx, dy] of ADJACENT_OFFSETS) {
      const nx = city.x + dx, ny = city.y + dy;
      if (isPlaceableTile(map, civ, civs, building, nx, ny)) slots.push({ x: nx, y: ny, ring: 1 });
    }
    return slots;
  }

  /**
   * Places a structure and returns the record, or null if there's nowhere legal.
   *
   * `preferred` ({x,y}, optional) is the tile a human player chose back when
   * they queued the build. Several turns can pass before the build finishes,
   * so that tile may no longer be legal by then (something else got built
   * there, an enemy moved in). Rather than stall the build or silently drop
   * it, an invalid preference falls back to findStructureSlot's automatic
   * pick -- the same behavior the AI has always had.
   */
  function placeStructure(city, civ, map, buildingId, civs, preferred) {
    let slot = null;
    if (preferred) {
      const legal = validStructureSlots(city, civ, map, buildingId, civs);
      slot = legal.find((s) => s.x === preferred.x && s.y === preferred.y) || null;
    }
    if (!slot) slot = findStructureSlot(city, civ, map, buildingId, civs);
    if (!slot) return null;
    const building = window.GameData.getBuilding(buildingId);
    const record = { id: buildingId, x: slot.x, y: slot.y, hp: building.maxHp, maxHp: building.maxHp };
    city.structures.push(record);
    map.tiles[slot.y * map.width + slot.x].structure = {
      id: buildingId, civId: civ.id, cityX: city.x, cityY: city.y,
    };
    return record;
  }

  /** Resolves the structure sitting on tile (x,y), if any. Returns {civ,city,record,building} or null. */
  function findStructureAt(gameState, x, y) {
    const { map, civs } = gameState;
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) return null;
    const ptr = map.tiles[y * map.width + x].structure;
    if (!ptr) return null;
    const civ = civs[ptr.civId];
    if (!civ) return null;
    const city = civ.cities.find((c) => c.x === ptr.cityX && c.y === ptr.cityY);
    if (!city) return null;
    const record = city.structures.find((s) => s.x === x && s.y === y);
    if (!record) return null;
    return { civ, city, record, building: window.GameData.getBuilding(record.id) };
  }

  /** Removes a structure from its city and clears its tile pointer. */
  function destroyStructure(gameState, x, y) {
    const found = findStructureAt(gameState, x, y);
    if (!found) return false;
    found.city.structures = found.city.structures.filter((s) => s !== found.record);
    delete gameState.map.tiles[y * gameState.map.width + x].structure;
    return true;
  }

  /**
   * BFS through road tiles from (x,y); returns true if a city belonging to
   * civId is reachable via an unbroken chain of road tiles.
   */
  function isRoadConnected(x, y, civId, civs, map) {
    const civ = civs[civId];
    if (!civ || civ.cities.length === 0) return true; // first city — no connection needed
    const visited = new Set();
    const queue = [{ x, y }];
    while (queue.length > 0) {
      const { x: cx, y: cy } = queue.shift();
      const idx = cy * map.width + cx;
      if (visited.has(idx)) continue;
      visited.add(idx);
      // City tiles are implicit road endpoints — they don't need a road stamp
      // on them to complete a connection. Check BEFORE the road requirement so
      // the pioneer doesn't have to separately build road at the city itself.
      if (civ.cities.some((c) => c.x === cx && c.y === cy)) return true;
      if (!map.tiles[idx].hasRoad) continue; // only road tiles can extend the search
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }
    return false;
  }

  /** Whether a tile is a legal founding site -- city founding addendum §2 */
  function canFoundCityAt(map, civs, x, y, founderRaceId, { skipRoadCheck = false, emergencyFound = false } = {}) {
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) return { ok: false, reason: "out of bounds" };
    const tile = map.tiles[y * map.width + x];
    const terrain = TERRAIN[tile.terrain];

    if (terrain.isWater) return { ok: false, reason: "cannot found on water" };
    if (tile.terrain === "mountains") return { ok: false, reason: "cannot found on Mountains" };
    const founderCiv = Object.values(civs).find((c) => c.raceId === founderRaceId);
    const founderCivId = founderCiv?.id;
    if (tile.status === "owned" && tile.ownerCivId && tile.ownerCivId !== "__founding__" && tile.ownerCivId !== founderCivId) {
      return { ok: false, reason: "tile already owned by another civ" };
    }

    const minSpacing = emergencyFound ? EMERGENCY_CITY_SPACING : MIN_CITY_SPACING;
    for (const civ of Object.values(civs)) {
      for (const city of civ.cities) {
        const dist = window.GameEngine.influence.chebyshev(x, y, city.x, city.y);
        if (dist < minSpacing) {
          return { ok: false, reason: `too close to ${city.name} (${dist} < ${minSpacing})` };
        }
      }
    }

    // Road connectivity: required when founding a 2nd+ city on the same landmass.
    // Cross-island founding (different landmassId) is exempt — you can't road-connect
    // across open water. Coastal tiles are also exempt: a pioneer arriving by sea can
    // found a harbour city without first laying a road back to it.
    if (!skipRoadCheck && founderCiv && founderCiv.cities.length > 0) {
      const thisTile = map.tiles[y * map.width + x];
      const sameLandmass = founderCiv.cities.some((c) => {
        const ct = map.tiles[c.y * map.width + c.x];
        return ct.landmassId >= 0 && ct.landmassId === thisTile.landmassId;
      });
      if (sameLandmass && !isRoadConnected(x, y, founderCivId, civs, map)) {
        // Coastal tiles may be founded without road connectivity
        let isCoastal = false;
        for (let dy = -1; dy <= 1 && !isCoastal; dy++) {
          for (let dx = -1; dx <= 1 && !isCoastal; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
            if (TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) isCoastal = true;
          }
        }
        if (!isCoastal) {
          return { ok: false, reason: "must connect to an existing city by road first" };
        }
      }
    }

    return { ok: true };
  }

  /** Per-turn city tick: growth, upkeep, intrinsic output. Mutates city. */
  function tickCity(city, civ, map) {
    const race = window.GameData.getRace(civ.raceId);

    const tileYield = computeWorkedTileYield(city, civ, map);
    const struct = computeStructureEffects(city, map);

    // Tech: building_count_bonus (e.g. Halfellow "Pub Crawl", +1 coin per
    // building) -- flat yield per non-wall structure this city has, independent
    // of tiles/terrain entirely. Added into each resource's raw total below,
    // same tier as struct.yield, before any percentage multipliers apply.
    const buildingCount = city.structures.filter((s) => !window.GameData.getBuilding(s.id).isWall).length;
    const buildingCountBonus = civ.buildingCountBonus || {};

    // Tech: harvest_pct_bonus (e.g. Human "Industrious Harvest") scales total harvest yield.
    // Structure yieldPct (e.g. Bazaar +10% harvest) is a SEPARATE, per-city-only multiplier.
    const harvestPctMult = 1 + (civ.harvestPctBonus || 0);
    const totalHarvest = (tileYield.harvest + struct.yield.harvest + FLAT_CITY_HARVEST
        + (buildingCountBonus.harvest || 0) * buildingCount)
      * harvestPctMult * (1 + struct.yieldPct.harvest);

    const upkeep = UPKEEP_RATE * city.population;
    const netHarvest = Math.max(0, totalHarvest * (race.growthMult || 1.0) - upkeep);
    city.harvestSurplus += netHarvest;

    // Growth pause: a city attacked since its
    // last tick earns no growth this tick -- harvestSurplus still
    // accumulates normally (just not converted into a population level),
    // so the growth isn't lost, only deferred to the following tick. See
    // combat.js's attackCity, which sets this flag.
    const attacked = !!city.attackedThisTurn;
    city.attackedThisTurn = false;
    if (city.population < MAX_CITY_POPULATION && !attacked) {
      const threshold = city.population * city.population * GROWTH_THRESHOLD_PER_POP;
      if (city.harvestSurplus >= threshold) {
        city.harvestSurplus -= threshold;
        city.population += 1.0;
        // Growing a level raises maxHp (combat.js's cityMaxHp scales with
        // population) -- refilled to the new full, same convention a unit
        // leveling up doesn't leave it sitting below its new max HP either.
        city.hp = window.GameEngine.combat.cityMaxHp(city);
      }
    }

    // Structure-derived influence modifiers, recomputed each tick from alive structures
    city.structureRadiusBonus = struct.radiusBonus;
    city.buildingInfluenceMult = struct.influenceMult;
    // Elf "Aelderwatch"/Treetop Watch -- see turns.js's refreshVisibility.
    city.structureVisionBonus = struct.visionRadiusBonus;

    // Keep radius in sync every tick (handles founding, tech, and structure bonuses).
    // No upper clamp: population itself can't exceed MAX_CITY_POPULATION (the
    // "natural" cap), but tech/building radius bonuses add fully on top of that.
    city.influenceRadius = Math.max(1, Math.floor(city.population)) + (city.extraRadiusBonus || 0) + struct.radiusBonus;

    // Advance this turn's tile fill-in progress now that the radius reflects
    // any growth from this tick (a newly-exposed ring is immediately fillable).
    advanceCityFill(city, civ, map);

    const intrinsicCoin = INTRINSIC_COIN_RATE * city.population;
    const intrinsicLore = INTRINSIC_LORE_RATE * city.population;
    // Tech: coin_from_harvest_pct converts a slice of this turn's harvest into bonus coin.
    const coinFromHarvest = totalHarvest * (civ.coinFromHarvestPct || 0);

    const totalCoin = (tileYield.coin + struct.yield.coin + intrinsicCoin + FLAT_CITY_COIN + coinFromHarvest
        + (buildingCountBonus.coin || 0) * buildingCount)
      * (1 + struct.yieldPct.coin);
    const totalLore = (tileYield.lore + struct.yield.lore + intrinsicLore + FLAT_CITY_LORE
        + (buildingCountBonus.lore || 0) * buildingCount)
      * (1 + struct.yieldPct.lore);

    city.lastYield = { harvest: totalHarvest, coin: totalCoin, lore: totalLore };
    city.coinBanked += city.lastYield.coin;

    city.loreInfluenceTrickle = city.lastYield.lore * LORE_TRICKLE_RATE;

    // Tech: Halfellow "Hedge Walls" -- every wall segment self-repairs 5% of
    // its max HP per turn (capped at maxHp; dead/destroyed walls are already
    // removed from city.structures elsewhere, so nothing here revives one).
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("hedge_walls")) {
      for (const s of city.structures) {
        const b = window.GameData.getBuilding(s.id);
        // Math.round + minimum 1 HP -- this used
        // to add the raw fractional 5% directly (no rounding at all), which
        // both left structure HP as a non-integer and could add less than 1
        // on a low-maxHp wall.
        if (b.isWall) s.hp = Math.min(s.maxHp, s.hp + Math.max(1, Math.round(s.maxHp * 0.05)));
      }
    }

    return city.lastYield;
  }

  /**
   * RESOURCE PRODUCTION
   * ----------------------------------------------
   * A city's turn goes into ONE thing: a unit, a building, or -- via this --
   * straight into resources. Picking it (sidebar.js's renderBuildSection,
   * main.js's handleResourceProduction) adds RESOURCE_PRODUCTION_BONUS of
   * the city's own yield to what it produces THIS turn.
   *
   * "This turn" is the whole point, and is why the payout is paid straight
   * into the stockpile here rather than left on a flag for the next tick to
   * read (which is what the first version of this did -- a +50% boost that
   * landed on the FOLLOWING turn, since tickCity runs in beginCivTurn, before
   * the player can click anything). turns.js's beginCivTurn does the whole
   * income sweep -- tick every city, sum lastYield into civ.resources, bank
   * that into civ.stockpile, then charge upkeep -- at the START of the turn,
   * so by the time the player clicks there is no later sweep left to hook:
   * civ.stockpile is credited directly, and civ.resources alongside it purely
   * so the sidebar's Income row still adds up to what the cities produced.
   *
   * Once per city per turn (resourceProductionTurn), and only while the city
   * has no build queued -- resources are what this city's production is
   * spent on instead of a unit or building, not a bonus on top of one.
   */
  function isProducingResources(city, gameState) {
    return !!city && city.resourceProductionTurn === (gameState.turnNumber || 0);
  }

  /** What "Resource Production" would pay out for `city` right now: a flat
   *  share of its current per-turn yield. Zero for a city founded this turn
   *  (no lastYield to take a share of yet). Pure -- the sidebar calls this
   *  every render to label the button. */
  function resourceProductionPreview(city) {
    const y = (city && city.lastYield) || { harvest: 0, coin: 0, lore: 0 };
    return {
      harvest: (y.harvest || 0) * RESOURCE_PRODUCTION_BONUS,
      coin: (y.coin || 0) * RESOURCE_PRODUCTION_BONUS,
      lore: (y.lore || 0) * RESOURCE_PRODUCTION_BONUS,
    };
  }

  /** Spends `city`'s production this turn on resources. Returns the gain, or
   *  null if it wasn't allowed (already done this turn, building something,
   *  or nothing to produce yet). */
  function applyResourceProduction(city, civ, gameState) {
    if (!city || !civ || city.buildQueue) return null;
    if (isProducingResources(city, gameState)) return null;

    const gain = resourceProductionPreview(city);
    if (!gain.harvest && !gain.coin && !gain.lore) return null;

    city.resourceProductionTurn = gameState.turnNumber || 0;
    city.resourceProductionGain = gain;

    civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    civ.resources = civ.resources || { harvest: 0, coin: 0, lore: 0 };
    for (const key of ["harvest", "coin", "lore"]) {
      civ.stockpile[key] = (civ.stockpile[key] || 0) + gain[key];
      civ.resources[key] = (civ.resources[key] || 0) + gain[key];
    }

    // Everything tickCity derives from lastYield is brought along, so the
    // city reads as having genuinely produced more this turn rather than the
    // stockpile quietly gaining resources no city accounts for: the
    // sidebar's "Yield this turn", the growth surplus (scaled by growthMult,
    // matching how tickCity converts harvest into surplus), coinBanked for a
    // legacy coin-accumulation build, and the lore->influence trickle.
    const race = window.GameData.getRace(civ.raceId);
    city.lastYield = {
      harvest: (city.lastYield.harvest || 0) + gain.harvest,
      coin: (city.lastYield.coin || 0) + gain.coin,
      lore: (city.lastYield.lore || 0) + gain.lore,
    };
    city.harvestSurplus += gain.harvest * (race.growthMult || 1.0);
    city.coinBanked += gain.coin;
    city.loreInfluenceTrickle = city.lastYield.lore * LORE_TRICKLE_RATE;

    window.GameEngine.floatingText.spawnResourceGain(city, gain);
    return gain;
  }

  /**
   * RESEARCH (city ring action, 2026-08-06, user-directed)
   * -------------------------------------------------------
   * A fourth thing a city's turn can go into, alongside a unit, a building,
   * or Resource Production: throwing the city's own workforce at whatever
   * the civ is currently researching, cutting `researchBoostAmount(city)`
   * turns off the timer outright (see tech.js's reduceResearchTurns, which
   * does the actual civ-level countdown and completes the tech immediately
   * if the cut brings it to zero rather than waiting for next turn's tick).
   *
   * Same "once per city per turn, and only while nothing else has already
   * claimed this city's production" shape as isProducingResources/
   * applyResourceProduction just above -- researchBoostTurn is this
   * mechanism's own turn-stamp, checked independently so a city that
   * boosted research this turn can't ALSO queue a build or gather resources,
   * and vice versa.
   */
  function isBoostingResearch(city, gameState) {
    return !!city && city.researchBoostTurn === (gameState.turnNumber || 0);
  }

  /**
   * True when `city` has nothing queued and isn't spending this turn's
   * production on resources or research either
   * -- the single shared predicate for "should this read as idle to the
   * player", pulled out of main.js's collectUnresolvedTurnWork (which used
   * to compute this inline, duplicated the moment a second consumer needed
   * it) so the End Turn nag, the sidebar's per-city tag, and the map badge
   * all agree on the same answer. `availableBuilds` is the expensive part
   * (iterates every unlocked unit/building) and only runs once the cheap
   * checks above have already ruled the city in.
   */
  function isCityIdle(civ, city, gameState) {
    if (!civ || !city || city.buildQueue) return false;
    if (isProducingResources(city, gameState)) return false;
    if (isBoostingResearch(city, gameState)) return false;
    return window.GameEngine.ai.availableBuilds(civ, city, gameState).some((o) => o.affordable);
  }

  /** Turns a boost would cut right now: population, floored, with a floor of
   *  its own so even a brand-new pop-1 city does something. Pure -- the ring
   *  menu calls this every render to label the pill. */
  function researchBoostAmount(city) {
    return Math.max(1, Math.floor((city && city.population) || 0));
  }

  /** Spends `city`'s production this turn accelerating the civ's current
   *  research. Returns a receipt { amount, completed, techId, techLabel }, or
   *  null if it wasn't allowed (already spoken for this turn, building
   *  something, or nothing is currently being researched). */
  function applyResearchBoost(city, civ, gameState) {
    if (!city || !civ || city.buildQueue) return null;
    if (isProducingResources(city, gameState) || isBoostingResearch(city, gameState)) return null;
    if (!civ.currentResearch) return null;

    const amount = researchBoostAmount(city);
    const result = window.GameEngine.tech.reduceResearchTurns(civ, amount);
    if (!result) return null;

    city.researchBoostTurn = gameState.turnNumber || 0;
    city.researchBoostGain = result;

    window.GameEngine.floatingText.spawnFloatingText(
      city, result.completed ? `Research complete: ${result.techLabel}` : `-${amount} Research turns`, "resource");
    return result;
  }

  /**
   * SPREAD CULTURE (city ring action, 2026-08-13, user-directed)
   * --------------------------------------------------------------
   * A paid, one-turn boost to a city's influence spread -- unlike Resource
   * Production/Research above, this does NOT consume the city's turn (no
   * buildQueue/isProducingResources/isBoostingResearch gate): it's paid for
   * out of the civ's stockpile instead, so a city can spread culture AND
   * still build/gather/research the same turn. Purely a turn-stamped
   * transient field (cultureSpreadTurn), same idiom as
   * resourceProductionTurn/researchBoostTurn -- influence.js's
   * computeInfluenceMap reads it directly and applies
   * CULTURE_SPREAD_INFLUENCE_MULT to this city's influence strength for
   * whichever round's resolution matches the stamped turn number, then it
   * naturally stops applying once turnNumber moves past it.
   *
   * `targetTurn` defaults to the current round (right for the human player,
   * who acts before their own End Turn triggers this round's
   * computeInfluenceMap -- see turns.js's beginRound). The AI acts from
   * inside beginCivTurn, which runs AFTER this round's computeInfluenceMap
   * already fired, so ai.js passes turnNumber + 1 explicitly to land the
   * boost on the round its decision can actually still affect.
   */
  function spreadCultureCost(city) {
    const pop = Math.max(1, Math.floor((city && city.population) || 1));
    const out = {};
    for (const k of Object.keys(CULTURE_SPREAD_COST_BASE)) {
      out[k] = CULTURE_SPREAD_COST_BASE[k] + CULTURE_SPREAD_COST_PER_POP[k] * pop;
    }
    return out;
  }

  function isSpreadingCulture(city, gameState) {
    return !!city && city.cultureSpreadTurn === (gameState.turnNumber || 0);
  }

  /** Spends stockpile boosting `city`'s influence spread this turn. Returns
   *  the cost paid, or null if it wasn't allowed (already done this turn, or
   *  the civ can't afford it). */
  function applyCultureSpread(city, civ, gameState, targetTurn) {
    if (!city || !civ) return null;
    const turn = targetTurn != null ? targetTurn : (gameState.turnNumber || 0);
    if (city.cultureSpreadTurn === turn) return null;

    const cost = spreadCultureCost(city);
    civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    if (!Object.entries(cost).every(([k, v]) => (civ.stockpile[k] || 0) >= v)) return null;
    for (const [k, v] of Object.entries(cost)) {
      civ.stockpile[k] = Math.max(0, (civ.stockpile[k] || 0) - v);
    }

    city.cultureSpreadTurn = turn;
    city.cultureSpreadCost = cost;

    window.GameEngine.floatingText.spawnFloatingText(city, "Culture Spreading", "resource");
    return cost;
  }

  /**
   * Aggregates the effects of a city's alive structures: flat yields, influence
   * multiplier (product), radius bonus (sum), plus the road/forest-scaled yields.
   */
  function computeStructureEffects(city, map) {
    const out = { yield: { harvest: 0, coin: 0, lore: 0 }, influenceMult: 1.0, radiusBonus: 0,
      yieldPct: { harvest: 0, coin: 0, lore: 0 }, visionRadiusBonus: 0 };
    for (const s of city.structures) {
      const b = window.GameData.getBuilding(s.id);
      if (b.yield) {
        out.yield.harvest += b.yield.harvest || 0;
        out.yield.coin += b.yield.coin || 0;
        out.yield.lore += b.yield.lore || 0;
      }
      // Percentage-of-this-city's-yield structures (e.g. Human's Bazaar/Guild Hall/
      // Mage College) -- applied to this city's own total, never civ-wide.
      if (b.yieldPct) {
        out.yieldPct.harvest += b.yieldPct.harvest || 0;
        out.yieldPct.coin += b.yieldPct.coin || 0;
        out.yieldPct.lore += b.yieldPct.lore || 0;
      }
      if (b.influenceMult) out.influenceMult *= b.influenceMult;
      if (b.radiusBonus) out.radiusBonus += b.radiusBonus;
      // Elf "Aelderwatch"/Treetop Watch -- see turns.js's refreshVisibility.
      if (b.visionRadiusBonus) out.visionRadiusBonus += b.visionRadiusBonus;
      if (b.coinPerAdjacentRoad) out.yield.coin += b.coinPerAdjacentRoad * countRoadsInWorkRadius(city, map);
      if (b.lorePerAdjacentForest) out.yield.lore += b.lorePerAdjacentForest * countForestAdjacent(city, map);
    }
    return out;
  }

  /** True if this city's influence/yield has filled in the tile at offset (dx,dy). */
  function isOffsetFilled(city, dx, dy) {
    return city.filledOffsets.has(`${dx},${dy}`);
  }

  /** True if (x,y) is a filled-in tile within any of this civ's cities' borders
   *  (e.g. Halfellow's Hearth and Homeland heal bonus -- see combat.js healUnit). */
  function isTileFilledForCiv(civ, x, y) {
    return civ.cities.some((c) => isOffsetFilled(c, x - c.x, y - c.y));
  }

  /**
   * Advances this city's tile fill-in progress by one turn: adds an
   * industriousness-scaled amount to fillProgress, then converts any
   * threshold(s) crossed into randomly-chosen newly-filled tiles. Candidates
   * are geometric only (any offset within the radius, not deep water, not
   * already filled) -- deliberately NOT gated by current tile ownership,
   * since an unfilled tile contributes no influence and could otherwise never
   * be won via resolveOwnership, which would make it permanently ineligible
   * to ever fill (a deadlock). Whether this civ actually holds a filled tile
   * is decided separately, downstream, by the normal influence-comparison
   * logic in influence.js.
   *
   * Strictly bounded by city.influenceRadius -- no tile outside the radius
   * square ever fills or projects influence. (Two earlier versions got this
   * wrong: influence.js's legacy "soft falloff edge" at radius+1 was first
   * exempted from the fill gate, making a fully-formed outer ring appear
   * around an empty core at founding; then made fillable, which let fill
   * quietly extend one tile past the radius border. The soft edge is now
   * gone entirely -- influence.js gates every tile by fill state, and
   * nothing beyond the radius is ever a candidate.)
   */
  function advanceCityFill(city, civ, map) {
    const radius = city.influenceRadius;
    const candidates = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const key = `${dx},${dy}`;
        if (city.filledOffsets.has(key)) continue;
        const tx = city.x + dx, ty = city.y + dy;
        if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
        candidates.push(key);
      }
    }
    if (candidates.length === 0) return; // fully filled (or nothing fillable) -- nothing to do

    const race = window.GameData.getRace(civ.raceId);
    const industriousness = race.industriousness ?? 0.5;
    // Universal rule (2026-07-12): a garrisoned city -- at least one
    // non-carried military unit standing right on its own tile -- fills in
    // influence tiles faster, scaled by the civ's OWN industriousness, not a
    // flat bonus. A high-industriousness civ (Halfellow, 1.0) gets a real
    // payoff (+50% at GARRISON_FILL_MULT_RATE below) for holding a defender
    // at home instead of raiding; a low-industriousness one (Orc, 0.3) gets
    // much less (+15%), so this doesn't meaningfully change a
    // conquest-focused civ's calculus, only a homebody one's. See
    // project_halfellow_tactics memory for the full reasoning -- this is
    // meant to give a defensive, city-building playstyle a mechanical payoff
    // that competes with raiding, not just a flavor difference.
    const isGarrisoned = civ.units.some((u) =>
      u.x === city.x && u.y === city.y && !u.carriedBy
      && window.GameData.getUnit(u.typeId).category === "military");
    const garrisonMult = isGarrisoned ? 1 + industriousness * GARRISON_FILL_MULT_RATE : 1;
    // fillRateMult: tech-granted multiplier on top of the industriousness-scaled
    // rate (e.g. Halfellow's Community Fellowship, +150% -- "gain influence in
    // tiles 150% faster"). Defaults to 1 (see tech.js's applyTechEffects).
    // Stacks multiplicatively with the garrison bonus above, not additively --
    // a Halfellow city with BOTH Community Fellowship AND a garrison compounds
    // both bonuses, reinforcing "garrison your cities" as a real strategy for
    // exactly the civ whose whole identity is influence-by-economy.
    city.fillProgress = (city.fillProgress || 0)
      + (FILL_RATE_BASE + industriousness * FILL_RATE_PER_INDUSTRIOUSNESS) * garrisonMult * (civ.fillRateMult || 1);

    while (city.fillProgress >= FILL_THRESHOLD && candidates.length > 0) {
      city.fillProgress -= FILL_THRESHOLD;
      const idx = Math.floor(Math.random() * candidates.length);
      city.filledOffsets.add(candidates[idx]);
      candidates.splice(idx, 1);
    }
  }

  function countRoadsInWorkRadius(city, map) {
    let n = 0;
    const radius = city.influenceRadius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (!isOffsetFilled(city, dx, dy)) continue;
        const nx = city.x + dx, ny = city.y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (map.tiles[ny * map.width + nx].hasRoad) n++;
      }
    }
    return n;
  }

  function countForestAdjacent(city, map) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = city.x + dx, ny = city.y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (map.tiles[ny * map.width + nx].terrain === "forest") n++;
      }
    }
    return n;
  }

  /** Sums yield from all tiles this city owns AND has filled in, within its influence radius */
  // Road-tile yield bonuses (race-default or tech-unlocked, e.g. Human's Trade
  // Roads / Halfellow's The Road Goes Ever On) are capped at this many
  // contributing road tiles per city, regardless of how many more roads the
  // city actually has -- prevents a player from farming a resource bonus by
  // paving their entire territory. Applies to every race/tech that grants a
  // per-road-tile bonus, not just whichever one happens to define it.
  const ROAD_BONUS_TILE_CAP = CFG.roadBonusTileCap;

  /**
   * Yield contribution from ONE worked tile at offset (dx,dy) from its city,
   * factored out of computeWorkedTileYield's loop body (2026-08-12) so a
   * single tile's actual yield can be computed in isolation -- see
   * computeTileActualYield below, used by the sidebar's tile-panel "Actual
   * Yield" row -- without duplicating the bonus-stacking rules in two
   * places. `roadBonusTilesUsed` is the caller's own running count against
   * ROAD_BONUS_TILE_CAP; pass 0 for a standalone single-tile lookup that
   * isn't tracking a city-wide cap (see computeTileActualYield's own doc
   * comment on why that's a deliberate, harmless simplification there).
   * Returns null if this tile isn't actually paying `civ` anything right
   * now (not owned by them, or contested with no Barrow to soften it) --
   * otherwise { totals: {harvest,coin,lore}, usedRoadBonus }.
   */
  function tileYieldContribution(tile, dx, dy, civ, hasBarrow, barrowContestedMult, roadBonusTilesUsed) {
    if (tile.ownerCivId !== civ.id) return null;
    // Barrow: contested tiles yield at the override rate instead of 0
    let tileYieldMult = 1.0;
    if (tile.status !== "owned") {
      if (tile.status === "contested" && hasBarrow) {
        tileYieldMult = barrowContestedMult;
      } else {
        return null;
      }
    }

    // Distance falloff: a city's baseline
    // harvest/coin territorial yield (raw terrain, plus race-default
    // tile/feature/road bonuses) tapers off 0.2/ring past ring 2 --
    // ring 3 = 80%, ring 4 = 60%, etc. Deliberately does NOT touch lore
    // (see radiusYieldMult's harvest/coin-only application below), and
    // deliberately does NOT touch tile.resource bonuses (Iron/Gold/Game/
    // Fertile/Fish), Ruin bonuses, or any tech-unlocked bonus (utb/ufb)
    // -- a civ's actual tech/exploration investment should keep paying
    // full value regardless of how far out the tile sits.
    const ring = Math.max(Math.abs(dx), Math.abs(dy));
    const radiusYieldMult = Math.max(0, 1 - 0.2 * Math.max(0, ring - 2));
    const baseMult = tileYieldMult * radiusYieldMult;

    const totals = { harvest: 0, coin: 0, lore: 0 };
    const terrainYield = TERRAIN[tile.terrain].yield;
    const race = window.GameData.getRace(civ.raceId);
    totals.harvest += (terrainYield.harvest || 0) * baseMult;
    totals.coin += (terrainYield.coin || 0) * baseMult;
    totals.lore += (terrainYield.lore || 0) * tileYieldMult;
    if (tile.resource) {
      const resBonus = window.GameData.RESOURCES[tile.resource].bonus;
      for (const k of Object.keys(resBonus)) totals[k] += resBonus[k] * tileYieldMult;
    }
    const hasRiver = tile.hasRiver && (tile.hasRiver.n || tile.hasRiver.s || tile.hasRiver.e || tile.hasRiver.w);
    if (hasRiver) {
      const riverBonus = window.GameData.RIVER_YIELD_BONUS;
      for (const [k, v] of Object.entries(riverBonus)) totals[k] += v * (k === "lore" ? tileYieldMult : baseMult);
    }
    // Ruins: a special-tile bonus, exempt from the falloff. Amount lives
    // in terrain.js's RUIN_YIELD_BONUS alongside RIVER_YIELD_BONUS so the
    // sidebar can display the same number this pays out.
    if (tile.isRuin) {
      for (const [k, v] of Object.entries(window.GameData.RUIN_YIELD_BONUS)) totals[k] += v * tileYieldMult;
    }
    // Race terrain tile bonuses (e.g. dwarf +1 coin from hills) -- still a free
    // race default for races that haven't had their bonuses moved to tech yet.
    const tb = race.tileBonuses || {};
    const terrainBonus = tb[tile.terrain];
    if (terrainBonus) {
      for (const [k, v] of Object.entries(terrainBonus)) totals[k] += v * (k === "lore" ? tileYieldMult : baseMult);
    }
    // Race feature bonuses (river, ruin, road) -- same as above, race-default path
    const fb = race.featureBonuses || {};
    if (hasRiver && fb.river) {
      for (const [k, v] of Object.entries(fb.river)) totals[k] += v * (k === "lore" ? tileYieldMult : baseMult);
    }
    if (tile.isRuin && fb.ruin) {
      for (const [k, v] of Object.entries(fb.ruin)) totals[k] += v * tileYieldMult;
    }

    // Tech-unlocked tile/feature bonuses (e.g. Human's Homestead/Trade Roads) --
    // a civ-level equivalent of the two blocks above, for races whose bonuses
    // have moved off the race-default and onto their tech tree instead.
    // Exempt from the distance falloff (see radiusYieldMult above).
    const utb = (civ.unlockedTileBonuses || {})[tile.terrain];
    if (utb) {
      for (const [k, v] of Object.entries(utb)) totals[k] += v * tileYieldMult;
    }
    const ufb = civ.unlockedFeatureBonuses || {};
    if (hasRiver && ufb.river) {
      for (const [k, v] of Object.entries(ufb.river)) totals[k] += v * tileYieldMult;
    }
    if (tile.isRuin && ufb.ruin) {
      for (const [k, v] of Object.entries(ufb.ruin)) totals[k] += v * tileYieldMult;
    }

    // Road bonuses share one per-city cap (ROAD_BONUS_TILE_CAP above):
    // the race-default half (fb.road) falls off with distance like any
    // other race-default bonus; the tech-unlocked half (ufb.road) doesn't.
    let usedRoadBonus = false;
    if (tile.hasRoad && (fb.road || ufb.road) && roadBonusTilesUsed < ROAD_BONUS_TILE_CAP) {
      usedRoadBonus = true;
      if (fb.road) for (const [k, v] of Object.entries(fb.road)) totals[k] += v * (k === "lore" ? tileYieldMult : baseMult);
      if (ufb.road) for (const [k, v] of Object.entries(ufb.road)) totals[k] += v * tileYieldMult;
    }
    return { totals, usedRoadBonus };
  }

  function computeWorkedTileYield(city, civ, map) {
    const totals = { harvest: 0, coin: 0, lore: 0 };
    const radius = city.influenceRadius; // merged radius -- see note above filledOffsets
    const hasBarrow = cityHasStructure(city, "barrow");
    const barrowContestedMult = hasBarrow
      ? window.GameData.getBuilding("barrow").contestedYieldPenaltyOverride : 0;
    let roadBonusTilesUsed = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (!isOffsetFilled(city, dx, dy)) continue;
        const tx = city.x + dx, ty = city.y + dy;
        if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
        const tile = map.tiles[ty * map.width + tx];
        const result = tileYieldContribution(tile, dx, dy, civ, hasBarrow, barrowContestedMult, roadBonusTilesUsed);
        if (!result) continue;
        totals.harvest += result.totals.harvest;
        totals.coin += result.totals.coin;
        totals.lore += result.totals.lore;
        if (result.usedRoadBonus) roadBonusTilesUsed++;
      }
    }

    // Note: structure-derived yields (Grove Shrine forest-lore, flat yields,
    // road/influence bonuses) are handled in computeStructureEffects, not here.
    return totals;
  }

  /**
   * Actual yield ONE tile is currently paying to `civ`, summed across every
   * one of its cities that has this exact tile filled-in/worked (2026-08-12,
   * user-directed: the tile-click info panel showing base terrain yield
   * alongside the real, bonus-applied number) -- same math
   * computeWorkedTileYield uses, isolated to a single tile via
   * tileYieldContribution. Returns null if no city of this civ currently
   * works the tile (owned but not yet filled-in, contested with no Barrow,
   * or not owned by this civ at all) -- there's nothing "actual" to show
   * beyond the base yield already on screen. The road-bonus-cap check is
   * always passed 0 (bonus treated as active) rather than a real running
   * count -- a standalone tile lookup has no defined iteration order to
   * derive that from, so a city that's already saturated its cap elsewhere
   * could in the rare case show a slightly optimistic number here; not
   * worth the complexity of threading real city-wide state through a
   * single-tile query for a display-only figure.
   */
  function computeTileActualYield(tile, x, y, civ) {
    let totals = null;
    for (const city of civ.cities) {
      const dx = x - city.x, dy = y - city.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > city.influenceRadius) continue;
      if (!isOffsetFilled(city, dx, dy)) continue;
      const hasBarrow = cityHasStructure(city, "barrow");
      const barrowContestedMult = hasBarrow
        ? window.GameData.getBuilding("barrow").contestedYieldPenaltyOverride : 0;
      const result = tileYieldContribution(tile, dx, dy, civ, hasBarrow, barrowContestedMult, 0);
      if (!result) continue;
      totals = totals || { harvest: 0, coin: 0, lore: 0 };
      totals.harvest += result.totals.harvest;
      totals.coin += result.totals.coin;
      totals.lore += result.totals.lore;
    }
    return totals;
  }

  /** Attempts to found a city; returns the new city or null + reason.
   *  Takes `gameState` (not just `map`) so it can stamp civ.cityEvents with
   *  the current turn number -- see the doc comment below. */
  function foundCity(civ, gameState, x, y) {
    const map = gameState.map;
    const name = window.GameData.getNextCityName(civ.raceId, civ.usedCityNames || []);
    const city = createCity({ x, y, civId: civ.id, raceId: civ.raceId, name, map, radiusBonus: civ.radiusBonus || 0 });
    civ.cities.push(city);
    civ.usedCityNames = civ.usedCityNames || [];
    civ.usedCityNames.push(name);
    // Distinguishes "never founded a city yet" (a fresh civ still settling,
    // not eliminated by the 0-cities check in turns.js) from "founded one and
    // then lost it" (which IS eliminated once cities.length hits 0 again).
    civ.hasFoundedCity = true;
    // Founded/razed event log: feeds ai.js's
    // recentCityDelta, which strategy.js and ai.js's chooseBuildAction/
    // chooseStrategy use to taper "keep expanding" bonuses once a civ is
    // net losing cities faster than founding them -- see destroyCity below
    // for the matching "razed" event and the 2026-07-23 balance-audit
    // memory for why this mattered.
    civ.cityEvents = civ.cityEvents || [];
    civ.cityEvents.push({ turn: gameState.turnNumber || 0, type: "founded" });
    // Free first-city tech: the moment a civ's
    // FIRST city exists, it picks one Layer-1 tech for free -- a jumpstart
    // so early strategy isn't purely "whatever's cheapest to research."
    // Human civs get an interactive choice instead of this auto-pick -- see
    // main.js's openFoundCityDialog/openChooseTechDialog, which duplicates
    // this same civ.cities.length === 1 check since the human founding path
    // never calls this function (see that file's own doc comment on why).
    if (civ.cities.length === 1) {
      const freeTechId = window.GameEngine.tech.pickFreeTierOneTech(civ);
      if (freeTechId) window.GameEngine.tech.grantFreeTech(civ, freeTechId);
    }
    return city;
  }

  /**
   * Removes a city destroyed by siege (see combat.js attackCity): its
   * structures (on adjacent tiles) are torn down with it, and every tile in
   * its former filled-in radius reverts to neutral immediately rather than
   * waiting for next turn's influence recompute to notice the city is gone.
   *
   * That immediate reset matters: resolveOwnership's per-turn decay only
   * winds a tile down from "contested" to neutral over a few turns -- an
   * "owned" tile that suddenly receives NO influence at all (exactly what
   * happens once this city's filledOffsets stop projecting anything, the
   * instant it's removed from civ.cities) has no decay path at all and
   * would otherwise stay "owned" by this now-dead civ forever. Only tiles
   * this civ actually held (owned or contested) are touched -- a
   * neighboring civ's own claim on a tile within this radius is left alone,
   * so it can immediately take over on the very next influence recompute
   * if its own influence already dominates there.
   */
  function destroyCity(gameState, civ, city) {
    const { map } = gameState;
    for (const s of city.structures) {
      delete map.tiles[s.y * map.width + s.x].structure;
    }
    civ.cities = civ.cities.filter((c) => c !== city);
    // Founded/razed event log -- see foundCity's matching "founded" push
    // and ai.js's recentCityDelta for why this is tracked.
    civ.cityEvents = civ.cityEvents || [];
    civ.cityEvents.push({ turn: gameState.turnNumber || 0, type: "razed" });
    const tile = map.tiles[city.y * map.width + city.x];
    tile.ownerCivId = null;
    tile.status = "neutral";
    tile.contestedTurns = 0;
    // A razed city leaves a Ruin behind -- a
    // plain isRuin flag, identical to a worldgen-placed one (see
    // worldgen.js's mapgen pass), so it's claimable via Dungeon Delve,
    // heals Undead, factors into settle-site scoring, etc. exactly like any
    // other Ruin. No special "already looted" state to set -- Ruins don't
    // carry one (see turns.js's RESOURCE_EXHAUSTION_CHANCE for how a Ruin
    // can later disappear again).
    tile.isRuin = true;

    for (const key of city.filledOffsets) {
      const [dx, dy] = key.split(",").map(Number);
      const tx = city.x + dx, ty = city.y + dy;
      if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
      const t = map.tiles[ty * map.width + tx];
      if (t.ownerCivId !== civ.id) continue;
      t.ownerCivId = null;
      t.status = "neutral";
      t.contestedTurns = 0;
    }
  }

  window.GameEngine.cities = {
    createCity,
    canFoundCityAt,
    isRoadConnected,
    tickCity,
    isProducingResources,
    resourceProductionPreview,
    applyResourceProduction,
    isBoostingResearch,
    researchBoostAmount,
    applyResearchBoost,
    spreadCultureCost,
    isSpreadingCulture,
    applyCultureSpread,
    isCityIdle,
    computeWorkedTileYield,
    computeTileActualYield,
    isOffsetFilled,
    isTileFilledForCiv,
    advanceCityFill,
    industriousnessInfluenceMult,
    foundCity,
    destroyCity,
    cityHasStructure,
    civHasBuiltBuilding,
    findStructureSlot,
    validStructureSlots,
    placeStructure,
    findStructureAt,
    destroyStructure,
    RING1_SLOT_COUNT: ADJACENT_OFFSETS.length,
    RING2_SLOT_COUNT: RING2_OFFSETS.length,
    SETTLER_MIN_POP,
    MIN_CITY_SPACING,
    EMERGENCY_CITY_SPACING,
    GROWTH_THRESHOLD_PER_POP,
    MAX_CITY_POPULATION,
    FILL_THRESHOLD,
    FILL_RATE_BASE,
    FILL_RATE_PER_INDUSTRIOUSNESS,
  };
})();
