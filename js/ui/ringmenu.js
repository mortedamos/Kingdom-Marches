/**
 * RADIAL MAP MENU
 * ---------------
 * Actions appear as pills arranged around the SUBJECT on the map -- the unit
 * or city they belong to -- so the map itself carries the verbs and the
 * sidebar (js/ui/sidebar.js) stays pure information.
 *
 * Same "pure render, main.js dispatches" split every other UI module here
 * follows (dialog.js, techtree.js, sidebar.js): this file knows about circles
 * and screen edges, nothing about what any option DOES. The option list comes
 * from js/engine/orders.js; main.js wires the clicks.
 *
 * WHY DOM AND NOT CANVAS
 * A canvas ring would paint underneath the #map-clouds overlay canvas, need
 * hand-rolled hit testing, and lose the global button-click sfx main.js binds
 * to every <button> on the page. Real buttons get all of that free.
 *
 * WHY PILLS ON A CIRCLE AND NOT PIE WEDGES
 * Wedges are hard to label (text has to curve or shrink) and hard to hit near
 * the hub. Pills are ordinary buttons that happen to sit on a circle, so they
 * stay legible at any zoom and degrade gracefully to a single arc -- or, in
 * the worst case, a plain scrollable list -- when the subject is jammed
 * against a screen edge.
 *
 * GEOMETRY: EQUAL Y, NOT EQUAL ANGLE
 * The obvious layout -- N pills at equal angles, each centered on the circle
 * -- does not survive this game's option lists. A unit standing on its own
 * tile can offer 10+ actions, and equal-angle spacing of ~150px-wide pills
 * needs a radius near 270px before they stop colliding, which puts the ring
 * off-screen at any sane zoom. Instead:
 *
 *   - Pills are spaced by equal Y and solved for X on the circle, so vertical
 *     separation is exactly PITCH by construction and no collision test is
 *     needed at all.
 *   - Each pill is anchored by its INNER edge (the edge facing the subject),
 *     growing outward. A long label therefore extends away from the ring
 *     instead of into it, so label length can never cause an overlap either.
 *
 * The result reads as a bowed column: the middle item sits furthest out, the
 * top and bottom curve back in toward the subject.
 */

window.UI = window.UI || {};

