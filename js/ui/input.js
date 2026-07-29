/**
 * INPUT HANDLER
 * -------------
 * Mouse interactions on the map canvas: click to select unit/city/tile,
 * drag to pan. Also the human-player city naming prompt (per the city
 * naming addendum §1).
 */

window.UI = window.UI || {};

(function () {
  function attach(canvas, gameState, viewState, onChange) {
    let dragging = false;
    let dragStartX = 0, dragStartY = 0;
    let dragMoved = false;

    canvas.addEventListener("mousedown", (e) => {
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      canvas.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
      viewState.scrollX = (viewState.scrollX || 0) - dx;
      viewState.scrollY = (viewState.scrollY || 0) - dy;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      onChange();
    });

    window.addEventListener("mouseup", () => {
      dragging = false;
      canvas.style.cursor = "grab";
    });

    // Scroll wheel: pan normally; Ctrl+scroll zooms toward the cursor
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Zoom toward the mouse cursor so the tile under it stays fixed
        const rect = canvas.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const { MIN_ZOOM, MAX_ZOOM } = window.UI.render;
        const oldZoom = viewState.zoomLevel || 1;
        const delta = e.deltaY > 0 ? 0.9 : 1.1; // scroll down = zoom out
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * delta));
        // Anchor world point under cursor:
        // worldPx = cursorX + scrollX  (at old zoom scale)
        // after zoom: newScrollX = worldPx * (newZoom/oldZoom) - cursorX
        const scrollX = viewState.scrollX || 0;
        const scrollY = viewState.scrollY || 0;
        viewState.scrollX = (cursorX + scrollX) * (newZoom / oldZoom) - cursorX;
        viewState.scrollY = (cursorY + scrollY) * (newZoom / oldZoom) - cursorY;
        viewState.zoomLevel = newZoom;
      } else {
        viewState.scrollX = (viewState.scrollX || 0) + e.deltaX;
        viewState.scrollY = (viewState.scrollY || 0) + e.deltaY;
      }
      onChange();
    }, { passive: false });

    canvas.addEventListener("click", (e) => {
      if (dragMoved) return; // suppress click after drag
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const tilePos = window.UI.render.screenToTile(px, py, viewState, gameState.map);
      if (!tilePos) return;
      handleTileClick(tilePos, gameState, viewState);
      onChange();
    });
  }

  function handleTileClick({ x, y }, gameState, viewState) {
    const { civs, map } = gameState;
    viewState.selectedCity = null;
    viewState.selectedUnit = null;
    viewState.selectedTile = null;
    viewState.selectedStructure = null;

    for (const civ of Object.values(civs)) {
      const city = civ.cities.find((c) => c.x === x && c.y === y);
      if (city) { viewState.selectedCity = city; return; }
    }
    for (const civ of Object.values(civs)) {
      const unit = civ.units.find((u) => u.x === x && u.y === y);
      if (unit) {
        viewState.selectedUnit = unit;
        // "move" sfx plays on selection (clicking the unit), not on actual
        // movement (2026-07-24, user-directed) -- it's a "here I am, ready"
        // acknowledgement sound, not a footstep-timed one.
        window.SfxSystem.playAction(civ.raceId, unit.typeId, "move");
        return;
      }
    }
    const structure = window.GameEngine.cities.findStructureAt(gameState, x, y);
    if (structure) { viewState.selectedStructure = structure; return; }
    // Fall through: show tile info
    viewState.selectedTile = map.tiles[y * map.width + x];
  }


  window.UI.input = { attach };
})();
