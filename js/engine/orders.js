/**
 * PLAYER ORDERS
 * -------------
 * The human player's verbs: move a unit, attack something with it, and ask
 * what either of those would do before committing.
 *
 * Everything here is a thin adapter over the engine functions the AI already
 * uses -- ai.js's spendMovement, computeReachableTiles and
 * considerAttackOrGarrison. An attack drags a long tail of race-specific
 * follow-through behind it (Burning, Fireball splash, Orc curses, Elf
 * Freeze, zombie raising, Hound-and-Hunter/Undaunted replacement spawns,
 * cargo drops, plunder, XP and leveling, quips, sfx, combat events), so a
 * player order goes into the AI's own attack path with the target
 * pre-chosen (opts.forcedTarget -- see considerAttackOrGarrison), keeping
 * the player and the AI on identical code with a different decision-maker
 * in front of it.
 *
 * ACTION ECONOMY (see ai.js's "Turn-action-economy foundation" comment):
 * a unit's turn is movement points (unit.movesRemaining) PLUS one action
 * (unit.usedThisTurn). Moving spends only movement; attacking, Rest, Defend,
 * Build Road, founding, and starting a channel consume the action. This
 * module enforces that split for the player -- the AI enforces it for itself.
 *
 * RIGHT-CLICK RADIAL MENU: js/ui/input.js's contextmenu handler opens a ring
 * of actions around the clicked tile, built from mapMenuOptions below (which
 * routes to contextMenuOptions for a unit or cityRingOptions for a city),
 * and the player's pick dispatches through main.js's handleContextMenuAction.
 * A destination out of this turn's movement range starts a persisted
 * gotoTarget order (see startGotoOrder/advanceGotoOrder) that keeps making
 * progress automatically every turn until it arrives or gets blocked. This
 * module is the ONLY place that decides what a unit or city can be told to
 * do; the sidebar renders information only.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  /** True if any of the 8 tiles around (x,y) is open water -- gates the
   *  "Build Bridge..." ring option onto a Pioneer actually standing at the
   *  water's edge (see contextMenuOptions' onOwnTile branch). */
  function isAdjacentToWater(map, x, y) {
    const TERRAIN = window.GameData.TERRAIN;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) return true;
      }
    }
    return false;
  }

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
   *  A unit with a pending gotoTarget order (see startGotoOrder) counts as
   *  spent too: it will keep executing that order automatically turn after
   *  turn, so it shouldn't keep interrupting Next Unit or the End Turn
   *  reminder until it arrives (gotoTarget clears) or its order gets
   *  cancelled (blocked path, or a new order overriding it). */
  function isSpent(unit, gameState) {
    if (unit.usedThisTurn) return true;
    if (unit.channeling) return true;
    if (unit.gotoTarget) return true;
    // Sentry / Follow: same standing-order exclusion as gotoTarget above --
    // both keep acting automatically every turn (see turns.js's
    // finishCivTurn -> advanceSentryOrder/advanceFollowOrder) until they
    // resolve on their own or the player cancels them.
    if (unit.sentry) return true;
    if (unit.followTarget) return true;
    // An automated unit is "already ordered" by definition (a pendingIntent
    // still gets its own blocking confirmation modal, just not this nag).
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
      // Combat can kill units on either side, changing the board's
      // occupancy, so the cached reachable set is no longer trustworthy.
      invalidateReachCache();
      window.GameEngine.turns.refreshVisibility(gameState);
    }
    return didAttack;
  }

  /**
   * MULTI-TURN GOTO ORDERS
   * -----------------------
   * unit.gotoTarget = { x, y, buildRoad } is a persisted order that survives
   * across turns: set once (startGotoOrder), then re-advanced by exactly one
   * turn's worth of progress each time advanceGotoOrder is called -- once
   * immediately when the order is issued (so a same-turn-reachable
   * destination completes instantly), and once automatically per turn after
   * that for every human unit with a pending order (see turns.js's
   * beginCivTurn, which calls this in the human civ's branch before the
   * player gets to act that turn).
   *
   * Two shapes:
   *   - Plain move (buildRoad: false): identical to moveTo/spendMovement --
   *     walks as far as the unit's movement budget allows this turn.
   *   - "Build road to this tile" (buildRoad: true): checks the unit's OWN
   *     tile first (see advanceGotoOrder), then walks the path ONE step at a
   *     time, but the INSTANT it would enter a tile with no road already on
   *     it, stops there and builds the road (an instant action, same as the
   *     standalone "Build Road Here" button) -- ending this turn's progress
   *     even if movement remains. Guarantees a fully connected road with no
   *     gaps: already-roaded ground along the way is crossed at full speed
   *     with no stopping, but only one NEW segment can go down per turn
   *     (building is always a whole action, regardless of the unit's raw
   *     movement stat).
   *
   * Blocked-path handling: if a call makes literally NO progress at all
   * (didn't move, didn't build), the order is cancelled outright rather than
   * left to spin forever making zero progress every future turn too.
   */
  function startGotoOrder(unit, gameState, x, y, buildRoad, opts = {}) {
    unit.gotoTarget = { x, y, buildRoad: !!buildRoad, foundCity: !!opts.foundCity };
    advanceGotoOrder(unit, gameState);
  }

  /** Build Bridge: one segment at a time (2026-08-19), same shape as Build
   *  Road Here -- (x,y) must be immediately adjacent to the unit's own
   *  tile and open water (cities.js's canBuildBridgeSegment). False if no
   *  longer legal (the picker's own slots should already guarantee this,
   *  but the player could in principle sit on the confirmation for a while
   *  as the map changes around them). */
  function startBridgeOrder(unit, gameState, x, y) {
    if (!window.GameEngine.cities.canBuildBridgeSegment(gameState.map, unit, x, y)) return false;
    unit.gotoTarget = { x, y, buildBridge: true, bridgeTurnsLeft: null };
    advanceGotoOrder(unit, gameState);
    return true;
  }

  function stopGotoOrder(unit) {
    unit.gotoTarget = null;
  }

  /** Enter Cave (2026-08-19, user-directed): a full turn action -- instantly
   *  relocates the unit to its cave's linked partner tile (tile.caveLinkX/Y,
   *  see worldgen.js's placeCaves) and ends its turn, no move or attack
   *  after (same "the whole turn is spent arriving" restriction as Human
   *  Teleportation/Dwarf Deep Gate). Fog of war around the new position is
   *  handled by the normal per-turn visibility refresh, same as any other
   *  move -- there's no special reveal-before-arrival: per the user's
   *  design a cave is usable the moment a unit finds ONE end, and using it
   *  reveals wherever the other end turns out to be. Returns false (no-op)
   *  if the unit already acted this turn or isn't standing on a cave. */
  function performEnterCave(unit, gameState) {
    if (!unit || unit.usedThisTurn) return false;
    const { map } = gameState;
    const tile = map.tiles[unit.y * map.width + unit.x];
    if (!tile || !tile.isCave) return false;
    unit.automated = false;
    unit.pendingIntent = null;
    unit.gotoTarget = null;
    // Clear every standing order, not just gotoTarget (2026-08-19 bugfix):
    // the ring menu offers Enter Cave regardless of unit.channeling/sentry/
    // followTarget (a unit Resting and Defending -- or Mining, Fishing,
    // etc. -- ON a cave tile still sees the option), and unlike every one
    // of those, channeling in particular never auto-invalidates on its own
    // for restAndDefend (see turns.js's "persists anywhere" handling) --
    // so a unit that entered a cave while channeling arrived at the far
    // side still marked channeling, which made it look permanently spent
    // and unable to take a fresh order on any later turn.
    unit.channeling = null;
    unit.sentry = false;
    unit.followTarget = null;
    // Don't stack on whatever's already sitting at the far end (2026-08-21,
    // user-directed) -- same "nearest open neighbor, city tile as last
    // resort" convention ai.js's spawnUnitInCity already uses for a
    // completed build; findClosestOpenPlacementTile falls back to the link
    // tile itself (accepting the stack) only if every neighbor is ALSO
    // blocked.
    const ai = window.GameEngine.ai;
    const destX = tile.caveLinkX, destY = tile.caveLinkY;
    const caveOccupied = ai.buildOccupancySet(gameState.civs, unit);
    if (caveOccupied.has(`${destX},${destY}`)) {
      const openSpot = ai.findClosestOpenPlacementTile(destX, destY, map, gameState.civs, caveOccupied, unit.civId);
      unit.x = openSpot ? openSpot.x : destX;
      unit.y = openSpot ? openSpot.y : destY;
    } else {
      unit.x = destX;
      unit.y = destY;
    }
    unit.usedThisTurn = true;
    // Zero, not left alone (2026-08-19 bugfix): whatever movement the unit
    // had left over from walking to the entrance belongs to a trip that no
    // longer exists once it's instantly on the far side of the map -- "no
    // move after" (this function's own doc comment) means exactly that,
    // not "carry over whatever was left." Left non-zero, a unit that
    // reached the entrance with movement to spare could immediately walk
    // again from the EXIT this same turn, covering far more ground in one
    // turn than any normal move ever could.
    unit.movesRemaining = 0;
    return true;
  }

  /** Rest and Defend: heals via unit.resting AND doubles defense via the
   *  "defending" condition -- see combat.js's setCondition. Channeled
   *  (unit.channeling = "restAndDefend") so it persists automatically every
   *  turn (see turns.js's finishCivTurn) until the unit is given a
   *  different order, instead of lapsing after one turn -- merged with the
   *  old separate Garrison action (2026-08-19, user-directed: same standing
   *  brace, just no longer gated on standing in a city to start it; a unit
   *  resting and defending IN one of this civ's own cities additionally
   *  picks up that city's defensive bonuses -- see cities.js's tickCity and
   *  ai.js's tickWallDefense/tickMageTowerDefense). Returns false (no-op) if
   *  the unit already acted this turn -- same guard the ring pill's own
   *  visibility uses. */
  function performRestAndDefend(unit, gameState) {
    if (!unit || unit.usedThisTurn) return false;
    unit.automated = false;
    unit.pendingIntent = null;
    unit.gotoTarget = null;
    unit.channeling = "restAndDefend";
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
      // The STARTING tile first: pathfinding.js's findPath returns steps
      // "from (but not including) the start tile", so the road-laying loop
      // below (which walks `path`) never looks at the tile the unit is
      // already standing on. Handled here before any movement happens this
      // call, same "one new segment per turn, stop regardless of leftover
      // movement" rule the loop below applies to every other tile -- keeps
      // the finished road gapless, including at the starting tile.
      const startTile = map.tiles[unit.y * map.width + unit.x];
      // !tileCountsAsRoad, not !startTile.hasRoad -- a bridge segment
      // already counts as a road without setting hasRoad itself (see
      // cities.js's tileCountsAsRoad), so laying a real road on top of one
      // would be redundant.
      if (!unit.usedThisTurn && !window.GameEngine.cities.tileCountsAsRoad(startTile)) {
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
            // !tileCountsAsRoad, not !tile.hasRoad -- see startTile's own
            // comment above. A bridge tile already counts as a road, so the
            // Pioneer just walks across it (no break, no action spent) and
            // keeps laying real road from the far side onward.
            if (!window.GameEngine.cities.tileCountsAsRoad(tile)) {
              if (!unit.usedThisTurn) { tile.hasRoad = true; unit.usedThisTurn = true; }
              break; // one new road segment per turn -- stop here regardless of leftover movement
            }
          }
          if (progressed) window.GameEngine.turns.refreshVisibility(gameState);
        }
      }
    } else if (target.buildBridge) {
      // One segment at a time (2026-08-19), same "pick an adjacent tile,
      // commit to it" shape as Build Road Here -- target.x/y IS the single
      // water tile itself (cities.js's canBuildBridgeSegment already
      // guaranteed it's adjacent when startBridgeOrder set this up). Unlike
      // a road segment (instant, free, one per turn), it costs Coin up
      // front and takes bridge_section.minBuildTurns real turns, same
      // pacing as a wall -- see cities.js's placeBridgeSegment. The Pioneer
      // is committed to it (usedThisTurn) for every one of those turns,
      // same as any other channeled action. Building the next segment
      // beyond this one is a separate "Build Bridge..." order the player
      // issues again once they're standing on this one.
      if (!unit.usedThisTurn) {
        if (target.bridgeTurnsLeft == null) {
          const building = window.GameData.getBuilding("bridge_section");
          const civ = civs[unit.civId];
          civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
          if (civ.stockpile.coin < building.coinCost) {
            unit.gotoTarget = null;
            unit.currentMission = "Bridge halted — not enough Coin";
            return;
          }
          civ.stockpile.coin -= building.coinCost;
          // 2026-08-24 bugfix: bridge_section has no minBuildTurns field
          // (removed 2026-08-21 -- build time went table-driven, same change
          // that affected wall_section). Reading it here always produced
          // undefined, so this counted down from NaN forever and never hit
          // <=0 -- construction showed "NaN" and never completed.
          target.bridgeTurnsLeft = window.GameEngine.ai.buildingBuildTurns(civ, "bridge_section");
        }
        target.bridgeTurnsLeft--;
        unit.usedThisTurn = true;
        progressed = true;
        if (target.bridgeTurnsLeft <= 0) {
          window.GameEngine.cities.placeBridgeSegment(civs[unit.civId], map, target.x, target.y);
          // Advance the Pioneer onto the segment it just finished -- same
          // "set position directly" convention the road loop above already
          // uses per-tile.
          unit.x = target.x; unit.y = target.y;
          unit.gotoTarget = null;
          window.GameEngine.turns.refreshVisibility(gameState);
        }
      }
    } else {
      // Captured BEFORE moveTo/spendMovement can lazily fill in a fresh
      // budget from null -- exactly 0 here means the unit already spent
      // every point of movement earlier this same turn (e.g. walking to a
      // cave entrance, then Entering it, which now explicitly zeroes
      // movesRemaining -- see performEnterCave), as opposed to null,
      // which means it hasn't moved yet and moveTo is about to compute a
      // full budget. Read below (2026-08-19 bugfix) to tell "no movement
      // left THIS turn" apart from "pathfinding found no route at all".
      const hadNoMovesLeft = unit.movesRemaining === 0;
      // moveTo does its own canCommand check -- passing the unit's own
      // civId as `humanCivId` there is safe (not a security hole): a
      // gotoTarget is only ever SET through human-triggered UI code in the
      // first place, so this is just reusing moveTo's existing signature,
      // not bypassing a real permission check.
      progressed = moveTo(unit, gameState, target.x, target.y, unit.civId);
      if (!progressed && hadNoMovesLeft) {
        // Not actually blocked -- there was simply no budget left to try
        // with. Leave gotoTarget exactly as it is (this same function
        // runs again next turn, after movesRemaining resets to a fresh
        // budget, and picks up the walk from here) instead of cancelling
        // an otherwise perfectly reachable destination as though the path
        // itself were the problem. Without this, clicking "Move to This
        // Tile" the same turn a unit exhausted its movement (most often
        // right after Entering a Cave) silently did nothing AND discarded
        // the order, instead of queuing it to actually start next turn.
        unit.currentMission = `Moving to (${target.x},${target.y}) next turn — no movement left this turn`;
        return;
      }
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
      : target.buildBridge
        ? `Building a bridge to (${target.x},${target.y})`
        : `Moving to (${target.x},${target.y})`;
  }

  /**
   * SENTRY
   * -------
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
   * FOLLOW
   * -------
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
    // Paths toward the target's tile and stops as close as this turn's
    // budget allows; since the target's own tile is occupied it can never
    // actually be landed on, so this naturally settles adjacent once in
    // range rather than needing a separate "stop short" check here.
    window.GameEngine.ai.spendMovement(unit, target.x, target.y, gameState.map, gameState.civs);
    unit.currentMission = `Following ${label}`;
  }

  /**
   * WHERE IS THIS UNIT GOING?
   * ---------------------------
   * For a unit that keeps moving on its own between clicks -- one mid
   * multi-turn goto order, or one running on Automate Actions -- this
   * reports the route it will take and the tile it's aiming for, so
   * render.js can draw it on the map (drawPlannedPaths).
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
   * A UNIT'S ACTIONS
   * -----------------
   * Every action available for `unit` if the player right-clicks tile (x,y).
   * The player picks from a radial menu every time, no exceptions for
   * "simple" in-range moves (js/ui/ringmenu.js). Two shapes:
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
   * THIS IS THE ONLY COPY OF THESE GATES. sidebar.js is information-only
   * (see its "INFORMATION ONLY" note) and derives independently only the
   * NON-actionable half it interleaves with that information -- "Cannot
   * found here: <reason>", a channel's turn counter -- which answers a
   * different question ("why can't I?") than this does ("what can I?").
   *
   * Each option is {kind, label, danger?} -- `kind` is a stable string
   * main.js's handleContextMenuAction dispatches on; `danger` carries the
   * same red-styling hint sidebar.js's action-btn-danger class gives
   * Cancel/Disband. Pure/non-mutating, re-derived fresh every time the menu
   * needs to render or a click needs resolving.
   */
  /** Whether `carrierUnit` could carry `passengerUnit` right now, mirroring
   *  the AI's own galley-boarding/Shadowsteed-carry rules (see ai.js's Naval
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
      // techs.js's elf_shadowsteed. Also excludes another Shadowsteed
      // (2026-08-24 bugfix): nothing in that tech's design intends a
      // Shadowsteed to ferry its own kind.
      if (passengerUnit.typeId === "awakened_oak" || passengerUnit.typeId === "raptor"
          || passengerUnit.typeId === "galley" || passengerUnit.typeId === "shadowsteed") return false;
    } else if (window.GameData.getUnit(carrierUnit.typeId).isNaval) {
      // A Galley (or any future naval carrier) doesn't ferry another boat,
      // or a flier that doesn't need ferrying -- mirrors ai.js's own
      // militaryAtTile boarding filter (!ud.isNaval).
      if (passengerBase.isNaval || passengerBase.flying) return false;
    }
    return true;
  }

  /**
   * TARGETED-ACTION CANDIDATE LISTS
   * -------------------------------
   * Each helper below answers "which units/structures could this ability hit
   * right now" for exactly one ability. Every one is consumed TWICE:
   * contextMenuOptions uses `.length` to decide whether to offer the single
   * ability pill at all, and main.js's startTargetSelection turns the same
   * list into the highlighted, clickable candidates. One list per ability, so
   * the picker can never highlight something the engine would then refuse
   * (the same "UI must never offer what the engine refuses" rule
   * canAttackUnitNow already enforces for attacks).
   *
   * This replaced a pill-per-target ring: with several units nearby the ring
   * filled up with near-identical "Cast Fly on X"/"Carry Y" entries. One
   * pill + a map click scales to any number of targets.
   *
   * All are pure/non-mutating and return plain arrays (empty, never null).
   */

  /** Every enemy unit or structure `unit` could legally attack right now,
   *  given its current range/position and this turn's remaining action --
   *  the candidate list behind the "Attack..." ring pill (2026-08-27, user-
   *  directed, mobile: same two-stage "pick the ability, then click the
   *  target" shape as Cast Fly/Carry above, so an in-range enemy doesn't
   *  require right-clicking/long-pressing it directly). Cities are still
   *  excluded, same as before -- only UNITS and STRUCTURES are offered
   *  through this second entry point; the existing remote-tile "Attack"
   *  pill (attackTargetAt, offered when a target tile is clicked directly)
   *  is unchanged and still covers cities exactly as it always has.
   *
   *  Units and structures use two different validity checks because
   *  that's what the engine itself already uses for each: canAttackUnitNow
   *  for units (same range/visibility/line-of-sight gate attack() is
   *  judged against), a plain effectiveRange bounding box + findStructureAt
   *  for structures (same shape unlockTheGateTargets above uses for its own
   *  fixed 1-tile-adjacency ability, just sized to this unit's real attack
   *  range instead, and with no building-type filter -- attackTargetAt
   *  offers ANY enemy structure, not just walls, so this matches). Neither
   *  half pre-checks line-of-sight for a structure target, mirroring
   *  previewOrder's own structure/city branch: the engine has the final
   *  say at commit time either way. noOrdinaryAttack (Dwarf Bombard) is
   *  excluded, same gate the remote-tile branch below applies -- its only
   *  offense is the standalone Bombardment pill, not this one. */
  function attackTargets(unit, gameState, humanCivId) {
    const civ = gameState.civs[unit.civId];
    if (!civ || unit.usedThisTurn) return [];
    if (window.GameData.getUnit(unit.typeId).noOrdinaryAttack) return [];
    const out = [];
    for (const enemyCiv of Object.values(gameState.civs)) {
      if (enemyCiv.id === humanCivId || enemyCiv.eliminated) continue;
      for (const enemyUnit of enemyCiv.units) {
        if (enemyUnit.carriedBy) continue;
        if (window.GameEngine.ai.canAttackUnitNow(civ, unit, enemyUnit, gameState)) {
          out.push(enemyUnit);
        }
      }
    }
    const range = Math.ceil(window.GameEngine.combat.effectiveRange(unit, civ));
    const { map } = gameState;
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = unit.x + dx, y = unit.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        if (window.GameEngine.influence.chebyshev(unit.x, unit.y, x, y) > range) continue;
        const found = window.GameEngine.cities.findStructureAt(gameState, x, y);
        if (!found || found.civ.id === civ.id) continue;
        out.push({ x, y, structure: found });
      }
    }
    return out;
  }

  /** Human "Flight": self (unless already flying) plus every allied military
   *  unit within the Wizard's REACH -- adjacency plus however far it can
   *  still walk this turn, since castFlightOnAlly walks into range itself. */
  function flightTargets(unit, gameState, humanCivId) {
    const civ = gameState.civs[unit.civId];
    if (!civ || unit.typeId !== "wizard" || unit.usedThisTurn) return [];
    if (!civ.unlockedMechanics?.has("flight_grant")) return [];
    const out = [];
    if (!window.GameEngine.combat.isFlying(unit)) out.push(unit);
    const reach = 1 + (unit.movesRemaining
      ?? window.GameEngine.ai.computeMovementBudget(unit, gameState.map, gameState.civs));
    for (const ally of civ.units) {
      if (ally === unit || ally.carriedBy) continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > reach) continue;
      if (window.GameData.getUnit(ally.typeId).category !== "military") continue;
      if (window.GameEngine.combat.isFlying(ally)) continue;
      out.push(ally);
    }
    return out;
  }

  /** Human "Teleportation" / Elf "Roots of the World": the caster itself, or
   *  any currently-ADJACENT ally (both perform* functions refuse a
   *  non-adjacent target, so the picker must not offer one). */
  function teleportTargets(unit, gameState, humanCivId) {
    const civ = gameState.civs[unit.civId];
    if (!civ || unit.usedThisTurn) return [];
    const isWizard = unit.typeId === "wizard" && civ.unlockedMechanics?.has("teleportation");
    const isDruid = unit.typeId === "druid" && civ.unlockedMechanics?.has("roots_of_the_world");
    if (!isWizard && !isDruid) return [];
    const out = [unit];
    for (const ally of civ.units) {
      if (ally === unit || ally.carriedBy) continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > 1) continue;
      out.push(ally);
    }
    return out;
  }

  /** Elf "Nature's Grace": every allied unit actually missing HP within the
   *  caster's own effectiveRange and with a clear shot -- mirrors ai.js's
   *  maybeNaturesGrace scan exactly, minus its "pick the most injured" step.
   *  Includes the caster itself: a Druid can heal itself with this. */
  function naturesGraceTargets(unit, gameState, humanCivId) {
    const civ = gameState.civs[unit.civId];
    if (!civ || unit.usedThisTurn) return [];
    if (!civ.unlockedMechanics?.has("natures_grace")) return [];
    // Shadowsteed carrying a Druid rider casts through the steed -- same
    // dispatch ai.js's runUnitTurn uses.
    const casts = unit.typeId === "druid"
      || (unit.typeId === "shadowsteed" && unit.carries?.typeId === "druid");
    if (!casts) return [];
    const range = window.GameEngine.combat.effectiveRange(unit, civ);
    const out = [];
    for (const ally of civ.units) {
      if (ally.carriedBy) continue;
      if (ally.hp >= ally.maxHp) continue;
      if (window.GameEngine.influence.chebyshev(unit.x, unit.y, ally.x, ally.y) > range) continue;
      if (!window.GameEngine.ai.hasRangedLineOfSight(gameState.map, unit.x, unit.y, ally.x, ally.y)) continue;
      out.push(ally);
    }
    return out;
  }

  /** Units this one could pick up as cargo right now (adjacent, own civ). */
  function carryTargets(unit, gameState, humanCivId) {
    const civ = gameState.civs[unit.civId];
    if (!civ || unit.usedThisTurn) return [];
    return adjacentOwnUnits(unit, civ).filter((n) => canCarryPassenger(unit, n, civ));
  }

  /** Adjacent carriers this unit could board -- the inverse of carryTargets,
   *  through the same predicate so the two can never disagree. */
  function boardTargets(unit, gameState, humanCivId) {
    const civ = gameState.civs[unit.civId];
    if (!civ || unit.usedThisTurn) return [];
    return adjacentOwnUnits(unit, civ).filter((n) => canCarryPassenger(n, unit, civ));
  }

  function adjacentOwnUnits(unit, civ) {
    return civ.units.filter((u) =>
      u !== unit && Math.max(Math.abs(u.x - unit.x), Math.abs(u.y - unit.y)) === 1);
  }

  /** Halfellow "Riddle": enemy units within effectiveRange, excluding Hidden
   *  and already-Befuddled ones, respecting the per-caster cooldown. */
  function riddleTargets(unit, gameState, humanCivId) {
    const civ = gameState.civs[unit.civId];
    if (!civ || unit.usedThisTurn) return [];
    if (unit.typeId !== "trouble_maker" && unit.typeId !== "wanderer") return [];
    if (!civ.unlockedMechanics?.has("riddle")) return [];
    if ((unit._riddleCooldownUntilTurn || 0) > (gameState.turnNumber || 0)) return [];
    const range = window.GameEngine.combat.effectiveRange(unit, civ);
    const out = [];
    for (const otherCiv of Object.values(gameState.civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.carriedBy || eu.conditions?.hidden || eu.conditions?.befuddled) continue;
        if (window.GameEngine.influence.chebyshev(unit.x, unit.y, eu.x, eu.y) > range) continue;
        out.push(eu);
      }
    }
    return out;
  }

  /** Halfellow "Resource Heist": ADJACENT enemy units mid-channel with a
   *  non-empty stash -- same eligibility findResourceHeistTarget checks. */
  function resourceHeistTargets(unit, gameState, humanCivId) {
    const civ = gameState.civs[unit.civId];
    if (!civ || unit.usedThisTurn) return [];
    if (unit.typeId !== "trouble_maker" || !civ.unlockedMechanics?.has("resource_heist")) return [];
    const out = [];
    for (const otherCiv of Object.values(gameState.civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (eu.carriedBy || eu.conditions?.hidden || !eu.channeling) continue;
        if (Math.max(Math.abs(eu.x - unit.x), Math.abs(eu.y - unit.y)) !== 1) continue;
        const stash = eu._channelStash;
        if (!stash || ((stash.harvest || 0) + (stash.coin || 0) + (stash.lore || 0)) <= 0) continue;
        out.push(eu);
      }
    }
    return out;
  }

  /** Halfellow "Unlock the Gate": ADJACENT enemy wall segments not already
   *  suppressed. Returns cities.js findStructureAt records ({civ, city,
   *  record, building}) rather than units -- the only candidate list here
   *  that targets a structure, so its entries carry x/y explicitly for the
   *  picker to key off. */
  function unlockTheGateTargets(unit, gameState, humanCivId) {
    const civ = gameState.civs[unit.civId];
    if (!civ || unit.usedThisTurn) return [];
    if (unit.typeId !== "trouble_maker" || !civ.unlockedMechanics?.has("unlock_the_gate")) return [];
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ax = unit.x + dx, ay = unit.y + dy;
        const found = window.GameEngine.cities.findStructureAt(gameState, ax, ay);
        if (!found || found.civ.id === civ.id || !found.building.isWall) continue;
        if (window.GameEngine.combat.isWallDefenseSuppressed(found.record, gameState.turnNumber || 0)) continue;
        out.push({ x: ax, y: ay, structure: found });
      }
    }
    return out;
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

    // Trap units short-circuit every other branch below -- a trap has
    // nothing to move, attack, channel, garrison, or automate, full stop.
    if (unit.typeId === "trap_frost" || unit.typeId === "trap_fire") {
      return [{ kind: "disband", label: "Disband Unit", danger: true }];
    }

    const civ = gameState.civs[unit.civId];
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const tile = gameState.map.tiles[y * gameState.map.width + x];
    const onOwnTile = unit.x === x && unit.y === y;

    if (onOwnTile) {
      // Move To...: an explicit entry point into main.js's tile-placement
      // mode (startMoveToPlacement) -- pick a destination by tapping it
      // afterward, rather than needing to right-click/long-press the
      // destination tile directly (2026-08-27, user-directed; that existing
      // flow -- see "Move to This Tile" below in the remote-tile branch --
      // is unchanged and still works the same). Any tile is a legal
      // destination, same permissiveness as that remote-tile pill:
      // reachability is resolved when the order actually runs
      // (startGotoOrder), not here. Movement's own unit.movement > 0 gate
      // is intentionally skipped -- the remote-tile "moveTo" pill has none
      // either, since a goto order can be queued now and simply resume once
      // the unit has movement again next turn.
      if (baseUnit.movement > 0) {
        options.push({ kind: "moveToPlacement", label: "Move To..." });
      }

      // Attack...: same two-stage entry point as Move To just above, over
      // attackTargets' candidate list (2026-08-27, user-directed) -- an
      // in-range enemy no longer requires right-clicking/long-pressing it
      // directly (the existing "Attack" pill on a remote tile's own ring,
      // driven by attackTargetAt, is unchanged and still works the same).
      if (attackTargets(unit, gameState, humanCivId).length) {
        options.push({ kind: "attackPlacement", label: "Attack..." });
      }

      // Found City / Build Road -- sidebar.js's pioneerActions.
      if ((baseUnit.canFoundCity || baseUnit.canBuildRoad) && !unit.usedThisTurn) {
        if (baseUnit.canFoundCity
            && window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, unit.x, unit.y, civ.raceId).ok) {
          options.push({ kind: "foundCity", label: "Found City" });
        }
        // !tileCountsAsRoad, not !tile.hasRoad (2026-08-19 bugfix): a
        // bridge segment already counts as a road (cities.js's
        // tileCountsAsRoad) without ever setting tile.hasRoad itself, so
        // the raw flag alone let a Pioneer standing on its own finished
        // bridge tile "Build Road Here" redundantly on top of it.
        if (baseUnit.canBuildRoad && !window.GameEngine.cities.tileCountsAsRoad(tile)) {
          options.push({ kind: "buildRoadHere", label: "Build Road Here" });
        }
        // Build Bridge: only offered standing right at the water's edge
        // (same "gains the action once adjacent to water" gating the
        // feature was designed around), opening main.js's tile-placement
        // picker (see startBridgePlacement) to choose WHICH adjacent water
        // tile to build the next segment on -- same one-tile-at-a-time
        // shape as Build Road Here otherwise (cities.js's
        // canBuildBridgeSegment), just needing a picker at all since the
        // target isn't the unit's own tile. cost/affordable (2026-08-19,
        // user-directed): shown on the pill itself via ringmenu.js's
        // generic cost-span support (same red/green-against-stockpile
        // convention as buildlist.js's costTokenHtml) so the player isn't
        // one click away from the sole answer being "Bridge halted — not
        // enough Coin" (see advanceGotoOrder's buildBridge branch).
        if (baseUnit.canBuildRoad && isAdjacentToWater(gameState.map, unit.x, unit.y)) {
          const bridgeCoinCost = window.GameData.getBuilding("bridge_section").coinCost;
          const civStock = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
          options.push({
            kind: "buildBridge", label: "Build Bridge...",
            cost: `${bridgeCoinCost}C`, affordable: civStock.coin >= bridgeCoinCost,
          });
        }
        // Help Build: a Pioneer standing on its own civ's city can throw its
        // turn into whatever that city is currently building, decrementing
        // buildQueue.turnsRemaining one extra time on top of the automatic
        // per-turn countdown (ai.js's progressBuildQueue). Gated on
        // canBuildRoad rather than typeId === "pioneer" for generality, but
        // stays consistent since road-building itself is hardcoded to
        // "pioneer" too (see main.js's handleBuildRoad). Only offered for
        // the power-based cost model (turnsRemaining !== undefined); the
        // legacy coin-accumulation path is unreachable in practice.
        if (baseUnit.canBuildRoad && !unit.usedThisTurn) {
          const homeCity = civ.cities.find((c) => c.x === unit.x && c.y === unit.y);
          if (homeCity && homeCity.buildQueue && homeCity.buildQueue.turnsRemaining !== undefined) {
            options.push({ kind: "helpBuild", label: "Help Build" });
          }
        }
      }

      // Channeled actions -- sidebar.js's channelActions. Same
      // CHANNEL_LABELS/gating as that block. Dwarves also use this shared
      // "mining" channel via the Dwarven Mining OR-bypass below.
      const CHANNEL_LABELS = { delving: "Delving", fishing: "Fishing", hunting: "Hunting", farming: "Farming", mining: "Mining" };
      if (unit.channeling && CHANNEL_LABELS[unit.channeling]) {
        options.push({ kind: "claimChannel", label: "Claim Gathered Resources" });
        options.push({ kind: "cancelChannel", label: `Cancel ${CHANNEL_LABELS[unit.channeling]}`, danger: true });
      } else if (!unit.usedThisTurn && !unit.channeling) {
        // !unit.channeling excludes "restAndDefend" -- see sidebar.js's
        // matching gate for why.
        const onVein = tile.resource === "gold" || tile.resource === "iron";
        const onGame = tile.resource === "game";
        const onFertile = tile.resource === "fertile";
        if (civ.unlockedMechanics && civ.unlockedMechanics.has("dungeon_delve") && tile.isRuin) {
          // Granted free to every race via the Level 0 "ruin_delving" tech;
          // any unit can Delve, not just Wizards.
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
              // Dwarven Mining lets ANY dwarf unit mine, not just
              // canProspect ones -- see techs.js's dwarf_dwarven_mining,
              // layer 1 civic.
              || (civ.raceId === "dwarf" && civ.unlockedMechanics && civ.unlockedMechanics.has("dwarven_mining")))) {
          // Flat-payout shape (turns.js's "mining" channel block). Dwarf's
          // Prospector's Claim/The Deep Mines apply as a yield multiplier on
          // top of this same channel rather than their own separate one.
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

      // Halfellow "Envoy" (2026-08-17, changed from a 2-turn channel to a
      // full-turn action, user-directed): a Pioneer or Wanderer standing on
      // an already-in-radius, unclaimed tile of one of this civ's own
      // cities can claim it outright, on the spot -- same one-shot,
      // resolves-instantly shape as Open Chest just above, not a channel.
      // Gated on envoyTargetAt (ai.js) so the pill only appears once the
      // player has actually moved the unit somewhere eligible, same
      // manual-trigger convention the mining/farming/fishing channels use.
      if (!unit.usedThisTurn && !unit.channeling
          && civ.raceId === "halfellow" && civ.unlockedMechanics && civ.unlockedMechanics.has("envoy")
          && (unit.typeId === "pioneer" || unit.typeId === "wanderer")
          && window.GameEngine.ai.envoyTargetAt(civ, gameState, unit.x, unit.y)) {
        options.push({ kind: "actAsEnvoy", label: "Act as Envoy" });
      }

      // Human "Flight": ONE pill, offered from the WIZARD'S OWN tile rather
      // than by right-clicking the ally directly, since right-clicking an
      // ally who is also a commandable unit of yours always retargets the
      // ring to become THAT unit's own ring first (see mapMenuOptions' own
      // doc comment). Clicking it opens target-selection mode over
      // flightTargets (see main.js's startTargetSelection); ai.js's
      // castFlightOnAlly still re-validates and walks into range itself.
      if (flightTargets(unit, gameState, humanCivId).length) {
        options.push({ kind: "castFlight", label: "Cast Fly" });
      }

      // Carry / Board: Carry from the carrier's ring, Board from the
      // passenger's, both gated by the shared canCarryPassenger predicate
      // (via carryTargets/boardTargets) so they can never disagree.
      if (carryTargets(unit, gameState, humanCivId).length) {
        options.push({ kind: "carryUnit", label: "Carry" });
      }
      if (boardTargets(unit, gameState, humanCivId).length) {
        options.push({ kind: "boardCarrier", label: "Board" });
      }

      // Drop Off: the disembark half of ai.js's operateDragonCarry/
      // operateGalley cargo logic, as a real ring action. Gated on
      // hasOpenDisembarkTile so the pill never appears when there's nowhere
      // to actually put the passenger down (e.g. a Galley boxed in by water
      // on every side). Same "!unit.usedThisTurn" gate as Carry/Board above
      // for consistency, even though the drop itself doesn't consume the
      // turn (see performPlayerDisembark's own doc comment).
      if (!unit.usedThisTurn && unit.carries && window.GameEngine.ai.hasOpenDisembarkTile(civ, unit, gameState)) {
        const label = unit.carries.name || window.GameData.getUnit(unit.carries.typeId).label;
        options.push({ kind: "dropOff", label: `Drop Off ${label}` });
      }

      // Troubadour aura activate/deactivate: an opt-in/opt-out ring action,
      // same shape as Hidden/Garrison below. See turns.js's own gate
      // (civ.isHuman && !troubadour.auraActive) for where this actually
      // takes effect; AI Troubadours are unaffected.
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

      // Elf "Roots of the World" / Human "Teleportation": ONE pill for both
      // (ai.js's performDruidTeleport/performWizardTeleport) -- main.js's
      // handler picks which off the acting unit's own typeId, so there's no
      // need for separate kind strings. A two-stage flow, unlike every other
      // targeted action here: first pick WHO moves (target-selection mode
      // over teleportTargets -- the caster itself or an adjacent ally), then
      // pick WHERE (tile-placement mode, since the destination is an
      // arbitrary explored tile rather than a fixed slot list).
      if (teleportTargets(unit, gameState, humanCivId).length) {
        options.push({
          kind: "teleport",
          label: unit.typeId === "druid" ? "Roots of the World" : "Teleportation",
        });
      }

      // Elf "Nature's Grace": ONE pill over naturesGraceTargets (allied units
      // actually missing HP within the caster's own range). Previously
      // AI-only -- see ai.js's maybeNaturesGrace for that side.
      if (naturesGraceTargets(unit, gameState, humanCivId).length) {
        options.push({ kind: "naturesGrace", label: "Nature's Grace" });
      }

      // Human "Freezing Touch" has no ring option: it's a passive +50%
      // frozen-on-hit chance on the Wizard's ordinary attacks (see ai.js's
      // considerAttackOrGarrison), not a targeted action.

      // Human "Fireball!": a standalone targeted action. Opens tile-placement
      // mode (main.js's startFireballPlacement) over every in-bounds tile
      // within FIREBALL_RANGE -- no visibility requirement, same as
      // Teleportation's "anywhere explored" reach.
      if (unit.typeId === "wizard" && !unit.usedThisTurn && civ.unlockedMechanics?.has("fireball_splash")) {
        options.push({ kind: "fireball", label: "Fireball!" });
      }

      // Dwarf "Bombardment": same standalone tile-placement shape as
      // Fireball! just above -- Bombard's ONLY offensive option (see
      // units.js's noOrdinaryAttack), so this is unconditional on the
      // mechanic being unlocked at all rather than gated behind a second
      // tech the way Fireball is behind Battle Mage -- owning a Bombard
      // already implies dwarf_bombardment is researched.
      if (unit.typeId === "bombard" && !unit.usedThisTurn) {
        options.push({ kind: "bombardment", label: "Bombardment" });
      }

      // Halfellow "Riddle"/"Resource Heist"/"Unlock the Gate": ONE pill each,
      // over their own candidate list. Riddle is the worst of the old
      // pill-per-target offenders -- it's RANGED (scales with Boomerang), so
      // a crowded front line could fill the whole ring by itself.
      if (riddleTargets(unit, gameState, humanCivId).length) {
        options.push({ kind: "riddle", label: "Riddle" });
      }
      if (resourceHeistTargets(unit, gameState, humanCivId).length) {
        options.push({ kind: "resourceHeist", label: "Resource Heist" });
      }
      if (unlockTheGateTargets(unit, gameState, humanCivId).length) {
        options.push({ kind: "unlockTheGate", label: "Unlock the Gate" });
      }

      // Elf "Air Beneath, Eyes Above"/"Shadowsteed": no tile-placement mode
      // needed -- unlike the Wisp's arbitrary swamp destination, Raptor/
      // Shadowsteed always land on an open tile adjacent to the Druid (see
      // ai.js's spawnUnitAdjacentToUnit), so a single click is the whole
      // interaction. Each option only appears while this Druid doesn't
      // already have a live one of that type (ai.js's druidHasLiveSummon --
      // one Raptor, one Shadowsteed, per Druid).
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

      // Elf "Nature's Fury": ONE pill for both directions, same "one kind
      // string, main.js's handler infers direction off the unit's own
      // typeId" shape as Roots of the World/Teleportation above (see
      // ai.js's performDireBearTransform). A Dire Bear otherwise has no
      // ring-menu access to any Druid-only action above -- combat + Revert
      // only, per elf_natures_fury.
      if (!unit.usedThisTurn && civ.unlockedMechanics?.has("natures_fury")
          && (unit.typeId === "druid" || unit.typeId === "dire_bear")) {
        options.push({
          kind: "direBearForm",
          label: unit.typeId === "druid" ? "Become Dire Bear" : "Revert to Druid",
        });
      }

      // Orc "Bog Spirit": same "hand off to main.js's tile-placement mode"
      // shape as Roots of the World above -- the destination is any
      // ever-explored swamp tile, not a fixed slot list, so it needs the
      // same arbitrary-tile picker. Gated on the civ-wide Wisp cap (see
      // ai.js's wispCapReached) so the option simply doesn't appear once
      // every Bog Witch's slot is already spoken for.
      if (unit.typeId === "bog_witch" && !unit.usedThisTurn
          && civ.unlockedMechanics?.has("wisp_summon") && !window.GameEngine.ai.wispCapReached(civ)) {
        options.push({ kind: "summonWisp", label: "Summon Wisp" });
      }

      // Halfellow "Set the Trap": same "tile-placement mode, gated on the
      // civ-wide trap cap" shape as the Wisp above, but the destination is
      // any tile within the Trouble Maker's own short range (see ai.js's
      // TRAP_PLACEMENT_RANGE), not an arbitrary ever-explored tile -- still
      // needs the picker (more than one legal tile) rather than a
      // single-click adjacent-spawn like Raptor/Shadowsteed. Two separate
      // pills, one per flavor, both gated on the SAME shared cap
      // (ai.js's trapCapReached counts both typeIds together) -- picking
      // either one still only ever nets one trap for this cap slot.
      if (unit.typeId === "trouble_maker" && !unit.usedThisTurn
          && civ.unlockedMechanics?.has("trap_summon") && !window.GameEngine.ai.trapCapReached(civ)) {
        options.push({ kind: "setTrap:frost", label: "Set Frost Trap" });
        options.push({ kind: "setTrap:fire", label: "Set Fire Trap" });
      }

      // Halfellow "Banish the Darkness": tile-placement mode (2026-08-24,
      // same shape as Set the Trap just above, range 1 for true 8-neighbor
      // adjacency) -- the player picks which open adjacent tile the Bonfire
      // lands on rather than it landing on a random one (see main.js's
      // startGreatBonfirePlacement). Always offered (no civ-wide cap check
      // like Wisp/traps) since summoning a new Bonfire simply dismisses this
      // civ's old one rather than being blocked by it.
      if (unit.typeId === "wanderer" && !unit.usedThisTurn
          && civ.unlockedMechanics?.has("banish_the_darkness")) {
        options.push({ kind: "createGreatBonfire", label: "Create The Great Bonfire" });
      }

      // Elf "Whirlwind Strike"/"Blade Storm": player-invoked version of the
      // AI's own maybeBladeDancerSweep (ai.js) -- same underlying
      // performBladeSweep, just without the AI's "only if it beats a normal
      // attack" >=2-target heuristic; the player only needs at least one
      // enemy in range to make the pill worth showing. Two separate pills
      // (not one auto-pick-the-bigger-one like the AI) so the player chooses
      // which radius to use.
      if (unit.typeId === "blade_dancer" && !unit.usedThisTurn) {
        if (civ.unlockedMechanics?.has("whirlwind_strike")
            && window.GameEngine.ai.countEnemiesInRadius(civ, unit.x, unit.y, window.GameEngine.ai.WHIRLWIND_STRIKE_RADIUS, gameState) >= 1) {
          options.push({ kind: "whirlwindStrike", label: "Whirlwind Strike" });
        }
        if (civ.unlockedMechanics?.has("blade_storm")
            && window.GameEngine.ai.countEnemiesInRadius(civ, unit.x, unit.y, window.GameEngine.ai.BLADE_STORM_RADIUS, gameState) >= 1) {
          options.push({ kind: "bladeStorm", label: "Blade Storm" });
        }
      }

      // Hidden/stealth -- sidebar.js's stealthActions.
      if (unit.conditions?.hidden) {
        options.push({ kind: "cancelHidden", label: "Cancel Hidden" });
      } else if (!unit.usedThisTurn && window.GameEngine.combat.canGoHidden(unit, civ, gameState.civs)) {
        options.push({ kind: "goHidden", label: "Go Hidden" });
      }

      // Goto order -- see sidebar.js's own stopOrderBtn for the equivalent
      // sidebar button.
      if (unit.gotoTarget) options.push({ kind: "stopOrder", label: "Stop Order", danger: true });

      // Sentry: a standing order that does nothing until an enemy comes
      // within range, then attacks it, without ever asking the player for a
      // fresh order in the meantime (see isSpent above and
      // advanceSentryOrder below, run every turn from turns.js's
      // finishCivTurn). Only offered to units that could actually attack
      // something -- a unit with no attack stat standing Sentry would never
      // have anything to react to.
      if (unit.sentry) {
        options.push({ kind: "cancelSentry", label: "Cancel Sentry", danger: true });
      } else if (!unit.usedThisTurn && !unit.channeling && baseUnit.attack > 0) {
        options.push({ kind: "sentry", label: "Sentry" });
      }

      // Follow: a standing order to move toward and stay adjacent to a
      // chosen allied unit every turn (see advanceFollowOrder below). The
      // target can be ANY allied unit anywhere on the map, not a small fixed
      // set of adjacent candidates (unlike Cast Fly/Carry above), so this
      // hands off to main.js's tile-placement mode -- same mechanism Roots
      // of the World/Teleportation use for an arbitrary destination, just
      // with the "slots" being wherever this civ's OTHER units currently
      // stand instead of empty terrain.
      if (unit.followTarget) {
        options.push({ kind: "cancelFollow", label: "Cancel Follow", danger: true });
      } else if (!unit.usedThisTurn && !unit.channeling && civ.units.some((u) => u !== unit && !u.carriedBy)) {
        options.push({ kind: "follow", label: "Follow..." });
      }

      // Enter Cave (2026-08-19, user-directed): a full turn action, any
      // unit, any race -- caves are a universal terrain feature (see
      // worldgen.js's placeCaves), not tech- or race-gated like Deep Gate.
      // No destination picker needed: unlike Roots of the World/
      // Teleportation/Deep Gate, a cave only ever leads to its ONE linked
      // partner (tile.caveLinkX/Y), so there's nothing to choose. See
      // performEnterCave below (this file) and main.js's handleEnterCave.
      if (!unit.usedThisTurn && tile.isCave) {
        options.push({ kind: "enterCave", label: "Enter Cave" });
      }

      // Rest and Defend: one pill, both effects (heal via unit.resting, x2
      // defense via the "defending" condition) apply together, and persist
      // automatically every turn until cancelled or superseded by another
      // order (2026-08-19, user-directed merge with the old separate
      // Garrison action -- Garrison used to be the only one of the two that
      // stood indefinitely, and required standing in a city to start; now
      // Rest and Defend does the standing-indefinitely part everywhere, and
      // additionally picks up a city's own defensive bonuses while standing
      // in one of this civ's cities -- see cities.js's tickCity and ai.js's
      // tickWallDefense/tickMageTowerDefense). See main.js's
      // handleRestAndDefend/handleCancelRestAndDefend. overlays.js's
      // drawConditionBadges skips the resting icon whenever "defending" is
      // also active so this shows exactly one badge, not two.
      if (unit.channeling === "restAndDefend") {
        options.push({ kind: "cancelRestAndDefend", label: "Cancel Rest and Defend", danger: true });
      } else if (!unit.usedThisTurn) {
        options.push({ kind: "restAndDefend", label: "Rest and Defend" });
      }
      // Automate Actions -- sidebar.js's automateBtn. Same underlying
      // unit.automated flag/handler for every unit type -- Dire Wolf just
      // gets wolf-appropriate wording ("Hunt for Prey", triggering "hunt
      // automation"), since runAutomatedUnitTurn's cascade for a Dire Wolf
      // is in practice almost entirely maybeDireWolfHunt (see ai.js).
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
    // range. Falls THROUGH to the move options below when it isn't: "Move to
    // This Tile" against an occupied tile paths to the closest reachable
    // approach (see pathfinding.js), which reads correctly as "advance on
    // it" rather than opening nothing at all.
    // Dwarf "Bombardment": Bombard has no ordinary attack at all (see
    // units.js's noOrdinaryAttack) -- skip this branch entirely so a click
    // on an in-range enemy never offers a normal "Attack" pill; its only
    // offense is the Bombardment pill below.
    const target = baseUnit.noOrdinaryAttack ? null : attackTargetAt(unit, gameState, x, y, humanCivId);
    if (target) {
      const preview = previewOrder(unit, gameState, x, y, humanCivId);
      if (preview.kind === "attack") {
        options.push({ kind: "attack", label: "Attack" });
        return options;
      }
    }

    // Found City Here: offered on a remote tile whenever the site is valid.
    if (baseUnit.canFoundCity && !unit.usedThisTurn
        && window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, x, y, civ.raceId).ok) {
      options.push({ kind: "foundCityHere", label: "Found City Here" });
    }

    options.push({ kind: "moveTo", label: "Move to This Tile" });
    // !tileCountsAsRoad, not !tile.hasRoad -- see buildRoadHere's own
    // comment above (onOwnTile branch) for why.
    if (baseUnit.canBuildRoad && !window.GameEngine.cities.tileCountsAsRoad(tile)) {
      options.push({ kind: "buildRoadTo", label: "Build Road to This Tile" });
    }
    return options;
  }

  /**
   * What one of the player's own cities offers the ring. Categories, not a
   * build list: a build option carries a label, per-resource cost tokens
   * coloured against the stockpile, a turn count and a placement marker,
   * and a dozen of those arranged radially would be unreadable. "Build
   * Unit"/"Build Structure" open the real list as a sub-page instead (see
   * js/ui/ringmenu.js's popover).
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
      // "Expedite Unit Build" -- the Human Bazaar's city action (see
      // cities.js's applyExpediteBuild). Offered only where it can actually
      // do something: canExpediteBuild covers the Bazaar, the unit-only
      // scope and the ">1 turn left" floor, expediteBuildCost prices it, and
      // the stockpile check below matches Spread Culture's own convention of
      // hiding a pill the civ can't pay for rather than offering a dead one.
      const expediteCost = !cities.isExpeditingBuild(city, gameState)
        ? cities.expediteBuildCost(city, civ) : null;
      if (expediteCost && Object.entries(expediteCost)
          .every(([k, v]) => ((civ.stockpile && civ.stockpile[k]) || 0) >= v)) {
        const expediteLabel = Object.entries(expediteCost)
          .map(([k, v]) => `${Math.ceil(v)}${k[0].toUpperCase()}`).join(" ");
        options.push({ kind: "city:expediteBuild", label: `Expedite Unit Build (-1 turn, -${expediteLabel})` });
      }
      options.push({ kind: "city:cancelBuild", label: "Cancel Build", danger: true });
    } else if (!cities.isProducingResources(city, gameState)) {
      const builds = window.GameEngine.ai.availableBuilds(civ, city, gameState);
      if (builds.some((o) => o.kind === "unit")) options.push({ kind: "city:buildUnit", label: "Build Unit" });
      const buildingOptions = builds.filter((o) => o.kind === "building");
      if (buildingOptions.length) {
        // Count excludes walls -- a city can
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
      // `amounts` is still computed and still gates whether this pill is
      // offered at all (a freshly founded city with nothing to take a share
      // of yet gets no pill), just not printed into the label text.
      if (amounts) options.push({ kind: "city:resourceProduction", label: "Gather More Resources" });

      // "Research Tech": the fourth thing this city's
      // production can go into, alongside a unit/building/resources -- see
      // cities.js's applyResearchBoost. Only offered when there's actually
      // something in progress to accelerate AND the civ can afford the
      // stockpile cost on top of the turn (see researchBoostCost) -- same
      // affordability gate Spread Culture's own pill uses just below.
      if (civ.currentResearch) {
        const turns = cities.researchBoostAmount(city);
        const researchCost = cities.researchBoostCost(city);
        const canAffordResearch = Object.entries(researchCost)
          .every(([k, v]) => ((civ.stockpile && civ.stockpile[k]) || 0) >= v);
        if (canAffordResearch) {
          const researchCostLabel = Object.entries(researchCost)
            .map(([k, v]) => `${Math.ceil(v)}${k[0].toUpperCase()}`).join(" ");
          options.push({
            kind: "city:research",
            label: `Research Tech (-${turns} turn${turns === 1 ? "" : "s"}, -${researchCostLabel})`,
          });
        }
      }
    }

    // "Spread Culture": a paid, one-turn boost
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

    // "Automate City": hands this city's
    // turn-by-turn culture/gather/research decision to the engine until the
    // player turns it back off -- see cities.js's runCityAutomation. Never
    // builds anything, so it's offered unconditionally, including while a
    // build is queued (the automation itself defers to a queued build; see
    // cityAutomationChoice's productionFree check). Same wording convention
    // as the unit-side "Automate Actions"/"Stop Automating" pair.
    if (city.automated) {
      const doing = cities.cityAutomationChoice(civ, city, gameState);
      const doingLabel = doing === "culture" ? "Culture"
        : doing === "resources" ? "Gathering"
        : doing === "research" ? "Research Tech" : "Idle";
      options.push({ kind: "city:toggleAutomate", label: `Stop Automating (${doingLabel})` });
    } else {
      options.push({ kind: "city:toggleAutomate", label: "Automate City" });
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
   * MERGED RING: unit actions land in the LEFT column, city actions in the
   * RIGHT, in one ring rather than a "City Actions" pill drilling down into
   * a second one. `split` is consumed directly by js/ui/ringmenu.js's
   * layout() as `ctx.split` -- see its own doc comment for why an explicit
   * {leftCount, rightCount} bypasses that function's normal auto-fit column
   * assignment.
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
   * THE ONE ENTRY POINT the ring menu asks. Keeps input.js's "decide WHERE,
   * not WHAT" split intact: input.js reports a tile, this decides whose
   * menu that tile opens and what's on it.
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
    // MERGED RING: when that tile is ALSO one of this civ's own cities, the
    // ring shows unit actions and city actions together (unit actions left,
    // city actions right) instead of a single "City Actions" pill that
    // drills down into a separate city-only ring. See mergeUnitCityOptions
    // below for the split main.js's ringmenu.js render reads.
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
   * accumulates progress against coinCost each turn instead. Every unit and
   * building currently uses the modern (power-based) model via its
   * unlocking tech's costBreakdown (see GameData.unitBuildCost/
   * buildingBuildCost); the legacy branch stays as a defensive fallback
   * (see buildings.js's _TECH_FOR_BUILDING doc comment).
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
        // The price actually paid, kept for "Expedite Unit Build" to take a
        // per-turn share of -- see cities.js's expediteBuildCost and the
        // matching stamp in ai.js's maybeBuildInCities.
        cost: { ...option.cost },
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
    startBridgeOrder,
    advanceGotoOrder,
    stopGotoOrder,
    isAdjacentToWater,
    advanceSentryOrder,
    advanceFollowOrder,
    performRestAndDefend,
    performEnterCave,
    plannedPath,
    contextMenuOptions,
    canCarryPassenger,
    performCarry,
    // Targeted-action candidate lists -- see their own section comment.
    attackTargets,
    flightTargets,
    teleportTargets,
    naturesGraceTargets,
    carryTargets,
    boardTargets,
    riddleTargets,
    resourceHeistTargets,
    unlockTheGateTargets,
    cityRingOptions,
    mergeUnitCityOptions,
    mapMenuOptions,
    queueBuild,
    cancelBuild,
  };
})();
