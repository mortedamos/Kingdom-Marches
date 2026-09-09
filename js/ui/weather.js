/**
 * WEATHER -- rain, and sometimes a thunderstorm.
 * ---------------------------------------------
 * Draws onto #map-weather, a full-viewport overlay sitting above the map and
 * above the drifting clouds. Rain is between the viewer and the world, so it
 * belongs in front of everything; putting it on its own canvas rather than
 * sharing the cloud layer also keeps this module and clouds.js from having to
 * agree about who clears what.
 *
 * PURELY COSMETIC. Nothing here mutates game state and nothing is serialized.
 * What the weather IS on a given turn is decided by the engine
 * (GameEngine.turns.weatherForTurn, derived from the map seed and the turn
 * number); this module only decides what that looks like. Same split the
 * day/night cycle uses, for the same reason: when a rule eventually wants to
 * care about rain, the engine and the renderer must not be able to disagree.
 *
 * NO FLASHING. Lightning is the obvious hazard in a feature like this -- a
 * real strike is precisely the strobe this project's photosensitivity rule
 * forbids. What ships is a soft bloom confined to the top of the viewport
 * with a slow rise, a hard minimum gap between strikes so they can never come
 * in a train, and a total shutdown under reduced motion. See config's
 * lightning block, where every value is a safety parameter rather than a
 * taste one.
 */
