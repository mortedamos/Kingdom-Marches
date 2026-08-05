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
 *
 * RIGHT-CLICK CONTEXT MENU (2026-08-06, user-directed): js/ui/input.js's
 * contextmenu handler no longer issues a move/attack immediately -- it
 * opens a menu built from contextMenuOptions below, and the player's pick
 * dispatches through main.js's handleContextMenuAction. A destination out
 * of this turn's movement range is no longer just refused -- "Move to This
 * Tile"/"Build Road to This Tile" start a persisted gotoTarget order (see
 * startGotoOrder/advanceGotoOrder) that keeps making progress automatically
 * every turn until it arrives or gets blocked.
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
   *  the map's spent-unit dimming and the "next unit needing orders" cycler.
   *  A unit with a pending gotoTarget order (2026-08-06, user-directed --
   *  see startGotoOrder) counts as spent too: it's already been given
   *  orders and will keep executing them automatically turn after turn, so
   *  it shouldn't keep interrupting Next Unit or the End Turn reminder
   *  until it arrives (gotoTarget clears) or its order gets cancelled
   *  (blocked path, or a new order overriding it). */
  function isSpent(unit, gameState) {
    if (unit.usedThisTurn) return true;
    if (unit.channeling) return true;
    if (unit.gotoTarget) return true;
    // Automate Actions (2026-08-06, user-directed): an automated unit is
    // "already ordered" by definition -- same exclusion goto orders already
    // get from the Next Unit/End Turn nagging cycle (a pendingIntent still
    // gets its own blocking confirmation modal, just not this nag).
    if (unit.automated) return true;
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
   * MULTI-TURN GOTO ORDERS (2026-08-06, user-directed)
   * ---------------------------------------------------
   * A unit that can't reach its destination in one turn used to just be
   * refused ("Can't reach this turn" -- see previewOrder's `move` branch,
   * fed by reachableTiles' single-turn budget). unit.gotoTarget = { x, y,
   * buildRoad } is a persisted order that survives across turns: set once
   * (startGotoOrder), then re-advanced by exactly one turn's worth of
   * progress each time advanceGotoOrder is called -- once immediately when
   * the order is issued (so a same-turn-reachable destination completes
   * instantly, identical to the old one-shot move), and once automatically
   * per turn after that for every human unit with a pending order (see
   * turns.js's beginCivTurn, which calls this in the human civ's branch
   * before the player gets to act that turn -- same "already decided,
   * player can still override with a fresh order" spirit AI units get from
   * their own per-turn re-decision).
   *
   * Two shapes:
   *   - Plain move (buildRoad: false): identical to moveTo/spendMovement --
   *     walks as far as the unit's movement budget allows this turn.
   *   - "Build road to this tile" (buildRoad: true): walks the path ONE
   *     step at a time, but the INSTANT it would enter a tile with no road
   *     already on it, stops there and builds the road (an instant action,
   *     same as the standalone "Build Road Here" button) -- ending this
   *     turn's progress even if movement remains. Guarantees a fully
   *     connected road with no gaps: already-roaded ground along the way
   *     is crossed at full speed with no stopping, but only one NEW
   *     segment can go down per turn (building is always a whole action,
   *     regardless of the unit's raw movement stat).
   *
   * Blocked-path handling (2026-08-06, user-directed: "stop and wait for
   * new orders", not auto-reroute/auto-fight like an AI unit): if a call
   * makes literally NO progress at all (didn't move, didn't build), the
   * order is cancelled outright rather than left to spin forever making
   * zero progress every future turn too.
   */
  function startGotoOrder(unit, gameState, x, y, buildRoad) {
    unit.gotoTarget = { x, y, buildRoad: !!buildRoad };
    advanceGotoOrder(unit, gameState);
  }

  function stopGotoOrder(unit) {
    unit.gotoTarget = null;
  }

  function advanceGotoOrder(unit, gameState) {
    const target = unit.gotoTarget;
    if (!target) return;
    if (unit.x === target.x && unit.y === target.y) { unit.gotoTarget = null; return; }

    const { map, civs } = gameState;
    let progressed = false;

    if (target.buildRoad) {
      if (unit.movesRemaining == null) {
        unit.movesRemaining = window.GameEngine.ai.computeMovementBudget(unit, map, civs);
      }
      const rules = window.GameEngine.ai.buildMoveRules(unit, civs, map);
      const path = window.GameEngine.pathfinding.findPath(unit.x, unit.y, target.x, target.y, map, rules.costFn);
      if (path) {
        for (const step of path) {
          if (unit.movesRemaining <= 0) break;
          unit.x = step.x;
          unit.y = step.y;
          unit.movesRemaining -= step.cost;
          progressed = true;
          const tile = map.tiles[unit.y * map.width + unit.x];
          if (!tile.hasRoad) {
            if (!unit.usedThisTurn) { tile.hasRoad = true; unit.usedThisTurn = true; }
            break; // one new road segment per turn -- stop here regardless of leftover movement
          }
        }
        if (progressed) window.GameEngine.turns.refreshVisibility(gameState);
      }
    } else {
      // moveTo does its own canCommand check -- passing the unit's own
      // civId as `humanCivId` there is safe (not a security hole): a
      // gotoTarget is only ever SET through human-triggered UI code in the
      // first place, so this is just reusing moveTo's existing signature,
      // not bypassing a real permission check.
      progressed = moveTo(unit, gameState, target.x, target.y, unit.civId);
    }

    if (unit.x === target.x && unit.y === target.y) {
      unit.gotoTarget = null;
      return;
    }
    if (!progressed) {
      unit.gotoTarget = null;
      unit.currentMission = "Order cancelled — path blocked";
      return;
    }
    unit.currentMission = target.buildRoad
      ? `Building a road to (${target.x},${target.y})`
      : `Moving to (${target.x},${target.y})`;
  }

  /**
   * CONTEXT MENU (2026-08-06, user-directed)
   * -----------------------------------------
   * Every action available for `unit` if the player right-clicks tile
   * (x,y) -- replaces the old immediate-move/attack right-click (see
   * js/ui/input.js) with a menu the player picks from every time, no
   * exceptions for "simple" in-range moves. Two shapes:
   *   - Own tile: the FULL action list (2026-08-06, user-directed --
   *     previously a curated subset), i.e. every button
   *     sidebar.js's renderUnitPanel would show for this exact unit right
   *     now: Found City, Build Road, every channel start/claim/cancel
   *     variant, Go Hidden/Cancel Hidden, Stop (a pending goto order),
   *     Rest, Defend, Disband. The CONDITIONS below are transcribed
   *     directly from sidebar.js's pioneerActions/channelActions/
   *     stealthActions blocks -- kept as a second copy rather than a
   *     shared extraction (sidebar.js also interleaves non-actionable
   *     status lines -- "Cannot found here: X", turnsIn counters -- that
   *     have no equivalent here, so a full merge would be a much larger,
   *     riskier rendering refactor for comparatively little gain). If you
   *     change one of these gates, change the other.
   *   - Any other tile: "Attack" if something targetable sits there and is
   *     in range, else "Move to This Tile" (always) and "Build Road to
   *     This Tile" (if the unit canBuildRoad and the destination doesn't
   *     already have one) -- both start a gotoTarget order via
   *     startGotoOrder rather than a same-turn-only move.
   * Each option is {kind, label, danger?} -- `kind` is a stable string
   * main.js's handleContextMenuAction dispatches on; `danger` just carries
   * the same red-styling hint sidebar.js's action-btn-danger class gives
   * Cancel/Disband. Pure/non-mutating, re-derived fresh every time the menu
   * needs to render or a click needs resolving (same "recompute, don't
   * cache a closure" convention availableBuilds/handleChooseBuild already
   * use).
   */
  function contextMenuOptions(unit, gameState, x, y, humanCivId) {
    const options = [];
    if (!canCommand(unit, gameState, humanCivId)) return options;
    const civ = gameState.civs[unit.civId];
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const tile = gameState.map.tiles[y * gameState.map.width + x];
    const onOwnTile = unit.x === x && unit.y === y;

    if (onOwnTile) {
      // Found City / Build Road -- sidebar.js's pioneerActions.
      if ((baseUnit.canFoundCity || baseUnit.canBuildRoad) && !unit.usedThisTurn) {
        if (baseUnit.canFoundCity
            && window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, unit.x, unit.y, civ.raceId).ok) {
          options.push({ kind: "foundCity", label: "Found City" });
        }
        if (baseUnit.canBuildRoad && !tile.hasRoad) {
          options.push({ kind: "buildRoadHere", label: "Build Road Here" });
        }
      }

      // Channeled actions -- sidebar.js's channelActions. Same
      // CHANNEL_LABELS/gating as that block, including the "hunting"/
      // "farming" vs. Dwarf's "prospecting" naming split -- see that
      // file's own doc comment for why they're deliberately distinct
      // unit.channeling values.
      const CHANNEL_LABELS = { prospecting: "Prospecting", delving: "Delving", fishing: "Fishing", hunting: "Hunting", farming: "Farming" };
      if (unit.channeling && CHANNEL_LABELS[unit.channeling]) {
        options.push({ kind: "claimChannel", label: "Claim Gathered Resources" });
        options.push({ kind: "cancelChannel", label: `Cancel ${CHANNEL_LABELS[unit.channeling]}`, danger: true });
      } else if (!unit.usedThisTurn && !unit.channeling) {
        // !unit.channeling excludes "garrison" (2026-08-06) -- see
        // sidebar.js's matching gate for why.
        const onVein = tile.resource === "gold" || tile.resource === "iron";
        const onGame = tile.resource === "game";
        const onFertile = tile.resource === "fertile";
        if (civ.raceId === "dwarf" && civ.unlockedMechanics && civ.unlockedMechanics.has("prospectors_claim") && onVein) {
          options.push({ kind: "startChannel:prospecting", label: "Start Prospecting" });
        } else if (unit.typeId === "wizard" && civ.unlockedMechanics && civ.unlockedMechanics.has("dungeon_delve") && tile.isRuin) {
          options.push({ kind: "startChannel:delving", label: "Start Delving" });
        } else if (unit.typeId === "galley" && !unit.carries && tile.resource === "fish") {
          options.push({ kind: "startChannel:fishing", label: "Start Fishing" });
        } else if (baseUnit.canProspect && onGame && civ.unlockedMechanics && civ.unlockedMechanics.has("hunt_game")) {
          options.push({ kind: "startChannel:hunting", label: "Hunt Game" });
        } else if (baseUnit.canProspect && onFertile && civ.unlockedMechanics && civ.unlockedMechanics.has("farm_soil")) {
          options.push({ kind: "startChannel:farming", label: "Farm Soil" });
        }
      }

      // Hidden/stealth -- sidebar.js's stealthActions.
      if (unit.conditions?.hidden) {
        options.push({ kind: "cancelHidden", label: "Cancel Hidden" });
      } else if (!unit.usedThisTurn && window.GameEngine.combat.canGoHidden(unit, civ, gameState.civs)) {
        options.push({ kind: "goHidden", label: "Go Hidden" });
      }

      // Goto order (2026-08-06) -- not in sidebar.js's original 3 blocks,
      // added alongside gotoTarget itself; see sidebar.js's own
      // stopOrderBtn for the equivalent sidebar button.
      if (unit.gotoTarget) options.push({ kind: "stopOrder", label: "Stop Order", danger: true });

      if (!unit.usedThisTurn) {
        options.push({ kind: "rest", label: "Rest" });
        options.push({ kind: "defend", label: "Defend" });
      }
      // Garrison -- sidebar.js's garrisonBtn/cancel-garrison-btn.
      if (unit.channeling === "garrison") {
        options.push({ kind: "cancelGarrison", label: "Cancel Garrison", danger: true });
      } else if (!unit.usedThisTurn && !unit.channeling && civ.cities.some((c) => c.x === unit.x && c.y === unit.y)) {
        options.push({ kind: "garrison", label: "Garrison" });
      }
      options.push({ kind: "disband", label: "Disband Unit", danger: true });
      return options;
    }

    const target = attackTargetAt(unit, gameState, x, y, humanCivId);
    if (target) {
      const preview = previewOrder(unit, gameState, x, y, humanCivId);
      if (preview.kind === "attack") options.push({ kind: "attack", label: "Attack" });
      return options;
    }

    options.push({ kind: "moveTo", label: "Move to This Tile" });
    if (baseUnit.canBuildRoad && !tile.hasRoad) {
      options.push({ kind: "buildRoadTo", label: "Build Road to This Tile" });
    }
    return options;
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
   * 2026-08-06 that's EVERY unit and building, including Pioneer/Galley/
   * Scout (each via its own Level 0 tech) and wall_section (via
   * pioneer_infrastructure's costBreakdown) -- nothing is left on the
   * legacy path any more, though the branch itself stays as a defensive
   * fallback (see buildings.js's _TECH_FOR_BUILDING doc comment).
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
    startGotoOrder,
    advanceGotoOrder,
    stopGotoOrder,
    contextMenuOptions,
    queueBuild,
    cancelBuild,
  };
})();
