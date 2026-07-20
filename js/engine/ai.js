/**
 * AI ENGINE
 * ---------
 * Utility/scoring AI: each turn, enumerate candidate actions, score them
 * using race weights + aggressiveness, execute the highest-scoring ones
 * within budget. See realms_of_influence_ai_behavior.md and the AI action
 * mechanics addendum for full design rationale.
 *
 * This is informationally limited like a human player would be in a real
 * game -- AI only considers what's within its own civ's currently-owned
 * territory or unit/city vision, never the full map state.
 *
 * Unit carrying: units use `carriedBy` (ref to carrying unit, or null) and
 * `carries` (ref to carried unit, or null). Currently only galleys carry
 * pioneers, but the fields are generic for future carrier types.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  // Halfellow-specific: "fight smarter as they grow more capable" -- each
  // completed military-category tech nudges effective militarism up a
  // little, on top of their otherwise-low racial trait. 11 possible Halfellow
  // military techs * this constant = +0.33 at the very top of their tree,
  // meaningful without swamping the base trait (Halfellow militarism 0.2).
  const HALFELLOW_MILITARISM_PER_MILITARY_TECH = 0.03;

  // Set once per civ-turn at the top of runAITurn. A module-level cache
  // rather than threading gameState/turnNumber through every movement helper
  // (moveUnitToward, pioneerRoadStep, ...) purely so hidden-condition reveals
  // deep in those call stacks can stamp an accurate forcedVisible expiry
  // (see combat.js's revealHidden) without a large signature-plumbing change.
  let currentTurnNumber = 0;
  // Same rationale as currentTurnNumber above -- lets moveUnitToward/
  // pioneerRoadStep fire a maybeQuip (which wants gameState for logging)
  // without threading gameState through their many call sites.
  let currentGameStateRef = null;

  /** race.militarism plus any civ-wide bonus earned so far. Every militarism
   *  read in this file should go through this rather than race.militarism
   *  directly.
   *  - civ.militarismBonus: generic flat bump, for any future tech/mechanic
   *    on any race that wants one (nothing sets this yet).
   *  - Halfellow specifically also gets a per-completed-military-tech bump
   *    (see HALFELLOW_MILITARISM_PER_MILITARY_TECH) -- computed fresh from
   *    civ.completedTechs each call rather than incrementally maintained, so
   *    it can never drift out of sync with what's actually been researched. */
  function effectiveMilitarism(civ) {
    const race = window.GameData.getRace(civ.raceId);
    const base = race.militarism ?? 0.5;
    let bonus = civ.militarismBonus || 0;
    if (civ.raceId === "halfellow" && civ.completedTechs) {
      let militaryTechCount = 0;
      for (const techId of civ.completedTechs) {
        const tech = window.GameData.TECHS[techId];
        if (tech && tech.category === "military") militaryTechCount++;
      }
      bonus += militaryTechCount * HALFELLOW_MILITARISM_PER_MILITARY_TECH;
    }
    return Math.min(1, base + bonus);
  }

  /**
   * Derives AI action weights from a race's personality traits.
   * Traits (0–1) live in races.js; this converts them to multipliers
   * centered around 1.0 so existing scoring formulas still make sense.
   *
   * Trait → weight mapping:
   *   expansionism    → settle   (0.2 → 0.6,  1.0 → 1.5)
   *   industriousness → build    (0.2 → 0.6,  1.0 → 1.5)
   *   curiosity       → research (0.2 → 0.6,  1.0 → 1.5)
   *   curiosity       → explore  (0.2 → 0.6,  1.0 → 1.5) -- see explorePostureFor
   *                                for how this is weighed against military need
   *   aggressiveness  → attack / raid
   *   militarism      → garrison (used in build scoring and garrison hold logic)
   */
  function racialWeights(civ) {
    const race = window.GameData.getRace(civ.raceId);
    const agg = aggressivenessFor(civ);
    const trait = (t) => 0.4 + (t ?? 0.5) * 1.1; // maps 0→0.4, 0.5→0.95, 1→1.5
    return {
      settle:   trait(race.expansionism),
      build:    trait(race.industriousness),
      research: trait(race.curiosity),
      attack:   0.3 + agg * 1.2,
      raid:     agg * 1.8,
      garrison: trait(effectiveMilitarism(civ)),
      explore:  trait(race.curiosity),
    };
  }

  /** Returns true if any visible contested tile or enemy unit is within
   *  radius of this civ's cities — used for threat-gated military scoring. */
  function detectThreat(civ, gameState) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const RADIUS = 8;
    for (const city of civ.cities) {
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        for (let dx = -RADIUS; dx <= RADIUS; dx++) {
          const x = city.x + dx, y = city.y + dy;
          if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
          const idx = y * map.width + x;
          if (!visible.has(idx)) continue;
          const tile = map.tiles[idx];
          if (tile.status === "contested") return true;
          if (tile.status === "owned" && tile.ownerCivId && tile.ownerCivId !== civ.id) return true;
        }
      }
      for (const other of Object.values(civs)) {
        if (other.id === civ.id || other.eliminated) continue;
        for (const u of other.units) {
          if (!visible.has(u.y * map.width + u.x) || u.conditions?.hidden) continue;
          if (window.GameEngine.influence.chebyshev(u.x, u.y, city.x, city.y) <= RADIUS) return true;
        }
      }
    }
    return false;
  }

  /**
   * Computes, for every landmass with at least one claimable tile, whether
   * this civ owns the MAJORITY (>50%) of that landmass's claimable tiles
   * (a distinct, land-only definition from influence.js's countTerritory --
   * this heuristic is specifically "have I secured my home GROUND", so water
   * and tundra are excluded here even though countTerritory now counts them
   * at reduced weight for the territorial victory tally). Returns a
   * Map<landmassId, boolean>. Called once per civ-turn
   * from runAITurn (civ._landmassMajority) rather than per-unit -- a full
   * tile scan is cheap done once, expensive done for every idle unit.
   * Read by chooseBuildAction (extra-galley scoring) and seekOverseasInvasion
   * (idle military/pioneers heading overseas once home ground is secured).
   */
  function computeLandmassMajority(civ, gameState) {
    const { map } = gameState;
    const totals = new Map(), owned = new Map();
    for (const tile of map.tiles) {
      const lm = tile.landmassId;
      if (lm < 0) continue;
      const terrain = window.GameData.TERRAIN[tile.terrain];
      if (terrain.isWater || tile.terrain === "tundra") continue;
      totals.set(lm, (totals.get(lm) || 0) + 1);
      if (tile.status === "owned" && tile.ownerCivId === civ.id) {
        owned.set(lm, (owned.get(lm) || 0) + 1);
      }
    }
    const result = new Map();
    for (const [lm, total] of totals) {
      result.set(lm, total > 0 && (owned.get(lm) || 0) / total > 0.5);
    }
    return result;
  }

  /**
   * Decides whether a KNOWN foreign landmass is worth a coordinated group
   * crossing rather than the default one-unit-at-a-time trickle (which is
   * how a solo unit ends up ferried straight into a defended shore and wiped,
   * one at a time, forever -- the "island civ can't make headway" problem).
   * A foreign landmass only counts if this civ has EVER seen a city there
   * (gameState.tileMemory -- cities don't move, so remembering one is safe)
   * AND currently sees real defending strength there RIGHT NOW
   * (gameState.visibility -- unlike a city, troop positions go stale the
   * instant they're out of sight, so a remembered garrison can't be used
   * here). Returns { landmassId, enemyPower } for the strongest such
   * landmass whose currently-visible defense is at least half this civ's
   * own total military strength (a "significant force," not a token
   * garrison not worth massing up for) -- or null. Read by computeGalleyNeed
   * (pre-position a small fleet) and operateGalley (land everyone on the
   * same beach instead of wherever's nearest to each individual galley).
   */
  function assessInvasionTarget(civ, gameState) {
    const { map, civs } = gameState;
    const memory = gameState.tileMemory[civ.id] || {};
    const visible = gameState.visibility[civ.id] || new Set();

    const homeLandmassIds = new Set();
    for (const city of civ.cities) {
      const ct = map.tiles[city.y * map.width + city.x];
      if (ct && ct.landmassId >= 0) homeLandmassIds.add(ct.landmassId);
    }

    const knownForeignLandmasses = new Set();
    for (const idxStr of Object.keys(memory)) {
      const rec = memory[idxStr];
      if (!rec.city || rec.city.raceId === civ.raceId) continue; // raceId, not civId -- races are 1:1 with civs in this game
      const tile = map.tiles[Number(idxStr)];
      if (tile && tile.landmassId >= 0 && !homeLandmassIds.has(tile.landmassId)) {
        knownForeignLandmasses.add(tile.landmassId);
      }
    }
    if (knownForeignLandmasses.size === 0) return null;

    let best = null;
    for (const landmassId of knownForeignLandmasses) {
      let enemyPower = 0;
      for (const other of Object.values(civs)) {
        if (other.id === civ.id || other.eliminated) continue;
        for (const u of other.units) {
          if (u.carriedBy || u.hp <= 0) continue;
          const tile = map.tiles[u.y * map.width + u.x];
          if (!tile || tile.landmassId !== landmassId) continue;
          if (!visible.has(u.y * map.width + u.x)) continue; // stale positions don't count
          enemyPower += unitCombatPower(u, other);
        }
      }
      if (enemyPower > 0 && (!best || enemyPower > best.enemyPower)) best = { landmassId, enemyPower };
    }
    if (!best) return null;

    const ownPower = civ.units.reduce((sum, u) => sum + unitCombatPower(u, civ), 0);
    if (best.enemyPower < ownPower * 0.5) return null; // too weak to bother grouping up for
    return best;
  }

  const MAX_GALLEYS = 3;
  // A large stranded backlog should be able to grow the fleet past the
  // MAX_GALLEYS baseline instead of hard-stopping there forever -- see
  // computeGalleyNeed's galleyCap. One extra galley wanted per
  // BACKLOG_PER_GALLEY backlogged units, capped at GALLEY_FLEET_CEILING so a
  // civ still doesn't sink its whole economy into an oversized navy.
  const BACKLOG_PER_GALLEY = 4;
  const GALLEY_FLEET_CEILING = 8;

  /**
   * Shared galley-need assessment, read by both chooseBuildAction (build
   * another when the fleet is undersized) and maybeDisband (disband a surplus
   * one). `galleyCount` includes queued-but-not-yet-built galleys so both
   * callers see a consistent, up-to-date figure. `overseasBacklog` counts idle
   * land units (military + pioneers, not already aboard something) sitting on
   * a landmass this civ controls the majority of (see computeLandmassMajority)
   * -- these want to cross the sea (see seekOverseasInvasion / the pioneer
   * embark check in maybeFoundCity) but each galley can only ferry one
   * passenger at a time. `galleyCap` is how big the fleet is allowed to grow
   * in response to that backlog (see BACKLOG_PER_GALLEY/GALLEY_FLEET_CEILING
   * above) -- previously a flat MAX_GALLEYS ceiling regardless of backlog
   * size, which meant an island civ producing units faster than 3 galleys
   * could ferry them just piled up on the shore forever.
   */
  function computeGalleyNeed(civ, gameState) {
    const { map } = gameState;
    const galleyCount = civ.units.filter((u) => u.typeId === "galley").length
      + countQueuedUnits(civ, (id) => id === "galley");
    const overseasBacklog = civ.units.filter((u) => {
      if (u.carriedBy) return false;
      const ud = window.GameData.getUnit(u.typeId);
      if (u.typeId !== "pioneer" && !(ud.category === "military" && !ud.isNaval)) return false;
      const t = map.tiles[u.y * map.width + u.x];
      return t && civ._landmassMajority && civ._landmassMajority.get(t.landmassId);
    }).length;
    // A known, currently-defended invasion target (see assessInvasionTarget)
    // pre-positions a small fleet up to the baseline ahead of the backlog
    // actually accumulating -- waiting for units to idle first, then building
    // one galley per unit in response, is exactly how a lone unit ends up
    // ferried over solo into a defended shore. This also keeps maybeDisband
    // from scrapping a "surplus" galley mid-campaign, since overseasBacklog
    // never reads as 0 while a target is active.
    const effectiveBacklog = civ._invasionTarget ? Math.max(overseasBacklog, MAX_GALLEYS) : overseasBacklog;
    const galleyCap = Math.min(GALLEY_FLEET_CEILING,
      Math.max(MAX_GALLEYS, Math.ceil(effectiveBacklog / BACKLOG_PER_GALLEY)));
    return { galleyCount, overseasBacklog: effectiveBacklog, galleyCap };
  }

  function aggressivenessFor(civ) {
    const race = window.GameData.getRace(civ.raceId);
    return race.aggressiveness ?? 0.5;
  }

  /** Highly aggressive (1.0) civs will take a fight at roughly even odds (50%);
   *  passive (0.0) civs hold out for heavily favorable odds (~90%). */
  function minAcceptableWinProbability(civ) {
    return 0.9 - aggressivenessFor(civ) * 0.4;
  }

  /** Quick win-probability estimate via sampling rather than exact Markov
   *  computation -- a pragmatic prototype-scale approximation of the
   *  exact-lookup approach the design doc describes. */
  function estimateWinProbability(attackerUnit, defenderUnit, civs, context, samples = 30) {
    let wins = 0;
    for (let i = 0; i < samples; i++) {
      const a = { ...attackerUnit, hp: attackerUnit.hp };
      const b = { ...defenderUnit, hp: defenderUnit.hp };
      const result = window.GameEngine.combat.resolveToTheDeath(a, b, civs, context, 30);
      if (result.outcome === "attacker_wins") wins++;
    }
    return wins / samples;
  }

  /** Cheap current-strength proxy for a unit: (attack+defense) scaled by
   *  remaining HP fraction. Not a win-probability -- just an additive
   *  "how much does this unit contribute to a fight" number, used to compare
   *  coalitions of multiple units rather than simulating full group battles. */
  function unitCombatPower(unit, civ) {
    if (!civ || unit.hp <= 0) return 0;
    const atk = window.GameEngine.combat.effectiveAttack(unit, civ, {});
    const def = window.GameEngine.combat.effectiveDefense(unit, civ, {});
    const hpFrac = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) : 0;
    return (atk + def) * hpFrac;
  }

  const SUPPORT_RADIUS = 2; // "nearby" for ally/reinforcement awareness, in tiles

  // How strongly industriousness alone (independent of militarism) drives the
  // garrison-rest roll in runUnitTurn -- see the garrison-rest roll's comment
  // there and [[project_halfellow_tactics]]. 0.75 means Halfellow (industry
  // 1.0) gets a 75% garrison-desire floor even at its rock-bottom 0.2
  // militarism; a low-industry race gets negligible boost from this term and
  // falls back to its militarism alone.
  const INDUSTRIOUSNESS_GARRISON_WEIGHT = 0.75;

  /** Summed combat power of `civ`'s other military units within `radius` of
   *  (x,y), excluding `excludeUnit`. Used to size up allied backup on either
   *  side of a potential fight (see considerAttackOrGarrison). */
  function nearbyMilitaryPower(civ, aroundX, aroundY, radius, excludeUnit) {
    let total = 0;
    for (const u of civ.units) {
      if (u === excludeUnit || u.carriedBy || u.hp <= 0) continue;
      const ud = window.GameData.getUnit(u.typeId);
      if (ud.category !== "military") continue;
      if (window.GameEngine.influence.chebyshev(u.x, u.y, aroundX, aroundY) > radius) continue;
      total += unitCombatPower(u, civ);
    }
    return total;
  }

  /** Difficulty noise -- the only difficulty lever, per design doc */
  const DIFFICULTY_SPREAD = { easy: 0.40, normal: 0.15, hard: 0.0 };
  function applyDifficultyNoise(score, difficulty) {
    const spread = DIFFICULTY_SPREAD[difficulty] ?? 0.15;
    if (spread === 0) return score;
    const noise = 1.0 + (Math.random() * 2 - 1) * spread;
    return score * noise;
  }

  /**
   * Runs one AI civ's full turn: scores and executes Settle, Research,
   * Build, Garrison, Attack/Raid, and Explore candidates.
   */
  /**
   * Picks a strategic focus for this civ this turn based on its situation.
   * Returns { focus, reason } where focus is one of:
   *   "explore" | "settle" | "tech" | "military" | "aggression"
   */
  function chooseStrategy(civ, gameState, weights, doctrine) {
    const { map, civs } = gameState;
    const race = window.GameData.getRace(civ.raceId);

    const cityCount = civ.cities.length;
    const unitCount = civ.units.length;
    const militaryCount = civ.units.filter((u) => {
      const ud = window.GameData.getUnit(u.typeId);
      return ud.category === "military" && !ud.isNaval;
    }).length;
    const hasSettler = civ.units.some((u) => u.typeId === "pioneer");
    const hasResearch = !!civ.currentResearch;

    // Count visible enemy units near our territory
    const visible = gameState.visibility[civ.id] || new Set();
    let nearbyEnemies = 0;
    for (const other of Object.values(civs)) {
      if (other.id === civ.id || other.eliminated) continue;
      for (const u of other.units) {
        if (visible.has(u.y * map.width + u.x) && !u.conditions?.hidden) nearbyEnemies++;
      }
    }

    // Score each focus — driven directly by personality traits so the
    // strategic focus reflects who this race actually is, not just situation.
    const militarism      = effectiveMilitarism(civ);
    const expansionism    = race.expansionism    ?? 0.5;
    const curiosity       = race.curiosity       ?? 0.5;
    const agg             = aggressivenessFor(civ);
    const militaryCap     = computeMilitaryCap(civ);

    // Tech-tree city gate awareness: a layer-L tech requires >= L cities (see
    // tech.js meetsCityGate). Computed up front (rather than after `scores` is
    // built) so it can also keep the settle score's base multiplier from
    // falling off a cliff below while a tech is still gated on city count.
    const gatedLayer = window.GameEngine.tech.nextGatedTechLayer(civ);
    const cityGateShortfall = gatedLayer !== null ? gatedLayer - cityCount : 0;

    const scores = {
      // When cityCount=0, settle is an existential priority — clamp explore low so
      // even low-expansionism races don't wander instead of founding their first city.
      explore:    (cityCount === 0 ? 2 : 0) + (unitCount < 2 ? 5 : 0) + 3,
      // The 15-vs-5 base multiplier normally drops once a civ has settled 3+
      // cities -- but not while a tech is still blocked purely on city count,
      // since abandoning settling there would stall research for no reason.
      settle:     (cityCount < 3 || cityGateShortfall > 0 ? 15 : 5) * expansionism * 2 + (hasSettler ? 8 : 0),
      tech:       (!hasResearch ? 10 : 2) * curiosity * 2,
      military:   (militaryCount < militaryCap ? 12 : 4) * militarism * 2,
      aggression: nearbyEnemies * 6 * agg,
    };

    // Sustained grand-strategy bias (see engine/strategy.js): a mild, multi-turn
    // nudge toward this civ's macro goal on top of the turn-local reactive scores
    // above -- emergency signals (threat, disband) still flow through untouched.
    const macroGoal = doctrine && doctrine.macroGoal;
    if (macroGoal === "expand") {
      scores.settle *= 1.4;
      scores.explore *= 1.15;
    } else if (macroGoal === "consolidate") {
      scores.tech *= 1.3;
      if (militaryCount < militaryCap) scores.military *= 1.2;
    } else if (macroGoal === "conquest") {
      scores.aggression *= 1.5;
      scores.military *= 1.2;
    }

    // Tech-tree city gate awareness (gatedLayer/cityGateShortfall computed
    // above): a layer-L tech requires >= L cities (see tech.js meetsCityGate).
    // Without this, a civ whose doctrine wants to push deeper into its tech
    // spine can stall forever researching nothing further while never
    // recognizing that founding more cities is the actual blocker. If the
    // very next gated step needs more cities than we have, that's a hard,
    // immediate reason to settle -- weight it in directly rather than
    // waiting for expansionism/macroGoal to eventually favor it.
    if (cityGateShortfall > 0) scores.settle += cityGateShortfall * 10;

    const focus = Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a)[0];

    const reasons = {
      explore:    `only ${cityCount} cit${cityCount === 1 ? 'y' : 'ies'}, need to scout`,
      settle:     cityGateShortfall > 0
        ? `need ${cityGateShortfall} more cit${cityGateShortfall === 1 ? 'y' : 'ies'} to unlock further research`
        : `expanding to ${cityCount + 1} cities`,
      tech:       hasResearch ? `advancing ${civ.currentResearch}` : `no research active`,
      military:   `${militaryCount} soldiers vs ${cityCount * 2} target`,
      aggression: `${nearbyEnemies} enemies visible`,
    };

    return { focus, reason: reasons[focus] };
  }

  /**
   * Everything in an AI civ-turn that happens ONCE, before any individual
   * unit acts: movement-modifier stamping, invasion assessment, condition
   * expiry, strategy/doctrine choice, and the civ-level (not per-unit)
   * decisions -- disband, research, found-city, build-queue. Split out of
   * the former monolithic runAITurn (still available below, now just this
   * + a full stepAIUnit loop + finishAITurn) so turns.js's granular
   * per-unit spectator stepping (stepCivTurnUnit/advanceOneUnitStep) can run
   * this ONCE per civ-turn, then call stepAIUnit repeatedly, one unit per
   * call, instead of a full runAITurn call resolving every unit at once.
   * Returns a turnState object that stepAIUnit/finishAITurn need.
   */
  function beginAITurn(civ, gameState, difficulty = "normal") {
    const log = [];
    const weights = racialWeights(civ);
    const race = window.GameData.getRace(civ.raceId);

    // Stamp tech-unlocked movement modifiers onto each unit for this turn's
    // pathfinding (getMoveCost / moveUnitToward / canReachByLand read this).
    // Cheap reference copy, not a deep clone -- these fields are civ-wide.
    const moveMods = {
      terrainOverride: civ.terrainMoveOverride || {},
      terrainBonus: civ.terrainMoveBonus || {},
      unitTerrainBonus: civ.unitTerrainMoveBonus || {}, // { unitTypeId: { terrainId: extraMovement } }
      unitOverrides: civ.unitOverrides || {}, // { unitTypeId: {attack,defense,movement,visionRadius,firstStrikePct,siegePct,...} }
      canTunnel: !!civ.canTunnelMountains,
    };
    for (const u of civ.units) u._moveMods = moveMods;

    // Overseas-invasion readiness: which landmasses this civ already controls
    // the majority of, recomputed once per civ-turn (see computeLandmassMajority).
    civ._landmassMajority = computeLandmassMajority(civ, gameState);
    // Grouped-invasion targeting: is there a known, currently-defended foreign
    // landmass worth massing a fleet for instead of trickling units over solo
    // (see assessInvasionTarget)? Recomputed fresh every civ-turn since the
    // "currently visible" defense component can appear/disappear as enemy
    // units move in and out of sight.
    civ._invasionTarget = assessInvasionTarget(civ, gameState);

    // Orc "always looking for a fight" (2026-07-19, user-directed): a
    // single shared contact signal for the WHOLE warband, recomputed fresh
    // every Orc turn from currently-visible enemies -- see
    // computeOrcSwarmSignal/maybeOrcSwarm. Snaps onto a new (closer)
    // contact point the instant one becomes visible, same "recomputed
    // fresh every turn" convention as _invasionTarget above.
    if (civ.raceId === "orc") civ._orcSwarmSignal = computeOrcSwarmSignal(civ, gameState);

    // Fog-of-war memory: remember every enemy city this civ has ever laid
    // eyes on, so an idle unit with nothing CURRENTLY visible to react to
    // (see huntKnownEnemyTerritory) can still march toward known enemy
    // territory instead of falling all the way through to comfort-terrain
    // patrol -- a real contributor to 900-turn stalemates, since
    // huntNearestEnemy/huntEnemyInfrastructure only ever react to what's
    // visible this instant. Deliberately NOT reset every turn like
    // _invasionTarget above -- a sighting should persist across turns.
    // Pruned in two ways so it never points at something that's gone: a
    // fully-eliminated civ's entries are dropped outright, and an
    // individual city that's since been destroyed (still-alive civ, see
    // cities.js destroyCity) is dropped by name-existence check. Keyed by
    // "civId:cityName" so multiple enemies' cities coexist in one object.
    civ.lastKnownEnemyCities = civ.lastKnownEnemyCities || {};
    {
      const visible = gameState.visibility[civ.id] || new Set();
      const { map } = gameState;
      for (const otherCiv of Object.values(gameState.civs)) {
        if (otherCiv.id === civ.id) continue;
        const prefix = `${otherCiv.id}:`;
        if (otherCiv.eliminated) {
          for (const key in civ.lastKnownEnemyCities) {
            if (key.startsWith(prefix)) delete civ.lastKnownEnemyCities[key];
          }
          continue;
        }
        const stillStanding = new Set(otherCiv.cities.map((c) => c.name));
        for (const key in civ.lastKnownEnemyCities) {
          if (!key.startsWith(prefix)) continue;
          if (!stillStanding.has(key.slice(prefix.length))) delete civ.lastKnownEnemyCities[key];
        }
        for (const c of otherCiv.cities) {
          if (visible.has(c.y * map.width + c.x)) {
            civ.lastKnownEnemyCities[`${prefix}${c.name}`] = { x: c.x, y: c.y, name: c.name };
          }
        }
      }
    }

    // Every turn-based condition (Orc curse, Violent Momentum, ...) expires here via
    // one centralized call -- see combat.js's tickConditions/setCondition for
    // why this replaced the old per-condition hand-written expiry checks.
    const turnNumber = gameState.turnNumber || 0;
    currentTurnNumber = turnNumber;
    currentGameStateRef = gameState;
    for (const u of civ.units) {
      window.GameEngine.combat.tickConditions(u, turnNumber, gameState.map);
      // Human "Flight" expiring over water can leave a unit at 0 hp (see
      // tickConditions) -- remove it immediately, same pattern every other
      // non-combat death in this codebase uses (e.g. turns.js's starvation
      // disband). Reassigning civ.units doesn't disturb this in-progress
      // for-of loop, which already captured the original array.
      if (u.hp <= 0) {
        civ.units = civ.units.filter((x) => x !== u);
        continue;
      }
      // Recomputed fresh by seekOverseasInvasion every turn it actually fires --
      // reset here so a unit that's since disembarked onto a landmass this civ
      // does NOT control the majority of doesn't keep its stale invasion-boarding
      // priority (see operateGalley's boarding scan).
      u._seekingInvasion = false;
      // Same reset, same reason -- recomputed fresh by seekOverseasResource
      // every turn a prospector/wizard actually chases a known overseas gold
      // vein/ruin (see maybeProspectorsClaimPlay/maybeDungeonDelvePlay).
      u._seekingLandmassId = null;
    }

    const doctrine = window.GameEngine.strategy.computeDoctrine(civ, gameState);
    const { focus, reason } = chooseStrategy(civ, gameState, weights, doctrine);
    log.push(`[${race.label}] Strategy: ${focus} — ${reason}`);

    // Apply focus as a temporary weight boost this turn
    const boosted = { ...weights };
    if (focus === "explore")    boosted.explore = (boosted.explore || 1) * 2;
    if (focus === "settle")     boosted.settle  = (boosted.settle  || 1) * 2;
    if (focus === "tech")       boosted.research= (boosted.research|| 1) * 2;
    if (focus === "military")   boosted.garrison= (boosted.garrison|| 1) * 2;
    if (focus === "aggression") boosted.attack  = (boosted.attack  || 1) * 2;

    maybeDisband(civ, gameState, log);
    maybeChooseResearch(civ, boosted, log);
    maybeFoundCity(civ, gameState, boosted, difficulty, log);
    maybeBuildInCities(civ, gameState, boosted, log);

    return { log, weights: boosted, difficulty, processedUnits: new Set() };
  }

  /**
   * Dispatches exactly ONE not-yet-processed unit via runUnitTurn, in
   * civ.units order (creation order -- see runUnitTurn's doc comment).
   * Scans civ.units fresh every call (rather than tracking a numeric index)
   * so a unit created mid-civ-turn (Undead raise-dead, Halfellow Rouse the
   * People militia) is picked up naturally once reached, at its actual
   * (append) position, the same way the original single-pass for-loop in
   * maybeMoveUnits always could. `turnState.processedUnits` -- NOT
   * unit.usedThisTurn -- is what tracks "already visited this civ-turn",
   * since several branches inside runUnitTurn legitimately leave
   * usedThisTurn false (e.g. a carried unit that stays carried, or a
   * pioneer, handled separately by maybeFoundCity) without that meaning
   * "revisit me." Returns the unit it processed, or null once every unit
   * has been visited.
   */
  function stepAIUnit(civ, gameState, turnState) {
    for (const unit of civ.units) {
      if (turnState.processedUnits.has(unit)) continue;
      turnState.processedUnits.add(unit);
      runUnitTurn(civ, unit, gameState, turnState.weights, turnState.difficulty, turnState.log);
      return unit;
    }
    return null;
  }

  // Safety net against unbounded growth over a very long game or many games
  // played in one browser tab without a reload -- not a realistic ceiling
  // for a normal game (a full-length multi-hundred-turn, 6-civ game lands
  // in the low tens of thousands of entries, comfortably under this). Oldest
  // entries are evicted first once exceeded. See project_ai_action_log
  // memory for the sizing reasoning.
  const AI_ACTION_LOG_CAP = 20000;

  /**
   * Appends this civ-turn's log lines to gameState's persistent, cross-turn
   * AI action log -- civ.lastAILog (see finishAITurn below) only ever holds
   * the MOST RECENT turn's lines, overwritten every civ-turn; this is the
   * actual historical record the "AI Actions" report screen (js/ui/reports.js)
   * reads. Each entry is tagged with the turn number and civ id so the
   * viewer can filter/group by either. Called from every place that sets
   * civ.lastAILog (this file's finishAITurn, and turns.js's three AI-error
   * catch blocks) so the persistent log never has a silent gap around an
   * error the sidebar/report screen would otherwise just show nothing for.
   */
  function appendAIActionLog(gameState, civId, lines) {
    if (!lines || lines.length === 0) return;
    if (!gameState.aiActionLog) gameState.aiActionLog = [];
    const turn = gameState.turnNumber;
    for (const text of lines) gameState.aiActionLog.push({ turn, civId, text });
    const overflow = gameState.aiActionLog.length - AI_ACTION_LOG_CAP;
    if (overflow > 0) gameState.aiActionLog.splice(0, overflow);
  }

  /** Once-per-civ-turn teardown, run after every unit has been stepped
   *  (stepAIUnit returned null): the one AI decision that has to happen
   *  AFTER unit movement, not before or per-unit (a settler needs to have
   *  already tried to reach a galley this turn before deciding whether to
   *  embark). Mirrors beginAITurn's role at the other end of the turn. */
  function finishAITurn(civ, gameState, turnState) {
    maybeEmbarkSettlersOnGalleys(civ, gameState, turnState.log);
    civ.lastAILog = turnState.log;
    appendAIActionLog(gameState, civ.id, turnState.log);
    return turnState.log;
  }

  /** Full, non-granular AI civ-turn: begin -> step every unit -> finish, all
   *  in one synchronous call. Used by every caller that doesn't need
   *  per-unit visual pacing -- a full runTurn/runCivTurn call (the headless
   *  sim harness, a human player's synchronous End Turn). Spectator mode's
   *  visible one-unit-at-a-time stepping instead calls beginAITurn/
   *  stepAIUnit/finishAITurn directly via turns.js's stepCivTurnUnit. */
  function runAITurn(civ, gameState, difficulty = "normal") {
    const turnState = beginAITurn(civ, gameState, difficulty);
    while (stepAIUnit(civ, gameState, turnState)) { /* one unit per iteration, in creation order */ }
    return finishAITurn(civ, gameState, turnState);
  }

  /** Disbandable candidates ranked strongest-first (excludes pioneers, carried
   *  units, and -- for the military-cap trim only -- naval units, since
   *  computeMilitaryCap never counts them in the first place). Naval units
   *  (galleys) ARE eligible under general economic pressure (onlyMilitaryLand
   *  false), as long as they aren't mid-transport (would strand the cargo). */
  function disbandCandidates(civ, onlyMilitaryLand) {
    return civ.units
      .filter(u => {
        if (u.typeId === "pioneer" || u.carriedBy) return false;
        const ud = window.GameData.getUnit(u.typeId);
        if (ud.isNaval) return !onlyMilitaryLand && !u.carries;
        if (onlyMilitaryLand && ud.category !== "military") return false;
        return true;
      })
      .map(u => {
        const ud = window.GameData.getUnit(u.typeId);
        return { u, strength: ud.attack + ud.defense };
      })
      .sort((a, b) => b.strength - a.strength);
  }

  function maybeDisband(civ, gameState, log) {
    // Never disband when there are no cities yet — the civ has no income by definition
    // at game start, so it would always appear "stressed" and self-eliminate.
    if (civ.cities.length === 0) return;
    // Also skip if only 1 unit remains — never leave a civ with no units at all.
    if (civ.units.length <= 1) return;

    const race = window.GameData.getRace(civ.raceId);

    // Trigger 1: the army has outgrown the population-based military cap.
    // Restricted to noUpkeep races (Undead) ONLY -- they have no upkeep at
    // all (turns.js skips their per-turn drain entirely), so a swarm can
    // never strain their economy the way upkeepStrainMultiplier now strains
    // every other race's. This population/count check is their sole brake,
    // by design ("fielding a swarm is their identity" -- see
    // computeMilitaryCap). Every other race relies purely on the economic
    // path instead: strain inflates upkeep, stockpile goes negative, and the
    // starvation trigger (turns.js's per-turn version of the same check)
    // trims the army for real economic reasons, not a raw headcount rule --
    // exactly the "math of the economy imposes the limit" principle this
    // mechanic is meant to embody.
    const militaryCap = computeMilitaryCap(civ);
    const militaryCount = civ.units.filter((u) => {
      const ud = window.GameData.getUnit(u.typeId);
      return ud.category === "military" && !ud.isNaval;
    }).length;
    if (race.noUpkeep && militaryCount > militaryCap) {
      const candidates = disbandCandidates(civ, true); // military-only
      if (candidates.length > 0) {
        const toDisband = candidates[0].u;
        civ.units = civ.units.filter(u => u !== toDisband);
        log.push(`Disband: ${toDisband.typeId} disbanded (army ${militaryCount} over population cap ${militaryCap})`);
        return; // one trim per turn is enough
      }
    }

    // Trigger: surplus galleys. Symmetric to chooseBuildAction building an
    // extra galley for a backlog -- once that backlog clears and a galley has
    // sat empty near shore with nothing to do for a while (operateGalley's own
    // turnsEmptyNearShore idle-tracking), it's no longer earning its upkeep.
    // Never touches a galley mid-transport (disbandCandidates already excludes
    // any galley with cargo). Population/need check, not economic -- applies
    // even to noUpkeep races (Undead), same rationale as the military cap above.
    const galleys = civ.units.filter((u) => u.typeId === "galley");
    if (galleys.length > 0) {
      const { overseasBacklog } = computeGalleyNeed(civ, gameState);
      const hasCoastalCity = civ.cities.some((c) => c.isPort || isCoastalTile(gameState.map, c.x, c.y));
      const keepFloor = hasCoastalCity ? 1 : 0; // a landlocked civ has no more use for any of them
      const idleGalley = galleys.find((g) => !g.carries && (g.turnsEmptyNearShore || 0) >= 6);
      if (overseasBacklog === 0 && galleys.length > keepFloor && idleGalley) {
        civ.units = civ.units.filter(u => u !== idleGalley);
        log.push(`Disband: galley disbanded (idle ${idleGalley.turnsEmptyNearShore}+ turns near shore, no overseas backlog)`);
        return; // one trim per turn is enough
      }
    }

    if (race.noUpkeep) return; // e.g. Undead -- no upkeep drain, nothing further to check

    const militarism = effectiveMilitarism(civ);
    const totalUpkeep = totalUnitUpkeep(civ);
    const income = {
      harvest: civ.resources?.harvest ?? civ.cities.reduce((s, c) => s + (c.lastYield ? c.lastYield.harvest : 0), 0),
      coin:    civ.resources?.coin    ?? civ.cities.reduce((s, c) => s + (c.lastYield ? c.lastYield.coin    : 0), 0),
      lore:    civ.resources?.lore    ?? civ.cities.reduce((s, c) => s + (c.lastYield ? c.lastYield.lore    : 0), 0),
    };

    // Trigger 2: proactive economic lookahead. Instead of waiting until the
    // stockpile actually runs dry, project how many turns remain at the
    // current drain rate (same math as canAffordUnitUpkeep uses when deciding
    // whether to build), and act while there's still runway left. Militarism
    // controls how much runway a race tolerates before it starts trimming --
    // matching the same trait used when deciding whether to build a new unit
    // in the first place, so a civ doesn't build right up to the edge and
    // then immediately have to reverse.
    let turnsUntilBroke = Infinity;
    for (const k of UPKEEP_RESOURCE_KEYS) {
      const drain = Math.max(0, totalUpkeep[k] - income[k]);
      if (drain > 0) turnsUntilBroke = Math.min(turnsUntilBroke, (civ.stockpile?.[k] || 0) / drain);
    }
    const lookaheadTurns = Math.round(3 + militarism * 5); // act with 3-8 turns of runway left

    // Trigger 3: strategic strain relief. Distinct from Trigger 2 below --
    // that one is a bankruptcy-avoidance reflex, only engaging once runway
    // is genuinely short. This one fires with plenty of runway left, purely
    // because the army has grown enough past sustainableArmySize that
    // upkeepStrainMultiplier is taxing the whole military bill -- the civ
    // considers whether the marginal unit is still worth what it's costing
    // the rest of the economy (tech, buildings, the next unit) even though
    // nothing is in danger yet. Deliberately NOT a hard rule: gated behind a
    // per-turn probability roll so it's an occasional strategic call, not a
    // running policy, and shaped by personality -- higher militarism makes a
    // civ tolerate real strain before ever reconsidering the army it built;
    // higher industriousness (an economically-minded race) reconsiders a
    // touch sooner. Skipped entirely once already in Trigger 2's crisis
    // territory -- that's a more urgent, deterministic call.
    if (turnsUntilBroke >= lookaheadTurns) {
      const strain = upkeepStrainMultiplier(civ);
      if (strain > 1.15) {
        const industriousness = race.industriousness ?? 0.5;
        const reconsiderChance = Math.min(0.25,
          (strain - 1) * (0.6 + industriousness * 0.4) * (1 - militarism * 0.6));
        if (Math.random() < reconsiderChance) {
          const candidates = disbandCandidates(civ, true); // military-only, symmetric to Trigger 1
          if (candidates.length > 0) {
            const toDisband = candidates[0].u;
            civ.units = civ.units.filter(u => u !== toDisband);
            log.push(`Disband: ${toDisband.typeId} disbanded to relieve army-size strain (${strain.toFixed(2)}x upkeep) -- freeing resources for other priorities`);
          }
        }
      }
      return; // plenty of runway either way -- nothing more urgent to do this turn
    }

    // Trim the STRONGEST eligible unit, deliberately -- a civ that can't sustain
    // its army sheds its most expensive-to-maintain asset first, rather than
    // nickel-and-diming away its weakest defenders while keeping an army it
    // still can't afford. Pioneers (future income) and naval/carried units are
    // never touched here.
    const candidates = disbandCandidates(civ, false); // any unit type is eligible
    if (candidates.length === 0) return;
    const toDisband = candidates[0].u;
    civ.units = civ.units.filter(u => u !== toDisband);
    log.push(`Disband: ${toDisband.typeId} disbanded pre-emptively (~${Math.floor(turnsUntilBroke)} turns of runway left)`);
  }

  /**
   * Pure scoring pass over this civ's currently-available techs (city gate +
   * prereqs already satisfied) -- returns the tech id the AI would pick, or
   * null if nothing is available. Does not mutate civ state; shared by
   * maybeChooseResearch (which commits the pick) and previewNextResearch
   * (used by the spectator tech-tree UI to show "AI intends to research X").
   */
  function scoreNextResearch(civ, weights) {
    const candidates = window.GameEngine.tech.availableTechs(civ);
    if (candidates.length === 0) return null;
    const doctrine = window.GameEngine.strategy.getDoctrine(civ);
    let best = null, bestScore = -Infinity;
    for (const techId of candidates) {
      const tech = window.GameData.getTech(techId);
      const civicValue = tech.effects.filter((e) => e.type === "civic_influence_bonus")
        .reduce((sum, e) => sum + e.value, 0) * 100;
      const unlockValue = tech.effects.length * 5;
      // Include the cost of any incomplete prerequisites so the AI doesn't
      // score a deep tech as cheap when it still needs several unlocks first.
      // effectiveTechCost, not tech.cost/p.cost directly -- see techs.js's
      // TECH_LAYER_PREMIUM_RATE -- otherwise this would keep valuing a
      // higher-layer tech as if it were as cheap as its authored cost says,
      // even though it now actually takes noticeably longer to finish.
      const prereqDebt = tech.prereqs
        .filter(p => !civ.completedTechs.has(p))
        .reduce((sum, p) => sum + window.GameData.effectiveTechCost(window.GameData.getTech(p)), 0);
      let score = (civicValue + unlockValue) * (weights.research || 1.0)
        / Math.max(1, (window.GameData.effectiveTechCost(tech) + prereqDebt) / 20);
      // Grand-strategy bias (engine/strategy.js): favor this civ's chosen tech
      // spine, but never zero out the others -- a race should still dabble
      // outside its priority tree, just less than within it.
      if (doctrine) {
        score *= tech.category === doctrine.techSpine ? 1.6 : 0.85;
        if (window.GameEngine.strategy.isAncestorOf(techId, doctrine.techTarget)) score *= 1.3;
      }
      if (score > bestScore) { bestScore = score; best = techId; }
    }
    return best;
  }

  function maybeChooseResearch(civ, weights, log) {
    if (civ.currentResearch) return;
    const best = scoreNextResearch(civ, weights);
    if (best) {
      window.GameEngine.tech.chooseResearch(civ, best);
      log.push(`Research: started ${best}`);
    }
  }

  /**
   * UI-facing preview: what would this civ research next? Returns the tech
   * id already in progress (civ.currentResearch) if any, otherwise runs the
   * same scoring pass the AI itself uses, without committing anything.
   */
  function previewNextResearch(civ) {
    if (civ.currentResearch) return civ.currentResearch;
    return scoreNextResearch(civ, racialWeights(civ));
  }

  function maybeFoundCity(civ, gameState, weights, difficulty, log) {
    // Only act on pioneers not currently carried by another unit (e.g. aboard a galley)
    const pioneers = civ.units.filter((u) => u.typeId === "pioneer" && !u.usedThisTurn && !u.carriedBy);

    // Halfellow Wanderer / Elf Druid: an ADDITIONAL settler option
    // (canFoundCity, a generic unit-data flag -- not hardcoded to one race's
    // unit type) alongside the shared Pioneer, not a replacement -- so it
    // only gets dedicated to settling when the civ has no Pioneer at all
    // right now, and only if the civ has other military units to spare
    // (never draft its last soldier). Reuses every bit of the mature pioneer
    // pipeline below (idle-stall handling, galley embark deferral, founding)
    // for free; if this unit's best move turns out to be "wait for a galley"
    // (usedThisTurn left false), it naturally falls through to normal
    // combat/explore handling later this turn in maybeMoveUnits instead
    // (that dispatch only special-cases pioneers).
    if (pioneers.length === 0 && !civ.units.some((u) => u.typeId === "pioneer")) {
      const idleWanderer = civ.units.find((u) =>
        u.typeId !== "pioneer" && !u.usedThisTurn && !u.carriedBy
        && window.GameData.getUnit(u.typeId).canFoundCity);
      if (idleWanderer) {
        const militaryUnits = civ.units.filter((u) =>
          window.GameData.getUnit(u.typeId).category === "military" && !u.carriedBy);
        if (militaryUnits.length > 1) pioneers.push(idleWanderer);
      }
    }
    if (pioneers.length === 0) return;

    // Tech-tree city gate awareness (same computation as chooseStrategy/
    // chooseBuildAction): when a tech is blocked purely on city count, a
    // pioneer should finish settling a good local site rather than being
    // diverted overseas just because the "2 cities on this landmass, time to
    // expand by sea" heuristic below fired -- see the shouldEmbark check.
    const gatedLayer = window.GameEngine.tech.nextGatedTechLayer(civ);
    const cityGateShortfall = gatedLayer !== null ? Math.max(0, gatedLayer - civ.cities.length) : 0;

    for (const pioneer of pioneers) {
      // Idle tracking: if this pioneer's position hasn't changed for 3+ turns
      // (wandering in place, waiting on a road gap, stuck with no settle site,
      // etc.), stop whatever it was doing and head for the nearest galley.
      const stayedPut = pioneer.x === pioneer._lastIdleX && pioneer.y === pioneer._lastIdleY;
      pioneer._idleTurns = stayedPut ? (pioneer._idleTurns || 0) + 1 : 0;
      if (pioneer._idleTurns >= 3) {
        const nearestGalley = civ.units
          .filter(u => u.typeId === "galley")
          .reduce((best, g) => {
            const d = window.GameEngine.influence.chebyshev(pioneer.x, pioneer.y, g.x, g.y);
            return (!best || d < best.d) ? { g, d } : best;
          }, null);
        if (nearestGalley) {
          const tile = gameState.map.tiles[pioneer.y * gameState.map.width + pioneer.x];
          if (nearestGalley.d <= 1) {
            // Already adjacent to the galley -- leave usedThisTurn unset so
            // operateGalley's boarding scan (runs later this same turn, in
            // maybeMoveUnits) can actually pick this pioneer up. Stamping it
            // used here would make the pioneer invisible to that scan forever,
            // permanently stranding it beside a galley that never boards it.
            pioneer.currentMission = `Stalled — waiting to board galley at (${nearestGalley.g.x},${nearestGalley.g.y})`;
            log.push(`Pioneer idle 3+ turns at (${pioneer.x},${pioneer.y}) — waiting to board galley at (${nearestGalley.g.x},${nearestGalley.g.y})`);
          } else {
            if (!window.GameData.TERRAIN[tile.terrain].isWater) {
              moveUnitToward(pioneer, nearestGalley.g.x, nearestGalley.g.y, gameState.map, gameState.civs);
            }
            pioneer.usedThisTurn = true; // still closing distance -- nothing to board yet
            pioneer.currentMission = `Stalled — heading for a galley at (${nearestGalley.g.x},${nearestGalley.g.y})`;
            log.push(`Pioneer idle 3+ turns at (${pioneer.x},${pioneer.y}) — heading for galley at (${nearestGalley.g.x},${nearestGalley.g.y})`);
          }
          // Deliberately stamp the POST-move position here (not pre-move, like the
          // normal path below) -- this keeps _idleTurns pinned at >=3 every
          // subsequent turn, so the pioneer keeps heading for a galley turn after
          // turn instead of falling back to normal behavior after a single try.
          // It naturally stops once the pioneer boards (excluded from `pioneers`
          // above via the `!u.carriedBy` filter).
          pioneer._lastIdleX = pioneer.x;
          pioneer._lastIdleY = pioneer.y;
          continue;
        }
        // No galley to head for -- whatever this pioneer was trying to do isn't
        // working (blocked path, no valid site, etc.). Break the stall by
        // heading toward the best-remembered nearby settle-worthy tile (see
        // findRememberedGoodSpot) instead of a truly random walk, so the
        // pioneer drifts toward somewhere it once liked rather than possibly
        // further from opportunity; falls back to a random open adjacent tile
        // if nothing's remembered nearby. Stamp the PRE-move position (unlike
        // the galley branch above) so that once this actually moves the
        // pioneer, next turn's stayedPut check correctly sees it moved and
        // resets _idleTurns to 0 instead of pinning it forever.
        const preX = pioneer.x, preY = pioneer.y;
        const rememberedSpot = findRememberedGoodSpot(civ, gameState, preX, preY);
        if (rememberedSpot) {
          moveUnitToward(pioneer, rememberedSpot.x, rememberedSpot.y, gameState.map, gameState.civs);
          pioneer.currentMission = `Stuck — heading toward a remembered good site at (${rememberedSpot.x},${rememberedSpot.y})`;
          log.push(`Pioneer idle 3+ turns at (${preX},${preY}) — heading toward a remembered good site at (${rememberedSpot.x},${rememberedSpot.y})`);
        } else {
          wanderUnit(pioneer, gameState.map, gameState.civs);
          pioneer.currentMission = "Stuck — wandering randomly to break the stall";
          log.push(`Pioneer idle 3+ turns at (${preX},${preY}) — moving to a random tile to break the stall`);
        }
        pioneer.usedThisTurn = true;
        pioneer._lastIdleX = preX;
        pioneer._lastIdleY = preY;
        continue;
      }
      pioneer._lastIdleX = pioneer.x;
      pioneer._lastIdleY = pioneer.y;

      // Determine whether this pioneer should embark on a waiting galley instead
      // of continuing to settle on the current island.  Triggered when:
      //   • an empty galley is ready, AND
      //   • the civ already has ≥2 cities on this landmass (time to expand by sea)
      const pioneerTile = gameState.map.tiles[pioneer.y * gameState.map.width + pioneer.x];
      const pioneerLandmassId = pioneerTile ? pioneerTile.landmassId : -1;
      // True when the pioneer is on a landmass where this civ has no existing cities
      const isOnForeignLandmass = pioneerLandmassId >= 0 && !civ.cities.some(c => {
        const ct = gameState.map.tiles[c.y * gameState.map.width + c.x];
        return ct && ct.landmassId === pioneerLandmassId;
      });
      const citiesOnLandmass = civ.cities.filter(c => {
        const ct = gameState.map.tiles[c.y * gameState.map.width + c.x];
        return ct && ct.landmassId === pioneerLandmassId;
      }).length;
      const emptyGalley = civ.units.find(u => u.typeId === "galley" && !u.carries);
      // Either the old per-landmass city-count heuristic, or the civ already
      // controls the majority of this landmass outright (see computeLandmassMajority)
      // -- a civ that conquered a whole island through combat rather than
      // founding 2+ cities on it should still send its pioneers on to new shores.
      const landmassConquered = !!(civ._landmassMajority && civ._landmassMajority.get(pioneerLandmassId));
      const shouldEmbark = !!emptyGalley && (citiesOnLandmass >= 2 || landmassConquered);

      const candidate = findBestSettleSite(civ, gameState, pioneer);
      // A tech-driven need for more cities always wins over "time to expand by
      // sea": don't abandon a perfectly good local site just because
      // citiesOnLandmass crossed the old threshold while a tech is still gated.
      if (!candidate || (shouldEmbark && cityGateShortfall === 0)) {
        // If an empty galley exists (or embark is preferred), yield to
        // maybeEmbarkSettlersOnGalleys which moves the pioneer toward the coast.
        if (emptyGalley) {
          pioneer.currentMission = `Heading to a galley to sail on (${citiesOnLandmass} cities on this island)`;
          log.push(`Pioneer at (${pioneer.x},${pioneer.y}) — heading to galley (${citiesOnLandmass} cities on island)`);
          // Leave usedThisTurn=false so embark logic can handle movement this turn
          continue;
        }
        // No candidate this turn -- before giving up to a purely random walk,
        // check whether this civ remembers a decent settle-worthy tile nearby
        // (see findRememberedGoodSpot) and head there instead; a remembered
        // spot outside findBestSettleSite's own search radius, or one whose
        // score only recently improved, might not have been considered above.
        const rememberedSpot = findRememberedGoodSpot(civ, gameState, pioneer.x, pioneer.y);
        if (rememberedSpot) {
          moveUnitToward(pioneer, rememberedSpot.x, rememberedSpot.y, gameState.map, gameState.civs);
          pioneer.currentMission = `Heading toward a remembered good site at (${rememberedSpot.x},${rememberedSpot.y})`;
          log.push(`Pioneer at (${pioneer.x},${pioneer.y}) — no settle site found nearby, heading toward a remembered good site at (${rememberedSpot.x},${rememberedSpot.y})`);
        } else {
          wanderUnit(pioneer, gameState.map, gameState.civs);
          pioneer.currentMission = "Wandering — no settle site found";
          log.push(`Pioneer wandering at (${pioneer.x},${pioneer.y}) — no settle site found`);
        }
        pioneer.usedThisTurn = true;
        continue;
      }

      if (candidate.x === pioneer.x && candidate.y === pioneer.y) {
        // At destination — attempt to found (canFoundCityAt includes road check).
        // Elf Druid (2026-07-19, user-directed): a Druid founding a city
        // never needs road connectivity, unlike the Pioneer/Wanderer this
        // same loop also handles -- its bond with the land runs deeper than
        // infrastructure. Mirrors the skipRoadCheck already used for the
        // overseas/emergency-settle paths elsewhere in this file.
        const check = window.GameEngine.cities.canFoundCityAt(
          gameState.map, gameState.civs, pioneer.x, pioneer.y, civ.raceId,
          { emergencyFound: !!candidate.emergency, skipRoadCheck: pioneer.typeId === "druid" });
        if (check.ok) {
          window.GameEngine.quips.maybeQuip(pioneer, civ, "found", gameState);
          const city = window.GameEngine.cities.foundCity(civ, gameState.map, pioneer.x, pioneer.y);
          civ.units = civ.units.filter((u) => u !== pioneer);
          log.push(`Settle: founded ${city.name} at (${pioneer.x},${pioneer.y})`);
        } else if (check.reason && check.reason.includes("must connect")) {
          // Gap in road chain — road-step back toward nearest own city to
          // fill the missing link rather than wandering away from the destination.
          const nearestCity = civ.cities.reduce((best, c) => {
            const d = window.GameEngine.influence.chebyshev(pioneer.x, pioneer.y, c.x, c.y);
            return (!best || d < best.d) ? { c, d } : best;
          }, null);
          if (nearestCity) {
            pioneerRoadStep(pioneer, nearestCity.c.x, nearestCity.c.y, gameState.map, log, gameState.civs);
          }
          pioneer.usedThisTurn = true;
          pioneer.currentMission = `Filling a road gap toward ${nearestCity?.c.name || 'city'}`;
          log.push(`Pioneer filling road gap toward ${nearestCity?.c.name || 'city'}`);
        } else {
          wanderUnit(pioneer, gameState.map, gameState.civs);
          pioneer.usedThisTurn = true;
          pioneer.currentMission = `Waiting to found a city here: ${check.reason}`;
          log.push(`Pioneer waiting at (${pioneer.x},${pioneer.y}): ${check.reason}`);
        }
      } else {
        const tile = gameState.map.tiles[pioneer.y * gameState.map.width + pioneer.x];
        if (window.GameData.TERRAIN[tile.terrain].isWater) {
          pioneer.usedThisTurn = true; // on water — waiting for galley
          pioneer.currentMission = "Waiting on water for a galley pickup";
        } else if (civ.cities.length > 0 && !isOnForeignLandmass) {
          // Road-building mode: step exactly ONE tile toward destination and
          // stamp a road on the arrival tile. One tile per turn guarantees
          // a gapless road chain with no alternating-turn gaps.
          pioneerRoadStep(pioneer, candidate.x, candidate.y, gameState.map, log, gameState.civs);
          pioneer.usedThisTurn = true;
          pioneer.currentMission = `Building a road toward a new city site at (${candidate.x},${candidate.y})`;
        } else {
          // First city OR foreign shore — no roads needed, use full movement speed
          moveUnitToward(pioneer, candidate.x, candidate.y, gameState.map, gameState.civs);
          pioneer.usedThisTurn = true;
          pioneer.currentMission = `Marching to found a new city at (${candidate.x},${candidate.y})`;
        }
      }
    }
  }

  /** Moves a pioneer exactly one tile toward (targetX, targetY) and marks the
   *  arrival tile as a road. Keeps movement to 1 tile so roads are gapless.
   *  Uses pathfinding to pick the step rather than a raw straight-line
   *  direction, so a mountain or lake directly on the line doesn't stall it. */
  function pioneerRoadStep(pioneer, targetX, targetY, map, log, civs) {
    const baseUnit = window.GameData.getUnit(pioneer.typeId);
    const occupied = buildOccupancySet(civs, pioneer);
    const costFn = (nx, ny, tile) => {
      if (occupied.has(`${nx},${ny}`)) return window.GameData.IMPASSABLE;
      if (isEnemyStructureBlockingTile(tile, pioneer)) return window.GameData.IMPASSABLE;
      if (isEnemyCityBlockingTile(civs, nx, ny, pioneer)) return window.GameData.IMPASSABLE;
      const terrain = window.GameData.TERRAIN[tile.terrain];
      if (terrain.isWater) return window.GameData.IMPASSABLE;
      return getMoveCost(terrain, baseUnit, pioneer, tile.hasRoad);
    };
    const path = window.GameEngine.pathfinding.findPath(pioneer.x, pioneer.y, targetX, targetY, map, costFn);
    if (!path || path.length === 0) return;
    const step = path[0];
    // Hidden: same reveal-on-contact rule as moveUnitToward -- this step is
    // always the pioneer's landing tile (one step per call), so a Hidden
    // enemy here gets revealed but the pioneer does not move onto it this turn.
    const revealedEnemy = findHiddenEnemyAt(civs, step.x, step.y, pioneer.civId);
    if (revealedEnemy) {
      window.GameEngine.combat.revealHidden(revealedEnemy, currentTurnNumber);
      return;
    }
    window.GameEngine.quips.maybeQuip(pioneer, civs?.[pioneer.civId], "build_road", currentGameStateRef);
    pioneer.x = step.x;
    pioneer.y = step.y;
    const newTile = map.tiles[step.y * map.width + step.x];
    newTile.hasRoad = true;
    log.push(`Pioneer built road at (${step.x},${step.y})`);
  }

  /** Looks for the best-remembered settle-worthy tile (from this civ's
   *  tileMemory -- see turns.js's per-turn snapshot and ai.js's
   *  computeTileCityScore) within `maxDist` of (fromX, fromY). Used to break
   *  a stalled pioneer's wander toward somewhere it once saw and liked
   *  instead of a purely random tile that could just as easily drift further
   *  from opportunity. Returns {x, y}, or null if nothing remembered nearby. */
  function findRememberedGoodSpot(civ, gameState, fromX, fromY, maxDist = 12) {
    const memory = gameState.tileMemory && gameState.tileMemory[civ.id];
    if (!memory) return null;
    const { map } = gameState;
    let best = null, bestScore = -Infinity;
    for (const [idxStr, entry] of Object.entries(memory)) {
      if (entry.cityScore == null || entry.city) continue; // water, or already a city
      const idx = Number(idxStr);
      const x = idx % map.width, y = Math.floor(idx / map.width);
      const dist = window.GameEngine.influence.chebyshev(fromX, fromY, x, y);
      if (dist === 0 || dist > maxDist) continue;
      if (entry.cityScore > bestScore) { bestScore = entry.cityScore; best = { x, y }; }
    }
    return best;
  }

  function wanderUnit(unit, map, civs) {
    const occupied = buildOccupancySet(civs, unit);
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    const shuffled = dirs.sort(() => Math.random() - 0.5);
    for (const [dx, dy] of shuffled) {
      const nx = unit.x + dx, ny = unit.y + dy;
      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
      const terrain = window.GameData.TERRAIN[map.tiles[ny * map.width + nx].terrain];
      if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) continue;
      if (occupied.has(`${nx},${ny}`)) continue; // no stacking
      unit.x = nx; unit.y = ny;
      return;
    }
  }

  /** Naval counterpart of wanderUnit -- a single random adjacent step onto
   *  open water instead of land, used by exploreWater's stuck-detection
   *  fallback (see that function). */
  function wanderUnitOnWater(unit, map, civs) {
    const occupied = buildOccupancySet(civs, unit);
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    const shuffled = dirs.sort(() => Math.random() - 0.5);
    for (const [dx, dy] of shuffled) {
      const nx = unit.x + dx, ny = unit.y + dy;
      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
      if (!window.GameData.TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) continue;
      if (occupied.has(`${nx},${ny}`)) continue; // no stacking
      unit.x = nx; unit.y = ny;
      return;
    }
  }

  /**
   * Generic, TARGET-AGNOSTIC "has this unit's position genuinely not
   * changed across the last N calls" detector (2026-07-17, root-caused via
   * [[project_roads_upkeep_stall_review]]'s per-unit stall tracking).
   *
   * Several long-running "march toward a chosen destination" behaviors
   * (exploreWith, exploreWater, the galley stranded-unit pickup logic)
   * re-evaluate their target fresh every turn. When the freshly-chosen
   * target happens to be a DIFFERENT tile than last turn's -- plausible
   * any time fog-of-war/visibility shifts, or a nearest-tile search's tie-
   * break varies -- while the unit is nonetheless still unable to make any
   * real progress toward ANY of them (boxed in, cut off by water with no
   * galley, etc.), a same-target-required stuck check never fires, because
   * "same target" is never true two turns running even though the unit
   * hasn't moved an inch. Measured cases of this defeating exploreWith's
   * own same-target check ran up to 229 turns stationary before this fix.
   *
   * This sidesteps that entirely by only ever asking "did the unit itself
   * actually move," never caring what it was trying to do. Call once per
   * turn for a unit pursuing an ongoing multi-turn goal; returns true once
   * position has been unchanged for >= thresholdTurns consecutive calls.
   * Self-resets the instant the unit's position differs from the last
   * recorded one (including via the caller's own stuck-recovery action,
   * e.g. wanderUnit actually moving it) -- callers never need to manually
   * clear their tracking state.
   *
   * `key` namespaces the tracking per BEHAVIOR, not just per unit -- a
   * galley's stranded-unit-pickup logic falls through to calling
   * exploreWater as its own fallback within the same turn (pre-existing
   * behavior); without separate keys, that fallback's own isUnitStalled
   * check would see the position-hasn't-changed-yet state the pickup
   * check just recorded THIS turn and double-count it, tripping its
   * threshold about twice as fast as intended. Reuse the SAME key across
   * calls that represent one continuous behavior even across function
   * boundaries (e.g. exploreWith and exploreWater both use "explore" --
   * a unit is only ever one or the other, land or naval, never both).
   *
   * Deliberately NOT applied to Dungeon Delve / Gold Vein "marching to
   * start a claim" -- those are long, genuinely stationary-once-arrived
   * economic commitments by design, not a movement bug (user-confirmed).
   */
  function isUnitStalled(unit, key, thresholdTurns = 3) {
    unit._stall = unit._stall || {};
    let rec = unit._stall[key];
    if (!rec) { rec = { x: unit.x, y: unit.y, turns: 0 }; unit._stall[key] = rec; }
    if (rec.x === unit.x && rec.y === unit.y) {
      rec.turns++;
    } else {
      rec.x = unit.x;
      rec.y = unit.y;
      rec.turns = 0;
    }
    return rec.turns >= thresholdTurns;
  }

  /**
   * How much a candidate settle tile should be discounted for sitting in or
   * near a known combat area -- a currently-visible enemy military unit, or
   * a tile actively being fought over (tile.status === "contested"). Only
   * CURRENTLY visible enemies count (no tileMemory/stale positions -- same
   * convention as huntNearestEnemy/assessInvasionTarget: troop positions go
   * stale the instant they're out of sight, unlike a city). Distance falloff
   * is linear out to SETTLE_DANGER_RADIUS so a founding decision isn't
   * derailed by a lone raider several tiles off, but a pioneer strongly
   * avoids founding right in an active battle. A penalty, not a hard veto --
   * mirrors affinityWeight's philosophy (see findBestSettleSite): never
   * blocks founding outright if every legal site happens to be contested,
   * it just makes a peaceful site win out over a war-torn one of similar
   * quality.
   */
  const SETTLE_DANGER_RADIUS = 6;
  function settleDangerPenalty(civ, gameState, x, y) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const tile = map.tiles[y * map.width + x];
    let penalty = tile.status === "contested" ? 6 : 0;
    let nearestEnemyDist = Infinity;
    for (const other of Object.values(civs)) {
      if (other.id === civ.id || other.eliminated) continue;
      for (const u of other.units) {
        if (window.GameData.getUnit(u.typeId).category !== "military") continue;
        if (!visible.has(u.y * map.width + u.x) || u.conditions?.hidden) continue;
        const d = window.GameEngine.influence.chebyshev(x, y, u.x, u.y);
        if (d < nearestEnemyDist) nearestEnemyDist = d;
      }
    }
    if (nearestEnemyDist <= SETTLE_DANGER_RADIUS) {
      penalty += (SETTLE_DANGER_RADIUS - nearestEnemyDist) * 2;
    }
    return penalty;
  }

  function findBestSettleSite(civ, gameState, pioneer) {
    const { map, civs } = gameState;
    const SEARCH_RADIUS = 9;
    const race = window.GameData.getRace(civ.raceId);
    const expansionism = race.expansionism ?? 0.5;
    // How much a race holds out for terrain matching its own bonuses vs. just
    // grabbing decent land: 0.6 at expansionism=0 (picky) down to 0.15 at
    // expansionism=1 (settles for whatever's available). This never blocks
    // founding outright (there's no cutoff -- the best-scoring legal tile is
    // always returned below, or the emergency fallback further down), it just
    // controls how much a nearby non-premium tile loses out to a farther
    // premium one for an eager expander.
    const affinityWeight = 0.6 - expansionism * 0.45;

    // Restrict candidates to the pioneer's own landmass so the AI never tries to
    // road-walk across water toward a home-island site when the pioneer is on a
    // foreign shore.
    const pioneerTile = map.tiles[pioneer.y * map.width + pioneer.x];
    const pioneerLandmassId = pioneerTile ? pioneerTile.landmassId : -1;

    // Strongly prefer coastal founding when civ has no coastal city, so future
    // pioneers can use naval transport to reach other islands.
    const needsCoast = !civ.cities.some(c => c.isPort || isCoastalTile(map, c.x, c.y));

    let best = null, bestScore = -Infinity;
    for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
      for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
        const x = pioneer.x + dx, y = pioneer.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const tile = map.tiles[y * map.width + x];
        // Only consider sites on the same landmass as the pioneer
        if (pioneerLandmassId >= 0 && tile.landmassId !== pioneerLandmassId) continue;
        const check = window.GameEngine.cities.canFoundCityAt(map, civs, x, y, civ.raceId, { skipRoadCheck: true });
        if (!check.ok) continue;
        const dist = window.GameEngine.influence.chebyshev(pioneer.x, pioneer.y, x, y);
        const terrain = window.GameData.TERRAIN[tile.terrain];
        if (terrain.isWater && dist > 0) continue;
        // computeTileCityScore already includes a flat +1 for any coastal
        // tile; add the situational boost on top when this civ has no
        // coastal city at all yet (badly needs one, for future naval reach).
        const baseScore = computeTileCityScore(civ, gameState, x, y, affinityWeight);
        const extraCoastalBonus = (needsCoast && isCoastalTile(map, x, y)) ? 4 : 0;
        // Distance penalty deliberately lighter than a naive "closest legal
        // site wins" -- score differences between candidate tiles should
        // dominate the choice, so a meaningfully better tile a few steps
        // farther away still beats a mediocre one right next door. This never
        // risks paralysis: the loop below always keeps the single best-scoring
        // tile found (or falls through to the emergency search further down),
        // it just changes WHICH tile that ends up being.
        const score = baseScore + extraCoastalBonus - dist * 0.15 - settleDangerPenalty(civ, gameState, x, y);
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    if (best) return best;

    // Emergency fallback: no valid site at the normal MIN_CITY_SPACING.
    // Relax to EMERGENCY_CITY_SPACING so a civ stranded on a tiny island can
    // still get a new (ideally coastal) city from which to build a galley
    // and expand further. MUST match the threshold `canFoundCityAt` itself
    // applies when this candidate is later founded with `emergencyFound:
    // true` (see the `candidate.emergency` arrival check above) -- this used
    // to hardcode a bare `2` here while canFoundCityAt required
    // EMERGENCY_CITY_SPACING (3), so a distance-2 tile could be returned as
    // a "valid" candidate here and then unconditionally rejected on arrival
    // every single time, with no memory of the failure -- confirmed
    // directly as a real permanent pioneer-stall (see
    // [[project_halfellow_tactics]]'s pacing investigation).
    const EMERGENCY_CITY_SPACING = window.GameEngine.cities.EMERGENCY_CITY_SPACING;
    bestScore = -Infinity;
    for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
      for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
        const x = pioneer.x + dx, y = pioneer.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const tile = map.tiles[y * map.width + x];
        const terrain = window.GameData.TERRAIN[tile.terrain];
        if (terrain.isWater || tile.terrain === "mountains") continue;
        if (tile.status === "owned" && tile.ownerCivId) {
          const ownerCiv = Object.values(civs).find(c => c.id === tile.ownerCivId);
          if (ownerCiv && ownerCiv.raceId !== civ.raceId) continue;
        }
        let tooClose = false;
        for (const c of Object.values(civs)) {
          for (const city of c.cities) {
            if (window.GameEngine.influence.chebyshev(x, y, city.x, city.y) < EMERGENCY_CITY_SPACING) {
              tooClose = true; break;
            }
          }
          if (tooClose) break;
        }
        if (tooClose) continue;
        const dist = window.GameEngine.influence.chebyshev(pioneer.x, pioneer.y, x, y);
        const coastal = isCoastalTile(map, x, y);
        // In emergency mode, strongly prefer coastal tiles to enable future galley expansion.
        // Danger still nudges the choice (half-weighted -- a stranded civ can't
        // afford to be as picky as the normal loop above) but never blocks a
        // desperate founding outright.
        const score = (coastal ? 8 : 0) + (tile.resource ? 2 : 0) - dist * 0.3
          - settleDangerPenalty(civ, gameState, x, y) * 0.5;
        if (score > bestScore) { bestScore = score; best = { x, y, emergency: true }; }
      }
    }
    return best;
  }

  /** True if `tile` holds a structure (wall OR any other building) belonging
   *  to a civ other than `civId` -- ownership check only, no flying
   *  exemption. Used both by isEnemyStructureBlockingTile below (which DOES
   *  apply the flying exemption, for costFn's pass-through check) and by
   *  moveUnitToward's landing-safety check (which deliberately does NOT --
   *  a flying unit may cross the space above an enemy structure, but must
   *  never actually stop there, same as it never stops on an occupied tile). */
  function hasEnemyStructure(tile, civId) {
    return !!tile.structure && tile.structure.civId !== civId;
  }

  /** True if a civ other than `civId` has a city standing at (x,y) -- same
   *  ownership-only semantics as hasEnemyStructure above (cities aren't
   *  marked directly on the tile object, so this scans civs' city lists;
   *  cheap, a handful of cities per civ at most). */
  function hasEnemyCity(civs, x, y, civId) {
    for (const c of Object.values(civs)) {
      if (c.id === civId) continue;
      if (c.cities.some((city) => city.x === x && city.y === y)) return true;
    }
    return false;
  }

  /** Returns the Hidden unit belonging to a civ other than `civId` standing
   *  at (x,y), or null. Used by moveUnitToward's step loop: a Hidden unit is
   *  excluded from every OTHER civ's occupancy set (see buildOccupancySet),
   *  so an unsuspecting mover can walk right onto/through its tile -- doing
   *  so is what reveals it (see the Hidden condition rules). */
  function findHiddenEnemyAt(civs, x, y, civId) {
    for (const c of Object.values(civs)) {
      if (c.id === civId) continue;
      const hit = c.units.find((u) => u.x === x && u.y === y && u.conditions?.hidden);
      if (hit) return hit;
    }
    return null;
  }

  /** True if `tile` holds an enemy structure (wall OR any other building --
   *  previously this only checked walls, silently letting a unit walk onto/
   *  through an enemy Bazaar, Guild Hall, etc.) that should block `unit`'s
   *  movement onto it. Own structures never block (a civ isn't fenced in by
   *  its own buildings), and flying units bypass entirely (base property OR
   *  a temporary grant, e.g. Human's Flight -- see combat.js's isFlying) --
   *  same "moves over all terrain" treatment they already get everywhere
   *  else; see moveUnitToward's landing-safety check for why a flying unit
   *  still never actually stops on one. */
  function isEnemyStructureBlockingTile(tile, unit) {
    if (!hasEnemyStructure(tile, unit.civId)) return false;
    return !window.GameEngine.combat.isFlying(unit);
  }

  /** True if (x,y) holds an enemy city that should block `unit`'s movement
   *  onto it -- same reasoning and flying exemption as
   *  isEnemyStructureBlockingTile above. */
  function isEnemyCityBlockingTile(civs, x, y, unit) {
    if (!hasEnemyCity(civs, x, y, unit.civId)) return false;
    return !window.GameEngine.combat.isFlying(unit);
  }

  // A road tile costs a flat 1 movement point to enter, regardless of the
  // underlying terrain -- "removes any terrain based movement penalties"
  // (2026-07-17, user-directed). 1 is the cheapest a land terrain can
  // already be (Plains/Desert/Tundra), so this never makes a road tile
  // BETTER than the best natural terrain, only neutralizes the 2-cost
  // penalty on Forest/Hills/Swamp (and, in the rare case a Pioneer with
  // mountain-tunneling tech built one on Mountains, its own 3-cost tunnel
  // rate too). See moveUnitToward's separate +1 movement bonus for a unit
  // that STARTS its turn on a road -- a different mechanic, stacks with this.
  const ROAD_MOVE_COST = 1;

  function getMoveCost(terrain, unitData, unit, hasRoad) {
    // Flying units "move over all terrain" (see units.js's flying doc comment) --
    // flat cost regardless of water/mountains/land movement penalties, ignoring
    // every other rule below (naval cost, tunneling, terrain overrides, roads --
    // none of them mean anything to a unit that never touches the ground).
    // Checks the live unit (base property OR a temporary grant, e.g. Human's
    // Flight) when available, falling back to the base data's flying flag
    // otherwise.
    if (unit ? window.GameEngine.combat.isFlying(unit) : unitData.flying) return 1;
    if (unitData.isNaval) return terrain.moveCostNaval ?? window.GameData.IMPASSABLE; // roads are a land-only feature
    if (hasRoad) return ROAD_MOVE_COST;
    const mods = unit && unit._moveMods;
    // Tech-unlocked mountain tunneling: otherwise-impassable terrain becomes traversable
    if (terrain.id === "mountains" && terrain.moveCostLand === window.GameData.IMPASSABLE && mods?.canTunnel) {
      return 3; // slow but passable
    }
    const override = mods?.terrainOverride?.[terrain.id];
    if (override != null) return Math.min(terrain.moveCostLand, override);
    return terrain.moveCostLand;
  }

  /**
   * BFS reachability check for land units. Returns true if (toX,toY) can be
   * reached by walking from (fromX,fromY) without crossing water or mountains.
   * Limits search to maxSearch tiles so it stays fast per-unit-per-turn.
   * Flying units bypass this entirely -- they move over all terrain, so
   * water/mountains never block them from "reaching" anywhere on the map.
   */
  function canReachByLand(fromX, fromY, toX, toY, map, maxSearch = 150, unit = null) {
    if (unit && window.GameEngine.combat.isFlying(unit)) return true;
    const w = map.width, h = map.height;
    const TERRAIN = window.GameData.TERRAIN;
    const canTunnel = !!(unit && unit._moveMods && unit._moveMods.canTunnel);
    const targetIdx = toY * w + toX;
    const startIdx  = fromY * w + fromX;
    if (startIdx === targetIdx) return true;
    const visited = new Set([startIdx]);
    const queue   = [startIdx];
    while (queue.length > 0 && visited.size <= maxSearch) {
      const cur = queue.shift();
      const cx  = cur % w, cy = Math.floor(cur / w);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (visited.has(nIdx)) continue;
          const t = TERRAIN[map.tiles[nIdx].terrain];
          const blockedMountain = t.moveCostLand === window.GameData.IMPASSABLE && !(t.id === "mountains" && canTunnel);
          if (t.isWater || blockedMountain) continue;
          if (nIdx === targetIdx) return true;
          visited.add(nIdx);
          queue.push(nIdx);
        }
      }
    }
    return false;
  }

  /**
   * True if a Ranged attack (see combat.js's effectiveRange) from
   * (ax,ay) to (tx,ty) has a clear line to its target -- false if a
   * Mountain tile stands anywhere on the straight line between them. Water
   * and every other terrain never blocks it; only Mountains do. Adjacent
   * tiles (Chebyshev distance <= 1) are always clear regardless -- nothing
   * blocks a target close enough to melee anyway.
   *
   * Walks the line at 4x the tile distance's resolution and rounds each
   * sample to its nearest tile, rather than a grid-stepping (Bresenham-
   * style) algorithm -- at 4x oversampling, consecutive rounded samples can
   * never skip a tile (each step moves at most 1/4 of a tile along the
   * dominant axis), so this can't miss a Mountain the line actually grazes,
   * including at a diagonal corner. Endpoints (the attacker's own tile and
   * the target's own tile) are excluded -- line-of-sight blocking is about
   * what's IN BETWEEN, not the two tiles doing the shooting/getting shot.
   */
  function hasRangedLineOfSight(map, ax, ay, tx, ty) {
    if (window.GameEngine.influence.chebyshev(ax, ay, tx, ty) <= 1) return true;
    const dx = tx - ax, dy = ty - ay;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    const samples = dist * 4;
    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      const x = Math.round(ax + dx * t);
      const y = Math.round(ay + dy * t);
      if ((x === ax && y === ay) || (x === tx && y === ty)) continue;
      if (map.tiles[y * map.width + x]?.terrain === "mountains") return false;
    }
    return true;
  }

  /** Tiles currently occupied by a "top-level" unit -- i.e. not itself being
   *  carried (a carried unit doesn't independently occupy a tile; it's inside
   *  its carrier). Used to block units from ever stacking onto each other,
   *  the one exception being a carrier (e.g. Galley) and whatever it carries. */
  function buildOccupancySet(civs, excludeUnit) {
    const occ = new Set();
    if (!civs) return occ;
    for (const c of Object.values(civs)) {
      for (const u of c.units) {
        if (u === excludeUnit || u.carriedBy) continue;
        // Hidden: undetectable to other civs -- "AI treats it as if not
        // there" extends to pathfinding too, so an enemy doesn't route
        // around a Hidden unit it doesn't know is there. Still blocks the
        // SAME civ's own units (a civ always knows where its own unit is,
        // hidden or not). See moveUnitToward's step loop for how walking
        // through/onto a Hidden enemy's tile reveals it.
        if (u.conditions?.hidden && u.civId !== excludeUnit?.civId) continue;
        occ.add(`${u.x},${u.y}`);
      }
    }
    return occ;
  }

  /** Tiles occupied by another FLYING unit -- the only thing that blocks a
   *  flying unit's flight path. Ground units don't: a flying unit can pass
   *  straight over them mid-route (see moveUnitToward's landing-safety check
   *  for why it still never actually stops/stacks on an occupied tile). */
  function buildFlyingBlockSet(civs, excludeUnit) {
    const occ = new Set();
    if (!civs) return occ;
    for (const c of Object.values(civs)) {
      for (const u of c.units) {
        if (u === excludeUnit || u.carriedBy) continue;
        if (!window.GameEngine.combat.isFlying(u)) continue;
        // Hidden: see buildOccupancySet -- same exemption for other civs.
        if (u.conditions?.hidden && u.civId !== excludeUnit?.civId) continue;
        occ.add(`${u.x},${u.y}`);
      }
    }
    return occ;
  }

  function moveUnitToward(unit, targetX, targetY, map, civs) {
    const baseUnit = window.GameData.getUnit(unit.typeId);
    // Flying (base property OR a temporary grant, e.g. Human's Flight -- see
    // combat.js's isFlying) units may fly OVER a tile occupied by a non-flying
    // unit (only another flying unit blocks their path); they must still never
    // actually land/stop on any occupied tile, which the landing-safety check
    // below enforces using the full occupancy set instead.
    const flying = window.GameEngine.combat.isFlying(unit);
    const occupied = flying ? buildFlyingBlockSet(civs, unit) : buildOccupancySet(civs, unit);
    const fullOccupied = flying ? buildOccupancySet(civs, unit) : occupied;
    // civ.unitOverrides movement delta (e.g. Orc's Swift Hunters: +1 Wolf Rider movement)
    const overrideMovement = unit._moveMods?.unitOverrides?.[unit.typeId]?.movement || 0;
    let movement = baseUnit.movement + overrideMovement;
    // Tech-unlocked terrain movement bonus: extra movement points while standing
    // on the race's favored terrain at the start of this move (e.g. Human on Plains).
    // "river" is a pseudo-terrain key checked separately since rivers overlay
    // any base terrain (tile.hasRiver) rather than being their own terrain id.
    // Civ-wide bonuses (terrainBonus) and per-unit-type bonuses (unitTerrainBonus,
    // e.g. Orc's Forced March applying only to Raiders/Wolf Riders/Ogres) both
    // add together -- but WITHIN each of those two layers, a tile matching
    // multiple bonus keys at once (e.g. Hills that also has a river, with both
    // Singing Hills and Riverfolk researched) takes the single best one, not
    // the sum -- movement bonuses from multiple tile features never stack.
    const startTile = map.tiles[unit.y * map.width + unit.x];
    const startTerrainId = startTile?.terrain;
    const startHasRiver = startTile?.hasRiver && (startTile.hasRiver.n || startTile.hasRiver.s || startTile.hasRiver.e || startTile.hasRiver.w);
    const civWideBonus = Math.max(
      unit._moveMods?.terrainBonus?.[startTerrainId] || 0,
      startHasRiver ? (unit._moveMods?.terrainBonus?.river || 0) : 0,
    );
    const perUnitBonus = Math.max(
      unit._moveMods?.unitTerrainBonus?.[unit.typeId]?.[startTerrainId] || 0,
      startHasRiver ? (unit._moveMods?.unitTerrainBonus?.[unit.typeId]?.river || 0) : 0,
    );
    const terrainBonus = civWideBonus + perUnitBonus;
    if (terrainBonus) movement += terrainBonus;

    // Roads: +1 movement for a unit starting its turn on a road tile
    // (2026-07-17, user-directed) -- universal and tech-independent, unlike
    // the tiered terrain bonuses above, so it stacks on top of them rather
    // than competing in the same "best of" comparison. Pairs with
    // getMoveCost's flat ROAD_MOVE_COST=1 (roads also removing terrain
    // movement penalties) -- together a road network both starts a unit's
    // turn with extra movement AND makes every road tile along the route
    // cheap to cross.
    if (startTile?.hasRoad) movement += 1;

    // Tech: Orc "Violent Momentum" -- +2 movement for a unit that killed an
    // enemy the previous turn (see applyOrcCombatMechanics/killMomentum).
    // Additive, same as the terrain bonus above, before any multiplicative
    // modifiers (curse/hidden/frozen) below.
    if (unit.conditions?.killMomentum) movement += unit.conditions.killMomentum.moveBonus;

    // Human "Flight": a unit granted temporary flight also gets +2 movement
    // for the duration (see performWizardGrantFlight) -- additive, same as
    // Violent Momentum above.
    if (unit.conditions?.flying) movement += unit.conditions.flying.moveBonus || 0;

    // Orc Bog Witch curse (death-curse or Malefic Malediction): halves movement
    // while active. Applied after the terrain bonus so a cursed unit still gets
    // its terrain bonus, just halved along with everything else.
    if (unit.conditions?.curse) movement *= unit.conditions.curse.moveMult;

    // Human "Freezing Touch": Frozen means 0 movement, full stop -- not just
    // reduced, unlike Hidden/curse above. The unit can still attack if an
    // enemy is already adjacent (considerAttackOrGarrison never calls this
    // function), it just can't close distance or reposition.
    if (unit.conditions?.frozen) movement = 0;

    // Hidden: moving carefully to stay unseen costs 66% of movement, floored
    // at 1 so a Hidden unit is slow, never fully immobile.
    if (unit.conditions?.hidden) movement = Math.max(1, Math.round(movement * 0.34));

    // Tech: Halfellow "Devoted Companions" -- carrying a passenger costs 25% movement.
    if (unit.carries) {
      const carrierCiv = civs?.[unit.civId];
      if (carrierCiv?.unlockedMechanics?.has("devoted_companions")) movement = Math.max(1, Math.round(movement * 0.75));
    }

    // Full route via A*, not a per-step greedy hill-climb -- this is what lets a unit
    // detour around a mountain range or bay instead of stopping dead against it. If the
    // exact target tile can't be reached (e.g. a land unit "heading toward" a galley
    // sitting on water), findPath falls back to the closest reachable tile instead.
    const costFn = (nx, ny, tile) => {
      if (occupied.has(`${nx},${ny}`)) return window.GameData.IMPASSABLE;
      if (isEnemyStructureBlockingTile(tile, unit)) return window.GameData.IMPASSABLE;
      if (isEnemyCityBlockingTile(civs, nx, ny, unit)) return window.GameData.IMPASSABLE;
      const terrain = window.GameData.TERRAIN[tile.terrain];
      return getMoveCost(terrain, baseUnit, unit, tile.hasRoad);
    };
    const path = window.GameEngine.pathfinding.findPath(unit.x, unit.y, targetX, targetY, map, costFn);
    if (!path) return;
    window.GameEngine.quips.maybeQuip(unit, civs?.[unit.civId], "move", currentGameStateRef);
    for (let i = 0; i < path.length; i++) {
      if (movement <= 0) break;
      const step = path[i];
      const isLandingStep = (i === path.length - 1 || movement - step.cost <= 0);

      // Hidden: this tile was excluded from `occupied`/`fullOccupied` above
      // if the unit standing there belongs to another civ (see
      // buildOccupancySet), so an unsuspecting mover can walk right onto/
      // through it -- doing so is what reveals the Hidden unit, whether
      // this is just a pass-through step or the final landing step. Applies
      // to every unit, not just flying -- Hidden units are excluded from
      // EVERY other civ's occupancy set, not only a flier's.
      const revealedEnemy = findHiddenEnemyAt(civs, step.x, step.y, unit.civId);
      if (revealedEnemy) window.GameEngine.combat.revealHidden(revealedEnemy, currentTurnNumber);
      if (isLandingStep && revealedEnemy) break; // don't stack on the now-visible unit

      // Landing-safety check (flying only): a flying unit's costFn already lets
      // it path straight through a tile occupied by a ground unit, an enemy
      // structure, or an enemy city (all "moves over all terrain"), but it
      // must never actually stop there. If this step would be where it stops
      // -- either because movement runs out here, or because it's the final
      // step in the whole path -- and the tile is blocked by any of those,
      // stop one tile short instead. Deliberately re-checks structure/city
      // ownership WITHOUT the flying exemption isEnemyStructureBlockingTile/
      // isEnemyCityBlockingTile apply for costFn's pass-through case -- a
      // flier crossing OVER an enemy wall is fine, landing on it isn't.
      if (flying && isLandingStep) {
        const stepTile = map.tiles[step.y * map.width + step.x];
        const landingBlocked = fullOccupied.has(`${step.x},${step.y}`)
          || hasEnemyStructure(stepTile, unit.civId)
          || hasEnemyCity(civs, step.x, step.y, unit.civId);
        if (landingBlocked) break;
      }
      unit.x = step.x;
      unit.y = step.y;
      movement -= step.cost;
    }
  }

  function maybeBuildInCities(civ, gameState, weights, log) {
    for (const city of civ.cities) {
      if (city.buildQueue) {
        progressBuildQueue(civ, city, gameState, log);
        continue;
      }
      const choice = chooseBuildAction(civ, city, gameState, weights);
      if (choice) {
        if (choice.cost) {
          // Power-based unit cost (see buildUnitOption): pay the one-time
          // multi-resource cost from the civ's stockpile right now, then
          // just count down the fixed turn timer -- no further income
          // dependency at all, unlike the legacy coin-accumulation path.
          civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
          for (const [k, v] of Object.entries(choice.cost)) {
            civ.stockpile[k] = Math.max(0, (civ.stockpile[k] || 0) - v);
          }
          city.buildQueue = { kind: "unit", id: choice.id, turnsRemaining: choice.turns };
        } else {
          city.buildQueue = { ...choice, progress: 0 };
        }
        log.push(`Build: ${city.name} started ${choice.kind} "${choice.id}"`);
      }
    }
  }

  function findAdjacentWater(x, y, map) {
    const TERRAIN = window.GameData.TERRAIN;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) return { x: nx, y: ny };
      }
    }
    return null;
  }

  /** Any in-bounds, non-water tile adjacent to (x,y), chosen at random --
   *  used for a bonus unit spawn (see spawnUnitInCity's Goblin Miscreant
   *  handling) that shouldn't just stack onto the city's own tile. Returns
   *  null if every neighbor is water (rare, but possible on a tiny island). */
  function findRandomAdjacentLandTile(x, y, map) {
    const TERRAIN = window.GameData.TERRAIN;
    const candidates = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (!TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) candidates.push({ x: nx, y: ny });
      }
    }
    return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
  }

  function isCoastalTile(map, x, y) {
    const TERRAIN = window.GameData.TERRAIN;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) return true;
      }
    }
    return false;
  }

  function civHasReachableSettleSite(civ, gameState) {
    const { map, civs } = gameState;
    // Check a wide radius around every existing city for at least one valid founding tile
    const SEARCH = 15;
    for (const city of civ.cities) {
      for (let dy = -SEARCH; dy <= SEARCH; dy++) {
        for (let dx = -SEARCH; dx <= SEARCH; dx++) {
          const x = city.x + dx, y = city.y + dy;
          if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
          const check = window.GameEngine.cities.canFoundCityAt(map, civs, x, y, civ.raceId, { skipRoadCheck: true });
          if (check.ok && !window.GameData.TERRAIN[map.tiles[y * map.width + x].terrain].isWater) return true;
        }
      }
    }
    return false;
  }

  // Shared everywhere upkeep needs to be summed across harvest/coin/lore --
  // see GameData.unitUpkeep for what each unit actually costs per turn now
  // (5% of its build cost, derived, not a flat stored value).
  const UPKEEP_RESOURCE_KEYS = ["harvest", "coin", "lore"];

  /** Sums this civ's current units' upkeep across all 3 resources. */
  function totalUnitUpkeep(civ) {
    const total = { harvest: 0, coin: 0, lore: 0 };
    for (const u of civ.units) {
      const up = window.GameData.unitUpkeep(u.typeId, civ, u);
      for (const k of UPKEEP_RESOURCE_KEYS) total[k] += up[k] || 0;
    }
    return total;
  }

  /**
   * Returns true if the civ can sustain the upkeep of one more unit of unitId.
   * Militaristic races tolerate longer drain periods (higher threshold);
   * peaceful races stop building units as soon as income goes negative.
   * Undead bypass this entirely via noUpkeep.
   */
  function canAffordUnitUpkeep(civ, unitId, race) {
    if (race.noUpkeep) return true;
    const newUpkeep = window.GameData.unitUpkeep(unitId, civ);
    const totals = totalUnitUpkeep(civ);
    const net = {};
    for (const k of UPKEEP_RESOURCE_KEYS) net[k] = (civ.resources?.[k] || 0) - totals[k] - (newUpkeep[k] || 0);
    if (UPKEEP_RESOURCE_KEYS.every((k) => net[k] >= 0)) return true; // income still covers everything
    // How many turns until the stockpile runs dry at this drain rate
    const militarism = effectiveMilitarism(civ);
    const threshold = Math.round(3 + militarism * 14);
    let turnsUntilBroke = Infinity;
    for (const k of UPKEEP_RESOURCE_KEYS) {
      const drain = Math.max(0, -net[k]);
      if (drain > 0) turnsUntilBroke = Math.min(turnsUntilBroke, (civ.stockpile?.[k] || 0) / drain);
    }
    // Militarism controls how many turns of deficit the civ will tolerate:
    // low militarism (0.1) → ~4 turns; high militarism (0.9) → ~16 turns
    return turnsUntilBroke >= threshold;
  }

  /**
   * Counts units of a category that are currently QUEUED (mid-build, not yet
   * completed) across ALL of this civ's cities. Without this, every city with
   * an empty buildQueue independently checks civ.units (already-completed
   * units only) for cap/uniqueness decisions -- so when several cities empty
   * out on the same turn (common: game start, or a batch finishing together),
   * each one concludes "no pioneer yet" / "under the cap" and queues its own,
   * unaware a sibling city already committed to the same thing this turn.
   * That race condition was the main cause of runaway unit production.
   */
  function countQueuedUnits(civ, predicate) {
    return civ.cities.reduce((sum, c) => {
      if (c.buildQueue && c.buildQueue.kind === "unit" && predicate(c.buildQueue.id)) return sum + 1;
      return sum;
    }, 0);
  }

  function totalPopulation(civ) {
    return civ.cities.reduce((s, c) => s + Math.floor(c.population), 0);
  }

  /**
   * Shared military-cap formula (also used for UI display, so the sidebar
   * can show "current / cap" without re-deriving this math separately).
   * Tuned so a well-developed civ lands around 20 land military units
   * late-game, plus or minus 5, with more aggressive/militaristic races
   * landing toward the top of that band or a bit above.
   *
   * Two parts: a linear ramp (`rate` x total population) so a small young
   * civ's cap grows naturally with its economy, and a `ceiling` that ramp
   * saturates toward for a large one. The ceiling is the part that actually
   * matters late-game -- total population has no upper bound of its own
   * (more cities keeps adding to it forever), so a pure linear formula lets
   * a successful, wide civ's army run away with it: testing found a
   * 6-7-city civ hitting 44-53 units under a linear-only version of this
   * formula, well past the target. The ramp rate still controls how fast a
   * civ approaches its ceiling as it grows, so early/mid-game armies stay
   * proportionate instead of jumping straight to the ceiling.
   *
   * Undead get both a higher rate and a higher ceiling, since fielding a
   * swarm (no upkeep) is their identity.
   */
  function computeMilitaryCap(civ) {
    const race = window.GameData.getRace(civ.raceId);
    const militarism = effectiveMilitarism(civ);
    const pop = totalPopulation(civ);
    const rate    = race.noUpkeep ? (0.9 + militarism * 0.8) : (0.7 + militarism * 0.6);
    const ceiling = race.noUpkeep ? (25 + militarism * 10)   : (18 + militarism * 10);
    return Math.max(1, Math.min(ceiling, Math.round(pop * rate)));
  }

  // Tune via headless sim: aiming for a militarism=0.5 civ that has just
  // reached tech layer 3 (see techs.js unitUpkeepLayerPremium) to land close
  // to 12 -- see project memory / game_rules_adjustments for the target.
  // NOTE: this reference number predates UPKEEP_LAYER_PREMIUM_RATE being
  // raised from LAYER_PREMIUM_RATE's 0.18 to 0.40 -- re-validate via headless
  // sim, since a layer-3 army's real upkeep (and thus how much strain a given
  // army size represents) is now noticeably higher than when this was tuned.
  const SUSTAIN_RATE_BASE = 0.5;
  const SUSTAIN_RATE_RANGE = 0.7;

  /** The size a civ's land military can hold "at ease" -- below this,
   *  upkeepStrainMultiplier is 1 (no strain). Distinct from
   *  computeMilitaryCap just above, which is how big an army the AI
   *  *wants* to build late-game (ambition, saturating at a hard ceiling);
   *  this is where the *economy* starts to actually strain (no ceiling --
   *  a bigger, more populous civ earns genuinely more headroom, not just a
   *  faster climb toward the same wall). Same population x militarism
   *  shape as computeMilitaryCap, tuned lower and separately, since the two
   *  numbers serve different purposes and shouldn't be forced to move
   *  together. */
  function sustainableArmySize(civ) {
    const militarism = effectiveMilitarism(civ);
    const pop = totalPopulation(civ);
    const rate = SUSTAIN_RATE_BASE + militarism * SUSTAIN_RATE_RANGE;
    return Math.max(1, Math.round(pop * rate));
  }

  // How sharply upkeep strain bites once a civ is over its sustainable army
  // size, at militarism 0 vs 1 (interpolated by effectiveMilitarism below).
  // A militaristic race's whole economy is built around fielding an army,
  // so the same overextension costs it noticeably less than it costs a
  // peaceful race running the same excess.
  const STRAIN_RATE_MAX = 1.8;
  const STRAIN_RATE_SOFTEN = 1.3;

  /** Civ-wide multiplier on military-unit upkeep, driven by how far the
   *  civ's land military (non-naval, military category -- same filter
   *  chooseStrategy/maybeDisband already use) sits above sustainableArmySize.
   *  1.0 at or under the sustainable size; climbs continuously (no cliff)
   *  the further over it a civ pushes, softened by militarism. This is what
   *  lets an army run past its "natural" size at all -- no hard cap, just a
   *  progressively heavier logistics bill, same mechanism as ordinary
   *  upkeep rather than a bolted-on rule. */
  function upkeepStrainMultiplier(civ) {
    const cap = sustainableArmySize(civ);
    const militaryCount = civ.units.filter((u) => {
      const ud = window.GameData.getUnit(u.typeId);
      return ud.category === "military" && !ud.isNaval;
    }).length;
    const excessRatio = Math.max(0, (militaryCount - cap) / cap);
    if (excessRatio === 0) return 1;
    const militarism = effectiveMilitarism(civ);
    const strainRate = STRAIN_RATE_MAX - militarism * STRAIN_RATE_SOFTEN;
    return 1 + excessRatio * strainRate;
  }

  // Global pacing knob for the power-based unit build-time formula below --
  // raise it to slow the whole game's military buildup down, lower it to
  // speed it up, without touching any race's relative build rate. Cut 20%
  // (0.30 -> 0.24) as part of the 2026-07-12 pacing experiment -- see
  // project_pacing_experiment memory. Only affects units built through the
  // power-based system (i.e. anything with an associated tech -- every
  // real combat unit across every race); Pioneer/Galley/Scout still use
  // the separate legacy flat-coinCost path and are untouched by this.
  const BUILD_SLOWNESS = 0.24;

  /** How fast this civ turns unit power into finished units -- industriousness
   *  (the same trait that drives building speed and tile fill-in rate) plus
   *  3/4 of effective militarism (so a highly militaristic civ, e.g. Orc,
   *  still builds military units at a reasonable clip despite low
   *  industriousness). Higher is faster. */
  function raceUnitBuildRate(civ) {
    const race = window.GameData.getRace(civ.raceId);
    const industriousness = race.industriousness ?? 0.5;
    return industriousness + 0.75 * effectiveMilitarism(civ);
  }

  /** Turns to build `unitId` for `civ`: (unit power / this civ's build rate)
   *  scaled by BUILD_SLOWNESS, rounded to the nearest whole turn (minimum 1
   *  -- a build always takes at least one turn, however cheap). See
   *  GameData.unitPower for what "power" means (base stats only, no tech
   *  bonuses) and buildUnitOption for where this timer starts counting down. */
  function unitBuildTurns(civ, unitId) {
    const power = window.GameData.unitPower(unitId);
    const rate = raceUnitBuildRate(civ);
    // Tech: build_speed_mult (Dwarf "Runeforged Tools") -- divides the
    // resulting turn count, civ-wide, for every power-based unit.
    const buildSpeedMult = civ.buildSpeedMult || 1;
    return Math.max(1, Math.round((power / rate) * BUILD_SLOWNESS / buildSpeedMult));
  }

  /** Units whose real value is an unlocked MECHANIC rather than their own
   *  combat stats -- Wizard's attack/defense are deliberately unremarkable
   *  (see units.js), but Teleportation (maybeTeleportStrike's teleported-
   *  Trebuchet play), Fireball, Dungeon Delve, and Invisibility all hinge on
   *  having one at all. militaryValue (in chooseBuildAction below) can't see
   *  any of that, so chooseBuildAction scores these separately instead of
   *  folding them into the garrison/offense picks. Keyed by unit id -> the
   *  list of mechanics that make it worth building; race-agnostic (checked
   *  purely via civ.unlockedMechanics) so a future race/mechanic pairing
   *  slots in here without touching the scoring logic itself. */
  const UTILITY_UNIT_MECHANICS = {
    wizard: ["teleportation", "fireball_splash", "dungeon_delve", "invisibility", "invulnerability_chance", "freezing_touch", "flight_grant"],
    druid: ["natures_grace", "roots_of_the_world", "raptor_summon", "shadow_steed_summon"],
  };

  // Elf "one Shadowsteed per Druid": extra Druid build score when every
  // existing Druid is already at its 1-Shadowsteed cap -- see the
  // UTILITY_UNIT_MECHANICS loop below. Comparable in size to a full
  // relevantMechanics.length*7 credit at owned=0 (28 for Druid's 4
  // mechanics), so a genuine shortage reliably wins the build slot.
  const DRUID_SHORTAGE_BONUS = 20;
  // Orc "Dire Wolf": comparable in size to DRUID_SHORTAGE_BONUS above --
  // big enough to reliably outcompete a garrison/offense pick (typically
  // 3-13, see chooseBuildAction) when the civ has zero live Dire Wolves.
  const DIRE_WOLF_SHORTAGE_BONUS = 20;

  /** Does civ.stockpile currently cover every resource key in `cost`? */
  function canAffordBuildCost(civ, cost) {
    const stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    return Object.entries(cost).every(([k, v]) => (stockpile[k] || 0) >= v);
  }

  // Pinnacle-unit rarity premium (2026-07-12): a `rare: true` unit (see
  // units.js -- currently Human's Paladin, Halfellow's Militia, Orc's
  // Dragon) should be a genuine, expensive flagship commitment, not
  // something that scales with population cap the same as any other combat
  // unit. Each copy a civ already owns (or has queued) compounds BOTH the
  // cost and the build time of the next one by this rate -- same
  // compounding shape as techLayerPremium/unitLayerPremium elsewhere in
  // this codebase, just keyed off owned-count instead of tech layer. At
  // 0.45: 1st copy pays no premium, 2nd costs 1.45x, 3rd 2.10x, 4th 3.05x,
  // 5th 4.42x -- affordable to field 2-3 as a real army anchor, ruinous to
  // mass-produce past that. See project_dragon_rebalance memory.
  const RARE_UNIT_PREMIUM_RATE = 0.45;
  // `veryRare: true` (2026-07-15, currently only Dwarf's Runeforged Titan)
  // is a steeper tier above `rare` for a unit that should feel like a
  // once-in-a-game commitment rather than a repeatable army anchor -- users
  // observed Dwarf civs fielding multiple Titans under the ordinary `rare`
  // premium. Raised 0.90 -> 1.50 (2026-07-18, user-directed: "veryRare units
  // should be rarer") -- at 1.5: 1st copy pays no premium, 2nd costs 2.5x,
  // 3rd 6.25x, 4th 15.63x, 5th 39.06x -- a 2nd Titan is now a genuinely hard
  // commitment, not just "real but reachable," and a 3rd is effectively
  // never worth it. Mutually exclusive with `rare` (checked first in
  // buildUnitOption below) rather than additive with it.
  const VERY_RARE_UNIT_PREMIUM_RATE = 1.50;

  // Disposable-filler discount (2026-07-14): the mirror-image of the rarity
  // premium above -- a `cheap: true` unit (currently only Orc's Goblin
  // Miscreant) is deliberately weak (Atk1/Def1) and meant to be built in
  // bulk as a gap-filler when nothing better is worth or affordable to
  // build, not scaled down from already being cheap by raw power alone.
  // Flat 30% off cost, build time, AND upkeep (see unitUpkeep in
  // techs.js for the upkeep side) -- user-directed, see
  // project_pairwise_balance_human_orc_halfellow memory.
  const CHEAP_UNIT_DISCOUNT_RATE = 0.30;

  /**
   * Builds a "unit" option for chooseBuildAction's options array, in
   * whichever cost model applies to `unitId`:
   *   - Power-based (see GameData.unitBuildCost/unitBuildTurns): a real
   *     one-time purchase from civ.stockpile (multi-resource, scaled with
   *     the unit's raw power) plus a fixed turn-count timer independent of
   *     the city's income. Returns null if not currently affordable --
   *     same all-or-nothing convention canAffordUnitUpkeep already uses
   *     elsewhere in this function, so the option just doesn't appear this
   *     turn rather than the civ going into debt for it.
   *   - Legacy flat coinCost (Pioneer, Galley, Human's free Scout -- the 3
   *     units with no associated tech, see GameData.techForUnit): unchanged
   *     coin-income-accumulation behavior via progressBuildQueue.
   * `unitCostMult` is the war-economy discount (e.g. Orc War Camp),
   * applied up front here instead of retroactively.
   */
  function buildUnitOption(civ, unitId, score, unitCostMult) {
    const unitData = window.GameData.getUnit(unitId);
    const cost = window.GameData.unitBuildCost(unitId);
    if (!cost) {
      const coinCost = Math.ceil(window.GameData.getUnit(unitId).coinCost * unitCostMult);
      return { kind: "unit", id: unitId, coinCost, score };
    }
    const discountedCost = {};
    for (const [k, v] of Object.entries(cost)) discountedCost[k] = Math.ceil(v * unitCostMult);
    // War Camp (Orc) and any future unitCostMult-granting structure now also
    // speeds up build TIME by the same fraction, not just resource cost --
    // previously unitCostMult only ever touched `discountedCost`, so a
    // building explicitly documented as "cheaper unit production" (see
    // buildings.js unitCostMult doc) didn't actually make units complete any
    // faster, only cheaper. User-directed change (2026-07-14) to test
    // whether letting Orc convert its (discounted) resources into standing
    // units faster helps it press its numeric/tactical advantage before
    // Halfellow's economy outpaces it -- see
    // project_pairwise_balance_human_orc_halfellow memory.
    let turns = Math.max(1, Math.round(unitBuildTurns(civ, unitId) * unitCostMult));
    // Rarity premium -- applied to cost BEFORE the affordability check below
    // (not after), so a civ that can't actually afford the true, inflated
    // price of its 4th Dragon correctly sees no option at all this turn,
    // rather than one it can't really pay for. veryRare and rare are
    // mutually exclusive tiers (see VERY_RARE_UNIT_PREMIUM_RATE above).
    if (unitData.veryRare || unitData.rare) {
      const owned = civ.units.filter((u) => u.typeId === unitId).length + countQueuedUnits(civ, (id) => id === unitId);
      const rate = unitData.veryRare ? VERY_RARE_UNIT_PREMIUM_RATE : RARE_UNIT_PREMIUM_RATE;
      const rarityMult = Math.pow(1 + rate, owned);
      for (const k of Object.keys(discountedCost)) discountedCost[k] = Math.ceil(discountedCost[k] * rarityMult);
      turns = Math.max(1, Math.ceil(turns * rarityMult));
    }
    if (unitData.cheap) {
      for (const k of Object.keys(discountedCost)) discountedCost[k] = Math.ceil(discountedCost[k] * (1 - CHEAP_UNIT_DISCOUNT_RATE));
      turns = Math.max(1, Math.ceil(turns * (1 - CHEAP_UNIT_DISCOUNT_RATE)));
    }
    if (!canAffordBuildCost(civ, discountedCost)) return null;
    // Pacing: a civ's very first military-category unit (of any kind -- the
    // race's basic melee, or whatever else happens to finish first) builds
    // at double speed, so the opening stretch of the game -- when nobody has
    // any army at all yet -- resolves faster. Turns off permanently the
    // instant that first one actually completes (see spawnUnitInCity's
    // civ._firstMilitaryBuilt flag); every later build, including a second
    // one still mid-queue elsewhere when the first finishes, goes back to
    // normal speed. Deliberately still applies on top of the rarity premium
    // above (a civ's first-ever military unit is vanishingly unlikely to be
    // a `rare` one this early, but nothing stops it in principle).
    if (unitData.category === "military" && !civ._firstMilitaryBuilt) {
      turns = Math.max(1, Math.ceil(turns / 2));
    }
    return { kind: "unit", id: unitId, cost: discountedCost, turns, score };
  }

  function chooseBuildAction(civ, city, gameState, weights) {
    const options = [];
    const { map, civs } = gameState;
    const race = window.GameData.getRace(civ.raceId);
    const militarism      = effectiveMilitarism(civ);
    const expansionism    = race.expansionism    ?? 0.5;
    const industriousness = race.industriousness ?? 0.5;
    const agg             = aggressivenessFor(civ);
    const underThreat     = detectThreat(civ, gameState);

    // Unit cost discount from war-economy structures (War Camp, etc.) --
    // apply the best (lowest) discount available in this city. Computed up
    // front (rather than retroactively over already-pushed options) since
    // buildUnitOption needs it to check affordability correctly.
    let unitCostMult = 1.0;
    for (const s of city.structures) {
      const m = window.GameData.getBuilding(s.id).unitCostMult;
      if (m && m < unitCostMult) unitCostMult = m;
    }

    // Upkeep sustainability check — compare per-turn income vs. total unit upkeep.
    // Races respond to economic stress using their existing personality traits:
    // militaristic races (militarism close to 1) still build some units when strapped;
    // peaceful races (militarism close to 0) stop building military almost entirely.
    const totalUpkeep = totalUnitUpkeep(civ);
    const incomeHarvest = civ.cities.reduce((s, c) => s + (c.lastYield ? c.lastYield.harvest : 0), 0);
    const incomeCoin    = civ.cities.reduce((s, c) => s + (c.lastYield ? c.lastYield.coin    : 0), 0);
    const incomeLore    = civ.cities.reduce((s, c) => s + (c.lastYield ? c.lastYield.lore    : 0), 0);
    const isSustainable = incomeHarvest >= totalUpkeep.harvest && incomeCoin >= totalUpkeep.coin && incomeLore >= totalUpkeep.lore;
    // How strapped we are: higher = more economic pressure to expand rather than build units
    const economicStress = Math.max(0, totalUpkeep.harvest - incomeHarvest, totalUpkeep.coin - incomeCoin, totalUpkeep.lore - incomeLore);
    // Military build multiplier: strapped civs scale back based on militarism personality
    const militaryEconMult = isSustainable ? 1.0 : 0.15 + militarism * 0.5;
    // Expansion multiplier: more attractive when income can't cover current army
    const settleEconBonus  = isSustainable ? 0 : Math.min(6, economicStress * 0.5);

    // Include units already queued (mid-build) elsewhere in the civ, not just
    // completed ones -- otherwise every city with an empty queue on the same
    // turn independently thinks "we have none yet" and each queues its own.
    const civHasPioneer  = civ.units.some((u) => u.typeId === "pioneer")
      || countQueuedUnits(civ, (id) => id === "pioneer") > 0;
    const civHasGalley   = civ.units.some((u) => u.typeId === "galley")
      || countQueuedUnits(civ, (id) => id === "galley") > 0;
    const cityIsCoastal  = city.isPort || isCoastalTile(map, city.x, city.y);
    const hasViableSite  = civHasReachableSettleSite(civ, gameState);
    // Island-locked: this city is coastal but there's nowhere left to found on the same landmass
    const islandLocked   = cityIsCoastal && !hasViableSite;
    // No coastal city at all: pioneer must reach the coast before a galley can be built
    const noCoastalCity  = !civ.cities.some(c => c.isPort || isCoastalTile(map, c.x, c.y));
    // Multi-city naval expansion: any civ with 2+ cities and a coastal city should
    // eventually build a galley for ocean exploration, even between settle cycles.
    const wantsNavalExpansion = civ.cities.length >= 2 && cityIsCoastal && !civHasGalley;
    // Galley exists but no pioneer to put in it — build one from any coastal city
    // (civHasPioneer already accounts for one mid-build elsewhere, above)
    const wantsNavalPioneer = civHasGalley && cityIsCoastal && !civHasPioneer;
    // Overseas invasion backlog: when it outgrows the fleet already owned/queued,
    // build another galley instead of making every unit queue for the same one.
    // Capped (galleyCap, which scales with backlog size) so a civ doesn't sink
    // its whole economy into an oversized navy -- see computeGalleyNeed.
    const { galleyCount, overseasBacklog, galleyCap } = computeGalleyNeed(civ, gameState);
    const wantsMoreGalleys = cityIsCoastal && galleyCount > 0 && galleyCount < galleyCap
      && overseasBacklog > galleyCount;

    // Pioneer — build when a land site exists, when island-locked (pioneer boards galley),
    // when no coastal city yet, or when the galley needs a passenger
    const popOk = city.population >= window.GameEngine.cities.SETTLER_MIN_POP;
    // Tech-tree city gate awareness: a layer-L tech needs >= L cities (tech.js
    // meetsCityGate). Computed up front (not just for the score bonus below)
    // because it also drives the affordability bypass immediately below: a
    // pioneer that's the ONLY way to unlock further research shouldn't be
    // permanently vetoed by canAffordUnitUpkeep the same way an optional one
    // would be -- see pioneerTechGateBypass.
    const gatedLayer = window.GameEngine.tech.nextGatedTechLayer(civ);
    const cityGateShortfall = gatedLayer !== null ? gatedLayer - civ.cities.length : 0;
    const pioneerAffordable = canAffordUnitUpkeep(civ, "pioneer", race);
    // Tech-gate desperation bypass: a civ deep enough in military upkeep for
    // canAffordUnitUpkeep to reject a pioneer can otherwise NEVER produce the
    // one pioneer that would unlock further research -- the very unit that
    // would fix the economy (a new city) is blocked by the economy it would
    // fix, a permanent trap military-heavy races (Orc) can hit mid-game. A
    // genuine tech-count block is treated as urgent enough to push through
    // almost immediately (65%/turn, race-independent) rather than leaving it
    // to a slow, industriousness-scaled trickle -- a civ shouldn't sit
    // gate-blocked for dozens of turns just because it happens to have low
    // industriousness.
    const pioneerTechGateBypass = !pioneerAffordable && cityGateShortfall > 0 && Math.random() < 0.65;
    // A tech-driven need for MORE cities than currently exist is allowed a
    // second pioneer in flight (capped at the actual shortfall, via
    // totalPioneers below) instead of the usual "never more than one" rule --
    // otherwise a civ that needs 2+ additional cities still only ever builds
    // them one at a time, in series, even when it could afford to found two
    // in parallel.
    const totalPioneers = civ.units.filter((u) => u.typeId === "pioneer").length
      + countQueuedUnits(civ, (id) => id === "pioneer");
    const needsMorePioneers = cityGateShortfall > totalPioneers;
    if (popOk && (!civHasPioneer || needsMorePioneers) && (hasViableSite || islandLocked || noCoastalCity || wantsNavalExpansion || wantsNavalPioneer)
        && (pioneerAffordable || pioneerTechGateBypass)) {
      // Influence-per-population is now derived from industriousness (see
      // cities.js industriousnessInfluenceMult), not a per-race flat field --
      // a high-industriousness race gets each additional city scored as
      // worth more (and a low-industriousness race, like Orc, slightly less),
      // rather than this being a Halfellow-only special case.
      const settleInfluenceBonus = (window.GameEngine.cities.industriousnessInfluenceMult(race) - 1.0) * 30;
      const cityGateBonus = cityGateShortfall > 0 ? cityGateShortfall * 10 : 0;
      // settleWeight is racialWeights().settle (0.4-1.5x, scaled from expansionism),
      // doubled on top of that whenever THIS turn's chooseStrategy focus is "settle"
      // (see runAITurn's `boosted` weights) -- previously computed but never actually
      // read here, so the whole focus/doctrine "expand" chain was inert. Multiplying
      // it in gives expansionism a second, compounding lever on top of the direct
      // linear term above, and finally makes that machinery do something.
      const settleWeight = weights.settle || 1.0;
      const opt = buildUnitOption(civ, "pioneer",
        (expansionism * 14 + settleEconBonus + settleInfluenceBonus + cityGateBonus) * settleWeight, unitCostMult);
      if (opt) options.push(opt);
    }

    // Galley — coastal expansion; needs a pioneer aboard, island-locked, multi-city
    // naval push, or (once at least one galley already exists) a big enough
    // overseas-invasion backlog to justify expanding the fleet past one hull.
    // Also wanted outright, with no other reason needed, by a Dwarf civ whose
    // Titan is stalled waiting for a target -- see civNeedsTitanScouting --
    // since the only way to find an overseas enemy is to go looking by sea.
    const wantsTitanScouting = !civHasGalley && civNeedsTitanScouting(civ);
    if (cityIsCoastal && (!civHasGalley || wantsMoreGalleys)
        && (civHasPioneer || islandLocked || wantsNavalExpansion || wantsMoreGalleys || wantsTitanScouting)
        && canAffordUnitUpkeep(civ, "galley", race)) {
      const settleWeight = weights.settle || 1.0;
      const opt = buildUnitOption(civ, "galley",
        (expansionism * 12 + (wantsMoreGalleys ? overseasBacklog * 3 : 0) + (wantsTitanScouting ? 25 : 0)) * settleWeight, unitCostMult);
      if (opt) options.push(opt);
    }

    // Military units — threat-gated scoring (Option A) + militarism cap
    const unlockedMilitary = [...(civ.unlockedUnits || [])]
      .filter((id) => {
        const u = window.GameData.getUnit(id);
        // cityBuildable: false (e.g. Elf's Raptor/Shadowsteed) -- only the
        // Druid's own summon action can ever produce these, never a city.
        return u.category === "military" && !u.isNaval && u.cityBuildable !== false
          && (!u.raceOnly || u.raceOnly === civ.raceId);
      });

    // Hoisted above the `unlockedMilitary.length > 0` block (was local to it)
    // so the wall-gate below can also read it -- a civ can need this count
    // even in the (rare) case it has no unlocked military unit at all yet,
    // where it's trivially 0.
    const isMilitaryLand = (id) => {
      const ud = window.GameData.getUnit(id);
      return ud.category === "military" && !ud.isNaval;
    };
    const militaryCount = civ.units.filter((u) => isMilitaryLand(u.typeId)).length
      + countQueuedUnits(civ, isMilitaryLand);

    if (unlockedMilitary.length > 0) {
      // Army cap now scales with total population, not city count -- a civ
      // with 3 small cities and a civ with 3 huge cities no longer get the
      // same cap; the cap tracks actual economic capacity to support an army.
      const militaryCap = computeMilitaryCap(civ);

      // Composite combat value -- picking the single unit with the single
      // highest raw attack (or defense) stat, as this used to, makes every
      // First-Strike/Siege specialist mathematically unreachable: a
      // Trebuchet (attack 8) can never beat a Knight (attack 13) on raw
      // attack alone, even though Siege 200% is exactly what makes it
      // devastating against structures -- the entire reason to build one.
      // Folding firstStrikePct/siegePct in (both real combat-effectiveness
      // multipliers -- see combat.js effectiveFirstStrikePct/resolveRound
      // for how First Strike gives a unit a chance to swing before the other
      // side does) lets specialists compete on what actually makes them
      // worth building, without needing a per-unit special case. Siege only
      // counts toward offense -- it does nothing for a unit sitting in a
      // garrison. First Strike's own weight is "* 60", not "* 6" like
      // siege's -- 2026-07-16: firstStrikePct values across the roster were
      // rescaled ~10x smaller (0.70 -> 0.07 for Paladin, etc.) alongside a
      // redesign that makes First Strike roll every exchange instead of
      // only a fight's final lethal round (see project_first_strike_redesign
      // memory). "* 60" keeps every unit's offense/defense CREDIT from
      // First Strike numerically identical to before the rescale (e.g.
      // Paladin: 0.70*6 == 0.07*60 == 4.2) -- a deliberate choice to hold
      // existing AI build priorities steady rather than guess at a new
      // "correct" weight for the redesigned mechanic without a fresh
      // tuning pass.
      //
      // Siege saturation (2026-07-12): siegePct is ONLY consulted by
      // combat.js's effectiveAttack when `context.isSiege` is true --
      // attacking a city/wall/building. It contributes literally nothing in
      // an ordinary unit-vs-unit fight, so scoring it into the offense pick
      // unconditionally let a high-siege/low-attack specialist (e.g. Orc's
      // Battering Ram, siege 175% but attack 6) permanently out-rank a much
      // stronger all-around fighter whose real per-unit combat power is
      // actually higher, purely on a stat that's worthless against the
      // enemy units it'll be fighting most of the time. Confirmed directly
      // as the reason Orc kept mass-building Battering Rams/Ogres over
      // Dragons even with Draconic Mastery long since researched and the
      // treasury overflowing -- see project_halfellow_early_kit_and_map_boost.
      // Fix: siege% only sweetens the offense score while this civ doesn't
      // already have "enough" siege-capable units on hand (own army +
      // queued) to cover its actual infrastructure-razing need
      // (huntEnemyInfrastructure sends whatever idle unit is available, not
      // specifically a siege specialist, so a small standing pool is
      // sufficient) -- past that saturation point, offense scoring reverts
      // to pure combat power (attack + firstStrike), letting a genuinely
      // stronger fighter compete on what it's actually good at instead of
      // being permanently buried under someone else's siege stat.
      //
      // Anti-Titan learning (2026-07-15): a civ that has learned from losing
      // units/structures to a Runeforged Titan (see maybeLearnAntiTitanLesson)
      // lifts this cap entirely -- siege is the only thing that cuts through
      // a Titan's `siegeTarget` defense (see combat.js resolveRound), so
      // once learned, this civ keeps preferring siege-capable units for its
      // offense pick indefinitely instead of reverting to plain attack after
      // 2 owned/queued.
      const SIEGE_UNIT_SATURATION = civ.learnedAntiTitanTactics ? Infinity : 2;
      const isSiegeUnit = (id) => (window.GameData.getUnit(id).siegePct || 0) > 0;
      const ownedSiegeUnits = civ.units.filter((u) => isSiegeUnit(u.typeId)).length
        + countQueuedUnits(civ, isSiegeUnit);
      // Ranged saturation (2026-07-14): militaryValue previously had no
      // concept of `range` at all, so a genuine skirmisher (Human's Archer/
      // Longbowman, Orc's Bog Witch) could never win either the garrison or
      // offense pick -- their raw attack/defense always lose to a same-tier
      // melee unit (Cavalry/Knight/Paladin, Impaler/Ogre), even though
      // fighting at range 2-3 with zero counter risk (see combat.js
      // resolveRound's counterOutOfRange) is exactly what makes them worth
      // building. Same shape as the siege-saturation fix above: excludes
      // siege-flagged units (siegePct already earns them their own credit
      // above, and their `range` exists to reach a city/wall, not to skirmish
      // units at a distance -- see units.js `siegeAtRange` doc) so Catapult/
      // Trebuchet/Battering Ram/Dragon don't double-dip on top of their siege
      // credit. Unlike siege, ranged is credited on BOTH offense and defense
      // -- a skirmisher garrisoned in a city can still fire out at an
      // approaching enemy at range via considerAttackOrGarrison without
      // taking a counter, so it's a genuine garrison option, not just an
      // offense one. Deliberately race-agnostic, like the siege fix.
      const RANGED_UNIT_SATURATION = 3;
      // 8, not 6: Human's Longbowman (atk7/def4/fs0.20) vs. Paladin
      // (atk10/def8/fs0.70) sits exactly 6.0 offense / 7.0 defense points
      // behind before any credit -- a flat +6 credit ties the OFFENSE score
      // exactly (bestByValue's reduce only replaces on strict `>`, so a tie
      // silently keeps whichever unit is declared earlier in units.js, which
      // is Paladin), and still loses on defense outright. Confirmed directly
      // via a live 300-turn headless run: with credit=6, Human researched
      // Longbow/unlocked longbowman but built ZERO of them the entire game.
      // +8 clears both gaps with margin (offense 16.2 vs. Paladin's 14.2,
      // defense 13.2 vs. 12.2) instead of relying on a coincidental exact
      // tie that happens to favor the intended unit.
      const RANGED_VALUE_CREDIT = 8;
      const isRangedSkirmisher = (id) => {
        const ud = window.GameData.getUnit(id);
        return (ud.range || 1) > 1 && !((ud.siegePct || 0) > 0);
      };
      const ownedRangedUnits = civ.units.filter((u) => isRangedSkirmisher(u.typeId)).length
        + countQueuedUnits(civ, isRangedSkirmisher);
      // Dwarf "Heavy Metal"/"Power Metal" (2026-07-16, extended 2026-07-18):
      // once EITHER is researched, the Troubadour's active aura (turns.js's
      // per-turn application -- heal+defense+siege for Heavy Metal, or
      // attack+first strike for Power Metal, whichever is currently active,
      // to every ally within its radius every turn) is a persistent
      // team-wide buff that militaryValue's raw attack/defense terms have no
      // way to see. The Troubadour's OWN stats are deliberately weak
      // (support unit, not a frontline fighter -- atk 2, def 3), so it
      // permanently lost the offense/defense pick to FoeHammer/Musketeer and
      // was never built -- confirmed the user's suspicion directly by
      // walking the formula: Musketeer's higher attack/range beats it
      // outright pre-saturation, and past ranged saturation it's a strict
      // loss (atk) or a silent tied loss (def, same "reduce only replaces on
      // strict >" trap RANGED_VALUE_CREDIT's own comment documents). Gated
      // on having researched at least one of the two aura techs -- before
      // either, the Troubadour really is just a mediocre skirmisher and
      // shouldn't be artificially boosted -- and on a small saturation cap,
      // since one embedded in the main army already covers everyone in its
      // radius; a second only helps a genuinely split force.
      const TROUBADOUR_AURA_SATURATION = 2;
      const isTroubadour = (id) => id === "troubadour";
      const ownedTroubadours = civ.units.filter((u) => isTroubadour(u.typeId)).length
        + countQueuedUnits(civ, isTroubadour);
      const hasHeavyMetal = !!(civ.unlockedMechanics &&
        (civ.unlockedMechanics.has("heavy_metal") || civ.unlockedMechanics.has("power_metal")));
      // Confirmed via live headless A/B (same map seeds, credit forced to 0
      // vs the value below): 0/3 baseline games ever produced a Troubadour
      // even when Heavy Metal was researched, vs 6/6 games with this credit
      // active. 10 was the first value tried and cleared the bar cleanly, no
      // further tuning needed -- see project_troubadour_aura_scoring memory.
      const TROUBADOUR_AURA_CREDIT = 10;
      const militaryValue = (id, forDefense) => {
        const ud = window.GameData.getUnit(id);
        const firstStrike = ud.firstStrikePct || 0;
        const rangeCredit = ownedRangedUnits < RANGED_UNIT_SATURATION && isRangedSkirmisher(id) ? RANGED_VALUE_CREDIT : 0;
        const auraCredit = hasHeavyMetal && ownedTroubadours < TROUBADOUR_AURA_SATURATION && isTroubadour(id)
          ? TROUBADOUR_AURA_CREDIT : 0;
        if (forDefense) return ud.defense + firstStrike * 60 + rangeCredit + auraCredit;
        const siegeCredit = ownedSiegeUnits < SIEGE_UNIT_SATURATION ? (ud.siegePct || 0) * 6 : 0;
        return ud.attack + firstStrike * 60 + siegeCredit + rangeCredit + auraCredit;
      };
      const bestByValue = (forDefense) => unlockedMilitary.reduce((best, id) =>
        (!best || militaryValue(id, forDefense) > militaryValue(best, forDefense)) ? id : best, null);

      // Garrison — scored by militarism; preference exists but isn't forced.
      // Gated by the same population military cap as the offense option below --
      // a civ should never be allowed to build past its cap and rely on
      // maybeDisband to trim it back afterward; it should simply not build
      // the unit and fall back to whatever else scores next-best (building,
      // settler, scout) among this turn's options.
      //
      // Reconsiders whenever the BEST currently-unlocked defender isn't
      // already what's standing here -- not just "is anything here at all"
      // (the old check), which permanently froze a city's garrison on
      // whichever unit was available FIRST regardless of what unlocked
      // later. If this pushes militaryCount over the cap, maybeDisband's
      // existing weakest-first trim (strength = attack+defense) cleans up
      // the outdated unit rather than the new one -- no explicit swap
      // needed here.
      // Orc "Miscreant" fallback (2026-07-14, user-directed): when the real
      // best garrison/offense pick isn't affordable right now, substitute
      // the cheap gap-filler (see units.js goblin_miscreant) at the SAME
      // score the real pick would have gotten -- it genuinely competes for
      // (and, being far cheaper, usually wins) the slot instead of leaving
      // it empty, rather than adding a token low-score option elsewhere in
      // this function that would just lose to whatever building happens to
      // be available. See project_pairwise_balance_human_orc_halfellow memory.
      const tryWithMiscreantFallback = (unitId, score) => {
        if (canAffordUnitUpkeep(civ, unitId, race)) {
          const opt = buildUnitOption(civ, unitId, score, unitCostMult);
          if (opt) return opt;
        }
        if (civ.unlockedUnits && civ.unlockedUnits.has("goblin_miscreant")
            && canAffordUnitUpkeep(civ, "goblin_miscreant", race)) {
          return buildUnitOption(civ, "goblin_miscreant", score, unitCostMult);
        }
        return null;
      };

      const bestDef = bestByValue(true);
      const hasBestDefenderHere = civ.units.some((u) => u.x === city.x && u.y === city.y && u.typeId === bestDef);
      if (!hasBestDefenderHere && militaryCount < militaryCap) {
        // Garrison score: weighted by militarism; threat raises it; scaled by economic sustainability
        const garrisonScore = (militarism * 8 + (underThreat ? agg * 4 : 0)) * militaryEconMult;
        const opt = tryWithMiscreantFallback(bestDef, garrisonScore);
        if (opt) options.push(opt);
      }

      if (militaryCount < militaryCap) {
        const bestAtk = bestByValue(false);
        // Offense score: low in peacetime, escalates under threat; scaled by economic sustainability.
        // Tech-gate awareness: don't keep growing an already-large peacetime
        // army while a tech is blocked purely on city count -- that's exactly
        // the mechanism that starves a militaristic race's economy of room
        // for the pioneer it needs (see pioneerTechGateBypass above). A real
        // threat still gets a full response; this only discounts the "build
        // more just because militarism is high" peacetime term.
        const offenseScore = (underThreat
          ? militarism * 6 + agg * 6
          : militarism * 5 * (cityGateShortfall > 0 ? 0.3 : 1.0)) * militaryEconMult;
        const opt = tryWithMiscreantFallback(bestAtk, offenseScore);
        if (opt) options.push(opt);
      }

      // Utility/support units tied to an unlocked MECHANIC rather than their
      // own combat stats (see UTILITY_UNIT_MECHANICS) -- militaryValue above
      // can't see any of that, since e.g. Wizard's whole value is
      // Teleportation/Fireball/Dungeon Delve, not its attack/defense. Wants
      // roughly one per 2 cities (capped at 5) -- previously capped at 3
      // (one per 3 cities), which badly undersold a unit like the Wizard:
      // Human sinks 7 whole techs into it (Freezing Touch, Teleportation,
      // Flight, Fireball, Invulnerability, Invisibility, Dungeon Delve), each
      // of which is a per-unit action a second/third Wizard runs independently
      // and in parallel (see maybeHumanWizardPlay) -- a 3-copy ceiling meant a
      // large, tech-complete Human empire could never actually field enough
      // casters to run more than one of those plays at a time. Still capped,
      // not unlimited, so the army doesn't turn entirely into casters.
      //
      // Score TAPERS per copy already owned (0.6^owned) rather than staying
      // flat: relevantMechanics.length*7 (e.g. 49 for Wizard's 7 mechanics)
      // dwarfs the garrison/offense scores just below (typically 3-13), so a
      // flat score across every copy up to `wanted` let Wizards keep winning
      // the build slot ahead of actual defenders every single time -- a real
      // regression measured directly: raising just the cap (without this
      // taper) dropped Human's win rate and nearly doubled its elimination
      // rate in a 20-game batch, because raising `wanted` meant more turns in
      // a row where a weak-combat-stat Wizard outscored the Spearguard/Knight
      // a city actually needed to survive. The taper keeps the FIRST copy
      // fully prioritized (guarantees the tactic gets run at all), while each
      // additional one increasingly has to compete fairly with garrison/
      // offense instead of automatically dominating them.
      if (militaryCount < militaryCap) {
        for (const [unitId, mechanics] of Object.entries(UTILITY_UNIT_MECHANICS)) {
          if (!civ.unlockedUnits || !civ.unlockedUnits.has(unitId)) continue;
          const relevantMechanics = mechanics.filter((m) => civ.unlockedMechanics && civ.unlockedMechanics.has(m));
          if (relevantMechanics.length === 0) continue;
          const owned = civ.units.filter((u) => u.typeId === unitId).length + countQueuedUnits(civ, (id) => id === unitId);
          const wanted = Math.max(1, Math.min(5, Math.ceil(civ.cities.length / 2)));
          if (owned >= wanted || !canAffordUnitUpkeep(civ, unitId, race)) continue;
          let utilityScore = relevantMechanics.length * 7 * Math.pow(0.6, owned);
          // Elf "one Shadowsteed per Druid" (2026-07-18, user-directed): a
          // civ that wants more combat strength but has no spare Druid
          // summon capacity left (every existing Druid already has, or is
          // making, its one Shadowsteed -- see druidHasLiveSummon) needs
          // another Druid before it can field another Shadowsteed at all.
          // Boosts Druid's own build score on top of the taper above, so
          // this shortage reliably outcompetes garrison/offense picks
          // rather than just hoping the flat utility credit gets there.
          if (unitId === "druid" && civ.unlockedMechanics.has("shadow_steed_summon")) {
            const liveDruids = civ.units.filter((u) => u.typeId === "druid").length;
            const spareCapacity = civ.units.some((d) => d.typeId === "druid" && !druidHasLiveSummon(civ, d, "shadowsteed"));
            if (liveDruids > 0 && !spareCapacity) utilityScore += DRUID_SHORTAGE_BONUS;
          }
          const opt = buildUnitOption(civ, unitId, utilityScore, unitCostMult);
          if (opt) options.push(opt);
        }
      }
    }

    // Orc "Dire Wolf" (user-directed): the civ always tries to keep at
    // least one Dire Wolf ALIVE, not just queued -- it's Orc's only
    // omniscient hunter (see ai.js's maybeDireWolfHunt), so losing the last
    // one is a real capability gap, not just an ordinary unit death. Scored
    // high enough to reliably outcompete garrison/offense picks when the
    // civ has none, same surgical-bonus shape as Elf's DRUID_SHORTAGE_BONUS.
    // Every city with room independently proposes this while the shortage
    // lasts (same multi-city-reacts-to-one-shortage precedent as that Elf
    // mechanic) -- not deduped further, since the very next `hasLiveDireWolf`
    // check the following turn already stops it once any one city succeeds.
    const orcHasDireWolfAvailable = civ.raceId === "orc" && civ.unlockedUnits && civ.unlockedUnits.has("dire_wolf");
    if (orcHasDireWolfAvailable && militaryCount < computeMilitaryCap(civ)
        && canAffordUnitUpkeep(civ, "dire_wolf", race)) {
      const hasLiveDireWolf = civ.units.some((u) => u.typeId === "dire_wolf");
      if (!hasLiveDireWolf) {
        const opt = buildUnitOption(civ, "dire_wolf", DIRE_WOLF_SHORTAGE_BONUS, unitCostMult);
        if (opt) options.push(opt);
      }
    }

    // Scout — explore if none present. A Dwarf civ with a Titan stalled
    // waiting for a target city needs this far more urgently than the flat
    // background score implies -- see civNeedsTitanScouting.
    // Orc "Dire Wolf" (user-directed): once Dire Wolf is available to
    // build, Orc substitutes it for the scouting role entirely and never
    // queues a new Scout -- the Dire Wolf's own omniscient landmass-wide
    // hunt (see maybeDireWolfHunt) already covers what a Scout's fog-of-war
    // exploration would have found.
    const hasIdleScout = civ.units.some((u) => u.typeId === "scout")
      || countQueuedUnits(civ, (id) => id === "scout") > 0;
    if (!orcHasDireWolfAvailable && !hasIdleScout && civ.unlockedUnits && civ.unlockedUnits.has("scout")
        && canAffordUnitUpkeep(civ, "scout", race)) {
      const scoutScore = civNeedsTitanScouting(civ) ? 30 : 5;
      const opt = buildUnitOption(civ, "scout", scoutScore, unitCostMult);
      if (opt) options.push(opt);
    }

    // Buildings (structures) — only this race's 4, placed on any tile adjacent to the city.
    if (civ.unlockedBuildings) {
      for (const bId of civ.unlockedBuildings) {
        const building = window.GameData.getBuilding(bId);
        if (building.raceOnly && building.raceOnly !== civ.raceId) continue;
        if (window.GameEngine.cities.cityHasStructure(city, bId)) continue; // already built here
        // Must have a free, valid adjacent slot (handles hills/forest placement constraints too)
        if (!window.GameEngine.cities.findStructureSlot(city, civ, map, bId, civs)) continue;
        // Influence-granting structures score higher — influence is the victory metric.
        const influenceValue = (building.influenceMult ? (building.influenceMult - 1) * 40 : 0)
          + (building.radiusBonus ? building.radiusBonus * 8 : 0);
        // Dwarf "Deep Roads Rite": a modest priority nudge for Deep Gate --
        // its value (network mobility) isn't captured by influenceValue at
        // all, so without this it'd score identically to a plain economy
        // building. Not an absolute "always build first" rule (that's a much
        // bigger pathfinding-integration ask, deliberately out of scope here) --
        // just enough that a civ with the tech actually builds one.
        const deepGateBonus = bId === "deep_gate" ? 15 : 0;
        options.push({ kind: "building", id: bId, coinCost: building.coinCost,
          score: industriousness * 9 + 10 + influenceValue + deepGateBonus });
      }
    }

    // Walls — universal (every race, not gated by unlockedBuildings/tech), and
    // unlike the loop above a city may hold several at once, so this doesn't
    // go through cityHasStructure's one-copy-per-id gate; findStructureSlot's
    // isWall branch (cities.js) is what actually caps how many fit (one per
    // open ring tile, each needing to touch an already-built structure).
    // Priority is militarism+industriousness, per the user's request: a
    // militaristic, industrious civ (Dwarves) walls up the most; a peaceful,
    // low-industry civ (Orcs, despite high militarism -- see industriousness
    // 0.3) walls up far less.
    //
    // Human "Ramparts" / Halfellow "Rouse the People" / "Hedge Walls" turn a
    // wall from passive HP padding into something that actively fights back
    // (counterattacks a melee attacker) or outlasts a siege on its own
    // (self-heals 5%/turn) -- a flat priority blind to that would keep
    // treating a wall as worth exactly as much before and after researching
    // the tech that makes it genuinely dangerous to attack. Doubled, not
    // just bumped, once any of those is unlocked; stacks if a civ somehow
    // has more than one (not currently possible for any single race, but
    // harmless either way).
    //
    // Wall-vs-army gate (2026-07-14): a wall's score (militarism+
    // industriousness averaged, up to x2/x3 with the mechanic bonus above)
    // was found to structurally outscore the garrison score (militarism*8
    // alone) for any race with moderate-to-high industriousness -- and since
    // a city can hold many wall_sections (one per open ring tile, uncapped
    // unlike every other build slot in this function), that let a real game
    // build ZERO military units for 150 straight turns while sitting on a
    // 25,000+ resource stockpile: walls always won the score comparison, so
    // the AI never even got its first defender. Confirmed via a live headless
    // trace -- see project_ranged_unit_build_scoring_fix (Human/Orc case) and
    // the follow-up in project memory for this specific fix.
    // Fix: an explicit, behavior-scored ratio, not just a score tweak (a
    // multiplier alone doesn't help once Ramparts etc. doubles the wall score
    // right back past it). Zero walls at all until the civ has fielded at
    // least one real defender (forces that first unit to win by default, the
    // same "guarantee a floor" shape as the utility-unit/siege/ranged
    // saturation fixes elsewhere in this function) -- past that, walls are
    // capped at `wallsPerSoldierAllowed` per soldier, itself scaled by
    // militarism: a highly militaristic civ (Orc, 0.9) tolerates barely more
    // than 1 wall per soldier (prefers army over static defense, matching its
    // design), while a low-militarism civ (Halfellow, 0.2) can fortify up to
    // 4 walls per soldier. This is a hard structural cap, not a score
    // penalty -- it holds regardless of how high wallMult climbs.
    const WALLS_PER_SOLDIER_BASE = 1;
    const WALLS_PER_SOLDIER_RANGE = 3;
    const wallsPerSoldierAllowed = WALLS_PER_SOLDIER_BASE + (1 - militarism) * WALLS_PER_SOLDIER_RANGE;
    const totalWalls = civ.cities.reduce((sum, c) =>
      sum + c.structures.filter((s) => s.id === "wall_section").length, 0);
    const wallGateOk = militaryCount > 0 && totalWalls < militaryCount * wallsPerSoldierAllowed;
    if (wallGateOk && window.GameEngine.cities.findStructureSlot(city, civ, map, "wall_section", civs)) {
      const wallMechanicBonus = ["ramparts", "rouse_the_people", "hedge_walls"]
        .filter((m) => civ.unlockedMechanics && civ.unlockedMechanics.has(m)).length;
      const wallMult = 1 + wallMechanicBonus;
      options.push({ kind: "building", id: "wall_section",
        coinCost: window.GameData.getBuilding("wall_section").coinCost,
        score: ((militarism + industriousness) / 2) * 12 * wallMult });
    }

    // Orc "Miscreant" true last-resort: the garrison/offense retries above
    // already cover "budget strained" (substituting Miscreant for whichever
    // real pick wasn't affordable, at that pick's own score -- so it
    // actually competes for and usually wins the slot, not just technically
    // exists as an option). This covers the remaining "genuinely nothing
    // else at all this turn" case (militaryCap already full, or every
    // military slot already occupied) with a low flat score, so it only
    // wins if literally nothing else in this whole function produced an
    // option.
    if (options.length === 0 && civ.unlockedUnits && civ.unlockedUnits.has("goblin_miscreant")
        && militaryCount < computeMilitaryCap(civ)
        && canAffordUnitUpkeep(civ, "goblin_miscreant", race)) {
      const opt = buildUnitOption(civ, "goblin_miscreant", 3, unitCostMult);
      if (opt) options.push(opt);
    }

    if (options.length === 0) return null;
    options.sort((a, b) => b.score - a.score);
    return options[0];
  }

  /** Spawns a completed unit at `city` (or the nearest coastal water for
   *  naval units), pushing it onto civ.units. Returns false if a naval unit
   *  couldn't find anywhere to spawn yet -- caller should leave the build
   *  queued and retry next turn rather than losing a completed build.
   *  Shared by progressBuildQueue's legacy coin-accumulation path and its
   *  power-based fixed-turn-timer path. */
  function spawnUnitInCity(civ, city, unitId, gameState) {
    const unitData = window.GameData.getUnit(unitId);
    let spawnX = city.x, spawnY = city.y;
    if (unitData.isNaval) {
      // Naval units must spawn on a water tile; expand search if nothing is directly adjacent
      const waterSpot = findAdjacentWater(city.x, city.y, gameState.map)
        || findNearestCoastalWaterFor(city.x, city.y, gameState.map, 10);
      if (waterSpot) { spawnX = waterSpot.x; spawnY = waterSpot.y; }
      // If still no water found, defer completion — don't strand galley on land
      if (spawnX === city.x && spawnY === city.y) return false;
    }
    const newUnit = { typeId: unitId, civId: civ.id, x: spawnX, y: spawnY, isCivilian: ["pioneer", "scout"].includes(unitId), homeCityName: city.name };
    window.GameEngine.combat.initUnitHP(newUnit, civ);
    civ.units.push(newUnit);
    // Orc "Goblin Miscreant" (2026-07-15, user-directed): building one
    // actually produces two -- the second spawns on a random adjacent LAND
    // tile to the city (not naval, and not stacked onto the same tile as
    // the first), falling back to the city's own tile if every neighbor is
    // water. Cost/upkeep/build-time are unaffected -- a pure 2-for-1 bonus,
    // matching the unit's identity as Orc's cheap, disposable gap-filler
    // (see units.js's `cheap` flag doc). Baked directly onto the unit by
    // typeId, same convention as Bog Witch's curseOnDeath, rather than a
    // tech-effect flag, since Goblin Miscreant only has the one unlock tech.
    if (unitId === "goblin_miscreant") {
      const bonusSpot = findRandomAdjacentLandTile(city.x, city.y, gameState.map) || { x: city.x, y: city.y };
      const bonusUnit = { typeId: unitId, civId: civ.id, x: bonusSpot.x, y: bonusSpot.y, homeCityName: city.name };
      window.GameEngine.combat.initUnitHP(bonusUnit, civ);
      civ.units.push(bonusUnit);
    }
    // Pacing: once a civ's first-ever military unit actually completes, the
    // double-speed build bonus (see buildUnitOption) turns off for good.
    if (!civ._firstMilitaryBuilt && unitData.category === "military") civ._firstMilitaryBuilt = true;
    return true;
  }

  function progressBuildQueue(civ, city, gameState, log) {
    const item = city.buildQueue;

    // Power-based unit build (see buildUnitOption/unitBuildTurns): the cost
    // was already paid up front in maybeBuildInCities, so this is purely a
    // countdown independent of the city's income.
    if (item.turnsRemaining !== undefined) {
      item.turnsRemaining--;
      if (item.turnsRemaining > 0) return;
      if (!spawnUnitInCity(civ, city, item.id, gameState)) return; // naval retry next turn
      log.push(`Build complete: ${city.name} produced ${item.id}`);
      city.buildQueue = null;
      return;
    }

    const coinThisTurn = city.lastYield ? city.lastYield.coin : 0;
    // minBuildTurns (buildings only, e.g. wall_section) puts a hard floor on
    // completion time independent of the city's coin income -- a wealthy city
    // can't just insta-build a wall in one turn. Ordinary buildings (no
    // minBuildTurns set) are unaffected, advancing at the full coin rate
    // exactly as before. Units with a legacy flat coinCost (Pioneer, Galley,
    // Human's free Scout -- see GameData.techForUnit) also still flow
    // through here, unchanged.
    const building = item.kind === "building" ? window.GameData.getBuilding(item.id) : null;
    const progressCap = building && building.minBuildTurns
      ? item.coinCost / building.minBuildTurns
      : coinThisTurn;
    // Tech: build_speed_mult (Dwarf "Runeforged Tools") -- scales the actual
    // per-turn progress credited, civ-wide, INCLUDING wall_section's
    // minBuildTurns floor (deliberately -- "faster builders, full stop" is a
    // genuine signature trait, not an oversight to patch around).
    item.progress += Math.min(coinThisTurn, progressCap) * (civ.buildSpeedMult || 1);
    if (item.progress >= item.coinCost) {
      if (item.kind === "unit") {
        if (!spawnUnitInCity(civ, city, item.id, gameState)) return; // naval retry next turn
        log.push(`Build complete: ${city.name} produced ${item.id}`);
      } else {
        // Buildings are external structures placed on a tile adjacent to the city
        const placed = window.GameEngine.cities.placeStructure(city, civ, gameState.map, item.id, gameState.civs);
        if (placed) {
          log.push(`Build complete: ${city.name} raised ${item.id} at (${placed.x},${placed.y})`);
        } else {
          // No valid adjacent slot (all occupied/blocked) — abandon this build
          log.push(`Build canceled: ${city.name} has no open slot for ${item.id}`);
        }
      }
      city.buildQueue = null;
    }
  }

  /**
   * Dispatches ONE unit's turn: movement, attack, spell/mechanic use, or
   * idle behavior, depending on its situation. Extracted out as its own
   * function (rather than inlined in maybeMoveUnits's loop below) so the
   * granular per-unit spectator-mode stepping in turns.js
   * (stepCivTurnUnit/advanceOneUnitStep) can drive exactly one unit at a
   * time, in civ.units order -- which is creation order in practice, since
   * units are only ever appended (spawnUnitInCity, maybeSpawnMilitia,
   * maybeRaiseDead) or removed via Array.prototype.filter (every death/
   * disband/founding site in this codebase), never reordered or spliced
   * back in elsewhere.
   */
  function runUnitTurn(civ, unit, gameState, weights, difficulty, log) {
    if (unit.usedThisTurn) return;
    const militarism = effectiveMilitarism(civ);
    const race = window.GameData.getRace(civ.raceId);
    const industriousness = race.industriousness ?? 0.5;
    // Wraps the original per-unit loop BODY (moved here unmodified from
    // maybeMoveUnits) in a single-pass do/while(false) rather than rewriting
    // every one of its many `continue` statements to `return` -- `continue`
    // inside a do/while jumps straight to the (always-false) condition, i.e.
    // stops processing this unit, identical to what `continue` meant in the
    // original for-loop (move on -- except there's no "next unit" here, so
    // it's equivalent to returning).
    do {
    // Orc Dragon Riders: a carried unit can't act at all on its own -- the
      // carrying Dragon decides when to disembark it (see operateDragonCarry).
      // Checked before the pioneer skip below so a carried PIONEER (aboard a
      // galley) also gets this mission -- maybeFoundCity only ever looks at
      // NOT-carried pioneers, so it would otherwise never overwrite one.
      if (unit.carriedBy) {
        // Halfellow "Devoted Companions": unlike Dragon Riders' cargo, a
        // carried passenger MAY disembark on its own to join a fight already
        // happening next to its carrier (see maybeDisembarkCompanion) -- an
        // injured passenger otherwise favors doing nothing and just healing.
        if (civ.unlockedMechanics && civ.unlockedMechanics.has("devoted_companions")
            && maybeDisembarkCompanion(civ, unit, gameState, log)) {
          // fell through to normal dispatch below, same turn
        } else {
          unit.currentMission = `Being carried by a ${window.GameData.getUnit(unit.carriedBy.typeId).label}`;
          continue;
        }
      }
      if (unit.typeId === "pioneer") continue; // handled in maybeFoundCity

      // Elf "Air Beneath, Eyes Above"/"Shadowsteed": a Druid mid-summon
      // cannot move or act at all until it finishes (or a spawn retry is
      // pending) -- see progressDruidSummon/startDruidSummon.
      if (unit.typeId === "druid" && unit.summonBuild) {
        progressDruidSummon(civ, unit, gameState, log);
        continue;
      }

      // currentMission: a short, human-readable "what is this unit doing right
      // now" label, read by sidebar.js for spectator mode's unit inspection.
      // Reset to a generic default here so every branch below overwrites it
      // with something more specific; a unit that genuinely finds nothing to
      // do this turn (see the final exploreWith fallback) keeps this default.
      unit.currentMission = "Idle";

      // Teleportation exhaustion: forced to Rest every turn until healed to 100% HP
      if (unit.conditions?.exhausted) {
        unit.resting = true;
        unit.usedThisTurn = true;
        unit.currentMission = "Recovering from teleportation (resting)";
        continue;
      }

      // Tech: Halfellow "Resilient Spirit" -- a death-save trigger forces
      // exactly one Rest turn (unlike exhausted, this doesn't repeat until
      // fully healed -- cleared immediately once honored here).
      if (unit.conditions?.forcedRest) {
        window.GameEngine.combat.clearCondition(unit, "forcedRest");
        unit.resting = true;
        unit.usedThisTurn = true;
        unit.currentMission = "Shaken by a near-death blow (forced to rest)";
        continue;
      }

      // Human "Teleportation": a badly hurt Wizard near danger blinks to safety
      // rather than fighting on. Simple defensive trigger, not offensive use.
      if (unit.typeId === "wizard" && civ.unlockedMechanics && civ.unlockedMechanics.has("teleportation")
          && unit.hp < unit.maxHp * 0.4 && attemptWizardTeleport(civ, unit, gameState, log)) {
        continue;
      }

      // Human "Invisibility": same defensive trigger as Teleportation, but
      // vanishes via the hidden condition instead of relocating -- useful
      // when Teleportation isn't researched (or already used/blocked) and no
      // enemy is yet adjacent (canGoHidden forbids that, same as Halfellow's
      // Sneaking Around).
      if (unit.typeId === "wizard" && civ.unlockedMechanics && civ.unlockedMechanics.has("invisibility")
          && unit.hp < unit.maxHp * 0.4 && attemptWizardInvisibility(civ, unit, gameState, log)) {
        continue;
      }

      // Elf "Roots of the World": same defensive trigger as Human's
      // Teleportation above, self-only (see attemptDruidTeleport).
      if (unit.typeId === "druid" && civ.unlockedMechanics && civ.unlockedMechanics.has("roots_of_the_world")
          && unit.hp < unit.maxHp * 0.4 && attemptDruidTeleport(civ, unit, gameState, log)) {
        continue;
      }

      // Elf "Shadowsteed" (2026-07-18, user-directed): carrying a rider is
      // ALWAYS this unit's first priority, checked here -- before ANY
      // combat consideration further down the cascade -- and it must NEVER
      // attack while riderless (Atk1/Def1 alone; see combat.js's
      // shadowsteedMount, which is what makes it dangerous once mounted).
      // A MOUNTED Shadowsteed skips this block entirely and falls through
      // to the normal dispatch below, same as any other military unit.
      if (unit.typeId === "shadowsteed" && !unit.carries) {
        if (operateShadowsteedCarry(civ, unit, gameState, log)) continue;
        if (maybeSeekShadowsteedRider(civ, unit, gameState, log)) continue;
        // No rider adjacent or reachable this turn (2026-07-19, user-
        // directed: "shadow steed should never explore -- they exist to
        // find a rider, then fight") -- wait in place rather than
        // wandering off exploring, so it's easy for an ally (or the seek
        // logic above, next turn) to still find it nearby.
        unit.currentMission = "Waiting for a rider";
        continue;
      }

      // Scouts (range 2, Atk/Def 1) were exploring unconditionally here,
      // ahead of the generic attack pass further down -- meaning a Scout
      // standing right next to a weak or wounded enemy would just wander off
      // instead of taking a free poke. considerAttackOrGarrison's own win-
      // probability math already suppresses a bad matchup (score *= 0.1
      // below threshold), and a ranged attack never draws a counter, so this
      // only ever fires when it's actually a good trade -- exploring is
      // still the default, just no longer at the cost of an easy kill.
      if (unit.typeId === "scout") {
        if (considerAttackOrGarrison(civ, unit, gameState, weights, difficulty, log)) continue;
        exploreWith(unit, gameState, log);
        continue;
      }
      if (window.GameData.getUnit(unit.typeId).isNaval) {
        // Same fix as Scouts just above: a Galley (range 2, Atk 1/Def 2) has
        // real combat stats, but operateGalley used to intercept every
        // naval unit's turn unconditionally, so it never got a chance to
        // take a free ranged shot at a nearby enemy before ferrying/
        // exploring. Attacking doesn't move the Galley, so carried cargo
        // (if any) stays safely aboard either way -- and if the Galley
        // dies in the exchange, considerAttackOrGarrison already drops its
        // cargo onto the tile, same as any other carrier's death.
        if (considerAttackOrGarrison(civ, unit, gameState, weights, difficulty, log)) continue;
        operateGalley(civ, unit, gameState, log);
        continue;
      }

      // Halfellow "fight smarter, not harder": before committing to a
      // straight fight, weigh going Hidden instead (defensively when
      // outmatched, or offensively to set up an ambush) -- see
      // maybeHalfellowStealthPlay. Only ever preempts the turn when hiding
      // actually wins out; otherwise falls through to the normal cascade.
      if (maybeHalfellowStealthPlay(civ, unit, gameState, weights, difficulty, log)) continue;

      // Elf "fight smarter, not harder": same idea as Halfellow's above, but
      // split by whether the unit is Ranged (the Ranger's hide-shoot-hide
      // loop needs no ally bait) or melee (the Blade Dancer's ambush does) --
      // see maybeElfStealthPlay.
      if (maybeElfStealthPlay(civ, unit, gameState, weights, difficulty, log)) continue;

      // Human Wizard: offensive/utility use of Dungeon Delve and
      // Teleportation on top of the purely defensive flee triggers above --
      // see maybeHumanWizardPlay. Only preempts the turn when one of those
      // plays actually applies; otherwise falls through to the normal cascade.
      if (maybeHumanWizardPlay(civ, unit, gameState, weights, difficulty, log)) continue;

      // Elf Druid: Nature's Grace healing, Raptor/Shadowsteed summon
      // management, and Roots of the World expansion -- see maybeElfDruidPlay.
      if (maybeElfDruidPlay(civ, unit, gameState, weights, difficulty, log)) continue;

      // Always try to attack first — aggressiveness and win probability decide
      // whether a specific fight is worth taking.
      const attacked = considerAttackOrGarrison(civ, unit, gameState, weights, difficulty, log);
      if (attacked || unit.usedThisTurn) continue;

      // Orc "Dire Wolf" (user-directed): hunting is this unit's entire job,
      // ahead of every other Orc strategy -- an exclusive branch (like
      // Runeforged Titan's below) so a Dire Wolf never falls through to
      // Shield Wall positioning, Pillage-holding, Crusade/Heavy-Metal-style
      // vanguard behavior, Prospector's Claim, Orc Swarm, or the explore
      // roll. The attack-first check just above already let it fight
      // anything it was already adjacent to; this only ever fires once that
      // didn't happen. Holds position (never explores -- also see its
      // `neverExplores` unit-data flag) once no enemy remains anywhere on
      // its landmass, rather than wandering off.
      if (unit.typeId === "dire_wolf") {
        if (maybeDireWolfHunt(civ, unit, gameState, log)) continue;
        unit.currentMission = "No enemy to hunt on this landmass";
        continue;
      }

      // Computed once here (rather than at its original single call site,
      // down by the explore roll) because Dwarf Shield Wall also needs it:
      // a unit near a fight closes ranks with an ally before the fight
      // actually lands on IT, instead of dueling alone -- see
      // maybeShieldWallPosition. Same "fighting or standing near an ally
      // who's fighting" definition the explore veto further down reuses.
      const nearActiveCombat = isNearActiveCombat(civ, unit, gameState);

      // Dwarf "Power Metal": a Troubadour that knows both aura techs picks
      // whichever suits the situation (offense mid-fight, sustain
      // otherwise) before anything else this turn -- see
      // maybeSwitchTroubadourAura.
      if (maybeSwitchTroubadourAura(civ, unit, gameState, nearActiveCombat, log)) continue;

      // Dwarf "Shield Wall": +defense per adjacent Dwarf soldier only
      // matters if units actually stand next to each other -- see
      // maybeShieldWallPosition.
      if (maybeShieldWallPosition(civ, unit, gameState, nearActiveCombat, log)) continue;

      // Orc "Pillage and Loot": an unattended raider actively suppressing
      // enemy tiles right now should keep doing that instead of wandering
      // off to explore or reinforce a home city -- see maybeHoldPillagePosition.
      if (maybeHoldPillagePosition(civ, unit, gameState, log)) continue;

      // Human "Crusade": an otherwise-idle Paladin heads for its own army
      // instead of soloing, so its holy aura (heal + stat buff, 1-tile
      // radius -- see turns.js) actually reaches allies. See
      // maybeCrusadeVanguard.
      if (maybeCrusadeVanguard(civ, unit, gameState, log)) continue;

      // Dwarf "Heavy Metal"/"Epic Metal": same idea, Troubadour instead of
      // Paladin -- see maybeHeavyMetalVanguard.
      if (maybeHeavyMetalVanguard(civ, unit, gameState, log)) continue;

      // Dwarf "Runeforged Titan": a live Titan's entire job is marching on
      // an enemy city -- see maybeTitanMarch. Handled as its own exclusive
      // branch (not just "checked before everything else") so a Titan that
      // currently has no visible target NEVER falls through to Prospector's
      // Claim, patrol, garrison, or any other ordinary idle-Dwarf routine --
      // it just holds position instead, exactly like the neverExplores
      // fallback further down would once nothing else claimed its turn,
      // just reached immediately rather than at the very end of the
      // cascade. Other Dwarf military units escort a marching Titan
      // instead of operating solo, as long as they're not already in a
      // fight of their own -- see maybeEscortTitan.
      //
      // Engaging a visible enemy comes first, even ahead of the march --
      // "defend itself if attacked" (the tech's own wording) turned out to
      // mean more than just fighting back when something lands a hit on it:
      // a Titan garrisoned in a city that's under attack, or one that spots
      // a raider crossing its path, needs to actually go destroy it rather
      // than wait passively for either the attack to resolve on its own or
      // its preset target city to become reachable. huntNearestEnemy is
      // already landmass-safe (never chases something across water) and is
      // the same "chase the nearest visible enemy" logic ordinary units use
      // -- reused as-is rather than duplicated.
      if (unit.typeId === "runeforged_titan") {
        if (huntNearestEnemy(civ, unit, gameState)) continue;
        if (maybeTitanMarch(civ, unit, gameState, log)) continue;
        // pickTitanTarget only ever considers cities on the Titan's OWN
        // landmass -- if that landmass has nothing left to march on (fully
        // conquered, or the only enemy cities left are overseas), the Titan
        // used to just hold position forever with no way to ever leave.
        // Same fix shape as ordinary military units: once this civ controls
        // the majority of the Titan's landmass, head for a galley and cross
        // to a foreign shore instead of idling -- see seekOverseasInvasion.
        if (seekOverseasInvasion(civ, unit, gameState, log)) continue;
        unit.resting = true;
        unit.usedThisTurn = true;
        unit.currentMission = "Holding position, awaiting a target city";
        continue;
      }
      if (!nearActiveCombat && maybeEscortTitan(civ, unit, gameState, log)) continue;

      // Dwarf "Prospector's Claim"/"The Deep Mines": an otherwise-idle Dwarf
      // unit (nothing better to fight or defend) pursues/protects a Gold
      // Vein claim instead of falling through to generic explore/patrol.
      // Checked here (any unit type, not race-gated in code -- purely via
      // civ.unlockedMechanics) so it only fires once combat/reinforcement
      // priorities above have already passed on this unit.
      if (civ.unlockedMechanics && civ.unlockedMechanics.has("prospectors_claim")
          && maybeProspectorsClaimPlay(civ, unit, gameState, log)) continue;

      // Orc Dragon Riders: pick up or drop off a passenger when otherwise idle.
      // canCarryUnit is a formal PROPERTY (see combat.js getUnitProperty) --
      // Dragon has no canCarryUnit in its base unit.js data, so this is false
      // until the Dragon Riders tech grants it via unit_stat_upgrade, exactly
      // like any other tech-granted property.
      if (unit.typeId === "dragon" && window.GameEngine.combat.getUnitProperty(unit, civ, "canCarryUnit", false)
          && operateDragonCarry(civ, unit, gameState, log)) continue;

      // Elf "Shadowsteed": carry-seeking is now handled much earlier in this
      // cascade (before any combat consideration -- see the "first priority"
      // block near the Scout/Galley branches above), since an unmounted
      // Shadowsteed must never reach the generic attack dispatch at all. A
      // MOUNTED Shadowsteed has nothing left to decide here (it already has
      // a rider), so there's no call left to make at this point in the cascade.

      // Halfellow "Devoted Companions": pick up (or set back down) an injured
      // ally when otherwise idle -- see operateCompanionCarry. If nothing's
      // adjacent to pick up, look further afield for an injured ally worth
      // closing on -- see maybeSeekInjuredCompanion.
      if (civ.raceId === "halfellow" && operateCompanionCarry(civ, unit, gameState, log)) continue;
      if (civ.raceId === "halfellow" && maybeSeekInjuredCompanion(civ, unit, gameState, log)) continue;

      // Halfellow "teamwork": tend to move in groups rather than operate as
      // lone units -- see maybeHalfellowRegroup. Checked before the explore
      // roll so grouping up wins out over a lone unit's curiosity.
      if (civ.raceId === "halfellow" && maybeHalfellowRegroup(civ, unit, gameState, log)) continue;

      // Elf Ranger "hidden groups" (user-directed): Rangers tend to move in
      // groups, ready to synchronize a volley -- see maybeRangerRegroup. The
      // actual synchronized-attack half is a target-selection bonus in
      // considerAttackOrGarrison (RANGER_VOLLEY_BONUS), not here -- this only
      // handles closing the distance so a lone Ranger isn't off skirmishing
      // solo when it could be forming up with siblings first.
      if (unit.typeId === "ranger" && maybeRangerRegroup(civ, unit, gameState, log)) continue;

      // Orc "always looking for a fight" (2026-07-19, user-directed):
      // unconditional, not gated by an aggressiveness roll like the generic
      // hunt further below -- the whole warband converges on shared contact
      // the instant any part of the civ spots an enemy. Checked BEFORE the
      // explore roll (not after, see maybeOrcSwarm's own placement history)
      // so a real sighting always preempts routine patrol, never competes
      // with it on a coin flip. See maybeOrcSwarm/computeOrcSwarmSignal.
      if (maybeOrcSwarm(civ, unit, gameState, log)) continue;

      // Exploration vs. military duty: curiosity (and a real need for more
      // cities to unlock further research) pulls this idle unit toward
      // finding new land instead of its usual garrison/hunt/defend routine;
      // military need (militarism/aggressiveness, spiking under real threat)
      // pulls the other way. See explorePostureFor for the full balance --
      // rolled BEFORE the garrison/hunt/defend checks below so exploring is a
      // genuine alternative to them, not just a last-resort fallback once
      // everything else has already failed. Hard veto first, though: a unit
      // fighting or standing near an ally who's fighting never explores, no
      // matter how curious its race is (see isNearActiveCombat, computed
      // once further up and reused by the final exploreWith fallback
      // further down too).
      const explorable = !window.GameData.getUnit(unit.typeId).neverExplores;
      if (explorable && !nearActiveCombat && Math.random() < explorePostureFor(civ, gameState)) {
        exploreWith(unit, gameState, log);
        continue;
      }

      // Unit is still idle. Garrison preference: units default to holding
      // their city post. Militarism controls how tightly they grip that post:
      // high-militarism races (orc 0.9, undead 0.8) hold reliably; low-
      // militarism races (halfellow 0.2, elf 0.3) break out and explore.
      // Resting while garrisoned is how healing actually happens now (Rest
      // is a required explicit action, no more free per-turn healing).
      //
      // Universal garrison rule (2026-07-12, see cities.js advanceCityFill):
      // a garrisoned city now fills in influence tiles faster, scaled by the
      // civ's OWN industriousness. That gives an economically-minded but
      // low-militarism race (Halfellow: industriousness 1.0, militarism 0.2)
      // a real strategic reason to hold position even though it has no
      // martial urge to -- so the garrison-desire roll blends the two traits
      // (whichever is higher wins) instead of militarism alone. A
      // high-militarism, low-industry race (Orc) is unaffected -- its
      // militarism already dominates the max. See [[project_halfellow_tactics]].
      const garrisonDesire = Math.max(militarism, industriousness * INDUSTRIOUSNESS_GARRISON_WEIGHT);
      const onOwnCity = civ.cities.some((c) => c.x === unit.x && c.y === unit.y);
      // Elf Raptor/Shadowsteed (2026-07-18, user-directed): never garrison.
      // Both are Druid-summoned support units built for a specific job
      // (scouting/exploring, or fighting once mounted -- see combat.js's
      // shadowsteedMount) -- neither should ever settle into passive city
      // defense duty. Falls through to the hunt/raid/frontier-push branches
      // below exactly as if this civ had zero garrison desire.
      const canGarrison = unit.typeId !== "raptor" && unit.typeId !== "shadowsteed";
      if (canGarrison && onOwnCity && Math.random() < garrisonDesire) {
        unit.resting = true;
        unit.usedThisTurn = true; // stay garrisoned and rest this turn
        unit.currentMission = "Garrisoning home city (resting)";
        continue;
      }

      // Tactical: aggressiveness sets the odds a garrison-idle unit chases a
      // visible enemy UNIT this turn, rather than waiting for one to wander
      // close. Every race hunts sometimes, scaled by how aggressive they are.
      const unitAgg = aggressivenessFor(civ);
      if (Math.random() < unitAgg && huntNearestEnemy(civ, unit, gameState)) continue;

      // Strategic: military posture (aggressiveness vs. militarism) decides
      // whether this civ's idle units default to marching on enemy cities to
      // raze their structures (denying enemy influence) or shoring up an
      // undefended city of their own (protecting their influence). See the
      // MILITARY STRATEGY note above huntEnemyInfrastructure. Checked BEFORE
      // both the frontier-push and damaged-rest fallbacks below -- these are
      // a military's actual job (see the design note), so they take priority
      // over opportunistic border-nibbling. A defense-postured unit retreats
      // toward an undefended city even while hurt (it heals faster there
      // anyway -- 4x vs. field rate -- so this dominates resting in the
      // open); heavily wounded units skip offense (raidHealthFloor) so they
      // don't march deeper into danger to die.
      const offenseRatio = militaryPostureFor(civ);
      const raidHealthFloor = unit.maxHp * 0.5;
      if (Math.random() < offenseRatio) {
        if (unit.hp >= raidHealthFloor && huntEnemyInfrastructure(civ, unit, gameState)) continue;
      } else {
        // Dwarf "Deep Roads Rite": a unit already sitting on a Deep Gate
        // checks the network before falling back to an ordinary march.
        if (civ.unlockedMechanics && civ.unlockedMechanics.has("deep_roads")
            && maybeDeepRoadsRelocate(civ, unit, gameState)) continue;
        if (reinforceHomeCity(civ, unit, gameState)) continue;
      }

      // Overseas invasion: this unit's home ground is already mostly conquered
      // (see computeLandmassMajority) -- there's nothing left to defend or raid
      // HERE, so head for a galley and carry the fight to a foreign shore instead
      // of idling. Same health gate as the offense branch above (a beat-up unit
      // rests first rather than shipping out hurt).
      if (unit.hp >= raidHealthFloor && seekOverseasInvasion(civ, unit, gameState, log)) continue;

      // No strategic job to do right now. Try to push toward a contested
      // frontier -- opportunistic border-claiming, secondary to the above.
      pushTowardInfluenceFrontier(civ, unit, gameState, log);
      if (unit.usedThisTurn) continue;

      // Damaged and nothing better to do: Rest instead of wandering around hurt.
      if (unit.hp < unit.maxHp) {
        unit.resting = true;
        unit.usedThisTurn = true;
        unit.currentMission = "Resting to heal (idle)";
        continue;
      }

      // Endgame stalemate fix: every branch above only reacts to an enemy
      // that's visible RIGHT NOW. Once this civ's own frontier is fully
      // settled (pushTowardInfluenceFrontier found nothing) and the enemy
      // has retreated out of sight, that leaves a fully healthy idle unit
      // with genuinely nothing to react to -- march it toward the nearest
      // enemy city this civ has ever seen instead of defaulting straight to
      // comfort-terrain patrol. See huntKnownEnemyTerritory and the memory
      // it reads, populated once per civ-turn in beginAITurn above.
      if (huntKnownEnemyTerritory(civ, unit, gameState, log)) continue;

      // Nothing found a target: patrol toward race-preferred terrain if it's
      // nearby, otherwise explore generically -- unless still vetoed by
      // nearActiveCombat (computed once, above), in which case the unit
      // just holds its current position (stays "Idle") rather than
      // wandering off while it or an ally is fighting.
      const racePatrolled = patrolRaceTerrain(civ, unit, gameState);
      if (!racePatrolled && !nearActiveCombat) {
        if (explorable) {
          exploreWith(unit, gameState, log);
        } else {
          // neverExplores (Dwarf Runeforged Titan): hold position and heal
          // rather than wander off -- see units.js's doc comment on the flag.
          unit.resting = true;
          unit.usedThisTurn = true;
          unit.currentMission = "Holding position (never explores)";
        }
      }
    } while (false);
  }

  /** Loops runUnitTurn (above) over every not-yet-acted unit, in civ.units
   *  order (creation order) -- used by the non-granular paths (a full
   *  runTurn/runAITurn call, e.g. the headless sim harness or a human's
   *  synchronous End Turn) where the whole civ resolves in one call, with no
   *  per-unit visual pacing. Spectator mode's visible one-unit-at-a-time
   *  stepping instead calls runUnitTurn directly, once per tick, via
   *  turns.js's stepCivTurnUnit/advanceOneUnitStep. */
  function maybeMoveUnits(civ, gameState, weights, difficulty, log) {
    for (const unit of civ.units) {
      runUnitTurn(civ, unit, gameState, weights, difficulty, log);
    }
  }

  /** Is (x,y) a legal teleport landing tile for `targetUnit`? Out of bounds,
   *  water, any unit already there (friend or foe), or an enemy wall/
   *  building/city all disqualify it -- teleporting can never place a unit
   *  somewhere it could never otherwise stand. */
  function isValidTeleportTile(gameState, x, y, targetUnit) {
    const { map, civs } = gameState;
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;
    const tile = map.tiles[y * map.width + x];
    if (window.GameData.TERRAIN[tile.terrain].isWater) return false;
    if (Object.values(civs).some((c) => c.units.some((u) => u !== targetUnit && u.x === x && u.y === y))) return false;
    if (isEnemyStructureBlockingTile(tile, targetUnit)) return false;
    if (isEnemyCityBlockingTile(civs, x, y, targetUnit)) return false;
    return true;
  }

  /** Resolves the actual tile a teleport aimed at (x,y) lands on: (x,y)
   *  itself if legal (see isValidTeleportTile), otherwise the first legal
   *  tile among its 8 neighbors (checked in random order), otherwise null if
   *  nowhere right there is open. */
  function resolveTeleportLanding(gameState, x, y, targetUnit) {
    if (isValidTeleportTile(gameState, x, y, targetUnit)) return { x, y };
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (isValidTeleportTile(gameState, nx, ny, targetUnit)) return { x: nx, y: ny };
    }
    return null;
  }

  /**
   * Human "Teleportation": the Wizard (`caster`) instantly teleports either
   * itself or an adjacent allied unit (`targetUnit`) to (destX, destY) -- or
   * the nearest open adjacent tile if that exact tile is blocked (see
   * resolveTeleportLanding). Destination can be anywhere this civ has ever
   * explored (gameState.explored), not just currently visible. Works exactly
   * the same whether the caster is currently Hidden or not -- Invisibility
   * doesn't block casting.
   *
   * Costs the WIZARD's whole turn and leaves IT exhausted (forced to Rest
   * every turn until healed to 100% HP -- see maybeMoveUnits/turns.js)
   * regardless of who was actually moved. When teleporting an ally rather
   * than itself, that ally's turn is also consumed (it's already been moved
   * this turn) but it does NOT become exhausted -- only the caster pays that
   * price. Returns true on success.
   */
  function performWizardTeleport(civ, caster, targetUnit, destX, destY, gameState, log) {
    if (targetUnit !== caster
        && window.GameEngine.influence.chebyshev(caster.x, caster.y, targetUnit.x, targetUnit.y) > 1) {
      return false; // can only teleport an ally that's currently adjacent
    }
    const landing = resolveTeleportLanding(gameState, destX, destY, targetUnit);
    if (!landing) return false;

    targetUnit.x = landing.x;
    targetUnit.y = landing.y;
    // Suppress render.js's move-glide animation for this jump -- a teleport
    // should pop instantly, not visually slide across the map like a walk.
    targetUnit._lastLogicalX = landing.x;
    targetUnit._lastLogicalY = landing.y;
    targetUnit._renderX = landing.x;
    targetUnit._renderY = landing.y;
    targetUnit._animStart = 0;

    window.GameEngine.combat.setCondition(caster, "exhausted", {});
    caster.usedThisTurn = true;
    if (targetUnit !== caster) targetUnit.usedThisTurn = true;

    if (targetUnit === caster) {
      caster.currentMission = "Blinked away (exhausted, must rest)";
      log.push(`Teleport: ${civ.id}'s Wizard blinked to (${landing.x},${landing.y}), exhausted until fully healed`);
    } else {
      caster.currentMission = `Teleported a ${targetUnit.typeId} to (${landing.x},${landing.y}) (exhausted, must rest)`;
      log.push(`Teleport: ${civ.id}'s Wizard teleported a ${targetUnit.typeId} to (${landing.x},${landing.y}), Wizard exhausted until fully healed`);
    }
    return true;
  }

  // How far a Wizard's Freezing Touch can reach -- a "touch" spell, so short
  // range rather than Teleportation's whole-map reach. Same order of
  // magnitude as Halfellow's short-range tactical checks (HALFELLOW_STEALTH_RANGE).
  const FREEZING_TOUCH_RANGE = 2;
  const FROZEN_DURATION = 3;

  /** Applies the Frozen condition (0 movement, -25% attack -- see combat.js
   *  effectiveAttack and this file's moveUnitToward) to `target` for
   *  FROZEN_DURATION turns. Costs the caster's whole turn, same convention as
   *  Teleportation, but does NOT leave the caster exhausted afterward --
   *  Freezing Touch is a lesser, more frequently-usable L3 ability. */
  function performFreezingTouch(civ, caster, target, log) {
    window.GameEngine.combat.setCondition(target, "frozen", {
      attackMult: 0.75, expiresAtTurn: currentTurnNumber + FROZEN_DURATION,
    });
    caster.usedThisTurn = true;
    caster.currentMission = `Froze ${target.civId}'s ${target.typeId} at (${target.x},${target.y})`;
    log.push(`Freezing Touch: ${civ.id}'s Wizard freezes ${target.civId}'s ${target.typeId} at (${target.x},${target.y})`);
  }

  /**
   * Human "Freezing Touch" AI: two short-range triggers (see
   * FREEZING_TOUCH_RANGE), both skipping targets already Hidden (can't be
   * targeted) or already Frozen (no point re-casting):
   *
   *   DEFENSIVE (flee) -- checked first, since the Wizard's own survival
   *   comes before supporting an ally's fight: a nearby enemy the WIZARD
   *   ITSELF would lose a straight fight against gets frozen instead of
   *   fought -- it can't close distance or reposition next turn, buying a
   *   window to retreat or regroup rather than get run down.
   *
   *   OFFENSIVE (support) -- an ally within striking range of the same
   *   enemy is in a marginal-or-losing matchup against it: freeze the enemy
   *   first. -25% attack, plus guaranteed immobility so it can't disengage,
   *   meaningfully improves the ally's odds on its next exchange.
   *
   * Returns true if it consumed the Wizard's turn.
   */
  function maybeFreezingTouch(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const threshold = minAcceptableWinProbability(civ);

    const candidates = [];
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.conditions?.hidden || eu.conditions?.frozen) continue;
        if (!visible.has(eu.y * map.width + eu.x)) continue;
        if (window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y) > FREEZING_TOUCH_RANGE) continue;
        candidates.push(eu);
      }
    }
    if (candidates.length === 0) return false;

    for (const eu of candidates) {
      if (estimateWinProbability(unit, eu, civs, {}, 20) < threshold) {
        performFreezingTouch(civ, unit, eu, log);
        return true;
      }
    }

    for (const eu of candidates) {
      const strugglingAlly = civ.units.some((ally) => {
        if (ally === unit || ally.carriedBy) return false;
        if (window.GameData.getUnit(ally.typeId).category !== "military") return false;
        if (window.GameEngine.influence.chebyshev(ally.x, ally.y, eu.x, eu.y) > 1) return false;
        return estimateWinProbability(ally, eu, civs, {}, 20) < threshold;
      });
      if (strugglingAlly) {
        performFreezingTouch(civ, unit, eu, log);
        return true;
      }
    }

    return false;
  }

  const FLIGHT_DURATION = 5;
  const FLIGHT_MOVE_BONUS = 2;
  const FLIGHT_VISION_BONUS = 2;

  /** Grants `target` the Flying property (see combat.js's isFlying), +2
   *  movement (see moveUnitToward's flying-condition check), and +2 vision
   *  (see turns.js's refreshVisibility) for FLIGHT_DURATION turns via a
   *  temporary condition -- does not touch unitOverrides since this targets
   *  one specific unit instance, not every unit of its type civ-wide. Costs
   *  the caster's whole turn; unlike Teleportation, does NOT consume the
   *  target's turn (the target hasn't been moved or otherwise acted for --
   *  it can still move/attack normally this turn) and does NOT leave the
   *  caster exhausted, same convention as Freezing Touch. */
  function performWizardGrantFlight(civ, caster, target, log) {
    window.GameEngine.combat.setCondition(target, "flying", {
      expiresAtTurn: currentTurnNumber + FLIGHT_DURATION,
      moveBonus: FLIGHT_MOVE_BONUS,
      visionBonus: FLIGHT_VISION_BONUS,
    });
    caster.usedThisTurn = true;
    caster.currentMission = `Granted flight to ${target.typeId} at (${target.x},${target.y})`;
    log.push(`Flight: ${civ.id}'s Wizard grants flight to their ${target.typeId} at (${target.x},${target.y})`);
  }

  /**
   * Human "Flight" AI: an opportunistic support cast, not a reactive one --
   * flight is a strict upside for its recipient (see combat.js's isFlying:
   * moves over all terrain, ignoring every terrain movement penalty; it
   * grants no combat-targeting protection at all), so there's no "should I"
   * threshold to weigh the way Freezing Touch has to. Grants it to the
   * strongest adjacent allied military unit that doesn't already have it
   * (base property, or an earlier grant still active), so the cast is never
   * wasted re-flighting something already flying. Returns true if it
   * consumed the Wizard's turn.
   */
  function maybeGrantFlight(civ, unit, gameState, log) {
    let best = null, bestPower = -1;
    for (const ally of civ.units) {
      if (ally === unit || ally.carriedBy) continue;
      if (window.GameData.getUnit(ally.typeId).category !== "military") continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > 1) continue;
      if (window.GameEngine.combat.isFlying(ally)) continue;
      const power = unitCombatPower(ally, civ);
      if (power > bestPower) { bestPower = power; best = ally; }
    }
    if (!best) return false;
    performWizardGrantFlight(civ, unit, best, log);
    return true;
  }

  /**
   * Defensive trigger: a badly hurt Wizard blinks itself to the safest
   * remembered tile (anywhere explored, not just currently visible) as far
   * as possible from every visible enemy, via performWizardTeleport. Returns
   * true if the teleport happened.
   */
  function attemptWizardTeleport(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    const explored = gameState.explored[civ.id] || new Set();
    const enemyPositions = [];
    for (const other of Object.values(civs)) {
      if (other.id === civ.id || other.eliminated) continue;
      for (const eu of other.units) if (!eu.conditions?.hidden) enemyPositions.push(eu);
    }
    let best = null, bestDist = -1;
    for (const idx of explored) {
      const x = idx % map.width, y = Math.floor(idx / map.width);
      if (!isValidTeleportTile(gameState, x, y, unit)) continue;
      const nearestEnemyDist = enemyPositions.reduce((min, eu) =>
        Math.min(min, window.GameEngine.influence.chebyshev(x, y, eu.x, eu.y)), Infinity);
      if (nearestEnemyDist > bestDist) { bestDist = nearestEnemyDist; best = { x, y }; }
    }
    if (!best) return false;
    return performWizardTeleport(civ, unit, unit, best.x, best.y, gameState, log);
  }

  /**
   * Human "Invisibility": a badly hurt Wizard vanishes instead of fighting
   * on -- a defensive trigger paralleling Teleportation, but via the hidden
   * condition (see combat.js's canGoHidden/enterHidden) rather than
   * relocating. Costs the whole turn; blocked if an enemy is already
   * adjacent (canGoHidden's shared rule). Returns true if it went hidden.
   */
  function attemptWizardInvisibility(civ, unit, gameState, log) {
    if (!window.GameEngine.combat.canGoHidden(unit, civ, gameState.civs)) return false;
    window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
    unit.usedThisTurn = true;
    unit.currentMission = "Vanished from danger (hidden)";
    log.push(`Invisibility: ${civ.id}'s Wizard turned invisible at (${unit.x},${unit.y})`);
    return true;
  }

  // Minimum score findVisibleUndefendedSiegeTarget requires before a target
  // is considered worth burning a Teleport cast on -- filters out trivial
  // structures without hardcoding a specific building/wall list.
  const TELEPORT_STRIKE_MIN_SCORE = 8;

  /**
   * Scans every currently-visible tile for an enemy city or structure with
   * NO garrison present -- a confirmed-safe target for a Wizard's offensive
   * Teleport play (see maybeTeleportStrike). Unlike considerAttackOrGarrison's
   * adjacent-8 siege scan (which only looks right next to the acting unit),
   * this searches the WHOLE visible set, since Teleport can reach anywhere
   * explored. Deliberately requires CURRENT vision rather than just
   * tileMemory, since tileMemory never snapshots units (see turns.js's
   * refreshVisibility) -- "confirmed undefended" can only ever mean
   * "undefended right now, as far as we can currently see."
   * Returns { kind: "city"|"structure", x, y, targetCiv } for the single
   * best-scoring target, or null.
   */
  function findVisibleUndefendedSiegeTarget(civ, gameState) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    let best = null, bestScore = -Infinity;

    const isGarrisonedAt = (x, y) => Object.values(civs).some((c) =>
      c.units.some((u) => u.x === x && u.y === y && !u.conditions?.hidden));

    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const city of otherCiv.cities) {
        if (!visible.has(city.y * map.width + city.x)) continue;
        if (isGarrisonedAt(city.x, city.y)) continue;
        const level = Math.floor(city.population);
        const score = 50 + level * 5;
        if (score > bestScore) { bestScore = score; best = { kind: "city", x: city.x, y: city.y, targetCiv: otherCiv }; }
      }
      for (const city of otherCiv.cities) {
        for (const s of city.structures) {
          if (!visible.has(s.y * map.width + s.x)) continue;
          if (isGarrisonedAt(s.x, s.y)) continue;
          const building = window.GameData.getBuilding(s.id);
          const score = (building.influenceMult ? (building.influenceMult - 1) * 40 : 0)
            + (building.radiusBonus ? building.radiusBonus * 8 : 0) + 4 + (building.isWall ? 8 : 0);
          if (score > bestScore) { bestScore = score; best = { kind: "structure", x: s.x, y: s.y, targetCiv: otherCiv }; }
        }
      }
    }
    if (!best || bestScore < TELEPORT_STRIKE_MIN_SCORE) return null;
    return best;
  }

  /**
   * Human "Teleportation" offense: strikes a confirmed-undefended enemy city
   * or structure (see findVisibleUndefendedSiegeTarget). Prefers teleporting
   * an adjacent ALLY over the Wizard itself -- a Trebuchet if one's on hand
   * (its 200% siege property makes it devastating against an undefended
   * target, and Teleport erases its crippling movement-1 mobility), else the
   * strongest adjacent military unit -- since only the CASTER becomes
   * exhausted (see performWizardTeleport): a teleported ally can swing the
   * very next turn, while a self-teleported Wizard still needs a full turn
   * of forced Rest first even at 100% HP. Self-teleport is only used as a
   * fallback (to set up a Fireball once it recovers), and only if Fireball
   * is actually researched -- otherwise there's nothing for it to do once it
   * arrives. Never strips the civ down to zero military units. Returns true
   * if it consumed the turn.
   */
  function maybeTeleportStrike(civ, unit, gameState, log) {
    const target = findVisibleUndefendedSiegeTarget(civ, gameState);
    if (!target) return false;

    const adjacentAllies = civ.units.filter((u) =>
      u !== unit && !u.carriedBy && !u.usedThisTurn
      && window.GameData.getUnit(u.typeId).category === "military"
      && window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y) <= 1);

    const trebuchet = adjacentAllies.find((u) => u.typeId === "trebuchet");
    const bestAlly = trebuchet || adjacentAllies.reduce((best, u) => {
      const ud = window.GameData.getUnit(u.typeId);
      return (!best || ud.attack > window.GameData.getUnit(best.typeId).attack) ? u : best;
    }, null);

    let strikeUnit = bestAlly;
    if (bestAlly) {
      // Excludes the Wizard itself -- a spellcaster doesn't count as "other
      // defense" for this check, which exists to avoid stripping away the
      // civ's only REAL soldier.
      const otherMilitary = civ.units.filter((u) =>
        u.typeId !== "wizard" && window.GameData.getUnit(u.typeId).category === "military" && !u.carriedBy).length;
      if (otherMilitary <= 1) strikeUnit = null;
    }
    if (!strikeUnit && civ.unlockedMechanics.has("fireball_splash")) strikeUnit = unit;
    if (!strikeUnit) return false;

    const ok = performWizardTeleport(civ, unit, strikeUnit, target.x, target.y, gameState, log);
    if (!ok) return false;

    if (strikeUnit === unit) {
      unit.currentMission = `Teleported to strike ${target.targetCiv.id}'s ${target.kind} at (${target.x},${target.y})`;
      log.push(`Teleport Strike: ${civ.id}'s Wizard teleports itself against ${target.targetCiv.id}'s ${target.kind} at (${target.x},${target.y})`);
    } else {
      unit.currentMission = `Teleported a ${strikeUnit.typeId} to strike ${target.targetCiv.id}'s ${target.kind} at (${target.x},${target.y})`;
      log.push(`Teleport Strike: ${civ.id}'s Wizard teleports a ${strikeUnit.typeId} against ${target.targetCiv.id}'s ${target.kind} at (${target.x},${target.y})`);
    }
    return true;
  }

  /** Finds the nearest known Ruin tile (currently visible OR remembered via
   *  tileMemory) that isn't already being delved by one of this civ's OTHER
   *  wizards, within a reasonable search radius. Returns {x,y,landmassId} or
   *  null. Pass `sameLandmassOnly: true` to restrict the search to tiles
   *  actually walkable from `unit`'s current position -- used to try a
   *  direct march first; the caller falls back to an unrestricted search
   *  (this option omitted) to find a candidate worth sailing to instead,
   *  see maybeDungeonDelvePlay/seekOverseasResource. Without this
   *  restriction option, a ruin on a different landmass used to get
   *  targeted directly, and moveUnitToward (land-only pathfinding) would
   *  just walk the unit to the shore and strand it there forever. */
  function findNearbyUnclaimedRuin(civ, unit, gameState, options = {}) {
    const { map } = gameState;
    const SEARCH_RADIUS = 20;
    const memory = (gameState.tileMemory && gameState.tileMemory[civ.id]) || {};
    const claimedByOther = new Set(
      civ.units
        .filter((u) => u !== unit && u.typeId === "wizard" && (u._ritualTurns || 0) >= 1)
        .map((u) => `${u.x},${u.y}`)
    );
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    let best = null, bestDist = Infinity;
    for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
      for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
        const x = unit.x + dx, y = unit.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const idx = y * map.width + x;
        const isRuin = map.tiles[idx].isRuin || (memory[idx] && memory[idx].isRuin);
        if (!isRuin || claimedByOther.has(`${x},${y}`)) continue;
        if (options.sameLandmassOnly && unitLandmassId >= 0 && map.tiles[idx].landmassId !== unitLandmassId) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, x, y);
        if (dist < bestDist) { bestDist = dist; best = { x, y, landmassId: map.tiles[idx].landmassId }; }
      }
    }
    return best;
  }

  /** Finds the nearest known Gold Vein tile (currently visible OR remembered
   *  via tileMemory) that isn't already being claimed by one of this civ's
   *  OTHER units, within a reasonable search radius. Returns
   *  {x,y,landmassId} or null. Mirrors findNearbyUnclaimedRuin above --
   *  see Dwarf "Prospector's Claim", including the `sameLandmassOnly`
   *  option and the reason it exists. */
  function findNearbyUnclaimedGoldVein(civ, unit, gameState, options = {}) {
    const { map } = gameState;
    const SEARCH_RADIUS = 20;
    const memory = (gameState.tileMemory && gameState.tileMemory[civ.id]) || {};
    const claimedByOther = new Set(
      civ.units
        .filter((u) => u !== unit && (u._ritualTurns || 0) >= 1)
        .map((u) => `${u.x},${u.y}`)
    );
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    let best = null, bestDist = Infinity;
    for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
      for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
        const x = unit.x + dx, y = unit.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const idx = y * map.width + x;
        const isGoldVein = map.tiles[idx].resource === "gold" || (memory[idx] && memory[idx].resource === "gold");
        if (!isGoldVein || claimedByOther.has(`${x},${y}`)) continue;
        if (options.sameLandmassOnly && unitLandmassId >= 0 && map.tiles[idx].landmassId !== unitLandmassId) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, x, y);
        if (dist < bestDist) { bestDist = dist; best = { x, y, landmassId: map.tiles[idx].landmassId }; }
      }
    }
    return best;
  }

  /**
   * Dwarf "Prospector's Claim"/"The Deep Mines" pursuit/protection -- mirrors
   * maybeDungeonDelvePlay below, but open to any idle Dwarf unit (not just
   * one type) and anchored on Gold Veins instead of Ruins. Two cases:
   *
   *   ALREADY CLAIMING (standing on a Gold Vein, _ritualTurns >= 1): protect
   *   the investment -- moving away or dying wipes out everything it's
   *   claimed INSTANTLY (see turns.js), so an idle claiming unit must never
   *   wander off. An adjacent enemy is left to the normal attack dispatch.
   *
   *   NOT YET CLAIMING: pursuit of the nearest known unclaimed Gold Vein,
   *   gated on being reasonably healthy first.
   *
   * Returns true if it consumed the turn.
   */
  function maybeProspectorsClaimPlay(civ, unit, gameState, log) {
    const { map } = gameState;
    const onVeinNow = map.tiles[unit.y * map.width + unit.x]?.resource === "gold";
    const alreadyClaiming = onVeinNow && (unit._ritualTurns || 0) >= 1;

    if (alreadyClaiming) {
      const { civs } = gameState;
      const visible = gameState.visibility[civ.id] || new Set();
      let nearestEnemyDist = Infinity;
      for (const oc of Object.values(civs)) {
        if (oc.id === civ.id || oc.eliminated) continue;
        for (const eu of oc.units) {
          if (!visible.has(eu.y * map.width + eu.x) || eu.conditions?.hidden) continue;
          const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y);
          if (d < nearestEnemyDist) nearestEnemyDist = d;
        }
      }
      // An adjacent enemy is a fight, not a wander risk -- let the normal
      // attack dispatch handle it further down the cascade.
      if (nearestEnemyDist <= 1) return false;
      unit.resting = true;
      unit.usedThisTurn = true;
      unit.currentMission = `Working a Gold Vein claim (${unit._ritualTurns} turn${unit._ritualTurns === 1 ? "" : "s"})`;
      return true;
    }

    if (unit.hp < unit.maxHp * 0.7) return false; // heal up before setting out
    const veinSpot = findNearbyUnclaimedGoldVein(civ, unit, gameState, { sameLandmassOnly: true });
    if (veinSpot) {
      if (veinSpot.x === unit.x && veinSpot.y === unit.y) {
        // Already there, just hasn't accrued _ritualTurns yet -- hold position.
        unit.resting = true;
        unit.usedThisTurn = true;
        unit.currentMission = "Settling in to start a Gold Vein claim";
        window.GameEngine.quips.maybeQuip(unit, civ, "prospect", gameState);
        return true;
      }
      moveUnitToward(unit, veinSpot.x, veinSpot.y, map, gameState.civs);
      unit.usedThisTurn = true;
      unit.currentMission = `Marching to a Gold Vein to start a claim at (${veinSpot.x},${veinSpot.y})`;
      log.push(`Prospector's Claim: ${civ.id}'s ${unit.typeId} heading to Gold Vein at (${veinSpot.x},${veinSpot.y})`);
      return true;
    }

    // Nothing reachable by land -- look further afield (any landmass) and
    // try to get there by sea instead of walking, which would just strand
    // the unit at the shore forever. See seekOverseasResource.
    const overseasVein = findNearbyUnclaimedGoldVein(civ, unit, gameState);
    if (overseasVein) return seekOverseasResource(civ, unit, gameState, log, overseasVein, "Gold Vein");
    return false;
  }

  /**
   * Human "Dungeon Delve" pursuit/protection. Two cases:
   *
   *   ALREADY DELVING (standing on a Ruin, _ritualTurns >= 1): protect the
   *   investment -- moving away or dying wipes out everything it's claimed
   *   INSTANTLY (see turns.js), so an idle delving Wizard must never be
   *   allowed to wander off via the generic explore/patrol tail of the
   *   dispatch cascade. An adjacent enemy is left to the normal attack
   *   dispatch instead of intervening here -- attacking doesn't move the
   *   Wizard, so the Delve position is safe either way, win or lose. A
   *   NEARBY (not yet adjacent) threat triggers Invisibility pre-emptively
   *   if available; otherwise it just Rests in place.
   *
   *   NOT YET DELVING: curiosity-weighted pursuit of the nearest known Ruin
   *   (see findNearbyUnclaimedRuin), gated on being reasonably healthy first
   *   -- never send a hurt Wizard off to go sit in the open.
   *
   * Returns true if it consumed the turn.
   */
  function maybeDungeonDelvePlay(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    const onRuinNow = !!map.tiles[unit.y * map.width + unit.x]?.isRuin;
    const alreadyDelving = onRuinNow && (unit._ritualTurns || 0) >= 1;

    if (alreadyDelving) {
      const visible = gameState.visibility[civ.id] || new Set();
      let nearestEnemyDist = Infinity;
      for (const oc of Object.values(civs)) {
        if (oc.id === civ.id || oc.eliminated) continue;
        for (const eu of oc.units) {
          if (!visible.has(eu.y * map.width + eu.x) || eu.conditions?.hidden) continue;
          const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y);
          if (d < nearestEnemyDist) nearestEnemyDist = d;
        }
      }
      // An adjacent enemy is a fight, not a wander risk -- let the normal
      // attack dispatch handle it further down the cascade.
      if (nearestEnemyDist <= 1) return false;

      if (nearestEnemyDist <= 3 && civ.unlockedMechanics.has("invisibility")
          && window.GameEngine.combat.canGoHidden(unit, civ, civs)) {
        window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
        unit.usedThisTurn = true;
        unit.currentMission = "Vanishing to protect an active Dungeon Delve";
        log.push(`Dungeon Delve: ${civ.id}'s Wizard goes hidden to protect its claim at (${unit.x},${unit.y})`);
        return true;
      }
      unit.resting = true;
      unit.usedThisTurn = true;
      unit.currentMission = `Delving a Ruin (${unit._ritualTurns} turn${unit._ritualTurns === 1 ? "" : "s"})`;
      return true;
    }

    if (unit.hp < unit.maxHp * 0.7) return false; // heal up before setting out
    const race = window.GameData.getRace(civ.raceId);
    const curiosity = race.curiosity ?? 0.5;
    if (Math.random() >= curiosity) return false;

    const ruinSpot = findNearbyUnclaimedRuin(civ, unit, gameState, { sameLandmassOnly: true });
    if (ruinSpot) {
      if (ruinSpot.x === unit.x && ruinSpot.y === unit.y) {
        // Already there, just hasn't accrued _ritualTurns yet -- hold position
        // so generic idle/explore logic doesn't carry it off first.
        unit.resting = true;
        unit.usedThisTurn = true;
        unit.currentMission = "Settling in to start a Dungeon Delve";
        return true;
      }
      moveUnitToward(unit, ruinSpot.x, ruinSpot.y, map, civs);
      unit.usedThisTurn = true;
      unit.currentMission = `Marching to a Ruin to start a Dungeon Delve at (${ruinSpot.x},${ruinSpot.y})`;
      log.push(`Dungeon Delve: ${civ.id}'s Wizard heading to Ruin at (${ruinSpot.x},${ruinSpot.y})`);
      return true;
    }

    // Nothing reachable by land -- look further afield (any landmass) and
    // try to get there by sea instead of walking, which would just strand
    // the Wizard at the shore forever. See seekOverseasResource.
    const overseasRuin = findNearbyUnclaimedRuin(civ, unit, gameState);
    if (overseasRuin) return seekOverseasResource(civ, unit, gameState, log, overseasRuin, "Ruin");
    return false;
  }

  /**
   * Human Wizard AI: proactively considers its full kit (Freezing Touch,
   * Flight, Dungeon Delve, Teleportation) as OFFENSIVE/UTILITY plays, on top
   * of the purely defensive flee triggers above (attemptWizardTeleport/
   * attemptWizardInvisibility). Priority order:
   *   1. Freezing Touch, flee-or-support -- see maybeFreezingTouch. Checked
   *      first: it's the cheapest, most frequently-usable response to an
   *      immediate threat, and doesn't cost anything the later branches need.
   *   2. Flight, an opportunistic support cast -- see maybeGrantFlight.
   *      Checked next since it's also a same-turn, adjacent-range support
   *      play, just proactive rather than reactive.
   *   3. Protect an already-active Dungeon Delve, or pursue a new one --
   *      see maybeDungeonDelvePlay (handles both sub-cases, and always wins
   *      when actively delving so the investment is never abandoned).
   *   4. Offensive Teleport strike against a confirmed-undefended target --
   *      see maybeTeleportStrike.
   * All four are gated on the relevant tech actually being researched.
   * Returns true if it consumed the Wizard's turn.
   */
  function maybeHumanWizardPlay(civ, unit, gameState, weights, difficulty, log) {
    if (unit.typeId !== "wizard" || !civ.unlockedMechanics) return false;

    if (civ.unlockedMechanics.has("freezing_touch")
        && maybeFreezingTouch(civ, unit, gameState, log)) return true;

    if (civ.unlockedMechanics.has("flight_grant")
        && maybeGrantFlight(civ, unit, gameState, log)) return true;

    if (civ.unlockedMechanics.has("dungeon_delve")
        && maybeDungeonDelvePlay(civ, unit, gameState, log)) return true;

    if (civ.unlockedMechanics.has("teleportation") && !unit.conditions?.exhausted
        && maybeTeleportStrike(civ, unit, gameState, log)) return true;

    return false;
  }

  // Max distance to an enemy worth reasoning about Hidden over -- same
  // order of magnitude as Halfellow's HALFELLOW_STEALTH_RANGE.
  const ELF_STEALTH_RANGE = 2;

  /**
   * Elf "fight smarter, not harder" -- structurally the same shape as
   * maybeHalfellowStealthPlay (defensive vanish when outmatched; offensive
   * ambush once the attack-bonus tech is known), but the offensive branch
   * forks on whether the unit is Ranged: the Ranger (Ranged 2) never draws a
   * counter at range, so it can repeatedly hide-shoot-hide against a wider
   * range of matchups without needing an ally to bait with (see
   * elf_strike_from_the_shadows's own description). A melee unit (the Blade
   * Dancer) falls back to the exact bait-and-ambush shape Halfellow uses:
   * the single strongest nearby unit stays visible as bait while weaker
   * companions vanish to spring the trap.
   */
  function maybeElfStealthPlay(civ, unit, gameState, weights, difficulty, log) {
    if (civ.raceId !== "elf") return false;
    // "sneaking_around" is the shared Hidden-capability flag (also used by
    // Halfellow) -- see techs.js's elf_shadowed_hush_unseen.
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("sneaking_around")) return false;
    if (!window.GameEngine.combat.canGoHidden(unit, civ, gameState.civs)) return false;

    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const militarism = effectiveMilitarism(civ);
    const isRanged = window.GameEngine.combat.effectiveRange(unit, civ) >= 2;

    let nearest = null, nearestDist = Infinity;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.conditions?.hidden) continue;
        const idx = eu.y * map.width + eu.x;
        if (!visible.has(idx)) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y);
        if (dist > ELF_STEALTH_RANGE) continue;
        if (dist < nearestDist) { nearestDist = dist; nearest = eu; }
      }
    }
    if (!nearest) return false;
    const enemyCiv = civs[nearest.civId];

    const winProb = estimateWinProbability(unit, nearest, civs, {}, 20);
    const threshold = minAcceptableWinProbability(civ);

    if (nearestDist === 2 && winProb < threshold * (1 - militarism * 0.5)) {
      window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
      unit.usedThisTurn = true;
      unit.currentMission = `Going hidden — outmatched by ${enemyCiv.id}'s ${nearest.typeId} nearby`;
      log.push(`Stealth: ${civ.id}'s ${unit.typeId} goes hidden defensively at (${unit.x},${unit.y})`);
      return true;
    }

    if (!civ.unlockedMechanics.has("strike_from_the_shadows")) return false;

    if (isRanged) {
      // No ally-bait needed -- a wider tolerance than the melee branch below,
      // since a hidden ranged attack never risks a counter.
      if (winProb < threshold * 1.5) {
        window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
        unit.usedThisTurn = true;
        unit.currentMission = `Going hidden — lining up a shot on ${enemyCiv.id}'s ${nearest.typeId}`;
        log.push(`Stealth: ${civ.id}'s ${unit.typeId} goes hidden to snipe ${enemyCiv.id}'s ${nearest.typeId} near (${unit.x},${unit.y})`);
        return true;
      }
      return false;
    }

    if (winProb < threshold) {
      const alliesNearby = civ.units.filter((u) =>
        u !== unit && !u.carriedBy && window.GameData.getUnit(u.typeId).category === "military"
        && window.GameEngine.influence.chebyshev(u.x, u.y, nearest.x, nearest.y) <= ELF_STEALTH_RANGE);
      const myPower = unitCombatPower(unit, civ);
      const isStrongestNearby = alliesNearby.every((u) => unitCombatPower(u, civ) <= myPower);
      if (alliesNearby.length > 0 && isStrongestNearby) {
        unit.currentMission = `Holding as bait near ${enemyCiv.id}'s ${nearest.typeId} at (${nearest.x},${nearest.y})`;
        return false;
      }
      window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
      unit.usedThisTurn = true;
      unit.currentMission = `Going hidden — setting up an ambush on ${enemyCiv.id}'s ${nearest.typeId}`;
      log.push(`Stealth: ${civ.id}'s ${unit.typeId} goes hidden to ambush ${enemyCiv.id}'s ${nearest.typeId} near (${unit.x},${unit.y})`);
      return true;
    }

    return false;
  }

  const NATURES_GRACE_RANGE = 1; // adjacent only, per the tech's own wording

  /** Elf "Nature's Grace": restores 10%-30% (random) of `target`'s max HP.
   *  Costs the Druid's whole turn, no exhaustion afterward (unlike Roots of
   *  the World). */
  function performNaturesGrace(civ, caster, target, log) {
    const healPct = 0.10 + Math.random() * 0.20;
    const healAmount = Math.round(target.maxHp * healPct);
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + healAmount);
    window.GameEngine.floatingText.spawnHealGain(target, target.hp - before);
    caster.usedThisTurn = true;
    caster.currentMission = `Restored health to ${target.typeId} at (${target.x},${target.y})`;
    log.push(`Nature's Grace: ${civ.id}'s Druid heals ${target.typeId} at (${target.x},${target.y}) for ${healAmount} HP`);
  }

  /** Elf "Nature's Grace" AI: heals the most-injured adjacent ally, if any
   *  is actually missing HP -- purely opportunistic support, no threshold
   *  math (unlike Freezing Touch, there's no "should I," just "is there
   *  someone worth healing right next to me"). Returns true if it consumed
   *  the Druid's turn. */
  function maybeNaturesGrace(civ, unit, gameState, log) {
    let best = null, bestMissing = 0;
    for (const ally of civ.units) {
      if (ally === unit || ally.carriedBy) continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > NATURES_GRACE_RANGE) continue;
      const missing = ally.maxHp - ally.hp;
      if (missing > bestMissing) { bestMissing = missing; best = ally; }
    }
    if (!best) return false;
    performNaturesGrace(civ, unit, best, log);
    return true;
  }

  /** Elf "Roots of the World": self-only teleport (unlike Human's
   *  Teleportation, this can never relocate an ally) -- instantly moves the
   *  Druid to any unoccupied, ever-explored tile and leaves it exhausted
   *  (forced Rest until healed to 100%). Reuses the same
   *  isValidTeleportTile/resolveTeleportLanding helpers Human's Teleportation
   *  uses -- those are already fully generic, not Wizard-specific. */
  function performDruidTeleport(civ, druid, destX, destY, gameState, log) {
    const landing = resolveTeleportLanding(gameState, destX, destY, druid);
    if (!landing) return false;
    druid.x = landing.x;
    druid.y = landing.y;
    // Suppress the move-glide animation for this jump -- see performWizardTeleport.
    druid._lastLogicalX = landing.x;
    druid._lastLogicalY = landing.y;
    druid._renderX = landing.x;
    druid._renderY = landing.y;
    druid._animStart = 0;
    window.GameEngine.combat.setCondition(druid, "exhausted", {});
    druid.usedThisTurn = true;
    druid.currentMission = "Blinked into the roots of the world (exhausted, must rest)";
    log.push(`Roots of the World: ${civ.id}'s Druid blinked to (${landing.x},${landing.y}), exhausted until fully healed`);
    return true;
  }

  /** Defensive trigger: a badly hurt Druid blinks to the safest remembered
   *  tile, mirrors attemptWizardTeleport exactly. */
  function attemptDruidTeleport(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    const explored = gameState.explored[civ.id] || new Set();
    const enemyPositions = [];
    for (const other of Object.values(civs)) {
      if (other.id === civ.id || other.eliminated) continue;
      for (const eu of other.units) if (!eu.conditions?.hidden) enemyPositions.push(eu);
    }
    let best = null, bestDist = -1;
    for (const idx of explored) {
      const x = idx % map.width, y = Math.floor(idx / map.width);
      if (!isValidTeleportTile(gameState, x, y, unit)) continue;
      const nearestEnemyDist = enemyPositions.reduce((min, eu) =>
        Math.min(min, window.GameEngine.influence.chebyshev(x, y, eu.x, eu.y)), Infinity);
      if (nearestEnemyDist > bestDist) { bestDist = nearestEnemyDist; best = { x, y }; }
    }
    if (!best) return false;
    return performDruidTeleport(civ, unit, best.x, best.y, gameState, log);
  }

  // How far (in explored tiles, not a search radius -- see maybeRootsExpansion)
  // a candidate Forest settle site must sit from the Druid before teleporting
  // there is worth it over just walking a Pioneer -- close-by sites are the
  // normal pioneer pipeline's job.
  const ROOTS_EXPANSION_MIN_DIST = 6;

  /** Elf "Roots of the World" expansion play: an idle Druid with a known,
   *  legal, far-off Forest tile blinks straight there and founds a new city
   *  on arrival (in addition to the normal Pioneer -- see elf_druidism's
   *  canFoundCity) -- the tech's own AI note: "a druid civ looking for a
   *  place to build a city may consider far-off forest tiles, teleport the
   *  druid there, then found a new city." Deliberately simple (no
   *  militarism/expansionism weighting beyond a hard city-count cap) since
   *  this is a bonus expansion path on top of the normal Pioneer pipeline,
   *  not the primary one. Returns true if it consumed the Druid's turn. */
  function maybeRootsExpansion(civ, unit, gameState, log) {
    if (civ.cities.length >= 6) return false;
    const { map, civs } = gameState;
    const explored = gameState.explored[civ.id] || new Set();
    let best = null, bestScore = -Infinity;
    for (const idx of explored) {
      const x = idx % map.width, y = Math.floor(idx / map.width);
      if (map.tiles[idx].terrain !== "forest") continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, x, y) < ROOTS_EXPANSION_MIN_DIST) continue;
      const check = window.GameEngine.cities.canFoundCityAt(map, civs, x, y, civ.raceId, { skipRoadCheck: true });
      if (!check.ok) continue;
      const score = computeTileCityScore(civ, gameState, x, y);
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    if (!best || bestScore < 5) return false;
    if (!performDruidTeleport(civ, unit, best.x, best.y, gameState, log)) return false;
    const city = window.GameEngine.cities.foundCity(civ, map, best.x, best.y);
    if (city) {
      civ.hasFoundedCity = true;
      log.push(`Roots of the World: ${civ.id}'s Druid teleported to (${best.x},${best.y}) and founded ${city.name}`);
    }
    return true;
  }

  /** Non-city equivalent of spawnUnitInCity -- spawns `unitId` on an open
   *  tile adjacent to `casterUnit` (the Druid). Used by Elf's Raptor/
   *  Shadowsteed summon (see progressDruidSummon). Tries the 8 neighbors in
   *  random order; returns null (nothing spawned, resources already spent by
   *  the caller) if every one is blocked or impassable. Tags the new unit
   *  with `_summonedByDruid` (a direct object reference to its caster,
   *  same convention as `carriedBy`/`carries`) -- see druidHasLiveSummon,
   *  which reads this to enforce Elf's 1-Raptor/1-Shadowsteed-per-Druid cap. */
  function spawnUnitAdjacentToUnit(civ, casterUnit, unitId, gameState) {
    const { map, civs } = gameState;
    const occupied = buildOccupancySet(civs, null);
    const dirs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = casterUnit.x + dx, ny = casterUnit.y + dy;
      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
      if (occupied.has(`${nx},${ny}`)) continue;
      const terrain = window.GameData.TERRAIN[map.tiles[ny * map.width + nx].terrain];
      if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) continue;
      const newUnit = { typeId: unitId, civId: civ.id, x: nx, y: ny, _summonedByDruid: casterUnit };
      window.GameEngine.combat.initUnitHP(newUnit, civ);
      civ.units.push(newUnit);
      return newUnit;
    }
    return null;
  }

  /** Elf "one Raptor, one Shadowsteed per Druid" (2026-07-18, user-directed):
   *  true if `druid` already has a LIVE `unitId` it summoned (tagged via
   *  `_summonedByDruid`, see spawnUnitAdjacentToUnit) OR is currently mid-
   *  summon of one. Self-cleaning -- if a previously-summoned unit died, it's
   *  no longer in civ.units, so this naturally returns false again and the
   *  Druid is free to summon a replacement. This is a per-Druid cap, not a
   *  civ-wide one: an Elf civ wanting more Shadowsteeds (its top combat
   *  unit) needs to field more Druids, not just re-summon from the same one. */
  function druidHasLiveSummon(civ, druid, unitId) {
    if (druid.summonBuild && druid.summonBuild.id === unitId) return true;
    return civ.units.some((u) => u.typeId === unitId && u._summonedByDruid === druid);
  }

  /** Starts the Druid "building" `unitId` -- pays the same power-based cost
   *  a city would (GameData.unitBuildCost/unitPower, via the unlocking
   *  tech's own costBreakdown) from the civ's stockpile, then counts down
   *  unitBuildTurns exactly like a city's build queue does (see
   *  progressDruidSummon). Returns true if it started (consumes the Druid's
   *  turn); false if unaffordable. */
  function startDruidSummon(civ, druid, unitId, gameState, log) {
    const race = window.GameData.getRace(civ.raceId);
    if (!canAffordUnitUpkeep(civ, unitId, race)) return false;
    const cost = window.GameData.unitBuildCost(unitId);
    if (!cost || !canAffordBuildCost(civ, cost)) return false;
    civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    for (const [k, v] of Object.entries(cost)) civ.stockpile[k] = Math.max(0, (civ.stockpile[k] || 0) - v);
    const turns = unitBuildTurns(civ, unitId);
    druid.summonBuild = { id: unitId, turnsRemaining: turns };
    druid.usedThisTurn = true;
    druid.currentMission = `Summoning a ${unitId} (${turns} turns remaining)`;
    log.push(`Summon: ${civ.id}'s Druid begins summoning a ${unitId} at (${druid.x},${druid.y})`);
    window.GameEngine.quips.maybeQuip(druid, civ, unitId === "raptor" ? "summon_raptor" : "summon_shadowsteed", gameState);
    return true;
  }

  /** Ticks an in-progress Druid summon (see startDruidSummon) -- the Druid
   *  cannot move or act while summoning (mirrors a city's build queue,
   *  "like a city, the druid builds the unit"), though it may do so while
   *  already Hidden beforehand (nothing here touches an existing Hidden
   *  condition). On completion, spawns the new unit on an open adjacent
   *  tile -- if none is open, keeps retrying next turn (same convention as
   *  spawnUnitInCity's naval-landing-spot fallback). */
  function progressDruidSummon(civ, druid, gameState, log) {
    const build = druid.summonBuild;
    if (build.turnsRemaining > 0) build.turnsRemaining--;
    druid.usedThisTurn = true;
    if (build.turnsRemaining > 0) {
      druid.currentMission = `Summoning a ${build.id} (${build.turnsRemaining} turns remaining)`;
      return;
    }
    const spawned = spawnUnitAdjacentToUnit(civ, druid, build.id, gameState);
    if (!spawned) {
      druid.currentMission = `Summoning a ${build.id} (waiting for room to appear)`;
      return;
    }
    druid.summonBuild = null;
    druid.currentMission = `Summoned a ${build.id} at (${spawned.x},${spawned.y})`;
    log.push(`Summon: ${civ.id}'s Druid completes a ${build.id} at (${spawned.x},${spawned.y})`);
  }

  /**
   * Elf Druid AI: proactively considers its full kit on top of the purely
   * defensive flee trigger (attemptDruidTeleport, checked earlier in
   * maybeMoveUnits, same placement as Human's Wizard). Priority order:
   *   1. Nature's Grace -- opportunistic heal, cheapest and most frequently
   *      usable. See maybeNaturesGrace.
   *   2. Start a Raptor summon, if THIS Druid doesn't already have a live
   *      one (or one mid-summon) -- see druidHasLiveSummon/startDruidSummon.
   *      One per Druid, not a civ-wide cap (2026-07-18, user-directed).
   *   3. Start a Shadowsteed summon, same one-per-Druid shape.
   *   4. Roots of the World expansion play -- see maybeRootsExpansion.
   * All four are gated on the relevant tech actually being researched.
   * Returns true if it consumed the Druid's turn.
   */
  function maybeElfDruidPlay(civ, unit, gameState, weights, difficulty, log) {
    if (unit.typeId !== "druid" || !civ.unlockedMechanics) return false;

    if (civ.unlockedMechanics.has("natures_grace")
        && maybeNaturesGrace(civ, unit, gameState, log)) return true;

    if (civ.unlockedMechanics.has("raptor_summon")
        && !druidHasLiveSummon(civ, unit, "raptor")
        && startDruidSummon(civ, unit, "raptor", gameState, log)) return true;

    if (civ.unlockedMechanics.has("shadow_steed_summon")
        && !druidHasLiveSummon(civ, unit, "shadowsteed")
        && startDruidSummon(civ, unit, "shadowsteed", gameState, log)) return true;

    if (civ.unlockedMechanics.has("roots_of_the_world") && !unit.conditions?.exhausted
        && maybeRootsExpansion(civ, unit, gameState, log)) return true;

    return false;
  }

  // Elf "Shadowsteed" mount eligibility (2026-07-18, user-directed): a
  // CLOSED allow-list, not a deny-list -- Ranger, Druid, and Blade Dancer
  // are the ONLY unit types a Shadowsteed will ever carry. Ranger is
  // strongly preferred; Druid/Blade Dancer are only the fallback when no
  // Ranger is "quickly available" (see operateShadowsteedCarry/
  // maybeSeekShadowsteedRider below for what that means in each context).
  // Everything else -- Galley, Raptor, Awakened Oak, another Shadowsteed,
  // and even Elf's own Pioneer/Scout -- is never a valid rider, full stop.
  const SHADOWSTEED_PREFERRED_RIDER = "ranger";
  const SHADOWSTEED_FALLBACK_RIDERS = new Set(["druid", "blade_dancer"]);

  /** Elf "Shadowsteed": picks up an adjacent, uncarried, eligible ally as a
   *  rider (see SHADOWSTEED_PREFERRED_RIDER/SHADOWSTEED_FALLBACK_RIDERS) --
   *  unconditional otherwise (unlike Devoted Companions' injury threshold),
   *  since a riderless Shadowsteed is nearly worthless in combat (Atk1/Def1)
   *  while a mounted one fights with its rider's full kit (see combat.js's
   *  shadowsteedMount). An adjacent Ranger is always taken over an adjacent
   *  Druid/Blade Dancer -- "quickly available" here just means "already
   *  standing right next to me this turn." Mirrors operateDragonCarry's
   *  shape/return convention. */
  function operateShadowsteedCarry(civ, unit, gameState, log) {
    if (unit.carries) return false; // already mounted -- nothing to decide here
    const canMount = (u) =>
      u !== unit && !u.carriedBy && !u.carries && !u.usedThisTurn
      && window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y) <= 1
      && (u.typeId === SHADOWSTEED_PREFERRED_RIDER || SHADOWSTEED_FALLBACK_RIDERS.has(u.typeId));
    const passenger = civ.units.find((u) => canMount(u) && u.typeId === SHADOWSTEED_PREFERRED_RIDER)
      || civ.units.find((u) => canMount(u));
    if (!passenger) return false;
    unit.carries = passenger;
    passenger.carriedBy = unit;
    passenger.usedThisTurn = true;
    unit.usedThisTurn = true;
    unit.currentMission = `Carrying a ${passenger.typeId} as a rider`;
    log.push(`Shadowsteed: ${civ.id}'s Shadowsteed picked up ${passenger.typeId} as a rider`);
    return true;
  }

  // How far a riderless Shadowsteed will proactively travel to reach a
  // mountable ally -- same order of magnitude as Halfellow's
  // COMPANION_SEEK_RADIUS, a bit further since a Shadowsteed is flying
  // (Mov 5) and getting mounted matters more to it than almost anything
  // else it could spend an idle turn on.
  const SHADOWSTEED_SEEK_RADIUS = 8;

  /** Elf "Shadowsteed", proactive half of operateShadowsteedCarry (2026-07-18,
   *  user-directed: mounting should happen frequently, not just when an ally
   *  happens to wander adjacent) -- mirrors Halfellow's
   *  maybeSeekInjuredCompanion. A riderless Shadowsteed is nearly worthless
   *  in combat (Atk1/Def1, see combat.js's shadowsteedMount), so finding a
   *  rider outranks almost every other idle-turn option. Prefers a Ranger:
   *  scans the WHOLE seek radius for the nearest Ranger first, and only
   *  settles for the nearest Druid/Blade Dancer instead if no Ranger is
   *  within range at all ("not quickly available") -- a closer Druid never
   *  wins over a farther-but-still-in-range Ranger. Doesn't pick anyone up
   *  itself (that still requires adjacency, handled next turn by
   *  operateShadowsteedCarry once it arrives) -- purely closes the distance.
   *  Returns true if it moved (consuming the turn). */
  function maybeSeekShadowsteedRider(civ, unit, gameState, log) {
    if (unit.carries || unit.carriedBy) return false;
    const { map, civs } = gameState;
    const canSeek = (u) =>
      u !== unit && !u.carriedBy && !u.carries && !u.usedThisTurn
      && (u.typeId === SHADOWSTEED_PREFERRED_RIDER || SHADOWSTEED_FALLBACK_RIDERS.has(u.typeId));
    let nearestRanger = null, nearestRangerDist = Infinity;
    let nearestFallback = null, nearestFallbackDist = Infinity;
    for (const u of civ.units) {
      if (!canSeek(u)) continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d > SHADOWSTEED_SEEK_RADIUS) continue;
      if (u.typeId === SHADOWSTEED_PREFERRED_RIDER) {
        if (d < nearestRangerDist) { nearestRangerDist = d; nearestRanger = u; }
      } else if (d < nearestFallbackDist) { nearestFallbackDist = d; nearestFallback = u; }
    }
    const target = nearestRanger || nearestFallback;
    const dist = nearestRanger ? nearestRangerDist : nearestFallbackDist;
    if (!target || dist <= 1) return false;
    moveUnitToward(unit, target.x, target.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Seeking a rider -- heading for ${target.typeId} at (${target.x},${target.y})`;
    log.push(`Shadowsteed: ${civ.id}'s Shadowsteed moves to find a rider near (${target.x},${target.y})`);
    return true;
  }

  /**
   * Human "Crusade": an otherwise-idle Paladin (no attack available this
   * turn) heads for its nearest ally instead of falling through to the
   * generic solo garrison/hunt/explore cascade. The aura (see turns.js's
   * per-turn Crusade application) only reaches allies within 1 tile, so a
   * Paladin that wanders off alone -- which is exactly what happens to
   * every other unit type in the idle cascade -- wastes the entire point
   * of researching the tech. Only fires when there IS a nearby ally worth
   * closing on (within CRUSADE_SEARCH_RADIUS) and this Paladin isn't
   * already close to it.
   *
   * Deliberately chases the single NEAREST ally, not the centroid of every
   * ally within radius -- a first version aimed at the averaged centroid of
   * the whole nearby group and required being close to a MAJORITY of it
   * before stopping, which turned out to almost never converge in
   * practice: measured directly via a headless batch, it fired on nearly
   * every single turn a Paladin existed (~900-2200 times per game). Allies
   * scattered across the search radius (each moving independently on its
   * own unrelated decision every turn, with no clustering behavior of
   * their own) average out to a centroid that can land in empty space no
   * one is actually near, so "get within range of most of them" was often
   * unreachable -- the Paladin spent every turn marching toward a point
   * that kept sliding away, never got to Rest (heal) or garrison (defense
   * bonus). Chasing one concrete unit instead always has a real point to
   * converge on. Returns true if it moved the Paladin (consuming its turn).
   */
  const CRUSADE_SEARCH_RADIUS = 8;
  const CRUSADE_EMBEDDED_RADIUS = 2;
  function maybeCrusadeVanguard(civ, unit, gameState, log) {
    if (unit.typeId !== "paladin" || !civ.unlockedMechanics || !civ.unlockedMechanics.has("crusade")) return false;
    const { map, civs } = gameState;
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (u === unit || u.carriedBy) continue;
      if (window.GameData.getUnit(u.typeId).category !== "military") continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    if (!nearest || nearestDist > CRUSADE_SEARCH_RADIUS || nearestDist <= CRUSADE_EMBEDDED_RADIUS) return false;
    moveUnitToward(unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Rallying with the army near (${nearest.x},${nearest.y})`;
    log.push(`Crusade: ${civ.id}'s Paladin marches to rejoin its nearest ally`);
    return true;
  }

  /**
   * Dwarf "Heavy Metal"/"Power Metal" (and their shared "Epic Metal"
   * radius upgrade): exact copy of maybeCrusadeVanguard's fix, applied to
   * the Troubadour instead of the Paladin -- whichever aura is currently
   * active (heal+defense+siege, or attack+first strike -- see turns.js
   * beginCivTurn) only reaches allies within its radius (1 tile, or 2 with
   * Epic Metal), so a Troubadour that wanders off alone in the generic idle
   * cascade wastes the entire point of researching either tech. Gated on
   * having EITHER aura tech, not specifically Heavy Metal -- a Troubadour
   * with only Power Metal researched needs to rejoin the army just as much.
   */
  const HEAVY_METAL_SEARCH_RADIUS = 8;
  const HEAVY_METAL_EMBEDDED_RADIUS = 2;
  function maybeHeavyMetalVanguard(civ, unit, gameState, log) {
    const hasEitherAura = civ.unlockedMechanics
      && (civ.unlockedMechanics.has("heavy_metal") || civ.unlockedMechanics.has("power_metal"));
    if (unit.typeId !== "troubadour" || !hasEitherAura) return false;
    const { map, civs } = gameState;
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (u === unit || u.carriedBy) continue;
      if (window.GameData.getUnit(u.typeId).category !== "military") continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    if (!nearest || nearestDist > HEAVY_METAL_SEARCH_RADIUS || nearestDist <= HEAVY_METAL_EMBEDDED_RADIUS) return false;
    moveUnitToward(unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Rallying with the army near (${nearest.x},${nearest.y})`;
    log.push(`Heavy Metal: ${civ.id}'s Troubadour marches to rejoin its nearest ally`);
    return true;
  }

  // "Badly hurt" for the injury-priority check below, 50% of max HP --
  // deliberately generous (checked out to SUPPORT_RADIUS, not just the
  // aura's own 1/2-tile radius) since the Troubadour may still need to
  // reposition toward the wounded ally, and its aura should already be set
  // to heal by the time it arrives.
  const TROUBADOUR_INJURED_HP_THRESHOLD = 0.5;

  /** Is any ally within the Troubadour's support radius (including the
   *  Troubadour itself) hurt badly enough that Heavy Metal's heal should
   *  take priority over everything else? */
  function hasBadlyInjuredNearbyAlly(civ, unit) {
    for (const ally of civ.units) {
      if (ally.carriedBy || !ally.maxHp) continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > SUPPORT_RADIUS) continue;
      if (ally.hp / ally.maxHp < TROUBADOUR_INJURED_HP_THRESHOLD) return true;
    }
    return false;
  }

  /** Is (x,y) adjacent to (Chebyshev 1) an enemy city or structure --
   *  i.e. something actually within siege range? Scans the full 3x3
   *  neighborhood rather than a specific target since this is asking "is
   *  ANYTHING siegeable right here," not tracking one particular target. */
  function hasAdjacentSiegeTarget(gameState, civ, x, y) {
    const { civs, map } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = x + dx, ty = y + dy;
        if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
        if (!visible.has(ty * map.width + tx)) continue;
        for (const otherCiv of Object.values(civs)) {
          if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
          if (otherCiv.cities.some((c) => c.x === tx && c.y === ty)) return true;
        }
        const s = window.GameEngine.cities.findStructureAt(gameState, tx, ty);
        if (s && s.civ.id !== civ.id) return true;
      }
    }
    return false;
  }

  /** Is a nearby ally (within support radius, or this Troubadour itself)
   *  actively sieging an enemy city/structure? Checked separately from
   *  isNearActiveCombat (which only ever looks for enemy UNITS) since
   *  Heavy Metal's siege bonus is what actually matters here -- Power
   *  Metal's attack/first strike don't help against a structure the same
   *  way (see combat.js's effectiveSiegePct/effectiveAttack isSiege gate). */
  function isNearCitySiege(civ, unit, gameState) {
    if (hasAdjacentSiegeTarget(gameState, civ, unit.x, unit.y)) return true;
    for (const ally of civ.units) {
      if (ally === unit || ally.carriedBy) continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > SUPPORT_RADIUS) continue;
      if (hasAdjacentSiegeTarget(gameState, civ, ally.x, ally.y)) return true;
    }
    return false;
  }

  /**
   * Which aura the Troubadour should be running RIGHT NOW, in priority
   * order (each check outranks everything below it):
   *   1. A nearby ally badly hurt -> Heavy Metal. Healing is the most
   *      urgent need there is -- outranks any offense consideration.
   *   2. A nearby ally sieging an enemy city/structure -> Heavy Metal. The
   *      +25% siege bonus is what actually speeds a siege up; Power
   *      Metal's attack/first strike barely help against a structure.
   *   3. A nearby ally in a straight unit-vs-unit fight (nearActiveCombat,
   *      computed once per unit turn by the caller -- see
   *      isNearActiveCombat) -> Power Metal. The attack/first strike boost
   *      wins an actual fight faster.
   *   4. Otherwise (idle/marching, nothing going on) -> Heavy Metal, same
   *      sustain-by-default reasoning as the original single-check version.
   */
  function chooseTroubadourAura(civ, unit, gameState, nearActiveCombat) {
    if (hasBadlyInjuredNearbyAlly(civ, unit)) return "heavy_metal";
    if (isNearCitySiege(civ, unit, gameState)) return "heavy_metal";
    if (nearActiveCombat) return "power_metal";
    return "heavy_metal";
  }

  /**
   * Dwarf "Power Metal": a Troubadour that knows BOTH aura techs can swap
   * which one is active as a full-turn action (see techs.js's doc comments
   * on dwarf_heavy_metal/dwarf_power_metal -- the two are mutually
   * exclusive, never both active on the same Troubadour at once; a
   * Troubadour with only one tech always runs that one, no choice
   * involved). See chooseTroubadourAura for the actual situational
   * strategy. Only actually spends the action when the desired aura
   * differs from the current one, so a Troubadour sitting in a settled
   * state doesn't thrash back and forth every turn.
   */
  function maybeSwitchTroubadourAura(civ, unit, gameState, nearActiveCombat, log) {
    if (unit.typeId !== "troubadour") return false;
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("heavy_metal") || !civ.unlockedMechanics.has("power_metal")) return false;
    const desired = chooseTroubadourAura(civ, unit, gameState, nearActiveCombat);
    const current = unit.activeAura || "heavy_metal";
    if (current === desired) return false;
    unit.activeAura = desired;
    unit.usedThisTurn = true;
    const label = desired === "power_metal" ? "Power Metal" : "Heavy Metal";
    unit.currentMission = `Switched aura to ${label}`;
    log.push(`${civ.id}'s Troubadour switches its aura to ${label}`);
    // Same floating-text feedback as XP/level-up/resource gains (see
    // floatingtext.js) -- announces which aura just became active.
    window.GameEngine.floatingText.spawnFloatingText(unit, label, "aura");
    return true;
  }

  /**
   * Dwarf "Shield Wall": when a fight is imminent (isNearActiveCombat) and
   * this unit isn't already touching another Dwarf military unit, close
   * ranks with the nearest one instead of dueling alone -- the tech only
   * grants +defense per ADJACENT ally (see combat.js
   * countAdjacentMilitaryAllies/effectiveDefense), so a unit that never
   * actually stands next to one gets nothing from having researched it.
   * Same single-nearest-ally chase shape as maybeCrusadeVanguard.
   * Deliberately excludes the Titan -- it doesn't need the help, and its
   * one job is marching, not wall-forming (see maybeTitanMarch).
   */
  const SHIELDWALL_SEARCH_RADIUS = 6;
  function maybeShieldWallPosition(civ, unit, gameState, nearActiveCombat, log) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("shieldwall")) return false;
    if (unit.typeId === "runeforged_titan") return false;
    if (window.GameData.getUnit(unit.typeId).category !== "military") return false;
    if (!nearActiveCombat) return false;
    let adjacentAllies = 0;
    let nearest = null, nearestDist = Infinity;
    for (const ally of civ.units) {
      if (ally === unit || ally.carriedBy) continue;
      if (window.GameData.getUnit(ally.typeId).category !== "military") continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y);
      if (d <= 1) adjacentAllies++;
      if (d < nearestDist) { nearestDist = d; nearest = ally; }
    }
    if (adjacentAllies > 0) return false; // already shoulder-to-shoulder -- the bonus is already active
    if (!nearest || nearestDist > SHIELDWALL_SEARCH_RADIUS) return false;
    moveUnitToward(unit, nearest.x, nearest.y, gameState.map, gameState.civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Forming a shield wall near (${nearest.x},${nearest.y})`;
    log.push(`Shield Wall: ${civ.id}'s ${unit.typeId} closes ranks with an ally`);
    return true;
  }

  /**
   * Dwarf "Runeforged Titan": this unit has exactly one job -- plod toward
   * an enemy city and tear it down, pausing only to smash whatever attacks
   * it along the way (handled by the generic considerAttackOrGarrison pass,
   * which always runs before this in the cascade). Commits to the nearest
   * visible enemy city on its own landmass and keeps marching at it even
   * if it drops out of sight again ("rarely deviates" -- see units.js/
   * techs.js's doc), only re-picking a target once the old one is actually
   * gone (destroyed, or its owner eliminated). Deliberately NOT gated by
   * isNearActiveCombat like everything else in the cascade -- an ordinary
   * unit vetoes wandering off near a fight so it doesn't abandon its post,
   * but the Titan's post IS marching, so nearby combat (an ally's fight,
   * not its own -- its own fights are handled by the attack pass above)
   * never pulls it off course. Returns true whenever it has (or can find)
   * a target; false only when there's genuinely no known enemy city yet,
   * letting it fall through to the ordinary idle cascade in the meantime.
   */
  function titanTargetStillValid(target, gameState) {
    if (!target) return false;
    const targetCiv = gameState.civs[target.civId];
    if (!targetCiv || targetCiv.eliminated) return false;
    return targetCiv.cities.some((c) => c.x === target.x && c.y === target.y);
  }

  function pickTitanTarget(civ, unit, gameState) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    let nearest = null, nearestDist = Infinity, nearestCivId = null;
    for (const other of Object.values(civs)) {
      if (other.id === civ.id || other.eliminated) continue;
      for (const c of other.cities) {
        if (!visible.has(c.y * map.width + c.x)) continue;
        const cTile = map.tiles[c.y * map.width + c.x];
        if (unitLandmassId >= 0 && cTile.landmassId !== unitLandmassId) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, c.x, c.y);
        if (dist < nearestDist) { nearestDist = dist; nearest = c; nearestCivId = other.id; }
      }
    }
    if (!nearest) return null;
    return { civId: nearestCivId, x: nearest.x, y: nearest.y };
  }

  function maybeTitanMarch(civ, unit, gameState, log) {
    if (unit.typeId !== "runeforged_titan") return false;
    if (!titanTargetStillValid(unit._titanTarget, gameState)) {
      unit._titanTarget = pickTitanTarget(civ, unit, gameState);
      if (unit._titanTarget) window.GameEngine.quips.maybeQuip(unit, civ, "seek_target", gameState);
    }
    if (!unit._titanTarget) return false; // no known enemy city to march on yet
    const { x, y, civId } = unit._titanTarget;
    if (unit.x === x && unit.y === y) return false; // standing on the target tile -- nothing left to do here
    const usedGate = moveUnitTowardSmart(civ, unit, x, y, gameState);
    unit.usedThisTurn = true;
    unit.currentMission = usedGate
      ? `Used a Deep Gate, plodding onward to crush ${civId}'s city at (${x},${y})`
      : `Plodding onward to crush ${civId}'s city at (${x},${y})`;
    log.push(`Runeforged Titan: ${civ.id}'s Titan marches on ${civId}'s city at (${x},${y})`);
    return true;
  }

  /**
   * True when this Dwarf civ has at least one living Runeforged Titan that
   * currently has no marching target (see maybeTitanMarch/pickTitanTarget --
   * that only ever picks from currently VISIBLE enemy cities). A stalled
   * Titan has nothing to do until something reveals an enemy city for it,
   * and waiting passively for that to happen via whatever OTHER exploration
   * is already going on can take a very long time. Read by
   * chooseBuildAction (prioritize Scout/Galley production) and
   * operateGalley (prioritize active water exploration over idling near a
   * pioneer) so the civ actively hunts for a target instead.
   */
  function civNeedsTitanScouting(civ) {
    if (civ.raceId !== "dwarf") return false;
    return civ.units.some((u) => u.typeId === "runeforged_titan" && !u._titanTarget);
  }

  /**
   * Dwarf units escort a marching Titan (see maybeTitanMarch) rather than
   * pursuing their own idle routine -- "other dwarven units will walk
   * alongside this unit and escort it to its target city" (techs.js).
   * Chases the nearest ally Titan currently on campaign (has a live
   * _titanTarget) -- same single-nearest-concrete-unit shape as
   * maybeCrusadeVanguard/maybeHalfellowRegroup (there's realistically only
   * ever one Titan at a time, being `rare`, so a multi-Titan centroid isn't
   * a real concern). Only fires while clear of any active fight of its own
   * (see isNearActiveCombat at the call site) so an escort never abandons a
   * fight it's already in just to catch up.
   */
  const TITAN_ESCORT_SEARCH_RADIUS = 20;
  const TITAN_ESCORT_EMBEDDED_RADIUS = 2;
  function maybeEscortTitan(civ, unit, gameState, log) {
    if (window.GameData.getUnit(unit.typeId).category !== "military") return false;
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (u.typeId !== "runeforged_titan" || !u._titanTarget) continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    if (!nearest || nearestDist > TITAN_ESCORT_SEARCH_RADIUS || nearestDist <= TITAN_ESCORT_EMBEDDED_RADIUS) return false;
    const usedGate = moveUnitTowardSmart(civ, unit, nearest.x, nearest.y, gameState);
    unit.usedThisTurn = true;
    unit.currentMission = usedGate
      ? "Used a Deep Gate to catch up with the Runeforged Titan"
      : `Escorting the Runeforged Titan toward (${nearest.x},${nearest.y})`;
    log.push(`Escort: ${civ.id}'s ${unit.typeId} rallies to escort the Runeforged Titan`);
    return true;
  }

  /**
   * Halfellow "teamwork": an otherwise-idle military unit heads for its
   * nearest military ally instead of operating solo -- mirrors
   * maybeCrusadeVanguard's design exactly (chase the single nearest ally,
   * not a centroid -- see that function's comment for why a centroid
   * doesn't converge in practice). Not gated by any tech: this is a racial
   * personality behavior ("tend to move in groups, and team up against
   * opponents"), not a mechanic unlocked partway through the game. Doesn't
   * exclude Hidden allies -- a civ's own units are always fully known to its
   * own AI regardless of fog-of-war, so this doubles as "halfellows keep
   * track of each other while hidden." Returns true if it moved the unit
   * (consuming its turn).
   */
  const HALFELLOW_REGROUP_SEARCH_RADIUS = 8;
  const HALFELLOW_REGROUP_EMBEDDED_RADIUS = 2;
  function maybeHalfellowRegroup(civ, unit, gameState, log) {
    if (window.GameData.getUnit(unit.typeId).category !== "military") return false;
    const { map, civs } = gameState;
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (u === unit || u.carriedBy || u.carries) continue;
      if (window.GameData.getUnit(u.typeId).category !== "military") continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    if (!nearest || nearestDist > HALFELLOW_REGROUP_SEARCH_RADIUS || nearestDist <= HALFELLOW_REGROUP_EMBEDDED_RADIUS) return false;
    moveUnitToward(unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Grouping up with allies near (${nearest.x},${nearest.y})`;
    log.push(`Halfellow teamwork: ${civ.id}'s ${unit.typeId} moves to regroup with an ally`);
    return true;
  }

  /**
   * Elf Ranger "hidden groups" (2026-07-18, user-directed): mirrors
   * maybeHalfellowRegroup exactly, but scoped to OTHER Rangers only (not
   * every military unit) -- Rangers specifically are meant to move as a
   * pack and strike together (see RANGER_VOLLEY_BONUS in
   * considerAttackOrGarrison for the synchronized-attack half), not just
   * generically cluster with any ally the way Halfellow's whole army does.
   * Doesn't exclude Hidden siblings -- a civ always knows where its own
   * units are regardless of fog-of-war, same reasoning as Halfellow's.
   */
  const RANGER_REGROUP_SEARCH_RADIUS = 8;
  const RANGER_REGROUP_EMBEDDED_RADIUS = 2;
  function maybeRangerRegroup(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (u === unit || u.typeId !== "ranger" || u.carriedBy || u.carries) continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    if (!nearest || nearestDist > RANGER_REGROUP_SEARCH_RADIUS || nearestDist <= RANGER_REGROUP_EMBEDDED_RADIUS) return false;
    moveUnitToward(unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Massing with fellow Rangers near (${nearest.x},${nearest.y})`;
    log.push(`Ranger pack: ${civ.id}'s Ranger moves to regroup with another Ranger`);
    return true;
  }

  /**
   * Like moveUnitToward, but for a Ranged unit (effectiveRange > 1: Human's
   * Archer/Longbowman/Wizard/Catapult/Trebuchet, Orc's Bog Witch/Dragon)
   * closing on a specific enemy tile -- stops as soon as the target would be
   * within this unit's own attack range, instead of always walking all the
   * way to melee adjacency the way moveUnitToward's plain pathing would. A
   * Ranged attack never draws a counter (see combat.js's resolveRound/
   * units.js's `range` doc comment), so closing further than necessary only
   * exposes the unit to being hit back on some LATER turn once roles
   * reverse, for zero benefit this turn -- considerAttackOrGarrison already
   * fires from wherever the unit currently stands if a target is in range,
   * so there's never a reason to move any closer than that. Falls back to
   * plain moveUnitToward for melee units (range <= 1), which have no
   * standoff distance to preserve. The stop tile is a straight-line
   * Chebyshev projection (not a real pathfind), same "aim for approximately
   * here" precision the rest of this file's movement targeting already
   * uses -- findPath still routes around actual obstacles to reach it.
   */
  function moveTowardWithStandoff(civ, unit, targetX, targetY, map, civs) {
    const range = window.GameEngine.combat.effectiveRange(unit, civ);
    if (range <= 1) { moveUnitToward(unit, targetX, targetY, map, civs); return; }
    const dx = targetX - unit.x, dy = targetY - unit.y;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    if (dist <= range) return; // already close enough to fire from here -- don't move at all
    const excess = dist - range;
    const stopX = Math.round(unit.x + dx * (excess / dist));
    const stopY = Math.round(unit.y + dy * (excess / dist));
    moveUnitToward(unit, stopX, stopY, map, civs);
  }

  // How far past the contact point an arrived, empty-handed swarm converges
  // before it's willing to call it a dead end -- see maybeOrcSwarm.
  const ORC_SWARM_PUSH_DISTANCE = 3;

  /** Orc "always looking for a fight" (2026-07-19, user-directed): the ONE
   *  shared contact point the whole warband converges on this turn, or null
   *  if nothing's currently visible -- distinct from huntNearestEnemy, which
   *  is each unit independently chasing whatever IT personally judges
   *  nearest. Anchored on the civ's own centroid (average unit position)
   *  rather than any single unit, so the signal reflects where the warband
   *  AS A WHOLE is closest to contact. `pushX/pushY` is a point a bit
   *  further past the contact in the same direction (centroid -> contact),
   *  clamped to the map -- see maybeOrcSwarm's "keep moving past it" half. */
  function computeOrcSwarmSignal(civ, gameState) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    if (civ.units.length === 0) return null;
    let cx = 0, cy = 0;
    for (const u of civ.units) { cx += u.x; cy += u.y; }
    cx /= civ.units.length; cy /= civ.units.length;
    let nearest = null, nearestDist = Infinity;
    for (const other of Object.values(civs)) {
      if (other.id === civ.id || other.eliminated) continue;
      for (const eu of other.units) {
        if (!visible.has(eu.y * map.width + eu.x) || eu.conditions?.hidden) continue;
        const dist = window.GameEngine.influence.chebyshev(cx, cy, eu.x, eu.y);
        if (dist < nearestDist) { nearestDist = dist; nearest = eu; }
      }
    }
    if (!nearest) return null;
    const dx = nearest.x - cx, dy = nearest.y - cy;
    const mag = Math.max(1, Math.hypot(dx, dy));
    const pushX = Math.max(0, Math.min(map.width - 1, Math.round(nearest.x + (dx / mag) * ORC_SWARM_PUSH_DISTANCE)));
    const pushY = Math.max(0, Math.min(map.height - 1, Math.round(nearest.y + (dy / mag) * ORC_SWARM_PUSH_DISTANCE)));
    return { x: nearest.x, y: nearest.y, pushX, pushY };
  }

  /** Orc "always looking for a fight": an otherwise-idle Orc unit converges
   *  on the civ-wide swarm signal (see computeOrcSwarmSignal) instead of
   *  falling back to ordinary patrol/explore. An adjacent enemy is always
   *  handled by considerAttackOrGarrison earlier in the dispatch cascade,
   *  so reaching this function with the signal already "arrived at" (within
   *  1 tile) means whatever triggered it is gone, hidden, or dead -- rather
   *  than idling right where the enemy used to be, the unit keeps pressing
   *  PAST that point (signal.pushX/pushY) a few more tiles, until next
   *  turn's freshly-recomputed signal redirects it toward real contact
   *  again. Returns true if it moved (consuming the turn). */
  function maybeOrcSwarm(civ, unit, gameState, log) {
    if (civ.raceId !== "orc" || !civ._orcSwarmSignal) return false;
    const signal = civ._orcSwarmSignal;
    const { map, civs } = gameState;
    const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, signal.x, signal.y);
    const target = dist > 1 ? signal : { x: signal.pushX, y: signal.pushY };
    if (unit.x === target.x && unit.y === target.y) return false; // nowhere left to push to
    moveUnitToward(unit, target.x, target.y, map, civs);
    unit.usedThisTurn = true;
    if (dist > 1) {
      unit.currentMission = `Swarming toward contact at (${signal.x},${signal.y})`;
      log.push(`Orc swarm: ${civ.id}'s ${unit.typeId} converges on contact at (${signal.x},${signal.y})`);
    } else {
      unit.currentMission = `Pushing past last contact toward (${target.x},${target.y})`;
      log.push(`Orc swarm: ${civ.id}'s ${unit.typeId} pushes past (${signal.x},${signal.y}) hunting for more`);
    }
    return true;
  }

  /**
   * Moves a unit toward the nearest visible enemy unit -- a tactical, in-the-
   * moment opportunity chase. Whether this triggers at all is gated by
   * aggressiveness (see maybeMoveUnits). A Ranged unit stops at standoff
   * distance instead of closing to melee (see moveTowardWithStandoff).
   * Returns true if a target was found and the unit moved toward it.
   *
   * Melee (range <= 1) candidates are filtered to ones actually reachable
   * on foot -- e.g. an enemy that prospected a Mountains tile (impassable to
   * anyone without mountain-tunneling) can never be closed on or attacked by
   * a melee unit, so chasing it forever parks the unit at the mountain's
   * edge doing nothing every turn (see [[project_no_stuck_mountain_chase]]).
   * This mirrors the exact canReachByLand gate considerAttackOrGarrison
   * already applies before actually landing a melee hit -- a target that
   * fails it there could never be fought anyway, so it's not a valid chase
   * target here either. Ranged units are left unfiltered: they don't need
   * footpath reachability to the target tile itself, only standoff range +
   * line of sight, which considerAttackOrGarrison already checks separately.
   */
  function huntNearestEnemy(civ, unit, gameState) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    const range = window.GameEngine.combat.effectiveRange(unit, civ);
    let nearest = null, nearestDist = Infinity;
    for (const other of Object.values(civs)) {
      if (other.id === civ.id || other.eliminated) continue;
      for (const eu of other.units) {
        if (!visible.has(eu.y * map.width + eu.x) || eu.conditions?.hidden) continue;
        const euTile = map.tiles[eu.y * map.width + eu.x];
        if (unitLandmassId >= 0 && euTile.landmassId !== unitLandmassId) continue;
        if (range <= 1 && !canReachByLand(unit.x, unit.y, eu.x, eu.y, map, 150, unit)) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y);
        if (dist < nearestDist) { nearestDist = dist; nearest = eu; }
      }
    }
    if (!nearest) return false;
    moveTowardWithStandoff(civ, unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Chasing an enemy ${nearest.typeId} near (${nearest.x},${nearest.y})`;
    return true;
  }

  /**
   * Orc "Dire Wolf" (user-directed): relentlessly closes on the nearest
   * enemy unit on its own landmass -- deliberately OMNISCIENT, unlike
   * huntNearestEnemy above. "Regardless of fog of war" is the tech's own
   * wording, so this does NOT filter by gameState.visibility at all; it
   * only excludes a truly hidden (stealthed) enemy, since that's a
   * different concern from fog of war and every other targeting pass in
   * the game respects it the same way. Melee-only (Dire Wolf has no
   * `range`), so candidates are filtered to ones actually reachable on
   * foot, same reachability gate huntNearestEnemy uses. Returns true if a
   * target was found and the unit moved toward it -- the caller's own
   * "always try to attack first" check (considerAttackOrGarrison, earlier
   * in runUnitTurn's cascade) already lets it fight anything it's already
   * adjacent to, so this only ever fires once no attack happened this turn.
   */
  function maybeDireWolfHunt(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    let nearest = null, nearestDist = Infinity;
    for (const other of Object.values(civs)) {
      if (other.id === civ.id || other.eliminated) continue;
      for (const eu of other.units) {
        if (eu.carriedBy || eu.conditions?.hidden) continue;
        const euTile = map.tiles[eu.y * map.width + eu.x];
        if (!euTile || (unitLandmassId >= 0 && euTile.landmassId !== unitLandmassId)) continue;
        if (!canReachByLand(unit.x, unit.y, eu.x, eu.y, map, 150, unit)) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y);
        if (dist < nearestDist) { nearestDist = dist; nearest = eu; }
      }
    }
    if (!nearest) return false;
    moveTowardWithStandoff(civ, unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Hunting an enemy ${nearest.typeId} near (${nearest.x},${nearest.y})`;
    log.push(`Dire Wolf: ${civ.id}'s Dire Wolf tracks an enemy ${nearest.typeId} toward (${nearest.x},${nearest.y})`);
    return true;
  }

  /**
   * MILITARY STRATEGY
   * -----------------
   * The win condition is territory share, which comes from influence, which
   * comes from cities and their structures. A military therefore has two
   * jobs: keep your own influence generators standing (defend), and strip
   * the enemy's (seek-and-destroy raiding -- cities can't be captured or
   * destroyed outright here, only their structures razed, which cuts their
   * influence multiplier/radius). Which job a civ's idle units default to is
   * a personality read, not a situational one: aggressiveness (willingness
   * to go looking for a fight) vs. militarism (how tightly a civ holds its
   * own ground -- see the garrison-rest roll above). Immediate threats are
   * unaffected by this -- considerAttackOrGarrison already always reacts to
   * an adjacent enemy first, regardless of posture.
   */

  /** 0 = pure defense-minded, 1 = pure seek-and-destroy-minded. The ratio of
   *  aggressiveness to militarism, so two low-key races (e.g. Elf, both ~0.3)
   *  land near the same balanced ratio as two fierce ones (e.g. Orc, both
   *  ~0.9) -- what differs between them is how OFTEN their units act at all
   *  (aggressiveness gates hunting probability, militarism gates garrisoning),
   *  not which side of defend-vs-raid they lean toward. */
  function militaryPostureFor(civ) {
    const agg = aggressivenessFor(civ);
    const mil = effectiveMilitarism(civ);
    const total = agg + mil;
    return total > 0 ? agg / total : 0.5;
  }

  /**
   * True if `unit` is itself adjacent to a visible (non-Hidden) enemy unit,
   * or has an allied unit within SUPPORT_RADIUS that's adjacent to one --
   * i.e. this unit is either fighting right now or standing near a fight
   * already in progress. Used to hard-veto exploring (see
   * explorePostureFor's call site and the final exploreWith fallback in
   * maybeMoveUnits/runUnitTurn): a unit should never wander off into the
   * fog while it or a nearby ally is in combat, no matter how curious its
   * race is -- this is a flat override, not something curiosity/
   * explorePostureFor's probability can outweigh. A Scout's own
   * unconditional explore (its whole job) is deliberately NOT gated by
   * this -- it's checked earlier in the cascade, before this concern even
   * applies, and a dedicated scout unit's purpose isn't affected by nearby
   * combat the way a general-purpose military unit's priorities are.
   */
  function isNearActiveCombat(civ, unit, gameState) {
    const { civs, map } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    function hasAdjacentEnemy(x, y) {
      for (const otherCiv of Object.values(civs)) {
        if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
        for (const eu of otherCiv.units) {
          if (eu.conditions?.hidden) continue;
          if (!visible.has(eu.y * map.width + eu.x)) continue;
          if (window.GameEngine.influence.chebyshev(x, y, eu.x, eu.y) <= 1) return true;
        }
      }
      return false;
    }
    if (hasAdjacentEnemy(unit.x, unit.y)) return true;
    for (const ally of civ.units) {
      if (ally === unit || ally.carriedBy) continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > SUPPORT_RADIUS) continue;
      if (hasAdjacentEnemy(ally.x, ally.y)) return true;
    }
    return false;
  }

  /**
   * 0 = pure military-minded (stay on duty), 1 = pure explore-minded (go find
   * new land). Rolled per idle unit in maybeMoveUnits to decide whether it
   * prioritizes exploring over its usual garrison/hunt/defend routine this
   * turn. Curiosity drives the baseline desire to explore; a real, immediate
   * need for more cities (tech-gate awareness -- same cityGateShortfall
   * signal chooseStrategy/chooseBuildAction already use) raises it further,
   * since there's nowhere to found a city that hasn't been discovered yet.
   * Weighed against military need, which scales with how militaristic/
   * aggressive the race is and spikes when a real threat is visible right
   * now. Clamped to [0.15, 0.85] so neither pull ever fully wins -- a civ
   * desperate for cities still keeps some units on defense, and a civ under
   * heavy threat still eventually sends someone out looking for new land.
   * Note: this is the DESIRE ratio only -- the hard "never explore while
   * fighting or near a fight" veto lives in isNearActiveCombat above, at
   * this function's call site, not here.
   */
  function explorePostureFor(civ, gameState) {
    const race = window.GameData.getRace(civ.raceId);
    const curiosity = race.curiosity ?? 0.5;
    const militarism = effectiveMilitarism(civ);
    const agg = aggressivenessFor(civ);

    const gatedLayer = window.GameEngine.tech.nextGatedTechLayer(civ);
    const cityGateShortfall = gatedLayer !== null ? Math.max(0, gatedLayer - civ.cities.length) : 0;
    const exploreDesire = curiosity * (1 + cityGateShortfall * 0.5);

    const militaryNeed = (militarism * 0.5 + agg * 0.3) * (detectThreat(civ, gameState) ? 2.5 : 1);

    const ratio = exploreDesire / (exploreDesire + militaryNeed || 1);
    return Math.max(0.15, Math.min(0.85, ratio));
  }

  /**
   * Orc "hold position to keep pillaging": a unit currently suppressing real
   * enemy tiles via Pillage and Loot (unit._pillageTilesSuppressed > 0, set
   * fresh every round by influence.js's computeInfluenceMap during
   * beginRound -- BEFORE this civ's own turn runs, so this always reflects
   * this turn's real suppression) has genuine, ongoing economic value
   * sitting exactly where it is: resolveOwnership needs CONTESTED_GRACE_TURNS
   * (3) consecutive suppressed turns to fully strip a tile, and leaving even
   * briefly lets the enemy's influence flow straight back in, resetting that
   * progress to zero. Without this check, nothing in the cascade below
   * values "stay here" at all -- confirmed via live testing that an
   * unattended raiding unit gets pulled away after a single turn by
   * reinforceHomeCity (militaryPostureFor's ~50/50 offense/defense coin
   * flip for Orc) or the unconditional explore roll (isNearActiveCombat's
   * veto only checks enemy UNITS, never enemy cities) -- see
   * project_campaign_of_terror_fix memory. Checked right after the attack
   * try (a genuinely profitable fight always still wins first) and before
   * every other idle-unit branch, so a productive raider doesn't get
   * reassigned out from under itself. Gated on the same health floor
   * `huntEnemyInfrastructure`'s offense branch uses below, so an already-hurt
   * unit still falls through to its normal self-preservation behavior
   * instead of stubbornly camping into more danger.
   *
   * Turn cap (2026-07-19, user-directed): a unit doesn't hold the SAME spot
   * forever -- after PILLAGE_HOLD_LIMIT consecutive turns it breaks off and
   * presses the attack on the nearest enemy city instead (see
   * huntEnemyInfrastructure), rather than camping indefinitely once the
   * pillaging itself has run its course. This lines up neatly with
   * resolveOwnership's own CONTESTED_GRACE_TURNS (also 3): by the time the
   * cap triggers, a held tile has typically already finished stripping, so
   * moving on isn't abandoning progress -- it's the job being done.
   */
  const PILLAGE_HOLD_LIMIT = 3;

  function maybeHoldPillagePosition(civ, unit, gameState, log) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("pillage_and_loot")) return false;
    if (!(unit._pillageTilesSuppressed > 0)) {
      unit._pillageHoldTurns = 0; // not currently pillaging -- reset the streak for next time
      return false;
    }
    if (unit.hp < unit.maxHp * 0.5) return false;

    unit._pillageHoldTurns = (unit._pillageHoldTurns || 0) + 1;
    if (unit._pillageHoldTurns > PILLAGE_HOLD_LIMIT) {
      if (huntEnemyInfrastructure(civ, unit, gameState)) {
        unit._pillageHoldTurns = 0;
        log.push(`${civ.id}'s ${unit.typeId} breaks off pillaging after ${PILLAGE_HOLD_LIMIT} turns to press the attack`);
        return true;
      }
      // No visible enemy city to march on yet -- fall through to the rest
      // of the idle cascade (huntKnownEnemyTerritory/explore/etc.) instead
      // of forcing a hold; don't reset the streak, so it keeps trying to
      // break off every subsequent turn rather than needing a fresh 3-turn
      // camp first.
      return false;
    }

    unit.usedThisTurn = true;
    const n = unit._pillageTilesSuppressed;
    unit.currentMission = `Pillaging (${n} tile${n === 1 ? "" : "s"} suppressed)`;
    log.push(`${civ.id}'s ${unit.typeId} holds position, pillaging ${n} tile(s)`);
    return true;
  }

  /**
   * Seek-and-destroy: moves a unit toward the nearest visible enemy CITY (own
   * landmass only), so idle offense-postured units actively march on enemy
   * infrastructure instead of waiting for one to wander close. Getting
   * adjacent hands off to considerAttackOrGarrison's existing raze fallback,
   * which picks the actual highest-value structure to demolish once in range.
   * Returns true if a target city was found and the unit moved toward it.
   */
  function huntEnemyInfrastructure(civ, unit, gameState) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    let nearest = null, nearestDist = Infinity;
    for (const other of Object.values(civs)) {
      if (other.id === civ.id || other.eliminated) continue;
      for (const c of other.cities) {
        if (!visible.has(c.y * map.width + c.x)) continue;
        const cTile = map.tiles[c.y * map.width + c.x];
        if (unitLandmassId >= 0 && cTile.landmassId !== unitLandmassId) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, c.x, c.y);
        if (dist < nearestDist) { nearestDist = dist; nearest = c; }
      }
    }
    if (!nearest) return false;
    if (unit.x === nearest.x && unit.y === nearest.y) return false; // already there, nothing to chase
    const usedGate = moveUnitTowardSmart(civ, unit, nearest.x, nearest.y, gameState);
    unit.usedThisTurn = true;
    unit.currentMission = usedGate
      ? `Used a Deep Gate en route to raid ${nearest.name} at (${nearest.x},${nearest.y})`
      : `Marching to raid ${nearest.name} at (${nearest.x},${nearest.y})`;
    return true;
  }

  /**
   * Endgame fallback for a fully idle, fully healthy unit: huntEnemyInfrastructure
   * (just above) and huntNearestEnemy only ever react to what's visible RIGHT
   * NOW, so once this civ's own frontier is settled and the enemy has
   * retreated out of sight, an idle unit has nothing left to react to and
   * used to fall straight through to patrolRaceTerrain -- sitting near its
   * own comfort terrain indefinitely, sometimes for hundreds of turns, until
   * an enemy happened to wander back into view. That was a real contributor
   * to long stalemate games (see [[project_stuck_unit_bugs]]).
   *
   * Fix: march toward the nearest enemy city this civ has EVER seen but
   * can't see right now, using civ.lastKnownEnemyCities (populated once per
   * civ-turn in beginAITurn, self-pruning as civs get eliminated or cities
   * get destroyed). Currently-visible cities are excluded here on purpose --
   * that's huntEnemyInfrastructure's job, checked earlier in the cascade.
   * Overseas memories (a different landmass than this unit) are excluded
   * too -- seekOverseasInvasion, checked earlier, already owns crossing
   * water toward a foreign shore; this function only ever walks.
   */
  function huntKnownEnemyTerritory(civ, unit, gameState, log) {
    const memory = civ.lastKnownEnemyCities;
    if (!memory) return false;
    const { map } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;

    let nearest = null, nearestDist = Infinity;
    for (const key in memory) {
      const spot = memory[key];
      if (visible.has(spot.y * map.width + spot.x)) continue; // huntEnemyInfrastructure's job
      const spotTile = map.tiles[spot.y * map.width + spot.x];
      if (unitLandmassId >= 0 && spotTile.landmassId !== unitLandmassId) continue; // seekOverseasInvasion's job
      const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, spot.x, spot.y);
      if (dist < nearestDist) { nearestDist = dist; nearest = spot; }
    }
    if (!nearest) return false;
    if (unit.x === nearest.x && unit.y === nearest.y) return false; // already there, nothing to chase

    const usedGate = moveUnitTowardSmart(civ, unit, nearest.x, nearest.y, gameState);
    unit.usedThisTurn = true;
    unit.currentMission = usedGate
      ? `Used a Deep Gate en route to last-known enemy territory near ${nearest.name} (${nearest.x},${nearest.y})`
      : `Marching toward last-known enemy territory near ${nearest.name} (${nearest.x},${nearest.y})`;
    log.push(`Hunt: ${civ.id}'s ${unit.typeId} marches toward last-known enemy territory near ${nearest.name} (${nearest.x},${nearest.y})`);
    return true;
  }

  /**
   * Defend: moves a unit toward this civ's own city most in need of a
   * defender -- any city with no military unit currently standing on it,
   * prioritizing ones nearest a visible enemy. Used by defense-postured
   * civs so idle units proactively cover exposed cities instead of wandering
   * off to patrol/explore. Returns false once every city already has cover.
   *
   * Restricted to cities on the unit's OWN landmass (2026-07-12 fix): this
   * only ever calls `moveUnitToward`, a land-only pathfind (water tiles are
   * IMPASSABLE -- see canReachByLand/getMoveCost) with no naval fallback of
   * its own. A civ with an undefended city on a DIFFERENT landmass used to
   * get picked as `best` anyway (nothing here checked reachability), so
   * every idle defense-postured unit on every other landmass would
   * permanently re-select that same unreachable target each turn, move
   * zero tiles, and never fall through to seekOverseasInvasion's actual
   * galley-based cross-water logic -- confirmed directly as the cause of a
   * genuine stuck-game timeout (see [[project_halfellow_tactics]]'s pacing
   * investigation): 10 Halfellow units permanently stalled a few tiles from
   * their OWN cities, all individually "Reinforcing" a single overseas city
   * on a landmass none of them were ever on. Restricting to same-landmass
   * candidates means an overseas undefended city just doesn't get picked
   * here at all -- consistent with how findBestSettleSite already scopes
   * pioneer candidates to `pioneerLandmassId` for the identical reason.
   */
  /** All of `civ`'s currently-standing Deep Gate structures, as {x,y} tiles
   *  -- see Dwarf "Deep Roads Rite". */
  function civDeepGates(civ) {
    const gates = [];
    for (const city of civ.cities) {
      for (const s of city.structures) {
        if (s.id === "deep_gate" && s.hp > 0) gates.push({ x: s.x, y: s.y });
      }
    }
    return gates;
  }

  /** Rough turn-count estimate for closing a distance at a given movement
   *  rate -- ignores terrain entirely, same "aim for approximately here"
   *  precision moveTowardWithStandoff already uses for this kind of
   *  route-comparison heuristic (a real pathfind per candidate gate pair
   *  would be far more expensive for a comparison that only needs to be
   *  roughly right). */
  function estimateMarchTurns(fromX, fromY, toX, toY, movement) {
    return window.GameEngine.influence.chebyshev(fromX, fromY, toX, toY) / Math.max(1, movement);
  }

  /**
   * Dwarf "Deep Roads Rite" pathing integration: like moveUnitToward, but
   * checks whether detouring through this civ's Deep Gate network (walk to
   * an entry gate, instantly relocate, walk the rest of the way from the
   * exit gate -- see maybeDeepRoadsRelocate below) reaches (targetX,targetY)
   * in fewer estimated turns than walking there directly. Falls back to a
   * plain moveUnitToward when the mechanic isn't unlocked, fewer than 2
   * gates exist, or walking direct is already at least as fast.
   *
   * A unit already standing on the best entry gate uses it immediately
   * (the relocate itself spends the whole turn, exactly like
   * maybeDeepRoadsRelocate) instead of walking one more tile first.
   * Callers should treat this exactly like moveUnitToward (it always
   * consumes the rest of this movement step) and can use the return value
   * to note in their own mission/log text that a gate was used. Returns
   * true if it just teleported via a gate, false if it only walked
   * (whether toward an entry gate or straight at the target).
   */
  function moveUnitTowardSmart(civ, unit, targetX, targetY, gameState) {
    const { map, civs } = gameState;
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("deep_roads")) {
      moveUnitToward(unit, targetX, targetY, map, civs);
      return false;
    }
    const gates = civDeepGates(civ);
    if (gates.length < 2) {
      moveUnitToward(unit, targetX, targetY, map, civs);
      return false;
    }

    const baseUnit = window.GameData.getUnit(unit.typeId);
    const movement = Math.max(1, baseUnit.movement + (unit._moveMods?.unitOverrides?.[unit.typeId]?.movement || 0));
    let bestEntry = null, bestExit = null;
    let bestTurns = estimateMarchTurns(unit.x, unit.y, targetX, targetY, movement);
    for (const entry of gates) {
      const inTurns = estimateMarchTurns(unit.x, unit.y, entry.x, entry.y, movement);
      for (const exit of gates) {
        if (exit === entry) continue;
        const outTurns = estimateMarchTurns(exit.x, exit.y, targetX, targetY, movement);
        const total = inTurns + 1 + outTurns; // +1: the relocate itself spends a whole turn
        if (total < bestTurns) { bestTurns = total; bestEntry = entry; bestExit = exit; }
      }
    }
    if (!bestEntry) {
      moveUnitToward(unit, targetX, targetY, map, civs);
      return false;
    }
    if (unit.x === bestEntry.x && unit.y === bestEntry.y) {
      unit.x = bestExit.x;
      unit.y = bestExit.y;
      return true;
    }
    moveUnitToward(unit, bestEntry.x, bestEntry.y, map, civs);
    return false;
  }

  /**
   * Dwarf "Deep Roads Rite": a unit standing on one of this civ's Deep Gates,
   * otherwise idle, may instantly relocate to whichever OTHER owned Deep Gate
   * sits nearest the civ's most-threatened undefended city -- the whole turn
   * is spent arriving (no move/attack after), same restriction as Human's
   * Teleportation. Mirrors reinforceHomeCity's threat scoring below, but
   * teleports to a network node instead of walking. Returns true if it
   * consumed the unit's turn.
   */
  function maybeDeepRoadsRelocate(civ, unit, gameState) {
    const { map, civs } = gameState;
    const gates = civDeepGates(civ);
    if (gates.length < 2) return false;
    const onGate = gates.some((g) => g.x === unit.x && g.y === unit.y);
    if (!onGate) return false;

    const visible = gameState.visibility[civ.id] || new Set();
    let best = null, bestScore = -Infinity;
    for (const gate of gates) {
      if (gate.x === unit.x && gate.y === unit.y) continue; // already here
      let threatDist = 999, nearestCityDist = 999;
      for (const city of civ.cities) {
        const d = window.GameEngine.influence.chebyshev(gate.x, gate.y, city.x, city.y);
        if (d < nearestCityDist) nearestCityDist = d;
        const hasDefender = civ.units.some((u) => !u.carriedBy && u !== unit &&
          window.GameData.getUnit(u.typeId).category === "military" && u.x === city.x && u.y === city.y);
        if (hasDefender) continue;
        for (const other of Object.values(civs)) {
          if (other.id === civ.id || other.eliminated) continue;
          for (const eu of other.units) {
            if (!visible.has(eu.y * map.width + eu.x) || eu.conditions?.hidden) continue;
            const ed = window.GameEngine.influence.chebyshev(city.x, city.y, eu.x, eu.y);
            if (ed < threatDist) threatDist = ed;
          }
        }
      }
      // Only worth the trip if it lands this unit meaningfully closer to an
      // actual threat than sitting still would -- otherwise gate-hopping with
      // no purpose just churns the network for nothing.
      if (threatDist >= 999) continue;
      const score = -threatDist * 2 - nearestCityDist * 0.5;
      if (score > bestScore) { bestScore = score; best = gate; }
    }
    if (!best) return false;

    unit.x = best.x;
    unit.y = best.y;
    unit.usedThisTurn = true;
    unit.currentMission = `Used a Deep Gate to relocate to (${best.x},${best.y})`;
    return true;
  }

  function reinforceHomeCity(civ, unit, gameState) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    let best = null, bestScore = -Infinity;
    for (const city of civ.cities) {
      const cityTile = map.tiles[city.y * map.width + city.x];
      if (unitLandmassId >= 0 && cityTile && cityTile.landmassId !== unitLandmassId) continue;
      const hasDefender = civ.units.some((u) => !u.carriedBy &&
        window.GameData.getUnit(u.typeId).category === "military" && u.x === city.x && u.y === city.y);
      if (hasDefender) continue;
      // Capped, not Infinity: with no visible enemy anywhere, every city would
      // otherwise tie at -Infinity and `score > bestScore` never fires (JS:
      // -Infinity > -Infinity is false), silently leaving `best` unset even
      // though undefended cities exist. Capping keeps distToUnit as a real
      // tiebreaker in the common no-visible-threat case.
      let threatDist = 999;
      for (const other of Object.values(civs)) {
        if (other.id === civ.id || other.eliminated) continue;
        for (const eu of other.units) {
          if (!visible.has(eu.y * map.width + eu.x) || eu.conditions?.hidden) continue;
          const d = window.GameEngine.influence.chebyshev(city.x, city.y, eu.x, eu.y);
          if (d < threatDist) threatDist = d;
        }
      }
      const distToUnit = window.GameEngine.influence.chebyshev(unit.x, unit.y, city.x, city.y);
      // Prioritize the most-threatened undefended city; distance to it is a tiebreaker.
      const score = -threatDist * 2 - distToUnit * 0.5;
      if (score > bestScore) { bestScore = score; best = city; }
    }
    if (!best) return false;
    const usedGate = moveUnitTowardSmart(civ, unit, best.x, best.y, gameState);
    unit.usedThisTurn = true;
    unit.currentMission = usedGate
      ? `Used a Deep Gate to reinforce undefended city ${best.name} at (${best.x},${best.y})`
      : `Reinforcing undefended city ${best.name} at (${best.x},${best.y})`;
    return true;
  }

  /**
   * Dwarf "Deep Roads Rite" overseas shortcut: `civDeepGates` collects a
   * civ's Deep Gates across ALL its cities with no landmass filtering, so
   * once a Dwarf civ has built one on a foreign landmass it's already
   * settled (via an earlier galley crossing), that gate network already
   * spans the water -- instantly, for free, no multi-turn sail and no
   * competing with the galley-throughput bottleneck (see
   * [[project_galley_fleet_cap_scaling]]). Users observed Dwarves still
   * preferring the slower galley route even when a usable gate pair existed.
   * Tries an entry gate on the unit's own landmass paired with an exit gate
   * elsewhere -- `targetLandmassId`, if given, pins the exit to that
   * specific landmass (seekOverseasResource wants a precise destination);
   * left null, any other landmass with a gate qualifies (seekOverseasInvasion
   * just wants this unit off a fully-conquered home landmass, not aimed at
   * anywhere in particular). Same "walk to the gate, teleport next turn"
   * shape as maybeDeepRoadsRelocate. Returns false (no-op, caller falls back
   * to its normal galley-seeking logic) when the mechanic isn't unlocked or
   * no usable entry/exit gate pair exists yet.
   */
  function tryDeepGateOverseas(civ, unit, gameState, log, label, targetLandmassId = null) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("deep_roads")) return false;
    const { map, civs } = gameState;
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    if (unitLandmassId < 0) return false;
    const gates = civDeepGates(civ);
    const entry = gates.find((g) => map.tiles[g.y * map.width + g.x].landmassId === unitLandmassId);
    if (!entry) return false;
    const exit = gates.find((g) => {
      const gLandmassId = map.tiles[g.y * map.width + g.x].landmassId;
      if (gLandmassId === unitLandmassId) return false;
      return targetLandmassId == null || gLandmassId === targetLandmassId;
    });
    if (!exit) return false;

    if (unit.x === entry.x && unit.y === entry.y) {
      unit.x = exit.x;
      unit.y = exit.y;
      unit.usedThisTurn = true;
      unit.currentMission = `Used a Deep Gate to ${label} at (${exit.x},${exit.y})`;
      log.push(`Deep Roads: ${civ.id}'s ${unit.typeId} used a Deep Gate to ${label}`);
      return true;
    }
    moveUnitToward(unit, entry.x, entry.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Heading to a Deep Gate at (${entry.x},${entry.y}) to ${label}`;
    log.push(`Deep Roads: ${civ.id}'s ${unit.typeId} heading to a Deep Gate to ${label}`);
    return true;
  }

  /**
   * Once a civ controls the majority of the landmass a military unit (or idle
   * pioneer) is standing on, there's nothing left to conquer there -- head for
   * a galley and ship out to a foreign shore instead of idling in place.
   * Mirrors maybeFoundCity's idle-pioneer "head for the nearest galley"
   * fallback: moves toward the nearest empty galley (or waits if already
   * adjacent, leaving usedThisTurn unset so operateGalley's boarding scan can
   * pick the unit up later this same turn). Returns false (no-op) when this
   * civ doesn't yet control the majority of the unit's current landmass.
   */
  function seekOverseasInvasion(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    if (unitLandmassId < 0) return false;
    if (!civ._landmassMajority || !civ._landmassMajority.get(unitLandmassId)) return false;

    // Deep Gates beat a galley when a usable network already spans the
    // water -- see tryDeepGateOverseas.
    if (tryDeepGateOverseas(civ, unit, gameState, log, "invade overseas")) return true;

    const emptyGalley = civ.units
      .filter((u) => u.typeId === "galley" && !u.carries)
      .reduce((best, g) => {
        const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, g.x, g.y);
        return (!best || d < best.d) ? { g, d } : best;
      }, null);
    if (!emptyGalley) return false; // nothing to board yet -- chooseBuildAction may queue one

    // Flag read by operateGalley's boarding scan/stranded-unit search so a unit
    // that's deliberately invading gets picked up on sight, same priority as a
    // pioneer/scout, instead of competing with the 35%-chance opportunistic
    // pickup meant for units that are merely standing near a galley by chance.
    unit._seekingInvasion = true;

    if (emptyGalley.d <= 1) {
      // Already adjacent -- leave usedThisTurn unset so operateGalley's boarding
      // scan (runs later this turn) can actually pick this unit up.
      unit.currentMission = `Waiting to board a galley at (${emptyGalley.g.x},${emptyGalley.g.y}) for overseas invasion`;
      log.push(`Invasion: ${civ.id}'s ${unit.typeId} waiting to board galley at (${emptyGalley.g.x},${emptyGalley.g.y})`);
      return true;
    }
    moveUnitToward(unit, emptyGalley.g.x, emptyGalley.g.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Marching to a galley at (${emptyGalley.g.x},${emptyGalley.g.y}) to invade overseas`;
    log.push(`Invasion: ${civ.id}'s ${unit.typeId} heading overseas via galley at (${emptyGalley.g.x},${emptyGalley.g.y})`);
    return true;
  }

  /**
   * Shared by Dwarf "Prospector's Claim" and Human "Dungeon Delve": `spot` is
   * a known resource/ruin tile on a DIFFERENT landmass than `unit` currently
   * stands on -- walking there directly would just strand the unit at the
   * shore forever (moveUnitToward's land-only pathfind treats water as
   * impassable, same bug seekOverseasInvasion above already solves for
   * military invasion). Mirrors that function's exact shape: marks the unit
   * as wanting a ride to `spot`'s specific landmass (read by operateGalley's
   * boarding scan and its disembark-landmass choice, both via
   * unit._seekingLandmassId -- a distinct flag from _seekingInvasion, since
   * that one carries its own civ-wide invasion-target landmass bias that
   * would otherwise misdirect a prospector/wizard to whatever landmass an
   * unrelated invasion is aimed at) and heads for the nearest empty galley.
   * If none exists yet, there's nothing productive to do here right now --
   * returns false so the idle cascade tries something else instead of
   * parking the unit at the water's edge indefinitely.
   */
  function seekOverseasResource(civ, unit, gameState, log, spot, label) {
    const { map, civs } = gameState;

    // Deep Gates beat a galley when this civ already has a gate on the
    // specific target landmass -- see tryDeepGateOverseas.
    if (tryDeepGateOverseas(civ, unit, gameState, log, `reach a ${label}`, spot.landmassId)) return true;

    const emptyGalley = civ.units
      .filter((u) => u.typeId === "galley" && !u.carries)
      .reduce((best, g) => {
        const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, g.x, g.y);
        return (!best || d < best.d) ? { g, d } : best;
      }, null);
    if (!emptyGalley) return false; // no boat available -- do something else instead

    unit._seekingLandmassId = spot.landmassId;

    if (emptyGalley.d <= 1) {
      // Already adjacent -- leave usedThisTurn unset so operateGalley's
      // boarding scan (runs later this turn) can actually pick this unit up.
      unit.currentMission = `Waiting to board a galley at (${emptyGalley.g.x},${emptyGalley.g.y}) to reach a ${label}`;
      log.push(`${label}: ${civ.id}'s ${unit.typeId} waiting to board a galley for an overseas ${label}`);
      return true;
    }
    moveUnitToward(unit, emptyGalley.g.x, emptyGalley.g.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Marching to a galley at (${emptyGalley.g.x},${emptyGalley.g.y}) to reach an overseas ${label}`;
    log.push(`${label}: ${civ.id}'s ${unit.typeId} heading to a galley to reach an overseas ${label} at (${spot.x},${spot.y})`);
    return true;
  }

  /**
   * Moves a military unit toward the highest race-affinity tile within patrol range.
   * Elves drift to forests, dwarves to hills, undead to ruins, etc.
   * Returns true if the unit was moved.
   */
  function patrolRaceTerrain(civ, unit, gameState) {
    const { map } = gameState;
    const PATROL = 8;
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    let best = null, bestScore = 0; // threshold > 0 so units without preference don't wander
    for (let dy = -PATROL; dy <= PATROL; dy++) {
      for (let dx = -PATROL; dx <= PATROL; dx++) {
        const x = unit.x + dx, y = unit.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const tile = map.tiles[y * map.width + x];
        if (window.GameData.TERRAIN[tile.terrain].isWater) continue;
        if (unitLandmassId >= 0 && tile.landmassId !== unitLandmassId) continue;
        if (tile.ownerCivId && tile.ownerCivId !== civ.id) continue; // don't wander into enemy land
        const affinity = raceTerrainAffinity(civ, x, y, map);
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, x, y);
        const score = affinity - dist * 0.15;
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    if (!best) return false;
    moveUnitToward(unit, best.x, best.y, map, gameState.civs);
    unit.usedThisTurn = true;
    unit.currentMission = "Patrolling favored terrain";
    return true;
  }

  /** Sums two optional {harvest?,coin?,lore?} bonus objects into one plain
   *  number -- shared by raceTerrainAffinity so a bonus can come from either
   *  race-baked data or a civ's tech unlocks without duplicating the sum. */
  function sumBonus(a, b) {
    let total = 0;
    if (a) total += Object.values(a).reduce((x, y) => x + y, 0);
    if (b) total += Object.values(b).reduce((x, y) => x + y, 0);
    return total;
  }

  /**
   * Returns a terrain-preference score for position (x,y) based on this civ's
   * tileBonuses/featureBonuses -- tiles worth more to this civ get a higher
   * affinity score. Used to bias settle-site selection (via
   * computeTileCityScore), frontier pushes, and idle unit patrol.
   *
   * Combines TWO sources per key, both currently supported so this stays
   * correct regardless of which one a given bonus ends up defined on:
   *   - race.tileBonuses/featureBonuses -- baked directly into the race.
   *     Always empty today (races.js moved all yield bonuses to the tech
   *     tree -- see its header comment), but still checked so a future
   *     race-level bonus is picked up automatically with no code change here.
   *   - civ.unlockedTileBonuses/unlockedFeatureBonuses -- granted by tech
   *     effects (unlock_tile_bonus/unlock_feature_bonus, see tech.js). This
   *     is the gap that mattered: settle-site/patrol/frontier scoring used to
   *     ignore these entirely, so a tech like Human's Homestead (+1 harvest
   *     on Plains) boosted actual city yield but never made the AI want to
   *     settle on Plains more. Reading both here means ANY future tile/
   *     feature-bonus tech automatically flows into this score too, with
   *     zero changes needed at that point -- it's the same mechanism
   *     computeWorkedTileYield already uses for actual yield (cities.js).
   */
  function raceTerrainAffinity(civ, x, y, map) {
    const race = window.GameData.getRace(civ.raceId);
    const tb = race.tileBonuses   || {};
    const fb = race.featureBonuses || {};
    const utb = civ.unlockedTileBonuses    || {};
    const ufb = civ.unlockedFeatureBonuses || {};
    let score = 0;
    const RADIUS = 2; // same as city working radius
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        const t = map.tiles[ny * map.width + nx];
        score += sumBonus(tb[t.terrain], utb[t.terrain]);
        if (t.isRuin) score += sumBonus(fb.ruin, ufb.ruin);
        if (t.hasRoad) score += sumBonus(fb.road, ufb.road) * 0.4;
        const hasRiver = t.hasRiver && (t.hasRiver.n || t.hasRiver.s || t.hasRiver.e || t.hasRiver.w);
        if (hasRiver) score += sumBonus(fb.river, ufb.river);
      }
    }
    return score;
  }

  /**
   * Unified "how good would a city be HERE" score for this civ -- the single
   * formula behind both findBestSettleSite's live per-turn pioneer scoring
   * and the persistent per-civ "tile city score" cached into
   * gameState.tileMemory (see turns.js's refreshVisibility) for the Interface
   * menu's overlay. Combining these into one function is what makes this
   * future-looking: ANY new tech effect (unlock_tile_bonus,
   * unlock_feature_bonus, or a new RESOURCES entry) automatically raises a
   * tile's score here with no changes needed to this function OR any of its
   * callers, because it all flows through raceTerrainAffinity/civ.unlocked*
   * rather than a hardcoded per-terrain list.
   *
   * `affinityWeight` lets a caller scale how much this civ's race/tech
   * terrain preference matters relative to the tile's raw intrinsic value --
   * findBestSettleSite passes its own expansionism-derived pickiness here;
   * everything else (persistent cache, UI overlay) uses the default 1.0 for
   * an unweighted, "objective" value.
   *
   * Returns -Infinity for water (never a legal city site).
   */
  function computeTileCityScore(civ, gameState, x, y, affinityWeight = 1.0) {
    const { map } = gameState;
    const tile = map.tiles[y * map.width + x];
    const terrain = window.GameData.TERRAIN[tile.terrain];
    if (terrain.isWater) return -Infinity;

    let score = Object.values(terrain.yield).reduce((a, b) => a + b, 0);
    if (tile.resource) {
      // Weighted up (x2) relative to a plain terrain yield point -- a
      // resource is a permanent, tile-specific bonus a city built right next
      // to it keeps forever, worth more than an equivalent point of generic
      // surrounding terrain yield.
      const resBonus = window.GameData.RESOURCES[tile.resource].bonus;
      score += Object.values(resBonus).reduce((a, b) => a + b, 0) * 2;
    }
    if (tile.isRuin) score += 2;
    const hasRiver = tile.hasRiver && (tile.hasRiver.n || tile.hasRiver.s || tile.hasRiver.e || tile.hasRiver.w);
    if (hasRiver) score += 2;
    if (isCoastalTile(map, x, y)) score += 1;
    score += raceTerrainAffinity(civ, x, y, map) * affinityWeight;
    return score;
  }

  function pushTowardInfluenceFrontier(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    if (unitLandmassId < 0) return;

    const race = window.GameData.getRace(civ.raceId);
    const expansionism = race.expansionism ?? 0.5;
    // Minimum race-affinity a plain neutral tile needs to be worth proactively
    // claiming: 2.0 at expansionism=0 (picky -- only bothers with tiles suited
    // to this race) down to 0.5 at expansionism=1 (grabs land readily even
    // without a terrain match). Contested/enemy tiles bypass this gate
    // entirely regardless of race -- those are always worth pushing into.
    const affinityGate = 2.0 - expansionism * 1.5;

    const SEARCH = 12;
    let best = null, bestScore = -Infinity;
    for (let dy = -SEARCH; dy <= SEARCH; dy++) {
      for (let dx = -SEARCH; dx <= SEARCH; dx++) {
        const x = unit.x + dx, y = unit.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const tile = map.tiles[y * map.width + x];
        if (window.GameData.TERRAIN[tile.terrain].isWater) continue;
        if (tile.landmassId !== unitLandmassId) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, x, y);
        const isContested = tile.status === "contested";
        const isEnemy     = tile.status === "owned" && tile.ownerCivId && tile.ownerCivId !== civ.id;
        const isNeutral   = !tile.ownerCivId || tile.status === "neutral";
        // Race affinity for this tile — drives proactive neutral-land claiming
        const affinity = raceTerrainAffinity(civ, x, y, map);
        // Contested and enemy tiles are always high priority.
        // Neutral tiles need at least `affinityGate` race-affinity to be worth
        // claiming proactively -- how picky that is scales with expansionism.
        if (!isContested && !isEnemy && affinity < affinityGate) continue;
        const score = (isEnemy ? 3 : isContested ? 2 : 0) + affinity * 0.4 - dist * 0.1;
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    // Already sitting on the best-scoring tile in range -- a no-op move that
    // would otherwise still burn the turn every single turn forever, since
    // the same tile keeps re-winning this search once a unit settles there.
    // Falling through lets rest/hunt/reinforce logic actually run instead.
    if (best && (best.x !== unit.x || best.y !== unit.y)) {
      moveUnitToward(unit, best.x, best.y, map, civs);
      unit.usedThisTurn = true;
      unit.currentMission = `Pushing the frontier toward (${best.x},${best.y})`;
    }
  }

  /**
   * Orc Dragon Riders: a Dragon with the tech unlocked can carry one other
   * friendly Orc unit (never another Dragon) around the map. The passenger is
   * inert cargo (see the `carriedBy` skip at the top of maybeMoveUnits) --
   * only the Dragon decides when to pick up or drop off, mirroring how
   * operateGalley already drives its own cargo's boarding/disembark rather
   * than the cargo unit driving it. Returns true if this consumed the turn.
   */
  function operateDragonCarry(civ, unit, gameState, log) {
    const { map, civs } = gameState;

    if (unit.carries) {
      // Disembark once there's a reason to: adjacent to an enemy (about to
      // fight, so the passenger can pile on too) or back over a friendly city
      // (delivering reinforcements). Otherwise keep carrying.
      const visible = gameState.visibility[civ.id] || new Set();
      const nearEnemy = Object.values(civs).some((oc) => oc.id !== civ.id && !oc.eliminated &&
        oc.units.some((eu) => window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y) <= 1
          && visible.has(eu.y * map.width + eu.x) && !eu.conditions?.hidden));
      const overFriendlyCity = civ.cities.some((c) => c.x === unit.x && c.y === unit.y);
      if (!nearEnemy && !overFriendlyCity) return false;

      const occupied = buildOccupancySet(civs, unit.carries);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = unit.x + dx, ny = unit.y + dy;
          if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
          if (occupied.has(`${nx},${ny}`)) continue;
          const tile = map.tiles[ny * map.width + nx];
          if (!tile) continue;
          const terrain = window.GameData.TERRAIN[tile.terrain];
          if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) continue;
          const cargo = unit.carries;
          cargo.carriedBy = null;
          cargo.x = nx; cargo.y = ny;
          snapVisualPos(cargo, nx, ny);
          unit.carries = null;
          log.push(`Dragon Riders: ${civ.id} dropped off ${cargo.typeId} at (${nx},${ny})`);
          return false; // Dragon itself hasn't acted yet -- let it continue this turn
        }
      }
      return false; // no open tile to disembark onto -- keep carrying
    }

    // Not carrying: look for an adjacent friendly, uncarried, non-Dragon unit to
    // pick up. `!u.carries` rules out nested carrying (e.g. a Galley currently
    // carrying a Pioneer) -- a passenger can never itself be carrying someone.
    const passenger = civ.units.find((u) => u !== unit && !u.carriedBy && !u.carries && u.typeId !== "dragon"
      && window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y) <= 1 && !u.usedThisTurn);
    if (!passenger) return false;
    unit.carries = passenger;
    passenger.carriedBy = unit;
    passenger.usedThisTurn = true;
    unit.usedThisTurn = true;
    unit.currentMission = `Carrying a ${passenger.typeId} as a rider`;
    log.push(`Dragon Riders: ${civ.id} dragon picked up ${passenger.typeId}`);
    return true;
  }

  const COMPANION_INJURY_THRESHOLD = 0.6; // "significantly injured" -- worth carrying to heal

  /**
   * Halfellow "Devoted Companions": ANY Halfellow unit may carry ANY other
   * Halfellow unit (not restricted to matching types, unlike Orc's Dragon
   * Riders). Unlike Dragon Riders, this isn't about combined-arms carrying --
   * the whole point is accelerated healing (see healUnit's extraMult, applied
   * automatically every turn in turns.js regardless of Rest), so the trigger
   * to pick someone up is "a significantly injured ally is standing right
   * next to me," and the trigger to set them back down is "they're fully
   * healed now." Mirrors operateDragonCarry's return-value convention: true
   * only on pickup (consumes the turn), false otherwise (so normal
   * attack/move dispatch still runs the same turn for an already-carrying or
   * just-dropped-off unit).
   */
  function operateCompanionCarry(civ, unit, gameState, log) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("devoted_companions")) return false;
    const { map, civs } = gameState;

    if (unit.carries) {
      const cargo = unit.carries;
      if (cargo.hp >= cargo.maxHp) {
        const occupied = buildOccupancySet(civs, cargo);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = unit.x + dx, ny = unit.y + dy;
            if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
            if (occupied.has(`${nx},${ny}`)) continue;
            const terrain = window.GameData.TERRAIN[map.tiles[ny * map.width + nx].terrain];
            if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) continue;
            cargo.carriedBy = null;
            cargo.x = nx; cargo.y = ny;
            snapVisualPos(cargo, nx, ny);
            unit.carries = null;
            log.push(`Devoted Companions: ${civ.id}'s ${unit.typeId} set down a fully healed ${cargo.typeId} at (${nx},${ny})`);
            return false; // carrier hasn't acted yet -- let it continue this turn
          }
        }
      }
      return false; // still carrying -- nothing else to decide here
    }

    const candidate = civ.units.find((u) =>
      u !== unit && !u.carriedBy && !u.carries && u.hp < u.maxHp * COMPANION_INJURY_THRESHOLD
      && window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y) <= 1 && !u.usedThisTurn);
    if (!candidate) return false;
    unit.carries = candidate;
    candidate.carriedBy = unit;
    candidate.usedThisTurn = true;
    unit.usedThisTurn = true;
    unit.currentMission = `Carrying an injured ${candidate.typeId} to help it heal`;
    log.push(`Devoted Companions: ${civ.id}'s ${unit.typeId} picked up injured ${candidate.typeId} at (${unit.x},${unit.y})`);
    return true;
  }

  // How far a Halfellow unit will proactively travel to reach an injured ally
  // worth carrying -- see maybeSeekInjuredCompanion. Same order of magnitude
  // as Crusade's search radius (CRUSADE_SEARCH_RADIUS): far enough to matter,
  // not so far the ally has probably moved or healed on its own by the time
  // this unit would arrive.
  const COMPANION_SEEK_RADIUS = 6;

  /**
   * Halfellow "Devoted Companions", proactive half: operateCompanionCarry
   * only ever picks up an ally already standing right next to the carrier --
   * it never goes looking. This closes that gap ("halfellows should use
   * their tech to carry each other to heal each other" implies seeking out
   * the injured, not just reacting to whoever happens to be adjacent): if no
   * adjacent candidate exists, move toward the nearest injured, not-already-
   * spoken-for ally within range instead. Doesn't actually pick anyone up
   * this turn (carrying still requires adjacency, handled next turn by
   * operateCompanionCarry once this unit arrives) -- purely closes the
   * distance. Returns true if it moved (consuming the turn).
   */
  function maybeSeekInjuredCompanion(civ, unit, gameState, log) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("devoted_companions")) return false;
    if (unit.carries || unit.carriedBy) return false;
    const { map, civs } = gameState;
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (u === unit || u.carriedBy || u.carries || u.usedThisTurn) continue;
      if (u.hp >= u.maxHp * COMPANION_INJURY_THRESHOLD) continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    if (!nearest || nearestDist <= 1 || nearestDist > COMPANION_SEEK_RADIUS) return false;
    moveUnitToward(unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Rushing to carry injured ${nearest.typeId} at (${nearest.x},${nearest.y})`;
    log.push(`Devoted Companions: ${civ.id}'s ${unit.typeId} moves to reach injured ${nearest.typeId}`);
    return true;
  }

  /**
   * Halfellow "Devoted Companions": a carried passenger is normally fully
   * inert cargo (see the `carriedBy` skip at the top of maybeMoveUnits), but
   * may disembark on its own to help fight if there's an enemy adjacent to
   * its carrier RIGHT NOW -- gated by the civ's aggressiveness (a cautious
   * civ leaves an injured passenger alone to keep healing; an aggressive one
   * pulls it back into the fray early). Returns true if it disembarked (the
   * caller should let it fall through to normal dispatch this same turn).
   */
  function maybeDisembarkCompanion(civ, unit, gameState, log) {
    const carrier = unit.carriedBy;
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const nearEnemy = Object.values(civs).some((oc) => oc.id !== civ.id && !oc.eliminated &&
      oc.units.some((eu) => window.GameEngine.influence.chebyshev(carrier.x, carrier.y, eu.x, eu.y) <= 1
        && visible.has(eu.y * map.width + eu.x) && !eu.conditions?.hidden));
    if (!nearEnemy) return false;
    const race = window.GameData.getRace(civ.raceId);
    if (Math.random() >= (race.aggressiveness ?? 0.5)) return false;

    const occupied = buildOccupancySet(civs, unit);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = carrier.x + dx, ny = carrier.y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (occupied.has(`${nx},${ny}`)) continue;
        const terrain = window.GameData.TERRAIN[map.tiles[ny * map.width + nx].terrain];
        if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) continue;
        unit.carriedBy = null;
        carrier.carries = null;
        unit.x = nx; unit.y = ny;
        snapVisualPos(unit, nx, ny);
        log.push(`Devoted Companions: ${civ.id}'s ${unit.typeId} disembarks to join the fight at (${nx},${ny})`);
        return true;
      }
    }
    return false;
  }

  // Consecutive stalled turns (see isUnitStalled) before the stranded-unit
  // pickup logic below gives up on the current pickupWater target and
  // falls back to exploreWater instead of repeating the same "Sailing to
  // pick up..." mission indefinitely.
  const GALLEY_PICKUP_STALL_THRESHOLD = 3;

  function operateGalley(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    const TERRAIN = window.GameData.TERRAIN;

    // If galley is carrying a unit, try to disembark it on new land.
    // Pioneers use findDisembarkSite (city-spacing aware); all others use
    // findScoutLandingSpot (any foreign shore, no spacing constraint).
    if (unit.carries) {
      const cargo = unit.carries;
      const isPioneer = cargo.typeId === "pioneer";

      // Count turns near walkable land — if stranded near shore for too long,
      // force disembark at any adjacent land tile rather than waiting for ideal site.
      let nearLand = false;
      for (let dy = -1; dy <= 1 && !nearLand; dy++) {
        for (let dx = -1; dx <= 1 && !nearLand; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = unit.x + dx, ny = unit.y + dy;
          if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
          const t = TERRAIN[map.tiles[ny * map.width + nx].terrain];
          if (!t.isWater && t.moveCostLand !== window.GameData.IMPASSABLE) nearLand = true;
        }
      }
      unit.turnsNearLand = nearLand ? (unit.turnsNearLand || 0) + 1 : 0;

      if (unit.turnsNearLand >= 3) {
        // Force disembark at any adjacent walkable, UNOCCUPIED land tile
        const occupiedForDisembark = buildOccupancySet(civs, cargo);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = unit.x + dx, ny = unit.y + dy;
            if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
            const t = TERRAIN[map.tiles[ny * map.width + nx].terrain];
            if (t.isWater || t.moveCostLand === window.GameData.IMPASSABLE) continue;
            if (occupiedForDisembark.has(`${nx},${ny}`)) continue; // no stacking
            cargo.x = nx; cargo.y = ny;
            cargo.carriedBy = null; unit.carries = null;
            snapVisualPos(cargo, nx, ny);
            unit.turnsNearLand = 0;
            unit.currentMission = `Force-disembarked ${cargo.typeId} at (${nx},${ny})`;
            log.push(`Naval: ${civ.id} galley force-disembarked ${cargo.typeId} at (${nx},${ny}) after 3 turns near shore`);
            unit.usedThisTurn = true;
            return;
          }
        }
      }

      // Grouped-invasion bias: when a significant, currently-visible foreign
      // defense is known (see assessInvasionTarget), every galley's landing
      // search prefers that SAME landmass -- so units converge on one beach
      // as a group instead of each drifting to whichever shore is nearest to
      // itself individually. A passenger that boarded wanting a SPECIFIC
      // landmass (see seekOverseasResource -- a prospector/wizard chasing a
      // known gold vein/ruin overseas) overrides that civ-wide bias with its
      // own precise destination; there'd be no point ferrying it toward
      // wherever an unrelated invasion happens to be aimed.
      const invasionLandmassId = cargo._seekingLandmassId != null
        ? cargo._seekingLandmassId
        : (civ._invasionTarget ? civ._invasionTarget.landmassId : null);
      const landTarget = isPioneer
        ? findDisembarkSite(civ, unit, gameState, invasionLandmassId)
        : findScoutLandingSpot(civ, unit, map, civs, invasionLandmassId);
      if (landTarget) {
        moveUnitToward(unit, landTarget.waterX, landTarget.waterY, map, civs);
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, landTarget.landX, landTarget.landY);
        if (dist <= 1) {
          cargo.x = landTarget.landX;
          cargo.y = landTarget.landY;
          cargo.carriedBy = null;
          snapVisualPos(cargo, landTarget.landX, landTarget.landY);
          unit.carries = null;
          unit.turnsNearLand = 0;
          unit.currentMission = `Disembarked ${cargo.typeId} at (${landTarget.landX},${landTarget.landY})`;
          log.push(`Naval: ${civ.id} galley disembarked ${cargo.typeId} at (${landTarget.landX},${landTarget.landY})`);
        } else {
          unit.currentMission = `Ferrying ${cargo.typeId} to land at (${landTarget.landX},${landTarget.landY})`;
        }
      } else {
        const foreignShore = findForeignShore(civ, unit, map, invasionLandmassId);
        if (foreignShore) {
          moveUnitToward(unit, foreignShore.x, foreignShore.y, map, civs);
          unit.currentMission = `Ferrying ${cargo.typeId} toward a foreign shore`;
        } else {
          exploreWater(unit, gameState, log);
          unit.currentMission = `Ferrying ${cargo.typeId}, searching for land`;
        }
      }
      unit.usedThisTurn = true;
      return;
    }

    // No cargo: track how long this galley has been sitting empty near shore.
    // After 3+ turns with nothing to do, stop drifting and go find a pioneer.
    let nearShoreEmpty = false;
    for (let dy = -1; dy <= 1 && !nearShoreEmpty; dy++) {
      for (let dx = -1; dx <= 1 && !nearShoreEmpty; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = unit.x + dx, ny = unit.y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        const t = TERRAIN[map.tiles[ny * map.width + nx].terrain];
        if (!t.isWater && t.moveCostLand !== window.GameData.IMPASSABLE) nearShoreEmpty = true;
      }
    }
    unit.turnsEmptyNearShore = nearShoreEmpty ? (unit.turnsEmptyNearShore || 0) + 1 : 0;

    // No cargo: check every adjacent land tile for a unit waiting to board.
    // Priority: pioneer > scout > military (occasional, 35% chance).
    const galleyTile = map.tiles[unit.y * map.width + unit.x];
    if (TERRAIN[galleyTile.terrain].isWater) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = unit.x + dx, ny = unit.y + dy;
          if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
          if (TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) continue;
          // !u.carries rules out nested carrying -- a unit already carrying
          // its own passenger (currently never true for these types, but
          // future-proofed the same way as operateDragonCarry) can't itself
          // be boarded as cargo.
          const atTile = (typeId) => civ.units.find(u =>
            u.typeId === typeId && u.x === nx && u.y === ny && !u.carriedBy && !u.carries && !u.usedThisTurn);
          const militaryAtTile = () => civ.units.find(u => {
            const ud = window.GameData.getUnit(u.typeId);
            return ud.category === "military" && !ud.isNaval && u.x === nx && u.y === ny && !u.carriedBy && !u.carries && !u.usedThisTurn;
          });
          // Only board a pioneer if it's ready to embark (no land site remaining,
          // >=2 cities on island, or it's been idle 3+ turns -- that last one
          // covers a pioneer whose "remaining" land site is theoretically there
          // but practically unreachable/contested; without it, that pioneer's
          // own idle-stall fallback in maybeFoundCity parks it next to a galley
          // that this check would otherwise refuse to ever board it onto.
          const pioneerAtTile = (() => {
            const p = atTile("pioneer");
            if (!p) return null;
            const pTile = map.tiles[p.y * map.width + p.x];
            const pLandmassId = pTile ? pTile.landmassId : -1;
            const citiesHere = civ.cities.filter(c => {
              const ct = map.tiles[c.y * map.width + c.x];
              return ct && ct.landmassId === pLandmassId;
            }).length;
            const landmassConquered = !!(civ._landmassMajority && civ._landmassMajority.get(pLandmassId));
            const hasLandSite = !!findBestSettleSite(civ, gameState, p);
            const stuckIdle = (p._idleTurns || 0) >= 3;
            return (!hasLandSite || citiesHere >= 2 || landmassConquered || stuckIdle) ? p : null;
          })();
          // A unit deliberately marching for an overseas invasion (see
          // seekOverseasInvasion) boards on sight, same priority as a
          // pioneer/scout -- the 35% roll is reserved for a military unit
          // that's merely standing near a galley for unrelated reasons.
          const invasionMilitaryAtTile = () => { const m = militaryAtTile(); return m && m._seekingInvasion ? m : null; };
          // Same "boards on sight" priority for a unit deliberately seeking a
          // SPECIFIC landmass (see seekOverseasResource -- a prospector/wizard
          // chasing a known gold vein/ruin on another landmass). Not typeId/
          // category-scoped like the checks above -- Prospector's Claim is
          // open to any Dwarf unit, not just military ones.
          const seekingLandmassAtTile = () => civ.units.find(u =>
            u.x === nx && u.y === ny && !u.carriedBy && !u.carries && !u.usedThisTurn && u._seekingLandmassId != null);
          const boarder = pioneerAtTile || atTile("scout") || invasionMilitaryAtTile() || seekingLandmassAtTile()
            || (Math.random() < 0.35 ? militaryAtTile() : null);
          if (boarder) {
            unit.carries = boarder;
            boarder.carriedBy = unit;
            boarder.usedThisTurn = true;
            unit.turnsEmptyNearShore = 0;
            unit.currentMission = `Carrying a ${boarder.typeId}`;
            log.push(`Naval: ${civ.id} ${boarder.typeId} boarded galley at (${unit.x},${unit.y})`);
            unit.usedThisTurn = true;
            return;
          }
        }
      }
      // No adjacent boarder — navigate toward a stranded unit on shore.
      // Priority matches boarding: pioneer > scout > military (occasional).
      // Find a stranded unit to pick up. For pioneers, only navigate toward them
      // if they actually want to embark (no land settle site, or civ has ≥2 cities
      // on their island) — avoids prematurely pulling a pioneer off its settle route.
      // !u.carries throughout this block rules out nested carrying, same as
      // the boarding scan above -- a unit already carrying its own passenger
      // can't itself be boarded as cargo.
      const sp = civ.units.find(u => {
        if (u.typeId !== "pioneer" || u.carriedBy || u.carries) return false;
        const pTile = map.tiles[u.y * map.width + u.x];
        const pLandmassId = pTile ? pTile.landmassId : -1;
        const citiesOnLandmass = civ.cities.filter(c => {
          const ct = map.tiles[c.y * map.width + c.x];
          return ct && ct.landmassId === pLandmassId;
        }).length;
        const hasLandSite = !!findBestSettleSite(civ, gameState, u);
        const landmassConquered = !!(civ._landmassMajority && civ._landmassMajority.get(pLandmassId));
        return !hasLandSite || citiesOnLandmass >= 2 || landmassConquered || (u._idleTurns || 0) >= 3;
      });
      const ss = !sp && civ.units.find(u => u.typeId === "scout" && !u.carriedBy && !u.carries);
      // Deliberately-invading units (see seekOverseasInvasion) get sought out
      // on sight, ahead of the 35%-chance opportunistic pickup below.
      const smInvasion = !sp && !ss && civ.units.find(u => {
        const ud = window.GameData.getUnit(u.typeId);
        return ud.category === "military" && !ud.isNaval && !u.carriedBy && !u.carries && u._seekingInvasion;
      });
      // Same "sought out on sight" treatment for a unit chasing a known
      // overseas gold vein/ruin (see seekOverseasResource) -- not category-
      // scoped, same reasoning as seekingLandmassAtTile above.
      const smLandmass = !sp && !ss && !smInvasion && civ.units.find(u =>
        !u.carriedBy && !u.carries && u._seekingLandmassId != null);
      const sm = !sp && !ss && !smInvasion && !smLandmass && Math.random() < 0.35 && civ.units.find(u => {
        const ud = window.GameData.getUnit(u.typeId);
        return ud.category === "military" && !ud.isNaval && !u.carriedBy && !u.carries;
      });
      const strandedUnit = sp || ss || smInvasion || smLandmass || sm;
      if (strandedUnit) {
        unit.turnsEmptyNearShore = 0;
        // findNearestCoastalWaterFor handles inland pioneers (expands beyond adjacency)
        const pickupWater = findNearestCoastalWaterFor(strandedUnit.x, strandedUnit.y, map);
        // isUnitStalled here catches a pickupWater tile that LOOKS reachable
        // but the galley genuinely can't make progress toward (e.g. boxed
        // in a strait, or the "nearest" coastal water shifts to a different
        // equally-unreachable tile every turn as strandedUnit itself moves)
        // -- previously this branch had no stuck-detection at all, and could
        // repeat the same "Sailing to pick up..." mission for 100+ turns
        // with zero actual movement. Own "galley_pickup" key (see
        // isUnitStalled's doc) so it doesn't share state with the
        // exploreWater fallback called in the same turn just below.
        if (pickupWater && !isUnitStalled(unit, "galley_pickup", GALLEY_PICKUP_STALL_THRESHOLD)) {
          moveUnitToward(unit, pickupWater.x, pickupWater.y, map, civs);
          unit.currentMission = `Sailing to pick up a stranded ${strandedUnit.typeId} at (${strandedUnit.x},${strandedUnit.y})`;
        } else {
          exploreWater(unit, gameState, log);
          unit.currentMission = "Searching for a way to reach a stranded unit";
        }
        unit.usedThisTurn = true;
        return;
      }

      // Empty and idle near shore for 3+ turns: stop drifting and go park near
      // the nearest pioneer (any pioneer, even one not embark-ready yet) so
      // it's on hand the moment that pioneer wants to sail. Skipped for a
      // Dwarf civ whose Titan is stalled waiting for a target city (see
      // civNeedsTitanScouting) -- standing by near a pioneer is a lower
      // priority than actively searching for an enemy shore right now, so
      // this falls through to the exploreWater fallback further down instead.
      if (unit.turnsEmptyNearShore >= 3 && !civNeedsTitanScouting(civ)) {
        const nearestPioneer = civ.units
          .filter(u => u.typeId === "pioneer" && !u.carriedBy)
          .reduce((best, p) => {
            const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, p.x, p.y);
            return (!best || d < best.d) ? { p, d } : best;
          }, null);
        if (nearestPioneer) {
          const pickupWater = findNearestCoastalWaterFor(nearestPioneer.p.x, nearestPioneer.p.y, map);
          if (pickupWater) {
            moveUnitToward(unit, pickupWater.x, pickupWater.y, map, civs);
            unit.currentMission = `Idle — heading to stand by near a pioneer at (${nearestPioneer.p.x},${nearestPioneer.p.y})`;
            log.push(`Naval: ${civ.id} galley idle 3+ turns, seeking pioneer at (${nearestPioneer.p.x},${nearestPioneer.p.y})`);
            unit.usedThisTurn = true;
            return;
          }
        }
      }
    } else {
      // Galley on a land tile — teleport to nearest water (it can't walk there)
      const waterTarget = findNearestWaterTile(unit, map);
      if (waterTarget) { unit.x = waterTarget.x; unit.y = waterTarget.y; }
      unit.usedThisTurn = true;
      unit.currentMission = "Relocating to open water";
      return;
    }

    // No cargo, no stranded pioneer — explore water for new land
    exploreWater(unit, gameState, log);
    unit.usedThisTurn = true;
    unit.currentMission = "Exploring open water for new land";
  }

  function findDisembarkSite(civ, galley, gameState, preferredLandmassId = null) {
    const { map, civs } = gameState;
    const TERRAIN = window.GameData.TERRAIN;
    const SEARCH = 30;

    // Only target land on landmasses where this civ has NO cities — foreign shores only.
    // Without this filter the galley would try to disembark the pioneer back on the home
    // island where all land is "too close to existing cities" and the galley never moves.
    const homeLandmassIds = new Set();
    for (const city of civ.cities) {
      const ct = map.tiles[city.y * map.width + city.x];
      if (ct && ct.landmassId >= 0) homeLandmassIds.add(ct.landmassId);
    }

    let best = null, bestScore = -Infinity;
    for (let dy = -SEARCH; dy <= SEARCH; dy++) {
      for (let dx = -SEARCH; dx <= SEARCH; dx++) {
        const wx = galley.x + dx, wy = galley.y + dy;
        if (wx < 0 || wx >= map.width || wy < 0 || wy >= map.height) continue;
        if (!TERRAIN[map.tiles[wy * map.width + wx].terrain].isWater) continue;
        // Check adjacent land tiles
        for (let ly = wy - 1; ly <= wy + 1; ly++) {
          for (let lx = wx - 1; lx <= wx + 1; lx++) {
            if (lx < 0 || lx >= map.width || ly < 0 || ly >= map.height) continue;
            const landTile = map.tiles[ly * map.width + lx];
            const landTerrain = TERRAIN[landTile.terrain];
            if (landTerrain.isWater || landTerrain.isDeepWater) continue;
            if (landTile.terrain === "mountains") continue;
            // Skip home landmasses — pioneer came from there
            if (homeLandmassIds.has(landTile.landmassId)) continue;
            // No stacking: skip a land tile another unit is already standing on
            if (Object.values(civs).some((c) => c.units.some((u) => !u.carriedBy && u.x === lx && u.y === ly))) continue;
            // Must be distant enough from all existing cities
            let tooClose = false;
            for (const c of Object.values(civs)) {
              for (const city of c.cities) {
                if (window.GameEngine.influence.chebyshev(lx, ly, city.x, city.y) < window.GameEngine.cities.MIN_CITY_SPACING) {
                  tooClose = true; break;
                }
              }
              if (tooClose) break;
            }
            if (tooClose) continue;
            const galleyDist = window.GameEngine.influence.chebyshev(galley.x, galley.y, wx, wy);
            // Grouped-invasion bias (see assessInvasionTarget): a huge penalty for
            // every landmass but the chosen target guarantees it wins whenever it's
            // reachable at all, while still falling back to any other foreign shore
            // if the target landmass has nowhere left to land this pass.
            const targetPenalty = (preferredLandmassId != null && landTile.landmassId !== preferredLandmassId) ? 1000 : 0;
            const score = -galleyDist + (landTile.resource ? 2 : 0) - targetPenalty;
            if (score > bestScore) { bestScore = score; best = { waterX: wx, waterY: wy, landX: lx, landY: ly }; }
          }
        }
      }
    }
    return best;
  }

  /**
   * Scans the entire map for the nearest water tile adjacent to land that is NOT
   * on any of this civ's home landmasses. Used by a loaded galley when no disembark
   * site is in range yet — keeps the galley heading purposefully toward new shores
   * instead of drifting or stopping when home-island water is all already visible.
   */
  function findForeignShore(civ, galley, map, preferredLandmassId = null) {
    const TERRAIN = window.GameData.TERRAIN;
    const homeLandmassIds = new Set();
    for (const city of civ.cities) {
      const ct = map.tiles[city.y * map.width + city.x];
      if (ct && ct.landmassId >= 0) homeLandmassIds.add(ct.landmassId);
    }
    let best = null, bestDist = Infinity;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y * map.width + x];
        if (!TERRAIN[tile.terrain].isWater) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
            const adj = map.tiles[ny * map.width + nx];
            if (TERRAIN[adj.terrain].isWater) continue;
            if (homeLandmassIds.has(adj.landmassId)) continue;
            // Grouped-invasion bias (see assessInvasionTarget/findDisembarkSite).
            const targetPenalty = (preferredLandmassId != null && adj.landmassId !== preferredLandmassId) ? 1000 : 0;
            const dist = window.GameEngine.influence.chebyshev(galley.x, galley.y, x, y) + targetPenalty;
            if (dist < bestDist) { bestDist = dist; best = { x, y }; }
          }
        }
      }
    }
    return best;
  }

  /**
   * Finds the nearest foreign-shore water tile adjacent to non-home land for
   * non-pioneer units (scouts, military). No city-spacing check — just any
   * foreign coast will do for a scouting/raiding landing.
   */
  function findScoutLandingSpot(civ, galley, map, civs, preferredLandmassId = null) {
    const TERRAIN = window.GameData.TERRAIN;
    const SEARCH = 30;
    const homeLandmassIds = new Set();
    for (const city of civ.cities) {
      const ct = map.tiles[city.y * map.width + city.x];
      if (ct && ct.landmassId >= 0) homeLandmassIds.add(ct.landmassId);
    }
    let best = null, bestScore = -Infinity;
    for (let dy = -SEARCH; dy <= SEARCH; dy++) {
      for (let dx = -SEARCH; dx <= SEARCH; dx++) {
        const wx = galley.x + dx, wy = galley.y + dy;
        if (wx < 0 || wx >= map.width || wy < 0 || wy >= map.height) continue;
        if (!TERRAIN[map.tiles[wy * map.width + wx].terrain].isWater) continue;
        for (let ly = wy - 1; ly <= wy + 1; ly++) {
          for (let lx = wx - 1; lx <= wx + 1; lx++) {
            if (lx < 0 || lx >= map.width || ly < 0 || ly >= map.height) continue;
            const landTile = map.tiles[ly * map.width + lx];
            const landTerrain = TERRAIN[landTile.terrain];
            if (landTerrain.isWater) continue;
            if (landTile.terrain === "mountains") continue;
            if (homeLandmassIds.has(landTile.landmassId)) continue;
            // No stacking: skip a land tile another unit is already standing on
            if (civs && Object.values(civs).some((c) => c.units.some((u) => !u.carriedBy && u.x === lx && u.y === ly))) continue;
            // Grouped-invasion bias (see assessInvasionTarget/findDisembarkSite).
            const targetPenalty = (preferredLandmassId != null && landTile.landmassId !== preferredLandmassId) ? 1000 : 0;
            const dist = window.GameEngine.influence.chebyshev(galley.x, galley.y, wx, wy);
            const score = -dist - targetPenalty;
            if (score > bestScore) { bestScore = score; best = { waterX: wx, waterY: wy, landX: lx, landY: ly }; }
          }
        }
      }
    }
    return best;
  }

  /**
   * Finds the nearest water tile within maxRadius of (ux, uy).
   * Falls back from findAdjacentWater for inland units so the galley still
   * navigates toward them even when they aren't standing on the coast yet.
   */
  function findNearestCoastalWaterFor(ux, uy, map, maxRadius = 15) {
    const adj = findAdjacentWater(ux, uy, map);
    if (adj) return adj;
    const TERRAIN = window.GameData.TERRAIN;
    let best = null, bestDist = Infinity;
    for (let dy = -maxRadius; dy <= maxRadius; dy++) {
      for (let dx = -maxRadius; dx <= maxRadius; dx++) {
        const nx = ux + dx, ny = uy + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (!TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) continue;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < bestDist) { bestDist = dist; best = { x: nx, y: ny }; }
      }
    }
    return best;
  }

  function findNearestWaterTile(unit, map) {
    const TERRAIN = window.GameData.TERRAIN;
    let best = null, bestDist = Infinity;
    for (let dy = -12; dy <= 12; dy++) {
      for (let dx = -12; dx <= 12; dx++) {
        const nx = unit.x + dx, ny = unit.y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (!TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) continue;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < bestDist) { bestDist = dist; best = { x: nx, y: ny }; }
      }
    }
    return best;
  }

  /**
   * BFS from the galley's position over water tiles only, same fix (and same
   * reason) as findNearestUnseenTile's land BFS: a raw radius-scan for the
   * nearest unseen water tile (the old implementation) has no idea whether
   * that tile is actually reachable by sea -- an enclosed bay/inlet with
   * unseen ocean on the far side of a landmass (common right at the map's
   * edge, where a disconnected pocket of water often sits right up against
   * the boundary) would get targeted every single call, with the galley
   * sailing to the closest approach its real pathfind could manage and
   * getting no closer on any later turn -- there was no stuck-detection at
   * all here, so this repeated forever. Restricting the candidate pool to
   * tiles actually reached by this BFS (real 8-directional water
   * connectivity, matching the terrain rule moveUnitToward's own cost
   * function uses for naval units) guarantees a target the galley can
   * actually make progress toward. The stuck-check below is still kept as a
   * defense-in-depth backstop for the one thing BFS reachability can't see
   * -- another ship currently occupying the only tile in a narrow strait.
   */
  function exploreWater(unit, gameState, log) {
    const { map, civs } = gameState;
    const TERRAIN = window.GameData.TERRAIN;
    const visible = gameState.visibility[unit.civId] || new Set();
    const w = map.width, h = map.height;

    const startIdx = unit.y * w + unit.x;
    const visited = new Set([startIdx]);
    const queue = [startIdx];
    let target = null;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const cx = cur % w, cy = Math.floor(cur / w);
      if (cur !== startIdx && !visible.has(cur)) { target = { x: cx, y: cy }; break; }
      if (visited.size > 500) break;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (visited.has(nIdx)) continue;
          if (!TERRAIN[map.tiles[nIdx].terrain].isWater) continue;
          visited.add(nIdx);
          queue.push(nIdx);
        }
      }
    }
    if (!target) return;

    // Target-agnostic stall check (see isUnitStalled) -- same reasoning as
    // exploreWith's identical fix: a same-target-required check can be
    // defeated by this BFS returning a different (but equally unreachable,
    // e.g. blocked by another ship in a narrow strait) nearest-unseen-water
    // tile every call.
    if (isUnitStalled(unit, "explore", EXPLORE_STALL_THRESHOLD)) {
      wanderUnitOnWater(unit, map, civs);
      unit.currentMission = "Stuck exploring open water — wandering to break free";
      return;
    }
    moveUnitToward(unit, target.x, target.y, map, civs);
  }

  // How long (consecutive explore calls) a unit can stay within EXPLORE_LOCAL_RADIUS
  // of where it was when it started this bout of local wandering before giving up
  // on the immediate area and committing to a genuinely distant destination instead.
  const EXPLORE_LOCAL_RADIUS = 4;
  const EXPLORE_GIVE_UP_TURNS = 6;
  // How many turns to keep heading toward a chosen far target once given up
  // on the local area, before reconsulting the nearest-unseen search again
  // regardless -- long enough to actually clear the old dead end's pull
  // (Scout movement 3/turn) rather than reverting after a single step.
  const EXPLORE_COMMIT_TURNS = 12;

  // Consecutive stalled turns (see isUnitStalled) before exploreWith gives
  // up on whatever it was doing THIS call, regardless of which of the 3
  // branches below was driving -- a plain, target-agnostic backstop that
  // replaced the old same-target-required check (2026-07-17, see
  // isUnitStalled's own doc for why that one could be defeated).
  const EXPLORE_STALL_THRESHOLD = 3;

  function exploreWith(unit, gameState, log) {
    const { map, civs } = gameState;
    const civ = civs[unit.civId];
    const doctrine = civ && window.GameEngine.strategy.getDoctrine(civ);
    const visible = gameState.visibility[unit.civId] || new Set();

    // Target-agnostic stall backstop, checked FIRST so it catches all 3
    // branches below equally (committed-far-target, local-dead-end give-
    // up, and ordinary nearest-unseen) -- any of them can pick a fresh-
    // looking target every turn while the unit makes zero real progress.
    if (isUnitStalled(unit, "explore", EXPLORE_STALL_THRESHOLD)) {
      unit._exploreCommitTurns = 0;
      unit._exploreFarX = null;
      unit._exploreAnchorX = null;
      unit._exploreLocalTurns = 0;
      wanderUnit(unit, map, civs);
      unit.currentMission = "Stuck exploring — wandering to break free";
      return;
    }

    // Committed to a far target from a previous give-up (see below) -- keep
    // heading there for a while rather than re-consulting the NEAREST-unseen
    // search every turn, which would just snap the unit right back to the
    // same nearby dead end after a single step toward the far target (the
    // pocket tiles are still much closer than anything the far search found).
    // Ends early if the far tile gets revealed along the way (success); the
    // turn budget is just a safety net for the unlikely case the far target
    // itself can't actually be closed the rest of the way for some reason.
    if (unit._exploreCommitTurns > 0 && unit._exploreFarX != null) {
      const targetIdx = unit._exploreFarY * map.width + unit._exploreFarX;
      if (!visible.has(targetIdx)) {
        unit._exploreCommitTurns--;
        moveUnitToward(unit, unit._exploreFarX, unit._exploreFarY, map, civs);
        unit.currentMission = `Heading to unexplored land near (${unit._exploreFarX},${unit._exploreFarY})`;
        return;
      }
      unit._exploreCommitTurns = 0; // revealed it -- resume the normal logic below
    }

    // A corner/dead-end pocket (e.g. a tundra nook at the map's edge) can
    // offer 2+ equally-near "unseen" tiles that findNearestUnseenTile's
    // random tie-break (see its `found` array below) keeps alternating
    // between forever -- the unit visits one, then the other becomes the
    // new nearest, then the first again, endlessly, without ever actually
    // revealing new ground (standing at either one's own vision radius
    // doesn't quite reach the rest of the pocket). The single-shot stuck
    // check further down only catches a unit fully blocked for one whole
    // turn (zero net movement) -- it can't see this slower oscillation at
    // all, since the unit's position legitimately changes every turn, just
    // never gets far from where it started. Tracked as "how many
    // consecutive calls has this unit stayed within a small radius of the
    // spot it was at when it started this bout" -- reset the moment it
    // actually gets clear of that radius (real progress).
    if (unit._exploreAnchorX == null ||
        window.GameEngine.influence.chebyshev(unit.x, unit.y, unit._exploreAnchorX, unit._exploreAnchorY) > EXPLORE_LOCAL_RADIUS) {
      unit._exploreAnchorX = unit.x;
      unit._exploreAnchorY = unit.y;
      unit._exploreLocalTurns = 0;
    } else {
      unit._exploreLocalTurns = (unit._exploreLocalTurns || 0) + 1;
    }

    if (unit._exploreLocalTurns >= EXPLORE_GIVE_UP_TURNS) {
      unit._exploreLocalTurns = 0;
      const farTarget = findFarUnseenTile(unit, gameState);
      if (farTarget) {
        unit._exploreFarX = farTarget.x;
        unit._exploreFarY = farTarget.y;
        unit._exploreCommitTurns = EXPLORE_COMMIT_TURNS;
        unit._exploreAnchorX = null; // re-anchor fresh once the commitment ends
        moveUnitToward(unit, farTarget.x, farTarget.y, map, civs);
        unit.currentMission = `Giving up on this dead end -- heading to unexplored land near (${farTarget.x},${farTarget.y})`;
        log.push(`${civ ? civ.id : unit.civId}'s ${unit.typeId} gives up exploring a local dead end, heads for (${farTarget.x},${farTarget.y})`);
        return;
      }
      // No far candidate either (e.g. the whole reachable landmass is
      // fully explored) -- fall through to the normal logic below, which
      // will find nothing too and just leave the unit be.
    }

    const target = findNearestUnseenTile(unit, gameState, doctrine && doctrine.macroGoal);
    if (!target) return;
    // Stuck detection now lives at the top of this function (isUnitStalled,
    // target-agnostic) -- getting here at all means the unit made real
    // progress last call, so this is a plain move, no per-branch check.
    moveUnitToward(unit, target.x, target.y, map, civs);
    unit.currentMission = `Exploring toward unseen territory near (${target.x},${target.y})`;
  }

  /** Like findNearestUnseenTile's land BFS, but returns one of the FARTHEST
   *  reachable unseen tiles instead of the nearest -- used when a unit has
   *  been locally stuck (see exploreWith's give-up threshold) so it commits
   *  to a genuinely different destination instead of re-picking whatever's
   *  merely closest, which is exactly what got it stuck in the first place.
   *  Same walkable-land-only reachability guarantee as the near-search. */
  function findFarUnseenTile(unit, gameState) {
    const { map } = gameState;
    const TERRAIN = window.GameData.TERRAIN;
    const visible = gameState.visibility[unit.civId] || new Set();
    const w = map.width, h = map.height;
    const startIdx = unit.y * w + unit.x;
    const visited = new Set([startIdx]);
    const queue = [startIdx];
    const farCandidates = [];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const cx = cur % w, cy = Math.floor(cur / w);
      if (!visible.has(cur)) farCandidates.push({ x: cx, y: cy });
      if (visited.size > 2000) break;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (visited.has(nIdx)) continue;
          const t = TERRAIN[map.tiles[nIdx].terrain];
          if (t.isWater || t.moveCostLand === window.GameData.IMPASSABLE) continue;
          visited.add(nIdx);
          queue.push(nIdx);
        }
      }
    }
    if (farCandidates.length === 0) return null;
    // BFS visits near-to-far, so the tail of the list is the farthest reached.
    const tail = farCandidates.slice(-8);
    return tail[Math.floor(Math.random() * tail.length)];
  }

  function findNearestUnseenTile(unit, gameState, macroGoal) {
    const { map, civs } = gameState;
    const TERRAIN = window.GameData.TERRAIN;
    const visible = gameState.visibility[unit.civId] || new Set();
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const isLandUnit = !baseUnit.isNaval;
    const w = map.width, h = map.height;

    if (isLandUnit) {
      // BFS from unit position: guarantees we only target tiles reachable by foot,
      // eliminating stuck-on-shore loops caused by water-blocked greedy routing.
      const startIdx = unit.y * w + unit.x;
      const visited = new Set([startIdx]);
      const queue = [startIdx];
      // Collect up to 4 equally-near candidates for random spread among units
      const found = [];
      let foundDist = -1;
      let head = 0;
      while (head < queue.length) {
        const cur = queue[head++];
        const cx = cur % w, cy = Math.floor(cur / w);
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, cx, cy);
        if (!visible.has(cur)) {
          if (foundDist < 0) foundDist = dist;
          if (dist <= foundDist + 1) found.push({ x: cx, y: cy });
          if (found.length >= 4) break;
        }
        if (visited.size > 500) break;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const nIdx = ny * w + nx;
            if (visited.has(nIdx)) continue;
            const t = TERRAIN[map.tiles[nIdx].terrain];
            if (t.isWater || t.moveCostLand === window.GameData.IMPASSABLE) continue;
            visited.add(nIdx);
            queue.push(nIdx);
          }
        }
      }
      if (found.length === 0) return null;
      if (found.length === 1 || !macroGoal || macroGoal === "consolidate") {
        return found[Math.floor(Math.random() * found.length)];
      }
      // Grand-strategy tie-break among equally-near frontier tiles (engine/strategy.js):
      // "conquest" civs scout toward currently-visible enemy presence (never cheats
      // fog of war -- same visible-only convention as huntNearestEnemy); "expand"
      // civs scout away from their own cities, toward virgin land.
      const civ = civs[unit.civId];
      if (macroGoal === "conquest" && civ) {
        const enemyTiles = [];
        for (const other of Object.values(civs)) {
          if (other.id === civ.id || other.eliminated) continue;
          for (const eu of other.units) if (visible.has(eu.y * w + eu.x) && !eu.conditions?.hidden) enemyTiles.push(eu);
          for (const ec of other.cities) if (visible.has(ec.y * w + ec.x)) enemyTiles.push(ec);
        }
        if (enemyTiles.length > 0) {
          found.sort((a, b) => {
            const da = Math.min(...enemyTiles.map((e) => window.GameEngine.influence.chebyshev(a.x, a.y, e.x, e.y)));
            const db = Math.min(...enemyTiles.map((e) => window.GameEngine.influence.chebyshev(b.x, b.y, e.x, e.y)));
            return da - db;
          });
          return found[0];
        }
      } else if (macroGoal === "expand" && civ && civ.cities.length > 0) {
        found.sort((a, b) => {
          const da = Math.min(...civ.cities.map((c) => window.GameEngine.influence.chebyshev(a.x, a.y, c.x, c.y)));
          const db = Math.min(...civ.cities.map((c) => window.GameEngine.influence.chebyshev(b.x, b.y, c.x, c.y)));
          return db - da; // farthest own city first -> unclaimed frontier
        });
        return found[0];
      }
      return found[Math.floor(Math.random() * found.length)];
    }

    // Naval units: scored search (water tiles only)
    let best = null, bestScore = Infinity;
    const SEARCH = 15;
    for (let dy = -SEARCH; dy <= SEARCH; dy++) {
      for (let dx = -SEARCH; dx <= SEARCH; dx++) {
        const x = unit.x + dx, y = unit.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const idx = y * map.width + x;
        if (visible.has(idx)) continue;
        if (!TERRAIN[map.tiles[idx].terrain].isWater) continue;
        const score = window.GameEngine.influence.chebyshev(unit.x, unit.y, x, y) + Math.random() * 2;
        if (score < bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    return best;
  }

  function maybeEmbarkSettlersOnGalleys(civ, gameState, log) {
    const { map, civs } = gameState;
    const TERRAIN = window.GameData.TERRAIN;
    // For each idle pioneer not being carried, move it toward the nearest galley's boarding
    // position (land tile adjacent to galley water tile) when naval expansion is warranted.
    const galleys = civ.units.filter((u) => u.typeId === "galley" && !u.carries);
    const pioneers = civ.units.filter((u) => u.typeId === "pioneer" && !u.carriedBy && !u.usedThisTurn);
    // Tech-tree city gate awareness (see maybeFoundCity/chooseStrategy) -- a
    // pioneer with a good land site should keep settling locally rather than
    // embarking, as long as a tech is still blocked purely on city count.
    const gatedLayer = window.GameEngine.tech.nextGatedTechLayer(civ);
    const cityGateShortfall = gatedLayer !== null ? Math.max(0, gatedLayer - civ.cities.length) : 0;
    for (const pioneer of pioneers) {
      // Embark if: pioneer has no land candidate, OR the civ already has ≥2 cities
      // on this landmass and wants to expand by sea.
      const pioneerTile = map.tiles[pioneer.y * map.width + pioneer.x];
      const pioneerLandmassId = pioneerTile ? pioneerTile.landmassId : -1;
      const citiesOnLandmass = civ.cities.filter(c => {
        const ct = map.tiles[c.y * map.width + c.x];
        return ct && ct.landmassId === pioneerLandmassId;
      }).length;
      const candidate = findBestSettleSite(civ, gameState, pioneer);
      const hasLandCandidate = candidate &&
        !TERRAIN[map.tiles[candidate.y * map.width + candidate.x].terrain].isWater;
      // Skip (continue settling by land) if there's a land site AND either the
      // civ hasn't yet built up enough presence to justify naval expansion, OR
      // a tech is still gated purely on city count (that need always wins).
      if (hasLandCandidate && (citiesOnLandmass < 2 || cityGateShortfall > 0)) continue;

      // Find nearest galley on a water tile — allow any distance so galley can navigate
      // toward pioneer even from far away (operateGalley handles the galley side)
      let nearestGalley = null, nearestDist = Infinity;
      for (const galley of galleys) {
        const galleyTile = map.tiles[galley.y * map.width + galley.x];
        if (!TERRAIN[galleyTile.terrain].isWater) continue;
        const dist = window.GameEngine.influence.chebyshev(pioneer.x, pioneer.y, galley.x, galley.y);
        if (dist < nearestDist) { nearestDist = dist; nearestGalley = galley; }
      }
      if (!nearestGalley) continue;

      // Find the land tile adjacent to the galley that is CLOSEST to the pioneer,
      // so the pioneer walks the shortest path to board (not always the NW tile).
      let boardingTile = null, boardingDist = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = nearestGalley.x + dx, ny = nearestGalley.y + dy;
          if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
          const t = TERRAIN[map.tiles[ny * map.width + nx].terrain];
          if (!t.isWater && t.moveCostLand !== window.GameData.IMPASSABLE) {
            const d = window.GameEngine.influence.chebyshev(pioneer.x, pioneer.y, nx, ny);
            if (d < boardingDist) { boardingDist = d; boardingTile = { x: nx, y: ny }; }
          }
        }
      }
      if (!boardingTile) continue;

      if (pioneer.x === boardingTile.x && pioneer.y === boardingTile.y) {
        // Pioneer is at boarding position — operateGalley will board them next turn
        // when it scans adjacent land tiles for waiting pioneers
        pioneer.currentMission = `Waiting to board a galley at (${nearestGalley.x},${nearestGalley.y})`;
      } else {
        moveUnitToward(pioneer, boardingTile.x, boardingTile.y, map, civs);
        pioneer.usedThisTurn = true;
        pioneer.currentMission = `Heading to board a galley at (${nearestGalley.x},${nearestGalley.y})`;
      }
    }
  }

  // Max distance to an enemy worth reasoning about Hidden over (see
  // maybeHalfellowStealthPlay). Hidden movement is only ~34% of normal (see
  // moveUnitToward), so an ambush target more than a couple tiles away would
  // likely wander off or close the gap on its own terms long before a Hidden
  // Halfellow unit could ever catch up.
  const HALFELLOW_STEALTH_RANGE = 2;

  /**
   * Halfellow "fight smarter, not harder": before the normal attack/explore/
   * garrison cascade runs, weighs going Hidden instead of fighting outright.
   * Two triggers, both gated on Sneaking Around being researched:
   *
   *   DEFENSIVE -- an enemy is closing in (within stealth range, but not yet
   *   adjacent -- canGoHidden already forbids activating with an enemy
   *   already adjacent, so this has to fire BEFORE that happens) and we'd
   *   probably lose a straight fight: vanish before it arrives instead of
   *   trading blows. Militarism (which itself rises with completed Halfellow
   *   military techs -- see effectiveMilitarism) makes this less
   *   trigger-happy: a more capable/confident civ risks the fight instead of
   *   retreating.
   *
   *   OFFENSIVE AMBUSH -- only worth setting up once A Knife in the Dark is
   *   researched (that 166% hidden-attack bonus is the entire payoff): if a
   *   nearby enemy is too strong to beat head-on, go Hidden this turn and
   *   let the normal attack/hunt cascade close in and strike on a later turn
   *   while still Hidden (Knife in the Dark's bonus applies automatically
   *   via effectiveAttack once that attack happens -- no extra plumbing
   *   needed here). Multi-unit bait-and-ambush: when several Halfellow units
   *   are near the same target, the single STRONGEST one stays visible as
   *   bait (returns false, falls through to normal behavior) while its
   *   weaker companions are the ones who actually vanish and spring the trap.
   *
   * Returns true if it consumed the unit's turn (it went Hidden this turn).
   */
  function maybeHalfellowStealthPlay(civ, unit, gameState, weights, difficulty, log) {
    if (civ.raceId !== "halfellow") return false;
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("sneaking_around")) return false;
    if (!window.GameEngine.combat.canGoHidden(unit, civ, gameState.civs)) return false;

    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const militarism = effectiveMilitarism(civ);

    let nearest = null, nearestDist = Infinity;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.conditions?.hidden) continue;
        const idx = eu.y * map.width + eu.x;
        if (!visible.has(idx)) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y);
        if (dist > HALFELLOW_STEALTH_RANGE) continue;
        if (dist < nearestDist) { nearestDist = dist; nearest = eu; }
      }
    }
    if (!nearest) return false;
    const enemyCiv = civs[nearest.civId];

    const winProb = estimateWinProbability(unit, nearest, civs, {}, 20);
    const threshold = minAcceptableWinProbability(civ);

    if (nearestDist === 2 && winProb < threshold * (1 - militarism * 0.5)) {
      window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
      unit.usedThisTurn = true;
      unit.currentMission = `Going hidden — outmatched by ${enemyCiv.id}'s ${nearest.typeId} nearby`;
      log.push(`Stealth: ${civ.id}'s ${unit.typeId} goes hidden defensively at (${unit.x},${unit.y})`);
      return true;
    }

    if (civ.unlockedMechanics.has("knife_in_the_dark") && winProb < threshold) {
      const alliesNearby = civ.units.filter((u) =>
        u !== unit && !u.carriedBy && window.GameData.getUnit(u.typeId).category === "military"
        && window.GameEngine.influence.chebyshev(u.x, u.y, nearest.x, nearest.y) <= HALFELLOW_STEALTH_RANGE);
      const myPower = unitCombatPower(unit, civ);
      const isStrongestNearby = alliesNearby.every((u) => unitCombatPower(u, civ) <= myPower);
      if (alliesNearby.length > 0 && isStrongestNearby) {
        unit.currentMission = `Holding as bait near ${enemyCiv.id}'s ${nearest.typeId} at (${nearest.x},${nearest.y})`;
        return false;
      }

      window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
      unit.usedThisTurn = true;
      unit.currentMission = `Going hidden — setting up an ambush on ${enemyCiv.id}'s ${nearest.typeId}`;
      log.push(`Stealth: ${civ.id}'s ${unit.typeId} goes hidden to ambush ${enemyCiv.id}'s ${nearest.typeId} near (${unit.x},${unit.y})`);
      return true;
    }

    return false;
  }

  /**
   * Human "Fireball!": how many additional enemy units/structures adjacent to
   * (x,y) would also take splash damage if this tile's occupant became the
   * primary attack target -- mirrors combat.js's applySplashDamage exactly
   * (same 8-neighbor scan, same "any civ but the attacker" rule), but only
   * counts eligible targets rather than dealing damage, since this runs
   * during target SELECTION, before an attack is committed to. Used to bias
   * considerAttackOrGarrison's target scoring toward clustered enemies --
   * without this, a Wizard with Fireball researched picks a target purely on
   * win probability, the same as any other unit, and the tech's whole point
   * (free splash damage) never factors into which fight it actually starts.
   */
  function countSplashTargets(x, y, civs, attackerCivId, gameState) {
    const { map } = gameState;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        for (const otherCiv of Object.values(civs)) {
          if (otherCiv.id === attackerCivId || otherCiv.eliminated) continue;
          if (otherCiv.units.some((u) => u.x === nx && u.y === ny)) count++;
        }
        const struct = window.GameEngine.cities.findStructureAt(gameState, nx, ny);
        if (struct && struct.civ.id !== attackerCivId) count++;
      }
    }
    return count;
  }

  // Score bonus per extra splash-eligible target -- see countSplashTargets.
  // Target score elsewhere in considerAttackOrGarrison runs roughly 0-20+
  // (winProb * 20 * weights.attack), so this is enough to swing target
  // selection toward a clustered enemy over a modestly-better-odds isolated
  // one, without ever overriding the below-threshold suppression (applied
  // after this bonus, not before -- see considerAttackOrGarrison).
  const FIREBALL_SPLASH_TARGET_BONUS = 3;

  // Score bonus for an uncarried Galley targeting an enemy Galley over any
  // other candidate -- see considerAttackOrGarrison. Deliberately large
  // relative to the ~0-20+ base score range so sea control reliably wins out
  // over a marginally-better-odds land target, without overriding the
  // below-threshold suppression (still applied after this bonus).
  const GALLEY_VS_GALLEY_BONUS = 12;

  // Score bonus PER OTHER Ranger ally that can also currently reach the same
  // candidate target -- see considerAttackOrGarrison's Ranger volley bonus.
  // Smaller per-instance than GALLEY_VS_GALLEY_BONUS since it stacks (2
  // siblings sharing a target already outweighs almost anything else in the
  // 0-20-ish base score range).
  const RANGER_VOLLEY_BONUS = 6;

  /** How many of `civ`'s OTHER (not-yet-acted, uncarried) Rangers can
   *  currently reach `target` -- same range/line-of-sight rules
   *  considerAttackOrGarrison itself uses for `unit`, just re-checked per
   *  candidate sibling. See RANGER_VOLLEY_BONUS above. */
  function countAlliedRangersInRange(civ, unit, target, gameState) {
    const { map } = gameState;
    let count = 0;
    for (const ally of civ.units) {
      if (ally === unit || ally.typeId !== "ranger" || ally.usedThisTurn || ally.carriedBy) continue;
      const allyRange = window.GameEngine.combat.effectiveRange(ally, civ);
      const dist = window.GameEngine.influence.chebyshev(ally.x, ally.y, target.x, target.y);
      if (dist > allyRange) continue;
      if (dist > 1 && !hasRangedLineOfSight(map, ally.x, ally.y, target.x, target.y)) continue;
      count++;
    }
    return count;
  }

  /** Is this unit standing in one of its own civ's cities, or on one of its own structures? */
  function isGarrisoned(unit, civ) {
    return civ.cities.some((c) =>
      (c.x === unit.x && c.y === unit.y) || c.structures.some((s) => s.x === unit.x && s.y === unit.y));
  }

  function considerAttackOrGarrison(civ, unit, gameState, weights, difficulty, log) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const range = window.GameEngine.combat.effectiveRange(unit, civ);

    let bestTarget = null, bestScore = -Infinity, bestCoalitionShift = 0, bestWinProb = 0;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const enemyUnit of otherCiv.units) {
        const idx = enemyUnit.y * map.width + enemyUnit.x;
        if (!visible.has(idx) || enemyUnit.conditions?.hidden) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, enemyUnit.x, enemyUnit.y);
        if (dist > range) continue;
        if (dist > 1) {
          // Ranged: doesn't need to physically reach the target (see units.js's
          // range property doc) -- a clear line matters instead, not footpath
          // reachability.
          if (!hasRangedLineOfSight(map, unit.x, unit.y, enemyUnit.x, enemyUnit.y)) continue;
        } else if (!canReachByLand(unit.x, unit.y, enemyUnit.x, enemyUnit.y, map, 150, unit)) {
          // Skip enemies that can't be reached on foot (across water or mountains)
          continue;
        }

        const soloWinProb = estimateWinProbability(unit, enemyUnit, civs, {}, 20);

        // Coalition awareness: nearby allies on both sides shift the real odds
        // beyond this single 1v1 matchup. `coalitionRatio` is a crude power-ratio
        // read of the whole local fight (us + our backup vs. them + their backup).
        // We blend the accurate 1v1 simulation toward that cruder-but-broader read,
        // weighted by how much backup is actually in play (`allyInfluence` -- zero
        // when neither side has nearby allies, so the result is then identical to
        // the old pure-1v1 behavior) and by `militarism`, which gates how much a
        // civ's units actually reason about allies at all: low-militarism races
        // stay ally-blind and fight purely on their own 1v1 odds.
        const defenderCiv = otherCiv;
        const ownPower = unitCombatPower(unit, civ);
        const targetPower = unitCombatPower(enemyUnit, defenderCiv);
        const friendlyAllyPower = nearbyMilitaryPower(civ, enemyUnit.x, enemyUnit.y, SUPPORT_RADIUS, unit);
        const enemyAllyPower = nearbyMilitaryPower(defenderCiv, enemyUnit.x, enemyUnit.y, SUPPORT_RADIUS, enemyUnit);
        const basePower = ownPower + targetPower;
        const coalitionRatio = (ownPower + friendlyAllyPower) /
          Math.max(1e-6, ownPower + friendlyAllyPower + targetPower + enemyAllyPower);
        const allyInfluence = basePower > 0
          ? Math.min(1, (friendlyAllyPower + enemyAllyPower) / basePower) : 0;
        const militarism = effectiveMilitarism(civ);
        const blendWeight = militarism * allyInfluence;
        const winProb = Math.max(0, Math.min(1, soloWinProb * (1 - blendWeight) + coalitionRatio * blendWeight));
        const coalitionShift = winProb - soloWinProb; // for the log message below

        const threshold = minAcceptableWinProbability(civ);
        let score = winProb * 20 * (weights.attack || 1.0);
        // Human "Fireball!": prefer a target clustered with other enemies --
        // see countSplashTargets. Added before the below-threshold suppression
        // so a genuinely bad matchup still gets suppressed even if it happens
        // to be well-clustered.
        if (unit.typeId === "wizard" && civ.unlockedMechanics && civ.unlockedMechanics.has("fireball_splash")) {
          score += countSplashTargets(enemyUnit.x, enemyUnit.y, civs, civ.id, gameState) * FIREBALL_SPLASH_TARGET_BONUS;
        }
        // Galley vs Galley (user-directed): an uncarried Galley prefers
        // fighting an enemy Galley over any other target -- sea control
        // takes priority over land skirmishes when it's actually free to
        // pursue one. A Galley currently ferrying cargo gets no such bonus
        // (still defends itself normally via the general scoring above, but
        // never goes out of its way to pick a galley fight while carrying).
        if (unit.typeId === "galley" && !unit.carries && enemyUnit.typeId === "galley") {
          score += GALLEY_VS_GALLEY_BONUS;
        }
        // Elf Ranger volley (2026-07-18, user-directed): prefer a target
        // multiple OTHER Ranger allies can ALSO currently reach right now.
        // Every Ranger scores candidates with this exact same bonus, so
        // (without any explicit multi-unit coordination) they tend to
        // converge on whichever shared target scores highest across the
        // whole pack -- several simultaneous ranged hits landing on one
        // enemy this same civ-turn, burning it down fast instead of each
        // Ranger picking its own separate target.
        if (unit.typeId === "ranger") {
          score += countAlliedRangersInRange(civ, unit, enemyUnit, gameState) * RANGER_VOLLEY_BONUS;
        }
        if (winProb < threshold) score *= 0.1; // heavily suppressed, not zeroed
        score = applyDifficultyNoise(score, difficulty);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = enemyUnit;
          bestCoalitionShift = coalitionShift;
          bestWinProb = winProb;
        }
      }
    }

    if (bestTarget && bestScore > 5) {
      const defenderCiv = civs[bestTarget.civId];
      const combatContext = {
        attackerGarrisoned: isGarrisoned(unit, civ),
        defenderGarrisoned: isGarrisoned(bestTarget, defenderCiv),
        // Halfellow "High Ground": which side (if either) is standing on Hills.
        attackerOnHills: map.tiles[unit.y * map.width + unit.x].terrain === "hills",
        defenderOnHills: map.tiles[bestTarget.y * map.width + bestTarget.x].terrain === "hills",
        // Elf "Sanctuary under Green Boughs": which side (if either) is
        // standing in Forest -- see combat.js's effectiveDefense.
        attackerInForest: map.tiles[unit.y * map.width + unit.x].terrain === "forest",
        defenderInForest: map.tiles[bestTarget.y * map.width + bestTarget.x].terrain === "forest",
      };
      window.GameEngine.quips.maybeQuip(unit, civ, "attack", gameState);
      const result = window.GameEngine.combat.resolveRound(unit, bestTarget, civs, combatContext);
      window.GameEngine.combat.recordCombatEvent({
        ax: unit.x, ay: unit.y, atkUnit: unit,
        dx: bestTarget.x, dy: bestTarget.y, defUnit: bestTarget,
      });
      // Hidden: attacking reveals the attacker, regardless of target type.
      window.GameEngine.combat.revealHidden(unit, currentTurnNumber);
      log.push(`Attack: ${civ.id}'s ${unit.typeId} vs ${bestTarget.civId}'s ${bestTarget.typeId} -> ` +
        `${result.returnSkipped ? "first strike" : result.fullNegated ? "negated" : result.fullMissed ? "missed (flying)" : result.fullDamage + " dmg"}` +
        (result.forwardSkipped ? ", attacker killed before landing a hit"
          : result.counterOutOfRange ? ", ranged (defender out of counter range)"
          : result.counterDenied ? ", counter denied (first strike)"
          : result.counterMissed ? ", counter missed (flying)"
          : result.counterNegated ? ", counter negated" : `, ${result.counterDamage} counter`) +
        (Math.abs(bestCoalitionShift) > 0.1
          ? ` [odds ${Math.round(bestWinProb * 100)}%, ${bestCoalitionShift > 0 ? "emboldened" : "wary"} by allies]`
          : ""));

      // Human "Fireball!": Wizard splash damage to everything adjacent to the target
      if (unit.typeId === "wizard" && civ.unlockedMechanics && civ.unlockedMechanics.has("fireball_splash")) {
        const hits = window.GameEngine.combat.applySplashDamage(unit, civ, bestTarget.x, bestTarget.y, gameState);
        if (hits.length) log.push(`Fireball splash: ${hits.length} additional target(s) hit`);
      }

      // Orc curse abilities: Bog Witch's death-curse and Malefic Malediction's
      // curse-on-any-hit.
      applyOrcCombatMechanics(unit, civ, bestTarget, defenderCiv, result, gameState);

      // Elf "First Frost of Autumn": passive chance to Freeze on any landed hit.
      applyElfCombatMechanics(unit, civ, bestTarget, defenderCiv, result, gameState);

      if (bestTarget.hp <= 0) {
        otherCivRemoveDeadUnit(civs, bestTarget);
        maybeRaiseDead(civ, unit, bestTarget, civs);
        // Orc "Hound and Hunter": a defending Wolf Rider's death may spawn
        // its replacement on its own now-vacated tile.
        if (bestTarget.typeId === "wolf_rider" && defenderCiv.unlockedMechanics
            && defenderCiv.unlockedMechanics.has("hound_and_hunter")) {
          const replacement = window.GameEngine.combat.maybeSpawnHoundAndHunter(defenderCiv, bestTarget.x, bestTarget.y, map);
          if (replacement) log.push(`Hound and Hunter: ${defenderCiv.id}'s fallen Wolf Rider is replaced by a ${replacement.typeId} at (${replacement.x},${replacement.y})`);
        }
        // Anti-Titan learning: the defeated civ just lost a unit TO a Titan.
        if (unit.typeId === "runeforged_titan") maybeLearnAntiTitanLesson(defenderCiv);
        // Orc "Honor the Dead": the defeated civ's OWN loss grants them lore,
        // regardless of who defeated them.
        if (defenderCiv.deathLoreBonus) {
          defenderCiv.stockpile = defenderCiv.stockpile || { harvest: 0, coin: 0, lore: 0 };
          defenderCiv.stockpile.lore = (defenderCiv.stockpile.lore || 0) + defenderCiv.deathLoreBonus;
        }
        // Orc Dragon Riders (and any other carrier): a defeated carrier
        // drops its passenger onto its own tile instead of taking it down
        // with it -- unless that tile is impassable for the passenger
        // (e.g. a sunk Galley's open-ocean tile), in which case the
        // passenger dies too rather than being stranded there forever.
        if (bestTarget.carries) {
          dropCargoOrKill(bestTarget.carries, bestTarget.x, bestTarget.y, gameState, log);
          bestTarget.carries = null;
        }
        const attackerRace = window.GameData.getRace(civ.raceId);
        // Undead heal on kill
        if (attackerRace.healOnKillPct && unit.hp > 0) {
          const beforeKillHeal = unit.hp;
          unit.hp = Math.min(unit.maxHp, unit.hp + Math.round(unit.maxHp * attackerRace.healOnKillPct / 100));
          window.GameEngine.floatingText.spawnHealGain(unit, unit.hp - beforeKillHeal);
        }
        // Orc plunder on kill: stockpile bonus (tech "Spoils of War" bonus)
        if (civ.raidKillBonus) {
          civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
          const bonus = civ.raidKillBonus || {};
          for (const k of ["harvest", "coin", "lore"]) {
            civ.stockpile[k] = (civ.stockpile[k] || 0) + (bonus[k] || 0);
          }
        }
      }
      if (unit.hp <= 0) {
        // Anti-Titan learning: this civ just lost a unit attacking a Titan
        // and taking its counter -- same lesson, opposite direction.
        if (bestTarget.typeId === "runeforged_titan") maybeLearnAntiTitanLesson(civ);
        // Orc "Honor the Dead": the attacker's OWN death also grants their civ lore.
        if (civ.deathLoreBonus) {
          civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
          civ.stockpile.lore = (civ.stockpile.lore || 0) + civ.deathLoreBonus;
        }
        if (unit.carries) {
          dropCargoOrKill(unit.carries, unit.x, unit.y, gameState, log);
          unit.carries = null;
        }
        // Orc "Hound and Hunter": same replacement chance, this time for the
        // attacker's own Wolf Rider dying to a counter.
        if (unit.typeId === "wolf_rider" && civ.unlockedMechanics && civ.unlockedMechanics.has("hound_and_hunter")) {
          const replacement = window.GameEngine.combat.maybeSpawnHoundAndHunter(civ, unit.x, unit.y, map);
          if (replacement) log.push(`Hound and Hunter: ${civ.id}'s fallen Wolf Rider is replaced by a ${replacement.typeId} at (${replacement.x},${replacement.y})`);
        }
        otherCivRemoveDeadUnit(civs, unit);
      }

      // Veteran leveling: XP for both sides based on what actually happened
      // this exchange (see combat.js's LEVELING section) -- a dead unit
      // doesn't bother leveling, there's nothing left to spend it on.
      if (unit.hp > 0) {
        grantXPAndAutoLevel(unit, civ, window.GameEngine.combat.xpForCombatAction(
          { damage: result.fullDamage, killedUnitTypeId: bestTarget.hp <= 0 ? bestTarget.typeId : null }));
      }
      if (bestTarget.hp > 0) {
        grantXPAndAutoLevel(bestTarget, defenderCiv, window.GameEngine.combat.xpForCombatAction(
          { damage: result.counterDamage, killedUnitTypeId: unit.hp <= 0 ? unit.typeId : null }));
      }

      unit.usedThisTurn = true;
      unit.currentMission = unit.hp > 0
        ? `Attacking an enemy ${bestTarget.typeId} at (${bestTarget.x},${bestTarget.y})`
        : "Fallen in battle";
      return true;
    }

    // No worthwhile unit fight — consider attacking an ungarrisoned enemy
    // CITY directly, within this unit's range (destroys it outright at level
    // 1, otherwise knocks it down a level -- see combat.js attackCity), or
    // razing a structure to strip its influence/economy bonus. Both require
    // the target tile to have no defender -- the garrison must be dealt with
    // first via the normal unit-targeting pass above. A city is scored well
    // above any single structure (it's the whole influence source, not one
    // multiplier), tempered by its win probability so a civ doesn't throw
    // itself against a fortress it can't crack; siege-property units and
    // civ-wide siege tech both raise that probability via effectiveAttack's
    // isSiege context (the same mechanism attackStructure already uses) --
    // but only when actually adjacent (see cityAttackWinProbability): a
    // Ranged attack from further away never gets the siege boost.
    let bestCity = null, bestCityScore = -Infinity, bestCityWinProb = 0;
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (dx === 0 && dy === 0) continue;
        const cx = unit.x + dx, cy = unit.y + dy;
        if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) continue;
        if (!visible.has(cy * map.width + cx)) continue;
        const cityDist = Math.max(Math.abs(dx), Math.abs(dy));
        if (cityDist > 1 && !hasRangedLineOfSight(map, unit.x, unit.y, cx, cy)) continue;
        for (const otherCiv of Object.values(civs)) {
          if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
          const targetCity = otherCiv.cities.find((c) => c.x === cx && c.y === cy);
          if (!targetCity) continue;
          const garrisonPresent = Object.values(civs).some((oc) =>
            oc.units.some((u) => u.x === cx && u.y === cy && !u.conditions?.hidden));
          if (garrisonPresent) continue; // defender intercepts -- city is safe for now
          const winProb = window.GameEngine.combat.cityAttackWinProbability(unit, targetCity, civ);
          const level = Math.floor(targetCity.population);
          let score = winProb * 50 * (weights.attack || 1.0) + level * 5;
          if (winProb < minAcceptableWinProbability(civ)) score *= 0.1; // heavily suppressed, not zeroed
          if (score > bestCityScore) {
            bestCityScore = score; bestCityWinProb = winProb;
            bestCity = { city: targetCity, civ: otherCiv };
          }
        }
      }
    }

    let bestStruct = null, bestStructScore = -Infinity;
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (dx === 0 && dy === 0) continue;
        const sx = unit.x + dx, sy = unit.y + dy;
        if (sx < 0 || sx >= map.width || sy < 0 || sy >= map.height) continue;
        if (!visible.has(sy * map.width + sx)) continue;
        const structDist = Math.max(Math.abs(dx), Math.abs(dy));
        if (structDist > 1 && !hasRangedLineOfSight(map, unit.x, unit.y, sx, sy)) continue;
        const s = window.GameEngine.cities.findStructureAt(gameState, sx, sy);
        if (!s || s.civ.id === civ.id) continue;
        const garrisonPresent = Object.values(civs).some((oc) =>
          oc.id === s.civ.id && oc.units.some((u) => u.x === sx && u.y === sy && !u.conditions?.hidden));
        if (garrisonPresent) continue; // defender intercepts -- structure is safe for now
        const b = s.building;
        // Walls block this unit's path to the city (see isEnemyStructureBlockingTile) --
        // conceptually the obstacle standing between it and its actual goal,
        // so they're worth breaking through even though they grant no
        // influence/radius bonus of their own (which is all a "boring"
        // ordinary structure would otherwise score on).
        const val = (b.influenceMult ? (b.influenceMult - 1) * 40 : 0)
          + (b.radiusBonus ? b.radiusBonus * 8 : 0) + 4 + (b.isWall ? 8 : 0);
        if (val > bestStructScore) { bestStructScore = val; bestStruct = { s, x: sx, y: sy }; }
      }
    }

    if (bestCity && bestCityScore >= bestStructScore) {
      window.GameEngine.quips.maybeQuip(unit, civ, "attack", gameState);
      const result = window.GameEngine.combat.attackCity(unit, bestCity.city, civ, bestCity.civ, gameState);
      window.GameEngine.combat.recordCombatEvent({
        ax: unit.x, ay: unit.y, atkUnit: unit,
        dx: bestCity.city.x, dy: bestCity.city.y, defUnit: null,
      });
      // Hidden: attacking reveals the attacker, regardless of target type.
      window.GameEngine.combat.revealHidden(unit, currentTurnNumber);
      if (result.counterDamage) {
        log.push(`Rouse the People: ${bestCity.civ.id}'s city struck back at ${civ.id}'s ${unit.typeId} for ${result.counterDamage}`);
      }
      if (result.militiaSpawned) {
        log.push(`Rouse the People: ${bestCity.civ.id} raised a Militia to defend at (${result.militiaSpawned.x},${result.militiaSpawned.y})`);
      }
      if (result.destroyed) {
        // Dwarf "The Long Reckoning": losing a CITY (not a wall) permanently
        // marks the attacker as a rival -- no-op unless bestCity.civ actually
        // has the mechanic unlocked (see combat.js's markRival).
        window.GameEngine.combat.markRival(bestCity.civ, civ.id);
        // Rouse the People: a much bigger (15%) militia-spawn chance
        // specifically on actual destruction, on top of the 1% chance
        // already rolled (via result.militiaSpawned) just for being attacked.
        // Must roll before destroyCity, which clears the tile entirely.
        if (bestCity.civ.unlockedMechanics && bestCity.civ.unlockedMechanics.has("rouse_the_people")) {
          const razeSpawn = window.GameEngine.combat.maybeSpawnMilitia(
            bestCity.civ, bestCity.city.x, bestCity.city.y, map, civs, 0.15);
          if (razeSpawn) log.push(`Rouse the People: ${bestCity.civ.id} raised a Militia from the ashes at (${razeSpawn.x},${razeSpawn.y})`);
        }
        window.GameEngine.cities.destroyCity(gameState, bestCity.civ, bestCity.city);
        log.push(`Siege: ${civ.id}'s ${unit.typeId} razed ${bestCity.civ.id}'s city to the ground!`);
        if (bestCity.civ.hasFoundedCity && bestCity.civ.cities.length === 0 && !bestCity.civ.eliminated) {
          window.GameEngine.turns.eliminateCiv(gameState, bestCity.civ);
          log.push(`${bestCity.civ.id} has been eliminated!`);
        }
        unit.currentMission = `Razed ${bestCity.civ.id}'s city to the ground`;
      } else if (result.won) {
        log.push(`Siege: ${civ.id}'s ${unit.typeId} breached ${bestCity.civ.id}'s city, knocking it to level ${Math.floor(bestCity.city.population)}`);
        unit.currentMission = `Besieging ${bestCity.civ.id}'s city at (${bestCity.city.x},${bestCity.city.y})`;
      } else {
        log.push(`Siege: ${civ.id}'s ${unit.typeId} failed to breach ${bestCity.civ.id}'s city (${Math.round(bestCityWinProb * 100)}% odds)`);
        unit.currentMission = `Besieging ${bestCity.civ.id}'s city at (${bestCity.city.x},${bestCity.city.y})`;
      }
      unit.usedThisTurn = true;
      // Veteran leveling: no per-hit damage number for a city siege (it's a
      // probabilistic level-knockdown, not HP attrition -- see combat.js's
      // attackCity), so XP is a flat participation/won/destroyed scale
      // instead of xpForCombatAction's damage-based formula.
      if (unit.hp > 0) {
        let cityXP = window.GameEngine.combat.xpForCombatAction({});
        if (result.won) cityXP += 5;
        if (result.destroyed) cityXP += 9;
        grantXPAndAutoLevel(unit, civ, cityXP);
      }
      // Rouse the People: the attacker itself can now die to a structure's
      // counterattack -- a real exception to "structures never counterattack."
      if (unit.hp <= 0) {
        // Orc "Hound and Hunter": same replacement chance as any other
        // Wolf Rider death, this time slain by a city's own counterattack.
        if (unit.typeId === "wolf_rider" && civ.unlockedMechanics && civ.unlockedMechanics.has("hound_and_hunter")) {
          const replacement = window.GameEngine.combat.maybeSpawnHoundAndHunter(civ, unit.x, unit.y, map);
          if (replacement) log.push(`Hound and Hunter: ${civ.id}'s fallen Wolf Rider is replaced by a ${replacement.typeId} at (${replacement.x},${replacement.y})`);
        }
        civ.units = civ.units.filter((u) => u !== unit);
        log.push(`Rouse the People: ${civ.id}'s ${unit.typeId} was slain by ${bestCity.civ.id}'s city`);
      }
      return true;
    }
    if (bestStruct) {
      window.GameEngine.quips.maybeQuip(unit, civ, "attack", gameState);
      const res = window.GameEngine.combat.attackStructure(unit, bestStruct.s.record, civ, bestStruct.s.civ, gameState);
      window.GameEngine.combat.recordCombatEvent({
        ax: unit.x, ay: unit.y, atkUnit: unit,
        dx: bestStruct.x, dy: bestStruct.y, defUnit: null,
      });
      // Hidden: attacking reveals the attacker, regardless of target type.
      window.GameEngine.combat.revealHidden(unit, currentTurnNumber);
      if (res.counterDamage) {
        log.push(`Structure counter: ${bestStruct.s.civ.id}'s ${bestStruct.s.record.id} struck back at ${civ.id}'s ${unit.typeId} for ${res.counterDamage}`);
      }
      if (res.militiaSpawned) {
        log.push(`Rouse the People: ${bestStruct.s.civ.id} raised a Militia to defend at (${res.militiaSpawned.x},${res.militiaSpawned.y})`);
      }
      if (res.destroyed) {
        // Anti-Titan learning: the structure's owner just lost it TO a Titan.
        if (unit.typeId === "runeforged_titan") maybeLearnAntiTitanLesson(bestStruct.s.civ);
        // Dwarf "The Long Reckoning": losing a BUILDING (walls explicitly
        // don't count -- the tech's own wording) permanently marks the
        // attacker as a rival.
        if (!bestStruct.s.building.isWall) {
          window.GameEngine.combat.markRival(bestStruct.s.civ, civ.id);
        }
        // Rouse the People: same 15%-on-actual-destruction bonus as the city
        // branch above, on top of the 1% already rolled for being attacked.
        if (bestStruct.s.civ.unlockedMechanics && bestStruct.s.civ.unlockedMechanics.has("rouse_the_people")) {
          const razeSpawn = window.GameEngine.combat.maybeSpawnMilitia(
            bestStruct.s.civ, bestStruct.x, bestStruct.y, map, civs, 0.15);
          if (razeSpawn) log.push(`Rouse the People: ${bestStruct.s.civ.id} raised a Militia from the wreckage at (${razeSpawn.x},${razeSpawn.y})`);
        }
        window.GameEngine.cities.destroyStructure(gameState, bestStruct.x, bestStruct.y);
        log.push(`Raze: ${civ.id}'s ${unit.typeId} destroyed ${bestStruct.s.civ.id}'s ${bestStruct.s.record.id}`);
        unit.currentMission = `Destroyed ${bestStruct.s.civ.id}'s ${bestStruct.s.record.id}`;
      } else {
        log.push(`Raid: ${civ.id}'s ${unit.typeId} damaged ${bestStruct.s.record.id} (${Math.max(0, bestStruct.s.record.hp)}/${bestStruct.s.record.maxHp})`);
        unit.currentMission = `Raiding ${bestStruct.s.civ.id}'s ${bestStruct.s.record.id} at (${bestStruct.x},${bestStruct.y})`;
      }
      unit.usedThisTurn = true;
      // Veteran leveling: structure damage IS a real number (unlike a city
      // siege's probabilistic knockdown), so this reuses xpForCombatAction's
      // damage-scaled formula plus a flat bonus for actually destroying it.
      if (unit.hp > 0) {
        let structXP = window.GameEngine.combat.xpForCombatAction({ damage: res.damage });
        if (res.destroyed) structXP += 8;
        grantXPAndAutoLevel(unit, civ, structXP);
      }
      if (unit.hp <= 0) {
        // Orc "Hound and Hunter": same replacement chance, this time slain
        // by a structure's own counterattack.
        if (unit.typeId === "wolf_rider" && civ.unlockedMechanics && civ.unlockedMechanics.has("hound_and_hunter")) {
          const replacement = window.GameEngine.combat.maybeSpawnHoundAndHunter(civ, unit.x, unit.y, map);
          if (replacement) log.push(`Hound and Hunter: ${civ.id}'s fallen Wolf Rider is replaced by a ${replacement.typeId} at (${replacement.x},${replacement.y})`);
        }
        civ.units = civ.units.filter((u) => u !== unit);
        log.push(`Structure counter: ${civ.id}'s ${unit.typeId} was slain by ${bestStruct.s.civ.id}'s ${bestStruct.s.record.id}`);
      }
      return true;
    }
    return false;
  }

  /**
   * Veteran leveling (see combat.js's LEVELING section): which of the 4
   * stat-bonus paths an AI-controlled unit spends a pending level-up on.
   * There's no per-controller UI to hang a human choice off yet -- see
   * project design notes -- so every unit currently resolves this the same
   * way, immediately, regardless of which civ owns it.
   *
   * Heuristic: proportional growth, not absolute value. Every LEVEL_BONUS_
   * VALUES entry is a small FIXED constant, so scoring by raw value alone
   * would always crown Attack/Defense (1 point each) over Siege/First
   * Strike (0.6-equivalent at militaryValue's own weighting) for every
   * single unit, forever -- deterministic and uninteresting. Instead this
   * scores each candidate as bonus/currentEffectiveValue: whichever stat is
   * currently SMALLEST for this unit gets the biggest proportional lift,
   * so a lopsided unit (e.g. a glass-cannon high-attack/low-defense
   * skirmisher) tends to round out its weaker side as it levels, rather
   * than snowballing an already-dominant stat. Siege/First Strike are only
   * ever candidates if the unit already has some of that property (>0) --
   * leveling refines an existing combat identity, it doesn't invent a new
   * one from nothing (a plain melee unit investing in Siege would gain
   * nothing until it happens to attack a structure, an unreliable payoff
   * compared to guaranteed Attack/Defense).
   */
  // Cold-start floors for Siege/First Strike's proportional-growth score
  // below -- NOT an eligibility gate (every unit can pick up either from
  // zero; see chooseLevelUpStat's doc comment). Chosen so a unit with NONE
  // of that property yet scores comparably to a typical Attack/Defense pick
  // (~0.15-0.3 for a mid-tier unit) instead of the ~1.0+ blowout a near-zero
  // denominator would otherwise produce: 0.10 siege bonus / 0.5 floor = 0.2,
  // 0.01 FS bonus / 0.05 floor = 0.2 -- both landing in that same
  // competitive-but-not-automatically-dominant range. 0.5 sits at the low
  // end of the roster's real siegePct values (Ogre); 0.05 sits just above
  // the lowest real firstStrikePct values (Cavalry/Knight/Paladin's
  // 0.03-0.06).
  const COLD_START_FLOOR = { siegePct: 0.5, firstStrikePct: 0.05 };

  /**
   * Which of the 4 stat-bonus paths a unit spends a pending level-up on
   * (see combat.js's LEVELING section). Every stat is always a candidate --
   * including Siege/First Strike for a unit with none of that property
   * yet, "purchasing" a new specialty from scratch, not just reinforcing an
   * existing one.
   *
   * Heuristic: proportional growth, not absolute value -- every LEVEL_BONUS_
   * VALUES entry is a small FIXED constant, so scoring by raw value alone
   * would always crown Attack/Defense (1 point each) over Siege/First
   * Strike (0.6-equivalent at militaryValue's own *6/*60 weighting) for
   * every single unit, forever. Instead this scores each candidate as
   * bonus/currentEffectiveValue: whichever stat is currently SMALLEST for
   * this unit gets the biggest proportional lift, so a lopsided unit (e.g.
   * a glass-cannon high-attack/low-defense skirmisher) tends to round out
   * its weaker side as it levels, rather than snowballing an already-
   * dominant stat.
   *
   * REPEAT PENALTY: proportional growth alone still produces a monoculture
   * for a stat that starts at/near zero -- confirmed live, a Dragon (no
   * base First Strike) dumped ALL 5 of its levels into First Strike, because
   * a small fixed +0.01/level increment against a small floor stays
   * "proportionally the biggest gap" for many levels running (0.01/0.05,
   * 0.01/0.06, 0.01/0.07, ... all still beat Attack/Defense's much slower-
   * decaying ~1/11, ~1/7 series). Divides each candidate's score by
   * (1 + how many PAST levels already went to that same stat -- derived
   * from unit.levelBonuses, not a separate counter), so repeatedly
   * reinvesting in one stat gets steadily less attractive relative to
   * everything else, pushing the unit toward a varied, rounded-out build
   * instead of an all-in specialty. Verified live: the same Dragon shape
   * now spreads across First Strike/Defense/Siege/Attack instead of one.
   */
  // +/-40% per-candidate jitter on the level-up score (same shape as
  // applyDifficultyNoise's `1.0 + (Math.random()*2-1)*spread`, just its own
  // constant rather than difficulty-gated) -- without this, the heuristic is
  // fully deterministic per unit TYPE (confirmed live: every same-type unit
  // on the same civ produced byte-for-byte identical levelBonuses, no
  // individual variety at all). Rolled independently per candidate stat
  // rather than once for the whole decision, so it can actually flip which
  // stat wins on a close call instead of uniformly scaling every option
  // by the same factor (which would never change the argmax). Raised from
  // an initial 0.20 (user-directed) after live measurement showed 0.20 only
  // flipped a clear-cut decision (e.g. a Dragon's cold-start First Strike
  // pick vs. its next-best Defense) about 1.3% of the time -- real but
  // barely visible in play.
  const LEVEL_UP_NOISE_SPREAD = 0.40;

  function chooseLevelUpStat(unit, civ) {
    const combat = window.GameEngine.combat;
    const currentValue = {
      attack: combat.effectiveAttack(unit, civ, {}),
      defense: combat.effectiveDefense(unit, civ, {}),
      siegePct: combat.effectiveSiegePct(unit, civ),
      firstStrikePct: combat.effectiveFirstStrikePct(unit, civ),
    };
    let bestStat = null, bestScore = -Infinity;
    for (const stat of combat.LEVEL_UP_STATS) {
      const floor = COLD_START_FLOOR[stat] || 0.01;
      const timesInvested = Math.round((unit.levelBonuses?.[stat] || 0) / combat.LEVEL_BONUS_VALUES[stat]);
      let score = (combat.LEVEL_BONUS_VALUES[stat] / Math.max(currentValue[stat], floor)) / (1 + timesInvested);
      score *= 1.0 + (Math.random() * 2 - 1) * LEVEL_UP_NOISE_SPREAD;
      if (score > bestScore) { bestScore = score; bestStat = stat; }
    }
    return bestStat || "attack"; // Attack/Defense are always candidates above, so this only guards a theoretical gap.
  }

  /** Grants `xpAmount` combat XP to `unit` and immediately resolves any
   *  level-up(s) it earns via chooseLevelUpStat -- see the call sites below
   *  (unit-vs-unit combat, city sieges, structure raids) for how xpAmount
   *  is computed for each kind of engagement. Also queues the "+N XP"/
   *  "Level Up!" floating-text feedback (see floatingtext.js) -- `wasMaxed`
   *  is checked BEFORE granting so a unit already at MAX_UNIT_LEVEL (whose
   *  XP grant is a silent no-op, see combat.js's grantXP) doesn't get a
   *  misleading "+N XP" popup for XP it never actually received. */
  function grantXPAndAutoLevel(unit, civ, xpAmount) {
    const combat = window.GameEngine.combat;
    const wasMaxed = (unit.level || 0) >= combat.MAX_UNIT_LEVEL;
    // Elf "Altar of Ages": +25% XP for a unit whose home city has the
    // building -- see combat.js's hasAltarOfAgesBonus.
    if (combat.hasAltarOfAgesBonus(unit, civ)) {
      const bonus = (civ.mechanicValues && civ.mechanicValues.altar_of_ages) || 0.25;
      xpAmount *= (1 + bonus);
    }
    combat.grantXP(unit, xpAmount);
    if (!wasMaxed && xpAmount > 0) {
      window.GameEngine.floatingText.spawnFloatingText(unit, `+${Math.round(xpAmount)} XP`, "xp");
    }
    let pending = combat.pendingLevelUps(unit);
    while (pending > 0) {
      combat.applyLevelUp(unit, chooseLevelUpStat(unit, civ));
      window.GameEngine.floatingText.spawnFloatingText(unit, "Level Up!", "levelup");
      pending--;
    }
  }

  function otherCivRemoveDeadUnit(civs, deadUnit) {
    const civ = civs[deadUnit.civId];
    if (civ) civ.units = civ.units.filter((u) => u !== deadUnit);
  }

  /** Suppresses the move-glide animation for a unit that just "popped" into
   *  view at (x, y) instead of walking there (2026-07-19, user-directed) --
   *  a carried passenger is invisible in transit (see render.js's Units
   *  pass, which skips drawing any unit with carriedBy set), so on
   *  disembark/drop it should appear instantly at its new spot rather than
   *  gliding there from wherever it was last actually drawn (its old
   *  pickup tile, possibly many turns and tiles away by now). Mirrors the
   *  same suppression teleports already use (see performDruidTeleport). */
  function snapVisualPos(unit, x, y) {
    unit._lastLogicalX = x; unit._lastLogicalY = y;
    unit._renderX = x; unit._renderY = y; unit._animStart = 0;
  }

  /** Drops `cargo` (a just-orphaned passenger, its carrier having died in
   *  combat this exchange) onto (x, y) -- the dead carrier's own tile --
   *  UNLESS that tile is impassable for a land unit (water, or otherwise
   *  impassable terrain), in which case the cargo dies too instead of being
   *  stranded there forever (2026-07-19, user-directed: e.g. a Galley sunk
   *  in open ocean can't leave its Pioneer passenger floating on the
   *  waves). Always clears the carry relationship either way. */
  function dropCargoOrKill(cargo, x, y, gameState, log) {
    cargo.carriedBy = null;
    const terrain = window.GameData.TERRAIN[gameState.map.tiles[y * gameState.map.width + x].terrain];
    if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) {
      log.push(`Carry: ${cargo.civId}'s ${cargo.typeId} had nowhere to land and was lost along with its carrier`);
      otherCivRemoveDeadUnit(gameState.civs, cargo);
    } else {
      cargo.x = x;
      cargo.y = y;
      snapVisualPos(cargo, x, y);
    }
  }

  const CURSE_DURATION = 3;

  // Violent Momentum: +2 movement for a unit that killed an enemy the
  // PREVIOUS turn. tickConditions runs at the START of runAITurn, so a
  // condition set during turn T (after that turn's own tick already ran)
  // survives untouched through turn T+1's movement and only expires at the
  // T+2 tick, giving exactly one full subsequent turn of the bonus, matching
  // "the previous turn".
  const VIOLENT_MOMENTUM_MOVE_BONUS = 2;
  const VIOLENT_MOMENTUM_DURATION = 2;

  /**
   * Orc-specific post-combat effects layered on top of the core damage/counter
   * exchange in resolveRound: Bog Witch's curse-on-death (whoever lands the
   * kill on her is cursed), Malefic Malediction (any hit she lands curses the
   * target, kill or not -- requires the tech), and Violent Momentum (the
   * attacker gets a temporary movement buff if this hit killed the defender
   * -- requires the tech). All CONDITIONS (see combat.js) -- read via
   * unit.conditions.curse/killMomentum by combat.js's effectiveAttack and
   * ai.js's moveUnitToward; expiry is cleared once per civ-turn in runAITurn
   * via tickConditions.
   */
  function applyOrcCombatMechanics(attackerUnit, attackerCiv, defenderUnit, defenderCiv, result, gameState) {
    const turn = gameState.turnNumber || 0;
    const setCondition = window.GameEngine.combat.setCondition;

    // Bog Witch's own death-curse: baked into the unit itself (see units.js),
    // always active regardless of tech -- fires the instant she dies.
    if (defenderUnit.typeId === "bog_witch" && defenderUnit.hp <= 0 && !result.fullNegated) {
      const curse = window.GameData.getUnit("bog_witch").curseOnDeath;
      if (curse) {
        setCondition(attackerUnit, "curse", { attackMult: curse.attackMult, moveMult: curse.moveMult, expiresAtTurn: turn + curse.duration });
      }
    }
    // Malefic Malediction: a Bog Witch curses whatever she hits, kill or not
    // -- but only if the hit actually landed. Unlike the two hp<=0 checks
    // above/below, this one doesn't naturally exclude a Flying-evasion miss
    // (fullMissed) on its own, since it never looks at damage/hp at all --
    // needs the explicit check so a whiffed swing at a Flying target doesn't
    // still curse it.
    if (attackerUnit.typeId === "bog_witch" && !result.fullNegated && !result.fullMissed &&
        attackerCiv.unlockedMechanics && attackerCiv.unlockedMechanics.has("malefic_malediction")) {
      setCondition(defenderUnit, "curse", { attackMult: 0.5, moveMult: 0.5, expiresAtTurn: turn + CURSE_DURATION });
    }
    // Violent Momentum: the attacker gets +2 movement next turn if this hit
    // actually killed the defender.
    if (attackerCiv.unlockedMechanics && attackerCiv.unlockedMechanics.has("violent_momentum")
        && defenderUnit.hp <= 0 && !result.fullNegated) {
      setCondition(attackerUnit, "killMomentum", { moveBonus: VIOLENT_MOMENTUM_MOVE_BONUS, expiresAtTurn: turn + VIOLENT_MOMENTUM_DURATION });
    }
  }

  // Elf "First Frost of Autumn": flat 10% chance per landed hit -- same
  // shape as Malefic Malediction above (any hit, not just a kill), same
  // Frozen condition Human's Freezing Touch grants (attackMult 0.75,
  // FROZEN_DURATION turns), just passive instead of a cast action.
  const FIRST_FROST_CHANCE = 0.10;

  /** Elf-specific post-combat effect layered on top of the core damage/
   *  counter exchange in resolveRound, same convention as
   *  applyOrcCombatMechanics above. */
  function applyElfCombatMechanics(attackerUnit, attackerCiv, defenderUnit, defenderCiv, result, gameState) {
    if (!attackerCiv.unlockedMechanics || !attackerCiv.unlockedMechanics.has("first_frost_of_autumn")) return;
    // A landed hit only -- mirrors Malefic Malediction's fullNegated/
    // fullMissed guard (a Flying-evasion miss or Invulnerability-negated hit
    // never connected, so there's nothing to freeze).
    if (result.fullNegated || result.fullMissed) return;
    if (Math.random() >= FIRST_FROST_CHANCE) return;
    window.GameEngine.combat.setCondition(defenderUnit, "frozen", {
      attackMult: 0.75, expiresAtTurn: (gameState.turnNumber || 0) + FROZEN_DURATION,
    });
  }

  /**
   * Anti-Titan learning (2026-07-15, user-directed): the first time a civ
   * loses a unit or structure TO a Runeforged Titan specifically (either
   * direction -- the Titan killed them outright, or their own unit died
   * attacking one and taking its counter), it gets one chance to "learn"
   * from the experience, gated on race.curiosity -- the same probabilistic
   * pattern maybeDungeonDelvePlay uses (`Math.random() < curiosity`), reused
   * here rather than inventing a second "how adaptable is this race" knob.
   * A civ that hasn't learned yet re-rolls on every subsequent qualifying
   * loss (so a low-curiosity race isn't doomed forever by one bad roll,
   * just slower on average to catch on); once it passes, the flag sticks
   * permanently -- see chooseBuildAction's SIEGE_UNIT_SATURATION, which this
   * flag lifts entirely so a civ that's learned keeps preferring siege-
   * capable units (the only thing that actually cuts through a Titan's
   * `siegeTarget` defense -- see combat.js's resolveRound) instead of
   * capping out at 2 owned/queued the way every other siege-vs-structure
   * need does. Race-agnostic and not hardcoded to Dwarf/Titan by name in the
   * scoring change itself, but the trigger here is deliberately
   * Titan-specific per the user's ask, not "any siege-worthy enemy."
   */
  function maybeLearnAntiTitanLesson(civ) {
    if (!civ || civ.learnedAntiTitanTactics) return;
    const race = window.GameData.getRace(civ.raceId);
    const curiosity = race.curiosity ?? 0.5;
    if (Math.random() < curiosity) civ.learnedAntiTitanTactics = true;
  }

  function maybeRaiseDead(victorCiv, victorUnit, defeatedUnit, civs) {
    const race = window.GameData.getRace(victorCiv.raceId);
    if (!race.raiseDeadChance) return;
    if (defeatedUnit.wasRaised) return; // no re-raising chains
    if (Math.random() > race.raiseDeadChance) return;
    // Orc "Honor the Dead": the defeated unit's own civ may resist being raised
    // (flavor: their ancestral rites hold the body). Independent roll on top of
    // the victor's raise chance -- e.g. 50% resistance halves the effective rate.
    const defeatedCiv = civs[defeatedUnit.civId];
    if (defeatedCiv && defeatedCiv.raiseDeadResistance && Math.random() < defeatedCiv.raiseDeadResistance) return;
    // Necropolis (undead wonder) raises stronger dead
    let powerRatio = race.raiseDeadPowerRatio;
    if (victorCiv.cities.some((c) => window.GameEngine.cities.cityHasStructure(c, "necropolis"))) {
      powerRatio += window.GameData.getBuilding("necropolis").raiseDeadPowerBonus || 0;
    }
    const defeatedBaseUnit = window.GameData.getUnit(defeatedUnit.typeId);
    const raisedAttack = Math.max(1, Math.round(defeatedBaseUnit.attack * powerRatio));
    const raised = { typeId: defeatedUnit.typeId, civId: victorCiv.id, x: defeatedUnit.x, y: defeatedUnit.y, wasRaised: true, isCivilian: false };
    // HP uses the raised unit's actual fighting stats: boosted attack (above)
    // plus its unmodified base defense -- defense isn't scaled by powerRatio
    // (only attackOverride is), so HP shouldn't pretend it is either.
    raised.maxHp = window.GameData.unitMaxHP(raisedAttack, defeatedBaseUnit.defense || 0);
    raised.hp = raised.maxHp;
    raised.attackOverride = raisedAttack;
    // Bypasses initUnitHP (raised units get a custom power-ratio HP/attack
    // calc above, not the normal formula), so gender/name are stamped here
    // directly -- same convention, keyed to victorCiv's race since that's
    // whose sprite art the unit renders with once raised. nameSpecial types
    // (e.g. a raised Battering Ram or Galley -- edge case, but possible if
    // one dies in combat) get a proper-noun designation and no gender, same
    // as initUnitHP -- see units.js's doc comment on that flag.
    raised.gender = defeatedBaseUnit.nameSpecial ? null : (Math.random() < 0.5 ? "male" : "female");
    raised.name = window.GameData.getRandomUnitName(victorCiv.raceId, raised.typeId, raised.gender);
    victorCiv.units.push(raised);
  }

  window.GameEngine.ai = {
    runAITurn,
    beginAITurn,
    stepAIUnit,
    finishAITurn,
    runUnitTurn,
    findAdjacentWater,
    findNearestCoastalWaterFor,
    aggressivenessFor,
    minAcceptableWinProbability,
    estimateWinProbability,
    racialWeights,
    previewNextResearch,
    totalPopulation,
    computeMilitaryCap,
    sustainableArmySize,
    upkeepStrainMultiplier,
    unitCombatPower,
    nearbyMilitaryPower,
    militaryPostureFor,
    huntEnemyInfrastructure,
    huntNearestEnemy,
    maybeDireWolfHunt,
    reinforceHomeCity,
    computeTileCityScore,
    findBestSettleSite,
    effectiveMilitarism,
    maybeCrusadeVanguard,
    moveTowardWithStandoff,
    chooseBuildAction,
    isNearActiveCombat,
    explorePostureFor,
    buildUnitOption,
    unitBuildTurns,
    maybeHalfellowRegroup,
    maybeSeekInjuredCompanion,
    operateCompanionCarry,
    maybeHalfellowStealthPlay,
    maybeHoldPillagePosition,
    maybeHeavyMetalVanguard,
    maybeShieldWallPosition,
    maybeTitanMarch,
    maybeEscortTitan,
    moveUnitTowardSmart,
    civDeepGates,
    maybeDeepRoadsRelocate,
    findNearbyUnclaimedGoldVein,
    findNearbyUnclaimedRuin,
    maybeProspectorsClaimPlay,
    maybeDungeonDelvePlay,
    seekOverseasResource,
    seekOverseasInvasion,
    tryDeepGateOverseas,
    appendAIActionLog,
    operateGalley,
    exploreWater,
    exploreWith,
    findFarUnseenTile,
    findNearestUnseenTile,
    civNeedsTitanScouting,
  };
})();
