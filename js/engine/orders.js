/**
 * PLAYER ORDERS
 * -------------
 * The human player's verbs: move a unit, attack something with it, and ask
 * what either of those would do before committing.
 *
 * Everything here is a thin adapter over the engine functions the AI already
 * uses -- ai.js's spendMovement, computeReachableTiles and
 * considerAttackOrGarrison. Deliberately so: an attack in this game drags a
 * long tail of race-specific follow-through behind it (Burning, Fireball
 * splash, Orc curses, Elf Freeze, zombie raising, Hound-and-Hunter/Undaunted
 * replacement spawns, cargo drops, plunder, XP and leveling, quips, sfx,
 * combat events). Reimplementing even a little of that for the player would
 * mean two divergent combat systems in one game. Instead a player order goes
 * into the AI's own attack path with the target pre-chosen (opts.forcedTarget
 * -- see considerAttackOrGarrison), so the player and the AI are running
 * identical code with a different decision-maker in front of it.
 *
 * ACTION ECONOMY (see ai.js's "Turn-action-economy foundation" comment):
 * a unit's turn is movement points (unit.movesRemaining) PLUS one action
 * (unit.usedThisTurn). Moving spends only movement; attacking, Rest, Defend,
 * Build Road, founding, and starting a channel consume the action. This
 * module enforces that split for the player -- the AI enforces it for itself.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  /** Is this a unit the player is allowed to give orders to at all? */
  function canCommand(unit, gameState, humanCivId) {
    if (!unit || !humanCivId) return false;
    if (unit.civId !== humanCivId) return false;
    if (unit.hp <= 0) return false;
    if (unit.carriedBy) return false;      // passengers can only disembark
    if (unit.conditions?.frozen) return false;
    return true;
  }

  /** True once a unit has nothing useful left to do this turn -- drives both
   *  the map's spent-unit dimming and the "next unit needing orders" cycler. */
  function isSpent(unit, gameState) {
    if (unit.usedThisTurn) return true;
    if (unit.channeling) return true;
    const budget = unit.movesRemaining != null
      ? unit.movesRemaining
      : window.GameEngine.ai.computeMovementBudget(unit, gameState.map, gameState.civs);
    return !(budget > 0);
  }

  /** Units awaiting orders, in roster order, so the cycler is stable. */
  function unitsNeedingOrders(gameState, humanCivId) {
    const civ = gameState.civs[humanCivId];
    if (!civ) return [];
    return civ.units.filter((u) => canCommand(u, gameState, humanCivId) && !isSpent(u, gameState));
  }

  /**
   * Where `unit` can legally finish a move this turn: Map "x,y" -> {x,y,cost}.
   * Straight passthrough to the engine so the overlay can't drift from the
   * rules the move itself obeys.
   *
   * Memoized, because render.js draws the reachable overlay from inside the
   * per-frame animation loop -- running a fresh Dijkstra flood fill 60 times a
   * second would be pure waste. The key covers everything that can change the
   * answer: which unit, where it is, how much movement it has left, and the
   * turn number (which catches board changes like a blocking unit moving away,
   * since occupancy is baked into the flood fill).
   */
  let reachCache = { key: null, value: null };
  function reachableTiles(unit, gameState) {
    const key = `${unit.civId}:${unit.x},${unit.y}:${unit.movesRemaining}:${gameState.turnNumber}:${unit.typeId}:${gameState.civs[unit.civId]?.units.length}`;
    if (reachCache.key === key && reachCache.unit === unit) return reachCache.value;
    const value = window.GameEngine.ai.computeReachableTiles(unit, gameState);
    reachCache = { key, unit, value };
    return value;
  }

  /** Drops the memo above. Call after anything that moves or removes units
   *  outside a normal order (combat resolution, disband, end of turn). */
  function invalidateReachCache() {
    reachCache = { key: null, value: null };
  }

  /**
   * What sits on (x,y) that `unit` could attack, if anything: the first enemy
   * unit there, else an ungarrisoned enemy city, else an enemy structure.
   * Mirrors considerAttackOrGarrison's own precedence -- a defender always
   * intercepts before the city or wall behind it can be hit.
   */
  function attackTargetAt(unit, gameState, x, y, humanCivId) {
    const { civs } = gameState;
    for (const civ of Object.values(civs)) {
      if (civ.id === humanCivId || civ.eliminated) continue;
      const enemy = civ.units.find((u) => u.x === x && u.y === y && !u.carriedBy);
      if (enemy) return { kind: "unit", unit: enemy, civ };
    }
    // A garrison on the tile intercepts, so city/structure are only targetable
    // once nothing is standing there -- the loop above already returned if so.
    for (const civ of Object.values(civs)) {
      if (civ.id === humanCivId || civ.eliminated) continue;
      const city = civ.cities.find((c) => c.x === x && c.y === y);
      if (city) return { kind: "city", city, civ };
    }
    const s = window.GameEngine.cities.findStructureAt(gameState, x, y);
    if (s && s.civ.id !== humanCivId) return { kind: "structure", structure: s, civ: s.civ };
    return null;
  }

  /**
   * Non-mutating "what would happen": whether the order is legal, and the odds
   * if it's an attack. Drives the hover cursor and the confirm text, so the
   * player never has to commit blind.
   */
  function previewOrder(unit, gameState, x, y, humanCivId) {
    if (!canCommand(unit, gameState, humanCivId)) return { kind: "none" };
    const civ = gameState.civs[unit.civId];
    const target = attackTargetAt(unit, gameState, x, y, humanCivId);

    if (target) {
      if (unit.usedThisTurn) return { kind: "blocked", reason: "Already acted this turn" };
      if (target.kind === "unit") {
        if (!window.GameEngine.ai.canAttackUnitNow(civ, unit, target.unit, gameState)) {
          return { kind: "blocked", reason: "Out of range" };
        }
        const odds = window.GameEngine.ai.estimateWinProbability(unit, target.unit, gameState.civs, {}, 20);
        return { kind: "attack", target, odds };
      }
      // City/structure: range and line-of-sight are checked inside
      // considerAttackOrGarrison itself, so this only reports the odds it can
      // cheaply compute up front and lets the engine have the final say.
      const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, x, y);
      const range = window.GameEngine.combat.effectiveRange(unit, civ);
      if (dist > range) return { kind: "blocked", reason: "Out of range" };
      const odds = target.kind === "city"
        ? window.GameEngine.combat.cityAttackWinProbability(unit, target.city, civ)
        : null;
      return { kind: "attack", target, odds };
    }

    const reach = reachableTiles(unit, gameState);
    const hit = reach.get(`${x},${y}`);
    if (hit) return { kind: "move", cost: hit.cost, remaining: unit.movesRemaining };
    return { kind: "blocked", reason: "Can't reach this turn" };
  }

  /** Issues a move. Returns true if the unit actually went somewhere. */
  function moveTo(unit, gameState, x, y, humanCivId) {
    if (!canCommand(unit, gameState, humanCivId)) return false;
    const fromX = unit.x, fromY = unit.y;
    window.GameEngine.ai.spendMovement(unit, x, y, gameState.map, gameState.civs);
    const moved = unit.x !== fromX || unit.y !== fromY;
    if (moved) {
      unit.currentMission = `Moving to (${x},${y})`;
      window.GameEngine.turns.refreshVisibility(gameState);
    }
    return moved;
  }

  /**
   * Issues an attack against whatever the player picked, routed through the
   * AI's considerAttackOrGarrison with the choice pre-made. `weights` is the
   * civ's own racial weighting -- passed so any weight-sensitive scoring
   * inside behaves as it would for this race, even though the forced-target
   * gates make the scores themselves moot.
   */
  function attack(unit, gameState, target, humanCivId) {
    if (!canCommand(unit, gameState, humanCivId)) return false;
    if (unit.usedThisTurn || !target) return false;
    const civ = gameState.civs[unit.civId];
    const weights = window.GameEngine.ai.racialWeights(civ);
    const log = [];
    const opts = target.kind === "unit" ? { forcedTarget: target.unit }
      : target.kind === "city" ? { forcedCity: target.city }
      : { forcedStructure: target.structure.record };

    const didAttack = window.GameEngine.ai.considerAttackOrGarrison(
      civ, unit, gameState, weights, "normal", log, opts);

    if (log.length) window.GameEngine.ai.appendAIActionLog(gameState, civ.id, log);
    if (didAttack) {
      // Combat can kill units on either side, which changes the board's
      // occupancy -- the cached reachable set is no longer trustworthy.
      invalidateReachCache();
      window.GameEngine.turns.refreshVisibility(gameState);
    }
    return didAttack;
  }

  /**
   * Starts a build in `city`. `option` is one entry from
   * ai.js's availableBuilds; `placeAt` ({x,y}) is the tile the player chose
   * for a building, stored on the queue item and honored at completion (see
   * progressBuildQueue / cities.js's placeStructure).
   *
   * Mirrors maybeBuildInCities' two cost models exactly: a power-based build
   * pays its multi-resource cost from the stockpile UP FRONT and then just
   * counts a turn timer down, while a legacy coin-accumulation build
   * accumulates progress against coinCost each turn instead. Units and
   * buildings both split across these two the same way now (2026-08-03):
   * whichever ones have an unlocking tech with a costBreakdown use the
   * modern model (see GameData.unitBuildCost/buildingBuildCost) -- as of
   * 2026-08-05 that's every unit, including Pioneer/Galley/Scout (via
   * shared_infrastructure's own costBreakdown); wall_section is the only
   * thing left on the legacy path (explicitly excluded from
   * buildingBuildCost's tech resolution -- see buildings.js).
   */
  function queueBuild(city, civ, gameState, option, placeAt) {
    if (!option || !city || civ.id !== gameState.civs[civ.id]?.id) return false;
    if (option.affordable === false) return false;

    if (option.cost) {
      civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
      for (const [k, v] of Object.entries(option.cost)) {
        civ.stockpile[k] = Math.max(0, (civ.stockpile[k] || 0) - v);
      }
      city.buildQueue = {
        kind: option.kind, id: option.id,
        turnsRemaining: option.turns, totalTurns: option.turns,
      };
    } else {
      city.buildQueue = {
        kind: option.kind, id: option.id,
        coinCost: option.coinCost, progress: 0,
      };
    }
    if (placeAt && option.kind === "building") city.buildQueue.placeAt = { x: placeAt.x, y: placeAt.y };
    return true;
  }

  /** Abandons the current build. Deliberately does NOT refund an up-front
   *  unit cost -- the resources are spent, same as they are for the AI when a
   *  build is cancelled for lack of a slot. */
  function cancelBuild(city) {
    if (!city || !city.buildQueue) return false;
    city.buildQueue = null;
    return true;
  }

  /** The single entry point the UI calls for a right-click: works out whether
   *  the player meant "move here" or "attack that" and does it. */
  function issueOrderAt(unit, gameState, x, y, humanCivId) {
    const preview = previewOrder(unit, gameState, x, y, humanCivId);
    if (preview.kind === "attack") {
      return { acted: attack(unit, gameState, preview.target, humanCivId), preview };
    }
    if (preview.kind === "move") {
      return { acted: moveTo(unit, gameState, x, y, humanCivId), preview };
    }
    return { acted: false, preview };
  }

  window.GameEngine.orders = {
    canCommand,
    isSpent,
    unitsNeedingOrders,
    reachableTiles,
    invalidateReachCache,
    attackTargetAt,
    previewOrder,
    moveTo,
    attack,
    issueOrderAt,
    queueBuild,
    cancelBuild,
  };
})();
