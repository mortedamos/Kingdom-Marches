/**
 * SPRITE LOADER
 * -------------
 * Loads PNG assets for terrain, units, cities, and enhancements.
 * Manifests (frame size, layout, animation data) come from
 * js/data/sprite-manifests.js. Missing PNGs are skipped silently; callers
 * get null from pick() and fall back to color/symbol.
 *
 * The game is served over HTTP -- run a local server, e.g.
 * working/tools/launch-server.ps1.
 *
 * Auto-detected per-asset JSON manifest: alongside any PNG, drop a same-
 * named .json file (e.g. assets/terrain/plains.png + plains.json, or
 * plains_1.png + plains_1.json for a numbered variant) describing that
 * image's frameWidth/frameHeight/layout/animations. If present, it's used
 * INSTEAD of the js/data/sprite-manifests.js entry for that image -- no
 * code change needed to add or tweak an animation, just ship the JSON next
 * to the art.
 *
 * Variant sets: for any asset key, drop up to 6 numbered files
 * (e.g. assets/terrain/plains_1.png .. plains_6.png) to get random visual
 * variety. Any subset works (just _1, or _1+_3, etc.) and a single
 * un-numbered file (plains.png) still works as before. Gendered humanoid
 * units use _1/_2 for male/female; racial/skin-tone diversity variants
 * (see art_style_guide.md) extend the same slots (_3/_4, _5/_6, ...) in
 * matched male/female pairs so the gender split stays even.
 * pick(key, seed) picks a variant once per (key, seed-object) pair, at
 * random, and remembers that choice for as long as the seed object exists
 * (e.g. for the lifetime of the tile/unit/city) -- so it never flickers.
 *
 * Gender: a unit's gender is decided ENGINE-side at creation (see
 * combat.js's initUnitHP, `unit.gender = "male"|"female"`) -- not by which
 * sprite variant happens to render, since a unit's name (js/data/unit-
 * names.js) has to agree with its portrait, and engine code can't depend
 * on which variant the UI layer randomly drew. pick() below reads
 * `seed.gender` (the unit itself is always the seed for a unit sprite) and
 * restricts its random choice to same-parity file numbers (odd = male,
 * even = female, matching the _1/_2[/_3/_4...] convention) whenever the
 * variant set's shape looks like a real gender pairing -- see pick()'s own
 * comment for the exact "does this even apply" heuristic. Non-unit seeds
 * (tiles, cities) never carry `.gender`, so this is a no-op for them.
 */

window.UI = window.UI || {};

