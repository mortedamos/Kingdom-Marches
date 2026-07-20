/**
 * SIDEBAR UI
 * ----------
 * Updates the persistent sidebar panel: selected city/unit detail, or a
 * civ-wide summary when nothing is selected, plus the End Turn button.
 * See map_ui_design.md §1 for the layout this implements.
 */

window.UI = window.UI || {};

(function () {
  function render(container, gameState, viewState) {
    const { civs, turnNumber } = gameState;
    const humanCiv = civs[viewState.humanCivId];

    let html = "";

    if (viewState.selectedCity) {
      html += renderCityPanel(viewState.selectedCity, civs);
    } else if (viewState.selectedUnit) {
      html += renderUnitPanel(viewState.selectedUnit, civs, viewState, gameState);
    } else if (viewState.selectedStructure) {
      html += renderStructurePanel(viewState.selectedStructure);
    } else if (viewState.selectedTile) {
      html += renderTilePanel(viewState.selectedTile, civs);
    } else {
      html += renderCivSummary(humanCiv, gameState);
    }

    html += `<div class="sidebar-footer">
      <div class="turn-counter">Turn ${turnNumber}</div>
      <button id="end-turn-btn" class="end-turn-btn">End Turn</button>
    </div>`;

    container.innerHTML = html;
  }

  function renderCityPanel(city, civs) {
    const civ = civs[city.civId];
    const race = civ ? window.GameData.getRace(civ.raceId) : null;
    const y = city.lastYield || { harvest: 0, coin: 0, lore: 0 };
    const pop = Math.floor(city.population);
    const maxPop = window.GameEngine.cities.MAX_CITY_POPULATION || 6;
    const atCap = pop >= maxPop;
    const growthThreshold = pop * pop * (window.GameEngine.cities.GROWTH_THRESHOLD_PER_POP || 400.0);
    const growthPct = atCap ? 100 : Math.min(100, Math.floor(100 * city.harvestSurplus / growthThreshold));
    const portTag = city.isPort ? ' <em>(Port)</em>' : '';
    const radiusTileCount = (2 * city.influenceRadius + 1) ** 2;
    const filledTileCount = city.filledOffsets ? city.filledOffsets.size : 0;

    // Civilization-wide per-turn resource totals and stockpile
    const civRes = (civ && civ.resources) ? civ.resources : null;
    const civStock = (civ && civ.stockpile) ? civ.stockpile : null;
    // Upkeep is derived (10% of raw unit power, across all 3 resources -- see
    // GameData.unitUpkeep), not a flat stored value.
    const totalUpkeep = civ ? civ.units.reduce((acc, u) => {
      const up = window.GameData.unitUpkeep(u.typeId, civ, u);
      acc.harvest += up.harvest || 0; acc.coin += up.coin || 0; acc.lore += up.lore || 0;
      return acc;
    }, { harvest: 0, coin: 0, lore: 0 }) : { harvest: 0, coin: 0, lore: 0 };
    const civResHtml = civRes && race ? `
        <h3>${escapeHtml(race.label)} — Economy</h3>
        <div class="stat-row"><span>Income (Harvest / Coin / Lore)</span><span>${civRes.harvest.toFixed(1)} / ${civRes.coin.toFixed(1)} / ${civRes.lore.toFixed(1)}</span></div>
        <div class="stat-row"><span>Unit Upkeep (Harvest / Coin / Lore)</span><span>${totalUpkeep.harvest.toFixed(1)} / ${totalUpkeep.coin.toFixed(1)} / ${totalUpkeep.lore.toFixed(1)}</span></div>
        ${civStock ? `<div class="stat-row"><span>Stockpile (H / C / L)</span><span>${civStock.harvest.toFixed(0)} / ${civStock.coin.toFixed(0)} / ${civStock.lore.toFixed(0)}</span></div>` : ''}` : '';

    return `
      <div class="panel">
        <h2>${escapeHtml(city.name)}${portTag}</h2>
        ${race ? `<div class="stat-row"><span>Race</span><span>${escapeHtml(race.label)}</span></div>` : ''}
        <div class="stat-row"><span>Population</span><span>${pop} / ${maxPop}</span></div>
        <div class="stat-row"><span>Growth</span><span>${atCap ? 'Max size' : `${city.harvestSurplus.toFixed(1)} / ${growthThreshold.toFixed(0)} (${growthPct}%)`}</span></div>
        <div class="stat-row"><span>Influence Radius</span><span>${city.influenceRadius}</span></div>
        <div class="stat-row"><span>Vision Radius</span><span>${city.influenceRadius + 3}</span></div>
        <div class="stat-row"><span>Filled Tiles</span><span>${filledTileCount} / ${radiusTileCount}</span></div>
        <h3>Yield this turn</h3>
        <div class="stat-row"><span>Harvest</span><span>${y.harvest.toFixed(1)}</span></div>
        <div class="stat-row"><span>Coin</span><span>${y.coin.toFixed(1)}</span></div>
        <div class="stat-row"><span>Lore</span><span>${y.lore.toFixed(1)}</span></div>
        <h3>Building</h3>
        <div class="stat-row">${city.buildQueue
          ? `${escapeHtml(city.buildQueue.id)} (${Math.min(100, Math.floor(100 * city.buildQueue.progress / city.buildQueue.coinCost))}%)`
          : "<em>Nothing queued</em>"}</div>
        <h3>Structures (${city.structures.length}/${window.GameEngine.cities.RING1_SLOT_COUNT + window.GameEngine.cities.RING2_SLOT_COUNT})</h3>
        ${city.structures.length
          ? city.structures.map(s => {
              const b = window.GameData.getBuilding(s.id);
              return `<div class="stat-row"><span>${escapeHtml(b.label)}</span><span>${Math.max(0, s.hp)}/${s.maxHp} hp</span></div>`;
            }).join("")
          : '<div class="stat-row"><em>None built</em></div>'}
        ${civResHtml}
      </div>`;
  }

  function renderTilePanel(tile, civs) {
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
        ${resource ? `<h3>Resource</h3><div class="stat-row"><span>${escapeHtml(resource.label)}</span><span>+${Object.entries(resource.bonus).map(([k,v]) => `${v} ${k}`).join(', ')}</span></div>` : ''}
        ${hasRiver ? `<div class="stat-row"><span>River</span><span>+1 Harvest, +1 Coin</span></div>` : ''}
        ${tile.hasRoad ? `<div class="stat-row"><span>Road</span><span>Connected</span></div>` : ''}
        ${tile.isRuin ? `<div class="stat-row"><span>Ruin</span><span>+2 Lore</span></div>` : ''}
        <div class="stat-row"><span>Position</span><span>(${tile.x}, ${tile.y})</span></div>
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
    if (b.coinToLoreConversionRate) effects.push(`coin→lore ×${b.coinToLoreConversionRate}`);
    if (b.contestedYieldPenaltyOverride) effects.push(`contested tiles yield ${Math.round(b.contestedYieldPenaltyOverride * 100)}%`);
    if (b.unitCostMult) effects.push(`unit cost ×${b.unitCostMult}`);
    if (b.raiseDeadPowerBonus) effects.push(`+${Math.round(b.raiseDeadPowerBonus * 100)}% raised power`);

    return `
      <div class="panel">
        <h2>${escapeHtml(b.label)}</h2>
        <div class="stat-row"><span>Race</span><span>${escapeHtml(race.label)}</span></div>
        <div class="stat-row"><span>Owner City</span><span>${escapeHtml(sel.city.name)}</span></div>
        <div class="stat-row"><span>HP</span><span>${Math.max(0, rec.hp)} / ${rec.maxHp}</span></div>
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

    let pioneerActions = "";
    if (unit.typeId === "pioneer" && isHumanUnit && gameState) {
      const tile = gameState.map.tiles[unit.y * gameState.map.width + unit.x];
      const canFoundCheck = window.GameEngine.cities.canFoundCityAt(
        gameState.map, gameState.civs, unit.x, unit.y, civ.raceId);
      const canBuildRoad = !tile.hasRoad && !unit.usedThisTurn;

      pioneerActions = `<h3>Actions</h3>`;
      if (!unit.usedThisTurn) {
        if (canFoundCheck.ok) {
          pioneerActions += `<div class="stat-row"><em>Can found city here — use End Turn to confirm</em></div>`;
        } else if (canFoundCheck.reason && canFoundCheck.reason.includes("road")) {
          pioneerActions += `<div class="stat-row"><em style="color:#f0a830">${escapeHtml(canFoundCheck.reason)}</em></div>`;
        }
        if (canBuildRoad) {
          pioneerActions += `<button id="build-road-btn" class="action-btn">Build Road</button>`;
        } else if (tile.hasRoad) {
          pioneerActions += `<div class="stat-row"><span>Road</span><span>Already built here</span></div>`;
        }
      } else {
        pioneerActions += `<div class="stat-row"><em>Already acted this turn</em></div>`;
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
    const siegePct = window.GameEngine.combat.effectiveSiegePct(unit, civ);
    const isFlying = window.GameEngine.combat.isFlying(unit);
    const canCarry = window.GameEngine.combat.getUnitProperty(unit, civ, "canCarryUnit", false);
    const effVision = (baseUnit.visionRadius || 3) + (civ.unitOverrides?.[unit.typeId]?.visionRadius || 0)
      + (unit.conditions?.flying?.visionBonus || 0);
    const properties = [];
    if (firstStrikePct > 0) properties.push(`First Strike ${Math.round(firstStrikePct * 100)}%`);
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
    if (killMomentum) properties.push(`Violent Momentum (+${killMomentum.moveBonus} movement)`);
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

    // Veteran leveling (see combat.js's LEVELING section) -- permanent,
    // player/AI-chosen stat bonuses earned through combat XP, distinct from
    // every temporary condition/aura above.
    const levelBonuses = unit.levelBonuses || {};
    const bonusParts = [];
    if (levelBonuses.attack) bonusParts.push(`+${levelBonuses.attack} attack`);
    if (levelBonuses.defense) bonusParts.push(`+${levelBonuses.defense} defense`);
    if (levelBonuses.siegePct) bonusParts.push(`+${Math.round(levelBonuses.siegePct * 100)}% siege`);
    if (levelBonuses.firstStrikePct) bonusParts.push(`+${Math.round(levelBonuses.firstStrikePct * 100)}% first strike`);
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

    const canRest = isHumanUnit && !unit.usedThisTurn;
    const restBtn = canRest ? `<button id="rest-unit-btn" class="action-btn">Rest</button>` : '';
    const disbandBtn = isHumanUnit ? `<button id="disband-unit-btn" class="action-btn action-btn-danger">Disband Unit</button>` : '';

    // Spectator-only: every unit in a spectator game is AI-controlled, so
    // ai.js stamps a human-readable currentMission on it each turn (see
    // maybeMoveUnits/maybeFoundCity/operateGalley etc.) describing whatever
    // it just decided to do. Not shown in a human player's own game since
    // that civ's units are player-directed, not AI-directed.
    const missionTag = (!viewState.humanCivId)
      ? `<div class="stat-row"><span>Mission</span><span>${escapeHtml(unit.currentMission || 'Awaiting orders')}</span></div>`
      : '';

    return `
      <div class="panel">
        <h2>${escapeHtml(baseUnit.label)}</h2>
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
        ${pioneerActions}
        ${restBtn}
        ${disbandBtn}
      </div>`;
  }

  function renderCivSummary(civ, gameState) {
    if (!civ) return `<div class="panel"><em>Spectator mode -- no civ selected</em></div>`;
    const race = window.GameData.getRace(civ.raceId);
    const { counts, totalClaimable } = window.GameEngine.influence.countTerritory(gameState);
    const myShare = totalClaimable > 0 ? ((counts[civ.id] || 0) / totalClaimable * 100) : 0;

    let researchHtml = "<em>None selected</em>";
    if (civ.currentResearch) {
      const tech = window.GameData.getTech(civ.currentResearch);
      const pct = Math.min(100, Math.floor(100 * (civ.researchProgress || 0) / window.GameData.effectiveTechCost(tech)));
      researchHtml = `${escapeHtml(tech.label)} (${pct}%)`;
    }

    const totalPop = window.GameEngine.ai.totalPopulation(civ);
    const militaryCap = window.GameEngine.ai.computeMilitaryCap(civ);
    const militaryCount = civ.units.filter((u) => {
      const ud = window.GameData.getUnit(u.typeId);
      return ud.category === "military" && !ud.isNaval;
    }).length;

    return `
      <div class="panel">
        <h2>${escapeHtml(race.label)}</h2>
        <div class="stat-row"><span>Cities</span><span>${civ.cities.length}</span></div>
        <div class="stat-row"><span>Population</span><span>${totalPop}</span></div>
        <div class="stat-row"><span>Units</span><span>${civ.units.length}</span></div>
        <div class="stat-row"><span>Military (cap)</span><span>${militaryCount} / ${militaryCap}</span></div>
        <div class="stat-row"><span>Territory Share</span><span>${myShare.toFixed(1)}%</span></div>
        <h3>Research</h3>
        <div class="stat-row">${researchHtml}</div>
        <h3>Cities</h3>
        ${civ.cities.map((c) => `<div class="stat-row"><span>${escapeHtml(c.name)}</span><span>pop ${c.population.toFixed(0)}</span></div>`).join("")}
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.UI.sidebar = { render };
})();
