/**
 * SPRITE LOADER
 * -------------
 * Loads PNG assets for terrain, units, cities, and enhancements.
 * Manifests (frame size, layout, animation data) normally come from
 * js/data/sprite-manifests.js — a plain JS file that works under
 * file:// without any server or fetch(). Missing PNGs are skipped
 * silently; callers get null from pick() and fall back to color/symbol.
 *
 * Auto-detected per-asset JSON manifest: alongside any PNG, drop a same-
 * named .json file (e.g. assets/terrain/plains.png + plains.json, or
 * plains_1.png + plains_1.json for a numbered variant) describing that
 * image's frameWidth/frameHeight/layout/animations. If present, it's used
 * INSTEAD of the js/data/sprite-manifests.js entry for that image -- no
 * code change needed to add or tweak an animation, just ship the JSON next
 * to the art. This uses fetch(), which is blocked outright under a bare
 * file:// origin (no local server) -- unlike the Image() loading below.
 * We detect that up front (window.location.protocol === "file:") and skip
 * the fetch attempt entirely in that case, falling back straight to the
 * existing manifest resolution exactly as if no JSON existed. Trying the
 * fetch anyway and catching the failure doesn't work cleanly: the browser
 * logs the blocked request to the console itself before our JS ever sees
 * it, so skipping it outright is the only way to avoid that console noise.
 * Manifest JSON only ever loads when served over http (e.g. the dev preview
 * server); under file:// only the PNGs load, same as before.
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

  // fetch() is blocked outright under a bare file:// origin (no local server) --
  // the browser logs that block to the console itself, before our code ever
  // gets a chance to handle it, so a try/catch around the fetch can't suppress
  // it. Detecting the protocol up front lets us skip the fetch attempt
  // entirely under file://, which avoids the console noise altogether.
  const canFetchManifests = window.location.protocol !== "file:";

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject();
      img.src = src;
    });
  }

  function resolveManifest(key, image) {
    const manifests = window.GameData.SPRITE_MANIFESTS || {};
    if (manifests[key]) return manifests[key];
    // No manifest registered, and no per-asset JSON sidecar loaded either
    // (see loadVariants/loadManifestJson) -- this used to always treat the
    // WHOLE image as a single frame, which is correct for a genuinely
    // static sprite but silently mangles a multi-frame sheet: the entire
    // strip gets squished into one tile-sized draw, reading as a squished/
    // repeating mess instead of an idle animation. This is exactly what a
    // freshly-added unit sprite sheet looks like the moment its PNG lands in
    // assets/units/ before a matching entry is added here, OR (2026-07-18,
    // user-reported) under a bare file:// origin with no local server --
    // loadManifestJson's fetch() is deliberately skipped there (see
    // canFetchManifests above), so even an asset THAT DOES ship a JSON
    // sidecar falls all the way through to this function when opened that
    // way, while working fine once actually hosted (or served locally) lets
    // the JSON load normally.
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
   *  null (never throws) if it's missing, invalid, or we're running under a
   *  bare file:// origin -- callers fall back to resolveManifest(). */
  async function loadManifestJson(jsonPath) {
    if (!canFetchManifests) return null;
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

  /** Fires off all asset loads. Always resolves — failures are swallowed. */
  function preloadAll() {
    const loads = [];
    for (const id of Object.keys(window.GameData.TERRAIN))
      loads.push(loadVariants(`terrain/${id}`, `assets/terrain/${id}`));
    for (const id of window.GameData.UNIT_LIST)
      loads.push(loadVariants(`unit/${id}`, `assets/units/${id}`));
    // Units with no raceOnly (Pioneer, Scout, Galley) may additionally ship
    // race-specific art -- assets/units/{raceId}_{unitId}.png -- looked up
    // via pickUnit() in preference to the shared art above. Race-locked
    // units skip this: they only ever belong to one race already.
    const universalUnitIds = window.GameData.UNIT_LIST.filter(
      (id) => !window.GameData.UNITS[id].raceOnly
    );
    for (const unitId of universalUnitIds) {
      for (const raceId of window.GameData.RACE_LIST) {
        loads.push(loadVariants(`unit/${unitId}/${raceId}`, `assets/units/${raceId}_${unitId}`));
      }
    }
    for (const id of window.GameData.RACE_LIST) {
      loads.push(loadVariants(`city/${id}`, `assets/cities/${id}`));
      loads.push(loadCityTiers(id));
    }
    for (const id of window.GameData.RESOURCE_LIST)
      loads.push(loadVariants(`enhancement/resource_${id}`, `assets/enhancements/resource_${id}`));
    loads.push(loadVariants("enhancement/ruin", "assets/enhancements/ruin"));
    // Road overlay stubs -- layered/rotated at draw time (see render.js
    // drawRoadOverlay) to build any 8-neighbor connection pattern from just
    // these four, rather than pre-baking one image per combination.
    for (const part of ["cardinal", "diagonal", "hub"])
      loads.push(loadVariants(`road/${part}`, `assets/roads/road_${part}`));
    // River overlay stubs -- same technique, cardinal-only (rivers never
    // flow diagonally, see worldgen.js generateRivers) -- see render.js
    // drawRiverOverlay.
    for (const part of ["cardinal", "hub"])
      loads.push(loadVariants(`river/${part}`, `assets/rivers/river_${part}`));
    return Promise.allSettled(loads);
  }

  window.UI.sprites = { pick, pickUnit, pickCityTier, currentFrame, preloadAll };
})();
