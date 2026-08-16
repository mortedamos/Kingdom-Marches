/**
 * DRIFTING CLOUD LAYER
 * ---------------------
 * Sparse white clouds floating high above the map: semi-transparent (you can
 * always see the board through them), slowly drifting left -> right at an
 * angle that wanders over time, and confined to a band around the OUTER edge
 * of the view so the middle of the play area stays completely clear (see
 * ensureMask / GameConfig.view.clouds.bandFraction).
 *
 * PURELY COSMETIC -- this module never reads or writes game state, never
 * triggers a redraw, and can never intercept a click. Three independent
 * reasons it can't interfere with input:
 *   1. #map-clouds is styled `pointer-events: none`, so it is never a hit
 *      target (same treatment #map-canvas-3d-hud already gets).
 *   2. Painting pixels onto a canvas doesn't create hit targets anyway.
 *   3. Nothing here listens for input at all, and nothing calls
 *      onChange()/redraw() -- main.js's existing per-frame
 *      requestAnimationFrame loop (startAnimationLoop) already repaints
 *      every frame, so this layer costs no extra redraws.
 *
 * WHY ITS OWN CANVAS: the edge band is cut with
 * globalCompositeOperation = "destination-out", which erases whatever is
 * already on the canvas. On the shared map canvas that would erase the MAP.
 * A dedicated layer makes the erase affect only the clouds.
 *
 * Clouds are pre-rendered ONCE to offscreen canvases at init (each a cluster
 * of soft radial puffs) and then blitted with drawImage each frame -- one
 * blit per cloud instead of ~50 gradient fills, so the per-frame cost stays
 * negligible on top of the map render already happening.
 */

window.UI = window.UI || {};

