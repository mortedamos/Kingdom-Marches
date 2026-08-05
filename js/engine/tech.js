/**
 * TECH RESEARCH ENGINE
 * --------------------
 * A tech's full Lore cost (GameData.effectiveTechCost -- pure tier-based,
 * see techs.js) is paid up front from the civ's stockpile the moment
 * chooseResearch picks it, then civ.researchTurnsRemaining counts down a
 * fixed timer (researchTurns, derived from that same cost) until it
 * completes and applyTechEffects fires -- the same one-time-purchase-plus-
 * timer model GameData.unitBuildCost/ai.js's unitBuildTurns already use for
 * units and buildings. See techs.js for the node data and effect types.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  /** City gate: a layer-L tech requires the civ to own at least L cities. */
  function meetsCityGate(civ, tech) {
    return civ.cities.length >= (tech.layer || 0);
  }

  function availableTechs(civ) {
    const racePool = window.GameData.techsForRace(civ.raceId);
    return racePool.filter((id) => {
      if (civ.completedTechs.has(id)) return false;
      const tech = window.GameData.getTech(id);
      if (!meetsCityGate(civ, tech)) return false;
      return tech.prereqs.every((p) => civ.completedTechs.has(p));
    });
  }

  /**
   * Lowest tech.layer (city requirement) among this civ's not-yet-completed
   * techs whose prereqs are ALL satisfied but which are blocked purely by
   * the city-count gate. Returns null if nothing is currently gate-blocked
   * (either everything researchable is available, or the next steps are
   * still blocked by prereqs rather than city count).
   *
   * Used by ai.js's chooseStrategy to recognize "we can't progress down the
   * tech tree because we don't have enough cities yet" and bias toward
   * settling instead of just stalling on research.
   */
  function nextGatedTechLayer(civ) {
    const racePool = window.GameData.techsForRace(civ.raceId);
    let lowest = null;
    for (const id of racePool) {
      if (civ.completedTechs.has(id)) continue;
      const tech = window.GameData.getTech(id);
      if (meetsCityGate(civ, tech)) continue;
      if (!tech.prereqs.every((p) => civ.completedTechs.has(p))) continue;
      if (lowest === null || tech.layer < lowest) lowest = tech.layer;
    }
    return lowest;
  }

  // Same rate shape as ai.js's buildingBuildTurns (industriousness alone --
  // research is a civilian pursuit, not a military one, so militarism
  // doesn't factor in the way it does for raceUnitBuildRate). Shares
  // GameConfig.pacing.slowness with ai.js's BUILD_SLOWNESS now (2026-08-04,
  // user-directed) -- one universal pacing knob for every timed queue in
  // the game, not a separate rate per subsystem.
  function researchTurns(civ, tech) {
    const race = window.GameData.getRace(civ.raceId);
    const industriousness = race.industriousness ?? 0.5;
    const cost = window.GameData.effectiveTechCost(tech);
    return Math.max(1, Math.round((cost / industriousness) * window.GameConfig.pacing.slowness));
  }

  /** Counts down one turn on the civ's in-progress research (2026-08-04,
   *  user-directed redesign: research now pays its FULL Lore cost up front
   *  via chooseResearch below -- same one-time-purchase model as a unit or
   *  building queue -- rather than accumulating progress from Lore income
   *  turn by turn, so this is now purely a turn-count timer with nothing
   *  left to spend here. Lore income still fills civ.stockpile.lore exactly
   *  as before (turns.js's beginCivTurn) -- that's what funds the NEXT
   *  tech's up-front payment, just no longer wired directly into this
   *  function. */
  function tickResearch(civ) {
    if (!civ.currentResearch) return null;
    civ.researchTurnsRemaining = Math.max(0, (civ.researchTurnsRemaining || 0) - 1);
    if (civ.researchTurnsRemaining <= 0) {
      const tech = window.GameData.getTech(civ.currentResearch);
      civ.completedTechs.add(tech.id);
      applyTechEffects(civ, tech);
      const finishedId = civ.currentResearch;
      civ.currentResearch = null;
      civ.researchTotalTurns = 0;
      return finishedId;
    }
    return null;
  }

  function applyTechEffects(civ, tech) {
    civ.civicInfluenceBonus = civ.civicInfluenceBonus || 0;
    civ.unlockedUnits = civ.unlockedUnits || new Set();
    civ.unlockedBuildings = civ.unlockedBuildings || new Set();
    civ.radiusBonus = civ.radiusBonus || 0;
    civ.governanceAvailable = civ.governanceAvailable || false;
    civ.harvestPctBonus = civ.harvestPctBonus || 0;
    civ.coinFromHarvestPct = civ.coinFromHarvestPct || 0;
    civ.siegeAttackBonus = civ.siegeAttackBonus || 0;
    civ.raidKillBonus = civ.raidKillBonus || { harvest: 0, coin: 0, lore: 0 };
    civ.terrainMoveOverride = civ.terrainMoveOverride || {}; // { terrainId: cappedCost }
    civ.terrainMoveBonus = civ.terrainMoveBonus || {};       // { terrainId: extraMovement }
    civ.canTunnelMountains = civ.canTunnelMountains || false;
    civ.unlockedMechanics = civ.unlockedMechanics || new Set();
    civ.mechanicValues = civ.mechanicValues || {};    // { mechanicId: numericValue }
    civ.lorePerCity = civ.lorePerCity || 0;
    civ.unlockedTileBonuses = civ.unlockedTileBonuses || {};       // { terrainId: {harvest,coin,lore} }
    civ.unlockedFeatureBonuses = civ.unlockedFeatureBonuses || {}; // { river|ruin|road: {harvest,coin,lore} }
    civ.unitOverrides = civ.unitOverrides || {}; // { unitTypeId: {attack,defense,movement,visionRadius,firstStrikePct,doubleStrikePct,siegePct,garrisonDefenseBonus} }
    civ.unitTerrainMoveBonus = civ.unitTerrainMoveBonus || {}; // { unitTypeId: { terrainId: extraMovement } }
    civ.deathLoreBonus = civ.deathLoreBonus || 0;
    civ.raiseDeadResistance = civ.raiseDeadResistance || 0;
    civ.siegePropertyBonus = civ.siegePropertyBonus || 0;
    civ.doubleStrikePropertyBonus = civ.doubleStrikePropertyBonus || 0; // civ-wide +Double Strike (see combat.js effectiveDoubleStrikePct)
    civ.universalRangeGrant = civ.universalRangeGrant || 0; // floor on every unit's effective Ranged (see combat.js effectiveRange)
    civ.buildingCountBonus = civ.buildingCountBonus || {}; // { harvest|coin|lore: perBuildingValue } -- see cities.js's per-building-count yield
    civ.fillRateMult = civ.fillRateMult || 1; // multiplies advanceCityFill's per-turn progress (e.g. Halfellow Community Fellowship)

    for (const effect of tech.effects) {
      switch (effect.type) {
        case "civic_influence_bonus":
          civ.civicInfluenceBonus += effect.value;
          break;
        case "radius_bonus":
          civ.radiusBonus += effect.value;
          for (const city of civ.cities) city.extraRadiusBonus += effect.value;
          break;
        case "unlock_unit":
          civ.unlockedUnits.add(effect.unit);
          break;
        case "unlock_building":
          civ.unlockedBuildings.add(effect.building);
          break;
        case "governance_unlock":
          civ.governanceAvailable = true;
          break;
        case "harvest_pct_bonus":
          civ.harvestPctBonus += effect.value;
          break;
        case "coin_from_harvest_pct":
          civ.coinFromHarvestPct += effect.value;
          break;
        case "siege_attack_bonus":
          civ.siegeAttackBonus += effect.value;
          break;
        case "raid_kill_bonus":
          civ.raidKillBonus.harvest += effect.harvest || 0;
          civ.raidKillBonus.coin += effect.coin || 0;
          civ.raidKillBonus.lore += effect.lore || 0;
          break;
        case "ignore_terrain_penalty":
          // Caps movement cost onto this terrain to 1 (removes the penalty entirely)
          civ.terrainMoveOverride[effect.terrain] = 1;
          break;
        case "terrain_movement_bonus":
          civ.terrainMoveBonus[effect.terrain] = (civ.terrainMoveBonus[effect.terrain] || 0) + effect.value;
          break;
        case "unit_terrain_movement_bonus":
          for (const unitId of effect.units) {
            const existing = civ.unitTerrainMoveBonus[unitId] || {};
            existing[effect.terrain] = (existing[effect.terrain] || 0) + effect.value;
            civ.unitTerrainMoveBonus[unitId] = existing;
          }
          break;
        case "death_lore_bonus":
          civ.deathLoreBonus += effect.value;
          break;
        case "raise_dead_resistance":
          civ.raiseDeadResistance = Math.min(1, civ.raiseDeadResistance + effect.value);
          break;
        case "siege_property_bonus":
          civ.siegePropertyBonus += effect.value;
          break;
        case "double_strike_property_bonus":
          civ.doubleStrikePropertyBonus += effect.value;
          break;
        case "universal_range_grant":
          // Floor, not additive -- see effectiveRange in combat.js. Max
          // (not overwrite) so a second such tech, if one's ever added,
          // can't accidentally lower an already-granted value.
          civ.universalRangeGrant = Math.max(civ.universalRangeGrant, effect.value);
          break;
        case "unlock_mountain_tunneling":
          civ.canTunnelMountains = true;
          break;
        case "unlock_mechanic":
          civ.unlockedMechanics.add(effect.mechanic);
          if (effect.value != null) civ.mechanicValues[effect.mechanic] = effect.value;
          break;
        case "lore_per_city":
          civ.lorePerCity += effect.value;
          break;
        case "unlock_tile_bonus": {
          const existing = civ.unlockedTileBonuses[effect.terrain] || {};
          for (const [k, v] of Object.entries(effect.bonus)) existing[k] = (existing[k] || 0) + v;
          civ.unlockedTileBonuses[effect.terrain] = existing;
          break;
        }
        case "unlock_feature_bonus": {
          const existing = civ.unlockedFeatureBonuses[effect.feature] || {};
          for (const [k, v] of Object.entries(effect.bonus)) existing[k] = (existing[k] || 0) + v;
          civ.unlockedFeatureBonuses[effect.feature] = existing;
          break;
        }
        case "building_count_bonus": {
          // Per-city flat yield scaling with how many buildings (not walls)
          // that city has built -- see cities.js's computeWorkedTileYield.
          for (const [k, v] of Object.entries(effect.bonus)) {
            civ.buildingCountBonus[k] = (civ.buildingCountBonus[k] || 0) + v;
          }
          break;
        }
        case "fill_rate_mult":
          // Multiplies advanceCityFill's per-turn tile-fill progress (cities.js).
          civ.fillRateMult *= effect.value;
          break;
        case "garrison_defense_bonus": {
          const ov = civ.unitOverrides[effect.unit] || {};
          ov.garrisonDefenseBonus = (ov.garrisonDefenseBonus || 0) + effect.value;
          civ.unitOverrides[effect.unit] = ov;
          break;
        }
        case "replace_unit":
          civ.unlockedUnits.delete(effect.from);
          civ.unlockedUnits.add(effect.to);
          break;
        case "unit_stat_upgrade": {
          const ov = civ.unitOverrides[effect.unit] || {};
          for (const [k, v] of Object.entries(effect.changes)) {
            // attack/defense/movement/visionRadius/range are additive deltas;
            // firstStrikePct/doubleStrikePct/siegePct are overrides (not
            // additive) -- note combat.js still adds the override on top of
            // the unit's own BASE value, so a tech setting 0.05 here means
            // "+5 percentage points", not "5% flat".
            if (k === "attack" || k === "defense" || k === "movement" || k === "visionRadius" || k === "range") ov[k] = (ov[k] || 0) + v;
            else ov[k] = v;
          }
          civ.unitOverrides[effect.unit] = ov;
          break;
        }
        default:
          console.warn(`[tech] Unknown effect type "${effect.type}" on tech "${tech.id}"`);
      }
    }
  }

  /** Sets a civ's research target -- gated on affordability now, not just
   *  city/prereq gates (2026-08-04, user-directed): the tech's full Lore
   *  cost is paid up front from civ.stockpile.lore the moment this
   *  succeeds, same as queueBuild pays a unit/building's cost up front.
   *  Returns false (no-op, nothing charged) if the civ can't afford it yet.
   *
   *  Switching targets while something is already in progress FORFEITS
   *  whatever Lore was paid for the abandoned tech -- no refund -- same
   *  no-refund policy orders.js's cancelBuild already documents for an
   *  abandoned unit/building queue. This is a real behavior change from the
   *  old income-accumulation model, where researchProgress was one shared
   *  pool and switching targets lost nothing; paying up front means a
   *  switch now has a real cost, matching how changing your mind about a
   *  queued build already worked. */
  function chooseResearch(civ, techId) {
    if (civ.completedTechs.has(techId)) return false;
    const tech = window.GameData.getTech(techId);
    if (!meetsCityGate(civ, tech)) return false;
    if (!tech.prereqs.every((p) => civ.completedTechs.has(p))) return false;
    const cost = window.GameData.effectiveTechCost(tech);
    civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    if (civ.stockpile.lore < cost) return false;
    civ.stockpile.lore -= cost;
    civ.currentResearch = techId;
    civ.researchTotalTurns = researchTurns(civ, tech);
    civ.researchTurnsRemaining = civ.researchTotalTurns;
    return true;
  }

  window.GameEngine.tech = {
    availableTechs,
    nextGatedTechLayer,
    tickResearch,
    applyTechEffects,
    chooseResearch,
    researchTurns,
    meetsCityGate,
  };
})();
