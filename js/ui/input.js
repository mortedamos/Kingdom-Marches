/**
 * INPUT HANDLER
 * -------------
 * Mouse interactions on the map canvas: click to select a tile, drag to pan.
 * Also the human-player city naming prompt (per the city naming addendum §1).
 *
 * SELECTION MODEL (2026-08-01, user-directed)
 * -------------------------------------------
 * Clicking used to be a priority chain with early returns -- city beat unit
 * beat structure beat terrain -- so exactly ONE of viewState.selectedCity/
 * selectedUnit/selectedStructure/selectedTile was ever set and the sidebar
 * could only ever show one of them. Clicking a city with a unit standing on
 * it showed the city and hid the unit entirely; a stack of two units showed
 * only whichever civ happened to be iterated first.
 *
 * Now a click selects the TILE, and everything on it becomes a tab:
 *
 *     viewState.selection = { x, y, tabs: [...], activeTab, activeKind, activeRef }
 *
 * `tabs` is rebuilt from live game state on every redraw (see
 * resolveSelection) so it can never hold a stale reference to a unit that
 * died, a structure that was razed, or a city that was captured. activeKind/
 * activeRef are what actually persist across those rebuilds -- activeTab is
 * a derived index, only meaningful until the next rebuild.
 *
 * Which tab starts active on a fresh click: a unit on the tile always wins
 * (2026-08-03, user-directed -- see handleTileClick); otherwise the kind you
 * were already reading carries over, so panning across terrain keeps showing
 * terrain.
 *
 * The four legacy viewState.selected* fields are still maintained, derived
 * from whichever tab is active (see syncLegacySelection). That keeps
 * render.js's highlighting, render3d.js, and main.js's action handlers
 * (Rest/Defend/Disband/Build Road/channels) working unchanged -- and gives
 * them the right meaning for free, since "the selected unit" now means "the
 * unit whose tab you are looking at."
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
      const tilePos = eventTile(e, canvas, viewState, gameState);
      if (!tilePos) return;
      // Structure-placement mode swallows the click: while the player is
      // picking a tile for a queued building, a left-click means "put it
      // here", not "inspect this tile". Clicking outside the highlighted
      // slots cancels, which is the conventional escape from a modal cursor.
      if (viewState.placement) {
        const slot = viewState.placement.slots.find((s) => s.x === tilePos.x && s.y === tilePos.y);
        if (viewState.placement.onPick) viewState.placement.onPick(slot || null);
        onChange();
        return;
      }
      handleTileClick(tilePos, gameState, viewState);
      onChange();
    });

    // CONTEXT MENU (2026-08-06, user-directed rewrite -- previously right-
    // click issued a move/attack immediately, same-turn range only). Every
    // right-click now opens a menu of context-relevant actions at the
    // clicked tile (see orders.js's contextMenuOptions for what's offered
    // and why, main.js's redraw()/handleContextMenuAction for how it's
    // rendered and dispatched) -- this handler only decides WHERE the
    // player clicked and stores that, same "decide where, not what" split
    // the old handler had.
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault(); // suppress the browser menu, always -- even on a no-op
      if (dragMoved) return;
      const tilePos = eventTile(e, canvas, viewState, gameState);
      if (!tilePos) return;
      const unit = viewState.selectedUnit;
      if (!window.GameEngine.orders.canCommand(unit, gameState, viewState.humanCivId)) return;
      const options = window.GameEngine.orders.contextMenuOptions(unit, gameState, tilePos.x, tilePos.y, viewState.humanCivId);
      if (!options.length) {
        // Nothing legal here -- surface a refusal rather than popping an
        // empty menu, same "nothing happened is indistinguishable from a
        // broken button" reasoning the old immediate-order handler had.
        viewState.orderHint = { text: "No valid actions here", until: performance.now() + 2000 };
        onChange();
        return;
      }
      viewState.contextMenu = { x: tilePos.x, y: tilePos.y, screenX: e.clientX, screenY: e.clientY };
      onChange();
    });

    // Hover tile drives the path preview and the move/attack cursor. Tracked
    // on the canvas only (not window) so leaving the map clears it.
    canvas.addEventListener("mousemove", (e) => {
      if (dragging) return; // panning, not aiming
      const tilePos = eventTile(e, canvas, viewState, gameState);
      const prev = viewState.hoverTile;
      if (!tilePos) {
        if (prev) { viewState.hoverTile = null; onChange(); }
        return;
      }
      if (!prev || prev.x !== tilePos.x || prev.y !== tilePos.y) {
        viewState.hoverTile = tilePos;
        onChange();
      }
    });
    canvas.addEventListener("mouseleave", () => {
      if (viewState.hoverTile) { viewState.hoverTile = null; onChange(); }
    });
  }

  /** Screen coords of a mouse event -> tile coords, or null if off-map. */
  function eventTile(e, canvas, viewState, gameState) {
    const rect = canvas.getBoundingClientRect();
    return window.UI.render.screenToTile(
      e.clientX - rect.left, e.clientY - rect.top, viewState, gameState.map);
  }

  function handleTileClick({ x, y }, gameState, viewState) {
    // Carry the previously-active tab KIND (not the index, and not the
    // specific object) onto the new tile, so clicking tile-to-tile while
    // reading Terrain keeps showing Terrain instead of snapping back to
    // whatever unit happens to be standing there. Terrain always exists, so
    // that particular comparison never breaks. activeRef is deliberately
    // dropped -- it belonged to the old tile.
    const prev = viewState.selection;
    const sel = {
      x, y,
      tabs: [],
      activeTab: 0,
      activeKind: prev ? prev.activeKind : null,
      activeRef: null,
    };
    viewState.selection = sel;
    resolveSelection(gameState, viewState);

    // ...EXCEPT when there's a unit standing here (2026-08-03, user-directed):
    // a unit always wins the tab. Carrying the previous kind forward is right
    // for reading terrain across an empty stretch of map, but when you click
    // a tile precisely because something is standing on it, landing on the
    // Terrain tab and having to click again is just wrong. Falls back to the
    // carried-over kind (and then tab 0) on a tile with no unit, so the
    // read-terrain-tile-to-tile behavior above is otherwise untouched.
    if (sel.activeKind !== "unit" && sel.tabs.some((t) => t.kind === "unit")) {
      sel.activeKind = "unit";
      sel.activeRef = null;
      resolveSelection(gameState, viewState);
    }

    // "move" sfx plays on selection (clicking the unit), not on actual
    // movement (2026-07-24, user-directed) -- it's a "here I am, ready"
    // acknowledgement sound, not a footstep-timed one. Now fires only when
    // the click actually LANDED on a unit tab, so clicking a city tile while
    // reading Terrain no longer chirps at you.
    const unit = viewState.selectedUnit;
    if (unit) {
      const civ = gameState.civs[unit.civId];
      if (civ) window.SfxSystem.playAction(civ.raceId, unit.typeId, "move");
    }
  }

  /** Rebuilds viewState.selection.tabs from live game state and re-resolves
   *  which one is active, then mirrors the active tab into the legacy
   *  viewState.selected* fields. Safe (and intended) to call on every redraw:
   *  it is what keeps the sidebar honest when the thing you had selected dies,
   *  moves away, or gains a stackmate mid-turn. Returns the tab list. */
  function resolveSelection(gameState, viewState) {
    const sel = viewState.selection;
    if (!sel) { syncLegacySelection(viewState); return []; }

    // Follow a selected unit that moved on its OWN since the last redraw
    // (2026-08-06, user-directed): a queued multi-turn move/build-road
    // order (see orders.js's advanceGotoOrder) can relocate the selected
    // unit turn after turn with no player click in between -- previously
    // the only way a human unit ever moved was a direct player action,
    // which the click handler itself already re-pointed selection for
    // (see main.js's handleContextMenuAction). buildTileTabs below only
    // ever looks AT sel.x/y, so without this, a unit that walked off that
    // tile on its own would simply vanish from the tab strip instead of
    // being followed. Confirms the unit is still actually alive/on the
    // roster (not a stale reference to something disbanded/killed) before
    // trusting its position.
    if (sel.activeKind === "unit" && sel.activeRef
        && (sel.activeRef.x !== sel.x || sel.activeRef.y !== sel.y)
        && Object.values(gameState.civs).some((c) => c.units.includes(sel.activeRef))) {
      sel.x = sel.activeRef.x;
      sel.y = sel.activeRef.y;
    }

    const tabs = buildTileTabs(gameState, sel.x, sel.y);
    sel.tabs = tabs;

    // Prefer the exact same object the user was looking at (survives a unit
    // gaining a stackmate, which would otherwise shift indices under them);
    // failing that, the first tab of the same kind; failing that, tab 0.
    let idx = -1;
    if (sel.activeRef) idx = tabs.findIndex((t) => t.ref === sel.activeRef);
    if (idx < 0 && sel.activeKind) idx = tabs.findIndex((t) => t.kind === sel.activeKind);
    if (idx < 0) idx = 0;

    sel.activeTab = idx;
    const active = tabs[idx];
    sel.activeKind = active ? active.kind : null;
    sel.activeRef = active ? active.ref : null;

    syncLegacySelection(viewState);
    return tabs;
  }

  /** Everything present on tile (x,y), in tab-strip order:
   *  City, then each Unit, then Building, then Terrain, then Kingdom(s).
   *  Terrain is unconditional, so the list is never empty and the sidebar
   *  never renders a blank panel. */
  function buildTileTabs(gameState, x, y) {
    const { civs, map } = gameState;
    const tabs = [];

    let city = null;
    for (const civ of Object.values(civs)) {
      const found = civ.cities.find((c) => c.x === x && c.y === y);
      if (found) { city = found; break; }
    }
    if (city) tabs.push({ kind: "city", label: city.name, ref: city, city });

    // Every unit on the tile, not just the first. Units generally don't stack,
    // but three cases legitimately put more than one here: a flying unit
    // sharing a tile with a ground unit (see ai.js's occupancy sets -- flyers
    // only block other flyers), a carried passenger sitting on its carrier's
    // tile, and any unit standing on a city tile as a garrison.
    const units = [];
    for (const civ of Object.values(civs)) {
      for (const u of civ.units) if (u.x === x && u.y === y) units.push(u);
    }
    // Labelled by unit TYPE, not by unit.name -- the tab strip is only 280px
    // wide and full proper names ("Beatrice the Practical") wrap badly. The
    // name is still shown inside the panel itself.
    //
    // Two units of the SAME type on one tile is not an edge case, though --
    // every civ starts with two Scouts stacked on its Pioneer -- and two tabs
    // both reading "Tracker" are useless. So when a type repeats, fall back
    // to the unit's given FIRST name, which is short enough to fit and
    // matches what the panel shows. Unnamed units get an ordinal instead.
    const typeCounts = {};
    for (const u of units) typeCounts[u.typeId] = (typeCounts[u.typeId] || 0) + 1;
    const seen = {};
    for (const u of units) {
      const base = window.GameData.getUnit(u.typeId);
      seen[u.typeId] = (seen[u.typeId] || 0) + 1;
      let label = base.label;
      if (typeCounts[u.typeId] > 1) {
        const firstName = u.name ? String(u.name).split(" ")[0] : null;
        label = firstName || `${base.label} ${seen[u.typeId]}`;
      }
      if (u.carriedBy) label += " (aboard)"; // passenger vs. its carrier
      tabs.push({ kind: "unit", label, ref: u, unit: u });
    }

    const structure = window.GameEngine.cities.findStructureAt(gameState, x, y);
    if (structure) {
      tabs.push({ kind: "structure", label: structure.building.label, ref: structure.record, structure });
    }

    const tile = map.tiles[y * map.width + x];
    tabs.push({ kind: "terrain", label: "Terrain", ref: tile, tile });

    // Kingdom: the civ-wide view of whoever owns something here. Usually one
    // civ, but a tile can hold two -- an enemy FLYING unit is not blocked from
    // sitting over your own city -- so this is one tab per distinct owner,
    // race-labelled only when that ambiguity actually exists.
    const ownerIds = [];
    const addOwner = (id) => { if (id && civs[id] && !ownerIds.includes(id)) ownerIds.push(id); };
    if (city) addOwner(city.civId);
    for (const u of units) addOwner(u.civId);
    if (structure) addOwner(structure.civ.id);
    for (const id of ownerIds) {
      const civ = civs[id];
      const race = window.GameData.getRace(civ.raceId);
      tabs.push({
        kind: "kingdom",
        label: ownerIds.length > 1 ? `Kingdom — ${race.label}` : "Kingdom",
        ref: civ, civ,
      });
    }

    return tabs;
  }

  /** Mirrors the active tab into the pre-tabs viewState.selected* fields that
   *  render.js / render3d.js / main.js's action handlers still read. Exactly
   *  one is ever non-null (none at all on a Kingdom tab, which has no single
   *  map object to highlight). */
  function syncLegacySelection(viewState) {
    viewState.selectedCity = null;
    viewState.selectedUnit = null;
    viewState.selectedTile = null;
    viewState.selectedStructure = null;

    const sel = viewState.selection;
    if (!sel) return;
    const tab = sel.tabs[sel.activeTab];
    if (!tab) return;
    if (tab.kind === "city") viewState.selectedCity = tab.city;
    else if (tab.kind === "unit") viewState.selectedUnit = tab.unit;
    else if (tab.kind === "structure") viewState.selectedStructure = tab.structure;
    else if (tab.kind === "terrain") viewState.selectedTile = tab.tile;
  }

  /** Switches which tab is active without re-running tile detection. Used by
   *  the sidebar's tab strip and by the city panel's clickable garrison list. */
  function setActiveTab(gameState, viewState, index) {
    const sel = viewState.selection;
    if (!sel || !sel.tabs[index]) return;
    sel.activeKind = sel.tabs[index].kind;
    sel.activeRef = sel.tabs[index].ref;
    resolveSelection(gameState, viewState);
  }

  window.UI.input = { attach, handleTileClick, resolveSelection, setActiveTab };
})();
