/**
 * MAP CONTEXT MENU (2026-08-06, user-directed)
 * ---------------------------------------------
 * Floating menu that opens at the clicked tile when the player right-
 * clicks the map with a unit selected -- see js/ui/input.js's contextmenu
 * handler (decides WHERE, stores it in viewState.contextMenu) and
 * js/engine/orders.js's contextMenuOptions (decides WHAT's offered there).
 * This module only renders whatever option list it's handed; main.js wires
 * the actual clicks (same "pure render, main.js dispatches" split every
 * other UI module here follows -- dialog.js, techtree.js, sidebar.js).
 *
 * Positioned near the cursor (viewState.contextMenu.screenX/screenY),
 * clamped to the viewport so it can never render partly off-screen.
 */

window.UI = window.UI || {};

(function () {
  const MENU_WIDTH = 220;
  // Bumped from 320 (2026-08-06) -- the own-tile case now mirrors sidebar.js's
  // FULL action list (up to ~9 entries: Found City, Build Road, a channel
  // action, Go Hidden, Stop Order, Rest, Defend, Disband) instead of a
  // curated subset, so the clamp estimate needs more headroom.
  const MENU_MAX_HEIGHT = 420;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /** `menu` is viewState.contextMenu ({x, y, screenX, screenY}); `options`
   *  is the fresh result of orders.js's contextMenuOptions for that tile.
   *  `danger` (2026-08-06) mirrors sidebar.js's action-btn-danger treatment
   *  for the same actions (Cancel*, Disband, Stop Order). */
  function render(menu, options) {
    const left = Math.max(4, Math.min(menu.screenX, window.innerWidth - MENU_WIDTH - 4));
    const top = Math.max(4, Math.min(menu.screenY, window.innerHeight - MENU_MAX_HEIGHT - 4));
    const items = options.map((o) =>
      `<button class="map-context-menu-item${o.danger ? " map-context-menu-item-danger" : ""}" data-menu-kind="${escapeHtml(o.kind)}">${escapeHtml(o.label)}</button>`
    ).join("");
    return `
      <div id="map-context-menu" class="map-context-menu" style="left:${left}px; top:${top}px;">
        ${items}
      </div>`;
  }

  window.UI.contextmenu = { render };
})();
