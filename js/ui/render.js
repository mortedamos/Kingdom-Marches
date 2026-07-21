/**
 * MAP RENDERER
 * ------------
 * Canvas-based rendering of the tile grid, units, cities, and the
 * toggleable influence overlay. See map_ui_design.md for the visual spec
 * this implements (flat 2D tiles, civ-colored units/cities, hatched
 * pattern for contested tiles, clean default view).
 */

window.UI = window.UI || {};

(function () {
  const TILE_SIZE = 34; // base tile size; actual rendered size = TILE_SIZE * zoomLevel
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 3.0;
  const RUIN_ICON_SCALE = .75; // ruins read as a little bigger than a tile-fill resource icon (see per-resource iconScale in terrain.js)
  const MOVE_ANIM_MS = 350; // purely visual glide duration for unit movement
  const ATTACK_ANIM_MS = 500; // total lifetime of a combat "wiggle" (attacker lunge / defender recoil)
  const SLASH_ANIM_MS = 260; // shorter-lived slash/swipe overlay drawn on top
  const QUIP_ANIM_MS = 2200; // total lifetime of a speech bubble (incl. fade in/out)
  const QUIP_FADE_MS = 250; // fade-in and fade-out duration at each end of QUIP_ANIM_MS
  // Raised from an initial 1400ms (user-directed, 2026-07-18) -- too short to
  // actually read the text before it faded. Now a quick pop-in, a long fully-
  // opaque HOLD so there's real time to read it, then a quick fade-out at the
  // very end, rather than one long linear fade the whole time (which reads as
  // "washed out" for most of its life at this length).
  const FLOAT_TEXT_ANIM_MS = 3000; // total lifetime of a floating-text popup (incl. fade in/hold/fade out)
  const FLOAT_TEXT_FADE_IN_MS = 150; // quick pop-in at the start
  const FLOAT_TEXT_FADE_OUT_MS = 500; // quick fade-out at the very end; everything between is full opacity

  /**
   * Live combat attack/wiggle effects, drained each frame from
   * window.GameEngine.combat's cosmetic event queue (see combat.js --
   * populated only at real, on-board attack call sites in ai.js, never by
   * the resolveRound/resolveToTheDeath calls ai.js also uses for
   * hypothetical win-probability sampling). Each entry gets a handful of
   * randomized parameters at creation time so repeated attacks don't all
   * play identically. Purely cosmetic, module-level state -- same pattern
   * as getVisualPos's per-unit render fields above.
   */
  let activeCombatAnims = [];

  function updateCombatAnims(now) {
    const newEvents = window.GameEngine.combat.drainCombatEvents();
    for (const evt of newEvents) {
      const dxg = evt.dx - evt.ax, dyg = evt.dy - evt.ay;
      const len = Math.hypot(dxg, dyg) || 1;
      // Attack glyph: a random pick from the attacker's own unit-defined set
      // (window.GameData.getAttackChars), falling back to "☽" for any unit
      // that hasn't been given its own set yet. Elf "Shadowsteed": mounted,
      // it fights with its RIDER's kit (see combat.js's shadowsteedMount and
      // effectiveAttack/etc.), so its attack glyph should read as the
      // rider's weapon too, not the Shadowsteed's own bare hooves.
      const mount = window.GameEngine.combat.shadowsteedMount(evt.atkUnit);
      const attackChars = window.GameData.getAttackChars(mount ? mount.typeId : evt.atkUnit.typeId);
      // Ranged (see combat.js's effectiveRange): the glyph travels attacker
      // -> defender instead of flashing at the midpoint -- see
      // drawCombatSlashes. Chebyshev, matching every other range check.
      const isRanged = Math.max(Math.abs(dxg), Math.abs(dyg)) > 1;
      activeCombatAnims.push({
        ...evt,
        start: now,
        nx: dxg / len, ny: dyg / len,
        ampScale: 0.75 + Math.random() * 0.5,
        freq: 2.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
        slashChar: attackChars[Math.floor(Math.random() * attackChars.length)],
        slashRot: (Math.random() - 0.5) * 0.5,
        isRanged,
      });
    }
    if (activeCombatAnims.length) {
      activeCombatAnims = activeCombatAnims.filter((a) => now - a.start < ATTACK_ANIM_MS);
    }
  }

  /**
   * Live speech-bubble quips, drained each frame from window.GameEngine.
   * quips' cosmetic event queue (see engine/quips.js -- populated RARELY, at
   * real action-decision call sites in ai.js). Same pull-based pattern as
   * activeCombatAnims above: the engine never depends on window.UI, so the
   * UI pulls from a private queue instead. Keyed by the unit object itself
   * (a stable per-instance identity) so drawQuipBubble can look up "does
   * THIS unit have an active quip right now" in the unit draw loop.
   */
  let activeQuips = [];

  function updateQuipBubbles(now) {
    const newEvents = window.GameEngine.quips.drainQuipEvents();
    for (const evt of newEvents) activeQuips.push({ unit: evt.unit, text: evt.text, start: now });
    if (activeQuips.length) {
      activeQuips = activeQuips.filter((q) => now - q.start < QUIP_ANIM_MS);
    }
  }

  /**
   * Live floating-text popups ("Level Up!", "+N XP", per-turn resource
   * gains -- see engine/floatingtext.js), drained each frame same as
   * activeCombatAnims/activeQuips above. Several can be active for the SAME
   * unit at once (e.g. an XP grant and the level-up it triggers fire back
   * to back) -- `stackIndex` records how many of this unit's OTHER
   * currently-active popups existed at spawn time, so drawFloatingTexts can
   * offset each one higher, stacking them instead of drawing on top of
   * each other illegibly.
   */
  let activeFloatingTexts = [];

  function updateFloatingTexts(now) {
    const newEvents = window.GameEngine.floatingText.drainFloatingTextEvents();
    for (const evt of newEvents) {
      const stackIndex = activeFloatingTexts.filter(
        (f) => f.unit === evt.unit && now - f.start < FLOAT_TEXT_ANIM_MS).length;
      activeFloatingTexts.push({ unit: evt.unit, text: evt.text, kind: evt.kind, start: now, stackIndex });
    }
    if (activeFloatingTexts.length) {
      activeFloatingTexts = activeFloatingTexts.filter((f) => now - f.start < FLOAT_TEXT_ANIM_MS);
    }
  }

  /** Color/weight per floating-text `kind` (see engine/floatingtext.js's
   *  spawnFloatingText/spawnResourceGain call sites for which kind each
   *  event uses). "default" is the fallback for anything uncategorized. */
  const FLOAT_TEXT_STYLES = {
    levelup: { color: "#ffd54f", bold: true, sizeFrac: 0.30 },
    xp: { color: "#7fd8ff", bold: false, sizeFrac: 0.22 },
    resource: { color: "#8bc34a", bold: false, sizeFrac: 0.20 },
    heal: { color: "#69f0ae", bold: false, sizeFrac: 0.22 },
    aura: { color: "#ce93d8", bold: true, sizeFrac: 0.26 },
    warning: { color: "#ff7043", bold: true, sizeFrac: 0.24 },
    default: { color: "#ffffff", bold: false, sizeFrac: 0.22 },
  };

  /** Draws every active floating-text popup anchored to `unit` -- pops in
   *  quickly (FLOAT_TEXT_FADE_IN_MS), drifts upward the whole time, holds at
   *  full opacity for most of its life (long enough to actually read), then
   *  fades out quickly at the very end (FLOAT_TEXT_FADE_OUT_MS). `screenX`/
   *  `screenY` are the unit's own tile-top screen position, same convention
   *  as drawQuipBubble. */
  function drawFloatingTexts(ctx, unit, screenX, screenY, ts, now) {
    for (const f of activeFloatingTexts) {
      if (f.unit !== unit) continue;
      const age = now - f.start;
      const t = age / FLOAT_TEXT_ANIM_MS;
      let alpha = 1;
      if (age < FLOAT_TEXT_FADE_IN_MS) alpha = age / FLOAT_TEXT_FADE_IN_MS;
      else if (age > FLOAT_TEXT_ANIM_MS - FLOAT_TEXT_FADE_OUT_MS) {
        alpha = (FLOAT_TEXT_ANIM_MS - age) / FLOAT_TEXT_FADE_OUT_MS;
      }
      const style = FLOAT_TEXT_STYLES[f.kind] || FLOAT_TEXT_STYLES.default;
      const rise = ts * 0.85 * t; // drifts upward over its whole lifetime
      const stackGap = ts * 0.32;
      const px = screenX + ts / 2;
      const py = screenY - ts * 0.12 - f.stackIndex * stackGap - rise;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.font = `${style.bold ? "bold " : ""}${Math.max(9, ts * style.sizeFrac)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = Math.max(1, ts * 0.05);
      ctx.strokeText(f.text, px, py);
      ctx.fillStyle = style.color;
      ctx.fillText(f.text, px, py);
      ctx.restore();
    }
  }

  /** Greedy word-wrap: breaks `text` into lines that each fit within
   *  maxWidth at the ctx's current font. Used so a quip's bubble never
   *  renders wider than its own drawn shape, regardless of how long the
   *  underlying string is. */
  function wrapQuipText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Draws a comic-book-style word bubble above a unit's head if it has an
   *  active quip (see updateQuipBubbles). `screenX`/`screenY` are the
   *  unit's own tile-top screen position (same values passed to
   *  drawUnitShadow), so the bubble anchors consistently regardless of the
   *  unit's "bigger" scale. */
  function drawQuipBubble(ctx, unit, screenX, screenY, ts, now) {
    const q = activeQuips.find((a) => a.unit === unit);
    if (!q) return;
    const age = now - q.start;
    let alpha = 1;
    if (age < QUIP_FADE_MS) alpha = age / QUIP_FADE_MS;
    else if (age > QUIP_ANIM_MS - QUIP_FADE_MS) alpha = Math.max(0, (QUIP_ANIM_MS - age) / QUIP_FADE_MS);

    const fontSize = Math.max(9, ts * 0.22);
    ctx.font = `${fontSize}px "Comic Sans MS", "Chalkboard SE", cursive, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxTextWidth = ts * 3.4;
    const lines = wrapQuipText(ctx, q.text, maxTextWidth);
    const lineHeight = fontSize * 1.25;
    const padX = fontSize * 0.7, padY = fontSize * 0.55;
    const textWidth = Math.min(maxTextWidth, Math.max(...lines.map((l) => ctx.measureText(l).width)));
    const bubbleW = textWidth + padX * 2;
    const bubbleH = lines.length * lineHeight + padY * 2;
    const cx = screenX + ts / 2;
    const tailH = fontSize * 0.5;
    const bubbleBottom = screenY - tailH - ts * 0.06;
    const bubbleX = cx - bubbleW / 2;
    const bubbleY = bubbleBottom - bubbleH;
    const radius = Math.min(10, bubbleH * 0.25);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Bubble body (rounded rect)
    ctx.beginPath();
    ctx.moveTo(bubbleX + radius, bubbleY);
    ctx.arcTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + bubbleH, radius);
    ctx.arcTo(bubbleX + bubbleW, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH, radius);
    ctx.arcTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY, radius);
    ctx.arcTo(bubbleX, bubbleY, bubbleX + bubbleW, bubbleY, radius);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // Tail: small triangle pointing down at the unit's head
    ctx.beginPath();
    ctx.moveTo(cx - tailH * 0.6, bubbleBottom - 1);
    ctx.lineTo(cx + tailH * 0.6, bubbleBottom - 1);
    ctx.lineTo(cx, bubbleBottom + tailH);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - tailH * 0.6, bubbleBottom - 1);
    ctx.lineTo(cx, bubbleBottom + tailH);
    ctx.lineTo(cx + tailH * 0.6, bubbleBottom - 1);
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // Text
    ctx.fillStyle = "#1a1a1a";
    const firstLineY = bubbleY + padY + lineHeight / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, firstLineY + i * lineHeight));

    ctx.restore();
  }

  /**
   * Per-unit pixel offset for the "wiggle": the attacker lunges a step
   * toward its target then settles back, the defender recoils a step away,
   * both with a decaying side-to-side shimmy layered on top for variation.
   * Amplitude scales with the current tile size so it stays proportional
   * across zoom levels.
   */
  function getUnitShakeOffset(unit, ts, now) {
    let ox = 0, oy = 0;
    for (const a of activeCombatAnims) {
      const isAttacker = a.atkUnit === unit;
      const isDefender = a.defUnit === unit;
      if (!isAttacker && !isDefender) continue;
      const t = (now - a.start) / ATTACK_ANIM_MS;
      if (t >= 1) continue;
      const jump = Math.sin(Math.PI * t) * a.ampScale; // 0 -> peak -> 0
      const shimmyEnv = 1 - t;
      if (isAttacker) {
        const jumpPx = ts * 0.16 * jump;
        const shimmyPx = ts * 0.07 * a.ampScale * Math.sin(t * a.freq * Math.PI * 2 + a.phase) * shimmyEnv;
        ox += a.nx * jumpPx + (-a.ny) * shimmyPx;
        oy += a.ny * jumpPx + (a.nx) * shimmyPx;
      } else {
        const recoilPx = ts * 0.13 * jump;
        const shimmyPx = ts * 0.06 * a.ampScale * Math.sin(t * a.freq * Math.PI * 2 + a.phase2) * shimmyEnv;
        ox += -a.nx * recoilPx + (-a.ny) * shimmyPx;
        oy += -a.ny * recoilPx + (a.nx) * shimmyPx;
      }
    }
    return { x: ox, y: oy };
  }

  /**
   * Glyph overlay between attacker and defender tiles -- the glyph itself is
   * per-unit-type (window.GameData.getAttackChars/attackChars, picked at
   * event-creation time in updateCombatAnims), defaulting to "☽" for
   * anything without its own set. Two modes, decided by `a.isRanged` (set
   * once at creation, see updateCombatAnims):
   *   - Melee (adjacent): a quick slash flashes at the midpoint between the
   *     two tiles, growing in then fading out, with a slight random tilt so
   *     repeated attacks don't look perfectly identical.
   *   - Ranged (see combat.js's effectiveRange): the glyph actually travels
   *     from the attacker's tile to the defender's, facing its direction of
   *     travel, fading in/out only briefly at each end -- a unit with real
   *     reach shouldn't look like it's slashing from a shared midpoint it
   *     may never get anywhere near.
   */
  function drawCombatSlashes(ctx, offsetX, offsetY, ts, now) {
    for (const a of activeCombatAnims) {
      const elapsed = now - a.start;
      if (elapsed > SLASH_ANIM_MS) continue;
      const t = elapsed / SLASH_ANIM_MS;
      const ax = a.ax * ts + offsetX + ts / 2;
      const ay = a.ay * ts + offsetY + ts / 2;
      const dx = a.dx * ts + offsetX + ts / 2;
      const dy = a.dy * ts + offsetY + ts / 2;

      let px, py, angle, alpha, size;
      if (a.isRanged) {
        px = ax + (dx - ax) * t;
        py = ay + (dy - ay) * t;
        angle = Math.atan2(dy - ay, dx - ax) + a.slashRot;
        // Full opacity in transit; only a brief fade right at launch/impact.
        alpha = t < 0.15 ? t / 0.15 : (t > 0.85 ? (1 - t) / 0.15 : 1);
        size = ts * 0.6;
      } else {
        px = (ax + dx) / 2;
        py = (ay + dy) / 2;
        angle = a.slashRot;
        alpha = 1 - t;
        const grow = 0.6 + 0.4 * Math.min(1, t * 2.5);
        size = ts * 0.7 * grow;
      }

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `bold ${size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = Math.max(1, ts * 0.05);
      ctx.strokeText(a.slashChar, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(a.slashChar, 0, 0);
      ctx.restore();
    }
  }

  /**
   * Units move instantly in game logic (a whole turn resolves in one call),
   * but the map re-renders every animation frame regardless of turn timing.
   * This tracks each unit's on-screen ("visual") position separately from
   * its logical grid position, and glides visual->logical over MOVE_ANIM_MS
   * whenever the logical position changes -- so a unit slides to its
   * destination instead of popping there instantly. Purely cosmetic state,
   * stored on the unit object itself (mirrors the pattern used for other
   * transient per-unit tracking fields like _lastRitualX).
   */
  function getVisualPos(unit) {
    const now = performance.now();
    if (unit._lastLogicalX === undefined) {
      // First time this unit has been rendered -- no glide, just place it.
      unit._lastLogicalX = unit.x;
      unit._lastLogicalY = unit.y;
      unit._renderX = unit.x;
      unit._renderY = unit.y;
      unit._animStart = 0;
    } else if (unit.x !== unit._lastLogicalX || unit.y !== unit._lastLogicalY) {
      // Logical position changed since we last checked -- glide from wherever
      // it's currently drawn (in case a prior glide was interrupted) to the new spot.
      unit._animFromX = unit._renderX;
      unit._animFromY = unit._renderY;
      unit._animToX = unit.x;
      unit._animToY = unit.y;
      unit._animStart = now;
      unit._lastLogicalX = unit.x;
      unit._lastLogicalY = unit.y;
    }
    if (unit._animStart) {
      const t = Math.min(1, (now - unit._animStart) / MOVE_ANIM_MS);
      unit._renderX = unit._animFromX + (unit._animToX - unit._animFromX) * t;
      unit._renderY = unit._animFromY + (unit._animToY - unit._animFromY) * t;
      if (t >= 1) unit._animStart = 0;
    }
    return { x: unit._renderX, y: unit._renderY };
  }

  // Stable pseudo-random horizontal slot (0=left, 1=center, 2=right) for a
  // tile enhancement icon (resource/ruin), seeded by tile coordinates so
  // it's identical for a live tile and its remembered/fog-of-war snapshot,
  // and never jitters frame to frame.
  function tileIconSlot(x, y) {
    const h = ((x * 374761393) ^ (y * 668265263)) >>> 0;
    return h % 3;
  }

  const RESOURCE_ICON_MARGIN_FRAC = 0.08; // space kept between the tile edge and the icon

  // Bottom-anchored box position for a tile enhancement icon of size `sz`,
  // in one of 3 horizontal slots (tileIconSlot) with margin from the tile
  // edges -- user-directed: icons should sit low-left/low-center/low-right,
  // never dead-center, with breathing room from the edge. Mirrors units'
  // bottom-anchored biggerPct growth (see the unit draw loop below) rather
  // than growing from a fixed center point, so `sz` is as freely adjustable
  // per resource/ruin as biggerPct is per unit.
  function tileIconBox(screenX, screenY, ts, sz, x, y) {
    const margin = ts * RESOURCE_ICON_MARGIN_FRAC;
    const slot = tileIconSlot(x, y);
    const boxX = slot === 0 ? screenX + margin
      : slot === 2 ? screenX + ts - margin - sz
      : screenX + (ts - sz) / 2;
    const boxY = screenY + ts - margin - sz;
    return { boxX, boxY };
  }

  function clampOffset(offsetX, offsetY, canvas, map, ts) {
    const maxX = Math.max(0, map.width  * ts - canvas.width);
    const maxY = Math.max(0, map.height * ts - canvas.height);
    return {
      x: Math.max(0, Math.min(offsetX, maxX)),
      y: Math.max(0, Math.min(offsetY, maxY)),
    };
  }

  function render(canvas, gameState, viewState) {
    const ctx = canvas.getContext("2d");
    const { map, civs } = gameState;
    const { showInfluence, showGrid, selectedUnit, selectedCity, humanCivId } = viewState;
    // Rounded to a whole pixel count -- with a fractional ts (e.g. zoomLevel
    // 1.37 * TILE_SIZE 34), per-tile screenX/screenY below would land on
    // sub-pixel positions, and default canvas image smoothing then blends a
    // sliver of each tile's edge into its neighbor, showing up as a faint
    // seam at every tile boundary even with the grid-line stroke (showGrid)
    // toggled off entirely -- a separate rendering artifact from that
    // intentional stroke, not fixed by gating it. Every screenX/screenY in
    // this function derives from this same ts + a rounded offset below, so
    // rounding it once here keeps the whole frame's tile grid pixel-aligned.
    const ts = Math.round(TILE_SIZE * (viewState.zoomLevel || 1));
    const now = performance.now();
    updateCombatAnims(now);
    updateQuipBubbles(now);
    updateFloatingTexts(now);

    // Clamp scroll so we never go out of bounds
    const clamped = clampOffset(viewState.scrollX || 0, viewState.scrollY || 0, canvas, map, ts);
    viewState.scrollX = clamped.x; // kept at full precision so smooth dragging keeps accumulating cleanly
    viewState.scrollY = clamped.y;
    // ...but the offset actually used for drawing is rounded too, for the
    // same pixel-alignment reason as ts above.
    const offsetX = -Math.round(clamped.x);
    const offsetY = -Math.round(clamped.y);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const visible = humanCivId
      ? (gameState.visibility[humanCivId] || new Set())
      : spectatorVisibilitySet(gameState, viewState);
    // Explored: every tile ever seen (persists once discovered, see turns.js's
    // refreshVisibility). Memory: each explored tile's terrain/road/river/
    // resource/ruin/city/structure as of the LAST time it was actually
    // visible -- deliberately stale otherwise, and never includes units.
    const explored = humanCivId
      ? (gameState.explored?.[humanCivId] || new Set())
      : spectatorExploredSet(gameState, viewState);
    const memory = humanCivId
      ? (gameState.tileMemory?.[humanCivId] || {})
      : spectatorMemory(gameState, viewState);
    // Tile City Score overlay (Interface menu) -- independent of the current
    // viewer's own fog above; this is always the SELECTED race's own
    // tileMemory, read directly, so it shows exactly what that civ has
    // discovered regardless of who's actually looking at the screen.
    const tileScoreMemory = viewState.tileScoreCivId
      ? (gameState.tileMemory?.[viewState.tileScoreCivId] || {})
      : null;

    // Resource/ruin icons can render larger than one tile (iconScale/
    // RUIN_ICON_SCALE > 1.0, e.g. a big Ruin or Fish Shoal) and are now
    // bottom-anchored in one of 3 horizontal slots, so an oversized icon can
    // legitimately overhang into a neighboring tile's screen area. Drawing
    // them inline in the per-tile loop below meant that overhang got
    // silently painted over the moment the next tile in raster order (to
    // the right, or on the row below) drew its own opaque terrain fill on
    // top of it. Fix: collect their draws here and flush them in one pass
    // AFTER the whole terrain/river/road grid is painted (but still before
    // cities/units, which already get their own later pass for the same
    // reason) so overhang always lands on top of terrain, never under it.
    const deferredIcons = [];

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const idx = y * map.width + x;
        const screenX = x * ts + offsetX;
        const screenY = y * ts + offsetY;
        if (screenX < -ts || screenX > canvas.width || screenY < -ts || screenY > canvas.height) continue;

        const tile = map.tiles[idx];
        const isVisible = visible.has(idx);

        if (!isVisible) {
          if (explored.has(idx)) {
            // Road connections for a remembered tile read from the snapshot
            // memory, not live tiles, so the fogged view stays consistent
            // with what was last observed.
            const roadConn = memory[idx]?.hasRoad
              ? roadConnections(
                  (tx, ty) => tx >= 0 && tx < map.width && ty >= 0 && ty < map.height &&
                              memory[ty * map.width + tx]?.hasRoad,
                  x, y
                )
              : null;
            drawRememberedTile(ctx, screenX, screenY, ts, memory[idx], roadConn, x, y, showGrid, deferredIcons);
            if (tileScoreMemory) drawTileScoreOverlay(ctx, screenX, screenY, ts, tileScoreMemory[idx]?.cityScore);
          } else {
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(screenX, screenY, ts, ts);
          }
          continue; // fog of war: nothing live (units, current buildings/roads) renders for unseen tiles
        }

        // Terrain — sprite on top of a flat color-matched backing fill, not
        // sprite-only. Some terrain art still carries a leftover chroma-key
        // resize seam (a column of not-fully-opaque edge pixels -- see
        // doc/art_style_guide.md's -SeamlessEdges section, only ever applied
        // to some terrain types) -- confirmed live via direct pixel
        // sampling: alpha<255 pixels recurring at every tile-boundary column
        // even after the render-time pixel-alignment fix above. Drawn over a
        // transparent canvas, that translucent seam blends with whatever's
        // behind the canvas (dark page background), showing as a faint
        // line at every tile edge independent of the grid-line stroke. The
        // same backing fill this branch already used as its sprite-missing
        // fallback works as a fix too: any translucent sprite pixel now
        // blends into a matching solid terrain color instead of the empty
        // canvas, so the seam disappears regardless of which terrain PNGs
        // still have the defect.
        ctx.fillStyle = window.GameData.TERRAIN[tile.terrain].color;
        ctx.fillRect(screenX, screenY, ts, ts);
        const terrainSprite = window.UI.sprites.pick(`terrain/${tile.terrain}`, tile);
        if (terrainSprite) {
          const f = window.UI.sprites.currentFrame(terrainSprite.manifest, "idle", tile);
          ctx.drawImage(terrainSprite.image, f.sx, f.sy, f.sw, f.sh, screenX, screenY, ts, ts);
        }

        // River — composited stub overlay, drawn UNDER roads (see
        // drawRiverOverlay) so a road crossing a river reads as on top of it.
        drawRiverOverlay(ctx, screenX, screenY, ts, tile.hasRiver);

        // Road — composited stub overlay drawn on top of rivers, before enhancements
        if (tile.hasRoad) {
          const conn = roadConnections(
            (tx, ty) => tx >= 0 && tx < map.width && ty >= 0 && ty < map.height &&
                        map.tiles[ty * map.width + tx].hasRoad,
            x, y
          );
          drawRoadOverlay(ctx, screenX, screenY, ts, conn);
        }

        // Resource — sprite if available, otherwise gold dot. Drawn bottom-
        // anchored in one of 3 stable-random horizontal slots (see
        // tileIconBox), not dead-center, at the resource's own iconScale
        // (terrain.js) times ts -- relative sizing between resource types
        // (a small fish shoal vs. a bigger ruin) is a render-time scale
        // knob, not baked into the source art. The sprite's own transparent
        // padding is what lets terrain/road/river show through around it.
        // Actual draw is deferred (see deferredIcons above) so any overhang
        // past this tile's bounds isn't clipped by a later tile's terrain.
        if (tile.resource) {
          const resSprite = window.UI.sprites.pick(`enhancement/resource_${tile.resource}`, tile);
          if (resSprite) {
            const f = window.UI.sprites.currentFrame(resSprite.manifest, "idle", tile);
            const resDef = window.GameData.RESOURCES[tile.resource];
            const iconScale = (resDef && resDef.iconScale) || 1.0;
            const sz = ts * iconScale;
            const { boxX, boxY } = tileIconBox(screenX, screenY, ts, sz, x, y);
            deferredIcons.push(() => ctx.drawImage(resSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, sz, sz));
          } else {
            deferredIcons.push(() => {
              ctx.fillStyle = "#f0d060";
              ctx.beginPath();
              ctx.arc(screenX + ts * 0.75, screenY + ts * 0.25, Math.max(1.5, ts * 0.09), 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }

        // Ruin — sprite if available, otherwise "?" text. Same bottom-
        // anchored slot placement as resources, a little bigger
        // (RUIN_ICON_SCALE). Also deferred, same reasoning as Resource above.
        if (tile.isRuin) {
          const ruinSprite = window.UI.sprites.pick("enhancement/ruin", tile);
          if (ruinSprite) {
            const f = window.UI.sprites.currentFrame(ruinSprite.manifest, "idle", tile);
            const sz = ts * RUIN_ICON_SCALE;
            const { boxX, boxY } = tileIconBox(screenX, screenY, ts, sz, x, y);
            deferredIcons.push(() => ctx.drawImage(ruinSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, sz, sz));
          } else {
            deferredIcons.push(() => {
              ctx.fillStyle = "#b08060";
              ctx.font = `${Math.max(8, ts * 0.36)}px monospace`;
              ctx.fillText("?", screenX + ts / 2 - ts * 0.11, screenY + ts / 2 + ts * 0.11);
            });
          }
        }

        // Influence overlay
        if (showInfluence && tile.status !== "neutral" && tile.ownerCivId) {
          const civ = civs[tile.ownerCivId];
          const color = civ ? window.GameData.getRace(civ.raceId).color : "#888";
          if (tile.status === "owned") {
            ctx.fillStyle = hexToRgba(color, 0.45);
            ctx.fillRect(screenX, screenY, ts, ts);
          } else if (tile.status === "contested") {
            drawHatch(ctx, screenX, screenY, ts, color);
          }
        }

        // Grid line — toggleable via the Interface menu
        if (showGrid) {
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX, screenY, ts, ts);
        }

        if (tileScoreMemory) drawTileScoreOverlay(ctx, screenX, screenY, ts, tileScoreMemory[idx]?.cityScore);
      }
    }

    // Flush deferred resource/ruin icon draws now that every tile's terrain
    // is painted (see deferredIcons comment above) -- still ahead of
    // cities/units below, preserving the normal stacking order.
    for (const draw of deferredIcons) draw();

    // Cities
    for (const civ of Object.values(civs)) {
      const race = window.GameData.getRace(civ.raceId);
      const citySymbol = race.citySymbol || "★";
      for (const city of civ.cities) {
        const idx = city.y * map.width + city.x;
        if (!visible.has(idx)) continue;
        const screenX = city.x * ts + offsetX;
        const screenY = city.y * ts + offsetY;
        const cx = screenX + ts / 2, cy = screenY + ts / 2;

        const pop = Math.floor(city.population);
        // Prefer separate per-tier images (assets/cities/${raceId}_city_{1..6}.png)
        // if this race has any; otherwise fall back to the older shared-sheet
        // "tier1"/"tier2"/... animation convention.
        const tieredSprite = window.UI.sprites.pickCityTier(civ.raceId, pop);
        const citySprite = tieredSprite || window.UI.sprites.pick(`city/${civ.raceId}`, city);
        if (citySprite) {
          if (tieredSprite) {
            const img = tieredSprite.image;
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, screenX, screenY, ts, ts);
          } else {
            // Sprite frame = population tier (frame 0 = pop 1, frame 1 = pop 2, etc.)
            const tierAnim = citySprite.manifest.animations[`tier${pop}`] || citySprite.manifest.animations.idle;
            const f = window.UI.sprites.currentFrame(citySprite.manifest, tierAnim ? `tier${pop}` : "idle", city);
            ctx.drawImage(citySprite.image, f.sx, f.sy, f.sw, f.sh, screenX, screenY, ts, ts);
          }
          // Always draw population number on top of sprite
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.max(6, ts * 0.25)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;
          ctx.strokeText(String(pop), cx, screenY + ts * 0.85);
          ctx.fillText(String(pop), cx, screenY + ts * 0.85);
        } else {
          // Fallback: colored circle with race symbol
          const radius = Math.min(ts * 0.45, ts * 0.3 + pop * ts / 56);
          ctx.fillStyle = race.color;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = city.isPort ? "#7fd4f7" : "#fff";
          ctx.lineWidth = city.isPort ? 2 : 1.5;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.max(7, ts * 0.32)}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(citySymbol, cx, cy - ts * 0.07);
          ctx.font = `bold ${Math.max(6, ts * 0.25)}px monospace`;
          ctx.fillText(String(pop), cx, cy + ts * 0.18);
        }

        if (selectedCity === city) {
          ctx.strokeStyle = "#ffeb3b";
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX + 1, screenY + 1, ts - 2, ts - 2);
        }
      }
    }

    // City influence-radius border (debug aid): outlines the exact square
    // city.influenceRadius covers, so fill-in tiles or influence appearing
    // outside that boundary are easy to spot visually. Shown alongside the
    // influence overlay toggle since that's when this matters.
    if (showInfluence) {
      for (const civ of Object.values(civs)) {
        const race = window.GameData.getRace(civ.raceId);
        for (const city of civ.cities) {
          const idx = city.y * map.width + city.x;
          if (!visible.has(idx)) continue;
          const radius = city.influenceRadius;
          const borderX = (city.x - radius) * ts + offsetX;
          const borderY = (city.y - radius) * ts + offsetY;
          const size = (radius * 2 + 1) * ts;
          ctx.save();
          ctx.strokeStyle = race.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(borderX, borderY, size, size);
          ctx.restore();
        }
      }
    }

    // Structures (buildings placed on any tile adjacent to their city)
    for (const civ of Object.values(civs)) {
      const race = window.GameData.getRace(civ.raceId);
      for (const city of civ.cities) {
        for (const s of city.structures) {
          const idx = s.y * map.width + s.x;
          if (!visible.has(idx)) continue;
          const building = window.GameData.getBuilding(s.id);
          const screenX = s.x * ts + offsetX;
          const screenY = s.y * ts + offsetY;
          const pad = ts * 0.2;
          // Body: civ-colored rounded square
          ctx.fillStyle = hexToRgba(race.color, 0.85);
          ctx.fillRect(screenX + pad, screenY + pad, ts - pad * 2, ts - pad * 2);
          ctx.strokeStyle = "rgba(0,0,0,0.5)";
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX + pad, screenY + pad, ts - pad * 2, ts - pad * 2);
          // Symbol
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.max(7, ts * 0.32)}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(building.symbol || "▪", screenX + ts / 2, screenY + ts / 2 - ts * 0.03);
          // HP bar (only when damaged)
          if (s.hp < s.maxHp) {
            const bw = ts - pad * 2, bh = Math.max(2, ts * 0.08);
            const bx = screenX + pad, by = screenY + ts - pad - bh;
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = "#5fbf5f";
            ctx.fillRect(bx, by, bw * Math.max(0, s.hp) / s.maxHp, bh);
          }
        }
      }
    }

    // Aura radius overlay (Human "Crusade" Paladin / Dwarf "Heavy Metal"/
    // "Power Metal" Troubadour) -- see auraInfoForUnit. Drawn under the unit
    // sprites (before the Units pass below) so units/terrain stay legible on
    // top of the tint. Per-tile fill plus a single perimeter outline, same
    // convention as the city influence-radius border above.
    for (const civ of Object.values(civs)) {
      for (const unit of civ.units) {
        const aura = auraInfoForUnit(unit, civ);
        if (!aura) continue;
        const idx = unit.y * map.width + unit.x;
        if (!visible.has(idx)) continue;
        const { radius, color } = aura;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const tx = unit.x + dx, ty = unit.y + dy;
            if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
            if (!visible.has(ty * map.width + tx)) continue;
            ctx.fillStyle = hexToRgba(color, 0.16);
            ctx.fillRect(tx * ts + offsetX, ty * ts + offsetY, ts, ts);
          }
        }
        ctx.save();
        ctx.strokeStyle = hexToRgba(color, 0.85);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          (unit.x - radius) * ts + offsetX, (unit.y - radius) * ts + offsetY,
          (radius * 2 + 1) * ts, (radius * 2 + 1) * ts,
        );
        ctx.restore();
      }
    }

    // Units
    // Drawn in a flat, position-sorted pass (top-to-bottom, then
    // left-to-right) across all civs together, rather than grouped by civ --
    // this is what makes a "bigger" unit's overflow draw UNDER whatever is
    // below/right of it and OVER whatever is above/left of it, matching how
    // overlapping sprites should stack. Ordinary tile-sized units never
    // overlap a neighbor, so this sort is a no-op for them.
    const unitsToDraw = [];
    for (const civ of Object.values(civs)) {
      for (const unit of civ.units) {
        if (unit.carriedBy) continue; // aboard a carrier -- not drawn at its stale tile
        const idx = unit.y * map.width + unit.x;
        if (!visible.has(idx)) continue;
        unitsToDraw.push({ civ, unit, visualPos: getVisualPos(unit) });
      }
    }
    unitsToDraw.sort((a, b) => a.visualPos.y - b.visualPos.y || a.visualPos.x - b.visualPos.x);

    // Deferred to a pass AFTER every unit is drawn (see below) so a quip
    // bubble always renders on top of every unit sprite, never occluded by
    // one drawn later in the position-sorted pass above.
    const quipBubbleQueue = [];
    // Same deferred-pass reasoning as quipBubbleQueue -- floating text
    // should never be occluded by a unit sprite drawn later in the
    // position-sorted pass above.
    const floatingTextQueue = [];

    for (const { civ, unit, visualPos } of unitsToDraw) {
      const race = window.GameData.getRace(civ.raceId);
      const shake = getUnitShakeOffset(unit, ts, now);
      const screenX = visualPos.x * ts + offsetX + shake.x;
      const screenY = visualPos.y * ts + offsetY + shake.y;
      const baseUnit = window.GameData.getUnit(unit.typeId);
      const initial = (baseUnit.label || "?").charAt(0).toUpperCase();
      const pad = ts * 0.11;
      const unitSprite = window.UI.sprites.pickUnit(unit.typeId, race.id, unit);

      // "bigger" scales the drawn box up around its bottom-center anchor --
      // the tile's normal bottom-inset stays fixed, extra size grows upward
      // and sideways (see units.js's biggerPct doc comment).
      const scale = 1 + (baseUnit.biggerPct || 0);
      const normalSize = ts - pad * 2;
      const boxSize = normalSize * scale;
      const boxX = screenX + ts / 2 - boxSize / 2;
      const boxY = screenY + pad + normalSize - boxSize;

      if (unitSprite) {
        const f = window.UI.sprites.currentFrame(unitSprite.manifest, "idle", unit);
        drawUnitShadow(ctx, screenX, screenY, ts, race.color, scale);
        ctx.drawImage(unitSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, boxSize, boxSize);
      } else {
        // Fallback: race-colored shadow + unicode symbol, outlined for
        // contrast now that there's no solid tile behind it to guarantee that.
        drawUnitShadow(ctx, screenX, screenY, ts, race.color, scale);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(7, ts * 0.32 * scale)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = Math.max(1, ts * 0.05 * scale);
        ctx.strokeText(initial, boxX + boxSize / 2, boxY + boxSize / 2);
        ctx.fillText(initial, boxX + boxSize / 2, boxY + boxSize / 2);
      }

      // HP bar
      if (unit.hp != null && unit.maxHp && unit.hp < unit.maxHp) {
        const pct = Math.max(0, unit.hp / unit.maxHp);
        const barW = boxSize - 4, barX = boxX + 2, barY = boxY + boxSize - 3;
        ctx.fillStyle = "#400";
        ctx.fillRect(barX, barY, barW, 2);
        ctx.fillStyle = "#4caf50";
        ctx.fillRect(barX, barY, barW * pct, 2);
      }
      if (selectedUnit === unit) {
        ctx.strokeStyle = "#ffeb3b";
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX + 1, boxY + 1, boxSize - 2, boxSize - 2);
      }

      if (activeQuips.some((q) => q.unit === unit)) {
        quipBubbleQueue.push({ unit, screenX, screenY });
      }
      if (activeFloatingTexts.some((f) => f.unit === unit)) {
        floatingTextQueue.push({ unit, screenX, screenY });
      }
    }

    drawCombatSlashes(ctx, offsetX, offsetY, ts, now);
    for (const { unit, screenX, screenY } of quipBubbleQueue) {
      drawQuipBubble(ctx, unit, screenX, screenY, ts, now);
    }
    // Drawn last (on top of quip bubbles too) -- floating text is the most
    // immediate, momentary feedback and shouldn't be occluded by anything.
    for (const { unit, screenX, screenY } of floatingTextQueue) {
      drawFloatingTexts(ctx, unit, screenX, screenY, ts, now);
    }
  }

  /**
   * Race-colored "shadow" beneath a unit -- a squashed, slightly-oversized
   * oval sitting toward the bottom of the tile, as if cast by whatever's
   * standing there, rather than a solid tint filling the whole tile. Keeps
   * the civ identifiable at a glance without obscuring the terrain or the
   * sprite drawn on top of it.
   */
  function drawUnitShadow(ctx, screenX, screenY, ts, color, scale = 1) {
    const cx = screenX + ts / 2;
    const cy = screenY + ts * 0.80;
    const radiusX = ts * 0.42 * scale;
    const radiusY = ts * 0.15 * scale;
    ctx.fillStyle = hexToRgba(color, 0.6);
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Road overlay: draw-time compositing of rotatable stubs -------------
  // A road connects to any of the 8 neighbours that also have a road. Rather
  // than storing one baked image per connection combination (256 of them),
  // we layer three mostly-transparent stubs (assets/roads/*, see
  // tools/make-road-stubs.ps1) rotated to face each connected neighbour:
  //   road/cardinal -- centre -> edge midpoint, authored pointing EAST
  //   road/diagonal -- centre -> corner,        authored pointing NE
  //   road/hub      -- small rimless patch at centre; fills the join, and
  //                    stands alone as the "road to nowhere" when isolated
  // The stubs are rimless single-tone tan, so overlapping/adjacent pieces
  // merge seamlessly with no border seams. Rotations are only ever multiples
  // of 90 deg (a purpose-drawn diagonal art avoids any 45-deg resampling).
  const ROAD_CARDINAL_ANGLE = { e: 0, s: 90, w: 180, n: 270 };
  const ROAD_DIAGONAL_ANGLE = { ne: 0, se: 90, sw: 180, nw: 270 };

  // Shared by both the road and river overlays below -- rotates an
  // (already tile-sized) stub image around the tile's center by angleDeg.
  function drawOverlayStub(ctx, image, screenX, screenY, ts, angleDeg) {
    ctx.save();
    ctx.translate(screenX + ts / 2, screenY + ts / 2);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.drawImage(image, -ts / 2, -ts / 2, ts, ts);
    ctx.restore();
  }

  /**
   * Draws the composited road overlay for one tile. `conn` has boolean
   * n/s/e/w/ne/se/sw/nw flags for which neighbours have a road. Falls back
   * to the old brown cross if the road art hasn't loaded yet.
   */
  function drawRoadOverlay(ctx, screenX, screenY, ts, conn) {
    const cardinal = window.UI.sprites.pick("road/cardinal");
    const diagonal = window.UI.sprites.pick("road/diagonal");
    const hub = window.UI.sprites.pick("road/hub");
    if (!cardinal || !diagonal || !hub) {
      const roadW = Math.max(2, ts * 0.18);
      ctx.fillStyle = "#8b6520";
      ctx.fillRect(screenX, screenY + (ts - roadW) / 2, ts, roadW);
      ctx.fillRect(screenX + (ts - roadW) / 2, screenY, roadW, ts);
      return;
    }
    // hub first: fills the centre join (and is the whole graphic when isolated)
    drawOverlayStub(ctx, hub.image, screenX, screenY, ts, 0);
    for (const d of ["e", "s", "w", "n"])
      if (conn[d]) drawOverlayStub(ctx, cardinal.image, screenX, screenY, ts, ROAD_CARDINAL_ANGLE[d]);
    for (const d of ["ne", "se", "sw", "nw"])
      if (conn[d]) drawOverlayStub(ctx, diagonal.image, screenX, screenY, ts, ROAD_DIAGONAL_ANGLE[d]);
  }

  /** 8-neighbour road-connection flags for tile (x,y). `hasRoadAt(tx,ty)`
   *  must bounds-check and read whichever source (live tiles vs. remembered
   *  snapshots) the caller is rendering from. */
  function roadConnections(hasRoadAt, x, y) {
    return {
      n: hasRoadAt(x, y - 1), s: hasRoadAt(x, y + 1),
      e: hasRoadAt(x + 1, y), w: hasRoadAt(x - 1, y),
      ne: hasRoadAt(x + 1, y - 1), se: hasRoadAt(x + 1, y + 1),
      sw: hasRoadAt(x - 1, y + 1), nw: hasRoadAt(x - 1, y - 1),
    };
  }

  // --- River overlay: same draw-time compositing technique as roads, one
  // asset short. Rivers never flow diagonally (js/engine/worldgen.js
  // generateRivers only ever stamps hasRiver.n/s/e/w), so there's no
  // river/diagonal stub, and a river tile's own hasRiver flags already
  // fully describe which edges it connects to -- both banks of a shared
  // border are stamped symmetrically at generation time, so unlike roads
  // no neighbor lookup is needed here at all. Rendered UNDER roads (drawn
  // first, right after terrain) so a road crossing a river reads as
  // passing over it. See tools/make-river-stubs.ps1.
  function drawRiverOverlay(ctx, screenX, screenY, ts, hasRiver) {
    if (!hasRiver || !(hasRiver.n || hasRiver.s || hasRiver.e || hasRiver.w)) return;
    const cardinal = window.UI.sprites.pick("river/cardinal");
    const hub = window.UI.sprites.pick("river/hub");
    if (!cardinal || !hub) {
      ctx.strokeStyle = "#3a8fc9";
      ctx.lineWidth = Math.max(1, ts * 0.07);
      ctx.beginPath();
      if (hasRiver.n) { ctx.moveTo(screenX, screenY); ctx.lineTo(screenX + ts, screenY); }
      if (hasRiver.s) { ctx.moveTo(screenX, screenY + ts); ctx.lineTo(screenX + ts, screenY + ts); }
      if (hasRiver.e) { ctx.moveTo(screenX + ts, screenY); ctx.lineTo(screenX + ts, screenY + ts); }
      if (hasRiver.w) { ctx.moveTo(screenX, screenY); ctx.lineTo(screenX, screenY + ts); }
      ctx.stroke();
      return;
    }
    drawOverlayStub(ctx, hub.image, screenX, screenY, ts, 0);
    for (const d of ["e", "s", "w", "n"])
      if (hasRiver[d]) drawOverlayStub(ctx, cardinal.image, screenX, screenY, ts, ROAD_CARDINAL_ANGLE[d]);
  }

  function drawHatch(ctx, x, y, size, color) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.strokeStyle = hexToRgba(color, 0.6);
    ctx.lineWidth = 1.5;
    const spacing = Math.max(4, size * 0.18);
    for (let i = -size; i < size * 2; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + size, y + size);
      ctx.stroke();
    }
    ctx.restore();
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /**
   * Aura-radius overlay info for `unit`, or null if it doesn't currently
   * have an active ally-buff aura -- see turns.js's per-turn Crusade/Heavy
   * Metal/Power Metal application, which this mirrors exactly for radius
   * and active-aura selection (Troubadour's own `activeAura` field, Epic
   * Metal's +1 radius). Purely cosmetic; never touches game state.
   */
  function auraInfoForUnit(unit, civ) {
    if (!civ.unlockedMechanics) return null;
    if (unit.typeId === "paladin" && civ.unlockedMechanics.has("crusade")) {
      return { radius: 1, color: "#ffd54f", label: "Crusade" }; // holy gold
    }
    if (unit.typeId === "troubadour"
        && (civ.unlockedMechanics.has("heavy_metal") || civ.unlockedMechanics.has("power_metal"))) {
      const hasHeavyMetal = civ.unlockedMechanics.has("heavy_metal");
      const hasPowerMetal = civ.unlockedMechanics.has("power_metal");
      const epicMetal = civ.unlockedMechanics.has("epic_metal");
      const aura = (hasHeavyMetal && hasPowerMetal)
        ? (unit.activeAura || "heavy_metal")
        : (hasPowerMetal ? "power_metal" : "heavy_metal");
      return aura === "heavy_metal"
        ? { radius: epicMetal ? 2 : 1, color: "#ff8a65", label: "Heavy Metal" } // heal/defense -- warm ember
        : { radius: epicMetal ? 2 : 1, color: "#7c4dff", label: "Power Metal" }; // attack/first strike -- electric violet
    }
    return null;
  }

  function fullVisibilitySet(map) {
    const s = new Set();
    for (let i = 0; i < map.tiles.length; i++) s.add(i);
    return s;
  }

  /**
   * Spectator-mode visibility: no single civ's vision to render, so it's
   * driven by the Fog of War panel (Interface menu, spectator games only --
   * see main.js's setupFogControls). "off" is the traditional spectator
   * god's-eye view (whole map); "all"/"selected" instead union together the
   * real per-civ visibility sets (gameState.visibility, same data ai.js
   * itself is limited to) for every civ, or just the checked ones, so a
   * spectator can audit what a given set of civs would actually see.
   */
  function spectatorVisibilitySet(gameState, viewState) {
    const mode = viewState.fogMode || "off";
    if (mode === "off") return fullVisibilitySet(gameState.map);
    const civIds = mode === "selected"
      ? [...(viewState.fogCivIds || [])]
      : Object.keys(gameState.civs);
    const union = new Set();
    for (const civId of civIds) {
      const vis = gameState.visibility[civId];
      if (vis) for (const idx of vis) union.add(idx);
    }
    return union;
  }

  /** Spectator equivalent of gameState.explored[humanCivId] -- union of every
   *  selected civ's persistent explored set. Unused (never consulted) when
   *  fogMode is "off" since spectatorVisibilitySet already marks every tile
   *  visible in that mode. */
  function spectatorExploredSet(gameState, viewState) {
    const mode = viewState.fogMode || "off";
    if (mode === "off") return new Set();
    const civIds = mode === "selected"
      ? [...(viewState.fogCivIds || [])]
      : Object.keys(gameState.civs);
    const union = new Set();
    for (const civId of civIds) {
      const exp = gameState.explored?.[civId];
      if (exp) for (const idx of exp) union.add(idx);
    }
    return union;
  }

  /** Spectator equivalent of gameState.tileMemory[humanCivId] -- merges every
   *  selected civ's remembered-tile snapshots. Where two civs remember the
   *  same tile differently, the more recently-updated snapshot (higher
   *  turnNumber) wins, so the view always reflects the freshest information
   *  any of the selected civs actually has. */
  function spectatorMemory(gameState, viewState) {
    const mode = viewState.fogMode || "off";
    if (mode === "off") return {};
    const civIds = mode === "selected"
      ? [...(viewState.fogCivIds || [])]
      : Object.keys(gameState.civs);
    const merged = {};
    for (const civId of civIds) {
      const mem = gameState.tileMemory?.[civId];
      if (!mem) continue;
      for (const idxKey of Object.keys(mem)) {
        const entry = mem[idxKey];
        const existing = merged[idxKey];
        if (!existing || (entry.turnNumber || 0) >= (existing.turnNumber || 0)) merged[idxKey] = entry;
      }
    }
    return merged;
  }

  /**
   * Draws an explored-but-not-currently-visible tile from its remembered
   * snapshot (see turns.js's refreshVisibility) instead of live tile data --
   * terrain/road/river/resource/ruin plus a dimmed city/structure marker if
   * one was there when last observed. Never draws units (those are never
   * snapshotted -- unit positions/movement only ever render when currently
   * visible). Finished with a dark scrim so it reads as visibly "remembered,
   * possibly stale" rather than currently seen.
   */
  function drawRememberedTile(ctx, screenX, screenY, ts, snapshot, roadConn, x, y, showGrid, deferredIcons) {
    if (!snapshot) {
      // Explored should always have a matching memory entry, but fall back
      // to plain fog rather than throw if the two ever disagree.
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(screenX, screenY, ts, ts);
      return;
    }

    // Flat backing fill under the sprite, same seam-hiding reasoning as the
    // live render() terrain block above.
    ctx.fillStyle = window.GameData.TERRAIN[snapshot.terrain].color;
    ctx.fillRect(screenX, screenY, ts, ts);
    const terrainSprite = window.UI.sprites.pick(`terrain/${snapshot.terrain}`, snapshot);
    if (terrainSprite) {
      const f = window.UI.sprites.currentFrame(terrainSprite.manifest, "idle", snapshot);
      ctx.drawImage(terrainSprite.image, f.sx, f.sy, f.sw, f.sh, screenX, screenY, ts, ts);
    }

    // River drawn UNDER road, same reasoning as the live render loop.
    drawRiverOverlay(ctx, screenX, screenY, ts, snapshot.hasRiver);

    if (snapshot.hasRoad) {
      drawRoadOverlay(ctx, screenX, screenY, ts, roadConn || {});
    }

    // Resource/ruin draws are deferred to the same post-grid flush pass as
    // the live tile loop (see render()'s deferredIcons), for the same
    // clipping reason -- an oversized icon here would otherwise get painted
    // over by the next tile's terrain fill. Remembered tiles get their own
    // dimming scrim drawn AFTER this function returns (see the bottom of
    // this function), which would normally darken the icon too since it was
    // drawn before the scrim -- deferring the icon draw would skip that, so
    // dim it directly via globalAlpha instead to keep the same "this is a
    // stale memory, not live" look.
    if (snapshot.resource) {
      const resSprite = window.UI.sprites.pick(`enhancement/resource_${snapshot.resource}`, snapshot);
      if (resSprite) {
        const f = window.UI.sprites.currentFrame(resSprite.manifest, "idle", snapshot);
        const resDef = window.GameData.RESOURCES[snapshot.resource];
        const iconScale = (resDef && resDef.iconScale) || 1.0;
        const sz = ts * iconScale;
        const { boxX, boxY } = tileIconBox(screenX, screenY, ts, sz, x, y);
        deferredIcons.push(() => {
          const prevAlpha = ctx.globalAlpha;
          ctx.globalAlpha = prevAlpha * 0.6;
          ctx.drawImage(resSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, sz, sz);
          ctx.globalAlpha = prevAlpha;
        });
      } else {
        deferredIcons.push(() => {
          ctx.fillStyle = "#f0d060";
          ctx.beginPath();
          ctx.arc(screenX + ts * 0.75, screenY + ts * 0.25, Math.max(1.5, ts * 0.09), 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    if (snapshot.isRuin) {
      const ruinSprite = window.UI.sprites.pick("enhancement/ruin", snapshot);
      if (ruinSprite) {
        const f = window.UI.sprites.currentFrame(ruinSprite.manifest, "idle", snapshot);
        const sz = ts * RUIN_ICON_SCALE;
        const { boxX, boxY } = tileIconBox(screenX, screenY, ts, sz, x, y);
        deferredIcons.push(() => {
          const prevAlpha = ctx.globalAlpha;
          ctx.globalAlpha = prevAlpha * 0.6;
          ctx.drawImage(ruinSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, sz, sz);
          ctx.globalAlpha = prevAlpha;
        });
      } else {
        deferredIcons.push(() => {
          ctx.fillStyle = "#b08060";
          ctx.font = `${Math.max(8, ts * 0.36)}px monospace`;
          ctx.fillText("?", screenX + ts / 2 - ts * 0.11, screenY + ts / 2 + ts * 0.11);
        });
      }
    }

    // Last-known city/structure occupant -- a simplified dimmed marker, not
    // the live sprite/HP-bar treatment, since this may well be stale.
    if (snapshot.city) {
      const race = window.GameData.getRace(snapshot.city.raceId);
      const cx = screenX + ts / 2, cy = screenY + ts / 2;
      ctx.fillStyle = hexToRgba(race.color, 0.4);
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = `bold ${Math.max(6, ts * 0.22)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(snapshot.city.population), cx, cy);
    } else if (snapshot.structure) {
      const race = window.GameData.getRace(snapshot.structure.raceId);
      const pad = ts * 0.22;
      ctx.fillStyle = hexToRgba(race.color, 0.35);
      ctx.fillRect(screenX + pad, screenY + pad, ts - pad * 2, ts - pad * 2);
    }

    // Dimming scrim + subdued grid line -- visually distinct from a tile
    // currently in vision (which gets full brightness and a lighter grid line).
    // Grid line itself is toggleable via the Interface menu, same as the
    // live-tile grid line.
    ctx.fillStyle = "rgba(10,12,16,0.55)";
    ctx.fillRect(screenX, screenY, ts, ts);
    if (showGrid) {
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX, screenY, ts, ts);
    }
  }

  /**
   * Tile City Score overlay (Interface menu): draws the selected race's
   * remembered score for this tile as a centered number with a small
   * translucent backing, on top of whatever else was already drawn.
   * `score` is undefined/null for a tile the selected race hasn't explored
   * (or that's water) -- silently skipped, no number shown.
   */
  function drawTileScoreOverlay(ctx, screenX, screenY, ts, score) {
    if (score == null) return;
    const cx = screenX + ts / 2, cy = screenY + ts / 2;
    const r = Math.max(8, ts * 0.28);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe066";
    ctx.font = `bold ${Math.max(7, ts * 0.26)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.round(score)), cx, cy);
  }

  /** Converts a screen pixel coordinate to tile (x,y), or null if out of bounds */
  function screenToTile(px, py, viewState, map) {
    const ts = TILE_SIZE * (viewState.zoomLevel || 1);
    const x = Math.floor((px + (viewState.scrollX || 0)) / ts);
    const y = Math.floor((py + (viewState.scrollY || 0)) / ts);
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) return null;
    return { x, y };
  }

  window.UI.render = {
    render, screenToTile, fullVisibilitySet,
    get TILE_SIZE() { return TILE_SIZE; },
    MIN_ZOOM, MAX_ZOOM,
  };
})();
