/**
 * TURN LOOP ENGINE
 * ----------------
 * Orchestrates a full turn: refresh visibility, resolve influence/
 * ownership, tick cities (growth/yield/upkeep), tick research, run AI
 * civs, heal units, advance turn counter. See ai_behavior_design.md §5
 * for the per-civ turn-loop spec this generalizes to the whole game turn.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  // A deliberate middle point between "territory wins everything" and
  // "elimination is the only real path" -- influence/territory and
  // military/elimination are meant to be two genuinely opposite, equally
  // viable win conditions (Halfellow-style economy vs. Orc-style conquest),
  // not one dominant path with the other as a rare fallback.
  //
  // Both read config LIVE rather than snapshotting at module load, so the
  // target can be retuned mid-session (headless balance runs set
  // window.GameConfig.victory.tileTarget between batches) without a reload.
  // The module's own export is a live getter for the same reason -- every
  // consumer that displays the target (sidebar, reports, victory screen)
  // goes through it, so they all stay in sync with whatever it's set to.
  const victoryTileTarget = () => window.GameConfig.victory.tileTarget;
  const victorySustainTurns = () => window.GameConfig.victory.sustainTurns;

  /** Computes each civ's currently-visible tile set (own territory + vision radius around units/cities) */
  function refreshVisibility(gameState) {
    const { map, civs } = gameState;
    gameState.visibility = gameState.visibility || {};
    // Persistent per-civ memory: `explored` only ever grows (never forgets a
    // tile once seen); `tileMemory` snapshots each explored tile's static
    // appearance (terrain/road/river/resource/ruin + whatever city/structure
    // sat on it) at the moment it was LAST actually visible. Units are
    // deliberately never snapshotted -- a remembered tile shows the terrain
    // and structures as last observed, never units, matching how AI vision
    // already treats "new developments" as requiring current sight.
    gameState.explored = gameState.explored || {};
    gameState.tileMemory = gameState.tileMemory || {};

    // One-time idx -> occupant lookup for this round's snapshot writes.
    const cityAt = new Map();
    const structureAt = new Map();
    for (const c of Object.values(civs)) {
      for (const city of c.cities) {
        cityAt.set(city.y * map.width + city.x, {
          raceId: c.raceId, population: Math.floor(city.population), isPort: !!city.isPort,
        });
        for (const s of city.structures) {
          structureAt.set(s.y * map.width + s.x, { id: s.id, raceId: c.raceId });
        }
      }
      // Bridges (2026-08-19 bugfix): the one structure type that doesn't
      // belong to any city (cities.js's findStructureAt doc comment) --
      // tracked on civ.bridges instead of city.structures, which this loop
      // otherwise only reads. Without this a bridge's tile snapshot always
      // came back structure:null, so a bridge vanished from view the
      // instant its tile left current vision instead of rendering in its
      // last-known state like every other structure already does.
      for (const s of c.bridges || []) {
        structureAt.set(s.y * map.width + s.x, { id: s.id, raceId: c.raceId });
      }
    }

    // Elf "Beast Sight" (2026-08-24 bugfix): the Wandering Monsters
    // pseudo-civ is processed FIRST, before any real civ, so its own
    // gameState.visibility[MONSTER_CIV_ID] is always fresh (this same
    // pass, not last round's) by the time a beast_sight civ's own turn in
    // the loop below reads it -- previously Object.values(civs)' natural
    // insertion order could put Monsters after an Elf civ, leaving Beast
    // Sight up to one round stale.
    const monsterCivId = window.GameConfig.worldEncounters.monsters.civId;
    const orderedCivs = Object.values(civs).sort((a, b) => {
      if (a.id === monsterCivId) return -1;
      if (b.id === monsterCivId) return 1;
      return 0;
    });
    for (const civ of orderedCivs) {
      const visible = new Set();
      for (const city of civ.cities) {
        // Elf "Aelderwatch"/Treetop Watch: +vision radius for the specific
        // city it's built adjacent to -- see cities.js's tickCity/
        // computeStructureEffects.
        const r = city.influenceRadius + 3 + (city.structureVisionBonus || 0);
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const x = city.x + dx, y = city.y + dy;
          if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
          visible.add(y * map.width + x);
        }
      }
      for (const unit of civ.units) {
        const baseUnit = window.GameData.getUnit(unit.typeId);
        // Tech can raise a unit type's vision via unit_stat_upgrade (additive,
        // same convention as attack/defense/movement -- see tech.js).
        const overrideVision = civ.unitOverrides?.[unit.typeId]?.visionRadius || 0;
        // Human "Flight": a unit granted temporary flight also gets +2 vision
        // for the duration (see ai.js's performWizardGrantFlight).
        const flightVision = unit.conditions?.flying?.visionBonus || 0;
        // Halfellow "Keep an Eye Out": +3 vision while holding a lookout
        // post (Hidden + stationary) -- see ai.js's maybeKeepAnEyeOutPlay.
        const watchVision = unit.conditions?.keepingWatch?.visionBonus || 0;
        // Halfellow "Banish the Darkness": +2 vision while inside The Great
        // Bonfire's aura -- see beginCivTurn's per-turn application below.
        const bonfireVision = unit.conditions?.greatBonfireAura?.visionBonus || 0;
        // Level-up "+1 Vision" pick -- same flat-add convention as
        // attack/defense, see combat.js's LEVEL_BONUS_VALUES.
        const levelVision = unit.levelBonuses?.visionRadius || 0;
        const r = (baseUnit.visionRadius || 3) + overrideVision + flightVision + watchVision + bonfireVision + levelVision;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const x = unit.x + dx, y = unit.y + dy;
          if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
          visible.add(y * map.width + x);
        }
      }
      // Also always-visible: tiles this civ currently owns (per AI behavior
      // doc §1) -- and, with Dwarf "Mountains on the Horizon," every single
      // Mountain tile on the entire map, full stop, no fog of war on
      // Mountains at all once researched (not just ones near a city/unit).
      // Elf "Wind From Distant Treetops" is the same mechanic, keyed to
      // Forest instead of Mountains.
      const revealMountains = civ.unlockedMechanics && civ.unlockedMechanics.has("mountains_on_the_horizon");
      const revealForest = civ.unlockedMechanics && civ.unlockedMechanics.has("wind_from_distant_treetops");
      // Human "Sea Charts": same reveal-mechanic shape as Mountains on the
      // Horizon/Wind From Distant Treetops just above, keyed to Ocean and
      // Coast instead of a land terrain.
      const revealSea = civ.unlockedMechanics && civ.unlockedMechanics.has("sea_charts");
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i].ownerCivId === civ.id
            || (revealMountains && map.tiles[i].terrain === "mountains")
            || (revealForest && map.tiles[i].terrain === "forest")
            || (revealSea && (map.tiles[i].terrain === "ocean" || map.tiles[i].terrain === "coast"))) visible.add(i);
      }
      // Dwarf "Passages in Stone": every Cave tile, plus a 2-tile
      // (Chebyshev) radius around each one, always revealed -- same
      // reveal-mechanic shape as Mountains on the Horizon above, just
      // keyed to tile.isCave with a radius instead of a single-terrain
      // match (and the Hills-adjacent-to-Mountains follow-up pass).
      if (civ.unlockedMechanics && civ.unlockedMechanics.has("passages_in_stone")) {
        for (let i = 0; i < map.tiles.length; i++) {
          if (!map.tiles[i].isCave) continue;
          const cx = i % map.width, cy = Math.floor(i / map.width);
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = cx + dx, ny = cy + dy;
              if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
              visible.add(ny * map.width + nx);
            }
          }
        }
      }
      // Halfellow Historical Society ("Antiquarians"): every Ruin tile on
      // the map, plus a ring around each -- same shape as Passages in Stone
      // just above, keyed to tile.isRuin. The ring is deliberate: a bare
      // ruin tile floating in fog says a site exists but not whether it's
      // guarded or reachable, which is what makes the knowledge actionable.
      // Building-gated, not tech-gated, so razing every copy takes the map
      // knowledge with it. Radius STACKS with each Society built (2026-08-28,
      // user-directed) -- one per city, same as the race's other 3 unique
      // buildings (see cities.js's civBuiltBuildingCount/ai.js's
      // availableBuilds, cityHasStructure-gated per city, not civ-wide) --
      // rather than a flat radius of 1 regardless of count.
      const historicalSocietyCount = window.GameEngine.cities.civBuiltBuildingCount(civ, "historical_society");
      if (historicalSocietyCount > 0) {
        for (let i = 0; i < map.tiles.length; i++) {
          if (!map.tiles[i].isRuin) continue;
          const rx = i % map.width, ry = Math.floor(i / map.width);
          for (let dy = -historicalSocietyCount; dy <= historicalSocietyCount; dy++) {
            for (let dx = -historicalSocietyCount; dx <= historicalSocietyCount; dx++) {
              const nx = rx + dx, ny = ry + dy;
              if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
              visible.add(ny * map.width + nx);
            }
          }
        }
      }
      // The Human Bazaar used to reveal every rival civ's city tile here
      // ("Traders' Talk"). Retired 2026-08-26, user-directed: the effect
      // didn't stack (one Bazaar revealed everything, a second did nothing),
      // and it self-obsoleted, since cities are large and static enough that
      // you find them anyway. The Bazaar now grants its city the "Expedite
      // Unit Build" action instead -- see cities.js's applyExpediteBuild.
      // Mountains on the Horizon also reveals any Hills tile immediately
      // adjacent (8-neighbor) to a Mountain tile -- the foothills leading up
      // to a peak are visible from the peak itself, same reasoning as the
      // Mountain reveal above. Separate pass (not folded into the loop
      // above) since it needs each Hills tile's neighbors, not just its own
      // terrain.
      if (revealMountains) {
        for (let i = 0; i < map.tiles.length; i++) {
          if (map.tiles[i].terrain !== "hills" || visible.has(i)) continue;
          const x = i % map.width, y = Math.floor(i / map.width);
          for (let dy = -1; dy <= 1 && !visible.has(i); dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
              if (map.tiles[ny * map.width + nx].terrain === "mountains") { visible.add(i); break; }
            }
          }
        }
      }
      // Elf "Beast Sight": shares the Wandering Monsters pseudo-civ's own
      // already-computed visibility set directly into this civ's -- Monsters
      // is a real gameState.civs entry with its own
      // gameState.visibility[MONSTER_CIV_ID]. Unioned in BEFORE this civ's
      // own visible set is assigned/snapshotted below, so the shared tiles
      // also feed explored/tileMemory normally, same as anything else this
      // civ can see. Always this SAME pass's fresh set, never stale --
      // orderedCivs above guarantees Monsters is processed before any real
      // civ reaches this branch.
      if (civ.unlockedMechanics && civ.unlockedMechanics.has("beast_sight")) {
        const monsterVisible = gameState.visibility[monsterCivId];
        if (monsterVisible) for (const idx of monsterVisible) visible.add(idx);
      }
      gameState.visibility[civ.id] = visible;

      const explored = gameState.explored[civ.id] || new Set();
      const memory = gameState.tileMemory[civ.id] || {};
      for (const idx of visible) {
        explored.add(idx);
        const tile = map.tiles[idx];
        // Tile city score: how good this tile would be to found a city on,
        // for THIS civ specifically (terrain yield, resource, ruin, river,
        // coastal, race/tech terrain affinity -- see ai.js's
        // computeTileCityScore, also used live by findBestSettleSite). Only
        // recomputed while the tile is actually visible, same as everything
        // else in this snapshot -- a civ's idea of a tile's value can go
        // stale (e.g. after unlocking a new terrain-bonus tech) until it's
        // observed again, matching how a human player's own memory would work.
        // null for water (never a legal city site).
        const rawCityScore = window.GameEngine.ai.computeTileCityScore(civ, gameState, idx % map.width, Math.floor(idx / map.width));
        memory[idx] = {
          terrain: tile.terrain,
          tallMountainEligible: !!tile.tallMountainEligible,
          hasRoad: !!tile.hasRoad,
          hasRiver: {
            n: !!tile.hasRiver?.n, s: !!tile.hasRiver?.s,
            e: !!tile.hasRiver?.e, w: !!tile.hasRiver?.w,
          },
          resource: tile.resource || null,
          isRuin: !!tile.isRuin,
          isCave: !!tile.isCave,
          city: cityAt.get(idx) || null,
          structure: structureAt.get(idx) || null,
          cityScore: Number.isFinite(rawCityScore) ? Math.round(rawCityScore * 10) / 10 : null,
          turnNumber: gameState.turnNumber || 0,
        };
      }
      gameState.explored[civ.id] = explored;
      gameState.tileMemory[civ.id] = memory;
    }
  }

  /** Treasure Chest "Map Fragment" reward (see doc/world_encounters_design.md):
   *  reveals a random still-unexplored area of the map to `civ`, live, for
   *  the rest of the CURRENT turn only. Picks a random tile this civ hasn't
   *  explored yet as the center, and a random radius (3-8 inclusive,
   *  Chebyshev). Every revealed tile is added to BOTH
   *  gameState.explored[civ.id] (permanent) and this round's already-computed
   *  gameState.visibility[civ.id] (live visibility only -- refreshVisibility
   *  fully REPLACES the visibility set from scratch every round, so the live
   *  peek automatically expires next round with no extra cleanup). Also
   *  writes gameState.tileMemory[civ.id] for each newly-revealed tile so it
   *  still renders correctly once live visibility lapses -- builds its own
   *  cityAt/structureAt lookup rather than sharing refreshVisibility's, to
   *  avoid touching that function's own per-round pass. Returns
   *  {x, y, radius} of what was revealed, or null if this civ has already
   *  explored the entire map. */
  function revealMapFragment(civ, gameState) {
    const { map } = gameState;
    const explored = gameState.explored[civ.id] || new Set();
    const unexploredIdx = [];
    for (let i = 0; i < map.tiles.length; i++) {
      if (!explored.has(i)) unexploredIdx.push(i);
    }
    if (!unexploredIdx.length) return null;

    const centerIdx = unexploredIdx[Math.floor(Math.random() * unexploredIdx.length)];
    const cx = centerIdx % map.width, cy = Math.floor(centerIdx / map.width);
    const radius = 3 + Math.floor(Math.random() * 6); // 3-8 inclusive

    const cityAt = new Map();
    const structureAt = new Map();
    for (const c of Object.values(gameState.civs)) {
      for (const city of c.cities) {
        cityAt.set(city.y * map.width + city.x, {
          raceId: c.raceId, population: Math.floor(city.population), isPort: !!city.isPort,
        });
        for (const s of city.structures) {
          structureAt.set(s.y * map.width + s.x, { id: s.id, raceId: c.raceId });
        }
      }
      // Bridges -- see refreshVisibility's own identical addition for why
      // civ.bridges needs its own pass separate from city.structures.
      for (const s of c.bridges || []) {
        structureAt.set(s.y * map.width + s.x, { id: s.id, raceId: c.raceId });
      }
    }

    const visible = gameState.visibility[civ.id] || new Set();
    const memory = gameState.tileMemory[civ.id] || {};
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const idx = y * map.width + x;
        explored.add(idx);
        visible.add(idx);
        const tile = map.tiles[idx];
        const rawCityScore = window.GameEngine.ai.computeTileCityScore(civ, gameState, x, y);
        memory[idx] = {
          terrain: tile.terrain,
          tallMountainEligible: !!tile.tallMountainEligible,
          hasRoad: !!tile.hasRoad,
          hasRiver: {
            n: !!tile.hasRiver?.n, s: !!tile.hasRiver?.s,
            e: !!tile.hasRiver?.e, w: !!tile.hasRiver?.w,
          },
          resource: tile.resource || null,
          isRuin: !!tile.isRuin,
          isCave: !!tile.isCave,
          city: cityAt.get(idx) || null,
          structure: structureAt.get(idx) || null,
          cityScore: Number.isFinite(rawCityScore) ? Math.round(rawCityScore * 10) / 10 : null,
          turnNumber: gameState.turnNumber || 0,
        };
      }
    }
    gameState.explored[civ.id] = explored;
    gameState.visibility[civ.id] = visible;
    gameState.tileMemory[civ.id] = memory;
    return { x: cx, y: cy, radius };
  }

  /**
   * Dungeon Delve: instantly reverts every tile in `unit`'s filled-offset set
   * (relative to (centerX, centerY), its last-known delve position) back to
   * neutral if this civ still owns it -- mirrors destroyCity's/eliminateCiv's
   * immediate tile reset elsewhere in this file, since resolveOwnership's
   * per-turn decay only winds an "owned" tile down if it's already
   * "contested"; a tile that abruptly gets zero fresh influence has no decay
   * path at all and would otherwise stay "owned" forever. A rival's own claim
   * on a tile within this radius is left alone.
   */
  function clearDelveOwnership(unit, civ, map, centerX, centerY) {
    const filled = unit._delveFilledOffsets;
    if (!filled || centerX == null || centerY == null) return;
    for (const key of filled) {
      const [dx, dy] = key.split(",").map(Number);
      const tx = centerX + dx, ty = centerY + dy;
      if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
      const tile = map.tiles[ty * map.width + tx];
      if (tile.ownerCivId !== civ.id) continue;
      tile.ownerCivId = null;
      tile.status = "neutral";
      tile.contestedTurns = 0;
    }
  }

  // Resource exhaustion: each turn a Dungeon Delve Wizard or Prospector's
  // Claim unit actively works its anchor tile, there's a flat chance the
  // Ruin/Gold Vein runs out and is permanently removed from the map -- see
  // beginRound's ritual-tracking loop below. Not applied to Dark Ritual
  // (Undead).
  const RESOURCE_EXHAUSTION_CHANCE = window.GameConfig.world.resourceExhaustionChance;

  /** Elf's "Tending to the Earth" tech halves RESOURCE_EXHAUSTION_CHANCE for
   *  the researching civ. */
  function resourceExhaustionChanceFor(civ) {
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("tending_to_the_earth")) {
      return window.GameConfig.world.resourceExhaustionChanceTendingToTheEarth;
    }
    return RESOURCE_EXHAUSTION_CHANCE;
  }

  /**
   * RESOURCE RESPAWN
   * ----------------
   * A depleted resource (Game, Fish, Iron, Gold, Fertile Soil) reappears
   * somewhere else on the map within the next 3 turns, so the world doesn't
   * strictly drain toward zero over a long game. Ruins do NOT go through
   * this system -- they're a tile FEATURE (tile.isRuin), not a RESOURCES
   * entry, so they need their own respawn placement logic; see
   * scheduleRuinRespawn/processRuinRespawns just below, which mirror this
   * pair's shape exactly.
   *
   * Queued rather than placed immediately: gameState.pendingResourceRespawns
   * is a list of { resourceId, dueTurn } processed once per round by
   * processResourceRespawns below. A plain array of plain objects, so it
   * survives savegame.js's JSON round-trip with no special handling.
   */
  const RESPAWN_MIN_DELAY = 1;
  const RESPAWN_MAX_DELAY = 3;

  function scheduleResourceRespawn(gameState, resourceId) {
    if (!resourceId) return;
    const delay = RESPAWN_MIN_DELAY + Math.floor(Math.random() * (RESPAWN_MAX_DELAY - RESPAWN_MIN_DELAY + 1));
    gameState.pendingResourceRespawns = gameState.pendingResourceRespawns || [];
    gameState.pendingResourceRespawns.push({
      resourceId,
      dueTurn: (gameState.turnNumber || 0) + delay,
    });
  }

  /**
   * Places every respawn whose dueTurn has arrived, on a random tile that's
   * valid terrain for that resource and doesn't already hold one. Called
   * once per round from beginRound.
   *
   * A respawn with no legal tile left anywhere is DROPPED rather than
   * retried forever -- the only way that happens is a map with every valid
   * tile for that resource type already occupied, in which case the world
   * isn't short of it and re-queuing would just spin every round.
   */
  function processResourceRespawns(gameState) {
    const pending = gameState.pendingResourceRespawns;
    if (!pending || !pending.length) return;
    const turnNumber = gameState.turnNumber || 0;
    const { map } = gameState;
    const stillPending = [];

    for (const entry of pending) {
      if (entry.dueTurn > turnNumber) { stillPending.push(entry); continue; }
      const record = window.GameData.RESOURCES[entry.resourceId];
      if (!record) continue; // unknown id (e.g. a save from a build where it existed) -- drop it
      const candidates = [];
      for (const tile of map.tiles) {
        if (tile.resource) continue;
        if (!record.validTerrain.includes(tile.terrain)) continue;
        candidates.push(tile);
      }
      if (!candidates.length) continue; // nowhere legal left -- see doc comment
      candidates[Math.floor(Math.random() * candidates.length)].resource = entry.resourceId;
    }

    gameState.pendingResourceRespawns = stillPending;
  }

  /**
   * RUIN RESPAWN (see doc/world_encounters_design.md)
   * -----------------------------------------------------------------------
   * Same queue-then-place shape as scheduleResourceRespawn/
   * processResourceRespawns above, kept as its own pair rather than folded
   * into that one: Ruins are a tile FEATURE (tile.isRuin), not a
   * `window.GameData.RESOURCES` entry, so there's no `validTerrain`/
   * resourceId to key off. A respawned Ruin can land on any LAND tile that
   * isn't already a Ruin and doesn't already hold a resource -- deliberately
   * not reusing worldgen.js's placeRuins density/spacing rules, which exist
   * to shape the WHOLE map's initial Ruin count, not a single one-off
   * replacement.
   */
  const RUIN_RESPAWN_MIN_DELAY = window.GameConfig.worldEncounters.ruin.respawnMinDelay;
  const RUIN_RESPAWN_MAX_DELAY = window.GameConfig.worldEncounters.ruin.respawnMaxDelay;

  function scheduleRuinRespawn(gameState) {
    const delay = RUIN_RESPAWN_MIN_DELAY + Math.floor(Math.random() * (RUIN_RESPAWN_MAX_DELAY - RUIN_RESPAWN_MIN_DELAY + 1));
    gameState.pendingRuinRespawns = gameState.pendingRuinRespawns || [];
    gameState.pendingRuinRespawns.push({ dueTurn: (gameState.turnNumber || 0) + delay });
  }

  /** Places every due Ruin respawn on a random eligible land tile. Dropped
   *  (not retried forever) if nothing legal is left, same reasoning as
   *  processResourceRespawns above. */
  function processRuinRespawns(gameState) {
    const pending = gameState.pendingRuinRespawns;
    if (!pending || !pending.length) return;
    const turnNumber = gameState.turnNumber || 0;
    const { map } = gameState;
    const stillPending = [];

    for (const entry of pending) {
      if (entry.dueTurn > turnNumber) { stillPending.push(entry); continue; }
      const candidates = map.tiles.filter((t) =>
        !t.isRuin && !t.resource && window.GameEngine.worldgen.isLand(t));
      if (!candidates.length) continue; // nowhere legal left -- see doc comment
      candidates[Math.floor(Math.random() * candidates.length)].isRuin = true;
    }

    gameState.pendingRuinRespawns = stillPending;
  }

  /**
   * Prospecting/delving/fishing payouts don't pay out straight to
   * civ.resources every qualifying turn -- each turn's gain accumulates into
   * unit._channelStash, delivered to the civ only when the channel ends on
   * its OWN terms (voluntary stop, see ai.js's maybeCashOutChannel, or
   * natural exhaustion, handled right where RESOURCE_EXHAUSTION_CHANCE fires
   * below). A FORCED interruption (the unit dies, moves away without
   * stopping properly, or a Halfellow Trouble Maker uses Resource Heist on
   * it) loses whatever's accumulated -- see the `!continuingRitual` cleanup
   * below, which clears _channelStash without calling this. Gives Resource
   * Heist something real to steal: a claim held for a while has real
   * accumulated value sitting on the unit, not just a counter.
   */
  function accumulateChannelStash(unit, gains) {
    const stash = unit._channelStash || { harvest: 0, coin: 0, lore: 0 };
    stash.harvest += gains.harvest || 0;
    stash.coin += gains.coin || 0;
    stash.lore += gains.lore || 0;
    unit._channelStash = stash;
  }

  /** Prospecting lore kicker (2026-08-17, user-directed): every channeled
   *  gathering payout that doesn't already pay lore directly (Ruin Delving
   *  does, via its own flat coin+lore split, so it's never passed through
   *  here) also yields 10% of its harvest+coin total as lore, floored at 1
   *  so even a small payout always trickles a little lore. Applied at the
   *  call site to each action's own already-multiplier-adjusted gains
   *  object, not as a civ-wide add-on. */
  function withProspectingLore(gains) {
    if (gains.lore) return gains;
    const total = (gains.harvest || 0) + (gains.coin || 0);
    return { ...gains, lore: Math.max(1, total * 0.10) };
  }

  /** Delivers unit._channelStash straight to civ.stockpile (NOT
   *  civ.resources) and clears it -- the "cash out" moment, called on a
   *  natural channel end (voluntary stop or exhaustion) only. Deliberately
   *  targets stockpile directly: civ.resources gets rebuilt from scratch at
   *  the top of every beginCivTurn and swept into stockpile before any unit
   *  acts (see the "Running stockpile" section below), so a call arriving
   *  DURING a unit's turn (ai.js's maybeCashOutChannel, or a Trouble
   *  Maker's Resource Heist) is already too late to land in civ.resources
   *  this turn -- it would just be silently overwritten next turn and
   *  never actually banked. Stockpile has no such reset, so it's timing-
   *  safe regardless of when this is called. No-op (and no floating text)
   *  if the stash is empty, e.g. a channel that exhausts on the very turn
   *  it starts, before ever reaching its first payout turn. */
  function bankChannelStash(unit, civ) {
    const stash = unit._channelStash;
    delete unit._channelStash;
    if (!stash) return;
    const { harvest = 0, coin = 0, lore = 0 } = stash;
    if (!harvest && !coin && !lore) return;
    civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    civ.stockpile.harvest += harvest;
    civ.stockpile.coin += coin;
    civ.stockpile.lore += lore;
    window.GameEngine.floatingText.spawnResourceGain(unit, { harvest, coin, lore });
  }

  /**
   * Once-per-round setup, run before any civ takes its turn: refresh vision,
   * advance Dark Ritual/Dungeon Delve tracking, and resolve this round's
   * influence/ownership map. Shared by the full-round `runTurn` and the
   * granular `advanceOneUnitStep` (called once at the start of a round,
   * whichever entry point is driving it).
   */
  function beginRound(gameState) {
    const { map, civs } = gameState;

    refreshVisibility(gameState);

    // Places anything queued by a depletion 1-3 turns ago -- see
    // scheduleResourceRespawn.
    processResourceRespawns(gameState);
    // Same idea, separate queue -- see scheduleRuinRespawn/
    // processRuinRespawns's own doc comment for why.
    processRuinRespawns(gameState);

    // Wandering Monsters (see doc/world_encounters_design.md): at most one
    // spawn roll per round. Lazily creates the "MONSTERS" pseudo-civ the
    // first time this runs -- see ai.js's ensureMonsterCiv.
    window.GameEngine.ai.maybeSpawnMonster(gameState);

    // Dark Ritual (Undead) / Dungeon Delve (Human Wizard): track consecutive
    // turns a qualifying unit has stood still on its anchor tile, evaluated
    // BEFORE this turn's influence computation so it reflects standing time
    // as of the end of last turn's movement.
    for (const civ of Object.values(civs)) {
      if (civ.eliminated) continue;
      const hasDarkRitual = civ.unlockedMechanics && civ.unlockedMechanics.has("dark_ritual");
      const hasDungeonDelve = civ.unlockedMechanics && civ.unlockedMechanics.has("dungeon_delve");
      if (!hasDarkRitual && !hasDungeonDelve) continue;

      // Dungeon Delve: catch a unit that died (in combat, disbanded, starved
      // -- any cause) since last round, not just one that moved. It's
      // already gone from civ.units by now, so the loop below would never
      // visit it again to clean up. civ._trackedDelvingUnits holds onto the
      // object REFERENCE specifically so its last-known position/filled-
      // offsets are still readable here even after removal from the civ's
      // live unit list (removing an object from an array doesn't erase the
      // object itself, as long as something else still points to it).
      if (hasDungeonDelve && civ._trackedDelvingUnits) {
        civ._trackedDelvingUnits = civ._trackedDelvingUnits.filter((u) => {
          if (civ.units.includes(u)) return true;
          clearDelveOwnership(u, civ, map, u._lastRitualX, u._lastRitualY);
          return false;
        });
      }

      for (const unit of civ.units) {
        // Dark Ritual and Dungeon Delve both apply to any unit.
        const isDelvingUnit = hasDungeonDelve;
        const qualifies = hasDarkRitual || isDelvingUnit;
        // Falls back to the unit's OWN current position when it has never
        // been tracked before (2026-08-31 bugfix): comparing a real
        // coordinate against a genuinely-undefined _lastRitualX/Y always
        // came out false, so a unit's very FIRST round of Delving read as
        // "moved away from an untracked past" instead of "just arrived,"
        // instantly clearing the channel it had just started -- user-
        // reported as needing to click Start Delving twice (the second
        // click's round then had a real prior position to compare against,
        // so it stuck from there on). Falling back to the unit's own
        // current x/y makes `stayedPut` trivially true the first time,
        // exactly like a fresh anchor should read.
        const oldX = unit._lastRitualX ?? unit.x, oldY = unit._lastRitualY ?? unit.y;
        if (isDelvingUnit) {
          civ._trackedDelvingUnits = civ._trackedDelvingUnits || [];
          if (!civ._trackedDelvingUnits.includes(unit)) civ._trackedDelvingUnits.push(unit);
        }
        if (!qualifies) {
          unit._ritualTurns = 0;
          // Moving off the anchor tile (or no longer qualifying at all)
          // instantly wipes out everything it was claiming/generating -- see
          // clearDelveOwnership and computeInfluenceMap's use of
          // _delveFilledOffsets (unlike a city's filledOffsets, which is
          // permanent once earned).
          if (isDelvingUnit) {
            clearDelveOwnership(unit, civ, map, oldX, oldY);
            delete unit._delveFilledOffsets;
            unit._delveFillProgress = 0;
            if (unit.channeling === "delving") unit.channeling = null;
          }
          continue;
        }
        const tile = map.tiles[unit.y * map.width + unit.x];
        const onRuin = !!(tile && tile.isRuin);
        // Dungeon Delve requires an EXPLICITLY started channel
        // (unit.channeling, set by performStartChannel below -- either the
        // player's own "Start Delving" action or the AI's equivalent
        // decision in maybeDungeonDelvePlay), not just "happens to be
        // standing on the tile." Dark Ritual (Undead) is always-on-Ruin.
        let onAnchor;
        if (isDelvingUnit) onAnchor = onRuin && unit.channeling === "delving";
        else onAnchor = onRuin;

        // Resource exhaustion (see RESOURCE_EXHAUSTION_CHANCE above):
        // clearing the tile flag and forcing onAnchor false HERE, before the
        // ownership/_ritualTurns bookkeeping below, makes exhaustion fall
        // through the exact same "no longer on anchor" cleanup path as
        // moving away or dying -- no separate cleanup logic needed.
        if (isDelvingUnit && onAnchor && Math.random() < resourceExhaustionChanceFor(civ)) {
          // See scheduleRuinRespawn/processRuinRespawns's own doc comment.
          scheduleRuinRespawn(gameState);
          tile.isRuin = false;
          window.GameEngine.floatingText.spawnFloatingText(unit, "Ruin Exhausted!", "warning");
          onAnchor = false;
          unit.channeling = null;
          // Natural end -- bank whatever accumulated before exhaustion hit,
          // same as a voluntary stop. See bankChannelStash's doc comment.
          bankChannelStash(unit, civ);
        }

        const stayedPut = unit.x === oldX && unit.y === oldY;
        const continuingRitual = onAnchor && stayedPut;
        unit._ritualTurns = onAnchor ? (stayedPut ? (unit._ritualTurns || 0) + 1 : 1) : 0;
        // Scoped to units actually engaged with Delve specifically, not just
        // "isDelvingUnit is true": isDelvingUnit is a CIV-LEVEL capability
        // flag, true for essentially every civ (Ruin Delving is free Level 0
        // infrastructure) -- without this guard, the cleanup below would run
        // for every unit of a qualifying civ that isn't this-instant
        // delving, including one mid-Fishing/Hunting/Farming/Mining, which
        // also stashes its payout in this same unit._channelStash.
        const wasDelving = unit.channeling === "delving" || unit._delveFilledOffsets !== undefined;
        if (isDelvingUnit && !continuingRitual && wasDelving) {
          clearDelveOwnership(unit, civ, map, oldX, oldY);
          delete unit._delveFilledOffsets;
          unit._delveFillProgress = 0;
          if (unit.channeling === "delving") unit.channeling = null;
          // Forced interruption (died, moved off, or Resource Heist already
          // handled its own transfer) -- whatever's left in the stash is
          // simply lost, same as the territorial claim above. Already
          // delivered above if exhaustion was the actual cause.
          delete unit._channelStash;
        }
        unit._lastRitualX = unit.x;
        unit._lastRitualY = unit.y;
      }
    }

    const influenceMap = window.GameEngine.influence.computeInfluenceMap(gameState);
    window.GameEngine.influence.resolveOwnership(gameState, influenceMap);
  }

  /** True if (x,y) is Coast, Ocean, or carries the river feature -- nearby
   *  water smothers Burning: no damage while standing there, AND (2026-08-24)
   *  the condition itself is fully extinguished, not just paused -- see
   *  tickBurningDamage, which checks this at the start of a civ's turn using
   *  the unit/structure's position from before it's acted this turn, i.e.
   *  wherever it ended its LAST turn, so "ends a turn on qualifying terrain"
   *  and "is standing there right now" read the same at this check point. */
  function isBurningExempt(map, x, y) {
    const tile = map.tiles[y * map.width + x];
    if (!tile) return false;
    if (window.GameData.TERRAIN[tile.terrain].isWater) return true;
    const r = tile.hasRiver;
    return !!(r && (r.n || r.s || r.e || r.w));
  }

  /**
   * Burning: 1 point of damage at the start of the affected unit/
   * building/wall's turn, for 3 turns (see ai.js's BURN_DURATION for where
   * it's actually applied -- "Burn It All Down" and "Fireball!"), unless the
   * target is currently on Coast, Ocean, or a river tile (see
   * isBurningExempt above). Ticked here -- once per civ-turn, uniformly for
   * EVERY civ, human or AI -- rather than in ai.js's beginAITurn/
   * tickConditions pass, which only ever runs for AI-controlled civs (see
   * beginCivTurn's own AI-only branch further below): Burning must still
   * hurt a human player's own units/buildings.
   *
   * Units store it as unit.conditions.burning (so it shows the same fire
   * badge as every other condition -- see render.js's CONDITION_ICONS);
   * structures (buildings/walls, which have no `.conditions` container of
   * their own) store it as a plain `.burning` field directly. Does NOT
   * affect cities themselves -- only units and the buildings/walls standing
   * in their radius.
   */
  function tickBurningDamage(gameState, civ) {
    const { map } = gameState;
    const turnNumber = gameState.turnNumber || 0;
    // Strict `>` (not the generic tickConditions/setCondition convention's
    // `>=`): Burning's expiresAtTurn is stamped at application time as
    // "current turn + BURN_DURATION" (see ai.js's applyBurning), and the
    // whole point is exactly BURN_DURATION discrete damage TICKS, not just
    // "gone once this many turns have passed" the way a continuous
    // modifier like Frozen works. `>=` would silently eat the last tick.

    for (const unit of civ.units) {
      const burn = unit.conditions && unit.conditions.burning;
      if (!burn) continue;
      if (turnNumber > burn.expiresAtTurn) { delete unit.conditions.burning; continue; }
      if (isBurningExempt(map, unit.x, unit.y)) { delete unit.conditions.burning; continue; }
      unit.hp = Math.max(0, unit.hp - 1);
      window.GameEngine.floatingText.spawnFloatingText(unit, "-1 (Burning)", "warning");
    }
    civ.units = civ.units.filter((u) => u.hp > 0);

    for (const city of civ.cities.slice()) {
      // Burning doesn't affect cities themselves -- only units and
      // buildings/walls.
      for (const s of city.structures.slice()) {
        if (!s.burning) continue;
        if (turnNumber > s.burning.expiresAtTurn) { delete s.burning; continue; }
        if (isBurningExempt(map, s.x, s.y)) { delete s.burning; continue; }
        s.hp -= 1;
        // Floating text anchored to the structure record itself -- see
        // render.js's Structures draw loop, which matches this by object
        // identity, same convention as a unit.
        window.GameEngine.floatingText.spawnFloatingText(s, "-1 (Burning)", "warning");
        if (s.hp <= 0) window.GameEngine.cities.destroyStructure(gameState, s.x, s.y);
      }
    }

    // One-time cleanup (2026-08-19 bugfix): a since-fixed AI bug let a
    // city's generic build-queue place bridge_section like any other
    // building, via cities.js's placeStructure -- which pushes into
    // city.structures (a bridge legitimately built by a Pioneer instead
    // goes through placeBridgeSegment, which pushes into civ.bridges, a
    // completely different array) -- onto the city's own LAND ring tile
    // (see ai.js's chooseBuildAction, which now excludes building.isBridge
    // from that loop). A bridge can only ever be legitimate water
    // (cities.js's canBuildBridgeSegment already guarantees that for every
    // NEW Pioneer-built placement), so any bridge_section record found
    // sitting on non-water terrain here -- in EITHER array -- predates
    // that fix and is quietly removed rather than left cluttering a city's
    // ring tile (or the map generally) forever.
    for (const s of (civ.bridges || []).slice()) {
      const tile = map.tiles[s.y * map.width + s.x];
      if (tile && !window.GameData.TERRAIN[tile.terrain].isWater) {
        window.GameEngine.cities.destroyStructure(gameState, s.x, s.y);
      }
    }
    for (const city of civ.cities.slice()) {
      for (const s of city.structures.slice()) {
        if (s.id !== "bridge_section") continue;
        const tile = map.tiles[s.y * map.width + s.x];
        if (tile && !window.GameData.TERRAIN[tile.terrain].isWater) {
          window.GameEngine.cities.destroyStructure(gameState, s.x, s.y);
        }
      }
    }

    // Bridges: same Burning tick as city structures just above (a bridge
    // can catch fire from Fireball's now-indiscriminate blast, same as any
    // other structure -- see combat.js's applyFireballBlast), but read from
    // civ.bridges instead, since a bridge doesn't belong to any one city.
    for (const s of (civ.bridges || []).slice()) {
      if (!s.burning) continue;
      if (turnNumber > s.burning.expiresAtTurn) { delete s.burning; continue; }
      if (isBurningExempt(map, s.x, s.y)) continue;
      s.hp -= 1;
      window.GameEngine.floatingText.spawnFloatingText(s, "-1 (Burning)", "warning");
      // handleBridgeDestroyed (not the plain destroyStructure city.structures
      // walls/buildings use) -- a burned-out bridge also drops whoever was
      // standing on it into the water, same as one destroyed by direct
      // attack (see that function's own doc comment for the Flying
      // exception).
      if (s.hp <= 0) window.GameEngine.ai.handleBridgeDestroyed(gameState, s.x, s.y);
    }
  }

  /**
   * Poisoned (see doc/world_encounters_design.md -- Marsh Adder's venom):
   * direct mirror of tickBurningDamage just above, unit-only (Poisoned
   * currently only ever comes from a Wandering Monster's bite, and monsters
   * never target structures/cities -- see ai.js's runMonsterUnitTurn). Same
   * 1 damage/turn shape, same water/river exemption reuse (isBurningExempt
   * is generic despite its name -- just a "this tile washes off a
   * damage-over-time condition" check), same `poisoned` condition key so it
   * gets its own icon/tint (overlays.js) instead of showing the fire badge.
   * Ticked here for the same reason Burning is -- uniformly for every civ,
   * human or AI, not just AI-controlled ones.
   */
  function tickPoisonedDamage(gameState, civ) {
    const { map } = gameState;
    const turnNumber = gameState.turnNumber || 0;
    for (const unit of civ.units) {
      const poison = unit.conditions && unit.conditions.poisoned;
      if (!poison) continue;
      if (turnNumber > poison.expiresAtTurn) { delete unit.conditions.poisoned; continue; }
      if (isBurningExempt(map, unit.x, unit.y)) continue;
      unit.hp = Math.max(0, unit.hp - 1);
      window.GameEngine.floatingText.spawnFloatingText(unit, "-1 (Poisoned)", "warning");
    }
    civ.units = civ.units.filter((u) => u.hp > 0);
  }

  /**
   * Once-per-civ-turn setup: city tick, resource/stockpile accounting,
   * starvation check, research tick, then everything in an AI civ's turn
   * that happens BEFORE any individual unit acts (see ai.js's beginAITurn --
   * disband/research/found-city/build-queue decisions, none of which are
   * "one unit's turn" in the sense stepCivTurnUnit below means). Skipped
   * entirely (returns null) if the civ is eliminated. Split out of the
   * former monolithic runCivTurn (still available below, now just this +
   * a stepCivTurnUnit loop + finishCivTurn) so advanceOneUnitStep can run
   * this ONCE per civ-turn, then call stepCivTurnUnit repeatedly, one AI
   * unit per call, for spectator mode's visible one-unit-at-a-time pacing.
   * Returns a turnCtx object stepCivTurnUnit/finishCivTurn need (null for
   * an eliminated civ, or a human civ with nothing to step).
   */
  function beginCivTurn(gameState, civ, { humanCivId = null, difficultyByCiv = {} } = {}) {
    if (civ.eliminated) return null;
    const { map } = gameState;

    // Orc "Dire Wolf" drought detector: counts consecutive turns since any
    // of this civ's units last saw real combat. Tracked uniformly for every
    // civ (cheap, and matches every other civ-wide counter in this file)
    // even though only Orc currently consumes it (see ai.js's
    // chooseBuildAction). Reset to 0 at every real combat call site -- see
    // ai.js's markCombatEngaged.
    civ.turnsSinceCombat = (civ.turnsSinceCombat || 0) + 1;

    tickBurningDamage(gameState, civ);
    tickPoisonedDamage(gameState, civ);
    // Wall Defense (Defend the Walls/Treetop Snipers/Long Range Snipers) is
    // checked in endRound below, not here: checking at the START of this
    // civ's own turn would only ever see enemy positions as of the END of
    // the PREVIOUS round, so a quick skirmish (a monster that moved
    // adjacent, attacked, and retreated within a single round) would be
    // invisible to every check. See endRound's own comment.

    for (const city of civ.cities) {
      window.GameEngine.cities.tickCity(city, civ, map);
    }

    // Accumulate per-turn resource totals so the UI can display civ-level production
    civ.resources = civ.cities.reduce((acc, c) => {
      if (c.lastYield) {
        acc.harvest += c.lastYield.harvest || 0;
        acc.coin    += c.lastYield.coin    || 0;
        acc.lore    += c.lastYield.lore    || 0;
      }
      return acc;
    }, { harvest: 0, coin: 0, lore: 0 });

    // Human "Marketcraft": used to give +10% to every mined/fished/farmed/
    // hunted/delved channel-gathering payout below while a Bazaar stood.
    // 2026-08-24: retired along with the rest of the economic building
    // effects -- the Bazaar now reveals rival city locations instead (see
    // refreshVisibility's "Traders' Talk" block). Left as a neutral 1.0
    // rather than deleting the six multiplication sites below, so the
    // channel payouts stay in one recognizable shape for whatever tunes
    // them next.
    const marketcraftMult = 1;

    // Dungeon Delve: a qualifying unit (any race/type, see
    // doc/world_encounters_design.md), channeling for 1+ turns (i.e. every
    // turn after the turn spent explicitly starting the channel), pays out
    // +9 lore, +9 coin per turn on top of normal city income -- that flat
    // bonus is the tech's ENTIRE resource effect (no per-tile harvest,
    // unlike Dwarf's Prospector's Claim below). The unit still gradually
    // claims the 1-tile radius around itself (see _delveFilledOffsets --
    // gradual, exactly like a city's own filled-in mechanic, NOT instant),
    // and that filled-in influence still counts toward the 33% territorial
    // victory condition through the normal ownership pipeline in
    // resolveOwnership/countTerritory -- claiming and resource generation
    // are deliberately decoupled here.
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("dungeon_delve")) {
      const race = window.GameData.getRace(civ.raceId);
      const industriousness = race.industriousness ?? 0.5;
      const cities = window.GameEngine.cities;
      for (const unit of civ.units) {
        if ((unit._ritualTurns || 0) < 1) continue;
        // _ritualTurns is shared across Dark Ritual/Dungeon Delve/
        // Prospector's Claim, and a Dwarf civ can have BOTH Delve and
        // Prospector's Claim unlocked at once -- without this check, a unit
        // prospecting a Gold Vein (which also sets _ritualTurns >= 1) would
        // incorrectly ALSO collect this Ruin payout. Must actually be
        // standing on a Ruin AND have explicitly started Delving
        // specifically (not just Dark Ritual, which also anchors on a Ruin
        // but -- per its own comment elsewhere in this file -- never sets
        // unit.channeling at all).
        const tile = map.tiles[unit.y * map.width + unit.x];
        if (!tile || !tile.isRuin || unit.channeling !== "delving") continue;
        // Accumulates instead of paying out directly -- see
        // accumulateChannelStash's doc comment above. 3x payout (2026-08-17,
        // user-directed, applies to every prospecting/gathering action).
        accumulateChannelStash(unit, { coin: 9 * marketcraftMult, lore: 9 * marketcraftMult });
        // Gathering XP (2026-08-31, user-directed): 1 per round for every
        // gathering channel, not just this one -- see config.js's
        // leveling.xpPerGatheringRound doc comment.
        window.GameEngine.ai.grantXPAndAutoLevel(unit, civ, window.GameConfig.leveling.xpPerGatheringRound);

        // Ruin encounters: each can fire AT MOST ONCE per Ruin, ever --
        // tracked on the TILE itself (not the unit), so it survives a
        // different unit later taking over the same claim, and never
        // carries over to whatever new Ruin eventually respawns elsewhere
        // (a fresh tile object with no flags set). Independent rolls, not
        // mutually exclusive -- both could in principle fire the same turn.
        const ruinCfg = window.GameConfig.worldEncounters.ruin;
        const ruinLog = [];
        if (!tile._delveMonsterRolled && Math.random() < ruinCfg.monsterEncounterChance) {
          tile._delveMonsterRolled = true;
          window.GameEngine.ai.triggerRuinMonsterEncounter(civ, unit, gameState, ruinLog);
        }
        if (!tile._delveTreasureRolled && Math.random() < ruinCfg.treasureFindChance) {
          tile._delveTreasureRolled = true;
          ruinLog.push(`Ruin: ${civ.id}'s ${unit.name || unit.typeId} finds treasure while delving at (${unit.x},${unit.y})`);
          const treasureResult = window.GameEngine.ai.grantMonsterKillReward(civ, unit, gameState);
          // Modal for the human player -- see main.js's
          // offerNextTreasureNotice/queueTreasureNotice's own doc comment
          // for why this is set unconditionally for every civ.
          const unitLabel = unit.name || window.GameData.getUnit(unit.typeId).label;
          window.GameEngine.ai.queueTreasureNotice(civ, unitLabel, treasureResult);
        }
        if (ruinLog.length) window.GameEngine.ai.appendAIActionLog(gameState, civ.id, ruinLog);

        const filled = unit._delveFilledOffsets || new Set();

        // Advance next round's filled set (same rate/threshold constants a
        // city's own advanceCityFill uses) -- deliberately AFTER this round's
        // harvest above, so a newly-filled tile only starts paying out and
        // projecting influence starting next round, exactly like a city.
        unit._delveFilledOffsets = filled;
        const candidates = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const key = `${dx},${dy}`;
            if (filled.has(key)) continue;
            const tx = unit.x + dx, ty = unit.y + dy;
            if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
            candidates.push(key);
          }
        }
        if (candidates.length > 0) {
          unit._delveFillProgress = (unit._delveFillProgress || 0)
            + cities.FILL_RATE_BASE + industriousness * cities.FILL_RATE_PER_INDUSTRIOUSNESS;
          while (unit._delveFillProgress >= cities.FILL_THRESHOLD && candidates.length > 0) {
            unit._delveFillProgress -= cities.FILL_THRESHOLD;
            const idx = Math.floor(Math.random() * candidates.length);
            filled.add(candidates[idx]);
            candidates.splice(idx, 1);
          }
        }
      }
    }

    // Galley "Fishing": a universal channeled action for ANY Galley (any
    // race, gated on the Level 0 "Fishing" tech) -- explicitly started (see
    // ai.js's maybeGalleyFishingPlay / the player's own "Start Fishing"
    // action), same shape as Dungeon Delve above but simpler: a flat
    // +15 harvest/+6 coin per turn (plus a 10%-of-total lore kicker, min 1
    // -- see withProspectingLore) while it stays on a Fish Shoal tile and
    // keeps channeling, no graduated tiers and no territorial claim. Ends
    // the instant it's no longer on the shoal (moved off, or the shoal was
    // never there -- channeling got cleared elsewhere) or the shoal
    // exhausts (same RESOURCE_EXHAUSTION_CHANCE used above).
    for (const unit of civ.units) {
      if (unit.typeId !== "galley" || unit.channeling !== "fishing") continue;
      const tile = map.tiles[unit.y * map.width + unit.x];
      const hasTech = civ.unlockedMechanics && civ.unlockedMechanics.has("fishing");
      if (!tile || tile.resource !== "fish" || !hasTech) {
        // Forced end (shoal gone / tech no longer unlocked -- defense in
        // depth, same check the ring menu is already gated on / channeling
        // cleared elsewhere) -- lose whatever's accumulated, same rule as
        // Prospector's Claim/Delve.
        unit.channeling = null;
        delete unit._channelStash;
        continue;
      }
      // Accumulates instead of paying out directly -- see
      // accumulateChannelStash's doc comment above. 3x payout plus the
      // withProspectingLore kicker (2026-08-17, user-directed).
      accumulateChannelStash(unit, withProspectingLore({ harvest: 15 * marketcraftMult, coin: 6 * marketcraftMult }));
      // Gathering XP -- see the Dungeon Delve block above for why this is
      // flat and shared across every gathering channel.
      window.GameEngine.ai.grantXPAndAutoLevel(unit, civ, window.GameConfig.leveling.xpPerGatheringRound);
      if (Math.random() < resourceExhaustionChanceFor(civ)) {
        scheduleResourceRespawn(gameState, tile.resource);
        tile.resource = null;
        window.GameEngine.floatingText.spawnFloatingText(unit, "Shoal Exhausted!", "warning");
        unit.channeling = null;
        // Natural end -- bank it, same as Prospector's Claim/Delve exhaustion.
        bankChannelStash(unit, civ);
      }
    }

    // Pioneer/Scout "Hunt Game"/"Farm Soil": two Tier 0 tech-gated channeled
    // actions (techs.js's hunt_game/farm_soil) for ANY Pioneer or Scout (any
    // race, gated on the canProspect unit-data flag) -- explicitly started
    // via the player's own "Hunt Game"/"Farm Soil" actions (no AI
    // counterpart yet, same as Pioneer's Build Road). Same shape as Galley
    // Fishing just above: a flat +9 harvest per turn (plus a 10%-of-total
    // lore kicker, min 1 -- see withProspectingLore) while it stays on its
    // resource tile and keeps channeling, no graduated tiers and no
    // territorial claim. Ends the instant it's no longer on a qualifying
    // tile, the tech is no longer unlocked (defense in depth, same check
    // the sidebar button is already gated on), or the resource exhausts
    // (same RESOURCE_EXHAUSTION_CHANCE used above). Internally keyed
    // "hunting"/"farming" -- see sidebar.js's CHANNEL_LABELS.
    for (const unit of civ.units) {
      if (!window.GameData.getUnit(unit.typeId).canProspect || unit.channeling !== "hunting") continue;
      const tile = map.tiles[unit.y * map.width + unit.x];
      const hasTech = civ.unlockedMechanics && civ.unlockedMechanics.has("hunt_game");
      if (!tile || tile.resource !== "game" || !hasTech) {
        unit.channeling = null;
        delete unit._channelStash;
        continue;
      }
      // 3x payout plus the withProspectingLore kicker (2026-08-17, user-directed).
      accumulateChannelStash(unit, withProspectingLore({ harvest: 9 * marketcraftMult }));
      // Gathering XP -- see the Dungeon Delve block above.
      window.GameEngine.ai.grantXPAndAutoLevel(unit, civ, window.GameConfig.leveling.xpPerGatheringRound);
      if (Math.random() < resourceExhaustionChanceFor(civ)) {
        scheduleResourceRespawn(gameState, tile.resource);
        tile.resource = null;
        window.GameEngine.floatingText.spawnFloatingText(unit, "Game Depleted!", "warning");
        unit.channeling = null;
        bankChannelStash(unit, civ);
      }
    }
    for (const unit of civ.units) {
      if (!window.GameData.getUnit(unit.typeId).canProspect || unit.channeling !== "farming") continue;
      const tile = map.tiles[unit.y * map.width + unit.x];
      const hasTech = civ.unlockedMechanics && civ.unlockedMechanics.has("farm_soil");
      if (!tile || tile.resource !== "fertile" || !hasTech) {
        unit.channeling = null;
        delete unit._channelStash;
        continue;
      }
      // 3x payout plus the withProspectingLore kicker (2026-08-17, user-directed).
      accumulateChannelStash(unit, withProspectingLore({ harvest: 9 * marketcraftMult }));
      // Gathering XP -- see the Dungeon Delve block above.
      window.GameEngine.ai.grantXPAndAutoLevel(unit, civ, window.GameConfig.leveling.xpPerGatheringRound);
      if (Math.random() < resourceExhaustionChanceFor(civ)) {
        scheduleResourceRespawn(gameState, tile.resource);
        tile.resource = null;
        window.GameEngine.floatingText.spawnFloatingText(unit, "Soil Exhausted!", "warning");
        unit.channeling = null;
        bankChannelStash(unit, civ);
      }
    }

    // Pioneer/Scout/Druid/(any Dwarf unit w/ Dwarven Mining) "Mine Vein":
    // same flat-payout, no-territorial-claim shape as Hunt Game/Farm Soil
    // just above, extended to Gold/Iron Veins. Gated on the Level 0 "Mining"
    // tech; Dwarves additionally get an OR-bypass via "Dwarven Mining"
    // (dwarf_dwarven_mining) letting ANY dwarf unit start this, not just
    // canProspect ones -- mirrors the same OR-condition in orders.js's
    // ring-menu gate.
    for (const unit of civ.units) {
      const baseUnit = window.GameData.getUnit(unit.typeId);
      const canMine = baseUnit.canProspect
        || (civ.raceId === "dwarf" && civ.unlockedMechanics && civ.unlockedMechanics.has("dwarven_mining"));
      if (!canMine || unit.channeling !== "mining") continue;
      const tile = map.tiles[unit.y * map.width + unit.x];
      const hasTech = civ.unlockedMechanics && civ.unlockedMechanics.has("mining");
      if (!tile || (tile.resource !== "gold" && tile.resource !== "iron") || !hasTech) {
        unit.channeling = null;
        delete unit._channelStash;
        continue;
      }
      // Dwarf "Prospector's Claim"/"The Deep Mines": flat resource-yield
      // multipliers on ordinary mining -- each just sets its own
      // mechanicValues entry (tech.js), summed here.
      const yieldMult = 1
        + (civ.mechanicValues?.prospectors_claim_yield || 0)
        + (civ.mechanicValues?.deep_mines_yield || 0);
      // 3x payout plus the withProspectingLore kicker (2026-08-17, user-directed).
      accumulateChannelStash(unit, withProspectingLore({ coin: 9 * yieldMult * marketcraftMult }));
      // Gathering XP -- see the Dungeon Delve block above.
      window.GameEngine.ai.grantXPAndAutoLevel(unit, civ, window.GameConfig.leveling.xpPerGatheringRound);
      if (Math.random() < resourceExhaustionChanceFor(civ)) {
        scheduleResourceRespawn(gameState, tile.resource);
        tile.resource = null;
        window.GameEngine.floatingText.spawnFloatingText(unit, "Vein Exhausted!", "warning");
        unit.channeling = null;
        bankChannelStash(unit, civ);
      }
    }

    // Orc "Pillage and Loot": any Orc unit standing within an enemy city's
    // radius (raiding range) generates +1 harvest/+1 coin/+1 lore for EACH
    // tile where it actually suppressed enemy influence this turn (see
    // influence.js computeInfluenceMap, which sets
    // `unit._pillageTilesSuppressed` during beginRound -- runs BEFORE this
    // civ turn in the same round, so the count here is always fresh, not
    // stale from last turn).
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("pillage_and_loot")) {
      for (const unit of civ.units) {
        const tilesSuppressed = unit._pillageTilesSuppressed || 0;
        if (tilesSuppressed <= 0) continue;
        civ.resources.harvest += tilesSuppressed;
        civ.resources.coin += tilesSuppressed;
        civ.resources.lore += tilesSuppressed;
      }
    }

    // Halfellow "Banish the Darkness": The Great Bonfire only burns for
    // GREAT_BONFIRE_DURATION turns from the moment it's summoned (see
    // ai.js's startWandererBonfireSummon, which stamps bonfireExpiresAtTurn)
    // -- checked once at the top of the civ's own turn, BEFORE the aura loop
    // further below, so an expiring Bonfire grants exactly
    // GREAT_BONFIRE_DURATION turns of active aura, not one extra. No disband
    // dialog needed (unlike the Wisp cap further below) -- there's at most
    // one, per civ, and it simply times out.
    civ.units = civ.units.filter((u) => !(u.typeId === "great_bonfire"
      && u.bonfireExpiresAtTurn != null && (gameState.turnNumber || 0) >= u.bonfireExpiresAtTurn));

    // Human "Crusade": each Paladin's holy aura heals every allied unit within
    // 1 tile (Chebyshev, including the Paladin itself) 10% of max HP, and
    // grants a 1-turn "crusadeAura" condition (+2 attack, +1 defense, +25%
    // siege -- read by combat.js's effectiveAttack/effectiveDefense/
    // effectiveSiegePct) refreshed fresh every turn from current positions,
    // same convention as Pillage and Loot above. A unit already touched by
    // one Paladin this turn is skipped for a second so overlapping auras
    // don't double the heal.
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("crusade")) {
      const healed = new Set();
      for (const paladin of civ.units) {
        if (paladin.typeId !== "paladin") continue;
        for (const ally of civ.units) {
          if (healed.has(ally)) continue;
          if (window.GameEngine.influence.chebyshev(paladin.x, paladin.y, ally.x, ally.y) > 1) continue;
          healed.add(ally);
          const crusadeBefore = ally.hp;
          // Minimum 1 HP -- same floor the Heavy Metal/Wellspring Grove
          // auras just below apply to their own smaller 5% heals.
          ally.hp = Math.min(ally.maxHp, ally.hp + Math.max(1, Math.round(ally.maxHp * 0.10)));
          window.GameEngine.floatingText.spawnHealGain(ally, ally.hp - crusadeBefore);
          window.GameEngine.combat.setCondition(ally, "crusadeAura", {
            expiresAtTurn: (gameState.turnNumber || 0) + 1, attackBonus: 2, defenseBonus: 1, siegePctBonus: 0.25,
          });
        }
      }
    }

    // Dwarf "Heavy Metal"/"Power Metal": a Troubadour's aura, same shape as
    // Crusade above -- except the Troubadour can know BOTH techs, in which
    // case exactly one aura is active on it at a time (never both -- see
    // ai.js's maybeSwitchTroubadourAura, the only place unit.activeAura is
    // ever changed). A Troubadour with only one of the two techs always
    // runs that one; "activeAura" only matters once both are known.
    // "Epic Metal" (requires Heavy Metal) widens whichever aura is
    // currently active to a 2-tile radius -- a radius upgrade to "the
    // Troubadour's aura" in general, not tied to one specific aura tech.
    if (civ.unlockedMechanics && (civ.unlockedMechanics.has("heavy_metal") || civ.unlockedMechanics.has("power_metal"))) {
      const hasHeavyMetal = civ.unlockedMechanics.has("heavy_metal");
      const hasPowerMetal = civ.unlockedMechanics.has("power_metal");
      const epicMetal = civ.unlockedMechanics.has("epic_metal");
      const auraRadius = epicMetal ? 2 : 1;
      const healed = new Set();
      for (const troubadour of civ.units) {
        if (troubadour.typeId !== "troubadour") continue;
        // Human-controlled Troubadours: the aura is opt-in/opt-out via the
        // ring menu (see orders.js's contextMenuOptions Carry/Board-style
        // "Activate"/"Deactivate Aura" pills), not automatically on the
        // instant the tech is researched. AI civs are unaffected -- their
        // Troubadour's aura stays always-on; only ai.js's
        // maybeSwitchTroubadourAura ever touches activeAura for them.
        if (civ.isHuman && !troubadour.auraActive) continue;
        const aura = (hasHeavyMetal && hasPowerMetal)
          ? (troubadour.activeAura || "heavy_metal")
          : (hasPowerMetal ? "power_metal" : "heavy_metal");
        for (const ally of civ.units) {
          if (healed.has(ally)) continue;
          if (window.GameEngine.influence.chebyshev(troubadour.x, troubadour.y, ally.x, ally.y) > auraRadius) continue;
          healed.add(ally);
          if (aura === "heavy_metal") {
            const heavyMetalBefore = ally.hp;
            ally.hp = Math.min(ally.maxHp, ally.hp + Math.max(1, Math.round(ally.maxHp * 0.05)));
            window.GameEngine.floatingText.spawnHealGain(ally, ally.hp - heavyMetalBefore);
            window.GameEngine.combat.setCondition(ally, "heavyMetalAura", {
              expiresAtTurn: (gameState.turnNumber || 0) + 1, defenseBonus: 2, siegePctBonus: 0.3,
            });
          } else {
            window.GameEngine.combat.setCondition(ally, "powerMetalAura", {
              expiresAtTurn: (gameState.turnNumber || 0) + 1, attackBonus: 2, firstStrikePctBonus: 0.05,
            });
          }
        }
      }
    }

    // Elf "Wellspring Grove": every city with the building heals every allied
    // unit AND structure (walls/buildings, across every city of this civ, not
    // just the Grove's own) within that city's influence radius 5% of max HP
    // per turn (minimum 1), unconditionally -- regardless of whether a unit
    // is Resting. Dedup via `healed`/`healedStructures` Sets so overlapping
    // Groves never double-heal the same target in one turn, same convention
    // as Crusade/Heavy Metal above.
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("wellspring_grove")) {
      const healed = new Set();
      const healedStructures = new Set();
      for (const grove of civ.cities) {
        if (!window.GameEngine.cities.cityHasStructure(grove, "wellspring_grove")) continue;
        const radius = grove.influenceRadius;
        for (const ally of civ.units) {
          if (healed.has(ally)) continue;
          if (window.GameEngine.influence.chebyshev(grove.x, grove.y, ally.x, ally.y) > radius) continue;
          healed.add(ally);
          const groveBefore = ally.hp;
          ally.hp = Math.min(ally.maxHp, ally.hp + Math.max(1, Math.round(ally.maxHp * 0.05)));
          window.GameEngine.floatingText.spawnHealGain(ally, ally.hp - groveBefore);
        }
        for (const otherCity of civ.cities) {
          for (const s of otherCity.structures) {
            if (healedStructures.has(s)) continue;
            if (window.GameEngine.influence.chebyshev(grove.x, grove.y, s.x, s.y) > radius) continue;
            healedStructures.add(s);
            s.hp = Math.min(s.maxHp, s.hp + Math.max(1, Math.round(s.maxHp * 0.05)));
          }
        }
      }
    }

    // Halfellow "Banish the Darkness": The Great Bonfire's aura -- every
    // allied unit within GREAT_BONFIRE_AURA_RADIUS tiles (Chebyshev,
    // including the Bonfire's own tile) heals 10% of max HP per turn
    // (minimum 1) regardless of resting, and gains a refreshed 1-turn
    // "greatBonfireAura" condition (+2 defense, +2 vision, +1 movement, +5%
    // First Strike, +10% Double Strike -- read by combat.js's
    // effectiveDefense/effectiveFirstStrikePct/effectiveDoubleStrikePct,
    // this function's own visionRadius sum above, and ai.js's
    // computeMovementBudget), same refresh-every-turn convention as
    // Crusade/Heavy Metal above. Also cures AND grants immunity to Burning,
    // Poisoned, Frozen, Curse, Befuddled, and Webbed -- the cure is the
    // explicit clearCondition calls below; the immunity is enforced
    // generically inside combat.js's setCondition (see
    // GREAT_BONFIRE_IMMUNE_CONDITIONS there), which blocks any of those six
    // from being (re-)applied to a unit that currently has this condition.
    // Per-civ singleton (at most one Great Bonfire ever exists for a given
    // civ, see ai.js's startWandererBonfireSummon), so unlike Crusade/Heavy
    // Metal there's no need for a dedup Set -- nothing else can double-apply
    // this aura to the same ally in the same turn.
    {
      const GREAT_BONFIRE_AURA_RADIUS = 4;
      const bonfire = civ.units.find((u) => u.typeId === "great_bonfire");
      if (bonfire) {
        for (const ally of civ.units) {
          if (window.GameEngine.influence.chebyshev(bonfire.x, bonfire.y, ally.x, ally.y) > GREAT_BONFIRE_AURA_RADIUS) continue;
          const bonfireBefore = ally.hp;
          ally.hp = Math.min(ally.maxHp, ally.hp + Math.max(1, Math.round(ally.maxHp * 0.10)));
          if (ally.hp > bonfireBefore) window.GameEngine.floatingText.spawnHealGain(ally, ally.hp - bonfireBefore);
          for (const key of ["burning", "poisoned", "frozen", "curse", "befuddled", "webbed"]) {
            window.GameEngine.combat.clearCondition(ally, key);
          }
          window.GameEngine.combat.setCondition(ally, "greatBonfireAura", {
            expiresAtTurn: (gameState.turnNumber || 0) + 1,
            defenseBonus: 2, visionBonus: 2, movementBonus: 1,
            firstStrikePctBonus: 0.05, doubleStrikePctBonus: 0.10,
          });
        }
      }
    }

    // Tech: lore_per_city (e.g. Human "Common Tongue") -- flat lore scaling
    // with city count. Must be applied to civ.resources BEFORE the
    // stockpile sweep just below: research spends ONLY from the stockpile
    // (see tech.js's chooseResearch), so a bonus added after the sweep
    // would never actually reach it.
    if (civ.lorePerCity) civ.resources.lore += civ.lorePerCity * civ.cities.length;

    // Tech: lore_per_influence_tile (Human "Spirit of Exploration"/
    // "Rivercraft"/"Sea Charts") -- flat lore per tile currently under this
    // civ's influence (tile.status === "owned", same territory definition
    // influence.js's countTerritory uses for the victory tile count) that
    // matches a terrain the civ has unlocked a bonus for. Deliberately
    // civ-wide territory, not cities.js's per-city WORKED-tile radius (see
    // unlock_tile_bonus/tileYieldContribution) -- a tile counts here the
    // instant it's owned, whether or not any city's fill-in radius reaches
    // it. "river" is a pseudo-terrain key (tile.hasRiver, any direction),
    // same convention terrain_movement_discount uses, not a real terrain id.
    // Same place in the turn as lore_per_city just above, and for the same
    // reason: must land in civ.resources before the stockpile sweep just
    // below it, or research spending would never see it.
    if (civ.lorePerInfluenceTile) {
      for (const [terrainKey, value] of Object.entries(civ.lorePerInfluenceTile)) {
        let count = 0;
        for (const tile of map.tiles) {
          if (tile.status !== "owned" || tile.ownerCivId !== civ.id) continue;
          const matches = terrainKey === "river"
            ? !!(tile.hasRiver && (tile.hasRiver.n || tile.hasRiver.s || tile.hasRiver.e || tile.hasRiver.w))
            : tile.terrain === terrainKey;
          if (matches) count++;
        }
        civ.resources.lore += value * count;
      }
    }

    // Running stockpile: accumulate production, then deduct unit upkeep
    civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    civ.stockpile.harvest += civ.resources.harvest;
    civ.stockpile.coin    += civ.resources.coin;
    civ.stockpile.lore    += civ.resources.lore;
    const civRace = window.GameData.getRace(civ.raceId);
    if (!civRace.noUpkeep) {
      for (const unit of civ.units) {
        // Upkeep is derived -- 10% of the unit's raw power, across all 3
        // resources, times tech-layer premium and army-size strain (see
        // GameData.unitUpkeep) -- not a flat stored value.
        const upkeep = window.GameData.unitUpkeep(unit.typeId, civ, unit);
        civ.stockpile.harvest -= upkeep.harvest || 0;
        civ.stockpile.coin    -= upkeep.coin    || 0;
        civ.stockpile.lore    -= upkeep.lore    || 0;
      }
    }

    // Starvation: if stockpile went negative, shrink a city and disband a unit
    if ((civ.stockpile.harvest < 0 || civ.stockpile.coin < 0 || civ.stockpile.lore < 0) && civ.cities.length > 0) {
      const city = civ.cities[Math.floor(Math.random() * civ.cities.length)];
      if (city.population > 1) {
        city.population -= 1;
        city.harvestSurplus = 0;
        // Clamp (not refill) -- starvation is a decline, not a level-up, so
        // this only matters if hp was sitting above the new, smaller max
        // (see combat.js's cityMaxHp, which scales with population).
        city.hp = Math.min(city.hp, window.GameEngine.combat.cityMaxHp(city));
      }
      const disbandable = civ.units.filter(u => u.typeId !== "pioneer" && !u.carriedBy);
      if (disbandable.length > 0) {
        // The human player is asked which unit to lose instead of one
        // vanishing at random with no warning -- see main.js's
        // offerStarvationDisbandChoice, which drains this queue once the
        // round finishes (live unit references, not ids, consumed
        // same-session -- see ai.js's queueUnitBuiltNotice). An AI civ has
        // no one to ask, so it picks randomly.
        if (civ.isHuman) {
          civ.pendingStarvationDisbands = civ.pendingStarvationDisbands || [];
          civ.pendingStarvationDisbands.push({ candidates: disbandable });
        } else {
          const victim = disbandable[Math.floor(Math.random() * disbandable.length)];
          if (victim.carries) victim.carries.carriedBy = null;
          civ.units = civ.units.filter(u => u !== victim);
        }
      }
    }

    // Orc "Bog Spirit" Wisp population cap: the kingdom may field at most
    // one Wisp per living Bog Witch. A Bog Witch can die anywhere --
    // combat, starvation just above, anywhere else -- so rather than hook
    // every individual death site, this re-checks the cap once at the top
    // of the civ's own turn, same "catch it here" timing the starvation
    // check just above uses. Same human/AI split as starvation: the human
    // player picks which Wisp to lose (see main.js's offerNextWispDisband,
    // drained the same way offerNextStarvationDisband is); an AI civ
    // disbands at random, repeatedly, until back under the cap.
    {
      const bogWitchCount = civ.units.filter((u) => u.typeId === "bog_witch").length;
      let wisps = civ.units.filter((u) => u.typeId === "wisp");
      let excess = wisps.length - bogWitchCount;
      if (excess > 0) {
        if (civ.isHuman) {
          civ.pendingWispDisbands = civ.pendingWispDisbands || [];
          for (let i = 0; i < excess; i++) civ.pendingWispDisbands.push({ candidates: wisps });
        } else {
          while (excess > 0 && wisps.length > 0) {
            const victim = wisps[Math.floor(Math.random() * wisps.length)];
            civ.units = civ.units.filter((u) => u !== victim);
            wisps = wisps.filter((u) => u !== victim);
            excess--;
          }
        }
      }
    }

    civ.stockpile.harvest = Math.max(0, civ.stockpile.harvest);
    civ.stockpile.coin    = Math.max(0, civ.stockpile.coin);
    civ.stockpile.lore    = Math.max(0, civ.stockpile.lore);

    const totalLoreTrickleInfluence = civ.cities.reduce((sum, c) => sum + (c.loreInfluenceTrickle || 0), 0);
    civ.lastLoreTrickleInfluence = totalLoreTrickleInfluence;
    // This is purely a turn-count countdown -- research pays its full cost
    // up front from the stockpile when chosen (see tech.js), so there's
    // nothing else for beginCivTurn to hand it each turn.
    const finishedTechId = window.GameEngine.tech.tickResearch(civ);
    if (finishedTechId) civ.lastCompletedTech = finishedTechId; // for the tech-researched dialog

    let aiTurnState = null;
    if (civ.id !== humanCivId) {
      const difficulty = difficultyByCiv[civ.id] || "normal";
      try {
        aiTurnState = window.GameEngine.ai.beginAITurn(civ, gameState, difficulty);
      } catch (err) {
        console.error(`AI turn error for ${civ.id}:`, err);
        civ.lastAILog = [`ERROR: ${err.message}`];
        window.GameEngine.ai.appendAIActionLog(gameState, civ.id, civ.lastAILog);
      }
    } else {
      // tickConditions is what actually removes an expired unit.conditions
      // entry (Defend's x2-defense brace, Frozen, Befuddled, ...) once its
      // expiresAtTurn is reached, and must run here too since the human civ
      // skips beginAITurn (the only other place that calls it, aside from
      // primeUnitForAutomation for automated units) -- without this, a
      // regular human-controlled unit's own Defend click never expires.
      // Mirrors beginAITurn's own per-unit loop, minus the AI-only
      // heuristic resets (_seekingInvasion/_seekingLandmassId) that have no
      // meaning for a player-directed unit.
      const turnNumber = gameState.turnNumber || 0;
      // civMoveMods must be stamped here too, for the same reason: the
      // human civ skips beginAITurn, the only other place unit._moveMods
      // gets stamped, so a player-moved unit would otherwise never have it.
      // Every mods?.xxx read in ai.js's getMoveCost/computeMovementBudget/
      // landCostForTerrain is optional-chained, so nothing crashes -- it
      // just silently evaluates to "no bonus" for terrain-movement techs,
      // terrain-override techs, and mountain-tunneling on every
      // player-moved unit. See ai.js's civMoveMods for the shared shape
      // (also used by beginAITurn and primeUnitForAutomation) and
      // landCostForTerrain for where terrainDiscount/unitTerrainDiscount
      // actually apply.
      const moveMods = window.GameEngine.ai.civMoveMods(civ);
      for (const u of civ.units) {
        u._moveMods = moveMods;
        window.GameEngine.combat.tickConditions(u, turnNumber, map);
        // Same as beginAITurn: a condition can expire lethally (e.g. Human
        // Flight over water) -- remove the unit immediately rather than
        // leaving a 0-hp corpse standing around for something else to trip
        // over later this same turn.
        if (u.hp <= 0) civ.units = civ.units.filter((x) => x !== u);
      }

      // City production isn't an AI behavior, it's a rule of the game, so it
      // must run here even though the human civ skips beginAITurn (see
      // ai.js's maybeBuildInCities). The player still makes the CHOICE of
      // what to build via the sidebar; this only ticks whatever they picked.
      try {
        const buildLog = window.GameEngine.ai.progressBuildQueues(civ, gameState);
        if (buildLog.length) window.GameEngine.ai.appendAIActionLog(gameState, civ.id, buildLog);
      } catch (err) {
        console.error(`Build-queue error for ${civ.id}:`, err);
      }

      // City automation: a city the player
      // flagged `automated` runs one of the three non-production city
      // actions for itself (culture / gather / research -- never a build,
      // see cities.js's runCityAutomation). Runs here, in the same
      // "production is a rule of the game" slot as the build queues just
      // above, and specifically AFTER them so a city with a build already
      // queued is correctly seen as having its production spoken for.
      //
      // Wrapped in its own try so an error in one city's automation can't
      // take down the rest of the human civ's turn setup -- same
      // containment the build-queue tick above already gets.
      try {
        for (const city of civ.cities) {
          if (!city.automated) continue;
          window.GameEngine.cities.runCityAutomation(civ, city, gameState);
        }
      } catch (err) {
        console.error(`City-automation error for ${civ.id}:`, err);
      }
    }

    // humanCivId threaded onto the returned turnCtx purely so finishCivTurn
    // (which doesn't otherwise receive it) can tell whether THIS civ is the
    // human one -- see finishCivTurn's own multi-turn-goto-orders comment
    // for why that step has to live there, not here.
    return { aiTurnState, humanCivId };
  }

  /**
   * Dispatches exactly ONE not-yet-acted AI unit for `civ` via
   * ai.js's stepAIUnit, in civ.units order (creation order). No-op (returns
   * null immediately) for a human-controlled civ -- there's no AI to step,
   * the human plays via direct UI actions instead -- or once beginCivTurn's
   * AI setup failed (aiTurnState null, e.g. it threw). Any exception from
   * stepAIUnit itself aborts the REST of this civ's units too (matching the
   * original single-try-block runCivTurn's all-or-nothing behavior for one
   * civ's whole AI turn), not just the one unit that threw.
   */
  function stepCivTurnUnit(gameState, civ, turnCtx) {
    if (!turnCtx || !turnCtx.aiTurnState) return null;
    try {
      return window.GameEngine.ai.stepAIUnit(civ, gameState, turnCtx.aiTurnState);
    } catch (err) {
      console.error(`AI unit-step error for ${civ.id}:`, err);
      const log = turnCtx.aiTurnState.log || [];
      log.push(`ERROR: ${err.message}`);
      civ.lastAILog = log;
      window.GameEngine.ai.appendAIActionLog(gameState, civ.id, log);
      turnCtx.aiTurnState = null; // stop stepping this civ; finishCivTurn below skips the AI-finish step too
      return null;
    }
  }

  /**
   * Once-per-civ-turn teardown, run once stepCivTurnUnit has returned null
   * (every unit stepped, or AI setup/stepping failed): the one AI decision
   * that has to happen after unit movement (see ai.js's finishAITurn), then
   * healing, Devoted Companions passive heal, and the usedThisTurn/resting
   * reset -- unchanged from the former monolithic runCivTurn, just moved
   * to run once here instead of inline at the end of that one function.
   */
  function finishCivTurn(gameState, civ, turnCtx) {
    if (civ.eliminated) return;
    const { map } = gameState;

    if (turnCtx && turnCtx.aiTurnState) {
      try {
        window.GameEngine.ai.finishAITurn(civ, gameState, turnCtx.aiTurnState);
      } catch (err) {
        console.error(`AI turn error for ${civ.id}:`, err);
        // finishAITurn threw before reaching its own civ.lastAILog/
        // appendAIActionLog assignment (see ai.js) -- recover whatever this
        // civ-turn had already logged rather than losing it, same pattern
        // as stepCivTurnUnit's catch above.
        const log = turnCtx.aiTurnState.log || [];
        log.push(`ERROR: ${err.message}`);
        civ.lastAILog = log;
        window.GameEngine.ai.appendAIActionLog(gameState, civ.id, log);
      }
    }

    // Healing: Rest is now a required explicit action (not automatic for any
    // idle unit) -- only units that chose to Rest this turn (set by AI or the
    // player's Rest button) heal. Runs after the AI turn so this-turn Rest
    // decisions are honored immediately, and after the human's own pre-End-Turn
    // UI actions for the human civ. Excludes channeling === "restAndDefend"
    // -- that gets its own flat-rate heal (see just below) instead of this
    // roll3d6-based one, so a unit can't double-heal on the turn it starts
    // (performRestAndDefend/the AI's Ramparts branch both set unit.resting
    // AND channeling together).
    for (const unit of civ.units) {
      if (!unit.resting || unit.channeling === "restAndDefend") continue;
      const inOwnCity = civ.cities.some((c) => c.x === unit.x && c.y === unit.y);
      const tile = map.tiles[unit.y * map.width + unit.x];
      window.GameEngine.combat.healUnit(unit, civ, inOwnCity, tile);
    }

    // Rest and Defend heal (2026-08-19, user-directed): a flat 20% of
    // maxHp per turn, minimum 1 -- deliberately NOT the generic roll3d6
    // heal above, so the rate is exactly predictable regardless of
    // location/race bonuses. Applies to ANY civ's unit currently
    // channeling restAndDefend (human via main.js's handleRestAndDefend,
    // AI via ai.js's Ramparts branch) -- one rate for the one named
    // action, however it was triggered; the AI branch already re-sets
    // channeling/resting fresh every turn it re-decides to keep resting,
    // same as this needs. Respects race.noHealing (Undead) the same way
    // healUnit does -- resting still isn't how that race heals, so the
    // defensive brace stays available to them without ever ticking HP up
    // (and, by the same token, never auto-stops here on its own either).
    // Auto-stops the moment HP tops out: nothing left for the brace to
    // accomplish, and for the human player clearing channeling here is
    // also what makes the unit reappear as needing orders (see orders.js's
    // isSpent, which treats a truthy channeling as its own "already
    // spent" reason) instead of silently sitting there looking busy
    // forever once there's nothing left to heal. EXCEPT inside one of
    // this civ's own cities (2026-08-19, user-directed): resting there IS
    // garrison duty, a legitimate standing order in its own right that
    // just happens to also heal while it waits -- topping out at full HP
    // doesn't mean the garrison's job is done, so it keeps channeling
    // (still gets the x2 defending bonus, city defense bonuses, etc.)
    // instead of getting kicked back to the player as needing a fresh
    // order every time it finishes healing.
    for (const unit of civ.units) {
      if (unit.channeling !== "restAndDefend") continue;
      const race = window.GameData.getRace(civ.raceId);
      if (!race.noHealing && unit.hp < unit.maxHp) {
        const healAmount = Math.max(1, Math.round(unit.maxHp * 0.20));
        const before = unit.hp;
        unit.hp = Math.min(unit.maxHp, unit.hp + healAmount);
        window.GameEngine.floatingText.spawnHealGain(unit, unit.hp - before);
      }
      const inOwnCity = civ.cities.some((c) => c.x === unit.x && c.y === unit.y);
      if (unit.hp >= unit.maxHp && !inOwnCity) {
        unit.channeling = null;
        unit.resting = false;
      }
    }

    // Tech: Halfellow "Devoted Companions" -- a carried passenger heals
    // automatically every turn (50% faster than normal), independent of
    // Rest entirely (a carried unit can only do nothing or disembark, so it
    // never explicitly Rests on its own).
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("devoted_companions")) {
      for (const unit of civ.units) {
        if (!unit.carriedBy || unit.resting) continue;
        const inOwnCity = civ.cities.some((c) => c.x === unit.x && c.y === unit.y);
        const tile = map.tiles[unit.y * map.width + unit.x];
        window.GameEngine.combat.healUnit(unit, civ, inOwnCity, tile, 1.50);
      }
    }

    // Tech: Halfellow "Forrager" -- gathering channels (Farm Soil/Hunt Game/
    // Fishing) double as foraging: the unit lives off the land while it
    // works, healing a flat 2 HP per turn (not a % of maxHp, unlike Rest
    // and Defend's heal above). Fishing is Galley-only but universal-race,
    // so this gates on the CIV's race (any Halfellow-owned unit), not the
    // unit's typeId.
    if (civ.raceId === "halfellow" && civ.unlockedMechanics && civ.unlockedMechanics.has("forrager")) {
      const race = window.GameData.getRace(civ.raceId);
      for (const unit of civ.units) {
        if (unit.channeling !== "farming" && unit.channeling !== "hunting" && unit.channeling !== "fishing") continue;
        if (race.noHealing || unit.hp >= unit.maxHp) continue;
        const before = unit.hp;
        unit.hp = Math.min(unit.maxHp, unit.hp + 2);
        window.GameEngine.floatingText.spawnHealGain(unit, unit.hp - before);
      }
    }

    // movesRemaining reset alongside usedThisTurn -- see ai.js's
    // spendMovement/computeMovementBudget (project_turn_action_economy
    // memory): a fresh turn means the persisted leftover-movement budget
    // from last turn is stale and must be lazily recomputed on first use.
    for (const unit of civ.units) {
      unit.usedThisTurn = false; unit.resting = false; unit.movesRemaining = null;
    }

    // Multi-turn goto orders: MUST run here,
    // after the reset immediately above, not in beginCivTurn (tried first,
    // and wrong -- see the 2026-08-06 fix note below). The human civ plays
    // via direct UI clicks at any point while the game is sitting idle
    // between End Turn presses, which is BEFORE this civ's own
    // beginCivTurn/finishCivTurn pair for the round ever runs -- those
    // only fire once the player actually clicks End Turn and the round-
    // robin reaches this civ's slot. So by the time THIS code runs, the
    // units' usedThisTurn/movesRemaining already reflect whatever the
    // player just did by hand, not a fresh budget -- advancing a goto
    // order here, BEFORE that reset, kept finding movesRemaining already
    // spent and immediately cancelling the order as "blocked" the very
    // first time it should have continued. Reset FIRST, then continue,
    // fixes it: this now runs with a genuinely fresh budget, consumes some
    // of it automatically, and leaves whatever's left for the player's own
    // next round of clicks -- same moment an AI unit gets re-decided every
    // round. See orders.js's advanceGotoOrder for what "one turn's worth
    // of progress" means.
    if (turnCtx && civ.id === turnCtx.humanCivId) {
      for (const unit of civ.units) {
        if (!unit.gotoTarget) continue;
        try {
          window.GameEngine.orders.advanceGotoOrder(unit, gameState);
        } catch (err) {
          console.error(`Goto-order error for unit ${unit.id} (${civ.id}):`, err);
          unit.gotoTarget = null;
        }
      }
      // Sentry / Follow: same "persisted order,
      // re-evaluated fresh every turn" shape and hook point as the goto
      // orders just above -- see orders.js's advanceSentryOrder/
      // advanceFollowOrder.
      for (const unit of civ.units) {
        if (!unit.sentry) continue;
        try {
          window.GameEngine.orders.advanceSentryOrder(unit, gameState);
        } catch (err) {
          console.error(`Sentry-order error for unit ${unit.id} (${civ.id}):`, err);
          unit.sentry = false;
        }
      }
      for (const unit of civ.units) {
        if (!unit.followTarget) continue;
        try {
          window.GameEngine.orders.advanceFollowOrder(unit, gameState);
        } catch (err) {
          console.error(`Follow-order error for unit ${unit.id} (${civ.id}):`, err);
          unit.followTarget = null;
        }
      }
    }

    // Rest and Defend: a standing "defending" brace (see main.js's
    // handleRestAndDefend) that must be kept alive every turn without
    // asking the player -- re-stamps the condition fresh each round so it
    // never lapses to its nominal 1-turn expiry on its own. Unlike the old
    // separate Garrison action this replaced (2026-08-19, user-directed
    // merge), this is NOT cancelled by leaving a city -- Rest and Defend now
    // persists anywhere; standing in one of this civ's own cities while
    // channeling additionally grants that city's defensive bonuses (see
    // cities.js's tickCity and ai.js's tickWallDefense/tickMageTowerDefense).
    if (turnCtx && civ.id === turnCtx.humanCivId) {
      for (const unit of civ.units) {
        if (unit.channeling !== "restAndDefend") continue;
        window.GameEngine.combat.setCondition(unit, "defending", { expiresAtTurn: (gameState.turnNumber || 0) + 1 });
      }
    }

    // Automate Actions: same lifecycle slot as
    // the goto-order continuation just above, and for the same reason -- a
    // fresh usedThisTurn/movesRemaining budget must exist before an
    // automated unit's AI-reused decision logic runs. Units already mid
    // multi-turn goto/channel, or already holding a pendingIntent awaiting
    // player confirmation, are skipped by runAutomatedUnitTurn itself.
    if (turnCtx && civ.id === turnCtx.humanCivId) {
      const log = civ.lastAILog || [];
      for (const unit of civ.units) {
        if (!unit.automated) continue;
        try {
          window.GameEngine.ai.runAutomatedUnitTurn(civ, unit, gameState, log);
        } catch (err) {
          console.error(`Automate Actions error for unit ${unit.id} (${civ.id}):`, err);
        }
      }
    }
  }

  /**
   * Full, non-granular civ-turn: begin -> step every AI unit -> finish, all
   * in one synchronous call -- unchanged end-to-end behavior from the
   * former monolithic runCivTurn. Used by `runTurn` (looped over every civ).
   * Spectator mode's finer, visible one-unit-at-a-time pacing instead uses
   * advanceOneUnitStep, which drives beginCivTurn/stepCivTurnUnit/
   * finishCivTurn directly, one unit per call.
   */
  function runCivTurn(gameState, civ, opts = {}) {
    const turnCtx = beginCivTurn(gameState, civ, opts);
    if (!turnCtx) return; // eliminated
    while (stepCivTurnUnit(gameState, civ, turnCtx)) { /* one unit per iteration, in creation order */ }
    finishCivTurn(gameState, civ, turnCtx);
  }

  /**
   * Once-per-round history sample for the Report menu's line-graph views
   * (see ui/reports.js): one point per civ per round, appended in lockstep
   * with `gameState.history.turns`. Influence is tile count (same source as
   * the sidebar's Territory Share); military power is the flat sum of
   * GameData.unitPower across a civ's units -- the same context-free "power"
   * concept build cost/upkeep already use, not the AI's tactical
   * unitCombatPower scoring heuristic. An eliminated civ reads 0 from here
   * on, rather than stopping -- so its line just flatlines instead of
   * vanishing from the chart.
   */
  function recordHistory(gameState) {
    gameState.history = gameState.history || { turns: [], civs: {} };
    const { counts } = window.GameEngine.influence.countTerritory(gameState);
    const monsterCivId = window.GameConfig.worldEncounters.monsters.civId;
    for (const civId of Object.keys(gameState.civs)) {
      // The "MONSTERS" pseudo-civ isn't a kingdom -- excluded so it doesn't
      // show up as a stray line on the Report menu's per-civ graphs.
      if (civId === monsterCivId) continue;
      const civ = gameState.civs[civId];
      const rec = gameState.history.civs[civId] = gameState.history.civs[civId] || { influence: [], power: [] };
      rec.influence.push(civ.eliminated ? 0 : (counts[civId] || 0));
      const power = civ.eliminated ? 0
        : civ.units.reduce((sum, u) => sum + window.GameData.unitPower(u.typeId), 0);
      rec.power.push(power);
    }
    gameState.history.turns.push(gameState.turnNumber || 0);
  }

  /**
   * Once-per-round teardown, run after every civ has taken its turn:
   * elimination check, victory check, turn counter advance. Shared by
   * `runTurn` and `advanceOneUnitStep`.
   *
   * Wall Defense and Mage Tower's once-per-round scans run HERE, after
   * every civ (including Wandering Monsters) has already moved and acted
   * this round -- so a check sees this round's real final positions,
   * catching a monster that approached, attacked, and retreated all in the
   * same round. Runs before checkElimination so a kill lands in time for
   * this same round's elimination/victory checks.
   */
  function endRound(gameState) {
    for (const civ of Object.values(gameState.civs)) {
      if (civ.eliminated) continue;
      window.GameEngine.ai.tickWallDefense(gameState, civ);
      window.GameEngine.ai.tickMageTowerDefense(gameState, civ);
    }
    checkElimination(gameState);
    const victoryResult = checkVictory(gameState);
    recordHistory(gameState);
    gameState.turnNumber = (gameState.turnNumber || 0) + 1;
    return { victoryResult };
  }

  /** Runs one full game turn for every civ. `difficulty` keyed per civId for AI civs. */
  function runTurn(gameState, opts = {}) {
    beginRound(gameState);
    const order = gameState.turnOrder || Object.keys(gameState.civs);
    for (const civId of order) {
      const civ = gameState.civs[civId];
      if (!civ) continue;
      runCivTurn(gameState, civ, opts);
    }
    return endRound(gameState);
  }

  /**
   * Finer-grained alternative to `runTurn`: advances exactly ONE
   * unit's turn per call, in civ.units order (creation order -- see ai.js's
   * runUnitTurn), instead of a whole civ resolving at once. This is what
   * lets spectator mode visibly show AI units acting one at a time, in the
   * order they were created, rather than a civ's entire army moving/
   * fighting in one instant flash between redraws.
   *
   * Driven by `gameState.turnOrder`/`turnStepIndex` plus a
   * `gameState._civTurnCtx` holding the in-progress civ's turnCtx
   * (beginCivTurn's return value) across calls while that civ's units are
   * being stepped one at a time -- cleared the instant that civ's turn
   * finishes. Must not be mixed with `runTurn` on the
   * same gameState mid-round (both drive `turnStepIndex`; only one driving
   * loop should ever be in flight for a given gameState at a time). `_civTurnCtx` is
   * transient, in-memory-only scratch state -- see savegame.js, which
   * strips it before serializing (a Set inside it doesn't survive a JSON
   * round-trip with reference identity intact, and there's nothing useful
   * to resume from a save anyway; a reload always starts clean at the top
   * of whichever civ was mid-turn).
   *
   * Returns { steppedCivId, steppedUnit, roundComplete, victoryResult } --
   * `steppedUnit` is the actual unit object just acted on (or null on a
   * call that only finished a civ's turn / advanced past an eliminated
   * civ / completed the round, none of which stepped a real unit).
   */
  function advanceOneUnitStep(gameState, opts = {}) {
    const order = gameState.turnOrder || Object.keys(gameState.civs);
    if (!(gameState.turnStepIndex > 0) && !gameState._civTurnCtx) {
      gameState.turnStepIndex = 0;
      beginRound(gameState);
    }

    while (gameState.turnStepIndex < order.length) {
      const civId = order[gameState.turnStepIndex];
      const civ = gameState.civs[civId];
      if (!civ || civ.eliminated) { gameState.turnStepIndex++; continue; }

      if (!gameState._civTurnCtx) {
        gameState._civTurnCtx = beginCivTurn(gameState, civ, opts);
        if (!gameState._civTurnCtx) { gameState.turnStepIndex++; continue; } // shouldn't happen (already checked eliminated) -- defensive
      }

      const steppedUnit = stepCivTurnUnit(gameState, civ, gameState._civTurnCtx);
      if (steppedUnit) {
        return { steppedCivId: civId, steppedUnit, roundComplete: false, victoryResult: null };
      }

      // No more units to step for this civ (or nothing to step at all, e.g.
      // the human civ, or a civ with zero units) -- finish it and move on,
      // all within this same call.
      finishCivTurn(gameState, civ, gameState._civTurnCtx);
      gameState._civTurnCtx = null;
      gameState.turnStepIndex++;
    }

    const { victoryResult } = endRound(gameState);
    gameState.turnStepIndex = 0;
    gameState._civTurnCtx = null;
    return { steppedCivId: null, steppedUnit: null, roundComplete: true, victoryResult };
  }

  /**
   * Marks a civ eliminated and cleans up everything that would otherwise
   * linger: its remaining field units (a dead civ has no cities left to
   * project influence, so stray raiders/galleys that survived the last siege
   * are removed rather than wandering on as an ownerless army) and any tile
   * still crediting it as owner (reverted to neutral immediately instead of
   * waiting on the normal contested-grace-period decay). Shared by
   * checkElimination below (the general per-turn sweep) AND ai.js's siege
   * code (which detects "that was their last city" immediately at the
   * moment of destruction, not just on the next sweep) so both paths behave
   * identically -- a civ can be eliminated from either place.
   *
   * Also queues a "kingdom eliminated" announcement (2026-08-17,
   * user-directed) -- put here, the one place both elimination paths
   * already funnel through, rather than duplicated at each call site, so
   * neither can forget it. gameState.pendingKingdomEliminations is a plain
   * array of civIds -- JSON-safe, no savegame.js special-casing needed
   * (unlike gameState._civTurnCtx) -- drained one at a time by main.js's
   * redraw() into a "message" dialog. This engine layer has no concept of
   * "the human player" at all (a civId here is just a civId -- spectator
   * games have no human civ), so every elimination is queued unconditionally;
   * main.js's own drain step is what skips the entry when it happens to be
   * humanCivId, since that case already gets its own richer, dedicated Game
   * Over screen (see openGameOverDialog/finishRoundBookkeeping's humanLost
   * branch) instead of this generic announcement.
   */
  function eliminateCiv(gameState, civ) {
    civ.eliminated = true;
    civ.units = [];
    for (const tile of gameState.map.tiles) {
      if (tile.ownerCivId === civ.id) {
        tile.ownerCivId = null;
        tile.status = "neutral";
        tile.contestedTurns = 0;
      }
    }
    gameState.pendingKingdomEliminations = gameState.pendingKingdomEliminations || [];
    gameState.pendingKingdomEliminations.push(civ.id);
  }

  function checkElimination(gameState) {
    // Two independent ways to be eliminated:
    //  1. Founded at least one city, then lost every city (siege -- see
    //     combat.js attackCity / cities.js destroyCity). `hasFoundedCity` is
    //     what distinguishes this from a civ still on its very first
    //     Settler, zero cities, before it's had a chance to found anything --
    //     without that guard this incorrectly matched every civ's NORMAL
    //     starting state and eliminated the whole roster after turn 1 (found
    //     via integration testing: a 50-turn run produced zero cities across
    //     all civs, traced down to this exact check).
    //  2. Never founded a city AND has no units left either -- a total wipe
    //     before ever getting off the ground.
    // The "MONSTERS" pseudo-civ (see doc/world_encounters_design.md) is
    // explicitly excluded: it permanently has zero cities and, between
    // spawns, often zero units too -- rule 2 above would otherwise
    // eliminate it almost immediately, after which beginCivTurn's own
    // `if (civ.eliminated) return null;` would silently stop its units from
    // ever taking a turn again, even ones spawned in later. It's never a
    // real kingdom, so it's never a real elimination.
    const monsterCivId = window.GameConfig.worldEncounters.monsters.civId;
    for (const civ of Object.values(gameState.civs)) {
      if (civ.eliminated || civ.id === monsterCivId) continue;
      const lostAllCitiesEverFounded = civ.hasFoundedCity && civ.cities.length === 0;
      const wipedBeforeFounding = civ.cities.length === 0 && civ.units.length === 0;
      if (lostAllCitiesEverFounded || wipedBeforeFounding) {
        eliminateCiv(gameState, civ);
      }
    }
  }

  /** Elimination victory only: true once exactly one non-Monster civ remains
   *  un-eliminated. The "MONSTERS" pseudo-civ (see
   *  doc/world_encounters_design.md) is excluded from both allCivs and
   *  survivors -- it's permanently non-eliminated (see checkElimination's
   *  own comment above), so without this exclusion there would always be at
   *  least 2 "survivors" (the last real civ plus Monsters) and elimination
   *  victory could never trigger at all.
   *
   *  Pure -- no side effects, unlike checkVictory's territorial branch below
   *  (which mutates gameState.victoryTracking's once-per-round sustain-turns
   *  streak) -- so this is safe to call at ANY point mid-round, not just
   *  from endRound's once-per-round sweep. See ai.js's
   *  considerAttackOrGarrison, which calls this immediately at the moment a
   *  city's destruction eliminates its civ (2026-08-17, user-directed:
   *  "when a city is destroyed, immediately check for military victory"),
   *  rather than waiting for endRound to eventually notice on its own
   *  schedule -- letting a human player find out only after clicking End
   *  Turn, sometimes several of their own actions later. Returns
   *  { winner, type: "elimination" } or null. */
  function checkEliminationVictory(gameState) {
    const monsterCivId = window.GameConfig.worldEncounters.monsters.civId;
    const allCivs = Object.values(gameState.civs).filter((civ) => civ.id !== monsterCivId);
    const survivors = allCivs.filter((civ) => !civ.eliminated);
    if (allCivs.length > 1 && survivors.length === 1) {
      return { winner: survivors[0].id, type: "elimination" };
    }
    return null;
  }

  function checkVictory(gameState) {
    // Elimination victory: last civ standing wins immediately, regardless of
    // influence share -- no point requiring a territory threshold once every
    // rival has been wiped out entirely. See checkEliminationVictory just
    // above (also called independently, mid-round, the instant a
    // destruction causes it).
    const eliminationResult = checkEliminationVictory(gameState);
    if (eliminationResult) return eliminationResult;

    // "Keep Fighting!" (2026-08-26, user-directed): set once a single-player
    // human declines a territorial win from main.js's showVictorySequence --
    // permanently disables territorial victory for the rest of THIS game, so
    // only Elimination (checked above) can end it from here on.
    if (gameState.disableTerritorialVictory) return null;

    // Territorial victory is an ABSOLUTE tile count (2026-08-25), not a share
    // of the map -- see config.js's victory.tileTarget for why. `counts` is
    // now a plain owned-tile tally (every tile weighs 1), so this compares
    // directly against the target with no denominator involved.
    const { counts, totalClaimable } = window.GameEngine.influence.countTerritory(gameState);
    let leadingCiv = null, leadingTiles = 0;
    for (const [civId, count] of Object.entries(counts)) {
      if (count > leadingTiles) { leadingTiles = count; leadingCiv = civId; }
    }

    gameState.victoryTracking = gameState.victoryTracking || {};
    if (leadingTiles >= victoryTileTarget()) {
      gameState.victoryTracking[leadingCiv] = (gameState.victoryTracking[leadingCiv] || 0) + 1;
      // Reset any other civ's streak
      for (const civId of Object.keys(gameState.victoryTracking)) {
        if (civId !== leadingCiv) gameState.victoryTracking[civId] = 0;
      }
      if (gameState.victoryTracking[leadingCiv] >= victorySustainTurns()) {
        // `share` is kept in the result purely for display (the victory
        // screen still likes to say what fraction of the world that was).
        return {
          winner: leadingCiv, type: "territory",
          tiles: leadingTiles,
          share: totalClaimable > 0 ? leadingTiles / totalClaimable : 0,
        };
      }
    } else {
      for (const civId of Object.keys(gameState.victoryTracking)) gameState.victoryTracking[civId] = 0;
    }
    return null;
  }

  window.GameEngine.turns = {
    refreshVisibility,
    beginRound,
    beginCivTurn,
    stepCivTurnUnit,
    finishCivTurn,
    runCivTurn,
    endRound,
    runTurn,
    advanceOneUnitStep,
    checkVictory,
    checkEliminationVictory,
    eliminateCiv,
    bankChannelStash,
    scheduleResourceRespawn,
    revealMapFragment,
  };

  // Live getters, not plain values -- see the note at the top of this module.
  // Consumers keep reading `turns.VICTORY_TILE_TARGET` exactly as before; the
  // property just resolves against config each time instead of being frozen
  // at load, so retuning victory.tileTarget takes effect immediately.
  Object.defineProperty(window.GameEngine.turns, "VICTORY_TILE_TARGET", {
    get: victoryTileTarget, enumerable: true,
  });
  Object.defineProperty(window.GameEngine.turns, "VICTORY_SUSTAIN_TURNS", {
    get: victorySustainTurns, enumerable: true,
  });
})();
