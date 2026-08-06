/**
 * CITY BUILD LIST (2026-08-06, user-directed)
 * -------------------------------------------
 * The rows of a city's production picker -- what it can build, what each
 * costs, and whether the civ can currently afford it. Lifted out of
 * js/ui/sidebar.js when production moved onto the map: the radial menu's
 * "Build Unit"/"Build Structure" sub-pages render this, and nothing about
 * these rows is specific to where they're shown.
 *
 * Its own module rather than part of js/ui/ringmenu.js because the two
 * change for different reasons: ringmenu.js is circles and screen edges,
 * this is "which builds exist and what colour is the cost".
 *
 * THE INDEX IS LOAD-BEARING. data-build-index is an index into the FULL
 * availableBuilds array, not into the filtered rows on screen, because
 * main.js's handleChooseBuild re-derives availableBuilds fresh at click time
 * and indexes straight into it. So `filterKind` decides which rows are
 * EMITTED, never which options are ENUMERATED -- filter after indexing. Get
 * this backwards and the picker silently queues the wrong unit.
 */

window.UI = window.UI || {};

(function () {
  const RESOURCE_LABEL = { harvest: "Harvest", coin: "Coin", lore: "Lore" };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /**
   * `filterKind` is "unit", "building", or null for everything.
   *
   * Stockpile readout + per-resource cost colouring (2026-08-04, user-
   * directed, carried over verbatim): a build's cost used to be the ONLY
   * number on screen -- reading "unaffordable" meant trusting the greyed-out
   * state and guessing which resource was short and by how much. Each cost
   * token is coloured green/red against civ.stockpile, and the stockpile is
   * shown right above the list so "green/red against WHAT" is never a
   * mystery. That reasoning is stronger here than it was in the sidebar: this
   * list is now on the map, further still from the Kingdom tab.
   */
  function render(civ, city, gameState, filterKind) {
    const options = window.GameEngine.ai.availableBuilds(civ, city, gameState);
    // Index against the full list BEFORE filtering -- see the header note.
    const indexed = options.map((o, i) => ({ o, i }))
      .filter(({ o }) => !filterKind || o.kind === filterKind);
    if (!indexed.length) return `<div class="stat-row"><em>Nothing available to build</em></div>`;

    const stock = civ.stockpile || { harvest: 0, coin: 0, lore: 0 };
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
      // directly next to the H/C/L-style resource tokens and read as a
      // fourth resource abbreviation rather than a turn count.
      const time = o.turns ? `${o.turns} turn${o.turns === 1 ? "" : "s"}` : "";
      const needsPlacement = o.kind === "building";
      return `<button class="build-option${o.affordable ? "" : " build-option-unaffordable"}"
          data-build-index="${i}" ${o.affordable ? "" : "disabled"}>
        <span>${escapeHtml(o.label)}${needsPlacement ? " ⌂" : ""}</span>
        <span>${priceHtml}${time ? ` · ${escapeHtml(time)}` : ""}</span>
      </button>`;
    };

    const hint = filterKind === "building"
      ? `<div class="build-group-label">⌂ = pick a tile</div>` : "";
    return stockpileHtml + hint + indexed.map(({ o, i }) => row(o, i)).join("");
  }

  window.UI.buildlist = { render };
})();
