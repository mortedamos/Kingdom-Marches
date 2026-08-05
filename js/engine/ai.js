/**
 * AI ENGINE
 * ---------
 * Utility/scoring AI: each turn, enumerate candidate actions, score them
 * using race weights + aggressiveness, execute the highest-scoring ones
 * within budget.
 *
 * This is informationally limited like a human player would be in a real
 * game -- AI only considers what's within its own civ's currently-owned
 * territory or unit/city vision, never the full map state.
 *
 * Unit carrying: units use `carriedBy` (ref to carrying unit, or null) and
 * `carries` (ref to carried unit, or null) -- used by galleys carrying
 * pioneers, Orc Dragon Riders, Halfellow Devoted Companions, and Elf
 * Shadowsteed.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  /** Human-friendly unit label for AI Action log messages (2026-07-22,
   *  user-directed: "should contain the names of the units, and show
   *  conditions") -- "Name (typeId)" plus a bracketed list of any active
   *  unit.conditions keys, e.g. "Sylvara the Keen-Eyed (ranger) [hidden,
   *  frozen]". Falls back to just the typeId if the unit has no name yet
   *  (e.g. this same turn, before unit-names.js's naming pass has run) so
   *  a log line never reads "undefined". Used everywhere a log message or
   *  currentMission previously interpolated a bare `unit.typeId`. */
  function describeUnit(unit) {
    if (!unit) return "unit";
    const base = unit.name ? `${unit.name} (${unit.typeId})` : unit.typeId;
    const conditionKeys = unit.conditions ? Object.keys(unit.conditions) : [];
    return conditionKeys.length ? `${base} [${conditionKeys.join(", ")}]` : base;
  }

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
   * Founded-minus-razed city count over the last CITY_DELTA_WINDOW turns
   * (2026-07-23, user-directed -- see the 2026-07-23 balance-audit memory).
   * `civ.cityEvents` is appended to by cities.js's foundCity/destroyCity,
   * the two canonical places a city is ever gained or lost, so this sees
   * every source (siege, scout-razing, AI settling, Druid's Roots of the
   * World, ...) uniformly. Negative means this civ is losing cities faster
   * than it's founding them -- used to taper the "always expand" bonuses in
   * strategy.js's macroGoalScores and this file's chooseBuildAction/
   * chooseStrategy, which previously kept re-committing to settle/expand
   * even while a civ's new cities were being razed as fast as they went up
   * (confirmed live for both Halfellow-vs-Orc and Human-vs-Elf/Dwarf).
   * Opportunistically trims events older than 2x the window so
   * `civ.cityEvents` doesn't grow unbounded over a long game.
   */
  const CITY_DELTA_WINDOW = 30;
  function recentCityDelta(civ, gameState) {
    if (!civ.cityEvents || civ.cityEvents.length === 0) return 0;
    const turn = gameState.turnNumber || 0;
    const cutoff = turn - CITY_DELTA_WINDOW;
    if (civ.cityEvents.length > 100) {
      civ.cityEvents = civ.cityEvents.filter((e) => e.turn >= turn - CITY_DELTA_WINDOW * 2);
    }
    let delta = 0;
    for (const e of civ.cityEvents) {
      if (e.turn < cutoff) continue;
      delta += e.type === "founded" ? 1 : -1;
    }
    return delta;
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

  // Settle-need roll (2026-07-30, user-directed): a peaceful, low-militarism/
  // low-aggressiveness civ addresses an ordinary pioneer/galley need almost
  // every turn; a warlike civ sometimes skips it in favor of the army. Never
  // a permanent block -- re-rolled every turn a need persists (see
  // chooseBuildAction's own urgency/ordinary split below), same shape as the
  // existing FULLY_FILLED_SETTLER_CHANCE pattern. Floored well above 0 so
  // even the most warlike civ still expands eventually.
  const SETTLE_ROLL_BASE = 0.85;
  const SETTLE_ROLL_MILITARISM_PENALTY = 0.5;
  const SETTLE_ROLL_FLOOR = 0.15;
  function rollsForSettleNeed(civ) {
    const drag = (effectiveMilitarism(civ) + aggressivenessFor(civ)) / 2; // 0 peaceful .. 1 warlike
    const chance = Math.max(SETTLE_ROLL_FLOOR, SETTLE_ROLL_BASE - drag * SETTLE_ROLL_MILITARISM_PENALTY);
    return Math.random() < chance;
  }

  /**
   * A throwaway stand-in for `unit` that a simulated fight may freely mutate.
   *
   * The spread alone is NOT enough (2026-08-03, user-reported bug): `{...unit}`
   * is shallow, so the copy shares the SAME `unit.conditions` object as the
   * real unit. combat.js's death-save rolls (Halfellow "Resilient Spirit",
   * Dwarf "Unyielding") call setCondition(unit, "forcedRest") when they fire,
   * and estimateWinProbability runs 20-30 fights to the death per decision --
   * so merely CONSIDERING an attack was stamping forcedRest onto real units
   * on the board, over and over. That is what made "Shaken by a near-death
   * blow (forced to rest)" show up constantly on units that had taken a
   * single glancing hit, most visibly on the Dwarf Runeforged Titan (huge HP,
   * a Dwarf civ, so a real lethal blow is rare but the AI evaluates fights
   * near it every turn).
   *
   * `levelBonuses` is copied for the same reason even though nothing writes
   * to it today -- a simulated unit must not be able to reach anything real.
   */
  function cloneUnitForSim(unit) {
    return {
      ...unit,
      hp: unit.hp,
      conditions: { ...(unit.conditions || {}) },
      levelBonuses: { ...(unit.levelBonuses || {}) },
    };
  }

  /** Quick win-probability estimate via sampling rather than exact Markov
   *  computation -- a pragmatic prototype-scale approximation of the
   *  exact-lookup approach the design doc describes.
   *
   *  `simulated: true` is a second, independent guard on the same class of
   *  bug cloneUnitForSim exists for: it tells combat.js not to apply the
   *  persistent side effects of a death save (the forced Rest, and the
   *  per-unit trigger counter that permanently decays future saves) for a
   *  fight that isn't really happening. The save itself still ROLLS, so the
   *  estimate stays honest about how survivable the unit is. */
  function estimateWinProbability(attackerUnit, defenderUnit, civs, context, samples = 30) {
    const simContext = { ...(context || {}), simulated: true };
    let wins = 0;
    for (let i = 0; i < samples; i++) {
      const a = cloneUnitForSim(attackerUnit);
      const b = cloneUnitForSim(defenderUnit);
      const result = window.GameEngine.combat.resolveToTheDeath(a, b, civs, simContext, 30);
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

  // Garrison-rate boost (2026-07-30, user-directed): every race garrisons
  // too rarely -- Dwarf and Halfellow especially, despite already leaning on
  // industriousness above, since a lightly-defended-but-not-empty city never
  // pulled a unit back home (see reinforceHomeCity's own undefended-only
  // scoping) and the roll below only ever fires for a unit already standing
  // on its own city tile. A flat multiplier on top of garrisonDesire, capped
  // at 1.0, so a unit that's already home and has nothing more pressing to
  // do (this roll is checked well after combat/vanguard/rush-to-defend
  // priorities above) garrisons far more reliably than before.
  const GARRISON_DESIRE_BOOST = 1.3;
  const GARRISON_DESIRE_BOOST_DWARF_HALFELLOW = 1.6;

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
    //
    // Net-city-loss taper (2026-07-23, user-directed): the bonus above is
    // exactly the mechanism that kept both Halfellow-vs-Orc and Human-vs-
    // Elf/Dwarf re-committing to "settle" turn after turn while their new
    // cities were being razed as fast as they went up -- a civ that's net
    // LOSING cities lately (see recentCityDelta) doesn't need MORE reasons
    // to found another one it probably can't hold, it needs to stop and
    // consolidate. Tapers linearly to 0 by -4 cities/window; a civ that's
    // merely flat or growing (delta >= 0) is completely unaffected.
    const cityDelta = recentCityDelta(civ, gameState);
    const cityLossTaper = cityDelta < 0 ? Math.max(0, 1 + cityDelta * 0.25) : 1;
    if (cityGateShortfall > 0) scores.settle += cityGateShortfall * 10 * cityLossTaper;

    const focus = Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a)[0];

    const losingCitiesNote = cityDelta < 0 ? ` (lost ${-cityDelta} more than founded recently — falling back)` : "";
    const reasons = {
      explore:    `only ${cityCount} cit${cityCount === 1 ? 'y' : 'ies'}, need to scout`,
      settle:     (cityGateShortfall > 0
        ? `need ${cityGateShortfall} more cit${cityGateShortfall === 1 ? 'y' : 'ies'} to unlock further research`
        : `expanding to ${cityCount + 1} cities`) + losingCitiesNote,
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

    // Settle-need roll (2026-07-30, user-directed): computed once per civ-
    // turn (not per-city) so every city in this civ sees the same verdict
    // this turn -- see rollsForSettleNeed and chooseBuildAction's pioneer/
    // galley section.
    civ._pioneerNeedRoll = rollsForSettleNeed(civ);
    civ._galleyNeedRoll = rollsForSettleNeed(civ);

    // Elf "hunting party" (2026-07-30, user-directed): the whole party's
    // shared kill target, recomputed fresh every Elf turn but sticking with
    // the same target across turns as long as it's still alive -- see
    // computeElfPartyTarget's doc comment.
    if (civ.raceId === "elf") civ._elfPartyTarget = computeElfPartyTarget(civ, gameState, civ._elfPartyTarget);

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
    // Log-spam fix (2026-07-23, user-directed): this used to fire every
    // single turn unconditionally, even when focus/reason were byte-for-byte
    // identical to last turn -- a civ genuinely stuck settling for 100+
    // turns in a row produced 100+ identical log lines, drowning out the
    // moments the strategy actually changed and making "how often is this
    // civ stuck" impossible to read at a glance (see the 2026-07-23
    // balance-audit memory). Only log on an actual change.
    const strategyLogText = `[${race.label}] Strategy: ${focus} — ${reason}`;
    if (strategyLogText !== civ._lastStrategyLogText) {
      log.push(strategyLogText);
      civ._lastStrategyLogText = strategyLogText;
    }

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
        log.push(`Disband: ${describeUnit(toDisband)} disbanded (army ${militaryCount} over population cap ${militaryCap})`);
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
            log.push(`Disband: ${describeUnit(toDisband)} disbanded to relieve army-size strain (${strain.toFixed(2)}x upkeep) -- freeing resources for other priorities`);
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
    log.push(`Disband: ${describeUnit(toDisband)} disbanded pre-emptively (~${Math.floor(turnsUntilBroke)} turns of runway left)`);
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
    // chooseResearch can now fail on affordability alone (2026-08-04): the
    // full Lore cost is paid up front, so a civ whose stockpile hasn't
    // caught up yet just tries again next turn -- self-healing, same as a
    // human player would see "can't afford" and wait. Only log on an
    // actual success; this used to log "started" unconditionally, which
    // would have claimed a research that never actually began.
    if (best && window.GameEngine.tech.chooseResearch(civ, best)) {
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

  /** Which of civ's own cities (if any) aren't yet reachable from the rest
   *  through its road network -- BFS out from the civ's first city through
   *  road tiles (city tiles count as connection points, same convention as
   *  cities.js's isRoadConnected), then any city never reached is
   *  "disconnected." Returns the nearest disconnected city to (fromX,fromY),
   *  or null if the civ has fewer than 2 cities or every city is already
   *  connected -- used by maybeFoundCity so an idle Pioneer with nothing
   *  left to settle builds a connecting road instead of wandering.
   *  2026-07-20, user-directed. */
  function findNearestDisconnectedCity(civ, gameState, fromX, fromY) {
    if (civ.cities.length < 2) return null;
    const { map } = gameState;
    const visited = new Set();
    const reached = new Set();
    const start = civ.cities[0];
    reached.add(start);
    const queue = [{ x: start.x, y: start.y }];
    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const idx = y * map.width + x;
      if (visited.has(idx)) continue;
      visited.add(idx);
      const hitCity = civ.cities.find((c) => c.x === x && c.y === y);
      if (hitCity) reached.add(hitCity);
      if (!hitCity && !map.tiles[idx].hasRoad) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) queue.push({ x: nx, y: ny });
        }
      }
    }
    const disconnected = civ.cities.filter((c) => !reached.has(c));
    if (disconnected.length === 0) return null;
    return disconnected.reduce((best, c) => {
      const d = window.GameEngine.influence.chebyshev(fromX, fromY, c.x, c.y);
      return (!best || d < best.d) ? { c, d } : best;
    }, null).c;
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

      // "Radius fully filled" auto-settler (2026-07-22, user-directed): a
      // Pioneer queued because one of this civ's cities has nothing left to
      // fill in (see chooseBuildAction's fullyFilledCityBonus) skips the
      // usual tile-SCORE search entirely and just grabs the nearest legal
      // spot -- see findClosestValidSettleSite. Stamped once at spawn
      // (spawnUnitInCity's extra-fields param) and never re-evaluated.
      const candidate = pioneer._useClosestSpotSettle
        ? findClosestValidSettleSite(civ, gameState, pioneer)
        : findBestSettleSite(civ, gameState, pioneer);
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
        } else if (maybeEnvoyPlay(civ, pioneer, gameState, log)) {
          // Halfellow "Envoy": nothing left to settle, but there's still an
          // unclaimed in-radius tile worth claiming outright -- see
          // maybeEnvoyPlay's doc comment. Tried before the road-connector/
          // wander fallbacks below since it's genuinely productive, not
          // just "less random."
        } else {
          // Nothing left to settle and nothing remembered either (2026-07-20,
          // user-directed): before falling back to a purely random walk,
          // check whether any of this civ's own cities aren't yet
          // road-connected to the rest -- a Pioneer with nothing to found is
          // far more useful laying the missing link than wandering. See
          // findNearestDisconnectedCity.
          const disconnectedCity = findNearestDisconnectedCity(civ, gameState, pioneer.x, pioneer.y);
          if (disconnectedCity) {
            pioneerRoadStep(pioneer, disconnectedCity.x, disconnectedCity.y, gameState.map, log, gameState.civs);
            pioneer.currentMission = `Building a connecting road toward ${disconnectedCity.name}`;
            log.push(`Pioneer at (${pioneer.x},${pioneer.y}) — no settle site found, building a road to connect ${disconnectedCity.name}`);
          } else {
            wanderUnit(pioneer, gameState.map, gameState.civs);
            pioneer.currentMission = "Wandering — no settle site found";
            log.push(`Pioneer wandering at (${pioneer.x},${pioneer.y}) — no settle site found`);
          }
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
          // Escort gate (2026-07-23, user-directed): founding a defenseless
          // city in contested land is exactly how the founding/razing
          // treadmill starts (see the 2026-07-23 balance-audit memory --
          // Halfellow-vs-Orc and Human-vs-Elf/Dwarf both lost the large
          // majority of every city founded this way). Holds off founding a
          // NON-first city for a few turns if there's genuine local danger
          // (settleDangerPenalty > 0 -- visible enemy military within
          // SETTLE_DANGER_RADIUS, or the tile itself is contested) and no
          // friendly military unit is nearby to help hold it. Explicitly
          // exempt: this civ's very first city (civ.cities.length === 0)
          // never waits, so the opening is never delayed -- and the wait is
          // bounded (ESCORT_WAIT_CAP turns) so a pioneer can never stall
          // forever waiting for an escort that never comes, matching every
          // other bounded-retry idiom in this function (pioneer._idleTurns
          // above, isUnitStalled elsewhere).
          const ESCORT_RADIUS = 2;
          const ESCORT_WAIT_CAP = 5;
          const isFirstCity = civ.cities.length === 0;
          const hasEscortNearby = !isFirstCity && civ.units.some((u) =>
            u !== pioneer && !u.carriedBy && window.GameData.getUnit(u.typeId).category === "military"
            && window.GameEngine.influence.chebyshev(u.x, u.y, pioneer.x, pioneer.y) <= ESCORT_RADIUS);
          const localDanger = !isFirstCity && !hasEscortNearby
            && settleDangerPenalty(civ, gameState, pioneer.x, pioneer.y) > 0;
          if (localDanger && (pioneer._escortWaitTurns || 0) < ESCORT_WAIT_CAP) {
            pioneer._escortWaitTurns = (pioneer._escortWaitTurns || 0) + 1;
            pioneer.usedThisTurn = true;
            pioneer.currentMission = `Holding at (${pioneer.x},${pioneer.y}) — no escort nearby, waiting before founding in contested land`;
            log.push(`Pioneer holding at (${pioneer.x},${pioneer.y}) — no escort and local threat detected, waiting before founding (${pioneer._escortWaitTurns}/${ESCORT_WAIT_CAP})`);
            continue;
          }
          delete pioneer._escortWaitTurns;
          window.GameEngine.quips.maybeQuip(pioneer, civ, "found", gameState);
          const city = window.GameEngine.cities.foundCity(civ, gameState, pioneer.x, pioneer.y);
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
    const costFn = (nx, ny, tile, fromIdx) => {
      if (occupied.has(`${nx},${ny}`)) return window.GameData.IMPASSABLE;
      if (isEnemyStructureBlockingTile(tile, pioneer)) return window.GameData.IMPASSABLE;
      if (isEnemyCityBlockingTile(civs, nx, ny, pioneer)) return window.GameData.IMPASSABLE;
      const destTerrain = window.GameData.TERRAIN[tile.terrain];
      if (destTerrain.isWater) return window.GameData.IMPASSABLE;
      // Origin tile for THIS hop, not the pioneer's turn-start position --
      // see getMoveCost's doc comment (cost is charged for leaving it).
      const originTile = fromIdx != null ? map.tiles[fromIdx] : map.tiles[pioneer.y * map.width + pioneer.x];
      const originTerrain = window.GameData.TERRAIN[originTile.terrain];
      return getMoveCost(originTerrain, destTerrain, baseUnit, pioneer, originTile.hasRoad);
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
      if (!isOpenPlacementTile(nx, ny, map, civs, occupied, unit.civId)) continue;
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
      const tile = map.tiles[ny * map.width + nx];
      if (!window.GameData.TERRAIN[tile.terrain].isWater) continue;
      if (occupied.has(`${nx},${ny}`)) continue; // no stacking
      // A naval unit can still wander onto an enemy's coastal city/port
      // structure tile otherwise -- same missing check as the land version
      // above, see isOpenPlacementTile's doc comment.
      if (hasEnemyStructure(tile, unit.civId)) continue;
      if (hasEnemyCity(civs, nx, ny, unit.civId)) continue;
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

  /** "Radius fully filled" auto-settler's site pick (2026-07-22, user-
   *  directed): unlike findBestSettleSite above, this does NOT weigh
   *  candidates by computeTileCityScore at all -- it scans outward ring by
   *  ring (Chebyshev distance) from the pioneer and returns the FIRST
   *  legal spot found, i.e. the genuinely closest one, ties broken by scan
   *  order. Same landmass restriction and canFoundCityAt legality check as
   *  the normal search. Returns null if nothing legal exists within
   *  CLOSEST_SPOT_SEARCH_RADIUS at all (an emergency-spacing relax like
   *  findBestSettleSite's fallback isn't worth it here -- this is already
   *  the "just grab anything nearby" path). */
  const CLOSEST_SPOT_SEARCH_RADIUS = 20;
  function findClosestValidSettleSite(civ, gameState, pioneer) {
    const { map, civs } = gameState;
    const pioneerTile = map.tiles[pioneer.y * map.width + pioneer.x];
    const pioneerLandmassId = pioneerTile ? pioneerTile.landmassId : -1;
    for (let r = 0; r <= CLOSEST_SPOT_SEARCH_RADIUS; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // this ring only
          const x = pioneer.x + dx, y = pioneer.y + dy;
          if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
          const tile = map.tiles[y * map.width + x];
          if (pioneerLandmassId >= 0 && tile.landmassId !== pioneerLandmassId) continue;
          const check = window.GameEngine.cities.canFoundCityAt(map, civs, x, y, civ.raceId, { skipRoadCheck: true });
          if (check.ok) return { x, y };
        }
      }
    }
    return null;
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

  /**
   * True if (nx,ny) is a legal tile to directly PLACE a unit onto -- not
   * occupied by another unit, not water/impassable terrain, and not
   * standing on an enemy wall/building/city (2026-08-03, user-reported).
   *
   * Used by every "find an open adjacent tile" mechanic that places a unit
   * WITHOUT going through the costed movement/pathfinding system --
   * wanderUnit/wanderUnitOnWater, Elf's Raptor/Shadowsteed summon
   * (spawnUnitAdjacentToUnit), Orc Dragon Riders' and Halfellow Devoted
   * Companions' disembark, and spawnUnitInCity's stacked-city fallback.
   * Each of those bypasses buildMoveRules' costFn entirely (a placement
   * isn't a move), so each has always had to make this same check itself --
   * the enemy-structure/city half was simply missing from every one of them
   * until now, the one gap in an otherwise-consistent "never stand on an
   * enemy's stuff" rule (buildMoveRules' costFn already enforces it for
   * every ordinary move).
   *
   * Deliberately does NOT exempt flying units the way
   * isEnemyStructureBlockingTile/isEnemyCityBlockingTile do for PASS-THROUGH
   * movement -- this is about STANDING on the tile, the same question
   * buildMoveRules' canLandOn answers for an ordinary move (also with no
   * flying exemption), so it calls the same underlying hasEnemyStructure/
   * hasEnemyCity checks those use directly, no unit instance required.
   * `civId` is whichever civ is about to own the unit being placed.
   */
  function isOpenPlacementTile(nx, ny, map, civs, occupied, civId) {
    if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) return false;
    if (occupied.has(`${nx},${ny}`)) return false;
    const tile = map.tiles[ny * map.width + nx];
    const terrain = window.GameData.TERRAIN[tile.terrain];
    if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) return false;
    if (hasEnemyStructure(tile, civId)) return false;
    if (hasEnemyCity(civs, nx, ny, civId)) return false;
    return true;
  }

  // A road tile costs a flat 1 movement point to LEAVE, regardless of the
  // underlying terrain -- "removes any terrain based movement penalties"
  // (2026-07-17, user-directed). 1 is the cheapest a land terrain can
  // already be (Plains/Desert/Tundra), so this never makes a road tile
  // BETTER than the best natural terrain, only neutralizes the 2-cost
  // penalty on Forest/Hills/Swamp (and, in the rare case a Pioneer with
  // mountain-tunneling tech built one on Mountains, its own 3-cost tunnel
  // rate too). See moveUnitToward's separate +1 movement bonus for a unit
  // that STARTS its turn on a road -- a different mechanic, stacks with this.
  //
  // WHOSE road (2026-08-03, user-directed): the discount applies when
  // LEAVING a road tile, not when arriving at one -- see getMoveCost's own
  // doc comment for why the whole cost model reads from the origin tile now.
  // Concretely: walking a chain of connected road tiles still costs 1 per
  // hop the entire way (every tile you leave along the chain has a road
  // under it), but stepping OFF rough terrain onto a road no longer gets an
  // immediate discount -- you pay what leaving the rough terrain costs; the
  // road only pays off starting with your NEXT step.
  const ROAD_MOVE_COST = 1;

  /**
   * Effective LAND movement cost of `terrain` under `mods` (a unit's
   * `_moveMods`, or undefined/null) -- factors in mountain-tunneling tech and
   * any terrain-override tech, either of which can turn an otherwise-
   * IMPASSABLE terrain finite. Returns IMPASSABLE if the terrain genuinely
   * can't be crossed even with those. Shared by getMoveCost's origin (cost)
   * and destination (passability) evaluations below, so tunneling/override
   * behave identically regardless of which side of a step they're read from.
   */
  function landCostForTerrain(terrain, mods) {
    if (terrain.id === "mountains" && terrain.moveCostLand === window.GameData.IMPASSABLE && mods?.canTunnel) {
      return 3; // slow but passable
    }
    const override = mods?.terrainOverride?.[terrain.id];
    if (override != null) return Math.min(terrain.moveCostLand, override);
    return terrain.moveCostLand;
  }

  /**
   * Movement cost (in points) to take ONE step from a tile described by
   * `originTerrain`/`originHasRoad` onto a tile described by `destTerrain`,
   * or IMPASSABLE if the destination can't be entered at all.
   *
   * COST vs. PASSABILITY are answered from DIFFERENT tiles, on purpose
   * (2026-08-03, user-directed -- this replaced a model where both were
   * destination-based):
   *
   *   - PASSABILITY ("can I physically be on this tile?") is about the
   *     DESTINATION. A land unit can't walk onto deep ocean no matter how
   *     easy the tile it's leaving is -- that can never depend on approach
   *     direction, so this half is unchanged from before.
   *
   *   - COST ("how much of my movement does this step use?") is charged for
   *     LEAVING the ORIGIN tile. Moving out of a Forest costs 2 no matter how
   *     open the tile you're stepping onto is; moving out of Plains costs 1
   *     even into a Forest. The discount for a unit standing on a road
   *     (originHasRoad) is likewise about the tile you're leaving -- see
   *     ROAD_MOVE_COST's own comment.
   *
   * Callers (buildMoveRules' costFn, pioneerRoadStep, findFleeTile) all
   * derive originTerrain/originHasRoad from whichever tile the unit is
   * ACTUALLY stepping off of for that hop -- see pathfinding.js's `fromIdx`,
   * which is what makes that tile available mid-search rather than just at
   * the unit's turn-start position.
   */
  function getMoveCost(originTerrain, destTerrain, unitData, unit, originHasRoad) {
    // Flying units "move over all terrain" (see units.js's flying doc comment) --
    // flat cost regardless of water/mountains/land movement penalties, ignoring
    // every other rule below (naval cost, tunneling, terrain overrides, roads --
    // none of them mean anything to a unit that never touches the ground).
    // Checks the live unit (base property OR a temporary grant, e.g. Human's
    // Flight) when available, falling back to the base data's flying flag
    // otherwise.
    if (unit ? window.GameEngine.combat.isFlying(unit) : unitData.flying) return 1;

    const mods = unit && unit._moveMods;

    if (unitData.isNaval) {
      // Roads are a land-only feature. Passability is the DESTINATION
      // water's (a ship can't sail onto land); cost is the ORIGIN water's.
      if ((destTerrain.moveCostNaval ?? window.GameData.IMPASSABLE) === window.GameData.IMPASSABLE) return window.GameData.IMPASSABLE;
      return originTerrain.moveCostNaval ?? window.GameData.IMPASSABLE;
    }

    // Land unit: can the destination even be entered?
    if (landCostForTerrain(destTerrain, mods) === window.GameData.IMPASSABLE) return window.GameData.IMPASSABLE;

    // It can -- charge for leaving the origin.
    if (originHasRoad) return ROAD_MOVE_COST;
    return landCostForTerrain(originTerrain, mods);
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

  // Turn-action-economy foundation (2026-07-20, user-directed) -- see
  // project_turn_action_economy memory. Every unit's turn is either a
  // NORMAL action (move 0-to-full budget, then optionally act -- attack,
  // cast, garrison, build a road, start a channel) or a FULL-TURN action
  // (no movement at all, before or after). Before this, movement budget was
  // a throwaway local variable recomputed and discarded inside a single
  // moveUnitToward call, so "move partway, then act" was structurally
  // impossible -- a unit could move OR act, never both in one turn.
  // unit.movesRemaining now persists the leftover budget across multiple
  // calls within the same unit's turn (cleared back to null in turns.js's
  // per-civ-turn reset, same point usedThisTurn goes false), so a caller can
  // move a unit partway toward a target and still have an accurate budget
  // left to check before attempting to act.

  /** Pure movement-budget math for a unit's turn (extracted unchanged from
   *  the old moveUnitToward), so it can be computed once and persisted
   *  instead of silently discarded after a single move call. Depends only
   *  on the unit's CURRENT tile -- terrain/road bonuses reflect wherever
   *  it's standing when this is first called each turn, not any tile
   *  crossed mid-path. */
  function computeMovementBudget(unit, map, civs) {
    const baseUnit = window.GameData.getUnit(unit.typeId);
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
    // at 1 so a Hidden unit is slow, never fully immobile. Elf "Quick as a
    // Shadow" (2026-07-22, previously unimplemented despite the tech's own
    // wording -- "a hidden elf unit can move at full speed, unlike most
    // hidden units") waives this entirely once known.
    if (unit.conditions?.hidden) {
      const movementCiv = civs?.[unit.civId];
      const bypassesHiddenPenalty = movementCiv?.raceId === "elf"
        && movementCiv.unlockedMechanics?.has("quick_as_a_shadow");
      if (!bypassesHiddenPenalty) movement = Math.max(1, Math.round(movement * 0.34));
    }

    // Tech: Halfellow "Devoted Companions" -- carrying a passenger costs 25% movement.
    if (unit.carries) {
      const carrierCiv = civs?.[unit.civId];
      if (carrierCiv?.unlockedMechanics?.has("devoted_companions")) movement = Math.max(1, Math.round(movement * 0.75));
    }
    // Halfellow "Riddle"/"Resource Heist": Befuddled caps movement at 1 --
    // confused, not paralyzed, same floor-shape as Hidden's penalty above,
    // just an absolute cap instead of a percentage. Applied last so nothing
    // above can push a Befuddled unit back over the cap.
    if (unit.conditions?.befuddled) movement = Math.min(movement, 1);
    return movement;
  }

  /** Same path-walking core moveUnitToward has always used, but reads/writes
   *  unit.movesRemaining instead of a throwaway local variable, so leftover
   *  budget survives across multiple calls within the same unit's turn --
   *  e.g. closing distance for a spell, then casting it (see
   *  maybeFreezingTouch/maybeGrantFlight). Lazily computes the budget via
   *  computeMovementBudget on first use each turn. Returns the leftover
   *  budget after moving. moveUnitToward (below) is a thin wrapper over
   *  this that ignores the return value, preserving its existing external
   *  contract for the ~35 call sites that only ever move a unit once per
   *  turn (for which persisting vs. discarding the budget is unobservable). */
  /**
   * One unit's movement rules, in one place: which tiles it may CROSS and at
   * what cost (costFn), and which it may actually STOP on (canLandOn).
   *
   * Extracted from spendMovement (2026-08-01) so the player's reachable-tile
   * overlay can be computed from the exact same rules that the actual move
   * will obey. If these ever diverged, the overlay would promise a tile the
   * move then refuses -- the single most confusing bug a tile-based UI can
   * have. Both paths now go through this, so they cannot drift.
   *
   * Flying (base property OR a temporary grant, e.g. Human's Flight -- see
   * combat.js's isFlying) units may fly OVER a tile occupied by a non-flying
   * unit (only another flying unit blocks their path); they must still never
   * actually land/stop on any occupied tile, which is what the separate
   * canLandOn test enforces using the full occupancy set instead.
   */
  function buildMoveRules(unit, civs, map) {
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const flying = window.GameEngine.combat.isFlying(unit);
    const occupied = flying ? buildFlyingBlockSet(civs, unit) : buildOccupancySet(civs, unit);
    const fullOccupied = flying ? buildOccupancySet(civs, unit) : occupied;

    // `fromIdx` (the ORIGIN tile's index for this hop) is threaded through by
    // pathfinding.js's findPath as costFn's 4th argument, and by
    // computeReachableTiles' own hand-rolled search below -- both know which
    // tile they're stepping FROM at each hop, which is what getMoveCost's
    // cost half now needs (see its doc comment). Falls back to the unit's
    // own current tile when omitted; the only caller that ever omits it is
    // canLandOn's `!flying` branch just below, which never actually executes
    // (canLandOn is only ever invoked when `flying` is true) -- the fallback
    // exists purely so that dead branch still resolves to something sane.
    const costFn = (nx, ny, tile, fromIdx) => {
      if (occupied.has(`${nx},${ny}`)) return window.GameData.IMPASSABLE;
      if (isEnemyStructureBlockingTile(tile, unit)) return window.GameData.IMPASSABLE;
      if (isEnemyCityBlockingTile(civs, nx, ny, unit)) return window.GameData.IMPASSABLE;
      const destTerrain = window.GameData.TERRAIN[tile.terrain];
      const originTile = fromIdx != null ? map.tiles[fromIdx] : map.tiles[unit.y * map.width + unit.x];
      const originTerrain = window.GameData.TERRAIN[originTile.terrain];
      return getMoveCost(originTerrain, destTerrain, baseUnit, unit, originTile.hasRoad);
    };

    // A flier crossing OVER an enemy wall is fine; landing on it isn't --
    // so this deliberately re-checks structure/city ownership WITHOUT the
    // flying exemption that isEnemyStructureBlockingTile/isEnemyCityBlocking-
    // Tile grant for costFn's pass-through case. For a non-flying unit,
    // "can cross" and "can stop" are the same question, so it just defers.
    const canLandOn = (nx, ny, tile) => {
      if (!flying) return costFn(nx, ny, tile) !== window.GameData.IMPASSABLE;
      return !fullOccupied.has(`${nx},${ny}`)
        && !hasEnemyStructure(tile, unit.civId)
        && !hasEnemyCity(civs, nx, ny, unit.civId);
    };

    return { baseUnit, flying, occupied, fullOccupied, costFn, canLandOn };
  }

  function spendMovement(unit, targetX, targetY, map, civs) {
    if (unit.movesRemaining == null) unit.movesRemaining = computeMovementBudget(unit, map, civs);
    const rules = buildMoveRules(unit, civs, map);
    const { flying, costFn } = rules;

    // Full route via A*, not a per-step greedy hill-climb -- this is what lets a unit
    // detour around a mountain range or bay instead of stopping dead against it. If the
    // exact target tile can't be reached (e.g. a land unit "heading toward" a galley
    // sitting on water), findPath falls back to the closest reachable tile instead.
    const path = window.GameEngine.pathfinding.findPath(unit.x, unit.y, targetX, targetY, map, costFn);
    if (!path) return unit.movesRemaining;
    window.GameEngine.quips.maybeQuip(unit, civs?.[unit.civId], "move", currentGameStateRef);
    for (let i = 0; i < path.length; i++) {
      if (unit.movesRemaining <= 0) break;
      const step = path[i];
      const isLandingStep = (i === path.length - 1 || unit.movesRemaining - step.cost <= 0);

      // Hidden: this tile was excluded from the occupancy sets buildMoveRules
      // built
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
      // ownership WITHOUT the flying exemption -- see buildMoveRules's
      // canLandOn, which is where that distinction now lives.
      if (flying && isLandingStep) {
        const stepTile = map.tiles[step.y * map.width + step.x];
        if (!rules.canLandOn(step.x, step.y, stepTile)) break;
      }
      unit.x = step.x;
      unit.y = step.y;
      unit.movesRemaining -= step.cost;
    }
    return unit.movesRemaining;
  }

  function moveUnitToward(unit, targetX, targetY, map, civs) {
    spendMovement(unit, targetX, targetY, map, civs);
  }

  /**
   * Every tile `unit` could legally END its move on with the movement budget
   * it has left this turn, as a Map of "x,y" -> { x, y, cost }.
   *
   * Added for the player UI (2026-08-01): a human player needs to SEE where a
   * unit can go before committing, which the AI never needed. Uses
   * buildMoveRules, so it is the same crossing rules, the same per-terrain
   * costs, and the same landing restrictions that spendMovement will apply
   * when the order is actually issued.
   *
   * Dijkstra rather than A* -- there's no single goal here, we want the whole
   * reachable set, and costs vary per tile so a plain BFS would be wrong.
   * Tiles that can be crossed but not stopped on (a flier passing over an
   * enemy wall) are correctly expanded THROUGH but left out of the result.
   */
  function computeReachableTiles(unit, gameState) {
    const { map, civs } = gameState;
    const IMPASSABLE = window.GameData.IMPASSABLE;
    const budget = unit.movesRemaining != null
      ? unit.movesRemaining
      : computeMovementBudget(unit, map, civs);
    const reachable = new Map();
    if (!(budget > 0)) return reachable;

    const rules = buildMoveRules(unit, civs, map);
    const bestCost = new Map([[`${unit.x},${unit.y}`, 0]]);
    // Small frontier (bounded by the movement budget, not the map), so a
    // linear extract-min is cheaper here than a heap's bookkeeping.
    const frontier = [{ x: unit.x, y: unit.y, cost: 0 }];

    while (frontier.length) {
      let bi = 0;
      for (let i = 1; i < frontier.length; i++) if (frontier[i].cost < frontier[bi].cost) bi = i;
      const cur = frontier.splice(bi, 1)[0];
      if (cur.cost > (bestCost.get(`${cur.x},${cur.y}`) ?? Infinity)) continue;
      // "Always able to move at least one more tile" (2026-08-03,
      // user-directed): a unit with ANY movement left (cur.cost < budget,
      // i.e. arriving at `cur` didn't already exhaust it) may always
      // complete one more hop even if THAT hop's own cost overshoots what's
      // left -- see the uncapped `total` below, and spendMovement's matching
      // per-step loop, which has always allowed movesRemaining to go
      // negative on exactly one hop. What stops that from chaining into a
      // SECOND overshoot hop is this check right here: a node whose cost
      // already reached/exceeded budget cannot be expanded further, exactly
      // mirroring spendMovement's own `movesRemaining <= 0` guard.
      if (cur.cost >= budget) continue;

      const fromIdx = cur.y * map.width + cur.x;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cur.x + dx, ny = cur.y + dy;
          if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
          const tile = map.tiles[ny * map.width + nx];
          const stepCost = rules.costFn(nx, ny, tile, fromIdx);
          if (stepCost === IMPASSABLE || !(stepCost >= 0)) continue;
          const total = cur.cost + stepCost;
          // No budget cap here -- see the "always able to move" comment
          // above; `cur.cost >= budget` already guarantees this branch is
          // only reached when the unit truly had movement left to spend.
          const key = `${nx},${ny}`;
          if (total >= (bestCost.get(key) ?? Infinity)) continue;
          bestCost.set(key, total);
          frontier.push({ x: nx, y: ny, cost: total });
        }
      }
    }

    for (const [key, cost] of bestCost) {
      if (cost === 0) continue; // the unit's own tile is not a "move"
      const [x, y] = key.split(",").map(Number);
      if (!rules.canLandOn(x, y, map.tiles[y * map.width + x])) continue;
      reachable.set(key, { x, y, cost });
    }
    return reachable;
  }

  /**
   * Advances an already-queued build in each of `civ`'s cities, WITHOUT ever
   * choosing a new one.
   *
   * The AI's maybeBuildInCities does both -- progress an existing queue, else
   * pick something new -- and lives inside beginAITurn, which turns.js skips
   * entirely for the human civ. That meant a human player's cities could
   * never advance a build even once the UI let them queue one: the queue
   * would just sit there forever. This is the progression half on its own, so
   * turns.js can run it for the human civ while leaving the CHOICE to the
   * player. Same progressBuildQueue the AI uses, so costs, timers, minimum
   * build times, and completion behavior are identical for both.
   */
  function progressBuildQueues(civ, gameState, log = []) {
    for (const city of civ.cities) {
      if (city.buildQueue) progressBuildQueue(civ, city, gameState, log);
    }
    return log;
  }

  /** True while a unit is locked into a multi-turn CHANNELED action
   *  (Prospector's Claim / Dungeon Delve -- unit._ritualTurns, which
   *  turns.js resets to 0 the instant the unit leaves its vein/ruin, so a
   *  positive value here already implies "currently on the anchor tile";
   *  or a Druid mid-summon -- unit.summonBuild). Channeled actions lock out
   *  movement and further choices until they resolve or are interrupted. */
  function isChanneling(unit) {
    return !!(unit.summonBuild || (unit._ritualTurns || 0) >= 1);
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
          // totalTurns kept alongside the countdown (2026-07-21) purely so
          // the UI (sidebar.js) can display a progress percentage -- the
          // countdown itself only ever reads turnsRemaining.
          city.buildQueue = { kind: choice.kind, id: choice.id, turnsRemaining: choice.turns, totalTurns: choice.turns };
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

  /** Closest open tile to (x,y) a unit could be directly PLACED on --
   *  orthogonal neighbors (true distance 1) checked before diagonal ones
   *  (distance ~1.41), so this is genuinely "closest," not just "some
   *  neighbor." Returns null if all 8 are blocked (occupied, impassable, or
   *  an enemy structure/city -- see isOpenPlacementTile). Used everywhere a
   *  unit needs to appear next to a specific tile without stacking on
   *  whatever's already there: spawnUnitInCity's main spawn and its Goblin
   *  Miscreant bonus, and civ creation's starting units (main.js) --
   *  2026-08-03, user-reported (both spawning and starting units used to
   *  stack unconditionally onto the anchor tile). */
  function findClosestOpenPlacementTile(x, y, map, civs, occupied, civId) {
    const ORTHOGONAL = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const DIAGONAL = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dx, dy] of [...ORTHOGONAL, ...DIAGONAL]) {
      const nx = x + dx, ny = y + dy;
      if (isOpenPlacementTile(nx, ny, map, civs, occupied, civId)) return { x: nx, y: ny };
    }
    return null;
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

  // Universal pacing knob (2026-08-04, user-directed) -- GameConfig.pacing.
  // slowness is now shared with tech.js's researchTurns instead of this file
  // keeping its own separate rate (was 0.24 here vs 0.12 for research, a 2x
  // mismatch with no real justification). Raise it to slow the whole game's
  // build/research pace down, lower it to speed everything up together.
  // Only affects units built through the power-based system (i.e. anything
  // whose unlocking tech has a costBreakdown to derive a resource split
  // from -- every real combat unit across every race). Pioneer/Galley/
  // Scout have a real unlocking tech now too (Tier 0's shared_infrastructure)
  // but it has no costBreakdown, so unitBuildCost still returns null for
  // them and they stay on the separate flat-coinCost accumulation path,
  // same as wall_section -- untouched by this constant either way.
  const BUILD_SLOWNESS = window.GameConfig.pacing.slowness;

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
    return Math.max(1, Math.round((power / rate) * BUILD_SLOWNESS));
  }

  /** Turns to build `buildingId` for `civ` under the modern multi-resource
   *  cost model (see GameData.buildingBuildCost) -- same shape as
   *  unitBuildTurns, reusing the SAME BUILD_SLOWNESS constant so the two
   *  feel like comparable-weight commitments. Keyed on industriousness
   *  alone rather than unitBuildTurns' full raceUnitBuildRate, which also
   *  folds in militarism -- irrelevant here, a civilian building isn't a
   *  military production decision (the same reasoning cities.js's own
   *  fill-rate and this file's raceUnitBuildRate already document for
   *  industriousness as a trait). minBuildTurns (currently only
   *  wall_section, which never reaches this function anyway since it has no
   *  unlocking tech) is honored as a hard floor for consistency with the
   *  legacy model, in case a future building ever combines the two. */
  function buildingBuildTurns(civ, buildingId) {
    const building = window.GameData.getBuilding(buildingId);
    const race = window.GameData.getRace(civ.raceId);
    const industriousness = race.industriousness ?? 0.5;
    const total = building.coinCost || 0;
    const turns = Math.max(1, Math.round((total / industriousness) * BUILD_SLOWNESS));
    return building.minBuildTurns ? Math.max(turns, building.minBuildTurns) : turns;
  }

  /**
   * One buildable-building OPTION for `civ`: the modern multi-resource cost
   * (GameData.buildingBuildCost) plus a fixed turn countdown when the
   * building's unlocking tech defines a cost split, else the legacy flat
   * coinCost (accumulated from the city's own coin income over time instead
   * -- see progressBuildQueue). Same null-fallback shape buildUnitOption
   * already established for units; `slots` is each caller's own job to
   * attach (placement legality differs between availableBuilds' full-scan
   * and chooseBuildAction's single-slot AI check), so this only decides cost.
   */
  function buildingOption(civ, buildingId) {
    const b = window.GameData.getBuilding(buildingId);
    const cost = window.GameData.buildingBuildCost(buildingId);
    if (!cost) return { kind: "building", id: buildingId, label: b.label, coinCost: b.coinCost };
    return { kind: "building", id: buildingId, label: b.label, cost, turns: buildingBuildTurns(civ, buildingId) };
  }

  /**
   * Completes a building's construction: places the structure (honoring a
   * human player's chosen tile, see orders.js's queueBuild) and logs the
   * outcome. Shared by BOTH of progressBuildQueue's cost models -- the
   * modern paid-up-front countdown and the legacy coin-accumulation path --
   * so a building's actual placement/logging logic exists in exactly one
   * place regardless of which payment model got it there.
   */
  function completeBuildingStructure(civ, city, gameState, item, log) {
    const placed = window.GameEngine.cities.placeStructure(
      city, civ, gameState.map, item.id, gameState.civs, item.placeAt);
    if (placed) {
      const offSpot = item.placeAt && (placed.x !== item.placeAt.x || placed.y !== item.placeAt.y);
      log.push(`Build complete: ${city.name} raised ${item.id} at (${placed.x},${placed.y})`
        + (offSpot ? ` (chosen tile ${item.placeAt.x},${item.placeAt.y} was no longer available)` : ""));
    } else {
      // No valid adjacent slot (all occupied/blocked) -- abandon this build.
      log.push(`Build canceled: ${city.name} has no open slot for ${item.id}`);
    }
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
  // Wizard and Trouble Maker used to live here too (scored by how many
  // unlocked spell/utility techs they had) -- both now fold into the
  // race-wide unit-ratio system instead (2026-07-30, user-directed: no
  // separate scoring path, on equal footing with every other unit type --
  // see RACE_UNIT_RATIO/ratioPick below). Druid stays on this dedicated
  // path: its job (Raptor/Shadowsteed summon production, city-founding) is
  // a different kind of decision than standing-army composition.
  const UTILITY_UNIT_MECHANICS = {
    druid: ["natures_grace", "roots_of_the_world", "raptor_summon", "shadow_steed_summon"],
  };

  // Wizard's ability techs -- moved out of UTILITY_UNIT_MECHANICS above, but
  // still used by ratioPick as a binary eligibility gate (not a score): a
  // freshly-unlocked Wizard with none of these researched yet has no
  // signature ability to actually run, so it isn't proposed as this civ's
  // "support" pick until at least one is known. Trouble Maker needs no
  // equivalent gate -- its kit is granted automatically the instant the unit
  // itself unlocks (see "Making Trouble" in techs.js), no separate ability
  // tech required.
  const WIZARD_ABILITY_TECHS = ["teleportation", "fireball_splash", "dungeon_delve",
    "invisibility", "invulnerability_chance", "freezing_touch", "flight_grant"];

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
  // Orc "Dire Wolf" combat-drought response (2026-07-22, user-directed): if
  // it's been this many turns since any Orc unit last saw real combat, a
  // city force-builds a Dire Wolf to go stir one up -- scored far above any
  // other candidate so it always wins the build slot once triggered (this
  // is meant to be a guaranteed reaction to a real drought, not just a
  // nudged preference). See turns.js's beginCivTurn for the counter and
  // markCombatEngaged below for where it resets.
  const DIRE_WOLF_DROUGHT_TURNS = 20;
  const DIRE_WOLF_DROUGHT_BONUS = 999;

  /** Resets `civ`'s combat-drought counter (see turns.js's beginCivTurn) --
   *  called at every real (board) combat call site where one of `civ`'s own
   *  units was actually involved, either as attacker or defender. Currently
   *  only consumed by Orc's Dire Wolf drought response above, but reset
   *  unconditionally for every civ (cheap, and avoids the alternative of
   *  gating every call site by race). No-op if `civ` is falsy (some call
   *  sites attack a structure/city with no defending civ unit involved). */
  function markCombatEngaged(civ) {
    if (civ) civ.turnsSinceCombat = 0;
  }

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
  const RARE_UNIT_PREMIUM_RATE = window.GameConfig.units.rarePremiumRate;
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
  const VERY_RARE_UNIT_PREMIUM_RATE = window.GameConfig.units.veryRarePremiumRate;

  // Disposable-filler discount (2026-07-14): the mirror-image of the rarity
  // premium above -- a `cheap: true` unit (currently only Orc's Goblin
  // Miscreant) is deliberately weak (Atk1/Def1) and meant to be built in
  // bulk as a gap-filler when nothing better is worth or affordable to
  // build, not scaled down from already being cheap by raw power alone.
  // Flat 30% off cost, build time, AND upkeep (see unitUpkeep in
  // techs.js for the upkeep side) -- user-directed, see
  // project_pairwise_balance_human_orc_halfellow memory.
  const CHEAP_UNIT_DISCOUNT_RATE = window.GameConfig.units.cheapUnitDiscountRate;

  // "Cultural Influence" tech-tree capstone (2026-07-21, user-directed):
  // flat multi-resource cost + turn count, deliberately large/slow --
  // "high cost... several turns" per the user's own spec -- since its whole
  // purpose is soaking up a late-game surplus stockpile, not competing with
  // real economy/military spending on price. See chooseBuildAction's own
  // option push above and performClaimInfluenceTile below.
  const CULTURAL_INFLUENCE_COST = { harvest: 60, coin: 60, lore: 60 };
  const CULTURAL_INFLUENCE_TURNS = 6;

  /** Whether `city` still has at least one tile within its own influence
   *  radius that isn't already filled in -- mirrors advanceCityFill's own
   *  candidate computation (cities.js) exactly, just as a yes/no check
   *  instead of picking one. Cultural Influence has nothing left to do once
   *  this is false (the whole radius is already this civ's). */
  function cityHasUnclaimedInfluenceTile(city, map) {
    const radius = city.influenceRadius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (city.filledOffsets.has(`${dx},${dy}`)) continue;
        const tx = city.x + dx, ty = city.y + dy;
        if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
        return true;
      }
    }
    return false;
  }

  /** Completes a "Cultural Influence" build (see progressBuildQueue's
   *  "influence" branch): claims exactly ONE random currently-unfilled
   *  offset within the city's radius, immediately (unlike organic growth's
   *  gradual advanceCityFill) -- the whole point of paying the tech's steep
   *  cost is skipping the wait. No-ops (silently) if the radius filled in
   *  from some other source since this build started -- rare, but possible
   *  if a radius bonus tech was researched mid-build. */
  function performClaimInfluenceTile(city, map, log) {
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
    if (candidates.length === 0) return;
    const key = candidates[Math.floor(Math.random() * candidates.length)];
    city.filledOffsets.add(key);
    const [dx, dy] = key.split(",").map(Number);
    log.push(`Cultural Influence: ${city.name} claims influence over (${city.x + dx},${city.y + dy})`);
  }

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
   *   - Legacy flat coinCost: coin-income-accumulation behavior via
   *     progressBuildQueue. As of 2026-08-05 no unit actually falls back to
   *     this any more -- Pioneer/Galley/Scout (the last 3 that used to)
   *     now resolve to shared_infrastructure's own costBreakdown, same as
   *     every other unit -- kept only as a defensive path for a
   *     hypothetical future tech authored without a costBreakdown.
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

  /** True if the landmass containing (x,y) currently has 2+ open (no city,
   *  no structure -- any civ's) land tiles -- i.e. this civ can still place
   *  one more structure there and leave at least one tile open afterward.
   *  AI-only restriction (2026-07-20, user-directed): a fully walled/built
   *  small island left invaders nowhere to ever land, producing an
   *  unbreakable stalemate -- this guarantees the AI's own building logic
   *  always leaves at least one landing tile. Deliberately NOT enforced in
   *  cities.js's findStructureSlot itself, which stays available to a human
   *  player who wants to wall their own island shut on purpose. Flying
   *  units already ignore structure-blocking entirely (see
   *  isEnemyStructureBlockingTile) -- this is about guaranteeing SOME
   *  landing spot for everyone else. */
  function landmassHasSpareOpenTile(x, y, map, civs) {
    const landmassId = map.tiles[y * map.width + x]?.landmassId;
    if (landmassId == null || landmassId < 0) return true; // no landmass data -- don't block
    let openCount = 0;
    for (let i = 0; i < map.tiles.length; i++) {
      if (map.tiles[i].landmassId !== landmassId) continue;
      const tx = i % map.width, ty = Math.floor(i / map.width);
      let closed = false;
      for (const c of Object.values(civs)) {
        if (c.cities.some((cc) => (cc.x === tx && cc.y === ty) || cc.structures.some((s) => s.x === tx && s.y === ty))) {
          closed = true;
          break;
        }
      }
      if (!closed) {
        openCount++;
        if (openCount > 1) return true;
      }
    }
    return false;
  }

  /**
   * Everything `city` could legally start building right now, for the player's
   * build picker.
   *
   * Deliberately NOT chooseBuildAction: that function is the AI's strategy --
   * it weighs expansion against militarism, threat, upkeep sustainability and
   * a dozen racial traits, then returns the single option it likes best. A
   * player wants the opposite: the full menu, unranked, with honest prices.
   *
   * What it does share is the pricing. Unit options come from buildUnitOption,
   * the same function the AI prices against, so rarity premiums, `cheap`
   * discounts, War Camp cost multipliers and the first-military double-speed
   * bonus all apply identically -- a player and an AI pay the same for the
   * same unit on the same turn.
   *
   * Buildings carry their legal placement slots, since the player picks the
   * tile at queue time (see cities.js's validStructureSlots).
   */
  function availableBuilds(civ, city, gameState) {
    const { map, civs } = gameState;
    const out = [];

    let unitCostMult = 1.0;
    for (const s of city.structures) {
      const m = window.GameData.getBuilding(s.id).unitCostMult;
      if (m && m < unitCostMult) unitCostMult = m;
    }

    // Units. buildUnitOption returns null when the civ can't afford it, which
    // is exactly the "greyed out" case -- surfaced with affordable:false
    // rather than hidden, so the player can see what they're saving toward.
    const unitIds = new Set(civ.unlockedUnits || []);
    for (const legacyId of ["pioneer", "galley"]) unitIds.add(legacyId);
    for (const unitId of unitIds) {
      const unitData = window.GameData.getUnit(unitId);
      if (!unitData) continue;
      if (unitData.isNaval && !(city.isPort || isCoastalTile(map, city.x, city.y))) continue;
      const option = buildUnitOption(civ, unitId, 0, unitCostMult);
      if (option) {
        out.push({ ...option, label: unitData.label, affordable: true });
      } else {
        out.push({
          kind: "unit", id: unitId, label: unitData.label, affordable: false,
          cost: window.GameData.unitBuildCost(unitId),
          turns: unitBuildTurns(civ, unitId),
        });
      }
    }

    // Buildings: this race's roster, minus what this city already has, minus
    // anything with nowhere legal to stand.
    //
    // BUG FIX (2026-08-03, user-reported): this used to gate on `b.techId`,
    // a field that is never actually set on any entry in buildings.js -- the
    // check was permanently a no-op, so every one of a race's 4 buildings was
    // offered to the player regardless of research. The real record of what's
    // been unlocked is civ.unlockedBuildings (populated by tech.js's
    // unlock_building effect), which is exactly what the AI's own build
    // chooser (chooseBuildAction, below) already keys off -- this just brings
    // the player-facing picker in line with it.
    // Cost: the modern multi-resource model (GameData.buildingBuildCost) when
    // this building's unlocking tech defines a split, paid up front from the
    // stockpile -- so, unlike the legacy coinCost model it replaces for most
    // buildings, affordability has to be checked HERE rather than always
    // being true (a wall or any tech-less building still just accrues
    // progress from city income over time regardless of the civ's current
    // stockpile, same as always).
    for (const buildingId of window.GameData.buildingsForRace(civ.raceId)) {
      if (!(civ.unlockedBuildings && civ.unlockedBuildings.has(buildingId))) continue;
      if (window.GameEngine.cities.cityHasStructure(city, buildingId)) continue;
      const slots = window.GameEngine.cities.validStructureSlots(city, civ, map, buildingId, civs);
      if (!slots.length) continue;
      const option = buildingOption(civ, buildingId);
      const affordable = option.cost ? canAffordBuildCost(civ, option.cost) : true;
      out.push({ ...option, slots, affordable });
    }

    // Walls are not part of the race roster and can be built repeatedly, so
    // they're enumerated separately -- once per distinct wall building that
    // still has somewhere to go. Never gated by unlockedBuildings (universal,
    // every race) and never on the modern cost model (no unlocking tech, so
    // GameData.buildingBuildCost always returns null for these -- see
    // buildingOption's own fallback).
    for (const wallId of Object.keys(window.GameData.BUILDINGS || {})) {
      const b = window.GameData.getBuilding(wallId);
      if (!b || !b.isWall) continue;
      const slots = window.GameEngine.cities.validStructureSlots(city, civ, map, wallId, civs);
      if (!slots.length) continue;
      out.push({ ...buildingOption(civ, wallId), slots, affordable: true });
    }

    return out;
  }

  function chooseBuildAction(civ, city, gameState, weights) {
    const options = [];
    const { map, civs } = gameState;
    const race = window.GameData.getRace(civ.raceId);
    // Computed once per city -- see landmassHasSpareOpenTile. Gates BOTH the
    // ordinary building loop and the wall block below, since either kind of
    // structure closes off a tile the exact same way.
    const spareOpenTile = landmassHasSpareOpenTile(city.x, city.y, map, civs);
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
    // Settle-need roll (2026-07-30, user-directed): island-locked/no-coastal-
    // city/galley-waiting/tech-gate-desperation are near-mandatory
    // correctness needs, not a personality preference, so they bypass the
    // roll entirely -- see rollsForSettleNeed's doc comment. The ordinary
    // "there's a good site out there" desire (plus the softer
    // wantsNavalExpansion nudge) is what actually gets rolled against
    // militarism/aggressiveness.
    const pioneerUrgent = islandLocked || noCoastalCity || wantsNavalPioneer || pioneerTechGateBypass;
    const pioneerOrdinaryNeed = (hasViableSite || wantsNavalExpansion) && !pioneerUrgent;
    if (popOk && (!civHasPioneer || needsMorePioneers)
        && (pioneerUrgent || (pioneerOrdinaryNeed && civ._pioneerNeedRoll))
        && (pioneerAffordable || pioneerTechGateBypass)) {
      // Influence-per-population is now derived from industriousness (see
      // cities.js industriousnessInfluenceMult), not a per-race flat field --
      // a high-industriousness race gets each additional city scored as
      // worth more (and a low-industriousness race, like Orc, slightly less),
      // rather than this being a Halfellow-only special case.
      const settleInfluenceBonus = (window.GameEngine.cities.industriousnessInfluenceMult(race) - 1.0) * 30;
      // Net-city-loss taper (2026-07-23, user-directed): same fix as
      // chooseStrategy's and strategy.js's macroGoalScores' cityGateBonus --
      // don't keep sweetening the pioneer build score on tech-gate pressure
      // alone while this civ is net losing cities faster than founding them
      // (see recentCityDelta). A civ that's flat or growing sees no change.
      const cityDeltaForBuild = recentCityDelta(civ, gameState);
      const cityLossTaperForBuild = cityDeltaForBuild < 0 ? Math.max(0, 1 + cityDeltaForBuild * 0.25) : 1;
      const cityGateBonus = (cityGateShortfall > 0 ? cityGateShortfall * 10 : 0) * cityLossTaperForBuild;
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

    // "Radius fully filled" auto-settler (2026-07-22, user-directed): once
    // THIS city has nothing left to claim in its own radius, it should
    // SOMETIMES spin off an extra pioneer regardless of the normal viable-
    // site heuristics just above -- flagged (closestSpot) to skip tile-
    // score entirely and just grab the nearest legal spot once built (see
    // findClosestValidSettleSite/maybeFoundCity). Capped at one pioneer in
    // flight at a time (any kind, via totalPioneers from just above) so a
    // fully-grown empire doesn't spam settlers.
    const FULLY_FILLED_SETTLER_CHANCE = 0.10;
    if (totalPioneers === 0 && pioneerAffordable && !cityHasUnclaimedInfluenceTile(city, map)
        && Math.random() < FULLY_FILLED_SETTLER_CHANCE) {
      const opt = buildUnitOption(civ, "pioneer", 5 + expansionism * 6, unitCostMult);
      if (opt) { opt.closestSpot = true; options.push(opt); }
    }

    // Galley — coastal expansion; needs a pioneer aboard, island-locked, multi-city
    // naval push, or (once at least one galley already exists) a big enough
    // overseas-invasion backlog to justify expanding the fleet past one hull.
    // Also wanted outright, with no other reason needed, by a Dwarf civ whose
    // Titan is stalled waiting for a target -- see civNeedsTitanScouting --
    // since the only way to find an overseas enemy is to go looking by sea.
    const wantsTitanScouting = !civHasGalley && civNeedsTitanScouting(civ);
    // Settle-need roll (2026-07-30, user-directed): island-locked/a-pioneer-
    // already-waiting-to-board/Titan-scouting are urgent, near-mandatory
    // needs and bypass the roll; the ordinary naval-expansion/fleet-growth
    // desire gates on it -- see rollsForSettleNeed's doc comment.
    const galleyUrgent = islandLocked || civHasPioneer || wantsTitanScouting;
    const galleyOrdinaryNeed = (wantsNavalExpansion || wantsMoreGalleys) && !galleyUrgent;
    if (cityIsCoastal && (!civHasGalley || wantsMoreGalleys)
        && (galleyUrgent || (galleyOrdinaryNeed && civ._galleyNeedRoll))
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
      // Dwarf "Heavy Metal"/"Power Metal": the Troubadour's active aura used
      // to get a dedicated raw-stat credit here (TROUBADOUR_AURA_CREDIT) so
      // it could compete with FoeHammer/Musketeer on militaryValue despite
      // deliberately weak own stats (support unit, atk 2/def 3). Removed
      // (2026-07-30, user-directed): the Troubadour now has its own
      // dedicated `support` slot in RACE_UNIT_RATIO/RACE_UNIT_LINEAGES below,
      // which guarantees it gets built at its target share directly --
      // no raw-stat credit needed since a ratio-governed slot with a single
      // candidate id never has anything to compete against in the first place.
      const militaryValue = (id, forDefense) => {
        const ud = window.GameData.getUnit(id);
        const firstStrike = ud.firstStrikePct || 0;
        const rangeCredit = ownedRangedUnits < RANGED_UNIT_SATURATION && isRangedSkirmisher(id) ? RANGED_VALUE_CREDIT : 0;
        if (forDefense) return ud.defense + firstStrike * 60 + rangeCredit;
        const siegeCredit = ownedSiegeUnits < SIEGE_UNIT_SATURATION ? (ud.siegePct || 0) * 6 : 0;
        return ud.attack + firstStrike * 60 + siegeCredit + rangeCredit;
      };
      // Civ-wide unit-composition ratio (2026-07-30, user-directed;
      // generalizes what used to be an Elf-only special case): raw-stat
      // scoring (militaryValue above) always converges on a single "best"
      // unit -- fine for a race whose army is genuinely one dominant fighter
      // type, but every race's kit is really built around a MIX of roles
      // (frontline/shock/ranged/siege/support/...), so a pure stat-max pick
      // just spams whichever one currently scores highest instead of
      // fielding the intended composition. `bestByValue`'s pick is overridden
      // for any race with a RACE_UNIT_RATIO entry, targeting a fixed
      // composition among whichever of its role-lineages are actually
      // unlocked (and, for Wizard, actually worth building yet -- see
      // WIZARD_ABILITY_TECHS) so far.
      //
      // Grouped into role-LINEAGES rather than bare unit ids because several
      // races have a tech-tree upgrade chain within one role (Human's
      // cavalry -> knight -> paladin, archer -> longbowman) -- both tiers
      // stay in civ.unlockedUnits forever once unlocked, so the ratio target
      // applies to the lineage as a whole (owned+queued summed across every
      // id in it), and the specific id actually built is whichever one in
      // that lineage currently scores highest via militaryValue (always the
      // newest tier, since every later tier in these chains is strictly
      // better). A lineage with a single id (every non-Human race today)
      // collapses to exactly "always build that one when it's this role's
      // turn" -- Elf's old ranger/blade_dancer/awakened_oak behavior,
      // unchanged in effect, just expressed the same way as everyone else.
      //
      // Wizard/Trouble Maker/Troubadour used to have their own separate
      // scoring paths (UTILITY_UNIT_MECHANICS, TROUBADOUR_AURA_CREDIT) --
      // both removed; their `support` lineage entries below are now the only
      // thing governing how often they get built, on equal footing with
      // every other unit type. Druid stays on its own UTILITY_UNIT_MECHANICS
      // path (a summon-producer/settler, not a standing-army composition
      // slot). Orc's goblin_miscreant (affordability fallback) and dire_wolf
      // (shortage/drought-response) also stay out -- neither was ever a
      // "count vs. unlocked mechanics" scoring path, so there's nothing to
      // fold in. `undead` has no entry at all: only "skeleton" is a real
      // (non-stub) buildable unit today, so a ratio table would be a no-op --
      // falls through to the raw-militaryValue path below automatically,
      // same as any race whose unlocked lineages don't cover any candidate
      // yet.
      const RACE_UNIT_LINEAGES = {
        elf: {
          ranged: ["ranger"], shock: ["blade_dancer"], siege: ["awakened_oak"],
        },
        human: {
          frontline: ["spearguard"], shock: ["cavalry", "knight", "paladin"],
          ranged: ["archer", "longbowman"], siege: ["catapult", "trebuchet"],
          support: ["wizard"],
        },
        dwarf: {
          frontline: ["foehammer"], ranged: ["musketeer"], support: ["troubadour"],
          siege: ["runeforged_titan"],
        },
        orc: {
          frontline: ["raider"], defensive: ["impaler"], skirmish: ["wolf_rider"],
          ranged: ["bog_witch"], siege: ["battering_ram"], heavy: ["ogre"], capstone: ["dragon"],
        },
        halfellow: {
          frontline: ["wanderer"], skirmish: ["pony_patrol"], standing: ["militia"],
          support: ["trouble_maker"],
        },
      };
      const RACE_UNIT_RATIO = {
        elf:       { ranged: 0.5, shock: 0.2, siege: 0.3 },
        human:     { frontline: 0.25, shock: 0.25, ranged: 0.15, siege: 0.15, support: 0.20 },
        dwarf:     { frontline: 0.35, ranged: 0.25, support: 0.20, siege: 0.20 },
        orc:       { frontline: 0.25, defensive: 0.15, skirmish: 0.15, ranged: 0.15, siege: 0.10, heavy: 0.10, capstone: 0.10 },
        halfellow: { frontline: 0.25, skirmish: 0.30, standing: 0.25, support: 0.20 },
      };
      /** Whichever role-lineage sits furthest BELOW its target share of the
       *  current (owned + queued, summed across every id in that lineage)
       *  army among this race's ratio-covered roles -- a deficit-driven
       *  pick so the mix converges toward the target over time, rather than
       *  trying to enforce the ratio on any single build. Normalizes target
       *  shares against whichever subset of roles is currently eligible, so
       *  e.g. only having the frontline role unlocked so far just means
       *  100% frontline until the others catch up. Returns the specific
       *  unit id to build (the chosen lineage's currently-best-scoring
       *  unlocked tier), or null if this race has no ratio table or no
       *  eligible role yet. */
      function ratioPick(civ, table, lineages) {
        const eligible = (role) => lineages[role].some((id) => {
          if (!civ.unlockedUnits.has(id)) return false;
          if (id === "wizard") {
            return WIZARD_ABILITY_TECHS.some((m) => civ.unlockedMechanics && civ.unlockedMechanics.has(m));
          }
          return true;
        });
        const roles = Object.keys(table).filter((role) => table[role] > 0 && eligible(role));
        if (roles.length === 0) return null;
        const totalWeight = roles.reduce((s, role) => s + table[role], 0);
        const counts = {};
        for (const role of roles) {
          counts[role] = lineages[role].reduce((s, id) =>
            s + civ.units.filter((u) => u.typeId === id).length + countQueuedUnits(civ, (uid) => uid === id), 0);
        }
        const totalCount = roles.reduce((s, role) => s + counts[role], 0);
        let bestRole = null, bestDeficit = -Infinity;
        for (const role of roles) {
          const targetShare = table[role] / totalWeight;
          const deficit = targetShare * (totalCount + 1) - counts[role]; // +1: value of building this one next
          if (deficit > bestDeficit) { bestDeficit = deficit; bestRole = role; }
        }
        const unlockedInRole = lineages[bestRole].filter((id) => civ.unlockedUnits.has(id));
        return unlockedInRole.reduce((best, id) =>
          (!best || militaryValue(id, false) > militaryValue(best, false)) ? id : best, null);
      }
      const bestByValue = (forDefense) => {
        const table = RACE_UNIT_RATIO[civ.raceId];
        const lineages = RACE_UNIT_LINEAGES[civ.raceId];
        const picked = table ? ratioPick(civ, table, lineages) : null;
        if (picked) return picked;
        return unlockedMilitary.reduce((best, id) =>
          (!best || militaryValue(id, forDefense) > militaryValue(best, forDefense)) ? id : best, null);
      };

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
      // Undefended-city floor (2026-07-23, user-directed): distinct from
      // hasBestDefenderHere above -- that's true for BOTH "zero defenders"
      // and "has A defender, just not the ideal one," and scores them
      // identically. The zero case is the real emergency (this is exactly
      // how a founding/razing treadmill starts -- a brand-new city with no
      // garrison gets ground down by a single raider over a few turns, see
      // the 2026-07-23 balance-audit memory's Human/Halfellow findings), so
      // it gets its own floor, independent of this race's peacetime
      // militarism personality -- a low-militarism race (Halfellow 0.2)
      // could otherwise never clear the score needed to win the build slot
      // even once. Same "guarantee a floor" shape as the wall-gate and
      // utility-unit-taper precedents in this function.
      const hasAnyDefenderHere = civ.units.some((u) => u.x === city.x && u.y === city.y && isMilitaryLand(u.typeId));
      if (!hasBestDefenderHere && militaryCount < militaryCap) {
        // Garrison score: weighted by militarism; threat raises it; scaled by economic sustainability
        const UNDEFENDED_GARRISON_FLOOR_MILITARISM = 0.5;
        const baseGarrisonScore = (militarism * 8 + (underThreat ? agg * 4 : 0)) * militaryEconMult;
        const garrisonScore = hasAnyDefenderHere ? baseGarrisonScore
          : Math.max(baseGarrisonScore, (UNDEFENDED_GARRISON_FLOOR_MILITARISM * 8 + agg * 4) * militaryEconMult);
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
      //
      // Undefended-city gate (2026-07-23, user-directed): that taper alone
      // wasn't enough -- a first-copy Wizard's score (relevantMechanics.length
      // * 7, e.g. 49 for Human's 7 mechanics) still dwarfs even the new
      // undefended-garrison floor just above, so a brand-new, zero-defender
      // city would keep losing its build slot to Wizard anyway. Confirmed
      // directly as the mechanism behind Human's near-zero Spearguard counts
      // in the 2026-07-23 balance-audit memory. This city simply doesn't
      // propose a utility-unit build AT ALL while it has zero defenders --
      // same shape as the wall-gate's "zero walls until the civ has fielded
      // at least one real defender," just scoped to this one city instead of
      // civ-wide. Once it has any defender (even an outdated one), utility
      // builds compete normally again.
      if (militaryCount < militaryCap && hasAnyDefenderHere) {
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

    // Orc "Dire Wolf" combat-drought response (2026-07-22, user-directed):
    // no Orc unit has fought in DIRE_WOLF_DROUGHT_TURNS turns -- force-build
    // a Dire Wolf (which then hunts for combat on its own via
    // maybeDireWolfHunt) regardless of the ordinary shortage check above.
    // Guarded by "already have one alive or queued" rather than a one-shot
    // flag -- once that Dire Wolf either wins a fight (resetting the
    // counter via markCombatEngaged) or dies trying, this can fire again.
    if (orcHasDireWolfAvailable && (civ.turnsSinceCombat || 0) >= DIRE_WOLF_DROUGHT_TURNS) {
      const alreadyResponding = civ.units.some((u) => u.typeId === "dire_wolf")
        || countQueuedUnits(civ, (id) => id === "dire_wolf") > 0;
      if (!alreadyResponding) {
        const opt = buildUnitOption(civ, "dire_wolf", DIRE_WOLF_DROUGHT_BONUS, unitCostMult);
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
        if (!spareOpenTile) continue; // see landmassHasSpareOpenTile above
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
        // Modern multi-resource cost (see buildingOption) when this
        // building's unlocking tech defines one -- has to be affordable
        // RIGHT NOW to even be proposed, since maybeBuildInCities pays it up
        // front from the stockpile; the legacy coinCost model this replaces
        // never needed that check (it just accrues from city income over
        // time regardless of current balance).
        const option = buildingOption(civ, bId);
        if (option.cost && !canAffordBuildCost(civ, option.cost)) continue;
        options.push({ ...option, score: industriousness * 9 + 10 + influenceValue + deepGateBonus });
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
    if (wallGateOk && spareOpenTile && window.GameEngine.cities.findStructureSlot(city, civ, map, "wall_section", civs)) {
      const wallMechanicBonus = ["ramparts", "rouse_the_people", "hedge_walls"]
        .filter((m) => civ.unlockedMechanics && civ.unlockedMechanics.has(m)).length;
      const wallMult = 1 + wallMechanicBonus;
      options.push({ kind: "building", id: "wall_section",
        coinCost: window.GameData.getBuilding("wall_section").coinCost,
        score: ((militarism + industriousness) / 2) * 12 * wallMult });
    }

    // "Cultural Influence" (2026-07-21, user-directed): the tech-tree
    // capstone for every race (requires every OTHER tech in that civ's own
    // tree already researched -- see techs.js's programmatic prereqs at the
    // bottom of that file). A city with the mechanic unlocked and at least
    // one still-unclaimed tile in its own radius may spend several turns
    // and a large multi-resource cost to claim exactly one more -- same
    // power-based cost/turnsRemaining shape buildUnitOption uses, just
    // producing a claimed tile instead of a unit (see progressBuildQueue's
    // "influence" branch and performClaimInfluenceTile below). Deliberately
    // scored far below every real option (military/building/settle) so it
    // only ever wins the slot when nothing more useful is available this
    // turn -- exactly the late-game resource sink the surplus-stockpile
    // problem (see project_roads_upkeep_stall_review memory) calls for.
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("cultural_influence")
        && cityHasUnclaimedInfluenceTile(city, map)
        && canAffordBuildCost(civ, CULTURAL_INFLUENCE_COST)) {
      options.push({ kind: "influence", id: "cultural_influence",
        cost: { ...CULTURAL_INFLUENCE_COST }, turns: CULTURAL_INFLUENCE_TURNS, score: 1 });
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
  function spawnUnitInCity(civ, city, unitId, gameState, extra = {}) {
    const unitData = window.GameData.getUnit(unitId);
    const { map, civs } = gameState;
    let spawnX = city.x, spawnY = city.y;
    if (unitData.isNaval) {
      // Naval units must spawn on a water tile; expand search if nothing is directly adjacent
      const waterSpot = findAdjacentWater(city.x, city.y, map)
        || findNearestCoastalWaterFor(city.x, city.y, map, 10);
      if (waterSpot) { spawnX = waterSpot.x; spawnY = waterSpot.y; }
      // If still no water found, defer completion — don't strand galley on land
      if (spawnX === city.x && spawnY === city.y) return false;
    } else {
      // Land unit: the city's own tile is the default spawn point, but if
      // another unit is already standing there (a garrison, a unit that
      // just arrived this turn, ...) the new unit appears on the CLOSEST
      // open adjacent tile instead of stacking on top of it (2026-08-03,
      // user-reported). Falls back to the city tile anyway (accepting the
      // stack) only if literally every neighbor is also blocked -- same
      // last-resort convention the Goblin Miscreant bonus spawn below uses.
      const occupied = buildOccupancySet(civs, null);
      if (occupied.has(`${spawnX},${spawnY}`)) {
        const openSpot = findClosestOpenPlacementTile(spawnX, spawnY, map, civs, occupied, civ.id);
        if (openSpot) { spawnX = openSpot.x; spawnY = openSpot.y; }
      }
    }
    // `extra` merges in any caller-supplied fields (2026-07-22, user-
    // directed: progressBuildQueue passes `_useClosestSpotSettle` through
    // for a Pioneer built via chooseBuildAction's "radius fully filled"
    // trigger) -- spread AFTER the base fields so it can only add to them,
    // never silently override typeId/civId/position.
    const newUnit = { typeId: unitId, civId: civ.id, x: spawnX, y: spawnY, isCivilian: ["pioneer", "scout"].includes(unitId), homeCityName: city.name, ...extra };
    window.GameEngine.combat.initUnitHP(newUnit, civ);
    civ.units.push(newUnit);
    // Orc "Goblin Miscreant" (2026-07-15, user-directed): building one
    // actually produces two -- the second spawns on the closest open
    // adjacent tile to the city (not naval, and not stacked onto the same
    // tile as the first -- recomputed fresh AFTER newUnit above was already
    // pushed, so it correctly avoids that tile too), falling back to the
    // city's own tile if no neighbor is open at all. Cost/upkeep/build-time
    // are unaffected -- a pure 2-for-1 bonus, matching the unit's identity
    // as Orc's cheap, disposable gap-filler (see units.js's `cheap` flag
    // doc). Baked directly onto the unit by typeId, same convention as Bog
    // Witch's curseOnDeath, rather than a tech-effect flag, since Goblin
    // Miscreant only has the one unlock tech.
    if (unitId === "goblin_miscreant") {
      const bonusOccupied = buildOccupancySet(civs, null);
      const bonusSpot = findClosestOpenPlacementTile(city.x, city.y, map, civs, bonusOccupied, civ.id)
        || { x: city.x, y: city.y };
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

    // Power-based unit/building/influence build (see buildUnitOption/
    // unitBuildTurns, buildingOption/buildingBuildTurns, and
    // chooseBuildAction's Cultural Influence option): the cost was already
    // paid up front in maybeBuildInCities, so this is purely a countdown
    // independent of the city's income.
    if (item.turnsRemaining !== undefined) {
      item.turnsRemaining--;
      if (item.turnsRemaining > 0) return;
      if (item.kind === "influence") {
        performClaimInfluenceTile(city, gameState.map, log);
        city.buildQueue = null;
        return;
      }
      if (item.kind === "building") {
        completeBuildingStructure(civ, city, gameState, item, log);
        city.buildQueue = null;
        return;
      }
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
    // exactly as before. Any unit still on a legacy flat coinCost (none, as
    // of 2026-08-05 -- see buildUnitOption's own doc comment) would also
    // still flow through here, unchanged.
    const building = item.kind === "building" ? window.GameData.getBuilding(item.id) : null;
    const progressCap = building && building.minBuildTurns
      ? item.coinCost / building.minBuildTurns
      : coinThisTurn;
    item.progress += Math.min(coinThisTurn, progressCap);
    if (item.progress >= item.coinCost) {
      if (item.kind === "unit") {
        const extra = item.closestSpot ? { _useClosestSpotSettle: true } : undefined;
        if (!spawnUnitInCity(civ, city, item.id, gameState, extra)) return; // naval retry next turn
        log.push(`Build complete: ${city.name} produced ${item.id}`);
      } else {
        // Buildings are external structures placed on a tile adjacent to the
        // city -- item.placeAt is the tile a human player picked when they
        // queued this (see orders.js's queueBuild), honored if still legal.
        // Shared with the paid-up-front countdown branch above (2026-08-03)
        // so this placement/logging logic exists in exactly one place
        // regardless of which cost model got the building here.
        completeBuildingStructure(civ, city, gameState, item, log);
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
   * maybeApplyZombie) or removed via Array.prototype.filter (every death/
   * disband/founding site in this codebase), never reordered or spliced
   * back in elsewhere.
   */

  // "Defend" (2026-07-20, user-directed): a universal normal action -- any
  // race, any unit type. Braces in place, doubling this unit's own defense
  // (see combat.js's effectiveDefense) until the start of its own next
  // turn. No movement here -- callers may move first (a normal action
  // allows it, see project_turn_action_economy memory); this only performs
  // the "act" half.
  function performDefend(civ, unit, log) {
    window.GameEngine.combat.setCondition(unit, "defending", { expiresAtTurn: currentTurnNumber + 1 });
    unit.usedThisTurn = true;
    unit.currentMission = "Defending (braced, x2 defense until next turn)";
    log.push(`Defend: ${civ.id}'s ${describeUnit(unit)} braces at (${unit.x},${unit.y}), doubling its defense until its next turn`);
  }

  /** Whether ANY other unit of this civ (not carried -- it isn't really
   *  "there" independently) is within SUPPORT_RADIUS -- used by the
   *  cornered-defend fallback below (2026-07-21, user-directed): allies
   *  nearby mean this unit isn't truly alone, so bracing isn't its only
   *  option. Mirrors isNearActiveCombat's own SUPPORT_RADIUS use. */
  function hasNearbyAlly(civ, unit, gameState) {
    return civ.units.some((u) => u !== unit && !u.carriedBy
      && window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y) <= SUPPORT_RADIUS);
  }

  /** Nearest visible, non-hidden enemy unit to (x,y), or null -- used by the
   *  flee check below to know which direction is actually "away." */
  function findNearestVisibleEnemy(civ, x, y, gameState) {
    const { civs, map } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    let nearest = null, nearestDist = Infinity;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.conditions?.hidden || !visible.has(eu.y * map.width + eu.x)) continue;
        const d = window.GameEngine.influence.chebyshev(x, y, eu.x, eu.y);
        if (d < nearestDist) { nearestDist = d; nearest = eu; }
      }
    }
    return nearest;
  }

  /** An adjacent tile this unit could step to that's strictly farther from
   *  `threat` than its current tile, passable for its own movement type
   *  (naval/land/flying -- see getMoveCost), and not already occupied.
   *  Returns {x,y}, or null if genuinely cornered -- exactly what "cannot
   *  run away" means for the fallback below. */
  function findFleeTile(civ, unit, threat, gameState) {
    const { map, civs } = gameState;
    const TERRAIN = window.GameData.TERRAIN;
    const unitData = window.GameData.getUnit(unit.typeId);
    const curDist = window.GameEngine.influence.chebyshev(unit.x, unit.y, threat.x, threat.y);
    // Every candidate here is one hop FROM the unit's own current tile, so
    // that's the fixed origin for all of them -- see getMoveCost's doc
    // comment for why origin/destination are no longer the same tile.
    const originTile = map.tiles[unit.y * map.width + unit.x];
    const originTerrain = TERRAIN[originTile.terrain];
    let best = null, bestDist = curDist;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = unit.x + dx, ny = unit.y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        const tile = map.tiles[ny * map.width + nx];
        if (getMoveCost(originTerrain, TERRAIN[tile.terrain], unitData, unit, originTile.hasRoad) === window.GameData.IMPASSABLE) continue;
        if (Object.values(civs).some((c) => c.units.some((u) => u.x === nx && u.y === ny))) continue;
        const d = window.GameEngine.influence.chebyshev(nx, ny, threat.x, threat.y);
        if (d > bestDist) { bestDist = d; best = { x: nx, y: ny }; }
      }
    }
    return best;
  }

  /** Cornered-combat fallback, replacing the old unconditional brace
   *  (2026-07-21, user-directed): an idle unit already in a fight (see
   *  nearActiveCombat at this function's call site) only braces
   *  (performDefend) when it's BOTH unable to retreat AND has no ally
   *  nearby to back it up. Otherwise it flees (a retreat tile exists,
   *  checked first -- self-preservation wins even with allies close by) or,
   *  failing that, simply holds its ground without the defense bonus (allies
   *  are close enough to help, even though this unit itself is cornered).
   *  Always consumes the unit's turn -- callers can just `continue` after. */
  function handleCorneredCombat(civ, unit, gameState, log) {
    const threat = findNearestVisibleEnemy(civ, unit.x, unit.y, gameState);
    const fleeTile = threat && findFleeTile(civ, unit, threat, gameState);
    if (fleeTile) {
      moveUnitToward(unit, fleeTile.x, fleeTile.y, gameState.map, gameState.civs);
      unit.usedThisTurn = true;
      unit.currentMission = `Falling back to (${fleeTile.x},${fleeTile.y})`;
      log.push(`Flee: ${civ.id}'s ${describeUnit(unit)} falls back to (${fleeTile.x},${fleeTile.y})`);
      return;
    }
    if (hasNearbyAlly(civ, unit, gameState)) {
      unit.usedThisTurn = true;
      unit.currentMission = "Holding the line alongside nearby allies";
      return;
    }
    performDefend(civ, unit, log);
  }

  // How much of its max HP a unit must be missing before Resting is worth
  // the turn -- previously any missing HP at all triggered Rest, which
  // wasted turns topping off scratch damage. 0.9 keeps Rest close to its old
  // generous behavior (it's still the last resort after every other branch
  // in this cascade already passed) while giving "how low" an actual answer.
  const REST_HP_THRESHOLD = 0.9;

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

      // Damage-since-last-turn tracking (2026-07-30, user-directed): a unit
      // that was hit by anything (combat, a city/structure counter, Burning,
      // ...) since the last time IT acted can't choose to Rest this turn --
      // a snapshot comparison rather than instrumenting every damage call
      // site, so it catches every damage source uniformly. `_hpAtTurnStart`
      // is undefined the very first time a unit is ever processed, which
      // correctly reads as "not recently damaged" (nothing to compare against).
      const recentlyDamaged = unit._hpAtTurnStart != null && unit.hp < unit._hpAtTurnStart;
      unit._hpAtTurnStart = unit.hp;

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
      // Teleportation above -- self-flee first, then (2026-07-21,
      // user-directed) an ally-rescue play: a badly hurt ADJACENT ally gets
      // blinked to safety instead when the Druid itself isn't the one in
      // danger. See attemptDruidTeleport/findAdjacentHurtAlly.
      if (unit.typeId === "druid" && civ.unlockedMechanics && civ.unlockedMechanics.has("roots_of_the_world")) {
        if (unit.hp < unit.maxHp * 0.4 && attemptDruidTeleport(civ, unit, unit, gameState, log)) {
          continue;
        }
        const hurtAlly = findAdjacentHurtAlly(civ, unit);
        if (hurtAlly && attemptDruidTeleport(civ, unit, hurtAlly, gameState, log)) {
          continue;
        }
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
        if (unit.typeId === "galley" && maybeGalleyFishingPlay(civ, unit, gameState, log)) continue;
        operateGalley(civ, unit, gameState, log);
        continue;
      }

      // Elf staged invasion (2026-07-21, user-directed): a unit ferried to
      // an overseas staging ground (see maybeRootsInvasionFerry's
      // `_ambushTarget` stamp) hides and WAITS for the rest of the force
      // before anyone attacks -- checked ahead of every generic combat/
      // stealth branch so a lone arrival never picks its own fight early.
      // Falls through (returns false) the moment the force is strong
      // enough, letting this same turn's normal cascade launch the ambush.
      if (maybeInvasionAmbushWait(civ, unit, gameState, log)) continue;

      // Halfellow "fight smarter, not harder": before committing to a
      // straight fight, weigh going Hidden instead (defensively when
      // outmatched, or offensively to set up an ambush) -- see
      // maybeHalfellowStealthPlay. Only ever preempts the turn when hiding
      // actually wins out; otherwise falls through to the normal cascade.
      if (maybeHalfellowStealthPlay(civ, unit, gameState, weights, difficulty, log)) continue;

      // Halfellow "Riddle" (Wanderer -- Trouble Maker's own use lives in
      // maybeTroubleMakerPlay above): a proactive debuff play, checked
      // before Envoy since disabling a real threat outranks an economy
      // action. See maybeRiddlePlay's doc comment.
      if (unit.typeId === "wanderer" && maybeRiddlePlay(civ, unit, gameState, log)) continue;

      // Halfellow "Envoy" (Wanderer only -- Pioneer's own equivalent lives
      // in maybeFoundCity): opportunistic, lower priority than combat/
      // stealth above, so only fires when a Wanderer has nothing more
      // urgent to do. See maybeEnvoyPlay's doc comment.
      if (unit.typeId === "wanderer" && maybeEnvoyPlay(civ, unit, gameState, log)) continue;

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

      // Halfellow Trouble Maker: proactive use of Resource Heist/Unlock the
      // Gate/Riddle -- see maybeTroubleMakerPlay's doc comment.
      if (maybeTroubleMakerPlay(civ, unit, gameState, log)) continue;

      // Elf "Shadowsteed" + Druid (2026-07-22, user-directed): a mounted
      // Shadowsteed carrying a Druid rider can also cast Nature's Grace
      // itself, at the same range the Druid would have (effectiveRange
      // already defers to the rider for a mounted Shadowsteed -- see
      // combat.js's shadowsteedMount). Without this, the ability is
      // completely unusable for as long as the Druid stays mounted, since a
      // carried unit's own turn is fully consumed just by being carried
      // (see the carriedBy skip at the top of this loop). Deliberately just
      // Nature's Grace, not the Druid's whole kit (maybeElfDruidPlay) --
      // summons/Roots of the World don't make sense for the Shadowsteed to
      // perform on the Druid's behalf.
      if (unit.typeId === "shadowsteed" && unit.carries && unit.carries.typeId === "druid"
          && civ.unlockedMechanics && civ.unlockedMechanics.has("natures_grace")
          && maybeNaturesGrace(civ, unit, gameState, log)) {
        continue;
      }

      // Elf Druid: Nature's Grace healing, Raptor/Shadowsteed summon
      // management, and Roots of the World expansion -- see maybeElfDruidPlay.
      if (maybeElfDruidPlay(civ, unit, gameState, weights, difficulty, log)) continue;

      // Elf Blade Dancer: Whirlwind Strike/Blade Storm -- checked before the
      // ordinary single-target attack below, since a worthwhile sweep (2+
      // clustered enemies) always beats concentrating full damage on one
      // target. See maybeBladeDancerSweep.
      if (maybeBladeDancerSweep(civ, unit, gameState, log)) continue;

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

      // Dwarf/Halfellow "rush to defend" (2026-07-30, user-directed): a city
      // under attack right now gets first claim on any unit that isn't
      // already fighting its own battle -- see maybeDefendCityUnderAttack's
      // doc comment. Checked immediately after nearActiveCombat (its own
      // exemption) and before every other race-specific vanguard/positioning
      // branch below, so it actually preempts them instead of just
      // occasionally winning by luck of the cascade order.
      if ((civ.raceId === "dwarf" || civ.raceId === "halfellow")
          && maybeDefendCityUnderAttack(civ, unit, gameState, nearActiveCombat, log)) continue;

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
        unit.usedThisTurn = true;
        // Recently-damaged Titans skip the heal here too (see recentlyDamaged
        // above) but still hold position awaiting a target.
        unit.currentMission = "Holding position, awaiting a target city";
        if (!recentlyDamaged) unit.resting = true;
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

      // Halfellow "Devoted Companions": an injured ally a carrier is already
      // en route to fetch holds position and waits instead of wandering off
      // mid-rescue (2026-07-22, user-directed) -- see
      // maybeWaitForCompanionCarry. Checked before the carrier-side plays
      // below since it's the PATIENT's own turn deciding this, not the
      // carrier's.
      if (civ.raceId === "halfellow" && maybeWaitForCompanionCarry(civ, unit, gameState, log)) continue;

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

      // Elf "Shadowsteed" mount, reverse half (2026-07-21, user-directed): a
      // riderless Ranger with a nearby riderless Shadowsteed goes to mount it
      // -- outranks regrouping with fellow Rangers below, since mounting up
      // is the bigger combat upgrade. See maybeSeekRiderlessShadowsteed.
      if (unit.typeId === "ranger" && maybeSeekRiderlessShadowsteed(civ, unit, gameState, log)) continue;

      // Elf Ranger "hidden groups" (user-directed): Rangers tend to move in
      // groups, ready to synchronize a volley -- see maybeRangerRegroup. The
      // actual synchronized-attack half is a target-selection bonus in
      // considerAttackOrGarrison (RANGER_VOLLEY_BONUS), not here -- this only
      // handles closing the distance so a lone Ranger isn't off skirmishing
      // solo when it could be forming up with siblings first.
      if (unit.typeId === "ranger" && maybeRangerRegroup(civ, unit, gameState, log)) continue;

      // Elf "hunting party" (2026-07-30, user-directed): non-Ranger military
      // units mass into stealthed packs of 3+ the same way -- see
      // maybeElfHuntingPartyRegroup's doc comment. Checked right after the
      // Ranger pack above (same cascade position, same rationale: forming up
      // wins out over a lone unit's curiosity) and before maybeElfStealthPlay
      // further down, so a unit already short of its party keeps closing the
      // distance rather than vanishing solo first.
      if (civ.raceId === "elf" && maybeElfHuntingPartyRegroup(civ, unit, gameState, log)) continue;

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
        // Only actually commits to this turn if exploreWith did something --
        // it's a real no-op (no move, no flag) once this civ's reachable
        // world is fully explored (findNearestUnseenTile finds nothing),
        // which is common by mid/late game on these map sizes. Falling
        // through to the garrison/hunt/defend cascade below instead of
        // unconditionally ending the turn here means a unit that rolled
        // "explore" but had nothing left to explore still gets a real shot
        // at a useful job, rather than silently doing nothing this turn --
        // confirmed live as the PRIMARY source of Halfellow's Pony Patrol
        // sitting fully idle ~20-30% of the time (this roll fires often,
        // clamped to at least 15% per explorePostureFor, well before the
        // final exploreWith fallback further down -- which already has its
        // own matching no-op guard -- ever gets a turn). See the 2026-07-23
        // round-4 balance-audit memory.
        const preX = unit.x, preY = unit.y;
        exploreWith(unit, gameState, log);
        if (unit.x !== preX || unit.y !== preY || unit.usedThisTurn) continue;
      }

      // Halfellow "Keep an Eye Out" (2026-07-24, user-directed; relocated
      // same day after live diagnosis): originally checked WAY down this
      // cascade, right before patrolRaceTerrain -- direct instrumentation
      // showed that placement was fatally crowded: over 150 turns of a real
      // Halfellow game, 610 unit-turns reached this function, but only 4
      // ever got as far as pushTowardInfluenceFrontier (several dozen lines
      // above patrolRaceTerrain), meaning the OLD check was never reached at
      // all -- garrison-rest, huntNearestEnemy's roll, the offense/reinforce
      // branch, and pushTowardInfluenceFrontier itself were already
      // consuming essentially every turn first. Moved here instead, right
      // where garrison-rest is about to make its own bid for the same idle
      // turn (the two are thematically the same choice -- "stay put and do
      // something passive instead of patrolling/exploring" -- lookout duty
      // just adds vision + stealth instead of just healing) so it actually
      // gets a fair, real chance most turns rather than being buried under
      // 7-8 more gates it will essentially never survive to reach.
      const KEEP_AN_EYE_OUT_PREEMPT_CHANCE = 0.25;
      if (!nearActiveCombat && Math.random() < KEEP_AN_EYE_OUT_PREEMPT_CHANCE
          && maybeKeepAnEyeOutPlay(civ, unit, gameState, log)) {
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
      const garrisonDesireBoost = (civ.raceId === "dwarf" || civ.raceId === "halfellow")
        ? GARRISON_DESIRE_BOOST_DWARF_HALFELLOW : GARRISON_DESIRE_BOOST;
      const garrisonDesire = Math.min(1,
        Math.max(militarism, industriousness * INDUSTRIOUSNESS_GARRISON_WEIGHT) * garrisonDesireBoost);
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

      // A unit already IN a fight (adjacent to an enemy, or supporting an
      // ally who is) that didn't attack this turn -- declined above, or
      // nothing scored well enough -- reacts instead of getting pulled away
      // by one of the generic hunt/raid/reinforce branches below. Those are
      // for finding a DIFFERENT job when there's nothing to react to right
      // now, not for abandoning a fight already underway; without this
      // check they fired unconditionally regardless of nearActiveCombat and
      // silently ate the unit's turn before Defend/Rest further down ever
      // got a look-in. Every race-specific tactical branch above (Shield
      // Wall, Crusade, Titan, Prospector's Claim, garrison, ...) still gets
      // first refusal, unaffected -- this only intercepts the generic tail.
      // 2026-07-20, user-directed. The reaction itself is no longer an
      // unconditional brace (2026-07-21, user-directed): see
      // handleCorneredCombat -- flee if there's an open retreat tile, just
      // hold the line if allies are close enough to help, and only brace
      // (performDefend) when truly cornered AND alone.
      if (nearActiveCombat) {
        handleCorneredCombat(civ, unit, gameState, log);
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

      // Damaged and nothing better to do: Rest to heal, but only when it's
      // actually safe (see REST_HP_THRESHOLD above for "how low"). Safety is
      // no longer this check's job -- nearActiveCombat is unconditionally
      // intercepted earlier now (see the Defend check above), so by the
      // time execution reaches here it's already guaranteed false. 2026-07-20,
      // user-directed. A unit hit since its own last turn skips this branch
      // entirely (2026-07-30, user-directed: no resting-to-heal the very
      // turn after taking damage) and falls through to the rest of the
      // cascade below instead.
      if (unit.hp < unit.maxHp * REST_HP_THRESHOLD && !recentlyDamaged) {
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
      // nearActiveCombat is always false by this point (the unconditional
      // Defend check earlier in this cascade already intercepted every true
      // case), kept here regardless as the original defensive condition.
      // 2026-07-20, user-directed.
      const racePatrolled = patrolRaceTerrain(civ, unit, gameState);
      if (!racePatrolled && !nearActiveCombat) {
        if (explorable) {
          const preX = unit.x, preY = unit.y;
          exploreWith(unit, gameState, log);
          // True terminal fallback (2026-07-23, user-directed -- see the
          // 2026-07-23 round-4 balance-audit memory): exploreWith can be a
          // complete no-op (findNearestUnseenTile returns null once this
          // civ's reachable world is fully explored -- common by mid/late
          // game on these map sizes) and neither moves the unit nor sets
          // any flag, same for patrolRaceTerrain just above (returns false
          // when no preferred terrain is nearby). Every branch above this
          // one is conditional/probabilistic, so a unit that's low-
          // aggression (rarely hunts), off its home city (garrison-rest
          // never triggers), and has nothing left to explore could fall
          // through this entire cascade and take NO action at all --
          // confirmed live via direct instrumentation as a real, frequent
          // outcome for Halfellow's Pony Patrol specifically (~20% of its
          // unit-turns). Mirrors the neverExplores branch's own "hold
          // position and heal" fallback immediately below -- if exploreWith
          // didn't actually do anything, do that same thing instead of
          // leaving the unit with no action at all this turn.
          if (unit.x === preX && unit.y === preY && !unit.usedThisTurn) {
            if (!maybeKeepAnEyeOutPlay(civ, unit, gameState, log)) {
              // Recently-damaged units still can't choose to rest here (see
              // recentlyDamaged above) -- left with no action at all this
              // turn instead, same as the already-precedented "genuinely
              // nothing to do" outcome this fallback exists for.
              if (!recentlyDamaged) {
                unit.resting = true;
                unit.usedThisTurn = true;
                unit.currentMission = "Nothing left to explore nearby — holding position (resting)";
              }
            }
          }
        } else {
          // neverExplores (Dwarf Runeforged Titan): hold position and heal
          // rather than wander off -- see units.js's doc comment on the flag.
          // Recently-damaged units skip the heal (see recentlyDamaged above)
          // but still hold position rather than wandering off.
          unit.usedThisTurn = true;
          if (!recentlyDamaged) {
            unit.resting = true;
            unit.currentMission = "Holding position (never explores)";
          } else {
            unit.currentMission = "Holding position (recovering from a hit, not resting)";
          }
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
      caster.currentMission = `Teleported a ${describeUnit(targetUnit)} to (${landing.x},${landing.y}) (exhausted, must rest)`;
      log.push(`Teleport: ${civ.id}'s Wizard teleported a ${describeUnit(targetUnit)} to (${landing.x},${landing.y}), Wizard exhausted until fully healed`);
    }
    return true;
  }

  // How far a Wizard's Freezing Touch can reach -- a "touch" spell, so short
  // range rather than Teleportation's whole-map reach. Same order of
  // magnitude as Halfellow's short-range tactical checks (HALFELLOW_STEALTH_RANGE).
  const FREEZING_TOUCH_RANGE = 2;
  const FROZEN_DURATION = 3;

  // Burning (2026-07-22, user-directed): 1 point of damage at the start of
  // the affected target's turn for this many turns, unless it's currently
  // on Coast, Ocean, or a river tile -- see turns.js's tickBurningDamage
  // for where the actual per-turn damage/exemption/expiry lives (ticked
  // once per civ-turn, uniformly for every civ, not just AI-controlled
  // ones; never applies to cities themselves, only units and buildings/
  // walls -- 2026-07-22, user-directed). This file only ever APPLIES the
  // condition, at the two mechanics that grant it -- Orc "Burn It All
  // Down" and Human "Fireball!" (both checked in considerAttackOrGarrison,
  // right after resolveRound).
  const BURN_DURATION = 3;

  /** Stamps the Burning condition onto `target` for BURN_DURATION turns
   *  from now, refreshing (not stacking) if it's already burning. `kind`
   *  selects where the flag lives: a unit keeps it in `.conditions.burning`
   *  (so it gets the same fire badge as every other condition -- see
   *  render.js's CONDITION_ICONS); a structure (no `.conditions` container
   *  of its own) keeps a plain `.burning` field directly. Never applied to
   *  cities themselves (2026-07-22, user-directed). */
  function applyBurning(target, kind, gameState) {
    const expiresAtTurn = (gameState.turnNumber || 0) + BURN_DURATION;
    if (kind === "unit") {
      window.GameEngine.combat.setCondition(target, "burning", { expiresAtTurn });
    } else {
      target.burning = { expiresAtTurn };
    }
  }

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
    caster.currentMission = `Froze ${target.civId}'s ${describeUnit(target)} at (${target.x},${target.y})`;
    log.push(`Freezing Touch: ${civ.id}'s Wizard freezes ${target.civId}'s ${describeUnit(target)} at (${target.x},${target.y})`);
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

    // Freezing Touch is a normal action (2026-07-20, user-directed): the
    // Wizard may close distance and still cast the same turn, so candidates
    // are gathered out to spell range PLUS however far it can still walk
    // this turn -- not just the old in-range-only search -- see
    // project_turn_action_economy memory. `reach` is a cheap upper bound
    // (straight-line Chebyshev, ignoring terrain cost); tryFreeze below
    // re-checks the REAL post-move distance before casting.
    const reach = FREEZING_TOUCH_RANGE + (unit.movesRemaining ?? computeMovementBudget(unit, map, civs));

    const candidates = [];
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.conditions?.hidden || eu.conditions?.frozen) continue;
        if (!visible.has(eu.y * map.width + eu.x)) continue;
        if (window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y) > reach) continue;
        candidates.push(eu);
      }
    }
    if (candidates.length === 0) return false;

    // Moves into spell range if not already there, then casts -- only if
    // the move actually closes enough distance this turn (a target that
    // turns out to be unreachable this turn is left for a later turn, not
    // half-chased).
    const tryFreeze = (eu) => {
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y) > FREEZING_TOUCH_RANGE) {
        moveTowardWithStandoff(civ, unit, eu.x, eu.y, map, civs, FREEZING_TOUCH_RANGE);
        if (window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y) > FREEZING_TOUCH_RANGE) return false;
      }
      performFreezingTouch(civ, unit, eu, log);
      return true;
    };

    for (const eu of candidates) {
      if (estimateWinProbability(unit, eu, civs, {}, 20) < threshold) {
        if (tryFreeze(eu)) return true;
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
        if (tryFreeze(eu)) return true;
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
    caster.currentMission = `Granted flight to ${describeUnit(target)} at (${target.x},${target.y})`;
    log.push(`Flight: ${civ.id}'s Wizard grants flight to their ${describeUnit(target)} at (${target.x},${target.y})`);
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
    const { map, civs } = gameState;
    // Grant Flight is a normal action (2026-07-20, user-directed): the
    // Wizard may walk to an ally's side and still cast the same turn, so
    // candidates are gathered out to adjacency PLUS however far it can
    // still walk this turn -- see maybeFreezingTouch/project_turn_action_
    // economy memory for the same pattern.
    const reach = 1 + (unit.movesRemaining ?? computeMovementBudget(unit, map, civs));
    let best = null, bestPower = -1;
    for (const ally of civ.units) {
      if (ally === unit || ally.carriedBy) continue;
      if (window.GameData.getUnit(ally.typeId).category !== "military") continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > reach) continue;
      if (window.GameEngine.combat.isFlying(ally)) continue;
      const power = unitCombatPower(ally, civ);
      if (power > bestPower) { bestPower = power; best = ally; }
    }
    if (!best) return false;
    if (window.GameEngine.influence.chebyshev(unit.x, unit.y, best.x, best.y) > 1) {
      moveTowardWithStandoff(civ, unit, best.x, best.y, map, civs, 1);
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, best.x, best.y) > 1) return false;
    }
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
      unit.currentMission = `Teleported a ${describeUnit(strikeUnit)} to strike ${target.targetCiv.id}'s ${target.kind} at (${target.x},${target.y})`;
      log.push(`Teleport Strike: ${civ.id}'s Wizard teleports a ${describeUnit(strikeUnit)} against ${target.targetCiv.id}'s ${target.kind} at (${target.x},${target.y})`);
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

  /** Finds the nearest known Gold OR Iron Vein tile (currently visible OR
   *  remembered via tileMemory) that isn't already being claimed by one of
   *  this civ's OTHER units, within a reasonable search radius. Returns
   *  {x,y,landmassId} or null. Mirrors findNearbyUnclaimedRuin above --
   *  see Dwarf "Prospector's Claim", including the `sameLandmassOnly`
   *  option and the reason it exists. Iron Veins qualify too (2026-07-21,
   *  user-directed) at their own, separate payout -- see turns.js. */
  function findNearbyUnclaimedGoldVein(civ, unit, gameState, options = {}) {
    const { map } = gameState;
    const SEARCH_RADIUS = 20;
    const memory = (gameState.tileMemory && gameState.tileMemory[civ.id]) || {};
    const claimedByOther = new Set(
      civ.units
        .filter((u) => u !== unit && (u._ritualTurns || 0) >= 1)
        .map((u) => `${u.x},${u.y}`)
    );
    const isVeinResource = (r) => r === "gold" || r === "iron";
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    let best = null, bestDist = Infinity;
    for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy++) {
      for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx++) {
        const x = unit.x + dx, y = unit.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const idx = y * map.width + x;
        const isVein = isVeinResource(map.tiles[idx].resource) || (memory[idx] && isVeinResource(memory[idx].resource));
        if (!isVein || claimedByOther.has(`${x},${y}`)) continue;
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
  /**
   * Cash-out decision for a channeling unit (Prospector's Claim/Dungeon
   * Delve/Fishing), 2026-07-24 user-directed: since the payout redesign
   * (see turns.js's accumulateChannelStash/bankChannelStash), a channel
   * that's never voluntarily stopped never actually delivers its stash to
   * the civ -- it just accumulates forever, which is worse than the old
   * instant-payout behavior, not better. Cashes out (delivers the stash,
   * clears the channel) once either: the stash is worth banking (flat
   * value threshold, resource-agnostic) or a visible enemy has closed to a
   * "getting risky" distance -- banking pre-emptively before a possible
   * attack (or a Halfellow Trouble Maker's Resource Heist) is strictly
   * better than losing it all to one. Returns true if it cashed out (and
   * thus consumed the turn resting on the spot, same as continuing to
   * channel would have). */
  const CHANNEL_CASHOUT_VALUE = 15;
  const CHANNEL_CASHOUT_ENEMY_RADIUS = 4;
  function maybeCashOutChannel(civ, unit, gameState, log, channelLabel) {
    const stash = unit._channelStash;
    const stashValue = stash ? (stash.harvest || 0) + (stash.coin || 0) + (stash.lore || 0) : 0;
    let nearestEnemyDist = Infinity;
    if (stashValue > 0) {
      const { civs } = gameState;
      const visible = gameState.visibility[civ.id] || new Set();
      const { map } = gameState;
      for (const oc of Object.values(civs)) {
        if (oc.id === civ.id || oc.eliminated) continue;
        for (const eu of oc.units) {
          if (!visible.has(eu.y * map.width + eu.x) || eu.conditions?.hidden) continue;
          const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y);
          if (d < nearestEnemyDist) nearestEnemyDist = d;
        }
      }
    }
    if (stashValue < CHANNEL_CASHOUT_VALUE && nearestEnemyDist > CHANNEL_CASHOUT_ENEMY_RADIUS) return false;
    unit.channeling = null;
    window.GameEngine.turns.bankChannelStash(unit, civ);
    unit.resting = true;
    unit.usedThisTurn = true;
    unit.currentMission = `Cashed out ${channelLabel} (banked the stash)`;
    log.push(`${channelLabel}: ${civ.id}'s ${describeUnit(unit)} cashes out and banks its stash`);
    return true;
  }

  /** Nearest visible enemy unit currently channeling (prospecting/delving/
   *  fishing) with a non-empty stash -- Resource Heist's target pool.
   *  Within `radius` tiles (search range, not the melee-adjacency Resource
   *  Heist itself requires to execute -- see maybeResourceHeistPlay). */
  function findResourceHeistTarget(civ, unit, gameState, radius = 8) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    let best = null, bestDist = Infinity;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (!eu.channeling || eu.conditions?.hidden) continue;
        const stash = eu._channelStash;
        if (!stash || ((stash.harvest || 0) + (stash.coin || 0) + (stash.lore || 0)) <= 0) continue;
        if (!visible.has(eu.y * map.width + eu.x)) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y);
        if (dist > radius) continue;
        if (dist < bestDist) { bestDist = dist; best = eu; }
      }
    }
    return best;
  }

  /**
   * Halfellow "Resource Heist" (2026-07-24, user-directed): built into
   * Trouble Maker, no separate tech. Adjacent to an enemy unit that's
   * actively channeling (Prospector's Claim/Dungeon Delve/Fishing) with a
   * non-empty stash, steals the WHOLE stash straight into this civ's own
   * stockpile (window.GameEngine.turns.bankChannelStash is civ-agnostic --
   * see its doc comment) and resets the victim's channel to zero (clears
   * `channeling`; the territorial claim/ritual-turn cleanup then happens
   * naturally next beginCivTurn via the normal "no longer on anchor" path).
   * The victim is left Befuddled either way. If this Trouble Maker is
   * currently Hidden, it has a curiosity*0.75 chance (the victim's race's
   * curiosity) of being spotted and revealed -- otherwise the heist goes
   * fully unnoticed. Returns true if it consumed the turn (either executing
   * the heist, or closing distance toward a target). */
  function maybeResourceHeistPlay(civ, unit, gameState, log) {
    if (unit.typeId !== "trouble_maker" || !civ.unlockedMechanics || !civ.unlockedMechanics.has("resource_heist")) return false;
    const target = findResourceHeistTarget(civ, unit, gameState);
    if (!target) return false;
    const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, target.x, target.y);
    if (dist > 1) {
      moveUnitToward(unit, target.x, target.y, gameState.map, gameState.civs);
      unit.usedThisTurn = true;
      unit.currentMission = `Sneaking up on ${target.civId}'s ${describeUnit(target)} to steal its claim`;
      return true;
    }
    const targetCiv = gameState.civs[target.civId];
    window.GameEngine.turns.bankChannelStash(target, civ);
    target.channeling = null;
    window.GameEngine.combat.applyBefuddled(target, currentTurnNumber);
    let spotted = false;
    if (window.GameEngine.combat.hasCondition(unit, "hidden")) {
      const targetRace = window.GameData.getRace(targetCiv.raceId);
      const revealChance = (targetRace.curiosity ?? 0.5) * 0.75;
      if (Math.random() < revealChance) {
        window.GameEngine.combat.revealHidden(unit, currentTurnNumber);
        spotted = true;
      }
    }
    unit.usedThisTurn = true;
    unit.currentMission = `Robbed ${targetCiv.id}'s ${describeUnit(target)} of its claim`;
    log.push(`Resource Heist: ${civ.id}'s ${describeUnit(unit)} steals ${targetCiv.id}'s ${describeUnit(target)}'s accumulated claim` +
      (spotted ? " and is spotted doing it" : ""));
    return true;
  }

  /** Nearest visible enemy wall not already suppressed -- Unlock the Gate's
   *  target pool. Within `radius` tiles. */
  function findUnlockTheGateTarget(civ, unit, gameState, radius = 8) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    let best = null, bestDist = Infinity;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const city of otherCiv.cities) {
        for (const s of city.structures) {
          if (!window.GameData.getBuilding(s.id).isWall) continue;
          if (window.GameEngine.combat.isWallDefenseSuppressed(s, currentTurnNumber)) continue;
          if (!visible.has(s.y * map.width + s.x)) continue;
          const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, s.x, s.y);
          if (dist > radius) continue;
          if (dist < bestDist) { bestDist = dist; best = { structure: s, city, civId: otherCiv.id }; }
        }
      }
    }
    return best;
  }

  /**
   * Halfellow "Unlock the Gate" (2026-07-24, user-directed): built into
   * Trouble Maker, no separate tech. Adjacent to a targeted enemy wall,
   * disables it AND every wall adjacent to it (chebyshev <= 1 from the
   * target, same city) for 3 rounds -- see combat.js's
   * isWallDefenseSuppressed, checked at every wall-defense call site.
   * Returns true if it consumed the turn (executing, or closing distance).
   */
  const UNLOCK_THE_GATE_ROUNDS = 3;
  function maybeUnlockTheGatePlay(civ, unit, gameState, log) {
    if (unit.typeId !== "trouble_maker" || !civ.unlockedMechanics || !civ.unlockedMechanics.has("unlock_the_gate")) return false;
    const target = findUnlockTheGateTarget(civ, unit, gameState);
    if (!target) return false;
    const { structure, city } = target;
    const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, structure.x, structure.y);
    if (dist > 1) {
      moveUnitToward(unit, structure.x, structure.y, gameState.map, gameState.civs);
      unit.usedThisTurn = true;
      unit.currentMission = `Sneaking up on ${target.civId}'s wall at (${structure.x},${structure.y})`;
      return true;
    }
    const expiresAtTurn = currentTurnNumber + UNLOCK_THE_GATE_ROUNDS;
    let affected = 0;
    for (const s of city.structures) {
      if (!window.GameData.getBuilding(s.id).isWall) continue;
      if (window.GameEngine.influence.chebyshev(structure.x, structure.y, s.x, s.y) > 1) continue;
      s.gateUnlockedUntilTurn = expiresAtTurn;
      affected++;
    }
    unit.usedThisTurn = true;
    unit.currentMission = `Unlocked the gate at (${structure.x},${structure.y})`;
    log.push(`Unlock the Gate: ${civ.id}'s ${describeUnit(unit)} disables ${target.civId}'s wall at (${structure.x},${structure.y}) and ${affected - 1} adjacent segment(s) for ${UNLOCK_THE_GATE_ROUNDS} rounds`);
    return true;
  }

  /** Nearest visible enemy unit within `radius` that isn't already
   *  Befuddled -- Riddle's target pool. */
  function findRiddleTarget(civ, unit, gameState, radius) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    let best = null, bestDist = Infinity;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.conditions?.hidden || eu.conditions?.befuddled) continue;
        if (!visible.has(eu.y * map.width + eu.x)) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y);
        if (dist > radius) continue;
        if (dist < bestDist) { bestDist = dist; best = eu; }
      }
    }
    return best;
  }

  /**
   * Halfellow "Riddle" (2026-07-24, user-directed, "The Riddle Game" tech):
   * Trouble Maker and Wanderer. Ranged debuff (search radius = this unit's
   * own effectiveRange, so it scales with Boomerang same as a normal
   * attack) -- poses a riddle to the nearest enemy in range. The target
   * resists (nothing happens) with a chance equal to its own race's
   * curiosity * 0.75; otherwise it becomes Befuddled for 2 turns (see
   * combat.js's applyBefuddled). Using it reveals this unit if Hidden, same
   * "any offensive action reveals Hidden" convention attacking already
   * follows. Returns true if it consumed the turn (posing the riddle, or
   * closing distance toward a target). */
  // 2026-07-24, user-directed: a flat per-caster cooldown after every
  // Riddle attempt (resisted or not) -- without this, a single Trouble
  // Maker could re-target the same unit the instant its 2-turn Befuddled
  // expired, keeping it in a near-permanent lock for the whole fight
  // (confirmed live -- see the 2026-07-24 balance-test memory). 3 rounds
  // guarantees at least 1 clean turn between one Befuddled expiring and
  // the same caster being able to reapply it.
  const RIDDLE_COOLDOWN_ROUNDS = 3;
  function maybeRiddlePlay(civ, unit, gameState, log) {
    if ((unit.typeId !== "trouble_maker" && unit.typeId !== "wanderer")
        || !civ.unlockedMechanics || !civ.unlockedMechanics.has("riddle")) return false;
    if ((unit._riddleCooldownUntilTurn || 0) > currentTurnNumber) return false;
    const radius = window.GameEngine.combat.effectiveRange(unit, civ);
    const target = findRiddleTarget(civ, unit, gameState, radius);
    if (!target) return false;
    const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, target.x, target.y);
    if (dist > radius) {
      moveUnitToward(unit, target.x, target.y, gameState.map, gameState.civs);
      unit.usedThisTurn = true;
      unit.currentMission = `Approaching ${target.civId}'s ${describeUnit(target)} to pose a riddle`;
      return true;
    }
    const targetCiv = gameState.civs[target.civId];
    const targetRace = window.GameData.getRace(targetCiv.raceId);
    const resistChance = (targetRace.curiosity ?? 0.5) * 0.75;
    const resisted = Math.random() < resistChance;
    if (!resisted) window.GameEngine.combat.applyBefuddled(target, currentTurnNumber);
    window.GameEngine.combat.revealHidden(unit, currentTurnNumber);
    unit._riddleCooldownUntilTurn = currentTurnNumber + RIDDLE_COOLDOWN_ROUNDS;
    unit.usedThisTurn = true;
    unit.currentMission = resisted ? `Riddle resisted by ${describeUnit(target)}` : `Befuddled ${describeUnit(target)} with a riddle`;
    log.push(`Riddle: ${civ.id}'s ${describeUnit(unit)} poses a riddle to ${targetCiv.id}'s ${describeUnit(target)} -> ` +
      (resisted ? "resisted" : "befuddled"));
    // Speech-bubble flavor (2026-07-24, user-directed): the caster poses
    // the actual riddle, the target replies with the answer if it
    // resisted or a stumped non-answer if it got Befuddled -- reuses the
    // exact same word-bubble system quips.js/render.js already draw for
    // ordinary flavor quips (see quips.js's spawnQuipText), just an
    // unconditional/scripted pair instead of a random one-liner.
    const riddle = window.GameData.getRandomRiddle();
    window.GameEngine.quips.spawnQuipText(unit, riddle.question);
    window.GameEngine.quips.spawnQuipText(target, resisted ? riddle.answer : window.GameData.getRandomStumpedResponse());
    return true;
  }

  /**
   * Halfellow Trouble Maker: proactive use of its full kit, same "full kit
   * dispatcher" shape as maybeHumanWizardPlay. Priority order: Resource
   * Heist (denies + steals a real investment, time-sensitive since the
   * victim might cash out first), Unlock the Gate (sets up an assault),
   * Riddle (a debuff, least urgent of the three). All gated on the
   * relevant mechanic being unlocked. Returns true if it consumed the
   * Trouble Maker's turn. */
  function maybeTroubleMakerPlay(civ, unit, gameState, log) {
    if (unit.typeId !== "trouble_maker") return false;
    if (maybeResourceHeistPlay(civ, unit, gameState, log)) return true;
    if (maybeUnlockTheGatePlay(civ, unit, gameState, log)) return true;
    if (maybeRiddlePlay(civ, unit, gameState, log)) return true;
    return false;
  }

  function maybeProspectorsClaimPlay(civ, unit, gameState, log) {
    const { map } = gameState;
    const curResource = map.tiles[unit.y * map.width + unit.x]?.resource;
    const onVeinNow = curResource === "gold" || curResource === "iron";
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
      if (maybeCashOutChannel(civ, unit, gameState, log, "Prospector's Claim")) return true;
      unit.resting = true;
      unit.usedThisTurn = true;
      const veinLabel = curResource === "iron" ? "Iron Vein" : "Gold Vein";
      unit.currentMission = `Working a ${veinLabel} claim (${unit._ritualTurns} turn${unit._ritualTurns === 1 ? "" : "s"})`;
      return true;
    }

    if (unit.hp < unit.maxHp * 0.7) return false; // heal up before setting out
    const veinSpot = findNearbyUnclaimedGoldVein(civ, unit, gameState, { sameLandmassOnly: true });
    if (veinSpot) {
      const spotResource = map.tiles[veinSpot.y * map.width + veinSpot.x]?.resource;
      const veinLabel = spotResource === "iron" ? "Iron Vein" : "Gold Vein";
      // Starting a claim is a normal action (2026-07-20, user-directed): if
      // this turn's movement budget reaches the vein, settle in the SAME
      // turn instead of always burning a separate arrival turn -- see
      // project_turn_action_economy memory.
      if (!(veinSpot.x === unit.x && veinSpot.y === unit.y)) {
        moveUnitToward(unit, veinSpot.x, veinSpot.y, map, gameState.civs);
      }
      if (veinSpot.x === unit.x && veinSpot.y === unit.y) {
        // Already there, or arrived with movement to spare this turn --
        // start the channel (2026-07-21, user-directed: prospecting is now
        // an explicitly-started channel, not just "happens to be standing
        // here" -- see turns.js's onAnchor gate). _ritualTurns hasn't
        // accrued yet (that happens at the start of the NEXT turn, see
        // turns.js), this just claims the spot and begins the channel.
        unit.channeling = "prospecting";
        unit.resting = true;
        unit.usedThisTurn = true;
        unit.currentMission = `Settling in to start a ${veinLabel} claim`;
        window.GameEngine.quips.maybeQuip(unit, civ, "prospect", gameState);
        return true;
      }
      unit.usedThisTurn = true;
      unit.currentMission = `Marching to a ${veinLabel} to start a claim at (${veinSpot.x},${veinSpot.y})`;
      log.push(`Prospector's Claim: ${civ.id}'s ${describeUnit(unit)} heading to ${veinLabel} at (${veinSpot.x},${veinSpot.y})`);
      return true;
    }

    // Nothing reachable by land -- look further afield (any landmass) and
    // try to get there by sea instead of walking, which would just strand
    // the unit at the shore forever. See seekOverseasResource.
    const overseasVein = findNearbyUnclaimedGoldVein(civ, unit, gameState);
    if (overseasVein) {
      const overseasResource = map.tiles[overseasVein.y * map.width + overseasVein.x]?.resource;
      return seekOverseasResource(civ, unit, gameState, log, overseasVein, overseasResource === "iron" ? "Iron Vein" : "Gold Vein");
    }
    return false;
  }

  /**
   * Galley "Fishing" (2026-07-21, user-directed): a universal channeled
   * action for ANY Galley (any race, no tech required) -- see turns.js's
   * beginCivTurn for the actual +5 harvest/+2 coin per-turn payout and
   * exhaustion chance. Purely opportunistic, unlike Prospector's Claim/
   * Dungeon Delve above -- a Galley never goes out of its way SEEKING a
   * Fish Shoal, it only starts fishing when it's already sitting on one
   * with nothing else to do. Two cases:
   *
   *   ALREADY FISHING: holds position, same "adjacent enemy defers to the
   *   normal attack dispatch" carve-out the other two channels use.
   *
   *   NOT YET FISHING: an idle, uncarrying Galley already on a Fish Shoal
   *   starts the channel.
   *
   * Returns true if it consumed the turn.
   */
  function maybeGalleyFishingPlay(civ, unit, gameState, log) {
    const { map, civs } = gameState;
    const tile = map.tiles[unit.y * map.width + unit.x];
    const onShoal = !!(tile && tile.resource === "fish");

    if (unit.channeling === "fishing") {
      // A passenger boarding from its OWN turn (see e.g. maybeFoundCity's
      // idle-pioneer galley-boarding fallback) can attach mid-channel --
      // cancel fishing and let the normal ferry dispatch take over instead.
      if (!onShoal || unit.carries) { unit.channeling = null; return false; }
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
      if (maybeCashOutChannel(civ, unit, gameState, log, "Fishing")) return true;
      unit.resting = true;
      unit.usedThisTurn = true;
      unit.currentMission = "Fishing a Shoal";
      return true;
    }

    if (!onShoal || unit.carries) return false;
    unit.channeling = "fishing";
    unit.resting = true;
    unit.usedThisTurn = true;
    unit.currentMission = "Settling in to start Fishing";
    log.push(`Fishing: ${civ.id}'s Galley starts fishing a Shoal at (${unit.x},${unit.y})`);
    return true;
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
      if (maybeCashOutChannel(civ, unit, gameState, log, "Dungeon Delve")) return true;

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
      // Starting a delve is a normal action (2026-07-20, user-directed): if
      // this turn's movement budget reaches the ruin, settle in the SAME
      // turn instead of always burning a separate arrival turn -- see
      // project_turn_action_economy memory.
      if (!(ruinSpot.x === unit.x && ruinSpot.y === unit.y)) {
        moveUnitToward(unit, ruinSpot.x, ruinSpot.y, map, civs);
      }
      if (ruinSpot.x === unit.x && ruinSpot.y === unit.y) {
        // Already there, or arrived with movement to spare this turn --
        // start the channel (2026-07-21, user-directed: delving is now an
        // explicitly-started channel -- see turns.js's onAnchor gate) so
        // generic idle/explore logic doesn't carry it off first.
        // _ritualTurns hasn't accrued yet (see turns.js).
        unit.channeling = "delving";
        unit.resting = true;
        unit.usedThisTurn = true;
        unit.currentMission = "Settling in to start a Dungeon Delve";
        return true;
      }
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

  /** Elf ambush follow-through (2026-07-22, user-directed): true while
   *  `unit` is still mid-fight with the specific target it last sprang a
   *  hidden ambush on (see the considerAttackOrGarrison call site that
   *  stamps unit._meleeAmbushVictim) -- checked at the top of maybeElfStealthPlay
   *  so the unit can't vanish again until that fight is actually over,
   *  rather than reflexively re-hiding the instant it's technically eligible
   *  again (Hidden's forced-visible window is only 1 turn). Clears the
   *  tracking itself once the target is confirmed gone (dead, or no longer
   *  in its civ's roster for any other reason), so this is self-resetting --
   *  nothing else needs to remember to clean it up. */
  function stillEngagedInAmbush(unit, gameState) {
    const target = unit._meleeAmbushVictim;
    if (!target) return false;
    const targetCiv = gameState.civs[target.civId];
    if (target.hp <= 0 || !targetCiv || !targetCiv.units.includes(target)) {
      unit._meleeAmbushVictim = null;
      return false;
    }
    return true;
  }

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
    // Ambush follow-through takes priority over every hide decision below
    // (defensive, offensive, and the proactive Quick as a Shadow default) --
    // see stillEngagedInAmbush's doc comment. Returning false here lets the
    // normal attack cascade (considerAttackOrGarrison, further down) keep
    // pressing the same fight instead.
    if (stillEngagedInAmbush(unit, gameState)) return false;
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
    if (!nearest) {
      // Elf "Quick as a Shadow" (2026-07-22, user-directed): once known,
      // hiding stops being purely reactive to a nearby threat -- an Elf
      // unit prefers to be Hidden as its default resting state, going
      // hidden proactively even with no enemy anywhere in sight. Safe to
      // do unconditionally here: canGoHidden (checked at the top of this
      // function) already refuses this the instant an enemy is adjacent,
      // which is exactly the "unless in the middle of combat" carve-out --
      // and computeMovementBudget's matching waiver above means this no
      // longer costs the mobility it used to. Excludes the Druid, though --
      // it has its own valuable proactive kit (Nature's Grace, Raptor/
      // Shadowsteed summons, Roots of the World -- see maybeElfDruidPlay,
      // checked right after this function in the dispatch cascade) that has
      // nothing to do with nearby enemies and shouldn't get preempted by
      // reflexively vanishing every idle turn.
      if (unit.typeId !== "druid" && civ.unlockedMechanics.has("quick_as_a_shadow")) {
        window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
        unit.usedThisTurn = true;
        unit.currentMission = "Staying hidden";
        log.push(`Stealth: ${civ.id}'s ${describeUnit(unit)} slips into hiding at (${unit.x},${unit.y})`);
        return true;
      }
      return false;
    }
    const enemyCiv = civs[nearest.civId];

    const winProb = estimateWinProbability(unit, nearest, civs, {}, 20);
    const threshold = minAcceptableWinProbability(civ);

    if (nearestDist === 2 && winProb < threshold * (1 - militarism * 0.5)) {
      window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
      unit.usedThisTurn = true;
      unit.currentMission = `Going hidden — outmatched by ${enemyCiv.id}'s ${describeUnit(nearest)} nearby`;
      log.push(`Stealth: ${civ.id}'s ${describeUnit(unit)} goes hidden defensively at (${unit.x},${unit.y})`);
      return true;
    }

    if (!civ.unlockedMechanics.has("strike_from_the_shadows")) return false;

    if (isRanged) {
      // No ally-bait needed -- a wider tolerance than the melee branch below,
      // since a hidden ranged attack never risks a counter.
      if (winProb < threshold * 1.5) {
        window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
        unit.usedThisTurn = true;
        unit.currentMission = `Going hidden — lining up a shot on ${enemyCiv.id}'s ${describeUnit(nearest)}`;
        log.push(`Stealth: ${civ.id}'s ${describeUnit(unit)} goes hidden to snipe ${enemyCiv.id}'s ${describeUnit(nearest)} near (${unit.x},${unit.y})`);
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
        unit.currentMission = `Holding as bait near ${enemyCiv.id}'s ${describeUnit(nearest)} at (${nearest.x},${nearest.y})`;
        return false;
      }
      window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
      unit.usedThisTurn = true;
      unit.currentMission = `Going hidden — setting up an ambush on ${enemyCiv.id}'s ${describeUnit(nearest)}`;
      log.push(`Stealth: ${civ.id}'s ${describeUnit(unit)} goes hidden to ambush ${enemyCiv.id}'s ${describeUnit(nearest)} near (${unit.x},${unit.y})`);
      return true;
    }

    return false;
  }

  // Elf "Whirlwind Strike"/"Blade Storm" (2026-07-20, user-directed): both
  // are a normal action (move, then optionally act -- same category as an
  // ordinary Attack, see project_turn_action_economy memory) that hits
  // every enemy unit within a radius in one go, each hit scaled down
  // (attackDamageMult) and each eligible counter scaled down too
  // (counterDamageMult) -- see combat.js's resolveRound. Blade Storm's
  // radius-2 ring naturally denies counters from its outer, non-adjacent
  // targets: resolveRound's own isAdjacent check already refuses a counter
  // from anything not adjacent, so no separate handling is needed here for
  // that half of the spec. Blade Storm does NOT replace Whirlwind Strike --
  // both stay independently usable; maybeBladeDancerSweep below picks
  // whichever fits the current cluster of targets.
  // 2026-07-22, user-directed: Whirlwind Strike 50%->75%, Blade Storm
  // 33%->50%; counter multiplier for each is always half its own damage
  // multiplier (37.5% and 25% respectively).
  const WHIRLWIND_STRIKE_RADIUS = 1, WHIRLWIND_ATTACK_MULT = 0.75, WHIRLWIND_COUNTER_MULT = 0.375;
  const BLADE_STORM_RADIUS = 2, BLADE_STORM_ATTACK_MULT = 0.5, BLADE_STORM_COUNTER_MULT = 0.25;

  /** How many currently-visible, non-hidden enemy units sit within `radius`
   *  of (x,y) -- used to decide whether a sweep is worth using over an
   *  ordinary single-target attack (see maybeBladeDancerSweep). */
  function countEnemiesInRadius(civ, x, y, radius, gameState) {
    const { civs, map } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    let count = 0;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.conditions?.hidden) continue;
        if (!visible.has(eu.y * map.width + eu.x)) continue;
        if (window.GameEngine.influence.chebyshev(x, y, eu.x, eu.y) <= radius) count++;
      }
    }
    return count;
  }

  /** Executes a Whirlwind Strike/Blade Storm sweep: resolves a full combat
   *  exchange (combat.js's resolveRound, scaled by attackMult/counterMult)
   *  against every currently-visible, non-hidden enemy unit within `radius`
   *  of the Blade Dancer, stopping early if the Blade Dancer itself dies
   *  mid-sweep. Mirrors considerAttackOrGarrison's core bookkeeping per hit
   *  (combat event, Hidden reveal, First Frost of Autumn's passive freeze
   *  chance, death cleanup, XP) but deliberately skips single-target-only
   *  edge cases (Hound and Hunter, Anti-Titan learning, Orc plunder/lore-on-
   *  death) that don't meaningfully apply to Elf's own kit. Returns true if
   *  it hit at least one target. */
  function performBladeSweep(civ, unit, gameState, log, { label, radius, attackMult, counterMult }) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const targets = [];
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.conditions?.hidden) continue;
        if (!visible.has(eu.y * map.width + eu.x)) continue;
        if (window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y) <= radius) targets.push(eu);
      }
    }
    if (targets.length === 0) return false;

    window.GameEngine.quips.maybeQuip(unit, civ, "attack", gameState);
    window.SfxSystem.playAction(civ.raceId, unit.typeId, "attack", unit.x, unit.y);
    // "Ambush!" floating text (2026-07-22, user-directed): checked BEFORE
    // revealHidden clears the condition, same convention as every other
    // "was it hidden at the moment it attacked" check in this file.
    const wasHiddenForSweep = !!unit.conditions?.hidden;
    window.GameEngine.combat.revealHidden(unit, currentTurnNumber);
    if (wasHiddenForSweep) window.GameEngine.floatingText.spawnFloatingText(unit, "Ambush!", "warning");
    // Names which sweep this is (2026-07-22, user-directed) -- "label" is
    // already "Whirlwind Strike" or "Blade Storm" (see maybeBladeDancerSweep's
    // two call sites below), reused as-is for both the log line and here.
    window.GameEngine.floatingText.spawnFloatingText(unit, label, "aura");
    // Highlights the swept radius for a moment (2026-07-22, user-directed) --
    // see combat.js's spawnAreaEffect/render.js's drawAreaEffects.
    window.GameEngine.combat.spawnAreaEffect(unit.x, unit.y, radius, "blade_sweep");
    let hitCount = 0, killCount = 0;
    for (const target of targets) {
      const defenderCiv = civs[target.civId];
      const combatContext = {
        attackerGarrisoned: isGarrisoned(unit, civ),
        defenderGarrisoned: isGarrisoned(target, defenderCiv),
        attackerOnHills: map.tiles[unit.y * map.width + unit.x].terrain === "hills",
        defenderOnHills: map.tiles[target.y * map.width + target.x].terrain === "hills",
        attackerInForest: map.tiles[unit.y * map.width + unit.x].terrain === "forest",
        defenderInForest: map.tiles[target.y * map.width + target.x].terrain === "forest",
        attackDamageMult: attackMult, counterDamageMult: counterMult,
      };
      const result = window.GameEngine.combat.resolveRound(unit, target, civs, combatContext);
      window.GameEngine.combat.recordCombatEvent({
        ax: unit.x, ay: unit.y, atkUnit: unit, dx: target.x, dy: target.y, defUnit: target,
      });
      markCombatEngaged(civ);
      markCombatEngaged(defenderCiv);
      window.GameEngine.combat.revealHidden(target, currentTurnNumber);
      applyElfCombatMechanics(unit, civ, target, defenderCiv, result, gameState);
      hitCount++;

      if (target.hp <= 0) {
        killCount++;
        otherCivRemoveDeadUnit(civs, target);
        const attackerRace = window.GameData.getRace(civ.raceId);
        if (attackerRace.healOnKillPct && unit.hp > 0) {
          const beforeKillHeal = unit.hp;
          unit.hp = Math.min(unit.maxHp, unit.hp + Math.max(1, Math.round(unit.maxHp * attackerRace.healOnKillPct / 100)));
          window.GameEngine.floatingText.spawnHealGain(unit, unit.hp - beforeKillHeal);
        }
        if (target.carries) {
          dropCargoOrKill(target.carries, target.x, target.y, gameState, log);
          target.carries = null;
        }
      }
      // XP: granted independently per side, whichever is still alive --
      // mirrors considerAttackOrGarrison's two separate unit.hp>0 gates.
      if (unit.hp > 0) {
        grantXPAndAutoLevel(unit, civ, window.GameEngine.combat.xpForCombatAction(
          { damage: result.fullDamage + result.doubleDamage,
            killedUnitTypeId: target.hp <= 0 ? target.typeId : null }));
      }
      if (target.hp > 0) {
        grantXPAndAutoLevel(target, defenderCiv, window.GameEngine.combat.xpForCombatAction(
          { damage: result.counterDamage, killedUnitTypeId: unit.hp <= 0 ? unit.typeId : null }));
      }

      if (unit.hp <= 0) break; // Blade Dancer fell mid-sweep -- stop hitting further targets
    }

    if (unit.hp <= 0) {
      if (unit.carries) { dropCargoOrKill(unit.carries, unit.x, unit.y, gameState, log); unit.carries = null; }
      otherCivRemoveDeadUnit(civs, unit);
      log.push(`${label}: ${civ.id}'s Blade Dancer fell mid-sweep after hitting ${hitCount} target(s)`);
      return true;
    }

    unit.usedThisTurn = true;
    unit.currentMission = `${label}: hit ${hitCount} target(s)${killCount ? `, ${killCount} killed` : ""}`;
    log.push(`${label}: ${civ.id}'s Blade Dancer hit ${hitCount} target(s) around (${unit.x},${unit.y})${killCount ? `, ${killCount} killed` : ""}`);
    return true;
  }

  // How many enemies a sweep must hit to be worth using over a normal,
  // full-damage single-target attack (2026-07-20, tunable) -- below this,
  // concentrating full damage on one target wins out; at or above it, the
  // combined AoE output outweighs its own higher total counter-risk.
  const BLADE_SWEEP_MIN_TARGETS = 2;

  /** Elf Blade Dancer: prefers Blade Storm over Whirlwind Strike whenever
   *  either would be worth using (strictly wider radius, same decision),
   *  falls back to Whirlwind Strike alone, and does nothing (returns false,
   *  letting the normal single-target attack dispatch handle it instead) if
   *  neither tech is unlocked or too few enemies are clustered nearby.
   *  Checked before the ordinary attack dispatch in runUnitTurn. */
  function maybeBladeDancerSweep(civ, unit, gameState, log) {
    if (unit.typeId !== "blade_dancer" || !civ.unlockedMechanics) return false;
    const hasBladeStorm = civ.unlockedMechanics.has("blade_storm");
    const hasWhirlwind = civ.unlockedMechanics.has("whirlwind_strike");
    if (!hasBladeStorm && !hasWhirlwind) return false;

    if (hasBladeStorm && countEnemiesInRadius(civ, unit.x, unit.y, BLADE_STORM_RADIUS, gameState) >= BLADE_SWEEP_MIN_TARGETS) {
      return performBladeSweep(civ, unit, gameState, log,
        { label: "Blade Storm", radius: BLADE_STORM_RADIUS, attackMult: BLADE_STORM_ATTACK_MULT, counterMult: BLADE_STORM_COUNTER_MULT });
    }
    if (hasWhirlwind && countEnemiesInRadius(civ, unit.x, unit.y, WHIRLWIND_STRIKE_RADIUS, gameState) >= BLADE_SWEEP_MIN_TARGETS) {
      return performBladeSweep(civ, unit, gameState, log,
        { label: "Whirlwind Strike", radius: WHIRLWIND_STRIKE_RADIUS, attackMult: WHIRLWIND_ATTACK_MULT, counterMult: WHIRLWIND_COUNTER_MULT });
    }
    return false;
  }

  /** Elf "Nature's Grace": restores 10%-30% (random) of `target`'s max HP.
   *  Costs the Druid's whole turn, no exhaustion afterward (unlike Roots of
   *  the World). */
  function performNaturesGrace(civ, caster, target, log) {
    const healPct = 0.10 + Math.random() * 0.20;
    const healAmount = Math.max(1, Math.round(target.maxHp * healPct)); // minimum 1 HP, 2026-08-03 user-directed
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + healAmount);
    window.GameEngine.floatingText.spawnHealGain(target, target.hp - before);
    caster.usedThisTurn = true;
    caster.currentMission = `Restored health to ${describeUnit(target)} at (${target.x},${target.y})`;
    // describeUnit(caster) rather than a hardcoded "Druid" -- caster is the
    // Shadowsteed itself when a mounted Druid rider casts through it (see
    // the shadowsteed+Druid dispatch check below), not always the Druid.
    log.push(`Nature's Grace: ${civ.id}'s ${describeUnit(caster)} heals ${describeUnit(target)} at (${target.x},${target.y}) for ${healAmount} HP`);
  }

  /** Elf "Nature's Grace" AI: heals the most-injured ally within the
   *  Druid's own effective range (2026-07-22, user-directed: no longer
   *  adjacent-only -- reaches as far as the Druid's Ranged 2 base, plus any
   *  tech range upgrades, same as its attack would), if any is actually
   *  missing HP -- purely opportunistic support, no threshold math (unlike
   *  Freezing Touch, there's no "should I," just "is there someone worth
   *  healing in reach"). Returns true if it consumed the Druid's turn. */
  function maybeNaturesGrace(civ, unit, gameState, log) {
    const range = window.GameEngine.combat.effectiveRange(unit, civ);
    const { map } = gameState;
    let best = null, bestMissing = 0;
    for (const ally of civ.units) {
      if (ally === unit || ally.carriedBy) continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > range) continue;
      // Same clear-shot requirement a ranged attack uses beyond adjacency
      // (mountains block it) -- see hasRangedLineOfSight; always true for
      // an adjacent target, so this is a no-op for the old range-1 case.
      if (!hasRangedLineOfSight(map, unit.x, unit.y, ally.x, ally.y)) continue;
      const missing = ally.maxHp - ally.hp;
      if (missing > bestMissing) { bestMissing = missing; best = ally; }
    }
    if (!best) return false;
    performNaturesGrace(civ, unit, best, log);
    return true;
  }

  /** Elf "Roots of the World": instantly moves `targetUnit` -- the Druid
   *  itself, or (mirroring Human's Teleportation) a currently-adjacent ally
   *  -- to any unoccupied, ever-explored tile. Reuses the same
   *  isValidTeleportTile/resolveTeleportLanding helpers Human's Teleportation
   *  uses -- those are already fully generic, not Wizard-specific. Costs the
   *  DRUID's whole turn and leaves IT exhausted (forced Rest until healed to
   *  100%) regardless of who was actually moved -- an ally relocated this way
   *  does NOT become exhausted, only the Druid pays that price, same
   *  convention as performWizardTeleport. */
  function performDruidTeleport(civ, druid, targetUnit, destX, destY, gameState, log) {
    if (targetUnit !== druid
        && window.GameEngine.influence.chebyshev(druid.x, druid.y, targetUnit.x, targetUnit.y) > 1) {
      return false; // can only teleport an ally that's currently adjacent
    }
    const landing = resolveTeleportLanding(gameState, destX, destY, targetUnit);
    if (!landing) return false;
    targetUnit.x = landing.x;
    targetUnit.y = landing.y;
    // Suppress the move-glide animation for this jump -- see performWizardTeleport.
    targetUnit._lastLogicalX = landing.x;
    targetUnit._lastLogicalY = landing.y;
    targetUnit._renderX = landing.x;
    targetUnit._renderY = landing.y;
    targetUnit._animStart = 0;
    window.GameEngine.combat.setCondition(druid, "exhausted", {});
    druid.usedThisTurn = true;
    if (targetUnit !== druid) targetUnit.usedThisTurn = true;
    if (targetUnit === druid) {
      druid.currentMission = "Blinked into the roots of the world (exhausted, must rest)";
      log.push(`Roots of the World: ${civ.id}'s Druid blinked to (${landing.x},${landing.y}), exhausted until fully healed`);
    } else {
      druid.currentMission = `Teleported a ${describeUnit(targetUnit)} to (${landing.x},${landing.y}) (exhausted, must rest)`;
      log.push(`Roots of the World: ${civ.id}'s Druid teleported a ${describeUnit(targetUnit)} to (${landing.x},${landing.y}), Druid exhausted until fully healed`);
    }
    return true;
  }

  /** Defensive trigger: blinks `targetUnit` to the safest remembered tile,
   *  mirrors attemptWizardTeleport exactly. `targetUnit` is `druid` itself
   *  for the self-flee case (see the main HP-threshold check further up the
   *  cascade), or a badly hurt adjacent ally for the rescue case -- see
   *  findAdjacentHurtAlly/maybeElfDruidPlay's caller. */
  function attemptDruidTeleport(civ, druid, targetUnit, gameState, log) {
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
      if (!isValidTeleportTile(gameState, x, y, targetUnit)) continue;
      const nearestEnemyDist = enemyPositions.reduce((min, eu) =>
        Math.min(min, window.GameEngine.influence.chebyshev(x, y, eu.x, eu.y)), Infinity);
      if (nearestEnemyDist > bestDist) { bestDist = nearestEnemyDist; best = { x, y }; }
    }
    if (!best) return false;
    return performDruidTeleport(civ, druid, targetUnit, best.x, best.y, gameState, log);
  }

  /** Finds a badly hurt (<40% HP), adjacent, uncarried ally for Roots of the
   *  World's rescue play (see attemptDruidTeleport) -- never the Druid
   *  itself, and never a unit already exhausted from its own teleport. */
  function findAdjacentHurtAlly(civ, druid) {
    return civ.units.find((u) =>
      u !== druid && !u.carriedBy && !u.conditions?.exhausted
      && u.hp < u.maxHp * 0.4
      && window.GameEngine.influence.chebyshev(druid.x, druid.y, u.x, u.y) <= 1) || null;
  }

  // How far (in explored tiles, not a search radius -- see maybeRootsExpansion)
  // a candidate Forest settle site must sit from the Druid before teleporting
  // there is worth it over just walking a Pioneer -- close-by sites are the
  // normal pioneer pipeline's job.
  const ROOTS_EXPANSION_MIN_DIST = 6;

  /** Elf "Roots of the World" expansion play: an idle Druid with a known,
   *  legal, far-off Forest tile blinks straight there (in addition to the
   *  normal Pioneer -- see elf_druidism's canFoundCity) -- the tech's own AI
   *  note: "a druid civ looking for a place to build a city may consider
   *  far-off forest tiles, teleport the druid there, then found a new
   *  city." Deliberately simple (no militarism/expansionism weighting
   *  beyond a hard city-count cap) since this is a bonus expansion path on
   *  top of the normal Pioneer pipeline, not the primary one.
   *
   *  Teleport and Found City are two SEPARATE turns (2026-07-20,
   *  user-directed -- see project_turn_action_economy memory): Teleportation
   *  is a full-turn action, so founding can't happen in the same play. This
   *  function only ever teleports; it stamps `unit._wantsFoundCityAt` on
   *  success, and maybeElfDruidPlay re-validates + founds there once the
   *  Druid is no longer `exhausted` (performDruidTeleport's own aftermath)
   *  and standing on that tile. Returns true if it consumed the Druid's turn. */
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
    if (!performDruidTeleport(civ, unit, unit, best.x, best.y, gameState, log)) return false;
    unit._wantsFoundCityAt = { x: best.x, y: best.y };
    log.push(`Roots of the World: ${civ.id}'s Druid teleported to (${best.x},${best.y}), will found a city once rested`);
    return true;
  }

  /** Second half of Roots of the World (see maybeRootsExpansion above): once
   *  a Druid carrying `_wantsFoundCityAt` is no longer `exhausted` and is
   *  standing on that tile, RE-VALIDATE the site (2026-07-20, user-directed
   *  -- things may have changed during the forced Rest, e.g. a rival
   *  settling nearby) rather than blindly trusting the stale plan, using the
   *  exact same legality + score bar maybeRootsExpansion applied. Abandons
   *  (clears the marker, no city) if it no longer qualifies, letting the
   *  Druid fall through to normal idle/future-expansion behavior instead of
   *  forcing a bad city. Returns true if it consumed the Druid's turn
   *  (founding or abandoning both do, since both are a one-time decision). */
  function maybeCompleteRootsExpansion(civ, unit, gameState, log) {
    const target = unit._wantsFoundCityAt;
    if (!target) return false;
    if (unit.conditions?.exhausted) return false; // still resting -- try again once healed
    if (unit.x !== target.x || unit.y !== target.y) { delete unit._wantsFoundCityAt; return false; }
    const { map, civs } = gameState;
    const check = window.GameEngine.cities.canFoundCityAt(map, civs, target.x, target.y, civ.raceId, { skipRoadCheck: true });
    const score = check.ok ? computeTileCityScore(civ, gameState, target.x, target.y) : -Infinity;
    delete unit._wantsFoundCityAt;
    if (civ.cities.length >= 6 || !check.ok || score < 5) {
      log.push(`Roots of the World: ${civ.id}'s Druid found (${target.x},${target.y}) no longer worth settling, abandoning the claim`);
      return false;
    }
    const city = window.GameEngine.cities.foundCity(civ, gameState, target.x, target.y);
    if (!city) return false;
    civ.hasFoundedCity = true;
    unit.usedThisTurn = true;
    unit.currentMission = `Founded ${city.name} (Roots of the World)`;
    log.push(`Roots of the World: ${civ.id}'s Druid founded ${city.name} at (${target.x},${target.y})`);
    return true;
  }

  // Elf "Roots of the World" overseas invasion ferry (2026-07-21,
  // user-directed): once the civ KNOWS of an enemy city/wall/building on a
  // landmass other than the Druid's own (seen at least once --
  // gameState.tileMemory, the same remembered-not-just-currently-visible
  // convention assessInvasionTarget uses), Druids should get much more
  // focused on teleporting combat units across the water at it -- Elf's
  // answer to the galley bottleneck, the same role Deep Gates fill for
  // Dwarves. Only these three unit types are ever ferried: the army's
  // actual fighters, per the composition ratio (see RACE_UNIT_RATIO's "elf" entry).
  // Ferrying an Awakened Oak (movement 1, could never march there) is the
  // headline play. Scouts/Pioneers/summons are never ferried.
  const ROOTS_FERRY_PASSENGERS = new Set(["ranger", "blade_dancer", "awakened_oak"]);
  // Same order of magnitude as SHADOWSTEED_SEEK_RADIUS -- how far a Druid
  // will walk to pick up a passenger for the ferry play.
  const ROOTS_FERRY_SEEK_RADIUS = 8;

  /** Best remembered enemy city/structure tile on a landmass OTHER than the
   *  Druid's own, or null. Prefers a city over a lone structure, then
   *  nearer over farther. Reads tileMemory records (city/structure
   *  snapshots keyed by raceId -- races are 1:1 with civs in this game,
   *  same convention as assessInvasionTarget). */
  function findOverseasInvasionTeleportTarget(civ, druid, gameState) {
    const { map } = gameState;
    const memory = (gameState.tileMemory && gameState.tileMemory[civ.id]) || {};
    const druidTile = map.tiles[druid.y * map.width + druid.x];
    const druidLandmassId = druidTile ? druidTile.landmassId : -1;
    if (druidLandmassId < 0) return null;
    let best = null, bestScore = -Infinity;
    for (const idxStr of Object.keys(memory)) {
      const rec = memory[idxStr];
      const isEnemyCity = !!(rec.city && rec.city.raceId !== civ.raceId);
      const isEnemyStructure = !!(rec.structure && rec.structure.raceId !== civ.raceId);
      if (!isEnemyCity && !isEnemyStructure) continue;
      const idx = Number(idxStr);
      const tile = map.tiles[idx];
      if (!tile || tile.landmassId < 0 || tile.landmassId === druidLandmassId) continue;
      const x = idx % map.width, y = Math.floor(idx / map.width);
      const score = (isEnemyCity ? 100 : 0) - window.GameEngine.influence.chebyshev(druid.x, druid.y, x, y);
      if (score > bestScore) { bestScore = score; best = { x, y, isCity: isEnemyCity }; }
    }
    return best;
  }

  // Ambush staging (2026-07-21, user-directed redesign): ferried units were
  // arriving right beside the enemy city one at a time and getting killed
  // before doing anything substantial. Now they land AMBUSH_STAGING_MIN..
  // MAX tiles out, go Hidden (if researched), and WAIT -- accumulating into
  // an invasion force that only springs its attack once its combined power
  // can actually overcome the defenders. See findInvasionStagingTile /
  // maybeInvasionAmbushWait below.
  const AMBUSH_STAGING_MIN = 3;
  const AMBUSH_STAGING_MAX = 4;
  // How far around the ambush target enemy units count as "defenders" for
  // the launch-power comparison -- covers the city radius plus environs.
  const AMBUSH_ENEMY_SCAN_RADIUS = 5;
  // The gathered force launches once its power exceeds the visible
  // defenders' by this ratio -- "enough power to overcome the enemy", with
  // margin so the ambush actually wins rather than trades evenly.
  const AMBUSH_LAUNCH_POWER_RATIO = 1.25;
  // Safety valve: never wait forever (ferry Druid died, defenders keep
  // growing) -- after this many waiting turns the force attacks anyway.
  const AMBUSH_MAX_WAIT_TURNS = 12;

  /** Picks the landing tile for a ferried passenger: ring
   *  AMBUSH_STAGING_MIN..MAX around the target, on the target's own
   *  landmass, legal to teleport onto -- preferring Forest (Elf defense
   *  bonus + ambush concealment) and tiles near allies already staged on
   *  the same target, so the force clusters instead of scattering around
   *  the whole ring. Returns {x,y} or null if the entire ring is blocked. */
  function findInvasionStagingTile(civ, passenger, target, gameState) {
    const { map } = gameState;
    const targetTile = map.tiles[target.y * map.width + target.x];
    const targetLm = targetTile ? targetTile.landmassId : -1;
    const staged = civ.units.filter((u) => !u.carriedBy && u._ambushTarget
      && u._ambushTarget.x === target.x && u._ambushTarget.y === target.y);
    let best = null, bestScore = -Infinity;
    for (let dy = -AMBUSH_STAGING_MAX; dy <= AMBUSH_STAGING_MAX; dy++) {
      for (let dx = -AMBUSH_STAGING_MAX; dx <= AMBUSH_STAGING_MAX; dx++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        if (ring < AMBUSH_STAGING_MIN || ring > AMBUSH_STAGING_MAX) continue;
        const x = target.x + dx, y = target.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        const tile = map.tiles[y * map.width + x];
        if (targetLm >= 0 && tile.landmassId !== targetLm) continue;
        if (!isValidTeleportTile(gameState, x, y, passenger)) continue;
        let score = 0;
        if (tile.terrain === "forest") score += 2;
        for (const ally of staged) {
          if (window.GameEngine.influence.chebyshev(x, y, ally.x, ally.y) <= 2) score += 3;
        }
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    return best;
  }

  /** The ferry play itself: an adjacent, healthy, eligible passenger gets
   *  teleported to a STAGING tile 3-4 tiles out from the overseas target
   *  (see findInvasionStagingTile -- not dropped right beside the enemy
   *  city, where lone arrivals were getting picked off one by one) and
   *  tagged with `_ambushTarget`, joining the gathering invasion force
   *  maybeInvasionAmbushWait manages from there. Otherwise the Druid spends
   *  the turn closing distance to the nearest eligible passenger within
   *  ROOTS_FERRY_SEEK_RADIUS. Checked FIRST among the Druid's proactive
   *  plays (see maybeElfDruidPlay) -- "much more focused" per the user's
   *  own wording -- so while a known overseas target exists, ferrying the
   *  army across outranks healing, summoning, and expansion. Each ferry
   *  exhausts the Druid (performDruidTeleport's own aftermath), naturally
   *  pacing the airlift to roughly every other turn per Druid. Returns
   *  true if it consumed the Druid's turn. */
  function maybeRootsInvasionFerry(civ, unit, gameState, log) {
    const target = findOverseasInvasionTeleportTarget(civ, unit, gameState);
    if (!target) return false;
    const { map, civs } = gameState;
    const canFerry = (u) =>
      u !== unit && ROOTS_FERRY_PASSENGERS.has(u.typeId)
      && !u.carriedBy && !u.carries && !u.usedThisTurn && !u.conditions?.exhausted
      && u.hp >= u.maxHp * 0.7;
    const adjacent = civ.units.find((u) => canFerry(u)
      && window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y) <= 1);
    if (adjacent) {
      const staging = findInvasionStagingTile(civ, adjacent, target, gameState);
      if (!staging) return false; // whole staging ring blocked -- don't ferry into a death trap
      if (!performDruidTeleport(civ, unit, adjacent, staging.x, staging.y, gameState, log)) return false;
      const targetTile = map.tiles[target.y * map.width + target.x];
      adjacent._ambushTarget = { x: target.x, y: target.y, landmassId: targetTile ? targetTile.landmassId : -1 };
      delete adjacent._ambushWaitTurns;
      unit.currentMission = `Ferried a ${describeUnit(adjacent)} to the overseas staging ground at (${adjacent.x},${adjacent.y}) (exhausted, must rest)`;
      log.push(`Roots of the World: ${civ.id}'s Druid ferried a ${describeUnit(adjacent)} to stage against the enemy ${target.isCity ? "city" : "structure"} at (${target.x},${target.y})`);
      return true;
    }
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (!canFerry(u)) continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    if (!nearest || nearestDist > ROOTS_FERRY_SEEK_RADIUS) return false;
    moveUnitToward(unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Moving to ferry a ${describeUnit(nearest)} overseas (Roots of the World)`;
    log.push(`Roots of the World: ${civ.id}'s Druid moves to ferry a ${describeUnit(nearest)} overseas`);
    return true;
  }

  /**
   * Staged-invasion wait/launch logic (2026-07-21, user-directed) -- runs
   * early in every unit's dispatch (see runUnitTurn) but only ever applies
   * to a unit carrying `_ambushTarget` (stamped by maybeRootsInvasionFerry
   * when it lands the unit at the staging ground). Behavior:
   *
   *   GATHERING (visible defenders still stronger than the staged force):
   *   hold position and go Hidden if researched/possible (Elf's Shadowed
   *   Hush -- canGoHidden/enterHidden), else quietly Rest in place. An
   *   ADJACENT enemy is a fight, not a wait -- falls through to the normal
   *   attack dispatch, same carve-out prospecting/delving use.
   *
   *   LAUNCH (no visible defenders, force power >= defenders *
   *   AMBUSH_LAUNCH_POWER_RATIO, or AMBUSH_MAX_WAIT_TURNS exceeded):
   *   clears `_ambushTarget` on EVERY unit staged on this target at once --
   *   the whole force springs the same civ-turn, each member falling
   *   through to the ordinary combat cascade (attack, hunt, siege), with
   *   any still-Hidden member attacking out of stealth for Strike from the
   *   Shadows' full ambush bonus via the existing combat pipeline.
   *
   * Returns true if it consumed the unit's turn (only ever while waiting).
   */
  function maybeInvasionAmbushWait(civ, unit, gameState, log) {
    const t = unit._ambushTarget;
    if (!t) return false;
    const { map, civs } = gameState;
    const here = map.tiles[unit.y * map.width + unit.x];
    // The marker only means something on the target's own landmass --
    // anywhere else it's stale (unit somehow displaced); drop it.
    if (!here || (t.landmassId >= 0 && here.landmassId !== t.landmassId)) {
      delete unit._ambushTarget; delete unit._ambushWaitTurns;
      return false;
    }

    const staged = civ.units.filter((u) => !u.carriedBy && u._ambushTarget
      && u._ambushTarget.x === t.x && u._ambushTarget.y === t.y);
    const allyPower = staged.reduce((s, u) => s + unitCombatPower(u, civ), 0);
    const visible = gameState.visibility[civ.id] || new Set();
    let enemyPower = 0;
    for (const oc of Object.values(civs)) {
      if (oc.id === civ.id || oc.eliminated) continue;
      for (const eu of oc.units) {
        if (eu.carriedBy || eu.conditions?.hidden) continue;
        if (!visible.has(eu.y * map.width + eu.x)) continue;
        if (window.GameEngine.influence.chebyshev(eu.x, eu.y, t.x, t.y) > AMBUSH_ENEMY_SCAN_RADIUS) continue;
        enemyPower += unitCombatPower(eu, oc);
      }
    }

    const waited = unit._ambushWaitTurns || 0;
    const strongEnough = enemyPower <= 0 || allyPower >= enemyPower * AMBUSH_LAUNCH_POWER_RATIO;
    if (strongEnough || waited >= AMBUSH_MAX_WAIT_TURNS) {
      for (const u of staged) { delete u._ambushTarget; delete u._ambushWaitTurns; }
      log.push(`Ambush: ${civ.id}'s ${staged.length}-unit invasion force springs its attack on (${t.x},${t.y})`
        + (!strongEnough ? " (waited long enough -- attacking anyway)" : ""));
      return false; // fall through to the normal combat cascade this same turn
    }

    // Still gathering. An adjacent enemy is a fight, not a wait -- let the
    // normal attack dispatch handle it further down the cascade.
    for (const oc of Object.values(civs)) {
      if (oc.id === civ.id || oc.eliminated) continue;
      for (const eu of oc.units) {
        if (eu.conditions?.hidden) continue;
        if (window.GameEngine.influence.chebyshev(eu.x, eu.y, unit.x, unit.y) <= 1) return false;
      }
    }
    unit._ambushWaitTurns = waited + 1;
    if (!unit.conditions?.hidden && window.GameEngine.combat.canGoHidden(unit, civ, civs)) {
      window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
      unit.usedThisTurn = true;
      unit.currentMission = `Hiding in ambush near (${t.x},${t.y}) (${staged.length} gathered, awaiting reinforcements)`;
      log.push(`Ambush: ${civ.id}'s ${describeUnit(unit)} goes hidden near (${t.x},${t.y}), waiting for the invasion force to gather`);
      return true;
    }
    unit.resting = true;
    unit.usedThisTurn = true;
    unit.currentMission = `Waiting in ambush near (${t.x},${t.y}) (${staged.length} gathered, awaiting reinforcements)`;
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
      if (!isOpenPlacementTile(nx, ny, map, civs, occupied, civ.id)) continue;
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
   *   1. Roots of the World overseas invasion ferry -- teleport Ranger/
   *      Blade Dancer/Awakened Oak at a known enemy city/structure on
   *      another landmass (2026-07-21, user-directed: "much more focused"
   *      on this whenever such a target is known). See
   *      maybeRootsInvasionFerry.
   *   2. Nature's Grace -- opportunistic heal, cheapest and most frequently
   *      usable. See maybeNaturesGrace.
   *   3. Start a Raptor summon, if THIS Druid doesn't already have a live
   *      one (or one mid-summon) -- see druidHasLiveSummon/startDruidSummon.
   *      One per Druid, not a civ-wide cap (2026-07-18, user-directed).
   *   4. Start a Shadowsteed summon, same one-per-Druid shape.
   *   5. Roots of the World expansion play -- see maybeRootsExpansion.
   * All are gated on the relevant tech actually being researched.
   * Returns true if it consumed the Druid's turn.
   */
  function maybeElfDruidPlay(civ, unit, gameState, weights, difficulty, log) {
    if (unit.typeId !== "druid" || !civ.unlockedMechanics) return false;

    // A pending Roots of the World found-city commitment (see
    // maybeCompleteRootsExpansion) always takes priority over starting
    // something new -- it's the second half of a play already in motion,
    // checked before every fresh decision below.
    if (unit._wantsFoundCityAt && maybeCompleteRootsExpansion(civ, unit, gameState, log)) return true;

    if (civ.unlockedMechanics.has("roots_of_the_world") && !unit.conditions?.exhausted
        && maybeRootsInvasionFerry(civ, unit, gameState, log)) return true;

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
   *  shadowsteedMount). An adjacent Ranger is always taken immediately.
   *  Absent one, though (2026-07-22, user-directed: "prefer to carry
   *  Ranger units" -- a Druid should only ever be settled for when a
   *  Ranger truly isn't available, not just "not standing adjacent THIS
   *  exact turn"), it does NOT immediately settle for an adjacent Druid/
   *  Blade Dancer if a still-uncarried Ranger exists ANYWHERE within
   *  SHADOWSTEED_SEEK_RADIUS -- this is most visible right after a Druid
   *  finishes summoning: the fresh Shadowsteed spawns adjacent to its own
   *  summoner, and without this check would reflexively mount the Druid
   *  that just made it instead of holding out for a Ranger nearby. Holding
   *  out returns false here, letting maybeSeekShadowsteedRider (checked
   *  right after, same turn) go chase that Ranger instead. Only when NO
   *  Ranger is anywhere within reach does an adjacent Druid/Blade Dancer
   *  get taken. Mirrors operateDragonCarry's shape/return convention. */
  function operateShadowsteedCarry(civ, unit, gameState, log) {
    if (unit.carries) return false; // already mounted -- nothing to decide here
    const canMount = (u) =>
      u !== unit && !u.carriedBy && !u.carries && !u.usedThisTurn
      && window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y) <= 1
      && (u.typeId === SHADOWSTEED_PREFERRED_RIDER || SHADOWSTEED_FALLBACK_RIDERS.has(u.typeId));
    const adjacentRanger = civ.units.find((u) => canMount(u) && u.typeId === SHADOWSTEED_PREFERRED_RIDER);
    let passenger = adjacentRanger;
    if (!passenger) {
      const rangerWithinReach = civ.units.some((u) =>
        u.typeId === SHADOWSTEED_PREFERRED_RIDER && !u.carriedBy && !u.carries && !u.usedThisTurn
        && window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y) <= SHADOWSTEED_SEEK_RADIUS);
      if (!rangerWithinReach) passenger = civ.units.find((u) => canMount(u));
    }
    if (!passenger) return false;
    unit.carries = passenger;
    passenger.carriedBy = unit;
    passenger.usedThisTurn = true;
    unit.usedThisTurn = true;
    unit.currentMission = `Carrying a ${describeUnit(passenger)} as a rider`;
    log.push(`Shadowsteed: ${civ.id}'s Shadowsteed picked up ${describeUnit(passenger)} as a rider`);
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
    unit.currentMission = `Seeking a rider -- heading for ${describeUnit(target)} at (${target.x},${target.y})`;
    log.push(`Shadowsteed: ${civ.id}'s Shadowsteed moves to find a rider near (${target.x},${target.y})`);
    return true;
  }

  /** Reverse half of the Shadowsteed/rider pairing (2026-07-21, user-
   *  directed): a riderless Ranger actively closes distance on a nearby
   *  riderless Shadowsteed instead of only ever waiting to be found -- see
   *  maybeSeekShadowsteedRider just above for the Shadowsteed's own half.
   *  Doesn't mount itself -- that still only happens via the Shadowsteed's
   *  own operateShadowsteedCarry once adjacency lines up on either side's
   *  turn, so this just closes the distance (or no-ops if already
   *  adjacent, leaving the pickup to the Shadowsteed's own turn). Returns
   *  true if it moved (consuming the turn). */
  function maybeSeekRiderlessShadowsteed(civ, unit, gameState, log) {
    if (unit.carriedBy || unit.carries) return false;
    const { map, civs } = gameState;
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (u.typeId !== "shadowsteed" || u.carries || u.usedThisTurn) continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d > SHADOWSTEED_SEEK_RADIUS || d >= nearestDist) continue;
      nearestDist = d; nearest = u;
    }
    if (!nearest || nearestDist <= 1) return false;
    moveUnitToward(unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Moving to mount a Shadowsteed at (${nearest.x},${nearest.y})`;
    log.push(`Shadowsteed: ${civ.id}'s Ranger moves to mount a nearby Shadowsteed`);
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
    log.push(`Heavy Metal: ${civ.id}'s Metal Singer marches to rejoin its nearest ally`);
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
    log.push(`${civ.id}'s Metal Singer switches its aura to ${label}`);
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
    log.push(`Shield Wall: ${civ.id}'s ${describeUnit(unit)} closes ranks with an ally`);
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
    log.push(`Escort: ${civ.id}'s ${describeUnit(unit)} rallies to escort the Runeforged Titan`);
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
    log.push(`Halfellow teamwork: ${civ.id}'s ${describeUnit(unit)} moves to regroup with an ally`);
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

  // Elf "hunting party" (2026-07-30, user-directed): non-Ranger, non-support
  // Elf military units travel together in stealthed packs of 3+ instead of
  // operating solo, similarly to Orc's civ-wide swarm signal (see
  // computeOrcSwarmSignal/maybeOrcSwarm) but scoped to actual local clusters
  // rather than the whole warband converging on one point, and layered on
  // top of the existing per-unit Hidden decision-making in
  // maybeElfStealthPlay rather than replacing it. Rangers keep their own
  // separate pack (maybeRangerRegroup/RANGER_VOLLEY_BONUS) since they're
  // built around a synchronized ranged volley, not a melee ambush; the
  // Druid/Raptor/Shadowsteed have their own dedicated non-combat jobs.
  const ELF_HUNTING_PARTY_SIZE = 3;
  const ELF_PARTY_EMBEDDED_RADIUS = 2;
  const ELF_PARTY_REGROUP_SEARCH_RADIUS = 8;

  function isElfPartyEligible(u) {
    if (u.carriedBy || u.carries) return false;
    if (["ranger", "druid", "raptor", "shadowsteed"].includes(u.typeId)) return false;
    return window.GameData.getUnit(u.typeId).category === "military";
  }

  /** How many OTHER party-eligible allies (see isElfPartyEligible) are
   *  within ELF_PARTY_EMBEDDED_RADIUS of (x,y) -- the unit itself is not
   *  counted, so a "party of 3" reads as this returning >= 2 for each
   *  member. Shared by the regroup decision below and computeElfPartyTarget. */
  function elfPartyCompanionCount(civ, x, y, excludeUnit) {
    let count = 0;
    for (const u of civ.units) {
      if (u === excludeUnit || !isElfPartyEligible(u)) continue;
      if (window.GameEngine.influence.chebyshev(x, y, u.x, u.y) <= ELF_PARTY_EMBEDDED_RADIUS) count++;
    }
    return count;
  }

  /** Elf hunting party: mirrors maybeRangerRegroup's shape exactly (move
   *  toward the nearest eligible ally, do nothing once already embedded),
   *  except it only bothers moving while this unit's own local cluster is
   *  still short of ELF_HUNTING_PARTY_SIZE -- once 3+ are already massed
   *  together it stops pulling them further in, leaving them free to react
   *  to combat/stealth decisions elsewhere in the cascade instead of
   *  perpetually reshuffling position. Returns true if it moved (consuming
   *  the turn). */
  function maybeElfHuntingPartyRegroup(civ, unit, gameState, log) {
    if (!isElfPartyEligible(unit)) return false;
    if (elfPartyCompanionCount(civ, unit.x, unit.y, unit) + 1 >= ELF_HUNTING_PARTY_SIZE) return false;
    const { map, civs } = gameState;
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (u === unit || !isElfPartyEligible(u)) continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    if (!nearest || nearestDist > ELF_PARTY_REGROUP_SEARCH_RADIUS || nearestDist <= ELF_PARTY_EMBEDDED_RADIUS) return false;
    moveUnitToward(unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Massing into a hunting party near (${nearest.x},${nearest.y})`;
    log.push(`Hunting party: ${civ.id}'s ${describeUnit(unit)} moves to form up with another Elf unit`);
    return true;
  }

  /** The one shared target an entire Elf hunting party piles onto this turn
   *  (see ELF_PARTY_FOCUS_BONUS in considerAttackOrGarrison), or null if no
   *  party currently has one worth committing to. Sticks with the SAME
   *  target across turns once picked (persisted on civ._elfPartyTarget,
   *  recomputed fresh each call only to validate it's still alive/visible)
   *  so "all attack the same target until it is defeated" holds across
   *  multiple turns of a drawn-out fight, not just the one turn it was
   *  first spotted. Only ever picks a NEW target from a genuine party (a
   *  cluster of ELF_HUNTING_PARTY_SIZE+ eligible units, matching
   *  maybeElfHuntingPartyRegroup's own grouping) with a visible, non-hidden
   *  enemy within ELF_STEALTH_RANGE of at least one member -- an isolated
   *  Elf unit never sets this on its own. */
  function computeElfPartyTarget(civ, gameState, prevTarget) {
    if (prevTarget) {
      const prevCiv = gameState.civs[prevTarget.civId];
      if (prevCiv && prevTarget.hp > 0 && prevCiv.units.includes(prevTarget)) return prevTarget;
    }
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    for (const u of civ.units) {
      if (!isElfPartyEligible(u)) continue;
      if (elfPartyCompanionCount(civ, u.x, u.y, u) + 1 < ELF_HUNTING_PARTY_SIZE) continue;
      for (const otherCiv of Object.values(civs)) {
        if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
        for (const eu of otherCiv.units) {
          if (eu.conditions?.hidden) continue;
          if (!visible.has(eu.y * map.width + eu.x)) continue;
          if (window.GameEngine.influence.chebyshev(u.x, u.y, eu.x, eu.y) <= ELF_STEALTH_RANGE) return eu;
        }
      }
    }
    return null;
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
  // standoffRange (2026-07-20, user-directed): optional override of the
  // stop distance, defaulting to the unit's own combat range -- lets a
  // non-combat "move into range then act" play (e.g. maybeFreezingTouch's
  // spell range, maybeGrantFlight's adjacency) reuse this same standoff-walk
  // logic instead of duplicating it, see project_turn_action_economy memory.
  function moveTowardWithStandoff(civ, unit, targetX, targetY, map, civs, standoffRange) {
    const range = standoffRange != null ? standoffRange : window.GameEngine.combat.effectiveRange(unit, civ);
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
      log.push(`Orc swarm: ${civ.id}'s ${describeUnit(unit)} converges on contact at (${signal.x},${signal.y})`);
    } else {
      unit.currentMission = `Pushing past last contact toward (${target.x},${target.y})`;
      log.push(`Orc swarm: ${civ.id}'s ${describeUnit(unit)} pushes past (${signal.x},${signal.y}) hunting for more`);
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
    unit.currentMission = `Chasing an enemy ${describeUnit(nearest)} near (${nearest.x},${nearest.y})`;
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
    unit.currentMission = `Hunting an enemy ${describeUnit(nearest)} near (${nearest.x},${nearest.y})`;
    log.push(`Dire Wolf: ${civ.id}'s Dire Wolf tracks an enemy ${describeUnit(nearest)} toward (${nearest.x},${nearest.y})`);
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
        log.push(`${civ.id}'s ${describeUnit(unit)} breaks off pillaging after ${PILLAGE_HOLD_LIMIT} turns to press the attack`);
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
    log.push(`${civ.id}'s ${describeUnit(unit)} holds position, pillaging ${n} tile(s)`);
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
    log.push(`Hunt: ${civ.id}'s ${describeUnit(unit)} marches toward last-known enemy territory near ${nearest.name} (${nearest.x},${nearest.y})`);
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
    // 2026-07-21, user-directed fix (seed 162223683): a gate detour is only
    // actually useful if the EXIT side can genuinely walk to the target by
    // land. Without this, the raw-distance-only estimate below could pick
    // an exit gate that LOOKS closer as the crow flies but is separated
    // from the target by the same water blocking the direct route --
    // stranding the unit there with no way to finish the trip. Units then
    // bounced between gates forever: each turn's naive estimate kept
    // "finding" a shorter-looking hop in one direction or the other, never
    // settling on the correct (if long and circuitous) walking route a
    // plain moveUnitToward call would have found via real A* pathfinding.
    // Checked once per exit (not per entry/exit pair -- reachability only
    // depends on the exit) and cached, since canReachByLand's BFS is real
    // work; maxSearch matches findPath's own budget (see pathfinding.js)
    // rather than canReachByLand's smaller 150-tile default, so this can't
    // reject a route real movement would actually be able to walk.
    const exitReachable = new Map();
    const canExitReach = (g) => {
      if (!exitReachable.has(g)) exitReachable.set(g, canReachByLand(g.x, g.y, targetX, targetY, map, 4000, unit));
      return exitReachable.get(g);
    };
    let bestEntry = null, bestExit = null;
    let bestTurns = estimateMarchTurns(unit.x, unit.y, targetX, targetY, movement);
    for (const entry of gates) {
      const inTurns = estimateMarchTurns(unit.x, unit.y, entry.x, entry.y, movement);
      for (const exit of gates) {
        if (exit === entry || !canExitReach(exit)) continue;
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

  // Dwarf/Halfellow "rush to defend" (2026-07-30, user-directed): how close
  // an enemy unit has to be to one of this civ's own cities to count as
  // "under attack right now" -- covers both an adjacent melee siege and a
  // ranged/siege attacker sitting one tile back (matches the common
  // attacker ranges in units.js, e.g. Catapult/Trebuchet/Archer/Longbowman).
  const CITY_UNDER_ATTACK_RANGE = 2;

  /** Nearest of `civ`'s own cities (same landmass as `unit`, matching
   *  reinforceHomeCity's own scoping below) currently threatened by a
   *  visible, non-hidden enemy unit within CITY_UNDER_ATTACK_RANGE --
   *  unlike reinforceHomeCity, does NOT require the city to be undefended
   *  first: a city already fighting off an attacker still wants more help,
   *  not just an empty one. Returns null if no city qualifies. */
  function findCityUnderAttack(civ, unit, gameState) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const unitTile = map.tiles[unit.y * map.width + unit.x];
    const unitLandmassId = unitTile ? unitTile.landmassId : -1;
    let best = null, bestDist = Infinity;
    for (const city of civ.cities) {
      const cityTile = map.tiles[city.y * map.width + city.x];
      if (unitLandmassId >= 0 && cityTile && cityTile.landmassId !== unitLandmassId) continue;
      let underAttack = false;
      for (const other of Object.values(civs)) {
        if (other.id === civ.id || other.eliminated) continue;
        for (const eu of other.units) {
          if (eu.conditions?.hidden) continue;
          if (!visible.has(eu.y * map.width + eu.x)) continue;
          if (window.GameEngine.influence.chebyshev(city.x, city.y, eu.x, eu.y) <= CITY_UNDER_ATTACK_RANGE) {
            underAttack = true; break;
          }
        }
        if (underAttack) break;
      }
      if (!underAttack) continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, city.x, city.y);
      if (d < bestDist) { bestDist = d; best = city; }
    }
    return best;
  }

  /** Dwarf/Halfellow "rush to defend" (2026-07-30, user-directed): a unit
   *  not currently embroiled in its OWN fight (see nearActiveCombat, the
   *  same "currently engaged in combat" exemption the caller already
   *  computed) immediately beelines for the nearest of its civ's cities
   *  under attack right now, overriding whatever else it would otherwise do
   *  this turn. Checked very early in the dispatch cascade (right after
   *  nearActiveCombat is computed) so it actually preempts the generic
   *  hunt/patrol/explore/garrison logic further down instead of only ever
   *  winning by accident. Returns false (caller falls through to the rest
   *  of the cascade) if the unit is mid-fight or no city qualifies. */
  function maybeDefendCityUnderAttack(civ, unit, gameState, nearActiveCombat, log) {
    if (nearActiveCombat) return false; // finish the fight it's already in first
    const target = findCityUnderAttack(civ, unit, gameState);
    if (!target) return false;
    if (unit.x === target.x && unit.y === target.y) return false; // already there
    const usedGate = moveUnitTowardSmart(civ, unit, target.x, target.y, gameState);
    unit.usedThisTurn = true;
    unit.currentMission = usedGate
      ? `Used a Deep Gate to rush to the defense of ${target.name} at (${target.x},${target.y}), under attack`
      : `Rushing to defend ${target.name} at (${target.x},${target.y}), under attack`;
    log.push(`Rush to defend: ${civ.id}'s ${describeUnit(unit)} heads to defend ${target.name} at (${target.x},${target.y})`);
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
      log.push(`Deep Roads: ${civ.id}'s ${describeUnit(unit)} used a Deep Gate to ${label}`);
      return true;
    }
    moveUnitToward(unit, entry.x, entry.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Heading to a Deep Gate at (${entry.x},${entry.y}) to ${label}`;
    log.push(`Deep Roads: ${civ.id}'s ${describeUnit(unit)} heading to a Deep Gate to ${label}`);
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
      log.push(`Invasion: ${civ.id}'s ${describeUnit(unit)} waiting to board galley at (${emptyGalley.g.x},${emptyGalley.g.y})`);
      return true;
    }
    moveUnitToward(unit, emptyGalley.g.x, emptyGalley.g.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Marching to a galley at (${emptyGalley.g.x},${emptyGalley.g.y}) to invade overseas`;
    log.push(`Invasion: ${civ.id}'s ${describeUnit(unit)} heading overseas via galley at (${emptyGalley.g.x},${emptyGalley.g.y})`);
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
      log.push(`${label}: ${civ.id}'s ${describeUnit(unit)} waiting to board a galley for an overseas ${label}`);
      return true;
    }
    moveUnitToward(unit, emptyGalley.g.x, emptyGalley.g.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Marching to a galley at (${emptyGalley.g.x},${emptyGalley.g.y}) to reach an overseas ${label}`;
    log.push(`${label}: ${civ.id}'s ${describeUnit(unit)} heading to a galley to reach an overseas ${label} at (${spot.x},${spot.y})`);
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
          if (!isOpenPlacementTile(nx, ny, map, civs, occupied, civ.id)) continue;
          const cargo = unit.carries;
          cargo.carriedBy = null;
          cargo.x = nx; cargo.y = ny;
          snapVisualPos(cargo, nx, ny);
          unit.carries = null;
          log.push(`Dragon Riders: ${civ.id} dropped off ${describeUnit(cargo)} at (${nx},${ny})`);
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
    unit.currentMission = `Carrying a ${describeUnit(passenger)} as a rider`;
    log.push(`Dragon Riders: ${civ.id} dragon picked up ${describeUnit(passenger)}`);
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
            if (!isOpenPlacementTile(nx, ny, map, civs, occupied, civ.id)) continue;
            cargo.carriedBy = null;
            cargo.x = nx; cargo.y = ny;
            snapVisualPos(cargo, nx, ny);
            unit.carries = null;
            log.push(`Devoted Companions: ${civ.id}'s ${describeUnit(unit)} set down a fully healed ${describeUnit(cargo)} at (${nx},${ny})`);
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
    // Reservation (see maybeSeekInjuredCompanion/maybeWaitForCompanionCarry)
    // is done its job the instant the pickup actually happens.
    delete candidate._awaitedByCarrier;
    delete unit._seekingCompanion;
    unit.usedThisTurn = true;
    unit.currentMission = `Carrying an injured ${describeUnit(candidate)} to help it heal`;
    log.push(`Devoted Companions: ${civ.id}'s ${describeUnit(unit)} picked up injured ${describeUnit(candidate)} at (${unit.x},${unit.y})`);
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
  /** Releases whichever ally `carrier` was previously reserving via
   *  `_awaitedByCarrier` (see maybeSeekInjuredCompanion/
   *  maybeWaitForCompanionCarry below), if any -- only clears it when this
   *  carrier is still the one that set it (never steps on a DIFFERENT
   *  carrier's reservation of the same ally). */
  function releaseCompanionReservation(carrier) {
    if (carrier._seekingCompanion && carrier._seekingCompanion._awaitedByCarrier === carrier) {
      delete carrier._seekingCompanion._awaitedByCarrier;
    }
    delete carrier._seekingCompanion;
  }

  function maybeSeekInjuredCompanion(civ, unit, gameState, log) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("devoted_companions")) return false;
    if (unit.carries || unit.carriedBy) return false;
    const { map, civs } = gameState;
    let nearest = null, nearestDist = Infinity;
    for (const u of civ.units) {
      if (u === unit || u.carriedBy || u.carries || u.usedThisTurn) continue;
      if (u.hp >= u.maxHp * COMPANION_INJURY_THRESHOLD) continue;
      // Already reserved by a DIFFERENT live carrier -- don't pile on, let
      // that carrier finish the job (see maybeWaitForCompanionCarry).
      if (u._awaitedByCarrier && u._awaitedByCarrier !== unit && civ.units.includes(u._awaitedByCarrier)) continue;
      const d = window.GameEngine.influence.chebyshev(unit.x, unit.y, u.x, u.y);
      if (d < nearestDist) { nearestDist = d; nearest = u; }
    }
    if (!nearest || nearestDist <= 1 || nearestDist > COMPANION_SEEK_RADIUS) {
      releaseCompanionReservation(unit); // no longer seeking -- free up whoever we had reserved
      return false;
    }
    // Reserve `nearest` (2026-07-22, user-directed: the injured ally should
    // stop and wait for its rescuer instead of wandering off mid-approach)
    // -- release a previous, different reservation first.
    if (unit._seekingCompanion !== nearest) releaseCompanionReservation(unit);
    nearest._awaitedByCarrier = unit;
    unit._seekingCompanion = nearest;
    moveUnitToward(unit, nearest.x, nearest.y, map, civs);
    unit.usedThisTurn = true;
    unit.currentMission = `Rushing to carry injured ${describeUnit(nearest)} at (${nearest.x},${nearest.y})`;
    log.push(`Devoted Companions: ${civ.id}'s ${describeUnit(unit)} moves to reach injured ${describeUnit(nearest)}`);
    return true;
  }

  /** Halfellow "Devoted Companions" -- an injured ally a carrier has
   *  committed to fetching (see maybeSeekInjuredCompanion's
   *  `_awaitedByCarrier` reservation) holds position and waits to be
   *  carried instead of acting normally this turn (2026-07-22, user-
   *  directed: "the target unit should stop and wait, and accept the carry
   *  until healed" -- wandering off mid-rescue just strands the carrier
   *  chasing a moving target). Checked ahead of every other dispatch
   *  branch. An adjacent enemy is a fight, not a wait -- falls through to
   *  the normal attack dispatch, same carve-out every other "hold position
   *  and wait" play in this file uses (see maybeInvasionAmbushWait/
   *  maybeProspectorsClaimPlay). Clears the reservation (and resumes normal
   *  behavior) the instant it's stale: the carrier died, got reassigned to
   *  someone else, picked up a different passenger, or this unit healed
   *  back above the injury threshold on its own. Returns true if it
   *  consumed the unit's turn. */
  function maybeWaitForCompanionCarry(civ, unit, gameState, log) {
    const carrier = unit._awaitedByCarrier;
    if (!carrier) return false;
    const stillValid = civ.units.includes(carrier) && carrier.hp > 0 && !carrier.carries
      && carrier._seekingCompanion === unit && unit.hp < unit.maxHp * COMPANION_INJURY_THRESHOLD;
    if (!stillValid) { delete unit._awaitedByCarrier; return false; }

    const { civs } = gameState;
    for (const oc of Object.values(civs)) {
      if (oc.id === civ.id || oc.eliminated) continue;
      for (const eu of oc.units) {
        if (eu.conditions?.hidden) continue;
        if (window.GameEngine.influence.chebyshev(eu.x, eu.y, unit.x, unit.y) <= 1) return false;
      }
    }
    unit.resting = true;
    unit.usedThisTurn = true;
    unit.currentMission = `Waiting for ${describeUnit(carrier)} to arrive and carry it`;
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
        if (!isOpenPlacementTile(nx, ny, map, civs, occupied, civ.id)) continue;
        unit.carriedBy = null;
        carrier.carries = null;
        unit.x = nx; unit.y = ny;
        snapVisualPos(unit, nx, ny);
        log.push(`Devoted Companions: ${civ.id}'s ${describeUnit(unit)} disembarks to join the fight at (${nx},${ny})`);
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
            unit.currentMission = `Force-disembarked ${describeUnit(cargo)} at (${nx},${ny})`;
            log.push(`Naval: ${civ.id} galley force-disembarked ${describeUnit(cargo)} at (${nx},${ny}) after 3 turns near shore`);
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
          unit.currentMission = `Disembarked ${describeUnit(cargo)} at (${landTarget.landX},${landTarget.landY})`;
          log.push(`Naval: ${civ.id} galley disembarked ${describeUnit(cargo)} at (${landTarget.landX},${landTarget.landY})`);
        } else {
          unit.currentMission = `Ferrying ${describeUnit(cargo)} to land at (${landTarget.landX},${landTarget.landY})`;
        }
      } else {
        const foreignShore = findForeignShore(civ, unit, map, invasionLandmassId);
        if (foreignShore) {
          moveUnitToward(unit, foreignShore.x, foreignShore.y, map, civs);
          unit.currentMission = `Ferrying ${describeUnit(cargo)} toward a foreign shore`;
        } else {
          exploreWater(unit, gameState, log);
          unit.currentMission = `Ferrying ${describeUnit(cargo)}, searching for land`;
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
            unit.currentMission = `Carrying a ${describeUnit(boarder)}`;
            log.push(`Naval: ${civ.id} ${describeUnit(boarder)} boarded galley at (${unit.x},${unit.y})`);
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
          unit.currentMission = `Sailing to pick up a stranded ${describeUnit(strandedUnit)} at (${strandedUnit.x},${strandedUnit.y})`;
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
        log.push(`${civ ? civ.id : unit.civId}'s ${describeUnit(unit)} gives up exploring a local dead end, heads for (${farTarget.x},${farTarget.y})`);
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
  /**
   * Halfellow "Keep an Eye Out" (2026-07-24, user-directed): civ-wide (any
   * unit, not just Trouble Maker) lookout post -- go Hidden and hold
   * position for +3 vision radius (see combat.js's canGoHidden and
   * turns.js's visionRadius computation). Deliberately checked only as a
   * LAST-resort fallback (see its call site in runUnitTurn's terminal
   * exploreWith fallback) rather than competing with real exploring/combat/
   * economy priorities -- this is specifically for the "genuinely nothing
   * left to do" case the 2026-07-23 stuck-unit fix identified, turning
   * "does nothing at all" into "productively watches the border" instead.
   * `hidden` and `keepingWatch` share the same 3-turn expiry, so both clear
   * together and the unit is forced visible for 1 turn before it can
   * re-enter -- same natural cycle Hidden already has, no extra bookkeeping
   * needed. Returns true if it consumed the turn. */
  function maybeKeepAnEyeOutPlay(civ, unit, gameState, log) {
    if (civ.raceId !== "halfellow" || !civ.unlockedMechanics || !civ.unlockedMechanics.has("keep_an_eye_out")) return false;
    if (unit.conditions?.keepingWatch) {
      // Already watching (mid-cycle) -- just hold position.
      unit.resting = true;
      unit.usedThisTurn = true;
      unit.currentMission = "Keeping an eye out (holding position)";
      return true;
    }
    if (!window.GameEngine.combat.canGoHidden(unit, civ, gameState.civs)) return false;
    const expiresAtTurn = currentTurnNumber + 3;
    window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
    window.GameEngine.combat.setCondition(unit, "keepingWatch", { expiresAtTurn, visionBonus: 3 });
    unit.resting = true;
    unit.usedThisTurn = true;
    unit.currentMission = "Settling in to keep an eye out";
    log.push(`Keep an Eye Out: ${civ.id}'s ${describeUnit(unit)} takes up a lookout post at (${unit.x},${unit.y})`);
    return true;
  }

  /** Nearest currently-unclaimed (not yet in city.filledOffsets), in-radius
   *  tile across all of `civ`'s own cities -- the pool Envoy (and organic
   *  growth/Cultural Influence) draws from. Returns { x, y, city, key } or
   *  null if every city's radius is already fully filled. */
  function findEnvoyTarget(civ, unit, gameState) {
    const { map } = gameState;
    let best = null, bestDist = Infinity;
    for (const city of civ.cities) {
      const radius = city.influenceRadius;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const key = `${dx},${dy}`;
          if (city.filledOffsets.has(key)) continue;
          const tx = city.x + dx, ty = city.y + dy;
          if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
          if (window.GameData.TERRAIN[map.tiles[ty * map.width + tx].terrain].isWater) continue;
          const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, tx, ty);
          if (dist < bestDist) { bestDist = dist; best = { x: tx, y: ty, city, key }; }
        }
      }
    }
    return best;
  }

  /**
   * Halfellow "Envoy" (2026-07-24, user-directed): Pioneer or Wanderer may
   * channel for a flat 2 turns on an already-in-radius, unclaimed tile to
   * claim it outright (city.filledOffsets.add, same underlying claim
   * mechanism organic growth and Cultural Influence both use -- see
   * performClaimInfluenceTile) -- independent of the normal gradual
   * fill-in rate, and lets the AI CHOOSE which tile gets priority instead
   * of waiting on the passive fill order. Checked as a low priority
   * (secondary to settling/fighting) opportunistic action for an otherwise
   * idle Pioneer/Wanderer -- see its call sites in maybeFoundCity (Pioneer)
   * and runUnitTurn (Wanderer). Returns true if it consumed the turn. */
  function maybeEnvoyPlay(civ, unit, gameState, log) {
    if (civ.raceId !== "halfellow" || !civ.unlockedMechanics || !civ.unlockedMechanics.has("envoy")) return false;
    if (unit.typeId !== "pioneer" && unit.typeId !== "wanderer") return false;

    if (unit.channeling === "envoy") {
      const stayedPut = unit.x === unit._envoyX && unit.y === unit._envoyY;
      if (!stayedPut) { unit.channeling = null; unit._envoyTurns = 0; return false; }
      unit._envoyTurns = (unit._envoyTurns || 0) + 1;
      if (unit._envoyTurns >= 2) {
        const city = unit._envoyCity;
        if (city && civ.cities.includes(city)) {
          city.filledOffsets.add(unit._envoyKey);
          log.push(`Envoy: ${civ.id}'s ${describeUnit(unit)} claims (${unit.x},${unit.y}) for ${city.name}`);
        }
        unit.channeling = null;
        unit._envoyTurns = 0;
        unit._envoyCity = null;
      } else {
        unit.currentMission = `Acting as Envoy, claiming this tile (${unit._envoyTurns}/2 turns)`;
      }
      unit.resting = true;
      unit.usedThisTurn = true;
      return true;
    }

    const target = findEnvoyTarget(civ, unit, gameState);
    if (!target) return false;
    if (unit.x !== target.x || unit.y !== target.y) {
      moveUnitToward(unit, target.x, target.y, gameState.map, gameState.civs);
      unit.usedThisTurn = true;
      unit.currentMission = `Heading to act as Envoy at (${target.x},${target.y})`;
      return true;
    }
    unit.channeling = "envoy";
    unit._envoyTurns = 0;
    unit._envoyX = unit.x;
    unit._envoyY = unit.y;
    unit._envoyCity = target.city;
    unit._envoyKey = target.key;
    unit.resting = true;
    unit.usedThisTurn = true;
    unit.currentMission = "Settling in to act as Envoy";
    return true;
  }

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
      unit.currentMission = `Going hidden — outmatched by ${enemyCiv.id}'s ${describeUnit(nearest)} nearby`;
      log.push(`Stealth: ${civ.id}'s ${describeUnit(unit)} goes hidden defensively at (${unit.x},${unit.y})`);
      return true;
    }

    if (civ.unlockedMechanics.has("knife_in_the_dark") && winProb < threshold) {
      const alliesNearby = civ.units.filter((u) =>
        u !== unit && !u.carriedBy && window.GameData.getUnit(u.typeId).category === "military"
        && window.GameEngine.influence.chebyshev(u.x, u.y, nearest.x, nearest.y) <= HALFELLOW_STEALTH_RANGE);
      const myPower = unitCombatPower(unit, civ);
      const isStrongestNearby = alliesNearby.every((u) => unitCombatPower(u, civ) <= myPower);
      if (alliesNearby.length > 0 && isStrongestNearby) {
        unit.currentMission = `Holding as bait near ${enemyCiv.id}'s ${describeUnit(nearest)} at (${nearest.x},${nearest.y})`;
        return false;
      }

      window.GameEngine.combat.enterHidden(unit, currentTurnNumber);
      unit.usedThisTurn = true;
      unit.currentMission = `Going hidden — setting up an ambush on ${enemyCiv.id}'s ${describeUnit(nearest)}`;
      log.push(`Stealth: ${civ.id}'s ${describeUnit(unit)} goes hidden to ambush ${enemyCiv.id}'s ${describeUnit(nearest)} near (${unit.x},${unit.y})`);
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

  // Elf "hunting party" (2026-07-30, user-directed): flat, not per-ally-
  // scaled like RANGER_VOLLEY_BONUS above -- the party's shared target
  // should win out over almost any other candidate for a member that can
  // reach it, not just get a nudge proportional to how many siblings are
  // also in range.
  const ELF_PARTY_FOCUS_BONUS = 25;

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

  /**
   * Whether `unit` may attack `enemyUnit` right now: the enemy is visible and
   * not Hidden, within this unit's effective range, and either has a clear
   * ranged line of sight (dist > 1) or is reachable on foot (adjacent melee).
   *
   * Extracted from considerAttackOrGarrison's candidate loop (2026-08-01) so
   * the player's attack cursor and the AI's target list answer that question
   * with the same code -- the UI must never offer an attack the engine will
   * then refuse, or refuse one the AI would happily make.
   */
  function canAttackUnitNow(civ, unit, enemyUnit, gameState) {
    const { map } = gameState;
    if (!enemyUnit || enemyUnit.civId === civ.id || enemyUnit.hp <= 0) return false;
    const visible = gameState.visibility[civ.id] || new Set();
    if (!visible.has(enemyUnit.y * map.width + enemyUnit.x) || enemyUnit.conditions?.hidden) return false;
    const range = window.GameEngine.combat.effectiveRange(unit, civ);
    const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, enemyUnit.x, enemyUnit.y);
    if (dist > range) return false;
    if (dist > 1) {
      // Ranged: doesn't need to physically reach the target (see units.js's
      // range property doc) -- a clear line matters instead, not footpath
      // reachability.
      return hasRangedLineOfSight(map, unit.x, unit.y, enemyUnit.x, enemyUnit.y);
    }
    // Melee: skip enemies that can't be reached on foot (across water or mountains)
    return canReachByLand(unit.x, unit.y, enemyUnit.x, enemyUnit.y, map, 150, unit);
  }

  /**
   * @param opts.forcedTarget  A specific enemy unit to attack, bypassing the
   *   scoring loop below. Set only by a human player's explicit attack order
   *   (see orders.js): the player has already decided WHO to hit, but the
   *   ~200 lines of follow-through after the target is chosen -- Burning,
   *   Fireball splash, curses, Freeze, zombie raising, replacement spawns,
   *   cargo drops, plunder, XP, quips, combat events -- must still all run
   *   exactly as they do for the AI. Rather than duplicate any of that, a
   *   player order enters through this same function with the choice
   *   pre-made. Still validated via canAttackUnitNow, so a forced target
   *   can't bypass range/visibility rules.
   */
  function considerAttackOrGarrison(civ, unit, gameState, weights, difficulty, log, opts = {}) {
    const { map, civs } = gameState;
    const visible = gameState.visibility[civ.id] || new Set();
    const range = window.GameEngine.combat.effectiveRange(unit, civ);

    let bestTarget = null, bestScore = -Infinity, bestCoalitionShift = 0, bestWinProb = 0;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const enemyUnit of otherCiv.units) {
        if (opts.forcedTarget && enemyUnit !== opts.forcedTarget) continue;
        if (!canAttackUnitNow(civ, unit, enemyUnit, gameState)) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, enemyUnit.x, enemyUnit.y);

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
        // Elf "hunting party" (2026-07-30, user-directed): the whole party's
        // shared target (see computeElfPartyTarget) dominates target
        // selection for every member that can currently reach it -- similar
        // shape to Ranger volley above, but civ-wide/party-wide rather than
        // scaling with how many allies are in range, since the whole point
        // is "everyone piles onto the one target until it's dead," not just
        // a soft preference.
        if (civ.raceId === "elf" && civ._elfPartyTarget === enemyUnit) {
          score += ELF_PARTY_FOCUS_BONUS;
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

    // A forced (player-ordered) target skips the AI's willingness gates
    // entirely -- both the `bestScore > 5` "is this worth doing" bar and the
    // winProb suppression above exist to stop the AI throwing units away, and
    // neither is the engine's business when a human has explicitly ordered the
    // attack. Eligibility was already enforced by canAttackUnitNow.
    if (opts.forcedTarget && bestTarget === opts.forcedTarget) bestScore = Infinity;

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
    window.SfxSystem.playAction(civ.raceId, unit.typeId, "attack", unit.x, unit.y);
      const result = window.GameEngine.combat.resolveRound(unit, bestTarget, civs, combatContext);
      window.GameEngine.combat.recordCombatEvent({
        ax: unit.x, ay: unit.y, atkUnit: unit,
        dx: bestTarget.x, dy: bestTarget.y, defUnit: bestTarget,
      });
      // Double Strike (see combat.js's resolveRound): the follow-up hit gets
      // its own animation, callout and (delayed) attack sfx, so a second blow
      // reads as a second blow rather than as one unusually large damage
      // number. Delay roughly matches render.js's own attack-animation beat.
      if (result.doubleStruck) {
        window.GameEngine.floatingText.spawnFloatingText(unit, "Double Strike!", "strike");
        window.GameEngine.combat.recordCombatEvent({
          ax: unit.x, ay: unit.y, atkUnit: unit,
          dx: bestTarget.x, dy: bestTarget.y, defUnit: bestTarget,
        });
        window.SfxSystem.playAction(civ.raceId, unit.typeId, "attack", unit.x, unit.y, DOUBLE_STRIKE_SFX_DELAY_MS);
      }
      markCombatEngaged(civ);
      markCombatEngaged(defenderCiv);
      // Hidden: attacking reveals the attacker, regardless of target type.
      // "Ambush!" floating text (2026-07-22, user-directed): checked before
      // the reveal clears the condition.
      const wasHiddenForAttack = !!unit.conditions?.hidden;
      window.GameEngine.combat.revealHidden(unit, currentTurnNumber);
      if (wasHiddenForAttack) {
        window.GameEngine.floatingText.spawnFloatingText(unit, "Ambush!", "warning");
        // Elf ambush follow-through (2026-07-22, user-directed): don't let
        // maybeElfStealthPlay re-hide this unit until the target it just
        // sprang the ambush on is actually dead -- see stillEngagedInAmbush,
        // checked at the top of that function. Only meaningful while the
        // target survives; if it died this exact hit, there's nothing left
        // to "finish," so the very next stillEngagedInAmbush check already
        // clears it.
        unit._meleeAmbushVictim = bestTarget;
      }
      log.push(`Attack: ${civ.id}'s ${describeUnit(unit)} vs ${bestTarget.civId}'s ${describeUnit(bestTarget)} -> ` +
        `${result.returnSkipped ? "first strike" : result.fullNegated ? "negated" : result.fullMissed ? "missed (flying)" : result.fullDamage + " dmg"}` +
        (result.forwardSkipped ? ", attacker killed before landing a hit"
          : result.counterOutOfRange ? ", ranged (defender out of counter range)"
          : result.counterDenied ? ", counter denied (first strike)"
          : result.counterMissed ? ", counter missed (flying)"
          : result.counterNegated ? ", counter negated" : `, ${result.counterDamage} counter`) +
        (result.doubleStruck
          ? `, DOUBLE STRIKE ${result.doubleNegated ? "negated" : result.doubleMissed ? "missed (flying)" : result.doubleDamage + " dmg"}`
          : "") +
        (Math.abs(bestCoalitionShift) > 0.1
          ? ` [odds ${Math.round(bestWinProb * 100)}%, ${bestCoalitionShift > 0 ? "emboldened" : "wary"} by allies]`
          : ""));

      // Orc "Burn It All Down": a Scout or Dragon's RANGED hit (dist > 1 --
      // adjacent melee doesn't count, per the tech's own wording) sets the
      // target ablaze. Goblin Miscreant is a deliberate exception
      // (2026-07-22, user-directed): its MELEE attacks also ignite the
      // target, adjacent or not -- it has no ranged option at all, so the
      // ranged-only restriction would otherwise just exclude it entirely.
      // Same landed-hit guard First Frost of Autumn uses just below --
      // nothing to ignite if the attack never connected.
      const isRangedFirebrand = (unit.typeId === "scout" || unit.typeId === "dragon")
        && window.GameEngine.influence.chebyshev(unit.x, unit.y, bestTarget.x, bestTarget.y) > 1;
      const isMeleeGoblinFirebrand = unit.typeId === "goblin_miscreant";
      if ((isRangedFirebrand || isMeleeGoblinFirebrand)
          && civ.unlockedMechanics && civ.unlockedMechanics.has("burn_it_all_down")
          && !result.fullNegated && !result.fullMissed) {
        applyBurning(bestTarget, "unit", gameState);
        log.push(`Burn It All Down: ${civ.id}'s ${describeUnit(unit)} sets ${bestTarget.civId}'s ${describeUnit(bestTarget)} ablaze`);
      }

      // Human "Fireball!": Wizard splash damage to everything adjacent to the
      // target, PLUS Burning (2026-07-22, user-directed) on the primary
      // target and every splash victim -- units and buildings/walls, but
      // NOT cities themselves (2026-07-22, user-directed removal).
      if (unit.typeId === "wizard" && civ.unlockedMechanics && civ.unlockedMechanics.has("fireball_splash")) {
        if (!result.fullNegated && !result.fullMissed) applyBurning(bestTarget, "unit", gameState);
        const hits = window.GameEngine.combat.applySplashDamage(unit, civ, bestTarget.x, bestTarget.y, gameState);
        for (const hit of hits) {
          if (hit.kind === "unit") applyBurning(hit.unit, "unit", gameState);
          else if (hit.kind === "structure") applyBurning(hit.record, "structure", gameState);
        }
        if (hits.length) log.push(`Fireball splash: ${hits.length} additional target(s) hit and set ablaze`);
        // Highlights the splash radius for a moment (2026-07-22, user-directed)
        // -- applySplashDamage's own radius is a fixed 1-tile adjacency (see
        // combat.js), centered on the primary target, same as the damage itself.
        window.GameEngine.combat.spawnAreaEffect(bestTarget.x, bestTarget.y, 1, "fireball");
      }

      // Orc curse abilities: Bog Witch's death-curse and Malefic Malediction's
      // curse-on-any-hit.
      applyOrcCombatMechanics(unit, civ, bestTarget, defenderCiv, result, gameState);

      // Elf "First Frost of Autumn": passive chance to Freeze on any landed hit.
      applyElfCombatMechanics(unit, civ, bestTarget, defenderCiv, result, gameState);

      if (bestTarget.hp <= 0) {
        // Undead "Zombie": tried BEFORE any of the usual "this unit really
        // died" bookkeeping below, since a successful zombie application
        // means bestTarget is still standing on its own tile, alive, just
        // transferred to civ's control -- none of the corpse-handling logic
        // (roster removal, replacement spawns, cargo drop) applies to it.
        const zombified = maybeApplyZombie(civ, unit, bestTarget, civs);
        if (zombified) {
          log.push(`Zombie: ${civ.id}'s ${describeUnit(unit)} raises ${defenderCiv.id}'s fallen ${describeUnit(bestTarget)} as a zombie under ${civ.id}'s control`);
        } else {
          otherCivRemoveDeadUnit(civs, bestTarget);
          // Orc "Hound and Hunter": a defending Wolf Rider's death may spawn
          // its replacement on its own now-vacated tile.
          if (bestTarget.typeId === "wolf_rider" && defenderCiv.unlockedMechanics
              && defenderCiv.unlockedMechanics.has("hound_and_hunter")) {
            const replacement = window.GameEngine.combat.maybeSpawnHoundAndHunter(defenderCiv, bestTarget.x, bestTarget.y, map);
            if (replacement) log.push(`Hound and Hunter: ${defenderCiv.id}'s fallen Wolf Rider is replaced by a ${describeUnit(replacement)} at (${replacement.x},${replacement.y})`);
          }
          // Halfellow "Undaunted" (2026-07-20, user-directed): same shape as
          // Hound and Hunter above, this time for a defending Pony Patrol's death.
          if (bestTarget.typeId === "pony_patrol" && defenderCiv.unlockedMechanics
              && defenderCiv.unlockedMechanics.has("undaunted")) {
            const replacement = window.GameEngine.combat.maybeSpawnPonyReplacement(defenderCiv, bestTarget.x, bestTarget.y, map);
            if (replacement) log.push(`Undaunted: ${defenderCiv.id}'s fallen Pony Patrol is replaced by a ${describeUnit(replacement)} at (${replacement.x},${replacement.y})`);
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
        }
        // Anti-Titan learning: the defeated civ just lost a unit TO a Titan
        // (fires regardless of whether it was then raised as a zombie).
        if (unit.typeId === "runeforged_titan") maybeLearnAntiTitanLesson(defenderCiv);
        // Orc "Honor the Dead": the defeated civ's OWN loss grants them lore,
        // regardless of who defeated them (or what became of the body after).
        if (defenderCiv.deathLoreBonus) {
          defenderCiv.stockpile = defenderCiv.stockpile || { harvest: 0, coin: 0, lore: 0 };
          defenderCiv.stockpile.lore = (defenderCiv.stockpile.lore || 0) + defenderCiv.deathLoreBonus;
        }
        const attackerRace = window.GameData.getRace(civ.raceId);
        // Undead heal on kill
        if (attackerRace.healOnKillPct && unit.hp > 0) {
          const beforeKillHeal = unit.hp;
          unit.hp = Math.min(unit.maxHp, unit.hp + Math.max(1, Math.round(unit.maxHp * attackerRace.healOnKillPct / 100)));
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
          if (replacement) log.push(`Hound and Hunter: ${civ.id}'s fallen Wolf Rider is replaced by a ${describeUnit(replacement)} at (${replacement.x},${replacement.y})`);
        }
        // Halfellow "Undaunted": same shape, this time for the attacker's
        // own Pony Patrol dying to a counter.
        if (unit.typeId === "pony_patrol" && civ.unlockedMechanics && civ.unlockedMechanics.has("undaunted")) {
          const replacement = window.GameEngine.combat.maybeSpawnPonyReplacement(civ, unit.x, unit.y, map);
          if (replacement) log.push(`Undaunted: ${civ.id}'s fallen Pony Patrol is replaced by a ${describeUnit(replacement)} at (${replacement.x},${replacement.y})`);
        }
        otherCivRemoveDeadUnit(civs, unit);
      }

      // Veteran leveling: XP for both sides based on what actually happened
      // this exchange (see combat.js's LEVELING section) -- a dead unit
      // doesn't bother leveling, there's nothing left to spend it on.
      if (unit.hp > 0) {
        // Double Strike's follow-up hit is real damage this unit dealt, so it
        // earns XP like any other -- see combat.js's resolveRound.
        grantXPAndAutoLevel(unit, civ, window.GameEngine.combat.xpForCombatAction(
          { damage: result.fullDamage + result.doubleDamage,
            killedUnitTypeId: bestTarget.hp <= 0 ? bestTarget.typeId : null }));
      }
      if (bestTarget.hp > 0) {
        grantXPAndAutoLevel(bestTarget, defenderCiv, window.GameEngine.combat.xpForCombatAction(
          { damage: result.counterDamage, killedUnitTypeId: unit.hp <= 0 ? unit.typeId : null }));
      }

      unit.usedThisTurn = true;
      unit.currentMission = unit.hp > 0
        ? `Attacking an enemy ${describeUnit(bestTarget)} at (${bestTarget.x},${bestTarget.y})`
        : "Fallen in battle";
      return true;
    }

    // A player-ordered attack must hit exactly what was ordered and nothing
    // else. If the forced unit target turned out ineligible, stop here rather
    // than falling through and opportunistically hitting some city or wall the
    // player never picked.
    if (opts.forcedTarget) return false;

    // No worthwhile unit fight — consider attacking an ungarrisoned enemy
    // CITY directly, within this unit's range (a real HP pool now -- see
    // combat.js's attackCity/cityMaxHp -- destroys it outright at level 1,
    // otherwise chips its HP down and knocks it a level once that pool
    // empties), or razing a structure to strip its influence/economy bonus. Both require
    // the target tile to have no defender -- the garrison must be dealt with
    // first via the normal unit-targeting pass above. A city is scored well
    // above any single structure (it's the whole influence source, not one
    // multiplier), tempered by its win probability so a civ doesn't throw
    // itself against a fortress it can't crack; siege-property units and
    // civ-wide siege tech both raise that probability via effectiveAttack's
    // isSiege context (the same mechanism attackStructure already uses) --
    // but only when actually adjacent (see cityAttackWinProbability): a
    // Ranged attack from further away never gets the siege boost.
    let bestCity = null, bestCityScore = -Infinity;
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
          if (opts.forcedCity && targetCity !== opts.forcedCity) continue;
          const garrisonPresent = Object.values(civs).some((oc) =>
            oc.units.some((u) => u.x === cx && u.y === cy && !u.conditions?.hidden));
          if (garrisonPresent) continue; // defender intercepts -- city is safe for now
          const winProb = window.GameEngine.combat.cityAttackWinProbability(unit, targetCity, civ);
          const level = Math.floor(targetCity.population);
          let score = winProb * 50 * (weights.attack || 1.0) + level * 5;
          if (winProb < minAcceptableWinProbability(civ)) score *= 0.1; // heavily suppressed, not zeroed
          if (score > bestCityScore) {
            bestCityScore = score;
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
        if (opts.forcedStructure && s.record !== opts.forcedStructure) continue;
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

    // Player-ordered city/structure attack: force the decision below onto the
    // ordered target and suppress the other kind entirely, so an ordered wall
    // strike can't get "upgraded" into a city assault (or vice versa) by the
    // AI's own relative scoring. Same rationale as the forcedTarget gate on
    // the unit path above.
    if (opts.forcedCity) {
      bestStruct = null; bestStructScore = -Infinity;
      if (bestCity) bestCityScore = Infinity;
    }
    if (opts.forcedStructure) {
      bestCity = null; bestCityScore = -Infinity;
      if (bestStruct) bestStructScore = Infinity;
    }

    if (bestCity && bestCityScore >= bestStructScore) {
      window.GameEngine.quips.maybeQuip(unit, civ, "attack", gameState);
    window.SfxSystem.playAction(civ.raceId, unit.typeId, "attack", unit.x, unit.y);
      const result = window.GameEngine.combat.attackCity(unit, bestCity.city, civ, bestCity.civ, gameState);
      window.GameEngine.combat.recordCombatEvent({
        ax: unit.x, ay: unit.y, atkUnit: unit,
        dx: bestCity.city.x, dy: bestCity.city.y, defUnit: null,
      });
      markCombatEngaged(civ); // attacker only -- no defending unit is engaged here
      // Hidden: attacking reveals the attacker, regardless of target type.
      // "Ambush!" floating text (2026-07-22, user-directed): checked before
      // the reveal clears the condition.
      const wasHiddenForCityAttack = !!unit.conditions?.hidden;
      window.GameEngine.combat.revealHidden(unit, currentTurnNumber);
      if (wasHiddenForCityAttack) window.GameEngine.floatingText.spawnFloatingText(unit, "Ambush!", "warning");
      if (result.counterDamage) {
        log.push(`Rouse the People: ${bestCity.civ.id}'s city struck back at ${civ.id}'s ${describeUnit(unit)} for ${result.counterDamage}`);
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
        log.push(`Siege: ${civ.id}'s ${describeUnit(unit)} razed ${bestCity.civ.id}'s city to the ground!`);
        if (bestCity.civ.hasFoundedCity && bestCity.civ.cities.length === 0 && !bestCity.civ.eliminated) {
          window.GameEngine.turns.eliminateCiv(gameState, bestCity.civ);
          log.push(`${bestCity.civ.id} has been eliminated!`);
        }
        unit.currentMission = `Razed ${bestCity.civ.id}'s city to the ground`;
      } else if (result.populationLost) {
        log.push(`Siege: ${civ.id}'s ${describeUnit(unit)} broke ${bestCity.civ.id}'s city's defenses, knocking it to level ${Math.floor(bestCity.city.population)} (${result.hp}/${result.maxHp} hp)`);
        unit.currentMission = `Besieging ${bestCity.civ.id}'s city at (${bestCity.city.x},${bestCity.city.y})`;
      } else {
        log.push(`Siege: ${civ.id}'s ${describeUnit(unit)} damaged ${bestCity.civ.id}'s city (${result.hp}/${result.maxHp} hp)`);
        unit.currentMission = `Besieging ${bestCity.civ.id}'s city at (${bestCity.city.x},${bestCity.city.y})`;
      }
      unit.usedThisTurn = true;
      // Veteran leveling: city damage IS a real number now (2026-08-04 --
      // see combat.js's attackCity), same damage-scaled xpForCombatAction
      // formula attackStructure's caller already uses, plus flat bonuses
      // for knocking a level off / destroying the city outright.
      if (unit.hp > 0) {
        let cityXP = window.GameEngine.combat.xpForCombatAction({ damage: result.damage });
        if (result.populationLost) cityXP += 5;
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
          if (replacement) log.push(`Hound and Hunter: ${civ.id}'s fallen Wolf Rider is replaced by a ${describeUnit(replacement)} at (${replacement.x},${replacement.y})`);
        }
        // Halfellow "Undaunted": same replacement chance as any other Pony
        // Patrol death, this time slain by a city's own counterattack.
        if (unit.typeId === "pony_patrol" && civ.unlockedMechanics && civ.unlockedMechanics.has("undaunted")) {
          const replacement = window.GameEngine.combat.maybeSpawnPonyReplacement(civ, unit.x, unit.y, map);
          if (replacement) log.push(`Undaunted: ${civ.id}'s fallen Pony Patrol is replaced by a ${describeUnit(replacement)} at (${replacement.x},${replacement.y})`);
        }
        otherCivRemoveDeadUnit(civs, unit);
        log.push(`Rouse the People: ${civ.id}'s ${describeUnit(unit)} was slain by ${bestCity.civ.id}'s city`);
      }
      return true;
    }
    if (bestStruct) {
      window.GameEngine.quips.maybeQuip(unit, civ, "attack", gameState);
    window.SfxSystem.playAction(civ.raceId, unit.typeId, "attack", unit.x, unit.y);
      const res = window.GameEngine.combat.attackStructure(unit, bestStruct.s.record, civ, bestStruct.s.civ, gameState);
      window.GameEngine.combat.recordCombatEvent({
        ax: unit.x, ay: unit.y, atkUnit: unit,
        dx: bestStruct.x, dy: bestStruct.y, defUnit: null,
      });
      markCombatEngaged(civ); // attacker only -- no defending unit is engaged here
      // Hidden: attacking reveals the attacker, regardless of target type.
      // "Ambush!" floating text (2026-07-22, user-directed): checked before
      // the reveal clears the condition.
      const wasHiddenForStructAttack = !!unit.conditions?.hidden;
      window.GameEngine.combat.revealHidden(unit, currentTurnNumber);
      if (wasHiddenForStructAttack) window.GameEngine.floatingText.spawnFloatingText(unit, "Ambush!", "warning");
      if (res.counterDamage) {
        log.push(`Structure counter: ${bestStruct.s.civ.id}'s ${bestStruct.s.record.id} struck back at ${civ.id}'s ${describeUnit(unit)} for ${res.counterDamage}`);
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
        log.push(`Raze: ${civ.id}'s ${describeUnit(unit)} destroyed ${bestStruct.s.civ.id}'s ${bestStruct.s.record.id}`);
        unit.currentMission = `Destroyed ${bestStruct.s.civ.id}'s ${bestStruct.s.record.id}`;
      } else {
        log.push(`Raid: ${civ.id}'s ${describeUnit(unit)} damaged ${bestStruct.s.record.id} (${Math.max(0, bestStruct.s.record.hp)}/${bestStruct.s.record.maxHp})`);
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
          if (replacement) log.push(`Hound and Hunter: ${civ.id}'s fallen Wolf Rider is replaced by a ${describeUnit(replacement)} at (${replacement.x},${replacement.y})`);
        }
        // Halfellow "Undaunted": same replacement chance, this time slain
        // by a structure's own counterattack.
        if (unit.typeId === "pony_patrol" && civ.unlockedMechanics && civ.unlockedMechanics.has("undaunted")) {
          const replacement = window.GameEngine.combat.maybeSpawnPonyReplacement(civ, unit.x, unit.y, map);
          if (replacement) log.push(`Undaunted: ${civ.id}'s fallen Pony Patrol is replaced by a ${describeUnit(replacement)} at (${replacement.x},${replacement.y})`);
        }
        otherCivRemoveDeadUnit(civs, unit);
        log.push(`Structure counter: ${civ.id}'s ${describeUnit(unit)} was slain by ${bestStruct.s.civ.id}'s ${bestStruct.s.record.id}`);
      }
      return true;
    }
    return false;
  }

  // Cold-start floors for Siege/First Strike/Double Strike's proportional-
  // growth score below -- NOT an eligibility gate (every unit can pick up
  // any of the three from zero; see chooseLevelUpStat's doc comment).
  // Chosen so a unit with NONE of that property yet scores comparably to a
  // typical Attack/Defense pick (~0.15-0.3 for a mid-tier unit) instead of
  // the ~1.0+ blowout a near-zero denominator would otherwise produce:
  // 0.10 siege bonus / 0.5 floor = 0.2, 0.01 FS bonus / 0.05 floor = 0.2,
  // 0.03 DS bonus / 0.15 floor = 0.2 -- all three landing in that same
  // competitive-but-not-automatically-dominant range. 0.5 sits at the low
  // end of the roster's real siegePct values (Ogre); 0.05 sits just above
  // the lowest real firstStrikePct values (Cavalry/Knight/Paladin's
  // 0.03-0.06); 0.15 sits below the doubleStrikePct values units.js hands
  // out as a base (2026-08-03, user-directed addition).
  const COLD_START_FLOOR = { siegePct: 0.5, firstStrikePct: 0.05, doubleStrikePct: 0.15 };

  /**
   * Which of the 5 stat-bonus paths a unit spends a pending level-up on
   * (see combat.js's LEVELING section). Every stat is always a candidate --
   * including Siege/First Strike/Double Strike for a unit with none of that
   * property yet, "purchasing" a new specialty from scratch, not just
   * reinforcing an existing one.
   *
   * Heuristic: proportional growth, not absolute value -- every LEVEL_BONUS_
   * VALUES entry is a small FIXED constant, so scoring by raw value alone
   * would always crown Attack/Defense (1 point each) over Siege/First
   * Strike/Double Strike (0.6-equivalent at militaryValue's own *6/*60
   * weighting) for every single unit, forever. Instead this scores each candidate as
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
      doubleStrikePct: combat.effectiveDoubleStrikePct(unit, civ),
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
  /** Shared tail-end of an XP grant: applies an already-fully-computed
   *  xpAmount (every multiplier already folded in) to `unit`, plus the
   *  "+N XP"/"Level Up!" floating-text feedback. Split out from
   *  grantXPAndAutoLevel so a Shadowsteed's carried rider (see below) can
   *  receive the exact same final amount without re-running the bonus
   *  computation a second time. */
  function applyComputedXP(unit, civ, xpAmount) {
    const combat = window.GameEngine.combat;
    const wasMaxed = (unit.level || 0) >= combat.MAX_UNIT_LEVEL;
    combat.grantXP(unit, xpAmount);
    if (!wasMaxed && xpAmount > 0) {
      window.GameEngine.floatingText.spawnFloatingText(unit, `+${Math.round(xpAmount)} XP`, "xp");
    }
    // Human player's own unit (2026-08-04, user-reported): chooseLevelUpStat
    // is an AI heuristic, and it was being applied to the human player's
    // units too with no say in the matter. Leave the level-up PENDING
    // (combat.pendingLevelUps(unit) stays > 0, same XP-vs-threshold math
    // either way) instead of auto-resolving it -- sidebar.js's
    // levelUpActions prompts the player to spend it themselves next time
    // they select the unit, via main.js's handleChooseLevelUp.
    if (civ.isHuman) return;
    let pending = combat.pendingLevelUps(unit);
    while (pending > 0) {
      combat.applyLevelUp(unit, chooseLevelUpStat(unit, civ));
      window.GameEngine.floatingText.spawnFloatingText(unit, "Level Up!", "levelup");
      pending--;
    }
  }

  function grantXPAndAutoLevel(unit, civ, xpAmount) {
    const combat = window.GameEngine.combat;
    // Elf "Altar of Ages": +25% XP for a unit whose home city has the
    // building -- see combat.js's hasAltarOfAgesBonus.
    if (combat.hasAltarOfAgesBonus(unit, civ)) {
      const bonus = (civ.mechanicValues && civ.mechanicValues.altar_of_ages) || 0.25;
      xpAmount *= (1 + bonus);
    }
    // Halfellow "It's Like the Great Stories": +50% XP, civ-wide -- every
    // unit, not gated to a specific city/building like Altar of Ages above.
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("great_stories")) {
      const bonus = (civ.mechanicValues && civ.mechanicValues.great_stories) || 0.5;
      xpAmount *= (1 + bonus);
    }
    // Dwarf "Runeforged Tools" (2026-07-22, user-directed, replacing its old
    // build_speed_mult effect): +25% XP, civ-wide -- same shape as Great
    // Stories above.
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("runeforged_tools")) {
      const bonus = (civ.mechanicValues && civ.mechanicValues.runeforged_tools) || 0.25;
      xpAmount *= (1 + bonus);
    }
    applyComputedXP(unit, civ, xpAmount);
    // Elf "Shadowsteed" + rider (2026-07-22, user-directed): a carried
    // passenger earns the exact same XP the Shadowsteed itself just did --
    // literally the same already-bonus-adjusted amount (the user's own
    // wording is "the same amount"), not independently recomputed through
    // the bonus pipeline a second time.
    if (unit.typeId === "shadowsteed" && unit.carries) {
      applyComputedXP(unit.carries, civ, xpAmount);
    }
  }

  // Elf "Treetop Snipers": a wall's own attack profile, separate from any
  // real unit's stats. Kept local to this mechanic rather than added to the
  // shared wall_section building data (js/data/buildings.js), since every
  // race's wall uses that same universal definition but only an Elf civ
  // with this tech can ever make one actually fire.
  const TREETOP_SNIPER_RANGE = 2;
  const TREETOP_SNIPER_ATTACK = 1;
  const TREETOP_SNIPER_FIRE_CHANCE = 0.5;
  const TREETOP_SNIPER_ATTACK_CHARS = ["➵", "➳"];

  /** Elf "Treetop Snipers" (2026-07-22, user-directed): each of this civ's
   *  wall segments independently rolls a 50% chance, once per civ-turn, to
   *  take a single potshot at the nearest enemy unit within range 2 -- a
   *  passive structure ability with no unit or turn-order of its own, so
   *  it's ticked here directly from turns.js's beginCivTurn (see the call
   *  site there) rather than through the normal per-unit dispatch cascade.
   *  Damage uses the same mitigatedDamage formula (and the target's full
   *  effective defense, conditions included) every other attack in the game
   *  uses -- only the attacker's own flat "attack 1" is special-cased here,
   *  since a wall has no unit object of its own to read a real attack stat
   *  from. */
  function tickTreetopSnipers(gameState, civ) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("treetop_snipers")) return;
    const { civs } = gameState;
    const log = [];
    for (const city of civ.cities) {
      for (const s of city.structures) {
        if (!window.GameData.getBuilding(s.id).isWall) continue;
        // Halfellow "Unlock the Gate": suppressed the same as every other
        // special wall defense while active.
        if (window.GameEngine.combat.isWallDefenseSuppressed(s, gameState.turnNumber)) continue;
        if (Math.random() >= TREETOP_SNIPER_FIRE_CHANCE) continue;
        let target = null, targetCiv = null, bestDist = Infinity;
        for (const otherCiv of Object.values(civs)) {
          if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
          for (const eu of otherCiv.units) {
            if (eu.conditions?.hidden) continue;
            const dist = window.GameEngine.influence.chebyshev(s.x, s.y, eu.x, eu.y);
            if (dist > TREETOP_SNIPER_RANGE) continue;
            if (dist < bestDist) { bestDist = dist; target = eu; targetCiv = otherCiv; }
          }
        }
        if (!target) continue;
        const dmg = window.GameEngine.combat.mitigatedDamage(
          TREETOP_SNIPER_ATTACK, window.GameEngine.combat.effectiveDefense(target, targetCiv, {}));
        target.hp = Math.max(0, target.hp - dmg);
        window.GameEngine.combat.recordCombatEvent({
          ax: s.x, ay: s.y, atkUnit: { typeId: "wall_section" }, dx: target.x, dy: target.y, defUnit: target,
          attackChars: TREETOP_SNIPER_ATTACK_CHARS,
        });
        log.push(`Treetop Snipers: ${civ.id}'s wall at (${s.x},${s.y}) shoots ${targetCiv.id}'s ${describeUnit(target)} for ${dmg}`);
        if (target.hp <= 0) {
          log.push(`Treetop Snipers: ${targetCiv.id}'s ${describeUnit(target)} is slain by ${civ.id}'s wall at (${s.x},${s.y})`);
          otherCivRemoveDeadUnit(civs, target);
        }
      }
    }
    if (log.length) appendAIActionLog(gameState, civ.id, log);
  }

  // Death sfx (2026-07-30, user-directed fix: no death clip was ever
  // triggered anywhere in the codebase, despite "death" being a real
  // sfxActionsForUnit entry with clips on disk). Lands a beat after the
  // killing blow's own "attack" clip (see SfxSystem.playAction's delayMs)
  // instead of overlapping it.
  const DEATH_SFX_DELAY_MS = 350;

  // Double Strike's follow-up "attack" clip -- same reasoning as the death
  // delay above: it should land as a distinct second blow rather than
  // overlapping the first hit's own clip. Shorter, since the two hits are
  // meant to read as one fast flurry. See the resolveRound call site.
  const DOUBLE_STRIKE_SFX_DELAY_MS = 220;

  /** Single chokepoint every combat-kill path in this file funnels a dead
   *  unit's removal through (city/structure counterattacks are the two
   *  exceptions that used to filter civ.units directly -- both now route
   *  through here too, see the "Rouse the People"/structure-counter blocks
   *  below), so it's also the one place that needs to know how to play a
   *  death sound. */
  function otherCivRemoveDeadUnit(civs, deadUnit) {
    const civ = civs[deadUnit.civId];
    if (civ) {
      window.SfxSystem.playAction(civ.raceId, deadUnit.typeId, "death", deadUnit.x, deadUnit.y, DEATH_SFX_DELAY_MS);
      civ.units = civ.units.filter((u) => u !== deadUnit);
    }
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
      log.push(`Carry: ${cargo.civId}'s ${describeUnit(cargo)} had nowhere to land and was lost along with its carrier`);
      otherCivRemoveDeadUnit(gameState.civs, cargo);
    } else {
      cargo.x = x;
      cargo.y = y;
      snapVisualPos(cargo, x, y);
    }
  }

  const CURSE_DURATION = 3;

  // Violent Momentum: +2 movement, +10% First Strike, +10% Double Strike
  // (2026-08-03, user-directed: added the latter two) for a unit that
  // killed an enemy the PREVIOUS turn. tickConditions runs at the START of
  // runAITurn, so a condition set during turn T (after that turn's own tick
  // already ran) survives untouched through turn T+1's movement/combat and
  // only expires at the T+2 tick, giving exactly one full subsequent turn of
  // the bonus, matching "the previous turn".
  const VIOLENT_MOMENTUM_MOVE_BONUS = 2;
  const VIOLENT_MOMENTUM_FIRST_STRIKE_BONUS = 0.10;
  const VIOLENT_MOMENTUM_DOUBLE_STRIKE_BONUS = 0.10;
  const VIOLENT_MOMENTUM_DURATION = 2;

  /**
   * Orc-specific post-combat effects layered on top of the core damage/counter
   * exchange in resolveRound: Bog Witch's curse-on-death (whoever lands the
   * kill on her is cursed), Malefic Malediction (any hit she lands curses the
   * target, kill or not -- requires the tech), and Violent Momentum (the
   * attacker gets a temporary movement/First Strike/Double Strike buff if
   * this hit killed the defender -- requires the tech). All CONDITIONS (see
   * combat.js) -- read via unit.conditions.curse/killMomentum by
   * combat.js's effectiveAttack/effectiveFirstStrikePct/
   * effectiveDoubleStrikePct and ai.js's moveUnitToward; expiry is cleared
   * once per civ-turn in runAITurn via tickConditions.
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
    // Violent Momentum: the attacker gets +2 movement, +10% First Strike and
    // +10% Double Strike next turn if this hit actually killed the defender.
    if (attackerCiv.unlockedMechanics && attackerCiv.unlockedMechanics.has("violent_momentum")
        && defenderUnit.hp <= 0 && !result.fullNegated) {
      setCondition(attackerUnit, "killMomentum", {
        moveBonus: VIOLENT_MOMENTUM_MOVE_BONUS,
        firstStrikePctBonus: VIOLENT_MOMENTUM_FIRST_STRIKE_BONUS,
        doubleStrikePctBonus: VIOLENT_MOMENTUM_DOUBLE_STRIKE_BONUS,
        expiresAtTurn: turn + VIOLENT_MOMENTUM_DURATION,
      });
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

  // Siege engines have no body worth reanimating, and Shadowsteed/Runeforged
  // Titan are both too mechanically/thematically broken to hand over intact
  // (2026-07-22, user-directed exclusion list).
  const ZOMBIE_EXEMPT_TYPES = new Set(["catapult", "trebuchet", "battering_ram", "shadowsteed", "runeforged_titan"]);

  /** Undead "Raise Dead" (2026-07-22 rework): instead of removing the fallen
   *  unit and spawning a brand-new one, the SAME unit object is dragged back
   *  up, transferred wholesale from defeatedCiv's roster to victorCiv's, and
   *  left permanently weakened via a persistent "zombie" condition (see
   *  combat.js's effectiveAttack/effectiveDefense/effectiveFirstStrikePct/
   *  grantXP for the -50% stats / 0% First Strike / no-more-XP effects).
   *  Level and XP are reset to a fresh recruit's baseline since the debuffed
   *  unit no longer earns any more anyway. Returns true if the zombie was
   *  successfully applied -- the caller must then skip its own "this unit
   *  really died" bookkeeping (cargo drop, Hound and Hunter/Undaunted
   *  replacement, roster removal) since the unit is still standing on its
   *  own tile, just under new management. */
  function maybeApplyZombie(victorCiv, victorUnit, defeatedUnit, civs) {
    const race = window.GameData.getRace(victorCiv.raceId);
    if (!race.raiseDeadChance) return false;
    if (ZOMBIE_EXEMPT_TYPES.has(defeatedUnit.typeId)) return false;
    if (window.GameEngine.combat.hasCondition(defeatedUnit, "zombie")) return false; // no re-raising chains
    if (Math.random() > race.raiseDeadChance) return false;
    // Orc "Honor the Dead": the defeated unit's own civ may resist being raised
    // (flavor: their ancestral rites hold the body) -- any existing ability
    // that raises dead instead resists application of this condition, per
    // user's own framing. Independent roll on top of the victor's raise
    // chance -- e.g. 50% resistance halves the effective rate.
    const defeatedCiv = civs[defeatedUnit.civId];
    if (defeatedCiv && defeatedCiv.raiseDeadResistance && Math.random() < defeatedCiv.raiseDeadResistance) return false;

    // Necropolis (undead wonder) raises stronger dead -- same bonus as the
    // old mechanic, now applied as the zombie condition's stat multiplier.
    let statMult = race.raiseDeadPowerRatio;
    if (victorCiv.cities.some((c) => window.GameEngine.cities.cityHasStructure(c, "necropolis"))) {
      statMult += window.GameData.getBuilding("necropolis").raiseDeadPowerBonus || 0;
    }

    if (defeatedCiv) defeatedCiv.units = defeatedCiv.units.filter((u) => u !== defeatedUnit);
    defeatedUnit.civId = victorCiv.id;
    defeatedUnit.isCivilian = false;
    window.GameEngine.combat.setCondition(defeatedUnit, "zombie", { statMult });
    defeatedUnit.level = 1;
    defeatedUnit.xp = 0;
    defeatedUnit.levelBonuses = {};
    // HP: a fresh corpse rises at full (reduced) health -- unitMaxHP takes
    // the same reduced attack/defense the condition applies in combat, so a
    // weaker body has less HP too, not just less bite.
    const baseUnit = window.GameData.getUnit(defeatedUnit.typeId);
    const zAttack = Math.max(1, Math.round(baseUnit.attack * statMult));
    const zDefense = Math.max(0, Math.round((baseUnit.defense || 0) * statMult));
    defeatedUnit.maxHp = window.GameData.unitMaxHP(zAttack, zDefense, defeatedUnit.typeId);
    defeatedUnit.hp = defeatedUnit.maxHp;
    victorCiv.units.push(defeatedUnit);
    return true;
  }

  window.GameEngine.ai = {
    runAITurn,
    beginAITurn,
    stepAIUnit,
    finishAITurn,
    runUnitTurn,
    findAdjacentWater,
    findNearestCoastalWaterFor,
    findClosestOpenPlacementTile,
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
    maybeWaitForCompanionCarry,
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
    findOverseasInvasionTeleportTarget,
    maybeRootsInvasionFerry,
    findInvasionStagingTile,
    maybeInvasionAmbushWait,
    appendAIActionLog,
    tickTreetopSnipers,
    operateGalley,
    exploreWater,
    exploreWith,
    findFarUnseenTile,
    findNearestUnseenTile,
    civNeedsTitanScouting,
    recentCityDelta,
    // Player-order primitives (2026-08-01). Previously private to this file
    // because only the AI ever issued orders; the human UI now issues the
    // same orders through the same functions, so a player move obeys exactly
    // the rules an AI move does.
    spendMovement,
    computeMovementBudget,
    computeReachableTiles,
    buildMoveRules,
    buildOccupancySet,
    progressBuildQueues,
    canAttackUnitNow,
    considerAttackOrGarrison,
    availableBuilds,
  };
})();
