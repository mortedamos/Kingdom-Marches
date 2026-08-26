/**
 * TECH RESEARCH ENGINE
 * --------------------
 * A tech's full cost -- split across harvest/coin/lore by its column (see
 * GameData.effectiveTechCostBreakdown), with the TOTAL magnitude pure
 * tier-based (GameData.effectiveTechCost, see techs.js) -- is paid up front
 * from the civ's stockpile the moment chooseResearch picks it, then
 * civ.researchTurnsRemaining counts down a fixed timer (researchTurns,
 * derived from that same total) until it completes and applyTechEffects
 * fires -- the same one-time-purchase-plus-timer model
 * GameData.unitBuildCost/ai.js's unitBuildTurns already use for units and
 * buildings. See techs.js for the node data and effect types.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  /** City gate: a layer-L tech requires the civ to own at least L cities.
   *  Level 0 techs (layer: 0, e.g. hunt_game/farm_soil) pass this at ZERO
   *  cities -- `0 >= 0` holds even for a brand-new civ, matching Level 0's
   *  "before your first city" flavor (moot for the always-auto-completed
   *  ones, but real for hunt_game/farm_soil if ever re-researched after
   *  losing the mechanic somehow). `?? 0`, not `|| 0` -- both happen to
   *  agree when layer is exactly 0 (0 || 0 === 0 ?? 0), but `??` is the
   *  correct operator on principle, matching every other layer-fallback
   *  fix in techs.js (2026-08-06). */
  function meetsCityGate(civ, tech) {
    return civ.cities.length >= (tech.layer ?? 0);
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

  /** True if there's at least one tech the civ could actually start
   *  researching RIGHT NOW -- gates/prereqs met (availableTechs) AND
   *  affordable from the current stockpile (effectiveTechCostBreakdown).
   *  Used by main.js's end-turn "unresolved work" guard so a civ that can't
   *  afford anything yet isn't nagged with "No research selected" every
   *  turn. */
  function hasAffordableResearch(civ) {
    const stock = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    return availableTechs(civ).some((id) => {
      const cost = window.GameData.effectiveTechCostBreakdown(window.GameData.getTech(id));
      return cost.harvest <= (stock.harvest || 0) && cost.coin <= (stock.coin || 0) && cost.lore <= (stock.lore || 0);
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

  // Table-driven (2026-08-21) -- see config.js's pacing.researchTurnsByLayer
  // doc comment for the table itself and its provenance. Reads
  // pacing.speedLevelIndex LIVE (not snapshotted) so a game-speed change
  // takes effect immediately. industriousness still scales turns up/down
  // from the table's baselineIndustriousness reference, same "higher
  // industriousness -> fewer turns" relationship the old cost/rate formula
  // had (research is a civilian pursuit, not a military one, so militarism
  // doesn't factor in the way it does for ai.js's raceUnitBuildRate). The
  // actual harvest/coin/lore price paid still comes from the unmodified,
  // linear effectiveTechCost -- only the TURN-COUNT curve is table-driven.
  function researchTurns(civ, tech) {
    const race = window.GameData.getRace(civ.raceId);
    const industriousness = race.industriousness ?? 0.5;
    const P = window.GameConfig.pacing;
    const speedIdx = P.speedLevelIndex ?? 2;
    const table = P.researchTurnsByLayer[tech.layer] ?? P.researchTurnsByLayer[P.researchTurnsByLayer.length - 1];
    const baseTurns = table[speedIdx];
    // industriousnessDampExponent: see config.js's own doc comment -- an
    // exponent on the ratio, not a flat multiplier, so it compresses the
    // whole curve smoothly rather than clamping the extremes.
    const ratio = Math.pow(P.baselineIndustriousness / industriousness, P.industriousnessDampExponent);
    return Math.max(1, Math.round(baseTurns * ratio));
  }

  /** Counts down one turn on the civ's in-progress research. Research pays
   *  its full cost up front via chooseResearch below -- same one-time-
   *  purchase model as a unit or building queue -- so this is purely a
   *  turn-count timer. Harvest/coin/lore income still fills civ.stockpile
   *  as usual (turns.js's beginCivTurn), funding the NEXT tech's up-front
   *  payment (see GameData.effectiveTechCostBreakdown). */
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

  /** "Research" city ring action: cuts `amount`
   *  turns off the civ's in-progress research outright, called from
   *  cities.js's applyResearchBoost (which decides WHETHER a city may spend
   *  its turn this way; this just does the civ-level countdown). Completes
   *  the tech immediately -- same effects-application/currentResearch-clear
   *  tickResearch does on a natural countdown to zero -- rather than leaving
   *  it at 0 for the next turn's tick to notice, so the player sees the
   *  payoff the instant they spend the turn on it. Returns null if there's
   *  no research in progress to cut (the caller already checks this, but
   *  re-checked here too since this is the function actually touching
   *  civ.researchTurnsRemaining). */
  function reduceResearchTurns(civ, amount) {
    if (!civ.currentResearch) return null;
    civ.researchTurnsRemaining = Math.max(0, (civ.researchTurnsRemaining || 0) - amount);
    if (civ.researchTurnsRemaining > 0) {
      return { amount, completed: false, techId: civ.currentResearch,
        techLabel: window.GameData.getTech(civ.currentResearch).label };
    }
    const tech = window.GameData.getTech(civ.currentResearch);
    civ.completedTechs.add(tech.id);
    applyTechEffects(civ, tech);
    civ.currentResearch = null;
    civ.researchTotalTurns = 0;
    return { amount, completed: true, techId: tech.id, techLabel: tech.label };
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
    civ.terrainMoveDiscount = civ.terrainMoveDiscount || {}; // { terrainId: costReduction } -- see ai.js's landCostForTerrain
    civ.unitTerrainMoveDiscount = civ.unitTerrainMoveDiscount || {}; // { unitTypeId: { terrainId: costReduction } }
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
    civ.lorePerInfluenceTile = civ.lorePerInfluenceTile || {}; // { terrainId|"river": perOwnedTileValue } -- see turns.js's beginCivTurn

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
        // terrain_movement_discount/unit_terrain_movement_discount
        //: the replacement for the two cases
        // just above on every tech that used to grant a movement BONUS --
        // see techs.js's own effect-type doc comment for why (a bonus only
        // ever applied once, to whichever tile the unit happened to START
        // its turn standing on; a discount applies to every tile of the
        // matching terrain crossed all turn, which is what "movement feels
        // wrong" turned out to actually be about). Same accumulation shape
        // as their bonus counterparts, just into the Discount maps
        // ai.js's landCostForTerrain reads instead of computeMovementBudget.
        case "terrain_movement_discount":
          civ.terrainMoveDiscount[effect.terrain] = (civ.terrainMoveDiscount[effect.terrain] || 0) + effect.value;
          break;
        case "unit_terrain_movement_discount":
          for (const unitId of effect.units) {
            const existing = civ.unitTerrainMoveDiscount[unitId] || {};
            existing[effect.terrain] = (existing[effect.terrain] || 0) + effect.value;
            civ.unitTerrainMoveDiscount[unitId] = existing;
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
        case "lore_per_influence_tile":
          // Flat lore per OWNED tile of a matching terrain -- every tile
          // under this civ's influence/territory, not just tiles a city is
          // actively working (contrast unlock_tile_bonus above). "river" is
          // a pseudo-terrain key here too (tile.hasRiver, any direction),
          // same convention terrain_movement_discount uses -- see turns.js's
          // beginCivTurn for where this is actually totaled up each turn.
          civ.lorePerInfluenceTile[effect.terrain] =
            (civ.lorePerInfluenceTile[effect.terrain] || 0) + effect.value;
          break;
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
   *  city/prereq gates: the tech's full cost is
   *  paid up front from civ.stockpile the moment this succeeds, same as
   *  queueBuild pays a unit/building's cost up front. Returns false (no-op,
   *  nothing charged) if the civ can't afford it yet.
   *
   *  Multi-resource: a tech's cost used to be
   *  pure Lore; now split across harvest/coin/lore by category (see
   *  GameData.effectiveTechCostBreakdown) -- ALL THREE must be affordable,
   *  not just Lore, same all-or-nothing convention chooseResearch's
   *  city/prereq gates already use.
   *
   *  Switching targets while something is already in progress FORFEITS
   *  whatever was paid for the abandoned tech -- no refund -- same
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
    const cost = window.GameData.effectiveTechCostBreakdown(tech);
    civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    if (civ.stockpile.harvest < cost.harvest || civ.stockpile.coin < cost.coin || civ.stockpile.lore < cost.lore) return false;
    civ.stockpile.harvest -= cost.harvest;
    civ.stockpile.coin -= cost.coin;
    civ.stockpile.lore -= cost.lore;
    civ.currentResearch = techId;
    civ.researchTotalTurns = researchTurns(civ, tech);
    civ.researchTurnsRemaining = civ.researchTotalTurns;
    return true;
  }

  /** Layer-1 techs available to civ's race, not yet completed -- the pool
   *  offered as a free choice the moment a civ founds its FIRST city (see
   *  cities.js's foundCity for the AI grant, main.js's openFoundCityDialog
   *  for the human dialog). Deliberately layer === 1 exactly, not <=1 --
   *  every Level 0 tech is already auto-completed at civ creation (see
   *  main.js's createNewGame), so there's nothing for this free grant to
   *  add there. */
  function firstCityTechChoices(civ) {
    return window.GameData.techsForRace(civ.raceId).filter((id) => {
      if (civ.completedTechs.has(id)) return false;
      return window.GameData.getTech(id).layer === 1;
    });
  }

  /** Grants `techId` for free -- bypasses meetsCityGate/prereqs/Lore cost
   *  entirely, the same one-time "force complete" pathway main.js's civ
   *  creation already uses for every Level 0 tech. Caller's responsibility
   *  to only pass a real, not-yet-completed tech id (see
   *  firstCityTechChoices). */
  function grantFreeTech(civ, techId) {
    civ.completedTechs.add(techId);
    applyTechEffects(civ, window.GameData.getTech(techId));
  }

  /** AI's pick among firstCityTechChoices for the free first-city tech
   *  grant -- a light "most immediately impactful" heuristic (most
   *  effects), not ai.js's full doctrine-weighted scoreNextResearch, since
   *  this fires the instant a civ's first city exists, often before
   *  strategy.js has settled on that civ's doctrine. Returns null if the
   *  civ's race has no Layer-1 techs left to offer (shouldn't happen in
   *  practice -- every race has several -- but keeps this safe to call
   *  unconditionally). */
  function pickFreeTierOneTech(civ) {
    const candidates = firstCityTechChoices(civ);
    if (candidates.length === 0) return null;
    let best = null, bestScore = -Infinity;
    for (const id of candidates) {
      const score = window.GameData.getTech(id).effects.length;
      if (score > bestScore) { bestScore = score; best = id; }
    }
    return best;
  }

  window.GameEngine.tech = {
    availableTechs,
    hasAffordableResearch,
    nextGatedTechLayer,
    tickResearch,
    reduceResearchTurns,
    applyTechEffects,
    chooseResearch,
    researchTurns,
    meetsCityGate,
    firstCityTechChoices,
    grantFreeTech,
    pickFreeTierOneTech,
  };
})();
