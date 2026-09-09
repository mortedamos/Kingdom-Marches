/**
 * DAY / NIGHT CYCLE -- world lighting
 * -----------------------------------
 * A 12-turn cycle (4 day, 2 twilight, 4 night, 2 dawn) that darkens and
 * cools the map at night, lets settlements light their windows, and gives
 * fire- and torch-bearing units their own pool of light.
 *
 * PURELY COSMETIC. Nothing here mutates game state, and nothing here is
 * serialized. The phase is DERIVED from gameState.turnNumber by the engine's
 * turns.phaseForTurn -- this module never decides what time it is, it only
 * decides what that looks like. That split is deliberate: it means an old
 * save loads with a correct phase and no migration, and it means a future
 * "night reduces vision" rule has exactly one place to read the time from.
 *
 * WHERE THIS DRAWS, AND WHY THERE
 * render.js calls drawWorldLighting between the villager pass and
 * drawPlannedPaths. That boundary darkens the WORLD -- terrain, cities,
 * structures, bridges, units, villagers -- while leaving path previews,
 * enemy reticles, the order preview, combat slashes, death effects, quip
 * bubbles, floating text and the selection marker at full brightness above
 * it. Those are feedback for something the player just did, not ambience;
 * dimming them would cost information. It's the same line motion.js already
 * draws when it declines to gate combat effects on reduced motion.
 *
 * THREE PASSES
 *   A. Darkness  -- a sheet of the phase tint with holes punched out of it
 *                   ("destination-out") wherever a light sits, so the ground
 *                   under a torch shows its true daylight colour.
 *   B. Emissive  -- the warm light itself, composited with "lighter".
 *   C. Windows   -- small crisp per-window dots, drawn straight onto the map.
 *
 * A and B share one offscreen buffer rendered at half resolution
 * (config's scratchScale). Soft radial falloff survives that invisibly and
 * it quarters the fill cost. Pass C bypasses it because a window dot is
 * ~3px at default zoom and would smear.
 *
 * FOG OF WAR IS RESPECTED TWICE
 * A light is only ever emitted if its source tile is in the caller's
 * `visible` set -- render.js's own passes already skip anything fogged, so
 * that falls out for free. On top of that, both scratch passes re-darken
 * every non-visible tile before blitting, so a light's FALLOFF can't spill
 * across the fog boundary and imply something is standing there. That second
 * step only walks tiles inside the bounding box of the lights actually on
 * screen, so a map with no lights on it costs nothing.
 *
 * NO FLASHING. Light flicker is small, slow, and pinned to a static value
 * under reduced motion; the turn-to-turn transition is an eased ramp, never
 * a step. The sky HOLDS for the whole of a turn and only moves when the turn
 * does, so nothing changes while the player is thinking.
 */
