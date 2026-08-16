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
 * RIGHT-CLICK RADIAL MENU (2026-08-06, user-directed): js/ui/input.js's
 * contextmenu handler no longer issues a move/attack immediately -- it opens
 * a ring of actions around the clicked tile, built from mapMenuOptions below
 * (which routes to contextMenuOptions for a unit or cityRingOptions for a
 * city), and the player's pick dispatches through main.js's
 * handleContextMenuAction. A destination out of this turn's movement range is
 * no longer just refused -- "Move to This Tile"/"Build Road to This Tile"
 * start a persisted gotoTarget order (see startGotoOrder/advanceGotoOrder)
 * that keeps making progress automatically every turn until it arrives or
 * gets blocked. This module is now the ONLY place that decides what a unit or
 * city can be told to do; the sidebar renders information only.
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
    // Sentry / Follow (2026-08-12, user-directed): same standing-order
    // exclusion as gotoTarget above -- both keep acting automatically every
    // turn (see turns.js's finishCivTurn -> advanceSentryOrder/
    // advanceFollowOrder) until they resolve on their own or the player
    // cancels them, so neither should keep nagging Next Unit/End Turn.
    if (unit.sentry) return true;
    if (unit.followTarget) return true;
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
   *   - "Build road to this tile" (buildRoad: true): checks the unit's OWN
   *     tile first (2026-08-07, user-reported fix -- see advanceGotoOrder),
   *     then walks the path ONE step at a time, but the INSTANT it would
   *     enter a tile with no road already on it, stops there and builds the
   *     road (an instant action, same as the standalone "Build Road Here"
   *     button) -- ending this turn's progress even if movement remains.
   *     Guarantees a fully connected road with no gaps, including at the
   *     starting tile: already-roaded ground along the way is crossed at
   *     full speed with no stopping, but only one NEW segment can go down
   *     per turn (building is always a whole action, regardless of the
   *     unit's raw movement stat).
   *
   * Blocked-path handling (2026-08-06, user-directed: "stop and wait for
   * new orders", not auto-reroute/auto-fight like an AI unit): if a call
   * makes literally NO progress at all (didn't move, didn't build), the
   * order is cancelled outright rather than left to spin forever making
   * zero progress every future turn too.
   */
  function startGotoOrder(unit, gameState, x, y, buildRoad, opts = {}) {
    unit.gotoTarget = { x, y, buildRoad: !!buildRoad, foundCity: !!opts.foundCity };
    advanceGotoOrder(unit, gameState);
  }

  function stopGotoOrder(unit) {
    unit.gotoTarget = null;
  }

  /** Rest and Defend (2026-08-07, user-directed): heals via unit.resting AND
   *  doubles defense until the start of this unit's next turn via the
   *  "defending" condition -- see combat.js's setCondition. Pulled out of
   *  main.js's handleRestAndDefend into a plain engine function so it can
   *  be re-invoked automatically by turns.js's per-turn "Shift-held: repeat
   *  for the next 3 turns" auto-repeat (see finishCivTurn), not just from a
   *  direct player click. Returns false (no-op) if the unit already acted
   *  this turn -- same guard the ring pill's own visibility uses. */
  function performRestAndDefend(unit, gameState) {
    if (!unit || unit.usedThisTurn) return false;
    unit.automated = false;
    unit.pendingIntent = null;
    unit.gotoTarget = null;
    if (unit.channeling === "garrison") unit.channeling = null;
    unit.resting = true;
    window.GameEngine.combat.setCondition(unit, "defending", { expiresAtTurn: (gameState.turnNumber || 0) + 1 });
    unit.usedThisTurn = true;
    return true;
  }

  function advanceGotoOrder(unit, gameState) {
    const target = unit.gotoTarget;
    if (!target) return;
    if (unit.x === target.x && unit.y === target.y) {
      if (target.foundCity) unit._foundCityPending = true;
      unit.gotoTarget = null;
      return;
    }

    const { map, civs } = gameState;
    let progressed = false;

    if (target.buildRoad) {
      // The STARTING tile first (2026-08-07, user-reported bug fix).
      // pathfinding.js's findPath returns steps "from (but not including)
      // the start tile" -- exactly right for movement, but it meant this
      // order's own road-laying loop below (which walks `path`) never once
      // looked at the tile the unit was ALREADY standing on. A unit ordered
      // to build a road to some remote tile would happily road every tile
      // it stepped onto along the way while leaving its own starting tile
      // bare, so the finished road had a one-tile gap at the beginning --
      // the exact opposite of "gapless" this mechanic's own doc comment
      // above promises. Checked and handled before any movement happens
      // this call, same "one new segment per turn, stop here regardless of
      // leftover movement" rule the loop below applies to every other tile.
      const startTile = map.tiles[unit.y * map.width + unit.x];
      if (!unit.usedThisTurn && !startTile.hasRoad) {
        startTile.hasRoad = true;
        unit.usedThisTurn = true;
        progressed = true;
        window.GameEngine.turns.refreshVisibility(gameState);
        // Movement loop skipped entirely this call -- building is a whole
        // action, same as every other tile below, and falls through to the
        // shared currentMission/return tail at the bottom of this function.
      } else {
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
      if (target.foundCity) unit._foundCityPending = true;
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
   * SENTRY (2026-08-12, user-directed)
   * -----------------------------------
   * A standing order: do nothing until an enemy unit comes within this
   * unit's own attack range, then attack the closest one -- no player input
   * either turn. Called once per turn for every sentried unit (see turns.js's
   * finishCivTurn, same hook point as advanceGotoOrder above), so the check
   * re-runs fresh every turn for as long as the order stays active (cleared
   * only by main.js's Cancel Sentry, or implicitly by any other order
   * superseding it). Routes the actual attack through the same `attack()`
   * this module already exposes to the player, so the target still gets
   * the full canAttackUnitNow validation (line of sight, real range with
   * every bonus applied) rather than trusting the raw Chebyshev scan below.
   */
  function advanceSentryOrder(unit, gameState) {
    if (!unit.sentry || unit.usedThisTurn) return;
    const civ = gameState.civs[unit.civId];
    if (!civ) return;
    const range = window.GameEngine.combat.effectiveRange(unit, civ);
    let best = null, bestDist = Infinity;
    for (const otherCiv of Object.values(gameState.civs)) {
      if (otherCiv.id === unit.civId || otherCiv.eliminated) continue;
      for (const enemy of otherCiv.units) {
        if (enemy.carriedBy || enemy.hp <= 0) continue;
        const dist = window.GameEngine.influence.chebyshev(unit.x, unit.y, enemy.x, enemy.y);
        if (dist > range || dist >= bestDist) continue;
        if (!window.GameEngine.ai.canAttackUnitNow(civ, unit, enemy, gameState)) continue;
        best = { kind: "unit", unit: enemy, civ: otherCiv };
        bestDist = dist;
      }
    }
    if (best) {
      attack(unit, gameState, best, unit.civId);
    } else {
      unit.currentMission = "On Sentry";
    }
  }

  /**
   * FOLLOW (2026-08-12, user-directed)
   * ------------------------------------
   * A standing order: every turn, walk toward unit.followTarget (another
   * allied unit, set via main.js's tile-placement flow) far enough to end
   * this turn adjacent to it, if not already. Re-targets the follower's
   * CURRENT position fresh every call (unlike gotoTarget's fixed
   * destination) since the whole point is tracking a unit that keeps
   * moving too. Cleared automatically once the target is gone (dead,
   * disbanded) -- there's nothing left to follow.
   */
  function advanceFollowOrder(unit, gameState) {
    const target = unit.followTarget;
    if (!target || unit.usedThisTurn) return;
    const civ = gameState.civs[unit.civId];
    if (!civ || target.hp <= 0 || target.carriedBy || !civ.units.includes(target)) {
      unit.followTarget = null;
      return;
    }
    const label = target.name || window.GameData.getUnit(target.typeId).label;
    if (window.GameEngine.influence.chebyshev(unit.x, unit.y, target.x, target.y) <= 1) {
      unit.currentMission = `Following ${label}`;
      return;
    }
    // spendMovement (not the exported ai.js's own moveUnitToward, which
    // ISN'T exported -- this is the exact same one-line body it wraps)
    // paths toward the target's tile and stops as close as this turn's
    // budget allows; since the target's own tile is occupied it can never
    // actually be landed on, so this naturally settles adjacent once in
    // range rather than needing a separate "stop short" check here.
    window.GameEngine.ai.spendMovement(unit, target.x, target.y, gameState.map, gameState.civs);
    unit.currentMission = `Following ${label}`;
  }

  /**
   * WHERE IS THIS UNIT GOING? (2026-08-06, user-directed)
   * ------------------------------------------------------
   * A unit that keeps moving on its own between clicks -- one mid multi-turn
   * goto order, or one running on Automate Actions -- used to give the player
   * no way to see where it was headed short of reading the sidebar's mission
   * text one unit at a time. This reports the route it will take and the tile
   * it's aiming for, so render.js can draw it on the map (drawPlannedPaths).
   *
   * Two sources, in priority order -- the same order sidebar.js's own
   * Order/Intent rows use, and for the same reason: a player-issued goto
   * order on an automated unit is a deliberate override and executes first
   * (advanceGotoOrder runs regardless of unit.automated).
   *   - unit.gotoTarget: the persisted order itself (kind "goto"/"buildRoad").
   *   - unit.lastMoveTarget (kind "auto"): where the AI logic last sent this
   *     automated unit -- see ai.js's spendMovement. A prediction, not a
   *     promise: an automated unit re-decides every turn (turns.js's
   *     finishCivTurn) and may pick something else entirely, which is exactly
   *     why this is only ever drawn for automated units, where "here's the
   *     current plan" is the honest reading.
   *
   * Returns { path, target, kind } or null (already there, no destination, or
   * nowhere to go). `path` is pathfinding.js's step list -- the FULL route,
   * not this turn's slice of it, since the point is showing the multi-turn
   * journey. Memoized per unit: the renderer asks every frame for every unit,
   * and an A* search per unit per frame would be pure waste. The key covers
   * everything that changes the answer (where the unit is, where it's going,
   * and the turn number, which catches the board moving around it).
   */
  const plannedPathCache = new WeakMap();
  function plannedPath(unit, gameState) {
    if (!unit || unit.hp <= 0 || unit.carriedBy) return null;
    const dest = unit.gotoTarget
      ? { x: unit.gotoTarget.x, y: unit.gotoTarget.y, kind: unit.gotoTarget.buildRoad ? "buildRoad" : "goto" }
      : (unit.automated && unit.lastMoveTarget)
        ? { x: unit.lastMoveTarget.x, y: unit.lastMoveTarget.y, kind: "auto" }
        : null;
    if (!dest) return null;
    if (dest.x === unit.x && dest.y === unit.y) return null;

    const key = `${unit.x},${unit.y}->${dest.x},${dest.y}:${dest.kind}:${gameState.turnNumber}`;
    const cached = plannedPathCache.get(unit);
    if (cached && cached.key === key) return cached.value;

    const rules = window.GameEngine.ai.buildMoveRules(unit, gameState.civs, gameState.map);
    const path = window.GameEngine.pathfinding.findPath(
      unit.x, unit.y, dest.x, dest.y, gameState.map, rules.costFn);
    // findPath falls back to the closest reachable tile when the target
    // itself is unreachable, so `target` stays the ORDER's destination while
    // the drawn route may stop short -- same "walk as close as possible"
    // behaviour the move itself has.
    const value = path && path.length ? { path, target: dest, kind: dest.kind } : null;
    plannedPathCache.set(unit, { key, value });
    return value;
  }

  /**
   * A UNIT'S ACTIONS (2026-08-06, user-directed)
   * ---------------------------------------------
   * Every action available for `unit` if the player right-clicks tile (x,y).
   * Replaced the old immediate-move/attack right-click (see js/ui/input.js)
   * with a menu the player picks from every time, no exceptions for "simple"
   * in-range moves; that menu is now the radial one (js/ui/ringmenu.js).
   * Two shapes:
   *   - Own tile: the unit's FULL action list -- Found City, Build Road,
   *     every channel start/claim/cancel variant, Go Hidden/Cancel Hidden,
   *     Stop (a pending goto order), Rest, Defend, Garrison, Automate, Level
   *     Up, Disband.
   *   - Any other tile: "Attack" if something targetable sits there and is in
   *     range, plus "Move to This Tile" (always) and "Build Road to This
   *     Tile" (if the unit canBuildRoad and the destination doesn't already
   *     have one) -- both start a gotoTarget order via startGotoOrder rather
   *     than a same-turn-only move.
   *
   * THIS IS THE ONLY COPY OF THESE GATES. It used to be the second of two:
   * sidebar.js's renderUnitPanel carried the same conditions for its own
   * button set, and this comment warned to change both together. That button
   * set is gone (2026-08-06 -- the sidebar is information-only now, see its
   * "INFORMATION ONLY" note), so there is no longer another copy to keep in
   * sync. What sidebar.js still derives independently is the NON-actionable
   * half it always interleaved with those buttons -- "Cannot found here:
   * <reason>", a channel's turn counter -- which answers a different
   * question ("why can't I?") than this does ("what can I?").
   *
   * Each option is {kind, label, danger?} -- `kind` is a stable string
   * main.js's handleContextMenuAction dispatches on; `danger` carries the
   * same red-styling hint sidebar.js's action-btn-danger class gives
   * Cancel/Disband. Pure/non-mutating, re-derived fresh every time the menu
   * needs to render or a click needs resolving (same "recompute, don't cache
   * a closure" convention availableBuilds/handleChooseBuild already use).
   */
  /** Whether `carrierUnit` could carry `passengerUnit` right now (2026-08-10,
   *  user-directed: player-facing Carry/Board ring options, mirroring the
   *  AI's own galley-boarding/Shadowsteed-carry rules -- see ai.js's Naval
   *  boarding block and techs.js's elf_shadowsteed doc comment for where
   *  each restriction below comes from). Both directions (carrier's own
   *  ring offering "Carry X", passenger's own ring offering "Board Y") share
   *  this one predicate so they can never disagree with each other. */
  function canCarryPassenger(carrierUnit, passengerUnit, civ) {
    if (carrierUnit === passengerUnit) return false;
    if (!window.GameEngine.combat.getUnitProperty(carrierUnit, civ, "canCarryUnit", false)) return false;
    if (carrierUnit.carries || carrierUnit.carriedBy) return false; // already full, or itself a passenger
    if (passengerUnit.carries || passengerUnit.carriedBy) return false; // already carrying, or already a passenger
    if (passengerUnit.usedThisTurn) return false;
    const passengerBase = window.GameData.getUnit(passengerUnit.typeId);
    if (carrierUnit.typeId === "shadowsteed") {
      // "It cannot carry an Awakened Oak, a Raptor, or a Galley." --
      // techs.js's elf_shadowsteed.
      if (passengerUnit.typeId === "awakened_oak" || passengerUnit.typeId === "raptor" || passengerUnit.typeId === "galley") return false;
    } else if (window.GameData.getUnit(carrierUnit.typeId).isNaval) {
      // A Galley (or any future naval carrier) doesn't ferry another boat,
      // or a flier that doesn't need ferrying -- mirrors ai.js's own
      // militaryAtTile boarding filter (!ud.isNaval).
      if (passengerBase.isNaval || passengerBase.flying) return false;
    }
    return true;
  }

  /** Actually loads `passengerUnit` onto `carrierUnit` -- re-validates via
   *  canCarryPassenger first (the ring that offered this may be stale by the
   *  time the player clicks it: either unit could have moved, died, or
   *  acted since), same "don't trust a menu that might be stale" reasoning
   *  attack/castFlight already follow. Both units spend their turn, mirroring
   *  ai.js's own galley-boarding block (boarder.usedThisTurn/unit.usedThisTurn). */
  function performCarry(carrierUnit, passengerUnit, civ) {
    if (!canCarryPassenger(carrierUnit, passengerUnit, civ)) return false;
    carrierUnit.carries = passengerUnit;
    passengerUnit.carriedBy = carrierUnit;
    passengerUnit.usedThisTurn = true;
    carrierUnit.usedThisTurn = true;
    return true;
  }

  function contextMenuOptions(unit, gameState, x, y, humanCivId) {
    const options = [];
    if (!canCommand(unit, gameState, humanCivId)) return options;

    // Halfellow "Set the Trap" (2026-08-11, user-directed: "trap units have
    // no player defined actions other than to disband"): short-circuits
    // every other branch below -- a trap has nothing to move, attack,
    // channel, garrison, or automate, full stop.
    if (unit.typeId === "trap_frost" || unit.typeId === "trap_fire") {
      return [{ kind: "disband", label: "Disband Unit", danger: true }];
    }

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
        // Help Build (2026-08-12, user-directed): a Pioneer standing on its
        // OWN civ's city can throw its turn into whatever that city is
        // currently building, cutting 1 turn off the countdown -- same
        // buildQueue.turnsRemaining field progressBuildQueue counts down
        // every turn (see ai.js), so this is just an extra manual decrement
        // on top of that automatic one. canBuildRoad rather than typeId ---
        // ==="pioneer" would be the more general gate, but road-building
        // itself is hardcoded to "pioneer" too (see main.js's
        // handleBuildRoad), so this stays consistent with that. Only offered
        // for the power-based cost model (turnsRemaining !== undefined) --
        // the legacy coin-accumulation path this deliberately excludes is
        // already unreachable in practice (see ai.js's progressBuildQueue).
        if (baseUnit.canBuildRoad && !unit.usedThisTurn) {
          const homeCity = civ.cities.find((c) => c.x === unit.x && c.y === unit.y);
          if (homeCity && homeCity.buildQueue && homeCity.buildQueue.turnsRemaining !== undefined) {
            options.push({ kind: "helpBuild", label: "Help Build" });
          }
        }
      }

      // Channeled actions -- sidebar.js's channelActions. Same
      // CHANNEL_LABELS/gating as that block. (Dwarf's old separate
      // "prospecting" channel/mechanic was removed 2026-08-17, user-
      // directed -- Dwarves now use the shared "mining" channel below, via
      // the Dwarven Mining OR-bypass.)
      const CHANNEL_LABELS = { delving: "Delving", fishing: "Fishing", hunting: "Hunting", farming: "Farming", mining: "Mining" };
      if (unit.channeling && CHANNEL_LABELS[unit.channeling]) {
        options.push({ kind: "claimChannel", label: "Claim Gathered Resources" });
        options.push({ kind: "cancelChannel", label: `Cancel ${CHANNEL_LABELS[unit.channeling]}`, danger: true });
      } else if (!unit.usedThisTurn && !unit.channeling) {
        // !unit.channeling excludes "garrison" (2026-08-06) -- see
        // sidebar.js's matching gate for why.
        const onVein = tile.resource === "gold" || tile.resource === "iron";
        const onGame = tile.resource === "game";
        const onFertile = tile.resource === "fertile";
        if (civ.unlockedMechanics && civ.unlockedMechanics.has("dungeon_delve") && tile.isRuin) {
          // Universal since 2026-08-14 (see doc/world_encounters_design.md)
          // -- was unit.typeId === "wizard"-only; any unit can Delve now,
          // granted free to every race via the Level 0 "ruin_delving" tech.
          options.push({ kind: "startChannel:delving", label: "Start Delving" });
        } else if (unit.typeId === "galley" && !unit.carries && tile.resource === "fish"
            && civ.unlockedMechanics && civ.unlockedMechanics.has("fishing")) {
          options.push({ kind: "startChannel:fishing", label: "Start Fishing" });
        } else if (baseUnit.canProspect && onGame && civ.unlockedMechanics && civ.unlockedMechanics.has("hunt_game")) {
          options.push({ kind: "startChannel:hunting", label: "Hunt Game" });
        } else if (baseUnit.canProspect && onFertile && civ.unlockedMechanics && civ.unlockedMechanics.has("farm_soil")) {
          options.push({ kind: "startChannel:farming", label: "Farm Soil" });
        } else if (onVein
            && ((baseUnit.canProspect && civ.unlockedMechanics && civ.unlockedMechanics.has("mining"))
              // Dwarven Mining (2026-08-17, user-directed): lets ANY dwarf
              // unit mine, not just canProspect ones -- see techs.js's
              // dwarf_dwarven_mining, layer 1 civic.
              || (civ.raceId === "dwarf" && civ.unlockedMechanics && civ.unlockedMechanics.has("dwarven_mining")))) {
          // Generic Vein prospecting (2026-08-12, user-directed: "Pioneer
          // should be able to prospect all tile resource types except
          // ruins"), gated behind the Level 0 "Mining" tech (2026-08-17,
          // user-directed -- was previously ungated), same flat-payout
          // shape (turns.js's "mining" channel block). Dwarf's Prospector's
          // Claim/The Deep Mines apply as a yield multiplier on top of this
          // same channel now, rather than their own separate one.
          options.push({ kind: "startChannel:mining", label: "Mine Vein" });
        }
      }

      // Open Treasure Chest (see doc/world_encounters_design.md) -- a
      // universal one-shot action, NOT a channel: any unit standing on a
      // "chest" resource tile can spend its turn to open it. Deliberately
      // sits outside the unit.channeling block above -- opening resolves
      // instantly (ai.js's openTreasureChest), there's nothing to
      // accumulate or cash out.
      if (!unit.usedThisTurn && !unit.channeling && tile.resource === "chest") {
        options.push({ kind: "openChest", label: "Open Chest" });
      }

      // Cast Fly on an ally (2026-08-06, user-directed bug fix; range
      // extended 2026-08-12): one pill per eligible ally within the
      // Wizard's REACH (adjacency plus however far it can still walk this
      // turn -- same "move there and still cast, same turn" formula
      // maybeGrantFlight's AI play already used internally, now offered to
      // the player too), offered from the WIZARD'S OWN tile -- not from
      // right-clicking the ally directly. That would seem like the more
      // natural gesture, but it's unreachable under this game's own
      // interaction rule ("right-click always selects whichever of your own
      // units is standing on the clicked tile" -- see mapMenuOptions' own
      // doc comment): right-clicking an ally who is also a commandable unit
      // of yours always retargets the ring to become THAT unit's own ring,
      // before this function is ever even asked about the combination of
      // "wizard selected, ally clicked". Right-click the caster instead, same
      // as every other own-tile action here.
      //
      // This is the first of several AI-only caster-and-ally/enemy-target
      // actions (ai.js's maybeGrantFlight and its siblings -- Freezing
      // Touch, Teleport Strike, Nature's Grace, ...) promoted to a real
      // player-facing option; see that audit's findings for why the others
      // weren't done at the same time. See ai.js's castFlightOnAlly for the
      // actual cast, which re-validates every one of these conditions
      // itself (and walks the Wizard into adjacency first if the target
      // isn't already there) rather than trusting this list stayed accurate
      // since it was drawn.
      if (unit.typeId === "wizard" && !unit.usedThisTurn && civ.unlockedMechanics?.has("flight_grant")) {
        const reach = 1 + (unit.movesRemaining ?? window.GameEngine.ai.computeMovementBudget(unit, gameState.map, civs));
        for (const ally of civ.units) {
          if (ally === unit || ally.carriedBy) continue;
          if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > reach) continue;
          if (window.GameData.getUnit(ally.typeId).category !== "military") continue;
          if (window.GameEngine.combat.isFlying(ally)) continue;
          const allyLabel = ally.name || window.GameData.getUnit(ally.typeId).label;
          options.push({ kind: `castFlight:${ally.x},${ally.y}`, label: `Cast Fly on ${allyLabel}` });
        }
      }

      // Carry / Board (2026-08-10, user-directed): one pill per eligible
      // adjacent unit, same "offered from the ACTING unit's own tile" shape
      // as "Cast Fly on an ally" above -- Carry from the carrier's ring,
      // Board from the passenger's, both gated by the shared
      // canCarryPassenger predicate so they can never disagree.
      if (!unit.usedThisTurn) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ax = unit.x + dx, ay = unit.y + dy;
            const neighbor = civ.units.find((u) => u.x === ax && u.y === ay && u !== unit && u.civId === unit.civId);
            if (!neighbor) continue;
            if (canCarryPassenger(unit, neighbor, civ)) {
              const label = neighbor.name || window.GameData.getUnit(neighbor.typeId).label;
              options.push({ kind: `carryUnit:${ax},${ay}`, label: `Carry ${label}` });
            } else if (canCarryPassenger(neighbor, unit, civ)) {
              const label = neighbor.name || window.GameData.getUnit(neighbor.typeId).label;
              options.push({ kind: `boardCarrier:${ax},${ay}`, label: `Board ${label}` });
            }
          }
        }
      }

      // Drop Off (2026-08-11, user-directed: "a unit carrying another unit
      // doesn't appear to have a ring menu option to drop off"): promotes
      // the disembark half of ai.js's operateDragonCarry/operateGalley cargo
      // logic -- previously AI-only -- to a real ring action. Gated on
      // hasOpenDisembarkTile so the pill never appears when there's nowhere
      // to actually put the passenger down (e.g. a Galley boxed in by water
      // on every side). Same "!unit.usedThisTurn" gate as Carry/Board above
      // for consistency, even though the drop itself doesn't consume the
      // turn (see performPlayerDisembark's own doc comment).
      if (!unit.usedThisTurn && unit.carries && window.GameEngine.ai.hasOpenDisembarkTile(civ, unit, gameState)) {
        const label = unit.carries.name || window.GameData.getUnit(unit.carries.typeId).label;
        options.push({ kind: "dropOff", label: `Drop Off ${label}` });
      }

      // Troubadour aura activate/deactivate (2026-08-10, user-directed):
      // researching Heavy Metal/Power Metal used to turn the aura on
      // automatically and permanently -- now it's an opt-in/opt-out ring
      // action, same shape as Hidden/Garrison below. See turns.js's own
      // gate (civ.isHuman && !troubadour.auraActive) for where this
      // actually takes effect; AI Troubadours are unaffected.
      if (unit.typeId === "troubadour"
          && civ.unlockedMechanics && (civ.unlockedMechanics.has("heavy_metal") || civ.unlockedMechanics.has("power_metal"))) {
        const hasHeavyMetal = civ.unlockedMechanics.has("heavy_metal");
        const hasPowerMetal = civ.unlockedMechanics.has("power_metal");
        if (unit.auraActive) {
          options.push({ kind: "deactivateAura", label: "Deactivate Aura", danger: true });
        } else if (hasHeavyMetal && hasPowerMetal) {
          options.push({ kind: "activateAura:heavy_metal", label: "Activate Heavy Metal Aura" });
          options.push({ kind: "activateAura:power_metal", label: "Activate Power Metal Aura" });
        } else {
          options.push({ kind: `activateAura:${hasPowerMetal ? "power_metal" : "heavy_metal"}`, label: "Activate Aura" });
        }
      }

      // Elf "Roots of the World" (2026-08-10, user-directed): promotes the
      // AI-only teleport (ai.js's performDruidTeleport/attemptDruidTeleport)
      // to a player-facing ring action, same "AI mechanic promoted to a real
      // option" precedent as "Cast Fly on an ally" above. Two variants --
      // teleport the Druid itself, or an adjacent ally -- both hand off to
      // main.js's tile-placement mode (viewState.placement) to pick the
      // destination, since unlike every other ring pill this one needs an
      // arbitrary explored tile, not a fixed slot list.
      if (unit.typeId === "druid" && !unit.usedThisTurn
          && civ.unlockedMechanics?.has("roots_of_the_world")) {
        options.push({ kind: "teleportSelf", label: "Roots of the World (Teleport Self)" });
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ax = unit.x + dx, ay = unit.y + dy;
            const ally = civ.units.find((u) => u.x === ax && u.y === ay && u !== unit && !u.carriedBy);
            if (!ally) continue;
            const label = ally.name || window.GameData.getUnit(ally.typeId).label;
            options.push({ kind: `teleportAlly:${ax},${ay}`, label: `Roots of the World (Teleport ${label})` });
          }
        }
      }

      // Human "Teleportation" (2026-08-11, user-directed): same promotion as
      // Roots of the World above -- the AI-only teleport (ai.js's
      // performWizardTeleport/attemptWizardTeleport/maybeTeleportStrike) had
      // NO player-facing UI at all until now, only ever firing automatically
      // (a badly-hurt Wizard fleeing, or the AI repositioning a Trebuchet/
      // strongest adjacent ally onto an undefended enemy target). Reuses the
      // SAME "teleportSelf"/"teleportAlly:X,Y" ring kinds as Druid above --
      // main.js's handler picks performPlayerWizardTeleport vs.
      // performPlayerDruidTeleport off the acting unit's own typeId, so
      // there's no need for a second set of kind strings.
      if (unit.typeId === "wizard" && !unit.usedThisTurn
          && civ.unlockedMechanics?.has("teleportation")) {
        options.push({ kind: "teleportSelf", label: "Teleportation (Teleport Self)" });
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ax = unit.x + dx, ay = unit.y + dy;
            const ally = civ.units.find((u) => u.x === ax && u.y === ay && u !== unit && !u.carriedBy);
            if (!ally) continue;
            const label = ally.name || window.GameData.getUnit(ally.typeId).label;
            options.push({ kind: `teleportAlly:${ax},${ay}`, label: `Teleportation (Teleport ${label})` });
          }
        }
      }

      // Human "Freezing Touch" ring option removed (2026-08-17, user-
      // directed rework): the tech is now a passive +50% frozen-on-hit
      // chance on the Wizard's ordinary attacks (see ai.js's
      // considerAttackOrGarrison), not a separate targeted action.

      // Human "Fireball!" (2026-08-17, user-directed rework: was automatic
      // splash off an ordinary attack, now a standalone targeted action).
      // Opens tile-placement mode (main.js's startFireballPlacement) over
      // every in-bounds tile within FIREBALL_RANGE -- no visibility
      // requirement, same as Teleportation's "anywhere explored" reach not
      // being limited to current vision either.
      if (unit.typeId === "wizard" && !unit.usedThisTurn && civ.unlockedMechanics?.has("fireball_splash")) {
        options.push({ kind: "fireball", label: "Fireball!" });
      }

      // Halfellow "Riddle" (2026-08-11, user-directed): same promotion,
      // previously fired only by maybeRiddlePlay. One pill per enemy unit
      // within this caster's own effectiveRange (scales with Boomerang,
      // same as a normal attack -- see ai.js's maybeRiddlePlay), excluding
      // Hidden or already-Befuddled targets, and respecting the per-caster
      // cooldown (ai.js's RIDDLE_COOLDOWN_ROUNDS) the same way the AI does.
      if ((unit.typeId === "trouble_maker" || unit.typeId === "wanderer") && !unit.usedThisTurn
          && civ.unlockedMechanics?.has("riddle") && (unit._riddleCooldownUntilTurn || 0) <= (gameState.turnNumber || 0)) {
        const range = window.GameEngine.combat.effectiveRange(unit, civ);
        for (const otherCiv of Object.values(gameState.civs)) {
          if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
          for (const eu of otherCiv.units) {
            if (eu.carriedBy || eu.conditions?.hidden || eu.conditions?.befuddled) continue;
            if (window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y) > range) continue;
            const label = eu.name || window.GameData.getUnit(eu.typeId).label;
            options.push({ kind: `riddle:${eu.x},${eu.y}`, label: `Riddle ${label}` });
          }
        }
      }

      // Halfellow "Resource Heist" (2026-08-11, user-directed): same
      // promotion, previously fired only by maybeResourceHeistPlay. Melee-
      // range only (this ability requires adjacency to execute, unlike the
      // two ranged ones above) -- one pill per adjacent enemy unit that's
      // currently channeling (Prospector's Claim/Dungeon Delve/Fishing)
      // with a non-empty stash, same eligibility findResourceHeistTarget
      // itself checks.
      if (unit.typeId === "trouble_maker" && !unit.usedThisTurn && civ.unlockedMechanics?.has("resource_heist")) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ax = unit.x + dx, ay = unit.y + dy;
            for (const otherCiv of Object.values(gameState.civs)) {
              if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
              const eu = otherCiv.units.find((u) => u.x === ax && u.y === ay && !u.carriedBy);
              if (!eu || !eu.channeling || eu.conditions?.hidden) continue;
              const stash = eu._channelStash;
              if (!stash || ((stash.harvest || 0) + (stash.coin || 0) + (stash.lore || 0)) <= 0) continue;
              const label = eu.name || window.GameData.getUnit(eu.typeId).label;
              options.push({ kind: `resourceHeist:${ax},${ay}`, label: `Resource Heist: ${label}` });
            }
          }
        }
      }

      // Halfellow "Unlock the Gate" (2026-08-11, user-directed): same
      // promotion, previously fired only by maybeUnlockTheGatePlay. Melee-
      // range only, same as Resource Heist above -- one pill per adjacent
      // enemy wall that isn't already suppressed (combat.js's
      // isWallDefenseSuppressed), same eligibility findUnlockTheGateTarget
      // itself checks. Targets a structure, not a unit -- uses
      // cities.js's findStructureAt (returns { civ, city, record, building
      // }) to get the parent city performUnlockTheGate needs to walk its
      // neighboring wall segments.
      if (unit.typeId === "trouble_maker" && !unit.usedThisTurn && civ.unlockedMechanics?.has("unlock_the_gate")) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ax = unit.x + dx, ay = unit.y + dy;
            const found = window.GameEngine.cities.findStructureAt(gameState, ax, ay);
            if (!found || found.civ.id === civ.id || !found.building.isWall) continue;
            if (window.GameEngine.combat.isWallDefenseSuppressed(found.record, gameState.turnNumber || 0)) continue;
            options.push({ kind: `unlockTheGate:${ax},${ay}`, label: `Unlock the Gate: wall (${ax},${ay})` });
          }
        }
      }

      // Elf "Air Beneath, Eyes Above"/"Shadowsteed" (2026-08-10, user-
      // directed: "mirror this setup for elf druid" -- same instant-summon
      // + player-facing ring option as Orc's Bog Spirit/Wisp below): the
      // Druid's summon used to be AI-only (maybeElfDruidPlay); this
      // promotes it to a real ring action. No tile-placement mode needed --
      // unlike the Wisp's arbitrary swamp destination, Raptor/Shadowsteed
      // always land on an open tile adjacent to the Druid (see ai.js's
      // spawnUnitAdjacentToUnit), so a single click is the whole
      // interaction. Each option only appears while this Druid doesn't
      // already have a live one of that type (ai.js's druidHasLiveSummon --
      // one Raptor, one Shadowsteed, per Druid, same cap as before).
      if (unit.typeId === "druid" && !unit.usedThisTurn) {
        if (civ.unlockedMechanics?.has("raptor_summon")
            && !window.GameEngine.ai.druidHasLiveSummon(civ, unit, "raptor")) {
          options.push({ kind: "summonRaptor", label: "Summon Raptor" });
        }
        if (civ.unlockedMechanics?.has("shadow_steed_summon")
            && !window.GameEngine.ai.druidHasLiveSummon(civ, unit, "shadowsteed")) {
          options.push({ kind: "summonShadowsteed", label: "Summon Shadowsteed" });
        }
      }

      // Orc "Bog Spirit" (2026-08-10, user-directed; summon made instant
      // 2026-08-10, user-reported bug fix -- see ai.js's
      // startBogWitchWispSummon doc comment): promotes the Bog Witch's Wisp
      // summon to a player-facing ring action, same "hand off to main.js's
      // tile-placement mode" shape as Roots of the World above -- the
      // destination is any ever-explored swamp tile, not a fixed slot list,
      // so it needs the same arbitrary-tile picker. Gated on the civ-wide
      // Wisp cap (see ai.js's wispCapReached) so the option simply doesn't
      // appear once every Bog Witch's slot is already spoken for.
      if (unit.typeId === "bog_witch" && !unit.usedThisTurn
          && civ.unlockedMechanics?.has("wisp_summon") && !window.GameEngine.ai.wispCapReached(civ)) {
        options.push({ kind: "summonWisp", label: "Summon Wisp" });
      }

      // Halfellow "Set the Trap" (2026-08-11, user-directed): same
      // "tile-placement mode, gated on the civ-wide trap cap" shape as the
      // Wisp above, but the destination is any tile within the Trouble
      // Maker's own short range (see ai.js's TRAP_PLACEMENT_RANGE), not an
      // arbitrary ever-explored tile -- still needs the picker (more than
      // one legal tile) rather than a single-click adjacent-spawn like
      // Raptor/Shadowsteed. Two separate pills, one per flavor, both gated
      // on the SAME shared cap (ai.js's trapCapReached counts both
      // typeIds together) -- picking either one still only ever nets one
      // trap for this cap slot.
      if (unit.typeId === "trouble_maker" && !unit.usedThisTurn
          && civ.unlockedMechanics?.has("trap_summon") && !window.GameEngine.ai.trapCapReached(civ)) {
        options.push({ kind: "setTrap:frost", label: "Set Frost Trap" });
        options.push({ kind: "setTrap:fire", label: "Set Fire Trap" });
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

      // Sentry (2026-08-12, user-directed): a standing order that does
      // nothing until an enemy comes within range, then attacks it, without
      // ever asking the player for a fresh order in the meantime (see
      // isSpent above and advanceSentryOrder below, run every turn from
      // turns.js's finishCivTurn). Only offered to units that could
      // actually attack something -- a unit with no attack stat standing
      // Sentry would never have anything to react to.
      if (unit.sentry) {
        options.push({ kind: "cancelSentry", label: "Cancel Sentry", danger: true });
      } else if (!unit.usedThisTurn && !unit.channeling && baseUnit.attack > 0) {
        options.push({ kind: "sentry", label: "Sentry" });
      }

      // Follow (2026-08-12, user-directed): a standing order to move toward
      // and stay adjacent to a chosen allied unit every turn (see
      // advanceFollowOrder below). The target can be ANY allied unit
      // anywhere on the map, not a small fixed set of adjacent candidates
      // (unlike Cast Fly/Carry above), so this hands off to main.js's
      // tile-placement mode -- same mechanism Roots of the World/
      // Teleportation use for an arbitrary destination, just with the
      // "slots" being wherever this civ's OTHER units currently stand
      // instead of empty terrain.
      if (unit.followTarget) {
        options.push({ kind: "cancelFollow", label: "Cancel Follow", danger: true });
      } else if (!unit.usedThisTurn && !unit.channeling && civ.units.some((u) => u !== unit && !u.carriedBy)) {
        options.push({ kind: "follow", label: "Follow..." });
      }

      // Rest and Defend (2026-08-07, user-directed): merged from two
      // separate pills into one -- both effects (heal via unit.resting,
      // x2 defense via the "defending" condition) still apply together;
      // see main.js's handleRestAndDefend. overlays.js's drawConditionBadges
      // skips the resting icon whenever "defending" is also active so this
      // shows exactly one badge, not two.
      if (!unit.usedThisTurn) {
        options.push({ kind: "restAndDefend", label: "Rest and Defend" });
      }
      // Garrison -- sidebar.js's garrisonBtn/cancel-garrison-btn.
      if (unit.channeling === "garrison") {
        options.push({ kind: "cancelGarrison", label: "Cancel Garrison", danger: true });
      } else if (!unit.usedThisTurn && !unit.channeling && civ.cities.some((c) => c.x === unit.x && c.y === unit.y)) {
        options.push({ kind: "garrison", label: "Garrison" });
      }
      // Automate Actions -- sidebar.js's automateBtn. Added here (2026-08-06)
      // when the ring menu became the way actions are given, so it stops
      // being the one unit verb reachable only from the sidebar. Same
      // underlying unit.automated flag/handler for every unit type -- Dire
      // Wolf just gets wolf-appropriate wording (2026-08-10, user-directed:
      // "Hunt for Prey" in its ring menu, triggering "hunt automation"),
      // since runAutomatedUnitTurn's cascade for a Dire Wolf is in practice
      // almost entirely maybeDireWolfHunt (see ai.js) -- there's very little
      // else for it to automate.
      const isDireWolf = unit.typeId === "dire_wolf";
      options.push({
        kind: "automate",
        label: unit.automated ? (isDireWolf ? "Stop Hunting" : "Stop Automating") : (isDireWolf ? "Hunt for Prey" : "Automate Actions"),
        danger: !!unit.automated,
      });
      // Level up -- opens the stat picker as a ring SUB-PAGE rather than as
      // five more pills: each choice reads "Attack (12 -> 14)", far too wide
      // for a pill, and would set the width for every other option too. See
      // sidebar.js's levelUpChoicesHtml, which both surfaces share.
      if (window.GameEngine.combat.pendingLevelUps(unit) > 0) {
        options.push({ kind: "levelUp", label: "Level Up!" });
      }
      options.push({ kind: "disband", label: "Disband Unit", danger: true });
      return options;
    }

    // Attack, when something targetable is standing there and is actually in
    // range. Deliberately falls THROUGH to the move options below when it
    // isn't (2026-08-06, user-directed fix): this used to return early on any
    // target, so right-clicking an enemy one tile out of reach opened nothing
    // at all -- indistinguishable from a broken click. "Move to This Tile"
    // against an occupied tile paths to the closest reachable approach (see
    // pathfinding.js), which reads correctly as "advance on it".
    const target = attackTargetAt(unit, gameState, x, y, humanCivId);
    if (target) {
      const preview = previewOrder(unit, gameState, x, y, humanCivId);
      if (preview.kind === "attack") {
        options.push({ kind: "attack", label: "Attack" });
        return options;
      }
    }

    // Found City Here (2026-08-07, user-directed): offered on a remote tile
    // whenever the site is otherwise valid, ignoring the road-connectivity
    // check (skipRoadCheck) -- clicking it is what decides whether that check
    // still applies, via main.js's confirm-a-road-first modal.
    if (baseUnit.canFoundCity && !unit.usedThisTurn
        && window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, x, y, civ.raceId, { skipRoadCheck: true }).ok) {
      options.push({ kind: "foundCityHere", label: "Found City Here" });
    }

    options.push({ kind: "moveTo", label: "Move to This Tile" });
    if (baseUnit.canBuildRoad && !tile.hasRoad) {
      options.push({ kind: "buildRoadTo", label: "Build Road to This Tile" });
    }
    return options;
  }

  /**
   * What one of the player's own cities offers the ring (2026-08-06,
   * user-directed). Categories, not a build list: a build option carries a
   * label, per-resource cost tokens coloured against the stockpile, a turn
   * count and a placement marker, and a dozen of those arranged radially
   * would be unreadable. "Build Unit"/"Build Structure" open the real list as
   * a sub-page instead (see js/ui/ringmenu.js's popover).
   *
   * The gates are transcribed from sidebar.js's renderBuildSection, which is
   * the only other place that decides what a city can be told to do.
   */
  function cityRingOptions(city, gameState, humanCivId) {
    const options = [];
    if (!city || !humanCivId || city.civId !== humanCivId) return options;
    const civ = gameState.civs[city.civId];
    if (!civ) return options;
    const cities = window.GameEngine.cities;

    // A city already building something has spent its production; the only
    // thing left to decide is whether to abandon it.
    if (city.buildQueue) {
      options.push({ kind: "city:cancelBuild", label: "Cancel Build", danger: true });
    } else if (!cities.isProducingResources(city, gameState)) {
      const builds = window.GameEngine.ai.availableBuilds(civ, city, gameState);
      if (builds.some((o) => o.kind === "unit")) options.push({ kind: "city:buildUnit", label: "Build Unit" });
      const buildingOptions = builds.filter((o) => o.kind === "building");
      if (buildingOptions.length) {
        // Count excludes walls (2026-08-10, user-directed) -- a city can
        // only ever have one wall per edge tile (see cities.js's isWall
        // cap), so "N available" is only meaningful for the actual
        // structure roster, not the wall count.
        const nonWallCount = buildingOptions.filter((o) => !window.GameData.getBuilding(o.id).isWall).length;
        const label = nonWallCount > 0 ? `Build Structure (${nonWallCount} available)` : "Build Structure";
        options.push({ kind: "city:buildStructure", label });
      }
      // Same "nothing to take a share of yet" suppression sidebar.js uses for
      // a city founded this turn -- see cities.js's resourceProductionPreview.
      const gain = cities.resourceProductionPreview(city);
      const amounts = [
        gain.harvest >= 0.5 ? `+${Math.round(gain.harvest)}H` : null,
        gain.coin >= 0.5 ? `+${Math.round(gain.coin)}C` : null,
        gain.lore >= 0.5 ? `+${Math.round(gain.lore)}L` : null,
      ].filter(Boolean).join(" ");
      // "Gather More Resources" (2026-08-06, user-directed rename -- was
      // "Resources", which read as a status label rather than a verb).
      // Label no longer shows the amount (2026-08-07, user-directed) --
      // `amounts` is still computed and still gates whether this pill is
      // offered at all (a freshly founded city with nothing to take a share
      // of yet still gets no pill), just not printed into the label text.
      if (amounts) options.push({ kind: "city:resourceProduction", label: "Gather More Resources" });

      // "Research" (2026-08-06, user-directed): the fourth thing this city's
      // production can go into, alongside a unit/building/resources -- see
      // cities.js's applyResearchBoost. Only offered when there's actually
      // something in progress to accelerate.
      if (civ.currentResearch) {
        const turns = cities.researchBoostAmount(city);
        options.push({ kind: "city:research", label: `Research (-${turns} turn${turns === 1 ? "" : "s"})` });
      }
    }

    // "Spread Culture" (2026-08-13, user-directed): a paid, one-turn boost
    // to this city's influence spread -- see cities.js's applyCultureSpread.
    // Deliberately OUTSIDE the buildQueue/isProducingResources gate above:
    // unlike Resource Production/Research, this doesn't consume the city's
    // turn (it's paid from stockpile, not production), so it stays offered
    // even while the city is mid-build.
    if (!cities.isSpreadingCulture(city, gameState)) {
      const cultureCost = cities.spreadCultureCost(city);
      const canAffordCulture = Object.entries(cultureCost)
        .every(([k, v]) => ((civ.stockpile && civ.stockpile[k]) || 0) >= v);
      if (canAffordCulture) {
        const costLabel = Object.entries(cultureCost)
          .map(([k, v]) => `${Math.ceil(v)}${k[0].toUpperCase()}`).join(" ");
        options.push({ kind: "city:spreadCulture", label: `Spread Culture (-${costLabel})` });
      }
    }

    // "Next city needing production" -- same criteria main.js's
    // collectUnresolvedTurnWork nags about at End Turn. The target rides in
    // the kind string, the convention startChannel:<kind> already set.
    const next = civ.cities.find((c) => c !== city && !c.buildQueue
      && !cities.isProducingResources(c, gameState) && !cities.isBoostingResearch(c, gameState)
      && window.GameEngine.ai.availableBuilds(civ, c, gameState).some((o) => o.affordable));
    if (next) options.push({ kind: `city:nextProduction:${next.x},${next.y}`, label: "Next City Needing Orders" });

    return options;
  }

  /**
   * Combines a unit's own action list with its co-located city's, for the
   * MERGED RING (2026-08-06, user-directed): unit actions land in the LEFT
   * column, city actions in the RIGHT, in one ring rather than a "City
   * Actions" pill drilling down into a second one. `split` is consumed
   * directly by js/ui/ringmenu.js's layout() as `ctx.split` -- see its own
   * doc comment for why an explicit {leftCount, rightCount} bypasses that
   * function's normal auto-fit column assignment.
   *
   * Returns `split: null` when there's no city to merge in, so a caller can
   * pass the result straight through without a separate "was there
   * anything to merge" check -- ringmenu.js's layout() already treats a
   * missing ctx.split as "use the automatic split", which is exactly what a
   * plain unit-only ring wants.
   */
  function mergeUnitCityOptions(unitOptions, cityOptions) {
    if (!cityOptions.length) return { options: unitOptions, split: null };
    return {
      options: unitOptions.concat(cityOptions),
      split: { leftCount: unitOptions.length, rightCount: cityOptions.length },
    };
  }

  /**
   * THE ONE ENTRY POINT the ring menu asks (2026-08-06, user-directed).
   * Keeps input.js's "decide WHERE, not WHAT" split intact: input.js reports
   * a tile, this decides whose menu that tile opens and what's on it.
   *
   * The rule the whole interaction rests on:
   *
   *   Right-click moves selection only when the ring's SUBJECT is on the tile
   *   that was clicked. A remote target never steals selection.
   *
   * so right-clicking one of your own units picks it up and shows its own
   * actions, while right-clicking anything else (empty ground, an enemy, an
   * enemy city) leaves your current unit selected and shows what IT can do
   * about that tile. `retarget` is how that gets reported back.
   *
   * A city under a unit is the case that merges the two rings (see
   * mergeUnitCityOptions above): a unit standing on your own city always
   * wins the sidebar's tab (see input.js's SELECTION MODEL), so
   * viewState.selectedCity is null there and the city ring would otherwise
   * be unreachable on exactly the tiles where it's most wanted. A single
   * "city:open" cross-link pill is still used for the OTHER case -- a
   * different unit selected elsewhere, right-clicking a REMOTE city -- so
   * setting production never costs a preparatory left-click even then, just
   * without the full merge (there's no shared tile to anchor a two-column
   * ring to).
   */
  function mapMenuOptions(gameState, viewState, x, y, humanCivId) {
    const none = { subject: "none", retarget: false, options: [] };
    if (!humanCivId) return none;
    const civ = gameState.civs[humanCivId];
    if (!civ) return none;

    const cityHere = civ.cities.find((c) => c.x === x && c.y === y) || null;
    const unitHere = civ.units.find((u) => u.x === x && u.y === y && !u.carriedBy
      && canCommand(u, gameState, humanCivId)) || null;

    // 1. One of ours is standing there: that unit becomes the subject.
    //
    // MERGED RING (2026-08-06, user-directed): when that tile is ALSO one of
    // this civ's own cities -- unavoidably true here, since unitHere/cityHere
    // both come from this civ's own units/cities -- the ring shows unit
    // actions and city actions together (unit actions left, city actions
    // right) instead of a single "City Actions" pill that drilled down into
    // a separate city-only ring. See mergeUnitCityOptions below for the
    // split main.js's ringmenu.js render reads.
    if (unitHere) {
      const selected = viewState.selectedUnit;
      const alreadyActive = selected && selected.x === x && selected.y === y
        && canCommand(selected, gameState, humanCivId);
      const subjectUnit = alreadyActive ? selected : unitHere;
      const unitOptions = contextMenuOptions(subjectUnit, gameState, x, y, humanCivId);
      const cityOptions = cityHere ? cityRingOptions(cityHere, gameState, humanCivId) : [];
      const { options, split } = mergeUnitCityOptions(unitOptions, cityOptions);
      // No retarget when the selected unit is already on this tile -- right-
      // clicking a stack shouldn't shuffle which of its units is active.
      return { subject: "unit", retarget: !alreadyActive, options, split };
    }

    // 2. A commandable unit is selected elsewhere: this tile is its target.
    const selected = viewState.selectedUnit;
    if (canCommand(selected, gameState, humanCivId)) {
      const options = contextMenuOptions(selected, gameState, x, y, humanCivId);
      if (cityHere) options.push({ kind: "city:open", label: "City Actions" });
      return { subject: "unit", retarget: false, options };
    }

    // 3. Nothing selected, but one of our cities is here.
    if (cityHere) {
      return { subject: "city", retarget: true, options: cityRingOptions(cityHere, gameState, humanCivId) };
    }
    return none;
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
    advanceSentryOrder,
    advanceFollowOrder,
    performRestAndDefend,
    plannedPath,
    contextMenuOptions,
    canCarryPassenger,
    performCarry,
    cityRingOptions,
    mergeUnitCityOptions,
    mapMenuOptions,
    queueBuild,
    cancelBuild,
  };
})();
