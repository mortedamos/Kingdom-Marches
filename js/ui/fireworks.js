/**
 * VICTORY FIREWORKS
 * -----------------
 * Purely decorative celebration effect (2026-08-19, user-directed): a
 * handful of particle bursts, each at a random screen position, repeating
 * for as long as the victory message/stats screen stays up. Draws onto
 * #fireworks-canvas, a dedicated canvas living inside #game-dialog-overlay
 * (see index.html/style.css) -- entirely separate from the main game canvas
 * (render.js) and its own animation loop, so it has no interaction with
 * game state at all.
 *
 * Respects motion.js's reduced-motion preference like every other ambient/
 * decorative effect in this game (clouds, villagers, idle sprite cycling) --
 * start() is a no-op when isReduced() is true, so a reduced-motion player
 * just sees the plain dialog with no bursts at all rather than a jarring
 * flash of fast-moving particles.
 */
window.UI = window.UI || {};

(function () {
  // Kept deliberately gentle (2026-08-19, user-directed): a player reported
  // the effect reading as screen flashing, an explicit photosensitivity
  // safety concern. Fewer/slower/dimmer bursts and no pure white, plus the
  // resize fix below, are a direct response to that report -- do not tune
  // these back up toward "flashier" without re-checking that concern.
  const PARTICLE_COUNT = 18; // per burst
  const GRAVITY = 0.045; // px/frame^2, downward particle drift
  const PARTICLE_LIFETIME_MS = 1100;
  const FADE_IN_MS = 150; // gradual appearance instead of popping in at full brightness
  const MAX_ALPHA = 0.8; // never fully saturated/opaque
  const SPAWN_INTERVAL_MS = 900; // roughly one new burst this often
  const MAX_CONCURRENT_BURSTS = 3; // caps total particle count on a long-running screen
  const COLORS = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#f78c6b", "#a06cd5"];

  let canvas = null, ctx = null;
  let rafId = null;
  let bursts = []; // { particles: [{x,y,vx,vy,color,bornAt}] }
  let lastSpawnAt = 0;
  let running = false;

  /** Syncs the canvas's actual drawing-buffer size (canvas.width/height,
   *  distinct from its CSS layout size) to its parent overlay's current
   *  layout rect. Only reassigns width/height when they've actually
   *  changed -- setting canvas.width/height clears the whole buffer even
   *  to the same value. Called once (deferred past layout, see start())
   *  plus on window "resize" -- NOT every tick. An earlier version called
   *  this every frame to work around the overlay not being laid out yet
   *  the instant start() ran; that fixed the 1x1-canvas bug but introduced
   *  a worse one: getBoundingClientRect() returns slightly different
   *  sub-pixel values frame to frame, so Math.round() flips by a pixel
   *  often enough that canvas.width got reassigned on nearly every frame,
   *  fully clearing/repainting the buffer ~60x/sec -- a real flicker bug,
   *  reported by a player as screen flashing (photosensitivity concern).
   *  Deferring the one-time initial call past layout (see start()) fixes
   *  the original 1x1 problem without paying that cost every frame. */
  function resizeCanvas() {
    if (!canvas) return;
    const overlay = canvas.parentElement;
    const rect = overlay ? overlay.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  /** One burst: PARTICLE_COUNT particles radiating from (cx,cy) at random
   *  angles/speeds, each its own color drawn from COLORS. */
  function spawnBurst() {
    const cx = Math.random() * canvas.width;
    // Keep bursts in the upper 70% of the screen -- a burst centered near
    // the very bottom edge reads as cut off rather than exploding.
    const cy = Math.random() * canvas.height * 0.7;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const particles = [];
    const now = performance.now();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.3;
      const speed = 1.5 + Math.random() * 2.5;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() < 0.25 ? COLORS[Math.floor(Math.random() * COLORS.length)] : color,
        bornAt: now,
      });
    }
    bursts.push({ particles });
    if (bursts.length > MAX_CONCURRENT_BURSTS) bursts.shift();
  }

  function tick(now) {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (now - lastSpawnAt > SPAWN_INTERVAL_MS) {
      lastSpawnAt = now;
      spawnBurst();
    }

    bursts = bursts.filter((burst) => {
      let anyAlive = false;
      for (const p of burst.particles) {
        const age = now - p.bornAt;
        if (age > PARTICLE_LIFETIME_MS) continue;
        anyAlive = true;
        const t = age / 1000; // seconds, for gravity integration
        const px = p.x + p.vx * t * 60;
        const py = p.y + p.vy * t * 60 + 0.5 * GRAVITY * (t * 60) * (t * 60);
        // Ramp in gradually rather than popping in at full brightness, then
        // fade out for the rest of the lifetime -- avoids any abrupt
        // brightness jump that could read as a flash.
        const fadeIn = age < FADE_IN_MS ? age / FADE_IN_MS : 1;
        const fadeOut = Math.max(0, 1 - age / PARTICLE_LIFETIME_MS);
        ctx.globalAlpha = Math.min(fadeIn, fadeOut) * MAX_ALPHA;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      return anyAlive;
    });
    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(tick);
  }

  /** Starts the animation loop. Safe to call while already running (no-op).
   *  Skipped entirely under reduced motion (see this file's own doc
   *  comment) -- the dialog itself still shows normally either way. */
  function start() {
    if (running) return;
    if (window.UI.motion && window.UI.motion.isReduced()) return;
    canvas = document.getElementById("fireworks-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    canvas.style.display = "block";
    bursts = [];
    lastSpawnAt = 0;
    running = true;
    // Defer the initial resize two frames so the overlay (which just
    // flipped visible) has actually finished layout before we read its
    // rect -- see resizeCanvas()'s doc comment for why this can't just
    // happen synchronously here or every tick.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (running) resizeCanvas();
      });
    });
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    bursts = [];
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (canvas) canvas.style.display = "none";
  }

  window.addEventListener("resize", () => { if (running) resizeCanvas(); });

  window.UI.fireworks = { start, stop };
})();
