/**
 * INPUT HANDLER
 * -------------
 * Pointer interactions on the map canvas: tap/click to select a tile, drag to
 * pan, pinch or wheel to zoom, long-press or right-click for the radial menu.
 * Also the human-player city naming prompt (per the city naming addendum §1).
 *
 * POINTER EVENTS, NOT MOUSE EVENTS  (2026-08-25, mobile phase 0)
 * -------------------------------------------
 * This module used to bind mousedown/mousemove/mouseup/click/contextmenu, so
 * on a touch device the whole game ran on the browser's synthesized-mouse
 * emulation: a tap and a drag worked, and nothing else did -- no pinch, no
 * long-press, no multi-touch at all.
 *
 * The fix is deliberately NOT "add touchstart handlers alongside the mouse
 * ones". That gives two input paths that have to be kept in agreement
 * forever, plus a double-fire problem, since mobile browsers synthesize a
 * full mouse sequence after every touch sequence. Instead everything routes
 * through Pointer Events, which unify mouse, touch and pen into one stream
 * (e.pointerType says which) -- so there is exactly one drag implementation,
 * one tap implementation, and touch support is a property of the model
 * rather than a parallel copy of it.
 *
 * Consequences worth knowing:
 *  - Tap/click is resolved on `pointerup`, not via a `click` listener. Both
 *    would fire for a mouse, so the `click` binding is gone entirely.
 *  - The canvas needs `touch-action: none` in CSS or the browser eats pans
 *    for its own scrolling and pinches for page zoom before we ever see them.
 *  - Hover (viewState.hoverTile) is gated on pointerType === "mouse". A
 *    touch device cannot hover, and letting a tap set a hover tile leaves a
 *    stale path preview stuck on the map after the finger lifts.
 *  - Right-click and long-press both open the radial menu through the same
 *    openRingMenu() call, so the two entry points can't drift apart.
 *
 * SELECTION MODEL
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
 * (see handleTileClick); otherwise the kind you were already reading
 * carries over, so panning across terrain keeps showing terrain.
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
  /** Travel (px) a press may drift and still count as a tap rather than a
   *  drag. 4 was fine for a mouse; a finger always wobbles a few px on the
   *  way back up, so tapping a unit on a phone at that threshold registers
   *  as a 1px pan and selects nothing. */
  const TAP_SLOP = 10;

  /** Hold (ms) before a press becomes a radial-menu open. 350 is the usual
   *  platform long-press: short enough not to feel stuck, long enough that
   *  the start of a pan doesn't trip it. */
  const LONG_PRESS_MS = 350;

  function attach(canvas, gameState, viewState, onChange) {
    // Live pointers by id. Size tells us the gesture: 1 = pan/tap/long-press,
    // 2 = pinch. Anything more is ignored rather than guessed at.
    const pointers = new Map();
    let dragging = false;
    let dragMoved = false;
    let dragStartX = 0, dragStartY = 0;
    let longPressTimer = null;
    let longPressFired = false;
    // Snapshotted ONCE when the second finger lands, never updated frame to
    // frame (2026-08-26, user-reported: pinch zoom was "very jittery").
    // Computing each frame's zoom as a multiple of the PREVIOUS frame's
    // distance -- the old approach -- chains every sample's sensor noise
    // into the next: a touchscreen's reported finger position jitters by a
    // px or two even when the finger is dead still, and each of those tiny
    // deltas got multiplied into the zoom permanently, so the noise never
    // canceled out, it accumulated. Anchoring every frame to the gesture's
    // OWN start instead makes the target zoom a pure function of (current
    // distance / start distance) -- noise still perturbs it a little, but
    // by a bounded amount, not a compounding one. See zoomAbout's own doc
    // comment for the other half of this (an absolute target, not a
    // multiplier).
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    // Below this many px of change since the START distance, don't touch
    // the zoom at all -- sensor noise alone can wobble a "held" pinch by a
    // couple px, and PINCH_DEADZONE_PX eats that before it ever reaches
    // zoomAbout, rather than relying on the anchoring above to merely bound
    // it.
    const PINCH_DEADZONE_PX = 4;

    // RING-DRAG (2026-08-26, mobile phase 3): once a long-press opens the
    // ring, the SAME finger stays down and can slide across the pills to
    // preview each one before committing on release -- long-press, slide,
    // lift, one continuous gesture. See css/mobile.css's
    // .map-ring-item-armed for the visual half of this.
    //
    // ringDragPointerId is the touch that opened the ring, or null when no
    // ring-drag is in progress. armedPill is whichever .map-ring-item is
    // currently under that finger, or null over empty space/the subject.
    //
    // This works entirely through hit-testing (document.elementFromPoint),
    // NOT through real pointer events landing on the buttons. Pointer
    // capture was taken on the CANVAS at pointerdown (see below) and stays
    // there for this pointerId's whole lifetime, so every move/up for it
    // keeps arriving here even once the finger is physically over a pill --
    // the buttons never see a hover or a click of their own. Commit is done
    // by calling the armed button's OWN .click() at release, which runs
    // through the exact same onclick main.js's renderRingMenu already wired
    // up -- no second dispatch path to keep in sync with a mouse click.
    let ringDragPointerId = null;
    let armedPill = null;

    function disarmRingPill() {
      if (armedPill) armedPill.classList.remove("map-ring-item-armed");
      armedPill = null;
    }

    function cancelLongPress() {
      if (longPressTimer !== null) { clearTimeout(longPressTimer); longPressTimer = null; }
    }

    /** Zooms TO `targetZoom` (clamped, an absolute level -- not a multiplier
     *  on the current one) about a point in canvas-local px, holding the
     *  world position under that point fixed. Used by pinch, which always
     *  has a well-defined absolute target (pinchStartZoom * distance ratio);
     *  an absolute target rather than a relative factor is what lets pinch
     *  anchor every frame to the gesture's own start instead of chaining off
     *  the previous frame -- see pinchStartDist's own comment. */
    function zoomAbout(localX, localY, targetZoom) {
      const { MIN_ZOOM, MAX_ZOOM } = window.UI.render;
      const oldZoom = viewState.zoomLevel || 1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
      if (newZoom === oldZoom) return;
      const scrollX = viewState.scrollX || 0;
      const scrollY = viewState.scrollY || 0;
      viewState.scrollX = (localX + scrollX) * (newZoom / oldZoom) - localX;
      viewState.scrollY = (localY + scrollY) * (newZoom / oldZoom) - localY;
      viewState.zoomLevel = newZoom;
    }

    function pinchGeometry() {
      const [a, b] = [...pointers.values()];
      const rect = canvas.getBoundingClientRect();
      return {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2 - rect.left,
        cy: (a.y + b.y) / 2 - rect.top,
      };
    }

    /** Coalesces onChange() to at most once per animation frame -- a 2-finger
     *  pinch reports each finger's move as a SEPARATE pointermove, so one
     *  visual frame of motion can be 2+ events, and a touchscreen can sample
     *  well above 60Hz regardless. onChange (main.js's redraw()) is not
     *  cheap -- it rebuilds the whole sidebar among other things -- so
     *  calling it once per raw event rather than once per painted frame was
     *  the other half of "pinch zoom feels jittery" (2026-08-26,
     *  user-reported): the zoom MATH was already stable (see
     *  pinchStartDist's own comment above), but a phone dropping frames
     *  under that redraw load reads as jitter just the same. Deferring is
     *  safe purely because every mutation that leads here (zoomAbout,
     *  scrollX/scrollY) already lands on viewState synchronously before this
     *  ever runs -- the deferred call always paints the LATEST state, never
     *  a stale one, no matter how many events piled up first. */
    let onChangeRAF = null;
    function scheduleOnChange() {
      if (onChangeRAF !== null) return;
      onChangeRAF = requestAnimationFrame(() => {
        onChangeRAF = null;
        onChange();
      });
    }

    canvas.addEventListener("pointerdown", (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        // Second finger down: this is a pinch, not a pan. Abandon the drag
        // in progress and mark it moved so the eventual pointerup can't be
        // mistaken for a tap on whatever was under the first finger.
        cancelLongPress();
        dragging = false;
        dragMoved = true;
        pinchStartDist = pinchGeometry().dist;
        pinchStartZoom = viewState.zoomLevel || 1;
        // A second finger landing mid ring-drag is not a gesture this
        // supports -- abandon the arm-preview rather than let two unrelated
        // gestures fight over the same pointer bookkeeping. The ring itself
        // (viewState.ringMenu) is untouched, so it's still open and tappable
        // normally once both fingers lift.
        ringDragPointerId = null;
        disarmRingPill();
        return;
      }
      if (pointers.size > 2) { cancelLongPress(); return; }

      // Right mouse button is the desktop radial-menu gesture and is handled
      // by the contextmenu listener below -- starting a pan on it would drag
      // the map out from under the menu that's about to open.
      if (e.pointerType === "mouse" && e.button === 2) {
        // Still reset dragMoved: a right-click starts a fresh gesture and
        // must not inherit true from whatever came before it (e.g. a prior
        // pan) -- otherwise contextmenu's own dragMoved guard below wrongly
        // swallows the menu open on a unit that was only auto-selected as
        // "next needing orders," never explicitly clicked.
        dragMoved = false;
        return;
      }

      // Capture keeps a pan alive if the finger slides off the canvas, but it
      // throws when the pointer isn't active -- never let that abort the
      // gesture setup that follows.
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* not capturable */ }
      dragging = true;
      dragMoved = false;
      longPressFired = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      canvas.style.cursor = "grabbing";

      // Long-press -> radial menu. Touch and pen only: a mouse already has
      // right-click, and a held left button there means a slow drag.
      if (e.pointerType !== "mouse") {
        const downX = e.clientX, downY = e.clientY;
        cancelLongPress();
        longPressTimer = window.setTimeout(() => {
          longPressTimer = null;
          if (dragMoved || pointers.size !== 1) return;
          longPressFired = true;
          dragging = false;
          const rect = canvas.getBoundingClientRect();
          const tilePos = window.UI.render.screenToTile(
            downX - rect.left, downY - rect.top, viewState, gameState.map);
          if (!tilePos) return;
          // A short tick confirms the hold registered, so the player isn't
          // left guessing whether to keep waiting. Deliberately one pulse --
          // never a repeating pattern (see the project's no-flashing rule,
          // which applies to haptics for the same reason it applies to light).
          navigator.vibrate?.(10);
          openRingMenu(tilePos, gameState, viewState, onChange);
          // Begin ring-drag tracking for this SAME finger, which is still
          // down -- but only if a ring genuinely opened. An empty option
          // list leaves viewState.ringMenu untouched (openRingMenu's own
          // early return), and there is nothing to drag across in that case.
          if (viewState.ringMenu) ringDragPointerId = e.pointerId;
        }, LONG_PRESS_MS);
      }
    });

    window.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;

      if (pointers.size === 2) {
        const { dist, cx, cy } = pinchGeometry();
        if (pinchStartDist > 0 && dist > 0 && Math.abs(dist - pinchStartDist) >= PINCH_DEADZONE_PX) {
          zoomAbout(cx, cy, pinchStartZoom * (dist / pinchStartDist));
        }
        scheduleOnChange();
        return;
      }

      if (e.pointerId === ringDragPointerId) {
        // Hit-test by SCREEN POSITION, not by which element actually
        // received the event -- capture means this pointer's events all
        // still target the canvas, never the pill physically under it.
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const pill = el && el.closest(".map-ring-item");
        if (pill !== armedPill) {
          disarmRingPill();
          if (pill) {
            pill.classList.add("map-ring-item-armed");
            armedPill = pill;
            // Tick only when LANDING on a pill, not when leaving one for
            // empty space -- losing the arm should feel like nothing
            // happened, not like a second, different event.
            navigator.vibrate?.(10);
          }
        }
        // Deliberately no onChange() here -- this only toggles a CSS class
        // on an existing button, not game or view state, so there is
        // nothing for a redraw to pick up. Skipping it also means
        // renderRingMenu never re-runs mid-gesture, which is what keeps
        // `armedPill` a stable reference for the whole drag (see this
        // function's own header comment).
        return;
      }

      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (!dragMoved && Math.abs(dx) + Math.abs(dy) > TAP_SLOP) {
        dragMoved = true;
        cancelLongPress(); // the press became a pan; it is no longer a hold
      }
      if (!dragMoved) return; // inside the slop: don't nudge the map at all
      viewState.scrollX = (viewState.scrollX || 0) - dx;
      viewState.scrollY = (viewState.scrollY || 0) - dy;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      scheduleOnChange();
    });

    function endPointer(e) {
      const had = pointers.delete(e.pointerId);
      if (!had) return;
      cancelLongPress();
      // Throws when the pointer isn't captured -- which genuinely happens,
      // since this handler also serves pointercancel, where the browser has
      // already dropped capture itself. Unguarded, that throw would skip the
      // tap resolution below and swallow the selection.
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }

      if (e.pointerId === ringDragPointerId) {
        ringDragPointerId = null;
        const pill = armedPill;
        disarmRingPill();
        if (pill) {
          // Runs through the exact click handler main.js's renderRingMenu
          // bound to this button -- see this module's header comment on why
          // that's the whole point of driving this by hit-testing rather
          // than by reimplementing dispatch here.
          pill.click();
        } else {
          // Lifted over empty space or back over the subject: cancel. A
          // finger that has left the glass can never supply the tap this
          // ring is otherwise waiting for, so leaving it open would strand
          // it until the player's next unrelated tap dismissed it by
          // accident.
          viewState.ringMenu = null;
          onChange();
        }
        return;
      }

      if (pointers.size === 1) {
        // Came out of a pinch with one finger still down. Re-anchor the pan
        // to where THAT finger is now, or the map jumps by the gap between
        // them on the next move.
        const [rest] = [...pointers.values()];
        dragStartX = rest.x; dragStartY = rest.y;
        dragging = true;
        dragMoved = true;  // still not a tap
        pinchStartDist = 0;
        return;
      }
      if (pointers.size > 0) return;

      const wasDragging = dragging;
      dragging = false;
      pinchStartDist = 0;
      canvas.style.cursor = "grab";

      // A tap is a press that neither travelled nor became a hold. Resolved
      // here rather than in a `click` listener so mouse and touch share one
      // path -- see this module's header.
      if (!wasDragging || dragMoved || longPressFired) return;
      if (e.pointerType === "mouse" && e.button === 2) return;
      // Units/cities aren't clickable while other kingdoms are taking their
      // turn (2026-08-27, user-directed) -- gameState is being actively
      // mutated by the AI turn-processing loop for that whole window
      // (main.js's advanceTurn), so a tap here would select or open a ring
      // on state that's already stale or still changing. Panning/pinch-zoom
      // happen earlier in the gesture (the pointermove handler above) and
      // are unaffected -- this only swallows the TAP's resolution.
      if (viewState.turnBanner) return;
      const tilePos = eventTile(e, canvas, viewState, gameState);
      if (!tilePos) return;

      // Structure-placement mode swallows the tap: while the player is
      // picking a tile for a queued building, a tap means "put it here", not
      // "inspect this tile". Tapping outside the highlighted slots cancels,
      // which is the conventional escape from a modal cursor.
      if (viewState.placement) {
        const slot = viewState.placement.slots.find((s) => s.x === tilePos.x && s.y === tilePos.y);
        if (viewState.placement.onPick) viewState.placement.onPick(slot || null);
        onChange();
        return;
      }
      // A single tap/click on an actionable unit/city presents its menu
      // immediately, no long-press or right-click required (2026-08-27,
      // user-directed: mobile got this first on 2026-08-27, now desktop
      // matches it too) -- long-press and right-click still work exactly as
      // before (openRingMenu below), this is just a THIRD entry point to
      // the same ring. Long-press's own slide-into-RING-DRAG gesture is
      // unaffected -- this branch is simply never reached for a held press,
      // since `longPressFired` already returned early above the instant the
      // timer opens its own ring.
      //
      // Same retarget-then-recompute shape as openRingMenu (2026-08-27
      // bugfix, folded in here rather than kept as this branch's own
      // simpler-but-wrong version): compute options against whatever's
      // CURRENTLY selected first, and only call handleTileClick (which
      // reselects based on the CLICKED tile) when mapMenuOptions actually
      // says to retarget. Calling handleTileClick unconditionally BEFORE
      // computing options -- this branch's original shape -- silently broke
      // "a commandable unit is selected, tap a remote empty tile to move it
      // there": handleTileClick would reselect onto that empty tile first,
      // clearing viewState.selectedUnit, so mapMenuOptions then found
      // nothing selected to move at all.
      //
      // The one thing openRingMenu itself doesn't need but this tap path
      // still does: when NEITHER retargeting NOR any option exists (empty
      // ground, nothing selected -- the ring has nothing to show either
      // way), still call handleTileClick so a plain click can keep doing
      // what it's always done on desktop -- browse/inspect whatever tile
      // you click, terrain included, even with nothing to command there.
      const orders = window.GameEngine.orders;
      let res = orders.mapMenuOptions(gameState, viewState, tilePos.x, tilePos.y, viewState.humanCivId);
      if (res.retarget) {
        handleTileClick(tilePos, gameState, viewState);
        const sel = viewState.selection;
        if (sel) {
          const wanted = res.subject === "city" ? "city" : "unit";
          const idx = sel.tabs.findIndex((t) => t.kind === wanted);
          if (idx >= 0) setActiveTab(gameState, viewState, idx);
        }
        res = orders.mapMenuOptions(gameState, viewState, tilePos.x, tilePos.y, viewState.humanCivId);
      } else if (!res.options.length) {
        handleTileClick(tilePos, gameState, viewState);
      }
      if (res.options.length) {
        viewState.ringMenu = { x: tilePos.x, y: tilePos.y, subject: res.subject, page: null };
        viewState.hoverTile = null;
      }
      onChange();
    }

    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);

    // Scroll wheel: bare wheel zooms toward the cursor, matching every
    // other strategy game's convention (GameConfig.view.wheelZooms, default
    // true -- set false to restore the original bare-wheel-pans/Ctrl-wheel-
    // zooms behavior). Shift+wheel pans horizontally, Alt+wheel pans
    // vertically. Ctrl/Cmd+wheel ALWAYS zooms regardless of the flag --
    // that's how trackpad pinch-to-zoom arrives (synthesized as a wheel
    // event with ctrlKey true), so it can't be repurposed as "the pan
    // modifier" without breaking pinch.
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const wheelZooms = window.GameConfig.view.wheelZooms !== false;
      const isPinch = e.ctrlKey || e.metaKey;
      const wantsZoom = isPinch || (wheelZooms && !e.shiftKey && !e.altKey);
      if (wantsZoom) {
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
        // Normalize to px: Firefox reports DOM_DELTA_LINE (deltaMode 1),
        // where deltaY/deltaX are tiny (~3) integers instead of the ~100
        // Chrome/Safari send for DOM_DELTA_PIXEL (deltaMode 0) -- scale up
        // so line-mode panning isn't ~30x slower than pixel-mode panning.
        const scale = e.deltaMode === 1 ? 16 : 1;
        if (wheelZooms) {
          // Shift/Alt pan modifiers: use whichever raw delta axis carried
          // the scroll (some devices/OSes report a plain vertical scroll
          // as deltaY even while Shift is held, others already flip it to
          // deltaX) so a single-axis scroll gesture always pans, never
          // sits inert because it landed on the "wrong" axis.
          const mag = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * scale;
          if (e.shiftKey) viewState.scrollX = (viewState.scrollX || 0) + mag;
          else viewState.scrollY = (viewState.scrollY || 0) + mag;
        } else {
          viewState.scrollX = (viewState.scrollX || 0) + e.deltaX * scale;
          viewState.scrollY = (viewState.scrollY || 0) + e.deltaY * scale;
        }
      }
      onChange();
    }, { passive: false });

    // Desktop entry point to the radial menu. Touch reaches the same
    // openRingMenu() via the long-press timer in pointerdown above.
    // preventDefault always, even on a no-op -- and note this also suppresses
    // the browser's OWN long-press context menu on mobile, which would
    // otherwise race ours.
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (dragMoved) return;
      const tilePos = eventTile(e, canvas, viewState, gameState);
      if (!tilePos) return;
      openRingMenu(tilePos, gameState, viewState, onChange);
    });

    // Hover tile drives the path preview and the move/attack cursor. Tracked
    // on the canvas only (not window) so leaving the map clears it.
    //
    // Frozen while a ring menu is open. The
    // cosmetic reason is that a stale attack reticle shouldn't sit under the
    // menu; the structural reason is worse. Every hover change calls
    // onChange() -> redraw(), and moving the cursor from the subject tile out
    // to a pill crosses the canvas -- so without this, the ring's own DOM
    // would be rebuilt several times mid-travel, which is exactly the
    // "control swapped out from under the click" failure main.js's
    // hasFocusedControlIn comment documents for the report dropdowns.
    // MOUSE ONLY. A touch device has no hover state, and a finger dragging
    // across the map would otherwise leave a path preview and attack reticle
    // painted under wherever it happened to lift. On touch the SELECTED tile
    // carries that role instead.
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      if (dragging) return; // panning, not aiming
      if (viewState.ringMenu) return;
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
    canvas.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      if (viewState.hoverTile) { viewState.hoverTile = null; onChange(); }
    });
  }

  /** RADIAL MENU: opens a ring of context-relevant actions AROUND a tile (see
   *  orders.js's contextMenuOptions for what's offered and why,
   *  js/ui/ringmenu.js for the geometry, main.js's redraw()/
   *  handleContextMenuAction for how it's rendered and dispatched). This only
   *  decides WHERE, never what -- same "decide where, not what" split the
   *  original right-click handler had.
   *
   *  The ring anchors to the TILE, not to the cursor, so there is no
   *  screen-position argument at all. That is also what lets a long-press
   *  reuse this untouched: a finger has no cursor to anchor to. */
  function openRingMenu(tilePos, gameState, viewState, onChange) {
    const orders = window.GameEngine.orders;

    // Units/cities aren't clickable while other kingdoms are taking their
    // turn -- see endPointer's own identical gate for why. Covers this
    // function's other two entry points (long-press, desktop right-click),
    // which never go through endPointer's tap branch at all.
    if (viewState.turnBanner) return;

    // Structure placement is a modal cursor that swallows taps (see the tap
    // branch in endPointer), so the ring gesture is the conventional escape
    // from it rather than yet another way to open a menu.
    if (viewState.placement) {
      if (viewState.placement.onPick) viewState.placement.onPick(null);
      onChange();
      return;
    }

    let res = orders.mapMenuOptions(gameState, viewState, tilePos.x, tilePos.y, viewState.humanCivId);
    // Retarget BEFORE committing to an option list: the subject is on the
    // clicked tile (one of the player's own units, or a city with nothing
    // selected), so selection follows the ring and the sidebar stays in
    // agreement with it. Forcing the tab matters -- handleTileClick carries
    // the previously-active tab KIND forward, so arriving from a Terrain tab
    // would otherwise leave the sidebar showing terrain while the ring talks
    // about a unit. Same follow-up main.js's Next Unit cycler does.
    if (res.retarget) {
      handleTileClick(tilePos, gameState, viewState);
      const sel = viewState.selection;
      if (sel) {
        const wanted = res.subject === "city" ? "city" : "unit";
        const idx = sel.tabs.findIndex((t) => t.kind === wanted);
        if (idx >= 0) setActiveTab(gameState, viewState, idx);
      }
      // Re-derive against the new selection -- the previous list was built
      // for whatever happened to be selected a moment ago.
      res = orders.mapMenuOptions(gameState, viewState, tilePos.x, tilePos.y, viewState.humanCivId);
    }

    if (!res.options.length) {
      onChange();
      return;
    }
    viewState.ringMenu = { x: tilePos.x, y: tilePos.y, subject: res.subject, page: null };
    // Aiming is over -- the player is reading the ring now, not the map. See
    // the hover handler for why this matters beyond cosmetics.
    viewState.hoverTile = null;
    onChange();
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

    // ...EXCEPT when there's a unit standing here:
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
    // movement -- it's a "here I am, ready"
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
    //: a queued multi-turn move/build-road
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
