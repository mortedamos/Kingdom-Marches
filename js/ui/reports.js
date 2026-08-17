/**
 * REPORT VIEWER (line-graph overlays)
 * ------------------------------------
 * Reads gameState.history (turns.js's endRound -> recordHistory) and draws a
 * per-civ line chart for a chosen metric ("influence" tile count or
 * "military power"). Same overlay/modal chrome as the tech tree viewer (see
 * index.html's #reports-overlay/#reports-modal, reusing the .techtree-*
 * classes) -- opened by setting viewState.reportView, closed by nulling it,
 * both handled in main.js's redraw() exactly like viewState.techTreeCivId.
 *
 * Colors are each race's own identity color (races.js) -- the same color
 * that civ's cities/units already render in, not a freshly assigned
 * categorical palette -- so a line here always matches what it means
 * everywhere else in the game. Labels are never color-alone: every line ends
 * in a plain-text civ label next to (not colored as) its swatch, and the
 * legend repeats the same pairing.
 */

window.UI = window.UI || {};

(function () {
  const REPORT_TYPES = {
    influence: { label: "Influence", key: "influence", axisLabel: "Tiles owned" },
    power: { label: "Military Power", key: "power", axisLabel: "Total unit power" },
  };

  const W = 720, H = 340, PAD_L = 46, PAD_R = 92, PAD_T = 16, PAD_B = 28;

  // Cached from the most recent render() so onHover/onLeave (wired via inline
  // onmousemove/onmouseleave in the SVG markup itself, since this HTML is
  // injected via innerHTML rather than addEventListener-able DOM nodes) don't
  // need to re-derive the same numbers on every mouse-move tick.
  let _cache = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function render(gameState, reportType) {
    if (reportType === "ai_actions") return renderAIActionLog(gameState);
    if (reportType === "ai_tech_trees") return renderAITechTrees(gameState);
    const cfg = REPORT_TYPES[reportType] || REPORT_TYPES.influence;
    const history = gameState.history;
    const turns = history ? history.turns : [];

    if (!history || turns.length < 2) {
      _cache = null;
      return `
        <h2>${escapeHtml(cfg.label)}</h2>
        <p><em>Not enough data yet -- play a few more turns first.</em></p>`;
    }

    // The "MONSTERS" pseudo-civ isn't a kingdom -- excluded so it doesn't
    // show up as a stray zero line on these graphs (recordHistory already
    // excludes it from gameState.history.civs).
    const monsterCivId = window.GameConfig.worldEncounters.monsters.civId;
    const civIds = Object.keys(gameState.civs).filter((civId) => civId !== monsterCivId);
    const series = civIds.map((civId) => {
      const civ = gameState.civs[civId];
      const race = window.GameData.getRace(civ.raceId);
      const rec = history.civs[civId];
      const values = rec ? rec[cfg.key] : turns.map(() => 0);
      return { civId, label: race.label, color: race.color, values };
    });

    // Computed fresh from the current map's claimable tile count
    // (countTerritory), not a fixed number, since totalClaimable varies with
    // map size/civ count. Same formula checkVictory (turns.js) uses.
    let victoryThresholdTiles = null, totalClaimable = null;
    if (reportType !== "power" && window.GameEngine.influence) {
      const territory = window.GameEngine.influence.countTerritory(gameState);
      totalClaimable = territory.totalClaimable;
      victoryThresholdTiles = Math.ceil(totalClaimable * window.GameEngine.turns.VICTORY_SHARE_THRESHOLD);
    }

    const n = turns.length;
    const maxVal = Math.max(1, victoryThresholdTiles || 0, ...series.flatMap((s) => s.values));
    const xFor = (i) => PAD_L + (n > 1 ? (i / (n - 1)) * (W - PAD_L - PAD_R) : 0);
    const yFor = (v) => PAD_T + (1 - v / maxVal) * (H - PAD_T - PAD_B);

    _cache = { turns, series, xFor, yFor, maxVal };

    // 4 horizontal gridlines + value labels (0%, 33%, 66%, 100% of maxVal) --
    // recessive, thin, on the border color, never competing with the data.
    let grid = "";
    for (let step = 0; step <= 3; step++) {
      const v = (maxVal * step) / 3;
      const y = yFor(v);
      grid += `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W - PAD_R}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1" />`;
      grid += `<text x="${PAD_L - 6}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" font-size="10" fill="var(--text-dim)">${Math.round(v)}</text>`;
    }

    // 3 x-axis ticks: first, middle, last turn -- enough to orient without
    // crowding the axis with one label per sampled round.
    const tickIdxs = n <= 3 ? turns.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
    let xAxis = "";
    for (const i of tickIdxs) {
      const x = xFor(i);
      xAxis += `<text x="${x.toFixed(1)}" y="${H - PAD_B + 16}" text-anchor="middle" font-size="10" fill="var(--text-dim)">T${turns[i]}</text>`;
    }

    const paths = series.map((s) => {
      const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(" ");
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
    }).join("");

    const endMarkers = series.map((s) => {
      const lastVal = s.values[s.values.length - 1] || 0;
      const x = xFor(n - 1), y = yFor(lastVal);
      return `
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${s.color}" stroke="var(--bg-panel)" stroke-width="1.5" />
        <text x="${(x + 8).toFixed(1)}" y="${y.toFixed(1)}" dominant-baseline="middle" font-size="11" fill="var(--text-main)">${escapeHtml(s.label)}</text>`;
    }).join("");

    const legend = series.map((s) => `
      <div class="reports-legend-item">
        <span class="reports-legend-swatch" style="background:${s.color}"></span>
        <span>${escapeHtml(s.label)}</span>
      </div>`).join("");

    // Dashed threshold line + right-edge label, same visual language as the
    // gridlines but on the accent color so it reads as a target, not just
    // another gridline.
    let victoryLine = "";
    let victorySubtitle = "";
    if (victoryThresholdTiles != null) {
      const y = yFor(victoryThresholdTiles);
      victoryLine = `
        <line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${W - PAD_R}" y2="${y.toFixed(1)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5,4" />
        <text x="${(W - PAD_R + 6).toFixed(1)}" y="${y.toFixed(1)}" dominant-baseline="middle" font-size="10" fill="var(--accent)">Victory</text>`;
      const pct = Math.round(window.GameEngine.turns.VICTORY_SHARE_THRESHOLD * 100);
      victorySubtitle = `<p class="reports-subtitle">Territorial victory needs ${pct}% of this map's claimable land —
        ${victoryThresholdTiles.toLocaleString()} of ${totalClaimable.toLocaleString()} tiles.</p>`;
    }

    return `
      <h2>${escapeHtml(cfg.label)}</h2>
      ${victorySubtitle}
      <div class="reports-legend">${legend}</div>
      <div class="reports-chart-wrap">
        <svg id="reports-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}"
             onmousemove="window.UI.reports.onHover(event)" onmouseleave="window.UI.reports.onLeave(event)">
          ${grid}
          ${xAxis}
          <text x="${PAD_L}" y="12" font-size="10" fill="var(--text-dim)">${escapeHtml(cfg.axisLabel)}</text>
          ${victoryLine}
          ${paths}
          ${endMarkers}
          <line id="reports-crosshair" x1="0" y1="${PAD_T}" x2="0" y2="${H - PAD_B}"
                stroke="var(--text-dim)" stroke-width="1" stroke-dasharray="3,3" style="display:none" />
        </svg>
        <div id="reports-tooltip" class="reports-tooltip" style="display:none;"></div>
      </div>`;
  }

  /** Nearest-turn-by-mouse-X lookup + crosshair/tooltip update. Wired via the
   *  SVG's own onmousemove attribute (see render() above) since this markup
   *  is injected via innerHTML, not built as live DOM nodes an
   *  addEventListener call could target ahead of time. */
  function onHover(evt) {
    if (!_cache) return;
    const svg = evt.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const localX = (evt.clientX - rect.left) * scaleX;

    const { turns, series, xFor } = _cache;
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < turns.length; i++) {
      const d = Math.abs(xFor(i) - localX);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }

    const crosshair = document.getElementById("reports-crosshair");
    if (crosshair) {
      const x = xFor(bestIdx).toFixed(1);
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.style.display = "";
    }

    const tooltip = document.getElementById("reports-tooltip");
    if (tooltip) {
      const rows = series.map((s) => `
        <div class="reports-tooltip-row">
          <span class="reports-legend-swatch" style="background:${s.color}"></span>
          <span>${escapeHtml(s.label)}</span>
          <span class="reports-tooltip-value">${Math.round(s.values[bestIdx] || 0)}</span>
        </div>`).join("");
      tooltip.innerHTML = `<div class="reports-tooltip-title">Turn ${turns[bestIdx]}</div>${rows}`;
      tooltip.style.display = "";
      const wrap = svg.parentElement;
      const wrapRect = wrap.getBoundingClientRect();
      const px = (evt.clientX - wrapRect.left) + 12;
      const py = (evt.clientY - wrapRect.top) + 12;
      tooltip.style.left = Math.min(px, wrapRect.width - 160) + "px";
      tooltip.style.top = py + "px";
    }
  }

  function onLeave() {
    const crosshair = document.getElementById("reports-crosshair");
    if (crosshair) crosshair.style.display = "none";
    const tooltip = document.getElementById("reports-tooltip");
    if (tooltip) tooltip.style.display = "none";
  }

  /**
   * AI ACTION LOG VIEWER
   * ---------------------
   * Reads gameState.aiActionLog (turns.js/ai.js's appendAIActionLog) --
   * the full cross-turn history, unlike civ.lastAILog which only ever holds
   * the most recent civ-turn (that's still used to feed this same data in,
   * just not read here). Filter/pagination state is local to this module
   * (not viewState) since it's pure view state, reset only on an explicit
   * filter change -- NOT on every re-render -- so "Load more" progress
   * survives autoplay ticks while this screen stays open.
   *
   * Shows newest-first (a paused-review tool: what just happened matters
   * most), in pages of LOG_PAGE_SIZE to avoid ever dumping the full
   * (potentially tens-of-thousands-of-entries) log into the DOM at once.
   * Export always covers the FULL log regardless of the current filter/
   * page, oldest-first (a natural chronological transcript) -- the point of
   * exporting is complete data for offline analysis, not a snapshot of
   * whatever's currently on screen.
   */
  const LOG_PAGE_SIZE = 500;
  let _logState = { civFilter: null, visibleCount: LOG_PAGE_SIZE };
  let _logGameStateRef = null; // stashed so the inline-onclick handlers below can re-render without main.js's redraw() plumbing

  function renderAIActionLog(gameState) {
    _logGameStateRef = gameState;
    const fullLog = gameState.aiActionLog || [];
    const civIds = Object.keys(gameState.civs);

    const civOptionsHtml = civIds.map((civId) => {
      const race = window.GameData.getRace(gameState.civs[civId].raceId);
      const selected = _logState.civFilter === civId ? " selected" : "";
      return `<option value="${escapeHtml(civId)}"${selected}>${escapeHtml(race.label)}</option>`;
    }).join("");
    const controlsHtml = `
      <div class="ai-action-log-controls">
        <label>Civ:
          <select onchange="window.UI.reports.setLogCivFilter(this.value)">
            <option value=""${_logState.civFilter ? "" : " selected"}>All</option>
            ${civOptionsHtml}
          </select>
        </label>
        <button onclick="window.UI.reports.exportAIActionLog()"${fullLog.length === 0 ? " disabled" : ""}>Export Full Log (.txt)</button>
      </div>`;

    if (fullLog.length === 0) {
      return `<h2>AI Actions</h2>${controlsHtml}<p><em>No AI actions logged yet -- play a few turns first.</em></p>`;
    }

    const filtered = _logState.civFilter ? fullLog.filter((e) => e.civId === _logState.civFilter) : fullLog;
    if (filtered.length === 0) {
      return `<h2>AI Actions</h2>${controlsHtml}<p><em>No actions logged yet for this civ.</em></p>`;
    }

    const visible = filtered.slice(-_logState.visibleCount);
    const remaining = filtered.length - visible.length;

    const rows = visible.slice().reverse().map((e) => {
      const civ = gameState.civs[e.civId];
      const race = civ ? window.GameData.getRace(civ.raceId) : null;
      const color = race ? race.color : "var(--border)";
      const label = race ? race.label : e.civId;
      return `
        <div class="ai-action-log-row" style="border-left-color:${escapeHtml(color)}">
          <span class="ai-action-log-turn">T${e.turn}</span>
          <span class="ai-action-log-civ" style="color:${escapeHtml(color)}">${escapeHtml(label)}</span>
          <span class="ai-action-log-text">${escapeHtml(e.text)}</span>
        </div>`;
    }).join("");

    const summarySuffix = _logState.civFilter ? ` (${fullLog.length} total across all civs)` : "";
    return `
      <h2>AI Actions</h2>
      ${controlsHtml}
      <div class="ai-action-log-summary">Showing ${visible.length} of ${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}, newest first${summarySuffix}</div>
      <div class="ai-action-log-list">${rows}</div>
      ${remaining > 0
        ? `<button class="ai-action-log-more-btn" onclick="window.UI.reports.loadMoreLogEntries()">Load ${Math.min(LOG_PAGE_SIZE, remaining)} more (${remaining} older not shown)</button>`
        : ""}`;
  }

  function refreshLogView() {
    const content = document.getElementById("reports-content");
    if (content && _logGameStateRef) content.innerHTML = renderAIActionLog(_logGameStateRef);
  }

  function setLogCivFilter(civId) {
    _logState.civFilter = civId || null;
    _logState.visibleCount = LOG_PAGE_SIZE;
    refreshLogView();
  }

  function loadMoreLogEntries() {
    _logState.visibleCount += LOG_PAGE_SIZE;
    refreshLogView();
  }

  /** Downloads the COMPLETE log (every civ, every entry currently held in
   *  memory -- ignores the on-screen filter/pagination), oldest-first, one
   *  line per entry as "[Turn N] [Race Label] action text". Same Blob +
   *  anchor-click download pattern main.js's handleSaveGame uses. */
  function exportAIActionLog() {
    if (!_logGameStateRef) return;
    const fullLog = _logGameStateRef.aiActionLog || [];
    if (fullLog.length === 0) return;
    const lines = fullLog.map((e) => {
      const civ = _logGameStateRef.civs[e.civId];
      const label = civ ? window.GameData.getRace(civ.raceId).label : e.civId;
      return `[Turn ${e.turn}] [${label}] ${e.text}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arcane-empires-ai-actions-turn${_logGameStateRef.turnNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * AI TECH TREE VIEWER
   * --------------------
   * A civ-picker wrapped around the existing spectator tech-tree renderer
   * (js/ui/techtree.js's window.UI.techtree.render(civ)) -- that function is
   * already fully civ-agnostic (built for the per-civ overlay opened from
   * the sidebar, see main.js's techTreeCivId), so this screen does no tech-
   * tree layout of its own: it just picks a civ and delegates. Completed /
   * researching (with progress %) / "AI intends to research next" (via
   * ai.js's previewNextResearch) / locked all come for free from there.
   *
   * Selection state is local to this module (not viewState), same reasoning
   * as _logState above -- it's pure view state, and defaults to the first
   * civ in the game so the screen never opens empty.
   */
  let _techTreesState = { civId: null };
  let _techTreesGameStateRef = null;

  function renderAITechTrees(gameState) {
    _techTreesGameStateRef = gameState;
    const civIds = Object.keys(gameState.civs);
    if (civIds.length === 0) {
      return `<h2>AI Tech Trees</h2><p><em>No active civs in this game.</em></p>`;
    }
    if (!_techTreesState.civId || !gameState.civs[_techTreesState.civId]) {
      _techTreesState.civId = civIds[0];
    }

    const civOptionsHtml = civIds.map((civId) => {
      const race = window.GameData.getRace(gameState.civs[civId].raceId);
      const selected = _techTreesState.civId === civId ? " selected" : "";
      return `<option value="${escapeHtml(civId)}"${selected}>${escapeHtml(race.label)}</option>`;
    }).join("");
    const controlsHtml = `
      <div class="ai-action-log-controls">
        <label>Civ:
          <select onchange="window.UI.reports.setTechTreesCiv(this.value)">
            ${civOptionsHtml}
          </select>
        </label>
      </div>`;

    const civ = gameState.civs[_techTreesState.civId];
    // isPlayerCiv: false unconditionally -- this is a spectator view of
    // every civ's tree, including the human's own if they have one, so the
    // "AI intends to research next" hint should always show here rather
    // than being suppressed the way it is on the player's own sidebar
    // overlay. No focus/hover target in this embedding (null, null).
    return `<h2>AI Tech Trees</h2>${controlsHtml}${window.UI.techtree.render(civ, false, null, null)}`;
  }

  function refreshTechTreesView() {
    const content = document.getElementById("reports-content");
    if (content && _techTreesGameStateRef) content.innerHTML = renderAITechTrees(_techTreesGameStateRef);
  }

  function setTechTreesCiv(civId) {
    _techTreesState.civId = civId || null;
    refreshTechTreesView();
  }

  window.UI.reports = {
    render, onHover, onLeave, setLogCivFilter, loadMoreLogEntries, exportAIActionLog,
    setTechTreesCiv,
  };
})();