(function () {
  // key -> { variants: [{ image, manifest }, ...] }
  const registry = {};
  // key -> WeakMap<seedObject, chosenVariantIndex>  (separate cache per asset
  // key so the same tile object can be used as the seed for terrain, resource,
  // and ruin sprites without their random picks colliding)
  const variantCaches = new Map();

  // manifest -> WeakMap<seedObject, AnimPlaybackState>  (per-instance idle
  // animation playback -- see currentFrame() below. Keyed off the manifest
  // object itself rather than a string key since callers already have it
  // to hand and every sprite category's manifest object is distinct.)
  const animStateCaches = new Map();

  // preloadAll() below fires off hundreds-to-thousands of these (every
  // variant slot of every terrain/unit/building/resource/road/river), all
  // essentially at once. Throttled the same way music.js/sfx.js's probeFile
  // is (see their own "browsers cap simultaneous connections per origin"
  // comment) to avoid flooding past the per-origin connection cap and
  // starving music/sfx's own throttled probes, which run concurrently with
  // this during the loading screen (see main.js's startGame). Each load also
  // has its own timeout so a stuck request can't hang past the loading
  // screen's failsafe. IMAGE_LOAD_CONCURRENCY mirrors music/sfx's
  // PROBE_CONCURRENCY.
  const IMAGE_LOAD_CONCURRENCY = 4;
  const IMAGE_LOAD_TIMEOUT_MS = 8000;
  let activeImageLoads = 0;
  const imageLoadQueue = [];
  function acquireImageSlot() {
    if (activeImageLoads < IMAGE_LOAD_CONCURRENCY) {
      activeImageLoads++;
      return Promise.resolve();
    }
    return new Promise((resolve) => imageLoadQueue.push(resolve));
  }
  function releaseImageSlot() {
    const next = imageLoadQueue.shift();
    if (next) next(); // hand the slot straight to the next waiter -- activeImageLoads stays the same
    else activeImageLoads--;
  }

  function loadImage(src) {
    return acquireImageSlot().then(() => new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => { cleanup(); reject(); }, IMAGE_LOAD_TIMEOUT_MS);
      function cleanup() { clearTimeout(timer); releaseImageSlot(); }
      img.onload  = () => { cleanup(); resolve(img); };
      img.onerror = () => { cleanup(); reject(); };
      img.src = src;
    }));
  }

  function resolveManifest(key, image) {
    const manifests = window.GameData.SPRITE_MANIFESTS || {};
    if (manifests[key]) return manifests[key];
    // No manifest registered, and no per-asset JSON sidecar loaded either
    // (see loadVariants/loadManifestJson) -- treating the whole image as a
    // single frame would be correct for a genuinely static sprite but
    // silently mangle a multi-frame sheet: the entire strip would get
    // squished into one tile-sized draw instead of playing as an idle
    // animation.
    //
    // Every sprite sheet shipped so far is N square frames laid out
    // left-to-right (see doc/art_style_guide.md) -- so when the image is
    // wider than it is tall AND that width divides evenly by the height,
    // infer a horizontal strip of (width / height) square frames instead of
    // guessing "one giant frame." A genuinely single-frame image (width ==
    // height, or a non-square-divisible width) still resolves to exactly
    // one frame, unchanged from before.
    const w = image.naturalWidth || 64, h = image.naturalHeight || 64;
    const frameCount = (h > 0 && w > h && w % h === 0) ? (w / h) : 1;
    return {
      frameWidth: w / frameCount, frameHeight: h, layout: "horizontal",
      animations: { idle: { frames: Array.from({ length: frameCount }, (_, i) => i), fps: 1 } },
    };
  }

  /** Best-effort load of a same-named .json manifest next to a PNG. Returns
   *  null (never throws) if it's missing or invalid -- callers fall back to
   *  resolveManifest(). */
  async function loadManifestJson(jsonPath) {
    try {
      const res = await fetch(jsonPath);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function loadVariants(key, basePath) {
    if (registry[key]) return;

    const MAX_VARIANTS = 6;
    const attemptBases = Array.from({ length: MAX_VARIANTS }, (_, i) => `${basePath}_${i + 1}`);
    const results = await Promise.allSettled(attemptBases.map((b) => loadImage(`${b}.png`)));
    // variantNumber retained per entry (not just array position) so a gap in
    // the numbering (e.g. _1/_3 present but not _2) doesn't shift parity --
    // pick()'s gender-matching relies on the real file number, not index.
    let loaded = results
      .map((r, i) => (r.status === "fulfilled" ? { image: r.value, base: attemptBases[i], variantNumber: i + 1 } : null))
      .filter(Boolean);

    if (loaded.length === 0) {
      // No numbered variants — fall back to a single un-numbered file.
      // variantNumber: null since there's no gender pairing to speak of
      // (moot anyway -- pick() short-circuits on a single-variant entry
      // before gender logic ever runs).
      try {
        loaded = [{ image: await loadImage(`${basePath}.png`), base: basePath, variantNumber: null }];
      } catch {
        return; // nothing found at all — skip silently
      }
    }

    const variants = await Promise.all(loaded.map(async ({ image, base, variantNumber }) => {
      const jsonManifest = await loadManifestJson(`${base}.json`);
      return { image, manifest: jsonManifest || resolveManifest(key, image), variantNumber };
    }));
    registry[key] = { variants };
  }

  // Cities may also ship as separate, fully-rendered per-population-tier
  // images (assets/cities/${raceId}_city_{1..6}.png -- e.g. orc_city_1.png
  // through orc_city_6.png) rather than one shared spritesheet with named
  // tier animations. Unlike loadVariants' random per-object pick, tier
  // selection is DETERMINISTIC (driven by the city's actual population),
  // so these are loaded and looked up separately via loadCityTiers/pickCityTier.
  const MAX_CITY_TIER = 6;

  /** Loads whichever of a race's per-tier city images exist; missing tiers
   *  (or a race with none at all) are skipped silently -- callers fall back
   *  to the plain city/${raceId} variant-based entry via pick() instead. */
  async function loadCityTiers(raceId) {
    const key = `city-tiers/${raceId}`;
    if (registry[key]) return;
    const attempts = [];
    for (let tier = 1; tier <= MAX_CITY_TIER; tier++) {
      attempts.push(
        loadImage(`assets/cities/${raceId}_city_${tier}.png`)
          .then((image) => ({ tier, image }))
          .catch(() => null)
      );
    }
    const loaded = (await Promise.all(attempts)).filter(Boolean);
    if (loaded.length === 0) return; // no tiered art for this race -- skip
    const tiers = {};
    for (const { tier, image } of loaded) tiers[tier] = image;
    registry[key] = { tiers };
  }

  /** Returns { image } for the given race at the given population tier, or
   *  null if this race has no tiered city art loaded. Clamps to the nearest
   *  available tier at or below the requested one (or the lowest available
   *  tier if the request is below all of them), so a partial set (e.g. only
   *  tiers 1-4 shipped so far) still degrades sensibly instead of failing. */
  /**
   * Returns { image, manifest } for the variant at `index` (wrapped via
   * modulo), or null if nothing loaded for this key -- bypasses pick()'s
   * random-per-seed-object selection for callers that need a stable pick
   * derived entirely from their own inputs (e.g. render.js's civ-influence
   * ambient tile overlay, indexed by a hash of tile coordinates + the map
   * seed so the same map always looks the same on reload -- unlike pick(),
   * which re-rolls randomly each session via variantCaches/Math.random()).
   */
  function pickDeterministic(key, index) {
    const entry = registry[key];
    if (!entry || entry.variants.length === 0) return null;
    const i = ((index % entry.variants.length) + entry.variants.length) % entry.variants.length;
    return entry.variants[i];
  }

  function pickCityTier(raceId, tier) {
    const entry = registry[`city-tiers/${raceId}`];
    if (!entry) return null;
    const available = Object.keys(entry.tiers).map(Number).sort((a, b) => a - b);
    if (available.length === 0) return null;
    let chosen = available[0];
    for (const t of available) { if (t <= tier) chosen = t; else break; }
    return { image: entry.tiers[chosen] };
  }

  /**
   * Returns { image, manifest } for one variant of the given key, or null
   * if nothing loaded. Pass a stable object (the tile, unit, or city
   * instance) as seed -- the first call picks a random variant for that
   * object and remembers it, so subsequent calls for the same object
   * always return the same variant (no per-frame flicker, no re-roll).
   * Omitting seed always returns variant 0.
   */
  function pick(key, seed) {
    const entry = registry[key];
    if (!entry || entry.variants.length === 0) return null;
    if (entry.variants.length === 1) return entry.variants[0];

    if (seed && typeof seed === "object") {
      let cache = variantCaches.get(key);
      if (!cache) { cache = new WeakMap(); variantCaches.set(key, cache); }
      if (!cache.has(seed)) {
        // Gender-aware pick: if the seed carries a .gender (units only --
        // set at creation, see combat.js's initUnitHP) AND this variant set
        // looks like a real male/female pairing -- an EVEN total count with
        // real file-number data on every entry, matching the _1/_2[/_3/_4...]
        // convention -- restrict the random choice to file numbers of
        // matching parity (odd = male, even = female) so the rendered
        // sprite agrees with the unit's own name. An ODD total count (e.g.
        // Militia's 3 group-scene variants, deliberately not a gender pair)
        // is left alone -- no real race/unit-type art set in this game
        // pairs genders under an odd count, so this cleanly tells the two
        // apart without hardcoding per-key exceptions. Falls back to the
        // full pool if the requested gender has no matching variant.
        let pool = entry.variants;
        if (seed.gender && entry.variants.length % 2 === 0
            && entry.variants.every((v) => v.variantNumber != null)) {
          const wantOdd = seed.gender === "male";
          const filtered = entry.variants.filter((v) => (v.variantNumber % 2 === 1) === wantOdd);
          if (filtered.length > 0) pool = filtered;
        }
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        cache.set(seed, entry.variants.indexOf(chosen));
      }
      return entry.variants[cache.get(seed)];
    }
    return entry.variants[0];
  }

  /**
   * Returns { image, manifest } for a unit, preferring race-specific art
   * (assets/units/{raceId}_{unitId}.png, registered under key
   * "unit/{unitId}/{raceId}" -- see preloadAll) and falling back to the
   * shared "unit/{unitId}" art if no race-specific variant has been
   * shipped for this unit/race combo yet. Race-locked units (e.g. the
   * Orc-only Raider) never have a race-qualified variant to find, so they
   * always resolve through the fallback -- same as before this existed.
   */
  function pickUnit(unitId, raceId, seed) {
    const qualified = pick(`unit/${unitId}/${raceId}`, seed);
    if (qualified) return qualified;
    return pick(`unit/${unitId}`, seed);
  }

  /** Same race-qualified-first-then-shared-fallback pattern as pickUnit,
   *  for buildings. Only matters for isWall buildings (wall_section) --
   *  the only building type that's actually shared across every race, so
   *  it's the only one that can have a race-specific reskin (e.g. Elf's
   *  living hedge wall vs. a plain stone wall elsewhere). Ordinary
   *  race-only buildings never have a qualified variant registered (see
   *  preloadAll), so this just falls through to the plain lookup for them,
   *  identical to calling pick() directly. */
  function pickBuilding(buildingId, raceId, seed) {
    const qualified = pick(`building/${buildingId}/${raceId}`, seed);
    if (qualified) return qualified;
    return pick(`building/${buildingId}`, seed);
  }

  /** Wall segments additionally vary by ORIENTATION (horizontal run, vertical
   *  run, or "node" -- a corner, junction, or isolated segment -- see
   *  render.js's wallOrientation()), since a wall's art must connect visually
   *  with its neighbors. Fallback chain, most-specific first: race+orientation
   *  -> race-only (a race with a single generic wall image, no variants yet)
   *  -> plain orientation (a hypothetical race-neutral oriented wall) -> plain
   *  shared wall. Every step degrades gracefully so a race with partial or no
   *  wall art at all still renders (the old colored-square placeholder, via
   *  render.js's `if (sprite)` check finding nothing here). */
  function pickWallSegment(buildingId, raceId, orientation, seed) {
    return (
      pick(`building/${buildingId}/${raceId}/${orientation}`, seed) ||
      pick(`building/${buildingId}/${raceId}`, seed) ||
      pick(`building/${buildingId}/${orientation}`, seed) ||
      pick(`building/${buildingId}`, seed)
    );
  }

  // Default idle playback pacing -- "hold the first frame, play through to
  // the last, hold the last, loop back" (see currentFrame() below) rather
  // than a rigid fps-locked cycle. Overridable per-animation in a manifest
  // (holdFirstMs/holdLastMs/partialChance/partialUpTo) but these cover
  // every asset shipped so far.
  const DEFAULT_HOLD_FIRST_MS = 3000;
  const DEFAULT_HOLD_LAST_MS = 2000;
  const DEFAULT_HOLD_JITTER = 0.4; // +/- 40% randomness on hold durations
  const DEFAULT_PARTIAL_CHANCE = 0.35; // chance a cycle stops early at partialUpTo

  function jitter(baseMs, amount) {
    const factor = 1 + (Math.random() * 2 - 1) * amount;
    return Math.max(50, baseMs * factor);
  }

  /**
   * Returns the source rect { sx, sy, sw, sh } for the current animation frame.
   *
   * Multi-frame idle animations play as a per-instance state machine, not a
   * rigid wall-clock-synced cycle: hold on frames[0] for a few (jittered)
   * seconds, step through the rest of frames[] at the manifest's fps, hold
   * on the last frame reached for a few more seconds, then loop back to
   * holding frames[0] again. Each cycle has a chance (partialChance) of
   * only playing up to frames[partialUpTo] instead of all the way to the
   * end, for variety. This needs a stable per-instance `seed` object (the
   * unit/tile/city instance -- same object passed to pick()) to track each
   * instance's own independent phase; every instance seeded this way drifts
   * out of sync with the others instead of animating in lockstep, which is
   * the point -- a field of identical, perfectly-synchronized idle sprites
   * reads as mechanical.
   *
   * Falls back to the old simple fps-locked modulo cycle (wall-clock
   * synced) when there's no seed to key per-instance state on, or the
   * animation has only one frame (nothing to hold/play/loop).
   */
  function currentFrame(manifest, animName, seed) {
    const anim = manifest.animations[animName] || manifest.animations.idle;
    if (!anim) return { sx: 0, sy: 0, sw: manifest.frameWidth, sh: manifest.frameHeight };

    const vertical = manifest.layout === "vertical";
    const frameRect = (frameIdx) => ({
      sx: vertical ? 0 : frameIdx * manifest.frameWidth,
      sy: vertical ? frameIdx * manifest.frameHeight : 0,
      sw: manifest.frameWidth,
      sh: manifest.frameHeight,
    });

    const frames = anim.frames;
    // Reduced motion: pin every idle animation to its first frame rather
    // than running any of the timing/state-machine logic below -- skips
    // the whole per-instance animStateCaches machinery entirely, not just
    // its visual output.
    if (window.UI.motion && window.UI.motion.isReduced()) return frameRect(frames[0]);

    // Static terrain and resources (2026-08-18, user-requested simplification):
    // keep these at frame 0, no animation. Includes terrain (plains, mountains,
    // hills, desert, swamp, tundra, forest) and resources (iron, gold).
    const staticTerrains = new Set(["plains", "mountains", "hills", "desert", "swamp", "tundra", "forest"]);
    const staticResources = new Set(["iron", "gold"]);
    if (seed && typeof seed === "object") {
      if ((seed.terrain && staticTerrains.has(seed.terrain)) ||
          (seed.resource && staticResources.has(seed.resource))) {
        return frameRect(frames[0]);
      }
    }

    // fps can be fractional (e.g. 0.5 = one frame every 2s) for slow-cycling
    // terrain animations -- only fall back to 1 when fps is genuinely absent,
    // not via `|| 1` (which would silently coerce an explicit 0 but is
    // otherwise fine for fractions since they're truthy; using != null here
    // to be precise about what "unset" means rather than relying on that).
    const fps = anim.fps != null ? anim.fps : 1;

    if (frames.length <= 1 || !seed || typeof seed !== "object") {
      const frameIdx = frames[Math.floor(Date.now() / (1000 / fps)) % frames.length];
      return frameRect(frameIdx);
    }

    const now = Date.now();
    let cache = animStateCaches.get(manifest);
    if (!cache) { cache = new WeakMap(); animStateCaches.set(manifest, cache); }
    let state = cache.get(seed);

    const stepMs = 1000 / fps;
    const holdFirstMs = anim.holdFirstMs != null ? anim.holdFirstMs : DEFAULT_HOLD_FIRST_MS;
    const holdLastMs = anim.holdLastMs != null ? anim.holdLastMs : DEFAULT_HOLD_LAST_MS;
    const partialChance = anim.partialChance != null ? anim.partialChance : DEFAULT_PARTIAL_CHANCE;
    const partialUpTo = Math.min(anim.partialUpTo != null ? anim.partialUpTo : 1, frames.length - 1);

    if (!state) {
      // Stagger newly-seen instances to a random point within the first
      // hold rather than always starting fresh, so a batch of units that
      // all spawn at once (e.g. game start) don't animate in lockstep.
      state = { phase: "holdFirst", phaseEndsAt: now + Math.random() * holdFirstMs, frameIdx: 0 };
      cache.set(seed, state);
    }

    if (state.phase === "holdFirst" && now >= state.phaseEndsAt) {
      const isPartial = Math.random() < partialChance;
      state.phase = "playing";
      state.frameIdx = 1;
      state.lastIdx = isPartial ? partialUpTo : frames.length - 1;
      state.nextStepAt = now + stepMs;
    }

    if (state.phase === "playing" && now >= state.nextStepAt) {
      state.frameIdx++;
      state.nextStepAt = now + stepMs;
      if (state.frameIdx >= state.lastIdx) {
        state.frameIdx = state.lastIdx;
        state.phase = "holdLast";
        state.phaseEndsAt = now + jitter(holdLastMs, DEFAULT_HOLD_JITTER);
      }
    }

    if (state.phase === "holdLast" && now >= state.phaseEndsAt) {
      state.phase = "holdFirst";
      state.frameIdx = 0;
      state.phaseEndsAt = now + jitter(holdFirstMs, DEFAULT_HOLD_JITTER);
    }

    return frameRect(frames[state.frameIdx]);
  }

  // The only units that exist the instant a game starts (see main.js's
  // createNewGame) -- everything else (buildings, every other unit type)
  // takes several turns to ever appear on screen, so it doesn't need to
  // block the loading screen. See preloadAll's own doc comment for the full
  // critical/background split.
  const STARTING_UNIT_IDS = ["pioneer", "scout"];

  /** Runs `criticalFns` (each a zero-arg function that KICKS OFF one load
   *  when called -- deferred like this so background loads don't start
   *  competing for the shared image-load semaphore until critical is fully
   *  done) to completion, reporting onProgress(done, total) as they settle;
   *  the returned promise resolves once that's done. `backgroundFns` are
   *  then fired off afterward WITHOUT being awaited -- they keep loading
   *  (still throttled by loadImage's own semaphore) and populate the
   *  registry whenever they happen to finish, same as any other async
   *  pick() miss. */
  async function runTiered(criticalFns, backgroundFns, onProgress) {
    const criticalPromises = criticalFns.map((fn) => fn());
    const total = criticalPromises.length;
    let done = 0;
    const tracked = criticalPromises.map((p) => p.finally(() => {
      done++;
      if (onProgress) onProgress(done, total);
    }));
    await Promise.allSettled(tracked);
    Promise.allSettled(backgroundFns.map((fn) => fn())); // fire-and-forget
  }

  /** Fires off all asset loads needed for a match between `racesInPlay`
   *  (array of race ids -- normal games pass [humanRace, ...opponents],
   *  spectator games pass the checked spectator races). Race-locked units/
   *  buildings/city art for races NOT in this match are skipped entirely --
   *  they can never appear on screen this game (see main.js's startGame,
   *  which knows racesInPlay before calling this).
   *
   *  What's left is further split into a CRITICAL tier (terrain, resources/
   *  ruin/road/river overlays, and racesInPlay's city + starting-unit art --
   *  everything actually visible the instant the game screen appears) that
   *  the returned promise waits on, and a BACKGROUND tier (buildings, wall
   *  art, and every non-starting unit type -- nothing that can possibly be
   *  on screen for several turns) that keeps loading afterward without
   *  making the loading screen wait on it. Always resolves — failures are
   *  swallowed. onProgress(done, total), if given, is called as each
   *  individual CRITICAL load settles (fulfilled or rejected) -- rejections
   *  are still counted as "done" since Promise.allSettled tolerates them
   *  regardless. */
  function preloadAll(racesInPlay, onProgress) {
    const critical = [];
    const background = [];
    for (const id of Object.keys(window.GameData.TERRAIN))
      critical.push(() => loadVariants(`terrain/${id}`, `assets/terrain/${id}`));
    // Dramatic tall/overhanging mountain peak art -- a separate pool from
    // terrain/mountains' flat tiles, only ever selected by render.js's own
    // eligibility+rarity roll for interior tiles of a large range (see
    // worldgen.js's markTallMountainEligibility), never by sprites.js's
    // generic per-tile random pick().
    critical.push(() => loadVariants("terrain/mountains_tall", "assets/terrain/mountains_tall"));
    const inPlayUnitIds = window.GameData.UNIT_LIST.filter(
      (id) => !window.GameData.UNITS[id].raceOnly || racesInPlay.includes(window.GameData.UNITS[id].raceOnly)
    );
    for (const id of inPlayUnitIds) {
      const tier = STARTING_UNIT_IDS.includes(id) ? critical : background;
      tier.push(() => loadVariants(`unit/${id}`, `assets/units/${id}`));
    }
    // Units with no raceOnly (Pioneer, Scout, Galley) may additionally ship
    // race-specific art -- assets/units/{raceId}_{unitId}.png -- looked up
    // via pickUnit() in preference to the shared art above. Race-locked
    // units skip this: they only ever belong to one race already.
    const universalUnitIds = inPlayUnitIds.filter(
      (id) => !window.GameData.UNITS[id].raceOnly
    );
    for (const unitId of universalUnitIds) {
      const tier = STARTING_UNIT_IDS.includes(unitId) ? critical : background;
      for (const raceId of racesInPlay) {
        tier.push(() => loadVariants(`unit/${unitId}/${raceId}`, `assets/units/${raceId}_${unitId}`));
      }
    }
    for (const id of racesInPlay) {
      critical.push(() => loadVariants(`city/${id}`, `assets/cities/${id}`));
      critical.push(() => loadCityTiers(id));
    }
    // Buildings (race-specific) and the universal wall_section -- single
    // static image per id, no population-driven tiering, so the ordinary
    // variant loader is enough (see art style guide §13). None of these can
    // exist the instant a game starts, so they're all background.
    const inPlayBuildingIds = window.GameData.BUILDING_LIST.filter(
      (id) => !window.GameData.BUILDINGS[id].raceOnly || racesInPlay.includes(window.GameData.BUILDINGS[id].raceOnly)
    );
    for (const id of inPlayBuildingIds)
      background.push(() => loadVariants(`building/${id}`, `assets/buildings/${id}`));
    // isWall buildings (wall_section) may additionally ship optional
    // race-specific art -- assets/buildings/{raceId}_{buildingId}.png --
    // looked up via pickBuilding() in preference to the shared art above.
    // Same convention as the universal-unit race art above. Ordinary
    // race-only buildings skip this (they already belong to one race, no
    // qualified variant to look for).
    const universalBuildingIds = inPlayBuildingIds.filter(
      (id) => window.GameData.BUILDINGS[id].isWall
    );
    // Wall orientation variants -- see render.js's wallOrientation() and
    // pickWallSegment() above. A race's wall art additionally varies by
    // whether it's a straight horizontal/vertical run or a corner/junction/
    // isolated "node" (see art style guide §13), since the art must connect
    // visually with same-civ wall neighbors.
    const WALL_ORIENTATIONS = ["horizontal", "vertical", "node"];
    for (const buildingId of universalBuildingIds) {
      for (const raceId of racesInPlay) {
        background.push(() => loadVariants(`building/${buildingId}/${raceId}`, `assets/buildings/${raceId}_${buildingId}`));
        for (const orientation of WALL_ORIENTATIONS) {
          background.push(() => loadVariants(
            `building/${buildingId}/${raceId}/${orientation}`,
            `assets/buildings/${raceId}_${buildingId}_${orientation}`
          ));
        }
      }
    }
    // Bridge orientation variants -- same fallback-chain shape as walls
    // above (pickWallSegment is reused as-is for bridge_section, see
    // render.js). Only 3 variants, not 4: there's no separate "horizontal"
    // asset -- an east-west run reuses "vertical" ROTATED 90° at draw time
    // (see render.js's bridgeSpriteKey/the Bridges draw pass), since a
    // separately-authored horizontal asset kept drifting to a different
    // band width than vertical (2026-08-18, user-directed). "diagonal"
    // covers both diagonal directions the same way (mirrored, not
    // rotated, since bridges can also run diagonally per
    // cities.js's computeBridgePath -- see bridgeOrientation()).
    const bridgeBuildingIds = inPlayBuildingIds.filter(
      (id) => window.GameData.BUILDINGS[id].isBridge
    );
    const BRIDGE_ORIENTATIONS = ["vertical", "diagonal", "node"];
    for (const buildingId of bridgeBuildingIds) {
      for (const raceId of racesInPlay) {
        background.push(() => loadVariants(`building/${buildingId}/${raceId}`, `assets/buildings/${raceId}_${buildingId}`));
        for (const orientation of BRIDGE_ORIENTATIONS) {
          background.push(() => loadVariants(
            `building/${buildingId}/${raceId}/${orientation}`,
            `assets/buildings/${raceId}_${buildingId}_${orientation}`
          ));
        }
      }
    }
    for (const id of window.GameData.RESOURCE_LIST)
      critical.push(() => loadVariants(`enhancement/resource_${id}`, `assets/enhancements/resource_${id}`));
    critical.push(() => loadVariants("enhancement/ruin", "assets/enhancements/ruin"));
    critical.push(() => loadVariants("enhancement/cave", "assets/enhancements/cave"));
    // Civ-influence ambient tile overlay -- small non-animated per-race
    // flavor sprites (4-5 variants each, assets/enhancements/influence_
    // {raceId}_{1..5}.png) drawn on owned tiles to read as "occupied and
    // worked" land, picked deterministically by render.js's own hash rather
    // than through pick()'s per-session random choice (see
    // pickDeterministic's doc comment). Critical tier, matching
    // resource/ruin: a civ can own tiles from turn 1, unlike buildings/walls
    // which can't exist yet.
    for (const id of racesInPlay)
      critical.push(() => loadVariants(`enhancement/influence/${id}`, `assets/enhancements/influence_${id}`));
    // Coast/ocean counterpart -- one non-animated variant per race,
    // assets/enhancements/influence_water_{id}.png -- see render.js's own
    // draw-time branch on TERRAIN[tile.terrain].isWater for why land and
    // water need separate pools rather than one shared one.
    for (const id of racesInPlay)
      critical.push(() => loadVariants(`enhancement/influence-water/${id}`, `assets/enhancements/influence_water_${id}`));
    // Road overlay stubs -- layered/rotated at draw time (see render.js
    // drawRoadOverlay) to build any 8-neighbor connection pattern from just
    // these four, rather than pre-baking one image per combination.
    for (const part of ["cardinal", "diagonal", "hub"])
      critical.push(() => loadVariants(`road/${part}`, `assets/roads/road_${part}`));
    // River overlay stubs -- same technique, cardinal-only (rivers never
    // flow diagonally, see worldgen.js generateRivers) -- see render.js
    // drawRiverOverlay.
    for (const part of ["cardinal", "hub"])
      critical.push(() => loadVariants(`river/${part}`, `assets/rivers/river_${part}`));
    // Shoreline overlay stubs -- same layer/rotate-at-draw-time technique,
    // drawn on a WATER tile toward each LAND neighbor rather than
    // connecting same-feature tiles to each other (see render.js's
    // drawShoreOverlay and tools/make-shore-stubs.ps1). No hub: unlike
    // roads/rivers converging on a single center point, two adjacent
    // cardinal edges' bands already cover a full tile edge each and
    // naturally overlap in the shared corner.
    for (const part of ["cardinal", "diagonal"])
      critical.push(() => loadVariants(`shore/${part}`, `assets/terrain/shore_${part}`));

    return runTiered(critical, background, onProgress);
  }

  /** On-demand load for exactly one unit's art -- covers cases preloadAll()
   *  doesn't reach for the current game's races (e.g. a Knowledge Base
   *  preview of an out-of-play race's unit, or from the title screen before
   *  anything has been preloaded). Same key/path convention preloadAll()
   *  itself uses for each unit shape -- race-locked and Wandering Monster
   *  units (raceId is meaningless for either: a monster's art is only ever
   *  registered unqualified) load the shared `unit/<id>` art; a true
   *  universal unit loads race-qualified `unit/<id>/<raceId>` art for
   *  whichever raceId the caller wants previewed. loadVariants is idempotent
   *  (no-ops if already registered), so calling this repeatedly for the same
   *  pair is cheap. Resolves either way -- a genuinely missing file just
   *  leaves the fallback glyph in place, same as everywhere else in this
   *  module; the caller decides what "still missing" looks like. */
  async function ensureUnitLoaded(unitId, raceId) {
    const unit = window.GameData.UNITS[unitId];
    if (!unit) return;
    const isTrueUniversal = !unit.raceOnly && !(window.GameData.MONSTER_UNIT_IDS && window.GameData.MONSTER_UNIT_IDS.has(unitId));
    if (isTrueUniversal) {
      await loadVariants(`unit/${unitId}/${raceId}`, `assets/units/${raceId}_${unitId}`);
    } else {
      await loadVariants(`unit/${unitId}`, `assets/units/${unitId}`);
    }
  }

  window.UI.sprites = {
    pick, pickDeterministic, pickUnit, pickBuilding, pickWallSegment, pickCityTier, currentFrame, preloadAll,
    ensureUnitLoaded,
  };
})();
