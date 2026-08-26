/**
 * SIDEBAR UI
 * ----------
 * Updates the persistent sidebar panel: a tabbed inspector for the selected
 * tile (one tab per thing present on it -- city, each unit, building,
 * terrain, kingdom), a civ-wide summary when nothing is selected, plus the
 * End Turn button. See map_ui_design.md §1 for the layout this implements.
 *
 * The tab LIST is built in input.js (see its SELECTION MODEL comment); this
 * file only draws the strip and dispatches to the matching detail panel.
 */

window.UI = window.UI || {};

(function () {
  function render(container, gameState, viewState) {
    const { civs, turnNumber } = gameState;
    const humanCiv = civs[viewState.humanCivId];
    const sel = viewState.selection;

    // Gilded frame (see css/style.css's .sidebar.race-* rules): themed per
    // the human player's kingdom, or the neutral spectator frame when
    // there's no human civ (spectator mode never favors one AI kingdom
    // over another). Set every render rather than once, since a loaded
    // save can hand this a freshly-created container.
    const raceClass = humanCiv ? humanCiv.raceId : "spectator";
    container.className = `sidebar race-${raceClass}`;

    let html = "";

    // Placement mode is modal -- left-click means "put it here" until it
    // resolves -- so it needs to say so loudly, above everything else.
    if (viewState.placement) {
      // Target-selection mode (main.js's startTargetSelection) is the same
      // modal cursor, but the player is picking an existing unit rather than
      // a tile to put something on -- so it says so.
      const isTargeting = viewState.placement.targeting;
      html += `<div class="placement-banner">
        <strong>${isTargeting ? "" : "Placing "}${escapeHtml(viewState.placement.label)}</strong>
        <div>${isTargeting
          ? "Click a highlighted target on the map."
          : "Click a highlighted tile on the map."}<br>Click anywhere else to cancel.</div>
      </div>`;
    }

    if (sel && sel.tabs && sel.tabs.length) {
      html += renderTabStrip(sel);
      const tab = sel.tabs[sel.activeTab];
      if (tab.kind === "city")           html += renderCityPanel(tab.city, civs, sel, gameState, viewState);
      else if (tab.kind === "unit")      html += renderUnitPanel(tab.unit, civs, viewState, gameState);
      else if (tab.kind === "structure") html += renderStructurePanel(tab.structure);
      else if (tab.kind === "terrain")   html += renderTilePanel(tab.tile, civs, sel);
      else if (tab.kind === "kingdom")   html += renderKingdomPanel(tab.civ, gameState, viewState);
    } else {
      html += renderKingdomPanel(humanCiv, gameState, viewState);
    }

    // Awaiting-orders cycler: with a dozen units spread across the map,
    // hunting for the ones that haven't moved is the single most tedious part
    // of a turn. Only shown when there's actually something to jump to.
    let cyclerHtml = "";
    // Research: the only way in used to be a
    // "View Tech Tree" button buried inside the Kingdom panel, which
    // disappears the instant anything else is selected -- e.g. the moment a
    // player clicks their own starting Pioneer, which is the natural first
    // move of the game. That made it look like there was no research UI at
    // all. Always visible here instead, regardless of what's selected, so
    // it's never more than one click away.
    let researchHtml = "";
    if (viewState.humanCivId) {
      const waiting = window.GameEngine.orders.unitsNeedingOrders(gameState, viewState.humanCivId);
      cyclerHtml = waiting.length
        ? `<button id="next-unit-btn" class="next-unit-btn">Next Unit (${waiting.length})</button>`
        : `<div class="all-units-moved">All units have orders</div>`;

      const civ = civs[viewState.humanCivId];
      const allTechsResearched = civ && civ.completedTechs.size >= window.GameData.techsForRace(civ.raceId).length;
      if (civ && !civ.currentResearch && allTechsResearched) {
        researchHtml = `<div class="all-units-moved">All tech has been researched.</div>`;
      } else {
        let researchLabel = "Choose Research";
        if (civ && civ.currentResearch) {
          const tech = window.GameData.getTech(civ.currentResearch);
          // Turn-count progress now, not a Lore-income threshold (2026-08-04):
          // research pays up front and counts down a fixed timer -- see
          // tech.js's chooseResearch/tickResearch -- same shape as
          // buildQueuePct's turnsRemaining/totalTurns math just below.
          const pct = civ.researchTotalTurns
            ? Math.min(100, Math.floor(100 * (civ.researchTotalTurns - civ.researchTurnsRemaining) / civ.researchTotalTurns))
            : 0;
          researchLabel = `Researching: ${tech.label} (${pct}%)`;
        } else if (civ && civ.cities.length === 0) {
          // Explains WHY nothing's pickable yet (see tech.js's meetsCityGate --
          // every tech needs at least 1 city) rather than sitting there
          // unexplained, which is what made the gate itself look broken.
          researchLabel = "Choose Research (found a city first)";
        }
        researchHtml = `<button id="open-research-btn" class="research-btn">${escapeHtml(researchLabel)}</button>`;
      }
    }

    // "Next Idle City" -- same shared predicate
    // (cities.js's isCityIdle) already backing the per-city Idle tag in
    // renderKingdomPanel's own city list, the map's idle badge, and the End
    // Turn nag. Only rendered when there's actually one to jump to, same
    // "hide the control rather than show it disabled" convention the unit
    // cycler above uses.
    let idleCityHtml = "";
    if (viewState.humanCivId) {
      const civ = civs[viewState.humanCivId];
      const idleCount = civ ? civ.cities.filter((c) => window.GameEngine.cities.isCityIdle(civ, c, gameState)).length : 0;
      if (idleCount > 0) {
        idleCityHtml = `<button id="next-idle-city-btn" class="next-unit-btn">Next Idle City (${idleCount})</button>`;
      }
    }

    // Territorial-victory progress: the win
    // condition is a share of the map's claimable land (turns.js's
    // checkVictory), but the only place that number appeared was the
    // Kingdom panel's Territory row -- which vanishes the moment anything
    // else is selected -- and the Reports overlay's influence graph, two
    // clicks away. So the actual goal was invisible turn-to-turn, which is
    // a large part of why the mid-game read as aimless: nothing on screen
    // told the player whether they were getting closer to winning.
    //
    // Rendered here in the always-visible footer, next to the turn counter,
    // for the same reason the research button was hoisted out of the
    // Kingdom panel (see its own comment above). Reuses the identical
    // countTerritory + VICTORY_TILE_TARGET math checkVictory and reports.js
    // already share, so all three can't drift.
    //
    // 2026-08-25: reads as an absolute tile count ("412 / 500 tiles") rather
    // than a percentage of the map. Victory is an absolute target now (see
    // config.js's victory.tileTarget), and a raw count is something the
    // player can watch tick up tile by tile -- a percentage of a map whose
    // size they never chose was far harder to read progress from.
    let territoryHtml = "";
    if (viewState.humanCivId && window.GameEngine.influence) {
      const civ = civs[viewState.humanCivId];
      if (civ) {
        const { counts } = window.GameEngine.influence.countTerritory(gameState);
        const target = window.GameEngine.turns.VICTORY_TILE_TARGET;
        const myTiles = counts[civ.id] || 0;
        const progressPct = target > 0 ? Math.min(100, (myTiles / target) * 100) : 0;
        // Leader callout: only when someone else is actually ahead, so this
        // stays quiet in the common case rather than adding a permanent row.
        let leadId = null, leadTiles = 0;
        for (const [cid, count] of Object.entries(counts)) {
          if (count > leadTiles) { leadTiles = count; leadId = cid; }
        }
        const leaderTag = (leadId && leadId !== civ.id)
          ? ` <span class="territory-leader">${escapeHtml(window.GameData.getRace(civs[leadId].raceId).label)} ${Math.round(leadTiles)}</span>`
          : "";
        territoryHtml = `<div class="territory-progress" title="Territorial victory needs ${target} owned tiles, held for ${window.GameEngine.turns.VICTORY_SUSTAIN_TURNS} consecutive turns.">
          <div class="territory-progress-label">
            <span>Territory ${Math.round(myTiles)} / ${target} tiles</span>${leaderTag}
          </div>
          <div class="territory-progress-track"><div class="territory-progress-fill" style="width:${progressPct.toFixed(1)}%"></div></div>
        </div>`;
      }
    }

    // Turn counter moved below End Turn.
    html += `<div class="sidebar-footer">
      ${researchHtml}
      ${idleCityHtml}
      ${cyclerHtml}
      ${territoryHtml}
      <button id="end-turn-btn" class="end-turn-btn">End Turn</button>
      <div class="turn-counter">Turn ${turnNumber}</div>
    </div>`;

    container.innerHTML = html;
  }

  /** The tab strip itself. Suppressed for a bare terrain tile -- a lone
   *  "Terrain" tab is pure noise, since that's self-evidently what the panel
   *  below it is showing. */
  function renderTabStrip(sel) {
    if (sel.tabs.length <= 1) return "";
    const buttons = sel.tabs.map((t, i) =>
      `<button class="tile-tab${i === sel.activeTab ? " tile-tab-active" : ""}" data-tab-index="${i}">${escapeHtml(t.label)}</button>`
    ).join("");
    return `<div class="tile-tabs">${buttons}</div>`;
  }

  function renderCityPanel(city, civs, sel, gameState, viewState) {
    const civ = civs[city.civId];
    const race = civ ? window.GameData.getRace(civ.raceId) : null;
    const y = city.lastYield || { harvest: 0, coin: 0, lore: 0 };
    const pop = Math.floor(city.population);
    const maxPop = window.GameEngine.cities.MAX_CITY_POPULATION || 6;
    // City HP: a real damage-accumulating pool
    // now -- see combat.js's attackCity/cityMaxHp -- population-per-level,
    // refilled on growth, clamped on starvation, reset to the new (smaller)
    // max when a hit empties it and knocks off a level. cityHp falls back
    // to a full pool for a city from an older save that predates this field.
    const cityMaxHp = window.GameEngine.combat.cityMaxHp(city);
    const cityHp = city.hp != null ? Math.max(0, city.hp) : cityMaxHp;
    // Defense: combat.js's cityDefenseValue was
    // already the real number an attack is resolved against -- base + per
    // population level + per structure, and now + a wall-specific premium on
    // top of that (see its own doc comment) -- it just had no row here to
    // show it. Wall count called out separately since it's the one factor a
    // player can act on directly (build more walls); the others are
    // consequences of the city's size.
    const cityDefense = window.GameEngine.combat.cityDefenseValue(city);
    const wallCount = city.structures.filter((s) => s.hp > 0 && window.GameData.getBuilding(s.id).isWall).length;
    const wallTag = wallCount
      ? ` <em>(+${wallCount * window.GameConfig.combat.cityDefensePerWall} from ${wallCount} wall${wallCount === 1 ? "" : "s"})</em>` : '';
    const atCap = pop >= maxPop;
    // One shared formula with the engine -- see cities.js's growthThresholdFor.
    // This used to be an inline `pop * pop * (... || 400.0)` duplicate, which
    // silently disagreed with tickCity the moment the growth exponent stopped
    // being a hardcoded 2.
    const growthThreshold = window.GameEngine.cities.growthThresholdFor(pop);
    const growthPct = atCap ? 100 : Math.min(100, Math.floor(100 * city.harvestSurplus / growthThreshold));
    const portTag = city.isPort ? ' <em>(Port)</em>' : '';
    const radiusTileCount = (2 * city.influenceRadius + 1) ** 2;
    const filledTileCount = city.filledOffsets ? city.filledOffsets.size : 0;

    // Garrison: units standing on the city tile.
    // This is the case that motivated the whole tabbed inspector -- clicking
    // a defended city used to show the city and silently swallow its
    // defenders. Each entry jumps to that unit's own tab; the tab indices
    // come straight from the same list input.js built, so they can't drift.
    const garrisonHtml = sel ? (() => {
      const unitTabs = sel.tabs
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.kind === "unit");
      if (!unitTabs.length) {
        return `<h3>Garrison</h3><div class="stat-row"><em>Undefended</em></div>`;
      }
      const rows = unitTabs.map(({ t, i }) => {
        const u = t.unit;
        const uCiv = civs[u.civId];
        const uRace = uCiv ? window.GameData.getRace(uCiv.raceId) : null;
        // An enemy unit on your city tile is possible (a flying unit isn't
        // blocked by the city) -- flag it rather than implying it's yours.
        const foreign = uCiv && uCiv.id !== city.civId ? ` <em>(${escapeHtml(uRace ? uRace.label : uCiv.id)})</em>` : '';
        return `<button class="tile-tab-link" data-tab-index="${i}">
          <span>${escapeHtml(t.label)}${foreign}</span><span>${u.hp}/${u.maxHp} hp</span>
        </button>`;
      }).join("");
      return `<h3>Garrison (${unitTabs.length})</h3>${rows}`;
    })() : '';

    return `
      <div class="panel">
        <h2>${escapeHtml(city.name)}${portTag}</h2>
        ${race ? `<div class="stat-row"><span>Race</span><span>${escapeHtml(race.label)}</span></div>` : ''}
        <div class="stat-row"><span>HP</span><span>${cityHp} / ${cityMaxHp}</span></div>
        ${hpBarHtml(cityHp, cityMaxHp)}
        <div class="stat-row"><span>Defense</span><span>${cityDefense.toFixed(1)}${wallTag}</span></div>
        <div class="stat-row"><span>Population</span><span>${pop} / ${maxPop}</span></div>
        <div class="stat-row"><span>Growth</span><span>${atCap ? 'Max size' : `${city.harvestSurplus.toFixed(1)} / ${growthThreshold.toFixed(0)} (${growthPct}%)`}</span></div>
        <div class="stat-row"><span>Influence Radius</span><span>${city.influenceRadius}</span></div>
        ${window.GameEngine.cities.isSpreadingCulture(city, gameState)
          ? `<div class="stat-row"><span>Spread Culture</span><span>Active (+50% this turn)</span></div>` : ''}
        <div class="stat-row"><span>Vision Radius</span><span>${city.influenceRadius + 3}</span></div>
        <div class="stat-row"><span>Filled Tiles</span><span>${filledTileCount} / ${radiusTileCount}</span></div>
        <h3>Yield this turn</h3>
        <div class="stat-row"><span>Harvest</span><span>${y.harvest.toFixed(1)}</span></div>
        <div class="stat-row"><span>Coin</span><span>${y.coin.toFixed(1)}</span></div>
        <div class="stat-row"><span>Lore</span><span>${y.lore.toFixed(1)}</span></div>
        ${renderBuildSection(city, civ, gameState, viewState)}
        <h3>Structures (${city.structures.length}/${window.GameEngine.cities.RING1_SLOT_COUNT + window.GameEngine.cities.RING2_SLOT_COUNT})</h3>
        ${city.structures.length
          ? city.structures.map(s => {
              const b = window.GameData.getBuilding(s.id);
              return `<div class="stat-row"><span>${escapeHtml(b.label)}</span><span>${Math.max(0, s.hp)}/${s.maxHp} hp</span></div>${hpBarHtml(s.hp, s.maxHp)}`;
            }).join("")
          : '<div class="stat-row"><em>None built</em></div>'}
        ${garrisonHtml}
      </div>`;
  }

  /**
   * What this city is producing. Read-only: the
   * picker, Resource Production, Cancel Build and "next city" all moved to
   * the radial map menu -- right-click the city (see orders.js's
   * cityRingOptions and js/ui/buildlist.js, which is this file's former
   * picker markup, lifted out whole).
   *
   * It was the single biggest block in the sidebar -- an open picker ran to a
   * dozen rows on top of the city's own stats -- and it's the reason the
   * panel could grow past the height of the window.
   */
  function renderBuildSection(city, civ, gameState, viewState) {
    const isOwnCity = viewState && viewState.humanCivId && city.civId === viewState.humanCivId;
    const hint = isOwnCity ? actionHintHtml("the city") : "";

    // Automation banner: shown above
    // everything else so an automated city reads as automated at a glance,
    // whatever it happens to be doing this turn. The city still shows its
    // real per-turn receipt below (resource/research), since automation
    // routes through the exact same apply* calls a manual action does.
    let autoHtml = "";
    if (isOwnCity && city.automated) {
      const next = window.GameEngine.cities.cityAutomationChoice(civ, city, gameState);
      const nextLabel = next === "culture" ? "Spreading culture"
        : next === "resources" ? "Gathering resources"
        : next === "research" ? "Boosting research"
        : "Nothing to do this turn";
      autoHtml = `<div class="stat-row city-automated-row"><span>Automated</span><span>${escapeHtml(nextLabel)}</span></div>`;
    }

    if (city.buildQueue) {
      const item = city.buildQueue;
      const label = item.kind === "building"
        ? window.GameData.getBuilding(item.id).label
        : (window.GameData.getUnit(item.id)?.label || item.id);
      // The chosen build site is a real tile -- make it a jump link too.
      const placeTag = item.placeAt
        ? ` → ${tileLink(item.placeAt.x, item.placeAt.y, `(${item.placeAt.x}, ${item.placeAt.y})`, "terrain")}`
        : "";
      const turnsTag = item.turnsRemaining !== undefined
        ? `${item.turnsRemaining} turn${item.turnsRemaining === 1 ? "" : "s"} left`
        : `${buildQueuePct(item)}%`;
      // Receipt for a turn already bought this turn via the Bazaar's
      // "Expedite Unit Build" (see cities.js's applyExpediteBuild). Same
      // "the action is a ring pill, the receipt lives here" split every
      // other city action in this panel uses -- and it's what tells the
      // player why the pill has gone until next turn.
      const expediteHtml = window.GameEngine.cities.isExpeditingBuild(city, gameState)
        ? `<div class="stat-row"><span>Expedited</span><span>-1 turn this turn</span></div>` : '';
      return `<h3>Building</h3>
        ${autoHtml}
        <div class="stat-row"><span>${escapeHtml(label)}${placeTag}</span><span>${escapeHtml(turnsTag)}</span></div>
        <div class="build-progress"><div class="build-progress-fill" style="width:${buildQueuePct(item)}%"></div></div>
        ${expediteHtml}
        ${hint}`;
    }

    if (!isOwnCity) return `<h3>Building</h3><div class="stat-row"><em>Nothing queued</em></div>`;

    // The receipt for a turn already spent on resources -- see cities.js's
    // applyResourceProduction. Information, so it stays here; the action that
    // produces it is a ring pill.
    if (window.GameEngine.cities.isProducingResources(city, gameState)) {
      const made = city.resourceProductionGain || { harvest: 0, coin: 0, lore: 0 };
      const amounts = [
        made.harvest >= 0.5 ? `+${Math.round(made.harvest)} Harvest` : null,
        made.coin >= 0.5 ? `+${Math.round(made.coin)} Coin` : null,
        made.lore >= 0.5 ? `+${Math.round(made.lore)} Lore` : null,
      ].filter(Boolean).join(", ");
      return `<h3>Building</h3>
        ${autoHtml}
        <div class="stat-row"><span>Resource Production</span><span>${escapeHtml(amounts)}</span></div>
        <div class="stat-row"><em>This turn's production went to resources</em></div>`;
    }

    // The receipt for a turn spent boosting research instead -- see
    // cities.js's applyResearchBoost. Same "information only" split as the
    // resource-production receipt just above: the action is a ring pill,
    // this just reports what it did.
    if (window.GameEngine.cities.isBoostingResearch(city, gameState)) {
      const made = city.researchBoostGain;
      const summary = made
        ? (made.completed ? `Completed: ${made.techLabel}` : `-${made.amount} turn${made.amount === 1 ? "" : "s"} (${made.techLabel})`)
        : "";
      return `<h3>Building</h3>
        ${autoHtml}
        <div class="stat-row"><span>Research Tech</span><span>${escapeHtml(summary)}</span></div>
        <div class="stat-row"><em>This turn's production went to research</em></div>`;
    }

    return `<h3>Building</h3>
      ${autoHtml}
      <div class="stat-row"><em>Nothing queued</em></div>
      ${hint}`;
  }

  /** "Right-click for actions". Once every verb
   *  moved to the radial map menu, this became the ONLY signpost to the whole
   *  action set -- so it's a real styled row rather than the 70%-opacity
   *  aside it started as. Shown by both the unit and city panels. */
  function actionHintHtml(subject) {
    return `<div class="action-hint">Right-click ${escapeHtml(subject)} on the map for actions</div>`;
  }

  /** The seven veteran-bonus buttons, each showing what it would change and
   *  to what ("Attack (12 -> 14)"). Ring-menu-only now (2026-08-07, user-
   *  directed -- the sidebar's own inline copy of this picker is gone, see
   *  renderUnitPanel); still exported since main.js's ring popover
   *  (buildRingPage) is the only remaining caller.
   *
   *  visionRadius/movement joined the original
   *  five paths -- their "current value" needs `gameState` (vision reads
   *  civ.unitOverrides/conditions the same way turns.js's visibility sum
   *  does; movement goes through ai.js's computeMovementBudget, which is
   *  ALREADY the single source of truth for what a move actually costs, so
   *  this reuses it rather than re-deriving a second formula that could
   *  drift). Road/terrain bonuses computeMovementBudget also folds in are
   *  left showing here too -- deliberately not stripped to "base + level
   *  only", since matching what the sidebar's own current-tile display
   *  already shows the player beats a cleaner-but-wrong number. */
  function levelUpChoicesHtml(unit, civ, gameState) {
    const combat = window.GameEngine.combat;
    const LEVEL_UP_LABELS = {
      attack: "Attack", defense: "Defense", siegePct: "Siege",
      firstStrikePct: "First Strike", doubleStrikePct: "Double Strike",
      visionRadius: "Vision", movement: "Movement",
    };
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const effVision = (baseUnit.visionRadius || 3) + (civ.unitOverrides?.[unit.typeId]?.visionRadius || 0)
      + (unit.conditions?.flying?.visionBonus || 0) + (unit.conditions?.keepingWatch?.visionBonus || 0)
      + (unit.levelBonuses?.visionRadius || 0);
    const currentValue = {
      attack: combat.effectiveAttack(unit, civ),
      defense: combat.effectiveDefense(unit, civ),
      siegePct: combat.effectiveSiegePct(unit, civ),
      firstStrikePct: combat.effectiveFirstStrikePct(unit, civ),
      doubleStrikePct: combat.effectiveDoubleStrikePct(unit, civ),
      visionRadius: effVision,
      movement: window.GameEngine.ai.computeMovementBudget(unit, gameState.map, gameState.civs),
    };
    const isPct = (stat) => stat === "siegePct" || stat === "firstStrikePct" || stat === "doubleStrikePct";
    const fmt = (stat, v) => isPct(stat) ? `${Math.round(v * 100)}%` : (Number.isInteger(v) ? v : v.toFixed(1));
    return combat.LEVEL_UP_STATS.map((stat) => {
      const bonus = combat.LEVEL_BONUS_VALUES[stat];
      return `<button class="action-btn action-btn-primary level-up-btn" data-level-up-stat="${stat}">`
        + `${LEVEL_UP_LABELS[stat]} (${fmt(stat, currentValue[stat])} &rarr; ${fmt(stat, currentValue[stat] + bonus)})</button>`;
    }).join("");
  }

  function renderTilePanel(tile, civs, sel) {
    const terrain = window.GameData.TERRAIN[tile.terrain];
    const y = terrain.yield;
    const ownerCiv = tile.ownerCivId ? civs[tile.ownerCivId] : null;
    const ownerRace = ownerCiv ? window.GameData.getRace(ownerCiv.raceId) : null;
    const resource = tile.resource ? window.GameData.RESOURCES[tile.resource] : null;
    const hasRiver = tile.hasRiver && (tile.hasRiver.n || tile.hasRiver.s || tile.hasRiver.e || tile.hasRiver.w);
    // Whichever of moveCostLand/moveCostNaval actually applies -- every
    // terrain type in terrain.js has exactly one of the two as a real
    // number and the other as IMPASSABLE (no amphibious units exist), so
    // a single row covers it without showing an always-irrelevant value.
    // A road overrides the land cost to a flat 1 regardless of terrain
    // (see ai.js's getMoveCost) -- roads are a land-only feature, so this
    // never applies to the naval-cost branch.
    const moveCost = terrain.isWater ? terrain.moveCostNaval : (tile.hasRoad ? 1 : terrain.moveCostLand);
    const moveCostLabel = terrain.isWater ? "Movement Cost (Naval)" : "Movement Cost";
    const moveCostDisplay = moveCost === window.GameData.IMPASSABLE ? "Impassable" : moveCost;

    // Everything sitting on top of the base terrain, in one list under one
    // heading: a Ruin used to be a bare stat-row
    // with a hand-written "+2 Lore" while a Resource got its own "Resource"
    // heading and a bonus string derived from the data -- two presentations
    // for the same kind of thing. All four now share the label/bonus shape,
    // and every bonus string is derived (see terrain.js's RESOURCES,
    // RIVER_YIELD_BONUS and RUIN_YIELD_BONUS) so the panel can't claim a
    // number the yield code doesn't actually pay.
    // Actual Yield: the base row above is raw
    // terrain, unaffected by anything the player has actually built or
    // researched -- this shows what the tile really pays right now, with
    // kingdom (race/tech) and city (Barrow, distance falloff, road-bonus
    // cap, ...) bonuses applied, same math cities.js's own worked-tile
    // income totals use (see computeTileActualYield). Only shown once a
    // city is actually working the tile (owned AND filled-in) -- an owned-
    // but-unfilled or unowned tile has no "actual" figure to add beyond the
    // base row already on screen.
    const actualYield = ownerCiv ? window.GameEngine.cities.computeTileActualYield(tile, tile.x, tile.y, ownerCiv) : null;
    const fmtYield = (v) => Number.isInteger(v) ? v : Math.round(v * 10) / 10;
    const actualYieldHtml = actualYield ? `
        <h3>Actual Yield</h3>
        <div class="stat-row"><span>Harvest</span><span>${fmtYield(actualYield.harvest)}</span></div>
        <div class="stat-row"><span>Coin</span><span>${fmtYield(actualYield.coin)}</span></div>
        <div class="stat-row"><span>Lore</span><span>${fmtYield(actualYield.lore)}</span></div>` : '';

    const featureRows = [];
    if (resource) featureRows.push([resource.label, formatBonus(resource.bonus)]);
    if (tile.isRuin) featureRows.push([window.GameData.RUIN_LABEL, formatBonus(window.GameData.RUIN_YIELD_BONUS)]);
    // Cave (2026-08-19, user-directed): deliberately never shows the linked
    // destination here, even to the tile's owner -- per the feature's own
    // design, where a cave leads is a surprise revealed only by actually
    // using it (see orders.js's performEnterCave), not something the tile
    // inspector should spoil in advance.
    if (tile.isCave) featureRows.push([window.GameData.CAVE_LABEL, "Leads to an unknown destination"]);
    if (hasRiver) featureRows.push(["River", formatBonus(window.GameData.RIVER_YIELD_BONUS)]);
    if (tile.hasRoad) featureRows.push(["Road", "Connected"]);
    const featuresHtml = featureRows.length
      ? `<h3>Features</h3>` + featureRows.map(([label, value]) =>
          `<div class="stat-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join("")
      : "";

    // "Contents" doubles the Terrain tab as the tile's index -- one clickable
    // row per other tab, so you can see at a glance everything sharing this
    // tile even while reading the terrain itself. Skips the Kingdom tabs
    // (not a thing physically ON the tile) and, obviously, Terrain itself.
    const contentsHtml = sel ? (() => {
      const rows = sel.tabs
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.kind === "city" || t.kind === "unit" || t.kind === "structure")
        .map(({ t, i }) => {
          const KIND_LABEL = { city: "City", unit: "Unit", structure: "Building" };
          return `<button class="tile-tab-link" data-tab-index="${i}">
            <span>${escapeHtml(KIND_LABEL[t.kind])}</span><span>${escapeHtml(t.label)}</span>
          </button>`;
        }).join("");
      if (!rows) return `<h3>Contents</h3><div class="stat-row"><em>Empty tile</em></div>`;
      return `<h3>Contents</h3>${rows}`;
    })() : '';

    return `
      <div class="panel">
        <h2>${escapeHtml(terrain.label)}</h2>
        <div class="stat-row"><span>Status</span><span>${escapeHtml(tile.status || "neutral")}</span></div>
        <div class="stat-row"><span>${escapeHtml(moveCostLabel)}</span><span>${escapeHtml(String(moveCostDisplay))}</span></div>
        ${ownerRace ? `<div class="stat-row"><span>Controlled by</span><span>${escapeHtml(ownerRace.label)}</span></div>` : ''}
        <h3>Base Yield</h3>
        <div class="stat-row"><span>Harvest</span><span>${y.harvest}</span></div>
        <div class="stat-row"><span>Coin</span><span>${y.coin}</span></div>
        <div class="stat-row"><span>Lore</span><span>${y.lore}</span></div>
        ${actualYieldHtml}
        ${featuresHtml}
        <div class="stat-row"><span>Position</span><span>(${tile.x}, ${tile.y})</span></div>
        ${contentsHtml}
      </div>`;
  }

  /** Effect lines for buildings whose effect is implemented in engine code
   *  gated on cityHasStructure/civHasBuiltBuilding rather than carried as a
   *  data field on the building (see buildings.js's header comment). Without
   *  this the structure panel would list no effects at all for most of the
   *  roster. Phrased to match the data-driven lines above them: terse, lower
   *  case, no trailing period. "(kingdom-wide)" marks the effects that apply
   *  off ANY standing copy rather than only in this structure's own city. */
  const BUILDING_EFFECT_TEXT = {
    // Human
    bazaar: ["this city can pay to Expedite Unit Build (-1 turn)"],
    guild_hall: ["units built here get a free level-up"],
    mage_college: ["75% chance/turn to strike an enemy within 5 for 3 attack"],
    // Elf
    silverleaf_atelier: ["+1 defense for units built here"],
    altar_of_ages: ["+25% XP for units built here"],
    wellspring_grove: ["allies in this city's radius heal 5%/turn (kingdom-wide)"],
    // Dwarf
    deep_forge: ["+1 attack for units built here"],
    great_hall: ["+50% defense while Resting on any of your holdings (kingdom-wide)"],
    runewall: ["walls heal 5% of max HP per turn (kingdom-wide)"],
    deep_gate: ["Dwarf units may travel between Deep Gates (kingdom-wide)"],
    // Orc
    war_camp: ["+1 movement for units built here"],
    butchery: ["units heal 15% of max HP on a kill (kingdom-wide)"],
    dragon_den: ["required to build Dragons in this city"],
    ancestral_dolmen: ["a unit built here falling rouses allies within 3: +25% attack for 3 turns"],
    // Halfellow
    farmers_market: ["+25% max HP for units built here"],
    neighborhood_pub: ["+25% XP for all your units (kingdom-wide)"],
    historical_society: ["reveals every Ruin on the map (kingdom-wide)"],
    armory: ["+50% attack and defense for units built here"],
  };

  function renderStructurePanel(sel) {
    const b = sel.building;
    const rec = sel.record;
    const race = window.GameData.getRace(sel.civ.raceId);
    const effects = [];
    if (b.yield) {
      for (const [k, v] of Object.entries(b.yield)) effects.push(`+${v} ${k}`);
    }
    if (b.yieldPct) {
      for (const [k, v] of Object.entries(b.yieldPct)) effects.push(`+${Math.round(v * 100)}% ${k} (this city)`);
    }
    if (b.influenceMult) effects.push(`Influence ×${b.influenceMult}`);
    if (b.radiusBonus) effects.push(`+${b.radiusBonus} radius`);
    if (b.visionRadiusBonus) effects.push(`+${b.visionRadiusBonus} vision radius`);
    if (b.coinPerAdjacentRoad) effects.push(`+${b.coinPerAdjacentRoad} coin / adjacent road`);
    if (b.lorePerAdjacentForest) effects.push(`+${b.lorePerAdjacentForest} lore / adjacent forest`);
    if (b.contestedYieldPenaltyOverride) effects.push(`contested tiles yield ${Math.round(b.contestedYieldPenaltyOverride * 100)}%`);
    if (b.unitCostMult) effects.push(`unit cost ×${b.unitCostMult}`);
    if (b.raiseDeadPowerBonus) effects.push(`+${Math.round(b.raiseDeadPowerBonus * 100)}% raised power`);
    // Buildings whose effect lives in engine code rather than a data field
    // (see buildings.js's header) have nothing for the checks above to find,
    // so their effect line comes from BUILDING_EFFECT_TEXT instead. Kept
    // here next to the data-driven lines so both render identically.
    for (const line of BUILDING_EFFECT_TEXT[b.id] || []) effects.push(line);

    // A bridge segment doesn't belong to any one city (see cities.js's
    // findStructureAt doc comment -- unlike every other structure, it's
    // tracked on the civ, not a city's own structures list), so sel.city
    // is null here and the Owner City row is skipped rather than crashing
    // on sel.city.name (2026-08-19 bugfix -- this is what made the Bridge
    // tab render nothing at all when clicked).
    const ownerRow = sel.city
      ? `<div class="stat-row"><span>Owner City</span><span>${escapeHtml(sel.city.name)}</span></div>`
      : "";
    return `
      <div class="panel">
        <h2>${escapeHtml(b.label)}</h2>
        <div class="stat-row"><span>Race</span><span>${escapeHtml(race.label)}</span></div>
        ${ownerRow}
        <div class="stat-row"><span>HP</span><span>${Math.max(0, rec.hp)} / ${rec.maxHp}</span></div>
        ${hpBarHtml(rec.hp, rec.maxHp)}
        <div class="stat-row"><span>Position</span><span>(${rec.x}, ${rec.y})</span></div>
        <h3>Effect</h3>
        <div class="stat-row">${effects.length ? escapeHtml(effects.join(", ")) : "<em>—</em>"}</div>
        <div class="stat-row"><em>Can be attacked and destroyed by enemy units.</em></div>
      </div>`;
  }

  /** ", N turns left" for a timed condition (combat.js's setCondition/
   *  tickConditions -- every condition with a finite duration stores
   *  expiresAtTurn, cleared once gameState.turnNumber reaches it), or ""
   *  for an event-cleared condition (no expiresAtTurn) or one that's
   *  refreshed indefinitely turn after turn (e.g. Rest and Defend's own
   *  "defending" condition -- see its own dedicated properties.push below,
   *  which deliberately doesn't call this: a live countdown on something
   *  that never actually runs out would just be misleading). 2026-08-19,
   *  user-directed: "for effects like flight that have a limited duration
   *  there should be a counter... so the player knows how many rounds are
   *  left" -- appended inline to each condition's own descriptive text
   *  rather than a separate line, so it reads as part of the same effect. */
  function turnsLeftSuffix(condition, gameState) {
    if (!condition || condition.expiresAtTurn == null || !gameState) return "";
    const remaining = condition.expiresAtTurn - (gameState.turnNumber || 0);
    if (remaining <= 0) return "";
    return `, ${remaining} turn${remaining === 1 ? "" : "s"} left`;
  }

  function renderUnitPanel(unit, civs, viewState, gameState) {
    const civ = civs[unit.civId];
    const race = window.GameData.getRace(civ.raceId);
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const isHumanUnit = viewState && unit.civId === viewState.humanCivId;

    // INFORMATION ONLY, FROM HERE DOWN
    // -------------------------------------------------------------
    // Every unit VERB moved to the radial map menu (right-click the unit --
    // see js/ui/ringmenu.js and orders.js's contextMenuOptions). This panel
    // kept only the rows that TELL the player something, because the buttons
    // were what made it long enough to push End Turn off the bottom of the
    // sidebar in the first place. The gating conditions went with the
    // buttons: orders.js is now the single copy of "what can this unit do",
    // where it used to be duplicated between there and here.
    //
    // What survives is deliberately the non-actionable half these blocks
    // always interleaved with their buttons -- "Cannot found here: <reason>",
    // a channel's turn counter, "Already acted this turn". Those answer
    // questions the ring can't: the ring shows what IS available, these say
    // why something isn't.

    // Settler status. Gated on the unit-data flags (canFoundCity/
    // canBuildRoad) rather than typeId === "pioneer", so the other
    // settler-capable units (Elf Druid, Undead Wanderer) report the same way.
    let pioneerActions = "";
    if ((baseUnit.canFoundCity || baseUnit.canBuildRoad) && isHumanUnit && gameState) {
      const tile = gameState.map.tiles[unit.y * gameState.map.width + unit.x];
      const canFoundCheck = baseUnit.canFoundCity
        ? window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, unit.x, unit.y, civ.raceId)
        : { ok: false, reason: null };

      let rows = "";
      if (!unit.usedThisTurn) {
        if (!canFoundCheck.ok && baseUnit.canFoundCity && canFoundCheck.reason) {
          rows += `<div class="stat-row"><em style="color:#f0a830">Cannot found here: ${escapeHtml(canFoundCheck.reason)}</em></div>`;
        }
        if (baseUnit.canBuildRoad && window.GameEngine.cities.tileCountsAsRoad(tile)) {
          rows += `<div class="stat-row"><span>Road</span><span>${tile.hasRoad ? "Already built here" : "Bridge counts as a road here"}</span></div>`;
        }
      } else {
        rows += `<div class="stat-row"><em>Already acted this turn</em></div>`;
      }
      if (rows) pioneerActions = `<h3>Status</h3>${rows}`;
    }

    // Channeled actions: Prospector's Claim,
    // Dungeon Delve, and Galley Fishing are all explicitly-started,
    // explicitly-cancelled channels now (see turns.js's onAnchor gate on
    // unit.channeling) rather than something that "just happens" from
    // standing still -- these buttons are the player's own start/cancel
    // controls, mirroring ai.js's maybeProspectorsClaimPlay/
    // maybeDungeonDelvePlay/maybeGalleyFishingPlay for the AI side.
    // How long this unit has been channeling -- the one thing about a channel
    // the ring can't tell you (its start/claim/cancel verbs live there now).
    let channelActions = "";
    if (isHumanUnit) {
      const CHANNEL_LABELS = { delving: "Delving", fishing: "Fishing", hunting: "Hunting", farming: "Farming", mining: "Mining" };
      const label = CHANNEL_LABELS[unit.channeling];
      const turnsIn = unit._ritualTurns || 0;
      if (label && turnsIn > 0) {
        channelActions = `<h3>Status</h3>`
          + `<div class="stat-row"><span>${label}</span><span>${turnsIn} turn${turnsIn === 1 ? "" : "s"}</span></div>`;
      }
    }

    // (Go Hidden / Cancel Hidden moved to the ring, 2026-08-06. Nothing is
    // lost here: the Properties row below already reports "Hidden" and
    // "Forced Visible", which was the only non-button content this block
    // ever had.)

    const carriedByTag = unit.carriedBy
      ? `<div class="stat-row"><span>Status</span><span>Aboard ${escapeHtml(window.GameData.getUnit(unit.carriedBy.typeId).label)}</span></div>`
      : '';
    const carriesTag = unit.carries
      ? `<div class="stat-row"><span>Carrying</span><span>${escapeHtml(window.GameData.getUnit(unit.carries.typeId).label)}</span></div>`
      : '';
    // Upkeep is derived (10% of raw unit power, across whichever resources
    // that split uses -- see GameData.unitUpkeep), not a flat stored value.
    const unitUpkeep = window.GameData.unitUpkeep(unit.typeId, civ, unit);
    const upkeepParts = [];
    if (unitUpkeep.harvest) upkeepParts.push(`${unitUpkeep.harvest.toFixed(1)} Harvest`);
    if (unitUpkeep.coin)    upkeepParts.push(`${unitUpkeep.coin.toFixed(1)} Coin`);
    if (unitUpkeep.lore)    upkeepParts.push(`${unitUpkeep.lore.toFixed(1)} Lore`);
    const upkeep = upkeepParts.length ? upkeepParts.join(' / ') : '—';

    // Effective attack/defense/properties -- reflects tech overrides (unit_stat_upgrade,
    // garrison_defense_bonus etc.) via combat.js, not just the raw base unit data.
    const effAttack = window.GameEngine.combat.effectiveAttack(unit, civ, {});
    const effDefense = window.GameEngine.combat.effectiveDefense(unit, civ, {});
    const firstStrikePct = window.GameEngine.combat.effectiveFirstStrikePct(unit, civ);
    const doubleStrikePct = window.GameEngine.combat.effectiveDoubleStrikePct(unit, civ);
    const siegePct = window.GameEngine.combat.effectiveSiegePct(unit, civ);

    // Level-up notice: the picker itself is ring-menu-only (orders.js's
    // "levelUp" pill / main.js's buildRingPage) -- this just tells the
    // player one is waiting so it isn't missed.
    let levelUpActions = "";
    if (isHumanUnit) {
      const pendingCount = window.GameEngine.combat.pendingLevelUps(unit);
      if (pendingCount > 0) {
        levelUpActions = `<div class="placement-banner">
          <strong>Level Up! (${pendingCount} pending)</strong>
          <div>Right-click this unit to choose a veteran bonus.</div>
        </div>`;
      }
    }

    const isFlying = window.GameEngine.combat.isFlying(unit);
    const canCarry = window.GameEngine.combat.getUnitProperty(unit, civ, "canCarryUnit", false);
    const effVision = (baseUnit.visionRadius || 3) + (civ.unitOverrides?.[unit.typeId]?.visionRadius || 0)
      + (unit.conditions?.flying?.visionBonus || 0);
    const properties = [];
    if (firstStrikePct > 0) properties.push(`First Strike ${Math.round(firstStrikePct * 100)}%`);
    if (doubleStrikePct > 0) properties.push(`Double Strike ${Math.round(doubleStrikePct * 100)}%`);
    if (siegePct > 0) properties.push(`Siege ${Math.round(siegePct * 100)}%`);
    if (isFlying) properties.push('Flying');
    if (canCarry) properties.push('Can Carry');
    // Conditions (temporary, timed effects) -- see combat.js's setCondition/
    // tickConditions. Shown alongside properties since both answer "what can
    // this unit currently do," just with different lifetimes.
    const curse = unit.conditions?.curse;
    if (curse) properties.push(`Cursed (${Math.round((1 - curse.attackMult) * 100)}% attack, ${Math.round((1 - curse.moveMult) * 100)}% move${turnsLeftSuffix(curse, gameState)})`);
    const frozen = unit.conditions?.frozen;
    if (frozen) properties.push(`Frozen (0 movement, ${Math.round((1 - frozen.attackMult) * 100)}% attack${turnsLeftSuffix(frozen, gameState)})`);
    const killMomentum = unit.conditions?.killMomentum;
    if (killMomentum) {
      properties.push(`Violent Momentum (+${killMomentum.moveBonus} movement`
        + (killMomentum.firstStrikePctBonus ? `, +${Math.round(killMomentum.firstStrikePctBonus * 100)}% first strike` : '')
        + (killMomentum.doubleStrikePctBonus ? `, +${Math.round(killMomentum.doubleStrikePctBonus * 100)}% double strike` : '')
        + turnsLeftSuffix(killMomentum, gameState)
        + ')');
    }
    const flightGrant = unit.conditions?.flying;
    if (flightGrant && flightGrant.moveBonus) properties.push(`Granted Flight (+${flightGrant.moveBonus} movement, +${flightGrant.visionBonus} vision${turnsLeftSuffix(flightGrant, gameState)})`);
    const hiddenCond = unit.conditions?.hidden;
    if (hiddenCond) {
      // No surrounding parens elsewhere in this string (unlike every other
      // condition here) -- turnsLeftSuffix's leading ", " reads oddly
      // stuck directly onto "Hidden" with nothing before it, so this wraps
      // it in its own parens instead: "Hidden (3 turns left)".
      const suffix = turnsLeftSuffix(hiddenCond, gameState);
      properties.push(`Hidden${suffix ? ` (${suffix.slice(2)})` : ''}`);
    }
    const forcedVisibleCond = unit.conditions?.forcedVisible;
    if (forcedVisibleCond) properties.push(`Forced Visible (cannot re-Hide yet${turnsLeftSuffix(forcedVisibleCond, gameState)})`);
    const crusadeAura = unit.conditions?.crusadeAura;
    if (crusadeAura) properties.push(`Crusade Aura (+${crusadeAura.attackBonus} attack, +${crusadeAura.defenseBonus} defense, +${Math.round(crusadeAura.siegePctBonus * 100)}% siege${turnsLeftSuffix(crusadeAura, gameState)})`);
    const heavyMetalAura = unit.conditions?.heavyMetalAura;
    if (heavyMetalAura) properties.push(`Heavy Metal Aura (+${heavyMetalAura.defenseBonus} defense, +${Math.round(heavyMetalAura.siegePctBonus * 100)}% siege, 5% heal/turn${turnsLeftSuffix(heavyMetalAura, gameState)})`);
    const powerMetalAura = unit.conditions?.powerMetalAura;
    if (powerMetalAura) properties.push(`Power Metal Aura (+${powerMetalAura.attackBonus} attack, +${Math.round(powerMetalAura.firstStrikePctBonus * 100)}% first strike${turnsLeftSuffix(powerMetalAura, gameState)})`);
    // Befuddled/Webbed/Poisoned/Burning (2026-08-19): these four previously
    // had a map-tile badge (overlays.js's CONDITION_ICONS) but no sidebar
    // text at all -- same turnsLeftSuffix treatment as every condition
    // above now applies here too.
    const befuddled = unit.conditions?.befuddled;
    if (befuddled) properties.push(`Befuddled (${Math.round((1 - befuddled.attackMult) * 100)}% attack, ${Math.round((1 - befuddled.defenseMult) * 100)}% defense, ${Math.round((1 - befuddled.movementMult) * 100)}% movement${turnsLeftSuffix(befuddled, gameState)})`);
    const webbed = unit.conditions?.webbed;
    if (webbed) properties.push(`Webbed (0 movement${turnsLeftSuffix(webbed, gameState)})`);
    const poisoned = unit.conditions?.poisoned;
    if (poisoned) properties.push(`Poisoned (-1 HP/turn${turnsLeftSuffix(poisoned, gameState)})`);
    const burning = unit.conditions?.burning;
    if (burning) properties.push(`Burning (-1 HP/turn${turnsLeftSuffix(burning, gameState)})`);
    // A channeled Rest and Defend reads the label differently even though
    // it's the SAME "defending" condition underneath as a plain one-off
    // Defend (ai.js's performDefend, AI-only) -- Rest and Defend's whole
    // point is that it does NOT lapse "until next turn" the way a one-off
    // Defend does; it persists until cancelled or superseded.
    if (unit.conditions?.defending) {
      properties.push(unit.channeling === "restAndDefend" ? 'Resting and Defending (x2 defense)' : 'Defending (x2 defense until next turn)');
    }

    // Veteran leveling (see combat.js's LEVELING section) -- permanent,
    // player/AI-chosen stat bonuses earned through combat XP, distinct from
    // every temporary condition/aura above.
    const levelBonuses = unit.levelBonuses || {};
    const bonusParts = [];
    if (levelBonuses.attack) bonusParts.push(`+${levelBonuses.attack} attack`);
    if (levelBonuses.defense) bonusParts.push(`+${levelBonuses.defense} defense`);
    if (levelBonuses.siegePct) bonusParts.push(`+${Math.round(levelBonuses.siegePct * 100)}% siege`);
    if (levelBonuses.firstStrikePct) bonusParts.push(`+${Math.round(levelBonuses.firstStrikePct * 100)}% first strike`);
    if (levelBonuses.doubleStrikePct) bonusParts.push(`+${Math.round(levelBonuses.doubleStrikePct * 100)}% double strike`);

    // Veteran leveling: level 0-MAX_UNIT_LEVEL, progress toward the next
    // level shown as raw XP / the next cumulative threshold (see combat.js's
    // XP_LEVEL_THRESHOLDS) -- "(max)" once it's capped out.
    const unitLevel = unit.level || 0;
    const maxUnitLevel = window.GameEngine.combat.MAX_UNIT_LEVEL;
    const nextXpThreshold = window.GameEngine.combat.XP_LEVEL_THRESHOLDS[unitLevel];
    const levelLabel = unitLevel >= maxUnitLevel
      ? `${unitLevel} (max)`
      : `${unitLevel} (${Math.floor(unit.xp || 0)} / ${nextXpThreshold} XP)`;

    // Turn status: the action economy is movement
    // points PLUS one action (see orders.js), and until now the sidebar showed
    // neither. Without this the player has no way to know why a unit won't
    // move, or that it still has an attack available after moving.
    let turnStatus = "";
    if (isHumanUnit && gameState) {
      const budget = unit.movesRemaining != null
        ? unit.movesRemaining
        : window.GameEngine.ai.computeMovementBudget(unit, gameState.map, gameState.civs);
      const moveText = unit.channeling ? "Channeling" : `${budget} / ${baseUnit.movement}`;
      const actionText = unit.usedThisTurn ? "Used" : "Available";
      turnStatus = `
        <div class="stat-row"><span>Movement Left</span><span>${escapeHtml(moveText)}</span></div>
        <div class="stat-row"><span>Action</span><span${unit.usedThisTurn ? ' style="opacity:0.6"' : ''}>${actionText}</span></div>
        ${actionHintHtml("this unit")}`;
    }

    // (Rest and Defend, Cancel Rest and Defend, Disband, Stop Order and
    // Automate Actions all live on the ring now -- see this function's
    // "INFORMATION ONLY" note above. Their non-button signals are all still
    // here: Stop Order's is the "Order" row below, Automate's is "Intent",
    // Rest and Defend's is Properties' "Resting and Defending (x2 defense)".)

    // Spectator-only: every unit in a spectator game is AI-controlled, so
    // ai.js stamps a human-readable currentMission on it each turn (see
    // maybeMoveUnits/maybeFoundCity/operateGalley etc.) describing whatever
    // it just decided to do. Not shown in a human player's own game since
    // that civ's units are player-directed, not AI-directed.
    // Coordinates inside the mission text become clickable jumps to that
    // tile -- see linkifyCoords for why this is done on the rendered string
    // rather than by restructuring ai.js's mission strings.
    // "Order" row: a human unit can now ALSO be
    // mid-way through a multi-turn goto order (move/build-road-to -- see
    // orders.js's advanceGotoOrder, which sets currentMission every turn
    // it advances) that keeps executing automatically with no further
    // clicks -- distinct label from Spectator's "Mission" above so it
    // never reads as "this unit is AI-controlled now", just "here's what
    // it's already been told to do." Only shown while an order is
    // actually pending; a human unit with nothing queued gets no row at
    // all (unlike Spectator's permanent "Awaiting orders" fallback --
    // there's no ambiguity to resolve for a player-directed unit that's
    // simply idle).
    // "Intent" row: an automated human unit's
    // equivalent of Spectator's "Mission" row above -- shows what the real
    // AI logic decided this unit should do, or (if it just staged a
    // pendingIntent awaiting confirmation -- see ai.js's unit.automated
    // gates / main.js's offerNextPendingIntent) that proposal specifically,
    // so the player can see it's waiting on them even outside the modal.
    // Ranked below a manual "Order" row: a player-issued goto order on an
    // automated unit is a deliberate one-off override and takes visible
    // priority until it finishes, same as it silently does functionally
    // (advanceGotoOrder runs regardless of unit.automated).
    const missionTag = (!viewState.humanCivId)
      ? `<div class="stat-row"><span>Mission</span><span>${linkifyCoords(unit.currentMission || 'Awaiting orders')}</span></div>`
      : (isHumanUnit && unit.gotoTarget)
        ? `<div class="stat-row"><span>Order</span><span>${linkifyCoords(unit.currentMission
            || (unit.gotoTarget.buildRoad
              ? `Building a road to (${unit.gotoTarget.x},${unit.gotoTarget.y})`
              : `Moving to (${unit.gotoTarget.x},${unit.gotoTarget.y})`))}</span></div>`
        : (isHumanUnit && unit.automated)
          ? `<div class="stat-row"><span>Intent</span><span>${linkifyCoords(unit.pendingIntent ? unit.pendingIntent.label : (unit.currentMission || 'Awaiting orders'))}</span></div>`
          : '';

    return `
      <div class="panel">
        <h2>${escapeHtml(baseUnit.label)}</h2>
        ${levelUpActions}
        ${unit.name ? `<div class="stat-row" style="font-style:italic;opacity:0.85"><span>${escapeHtml(unit.name)}</span></div>` : ''}
        <div class="stat-row"><span>Race</span><span>${escapeHtml(race.label)}</span></div>
        ${missionTag}
        <div class="stat-row"><span>HP</span><span>${unit.hp} / ${unit.maxHp}</span></div>
        <div class="stat-row"><span>Level</span><span>${levelLabel}</span></div>
        <div class="stat-row"><span>Attack</span><span>${Math.round(effAttack)}</span></div>
        <div class="stat-row"><span>Defense</span><span>${Math.round(effDefense)}</span></div>
        <div class="stat-row"><span>Movement</span><span>${baseUnit.movement}</span></div>
        <div class="stat-row"><span>Vision</span><span>${effVision}</span></div>
        <div class="stat-row"><span>Upkeep</span><span>${upkeep}</span></div>
        ${properties.length ? `<div class="stat-row"><span>Properties</span><span>${escapeHtml(properties.join(', '))}</span></div>` : ''}
        ${bonusParts.length ? `<div class="stat-row"><span>Veteran Bonuses</span><span>${escapeHtml(bonusParts.join(', '))}</span></div>` : ''}
        <div class="stat-row"><span>Position</span><span>(${unit.x}, ${unit.y})</span></div>
        ${carriedByTag}${carriesTag}
        ${turnStatus}
        ${pioneerActions}
        ${channelActions}
      </div>`;
  }

  /**
   * KINGDOM PANEL
   * -------------
   * The civ-wide view. Serves two callers: the "Kingdom" tab of whatever's on
   * the selected tile, and the default no-selection panel (always the human's
   * own civ there).
   *
   * INTEL REDACTION: clicking an enemy city would
   * otherwise hand the player that civ's stockpile, research, and net income
   * for free. Anything a player could plausibly infer from the map itself
   * (city/unit counts, territory share) stays visible; the economic and
   * research internals read "Unknown" for civs that aren't yours. Spectator
   * games (humanCivId === null) have no one to hide from, so they fall back
   * to full reveal automatically.
   */
  function renderKingdomPanel(civ, gameState, viewState) {
    if (!civ) return `<div class="panel"><em>Spectator mode -- no civ selected</em></div>`;
    const race = window.GameData.getRace(civ.raceId);
    const { counts, totalClaimable } = window.GameEngine.influence.countTerritory(gameState);
    const myTiles = counts[civ.id] || 0;
    // Percentage kept alongside the count purely as context for how much of
    // the world that is -- the win line itself is the tile count.
    const myShare = totalClaimable > 0 ? (myTiles / totalClaimable * 100) : 0;
    const isOwn = !viewState.humanCivId || civ.id === viewState.humanCivId;
    const UNKNOWN = `<span style="opacity:0.6">Unknown</span>`;

    let researchHtml = "<em>None selected</em>";
    if (civ.currentResearch) {
      const tech = window.GameData.getTech(civ.currentResearch);
      const pct = civ.researchTotalTurns
        ? Math.min(100, Math.floor(100 * (civ.researchTotalTurns - civ.researchTurnsRemaining) / civ.researchTotalTurns))
        : 0;
      researchHtml = `${escapeHtml(tech.label)} (${pct}%)`;
    }

    const totalPop = window.GameEngine.ai.totalPopulation(civ);
    const militaryCap = window.GameEngine.ai.computeMilitaryCap(civ);
    const militaryCount = civ.units.filter((u) => {
      const ud = window.GameData.getUnit(u.typeId);
      return ud.category === "military" && !ud.isNaval;
    }).length;

    // Economy -- moved here from the city panel, where it never belonged
    // (it's civ-wide data that happened to be rendered under a single city).
    // Upkeep is derived (10% of raw unit power across whichever resources
    // that split uses -- see GameData.unitUpkeep), not a flat stored value.
    const res = civ.resources || { harvest: 0, coin: 0, lore: 0 };
    const stock = civ.stockpile;
    const upkeep = civ.units.reduce((acc, u) => {
      const up = window.GameData.unitUpkeep(u.typeId, civ, u);
      acc.harvest += up.harvest || 0; acc.coin += up.coin || 0; acc.lore += up.lore || 0;
      return acc;
    }, { harvest: 0, coin: 0, lore: 0 });
    // Net is income minus upkeep. Called out on its own row because a
    // negative net is exactly the thing you want to notice, and eyeballing
    // the subtraction across two three-number rows reliably hides it.
    const net = {
      harvest: res.harvest - upkeep.harvest,
      coin: res.coin - upkeep.coin,
      lore: res.lore - upkeep.lore,
    };
    // One row per resource (icon + label, Income, Upkeep, Net[, Stock])
    // instead of the old "Income (H / C / L)" triple-value rows -- see the
    // .economy-grid CSS doc comment for why. The Net column was removed
    // (2026-08-19, user-directed -- it was crowding the panel and text was
    // overlapping); its per-cell negative-net highlight now lands on the
    // Upkeep cell instead, still pinned to the actual offending resource.
    const RESOURCE_ROWS = [
      { key: "harvest", label: "Harvest", icon: "icon-harvest" },
      { key: "coin", label: "Coin", icon: "icon-coin" },
      { key: "lore", label: "Lore", icon: "icon-lore" },
    ];
    const economyHtml = isOwn ? `
        <div class="economy-grid${stock ? ' economy-grid-stock' : ''}">
          <div class="economy-grid-header"></div>
          <div class="economy-grid-header">Income</div>
          <div class="economy-grid-header">Upkeep</div>
          ${stock ? '<div class="economy-grid-header">Stock</div>' : ''}
          ${RESOURCE_ROWS.map(({ key, label, icon }) => {
            const negative = net[key] < 0;
            return `
          <div class="economy-res"><svg class="resource-icon"><use href="#${icon}"></use></svg>${label}</div>
          <div class="economy-val">${res[key].toFixed(1)}</div>
          <div class="economy-val${negative ? ' economy-negative' : ''}">${upkeep[key].toFixed(1)}</div>
          ${stock ? `<div class="economy-val">${stock[key].toFixed(0)}</div>` : ''}`;
          }).join("")}
        </div>`
      : `<div class="stat-row"><span>Income / Upkeep / Stockpile</span><span>${UNKNOWN}</span></div>`;

    return `
      <div class="panel">
        <h2>${escapeHtml(race.label)}</h2>
        ${isOwn ? '' : '<div class="stat-row"><em style="opacity:0.7">Foreign power — limited intelligence</em></div>'}
        <div class="stat-row"><span>Cities</span><span>${civ.cities.length}</span></div>
        <div class="stat-row"><span>Population</span><span>${totalPop}</span></div>
        <div class="stat-row"><span>Units</span><span>${civ.units.length}</span></div>
        <div class="stat-row"><span>Military (cap)</span><span>${militaryCount} / ${militaryCap}</span></div>
        <div class="stat-row"><span>Territory</span><span>${Math.round(myTiles)} / ${window.GameEngine.turns.VICTORY_TILE_TARGET} tiles</span></div>
        <div class="stat-row"><span>Share of World</span><span>${myShare.toFixed(1)}%</span></div>
        <h3>Economy</h3>
        ${economyHtml}
        <h3>Research</h3>
        <div class="stat-row">${isOwn ? researchHtml : UNKNOWN}</div>
        ${isOwn ? `<h3>Cities</h3>
        ${civ.cities.map((c) => {
          // Idle tag: same shared predicate the
          // End Turn nag and the map badge use -- see cities.js's
          // isCityIdle. An FYI, not an error, so it's styled with the
          // accent color rather than a danger red.
          const idle = window.GameEngine.cities.isCityIdle(civ, c, gameState);
          const idleTag = idle ? `<span class="idle-tag" title="Not producing anything">Idle</span> ` : '';
          return `<div class="stat-row">${tileLink(c.x, c.y, c.name, "city")}<span>${idleTag}pop ${c.population.toFixed(0)}</span></div>`;
        }).join("")}
        ${civ.id !== window.GameConfig.worldEncounters.monsters.civId
          ? `<button class="action-btn view-tech-tree-btn" data-civ-id="${escapeHtml(civ.id)}">View Tech Tree</button>` : ''}` : ''}
      </div>`;
  }

  /** City build-queue progress, 0-100 -- two different shapes depending on
   *  cost model (see ai.js's progressBuildQueue): power-based unit/influence
   *  builds count DOWN turnsRemaining against the totalTurns stamped when
   *  the build started, while legacy coin-accumulation builds (buildings,
   *  and the 3 units with no associated tech) count UP progress against
   *  coinCost. Fixed 2026-07-21 -- previously always read the coin-
   *  accumulation shape unconditionally, showing NaN% for every power-based
   *  build. */
  function buildQueuePct(item) {
    if (item.turnsRemaining !== undefined) {
      if (!item.totalTurns) return 0;
      return Math.min(100, Math.floor(100 * (item.totalTurns - item.turnsRemaining) / item.totalTurns));
    }
    return Math.min(100, Math.floor(100 * item.progress / item.coinCost));
  }

  /**
   * TILE LINKS
   * --------------------------------------
   * Any place the sidebar names a specific tile can make it clickable:
   * clicking recenters the map there, selects the tile, and (optionally)
   * opens a particular tab of the inspector. main.js wires every .tile-link
   * in one place from its data-* attributes -- see its redraw().
   *
   * `tabKind` is a selection tab kind ("city", "unit", "structure",
   * "terrain", "kingdom") or null to leave whichever tab the normal
   * click-selection rules pick.
   */
  function tileLink(x, y, label, tabKind) {
    return `<button class="tile-link" data-tile-x="${x}" data-tile-y="${y}"` +
      `${tabKind ? ` data-tile-tab="${escapeHtml(tabKind)}"` : ""}>${escapeHtml(label)}</button>`;
  }

  /**
   * Turns every "(x,y)" in a plain-text string into a tile link. Used on
   * AI mission text, which already embeds the target tile's coordinates
   * everywhere it has one -- a Runeforged Titan marching on a city, a unit
   * chasing another, a warband swarming toward contact (see ai.js's
   * currentMission assignments). Linkifying the coordinates covers all of
   * those at once, instead of restructuring every mission string into
   * separate text-plus-target fields.
   *
   * Escapes first, then substitutes, so `text` is never trusted as markup
   * and the injected buttons are the only HTML in the result.
   */
  function linkifyCoords(text) {
    return escapeHtml(text).replace(/\((\d+)\s*,\s*(\d+)\)/g, (match, x, y) =>
      `<button class="tile-link" data-tile-x="${x}" data-tile-y="${y}">${match}</button>`);
  }

  /** A {harvest, coin, lore} bonus object as "+1 Harvest, +1 Coin". Shared by
   *  every tile-feature row so resources, ruins and rivers all read alike. */
  function formatBonus(bonus) {
    return Object.entries(bonus)
      .map(([k, v]) => `+${v} ${k.charAt(0).toUpperCase()}${k.slice(1)}`)
      .join(", ");
  }

  /** Renders a small HP-style meter: color
   *  shifts green -> yellow -> red as the remaining fraction drops, same
   *  traffic-light convention most strategy games use for "how much is left
   *  before this is gone." `cur` is clamped at 0 for the fraction (a
   *  just-destroyed structure can carry a negative hp mid-resolution) so a
   *  bar that's actually hit 0 always renders fully drained, never a
   *  leftover sliver. */
  function hpBarHtml(cur, max) {
    const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((100 * Math.max(0, cur)) / max))) : 0;
    const color = pct > 50 ? "#6fbf6f" : pct > 25 ? "#e0c05a" : "#d9695f";
    return `<div class="hp-bar"><div class="hp-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.UI.sidebar = { render, levelUpChoicesHtml };
})();