(function () {
  window.UI = window.UI || {};

  const cfg = () => (window.GameConfig.view.weather) || {};
  const reduced = () => !!(window.UI.motion && window.UI.motion.isReduced());

  // ---------------------------------------------------------------------
  // Settings (same shape as motion.js / daynight.js, including the
  // degrade-quietly persistence -- a sandboxed context still works, it just
  // doesn't remember the choice).
  // ---------------------------------------------------------------------
  const STORAGE_KEY = "roi_weather_settings";
  let enabled = true;
  let loaded = false;
  const listeners = [];

  function loadPersisted() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      enabled = typeof stored.enabled === "boolean" ? stored.enabled : cfg().enabled !== false;
    } catch (e) {
      enabled = cfg().enabled !== false;
      console.log("[weather] persistence unavailable, using in-memory default");
    }
    loaded = true;
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled })); } catch (e) { /* non-fatal */ }
  }
  function isEnabled() { if (!loaded) loadPersisted(); return enabled; }
  function setEnabled(v) {
    const next = !!v;
    if (next === enabled) return;
    enabled = next;
    persist();
    if (!enabled) { drops.length = 0; flash = null; audioTarget("none"); }
    for (const fn of listeners) { try { fn(enabled); } catch (e) { /* one bad listener can't break the rest */ } }
  }
  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const state = {
    /** 0-1 eased, what the sky is currently doing. The engine's answer is a
     *  per-TURN step; these ease toward it so weather arrives over a couple
     *  of seconds rather than appearing between one frame and the next. */
    rain: 0,
    storm: 0,
    /** The engine's unsmoothed answer, kept for readouts and for anything
     *  that wants the turn's truth rather than the animation. */
    target: { raining: false, storming: false, rain: 0, storm: 0, turnsLeft: 0 },
    /** How many drops are on screen. Exposed because it is the only honest
     *  way to check density from outside -- reading it off the canvas is
     *  confounded by the storm overcast darkening the background the drops
     *  are measured against. */
    dropCount: 0,
  };

  /** Session-only overrides for the tuning panel -- never persisted, never
   *  saved. `force` pins the weather so all three states can be looked at
   *  without waiting for the dice. */
  const tuning = { force: null, densityMul: 1 };
  function getTuning() { return tuning; }
  function setTuning(patch) { Object.assign(tuning, patch || {}); }

  function current() { return state; }
  /** True when there is anything at all to draw. */
  function isActive() { return isEnabled() && (state.rain > 0.002 || state.storm > 0.002); }

  let lastTurn = null;
  let lastForce = null;
  // tick() and render() each keep their OWN previous timestamp. Sharing one
  // silently zeroed render's dt: tick runs first each frame and would stamp
  // `now` before render ever read it, so the drops never fell and the audio
  // never faded. Two clocks, two consumers.
  let lastTickMs = null;
  let lastRenderMs = null;

  /**
   * Read the turn's weather and ease toward it. Called once per frame from
   * main.js's redraw, before render.
   */
  function tick(gameState) {
    if (!isEnabled()) { state.rain = 0; state.storm = 0; return; }
    const c = cfg();
    const turn = gameState ? (gameState.turnNumber || 0) : 0;
    const seed = gameState ? (gameState.seed || 0) : 0;

    // Releasing the tuning override has to re-read the engine even though the
    // turn hasn't changed. Without this the last forced value stays pinned as
    // the target forever -- "clear" left a forced storm running, because the
    // turn-changed test below is false and nothing else ever reassigns it.
    if (tuning.force !== lastForce) { lastForce = tuning.force; lastTurn = null; }

    if (tuning.force) {
      state.target = tuning.force === "storm"
        ? { raining: true, storming: true, rain: 1, storm: 1, turnsLeft: 99 }
        : tuning.force === "rain"
          ? { raining: true, storming: false, rain: 1, storm: 0, turnsLeft: 99 }
          : { raining: false, storming: false, rain: 0, storm: 0, turnsLeft: 0 };
    } else if (turn !== lastTurn) {
      state.target = window.GameEngine.turns.weatherForTurn(turn, seed);
      lastTurn = turn;
    }

    // Ease in real time toward the target. A fixed per-second rate rather
    // than a per-frame fraction, so the ramp takes the same wall-clock time
    // at 30fps as at 144.
    const now = performance.now();
    const dt = lastTickMs === null ? 0 : Math.min(0.1, (now - lastTickMs) / 1000);
    lastTickMs = now;
    const rate = 1000 / Math.max(1, c.audio ? c.audio.fadeMs : 2500);
    const step = dt * rate;
    state.rain += Math.max(-step, Math.min(step, (state.target.rain || 0) - state.rain));
    state.storm += Math.max(-step, Math.min(step, (state.target.storm || 0) - state.storm));
    if (Math.abs(state.rain - (state.target.rain || 0)) < 0.002) state.rain = state.target.rain || 0;
    if (Math.abs(state.storm - (state.target.storm || 0)) < 0.002) state.storm = state.target.storm || 0;

    audioTarget(state.storm > 0.35 ? "storm" : state.rain > 0.05 ? "rain" : "none");
  }

  // ---------------------------------------------------------------------
  // Rain
  //
  // Drops are pooled and recycled rather than allocated per frame, and the
  // pool is resized toward the density the current rain calls for a few at a
  // time -- so rain thickens and thins visibly instead of the whole curtain
  // appearing at once.
  // ---------------------------------------------------------------------
  const drops = [];

  function targetDropCount(w, h) {
    const c = cfg().rain;
    const mpx = (w * h) / 1e6;
    const base = (c.densityPerMpx || 0) * mpx * tuning.densityMul;
    const mul = 1 + (c.stormDensityMul - 1) * state.storm;
    return Math.round(base * state.rain * mul);
  }

  function spawnDrop(w, h, atTop) {
    const c = cfg().rain;
    const len = c.lengthPx[0] + Math.random() * (c.lengthPx[1] - c.lengthPx[0]);
    return {
      x: Math.random() * (w + h),      // extra width so slanted rain covers the left edge
      y: atTop ? -len - Math.random() * h * 0.2 : Math.random() * h,
      len,
      width: c.widthPx[0] + Math.random() * (c.widthPx[1] - c.widthPx[0]),
      alpha: c.alpha[0] + Math.random() * (c.alpha[1] - c.alpha[0]),
      speedMul: 0.85 + Math.random() * 0.3,
    };
  }

  function updateDrops(w, h, dt) {
    const c = cfg().rain;
    const want = targetDropCount(w, h);
    // Grow and shrink gradually -- a curtain of rain that popped into
    // existence would undo the whole point of easing `rain` at all.
    const delta = want - drops.length;
    const maxStep = Math.max(4, Math.ceil(Math.abs(delta) * 0.06));
    if (delta > 0) for (let i = 0; i < Math.min(delta, maxStep); i++) drops.push(spawnDrop(w, h, false));
    else if (delta < 0) drops.length = Math.max(0, drops.length - Math.min(-delta, maxStep));

    const angle = (c.angleDeg + (c.stormAngleDeg - c.angleDeg) * state.storm) * Math.PI / 180;
    const speed = c.speedPxPerSec * (1 + (c.stormSpeedMul - 1) * state.storm);
    const vx = Math.sin(angle) * speed;
    const vy = Math.cos(angle) * speed;
    for (const d of drops) {
      d.y += vy * d.speedMul * dt;
      d.x -= vx * d.speedMul * dt;
      if (d.y > h || d.x < -d.len * 2) {
        const fresh = spawnDrop(w, h, true);
        d.x = fresh.x; d.y = fresh.y; d.len = fresh.len;
        d.width = fresh.width; d.alpha = fresh.alpha; d.speedMul = fresh.speedMul;
      }
    }
    state.dropCount = drops.length;
    return { angle, speed };
  }

  // ---------------------------------------------------------------------
  // Lightning
  //
  // See the config block. The short version: slow rise, bounded peak,
  // confined to the top of the screen, hard minimum gap, off under reduced
  // motion. It is deliberately not convincing lightning.
  // ---------------------------------------------------------------------
  let flash = null;         // { startedAt, thunderAt, fired }
  let nextStrikeAt = 0;

  function updateLightning(now) {
    const L = cfg().lightning || {};
    if (!L.enabled || reduced() || state.storm <= 0.05) { flash = null; return 0; }

    if (!flash) {
      if (!nextStrikeAt) nextStrikeAt = now + (L.meanGapMs || 7000) * Math.random();
      if (now >= nextStrikeAt) {
        const d = cfg().audio.thunderDelayMs || (L.thunderDelayMs || [400, 2600]);
        const delay = d[0] + Math.random() * (d[1] - d[0]);
        flash = { startedAt: now, thunderAt: now + delay, fired: false };
        // Exponential-ish spacing, then clamped to the hard floor. The floor
        // is what guarantees a run of unlucky rolls can't produce a train of
        // flashes -- isolated slow brightenings are safe, repeated ones are
        // not, and that is not something to leave to chance.
        const gap = -(L.meanGapMs || 7000) * Math.log(1 - Math.random() * 0.95);
        nextStrikeAt = now + Math.max(L.minGapMs || 3200, gap);
      }
      if (!flash) return 0;
    }

    const rise = L.riseMs || 110, fall = L.fallMs || 460;
    const t = now - flash.startedAt;
    if (!flash.fired && now >= flash.thunderAt) {
      flash.fired = true;
      playThunder();
    }
    if (t > rise + fall) {
      // Hold the flash object until its thunder has been fired, so a strike
      // whose sound is still travelling isn't dropped on the floor.
      if (flash.fired) flash = null;
      return 0;
    }
    // Smoothstep both directions -- no linear edges, no corners.
    const smooth = (u) => u * u * (3 - 2 * u);
    const k = t < rise ? smooth(t / rise) : smooth(1 - (t - rise) / fall);
    return Math.max(0, k) * (L.peakAlpha || 0.3) * state.storm;
  }

  // ---------------------------------------------------------------------
  // Audio
  //
  // Rain is a continuous LOOP, which neither existing audio module provides:
  // sfx.js plays one-shots and music.js resolves loops by race and situation.
  // So this owns a small ambient channel of its own -- two crossfading
  // <audio> elements, one for rain and one for storm.
  //
  // None of these files exist yet. Every path here no-ops quietly when the
  // asset is missing, so the feature is silent rather than broken until the
  // clips are dropped in.
  // ---------------------------------------------------------------------
  const loops = {};             // key -> { el, want, have }
  let audioWanted = "none";
  let audioUnlocked = false;

  function clipUrl(key) { return `assets/sfx/${key}.mp3`; }

  function ensureLoop(key) {
    if (loops[key]) return loops[key];
    const el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.volume = 0;
    el.src = clipUrl(key);
    const entry = { el, want: 0, have: 0, ok: true };
    // A missing file is the expected state right now, not an error worth
    // shouting about -- see this section's own note.
    el.addEventListener("error", () => { entry.ok = false; }, { once: true });
    loops[key] = entry;
    return entry;
  }

  function audioTarget(which) {
    audioWanted = which;
  }

  /** Master gate: the game's own mute/volume settings win over anything here. */
  function audioAllowed() {
    const sfx = window.UI.sfx;
    if (!sfx) return false;
    if (typeof sfx.isMuted === "function" && sfx.isMuted()) return false;
    if (typeof sfx.isFocusSuspended === "function" && sfx.isFocusSuspended()) return false;
    return true;
  }

  function masterScale() {
    const sfx = window.UI.sfx;
    let v = 1;
    if (sfx && typeof sfx.getMasterVolume === "function") v *= sfx.getMasterVolume();
    if (sfx && typeof sfx.getSfxVolume === "function") v *= sfx.getSfxVolume();
    return v;
  }

  function updateAudio(dt) {
    const a = cfg().audio || {};
    const allowed = audioAllowed() && isEnabled();
    const scale = masterScale();
    const targets = {
      [a.rainLoop]: (allowed && audioWanted === "rain" ? (a.rainVolume || 0) : 0) * scale,
      [a.stormLoop]: (allowed && audioWanted === "storm" ? (a.stormVolume || 0) : 0) * scale,
    };
    const rate = dt * (1000 / Math.max(1, a.fadeMs || 2500));
    for (const key of Object.keys(targets)) {
      if (!key) continue;
      const want = targets[key];
      if (want <= 0 && !loops[key]) continue;      // never create a loop just to silence it
      const entry = ensureLoop(key);
      if (!entry.ok) continue;
      const delta = want - entry.have;
      entry.have += Math.max(-rate, Math.min(rate, delta));
      if (Math.abs(entry.have - want) < 0.005) entry.have = want;
      try {
        entry.el.volume = Math.max(0, Math.min(1, entry.have));
        if (entry.have > 0.001 && entry.el.paused && audioUnlocked) {
          const p = entry.el.play();
          if (p && p.catch) p.catch(() => { /* autoplay refused; try again next frame */ });
        } else if (entry.have <= 0.001 && !entry.el.paused) {
          entry.el.pause();
        }
      } catch (e) { entry.ok = false; }
    }
  }

  function playThunder() {
    const a = cfg().audio || {};
    if (!audioAllowed() || !isEnabled() || !audioUnlocked) return;
    const list = a.thunder || [];
    if (!list.length) return;
    const key = list[Math.floor(Math.random() * list.length)];
    try {
      const el = new Audio(clipUrl(key));
      el.volume = Math.max(0, Math.min(1, (a.thunderVolume || 0.7) * masterScale() * state.storm));
      const p = el.play();
      if (p && p.catch) p.catch(() => { /* missing clip or autoplay refused */ });
    } catch (e) { /* nothing to do; weather stays silent */ }
  }

  /** Browsers refuse audio until the user has interacted. main.js already
   *  gates the rest of the audio on a first gesture; this hooks the same
   *  moment. */
  function unlockAudio() { audioUnlocked = true; }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  function render(canvas, viewState) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.__cssW || canvas.width;
    const h = canvas.__cssH || canvas.height;
    if (!w || !h) return;

    const now = performance.now();
    const dt = lastRenderMs === null ? 0 : Math.min(0.1, (now - lastRenderMs) / 1000);
    lastRenderMs = now;
    updateAudio(dt);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!isActive()) { drops.length = 0; return; }
    ctx.setTransform(canvas.__dpr || 1, 0, 0, canvas.__dpr || 1, 0, 0);

    const c = cfg().rain;

    // --- overcast wash --------------------------------------------------
    const overAlpha = (c.overcastAlpha + (c.stormOvercastAlpha - c.overcastAlpha) * state.storm) * state.rain;
    if (overAlpha > 0.002) {
      ctx.save();
      ctx.globalAlpha = overAlpha;
      ctx.fillStyle = c.overcast;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // --- lightning ------------------------------------------------------
    // Drawn BEFORE the drops and confined to the top of the screen: this is
    // the sky brightening, not the ground. The gradient is fully transparent
    // by skyFraction down the viewport, so the play field the player is
    // reading never changes brightness.
    const L = cfg().lightning || {};
    const flashAlpha = updateLightning(now);
    if (flashAlpha > 0.002) {
      const reach = h * (L.skyFraction || 0.42);
      const g = ctx.createLinearGradient(0, 0, 0, reach);
      const rgb = hexRgb(L.color || "#cfe0ff");
      g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
      g.addColorStop(0.55, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`);
      g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, reach);
      ctx.restore();
    }

    // --- rain -----------------------------------------------------------
    // Reduced motion keeps the overcast and the darkening -- the weather is
    // still information -- but holds the drops still rather than removing
    // them, matching how clouds.js handles the same setting.
    const { angle } = updateDrops(w, h, reduced() ? 0 : dt);
    if (drops.length) {
      const dx = Math.sin(angle), dy = Math.cos(angle);
      ctx.save();
      ctx.strokeStyle = c.color;
      ctx.lineCap = "round";
      for (const d of drops) {
        ctx.globalAlpha = d.alpha * state.rain;
        ctx.lineWidth = d.width;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + dx * d.len, d.y - dy * d.len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function hexRgb(hex) {
    let s = String(hex).replace("#", "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function init() { if (!loaded) loadPersisted(); }

  window.UI.weather = {
    init, tick, render,
    isEnabled, setEnabled, onChange,
    current, isActive,
    getTuning, setTuning,
    unlockAudio,
  };
})();
