/**
 * TURN LOOP ENGINE
 * ----------------
 * Orchestrates a full turn: refresh visibility, resolve influence/
 * ownership, tick cities (growth/yield/upkeep), tick research, run AI
 * civs, heal units, advance turn counter. See ai_behavior_design.md §5
 * for the per-civ turn-loop spec this generalizes to the whole game turn.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  // Pacing experiment (2026-07-12): 0.33 (original) -> 0.25 (too far --
  // 20/20 territory, 0 elimination) -> 0.33 (restored) -> now 0.30, a
  // deliberate middle point between "territory wins everything" and
  // "elimination is the only real path" -- influence/territory and
  // military/elimination are meant to be two genuinely opposite, equally
  // viable win conditions (Halfellow-style economy vs. Orc-style conquest),
  // not one dominant path with the other as a rare fallback. See
  // project_pacing_experiment memory.
  const VICTORY_SHARE_THRESHOLD = window.GameConfig.victory.shareThreshold;
  const VICTORY_SUSTAIN_TURNS = window.GameConfig.victory.sustainTurns;

  /** Computes each civ's currently-visible tile set (own territory + vision radius around units/cities) */
  function refreshVisibility(gameState) {
    const { map, civs } = gameState;
    gameState.visibility = gameState.visibility || {};
    // Persistent per-civ memory: `explored` only ever grows (never forgets a
    // tile once seen); `tileMemory` snapshots each explored tile's static
    // appearance (terrain/road/river/resource/ruin + whatever city/structure
    // sat on it) at the moment it was LAST actually visible. Units are
    // deliberately never snapshotted -- a remembered tile shows the terrain
    // and structures as last observed, never units, matching how AI vision
    // already treats "new developments" as requiring current sight.
    gameState.explored = gameState.explored || {};
    gameState.tileMemory = gameState.tileMemory || {};

    // One-time idx -> occupant lookup for this round's snapshot writes.
    const cityAt = new Map();
    const structureAt = new Map();
    for (const c of Object.values(civs)) {
      for (const city of c.cities) {
        cityAt.set(city.y * map.width + city.x, {
          raceId: c.raceId, population: Math.floor(city.population), isPort: !!city.isPort,
        });
        for (const s of city.structures) {
          structureAt.set(s.y * map.width + s.x, { id: s.id, raceId: c.raceId });
        }
      }
    }

    for (const civ of Object.values(civs)) {
      const visible = new Set();
      for (const city of civ.cities) {
        // Elf "Aelderwatch"/Treetop Watch: +vision radius for the specific
        // city it's built adjacent to -- see cities.js's tickCity/
        // computeStructureEffects.
        const r = city.influenceRadius + 3 + (city.structureVisionBonus || 0);
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const x = city.x + dx, y = city.y + dy;
          if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
          visible.add(y * map.width + x);
        }
      }
      for (const unit of civ.units) {
        const baseUnit = window.GameData.getUnit(unit.typeId);
        // Tech can raise a unit type's vision via unit_stat_upgrade (additive,
        // same convention as attack/defense/movement -- see tech.js).
        const overrideVision = civ.unitOverrides?.[unit.typeId]?.visionRadius || 0;
        // Human "Flight": a unit granted temporary flight also gets +2 vision
        // for the duration (see ai.js's performWizardGrantFlight).
        const flightVision = unit.conditions?.flying?.visionBonus || 0;
        // Halfellow "Keep an Eye Out": +3 vision while holding a lookout
        // post (Hidden + stationary) -- see ai.js's maybeKeepAnEyeOutPlay.
        const watchVision = unit.conditions?.keepingWatch?.visionBonus || 0;
        // Level-up "+1 Vision" pick (2026-08-07, user-directed) -- same flat-
        // add convention as attack/defense, see combat.js's LEVEL_BONUS_VALUES.
        const levelVision = unit.levelBonuses?.visionRadius || 0;
        const r = (baseUnit.visionRadius || 3) + overrideVision + flightVision + watchVision + levelVision;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const x = unit.x + dx, y = unit.y + dy;
          if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
          visible.add(y * map.width + x);
        }
      }
      // Also always-visible: tiles this civ currently owns (per AI behavior
      // doc §1) -- and, with Dwarf "Mountains on the Horizon," every single
      // Mountain tile on the entire map, full stop, no fog of war on
      // Mountains at all once researched (not just ones near a city/unit).
      // Elf "Wind From Distant Treetops" is the same mechanic, keyed to
      // Forest instead of Mountains.
      const revealMountains = civ.unlockedMechanics && civ.unlockedMechanics.has("mountains_on_the_horizon");
      const revealForest = civ.unlockedMechanics && civ.unlockedMechanics.has("wind_from_distant_treetops");
      // Human "Sea Charts" (2026-08-06, user-directed): same reveal-mechanic
      // shape as Mountains on the Horizon/Wind From Distant Treetops just
      // above, keyed to Ocean and Coast instead of a land terrain.
      const revealSea = civ.unlockedMechanics && civ.unlockedMechanics.has("sea_charts");
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i].ownerCivId === civ.id
            || (revealMountains && map.tiles[i].terrain === "mountains")
            || (revealForest && map.tiles[i].terrain === "forest")
            || (revealSea && (map.tiles[i].terrain === "ocean" || map.tiles[i].terrain === "coast"))) visible.add(i);
      }
      // Mountains on the Horizon (2026-07-18, user-directed): also reveals
      // any Hills tile immediately adjacent (8-neighbor) to a Mountain tile
      // -- the foothills leading up to a peak are visible from the peak
      // itself, same reasoning as the Mountain reveal above. Separate pass
      // (not folded into the loop above) since it needs each Hills tile's
      // neighbors, not just its own terrain.
      if (revealMountains) {
        for (let i = 0; i < map.tiles.length; i++) {
          if (map.tiles[i].terrain !== "hills" || visible.has(i)) continue;
          const x = i % map.width, y = Math.floor(i / map.width);
          for (let dy = -1; dy <= 1 && !visible.has(i); dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
              if (map.tiles[ny * map.width + nx].terrain === "mountains") { visible.add(i); break; }
            }
          }
        }
      }
      gameState.visibility[civ.id] = visible;

      const explored = gameState.explored[civ.id] || new Set();
      const memory = gameState.tileMemory[civ.id] || {};
      for (const idx of visible) {
        explored.add(idx);
        const tile = map.tiles[idx];
        // Tile city score: how good this tile would be to found a city on,
        // for THIS civ specifically (terrain yield, resource, ruin, river,
        // coastal, race/tech terrain affinity -- see ai.js's
        // computeTileCityScore, also used live by findBestSettleSite). Only
        // recomputed while the tile is actually visible, same as everything
        // else in this snapshot -- a civ's idea of a tile's value can go
        // stale (e.g. after unlocking a new terrain-bonus tech) until it's
        // observed again, matching how a human player's own memory would work.
        // null for water (never a legal city site).
        const rawCityScore = window.GameEngine.ai.computeTileCityScore(civ, gameState, idx % map.width, Math.floor(idx / map.width));
        memory[idx] = {
          terrain: tile.terrain,
          hasRoad: !!tile.hasRoad,
          hasRiver: {
            n: !!tile.hasRiver?.n, s: !!tile.hasRiver?.s,
            e: !!tile.hasRiver?.e, w: !!tile.hasRiver?.w,
          },
          resource: tile.resource || null,
          isRuin: !!tile.isRuin,
          city: cityAt.get(idx) || null,
          structure: structureAt.get(idx) || null,
          cityScore: Number.isFinite(rawCityScore) ? Math.round(rawCityScore * 10) / 10 : null,
          turnNumber: gameState.turnNumber || 0,
        };
      }
      gameState.explored[civ.id] = explored;
      gameState.tileMemory[civ.id] = memory;
    }
  }

  /**
   * Dungeon Delve (Human Wizard): instantly reverts every tile in `unit`'s
   * filled-offset set (relative to (centerX, centerY), its last-known delve
   * position) back to neutral if this civ still owns it -- mirrors
   * destroyCity's/eliminateCiv's immediate tile reset elsewhere in this file,
   * since resolveOwnership's per-turn decay only winds an "owned" tile down
   * if it's already "contested"; a tile that abruptly gets zero fresh
   * influence (exactly what happens the instant a delve claim ends) has no
   * decay path at all and would otherwise stay "owned" forever. A rival's own
   * claim on a tile within this radius is left alone.
   */
  function clearDelveOwnership(unit, civ, map, centerX, centerY) {
    const filled = unit._delveFilledOffsets;
    if (!filled || centerX == null || centerY == null) return;
    for (const key of filled) {
      const [dx, dy] = key.split(",").map(Number);
      const tx = centerX + dx, ty = centerY + dy;
      if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
      const tile = map.tiles[ty * map.width + tx];
      if (tile.ownerCivId !== civ.id) continue;
      tile.ownerCivId = null;
      tile.status = "neutral";
      tile.contestedTurns = 0;
    }
  }

  /** Dwarf "Prospector's Claim"/"The Deep Mines": same shape as
   *  clearDelveOwnership above, for a unit's own _claimFilledOffsets. */
  function clearClaimOwnership(unit, civ, map, centerX, centerY) {
    const filled = unit._claimFilledOffsets;
    if (!filled || centerX == null || centerY == null) return;
    for (const key of filled) {
      const [dx, dy] = key.split(",").map(Number);
      const tx = centerX + dx, ty = centerY + dy;
      if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
      const tile = map.tiles[ty * map.width + tx];
      if (tile.ownerCivId !== civ.id) continue;
      tile.ownerCivId = null;
      tile.status = "neutral";
      tile.contestedTurns = 0;
    }
  }

  // Resource exhaustion (2026-07-20, user-directed): each turn a Dungeon
  // Delve Wizard or Prospector's Claim unit actively works its anchor tile,
  // there's a flat chance the Ruin/Gold Vein runs out and is permanently
  // removed from the map -- see beginRound's ritual-tracking loop below.
  // Deliberately NOT applied to Dark Ritual (Undead), which the user didn't
  // include in this request.
  const RESOURCE_EXHAUSTION_CHANCE = window.GameConfig.world.resourceExhaustionChance;

  /**
   * RESOURCE RESPAWN (2026-08-06, user-directed)
   * --------------------------------------------
   * A depleted resource (Game, Fish, Iron, Gold, Fertile Soil) reappears
   * somewhere else on the map within the next 3 turns, so the world doesn't
   * strictly drain toward zero over a long game. Ruins are deliberately
   * EXCLUDED -- they're one-shot map features, not a renewable resource
   * (see the isDelveWizard branch in beginRound, which doesn't call this).
   *
   * Queued rather than placed immediately: gameState.pendingResourceRespawns
   * is a list of { resourceId, dueTurn } processed once per round by
   * processResourceRespawns below. A plain array of plain objects, so it
   * survives savegame.js's JSON round-trip with no special handling.
   */
  const RESPAWN_MIN_DELAY = 1;
  const RESPAWN_MAX_DELAY = 3;

  function scheduleResourceRespawn(gameState, resourceId) {
    if (!resourceId) return;
    const delay = RESPAWN_MIN_DELAY + Math.floor(Math.random() * (RESPAWN_MAX_DELAY - RESPAWN_MIN_DELAY + 1));
    gameState.pendingResourceRespawns = gameState.pendingResourceRespawns || [];
    gameState.pendingResourceRespawns.push({
      resourceId,
      dueTurn: (gameState.turnNumber || 0) + delay,
    });
  }

  /**
   * Places every respawn whose dueTurn has arrived, on a random tile that's
   * valid terrain for that resource and doesn't already hold one. Called
   * once per round from beginRound.
   *
   * A respawn with no legal tile left anywhere is DROPPED rather than
   * retried forever -- the only way that happens is a map with every valid
   * tile for that resource type already occupied, in which case the world
   * isn't short of it and re-queuing would just spin every round.
   */
  function processResourceRespawns(gameState) {
    const pending = gameState.pendingResourceRespawns;
    if (!pending || !pending.length) return;
    const turnNumber = gameState.turnNumber || 0;
    const { map } = gameState;
    const stillPending = [];

    for (const entry of pending) {
      if (entry.dueTurn > turnNumber) { stillPending.push(entry); continue; }
      const record = window.GameData.RESOURCES[entry.resourceId];
      if (!record) continue; // unknown id (e.g. a save from a build where it existed) -- drop it
      const candidates = [];
      for (const tile of map.tiles) {
        if (tile.resource) continue;
        if (!record.validTerrain.includes(tile.terrain)) continue;
        candidates.push(tile);
      }
      if (!candidates.length) continue; // nowhere legal left -- see doc comment
      candidates[Math.floor(Math.random() * candidates.length)].resource = entry.resourceId;
    }

    gameState.pendingResourceRespawns = stillPending;
  }

  /**
   * Prospecting/delving/fishing payout redesign (2026-07-24, user-directed):
   * instead of paying out straight to civ.resources every qualifying turn,
   * each turn's gain accumulates into unit._channelStash -- delivered to the
   * civ only when the channel ends on its OWN terms (voluntary stop, see
   * ai.js's maybeCashOutChannel, or natural exhaustion, handled right where
   * RESOURCE_EXHAUSTION_CHANCE fires below). A FORCED interruption (the unit
   * dies, moves away without stopping properly, or a Halfellow Trouble Maker
   * uses Resource Heist on it) loses whatever's accumulated -- see the
   * `!continuingRitual` cleanup below, which clears _channelStash without
   * calling this. Gives Resource Heist something real to steal: a claim
   * held for a while has real accumulated value sitting on the unit, not
   * just a counter.
   */
  function accumulateChannelStash(unit, gains) {
    const stash = unit._channelStash || { harvest: 0, coin: 0, lore: 0 };
    stash.harvest += gains.harvest || 0;
    stash.coin += gains.coin || 0;
    stash.lore += gains.lore || 0;
    unit._channelStash = stash;
  }

  /** Delivers unit._channelStash straight to civ.stockpile (NOT
   *  civ.resources) and clears it -- the "cash out" moment, called on a
   *  natural channel end (voluntary stop or exhaustion) only. Deliberately
   *  targets stockpile directly: civ.resources gets rebuilt from scratch at
   *  the top of every beginCivTurn and swept into stockpile before any unit
   *  acts (see the "Running stockpile" section below), so a call arriving
   *  DURING a unit's turn (ai.js's maybeCashOutChannel, or a Trouble
   *  Maker's Resource Heist) is already too late to land in civ.resources
   *  this turn -- it would just be silently overwritten next turn and
   *  never actually banked. Stockpile has no such reset, so it's timing-
   *  safe regardless of when this is called. No-op (and no floating text)
   *  if the stash is empty, e.g. a channel that exhausts on the very turn
   *  it starts, before ever reaching its first payout turn. */
  function bankChannelStash(unit, civ) {
    const stash = unit._channelStash;
    delete unit._channelStash;
    if (!stash) return;
    const { harvest = 0, coin = 0, lore = 0 } = stash;
    if (!harvest && !coin && !lore) return;
    civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    civ.stockpile.harvest += harvest;
    civ.stockpile.coin += coin;
    civ.stockpile.lore += lore;
    window.GameEngine.floatingText.spawnResourceGain(unit, { harvest, coin, lore });
  }

  /**
   * Once-per-round setup, run before any civ takes its turn: refresh vision,
   * advance Dark Ritual/Dungeon Delve tracking, and resolve this round's
   * influence/ownership map. Shared by the full-round `runTurn` and the
   * granular `advanceOneUnitStep` (called once at the start of a round,
   * whichever entry point is driving it).
   */
  function beginRound(gameState) {
    const { map, civs } = gameState;

    refreshVisibility(gameState);

    // Resource respawn (2026-08-06, user-directed): places anything queued
    // by a depletion 1-3 turns ago -- see scheduleResourceRespawn.
    processResourceRespawns(gameState);

    // Dark Ritual (Undead) / Dungeon Delve (Human Wizard) / Prospector's Claim
    // (Dwarf, any unit, gold veins): track consecutive turns a qualifying
    // unit has stood still on its anchor tile, evaluated BEFORE this turn's
    // influence computation so it reflects standing time as of the end of
    // last turn's movement.
    for (const civ of Object.values(civs)) {
      if (civ.eliminated) continue;
      const hasDarkRitual = civ.unlockedMechanics && civ.unlockedMechanics.has("dark_ritual");
      const hasDungeonDelve = civ.unlockedMechanics && civ.unlockedMechanics.has("dungeon_delve");
      const hasProspectorsClaim = civ.unlockedMechanics && civ.unlockedMechanics.has("prospectors_claim");
      if (!hasDarkRitual && !hasDungeonDelve && !hasProspectorsClaim) continue;

      // Dungeon Delve / Prospector's Claim: catch a unit that died (in combat,
      // disbanded, starved -- any cause) since last round, not just one that
      // moved. It's already gone from civ.units by now, so the loop below
      // would never visit it again to clean up. civ._trackedDelveWizards/
      // _trackedClaimUnits hold onto the object REFERENCE specifically so its
      // last-known position/filled-offsets are still readable here even after
      // removal from the civ's live unit list (removing an object from an
      // array doesn't erase the object itself, as long as something else
      // still points to it).
      if (hasDungeonDelve && civ._trackedDelveWizards) {
        civ._trackedDelveWizards = civ._trackedDelveWizards.filter((u) => {
          if (civ.units.includes(u)) return true;
          clearDelveOwnership(u, civ, map, u._lastRitualX, u._lastRitualY);
          return false;
        });
      }
      if (hasProspectorsClaim && civ._trackedClaimUnits) {
        civ._trackedClaimUnits = civ._trackedClaimUnits.filter((u) => {
          if (civ.units.includes(u)) return true;
          clearClaimOwnership(u, civ, map, u._lastRitualX, u._lastRitualY);
          return false;
        });
      }

      for (const unit of civ.units) {
        // Dark Ritual applies to any unit; Dungeon Delve is Wizard-specific;
        // Prospector's Claim applies to any Dwarf unit (its own tech text:
        // "Any dwarven unit stationed...").
        const isDelveWizard = hasDungeonDelve && unit.typeId === "wizard";
        const isClaimUnit = hasProspectorsClaim;
        const qualifies = hasDarkRitual || isDelveWizard || isClaimUnit;
        const oldX = unit._lastRitualX, oldY = unit._lastRitualY;
        if (isDelveWizard) {
          civ._trackedDelveWizards = civ._trackedDelveWizards || [];
          if (!civ._trackedDelveWizards.includes(unit)) civ._trackedDelveWizards.push(unit);
        }
        if (isClaimUnit) {
          civ._trackedClaimUnits = civ._trackedClaimUnits || [];
          if (!civ._trackedClaimUnits.includes(unit)) civ._trackedClaimUnits.push(unit);
        }
        if (!qualifies) {
          unit._ritualTurns = 0;
          // Moving off the anchor tile (or no longer qualifying at all)
          // instantly wipes out everything it was claiming/generating -- see
          // clearDelveOwnership/clearClaimOwnership and computeInfluenceMap's
          // use of _delveFilledOffsets/_claimFilledOffsets (unlike a city's
          // filledOffsets, which is permanent once earned).
          if (isDelveWizard) {
            clearDelveOwnership(unit, civ, map, oldX, oldY);
            delete unit._delveFilledOffsets;
            unit._delveFillProgress = 0;
            if (unit.channeling === "delving") unit.channeling = null;
          }
          if (isClaimUnit) {
            clearClaimOwnership(unit, civ, map, oldX, oldY);
            delete unit._claimFilledOffsets;
            unit._claimFillProgress = 0;
            if (unit.channeling === "prospecting") unit.channeling = null;
          }
          continue;
        }
        const tile = map.tiles[unit.y * map.width + unit.x];
        const onRuin = !!(tile && tile.isRuin);
        // Prospector's Claim/The Deep Mines (2026-07-21, user-directed):
        // Iron Veins qualify as an anchor exactly like Gold Veins, just at a
        // different payout -- see the resource-specific yield table in
        // beginCivTurn below.
        const onGoldVein = !!(tile && tile.resource === "gold");
        const onIronVein = !!(tile && tile.resource === "iron");
        // Channeled action (2026-07-21, user-directed): Prospector's
        // Claim/Dungeon Delve now require an EXPLICITLY started channel
        // (unit.channeling, set by performStartChannel below -- either the
        // player's own "Start Prospecting"/"Start Delving" action or the
        // AI's equivalent decision in maybeProspectorsClaimPlay/
        // maybeDungeonDelvePlay), not just "happens to be standing on the
        // tile." Dark Ritual (Undead) keeps its old always-on-Ruin
        // behavior, unaffected -- out of scope for this request, same as
        // RESOURCE_EXHAUSTION_CHANCE's own scope above.
        let onAnchor;
        if (isClaimUnit) onAnchor = (onGoldVein || onIronVein) && unit.channeling === "prospecting";
        else if (isDelveWizard) onAnchor = onRuin && unit.channeling === "delving";
        else onAnchor = onRuin;

        // Resource exhaustion (see RESOURCE_EXHAUSTION_CHANCE above):
        // clearing the tile flag and forcing onAnchor false HERE, before the
        // ownership/_ritualTurns bookkeeping below, makes exhaustion fall
        // through the exact same "no longer on anchor" cleanup path as
        // moving away or dying -- no separate cleanup logic needed.
        if ((isDelveWizard || isClaimUnit) && onAnchor && Math.random() < RESOURCE_EXHAUSTION_CHANCE) {
          if (isDelveWizard) {
            tile.isRuin = false;
          } else {
            // Respawn (2026-08-06, user-directed) -- a Ruin never respawns
            // (explicitly out of scope), but a depleted Gold/Iron Vein
            // reappears elsewhere within a few turns. See
            // scheduleResourceRespawn/processResourceRespawns.
            scheduleResourceRespawn(gameState, tile.resource);
            tile.resource = null;
          }
          window.GameEngine.floatingText.spawnFloatingText(
            unit, isDelveWizard ? "Ruin Exhausted!" : "Vein Exhausted!", "warning");
          onAnchor = false;
          unit.channeling = null;
          // Natural end -- bank whatever accumulated before exhaustion hit,
          // same as a voluntary stop. See bankChannelStash's doc comment.
          bankChannelStash(unit, civ);
        }

        const stayedPut = unit.x === oldX && unit.y === oldY;
        const continuingRitual = onAnchor && stayedPut;
        unit._ritualTurns = onAnchor ? (stayedPut ? (unit._ritualTurns || 0) + 1 : 1) : 0;
        if (isDelveWizard && !continuingRitual) {
          clearDelveOwnership(unit, civ, map, oldX, oldY);
          delete unit._delveFilledOffsets;
          unit._delveFillProgress = 0;
          if (unit.channeling === "delving") unit.channeling = null;
          // Forced interruption (died, moved off, or Resource Heist already
          // handled its own transfer) -- whatever's left in the stash is
          // simply lost, same as the territorial claim above. Already
          // delivered above if exhaustion was the actual cause.
          delete unit._channelStash;
        }
        if (isClaimUnit && !continuingRitual) {
          clearClaimOwnership(unit, civ, map, oldX, oldY);
          delete unit._claimFilledOffsets;
          unit._claimFillProgress = 0;
          if (unit.channeling === "prospecting") unit.channeling = null;
          delete unit._channelStash;
        }
        unit._lastRitualX = unit.x;
        unit._lastRitualY = unit.y;
      }
    }

    const influenceMap = window.GameEngine.influence.computeInfluenceMap(gameState);
    window.GameEngine.influence.resolveOwnership(gameState, influenceMap);
  }

  /** True if (x,y) is Coast, Ocean, or carries the river feature -- the
   *  Burning condition's own exemption (2026-07-22, user-directed): nearby
   *  water smothers the fire, so no damage is dealt this turn while
   *  standing there (the condition's own countdown to expiry is
   *  unaffected -- only the damage tick is skipped). */
  function isBurningExempt(map, x, y) {
    const tile = map.tiles[y * map.width + x];
    if (!tile) return false;
    if (window.GameData.TERRAIN[tile.terrain].isWater) return true;
    const r = tile.hasRiver;
    return !!(r && (r.n || r.s || r.e || r.w));
  }

  /**
   * Burning (2026-07-22, user-directed): 1 point of damage at the start of
   * the affected unit/building/wall's turn, for 3 turns (see ai.js's
   * BURN_DURATION for where it's actually applied -- "Burn It All Down"
   * and the reworked "Fireball!"), unless the target is currently on
   * Coast, Ocean, or a river tile (see isBurningExempt above). Ticked here
   * -- once per civ-turn, uniformly for EVERY civ, human or AI -- rather
   * than in ai.js's beginAITurn/tickConditions pass, which only ever runs
   * for AI-controlled civs (see beginCivTurn's own AI-only branch further
   * below): Burning must still hurt a human player's own units/buildings.
   *
   * Units store it as unit.conditions.burning (so it shows the same fire
   * badge as every other condition -- see render.js's CONDITION_ICONS);
   * structures (buildings/walls, which have no `.conditions` container of
   * their own) store it as a plain `.burning` field directly. Deliberately
   * does NOT affect cities themselves (2026-07-22, user-directed) -- only
   * units and the buildings/walls standing in their radius.
   */
  function tickBurningDamage(gameState, civ) {
    const { map } = gameState;
    const turnNumber = gameState.turnNumber || 0;
    // Strict `>` (not the generic tickConditions/setCondition convention's
    // `>=`): Burning's expiresAtTurn is stamped at application time as
    // "current turn + BURN_DURATION" (see ai.js's applyBurning), and the
    // whole point is exactly BURN_DURATION discrete damage TICKS, not just
    // "gone once this many turns have passed" the way a continuous
    // modifier like Frozen works. `>=` would silently eat the last tick.

    for (const unit of civ.units) {
      const burn = unit.conditions && unit.conditions.burning;
      if (!burn) continue;
      if (turnNumber > burn.expiresAtTurn) { delete unit.conditions.burning; continue; }
      if (isBurningExempt(map, unit.x, unit.y)) continue;
      unit.hp = Math.max(0, unit.hp - 1);
      window.GameEngine.floatingText.spawnFloatingText(unit, "-1 (Burning)", "warning");
    }
    civ.units = civ.units.filter((u) => u.hp > 0);

    for (const city of civ.cities.slice()) {
      // 2026-07-22, user-directed: Burning no longer affects cities
      // themselves (only units and buildings/walls) -- removed the
      // population-level damage that used to live here.
      for (const s of city.structures.slice()) {
        if (!s.burning) continue;
        if (turnNumber > s.burning.expiresAtTurn) { delete s.burning; continue; }
        if (isBurningExempt(map, s.x, s.y)) continue;
        s.hp -= 1;
        // Floating text anchored to the structure record itself (2026-07-22,
        // user-directed) -- see render.js's Structures draw loop, which
        // matches this by object identity, same convention as a unit.
        window.GameEngine.floatingText.spawnFloatingText(s, "-1 (Burning)", "warning");
        if (s.hp <= 0) window.GameEngine.cities.destroyStructure(gameState, s.x, s.y);
      }
    }
  }

  /**
   * Once-per-civ-turn setup: city tick, resource/stockpile accounting,
   * starvation check, research tick, then everything in an AI civ's turn
   * that happens BEFORE any individual unit acts (see ai.js's beginAITurn --
   * disband/research/found-city/build-queue decisions, none of which are
   * "one unit's turn" in the sense stepCivTurnUnit below means). Skipped
   * entirely (returns null) if the civ is eliminated. Split out of the
   * former monolithic runCivTurn (still available below, now just this +
   * a stepCivTurnUnit loop + finishCivTurn) so advanceOneUnitStep can run
   * this ONCE per civ-turn, then call stepCivTurnUnit repeatedly, one AI
   * unit per call, for spectator mode's visible one-unit-at-a-time pacing.
   * Returns a turnCtx object stepCivTurnUnit/finishCivTurn need (null for
   * an eliminated civ, or a human civ with nothing to step).
   */
  function beginCivTurn(gameState, civ, { humanCivId = null, difficultyByCiv = {} } = {}) {
    if (civ.eliminated) return null;
    const { map } = gameState;

    // Orc "Dire Wolf" drought detector (2026-07-22, user-directed): counts
    // consecutive turns since any of this civ's units last saw real combat.
    // Tracked uniformly for every civ (cheap, and matches every other
    // civ-wide counter in this file) even though only Orc currently consumes
    // it (see ai.js's chooseBuildAction). Reset to 0 at every real combat
    // call site -- see ai.js's markCombatEngaged.
    civ.turnsSinceCombat = (civ.turnsSinceCombat || 0) + 1;

    tickBurningDamage(gameState, civ);
    window.GameEngine.ai.tickTreetopSnipers(gameState, civ);

    for (const city of civ.cities) {
      window.GameEngine.cities.tickCity(city, civ, map);
    }

    // Accumulate per-turn resource totals so the UI can display civ-level production
    civ.resources = civ.cities.reduce((acc, c) => {
      if (c.lastYield) {
        acc.harvest += c.lastYield.harvest || 0;
        acc.coin    += c.lastYield.coin    || 0;
        acc.lore    += c.lastYield.lore    || 0;
      }
      return acc;
    }, { harvest: 0, coin: 0, lore: 0 });

    // Dungeon Delve (Human): a qualifying Wizard (channeling for 1+ turns,
    // i.e. every turn after the turn spent explicitly starting the channel
    // -- 2026-07-30, user-directed fix: previously required 2+ turns of
    // _ritualTurns, silently wasting the unit's first full turn of
    // channeling with no payout) pays out +3 lore, +3 coin per turn on top
    // of normal city income -- that flat
    // bonus is the tech's ENTIRE resource effect (2026-07-19, user-directed:
    // no per-tile harvest, unlike Dwarf's Prospector's Claim below). The
    // Wizard still gradually claims the 1-tile radius around itself (see
    // _delveFilledOffsets -- gradual, exactly like a city's own filled-in
    // mechanic, NOT instant), and that filled-in influence still counts
    // toward the 33% territorial victory condition through the normal
    // ownership pipeline in resolveOwnership/countTerritory -- claiming and
    // resource generation are deliberately decoupled here.
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("dungeon_delve")) {
      const race = window.GameData.getRace(civ.raceId);
      const industriousness = race.industriousness ?? 0.5;
      const cities = window.GameEngine.cities;
      for (const unit of civ.units) {
        if (unit.typeId !== "wizard" || (unit._ritualTurns || 0) < 1) continue;
        // Accumulates instead of paying out directly -- see
        // accumulateChannelStash's doc comment above.
        accumulateChannelStash(unit, { coin: 3, lore: 3 });

        const filled = unit._delveFilledOffsets || new Set();

        // Advance next round's filled set (same rate/threshold constants a
        // city's own advanceCityFill uses) -- deliberately AFTER this round's
        // harvest above, so a newly-filled tile only starts paying out and
        // projecting influence starting next round, exactly like a city.
        unit._delveFilledOffsets = filled;
        const candidates = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const key = `${dx},${dy}`;
            if (filled.has(key)) continue;
            const tx = unit.x + dx, ty = unit.y + dy;
            if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
            candidates.push(key);
          }
        }
        if (candidates.length > 0) {
          unit._delveFillProgress = (unit._delveFillProgress || 0)
            + cities.FILL_RATE_BASE + industriousness * cities.FILL_RATE_PER_INDUSTRIOUSNESS;
          while (unit._delveFillProgress >= cities.FILL_THRESHOLD && candidates.length > 0) {
            unit._delveFillProgress -= cities.FILL_THRESHOLD;
            const idx = Math.floor(Math.random() * candidates.length);
            filled.add(candidates[idx]);
            candidates.splice(idx, 1);
          }
        }
      }
    }

    // Dwarf "Prospector's Claim"/"The Deep Mines": same gradual-fill shape as
    // Dungeon Delve above, but ANY Dwarf unit qualifies (not just one type --
    // the tech's own wording), anchored on a Gold Vein tile instead of a
    // Ruin. Base payout (1+ turns of channeling, i.e. every turn after the
    // turn spent explicitly starting the channel -- 2026-07-30, user-
    // directed fix, see Dungeon Delve's comment above): +3 coin/+1 lore
    // (2026-07-18: dropped the harvest component entirely). Once The Deep
    // Mines is ALSO unlocked and the same unit has held its position 5+
    // turns (continuing straight through the same _ritualTurns counter --
    // not a separate clock; kept at 4 turns past the base tier's own
    // threshold when that threshold moved from 2 to 1), the
    // payout is REPLACED (not stacked) by +5 coin/+4 lore, plus +2 defense
    // while it remains there (applied as a refreshed-every-turn
    // "deepMinesGuard" condition, same convention as Crusade's aura -- see
    // combat.js's effectiveDefense).
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("prospectors_claim")) {
      const hasDeepMines = civ.unlockedMechanics.has("deep_mines");
      const race = window.GameData.getRace(civ.raceId);
      const industriousness = race.industriousness ?? 0.5;
      const cities = window.GameEngine.cities;
      for (const unit of civ.units) {
        if ((unit._ritualTurns || 0) < 1) continue;
        // Accumulates instead of paying out directly -- see
        // accumulateChannelStash's doc comment above.
        const deepened = hasDeepMines && (unit._ritualTurns || 0) >= 5;
        const onIron = map.tiles[unit.y * map.width + unit.x].resource === "iron";
        // Rebalanced 2026-07-18 (user-directed): both tiers dropped their
        // harvest component entirely on Gold Veins -- Prospector's Claim
        // +1 harvest/+5 coin/+2 lore -> +3 coin/+1 lore; The Deep Mines
        // +3 harvest/+10 coin/+4 lore -> +5 coin/+4 lore. The +2 defense
        // guard while deepened is unchanged. Iron Veins (2026-07-21,
        // user-directed) get their own, separately-set payout at each tier
        // -- these DO keep a harvest component, unlike Gold's.
        if (deepened) {
          if (onIron) accumulateChannelStash(unit, { harvest: 1, coin: 6, lore: 2 });
          else accumulateChannelStash(unit, { coin: 5, lore: 4 });
          window.GameEngine.combat.setCondition(unit, "deepMinesGuard", {
            expiresAtTurn: (gameState.turnNumber || 0) + 1, defenseBonus: 2,
          });
        } else if (onIron) {
          accumulateChannelStash(unit, { harvest: 1, coin: 3, lore: 1 });
        } else {
          accumulateChannelStash(unit, { coin: 3, lore: 1 });
        }

        const filled = unit._claimFilledOffsets || new Set();
        let tileHarvest = 0, tileCoin = 0, tileLore = 0;
        for (const key of filled) {
          const [dx, dy] = key.split(",").map(Number);
          const tx = unit.x + dx, ty = unit.y + dy;
          if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
          const tile = map.tiles[ty * map.width + tx];
          if (tile.status !== "owned" || tile.ownerCivId !== civ.id) continue;
          const terrainYield = window.GameData.TERRAIN[tile.terrain].yield;
          tileHarvest += terrainYield.harvest || 0;
          tileCoin    += terrainYield.coin    || 0;
          tileLore    += terrainYield.lore    || 0;
          if (tile.resource) {
            const resBonus = window.GameData.RESOURCES[tile.resource].bonus;
            tileHarvest += resBonus.harvest || 0;
            tileCoin    += resBonus.coin    || 0;
            tileLore    += resBonus.lore    || 0;
          }
        }
        accumulateChannelStash(unit, { harvest: tileHarvest, coin: tileCoin, lore: tileLore });

        // Advance next round's filled set -- same rate/threshold constants a
        // city's own advanceCityFill uses, deliberately AFTER this round's
        // harvest above (a newly-filled tile only starts paying out next round).
        unit._claimFilledOffsets = filled;
        const candidates = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const key = `${dx},${dy}`;
            if (filled.has(key)) continue;
            const tx = unit.x + dx, ty = unit.y + dy;
            if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
            candidates.push(key);
          }
        }
        if (candidates.length > 0) {
          unit._claimFillProgress = (unit._claimFillProgress || 0)
            + cities.FILL_RATE_BASE + industriousness * cities.FILL_RATE_PER_INDUSTRIOUSNESS;
          while (unit._claimFillProgress >= cities.FILL_THRESHOLD && candidates.length > 0) {
            unit._claimFillProgress -= cities.FILL_THRESHOLD;
            const idx = Math.floor(Math.random() * candidates.length);
            filled.add(candidates[idx]);
            candidates.splice(idx, 1);
          }
        }
      }
    }

    // Galley "Fishing" (2026-07-21, user-directed): a universal channeled
    // action for ANY Galley (any race, no tech required) -- explicitly
    // started (see ai.js's maybeGalleyFishingPlay / the player's own "Start
    // Fishing" action), same shape as Dungeon Delve/Prospector's Claim
    // above but simpler: a flat +5 harvest/+2 coin per turn while it stays
    // on a Fish Shoal tile and keeps channeling, no graduated tiers and no
    // territorial claim. Ends the instant it's no longer on the shoal
    // (moved off, or the shoal was never there -- channeling got cleared
    // elsewhere) or the shoal exhausts (same RESOURCE_EXHAUSTION_CHANCE
    // used above).
    for (const unit of civ.units) {
      if (unit.typeId !== "galley" || unit.channeling !== "fishing") continue;
      const tile = map.tiles[unit.y * map.width + unit.x];
      if (!tile || tile.resource !== "fish") {
        // Forced end (shoal gone / channeling cleared elsewhere) -- lose
        // whatever's accumulated, same rule as Prospector's Claim/Delve.
        unit.channeling = null;
        delete unit._channelStash;
        continue;
      }
      // Accumulates instead of paying out directly -- see
      // accumulateChannelStash's doc comment above.
      accumulateChannelStash(unit, { harvest: 5, coin: 2 });
      if (Math.random() < RESOURCE_EXHAUSTION_CHANCE) {
        scheduleResourceRespawn(gameState, tile.resource);
        tile.resource = null;
        window.GameEngine.floatingText.spawnFloatingText(unit, "Shoal Exhausted!", "warning");
        unit.channeling = null;
        // Natural end -- bank it, same as Prospector's Claim/Delve exhaustion.
        bankChannelStash(unit, civ);
      }
    }

    // Pioneer/Scout "Hunt Game"/"Farm Soil" (2026-08-05, user-directed):
    // two Tier 0 tech-gated channeled actions (techs.js's hunt_game/
    // farm_soil) for ANY Pioneer or Scout (any race, gated on the
    // canProspect unit-data flag) -- explicitly started via the player's
    // own "Hunt Game"/"Farm Soil" actions (no AI counterpart yet, same as
    // Pioneer's Build Road). Same shape as Galley Fishing just above: a
    // flat +3 harvest per turn while it stays on its resource tile and
    // keeps channeling, no graduated tiers and no territorial claim. Ends
    // the instant it's no longer on a qualifying tile, the tech is no
    // longer unlocked (shouldn't normally happen -- defense in depth, same
    // check the sidebar button is already gated on), or the resource
    // exhausts (same RESOURCE_EXHAUSTION_CHANCE used above). Internally
    // keyed "hunting"/"farming" (not "prospecting") to stay distinct from
    // Dwarf's Prospector's Claim, a different mechanic keyed
    // unit.channeling === "prospecting" -- see that block's own doc
    // comment above and sidebar.js's CHANNEL_LABELS.
    for (const unit of civ.units) {
      if (!window.GameData.getUnit(unit.typeId).canProspect || unit.channeling !== "hunting") continue;
      const tile = map.tiles[unit.y * map.width + unit.x];
      const hasTech = civ.unlockedMechanics && civ.unlockedMechanics.has("hunt_game");
      if (!tile || tile.resource !== "game" || !hasTech) {
        unit.channeling = null;
        delete unit._channelStash;
        continue;
      }
      accumulateChannelStash(unit, { harvest: 3 });
      if (Math.random() < RESOURCE_EXHAUSTION_CHANCE) {
        scheduleResourceRespawn(gameState, tile.resource);
        tile.resource = null;
        window.GameEngine.floatingText.spawnFloatingText(unit, "Game Depleted!", "warning");
        unit.channeling = null;
        bankChannelStash(unit, civ);
      }
    }
    for (const unit of civ.units) {
      if (!window.GameData.getUnit(unit.typeId).canProspect || unit.channeling !== "farming") continue;
      const tile = map.tiles[unit.y * map.width + unit.x];
      const hasTech = civ.unlockedMechanics && civ.unlockedMechanics.has("farm_soil");
      if (!tile || tile.resource !== "fertile" || !hasTech) {
        unit.channeling = null;
        delete unit._channelStash;
        continue;
      }
      accumulateChannelStash(unit, { harvest: 3 });
      if (Math.random() < RESOURCE_EXHAUSTION_CHANCE) {
        scheduleResourceRespawn(gameState, tile.resource);
        tile.resource = null;
        window.GameEngine.floatingText.spawnFloatingText(unit, "Soil Exhausted!", "warning");
        unit.channeling = null;
        bankChannelStash(unit, civ);
      }
    }

    // Orc "Pillage and Loot": any Orc unit standing within an enemy city's
    // radius (raiding range) generates +1 harvest/+1 coin/+1 lore for EACH
    // tile where it actually suppressed enemy influence this turn (see
    // influence.js computeInfluenceMap, which sets `unit._pillageTilesSuppressed`
    // during beginRound -- runs BEFORE this civ turn in the same round, so
    // the count here is always fresh, not stale from last turn). Merged
    // 2026-07-14 (user-directed) from the former standalone "Campaign of
    // Terror" tech, which only ever did the suppression side with no
    // resource payout at all -- this replaces this mechanic's old flat
    // +1/+1/+1-regardless-of-position payout with one scaled to how much
    // enemy territory is actually being denied, not just "is a unit nearby."
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("pillage_and_loot")) {
      for (const unit of civ.units) {
        const tilesSuppressed = unit._pillageTilesSuppressed || 0;
        if (tilesSuppressed <= 0) continue;
        civ.resources.harvest += tilesSuppressed;
        civ.resources.coin += tilesSuppressed;
        civ.resources.lore += tilesSuppressed;
      }
    }

    // Human "Crusade": each Paladin's holy aura heals every allied unit within
    // 1 tile (Chebyshev, including the Paladin itself) 10% of max HP, and
    // grants a 1-turn "crusadeAura" condition (+2 attack, +1 defense, +25%
    // siege -- read by combat.js's effectiveAttack/effectiveDefense/
    // effectiveSiegePct) refreshed fresh every turn from current positions,
    // same convention as Pillage and Loot above. A unit already touched by
    // one Paladin this turn is skipped for a second so overlapping auras
    // don't double the heal.
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("crusade")) {
      const healed = new Set();
      for (const paladin of civ.units) {
        if (paladin.typeId !== "paladin") continue;
        for (const ally of civ.units) {
          if (healed.has(ally)) continue;
          if (window.GameEngine.influence.chebyshev(paladin.x, paladin.y, ally.x, ally.y) > 1) continue;
          healed.add(ally);
          const crusadeBefore = ally.hp;
          // Minimum 1 HP (2026-08-03, user-directed) -- brings this in line
          // with the Heavy Metal/Wellspring Grove auras just below, which
          // already floored their own smaller 5% heals the same way.
          ally.hp = Math.min(ally.maxHp, ally.hp + Math.max(1, Math.round(ally.maxHp * 0.10)));
          window.GameEngine.floatingText.spawnHealGain(ally, ally.hp - crusadeBefore);
          window.GameEngine.combat.setCondition(ally, "crusadeAura", {
            expiresAtTurn: (gameState.turnNumber || 0) + 1, attackBonus: 2, defenseBonus: 1, siegePctBonus: 0.25,
          });
        }
      }
    }

    // Dwarf "Heavy Metal"/"Power Metal": a Troubadour's aura, same shape as
    // Crusade above -- except the Troubadour can know BOTH techs, in which
    // case exactly one aura is active on it at a time (never both -- see
    // ai.js's maybeSwitchTroubadourAura, the only place unit.activeAura is
    // ever changed). A Troubadour with only one of the two techs always
    // runs that one; "activeAura" only matters once both are known.
    // "Epic Metal" (requires Heavy Metal) widens whichever aura is
    // currently active to a 2-tile radius -- a radius upgrade to "the
    // Troubadour's aura" in general, not tied to one specific aura tech.
    if (civ.unlockedMechanics && (civ.unlockedMechanics.has("heavy_metal") || civ.unlockedMechanics.has("power_metal"))) {
      const hasHeavyMetal = civ.unlockedMechanics.has("heavy_metal");
      const hasPowerMetal = civ.unlockedMechanics.has("power_metal");
      const epicMetal = civ.unlockedMechanics.has("epic_metal");
      const auraRadius = epicMetal ? 2 : 1;
      const healed = new Set();
      for (const troubadour of civ.units) {
        if (troubadour.typeId !== "troubadour") continue;
        const aura = (hasHeavyMetal && hasPowerMetal)
          ? (troubadour.activeAura || "heavy_metal")
          : (hasPowerMetal ? "power_metal" : "heavy_metal");
        for (const ally of civ.units) {
          if (healed.has(ally)) continue;
          if (window.GameEngine.influence.chebyshev(troubadour.x, troubadour.y, ally.x, ally.y) > auraRadius) continue;
          healed.add(ally);
          if (aura === "heavy_metal") {
            const heavyMetalBefore = ally.hp;
            ally.hp = Math.min(ally.maxHp, ally.hp + Math.max(1, Math.round(ally.maxHp * 0.05)));
            window.GameEngine.floatingText.spawnHealGain(ally, ally.hp - heavyMetalBefore);
            window.GameEngine.combat.setCondition(ally, "heavyMetalAura", {
              expiresAtTurn: (gameState.turnNumber || 0) + 1, defenseBonus: 2, siegePctBonus: 0.3,
            });
          } else {
            window.GameEngine.combat.setCondition(ally, "powerMetalAura", {
              expiresAtTurn: (gameState.turnNumber || 0) + 1, attackBonus: 2, firstStrikePctBonus: 0.05,
            });
          }
        }
      }
    }

    // Elf "Wellspring Grove": every city with the building heals every allied
    // unit AND structure (walls/buildings, across every city of this civ, not
    // just the Grove's own) within that city's influence radius 5% of max HP
    // per turn (minimum 1), unconditionally -- regardless of whether a unit
    // is Resting. Dedup via `healed`/`healedStructures` Sets so overlapping
    // Groves never double-heal the same target in one turn, same convention
    // as Crusade/Heavy Metal above.
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("wellspring_grove")) {
      const healed = new Set();
      const healedStructures = new Set();
      for (const grove of civ.cities) {
        if (!window.GameEngine.cities.cityHasStructure(grove, "wellspring_grove")) continue;
        const radius = grove.influenceRadius;
        for (const ally of civ.units) {
          if (healed.has(ally)) continue;
          if (window.GameEngine.influence.chebyshev(grove.x, grove.y, ally.x, ally.y) > radius) continue;
          healed.add(ally);
          const groveBefore = ally.hp;
          ally.hp = Math.min(ally.maxHp, ally.hp + Math.max(1, Math.round(ally.maxHp * 0.05)));
          window.GameEngine.floatingText.spawnHealGain(ally, ally.hp - groveBefore);
        }
        for (const otherCity of civ.cities) {
          for (const s of otherCity.structures) {
            if (healedStructures.has(s)) continue;
            if (window.GameEngine.influence.chebyshev(grove.x, grove.y, s.x, s.y) > radius) continue;
            healedStructures.add(s);
            s.hp = Math.min(s.maxHp, s.hp + Math.max(1, Math.round(s.maxHp * 0.05)));
          }
        }
      }
    }

    // Tech: lore_per_city (e.g. Human "Common Tongue") -- flat lore scaling
    // with city count. Applied to civ.resources BEFORE the stockpile sweep
    // just below (2026-08-04, fixed alongside the research redesign): this
    // used to run AFTER the stockpile already pulled from civ.resources,
    // so the bonus reached tickResearch's old loreThisTurn argument but
    // never actually landed in the stockpile itself. Harmless under the old
    // income-accumulation research model (tickResearch read the argument
    // directly), but research now spends ONLY from the stockpile (see
    // tech.js's chooseResearch) -- left in the old order, this bonus tech
    // would have gone completely inert.
    if (civ.lorePerCity) civ.resources.lore += civ.lorePerCity * civ.cities.length;

    // Running stockpile: accumulate production, then deduct unit upkeep
    civ.stockpile = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    civ.stockpile.harvest += civ.resources.harvest;
    civ.stockpile.coin    += civ.resources.coin;
    civ.stockpile.lore    += civ.resources.lore;
    const civRace = window.GameData.getRace(civ.raceId);
    if (!civRace.noUpkeep) {
      for (const unit of civ.units) {
        // Upkeep is derived -- 10% of the unit's raw power, across all 3
        // resources, times tech-layer premium and army-size strain (see
        // GameData.unitUpkeep) -- not a flat stored value.
        const upkeep = window.GameData.unitUpkeep(unit.typeId, civ, unit);
        civ.stockpile.harvest -= upkeep.harvest || 0;
        civ.stockpile.coin    -= upkeep.coin    || 0;
        civ.stockpile.lore    -= upkeep.lore    || 0;
      }
    }

    // Starvation: if stockpile went negative, shrink a city and disband a unit
    if ((civ.stockpile.harvest < 0 || civ.stockpile.coin < 0 || civ.stockpile.lore < 0) && civ.cities.length > 0) {
      const city = civ.cities[Math.floor(Math.random() * civ.cities.length)];
      if (city.population > 1) {
        city.population -= 1;
        city.harvestSurplus = 0;
        // Clamp (not refill) -- starvation is a decline, not a level-up, so
        // this only matters if hp was sitting above the new, smaller max
        // (see combat.js's cityMaxHp, which scales with population).
        city.hp = Math.min(city.hp, window.GameEngine.combat.cityMaxHp(city));
      }
      const disbandable = civ.units.filter(u => u.typeId !== "pioneer" && !u.carriedBy);
      if (disbandable.length > 0) {
        const victim = disbandable[Math.floor(Math.random() * disbandable.length)];
        if (victim.carries) victim.carries.carriedBy = null;
        civ.units = civ.units.filter(u => u !== victim);
      }
    }

    civ.stockpile.harvest = Math.max(0, civ.stockpile.harvest);
    civ.stockpile.coin    = Math.max(0, civ.stockpile.coin);
    civ.stockpile.lore    = Math.max(0, civ.stockpile.lore);

    const totalLoreTrickleInfluence = civ.cities.reduce((sum, c) => sum + (c.loreInfluenceTrickle || 0), 0);
    civ.lastLoreTrickleInfluence = totalLoreTrickleInfluence;
    // No longer fed this turn's Lore income directly (2026-08-04) -- see
    // tech.js's own doc comment: research now pays its full cost up front
    // from the stockpile when chosen, so this is purely a turn-count
    // countdown with nothing left for beginCivTurn to hand it each turn.
    const finishedTechId = window.GameEngine.tech.tickResearch(civ);
    if (finishedTechId) civ.lastCompletedTech = finishedTechId; // for music "discovery" trigger

    let aiTurnState = null;
    if (civ.id !== humanCivId) {
      const difficulty = difficultyByCiv[civ.id] || "normal";
      try {
        aiTurnState = window.GameEngine.ai.beginAITurn(civ, gameState, difficulty);
      } catch (err) {
        console.error(`AI turn error for ${civ.id}:`, err);
        civ.lastAILog = [`ERROR: ${err.message}`];
        window.GameEngine.ai.appendAIActionLog(gameState, civ.id, civ.lastAILog);
      }
    } else {
      // Condition expiry (2026-08-06, user-directed bug fix): tickConditions
      // is what actually removes an expired unit.conditions entry (Defend's
      // x2-defense brace, Frozen, Befuddled, ...) once its expiresAtTurn is
      // reached -- previously called ONLY from beginAITurn (skipped
      // entirely for the human civ, right below) or primeUnitForAutomation
      // (only for a human unit that's specifically automated), so a regular
      // human-controlled unit's own Defend click never actually expired --
      // it silently stayed doubled forever instead of lapsing "until the
      // start of this unit's own next turn" as documented/intended. Mirrors
      // beginAITurn's own per-unit loop, minus the AI-only heuristic resets
      // (_seekingInvasion/_seekingLandmassId) that have no meaning for a
      // player-directed unit.
      const turnNumber = gameState.turnNumber || 0;
      // Movement modifiers (2026-08-06, user-directed bug fix): the human
      // civ skips beginAITurn entirely (right below this comment explains
      // why for build queues; same reason applies here), and beginAITurn was
      // the ONLY place that stamped unit._moveMods -- so a regular,
      // player-moved unit never had it at all. Every mods?.xxx read in
      // ai.js's getMoveCost/computeMovementBudget/landCostForTerrain is
      // optional-chained, so nothing crashed; it just silently evaluated to
      // "no bonus" for terrain-movement techs, terrain-override techs, and
      // mountain-tunneling, for every unit the player actually clicked and
      // moved themselves -- which is most of a human game. See ai.js's
      // civMoveMods for the shared shape (also used by beginAITurn and
      // primeUnitForAutomation) and landCostForTerrain for where the newer
      // terrainDiscount/unitTerrainDiscount fields in it actually apply.
      const moveMods = window.GameEngine.ai.civMoveMods(civ);
      for (const u of civ.units) {
        u._moveMods = moveMods;
        window.GameEngine.combat.tickConditions(u, turnNumber, map);
        // Same as beginAITurn: a condition can expire lethally (e.g. Human
        // Flight over water) -- remove the unit immediately rather than
        // leaving a 0-hp corpse standing around for something else to trip
        // over later this same turn.
        if (u.hp <= 0) civ.units = civ.units.filter((x) => x !== u);
      }

      // The human civ skips beginAITurn entirely -- but city production is
      // NOT an AI behavior, it's a rule of the game, and it used to be
      // trapped inside that skipped call (ai.js's maybeBuildInCities). A
      // human player's cities therefore never advanced a build at all.
      // Progress their queues here; the player still makes the CHOICE of what
      // to build via the sidebar, this only ticks whatever they picked.
      try {
        const buildLog = window.GameEngine.ai.progressBuildQueues(civ, gameState);
        if (buildLog.length) window.GameEngine.ai.appendAIActionLog(gameState, civ.id, buildLog);
      } catch (err) {
        console.error(`Build-queue error for ${civ.id}:`, err);
      }
    }

    // humanCivId threaded onto the returned turnCtx purely so finishCivTurn
    // (which doesn't otherwise receive it) can tell whether THIS civ is the
    // human one -- see finishCivTurn's own multi-turn-goto-orders comment
    // for why that step has to live there, not here.
    return { aiTurnState, humanCivId };
  }

  /**
   * Dispatches exactly ONE not-yet-acted AI unit for `civ` via
   * ai.js's stepAIUnit, in civ.units order (creation order). No-op (returns
   * null immediately) for a human-controlled civ -- there's no AI to step,
   * the human plays via direct UI actions instead -- or once beginCivTurn's
   * AI setup failed (aiTurnState null, e.g. it threw). Any exception from
   * stepAIUnit itself aborts the REST of this civ's units too (matching the
   * original single-try-block runCivTurn's all-or-nothing behavior for one
   * civ's whole AI turn), not just the one unit that threw.
   */
  function stepCivTurnUnit(gameState, civ, turnCtx) {
    if (!turnCtx || !turnCtx.aiTurnState) return null;
    try {
      return window.GameEngine.ai.stepAIUnit(civ, gameState, turnCtx.aiTurnState);
    } catch (err) {
      console.error(`AI unit-step error for ${civ.id}:`, err);
      const log = turnCtx.aiTurnState.log || [];
      log.push(`ERROR: ${err.message}`);
      civ.lastAILog = log;
      window.GameEngine.ai.appendAIActionLog(gameState, civ.id, log);
      turnCtx.aiTurnState = null; // stop stepping this civ; finishCivTurn below skips the AI-finish step too
      return null;
    }
  }

  /**
   * Once-per-civ-turn teardown, run once stepCivTurnUnit has returned null
   * (every unit stepped, or AI setup/stepping failed): the one AI decision
   * that has to happen after unit movement (see ai.js's finishAITurn), then
   * healing, Devoted Companions passive heal, and the usedThisTurn/resting
   * reset -- unchanged from the former monolithic runCivTurn, just moved
   * to run once here instead of inline at the end of that one function.
   */
  function finishCivTurn(gameState, civ, turnCtx) {
    if (civ.eliminated) return;
    const { map } = gameState;

    if (turnCtx && turnCtx.aiTurnState) {
      try {
        window.GameEngine.ai.finishAITurn(civ, gameState, turnCtx.aiTurnState);
      } catch (err) {
        console.error(`AI turn error for ${civ.id}:`, err);
        // finishAITurn threw before reaching its own civ.lastAILog/
        // appendAIActionLog assignment (see ai.js) -- recover whatever this
        // civ-turn had already logged rather than losing it, same pattern
        // as stepCivTurnUnit's catch above.
        const log = turnCtx.aiTurnState.log || [];
        log.push(`ERROR: ${err.message}`);
        civ.lastAILog = log;
        window.GameEngine.ai.appendAIActionLog(gameState, civ.id, log);
      }
    }

    // Healing: Rest is now a required explicit action (not automatic for any
    // idle unit) -- only units that chose to Rest this turn (set by AI or the
    // player's Rest button) heal. Runs after the AI turn so this-turn Rest
    // decisions are honored immediately, and after the human's own pre-End-Turn
    // UI actions for the human civ.
    for (const unit of civ.units) {
      if (!unit.resting) continue;
      const inOwnCity = civ.cities.some((c) => c.x === unit.x && c.y === unit.y);
      const tile = map.tiles[unit.y * map.width + unit.x];
      window.GameEngine.combat.healUnit(unit, civ, inOwnCity, tile);
      // Teleportation exhaustion clears once the unit is fully healed -- an
      // event-based clear, not turn-based, so tickConditions doesn't touch it.
      if (unit.conditions?.exhausted && unit.hp >= unit.maxHp) {
        window.GameEngine.combat.clearCondition(unit, "exhausted");
      }
    }

    // Tech: Halfellow "Devoted Companions" -- a carried passenger heals
    // automatically every turn (50% faster than normal), independent of
    // Rest entirely (a carried unit can only do nothing or disembark, so it
    // never explicitly Rests on its own).
    if (civ.unlockedMechanics && civ.unlockedMechanics.has("devoted_companions")) {
      for (const unit of civ.units) {
        if (!unit.carriedBy || unit.resting) continue;
        const inOwnCity = civ.cities.some((c) => c.x === unit.x && c.y === unit.y);
        const tile = map.tiles[unit.y * map.width + unit.x];
        window.GameEngine.combat.healUnit(unit, civ, inOwnCity, tile, 1.50);
      }
    }

    // movesRemaining reset alongside usedThisTurn -- see ai.js's
    // spendMovement/computeMovementBudget (project_turn_action_economy
    // memory): a fresh turn means the persisted leftover-movement budget
    // from last turn is stale and must be lazily recomputed on first use.
    for (const unit of civ.units) { unit.usedThisTurn = false; unit.resting = false; unit.movesRemaining = null; }

    // Multi-turn goto orders (2026-08-06, user-directed): MUST run here,
    // after the reset immediately above, not in beginCivTurn (tried first,
    // and wrong -- see the 2026-08-06 fix note below). The human civ plays
    // via direct UI clicks at any point while the game is sitting idle
    // between End Turn presses, which is BEFORE this civ's own
    // beginCivTurn/finishCivTurn pair for the round ever runs -- those
    // only fire once the player actually clicks End Turn and the round-
    // robin reaches this civ's slot. So by the time THIS code runs, the
    // units' usedThisTurn/movesRemaining already reflect whatever the
    // player just did by hand, not a fresh budget -- advancing a goto
    // order here, BEFORE that reset, kept finding movesRemaining already
    // spent and immediately cancelling the order as "blocked" the very
    // first time it should have continued. Reset FIRST, then continue,
    // fixes it: this now runs with a genuinely fresh budget, consumes some
    // of it automatically, and leaves whatever's left for the player's own
    // next round of clicks -- same moment an AI unit gets re-decided every
    // round. See orders.js's advanceGotoOrder for what "one turn's worth
    // of progress" means.
    if (turnCtx && civ.id === turnCtx.humanCivId) {
      for (const unit of civ.units) {
        if (!unit.gotoTarget) continue;
        try {
          window.GameEngine.orders.advanceGotoOrder(unit, gameState);
        } catch (err) {
          console.error(`Goto-order error for unit ${unit.id} (${civ.id}):`, err);
          unit.gotoTarget = null;
        }
      }
    }

    // Garrison (2026-08-06, user-directed): a standing "defending" brace
    // (see main.js's handleGarrisonUnit) that must be kept alive every turn
    // without asking the player -- re-stamps the condition fresh each round
    // so it never lapses to its nominal 1-turn expiry on its own. Ends
    // itself automatically if the unit is no longer standing in one of this
    // civ's own cities (carried off, or some future forced-move effect),
    // same "auto-cancel if the precondition breaks" convention the resource
    // channels' onAnchor gate above uses for moving off a vein/ruin.
    if (turnCtx && civ.id === turnCtx.humanCivId) {
      for (const unit of civ.units) {
        if (unit.channeling !== "garrison") continue;
        if (!civ.cities.some((c) => c.x === unit.x && c.y === unit.y)) {
          unit.channeling = null;
          window.GameEngine.combat.clearCondition(unit, "defending");
          continue;
        }
        window.GameEngine.combat.setCondition(unit, "defending", { expiresAtTurn: (gameState.turnNumber || 0) + 1 });
      }
    }

    // Shift-held "repeat for the next 3 turns" auto-repeat (2026-08-07,
    // user-directed): main.js's maybeScheduleAutoRepeat stamps
    // unit.autoRepeat/city.autoRepeat = {kind, turnsLeft} the moment the
    // player Shift-clicks (or Shift-presses the matching key for) Rest and
    // Defend, Gather More Resources, or Research. Re-fires that same action
    // here, once per turn, decrementing until it runs out -- same "runs
    // once per round without asking the player again" slot as the Garrison
    // brace just above. Each engine call already self-gates on whether it's
    // still valid (performRestAndDefend no-ops if the unit already acted
    // this turn; applyResourceProduction/applyResearchBoost no-op on a
    // queued build, an already-claimed turn, or -- for research -- nothing
    // currently being researched), so a stale schedule just quietly does
    // nothing rather than erroring.
    if (turnCtx && civ.id === turnCtx.humanCivId) {
      for (const unit of civ.units) {
        if (!unit.autoRepeat || unit.autoRepeat.turnsLeft <= 0) continue;
        if (unit.autoRepeat.kind === "restAndDefend") {
          window.GameEngine.orders.performRestAndDefend(unit, gameState);
        }
        unit.autoRepeat.turnsLeft -= 1;
        if (unit.autoRepeat.turnsLeft <= 0) unit.autoRepeat = null;
      }
      for (const city of civ.cities) {
        if (!city.autoRepeat || city.autoRepeat.turnsLeft <= 0) continue;
        if (city.autoRepeat.kind === "resourceProduction") {
          window.GameEngine.cities.applyResourceProduction(city, civ, gameState);
        } else if (city.autoRepeat.kind === "research") {
          const result = window.GameEngine.cities.applyResearchBoost(city, civ, gameState);
          if (result?.completed) civ.lastCompletedTech = result.techId;
        }
        city.autoRepeat.turnsLeft -= 1;
        if (city.autoRepeat.turnsLeft <= 0) city.autoRepeat = null;
      }
    }

    // Automate Actions (2026-08-06, user-directed): same lifecycle slot as
    // the goto-order continuation just above, and for the same reason -- a
    // fresh usedThisTurn/movesRemaining budget must exist before an
    // automated unit's AI-reused decision logic runs. Units already mid
    // multi-turn goto/channel, or already holding a pendingIntent awaiting
    // player confirmation, are skipped by runAutomatedUnitTurn itself.
    if (turnCtx && civ.id === turnCtx.humanCivId) {
      const log = civ.lastAILog || [];
      for (const unit of civ.units) {
        if (!unit.automated) continue;
        try {
          window.GameEngine.ai.runAutomatedUnitTurn(civ, unit, gameState, log);
        } catch (err) {
          console.error(`Automate Actions error for unit ${unit.id} (${civ.id}):`, err);
        }
      }
    }
  }

  /**
   * Full, non-granular civ-turn: begin -> step every AI unit -> finish, all
   * in one synchronous call -- unchanged end-to-end behavior from the
   * former monolithic runCivTurn. Used by `runTurn` (looped over every civ).
   * Spectator mode's finer, visible one-unit-at-a-time pacing instead uses
   * advanceOneUnitStep, which drives beginCivTurn/stepCivTurnUnit/
   * finishCivTurn directly, one unit per call.
   */
  function runCivTurn(gameState, civ, opts = {}) {
    const turnCtx = beginCivTurn(gameState, civ, opts);
    if (!turnCtx) return; // eliminated
    while (stepCivTurnUnit(gameState, civ, turnCtx)) { /* one unit per iteration, in creation order */ }
    finishCivTurn(gameState, civ, turnCtx);
  }

  /**
   * Once-per-round history sample for the Report menu's line-graph views
   * (see ui/reports.js): one point per civ per round, appended in lockstep
   * with `gameState.history.turns`. Influence is tile count (same source as
   * the sidebar's Territory Share); military power is the flat sum of
   * GameData.unitPower across a civ's units -- the same context-free "power"
   * concept build cost/upkeep already use, not the AI's tactical
   * unitCombatPower scoring heuristic. An eliminated civ reads 0 from here
   * on, rather than stopping -- so its line just flatlines instead of
   * vanishing from the chart.
   */
  function recordHistory(gameState) {
    gameState.history = gameState.history || { turns: [], civs: {} };
    const { counts } = window.GameEngine.influence.countTerritory(gameState);
    for (const civId of Object.keys(gameState.civs)) {
      const civ = gameState.civs[civId];
      const rec = gameState.history.civs[civId] = gameState.history.civs[civId] || { influence: [], power: [] };
      rec.influence.push(civ.eliminated ? 0 : (counts[civId] || 0));
      const power = civ.eliminated ? 0
        : civ.units.reduce((sum, u) => sum + window.GameData.unitPower(u.typeId), 0);
      rec.power.push(power);
    }
    gameState.history.turns.push(gameState.turnNumber || 0);
  }

  /**
   * Once-per-round teardown, run after every civ has taken its turn:
   * elimination check, victory check, turn counter advance. Shared by
   * `runTurn` and `advanceOneUnitStep`.
   */
  function endRound(gameState) {
    checkElimination(gameState);
    const victoryResult = checkVictory(gameState);
    recordHistory(gameState);
    gameState.turnNumber = (gameState.turnNumber || 0) + 1;
    return { victoryResult };
  }

  /** Runs one full game turn for every civ. `difficulty` keyed per civId for AI civs. */
  function runTurn(gameState, opts = {}) {
    beginRound(gameState);
    const order = gameState.turnOrder || Object.keys(gameState.civs);
    for (const civId of order) {
      const civ = gameState.civs[civId];
      if (!civ) continue;
      runCivTurn(gameState, civ, opts);
    }
    return endRound(gameState);
  }

  /**
   * Finer-grained alternative to `runTurn`: advances exactly ONE
   * unit's turn per call, in civ.units order (creation order -- see ai.js's
   * runUnitTurn), instead of a whole civ resolving at once. This is what
   * lets spectator mode visibly show AI units acting one at a time, in the
   * order they were created, rather than a civ's entire army moving/
   * fighting in one instant flash between redraws.
   *
   * Driven by `gameState.turnOrder`/`turnStepIndex` plus a
   * `gameState._civTurnCtx` holding the in-progress civ's turnCtx
   * (beginCivTurn's return value) across calls while that civ's units are
   * being stepped one at a time -- cleared the instant that civ's turn
   * finishes. Must not be mixed with `runTurn` on the
   * same gameState mid-round (both drive `turnStepIndex`; only one driving
   * loop should ever be in flight for a given gameState at a time). `_civTurnCtx` is
   * transient, in-memory-only scratch state -- see savegame.js, which
   * strips it before serializing (a Set inside it doesn't survive a JSON
   * round-trip with reference identity intact, and there's nothing useful
   * to resume from a save anyway; a reload always starts clean at the top
   * of whichever civ was mid-turn).
   *
   * Returns { steppedCivId, steppedUnit, roundComplete, victoryResult } --
   * `steppedUnit` is the actual unit object just acted on (or null on a
   * call that only finished a civ's turn / advanced past an eliminated
   * civ / completed the round, none of which stepped a real unit).
   */
  function advanceOneUnitStep(gameState, opts = {}) {
    const order = gameState.turnOrder || Object.keys(gameState.civs);
    if (!(gameState.turnStepIndex > 0) && !gameState._civTurnCtx) {
      gameState.turnStepIndex = 0;
      beginRound(gameState);
    }

    while (gameState.turnStepIndex < order.length) {
      const civId = order[gameState.turnStepIndex];
      const civ = gameState.civs[civId];
      if (!civ || civ.eliminated) { gameState.turnStepIndex++; continue; }

      if (!gameState._civTurnCtx) {
        gameState._civTurnCtx = beginCivTurn(gameState, civ, opts);
        if (!gameState._civTurnCtx) { gameState.turnStepIndex++; continue; } // shouldn't happen (already checked eliminated) -- defensive
      }

      const steppedUnit = stepCivTurnUnit(gameState, civ, gameState._civTurnCtx);
      if (steppedUnit) {
        return { steppedCivId: civId, steppedUnit, roundComplete: false, victoryResult: null };
      }

      // No more units to step for this civ (or nothing to step at all, e.g.
      // the human civ, or a civ with zero units) -- finish it and move on,
      // all within this same call.
      finishCivTurn(gameState, civ, gameState._civTurnCtx);
      gameState._civTurnCtx = null;
      gameState.turnStepIndex++;
    }

    const { victoryResult } = endRound(gameState);
    gameState.turnStepIndex = 0;
    gameState._civTurnCtx = null;
    return { steppedCivId: null, steppedUnit: null, roundComplete: true, victoryResult };
  }

  /**
   * Marks a civ eliminated and cleans up everything that would otherwise
   * linger: its remaining field units (a dead civ has no cities left to
   * project influence, so stray raiders/galleys that survived the last siege
   * are removed rather than wandering on as an ownerless army) and any tile
   * still crediting it as owner (reverted to neutral immediately instead of
   * waiting on the normal contested-grace-period decay). Shared by
   * checkElimination below (the general per-turn sweep) AND ai.js's siege
   * code (which detects "that was their last city" immediately at the
   * moment of destruction, not just on the next sweep) so both paths behave
   * identically -- a civ can be eliminated from either place.
   */
  function eliminateCiv(gameState, civ) {
    civ.eliminated = true;
    civ.units = [];
    for (const tile of gameState.map.tiles) {
      if (tile.ownerCivId === civ.id) {
        tile.ownerCivId = null;
        tile.status = "neutral";
        tile.contestedTurns = 0;
      }
    }
  }

  function checkElimination(gameState) {
    // Two independent ways to be eliminated:
    //  1. Founded at least one city, then lost every city (siege -- see
    //     combat.js attackCity / cities.js destroyCity). `hasFoundedCity` is
    //     what distinguishes this from a civ still on its very first
    //     Settler, zero cities, before it's had a chance to found anything --
    //     without that guard this incorrectly matched every civ's NORMAL
    //     starting state and eliminated the whole roster after turn 1 (found
    //     via integration testing: a 50-turn run produced zero cities across
    //     all civs, traced down to this exact check).
    //  2. Never founded a city AND has no units left either -- a total wipe
    //     before ever getting off the ground.
    for (const civ of Object.values(gameState.civs)) {
      if (civ.eliminated) continue;
      const lostAllCitiesEverFounded = civ.hasFoundedCity && civ.cities.length === 0;
      const wipedBeforeFounding = civ.cities.length === 0 && civ.units.length === 0;
      if (lostAllCitiesEverFounded || wipedBeforeFounding) {
        eliminateCiv(gameState, civ);
      }
    }
  }

  function checkVictory(gameState) {
    // Elimination victory: last civ standing wins immediately, regardless of
    // influence share -- no point requiring a territory threshold once every
    // rival has been wiped out entirely.
    const allCivs = Object.values(gameState.civs);
    const survivors = allCivs.filter((civ) => !civ.eliminated);
    if (allCivs.length > 1 && survivors.length === 1) {
      return { winner: survivors[0].id, type: "elimination" };
    }

    const { counts, totalClaimable } = window.GameEngine.influence.countTerritory(gameState);
    let leadingCiv = null, leadingShare = 0;
    for (const [civId, count] of Object.entries(counts)) {
      const share = totalClaimable > 0 ? count / totalClaimable : 0;
      if (share > leadingShare) { leadingShare = share; leadingCiv = civId; }
    }

    gameState.victoryTracking = gameState.victoryTracking || {};
    if (leadingShare >= VICTORY_SHARE_THRESHOLD) {
      gameState.victoryTracking[leadingCiv] = (gameState.victoryTracking[leadingCiv] || 0) + 1;
      // Reset any other civ's streak
      for (const civId of Object.keys(gameState.victoryTracking)) {
        if (civId !== leadingCiv) gameState.victoryTracking[civId] = 0;
      }
      if (gameState.victoryTracking[leadingCiv] >= VICTORY_SUSTAIN_TURNS) {
        return { winner: leadingCiv, share: leadingShare, type: "territory" };
      }
    } else {
      for (const civId of Object.keys(gameState.victoryTracking)) gameState.victoryTracking[civId] = 0;
    }
    return null;
  }

  window.GameEngine.turns = {
    refreshVisibility,
    beginRound,
    beginCivTurn,
    stepCivTurnUnit,
    finishCivTurn,
    runCivTurn,
    endRound,
    runTurn,
    advanceOneUnitStep,
    checkVictory,
    eliminateCiv,
    VICTORY_SHARE_THRESHOLD,
    VICTORY_SUSTAIN_TURNS,
    bankChannelStash,
  };
})();
