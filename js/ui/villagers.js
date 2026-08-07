/**
 * AMBIENT VILLAGER FIGURES (2026-08-07, user-directed)
 * -------------------------------------------------------
 * Tiny figures that occasionally spawn at a city's own tile or one of its
 * structures' tiles, wander along a gently-curved, variable-paced path to a
 * different one of those points, pause briefly, then fade out and
 * disappear. Pure atmosphere, drawn as plain filled shapes rather than
 * sprite art, matching this session's other small procedural-canvas
 * cosmetics (the death effect, the construction placeholder, the idle-city
 * badge).
 *
 * Head and arms are tinted with a race-appropriate skin tone (picked once
 * per figure at spawn, from a small per-race palette); the torso/"clothes"
 * stays tinted with the owning civ's race color, same as before. Undead
 * isn't called out with its own palette in the user's spec, so it falls
 * back to the same human-tone palette humans/elves/dwarves/halfellows use.
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
  const PAUSE_SECONDS = [1, 3];
  const FADE_SECONDS = 0.6;
  const SPAWN_CHANCE_PER_STRUCTURE = 0.05; // rolled once per structure, per tick's spawn-check window
  const SPAWN_CHECK_INTERVAL_SECONDS = 6; // how often each city's structures roll their spawn chance
  const MAX_PER_CITY = 6; // safety cap so a huge city can't flood the screen
  const BASE_SPEED_RANGE = [0.16, 0.3]; // tiles/second baseline pace, before the per-figure variable-speed wobble

  // Orc: olive green / brown / green. Everyone else (human, elf, dwarf,
  // halfellow, and undead as an unspecified fallback): human skin tones.
  const SKIN_TONES = {
    orc: ["#6b8e23", "#7b5233", "#4f7942"],
    default: ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"],
  };

  function randRange(min, max) { return min + Math.random() * (max - min); }

  let figures = [];
  // City object identity -> elapsed-time of its next spawn-chance roll. A
  // WeakMap so a destroyed city's entry is garbage-collected instead of
  // leaking.
  let nextRollAt = new WeakMap();
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

  function skinToneFor(civ) {
    const palette = SKIN_TONES[civ.raceId] || SKIN_TONES.default;
    return palette[Math.floor(Math.random() * palette.length)];
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

    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.max(0.0001, Math.hypot(dx, dy));
    // A single perpendicular-offset control point bends the straight A->B
    // line into a gentle curve (a quadratic bezier) so the walk reads as a
    // semi-random wander rather than a ruler-straight commute.
    const perpX = -dy / dist, perpY = dx / dist;
    const bend = randRange(-0.4, 0.4) * Math.max(dist, 0.6);
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;

    figures.push({
      city, civ,
      ax: a.x, ay: a.y, bx: b.x, by: b.y,
      cx: midX + perpX * bend, cy: midY + perpY * bend,
      dist,
      t: 0,
      speed: randRange(BASE_SPEED_RANGE[0], BASE_SPEED_RANGE[1]),
      speedPhase: randRange(0, Math.PI * 2), // per-figure variable-pace offset
      pauseDur: randRange(PAUSE_SECONDS[0], PAUSE_SECONDS[1]),
      age: 0,
      phase: randRange(0, Math.PI * 2), // limb-swing offset so figures don't move in lockstep
      skinColor: skinToneFor(civ),
      state: "walking",
    });
  }

  function bezierPoint(f) {
    const t = f.t, mt = 1 - t;
    return {
      x: mt * mt * f.ax + 2 * mt * t * f.cx + t * t * f.bx,
      y: mt * mt * f.ay + 2 * mt * t * f.cy + t * t * f.by,
    };
  }

  /** Advances spawn rolls and every active figure. Computes its own dt
   *  from performance.now() (same convention clouds.js's render() uses)
   *  rather than asking the caller for one, so render.js's call site stays
   *  a plain "tick, then draw" pair. `visibleCities` is an array of
   *  {civ, city} the caller has already filtered to what's currently
   *  on-screen and visible -- spawning is skipped anywhere the player can't
   *  currently see, so a figure never "was already there" the instant a
   *  fogged city comes back into view.
   *
   *  Each of a city's structures independently rolls its own small spawn
   *  chance every SPAWN_CHECK_INTERVAL_SECONDS, rather than one shared
   *  per-city timer -- so a city with many structures looks busier than a
   *  small one, purely from having more rolls, not a higher per-roll
   *  chance. */
  function tick(visibleCities) {
    const now = performance.now();
    const dt = lastFrameMs === null ? 0 : Math.min(0.1, (now - lastFrameMs) / 1000);
    lastFrameMs = now;
    elapsed += dt;

    for (const { civ, city } of visibleCities) {
      if (!nextRollAt.has(city)) {
        nextRollAt.set(city, elapsed + SPAWN_CHECK_INTERVAL_SECONDS);
      }
      if (elapsed >= nextRollAt.get(city)) {
        nextRollAt.set(city, elapsed + SPAWN_CHECK_INTERVAL_SECONDS);
        if (countFor(city) < MAX_PER_CITY) {
          for (const s of city.structures) {
            if (countFor(city) >= MAX_PER_CITY) break;
            if (Math.random() < SPAWN_CHANCE_PER_STRUCTURE) spawnFor(city, civ);
          }
        }
      }
    }

    for (const f of figures) {
      f.age += dt;
      if (f.state === "walking") {
        // Variable pace: a smooth, always-positive multiplier on the base
        // speed so the figure speeds up and slows down over the course of
        // the walk instead of gliding at a constant rate. No vertical bob
        // is applied anywhere -- the figure's Y position is purely the
        // path position below.
        const speedMult = 0.6 + 0.6 * (0.5 + 0.5 * Math.sin(f.age * 2.1 + f.speedPhase));
        f.t = Math.min(1, f.t + (dt * f.speed * speedMult) / Math.max(0.5, f.dist));
        if (f.t >= 1) { f.state = "pausing"; f.age = 0; }
      } else if (f.state === "pausing" && f.age >= f.pauseDur) { f.state = "fading"; f.age = 0; }
      else if (f.state === "fading" && f.age >= FADE_SECONDS) { f.state = "done"; }
    }
    figures = figures.filter((f) => f.state !== "done");
  }

  /** Draws every active figure whose city is in `visibleCities` (the same
   *  filtered list passed to tick()) -- affine offsetX/offsetY/ts tile
   *  grid, same convention every other 2D-only per-tile cosmetic here uses.
   *
   *  Shape (2026-08-07 redesign): a thin rounded-rectangle torso (in the
   *  civ's race color) with legs anchored to points along its bottom edge
   *  -- not a floating hip point below an oval -- and arms anchored to its
   *  top corners. A round head sits above the torso with a small black
   *  oval "hair" patch in its upper half. Head and arms are tinted with a
   *  race-appropriate skin tone picked once per figure at spawn (see
   *  SKIN_TONES above); legs stay a neutral light tone (trousers/boots).
   *  No vertical bob while walking -- only the path position and the
   *  limb-swing animation move. 25% smaller than this session's previous
   *  size pass. */
  function draw(ctx, offsetX, offsetY, ts, visibleCities) {
    if (!figures.length) return;
    const visibleCitySet = new Set(visibleCities.map(({ city }) => city));
    for (const f of figures) {
      if (!visibleCitySet.has(f.city)) continue;
      const { x: tx, y: ty } = bezierPoint(f);
      const px = tx * ts + offsetX + ts / 2;
      const py = ty * ts + offsetY + ts / 2;

      const alpha = f.state === "fading" ? Math.max(0, 1 - f.age / FADE_SECONDS) : 1;
      const walking = f.state === "walking";
      const swing = walking ? Math.sin(f.age * 10 + f.phase) : 0;
      const r = Math.max(1, ts * 0.04875); // 0.065 * 0.75 -- 25% smaller

      const race = window.GameData.getRace(f.civ.raceId);
      const bodyColor = window.UI.overlays.hexToRgba(race.color, 0.85);
      const skinColor = f.skinColor;
      const legColor = "rgba(235,225,205,0.8)";

      const bodyW = r * 1.1, bodyH = r * 2;
      const bodyTop = py - bodyH / 2;
      const bodyBottom = py + bodyH / 2;
      const bodyLeft = px - bodyW / 2;
      const bodyRight = px + bodyW / 2;
      const headCenterY = bodyTop - r * 0.45;
      const legLeftX = bodyLeft + bodyW * 0.25;
      const legRightX = bodyRight - bodyW * 0.25;
      const limbEndY = bodyBottom + r * 0.9;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = "round";

      // Legs -- anchored to the torso's bottom edge, swinging opposite phase.
      ctx.strokeStyle = legColor;
      ctx.lineWidth = Math.max(0.6, r * 0.32);
      ctx.beginPath();
      ctx.moveTo(legLeftX, bodyBottom);
      ctx.lineTo(legLeftX + swing * r * 0.5, limbEndY);
      ctx.moveTo(legRightX, bodyBottom);
      ctx.lineTo(legRightX - swing * r * 0.5, limbEndY);
      ctx.stroke();

      // Arms -- anchored to the torso's top corners, opposite the same-side leg.
      ctx.strokeStyle = skinColor;
      ctx.lineWidth = Math.max(0.6, r * 0.3);
      ctx.beginPath();
      ctx.moveTo(bodyLeft, bodyTop + r * 0.15);
      ctx.lineTo(bodyLeft - swing * r * 0.7, bodyTop + r * 1.25);
      ctx.moveTo(bodyRight, bodyTop + r * 0.15);
      ctx.lineTo(bodyRight + swing * r * 0.7, bodyTop + r * 1.25);
      ctx.stroke();

      // Torso -- thin rounded rectangle in the civ's race color.
      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = "rgba(255,248,230,0.5)";
      ctx.lineWidth = Math.max(0.5, r * 0.12);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bodyLeft, bodyTop, bodyW, bodyH, r * 0.35);
      else ctx.rect(bodyLeft, bodyTop, bodyW, bodyH);
      ctx.fill();
      ctx.stroke();

      // Head -- race-appropriate skin tone.
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(px, headCenterY, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hair -- small black oval in the upper half of the head.
      ctx.fillStyle = "rgba(12,10,10,0.9)";
      ctx.beginPath();
      ctx.ellipse(px, headCenterY - r * 0.22, r * 0.4, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  window.UI.villagers = { tick, draw };
})();