(function () {
  window.UI = window.UI || {};

  const cfg = () => window.GameConfig.view.dayNight;

  // ---------------------------------------------------------------------
  // Settings (shape copied from js/ui/motion.js, including its
  // try/catch-and-degrade-silently persistence -- sandboxed contexts still
  // work, they just don't remember the choice).
  // ---------------------------------------------------------------------
  const STORAGE_KEY = "roi_daynight_settings";
  let enabled = true;
  let loaded = false;
  const listeners = [];

  function loadPersisted() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (typeof stored.enabled === "boolean") enabled = stored.enabled;
      else enabled = cfg().enabledByDefault !== false;
    } catch (e) {
      enabled = cfg().enabledByDefault !== false;
      console.log("[daynight] persistence unavailable, using in-memory default");
    }
    loaded = true;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled }));
    } catch (e) {
      // Non-fatal -- see loadPersisted.
    }
  }

  function init() {
    if (!loaded) loadPersisted();
    // Lengths in the phase table must sum to the slot table's length, or the
    // cycle silently goes lopsided (a phase that never ends, or slots with
    // no phase). Shout at load rather than at 3am on turn 40.
    const c = cfg();
    const sum = c.phases.reduce((s, p) => s + p.turns, 0);
    if (sum !== c.slots.length) {
      console.error(
        `[daynight] config mismatch: phases sum to ${sum} turns but there are ` +
        `${c.slots.length} slot entries. The cycle will not line up.`);
    }
  }

  function isEnabled() { if (!loaded) loadPersisted(); return enabled; }

  function setEnabled(v) {
    const next = !!v;
    if (next === enabled) return;
    enabled = next;
    persist();
    for (const fn of listeners) { try { fn(enabled); } catch (e) { /* one bad listener can't break the rest */ } }
  }

  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }

  // ---------------------------------------------------------------------
  // Tuning overrides -- driven by the Interface menu's tuning panel. All of
  // these are session-only and never persisted or saved; they exist to make
  // "darker and bluer but units still readable" something you can dial in
  // while looking at it, rather than guess at and rebuild.
  // ---------------------------------------------------------------------
  const tuning = {
    /** null = follow the real turn. A number 0-11 pins the sky to that slot
     *  so all twelve can be inspected without ending twelve turns. */
    scrubSlot: null,
    darknessMul: 1.0,
    glowMul: 1.0,
    radiusMul: 1.0,
    /** Tints the world with "multiply" instead of "source-over". Multiply is
     *  more physically honest (it preserves bright highlights and deepens
     *  saturated colour) but crushes dark terrain badly at these alphas, so
     *  it is not the default. */
    multiply: false,
  };

  function getTuning() { return tuning; }
  function setTuning(patch) { Object.assign(tuning, patch || {}); }

  /** Restart the per-window stagger clock, so the whole dusk ripple plays
   *  again from the top without ending a turn. Tuning affordance only. */
  function replayRipple() { state.turnStartedAt = performance.now(); }

  // ---------------------------------------------------------------------
  // Phase state and easing
  // ---------------------------------------------------------------------
  const state = {
    slot: 0,
    phase: "day",
    label: "Day",
    phaseTurn: 1,
    phaseLength: 4,
    cycleIndex: 0,
    cycleLength: 12,
    /** Eased, currently-displayed values. */
    tint: "#000000",
    /** Hue the world is pushed toward -- see config's colorizeScale. */
    cool: "#1a3a8a",
    /** How hard to push toward `cool`, 0-1, eased from the slot table's own
     *  authored value (NOT derived from darkness -- see config). */
    colorize: 0,
    alpha: 0,
    /** 0-1: how deep this slot is relative to the deepest configured slot.
     *  Window and lamp brightness scale by this so lamps read as a subtle
     *  hint at first twilight and full strength at midnight. */
    darkness: 0,
    unitLightsAlpha: 0,
    /** When the current turn began, in performance.now() ms. Seeded far in
     *  the past so a freshly loaded game appears already settled rather than
     *  replaying the whole dusk ripple on load. */
    turnStartedAt: -1e9,
  };

  // Eased-from/eased-to, so a turn advance ramps rather than steps.
  let fromSlotCfg = null;
  let toSlotCfg = null;
  let easeStart = 0;
  let easeDur = 0;
  let lastSlot = null;
  let lastTurnNumber = null;

  function reduced() { return !!(window.UI.motion && window.UI.motion.isReduced()); }

  function slotConfig(slot) {
    const c = cfg();
    return c.slots[slot] || { tint: "#000000", alpha: 0, unitLights: false };
  }

  // Fixed reference, not the live max of the slot table -- see config's
  // darknessReferencePeak for why: retuning one slot's alpha must not
  // silently rescale every other slot's normalized darkness along with it.
  function peakAlpha() {
    const c = cfg();
    return c.darknessReferencePeak || c.slots.reduce((m, s) => Math.max(m, s.alpha || 0), 0) || 1;
  }

  /** "#rrggbb" -> [r,g,b]. Tolerates the 3-digit form. */
  function parseHex(hex) {
    let h = String(hex || "#000000").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mixHex(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    const r = Math.round(A[0] + (B[0] - A[0]) * t);
    const g = Math.round(A[1] + (B[1] - A[1]) * t);
    const bl = Math.round(A[2] + (B[2] - A[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  /** Smoothstep -- no linear kink at either end of the transition. */
  function ease(t) { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); }

  /**
   * Advance the eased sky toward whatever slot the turn number implies.
   * Called once per frame from render.js before anything else reads state.
   */
  function tick(now, turnNumber) {
    const c = cfg();
    const scrubbing = tuning.scrubSlot !== null && tuning.scrubSlot !== undefined;
    const info = window.GameEngine.turns.phaseForTurn(turnNumber || 0);

    const slot = scrubbing
      ? Math.max(0, Math.min(c.slots.length - 1, Math.round(tuning.scrubSlot)))
      : info.slot;

    // Scrubbing overrides the phase readout too, so the clock and the world
    // stay in agreement while a value is being dialled in.
    if (scrubbing) {
      const scrubInfo = phaseInfoForSlot(slot);
      state.phase = scrubInfo.phase;
      state.label = scrubInfo.label;
      state.phaseTurn = scrubInfo.phaseTurn;
      state.phaseLength = scrubInfo.phaseLength;
    } else {
      state.phase = info.phase;
      state.label = info.label;
      state.phaseTurn = info.phaseTurn;
      state.phaseLength = info.phaseLength;
    }
    state.cycleIndex = info.cycleIndex;
    state.cycleLength = info.cycleLength;

    // A real turn advance restarts the per-window stagger clock. Scrubbing
    // deliberately does NOT -- otherwise every nudge of the slider would
    // replay the ripple and you could never see the settled state.
    if (lastTurnNumber !== null && turnNumber !== lastTurnNumber) {
      state.turnStartedAt = now;
    }
    lastTurnNumber = turnNumber;

    if (slot !== lastSlot) {
      fromSlotCfg = lastSlot === null ? slotConfig(slot) : (toSlotCfg || slotConfig(lastSlot));
      toSlotCfg = slotConfig(slot);
      easeStart = now;
      // First frame of a session snaps; scrubbing snaps too, so dragging the
      // slider is responsive instead of chasing a 1.5s ramp.
      easeDur = (lastSlot === null || scrubbing)
        ? 0
        : (reduced() ? c.easeMsReduced : c.easeMs);
      lastSlot = slot;
    }

    state.slot = slot;

    const t = easeDur > 0 ? ease((now - easeStart) / easeDur) : 1;
    const from = fromSlotCfg || toSlotCfg;
    const to = toSlotCfg;

    const rawAlpha = (from.alpha || 0) + ((to.alpha || 0) - (from.alpha || 0)) * t;
    state.alpha = Math.max(0, Math.min(0.95, rawAlpha * tuning.darknessMul));
    // Interpolate in colour space too -- crossing from sunset amber to dusk
    // magenta by fading one over the other would go muddy through the middle.
    state.tint = mixHex(from.tint, to.tint, t);
    state.cool = mixHex(from.cool || to.cool, to.cool || from.cool, t);
    state.darkness = rawAlpha / peakAlpha();
    // Authored per slot rather than derived from darkness -- see config's
    // colorizeScale note for why those two had to be split apart.
    const fromCol = from.colorize || 0, toCol = to.colorize || 0;
    state.colorize = fromCol + (toCol - fromCol) * t;

    const fromLights = from.unitLights ? 1 : 0;
    const toLights = to.unitLights ? 1 : 0;
    state.unitLightsAlpha = fromLights + (toLights - fromLights) * t;
  }

  /** The phase a given slot belongs to, without needing a turn number. */
  function phaseInfoForSlot(slot) {
    const phases = cfg().phases;
    let cursor = 0;
    for (const p of phases) {
      if (slot < cursor + p.turns) {
        return { phase: p.id, label: p.label, phaseTurn: slot - cursor + 1, phaseLength: p.turns };
      }
      cursor += p.turns;
    }
    const last = phases[phases.length - 1];
    return { phase: last.id, label: last.label, phaseTurn: last.turns, phaseLength: last.turns };
  }

  /** Read-only snapshot for clouds.js, the clock widget and villagers.js. */
  function current() { return state; }

  /** Villager spawn multiplier for the current slot -- 0 at night. */
  function villagerActivity() {
    if (!isEnabled()) return 1;
    const table = cfg().villagerActivity || [];
    const v = table[state.slot];
    return typeof v === "number" ? v : 1;
  }

  /** True when the darkness pass would do anything at all. */
  function isActive() { return isEnabled() && state.alpha > 0.002; }

  // ---------------------------------------------------------------------
  // Deterministic hashing -- per-window schedules must be identical across
  // reloads and save/load, so they're derived from persisted values only
  // (tile coords, sprite id, window index, cycle index) and never from
  // Math.random or anything time-based.
  // ---------------------------------------------------------------------
  function hashInts(...vals) {
    let h = 2166136261 >>> 0; // FNV-1a offset basis
    for (const raw of vals) {
      const v = raw | 0;
      for (let s = 0; s < 32; s += 8) {
        h ^= (v >>> s) & 0xff;
        h = Math.imul(h, 16777619) >>> 0;
      }
    }
    return h >>> 0;
  }

  const strHashCache = new Map();
  function strHash(s) {
    const key = String(s);
    let v = strHashCache.get(key);
    if (v !== undefined) return v;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i) & 0xff;
      h = Math.imul(h, 16777619) >>> 0;
    }
    v = h >>> 0;
    strHashCache.set(key, v);
    return v;
  }

  /** A stable 0-1 draw from a seed, indexed by `k` so one seed yields many
   *  independent values. */
  function rand01(seed, k) {
    let h = (seed ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------------
  // Per-window schedules
  // ---------------------------------------------------------------------
  /**
   * Every window on every building gets its own on-time, off-time and fade
   * rate. This is the whole point of the feature: people do not all reach
   * for the lamp at the same instant, so a settlement has to ripple to life
   * over several seconds rather than switching on as a single object.
   *
   * `seedA`/`seedB` come from the source's own tile coordinates, so two
   * copies of the same building in different cities light differently, and
   * the same building lights the same way every time you look at it.
   * cycleIndex is folded in so each night differs from the last.
   */
  function windowSchedule(source, spec, index) {
    const w = cfg().windows;
    const seed = hashInts(source.seedA, source.seedB, strHash(source.spriteKey), index, state.cycleIndex);
    const r = (k) => rand01(seed, k);

    const onSlots = w.onSlots || [4, 5, 6];
    const offSlots = w.offSlots || [7, 8, 9];
    const alwaysChance = (spec && typeof spec.alwaysLitChance === "number")
      ? spec.alwaysLitChance
      : (w.alwaysLitChance || 0);
    const alwaysLit = r(3) < alwaysChance;

    const fadeRange = w.fadeMsRange || [800, 2000];
    return {
      onSlot: onSlots[Math.floor(r(1) * onSlots.length) % onSlots.length],
      onDelay: r(2) * (w.onStaggerMs || 0),
      // An "always lit" window ignores the night-time off slots and burns
      // until the first turn of dawn, then goes out with everyone else's
      // stagger. Someone is always up late.
      offSlot: alwaysLit ? 10 : offSlots[Math.floor(r(4) * offSlots.length) % offSlots.length],
      offDelay: r(5) * (w.offStaggerMs || 0),
      fadeMs: fadeRange[0] + r(6) * (fadeRange[1] - fadeRange[0]),
      alwaysLit,
    };
  }

  /**
   * How lit one window is right now, 0-1.
   *
   * Slot comparisons are plain `<`/`>` with no wrap handling because every
   * window is guaranteed dark by the end of the cycle: on-slots are 4-6,
   * off-slots are 7-9 (or 10 for an always-lit one), and slots 11 and 0-3
   * are unambiguously after all of them.
   *
   * `sinceTurn` is wall-clock ms since the turn began. On a fresh load that
   * is enormous, so every fade has long since completed and the scene
   * appears settled instead of replaying dusk.
   */
  function windowLitAmount(sched, slot, sinceTurn) {
    if (slot < sched.onSlot) return 0;
    if (slot > sched.offSlot) return 0;
    if (slot === sched.onSlot) {
      return ease((sinceTurn - sched.onDelay) / sched.fadeMs);
    }
    if (slot === sched.offSlot) {
      return 1 - ease((sinceTurn - sched.offDelay) / sched.fadeMs);
    }
    return 1;
  }

  /** Windows for a source, from the authored data. Buildings with no entry
   *  fall back to a single synthetic window at the sprite's centre, so they
   *  still light and dim on a believable schedule -- they just don't get
   *  individual dots. */
  const SYNTHETIC = { windows: [], synthetic: true };
  const NO_WINDOWS = Object.freeze([]);
  function specFor(spriteKey) {
    const data = (window.GameData && window.GameData.WINDOW_LIGHTS) || {};
    const spec = data[spriteKey];
    if (!spec) return SYNTHETIC;
    // An entry may legitimately carry only an ambient value and no points at
    // all -- the Wisp and the Great Bonfire are lights with nothing to put a
    // dot on. Normalize once, in place, so every consumer can read
    // spec.windows.length without guarding. The alternative was making the
    // exporter always write an empty `windows: []`, which puts the invariant
    // in the wrong file and leaves it one hand-edit away from a crash.
    if (!spec.windows) spec.windows = NO_WINDOWS;
    return spec;
  }

  /**
   * How much broad ambient pool this particular sprite throws, as multipliers
   * on whatever its kind (or its unit type) is configured for.
   *
   * Authored per sprite in window-lights.js rather than only per kind,
   * because "does this thing glow, and how much" is a property of the ART,
   * not of the category it belongs to: a Halfellow pub and a barracks are
   * both "building", a lit farmstead and a haystack are both "influence", and
   * a Wisp is a floating ball of light while a Militia is three people around
   * one small torch. Absent means 1 -- the configured amount, i.e. exactly
   * what everything did before this existed.
   *
   *   ambient: 0    no broad pool at all; the authored dots alone
   *   ambient: 1    the configured amount for this kind
   *   ambient: 2    twice it
   *   ambientRadius likewise, on the radius
   */
  function ambientFor(spec) {
    const mul = spec.ambient != null ? Math.max(0, spec.ambient) : 1;
    const radiusMul = spec.ambientRadius != null ? Math.max(0, spec.ambientRadius) : 1;
    return { mul, radiusMul };
  }

  /** Whether an influence-tile overlay emits anything at all. Unlike every
   *  other kind it is opt-IN (see addStructureLight): it needs either an
   *  authored lamp point or an explicitly authored ambient glow. */
  function influenceEmits(spriteKey) {
    const data = (window.GameData && window.GameData.WINDOW_LIGHTS) || {};
    const spec = data[spriteKey];
    if (!spec) return false;
    return !!(spec.windows && spec.windows.length) || ambientFor(spec).mul > 0;
  }

  /**
   * Lamp points for one FRAME of an animated sprite.
   *
   * Units are the only light sources in the game whose lamp moves: every unit
   * sheet is four 128x128 idle frames, and while most of them barely stir --
   * the Great Bonfire's flame core travels 2px across the whole cycle, a
   * Militia torch about 4px -- the Wizard flatly does not. Wizard variant 1
   * holds the staff in the LEFT hand on frame 0 and the right on frames 1-3,
   * moving the crystal 66px, better than half the sprite's width. A single
   * authored point would be wrong for three frames out of four on that unit,
   * so the data is authored per frame.
   *
   * An entry's `frames` is an array of point-lists, indexed by the frame the
   * sprite ACTUALLY drew (render.js passes the index it already resolved,
   * rather than asking sprites.js again -- currentFrame advances a state
   * machine, and it must be consulted exactly once per sprite per frame).
   * Shorter arrays wrap, so a lamp that genuinely doesn't move can be
   * authored once as a single-element `frames` and applies to all four.
   *
   * Position snaps with the frame rather than easing between frames, on
   * purpose. The light source itself teleports -- the staff is in the other
   * hand now -- so a pool that glided across the wizard's chest to catch up
   * would read as detached from the thing making it. It is a position
   * change, not a brightness change, so it stays clear of the no-flashing
   * rule; and under reduced motion currentFrame pins every sprite to frame 0,
   * which pins the lamp with it for free.
   */
  function frameSpecFor(spriteKey, frameIndex) {
    const spec = specFor(spriteKey);
    if (!spec.frames || !spec.frames.length) return spec;
    const pts = spec.frames[((frameIndex | 0) % spec.frames.length + spec.frames.length) % spec.frames.length];
    return { windows: pts || [], color: spec.color };
  }

  /** Average lit fraction across a source's windows -- drives its broad
   *  glow, so the halo over a building grows as its windows come on rather
   *  than appearing fully formed. */
  function sourceLitAmount(source, spec, sinceTurn) {
    const n = spec.windows.length;
    if (n === 0) {
      return windowLitAmount(windowSchedule(source, spec, 0), state.slot, sinceTurn);
    }
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += windowLitAmount(windowSchedule(source, spec, i), state.slot, sinceTurn);
    }
    return sum / n;
  }

  // ---------------------------------------------------------------------
  // Pre-baked light stamps
  //
  // Building a radial gradient per light per frame is the expensive way to
  // do this; the codebase's established idiom (render.js's getTerrainFringe,
  // clouds.js's sprite pre-render) is to bake a canvas once and drawImage it
  // scaled. One greyscale stamp serves every darkness cutout -- for
  // "destination-out" only the alpha matters -- and colour stamps are cached
  // per colour for the emissive pass.
  // ---------------------------------------------------------------------
  const STAMP_SIZE = 128;
  let cutoutStamp = null;
  const glowStamps = new Map();

  /**
   * Falloff curves. Both are steep on purpose.
   *
   * The first version of this used a broad, gentle ramp, and a single Great
   * Bonfire (radius 8 tiles) lit the entire viewport: at deepest night the
   * screen came out WARMER AND BRIGHTER than noon. A light has to fall off
   * fast enough that its pool has an edge you can see, or it stops being a
   * light and becomes a global filter.
   *
   * GLOW is tighter than CUTOUT, which is the physically sensible order:
   * you can see by a torch further away than the torch visibly glows.
   */
  const CUTOUT_STOPS = [[0, 1], [0.16, 0.62], [0.32, 0.32], [0.52, 0.13], [0.76, 0.035], [1, 0]];
  const GLOW_STOPS = [[0, 1], [0.12, 0.55], [0.26, 0.24], [0.45, 0.08], [0.70, 0.02], [1, 0]];

  function makeStamp(rgb, stops) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = STAMP_SIZE;
    const g2 = cv.getContext("2d");
    const r = STAMP_SIZE / 2;
    const grad = g2.createRadialGradient(r, r, 0, r, r, r);
    for (const [pos, a] of stops) grad.addColorStop(pos, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
    g2.fillStyle = grad;
    g2.fillRect(0, 0, STAMP_SIZE, STAMP_SIZE);
    return cv;
  }

  function getCutoutStamp() {
    if (!cutoutStamp) cutoutStamp = makeStamp([255, 255, 255], CUTOUT_STOPS);
    return cutoutStamp;
  }

  function getGlowStamp(color) {
    let s = glowStamps.get(color);
    if (!s) { s = makeStamp(parseHex(color), GLOW_STOPS); glowStamps.set(color, s); }
    return s;
  }

  // ---------------------------------------------------------------------
  // Light collection
  //
  // render.js pushes into these during passes it already runs, rather than
  // this module re-walking every civ. That matters for more than speed: the
  // cities and structures passes have already computed each sprite's exact
  // on-screen rect (bottom-anchored, aspect-scaled), and recomputing that
  // here would be the same arithmetic in two places waiting to drift apart.
  // ---------------------------------------------------------------------
  let lights = [];        // broad radial pools
  let windowSources = []; // sprites with authored window positions

  function beginFrame() { lights.length = 0; windowSources.length = 0; }

  function raceColorFor(raceId) {
    const c = cfg().lights;
    return c.raceColors[raceId] || c.defaultRaceColor;
  }

  /**
   * A unit that carries its own light. `boxX/boxY/boxSize` is the sprite box
   * render.js already computed, so the light sits on the unit's visual
   * position (mid-walk included) rather than on its logical tile.
   */
  function addUnitLight(unit, boxX, boxY, boxSize, ts, opts) {
    if (!isActive() || state.unitLightsAlpha <= 0.01) return;
    // A hiding unit does not carry a lit torch (2026-09-09, user-directed).
    // This is a correctness point, not just a mood one: `hidden` makes a unit
    // untargetable and invisible to enemy AI (see ai.js), while the light
    // pass draws through fog of war onto ground the viewer can see -- so a
    // glowing hidden unit would broadcast the exact position of something the
    // game has promised is concealed. Beats `burning` deliberately: if the
    // rules say you can't be seen, nothing here gets to contradict them.
    if (unit.conditions && unit.conditions.hidden) return;
    const c = cfg().lights;
    let spec = c.units[unit.typeId];
    if (!spec && c.optionalUnits && c.optionalUnits[unit.typeId]) {
      spec = c.units[unit.typeId] || { radius: 3, color: "#ff8a3d", intensity: 0.7, flicker: 1.4 };
    }
    // A burning unit is a moving light regardless of what it is. If it also
    // has its own lamp, the bigger of the two wins rather than stacking.
    let ablaze = false;
    if (unit.conditions && unit.conditions.burning) {
      const b = c.burning;
      if (!spec || b.radius > spec.radius) { spec = b; ablaze = true; }
    }
    if (!spec) return;

    // Where on the sprite the light actually comes from. Authored per frame
    // in window-lights.js (see frameSpecFor); a unit with no entry keeps the
    // old behaviour -- one pool at the sprite's default carry position,
    // a little below centre, since a carried light is not a halo.
    const o = opts || {};
    const authored = o.spriteKey ? specFor(o.spriteKey) : SYNTHETIC;
    const lamps = o.spriteKey ? frameSpecFor(o.spriteKey, o.frameIndex || 0) : null;
    // Once the fire has taken over, the authored lamp data stops applying.
    // Those points and that ambient value describe the unit's OWN light --
    // where a militia holds its torch, whether a wizard's staff washes the
    // ground. A unit that is ablaze is lit all over by something that is not
    // its lamp, so the pool goes to the sprite's centre and the dots are
    // dropped. Crucially this also means a sprite authored `ambient: 0` (dots
    // only, no pool) still lights the ground when it catches fire, rather
    // than burning invisibly.
    const pts = !ablaze && lamps && lamps.windows.length ? lamps.windows : null;
    // Same per-sprite ambient control the structures have. A Wisp is a
    // floating ball of glow and wants more pool than its dots suggest; a unit
    // authored at 0 keeps only the dots.
    const amb = ablaze ? { mul: 1, radiusMul: 1 } : ambientFor(authored);

    let cx = boxX + boxSize / 2;
    let cy = boxY + boxSize * 0.62;
    if (pts) {
      // The broad pool sits at the average of this frame's lamp points, so a
      // wizard's staff drags the whole pool with it rather than glowing from
      // the chest while the dot sits out on the crystal.
      let sx = 0, sy = 0;
      for (const p of pts) { sx += p[0]; sy += p[1]; }
      cx = boxX + (sx / pts.length) * boxSize;
      cy = boxY + (sy / pts.length) * boxSize;
    }

    if (amb.mul > 0 && amb.radiusMul > 0) {
      lights.push({
        x: cx,
        y: cy,
        r: spec.radius * ts * (c.radiusScale || 1) * tuning.radiusMul * amb.radiusMul,
        color: spec.color,
        intensity: spec.intensity * state.unitLightsAlpha * amb.mul,
        flicker: spec.flicker || 0,
        phase: hashInts(unit.x, unit.y, strHash(unit.typeId)) % 1000,
      });
    }

    // Crisp per-point dots on top, drawn in the same full-resolution pass the
    // building windows use. `alwaysOn` skips the window on/off schedule
    // outright: a carried torch burns for as long as its bearer is out in the
    // dark, it does not have a bedtime.
    if (pts) {
      windowSources.push({
        source: {
          spriteKey: o.spriteKey,
          x: boxX, y: boxY, w: boxSize, h: boxSize,
          color: spec.color,
          alwaysOn: state.unitLightsAlpha,
        },
        spec: { windows: pts, color: spec.color },
      });
    }
  }

  /** A city. `tier` scales the pool so a capital burns brighter than a hamlet. */
  function addCityLight(civ, city, drawX, drawY, drawW, drawH, ts, tier) {
    if (!isActive()) return;
    const c = cfg().lights;
    const raceId = civ && civ.raceId;
    // Callers pass raw population; sprites.js's pickCityTier resolves that to
    // the highest tier art that exists at or below it, which tops out at 6.
    // Clamp the same way so the window data key matches the art actually on
    // screen for a city that has grown past the last tier.
    const t = Math.max(1, Math.min(6, tier | 0));
    const spriteKey = `city/${raceId}/${t}`;
    const source = {
      spriteKey,
      seedA: hashInts(city.x, city.y),
      seedB: strHash(raceId || "?"),
      x: drawX, y: drawY, w: drawW, h: drawH,
      color: raceColorFor(raceId),
    };
    const spec = specFor(spriteKey);
    const sinceTurn = performance.now() - state.turnStartedAt;
    const lit = sourceLitAmount(source, spec, sinceTurn);
    if (lit <= 0.01) return;

    const tierScale = (c.cityTierScale || [])[t - 1] || 1;
    const amb = ambientFor(spec);
    if (amb.mul > 0 && amb.radiusMul > 0) {
      lights.push({
        x: drawX + drawW / 2,
        y: drawY + drawH * 0.72,
        r: c.cityRadius * ts * tierScale * (c.radiusScale || 1) * tuning.radiusMul * amb.radiusMul,
        color: source.color,
        intensity: (c.cityIntensity != null ? c.cityIntensity : 0.5) * lit * tierScale * amb.mul,
        flicker: 0.25,
        phase: hashInts(city.x, city.y) % 1000,
      });
    }
    if (spec.windows.length) windowSources.push({ source, spec });
  }

  /**
   * A building, wall segment or bridge segment.
   *
   * `opts` carries what differs between them:
   *   kind      "building" (default) | "wall" | "bridge" | "influence" --
   *             picks the radius and intensity pair from config. Walls and
   *             bridges get a smaller, dimmer light than a building: a torch
   *             on a rampart or a lantern at a crossing, not a whole hearth.
   *             "influence" is the civ-influence tile overlay art (a
   *             farmstead, a pig pen, a grave slab) and is smaller still --
   *             and, unlike every other kind, emits nothing at all unless
   *             its variant has an authored entry. See the note below.
   *   spriteKey overrides the window-lights.js lookup key. Walls and bridges
   *             need this because their art varies by RACE and ORIENTATION
   *             (a horizontal run, a vertical run and a corner node are three
   *             different PNGs), so one key per building id would put a
   *             lamp authored on a vertical wall onto a corner piece.
   *   matrix    the canvas transform that was active when the sprite was
   *             drawn, or null when it was drawn straight. Bridges rotate
   *             (and mirror, and stretch) their art -- see render.js's
   *             bridge pass -- so their lamps have to ride the same
   *             transform or they'd sit beside the band instead of on it.
   *             Captured rather than recomputed so the two can never drift.
   *   rect      the rect the sprite was drawn into IN THAT MATRIX'S space.
   *             Defaults to the screen-space rect passed in.
   *
   * A sprite with no authored entry still lights and dims on a believable
   * schedule -- it just gets the broad glow and no dots, via the same single
   * synthetic on/off schedule a windowless building gets, seeded per-tile so
   * a run of wall segments never lights in lockstep.
   *
   * The ONE exception is kind "influence". Buildings, walls and bridges are
   * all things that plausibly hold a light even when the artist didn't draw
   * a window, so the synthetic fallback flatters them. Influence overlays
   * are not: a haystack, a stack of cut stone, a rune waymarker and a pile
   * of ale barrels have nothing to light, and lighting them by default would
   * put a glow on most owned tiles on the map. So an influence variant with
   * no authored entry is silently skipped; authoring either a lamp point or
   * an ambient value on it in tools/window-lights.html is what turns it into
   * a light source.
   *
   * Every kind additionally honours a per-sprite `ambient` / `ambientRadius`
   * multiplier on the broad pool -- see ambientFor.
   */
  function addStructureLight(civ, s, drawX, drawY, drawW, drawH, ts, opts) {
    if (!isActive()) return;
    const o = opts || {};
    const kind = o.kind || "building";
    const c = cfg().lights;
    const raceId = civ && civ.raceId;
    // Race-specific building art exists for some ids; the light data keys off
    // the plain building id, which is what render.js resolves the sprite from
    // in the common case. Walls/bridges pass their own race+orientation key.
    const spriteKey = o.spriteKey || `building/${s.id}`;
    // Opt-in, not opt-out -- see the note above.
    if (kind === "influence" && !influenceEmits(spriteKey)) return;
    const rect = o.rect || { x: drawX, y: drawY, w: drawW, h: drawH };
    const source = {
      spriteKey,
      seedA: hashInts(s.x, s.y),
      seedB: strHash(spriteKey),
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      matrix: o.matrix || null,
      color: raceColorFor(raceId),
    };
    const spec = specFor(spriteKey);
    const sinceTurn = performance.now() - state.turnStartedAt;
    const lit = sourceLitAmount(source, spec, sinceTurn);
    if (lit <= 0.01) return;

    const radius = kind === "wall" ? c.wallRadius
      : kind === "bridge" ? c.bridgeRadius
        : kind === "influence" ? c.influenceRadius
          : c.buildingRadius;
    const intensity = kind === "wall" ? c.wallIntensity
      : kind === "bridge" ? c.bridgeIntensity
        : kind === "influence" ? c.influenceIntensity
          : c.buildingIntensity;

    // Per-sprite ambient override. A sprite authored with ambient 0 keeps its
    // window dots and drops the broad pool entirely -- the right answer for
    // art with a couple of lit slits and no reason to wash the ground around
    // it. The dots are pushed below regardless.
    const amb = ambientFor(spec);
    if (amb.mul <= 0 || amb.radiusMul <= 0) {
      if (spec.windows.length) windowSources.push({ source, spec });
      return;
    }

    lights.push({
      // The broad pool always sits at the tile's own centre in SCREEN space,
      // never under the sprite's transform -- it's composited into the
      // half-resolution scratch buffer, which knows nothing about whatever
      // rotation a bridge happened to be drawn with.
      x: drawX + drawW / 2,
      y: drawY + drawH * 0.70,
      r: radius * ts * (c.radiusScale || 1) * tuning.radiusMul * amb.radiusMul,
      color: source.color,
      intensity: intensity * lit * amb.mul,
      flicker: 0.2,
      phase: hashInts(s.x, s.y) % 1000,
    });
    if (spec.windows.length) windowSources.push({ source, spec });
  }

  // ---------------------------------------------------------------------
  // Compositing
  // ---------------------------------------------------------------------
  let scratch = null;
  let scratchCtx = null;
  let lightMask = null;
  let lightMaskCtx = null;

  function getScratch(w, h) {
    if (!scratch) { scratch = document.createElement("canvas"); scratchCtx = scratch.getContext("2d"); }
    // Assigning width/height reallocates and clears, so only do it on a real
    // size change -- main.js's resizeMapCanvas guards the same way, for the
    // same reason.
    if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
    return scratchCtx;
  }

  /**
   * White, with alpha equal to how strongly each pixel is lit -- i.e. the
   * shape of every light pool on screen, in one image.
   *
   * The darkness pass and the colorize pass punch IDENTICAL holes, so they
   * built the same set of radial stamps twice per frame. At minimum zoom the
   * whole map is on screen and every settlement contributes a light, which
   * made that duplication the single biggest cost the feature added (+20% on
   * an already-38ms frame). Stamping once here and blitting the result twice
   * turns 2N stamp draws into N + 2.
   *
   * Overlapping lights combine to a1 + a2(1-a1) under source-over, which is
   * exactly what repeated destination-out passes produced before -- so this
   * is a pure speedup, not a change in appearance.
   */
  function buildLightMask(w, h, scale, maxCut, now) {
    if (!lightMask) { lightMask = document.createElement("canvas"); lightMaskCtx = lightMask.getContext("2d"); }
    if (lightMask.width !== w || lightMask.height !== h) { lightMask.width = w; lightMask.height = h; }
    const m = lightMaskCtx;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = "source-over";
    m.globalAlpha = 1;
    m.clearRect(0, 0, w, h);
    if (!lights.length) return null;
    const stamp = getCutoutStamp();
    for (const L of lights) {
      const r = L.r * scale * flickerMul(L, now);
      if (r <= 0) continue;
      const i = L.intensity * flickerIntensityMul(L, now);
      m.globalAlpha = Math.max(0, Math.min(maxCut, i * maxCut));
      m.drawImage(stamp, L.x * scale - r, L.y * scale - r, r * 2, r * 2);
    }
    m.globalAlpha = 1;
    return lightMask;
  }

  /** render.js keeps the canvas's logical CSS size here because the context
   *  is pre-scaled by devicePixelRatio; canvas.width is the backing store and
   *  is the wrong number for any screen-space maths. */
  function cssW(canvas) { return canvas.__cssW || canvas.clientWidth || canvas.width; }
  function cssH(canvas) { return canvas.__cssH || canvas.clientHeight || canvas.height; }

  /** The "color" composite mode is a CSS blend mode adopted into canvas2d.
   *  Every current browser has it, but a context that doesn't will silently
   *  refuse the assignment and keep "source-over" -- which would blit an
   *  opaque sheet of flat blue over the map. Detect once by setting it and
   *  reading it back, and skip the pass entirely if it didn't take. */
  let colorBlendOk = null;
  function supportsColorBlend(ctx) {
    if (colorBlendOk === null) {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = "color";
      colorBlendOk = ctx.globalCompositeOperation === "color";
      ctx.globalCompositeOperation = prev;
    }
    return colorBlendOk;
  }

  /**
   * The shared -1..1 flicker wave. Two incommensurable periods (about 3.9s
   * and 1.7s) so it never settles into a visible repeating pulse.
   *
   * Both are far slower than 3Hz, which matters: this project's standing rule
   * is that nothing may flash or strobe (photosensitivity). At 0.26Hz and
   * 0.57Hz this is a flame breathing, and it is nowhere near the 3-60Hz band
   * that provokes photosensitive responses.
   *
   * Returns 0 under reduced motion, so every consumer collapses to 1x.
   */
  function flickerWave(light, now) {
    if (!light.flicker || reduced()) return 0;
    const a = Math.sin(now / 620 + light.phase);
    const b = Math.sin(now / 277 + light.phase * 1.7);
    return a * 0.65 + b * 0.35;
  }

  /** Flicker on the light's REACH. */
  function flickerMul(light, now) {
    return 1 + (cfg().lights.flickerAmount || 0) * light.flicker * flickerWave(light, now);
  }

  /**
   * Flicker on the light's BRIGHTNESS (2026-09-09, user-directed: "if a unit
   * has the burning condition, it should have ambient light that flickers").
   *
   * Wobbling only the radius, which is all this used to do, turned out to be
   * nearly invisible: measured on a burning unit, the pool's core varied by
   * 0.6% and its outer fringe by 2.6% over a full cycle. That is because the
   * cutout is capped at maxCutout in the middle of a light, so growing and
   * shrinking a soft falloff barely moves the core at all -- and the core is
   * where the eye is. A fire has to get brighter and dimmer, not just wider
   * and narrower.
   *
   * Driven by the SAME wave as the radius, so a flare-up is bigger and
   * brighter together rather than the two fighting each other.
   */
  function flickerIntensityMul(light, now) {
    const amt = (cfg().lights.flickerIntensityAmount || 0) * light.flicker;
    return Math.max(0, 1 + amt * flickerWave(light, now));
  }

  /**
   * The tiles on screen that are NOT currently visible, as one path, in
   * scratch-canvas coordinates -- used to stop light spilling across the fog
   * boundary. Bounded to the union of the lights' own footprints, so a map
   * with no lights near the fog costs nothing.
   */
  function buildFogClip(gameState, visible, offsetX, offsetY, ts, w, h, scale) {
    if (!lights.length || !visible) return null;
    const map = gameState.map;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const L of lights) {
      if (L.x - L.r < minX) minX = L.x - L.r;
      if (L.y - L.r < minY) minY = L.y - L.r;
      if (L.x + L.r > maxX) maxX = L.x + L.r;
      if (L.y + L.r > maxY) maxY = L.y + L.r;
    }
    minX = Math.max(0, minX); minY = Math.max(0, minY);
    maxX = Math.min(w, maxX); maxY = Math.min(h, maxY);
    if (maxX <= minX || maxY <= minY) return null;

    const x0 = Math.max(0, Math.floor((minX - offsetX) / ts));
    const x1 = Math.min(map.width - 1, Math.floor((maxX - offsetX) / ts));
    const y0 = Math.max(0, Math.floor((minY - offsetY) / ts));
    const y1 = Math.min(map.height - 1, Math.floor((maxY - offsetY) / ts));

    const path = new Path2D();
    let any = false;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (visible.has(y * map.width + x)) continue;
        path.rect((x * ts + offsetX) * scale, (y * ts + offsetY) * scale, ts * scale + 1, ts * scale + 1);
        any = true;
      }
    }
    return any ? path : null;
  }

  /**
   * Passes A and B. Called from render.js after villagers, before the
   * path/reticle/effect layers.
   */
  function drawWorldLighting(ctx, canvas, gameState, viewState, offsetX, offsetY, ts, visible, now) {
    if (!isActive()) { beginFrame(); return; }
    const c = cfg();
    const w = cssW(canvas), h = cssH(canvas);
    if (w <= 0 || h <= 0) { beginFrame(); return; }

    const scale = Math.max(0.25, Math.min(1, c.scratchScale || 1));
    const sw = Math.max(1, Math.round(w * scale));
    const sh = Math.max(1, Math.round(h * scale));
    const sctx = getScratch(sw, sh);

    const fogPath = buildFogClip(gameState, visible, offsetX, offsetY, ts, w, h, scale);

    // Capped below 1 so even a bonfire's own core keeps a trace of night in
    // it. Fully clearing the darkness makes the lit tile read as a hole
    // punched through to the daytime map, which breaks the illusion harder
    // than being slightly too dark ever would.
    const maxCut = c.lights.maxCutout != null ? c.lights.maxCutout : 1;
    const mask = buildLightMask(sw, sh, scale, maxCut, now);

    // ---- Pass A: the darkness sheet, with holes where the lights are ----
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = "source-over";
    sctx.globalAlpha = 1;
    sctx.clearRect(0, 0, sw, sh);
    sctx.fillStyle = state.tint;
    sctx.fillRect(0, 0, sw, sh);

    if (mask) {
      sctx.globalCompositeOperation = "destination-out";
      sctx.drawImage(mask, 0, 0);
      sctx.globalCompositeOperation = "source-over";
    }

    // Fogged tiles go back to full darkness, so a light's falloff can never
    // brighten a tile the player isn't supposed to be able to see into.
    if (fogPath) { sctx.fillStyle = state.tint; sctx.fill(fogPath); }

    ctx.save();
    if (tuning.multiply) ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = state.alpha;
    ctx.drawImage(scratch, 0, 0, sw, sh, 0, 0, w, h);
    ctx.restore();

    // ---- Pass A2: push the hue toward night ("day for night") ----
    // The wash above darkens but cannot recolour -- see config's
    // colorizeScale for why. Masked by the same light stamps, so ground
    // inside a torch's pool keeps its warm daylight hue while everything
    // around it turns blue.
    // Deliberately NOT multiplied by tuning.darknessMul: that dev slider
    // controls how dark the wash is, and the whole point of authoring
    // colorize per slot is that "how blue" and "how dark" move separately.
    const coolStrength = state.colorize * (c.colorizeScale != null ? c.colorizeScale : 1);
    if (coolStrength > 0.01 && supportsColorBlend(ctx)) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = "source-over";
      sctx.globalAlpha = 1;
      sctx.clearRect(0, 0, sw, sh);
      sctx.fillStyle = state.cool;
      sctx.fillRect(0, 0, sw, sh);

      if (mask) {
        sctx.globalCompositeOperation = "destination-out";
        sctx.drawImage(mask, 0, 0);
        sctx.globalCompositeOperation = "source-over";
      }
      // Fogged tiles get recoloured too -- night falls on ground you can't
      // see just the same, and leaving them warm would outline the fog
      // boundary in colour.
      if (fogPath) { sctx.fillStyle = state.cool; sctx.fill(fogPath); }

      ctx.save();
      ctx.globalCompositeOperation = "color";
      ctx.globalAlpha = Math.min(1, coolStrength);
      ctx.drawImage(scratch, 0, 0, sw, sh, 0, 0, w, h);
      ctx.restore();
    }

    // ---- Pass B: the warm light itself ----
    const glow = (c.lights.glowStrength || 0) * tuning.glowMul;
    if (glow > 0 && lights.length) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.globalCompositeOperation = "source-over";
      sctx.globalAlpha = 1;
      sctx.clearRect(0, 0, sw, sh);
      for (const L of lights) {
        const r = L.r * scale * flickerMul(L, now);
        if (r <= 0) continue;
        sctx.globalAlpha = Math.max(0, Math.min(1, L.intensity * flickerIntensityMul(L, now)));
        sctx.drawImage(getGlowStamp(L.color), L.x * scale - r, L.y * scale - r, r * 2, r * 2);
      }
      sctx.globalAlpha = 1;
      if (fogPath) {
        sctx.globalCompositeOperation = "destination-out";
        sctx.fill(fogPath);
        sctx.globalCompositeOperation = "source-over";
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      // Scaled by how dark it actually is, so lamps are a hint at first
      // twilight and full strength at midnight.
      ctx.globalAlpha = Math.max(0, Math.min(1, glow * state.darkness));
      ctx.drawImage(scratch, 0, 0, sw, sh, 0, 0, w, h);
      ctx.restore();
    }

    // ---- Pass C: individual window dots, full resolution ----
    drawWindowDots(ctx, viewState, ts, now);

    beginFrame();
  }

  /**
   * Small warm dots at each authored window position. Drawn straight onto the
   * map rather than through the half-resolution scratch: at default zoom one
   * of these is under 3px across and would smear away.
   */
  function drawWindowDots(ctx, viewState, ts, now) {
    const w = cfg().windows;
    if (!windowSources.length) return;
    // Below this zoom a whole building is only a few dozen pixels; individual
    // windows can't resolve and the broad glow carries it alone.
    if ((viewState.zoomLevel || 1) < (w.minZoom || 0)) return;

    const sinceTurn = now - state.turnStartedAt;
    const radius = (w.dotRadiusPx || 2.5) * (viewState.zoomLevel || 1);
    const brightness = Math.max(0, Math.min(1, state.darkness));
    if (brightness <= 0.01) return;

    ctx.save();
    const baseMatrix = ctx.getTransform();
    ctx.globalCompositeOperation = "lighter";
    for (const { source, spec } of windowSources) {
      // A source drawn under a transform (a rotated/mirrored bridge span)
      // replays that exact matrix, so its lamps land on the band wherever
      // the art was actually put. Everything else draws in plain screen
      // space under the canvas's own base (device-pixel-ratio) matrix.
      if (source.matrix) ctx.setTransform(source.matrix); else ctx.setTransform(baseMatrix);
      for (let i = 0; i < spec.windows.length; i++) {
        const win = spec.windows[i];
        // Unit lamps opt out of the whole go-to-bed schedule (see
        // addUnitLight) and simply track the unit-light ramp; everything
        // built into the ground runs its per-window on/off schedule.
        const lit = source.alwaysOn != null
          ? source.alwaysOn
          : windowLitAmount(windowSchedule(source, spec, i), state.slot, sinceTurn);
        if (lit <= 0.02) continue;

        const px = source.x + win[0] * source.w;
        const py = source.y + win[1] * source.h;
        const scale = win[2] || 1;
        const r = radius * scale;
        const color = win[3] || spec.color || source.color;

        ctx.globalAlpha = Math.max(0, Math.min(1, lit * brightness * 0.9));
        ctx.drawImage(getGlowStamp(color), px - r * 2.2, py - r * 2.2, r * 4.4, r * 4.4);
      }
    }
    ctx.setTransform(baseMatrix);
    ctx.restore();
  }

  window.UI.daynight = {
    init,
    isEnabled, setEnabled, onChange,
    getTuning, setTuning, replayRipple,
    tick, current, isActive, villagerActivity,
    phaseInfoForSlot,
    beginFrame, addUnitLight, addCityLight, addStructureLight,
    drawWorldLighting,
    // Exposed for the clock widget and clouds.js, which need the same colours
    // the world is using so the two can never disagree.
    slotConfig, mixHex, parseHex, peakAlpha,
  };
})();
