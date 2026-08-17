/**
 * INFLUENCE / TERRITORY ENGINE
 * ------------------------------
 * The core mechanic of the whole game. Every tile accumulates influence
 * per civ (from city radius falloff + units standing on/near it); a civ
 * owns a tile only if its share >= 2/3. Otherwise Contested or Neutral.
 * See realms_of_influence_design_doc.md §2 for full rationale.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  const TERRAIN = window.GameData.TERRAIN;
  // Tuning lives in js/data/config.js -- see its INFLUENCE section for what
  // each of these does and what changing it costs.
  const CFG = window.GameConfig.influence;
  // "Spread Culture" city action (cities.js's applyCultureSpread) -- its
  // multiplier lives in the CITY config section since every other Spread
  // Culture tuning knob (cost) does too; read directly rather than
  // duplicating it here.
  const CULTURE_SPREAD_INFLUENCE_MULT = window.GameConfig.city.cultureSpreadInfluenceMult;
  const OWNERSHIP_THRESHOLD = CFG.ownershipThreshold;
  const CONTESTED_GRACE_TURNS = CFG.contestedGraceTurns;
  const LOW_VALUE_TERRAIN_WEIGHT = CFG.lowValueTerrainWeight; // water (ocean+coast) and tundra

  // Structure own-tile claim: "building a wall or
  // building automatically puts that tile under the kingdom's influence."
  // Deliberately a flat value large enough to swamp any realistic rival
  // influence on that same tile (baseCityInfluence tops out at population *
  // industriousnessInfluenceMult, comfortably under this even very late-game),
  // rather than a proportional bonus -- a structure standing on a tile is
  // meant to be an unconditional claim, not "usually" enough. Matters most for
  // walls, which prefer ring-2 (Chebyshev distance 2 from the city) and can
  // sit OUTSIDE a low-tier city's own influenceRadius entirely -- see
  // cities.js's findStructureSlot -- so without this a freshly-built wall
  // tile could otherwise stay neutral/contested indefinitely.
  const STRUCTURE_OWN_TILE_INFLUENCE = 10000;

  /** Chebyshev (square) distance -- the metric used everywhere in this design */
  function chebyshev(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
  }

  /**
   * City influence falloff: full strength at distance 0-1, ~60% at the
   * city's radius edge, 0 beyond radius+1.
   */
  function cityInfluenceFalloff(distance, radius) {
    if (distance <= 1) return 1.0;
    if (distance > radius + 1) return 0.0;
    // linear interpolation from 1.0 at distance=1 down to ~0 at radius+1,
    // passing through ~0.6 at distance=radius (per design doc's spec)
    const t = (distance - 1) / (radius);
    return Math.max(0, 1.0 - t * CFG.cityFalloffDecay);
  }

  /**
   * Computes, for every tile, the influence each civ projects onto it
   * this turn. Returns a Map<tileIdx, Map<civId, influenceValue>>.
   */
  function computeInfluenceMap(gameState) {
    const { map, civs } = gameState;
    const influenceByTile = new Map();

    function addInfluence(tileIdx, civId, amount) {
      if (amount <= 0) return;
      if (!influenceByTile.has(tileIdx)) influenceByTile.set(tileIdx, new Map());
      const civMap = influenceByTile.get(tileIdx);
      civMap.set(civId, (civMap.get(civId) || 0) + amount);
    }

    // --- City influence (passive, primary) ---
    for (const civ of Object.values(civs)) {
      if (civ.eliminated) continue;
      const race = window.GameData.getRace(civ.raceId);
      for (const city of civ.cities) {
        const radius = city.influenceRadius;
        // Structure influence multiplier (Grand Forum, Cursed Obelisk, etc.), 1.0 if none
        // civicInfluenceBonus accumulates from completed civic techs (e.g. +5%, +10%)
        // cultureSpreadTurn: "Spread Culture" city action (cities.js's
        // applyCultureSpread) -- a paid, ONE-TURN boost, unlike the two
        // multipliers above which are permanent. Naturally stops applying
        // once turnNumber moves past the stamped turn, no explicit clear step.
        const cultureBoost = city.cultureSpreadTurn === (gameState.turnNumber || 0)
          ? CULTURE_SPREAD_INFLUENCE_MULT : 1.0;
        const baseStrength = city.baseCityInfluence * (city.buildingInfluenceMult || 1.0)
          * (1 + (civ.civicInfluenceBonus || 0)) * cultureBoost;
        // Strictly bounded by the radius: no influence ever projects beyond
        // the radius square (the old "soft falloff edge" at radius+1 was
        // removed along with the fill-in mechanic -- see cities.js
        // advanceCityFill, which only ever fills tiles within the radius).
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const tx = city.x + dx, ty = city.y + dy;
            if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
            const dist = chebyshev(city.x, city.y, tx, ty);
            const falloff = cityInfluenceFalloff(dist, radius);
            if (falloff <= 0) continue;
            const tileIdx = ty * map.width + tx;
            const tile = map.tiles[tileIdx];
            // Fill-in mechanic (see cities.js): a tile only projects influence
            // once this city has actually filled it in. (Deep ocean is a
            // legal fill/claim target too, same as any other tile -- see
            // countTerritory's WATER_OR_TUNDRA_WEIGHT below.)
            if (!window.GameEngine.cities.isOffsetFilled(city, dx, dy)) continue;

            let strength = baseStrength * falloff;

            // Elf: forest-conditional influence multiplier (race redesign doc §2)
            if (race.forestInfluenceCoefficient) {
              const forestDensity = computeForestDensity(map, tx, ty);
              strength *= 1.0 + race.forestInfluenceCoefficient * forestDensity;
            }

            addInfluence(tileIdx, civ.id, strength);
          }
        }
      }
    }

    // --- Structures (buildings/walls) always claim their own tile -- see
    // STRUCTURE_OWN_TILE_INFLUENCE above for why this needs to be a flat,
    // dominant value rather than folded into the radius/fill-in math above.
    for (const civ of Object.values(civs)) {
      if (civ.eliminated) continue;
      for (const city of civ.cities) {
        for (const s of city.structures) {
          addInfluence(s.y * map.width + s.x, civ.id, STRUCTURE_OWN_TILE_INFLUENCE);
        }
      }
    }

    // --- Dark Ritual (Undead): a qualifying unit stationed 2+ consecutive
    // turns on a ruin instantly projects influence across its whole 1-tile
    // radius. Vanishes the instant the unit moves off the ruin or dies (both
    // simply stop it from appearing here, since _ritualTurns resets to 0 in
    // turns.js and dead units leave civ.units). This influence feeds into the
    // exact same resolveOwnership/countTerritory pipeline as city influence
    // below -- any tile it wins ownership of already counts toward the 33%
    // territorial victory condition with no special-casing needed.
    for (const civ of Object.values(civs)) {
      if (civ.eliminated) continue;
      if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("dark_ritual")) continue;
      for (const unit of civ.units) {
        if ((unit._ritualTurns || 0) < 2) continue;
        const strength = unitMilitaryInfluenceBase(unit) * 2;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const tx = unit.x + dx, ty = unit.y + dy;
            if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
            const tileIdx = ty * map.width + tx;
            addInfluence(tileIdx, civ.id, strength);
          }
        }
      }
    }

    // --- Dungeon Delve (Human Wizard): unlike Dark Ritual above, a qualifying
    // Wizard does NOT instantly project influence across its whole radius --
    // it claims tiles gradually over time, exactly like a city's own
    // filled-in mechanic (see cities.js's advanceCityFill/isOffsetFilled;
    // the wizard's own progress/filled-set is tracked per-unit in
    // _delveFillProgress/_delveFilledOffsets, advanced once per turn in
    // turns.js's runCivTurn). Only offsets that have actually filled in
    // project any influence at all. Moving off the ruin or dying wipes the
    // whole filled set instantly (see turns.js's beginRound) -- unlike a
    // city, none of this is permanent.
    for (const civ of Object.values(civs)) {
      if (civ.eliminated) continue;
      if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("dungeon_delve")) continue;
      for (const unit of civ.units) {
        // Any unit type can hold a delve claim. Kept in sync with turns.js's
        // own payout gate.
        if ((unit._ritualTurns || 0) < 1) continue;
        const filled = unit._delveFilledOffsets;
        if (!filled || filled.size === 0) continue;
        const strength = unitMilitaryInfluenceBase(unit) * 2;
        for (const key of filled) {
          const [dx, dy] = key.split(",").map(Number);
          const tx = unit.x + dx, ty = unit.y + dy;
          if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
          const tileIdx = ty * map.width + tx;
          addInfluence(tileIdx, civ.id, strength);
        }
      }
    }

    // --- Orc "Pillage and Loot": only while an Orc unit is standing within
    // some OTHER civ's city radius (raiding range, not anywhere on the map),
    // it projects a zone of terror in a 2-tile (Chebyshev) radius around
    // itself that nullifies every OTHER civ's (already filled-in) influence
    // there entirely -- its own civ's influence is untouched. Gated fresh
    // every turn on the unit's current position (see the tech's own wording:
    // "lasts until the unit moves ... or leaves the enemy city's radius"),
    // so there's nothing to track between turns -- moving off, or the enemy
    // city itself dying, simply stops the effect being reapplied. Deleting
    // the entry rather than subtracting a fixed amount means overlapping Orc
    // units produce exactly the same result as one -- the effect does not stack.
    //
    // Merged from the former standalone
    // "Campaign of Terror" tech into Pillage and Loot -- see that tech's
    // comment in techs.js. Radius raised 1->2 and a resolveOwnership bug
    // fixed (see its own comment) in the same pass that made this mechanic
    // actually demote OWNED tiles, not just already-contested ones --
    // previously a near-total no-op against stable enemy territory, its
    // actual intended target.
    //
    // Also now records how many tiles each unit ACTUALLY suppressed this
    // turn (i.e. tiles that had a real enemy influence entry to delete, not
    // every tile in radius regardless of content) onto
    // `unit._pillageTilesSuppressed` -- transient, recomputed fresh every
    // round, same convention as `_ritualTurns` elsewhere in this codebase.
    // `beginRound` (turns.js) calls this BEFORE any civ's `runCivTurn`, so
    // by the time turns.js's Pillage and Loot resource-grant reads this
    // field later in the same round, it reflects the current turn's real
    // suppression count -- that's what turns the resource payout from a
    // flat +1/+1/+1 into +1 of each resource PER suppressed tile.
    for (const civ of Object.values(civs)) {
      if (civ.eliminated) continue;
      if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("pillage_and_loot")) continue;
      for (const unit of civ.units) {
        unit._pillageTilesSuppressed = 0;
        const nearEnemyCity = Object.values(civs).some((otherCiv) => {
          if (otherCiv.id === civ.id || otherCiv.eliminated) return false;
          return otherCiv.cities.some((city) => chebyshev(unit.x, unit.y, city.x, city.y) <= city.influenceRadius);
        });
        if (!nearEnemyCity) continue;
        let suppressedCount = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const tx = unit.x + dx, ty = unit.y + dy;
            if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
            const civMap = influenceByTile.get(ty * map.width + tx);
            if (!civMap) continue;
            let suppressedThisTile = false;
            for (const otherCivId of Array.from(civMap.keys())) {
              if (otherCivId !== civ.id) { civMap.delete(otherCivId); suppressedThisTile = true; }
            }
            if (suppressedThisTile) suppressedCount++;
          }
        }
        unit._pillageTilesSuppressed = suppressedCount;
      }
    }

    return influenceByTile;
  }

  function unitMilitaryInfluenceBase(unit) {
    const atk = window.GameData.getUnit(unit.typeId).attack;
    return Math.max(1, atk * 0.8);
  }

  function computeForestDensity(map, x, y) {
    let forestCount = 0, total = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        total++;
        if (map.tiles[ny * map.width + nx].terrain === "forest") forestCount++;
      }
    }
    return total > 0 ? forestCount / total : 0;
  }


  /**
   * Resolves ownership for every tile given this turn's influence map.
   * Mutates tile.ownerCivId, tile.contestedTurns per the design doc's §2.2-2.3 rules.
   */
  function resolveOwnership(gameState, influenceByTile) {
    const { map } = gameState;
    for (let i = 0; i < map.tiles.length; i++) {
      const tile = map.tiles[i];

      const civMap = influenceByTile.get(i);
      if (!civMap || civMap.size === 0) {
        // No influence at all this turn -- decay any existing owned/contested
        // state. Bug fix (2026-07-14): previously only decayed a tile already
        // in "contested" status, so an OWNED tile that suddenly lost all
        // influence (e.g. Orc's Campaign of Terror deleting the sole
        // enemy-influence entry there) fell through this whole branch
        // untouched -- ownerCivId/status never changed, so the tile kept
        // paying full yield in cities.js's computeWorkedTileYield forever
        // regardless of the suppression. Now starts the same grace-period
        // countdown from "owned" too, not just "contested" -- a tile needs
        // CONTESTED_GRACE_TURNS consecutive turns of zero influence either
        // way before it actually flips to neutral. See
        // project_pairwise_balance_human_orc_halfellow memory.
        if (tile.ownerCivId && (tile.status === "contested" || tile.status === "owned")) {
          tile.status = "contested";
          tile.contestedTurns = (tile.contestedTurns || 0) + 1;
          if (tile.contestedTurns >= CONTESTED_GRACE_TURNS) {
            tile.ownerCivId = null;
            tile.status = "neutral";
            tile.contestedTurns = 0;
          }
        }
        continue;
      }

      let total = 0;
      let leader = null, leaderAmount = -1;
      for (const [civId, amount] of civMap) {
        total += amount;
        if (amount > leaderAmount) { leaderAmount = amount; leader = civId; }
      }
      const share = total > 0 ? leaderAmount / total : 0;

      if (share >= OWNERSHIP_THRESHOLD) {
        tile.ownerCivId = leader;
        tile.status = "owned";
        tile.contestedTurns = 0;
      } else if (tile.ownerCivId === leader || tile.status === "contested") {
        // Plurality holder keeps a grace period before fully losing the tile
        tile.ownerCivId = leader;
        tile.status = "contested";
        tile.contestedTurns = (tile.contestedTurns || 0) + 1;
        if (tile.contestedTurns >= CONTESTED_GRACE_TURNS) {
          tile.ownerCivId = null;
          tile.status = "neutral";
          tile.contestedTurns = 0;
        }
      } else {
        tile.ownerCivId = leader;
        tile.status = "contested";
        tile.contestedTurns = 1;
      }

      tile.influenceShares = civMap; // stored for UI tooltip display
    }
  }

  /** Counts owned tiles per civ -- the actual victory-condition number.
   *  Every tile is claimable, including deep ocean and tundra -- ordinary
   *  land counts fully, while water (ocean+coast) and tundra each count for
   *  only LOW_VALUE_TERRAIN_WEIGHT (25%) of a normal tile, both in a civ's
   *  owned count and in the total claimable pool (so the victory-share
   *  denominator reflects their lower ceiling too, not just the numerator).
   *  Deep ocean is no longer a special-cased "permanently unclaimable"
   *  terrain -- see the isDeepWater exclusions removed from
   *  computeInfluenceMap/resolveOwnership/cities.js's advanceCityFill (and
   *  the Dungeon Delve/Prospector's Claim fill loops in turns.js) -- it now
   *  receives influence, fills in, and gets owned exactly like any other tile.
   *  Dwarf "Council of the Deep": once unlocked, every owned tile this civ
   *  holds counts as 1.25x toward this total -- deliberately ONLY here (the
   *  victory-condition tally), not a real yield/influence multiplier
   *  anywhere else, per the tech's own wording. Stacks multiplicatively with
   *  the low-value weight (e.g. an owned Coast tile = 0.25*1.25 = 0.3125). */
  function countTerritory(gameState) {
    const counts = {};
    for (const civId of Object.keys(gameState.civs)) counts[civId] = 0;
    let totalClaimable = 0;
    for (const tile of gameState.map.tiles) {
      const t = TERRAIN[tile.terrain];
      const baseWeight = (t.isWater || tile.terrain === "tundra") ? LOW_VALUE_TERRAIN_WEIGHT : 1;
      totalClaimable += baseWeight;
      if (tile.status === "owned" && tile.ownerCivId) {
        const ownerCiv = gameState.civs[tile.ownerCivId];
        const councilBonus = (ownerCiv && ownerCiv.unlockedMechanics && ownerCiv.unlockedMechanics.has("council_of_the_deep")) ? 1.25 : 1;
        counts[tile.ownerCivId] = (counts[tile.ownerCivId] || 0) + baseWeight * councilBonus;
      }
    }
    return { counts, totalClaimable };
  }

  window.GameEngine.influence = {
    chebyshev,
    cityInfluenceFalloff,
    computeInfluenceMap,
    resolveOwnership,
    countTerritory,
    computeForestDensity,
    OWNERSHIP_THRESHOLD,
  };
})();