(function () {
  // PILL_H/PITCH are functions, not consts, and read body.mobile LIVE
  // (2026-08-26, mobile phase 3) -- the mode is decided once at startup (see
  // main.js's detectMobile) and never changes mid-session, but a plain const
  // would freeze whichever value happened to be true when this file first
  // ran, which is script-load order, not game state. A function call costs
  // nothing here; layout() only runs when a ring actually opens or moves.
  //
  // 44px is the touch-target floor; 30px was sized for a mouse pointer,
  // where the target is the label's whole clickable pill rather than a
  // fingertip. PITCH grows by the same amount so the existing "PILL_H + 8px
  // of air" spacing ratio holds instead of pills touching edge to edge.
  function isMobile() { return document.body.classList.contains("mobile"); }
  function PILL_H() { return isMobile() ? 40 : 30; }  // must match .map-ring-item's rendered height (see mobile.css)
  // Vertical centre-to-centre gap. Desktop keeps PILL_H() + 8px of air;
  // mobile settles for +4 (2026-08-26) -- a phone's map area is short, and
  // every px of pitch spent on air pushes the ring's radius out, which on a
  // narrow screen is exactly what runs the pills off the edge. The pills
  // themselves keep their full 44px touch height, which is the number that
  // actually matters for hitting them.
  function PITCH() { return isMobile() ? 44 : 38; }
  // Narrower than this and labels are unreadable -- used for the "does this
  // side fit" test. Lower on mobile, where the pill wraps to two lines
  // rather than ellipsizing (see mobile.css's .map-ring-item-label), so a
  // narrower pill still carries a whole label instead of trailing off.
  function PILL_W_MIN() { return isMobile() ? 78 : 96; }
  // Some real labels ("Gather More Resources (+3H +2C +5L)", "Build Road to
  // This Tile") need more room than this looks generous for. Safe to raise:
  // `place()` below still clamps the actual per-pill width to whatever room
  // is left on that side (`Math.min(PILL_W_MAX, room - R - PAD)`), so this
  // only caps width -- it can never push a pill off the visible area.
  const PILL_W_MAX = 320;
  const BOW = 26;           // how far the middle pill bulges past the innermost ones
  const PAD = 12;           // keep-out margin against the map area's edges

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /**
   * Where each of `n` pills goes, given the subject's position and the space
   * available. `ctx` is { cx, cy, mapW, mapH, ts } in map-area pixels -- cx/cy
   * from render.js's tileCenterOnMap, mapW/mapH the map area's own size.
   *
   * Returns { mode, items } where mode is "ring" (pills individually placed)
   * or "list" (a fallback for when even one column is taller than the map
   * area -- see below), and each item is
   *   { side: "left"|"right", top, offset, maxW }
   * `offset` is the CSS `left` for a right-side pill and the CSS `right` for
   * a left-side one, which is what makes the inner-edge anchoring work: a
   * right-side pill's left edge is pinned and it grows rightward, a left-side
   * pill's right edge is pinned and it grows leftward.
   *
   * Exported (not private) so the layout can be exercised directly against
   * awkward inputs -- N=1, N=14, a subject in a screen corner -- without
   * having to drive a real game into that state first.
   */
  function layout(n, ctx) {
    const { cx, cy, mapW, mapH, ts } = ctx;
    // Snapshot once per call -- body.mobile cannot change mid-call, and
    // re-reading the class list on every reference below would be silly.
    const mobile = isMobile();
    const pillH = PILL_H(), pitch = PITCH();
    // Never let the ring sit on top of the subject's own art, which grows
    // with zoom -- but never collapse smaller than a comfortable click
    // target either, which is what the floor is for at low zoom. The mobile
    // floor is lower (2026-08-26): a phone's map is ~375px wide, so a 96px
    // floor plus a pill's own width leaves nothing on either side of a
    // centred subject, and the ring gets pushed off the screen.
    const pillWMin = PILL_W_MIN();
    const rMin = mobile ? Math.max(0.6 * ts, 50) : Math.max(0.9 * ts, 96);
    const radiusFor = (k) => Math.max(rMin, ((k - 1) / 2) * pitch + BOW);

    const roomRight = mapW - cx;
    const roomLeft = cx;
    // Can `k` pills be drawn on `room` px of side, and if so at what radius
    // and width? Returns null when they can't, which is now taken at face
    // value (see the split logic below) instead of being overridden.
    const solveSide = (room, k) => {
      const R = radiusFor(k);
      const w = Math.min(PILL_W_MAX, room - R - PAD);
      return w >= pillWMin ? { R, maxW: w } : null;
    };
    const fits = (room, k) => !!solveSide(room, k);

    // Column split. Two columns only once there are enough items to be worth
    // it (N>=4) AND both sides have the room; otherwise everything goes on
    // whichever single side can take it, and if neither can, the whole ring
    // gives way to the scrollable list (see listFallback below).
    //
    // ctx.split, when present, overrides all of that -- a merged unit+city
    // ring (see orders.js's mergeUnitCityOptions) wants unit actions on the
    // LEFT and city actions on the RIGHT unconditionally, not a suggestion
    // the room-fit logic above is free to renegotiate. `options` is built as
    // [...unitOptions, ...cityOptions] to match, which is why the placement
    // order below differs between the two branches (auto mode reads
    // right-then-left off the front of the array; forced mode reads
    // left-then-right).
    const listFallback = () => ({ mode: "list", side: roomRight >= roomLeft ? "right" : "left", items: [] });

    let rightCount, leftCount;
    if (ctx.split) {
      leftCount = ctx.split.leftCount;
      rightCount = ctx.split.rightCount;
      // A forced split still has to physically fit. It didn't have to before
      // -- see the "neither side fits" note just below for why that used to
      // be survivable and no longer is.
      if ((leftCount && !fits(roomLeft, leftCount)) || (rightCount && !fits(roomRight, rightCount))) {
        return listFallback();
      }
    } else {
      const half = Math.ceil(n / 2);
      if (n >= 4 && fits(roomRight, half) && fits(roomLeft, n - half)) {
        rightCount = half;
        leftCount = n - half;
      } else if (fits(roomRight, n)) {
        rightCount = n; leftCount = 0;
      } else if (fits(roomLeft, n)) {
        rightCount = 0; leftCount = n;
      } else {
        // Neither side fits (2026-08-26, user-reported: "in mobile view,
        // parts of the ring menu can appear off-screen"). This used to pile
        // everything onto the roomier side anyway "with the labels allowed
        // to ellipsize" -- but place() then floored each pill's width at
        // PILL_W_MIN regardless of how much room was actually left, so the
        // pills didn't ellipsize, they just hung off the edge of the map.
        // On a phone that's the COMMON case, not an exotic one: a 375px-wide
        // map area can't seat a ~200px radius plus a pill on either side of
        // a subject anywhere near the middle. The honest answer at that size
        // is the list, which is scrollable, fully on-screen, and works with
        // the same long-press-and-slide gesture the ring does (input.js
        // hit-tests .map-ring-item, which listed pills also are).
        return listFallback();
      }
    }

    // A column taller than the map area can't be placed on a circle at all --
    // no radius makes it fit. Rather than pretend, hand back a plain
    // scrollable list; the caller renders that as a stacked container.
    const tallest = Math.max(rightCount, leftCount);
    if ((tallest - 1) * pitch + pillH > mapH - 2 * PAD) return listFallback();

    const items = new Array(n);
    const place = (side, count, startIndex) => {
      if (!count) return;
      const room = side === "right" ? roomRight : roomLeft;
      // Non-null by construction: every path that reaches place() has
      // already run this exact side/count through fits() above.
      const { R, maxW } = solveSide(room, count) || { R: radiusFor(count), maxW: pillWMin };

      // Solve X on the circle for an evenly-spaced Y. The sqrt is always real
      // because radiusFor's BOW term keeps R strictly greater than the
      // largest |yOff| it is asked about.
      const placed = [];
      for (let j = 0; j < count; j++) {
        const yOff = (j - (count - 1) / 2) * pitch;
        placed.push({ yOff, xOff: Math.sqrt(Math.max(0, R * R - yOff * yOff)) });
      }

      // Vertical clamp: translate the WHOLE column by one delta rather than
      // re-solving the bow against the clamped positions. A re-bowed arc
      // reads as broken -- the pills stop describing a circle and the eye
      // notices immediately -- whereas a rigid shift just looks like the ring
      // slid, which is what actually happened.
      const minTop = cy + placed[0].yOff - pillH / 2;
      const maxBot = cy + placed[count - 1].yOff + pillH / 2;
      let dy = 0;
      if (minTop < PAD) dy = PAD - minTop;
      else if (maxBot > mapH - PAD) dy = mapH - PAD - maxBot;

      for (let j = 0; j < count; j++) {
        const { yOff, xOff } = placed[j];
        items[startIndex + j] = {
          side,
          top: cy + yOff + dy,
          offset: side === "right" ? cx + xOff : mapW - (cx - xOff),
          maxW,
        };
      }
    };
    if (ctx.split) {
      place("left", leftCount, 0);
      place("right", rightCount, leftCount);
    } else {
      place("right", rightCount, 0);
      place("left", leftCount, rightCount);
    }

    return { mode: "ring", items };
  }

  // City-action pills read slightly lighter than unit-action ones -- most
  // visible on a merged ring (see orders.js's mergeUnitCityOptions), where
  // both kinds sit side by side and otherwise look identical apart from
  // which column they're in. "city:" is the same kind-string prefix main.js's
  // dispatcher already switches on (city:buildUnit, city:cancelBuild,
  // city:nextProduction:X,Y, ...), so there's no second classification to
  // keep in sync with orders.js.
  function itemHtml(o, sideClass) {
    const cityClass = o.kind.startsWith("city:") ? " map-ring-item-city" : "";
    // o.shortcut is set by main.js's renderRingMenu for the handful of pills
    // that have a fixed key binding; plain trailing text inside the same
    // nowrap/ellipsis button rather than a flex layout, so a long label just
    // pushes it toward (and, worst case, past) the clipped edge instead of
    // needing its own box model.
    const shortcut = o.shortcut ? `<span class="map-ring-item-shortcut">${escapeHtml(o.shortcut)}</span>` : "";
    // o.cost is a generic optional field ANY option can carry (currently
    // only orders.js's buildBridge pill sets it) -- a short pre-formatted
    // price string (e.g. "11C"), red via o.affordable===false rather than
    // greyed out like an unaffordable buildlist.js row, since this pill
    // still needs to stay clickable (it opens the tile picker; the actual
    // affordability check happens per-segment at build time, same as
    // advanceGotoOrder's own "Bridge halted — not enough Coin" abort).
    const cost = o.cost != null
      ? `<span class="map-ring-item-cost${o.affordable === false ? " map-ring-item-cost-unaffordable" : ""}">${escapeHtml(o.cost)}</span>`
      : "";
    // The label lives in its own span (2026-08-26) so it can be the only
    // shrinkable part of the pill: the button is a flex row, and the cost/
    // shortcut badges keep their natural size while the label takes the
    // squeeze. That's also what lets mobile wrap the label to two lines
    // without the badges wrapping with it -- see mobile.css's
    // .map-ring-item-label, added because a single 44px-tall line of 13px
    // text was truncating most real labels on a phone.
    return `<button class="map-ring-item${sideClass}${cityClass}${o.danger ? " map-ring-item-danger" : ""}"`
      + ` data-ring-kind="${escapeHtml(o.kind)}" title="${escapeHtml(o.label)}">`
      + `<span class="map-ring-item-label">${escapeHtml(o.label)}</span>${cost}${shortcut}</button>`;
  }

  /** Applies one layout to real elements. Shared by render (via a detached
   *  parse) and position (against the live DOM) so there is exactly one
   *  place that turns layout numbers into styles. */
  function applyRing(container, lay, ctx) {
    const focus = container.querySelector(".map-ring-focus");
    if (focus) {
      focus.style.left = `${Math.round(ctx.cx - ctx.ts / 2)}px`;
      focus.style.top = `${Math.round(ctx.cy - ctx.ts / 2)}px`;
      focus.style.width = `${Math.round(ctx.ts)}px`;
      focus.style.height = `${Math.round(ctx.ts)}px`;
    }
    const pills = container.querySelectorAll(".map-ring-item");
    pills.forEach((btn, i) => {
      const it = lay.items[i];
      if (!it) return;
      // Clear the opposite edge before setting this one -- a re-layout can
      // move a pill from the right column to the left (a zoom that changes
      // the radius, a pan toward a screen edge), and a stale `left` would
      // fight the new `right`.
      btn.style.left = it.side === "right" ? `${Math.round(it.offset)}px` : "";
      btn.style.right = it.side === "left" ? `${Math.round(it.offset)}px` : "";
      btn.style.top = `${Math.round(it.top)}px`;
      btn.style.maxWidth = `${Math.round(it.maxW)}px`;
      btn.classList.toggle("map-ring-item-right", it.side === "right");
      btn.classList.toggle("map-ring-item-left", it.side === "left");
    });
  }

  /** Narrower than this and the list is worse than useless -- see the
   *  anchoring note in applyList. */
  const LIST_MIN_W = 180;
  function applyList(container, lay, ctx) {
    const box = container.querySelector(".map-ring-list");
    if (!box) return;
    const room = lay.side === "right" ? ctx.mapW - ctx.cx : ctx.cx;
    // Anchor beside the subject when there is room there for a usable list;
    // otherwise pin to that side of the map area instead (2026-08-26). A
    // subject near a screen edge used to leave the box anchored a few px
    // from that edge with a min-width still holding it open, which on a
    // phone put most of the list off-screen -- the mobile ring's most
    // visible symptom, since a phone reaches list mode far more often than
    // a desktop ever did. maxWidth is set to whatever room the chosen
    // anchor actually has, so the box can never grow past the map area.
    const anchored = room - 2 * PAD >= LIST_MIN_W;
    if (lay.side === "right") {
      box.style.left = `${Math.round(anchored ? ctx.cx + PAD : PAD)}px`;
      box.style.right = "";
    } else {
      box.style.right = `${Math.round(anchored ? ctx.mapW - ctx.cx + PAD : PAD)}px`;
      box.style.left = "";
    }
    box.style.top = `${PAD}px`;
    box.style.maxWidth = `${Math.round((anchored ? room : ctx.mapW) - 2 * PAD)}px`;
    box.style.maxHeight = `${Math.round(ctx.mapH - 2 * PAD)}px`;
  }

  /**
   * `options` is the fresh list from orders.js; `ctx` carries the subject's
   * position (see layout). The outer container spans the whole map area and
   * is pointer-events:none, so only the pills themselves intercept clicks and
   * the map underneath stays draggable everywhere else -- which is also what
   * lets main.js's click-outside dismissal keep working unchanged.
   *
   * Emits the pills UNPOSITIONED and lets position() place them, so there is
   * only one copy of the style-writing code and no way for the initial paint
   * and a later re-anchor to disagree.
   */
  function render(options, ctx) {
    const lay = layout(options.length, ctx);
    if (lay.mode === "list") {
      const items = options.map((o) => itemHtml(o, " map-ring-item-listed")).join("");
      return `<div class="map-ring" data-ring-mode="list"><div class="map-ring-list">${items}</div></div>`;
    }
    // The faint tile-sized disc under the subject ties the scattered pills
    // back to the thing they act on. Purely decorative, and inside the
    // pointer-events:none container, so it never eats a click meant for the
    // unit underneath it.
    const pills = options.map((o) => itemHtml(o, "")).join("");
    return `<div class="map-ring" data-ring-mode="ring"><div class="map-ring-focus"></div>${pills}</div>`;
  }

  /**
   * A ring SUB-PAGE: the build list, the level-up picker -- anything that is
   * a short list of rich rows rather than a handful of one-word verbs.
   *
   * Anchored beside the subject like the ring itself, and rendered into the
   * same root, so main.js's click-outside dismissal and Escape handling cover
   * it with no extra wiring. `innerHtml` is whatever the page's own renderer
   * produced (js/ui/buildlist.js, or the level-up buttons); this only
   * supplies the frame, the title, and the way back to the ring.
   */
  function renderPopover(title, innerHtml) {
    return `<div class="map-ring" data-ring-mode="popover">
      <div class="map-ring-popover">
        <div class="map-ring-popover-head">
          <span>${escapeHtml(title)}</span>
          <button class="map-ring-back" data-ring-back="1">Back</button>
        </div>
        <div class="map-ring-popover-body">${innerHtml}</div>
      </div>
    </div>`;
  }

  /** Places the popover on whichever side of the subject has more room,
   *  vertically centred on it and then rigid-clamped to the map box -- the
   *  same treatment the ring's own columns get. */
  function positionPopover(root, ctx) {
    const box = root.querySelector(".map-ring-popover");
    if (!box) return false;
    const rMin = Math.max(0.9 * ctx.ts, 96);
    const w = box.offsetWidth || 260;
    const h = box.offsetHeight || 240;
    const preferRight = ctx.mapW - ctx.cx >= ctx.cx;
    let left = preferRight ? ctx.cx + rMin : ctx.cx - rMin - w;
    left = Math.max(PAD, Math.min(left, ctx.mapW - w - PAD));
    let top = ctx.cy - h / 2;
    top = Math.max(PAD, Math.min(top, ctx.mapH - h - PAD));
    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(top)}px`;
    box.style.maxHeight = `${Math.round(ctx.mapH - 2 * PAD)}px`;
    return true;
  }

  /**
   * Re-anchors an ALREADY-RENDERED ring against a fresh ctx -- style writes
   * only, no new nodes -- so the ring follows the map when it's panned or
   * zoomed while open without ever replacing a button mid-click.
   *
   * Returns false when the layout has changed shape so much that the markup
   * itself is wrong (ring <-> list, which have different DOM), telling the
   * caller to re-render instead. Everything else, including a pill switching
   * sides, is handled in place.
   */
  function position(root, options, ctx) {
    const container = root.querySelector(".map-ring");
    if (!container) return false;
    if (container.dataset.ringMode === "popover") return positionPopover(root, ctx);
    const lay = layout(options.length, ctx);
    if (container.dataset.ringMode !== lay.mode) return false;
    if (lay.mode === "list") applyList(container, lay, ctx);
    else applyRing(container, lay, ctx);
    return true;
  }

  window.UI.ringmenu = { render, renderPopover, position, layout };
})();
