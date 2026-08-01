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

    let rows = "";
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
    const prereqsOk = tech.prereqs.every((p) => civ.completedTechs.has(p));
    const locked = !completed && !researching && (!cityGateOk || !prereqsOk);

    const effectiveCost = window.GameData.effectiveTechCost(tech);
    let stateClass = "available";
    let tag = "Available";
    if (completed) { stateClass = "completed"; tag = "Purchased"; }
    else if (researching) {
      stateClass = "researching";
      const pct = Math.min(100, Math.floor(100 * (civ.researchProgress || 0) / effectiveCost));
      tag = `Researching (${pct}%)`;
    } else if (isNextPick) { stateClass = "next-pick"; tag = "AI intends to research next"; }
    else if (locked) {
      stateClass = "locked";
      tag = !cityGateOk ? `Needs ${tech.layer} cities` : "Needs prerequisite";
    }

    // Clickable only in the player's own tree, and only for a node that
    // chooseResearch would actually accept: not done, not already underway,
    // prereqs and city gate satisfied. Switching targets mid-research is
    // allowed -- researchProgress is a single shared pool (see tech.js's
    // tickResearch), so nothing is lost by changing your mind.
    const selectable = isPlayerCiv && !completed && !researching && !locked;
    if (selectable) tag = "Click to research";

    const body = `<div class="techtree-node-name">${escapeHtml(tech.label)}</div>
      ${tech.description ? `<div class="techtree-node-desc">${escapeHtml(tech.description)}</div>` : ''}
      <div class="techtree-node-tag">${escapeHtml(tag)} · ${Math.round(effectiveCost)} Lore</div>`;

    if (selectable) {
      return `<button class="techtree-node ${stateClass} techtree-node-selectable"
        data-tech-id="${escapeHtml(tech.id)}">${body}</button>`;
    }
    return `<div class="techtree-node ${stateClass}">${body}</div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  window.UI.techtree = { render };
})();
