/**
 * SHARED RENDER OVERLAYS
 * ----------------------
 * Screen-space/color-space drawing helpers and their backing event-queue
 * state, shared between the 2D renderer (render.js) and the 3D renderer
 * (render3d.js) so combat anims, quips, floating text, condition badges,
 * HP bars, etc. behave identically regardless of which view is active --
 * and, critically, so the underlying event queues (window.GameEngine.combat/
 * quips/floatingText) get drained no matter which renderer is running.
 * Before this file existed, updateCombatAnims/updateAreaEffects/
 * updateQuipBubbles/updateFloatingTexts lived only inside render.js's own
 * render(), which render3d.js's render() never calls -- so with 3D as the
 * default view, those pending-event arrays grew unbounded for the entire
 * game and nothing ever animated in 3D. Call tick(now) once per frame from
 * BOTH renderers (whichever is active) to keep this fixed.
 *
 * State here is module-level (not per-canvas), matching the original
 * render.js convention -- this is what lets an in-flight animation survive
 * a 2D<->3D toggle instead of restarting or freezing.
 */

window.UI = window.UI || {};

(function () {
  const ATTACK_ANIM_MS = 500; // total lifetime of a combat "wiggle" (attacker lunge / defender recoil)
  const SLASH_ANIM_MS = 260; // shorter-lived slash/swipe overlay drawn on top
  const AREA_EFFECT_ANIM_MS = 700; // AoE radius highlight (Blade Dancer sweep, Fireball splash) -- quick flash, not a lingering overlay
  const QUIP_ANIM_MS = 2200; // total lifetime of a speech bubble (incl. fade in/out)
  const QUIP_FADE_MS = 250; // fade-in and fade-out duration at each end of QUIP_ANIM_MS
  const FLOAT_TEXT_ANIM_MS = 3000; // total lifetime of a floating-text popup (incl. fade in/hold/fade out)
  const FLOAT_TEXT_FADE_IN_MS = 150; // quick pop-in at the start
  const FLOAT_TEXT_FADE_OUT_MS = 500; // quick fade-out at the very end; everything between is full opacity
  const DEATH_EFFECT_ANIM_MS = 1300; // puff-of-smoke-resolving-into-a-skull, total lifetime
  const DEATH_SMOKE_COUNT = 6; // number of drifting smoke puffs per death

  // Condition badges (2026-07-22, user-directed): a small icon per active
  // entry in unit.conditions (see combat.js's setCondition/tickConditions),
  // drawn stacked in the tile's upper-right corner, above the unit sprite.
  // Keyed by the exact condition key each mechanic sets -- anything not
  // listed here (there is no catch-all) is silently skipped rather than
  // drawing a generic placeholder, so an unmapped future condition doesn't
  // need an emergency render fix, it just has no badge yet.
  const CONDITION_ICONS = {
    hidden: "🌙",
    forcedVisible: "👁️",
    frozen: "❄️",
    curse: "🧿",
    exhausted: "💤",
    forcedRest: "💤",
    defending: "🛡️",
    killMomentum: "💢",
    flying: "🪽️",
    crusadeAura: "✨",
    heavyMetalAura: "♫",
    powerMetalAura: "🎸",
    deepMinesGuard: "⛰️",
    burning: "🔥",
    zombie: "💀",
    befuddled: "🌀",
    resting: "⛺",
    webbed: "🕸️",
    poisoned: "🤢",
  };
  const CARRYING_ICON = "🫴";

  /**
   * Live combat attack/wiggle effects, drained each frame from
   * window.GameEngine.combat's cosmetic event queue (see combat.js --
   * populated only at real, on-board attack call sites in ai.js, never by
   * the resolveRound/resolveToTheDeath calls ai.js also uses for
   * hypothetical win-probability sampling). Each entry gets a handful of
   * randomized parameters at creation time so repeated attacks don't all
   * play identically.
   */
  let activeCombatAnims = [];

  function updateCombatAnims(now) {
    const newEvents = window.GameEngine.combat.drainCombatEvents();
    for (const evt of newEvents) {
      const dxg = evt.dx - evt.ax, dyg = evt.dy - evt.ay;
      const len = Math.hypot(dxg, dyg) || 1;
      const mount = window.GameEngine.combat.shadowsteedMount(evt.atkUnit);
      const attackChars = evt.attackChars || window.GameData.getAttackChars(mount ? mount.typeId : evt.atkUnit.typeId);
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

  /** Same pull-based queue pattern as activeCombatAnims above, for the
   *  momentary "this tile radius was just affected" highlight -- see
   *  combat.js's spawnAreaEffect. */
  let activeAreaEffects = [];

  function updateAreaEffects(now) {
    const newEvents = window.GameEngine.combat.drainAreaEffectEvents();
    for (const evt of newEvents) activeAreaEffects.push({ ...evt, start: now });
    if (activeAreaEffects.length) {
      activeAreaEffects = activeAreaEffects.filter((a) => now - a.start < AREA_EFFECT_ANIM_MS);
    }
  }

  const AREA_EFFECT_COLORS = {
    blade_sweep: "179,136,255", // matches FLOAT_TEXT_STYLES.aura's purple
    fireball: "255,112,64", // matches FLOAT_TEXT_STYLES.warning's orange-red
    default: "255,255,255",
  };

  /** Fade envelope shared by both renderers' area-effect draw: quick pop-in,
   *  hold, quick fade -- returns null if `a` has already expired. */
  function areaEffectAlpha(a, now) {
    const elapsed = now - a.start;
    if (elapsed > AREA_EFFECT_ANIM_MS) return null;
    const t = elapsed / AREA_EFFECT_ANIM_MS;
    return t < 0.15 ? t / 0.15 : (t > 0.5 ? Math.max(0, 1 - (t - 0.5) / 0.5) : 1);
  }

  /** Draws one area effect's fill + perimeter stroke into an already-known
   *  screen-space box (minX,minY)-(maxX,maxY) -- the 2D renderer gets that
   *  box from the affine offsetX/offsetY/ts tile grid (see drawAreaEffects
   *  below); the 3D renderer has no single affine mapping for the whole
   *  frame, so it projects the effect's world-space footprint corners to
   *  screen itself and passes the resulting box straight in here. `lineW`
   *  is the effect's own local pixel scale (2D: real ts; 3D: localPixelScale
   *  at the effect's position) used to size the stroke consistently. */
  function drawAreaEffectBox(ctx, a, minX, minY, maxX, maxY, lineW, now) {
    const alpha = areaEffectAlpha(a, now);
    if (alpha == null) return;
    const color = AREA_EFFECT_COLORS[a.kind] || AREA_EFFECT_COLORS.default;
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = `rgb(${color})`;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = `rgb(${color})`;
    ctx.lineWidth = Math.max(1, lineW * 0.06);
    ctx.strokeRect(
      minX + ctx.lineWidth / 2, minY + ctx.lineWidth / 2,
      Math.max(0, maxX - minX - ctx.lineWidth), Math.max(0, maxY - minY - ctx.lineWidth),
    );
    ctx.restore();
  }

  /** Draws a fading colored highlight over every tile within `radius`
   *  (Chebyshev, matching every in-game range/AoE check) of each active
   *  area effect's center -- a quick flash-and-fade, not a lingering
   *  overlay. Drawn UNDER drawCombatSlashes so the attack slashes/unit
   *  sprites still read clearly on top. 2D-only (affine offsetX/offsetY/ts
   *  tile grid) -- see drawAreaEffectBox for the shared per-effect visual
   *  the 3D renderer builds its own screen-space box for instead. */
  function drawAreaEffects(ctx, offsetX, offsetY, ts, now) {
    for (const a of activeAreaEffects) {
      const minX = (a.x - a.radius) * ts + offsetX, minY = (a.y - a.radius) * ts + offsetY;
      const maxX = minX + (a.radius * 2 + 1) * ts, maxY = minY + (a.radius * 2 + 1) * ts;
      drawAreaEffectBox(ctx, a, minX, minY, maxX, maxY, ts, now);
    }
  }

  /**
   * Live speech-bubble quips, drained each frame from window.GameEngine.
   * quips' cosmetic event queue. Keyed by the unit object itself (a stable
   * per-instance identity) so drawQuipBubble can look up "does THIS unit
   * have an active quip right now" in either renderer's unit draw loop.
   */
  let activeQuips = [];

  function updateQuipBubbles(now) {
    const newEvents = window.GameEngine.quips.drainQuipEvents();
    for (const evt of newEvents) activeQuips.push({ unit: evt.unit, text: evt.text, start: now });
    if (activeQuips.length) {
      activeQuips = activeQuips.filter((q) => now - q.start < QUIP_ANIM_MS);
    }
  }

  function hasActiveQuip(unit) {
    return activeQuips.some((q) => q.unit === unit);
  }

  /**
   * Live floating-text popups ("Level Up!", "+N XP", per-turn resource
   * gains), drained each frame same as activeCombatAnims/activeQuips above.
   * Several can be active for the SAME unit at once -- `stackIndex` records
   * how many of this unit's OTHER currently-active popups existed at spawn
   * time, so drawFloatingTexts can offset each one higher.
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

  function hasActiveFloatingText(unit) {
    return activeFloatingTexts.some((f) => f.unit === unit);
  }

  /**
   * Live death effects (puff of smoke resolving into a skull, 2026-08-07,
   * user-directed), drained each frame from window.GameEngine.deathFx's
   * cosmetic event queue. Tile-position-anchored rather than unit-anchored,
   * same reasoning as activeAreaEffects: the unit is already gone from
   * civ.units by the time otherCivRemoveDeadUnit fires this (ai.js), so
   * there's no unit object left for a per-unit draw pass to key off of.
   * Each puff's angle/distance/size/delay is baked in once at spawn time
   * (same convention activeCombatAnims uses) so repeated deaths don't all
   * play identically.
   */
  let activeDeathEffects = [];

  function updateDeathEffects(now) {
    const newEvents = window.GameEngine.deathFx.drainDeathEffectEvents();
    for (const evt of newEvents) {
      const puffs = [];
      for (let i = 0; i < DEATH_SMOKE_COUNT; i++) {
        puffs.push({
          angle: (i / DEATH_SMOKE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6,
          dist: 0.28 + Math.random() * 0.22,
          size: 0.16 + Math.random() * 0.10,
          delay: Math.random() * 0.15,
        });
      }
      activeDeathEffects.push({ x: evt.x, y: evt.y, start: now, puffs });
    }
    if (activeDeathEffects.length) {
      activeDeathEffects = activeDeathEffects.filter((d) => now - d.start < DEATH_EFFECT_ANIM_MS);
    }
  }

  /** Read-only access to the live combat-anim/area-effect/death-effect
   *  queues, for a caller (render3d.js's HUD pass) that needs to iterate
   *  them itself with its own per-tile projection instead of the affine
   *  offsetX/offsetY/ts math drawCombatSlashes/drawAreaEffects/
   *  drawDeathEffects use -- perspective means there is no single
   *  (offsetX,offsetY,ts) that maps every tile to screen space correctly in
   *  3D, so those draw functions stay 2D-only and render3d.js projects each
   *  event's tiles individually instead. */
  function getActiveCombatAnims() {
    return activeCombatAnims;
  }
  function getActiveAreaEffects() {
    return activeAreaEffects;
  }
  function getActiveDeathEffects() {
    return activeDeathEffects;
  }

  /** Runs every per-frame queue drain in one call -- the single entry point
   *  each renderer's render() should call once per frame, unconditionally,
   *  regardless of whether it's the one actually drawing right now. */
  function tick(now) {
    updateCombatAnims(now);
    updateAreaEffects(now);
    updateQuipBubbles(now);
    updateFloatingTexts(now);
    updateDeathEffects(now);
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
    // A combat property firing in the attacker's favor (currently Double
    // Strike) -- deliberately not `warning`, which reads as something bad
    // happening to the unit the text is anchored to.
    strike: { color: "#ffab40", bold: true, sizeFrac: 0.26 },
    default: { color: "#ffffff", bold: false, sizeFrac: 0.22 },
  };

  /** Draws every active floating-text popup anchored to `unit` -- pops in
   *  quickly, drifts upward the whole time, holds at full opacity for most
   *  of its life, then fades out quickly at the very end. `screenX`/
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
      const rise = ts * 0.85 * t;
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
   *  maxWidth at the ctx's current font. */
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
   *  active quip. `screenX`/`screenY` are the unit's own tile-top screen
   *  position (same values passed to drawUnitShadow). */
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
   * across zoom levels/camera distance.
   */
  function getUnitShakeOffset(unit, ts, now) {
    let ox = 0, oy = 0;
    for (const a of activeCombatAnims) {
      const isAttacker = a.atkUnit === unit;
      const isDefender = a.defUnit === unit;
      if (!isAttacker && !isDefender) continue;
      const t = (now - a.start) / ATTACK_ANIM_MS;
      if (t >= 1) continue;
      const jump = Math.sin(Math.PI * t) * a.ampScale;
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
   * Glyph overlay between an already-projected attacker/defender screen
   * point pair -- melee flashes a glyph at the midpoint; ranged travels
   * attacker -> defender. Shared by both renderers: the 2D renderer
   * projects ax/ay/dx/dy via its single affine offsetX/offsetY/ts tile
   * grid (see drawCombatSlashes below); the 3D renderer has no single
   * affine mapping for the whole frame (perspective), so it projects each
   * anim's own attacker/defender tile individually and calls this directly.
   * `ts` only affects glyph size/stroke width, not position.
   */
  function drawCombatSlashAt(ctx, a, ax, ay, dx, dy, ts, now) {
    const elapsed = now - a.start;
    if (elapsed > SLASH_ANIM_MS) return;
    const t = elapsed / SLASH_ANIM_MS;

    let px, py, angle, alpha, size;
    if (a.isRanged) {
      px = ax + (dx - ax) * t;
      py = ay + (dy - ay) * t;
      angle = Math.atan2(dy - ay, dx - ax) + a.slashRot;
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
    ctx.font = `bold ${Math.max(1, size)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = Math.max(1, ts * 0.05);
    ctx.strokeText(a.slashChar, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(a.slashChar, 0, 0);
    ctx.restore();
  }

  /** 2D-only: projects every active combat anim via the affine
   *  offsetX/offsetY/ts tile grid, then draws it with drawCombatSlashAt. */
  function drawCombatSlashes(ctx, offsetX, offsetY, ts, now) {
    for (const a of activeCombatAnims) {
      const ax = a.ax * ts + offsetX + ts / 2, ay = a.ay * ts + offsetY + ts / 2;
      const dx = a.dx * ts + offsetX + ts / 2, dy = a.dy * ts + offsetY + ts / 2;
      drawCombatSlashAt(ctx, a, ax, ay, dx, dy, ts, now);
    }
  }

  /**
   * Puff-of-smoke-resolving-into-a-skull (2026-08-07, user-directed), drawn
   * at an already-projected screen point -- same "shared point-based draw,
   * each renderer supplies its own projection" split as drawCombatSlashAt:
   * 2D projects via its single affine grid (drawDeathEffects below), 3D
   * projects this effect's own tile individually and calls this directly.
   *
   * Two overlapping phases against one shared timeline `t` (0..1): a
   * handful of grey puffs drift outward/up and fade over the first ~65% of
   * the effect's life (staggered by each puff's own `delay` so they don't
   * pop in unison), while a skull glyph fades in as the smoke thins, holds,
   * then fades out -- "resolves into" rather than "instantly is".
   */
  function drawDeathEffectAt(ctx, e, px, py, ts, now) {
    const elapsed = now - e.start;
    if (elapsed > DEATH_EFFECT_ANIM_MS) return;
    const t = elapsed / DEATH_EFFECT_ANIM_MS;

    ctx.save();
    for (const p of e.puffs) {
      const pt = (t - p.delay) / 0.65;
      if (pt <= 0 || pt >= 1) continue;
      const ease = 1 - (1 - pt) * (1 - pt);
      const dist = p.dist * ts * ease;
      const size = p.size * ts * (0.6 + 0.4 * ease);
      const alpha = (pt < 0.25 ? pt / 0.25 : 1 - (pt - 0.25) / 0.75) * 0.55;
      const cx = px + Math.cos(p.angle) * dist;
      const cy = py + Math.sin(p.angle) * dist - ts * 0.15 * ease;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = "#9e9e9e";
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    let skullAlpha = 0;
    if (t > 0.30 && t < 0.55) skullAlpha = (t - 0.30) / 0.25;
    else if (t >= 0.55 && t < 0.78) skullAlpha = 1;
    else if (t >= 0.78) skullAlpha = Math.max(0, 1 - (t - 0.78) / 0.22);
    if (skullAlpha > 0) {
      const scale = 0.75 + 0.25 * Math.min(1, (t - 0.30) / 0.15);
      const size = Math.max(8, ts * 0.55 * scale);
      const sx = px, sy = py - ts * 0.1;
      ctx.save();
      ctx.globalAlpha = skullAlpha;
      // Soft dark backdrop so the glyph reads against bright terrain --
      // same reasoning drawConditionBadges' per-icon circle uses -- plus an
      // explicit fill color + stroke outline (drawFloatingTexts' own
      // stroke-then-fill convention) so this stays legible even on a
      // platform whose emoji font renders \u{1F480} as a plain glyph tinted
      // by fillStyle rather than its native color-emoji artwork.
      ctx.beginPath();
      ctx.arc(sx, sy, size * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = Math.max(1, ts * 0.04);
      ctx.strokeText("\u{1F480}", sx, sy);
      ctx.fillStyle = "#f2efe6";
      ctx.fillText("\u{1F480}", sx, sy);
      ctx.restore();
    }
  }

  /** 2D-only: projects every active death effect via the affine
   *  offsetX/offsetY/ts tile grid, then draws it with drawDeathEffectAt. */
  function drawDeathEffects(ctx, offsetX, offsetY, ts, now) {
    for (const e of activeDeathEffects) {
      const px = e.x * ts + offsetX + ts / 2, py = e.y * ts + offsetY + ts / 2;
      drawDeathEffectAt(ctx, e, px, py, ts, now);
    }
  }

  const BURNING_TINT_COLOR = "255,87,34"; // orange-red
  const FROZEN_TINT_COLOR = "129,212,250"; // icy blue
  const ZOMBIE_TINT_COLOR = "120,120,120"; // washed-out grey
  const WEB_TINT_COLOR = "233,230,210"; // pale webbing off-white
  const POISON_TINT_COLOR = "124,179,66"; // sickly venom green

  /** Stable per-unit random phase so multiple burning/frozen units on
   *  screen at once don't flicker in perfect unison. */
  function conditionEffectPhase(unit) {
    if (unit._effectPhase == null) unit._effectPhase = Math.random() * Math.PI * 2;
    return unit._effectPhase;
  }

  /** Tints whatever's already drawn within (boxX,boxY,boxSize) using
   *  source-atop compositing directly on the given canvas -- only correct
   *  when nothing else opaque sits under that box. */
  function tintDrawnArea(ctx, boxX, boxY, boxSize, color, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${color})`;
    ctx.fillRect(boxX, boxY, boxSize, boxSize);
    ctx.restore();
  }

  // Reusable offscreen buffer for tintSprite below.
  let effectMaskCanvas = null, effectMaskCtx = null;
  function getEffectMaskCtx(size) {
    if (!effectMaskCanvas) {
      effectMaskCanvas = document.createElement("canvas");
      effectMaskCtx = effectMaskCanvas.getContext("2d");
    }
    if (effectMaskCanvas.width !== size || effectMaskCanvas.height !== size) {
      effectMaskCanvas.width = size;
      effectMaskCanvas.height = size;
    } else {
      effectMaskCtx.clearRect(0, 0, size, size);
    }
    return effectMaskCtx;
  }

  /** Tints just the SPRITE's own opaque pixels (not the whole box) by
   *  redrawing the same sprite frame onto a small offscreen canvas, masking
   *  a solid fill to exactly that alpha shape via source-atop THERE, then
   *  compositing the masked result onto `ctx` at the given alpha. `frame`
   *  is the {sx,sy,sw,sh} source rect from sprites.currentFrame, or null to
   *  fall back to a plain box tint. */
  function tintSprite(ctx, image, frame, boxX, boxY, boxSize, color, alpha) {
    if (alpha <= 0) return;
    if (!image || !frame) { tintDrawnArea(ctx, boxX, boxY, boxSize, color, alpha); return; }
    const size = Math.max(1, Math.round(boxSize));
    const maskCtx = getEffectMaskCtx(size);
    maskCtx.globalCompositeOperation = "source-over";
    maskCtx.drawImage(image, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, size, size);
    maskCtx.globalCompositeOperation = "source-atop";
    maskCtx.fillStyle = `rgb(${color})`;
    maskCtx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(effectMaskCanvas, boxX, boxY, boxSize, boxSize);
    ctx.restore();
  }

  function drawConditionVisualEffects(ctx, unit, unitSprite, boxX, boxY, boxSize, now) {
    if (!unit.conditions) return;
    const hasEffect = unit.conditions.zombie || unit.conditions.burning || unit.conditions.frozen || unit.conditions.webbed || unit.conditions.poisoned;
    if (!hasEffect) return;
    const phase = conditionEffectPhase(unit);
    const frame = unitSprite ? window.UI.sprites.currentFrame(unitSprite.manifest, "idle", unit) : null;
    const image = unitSprite ? unitSprite.image : null;
    if (unit.conditions.zombie) {
      tintSprite(ctx, image, frame, boxX, boxY, boxSize, ZOMBIE_TINT_COLOR, 0.45);
    }
    if (unit.conditions.burning) {
      const flicker = 0.35 + 0.25 * Math.sin(now / 90 + phase) + 0.15 * Math.sin(now / 37 + phase * 1.7);
      tintSprite(ctx, image, frame, boxX, boxY, boxSize, BURNING_TINT_COLOR, Math.max(0.15, Math.min(0.7, flicker)));
    }
    if (unit.conditions.frozen) {
      const flicker = 0.30 + 0.20 * Math.sin(now / 140 + phase * 1.3);
      tintSprite(ctx, image, frame, boxX, boxY, boxSize, FROZEN_TINT_COLOR, Math.max(0.15, Math.min(0.55, flicker)));
    }
    if (unit.conditions.webbed) {
      // Slow, low-amplitude breathing rather than burning/frozen's shimmer --
      // a web is a physical binding, not an elemental effect, so it should
      // read as "stuck" rather than "flickering."
      const pulse = 0.30 + 0.08 * Math.sin(now / 260 + phase);
      tintSprite(ctx, image, frame, boxX, boxY, boxSize, WEB_TINT_COLOR, Math.max(0.22, Math.min(0.38, pulse)));
    }
    if (unit.conditions.poisoned) {
      // A queasy, uneven throb -- distinct from Web's slow steady pulse and
      // from Burning's fast flicker -- reads as "sickened," not "on fire"
      // or "bound."
      const throb = 0.30 + 0.14 * Math.sin(now / 170 + phase) + 0.06 * Math.sin(now / 63 + phase * 2.1);
      tintSprite(ctx, image, frame, boxX, boxY, boxSize, POISON_TINT_COLOR, Math.max(0.18, Math.min(0.5, throb)));
    }
  }

  /** Golden glow + sparkle for a unit with a pending level-up (2026-08-07,
   *  user-directed) -- the only on-map affordance for this now that the
   *  level-up picker lives solely in the ring menu (see sidebar.js's
   *  info-only banner and main.js's buildRingPage): a player scanning the
   *  map should be able to spot which units are owed a veteran bonus
   *  without opening each one's ring. `pendingLevelUps` is combat.js's
   *  own "earned XP thresholds minus levels already spent" count, the same
   *  one gating the ring menu's Level Up pill -- reused directly rather
   *  than duplicating that math here. Drawn behind the sprite (see
   *  render.js's Units pass, which calls this before drawImage) so the
   *  glow reads as coming from underneath the unit, with sprites already
   *  compositing correctly on top; the sparkles are drawn back OVER
   *  everything by the caller in a second pass so they aren't hidden
   *  behind the sprite they're meant to twinkle in front of. */
  function drawLevelUpGlowBehind(ctx, unit, boxX, boxY, boxSize, now) {
    if (window.GameEngine.combat.pendingLevelUps(unit) <= 0) return;
    const cx = boxX + boxSize / 2, cy = boxY + boxSize / 2;
    const phase = conditionEffectPhase(unit);
    const pulse = 0.6 + 0.4 * Math.sin(now / 320 + phase);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const r = boxSize * 0.68;
    const grad = ctx.createRadialGradient(cx, cy, boxSize * 0.12, cx, cy, r);
    grad.addColorStop(0, `rgba(255, 210, 90, ${0.5 * pulse})`);
    grad.addColorStop(0.6, `rgba(255, 190, 60, ${0.22 * pulse})`);
    grad.addColorStop(1, "rgba(255, 190, 60, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** A small 4-point sparkle shape, filled at `alpha`. */
  function drawSparkleMark(ctx, x, y, size, alpha) {
    if (alpha <= 0 || size <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.28, y - size * 0.28);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size * 0.28, y + size * 0.28);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.28, y + size * 0.28);
    ctx.lineTo(x - size, y);
    ctx.lineTo(x - size * 0.28, y - size * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** A handful of small gold sparkles orbiting the unit's box, each
   *  twinkling in and out on its own beat (via conditionEffectPhase, so a
   *  screen full of leveled-up units doesn't flicker in lockstep). Drawn
   *  AFTER the sprite (see render.js) so they sit in front of it, unlike
   *  the glow above. */
  function drawLevelUpSparkles(ctx, unit, boxX, boxY, boxSize, now) {
    if (window.GameEngine.combat.pendingLevelUps(unit) <= 0) return;
    const cx = boxX + boxSize / 2, cy = boxY + boxSize / 2;
    const phase = conditionEffectPhase(unit);
    const orbitR = boxSize * 0.58;
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = now / 1100 + phase + (i / count) * Math.PI * 2;
      const sx = cx + Math.cos(angle) * orbitR;
      const sy = cy + Math.sin(angle) * orbitR * 0.82;
      const twinkle = Math.max(0, Math.sin(now / 240 + phase * 3 + i * 2.1));
      if (twinkle < 0.12) continue; // fully invisible beat -- skip the draw so it reads as twinkling, not just pulsing
      drawSparkleMark(ctx, sx, sy, boxSize * 0.1 * twinkle, twinkle);
    }
  }

  /**
   * Small status badges -- one per active unit.conditions entry with a
   * mapped icon (see CONDITION_ICONS), plus a "carrying a passenger" badge
   * when unit.carries is set, stacked leftward from the tile's upper-right
   * corner, sitting just above the unit's own sprite box.
   */
  function drawConditionBadges(ctx, unit, boxX, boxY, boxSize, ts) {
    const icons = [];
    if (unit.carries) icons.push(CARRYING_ICON);
    // Rest and Defend (2026-08-07, user-directed) sets BOTH unit.resting and
    // conditions.defending together -- only one badge should show for that
    // single action, so the resting icon is skipped whenever defending is
    // also active (defending's own icon is picked up by the loop below).
    // Every OTHER unit.resting=true call site (the many AI heuristics in
    // ai.js marking "this unit had nothing else to do") has no defending
    // condition alongside it and still shows its own lone badge as before.
    if (unit.resting && !unit.conditions?.defending) icons.push(CONDITION_ICONS.resting);
    if (unit.conditions) {
      for (const key of Object.keys(unit.conditions)) {
        if (CONDITION_ICONS[key]) icons.push(CONDITION_ICONS[key]);
      }
    }
    if (icons.length === 0) return;
    const iconSize = Math.max(9, ts * 0.30);
    const cy = boxY - iconSize * 0.15;
    let cx = boxX + boxSize - iconSize * 0.5;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${iconSize}px sans-serif`;
    for (const icon of icons) {
      ctx.beginPath();
      ctx.arc(cx, cy, iconSize * 0.58, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();
      ctx.fillText(icon, cx, cy);
      cx -= iconSize * 0.95;
    }
  }

  /**
   * Idle-city badge (2026-08-07, user-directed): a small corner marker on
   * the player's own city tiles that have nothing queued and aren't
   * spending this turn's production on resources/research either -- see
   * cities.js's isCityIdle, the single shared predicate this also backs the
   * End Turn nag and the sidebar's per-city tag with. Human-civ-only gate
   * lives in the caller (render.js's Cities loop); this just draws.
   * Same dark-backdrop-circle-plus-icon convention as drawConditionBadges,
   * inset into the tile's top-right corner since a city sprite fills the
   * whole tile (no "above the sprite" space the way a unit's own badges
   * get). Explicit fillStyle + stroke on the icon, not just `fillText`,
   * same reasoning drawDeathEffectAt's skull uses: some platforms render
   * emoji as a plain glyph tinted by fillStyle rather than native
   * color-emoji art, and this needs to read clearly either way.
   */
  function drawIdleCityBadge(ctx, x, y, size) {
    const r = size * 0.16;
    const cx = x + size - r * 1.3, cy = y + r * 1.3;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    ctx.font = `${Math.max(8, r * 1.3)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.strokeText("\u{1F4A4}", cx, cy);
    ctx.fillStyle = "#f2efe6";
    ctx.fillText("\u{1F4A4}", cx, cy);
    ctx.restore();
  }

  /**
   * Persistent (non-fading) label showing a channeling unit's currently
   * accumulated prospecting/delving/fishing stash -- reads LIVE state
   * directly off the unit every frame rather than draining a one-shot
   * animated event queue.
   */
  function drawChannelStashLabel(ctx, unit, screenX, screenY, ts) {
    if (!unit.channeling) return;
    const stash = unit._channelStash;
    if (!stash) return;
    const parts = [];
    if (stash.harvest) parts.push(`+${Math.round(stash.harvest)} Harvest`);
    if (stash.coin) parts.push(`+${Math.round(stash.coin)} Coin`);
    if (stash.lore) parts.push(`+${Math.round(stash.lore)} Lore`);
    if (!parts.length) return;
    const text = parts.join("  ");
    const px = screenX + ts / 2;
    const py = screenY - ts * 0.42;
    ctx.save();
    ctx.font = `${Math.max(9, ts * 0.19)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const padX = ts * 0.08, padY = ts * 0.05;
    const w = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(px - w / 2 - padX, py - ts * 0.11 - padY, w + padX * 2, ts * 0.22 + padY * 2);
    ctx.fillStyle = "#ffd54f";
    ctx.fillText(text, px, py);
    ctx.restore();
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const CONSTRUCTION_COLOR = "#e0a030"; // amber -- reads as "in progress", distinct from the influence overlay's civ colors

  /**
   * Under-construction placeholder (2026-08-07, user-directed): a queued
   * building/wall's final tile is already locked in at queue time
   * (city.buildQueue.placeAt, set by main.js's handleChooseBuild placement
   * flow -- see orders.js's queueBuild), but the actual structure record
   * isn't created until completion (cities.js's placeStructure/
   * completeBuildingStructure). Without this, the tile just sits empty for
   * however many turns the build takes and the finished building pops in
   * with no buildup at all. 2D-only for now -- the 3D renderer's influence
   * hatch is a whole separate WebGL decal/texture-batch pipeline
   * (buildInfluenceDecalGroups), not a couple of canvas calls, so giving
   * this the same treatment there is a much larger, separate lift.
   *
   * Reuses drawHatch (same as the influence overlay's contested-tile
   * stripes) rather than inventing a new pattern, plus a crane icon and the
   * turns-remaining count -- explicit fill/stroke on both (not just
   * `fillText`), same reasoning drawDeathEffectAt's skull uses: some
   * platforms render emoji as a plain glyph tinted by fillStyle rather than
   * native color-emoji art, and this needs to read clearly either way.
   */
  function drawConstructionSite(ctx, x, y, size, item) {
    drawHatch(ctx, x, y, size, CONSTRUCTION_COLOR);

    const cx = x + size / 2, cy = y + size * 0.58;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(9, size * 0.42)}px sans-serif`;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.strokeText("\u{1F3D7}\u{FE0F}", cx, cy);
    ctx.fillStyle = "#3a2a12";
    ctx.fillText("\u{1F3D7}\u{FE0F}", cx, cy);

    if (item.turnsRemaining != null) {
      const label = String(item.turnsRemaining);
      const ty = y + size * 0.88;
      ctx.font = `bold ${Math.max(8, size * 0.24)}px sans-serif`;
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.strokeText(label, cx, ty);
      ctx.fillStyle = "#fff3d0";
      ctx.fillText(label, cx, ty);
    }
    ctx.restore();
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
        && (civ.unlockedMechanics.has("heavy_metal") || civ.unlockedMechanics.has("power_metal"))
        // Human civs must explicitly activate the aura (2026-08-10,
        // user-directed) -- see turns.js's own matching gate. AI civs are
        // unaffected, same always-on behavior as before.
        && (!civ.isHuman || unit.auraActive)) {
      const hasHeavyMetal = civ.unlockedMechanics.has("heavy_metal");
      const hasPowerMetal = civ.unlockedMechanics.has("power_metal");
      const epicMetal = civ.unlockedMechanics.has("epic_metal");
      const aura = (hasHeavyMetal && hasPowerMetal)
        ? (unit.activeAura || "heavy_metal")
        : (hasPowerMetal ? "power_metal" : "heavy_metal");
      return aura === "heavy_metal"
        ? { radius: epicMetal ? 2 : 1, color: "#ff8a65", label: "Heavy Metal" }
        : { radius: epicMetal ? 2 : 1, color: "#7c4dff", label: "Power Metal" };
    }
    return null;
  }

  /**
   * Tile City Score overlay (Interface menu): draws the selected race's
   * remembered score for this tile as a centered number with a small
   * translucent backing, on top of whatever else was already drawn.
   * `score` is undefined/null for a tile the selected race hasn't explored
   * -- silently skipped, no number shown.
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

  window.UI.overlays = {
    tick,
    updateCombatAnims, updateAreaEffects, updateQuipBubbles, updateFloatingTexts, updateDeathEffects,
    drawAreaEffects, drawAreaEffectBox, drawCombatSlashes, drawCombatSlashAt,
    drawQuipBubble, drawFloatingTexts, drawDeathEffects, drawDeathEffectAt,
    hasActiveQuip, hasActiveFloatingText, getActiveCombatAnims, getActiveAreaEffects, getActiveDeathEffects,
    getUnitShakeOffset, drawConditionVisualEffects, drawConditionBadges, drawChannelStashLabel, drawIdleCityBadge,
    drawLevelUpGlowBehind, drawLevelUpSparkles,
    hexToRgba, drawHatch, drawConstructionSite, auraInfoForUnit, drawTileScoreOverlay,
    ATTACK_ANIM_MS, SLASH_ANIM_MS, AREA_EFFECT_ANIM_MS, AREA_EFFECT_COLORS, DEATH_EFFECT_ANIM_MS,
    // Exported (2026-08-16, user-directed KMKB feature) so the Knowledge
    // Base's Conditions page can read the same icon set this module draws
    // on the map, rather than keeping a second hand-copied list that could
    // drift out of sync with it.
    CONDITION_ICONS,
  };
})();
