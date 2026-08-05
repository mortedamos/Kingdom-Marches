/**
 * TECH TREE VIEWER
 * ----------------
 * The full tech tree for a chosen civ, laid out by layer (rows) and column
 * (civic/building/military), with each node's status -- completed, currently
 * researching (with progress %), the AI's intended next pick (via ai.js's
 * previewNextResearch, a non-mutating preview), locked (city-gate or prereqs
 * unmet), or simply available.
 *
 * Read-only for every civ EXCEPT the human player's own (2026-08-01,
 * user-directed): before this the player had no way to pick research at all,
 * because chooseResearch was only ever called from ai.js, which turns.js
 * skips for the human civ -- a human game sat at "Research: None selected"
 * forever. Available nodes in your own tree are now buttons.
 */

window.UI = window.UI || {};

(function () {
  const COLUMNS = ["civic", "building", "military"];
  const COLUMN_LABEL = { civic: "Civic", building: "Building", military: "Military" };

  // Old-model races still tag their ability nodes "mechanics" -- these render
  // in the Civic column, matching how Human's tree folded Mechanics into Civic.
  function columnFor(tech) {
    if (tech.category === "mechanics") return "civic";
    return COLUMNS.includes(tech.category) ? tech.category : "civic";
  }

  function render(civ, isPlayerCiv) {
    const race = window.GameData.getRace(civ.raceId);
    // The AI's "intends to research next" hint is meaningless for the human's
    // own tree -- nothing is going to pick for them, that's the whole point.
    const nextPick = isPlayerCiv ? null : window.GameEngine.ai.previewNextResearch(civ);

    const techIds = window.GameData.techsForRace(civ.raceId);
    const byLayer = {};
    let maxLayer = 1;
    for (const id of techIds) {
      const tech = window.GameData.getTech(id);
      const layer = tech.layer || 1;
      maxLayer = Math.max(maxLayer, layer);
      byLayer[layer] = byLayer[layer] || { civic: [], building: [], military: [] };
      byLayer[layer][columnFor(tech)].push(tech);
    }

    // Tier 0 (2026-08-05, user-directed): shared_infrastructure/hunt_game/
    // farm_soil all sit at layer 0.5, a step BELOW the "L1..maxLayer"
    // integer loop below -- that loop starts at 1 and only ever increments
    // by whole numbers, so it would never visit a 0.5 bucket on its own.
    // Rendered as its own row, ahead of everything else, same renderNode
    // used for every other layer.
    let rows = "";
    const tier0 = byLayer[0.5];
    if (tier0) {
      rows += `<div class="techtree-layer">
        <div class="techtree-layer-label">T0</div>
        ${COLUMNS.map((col) => `<div class="techtree-column">${
          tier0[col].map((tech) => renderNode(civ, tech, nextPick, isPlayerCiv)).join("") || ""
        }</div>`).join("")}
      </div>`;
    }
    for (let layer = 1; layer <= maxLayer; layer++) {
      const cols = byLayer[layer];
      if (!cols) continue;
      rows += `<div class="techtree-layer">
        <div class="techtree-layer-label">L${layer}</div>
        ${COLUMNS.map((col) => `<div class="techtree-column">${
          cols[col].map((tech) => renderNode(civ, tech, nextPick, isPlayerCiv)).join("") || ""
        }</div>`).join("")}
      </div>`;
    }

    const header = `<div class="techtree-layer techtree-header">
      <div class="techtree-layer-label"></div>
      ${COLUMNS.map((col) => `<div class="techtree-column-title">${escapeHtml(COLUMN_LABEL[col])}</div>`).join("")}
    </div>`;

    return `
      <div class="panel">
        <h2>${escapeHtml(race.label)} — Tech Tree</h2>
        <div class="stat-row"><span>Cities</span><span>${civ.cities.length}</span></div>
        ${isPlayerCiv ? (() => {
          // Multi-resource stockpile readout (2026-08-05, user-directed):
          // tech cost used to be pure Lore, so this was a single number --
          // now every tech's cost draws on harvest/coin/lore (see
          // GameData.effectiveTechCostBreakdown), same H/C/L convention
          // sidebar.js's build picker already uses.
          const s = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
          return `<div class="stat-row"><span>Stockpile (H / C / L)</span><span>${s.harvest.toFixed(0)} / ${s.coin.toFixed(0)} / ${s.lore.toFixed(0)}</span></div>`;
        })() : ''}
        ${isPlayerCiv && !civ.currentResearch
          ? '<div class="techtree-prompt">Nothing is being researched. Click any available tech to start.</div>'
          : ''}
        ${rows ? header + rows : '<div class="stat-row"><em>No researchable techs for this race yet.</em></div>'}
      </div>`;
  }

  function renderNode(civ, tech, nextPick, isPlayerCiv) {
    const completed = civ.completedTechs.has(tech.id);
    const researching = civ.currentResearch === tech.id;
    const isNextPick = !completed && !researching && tech.id === nextPick;
    const cityGateOk = window.GameEngine.tech.meetsCityGate(civ, tech);
    const missingPrereqs = tech.prereqs.filter((p) => !civ.completedTechs.has(p));
    const prereqsOk = missingPrereqs.length === 0;
    const locked = !completed && !researching && (!cityGateOk || !prereqsOk);

    // Up-front affordability (2026-08-04, user-directed research redesign):
    // chooseResearch now pays this tech's full cost from the stockpile
    // the instant it's picked, same one-time-purchase model a unit/building
    // queue already uses -- so a tech whose gates are satisfied but that the
    // civ can't yet AFFORD needs its own state, not a "Click to research"
    // button that would silently fail (chooseResearch returning false with
    // nothing else telling the player why). Multi-resource (2026-08-05,
    // user-directed): cost is now split across harvest/coin/lore by
    // category (see GameData.effectiveTechCostBreakdown) -- ALL THREE must
    // be affordable.
    const cost = window.GameData.effectiveTechCostBreakdown(tech);
    const stock = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
    const affordable = cost.harvest <= (stock.harvest || 0) && cost.coin <= (stock.coin || 0) && cost.lore <= (stock.lore || 0);
    let stateClass = "available";
    let tag = "Available";
    if (completed) { stateClass = "completed"; tag = "Purchased"; }
    else if (researching) {
      stateClass = "researching";
      const pct = civ.researchTotalTurns
        ? Math.min(100, Math.floor(100 * (civ.researchTotalTurns - civ.researchTurnsRemaining) / civ.researchTotalTurns))
        : 0;
      tag = `Researching -- ${civ.researchTurnsRemaining} turn${civ.researchTurnsRemaining === 1 ? "" : "s"} left (${pct}%)`;
    } else if (isNextPick) { stateClass = "next-pick"; tag = "AI intends to research next"; }
    else if (locked) {
      stateClass = "locked";
      // Names the actual missing prereq(s) by label instead of a bare "Needs
      // prerequisite" (2026-08-04, user-reported: that message gave no way
      // to tell WHICH tech was missing without cross-referencing the tree by
      // eye). Both gates can be unmet at once -- rare, but shown together
      // rather than silently dropping one -- since meetsCityGate and the
      // prereq check are independent conditions, not an if/else in
      // tech.js's own chooseResearch gate.
      const reasons = [];
      if (!cityGateOk) reasons.push(`Needs ${tech.layer} ${tech.layer === 1 ? "city" : "cities"}`);
      if (!prereqsOk) {
        const names = missingPrereqs.map((p) => window.GameData.getTech(p).label).join(", ");
        reasons.push(`Needs: ${names}`);
      }
      tag = reasons.join(" · ");
    } else if (!affordable) {
      // Gates are satisfied but the up-front payment isn't affordable yet --
      // distinct from "locked" (that's about city count/prereqs, not
      // resources).
      stateClass = "locked";
      tag = "Not enough resources banked yet";
    }

    // Clickable only in the player's own tree, and only for a node
    // chooseResearch would actually accept: not done, not already underway,
    // gates satisfied, AND affordable up front. Switching targets while
    // something is already in progress now FORFEITS whatever was paid for
    // it (see tech.js's chooseResearch doc comment) -- no longer the free,
    // lossless switch the old income-accumulation model allowed.
    const selectable = isPlayerCiv && !completed && !researching && !locked && affordable;
    if (selectable) tag = "Click to research";

    // Per-resource cost tokens (2026-08-05, user-directed), same "10H 15C"
    // convention and green/red-vs-stockpile coloring as sidebar.js's build
    // picker -- zero-cost components are omitted rather than shown as a
    // bare "0X".
    const costHtml = Object.entries(cost)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => {
        const have = stock[k] || 0;
        const color = have >= v ? "#6fbf6f" : "#d9695f";
        return `<span style="color:${color}">${v}${k[0].toUpperCase()}</span>`;
      }).join(" ");

    // Turns-to-complete (2026-08-04): no longer an income-derived estimate --
    // researchTurns is now a FIXED number the instant a tech is chosen (see
    // tech.js), so this can show the real total for any node that isn't
    // already locked/completed, not just the one currently in progress.
    let turnsTag = "";
    if (!completed && !locked && !researching) {
      const turns = window.GameEngine.tech.researchTurns(civ, tech);
      turnsTag = ` (${turns} turn${turns === 1 ? "" : "s"})`;
    }

    const body = `<div class="techtree-node-name">${escapeHtml(tech.label)}</div>
      ${tech.description ? `<div class="techtree-node-desc">${escapeHtml(tech.description)}</div>` : ''}
      <div class="techtree-node-tag">${escapeHtml(tag)} · ${costHtml}${escapeHtml(turnsTag)}</div>`;

    // Extra fade for tiers that are genuinely FAR off (2026-08-04, user-
    // directed): a tech only 1 city away from unlocking is worth reading now
    // to plan toward; one 3+ cities away is pure noise at the current game
    // stage and was competing visually with the near-term ones at the same
    // flat 0.5 opacity every locked node got before this. Graduated by how
    // many additional cities are needed (tech.layer - civ.cities.length),
    // not by whether the OTHER gate -- prereqs -- is unmet, since a prereq
    // gap is usually one tech away, not a stage of the game away. Always
    // reaches full clarity on hover (see the .techtree-node-far:hover CSS
    // rule) so nothing is ever permanently unreadable, just deprioritized.
    let extraFadeClass = "";
    if (!cityGateOk) {
      const citiesAway = tech.layer - civ.cities.length;
      if (citiesAway >= 2) extraFadeClass = " techtree-node-far";
    }

    if (selectable) {
      return `<button class="techtree-node ${stateClass} techtree-node-selectable"
        data-tech-id="${escapeHtml(tech.id)}">${body}</button>`;
    }
    return `<div class="techtree-node ${stateClass}${extraFadeClass}">${body}</div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.UI.techtree = { render };
})();
