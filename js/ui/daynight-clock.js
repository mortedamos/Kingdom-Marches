/**
 * ASTRONOMICAL CLOCK
 * ------------------
 * The lower half of a circle hanging from the top edge of the map, read as a
 * 180-degree gauge: the left end is rise, the bottom centre is zenith, the
 * right end is set.
 *
 * The sun and moon each ride an OVERLAPPING arc rather than splitting the
 * cycle into two disjoint halves: the sun's arc runs from the first turn of
 * dawn through to the last turn of twilight, and the moon's runs from that
 * same last twilight turn through to that same first dawn turn. The two
 * arcs share both endpoints. Since a body's arc position reaches exactly the
 * dial's left/right horizon at t=0/t=1, that shared slot is the one turn
 * where BOTH bodies sit on the dial at once -- one exactly at each rim,
 * each cut in half by the horizon chord (see targetsForSlot). That's the
 * "half a sun setting as half a moon rises" moment at the edge of twilight
 * and dawn, and it falls out of the geometry rather than being a special
 * case drawn separately.
 *
 * GEOMETRY: the dial circle itself (radius R, centred at ccx,ccy) is inset
 * from the canvas's LEFT AND RIGHT edges only -- never the top -- by a
 * small margin (see HORN_MARGIN_FRAC), so the gilded rim's corner knobs
 * (drawn at the two points where the curved rim meets the flat horizon,
 * i.e. the "horns") have somewhere to sit without being clipped by the
 * canvas bounds. Deliberately no top margin: the horizon sits flush
 * against whatever's above the widget (the menu bar on desktop, #m-topbar
 * on mobile), exactly as it did before this ornament existed. An earlier
 * version reserved space above the horizon for the knobs to rise into,
 * which pushed the whole dial down and left it floating below the menu bar
 * with a visible gap -- the knobs sit tangent to the horizon from BELOW
 * instead (see drawHornFlourish), so no such margin is needed. Every
 * drawing coordinate is expressed relative to ccx/ccy/R, never as a bare
 * 0, so this can be revisited without hunting down assumptions elsewhere
 * in this file.
 *
 * The phase name (e.g. "Night") is shown only on hover, not at rest --
 * see `hovering` below. Hover is detected by a mousemove listener doing
 * simple circle-distance math against the dial's own centre and radius,
 * NOT by making the element pointer-events:auto: that would make the
 * (rectangular) canvas element hit-testable everywhere inside its box,
 * including the transparent corners outside the actual dial circle, and
 * would swallow clicks meant for the map underneath it. Reading raw cursor
 * coordinates from a passive window-level listener gets a precisely
 * circular hover region for free without touching pointer-events anywhere.
 *
 * DRAWN, NOT SPRITED (except the bodies themselves, and only for the
 * reasons above). The dial's sky, arc, ticks, gilding and rim are
 * procedural so they can be tinted from the same numbers the world tint
 * uses -- a baked 12-frame dial would drift out of agreement with the map
 * the first time either was retuned, and couldn't ease between turns. The
 * sky scene (clouds by day, stars by night) is likewise procedural and
 * faded by the same `darkness` value driving the world tint, for the same
 * reason: the dial and the map must never be able to disagree about what
 * time it is.
 *
 * Only the sun and moon are art, and if that art hasn't loaded (or doesn't
 * exist yet) they fall back to drawn discs, so the widget is never broken
 * by a missing file.
 *
 * One element serves both layouts. On desktop it hangs inside .map-area; on
 * mobile the same element is pushed down to clear #m-topbar. It's
 * pointer-events:none throughout -- it reports time, it isn't a control.
 */
