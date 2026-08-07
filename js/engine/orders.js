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

      // Cast Fly on an ally (2026-08-06, user-directed bug fix): one pill
      // per eligible ADJACENT ally, offered from the WIZARD'S OWN tile --
      // not from right-clicking the ally directly. That would seem like the
      // more natural gesture, but it's unreachable under this game's own
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
      // itself rather than trusting this list stayed accurate since it was
      // drawn.
      if (unit.typeId === "wizard" && !unit.usedThisTurn && civ.unlockedMechanics?.has("flight_grant")) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ax = unit.x + dx, ay = unit.y + dy;
            const ally = civ.units.find((u) => u.x === ax && u.y === ay && u !== unit && !u.carriedBy);
            if (!ally) continue;
            if (window.GameData.getUnit(ally.typeId).category !== "military") continue;
            if (window.GameEngine.combat.isFlying(ally)) continue;
            const allyLabel = ally.name || window.GameData.getUnit(ally.typeId).label;
            options.push({ kind: `castFlight:${ax},${ay}`, label: `Cast Fly on ${allyLabel}` });
          }
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
      // being the one unit verb reachable only from the sidebar.
      options.push({
        kind: "automate",
        label: unit.automated ? "Stop Automating" : "Automate Actions",
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
      if (builds.some((o) => o.kind === "building")) options.push({ kind: "city:buildStructure", label: "Build Structure" });
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
    performRestAndDefend,
    plannedPath,
    contextMenuOptions,
    cityRingOptions,
    mergeUnitCityOptions,
    mapMenuOptions,
    queueBuild,
    cancelBuild,
  };
})();
