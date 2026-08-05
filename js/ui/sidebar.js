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

    let html = "";

    // Placement mode is modal -- left-click means "put it here" until it
    // resolves -- so it needs to say so loudly, above everything else.
    if (viewState.placement) {
      html += `<div class="placement-banner">
        <strong>Placing ${escapeHtml(viewState.placement.label)}</strong>
        <div>Click a highlighted tile on the map.<br>Click anywhere else to cancel.</div>
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
    // Research (2026-08-03, user-reported): the only way in used to be a
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

    html += `<div class="sidebar-footer">
      ${researchHtml}
      ${cyclerHtml}
      <div class="turn-counter">Turn ${turnNumber}</div>
      <button id="end-turn-btn" class="end-turn-btn">End Turn</button>
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
    // City HP (2026-08-04, user-directed): a real damage-accumulating pool
    // now -- see combat.js's attackCity/cityMaxHp -- population-per-level,
    // refilled on growth, clamped on starvation, reset to the new (smaller)
    // max when a hit empties it and knocks off a level. cityHp falls back
    // to a full pool for a city from an older save that predates this field.
    const cityMaxHp = window.GameEngine.combat.cityMaxHp(city);
    const cityHp = city.hp != null ? Math.max(0, city.hp) : cityMaxHp;
    const atCap = pop >= maxPop;
    const growthThreshold = pop * pop * (window.GameEngine.cities.GROWTH_THRESHOLD_PER_POP || 400.0);
    const growthPct = atCap ? 100 : Math.min(100, Math.floor(100 * city.harvestSurplus / growthThreshold));
    const portTag = city.isPort ? ' <em>(Port)</em>' : '';
    const radiusTileCount = (2 * city.influenceRadius + 1) ** 2;
    const filledTileCount = city.filledOffsets ? city.filledOffsets.size : 0;

    // Garrison (2026-08-01, user-directed): units standing on the city tile.
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
        <div class="stat-row"><span>Population</span><span>${pop} / ${maxPop}</span></div>
        <div class="stat-row"><span>Growth</span><span>${atCap ? 'Max size' : `${city.harvestSurplus.toFixed(1)} / ${growthThreshold.toFixed(0)} (${growthPct}%)`}</span></div>
        <div class="stat-row"><span>Influence Radius</span><span>${city.influenceRadius}</span></div>
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
   * The city's production: what's building now, and (for the player's own
   * cities) a picker for what to build next.
   *
   * An AI city gets the read-only progress row it always had -- there's
   * nothing for the player to decide there.
   */
  function renderBuildSection(city, civ, gameState, viewState) {
    const isOwnCity = viewState && viewState.humanCivId && city.civId === viewState.humanCivId;

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
      // "Select Next City's Production" (2026-08-06, user-directed): once
      // THIS city's production is set, jump straight to the next city that
      // still needs one instead of leaving the player to hunt for it via
      // the Kingdom tab or the End Turn nag -- same "needs production"
      // criteria collectUnresolvedTurnWork already uses (no queue, and at
      // least one option it can actually afford right now).
      const nextCity = isOwnCity ? civ.cities.find((c) => c !== city && !c.buildQueue
        && window.GameEngine.ai.availableBuilds(civ, c, gameState).some((o) => o.affordable)) : null;
      const nextCityBtn = nextCity
        ? `<button id="next-city-production-btn" class="action-btn" data-city-key="${escapeHtml(cityKey(nextCity))}">Select Next City's Production</button>`
        : "";
      return `<h3>Building</h3>
        <div class="stat-row"><span>${escapeHtml(label)}${placeTag}</span><span>${escapeHtml(turnsTag)}</span></div>
        <div class="build-progress"><div class="build-progress-fill" style="width:${buildQueuePct(item)}%"></div></div>
        ${isOwnCity ? `<button id="cancel-build-btn" class="action-btn action-btn-danger">Cancel Build</button>` : ""}
        ${nextCityBtn}`;
    }

    if (!isOwnCity) return `<h3>Building</h3><div class="stat-row"><em>Nothing queued</em></div>`;

    // The picker itself. Collapsed behind a button by default -- the full
    // list can run to a dozen entries and would otherwise bury the city's own
    // stats every time you glance at it.
    const open = viewState.buildPickerCityId === cityKey(city);
    if (!open) {
      return `<h3>Building</h3>
        <div class="stat-row"><em>Nothing queued</em></div>
        <button id="open-build-picker-btn" class="action-btn" data-city-key="${escapeHtml(cityKey(city))}">Choose Production…</button>`;
    }

    const options = window.GameEngine.ai.availableBuilds(civ, city, gameState);
    if (!options.length) {
      return `<h3>Building</h3><div class="stat-row"><em>Nothing available to build</em></div>`;
    }
    const units = options.filter((o) => o.kind === "unit");
    const buildings = options.filter((o) => o.kind === "building");

    // Stockpile readout + per-resource cost coloring (2026-08-04, user-
    // directed): a build's cost used to be the ONLY number on screen --
    // reading "unaffordable" meant trusting the greyed-out state and
    // guessing which resource(s) were short and by how much, with no way to
    // check the actual stockpile without leaving this picker for the
    // Kingdom tab. Each cost token is now colored green/red against
    // civ.stockpile (same convention as sidebar's own HP-bar meter --
    // hpBarHtml's colors), and the stockpile itself is shown right above the
    // list so "green/red against WHAT" is never a mystery.
    const stock = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    const RESOURCE_LABEL = { harvest: "Harvest", coin: "Coin", lore: "Lore" };
    const costTokenHtml = (key, amount) => {
      const have = stock[key] || 0;
      const color = have >= amount ? "#6fbf6f" : "#d9695f";
      const short = have >= amount ? "" : ` title="Short ${(amount - have).toFixed(0)} ${RESOURCE_LABEL[key]} (have ${have.toFixed(0)})"`;
      return `<span style="color:${color}"${short}>${amount}${key[0].toUpperCase()}</span>`;
    };
    const stockpileHtml = `<div class="stat-row"><span>Stockpile (H / C / L)</span>`
      + `<span>${stock.harvest.toFixed(0)} / ${stock.coin.toFixed(0)} / ${stock.lore.toFixed(0)}</span></div>`;

    const row = (o, i) => {
      const priceHtml = o.cost
        ? Object.entries(o.cost).map(([k, v]) => costTokenHtml(k, v)).join(" ")
        : costTokenHtml("coin", o.coinCost || 0);
      // Spelled out, not "Nt" (2026-08-04, user-reported): a bare "2t" sat
      // directly next to the H/C/L-style resource tokens above and read as
      // a fourth resource abbreviation rather than a turn count.
      const time = o.turns ? `${o.turns} turn${o.turns === 1 ? "" : "s"}` : "";
      const needsPlacement = o.kind === "building";
      return `<button class="build-option${o.affordable ? "" : " build-option-unaffordable"}"
          data-build-index="${i}" ${o.affordable ? "" : "disabled"}>
        <span>${escapeHtml(o.label)}${needsPlacement ? " ⌂" : ""}</span>
        <span>${priceHtml}${time ? ` · ${escapeHtml(time)}` : ""}</span>
      </button>`;
    };

    // Indices are into the FULL options array, so the click handler can look
    // the option straight back up without re-deriving the split.
    const indexed = options.map((o, i) => ({ o, i }));
    const unitRows = indexed.filter(({ o }) => o.kind === "unit").map(({ o, i }) => row(o, i)).join("");
    const buildingRows = indexed.filter(({ o }) => o.kind === "building").map(({ o, i }) => row(o, i)).join("");

    return `<h3>Choose Production</h3>
      ${stockpileHtml}
      ${units.length ? `<div class="build-group-label">Units</div>${unitRows}` : ""}
      ${buildings.length ? `<div class="build-group-label">Buildings <span style="opacity:0.6">⌂ = pick a tile</span></div>${buildingRows}` : ""}
      <button id="close-build-picker-btn" class="action-btn">Cancel</button>`;
  }

  /** Cities have no stable id field, but (x,y) is unique and never changes. */
  function cityKey(city) { return `${city.x},${city.y}`; }

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
    // heading (2026-08-03, user-reported): a Ruin used to be a bare stat-row
    // with a hand-written "+2 Lore" while a Resource got its own "Resource"
    // heading and a bonus string derived from the data -- two presentations
    // for the same kind of thing. All four now share the label/bonus shape,
    // and every bonus string is derived (see terrain.js's RESOURCES,
    // RIVER_YIELD_BONUS and RUIN_YIELD_BONUS) so the panel can't claim a
    // number the yield code doesn't actually pay.
    const featureRows = [];
    if (resource) featureRows.push([resource.label, formatBonus(resource.bonus)]);
    if (tile.isRuin) featureRows.push([window.GameData.RUIN_LABEL, formatBonus(window.GameData.RUIN_YIELD_BONUS)]);
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
        ${featuresHtml}
        <div class="stat-row"><span>Position</span><span>(${tile.x}, ${tile.y})</span></div>
        ${contentsHtml}
      </div>`;
  }

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
    if (b.coinPerAdjacentRoad) effects.push(`+${b.coinPerAdjacentRoad} coin / adjacent road`);
    if (b.lorePerAdjacentForest) effects.push(`+${b.lorePerAdjacentForest} lore / adjacent forest`);
    if (b.contestedYieldPenaltyOverride) effects.push(`contested tiles yield ${Math.round(b.contestedYieldPenaltyOverride * 100)}%`);
    if (b.unitCostMult) effects.push(`unit cost ×${b.unitCostMult}`);
    if (b.raiseDeadPowerBonus) effects.push(`+${Math.round(b.raiseDeadPowerBonus * 100)}% raised power`);

    return `
      <div class="panel">
        <h2>${escapeHtml(b.label)}</h2>
        <div class="stat-row"><span>Race</span><span>${escapeHtml(race.label)}</span></div>
        <div class="stat-row"><span>Owner City</span><span>${escapeHtml(sel.city.name)}</span></div>
        <div class="stat-row"><span>HP</span><span>${Math.max(0, rec.hp)} / ${rec.maxHp}</span></div>
        ${hpBarHtml(rec.hp, rec.maxHp)}
        <div class="stat-row"><span>Position</span><span>(${rec.x}, ${rec.y})</span></div>
        <h3>Effect</h3>
        <div class="stat-row">${effects.length ? escapeHtml(effects.join(", ")) : "<em>—</em>"}</div>
        <div class="stat-row"><em>Can be attacked and destroyed by enemy units.</em></div>
      </div>`;
  }

  function renderUnitPanel(unit, civs, viewState, gameState) {
    const civ = civs[unit.civId];
    const race = window.GameData.getRace(civ.raceId);
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const isHumanUnit = viewState && unit.civId === viewState.humanCivId;

    // Settler actions: found a city, build a road. Gated on the unit-data
    // flags (canFoundCity/canBuildRoad) rather than typeId === "pioneer", so
    // the other settler-capable units (Elf Druid, Undead Wanderer) get the
    // same controls the AI already gives itself for them (see ai.js's
    // maybeFoundCity, which is likewise flag-driven).
    let pioneerActions = "";
    if ((baseUnit.canFoundCity || baseUnit.canBuildRoad) && isHumanUnit && gameState) {
      const tile = gameState.map.tiles[unit.y * gameState.map.width + unit.x];
      const canFoundCheck = baseUnit.canFoundCity
        ? window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, unit.x, unit.y, civ.raceId)
        : { ok: false, reason: null };
      const canBuildRoad = baseUnit.canBuildRoad && !tile.hasRoad && !unit.usedThisTurn;

      pioneerActions = `<h3>Actions</h3>`;
      if (!unit.usedThisTurn) {
        // A real button, not a "use End Turn to confirm" note (2026-08-03,
        // user-reported): founding was previously only reachable from the
        // end-turn settler sweep, so there was no way to ask for a city the
        // moment the pioneer arrived. See main.js's handleFoundCity.
        if (canFoundCheck.ok) {
          pioneerActions += `<button id="found-city-btn" class="action-btn action-btn-primary">Found City</button>`;
        } else if (baseUnit.canFoundCity && canFoundCheck.reason) {
          pioneerActions += `<div class="stat-row"><em style="color:#f0a830">Cannot found here: ${escapeHtml(canFoundCheck.reason)}</em></div>`;
        }
        if (canBuildRoad) {
          pioneerActions += `<button id="build-road-btn" class="action-btn">Build Road</button>`;
        } else if (baseUnit.canBuildRoad && tile.hasRoad) {
          pioneerActions += `<div class="stat-row"><span>Road</span><span>Already built here</span></div>`;
        }
      } else {
        pioneerActions += `<div class="stat-row"><em>Already acted this turn</em></div>`;
      }
    }

    // Channeled actions (2026-07-21, user-directed): Prospector's Claim,
    // Dungeon Delve, and Galley Fishing are all explicitly-started,
    // explicitly-cancelled channels now (see turns.js's onAnchor gate on
    // unit.channeling) rather than something that "just happens" from
    // standing still -- these buttons are the player's own start/cancel
    // controls, mirroring ai.js's maybeProspectorsClaimPlay/
    // maybeDungeonDelvePlay/maybeGalleyFishingPlay for the AI side.
    let channelActions = "";
    if (isHumanUnit && gameState) {
      const tile = gameState.map.tiles[unit.y * gameState.map.width + unit.x];
      // "hunting"/"farming" (2026-08-05, user-directed): Pioneer/Scout's own
      // two channeled actions -- Hunt Game (Game tiles) and Farm Soil
      // (Fertile Soil tiles), each gated behind its own Tier 0 tech
      // (techs.js's hunt_game/farm_soil) -- replaced a single free
      // "surveying" action with a generic "Start Prospecting" button.
      // Distinct unit.channeling values from Dwarf's "prospecting"
      // (Prospector's Claim) even though the tag on that one also reads
      // "Prospecting" -- these are separate mechanics (flat-rate/no-claim,
      // like Galley Fishing below, not Prospector's Claim's territorial
      // claim-and-tier system) and reusing its string would make turns.js's
      // dwarf-only gating fire for the wrong units.
      const CHANNEL_LABELS = { prospecting: "Prospecting", delving: "Delving", fishing: "Fishing", hunting: "Hunting", farming: "Farming" };
      if (unit.channeling && CHANNEL_LABELS[unit.channeling]) {
        channelActions = `<h3>Actions</h3>`;
        const turnsIn = unit._ritualTurns || 0;
        if (turnsIn > 0) {
          channelActions += `<div class="stat-row"><span>${CHANNEL_LABELS[unit.channeling]}</span><span>${turnsIn} turn${turnsIn === 1 ? "" : "s"}</span></div>`;
        }
        // Claim Gathered Resources (2026-08-06, user-directed): a clean
        // voluntary stop that BANKS whatever's accumulated in
        // unit._channelStash into the civ's stockpile -- mirrors ai.js's
        // maybeCashOutChannel (the AI's own "voluntary stop" path), just
        // triggered by the player instead of a value/danger heuristic.
        // Distinct from "Cancel" below, which is a FORCED-style
        // interruption that forfeits the stash entirely (turns.js's own
        // documented rule) -- both stay available side by side so the
        // player can choose collect-and-stop vs. just-abandon.
        channelActions += `<button id="claim-channel-btn" class="action-btn">Claim Gathered Resources</button>`;
        channelActions += `<button id="cancel-channel-btn" class="action-btn action-btn-danger">Cancel ${CHANNEL_LABELS[unit.channeling]}</button>`;
      } else if (!unit.usedThisTurn && !unit.channeling) {
        // !unit.channeling here excludes "garrison" (2026-08-06) -- it isn't
        // in CHANNEL_LABELS above, so without this it would fall through to
        // these resource-channel start buttons instead of showing none, the
        // same way a unit mid-hunt/prospect correctly shows none.
        const onVein = tile.resource === "gold" || tile.resource === "iron";
        const onGame = tile.resource === "game";
        const onFertile = tile.resource === "fertile";
        if (civ.raceId === "dwarf" && civ.unlockedMechanics && civ.unlockedMechanics.has("prospectors_claim") && onVein) {
          channelActions = `<h3>Actions</h3>`;
          channelActions += `<button id="start-prospecting-btn" class="action-btn">Start Prospecting</button>`;
        } else if (unit.typeId === "wizard" && civ.unlockedMechanics && civ.unlockedMechanics.has("dungeon_delve") && tile.isRuin) {
          channelActions = `<h3>Actions</h3>`;
          channelActions += `<button id="start-delving-btn" class="action-btn">Start Delving</button>`;
        } else if (unit.typeId === "galley" && !unit.carries && tile.resource === "fish") {
          channelActions = `<h3>Actions</h3>`;
          channelActions += `<button id="start-fishing-btn" class="action-btn">Start Fishing</button>`;
        } else if (baseUnit.canProspect && onGame && civ.unlockedMechanics && civ.unlockedMechanics.has("hunt_game")) {
          channelActions = `<h3>Actions</h3>`;
          channelActions += `<button id="start-hunting-btn" class="action-btn">Hunt Game</button>`;
        } else if (baseUnit.canProspect && onFertile && civ.unlockedMechanics && civ.unlockedMechanics.has("farm_soil")) {
          channelActions = `<h3>Actions</h3>`;
          channelActions += `<button id="start-farming-btn" class="action-btn">Farm Soil</button>`;
        }
      }
    }

    // Hidden/stealth (2026-08-03, user-reported): Halfellow's "Sneaking
    // Around", Elf's "Shadowed Hush, Unseen", and the two unit-specific
    // variants (Human Wizard's Invisibility, Halfellow Trouble Maker's
    // Making Trouble) all fed a real engine mechanic (combat.js's
    // canGoHidden/enterHidden/revealHidden) that only ever had AI call
    // sites -- researching any of these techs unlocked the ABILITY with no
    // way for a human player to actually use it. A full-turn action to
    // enter Hidden, matching enterHidden's own contract; canceling early is
    // free (see the tech's own "voluntarily cancellable early" wording) and
    // reuses revealHidden, the same path a forced reveal takes -- both route
    // through the same 1-turn "forced visible" cooldown before re-hiding.
    let stealthActions = "";
    if (isHumanUnit && gameState) {
      if (unit.conditions?.hidden) {
        stealthActions = `<h3>Actions</h3><button id="cancel-hidden-btn" class="action-btn">Cancel Hidden</button>`;
      } else if (!unit.usedThisTurn && window.GameEngine.combat.canGoHidden(unit, civ, gameState.civs)) {
        stealthActions = `<h3>Actions</h3><button id="go-hidden-btn" class="action-btn">Go Hidden</button>`;
      }
    }

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

    // Player-facing level-up picker (2026-08-04, user-reported): ai.js's
    // applyComputedXP now leaves a human-controlled unit's level-up PENDING
    // (see combat.js's pendingLevelUps) rather than auto-spending it via the
    // AI's own chooseLevelUpStat heuristic. Shown at the very top of the
    // panel, above even HP, so it can't be missed the next time this unit is
    // selected -- and each button applies one level immediately, looping
    // back here (via redraw) if more than one point is still pending (a big
    // single XP grant, e.g. a signature kill, can vault more than one
    // threshold at once).
    let levelUpActions = "";
    if (isHumanUnit) {
      const combat = window.GameEngine.combat;
      const pendingCount = combat.pendingLevelUps(unit);
      if (pendingCount > 0) {
        const LEVEL_UP_LABELS = {
          attack: "Attack", defense: "Defense", siegePct: "Siege",
          firstStrikePct: "First Strike", doubleStrikePct: "Double Strike",
        };
        const currentValue = { attack: effAttack, defense: effDefense, siegePct, firstStrikePct, doubleStrikePct };
        const isPct = (stat) => stat === "siegePct" || stat === "firstStrikePct" || stat === "doubleStrikePct";
        const fmt = (stat, v) => isPct(stat) ? `${Math.round(v * 100)}%` : Math.round(v);
        const buttons = combat.LEVEL_UP_STATS.map((stat) => {
          const bonus = combat.LEVEL_BONUS_VALUES[stat];
          return `<button class="action-btn action-btn-primary level-up-btn" data-level-up-stat="${stat}">`
            + `${LEVEL_UP_LABELS[stat]} (${fmt(stat, currentValue[stat])} &rarr; ${fmt(stat, currentValue[stat] + bonus)})</button>`;
        }).join("");
        levelUpActions = `<div class="placement-banner">
          <strong>Level Up!${pendingCount > 1 ? ` (${pendingCount} pending)` : ''}</strong>
          <div>Choose a veteran bonus:</div>
          ${buttons}
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
    if (curse) properties.push(`Cursed (${Math.round((1 - curse.attackMult) * 100)}% attack, ${Math.round((1 - curse.moveMult) * 100)}% move)`);
    if (unit.conditions?.exhausted) properties.push('Exhausted (must Rest)');
    const frozen = unit.conditions?.frozen;
    if (frozen) properties.push(`Frozen (0 movement, ${Math.round((1 - frozen.attackMult) * 100)}% attack)`);
    const killMomentum = unit.conditions?.killMomentum;
    if (killMomentum) {
      properties.push(`Violent Momentum (+${killMomentum.moveBonus} movement`
        + (killMomentum.firstStrikePctBonus ? `, +${Math.round(killMomentum.firstStrikePctBonus * 100)}% first strike` : '')
        + (killMomentum.doubleStrikePctBonus ? `, +${Math.round(killMomentum.doubleStrikePctBonus * 100)}% double strike` : '')
        + ')');
    }
    const flightGrant = unit.conditions?.flying;
    if (flightGrant && flightGrant.moveBonus) properties.push(`Granted Flight (+${flightGrant.moveBonus} movement, +${flightGrant.visionBonus} vision)`);
    if (unit.conditions?.hidden) properties.push('Hidden');
    if (unit.conditions?.forcedVisible) properties.push('Forced Visible (cannot re-Hide yet)');
    const crusadeAura = unit.conditions?.crusadeAura;
    if (crusadeAura) properties.push(`Crusade Aura (+${crusadeAura.attackBonus} attack, +${crusadeAura.defenseBonus} defense, +${Math.round(crusadeAura.siegePctBonus * 100)}% siege)`);
    const heavyMetalAura = unit.conditions?.heavyMetalAura;
    if (heavyMetalAura) properties.push(`Heavy Metal Aura (+${heavyMetalAura.defenseBonus} defense, +${Math.round(heavyMetalAura.siegePctBonus * 100)}% siege, 5% heal/turn)`);
    const powerMetalAura = unit.conditions?.powerMetalAura;
    if (powerMetalAura) properties.push(`Power Metal Aura (+${powerMetalAura.attackBonus} attack, +${Math.round(powerMetalAura.firstStrikePctBonus * 100)}% first strike)`);
    // Garrison (2026-08-06, user-directed) reads the label differently even
    // though it's the SAME "defending" condition underneath -- Garrison's
    // whole point is that it does NOT lapse "until next turn" the way a
    // plain Defend click does.
    if (unit.conditions?.defending) {
      properties.push(unit.channeling === "garrison" ? 'Garrisoned (x2 defense)' : 'Defending (x2 defense until next turn)');
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
    if (bonusParts.length) properties.push(`Veteran bonuses: ${bonusParts.join(', ')}`);

    // Veteran leveling: level 0-MAX_UNIT_LEVEL, progress toward the next
    // level shown as raw XP / the next cumulative threshold (see combat.js's
    // XP_LEVEL_THRESHOLDS) -- "(max)" once it's capped out.
    const unitLevel = unit.level || 0;
    const maxUnitLevel = window.GameEngine.combat.MAX_UNIT_LEVEL;
    const nextXpThreshold = window.GameEngine.combat.XP_LEVEL_THRESHOLDS[unitLevel];
    const levelLabel = unitLevel >= maxUnitLevel
      ? `${unitLevel} (max)`
      : `${unitLevel} (${Math.floor(unit.xp || 0)} / ${nextXpThreshold} XP)`;

    // Turn status (2026-08-01, user-directed): the action economy is movement
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
        <div class="stat-row"><em style="opacity:0.7">Right-click the map for a menu of actions</em></div>`;
    }

    const canRest = isHumanUnit && !unit.usedThisTurn;
    const restBtn = canRest ? `<button id="rest-unit-btn" class="action-btn">Rest</button>` : '';
    // Defend (2026-07-20, user-directed): a universal normal action, any
    // race/unit -- same availability gate as Rest (human-controlled, not
    // already acted this turn).
    const canDefend = isHumanUnit && !unit.usedThisTurn;
    const defendBtn = canDefend ? `<button id="defend-unit-btn" class="action-btn">Defend</button>` : '';
    // Garrison (2026-08-06, user-directed): the channeled twin of Defend --
    // same x2 defense, but stays braced turn after turn with no re-prompt
    // (see main.js's handleGarrisonUnit/turns.js's finishCivTurn refresh)
    // until Cancel Garrison or any other order ends it. Only offered while
    // standing in one of this civ's own cities.
    const inOwnCityForGarrison = isHumanUnit && gameState
      && civ.cities.some((c) => c.x === unit.x && c.y === unit.y);
    const garrisonBtn = unit.channeling === "garrison"
      ? `<button id="cancel-garrison-btn" class="action-btn action-btn-danger">Cancel Garrison</button>`
      : (inOwnCityForGarrison && !unit.usedThisTurn && !unit.channeling)
        ? `<button id="garrison-unit-btn" class="action-btn">Garrison</button>` : '';
    const disbandBtn = isHumanUnit ? `<button id="disband-unit-btn" class="action-btn action-btn-danger">Disband Unit</button>` : '';
    // Stop Order (2026-08-06, user-directed): a sidebar-reachable twin of
    // the context menu's own "Stop" entry (right-click the unit's own
    // tile) -- discoverable without knowing that trick, for a unit
    // currently mid-way through a queued multi-turn move/build-road order.
    const stopOrderBtn = (isHumanUnit && unit.gotoTarget)
      ? `<button id="stop-order-btn" class="action-btn action-btn-danger">Stop Order</button>` : '';

    // Automate Actions (2026-08-06, user-directed): hands this unit's turn-
    // by-turn decisions to the real AI logic (see ai.js's
    // runAutomatedUnitTurn/turns.js's finishCivTurn hook), gated only on
    // "player's own unit" -- no unit-type restriction, same as the pioneer/
    // combat/summon confirmation gates threaded into the AI functions
    // themselves. Turning it off also drops any pendingIntent still
    // awaiting confirmation -- a no-longer-automated unit shouldn't have a
    // stale proposal hanging over it.
    const automateBtn = isHumanUnit
      ? `<button id="automate-actions-btn" class="action-btn${unit.automated ? " action-btn-danger" : ""}">${unit.automated ? "Stop Automating" : "Automate Actions"}</button>`
      : '';

    // Spectator-only: every unit in a spectator game is AI-controlled, so
    // ai.js stamps a human-readable currentMission on it each turn (see
    // maybeMoveUnits/maybeFoundCity/operateGalley etc.) describing whatever
    // it just decided to do. Not shown in a human player's own game since
    // that civ's units are player-directed, not AI-directed.
    // Coordinates inside the mission text become clickable jumps to that
    // tile -- see linkifyCoords for why this is done on the rendered string
    // rather than by restructuring ai.js's mission strings.
    // "Order" row (2026-08-06, user-directed): a human unit can now ALSO be
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
    // "Intent" row (2026-08-06, user-directed): an automated human unit's
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
        <div class="stat-row"><span>Position</span><span>(${unit.x}, ${unit.y})</span></div>
        ${carriedByTag}${carriesTag}
        ${turnStatus}
        ${pioneerActions}
        ${channelActions}
        ${stealthActions}
        ${stopOrderBtn}
        ${restBtn}
        ${defendBtn}
        ${garrisonBtn}
        ${automateBtn}
        ${disbandBtn}
      </div>`;
  }

  /**
   * KINGDOM PANEL
   * -------------
   * The civ-wide view. Serves two callers: the "Kingdom" tab of whatever's on
   * the selected tile, and the default no-selection panel (always the human's
   * own civ there).
   *
   * INTEL REDACTION (2026-08-01, user-directed): clicking an enemy city would
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
    const myShare = totalClaimable > 0 ? ((counts[civ.id] || 0) / totalClaimable * 100) : 0;
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
    const netIsNegative = net.harvest < 0 || net.coin < 0 || net.lore < 0;
    const fmt3 = (o, dp = 1) => `${o.harvest.toFixed(dp)} / ${o.coin.toFixed(dp)} / ${o.lore.toFixed(dp)}`;

    const economyHtml = isOwn ? `
        <div class="stat-row"><span>Income (H / C / L)</span><span>${fmt3(res)}</span></div>
        <div class="stat-row"><span>Unit Upkeep (H / C / L)</span><span>${fmt3(upkeep)}</span></div>
        <div class="stat-row"><span>Net (H / C / L)</span><span${netIsNegative ? ' style="color:#f0a830"' : ''}>${fmt3(net)}</span></div>
        ${stock ? `<div class="stat-row"><span>Stockpile (H / C / L)</span><span>${fmt3(stock, 0)}</span></div>` : ''}`
      : `<div class="stat-row"><span>Income / Upkeep / Stockpile</span><span>${UNKNOWN}</span></div>`;

    return `
      <div class="panel">
        <h2>${escapeHtml(race.label)}</h2>
        ${isOwn ? '' : '<div class="stat-row"><em style="opacity:0.7">Foreign power — limited intelligence</em></div>'}
        <div class="stat-row"><span>Cities</span><span>${civ.cities.length}</span></div>
        <div class="stat-row"><span>Population</span><span>${totalPop}</span></div>
        <div class="stat-row"><span>Units</span><span>${civ.units.length}</span></div>
        <div class="stat-row"><span>Military (cap)</span><span>${militaryCount} / ${militaryCap}</span></div>
        <div class="stat-row"><span>Territory Share</span><span>${myShare.toFixed(1)}%</span></div>
        <h3>Economy</h3>
        ${economyHtml}
        <h3>Research</h3>
        <div class="stat-row">${isOwn ? researchHtml : UNKNOWN}</div>
        ${isOwn ? `<h3>Cities</h3>
        ${civ.cities.map((c) => `<div class="stat-row">${tileLink(c.x, c.y, c.name, "city")}<span>pop ${c.population.toFixed(0)}</span></div>`).join("")}
        <button class="action-btn view-tech-tree-btn" data-civ-id="${escapeHtml(civ.id)}">View Tech Tree</button>` : ''}
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
   * TILE LINKS (2026-08-03, user-directed)
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

  /** Renders a small HP-style meter (2026-08-04, user-reported): color
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

  window.UI.sidebar = { render };
})();