(function () {
  window.UI = window.UI || {};

  const cfg = () => window.GameConfig.view.dayNight;
  const clockCfg = () => cfg().clock;

  let root = null;
  let canvas = null;
  let ctx = null;
  let sunImg = null;
  let moonImg = null;
  let lastW = 0, lastH = 0, lastDpr = 0;
  let listenerAttached = false;

  const BODY_KEYS = ["sun", "moon"];

  /** Extra room reserved beside the dial CIRCLE (never above it -- see
   *  geometry()), as a fraction of its radius, so the gilded rim's horn
   *  knobs have canvas pixels to sit in without being clipped by the
   *  canvas edge. The canvas element itself is sized to the dial plus this
   *  margin; the dial's own diameter (what desktopWidth/mobileWidth in
   *  config describe) is unaffected. */
  const HORN_MARGIN_FRAC = 0.30;

  let hovering = false;

  // Per-body eased angle along the track. The sky holds for a whole turn and
  // steps on End Turn; letting a body step with it would read as a stutter,
  // so each one glides to its new position over the same duration the sky
  // fades. Split per body (rather than one shared `angle`) because sun and
  // moon can each independently be on-dial or off-dial from one slot to the
  // next, and at the two handoff slots both are on-dial simultaneously.
  const anim = {
    sun: { angle: null, from: 0, to: 0, start: 0, dur: 0, visible: false },
    moon: { angle: null, from: 0, to: 0, start: 0, dur: 0, visible: false },
  };
  let lastSlot = null;

  /** Dial diameter for the current platform, in CSS px -- the CIRCLE's own
   *  size, not the margin-padded canvas box. */
  function dialDiameter() {
    const isMobile = document.body.classList.contains("mobile");
    return isMobile ? clockCfg().mobileWidth : clockCfg().desktopWidth;
  }

  /** All the geometry render() needs, derived fresh each call so a
   *  mobile/desktop switch or a live config edit picks up immediately.
   *
   *  NO top margin: the dial's horizon sits flush against whatever's above
   *  it (the menu bar on desktop, #m-topbar on mobile) exactly as it did
   *  before the gilded rim existed -- an earlier version of this reserved
   *  space above the horizon for the horn knobs to rise into, which pushed
   *  the whole visible dial down and left a gap floating below the menu
   *  bar. The knobs sit tangent to the horizon from BELOW instead (see
   *  drawHornFlourish), so only a SIDE margin is needed, for their
   *  sideways protrusion past the dial's own width. */
  function geometry() {
    const d = dialDiameter();
    const R = d / 2;
    const marginSide = R * HORN_MARGIN_FRAC;
    return {
      d, R, marginSide,
      w: d + marginSide * 2,
      h: R,
      ccx: marginSide + R,
      ccy: 0,
    };
  }

  /**
   * Where the twilight and dawn phases fall in the slot table, read from
   * config rather than hardcoded -- if the phase lengths are ever retuned,
   * the sun/moon arcs and their handoff slots move with them automatically.
   */
  function phaseRanges() {
    const c = cfg();
    const n = c.slots.length;
    let cursor = 0, twStart = -1, twLen = 0, dwStart = -1, dwLen = 0;
    for (const p of c.phases) {
      if (p.id === "twilight") { twStart = cursor; twLen = p.turns; }
      if (p.id === "dawn") { dwStart = cursor; dwLen = p.turns; }
      cursor += p.turns;
    }
    const twLast = (twStart + twLen - 1 + n) % n;
    const dwFirst = dwStart % n;
    return { n, twLast, dwFirst };
  }

  /**
   * How many slots long each arc is, forward from its start slot to its end
   * slot inclusive. Moon: last-twilight-turn -> first-dawn-turn (wrapping
   * through the whole of night). Sun: first-dawn-turn -> last-twilight-turn
   * (wrapping through the rest of dawn, all of day, and the rest of
   * twilight) -- the complementary arc, sharing both endpoints with the
   * moon's.
   */
  function arcLengths() {
    const { n, twLast, dwFirst } = phaseRanges();
    const moonLen = ((dwFirst - twLast + n) % n) + 1;
    const sunLen = ((twLast - dwFirst + n) % n) + 1;
    return { twLast, dwFirst, moonLen, sunLen, n };
  }

  /**
   * 0-1 progress along each body's arc for this slot, or null if that body
   * isn't on the dial at all this slot. Both come back non-null only at the
   * two handoff slots (twLast and dwFirst) -- see the module doc comment.
   */
  function targetsForSlot(slot) {
    const { twLast, dwFirst, moonLen, sunLen, n } = arcLengths();
    const relMoon = (slot - twLast + n) % n;
    const relSun = (slot - dwFirst + n) % n;
    const moonT = relMoon < moonLen ? (moonLen > 1 ? relMoon / (moonLen - 1) : 0) : null;
    const sunT = relSun < sunLen ? (sunLen > 1 ? relSun / (sunLen - 1) : 0) : null;
    return { sun: sunT, moon: moonT };
  }

  /** Track angle in canvas radians. The dial's centre is (ccx,ccy), so the
   *  visible lower semicircle spans 0 (right) to PI (left). A body rises at
   *  the left and sets at the right. t=0 and t=1 land EXACTLY on the
   *  horizon (sin(0)=sin(PI)=0) -- deliberately, so a body at either arc
   *  endpoint sits centred on the dial's own clip boundary and renders as
   *  only its bottom half, cut clean by the horizon chord, rather than
   *  needing separate half-circle art. */
  function angleForT(t) { return Math.PI - t * Math.PI; }

  /** Smoothstep -- matches daynight.js's own ease so the body's glide and
   *  the sky's fade read as one motion. */
  function ease(t) { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); }

  /** This slot's sky: the day colour mixed toward that slot's own world tint
   *  in proportion to how dark it is. One source of truth with the map. */
  function skyForSlot(slot) {
    const dn = window.UI.daynight;
    const s = dn.slotConfig(slot);
    const k = Math.max(0, Math.min(1, (s.alpha || 0) * clockCfg().skyMix));
    return dn.mixHex(clockCfg().daySky, s.tint, k);
  }

  // -----------------------------------------------------------------------
  // Sky scene: clouds by day, stars by night, crossfaded by `darkness`
  // (0 = noon, 1 = deepest night) -- the same normalized value the world
  // tint uses, so the dial's scene can't drift out of sync with the map's.
  //
  // Fixed, hand-placed positions rather than anything procedural or
  // drifting: at this size (the dial is well under 200px wide) incidental
  // motion reads as noise, not atmosphere, and the project has a standing
  // no-flashing rule -- a static scene that only ever fades along with the
  // sky it's painted on can never violate it. Coordinates are fractions of
  // the DIAL's own span (not the padded canvas box), passed the dial's own
  // ccx/ccy/R so they stay correctly placed regardless of the horn margin.
  // -----------------------------------------------------------------------
  const CLOUDS = [
    { x: 0.16, y: 0.62, w: 0.24, h: 0.15 },
    { x: 0.40, y: 0.40, w: 0.19, h: 0.12 },
    { x: 0.68, y: 0.58, w: 0.27, h: 0.16 },
    { x: 0.86, y: 0.34, w: 0.16, h: 0.10 },
  ];
  const STARS = [
    { x: 0.08, y: 0.28, r: 0.011 }, { x: 0.16, y: 0.55, r: 0.015 },
    { x: 0.24, y: 0.16, r: 0.009 }, { x: 0.33, y: 0.62, r: 0.012 },
    { x: 0.42, y: 0.30, r: 0.010 }, { x: 0.50, y: 0.70, r: 0.017 },
    { x: 0.58, y: 0.22, r: 0.009 }, { x: 0.66, y: 0.58, r: 0.012 },
    { x: 0.74, y: 0.30, r: 0.010 }, { x: 0.82, y: 0.60, r: 0.014 },
    { x: 0.90, y: 0.24, r: 0.009 }, { x: 0.94, y: 0.48, r: 0.011 },
  ];

  /** A simple three-lobe puff -- one filled path from overlapping ellipses,
   *  which is the cheapest way to read as "a cloud" rather than "an oval"
   *  at a size too small for real shading to survive. */
  function drawCloudPuff(g, cx, cy, w, h) {
    g.beginPath();
    g.ellipse(cx - w * 0.28, cy + h * 0.18, w * 0.30, h * 0.55, 0, 0, Math.PI * 2);
    g.ellipse(cx, cy - h * 0.16, w * 0.36, h * 0.65, 0, 0, Math.PI * 2);
    g.ellipse(cx + w * 0.30, cy + h * 0.12, w * 0.28, h * 0.50, 0, 0, Math.PI * 2);
    g.fill();
  }

  function drawSkyScene(g, R, ccx, ccy, darkness) {
    const cc = clockCfg();
    const cloudAlpha = Math.max(0, Math.min(1, 1 - Math.pow(darkness, 1 / (cc.cloudPower || 1))));
    const starAlpha = Math.max(0, Math.min(1, Math.pow(darkness, cc.starPower || 1)));

    // Positions are fractions of the dial's own box: x across its full
    // diameter (ccx-R to ccx+R), y down its radius (ccy to ccy+R).
    const toX = (fx) => ccx - R + fx * (R * 2);
    const toY = (fy) => ccy + fy * R;

    if (cloudAlpha > 0.02) {
      g.save();
      g.globalAlpha = cloudAlpha;
      // A soft off-white rather than pure white -- flat #fff at nearly full
      // alpha read as a bright blown-out patch that fought the sun for
      // attention instead of sitting behind it. This warm, slightly muted
      // ivory (closer to parchment than to cloud-white) both recedes more
      // and ties into the illuminated-manuscript sun/moon art's own palette.
      g.fillStyle = "rgba(233,226,208,0.80)";
      for (const c of CLOUDS) drawCloudPuff(g, toX(c.x), toY(c.y), c.w * R * 2, c.h * R);
      g.restore();
    }
    if (starAlpha > 0.02) {
      g.save();
      g.globalAlpha = starAlpha;
      g.fillStyle = "#fff6e0";
      for (const s of STARS) {
        g.beginPath();
        g.arc(toX(s.x), toY(s.y), s.r * R * 2, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
  }

  // -----------------------------------------------------------------------
  // Gilded rim -- an illuminated-manuscript gold border around the dial's
  // curved edge, with a small vine-and-berry flourish at each "horn" (the
  // point where that curved edge meets the flat horizon). Drawn AFTER the
  // sky clip is released (see render()), since the flourishes deliberately
  // extend past the dial circle itself into the margin reserved for them.
  //
  // FLAT, NOT BEVELED. A first version of this used three concentric
  // strokes (dark/mid/light) to fake a shiny beveled metal ring -- correct
  // for hardware, wrong for this: real illuminated gold leaf is burnished
  // FLAT and bordered by a single hand-inked line, with any texture coming
  // from small tooled punch-marks stamped into the leaf, not from shading.
  // Matches the sun/moon art's own convention: flat colour fills, a
  // confident hand-inked outline, and small colour accents (here, a berry
  // of the same vermilion as the sun's ring) rather than airbrushed light.
  // -----------------------------------------------------------------------
  const GOLD_LIGHT = "#f6dfa0";
  const GOLD_MID = "#caa04a";
  const GOLD_DARK = "#7c541c";
  const INK = "#4a3418";
  const BERRY = "#8a2e22";

  function drawGildedRim(g, ccx, ccy, R) {
    const bandW = Math.max(3, R * 0.075);
    const midR = R - bandW / 2;

    g.save();
    g.lineCap = "butt";

    // The band itself: one flat gold fill.
    g.beginPath(); g.arc(ccx, ccy, midR, 0, Math.PI);
    g.strokeStyle = GOLD_MID; g.lineWidth = bandW; g.stroke();

    // A slightly lighter inner third gives the leaf a little life without
    // turning it into a metal bevel -- still flat colour, just two steps
    // of it, the same "base + one highlight step" the world's own building
    // art limits itself to.
    g.beginPath(); g.arc(ccx, ccy, midR + bandW * 0.22, 0, Math.PI);
    g.strokeStyle = GOLD_LIGHT; g.lineWidth = bandW * 0.34; g.stroke();

    // Hand-inked outline on both the outer and inner edge of the band.
    g.beginPath(); g.arc(ccx, ccy, R, 0, Math.PI);
    g.strokeStyle = INK; g.lineWidth = Math.max(1, R * 0.013); g.stroke();
    g.beginPath(); g.arc(ccx, ccy, R - bandW, 0, Math.PI);
    g.strokeStyle = INK; g.lineWidth = Math.max(1, R * 0.013); g.stroke();

    // Small tooled punch-marks along the band's centreline, evenly spaced
    // -- the stamped-dot texture real burnished gold leaf borders often
    // carry, and a cheap way to say "hand-worked" rather than "printed".
    const punches = 15;
    g.fillStyle = INK;
    g.globalAlpha = 0.45;
    for (let i = 1; i < punches; i++) {
      const a = Math.PI * (i / punches);
      g.beginPath();
      g.arc(ccx + Math.cos(a) * midR, ccy + Math.sin(a) * midR, Math.max(0.7, bandW * 0.12), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  /**
   * One corner ornament -- a small gold vine tendril curling out from the
   * rim's end with two ivy-leaf shapes and a berry, the way an illuminated
   * border in a Book of Hours tapers into a flourish at its terminus
   * instead of just stopping dead. A first version of this drew a smooth
   * gold ball on a stick -- crisp, but it read as picture-frame hardware,
   * not manuscript work. This is hand-inked outline + flat colour fill,
   * the same two-pass technique the sun/moon art uses, with a small
   * vermilion berry echoing the sun's own ring accent. `dir` is -1 for the
   * left horn or +1 for the right (the whole shape mirrors, not redrawn).
   *
   * Tangent to the horizon from BELOW and nudged outward past the dial's
   * own edge, never rising above the horizon line -- see geometry()'s own
   * note on why (an earlier version curled upward and needed a top margin,
   * which pushed the whole dial down and left it floating below the menu
   * bar with a gap). This sits entirely within the side margin already
   * reserved for it, so the dial's height, and its flush fit under the
   * menu bar, are completely unaffected by this ornament existing at all.
   */
  function drawHornFlourish(g, x, y, dir, size) {
    g.save();
    g.translate(x, y);
    g.scale(dir, 1);
    g.lineJoin = "round";
    g.lineCap = "round";

    // The curling stem -- a single irregular S-curve rather than a
    // mechanically even arc, the way a quill actually draws a flourish.
    // Ink pass first, a slightly thinner gold pass on top of it.
    const stem = () => {
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(size * 0.30, size * 0.06, size * 0.52, size * 0.30, size * 0.42, size * 0.52);
      g.bezierCurveTo(size * 0.32, size * 0.72, size * 0.55, size * 0.82, size * 0.74, size * 0.66);
    };
    stem(); g.strokeStyle = INK; g.lineWidth = Math.max(1.6, size * 0.15); g.stroke();
    stem(); g.strokeStyle = GOLD_MID; g.lineWidth = Math.max(1, size * 0.085); g.stroke();

    // Two ivy-leaf shapes branching off the stem -- simple pointed almond
    // outlines, flat gold, with one thin ink vein down the centre.
    const leaf = (cx, cy, angle, len) => {
      g.save();
      g.translate(cx, cy);
      g.rotate(angle);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(len * 0.32, -len * 0.34, len * 0.86, 0);
      g.quadraticCurveTo(len * 0.32, len * 0.34, 0, 0);
      g.closePath();
      g.fillStyle = GOLD_MID;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = Math.max(0.9, size * 0.06);
      g.stroke();
      g.beginPath();
      g.moveTo(len * 0.12, 0);
      g.lineTo(len * 0.74, 0);
      g.strokeStyle = GOLD_LIGHT;
      g.lineWidth = Math.max(0.6, size * 0.03);
      g.stroke();
      g.restore();
    };
    leaf(size * 0.26, size * 0.20, -0.55, size * 0.44);
    leaf(size * 0.46, size * 0.64, 1.0, size * 0.38);

    // A small vermilion berry at the tendril's tip -- the illuminated
    // border's traditional dab of colour against the gold, matching the
    // sun art's own vermilion ring rather than inventing a new accent.
    g.beginPath();
    g.arc(size * 0.74, size * 0.66, size * 0.12, 0, Math.PI * 2);
    g.fillStyle = BERRY;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = Math.max(0.8, size * 0.05);
    g.stroke();
    g.beginPath();
    g.arc(size * 0.70, size * 0.62, size * 0.04, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,220,200,0.85)";
    g.fill();

    g.restore();
  }

  function ensureDom() {
    if (root && document.body.contains(root)) return true;
    const mapArea = document.querySelector(".map-area");
    if (!mapArea) return false;

    root = document.getElementById("daynight-clock");
    if (!root) {
      root = document.createElement("div");
      root.id = "daynight-clock";
      root.className = "daynight-clock";
      root.setAttribute("aria-hidden", "true"); // decorative; the turn counter is the accessible readout
      canvas = document.createElement("canvas");
      root.appendChild(canvas);
      mapArea.appendChild(root);
    } else {
      canvas = root.querySelector("canvas");
    }
    ctx = canvas.getContext("2d");

    // Optional art. Absent files simply leave the drawn fallback in place --
    // these are not in sprites.js's registry because they're UI chrome, not
    // world sprites, and preloadAll's manifest gate would reject them.
    if (!sunImg) {
      sunImg = new Image();
      sunImg.src = "assets/img/sun.png";
      sunImg.onerror = () => { sunImg = null; };
    }
    if (!moonImg) {
      moonImg = new Image();
      moonImg.src = "assets/img/moon.png";
      moonImg.onerror = () => { moonImg = null; };
    }

    if (!listenerAttached) {
      // Passive, read-only, and deliberately NOT on the element itself
      // (which stays pointer-events:none throughout -- see the module doc
      // comment for why). This just watches the raw cursor position and
      // does circle-distance math against wherever the dial currently is.
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseleave", () => { hovering = false; });
      listenerAttached = true;
    }
    return true;
  }

  function onPointerMove(e) {
    if (!canvas) { hovering = false; return; }
    const g = geometry();
    const rect = canvas.getBoundingClientRect();
    // rect is the box's CSS size; ccx/ccy/R from geometry() are in that same
    // local coordinate space (canvas.style.width/height match g.w/g.h).
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const dist = Math.hypot(px - g.ccx, py - g.ccy);
    hovering = py >= g.ccy - 1 && dist <= g.R;
  }

  function resizeIfNeeded() {
    const { w, h } = geometry();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === lastW && h === lastH && dpr === lastDpr) return;

    // Same DPR discipline as main.js's resizeMapCanvas: size the backing
    // store, pre-scale the context, and only assign width/height on a real
    // change (assigning clears the buffer).
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    root.style.width = w + "px";
    root.style.height = h + "px";
    lastW = w; lastH = h; lastDpr = dpr;
  }

  function drawBody(g, kind, cx, cy, size) {
    const img = kind === "sun" ? sunImg : moonImg;
    if (img && img.complete && img.naturalWidth > 0) {
      g.drawImage(img, cx - size / 2, cy - size / 2, size, size);
      return;
    }
    // Drawn fallback -- a warm disc with a halo for the sun, a pale disc with
    // a couple of soft craters for the moon.
    const r = size / 2;
    const halo = g.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.6);
    if (kind === "sun") {
      halo.addColorStop(0, "rgba(255,214,130,0.85)");
      halo.addColorStop(1, "rgba(255,190,80,0)");
    } else {
      halo.addColorStop(0, "rgba(220,230,255,0.55)");
      halo.addColorStop(1, "rgba(200,215,255,0)");
    }
    g.fillStyle = halo;
    g.beginPath(); g.arc(cx, cy, r * 1.6, 0, Math.PI * 2); g.fill();

    g.beginPath();
    g.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    g.fillStyle = kind === "sun" ? "#ffd479" : "#e8eeff";
    g.fill();

    if (kind === "moon") {
      g.fillStyle = "rgba(150,165,200,0.45)";
      g.beginPath(); g.arc(cx - r * 0.18, cy - r * 0.14, r * 0.15, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + r * 0.20, cy + r * 0.10, r * 0.10, 0, Math.PI * 2); g.fill();
    }
  }

  /** Advance each body's on/off-dial state and eased angle for this slot.
   *  Runs once per slot change, not once per frame -- render() calls this
   *  every frame but it's a no-op except on the frame the slot advances. */
  function updateAnim(slot, now) {
    if (slot === lastSlot) return;
    const targets = targetsForSlot(slot);
    const reduced = window.UI.motion && window.UI.motion.isReduced();
    const scrubbing = window.UI.daynight.getTuning().scrubSlot != null;
    // Snap on the very first frame of a session, and while the tuning panel
    // is scrubbing -- daynight.js's own tick snaps the sky under the same
    // two conditions, and a body still gliding toward a slot the slider has
    // already left would put the dial and the world out of agreement.
    const dur = (lastSlot === null || scrubbing) ? 0 : (reduced ? cfg().easeMsReduced : cfg().easeMs);

    for (const key of BODY_KEYS) {
      const t = targets[key];
      const a = anim[key];
      if (t == null) { a.visible = false; continue; }
      const toAngle = angleForT(t);
      if (!a.visible || a.angle == null) {
        // Just arrived on the dial -- it appears already sitting at the
        // horizon, so there's nothing to glide FROM.
        a.from = toAngle;
      } else {
        a.from = a.angle;
      }
      a.to = toAngle;
      a.start = now;
      a.dur = dur;
      a.visible = true;
    }
    lastSlot = slot;
  }

  function render() {
    const dn = window.UI.daynight;
    if (!dn) return;
    if (!dn.isEnabled()) { if (root) root.style.display = "none"; return; }
    if (!ensureDom()) return;
    root.style.display = "";

    resizeIfNeeded();
    const { w, h, R, ccx, ccy } = geometry();
    const st = dn.current();
    const now = performance.now();

    updateAnim(st.slot, now);
    for (const key of BODY_KEYS) {
      const a = anim[key];
      if (!a.visible) continue;
      const p = a.dur > 0 ? ease((now - a.start) / a.dur) : 1;
      a.angle = a.from + (a.to - a.from) * p;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ccx, ccy, R, 0, Math.PI);
    ctx.closePath();
    ctx.clip();

    // Sky. A vertical gradient from the current slot's sky to a slightly
    // deeper version of it gives the dial some depth without inventing a
    // second colour that could disagree with the map. Spans exactly the
    // dial's own visible band (ccy to ccy+R) so the horn margin above it
    // can't dilute the gradient's range.
    const sky = skyForSlot(st.slot);
    const skyDeep = dn.mixHex(sky, "#0a1020", 0.35);
    const g = ctx.createLinearGradient(0, ccy, 0, ccy + R);
    g.addColorStop(0, sky);
    g.addColorStop(1, skyDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Clouds by day, stars by night -- see drawSkyScene's own doc comment.
    drawSkyScene(ctx, R, ccx, ccy, st.darkness);

    // Track + ticks
    const trackR = R * clockCfg().trackRadius;
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ccx, ccy, trackR, 0, Math.PI);
    ctx.stroke();

    const n = cfg().slots.length;
    for (let i = 0; i < n; i++) {
      // One tick per slot of the visible half-sweep.
      const a = angleForT((i + 0.5) / (n / 2));
      if (a < 0 || a > Math.PI) continue;
      const inner = trackR - R * 0.045, outer = trackR + R * 0.045;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.moveTo(ccx + Math.cos(a) * inner, ccy + Math.sin(a) * inner);
      ctx.lineTo(ccx + Math.cos(a) * outer, ccy + Math.sin(a) * outer);
      ctx.stroke();
    }

    // Horizon chord, so rise and set read as edges rather than as the body
    // simply running out of dial.
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ccx - R, ccy + 1.5);
    ctx.lineTo(ccx + R, ccy + 1.5);
    ctx.stroke();

    // The body/bodies. Both sun and moon are drawn whenever both are
    // visible (the two handoff slots) -- see the module doc comment. The
    // clip already in effect is what turns a body sitting exactly on the
    // horizon (angle 0 or PI) into a clean half-circle: no separate
    // half-sprite art needed.
    const bodySize = clockCfg().bodySize * (dialDiameter() / clockCfg().desktopWidth);
    for (const key of BODY_KEYS) {
      const a = anim[key];
      if (!a.visible || a.angle == null) continue;
      drawBody(ctx, key, ccx + Math.cos(a.angle) * trackR, ccy + Math.sin(a.angle) * trackR, bodySize);
    }

    // Caption -- phase name only ("Night"), shown only while hovering (see
    // the module doc comment for why it isn't drawn at rest any more).
    if (clockCfg().showCaption && hovering) {
      ctx.font = `${Math.round(R * 0.20)}px "Cinzel", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const baseline = ccy + R * 0.88;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(st.label, ccx, baseline);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(st.label, ccx, baseline);
    }
    ctx.restore();

    // Gilded rim + horn flourishes, drawn OUTSIDE the clip (the flourishes
    // deliberately extend past the dial circle into the margin reserved for
    // them, and would otherwise be cut off by the clip released just above).
    ctx.save();
    drawGildedRim(ctx, ccx, ccy, R);
    // The vine flourish's farthest reach from the horn is well under its
    // own `size` (the leaves/berry top out around 0.9*size, versus the
    // ~2.05*size an earlier ball-and-stick design needed), so this can sit
    // closer to the full marginSide (R*HORN_MARGIN_FRAC) while keeping a
    // safety gap so it's never clipped by the canvas edge.
    const flourishSize = R * HORN_MARGIN_FRAC * 0.85;
    drawHornFlourish(ctx, ccx - R, ccy, -1, flourishSize);
    drawHornFlourish(ctx, ccx + R, ccy, 1, flourishSize);
    ctx.restore();
  }

  window.UI.daynightClock = { render };
})();