(function () {
  const CFG = () => window.GameConfig.view.clouds;

  // Each entry: { sprite, x, y, speedMult }. x/y are the cloud's position in
  // the layer's own drifting space -- parallax and wrapping are applied at
  // draw time (see render), never baked into these, so a pan can't
  // permanently displace a cloud.
  let clouds = [];
  let lastFrameMs = null;
  // Seconds of elapsed drift. Drives the wind-angle sine below; kept
  // separate from wall-clock time so a paused/backgrounded tab resumes
  // smoothly instead of jumping (see render's dt clamp).
  let elapsed = 0;

  // Cached edge-band mask (see ensureMask). Depends only on canvas size, so
  // it's rebuilt on resize rather than every frame.
  let maskCanvas = null;
  let maskW = 0, maskH = 0;

  function randRange(min, max) { return min + Math.random() * (max - min); }

  /** Smooth 0..1 ramp -- softer than a linear fade, so the band's inner
   *  edge has no visible banding or hard start. */
  function smoothstep(t) {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  }

  /**
   * Builds (and caches) the mask that confines clouds to a band around the
   * outer edge of the view, leaving the middle clear -- see
   * GameConfig.view.clouds.bandFraction/bandFeather.
   *
   * The mask's ALPHA is "how much to erase": 0 out at the very edge (clouds
   * fully visible), ramping to 1 by the inner boundary of the band (clouds
   * fully erased) and staying 1 across the whole middle. render() applies it
   * with one destination-out drawImage.
   *
   * SHAPE: distance is measured with a p-norm on viewport-normalized
   * coordinates -- q = (|nx|^p + |ny|^p)^(1/p), where nx/ny run -1..1 across
   * the view. q = 0 at the centre and q = 1 on the rounded-rect boundary
   * that touches the edge midpoints; the four corners sit further out
   * (q = 2^(1/p)), so they end up fully clouded, which is what closes the
   * frame.
   *
   * A simpler min(dx, dy) distance metric would be continuous in value but
   * kinked in its DERIVATIVE along the diagonal out of each corner, which
   * the eye reads as a hard line even though no pixel-to-pixel jump exists.
   * The p-norm is smooth everywhere, so there is no seam to see. See
   * GameConfig.view.clouds.bandShape for the exponent.
   *
   * Built per-pixel, which is fine because it only happens on a resize, not
   * per frame.
   */
  function ensureMask(w, h) {
    if (maskCanvas && maskW === w && maskH === h) return maskCanvas;
    const cfg = CFG();
    // Band depth measured from the boundary inward, in normalized
    // half-extents: bandFraction is a share of the FULL dimension, and the
    // normalized axis spans half of it, hence the doubling.
    const band = Math.max(0.001, cfg.bandFraction * 2);
    const feather = Math.min(0.999, Math.max(0, cfg.bandFeather));
    // Where within the band the fade starts (0 = the whole band is a
    // gradient; higher = clouds hold full strength further inward).
    const holdUntil = 1 - feather;
    const p = Math.max(2, cfg.bandShape || 4);

    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(w, h);
    const data = img.data;

    for (let y = 0; y < h; y++) {
      const ny = Math.abs((y / (h - 1)) * 2 - 1); // 0 centre .. 1 top/bottom edge
      const nyp = Math.pow(ny, p);
      for (let x = 0; x < w; x++) {
        const nx = Math.abs((x / (w - 1)) * 2 - 1); // 0 centre .. 1 left/right edge
        const q = Math.pow(Math.pow(nx, p) + nyp, 1 / p);
        // Distance inward from the boundary. Negative outside it (the
        // corners), clamped to 0 so they read as fully cloudy.
        const inward = Math.max(0, 1 - q);
        const t = inward / band; // 0 at the boundary, 1 at the band's inner edge
        let erase;
        if (t <= holdUntil) erase = 0;              // outermost: full clouds
        else if (t >= 1) erase = 1;                 // middle: no clouds
        else erase = smoothstep((t - holdUntil) / (1 - holdUntil));
        data[(y * w + x) * 4 + 3] = Math.round(erase * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    maskCanvas = c; maskW = w; maskH = h;
    return c;
  }

  /**
   * One cloud sprite: a cluster of overlapping soft radial puffs on a
   * transparent offscreen canvas, with the alpha baked in at full strength
   * -- the final on-screen opacity is applied once via globalAlpha at draw
   * time, so one knob controls it.
   *
   * SHAPE: four things keep this from reading as a barbell (two fat lobes
   * with a thin waist), which is what a naive puff placement tends to
   * produce:
   *
   *   1. Spread is a PER-CLOUD span (spreadX/spreadY), independent of any
   *      individual puff's radius.
   *   2. Puff size FALLS OFF toward the edges -- a fat core with smaller
   *      puffs trailing off it, the way real cumulus reads.
   *   3. Placement is biased toward the centre (|t| = rand^1.7) rather
   *      than spread evenly, so there's a dense middle instead of an even
   *      smear that reads as two ends.
   *   4. Aspect ratio, puff count and vertical taper are all randomized
   *      per cloud, so no two silhouettes match.
   */
  function makeCloudSprite() {
    const cfg = CFG();
    const puffCount = Math.round(randRange(cfg.puffsPerCloud[0], cfg.puffsPerCloud[1]));

    // Per-cloud silhouette, randomized independently of puff sizes: some
    // clouds long and low, others short and stacked.
    const spreadX = randRange(70, 165);
    // How much smaller the end puffs are than the middle ones -- this is
    // what gives the classic tapered cumulus profile.
    const taper = randRange(0.25, 0.5);
    const baseR = randRange(cfg.puffRadius[0], cfg.puffRadius[1]);
    // Jitter on the flat base, as a fraction of puff radius. Small: too
    // much and the "sitting on one line" read is lost.
    const baseJitter = baseR * randRange(0.06, 0.16);

    const puffs = [];
    for (let i = 0; i < puffCount; i++) {
      // EVENLY distributed along the span (plus sub-slot jitter) rather
      // than randomly placed -- random placement leaves gaps that read as
      // separate floating balls, and isolated outliers that read as specks;
      // even spacing guarantees neighbouring puffs always overlap into one
      // continuous mass.
      const slot = (i + 0.5) / puffCount;          // 0..1 across the cloud
      const jitter = randRange(-0.4, 0.4) / puffCount;
      const t = Math.max(-1, Math.min(1, (slot + jitter) * 2 - 1)); // -1..1
      // Quadratic falloff -- stays near full size across the middle, then
      // drops off only near the ends. Linear made clouds look wedge-shaped.
      const falloff = 1 - (t * t) * taper;
      const px = t * spreadX;
      const r = baseR * falloff * randRange(0.82, 1.12);
      // FLAT BASE: every puff's BOTTOM sits on roughly the same line, so
      // bigger puffs bulge upward and the silhouette gets a lumpy crown
      // over a level underside -- the shape that actually reads as a cloud
      // rather than a handful of balls thrown in the air.
      const py = -r + randRange(-baseJitter, baseJitter);
      puffs.push({ px, py, r });
    }

    // A few extra puffs piled on top of the middle, so the crown is lumpy
    // rather than a smooth arc. Sized down and kept well inside the span so
    // they always overlap the body beneath them.
    const crownCount = Math.round(randRange(2, 4));
    for (let i = 0; i < crownCount; i++) {
      const t = randRange(-0.55, 0.55);
      const r = baseR * randRange(0.45, 0.7);
      puffs.push({
        px: t * spreadX,
        py: -baseR * randRange(1.15, 1.5) - r * 0.15,
        r,
      });
    }

    // Tight bounding box around the actual puffs (rather than a square sized
    // to the worst-case extent), so sprites aren't mostly empty canvas and
    // drawImage's centring lines up with the visible mass.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of puffs) {
      minX = Math.min(minX, p.px - p.r); maxX = Math.max(maxX, p.px + p.r);
      minY = Math.min(minY, p.py - p.r); maxY = Math.max(maxY, p.py + p.r);
    }
    const pad = 4;
    const width = Math.ceil(maxX - minX) + pad * 2;
    const height = Math.ceil(maxY - minY) + pad * 2;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const ox = -minX + pad, oy = -minY + pad;

    for (const p of puffs) {
      const x = ox + p.px, y = oy + p.py;
      // Mostly-solid core with the falloff concentrated at the RIM: a
      // gradient that fades steadily from the centre makes every puff read
      // as its own distinct disc and leaves visible density lumps wherever
      // two overlap. Holding near-full alpha out to ~70% of the radius
      // means the union of overlapping puffs reads as ONE soft-edged mass.
      const peak = randRange(0.5, 0.6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, p.r);
      g.addColorStop(0, `rgba(255,255,255,${peak.toFixed(3)})`);
      g.addColorStop(0.7, `rgba(255,255,255,${(peak * 0.92).toFixed(3)})`);
      g.addColorStop(0.88, `rgba(255,255,255,${(peak * 0.45).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sky-lit top / shadowed underside: a vertical tint from white at the
    // sprite's top to a light grey at its bottom. `source-atop` confines it
    // to pixels the puffs above already painted, so it shades the cloud's
    // own silhouette rather than washing a rectangle over the transparent
    // canvas around it.
    ctx.globalCompositeOperation = "source-atop";
    const shade = ctx.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, "rgba(255,255,255,1)");
    shade.addColorStop(1, "rgba(198,200,206,1)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";

    // Faint edge tint, to help define cloud shape -- most clouds get none;
    // the rest get exactly one of the three tints, never more than one. Each
    // puff's own rim gradient fades to 0 alpha exactly at its radius
    // (matching the puff's own edge), so this can't spill a colored halo
    // past where the cloud already is.
    const rimRoll = Math.random();
    if (rimRoll < 0.35) {
      // Three equal slices of the [0, 0.35) band: pale orange / pale blue /
      // pale pink, each with the same ~11.7% overall chance.
      const rimColor = rimRoll < 0.35 / 3 ? "255,214,178" // pale orange
        : rimRoll < (0.35 / 3) * 2 ? "182,212,255"        // pale blue
        : "255,200,220";                                   // pale pink
      for (const p of puffs) {
        const x = ox + p.px, y = oy + p.py;
        const rim = ctx.createRadialGradient(x, y, p.r * 0.75, x, y, p.r);
        rim.addColorStop(0, `rgba(${rimColor},0)`);
        rim.addColorStop(0.85, `rgba(${rimColor},0.07)`);
        rim.addColorStop(1, `rgba(${rimColor},0)`);
        ctx.fillStyle = rim;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return canvas;
  }

  /**
   * Public: build the cloud set. Called once per game start (main.js).
   * `width`/`height` are the map canvas's current pixel size -- only used to
   * scatter the initial positions across a plausible area; clouds wrap
   * independently of it afterward, so a later resize needs no re-init.
   */
  function init(width, height) {
    const cfg = CFG();
    clouds = [];
    const w = Math.max(1, width || 1200);
    const h = Math.max(1, height || 800);
    for (let i = 0; i < cfg.count; i++) {
      clouds.push({
        // A unique sprite per cloud, generated fresh rather than drawn from
        // a small shared pool -- generation is a one-time cost at game
        // start, so per-cloud uniqueness is essentially free.
        sprite: makeCloudSprite(),
        // Spread across a span wider than the viewport so clouds are
        // already staggered off both edges at turn 0 rather than all
        // marching in from the left together.
        x: randRange(-w * 0.5, w * 1.5),
        y: randRange(-h * 0.2, h * 1.1),
        speedMult: randRange(0.75, 1.35),
      });
    }
    lastFrameMs = null;
    elapsed = 0;
  }

  /**
   * Public: advance and draw one frame. Called from main.js's existing rAF
   * loop, right after the map itself is rendered.
   *
   * `viewState` is read ONLY for scrollX/scrollY (the parallax offset) --
   * nothing here mutates it.
   */
  function render(canvas, viewState) {
    if (!canvas || !clouds.length) return;
    const ctx = canvas.getContext("2d");
    const cfg = CFG();
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;

    // --- advance drift ------------------------------------------------
    const now = performance.now();
    // First frame has no previous timestamp; a backgrounded tab can return
    // a huge gap. Clamp both so clouds never teleport across the screen.
    const dt = lastFrameMs === null ? 0 : Math.min(0.1, (now - lastFrameMs) / 1000);
    lastFrameMs = now;
    elapsed += dt;

    // Shared wind: constant left->right, plus a very slow sine on the
    // vertical component so the ANGLE wanders over minutes rather than
    // holding one fixed diagonal forever.
    const vy = Math.sin((elapsed / cfg.angleDriftPeriod) * Math.PI * 2) * cfg.angleDriftSpeed;
    for (const c of clouds) {
      c.x += cfg.driftSpeed * c.speedMult * dt;
      c.y += vy * c.speedMult * dt;
    }

    // --- draw ----------------------------------------------------------
    ctx.clearRect(0, 0, w, h);

    // Parallax: clouds follow the map's scroll only fractionally, so panning
    // moves them slower than the ground -- the cue that reads as "high
    // above". Deliberately NOT scaled by zoomLevel: distant sky should keep
    // a consistent on-screen size rather than ballooning when zoomed in.
    const offX = -(viewState.scrollX || 0) * cfg.parallax;
    const offY = -(viewState.scrollY || 0) * cfg.parallax;

    ctx.globalAlpha = cfg.opacity;
    for (const c of clouds) {
      const sw = c.sprite.width, sh = c.sprite.height;
      // Wrap in a band one viewport-plus-one-sprite wide, computed fresh
      // each frame from the CURRENT position+parallax. Wrapping the drawn
      // coordinate (rather than mutating c.x) keeps a cloud's underlying
      // drift continuous, so panning can't make one pop or double back.
      const span = w + sw * 2;
      let dx = c.x + offX;
      dx = ((((dx + sw) % span) + span) % span) - sw;
      let dy = c.y + offY;
      const spanY = h + sh * 2;
      dy = ((((dy + sh) % spanY) + spanY) % spanY) - sh;
      ctx.drawImage(c.sprite, dx - sw / 2, dy - sh / 2);
    }
    ctx.globalAlpha = 1;

    // --- confine to the outer band -------------------------------------
    // destination-out erases what's already painted -- clouds only, since
    // this canvas holds nothing else. The cached mask is 0 (no erase) at
    // the window edge and 1 (full erase) across the middle, so whatever
    // drifted into the centre is cleared and the play area stays clean.
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(ensureMask(w, h), 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  window.UI.clouds = { init, render };
})();
