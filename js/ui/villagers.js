/**
 * AMBIENT VILLAGER FIGURES (2026-08-07, user-directed)
 * -------------------------------------------------------
 * Tiny, deliberately race-neutral figures that occasionally spawn at a
 * city's own tile or one of its structures' tiles, walk in a straight line
 * to a different one of those points, pause briefly, then fade out and
 * disappear. Pure atmosphere, drawn as two plain filled shapes rather than
 * sprite art -- there's no race identity to leak that way, matching this
 * session's other small procedural-canvas cosmetics (the death effect, the
 * construction placeholder, the idle-city badge).
 *
 * PURELY COSMETIC, same guarantee clouds.js documents for itself: no game
 * state is ever mutated, and nothing here triggers its own redraw --
 * render.js's own per-frame call (from main.js's existing rAF loop) is what
 * drives tick()/draw() forward. 2D-only, no 3D parity pass, same call this
 * session already made for the construction placeholder and the idle-city
 * badge (the 3D renderer's per-tile draws go through their own separate
 * projection loop, and this is a nice-to-have, not core gameplay).
 */
window.UI = window.UI || {};

(function () {
  const WALK_SECONDS_PER_TILE = [2.5, 5]; // scaled by leg distance below
  const PAUSE_SECONDS = [1, 3];
  const FADE_SECONDS = 0.6;
  const SPAWN_INTERVAL_SECONDS = [18, 40];
  const MAX_PER_CITY = 1;

  function randRange(min, max) { return min + Math.random() * (max - min); }

  let figures = [];
  // City object identity -> elapsed-time of its next spawn roll. A WeakMap
  // so a destroyed city's entry is garbage-collected instead of leaking.
  let nextSpawnAt = new WeakMap();
  let elapsed = 0;
  let lastFrameMs = null;

  /** Every point a figure could walk to/from: the city's own tile plus each
   *  of its structures' tiles (already-placed, real board positions -- see
   *  cities.js's placeStructure). Fewer than 2 points means there's nowhere
   *  to walk yet (a brand-new city with nothing built), so callers treat
   *  that as "don't spawn here". */
  function waypointsFor(city) {
    const pts = [{ x: city.x, y: city.y }];
    for (const s of city.structures) pts.push({ x: s.x, y: s.y });
    return pts;
  }

  function countFor(city) {
    let n = 0;
    for (const f of figures) if (f.city === city) n++;
    return n;
  }

  function spawnFor(city, civ) {
    const pts = waypointsFor(city);
    if (pts.length < 2) return;
    const a = pts[Math.floor(Math.random() * pts.length)];
    let b = a;
    for (let tries = 0; tries < 5 && b === a; tries++) {
      const candidate = pts[Math.floor(Math.random() * pts.length)];
      if (candidate.x !== a.x || candidate.y !== a.y) b = candidate;
    }
    if (b === a) return; // every point happened to roll the same tile -- skip this cycle
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    figures.push({
      city, civ, ax: a.x, ay: a.y, bx: b.x, by: b.y,
      walkDur: randRange(WALK_SECONDS_PER_TILE[0], WALK_SECONDS_PER_TILE[1]) * Math.max(0.5, dist),
      pauseDur: randRange(PAUSE_SECONDS[0], PAUSE_SECONDS[1]),
      age: 0,
      phase: randRange(0, Math.PI * 2), // bob offset so figures don't bounce in sync
      state: "walking",
    });
  }

  /** Advances spawn timers and every active figure. Computes its own dt
   *  from performance.now() (same convention clouds.js's render() uses)
   *  rather than asking the caller for one, so render.js's call site stays
   *  a plain "tick, then draw" pair. `visibleCities` is an array of
   *  {civ, city} the caller has already filtered to what's currently
   *  on-screen and visible -- spawning is skipped anywhere the player can't
   *  currently see, so a figure never "was already there" the instant a
   *  fogged city comes back into view. */
  function tick(visibleCities) {
    const now = performance.now();
    const dt = lastFrameMs === null ? 0 : Math.min(0.1, (now - lastFrameMs) / 1000);
    lastFrameMs = now;
    elapsed += dt;

    for (const { civ, city } of visibleCities) {
      if (!nextSpawnAt.has(city)) {
        nextSpawnAt.set(city, elapsed + randRange(SPAWN_INTERVAL_SECONDS[0], SPAWN_INTERVAL_SECONDS[1]));
      }
      if (elapsed >= nextSpawnAt.get(city) && countFor(city) < MAX_PER_CITY) {
        spawnFor(city, civ);
        nextSpawnAt.set(city, elapsed + randRange(SPAWN_INTERVAL_SECONDS[0], SPAWN_INTERVAL_SECONDS[1]));
      }
    }

    for (const f of figures) {
      f.age += dt;
      if (f.state === "walking" && f.age >= f.walkDur) { f.state = "pausing"; f.age = 0; }
      else if (f.state === "pausing" && f.age >= f.pauseDur) { f.state = "fading"; f.age = 0; }
      else if (f.state === "fading" && f.age >= FADE_SECONDS) { f.state = "done"; }
    }
    figures = figures.filter((f) => f.state !== "done");
  }

  /** Draws every active figure whose city is in `visibleCities` (the same
   *  filtered list passed to tick()) -- affine offsetX/offsetY/ts tile
   *  grid, same convention every other 2D-only per-tile cosmetic here
   *  uses. A tiny round head over an oval torso, with thin swinging
   *  arm/leg strokes while walking -- shrunk to half its previous core
   *  size (2026-08-07, user-reported "look sort of like little pegs") and
   *  given actual limbs so the silhouette alone (even before the swing
   *  animation) no longer reads as a blob. Legs and arms swing in a
   *  natural alternating gait (each arm opposite its same-side leg) driven
   *  by the same per-figure `phase` the old bob used, frozen to a neutral
   *  standing pose (swing = 0) whenever the figure isn't actively walking.
   *
   *  Head and limbs stay a flat neutral tone (no race identity there --
   *  shape alone still reads as "kingdom-neutral", can't-tell-if-human-elf-
   *  orc), but the torso/"clothes" ellipse is tinted with the owning civ's
   *  race color (2026-08-07, user-directed), same
   *  window.GameData.getRace(...).color + overlays.hexToRgba(...) pairing
   *  the influence overlay and the city fallback-circle rendering already
   *  use -- so a glance at a wandering figure's colour says whose city
   *  it's in, same as everything else on the map that's already
   *  colour-coded by civ.
   */
  function draw(ctx, offsetX, offsetY, ts, visibleCities) {
    if (!figures.length) return;
    const visibleCitySet = new Set(visibleCities.map(({ city }) => city));
    for (const f of figures) {
      if (!visibleCitySet.has(f.city)) continue;
      const t = f.state === "walking" ? Math.min(1, f.age / f.walkDur) : 1;
      const tx = f.ax + (f.bx - f.ax) * t;
      const ty = f.ay + (f.by - f.ay) * t;
      const px = tx * ts + offsetX + ts / 2;
      const py = ty * ts + offsetY + ts / 2;

      const alpha = f.state === "fading" ? Math.max(0, 1 - f.age / FADE_SECONDS) : 1;
      const walking = f.state === "walking";
      const bob = walking ? Math.sin(f.age * 8 + f.phase) * ts * 0.04 : 0;
      // Gait cycle: -1..1, each arm swinging opposite its same-side leg
      // (real walking, not both limbs on one side moving together).
      // Frozen at 0 (a neutral standing pose, limbs together) outside the
      // walking state, so a paused/fading figure doesn't hold a mid-stride
      // pose. Halved from 0.13 (2026-08-07, user-reported too peg-like).
      const swing = walking ? Math.sin(f.age * 10 + f.phase) : 0;
      const r = Math.max(1, ts * 0.065);
      const race = window.GameData.getRace(f.civ.raceId);
      const bodyColor = window.UI.overlays.hexToRgba(race.color, 0.85);
      const limbColor = "rgba(255,248,230,0.75)";

      const headCenterY = py - r * 0.5 + bob;
      const shoulderY = py - r * 0.8 + bob;
      const hipY = py + r * 0.1 + bob;
      const limbEndY = py + r * 1.1 + bob;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = "round";
      ctx.strokeStyle = limbColor;
      ctx.lineWidth = Math.max(0.6, r * 0.35);
      // Legs (from the hip) -- opposite-phase swing.
      ctx.beginPath();
      ctx.moveTo(px, hipY);
      ctx.lineTo(px + swing * r * 0.9, limbEndY);
      ctx.moveTo(px, hipY);
      ctx.lineTo(px - swing * r * 0.9, limbEndY);
      ctx.stroke();
      // Arms (from the shoulder) -- opposite the same-side leg.
      ctx.beginPath();
      ctx.moveTo(px, shoulderY);
      ctx.lineTo(px - swing * r * 0.8, shoulderY + r * 1.1);
      ctx.moveTo(px, shoulderY);
      ctx.lineTo(px + swing * r * 0.8, shoulderY + r * 1.1);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,248,230,0.55)";
      ctx.lineWidth = Math.max(0.5, r * 0.12);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(px, py + r * 0.6 + bob, r * 0.7, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(40,35,30,0.85)";
      ctx.beginPath();
      ctx.arc(px, headCenterY, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  window.UI.villagers = { tick, draw };
})();
